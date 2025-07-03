#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

console.log('Creating app...');
const app = new cdk.App();

console.log('Getting context...');
const envName = app.node.tryGetContext('envType') || 'dev-test';
const envConfig = app.node.tryGetContext(envName);

console.log('Environment:', envName);
console.log('Config found:', !!envConfig);

if (!envConfig) {
  console.log('No config found, exiting');
  process.exit(1);
}

console.log('Creating minimal stack...');
const stack = new cdk.Stack(app, 'TestStack', {
  env: {
    region: 'ap-southeast-2'
  }
});

console.log('Stack created successfully');