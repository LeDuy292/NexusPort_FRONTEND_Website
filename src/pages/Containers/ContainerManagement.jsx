import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { containerService } from '../../services/containerService'

const STATUSES = ['expected', 'discharged', 'in_yard', 'reserved', 'moving', 'gate_in', 'gate_out', 'loaded', 'damaged', 'canceled']
const CARGO_TYPES = ['general', 'reefer', 'dangerous', 'perishable', 'oversized', 'overweight']
const STATUS_LABELS = {
  expected: 'Dự kiến', discharged: 'Đã dỡ tàu', in_yard: 'Trong bãi', reserved: 'Đã giữ chỗ',
  moving: 'Đang di chuyển', gate_in: 'Đã vào cổng', gate_out: 'Đã ra cổng', loaded: 'Đã xếp tàu',
  damaged: 'Hư hỏng', canceled: 'Đã xóa',
}
const STATUS_STYLES = {
  expected: 'bg-blue-50 text-blue-700', discharged: 'bg-indigo-50 text-indigo-700',
  in_yard: 'bg-emerald-50 text-emerald-700', reserved: 'bg-amber-50 text-amber-700',
  moving: 'bg-cyan-50 text-cyan-700', gate_in: 'bg-violet-50 text-violet-700',
  gate_out: 'bg-slate-100 text-slate-700', loaded: 'bg-green-50 text-green-700',
  damaged: 'bg-red-50 text-red-700', canceled: 'bg-gray-100 text-gray-500',
}
const EMPTY_FORM = {
  containerNumber: '', containerTypeId: '', sealNumber: '', cargoType: 'general', status: 'expected',
  grossWeightKg: '', carrierId: '', vesselCallId: '', expectedGateOutAt: '', arrivedAt: '', leftAt: '',
}

const formatDate = (value) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'
const displaySize = (size) => ({ ft20: "20'", ft40: "40'", ft45: "45'" }[size] || size)
const toInputDate = (value) => value ? new Date(value).toISOString().slice(0, 16) : ''

function Field({ label, required, children }) {
  return <label className="space-y-1.5 text-xs font-bold text-graphite"><span>{label}{required && ' *'}</span>{children}</label>
}

