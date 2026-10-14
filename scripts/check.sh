#!/usr/bin/env bash
# Runs every part's checks: the backend's typecheck, lint and tests, then the web
# app's and the mobile app's typecheck, lint and tests. Run before committing.
set -euo pipefail
cd "$(dirname "$0")/.."

for dir in backend web mobile; do
  echo "› $dir"
  npm --prefix "$dir" run check
done
