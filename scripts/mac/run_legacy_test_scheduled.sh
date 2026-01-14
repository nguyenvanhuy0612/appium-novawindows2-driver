#!/usr/bin/expect -f

set ip "192.168.8.245"
set user "admin"
set password "welcome"
set port 22
set local_test_script "examples/legacy_test.ps1"
set local_runner_script "scripts/Start_LegacyTest.ps1"
set remote_test_script "legacy_test.ps1"
set remote_runner_script "Start_LegacyTest.ps1"
set remote_log "legacy_test.log"

# Set timeout
set timeout 120

# Step 1: SCP the scripts
send_user "Copying scripts to remote machine...\n"
spawn scp -P $port $local_test_script $local_runner_script $user@$ip:
expect {
    -re ".*Are you sure you want to continue connecting.*" { send "yes\r"; exp_continue }
    "password:" { send "$password\r"; exp_continue }
    eof
}

# Step 2: SSH to execute the runner
send_user "Executing runner script (creates Scheduled Task)...\n"
spawn ssh -p $port $user@$ip "powershell -File $remote_runner_script"
expect {
    -re ".*Are you sure you want to continue connecting.*" { send "yes\r"; exp_continue }
    "password:" { send "$password\r"; exp_continue }
    timeout { send_user "Timeout waiting for runner script.\n"; exit 1 }
    eof
}

# Step 3: SSH to cat the log file
send_user "Reading remote log file...\n"
spawn ssh -p $port $user@$ip "type $remote_log"
expect {
    -re ".*Are you sure you want to continue connecting.*" { send "yes\r"; exp_continue }
    "password:" { send "$password\r"; exp_continue }
    timeout { send_user "Timeout reading log file.\n"; exit 1 }
    eof
}

send_user "Done.\n"
