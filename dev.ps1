# ===== POS Street Food - รันในเครื่องตัวเอง =====
# ดับเบิลคลิก dev.cmd แล้วเปิดลิงก์ที่ขึ้นมา
#
# ต่างจาก deploy.ps1 ตรงที่ไม่ต้อง build ไม่ต้องอัปขึ้นเว็บ
# แก้โค้ดปุ๊บหน้าจอเปลี่ยนปั๊บ ใช้ลองของก่อนค่อย deploy จริง
#
# หมายเหตุ: ยังต้องต่อเน็ตอยู่ เพราะข้อมูลสินค้ากับบิลเก็บที่ Firebase
# ตัวเว็บรันในเครื่อง แต่ข้อมูลยังดึงจากอินเทอร์เน็ต

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
Set-Location -LiteralPath $PSScriptRoot

function Fail($text) {
    Write-Host ""
    Write-Host "หยุด: $text" -ForegroundColor Red
    Write-Host ""
    pause
    exit 1
}

function Exe($name) {
    $cmd = Get-Command "$name.cmd" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $plain = Get-Command $name -ErrorAction SilentlyContinue
    if ($plain) { return $plain.Source }
    return $null
}

$NPM = Exe "npm"
if (-not $NPM) { Fail "ยังไม่ได้ติดตั้ง Node.js - โหลดจาก https://nodejs.org" }

if (-not (Test-Path "node_modules")) {
    Write-Host "ติดตั้ง dependencies ครั้งแรก รอสักครู่..." -ForegroundColor Yellow
    & $NPM install
    if ($LASTEXITCODE -ne 0) { Fail "npm install ไม่สำเร็จ" }
}

if (-not (Test-Path ".env")) { Fail "ยังไม่มีไฟล์ .env - รัน deploy.cmd หนึ่งครั้งก่อน" }

# หาไอพีในวง wifi เดียวกัน เผื่ออยากเปิดบนมือถือ
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
       Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
       Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " เปิดลิงก์นี้ในเบราว์เซอร์" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "   บนคอมเครื่องนี้ :  http://localhost:5173" -ForegroundColor White
if ($ip) {
    Write-Host "   บนมือถือ (wifi เดียวกัน) :  http://${ip}:5173" -ForegroundColor White
}
Write-Host ""
Write-Host " แก้โค้ดแล้วหน้าจอเปลี่ยนเองทันที ไม่ต้อง deploy" -ForegroundColor Cyan
Write-Host " กด Ctrl + C เพื่อหยุด" -ForegroundColor Gray
Write-Host ""

# --host เพื่อให้เปิดจากมือถือในวงเดียวกันได้ด้วย
& $NPM run dev -- --host --port 5173
