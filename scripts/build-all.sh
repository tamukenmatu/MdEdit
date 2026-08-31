#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "========================================================="
echo "  MdEdit: Multi-Platform Distributed Native Build"
echo "========================================================="

echo "[1/3] Building macOS local app..."
"$DIR/scripts/build-mac.sh"

echo "[2/3] Building Linux (k-gmk: Wayland) native app..."
"$DIR/scripts/build-linux.sh"

echo "[3/3] Building Windows (msi: Portable .exe) app..."
"$DIR/scripts/build-windows.sh"

echo "========================================================="
echo "  ALL PLATFORMS BUILT SUCCESSFULLY!"
echo "========================================================="
