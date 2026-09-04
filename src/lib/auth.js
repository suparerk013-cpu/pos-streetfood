import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { toEmail } from './authUsername'
import { auth } from './firebase'

export { displayName, LOGIN_DOMAIN, toEmail } from './authUsername'

/** ข้อความ error ของ Firebase Auth เป็นภาษาอังกฤษล้วน แปลงเป็นไทยให้คนหน้าร้านอ่านรู้เรื่อง */
const ERROR_MESSAGES = {
  'auth/invalid-email': 'ชื่อผู้ใช้มีอักขระที่ใช้ไม่ได้',
  'auth/user-disabled': 'บัญชีนี้ถูกระงับการใช้งาน',
  'auth/user-not-found': 'ไม่พบชื่อผู้ใช้นี้',
  'auth/wrong-password': 'รหัสผ่านไม่ถูกต้อง',
  'auth/invalid-credential': 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
  'auth/too-many-requests': 'ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่',
  'auth/network-request-failed': 'เชื่อมต่อไม่ได้ ตรวจสัญญาณอินเทอร์เน็ต',
}

export function authErrorMessage(error) {
  return ERROR_MESSAGES[error?.code] ?? 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง'
}

export function login(username, password) {
  return signInWithEmailAndPassword(auth, toEmail(username), password)
}

export function logout() {
  return signOut(auth)
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback)
}
