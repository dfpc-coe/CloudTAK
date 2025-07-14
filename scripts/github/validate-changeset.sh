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

# Upload template to S3 for large templates
TEMPLATE_FILE="cdk/cdk.out/$STACK_NAME.template.json"
TEMPLATE_SIZE=$(wc -c < "$TEMPLATE_FILE")

if [ "$TEMPLATE_SIZE" -gt 51200 ]; then
    echo "📤 Template is large ($TEMPLATE_SIZE bytes), uploading to S3..."
    
    # Get CDK bootstrap bucket
    CDK_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name CDKToolkit \
        --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
        --output text)
    
    if [ -z "$CDK_BUCKET" ]; then
        echo "❌ CDK bootstrap bucket not found. Run 'cdk bootstrap' first."
        exit 1
    fi
    
    # Upload template
    TEMPLATE_KEY="changeset-validation/$(basename $TEMPLATE_FILE)"
    aws s3 cp "$TEMPLATE_FILE" "s3://$CDK_BUCKET/$TEMPLATE_KEY"
    TEMPLATE_URL="https://s3.amazonaws.com/$CDK_BUCKET/$TEMPLATE_KEY"
    
    TEMPLATE_PARAM="--template-url $TEMPLATE_URL"
else
    TEMPLATE_PARAM="--template-body file://$TEMPLATE_FILE"
fi

# Create changeset
CHANGESET_NAME="github-actions-$(date +%s)"
aws cloudformation create-change-set \
    --stack-name "$STACK_NAME" \
    --change-set-name "$CHANGESET_NAME" \
    $TEMPLATE_PARAM \
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
    
    # Clean up S3 template if uploaded
    if [ -n "$CDK_BUCKET" ] && [ -n "$TEMPLATE_KEY" ]; then
        aws s3 rm "s3://$CDK_BUCKET/$TEMPLATE_KEY"
    fi
    
    echo ""
    echo "💡 To override this check, include '[force-deploy]' in your commit message"
    exit 1
fi

# Clean up changeset
aws cloudformation delete-change-set \
    --stack-name "$STACK_NAME" \
    --change-set-name "$CHANGESET_NAME"

# Clean up S3 template if uploaded
if [ -n "$CDK_BUCKET" ] && [ -n "$TEMPLATE_KEY" ]; then
    aws s3 rm "s3://$CDK_BUCKET/$TEMPLATE_KEY"
fi

echo "✅ No breaking changes detected"