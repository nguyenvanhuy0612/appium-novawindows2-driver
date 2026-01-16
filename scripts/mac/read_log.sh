#!/usr/bin/expect -f

set ip "192.168.8.245"
set user "admin"
set password "welcome"
set port 22

# Read the last 200 lines
spawn ssh -p $port $user@$ip "powershell -Command \"Get-Content -Path C:\\Users\\admin\\Desktop\\appium_server.log -Tail 200\""
expect {
    -re ".*Are you sure you want to continue connecting.*" { send "yes\r"; exp_continue }
    "password:" { send "$password\r"; exp_continue }
    eof
}
