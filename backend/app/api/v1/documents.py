"""
FastAPI endpoints for document management.

This module provides RESTful API endpoints for uploading, processing,
and managing documents with their vector embeddings.
"""

import os
import logging
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timezone

from fastapi import (
    APIRouter, 
    Depends, 
    HTTPException, 
    UploadFile, 
    File,
    Query,
    BackgroundTasks,
    status
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_active_user
from app.core.config import settings
from app.models.user import User as UserModel
from app.models.document import Document, ProcessingStatus
from app.crud.document import document_crud, document_chunk_crud
from app.crud.subject import subject_crud
from app.schemas.document import (
    DocumentResponse,
    DocumentListResponse,
    DocumentUploadResponse,
    DocumentProcessingStatus,
    DocumentUpdate,
    ChunkingConfig,
    DocumentChunkResponse
)
from app.services.document_parser import document_parser, DocumentParsingError
from app.services.text_chunker import text_chunker
from app.services.embedding_service import get_embedding_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ===== Helper Functions =====

def validate_file(file: UploadFile) -> None:
    """
    Validate uploaded file for size and type constraints.
    
    Args:
        file: The uploaded file to validate
        
    Raises:
        HTTPException: If file validation fails
    """
    # Check file size (using Content-Length header if available)
    max_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if file.size and file.size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB"
        )
    
    # Check file type
    if file.content_type not in settings.ALLOWED_FILE_TYPES:
        # Also check by extension as fallback
        file_ext = os.path.splitext(file.filename)[1].lower()
        allowed_extensions = ['.pdf', '.txt', '.md', '.docx']
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"File type '{file.content_type}' is not supported. "
                       f"Allowed types: PDF, TXT, MD, DOCX"
            )


async def process_document_background(
    document_id: UUID,
    file_content: bytes,
    filename: str,
    mime_type: str,
    chunking_config: Dict[str, Any]
):
    """
    Background task to process a document (parsing, chunking, embedding).
    
    This function runs asynchronously after the upload endpoint returns,
    allowing for long-running processing without blocking the API response.
    
    Args:
        document_id: The UUID of the document to process
        file_content: The raw file content
        filename: Original filename
        mime_type: MIME type of the file
        chunking_config: Configuration for text chunking
    """
    # Create a new database session for the background task
    from app.db.session import AsyncSessionLocal
    
    async with AsyncSessionLocal() as db:
        try:
            # Get the document
            document = await document_crud.get(db, document_id)
            if not document:
                logger.error(f"Document {document_id} not found for processing")
                return
            
            # Update status to parsing
            document.processing_status = ProcessingStatus.PARSING
            document.processing_started_at = datetime.now(timezone.utc)
            await db.commit()
            
            # Step 1: Parse the document
            logger.info(f"Parsing document {document_id}")
            try:
                text, metadata = await document_parser.parse_document(
                    file_content=file_content,
                    filename=filename,
                    mime_type=mime_type
                )
                
                # Update document with parsing metadata
                document.metadata = {
                    **(document.metadata or {}),
                    **metadata
                }
                await db.commit()
                
            except DocumentParsingError as e:
                logger.error(f"Failed to parse document {document_id}: {e}")
                document.processing_status = ProcessingStatus.FAILED
                document.processing_error = str(e)
                document.processing_completed_at = datetime.now(timezone.utc)
                await db.commit()
                return
            
            # Step 2: Chunk the text
            logger.info(f"Chunking document {document_id}")
            document.processing_status = ProcessingStatus.CHUNKING
            await db.commit()
            
            chunks = text_chunker.chunk_text(
                text=text,
                strategy=chunking_config.get('strategy', settings.CHUNKING_STRATEGY),
                chunk_size=chunking_config.get('chunk_size', settings.CHUNK_SIZE),
                chunk_overlap=chunking_config.get('chunk_overlap', settings.CHUNK_OVERLAP),
                metadata={'document_id': str(document_id)}
            )
            
            # Save chunks to database
            chunk_dicts = [chunk.to_dict() for chunk in chunks]
            db_chunks = await document_chunk_crud.create_batch(
                db=db,
                document_id=document_id,
                chunks=chunk_dicts
            )
            
            logger.info(f"Created {len(db_chunks)} chunks for document {document_id}")
            
            # Step 3: Generate embeddings
            logger.info(f"Generating embeddings for document {document_id}")
            document.processing_status = ProcessingStatus.EMBEDDING
            await db.commit()
            
            embedding_service = get_embedding_service()
            
            # Process embeddings with progress tracking
            async def progress_callback(processed, total, message):
                logger.debug(f"Embedding progress for {document_id}: {message}")
                # In a real implementation, you might send this to a websocket
                # or store in Redis for the client to poll
            
            embedding_results = await embedding_service.embed_document_chunks(
                db=db,
                document=document,
                chunks=db_chunks,
                progress_callback=progress_callback
            )
            
            # Check if all embeddings were successful
            if embedding_results['success']:
                logger.info(f"Successfully processed document {document_id}")
            else:
                logger.warning(
                    f"Document {document_id} processed with {embedding_results['failed_chunks']} failed chunks"
                )
            
        except Exception as e:
            logger.error(f"Unexpected error processing document {document_id}: {e}")
            
            # Try to update document status to failed
            try:
                document = await document_crud.get(db, document_id)
                if document:
                    document.processing_status = ProcessingStatus.FAILED
                    document.processing_error = str(e)
                    document.processing_completed_at = datetime.now(timezone.utc)
                    await db.commit()
            except:
                pass  # Best effort - don't fail the background task


