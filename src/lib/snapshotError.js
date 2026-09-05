/**
 * ตัวจัดการ error ของ onSnapshot
 *
 * ถ้าไม่ใส่ callback ตัวนี้ เวลาอ่านข้อมูลไม่ได้ (เช่น security rules ไม่อนุญาต)
 * Firestore จะเงียบ — หน้าจอค้างอยู่ที่ "กำลังโหลด..." หรือโชว์ข้อมูลว่างเปล่า
 * โดยไม่มีอะไรบอกว่าเกิดอะไรขึ้น หาสาเหตุไม่ได้เลย
 */
export function logSnapshotError(where, onError) {
  return (err) => {
    const code = err?.code ?? 'unknown'
    console.error(`[POS] อ่านข้อมูล "${where}" ไม่ได้ (${code}):`, err?.message ?? err)
    onError?.(describeSnapshotError(where, err))
  }
}

export function describeSnapshotError(where, err) {
  if (err?.code === 'permission-denied') {
    return `ไม่มีสิทธิ์อ่านข้อมูล "${where}" — ถ้าเพิ่งอัปเดตระบบ ให้ลองออกจากระบบแล้วเข้าใหม่`
  }
  if (err?.code === 'failed-precondition') {
    return `ฐานข้อมูลยังไม่มี index สำหรับ "${where}" — แจ้ง Claude ให้เพิ่มให้`
  }
  return `อ่านข้อมูล "${where}" ไม่ได้: ${err?.message ?? err}`
}
