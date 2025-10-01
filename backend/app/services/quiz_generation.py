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
                response_format={"type": "json_object"},
            )
        except (APIError, RateLimitError) as exc:
            logger.error("Quiz generation API error for document %s: %s", document.id, exc)
            raise QuizGenerationError("Failed to communicate with the quiz generation service.") from exc

        raw_content = (completion.content or "").strip()
        if not raw_content:
            logger.error("Quiz generation returned empty content for document %s", document.id)
            raise QuizGenerationError("Received an empty response from the AI provider.")

        try:
            payload = json.loads(self._strip_markdown_fence(raw_content))
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
            You must generate a multiple-choice quiz and return it as valid JSON.
            Follow these directives precisely:
            1. Use ONLY the document content provided below as your knowledge source.
            2. Create up to {question_count} questions. If the material cannot support the full amount, return as many high-quality questions as possible (never exceed the requested total).
            3. Each question must have exactly four answer options with option IDs "A", "B", "C", and "D".
            4. `correctOptionId` must match one of the option IDs for that question.
            5. `questionId` values must be unique and follow the pattern "q1", "q2", ... in sequence.
            6. Do not include explanations, commentary, or markdown fencing—return only the JSON object described below.

            {self._json_contract()}

            {metadata_section}

            Document content:
            {content}
            """
        ).strip()

    def _json_contract(self) -> str:
        """Describe the JSON schema to keep the model focused."""

        return textwrap.dedent(
            """
            Required JSON structure:
            {
              "quizTitle": "non-empty string",
              "questions": [
                {
                  "questionId": "q1",
                  "questionText": "question prompt",
                  "options": [
                    {"optionId": "A", "optionText": "answer choice"},
                    {"optionId": "B", "optionText": "answer choice"},
                    {"optionId": "C", "optionText": "answer choice"},
                    {"optionId": "D", "optionText": "answer choice"}
                  ],
                  "correctOptionId": "A"
                }
              ]
            }
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

        return "\n".join(details)

    @staticmethod
    def _strip_markdown_fence(raw: str) -> str:
        """Remove optional markdown fences from LLM output."""

        trimmed = raw.strip()
        if not trimmed.startswith("```"):
            return trimmed

        lines = trimmed.splitlines()
        # Drop the opening fence (possibly with a language hint)
        lines = lines[1:]

        # Drop a closing fence if present
        while lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]

        return "\n".join(lines).strip()

    def _system_message(self) -> str:
        """System prompt to keep responses deterministic and structured."""

        return (
            "You are an educational content generator that produces high quality "
            "multiple-choice quizzes. Always respond with valid JSON only."
        )
