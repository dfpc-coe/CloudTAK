#!/bin/bash

set -e

# Get git SHA (short version to match GitHub workflows)
GITSHA=$(git rev-parse --short HEAD)
export GITSHA

# Create CloudTAK tag to match GitHub workflows
CLOUDTAK_TAG="cloudtak-${GITSHA}"
export CLOUDTAK_TAG

# Validate required environment variables
for env in GITSHA AWS_REGION AWS_ACCOUNT_ID; do
    if [ -z "${!env}" ]; then
        echo "Error: $env environment variable must be set"
        exit 1
    fi
done

# ECR login function
ecr_login() {
    echo "Logging into ECR..."
    aws ecr get-login-password \
        --region "$AWS_REGION" \
        ${AWS_PROFILE:+--profile "$AWS_PROFILE"} \
    | docker login \
        --username AWS \
        --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
}

# Build and push API container
build_api() {
    echo "Building CloudTAK API..."
    docker compose build api
    docker tag cloudtak-api:latest "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/coe-ecr-etl:$CLOUDTAK_TAG"
    docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/coe-ecr-etl:$CLOUDTAK_TAG"
}

# Build and push task container
build_task() {
    local task="$1"
    echo "Building CloudTAK task: $task"
    docker buildx build "./tasks/$task/" -t "cloudtak-$task"
    docker tag "cloudtak-$task:latest" "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/coe-ecr-etl:$task-$CLOUDTAK_TAG"
    docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/coe-ecr-etl:$task-$CLOUDTAK_TAG"
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

echo "Build complete!"