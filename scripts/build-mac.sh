#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "=== Building MdEdit for macOS (Native Apple Silicon / Universal) ==="
npx tauri build --bundles app

APP_SRC="$DIR/src-tauri/target/release/bundle/macos/MdEdit.app"

if [ -d "$APP_SRC" ]; then
  echo "Installing to /Applications/MdEdit.app..."
  rm -rf /Applications/MdEdit.app
  cp -R "$APP_SRC" /Applications/
  echo "SUCCESS: /Applications/MdEdit.app updated!"
fi
