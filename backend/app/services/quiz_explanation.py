"""Service responsible for generating explanations for incorrect quiz answers."""

from __future__ import annotations

import logging
import textwrap
from typing import Optional

from app.core.config import settings
from app.schemas.quiz import QuestionExplanationRequest
from app.services.api_providers.exceptions import APIError, RateLimitError
from app.services.api_providers.openai_client import OpenAIClient, GPTModel


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
    ) -> None:
        """Instantiate the service with configurable provider options."""

        self._client = client or OpenAIClient(api_key=settings.OPENAI_API_KEY)
        self._model = model or settings.QUIZ_EXPLANATION_MODEL or self.DEFAULT_MODEL
        self._temperature = (
            temperature if temperature is not None else settings.QUIZ_EXPLANATION_TEMPERATURE
        )
        self._max_tokens = max_tokens if max_tokens is not None else settings.QUIZ_EXPLANATION_MAX_TOKENS

    async def explain_answer(self, request: QuestionExplanationRequest) -> str:
        """Generate an explanation for an incorrect quiz answer."""

        if not request.document_context or not request.document_context.strip():
            raise QuizExplanationError("Document context is required to generate an explanation.")

        prompt = self._build_prompt(request)

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

    def _build_prompt(self, request: QuestionExplanationRequest) -> str:
        """Craft the user prompt sent to the LLM."""

        context = request.document_context.strip()
        return textwrap.dedent(
            f"""
            Role: You are a helpful and encouraging tutor. Your goal is to help a student understand their mistake without making them feel discouraged.

            Context:
            Here is an excerpt from a document the student is studying:
            {context}

            Task:
            Based on the text above, the student answered a quiz question incorrectly. Your task is to provide a clear and concise explanation.

            Quiz Question: {request.question_text.strip()}
            The Student's (Incorrect) Answer: {request.user_selected_answer.strip()}
            The Correct Answer: {request.correct_answer.strip()}

            Instructions for your response:
            - Begin by briefly explaining why the student's answer is incorrect, directly referencing the provided text if possible.
            - Next, explain why the correct answer is the right choice, again using evidence from the text.
            - Maintain a positive and supportive tone.
            - Keep the entire explanation concise (2-4 sentences is ideal).
            - Important: Respond ONLY with the text of the explanation itself. Do not add any conversational filler like "Of course, here is the explanation:" or "I can help with that!".
            """
        ).strip()

    def _system_message(self) -> str:
        """System instruction to reinforce response constraints."""

        return (
            "You are a supportive teaching assistant. Explain the student's mistake using only the provided document "
            "excerpt. Respond with a concise explanation without additional preamble."
        )
