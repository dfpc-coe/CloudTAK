#!/bin/bash

# ETL User and Channel Creation Script
# Usage: ./create-etl-user-and-channel.sh <stack-name> [--profile profile-name]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse arguments
STACK_NAME="$1"
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

if [[ -z "$STACK_NAME" ]]; then
    echo "Error: Stack name is required"
    echo "Usage: $0 <stack-name> [--profile profile-name]"
    exit 1
fi

# Set AWS profile option
AWS_OPTS=""
if [[ -n "$AWS_PROFILE" ]]; then
    AWS_OPTS="--profile $AWS_PROFILE"
    echo "Using AWS profile: $AWS_PROFILE"
fi

echo "Creating ETL user and channel for stack: $STACK_NAME"

# Get inputs
read -p "Channel name (e.g. 'Geological / Earthquake Epicenters'): " CHANNEL_NAME
read -p "Channel description (e.g. 'Location of Earthquake Epicenters'): " CHANNEL_DESC
read -p "ETL user (e.g. 'earthquakes'): " ETL_USER

if [[ -z "$CHANNEL_NAME" || -z "$CHANNEL_DESC" || -z "$ETL_USER" ]]; then
    echo "Error: All fields are required"
    exit 1
fi

# Get Authentik URL from CloudFormation exports
AUTHENTIK_EXPORT_NAME="TAK-${STACK_NAME}-AuthInfra-AuthentikUrl"

AUTHENTIK_URL=$(aws cloudformation list-exports \
    --query "Exports[?Name=='${AUTHENTIK_EXPORT_NAME}'].Value" \
    --output text \
    --region "$REGION" $AWS_OPTS)

if [[ -z "$AUTHENTIK_URL" || "$AUTHENTIK_URL" == "None" ]]; then
    echo "Error: Authentik URL not found. Ensure AuthInfra stack is deployed."
    exit 1
fi

echo "Authentik URL: $AUTHENTIK_URL"

# Get Authentik admin token from Secrets Manager using ARN from CloudFormation output
SECRET_ARN=$(aws cloudformation describe-stacks \
    --stack-name "TAK-${STACK_NAME}-AuthInfra" \
    --query "Stacks[0].Outputs[?OutputKey=='AuthentikAdminTokenArnOutput'].OutputValue" \
    --output text \
    --region "$REGION" $AWS_OPTS)

if [[ -z "$SECRET_ARN" || "$SECRET_ARN" == "None" ]]; then
    echo "Error: Authentik admin token ARN not found in AuthInfra stack outputs."
    exit 1
fi

AUTHENTIK_TOKEN=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_ARN" \
    --query SecretString \
    --output text \
    --region "$REGION" $AWS_OPTS)

if [[ -z "$AUTHENTIK_TOKEN" ]]; then
    echo "Error: Unable to retrieve Authentik admin token"
    exit 1
fi

# Generate random password
RANDOM_PASSWORD=$(openssl rand -base64 32)

# Create or update service account
SERVICE_ACCOUNT_NAME="etl-${ETL_USER}"
echo "Creating/updating service account: $SERVICE_ACCOUNT_NAME"

# Check if user exists
EXISTING_USER=$(curl -s -X GET "${AUTHENTIK_URL}/api/v3/core/users/?username=${SERVICE_ACCOUNT_NAME}" \
    -H "Authorization: Bearer $AUTHENTIK_TOKEN")

USER_COUNT=$(echo "$EXISTING_USER" | jq -r '.pagination.count')

if [[ "$USER_COUNT" == "0" ]]; then
    # Create new service account
    USER_RESPONSE=$(curl -s -X POST "${AUTHENTIK_URL}/api/v3/core/users/service_account/" \
        -H "Authorization: Bearer $AUTHENTIK_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$SERVICE_ACCOUNT_NAME\",
            \"username\": \"$SERVICE_ACCOUNT_NAME\"
        }")
    USER_ID=$(echo "$USER_RESPONSE" | jq -r '.user_pk')
    echo "Created service account with ID: $USER_ID"
else
    # Get existing user ID
    USER_ID=$(echo "$EXISTING_USER" | jq -r '.results[0].pk')
    echo "Found existing service account with ID: $USER_ID"
fi

if [[ "$USER_ID" == "null" || -z "$USER_ID" ]]; then
    echo "Error: Failed to create/find service account"
    exit 1
fi

