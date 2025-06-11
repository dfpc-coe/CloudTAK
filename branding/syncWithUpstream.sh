#!/bin/bash

set -e

# Configuration
UPSTREAM_REMOTE="upstream"
UPSTREAM_URL="https://github.com/dfpc-coe/CloudTAK.git"
CUSTOM_FOLDERS=("branding")
BACKUP_DIR=".sync-backup-$(date +%Y%m%d-%H%M%S)"

echo "Starting sync with upstream..."

# Add upstream remote if it doesn't exist
if ! git remote get-url $UPSTREAM_REMOTE >/dev/null 2>&1; then
    git remote add $UPSTREAM_REMOTE $UPSTREAM_URL
    echo "Added upstream remote"
fi

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup custom folders
for folder in "${CUSTOM_FOLDERS[@]}"; do
    if [ -d "$folder" ]; then
        cp -r "$folder" "$BACKUP_DIR/"
        echo "Backed up $folder"
    fi
done

# Fetch upstream changes
echo "Fetching upstream changes..."
git fetch $UPSTREAM_REMOTE

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

# Merge upstream changes
echo "Merging upstream changes..."
git merge $UPSTREAM_REMOTE/main --no-edit

# Restore custom folders
echo "Restoring custom folders..."
for folder in "${CUSTOM_FOLDERS[@]}"; do
    if [ -d "$BACKUP_DIR/$folder" ]; then
        rm -rf "$folder"
        mv "$BACKUP_DIR/$folder" .
        git add "$folder"
        echo "Restored $folder"
    fi
done

# Commit restored customizations
if ! git diff --cached --quiet; then
    git commit -m "Restore custom branding and cloudformation after upstream sync

- Preserved custom branding from TAK.NZ
- Preserved custom cloudformation templates
- Synced with upstream $(git rev-parse --short $UPSTREAM_REMOTE/main)"
fi

# Cleanup
rm -rf $BACKUP_DIR

echo "Sync complete!"
echo "Custom folders preserved: ${CUSTOM_FOLDERS[*]}"
echo "Review changes and push when ready with: git push origin $CURRENT_BRANCH"
