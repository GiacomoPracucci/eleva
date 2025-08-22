from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    full_name: Optional[str] = None
    academic_level: Optional[str] = None
    bio: Optional[str] = None
    show_profile_publicly: bool = False
    allow_ai_training: bool = True


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    academic_level: Optional[str] = None
    bio: Optional[str] = None
    show_profile_publicly: Optional[bool] = None
    allow_ai_training: Optional[bool] = None


class UserInDB(UserBase):
    id: int
    role: UserRole
    is_active: bool
    is_verified: bool
    profile_picture_url: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class User(UserInDB):
    pass