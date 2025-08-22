from sqlalchemy import Column, Integer, String, Boolean, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.base import Base, TimestampMixin
import enum


class UserRole(str, enum.Enum):
    """User role enumeration for access control"""
    USER = "user"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

class User(Base, TimestampMixin):
    """
    Represents a user in the database.

    This SQLAlchemy model stores all information related to a user, including their
    authentication credentials, personal profile details, and privacy settings.
    It inherits timestamp fields (e.g., created_at, updated_at) from the TimestampMixin.

    Attributes:
        id (int): The primary key identifier for the user.
        email (str): The user's unique email address, used for login and communication.
        username (str): The user's unique public username.
        full_name (str): The user's full name.
        hashed_password (str): The user's password, securely hashed.
        is_active (bool): Flag to indicate if the user account is active. Inactive
                        users cannot log in. Defaults to True.
        is_verified (bool): Flag to indicate if the user has verified their email
                            address. Defaults to False.
        
        academic_level (str): The user's declared academic level (e.g., "University").
        bio (str): A short biography or description provided by the user.
        profile_picture_url (str): A URL pointing to the user's profile picture.
        
        show_profile_publicly (bool): A privacy setting to control whether the user's
                                    profile is visible to others. Defaults to False.
        allow_ai_training (bool): A privacy setting indicating user consent for their
                                anonymized data to be used for training AI models.
                                Defaults to True.
        
        subjects (relationship): A one-to-many relationship to the Subject model.
                                When a user is deleted, all their associated subjects
                                are also deleted due to the "all, delete-orphan"
                                cascade setting.
    """
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(255))
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Role field for access control
    role = Column(SQLEnum(UserRole), default=UserRole.USER, nullable=False, index=True)
    
    # Profile fields
    academic_level = Column(String(100))  # e.g., "High School", "University", etc.
    bio = Column(Text)
    profile_picture_url = Column(String(500))
    
    # Privacy settings
    show_profile_publicly = Column(Boolean, default=False)
    allow_ai_training = Column(Boolean, default=True)
    
    # Relationships
    subjects = relationship("Subject", back_populates="owner", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(email='{self.email}', username='{self.username}')>"
    
    @property
    def is_admin(self):
        """Check if user has admin privileges"""
        return self.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]
    
    @property
    def is_super_admin(self):
        """Check if user is a super admin"""
        return self.role == UserRole.SUPER_ADMIN