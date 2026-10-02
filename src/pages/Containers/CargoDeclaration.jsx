import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { containerService } from '../../services/containerService'

const emptyForm = {
  containerNumber: '', containerTypeCode: '', sourceReference: '', movementType: 'pickup_request',
  sealNumber: '', loadStatus: 'unknown', cargoType: 'general', grossWeightKg: '',
  requestedServiceDate: '', blBookingNumber: '', customerName: '', transportCompanyName: '',
}

const statusMeta = {
  pending_verification: { label: 'Chờ đối soát', className: 'border-blue-300 bg-blue-100 text-blue-900', dot: 'bg-blue-500' },
  verified: { label: 'Đã đối soát', className: 'border-green-300 bg-green-100 text-green-900', dot: 'bg-green-500' },
  rejected: { label: 'Bị từ chối', className: 'border-red-300 bg-red-100 text-red-900', dot: 'bg-red-500' },
}

const movementLabel = (value) => value === 'truck_dropoff' ? 'Đưa Container vào cảng' : 'Đến nhận Container'
const loadLabel = (value) => ({ full: 'Đầy hàng', empty: 'Rỗng', unknown: 'Chưa xác định' }[value] || value)
const formatDate = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—'
const formatDateOnly = (value) => value ? new Date(value).toLocaleDateString('vi-VN') : null

