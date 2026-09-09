# ===== POS Street Food - Deploy อัตโนมัติ =====
# วิธีใช้ที่ง่ายที่สุด: ดับเบิลคลิกไฟล์ deploy.cmd (ไม่ต้องเปิด PowerShell เอง)
# หรือรันในเทอร์มินัลก็ได้:  .\deploy.ps1
#
# สคริปต์นี้ทำให้ครบทุกอย่างเอง: ดึงโค้ด -> ติดตั้ง -> เทสต์ -> build
# -> deploy เว็บ -> deploy security rules
#
# ใช้ npm.cmd / firebase.cmd แทน npm / firebase เพราะบน Windows
# คำสั่งเปล่า ๆ จะไปเจอไฟล์ .ps1 ซึ่งโดน execution policy บล็อก

$ErrorActionPreference = "Stop"
$BRANCH = "claude/pos-streetfood-analysis-lcawl7"
$SITE = "https://pospos-b87bf.web.app"

# ให้คอนโซลแสดงภาษาไทยได้ถูกต้อง
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# ทำงานที่โฟลเดอร์ของสคริปต์เสมอ ไม่ว่าจะถูกเรียกจากที่ไหน
Set-Location -LiteralPath $PSScriptRoot

function Step($n, $text) {
    Write-Host ""
    Write-Host "=== ขั้นที่ $n : $text ===" -ForegroundColor Cyan
}
function Ok($text) { Write-Host "OK: $text" -ForegroundColor Green }

# อัปโหลดขึ้น Firebase เจอเน็ตสะดุดแล้วล้มบ่อย ("Failed to make request")
# ของที่ build ไว้ยังอยู่ครบ ลองใหม่ได้เลย ไม่ต้องเริ่มจากศูนย์
function DeployWithRetry($firebase, $target, $label) {
    $delays = @(5, 15, 30)
    for ($i = 0; $i -lt 4; $i++) {
        & $firebase deploy --only $target
        if ($LASTEXITCODE -eq 0) { return $true }
        if ($i -lt 3) {
            $wait = $delays[$i]
            Write-Host ""
            Write-Host "$label ไม่ผ่าน (น่าจะเน็ตสะดุด) - รอ $wait วินาทีแล้วลองใหม่ ครั้งที่ $($i + 2) จาก 4" -ForegroundColor Yellow
            Start-Sleep -Seconds $wait
        }
    }
    return $false
}
function Fail($text) {
    Write-Host ""
    Write-Host "หยุด: $text" -ForegroundColor Red
    Write-Host "ถ่ายรูปหน้าจอนี้ส่งให้ Claude ได้เลย" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

# หา .cmd ก่อนเสมอ ถ้าไม่มีค่อยใช้ชื่อเปล่า
function Exe($name) {
    $cmd = Get-Command "$name.cmd" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $plain = Get-Command $name -ErrorAction SilentlyContinue
    if ($plain) { return $plain.Source }
    return $null
}

Step 0 "ตรวจเครื่องมือที่ต้องใช้"

$NPM = Exe "npm"
if (-not $NPM) { Fail "ยังไม่ได้ติดตั้ง Node.js - โหลดจาก https://nodejs.org แล้วเปิดหน้าต่างนี้ใหม่" }
Ok "Node.js พร้อม"

$FIREBASE = Exe "firebase"
if (-not $FIREBASE) {
    Write-Host "ยังไม่มี Firebase CLI - กำลังติดตั้งให้ (ใช้เวลาสัก 1-2 นาที)" -ForegroundColor Yellow
    & $NPM install -g firebase-tools
    if ($LASTEXITCODE -ne 0) { Fail "ติดตั้ง firebase-tools ไม่สำเร็จ" }
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
    $FIREBASE = Exe "firebase"
    if (-not $FIREBASE) { Fail "ติดตั้งแล้วแต่ยังเรียก firebase ไม่ได้ - ปิดหน้าต่างนี้แล้วดับเบิลคลิก deploy.cmd ใหม่" }
}
Ok "Firebase CLI พร้อม"

# เช็คว่าล็อกอิน Google ไว้หรือยัง ถ้ายังก็เปิดเบราว์เซอร์ให้ล็อกอินเลย
# ปิด ErrorActionPreference ชั่วคราว เพราะ 2>&1 ทำให้ข้อความ stderr ของโปรแกรมนอก
# กลายเป็น error record แล้วสคริปต์จะหยุดทั้งที่ยังไม่มีอะไรพัง
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$loginInfo = (& $FIREBASE "login:list" 2>&1 | Out-String)
$loginExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap

if ($loginExit -ne 0 -or $loginInfo -match "No authorized accounts") {
    Write-Host ""
    Write-Host "ยังไม่ได้ล็อกอิน Firebase - เดี๋ยวเบราว์เซอร์จะเปิดขึ้นมา" -ForegroundColor Yellow
    Write-Host "ให้เลือกบัญชี Google ที่เป็นเจ้าของโปรเจกต์ pospos-b87bf" -ForegroundColor Yellow
    Write-Host ""
    & $FIREBASE login
    if ($LASTEXITCODE -ne 0) { Fail "ล็อกอิน Firebase ไม่สำเร็จ" }
}
Ok "ล็อกอิน Firebase แล้ว"

Step 1 "ดึงโค้ดใหม่"
git fetch origin $BRANCH
if ($LASTEXITCODE -ne 0) { Fail "git fetch ไม่สำเร็จ ตรวจอินเทอร์เน็ต" }
git checkout $BRANCH
git pull origin $BRANCH
if ($LASTEXITCODE -ne 0) {
    # ส่วนใหญ่เกิดจากไฟล์ในเครื่องถูกแก้ทับ (npm install แก้ package-lock.json)
    # git เลยไม่กล้าดึงของใหม่มาทับ บอกให้เห็นไปเลยว่าไฟล์ไหน จะได้ไม่ต้องเดา
    Write-Host ""
    Write-Host "ไฟล์ในเครื่องที่ถูกแก้ไว้:" -ForegroundColor Yellow
    git status --short
    Write-Host ""
    Write-Host "แก้ด้วยการโยนการแก้ไขในเครื่องทิ้ง แล้วเอาของจาก GitHub มาแทน:" -ForegroundColor Yellow
    Write-Host "    git reset --hard origin/$BRANCH" -ForegroundColor White
    Write-Host ""
    Write-Host "ไฟล์ .env ไม่หาย git ไม่แตะต้องอยู่แล้ว" -ForegroundColor Gray
    Fail "git pull ไม่สำเร็จ"
}
Ok ("อยู่ที่ " + (git log --oneline -1))

Step 2 "ติดตั้ง dependencies"
& $NPM install
if ($LASTEXITCODE -ne 0) { Fail "npm install ไม่สำเร็จ" }

Step 3 "ตรวจไฟล์ .env"
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Fail "ยังไม่มี .env - สร้างจากเทมเพลตให้แล้ว เปิดใส่ค่าจริงจาก Firebase Console ก่อน แล้วรันใหม่"
}
if ((Get-Content ".env" -Raw) -notmatch "VITE_FIREBASE_API_KEY=\S") {
    Fail ".env มีอยู่แต่ยังไม่ได้ใส่ค่า - เปิดแก้แล้วรันใหม่"
}
Ok ".env พร้อมแล้ว"

