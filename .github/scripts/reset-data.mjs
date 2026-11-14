/**
 * ลบข้อมูลการขายทั้งหมดเพื่อเริ่มใหม่ (สั่งครั้งเดียวผ่าน GitHub Actions)
 *
 *   node reset-data.mjs backup <โฟลเดอร์>   สำรองทุก collection เป็น JSON ก่อน
 *   node reset-data.mjs wipe                 ลบ + ตั้งสต็อกสินค้าเป็น 0
 *
 * เก็บไว้: สินค้า/เซ็ต (products) และตั้งค่าร้าน (settings)
 * ใช้กุญแจ service account (GOOGLE_APPLICATION_CREDENTIALS) ซึ่งข้ามกฎฐานข้อมูล
 * กฎที่ห้ามลบบิลมีไว้กันคนในแอป ไม่ได้กันเจ้าของร้านที่สั่งลบเองแบบนี้
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const PROJECT = 'pospos-b87bf'
const WIPE = [
  'orders', 'shifts', 'stock_logs', 'expenses', 'purchases',
  'delivery_imports', 'payouts', 'counters',
  // ของระบบเดิมที่ถอดออกแล้ว
  'ingredients', 'sauces', 'sauce_batches',
]
const KEEP = ['products', 'settings']

initializeApp({ credential: applicationDefault(), projectId: PROJECT })
const db = getFirestore()

const plain = (v) => {
  if (v instanceof Timestamp) return { __time: v.toDate().toISOString() }
  if (Array.isArray(v)) return v.map(plain)
  if (v && typeof v === 'object' && v.constructor === Object) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]))
  }
  return v
}

const [mode, dir] = process.argv.slice(2)

if (mode === 'backup') {
  mkdirSync(dir, { recursive: true })
  for (const name of [...WIPE, ...KEEP]) {
    const snap = await db.collection(name).get()
    const rows = snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }))
    writeFileSync(join(dir, `${name}.json`), JSON.stringify(rows, null, 1))
    console.log(`สำรอง ${name}: ${rows.length} รายการ`)
  }
} else if (mode === 'wipe') {
  for (const name of WIPE) {
    const before = (await db.collection(name).count().get()).data().count
    await db.recursiveDelete(db.collection(name))
    console.log(`ลบ ${name}: ${before} รายการ`)
  }
  const products = await db.collection('products').get()
  const writer = db.bulkWriter()
  let reset = 0
  products.docs.forEach((d) => {
    if (d.data().is_bundle) return // เซ็ตไม่มีสต็อกของตัวเอง
    writer.update(d.ref, { stock_qty: 0 })
    reset += 1
  })
  await writer.close()
  console.log(`ตั้งสต็อกเป็น 0: ${reset} สินค้า (เก็บสินค้า ราคา โปร เซ็ต และตั้งค่าร้านไว้)`)
} else {
  throw new Error('ใช้: backup <dir> | wipe')
}
