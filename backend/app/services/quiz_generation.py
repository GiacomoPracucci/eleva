"""Service responsible for orchestrating AI-powered quiz generation."""

from __future__ import annotations

import json
import logging
import textwrap
from typing import Optional

from pydantic import ValidationError

from app.core.config import settings
from app.models.document import Document, ProcessingStatus
from app.schemas.quiz import QuizResponse
from app.services.api_providers.exceptions import APIError, RateLimitError
from app.services.api_providers.openai_client import OpenAIClient, GPTModel


logger = logging.getLogger(__name__)


class QuizGenerationError(Exception):
    """Raised when the quiz generation pipeline fails."""


class QuizGenerationService:
    """High-level orchestrator for AI-generated quizzes."""

    DEFAULT_MODEL = GPTModel.GPT_4O_MINI.value

    def __init__(
        self,
        client: Optional[OpenAIClient] = None,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_input_characters: Optional[int] = None,
    ) -> None:
        """Instantiate the service.

        Args:
            client: Optional pre-configured OpenAI client instance.
            model: Override for the completion model to use.
            temperature: Temperature setting for the LLM request.
            max_input_characters: Hard cap on the characters sent to the LLM.
        """

        self._client = client or OpenAIClient(api_key=settings.OPENAI_API_KEY)
        self._model = model or settings.QUIZ_GENERATION_MODEL or self.DEFAULT_MODEL
        self._temperature = temperature if temperature is not None else settings.QUIZ_GENERATION_TEMPERATURE
        self._max_input_characters = max_input_characters or settings.QUIZ_MAX_INPUT_CHARACTERS

    async def generate_quiz(
        self,
        *,
        document: Document,
        question_count: int,
    ) -> QuizResponse:
        """Generate a quiz from a document using an LLM."""

        if document.processing_status != ProcessingStatus.COMPLETED:
            raise QuizGenerationError("Document must be fully processed before generating quizzes.")

        combined_text = self._combine_document_text(document)
        if not combined_text:
            raise QuizGenerationError("Document does not contain any extracted text to generate a quiz from.")

        prompt = self._build_prompt(
            document=document,
            question_count=question_count,
            content=combined_text,
        )

        logger.info(
            "Requesting quiz generation for document %s with %s questions", document.id, question_count
        )

        try:
            completion = await self._client.get_completion(
                model=self._model,
                prompt=prompt,
                system_message=self._system_message(),
                temperature=self._temperature,
            )
        except (APIError, RateLimitError) as exc:
            logger.error("Quiz generation API error for document %s: %s", document.id, exc)
            raise QuizGenerationError("Failed to communicate with the quiz generation service.") from exc

        try:
            payload = json.loads(completion.content)
        except json.JSONDecodeError as exc:
            logger.error("Quiz generation returned invalid JSON for document %s: %s", document.id, exc)
            raise QuizGenerationError("Received an invalid response from the AI provider.") from exc

        try:
            quiz = QuizResponse.model_validate(payload)
        except ValidationError as exc:
            logger.error("Quiz response validation failed for document %s: %s", document.id, exc)
            raise QuizGenerationError("Quiz response did not match the expected schema.") from exc

        return quiz

    async def aclose(self) -> None:
        """Release any underlying client resources."""

        await self._client.close()

    def _combine_document_text(self, document: Document) -> str:
        """Concatenate chunk text with a soft character limit."""

        if not document.chunks:
            return ""

        combined = []
        total_chars = 0
        for chunk in document.chunks:
            chunk_text = chunk.chunk_text or ""
            if not chunk_text:
                continue

            if total_chars + len(chunk_text) > self._max_input_characters:
                remaining = self._max_input_characters - total_chars
                if remaining <= 0:
                    break
                combined.append(chunk_text[:remaining])
                total_chars += remaining
                break

            combined.append(chunk_text)
            total_chars += len(chunk_text)

        return "\n\n".join(combined)

    def _build_prompt(self, *, document: Document, question_count: int, content: str) -> str:
        """Craft the user prompt for the LLM request."""

        metadata_section = self._document_metadata_section(document)
        return textwrap.dedent(
            f"""
            Create a multiple-choice quiz in JSON format.
            - Use the document content provided below as the sole knowledge source.
            - Produce exactly {question_count} questions unless the content cannot support that many.
            - Each question must contain four answer options labelled with short IDs.
            - Ensure the JSON strictly follows the provided schema keys and casing.
            - Avoid including explanatory text; only return the JSON payload.

            {metadata_section}

            Document content:
            {content}
            """
        ).strip()

    def _document_metadata_section(self, document: Document) -> str:
        """Generate a human-readable metadata summary for the prompt."""

        details = [f"Document title: {document.filename}", f"Subject ID: {document.subject_id}"]
        if document.metadata_:
            summary_pairs = [
                f"{key.replace('_', ' ').title()}: {value}"
                for key, value in document.metadata_.items()
                if isinstance(value, (str, int, float))
            ]
            if summary_pairs:
                details.append("Additional context: " + "; ".join(summary_pairs))

        details.append(
                """JSON schema:
        {
        "quizTitle": string,
        "questions": [
            {
            "questionId": string,
            "questionText": string,
            "options": [
                {
                "optionId": string,
                "optionText": string
                } x4
            ],
            "correctOptionId": string
            } xN
        ]
        }"""
            )

        return "\n".join(details)

    def _system_message(self) -> str:
        """System prompt to keep responses deterministic and structured."""

        return (
            "You are an educational content generator that produces high quality "
            "multiple-choice quizzes. Always respond with valid JSON only."
        )