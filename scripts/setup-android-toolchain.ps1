[CmdletBinding()]
param(
  [string]$ToolRoot = (Join-Path $env:LOCALAPPDATA 'wichu-android'),
  [string]$AndroidSdkRoot = (Join-Path $env:LOCALAPPDATA 'Android\Sdk')
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$androidCommandLineToolsUrl =
  'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip'
$androidCommandLineToolsSha256 =
  '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a'
$adoptiumApiUrl =
  'https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse&jvm_impl=hotspot&heap_size=normal'

$setupId = [Guid]::NewGuid().ToString('N')
$setupRoot = Join-Path $env:TEMP "wichu-android-setup-$setupId"
$commandLineToolsArchive = Join-Path $setupRoot 'commandline-tools.zip'
$commandLineToolsExtract = Join-Path $setupRoot 'commandline-tools'
$jdkArchive = Join-Path $setupRoot 'temurin-jdk17.zip'
$jdkExtract = Join-Path $setupRoot 'jdk'
$jdkRoot = Join-Path $ToolRoot 'jdk-17'
$sdkManager = Join-Path $AndroidSdkRoot 'cmdline-tools\latest\bin\sdkmanager.bat'

function Invoke-VerifiedDownload {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$Destination,
    [Parameter(Mandatory = $true)][string]$ExpectedSha256
  )

  & curl.exe --fail --location --retry 3 --output $Destination $Url
  if ($LASTEXITCODE -ne 0) {
    throw "Download failed: $Url"
  }

  $actualSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $Destination).Hash.ToLowerInvariant()
  if ($actualSha256 -ne $ExpectedSha256.ToLowerInvariant()) {
    throw "SHA-256 mismatch for $Destination"
  }
}

function Add-UserPathEntry {
  param([Parameter(Mandatory = $true)][string]$Entry)

  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $entries = @($userPath -split ';' | Where-Object { $_ })
  if ($entries -notcontains $Entry) {
    $updatedPath = (@($entries) + $Entry) -join ';'
    [Environment]::SetEnvironmentVariable('Path', $updatedPath, 'User')
  }
}

New-Item -ItemType Directory -Force -Path $setupRoot, $ToolRoot, $AndroidSdkRoot | Out-Null

if (Test-Path -LiteralPath (Join-Path $jdkRoot 'bin\java.exe')) {
  Write-Host "Using the existing verified JDK at $jdkRoot"
} else {
  Write-Host 'Resolving the latest Eclipse Temurin 17 archive...'
  $jdkAssets = Invoke-RestMethod -Uri $adoptiumApiUrl
  $jdkPackage = @($jdkAssets)[0].binary.package
  if (-not $jdkPackage.link -or -not $jdkPackage.checksum) {
    throw 'Could not resolve a verified Temurin 17 archive.'
  }

  Write-Host 'Downloading and verifying Eclipse Temurin 17...'
  Invoke-VerifiedDownload -Url $jdkPackage.link -Destination $jdkArchive -ExpectedSha256 $jdkPackage.checksum
  New-Item -ItemType Directory -Force -Path $jdkExtract | Out-Null
  & tar.exe -xf $jdkArchive -C $jdkExtract
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not extract the Temurin archive.'
  }
  $extractedJdk = Get-ChildItem -LiteralPath $jdkExtract -Directory | Select-Object -First 1
  if (-not $extractedJdk) {
    throw 'The Temurin archive did not contain a JDK directory.'
  }
  Move-Item -LiteralPath $extractedJdk.FullName -Destination $jdkRoot
}

$latestToolsRoot = Join-Path $AndroidSdkRoot 'cmdline-tools\latest'
if (Test-Path -LiteralPath $sdkManager) {
  Write-Host "Using the existing Android command-line tools at $latestToolsRoot"
} else {
  Write-Host 'Downloading and verifying Android command-line tools...'
  Invoke-VerifiedDownload `
    -Url $androidCommandLineToolsUrl `
    -Destination $commandLineToolsArchive `
    -ExpectedSha256 $androidCommandLineToolsSha256
  New-Item -ItemType Directory -Force -Path $commandLineToolsExtract | Out-Null
  & tar.exe -xf $commandLineToolsArchive -C $commandLineToolsExtract
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not extract the Android command-line tools archive.'
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $latestToolsRoot) | Out-Null
  Move-Item -LiteralPath (Join-Path $commandLineToolsExtract 'cmdline-tools') -Destination $latestToolsRoot
}

$env:JAVA_HOME = $jdkRoot
$env:ANDROID_HOME = $AndroidSdkRoot
$env:ANDROID_SDK_ROOT = $AndroidSdkRoot
$env:Path = "$jdkRoot\bin;$AndroidSdkRoot\platform-tools;$latestToolsRoot\bin;$env:Path"

Write-Host 'Accepting Android SDK licenses...'
$licenseResponses = 1..200 | ForEach-Object { 'y' }
$licenseResponses | & $sdkManager --licenses | Out-Host
if ($LASTEXITCODE -ne 0) {
  throw 'Android SDK license acceptance failed.'
}

Write-Host 'Installing Expo SDK 57 / React Native 0.86 Android dependencies...'
& $sdkManager `
  'platform-tools' `
  'platforms;android-36' `
  'build-tools;36.0.0' `
  'ndk;27.1.12297006' `
  'cmake;3.22.1'
if ($LASTEXITCODE -ne 0) {
  throw 'Android SDK package installation failed.'
}

[Environment]::SetEnvironmentVariable('JAVA_HOME', $jdkRoot, 'User')
[Environment]::SetEnvironmentVariable('ANDROID_HOME', $AndroidSdkRoot, 'User')
[Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', $AndroidSdkRoot, 'User')
Add-UserPathEntry -Entry (Join-Path $jdkRoot 'bin')
Add-UserPathEntry -Entry (Join-Path $AndroidSdkRoot 'platform-tools')
Add-UserPathEntry -Entry (Join-Path $latestToolsRoot 'bin')

Write-Host 'Verifying installed tools...'
& (Join-Path $jdkRoot 'bin\java.exe') -version
& (Join-Path $AndroidSdkRoot 'platform-tools\adb.exe') version
& $sdkManager --version

Write-Host "JAVA_HOME=$jdkRoot"
Write-Host "ANDROID_HOME=$AndroidSdkRoot"
Write-Host 'Android toolchain setup completed. Open a new terminal to use the persisted environment.'
Write-Host "Temporary downloads remain at: $setupRoot"
