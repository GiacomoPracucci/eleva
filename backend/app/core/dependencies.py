from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from app.db.session import SessionLocal
from app.core.config import settings
from app.core.security import decode_token
from app.models.user import User
from app.schemas.auth import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


def get_db():
    """
    A dependency function to get a database session.

    This is a generator function that creates a new SQLAlchemy `SessionLocal` for each
    incoming request. It yields the session to the path operation function and
    ensures that the session is always closed after the request is finished,
    even if an error occurs. This pattern prevents database session leaks.

    Yields:
        Session: The SQLAlchemy database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    A dependency to get the current user from a JWT access token.

    This function is responsible for validating the authentication token provided
    in the request's "Authorization: Bearer <token>" header. It decodes the token,
    verifies that it is an "access" token, extracts the user identifier ("sub" claim),
    and retrieves the corresponding user object from the database.

    Args:
        db (Session): The database session, injected by the `get_db` dependency.
        token (str): The OAuth2 bearer token, automatically extracted from the
                    request header by the `oauth2_scheme` dependency.

    Raises:
        HTTPException(401): If the token is invalid, expired, of the wrong type
                            (e.g., a refresh token), does not contain a valid user
                            ID, or if the user no longer exists in the database.

    Returns:
        User: The authenticated user's SQLAlchemy model instance.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_exception
    
    user_id: int = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    A dependency to get the current, active user.

    This function builds upon `get_current_user`. It first retrieves the authenticated
    user and then performs an additional check to ensure that the user's `is_active`
    flag is True. This is useful for endpoints that should only be accessible to
    users who have not been deactivated.

    Args:
        current_user (User): The user object, injected by the `get_current_user`
                            dependency.

    Raises:
        HTTPException(400): If the user's `is_active` attribute is False.

    Returns:
        User: The authenticated and active user's SQLAlchemy model instance.
    """
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user