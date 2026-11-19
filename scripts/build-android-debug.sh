#!/bin/bash
# Build a debug APK of the Android app.
#
# Usage (from anywhere): scripts/build-android-debug.sh
# Output: app/android/app/build/outputs/apk/debug/app-debug.apk
#
# Needs: Node, a full JDK 21 (javac, not just a JRE) and the Android SDK
# (platform 36, build-tools 36). JAVA_HOME / ANDROID_HOME are used when set,
# otherwise ~/jdk/jdk-21* and ~/Android/Sdk.
#
# Web plugins (app/plugins/) are baked into the bundled web app. If they are
# symlinks to sibling repos (a local dev setup), Vite resolves their
# `../../src/...` imports from the real path and the build fails, so the
# symlinks are swapped for real copies for the duration of the build, the same
# way the Dockerfile does it with api/bin/plugin.ts, then put back.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/app"
PLUGINS="$APP/plugins"

if [ -z "${JAVA_HOME:-}" ]; then
    for jdk in "$HOME"/jdk/jdk-21*; do [ -x "$jdk/bin/javac" ] && JAVA_HOME="$jdk"; done
fi
[ -n "${JAVA_HOME:-}" ] && export JAVA_HOME PATH="$JAVA_HOME/bin:$PATH"
command -v javac >/dev/null || { echo "Error: no JDK found (need javac). Install openjdk-21-jdk or set JAVA_HOME"; exit 1; }

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
[ -d "$ANDROID_HOME" ] || { echo "Error: Android SDK not found at $ANDROID_HOME. Set ANDROID_HOME"; exit 1; }
echo "sdk.dir=$ANDROID_HOME" > "$APP/android/local.properties"

# Outside app/plugins/ on purpose: Vite globs plugins/*/index.ts, so anything
# parked inside would be picked up as a second copy of the plugin
STASH="$(mktemp -d)"
swapped=()
restore() {
    for name in "${swapped[@]}"; do
        # shellcheck disable=SC2115
        [ -d "$PLUGINS/$name" ] && [ ! -L "$PLUGINS/$name" ] && mv "$PLUGINS/$name" "$STASH/$name.copy"
        mv "$STASH/$name.link" "$PLUGINS/$name"
    done
}
trap restore EXIT

if [ -d "$PLUGINS" ]; then
    for entry in "$PLUGINS"/*; do
        [ -L "$entry" ] || continue
        name="$(basename "$entry")"
        target="$(readlink -f "$entry")"
        [ -d "$target" ] || continue
        echo "Plugin $name: using a real copy of $target"
        mv "$entry" "$STASH/$name.link"
        swapped+=("$name")
        mkdir "$PLUGINS/$name"
        (cd "$target" && tar cf - --exclude=node_modules --exclude=.git .) | tar xf - -C "$PLUGINS/$name"
    done
fi

cd "$APP"
npm run build
npx cap sync android
cd android
./gradlew assembleDebug --no-daemon -Dorg.gradle.java.installations.paths="${JAVA_HOME:-}"

echo "APK: $APP/android/app/build/outputs/apk/debug/app-debug.apk"
