from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from jwt import InvalidTokenError
from pydantic import BaseModel
from .config import settings
import time


bearer = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    sub: str
    email: str | None = None


def issue_local_dev_token(sub: str = "user-1", email: str = "user1@example.com") -> str:
    now = int(time.time())
    payload = {
        "iss": settings.local_jwt_issuer,
        "aud": settings.local_jwt_audience,
        "iat": now,
        "exp": now + 60 * 60,  # 1h
        "sub": sub,
        "email": email,
    }
    return jwt.encode(payload, settings.local_jwt_secret, algorithm="HS256")


def get_current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> CurrentUser:
    if settings.auth_mode != "local":
        raise HTTPException(
            status_code=501, detail="AUTH_MODE=cognito is not implemented yet"
        )

    if cred is None or cred.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = cred.credentials

    try:
        payload = jwt.decode(
            token,
            settings.local_jwt_secret,
            algorithms=["HS256"],
            issuer=settings.local_jwt_issuer,
            audience=settings.local_jwt_audience,
        )
    except InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token missing sub")

    return CurrentUser(sub=sub, email=payload.get("email"))
