from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional
from datetime import datetime


class ApiProvider(Enum):
    """Enumeration of supported LLM providers"""
    OPENAI = "openai"
    GEMINI = "gemini"
    ANTHROPIC = "anthropic"
    COHERE = "cohere"

@dataclass
class CompletionResult:
    """Result from an completion request"""
    content: str
    model: str
    usage: Dict[str, int]
    finish_reason: str

@dataclass
class EmbeddingResult:
    """Result from an embedding request"""
    embedding: List[float]
    model: str
    usage: Dict[str, int]
    index: int = 0