# Fires the Story Hierarchy Refresh workflow via `workflow_dispatch`.
#
# Why this exists: repo-level `schedule` triggers have not fired since
# 2026-09-22 and the Actions policy endpoint 403s for non-admins, so the
# daily refresh is driven by Windows Task Scheduler calling this script
# (see .github/workflows/story-hierarchy.yml for the dormant cron fallback).
#
# Register once (03:23 America/Argentina/Buenos_Aires):
#   schtasks /Create /TN "Bunkai Story Hierarchy Refresh" /SC DAILY /ST 03:23 /F ^
#     /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"<repo>\scripts\trigger-story-hierarchy.ps1\""
param(
    # Extra delay before dispatching, seconds (skips stale-slot runs).
    [int]$ThrottleSeconds = 0
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if ($ThrottleSeconds -gt 0) {
    Start-Sleep -Seconds $ThrottleSeconds
}

$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$entry = $null
$exitCode = 0

try {
    gh workflow run story-hierarchy.yml
    if ($LASTEXITCODE -ne 0) {
        $exitCode = $LASTEXITCODE
        $entry = "[$stamp] FAIL: gh workflow run exit $exitCode"
    }
    else {
        $entry = "[$stamp] OK: workflow dispatched"
    }
}
catch {
    $exitCode = 1
    $entry = "[$stamp] ERROR: $($_.Exception.Message)"
}

$logPath = Join-Path $env:TEMP 'story-hierarchy-trigger.log'
Add-Content -Path $logPath -Value $entry -Encoding UTF8

Write-Output $entry
exit $exitCode
