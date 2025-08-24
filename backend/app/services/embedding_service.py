"""
Embedding service for generating vector embeddings from text chunks.

This module integrates with the OpenAI client to generate embeddings
for document chunks and manages the storage of these embeddings in
the database using pgvector.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import asyncio

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.services.api_providers.openai_client import OpenAIClient, OpenAIEmbeddingModel
from app.services.api_providers.exceptions import APIError, RateLimitError
from app.services.api_providers.models import EmbeddingResult

from app.models.document import (
    Document,
    DocumentChunk,
    DocumentEmbedding,
    ProcessingStatus
)
from app.services.text_chunker import TextChunk
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingServiceError(Exception):
    """Custom exception for embedding service failures."""
    pass


class EmbeddingService:
    """
    Service for generating and managing document embeddings.
    
    This service handles the generation of vector embeddings for text chunks
    using OpenAI's embedding models, and manages their storage in the database.
    It includes batch processing capabilities, progress tracking, and error handling.
    """
    
    # Default model configuration
    DEFAULT_MODEL = OpenAIEmbeddingModel.TEXT_EMBEDDING_3_SMALL.value
    DEFAULT_DIMENSIONS = 1536  # Default for text-embedding-3-small
    
    # Batch processing configuration
    DEFAULT_BATCH_SIZE = 100  # Process 100 chunks at a time
    MAX_RETRIES = 3
    
    def __init__(
        self,
        openai_client: Optional[OpenAIClient] = None,
        model: Optional[str] = None,
        dimensions: Optional[int] = None
    ):
        """
        Initialize the embedding service.
        
        Args:
            openai_client: Optional OpenAI client instance. If not provided,
                          a new one will be created using environment variables.
            model: The embedding model to use. Defaults to text-embedding-3-small.
            dimensions: The dimensionality of the embeddings. Some models support
                       variable dimensions for storage optimization.
        """
        # Initialize or use provided OpenAI client
        self.openai_client = openai_client or OpenAIClient(
            api_key=settings.OPENAI_API_KEY if hasattr(settings, 'OPENAI_API_KEY') else None,
            max_concurrent_requests=10,
            timeout=60.0
        )
        
        # Model configuration
        self.model = model or self.DEFAULT_MODEL
        self.dimensions = dimensions or self.DEFAULT_DIMENSIONS
        
        # Validate model and dimensions compatibility
        self._validate_model_config()
        
        # Statistics tracking
        self.stats = {
            'total_embedded': 0,
            'total_failed': 0,
            'total_tokens_used': 0
        }
        
        logger.info(
            f"Embedding service initialized with model '{self.model}' "
            f"(dimensions: {self.dimensions})"
        )
    
    def _validate_model_config(self):
        """
        Validate that the model and dimensions are compatible.
        
        Different OpenAI models support different dimension configurations:
        - text-embedding-3-small: 512 or 1536 dimensions
        - text-embedding-3-large: 256, 1024, or 3072 dimensions
        - text-embedding-ada-002: 1536 dimensions only
        """
        valid_configs = {
            OpenAIEmbeddingModel.TEXT_EMBEDDING_3_SMALL.value: [512, 1536],
            OpenAIEmbeddingModel.TEXT_EMBEDDING_3_LARGE.value: [256, 1024, 3072],
            OpenAIEmbeddingModel.TEXT_EMBEDDING_ADA_002.value: [1536],
        }
        
        if self.model in valid_configs:
            valid_dims = valid_configs[self.model]
            if self.dimensions not in valid_dims:
                raise EmbeddingServiceError(
                    f"Model '{self.model}' does not support {self.dimensions} dimensions. "
                    f"Valid dimensions: {valid_dims}"
                )
    
    async def embed_document_chunks(
        self,
        db: AsyncSession,
        document: Document,
        chunks: List[DocumentChunk],
        batch_size: Optional[int] = None,
        progress_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Generate embeddings for all chunks of a document.
        
        This method processes chunks in batches to optimize API usage and
        provides progress updates through an optional callback.
        
        Args:
            db: Database session for storing embeddings
            document: The document being processed
            chunks: List of DocumentChunk objects to embed
            batch_size: Number of chunks to process in each batch
            progress_callback: Optional async function to call with progress updates
                             Should accept (processed, total, status_message)
        
        Returns:
            A dictionary with processing statistics and results
            
        Raises:
            EmbeddingServiceError: If embedding generation fails
        """
        batch_size = batch_size or self.DEFAULT_BATCH_SIZE
        total_chunks = len(chunks)
        processed_chunks = 0
        failed_chunks = []
        total_tokens = 0
        
        logger.info(f"Starting embedding generation for {total_chunks} chunks of document {document.id}")
        
        # Update document status to embedding
        await self._update_document_status(db, document, ProcessingStatus.EMBEDDING)
        
        try:
            # Process chunks in batches
            for i in range(0, total_chunks, batch_size):
                batch = chunks[i:i + batch_size]
                batch_texts = [chunk.chunk_text for chunk in batch]
                
                try:
                    # Generate embeddings for this batch
                    logger.debug(f"Processing batch {i//batch_size + 1} ({len(batch)} chunks)")
                    
                    # Use dimensions parameter if model supports it
                    kwargs = {}
                    if self.model in [
                        OpenAIEmbeddingModel.TEXT_EMBEDDING_3_SMALL.value,
                        OpenAIEmbeddingModel.TEXT_EMBEDDING_3_LARGE.value
                    ]:
                        kwargs['dimensions'] = self.dimensions
                    
                    # Call the OpenAI client to get embeddings
                    embedding_results = await self.openai_client.get_embeddings_batch(
                        texts=batch_texts,
                        model=self.model,
                        **kwargs
                    )
                    
                    # Store embeddings in database
                    for chunk, embedding_result in zip(batch, embedding_results):
                        await self._store_embedding(
                            db, 
                            chunk, 
                            embedding_result
                        )
                        
                        # Track token usage if available
                        if embedding_result.usage:
                            total_tokens += embedding_result.usage.get('total_tokens', 0)
                    
                    processed_chunks += len(batch)
                    
                    # Update progress
                    if progress_callback:
                        await progress_callback(
                            processed_chunks,
                            total_chunks,
                            f"Embedded {processed_chunks}/{total_chunks} chunks"
                        )
                    
                    # Commit batch to database
                    await db.commit()
                    
                except (APIError, RateLimitError) as e:
                    logger.error(f"API error processing batch: {e}")
                    
                    # Track failed chunks
                    failed_chunks.extend([c.id for c in batch])
                    
                    # Implement exponential backoff for rate limits
                    if isinstance(e, RateLimitError):
                        wait_time = min(2 ** (i // batch_size), 60)  # Max 60 seconds
                        logger.info(f"Rate limited. Waiting {wait_time} seconds...")
                        await asyncio.sleep(wait_time)
                    
                    # Continue with next batch
                    continue
                    
                except Exception as e:
                    logger.error(f"Unexpected error processing batch: {e}")
                    failed_chunks.extend([c.id for c in batch])
                    continue
            
            # Update document with final status
            if failed_chunks:
                await self._update_document_status(
                    db, 
                    document, 
                    ProcessingStatus.COMPLETED,  # Partial success
                    error_message=f"Failed to embed {len(failed_chunks)} chunks"
                )
            else:
                await self._update_document_status(
                    db, 
                    document, 
                    ProcessingStatus.COMPLETED
                )
            
            # Update statistics
            self.stats['total_embedded'] += processed_chunks
            self.stats['total_failed'] += len(failed_chunks)
            self.stats['total_tokens_used'] += total_tokens
            
            # Prepare results
            results = {
                'total_chunks': total_chunks,
                'processed_chunks': processed_chunks,
                'failed_chunks': len(failed_chunks),
                'failed_chunk_ids': failed_chunks,
                'tokens_used': total_tokens,
                'model': self.model,
                'dimensions': self.dimensions,
                'success': len(failed_chunks) == 0
            }
            
            logger.info(
                f"Embedding generation completed for document {document.id}: "
                f"{processed_chunks}/{total_chunks} successful"
            )
            
            return results
            
        except Exception as e:
            logger.error(f"Critical error during embedding generation: {e}")
            
            # Update document status to failed
            await self._update_document_status(
                db,
                document,
                ProcessingStatus.FAILED,
                error_message=str(e)
            )
            
            raise EmbeddingServiceError(
                f"Failed to generate embeddings for document {document.id}: {str(e)}"
            )
    
    async def _store_embedding(
        self,
        db: AsyncSession,
        chunk: DocumentChunk,
        embedding_result: EmbeddingResult
    ):
        """
        Store a single embedding in the database.
        
        Args:
            db: Database session
            chunk: The chunk this embedding belongs to
            embedding_result: The embedding result from OpenAI
        """
        # Check if embedding already exists (for idempotency)
        existing = await db.execute(
            select(DocumentEmbedding).filter(
                DocumentEmbedding.chunk_id == chunk.id
            )
        )
        existing_embedding = existing.scalar_one_or_none()
        
        if existing_embedding:
            # Update existing embedding
            existing_embedding.embedding_vector = embedding_result.embedding
            existing_embedding.model_name = self.model
            existing_embedding.embedding_dimension = len(embedding_result.embedding)
            existing_embedding.created_at = datetime.now(timezone.utc)
            logger.debug(f"Updated existing embedding for chunk {chunk.id}")
        else:
            # Create new embedding
            embedding = DocumentEmbedding(
                chunk_id=chunk.id,
                embedding_vector=embedding_result.embedding,
                model_name=self.model,
                model_version=embedding_result.model,  # Full model version from API
                embedding_dimension=len(embedding_result.embedding)
            )
            db.add(embedding)
            logger.debug(f"Created new embedding for chunk {chunk.id}")
    
    async def _update_document_status(
        self,
        db: AsyncSession,
        document: Document,
        status: ProcessingStatus,
        error_message: Optional[str] = None
    ):
        """
        Update the processing status of a document.
        
        Args:
            db: Database session
            document: The document to update
            status: The new processing status
            error_message: Optional error message if status is FAILED
        """
        document.processing_status = status
        
        if status == ProcessingStatus.EMBEDDING.value:
            document.processing_started_at = datetime.now(timezone.utc)
        elif status in [ProcessingStatus.COMPLETED.value, ProcessingStatus.FAILED.value]:
            document.processing_completed_at = datetime.now(timezone.utc)
        
        if error_message:
            document.processing_error = error_message
        
        db.add(document)
        await db.commit()
        
        logger.info(f"Updated document {document.id} status to {status.value}")
    
    async def get_embedding_for_text(
        self,
        text: str,
        **kwargs
    ) -> List[float]:
        """
        Generate an embedding for a single text string.
        
        This is useful for generating query embeddings for similarity search.
        
        Args:
            text: The text to embed
            **kwargs: Additional parameters to pass to the embedding API
            
        Returns:
            The embedding vector as a list of floats
        """
        # Add dimensions if supported by model
        if self.model in [
            OpenAIEmbeddingModel.TEXT_EMBEDDING_3_SMALL.value,
            OpenAIEmbeddingModel.TEXT_EMBEDDING_3_LARGE.value
        ]:
            kwargs['dimensions'] = self.dimensions
        
        result = await self.openai_client.get_embedding(
            text=text,
            model=self.model,
            **kwargs
        )
        
        return result.embedding
    
    async def close(self):
        """
        Clean up resources.
        
        This should be called when the service is no longer needed.
        """
        if self.openai_client:
            await self.openai_client.close()
        logger.info("Embedding service closed")


# Global instance (optional - can be initialized in app startup)
embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """
    Get or create the global embedding service instance.
    
    This follows the singleton pattern to reuse the OpenAI client connection.
    """
    global embedding_service
    if embedding_service is None:
        embedding_service = EmbeddingService()
    return embedding_service