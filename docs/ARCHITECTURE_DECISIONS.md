# Architecture Decision Records (ADR)
## Project: Codebase RAG / AI Developer Assistant

This document captures every major engineering, algorithmic, and architectural decision made in this project, explaining **what was chosen**, **what alternatives were considered**, and **why this choice is superior** for production readiness and SDE interview defense.

---

### ADR 001: Backend Framework Selection
- **Status**: Accepted
- **Decision**: Use **FastAPI** (Python 3.12) running on **Uvicorn** (ASGI).
- **Alternatives Considered**:
  1. *Flask*: Lightweight WSGI, but lacks native async/await, lacks built-in request validation, and requires manual Swagger integration.
  2. *Django*: Monolithic with an ORM and admin dashboard, which adds unnecessary overhead for a microservice-style RAG engine.
  3. *Node.js / Express*: Strong async I/O, but Python has the dominant ecosystem for AI/ML, NLP, vector calculations, and LLM SDKs.
- **Rationale**:
  - **Asynchronous I/O**: Cloning git repositories, reading file trees, calling embedding APIs, and querying LLMs are I/O-bound. FastAPI’s `async def` handles concurrent developer requests without blocking the event loop.
  - **Type Safety & Auto-Validation**: Pydantic models automatically validate incoming requests and sanitize responses, catching runtime errors before they hit services.
  - **Automatic OpenAPI Documentation**: FastAPI automatically produces interactive Swagger UI at `/docs`, which is invaluable for code demos and interview walkthroughs.

---

### ADR 002: Code Chunking Strategy
- **Status**: Accepted
- **Decision**: Implement **Code-Aware Syntax & Scope Chunking** with structural metadata instead of fixed-character naive slicing.
- **Alternatives Considered**:
  1. *Fixed-Size Windowing (e.g. 500 characters, 50-character overlap)*: Common in text RAG, but catastrophic for code. It splits functions in half, cuts off variable declarations from their uses, and isolates classes from their imports.
  2. *Heavy Tree-Sitter compilation*: Requires platform-specific C-bindings which often fail to install or compile on Windows and minimal CI/CD containers.
- **Rationale**:
  - **Logical Cohesion**: Code is organized into units of meaning: functions, classes, methods, and configuration blocks. Our parser identifies language boundaries, functions, and classes using language-specific structural delimiters.
  - **Context Enrichment**: Each code chunk is tagged with rich metadata:
    - `file_path`: Exact repository path (e.g. `src/auth/jwt_service.py`).
    - `language`: Detected programming language (Python, JavaScript, TypeScript, Go, Java, Rust, HTML, CSS, SQL, etc.).
    - `start_line` & `end_line`: Precise line numbers for exact code navigation.
    - `scope_type`: Whether the chunk is a `function`, `class`, `module_header`, or `block`.
    - `parent_scope`: Name of the parent class or function.
  - **Interview Talking Point**: *"In standard document RAG, sentences can be cut somewhat arbitrarily; in code RAG, splitting a 20-line authentication function into two 10-line halves removes the return statement or security check, making the embedding useless. Preserving syntactic boundaries directly prevents hallucination."*

---

### ADR 003: Hybrid Retrieval (Dense Semantic + Sparse Keyword) with Reciprocal Rank Fusion (RRF)
- **Status**: Accepted
- **Decision**: Combine **Dense Vector Search** (Cosine Similarity on Embeddings) with **Sparse Keyword Search** (BM25 algorithm) unified by **Reciprocal Rank Fusion (RRF)**.
- **Alternatives Considered**:
  1. *Dense-Only Vector Search*: Great for conceptual questions ("Where is password verification happening?"), but fails miserably when developers query specific identifiers (e.g., `JWT_SECRET_KEY`, `db.collection('users')`, error codes, or function names like `authenticate_user`).
  2. *Sparse-Only Search (Elasticsearch/BM25)*: Great for exact keyword matches, but fails on semantic queries where the code doesn't use the exact words (e.g. asking "how do we handle user login" when the code only uses "sessions" or "tokens").
