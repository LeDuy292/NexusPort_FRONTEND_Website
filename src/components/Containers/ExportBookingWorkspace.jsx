import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import exportBookingService from '../../services/exportBookingService'
import { bookingService } from '../../services/bookingService'
import ContainerBookingForm from './ContainerBookingForm'
import BookingBatchWorkspace from './BookingBatchWorkspace'
import BookingRequestComposer from './BookingRequestComposer'

const input = 'w-full rounded-xl border border-chalk bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-500 disabled:bg-slate-50 disabled:text-slate-500'
const primary = 'rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50'
const secondary = 'rounded-xl border border-chalk bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const statusLabels = { Pending: 'Chờ hãng tàu duyệt', Approved: 'Đã duyệt đặt chỗ', ContainersDeclared: 'Đã khai container', GateIn: 'Đã có container vào cảng', Loaded: 'Đã xếp tàu', BlIssued: 'Đã phát hành B/L', Rejected: 'Hãng tàu từ chối', Cancelled: 'Đã hủy' }
const containerLabels = { Expected: 'Dự kiến', Declared: 'Đã khai', GateIn: 'Đã qua cổng', Loaded: 'Đã xếp tàu', Excluded: 'Bị loại khỏi chuyến', Rolled: 'Chuyển chuyến', Cancelled: 'Đã hủy' }
const siLabels = { None: 'Chưa nộp', Submitted: 'Đã nộp SI', Draft: 'Có draft B/L cần xác nhận', Confirmed: 'Đã xác nhận draft B/L', RevisionRequested: 'Hãng tàu yêu cầu sửa/nộp SI' }
const portLabels = { Pending: 'Chờ hãng tàu duyệt hồ sơ', WaitingContainers: 'Cảng chờ danh sách container', Accepted: 'Cảng đã nhận hồ sơ', Cancelled: 'Đã hủy' }
const cargoLabels = { general: 'Hàng bách hóa', reefer: 'Hàng lạnh', dangerous: 'Hàng nguy hiểm', dangerous_goods: 'Hàng nguy hiểm', oversized: 'Hàng quá khổ', perishable: 'Hàng dễ hư hỏng', overweight: 'Hàng quá tải' }
const time = value => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa có'
const expired = value => Boolean(value && new Date(value).getTime() <= Date.now())
const lockedContainer = row => ['GateIn', 'Loaded', 'Excluded', 'Rolled'].includes(row.status)
const errorText = error => {
  const data = error.response?.data
  const errors = data?.errors || data?.Errors
  return errors ? Object.values(errors).flat().join(' ') : data?.message || data?.Message || error.message || 'Không thể xử lý yêu cầu.'
}
const sourceKey = row => `${row.containerId}:${row.declarationId}`
const declaredRow = row => ({ containerId: row.containerId, declarationId: row.declarationId, sealNumber: (row.sealNumber || '').trim(), vgmKg: Number(row.vgmKg), targetTemperature: row.targetTemperature === '' || row.targetTemperature == null ? null : Number(row.targetTemperature), unNumber: row.unNumber || null, dgClass: row.dgClass || null, customsDocumentUrl: row.customsDocumentUrl || null })
const emptyOptions = { shippingLines: [], voyages: [], sources: [], containerTypes: [], companyName: '' }

function Field({ label, children }) {
  return <label className="block space-y-1.5 text-sm"><span className="font-semibold text-slate-700">{label}</span>{children}</label>
}
function Status({ value, labels = statusLabels }) {
  return <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold">{labels[value] || value || 'Chưa có'}</span>
}
function DetailValue({ label, children }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-800">{children || 'Chưa khai'}</dd></div>
}
function SiPreview({ value }) {
  if (!value) return null
  return <dl className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
    <DetailValue label="Người gửi hàng (Shipper)">{value.shipper}</DetailValue>
    <DetailValue label="Người nhận hàng (Consignee)">{value.consignee}</DetailValue>
    <DetailValue label="Bên được thông báo (Notify party)">{value.notifyParty}</DetailValue>
    <DetailValue label="Cảng đến">{value.destinationPort}</DetailValue>
    <DetailValue label="Mô tả hàng">{value.cargoDescription}</DetailValue>
    <DetailValue label="Số kiện">{value.packagesCount?.toLocaleString('vi-VN')}</DetailValue>
    <DetailValue label="Tổng khối lượng hàng (kg)">{value.grossWeightKg?.toLocaleString('vi-VN')}</DetailValue>
    <DetailValue label="Điều khoản cước / phát hành B/L">{`${value.freightTerms === 'Collect' ? 'Trả sau' : 'Trả trước'} · ${value.blType === 'TelexRelease' ? 'Telex release' : 'Bản gốc'}`}</DetailValue>
  </dl>
}

