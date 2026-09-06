param(
  [string]$WorkspaceRoot = (Split-Path -Parent $PSScriptRoot)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$sourceDirectory = Join-Path $WorkspaceRoot 'assets\store-listing\source'
$listingDirectory = Join-Path $WorkspaceRoot 'assets\store-listing\ko-KR'
$featureSourcePath = Join-Path $sourceDirectory 'feature-inclusive-v2.png'
$welcomeSourcePath = Join-Path $WorkspaceRoot 'assets\brand\wichu-welcome-inclusive-v1.jpg'
$featureOutputPath = Join-Path $listingDirectory 'feature-graphic-1024x500-v2.jpg'
$welcomeOutputPath = Join-Path $listingDirectory '00-welcome-1080x1920-v2.jpg'

function New-RoundedRectanglePath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-CoverImage {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Image]$Image,
    [System.Drawing.RectangleF]$Target
  )

  $scale = [Math]::Max($Target.Width / $Image.Width, $Target.Height / $Image.Height)
  $sourceWidth = $Target.Width / $scale
  $sourceHeight = $Target.Height / $scale
  $sourceX = ($Image.Width - $sourceWidth) / 2
  $sourceY = [Math]::Max(0, ($Image.Height - $sourceHeight) * 0.18)
  $source = [System.Drawing.RectangleF]::new($sourceX, $sourceY, $sourceWidth, $sourceHeight)
  $Graphics.DrawImage($Image, $Target, $source, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-Wordmark {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Size
  )

  $wordmarkFont = [System.Drawing.Font]::new('Arial Black', $Size, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $heartFont = [System.Drawing.Font]::new('Segoe UI Symbol', $Size * 0.43, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $inkBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(17, 17, 17))
  $pinkBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 45, 111))
  try {
    $Graphics.DrawString('WICHU', $wordmarkFont, $inkBrush, $X, $Y)
    $Graphics.DrawString('♥', $heartFont, $pinkBrush, $X + ($Size * 1.63), $Y - ($Size * 0.25))
  } finally {
    $pinkBrush.Dispose()
    $inkBrush.Dispose()
    $heartFont.Dispose()
    $wordmarkFont.Dispose()
  }
}

function Save-Jpeg {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Path,
    [long]$Quality = 92
  )

  $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object MimeType -eq 'image/jpeg' |
    Select-Object -First 1
  $parameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
  $parameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new(
    [System.Drawing.Imaging.Encoder]::Quality,
    $Quality
  )
  try {
    $Bitmap.Save($Path, $encoder, $parameters)
  } finally {
    $parameters.Dispose()
  }
}

function New-FeatureGraphic {
  $source = [System.Drawing.Image]::FromFile($featureSourcePath)
  $canvas = [System.Drawing.Bitmap]::new(1024, 500)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    Draw-CoverImage -Graphics $graphics -Image $source -Target ([System.Drawing.RectangleF]::new(0, 0, 1024, 500))

    Draw-Wordmark -Graphics $graphics -X 58 -Y 46 -Size 47

    $headingFont = [System.Drawing.Font]::new('Malgun Gothic', 35, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $bodyFont = [System.Drawing.Font]::new('Malgun Gothic', 18, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $pillFont = [System.Drawing.Font]::new('Arial', 12, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $inkBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(17, 17, 17))
    $mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(92, 92, 101))
    $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $pillBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(17, 17, 17))
    $pinkBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 45, 111))
    $pillPath = New-RoundedRectanglePath -X 58 -Y 395 -Width 287 -Height 40 -Radius 20
    try {
      $graphics.DrawString('새로운 언어,', $headingFont, $inkBrush, 58, 173)
      $graphics.DrawString('새로운 친구', $headingFont, $pinkBrush, 58, 219)
      $graphics.DrawString('전 세계 친구와 가볍게 시작해요', $bodyFont, $mutedBrush, 61, 292)
      $graphics.FillPath($pillBrush, $pillPath)
      $graphics.DrawString('GLOBAL FRIENDS · LANGUAGE EXCHANGE', $pillFont, $whiteBrush, 74, 406)
    } finally {
      $pillPath.Dispose()
      $pinkBrush.Dispose()
      $pillBrush.Dispose()
      $whiteBrush.Dispose()
      $mutedBrush.Dispose()
      $inkBrush.Dispose()
      $pillFont.Dispose()
      $bodyFont.Dispose()
      $headingFont.Dispose()
    }

    Save-Jpeg -Bitmap $canvas -Path $featureOutputPath
  } finally {
    $graphics.Dispose()
    $canvas.Dispose()
    $source.Dispose()
  }
}

