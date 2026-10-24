import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from ..config import settings
from .repo_cloner import IGNORED_DIRS, IGNORED_EXTENSIONS, EXTENSION_TO_LANGUAGE

class CodeChunk(BaseModel):
    chunk_id: str
    file_path: str
    language: str
    start_line: int
    end_line: int
    scope_type: str
    scope_name: Optional[str] = None
    content: str
    embedding_text: str

class CodeParserService:
    @staticmethod
    def is_valid_code_file(path: Path) -> bool:
        if path.name.startswith(".") and path.name not in {".env.example", ".gitignore"}:
            return False
        if any(part in IGNORED_DIRS for part in path.parts):
            return False
        if path.suffix.lower() in IGNORED_EXTENSIONS:
            return False
        return True

    @classmethod
    def parse_repository(cls, repo_dir: Path) -> List[CodeChunk]:
        """
        Traverse repository directory and parse all code files into enriched code chunks.
        """
        chunks: List[CodeChunk] = []
        if not repo_dir.exists():
            return chunks

        for file_path in repo_dir.rglob("*"):
            if not file_path.is_file() or not cls.is_valid_code_file(file_path):
                continue

            rel_path = str(file_path.relative_to(repo_dir)).replace("\\", "/")
            ext = file_path.suffix.lower()
            lang = EXTENSION_TO_LANGUAGE.get(ext, "text")

            try:
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    code = f.read()
            except Exception:
                continue

            # Skip empty or minified/huge single-line files
            lines = code.splitlines()
            if not lines or len(code) > 2_000_000:  # Skip files larger than 2MB
                continue

            file_chunks = cls.chunk_file(rel_path, lines, lang)
            chunks.extend(file_chunks)

        return chunks

    @classmethod
    def chunk_file(cls, file_path: str, lines: List[str], language: str) -> List[CodeChunk]:
        """
        Break a single file into syntax-aware cohesive chunks.
        """
        if language == "python":
            return cls._chunk_python(file_path, lines)
        elif language in {"javascript", "typescript"}:
            return cls._chunk_c_style(file_path, lines, language)
        elif language in {"go", "java", "rust", "cpp", "c", "csharp"}:
            return cls._chunk_c_style(file_path, lines, language)
        else:
            return cls._chunk_generic(file_path, lines, language)

    @classmethod
    def _chunk_python(cls, file_path: str, lines: List[str]) -> List[CodeChunk]:
        """
        Python structural chunker: breaks at top-level functions and classes.
        """
        chunks: List[CodeChunk] = []
        total_lines = len(lines)
        if total_lines <= settings.chunk_max_lines:
            # File is small enough to be a single chunk
            content = "\n".join(lines)
            chunk = cls._create_chunk(
                file_path=file_path,
                start_line=1,
                end_line=total_lines,
                language="python",
                scope_type="module",
                scope_name=Path(file_path).stem,
                content=content
            )
            return [chunk]

        # Scan for structural definition lines: def, async def, class
        boundary_indices = []
        scope_names = []
        scope_types = []

        for idx, line in enumerate(lines):
            stripped = line.strip()
            # Top-level or indented class/function
            match = re.match(r'^(?:async\s+def|def|class)\s+([a-zA-Z0-9_]+)', stripped)
            if match:
                boundary_indices.append(idx)
                s_name = match.group(1)
                s_type = "class" if stripped.startswith("class") else "function"
                scope_names.append(s_name)
                scope_types.append(s_type)

        if not boundary_indices:
            return cls._chunk_generic(file_path, lines, "python")

        # Capture file header / imports if first boundary is after line 1
        if boundary_indices[0] > 0:
            header_content = "\n".join(lines[:boundary_indices[0]])
            if header_content.strip():
                chunks.append(cls._create_chunk(
                    file_path=file_path,
                    start_line=1,
                    end_line=boundary_indices[0],
                    language="python",
                    scope_type="imports_header",
                    scope_name=f"{Path(file_path).stem}_imports",
                    content=header_content
                ))

        for i in range(len(boundary_indices)):
            start_idx = boundary_indices[i]
            end_idx = boundary_indices[i + 1] if i + 1 < len(boundary_indices) else total_lines
            
            chunk_lines = lines[start_idx:end_idx]
            
            # If a single function/class is excessively long, subdivide it
            if len(chunk_lines) > settings.chunk_max_lines * 2:
                sub_chunks = cls._subdivide_lines(
                    file_path=file_path,
                    base_line=start_idx + 1,
                    lines=chunk_lines,
                    language="python",
                    scope_type=scope_types[i],
                    scope_name=scope_names[i]
                )
                chunks.extend(sub_chunks)
            else:
                chunks.append(cls._create_chunk(
                    file_path=file_path,
                    start_line=start_idx + 1,
                    end_line=end_idx,
                    language="python",
                    scope_type=scope_types[i],
                    scope_name=scope_names[i],
                    content="\n".join(chunk_lines)
                ))

        return chunks

    @classmethod
    def _chunk_c_style(cls, file_path: str, lines: List[str], language: str) -> List[CodeChunk]:
        """
        Chunk JS/TS/Go/Java/C++ files by tracking function and class definitions.
        """
        total_lines = len(lines)
        if total_lines <= settings.chunk_max_lines:
            return [cls._create_chunk(
                file_path=file_path,
                start_line=1,
                end_line=total_lines,
                language=language,
                scope_type="module",
                scope_name=Path(file_path).stem,
                content="\n".join(lines)
            )]

        # Regex for C-style functions, arrow functions, classes, interfaces
        pattern = re.compile(
            r'^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|func\s+\w+|public\s+|private\s+)',
            re.MULTILINE
        )

        boundaries = []
        for idx, line in enumerate(lines):
            if pattern.search(line.strip()):
                boundaries.append(idx)

        if len(boundaries) <= 1:
            return cls._chunk_generic(file_path, lines, language)

        chunks: List[CodeChunk] = []
        if boundaries[0] > 0:
            header = "\n".join(lines[:boundaries[0]])
            if header.strip():
                chunks.append(cls._create_chunk(
                    file_path=file_path,
                    start_line=1,
                    end_line=boundaries[0],
                    language=language,
                    scope_type="header",
                    scope_name="imports",
                    content=header
                ))

        for i in range(len(boundaries)):
            start_idx = boundaries[i]
            end_idx = boundaries[i + 1] if i + 1 < len(boundaries) else total_lines
            content = "\n".join(lines[start_idx:end_idx])
            chunks.append(cls._create_chunk(
                file_path=file_path,
                start_line=start_idx + 1,
                end_line=end_idx,
                language=language,
                scope_type="block",
                scope_name=f"block_{i+1}",
                content=content
            ))

        return chunks

    @classmethod
    def _chunk_generic(cls, file_path: str, lines: List[str], language: str) -> List[CodeChunk]:
        """
        Sliding window chunking with line overlap for general files (HTML, SQL, YAML, Markdown).
        """
        chunks: List[CodeChunk] = []
        step = settings.chunk_max_lines - settings.chunk_overlap_lines
        total_lines = len(lines)

        for i in range(0, total_lines, step):
            start = i
            end = min(i + settings.chunk_max_lines, total_lines)
            content = "\n".join(lines[start:end])
            if content.strip():
                chunks.append(cls._create_chunk(
                    file_path=file_path,
                    start_line=start + 1,
                    end_line=end,
                    language=language,
                    scope_type="section",
                    scope_name=f"lines_{start+1}_{end}",
                    content=content
                ))
            if end >= total_lines:
                break

        return chunks

    @classmethod
    def _subdivide_lines(cls, file_path: str, base_line: int, lines: List[str], language: str, scope_type: str, scope_name: str) -> List[CodeChunk]:
        chunks = []
        step = settings.chunk_max_lines - settings.chunk_overlap_lines
        for i in range(0, len(lines), step):
            start = i
            end = min(i + settings.chunk_max_lines, len(lines))
            content = "\n".join(lines[start:end])
            chunks.append(cls._create_chunk(
                file_path=file_path,
                start_line=base_line + start,
                end_line=base_line + end - 1,
                language=language,
                scope_type=scope_type,
                scope_name=f"{scope_name}_part{i//step + 1}",
                content=content
            ))
            if end >= len(lines):
                break
        return chunks

    @staticmethod
    def _create_chunk(file_path: str, start_line: int, end_line: int, language: str, scope_type: str, scope_name: Optional[str], content: str) -> CodeChunk:
        chunk_id = f"{file_path}#L{start_line}-L{end_line}"
        # Enriched embedding text embeds file name, language, and scope to boost retrieval accuracy
        header = f"File: {file_path} (Lines {start_line}-{end_line})\nLanguage: {language}\nScope: {scope_type} {scope_name or ''}\n---\n"
        embedding_text = header + content
        return CodeChunk(
            chunk_id=chunk_id,
            file_path=file_path,
            language=language,
            start_line=start_line,
            end_line=end_line,
            scope_type=scope_type,
            scope_name=scope_name,
            content=content,
            embedding_text=embedding_text
        )
