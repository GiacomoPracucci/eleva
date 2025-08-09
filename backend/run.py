"""
Simple launcher script for the Eléva FastAPI application.
Run this from the backend root directory.

Usage:
    python run.py              # Run with default settings
    python run.py --port 8080   # Run on different port
    python run.py --prod        # Run in production mode (no reload)
"""

import sys
import os
from pathlib import Path
import argparse

# add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Run the Eléva FastAPI application")
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host to bind to (default: 127.0.0.1)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to bind to (default: 8000)"
    )
    parser.add_argument(
        "--prod",
        action="store_true",
        help="Run in production mode (disables auto-reload)"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of worker processes (only in production mode)"
    )
    return parser.parse_args()

if __name__ == "__main__":
    import uvicorn
    
    args = parse_args()
    
    # Configure uvicorn based on environment
    config = {
        "app": "app.main:app",
        "host": args.host,
        "port": args.port,
        "reload": not args.prod,
        # Add async-specific settings
        "loop": "asyncio",  # Explicitly use asyncio loop
        "access_log": True,
    }
    
    if args.prod:
        # Production settings
        config.update({
            "workers": args.workers,
            "log_level": "info",
        })
        print(f"🚀 Starting Eléva in PRODUCTION mode on {args.host}:{args.port}")
        print(f"   Workers: {args.workers}")
    else:
        # Development settings
        config.update({
            "log_level": "debug",
            "reload_dirs": ["app"],  # Watch only app directory
        })
        print(f"🔧 Starting Eléva in DEVELOPMENT mode on {args.host}:{args.port}")
        print(f"   Auto-reload: enabled")
        print(f"   Debug logs: enabled")
    
    print(f"\n📚 API documentation available at:")
    print(f"   - Swagger UI: http://{args.host}:{args.port}/docs")
    print(f"   - ReDoc: http://{args.host}:{args.port}/redoc")
    print(f"\n Press CTRL+C to stop the server\n")
    
    try:
        uvicorn.run(**config)
    except KeyboardInterrupt:
        print("\n👋 Shutting down Eléva...")