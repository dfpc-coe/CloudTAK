#!/bin/bash

set -e

echo "🎨 Applying TAK.NZ branding..."

# Replace logos if they exist
if [ -f "branding/logo/tak-nz-logo.svg" ] && [ -d "api/web/public" ]; then
    if command -v rsvg-convert &> /dev/null; then
        rsvg-convert -w 1000 branding/logo/tak-nz-logo.svg > api/web/public/logo.png 
        echo "✅ Updated logo.png"
    else
        echo "⚠️  rsvg-convert not available, skipping logo conversion"
    fi
    
    # Update CloudTAKLogo.svg with TAK.NZ logo
    cp branding/logo/tak-nz-logo.svg api/web/public/CloudTAKLogo.svg
    echo "✅ Updated CloudTAKLogo.svg"
fi

if [ -f "branding/logo/favicon.ico" ] && [ -d "api/web/public" ]; then
    cp branding/logo/favicon.ico api/web/public/favicon.ico
    echo "✅ Updated favicon.ico"
fi

if [ -f "branding/logo/icons.ts" ] && [ -d "api/web/public/logos" ]; then
    cp branding/logo/icons.ts api/web/public/logos/icons.ts
    echo "✅ Updated icons.ts"
fi

# Generate icons if script exists
if [ -f "branding/generate_icons.sh" ]; then
    branding/generate_icons.sh
fi

# Replace branding text
if [ -f "api/web/src/App.vue" ]; then
    sed -i.bak "s/Colorado - DFPC - CoE/TAK.NZ \\&bull; Team Awareness \\&bull; Te mōhio o te rōpū/g" api/web/src/App.vue
    echo "✅ Updated App.vue branding"
fi

echo "🎉 TAK.NZ branding applied successfully"