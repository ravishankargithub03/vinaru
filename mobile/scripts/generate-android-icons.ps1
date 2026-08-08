# Generate Vinaru "V" Android launcher icons from app/build/icon.png
Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\..\app\build\icon.png"
if (-not (Test-Path $srcPath)) {
  $srcPath = Join-Path $PSScriptRoot "..\..\app\build\icon.png"
}
$srcPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..\app\build\icon.png")).Path
$resRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\android\app\src\main\res")).Path

$src = [System.Drawing.Image]::FromFile($srcPath)
$bg = [System.Drawing.Color]::FromArgb(255, 11, 11, 15) # #0b0b0f

function Save-Icon([string]$path, [int]$size, [bool]$withPadding) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($bg)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  if ($withPadding) {
    # Adaptive icon safe zone ~66% of canvas
    $pad = [int]([math]::Round($size * 0.18))
    $inner = $size - (2 * $pad)
    $g.DrawImage($src, $pad, $pad, $inner, $inner)
  } else {
    $g.DrawImage($src, 0, 0, $size, $size)
  }

  $g.Dispose()
  $dir = Split-Path $path -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "Wrote $path ($size)"
}

$densities = @{
  "mipmap-mdpi"    = @{ launcher = 48;  foreground = 108 }
  "mipmap-hdpi"    = @{ launcher = 72;  foreground = 162 }
  "mipmap-xhdpi"   = @{ launcher = 96;  foreground = 216 }
  "mipmap-xxhdpi"  = @{ launcher = 144; foreground = 324 }
  "mipmap-xxxhdpi" = @{ launcher = 192; foreground = 432 }
}

foreach ($den in $densities.Keys) {
  $sizes = $densities[$den]
  $dir = Join-Path $resRoot $den
  Save-Icon (Join-Path $dir "ic_launcher.png") $sizes.launcher $false
  Save-Icon (Join-Path $dir "ic_launcher_round.png") $sizes.launcher $false
  Save-Icon (Join-Path $dir "ic_launcher_foreground.png") $sizes.foreground $true
}

# Also replace legacy splash drawable used as fallback branding
$splash = Join-Path $resRoot "drawable\splash.png"
Save-Icon $splash 512 $false

$src.Dispose()
Write-Output "Done generating Vinaru launcher icons."
