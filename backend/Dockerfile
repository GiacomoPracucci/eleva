# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install system dependencies required by psycopg2 and other libraries
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl && \
    rm -rf /var/lib/apt/lists/*

# Install Poetry to handle Python dependencies
ENV POETRY_VERSION=1.8.4
RUN pip install "poetry==${POETRY_VERSION}"

# Copy dependency files first for better cache usage
COPY pyproject.toml poetry.lock ./

# Configure Poetry and install runtime dependencies only
RUN poetry config virtualenvs.create false && \
    poetry install --no-interaction --no-ansi --only main

# Copy application source code
COPY backend /app/backend

WORKDIR /app/backend
ENV PYTHONPATH=/app/backend

# Ensure entrypoint script is executable (in case git permissions are lost)
RUN chmod +x docker/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/backend/docker/entrypoint.sh"]
CMD []
