from typing import List, Dict, Tuple, Optional
from ..config import settings
from ..models.schemas import Citation
from .parser import CodeChunk
from .embedding import EmbeddingService
from .vector_store import VectorStore

class HybridRetriever:
    @staticmethod
    def reciprocal_rank_fusion(
        dense_results: List[Tuple[CodeChunk, float]],
        sparse_results: List[Tuple[CodeChunk, float]],
        k: int = 60
    ) -> List[Tuple[CodeChunk, float]]:
        """
        Combine dense and sparse search rankings using Reciprocal Rank Fusion (RRF).
        RRF eliminates the need to normalize incompatible score scales.
        """
        scores: Dict[str, float] = {}
        chunk_map: Dict[str, CodeChunk] = {}

        # 1. Score Dense Ranks
        for rank, (chunk, _) in enumerate(dense_results):
            cid = chunk.chunk_id
            chunk_map[cid] = chunk
            scores[cid] = scores.get(cid, 0.0) + (1.0 / (k + rank + 1))

        # 2. Score Sparse (BM25) Ranks
        for rank, (chunk, _) in enumerate(sparse_results):
            cid = chunk.chunk_id
            chunk_map[cid] = chunk
            scores[cid] = scores.get(cid, 0.0) + (1.0 / (k + rank + 1))

        # Sort descending by fused RRF score
        sorted_cids = sorted(scores.keys(), key=lambda c: scores[c], reverse=True)
        return [(chunk_map[cid], scores[cid]) for cid in sorted_cids]

    @classmethod
    def retrieve_context(
        cls,
        store: VectorStore,
        query: str,
        top_k: int = 6,
        provider: str = "gemini",
        api_key: Optional[str] = None
    ) -> Tuple[List[Citation], str]:
        """
        Executes hybrid retrieval and returns structured citations + formatted context block.
        """
        # 1. Embed query
        query_vec = EmbeddingService.get_query_embedding(query, provider=provider, api_key=api_key)

        # 2. Dense search (top 2 * k)
        dense_hits = store.dense_search(query_vec, top_k=top_k * 2)

        # 3. Sparse BM25 search (top 2 * k)
        sparse_hits = store.sparse_search(query, top_k=top_k * 2)

        # 4. Fuse using RRF
        fused = cls.reciprocal_rank_fusion(dense_hits, sparse_hits, k=settings.rrf_k)
        top_chunks = fused[:top_k]

        citations: List[Citation] = []
        context_blocks: List[str] = []

        for idx, (chunk, score) in enumerate(top_chunks, 1):
            citations.append(Citation(
                file_path=chunk.file_path,
                start_line=chunk.start_line,
                end_line=chunk.end_line,
                snippet=chunk.content[:400] + ("..." if len(chunk.content) > 400 else ""),
                score=round(score, 4),
                scope_name=chunk.scope_name,
                language=chunk.language
            ))

            block = (
                f"### Context Snippet {idx} | File: {chunk.file_path} (Lines {chunk.start_line}-{chunk.end_line})\n"
                f"Language: {chunk.language} | Scope: {chunk.scope_type} {chunk.scope_name or ''}\n"
                f"```{chunk.language}\n"
                f"{chunk.content}\n"
                f"```\n"
            )
            context_blocks.append(block)

        formatted_context = "\n".join(context_blocks)
        return citations, formatted_context
