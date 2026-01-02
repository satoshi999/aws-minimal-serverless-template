from fastapi import APIRouter, Response
from pydantic import BaseModel
from app.config import settings

router = APIRouter(prefix="/public-config", tags=["public-config"])


class PublicConfig(BaseModel):
    cognito_user_pool_id: str
    cognito_user_pool_client_id: str


@router.get("", response_model=PublicConfig)
def get_public_config(response: Response) -> PublicConfig:
    # ブラウザにキャッシュされると更新が反映されないので no-store 推奨
    response.headers["Cache-Control"] = "no-store"

    return PublicConfig(
        cognito_user_pool_id=settings.cognito_user_pool_id,
        cognito_user_pool_client_id=settings.cognito_user_pool_client_id,
    )
