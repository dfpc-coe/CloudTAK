import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import { CLOUDTAK_CONSTANTS } from '../utils/constants';

export interface AuthentikUserCreatorProps {
  stackName: string;
  adminPasswordSecret: secretsmanager.ISecret;
  authentikUrl: string;
  takAdminEmail: string;
}

export class AuthentikUserCreator extends Construct {
  constructor(scope: Construct, id: string, props: AuthentikUserCreatorProps) {
    super(scope, id);

    const { stackName, adminPasswordSecret, authentikUrl, takAdminEmail } = props;

    const createUserLambda = new lambda.Function(this, 'Function', {
      functionName: `${cdk.Stack.of(this).stackName}-AuthentikUserCreator`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(5),
      code: lambda.Code.fromInline(`
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const DEFAULT_ADMIN_DISPLAY_NAME = 'CloudTAK Default Admin';

const log = (level, message, data = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...data
  };
  console.log(JSON.stringify(logEntry));
};

const sendResponse = async (event, context, responseStatus, responseData = {}, physicalResourceId) => {
  const responseBody = JSON.stringify({
    Status: responseStatus,
    Reason: responseStatus === 'FAILED' ? responseData.Error : 'OK',
    PhysicalResourceId: physicalResourceId || context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData
  });
  
  log('debug', 'Sending CloudFormation response', { responseStatus, physicalResourceId });
  
  const https = require('https');
  const url = require('url');
  const parsedUrl = url.parse(event.ResponseURL);
  
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.path,
    method: 'PUT',
    headers: {
      'content-type': '',
      'content-length': responseBody.length
    }
  };
  
  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      log('debug', 'CloudFormation response sent', { statusCode: response.statusCode });
      resolve();
    });
    
    request.on('error', (error) => {
      log('error', 'Error sending CloudFormation response', { error: error.message });
      reject(error);
    });
    
    request.write(responseBody);
    request.end();
  });
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retry = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, i);
      log('warn', 'Retry attempt failed', { attempt: i + 1, maxRetries, retryDelay: delay, error: error.message });
      await sleep(delay);
    }
  }
};

exports.handler = async (event, context) => {
  log('info', 'Authentik user creator started', { requestType: event.RequestType });
  
  try {
    if (event.RequestType === 'Delete') {
      log('info', 'Delete request received, no action needed');
      await sendResponse(event, context, 'SUCCESS', {}, 'authentik-user-deletion');
      return;
    }
    
    const { AuthStackName, AdminSecretName, AuthentikUrl, AdminEmail } = event.ResourceProperties;
    log('debug', 'Configuration loaded', { AuthStackName, AdminSecretName, AuthentikUrl, AdminEmail });
    
    if (!AuthStackName || !AdminSecretName || !AuthentikUrl || !AdminEmail) {
      throw new Error('Missing required properties: AuthStackName, AdminSecretName, AuthentikUrl, or AdminEmail');
    }
    
    const secrets = new SecretsManagerClient({ region: process.env.AWS_REGION });
    const apiTokenSecretId = AuthStackName + '/Authentik/Admin-API-Token';
    
    log('debug', 'Fetching secrets from AWS Secrets Manager', { apiTokenSecretId, AdminSecretName });
    
    const [apiTokenResponse, adminCredsResponse] = await Promise.all([
      retry(() => secrets.send(new GetSecretValueCommand({ SecretId: apiTokenSecretId }))),
      retry(() => secrets.send(new GetSecretValueCommand({ SecretId: AdminSecretName })))
    ]);
    
    const creds = JSON.parse(adminCredsResponse.SecretString);
    const apiToken = apiTokenResponse.SecretString;
    
    log('info', 'Secrets retrieved successfully', { username: creds.username, apiTokenLength: apiToken?.length || 0 });
    
    // Check if user exists
    const checkUrl = AuthentikUrl + '/api/v3/core/users/?username=' + encodeURIComponent(creds.username);
    
    log('debug', 'Making HTTP request', { url: checkUrl, method: 'GET', hasAuth: true });
    
    const existingUsers = await retry(async () => {
      const response = await fetch(checkUrl, {
        headers: {
          'Authorization': 'Bearer ' + apiToken,
          'Content-Type': 'application/json'
        }
      });
      
      log('debug', 'HTTP response received', { 
        statusCode: response.status, 
        contentLength: response.headers.get('content-length') || 'unknown',
        url: checkUrl
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        log('error', 'Check user request failed', { statusCode: response.status, error: errorText });
        throw new Error(\`Check user failed: \${response.status} \${errorText}\`);
      }
      
      return response.json();
    });
    
    let user;
    
    if (existingUsers.results?.length > 0) {
      // Update existing user password using set_password endpoint
      const existingUser = existingUsers.results[0];
      const setPasswordUrl = AuthentikUrl + '/api/v3/core/users/' + existingUser.pk + '/set_password/';
      
      log('info', 'User already exists, updating password', { username: creds.username, userId: existingUser.pk });
      log('debug', 'Making HTTP request', { url: setPasswordUrl, method: 'POST', hasAuth: true });
      
      await retry(async () => {
        const response = await fetch(setPasswordUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + apiToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ password: creds.password })
        });
        
        log('debug', 'HTTP response received', { 
          statusCode: response.status, 
          contentLength: response.headers.get('content-length') || 'unknown',
          url: setPasswordUrl
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          log('error', 'Set password request failed', { statusCode: response.status, error: errorText });
          throw new Error(\`Set password failed: \${response.status} \${errorText}\`);
        }
      });
      
      user = existingUser;
      log('info', 'Authentik user password updated successfully', { username: user.username, userId: user.pk });
    } else {
      // Create new user without password
      const createUrl = AuthentikUrl + '/api/v3/core/users/';
      const userData = {
        username: creds.username,
        name: DEFAULT_ADMIN_DISPLAY_NAME,
        email: AdminEmail,
        is_active: true,
        is_staff: true,
        is_superuser: false
      };
      
      log('info', 'Creating new Authentik user', { username: creds.username, email: userData.email });
      log('debug', 'Making HTTP request', { url: createUrl, method: 'POST', hasAuth: true });
      
      user = await retry(async () => {
        const response = await fetch(createUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + apiToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(userData)
        });
        
        log('debug', 'HTTP response received', { 
          statusCode: response.status, 
          contentLength: response.headers.get('content-length') || 'unknown',
          url: createUrl
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          log('error', 'Create user request failed', { statusCode: response.status, error: errorText });
          throw new Error(\`Create user failed: \${response.status} \${errorText}\`);
        }
        
        return response.json();
      });
      
      log('info', 'Authentik user created successfully', { username: user.username, userId: user.pk });
      
      // Set password for newly created user
      const setPasswordUrl = AuthentikUrl + '/api/v3/core/users/' + user.pk + '/set_password/';
      
      log('info', 'Setting password for new user', { username: creds.username, userId: user.pk });
      log('debug', 'Making HTTP request', { url: setPasswordUrl, method: 'POST', hasAuth: true });
      
      await retry(async () => {
        const response = await fetch(setPasswordUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + apiToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ password: creds.password })
        });
        
        log('debug', 'HTTP response received', { 
          statusCode: response.status, 
          contentLength: response.headers.get('content-length') || 'unknown',
          url: setPasswordUrl
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          log('error', 'Set password request failed', { statusCode: response.status, error: errorText });
          throw new Error(\`Set password failed: \${response.status} \${errorText}\`);
        }
      });
      
      log('info', 'Password set successfully for new user', { username: user.username, userId: user.pk });
    }
    
    await sendResponse(event, context, 'SUCCESS', { 
      message: existingUsers.results?.length > 0 ? 'User password updated successfully' : 'User created and password set successfully',
      username: user.username,
      userId: user.pk
    }, 'authentik-user-' + user.username);
    
  } catch (error) {
    log('error', 'Failed to create Authentik user', { 
      error: error.message,
      stack: error.stack,
      resourceProperties: event.ResourceProperties
    });
    
    const errorData = {
      Error: error.message,
      Details: 'Check CloudWatch logs for full error details'
    };
    
    await sendResponse(event, context, 'FAILED', errorData);
  }
  
  log('info', 'Authentik user creator completed');
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

    // Create custom resource provider
    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler: createUserLambda
    });

    // Create custom resource
    new cdk.CustomResource(this, 'CustomResource', {
      serviceToken: provider.serviceToken,
      properties: {
        AuthStackName: `TAK-${stackName}-AuthInfra`,
        AdminSecretName: adminPasswordSecret.secretName,
        AuthentikUrl: authentikUrl,
        AdminEmail: takAdminEmail,
        // Force update on every deployment to ensure user creation is attempted
        Timestamp: Date.now().toString()
      }
    });
  }
}