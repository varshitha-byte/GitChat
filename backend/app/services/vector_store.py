import json
import re
import numpy as np
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from rank_bm25 import BM25Okapi
from ..config import settings
from .parser import CodeChunk
from .embedding import EmbeddingService

class VectorStore:
    def __init__(self, repo_id: str):
        self.repo_id = repo_id
        self.chunks: List[CodeChunk] = []
        self.embeddings_matrix: Optional[np.ndarray] = None
        self.bm25: Optional[BM25Okapi] = None
        self.tokenized_corpus: List[List[str]] = []

    @staticmethod
    def tokenize_code(text: str) -> List[str]:
        """
        Code-aware tokenization: splits by whitespace, punctuation, camelCase, and snake_case.
        Crucial for matching identifiers in software engineering queries!
        """
        # Split camelCase and snake_case identifiers
        s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', text)
        clean = re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()
        # Extract all alphanumeric words and symbols
        tokens = re.findall(r'[a-zA-Z0-9_]+', clean)
        return [t for t in tokens if len(t) > 1]

    def build_index(
        self,
        chunks: List[CodeChunk],
        provider: str = "gemini",
        api_key: Optional[str] = None
    ):
        """
        Build both the dense vector embedding matrix and the sparse BM25 index.
        """
        self.chunks = chunks
        if not chunks:
            self.embeddings_matrix = np.empty((0, 256), dtype=np.float32)
            self.bm25 = None
            return

        # 1. Dense Embeddings
        texts = [chunk.embedding_text for chunk in chunks]
        embeddings = EmbeddingService.get_embeddings(texts, provider=provider, api_key=api_key)
        matrix = np.array(embeddings, dtype=np.float32)

        # L2-normalize vectors for fast cosine distance via simple dot-product
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1e-10
        self.embeddings_matrix = matrix / norms

        # 2. Sparse BM25 Index
        self.tokenized_corpus = [self.tokenize_code(chunk.embedding_text) for chunk in chunks]
        self.bm25 = BM25Okapi(self.tokenized_corpus)

    def dense_search(self, query_vec: List[float], top_k: int = 10) -> List[Tuple[CodeChunk, float]]:
        """
        Perform cosine similarity search across all stored chunk vectors using NumPy.
        """
        if self.embeddings_matrix is None or len(self.chunks) == 0:
            return []

        q_vec = np.array(query_vec, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm > 0:
            q_vec = q_vec / q_norm

        # Check dimension compatibility (e.g. if fallback vs real API key changed)
        if q_vec.shape[0] != self.embeddings_matrix.shape[1]:
            # Adjust dimension or re-normalize
            min_dim = min(q_vec.shape[0], self.embeddings_matrix.shape[1])
            q_vec = q_vec[:min_dim]
            matrix_slice = self.embeddings_matrix[:, :min_dim]
            sims = np.dot(matrix_slice, q_vec)
        else:
            sims = np.dot(self.embeddings_matrix, q_vec)

        # Get top-k indices with meaningful similarity
        top_indices = np.argsort(sims)[::-1][:top_k]
        return [(self.chunks[i], float(sims[i])) for i in top_indices if float(sims[i]) > 0.08]

    def sparse_search(self, query: str, top_k: int = 10) -> List[Tuple[CodeChunk, float]]:
        """
        Perform BM25 keyword matching for exact function/variable/route names.
        """
        if self.bm25 is None or len(self.chunks) == 0:
            return []

        query_tokens = self.tokenize_code(query)
        if not query_tokens:
            return []

        scores = self.bm25.get_scores(query_tokens)
        top_indices = np.argsort(scores)[::-1][:top_k]
        return [(self.chunks[i], float(scores[i])) for i in top_indices if scores[i] > 0]

    def save(self, index_dir: Path):
        """
        Persist vector store to disk.
        """
        index_dir.mkdir(parents=True, exist_ok=True)
        meta_file = index_dir / f"{self.repo_id}_meta.json"
        matrix_file = index_dir / f"{self.repo_id}_matrix.npy"

        chunks_data = [chunk.model_dump() for chunk in self.chunks]
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump({
                "repo_id": self.repo_id,
                "chunks": chunks_data
            }, f, indent=2)

        if self.embeddings_matrix is not None:
            np.save(matrix_file, self.embeddings_matrix)

    @classmethod
    def load(cls, repo_id: str, index_dir: Path) -> Optional['VectorStore']:
        """
        Load index and chunk metadata from disk.
        """
        meta_file = index_dir / f"{repo_id}_meta.json"
        matrix_file = index_dir / f"{repo_id}_matrix.npy"

        if not meta_file.exists():
            return None

        with open(meta_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        store = cls(repo_id=repo_id)
        store.chunks = [CodeChunk(**c) for c in data["chunks"]]

        if matrix_file.exists():
            store.embeddings_matrix = np.load(matrix_file)

        # Reconstruct BM25 model in memory from chunk texts
        if store.chunks:
            store.tokenized_corpus = [cls.tokenize_code(c.embedding_text) for c in store.chunks]
            store.bm25 = BM25Okapi(store.tokenized_corpus)

        return store

# Global Vector Store Manager Cache
_STORE_REGISTRY: Dict[str, VectorStore] = {}

def get_or_load_vector_store(repo_id: str) -> Optional[VectorStore]:
    """Retrieve vector store from in-memory cache or load from disk."""
    if repo_id in _STORE_REGISTRY:
        return _STORE_REGISTRY[repo_id]

    store = VectorStore.load(repo_id, settings.index_dir)
    if store:
        _STORE_REGISTRY[repo_id] = store
        return store
    return None

def register_vector_store(store: VectorStore):
    """Cache and persist a newly built vector store."""
    _STORE_REGISTRY[store.repo_id] = store
    store.save(settings.index_dir)
