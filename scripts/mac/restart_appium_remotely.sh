#!/bin/bash
USER_HOST="admin@192.168.8.245"
ps_command="Stop-Process -Name node -ErrorAction SilentlyContinue;"
ps_command+="cd C:\\Share\\appium-novawindows2-driver;"
ps_command+="& './scripts/Start_Appium.ps1'"
ssh $USER_HOST "powershell -Command \"$ps_command\""
echo "Appium restarted on $USER_HOST"
