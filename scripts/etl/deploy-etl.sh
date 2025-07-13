#!/bin/bash

# ETL ECR Deployment Script
# Usage: ./deploy-etl.sh <stack-name> [tag] [--profile profile-name]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Parse arguments
STACK_NAME="$1"
TAG="$2"
AWS_PROFILE=""
REGION=""

# Check for --profile and --region in all arguments
for ((i=1; i<=$#; i++)); do
    if [[ "${!i}" == "--profile" ]]; then
        ((i++))
        AWS_PROFILE="${!i}"
    elif [[ "${!i}" == --profile=* ]]; then
        AWS_PROFILE="${!i#*=}"
    elif [[ "${!i}" == "--region" ]]; then
        ((i++))
        REGION="${!i}"
    elif [[ "${!i}" == --region=* ]]; then
        REGION="${!i#*=}"
    fi
done

# Determine region: --region > profile-specific region > ap-southeast-2
if [[ -z "$REGION" ]]; then
    if [[ -n "$AWS_PROFILE" ]]; then
        REGION=$(aws configure get region --profile "$AWS_PROFILE" 2>/dev/null || echo "ap-southeast-2")
    else
        REGION=$(aws configure get region 2>/dev/null || echo "ap-southeast-2")
    fi
fi

# Set default tag if not provided
if [[ -z "$TAG" || "$TAG" == --profile* ]]; then
    TAG="$(git rev-parse --short HEAD)"
fi

if [[ -z "$STACK_NAME" ]]; then
    echo "Error: Stack name is required"
    echo "Usage: $0 <stack-name> [tag] [--profile profile-name] [--region region-name]"
    echo "Example: $0 Demo v1.0.0 --profile tak-nz-demo --region us-east-1"
    exit 1
fi

# Set AWS profile option
AWS_OPTS=""
if [[ -n "$AWS_PROFILE" ]]; then
    AWS_OPTS="--profile $AWS_PROFILE"
    echo "Using AWS profile: $AWS_PROFILE"
fi

echo "Deploying ETL to stack: $STACK_NAME"
echo "Using tag: $TAG"
echo "Region: $REGION"

# Get current directory name (ETL name)
ETL_NAME="$(basename "$PWD")"
echo "ETL Name: $ETL_NAME"

# Check if Dockerfile exists
if [[ ! -f "Dockerfile" ]]; then
    echo "Error: Dockerfile not found in current directory"
    echo "This script must be run from an ETL directory containing a Dockerfile"
    exit 1
fi

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text $AWS_OPTS)
if [[ -z "$AWS_ACCOUNT_ID" ]]; then
    echo "Error: Unable to get AWS account ID. Check AWS credentials."
    exit 1
fi

echo "AWS Account ID: $AWS_ACCOUNT_ID"

# Get ECR repository URI from CloudFormation exports
ECR_EXPORT_NAME="TAK-${STACK_NAME}-BaseInfra-EcrEtlTasksRepoArn"

ECR_REPO_ARN=$(aws cloudformation list-exports \
    --query "Exports[?Name=='${ECR_EXPORT_NAME}'].Value" \
    --output text \
    --region "$REGION" $AWS_OPTS)

if [[ -z "$ECR_REPO_ARN" || "$ECR_REPO_ARN" == "None" ]]; then
    echo "Error: ETL ECR repository not found. Ensure BaseInfra stack is deployed."
    echo "Available exports:"
    aws cloudformation list-exports --query "Exports[?contains(Name, 'ECR')].Name" --output table --region "$REGION" $AWS_OPTS
    exit 1
fi

# Extract repository name from ARN
ECR_REPO_NAME=$(echo "$ECR_REPO_ARN" | cut -d'/' -f2)
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO_NAME}"

echo "ECR URI: $ECR_URI"

# Build Docker image
echo "Building Docker image..."
docker build -t etl .

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region "$REGION" $AWS_OPTS | docker login --username AWS --password-stdin "$ECR_URI"

# Tag image with ETL name and tag
IMAGE_TAG="${ETL_NAME}-${TAG}"
FULL_IMAGE_URI="${ECR_URI}:${IMAGE_TAG}"

echo "Tagging image: $FULL_IMAGE_URI"
docker tag etl "$FULL_IMAGE_URI"

# Push image
echo "Pushing image to ECR..."
docker push "$FULL_IMAGE_URI"

echo ""
echo "✅ Successfully deployed ETL image: $FULL_IMAGE_URI"
echo ""
echo "To use this image in CloudTAK:"
echo "Update your ETL configuration to reference: $IMAGE_TAG"