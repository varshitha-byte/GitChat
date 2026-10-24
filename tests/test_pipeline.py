import sys
from pathlib import Path

# Add root directory to path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from backend.app.services.parser import CodeParserService
from backend.app.services.vector_store import VectorStore
from backend.app.services.retriever import HybridRetriever
from backend.app.services.llm_service import LLMService

def run_test():
    print("Testing CodeParserService on backend directory...")
    backend_dir = root_dir / "backend"
    chunks = CodeParserService.parse_repository(backend_dir)
    print(f"Parsed {len(chunks)} code chunks.")
    assert len(chunks) > 0, "No chunks parsed!"

    print("\nTesting VectorStore index build (offline/fallback mode)...")
    store = VectorStore(repo_id="test_backend")
    store.build_index(chunks, provider="offline")
    assert store.embeddings_matrix is not None, "Embeddings matrix is None!"
    assert store.bm25 is not None, "BM25 model is None!"
    print(f"Embeddings matrix shape: {store.embeddings_matrix.shape}")

    print("\nTesting Hybrid Retrieval for: 'Where is authentication or vector store defined?'...")
    citations, context = HybridRetriever.retrieve_context(
        store=store,
        query="vector store cosine similarity search",
        top_k=3,
        provider="offline"
    )
    print(f"Retrieved {len(citations)} citations:")
    for c in citations:
        print(f" - {c.file_path} (Lines {c.start_line}-{c.end_line}) [Score: {c.score}]")
    assert len(citations) > 0, "No citations retrieved!"

    print("\nTesting LLM Answering Service (Offline Heuristic)...")
    answer, confidence, provider = LLMService.answer_query(
        query="How does vector store similarity work?",
        context=context,
        citations=citations,
        provider="offline"
    )
    print(f"Confidence: {confidence} | Provider: {provider}")
    print(f"Answer Preview:\n{answer[:250]}...\n")

    print("ALL PIPELINE TESTS PASSED SUCCESSFULLY! [PASS]")

if __name__ == "__main__":
    run_test()
