import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { actualRate } from './payoutMath'

export { actualRate, effectiveRates } from './payoutMath'

/** บันทึกรอบจ่ายเงินจากแพลตฟอร์ม แล้วให้ระบบหาอัตราที่ถูกหักจริง */
export async function recordPayout({ platform, from, to, grossAmount, netReceived, note }) {
  await addDoc(collection(db, 'payouts'), {
    platform,
    from,
    to,
    gross_amount: grossAmount,
    net_received: netReceived,
    actual_rate: actualRate(grossAmount, netReceived),
    note: note?.trim() || null,
    created_at: serverTimestamp(),
  })
}

export function deletePayout(payoutId) {
  return deleteDoc(doc(db, 'payouts', payoutId))
}
