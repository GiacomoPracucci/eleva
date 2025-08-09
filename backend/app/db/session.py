"""
Database session management for the application.

This module sets up the asynchronous database engine and session factory
using SQLAlchemy.

Attributes:
    engine (sqlalchemy.ext.asyncio.AsyncEngine):
        The main SQLAlchemy engine, configured for asynchronous communication
        with the PostgreSQL database. Key parameters include:
        - echo=True: Logs all generated SQL statements to the console. Useful for
          debugging but should be disabled in production.
        - future=True: Enables SQLAlchemy 2.0 style usage, which is now the
          standard API.
        - pool_pre_ping=True: The connection pool will "ping" the database
          before handing out a connection, preventing errors from stale or
          disconnected connections.
        - pool_size=10: The number of connections to keep open in the pool,
          ready for use.
        - max_overflow=20: The number of additional connections that can be
          temporarily opened beyond `pool_size` to handle peak load. The
          total simultaneous connections can be up to 30 (10 + 20).

    AsyncSessionLocal (sqlalchemy.orm.sessionmaker):
        A factory for creating new `AsyncSession` instances. This ensures all
        sessions share a consistent configuration. Key parameters include:
        - class_=AsyncSession: Specifies the use of SQLAlchemy's asynchronous
          session class.
        - expire_on_commit=False: Prevents SQLAlchemy from expiring object
          instances after a transaction is committed. This allows objects to
          be accessed and used (e.g., in an API response) after they have
          been saved to the database without triggering new SQL queries.
        - autocommit=False: Disables autocommit mode, requiring explicit calls
          to `session.commit()` to save changes. This provides fine-grained
          transactional control.
        - autoflush=False: Disables automatic flushing of pending changes
          before queries. Changes must be manually flushed with `session.flush()`
          or committed with `session.commit()`.
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings
import logging 

logger = logging.getLogger(__name__)

if settings.DATABASE_URL.startswith("postgresql://"):
    logger.warning("The DATABASE_URL provided does not contain ‘asyncpg’. It will be added automatically.")
    settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(
    url=settings.DATABASE_URL,
    echo=True,
    future=True,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)    

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)