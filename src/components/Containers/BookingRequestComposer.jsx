import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import exportBookingService from '../../services/exportBookingService'
import { bookingService } from '../../services/bookingService'
import { exportBookingWindow, sourceOperation, suggestedBookingWindow } from '../../features/booking-dispatch/bookingPlanning'
import { cargoLabels, sourceKey, submissionTrip, buildSubmission, tripFromSubmission, availableForTrip } from '../../features/booking-dispatch/unifiedBooking'
import BookingFleetDetails from './BookingFleetDetails'
import BookingSourcePicker from './BookingSourcePicker'

const input = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50'
const button = 'rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50'
const errorText = error => {
  const data = error.response?.data, errors = data?.errors || data?.Errors
  return errors ? Object.values(errors).flat().join(' ') : data?.message || data?.Message || error.message
}
const documentNames = { DeliveryOrder: 'Lệnh giao hàng (D/O hoặc eDO)', BillOfLading: 'Vận đơn đường biển (B/L)', CustomsDeclaration: 'Tờ khai hải quan xuất khẩu', VgmCertificate: 'Phiếu xác nhận khối lượng (VGM)', ReeferTemperatureInstructions: 'Chỉ dẫn bảo quản container lạnh', DangerousGoodsDeclaration: 'Khai báo hàng nguy hiểm (IMO)' }
function Field({ label, children }) { return <label className="block min-w-0 space-y-1 text-sm"><span className="font-semibold text-slate-700">{label}</span>{children}</label> }
const emptyPlan = { trips: [] }
const palette = ['border-teal-200 bg-teal-50', 'border-sky-200 bg-sky-50', 'border-violet-200 bg-violet-50', 'border-amber-200 bg-amber-50']
const groupSelectionSources = (rows, trips) => {
  const selected = new Map(trips.map(trip => [trip.containerId, sourceKey(trip)])), seen = new Set()
  return rows.filter(source => {
    if (seen.has(source.containerId) || (selected.has(source.containerId) && selected.get(source.containerId) !== sourceKey(source))) return false
    seen.add(source.containerId)
    return true
  })
}

