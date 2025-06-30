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
  ecrRepository: ecr.Repository;
  assetBucketArn: string;
  serviceUrl: string;
}

export class Batch extends Construct {
  public readonly jobDefinition: batch.EcsJobDefinition;
  public readonly jobQueue: batch.JobQueue;

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

    const computeEnvironment = new batch.FargateComputeEnvironment(this, 'ComputeEnvironment', {
      computeEnvironmentName: `etl-${envConfig.stackName}`,
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [batchSecurityGroup],
      maxvCpus: 128,
      serviceRole: batchServiceRole
    });

    this.jobDefinition = new batch.EcsJobDefinition(this, 'JobDefinition', {
      jobDefinitionName: `${envConfig.stackName}-data-job`,
      platformCapabilities: [batch.PlatformCapabilities.FARGATE],
      retryAttempts: 1,
      container: new batch.EcsFargateContainerDefinition(this, 'Container', {
        image: batch.ContainerImage.fromEcrRepository(ecrRepository, 'data-latest'),
        cpu: 1,
        memoryLimitMiB: 2048,
        jobRole: batchJobRole,
        executionRole: batchExecRole,
        readonlyRootFilesystem: false,
        environment: {
          'StackName': cdk.Stack.of(this).stackName,
          'TAK_ETL_URL': serviceUrl,
          'TAK_ETL_BUCKET': assetBucketArn.split(':')[5]
        }
      })
    });

    this.jobQueue = new batch.JobQueue(this, 'JobQueue', {
      jobQueueName: `${envConfig.stackName}-queue`,
      priority: 1,
      computeEnvironments: [{
        computeEnvironment: computeEnvironment,
        order: 1
      }]
    });
  }
}