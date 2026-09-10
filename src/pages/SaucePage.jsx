import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import SauceBatchModal from '../components/SauceBatchModal'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useAppData } from '../lib/appDataContext'
import { formatDate } from '../lib/dates'
import { db } from '../lib/firebase'
import {
  SAUCE_ICONS,
  addSauce,
  deleteSauce,
  deleteSauceBatch,
  recordSauceBatch,
  saucePerServe,
  updateSauce,
} from '../lib/sauces'
import { logSnapshotError } from '../lib/snapshotError'

/**
 * น้ำจิ้มที่ทำเอง
 *
 * แยกจากหน้าค่าใช้จ่ายเพราะเป็นคนละเรื่องกัน — หน้านั้นคือของที่ซื้อมาแล้วจ่ายเงินไป
 * ส่วนหน้านี้คือการเอาของที่ซื้อมาแปรรูป ต้นทุนไม่ได้เกิดตอนซื้อ แต่เกิดตอนกวนหม้อ
 *
 * มีได้หลายสูตร (หมึกย่างกับซีฟู้ดใช้คนละสูตร) แต่ละสูตรผูกกับสินค้าคนละกลุ่ม
 */
function SaucePage() {
  const { sauces, activeProducts, ingredientById } = useAppData()
  const [batches, setBatches] = useState([])
  const [batchModal, setBatchModal] = useState(null)
  const [historyFor, setHistoryFor] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'sauce_batches'), orderBy('created_at', 'desc'))
    return onSnapshot(q, (snap) => {
      setBatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    }, logSnapshotError('ประวัติการทำน้ำจิ้ม', setError))
  }, [])

  /** สินค้าที่ผูกกับสูตรไหน ใช้บอกว่าถ้าแก้สูตรนี้แล้วต้นทุนของอะไรจะขยับตาม */
  const productsBySauce = useMemo(() => {
    const map = new Map()
    activeProducts.forEach((p) => {
      if (!p.sauce_id) return
      map.set(p.sauce_id, [...(map.get(p.sauce_id) ?? []), p])
    })
    return map
  }, [activeProducts])

  const batchesBySauce = useMemo(() => {
    const map = new Map()
    batches.forEach((b) => {
      map.set(b.sauce_id, [...(map.get(b.sauce_id) ?? []), b])
    })
    return map
  }, [batches])

  const handleAdd = async () => {
    setBusy(true)
    setError(null)
    try {
      await addSauce({
        name: 'น้ำจิ้มสูตรใหม่',
        icon: SAUCE_ICONS[sauces.length % SAUCE_ICONS.length],
        unit: 'กก.',
        sortOrder: sauces.length,
      })
    } catch {
      setError('เพิ่มสูตรไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  const handleRecord = async (payload) => {
    await recordSauceBatch({
      sauceId: batchModal.id,
      sauceName: batchModal.name,
      ingredientById,
      ...payload,
    })
    setBatchModal(null)
  }

  const handleDeleteSauce = async (sauce) => {
    setBusy(true)
    setError(null)
    try {
      await deleteSauce(sauce.id)
      setConfirmDelete(null)
    } catch {
      setError('ลบสูตรไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  const handleEdit = async (sauceId, updates) => {
    setError(null)
    try {
      await updateSauce(sauceId, updates)
    } catch {
      setError('แก้สูตรไม่สำเร็จ ลองใหม่อีกครั้ง')
    }
  }

  /** กดที่ไอคอนเพื่อวนเปลี่ยน จะได้แยกสูตรออกจากกันด้วยตาตอนกดเร็ว ๆ หน้าร้าน */
  const cycleIcon = (sauce) => {
    const at = SAUCE_ICONS.indexOf(sauce.icon ?? SAUCE_ICONS[0])
    handleEdit(sauce.id, { icon: SAUCE_ICONS[(at + 1) % SAUCE_ICONS.length] })
  }

  const handleDeleteBatch = async (batch) => {
    setBusy(true)
    setError(null)
    try {
      await deleteSauceBatch(batch.sauce_id, batch.id)
    } catch {
      setError('ลบหม้อนี้ไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto p-4 pb-24 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-black text-gray-800">น้ำจิ้มที่ทำเอง</h1>
            <p className="text-xs text-gray-500">
              บันทึกทุกครั้งที่กวนหม้อใหม่ ต้นทุนต่อไม้จะขยับตามของที่ใส่จริงวันนั้น
            </p>
          </div>
          <button type="button" onClick={handleAdd} disabled={busy}
            className="shrink-0 min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold flex items-center gap-1 disabled:opacity-40">
            <Plus size={16} /> เพิ่มสูตร
          </button>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        {sauces.length === 0 && (
          <div className="rounded-2xl bg-white border-2 border-dashed border-gray-200 p-8 text-center">
            <p className="text-3xl mb-2">🍲</p>
            <p className="text-sm font-bold text-gray-600">ยังไม่มีสูตรน้ำจิ้ม</p>
            <p className="text-xs text-gray-400 mt-1">
              กด &quot;เพิ่มสูตร&quot; แล้วบันทึกหม้อแรก ระบบจะรู้ต้นทุนน้ำจิ้มต่อไม้ให้เอง
            </p>
          </div>
        )}

        {sauces.map((sauce) => {
          const perServe = saucePerServe(sauce)
          const linked = productsBySauce.get(sauce.id) ?? []
          const history = batchesBySauce.get(sauce.id) ?? []
          const showHistory = historyFor === sauce.id

          return (
            <div key={sauce.id} className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                <button type="button" onClick={() => cycleIcon(sauce)}
                  className="text-3xl leading-none shrink-0 w-10 h-10 rounded-xl hover:bg-gray-50"
                  aria-label="เปลี่ยนไอคอน">{sauce.icon ?? '🍲'}</button>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    defaultValue={sauce.name}
                    onBlur={(e) => {
                      const next = e.target.value.trim()
                      if (next && next !== sauce.name) handleEdit(sauce.id, { name: next })
                    }}
                    className="w-full font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-orange-400 focus:outline-none"
                    aria-label="ชื่อสูตร"
                  />
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {linked.length > 0
                      ? `ใช้กับ: ${linked.map((p) => p.name).join(', ')}`
                      : 'ยังไม่ได้ผูกกับสินค้า — ไปเลือกสูตรนี้ในหน้าแก้ไขสินค้า'}
                  </p>
                </div>
                <button type="button" onClick={() => setConfirmDelete(sauce)} disabled={busy}
                  className="w-9 h-9 shrink-0 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center disabled:opacity-40"
                  aria-label={`ลบ${sauce.name}`}>
                  <Trash2 size={16} />
                </button>
              </div>

              {sauce.last_batch ? (
                <div className="mx-4 mb-3 rounded-xl bg-orange-50 border border-orange-200 px-3 py-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-gray-500">ต้นทุนหม้อล่าสุด</p>
                    <p className="text-sm font-bold text-gray-800">{Number(sauce.last_batch.total_cost ?? 0).toFixed(2)} ฿</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">ได้ {sauce.last_batch.yield_qty} {sauce.unit ?? 'กก.'}</p>
                    <p className="text-sm font-bold text-gray-800 leading-tight">
                      {Number(sauce.last_batch.cost_per_yield ?? 0).toFixed(2)}
                      <span className="text-[10px] font-medium text-gray-500"> ฿/{sauce.unit ?? 'กก.'}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">ใช้ได้ {sauce.last_batch.serves} ชิ้น</p>
                    <p className="text-sm font-black text-orange-600 leading-tight">
                      {perServe.toFixed(2)}
                      <span className="text-[10px] font-medium text-orange-400"> ฿/ชิ้น</span>
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mx-4 mb-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  ยังไม่เคยทำสูตรนี้ — ต้นทุนน้ำจิ้มของสินค้าที่ใช้สูตรนี้ยังเป็น 0
                </p>
              )}

              <div className="border-t border-gray-100 flex">
                <button type="button" onClick={() => setBatchModal(sauce)}
                  className="flex-1 min-h-[48px] text-sm font-bold text-orange-600">
                  🍲 บันทึกทำ{sauce.name}
                </button>
                {history.length > 0 && (
                  <button type="button" onClick={() => setHistoryFor(showHistory ? null : sauce.id)}
                    className="w-32 shrink-0 min-h-[48px] text-xs font-bold text-gray-500 border-l border-gray-100">
                    ประวัติ {history.length} หม้อ
                  </button>
                )}
              </div>

              {showHistory && (
                <ul className="border-t border-gray-100 divide-y divide-gray-100">
                  {history.map((batch) => (
                    <li key={batch.id} className="px-4 py-2 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-700">
                          {Number(batch.total_cost ?? 0).toFixed(2)} ฿ · ได้ {batch.yield_qty} {sauce.unit ?? 'กก.'} · {batch.serves} ชิ้น
                          <span className="text-orange-600"> ({Number(batch.cost_per_serve ?? 0).toFixed(2)} ฿/ชิ้น)</span>
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {formatDate(batch.created_at)}
                          {batch.note && ` · ${batch.note}`}
                        </p>
                      </div>
                      <button type="button" onClick={() => handleDeleteBatch(batch)} disabled={busy}
                        className="w-8 h-8 shrink-0 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center disabled:opacity-40"
                        aria-label="ลบหม้อนี้">
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}

        <p className="text-[11px] text-gray-400 px-1">
          ปิดระบบน้ำจิ้มทั้งหมดได้ที่หน้าตั้งค่า ต้นทุนสินค้าจะกลับไปเป็นสูตรเดิมทันที
        </p>
      </div>

      {batchModal && (
        <SauceBatchModal sauce={batchModal} onClose={() => setBatchModal(null)} onSubmit={handleRecord} />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !busy && setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold text-gray-800">ลบ{confirmDelete.name}?</h2>
            <p className="text-sm text-gray-500 mt-1">
              ลบสูตรและประวัติการทำทั้งหมด สินค้าที่ผูกไว้จะกลับไปไม่มีต้นทุนน้ำจิ้ม
              ยอดขายและบิลเก่าไม่ถูกแตะ
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} disabled={busy}
                className="flex-1 min-h-[48px] rounded-xl bg-gray-100 text-gray-600 font-bold disabled:opacity-40">
                ยกเลิก
              </button>
              <button type="button" onClick={() => handleDeleteSauce(confirmDelete)} disabled={busy}
                className="flex-1 min-h-[48px] rounded-xl bg-red-500 text-white font-bold disabled:opacity-40">
                {busy ? 'กำลังลบ...' : 'ลบสูตร'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SaucePage
