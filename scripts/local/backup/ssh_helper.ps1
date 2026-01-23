# Generate ssh key and copy ssh public key to remote machine
$ip = "192.168.1.19"
$user = "admin"

# Check if ssh key exists
if (-not (Test-Path "~/.ssh/id_rsa")) {
    # Generate ssh key
    ssh-keygen -t rsa -b 4096 -C "$user@$ip"
}

# Copy ssh public key to remote machine (Windows SSH Server)
$pubKey = Get-Content ~/.ssh/id_rsa.pub
# Add to administrators_authorized_keys for admin access on Windows attempting to avoid duplicates, with correct ACLs and encoding
$remoteCmd = "`$path = 'C:\ProgramData\ssh\administrators_authorized_keys'; if (-not (Test-Path `$path)) { New-Item -Path `$path -Force | Out-Null }; `$content = Get-Content -Path `$path -Raw -ErrorAction SilentlyContinue; if (-not `$content -or -not `$content.Contains('$pubKey')) { Add-Content -Path `$path -Value '$pubKey' -Encoding Ascii -Force }; & icacls `$path /inheritance:r /grant Administrators:F /grant SYSTEM:F"
ssh $user@$ip "powershell -Command `"$remoteCmd`""

# Test ssh connection
ssh $user@$ip "echo SSH connection successful"
