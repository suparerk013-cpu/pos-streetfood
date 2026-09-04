import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const app = initializeApp(firebaseConfig)

// persistentLocalCache แทน enableIndexedDbPersistence ที่ถูก deprecate แล้ว
// multipleTabManager ทำให้เปิดหลายแท็บพร้อมกันได้ ไม่เหมือนของเดิมที่ได้แค่แท็บเดียว
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

export const auth = getAuth(app)

// ให้ล็อกอินค้างไว้แม้ปิดแอป — คนหน้าร้านไม่ควรต้องล็อกอินใหม่ทุกเช้า
setPersistence(auth, browserLocalPersistence).catch(() => {
  // เบราว์เซอร์ที่ปิด storage จะใช้ session persistence แทนโดยอัตโนมัติ
})
