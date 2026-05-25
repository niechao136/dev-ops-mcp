import os
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError

from src.schema.auth import TokenDict


load_dotenv()


SECRET_KEY = os.getenv("JWT_SECRET", "dev-ops-mcp")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30


def create_access_token(data: TokenDict, expires_delta: timedelta | None = None):
    to_encode = data.model_dump(mode="json")
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": int(expire.timestamp())})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