Step 4 "รันเทสต์"
& $NPM test
if ($LASTEXITCODE -ne 0) { Fail "เทสต์ไม่ผ่าน ไม่ deploy ของที่พัง" }

Step 5 "build"
& $NPM run build
if ($LASTEXITCODE -ne 0) { Fail "build ไม่สำเร็จ" }

Step 6 "deploy เว็บ"
if (-not (DeployWithRetry $FIREBASE "hosting" "deploy เว็บ")) {
    Write-Host ""
    Write-Host "ลองครบ 4 ครั้งแล้วยังไม่ผ่าน ตรวจอินเทอร์เน็ตแล้วรัน deploy.cmd ใหม่" -ForegroundColor Yellow
    Write-Host "ถ้ายังไม่หาย ลองล็อกอิน Firebase ใหม่:  firebase login --reauth" -ForegroundColor White
    Fail "deploy hosting ไม่สำเร็จ"
}
Ok "เว็บอัปเดตแล้ว"

Step 7 "deploy security rules (ปิดช่องโหว่ฐานข้อมูล)"
if (-not (DeployWithRetry $FIREBASE "firestore:rules,firestore:indexes" "deploy rules")) {
    Fail "deploy rules ไม่สำเร็จ - เว็บใช้ได้ปกติ แต่ฐานข้อมูลยังไม่ถูกปิด"
}
Ok "ฐานข้อมูลถูกปิดแล้ว เฉพาะคนที่ล็อกอินเท่านั้นที่เข้าถึงได้"

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " เสร็จเรียบร้อย" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host " เปิดเว็บ: $SITE" -ForegroundColor White
Write-Host " กด Ctrl + Shift + R หนึ่งครั้ง เพื่อล้างแคชเวอร์ชันเก่า" -ForegroundColor Yellow
Write-Host ""
Write-Host " หน้าเดลิเวอรีจะว่างจนกว่าจะสร้างเซ็ต:" -ForegroundColor Cyan
Write-Host "   คลังสินค้า > แท็บเซ็ต > + สร้างเซ็ต"
Write-Host "   เช่น 'ปลาหมึก 8 ไม้' = ปลาหมึกย่าง x 8 ราคา 120 บาท"
Write-Host ""
Write-Host " ถ้าอยากให้ระบบคิดต้นทุนเองแม่น ๆ:" -ForegroundColor Cyan
Write-Host "   1. ค่าใช้จ่าย > วัตถุดิบ > บันทึกซื้อปลาหมึกสด 1 ครั้ง"
Write-Host "   2. คลังสินค้า > แก้ไขปลาหมึกย่าง > ผูกวัตถุดิบ (60 บาท ได้ 20 ไม้)"
Write-Host ""
pause
