import { initializeApp } from 'firebase/app'
import { enableIndexedDbPersistence, getFirestore } from 'firebase/firestore'

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
export const db = getFirestore(app)

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore offline persistence: เปิดหลายแท็บพร้อมกัน ใช้ persistence ได้แค่แท็บเดียว')
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore offline persistence: เบราว์เซอร์นี้ไม่รองรับ')
  }
})
