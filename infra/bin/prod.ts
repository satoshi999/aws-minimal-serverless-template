#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { DynamoDbStack } from "../lib/dynamodb-stack";
import { CognitoStack } from "../lib/cognito-stack";
import { ApiLambdaStack } from "../lib/lambda-stack";
import { WebStack } from "../lib/web-stack";
import { buildAppContext } from "../lib/app-context";
import { assembleFullApp } from "../lib/app-assembly";

const ctx = buildAppContext("prod");
const app = new cdk.App();

assembleFullApp(app, ctx);
