#!/bin/bash

# Script to generate icons from SVG based on icons.ts configuration
# Usage: ./generate_icons.sh

ICONS_FILE="api/web/public/logos/icons.ts"
SVG_SOURCE="branding/logo/tak-nz-logo.svg"
BASE_OUTPUT_DIR="api/web/public"

# Check if required files exist
if [ ! -f "$ICONS_FILE" ]; then
    echo "Error: $ICONS_FILE not found"
    exit 1
fi

if [ ! -f "$SVG_SOURCE" ]; then
    echo "Error: $SVG_SOURCE not found"
    exit 1
fi

# Function to extract width from size string (e.g., "48x48" -> "48")
get_width() {
    local size="$1"
    echo "$size" | cut -d'x' -f1
}

# Function to extract height from size string (e.g., "48x48" -> "48")
get_height() {
    local size="$1"
    echo "$size" | cut -d'x' -f2
}

# Parse the icons.ts file and extract src and sizes
echo "Parsing $ICONS_FILE..."

# Use grep and sed to extract the icon data
grep -E '(src|sizes)' "$ICONS_FILE" | \
sed 's/.*"src": "\([^"]*\)".*/src:\1/' | \
sed 's/.*"sizes": "\([^"]*\)".*/sizes:\1/' | \
while IFS= read -r line; do
    if [[ $line == src:* ]]; then
        current_src="${line#src:}"
    elif [[ $line == sizes:* ]]; then
        current_sizes="${line#sizes:}"
        
        # Extract width and height
        width=$(get_width "$current_sizes")
        height=$(get_height "$current_sizes")
        
        # Convert /logos path to actual file path
        output_path="${BASE_OUTPUT_DIR}${current_src}"
        
        # Create directory if it doesn't exist
        output_dir=$(dirname "$output_path")
        mkdir -p "$output_dir"
        
        # Generate the icon
        echo "Generating: $output_path (${width}x${height})"
        
        if [ "$width" = "$height" ]; then
            # Square icon - use width only
            rsvg-convert -w "$width" "$SVG_SOURCE" > "$output_path"
        else
            # Non-square icon - specify both width and height
            rsvg-convert -w "$width" -h "$height" "$SVG_SOURCE" > "$output_path"
        fi
        
        # Check if the conversion was successful
        if [ $? -eq 0 ]; then
            echo "✓ Successfully generated: $output_path"
        else
            echo "✗ Failed to generate: $output_path"
        fi
    fi
done

echo "Icon generation complete!"