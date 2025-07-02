import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { ContextEnvironmentConfig } from '../stack-config';

export interface BatchProps {
  envConfig: ContextEnvironmentConfig;
  vpc: ec2.IVpc;
  ecrRepository: ecr.IRepository;
  assetBucketArn: string;
  serviceUrl: string;
}

export class Batch extends Construct {
  public readonly jobDefinition: batch.CfnJobDefinition;
  public readonly jobQueue: batch.CfnJobQueue;
  public readonly computeEnvironment: batch.CfnComputeEnvironment;

  constructor(scope: Construct, id: string, props: BatchProps) {
    super(scope, id);

    const { envConfig, vpc, ecrRepository, assetBucketArn, serviceUrl } = props;

    const batchSecurityGroup = new ec2.SecurityGroup(this, 'BatchSecurityGroup', {
      vpc: vpc,
      description: `${envConfig.stackName} Batch Security Group`,
      allowAllOutbound: true
    });

    const batchServiceRole = new iam.Role(this, 'BatchServiceRole', {
      assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole')
      ],
      path: '/service-role/'
    });

    const batchJobRole = new iam.Role(this, 'BatchJobRole', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        new iam.ServicePrincipal('lambda.amazonaws.com')
      ),
      inlinePolicies: {
        'etl-policy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['batch:DescribeJobs'],
              resources: ['*']
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:*'],
              resources: [assetBucketArn, `${assetBucketArn}/*`]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['ecs:DescribeContainerInstances'],
              resources: ['*']
            })
          ]
        })
      }
    });

    const batchExecRole = new iam.Role(this, 'BatchExecRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ]
    });

    // Get private subnets for Fargate
    const privateSubnets = vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS });

    this.computeEnvironment = new batch.CfnComputeEnvironment(this, 'ComputeEnvironment', {
      computeEnvironmentName: `etl-${envConfig.stackName}`,
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

    this.jobDefinition = new batch.CfnJobDefinition(this, 'JobDefinition', {
      jobDefinitionName: `${envConfig.stackName}-data-job`,
      type: 'container',
      platformCapabilities: ['FARGATE'],
      retryStrategy: { attempts: 1 },
      containerProperties: {
        image: `${ecrRepository.repositoryUri}:data-latest`,
        vcpus: 1,
        memory: 2048,
        jobRoleArn: batchJobRole.roleArn,
        executionRoleArn: batchExecRole.roleArn,
        readonlyRootFilesystem: false,
        networkConfiguration: {
          assignPublicIp: 'DISABLED'
        },
        fargatePlatformConfiguration: {
          platformVersion: 'LATEST'
        },
        environment: [
          { name: 'StackName', value: cdk.Stack.of(this).stackName },
          { name: 'TAK_ETL_URL', value: serviceUrl },
          { name: 'TAK_ETL_BUCKET', value: assetBucketArn.split(':')[5] }
        ]
      }
    });

    this.jobQueue = new batch.CfnJobQueue(this, 'JobQueue', {
      jobQueueName: `${envConfig.stackName}-queue`,
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