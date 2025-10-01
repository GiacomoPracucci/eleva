"""
Pydantic schemas for AI-generated quizzes.

These schemas define the contract for quiz generation requests and
responses. They intentionally mirror the JSON structure returned by the
LLM so that the frontend can render quizzes without any additional
transformation. The models are future-proofed to support upcoming
features like AI-generated explanations for incorrect answers.
"""

from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from app.core.config import settings


class QuizOption(BaseModel):
    """Represents a single answer option for a quiz question."""

    option_id: str = Field(..., alias="optionId", min_length=1)
    option_text: str = Field(..., alias="optionText", min_length=1)

    model_config = ConfigDict(populate_by_name=True)


class QuizQuestion(BaseModel):
    """Model describing a multiple-choice question."""

    question_id: str = Field(..., alias="questionId", min_length=1)
    question_text: str = Field(..., alias="questionText", min_length=1)
    options: List[QuizOption]
    correct_option_id: str = Field(..., alias="correctOptionId", min_length=1)

    model_config = ConfigDict(populate_by_name=True)

    def get_option(self, option_id: str) -> Optional[QuizOption]:
        """Retrieve an option by its identifier if it exists."""

        return next((option for option in self.options if option.option_id == option_id), None)


class QuizResponse(BaseModel):
    """Complete payload returned after quiz generation."""

    quiz_title: str = Field(..., alias="quizTitle", min_length=1)
    questions: List[QuizQuestion]

    model_config = ConfigDict(populate_by_name=True)


class QuizGenerationRequest(BaseModel):
    """Request payload for quiz generation."""

    question_count: int = Field(
        default=5,
        ge=1,
        le=settings.QUIZ_MAX_QUESTIONS,
        description="Number of questions the quiz should contain."
    )


class QuestionExplanationRequest(BaseModel):
    """Request payload for explaining an incorrect quiz answer."""

    document_id: UUID = Field(..., alias="documentId")
    question_text: str = Field(..., alias="questionText", min_length=1)
    user_selected_answer: str = Field(..., alias="userSelectedAnswer", min_length=1)
    correct_answer: str = Field(..., alias="correctAnswer", min_length=1)
    max_chunks: Optional[int] = Field(
        default=None,
        alias="maxChunks",
        ge=1,
        le=settings.QUIZ_EXPLANATION_MAX_CONTEXT_CHUNKS,
        description="Optional override for the number of context chunks to retrieve."
    )

    model_config = ConfigDict(populate_by_name=True)


class QuestionExplanationResponse(BaseModel):
    """Response payload containing the AI-generated explanation."""

    explanation: str = Field(..., min_length=1)
