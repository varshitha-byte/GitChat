# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Software engineers, engineering leads, tech leads, and systems architects exploring, refactoring, or onboarding into complex codebases.

## Product Purpose

CodeRAG Assistant provides an interactive, syntax-aware codebase question-answering workbench. It ingests local repositories or GitHub URLs, parses them into semantic code chunks, indexes them with hybrid retrieval (BM25 lexical + dense semantic embeddings), and generates grounded architectural answers accompanied by interactive source-code citations with line-range inspection.

## Positioning

Unlike generic chatbot interfaces that lose source file context or hallucinate function references, CodeRAG operates as a synchronized developer workbench: queries link directly to an active file tree and code inspector with highlightable line spans, providing provable ground truth.

## Operating Context

Developer workbench used on widescreen desktop monitors and laptops during coding sessions, PR reviews, system architecture audits, and codebase exploration. The UI must afford high information density, rapid scanability, instant code citation navigation, and seamless copy-paste workflows.

## Capabilities and Constraints

- **Ingestion**: Clone GitHub repositories or upload `.zip` archives of codebases.
- **Syntax Chunking**: AST-aware chunking for Python, JavaScript, TypeScript, Go, Java, and Markdown.
- **Hybrid Search**: Combines BM25 token matching with semantic vector search.
- **Interactive Code Inspector**: Clickable citations jump directly to the target file and highlight exact line ranges.
- **Telemetry & Stats**: File counts, chunk metrics, and primary language distribution breakdown.
- **LLM Agnostic**: Configurable for Gemini, OpenAI, or an offline heuristic engine for zero-key demonstrations.

## Brand Commitments

- Name: CodeRAG Assistant
- Identity: Precision developer workbench, inspired by modern high-performance engineering tools (Linear, JetBrains Fleet, Raycast, GitHub Code Search).
- Aesthetic: Technical restraint, dark obsidian & slate canvas, amber/gold precision accents, crisp typography, zero superficial fluff.

## Product Principles

1. **Grounded Over Generative**: Every claim made by the assistant must tie to a verifiable file and line span.
2. **Dense & Scannable**: Information layout must prioritize engineer productivity, low visual noise, and immediate readability.
3. **Tactile Precision**: Interactive elements (chips, code citations, file items) must provide crisp visual feedback without sluggish animations or decorative halos.
4. **Honest States**: Ingestion progress, retrieval latency, and model source telemetry are exposed clearly without vague spinners.

## Accessibility & Inclusion

Full keyboard navigation, WCAG AA contrast compliance (minimum 4.5:1 for body and placeholders, 3:1 for large elements), clear `:focus-visible` outlines, and screen-reader accessible form labels.
