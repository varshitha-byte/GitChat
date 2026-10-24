import hashlib
import numpy as np
from typing import List, Optional
import google.generativeai as genai
import openai
from ..config import settings

class EmbeddingService:
    @staticmethod
    def _fallback_hash_embedding(text: str, dim: int = 256) -> List[float]:
        """
        Deterministic lightweight feature hash vectorizer.
        Ensures the application operates seamlessly even without paid API keys.
        """
        vec = np.zeros(dim, dtype=np.float32)
        # Tokenize by words and sub-tokens (snake_case and camelCase splitting)
        tokens = [t.lower() for t in text.split() if t.strip()]
        for token in tokens:
            # 3-gram sub-word hash features
            for i in range(max(1, len(token) - 2)):
                sub = token[i:i+3]
                h = int(hashlib.md5(sub.encode('utf-8')).hexdigest(), 16)
                idx = h % dim
                vec[idx] += 1.0

        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    @classmethod
    def get_embeddings(
        cls,
        texts: List[str],
        provider: str = "gemini",
        api_key: Optional[str] = None
    ) -> List[List[float]]:
        """
        Generate dense vector embeddings for a list of texts.
        Supports: 'gemini', 'openai', or falls back gracefully to local feature vectorizer.
        """
        key = api_key or settings.gemini_api_key or settings.openai_api_key

        if provider == "gemini" and (api_key or settings.gemini_api_key):
            try:
                genai.configure(api_key=key)
                embeddings = []
                # Batch in groups of 20 to avoid payload limits
                batch_size = 20
                for i in range(0, len(texts), batch_size):
                    batch = texts[i:i + batch_size]
                    result = genai.embed_content(
                        model="models/text-embedding-004",
                        content=batch,
                        task_type="retrieval_document"
                    )
                    embeddings.extend(result['embedding'])
                return embeddings
            except Exception as e:
                print(f"[Embedding Warning] Gemini embedding failed ({e}), falling back to local vectorizer.")

        elif provider == "openai" and (api_key or settings.openai_api_key):
            try:
                client = openai.OpenAI(api_key=key)
                embeddings = []
                batch_size = 50
                for i in range(0, len(texts), batch_size):
                    batch = texts[i:i + batch_size]
                    res = client.embeddings.create(
                        input=batch,
                        model="text-embedding-3-small"
                    )
                    embeddings.extend([d.embedding for d in res.data])
                return embeddings
            except Exception as e:
                print(f"[Embedding Warning] OpenAI embedding failed ({e}), falling back to local vectorizer.")

        # Default / Fallback Deterministic Embeddings
        return [cls._fallback_hash_embedding(t) for t in texts]

    @classmethod
    def get_query_embedding(
        cls,
        query: str,
        provider: str = "gemini",
        api_key: Optional[str] = None
    ) -> List[float]:
        """
        Generate embedding for a single user search query.
        """
        key = api_key or settings.gemini_api_key or settings.openai_api_key

        if provider == "gemini" and (api_key or settings.gemini_api_key):
            try:
                genai.configure(api_key=key)
                res = genai.embed_content(
                    model="models/text-embedding-004",
                    content=query,
                    task_type="retrieval_query"
                )
                return res['embedding']
            except Exception as e:
                print(f"[Query Embedding Warning] Gemini query embedding fallback: {e}")

        elif provider == "openai" and (api_key or settings.openai_api_key):
            try:
                client = openai.OpenAI(api_key=key)
                res = client.embeddings.create(
                    input=query,
                    model="text-embedding-3-small"
                )
                return res.data[0].embedding
            except Exception as e:
                print(f"[Query Embedding Warning] OpenAI query embedding fallback: {e}")

        return cls._fallback_hash_embedding(query)
