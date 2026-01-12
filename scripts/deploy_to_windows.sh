#!/bin/bash
ip="192.168.8.245"
user="admin"
pass="welcome"

# Create mount point
mkdir -p ~/win_share

# Mount SMB share if not mounted
if ! mount | grep -q "win_share"; then
    mount_smbfs "//$user:$pass@$ip/C_Share" ~/win_share
fi

# Build
cd ~/Documents/appium-novawindows2-driver
npm run build

# Copy files
rsync -avh --progress \
 --include='build/***' \
 --include='lib/***' \
 --include='*.json' \
 --exclude='*' \
 ~/Documents/appium-novawindows2-driver/ \
 ~/win_share/appium-novawindows2-driver/