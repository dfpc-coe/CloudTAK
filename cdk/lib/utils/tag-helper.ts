import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface StandardTags {
  Project: string;
  Component: string;
  Environment: string;
  ManagedBy: string;
  StackName: string;
  Region: string;
}

export class TagHelper {
  static applyStandardTags(construct: Construct, tags: StandardTags): void {
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(construct).add(key, value);
    });
  }

  static createStandardTags(stackName: string, region: string): StandardTags {
    return {
      Project: 'TAK.NZ',
      Component: 'CloudTAK', 
      Environment: stackName,
      ManagedBy: 'CDK',
      StackName: stackName,
      Region: region
    };
  }
}