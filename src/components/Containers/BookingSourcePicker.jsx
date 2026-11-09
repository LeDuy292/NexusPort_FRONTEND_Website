import { useEffect, useId, useRef, useState } from 'react'
import { bookingService } from '../../services/bookingService'
import { containerService } from '../../services/containerService'

export default function BookingSourcePicker({ operation, onSelect }) {
  const dropdownId = useId()
  const pickup = operation.operationType === 'Import'
  const [code, setCode] = useState(operation.yardCode || '')
  const [manualNumber, setManualNumber] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const lookupRequest = useRef(0)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1)
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  useEffect(() => () => { lookupRequest.current += 1 }, [])

  useEffect(() => {
    let active = true
    setRows([]); setError(''); setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const data = await bookingService.getContainerOptions('', pickup ? 'Pickup' : 'Dropoff')
        if (active) {
          setRows(data)
          const selected = pickup ? operation.containerVisitId : operation.declarationId
          const stillAvailable = data.some(row => (pickup ? row.containerVisitId || row.containerId : row.declarationId) === selected)
          if (selected && !stillAvailable) { setCode(''); onSelect(null) }
        }
      } catch (e) {
        if (active) setError([404, 405].includes(e.response?.status)
          ? 'API C# đang chạy chưa có chức năng chọn container mới. Hãy dừng và chạy lại backend C# để nạp bản build mới.'
          : e.response?.data?.Message || e.response?.data?.message || e.message)
      } finally { if (active) setLoading(false) }
    }, 0)
    return () => { active = false; clearTimeout(timer) }
  }, [pickup, revision])

  const keyOf = row => pickup ? row.containerVisitId || row.containerId : row.declarationId
  const selectedRow = pickup ? rows.find(row => (operation.containerVisitId && row.containerVisitId === operation.containerVisitId) ||
    (row.containerId === operation.containerId && row.yardCode && row.yardCode === operation.yardCode)) : null
  const selectedKey = (pickup ? selectedRow && keyOf(selectedRow) || operation.containerVisitId || operation.containerId : operation.declarationId) || ''
  const automaticCode = pickup && !!selectedRow?.yardCode
  const fromSharedSearch = pickup && operation.containerId && !operation.containerVisitId && !selectedRow
  const options = (loading || fromSharedSearch) && selectedKey && !rows.some(row => keyOf(row) === selectedKey)
    ? [{ containerId: operation.containerId, containerVisitId: operation.containerVisitId, declarationId: operation.declarationId,
        containerNumber: operation.containerNumber, containerTypeCode: operation.containerIsoSize,
        pendingSource: loading, fromSharedSearch }, ...rows]
    : rows
  const number = manualNumber.toUpperCase().replace(/[\s-]+/g, '')
  const validCode = /^TC-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(code.trim())

  async function usePickupCode() {
    const yardCode = code.trim()
    if (operation.containerId) {
      onSelect({ ...operation, containerTypeCode: operation.containerIsoSize, declarationId: null, yardCode })
      return
    }
    const request = ++lookupRequest.current
    setLookingUp(true)
    setLookupError('')
    try {
      const item = await containerService.lookup(number)
      if (request !== lookupRequest.current) return
      if (!item) {
        setLookupError('Không tìm thấy container theo số đã nhập.')
        return
      }
      onSelect({ ...item, containerId: item.id, declarationId: null, yardCode })
    } catch (error) {
      if (request === lookupRequest.current) setLookupError(error.message)
    } finally {
      if (request === lookupRequest.current) setLookingUp(false)
    }
  }

  return <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4 space-y-3">
    <label htmlFor={dropdownId} className="block text-xs font-bold">
      {pickup ? 'Chọn container cần nhận' : 'Chọn container để Booking'}
    </label>
    <select id={dropdownId} aria-label="Chọn container để Booking" value={selectedKey} disabled={loading || lookingUp}
      onChange={e => {
        const row = rows.find(item => keyOf(item) === e.target.value)
        const yardCode = pickup ? row?.yardCode || '' : ''
        setCode(yardCode)
        setManualNumber('')
        setLookupError('')
        onSelect(row ? { ...row, declarationId: pickup ? null : row.declarationId, yardCode } : null)
      }} className="w-full rounded-xl border bg-white p-3 text-sm">
      <option value="">{loading ? 'Đang tải danh sách container…' : '-- Chọn container --'}</option>
      {options.map(row => <option key={keyOf(row)} value={keyOf(row)}>
        {row.containerNumber}{row.pendingSource ? ' · Chờ tải thông tin từ API'
          : row.fromSharedSearch ? ' · Nhập mã nhận container' : ` · ${row.containerTypeCode || 'Chưa có loại'}`}
        {pickup && !row.pendingSource && row.yardCode && ` · Lượt ${row.yardCode}`}
        {!pickup && !row.pendingSource && ` · ${row.grossWeightKg == null ? 'Chưa có khối lượng' : `${row.grossWeightKg.toLocaleString()} kg`} · ${row.customerName || 'Chưa có khách hàng'} · Bản khai ${row.declarationId.slice(0, 8)}`}
      </option>)}
    </select>
    {!loading && !error && !rows.length && <p className="text-xs">
      {pickup ? 'Chưa có lượt bãi nào đã được cấp quyền nhận cho công ty.'
        : 'Chưa có bản khai hàng phù hợp để đặt lịch. Hãy kiểm tra mục Bản khai hàng của công ty.'}
    </p>}
    {pickup && !operation.containerId && <label className="block space-y-1 text-xs font-bold">
      <span>Hoặc nhập số container nếu đã có mã nhận</span>
      <input value={manualNumber} onChange={e => { setManualNumber(e.target.value.toUpperCase()); setLookupError('') }}
        disabled={lookingUp} placeholder="Ví dụ ONEU7524599" maxLength={20} className="w-full rounded-xl border p-3 text-sm font-mono" />
    </label>}
    {pickup && <div className="flex flex-wrap gap-2">
      <input aria-label="Mã nhận container" value={automaticCode ? selectedRow.yardCode : code} readOnly={automaticCode} disabled={lookingUp} placeholder="TC-XXXX-XXXX-XXXX"
        onChange={e => {
          setCode(e.target.value.toUpperCase())
          if (operation.containerId) onSelect({ ...operation, declarationId: null, yardCode: '' })
        }} className="flex-1 rounded-xl border p-3 text-sm font-mono" />
      {!automaticCode && <button type="button" disabled={loading || lookingUp || !validCode || (!operation.containerId && !/^[A-Z]{4}\d{7}$/.test(number))}
        onClick={usePickupCode}
        className="rounded-xl bg-orange-600 p-3 text-sm font-bold text-white disabled:opacity-50">{lookingUp ? 'Đang tìm container…' : 'Xác thực và lấy thông tin'}</button>}
    </div>}
    {automaticCode && <p className="text-xs text-teal-800">Mã nhận đã được lấy tự động từ lượt bãi công ty bạn có quyền nhận. Hệ thống sẽ tự tải thông tin container.</p>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {lookupError && <p role="alert" className="text-xs text-red-700">{lookupError}</p>}
  </div>
}
