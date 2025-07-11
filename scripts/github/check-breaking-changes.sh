#!/bin/bash
# Breaking change detection for infrastructure deployments

STACK_TYPE=${1:-"cloudtak"}
CONTEXT_ENV=${2:-"prod"}
OVERRIDE_CHECK=${3:-"false"}

# CloudTAK breaking change patterns
PATTERNS=(
  "DatabaseCluster.*will be destroyed"
  "ApplicationLoadBalancer.*will be destroyed"
  "Secret.*will be destroyed"
  "ECSService.*will be destroyed"
  "TaskDefinition.*will be destroyed"
  "S3.*Bucket.*will be destroyed"
  "Lambda.*will be destroyed"
  "BatchJobQueue.*will be destroyed"
)

echo "🔍 Checking for breaking changes in CloudTAK stack..."

# Generate CDK diff
cd cdk
if [ "$CONTEXT_ENV" = "prod" ]; then
  npm run cdk:diff:prod > stack-diff.txt 2>&1
else
  npm run cdk:diff:dev > stack-diff.txt 2>&1
fi

# Check for breaking patterns
BREAKING_FOUND=false
for pattern in "${PATTERNS[@]}"; do
  if grep -q "$pattern" stack-diff.txt; then
    echo "❌ Breaking change detected: $pattern"
    BREAKING_FOUND=true
  fi
done

if [ "$BREAKING_FOUND" = true ]; then
  if [ "$OVERRIDE_CHECK" = "true" ]; then
    echo "🚨 Breaking changes detected but override enabled - proceeding"
    exit 0
  else
    echo ""
    echo "💡 To override this check, use commit message containing '[force-deploy]'"
    echo "📋 Review the full diff above to understand the impact"
    exit 1
  fi
else
  echo "✅ No breaking changes detected"
fi