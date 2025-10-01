"""Utilities for retrieving relevant document context via vector search."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.document import document_chunk_crud
from app.models.document import Document, ProcessingStatus
from app.services.embedding_service import EmbeddingService, get_embedding_service

logger = logging.getLogger(__name__)


class DocumentRetrievalError(Exception):
    """Raised when relevant document context cannot be retrieved."""


@dataclass
class RetrievedChunk:
    """Lightweight representation of a retrieved chunk and its score."""

    chunk_id: int
    chunk_index: int
    text: str
    score: float


class DocumentRetrievalService:
    """Fetch document chunks ranked by semantic similarity to a query."""

    def __init__(self, *, embedding_service: Optional[EmbeddingService] = None) -> None:
        self._embedding_service = embedding_service or get_embedding_service()

    async def top_chunks(
        self,
        *,
        db: AsyncSession,
        document: Document,
        query: str,
        limit: int,
    ) -> List[RetrievedChunk]:
        """Return the most relevant chunks for a given query."""

        if document.processing_status != ProcessingStatus.COMPLETED:
            raise DocumentRetrievalError("Document is not ready for semantic search.")

        normalized_query = query.strip()
        if not normalized_query:
            raise DocumentRetrievalError("Query cannot be empty when retrieving context.")

        effective_limit = max(1, limit)

        try:
            query_embedding = await self._embedding_service.get_embedding_for_text(normalized_query)
        except Exception as exc:  # pragma: no cover - defensive guard for provider failures
            logger.error("Failed to generate embedding for query: %s", exc)
            raise DocumentRetrievalError("Unable to generate embeddings for the provided query.") from exc

        raw_results = await document_chunk_crud.search_similar_chunks(
            db=db,
            document_id=document.id,
            query_embedding=query_embedding,
            limit=effective_limit * 3,  # fetch extras to account for empty chunks
        )

        chunks: List[RetrievedChunk] = []
        for chunk, distance in raw_results:
            text = (chunk.chunk_text or "").strip()
            if not text:
                continue

            try:
                similarity = max(0.0, 1.0 - float(distance))
            except (TypeError, ValueError):  # pragma: no cover - defensive guard
                similarity = 0.0

            chunks.append(
                RetrievedChunk(
                    chunk_id=chunk.id,
                    chunk_index=chunk.chunk_index,
                    text=text,
                    score=similarity,
                )
            )

            if len(chunks) >= effective_limit:
                break

        if not chunks:
            raise DocumentRetrievalError("No relevant context could be found for this question.")

        return chunks


__all__ = ["DocumentRetrievalError", "DocumentRetrievalService", "RetrievedChunk"]
