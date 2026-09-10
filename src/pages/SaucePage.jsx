import { BarChart3, ClipboardList, Plus, ShoppingCart, Trash2, UtensilsCrossed } from 'lucide-react'
import { useMemo, useState } from 'react'
import IngredientModal from '../components/IngredientModal'
import SauceBatchModal from '../components/SauceBatchModal'
import SauceHistory from '../components/SauceHistory'
import SauceReport from '../components/SauceReport'
import SauceShopping from '../components/SauceShopping'
import SauceStockAlert from '../components/SauceStockAlert'
import { useAppData } from '../lib/appDataContext'
import {
  SAUCE_ICONS,
  addSauce,
  deleteSauce,
  deleteSauceBatch,
  recordSauceBatch,
  saucePerServe,
  updateSauce,
} from '../lib/sauces'
import { sauceStock } from '../lib/sauceStock'

/**
 * น้ำจิ้มที่ทำเอง
 *
 * แยกจากหน้าค่าใช้จ่ายเพราะเป็นคนละเรื่องกัน — หน้านั้นคือของที่ซื้อมาแล้วจ่ายเงินไป
 * ส่วนหน้านี้คือการเอาของที่ซื้อมาแปรรูป ต้นทุนไม่ได้เกิดตอนซื้อ แต่เกิดตอนกวนหม้อ
 *
 * แบ่งเป็นสี่แท็บย่อยเพราะสี่เรื่องนี้ใช้คนละเวลา — ตั้งสูตรทำครั้งเดียว
 * ซื้อของทำตอนไปตลาด บันทึกหม้อทำตอนกวน ส่วนรายงานเปิดดูตอนสิ้นเดือน
 */

const TABS = [
  { key: 'recipes', label: 'สูตร', icon: UtensilsCrossed },
  { key: 'shopping', label: 'ซื้อของ', icon: ShoppingCart },
  { key: 'history', label: 'ประวัติ', icon: ClipboardList },
  { key: 'report', label: 'รายงาน', icon: BarChart3 },
]

function SaucePage({ initialTab }) {
  const { sauces, activeProducts, ingredientById } = useAppData()
  const [tab, setTab] = useState(() => (TABS.some((t) => t.key === initialTab) ? initialTab : 'recipes'))
  const [batchModal, setBatchModal] = useState(null)
  const [editIngredient, setEditIngredient] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const stockBySauce = useMemo(() => {
    const map = new Map()
    sauces.forEach((s) => map.set(s.id, sauceStock(s, ingredientById)))
    return map
  }, [sauces, ingredientById])

  const outCount = useMemo(
    () => [...stockBySauce.values()].filter((s) => s.level === 'out').length,
    [stockBySauce],
  )

  /** สินค้าที่ผูกกับสูตรไหน ใช้บอกว่าถ้าแก้สูตรนี้แล้วต้นทุนของอะไรจะขยับตาม */
  const productsBySauce = useMemo(() => {
    const map = new Map()
    activeProducts.forEach((p) => {
      if (!p.sauce_id) return
      map.set(p.sauce_id, [...(map.get(p.sauce_id) ?? []), p])
    })
    return map
  }, [activeProducts])

  const run = async (fn, message) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch {
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = () =>
    run(
      () =>
        addSauce({
          name: 'น้ำจิ้มสูตรใหม่',
          icon: SAUCE_ICONS[sauces.length % SAUCE_ICONS.length],
          unit: 'กก.',
          sortOrder: sauces.length,
        }),
      'เพิ่มสูตรไม่สำเร็จ ลองใหม่อีกครั้ง',
    )

  const handleEdit = (sauceId, updates) =>
    run(() => updateSauce(sauceId, updates), 'แก้สูตรไม่สำเร็จ ลองใหม่อีกครั้ง')

  /** กดที่ไอคอนเพื่อวนเปลี่ยน จะได้แยกสูตรออกจากกันด้วยตาตอนกดเร็ว ๆ หน้าร้าน */
  const cycleIcon = (sauce) => {
    const at = SAUCE_ICONS.indexOf(sauce.icon ?? SAUCE_ICONS[0])
    handleEdit(sauce.id, { icon: SAUCE_ICONS[(at + 1) % SAUCE_ICONS.length] })
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

  const openIngredient = (ingredientId) => {
    const ingredient = ingredientById.get(ingredientId)
    if (ingredient) setEditIngredient(ingredient)
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
          {tab === 'recipes' && (
            <button type="button" onClick={handleAdd} disabled={busy}
              className="shrink-0 min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold flex items-center gap-1 disabled:opacity-40">
              <Plus size={16} /> เพิ่มสูตร
            </button>
          )}
        </div>

        <div className="flex gap-1.5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" onClick={() => setTab(key)}
              className={`flex-1 min-h-[46px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors relative ${
                tab === key ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-500'
              }`}>
              <Icon size={16} />
              <span className="text-[10px] font-bold">{label}</span>
              {key === 'shopping' && outCount > 0 && (
                <span className="absolute top-1 right-2 min-w-[15px] h-3.5 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {outCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        {tab === 'recipes' && (
          <>
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
              const stock = stockBySauce.get(sauce.id)

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

                  {stock && (
                    <div className="mx-4 mb-3">
                      <SauceStockAlert stock={stock} onEditIngredient={openIngredient} />
                    </div>
                  )}

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

                  <button type="button" onClick={() => setBatchModal(sauce)}
                    className="w-full min-h-[48px] border-t border-gray-100 text-sm font-bold text-orange-600">
                    🍲 บันทึกทำ{sauce.name}
                  </button>
                </div>
              )
            })}

            <p className="text-[11px] text-gray-400 px-1">
              ปิดระบบน้ำจิ้มทั้งหมดได้ที่หน้าตั้งค่า ต้นทุนสินค้าจะกลับไปเป็นสูตรเดิมทันที
            </p>
          </>
        )}

        {tab === 'shopping' && <SauceShopping onEditIngredient={openIngredient} />}

        {tab === 'history' && (
          <SauceHistory
            sauces={sauces}
            busy={busy}
            onDeleteBatch={(batch) =>
              run(() => deleteSauceBatch(batch.sauce_id, batch.id), 'ลบหม้อนี้ไม่สำเร็จ ลองใหม่อีกครั้ง')
            }
          />
        )}

        {tab === 'report' && <SauceReport sauces={sauces} />}
      </div>

      {batchModal && (
        <SauceBatchModal sauce={batchModal} onClose={() => setBatchModal(null)} onSubmit={handleRecord} />
      )}

      {editIngredient && (
        <IngredientModal ingredient={editIngredient} onClose={() => setEditIngredient(null)} />
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
              <button type="button"
                onClick={() =>
                  run(async () => {
                    await deleteSauce(confirmDelete.id)
                    setConfirmDelete(null)
                  }, 'ลบสูตรไม่สำเร็จ ลองใหม่อีกครั้ง')
                }
                disabled={busy}
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
