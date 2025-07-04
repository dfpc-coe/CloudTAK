import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export interface AuthentikUserCreatorProps {
  stackName: string;
  adminPasswordSecret: secretsmanager.ISecret;
  authentikUrl: string;
}

export class AuthentikUserCreator extends Construct {
  constructor(scope: Construct, id: string, props: AuthentikUserCreatorProps) {
    super(scope, id);

    const { stackName, adminPasswordSecret, authentikUrl } = props;

    const createUserLambda = new lambda.Function(this, 'Function', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(5),
      code: lambda.Code.fromInline(`
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retry = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, i);
      console.log(\`Attempt \${i + 1} failed, retrying in \${delay}ms: \${error.message}\`);
      await sleep(delay);
    }
  }
};

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  if (event.RequestType === 'Delete') {
    return { PhysicalResourceId: 'authentik-user' };
  }
  
  try {
    const secrets = new SecretsManagerClient({ region: process.env.AWS_REGION });
    
    const [apiTokenResponse, adminCredsResponse] = await Promise.all([
      retry(() => secrets.send(new GetSecretValueCommand({
        SecretId: event.ResourceProperties.AuthStackName + '/Authentik/Admin-API-Token'
      }))),
      retry(() => secrets.send(new GetSecretValueCommand({
        SecretId: event.ResourceProperties.AdminSecretName
      })))
    ]);
    
    const creds = JSON.parse(adminCredsResponse.SecretString);
    const apiToken = apiTokenResponse.SecretString;
    
    // Check if user exists
    const existingUsers = await retry(async () => {
      const response = await fetch(event.ResourceProperties.AuthentikUrl + '/api/v3/core/users/?username=' + creds.username, {
        headers: {
          'Authorization': 'Bearer ' + apiToken,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(\`Check user failed: \${response.status} \${await response.text()}\`);
      return response.json();
    });
    
    if (existingUsers.results?.length > 0) {
      console.log('User already exists');
      return { PhysicalResourceId: 'authentik-user-' + creds.username };
    }
    
    // Create user
    const user = await retry(async () => {
      const response = await fetch(event.ResourceProperties.AuthentikUrl + '/api/v3/core/users/', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: creds.username,
          name: creds.username,
          email: creds.username + '@tak.nz',
          is_active: true,
          is_staff: true,
          is_superuser: true,
          password: creds.password
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(\`Create user failed: \${response.status} \${error}\`);
      }
      
      return response.json();
    });
    
    console.log('Created Authentik user:', user.username);
    return { PhysicalResourceId: 'authentik-user-' + user.username };
    
  } catch (error) {
    const errorMsg = \`Failed to create Authentik user after retries: \${error.message}. Check: 1) AuthInfra stack deployed, 2) Authentik API token exists, 3) Authentik URL accessible: \${event.ResourceProperties?.AuthentikUrl}\`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
};
      `)
    });

    // Grant permissions
    adminPasswordSecret.grantRead(createUserLambda);
    createUserLambda.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [`arn:${cdk.Stack.of(this).partition}:secretsmanager:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:secret:TAK-${stackName}-AuthInfra/Authentik/Admin-API-Token-*`]
    }));
    
    // Grant KMS permissions for decrypting secrets
    createUserLambda.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: ['kms:Decrypt'],
      resources: ['*'],
      conditions: {
        StringEquals: {
          'kms:ViaService': `secretsmanager.${cdk.Stack.of(this).region}.amazonaws.com`
        }
      }
    }));

    // Create custom resource
    new cr.AwsCustomResource(this, 'CustomResource', {
      onCreate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: createUserLambda.functionName,
          Payload: JSON.stringify({
            ResourceProperties: {
              AuthStackName: `TAK-${stackName}-AuthInfra`,
              AdminSecretName: adminPasswordSecret.secretName,
              AuthentikUrl: authentikUrl
            },
            RequestType: 'Create'
          })
        },
        physicalResourceId: cr.PhysicalResourceId.of('authentik-user-creation')
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: [createUserLambda.functionArn]
        })
      ])
    });
  }
}