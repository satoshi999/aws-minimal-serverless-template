import requests
from functools import lru_cache
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
from pydantic import BaseModel
from .config import settings
import time


bearer = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    sub: str
    email: str | None = None


@lru_cache
def get_jwks():
    url = (
        f"https://cognito-idp.{settings.aws_region}.amazonaws.com/"
        f"{settings.cognito_user_pool_id}/.well-known/jwks.json"
    )
    return requests.get(url).json()


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
    cred: HTTPAuthorizationCredentials = Depends(bearer),
) -> CurrentUser:
    if cred is None or cred.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = cred.credentials

    # ------------------
    # local（開発用）
    # ------------------
    if settings.auth_mode == "local":
        payload = jwt.decode(
            token,
            settings.local_jwt_secret,
            algorithms=["HS256"],
            issuer=settings.local_jwt_issuer,
            audience=settings.local_jwt_audience,
        )
        return CurrentUser(
            sub=payload["sub"],
            email=payload.get("email"),
        )

    # ------------------
    # prod（Cognito）
    # ------------------
    if settings.auth_mode == "cognito":
        jwks = get_jwks()
        try:
            payload = jwt.decode(
                token,
                jwks,
                algorithms=["RS256"],
                issuer=(
                    f"https://cognito-idp.{settings.aws_region}.amazonaws.com/"
                    f"{settings.cognito_user_pool_id}"
                ),
                audience=settings.cognito_app_client_id,
            )
        except JWTError as e:
            raise HTTPException(status_code=401, detail=str(e))

        return CurrentUser(
            sub=payload["sub"],
            email=payload.get("email"),
        )

    raise HTTPException(status_code=500, detail="Invalid AUTH_MODE")
