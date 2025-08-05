from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.dependencies import get_db
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.crud.user import user_crud
from app.schemas.auth import Token, LoginRequest, PasswordResetRequest
from app.schemas.user import UserCreate, User

router = APIRouter()


@router.post("/register", response_model=User)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db)
):
    """Register a new user"""
    # Check if user already exists
    if user_crud.get_by_email(db, email=user_in.email):
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    if user_crud.get_by_username(db, username=user_in.username):
        raise HTTPException(
            status_code=400,
            detail="Username already taken"
        )
    
    # Create new user
    user = user_crud.create(db, obj_in=user_in)
    return user


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login user and return access and refresh tokens"""
    user = user_crud.authenticate(
        db, username=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user_crud.is_active(user):
        raise HTTPException(status_code=400, detail="Inactive user")
    
    # Create tokens
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/refresh", response_model=Token)
def refresh_token(
    refresh_token: str,
    db: Session = Depends(get_db)
):
    """Refresh access token using refresh token"""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = payload.get("sub")
    user = user_crud.get(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Create new tokens
    access_token = create_access_token(data={"sub": user.id})
    new_refresh_token = create_refresh_token(data={"sub": user.id})
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }


@router.post("/logout")
def logout():
    """Logout user (handled on frontend by removing tokens)"""
    return {"msg": "Successfully logged out"}


@router.post("/password-reset")
def request_password_reset(
    reset_request: PasswordResetRequest,
    db: Session = Depends(get_db)
):
    """Request password reset email"""
    user = user_crud.get_by_email(db, email=reset_request.email)
    if user:
        # TODO: Send password reset email
        # For now, just return success
        pass
    
    # Always return success to prevent email enumeration
    return {"msg": "If the email exists, a password reset link has been sent"}