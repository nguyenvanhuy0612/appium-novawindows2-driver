#!/bin/bash
source_code_dir="$HOME/Documents/appium-novawindows2-driver"
target_dir="C:/appium/appium-novawindows2-driver"
target_ip="172.16.10.37"
target_user="admin"
log_file="~/Desktop/appium_server.log"

scp $target_user@$target_ip:$log_file $source_code_dir