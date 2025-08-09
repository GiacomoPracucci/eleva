# SQLAlchemy Async Migration Guide

A concise guide covering key concepts and common pitfalls when migrating from synchronous to asynchronous SQLAlchemy.

## 📚 Table of Contents
- [Lazy Loading in Async Context](#lazy-loading-in-async-context)
- [Session Configuration Explained](#session-configuration-explained)
- [Type Hints for Async Generators](#type-hints-for-async-generators)
- [Result Object Methods](#result-object-methods)
- [When to Use Await](#when-to-use-await)

---

## 🔄 Lazy Loading in Async Context

### The Problem
Lazy loading doesn't work automatically in async SQLAlchemy. Accessing relationships without pre-loading causes errors.

```python
# ❌ BROKEN in async
user = await get_user(db, user_id=1)
subjects = user.subjects  # Error! Can't lazy load in async

# ✅ SOLUTION: Eager loading
from sqlalchemy.orm import selectinload

result = await db.execute(
    select(User)
    .filter(User.id == 1)
    .options(selectinload(User.subjects))  # Pre-load relationships
)
user = result.scalar_one()
subjects = user.subjects  # Works! Already loaded
```

### Loading Strategies
- **selectinload**: Best for one-to-many (separate query with IN clause)
- **joinedload**: Single query with JOIN
- **Separate queries**: Explicit control, best for complex cases

### N+1 Problem Prevention
```python
# ❌ BAD: N+1 queries
users = await get_all_users()
for user in users:
    count = len(user.subjects)  # Would trigger query per user

# ✅ GOOD: Single query
result = await db.execute(
    select(User).options(selectinload(User.subjects))
)
```

---

## ⚙️ Session Configuration Explained

### Key Parameters and Why

```python
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Objects remain usable after commit
    autocommit=False,        # Explicit transaction control
    autoflush=False          # No automatic flushes before queries
)
```

| Parameter | Value | Why |
|-----------|-------|-----|
| **autocommit** | False | Enables transaction rollback, explicit control |
| **autoflush** | False | Prevents unexpected async flush issues |
| **expire_on_commit** | False | Objects stay valid after commit (can't lazy-load in async) |

### Engine Configuration
```python
engine = create_async_engine(
    DATABASE_URL,
    pool_size=10,        # Permanent connections
    max_overflow=20,     # Extra connections under load
    pool_pre_ping=True   # Test connections before use
)
```

---

## 📝 Type Hints for Async Generators

### The Issue
Functions using `yield` become generators, requiring specific type hints.

```python
# ❌ WRONG
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session  # This is a generator!

# ✅ CORRECT
from typing import AsyncGenerator

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
```

**AsyncGenerator[YieldType, SendType]**:
- First param: What's yielded (AsyncSession)
- Second param: What can be sent (None in our case)

---

## 📊 Result Object Methods

In async SQLAlchemy, queries return a `Result` object that needs extraction.

### Common Extraction Methods

```python
# Execute returns Result object
result = await db.execute(select(User).filter(User.email == email))

# Extract single object or None
user = result.scalar_one_or_none()  # Most common! Like .first()

# Extract single object (must exist)
user = result.scalar_one()  # Raises if not found

# Extract list of objects
users = result.scalars().all()  # List[User]

# For specific columns
result = await db.execute(select(User.email, User.username))
rows = result.all()  # List[Row], not scalar!
```

### Quick Reference

| Method | Returns | Use Case |
|--------|---------|----------|
| `scalar_one_or_none()` | Object or None | Single optional record |
| `scalar_one()` | Object | Must exist, errors if not |
| `scalars().all()` | List[Object] | Multiple complete objects |
| `all()` | List[Row] | Multiple rows, specific columns |
| `scalar()` | Value or None | Single value (COUNT, SUM) |

---

## ⏳ When to Use Await

### Simple Rule: I/O = await, Memory = no await

#### ✅ **Operations Requiring Await** (I/O)
```python
# Database communication
result = await db.execute(select(User))  # Runs SQL query
await db.commit()                        # Writes to database
await db.rollback()                      # Cancels transaction
await db.refresh(user)                   # Reloads from database
await db.flush()                         # Syncs without commit
await db.close()                         # Closes connection
```

#### ❌ **Operations NOT Requiring Await** (Memory only)
```python
# Session tracking only
db.add(user)        # Just marks for saving
db.delete(user)     # Just marks for deletion
db.expunge(user)    # Removes from tracking
setattr(user, ...)  # Python object modification
```

### Common Mistake
```python
# ❌ WRONG
await db.add(user)  # add() is not async!

# ✅ CORRECT
db.add(user)        # No await
await db.commit()   # Await here
```

### Complete Example
```python
async def create_user(db: AsyncSession, name: str):
    user = User(name=name)  # Python object (memory)
    db.add(user)            # Track for saving (memory)
    await db.commit()       # Save to database (I/O)
    await db.refresh(user)  # Load generated fields (I/O)
    return user
```

---

## 🚀 Migration Checklist

1. **Install dependencies**: `sqlalchemy[asyncio]`, `asyncpg`, `greenlet`
2. **Update database URL**: `postgresql://` → `postgresql+asyncpg://`
3. **Add AsyncAttrs to Base**: Enables async relationship handling
4. **Convert all CRUD methods**: Add `async`, use `await` for I/O
5. **Update API endpoints**: Make all handlers `async`
6. **Fix type hints**: Use `AsyncGenerator` for dependency injection
7. **Handle relationships**: Use eager loading strategies

## 💡 Key Takeaways

- **Explicit is better**: Async SQLAlchemy requires explicit loading strategies
- **Two-step queries**: Execute returns Result, then extract data
- **Await only I/O**: Memory operations don't need await
- **Plan relationships**: Can't rely on automatic lazy loading
- **Type correctly**: Generators need proper type hints

---

*Remember: The async migration trades some convenience for significant performance gains under load!*