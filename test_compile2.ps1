$assemblies = 'System','System.Core','WindowsBase','UIAutomationClient','UIAutomationTypes','UIAutomationProvider'
$dllPath = ".\build\lib\dll\MSAAHelper_test.dll"
$code = (Get-Content ".\build\lib\powershell\msaa.js" -Raw -Encoding UTF8) -replace '[\s\S]*MSAA_HELPER_CODE = /\* csharp \*/ `(.+?)`;[\s\S]*','$1'

New-Item -ItemType Directory -Path (Split-Path $dllPath) -Force -ErrorAction SilentlyContinue | Out-Null

Write-Host "Compiling with assemblies: $($assemblies -join ', ')" -ForegroundColor Cyan
try {
    Add-Type -TypeDefinition $code -Language CSharp -ReferencedAssemblies $assemblies -OutputAssembly $dllPath -ErrorAction Stop
    Write-Host "✓ SUCCESS! DLL compiled at: $dllPath" -ForegroundColor Green
    (Get-Item $dllPath).Length
} catch {
    Write-Host "✗ FAILED: $_" -ForegroundColor Red
    exit 1
}
