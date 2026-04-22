import * as path from 'path'
import * as cdk from 'aws-cdk-lib'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

// Prerequisites per environment — create these SSM parameters before first deploy:
//   /summarizinator/{env}/github-client-id       (GitHub OAuth app for data source connections)
//   /summarizinator/{env}/github-client-secret
//   /summarizinator/{env}/google-client-id       (Google OAuth app for Cognito federated login)
//   /summarizinator/{env}/google-client-secret   (SecureString)
//
// Also required: ACM certificate in us-east-1 covering the domain, passed via certArn.

export interface SummarizinatorStackConfig {
  stackEnv: 'dev' | 'prod'
  domainName: string   // e.g. "dev.summarizinator.com" or "summarizinator.com"
  certArn: string      // ACM cert ARN in us-east-1
}

interface SummarizinatorStackProps extends cdk.StackProps {
  config: SummarizinatorStackConfig
}

export class SummarizinatorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SummarizinatorStackProps) {
    super(scope, id, props)

    const { config } = props
    const ssmPrefix = `/summarizinator/${config.stackEnv}`

    const table = new dynamodb.Table(this, 'Table', {
      tableName: `summarizinator-${config.stackEnv}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttl',
    })

    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    })

    // ── Cognito ─────────────────────────────────────────────────────────────

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `summarizinator-${config.stackEnv}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength: 14,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    const googleClientId = ssm.StringParameter.valueForStringParameter(this, `${ssmPrefix}/google-client-id`)
    const googleClientSecret = ssm.StringParameter.valueForStringParameter(this, `${ssmPrefix}/google-client-secret`)
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
      userPool,
      clientId: googleClientId,
      clientSecretValue: cdk.SecretValue.unsafePlainText(googleClientSecret),
      scopes: ['email', 'profile', 'openid'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        fullname: cognito.ProviderAttribute.GOOGLE_NAME,
      },
    })

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: `summarizinator-spa-${config.stackEnv}`,
      generateSecret: false,
      authFlows: {
        userSrp: true,
        userPassword: false,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'http://localhost:5173/auth/callback',
          `https://${config.domainName}/auth/callback`,
        ],
        logoutUrls: [
          'http://localhost:5173',
          `https://${config.domainName}`,
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
      preventUserExistenceErrors: true,
    })
    userPoolClient.node.addDependency(googleProvider)

    new cognito.UserPoolDomain(this, 'UserPoolDomain', {
      userPool,
      cognitoDomain: { domainPrefix: `summarizinator-${config.stackEnv}` },
    })

    // ── Lambda functions ─────────────────────────────────────────────────────

    const githubClientId = ssm.StringParameter.valueForStringParameter(this, `${ssmPrefix}/github-client-id`)
    const githubClientSecret = ssm.StringParameter.valueForStringParameter(this, `${ssmPrefix}/github-client-secret`)
    const jiraClientId = ssm.StringParameter.valueForStringParameter(this, `${ssmPrefix}/jira-client-id`)
    const jiraClientSecret = ssm.StringParameter.valueForStringParameter(this, `${ssmPrefix}/jira-client-secret`)

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
      },
    }

    const connectionsFn = new NodejsFunction(this, 'ConnectionsFn', {
      ...lambdaDefaults,
      entry: path.join(handlerDir, 'connections.ts'),
      environment: {
        ...lambdaDefaults.environment,
        GITHUB_CLIENT_ID: githubClientId,
        GITHUB_CLIENT_SECRET: githubClientSecret,
        JIRA_CLIENT_ID: jiraClientId,
        JIRA_CLIENT_SECRET: jiraClientSecret,
      },
    })
    table.grantReadWriteData(connectionsFn)

    const projectsFn = new NodejsFunction(this, 'ProjectsFn', {
      ...lambdaDefaults,
      entry: path.join(handlerDir, 'projects.ts'),
    })
    table.grantReadWriteData(projectsFn)

    const BEDROCK_MODEL_ID = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'

    const updatesFn = new NodejsFunction(this, 'UpdatesFn', {
      ...lambdaDefaults,
      entry: path.join(handlerDir, 'updates.ts'),
      timeout: cdk.Duration.seconds(60),
      bundling: { ...lambdaDefaults.bundling, externalModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'] },
      environment: { ...lambdaDefaults.environment, BEDROCK_MODEL_ID, JIRA_CLIENT_ID: jiraClientId, JIRA_CLIENT_SECRET: jiraClientSecret },
    })
    table.grantReadWriteData(updatesFn)
    updatesFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    }))
    updatesFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['aws-marketplace:ViewSubscriptions', 'aws-marketplace:Subscribe', 'aws-marketplace:Unsubscribe'],
      resources: ['*'],
    }))

    // ── API Gateway ──────────────────────────────────────────────────────────

    const api = new apigwv2.HttpApi(this, 'Api', {
      apiName: `summarizinator-api-${config.stackEnv}`,
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    })

    const authorizer = new HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      {
        identitySource: ['$request.header.Authorization'],
        jwtAudience: [userPoolClient.userPoolClientId],
      },
    )

    const connectionsInt = new HttpLambdaIntegration('ConnectionsInt', connectionsFn)
    const projectsInt = new HttpLambdaIntegration('ProjectsInt', projectsFn)
    const updatesInt = new HttpLambdaIntegration('UpdatesInt', updatesFn)

    api.addRoutes({ path: '/api/connections', methods: [apigwv2.HttpMethod.GET], integration: connectionsInt, authorizer })
    api.addRoutes({ path: '/api/connections/github', methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST, apigwv2.HttpMethod.DELETE], integration: connectionsInt, authorizer })
    api.addRoutes({ path: '/api/connections/jira', methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST, apigwv2.HttpMethod.DELETE], integration: connectionsInt, authorizer })
    api.addRoutes({ path: '/api/connections/jira/projects', methods: [apigwv2.HttpMethod.GET], integration: connectionsInt, authorizer })
    api.addRoutes({ path: '/api/projects', methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST], integration: projectsInt, authorizer })
    api.addRoutes({ path: '/api/projects/{id}', methods: [apigwv2.HttpMethod.PATCH], integration: projectsInt, authorizer })
    api.addRoutes({ path: '/api/updates/generate', methods: [apigwv2.HttpMethod.POST], integration: updatesInt, authorizer })
    api.addRoutes({ path: '/api/updates/save', methods: [apigwv2.HttpMethod.POST], integration: updatesInt, authorizer })
    api.addRoutes({ path: '/api/projects/{projectId}/updates', methods: [apigwv2.HttpMethod.GET], integration: updatesInt, authorizer })
    api.addRoutes({ path: '/api/projects/{projectId}/events', methods: [apigwv2.HttpMethod.GET], integration: updatesInt, authorizer })
    api.addRoutes({ path: '/api/updates/{id}', methods: [apigwv2.HttpMethod.DELETE, apigwv2.HttpMethod.PATCH], integration: updatesInt, authorizer })

    // ── CloudFront + S3 ──────────────────────────────────────────────────────

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    const certificate = acm.Certificate.fromCertificateArn(this, 'Cert', config.certArn)
    const apiDomain = `${api.apiId}.execute-api.${this.region}.amazonaws.com`

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      domainNames: [config.domainName],
      certificate,
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
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    })

    new cdk.CfnOutput(this, 'SiteBucketName', { value: siteBucket.bucketName })
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId })
    new cdk.CfnOutput(this, 'AppUrl', { value: `https://${config.domainName}` })
    new cdk.CfnOutput(this, 'CloudFrontDomain', { value: distribution.distributionDomainName, description: 'Point your DNS CNAME here' })
    new cdk.CfnOutput(this, 'ApiEndpoint', { value: api.apiEndpoint })
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId })
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId })
    new cdk.CfnOutput(this, 'CognitoDomain', { value: `summarizinator-${config.stackEnv}.auth.${this.region}.amazoncognito.com` })
  }
}
