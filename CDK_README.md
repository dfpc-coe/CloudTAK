# CloudTAK CDK Implementation

This branch implements CloudTAK deployment using CDK, integrating with BaseInfra/AuthInfra/TakInfra foundation stacks.

## Architecture

```
BaseInfra (VPC, ECS, ECR, KMS, S3, ACM)
    ↓
CloudTAK (API, Database, Load Balancer)
```

## Prerequisites

1. **BaseInfra stack deployed** with exports:
   - `TAK-{StackName}-BaseInfra-VpcId`
   - `TAK-{StackName}-BaseInfra-SubnetPublicA/B`
   - `TAK-{StackName}-BaseInfra-SubnetPrivateA/B`
   - `TAK-{StackName}-BaseInfra-KmsKey`
   - `TAK-{StackName}-BaseInfra-HostedZoneId/Name`
   - `TAK-{StackName}-BaseInfra-CertificateArn`

2. **AWS CLI configured**
3. **CDK CLI installed**: `npm install -g aws-cdk`
4. **Docker running** (for container builds)

## Quick Start

```bash
# Deploy everything
./scripts/deploy.sh --environment dev-test --stack-name DevTest

# Deploy to production
./scripts/deploy.sh --environment prod --stack-name Prod

# Skip container building (use existing images)
./scripts/deploy.sh --skip-build
```

## Manual Steps

### 1. Install Dependencies
```bash
cd cdk
npm install
```

### 2. Build Container Images
```bash
# Set environment variables
export GITSHA=$(git rev-parse --short HEAD)
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=ap-southeast-2
export Environment=dev-test

# Build images
node bin/build.js
```

### 3. Apply Resource Name Patches
```bash
# Patch hardcoded resource names for CDK compatibility
export ECR_TASKS_REPOSITORY_NAME="coe-ecr-etl"
export ECS_CLUSTER_PREFIX="TAK-DevTest-BaseInfra"
./scripts/patch-resource-names.sh
```

### 4. Deploy CDK Stack
```bash
cd cdk
npm run build
cdk deploy --context environment=dev-test --context stackName=DevTest
```

## Configuration

### Environment Variables
- `ECR_TASKS_REPOSITORY_NAME`: ECR repository for task containers (default: `coe-ecr-etl`)
- `ECS_CLUSTER_PREFIX`: ECS cluster naming prefix (default: `TAK-DevTest-BaseInfra`)

### CDK Context
- `environment`: `prod` or `dev-test`
- `stackName`: Stack name component (e.g., `DevTest`, `Prod`)
- `domainName`: Domain name (default: `tak.nz`)
- `subdomain`: Subdomain for CloudTAK (default: `cloudtak`)

## Resource Naming Bridge

The implementation includes automatic patching of hardcoded resource names in the CloudTAK API:

### What Gets Patched
- `api/lib/aws/ecr.ts`: ECR repository names
- `api/lib/aws/ecs-video.ts`: ECS cluster references  
- `api/lib/aws/lambda.ts`: Lambda ECR image URIs
- `api/test/task.srv.test.ts`: Test cases

### Auto-Detection
The patch script automatically detects if upstream has fixed the hardcoded names and skips patching.

## Outputs

After deployment, the stack exports:
- `TAK-{StackName}-CloudTAK-ServiceURL`: HTTPS URL for the service
- `TAK-{StackName}-CloudTAK-DatabaseEndpoint`: Database connection endpoint
- `TAK-{StackName}-CloudTAK-AssetBucket`: S3 bucket for assets
- `TAK-{StackName}-CloudTAK-ECRRepository`: ECR repository URI

## Monitoring

```bash
# View ECS service logs
aws logs tail /aws/ecs/TAK-DevTest-CloudTAK --follow

# Check service status
aws ecs describe-services --cluster TAK-DevTest-BaseInfra --services TAK-DevTest-CloudTAK

# Update service (after new image build)
aws ecs update-service --cluster TAK-DevTest-BaseInfra --service TAK-DevTest-CloudTAK --force-new-deployment
```

## Troubleshooting

### Common Issues

1. **Missing BaseInfra exports**: Ensure BaseInfra stack is deployed first
2. **ECR permissions**: Ensure AWS credentials have ECR push permissions
3. **Container build failures**: Check Docker is running and AWS credentials are valid
4. **Health check failures**: Service may take 2-3 minutes to start

### Debug Commands
```bash
# Check stack outputs
aws cloudformation describe-stacks --stack-name TAK-DevTest-CloudTAK

# Check ECS task status
aws ecs list-tasks --cluster TAK-DevTest-BaseInfra --service-name TAK-DevTest-CloudTAK

# Check container logs
aws logs get-log-events --log-group-name /aws/ecs/TAK-DevTest-CloudTAK --log-stream-name [stream-name]
```

## Development

### Local Testing
```bash
# Run API locally
cd api
npm run dev

# Run with Docker Compose
docker-compose up api
```

### CDK Development
```bash
cd cdk
npm run watch  # Auto-rebuild on changes
cdk diff       # Show changes before deploy
cdk synth      # Generate CloudFormation template
```