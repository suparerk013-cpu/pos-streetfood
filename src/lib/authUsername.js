/**
 * Firebase Auth บังคับให้ผู้ใช้เป็นรูปแบบอีเมล แต่คนหน้าร้านไม่ควรต้องพิมพ์อีเมลยาว ๆ
 * ทุกครั้งที่เปิดร้าน จึงให้พิมพ์แค่ชื่อสั้น ๆ แล้วเติมโดเมนนี้ให้เบื้องหลัง
 *
 * พิมพ์ "pos"  →  ส่งไป Firebase เป็น "pos@pos.local"
 * ถ้าพิมพ์อีเมลเต็มมาก็ใช้ได้ตามเดิม บัญชีเก่าจึงยังล็อกอินได้
 *
 * แยกจาก auth.js เพื่อให้เทสต์ import ได้โดยไม่ต้องต่อ Firebase
 */
export const LOGIN_DOMAIN = 'pos.local'

export function toEmail(username) {
  const trimmed = String(username ?? '').trim().toLowerCase()
  if (!trimmed) return ''
  return trimmed.includes('@') ? trimmed : `${trimmed}@${LOGIN_DOMAIN}`
}

/** ชื่อผู้ใช้ที่เอาไว้โชว์ในหน้าตั้งค่า — ตัดโดเมนหลังบ้านออก */
export function displayName(email) {
  if (!email) return '-'
  return email.endsWith(`@${LOGIN_DOMAIN}`) ? email.slice(0, -(LOGIN_DOMAIN.length + 1)) : email
}
