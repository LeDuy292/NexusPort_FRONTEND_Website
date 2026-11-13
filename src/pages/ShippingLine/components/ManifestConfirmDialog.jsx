import { useEffect, useId, useRef } from 'react'

export default function ManifestConfirmDialog({ title, message, confirmLabel, cancelLabel = 'Quay lại', danger = false, onConfirm, onCancel }) {
  const dialog = useRef(null)
  const cancelButton = useRef(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    element.showModal()
    cancelButton.current?.focus()
    return () => {
      if (element.open) element.close()
      queueMicrotask(() => { if (previousFocus?.isConnected) previousFocus.focus() })
    }
  }, [])

  return <dialog ref={dialog} role="alertdialog" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onCancel() }}
    className="fixed m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-chalk bg-white p-0 text-carbon shadow-2xl backdrop:bg-black/50">
    <div className="flex items-start gap-3 p-5 md:p-6">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-signal-orange'}`}>
        <span className="material-symbols-outlined" aria-hidden="true">{danger ? 'delete' : 'warning'}</span>
      </div>
      <div className="min-w-0"><h3 id={titleId} className="font-heading text-lg font-bold">{title}</h3><p id={descriptionId} className="mt-2 break-words text-sm leading-relaxed text-slate">{message}</p></div>
      <button type="button" onClick={onCancel} className="ml-auto rounded-lg px-2 py-1 text-slate hover:bg-fog" aria-label="Đóng xác nhận">✕</button>
    </div>
    <footer className="flex flex-wrap justify-end gap-2 border-t border-chalk bg-fog/40 px-5 py-4 md:px-6">
      <button ref={cancelButton} type="button" onClick={onCancel} className="rounded-xl border border-chalk bg-white px-4 py-2 text-sm font-semibold hover:bg-fog focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">{cancelLabel}</button>
      <button type="button" onClick={onConfirm} className={`rounded-xl px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-signal-orange hover:opacity-90'}`}>{confirmLabel}</button>
    </footer>
  </dialog>
}
