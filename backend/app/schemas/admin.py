from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime, date
from app.models.user import UserRole


class DailyRegistration(BaseModel):
    """Daily registration count for charts"""
    date: date
    count: int


class AdminDashboard(BaseModel):
    """Dashboard statistics for admin panel"""
    total_users: int
    active_users: int
    total_subjects: int
    today_registrations: int
    week_registrations: int
    daily_registrations: List[DailyRegistration]
    role_distribution: Dict[str, int]


class UserAdmin(BaseModel):
    """User model for admin panel with additional fields"""
    id: int
    email: str
    username: str
    full_name: Optional[str]
    role: UserRole
    is_active: bool
    is_verified: bool
    academic_level: Optional[str]
    profile_picture_url: Optional[str]
    show_profile_publicly: bool
    allow_ai_training: bool
    created_at: datetime
    updated_at: datetime
    subjects_count: Optional[int] = 0
    
    model_config = ConfigDict(from_attributes=True)


class UserList(BaseModel):
    """Paginated list of users"""
    users: List[UserAdmin]
    total: int
    page: int
    size: int


class UserStatusUpdate(BaseModel):
    """Request model for updating user status"""
    is_active: bool


class UserRoleUpdate(BaseModel):
    """Request model for updating user role"""
    role: UserRole