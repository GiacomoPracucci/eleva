from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, DateTime
from sqlalchemy.ext.asyncio import AsyncAttrs
from datetime import datetime, timezone

"""
Configures the declarative base for asynchronous SQLAlchemy operations.

The `AsyncAttrs` class enables the asynchronous loading of attributes and
relationships that are configured for "lazy loading". In an asyncio
application, any database I/O must be non-blocking. `AsyncAttrs` provides
the `.awaitable_attrs` interface on model instances, allowing attributes
to be loaded on-demand using `await`, thus preventing the event loop
from being blocked by synchronous database calls.

Usage:
    user_addresses = await user.awaitable_attrs.addresses
"""
Base = declarative_base(cls=AsyncAttrs)

class TimestampMixin:
    """
    A mixin that adds `created_at` and `updated_at` timestamp columns.

    - `created_at`: Automatically set to the current UTC time when a record
      is first created.
    - `updated_at`: Automatically set to the current UTC time whenever a
      record is updated.

    **Note on `lambda` usage**:
    The `default` and `onupdate` parameters are passed a `lambda` function
    to ensure `datetime.now()` is called at the moment of the database
    event (insertion or update), not when the application starts.

    Passing the function itself (`lambda: ...`) defers its execution,
    whereas passing a direct call (`datetime.now()`) would capture
    the timestamp only once, when the model class is first defined,
    and reuse that same value for all subsequent records.
    """
    created_at = Column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc), 
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc), 
        onupdate=lambda: datetime.now(timezone.utc), 
        nullable=False
    )