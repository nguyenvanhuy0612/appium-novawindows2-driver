#!/bin/bash
source_code_dir="$HOME/Documents/appium-novawindows2-driver"
target_dir="C:/Share/appium-novawindows2-driver"
target_ip="192.168.8.245"
target_user="admin"
log_file="~/Desktop/appium_server.log"

scp $target_user@$target_ip:$log_file $source_code_dir