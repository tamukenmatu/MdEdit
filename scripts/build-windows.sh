#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Syncing and Building MdEdit for Windows (msi: MSVC / Portable .exe) ==="
rsync -avz --no-perms --no-owner --no-group --exclude 'target' --exclude 'node_modules' --exclude '.git' \
  --rsync-path="C:/ProgramData/chocolatey/bin/rsync.exe" \
  "$DIR/" msi:/cygdrive/c/Users/makke/projects/MdEdit/

ssh msi "pwsh -Command 'Stop-Process -Name app, MdEdit -Force -ErrorAction SilentlyContinue; \$env:Path = [System.Environment]::GetEnvironmentVariable(\"Path\",\"User\") + \";\" + [System.Environment]::GetEnvironmentVariable(\"Path\",\"Machine\"); Set-Location C:\Users\makke\projects\MdEdit; npm install; npx tauri build; New-Item -ItemType Directory -Force -Path C:\Users\makke\Documents\Myapplication | Out-Null; Copy-Item src-tauri\target\release\app.exe C:\Users\makke\Documents\Myapplication\MdEdit.exe -Force'"

echo "SUCCESS: Windows portable binary deployed to msi:C:\Users\makke\Documents\Myapplication\MdEdit.exe"