export default function CargoDeclaration() {
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) }
    catch { return null }
  }, [])
  const companyName = user?.companyName || user?.fullName || ''
  const [declarations, setDeclarations] = useState([])
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [containerTypeFilter, setContainerTypeFilter] = useState('All')
  const [movementFilter, setMovementFilter] = useState('All')
  const [selectedDeclaration, setSelectedDeclaration] = useState(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ ...emptyForm, transportCompanyName: companyName })

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [items, containerTypes] = await Promise.all([
        containerService.getTransportDeclarations(),
        containerService.getContainerTypes(),
      ])
      setDeclarations(items || [])
      setTypes(containerTypes || [])
      setForm((current) => ({ ...current, containerTypeCode: current.containerTypeCode || containerTypes?.[0]?.code || '' }))
    } catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const stats = useMemo(() => ({
    total: declarations.length,
    pending: declarations.filter((item) => item.dataStatus === 'pending_verification').length,
    verified: declarations.filter((item) => item.dataStatus === 'verified').length,
    rejected: declarations.filter((item) => item.dataStatus === 'rejected').length,
  }), [declarations])

  const filteredDeclarations = useMemo(() => declarations.filter((item) => {
    const query = searchQuery.trim().toLowerCase()
    const matchesSearch = !query || [item.visitReference, item.sourceReference, item.containerNumber,
      item.blBookingNumber, item.bookingCode, item.customerName].some((value) => String(value || '').toLowerCase().includes(query))
    return matchesSearch &&
      (statusFilter === 'All' || item.dataStatus === statusFilter) &&
      (containerTypeFilter === 'All' || item.containerTypeCode === containerTypeFilter) &&
      (movementFilter === 'All' || item.movementType === movementFilter)
  }), [containerTypeFilter, declarations, movementFilter, searchQuery, statusFilter])

  const openCreate = () => {
    setForm({ ...emptyForm, containerTypeCode: types[0]?.code || '', transportCompanyName: companyName })
    setError(''); setIsCreateOpen(true)
  }
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const submitDeclaration = async (event) => {
    event.preventDefault(); setSubmitting(true); setError(''); setNotice('')
    try {
      const result = await containerService.createTransportIntake({
        ...form,
        containerNumber: form.containerNumber.toUpperCase().replace(/[\s-]+/g, ''),
        grossWeightKg: form.grossWeightKg === '' ? null : Number(form.grossWeightKg),
        requestedServiceDate: form.requestedServiceDate,
      })
      const message = result.status === 'created_master' ? 'Đã tạo Container và lượt khai báo mới.'
        : result.status === 'created_visit' ? 'Đã tạo lượt khai báo mới cho Container có sẵn.'
          : result.status === 'updated_visit' ? 'Đã cập nhật lượt khai báo theo mã tham chiếu.'
            : 'Khai báo đã tồn tại và không có thay đổi.'
      setNotice(message); setIsCreateOpen(false); await loadData()
    } catch (requestError) {
      const detail = requestError.details && Object.values(requestError.details).flat()[0]
      setError(detail || requestError.message)
    } finally { setSubmitting(false) }
  }

  const submitImport = async () => {
    if (!file) return setError('Vui lòng chọn file Excel cần import.')
    setSubmitting(true); setError(''); setNotice('')
    try {
      const result = await containerService.importTransportContainers(file)
      setNotice(`Đã xử lý ${result.totalRows} dòng: ${result.successRows} thành công, ${result.duplicateRows} trùng, ${result.failedRows} lỗi.`)
      setIsImportOpen(false); setFile(null); await loadData()
    } catch (requestError) { setError(requestError.message) }
    finally { setSubmitting(false) }
  }

  const inputClass = 'w-full rounded-xl border border-chalk bg-fog px-3.5 py-2.5 text-xs font-semibold text-carbon outline-none focus:border-signal-orange focus:bg-white'
  const field = (label, key, props = {}) => (
    <label className="space-y-1.5 text-xs font-bold text-slate">
      <span>{label}{props.required && <b className="text-red-600"> *</b>}</span>
      <input className={inputClass} value={form[key]} onChange={(event) => update(key, event.target.value)} {...props} />
    </label>
  )

  const StatusBadge = ({ status }) => {
    const meta = statusMeta[status] || { label: status, className: 'border-slate-300 bg-slate-100 text-slate-800', dot: 'bg-slate-400' }
    return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-extrabold ${meta.className}`}><span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.label}</span>
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col gap-6 bg-slate-50 p-6 font-sans md:p-8">
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-chalk bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div><span className="rounded-full bg-orange-100 px-3 py-0.5 text-xs font-extrabold uppercase text-orange-800">Transport Company Portal</span><h2 className="mt-1 font-heading text-3xl font-extrabold text-carbon">KHAI BÁO CONTAINER</h2><p className="mt-0.5 text-xs text-slate">Khai báo nhu cầu nhận hoặc đưa Container vào cảng để đối soát trước khi đặt lịch.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={() => { setError(''); setIsImportOpen(true) }} className="flex h-11 items-center gap-2 rounded-xl border border-carbon bg-white px-5 text-xs font-extrabold text-carbon hover:bg-fog"><span className="material-symbols-outlined text-lg">upload_file</span>Import Excel</button><button onClick={openCreate} className="flex h-11 items-center gap-2 rounded-xl bg-signal-orange px-5 text-xs font-extrabold text-white shadow-lg hover:opacity-95"><span className="material-symbols-outlined text-lg">add</span>Tạo khai báo mới</button></div>
      </div>

      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div>}
      {error && !isCreateOpen && !isImportOpen && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['TỔNG KHAI BÁO', stats.total, 'Tổng lượt Container', 'text-carbon', 'border-chalk bg-white'],
          ['CHỜ ĐỐI SOÁT', stats.pending, 'Đang chờ Terminal kiểm tra', 'text-blue-600', 'border-blue-200 bg-blue-50/30'],
          ['ĐÃ ĐỐI SOÁT', stats.verified, 'Có thể tiếp tục Booking', 'text-green-600', 'border-green-300 bg-green-50/30'],
          ['BỊ TỪ CHỐI', stats.rejected, 'Cần kiểm tra và khai báo lại', 'text-red-600', 'border-red-300 bg-red-50/30'],
        ].map(([label, value, note, color, card]) => <div key={label} className={`space-y-1 rounded-xl border p-4 shadow-sm ${card}`}><span className="text-[10px] font-bold uppercase tracking-wider text-slate">{label}</span><div className={`font-mono text-3xl font-extrabold ${color}`}>{value}</div><span className={`text-[11px] font-bold ${color}`}>{note}</span></div>)}
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-chalk bg-white p-4 shadow-sm md:flex-row">
        <div className="relative w-full max-w-md"><span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate">search</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm Container, mã khai báo, Booking ngoài hoặc NexusPort..." className="w-full rounded-xl border border-chalk bg-fog py-2 pl-9 pr-4 text-xs font-bold text-carbon outline-none focus:border-signal-orange" /></div>
        <div className="flex w-full flex-wrap items-center gap-3 text-xs font-bold md:w-auto"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}><option value="All">Tất cả trạng thái</option><option value="pending_verification">Chờ đối soát</option><option value="verified">Đã đối soát</option><option value="rejected">Bị từ chối</option></select><select value={containerTypeFilter} onChange={(event) => setContainerTypeFilter(event.target.value)} className={inputClass}><option value="All">Tất cả loại Container</option>{types.map((type) => <option key={type.id} value={type.code}>{type.code}</option>)}</select><select value={movementFilter} onChange={(event) => setMovementFilter(event.target.value)} className={inputClass}><option value="All">Tất cả nhu cầu</option><option value="pickup_request">Đến nhận Container</option><option value="truck_dropoff">Đưa Container vào cảng</option></select></div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-chalk bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full border-collapse text-left text-xs"><thead><tr className="border-b border-chalk bg-fog text-[10px] font-bold uppercase tracking-wider text-slate"><th className="px-6 py-3.5">Mã khai báo</th><th className="px-6 py-3.5">Container</th><th className="px-6 py-3.5">Loại</th><th className="px-6 py-3.5">Nhu cầu & hàng hóa</th><th className="px-6 py-3.5">Booking</th><th className="px-6 py-3.5">Ngày khai báo</th><th className="px-6 py-3.5">Trạng thái</th><th className="px-6 py-3.5 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-chalk font-medium">
        {loading ? <tr><td colSpan="8" className="px-6 py-12 text-center font-bold text-slate">Đang tải khai báo Container...</td></tr> : filteredDeclarations.length === 0 ? <tr><td colSpan="8" className="px-6 py-12 text-center font-bold text-slate">Chưa có khai báo Container phù hợp.</td></tr> : filteredDeclarations.map((item) => <tr key={item.id} className="hover:bg-fog/80"><td className="px-6 py-4 font-mono font-extrabold text-signal-orange">{item.sourceReference || item.visitReference}</td><td className="px-6 py-4 font-mono font-bold text-carbon">{item.containerNumber}<div className="mt-1 text-[10px] font-normal text-slate">Seal: {item.sealNumber || '—'}</div></td><td className="px-6 py-4"><span className="rounded bg-carbon px-2 py-0.5 font-mono text-[10px] font-bold text-white">{item.containerTypeCode}</span></td><td className="px-6 py-4"><div className="font-bold text-carbon">{movementLabel(item.movementType)}</div><div className="mt-1 text-[10px] text-slate">{loadLabel(item.loadStatus)} · {item.cargoType} · {item.grossWeightKg ? `${Number(item.grossWeightKg).toLocaleString('vi-VN')} kg` : 'Chưa có trọng lượng'}</div></td><td className="px-6 py-4 text-carbon"><div className="font-mono">Ngoài: {item.blBookingNumber || '—'}</div><div className="mt-1 text-[10px] font-semibold text-slate">NexusPort: {item.bookingCode || 'Chưa liên kết'}</div></td><td className="px-6 py-4 font-mono text-slate">{formatDate(item.createdAt)}</td><td className="px-6 py-4"><StatusBadge status={item.dataStatus} /></td><td className="px-6 py-4 text-right"><button onClick={() => setSelectedDeclaration(item)} className="inline-flex items-center gap-1 rounded-full bg-carbon px-3 py-1.5 text-[10px] font-extrabold text-white"><span className="material-symbols-outlined text-sm">visibility</span>Xem</button></td></tr>)}
      </tbody></table></div></div>

      {isCreateOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/60 p-4 backdrop-blur-sm"><form onSubmit={submitDeclaration} className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-chalk bg-white p-5"><div><span className="text-[10px] font-extrabold uppercase tracking-wider text-signal-orange">Transport Company Portal</span><h3 className="font-heading text-2xl font-extrabold text-carbon">Tạo khai báo Container</h3></div><button type="button" onClick={() => setIsCreateOpen(false)} className="material-symbols-outlined rounded-full p-2 hover:bg-fog">close</button></div><div className="space-y-6 p-6">{error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</div>}
        <section><h4 className="mb-3 border-b border-chalk pb-2 text-xs font-extrabold uppercase tracking-wider text-slate">Thông tin nhận diện</h4><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{field('Số Container', 'containerNumber', { required: true, placeholder: 'EMCU8361795' })}<label className="space-y-1.5 text-xs font-bold text-slate"><span>ISO / Loại Container *</span><select className={inputClass} value={form.containerTypeCode} onChange={(event) => update('containerTypeCode', event.target.value)} required>{types.map((type) => <option key={type.id} value={type.code}>{type.code} · {type.size} · {type.category}</option>)}</select></label>{field('Mã tham chiếu / Số lệnh', 'sourceReference', { required: true, placeholder: 'PICKUP-238600081908' })}{field('Seal', 'sealNumber')}{field('Số B/L / Booking hãng tàu (nếu có)', 'blBookingNumber')}{field('Tên khách hàng/chủ hàng', 'customerName')}</div></section>
        <section><h4 className="mb-3 border-b border-chalk pb-2 text-xs font-extrabold uppercase tracking-wider text-slate">Nhu cầu vận chuyển</h4><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><label className="space-y-1.5 text-xs font-bold text-slate"><span>Nhu cầu *</span><select className={inputClass} value={form.movementType} onChange={(event) => update('movementType', event.target.value)}><option value="pickup_request">Đến nhận Container</option><option value="truck_dropoff">Đưa Container vào cảng</option></select></label>{field(form.movementType === 'pickup_request' ? 'Ngày mong muốn nhận' : 'Ngày mong muốn đưa vào cảng', 'requestedServiceDate', { type: 'date', required: true })}{field('Tên công ty vận chuyển', 'transportCompanyName', { required: true })}</div></section>
        <section><h4 className="mb-3 border-b border-chalk pb-2 text-xs font-extrabold uppercase tracking-wider text-slate">Thông tin hàng trong Container</h4><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><label className="space-y-1.5 text-xs font-bold text-slate"><span>Tình trạng hàng</span><select className={inputClass} value={form.loadStatus} onChange={(event) => update('loadStatus', event.target.value)}><option value="unknown">Chưa xác định</option><option value="full">Đầy hàng</option><option value="empty">Rỗng</option></select></label><label className="space-y-1.5 text-xs font-bold text-slate"><span>Loại hàng</span><select className={inputClass} value={form.cargoType} onChange={(event) => update('cargoType', event.target.value)}>{['general', 'reefer', 'dangerous', 'perishable', 'oversized', 'overweight'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>{field('Khối lượng (kg)', 'grossWeightKg', { type: 'number', min: 0 })}</div></section>
      </div><div className="sticky bottom-0 flex justify-end gap-3 border-t border-chalk bg-white p-5"><button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-xl border border-chalk px-5 py-2.5 text-xs font-extrabold text-slate">Hủy</button><button disabled={submitting || !types.length} className="rounded-xl bg-signal-orange px-6 py-2.5 text-xs font-extrabold text-white disabled:opacity-50">{submitting ? 'Đang gửi...' : 'Gửi khai báo đối soát'}</button></div></form></div>}

      {isImportOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/60 p-4 backdrop-blur-sm"><div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><span className="text-[10px] font-extrabold uppercase tracking-wider text-signal-orange">Import Excel</span><h3 className="font-heading text-2xl font-extrabold text-carbon">Khai báo nhiều Container</h3></div><button onClick={() => setIsImportOpen(false)} className="material-symbols-outlined rounded-full p-2 hover:bg-fog">close</button></div>{error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</div>}<div className="mt-5 rounded-xl border-2 border-dashed border-chalk bg-fog p-7 text-center"><span className="material-symbols-outlined text-4xl text-slate">upload_file</span><p className="mt-2 text-sm font-bold text-carbon">File .xlsx hoặc .xls, tối đa 5 MB và 1.000 dòng</p><input type="file" accept=".xlsx,.xls" onChange={(event) => setFile(event.target.files?.[0] || null)} className="mx-auto mt-4 block max-w-full text-sm" /></div><div className="mt-5 flex items-center justify-between gap-3"><a href="/templates/NXP-038_Container_Import_Cong_Ty_Van_Chuyen.xlsx" download className="text-xs font-extrabold text-signal-orange hover:underline">Tải file Excel mẫu</a><button onClick={submitImport} disabled={submitting || !file} className="rounded-xl bg-carbon px-5 py-2.5 text-xs font-extrabold text-white disabled:opacity-50">{submitting ? 'Đang xử lý...' : 'Import và đối soát'}</button></div></div></div>}

      {selectedDeclaration && <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/60 p-4 backdrop-blur-sm" onClick={() => setSelectedDeclaration(null)}><div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><span className="text-[10px] font-extrabold uppercase tracking-wider text-signal-orange">Chi tiết khai báo</span><h3 className="font-mono text-xl font-extrabold text-carbon">{selectedDeclaration.containerNumber}</h3></div><button onClick={() => setSelectedDeclaration(null)} className="material-symbols-outlined rounded-full p-2 hover:bg-fog">close</button></div><div className="mt-5 grid gap-4 rounded-xl border border-chalk bg-fog p-5 text-sm md:grid-cols-2">{[
        ['Mã lượt cảng', selectedDeclaration.visitReference], ['Mã tham chiếu', selectedDeclaration.sourceReference], ['Loại Container', selectedDeclaration.containerTypeCode], ['Nhu cầu', movementLabel(selectedDeclaration.movementType)], ['Seal', selectedDeclaration.sealNumber], ['Tình trạng hàng', loadLabel(selectedDeclaration.loadStatus)], ['Loại hàng', selectedDeclaration.cargoType], ['Khối lượng', selectedDeclaration.grossWeightKg ? `${Number(selectedDeclaration.grossWeightKg).toLocaleString('vi-VN')} kg` : null], ['B/L / Booking hãng tàu', selectedDeclaration.blBookingNumber], ['Booking NexusPort', selectedDeclaration.bookingCode || 'Chưa liên kết'], [selectedDeclaration.movementType === 'pickup_request' ? 'Ngày mong muốn nhận' : 'Ngày mong muốn đưa vào cảng', formatDateOnly(selectedDeclaration.requestedServiceDate)], ['Khách hàng', selectedDeclaration.customerName], ['Công ty vận chuyển', selectedDeclaration.transportCompanyName],
      ].map(([label, value]) => <div key={label}><div className="text-[10px] font-bold uppercase tracking-wider text-slate">{label}</div><div className="mt-1 font-semibold text-carbon">{value || '—'}</div></div>)}</div><div className="mt-5 flex items-center justify-between"><StatusBadge status={selectedDeclaration.dataStatus} /><button onClick={() => setSelectedDeclaration(null)} className="rounded-xl bg-carbon px-5 py-2.5 text-xs font-extrabold text-white">Đóng</button></div></div></div>}
    </div>
  )
}
