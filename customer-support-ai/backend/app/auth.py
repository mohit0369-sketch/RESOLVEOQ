import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext


# ---------------------------------------------------------
# Load environment variables from .env
# ---------------------------------------------------------

load_dotenv()


# ---------------------------------------------------------
# Authentication configuration
# ---------------------------------------------------------

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "change-this-secret-key-in-production"
)

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "60"
    )
)


# ---------------------------------------------------------
# Password hashing
# ---------------------------------------------------------

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


def hash_password(password: str) -> str:
    """Hash a plain-text password."""
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    """Check a password against its stored hash."""
    return pwd_context.verify(
        plain_password,
        hashed_password
    )


# ---------------------------------------------------------
# JWT token creation
# ---------------------------------------------------------

def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None
) -> str:
    """Create a signed JWT access token."""

    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({
        "exp": expire
    })

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


# ---------------------------------------------------------
# JWT token validation
# ---------------------------------------------------------

def decode_access_token(
    token: str
) -> dict | None:
    """Decode and validate a JWT access token."""

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        return payload

    except JWTError:
        return None