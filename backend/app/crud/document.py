"""
CRUD operations for document management.

This module provides database operations for documents, chunks, and embeddings,
following the same patterns as the existing CRUD modules in the application.
"""

from typing import List, Optional, Dict, Any, Sequence, Tuple
from uuid import UUID
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload

from app.models.document import (
    Document,
    DocumentChunk, 
    DocumentEmbedding,
    ProcessingStatus
)
from app.schemas.document import DocumentCreate, DocumentUpdate

logger = logging.getLogger(__name__)


class CRUDDocument:
    """
    CRUD operations for Document model.
    
    This class provides a clean interface for all document-related database
    operations, maintaining consistency with the existing CRUD patterns.
    """
    
    async def get(self, db: AsyncSession, document_id: UUID) -> Optional[Document]:
        """
        Retrieve a single document by its ID.
        
        Args:
            db: Database session
            document_id: The UUID of the document
            
        Returns:
            The Document object if found, otherwise None
        """
        result = await db.execute(
            select(Document)
            .filter(Document.id == document_id)
            .options(selectinload(Document.chunks))  # Eager load chunks
        )
        return result.scalar_one_or_none()
    
    async def get_by_subject(
        self,
        db: AsyncSession,
        subject_id: int,
        skip: int = 0,
        limit: int = 100,
        include_failed: bool = False
    ) -> List[Document]:
        """
        Retrieve all documents for a specific subject with pagination.
        
        Args:
            db: Database session
            subject_id: The ID of the subject
            skip: Number of records to skip
            limit: Maximum number of records to return
            include_failed: Whether to include documents with failed processing
            
        Returns:
            List of Document objects for the subject
        """
        query = select(Document).filter(Document.subject_id == subject_id)
        
        if not include_failed:
            query = query.filter(
                Document.processing_status != ProcessingStatus.FAILED
            )
        
        query = query.order_by(Document.created_at.desc())
        query = query.offset(skip).limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_by_owner(
        self,
        db: AsyncSession,
        owner_id: int,
        skip: int = 0,
        limit: int = 100,
        processing_status: Optional[ProcessingStatus] = None
    ) -> List[Document]:
        """
        Retrieve all documents for a specific user with optional filtering.
        
        Args:
            db: Database session
            owner_id: The ID of the document owner
            skip: Number of records to skip
            limit: Maximum number of records to return
            processing_status: Optional filter by processing status
            
        Returns:
            List of Document objects owned by the user
        """
        query = select(Document).filter(Document.owner_id == owner_id)
        
        if processing_status:
            query = query.filter(Document.processing_status == processing_status)
        
        query = query.order_by(Document.created_at.desc())
        query = query.offset(skip).limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def create(
        self,
        db: AsyncSession,
        document_data: Dict[str, Any],
        subject_id: int,
        owner_id: int
    ) -> Document:
        """
        Create a new document record.
        
        Args:
            db: Database session
            document_data: Dictionary containing document information
            subject_id: The ID of the subject this document belongs to
            owner_id: The ID of the user uploading the document
            
        Returns:
            The newly created Document object
        """
        document = Document(
            subject_id=subject_id,
            owner_id=owner_id,
            **document_data
        )
        
        db.add(document)
        await db.commit()
        await db.refresh(document)
        
        logger.info(f"Created document {document.id} for subject {subject_id}")
        return document
    
    async def update(
        self,
        db: AsyncSession,
        document: Document,
        update_data: DocumentUpdate
    ) -> Document:
        """
        Update document metadata_.
        
        Only allows updating of metadata_ field, not processing status
        or file information.
        
        Args:
            db: Database session
            document: The document to update
            update_data: The update data from the API
            
        Returns:
            The updated Document object
        """
        if update_data.metadata_ is not None:
            # Merge new metadata_ with existing
            document.metadata_ = {
                **(document.metadata_ or {}),
                **update_data.metadata_
            }
        
        db.add(document)
        await db.commit()
        await db.refresh(document)
        
        logger.info(f"Updated document {document.id}")
        return document
    
    async def delete(self, db: AsyncSession, document: Document) -> bool:
        """
        Delete a document and all its associated data.
        
        This will cascade delete all chunks and embeddings due to
        foreign key constraints.
        
        Args:
            db: Database session
            document: The document to delete
            
        Returns:
            True if deletion was successful
        """
        try:
            await db.delete(document)
            await db.commit()
            logger.info(f"Deleted document {document.id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete document {document.id}: {e}")
            await db.rollback()
            return False
    
    async def get_statistics(
        self,
        db: AsyncSession,
        owner_id: Optional[int] = None,
        subject_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get document statistics for a user or subject.
        
        Args:
            db: Database session
            owner_id: Optional user ID to filter by
            subject_id: Optional subject ID to filter by
            
        Returns:
            Dictionary containing various statistics
        """
        base_query = select(Document)
        
        if owner_id:
            base_query = base_query.filter(Document.owner_id == owner_id)
        if subject_id:
            base_query = base_query.filter(Document.subject_id == subject_id)
        
        # Get counts by status
        status_counts = {}
        for status in ProcessingStatus:
            count_query = base_query.filter(Document.processing_status == status)
            result = await db.execute(select(func.count()).select_from(count_query.subquery()))
            status_counts[status.value] = result.scalar()
        
        # Get total document count
        total_result = await db.execute(
            select(func.count()).select_from(base_query.subquery())
        )
        total_documents = total_result.scalar()
        
        # Get total file size
        size_result = await db.execute(
            select(func.sum(Document.file_size)).select_from(base_query.subquery())
        )
        total_size = size_result.scalar() or 0
        
        # Get total chunks count
        chunks_query = (
            select(func.sum(Document.total_chunks))
            .select_from(base_query.subquery())
        )
        chunks_result = await db.execute(chunks_query)
        total_chunks = chunks_result.scalar() or 0
        
        return {
            'total_documents': total_documents,
            'total_size_bytes': total_size,
            'total_chunks': total_chunks,
            'status_breakdown': status_counts,
            'average_size_bytes': total_size // total_documents if total_documents > 0 else 0,
            'ready_for_search': status_counts.get(ProcessingStatus.COMPLETED, 0)
        }
    
    def is_owner(self, document: Document, user_id: int) -> bool:
        """
        Check if a user owns a document.
        
        Args:
            document: The document to check
            user_id: The user ID to check against
            
        Returns:
            True if the user owns the document
        """
        return document.owner_id == user_id
    
    async def check_duplicate(
        self,
        db: AsyncSession,
        subject_id: int,
        filename: str,
        file_hash: Optional[str] = None
    ) -> Optional[Document]:
        """
        Check if a duplicate document already exists.
        
        Can check by filename or file hash for more accurate detection.
        
        Args:
            db: Database session
            subject_id: The subject to check within
            filename: The filename to check
            file_hash: Optional file hash for exact matching
            
        Returns:
            Existing document if duplicate found, otherwise None
        """
        query = select(Document).filter(
            Document.subject_id == subject_id,
            Document.filename == filename
        )
        
        if file_hash:
            # Check in metadata_ for file hash
            query = query.filter(
                Document.metadata_['file_hash'].astext == file_hash
            )
        
        result = await db.execute(query)
        return result.scalar_one_or_none()


class CRUDDocumentChunk:
    """
    CRUD operations for DocumentChunk model.
    
    Handles operations on document chunks including retrieval
    and batch creation.
    """
    
    async def get_by_document(
        self,
        db: AsyncSession,
        document_id: UUID,
        include_embeddings: bool = False
    ) -> List[DocumentChunk]:
        """
        Get all chunks for a document.
        
        Args:
            db: Database session
            document_id: The document UUID
            include_embeddings: Whether to eager load embeddings
            
        Returns:
            List of DocumentChunk objects ordered by chunk_index
        """
        query = select(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).order_by(DocumentChunk.chunk_index)
        
        if include_embeddings:
            query = query.options(selectinload(DocumentChunk.embedding))
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def create_batch(
        self,
        db: AsyncSession,
        document_id: UUID,
        chunks: List[Dict[str, Any]]
    ) -> List[DocumentChunk]:
        """
        Create multiple chunks for a document in a single operation.
        
        Args:
            db: Database session
            document_id: The document these chunks belong to
            chunks: List of chunk data dictionaries
            
        Returns:
            List of created DocumentChunk objects
        """
        chunk_objects = []
        
        for chunk_data in chunks:
            chunk = DocumentChunk(
                document_id=document_id,
                **chunk_data
            )
            db.add(chunk)
            chunk_objects.append(chunk)
        
        # Update document total chunks count
        document = await db.get(Document, document_id)
        if document:
            document.total_chunks = len(chunks)
        
        await db.commit()
        
        # Refresh all chunks to get their IDs
        for chunk in chunk_objects:
            await db.refresh(chunk)
        
        logger.info(f"Created {len(chunk_objects)} chunks for document {document_id}")
        return chunk_objects
    
    async def get_chunks_without_embeddings(
        self,
        db: AsyncSession,
        document_id: UUID
    ) -> List[DocumentChunk]:
        """
        Get chunks that don't have embeddings yet.
        
        Useful for retry logic or resuming failed embedding processes.
        
        Args:
            db: Database session
            document_id: The document UUID
            
        Returns:
            List of DocumentChunk objects without embeddings
        """
        # Subquery to find chunks with embeddings
        has_embedding = select(DocumentEmbedding.chunk_id).subquery()
        
        # Main query to find chunks without embeddings
        query = select(DocumentChunk).filter(
            and_(
                DocumentChunk.document_id == document_id,
                DocumentChunk.id.notin_(has_embedding)
            )
        ).order_by(DocumentChunk.chunk_index)
        
        result = await db.execute(query)
        return result.scalars().all()

    async def search_similar_chunks(
        self,
        db: AsyncSession,
        document_id: UUID,
        query_embedding: Sequence[float],
        limit: int,
    ) -> List[Tuple[DocumentChunk, float]]:
        """Return document chunks ordered by vector similarity."""

        distance_metric = DocumentEmbedding.embedding_vector.cosine_distance(query_embedding)

        stmt = (
            select(DocumentChunk, distance_metric.label("distance"))
            .join(DocumentEmbedding, DocumentEmbedding.chunk_id == DocumentChunk.id)
            .where(DocumentChunk.document_id == document_id)
            .order_by(distance_metric)
            .limit(limit)
        )

        result = await db.execute(stmt)
        return result.all()


# Create singleton instances
document_crud = CRUDDocument()
document_chunk_crud = CRUDDocumentChunk()
