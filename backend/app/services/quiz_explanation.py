"""Service responsible for generating explanations for incorrect quiz answers."""

from __future__ import annotations

import logging
import textwrap
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.document import Document
from app.schemas.quiz import QuestionExplanationRequest
from app.services.api_providers.exceptions import APIError, RateLimitError
from app.services.api_providers.openai_client import OpenAIClient, GPTModel
from app.services.document_retrieval import (
    DocumentRetrievalError,
    DocumentRetrievalService,
    RetrievedChunk,
)


logger = logging.getLogger(__name__)


class QuizExplanationError(Exception):
    """Raised when the explanation pipeline cannot complete successfully."""


class QuizExplanationService:
    """High-level orchestrator for AI-generated quiz explanations."""

    DEFAULT_MODEL = GPTModel.GPT_4O_MINI.value

    def __init__(
        self,
        *,
        client: Optional[OpenAIClient] = None,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        retrieval_service: Optional[DocumentRetrievalService] = None,
        chunk_limit: Optional[int] = None,
    ) -> None:
        """Instantiate the service with configurable provider options."""

        self._client = client or OpenAIClient(api_key=settings.OPENAI_API_KEY)
        self._model = model or settings.QUIZ_EXPLANATION_MODEL or self.DEFAULT_MODEL
        self._temperature = (
            temperature if temperature is not None else settings.QUIZ_EXPLANATION_TEMPERATURE
        )
        self._max_tokens = max_tokens if max_tokens is not None else settings.QUIZ_EXPLANATION_MAX_TOKENS
        self._retrieval_service = retrieval_service or DocumentRetrievalService()
        self._chunk_limit = max(1, chunk_limit or settings.QUIZ_EXPLANATION_MAX_CONTEXT_CHUNKS)

    async def explain_answer(
        self,
        request: QuestionExplanationRequest,
        *,
        document: Document,
        db: AsyncSession,
    ) -> str:
        """Generate an explanation for an incorrect quiz answer."""

        chunk_limit = self._resolve_chunk_limit(request)
        search_query = self._build_search_query(request)

        try:
            retrieved_chunks = await self._retrieval_service.top_chunks(
                db=db,
                document=document,
                query=search_query,
                limit=chunk_limit,
            )
        except DocumentRetrievalError as exc:
            raise QuizExplanationError(str(exc)) from exc

        context = self._render_context(retrieved_chunks)
        if not context:
            raise QuizExplanationError("Unable to assemble document context for this explanation.")

        prompt = self._build_prompt(request, context)

        logger.info("Requesting quiz explanation for question '%s'", request.question_text)

        try:
            completion = await self._client.get_completion(
                model=self._model,
                prompt=prompt,
                system_message=self._system_message(),
                temperature=self._temperature,
                max_tokens=self._max_tokens,
            )
        except (APIError, RateLimitError) as exc:
            logger.error("Quiz explanation API error for question '%s': %s", request.question_text, exc)
            raise QuizExplanationError("Failed to communicate with the explanation service.") from exc

        explanation = (completion.content or "").strip()
        if not explanation:
            logger.error("Quiz explanation returned empty content for question '%s'", request.question_text)
            raise QuizExplanationError("Received an empty response from the AI provider.")

        return explanation

    async def aclose(self) -> None:
        """Release any underlying client resources."""

        await self._client.close()

    def _build_prompt(self, request: QuestionExplanationRequest, context: str) -> str:
        """Craft the user prompt sent to the LLM."""

        return textwrap.dedent(
            f"""
            Role: You are a patient and encouraging tutor helping a student learn from a multiple-choice mistake.

            Context Excerpts:
            {context}

            Task:
            The student answered the quiz question incorrectly. Using only the context above, craft an explanation that:
            1. Clarifies why the student's chosen answer is unsupported or contradicted by the text (cite the relevant chunk numbers in square brackets, e.g., [Chunk 3]).
            2. Demonstrates why the correct answer is right, grounding the reasoning in the provided excerpts and chunk references.
            3. Highlights the key concept or detail the student should remember next time.

            Quiz Question: {request.question_text.strip()}
            Student's Answer: {request.user_selected_answer.strip()}
            Correct Answer: {request.correct_answer.strip()}

            Response Guidelines:
            - Use 3-5 sentences and keep the tone supportive.
            - Refer explicitly to at least one chunk number when citing evidence.
            - Do not invent information that is not present in the context.
            - Respond ONLY with the explanation text; avoid any prefaces or follow-up questions.
            """
        ).strip()

    def _resolve_chunk_limit(self, request: QuestionExplanationRequest) -> int:
        """Determine how many chunks to retrieve for the explanation."""

        if request.max_chunks is None:
            return self._chunk_limit

        return max(1, min(request.max_chunks, self._chunk_limit))

    def _build_search_query(self, request: QuestionExplanationRequest) -> str:
        """Compose the retrieval query from the quiz signal."""

        return textwrap.dedent(
            f"""
            Question: {request.question_text.strip()}
            Correct answer: {request.correct_answer.strip()}
            """
        ).strip()

    def _render_context(self, chunks: List[RetrievedChunk]) -> str:
        """Format retrieved chunks for inclusion in the prompt."""

        formatted = []
        for chunk in chunks:
            formatted.append(f"[Chunk {chunk.chunk_index}] {chunk.text}")
        return "\n\n".join(formatted)

    def _system_message(self) -> str:
        """System instruction to reinforce response constraints."""

        return (
            "You are a supportive teaching assistant. Ground every claim in the provided chunked context and reference "
            "chunk numbers like [Chunk 2] when citing evidence. Respond concisely without any introductory phrases."
        )
