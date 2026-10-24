from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

class IngestRequest(BaseModel):
    repo_url: Optional[str] = Field(None, description="GitHub repository HTTPS URL")
    api_key: Optional[str] = Field(None, description="Optional LLM API Key (Gemini or OpenAI)")
    provider: Optional[str] = Field("gemini", description="LLM provider: 'gemini', 'openai', or 'offline'")

class IngestResponse(BaseModel):
    repo_id: str
    repo_name: str
    total_files: int
    total_chunks: int
    languages: Dict[str, int]
    message: str

class Citation(BaseModel):
    file_path: str
    start_line: int
    end_line: int
    snippet: str
    score: float
    scope_name: Optional[str] = None
    language: Optional[str] = None

class QueryRequest(BaseModel):
    repo_id: str
    query: str
    top_k: int = 6
    provider: str = "gemini"
    api_key: Optional[str] = None

class QueryResponse(BaseModel):
    answer: str
    citations: List[Citation]
    confidence: str
    provider_used: str
    query_time_ms: float

class FileTreeItem(BaseModel):
    path: str
    name: str
    is_dir: bool
    size: int = 0
    language: Optional[str] = None
    children: Optional[List['FileTreeItem']] = None

FileTreeItem.model_rebuild()

class FileContentResponse(BaseModel):
    path: str
    content: str
    language: str
    total_lines: int

class RepoStatusResponse(BaseModel):
    repo_id: str
    is_indexed: bool
    total_files: int
    total_chunks: int
    languages: Dict[str, int]
