import { useEffect, useState } from 'react'
import { shippingLineApi } from '../api/shippingLineApi'

export default function ManifestContainerNumber({ container, index, onChange, onResult, onRegister, fieldClass }) {
  const number = container.containerNumber.trim().toUpperCase().replace(/[\s-]+/g, '')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (number.length !== 11) return
    let cancelled = false
    onResult(index, number, null, 'checking')
    const timer = setTimeout(async () => {
      try {
        const identity = await shippingLineApi.lookupManifestContainer(number)
        if (!cancelled) onResult(index, number, identity, identity ? 'found' : 'missing')
      } catch (e) {
        if (!cancelled) onResult(index, number, null, 'error', e.message || 'Không thể tra cứu container. Vui lòng thử lại.')
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [number, index, onResult, retry])
  const invalid = container.lookupStatus === 'missing' || container.lookupStatus === 'error'
  return <div>
    <label className="text-sm block">Số container *<input required maxLength={11} autoComplete="off" aria-invalid={invalid}
      aria-describedby={`manifest-container-hint-${index}`} className={`${fieldClass} ${invalid ? 'border-red-400' : ''}`}
      value={container.containerNumber} onChange={e => onChange(e.target.value.toUpperCase().replace(/[\s-]+/g, ''))} placeholder="CSQU3054383" /></label>
    <div id={`manifest-container-hint-${index}`} aria-live="polite" className="mt-1 text-xs">
      {container.lookupStatus === 'checking' && <p className="text-slate">Đang kiểm tra container…</p>}
      {container.lookupStatus === 'missing' && <><p className="text-red-600">Container không tồn tại trong hệ thống.</p>
        <button type="button" className="mt-1 text-signal-orange underline font-semibold" onClick={() => onRegister(number)}>Khai báo container rồi quay lại vận đơn</button></>}
      {container.lookupStatus === 'error' && <><p className="text-red-600">{container.lookupError}</p><button type="button" className="mt-1 underline text-signal-orange" onClick={() => setRetry(n => n + 1)}>Thử tra cứu lại</button></>}
    </div>
  </div>
}