export default function BookingRequestComposer({ options, sourcesLoading = false, sourcesError = false, initialSource, existing, onSubmitted, onClose, onBusyChange, combined = false, modeSelector }) {
  const initial = existing?.submission
  const [shippingLineId, setShippingLineId] = useState(initial?.shippingLineId || (options.shippingLines.length === 1 ? options.shippingLines[0].id : ''))
  const [voyageId, setVoyageId] = useState(initial?.voyageId || '')
  const [trips, setTrips] = useState(() => (combined ? (initial?.trips || []).slice(0, 1) : initial?.trips || []).map(trip => tripFromSubmission(trip, existing.containers.find(row => row.containerId === trip.containerId))))
  const [description, setDescription] = useState(initial?.description || '')
  const [documents, setDocuments] = useState(initial?.sharedDocuments || [])
  const [confirmed, setConfirmed] = useState(false)
  const [plan, setPlan] = useState(emptyPlan)
  const [plannedKey, setPlannedKey] = useState('')
  const [planning, setPlanning] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState('')
  const [error, setError] = useState('')
  const [requirements, setRequirements] = useState([])
  const [pickup, setPickup] = useState(() => initial?.pickup ? { ...initial.pickupSource, ...initial.pickup } : null)
  const [pickupRequirements, setPickupRequirements] = useState([])
  const [globalWindow, setGlobalWindow] = useState(() => initial?.trips?.length ? suggestedBookingWindow(initial.trips[0]) : { appointmentDate: '', startTime: '', endTime: '' })
  const [showProfiles, setShowProfiles] = useState('')
  const [expandedGroups, setExpandedGroups] = useState(() => new Set())
  const groupId = useId()
  useEffect(() => { onBusyChange?.(sending || Boolean(uploading)); return () => onBusyChange?.(false) }, [sending, uploading, onBusyChange])
  const version = useRef(0), alive = useRef(true), submitLock = useRef(false), attempt = useRef(null), optimizeRef = useRef(null)
  const appliedVoyage = useRef(initial?.voyageId || ''), appliedSource = useRef(Boolean(initial))
  useEffect(() => { const requests = version; alive.current = true; return () => { alive.current = false; requests.current++ } }, [])
  const voyage = options.voyages.find(row => row.id === voyageId)
  const voyages = useMemo(() => options.voyages.filter(row => row.shippingLineId === shippingLineId), [options.voyages, shippingLineId])
  const sources = useMemo(() => [...new Map([...options.sources, ...(existing?.containers || [])].map(row => [sourceKey(row), row])).values()], [options.sources, existing])
  const groups = [...sources.reduce((map, row) => { if (!map.has(row.cargoType)) map.set(row.cargoType, []); map.get(row.cargoType).push(row); return map }, new Map())]
  const availableContainerCount = new Set(options.sources.map(source => source.containerId)).size
  const allGroupsExpanded = groups.length > 0 && groups.every(([type]) => expandedGroups.has(type))
  const cargo = trips[0]?.cargoType
  const pickupCargo = pickup?.cargoType
  const invalidate = useCallback(() => { version.current++; setPlannedKey(''); setPlan(emptyPlan); setError('') }, [])
  useEffect(() => {
    if (!voyage && voyages.length === 1) setVoyageId(voyages[0].id)
  }, [voyage, voyages])
  useEffect(() => {
    if (!voyage || appliedVoyage.current === voyage.id) return
    appliedVoyage.current = voyage.id
    const window = exportBookingWindow(voyage)
    if (window) { setGlobalWindow(window); setTrips(current => current.map(trip => ({ ...trip, ...window }))); invalidate() }
  }, [voyage, invalidate])
  useEffect(() => {
    if (!initialSource || trips.length || appliedSource.current) return
    const source = sources.find(row => row.containerId === initialSource.containerId && (!initialSource.declarationId || row.declarationId === initialSource.declarationId))
    if (source) { appliedSource.current = true; setTrips([submissionTrip(source, globalWindow)]) }
  }, [sources, initialSource, trips.length, globalWindow])
  useEffect(() => {
    let live = true
    setRequirements([])
    if (cargo) bookingService.getOperationRequirements({ operationType: 'Export', cargoStatus: 'Loaded', cargoType: sourceOperation({ cargoType: cargo }).cargoType })
      .then(specs => { if (live) setRequirements(specs.filter(spec => spec.documentType !== 'CarrierBookingReference').map(spec => ({ ...spec, isMandatory: spec.isMandatory && spec.documentType !== 'VgmCertificate' }))) })
      .catch(cause => { if (live) setError(errorText(cause)) })
    return () => { live = false }
  }, [cargo])
  useEffect(() => {
    let live = true
    setPickupRequirements([])
    if (combined && pickupCargo) bookingService.getOperationRequirements({ operationType: 'Import', cargoStatus: 'Loaded', cargoType: sourceOperation({ cargoType: pickupCargo }).cargoType })
      .then(specs => { if (live) setPickupRequirements(specs) })
      .catch(cause => { if (live) setError(errorText(cause)) })
    return () => { live = false }
  }, [combined, pickupCargo])
  const payload = () => buildSubmission({ shippingLineId, voyageId, description, trips, sharedDocuments: documents,
    sharedDocumentsConfirmed: confirmed, bookingId: existing?.id, expectedVersion: existing?.version, pickup: combined ? pickup : undefined })
  const shapeFor = rows => JSON.stringify({ shippingLineId, voyageId,
    ...(combined ? { pickup: { containerId: pickup?.containerId || '', yardCode: (pickup?.yardCode || '').trim().toUpperCase() } } : {}),
    trips: rows.map(trip => ({ id: sourceKey(trip), date: trip.appointmentDate, start: trip.startTime, end: trip.endTime })) })
  const shapeKey = shapeFor(trips)
  const currentPlan = plannedKey === shapeKey ? plan : emptyPlan
  const optimize = async () => {
    const requested = ++version.current
    setError(''); setPlanning(true)
    try {
      if (!trips.length || !voyage) throw new Error('Chọn hãng tàu, chuyến tàu và container để tối ưu.')
      if (combined && (!pickup?.containerId || !pickup.yardCode)) throw new Error('Chọn container Nhận và mã nhận hợp lệ cho chuyến hai chiều.')
      const result = await exportBookingService.planSubmission({ ...payload(), optimizeSchedule: true })
      if (!alive.current || requested !== version.current) return
      if (combined && !result.trips[0]?.plan.sources?.some(source => source.containerId === pickup?.containerId)) {
        throw new Error('Backend C# đang chạy chưa kiểm tra đủ hai chiều. Dừng và chạy lại backend C# rồi bấm Tối ưu lại.')
      }
      const next = trips.map((trip, index) => ({ ...trip,
        ...(result.trips[index]?.appointmentStart ? suggestedBookingWindow(result.trips[index]) : {}),
        truckId: result.trips[index]?.truckId || '', driverId: result.trips[index]?.driverId || '',
        trailerNumber: result.trips[index]?.trailerNumber || trip.trailerNumber || '' }))
      setPlan(result); setPlannedKey(shapeFor(next))
      if (combined) {
        const resolved = result.trips[0]?.plan.sources?.find(source => source.containerId === pickup?.containerId)
        if (resolved) setPickup(current => current?.containerId === resolved.containerId ? { ...current, ...resolved,
          targetTemperature: current.targetTemperature ?? '', documents: current.documents || [] } : current)
      }
      setTrips(current => current.map((trip, index) => ({ ...trip,
        ...(result.trips[index]?.appointmentStart ? suggestedBookingWindow(result.trips[index]) : {}),
        truckId: result.trips[index]?.truckId || '', driverId: result.trips[index]?.driverId || '',
        trailerNumber: result.trips[index]?.trailerNumber || trip.trailerNumber || '' })))
    } catch (cause) { if (alive.current && requested === version.current) { setError(errorText(cause)); setPlannedKey('') } }
    finally { if (alive.current && requested === version.current) setPlanning(false) }
  }
  optimizeRef.current = optimize
  useEffect(() => {
    if (plannedKey === shapeKey || !trips.length || !voyageId || (combined && (!pickup?.containerId || !pickup.yardCode)) || trips.some(trip => !trip.appointmentDate || !trip.startTime || !trip.endTime)) return
    const timer = setTimeout(() => optimizeRef.current(), 400)
    return () => clearTimeout(timer)
  }, [shapeKey, plannedKey, trips, voyageId, combined, pickup])
  const toggleSource = source => {
    appliedSource.current = true
    invalidate(); setConfirmed(false)
    setTrips(current => combined ? [submissionTrip(source, exportBookingWindow(voyage) || globalWindow)] : current.some(row => sourceKey(row) === sourceKey(source)) ? current.filter(row => sourceKey(row) !== sourceKey(source)) :
      [...current, submissionTrip(source, exportBookingWindow(voyage) || globalWindow)])
    setDocuments([])
  }
  const toggleGroupSelection = rows => {
    appliedSource.current = true
    invalidate(); setConfirmed(false); setDocuments([])
    setTrips(current => {
      const candidates = groupSelectionSources(rows, current)
      if (candidates.every(source => current.some(trip => sourceKey(trip) === sourceKey(source)))) {
        const keys = new Set(candidates.map(sourceKey))
        return current.filter(trip => !keys.has(sourceKey(trip)))
      }
      const added = candidates.filter(source => !current.some(trip => sourceKey(trip) === sourceKey(source))).slice(0, Math.max(0, 50 - current.length))
      return [...current, ...added.map(source => submissionTrip(source, exportBookingWindow(voyage) || globalWindow))]
    })
  }
  const patchTrip = (index, patch, affectsSchedule = false) => {
    if (affectsSchedule) invalidate()
    setTrips(current => current.map((trip, i) => i === index ? { ...trip, ...patch } : trip))
  }
  const changeWindow = (key, value) => {
    invalidate(); setGlobalWindow(current => ({ ...current, [key]: value })); setTrips(current => current.map(trip => ({ ...trip, [key]: value })))
  }
  const upload = async (type, file, index = null) => {
    if (!file || uploading) return
    const selection = trips.map(sourceKey).join('|')
    setUploading(`${index ?? 'shared'}:${type}`); setError('')
    try {
      const saved = await bookingService.uploadDocumentFile(file)
      if (!saved.fileUrl) throw new Error('Máy chủ chưa trả đường dẫn chứng từ.')
      if (!alive.current) return
      const doc = { documentType: type, fileUrl: saved.fileUrl, fileName: saved.fileName || file.name, fileSizeBytes: saved.fileSizeBytes, documentNumber: null }
      if (index === null) { setDocuments(current => [...current.filter(row => row.documentType !== type), { ...doc, containerNumbers: trips.map(trip => trip.containerNumber.toUpperCase()) }]); setConfirmed(false) }
      else setTrips(current => current.map((trip, i) => i === index && current.map(sourceKey).join('|') === selection ? { ...trip, documents: [...trip.documents.filter(row => row.documentType !== type), doc] } : trip))
    } catch (cause) { if (alive.current) setError(errorText(cause)) }
    finally { if (alive.current) setUploading('') }
  }
  const submit = async event => {
    event.preventDefault()
    if (submitLock.current) return
    setError('')
    try {
      if (combined && (trips.length !== 1 || !pickup?.containerId || !pickup.yardCode)) throw new Error('Chuyến hai chiều cần một container Giao và một container Nhận có mã hợp lệ.')
      if (!plannedKey || plannedKey !== shapeKey || currentPlan.trips.length !== trips.length) throw new Error('Chờ hệ thống kiểm tra hoặc bấm Tối ưu lại lịch trước khi gửi.')
      if (currentPlan.trips.some(trip => !trip.cargoAvailable)) throw new Error('Có container không còn khả dụng trong khung giờ đề xuất.')
      if (trips.some(trip => !trip.truckId || !trip.driverId)) throw new Error('Cần đủ xe và tài xế đang rảnh cho từng chuyến.')
      if (documents.length && trips.length > 1 && !confirmed) throw new Error('Xác nhận phạm vi chứng từ chung cho các container trong lô.')
      const body = payload(), key = JSON.stringify(body)
      if (attempt.current?.key !== key) attempt.current = { key, requestId: crypto.randomUUID() }
      submitLock.current = true; setSending(true)
      const saved = await exportBookingService.submitBooking({ ...body, requestId: attempt.current.requestId })
      if (alive.current) onSubmitted(saved)
    } catch (cause) { if (alive.current) setError(errorText(cause)) }
    finally { submitLock.current = false; if (alive.current) setSending(false) }
  }
  const disabled = sending || Boolean(uploading) || sourcesLoading || sourcesError
  return <form onSubmit={submit} className="space-y-5" aria-label="Tạo Booking hợp nhất">
    {modeSelector}
    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">
      <p className="font-bold">{combined ? 'Chuyến hai chiều: Giao container → Hạ bãi → Nhận container khác → Ra cổng' : 'Container → Lịch xe đề xuất → Chứng từ → Gửi hãng tàu'}</p>
      <p className="mt-1">{combined ? 'Một xe, moóc và tài xế thực hiện hai tác nghiệp trong cùng chuyến. Hệ thống kiểm tra lịch của cả hai container và gửi hồ sơ cho hãng tàu duyệt.' : 'Chọn một container để đặt riêng; chọn từ 2–50 container cùng loại hàng để đặt theo lô. Cảng xử lý lịch sau khi hãng tàu duyệt.'}</p>
    </div>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 whitespace-pre-line">{error}</div>}
    <fieldset disabled={disabled} className="space-y-5 min-w-0">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h3 className="font-bold">1. Hãng tàu và chuyến vận chuyển</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hãng tàu *"><select className={input} required value={shippingLineId} onChange={event => { invalidate(); setShippingLineId(event.target.value); setVoyageId('') }}><option value="">Chọn hãng tàu</option>{options.shippingLines.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
          <Field label="Chuyến tàu *"><select className={input} required value={voyageId} onChange={event => { invalidate(); setVoyageId(event.target.value) }}><option value="">Chọn chuyến còn nhận hàng</option>{voyages.map(row => <option key={row.id} value={row.id}>{row.vesselName} · {row.voyageNumber} · {row.portOfDischarge}</option>)}</select></Field>
        </div>
        {!options.shippingLines.length && <p className="text-sm text-amber-800">Chưa có hãng tàu đang hoạt động trong hệ thống.</p>}
        {shippingLineId && !voyages.length && <p className="text-sm text-amber-800">Hãng tàu chưa có chuyến còn mở nhận. Vui lòng chọn hãng tàu khác hoặc liên hệ hãng tàu.</p>}
        {voyage && <p className="text-xs text-slate-600">{voyage.portOfLoading} → {voyage.portOfDischarge} · CY cut-off: {new Date(voyage.cyCutoff).toLocaleString('vi-VN')} · VGM cut-off: {new Date(voyage.vgmCutoff).toLocaleString('vi-VN')}</p>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">2. {combined ? 'Chọn container Giao' : 'Chọn container'} của {options.companyName || 'công ty'}</h3><span className="text-sm font-semibold text-teal-700">{combined ? 'Hai chiều · 1 Giao + 1 Nhận' : trips.length ? trips.length === 1 ? 'Booking riêng · 1 container' : `Booking theo lô · ${trips.length} container` : 'Chưa chọn container'}</span></div>
        <p role={sourcesLoading ? 'status' : undefined} className="text-sm font-semibold text-teal-700">{sourcesLoading ? 'Đang cập nhật container có thể Booking…' : sourcesError ? 'Chưa tải được danh sách container. Bấm Làm mới để thử lại.' : `${availableContainerCount} container có thể đặt Booking mới.`}{!sourcesLoading && !sourcesError && existing && ' Container trong hồ sơ đang sửa được giữ lại để chỉnh sửa.'}</p>
        {!sourcesLoading && !sourcesError && !sources.length && <p className="text-sm text-slate-500">Chưa có bản khai container có hàng chưa được Booking. Khai báo container trước để chọn tại đây.</p>}
        {groups.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">Bấm vào nhóm hàng để xem và chọn container.</p>
          <button type="button" className="text-sm font-semibold text-teal-700 underline underline-offset-2" onClick={() => setExpandedGroups(allGroupsExpanded ? new Set() : new Set(groups.map(([type]) => type)))}>{allGroupsExpanded ? 'Thu gọn tất cả' : 'Mở tất cả'}</button>
        </div>}
        <div className="space-y-2">{groups.map(([type, rows], index) => {
          const expanded = expandedGroups.has(type), panelId = `${groupId}-container-group-${index}`
          const selectedCount = rows.filter(source => trips.some(trip => sourceKey(trip) === sourceKey(source))).length
          const candidates = groupSelectionSources(rows, trips)
          const allSelected = candidates.length > 0 && candidates.every(source => trips.some(trip => sourceKey(trip) === sourceKey(source)))
          const remaining = Math.max(0, 50 - trips.length)
          const unselectedCount = candidates.filter(source => !trips.some(trip => sourceKey(trip) === sourceKey(source))).length
          return <div key={type} className={`overflow-hidden rounded-xl border ${palette[index % palette.length]}`}>
            <h4><button type="button" aria-expanded={expanded} aria-controls={panelId} className="flex w-full items-center gap-3 p-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-600" onClick={() => setExpandedGroups(current => { const next = new Set(current); if (next.has(type)) next.delete(type); else next.add(type); return next })}>
              <span className="min-w-0 flex-1 font-bold">{cargoLabels[type] || type} <span className="font-normal text-slate-600">· {rows.length} container</span></span>
              {selectedCount > 0 && <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-teal-800">Đã chọn {selectedCount}</span>}
              <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button></h4>
            <div id={panelId} hidden={!expanded} className={expanded ? 'space-y-2 px-3 pb-3' : 'hidden'}>
              {!combined && <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-600">{cargo && cargo !== type ? 'Chọn cùng loại hàng để ghép lô.' : 'Tối đa 50 container cùng loại hàng.'}</span>
                <button type="button" className="rounded-lg border border-current bg-white px-3 py-1.5 font-semibold text-teal-800 disabled:opacity-40" disabled={Boolean(cargo && cargo !== type) || !candidates.length || (!allSelected && remaining === 0)} onClick={() => toggleGroupSelection(rows)}>{allSelected ? 'Bỏ chọn nhóm' : unselectedCount > remaining ? `Chọn thêm ${remaining}` : 'Chọn tất cả'}</button>
              </div>}
              <div className="grid max-h-80 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-2">{rows.map(source => <label key={sourceKey(source)} className={`flex items-start gap-2 rounded-lg bg-white p-3 text-sm ${!combined && cargo && cargo !== source.cargoType ? 'opacity-45' : ''}`}>
                <input type={combined ? 'radio' : 'checkbox'} name={combined ? 'combined-export-container' : undefined} aria-label={`Chọn container ${source.containerNumber}`} className="mt-1" checked={trips.some(trip => sourceKey(trip) === sourceKey(source))}
                  disabled={Boolean(uploading) || (!combined && cargo && cargo !== source.cargoType) || (combined && source.containerId === pickup?.containerId) || (trips.length >= 50 && !trips.some(trip => sourceKey(trip) === sourceKey(source))) || trips.some(trip => trip.containerId === source.containerId && sourceKey(trip) !== sourceKey(source))} onChange={() => toggleSource(source)} />
                <span><strong>{source.containerNumber}</strong><span className="block text-xs text-slate-500">{source.containerTypeCode} · Seal {source.sealNumber || 'chưa khai'} · {source.grossWeightKg != null ? `${Number(source.grossWeightKg).toLocaleString('vi-VN')} kg` : 'Chưa khai khối lượng hàng'}</span></span>
              </label>)}</div>
            </div>
          </div>
        })}</div>
      </section>
      {combined && <section className="rounded-2xl border border-blue-200 bg-white p-5 space-y-4">
        <h3 className="font-bold">Container Nhận ra cảng trong cùng chuyến</h3>
        <BookingSourcePicker operation={{ operationType: 'Import', ...pickup, containerIsoSize: pickup?.containerTypeCode || '' }} onSelect={selection => {
          invalidate(); setPickup(selection ? { ...selection, targetTemperature: '', unNumber: '', dgClass: '', documents: [] } : null)
        }} />
        {pickup?.containerId === trips[0]?.containerId && <p role="alert" className="text-sm text-rose-700">Container Giao và Nhận phải khác nhau.</p>}
        {pickup?.containerNumber && <p className="text-sm text-blue-900">{pickup.containerNumber} · {pickup.containerTypeCode || pickup.containerIsoSize} · {cargoLabels[pickup.cargoType] || 'Chờ xác thực thông tin hàng'}</p>}
        {pickup?.cargoType === 'reefer' && <Field label="Nhiệt độ container Nhận (°C) *"><input required type="number" step="0.1" className={input} value={pickup.targetTemperature ?? ''} onChange={event => setPickup(current => ({ ...current, targetTemperature: event.target.value }))} /></Field>}
        {['dangerous', 'dangerous_goods'].includes(pickup?.cargoType) && <div className="grid gap-3 sm:grid-cols-2"><Field label="Mã UN container Nhận *"><input required className={input} maxLength={30} value={pickup.unNumber || ''} onChange={event => setPickup(current => ({ ...current, unNumber: event.target.value }))} /></Field><Field label="Phân lớp container Nhận *"><input required className={input} maxLength={30} value={pickup.dgClass || ''} onChange={event => setPickup(current => ({ ...current, dgClass: event.target.value }))} /></Field></div>}
        {pickupRequirements.length > 0 && <><h4 className="font-bold text-sm">Chứng từ của container Nhận</h4><DocumentCards direction="Import" requirements={pickupRequirements} documents={pickup?.documents || []} uploading={uploading}
          onUpload={async (type, file) => {
            if (!file || uploading) return
            const containerId = pickup.containerId
            setUploading(`pickup:${type}`); setError('')
            try {
              const saved = await bookingService.uploadDocumentFile(file)
              if (!saved.fileUrl) throw new Error('Máy chủ chưa trả đường dẫn chứng từ.')
              if (alive.current) setPickup(current => current?.containerId === containerId ? { ...current, documents: [...(current.documents || []).filter(doc => doc.documentType !== type), { documentType: type, fileUrl: saved.fileUrl, fileName: saved.fileName || file.name, fileSizeBytes: saved.fileSizeBytes }] } : current)
            } catch (cause) { if (alive.current) setError(errorText(cause)) }
            finally { if (alive.current) setUploading('') }
          }} onRemove={type => setPickup(current => ({ ...current, documents: current.documents.filter(doc => doc.documentType !== type) }))} /></>}
      </section>}
      {trips.length > 0 && <>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">3. Lịch hẹn và phương tiện đề xuất</h3><p className="mt-1 text-xs text-slate-500">Chỉ đề xuất xe và tài xế rảnh. Các chuyến trùng giờ sử dụng phương tiện, moóc và tài xế khác nhau.</p></div><button type="button" className={button} disabled={planning || !voyage} onClick={optimize}>{planning ? 'Đang tối ưu…' : 'Tối ưu lại'}</button></div>
          <div className="grid gap-3 sm:grid-cols-3"><Field label="Ngày giao đề xuất"><input className={input} type="date" value={globalWindow.appointmentDate} onChange={event => changeWindow('appointmentDate', event.target.value)} /></Field><Field label="Từ giờ"><input className={input} type="time" value={globalWindow.startTime} onChange={event => changeWindow('startTime', event.target.value)} /></Field><Field label="Đến giờ"><input className={input} type="time" value={globalWindow.endTime} onChange={event => changeWindow('endTime', event.target.value)} /></Field></div>
          {planning && <p role="status" className="text-sm text-orange-700">Đang kiểm tra lịch rảnh từ database…</p>}
          {trips.map((trip, index) => {
            const row = currentPlan.trips[index], fleet = row?.plan.fleet, key = sourceKey(trip)
            let trucks = [], drivers = [], trailers = []
            try {
              trucks = availableForTrip(fleet?.trucks || [], 'truckId', index, trips)
              drivers = availableForTrip(fleet?.drivers || [], 'driverId', index, trips)
              trailers = availableForTrip(row?.trailerSuggestions || [], 'trailerNumber', index, trips)
            } catch { /* Incomplete schedule stays editable until a valid plan is returned. */ }
            return <article key={key} className="rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="font-bold">{index + 1}. {trip.containerNumber} <span className="text-sm font-normal text-slate-500">· {trip.containerTypeCode}</span></p>
              <div className="grid gap-3 sm:grid-cols-3"><Field label="Ngày hẹn"><input required type="date" className={input} value={trip.appointmentDate || ''} onChange={event => patchTrip(index, { appointmentDate: event.target.value }, true)} /></Field><Field label="Bắt đầu"><input required type="time" className={input} value={trip.startTime || ''} onChange={event => patchTrip(index, { startTime: event.target.value }, true)} /></Field><Field label="Kết thúc"><input required type="time" className={input} value={trip.endTime || ''} onChange={event => patchTrip(index, { endTime: event.target.value }, true)} /></Field></div>
              <div className="grid gap-3 lg:grid-cols-3">
                <Field label="Xe đầu kéo *"><select required className={input} aria-label={`Xe đầu kéo ${trip.containerNumber}`} value={trip.truckId} disabled={planning || !fleet} onChange={event => { const truckId = event.target.value; patchTrip(index, { truckId, trailerNumber: trailers.find(item => item.truckId === truckId)?.trailerNumber || '' }) }}><option value="">{planning ? 'Đang kiểm tra…' : 'Chọn xe đang rảnh'}</option>{trucks.map(truck => <option key={truck.id} value={truck.id}>{truck.plateNumber}</option>)}</select></Field>
                <Field label="Tài xế *"><select required className={input} aria-label={`Tài xế ${trip.containerNumber}`} value={trip.driverId} disabled={planning || !fleet} onChange={event => patchTrip(index, { driverId: event.target.value })}><option value="">Chọn tài xế đang rảnh</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.fullName}{driver.phone ? ` · ${driver.phone}` : ''}</option>)}</select></Field>
                <Field label="Rơ-moóc *"><input required className={input} list={`trailers-${index}`} maxLength={50} aria-label={`Rơ-moóc ${trip.containerNumber}`} value={trip.trailerNumber} placeholder="Chọn moóc hoặc bổ sung biển số thực tế" onChange={event => patchTrip(index, { trailerNumber: event.target.value.toUpperCase() })} /><datalist id={`trailers-${index}`}>{[...new Set(trailers.map(item => item.trailerNumber))].map(plate => <option key={plate} value={plate} />)}</datalist></Field>
              </div>
              {row && !row.plan.schedule.isAvailable && <p role="alert" className="text-sm text-amber-800">{row.plan.schedule.message}</p>}
              <button type="button" className="text-xs font-bold text-teal-700 underline" onClick={() => setShowProfiles(showProfiles === key ? '' : key)}>{showProfiles === key ? 'Ẩn hồ sơ phương tiện và tài xế' : 'Xem hồ sơ phương tiện và tài xế'}</button>
              {showProfiles === key && <BookingFleetDetails vehicle={fleet?.trucks.find(item => item.id === trip.truckId)} driver={fleet?.drivers.find(item => item.id === trip.driverId)} />}
            </article>
          })}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <h3 className="font-bold">4. Hồ sơ container và chứng từ</h3>
          <p className="text-xs text-slate-500">Seal và khối lượng hàng lấy từ bản khai. VGM là khối lượng toàn bộ container đã xác minh, bổ sung từ kết quả cân khi hồ sơ chưa có.</p>
          {trips.map((trip, index) => <div key={sourceKey(trip)} className="rounded-xl border border-slate-200 p-4 space-y-3">
            <h4 className="text-sm font-bold">{trip.containerNumber} · {cargoLabels[trip.cargoType] || trip.cargoType}</h4>
            <div className="grid gap-3 sm:grid-cols-3"><Field label="Seal *"><input className={input} required maxLength={100} value={trip.sealNumber} onChange={event => patchTrip(index, { sealNumber: event.target.value })} /></Field><Field label="Khối lượng hàng khai báo (kg)"><input className={input} readOnly value={trip.grossWeightKg ?? 'Chưa khai'} /></Field><Field label="VGM đã xác minh (kg) *"><input className={input} required type="number" min="0.001" max="99999999" step="0.001" value={trip.vgmKg} onChange={event => patchTrip(index, { vgmKg: event.target.value })} /></Field></div>
            {trip.cargoType === 'reefer' && <div className="grid gap-3 sm:grid-cols-2"><Field label="Nhiệt độ chỉ dẫn (°C) *"><input required className={input} type="number" step="0.1" value={trip.targetTemperature} onChange={event => patchTrip(index, { targetTemperature: event.target.value })} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={trip.isReeferPowerRequired} onChange={event => patchTrip(index, { isReeferPowerRequired: event.target.checked })} />Yêu cầu cấp điện tại bãi</label></div>}
            {['dangerous', 'dangerous_goods'].includes(trip.cargoType) && <div className="grid gap-3 sm:grid-cols-2"><Field label="Mã UN *"><input required className={input} maxLength={30} value={trip.unNumber} onChange={event => patchTrip(index, { unNumber: event.target.value })} /></Field><Field label="Phân lớp nguy hiểm *"><input required className={input} maxLength={30} value={trip.dgClass} onChange={event => patchTrip(index, { dgClass: event.target.value })} /></Field></div>}
            {trips.length === 1 && <DocumentCards requirements={requirements} documents={trip.documents} uploading={uploading} onUpload={(type, file) => upload(type, file, index)} onRemove={type => patchTrip(index, { documents: trip.documents.filter(doc => doc.documentType !== type) })} />}
          </div>)}
          {trips.length > 1 && <div className="space-y-3"><p className="text-sm font-semibold">Chứng từ dùng chung cho {trips.length} container</p><DocumentCards requirements={requirements} documents={documents} uploading={uploading} onUpload={upload} onRemove={type => { setDocuments(current => current.filter(doc => doc.documentType !== type)); setConfirmed(false) }} />{documents.length > 0 && <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>Tôi đã đối chiếu nội dung: các chứng từ chung bao gồm tất cả container đã chọn.</span></label>}</div>}
          <Field label="Ghi chú bổ sung (nếu có)"><textarea className={input} maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} /></Field>
        </section>
      </>}
    </fieldset>
    <div className="flex flex-wrap items-center justify-end gap-3"><button type="button" className="px-4 py-2 text-sm font-semibold" disabled={disabled} onClick={onClose}>Đóng</button><button type="submit" className={button} disabled={disabled || planning || !trips.length || !voyage || !plannedKey}>{sending ? 'Đang gửi hồ sơ…' : existing ? 'Cập nhật và gửi hãng tàu' : 'Gửi Booking cho hãng tàu'}</button></div>
  </form>
}

