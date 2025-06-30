#!/bin/bash

set -e

# CDK-compatible branding build script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🎨 Starting CDK-compatible branding build..."

# Apply branding (simplified version)
if [ -f "$SCRIPT_DIR/logo/tak-nz-logo.svg" ] && [ -d "$PROJECT_ROOT/api/web/public" ]; then
    rsvg-convert -w 1000 "$SCRIPT_DIR/logo/tak-nz-logo.svg" > "$PROJECT_ROOT/api/web/public/logo.png"
    echo "✅ Updated logo.png"
fi

if [ -f "$SCRIPT_DIR/logo/favicon.ico" ] && [ -d "$PROJECT_ROOT/api/web/public" ]; then
    cp "$SCRIPT_DIR/logo/favicon.ico" "$PROJECT_ROOT/api/web/public/favicon.ico"
    echo "✅ Updated favicon.ico"
fi

# Apply resource name patches
if [ -f "$PROJECT_ROOT/scripts/patch-resource-names.sh" ]; then
    echo "🔧 Applying resource name patches..."
    cd "$PROJECT_ROOT"
    ./scripts/patch-resource-names.sh
fi

echo "✅ CDK-compatible branding build complete!"