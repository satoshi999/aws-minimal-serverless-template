from pydantic import BaseModel
import os
import boto3


def resolve_region(profile: str | None = None) -> str:
    # Lambda では通常これが入っている
    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION")
    if region:
        return region

    # ローカルは ~/.aws/config の profile 設定から拾える
    region = boto3.Session(profile_name=os.getenv("AWS_PROFILE")).region_name
    if region:
        return region

    raise RuntimeError(
        "AWS region が解決できません。env か ~/.aws/config の region を確認してください。"
    )


class Settings(BaseModel):
    project_name: str = os.getenv("PROJECT_NAME")
    env: str = os.getenv("ENV")
    aws_region: str = resolve_region()

    # cognito(認証用)
    cognito_user_pool_client_id: str = os.getenv("COGNITO_USER_POOL_CLIENT_ID")
    cognito_user_pool_id: str = os.getenv("COGNITO_USER_POOL_ID")
    cognito_jwks_cache_seconds: int = int(
        os.getenv("COGNITO_JWKS_CACHE_SECONDS", "21600")
    )
    cognito_jwks_http_timeout: float = float(
        os.getenv("COGNITO_JWKS_HTTP_TIMEOUT", "3.0")
    )
    cognito_jwt_leeway_seconds: int = int(os.getenv("COGNITO_JWT_LEEWAY_SECONDS", "0"))


settings = Settings()
