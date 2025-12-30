#!/bin/bash
set -e

# get the directory of the currently executing script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$DIR"

echo "========================================"
echo "      Appium Driver Deployment"
echo "========================================"

echo "[1/2] Building project..."
cd "$PROJECT_ROOT"
npm run build

echo "[2/2] Syncing to Windows share (~/win_share)..."
# Ensure the share is accessible
if [ ! -d "$HOME/win_share" ]; then
    echo "Error: ~/win_share is not found. Please mount the share first."
    exit 1
fi

rsync -avh --progress \
  --include='build/***' \
  --include='lib/***' \
  --exclude='*' \
  "$PROJECT_ROOT/" \
  "$HOME/win_share/appium-novawindows2-driver/"

echo "========================================"
echo "Deployment successful!"
echo "Please restart Appium on the Windows machine (172.16.1.52)."
echo "========================================"
