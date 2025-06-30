#!/bin/bash

set -e

# Configuration - customize these for your environment
ECR_TASKS_REPO="${ECR_TASKS_REPOSITORY_NAME:-coe-ecr-etl}"
ECS_CLUSTER_PREFIX="${ECS_CLUSTER_PREFIX:-TAK-DevTest-BaseInfra}"

echo "🔧 Patching hardcoded resource names..."

# Check if upstream has already fixed the issue
if grep -q "process\.env\.ECR_TASKS_REPOSITORY_NAME" api/lib/aws/ecr.ts 2>/dev/null; then
    echo "✅ Upstream has fixed the hardcoded names - skipping patch"
    exit 0
fi

echo "📝 Applying resource name patches:"
echo "   ECR Tasks Repository: coe-ecr-etl-tasks → $ECR_TASKS_REPO"  
echo "   ECS Cluster Prefix: coe-ecs → $ECS_CLUSTER_PREFIX"

# Patch ECR repository names
if [ -f "api/lib/aws/ecr.ts" ]; then
    sed -i.bak "s/'coe-ecr-etl-tasks'/'$ECR_TASKS_REPO'/g" api/lib/aws/ecr.ts
    echo "✅ Patched api/lib/aws/ecr.ts"
fi

# Patch ECS cluster names  
if [ -f "api/lib/aws/ecs-video.ts" ]; then
    sed -i.bak "s/coe-ecs-/$ECS_CLUSTER_PREFIX-/g" api/lib/aws/ecs-video.ts
    echo "✅ Patched api/lib/aws/ecs-video.ts"
fi

# Patch Lambda ECR references
if [ -f "api/lib/aws/lambda.ts" ]; then
    sed -i.bak "s/coe-ecr-etl-tasks/$ECR_TASKS_REPO/g" api/lib/aws/lambda.ts
    echo "✅ Patched api/lib/aws/lambda.ts"
fi

# Patch test files
if [ -f "api/test/task.srv.test.ts" ]; then
    sed -i.bak "s/'coe-ecr-etl-tasks'/'$ECR_TASKS_REPO'/g" api/test/task.srv.test.ts
    echo "✅ Patched api/test/task.srv.test.ts"
fi

# Clean up backup files
find api/ -name "*.bak" -delete 2>/dev/null || true

echo "🎉 Resource name patching complete!"