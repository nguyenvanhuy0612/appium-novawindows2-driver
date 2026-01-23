#!/bin/bash
target_ip="192.168.8.245"
target_user="admin"

# Generate ssh key and copy ssh public key to remote machine
if [ ! -f ~/.ssh/id_rsa ]; then
    ssh-keygen -t rsa -b 4096 -C "$target_user@$target_ip"
fi

# Copy ssh public key to remote machine (Windows SSH Server)
pubKey=$(cat ~/.ssh/id_rsa.pub)
remoteCmd="\$path = 'C:\ProgramData\ssh\administrators_authorized_keys'; if (-not (Test-Path \$path)) { New-Item -Path \$path -Force | Out-Null }; \$content = Get-Content -Path \$path -Raw -ErrorAction SilentlyContinue; if (-not \$content -or -not \$content.Contains('$pubKey')) { Add-Content -Path \$path -Value '$pubKey' -Encoding Ascii -Force }; & icacls \$path /inheritance:r /grant Administrators:F /grant SYSTEM:F"
ssh $target_user@$target_ip "powershell -Command \"$remoteCmd\""

# Test ssh connection
ssh $target_user@$target_ip "echo SSH connection successful"