# ===== API Endpoints =====

@router.post("/subjects/{subject_id}/documents", response_model=DocumentUploadResponse)
async def upload_document(
    subject_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user)
):
    """
    Upload a document to a subject for processing.
    
    This endpoint handles file upload and initiates the processing pipeline
    (parsing, chunking, embedding) as a background task. The response includes
    a document ID that can be used to track processing status.
    
    Args:
        subject_id: The ID of the subject to attach the document to
        file: The uploaded file (PDF, TXT, MD, or DOCX)
        background_tasks: FastAPI background task manager
        db: Database session
        current_user: The authenticated user
        
    Returns:
        DocumentUploadResponse with document ID and status endpoint
        
    Raises:
        HTTPException: If subject not found, unauthorized, or file validation fails
    """
    # Verify subject exists and user has access
    subject = await subject_crud.get(db, subject_id=subject_id)
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found"
        )
    
    if not subject_crud.is_owner(subject, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to upload documents to this subject"
        )
    
    # Validate file
    validate_file(file)
    
    # Read file content
    file_content = await file.read()
    
    # Check for duplicates
    existing = await document_crud.check_duplicate(
        db=db,
        subject_id=subject_id,
        filename=file.filename
    )
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A document with the name '{file.filename}' already exists in this subject"
        )
    
    # Create document record
    document_data = {
        'filename': file.filename,
        'file_type': file.content_type or 'application/octet-stream',
        'file_size': len(file_content),
        'file_url': None,  # Will be set when we implement S3 upload
        'processing_status': ProcessingStatus.PENDING,
        'metadata': {
            'uploaded_at': datetime.now(timezone.utc).isoformat(),
            'original_filename': file.filename
        }
    }
    
    document = await document_crud.create(
        db=db,
        document_data=document_data,
        subject_id=subject_id,
        owner_id=current_user.id
    )
    
    # TODO: Upload file to S3 and update file_url
    # For now, we'll process the file directly from memory
    
    # Start background processing
    chunking_config = {
        'strategy': settings.CHUNKING_STRATEGY,
        'chunk_size': settings.CHUNK_SIZE,
        'chunk_overlap': settings.CHUNK_OVERLAP
    }
    
    background_tasks.add_task(
        process_document_background,
        document_id=document.id,
        file_content=file_content,
        filename=file.filename,
        mime_type=file.content_type,
        chunking_config=chunking_config
    )
    
    logger.info(f"Document {document.id} uploaded and queued for processing")
    
    return DocumentUploadResponse(
        document_id=document.id,
        filename=document.filename,
        file_size=document.file_size,
        processing_status=document.processing_status,
        message="Document uploaded successfully and queued for processing",
        status_endpoint=f"/api/v1/documents/{document.id}/status"
    )


@router.get("/subjects/{subject_id}/documents", response_model=DocumentListResponse)
async def list_subject_documents(
    subject_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    include_failed: bool = Query(False, description="Include failed documents"),
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user)
):
    """
    List all documents for a subject with pagination.
    
    Args:
        subject_id: The ID of the subject
        page: Page number (1-based)
        size: Number of items per page
        include_failed: Whether to include documents with failed processing
        db: Database session
        current_user: The authenticated user
        
    Returns:
        Paginated list of documents
        
    Raises:
        HTTPException: If subject not found or unauthorized
    """
    # Verify subject exists and user has access
    subject = await subject_crud.get(db, subject_id=subject_id)
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found"
        )
    
    if not subject_crud.is_owner(subject, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view documents for this subject"
        )
    
    # Calculate offset
    skip = (page - 1) * size
    
    # Get documents
    documents = await document_crud.get_by_subject(
        db=db,
        subject_id=subject_id,
        skip=skip,
        limit=size,
        include_failed=include_failed
    )
    
    # Get total count for pagination
    stats = await document_crud.get_statistics(db=db, subject_id=subject_id)
    total = stats['total_documents']
    
    # Convert to response models
    items = [DocumentResponse.from_orm(doc) for doc in documents]
    
    return DocumentListResponse(
        items=items,
        total=total,
        page=page,
        size=size
    )


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user)
):
    """
    Get detailed information about a specific document.
    
    Args:
        document_id: The UUID of the document
        db: Database session
        current_user: The authenticated user
        
    Returns:
        Detailed document information
        
    Raises:
        HTTPException: If document not found or unauthorized
    """
    document = await document_crud.get(db, document_id=document_id)
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if not document_crud.is_owner(document, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this document"
        )
    
    return DocumentResponse.from_orm(document)


