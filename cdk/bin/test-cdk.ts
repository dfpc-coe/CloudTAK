#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

const app = new cdk.App();

// Get environment from context (defaults to dev-test)
const envName = app.node.tryGetContext('envType') || 'dev-test';
const envConfig = app.node.tryGetContext(envName);

if (!envConfig) {
  throw new Error(`Environment configuration for '${envName}' not found`);
}

// Create minimal stack
const stack = new cdk.Stack(app, `TAK-${envConfig.stackName}-CloudTAK`, {
  env: {
    region: 'ap-southeast-2'
  }
});

console.log('Stack created successfully');