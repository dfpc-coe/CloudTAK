#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default configuration
ENVIRONMENT="${ENVIRONMENT:-dev-test}"
STACK_NAME="${STACK_NAME:-DevTest}"
AWS_REGION="${AWS_REGION:-ap-southeast-2}"
DOMAIN_NAME="${DOMAIN_NAME:-tak.nz}"
SUBDOMAIN="${SUBDOMAIN:-cloudtak}"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        --region)
            AWS_REGION="$2"
            shift 2
            ;;
        --domain)
            DOMAIN_NAME="$2"
            shift 2
            ;;
        --subdomain)
            SUBDOMAIN="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --environment    Environment (prod|dev-test) [default: dev-test]"
            echo "  --stack-name     Stack name component [default: DevTest]"
            echo "  --region         AWS region [default: ap-southeast-2]"
            echo "  --domain         Domain name [default: tak.nz]"
            echo "  --subdomain      Subdomain for CloudTAK [default: cloudtak]"
            echo "  --skip-build     Skip container image building"
            echo "  --help           Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "🚀 Starting CloudTAK CDK Deployment"
echo "   Environment: $ENVIRONMENT"
echo "   Stack Name: $STACK_NAME"
echo "   Region: $AWS_REGION"
echo "   Domain: $DOMAIN_NAME"
echo "   Subdomain: $SUBDOMAIN"
echo ""

# Validate prerequisites
echo "🔍 Validating prerequisites..."

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is required but not installed"
    exit 1
fi

if ! command -v cdk &> /dev/null; then
    echo "❌ AWS CDK CLI is required but not installed"
    echo "   Install with: npm install -g aws-cdk"
    exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured or invalid"
    exit 1
fi

echo "✅ Prerequisites validated"

# Apply resource name patches
if [ -f "$PROJECT_ROOT/scripts/patch-resource-names.sh" ]; then
    echo ""
    echo "🔧 Step 1: Applying resource name patches..."
    cd "$PROJECT_ROOT"
    export ECR_TASKS_REPOSITORY_NAME="coe-ecr-etl"
    export ECS_CLUSTER_PREFIX="TAK-$STACK_NAME-BaseInfra"
    ./scripts/patch-resource-names.sh
fi

# Build container images (unless skipped)
if [ "$SKIP_BUILD" != "true" ]; then
    echo ""
    echo "🐳 Step 2: Building container images..."
    cd "$PROJECT_ROOT"
    export GITSHA=$(git rev-parse --short HEAD)
    export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    export AWS_REGION
    export Environment="$ENVIRONMENT"
    
    node bin/build.js
else
    echo "⏭️  Skipping image build"
fi

# Deploy CDK infrastructure
echo ""
echo "🏗️  Step 3: Deploying CDK infrastructure..."

cd "$PROJECT_ROOT/cdk"

if [ ! -d "node_modules" ]; then
    echo "📦 Installing CDK dependencies..."
    npm install
fi

echo "🔨 Building CDK project..."
npm run build

echo "🥾 Bootstrapping CDK (if needed)..."
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/$AWS_REGION

echo "🚀 Deploying CloudTAK stack..."
cdk deploy \
    --context environment="$ENVIRONMENT" \
    --context stackName="$STACK_NAME" \
    --context domainName="$DOMAIN_NAME" \
    --context subdomain="$SUBDOMAIN" \
    --require-approval never \
    --outputs-file cdk-outputs.json

# Post-deployment validation
echo ""
echo "✅ Step 4: Post-deployment validation..."

if [ -f "cdk-outputs.json" ]; then
    echo "📋 Deployment outputs:"
    cat cdk-outputs.json | jq '.' 2>/dev/null || cat cdk-outputs.json
    
    SERVICE_URL=$(cat cdk-outputs.json | jq -r '.["TAK-'$STACK_NAME'-CloudTAK"].ServiceURL // empty' 2>/dev/null || echo "")
    if [ -n "$SERVICE_URL" ] && [ "$SERVICE_URL" != "null" ]; then
        echo ""
        echo "🌐 Service URL: $SERVICE_URL"
        
        echo "🏥 Performing basic health check..."
        if curl -s -f "$SERVICE_URL/api" > /dev/null; then
            echo "✅ Health check passed"
        else
            echo "⚠️  Health check failed - service may still be starting"
        fi
    fi
else
    echo "⚠️  No deployment outputs found"
fi

echo ""
echo "🎉 CloudTAK CDK Deployment Complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Verify service functionality at: https://$SUBDOMAIN.$DOMAIN_NAME"
echo "   2. Check CloudWatch logs for any issues"
echo "   3. Test ETL functionality"
echo ""
echo "🔧 Useful commands:"
echo "   View logs: aws logs tail /aws/ecs/TAK-$STACK_NAME-CloudTAK --follow"
echo "   Update service: aws ecs update-service --cluster TAK-$STACK_NAME-BaseInfra --service TAK-$STACK_NAME-CloudTAK"