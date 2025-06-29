#!/bin/bash

# Sync with upstream repository
git remote add upstream https://github.com/dfpc-coe/CloudTAK.git
git fetch upstream
git merge upstream/main

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed or not in PATH"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "Error: Docker daemon is not running"
    echo "Please start Docker and try again"
    exit 1
fi

echo "Docker is available and running ✓"

# Replace the logos (create directories if needed)
if [ -f "branding/logo/tak-nz-logo.svg" ] && [ -d "api/web/public" ]; then
    rsvg-convert -w 1000 branding/logo/tak-nz-logo.svg > api/web/public/logo.png 
    echo "Updated logo.png"
fi

if [ -f "branding/logo/favicon.ico" ] && [ -d "api/web/public" ]; then
    cp branding/logo/favicon.ico api/web/public/favicon.ico
    echo "Updated favicon.ico"
fi

if [ -f "branding/logo/icons.ts" ] && [ -d "api/web/public/logos" ]; then
    cp branding/logo/icons.ts api/web/public/logos/icons.ts
    echo "Updated icons.ts"
fi

if [ -f "branding/generate_icons.sh" ]; then
    branding/generate_icons.sh
fi

# Replace the text
if [ -f "api/web/src/App.vue" ]; then
    sed -i.orig "s/Colorado - DFPC - CoE/TAK.NZ \&bull; Team Awareness \&bull; Te mōhio o te rōpū/g" api/web/src/App.vue
    echo "Updated App.vue branding"
fi

# Replace build script
if [ -f "branding/js/build.js" ] && [ -d "bin" ]; then
    cp branding/js/build.js bin/build.js
    echo "Updated build.js"
fi

# Update the NPM packages
npm update
cd api/web
npm update
cd ../..

# Build the project
export GITSHA=$(git rev-parse HEAD)
export AWS_REGION=ap-southeast-2
export AWS_PROFILE=syd
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query 'Account' --output text 2>/dev/null)
npm run build

npx deploy update devtest --profile syd --region ap-southeast-2