function ContainerFormModal({ container, types, onClose, onSaved }) {
  const editing = Boolean(container)
  const [form, setForm] = useState(() => container ? {
    containerNumber: container.containerNumber,
    containerTypeId: container.containerTypeId,
    sealNumber: container.sealNumber || '',
    cargoType: container.cargoType,
    status: container.status,
    grossWeightKg: container.grossWeightKg ?? '',
    carrierId: container.carrierId || '',
    vesselCallId: container.vesselCallId || '',
    expectedGateOutAt: toInputDate(container.expectedGateOutAt),
    arrivedAt: toInputDate(container.arrivedAt),
    leftAt: toInputDate(container.leftAt),
  } : { ...EMPTY_FORM, containerTypeId: types[0]?.id || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event) => {
    event.preventDefault()
    setSaving(true); setError('')
    const payload = {
      ...form,
      containerNumber: form.containerNumber.toUpperCase().replace(/[\s-]+/g, ''),
      sealNumber: form.sealNumber.trim(),
      grossWeightKg: form.grossWeightKg === '' ? null : Number(form.grossWeightKg),
      carrierId: form.carrierId || null,
      vesselCallId: form.vesselCallId || null,
      expectedGateOutAt: form.expectedGateOutAt ? new Date(form.expectedGateOutAt).toISOString() : null,
      ...(editing ? {
        arrivedAt: form.arrivedAt ? new Date(form.arrivedAt).toISOString() : null,
        leftAt: form.leftAt ? new Date(form.leftAt).toISOString() : null,
      } : {}),
    }
    try {
      const saved = editing
        ? await containerService.updateContainer(container.id, payload)
        : await containerService.createContainer(payload)
      onSaved(saved)
    } catch (requestError) {
      const detail = requestError.details && Object.values(requestError.details).flat()[0]
      setError(detail || requestError.message)
    } finally { setSaving(false) }
  }

  const inputClass = 'w-full rounded-lg border border-chalk bg-fog px-3 py-2.5 text-sm font-medium text-carbon outline-none focus:border-signal-orange focus:ring-2 focus:ring-orange-100'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-chalk bg-white px-6 py-4">
          <div><h2 className="font-heading text-xl font-bold text-carbon">{editing ? 'Cập nhật Container' : 'Đăng ký Container'}</h2><p className="mt-1 text-xs text-slate">Thông tin nhận diện theo tiêu chuẩn ISO 6346</p></div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-fog text-graphite hover:bg-chalk"><span className="material-symbols-outlined">close</span></button>
        </div>
        <form onSubmit={submit} className="space-y-5 p-6">
          {error && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><span className="material-symbols-outlined text-lg">error</span>{error}</div>}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Container ID" required><input className={`${inputClass} font-mono uppercase tracking-wider`} required maxLength={14} placeholder="MSCU6639871" value={form.containerNumber} onChange={(e) => update('containerNumber', e.target.value)} /></Field>
            <Field label="Seal Number" required><input className={`${inputClass} font-mono uppercase`} required maxLength={50} placeholder="SEAL-2026-001" value={form.sealNumber} onChange={(e) => update('sealNumber', e.target.value.toUpperCase())} /></Field>
            <Field label="Size / Type" required><select className={inputClass} required value={form.containerTypeId} onChange={(e) => update('containerTypeId', e.target.value)}><option value="">Chọn loại container</option>{types.map((type) => <option key={type.id} value={type.id}>{type.code} · {displaySize(type.size)} · {type.category.replaceAll('_', ' ')}</option>)}</select></Field>
            <Field label="Loại hàng"><select className={inputClass} value={form.cargoType} onChange={(e) => update('cargoType', e.target.value)}>{CARGO_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></Field>
            <Field label="Trạng thái"><select className={inputClass} value={form.status} onChange={(e) => update('status', e.target.value)}>{STATUSES.filter((status) => status !== 'canceled').map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></Field>
            <Field label="Khối lượng toàn bộ (kg)"><input className={inputClass} type="number" min="0" step="0.01" placeholder="30480" value={form.grossWeightKg} onChange={(e) => update('grossWeightKg', e.target.value)} /></Field>
            <Field label="Carrier ID"><input className={`${inputClass} font-mono`} placeholder="UUID (không bắt buộc)" value={form.carrierId} onChange={(e) => update('carrierId', e.target.value)} /></Field>
            <Field label="Vessel Call ID"><input className={`${inputClass} font-mono`} placeholder="UUID (không bắt buộc)" value={form.vesselCallId} onChange={(e) => update('vesselCallId', e.target.value)} /></Field>
            <Field label="Dự kiến ra cổng"><input className={inputClass} type="datetime-local" value={form.expectedGateOutAt} onChange={(e) => update('expectedGateOutAt', e.target.value)} /></Field>
            {editing && <><Field label="Thời điểm đến"><input className={inputClass} type="datetime-local" value={form.arrivedAt} onChange={(e) => update('arrivedAt', e.target.value)} /></Field><Field label="Thời điểm rời cảng"><input className={inputClass} type="datetime-local" value={form.leftAt} onChange={(e) => update('leftAt', e.target.value)} /></Field></>}
          </div>
          {!types.length && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Chưa có dữ liệu Container Type trong database. Administrator cần seed bảng container_types trước khi đăng ký.</p>}
          <div className="flex justify-end gap-3 border-t border-chalk pt-5"><button type="button" onClick={onClose} className="rounded-lg border border-chalk px-5 py-2.5 text-sm font-bold text-graphite hover:bg-fog">Hủy</button><button disabled={saving || !types.length} className="rounded-lg bg-signal-orange px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Đăng ký'}</button></div>
        </form>
      </div>
    </div>
  )
}

function ContainerDetailModal({ detail, loading, onClose, onEdit, canWrite }) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/45" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-7 shadow-2xl">
    <div className="mb-6 flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-signal-orange">Container detail</p><h2 className="mt-1 font-heading text-2xl font-bold text-carbon">{detail?.containerNumber || 'Đang tải...'}</h2></div><button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-fog"><span className="material-symbols-outlined">close</span></button></div>
    {loading || !detail ? <div className="py-20 text-center text-slate">Đang tải thông tin...</div> : <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl bg-carbon p-5 text-white"><div><p className="text-xs text-gray-400">Seal Number</p><p className="mt-1 font-mono text-lg font-bold">{detail.sealNumber || '—'}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[detail.status]}`}>{STATUS_LABELS[detail.status]}</span></div>
      <section><h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate">Thông số Container</h3><dl className="grid grid-cols-2 gap-3 text-sm">{[
        ['Type', detail.containerType?.code], ['Kích thước', displaySize(detail.containerType?.size)], ['Phân loại', detail.containerType?.category?.replaceAll('_', ' ')], ['Loại hàng', detail.cargoType?.replaceAll('_', ' ')], ['Gross weight', detail.grossWeightKg ? `${Number(detail.grossWeightKg).toLocaleString('vi-VN')} kg` : '—'], ['Carrier', detail.carrierName || '—'], ['Vessel call', detail.vesselCallCode || '—'], ['Tạo lúc', formatDate(detail.createdAt)],
      ].map(([label, value]) => <div key={label} className="rounded-lg border border-chalk p-3"><dt className="text-xs text-slate">{label}</dt><dd className="mt-1 font-semibold text-carbon">{value}</dd></div>)}</dl></section>
      <section><h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate">Vị trí hiện tại</h3>{detail.currentPosition ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-bold text-emerald-800">Block {detail.currentPosition.blockCode} · Bay {detail.currentPosition.bay} · Row {detail.currentPosition.row} · Tier {detail.currentPosition.tier}</p><p className="mt-1 text-xs text-emerald-700">Đặt lúc {formatDate(detail.currentPosition.placedAt)}</p></div> : <p className="rounded-lg bg-fog p-4 text-sm text-slate">Container chưa có vị trí hiện tại trong bãi.</p>}</section>
      <section><h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate">Booking liên kết ({detail.bookings?.length || 0})</h3><div className="space-y-2">{detail.bookings?.length ? detail.bookings.map((booking) => <div key={booking.id} className="flex items-center justify-between rounded-lg border border-chalk p-3"><div><p className="font-mono text-sm font-bold text-carbon">{booking.bookingCode}</p><p className="text-xs text-slate">{booking.bookingType} · {formatDate(booking.appointmentStart)}</p></div><span className="rounded-full bg-fog px-2.5 py-1 text-xs font-bold text-graphite">{booking.status}</span></div>) : <p className="rounded-lg bg-fog p-4 text-sm text-slate">Chưa liên kết Booking.</p>}</div></section>
      {canWrite && detail.status !== 'canceled' && <button onClick={() => onEdit(detail)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-signal-orange py-3 text-sm font-bold text-white"><span className="material-symbols-outlined text-lg">edit</span>Cập nhật Container</button>}
    </div>}
  </aside></div>
}

