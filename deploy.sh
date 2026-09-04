#!/usr/bin/env bash
# ===== POS Street Food — Deploy Script (macOS / Linux) =====
# รัน:  bash deploy.sh
#
# ลำดับปลอดภัย: ดึงโค้ด -> ทดสอบ -> build -> deploy เว็บ -> deploy security rules
#
# ถ้า deploy rules ก่อนที่เว็บจะเป็นโค้ดใหม่ ร้านจะใช้งานไม่ได้ทันที
# เพราะโค้ดเก่าไม่มีระบบล็อกอิน

set -euo pipefail
BRANCH="claude/pos-streetfood-analysis-lcawl7"

step() { printf "\n\033[36m=== ขั้นที่ %s : %s ===\033[0m\n" "$1" "$2"; }
fail() { printf "\n\033[31mหยุด: %s\033[0m\n\033[33mส่งข้อความนี้ให้ Claude ดูได้เลย\033[0m\n" "$1"; exit 1; }

step 1 "ดึงโค้ดใหม่"
git fetch origin || fail "git fetch ไม่สำเร็จ ตรวจอินเทอร์เน็ต"
git checkout "$BRANCH"
git pull origin "$BRANCH" || fail "git pull ไม่สำเร็จ"
printf "\033[32mOK: อยู่ที่ %s\033[0m\n" "$(git log --oneline -1)"

step 2 "ติดตั้ง dependencies"
npm install || fail "npm install ไม่สำเร็จ"

step 3 "ตรวจไฟล์ .env"
if [ ! -f .env ]; then
  cp .env.example .env
  fail "ยังไม่มี .env — สร้างจากเทมเพลตให้แล้ว เปิดใส่ค่าจริงจาก Firebase Console ก่อน แล้วรันใหม่"
fi
grep -q "VITE_FIREBASE_API_KEY=." .env || fail ".env มีอยู่แต่ยังไม่ได้ใส่ค่า — เปิดแก้แล้วรันใหม่"
printf "\033[32mOK: .env พร้อมแล้ว\033[0m\n"

step 4 "รันเทสต์"
npm test || fail "เทสต์ไม่ผ่าน อย่า deploy"

step 5 "build"
npm run build || fail "build ไม่สำเร็จ"

step 6 "deploy เว็บ"
firebase deploy --only hosting || fail "deploy hosting ไม่สำเร็จ — ถ้ายังไม่ได้ login ให้รัน firebase login ก่อน"

step 7 "deploy security rules (ปิดช่องโหว่ฐานข้อมูล)"
firebase deploy --only firestore:rules,firestore:indexes \
  || fail "deploy rules ไม่สำเร็จ — เว็บยังใช้ได้ปกติ แต่ฐานข้อมูลยังไม่ถูกปิด"

cat <<'MSG'

เสร็จเรียบร้อย

เปิดเว็บแล้วกด Ctrl + Shift + R หนึ่งครั้ง เพื่อล้างแคชเวอร์ชันเก่า
  https://pospos-b87bf.web.app

หน้าเดลิเวอรีจะว่างจนกว่าจะสร้างเซ็ต:
  คลังสินค้า > แท็บเซ็ต > + สร้างเซ็ต
  เช่น 'ปลาหมึก 8 ไม้' = ปลาหมึกย่าง x 8 ราคา 120 บาท

ถ้าอยากให้ระบบคิดต้นทุนเองแม่น ๆ:
  1. ค่าใช้จ่าย > วัตถุดิบ > บันทึกซื้อปลาหมึกสด 1 ครั้ง
  2. คลังสินค้า > แก้ไขปลาหมึกย่าง > ผูกวัตถุดิบ (60 บาท ได้ 20 ไม้)

ส่วนค่า GP / ค่าแพ็ค / ของประกอบ ระบบใช้ค่าเริ่มต้นให้แล้ว (30% / 5 / 1.5)
ไปแก้ทีหลังได้ที่หน้าตั้งค่า
MSG