function DocumentCards({ requirements, documents, uploading, onUpload, onRemove, direction = 'Export' }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{requirements.map(spec => {
    const saved = documents.find(doc => doc.documentType === spec.documentType)
    const title = spec.documentType === 'CustomsDeclaration' && direction === 'Import' ? 'Tờ khai hải quan nhập khẩu' : documentNames[spec.documentType] || spec.nameVi
    return <article key={spec.documentType} className="rounded-xl border border-amber-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2"><h5 className="text-sm font-bold">{title}</h5><span className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold ${spec.isMandatory ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{spec.isMandatory ? 'BẮT BUỘC' : 'BỔ SUNG'}</span></div>
      {saved ? <div className="space-y-2 text-xs"><a className="block break-all text-teal-700 underline" href={saved.fileUrl} target="_blank" rel="noopener noreferrer">{saved.fileName || 'Xem chứng từ'}</a><button type="button" className="text-rose-700" disabled={Boolean(uploading)} onClick={() => onRemove(spec.documentType)}>Bỏ tệp</button></div> : <label className="relative block cursor-pointer rounded-lg bg-amber-50 p-3 text-center text-sm font-bold text-amber-900">{uploading ? 'Đang tải…' : 'Tải lên tệp chứng từ'}<input className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" aria-label={`Tải ${title}`} disabled={Boolean(uploading)} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; onUpload(spec.documentType, file) }} /></label>}
    </article>
  })}</div>
}
