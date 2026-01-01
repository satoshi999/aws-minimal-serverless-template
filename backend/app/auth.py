from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from app.config import settings


class User(BaseModel):
    sub: str
    # access token には email が無いことがあるので Optional にする
    email: Optional[str] = None


security = HTTPBearer(auto_error=True)

# =========================
# サーバ側で固定する設定値
# =========================
# ※トークン内の iss を信じて JWKS URL を作らない
# 例: https://cognito-idp/ap-northeast-1.amazonaws.com/ap-northeast-1_XXXX
COGNITO_ISSUER = f"https://cognito-idp.{settings.aws_region}.amazonaws.com/{settings.cognito_user_pool_id}"

# JWKS URL（issuer から固定で決める）
JWKS_URL = f"{COGNITO_ISSUER}/.well-known/jwks.json"

# Cognito User Pool の App Client ID（IDトークンの aud と一致する想定）
COGNITO_USER_POOL_CLIENT_ID = settings.cognito_user_pool_client_id

# =========================
# PyJWKClient（JWKSキャッシュ）
# - cache_jwk_set=True で JWKS（鍵セット）をキャッシュする
# - lifespan はキャッシュ有効秒数（デフォルトは5分）
# =========================
JWKS_CACHE_SECONDS = settings.cognito_jwks_cache_seconds
JWKS_HTTP_TIMEOUT = settings.cognito_jwks_http_timeout

jwks_client = PyJWKClient(
    JWKS_URL,
    cache_jwk_set=True,
    lifespan=JWKS_CACHE_SECONDS,
    timeout=JWKS_HTTP_TIMEOUT,
)

# 許容する時計ズレ（必要なら）
JWT_LEEWAY_SECONDS = settings.cognito_jwt_leeway_seconds


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """
    Accessトークン前提のユーザー取得（テンプレ向け）
    - token_use == "access" を要求
    - iss を固定で検証
    - aud ではなく client_id を App Client ID と照合
    """
    token = creds.credentials

    # 1) ヘッダの alg 確認
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="トークンヘッダが不正です")

    alg = header.get("alg")
    if alg != "RS256":
        raise HTTPException(status_code=401, detail=f"想定外の alg です: {alg}")

    # 2) 署名前に claims を軽く見る（早期拒否用）
    try:
        unverified_claims = jwt.decode(
            token,
            options={
                "verify_signature": False,
                "verify_exp": False,
                "verify_aud": False,
                "verify_iss": False,
            },
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="トークンクレームが不正です")

    if unverified_claims.get("iss") != COGNITO_ISSUER:
        raise HTTPException(status_code=401, detail="iss が不正です")

    # access token を要求
    if unverified_claims.get("token_use") != "access":
        raise HTTPException(
            status_code=401, detail="token_use が不正です（access を期待）"
        )

    # aud ではなく client_id を確認
    if unverified_claims.get("client_id") != COGNITO_USER_POOL_CLIENT_ID:
        raise HTTPException(
            status_code=401, detail="client_id が不正です（App Client ID 不一致）"
        )

    # 3) 署名検証 + exp/iss 検証（aud 検証はしない）
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token).key

        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            issuer=COGNITO_ISSUER,
            leeway=JWT_LEEWAY_SECONDS,
            options={
                "require": ["exp", "iss"],  # 最低限
                "verify_exp": True,
                "verify_iss": True,
                "verify_aud": False,  # access token は aud を前提にしない
            },
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="トークンの有効期限が切れています")
    except jwt.InvalidIssuerError:
        raise HTTPException(status_code=401, detail="iss が不正です")
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"トークンが不正です: {e}")

    # 念のため再チェック（防御）
    if claims.get("token_use") != "access":
        raise HTTPException(
            status_code=401, detail="token_use が不正です（access を期待）"
        )
    if claims.get("client_id") != COGNITO_USER_POOL_CLIENT_ID:
        raise HTTPException(
            status_code=401, detail="client_id が不正です（App Client ID 不一致）"
        )

    sub: Optional[str] = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="sub がありません")

    # access token では email が無いことがある
    email: Optional[str] = claims.get("email")

    return User(sub=sub, email=email)
