param(
  [switch]$Prebuild
)

$ErrorActionPreference = 'Stop'
$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$credentialsPath = Join-Path $workspace 'credentials.json'
$androidPath = Join-Path $workspace 'android'
$initScript = Join-Path $PSScriptRoot 'android-release-signing.gradle'

function Import-LocalExpoEnvironment {
  param([string]$Path)

  $imported = @()
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $imported }

  foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
    if ($line -notmatch '^\s*(EXPO_PUBLIC_[A-Za-z0-9_]+)\s*=\s*(.*)$') { continue }

    $name = $matches[1]
    if (-not [string]::IsNullOrWhiteSpace([string](Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue).Value)) {
      continue
    }

    $value = $matches[2].Trim()
    if (
      $value.Length -ge 2 -and
      (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'")))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    Set-Item -Path "Env:$name" -Value $value
    $imported += $name
  }

  return $imported
}

# Expo evaluates app.config.js before its normal dotenv output appears. Load only
# public app variables up front so local production prebuilds use the same values
# as EAS. Private entries such as deployment tokens are intentionally ignored.
$previousReviewSamplesEnvironment = $env:EXPO_PUBLIC_ENABLE_REVIEW_SAMPLES
$importedExpoEnvironment = Import-LocalExpoEnvironment (Join-Path $workspace '.env.local')

# Review samples are strictly a local-development fixture. Force the production
# bundle off even when a developer's .env.local intentionally enables them.
$env:EXPO_PUBLIC_ENABLE_REVIEW_SAMPLES = 'false'

try {

Push-Location $workspace
try {
  & npm.cmd run verify
  if ($LASTEXITCODE -ne 0) { throw "Release verification failed with exit code $LASTEXITCODE." }
} finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath $credentialsPath -PathType Leaf)) {
  throw 'credentials.json is required for the Play upload signing key.'
}

$credentials = Get-Content -Raw -Encoding UTF8 -LiteralPath $credentialsPath | ConvertFrom-Json
$signing = $credentials.android.keystore
$required = @(
  $signing.keystorePath,
  $signing.keystorePassword,
  $signing.keyAlias,
  $signing.keyPassword
)

if ($required.Where({ [string]::IsNullOrWhiteSpace([string]$_) }).Count -gt 0) {
  throw 'Android keystore credentials are incomplete.'
}

$keystorePath = [System.IO.Path]::GetFullPath((Join-Path $workspace $signing.keystorePath))
if (-not (Test-Path -LiteralPath $keystorePath -PathType Leaf)) {
  throw "Android keystore was not found: $keystorePath"
}

if ($Prebuild) {
  $previousPrebuildProfile = $env:EAS_BUILD_PROFILE
  $previousPrebuildPlatform = $env:EAS_BUILD_PLATFORM
  try {
    $env:EAS_BUILD_PROFILE = 'production'
    $env:EAS_BUILD_PLATFORM = 'android'
    Push-Location $workspace
    try {
      & npx.cmd expo prebuild --platform android --no-install
      if ($LASTEXITCODE -ne 0) { throw "Expo prebuild failed with exit code $LASTEXITCODE." }
    } finally {
      Pop-Location
    }
  } finally {
    if ($null -eq $previousPrebuildProfile) {
      Remove-Item -Path 'Env:EAS_BUILD_PROFILE' -ErrorAction SilentlyContinue
    } else {
      $env:EAS_BUILD_PROFILE = $previousPrebuildProfile
    }
    if ($null -eq $previousPrebuildPlatform) {
      Remove-Item -Path 'Env:EAS_BUILD_PLATFORM' -ErrorAction SilentlyContinue
    } else {
      $env:EAS_BUILD_PLATFORM = $previousPrebuildPlatform
    }
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $androidPath 'gradlew.bat') -PathType Leaf)) {
  throw 'android/gradlew.bat is missing. Run this script with -Prebuild.'
}

$previousEnvironment = @{
  EAS_BUILD_PLATFORM = $env:EAS_BUILD_PLATFORM
  EAS_BUILD_PROFILE = $env:EAS_BUILD_PROFILE
  NODE_ENV = $env:NODE_ENV
  WICHU_UPLOAD_STORE_FILE = $env:WICHU_UPLOAD_STORE_FILE
  WICHU_UPLOAD_STORE_PASSWORD = $env:WICHU_UPLOAD_STORE_PASSWORD
  WICHU_UPLOAD_KEY_ALIAS = $env:WICHU_UPLOAD_KEY_ALIAS
  WICHU_UPLOAD_KEY_PASSWORD = $env:WICHU_UPLOAD_KEY_PASSWORD
}

try {
  $env:EAS_BUILD_PLATFORM = 'android'
  $env:EAS_BUILD_PROFILE = 'production'
  $env:NODE_ENV = 'production'
  $env:WICHU_UPLOAD_STORE_FILE = $keystorePath
  $env:WICHU_UPLOAD_STORE_PASSWORD = [string]$signing.keystorePassword
  $env:WICHU_UPLOAD_KEY_ALIAS = [string]$signing.keyAlias
  $env:WICHU_UPLOAD_KEY_PASSWORD = [string]$signing.keyPassword

  Push-Location $androidPath
  try {
    & .\gradlew.bat bundleRelease --no-daemon --init-script $initScript
    if ($LASTEXITCODE -ne 0) { throw "Android release build failed with exit code $LASTEXITCODE." }
  } finally {
    Pop-Location
  }
} finally {
  foreach ($entry in $previousEnvironment.GetEnumerator()) {
    if ($null -eq $entry.Value) {
      Remove-Item -Path "Env:$($entry.Key)" -ErrorAction SilentlyContinue
    } else {
      Set-Item -Path "Env:$($entry.Key)" -Value $entry.Value
    }
  }
}

$bundlePath = Join-Path $androidPath 'app\build\outputs\bundle\release\app-release.aab'
if (-not (Test-Path -LiteralPath $bundlePath -PathType Leaf)) {
  throw 'Gradle completed without producing app-release.aab.'
}

$buildGradle = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $androidPath 'app\build.gradle')
$versionMatch = [regex]::Match($buildGradle, 'versionCode\s+(\d+)')
if (-not $versionMatch.Success) { throw 'Could not read Android versionCode.' }

$artifactDirectory = Join-Path $workspace 'artifacts'
New-Item -ItemType Directory -Force -Path $artifactDirectory | Out-Null
$artifactPath = Join-Path $artifactDirectory "WICHU-v$($versionMatch.Groups[1].Value)-open-test.aab"
Copy-Item -LiteralPath $bundlePath -Destination $artifactPath -Force

$artifact = Get-Item -LiteralPath $artifactPath
$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $artifactPath
Write-Output "AAB: $($artifact.FullName)"
Write-Output "SizeMB: $([math]::Round($artifact.Length / 1MB, 2))"
Write-Output "SHA256: $($hash.Hash)"
} finally {
  foreach ($name in $importedExpoEnvironment) {
    Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
  }
  if ($null -eq $previousReviewSamplesEnvironment) {
    Remove-Item -Path 'Env:EXPO_PUBLIC_ENABLE_REVIEW_SAMPLES' -ErrorAction SilentlyContinue
  } else {
    $env:EXPO_PUBLIC_ENABLE_REVIEW_SAMPLES = $previousReviewSamplesEnvironment
  }
}
