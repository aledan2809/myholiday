#!/bin/bash
# Vendor copy AIRouter into node_modules (Turbopack doesn't support symlinks)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SOURCE_DIR="$PROJECT_DIR/../AIRouter"
TARGET_DIR="$PROJECT_DIR/node_modules/ai-router"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "ERROR: AIRouter not found at $SOURCE_DIR"
  exit 1
fi

# Remove existing (symlink or directory)
rm -rf "$TARGET_DIR"

# Copy fresh
cp -R "$SOURCE_DIR" "$TARGET_DIR"

echo "AIRouter vendor-copied to $TARGET_DIR"
