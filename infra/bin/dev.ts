#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { buildAppContext } from "../lib/app-context";
import { assembleFullApp } from "../lib/app-assembly";

const ctx = buildAppContext("dev");
const app = new cdk.App();

assembleFullApp(app, ctx);
