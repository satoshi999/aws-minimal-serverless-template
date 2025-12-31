import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { AppContext } from "../bin/infra";

interface DynamoDbStackProps extends cdk.StackProps {
  ctx: AppContext;
}

export class DynamoDbStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DynamoDbStackProps) {
    super(scope, id, {
      ...props,
      // prodだけスタック削除保護（コンソールで解除しないとDeleteできない）
      terminationProtection: props.ctx.envName === "prod",
    });

    const { baseName, envName } = props.ctx;
    const isProd = envName === "prod";
    const rp = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    new dynamodb.Table(this, `TodosTable-${baseName}`, {
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
