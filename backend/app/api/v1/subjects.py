from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.dependencies import get_db, get_current_active_user
from app.crud.subject import subject_crud
from app.schemas.subject import Subject, SubjectCreate, SubjectUpdate
from app.models.user import User as UserModel


router = APIRouter()


@router.get("/", response_model=List[Subject])
async def read_subjects(
    skip: int = 0,
    limit: int = 100,
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Get all subjects for current user"""
    subjects = await subject_crud.get_by_owner(
        db, owner_id=current_user.id, skip=skip, limit=limit,
        include_archived=include_archived
    )
    return subjects


@router.post("/", response_model=Subject)
async def create_subject(
    subject_in: SubjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Create a new subject"""
    subject = await subject_crud.create(db, obj_in=subject_in, owner_id=current_user.id)
    return subject


@router.get("/{subject_id}", response_model=Subject)
async def read_subject(
    subject_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Get a specific subject"""
    subject = await subject_crud.get(db, subject_id=subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    if not subject_crud.is_owner(subject, current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return subject


@router.put("/{subject_id}", response_model=Subject)
async def update_subject(
    subject_id: int,
    subject_in: SubjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Update a subject"""
    subject = subject_crud.get(db, subject_id=subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    if not subject_crud.is_owner(subject, current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    subject = await subject_crud.update(db, db_obj=subject, obj_in=subject_in)
    return subject


@router.delete("/{subject_id}") 
async def delete_subject(
    subject_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Delete a subject"""
    subject = await subject_crud.get(db, subject_id=subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    if not subject_crud.is_owner(subject, current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    await subject_crud.delete(db, db_obj=subject)
    return {"msg": "Subject deleted successfully"}