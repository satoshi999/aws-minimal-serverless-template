import {
  Stack,
  StackProps,
  CfnOutput,
  SecretValue,
  RemovalPolicy,
  CfnParameter,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { AppContext } from "../bin/types";

export interface CognitoStackProps extends StackProps {
  ctx: AppContext;
}

export class CognitoStack extends Stack {
  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, {
      ...props,
      // prodだけスタック削除保護（コンソールで解除しないとDeleteできない）
      terminationProtection: props.ctx.envName === "prod",
    });

    const { ctx } = props;

    const isProd = ctx.envName === "prod";
    const removalPolicy = isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // 1) User Pool（メールでサインイン）
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: ctx.baseName,
      signInAliases: { email: true },
      autoVerify: { email: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      selfSignUpEnabled: true,
      removalPolicy,
    });

    // 2) App Client（アプリ内ログイン用。Hosted UI/OAuthなし）
    const userPoolClient = userPool.addClient("AppClient", {
      userPoolClientName: ctx.baseName,
      generateSecret: false,

      // アプリ内で username/password(or SRP) ログインするならこれ
      authFlows: {
        userSrp: true,
        userPassword: true,
      },
    });
    // 3) 出力（.envへのコピペ用）
    new CfnOutput(this, "CopyPasteBackendEnv", {
      value:
        `# backend/.env.${ctx.envName}\n` +
        `COGNITO_USER_POOL_ID=${userPool.userPoolId}\n` +
        `COGNITO_USER_POOL_CLIENT_ID=${userPoolClient.userPoolClientId}\n`,
    });

    new CfnOutput(this, "CopyPasteFrontendEnv", {
      value:
        `# frontend/.env.${
          ctx.envName === "prod" ? "production" : ctx.envName
        }\n` +
        `VITE_COGNITO_USER_POOL_ID=${userPool.userPoolId}\n` +
        `VITE_COGNITO_USER_POOL_CLIENT_ID=${userPoolClient.userPoolClientId}\n`,
    });
  }
}
