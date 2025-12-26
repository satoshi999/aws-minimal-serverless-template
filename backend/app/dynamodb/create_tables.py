import json
from pathlib import Path
from botocore.exceptions import ClientError
from app.dynamodb.base import dynamodb_client
import logging

logger = logging.getLogger("uvicorn.myapp")

BASE_DIR = Path(__file__).resolve().parent
TABLES_DIR = BASE_DIR / "tables"


def load_table_definitions():
    for path in sorted(TABLES_DIR.glob("*.json")):
        with open(path, "r", encoding="utf-8") as f:
            yield path.name, json.load(f)


def create_tables():
    ddb = dynamodb_client()

    for filename, params in load_table_definitions():
        table_name = params.get("TableName")
        if not table_name:
            raise ValueError(f"{filename}: TableName is required")

        try:
            ddb.describe_table(TableName=table_name)
            logger.info("[SKIP] %s already exists", table_name)
            continue

        except ddb.exceptions.ResourceNotFoundException:
            logger.info("[CREATE] %s (%s)", table_name, filename)

        try:
            ddb.create_table(**params)
        except ClientError as e:
            logger.error("failed to create %s", table_name)
            raise e
