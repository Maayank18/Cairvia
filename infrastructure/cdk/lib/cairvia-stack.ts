import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Auth from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as apigwv2Int from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";

const repoRoot = path.resolve(__dirname, "../../..");

export class CairviaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const demoPassword = this.node.tryGetContext("demoPassword") as
      | string
      | undefined;

    const table = new dynamodb.Table(this, "WorkThreadTable", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING }
    });
    table.addGlobalSecondaryIndex({
      indexName: "GSI2",
      partitionKey: { name: "GSI2PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI2SK", type: dynamodb.AttributeType.STRING }
    });

    const artifacts = new s3.Bucket(this, "Artifacts", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    const userPool = new cognito.UserPool(this, "Users", {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    const userPoolClient = userPool.addClient("WebClient", {
      authFlows: { userPassword: true, userSrp: true },
      preventUserExistenceErrors: true
    });
    if (demoPassword) {
      new cognito.CfnUserPoolUser(this, "DemoUser", {
        userPoolId: userPool.userPoolId,
        username: "demo@cairvia.dev",
        messageAction: "SUPPRESS",
        userAttributes: [
          { name: "email", value: "demo@cairvia.dev" },
          { name: "email_verified", value: "true" }
        ]
      });
    }

    const bus = new events.EventBus(this, "CairviaBus", {
      eventBusName: "cairvia"
    });

    const bundling = {
      minify: true,
      sourceMap: false,
      format: OutputFormat.CJS,
      target: "node22",
      mainFields: ["module", "main"] as string[],
      externalModules: ["@aws-sdk/*"]
    };

    const env = {
      TABLE_NAME: table.tableName,
      EVENT_BUS_NAME: bus.eventBusName,
      ARTIFACT_BUCKET: artifacts.bucketName,
      CAIRVIA_WEB_ORIGIN: "http://127.0.0.1:5173",
      BEDROCK_MODEL_ID:
        process.env.BEDROCK_MODEL_ID ??
        "anthropic.claude-3-5-sonnet-20241022-v2:0"
    };

    const httpFn = new NodejsFunction(this, "HttpFn", {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, "services/cloud-api/src/handlers/http.ts"),
      handler: "handler",
      memorySize: 512,
      timeout: cdk.Duration.seconds(15),
      logRetention: logs.RetentionDays.ONE_WEEK,
      projectRoot: repoRoot,
      depsLockFilePath: path.join(repoRoot, "pnpm-lock.yaml"),
      bundling,
      environment: env
    });
    const extractFn = new NodejsFunction(this, "ExtractFn", {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, "services/cloud-api/src/handlers/workflow.ts"),
      handler: "extractHandler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      logRetention: logs.RetentionDays.ONE_WEEK,
      projectRoot: repoRoot,
      depsLockFilePath: path.join(repoRoot, "pnpm-lock.yaml"),
      bundling,
      environment: env
    });
    const tokenFn = new NodejsFunction(this, "TokenFn", {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, "services/cloud-api/src/handlers/workflow.ts"),
      handler: "recordTokenHandler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      logRetention: logs.RetentionDays.ONE_WEEK,
      projectRoot: repoRoot,
      depsLockFilePath: path.join(repoRoot, "pnpm-lock.yaml"),
      bundling,
      environment: env
    });
    const applyFn = new NodejsFunction(this, "ApplyFn", {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(repoRoot, "services/cloud-api/src/handlers/workflow.ts"),
      handler: "applyHandler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      logRetention: logs.RetentionDays.ONE_WEEK,
      projectRoot: repoRoot,
      depsLockFilePath: path.join(repoRoot, "pnpm-lock.yaml"),
      bundling,
      environment: env
    });
    const agentFn = new NodejsFunction(this, "AgentRuntimeFn", {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(
        repoRoot,
        "services/agent-runtime/src/handlers/runtime.ts"
      ),
      handler: "handler",
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_WEEK,
      projectRoot: repoRoot,
      depsLockFilePath: path.join(repoRoot, "pnpm-lock.yaml"),
      bundling: {
        ...bundling,
        nodeModules: ["@strands-agents/sdk"]
      },
      environment: env
    });

    for (const fn of [httpFn, extractFn, tokenFn, applyFn, agentFn]) {
      table.grantReadWriteData(fn);
      artifacts.grantReadWrite(fn);
      bus.grantPutEventsTo(fn);
    }
    agentFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
        resources: ["*"]
      })
    );

    const extract = new tasks.LambdaInvoke(this, "ReceiveAndExtract", {
      lambdaFunction: extractFn,
      payloadResponseOnly: true,
      retryOnServiceExceptions: true
    });
    extract.addRetry({ maxAttempts: 2, interval: cdk.Duration.seconds(2) });

    const waitDecision = new tasks.LambdaInvoke(this, "WaitForUserDecision", {
      lambdaFunction: tokenFn,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      payload: sfn.TaskInput.fromObject({
        token: sfn.JsonPath.taskToken,
        userId: sfn.JsonPath.stringAt("$.userId"),
        commitmentId: sfn.JsonPath.stringAt("$.commitmentId"),
        threadId: sfn.JsonPath.stringAt("$.threadId")
      })
    });

    const apply = new tasks.LambdaInvoke(this, "ApplyApproval", {
      lambdaFunction: applyFn,
      payloadResponseOnly: true
    });
    apply.addRetry({ maxAttempts: 2, interval: cdk.Duration.seconds(2) });

    const skipped = new sfn.Succeed(this, "SkippedLowConfidence");
    const definition = extract.next(
      new sfn.Choice(this, "ValidateConfidence")
        .when(sfn.Condition.booleanEquals("$.valid", true), waitDecision.next(apply))
        .otherwise(skipped)
    );

    const logGroup = new logs.LogGroup(this, "CommitmentFlowLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    const stateMachine = new sfn.StateMachine(this, "CommitmentFlow", {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      tracingEnabled: true,
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL
      }
    });
    httpFn.addEnvironment("STATE_MACHINE_ARN", stateMachine.stateMachineArn);
    httpFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["states:SendTaskSuccess", "states:SendTaskFailure"],
        resources: [stateMachine.stateMachineArn]
      })
    );

    new events.Rule(this, "ContextCapturedRule", {
      eventBus: bus,
      eventPattern: {
        source: ["cairvia.browser"],
        detailType: ["ContextCaptured"]
      },
      targets: [
        new targets.SfnStateMachine(stateMachine, {
          input: events.RuleTargetInput.fromEventPath("$.detail")
        })
      ]
    });

    const httpApi = new apigwv2.HttpApi(this, "CairviaHttpApi", {
      apiName: "cairvia-v1",
      corsPreflight: {
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.OPTIONS
        ],
        allowOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"],
        maxAge: cdk.Duration.days(1)
      }
    });
    const authorizer = new apigwv2Auth.HttpJwtAuthorizer(
      "CognitoJwt",
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      { jwtAudience: [userPoolClient.userPoolClientId] }
    );
    const httpIntegration = new apigwv2Int.HttpLambdaIntegration(
      "HttpIntegration",
      httpFn
    );
    const agentIntegration = new apigwv2Int.HttpLambdaIntegration(
      "AgentIntegration",
      agentFn
    );
    httpApi.addRoutes({
      path: "/health",
      methods: [apigwv2.HttpMethod.GET],
      integration: httpIntegration
    });
    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: httpIntegration,
      authorizer
    });
    httpApi.addRoutes({
      path: "/v1/agent/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: agentIntegration,
      authorizer
    });

    new cdk.CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId
    });
    new cdk.CfnOutput(this, "TableName", { value: table.tableName });
    new cdk.CfnOutput(this, "EventBusName", { value: bus.eventBusName });
    new cdk.CfnOutput(this, "StateMachineArn", {
      value: stateMachine.stateMachineArn
    });
    new cdk.CfnOutput(this, "ArtifactBucket", { value: artifacts.bucketName });
    new cdk.CfnOutput(this, "AgentRuntimeNote", {
      value:
        "AgentCore Gateway is not wired: tools are bounded Lambda functions. This Lambda implements the AgentCore Runtime HTTP contract (/v1/agent/ping, /v1/agent/invocations). DynamoDB remains canonical Work Thread state."
    });
  }
}
