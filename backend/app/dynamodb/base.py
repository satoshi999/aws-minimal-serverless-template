import boto3
from app.config import settings


def dynamodb_client():
    return boto3.client(
        "dynamodb",
        region_name=settings.aws_region,
        endpoint_url=settings.ddb_endpoint_url,
    )


def dynamodb_resource():
    return boto3.resource(
        "dynamodb",
        region_name=settings.aws_region,
        endpoint_url=settings.ddb_endpoint_url,
    )
