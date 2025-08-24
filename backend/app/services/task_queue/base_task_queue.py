"""
Task queue service for asynchronous document processing.

This module provides an abstraction layer for background task processing.
Currently uses FastAPI's BackgroundTasks, but can be easily switched to
Celery, RQ, or other task queue systems for production scalability.
"""

import asyncio
import logging
from typing import Optional, Dict, Any, Callable
from uuid import UUID
from enum import Enum
import json

from app.core.config import settings

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    """Status of a background task."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskType(Enum):
    """Types of background tasks."""
    DOCUMENT_PROCESSING = "document_processing"
    BATCH_EMBEDDING = "batch_embedding"
    DOCUMENT_REPROCESSING = "document_reprocessing"


class TaskQueue:
    """
    Abstract task queue interface.
    
    This class provides a common interface for different task queue
    implementations, making it easy to switch between different backends.
    """
    
    def __init__(self):
        """Initialize the task queue."""
        self.tasks: Dict[str, Dict[str, Any]] = {}  # In-memory task tracking
        
    async def enqueue(
        self,
        task_type: TaskType,
        task_func: Callable,
        task_id: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Enqueue a task for asynchronous processing.
        
        Args:
            task_type: The type of task being enqueued
            task_func: The async function to execute
            task_id: Optional task ID (generated if not provided)
            **kwargs: Arguments to pass to the task function
            
        Returns:
            The task ID for tracking
        """
        if task_id is None:
            task_id = f"{task_type.value}_{UUID().hex}"
        
        # Store task metadata
        self.tasks[task_id] = {
            'type': task_type.value,
            'status': TaskStatus.PENDING.value,
            'created_at': asyncio.get_event_loop().time(),
            'kwargs': kwargs
        }
        
        # In the simple implementation, we just run it
        asyncio.create_task(self._run_task(task_id, task_func, **kwargs))
        
        logger.info(f"Enqueued task {task_id} of type {task_type.value}")
        return task_id
    
    async def _run_task(self, task_id: str, task_func: Callable, **kwargs):
        """
        Execute a task and update its status.
        
        Args:
            task_id: The ID of the task
            task_func: The function to execute
            **kwargs: Arguments for the function
        """
        try:
            # Update status to running
            if task_id in self.tasks:
                self.tasks[task_id]['status'] = TaskStatus.RUNNING.value
                self.tasks[task_id]['started_at'] = asyncio.get_event_loop().time()
            
            # Execute the task
            result = await task_func(**kwargs)
            
            # Update status to completed
            if task_id in self.tasks:
                self.tasks[task_id]['status'] = TaskStatus.COMPLETED.value
                self.tasks[task_id]['completed_at'] = asyncio.get_event_loop().time()
                self.tasks[task_id]['result'] = result
            
            logger.info(f"Task {task_id} completed successfully")
            
        except Exception as e:
            # Update status to failed
            if task_id in self.tasks:
                self.tasks[task_id]['status'] = TaskStatus.FAILED.value
                self.tasks[task_id]['error'] = str(e)
                self.tasks[task_id]['failed_at'] = asyncio.get_event_loop().time()
            
            logger.error(f"Task {task_id} failed: {e}")
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the status of a task.
        
        Args:
            task_id: The ID of the task
            
        Returns:
            Task status information or None if not found
        """
        return self.tasks.get(task_id)
    
    async def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a pending or running task.
        
        Args:
            task_id: The ID of the task to cancel
            
        Returns:
            True if task was cancelled, False otherwise
        """
        if task_id in self.tasks:
            task = self.tasks[task_id]
            if task['status'] in [TaskStatus.PENDING.value, TaskStatus.RUNNING.value]:
                task['status'] = TaskStatus.CANCELLED.value
                logger.info(f"Task {task_id} cancelled")
                return True
        return False
    
    def cleanup_old_tasks(self, max_age_seconds: int = 3600):
        """
        Remove old completed/failed tasks from memory.
        
        Args:
            max_age_seconds: Maximum age of tasks to keep
        """
        current_time = asyncio.get_event_loop().time()
        tasks_to_remove = []
        
        for task_id, task in self.tasks.items():
            if task['status'] in [TaskStatus.COMPLETED.value, TaskStatus.FAILED.value]:
                task_age = current_time - task.get('created_at', current_time)
                if task_age > max_age_seconds:
                    tasks_to_remove.append(task_id)
        
        for task_id in tasks_to_remove:
            del self.tasks[task_id]
        
        if tasks_to_remove:
            logger.info(f"Cleaned up {len(tasks_to_remove)} old tasks")


