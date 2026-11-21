#!/usr/bin/env bash
# Build the independent terminal in a staging directory linked to its Vercel project.
set -euo pipefail
repo=$(git rev-parse --show-toplevel)
stage=${1:?Pass a staging directory outside the repo}
mkdir -p "$stage"
stage=$(cd "$stage" && pwd -P)
case "$stage/" in "$repo/"*) echo "Choose a staging directory outside the repo." >&2; exit 1;; esac
cd "$repo"
node_modules/.bin/vite build tools/market/web --config frontend/vite.config.ts --outDir "$stage/public"
cp -R tools/market/web/{api,lib} "$stage/"
cp tools/market/web/{vercel.json,package.json,package-lock.json} "$stage/"
