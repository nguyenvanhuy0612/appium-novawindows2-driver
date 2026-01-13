#!/usr/bin/expect -f

set ip "192.168.8.245"
set user "admin"
set password "welcome"
set port 22
set local_script "scripts/Start_Appium_Remote_Fixed.ps1"
set remote_script "Start_Appium_TS_Remote.ps1"

# Set timeout
set timeout 60

# Step 1: SCP the script
send_user "Copying script to remote machine...\n"
spawn scp -P $port $local_script $user@$ip:$remote_script
expect {
    -re ".*Are you sure you want to continue connecting.*" { send "yes\r"; exp_continue }
    "password:" { send "$password\r"; exp_continue }
    eof
}

# Step 2: SSH to execute the script
send_user "Executing remote script...\n"
spawn ssh -p $port $user@$ip "powershell -File $remote_script"
expect {
    -re ".*Are you sure you want to continue connecting.*" { send "yes\r"; exp_continue }
    "password:" { send "$password\r"; exp_continue }
    timeout { send_user "Timeout waiting for script execution.\n"; exit 1 }
    eof
}

send_user "Done.\n"
