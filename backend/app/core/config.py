"""
Application-wide settings management.

This module centralizes all the application's configurations.
It uses pydantic-settings to load settings from environment variables
and/or a .env file, providing type validation and a single source of truth for configuration values.
"""

from pydantic_settings import BaseSettings
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
import os

class Settings(BaseSettings):
    """
    Main application settings class.

    This class holds all configuration variables for the Eléva application.
    It inherits from Pydantic's BaseSettings, which automatically reads
    values from environment variables or a specified .env file.

    Attributes:
    TODO add new embedding attributes
        PROJECT_NAME (str): The name of the project.
        VERSION (str): The current version of the application.
        API_V1_STR (str): The prefix for the v1 API routes.

        SECRET_KEY (str): A secret key for signing security tokens (e.g., JWTs).
                          Should be a long, random, and securely stored string.
        ALGORITHM (str): The algorithm used for signing JWTs.
        ACCESS_TOKEN_EXPIRE_MINUTES (int): The lifespan of an access token in minutes.
        REFRESH_TOKEN_EXPIRE_DAYS (int): The lifespan of a refresh token in days.

        DATABASE_URL (str): The connection string for the primary PostgreSQL database.

        BACKEND_CORS_ORIGINS (List[AnyHttpUrl]): A list of allowed origins for CORS.
                                               Can be provided as a comma-separated string
                                               in the environment variable.

        SMTP_HOST (str): The hostname for the SMTP server for sending emails.
        SMTP_PORT (int): The port for the SMTP server.
        SMTP_USER (str): The username for SMTP authentication.
        SMTP_PASSWORD (str): The password for SMTP authentication.

        AWS_ACCESS_KEY_ID (str): The access key for the AWS account.
        AWS_SECRET_ACCESS_KEY (str): The secret access key for the AWS account.
        AWS_BUCKET_NAME (str): The name of the S3 bucket for file storage.
        AWS_REGION (str): The AWS region where the bucket is located.
    """
    PROJECT_NAME: str = "Eléva"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Security settings for JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database connection
    DATABASE_URL: str

    # CORS (Cross-Origin Resource Sharing)
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        """
        Allow parsing a comma-separated string of origins from environment variables.

        This validator runs before Pydantic's own validation, allowing the
        BACKEND_CORS_ORIGINS environment variable to be a simple string
        like "http://localhost:5173,http://127.0.0.1:5173" instead of a
        JSON-formatted list.

        Args:
            v (Union[str, List[str]]): The raw value from the environment variable.

        Raises:
            ValueError: If the input is not a string or a list.

        Returns:
            Union[List[str], str]: A list of origin strings, or the original
                                   value if it was already a list.
        """
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            # If it's a list or a JSON-formatted string, Pydantic will handle it
            return v
        raise ValueError(v)

    # Email settings for password recovery, etc.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    # AWS S3 settings for file uploads (e.g., profile pictures, documents)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_BUCKET_NAME: str = ""
    AWS_REGION: str = "us-east-1"

    # OpenAI settings for embeddings
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536
    
    # Document processing settings
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_FILE_TYPES: List[str] = [
        "application/pdf",
        "text/plain", 
        "text/markdown",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    CHUNKING_STRATEGY: str = "sentence"  # fixed_size, sentence, paragraph

    class Config:
        """Pydantic model configuration."""
        # Specifies the .env file to load environment variables from
        env_file = ".env"
        # Ensures that environment variable names match the field names case-sensitively
        case_sensitive = True

# Instantiate the settings object to be used throughout the application
settings = Settings()