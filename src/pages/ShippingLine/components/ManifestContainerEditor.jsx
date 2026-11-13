import { useCallback, useEffect, useRef, useState } from 'react'
import ManifestContainerNumber from './ManifestContainerNumber'

const fieldClass = 'w-full rounded-lg border border-chalk bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200'
export default function ManifestContainerEditor({ initialValue, editing, onSave, onClose, onRegister }) {
  const [container, setContainer] = useState(() => ({ ...initialValue }))
  const [error, setError] = useState('')
  const dialog = useRef(null)
  useEffect(() => {
    const previousFocus = document.activeElement
    dialog.current?.querySelector('input')?.focus()
    return () => { queueMicrotask(() => { if (previousFocus?.isConnected) previousFocus.focus() }) }
  }, [])
  const update = patch => setContainer(c => ({ ...c, ...patch }))
  const resolveContainer = useCallback((_index, number, identity, status, lookupError = '') => {
    setContainer(c => c.containerNumber === number ? { ...c, isoType: identity?.isoType || '', isoSizeType: identity?.isoSizeType || '',
      containerId: identity?.containerId, isReefer: Boolean(identity?.isReefer), lookupStatus: status, lookupError } : c)
  }, [])
  const submit = event => {
    event.preventDefault()
    if (container.lookupStatus !== 'found' || !container.containerId) {
      setError('Vui lòng chọn container đã tồn tại trong hệ thống và chờ tra cứu hoàn tất.'); return
    }
    if (!container.commodity.trim() || !container.sealNumber.trim()) { setError('Nhập số niêm chì và mô tả hàng hóa.'); return }
    try { onSave({ ...container, sealNumber: container.sealNumber.trim(), commodity: container.commodity.trim() }) }
    catch (e) { setError(e.message) }
  }
  const onKeyDown = event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return }
    if (event.key !== 'Tab') return
    const items = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')]
    const first = items[0], last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3 md:p-6">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="manifest-container-editor-title" onKeyDown={onKeyDown} className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-chalk p-5">
        <div><h3 id="manifest-container-editor-title" className="text-lg font-bold">{editing ? 'Chỉnh sửa container' : 'Thêm container vào vận đơn'}</h3><p className="mt-1 text-xs text-slate">Loại ISO được lấy từ container đã khai báo trong hệ thống.</p></div>
        <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 hover:bg-fog" aria-label="Đóng thông tin container">✕</button>
      </header>
      <form onSubmit={submit} className="flex min-h-0 flex-col">
        <div className="space-y-4 overflow-y-auto p-5">
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <ManifestContainerNumber container={container} index={0} fieldClass={fieldClass} onResult={resolveContainer}
              onRegister={number => { try { onRegister(number, container) } catch (e) { setError(e.message) } }} onChange={number => update({ containerNumber: number, isoType: '', isoSizeType: '', isReefer: false, containerId: undefined, lookupStatus: 'idle', lookupError: '' })} />
            <label className="text-sm">Loại ISO<input readOnly className={`${fieldClass} bg-fog`} value={[container.isoSizeType, container.isoType].filter(Boolean).join(' · ')} placeholder="Tự lấy từ container đã khai báo" /></label>
            <label className="text-sm">Số niêm chì *<input required maxLength={50} className={fieldClass} value={container.sealNumber} onChange={e => update({ sealNumber: e.target.value })} /></label>
            <label className="text-sm">Trọng lượng (kg) *<input required type="number" min="0.01" max="36000" step="0.01" className={fieldClass} value={container.grossWeightKg} onChange={e => update({ grossWeightKg: e.target.value })} /></label>
          </div>
          <label className="block text-sm">Mô tả hàng hóa *<textarea required maxLength={2000} rows={3} className={fieldClass} value={container.commodity} onChange={e => update({ commodity: e.target.value })} placeholder="Tên hàng, quy cách đóng gói, số kiện…" /></label>
          {container.lookupStatus === 'found' && container.isReefer && <p className="text-sm text-sky-700">❄ Container lạnh</p>}
        </div>
        <footer className="flex justify-end gap-3 border-t border-chalk p-5">
          <button type="button" onClick={onClose} className="rounded-lg border border-chalk px-4 py-2 text-sm font-semibold hover:bg-fog">Hủy</button>
          <button type="submit" className="rounded-lg bg-signal-orange px-4 py-2 text-sm font-bold text-white">{editing ? 'Lưu thay đổi' : 'Thêm vào vận đơn'}</button>
        </footer>
      </form>
    </section>
  </div>
}