class CeleryTaskQueue(TaskQueue):
    """
    Celery-based task queue implementation.
    
    This is a placeholder for future Celery integration.
    When ready to scale, implement this class with Celery.
    """
    
    def __init__(self, broker_url: str = None, backend_url: str = None):
        """
        Initialize Celery task queue.
        
        Args:
            broker_url: Celery broker URL (e.g., Redis, RabbitMQ)
            backend_url: Celery result backend URL
        """
        super().__init__()
        # TODO: Initialize Celery app
        # self.celery_app = Celery(
        #     'eleva',
        #     broker=broker_url or settings.CELERY_BROKER_URL,
        #     backend=backend_url or settings.CELERY_BACKEND_URL
        # )
    
    async def enqueue(
        self,
        task_type: TaskType,
        task_func: Callable,
        task_id: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Enqueue a task using Celery.
        
        This would send the task to the Celery broker for processing
        by worker processes.
        """
        # TODO: Implement Celery task enqueueing
        # result = self.celery_app.send_task(
        #     f'app.tasks.{task_type.value}',
        #     kwargs=kwargs,
        #     task_id=task_id
        # )
        # return result.id
        return await super().enqueue(task_type, task_func, task_id, **kwargs)


class RedisTaskQueue(TaskQueue):
    """
    Redis-based task queue implementation using RQ (Redis Queue).
    
    This provides a simpler alternative to Celery for background
    task processing with Redis as the broker.
    """
    
    def __init__(self, redis_url: str = None):
        """
        Initialize Redis Queue.
        
        Args:
            redis_url: Redis connection URL
        """
        super().__init__()
        # TODO: Initialize Redis and RQ
        # import redis
        # from rq import Queue
        # self.redis_conn = redis.from_url(redis_url or settings.REDIS_URL)
        # self.queue = Queue(connection=self.redis_conn)
    
    async def enqueue(
        self,
        task_type: TaskType,
        task_func: Callable,
        task_id: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Enqueue a task using Redis Queue.
        """
        # TODO: Implement RQ task enqueueing
        # job = self.queue.enqueue(
        #     task_func,
        #     job_id=task_id,
        #     **kwargs
        # )
        # return job.id
        return await super().enqueue(task_type, task_func, task_id, **kwargs)


# Global task queue instance
_task_queue: Optional[TaskQueue] = None


def get_task_queue() -> TaskQueue:
    """
    Get or create the global task queue instance.
    
    This function returns the appropriate task queue implementation
    based on the application configuration.
    
    Returns:
        The task queue instance
    """
    global _task_queue
    
    if _task_queue is None:
        # Choose implementation based on configuration
        # For now, use the simple in-memory implementation
        _task_queue = TaskQueue()
        
        # In production, you would choose based on settings:
        # if settings.USE_CELERY:
        #     _task_queue = CeleryTaskQueue()
        # elif settings.USE_REDIS_QUEUE:
        #     _task_queue = RedisTaskQueue()
        # else:
        #     _task_queue = TaskQueue()
        
        logger.info(f"Initialized task queue: {type(_task_queue).__name__}")
    
    return _task_queue


async def process_document_task(
    document_id: UUID,
    file_content: bytes,
    filename: str,
    mime_type: str,
    chunking_config: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Task function for processing a document.
    
    This is the actual task that gets executed in the background.
    It's separated from the background function to make it reusable
    across different task queue implementations.
    
    Args:
        document_id: The UUID of the document to process
        file_content: The raw file content
        filename: Original filename
        mime_type: MIME type of the file
        chunking_config: Configuration for text chunking
        
    Returns:
        Processing results dictionary
    """
    from app.db.session import AsyncSessionLocal
    from app.services.document_parser import document_parser
    from app.services.text_chunker import text_chunker
    from app.services.embedding_service import get_embedding_service
    from app.crud.document import document_crud, document_chunk_crud
    from app.models.document import ProcessingStatus
    from datetime import datetime, timezone
    
    results = {
        'document_id': str(document_id),
        'success': False,
        'chunks_created': 0,
        'embeddings_created': 0,
        'error': None
    }
    
    async with AsyncSessionLocal() as db:
        try:
            # Get document
            document = await document_crud.get(db, document_id)
            if not document:
                results['error'] = 'Document not found'
                return results
            
            # Parse document
            document.processing_status = ProcessingStatus.PARSING
            document.processing_started_at = datetime.now(timezone.utc)
            await db.commit()
            
            text, metadata = await document_parser.parse_document(
                file_content=file_content,
                filename=filename,
                mime_type=mime_type
            )
            
            document.metadata = {**(document.metadata or {}), **metadata}
            await db.commit()
            
            # Chunk text
            document.processing_status = ProcessingStatus.CHUNKING
            await db.commit()
            
            chunks = text_chunker.chunk_text(
                text=text,
                strategy=chunking_config.get('strategy', 'sentence'),
                chunk_size=chunking_config.get('chunk_size', 1000),
                chunk_overlap=chunking_config.get('chunk_overlap', 200)
            )
            
            chunk_dicts = [chunk.to_dict() for chunk in chunks]
            db_chunks = await document_chunk_crud.create_batch(
                db=db,
                document_id=document_id,
                chunks=chunk_dicts
            )
            results['chunks_created'] = len(db_chunks)
            
            # Generate embeddings
            document.processing_status = ProcessingStatus.EMBEDDING
            await db.commit()
            
            embedding_service = get_embedding_service()
            embedding_results = await embedding_service.embed_document_chunks(
                db=db,
                document=document,
                chunks=db_chunks
            )
            
            results['embeddings_created'] = embedding_results['processed_chunks']
            results['success'] = embedding_results['success']
            
            if not embedding_results['success']:
                results['error'] = f"Failed to embed {embedding_results['failed_chunks']} chunks"
            
            return results
            
        except Exception as e:
            logger.error(f"Error processing document {document_id}: {e}")
            results['error'] = str(e)
            
            # Update document status
            try:
                if document:
                    document.processing_status = ProcessingStatus.FAILED
                    document.processing_error = str(e)
                    document.processing_completed_at = datetime.now(timezone.utc)
                    await db.commit()
            except:
                pass
            
            return results


async def cleanup_task_queue():
    """
    Cleanup old tasks from the queue.
    
    This should be called periodically to prevent memory buildup
    in the in-memory task queue implementation.
    """
    queue = get_task_queue()
    queue.cleanup_old_tasks(max_age_seconds=3600)  # Keep tasks for 1 hour
    logger.info("Task queue cleanup completed")