#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { DynamoDbStack } from "../lib/dynamodb-stack";
import { CognitoStack } from "../lib/cognito-stack";
import { AppContext } from "./types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
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
  new CognitoStack(app, `CognitoStack-${ctx.baseName}`, { ctx });
}

if (deployTarget === "dynamodb")
  new DynamoDbStack(app, `DynamoDbStack-${ctx.baseName}`, { ctx });
