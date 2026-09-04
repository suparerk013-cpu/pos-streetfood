# POS หมึกย่าง หอยแมลงภู่

ระบบขายหน้าร้าน (POS) สำหรับร้านอาหารริมทาง ใช้งานบนมือถือหรือแท็บเล็ตหน้าร้าน
ครอบคลุมตั้งแต่คิดเงิน เปิด–ปิดกะ นับเงินลิ้นชัก คลังสินค้า บันทึกค่าวัตถุดิบ ไปจนถึงแดชบอร์ดกำไร

**React 19 · Vite 8 · Tailwind 4 · Firebase (Auth + Firestore) · PWA**

---

## เริ่มใช้งาน

```bash
npm install
cp .env.example .env      # แล้วใส่ค่าจริงจาก Firebase Console
npm run dev
```

บน Windows รัน `setup-new-pc.ps1` แทนได้ (คลิกขวา → Run with PowerShell)

### คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รัน dev server |
| `npm test` | รันยูนิตเทสต์ |
| `npm run lint` | ตรวจโค้ดด้วย oxlint |
| `npm run build` | build ไฟล์สำหรับ deploy |
| `firebase deploy` | deploy ทั้ง hosting และ security rules |

---

## ตั้งค่า Firebase ครั้งแรก

1. **เปิด Authentication** → เมธอด Email/Password → สร้างบัญชีเจ้าของร้าน 1 บัญชี
   แอปบังคับล็อกอินก่อนเข้าใช้งานทุกหน้า
2. **Deploy security rules** — ข้อนี้สำคัญที่สุด ถ้าไม่ทำ ฐานข้อมูลจะเปิดให้ใครก็ได้อ่านและลบข้อมูล

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

`firestore.rules` บังคับให้ทุก collection ต้องล็อกอินก่อนถึงจะอ่าน/เขียนได้

---

## โครงสร้างข้อมูลบน Firestore

| Collection | เก็บอะไร | ฟิลด์สำคัญ |
|---|---|---|
| `products` | สินค้าที่ขาย | `name` `price` `stock_qty` `stock_type` `unit` `modifiers` `delivery_prices` `is_active` |
| `orders` | บิลขายหน้าร้าน | `queue_no` `shift_id` `items[]` `payments[]` `total_amount` `discount` `is_voided` |
| `delivery_imports` | ยอดรวมรายวันจากแอปเดลิเวอรี | `platform` `amount` `date` `shift_id` |
| `stock_logs` | ประวัติสต็อกทุกการเคลื่อนไหว | `product_id` `type` (sale/void/restock/damage/adjustment) `qty_change` |
| `shifts` | กะการขาย | `status` `opening_float` `cash_counted` `summary{}` |
| `ingredients` | ทะเบียนวัตถุดิบที่ซื้อประจำ | `name` `unit` `category` `last_price` |
| `purchases` | ประวัติการซื้อวัตถุดิบรายครั้ง | `ingredient_id` `qty` `unit_price` `total_amount` `date` `vendor` |
| `expenses` | ค่าใช้จ่ายอื่น (น้ำ ไฟ เช่า แรง) | `category` `amount` `date` |
| `settings/store` | ข้อมูลร้าน | `shop_name` `logo_base64` `enabled_delivery_platforms` |
| `counters/queue_counter` | เลขคิว (รีเซ็ตทุกวัน) | `current_value` `day` |

### หลักการสำคัญ

- **สินค้า** (`products`) กับ **วัตถุดิบ** (`ingredients`) เป็นคนละอย่าง — สินค้าคือของที่ขาย
  (หมึกย่าง หอยนึ่ง) วัตถุดิบคือของที่ซื้อ (ปลาหมึกดิบ ผักชี มะขามเปียก) ไม่ผูกกันด้วยสูตรอาหาร
- **ยอดเดลิเวอรี** เก็บใน `delivery_imports` แยกจาก `orders` เพื่อไม่ให้จำนวนบิลและยอดเฉลี่ยต่อบิลเพี้ยน
- **หน่วยของวัตถุดิบ** ล็อกไว้ที่ตัววัตถุดิบ (ผักชีเป็น "กำ" ตลอด) เพื่อให้รวมปริมาณรายเดือนได้
- **ลบสินค้า** เป็น soft delete (`is_active: false`) เพราะบิลเก่ายังอ้าง `product_id` อยู่

---

## โครงสร้างโค้ด

```
src/
├─ App.jsx                 ประตูล็อกอิน + สลับ 7 หน้า (lazy load ยกเว้นหน้าขาย)
├─ lib/                    ตรรกะธุรกิจทั้งหมด ไม่มีการคำนวณเงินฝังใน JSX
│  ├─ orders.js              ออกบิล/ยกเลิกบิล ด้วย Firestore transaction
│  ├─ stock.js               นำเข้า/ปรับ/ของเสีย/ล้างสต็อกรายวัน
│  ├─ cart.js                ตะกร้า — ฟังก์ชันบริสุทธิ์ล้วน มีเทสต์ครอบ
│  ├─ shifts.js              สูตรเงินในลิ้นชัก มีเทสต์ครอบ
│  ├─ ingredients.js         ทะเบียนวัตถุดิบ + บันทึกการซื้อ
│  ├─ excelExport.js         สร้างไฟล์ Excel 3 ชีต (โหลด exceljs เมื่อกดปุ่ม)
│  ├─ appData.jsx            context กลาง — สินค้า/วัตถุดิบ/กะ/ตั้งค่า/สถานะเน็ต
│  ├─ useOrders.js           ดึงบิลตามช่วงวันที่หรือตามกะ (มี where + limit เสมอ)
│  └─ dates.js constants.js  ค่าคงที่และตัวช่วยวันที่ที่ใช้ร่วมกันทั้งแอป
├─ pages/                  Sales · Reports · Documents · Inventory · Shift · Expenses · Settings · Login
└─ components/             ปุ่ม modal และกราฟ (วาดเอง ไม่ใช้ไลบรารีกราฟ)
```

---

## ข้อควรรู้เวลาแก้โค้ด

- **ทุก query ต้องมี `where` + `limit`** — Firestore คิดเงินตามจำนวนเอกสารที่อ่าน
  การดึงทั้ง collection มากรองในเบราว์เซอร์จะทำให้ค่าใช้จ่ายโตไม่มีเพดาน ใช้ hook ใน `lib/useOrders.js`
  และ `lib/usePurchases.js` แทนการเขียน `onSnapshot` ใหม่ในหน้า
- **Firestore transaction ทำงานตอนออฟไลน์ไม่ได้** — การออกบิล ตัดสต็อก และปิดกะจึงต้องออนไลน์
  แอปเช็ค `online` จาก context แล้วปิดปุ่มให้ก่อน
- **ค่าคงที่ใหม่ให้ใส่ใน `lib/constants.js`** อย่าประกาศซ้ำในหน้า
- **ตรรกะที่คำนวณเงินควรอยู่ใน `lib/` และมีเทสต์** — ดูตัวอย่างที่ `lib/__tests__/`
