# Codebase RAG & AI Developer Assistant — Master Interview Cheat Sheet

> **For Beginners**: If you don't have extensive backend or frontend experience, this guide breaks down every single concept into simple terms, gives you the exact mental models, and provides word-for-word answers for software engineering interviews!

---

## 1. Core Mental Models: The 5 Foundations

### 1.1 What is RAG (Retrieval-Augmented Generation)?
- **Analogy**: Imagine taking an open-book exam.
  - Without RAG, an LLM only answers from its memory (what it was trained on months ago). It doesn't know your company's private GitHub repo.
  - With RAG, the LLM first flips open your code repository (Retrieval), grabs the 3 to 5 most relevant functions (Augmentation), places them in front of itself, and writes the answer based on that exact code (Generation).
- **Why RAG instead of Fine-Tuning?**
  - Fine-tuning an LLM on your codebase is expensive, slow, and goes stale the moment someone pushes a new commit.
  - RAG takes seconds to re-index, supports private access controls, and always cites the exact source files and line numbers.

### 1.2 What is an Embedding?
- An embedding is a list of floating-point numbers (a high-dimensional vector, e.g., 768 or 1536 dimensions) that represents the **semantic meaning** of a piece of text or code.
- If two code snippets do similar things (e.g. `def verify_password(hash, pwd)` and `function authenticateUser(p, h)`), their vectors will point in almost the same direction in vector space, even if they use completely different variable names!

### 1.3 What is Cosine Similarity?
- It measures the cosine of the angle between two vectors:
  $$\cos(\theta) = \frac{\mathbf{A} \cdot \mathbf{B}}{\|\mathbf{A}\| \|\mathbf{B}\|}$$
- If $\cos(\theta) = 1.0$, the vectors point in the identical direction (identical meaning).
- If $\cos(\theta) = 0$, they are orthogonal (unrelated).

