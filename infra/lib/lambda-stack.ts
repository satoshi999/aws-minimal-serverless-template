import * as path from "path";
import { Duration, CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";

import type { AppContext } from "./app-context";

export interface ApiLambdaStackProps extends StackProps {
  ctx: AppContext;
  cognitoUserPoolId: string;
  cognitoUserPoolClientId: string;
  // Lambdaのビルドディレクトリ（"/backend/dist"）
  lambdaDistDir: string;
  // Lambda handler（"app.main.handler"）
  handler: string;
  todoTable: dynamodb.ITable;
}

export class ApiLambdaStack extends Stack {
  public readonly functionUrl: string;
  public readonly lambda_function: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiLambdaStackProps) {
    super(scope, id, props);

    const fn = new lambda.Function(this, "ApiFunction", {
      functionName: props.ctx.baseName,
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: props.handler,
      timeout: Duration.seconds(30),
      memorySize: 512,
      code: lambda.Code.fromAsset(props.lambdaDistDir),
      environment: {
        PROJECT_NAME: props.ctx.projectName,
        STAGE: props.ctx.stage,
        COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
        COGNITO_USER_POOL_CLIENT_ID: props.cognitoUserPoolClientId,
      },
    });

    // ===== Function URL =====
    const url = fn.addFunctionUrl({
      // CloudFront から叩けるように NONE（公開）にする
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ["*"],
      },
    });

    props.todoTable.grantReadWriteData(fn);

    this.functionUrl = url.url;

    new CfnOutput(this, "ApiFunctionUrl", {
      value: this.functionUrl,
    });
  }
}
