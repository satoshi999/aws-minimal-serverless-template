from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
import time
import uuid

from app.auth import CurrentUser, get_current_user
from app.dynamodb.base import dynamodb_resource

router = APIRouter(prefix="/todos", tags=["todos"])


class TodoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class TodoOut(BaseModel):
    id: str
    title: str
    done: bool
    created_at: int


@router.post("", response_model=TodoOut)
def create_todo(body: TodoCreate, user: CurrentUser = Depends(get_current_user)):
    now = int(time.time())
    todo_id = str(uuid.uuid4())

    pk = f"USER#{user.sub}"
    sk = f"TODO#{todo_id}"

    item = {
        "pk": pk,
        "sk": sk,
        "id": todo_id,
        "title": body.title,
        "done": False,
        "created_at": now,
    }

    ddb = dynamodb_resource()
    todos = ddb.Table("todos")
    todos.put_item(Item=item)
    return TodoOut(**{k: item[k] for k in ["id", "title", "done", "created_at"]})


@router.get("", response_model=list[TodoOut])
def list_todos(user: CurrentUser = Depends(get_current_user)):
    pk = f"USER#{user.sub}"

    ddb = dynamodb_resource()
    todos = ddb.Table("todos")

    resp = todos.query(
        KeyConditionExpression="pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues={
            ":pk": pk,
            ":prefix": "TODO#",
        },
    )

    items = resp.get("Items", [])
    # created_at desc
    items.sort(key=lambda x: x.get("created_at", 0), reverse=True)

    out: list[TodoOut] = []
    for it in items:
        out.append(
            TodoOut(
                id=it["id"],
                title=it["title"],
                done=bool(it.get("done", False)),
                created_at=int(it.get("created_at", 0)),
            )
        )
    return out
