<#
  Capture Android startup crash logs from a local release build.

  Usage:
    powershell -ExecutionPolicy Bypass -File scripts/capture-android-crash.ps1
#>

$ErrorActionPreference = 'Stop'
$package = 'app.wichu.mobile'

function Find-Adb {
  $cmd = Get-Command adb -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    "$env:ANDROID_HOME\platform-tools\adb.exe",
    "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe"
  )
  foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }
  throw 'adb was not found. Install Android SDK Platform Tools or set ANDROID_HOME.'
}

$adb = Find-Adb
Write-Host "adb: $adb"

$deviceRows = & $adb devices | Select-Object -Skip 1 | Where-Object { $_.Trim() }
$devices = $deviceRows | Where-Object { $_ -match '\sdevice$' }
if (-not $devices) {
  $knownDevices = if ($deviceRows) { $deviceRows -join ', ' } else { 'none' }
  throw "No online Android device found. adb devices: $knownDevices"
}
Write-Host "Devices: $($devices -join ', ')"

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = ".tmp/crash-$stamp.log"
New-Item -ItemType Directory -Force -Path '.tmp' | Out-Null

Write-Host "`nClearing logcat and launching $package..."
& $adb logcat -c
& $adb shell am force-stop $package
& $adb shell monkey -p $package -c android.intent.category.LAUNCHER 1 | Out-Null

Start-Sleep -Seconds 6

# Crash output remains in the system buffer after the app process exits.
& $adb logcat -d > $out
Write-Host "Full log saved: $out"

Write-Host "`n===== FATAL ERROR EXCERPT ====="
Select-String -Path $out -Pattern 'FATAL EXCEPTION|AndroidRuntime|ReactNativeJS|com\.facebook|SoLoader|UnsatisfiedLink|ClassNotFound|NoSuchMethod|app\.wichu' `
  | Select-Object -First 80 | ForEach-Object { $_.Line }

Write-Host "`nShare the excerpt above for diagnosis."
Write-Host "If the excerpt is empty, inspect the full file: $out"
