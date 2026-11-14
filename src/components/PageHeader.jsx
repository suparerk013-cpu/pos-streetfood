/**
 * หัวหน้าสีส้มแบบเดียวกันทุกหน้า — บรรทัดเล็กบอกสถานะ บรรทัดใหญ่บอกว่าอยู่หน้าไหน
 * ปุ่มทางขวา (เพิ่ม, Excel, ...) ส่งมาทาง `right`
 */
function PageHeader({ title, small, right, children }) {
  return (
    <header className="shrink-0 bg-orange-500 text-white">
      <div className="px-4 pt-3 pb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {small && <p className="text-xs text-white/75 font-semibold truncate">{small}</p>}
          <h1 className="text-xl font-black leading-tight truncate">{title}</h1>
        </div>
        {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
      </div>
      {children}
    </header>
  )
}

/** ปุ่มขาวบนหัวส้ม เช่น "+ เพิ่ม" */
export function HeaderButton({ children, className = '', ...props }) {
  return (
    <button type="button" {...props}
      className={`min-h-[44px] px-4 rounded-xl bg-white text-orange-600 font-black text-sm flex items-center gap-1.5 shadow-sm active:bg-orange-50 disabled:opacity-50 ${className}`}>
      {children}
    </button>
  )
}

export default PageHeader
