"""
Pydantic schemas for document-related data validation and serialization.

This module defines the request/response models for the document API endpoints,
ensuring data consistency and providing automatic validation.
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum


class ProcessingStatusEnum(str, Enum):
    """
    Enumeration of document processing states for API responses.
    
    Mirrors the database ProcessingStatus enum but as a Pydantic-compatible type.
    """
    PENDING = "pending"
    PARSING = "parsing"
    CHUNKING = "chunking"
    EMBEDDING = "embedding"
    COMPLETED = "completed"
    FAILED = "failed"


class DocumentBase(BaseModel):
    """
    Base schema containing common document fields.
    
    This schema includes fields that are typically provided by the user
    or can be modified after creation.
    """
    filename: str = Field(..., min_length=1, max_length=255, description="Name of the uploaded file")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional document metadata")


class DocumentCreate(BaseModel):
    """
    Schema for document upload requests.
    
    This is a minimal schema as most document information (filename, size, type)
    will be extracted from the uploaded file itself. The schema mainly serves
    for any additional metadata the client wants to attach.
    
    Note: The actual file upload will be handled via multipart/form-data,
    not through this JSON schema.
    """
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Optional metadata to attach to the document"
    )
    
    @field_validator('metadata')
    def validate_metadata(cls, v):
        """
        Ensure metadata doesn't contain sensitive or system keys.
        
        This prevents clients from injecting system fields that could
        interfere with internal processing.
        """
        if v:
            # List of reserved keys that clients cannot set
            reserved_keys = {'processing_status', 'processing_error', 'embedding_model'}
            for key in reserved_keys:
                if key in v:
                    raise ValueError(f"Metadata cannot contain reserved key: {key}")
        return v


class DocumentUpdate(BaseModel):
    """
    Schema for updating document metadata.
    
    Currently, only metadata can be updated after upload.
    File content and processing status are immutable once set.
    """
    metadata: Optional[Dict[str, Any]] = Field(None, description="Updated metadata")
    
    @field_validator('metadata')
    def validate_metadata(cls, v):
        """Ensure metadata doesn't contain reserved system keys."""
        if v:
            reserved_keys = {'processing_status', 'processing_error', 'embedding_model'}
            for key in reserved_keys:
                if key in v:
                    raise ValueError(f"Metadata cannot contain reserved key: {key}")
        return v


class DocumentChunkResponse(BaseModel):
    """
    Schema for returning document chunk information.
    
    This is typically used when fetching detailed chunk information
    for debugging or advanced search interfaces.
    """
    id: int
    chunk_index: int = Field(..., description="Position of chunk in document (0-based)")
    chunk_text: str = Field(..., description="The actual text content of the chunk")
    start_char: Optional[int] = Field(None, description="Starting character position in original")
    end_char: Optional[int] = Field(None, description="Ending character position in original")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Chunk-specific metadata")
    has_embedding: bool = Field(..., description="Whether this chunk has been embedded")
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    @classmethod
    def from_orm_with_embedding(cls, chunk_obj):
        """
        Create response from ORM object, checking for embedding existence.
        
        This helper method properly handles the relationship check
        to determine if an embedding exists for this chunk.
        """
        data = {
            "id": chunk_obj.id,
            "chunk_index": chunk_obj.chunk_index,
            "chunk_text": chunk_obj.chunk_text,
            "start_char": chunk_obj.start_char,
            "end_char": chunk_obj.end_char,
            "metadata": chunk_obj.metadata or {},
            "has_embedding": chunk_obj.embedding is not None,
            "created_at": chunk_obj.created_at
        }
        return cls(**data)


class DocumentProcessingStatus(BaseModel):
    """
    Schema for document processing status updates.
    
    Used for real-time status updates via WebSocket or polling endpoints.
    Provides detailed information about the current processing state.
    """
    document_id: UUID
    status: ProcessingStatusEnum
    total_chunks: Optional[int] = Field(None, description="Total number of chunks created")
    processed_chunks: Optional[int] = Field(None, description="Number of chunks with embeddings")
    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None
    processing_error: Optional[str] = Field(None, description="Error message if processing failed")
    estimated_time_remaining: Optional[int] = Field(None, description="Estimated seconds remaining")
    
    model_config = ConfigDict(from_attributes=True)
    
    @property
    def progress_percentage(self) -> Optional[float]:
        """
        Calculate processing progress as a percentage.
        
        Returns None if progress cannot be determined.
        """
        if self.total_chunks and self.processed_chunks is not None:
            return (self.processed_chunks / self.total_chunks) * 100
        return None


