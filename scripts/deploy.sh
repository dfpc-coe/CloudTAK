#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default configuration
ENVIRONMENT="${ENVIRONMENT:-dev-test}"
STACK_NAME="${STACK_NAME:-DevTest}"
AWS_REGION="${AWS_REGION:-ap-southeast-2}"


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

        --sync-upstream)
            SYNC_UPSTREAM=true
            shift
            ;;

        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --environment    Environment (prod|dev-test) [default: dev-test]"
            echo "  --stack-name     Stack name component [default: DevTest]"
            echo "  --region         AWS region [default: ap-southeast-2]"

            echo "  --sync-upstream  Sync with upstream before deployment"

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

if ! command -v jq &> /dev/null; then
    echo "❌ jq is required but not installed"
    echo "   Install with: apt-get install jq (Ubuntu) or brew install jq (macOS)"
    exit 1
fi

echo "✅ Prerequisites validated"

# Sync with upstream (if requested)
if [ "$SYNC_UPSTREAM" = "true" ]; then
    echo ""
    echo "🔄 Step 1: Syncing with upstream..."
    cd "$PROJECT_ROOT"
    ./scripts/sync-upstream.sh --current-branch
fi

# Deploy CDK infrastructure
echo ""
echo "🏗️  Step 2: Deploying CDK infrastructure..."

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
    --context envType="$ENVIRONMENT" \
    --require-approval never \
    --outputs-file cdk-outputs.json

# Post-deployment validation
echo ""
echo "✅ Step 3: Post-deployment validation..."

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
echo "   1. Verify service functionality via the deployed service URL"
echo "   2. Check CloudWatch logs for any issues"
echo "   3. Test ETL functionality"
echo ""
echo "🔧 Useful commands:"
echo "   View logs: aws logs tail /aws/ecs/TAK-$STACK_NAME-CloudTAK --follow"
echo "   Update service: aws ecs update-service --cluster TAK-$STACK_NAME-BaseInfra --service TAK-$STACK_NAME-CloudTAK"