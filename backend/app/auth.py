from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from app.config import settings


class User(BaseModel):
    email: str
    sub: str


# =========================
# FastAPI の認証スキーム
# =========================
security = HTTPBearer(auto_error=True)

# =========================
# サーバ側で固定する設定値（重要）
# ※トークン内の iss を信じて JWKS URL を作らない
# =========================
# 例: https://cognito-idp/ap-northeast-1.amazonaws.com/ap-northeast-1_XXXX
COGNITO_ISSUER = f"https://cognito-idp.{settings.aws_region}.amazonaws.com/{settings.cognito_user_pool_id}"


# Cognito User Pool の App Client ID（IDトークンの aud と一致する想定）
COGNITO_APP_CLIENT_ID = settings.cognito_app_client_id

# JWKS URL（issuer から固定で決める）
JWKS_URL = f"{COGNITO_ISSUER}/.well-known/jwks.json"

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


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    """
    IDトークン前提のユーザー取得（テンプレ向け）
    - PyJWKClient で JWKS をキャッシュしつつ kid に対応する公開鍵を取得
    - 署名検証 + exp/iss/aud 検証
    - token_use == "id" を確認（IDトークンだけ受け入れる）
    """
    token = creds.credentials

    # 1) まず JWT ヘッダ（未検証）から alg を確認（混乱回避）
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="トークンヘッダが不正です")

    alg = header.get("alg")
    if alg != "RS256":
        raise HTTPException(status_code=401, detail=f"想定外の alg です: {alg}")

    # 2) 署名検証前に payload を読む（verify_signature=False）
    #    目的：token_use/iss のミスマッチを早めに弾いて無駄な処理を減らす
    #    注意：ここで得た値を信用して URL を組み立てたりはしない（issuerは固定）
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

    if unverified_claims.get("token_use") != "id":
        # IDトークンでAPIを叩く前提
        raise HTTPException(status_code=401, detail="token_use が不正です（id を期待）")

    # 3) kid に対応する公開鍵を（キャッシュを使いながら）取得して、署名検証を行う
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token).key

        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=COGNITO_APP_CLIENT_ID,  # IDトークンの aud
            issuer=COGNITO_ISSUER,
            leeway=JWT_LEEWAY_SECONDS,
            options={
                "require": ["exp", "iss"],  # 最低限
                "verify_exp": True,
                "verify_iss": True,
                "verify_aud": True,
            },
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="トークンの有効期限が切れています")
    except jwt.InvalidAudienceError:
        raise HTTPException(
            status_code=401, detail="aud が不正です（App Client ID 不一致）"
        )
    except jwt.InvalidIssuerError:
        raise HTTPException(status_code=401, detail="iss が不正です")
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"トークンが不正です: {e}")

    # 4) アプリ側のユーザー情報を組み立て
    sub: Optional[str] = claims.get("sub")
    email: Optional[str] = claims.get("email")
    if not sub:
        raise HTTPException(status_code=401, detail="sub がありません")

    return User(sub=sub, email=email)
