#!/bin/bash

set -e

echo "⚠️  NOTE: CDK now handles image building automatically."
echo "   This script is only for testing GitHub workflow approach locally."
echo ""

# Validate required environment variables
for env in STACK_NAME AWS_REGION AWS_ACCOUNT_ID; do
    if [ -z "${!env}" ]; then
        echo "Error: $env environment variable must be set"
        exit 1
    fi
done

# Get content SHA and create tag to match GitHub workflows
CONTENT_SHA=$(git log -1 --format="%h" -- api/ tasks/)

if [[ -z "$CONTENT_SHA" ]]; then
    echo "ERROR: No commits found for api/ or tasks/ directories"
    exit 1
fi

CLOUDTAK_TAG="cloudtak-${CONTENT_SHA}"

echo "🔄 Building images to mimic GitHub workflow..."

# Get ECR repository from BaseInfra stack
ECR_REPO_ARN=$(aws cloudformation describe-stacks \
    --stack-name "TAK-${STACK_NAME}-BaseInfra" \
    --query 'Stacks[0].Outputs[?OutputKey==`EcrArtifactsRepoArnOutput`].OutputValue' \
    --output text)

if [[ -z "$ECR_REPO_ARN" ]]; then
    echo "ERROR: ECR artifacts repository ARN not found in BaseInfra stack outputs"
    echo "Available outputs:"
    aws cloudformation describe-stacks --stack-name "TAK-${STACK_NAME}-BaseInfra" --query 'Stacks[0].Outputs[].OutputKey' --output text
    exit 1
fi

ECR_REPO_NAME=$(echo $ECR_REPO_ARN | cut -d'/' -f2)
ECR_REPO_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${ECR_REPO_NAME}"

echo "Using BaseInfra ECR repository: $ECR_REPO_URI"

# ECR login function
ecr_login() {
    echo "Logging into ECR..."
    aws ecr get-login-password \
        --region "$AWS_REGION" \
        ${AWS_PROFILE:+--profile "$AWS_PROFILE"} \
    | docker login \
        --username AWS \
        --password-stdin "$ECR_REPO_URI"
}

# Build and push API container
build_api() {
    echo "Building CloudTAK API..."
    docker build \
        -f api/Dockerfile \
        --no-cache \
        --rm \
        -t "$ECR_REPO_URI:$CLOUDTAK_TAG" \
        api/
    docker push "$ECR_REPO_URI:$CLOUDTAK_TAG"
}

# Build and push task container
build_task() {
    local task="$1"
    local CONTENT_SHA=$(echo $CLOUDTAK_TAG | sed 's/cloudtak-//')
    local TASK_TAG="$task-$CONTENT_SHA"
    echo "Building CloudTAK task: $task with tag: $TASK_TAG"
    docker build \
        -f "tasks/$task/Dockerfile" \
        --no-cache \
        --rm \
        -t "$ECR_REPO_URI:$TASK_TAG" \
        "tasks/$task/"
    docker push "$ECR_REPO_URI:$TASK_TAG"
}

# Main execution
ecr_login

# Check if main image already exists
if aws ecr describe-images --repository-name "$ECR_REPO_NAME" --image-ids imageTag="$CLOUDTAK_TAG" ${AWS_PROFILE:+--profile "$AWS_PROFILE"} >/dev/null 2>&1; then
    echo "✅ CloudTAK image $CLOUDTAK_TAG already exists, skipping build"
else
    echo "🔨 Building CloudTAK images with tag $CLOUDTAK_TAG"
    
    if [ -z "$1" ]; then
        echo "Building all containers..."
        build_api
        
        for task_dir in tasks/*/; do
            if [ -d "$task_dir" ]; then
                task=$(basename "$task_dir")
                build_task "$task"
            fi
        done
    elif [ "$1" = "api" ]; then
        build_api
    else
        build_task "$1"
    fi
fi

echo "✅ Build complete!"
echo "📦 CloudTAK images built with tags:"
echo "  - API: $CLOUDTAK_TAG"
echo "  - Events: events-$CONTENT_SHA"
echo "  - PMTiles: pmtiles-$CONTENT_SHA"
echo "  - Data: data-$CONTENT_SHA"
echo ""
echo "🚀 To deploy with these images, use:"
echo "npm run deploy:dev -- \\"
echo "  --context usePreBuiltImages=true \\"
echo "  --context cloudtakImageTag=$CLOUDTAK_TAG"