Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\build\icon.png"
$icoPath = Join-Path $PSScriptRoot "..\build\icon.ico"
$sizes = @(16, 24, 32, 48, 64, 128, 256)

$src = [System.Drawing.Image]::FromFile((Resolve-Path $srcPath))
$images = @()

foreach ($s in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.Clear([System.Drawing.Color]::FromArgb(255, 11, 11, 15))
  $g.DrawImage($src, 0, 0, $s, $s)
  $g.Dispose()
  $images += $bmp
}

$out = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $out
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$images.Count)

$offset = 6 + (16 * $images.Count)
$pngBlobs = @()

foreach ($bmp in $images) {
  $pms = New-Object System.IO.MemoryStream
  $bmp.Save($pms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $pms.ToArray()
  $pms.Dispose()
  $pngBlobs += , $bytes

  $w = if ($bmp.Width -ge 256) { 0 } else { [byte]$bmp.Width }
  $h = if ($bmp.Height -ge 256) { 0 } else { [byte]$bmp.Height }
  $bw.Write([byte]$w)
  $bw.Write([byte]$h)
  $bw.Write([byte]0)
  $bw.Write([byte]0)
  $bw.Write([UInt16]1)
  $bw.Write([UInt16]32)
  $bw.Write([UInt32]$bytes.Length)
  $bw.Write([UInt32]$offset)
  $offset += $bytes.Length
}

foreach ($blob in $pngBlobs) { $bw.Write($blob) }
$bw.Flush()
[IO.File]::WriteAllBytes((Resolve-Path (Split-Path $icoPath -Parent)).Path + "\icon.ico", $out.ToArray())

foreach ($bmp in $images) { $bmp.Dispose() }
$src.Dispose()
$bw.Dispose()
$out.Dispose()

Write-Output "Wrote icon.ico bytes=$((Get-Item $icoPath).Length)"