- **Rationale**:
  - **Best of Both Worlds**:
    - BM25 captures precise variable names, route paths (`/api/v1/auth`), and symbol names.
    - Dense embeddings capture conceptual and architectural relationships.
  - **Reciprocal Rank Fusion Formula**:
    $$RRF\_Score(d) = \sum_{m \in M} \frac{1}{k + r_m(d)}$$
    where $k=60$ (smoothing constant), $M$ is the set of rankers (Dense, Sparse), and $r_m(d)$ is the rank of chunk $d$ in system $m$.
  - **Interview Talking Point**: *"Reciprocal Rank Fusion doesn't require normalizing incompatible similarity score distributions (e.g., unbounded BM25 scores vs cosine similarity [-1, 1]); it relies purely on ordinal ranking, making it robust and resilient to score skew."*

---

### ADR 004: In-Memory / Persistent Vector Store Architecture
- **Status**: Accepted
- **Decision**: Build a high-performance **Embedded Vector Store** using NumPy matrix vectorization with JSON/SQLite persistence.
- **Alternatives Considered**:
  1. *External Cloud Vector DBs (Pinecone, Qdrant Cloud)*: Introduces network latency, API costs, account signups, and breaks offline/local developer workflows.
  2. *ChromaDB*: Excellent, but frequently suffers from SQLite version mismatch issues and native C++ build tool dependencies (`onnxruntime`, `hnswlib`) on Windows machines.
- **Rationale**:
  - **Zero-Dependency Portability**: Can run on any developer machine (Windows, Mac, Linux) with pure Python and NumPy.
  - **Performance**: For repositories with 5,000–50,000 code chunks, NumPy vectorized cosine similarity:
    $$\text{similarity}(u, v) = \frac{u \cdot v}{\|u\|_2 \cdot \|v\|_2}$$
    computes in under 5 milliseconds in-memory.
  - **Persistence**: Index data and metadata are saved to disk (`storage/index/`) for instant reloading across server restarts without re-embedding.

---

### ADR 005: Multi-Provider LLM & Embedding Layer with Deterministic Fallback
- **Status**: Accepted
- **Decision**: Provide an extensible provider interface supporting **Google Gemini API**, **OpenAI API**, and an intelligent **Offline Demonstration Mode**.
- **Alternatives Considered**:
  1. *Hardcoding one vendor (e.g. OpenAI only)*: Locks the user into paid subscriptions and breaks if API keys are missing or rate-limited.
  2. *Local LLMs only (e.g. Ollama with Llama-3)*: Requires 8GB–16GB VRAM / GPU, which many interviewers and beginner laptops do not possess.
- **Rationale**:
  - **Plug-and-Play**: Users can input their Gemini or OpenAI key in the UI settings or `.env` file.
  - **Reliable Interview Demos**: If an API key expires, fails, or network drops during a live interview presentation, the **Fallback Engine** leverages local BM25 + syntax analysis to generate accurate, grounded code explanations without crashing.

---

### ADR 006: Grounded Citations & Anti-Hallucination Guardrails
- **Status**: Accepted
- **Decision**: Enforce strict system prompt contracts requiring the LLM to format answers with explicit, verified file citations and code blocks, combined with an answer verification layer.
- **Prompt Guardrail Contract**:
  1. Must only answer using the provided code snippets in the `<context>` block.
  2. If the answer is not present in the ingested codebase, explicitly state: *"I could not find references to this functionality in the ingested codebase."*
  3. Every technical assertion must be followed by `[filename:start_line-end_line]`.
- **Rationale**:
  - In software engineering, a wrong answer (pointing to a non-existent auth file) is far more dangerous than "not found". Strict grounding ensures high developer trust.

---

### ADR 007: Frontend User Interface Architecture
- **Status**: Accepted
- **Decision**: Clean, modern single-page dashboard built with modern Semantic HTML5, Vanilla CSS (glassmorphism, CSS variables, dark theme), and modern ES6 JavaScript.
- **Alternatives Considered**:
  1. *Heavy Next.js / React full-stack app*: Requires managing two build servers, `npm run build`, CORS issues, and node processes.
  2. *Basic Streamlit UI*: Easy to write, but creates a non-standard UI with sluggish full-page reruns, poor code citation navigation, and limited styling flexibility.
- **Rationale**:
  - Served directly from FastAPI static files or via Vite.
  - Fast, zero-lag rendering.
  - Features a split-pane layout: **Repository Ingestion & File Tree** on the left, **Interactive Chat & Citations** in the center, and a **Live Code Previewer with Line Highlighting** on the right!
