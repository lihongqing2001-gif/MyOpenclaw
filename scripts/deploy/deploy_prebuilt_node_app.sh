#!/bin/bash
set -euo pipefail

if [ "$#" -lt 4 ]; then
  echo "Usage: $0 <ssh-target> <local-app-dir> <remote-app-dir> <service-name>"
  exit 1
fi

SSH_TARGET="$1"
LOCAL_APP_DIR="$2"
REMOTE_APP_DIR="$3"
SERVICE_NAME="$4"
LOCK_NAME="$(basename "$REMOTE_APP_DIR" | tr -c 'A-Za-z0-9._-' '_')"

if [ ! -d "$LOCAL_APP_DIR/dist" ]; then
  echo "Missing local client build: $LOCAL_APP_DIR/dist"
  exit 1
fi

if [ ! -d "$LOCAL_APP_DIR/dist-server" ]; then
  echo "Missing local server build: $LOCAL_APP_DIR/dist-server"
  exit 1
fi

rsync -az \
  --delete \
  --exclude node_modules \
  "$LOCAL_APP_DIR/" \
  "$SSH_TARGET:$REMOTE_APP_DIR/"

ssh "$SSH_TARGET" "bash -lc '
  set -euo pipefail
  mkdir -p /tmp/solocore-deploy-locks
  exec 9>\"/tmp/solocore-deploy-locks/${LOCK_NAME}.lock\"
  flock -n 9 || { echo \"Another deploy is already running for ${REMOTE_APP_DIR}\"; exit 1; }
  cd \"$REMOTE_APP_DIR\"
  npm install --omit=dev
  sudo systemctl restart \"$SERVICE_NAME\"
  sudo systemctl is-active \"$SERVICE_NAME\"
'"