@router.get("/documents/{document_id}/status", response_model=DocumentProcessingStatus)
async def get_document_status(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user)
):
    """
    Get the processing status of a document.
    
    This endpoint is designed for polling to track document processing progress.
    It provides detailed information about the current processing state.
    
    Args:
        document_id: The UUID of the document
        db: Database session
        current_user: The authenticated user
        
    Returns:
        Current processing status with progress information
        
    Raises:
        HTTPException: If document not found or unauthorized
    """
    document = await document_crud.get(db, document_id=document_id)
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if not document_crud.is_owner(document, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this document"
        )
    
    # Get chunks with embeddings to calculate progress
    chunks = await document_chunk_crud.get_by_document(
        db=db,
        document_id=document_id,
        include_embeddings=True
    )
    
    processed_chunks = sum(1 for chunk in chunks if chunk.embedding is not None)
    
    # Estimate time remaining (simple heuristic)
    estimated_time = None
    if document.processing_status == ProcessingStatus.EMBEDDING and chunks:
        # Assume 0.5 seconds per chunk as a rough estimate
        remaining_chunks = len(chunks) - processed_chunks
        estimated_time = int(remaining_chunks * 0.5)
    
    return DocumentProcessingStatus(
        document_id=document.id,
        status=document.processing_status,
        total_chunks=len(chunks) if chunks else None,
        processed_chunks=processed_chunks if chunks else None,
        processing_started_at=document.processing_started_at,
        processing_completed_at=document.processing_completed_at,
        processing_error=document.processing_error,
        estimated_time_remaining=estimated_time
    )


@router.get("/documents/{document_id}/chunks", response_model=List[DocumentChunkResponse])
async def get_document_chunks(
    document_id: UUID,
    include_text: bool = Query(True, description="Include chunk text in response"),
    only_without_embeddings: bool = Query(False, description="Only return chunks without embeddings"),
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user)
):
    """
    Get all chunks for a document.
    
    This endpoint is useful for debugging and for advanced users who want
    to see how their document was chunked.
    
    Args:
        document_id: The UUID of the document
        include_text: Whether to include the full text of each chunk
        only_without_embeddings: Filter to only show chunks without embeddings
        db: Database session
        current_user: The authenticated user
        
    Returns:
        List of document chunks
        
    Raises:
        HTTPException: If document not found or unauthorized
    """
    document = await document_crud.get(db, document_id=document_id)
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if not document_crud.is_owner(document, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this document"
        )
    
    # Get chunks based on filter
    if only_without_embeddings:
        chunks = await document_chunk_crud.get_chunks_without_embeddings(
            db=db,
            document_id=document_id
        )
    else:
        chunks = await document_chunk_crud.get_by_document(
            db=db,
            document_id=document_id,
            include_embeddings=True
        )
    
    # Convert to response model
    responses = []
    for chunk in chunks:
        response = DocumentChunkResponse.from_orm_with_embedding(chunk)
        if not include_text:
            response.chunk_text = f"[Text hidden - {len(chunk.chunk_text)} characters]"
        responses.append(response)
    
    return responses


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user)
):
    """
    Delete a document and all its associated data.
    
    This will permanently delete the document, its chunks, and embeddings.
    The original file will also be deleted from storage.
    
    Args:
        document_id: The UUID of the document to delete
        db: Database session
        current_user: The authenticated user
        
    Returns:
        Success message
        
    Raises:
        HTTPException: If document not found or unauthorized
    """
    document = await document_crud.get(db, document_id=document_id)
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if not document_crud.is_owner(document, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this document"
        )
    
    # TODO: Delete file from S3 if file_url exists
    # if document.file_url:
    #     await delete_from_s3(document.file_url)
    
    # Delete from database (cascades to chunks and embeddings)
    success = await document_crud.delete(db, document)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document"
        )
    
    logger.info(f"Document {document_id} deleted by user {current_user.id}")
    
    return {"message": "Document deleted successfully"}


@router.get("/documents/statistics/me")
async def get_my_document_statistics(
    subject_id: Optional[int] = Query(None, description="Filter by subject"),
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user)
):
    """
    Get document statistics for the current user.
    
    Provides aggregate statistics about the user's documents,
    useful for dashboard displays.
    
    Args:
        subject_id: Optional filter by specific subject
        db: Database session
        current_user: The authenticated user
        
    Returns:
        Dictionary with various statistics
    """
    # If subject_id provided, verify ownership
    if subject_id:
        subject = await subject_crud.get(db, subject_id=subject_id)
        if not subject or not subject_crud.is_owner(subject, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view statistics for this subject"
            )
    
    stats = await document_crud.get_statistics(
        db=db,
        owner_id=current_user.id,
        subject_id=subject_id
    )
    
    return stats