# Set password for service account
echo "Setting password for service account..."
curl -s -X POST "${AUTHENTIK_URL}/api/v3/core/users/${USER_ID}/set_password/" \
    -H "Authorization: Bearer $AUTHENTIK_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"password\": \"$RANDOM_PASSWORD\"}" > /dev/null

# Create or update main group
GROUP_NAME="tak_${CHANNEL_NAME}"
echo "Creating/updating group: $GROUP_NAME"

# Check if group exists (URL encode the group name)
ENCODED_GROUP_NAME=$(printf '%s' "$GROUP_NAME" | jq -sRr @uri)
EXISTING_GROUP=$(curl -s -X GET "${AUTHENTIK_URL}/api/v3/core/groups/?name=${ENCODED_GROUP_NAME}" \
    -H "Authorization: Bearer $AUTHENTIK_TOKEN")

GROUP_COUNT=$(echo "$EXISTING_GROUP" | jq -r '.pagination.count')

if [[ "$GROUP_COUNT" == "0" ]]; then
    # Create new group
    GROUP_RESPONSE=$(curl -s -X POST "${AUTHENTIK_URL}/api/v3/core/groups/" \
        -H "Authorization: Bearer $AUTHENTIK_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$GROUP_NAME\",
            \"attributes\": {
                \"CN\": \"$CHANNEL_NAME\",
                \"description\": \"$CHANNEL_DESC (Read-only broadcast channel)\"
            }
        }")
    GROUP_ID=$(echo "$GROUP_RESPONSE" | jq -r '.pk')
    echo "Created group with ID: $GROUP_ID"
else
    # Update existing group
    GROUP_ID=$(echo "$EXISTING_GROUP" | jq -r '.results[0].pk')
    curl -s -X PATCH "${AUTHENTIK_URL}/api/v3/core/groups/${GROUP_ID}/" \
        -H "Authorization: Bearer $AUTHENTIK_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"attributes\": {
                \"CN\": \"$CHANNEL_NAME\",
                \"description\": \"$CHANNEL_DESC (Read-only broadcast channel)\"
            }
        }" > /dev/null
    echo "Updated existing group with ID: $GROUP_ID"
fi

# Create or update READ group
READ_GROUP_NAME="${GROUP_NAME}_READ"
echo "Creating/updating READ group: $READ_GROUP_NAME"

ENCODED_READ_GROUP_NAME=$(printf '%s' "$READ_GROUP_NAME" | jq -sRr @uri)
EXISTING_READ_GROUP=$(curl -s -X GET "${AUTHENTIK_URL}/api/v3/core/groups/?name=${ENCODED_READ_GROUP_NAME}" \
    -H "Authorization: Bearer $AUTHENTIK_TOKEN")

READ_GROUP_COUNT=$(echo "$EXISTING_READ_GROUP" | jq -r '.pagination.count')

if [[ "$READ_GROUP_COUNT" == "0" ]]; then
    # Create new READ group
    READ_GROUP_RESPONSE=$(curl -s -X POST "${AUTHENTIK_URL}/api/v3/core/groups/" \
        -H "Authorization: Bearer $AUTHENTIK_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$READ_GROUP_NAME\"}")
    READ_GROUP_ID=$(echo "$READ_GROUP_RESPONSE" | jq -r '.pk')
    echo "Created READ group with ID: $READ_GROUP_ID"
else
    READ_GROUP_ID=$(echo "$EXISTING_READ_GROUP" | jq -r '.results[0].pk')
    echo "Found existing READ group with ID: $READ_GROUP_ID"
fi

# Add user to both groups
echo "Adding service account to groups..."
curl -s -X POST "${AUTHENTIK_URL}/api/v3/core/groups/${GROUP_ID}/add_user/" \
    -H "Authorization: Bearer $AUTHENTIK_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"pk\": $USER_ID}" > /dev/null

curl -s -X POST "${AUTHENTIK_URL}/api/v3/core/groups/${READ_GROUP_ID}/add_user/" \
    -H "Authorization: Bearer $AUTHENTIK_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"pk\": $USER_ID}" > /dev/null

echo ""
echo "✅ Successfully created/updated ETL user and channel:"
echo "Service Account:"
echo "Username: $SERVICE_ACCOUNT_NAME"
echo "Password: $RANDOM_PASSWORD"
echo "Groups: $GROUP_NAME, $READ_GROUP_NAME"
echo "Channel: $CHANNEL_NAME"
echo ""
echo "⚠️  Save the password securely - it cannot be retrieved again!"