import * as path from 'path'
import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

// Prerequisites: create these SSM parameters before first deploy:
//   /summarizinator/github-client-id
//   /summarizinator/github-client-secret
//   /summarizinator/jwt-secret  (use a long random string)

export class SummarizinatorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const table = new dynamodb.Table(this, 'Table', {
      tableName: 'summarizinator',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    })

    const githubClientId = ssm.StringParameter.valueForStringParameter(this, '/summarizinator/github-client-id')
    const githubClientSecret = ssm.StringParameter.valueForStringParameter(this, '/summarizinator/github-client-secret')
    const jwtSecret = ssm.StringParameter.valueForStringParameter(this, '/summarizinator/jwt-secret')

    const handlerDir = path.join(__dirname, '../../backend/src/handlers')

    const lambdaDefaults = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      bundling: {
        minify: true,
        sourceMap: false,
        target: 'node20',
        externalModules: ['@aws-sdk/*'],
      },
      environment: {
        DYNAMODB_TABLE_NAME: table.tableName,
        JWT_SECRET: jwtSecret,
      },
    }

    const authFn = new NodejsFunction(this, 'AuthFn', {
      ...lambdaDefaults,
      entry: path.join(handlerDir, 'auth.ts'),
      environment: {
        ...lambdaDefaults.environment,
        GITHUB_CLIENT_ID: githubClientId,
        GITHUB_CLIENT_SECRET: githubClientSecret,
      },
    })
    table.grantReadWriteData(authFn)

    const projectsFn = new NodejsFunction(this, 'ProjectsFn', {
      ...lambdaDefaults,
      entry: path.join(handlerDir, 'projects.ts'),
    })
    table.grantReadWriteData(projectsFn)

    const BEDROCK_MODEL_ID = 'us.anthropic.claude-3-5-haiku-20241022-v1:0'

    const updatesFn = new NodejsFunction(this, 'UpdatesFn', {
      ...lambdaDefaults,
      entry: path.join(handlerDir, 'updates.ts'),
      timeout: cdk.Duration.seconds(60),
      // Bundle the Bedrock client — it may not be available in the base Lambda runtime
      bundling: { ...lambdaDefaults.bundling, externalModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'] },
      environment: { ...lambdaDefaults.environment, BEDROCK_MODEL_ID },
    })
    table.grantReadWriteData(updatesFn)
    updatesFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    }))

    const api = new apigwv2.HttpApi(this, 'Api', {
      apiName: 'summarizinator-api',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    })

    api.addRoutes({
      path: '/api/auth/token',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('AuthInt', authFn),
    })
    api.addRoutes({
      path: '/api/projects',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('ProjectsInt', projectsFn),
    })
    api.addRoutes({
      path: '/api/updates/generate',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('UpdatesGenerateInt', updatesFn),
    })
    api.addRoutes({
      path: '/api/updates/{id}/regenerate',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('UpdatesRegenerateInt', updatesFn),
    })
    api.addRoutes({
      path: '/api/projects/{projectId}/updates',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('ProjectUpdatesInt', updatesFn),
    })

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    const apiDomain = `${api.apiId}.execute-api.${this.region}.amazonaws.com`

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(apiDomain),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      // SPA fallback: return index.html for 403/404 so React Router handles the route
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    })

    new cdk.CfnOutput(this, 'SiteBucketName', { value: siteBucket.bucketName })
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId })
    new cdk.CfnOutput(this, 'AppUrl', { value: `https://${distribution.distributionDomainName}` })
    new cdk.CfnOutput(this, 'ApiEndpoint', { value: api.apiEndpoint })
  }
}
