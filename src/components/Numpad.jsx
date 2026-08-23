const DIGIT_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
]

const MAX_DIGITS = 7

function Numpad({ value, onChangeValue, quickAmounts = [], unit = '฿' }) {
  const appendDigit = (digit) => {
    if (value.length >= MAX_DIGITS) return
    onChangeValue(value === '0' ? digit : value + digit)
  }

  const handleClear = () => onChangeValue('0')
  const handleBackspace = () => onChangeValue(value.length > 1 ? value.slice(0, -1) : '0')

  return (
    <div>
      <div className="mb-3 rounded-xl bg-orange-50 px-4 py-4 text-center">
        <span className="text-4xl font-bold text-gray-800 tabular-nums">
          {Number(value).toLocaleString()}
        </span>
        <span className="ml-1 text-xl font-semibold text-gray-500">{unit}</span>
      </div>

      {quickAmounts.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {quickAmounts.map((quick) => (
            <button
              key={quick.label}
              type="button"
              onClick={() => onChangeValue(String(quick.value))}
              className="min-h-[52px] flex-1 rounded-full bg-orange-100 px-2 text-sm font-semibold text-orange-700 active:scale-95 transition-transform"
            >
              {quick.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        {DIGIT_ROWS.flat().map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => appendDigit(digit)}
            className="min-h-[68px] rounded-xl bg-white border border-gray-200 text-3xl font-semibold text-gray-800 active:scale-95 active:bg-gray-50 transition-transform"
          >
            {digit}
          </button>
        ))}

        <button
          type="button"
          onClick={handleClear}
          className="min-h-[68px] rounded-xl bg-gray-200 text-lg font-semibold text-gray-700 active:scale-95 transition-transform"
        >
          ล้าง
        </button>
        <button
          type="button"
          onClick={() => appendDigit('0')}
          className="min-h-[68px] rounded-xl bg-white border border-gray-200 text-3xl font-semibold text-gray-800 active:scale-95 active:bg-gray-50 transition-transform"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          className="min-h-[68px] rounded-xl bg-gray-200 text-2xl font-semibold text-gray-700 active:scale-95 transition-transform"
          aria-label="ลบตัวเลข"
        >
          ⌫
        </button>
      </div>
    </div>
  )
}

export default Numpad
