import { useEffect, useState } from 'react'
import { bookingService } from '../../services/bookingService'

export default function BookingSourcePicker({ operation, onSelect }) {
  const pickup = operation.operationType === 'Import'
  const [code, setCode] = useState(operation.yardCode || '')
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setRows([]); setError(''); setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const data = await bookingService.getContainerOptions('', pickup ? 'Pickup' : 'Dropoff')
        if (active) setRows(data)
      } catch (e) {
        if (active) setError([404, 405].includes(e.response?.status)
          ? 'API C# đang chạy chưa có chức năng chọn container mới. Hãy dừng và chạy lại backend C# để nạp bản build mới.'
          : e.response?.data?.Message || e.response?.data?.message || e.message)
      } finally { if (active) setLoading(false) }
    }, 0)
    return () => { active = false; clearTimeout(timer) }
  }, [pickup])

  const keyOf = row => pickup ? row.containerId : row.declarationId
  const selectedKey = (pickup ? operation.containerId : operation.declarationId) || ''
  const options = selectedKey && !rows.some(row => keyOf(row) === selectedKey)
    ? [{ containerId: operation.containerId, declarationId: operation.declarationId,
        containerNumber: operation.containerNumber, containerTypeCode: operation.containerIsoSize, pendingSource: true }, ...rows]
    : rows

  return <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4 space-y-3">
    <label htmlFor="booking-container-dropdown" className="block text-xs font-bold">
      {pickup ? 'Chọn container cần nhận' : 'Chọn container để Booking'}
    </label>
    <select id="booking-container-dropdown" aria-label="Chọn container để Booking" value={selectedKey} disabled={loading}
      onChange={e => {
        const row = rows.find(item => keyOf(item) === e.target.value)
        setCode('')
        onSelect(row ? { ...row, declarationId: pickup ? null : row.declarationId, yardCode: '' } : null)
      }} className="w-full rounded-xl border bg-white p-3 text-sm">
      <option value="">{loading ? 'Đang tải danh sách container…' : '-- Chọn container --'}</option>
      {options.map(row => <option key={keyOf(row)} value={keyOf(row)}>
        {row.containerNumber}{row.pendingSource ? ' · Chờ tải thông tin từ API' : ` · ${row.containerTypeCode || 'Chưa có loại'}`}
        {!pickup && !row.pendingSource && ` · ${row.grossWeightKg == null ? 'Chưa có khối lượng' : `${row.grossWeightKg.toLocaleString()} kg`} · ${row.customerName || 'Chưa có khách hàng'} · Bản khai ${row.declarationId.slice(0, 8)}`}
      </option>)}
    </select>
    {!loading && !error && !rows.length && <p className="text-xs">
      {pickup ? 'Chưa có container được cấp quyền nhận trong danh sách.'
        : 'Chưa có bản khai có hàng chưa đặt lịch phù hợp. Hãy kiểm tra tại trang Khai báo container.'}
    </p>}
    {pickup && <div className="flex flex-wrap gap-2">
      <input aria-label="Mã nhận container" value={code} placeholder="TC-XXXX-XXXX-XXXX"
        onChange={e => {
          setCode(e.target.value.toUpperCase())
          if (operation.containerId) onSelect({ ...operation, declarationId: null, yardCode: '' })
        }} className="flex-1 rounded-xl border p-3 text-sm font-mono" />
      <button type="button" disabled={loading || !operation.containerId || !/^TC-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(code.trim())}
        onClick={() => onSelect({ ...operation, declarationId: null, yardCode: code.trim() })}
        className="rounded-xl bg-orange-600 p-3 text-sm font-bold text-white disabled:opacity-50">Xác thực và lấy thông tin</button>
    </div>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </div>
}
