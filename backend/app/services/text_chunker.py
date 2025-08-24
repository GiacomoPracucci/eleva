"""
Text chunking service for splitting documents into manageable segments.

This module provides various strategies for splitting text into chunks
that are suitable for embedding and vector search. Different strategies
are optimized for different types of content and use cases.
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


@dataclass
class TextChunk:
    """
    Represents a single chunk of text with metadata.
    
    This dataclass encapsulates all information about a text chunk,
    including its position in the original document and any additional
    metadata that might be useful for search or display.
    
    Attributes:
        text: The actual text content of the chunk
        index: Position of this chunk in the sequence (0-based)
        start_char: Starting character position in the original text
        end_char: Ending character position in the original text
        metadata: Additional information about the chunk
    """
    text: str
    index: int
    start_char: int
    end_char: int
    metadata: Dict[str, Any]
    
    @property
    def char_count(self) -> int:
        """Get the character count of this chunk."""
        return len(self.text)
    
    @property
    def word_count(self) -> int:
        """Get the approximate word count of this chunk."""
        return len(self.text.split())
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert chunk to dictionary for database storage."""
        return {
            'chunk_text': self.text,
            'chunk_index': self.index,
            'start_char': self.start_char,
            'end_char': self.end_char,
            'metadata': self.metadata
        }


