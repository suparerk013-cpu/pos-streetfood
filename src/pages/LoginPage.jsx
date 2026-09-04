import { useState } from 'react'
import { authErrorMessage, login } from '../lib/auth'

function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (busy || !username.trim() || !password) return
    setBusy(true)
    setError(null)
    try {
      await login(username, password)
      // onAuthStateChanged ใน App จะพาไปหน้าขายเอง ไม่ต้องทำอะไรต่อ
    } catch (err) {
      setError(authErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-600 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 pt-7 pb-5 text-center">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-3xl mx-auto mb-3 shadow-lg shadow-orange-200">
            🍢
          </div>
          <h1 className="font-extrabold text-gray-800 text-2xl leading-tight">เข้าสู่ระบบ</h1>
          <p className="text-sm text-gray-400 mt-1">ระบบขายหน้าร้าน หมึกย่าง หอยแมลงภู่</p>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-3">
          <div>
            <label htmlFor="login-username" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              ชื่อผู้ใช้
            </label>
            <input
              id="login-username"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              autoComplete="username"
              placeholder="เช่น pos"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 font-medium text-lg focus:outline-none focus:border-orange-400 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              รหัสผ่าน
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 font-medium text-lg focus:outline-none focus:border-orange-400 focus:bg-white transition-all"
            />
          </div>

          {error && (
            <p className="rounded-2xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600 text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !username.trim() || !password}
            className="mt-1 w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 disabled:from-gray-300 disabled:to-gray-300 text-white font-extrabold text-lg shadow-lg shadow-orange-200 active:scale-95 transition-all"
          >
            {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default LoginPage
