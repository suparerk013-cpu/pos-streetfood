#!/usr/bin/env bash
# ===== POS Street Food — Deploy Script (macOS / Linux) =====
# รัน:  bash deploy.sh
#
# ลำดับปลอดภัย: ดึงโค้ด -> ทดสอบ -> build -> deploy เว็บ
# -> ยืนยันว่าล็อกอินได้ -> ค่อย deploy security rules
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

step 6 "deploy เว็บ (ยังไม่แตะ security rules)"
firebase deploy --only hosting || fail "deploy hosting ไม่สำเร็จ — ถ้ายังไม่ได้ login ให้รัน firebase login ก่อน"

cat <<'MSG'

----------------------------------------------------
 เปิดเว็บแล้วทดสอบก่อนไปต่อ
   https://pospos-b87bf.web.app

 ต้องเจอ 2 อย่างนี้:
   1. หน้าล็อกอินสีส้ม (ไม่ใช่เข้าหน้าขายเลย)
   2. ล็อกอินด้วยอีเมล/รหัสที่ตั้งใน Firebase แล้วเข้าได้
----------------------------------------------------

MSG
read -r -p "ล็อกอินเข้าได้แล้วใช่ไหม? พิมพ์ y แล้ว Enter (พิมพ์อย่างอื่นเพื่อหยุด): " answer
if [ "$answer" != "y" ]; then
  printf "\n\033[33mหยุดไว้ก่อน ยังไม่ได้ deploy rules — ฐานข้อมูลยังเปิดอยู่เหมือนเดิม\nแก้ปัญหาล็อกอินให้ได้ก่อนแล้วรันใหม่\033[0m\n"
  exit 0
fi

step 7 "deploy security rules (ปิดช่องโหว่ฐานข้อมูล)"
firebase deploy --only firestore:rules,firestore:indexes \
  || fail "deploy rules ไม่สำเร็จ — เว็บยังใช้ได้ปกติ แต่ฐานข้อมูลยังไม่ถูกปิด"

cat <<'MSG'

เสร็จเรียบร้อย

เหลืออีก 3 อย่างที่ต้องทำในแอป (ไม่รีบ ทำเมื่อไหร่ก็ได้):
  1. ค่าใช้จ่าย > วัตถุดิบ > บันทึกซื้อปลาหมึกสด 1 ครั้ง (ให้ระบบรู้ราคา)
  2. คลังสินค้า > แก้ไขปลาหมึกย่าง > ผูกวัตถุดิบ + ตั้งราคาเดลิเวอรี + โปร 10 แถม 1
  3. คลังสินค้า > แท็บเซ็ต > สร้าง 'ปลาหมึก 8 ไม้' แล้วกดใช้ราคาแนะนำ

ส่วนค่า GP / ค่าแพ็ค / ของประกอบ ระบบใช้ค่าเริ่มต้นให้แล้ว (30% / 5 / 1.5)
ไปแก้ทีหลังได้ที่หน้าตั้งค่า
MSG
