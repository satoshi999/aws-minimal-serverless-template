from fastapi import FastAPI
from app.todos import router as todos_router
from app.dynamodb.create_tables import create_tables
from app.auth import issue_local_dev_token


app = FastAPI(title="aws-minimal-serverless-template (local)")

app.include_router(todos_router)


@app.on_event("startup")
def _startup():
    # local ddbテーブルを自動作成
    create_tables()


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/dev/token")
def dev_token():
    """
    ローカル開発用：テストトークンを返す
    本番では消す/無効化する想定。
    """
    token = issue_local_dev_token(sub="user-1", email="user1@example.com")
    return {"token": token}
