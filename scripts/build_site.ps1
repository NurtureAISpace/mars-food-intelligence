# Static demo site for GitHub Pages (https://nurtureaispace.github.io):
#   site-dist/        dashboard (frontend/, base '/')
#   site-dist/app/    Astronaut App (apps/astronaut/, base '/app/')
# Both are built with VITE_STATIC_DEMO=1: they read the JSON snapshot (public/snapshot/, written by
# scripts/export_snapshot.py) instead of /api. The live laptop demo builds (npm run build) are not affected.
#
# Usage (PowerShell, repo root):  .\scripts\build_site.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'site-dist'

function Invoke-Build([string]$dir, [string]$base, [string]$outDir) {
    Push-Location (Join-Path $root $dir)
    try {
        $env:VITE_STATIC_DEMO = '1'
        $env:VITE_BASE = $base
        npm run build -- --outDir $outDir --emptyOutDir
        if ($LASTEXITCODE -ne 0) { throw "build failed in $dir" }
    } finally {
        Remove-Item Env:VITE_STATIC_DEMO, Env:VITE_BASE -ErrorAction SilentlyContinue
        Pop-Location
    }
}

foreach ($snap in @('frontend\public\snapshot', 'apps\astronaut\public\snapshot')) {
    if (-not (Test-Path (Join-Path $root "$snap\health_checkin_guide.json"))) {
        throw "Missing snapshot in $snap - run scripts/export_snapshot.py with the backend on 127.0.0.1:8001"
    }
}

# Empty (not delete) site-dist, so a running `python -m http.server` inside it does not block the build.
if (Test-Path $out) { Get-ChildItem -Force $out | Remove-Item -Recurse -Force }
Invoke-Build 'frontend' '/' $out
Invoke-Build 'apps\astronaut' '/app/' (Join-Path $out 'app')
New-Item -ItemType File -Force (Join-Path $out '.nojekyll') | Out-Null

Write-Host "site-dist ready: $out"
