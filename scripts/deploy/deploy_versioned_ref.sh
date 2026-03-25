#!/bin/bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <ssh-target> <repo-dir> <git-ref> [service-name]"
  exit 1
fi

SSH_TARGET="$1"
REPO_DIR="$2"
GIT_REF="$3"
SERVICE_NAME="${4:-openclaw-web-platform}"

ssh "$SSH_TARGET" "bash -lc '
  set -euo pipefail
  cd \"$REPO_DIR\"
  git fetch --all --tags
  git checkout \"$GIT_REF\"
  if [ -f package.json ]; then
    npm install
  fi
  if [ -f package.json ] && npm run | grep -q \" build\"; then
    npm run build
  fi
  sudo systemctl restart \"$SERVICE_NAME\"
  sudo systemctl is-active \"$SERVICE_NAME\"
'"
