from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.db.base import Base, TimestampMixin


class Subject(Base, TimestampMixin):
    """
    Represents an academic subject in the database.

    This SQLAlchemy model defines a subject created by a user. It acts as a
    container for organizing learning materials, tracking progress, and managing
    study sessions for a specific academic topic. It inherits timestamp fields
    (e.g., created_at, updated_at) from the TimestampMixin.

    A future relationship to 'Document' models is planned to link specific study
    materials to each subject.

    Attributes:
        id (int): The primary key identifier for the subject.
        name (str): The display name of the subject (e.g., "Physics 101").
        description (str): A detailed text description of the subject's scope or goals.
        academic_year (str): The academic year or semester to which the subject
                            belongs (e.g., "2024-2025").
        level (str): The grade or difficulty level of the subject (e.g., "Grade 11").
        category (str): A high-level category for filtering and organization
                        (e.g., "Science").
        color (str): A 7-character hex color code (e.g., '#4A90E2') for styling
                    UI elements associated with this subject.
        icon (str): An identifier string for a UI icon to visually represent the subject.
        is_active (bool): Flag indicating if the subject is currently being studied.
                        Defaults to True.
        is_archived (bool): Flag to archive a subject, hiding it from default views
                            without permanent deletion. Defaults to False.

        owner_id (int): The foreign key of the user who owns this subject. It cannot be null.
        owner (relationship): A many-to-one back-reference to the User object that
                            owns this subject.
    """
    __tablename__ = "subjects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    academic_year = Column(String(50))  # e.g., "2024-2025"
    level = Column(String(100))  # e.g., "Grade 11", "Bachelor Year 2"
    category = Column(String(100))  # e.g., "Mathematics", "Science", "Languages"
    color = Column(String(7))  # Hex color for UI
    icon = Column(String(50))  # Icon identifier for UI
    is_active = Column(Boolean, default=True)
    is_archived = Column(Boolean, default=False)
    
    # Foreign Keys
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    owner = relationship("User", back_populates="subjects")

    documents = relationship("Document", back_populates="subject", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Subject(name='{self.name}', owner_id={self.owner_id})>"