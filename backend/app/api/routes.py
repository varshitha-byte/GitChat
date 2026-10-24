import time
from pathlib import Path
from collections import Counter
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from ..config import settings
from ..models.schemas import (
    IngestRequest, IngestResponse, QueryRequest, QueryResponse,
    FileTreeItem, FileContentResponse, RepoStatusResponse
)
from ..services.repo_cloner import RepoClonerService, EXTENSION_TO_LANGUAGE
from ..services.parser import CodeParserService
from ..services.vector_store import VectorStore, get_or_load_vector_store, register_vector_store
from ..services.retriever import HybridRetriever
from ..services.llm_service import LLMService

router = APIRouter()

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.app_version
    }

@router.post("/ingest", response_model=IngestResponse)
def ingest_github_repository(request: IngestRequest):
    """
    Clone a public GitHub repository, parse code into cohesive chunks, and generate hybrid index.
    """
    if not request.repo_url:
        raise HTTPException(status_code=400, detail="Repository URL is required.")

    try:
        repo_id, repo_path = RepoClonerService.clone_github_repo(request.repo_url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to clone repository: {str(e)}")

    # Parse repository into code chunks
    chunks = CodeParserService.parse_repository(repo_path)
    if not chunks:
        raise HTTPException(status_code=400, detail="No indexable code files found in the repository.")

    # Build hybrid vector store (dense + BM25)
    store = VectorStore(repo_id=repo_id)
    store.build_index(
        chunks=chunks,
        provider=request.provider or "gemini",
        api_key=request.api_key
    )
    register_vector_store(store)

    # Calculate language breakdown statistics
    languages = Counter([c.language for c in chunks])
    unique_files = len(set(c.file_path for c in chunks))

    return IngestResponse(
        repo_id=repo_id,
        repo_name=repo_id.replace("_", "/"),
        total_files=unique_files,
        total_chunks=len(chunks),
        languages=dict(languages.most_common(8)),
        message="Repository cloned and indexed successfully."
    )

@router.post("/upload-zip", response_model=IngestResponse)
async def upload_and_ingest_zip(
    file: UploadFile = File(...),
    api_key: Optional[str] = Form(None),
    provider: Optional[str] = Form("gemini")
):
    """
    Upload a repository .zip file directly, extract, and index.
    """
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are supported.")

    try:
        content = await file.read()
        repo_id, repo_path = RepoClonerService.extract_zip(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract zip file: {str(e)}")

    chunks = CodeParserService.parse_repository(repo_path)
    if not chunks:
        raise HTTPException(status_code=400, detail="No indexable code files found in the uploaded zip.")

    store = VectorStore(repo_id=repo_id)
    store.build_index(chunks=chunks, provider=provider or "gemini", api_key=api_key)
    register_vector_store(store)

    languages = Counter([c.language for c in chunks])
    unique_files = len(set(c.file_path for c in chunks))

    return IngestResponse(
        repo_id=repo_id,
        repo_name=repo_id,
        total_files=unique_files,
        total_chunks=len(chunks),
        languages=dict(languages.most_common(8)),
        message="Zip archive extracted and indexed successfully."
    )

@router.post("/query", response_model=QueryResponse)
def query_codebase(request: QueryRequest):
    """
    Query the indexed repository using Hybrid RAG (BM25 + Semantic Search + LLM).
    """
    store = get_or_load_vector_store(request.repo_id)
    if not store:
        raise HTTPException(status_code=404, detail=f"Repository '{request.repo_id}' is not indexed yet.")

    start_time = time.time()

    # 1. Hybrid Retrieval & Context Assembly
    citations, context = HybridRetriever.retrieve_context(
        store=store,
        query=request.query,
        top_k=request.top_k,
        provider=request.provider,
        api_key=request.api_key
    )

    # 2. LLM Reasoning & Grounded Generation
    answer, confidence, provider_used = LLMService.answer_query(
        query=request.query,
        context=context,
        citations=citations,
        provider=request.provider,
        api_key=request.api_key,
        repo_id=request.repo_id,
        store=store
    )

    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    return QueryResponse(
        answer=answer,
        citations=citations,
        confidence=confidence,
        provider_used=provider_used,
        query_time_ms=elapsed_ms
    )

@router.get("/repos", response_model=List[str])
def list_indexed_repositories():
    """
    List all indexed repositories stored on disk.
    """
    repos = []
    if settings.index_dir.exists():
        for meta_file in settings.index_dir.glob("*_meta.json"):
            repo_id = meta_file.name.replace("_meta.json", "")
            repos.append(repo_id)
    return repos

@router.get("/repos/{repo_id}/tree", response_model=List[FileTreeItem])
def get_repository_file_tree(repo_id: str):
    """
    Returns the file tree hierarchy for the interactive repository explorer.
    """
    tree = RepoClonerService.get_file_tree(repo_id)
    if not tree:
        raise HTTPException(status_code=404, detail=f"Repository '{repo_id}' files not found.")
    return tree

@router.get("/repos/{repo_id}/file", response_model=FileContentResponse)
def get_file_content(repo_id: str, path: str = Query(..., description="Relative file path")):
    """
    Fetch file content for the live code viewer with line numbers.
    """
    safe_path = Path(path)
    if safe_path.is_absolute() or ".." in safe_path.parts:
        raise HTTPException(status_code=400, detail="Invalid path traversal detected.")

    target_file = settings.repos_dir / repo_id / safe_path
    if not target_file.exists() or not target_file.is_file():
        raise HTTPException(status_code=404, detail="Requested file does not exist.")

    try:
        with open(target_file, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

    lang = EXTENSION_TO_LANGUAGE.get(target_file.suffix.lower(), "text")
    lines_count = len(content.splitlines())

    return FileContentResponse(
        path=path,
        content=content,
        language=lang,
        total_lines=lines_count
    )
