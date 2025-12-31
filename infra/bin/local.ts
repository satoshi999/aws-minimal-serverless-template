#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { DynamoDbStack } from "../lib/dynamodb-stack";
import { CognitoStack } from "../lib/cognito-stack";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

/**
 * CDK 全体で共有するアプリケーションコンテキスト
 * - すべてのリソース命名の基点
 * - Stack をまたいで共通
 */
export interface AppContext {
  projectName: string;
  envName: string;

  /** `${projectName}-${envName}` */
  readonly baseName: string;
}

function buildAppContext(): AppContext {
  const projectName = requireEnv("PROJECT_NAME");
  const envName = requireEnv("ENV");

  return {
    projectName,
    envName,
    baseName: `${projectName}-${envName}`,
  };
}

const ctx = buildAppContext();
const app = new cdk.App();

const deployTarget = app.node.tryGetContext("deployTarget");

if (deployTarget === "cognito") {
  new CognitoStack(app, `CognitoStack-${ctx.baseName}`, {
    ctx,
    domainPrefix: requireEnv("COGNITO_DOMAIN_PREFIX"),
    callbackUrl: requireEnv("COGNITO_CALLBACK_URL"),
    logoutUrl: requireEnv("COGNITO_LOGOUT_URL"),
    googleClientId: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
    googleClientSecret: requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
  });
}

if (deployTarget === "dynamodb")
  new DynamoDbStack(app, `DynamoDbStack-${ctx.baseName}`, { ctx });