class ChunkingStrategy(ABC):
    """
    Abstract base class for text chunking strategies.
    
    Different strategies can be implemented by subclassing this base class
    and implementing the chunk_text method.
    """
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        """
        Initialize the chunking strategy.
        
        Args:
            chunk_size: Target size for each chunk in characters
            chunk_overlap: Number of characters to overlap between chunks
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        # Validate parameters
        if chunk_size <= 0:
            raise ValueError("Chunk size must be positive")
        if chunk_overlap < 0:
            raise ValueError("Chunk overlap cannot be negative")
        if chunk_overlap >= chunk_size:
            raise ValueError("Chunk overlap must be smaller than chunk size")
    
    @abstractmethod
    def chunk_text(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[TextChunk]:
        """
        Split text into chunks according to the strategy.
        
        Args:
            text: The text to be chunked
            metadata: Optional metadata to be included with chunks
            
        Returns:
            List of TextChunk objects
        """
        pass
    
    def _clean_text(self, text: str) -> str:
        """
        Clean and normalize text before chunking.
        
        Removes excessive whitespace and normalizes line breaks.
        """
        # Replace multiple whitespaces with single space
        text = re.sub(r'\s+', ' ', text)
        # Replace multiple newlines with double newline
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()


class FixedSizeChunking(ChunkingStrategy):
    """
    Simple fixed-size chunking with optional word boundary respect.
    
    This strategy splits text into chunks of approximately equal size,
    optionally breaking at word boundaries to avoid splitting words.
    It's the fastest strategy and works well for most content types.
    """
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200, respect_word_boundaries: bool = True):
        """
        Initialize fixed-size chunking strategy.
        
        Args:
            chunk_size: Target size for each chunk
            chunk_overlap: Overlap between consecutive chunks
            respect_word_boundaries: If True, avoid splitting words
        """
        super().__init__(chunk_size, chunk_overlap)
        self.respect_word_boundaries = respect_word_boundaries
    
    def chunk_text(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[TextChunk]:
        """
        Split text into fixed-size chunks with overlap.
        
        The algorithm creates chunks of approximately chunk_size characters,
        with chunk_overlap characters repeated between consecutive chunks
        for context preservation.
        """
        text = self._clean_text(text)
        if not text:
            return []
        
        chunks = []
        chunk_metadata = metadata or {}
        
        # Calculate stride (how far to move for each new chunk)
        stride = self.chunk_size - self.chunk_overlap
        if stride <= 0:
            stride = self.chunk_size  # No overlap if misconfigured
        
        current_pos = 0
        chunk_index = 0
        
        while current_pos < len(text):
            # Determine chunk boundaries
            chunk_start = current_pos
            chunk_end = min(current_pos + self.chunk_size, len(text))
            
            # Adjust for word boundaries if needed
            if self.respect_word_boundaries and chunk_end < len(text):
                # Try to find a word boundary near the chunk end
                space_pos = text.rfind(' ', chunk_start, chunk_end)
                if space_pos > chunk_start + (self.chunk_size * 0.8):  # Within 80% of target size
                    chunk_end = space_pos
            
            # Extract chunk text
            chunk_text = text[chunk_start:chunk_end].strip()
            
            if chunk_text:  # Only add non-empty chunks
                chunk = TextChunk(
                    text=chunk_text,
                    index=chunk_index,
                    start_char=chunk_start,
                    end_char=chunk_end,
                    metadata={**chunk_metadata, 'strategy': 'fixed_size'}
                )
                chunks.append(chunk)
                chunk_index += 1
            
            # Move to next chunk position
            if chunk_end >= len(text):
                break
            current_pos += stride
        
        logger.info(f"Created {len(chunks)} chunks using fixed-size strategy")
        return chunks


class SentenceChunking(ChunkingStrategy):
    """
    Sentence-based chunking strategy.
    
    This strategy splits text at sentence boundaries, grouping sentences
    together until the chunk size is reached. This preserves semantic
    completeness better than fixed-size chunking.
    """
    
    # Regex pattern for sentence splitting
    SENTENCE_PATTERN = re.compile(r'(?<=[.!?])\s+(?=[A-Z])')
    
    def chunk_text(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[TextChunk]:
        """
        Split text into chunks based on sentence boundaries.
        
        Groups complete sentences together until reaching the target chunk size.
        """
        text = self._clean_text(text)
        if not text:
            return []
        
        # Split into sentences
        sentences = self._split_sentences(text)
        if not sentences:
            # Fallback to fixed-size if no sentences detected
            return FixedSizeChunking(self.chunk_size, self.chunk_overlap).chunk_text(text, metadata)
        
        chunks = []
        chunk_metadata = metadata or {}
        chunk_index = 0
        
        current_chunk = []
        current_size = 0
        current_start = 0
        
        for i, sentence in enumerate(sentences):
            sentence_size = len(sentence)
            
            # Check if adding this sentence would exceed chunk size
            if current_size + sentence_size > self.chunk_size and current_chunk:
                # Create chunk from accumulated sentences
                chunk_text = ' '.join(current_chunk)
                chunk_end = current_start + len(chunk_text)
                
                chunk = TextChunk(
                    text=chunk_text,
                    index=chunk_index,
                    start_char=current_start,
                    end_char=chunk_end,
                    metadata={
                        **chunk_metadata,
                        'strategy': 'sentence',
                        'sentence_count': len(current_chunk)
                    }
                )
                chunks.append(chunk)
                chunk_index += 1
                
                # Handle overlap
                if self.chunk_overlap > 0:
                    # Keep last few sentences for overlap
                    overlap_size = 0
                    overlap_sentences = []
                    for sent in reversed(current_chunk):
                        overlap_size += len(sent)
                        overlap_sentences.insert(0, sent)
                        if overlap_size >= self.chunk_overlap:
                            break
                    current_chunk = overlap_sentences
                    current_size = sum(len(s) for s in current_chunk)
                    current_start = chunk_end - current_size
                else:
                    current_chunk = []
                    current_size = 0
                    current_start = chunk_end
            
            # Add sentence to current chunk
            current_chunk.append(sentence)
            current_size += sentence_size
        
        # Add remaining sentences as final chunk
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            chunk = TextChunk(
                text=chunk_text,
                index=chunk_index,
                start_char=current_start,
                end_char=current_start + len(chunk_text),
                metadata={
                    **chunk_metadata,
                    'strategy': 'sentence',
                    'sentence_count': len(current_chunk)
                }
            )
            chunks.append(chunk)
        
        logger.info(f"Created {len(chunks)} chunks using sentence-based strategy")
        return chunks
    
    def _split_sentences(self, text: str) -> List[str]:
        """
        Split text into sentences using regex and heuristics.
        
        Handles common edge cases like abbreviations and decimals.
        """
        # Basic sentence splitting
        sentences = self.SENTENCE_PATTERN.split(text)
        
        # Filter out empty sentences and clean up
        sentences = [s.strip() for s in sentences if s.strip()]
        
        # Merge sentences that are too short (likely split errors)
        merged = []
        buffer = ""
        for sentence in sentences:
            if len(sentence) < 20 and buffer:  # Likely a split error
                buffer += " " + sentence
            else:
                if buffer:
                    merged.append(buffer)
                buffer = sentence
        if buffer:
            merged.append(buffer)
        
        return merged


class ParagraphChunking(ChunkingStrategy):
    """
    Paragraph-based chunking strategy.
    
    This strategy splits text at paragraph boundaries (double newlines),
    grouping paragraphs together until the chunk size is reached.
    Ideal for well-structured documents.
    """
    
    def chunk_text(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[TextChunk]:
        """
        Split text into chunks based on paragraph boundaries.
        
        Groups complete paragraphs together until reaching the target chunk size.
        """
        # Don't clean text initially to preserve paragraph markers
        if not text:
            return []
        
        # Split into paragraphs (double newline)
        paragraphs = re.split(r'\n\s*\n', text)
        paragraphs = [p.strip() for p in paragraphs if p.strip()]
        
        if not paragraphs:
            # Fallback to sentence chunking if no paragraphs detected
            return SentenceChunking(self.chunk_size, self.chunk_overlap).chunk_text(text, metadata)
        
        chunks = []
        chunk_metadata = metadata or {}
        chunk_index = 0
        
        current_chunk = []
        current_size = 0
        current_start = 0
        
        for paragraph in paragraphs:
            para_size = len(paragraph)
            
            # Check if adding this paragraph would exceed chunk size
            if current_size + para_size > self.chunk_size and current_chunk:
                # Create chunk from accumulated paragraphs
                chunk_text = '\n\n'.join(current_chunk)
                chunk_end = current_start + len(chunk_text)
                
                chunk = TextChunk(
                    text=chunk_text,
                    index=chunk_index,
                    start_char=current_start,
                    end_char=chunk_end,
                    metadata={
                        **chunk_metadata,
                        'strategy': 'paragraph',
                        'paragraph_count': len(current_chunk)
                    }
                )
                chunks.append(chunk)
                chunk_index += 1
                
                # Handle overlap (keep last paragraph if it fits)
                if self.chunk_overlap > 0 and current_chunk:
                    last_para = current_chunk[-1]
                    if len(last_para) <= self.chunk_overlap:
                        current_chunk = [last_para]
                        current_size = len(last_para)
                        current_start = chunk_end - current_size
                    else:
                        current_chunk = []
                        current_size = 0
                        current_start = chunk_end
                else:
                    current_chunk = []
                    current_size = 0
                    current_start = chunk_end
            
            # Add paragraph to current chunk
            current_chunk.append(paragraph)
            current_size += para_size + (4 if current_chunk else 0)  # Account for \n\n
        
        # Add remaining paragraphs as final chunk
        if current_chunk:
            chunk_text = '\n\n'.join(current_chunk)
            chunk = TextChunk(
                text=chunk_text,
                index=chunk_index,
                start_char=current_start,
                end_char=current_start + len(chunk_text),
                metadata={
                    **chunk_metadata,
                    'strategy': 'paragraph',
                    'paragraph_count': len(current_chunk)
                }
            )
            chunks.append(chunk)
        
        logger.info(f"Created {len(chunks)} chunks using paragraph-based strategy")
        return chunks


class TextChunker:
    """
    Main text chunking service that coordinates different strategies.
    
    This class provides a unified interface for text chunking, allowing
    easy switching between different strategies based on content type
    or user preferences.
    """
    
    def __init__(self):
        """Initialize the text chunker with available strategies."""
        self.strategies = {
            'fixed_size': FixedSizeChunking,
            'sentence': SentenceChunking,
            'paragraph': ParagraphChunking,
        }
        
        # Default configuration
        self.default_chunk_size = 1000
        self.default_overlap = 200
    
    def chunk_text(
        self,
        text: str,
        strategy: str = 'fixed_size',
        chunk_size: int = None,
        chunk_overlap: int = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[TextChunk]:
        """
        Chunk text using the specified strategy.
        
        Args:
            text: The text to chunk
            strategy: Name of the chunking strategy to use
            chunk_size: Target size for chunks (uses default if None)
            chunk_overlap: Overlap between chunks (uses default if None)
            metadata: Optional metadata to include with all chunks
            
        Returns:
            List of TextChunk objects
            
        Raises:
            ValueError: If unknown strategy is specified
        """
        if strategy not in self.strategies:
            raise ValueError(f"Unknown chunking strategy: {strategy}")
        
        # Use defaults if not specified
        chunk_size = chunk_size or self.default_chunk_size
        chunk_overlap = chunk_overlap or self.default_overlap
        
        # Create strategy instance
        strategy_class = self.strategies[strategy]
        chunker = strategy_class(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        
        # Perform chunking
        chunks = chunker.chunk_text(text, metadata)
        
        logger.info(
            f"Chunked text into {len(chunks)} chunks using {strategy} strategy "
            f"(size={chunk_size}, overlap={chunk_overlap})"
        )
        
        return chunks
    
    def estimate_chunks(self, text_length: int, chunk_size: int = None, chunk_overlap: int = None) -> int:
        """
        Estimate the number of chunks that will be created.
        
        Useful for progress bars and resource planning.
        
        Args:
            text_length: Length of text in characters
            chunk_size: Target chunk size
            chunk_overlap: Overlap between chunks
            
        Returns:
            Estimated number of chunks
        """
        chunk_size = chunk_size or self.default_chunk_size
        chunk_overlap = chunk_overlap or self.default_overlap
        
        if text_length <= chunk_size:
            return 1
        
        stride = chunk_size - chunk_overlap
        if stride <= 0:
            stride = chunk_size
        
        return ((text_length - chunk_overlap) // stride) + 1


# Create a global chunker instance
text_chunker = TextChunker()