function New-WelcomeScreenshot {
  $source = [System.Drawing.Image]::FromFile($welcomeSourcePath)
  $canvas = [System.Drawing.Bitmap]::new(1080, 1920)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  try {
    $graphics.Clear([System.Drawing.Color]::FromArgb(248, 247, 245))
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    Draw-CoverImage -Graphics $graphics -Image $source -Target ([System.Drawing.RectangleF]::new(0, 0, 1080, 1120))

    Draw-Wordmark -Graphics $graphics -X 58 -Y 46 -Size 48

    $sheetPath = New-RoundedRectanglePath -X 0 -Y 970 -Width 1080 -Height 1010 -Radius 58
    $sheetBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(250, 255, 255, 255))
    $graphics.FillPath($sheetBrush, $sheetPath)
    $sheetBrush.Dispose()
    $sheetPath.Dispose()

    $handleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(222, 222, 227))
    $handlePath = New-RoundedRectanglePath -X 450 -Y 1014 -Width 180 -Height 14 -Radius 7
    $graphics.FillPath($handleBrush, $handlePath)
    $handlePath.Dispose()
    $handleBrush.Dispose()

    $eyebrowFont = [System.Drawing.Font]::new('Arial', 23, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $headingFont = [System.Drawing.Font]::new('Malgun Gothic', 54, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $bodyFont = [System.Drawing.Font]::new('Malgun Gothic', 26, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $benefitFont = [System.Drawing.Font]::new('Malgun Gothic', 24, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $buttonFont = [System.Drawing.Font]::new('Malgun Gothic', 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $captionFont = [System.Drawing.Font]::new('Malgun Gothic', 20, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $pinkBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 45, 111))
    $inkBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(17, 17, 17))
    $mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(106, 106, 116))
    $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $benefitBackground = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(245, 245, 247))
    $buttonBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 45, 111))
    $benefitPath = New-RoundedRectanglePath -X 58 -Y 1468 -Width 964 -Height 96 -Radius 48
    $buttonPath = New-RoundedRectanglePath -X 58 -Y 1612 -Width 964 -Height 112 -Radius 36
    try {
      $graphics.DrawString('GLOBAL FRIENDS', $eyebrowFont, $pinkBrush, 60, 1095)
      $graphics.DrawString("언어가 달라도`n친구가 될 수 있어요", $headingFont, $inkBrush, 56, 1140)
      $graphics.DrawString('전 세계의 새로운 친구와 가볍게 대화를 시작해요.', $bodyFont, $mutedBrush, 61, 1340)
      $graphics.FillPath($benefitBackground, $benefitPath)
      $graphics.DrawString('♥', $benefitFont, $pinkBrush, 92, 1494)
      $graphics.DrawString('서로 Pick하면 대화 시작', $benefitFont, $inkBrush, 132, 1493)
      $graphics.DrawString('✓', $benefitFont, $inkBrush, 626, 1494)
      $graphics.DrawString('안전한 프로필', $benefitFont, $inkBrush, 670, 1493)
      $graphics.FillPath($buttonBrush, $buttonPath)
      $buttonText = 'WICHU 시작하기'
      $buttonSize = $graphics.MeasureString($buttonText, $buttonFont)
      $graphics.DrawString($buttonText, $buttonFont, $whiteBrush, (1080 - $buttonSize.Width) / 2, 1645)
      $caption = '만 18세 이상만 이용할 수 있어요'
      $captionSize = $graphics.MeasureString($caption, $captionFont)
      $graphics.DrawString($caption, $captionFont, $mutedBrush, (1080 - $captionSize.Width) / 2, 1782)
    } finally {
      $buttonPath.Dispose()
      $benefitPath.Dispose()
      $buttonBrush.Dispose()
      $benefitBackground.Dispose()
      $whiteBrush.Dispose()
      $mutedBrush.Dispose()
      $inkBrush.Dispose()
      $pinkBrush.Dispose()
      $captionFont.Dispose()
      $buttonFont.Dispose()
      $benefitFont.Dispose()
      $bodyFont.Dispose()
      $headingFont.Dispose()
      $eyebrowFont.Dispose()
    }

    Save-Jpeg -Bitmap $canvas -Path $welcomeOutputPath
  } finally {
    $graphics.Dispose()
    $canvas.Dispose()
    $source.Dispose()
  }
}

if (-not (Test-Path -LiteralPath $featureSourcePath)) {
  throw "Missing generated source image: $featureSourcePath"
}
if (-not (Test-Path -LiteralPath $welcomeSourcePath)) {
  throw "Missing welcome source image: $welcomeSourcePath"
}

New-FeatureGraphic
New-WelcomeScreenshot

Write-Output $featureOutputPath
Write-Output $welcomeOutputPath
