from fastapi import FastAPI
from fastapi.routing import APIRouter
from app.routers.todos import router as todos_router
from app.routers.public_config import router as public_config_router
from mangum import Mangum

app = FastAPI()

# APIは /api 配下にまとめる
api = APIRouter(prefix="/api")
api.include_router(todos_router)
api.include_router(public_config_router)
app.include_router(api)


@app.get("/healthz")
def healthz():
    return {"ok": True}


handler = Mangum(app)
