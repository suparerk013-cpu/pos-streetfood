# ===== POS Street Food — Setup Script =====
# รันใน PowerShell (คลิกขวา -> Run with PowerShell)

Write-Host "=== POS Street Food Setup ===" -ForegroundColor Cyan

# 1. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ยังไม่มี Node.js — ดาวน์โหลดที่ https://nodejs.org แล้วรัน script นี้ใหม่" -ForegroundColor Red
    pause; exit
}
Write-Host "✓ Node.js $(node --version)" -ForegroundColor Green

# 2. Check Git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ยังไม่มี Git — ดาวน์โหลดที่ https://git-scm.com แล้วรัน script นี้ใหม่" -ForegroundColor Red
    pause; exit
}
Write-Host "✓ Git $(git --version)" -ForegroundColor Green

# 3. Clone repo
$dest = "$env:USERPROFILE\Desktop\pos-streetfood"
if (Test-Path $dest) {
    Write-Host "📁 พบโฟลเดอร์แล้ว — ข้าม clone" -ForegroundColor Yellow
} else {
    Write-Host "📥 Cloning repo..." -ForegroundColor Cyan
    git clone https://github.com/suparerk013-cpu/pos-streetfood.git $dest
}

Set-Location $dest

# 4. Create .env
$envFile = ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "🔑 สร้างไฟล์ .env..." -ForegroundColor Cyan
    @"
VITE_FIREBASE_API_KEY=AIzaSyCq-P--BznGDUinVUooaQVsfm5ncb563oA
VITE_FIREBASE_AUTH_DOMAIN=pospos-b87bf.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=pospos-b87bf
VITE_FIREBASE_STORAGE_BUCKET=pospos-b87bf.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=511381998077
VITE_FIREBASE_APP_ID=1:511381998077:web:b6450173b17d5ffc9e7194
VITE_FIREBASE_MEASUREMENT_ID=G-M72VDVNJPR
"@ | Out-File -Encoding utf8 $envFile
    Write-Host "✓ สร้าง .env เรียบร้อย" -ForegroundColor Green
} else {
    Write-Host "✓ มี .env แล้ว" -ForegroundColor Green
}

# 5. npm install
Write-Host "📦 ติดตั้ง dependencies..." -ForegroundColor Cyan
npm install

# 6. Firebase CLI
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "🔥 ติดตั้ง Firebase CLI..." -ForegroundColor Cyan
    npm install -g firebase-tools
} else {
    Write-Host "✓ Firebase CLI พร้อมแล้ว" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Setup เสร็จแล้ว!" -ForegroundColor Green
Write-Host ""
Write-Host "คำสั่งที่ใช้บ่อย:" -ForegroundColor Cyan
Write-Host "  npm run dev          — รัน dev server"
Write-Host "  npm run build        — build สำหรับ deploy"
Write-Host "  firebase login       — login Firebase (ครั้งแรก)"
Write-Host "  firebase deploy --only hosting  — deploy ขึ้น web"
Write-Host ""
Write-Host "โฟลเดอร์: $dest" -ForegroundColor Yellow
pause
