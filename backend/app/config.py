import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_DIR = BASE_DIR / "storage"
REPOS_DIR = STORAGE_DIR / "repos"
INDEX_DIR = STORAGE_DIR / "index"

# Create required directories if they don't exist
REPOS_DIR.mkdir(parents=True, exist_ok=True)
INDEX_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    app_name: str = "Codebase RAG Assistant"
    app_version: str = "1.0.0"
    base_dir: Path = BASE_DIR
    repos_dir: Path = REPOS_DIR
    index_dir: Path = INDEX_DIR
    
    # LLM & Embedding Settings
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    default_llm_provider: str = os.getenv("LLM_PROVIDER", "gemini")
    
    # Retrieval Hyperparameters
    chunk_min_lines: int = 5
    chunk_max_lines: int = 60
    chunk_overlap_lines: int = 5
    top_k_retrieval: int = 6
    rrf_k: int = 60
    
    # Server configuration
    host: str = "127.0.0.1"
    port: int = 8000

settings = Settings()
