import { errors } from '@appium/base-driver';
import { NovaWindows2Driver } from '../driver';

const BASE64_REGEX = /^[A-Za-z0-9+/=\s]*$/;

export async function pushFile(this: NovaWindows2Driver, remotePath: string, base64Data: string): Promise<void> {
    this.log.debug(`Pushing file to: ${remotePath}`);

    if (!BASE64_REGEX.test(base64Data)) {
        throw new errors.InvalidArgumentError('pushFile: payload must be a base64-encoded string');
    }

    const escapedPath = remotePath.replace(/'/g, "''");

    const command = `
$targetPath = '${escapedPath}';
$base64String = '${base64Data}';
$parentDir = Split-Path -Path $targetPath -Parent;
if (-not (Test-Path -Path $parentDir)) { New-Item -ItemType Directory -Force -Path $parentDir | Out-Null };
$bytes = [Convert]::FromBase64String($base64String);
[System.IO.File]::WriteAllBytes($targetPath, $bytes);
`;

    await this.sendPowerShellCommand(command);
}

export async function pullFile(this: NovaWindows2Driver, remotePath: string): Promise<string> {
    this.log.debug(`Pulling file from: ${remotePath}`);
    const escapedPath = remotePath.replace(/'/g, "''");

    const command = `
$targetPath = '${escapedPath}';
if (-not (Test-Path -Path $targetPath -PathType Leaf)) { throw "File not found: $targetPath" };
$bytes = [System.IO.File]::ReadAllBytes($targetPath);
[Convert]::ToBase64String($bytes);
`;

    return await this.sendPowerShellCommand(command);
}

export async function pullFolder(this: NovaWindows2Driver, remotePath: string): Promise<string> {
    this.log.debug(`Pulling folder from: ${remotePath}`);
    const escapedPath = remotePath.replace(/'/g, "''");

    const command = `
$targetPath = '${escapedPath}';
$tempGuid = [Guid]::NewGuid().ToString();
$zipPath = Join-Path $env:TEMP "appium_$tempGuid.zip";
if (-not (Test-Path -Path $targetPath -PathType Container)) { throw "Folder not found: $targetPath" };
Compress-Archive -Path $targetPath -DestinationPath $zipPath -Force;
$bytes = [System.IO.File]::ReadAllBytes($zipPath);
$base64 = [Convert]::ToBase64String($bytes);
Remove-Item -Path $zipPath -Force;
$base64;
`;

    return await this.sendPowerShellCommand(command);
}
