import argparse
import json
from pathlib import Path

import boto3


BASE_DIR = Path(__file__).resolve().parents[1]
DDB_TABLES_DIR = BASE_DIR / "backend" / "app" / "dynamodb" / "tables"


def create_cognito(project_name: str, region: str):
    client = boto3.client("cognito-idp", region_name=region)

    resp = client.create_user_pool(
        PoolName=project_name,
        AutoVerifiedAttributes=["email"],
        UsernameAttributes=["email"],
    )

    user_pool_id = resp["UserPool"]["Id"]

    client_resp = client.create_user_pool_client(
        UserPoolId=user_pool_id,
        ClientName=project_name,
        GenerateSecret=False,
        AllowedOAuthFlowsUserPoolClient=True,
        AllowedOAuthFlows=["code"],
        AllowedOAuthScopes=["openid", "email", "profile"],
        CallbackURLs=["http://localhost:5173"],
        SupportedIdentityProviders=["COGNITO"],
    )

    return {
        "user_pool_id": user_pool_id,
        "app_client_id": client_resp["UserPoolClient"]["ClientId"],
    }


def create_dynamodb_tables(region: str):
    ddb = boto3.client("dynamodb", region_name=region)

    for path in sorted(DDB_TABLES_DIR.glob("*.json")):
        params = json.loads(path.read_text())
        table_name = params["TableName"]

        try:
            ddb.describe_table(TableName=table_name)
            print(f"[SKIP] DynamoDB table exists: {table_name}")
        except ddb.exceptions.ResourceNotFoundException:
            print(f"[CREATE] DynamoDB table: {table_name}")
            ddb.create_table(**params)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project_name", required=True)
    parser.add_argument("--region", required=True)
    args = parser.parse_args()

    print("=== Deploy infrastructure ===")
    print(f"project_name : {args.project_name}")
    print(f"region : {args.region}")

    cognito = create_cognito(args.project_name, args.region)
    print("[OK] Cognito created")
    print(cognito)

    create_dynamodb_tables(args.region)
    print("[OK] DynamoDB tables created")

    print("=== DONE ===")


if __name__ == "__main__":
    main()
