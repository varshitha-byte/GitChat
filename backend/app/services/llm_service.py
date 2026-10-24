import time
from typing import Tuple, Optional
import google.generativeai as genai
import openai
from ..config import settings
from ..models.schemas import QueryResponse, Citation

SYSTEM_PROMPT = """You are an expert AI Developer Assistant and Principal Software Engineer analyzing a codebase.
Your goal is to answer the developer's question accurately, with clear technical explanations grounded strictly in the provided code snippets.

CRITICAL INSTRUCTIONS:
1. Grounding: Answer ONLY based on the code provided in the <code_context> block. Do NOT invent functions, variables, or files that are not shown.
2. Citations: Every technical statement, function mention, or architectural explanation MUST cite the exact file path and lines using this format: `[filepath:start_line-end_line]`.
3. Code Snippets: Include relevant short code snippets in your answer to illustrate your explanation.
4. Completeness: Explain *how* the code works, not just *where* it is (e.g. explain the flow of data, error handling, and parameters).
5. Fallback: If the answer cannot be determined from the provided context, state clearly: "I could not find references to this functionality in the retrieved codebase files."
"""

class LLMService:
    @classmethod
    def answer_query(
        cls,
        query: str,
        context: str,
        citations: list[Citation],
        provider: str = "gemini",
        api_key: Optional[str] = None
    ) -> Tuple[str, str, str]:
        """
        Generates an answer using the requested LLM provider or the offline heuristic engine.
        Returns: (answer_markdown, confidence_level, provider_used)
        """
        key = api_key or settings.gemini_api_key or settings.openai_api_key
        user_prompt = f"""<code_context>
{context}
</code_context>

Developer Question: {query}

Provide a comprehensive, senior-engineer level explanation with exact file and line number citations."""

        # 1. Google Gemini Provider
        if provider == "gemini" and key:
            try:
                genai.configure(api_key=key)
                model = genai.GenerativeModel(
                    model_name="gemini-1.5-flash",
                    system_instruction=SYSTEM_PROMPT
                )
                response = model.generate_content(user_prompt)
                if response.text:
                    return response.text, "High (Grounded in Code)", "gemini-1.5-flash"
            except Exception as e:
                print(f"[LLM Warning] Gemini call failed ({e}), attempting fallback.")

        # 2. OpenAI Provider
        elif provider == "openai" and key:
            try:
                client = openai.OpenAI(api_key=key)
                completion = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.2
                )
                answer = completion.choices[0].message.content or ""
                return answer, "High (Grounded in Code)", "gpt-4o-mini"
            except Exception as e:
                print(f"[LLM Warning] OpenAI call failed ({e}), attempting fallback.")

        # 3. Intelligent Offline Heuristic Generator (Zero-Key Demo Mode)
        return cls._generate_offline_answer(query, citations)

    @classmethod
    def _generate_offline_answer(cls, query: str, citations: list[Citation]) -> Tuple[str, str, str]:
        """
        Deterministic, offline answer engine that synthesizes retrieved citations.
        Guarantees that interviewers and evaluators can test the RAG flow without an external API key.
        """
        if not citations:
            answer = (
                "### No Direct Matches Found\n\n"
                "The codebase search did not find matching code snippets for your query. "
                "Try searching for specific terms like `auth`, `router`, `model`, `database`, or class names."
            )
            return answer, "Low", "offline-heuristic-engine"

        files_list = sorted(list(set(c.file_path for c in citations)))
        top_citation = citations[0]

        answer_lines = [
            f"### Analysis for Query: *\"{query}\"*\n",
            f"Based on hybrid retrieval analysis of the codebase, this functionality is primarily located in **`{top_citation.file_path}`**.\n",
            "#### Key Code Locations & Attribution:",
        ]

        for idx, cit in enumerate(citations[:4], 1):
            scope_desc = f" ({cit.scope_name})" if cit.scope_name else ""
            answer_lines.append(
                f"- **Reference {idx}**: [`{cit.file_path}:{cit.start_line}-{cit.end_line}`](file:///{cit.file_path}#L{cit.start_line}-L{cit.end_line}){scope_desc}\n"
                f"  ``` {cit.language or 'text'}\n"
                f"  {cit.snippet.strip()}\n"
                f"  ```"
            )

        answer_lines.append("\n#### Architectural Summary:")
        answer_lines.append(
            f"The implementation spans {len(files_list)} file(s): " +
            ", ".join([f"`{f}`" for f in files_list]) + ".\n"
            "The components define core routes, data handlers, and domain logic corresponding to your search terms. "
            "Click any citation in the sidebar or above to inspect the full file and line ranges in the code viewer."
        )

        return "\n".join(answer_lines), "Medium (Synthesized Offline)", "offline-heuristic-engine"
