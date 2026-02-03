#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="dist"
ZIP_PATH="$OUT_DIR/wing-extension.zip"

mkdir -p "$OUT_DIR"
rm -f "$ZIP_PATH"

zip -r "$ZIP_PATH" . \
  -x "node_modules/*" \
  -x "tests/*" \
  -x "mocks/*" \
  -x "scripts/*" \
  -x "store-assets/*" \
  -x "site/*" \
  -x ".git/*" \
  -x ".github/*" \
  -x ".gitignore" \
  -x ".DS_Store" \
  -x "*.md" \
  -x "LICENSE" \
  -x "package.json" \
  -x "package-lock.json" \
  -x "jest.config.js" \
  -x "jest.integration.config.js" \
  -x "puppeteer-test.config.js" \
  -x "dist/*"

echo "Created $ZIP_PATH"
