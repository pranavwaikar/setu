# install.ps1 — Setu CLI installer for Windows (PowerShell)
# Usage: Invoke-WebRequest -UseBasicParsing <INSTALL_URL> | Invoke-Expression
#
# Or save and run:
#   powershell -ExecutionPolicy Bypass -File install.ps1

[CmdletBinding()]
param (
    [string]$GitHubOwner = $env:GITHUB_OWNER ?? "pranavwaikar",
    [string]$GitHubRepo  = $env:GITHUB_REPO  ?? "setu",
    [string]$InstallDir  = "$env:LOCALAPPDATA\setu"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ─── helpers ──────────────────────────────────────────────────────────────────

function Say   { param([string]$msg) Write-Host "==> $msg" -ForegroundColor Cyan }
function Ok    { param([string]$msg) Write-Host "✔ $msg"  -ForegroundColor Green }
function Err   { param([string]$msg) Write-Error "✗ $msg"; exit 1 }
function Warn  { param([string]$msg) Write-Warning "⚠ $msg" }

# ─── detect architecture ──────────────────────────────────────────────────────

$Arch = switch ($env:PROCESSOR_ARCHITECTURE) {
    "AMD64" { "amd64" }
    "ARM64" { Err "arm64 is not yet supported on Windows" }
    default { Err "Unsupported architecture: $env:PROCESSOR_ARCHITECTURE" }
}

# ─── fetch latest release tag ─────────────────────────────────────────────────

Say "Fetching latest release..."
$ApiUrl  = "https://api.github.com/repos/$GitHubOwner/$GitHubRepo/releases/latest"
$headers = @{ "Accept" = "application/vnd.github+json"; "User-Agent" = "setu-installer" }

try {
    $release = Invoke-RestMethod -Uri $ApiUrl -Headers $headers
} catch {
    Err "Failed to fetch latest release: $_"
}

$Tag = $release.tag_name
if (-not $Tag) { Err "Could not determine latest release tag." }

# ─── download archive ─────────────────────────────────────────────────────────

$Archive     = "setu_windows_${Arch}.zip"
$BaseUrl     = "https://github.com/$GitHubOwner/$GitHubRepo/releases/download/$Tag"
$ArchiveUrl  = "$BaseUrl/$Archive"
$ChecksumUrl = "$BaseUrl/checksums.txt"

$TmpDir = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path "$env:TEMP\setu-install-$(Get-Random)" }

Say "Installing Setu $Tag (windows/$Arch)"
Say "Downloading $Archive..."

try {
    Invoke-WebRequest -Uri $ArchiveUrl -OutFile "$TmpDir\$Archive" -UseBasicParsing
} catch {
    Err "Download failed from $ArchiveUrl : $_"
}

# ─── verify checksum ──────────────────────────────────────────────────────────

Say "Verifying checksum..."
try {
    Invoke-WebRequest -Uri $ChecksumUrl -OutFile "$TmpDir\checksums.txt" -UseBasicParsing

    $checksumContent = Get-Content "$TmpDir\checksums.txt"
    $expectedLine    = $checksumContent | Where-Object { $_ -match [regex]::Escape($Archive) }

    if ($expectedLine) {
        $expected = ($expectedLine -split '\s+')[0]
        $actual   = (Get-FileHash -Algorithm SHA256 "$TmpDir\$Archive").Hash.ToLower()
        if ($expected -ne $actual) {
            Err "Checksum mismatch! Expected: $expected  Got: $actual"
        }
        Ok "Checksum verified."
    } else {
        Warn "Archive not found in checksums.txt — skipping verification."
    }
} catch {
    Warn "Could not fetch checksums.txt — skipping verification: $_"
}

# ─── extract ──────────────────────────────────────────────────────────────────

Say "Extracting..."
Expand-Archive -Path "$TmpDir\$Archive" -DestinationPath "$TmpDir\extracted" -Force

$Binary = Get-ChildItem -Path "$TmpDir\extracted" -Recurse -Filter "setu.exe" | Select-Object -First 1
if (-not $Binary) { Err "setu.exe not found in archive." }

# ─── install ──────────────────────────────────────────────────────────────────

Say "Installing to $InstallDir..."
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}
Copy-Item -Path $Binary.FullName -Destination "$InstallDir\setu.exe" -Force

# ─── add to PATH ──────────────────────────────────────────────────────────────

$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($userPath -notlike "*$InstallDir*") {
    Say "Adding $InstallDir to user PATH..."
    [Environment]::SetEnvironmentVariable("PATH", "$userPath;$InstallDir", "User")
    Ok "PATH updated — please restart your terminal."
} else {
    Ok "$InstallDir is already in PATH."
}

# ─── cleanup ──────────────────────────────────────────────────────────────────

Remove-Item -Recurse -Force $TmpDir

Ok "Setu $Tag installed at $InstallDir\setu.exe"
Write-Host ""
Write-Host "Run:" -ForegroundColor Yellow
Write-Host "  setu version" -ForegroundColor White
Write-Host "  setu doctor"  -ForegroundColor White
Write-Host ""
