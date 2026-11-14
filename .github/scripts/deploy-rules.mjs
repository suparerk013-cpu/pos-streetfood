/**
 * ส่งกฎฐานข้อมูล (firestore.rules) ขึ้น Firebase ตรง ๆ ผ่าน Firebase Rules API
 *
 * ทำไมไม่ใช้ `firebase deploy --only firestore:rules`:
 * คำสั่งนั้นเช็คก่อนว่าเปิดบริการ Firestore ไว้หรือยังผ่าน Service Usage API
 * ซึ่งต้องใช้สิทธิ์อีกชุดที่กุญแจของร้านไม่มี ทั้งที่บริการเปิดอยู่แล้วแน่นอน (แอปใช้งานอยู่ทุกวัน)
 * สคริปต์นี้ข้ามขั้นนั้น ใช้แค่สิทธิ์จัดการกฎ (มีใน Firebase Admin)
 *
 * ไม่ใช้ไลบรารีเพิ่ม — เซ็นกุญแจด้วย crypto ของ Node เอง
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=sa.json node .github/scripts/deploy-rules.mjs pospos-b87bf firestore.rules
 */
import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const [project, rulesFile = 'firestore.rules'] = process.argv.slice(2)
if (!project) throw new Error('ต้องระบุ project id')

const key = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))
const b64 = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url')

async function accessToken() {
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform',
    aud: key.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url')
  const res = await fetch(key.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`ขอสิทธิ์ไม่สำเร็จ (${res.status}): ${body.error_description || body.error}`)
  return body.access_token
}

async function call(token, method, path, body) {
  const res = await fetch(`https://firebaserules.googleapis.com/v1/${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}: ${data.error?.message ?? res.statusText}`)
    err.status = res.status
    throw err
  }
  return data
}

const token = await accessToken()
const source = readFileSync(rulesFile, 'utf8')

// 1) สร้างชุดกฎใหม่ — Firebase ตรวจไวยากรณ์ให้ตรงนี้ ผิดตรงไหนจะไม่ถูกปล่อยใช้
const ruleset = await call(token, 'POST', `projects/${project}/rulesets`, {
  source: { files: [{ name: 'firestore.rules', content: source }] },
})
console.log(`สร้างชุดกฎแล้ว: ${ruleset.name}`)

// 2) ชี้ฐานข้อมูลหลักไปใช้ชุดกฎใหม่
const releaseName = `projects/${project}/releases/cloud.firestore`
const release = { name: releaseName, rulesetName: ruleset.name }
try {
  await call(token, 'PATCH', releaseName, { release })
} catch (err) {
  // โปรเจกต์ที่ไม่เคยปล่อยกฎมาก่อนยังไม่มี release ให้แก้ ต้องสร้างใหม่
  if (err.status !== 404) throw err
  await call(token, 'POST', `projects/${project}/releases`, release)
}
console.log('ใช้กฎฐานข้อมูลใหม่แล้ว ✔')
