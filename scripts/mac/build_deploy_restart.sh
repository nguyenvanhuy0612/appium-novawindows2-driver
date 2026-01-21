#!/bin/bash
source_code_dir="$HOME/Documents/appium-novawindows2-driver"
target_dir="C:/Share/appium-novawindows2-driver"
target_ip="192.168.8.245"
target_user="admin"

# Build
cd $source_code_dir
npm run build --no-save

# Deploy
# zip build folder
zip -r build.zip build package.json lib scripts

# scp copy to target
scp build.zip $target_user@$target_ip:$target_dir

# cleanup, unzip, restart appium
ps_command="Stop-Process -Name node -ErrorAction SilentlyContinue;"
ps_command+="Set-Location '$target_dir';"
ps_command+="Get-ChildItem | Where-Object { \$_.Name -notin 'node_modules','build.zip' } | Remove-Item -Recurse -Force;"
ps_command+="Expand-Archive -Path build.zip -DestinationPath . -Force;"
ps_command+="& './scripts/Start_Appium.ps1'"
ssh $target_user@$target_ip "powershell -Command \"$ps_command\""
