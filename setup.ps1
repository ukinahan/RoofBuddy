# ─────────────────────────────────────────────────────────────────────────────
#  Roof Inspector — One-Time Setup Script
#  Run this once in the RoofInspector folder:  .\setup.ps1
# ─────────────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  Roof Inspector  —  Setup" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check Node.js ────────────────────────────────────────────────────
Write-Host "[1/5] Checking Node.js..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  Node.js not found. Download and install it from https://nodejs.org/" -ForegroundColor Red
    Write-Host "  Install Node 20 LTS, then re-run this script." -ForegroundColor Red
    exit 1
}
$nodeVersion = node --version
Write-Host "  Found Node.js $nodeVersion" -ForegroundColor Green

# ── Step 2: Check / install Expo CLI ────────────────────────────────────────
Write-Host "[2/5] Checking Expo CLI..." -ForegroundColor Yellow
if (-not (Get-Command expo -ErrorAction SilentlyContinue)) {
    Write-Host "  Installing Expo CLI globally..." -ForegroundColor White
    npm install -g expo-cli
}
Write-Host "  Expo CLI ready." -ForegroundColor Green

# ── Step 3: Install project dependencies ────────────────────────────────────
Write-Host "[3/5] Installing npm packages (this may take a minute)..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  npm install failed. Check your internet connection and try again." -ForegroundColor Red
    exit 1
}
Write-Host "  Packages installed." -ForegroundColor Green

# ── Step 4: Remind about OpenAI key ─────────────────────────────────────────
Write-Host ""
Write-Host "[4/5] IMPORTANT — OpenAI API Key" -ForegroundColor Magenta
Write-Host "  To use AI damage detection you need a free/paid OpenAI account." -ForegroundColor White
Write-Host "  1. Go to: https://platform.openai.com/api-keys" -ForegroundColor White
Write-Host "  2. Create a new secret key." -ForegroundColor White
Write-Host "  3. Open:  src\services\ai.ts" -ForegroundColor White
Write-Host "  4. Replace  sk-REPLACE_WITH_YOUR_OPENAI_API_KEY  with your real key." -ForegroundColor White
Write-Host ""

# ── Step 5: Remind about Expo Go ────────────────────────────────────────────
Write-Host "[5/5] Running the app" -ForegroundColor Yellow
Write-Host "  To test on your iPhone or iPad:" -ForegroundColor White
Write-Host "  1. Install the FREE 'Expo Go' app from the App Store on your device." -ForegroundColor White
Write-Host "  2. Make sure your phone and this computer are on the SAME Wi-Fi." -ForegroundColor White
Write-Host "  3. Run:  npm start" -ForegroundColor White
Write-Host "  4. Scan the QR code with the Camera app (iOS 16+) or Expo Go." -ForegroundColor White
Write-Host ""
Write-Host "  To build a standalone .ipa for App Store distribution:" -ForegroundColor White
Write-Host "  Run:  npx eas build --platform ios" -ForegroundColor White
Write-Host "  (Requires an Expo account — free at https://expo.dev)" -ForegroundColor White
Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  Setup complete! Run:  npm start" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
