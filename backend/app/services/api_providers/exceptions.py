from typing import Optional, List

class Error(Exception):
    """Base exception for api-related errors"""
    pass


class RateLimitError(Error):
    """Raised when rate limits are hit"""
    pass


class APIError(Error):
    """Raised when API returns an error"""
    pass


class ConfigError(Error):
    """Raised when OpenAI configuration is invalid"""
    pass