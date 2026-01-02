from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import time
import uuid
import boto3
import logging
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key
from app.config import settings
from app.auth import get_current_user, User

logger = logging.getLogger("uvicorn.app")

router = APIRouter(prefix="/todos", tags=["todos"])


class TodoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class TodoUpdate(BaseModel):
    # 一意特定のために必須（sk復元に使う）
    created_at: int = Field(ge=0)

    # 部分更新
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    done: Optional[bool] = None


class TodoOut(BaseModel):
    id: str
    title: str
    done: bool
    created_at: int


def dynamodb_resource():
    return boto3.resource(
        "dynamodb",
    )


def build_table_name(name):
    return f"{name}-{settings.project_name}-{settings.stage}"


def user_pk(user: User) -> str:
    # ユーザー識別は sub を使用（email統合はアプリ側の設計で）
    # subは認証方式ごとに変わり得る（統合したいなら別設計）
    return f"USER#{user.sub}"


def todo_sk(todo_id: str, created_at: int) -> str:
    return f"TODO#{created_at}#{todo_id}"


@router.post("", response_model=TodoOut)
def create_todo(body: TodoCreate, user: User = Depends(get_current_user)):
    now = int(time.time())
    todo_id = str(uuid.uuid4())

    pk = user_pk(user)
    sk = todo_sk(todo_id, now)

    item = {
        "pk": pk,
        "sk": sk,
        "id": todo_id,
        "title": body.title,
        "done": False,
        "created_at": now,
    }

    ddb = dynamodb_resource()
    todos = ddb.Table(build_table_name("todos"))
    todos.put_item(Item=item)
    return TodoOut(**{k: item[k] for k in ["id", "title", "done", "created_at"]})


@router.get("", response_model=list[TodoOut])
def list_todos(user: User = Depends(get_current_user)):
    pk = user_pk(user)

    ddb = dynamodb_resource()
    todos = ddb.Table(build_table_name("todos"))

    resp = todos.query(
        KeyConditionExpression=Key("pk").eq(pk) & Key("sk").begins_with("TODO#"),
        ScanIndexForward=False,  # 新しい順（sort key 降順）
    )

    items = resp.get("Items", [])

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


@router.patch("/{todo_id}", response_model=TodoOut)
def update_todo(todo_id: str, body: TodoUpdate, user: User = Depends(get_current_user)):
    """
    タイトル編集 / 完了(done) 更新（部分更新）
    - created_at は必須（pk+sk を復元して一発更新するため）
    - title / done は任意（どちらかは必須）
    """
    if body.title is None and body.done is None:
        raise HTTPException(status_code=400, detail="No fields to update")

    pk = user_pk(user)
    sk = todo_sk(todo_id, body.created_at)

    # UpdateExpression を動的生成
    update_parts = []
    expr_values = {}
    expr_names = {}

    if body.title is not None:
        expr_names["#title"] = "title"
        expr_values[":title"] = body.title
        update_parts.append("#title = :title")

    if body.done is not None:
        expr_names["#done"] = "done"
        expr_values[":done"] = bool(body.done)
        update_parts.append("#done = :done")

    update_expr = "SET " + ", ".join(update_parts)

    ddb = dynamodb_resource()
    table = ddb.Table(build_table_name("todos"))

    try:
        resp = table.update_item(
            Key={"pk": pk, "sk": sk},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
            # 存在しない todo_id/created_at を更新しようとしたら 404 にしたいので条件を付ける
            ConditionExpression="attribute_exists(pk) AND attribute_exists(sk)",
            ReturnValues="ALL_NEW",
        )
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code")
        if code == "ConditionalCheckFailedException":
            raise HTTPException(status_code=404, detail="Todo not found")
        raise HTTPException(status_code=500, detail=f"DynamoDB error: {code}")

    attrs = resp.get("Attributes") or {}
    return TodoOut(
        id=attrs["id"],
        title=attrs["title"],
        done=bool(attrs.get("done", False)),
        created_at=int(attrs.get("created_at", 0)),
    )
