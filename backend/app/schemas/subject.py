from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


class SubjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    academic_year: Optional[str] = None
    level: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = Field(None, regex="^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = None


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    academic_year: Optional[str] = None
    level: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = Field(None, regex="^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = None
    is_active: Optional[bool] = None
    is_archived: Optional[bool] = None


class SubjectInDB(SubjectBase):
    id: int
    owner_id: int
    is_active: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class Subject(SubjectInDB):
    pass

