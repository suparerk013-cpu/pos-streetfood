# ===== POS Street Food — Deploy Script =====
# รันใน PowerShell ที่โฟลเดอร์โปรเจกต์:  .\deploy.ps1
#
# ทำตามลำดับที่ปลอดภัย: ดึงโค้ด -> ทดสอบ -> build -> deploy เว็บ
# -> ให้คุณยืนยันว่าล็อกอินได้ -> ค่อย deploy security rules
#
# ลำดับนี้สำคัญมาก ถ้า deploy rules ก่อนที่เว็บจะเป็นโค้ดใหม่
# ร้านจะใช้งานไม่ได้ทันที เพราะโค้ดเก่าไม่มีระบบล็อกอิน

$ErrorActionPreference = "Stop"
$BRANCH = "claude/pos-streetfood-analysis-lcawl7"

# ให้คอนโซลแสดงภาษาไทยได้ถูกต้อง
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Step($n, $text) {
    Write-Host ""
    Write-Host "=== ขั้นที่ $n : $text ===" -ForegroundColor Cyan
}
function Fail($text) {
    Write-Host ""
    Write-Host "หยุด: $text" -ForegroundColor Red
    Write-Host "ส่งข้อความนี้ให้ Claude ดูได้เลย" -ForegroundColor Yellow
    exit 1
}

Step 1 "ดึงโค้ดใหม่"
git fetch origin
if ($LASTEXITCODE -ne 0) { Fail "git fetch ไม่สำเร็จ ตรวจอินเทอร์เน็ต" }
git checkout $BRANCH
git pull origin $BRANCH
if ($LASTEXITCODE -ne 0) { Fail "git pull ไม่สำเร็จ" }
Write-Host ("OK: อยู่ที่ " + (git log --oneline -1)) -ForegroundColor Green

Step 2 "ติดตั้ง dependencies"
npm install
if ($LASTEXITCODE -ne 0) { Fail "npm install ไม่สำเร็จ" }

Step 3 "ตรวจไฟล์ .env"
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Fail "ยังไม่มี .env — สร้างจากเทมเพลตให้แล้ว เปิดใส่ค่าจริงจาก Firebase Console ก่อน แล้วรันสคริปต์นี้ใหม่"
}
$envText = Get-Content ".env" -Raw
if ($envText -notmatch "VITE_FIREBASE_API_KEY=\S") {
    Fail ".env มีอยู่แต่ยังไม่ได้ใส่ค่า — เปิดแก้แล้วรันใหม่"
}
Write-Host "OK: .env พร้อมแล้ว" -ForegroundColor Green

Step 4 "รันเทสต์"
npm test
if ($LASTEXITCODE -ne 0) { Fail "เทสต์ไม่ผ่าน อย่า deploy" }

Step 5 "build"
npm run build
if ($LASTEXITCODE -ne 0) { Fail "build ไม่สำเร็จ" }

Step 6 "deploy เว็บ (ยังไม่แตะ security rules)"
firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) { Fail "deploy hosting ไม่สำเร็จ — ถ้าขึ้นว่ายังไม่ได้ login ให้รัน firebase login ก่อน" }

Write-Host ""
Write-Host "----------------------------------------------------" -ForegroundColor Yellow
Write-Host " เปิดเว็บแล้วทดสอบก่อนไปต่อ" -ForegroundColor Yellow
Write-Host "   https://pospos-b87bf.web.app" -ForegroundColor White
Write-Host ""
Write-Host " ต้องเจอ 2 อย่างนี้:" -ForegroundColor Yellow
Write-Host "   1. หน้าล็อกอินสีส้ม (ไม่ใช่เข้าหน้าขายเลย)"
Write-Host "   2. ล็อกอินด้วยอีเมล/รหัสที่ตั้งใน Firebase แล้วเข้าได้"
Write-Host "----------------------------------------------------" -ForegroundColor Yellow
Write-Host ""
$answer = Read-Host "ล็อกอินเข้าได้แล้วใช่ไหม? พิมพ์ y แล้ว Enter (พิมพ์อย่างอื่นเพื่อหยุด)"
if ($answer -ne "y") {
    Write-Host ""
    Write-Host "หยุดไว้ก่อน ยังไม่ได้ deploy rules — ฐานข้อมูลยังเปิดอยู่เหมือนเดิม" -ForegroundColor Yellow
    Write-Host "แก้ปัญหาล็อกอินให้ได้ก่อนแล้วรันสคริปต์นี้ใหม่" -ForegroundColor Yellow
    exit 0
}

Step 7 "deploy security rules (ปิดช่องโหว่ฐานข้อมูล)"
firebase deploy --only firestore:rules,firestore:indexes
if ($LASTEXITCODE -ne 0) { Fail "deploy rules ไม่สำเร็จ — เว็บยังใช้ได้ปกติ แต่ฐานข้อมูลยังไม่ถูกปิด" }

Write-Host ""
Write-Host "เสร็จเรียบร้อย" -ForegroundColor Green
Write-Host ""
Write-Host "เหลืออีก 3 อย่างที่ต้องทำในแอป (ไม่รีบ ทำเมื่อไหร่ก็ได้):" -ForegroundColor Cyan
Write-Host "  1. ค่าใช้จ่าย > วัตถุดิบ > บันทึกซื้อปลาหมึกสด 1 ครั้ง (ให้ระบบรู้ราคา)"
Write-Host "  2. คลังสินค้า > แก้ไขปลาหมึกย่าง > ผูกวัตถุดิบ + ตั้งราคาเดลิเวอรี + โปร 10 แถม 1"
Write-Host "  3. คลังสินค้า > แท็บเซ็ต > สร้าง 'ปลาหมึก 8 ไม้' แล้วกดใช้ราคาแนะนำ"
Write-Host ""
Write-Host "ส่วนค่า GP / ค่าแพ็ค / ของประกอบ ระบบใช้ค่าเริ่มต้นให้แล้ว (30% / 5 / 1.5)" -ForegroundColor Gray
Write-Host "ไปแก้ทีหลังได้ที่หน้าตั้งค่า" -ForegroundColor Gray
Write-Host ""
pause
