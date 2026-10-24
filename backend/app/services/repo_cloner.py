import os
import re
import shutil
import zipfile
import subprocess
from pathlib import Path
from typing import Tuple, List, Dict, Optional
from ..config import settings
from ..models.schemas import FileTreeItem

# Patterns and directories to ignore when indexing codebases
IGNORED_DIRS = {
    ".git", ".github", ".vscode", ".idea", "node_modules", "venv", ".venv",
    "env", "__pycache__", "dist", "build", ".next", ".nuxt", "coverage",
    ".pytest_cache", "target", "bin", "obj", ".freebuff", ".gemini"
}

IGNORED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp", ".mp4",
    ".mp3", ".wav", ".pdf", ".zip", ".tar", ".gz", ".7z", ".exe", ".dll",
    ".so", ".dylib", ".class", ".pyc", ".pyo", ".lock", ".min.js", ".min.css",
    ".map", ".woff", ".woff2", ".ttf", ".eot"
}

EXTENSION_TO_LANGUAGE = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "css",
    ".java": "java",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".rb": "ruby",
    ".sql": "sql",
    ".sh": "bash",
    ".bash": "bash",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".md": "markdown",
    ".toml": "toml",
    ".dockerfile": "dockerfile"
}

class RepoClonerService:
    @staticmethod
    def sanitize_repo_id(raw_name: str) -> str:
        """Create a safe filesystem-friendly repository identifier."""
        clean = re.sub(r'[^a-zA-Z0-9_\-]', '_', raw_name)
        return clean.strip('_')[:64] or "default_repo"

    @classmethod
    def clone_github_repo(cls, repo_url: str) -> Tuple[str, Path]:
        """
        Shallow clone a public GitHub repository.
        Returns: (repo_id, destination_path)
        """
        # Validate GitHub URL format
        match = re.search(r'github\.com[/:]([\w\-_]+)/([\w\-_]+)(\.git)?', repo_url)
        if not match:
            raise ValueError("Invalid GitHub URL. Must be in format https://github.com/owner/repository")
        
        owner, repo_name = match.group(1), match.group(2)
        repo_id = f"{owner}_{repo_name}"
        dest_path = settings.repos_dir / repo_id

        # If already exists, clear to ensure fresh index
        if dest_path.exists():
            shutil.rmtree(dest_path, ignore_errors=True)
        dest_path.mkdir(parents=True, exist_ok=True)

        # Run shallow clone --depth 1
        cmd = ["git", "clone", "--depth", "1", repo_url, str(dest_path)]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Git clone failed: {e.stderr or e.stdout}")

        return repo_id, dest_path

    @classmethod
    def extract_zip(cls, zip_bytes: bytes, filename: str) -> Tuple[str, Path]:
        """
        Extract uploaded repository zip archive safely.
        """
        base_name = Path(filename).stem
        repo_id = cls.sanitize_repo_id(base_name)
        dest_path = settings.repos_dir / repo_id

        if dest_path.exists():
            shutil.rmtree(dest_path, ignore_errors=True)
        dest_path.mkdir(parents=True, exist_ok=True)

        zip_temp_path = dest_path / "temp.zip"
        with open(zip_temp_path, "wb") as f:
            f.write(zip_bytes)

        with zipfile.ZipFile(zip_temp_path, 'r') as zip_ref:
            # Prevent zip-slip vulnerability by validating member paths
            for member in zip_ref.namelist():
                member_path = Path(member)
                if member_path.is_absolute() or ".." in member_path.parts:
                    continue
                zip_ref.extract(member, dest_path)

        if zip_temp_path.exists():
            zip_temp_path.unlink()

        # If contents were wrapped in a single top-level directory, normalize it
        extracted_items = list(dest_path.iterdir())
        if len(extracted_items) == 1 and extracted_items[0].is_dir():
            nested_dir = extracted_items[0]
            for item in nested_dir.iterdir():
                shutil.move(str(item), str(dest_path / item.name))
            nested_dir.rmdir()

        return repo_id, dest_path

    @classmethod
    def get_file_tree(cls, repo_id: str) -> List[FileTreeItem]:
        """
        Return hierarchical file tree of the ingested repository for UI navigation.
        """
        repo_path = settings.repos_dir / repo_id
        if not repo_path.exists():
            return []

        def build_tree(current_path: Path) -> List[FileTreeItem]:
            items: List[FileTreeItem] = []
            try:
                for entry in sorted(current_path.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower())):
                    if entry.name in IGNORED_DIRS or entry.suffix.lower() in IGNORED_EXTENSIONS:
                        continue

                    rel_path = str(entry.relative_to(repo_path)).replace("\\", "/")
                    if entry.is_dir():
                        children = build_tree(entry)
                        # Only include non-empty folders
                        items.append(FileTreeItem(
                            path=rel_path,
                            name=entry.name,
                            is_dir=True,
                            children=children
                        ))
                    else:
                        lang = EXTENSION_TO_LANGUAGE.get(entry.suffix.lower(), "text")
                        try:
                            size = entry.stat().st_size
                        except OSError:
                            size = 0
                        items.append(FileTreeItem(
                            path=rel_path,
                            name=entry.name,
                            is_dir=False,
                            size=size,
                            language=lang
                        ))
            except PermissionError:
                pass
            return items

        return build_tree(repo_path)
