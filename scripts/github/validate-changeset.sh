#!/bin/bash

set -e

STACK_NAME="$1"

if [ -z "$STACK_NAME" ]; then
    echo "Usage: $0 <stack-name>"
    exit 1
fi

echo "🔍 Validating changeset for stack: $STACK_NAME"

# Check if stack exists
if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" &>/dev/null; then
    echo "✅ New stack deployment - no changeset validation needed"
    exit 0
fi

# Create changeset
CHANGESET_NAME="github-actions-$(date +%s)"
aws cloudformation create-change-set \
    --stack-name "$STACK_NAME" \
    --change-set-name "$CHANGESET_NAME" \
    --template-body file://cdk/cdk.out/$STACK_NAME.template.json \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
    --change-set-type UPDATE

# Wait for changeset creation
echo "⏳ Waiting for changeset creation..."
aws cloudformation wait change-set-create-complete \
    --stack-name "$STACK_NAME" \
    --change-set-name "$CHANGESET_NAME"

# Get changeset details
CHANGES=$(aws cloudformation describe-change-set \
    --stack-name "$STACK_NAME" \
    --change-set-name "$CHANGESET_NAME" \
    --query 'Changes[?Action==`Delete`]' \
    --output json)

# Check for breaking changes
if [ "$CHANGES" != "[]" ]; then
    echo "❌ Breaking changes detected:"
    echo "$CHANGES" | jq -r '.[] | "- " + .ResourceChange.LogicalResourceId + " (" + .ResourceChange.ResourceType + ")"'
    
    # Clean up changeset
    aws cloudformation delete-change-set \
        --stack-name "$STACK_NAME" \
        --change-set-name "$CHANGESET_NAME"
    
    echo ""
    echo "💡 To override this check, include '[force-deploy]' in your commit message"
    exit 1
fi

# Clean up changeset
aws cloudformation delete-change-set \
    --stack-name "$STACK_NAME" \
    --change-set-name "$CHANGESET_NAME"

echo "✅ No breaking changes detected"