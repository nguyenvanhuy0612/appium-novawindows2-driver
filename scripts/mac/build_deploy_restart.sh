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
ps_command="Set-Location '$target_dir'; Get-ChildItem | Where-Object { \$_.Name -notin 'node_modules','build.zip' } | Remove-Item -Recurse -Force; Expand-Archive -Path build.zip -DestinationPath . -Force; & './scripts/Start_Appium.ps1'"
ssh $target_user@$target_ip "powershell -Command \"$ps_command\""
