import { Stack, StackProps, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { AppContext } from "./app-context";

export interface CognitoStackProps extends StackProps {
  ctx: AppContext;
}

export class CognitoStack extends Stack {
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, {
      ...props,
      // prodだけスタック削除保護（コンソールで解除しないとDeleteできない）
      terminationProtection: props.ctx.stage === "prod",
    });

    const { ctx } = props;

    const isProd = ctx.stage === "prod";
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

    this.userPoolId = userPool.userPoolId;
    this.userPoolClientId = userPoolClient.userPoolClientId;

    // 3) 出力（.env.local用）
    // stage=localのみ出力
    if (ctx.stage === "local") {
      /*
      new CfnOutput(this, "CopyPasteEnvLocal", {
        value:
          "# .env.local\n" +
          `COGNITO_USER_POOL_ID=${userPool.userPoolId}\n` +
          `COGNITO_USER_POOL_CLIENT_ID=${userPoolClient.userPoolClientId}\n`,
      });
      */
      new CfnOutput(this, "CognitoUserPoolId", {
        value: userPool.userPoolId,
      });

      new CfnOutput(this, "CognitoUserPoolClientId", {
        value: userPoolClient.userPoolClientId,
      });
    }
  }
}
