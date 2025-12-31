from fastapi import FastAPI
from app.todos import router as todos_router
from mangum import Mangum

app = FastAPI()

app.include_router(todos_router)


@app.get("/healthz")
def healthz():
    return {"ok": True}


handler = Mangum(app)
