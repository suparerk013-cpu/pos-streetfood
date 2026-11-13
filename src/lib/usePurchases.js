import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { logSnapshotError } from './snapshotError'
import { useEffect, useState } from 'react'
import { db } from './firebase'

const PAGE_SIZE = 1000

/** การซื้อวัตถุดิบในช่วงวันที่ที่เลือก — date เก็บเป็นสตริง 'YYYY-MM-DD' จึงเทียบตรง ๆ ได้ */
export function usePurchasesInRange(from, to) {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to) return undefined
    const q = query(
      collection(db, 'purchases'),
      where('date', '>=', from),
      where('date', '<=', to),
      orderBy('date', 'desc'),
      limit(PAGE_SIZE),
    )
    return onSnapshot(q, (snap) => {
      setPurchases(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, logSnapshotError('การซื้อวัตถุดิบ'))
  }, [from, to])

  return { purchases, loading }
}

export function useExpensesInRange(from, to) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to) return undefined
    const q = query(
      collection(db, 'expenses'),
      where('date', '>=', from),
      where('date', '<=', to),
      orderBy('date', 'desc'),
      limit(PAGE_SIZE),
    )
    return onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, logSnapshotError('ค่าใช้จ่าย'))
  }, [from, to])

  return { expenses, loading }
}

/** รอบจ่ายเงินทั้งหมด — ไม่กี่รายการต่อเดือน ดึงมาทั้งหมดได้ */
export function usePayouts() {
  const [payouts, setPayouts] = useState([])

  useEffect(() => {
    const q = query(collection(db, 'payouts'), orderBy('to', 'desc'), limit(200))
    return onSnapshot(q, (snap) => {
      setPayouts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    }, logSnapshotError('รอบจ่ายเงินจากแอป'))
  }, [])

  return payouts
}

const RECENT_FOR_NAMES = 300

/**
 * รายจ่ายล่าสุดไม่จำกัดช่วงวันที่ เอาไว้จำชื่อที่เคยจดให้กดเลือก
 *
 * ช่วงวันที่ที่กำลังดูอยู่ไม่พอ — ต้นเดือนรายการว่าง ชื่อที่จดมาทั้งเดือนก่อนจะหายหมด
 * ฟังเฉพาะตอนเปิดหน้าต่างบันทึก และจำกัด 300 รายการ (ราวเดือนครึ่งของร้านที่จดวันละ 5–6 อย่าง)
 */
export function useRecentEntries(enabled = true) {
  const [expenses, setExpenses] = useState([])
  const [purchases, setPurchases] = useState([])

  useEffect(() => {
    if (!enabled) return undefined
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'), limit(RECENT_FOR_NAMES))
    return onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    }, logSnapshotError('รายจ่ายล่าสุด'))
  }, [enabled])

  useEffect(() => {
    if (!enabled) return undefined
    const q = query(collection(db, 'purchases'), orderBy('date', 'desc'), limit(RECENT_FOR_NAMES))
    return onSnapshot(q, (snap) => {
      setPurchases(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    }, logSnapshotError('รายการซื้อเก่า'))
  }, [enabled])

  return { expenses, purchases }
}
