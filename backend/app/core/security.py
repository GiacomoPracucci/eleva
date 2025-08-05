from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Creates a short-lived JWT access token.

    This token is intended to be used for authenticating requests to protected API
    endpoints. It contains the user's identity in the payload, an expiration
    claim ("exp"), and a "type" claim set to "access". The lifespan of this
    token is configured by ACCESS_TOKEN_EXPIRE_MINUTES in the settings.

    Args:
        data (dict): A dictionary containing the data to be encoded in the token's
                    payload (e.g., {"sub": user_email}).
        expires_delta (Optional[timedelta]): An optional timedelta to override the
                                            default token expiration time.

    Returns:
        str: The encoded JWT access token as a string.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """
    Creates a long-lived JWT refresh token.

    This token's sole purpose is to be exchanged for a new access token once the
    old one has expired. It has a much longer lifespan, configured by
    REFRESH_TOKEN_EXPIRE_DAYS in the settings. It contains a "type" claim set
    to "refresh".

    Args:
        data (dict): A dictionary containing the data to be encoded in the token's
                    payload (e.g., {"sub": user_email}).

    Returns:
        str: The encoded JWT refresh token as a string.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain-text password against its stored hash.

    This function uses the passlib context, which automatically handles the
    salt and hashing algorithm (bcrypt) to securely compare the provided
    plain password with the hashed version from the database.

    Args:
        plain_password (str): The password provided by the user during login.
        hashed_password (str): The password hash stored in the database.

    Returns:
        bool: True if the password is correct, False otherwise.
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Hashes a plain-text password using bcrypt.

    This function takes a user's password and returns a secure hash to be
    stored in the database. The bcrypt algorithm automatically includes a
    salt in the resulting hash.

    Args:
        password (str): The plain-text password to hash.

    Returns:
        str: The resulting password hash as a string.
    """
    return pwd_context.hash(password)


def decode_token(token: str) -> Optional[dict]:
    """
    Decodes and validates a JWT.

    This function attempts to decode the given token using the application's
    SECRET_KEY and algorithm. It implicitly verifies the token's signature and
    expiration time.

    Args:
        token (str): The JWT to decode.

    Returns:
        Optional[dict]: The token's payload as a dictionary if the token is valid,
                        or None if validation fails (due to an invalid signature,
                        expiration, or any other JWT-related error).
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None