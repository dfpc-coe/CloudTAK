import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { ContextEnvironmentConfig } from '../stack-config';

export interface LambdaFunctionsProps {
  envConfig: ContextEnvironmentConfig;
  ecrRepository: ecr.IRepository;
  assetBucketArn: string;
  serviceUrl: string;
  signingSecret: secretsmanager.ISecret;
}

export class LambdaFunctions extends Construct {
  public readonly eventLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaFunctionsProps) {
    super(scope, id);

    const { envConfig, ecrRepository, assetBucketArn, serviceUrl, signingSecret } = props;

    const eventLambdaRole = new iam.Role(this, 'EventLambdaRole', {
      roleName: `${envConfig.stackName}-events`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        'hook-queue': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:*'],
              resources: [
                `arn:${cdk.Stack.of(this).partition}:s3:::${envConfig.stackName}-${cdk.Stack.of(this).account}-${cdk.Stack.of(this).region}`,
                `arn:${cdk.Stack.of(this).partition}:s3:::${envConfig.stackName}-${cdk.Stack.of(this).account}-${cdk.Stack.of(this).region}/*`
              ]
            })
          ]
        })
      },
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    this.eventLambda = new lambda.Function(this, 'EventLambda', {
      functionName: `${envConfig.stackName}-events`,
      runtime: lambda.Runtime.FROM_IMAGE,
      code: lambda.Code.fromEcrImage(ecrRepository, {
        tagOrDigest: 'events-latest'
      }),
      handler: lambda.Handler.FROM_IMAGE,
      role: eventLambdaRole,
      memorySize: 512,
      timeout: cdk.Duration.minutes(15),
      description: 'Respond to events on the S3 Asset Bucket & Stack SQS Queue',
      reservedConcurrentExecutions: 20,
      environment: {
        'TAK_ETL_API': serviceUrl,
        'StackName': cdk.Stack.of(this).stackName,
        'SigningSecret': signingSecret.secretValue.unsafeUnwrap()
      }
    });
  }
}