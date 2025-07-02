import * as cdk from 'aws-cdk-lib';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ecr from 'aws-cdk-lib/aws-ecr';

export interface OutputsProps {
  stack: cdk.Stack;
  serviceUrl: string;
  loadBalancer: elbv2.ApplicationLoadBalancer;
  database: rds.DatabaseCluster;
  assetBucket: s3.Bucket;
  ecrRepository: ecr.Repository;
}

export function registerOutputs(props: OutputsProps): void {
  const { stack, serviceUrl, loadBalancer, database, assetBucket, ecrRepository } = props;

  new cdk.CfnOutput(stack, 'ServiceURL', {
    value: serviceUrl,
    description: 'CloudTAK Service HTTPS URL',
    exportName: `${stack.stackName}-ServiceURL`
  });



  new cdk.CfnOutput(stack, 'DatabaseEndpoint', {
    value: database.clusterEndpoint.hostname,
    description: 'Database Cluster Endpoint',
    exportName: `${stack.stackName}-DatabaseEndpoint`
  });

  new cdk.CfnOutput(stack, 'AssetBucket', {
    value: assetBucket.bucketName,
    description: 'S3 Asset Bucket Name',
    exportName: `${stack.stackName}-AssetBucket`
  });

  new cdk.CfnOutput(stack, 'ECRRepository', {
    value: ecrRepository.repositoryUri,
    description: 'ECR Repository URI',
    exportName: `${stack.stackName}-ECRRepository`
  });
}