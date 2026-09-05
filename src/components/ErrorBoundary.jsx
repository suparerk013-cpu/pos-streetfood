import { Component } from 'react'

/**
 * กันจอขาว
 *
 * ถ้าคอมโพเนนต์ไหนพังกลางทาง React จะถอดทั้งแอปออกจากหน้าจอ เหลือหน้าขาวเปล่า
 * ไม่มีข้อความ กดอะไรไม่ได้ กดย้อนกลับก็ไม่ได้ — หน้าร้านขายของต่อไม่ได้เลย
 * ตัวนี้ดักไว้แล้วแสดงข้อความจริงที่พัง พร้อมปุ่มกู้คืนให้กดเองได้หน้าร้าน
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[POS] หน้าจอพัง:', error, info?.componentStack)
  }

  handleReset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  /** ล้าง service worker + แคชทั้งหมด แล้วโหลดใหม่ — แก้เคสไฟล์เวอร์ชันเก่าค้างในเครื่อง */
  handleHardReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
      if (window.caches) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch (err) {
      console.error('[POS] ล้างแคชไม่สำเร็จ:', err)
    }
    window.location.reload(true)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const detail = `${error.name ?? 'Error'}: ${error.message ?? String(error)}`

    return (
      <div className="h-full w-full overflow-y-auto bg-orange-50 p-5 flex items-start justify-center">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-6 mt-6">
          <p className="text-4xl mb-3">😵</p>
          <h1 className="text-xl font-bold text-gray-800 mb-1.5">หน้านี้มีปัญหา</h1>
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">
            ลองกดปุ่มด้านล่างตามลำดับ ถ้ายังไม่หาย ให้ถ่ายรูปข้อความสีแดงข้างล่างส่งให้ Claude
          </p>

          <div className="flex flex-col gap-2 mb-5">
            <button type="button" onClick={this.handleReset}
              className="w-full min-h-[52px] rounded-2xl bg-orange-500 text-white font-bold active:bg-orange-600">
              ลองใหม่อีกครั้ง
            </button>
            <button type="button" onClick={this.handleHardReload}
              className="w-full min-h-[52px] rounded-2xl border-2 border-orange-300 text-orange-600 font-bold active:bg-orange-50">
              ล้างแคชแล้วโหลดใหม่
            </button>
          </div>

          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">ข้อความจากระบบ</p>
          <pre className="text-[11px] leading-relaxed text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 whitespace-pre-wrap break-words">
            {detail}
          </pre>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
