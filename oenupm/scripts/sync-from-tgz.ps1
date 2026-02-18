param(
  [Parameter(Mandatory=$true)]
  [string]$Major,

  [Parameter(Mandatory=$false)]
  [string]$Version
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$srcDir = Join-Path $repoRoot ("packages\\$Major")
$outRoot = Join-Path $repoRoot 'oenupm\\packages'

if (-not (Test-Path -LiteralPath $srcDir)) {
  throw "Source directory not found: $srcDir"
}

New-Item -ItemType Directory -Force -Path $outRoot | Out-Null

# Select tarballs
$tgzFiles = Get-ChildItem -LiteralPath $srcDir -Filter '*.tgz' -File
if ($Version) {
  $tgzFiles = $tgzFiles | Where-Object { $_.Name -like "*-$Version.tgz" }
}

if (-not $tgzFiles -or $tgzFiles.Count -eq 0) {
  if ($Version) {
    throw "No .tgz files found in $srcDir for version '$Version'."
  }
  throw "No .tgz files found in $srcDir."
}

$tempBase = Join-Path $env:TEMP ("oenupm-sync-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tempBase | Out-Null

try {
  foreach ($tgz in $tgzFiles) {
    Write-Host "Extracting $($tgz.Name)" 

    $extractDir = Join-Path $tempBase ([IO.Path]::GetFileNameWithoutExtension($tgz.Name))
    if (Test-Path -LiteralPath $extractDir) {
      Remove-Item -LiteralPath $extractDir -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $extractDir | Out-Null

    # tarball contains a top-level 'package/' directory
    & tar -xzf $tgz.FullName -C $extractDir | Out-Null

    $pkgJsonPath = Join-Path $extractDir 'package\\package.json'
    if (-not (Test-Path -LiteralPath $pkgJsonPath)) {
      throw "package.json not found after extract: $pkgJsonPath"
    }

    $pkgJson = Get-Content -LiteralPath $pkgJsonPath -Raw | ConvertFrom-Json
    if (-not $pkgJson.name -or -not $pkgJson.version) {
      throw "Invalid package.json (missing name/version) in $($tgz.Name)"
    }

    $packageName = [string]$pkgJson.name
    $packageVersion = [string]$pkgJson.version

    # Invariants: do not rewrite upstream identity
    if ($Version -and $packageVersion -ne $Version) {
      throw "Version mismatch: expected $Version but tarball contains $packageVersion ($($tgz.Name))"
    }

    $destDir = Join-Path $outRoot $packageName
    if (Test-Path -LiteralPath $destDir) {
      Remove-Item -LiteralPath $destDir -Recurse -Force
    }

    # Copy extracted package/ directory contents into oenupm/packages/<packageName>/
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    Copy-Item -LiteralPath (Join-Path $extractDir 'package\\*') -Destination $destDir -Recurse -Force

    Write-Host "  -> $packageName@$packageVersion => $destDir"
  }

  Write-Host "Done. Materialized packages are in: $outRoot"
}
finally {
  if (Test-Path -LiteralPath $tempBase) {
    Remove-Item -LiteralPath $tempBase -Recurse -Force
  }
}
