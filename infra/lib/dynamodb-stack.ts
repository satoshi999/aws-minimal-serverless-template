import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { AppContext } from "./app-context";

interface DynamoDbStackProps extends cdk.StackProps {
  ctx: AppContext;
}

export class DynamoDbStack extends cdk.Stack {
  public readonly todosTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamoDbStackProps) {
    super(scope, id, {
      ...props,
      // prodだけスタック削除保護（コンソールで解除しないとDeleteできない）
      terminationProtection: props.ctx.stage === "prod",
    });

    const { baseName, stage } = props.ctx;
    const isProd = stage === "prod";
    const rp = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    this.todosTable = new dynamodb.Table(this, "TodosTable", {
      tableName: `todos-${baseName}`,
      partitionKey: {
        name: "pk",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: rp,
    });
  }
}
