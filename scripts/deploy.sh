#!/usr/bin/env bash
# Deploys the Convex backend to production and the built site to the VPS,
# where Caddy serves DEPLOY_DIR directly (no restart or sudo needed).
#
# Secrets and server details live in .env.prod.local (git-ignored); see
# .env.example.
#   npm run deploy        deploy the backend, build, upload
#   npm run deploy:dry    preview only: nothing is deployed or uploaded
set -euo pipefail
cd "$(dirname "$0")/.."

URL="https://class.pknspace.com"

if [ ! -f .env.prod.local ]; then
  echo "Missing .env.prod.local. Copy .env.example and fill in the production values." >&2
  exit 1
fi
# Read KEY=VALUE lines literally (values such as deploy keys contain "|", so the
# file is not sourced as shell). Surrounding quotes are stripped.
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|\#*) continue ;; esac
  key="${line%%=*}"
  value="${line#*=}"
  value="${value%\"}"; value="${value#\"}"; value="${value%\'}"; value="${value#\'}"
  export "$key=$value"
done < .env.prod.local
: "${CONVEX_DEPLOY_KEY:?CONVEX_DEPLOY_KEY is not set in .env.prod.local}"
: "${DEPLOY_HOST:?DEPLOY_HOST is not set in .env.prod.local}"
: "${DEPLOY_PORT:?DEPLOY_PORT is not set in .env.prod.local}"
: "${DEPLOY_DIR:?DEPLOY_DIR is not set in .env.prod.local}"
# .env.local points `convex` at the local dev backend; don't let it win.
unset CONVEX_DEPLOYMENT

echo "› Checks"
npm run check

if [ -n "${DRY_RUN:-}" ]; then
  echo "› Backend (dry run)"
  npx convex deploy --dry-run
  echo "› Upload (dry run, using a local build)"
  npm run build
  rsync -avz --delete --dry-run -e "ssh -p $DEPLOY_PORT" dist/ "$DEPLOY_HOST:$DEPLOY_DIR/"
  echo "Dry run: nothing was deployed or uploaded."
  exit 0
fi

echo "› Backend + build"
# Deploys convex/ and runs the build with VITE_CONVEX_URL set to production.
npx convex deploy -y --cmd 'npm run build'

echo "› Upload"
rsync -avz --delete -e "ssh -p $DEPLOY_PORT" dist/ "$DEPLOY_HOST:$DEPLOY_DIR/"

echo "Deployed to $URL"
