#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Syncing and Building MdEdit for Linux (k-gmk: Wayland / GTK3) ==="
rsync -avz --exclude 'target' --exclude 'node_modules' --exclude '.git' "$DIR/" k-gmk:~/projects/MdEdit/

ssh k-gmk "bash -c 'set -e; cd ~/projects/MdEdit && npm install && npx tauri build && mkdir -p ~/Apps && cp src-tauri/target/release/app ~/Apps/mdedit && cp src-tauri/target/release/bundle/appimage/MdEdit_1.0.7_amd64.AppImage ~/Apps/MdEdit.AppImage && chmod +x ~/Apps/*'"

echo "SUCCESS: Linux native binary & AppImage deployed to k-gmk:~/Apps/"
