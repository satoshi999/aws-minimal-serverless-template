import argparse
import json
from pathlib import Path

import boto3


BASE_DIR = Path(__file__).resolve().parents[1]
DDB_TABLES_DIR = BASE_DIR / "backend" / "app" / "dynamodb" / "tables"


def create_lambda(
    project_name: str,
    region: str,
    cognito: dict,
):
    iam = boto3.client("iam")
    lambda_client = boto3.client("lambda", region_name=region)

    role_name = f"{project_name}-lambda-role"
    function_name = f"{project_name}-api"

    # -------------------------
    # IAM Role（Lambda用）
    # -------------------------
    try:
        role = iam.get_role(RoleName=role_name)["Role"]
        print(f"[SKIP] IAM Role exists: {role_name}")
    except iam.exceptions.NoSuchEntityException:
        print(f"[CREATE] IAM Role: {role_name}")
        role = iam.create_role(
            RoleName=role_name,
            AssumeRolePolicyDocument=json.dumps(
                {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {"Service": "lambda.amazonaws.com"},
                            "Action": "sts:AssumeRole",
                        }
                    ],
                }
            ),
        )["Role"]

        iam.attach_role_policy(
            RoleName=role_name,
            PolicyArn="arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
        )
        iam.attach_role_policy(
            RoleName=role_name,
            PolicyArn="arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess",
        )

    role_arn = role["Arn"]

    # IAM反映待ち（超重要）
    import time

    time.sleep(10)

    # -------------------------
    # Lambda Function
    # -------------------------
    zip_path = BASE_DIR / "lambda_function.zip"
    code = zip_path.read_bytes()

    env_vars = {
        "AUTH_MODE": "cognito",
        "COGNITO_USER_POOL_ID": cognito["user_pool_id"],
        "COGNITO_APP_CLIENT_ID": cognito["app_client_id"],
    }

    try:
        lambda_client.get_function(FunctionName=function_name)
        print(f"[SKIP] Lambda exists: {function_name}")

        lambda_client.update_function_code(
            FunctionName=function_name,
            ZipFile=code,
        )
        lambda_client.update_function_configuration(
            FunctionName=function_name,
            Environment={"Variables": env_vars},
        )

    except lambda_client.exceptions.ResourceNotFoundException:
        print(f"[CREATE] Lambda Function: {function_name}")
        lambda_client.create_function(
            FunctionName=function_name,
            Runtime="python3.12",
            Role=role_arn,
            Handler="app.main.handler",
            Code={"ZipFile": code},
            Timeout=30,
            MemorySize=256,
            Environment={"Variables": env_vars},
        )

    # -------------------------
    # Function URL
    # -------------------------
    try:
        url = lambda_client.get_function_url_config(FunctionName=function_name)[
            "FunctionUrl"
        ]
        print(f"[SKIP] Function URL exists: {url}")
    except lambda_client.exceptions.ResourceNotFoundException:
        print("[CREATE] Lambda Function URL")
        resp = lambda_client.create_function_url_config(
            FunctionName=function_name,
            AuthType="NONE",
            Cors={
                "AllowOrigins": ["*"],
                "AllowMethods": ["*"],
                "AllowHeaders": ["*"],
            },
        )
        url = resp["FunctionUrl"]

    print(f"[OK] API Endpoint: {url}")

    return {
        "function_name": function_name,
        "function_url": url,
        "role_name": role_name,
    }


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

    lambda_info = create_lambda(
        project_name=args.project_name,
        region=args.region,
        cognito=cognito,
    )

    print("[OK] Lambda deployed")
    print(lambda_info)

    create_dynamodb_tables(args.region)
    print("[OK] DynamoDB tables created")

    print("=== DONE ===")


if __name__ == "__main__":
    main()
