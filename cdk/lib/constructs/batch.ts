import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import { ContextEnvironmentConfig } from '../stack-config';

export interface BatchProps {
  envConfig: ContextEnvironmentConfig;
  vpc: ec2.IVpc;
  ecrRepository: ecr.IRepository;
  dataImageAsset?: ecrAssets.DockerImageAsset;
  assetBucketName: string;
  serviceUrl: string;
}

export class Batch extends Construct {
  public readonly jobDefinition: batch.CfnJobDefinition;
  public readonly jobQueue: batch.CfnJobQueue;
  public readonly computeEnvironment: batch.CfnComputeEnvironment;

  constructor(scope: Construct, id: string, props: BatchProps) {
    super(scope, id);

    const { envConfig, vpc, ecrRepository, dataImageAsset, assetBucketName, serviceUrl } = props;

    const batchSecurityGroup = new ec2.SecurityGroup(this, 'BatchSecurityGroup', {
      vpc: vpc,
      description: `${envConfig.stackName} Batch Security Group`,
      allowAllOutbound: true
    });

    const batchServiceRole = new iam.Role(this, 'BatchServiceRole', {
      roleName: `TAK-${envConfig.stackName}-CloudTAK-batch-service`,
      assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole')
      ],
      path: '/service-role/'
    });

    const batchJobRole = new iam.Role(this, 'BatchJobRole', {
      roleName: `TAK-${envConfig.stackName}-CloudTAK-batch-job`,
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        new iam.ServicePrincipal('lambda.amazonaws.com')
      ),
      inlinePolicies: {
        'etl-policy': new iam.PolicyDocument({
          statements: [

            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket', 's3:GetBucketLocation'],
              resources: [`arn:${cdk.Stack.of(this).partition}:s3:::${assetBucketName}`, `arn:${cdk.Stack.of(this).partition}:s3:::${assetBucketName}/*`]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['ecr:GetAuthorizationToken', 'ecr:BatchCheckLayerAvailability', 'ecr:GetDownloadUrlForLayer', 'ecr:BatchGetImage'],
              resources: ['*']
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
              resources: [`arn:${cdk.Stack.of(this).partition}:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/aws/batch/*`]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
              resources: ['*'],
              conditions: {
                StringEquals: {
                  'kms:ViaService': [`s3.${cdk.Stack.of(this).region}.amazonaws.com`]
                }
              }
            })
          ]
        })
      }
    });

    const batchExecRole = new iam.Role(this, 'BatchExecRole', {
      roleName: `TAK-${envConfig.stackName}-CloudTAK-batch-exec`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ],

      path: '/service-role/'
    });

    // Get private subnets for Fargate
    const privateSubnets = vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS });

    this.computeEnvironment = new batch.CfnComputeEnvironment(this, 'ComputeEnvironment', {
      computeEnvironmentName: `TAK-${envConfig.stackName}-CloudTAK-compute-env`,
      type: 'MANAGED',
      state: 'ENABLED',
      serviceRole: batchServiceRole.roleArn,
      computeResources: {
        type: 'FARGATE',
        maxvCpus: 128,
        subnets: privateSubnets.subnetIds,
        securityGroupIds: [batchSecurityGroup.securityGroupId]
      }
    });

    // Determine container image source
    const containerImage = dataImageAsset 
      ? `${dataImageAsset.repository.repositoryUri}:${dataImageAsset.imageTag}`
      : (() => {
          const cloudtakImageTag = cdk.Stack.of(this).node.tryGetContext('cloudtakImageTag');
          const dataTag = cloudtakImageTag ? `data-${cloudtakImageTag}` : 'data-latest';
          return `${ecrRepository.repositoryUri}:${dataTag}`;
        })();
    
    this.jobDefinition = new batch.CfnJobDefinition(this, 'JobDefinition', {
      jobDefinitionName: `TAK-${envConfig.stackName}-CloudTAK-data-job`,
      type: 'container',
      platformCapabilities: ['FARGATE'],
      retryStrategy: { attempts: 1 },
      containerProperties: {
        image: containerImage,
        jobRoleArn: batchJobRole.roleArn,
        executionRoleArn: batchExecRole.roleArn,
        readonlyRootFilesystem: false,
        fargatePlatformConfiguration: {
          platformVersion: 'LATEST'
        },
        resourceRequirements: [
          { type: 'VCPU', value: '1' },
          { type: 'MEMORY', value: '2048' }
        ],
        environment: [
          { name: 'StackName', value: cdk.Stack.of(this).stackName },
          { name: 'TAK_ETL_URL', value: serviceUrl.startsWith('http') ? serviceUrl : `https://${serviceUrl}` },
          { name: 'TAK_ETL_BUCKET', value: assetBucketName }
        ]
      }
    });

    this.jobQueue = new batch.CfnJobQueue(this, 'JobQueue', {
      jobQueueName: `TAK-${envConfig.stackName}-CloudTAK-queue`,
      state: 'ENABLED',
      priority: 1,
      computeEnvironmentOrder: [{
        order: 1,
        computeEnvironment: this.computeEnvironment.ref
      }]
    });

    // Add dependencies
    this.jobDefinition.addDependency(this.computeEnvironment);
    this.jobQueue.addDependency(this.computeEnvironment);
  }
}