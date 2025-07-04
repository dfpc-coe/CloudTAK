#!/bin/bash

set -e

echo "🔄 Syncing CloudTAK api/tasks from upstream..."

# Check for --current-branch flag
USE_CURRENT_BRANCH=false
if [[ "$1" == "--current-branch" ]]; then
    USE_CURRENT_BRANCH=true
    echo "📍 Syncing on current branch"
fi

# Check if upstream remote exists
if ! git remote get-url upstream >/dev/null 2>&1; then
    echo "❌ Upstream remote not found. Adding dfpc-coe/CloudTAK as upstream..."
    git remote add upstream https://github.com/dfpc-coe/CloudTAK.git
fi

# Fetch latest from upstream
echo "📡 Fetching from upstream..."
git fetch upstream

# Create temporary branch for sync (unless using current branch)
if [[ "$USE_CURRENT_BRANCH" == "false" ]]; then
    SYNC_BRANCH="sync-upstream-$(date +%Y%m%d-%H%M%S)"
    git checkout -b "$SYNC_BRANCH"
else
    SYNC_BRANCH=$(git branch --show-current)
    echo "📍 Using current branch: $SYNC_BRANCH"
fi

# Sync only api and tasks folders
echo "📂 Syncing api/ folder..."
git checkout upstream/main -- api/

echo "📂 Syncing tasks/ folder..."
git checkout upstream/main -- tasks/

# Apply resource name patches
if [ -f "scripts/patch-resource-names.sh" ]; then
    echo "🔧 Applying resource name patches..."
    ./scripts/patch-resource-names.sh
fi

# Apply branding
if [ -f "branding/build-cdk.sh" ]; then
    echo "🎨 Applying branding..."
    ./branding/build-cdk.sh
fi

echo "✅ Sync complete!"
echo ""
if [[ "$USE_CURRENT_BRANCH" == "false" ]]; then
    echo "📋 Next steps:"
    echo "   1. Review changes: git diff HEAD~1"
    echo "   2. Test locally: docker-compose up"
    echo "   3. Commit changes: git add . && git commit -m 'Sync api/tasks from upstream'"
    echo "   4. Merge to main: git checkout main && git merge $SYNC_BRANCH"
    echo "   5. Deploy: ./scripts/deploy.sh"
else
    echo "📋 Next steps:"
    echo "   1. Review changes: git status"
    echo "   2. Test locally: docker-compose up"
    echo "   3. Commit changes: git add . && git commit -m 'Sync api/tasks from upstream'"
    echo "   4. Deploy: ./scripts/deploy.sh"
fi