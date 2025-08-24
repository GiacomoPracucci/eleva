"""
SQLAlchemy models for document management and vector storage.

This module defines the database models for storing documents, their chunks,
and associated vector embeddings. It's designed to work with pgvector for
efficient similarity search operations.
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, Float, DateTime, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
import enum
import uuid
from datetime import datetime, timezone
from app.db.base import Base, TimestampMixin


class ProcessingStatus(enum.Enum):
    """
    Enumeration of possible document processing states.
    
    IMPORTANTE: I valori devono corrispondere esattamente all'enum nel database PostgreSQL
    """
    PENDING = "pending"      
    PARSING = "parsing"      
    CHUNKING = "chunking"    
    EMBEDDING = "embedding"  
    COMPLETED = "completed"  
    FAILED = "failed"        


class Document(Base, TimestampMixin):
    """
    Represents an uploaded document associated with a subject.
    
    This model stores the original document metadata and acts as the parent
    for all chunks and embeddings derived from the document. It tracks the
    processing status and maintains relationships with both the subject
    and the user who uploaded it.
    
    Attributes:
        id (UUID): Unique identifier for the document
        subject_id (int): Foreign key to the associated subject
        owner_id (int): Foreign key to the user who uploaded the document
        filename (str): Original name of the uploaded file
        file_type (str): MIME type or extension of the file
        file_size (int): Size of the original file in bytes
        file_url (str): S3 or storage URL for the original file
        
        total_chunks (int): Number of chunks created from this document
        processing_status (ProcessingStatus): Current processing state
        processing_error (str): Error message if processing failed
        processing_started_at (DateTime): When processing began
        processing_completed_at (DateTime): When processing finished
        
        metadata (JSON): Additional metadata (page count, author, etc.)
        
    Relationships:
        subject: Many-to-one relationship with Subject
        owner: Many-to-one relationship with User
        chunks: One-to-many relationship with DocumentChunk
    """
    __tablename__ = "documents"
    
    # Use UUID for documents to avoid enumeration attacks
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # Foreign Keys
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # File Information
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # e.g., "application/pdf", "text/plain"
    file_size = Column(Integer, nullable=False)  # Size in bytes
    file_url = Column(String(500))  # S3 URL or local path
    
    # Processing Information
    total_chunks = Column(Integer, default=0)
    processing_status = Column(
        SQLEnum(ProcessingStatus),
        default=ProcessingStatus.PENDING,
        nullable=False,
        index=True  # Index for filtering by status
    )
    processing_error = Column(Text)  # Store error details if processing fails
    processing_started_at = Column(DateTime(timezone=True))
    processing_completed_at = Column(DateTime(timezone=True))
    
    # Flexible metadata storage for document-specific information
    # Can store: {"pages": 10, "author": "John Doe", "language": "en", etc.}
    metadata_ = Column(JSON, default={})
    
    # Relationships
    subject = relationship("Subject", back_populates="documents")
    owner = relationship("User", back_populates="documents")
    chunks = relationship(
        "DocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentChunk.chunk_index"
    )
    
    def __repr__(self):
        return f"<Document(filename='{self.filename}', status={self.processing_status.value})>"
    
    @property
    def is_ready(self) -> bool:
        """Check if the document is ready for vector search."""
        return self.processing_status == ProcessingStatus.COMPLETED.value
    
    @property
    def processing_duration(self) -> float | None:
        """Calculate processing time in seconds."""
        if self.processing_started_at and self.processing_completed_at:
            delta = self.processing_completed_at - self.processing_started_at
            return delta.total_seconds()
        return None


class DocumentChunk(Base, TimestampMixin):
    """
    Represents a chunk of text extracted from a document.
    
    Documents are split into chunks for more granular search and to respect
    token limits of embedding models. Each chunk maintains its position
    in the original document and can have associated metadata.
    
    Attributes:
        id (int): Unique identifier for the chunk
        document_id (UUID): Foreign key to the parent document
        chunk_index (int): Position of this chunk in the document (0-based)
        chunk_text (str): The actual text content of the chunk
        
        start_char (int): Starting character position in original document
        end_char (int): Ending character position in original document
        
        metadata (JSON): Chunk-specific metadata (page number, section, etc.)
        
    Relationships:
        document: Many-to-one relationship with Document
        embedding: One-to-one relationship with DocumentEmbedding
    """
    __tablename__ = "document_chunks"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    
    # Chunk positioning and content
    chunk_index = Column(Integer, nullable=False)  # Order of chunk in document
    chunk_text = Column(Text, nullable=False)
    
    # Character positions for traceability
    start_char = Column(Integer)  # Starting position in original text
    end_char = Column(Integer)    # Ending position in original text
    
    # Flexible metadata for chunk-specific information
    # Can store: {"page": 3, "section": "Introduction", "paragraph": 2, etc.}
    metadata_ = Column(JSON, default={})
    
    # Relationships
    document = relationship("Document", back_populates="chunks")
    embedding = relationship(
        "DocumentEmbedding",
        back_populates="chunk",
        uselist=False,  # One-to-one relationship
        cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        preview = self.chunk_text[:50] + "..." if len(self.chunk_text) > 50 else self.chunk_text
        return f"<DocumentChunk(index={self.chunk_index}, text='{preview}')>"


class DocumentEmbedding(Base):
    """
    Stores vector embeddings for document chunks.
    
    This model leverages pgvector to store high-dimensional vectors
    that represent the semantic meaning of text chunks. These vectors
    enable similarity search and semantic retrieval.
    
    Attributes:
        id (int): Unique identifier for the embedding
        chunk_id (int): Foreign key to the associated chunk
        embedding_vector (Vector): The actual embedding vector (dimension set by model)
        
        model_name (str): Name of the model used to generate embedding
        model_version (str): Version of the embedding model
        embedding_dimension (int): Dimension of the vector (e.g., 1536 for ada-002)
        
    Relationships:
        chunk: One-to-one relationship with DocumentChunk
    
    Note:
        The vector dimension must match the model output. Common dimensions:
        - OpenAI ada-002: 1536
        - sentence-transformers/all-MiniLM-L6-v2: 384
        - sentence-transformers/all-mpnet-base-v2: 768
    """
    __tablename__ = "document_embeddings"
    
    id = Column(Integer, primary_key=True, index=True)
    chunk_id = Column(Integer, ForeignKey("document_chunks.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Vector embedding using pgvector
    # Dimension will be set based on the embedding model used
    embedding_vector = Column(Vector(1536), nullable=False)  # TODO vector dim should be passed from config
    
    # Model information for reproducibility and versioning
    model_name = Column(String(100), nullable=False, default="text-embedding-ada-002")
    model_version = Column(String(50))
    embedding_dimension = Column(Integer, nullable=False, default=1536)
    
    # Timestamp for embedding generation
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    # Relationships
    chunk = relationship("DocumentChunk", back_populates="embedding")
    
    def __repr__(self):
        return f"<DocumentEmbedding(chunk_id={self.chunk_id}, model={self.model_name})>"