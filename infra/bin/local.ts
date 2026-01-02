#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { DynamoDbStack } from "../lib/dynamodb-stack";
import { CognitoStack } from "../lib/cognito-stack";
import { buildAppContext } from "../lib/app-context";

const ctx = buildAppContext("local");
const app = new cdk.App();

const deployTarget = app.node.tryGetContext("deployTarget");

if (deployTarget === "cognito" || deployTarget === "all") {
  new CognitoStack(app, `CognitoStack-${ctx.baseName}`, { ctx });
}

if (deployTarget === "dynamodb" || deployTarget === "all")
  new DynamoDbStack(app, `DynamoDbStack-${ctx.baseName}`, { ctx });
