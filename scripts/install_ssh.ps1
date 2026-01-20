if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "This script must be run as administrator"
    pause
    exit 1
}

$U="https://github.com/PowerShell/Win32-OpenSSH/releases/download/10.0.0.0p2-Preview/OpenSSH-Win64.zip"
$D=Get-Location;$Z="$D\OpenSSH-Win64.zip";$S="$D\OpenSSH-Win64";$T="C:\OpenSSH-Win64"

if (-not (Test-Path $Z)) { Invoke-WebRequest $U -OutFile $Z }
if (-not (Test-Path $S)) { Expand-Archive $Z $D -Force }
if (-not (Test-Path $T)) { Copy-Item $S C:\ -Recurse -Force }

icacls "$T\libcrypto.dll" /grant Everyone:RX >$null
Set-Location $T; powershell -ExecutionPolicy Bypass .\install-sshd.ps1

sc.exe config sshd start=auto >$null
sc.exe config ssh-agent start=auto >$null
sc.exe start ssh-agent >$null
sc.exe start sshd >$null

if (-not (Get-NetFirewallRule -Name sshd -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name sshd -DisplayName "OpenSSH SSH Server" `
        -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 `
        -Program "$T\sshd.exe"
}