export default function ExportBookingWorkspace({ initialBookingId, initialSource, initialDirection, createRequest, onGateSaved }) {
  const [options, setOptions] = useState(emptyOptions)
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedId, setSelectedId] = useState(initialBookingId || '')
  const [detail, setDetail] = useState(null)
  const [section, setSection] = useState('containers')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showCreate, setShowCreate] = useState(!initialBookingId)
  const [direction, setDirection] = useState(initialDirection === 'Pickup' ? 'Pickup' : 'Dropoff')
  const [pickupBatch, setPickupBatch] = useState(false)
  const [combined, setCombined] = useState(false)
  const [editing, setEditing] = useState(null)
  const [rows, setRows] = useState([])
  const [sourceId, setSourceId] = useState('')
  const [si, setSi] = useState({})
  const [draftConfirmed, setDraftConfirmed] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')
  const [gateContext, setGateContext] = useState(null)
  const [uploadingKey, setUploadingKey] = useState('')
  const alive = useRef(true)
  const listRequest = useRef(0)
  const detailRequest = useRef(0)
  const mutationLock = useRef(false)

  useEffect(() => { alive.current = true; return () => { alive.current = false; detailRequest.current++; listRequest.current++ } }, [])
  useEffect(() => { if (initialBookingId) { setSelectedId(initialBookingId); setShowCreate(false) } }, [initialBookingId])
  useEffect(() => { if (createRequest) { setShowCreate(true); setSelectedId(''); setEditing(null) } }, [createRequest])

  const reloadOptions = useCallback(async () => {
    const result = await exportBookingService.getOptions()
    if (alive.current) setOptions({ ...emptyOptions, ...result })
  }, [])
  const reloadList = useCallback(async () => {
    const request = ++listRequest.current
    const result = await exportBookingService.getBookings({ page, pageSize: 10 })
    if (alive.current && request === listRequest.current) { setItems(result.items || []); setTotal(result.totalCount || 0) }
  }, [page])
  const applyDetail = value => {
    setDetail(value)
    setRows((value.containers || []).map(row => ({ ...row, vgmKg: row.vgmKg ?? '', targetTemperature: row.targetTemperature ?? '', customsDocumentUrl: row.customsDocumentUrl || '' })))
    setSi(value.si ? { ...value.si } : { shipper: value.companyName || '', consignee: '', notifyParty: '', cargoDescription: value.commodityDescription || '', packagesCount: '', grossWeightKg: '', freightTerms: 'Prepaid', blType: 'Original', destinationPort: value.voyage?.portOfDischarge || '' })
    setSourceId(''); setDraftConfirmed(false); setCancellationReason('')
  }
  const reloadDetail = useCallback(async id => {
    const request = ++detailRequest.current
    setDetailLoading(true)
    try {
      const result = await exportBookingService.getBooking(id)
      if (alive.current && request === detailRequest.current) applyDetail(result)
    } catch (error) {
      if (alive.current && request === detailRequest.current) throw error
    } finally { if (alive.current && request === detailRequest.current) setDetailLoading(false) }
  }, [])

  useEffect(() => {
    setLoading(true); setError('')
    Promise.all([reloadOptions(), reloadList()]).catch(err => { if (alive.current) setError(errorText(err)) })
      .finally(() => { if (alive.current) setLoading(false) })
  }, [reloadOptions, reloadList])
  useEffect(() => {
    setDetail(null); setGateContext(null); setError(''); setNotice('')
    if (selectedId) reloadDetail(selectedId).catch(err => { if (alive.current) setError(errorText(err)) })
    else detailRequest.current++
  }, [selectedId, reloadDetail])

  const mutate = async (operation, success) => {
    if (mutationLock.current) return
    mutationLock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const result = await operation()
      if (!alive.current) return
      if (result?.id) { applyDetail(result); setSelectedId(result.id); setShowCreate(false) }
      if (alive.current) setNotice(success)
      await Promise.all([reloadList(), reloadOptions()]).catch(err => {
        if (alive.current) setError(`Thao tác đã được lưu. Chưa tải lại được danh sách: ${errorText(err)}`)
      })
    } catch (err) {
      if (alive.current) {
        setError(errorText(err))
        if ([409, 412].includes(err.response?.status) && selectedId) await reloadDetail(selectedId).catch(() => {})
      }
    } finally { mutationLock.current = false; if (alive.current) setBusy(false) }
  }
  const patchRow = (key, patch) => setRows(current => current.map(row => sourceKey(row) === key ? { ...row, ...patch } : row))
  const addSource = () => {
    const source = options.sources.find(row => sourceKey(row) === sourceId)
    if (!source || rows.some(row => row.containerId === source.containerId)) return
    setRows(current => [...current, { ...source, vgmKg: '', targetTemperature: '', unNumber: '', dgClass: '', customsDocumentUrl: '', status: 'Expected' }]); setSourceId('')
  }
  const uploadCustoms = async (row, event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploadingKey) return
    const key = sourceKey(row)
    setUploadingKey(key); setError('')
    try {
      const uploaded = await bookingService.uploadDocumentFile(file)
      const url = uploaded.fileUrl || uploaded.url
      if (!url) throw new Error('Máy chủ chưa trả đường dẫn tệp hải quan.')
      if (alive.current) patchRow(key, { customsDocumentUrl: url, customsFileName: uploaded.fileName || file.name })
    } catch (err) { if (alive.current) setError(errorText(err)) }
    finally { if (alive.current) setUploadingKey('') }
  }
  const saveContainers = event => {
    event.preventDefault()
    mutate(() => exportBookingService.declareContainers(detail.id, { expectedVersion: detail.version, containers: rows.map(declaredRow) }), 'Đã lưu danh sách container và kết quả tiếp nhận của cảng.')
  }
  const submitSi = event => {
    event.preventDefault()
    mutate(() => exportBookingService.submitSi(detail.id, { ...si, expectedVersion: detail.version, packagesCount: Number(si.packagesCount), grossWeightKg: Number(si.grossWeightKg) }), 'Đã gửi Shipping Instruction đến hãng tàu.')
  }
  const gateSaved = async result => {
    onGateSaved?.(result)
    await Promise.all([reloadList(), reloadOptions(), ...(selectedId ? [reloadDetail(selectedId)] : [])]).catch(err => { if (alive.current) setError(errorText(err)) })
  }

  if (gateContext) return <div className="space-y-4">
    <button type="button" className={secondary} onClick={() => setGateContext(null)}>← Về Booking hãng tàu {gateContext.booking.bookingNumber}</button>
    {gateContext.batch
      ? <BookingBatchWorkspace key={gateContext.booking.id} exportContext={gateContext} onSaved={gateSaved} />
      : <ContainerBookingForm key={`${gateContext.booking.id}:${gateContext.container.id}`} exportContext={gateContext} onSaved={gateSaved} onClose={() => setGateContext(null)} />}
  </div>

  const voyage = detail?.voyage
  const availableSources = options.sources.filter(source => source.containerTypeCode === detail?.containerTypeCode && !rows.some(row => row.containerId === source.containerId))
  const editableContainers = detail && !detail.submission && ['Approved', 'ContainersDeclared', 'GateIn'].includes(detail.status) && detail.siStatus !== 'Confirmed' && !expired(voyage?.vgmCutoff) && !expired(voyage?.cyCutoff)
  const editableSi = detail && ['Approved', 'ContainersDeclared', 'GateIn', 'Loaded'].includes(detail.status) && detail.siStatus !== 'Confirmed' && (!expired(voyage?.siCutoff) || detail.siStatus === 'RevisionRequested')
  const canCancel = detail && !['Cancelled', 'Rejected', 'Loaded', 'BlIssued', 'GateIn'].includes(detail.status) && !detail.containers?.some(lockedContainer)
  const containersDirty = detail && JSON.stringify(rows.map(declaredRow)) !== JSON.stringify((detail.containers || []).map(declaredRow))
  const gateContainers = (detail?.containers || []).filter(row => !lockedContainer(row) && !row.gateBookingId)
  const gateGroupCounts = gateContainers.reduce((counts, row) => ({ ...counts, [row.cargoType]: (counts[row.cargoType] || 0) + 1 }), {})
  const batchAvailable = !detail?.submission && detail?.portStatus === 'Accepted' && !expired(voyage?.cyCutoff) && Object.values(gateGroupCounts).some(count => count >= 2)
  const pickupModeSelector = <fieldset className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5" disabled={busy}>
    <legend className="px-2 text-sm font-extrabold text-slate-800">Hình thức Booking</legend>
    <div className={`grid grid-cols-1 gap-3 ${direction === 'Pickup' ? 'lg:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {[
        ...(direction === 'Pickup' ? [
          { value: 'single', title: 'Nhận một container', icon: 'local_shipping', description: 'Đặt một lịch hẹn với xe, moóc và tài xế cho một container.' },
          { value: 'batch', title: 'Nhận nhiều container theo lô', icon: 'view_list', description: 'Từ 2–50 container cùng loại hàng và bộ chứng từ. Mỗi container có lịch xe riêng.' },
        ] : [{ value: 'standard', title: 'Giao container riêng / theo lô', icon: 'local_shipping', description: 'Chọn một container để đặt riêng; từ 2 container cùng loại hàng để lập lô.' }]),
        { value: 'combined', title: 'Chuyến xe kết hợp hai chiều', icon: 'sync_alt', description: 'Một xe giao một container vào bãi rồi nhận một container khác ra cảng trong cùng chuyến.' },
      ].map(mode => {
        const selected = mode.value === (combined ? 'combined' : direction === 'Pickup' ? pickupBatch ? 'batch' : 'single' : 'standard')
        return <label key={mode.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors focus-within:ring-2 focus-within:ring-orange-400 focus-within:ring-offset-2 ${selected ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-300'}`}>
          <span aria-hidden="true" className={`material-symbols-outlined flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{mode.icon}</span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">{mode.title}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{mode.description}</span></span>
          <input type="radio" name="pickup-booking-mode" aria-label={mode.title} className="mt-1 h-4 w-4 shrink-0 accent-orange-600" checked={selected} onChange={() => {
            setCombined(mode.value === 'combined')
            if (mode.value === 'combined') { setDirection('Dropoff'); setShowCreate(true); if (!editing) setSelectedId('') }
            else setPickupBatch(mode.value === 'batch')
          }} />
        </label>
      })}
    </div>
  </fieldset>

  return <section className="space-y-5" aria-label="Booking xuất khẩu với hãng tàu">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-extrabold text-slate-900">Booking khách hàng</h2><p className="mt-1 text-sm text-slate-500">Chọn container, tối ưu lịch xe và bổ sung chứng từ trong một hồ sơ. Hãng tàu duyệt trước khi chuyển sang cảng xử lý.</p></div>
      <div className="flex gap-2"><button type="button" className={secondary} disabled={busy || loading} onClick={() => { setError(''); Promise.all([reloadOptions(), reloadList(), ...(selectedId ? [reloadDetail(selectedId)] : [])]).catch(err => setError(errorText(err))) }}>Làm mới</button>
        <button type="button" className={secondary} disabled={busy || loading} onClick={() => { setShowCreate(false); setEditing(null); setCombined(false); setDirection('Dropoff') }}>Hồ sơ đã gửi ({total})</button>
        <button type="button" className={primary} disabled={busy} onClick={() => { setShowCreate(true); setEditing(null); setSelectedId(''); setNotice(''); setError('') }}>Tạo Booking mới</button></div>
    </div>
    {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm whitespace-pre-line text-rose-800">{error}</div>}
    {notice && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
    {loading && <p role="status" className="text-sm text-slate-500">Đang tải Booking và lịch chuyến từ database…</p>}
    {!loading && !options.voyages.length && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Chưa có lịch chuyến do hãng tàu công bố. Hãng tàu cần tạo chuyến và các hạn CY, VGM, SI trước khi công ty gửi yêu cầu đặt chỗ.</div>}

    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-chalk bg-white p-4">
      <span className="text-sm font-bold">Nghiệp vụ</span>
      <button type="button" disabled={busy} className={direction === 'Dropoff' ? primary : secondary} onClick={() => { setDirection('Dropoff'); setCombined(false) }}>Giao container xuất khẩu</button>
      <button type="button" disabled={busy} className={direction === 'Pickup' ? primary : secondary} onClick={() => { setDirection('Pickup'); setCombined(false); setEditing(null); setSelectedId(''); setShowCreate(true) }}>Nhận container nhập khẩu</button>
    </div>
    {direction === 'Pickup' && <div className="space-y-4">
      {pickupBatch ? <BookingBatchWorkspace pickupModeSelector={pickupModeSelector} onExportBooking={() => setDirection('Dropoff')} onSaved={gateSaved} /> : <ContainerBookingForm pickupModeSelector={pickupModeSelector} onExportBooking={() => setDirection('Dropoff')} onSaved={gateSaved} onClose={() => setDirection('Dropoff')} />}
    </div>}
    {direction === 'Dropoff' && showCreate && !loading && <BookingRequestComposer key={editing ? `${editing.id}:${editing.version}:${combined}` : `new:${createRequest || 0}:${combined}`} options={options} initialSource={initialSource} existing={editing} onBusyChange={setBusy} combined={combined} modeSelector={pickupModeSelector}
      onClose={() => { setShowCreate(false); setEditing(null) }} onSubmitted={async saved => {
        applyDetail(saved); setSelectedId(saved.id); setShowCreate(false); setEditing(null);
        setNotice('Đã gửi hồ sơ Booking cho hãng tàu. Lịch xe đang là đề xuất, chưa được cảng chấp nhận.');
        await Promise.all([reloadList(), reloadOptions()]).catch(cause => setError(`Hồ sơ đã gửi. Chưa tải lại được danh sách: ${errorText(cause)}`));
      }} />}

    {direction === 'Dropoff' && !showCreate && <div className="grid grid-cols-1 gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="space-y-2 rounded-2xl border border-chalk bg-white p-3">
        <h3 className="px-2 py-2 text-sm font-bold">Booking công ty ({total})</h3>
        {!loading && !items.length && <p className="p-2 text-sm text-slate-500">Chưa có hồ sơ xuất khẩu. Chọn “Tạo Booking mới” để bắt đầu.</p>}
        {items.map(item => <button type="button" key={item.id} disabled={busy} onClick={() => { setSelectedId(item.id); setShowCreate(false); setSection('containers') }} className={`w-full rounded-xl border p-3 text-left ${selectedId === item.id ? 'border-orange-400 bg-orange-50' : 'border-slate-100 hover:bg-slate-50'}`}>
          <p className="font-bold text-sm">{item.bookingNumber}</p><p className="mt-1 text-xs text-slate-500">{item.shippingLineName} · {item.quantity} × {item.containerTypeCode}</p><p className="my-2 text-xs">{item.voyage?.voyageNumber || item.voyageNumber}</p><Status value={item.status} />
        </button>)}
        {total > 10 && <div className="flex items-center justify-between pt-2"><button type="button" className={secondary} disabled={busy || page <= 1} onClick={() => setPage(value => value - 1)}>Trước</button><span className="text-xs">Trang {page}</span><button type="button" className={secondary} disabled={busy || page * 10 >= total} onClick={() => setPage(value => value + 1)}>Sau</button></div>}
      </aside>
      <div className="min-w-0 space-y-4">
        {detailLoading && <p role="status" className="text-sm text-slate-500">Đang tải chi tiết Booking…</p>}
        {!detail && !detailLoading && <div className="rounded-2xl border border-chalk bg-white p-7 text-sm text-slate-500">Chọn một Booking để khai container, nộp SI hoặc theo dõi tiến độ.</div>}
        {detail && !detailLoading && <>
          <div className="rounded-2xl border border-chalk bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-extrabold">{detail.bookingNumber}</h3><Status value={detail.status} /></div>
            <dl className="grid grid-cols-2 gap-4"><DetailValue label="Hãng tàu">{detail.shippingLineName}</DetailValue><DetailValue label="Tàu / chuyến">{`${voyage?.vesselName || ''} · ${voyage?.voyageNumber || ''}`}</DetailValue><DetailValue label="Hành trình">{`${voyage?.portOfLoading || ''} → ${voyage?.portOfDischarge || ''}`}</DetailValue><DetailValue label="Số lượng được đặt">{`${detail.quantity} × ${detail.containerTypeCode}`}</DetailValue></dl>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{[['VGM', voyage?.vgmCutoff], ['CY', voyage?.cyCutoff], ['SI', voyage?.siCutoff]].map(([label, value]) => <div key={label} className={`rounded-xl border p-3 text-xs ${expired(value) ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-slate-50'}`}><p className="font-bold">{label} cut-off {expired(value) ? '· Đã hết hạn' : ''}</p><p className="mt-1">{time(value)}</p></div>)}</div>
            <p className="text-xs text-slate-500">Giờ Việt Nam · Nhận container từ {time(voyage?.receiveFrom)} · ETD {time(voyage?.etd)}</p>
            <div className="flex flex-wrap gap-2"><Status value={detail.portStatus} labels={portLabels} /><Status value={detail.siStatus} labels={siLabels} />{detail.blNumber && <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">B/L: {detail.blNumber}</span>}</div>
            {detail.submission && <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3 text-sm">
              <p className="font-bold">{detail.status === 'Pending' ? 'Đã gửi hãng tàu · Chờ kiểm tra và duyệt hồ sơ' : detail.status === 'Rejected' ? 'Hãng tàu trả hồ sơ · Kiểm tra lý do trong lịch sử và gửi lại' : 'Hồ sơ đã được chuyển sang cảng · Theo dõi kết quả duyệt lịch xe'}</p>
              {(detail.submission.delivery?.trips || []).map(trip => <div key={trip.bookingId} className="flex flex-wrap items-center justify-between gap-2"><span>{trip.bookingCode} · {time(trip.appointmentStart)} · {trip.vehiclePlate} · {trip.driverName} · Moóc {trip.trailerNumber}</span><Link className="font-bold text-teal-700 underline" to={`/booking?bookingId=${trip.bookingId}`}>Xem lịch xe</Link></div>)}
              {!detail.submission.delivery && <div className="space-y-2">{(detail.submission.trips || []).map(trip => {
                const source = detail.containers.find(row => row.containerId === trip.containerId), profile = detail.submission.fleet?.find(row => row.containerId === trip.containerId)
                return <p key={trip.containerId}>{source?.containerNumber} · {time(trip.appointmentStart)} – {time(trip.appointmentEnd)} · {profile?.vehicle.plateNumber} · {profile?.driver.fullName} · Moóc {trip.trailerNumber}</p>
              })}</div>}
              {detail.submission.pickup && <p className="font-semibold text-blue-900">Chuyến hai chiều · Giao {detail.containers[0]?.containerNumber} → Nhận {detail.submission.pickupSource?.containerNumber || 'container theo hồ sơ'} · dùng chung xe, moóc và tài xế.</p>}
              {['Pending', 'Rejected'].includes(detail.status) && <button type="button" className={secondary} onClick={() => { setEditing(detail); setCombined(Boolean(detail.submission.pickup)); setShowCreate(true) }}>Sửa hồ sơ và gửi lại</button>}
            </div>}
          </div>
          <nav aria-label="Chi tiết Booking xuất khẩu" className="flex flex-wrap gap-2">{[['containers', 'Container & lịch xe'], ['si', 'SI & draft B/L'], ['history', 'Lịch sử']].map(([key, label]) => <button type="button" key={key} className={section === key ? primary : secondary} disabled={busy} onClick={() => setSection(key)}>{label}</button>)}</nav>

          {section === 'containers' && <form onSubmit={saveContainers} className="space-y-4 rounded-2xl border border-chalk bg-white p-5">
            <div><h4 className="font-bold">Danh sách container ({rows.length}/{detail.quantity})</h4><p className="mt-1 text-sm text-slate-500">Chọn bản khai của công ty. Seal được lấy từ hồ sơ; VGM phải nhập từ kết quả cân đã xác minh, không tự dùng khối lượng bản khai.</p></div>
            {batchAvailable && <button type="button" className={primary} disabled={busy || containersDirty} onClick={() => setGateContext({ booking: detail, containers: gateContainers, batch: true })}>Đặt lịch xe theo lô</button>}
            {containersDirty && detail.portStatus === 'Accepted' && <p className="text-xs text-amber-800">Lưu danh sách container đã sửa trước khi đặt lịch xe.</p>}
            {detail.status === 'Pending' && <p className="text-sm text-amber-800">Chờ hãng tàu duyệt đặt chỗ trước khi khai số container.</p>}
            {['Approved', 'ContainersDeclared', 'GateIn'].includes(detail.status) && !editableContainers && <p role="status" className="text-sm text-amber-800">{detail.siStatus === 'Confirmed' ? 'Draft B/L đã xác nhận. Cần hãng tàu yêu cầu sửa trước khi thay đổi hồ sơ container.' : 'Đã quá hạn khai VGM hoặc CY cut-off. Liên hệ hãng tàu để xử lý ngoại lệ hoặc chuyển chuyến.'}</p>}
            {editableContainers && <div className="flex flex-wrap items-end gap-2"><Field label="Container từ bản khai"><select aria-label="Container từ bản khai" className={input} value={sourceId} disabled={busy || rows.length >= detail.quantity} onChange={e => setSourceId(e.target.value)}><option value="">Chọn container {detail.containerTypeCode}</option>{availableSources.map(source => <option key={sourceKey(source)} value={sourceKey(source)}>{source.containerNumber} · {source.containerTypeCode} · {cargoLabels[source.cargoType] || source.cargoType}</option>)}</select></Field><button type="button" className={secondary} disabled={busy || !sourceId || rows.length >= detail.quantity} onClick={addSource}>Thêm container</button></div>}
            {editableContainers && !availableSources.length && <p className="text-xs text-slate-500">Chưa có bản khai khác phù hợp loại {detail.containerTypeCode}. <Link to="/transport/cargo-declarations" className="font-semibold underline">Mở Khai báo container</Link></p>}
            {rows.map(row => {
              const key = sourceKey(row), frozen = lockedContainer(row) || Boolean(row.gateBookingId), reefer = row.cargoType === 'reefer', dg = ['dangerous', 'dangerous_goods'].includes(row.cargoType)
              const gateAllowed = detail.portStatus === 'Accepted' && !expired(voyage?.cyCutoff) && !frozen && !row.gateBookingId && !containersDirty
              return <article key={key} className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{row.containerNumber} <span className="ml-2 text-xs font-normal text-slate-500">{row.containerTypeCode} · {cargoLabels[row.cargoType] || row.cargoType}</span></p><Status value={row.status} labels={containerLabels} /></div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Số seal *"><input aria-label={`Seal ${row.containerNumber}`} className={input} maxLength={100} required value={row.sealNumber || ''} disabled={!editableContainers || frozen || busy} onChange={e => patchRow(key, { sealNumber: e.target.value.toUpperCase() })} /></Field><Field label="VGM đã xác minh (kg) *"><input aria-label={`VGM ${row.containerNumber}`} className={input} type="number" min="0.001" step="0.001" required value={row.vgmKg} disabled={!editableContainers || frozen || busy} onChange={e => patchRow(key, { vgmKg: e.target.value })} /></Field>
                  {reefer && <Field label="Nhiệt độ bảo quản (°C) *"><input className={input} aria-label={`Nhiệt độ ${row.containerNumber}`} type="number" step="0.1" required value={row.targetTemperature ?? ''} disabled={!editableContainers || frozen || busy} onChange={e => patchRow(key, { targetTemperature: e.target.value })} /></Field>}
                  {dg && <><Field label="Mã UN *"><input className={input} required maxLength={20} value={row.unNumber || ''} disabled={!editableContainers || frozen || busy} onChange={e => patchRow(key, { unNumber: e.target.value })} /></Field><Field label="Phân lớp hàng nguy hiểm *"><input className={input} required maxLength={30} value={row.dgClass || ''} disabled={!editableContainers || frozen || busy} onChange={e => patchRow(key, { dgClass: e.target.value })} /></Field></>}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs"><span className={row.customsCleared ? 'text-emerald-700' : 'text-amber-800'}>{row.customsCleared ? 'Đã xác nhận thông quan' : 'Chưa được cảng xác nhận thông quan'}</span>{row.customsDocumentUrl && <a href={row.customsDocumentUrl} target="_blank" rel="noreferrer" className="font-semibold text-teal-700 underline">{row.customsFileName || 'Hồ sơ hải quan'}</a>}
                  {editableContainers && !frozen && <label className="cursor-pointer font-semibold text-teal-700 underline">{uploadingKey === key ? 'Đang tải…' : 'Tải hồ sơ hải quan'}<input className="sr-only" aria-label={`Hồ sơ hải quan ${row.containerNumber}`} type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy || Boolean(uploadingKey)} onChange={e => uploadCustoms(row, e)} /></label>}
                </div><p className="text-xs text-slate-500">Tải tệp không tự xác nhận thông quan. Cảng kiểm tra kết quả trước khi tiếp nhận tại cổng.</p>
                <div className="flex flex-wrap gap-2">{!detail.submission && row.id && <button type="button" className={primary} disabled={busy || !gateAllowed} onClick={() => setGateContext({ booking: detail, container: row })}>Đặt lịch xe giao container</button>}{row.gateBookingId && <Link className={`${secondary} inline-block`} to={`/booking?bookingId=${encodeURIComponent(row.gateBookingId)}`}>Xem lịch xe đã đặt</Link>}{editableContainers && !frozen && <button type="button" className={`${secondary} text-rose-700`} disabled={busy} onClick={() => setRows(current => current.filter(item => sourceKey(item) !== key))}>Bỏ khỏi danh sách</button>}</div>
              </article>
            })}
            {editableContainers && <button type="submit" className={primary} disabled={busy || Boolean(uploadingKey) || !rows.length}>{busy ? 'Đang lưu…' : 'Gửi danh sách container & VGM'}</button>}
          </form>}

          {section === 'si' && <div className="space-y-4 rounded-2xl border border-chalk bg-white p-5">
            <div><h4 className="font-bold">Shipping Instruction (SI)</h4><p className="mt-1 text-sm text-slate-500">SI có hạn riêng. Có thể nộp trước khi container vào cảng; không dùng tổng VGM thay cho khối lượng hàng.</p></div>
            {editableSi ? <form onSubmit={submitSi} className="space-y-4"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[['shipper', 'Người gửi hàng (Shipper) *'], ['consignee', 'Người nhận hàng (Consignee) *'], ['notifyParty', 'Bên được thông báo (Notify party)']].map(([key, label]) => <Field key={key} label={label}><textarea className={input} required={key !== 'notifyParty'} maxLength={2000} value={si[key] || ''} disabled={busy} onChange={e => setSi(current => ({ ...current, [key]: e.target.value }))} /></Field>)}
              <Field label="Cảng đến"><input className={input} readOnly value={voyage?.portOfDischarge || ''} /></Field>
              <div className="sm:col-span-2"><Field label="Mô tả hàng hóa *"><textarea className={input} required maxLength={4000} value={si.cargoDescription || ''} disabled={busy} onChange={e => setSi(current => ({ ...current, cargoDescription: e.target.value }))} /></Field></div>
              <Field label="Số kiện *"><input className={input} type="number" required min="1" step="1" value={si.packagesCount ?? ''} disabled={busy} onChange={e => setSi(current => ({ ...current, packagesCount: e.target.value }))} /></Field><Field label="Tổng khối lượng hàng (kg) *"><input className={input} type="number" required min="0.001" step="0.001" value={si.grossWeightKg ?? ''} disabled={busy} onChange={e => setSi(current => ({ ...current, grossWeightKg: e.target.value }))} /></Field>
              <Field label="Điều khoản cước"><select className={input} value={si.freightTerms || 'Prepaid'} disabled={busy} onChange={e => setSi(current => ({ ...current, freightTerms: e.target.value }))}><option value="Prepaid">Trả trước (Prepaid)</option><option value="Collect">Trả sau (Collect)</option></select></Field><Field label="Yêu cầu phát hành B/L"><select className={input} value={si.blType || 'Original'} disabled={busy} onChange={e => setSi(current => ({ ...current, blType: e.target.value }))}><option value="Original">Bản gốc</option><option value="TelexRelease">Telex release</option></select></Field>
            </div><button type="submit" className={primary} disabled={busy}>{busy ? 'Đang gửi…' : detail.si ? 'Gửi SI cập nhật' : 'Nộp SI'}</button></form> : <><SiPreview value={detail.si} /><p className="text-sm text-slate-600">{detail.siStatus === 'Confirmed' ? 'SI và draft B/L đã xác nhận được khóa. Liên hệ hãng tàu nếu cần yêu cầu sửa.' : expired(voyage?.siCutoff) ? 'Đã hết SI cut-off. Liên hệ hãng tàu để xử lý ngoại lệ.' : 'Hãng tàu cần duyệt đặt chỗ trước khi tiếp nhận SI.'}</p></>}
            {detail.siStatus === 'Draft' && detail.draft && <div className="space-y-4 border-t border-slate-200 pt-5"><h4 className="font-bold">Kiểm tra draft B/L · phiên bản {detail.draftVersion}</h4><SiPreview value={detail.draft.si} /><p className="text-sm">Container trên draft: {(detail.draft.containers || []).map(row => `${row.containerNumber} (Seal ${row.sealNumber})`).join(', ') || 'Chưa có'}</p><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={draftConfirmed} disabled={busy} onChange={e => setDraftConfirmed(e.target.checked)} /><span>Tôi đã kiểm tra người gửi, người nhận, hàng hóa và danh sách container trên draft B/L.</span></label><button type="button" className={primary} disabled={busy || !draftConfirmed || !detail.draftVersion} onClick={() => mutate(() => exportBookingService.confirmDraft(detail.id, { expectedVersion: detail.version, draftVersion: detail.draftVersion }), 'Đã xác nhận draft B/L. Hãng tàu sẽ phát hành khi đủ điều kiện.')}>Xác nhận draft B/L</button></div>}
            {detail.si?.freightTerms === 'Prepaid' && <p className="text-sm text-slate-600">Cước hãng tàu trả trước: {detail.freightPaid ? 'Đã ghi nhận thanh toán' : 'Chưa ghi nhận thanh toán'}. Phí dịch vụ cảng của lịch xe được theo dõi riêng.</p>}
          </div>}

          {section === 'history' && <div className="space-y-3 rounded-2xl border border-chalk bg-white p-5"><h4 className="font-bold">Lịch sử xử lý</h4>{!(detail.history || []).length && <p className="text-sm text-slate-500">Chưa có sự kiện.</p>}{(detail.history || []).map(event => <div key={event.id} className="border-l-2 border-orange-200 pl-4"><p className="text-xs text-slate-500">{time(event.createdAt)}</p><p className="text-sm font-semibold">{event.description || event.event}</p></div>)}</div>}
          {canCancel && <form onSubmit={event => { event.preventDefault(); mutate(() => exportBookingService.cancelBooking(detail.id, { expectedVersion: detail.version, reason: cancellationReason }), 'Đã hủy Booking xuất khẩu.') }} className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4"><div className="min-w-0 flex-1"><Field label="Lý do hủy Booking"><input className={input} required maxLength={1000} value={cancellationReason} disabled={busy} onChange={e => setCancellationReason(e.target.value)} /></Field></div><button type="submit" className={`${secondary} text-rose-700`} disabled={busy || !cancellationReason.trim()}>Hủy Booking hãng tàu</button></form>}
        </>}
      </div>
    </div>}
  </section>
}
