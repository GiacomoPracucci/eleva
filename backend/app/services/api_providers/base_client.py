import logging
from abc import ABC, abstractmethod
from typing import List, Optional, AsyncContextManager
from app.services.api_providers.models import CompletionResult, EmbeddingResult

logger = logging.getLogger(__name__)


class BaseApiProviderClient(AsyncContextManager):
    """
    Abstract base class for API client implementations.
    
    This class defines a common, stateless interface that all API provider clients 
    must implement. It ensures consistency across different providers (e.g., OpenAI, 
    Google Gemini) for core functionalities like completions and embeddings.
    
    Features:
        - Abstract methods for core LLM and embedding operations.
        - Async support with context manager for proper resource handling.
        - A clean, stateless design where configuration is passed per-request.
    """

    def __init__(
        self,
        max_concurrent_requests: int = 10,
        timeout: float = 60.0
    ):
        """
        Initialize the base API client.
        
        Args:
            max_concurrent_requests: Maximum number of concurrent API requests.
            timeout: Default request timeout in seconds.
        """
        self.max_concurrent_requests = max_concurrent_requests
        self.timeout = timeout
        
        logger.info(
            f"Initializing API provider client with max_concurrent_requests: {max_concurrent_requests}"
        )

    @abstractmethod
    async def get_completion(
        self,
        model: str,
        prompt: str,
        system_message: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> CompletionResult:
        """
        Get a single completion from a large language model.
        
        This is a core method that must be implemented by all providers. It should
        handle the provider-specific API call and return a standardized response.
        
        Args:
            model: The identifier of the model to use for the completion.
            prompt: The user's input prompt.
            system_message: An optional instruction for the model to follow.
            temperature: Controls the randomness of the output (e.g., 0.2 for factual).
            max_tokens: The maximum number of tokens to generate.
            **kwargs: Provider-specific parameters (e.g., `top_p`, `seed`, `stop_sequences`).
            
        Returns:
            A CompletionResult object with the generated content and metadata.
            
        Raises:
            APIError: If the provider's API returns an error.
            RateLimitError: If the provider's rate limits are exceeded.
            ConfigError: If the provided configuration is invalid.
        """
        pass

    @abstractmethod
    async def get_completions_batch(
        self,
        model: str,
        prompts: List[str],
        system_message: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> List[CompletionResult]:
        """
        Get completions for multiple prompts concurrently.
        
        Implementations should optimize for parallel processing while respecting
        the provider's rate limits and concurrency constraints.
        
        Args:
            model: The identifier of the model to use for all completions in the batch.
            prompts: A list of user input prompts.
            system_message: An optional instruction to apply to all prompts.
            temperature: The temperature to use for all completions.
            max_tokens: The maximum tokens to generate for each completion.
            **kwargs: Provider-specific parameters to apply to all requests in the batch.
            
        Returns:
            A list of CompletionResult objects, in the same order as the input prompts.
        """
        pass
        
    @abstractmethod
    async def get_embedding(
        self,
        text: str,
        model: str,
        **kwargs
    ) -> EmbeddingResult:
        """
        Generate an embedding for a single text string.
        
        This is the core embedding method that must be implemented by all providers.
        
        Args:
            text: The input text to embed.
            model: The identifier of the embedding model to use.
            **kwargs: Provider-specific parameters (e.g., `dimensions`).
            
        Returns:
            An EmbeddingResult object with the embedding vector and metadata.
            
        Raises:
            APIError: If the provider's API returns an error.
            RateLimitError: If the provider's rate limits are exceeded.
        """
        pass

    @abstractmethod
    async def get_embeddings_batch(
        self,
        texts: List[str],
        model: str,
        **kwargs
    ) -> List[EmbeddingResult]:
        """
        Generate embeddings for multiple texts concurrently.
        
        Implementations should optimize for parallel processing, respecting provider-specific
        batch size limits and other constraints.
        
        Args:
            texts: A list of input texts to embed.
            model: The identifier of the embedding model to use for the batch.
            **kwargs: Provider-specific parameters to apply to the batch request.
            
        Returns:
            A list of EmbeddingResult objects, in the same order as the input texts.
        """
        pass
    
    @abstractmethod
    async def close(self):
        """
        Close the client and clean up any underlying resources.
        
        Implementations should properly close network connections or sessions.
        """
        pass
    
    async def __aenter__(self):
        """Enter the async context manager."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Exit the async context manager, ensuring resources are closed."""
        await self.close()