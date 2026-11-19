#!/bin/bash
# Generate the native (Capacitor) Android and iOS icons and splash screens from
# the TAK-NZ logo SVG. Files are written over the existing ones, using the same
# names and sizes, so no native config needs to change.
#
# Usage (from the repo root): branding/generate_native_icons.sh
# Requires: rsvg-convert (librsvg2-bin) and ImageMagick (convert, identify)
#
# This does NOT produce the web/PWA icons. Use generate_icons.sh for those.
set -euo pipefail

SVG_SOURCE="branding/logo/tak-nz-logo.svg"
ANDROID_RES="app/android/app/src/main/res"
IOS_APP="app/ios/App/App"
PUBLIC="app/public"

# TAK.NZ brand dark blue (from the tak.nz stylesheet)
BG="#003366"
# Fraction of the canvas height the logo occupies
ANDROID_ADAPTIVE_FILL=0.56   # inside Android's adaptive-icon safe zone
ANDROID_LEGACY_FILL=0.74
IOS_ICON_FILL=0.78
SPLASH_FILL=0.30             # of the shorter splash side
IOS_SPLASH_FILL=0.22

for cmd in rsvg-convert convert identify; do
    command -v "$cmd" >/dev/null || { echo "Error: $cmd not found"; exit 1; }
done
[ -f "$SVG_SOURCE" ] || { echo "Error: $SVG_SOURCE not found"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# logo <height> <out.png>: logo fitted to the given height, transparent background
logo() {
    rsvg-convert -h "$1" -a "$SVG_SOURCE" -o "$2"
}

# fill_px <canvas> <fraction>: integer pixel height for a fraction of a canvas
fill_px() {
    awk -v c="$1" -v f="$2" 'BEGIN { printf "%d", c * f + 0.5 }'
}

# canvas <w> <h> <logo_height> <bg|none> <out>: logo centred on a w x h canvas
canvas() {
    local w="$1" h="$2" lh="$3" bg="$4" out="$5"
    logo "$lh" "$TMP/l.png"
    convert -size "${w}x${h}" "xc:${bg}" "$TMP/l.png" -gravity center -composite "$out"
}

# --- Android adaptive icon layers ------------------------------------------
# densities: name:foreground/monochrome px (108dp):legacy px (48dp)
for d in mdpi:108:48 hdpi:162:72 xhdpi:216:96 xxhdpi:324:144 xxxhdpi:432:192; do
    IFS=: read -r name layer legacy <<<"$d"
    dir="$ANDROID_RES/mipmap-$name"
    echo "Android $name"

    canvas "$layer" "$layer" "$(fill_px "$layer" "$ANDROID_ADAPTIVE_FILL")" none "$dir/ic_launcher_foreground.png"

    # Monochrome (Android 13+ themed icon): opacity follows brightness, so the
    # shield and lettering are opaque and the kiwi and band are cut out.
    convert "$dir/ic_launcher_foreground.png" -colorspace Gray -alpha extract "$TMP/a.png"
    convert "$dir/ic_launcher_foreground.png" -background black -alpha remove -colorspace Gray "$TMP/lum.png"
    convert "$TMP/a.png" "$TMP/lum.png" -compose Multiply -composite "$TMP/mask.png"
    convert -size "${layer}x${layer}" xc:white "$TMP/mask.png" -alpha off -compose CopyOpacity -composite \
        -type GrayscaleAlpha "$dir/ic_launcher_monochrome.png"

    # Legacy (pre-Android 8) icons: square with rounded corners, and round
    lh="$(fill_px "$legacy" "$ANDROID_LEGACY_FILL")"
    logo "$lh" "$TMP/l.png"
    radius=$((legacy / 6))
    convert -size "${legacy}x${legacy}" xc:none -fill "$BG" \
        -draw "roundrectangle 0,0 $((legacy - 1)),$((legacy - 1)) $radius,$radius" \
        "$TMP/l.png" -gravity center -composite "$dir/ic_launcher.png"
    convert -size "${legacy}x${legacy}" xc:none -fill "$BG" \
        -draw "circle $((legacy / 2)),$((legacy / 2)) $((legacy / 2)),0" \
        "$TMP/l.png" -gravity center -composite "$dir/ic_launcher_round.png"
done

# Adaptive background: flat brand colour instead of upstream's teal gradient
cat > "$ANDROID_RES/drawable/ic_launcher_background.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="$BG" />
</shape>
EOF

# --- Android splash screens (keep existing sizes) --------------------------
while IFS= read -r f; do
    size="$(identify -format '%wx%h' "$f")"
    w="${size%x*}"; h="${size#*x}"
    short=$(( w < h ? w : h ))
    echo "Android splash $f ($size)"
    canvas "$w" "$h" "$(fill_px "$short" "$SPLASH_FILL")" "$BG" "$TMP/s.png"
    convert "$TMP/s.png" -alpha off "$f"
done < <(find "$ANDROID_RES" -name splash.png | sort)

# --- iOS --------------------------------------------------------------------
echo "iOS app icon"
canvas 1024 1024 "$(fill_px 1024 "$IOS_ICON_FILL")" "$BG" "$TMP/i.png"
# Apple rejects icons that contain transparency
convert "$TMP/i.png" -alpha off "$IOS_APP/Assets.xcassets/CloudTAK.appiconset/AppIcon-1024.png"

for f in "$IOS_APP"/Assets.xcassets/Splash.imageset/*.png; do
    echo "iOS splash $f"
    canvas 2732 2732 "$(fill_px 2732 "$IOS_SPLASH_FILL")" "$BG" "$TMP/s.png"
    convert "$TMP/s.png" -alpha off "$f"
done

# --- iOS 26 Icon Composer asset ---------------------------------------------
# Layer is the logo on its natural colours (no gradient fill). Icon Composer
# positions an SVG layer at its viewBox size times "scale".
ICON_DIR="$IOS_APP/CloudTAK.icon"
if [ -d "$ICON_DIR" ]; then
    echo "iOS Icon Composer asset"
    cp "$SVG_SOURCE" "$ICON_DIR/Assets/CloudTAK Icon Color.svg"
    cat > "$ICON_DIR/icon.json" <<'EOF'
{
  "fill" : {
    "solid" : "display-p3:0.00000,0.20000,0.40000,1.00000"
  },
  "groups" : [
    {
      "layers" : [
        {
          "image-name" : "CloudTAK Icon Color.svg",
          "name" : "TAK-NZ Logo",
          "position" : {
            "scale" : 0.6,
            "translation-in-points" : [
              0,
              0
            ]
          }
        }
      ],
      "shadow" : {
        "kind" : "neutral",
        "opacity" : 0.5
      },
      "translucency" : {
        "enabled" : true,
        "value" : 0.5
      }
    }
  ],
  "supported-platforms" : {
    "circles" : [
      "watchOS"
    ],
    "squares" : "shared"
  }
}
EOF
fi

# --- In-app logos -----------------------------------------------------------
echo "In-app logos"
cp "$SVG_SOURCE" "$PUBLIC/CloudTAKLogo.svg"
rsvg-convert -w 1000 -a "$SVG_SOURCE" -o "$PUBLIC/logo.png"

echo "Native icon generation complete!"
