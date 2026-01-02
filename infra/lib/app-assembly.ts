import * as cdk from "aws-cdk-lib/core";
import { DynamoDbStack } from "./dynamodb-stack";
import { CognitoStack } from "./cognito-stack";
import { ApiLambdaStack } from "./lambda-stack";
import { WebStack } from "./web-stack";
import { AppContext } from "./app-context";

export function assembleFullApp(app: cdk.App, ctx: AppContext) {
  const cognito = new CognitoStack(app, `CognitoStack-${ctx.baseName}`, {
    ctx,
  });

  const dynamodb = new DynamoDbStack(app, `DynamoDbStack-${ctx.baseName}`, {
    ctx,
  });

  const api = new ApiLambdaStack(app, `ApiLambdaStack-${ctx.baseName}`, {
    ctx,
    cognitoUserPoolId: cognito.userPoolId,
    cognitoUserPoolClientId: cognito.userPoolClientId,
    lambdaDistDir: "../backend/dist",
    handler: "app.main.handler",
    todoTable: dynamodb.todosTable,
  });

  new WebStack(app, `WebStack-${ctx.baseName}`, {
    ctx,
    apiFunctionUrl: api.functionUrl,
    frontendDistDir: "../frontend/dist",
  });

  return { cognito, dynamodb, api };
}
