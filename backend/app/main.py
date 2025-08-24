from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.api.router import api_router
from app.db.session import engine
from app.services.embedding_service import get_embedding_service
from app.services.task_queue.base_task_queue import get_task_queue, cleanup_task_queue

from app.db import Base

async def init_db():
    """Initialize database tables"""
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Async context manager for app lifespan events.
    """
    # Startup
    await init_db()
    
    # Initialize services
    embedding_service = get_embedding_service()
    task_queue = get_task_queue()
    
    print(f"{settings.PROJECT_NAME} started successfully")
    
    yield
    
    # Shutdown
    await embedding_service.close()
    await cleanup_task_queue()
    await engine.dispose()
    print(f"{settings.PROJECT_NAME} shutting down")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan  
)

print(f"CORS Origins from settings: {settings.BACKEND_CORS_ORIGINS}")
print(f"Type: {type(settings.BACKEND_CORS_ORIGINS)}")

if settings.BACKEND_CORS_ORIGINS:
    cors_origins = [str(origin).rstrip('/') for origin in settings.BACKEND_CORS_ORIGINS]
    print(f"CORS enabled for: {cors_origins}")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"], #[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}