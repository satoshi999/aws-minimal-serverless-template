import {
  Stack,
  StackProps,
  CfnOutput,
  SecretValue,
  RemovalPolicy,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { AppContext } from "../bin/infra";

export interface CognitoStackProps extends StackProps {
  ctx: AppContext;
  domainPrefix: string;
  callbackUrl: string;
  logoutUrl: string;
  googleClientId: string;
  googleClientSecret: string;
}

export class CognitoStack extends Stack {
  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, {
      ...props,
      // prodだけスタック削除保護（コンソールで解除しないとDeleteできない）
      terminationProtection: props.ctx.envName === "prod",
    });

    const {
      ctx,
      domainPrefix,
      callbackUrl,
      logoutUrl,
      googleClientId,
      googleClientSecret,
    } = props;

    const isProd = ctx.envName === "prod";
    const rp = isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // 1) User Pool
    const userPool = new cognito.UserPool(this, `UserPool-${ctx.baseName}`, {
      userPoolName: ctx.baseName,
      signInAliases: { email: true }, // emailでサインイン（Alias Email相当）
      autoVerify: { email: true }, // email自動検証
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: rp,
    });

    // 2) Hosted UI ドメイン（Google連携で必須）
    userPool.addDomain("UserPoolDomain", {
      cognitoDomain: {
        domainPrefix, // ※リージョン内で一意。aws/amazon/cognito を含むとNGになり得る
      },
    });

    // 3) Google IdP
    const googleIdp = new cognito.UserPoolIdentityProviderGoogle(
      this,
      `GoogleIdP-${ctx.baseName}`,
      {
        userPool,
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        scopes: ["openid", "email", "profile"],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
          profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
        },
      }
    );

    // 4) SPA向け App Client（PKCE / secretなし / code grant）
    const userPoolClient = userPool.addClient("UserPoolClient", {
      userPoolClientName: ctx.baseName,
      generateSecret: false, // SPA向け

      // Hosted UI (OAuth)
      oAuth: {
        flows: {
          authorizationCodeGrant: true, // code
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [callbackUrl],
        logoutUrls: [logoutUrl],
      },

      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
    });

    // IdPを必ず先に作る（依存関係を明示）
    userPoolClient.node.addDependency(googleIdp);

    // 5) 出力（SDKのconsole.log相当）
    const region = Stack.of(this).region;

    const domain = `${domainPrefix}.auth.${region}.amazoncognito.com`;
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPool.userPoolId}`;
    const jwks = `${issuer}/.well-known/jwks.json`;
    const googleRedirect = `https://${domain}/oauth2/idpresponse`;

    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });
    new CfnOutput(this, "CognitoDomain", { value: domain });
    new CfnOutput(this, "Issuer", { value: issuer });
    new CfnOutput(this, "JwksUrl", { value: jwks });
    new CfnOutput(this, "GoogleAuthorizedRedirectURI", {
      value: googleRedirect,
    });
  }
}