### 1.4 What is BM25?
- BM25 (Best Matching 25) is an advanced TF-IDF keyword search algorithm.
- It calculates how important a query term is in a document based on:
  1. **Term Frequency (TF)**: How often the word appears in the chunk (with diminishing returns so spamming a word doesn't break search).
  2. **Inverse Document Frequency (IDF)**: Rare words (like `handle_stripe_webhook`) get massive weight, while common words (like `function` or `return`) get low weight.
- **Why we need both BM25 and Embeddings (Hybrid Search)**:
  - Embeddings are great at intent ("Where are users authenticated?").
  - BM25 is great at exact keywords ("Where is `DB_PORT_5432`?").
  - We combine them using **Reciprocal Rank Fusion (RRF)**.

### 1.5 What is Reciprocal Rank Fusion (RRF)?
- When combining two search systems, BM25 returns unbounded positive scores (e.g. 14.8), while Cosine Similarity returns scores between 0 and 1. You cannot easily add them together!
- Instead of adding scores, RRF ranks items by their positions:
  $$Score(d) = \frac{1}{60 + \text{Rank}_{dense}(d)} + \frac{1}{60 + \text{Rank}_{sparse}(d)}$$
- If a chunk ranks #1 in BM25 and #2 in Dense search, it gets a massive combined boost.

---

## 2. The Complete End-to-End Workflow

When an interviewer asks: *"Walk me through what happens from the moment a user submits a GitHub URL to when they get an answer,"* you say:

```
[GitHub Repo URL] 
        ↓ 
1. Git Clone (shallow clone --depth 1)
        ↓
2. File Filtering (ignore .git, node_modules, binaries, lockfiles)
        ↓
3. Language Detection & Syntax-Aware Chunking (extract functions/classes with line numbers)
        ↓
4. Indexing:
    ├── Vector Embeddings (stored in NumPy matrix)
    └── BM25 Tokenizer (inverted index for keyword lookup)
        ↓
[User asks: "How does the database connection work?"]
        ↓
5. Hybrid Retrieval:
    ├── Dense Cosine Similarity (top-k semantic chunks)
    └── BM25 Keyword Search (top-k identifier chunks)
        ↓
6. Reciprocal Rank Fusion (RRF merges and re-ranks top chunks)
        ↓
7. Prompt Construction (system guardrails + context snippets with file:line tags)
        ↓
8. LLM Generation (Gemini / OpenAI produces explanation + precise citations)
        ↓
9. UI Interactive Rendering (Markdown answer + click-to-highlight code viewer)
```

---

## 3. Top 15 Interview Questions & Battle-Tested Answers

### Q1: Why did you build this project?
> **Answer**: *"I wanted to solve a real developer pain point: onboarding to large, unfamiliar codebases is slow and intimidating. While standard RAG works well on text documents, applying it to source code requires solving unique engineering challenges—like syntax-aware chunking, exact symbol retrieval, and precise line-level attribution. I built this full-stack assistant to demonstrate how to engineer robust retrieval, avoid hallucinations, and build a production-grade developer workflow."*

### Q2: Why is Codebase RAG fundamentally different from Document RAG?
> **Answer**: *"In document RAG, sentences and paragraphs have fuzzy boundaries. If you chunk a book every 500 characters, you still capture the narrative. In code RAG, blind character chunking cuts functions in half, separates a database query from its error handler, or detaches a method from its class imports. Furthermore, code queries often search for exact variable or function identifiers, which semantic vector embeddings struggle with. Code RAG therefore requires syntax-aware chunking and hybrid retrieval."*

### Q3: How does your code chunker work?
> **Answer**: *"Our parser detects the file extension and scans the AST / structural boundaries of the language (like Python `def`/`class` indentations, or JavaScript curly-brace blocks). Each chunk captures a complete cohesive logical unit (a function, class, or module header) along with critical metadata: file path, start line, end line, scope type, and imports. We also enforce min-max token thresholds so tiny 1-line functions are grouped while massive 1000-line files are subdivided at logical block boundaries."*

### Q4: Why did you choose FastAPI over Flask or Django?
> **Answer**: *"FastAPI is built natively on ASGI (Asynchronous Server Gateway Interface) using `async/await`, which is ideal for I/O-bound operations like cloning repositories, making remote embedding API calls, and streaming LLM tokens. It also uses Pydantic for automated request validation and serializes data schemas, while generating interactive OpenAPI documentation at `/docs` out of the box."*

### Q5: Why did you implement Hybrid Search instead of only Vector Search?
> **Answer**: *"Dense embeddings map text to conceptual space. If a user asks 'Where are user credentials validated?', embeddings excel because they understand that 'credentials validated' means 'login and password check'. But if an engineer queries 'where is `AUTH_JWT_EXPIRY_SECONDS` defined?', embedding models often fail because specific alphanumeric variable names have no conceptual embedding. BM25 catches the exact variable token instantly. Combining both via Reciprocal Rank Fusion gives 95%+ retrieval precision."*

### Q6: What is Reciprocal Rank Fusion (RRF) and why not simple weighted score addition?
> **Answer**: *"BM25 produces unbounded TF-IDF scores (e.g. 15.2 or 3.4 depending on document length and term rarity), whereas Cosine Similarity produces normalized values between -1 and 1. Normalizing BM25 dynamically across varying query lengths is unstable. RRF solves this by ignoring raw score values and working solely with ordinal ranks. The formula $1 / (k + rank)$ guarantees consistent, scale-invariant fusion."*

### Q7: How do you prevent the LLM from hallucinating files that do not exist?
> **Answer**: *"We apply three layers of defense:
> 1. **Prompt Guardrail**: The system prompt strictly limits the LLM's knowledge to the supplied `<context>` block and forbids assuming any file paths not explicitly given.
> 2. **Explicit Fallback Directive**: If the retrieved snippets do not contain the answer, the model is instructed to output 'Information not found in ingested files' rather than guessing.
> 3. **Post-Retrieval Verification**: Our citations include exact file paths and line ranges that our backend verifies against the actual ingested file tree before returning to the frontend."*

### Q8: What vector store did you use and why?
> **Answer**: *"I designed an embedded in-memory vector index backed by NumPy vectorization and disk persistence. For repositories under 100,000 chunks, in-memory cosine matrix multiplication takes less than 5 milliseconds, avoiding the operational overhead, network latency, and C++ dependency compilation errors of external vector databases. For enterprise repositories with millions of chunks, this interface can swap to Qdrant or Milvus via dependency injection."*

### Q9: How does the system handle large repositories?
> **Answer**: *"Three key strategies:
> 1. **Strict Ignore Filters**: We skip `.git`, `node_modules`, `venv`, binary assets, compiled files, and lockfiles (which make up 80% of repository bulk).
> 2. **Batch Embedding**: Embeddings are computed in concurrent batches rather than one-by-one to respect API rate limits and minimize network round trips.
> 3. **Shallow Clone**: We run `git clone --depth 1` to clone only the latest commit without downloading the entire git commit history."*

### Q10: How would you scale this system to production with millions of users?
> **Answer**: *"In a production architecture:
> 1. **Decouple Ingestion**: Move repo cloning and chunking to background workers using Celery or AWS SQS + Redis queues.
> 2. **Distributed Vector DB**: Migrate the in-memory index to a distributed cluster like Qdrant or Pinecone with namespace isolation per repository.
> 3. **Caching**: Use Redis to cache embeddings for identical code chunks across commits (content hashing via SHA-256).
> 4. **Webhooks**: Connect GitHub webhooks to trigger incremental delta updates (only re-chunking files changed in a push) rather than re-indexing from scratch."*

### Q11: What happens if an API key is missing or expires during an interview demo?
> **Answer**: *"I built an intelligent Offline Fallback Mode. If no Gemini or OpenAI key is present, the system uses BM25 keyword matching and an internal code heuristic engine to retrieve relevant files and explain their structure accurately without crashing or requiring paid API credentials."*

### Q12: How do you manage LLM context window limits?
> **Answer**: *"We rank chunks using RRF and select the top $k$ chunks (typically 5 to 8). We calculate the total token budget (e.g. 6,000 tokens) using a token counter. If the top chunks exceed the budget, we truncate the lowest-ranking chunks to guarantee the prompt stays comfortably within the model's context window."*

### Q13: What security considerations exist when developers input GitHub URLs?
> **Answer**: *"1. **Command Injection**: Never pass URLs directly into shell execution strings. We use sanitized argument lists in `subprocess.run` or GitPython.
> 2. **Path Traversal**: Validate and sanitize all file paths to prevent directory traversal attacks (e.g. `../../etc/passwd`).
> 3. **Resource Exhaustion (Zip Bombs)**: Limit maximum repository size (e.g., max 100MB) and max file count during cloning/extraction."*

### Q14: How does the frontend interact with the backend?
> **Answer**: *"The frontend is a reactive single-page interface that communicates via RESTful JSON endpoints (`/api/ingest`, `/api/query`, `/api/files`, `/api/file-content`). When an answer returns with citations, clicking a citation instantly fetches and renders the target file in the built-in syntax-highlighted code viewer, scrolling directly to the referenced line numbers."*

### Q15: What would be your next feature to build?
> **Answer**: *"Multi-hop graph retrieval: indexing not just individual code chunks, but building a Call Graph of imports and function callers using tree-sitter or LSP (Language Server Protocol). That way, when asking 'What calls this API route?', the RAG system traverses the call hierarchy directly."*
