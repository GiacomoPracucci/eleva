"""Quiz-related API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user, get_db
from app.crud.document import document_crud
from app.models.user import User as UserModel
from app.schemas.quiz import QuestionExplanationRequest, QuestionExplanationResponse
from app.services.quiz_explanation import QuizExplanationService, QuizExplanationError


router = APIRouter()


@router.post("/questions/explain-error", response_model=QuestionExplanationResponse)
async def explain_quiz_question_error(
    request: QuestionExplanationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user),
) -> QuestionExplanationResponse:
    """Return an AI-generated explanation for an incorrectly answered question."""

    document = await document_crud.get(db, document_id=request.document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if not (document.owner_id == current_user.id or current_user.is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to request an explanation for this document",
        )

    service = QuizExplanationService()
    try:
        explanation = await service.explain_answer(
            request,
            document=document,
            db=db,
        )
    except QuizExplanationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    finally:
        await service.aclose()

    return QuestionExplanationResponse(explanation=explanation)
