# Simple MSAA Compilation Debug Script
$code = Get-Content ".\lib\powershell\msaa.ts" -Raw
$code = ($code -split 'const MSAA_HELPER_CODE = /\* csharp \*/ `')[1]
$code = ($code -split '`;')[0]

$assemblies = 'System','System.Core','WindowsBase','UIAutomationClient','UIAutomationTypes'
$dllPath = ".\build\lib\dll\MSAAHelper.dll"

New-Item -ItemType Directory -Path (Split-Path $dllPath) -Force -ErrorAction SilentlyContinue | Out-Null

Write-Host "Compiling..." -ForegroundColor Yellow
Add-Type -TypeDefinition $code -Language CSharp -ReferencedAssemblies $assemblies -OutputAssembly $dllPath -ErrorAction Stop
Write-Host "SUCCESS!" -ForegroundColor Green
