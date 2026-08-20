function ModalBackdrop({ onClose, canClose = true, maxWidthClass = 'max-w-md', children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => canClose && onClose?.()}
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl flex flex-col`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export default ModalBackdrop