class DocumentResponse(BaseModel):
    """
    Complete schema for document responses.
    
    This schema is used when returning full document information,
    including processing status and metadata.
    """
    id: UUID
    subject_id: int
    owner_id: int
    filename: str
    file_type: str = Field(..., description="MIME type or file extension")
    file_size: int = Field(..., description="File size in bytes")
    file_url: Optional[str] = Field(None, description="URL to download original file")
    
    # Processing information
    processing_status: ProcessingStatusEnum
    total_chunks: int = Field(0, description="Total number of chunks")
    processing_error: Optional[str] = None
    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None
    processing_duration: Optional[float] = Field(None, description="Processing time in seconds")
    
    # Metadata and timestamps
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    
    # Computed fields
    is_ready: bool = Field(..., description="Whether document is ready for search")
    
    model_config = ConfigDict(from_attributes=True)
    
    @classmethod
    def from_orm(cls, obj):
        """
        Create response from ORM object with computed fields.
        
        This method handles the conversion from SQLAlchemy model to
        Pydantic schema, including computed properties.
        """
        return cls(
            id=obj.id,
            subject_id=obj.subject_id,
            owner_id=obj.owner_id,
            filename=obj.filename,
            file_type=obj.file_type,
            file_size=obj.file_size,
            file_url=obj.file_url,
            processing_status=obj.processing_status.value,
            total_chunks=obj.total_chunks or 0,
            processing_error=obj.processing_error,
            processing_started_at=obj.processing_started_at,
            processing_completed_at=obj.processing_completed_at,
            processing_duration=obj.processing_duration,
            metadata=obj.metadata or {},
            created_at=obj.created_at,
            updated_at=obj.updated_at,
            is_ready=obj.is_ready
        )


class DocumentListResponse(BaseModel):
    """
    Schema for paginated document list responses.
    
    Used when returning multiple documents with pagination information.
    """
    items: List[DocumentResponse]
    total: int = Field(..., description="Total number of documents")
    page: int = Field(..., ge=1, description="Current page number")
    size: int = Field(..., ge=1, le=100, description="Items per page")
    
    @property
    def pages(self) -> int:
        """Calculate total number of pages."""
        return (self.total + self.size - 1) // self.size if self.size > 0 else 0
    
    @property
    def has_next(self) -> bool:
        """Check if there's a next page."""
        return self.page < self.pages
    
    @property
    def has_prev(self) -> bool:
        """Check if there's a previous page."""
        return self.page > 1


class DocumentUploadResponse(BaseModel):
    """
    Schema for document upload response.
    
    Returned immediately after file upload, before processing begins.
    Includes information needed for tracking processing status.
    """
    document_id: UUID = Field(..., description="Unique document identifier")
    filename: str
    file_size: int
    processing_status: ProcessingStatusEnum
    message: str = Field(..., description="User-friendly status message")
    status_endpoint: str = Field(..., description="Endpoint to check processing status")
    
    model_config = ConfigDict(from_attributes=True)


class ChunkingStrategy(str, Enum):
    """
    Available text chunking strategies.
    
    Different strategies are optimal for different types of content:
    - FIXED_SIZE: Simple, works for most content
    - SENTENCE: Preserves sentence boundaries
    - PARAGRAPH: Preserves paragraph structure
    - SEMANTIC: Uses NLP to find semantic boundaries (slower but better quality)
    """
    FIXED_SIZE = "fixed_size"
    SENTENCE = "sentence"
    PARAGRAPH = "paragraph"
    SEMANTIC = "semantic"


class ChunkingConfig(BaseModel):
    """
    Configuration for document chunking process.
    
    This schema allows fine-tuning of the chunking process
    for different types of documents and use cases.
    """
    strategy: ChunkingStrategy = Field(
        default=ChunkingStrategy.FIXED_SIZE,
        description="Chunking strategy to use"
    )
    chunk_size: int = Field(
        default=1000,
        ge=100,
        le=4000,
        description="Target size for each chunk in characters"
    )
    chunk_overlap: int = Field(
        default=200,
        ge=0,
        le=500,
        description="Number of characters to overlap between chunks"
    )
    
    @field_validator('chunk_overlap')
    def validate_overlap(cls, v, info):
        """Ensure overlap is not larger than chunk size."""
        if 'chunk_size' in info.data and v >= info.data['chunk_size']:
            raise ValueError("Chunk overlap must be smaller than chunk size")
        return v