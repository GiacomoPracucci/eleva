import os
import asyncio
import httpx
import logging
from typing import List, Optional
from enum import Enum

from openai import (
    AsyncOpenAI,
    RateLimitError as OpenAIRateLimitError,
    APIError as OpenAIAPIError,
)
from openai.types.chat import ChatCompletion
from openai.types import CreateEmbeddingResponse
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from app.services.api_providers.base_client import BaseApiProviderClient
from app.services.api_providers.exceptions import APIError, RateLimitError, ConfigError
from app.services.api_providers.models import CompletionResult, EmbeddingResult


logger = logging.getLogger(__name__)


class GPTModel(Enum):
    """Supported OpenAI GPT models for completions."""

    GPT_4O = "gpt-4o"
    GPT_4O_MINI = "gpt-4o-mini"
    GPT_4_TURBO = "gpt-4-turbo"


class OpenAIEmbeddingModel(Enum):
    """Supported OpenAI models for embeddings."""

    TEXT_EMBEDDING_3_SMALL = "text-embedding-3-small"
    TEXT_EMBEDDING_3_LARGE = "text-embedding-3-large"
    TEXT_EMBEDDING_ADA_002 = "text-embedding-ada-002"


class OpenAIClient(BaseApiProviderClient):
    """
    Async client for OpenAI API interactions, aligned with the base provider interface.

    This class handles authentication and communication with the OpenAI API.
    It is designed to be stateless regarding request parameters, which are
    provided on a per-call basis.
    """

    # maximum inputs per embedding request (OpenAI limit)
    MAX_EMBEDDING_INPUTS_PER_REQUEST = 2048

    def __init__(
        self,
        api_key: Optional[str] = None,
        max_concurrent_requests: int = 10,
        timeout: float = 60.0,
    ):
        """
        Initialize the OpenAI async client.

        This constructor sets up the connection to the OpenAI API using the provided API key.

        Args:
            api_key: Your OpenAI API key. If None, it is read from the `OPENAI_API_KEY`
                     environment variable.
            max_concurrent_requests: Max parallel requests allowed to the API.
            timeout: Default request timeout in seconds.

        Raises:
            ConfigError: If the OpenAI API key is not provided or found in the environment.
        """
        super().__init__(
            max_concurrent_requests=max_concurrent_requests, timeout=timeout
        )

        effective_api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not effective_api_key:
            raise ConfigError(
                "OpenAI API key not provided. Pass it as an argument or set the "
                "OPENAI_API_KEY environment variable."
            )

        self.client = AsyncOpenAI(
            api_key=effective_api_key,
            timeout=httpx.Timeout(self.timeout),
        )

        self._semaphore = asyncio.Semaphore(self.max_concurrent_requests)

        logger.info("OpenAI client configured successfully.")

    # ===== Completion Methods =====

    async def get_completion(
        self,
        model: str,
        prompt: str,
        system_message: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> CompletionResult:
        """
        Get a single completion from the OpenAI API.

        Args:
            model: The identifier of the OpenAI model to use (e.g., "gpt-4o").
            prompt: The user's input prompt.
            system_message: An optional instruction for the model to follow.
            temperature: Controls the randomness of the output.
            max_tokens: The maximum number of tokens to generate.
            **kwargs: Additional provider-specific parameters (e.g., `top_p`, `seed`).

        Returns:
            A CompletionResult object with the generated content and metadata.
        """
        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        messages.append({"role": "user", "content": prompt})

        # Build the API parameters
        api_params = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            **kwargs,  # Merge any other provider-specific arguments
        }
        if max_tokens is not None:
            api_params["max_tokens"] = max_tokens

        logger.debug(
            f"Requesting OpenAI completion for model '{model}' with prompt: {prompt[:100]}..."
        )

        response = await self._make_completion_api_call(api_params)

        # parse the response into the standardized format
        choice = response.choices[0]
        return CompletionResult(
            content=choice.message.content,
            model=response.model,
            usage=response.usage.model_dump() if response.usage else {},
            finish_reason=choice.finish_reason,
        )

    async def get_completions_batch(
        self,
        model: str,
        prompts: List[str],
        system_message: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> List[CompletionResult]:
        """
        Get completions for multiple prompts concurrently from OpenAI.

        Args:
            model: The OpenAI model identifier to use for all completions.
            prompts: A list of user input prompts.
            system_message: An optional instruction to apply to all prompts.
            temperature: The temperature to use for all completions.
            max_tokens: The maximum tokens to generate for each completion.
            **kwargs: Additional provider-specific parameters.

        Returns:
            A list of CompletionResult objects in the same order as the input prompts.
        """
        logger.debug(f"Processing batch of {len(prompts)} prompts for model '{model}'")

        tasks = [
            self.get_completion(
                model=model,
                prompt=p,
                system_message=system_message,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs,
            )
            for p in prompts
        ]

        try:
            results = await asyncio.gather(*tasks)
            logger.info(
                f"Successfully processed {len(results)} completions from OpenAI."
            )
            return results
        except Exception as e:
            logger.error(f"Error in OpenAI batch completion processing: {e}")
            raise

    # ===== Embedding Methods =====

    async def get_embedding(self, text: str, model: str, **kwargs) -> EmbeddingResult:
        """
        Get embedding for a single text string from the OpenAI API.

        Args:
            text: The input text to embed.
            model: The identifier of the embedding model (e.g., "text-embedding-3-small").
            **kwargs: Additional provider-specific parameters (e.g., `dimensions`).

        Returns:
            An EmbeddingResult object with the embedding vector and metadata.
        """
        api_params = {"input": [text], "model": model, **kwargs}

        logger.debug(f"Requesting OpenAI embedding for model '{model}'...")

        try:
            async with self._semaphore:
                response = await self.client.embeddings.create(**api_params)
        except OpenAIRateLimitError as e:
            raise RateLimitError(f"OpenAI rate limit exceeded: {e}") from e
        except OpenAIAPIError as e:
            raise APIError(f"OpenAI API error: {e}") from e

        embedding_data = response.data[0]
        return EmbeddingResult(
            embedding=embedding_data.embedding,
            model=response.model,
            usage=response.usage.model_dump() if response.usage else {},
            index=embedding_data.index,
        )

    async def get_embeddings_batch(
        self,
        texts: List[str],
        model: str,
        batch_size: int = 2048,  # Default to OpenAI's max batch size
        **kwargs,
    ) -> List[EmbeddingResult]:
        """
        Get embeddings for multiple texts, with automatic batching for the OpenAI API.

        Args:
            texts: A list of texts to embed.
            model: The identifier of the embedding model to use.
            batch_size: The number of texts to send in each parallel request.
            **kwargs: Additional provider-specific parameters (e.g., `dimensions`).

        Returns:
            A list of EmbeddingResult objects in the same order as input texts.
        """
        if not texts:
            return []

        # OpenAI has a hard limit, so we respect the smaller of the two
        effective_batch_size = min(batch_size, self.MAX_EMBEDDING_INPUTS_PER_REQUEST)

        logger.debug(
            f"Processing {len(texts)} texts for OpenAI embeddings in batches of {effective_batch_size}"
        )

        tasks = []
        for i in range(0, len(texts), effective_batch_size):
            batch = texts[i : i + effective_batch_size]
            # Create a task to process one batch of texts
            task = self._process_embedding_batch(batch, model, i, **kwargs)
            tasks.append(task)

        try:
            batch_results = await asyncio.gather(*tasks)

            all_results = [item for sublist in batch_results for item in sublist]
            all_results.sort(key=lambda x: x.index)  # Ensure original order is restored

            logger.info(
                f"Successfully processed {len(all_results)} embeddings from OpenAI."
            )
            return all_results

        except Exception as e:
            logger.error(f"Error in OpenAI batch embedding processing: {e}")
            raise

    async def _process_embedding_batch(
        self, texts: List[str], model: str, start_index: int, **kwargs
    ) -> List[EmbeddingResult]:
        """Processes a single batch of texts for OpenAI embeddings."""
        api_params = {"input": texts, "model": model, **kwargs}

        try:
            async with self._semaphore:
                response = await self.client.embeddings.create(**api_params)
        except OpenAIRateLimitError as e:
            raise RateLimitError(f"OpenAI rate limit exceeded: {e}") from e
        except OpenAIAPIError as e:
            raise APIError(f"OpenAI API error: {e}") from e

        results = []
        for i, data in enumerate(response.data):
            results.append(
                EmbeddingResult(
                    embedding=data.embedding,
                    model=response.model,
                    usage=response.usage.model_dump() if response.usage else {},
                    index=start_index + i,  # Use global index for correct sorting later
                )
            )
        return results

    # ===== Private API Call Methods =====

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),
        reraise=True,
    )
    async def _make_completion_api_call(self, api_params: dict) -> ChatCompletion:
        """
        Makes a single chat completion API call to OpenAI with retry logic.

        This private helper centralizes the raw API call, semaphore usage, and error mapping.

        Args:
            api_params: A dictionary of parameters to pass to the `create` method.

        Returns:
            The raw ChatCompletion response from OpenAI.

        Raises:
            RateLimitError: If rate limits are exceeded.
            APIError: For other API-related errors.
        """
        try:
            async with self._semaphore:
                return await self.client.chat.completions.create(**api_params)
        except OpenAIRateLimitError as e:
            raise RateLimitError(f"OpenAI rate limit exceeded: {e}") from e
        except OpenAIAPIError as e:
            raise APIError(f"OpenAI API error: {e}") from e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),
        reraise=True,
    )
    async def _make_embedding_api_call(
        self, api_params: dict
    ) -> CreateEmbeddingResponse:
        """
        Makes a single embedding API call to OpenAI with retry logic.

        Args:
            api_params: A dictionary of parameters to pass to the `create` method.

        Returns:
            The raw CreateEmbeddingResponse from OpenAI.

        Raises:
            RateLimitError: If rate limits are exceeded.
            APIError: For other API-related errors.
        """
        try:
            async with self._semaphore:
                return await self.client.embeddings.create(**api_params)
        except OpenAIRateLimitError as e:
            raise RateLimitError(f"OpenAI embedding rate limit exceeded: {e}") from e
        except OpenAIAPIError as e:
            raise APIError(f"OpenAI embedding API error: {e}") from e

    async def close(self):
        """
        Closes the underlying httpx client session.

        This should be called when the client is no longer needed to release
        network resources properly.
        """
        await self.client.close()
        logger.info("OpenAI async client closed and resources released.")