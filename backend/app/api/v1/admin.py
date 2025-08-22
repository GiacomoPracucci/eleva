from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, cast, Date
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from app.core.dependencies import get_db
from app.core.admin_dependencies import get_admin_user, get_super_admin_user
from app.models.user import User as UserModel, UserRole
from app.models.subject import Subject as SubjectModel
from app.schemas.admin import (
    AdminDashboard, 
    UserList, 
    UserAdmin, 
    UserRoleUpdate,
    UserStatusUpdate,
    DailyRegistration
)

router = APIRouter()

@router.get("/dashboard", response_model=AdminDashboard)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    admin_user: UserModel = Depends(get_admin_user)
):
    """Get admin dashboard statistics"""
    
    # Get total users count
    total_users_result = await db.execute(select(func.count(UserModel.id)))
    total_users = total_users_result.scalar() or 0
    
    # Get active users count
    active_users_result = await db.execute(
        select(func.count(UserModel.id)).where(UserModel.is_active == True)
    )
    active_users = active_users_result.scalar() or 0
    
    # Get total subjects count
    total_subjects_result = await db.execute(select(func.count(SubjectModel.id)))
    total_subjects = total_subjects_result.scalar() or 0
    
    # Get registrations today
    today = datetime.now(timezone.utc).date()
    today_registrations_result = await db.execute(
        select(func.count(UserModel.id)).where(
            cast(UserModel.created_at, Date) == today
        )
    )
    today_registrations = today_registrations_result.scalar() or 0
    
    # Get registrations this week
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    week_registrations_result = await db.execute(
        select(func.count(UserModel.id)).where(
            UserModel.created_at >= week_ago
        )
    )
    week_registrations = week_registrations_result.scalar() or 0
    
    # Get daily registrations for the last 30 days
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    daily_registrations_result = await db.execute(
        select(
            cast(UserModel.created_at, Date).label('date'),
            func.count(UserModel.id).label('count')
        )
        .where(UserModel.created_at >= thirty_days_ago)
        .group_by(cast(UserModel.created_at, Date))
        .order_by(cast(UserModel.created_at, Date))
    )
    
    daily_registrations = [
        DailyRegistration(date=row.date, count=row.count)
        for row in daily_registrations_result
    ]
    
    # Get role distribution
    role_distribution_result = await db.execute(
        select(
            UserModel.role,
            func.count(UserModel.id).label('count')
        )
        .group_by(UserModel.role)
    )
    
    role_distribution = {
        row.role.value: row.count for row in role_distribution_result
    }
    
    return AdminDashboard(
        total_users=total_users,
        active_users=active_users,
        total_subjects=total_subjects,
        today_registrations=today_registrations,
        week_registrations=week_registrations,
        daily_registrations=daily_registrations,
        role_distribution=role_distribution
    )

@router.get("/users", response_model=UserList)
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    admin_user: UserModel = Depends(get_admin_user)
):
    """Get paginated list of users with optional filters"""
    
    # Build query
    query = select(UserModel)
    
    # Apply filters
    filters = []
    if search:
        search_pattern = f"%{search}%"
        filters.append(
            UserModel.email.ilike(search_pattern) |
            UserModel.username.ilike(search_pattern) |
            UserModel.full_name.ilike(search_pattern)
        )
    
    if role:
        filters.append(UserModel.role == role)
    
    if is_active is not None:
        filters.append(UserModel.is_active == is_active)
    
    if filters:
        query = query.where(and_(*filters))
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Get paginated results
    query = query.offset(skip).limit(limit).order_by(UserModel.created_at.desc())
    result = await db.execute(query)
    users = result.scalars().all()
    
    return UserList(
        users=[UserAdmin.model_validate(user) for user in users],
        total=total,
        page=skip // limit + 1,
        size=limit
    )

@router.get("/users/{user_id}", response_model=UserAdmin)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: UserModel = Depends(get_admin_user)
):
    """Get detailed information about a specific user"""
    
    result = await db.execute(
        select(UserModel).where(UserModel.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's subjects count
    subjects_count_result = await db.execute(
        select(func.count(SubjectModel.id)).where(SubjectModel.owner_id == user_id)
    )
    subjects_count = subjects_count_result.scalar() or 0
    
    user_data = UserAdmin.model_validate(user)
    user_data.subjects_count = subjects_count
    
    return user_data


@router.patch("/users/{user_id}/status", response_model=UserAdmin)
async def update_user_status(
    user_id: int,
    status_update: UserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: UserModel = Depends(get_admin_user)
):
    """Toggle user's active status"""
    
    result = await db.execute(
        select(UserModel).where(UserModel.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admins from deactivating themselves
    if user_id == admin_user.id and not status_update.is_active:
        raise HTTPException(
            status_code=400, 
            detail="You cannot deactivate your own account"
        )
    
    # Prevent deactivating super admins unless you are one
    if user.is_super_admin and not admin_user.is_super_admin:
        raise HTTPException(
            status_code=403,
            detail="Only super admins can modify other super admin accounts"
        )
    
    user.is_active = status_update.is_active
    await db.commit()
    await db.refresh(user)
    
    return UserAdmin.model_validate(user)


@router.patch("/users/{user_id}/role", response_model=UserAdmin)
async def update_user_role(
    user_id: int,
    role_update: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    super_admin: UserModel = Depends(get_super_admin_user)
):
    """Update user's role (super admin only)"""
    
    result = await db.execute(
        select(UserModel).where(UserModel.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent super admins from changing their own role
    if user_id == super_admin.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot change your own role"
        )
    
    user.role = role_update.role
    await db.commit()
    await db.refresh(user)
    
    return UserAdmin.model_validate(user)


@router.get("/users/{user_id}/subjects", response_model=List[dict])
async def get_user_subjects(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: UserModel = Depends(get_admin_user)
):
    """Get all subjects for a specific user"""
    
    result = await db.execute(
        select(SubjectModel)
        .where(SubjectModel.owner_id == user_id)
        .order_by(SubjectModel.created_at.desc())
    )
    subjects = result.scalars().all()
    
    return [
        {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "is_active": s.is_active,
            "is_archived": s.is_archived,
            "created_at": s.created_at
        }
        for s in subjects
    ]