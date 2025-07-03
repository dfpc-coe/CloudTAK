#!/bin/bash

set -e

# Get git SHA (short version to match GitHub workflows)
GITSHA=$(git rev-parse --short HEAD)
export GITSHA

# Create CloudTAK tag to match GitHub workflows
CLOUDTAK_TAG="cloudtak-${GITSHA}"
export CLOUDTAK_TAG

# Support for mimicking GitHub Workflow approach
MIMIC_GITHUB=${MIMIC_GITHUB:-false}

if [ "$MIMIC_GITHUB" = "true" ]; then
    echo "🔄 Mimicking GitHub Workflow build approach..."
    
    # Get ECR repository from BaseInfra stack
    if [ -z "$STACK_NAME" ]; then
        echo "Error: STACK_NAME environment variable must be set when using MIMIC_GITHUB=true"
        exit 1
    fi
    
    ECR_REPO_ARN=$(aws cloudformation describe-stacks \
        --stack-name "TAK-${STACK_NAME}-BaseInfra" \
        --query 'Stacks[0].Outputs[?OutputKey==`EcrRepoArnOutput`].OutputValue' \
        --output text)
    
    if [[ -z "$ECR_REPO_ARN" ]]; then
        echo "ERROR: ECR repository ARN not found in BaseInfra stack outputs"
        exit 1
    fi
    
    ECR_REPO_NAME=$(echo $ECR_REPO_ARN | cut -d'/' -f2)
    ECR_REPO_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${ECR_REPO_NAME}"
    
    echo "Using BaseInfra ECR repository: $ECR_REPO_URI"
else
    # Validate required environment variables for direct ECR push
    for env in GITSHA AWS_REGION AWS_ACCOUNT_ID; do
        if [ -z "${!env}" ]; then
            echo "Error: $env environment variable must be set"
            exit 1
        fi
    done
    
    # Use default ECR repository name
    ECR_REPO_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/coe-ecr-etl"
fi

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
    docker compose build api
    docker tag cloudtak-api:latest "$ECR_REPO_URI:$CLOUDTAK_TAG"
    docker push "$ECR_REPO_URI:$CLOUDTAK_TAG"
}

# Build and push task container
build_task() {
    local task="$1"
    echo "Building CloudTAK task: $task"
    docker buildx build "./tasks/$task/" -t "cloudtak-$task"
    docker tag "cloudtak-$task:latest" "$ECR_REPO_URI:$task-$CLOUDTAK_TAG"
    docker push "$ECR_REPO_URI:$task-$CLOUDTAK_TAG"
}

# Main execution
ecr_login

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

echo "✅ Build complete!"
echo "📦 CloudTAK images built with tag: $CLOUDTAK_TAG"
echo ""
if [ "$MIMIC_GITHUB" = "true" ]; then
    echo "🚀 To deploy with these images, use:"
    echo "npm run cdk deploy -- \\"
    echo "  --context usePreBuiltImages=true \\"
    echo "  --context cloudtakImageTag=$CLOUDTAK_TAG"
fi