/**
 * เงินที่ควรมีในลิ้นชักตอนปิดกะ = ทอนตั้งต้น + ยอดขายเงินสดสุทธิ
 *
 * payment.amount เก็บยอดที่ตัดจริง (หลังทอนแล้ว) ส่วนเงินที่รับมาอยู่ใน cash_received
 * เงินที่เพิ่มในลิ้นชักจึงเท่ากับผลรวมของ amount พอดี — โค้ดเดิมลบ changeTotal ออกอีกรอบ
 * ทำให้ยอดต่ำกว่าจริงเสมอเท่ากับเงินทอนทั้งกะ นับเงินถูกต้องก็ยังขึ้น "เงินเกิน" ทุกครั้ง
 */
export function calcCashExpected(openingFloat, cashSales) {
  return (openingFloat ?? 0) + (cashSales ?? 0)
}

/**
 * ผลต่างเงินสดของกะที่ปิดไปแล้ว คิดใหม่จากตัวเลขดิบทุกครั้ง
 * ไม่ใช้ summary.cash_diff ที่เก็บไว้ เพราะกะที่ปิดก่อนแก้บั๊กเก็บค่าที่ผิดไว้
 */
export function shiftCashDiff(shift) {
  const summary = shift?.summary ?? {}
  const expected = calcCashExpected(summary.opening_float, summary.cash_sales)
  const counted = shift?.cash_counted ?? summary.cash_counted ?? 0
  return { expected, counted, diff: counted - expected }
}
