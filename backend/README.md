# Backend Architecture and Implementation Guide - Eléva

## Overview

This document describes the architectural decisions and implementation patterns used in Eléva's backend. It's designed to help developers understand the underlying logic and design choices before diving into the code.

## Table of Contents

1. [FastAPI - API Framework](#fastapi---api-framework)
2. [SQLAlchemy - ORM and Database](#sqlalchemy---orm-and-database)
3. [JWT Authentication](#jwt-authentication)
4. [Password Security with Bcrypt](#password-security-with-bcrypt)
5. [Pydantic - Data Validation](#pydantic---data-validation)
6. [Alembic - Database Migrations](#alembic---database-migrations)
7. [Dependency Injection Pattern](#dependency-injection-pattern)
8. [CORS Middleware](#cors-middleware)
9. [File Storage with S3](#file-storage-with-s3)
10. [Project Structure Philosophy](#project-structure-philosophy)

---

## FastAPI - API Framework

### Core Concept
FastAPI is a modern Python web framework that automatically generates API documentation and provides type hints support. It's built on Starlette (for web parts) and Pydantic (for data parts).

### Implementation Logic

1. **Automatic Documentation**: By defining endpoints with type hints, FastAPI automatically generates OpenAPI (Swagger) documentation accessible at `/docs`.

2. **Async Support**: While our implementation uses synchronous database operations, FastAPI allows mixing async and sync endpoints. We chose sync for SQLAlchemy compatibility.

3. **Router Organization**: We use FastAPI's router system to modularize endpoints:
   - Each domain (auth, users, subjects) has its own router
   - Routers are combined in a central `api_router`
   - Versioning is built into the URL structure (`/api/v1/`)

4. **Request/Response Cycle**: 
   - Requests are automatically parsed based on type hints
   - Responses are serialized using Pydantic models
   - Validation errors are automatically converted to 422 responses

---

## SQLAlchemy - ORM and Database

### Core Concept
SQLAlchemy is an Object-Relational Mapping (ORM) tool that allows us to work with databases using Python objects instead of SQL queries.

### Implementation Logic

1. **Declarative Mapping**: We use the declarative pattern where:
   - Models inherit from a `Base` class
   - Table structure is defined as class attributes
   - Relationships are explicitly declared

2. **Session Management**: 
   - Each request gets its own database session via dependency injection
   - Sessions are automatically closed after each request
   - This prevents connection leaks and ensures data consistency

3. **Relationship Patterns**:
   - **One-to-Many**: User → Subjects (one user has many subjects)
   - Uses `relationship()` with `back_populates` for bidirectional access
   - Cascade delete ensures subjects are removed when user is deleted

4. **Mixins for Common Fields**:
   - `TimestampMixin` adds `created_at` and `updated_at` to all models
   - Reduces code duplication and ensures consistency

5. **Query Patterns**:
   - Explicit loading (no lazy loading by default)
   - Filtering uses method chaining: `query().filter().first()`
   - Complex queries use SQLAlchemy's `or_` for OR conditions

---

## JWT Authentication

### Core Concept
JSON Web Tokens (JWT) are self-contained tokens that securely transmit information between parties. They consist of three parts: header, payload, and signature.

### Implementation Logic

1. **Dual Token System**:
   - **Access Token**: Short-lived (30 minutes), used for API requests
   - **Refresh Token**: Long-lived (7 days), used to get new access tokens
   - This balances security (short exposure window) with UX (less frequent logins)

2. **Token Structure**:
   ```
   Payload: {
     "sub": user_id,        # Subject (user identifier)
     "exp": timestamp,      # Expiration time
     "type": "access"       # Token type (access/refresh)
   }
   ```

3. **Authentication Flow**:
   - Login → Generate both tokens → Return to client
   - Client stores tokens (localStorage in our case)
   - Each request includes access token in Authorization header
   - On 401 error → Try refresh → Retry request or force re-login

4. **Security Considerations**:
   - Tokens are signed with a secret key (HS256 algorithm)
   - Token validation checks signature AND expiration
   - Different token types prevent refresh tokens being used as access tokens

---

## Password Security with Bcrypt

### Core Concept
Bcrypt is a password hashing function designed to be computationally expensive, making brute-force attacks impractical.

### Implementation Logic

1. **One-Way Hashing**:
   - Passwords are never stored in plain text
   - Bcrypt generates a different hash even for identical passwords (using salt)
   - Verification compares submitted password with stored hash

2. **Automatic Salting**:
   - Bcrypt automatically generates and stores salt with the hash
   - No need to manage salt separately
   - Each password gets a unique salt

3. **Adaptive Cost**:
   - Bcrypt's cost factor can be increased as hardware improves
   - Current implementation uses Passlib's default (typically 12 rounds)

---

## Pydantic - Data Validation

### Core Concept
Pydantic uses Python type annotations to validate data and serialize/deserialize between Python objects and JSON.

### Implementation Logic

1. **Schema Inheritance Pattern**:
   ```
   UserBase → UserCreate → User
           → UserUpdate
           → UserInDB → User
   ```
   - Base schemas define common fields
   - Specialized schemas add/modify fields for specific use cases

2. **Validation Rules**:
   - Field constraints (min_length, regex patterns)
   - Custom validators for complex rules
   - Automatic type conversion where possible

3. **ORM Mode**:
   - `ConfigDict(from_attributes=True)` allows Pydantic to read SQLAlchemy models
   - Enables automatic conversion from ORM objects to API responses

4. **Request/Response Separation**:
   - Different schemas for input (Create/Update) and output (User)
   - Sensitive fields (password) only in input schemas
   - Computed fields (id, timestamps) only in output schemas

---

## Alembic - Database Migrations

### Core Concept
Alembic tracks database schema changes over time, allowing version control for database structure.

### Implementation Logic

1. **Migration Generation**:
   - Compares current models with database state
   - Auto-generates migration scripts for differences
   - Each migration has upgrade() and downgrade() functions

2. **Version Tracking**:
   - Migrations are numbered sequentially
   - Database stores current version in `alembic_version` table
   - Allows rolling back to any previous state

3. **Integration with SQLAlchemy**:
   - Imports all models to ensure complete schema detection
   - Uses same database connection configuration
   - Migrations run before app startup in production

---

## Dependency Injection Pattern

### Core Concept
Dependency injection provides required objects (database sessions, current user) to functions without explicitly passing them.

### Implementation Logic

1. **Database Session Injection**:
   ```python
   def get_db() -> Session:
       # Create session
       yield session
       # Cleanup after request
   ```
   - Sessions are request-scoped
   - Automatic cleanup prevents connection leaks

2. **Authentication Dependencies**:
   - `get_current_user`: Validates token and returns user
   - `get_current_active_user`: Additionally checks if user is active
   - Dependencies can depend on other dependencies (chain)

3. **Benefits**:
   - Testability (easy to mock dependencies)
   - Separation of concerns
   - Reusable validation logic

---

## CORS Middleware

### Core Concept
Cross-Origin Resource Sharing (CORS) controls which domains can access your API from a browser.

### Implementation Logic

1. **Configuration**:
   - Allowed origins from environment variables
   - Supports multiple frontend URLs (dev, staging, prod)
   - Credentials allowed for cookie/auth support

2. **Preflight Handling**:
   - Browser sends OPTIONS request before actual request
   - Middleware responds with allowed methods/headers
   - Actual request proceeds if origin is allowed

---

## File Storage with S3

### Core Concept
Amazon S3 provides scalable object storage. We use it for user profile pictures to avoid storing files on the server.

### Implementation Logic

1. **Upload Flow**:
   - Receive file → Validate type → Process image → Upload to S3 → Store URL

2. **Image Processing**:
   - Resize to max dimensions (500x500)
   - Convert to JPEG for consistency
   - Compress to reduce storage/bandwidth

3. **URL Structure**:
   - Pattern: `profile-pictures/{user_id}/{uuid}.jpg`
   - User ID for organization
   - UUID prevents naming conflicts
   - Public URLs for easy access

4. **Cleanup**:
   - Delete from S3 when user updates/removes picture
   - Fail gracefully if S3 deletion fails

---

## Project Structure Philosophy

### Core Concept
The project follows a layered architecture separating concerns into distinct modules.

### Implementation Logic

1. **Layer Separation**:
   - **Models**: Database structure (SQLAlchemy)
   - **Schemas**: API contracts (Pydantic)
   - **CRUD**: Database operations
   - **API**: HTTP endpoints
   - **Core**: Shared utilities

2. **Benefits**:
   - **Models ≠ Schemas**: Database structure can differ from API
   - **CRUD Abstraction**: Database logic separate from business logic
   - **Testability**: Each layer can be tested independently

3. **Naming Conventions**:
   - Singular for modules (`user.py` not `users.py`)
   - Plural for API endpoints (`/users/`)
   - Clear action verbs in CRUD (`create`, `update`, not `save`)

4. **Dependency Flow**:
   ```
   API Endpoints
        ↓
   CRUD Operations
        ↓
   Database Models
   ```
   - Higher layers depend on lower layers
   - No circular dependencies

---

## Key Design Decisions

1. **Synchronous Database Operations**: Chosen for SQLAlchemy compatibility and simplicity. Can migrate to async SQLAlchemy when needed.

2. **Email/Username Login**: Users can log in with either, improving UX without compromising security.

3. **Soft Features**: `is_active`, `is_archived` flags instead of hard deletes, preserving data integrity.

4. **Privacy by Design**: Privacy settings built into user model from day one.

5. **Prepared for Scale**: Document references in Subject model, vector database consideration in architecture.

---

## Security Best Practices Implemented

1. **Defense in Depth**: Multiple security layers (JWT validation, user active check, ownership verification)

2. **Fail Secure**: Errors default to denying access

3. **Input Validation**: All inputs validated before processing

4. **Sensitive Data**: Passwords never logged or returned in responses

5. **Rate Limiting Ready**: Structure supports adding rate limiting middleware

---

## Next Steps for Developers

1. **Local Setup**: Create `.env` from `.env.example`, run migrations
2. **Testing**: Each module has clear interfaces for unit testing
3. **Extension Points**: Add new endpoints following the established patterns
4. **Documentation**: Update OpenAPI schemas when adding features

Remember: The code implements these concepts. This guide helps you understand *why* things are done this way, not just *how*.