import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
  Fn,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import type { AppContext } from "./app-context";

export interface WebStackProps extends StackProps {
  ctx: AppContext;

  // Lambda Function URL（ApiLambdaStack から渡す）
  apiFunctionUrl: string;

  // Vite build成果物（"/frontend/dist"）
  frontendDistDir: string;
}

export class WebStack extends Stack {
  public readonly distributionDomainName: string;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const { ctx } = props;

    const bucket = new s3.Bucket(this, "WebBucket", {
      bucketName: ctx.baseName.toLowerCase(),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy:
        ctx.stage === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: ctx.stage === "prod" ? false : true,
    });

    const oai = new cloudfront.OriginAccessIdentity(this, "OAI");
    bucket.grantRead(oai);

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

    // Function URL を CloudFront の HTTP Origin にする
    const apiHost = Fn.select(2, Fn.split("/", props.apiFunctionUrl));
    const apiOrigin = new origins.HttpOrigin(apiHost, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    // API はキャッシュさせない（JWT/ユーザ依存のため）
    const apiCachePolicy = new cloudfront.CachePolicy(this, "ApiCachePolicy", {
      defaultTtl: Duration.seconds(0),
      minTtl: Duration.seconds(0),
      maxTtl: Duration.seconds(1),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList("Authorization"),
      // Accept-Encoding はここで制御（ヘッダ名を allowList しない）
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Authorization などをオリジンに渡す
    const apiOriginRequestPolicy = new cloudfront.OriginRequestPolicy(
      this,
      "ApiOriginRequestPolicy",
      {
        cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
        queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
        headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
          "Content-Type",
          "Origin",
          "Referer",
          "Access-Control-Request-Method",
          "Access-Control-Request-Headers"
        ),
      }
    );

    // --------
    // CloudFront Distribution
    // --------
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },

      // /api* は Lambda Function URL に転送
      additionalBehaviors: {
        "/api*": {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: apiCachePolicy,
          originRequestPolicy: apiOriginRequestPolicy,
        },
      },

      // SPA fallback（/foo 直叩き → index.html）
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.seconds(0),
        },
      ],
    });

    // dist を S3 にアップロードし、CDNを無効化
    new s3deploy.BucketDeployment(this, "DeployFrontend", {
      sources: [s3deploy.Source.asset(props.frontendDistDir)],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ["/*"],
    });

    this.distributionDomainName = distribution.domainName;

    new CfnOutput(this, "CloudFrontDomain", {
      value: this.distributionDomainName,
    });
    new CfnOutput(this, "ApiFunctionUrl", { value: props.apiFunctionUrl });
  }
}
