/**
 * เจ้าของร้านไม่ต้องรู้ว่า GP กี่ % ภาษีกี่ % ค่า CP กี่ % — กรอกแค่ยอดขายในระบบ
 * กับเงินที่เข้าบัญชีจริง แล้วคำนวณอัตราที่ถูกหักจริงย้อนกลับ
 */
export function actualRate(grossAmount, netReceived) {
  if (!(grossAmount > 0)) return 0
  return Math.max(0, Math.min(1, 1 - netReceived / grossAmount))
}

/**
 * อัตราที่ใช้คิดกำไรของแต่ละแอป — ใช้ค่าจากรอบจ่ายเงินล่าสุดถ้ามี
 * ไม่มีก็ตกไปใช้ค่าที่ตั้งไว้ในหน้าตั้งค่า
 */
export function effectiveRates(payouts, fallbackFor) {
  const latest = new Map()
  payouts.forEach((p) => {
    const current = latest.get(p.platform)
    if (!current || String(p.to) > String(current.to)) latest.set(p.platform, p)
  })
  return (platform) => latest.get(platform)?.actual_rate ?? fallbackFor(platform)
}
