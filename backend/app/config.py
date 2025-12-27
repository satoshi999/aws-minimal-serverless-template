from pydantic import BaseModel
import os


class Settings(BaseModel):
    auth_mode: str = os.getenv("AUTH_MODE", "local")  # local | cognito (future)

    # local jwt
    local_jwt_secret: str = os.getenv("LOCAL_JWT_SECRET", "dev-secret-change-me")
    local_jwt_issuer: str = os.getenv("LOCAL_JWT_ISSUER", "local-dev")
    local_jwt_audience: str = os.getenv("LOCAL_JWT_AUDIENCE", "local-dev")

    # cognito
    cognito_user_pool_id: str = os.getenv("COGNITO_USER_POOL_ID")
    cognito_app_client_id: str = os.getenv("COGNITO_APP_CLIENT_ID")

    # dynamodb
    aws_region: str = os.getenv("AWS_REGION", "ap-northeast-1")
    ddb_endpoint_url: str | None = os.getenv("DDB_ENDPOINT_URL") or None
    ddb_table_todos: str = os.getenv("DDB_TABLE_TODOS", "todos")


settings = Settings()
