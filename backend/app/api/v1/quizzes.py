"""Quiz-related API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_active_user
from app.models.user import User as UserModel
from app.schemas.quiz import QuestionExplanationRequest, QuestionExplanationResponse
from app.services.quiz_explanation import QuizExplanationService, QuizExplanationError


router = APIRouter()


@router.post("/questions/explain-error", response_model=QuestionExplanationResponse)
async def explain_quiz_question_error(
    request: QuestionExplanationRequest,
    current_user: UserModel = Depends(get_current_active_user),
) -> QuestionExplanationResponse:
    """Return an AI-generated explanation for an incorrectly answered question."""

    # The dependency ensures the requester is authenticated.
    _ = current_user

    service = QuizExplanationService()
    try:
        explanation = await service.explain_answer(request)
    except QuizExplanationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    finally:
        await service.aclose()

    return QuestionExplanationResponse(explanation=explanation)