export default function ContainerManagement() {
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) } catch { return null } }, [])
  const canWrite = ['Administrator', 'Dispatcher', 'Gate Officer'].includes(user?.role)
  const canDelete = user?.role === 'Administrator'
  const [items, setItems] = useState([]); const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const [filters, setFilters] = useState({ page: 1, limit: 10, search: '', status: '', size: '', category: '' })
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })
  const [formContainer, setFormContainer] = useState(undefined); const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState(null); const [detailLoading, setDetailLoading] = useState(false); const [showDetail, setShowDetail] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const result = await containerService.getContainers(filters); setItems(result.items); setPagination(result) }
    catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }, [filters])
  useEffect(() => { containerService.getContainerTypes().then(setTypes).catch((e) => setError(e.message)) }, [])
  useEffect(() => { const timer = setTimeout(load, 300); return () => clearTimeout(timer) }, [load])

  const openDetail = async (id) => { setShowDetail(true); setDetail(null); setDetailLoading(true); try { setDetail(await containerService.getContainerById(id)) } catch (e) { setError(e.message); setShowDetail(false) } finally { setDetailLoading(false) } }
  const saved = () => { setShowForm(false); setFormContainer(undefined); setNotice('Đã lưu thông tin Container thành công.'); load(); setTimeout(() => setNotice(''), 3000) }
  const edit = (container) => { setShowDetail(false); setFormContainer(container); setShowForm(true) }
  const remove = async (container) => { if (!window.confirm(`Soft-delete Container ${container.containerNumber}? Dữ liệu lịch sử vẫn được giữ lại.`)) return; try { await containerService.deleteContainer(container.id); setNotice('Container đã được soft-delete.'); load(); setTimeout(() => setNotice(''), 3000) } catch (e) { setError(e.message) } }
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? value : 1 }))

  return <div className="mx-auto w-full max-w-[1500px] space-y-5 p-1">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-signal-orange"><span className="h-2 w-2 rounded-full bg-signal-orange" />NXP-038 · Central registry</div><h1 className="font-heading text-3xl font-bold text-carbon">Quản lý Container</h1><p className="mt-1 text-sm text-slate">Theo dõi xuyên suốt Booking → Gate-In → Yard → Gate-Out</p></div>{canWrite && <button onClick={() => { setFormContainer(undefined); setShowForm(true) }} className="flex items-center justify-center gap-2 rounded-lg bg-signal-orange px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-orange-600"><span className="material-symbols-outlined text-lg">add</span>Đăng ký Container</button>}</div>
    {notice && <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><span className="material-symbols-outlined text-lg">check_circle</span>{notice}</div>}
    {error && <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button onClick={() => setError('')}><span className="material-symbols-outlined text-lg">close</span></button></div>}
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
      ['Tổng kết quả', pagination.total || 0, 'inventory_2', 'text-carbon'], ['Trong bãi', items.filter((x) => x.status === 'in_yard').length, 'warehouse', 'text-emerald-600'], ['Đang di chuyển', items.filter((x) => x.status === 'moving').length, 'local_shipping', 'text-cyan-600'], ['Hư hỏng', items.filter((x) => x.status === 'damaged').length, 'warning', 'text-red-600'],
    ].map(([label, value, icon, color]) => <div key={label} className="rounded-xl border border-chalk bg-white p-4"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-slate">{label}</p><span className={`material-symbols-outlined ${color}`}>{icon}</span></div><p className={`mt-2 font-heading text-2xl font-bold ${color}`}>{value}</p></div>)}</div>
    <div className="rounded-xl border border-chalk bg-white p-4"><div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]"><div className="relative"><span className="material-symbols-outlined absolute left-3 top-2.5 text-xl text-slate">search</span><input value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Tìm theo Container ID hoặc Seal Number..." className="w-full rounded-lg border border-chalk bg-fog py-2.5 pl-10 pr-3 text-sm outline-none focus:border-signal-orange" /></div><select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="rounded-lg border border-chalk bg-fog px-3 py-2.5 text-sm"><option value="">Tất cả trạng thái</option>{STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select><select value={filters.size} onChange={(e) => setFilter('size', e.target.value)} className="rounded-lg border border-chalk bg-fog px-3 py-2.5 text-sm"><option value="">Mọi kích thước</option><option value="ft20">20 feet</option><option value="ft40">40 feet</option><option value="ft45">45 feet</option></select><select value={filters.category} onChange={(e) => setFilter('category', e.target.value)} className="rounded-lg border border-chalk bg-fog px-3 py-2.5 text-sm"><option value="">Mọi phân loại</option>{['dry', 'reefer', 'tank', 'open_top', 'flat_rack'].map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select><button onClick={() => setFilters({ page: 1, limit: 10, search: '', status: '', size: '', category: '' })} className="rounded-lg border border-chalk px-4 py-2 text-sm font-bold text-graphite hover:bg-fog">Xóa lọc</button></div></div>
    <div className="overflow-hidden rounded-xl border border-chalk bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left"><thead className="border-b border-chalk bg-fog text-[11px] font-extrabold uppercase tracking-wider text-slate"><tr><th className="px-5 py-3.5">Container ID</th><th className="px-4 py-3.5">Size / Type</th><th className="px-4 py-3.5">Seal</th><th className="px-4 py-3.5">Cargo</th><th className="px-4 py-3.5">Trạng thái</th><th className="px-4 py-3.5">Booking</th><th className="px-4 py-3.5">Cập nhật</th><th className="px-5 py-3.5 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-chalk">{loading ? <tr><td colSpan="8" className="py-16 text-center text-sm text-slate">Đang tải danh sách Container...</td></tr> : !items.length ? <tr><td colSpan="8" className="py-16 text-center"><span className="material-symbols-outlined text-4xl text-chalk">inventory_2</span><p className="mt-2 text-sm font-semibold text-slate">Không tìm thấy Container phù hợp</p></td></tr> : items.map((container) => <tr key={container.id} className="hover:bg-orange-50/30"><td className="px-5 py-4"><button onClick={() => openDetail(container.id)} className="font-mono text-sm font-extrabold tracking-wide text-carbon hover:text-signal-orange">{container.containerNumber}</button><p className="mt-1 text-[11px] text-slate">{container.carrierName || 'Chưa gán carrier'}</p></td><td className="px-4 py-4"><p className="text-sm font-bold text-carbon">{displaySize(container.size)} · {container.typeCode}</p><p className="text-xs capitalize text-slate">{container.category?.replaceAll('_', ' ')}</p></td><td className="px-4 py-4 font-mono text-xs font-semibold text-graphite">{container.sealNumber || '—'}</td><td className="px-4 py-4 text-xs font-semibold capitalize text-graphite">{container.cargoType?.replaceAll('_', ' ')}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[container.status]}`}>{STATUS_LABELS[container.status]}</span></td><td className="px-4 py-4 text-sm font-bold text-graphite">{container.bookingCount}</td><td className="px-4 py-4 text-xs text-slate">{formatDate(container.updatedAt || container.createdAt)}</td><td className="px-5 py-4"><div className="flex justify-end gap-1"><button title="Xem chi tiết" onClick={() => openDetail(container.id)} className="flex h-8 w-8 items-center justify-center rounded-md text-slate hover:bg-fog hover:text-carbon"><span className="material-symbols-outlined text-lg">visibility</span></button>{canWrite && container.status !== 'canceled' && <button title="Cập nhật" onClick={() => edit(container)} className="flex h-8 w-8 items-center justify-center rounded-md text-slate hover:bg-orange-50 hover:text-signal-orange"><span className="material-symbols-outlined text-lg">edit</span></button>}{canDelete && container.status !== 'canceled' && <button title="Soft-delete" onClick={() => remove(container)} className="flex h-8 w-8 items-center justify-center rounded-md text-slate hover:bg-red-50 hover:text-red-600"><span className="material-symbols-outlined text-lg">delete</span></button>}</div></td></tr>)}</tbody></table></div><div className="flex flex-col items-center justify-between gap-3 border-t border-chalk px-5 py-3 sm:flex-row"><p className="text-xs text-slate">Trang {filters.page}/{Math.max(pagination.totalPages || 1, 1)} · {pagination.total || 0} kết quả</p><div className="flex gap-2"><button disabled={filters.page <= 1} onClick={() => setFilter('page', filters.page - 1)} className="rounded-md border border-chalk px-3 py-1.5 text-xs font-bold disabled:opacity-40">Trước</button><button disabled={filters.page >= pagination.totalPages} onClick={() => setFilter('page', filters.page + 1)} className="rounded-md border border-chalk px-3 py-1.5 text-xs font-bold disabled:opacity-40">Sau</button></div></div></div>
    {showForm && <ContainerFormModal container={formContainer} types={types} onClose={() => setShowForm(false)} onSaved={saved} />}
    {showDetail && <ContainerDetailModal detail={detail} loading={detailLoading} onClose={() => setShowDetail(false)} onEdit={edit} canWrite={canWrite} />}
  </div>
}
