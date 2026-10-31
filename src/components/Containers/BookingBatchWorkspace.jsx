import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { bookingService } from '../../services/bookingService'
import { bookingWindow, sourceOperation } from '../../features/booking-dispatch/bookingPlanning'
import BookingFleetDetails from './BookingFleetDetails'

const input = 'w-full rounded-xl border border-chalk bg-white px-3 py-2 text-sm'
const labels = { Pending: 'Chờ xử lý', AwaitingAssignment: 'Chờ phân công', InProgress: 'Đang thực hiện', PartiallyCompleted: 'Hoàn thành một phần', Completed: 'Hoàn tất', Canceled: 'Đã hủy', Ready: 'Đã phân công', Approved: 'Đã duyệt', CheckedIn: 'Đã vào cổng', Rejected: 'Đã từ chối', Expired: 'Hết hạn' }
const cargoLabels = { general: 'Hàng bách hóa', reefer: 'Hàng lạnh', dangerous: 'Hàng nguy hiểm', dangerous_goods: 'Hàng nguy hiểm', dangerousgoods: 'Hàng nguy hiểm', perishable: 'Hàng dễ hư hỏng', oversized: 'Hàng quá khổ', overweight: 'Hàng quá tải' }
const cargoName = value => cargoLabels[value?.toLowerCase()] || value
const errorMessage = error => {
  const data = error.response?.data
  return data?.errors || data?.Errors ? Object.values(data.errors || data.Errors).flat().join(' ') : data?.message || data?.Message || error.message
}
const localDate = () => new Date(Date.now() + 86400000).toLocaleDateString('en-CA')
const emptyId = '00000000-0000-0000-0000-000000000000'
// Pickup sources deliberately have no declaration ID. Identify the actual container occurrence.
const sourceKey = row => `${row.containerId}:${row.containerVisitId || ''}:${row.declarationId || ''}`
const groupStyles = {
  general: 'border-teal-200 bg-teal-50 text-teal-900', reefer: 'border-sky-200 bg-sky-50 text-sky-900',
  dangerous: 'border-rose-200 bg-rose-50 text-rose-900', dangerous_goods: 'border-rose-200 bg-rose-50 text-rose-900',
  perishable: 'border-lime-200 bg-lime-50 text-lime-900', oversized: 'border-violet-200 bg-violet-50 text-violet-900',
  overweight: 'border-amber-200 bg-amber-50 text-amber-900',
}
const documentView = (spec, direction) => ({
  CarrierBookingReference: { title: 'Booking Xuất Khẩu / Mã Hạ Cont', icon: 'receipt_long' },
  CustomsDeclaration: { title: `Tờ Khai Hải Quan ${direction === 'Dropoff' ? 'Xuất' : 'Nhập'} Khẩu`, icon: 'policy' },
  VgmCertificate: { title: 'Phiếu Xác Nhận Khối Lượng (VGM)', icon: 'scale' },
  DeliveryOrder: { title: 'Lệnh Giao Hàng Hãng Tàu (D/O hoặc eDO)', icon: 'task' },
  BillOfLading: { title: 'Thông Tin Vận Đơn Đường Biển (B/L)', icon: 'description' },
  ReeferTemperatureInstructions: { title: 'Chỉ Dẫn Bảo Quản Cont Lạnh', icon: 'ac_unit' },
  DangerousGoodsDeclaration: { title: 'Khai Báo Hàng Nguy Hiểm (IMO)', icon: 'warning' },
}[spec.documentType] || { title: spec.nameVi, icon: 'description' })

export default function BookingBatchWorkspace({ onSaved }) {
  const navigate = useNavigate()
  const [direction, setDirection] = useState('Dropoff')
  const [options, setOptions] = useState([])
  const [catalog, setCatalog] = useState([])
  const [trips, setTrips] = useState([])
  const [date, setDate] = useState(localDate)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('12:00')
  const [documents, setDocuments] = useState([])
  const [requirements, setRequirements] = useState([])
  const [confirmed, setConfirmed] = useState(false)
  const [allowUnassigned, setAllowUnassigned] = useState(false)
  const [description, setDescription] = useState('')
  const [plan, setPlan] = useState(null)
  const [plannedKey, setPlannedKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [batches, setBatches] = useState([])
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState(null)
  const attempt = useRef(null)
  const version = useRef(0)
  const listVersion = useRef(0)
  const active = useRef(true)
  const optimizeLatest = useRef(null)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const invalidate = () => { version.current++; setPlan(null); setPlannedKey(''); setError('') }
  const reloadBatches = async () => {
    const requested = ++listVersion.current
    try { const data = await bookingService.getBatches(page); if (active.current && requested === listVersion.current) setBatches(data) }
    catch (err) { if (active.current && requested === listVersion.current) setError(errorMessage(err)) }
  }
  useEffect(() => { reloadBatches() }, [page])
  useEffect(() => {
    setOptions([]); setCatalog([]); setTrips([]); setPlan(null); setDocuments([]); setRequirements([]); setConfirmed(false)
    version.current++
  }, [direction])
  const anchorKey = trips[0]?.key || ''
  useEffect(() => {
    let live = true
    bookingService.getBatchContainerOptions(direction, trips[0]?.selection).then(data => {
      if (live) {
        setOptions(data)
        if (!anchorKey) setCatalog(data)
        else setCatalog(previous => [...previous.filter(row => row.cargoType !== trips[0].source.cargoType), ...data])
      }
    }).catch(err => { if (live) setError(errorMessage(err)) })
    return () => { live = false }
  }, [direction, anchorKey])
  const inDocumentScope = row => documents.filter(doc => doc.containerNumbers?.length).every(doc => doc.containerNumbers.includes(row.containerNumber.toUpperCase()))
  const candidates = [...new Map([...catalog, ...options].map(row => [sourceKey(row), row])).values()]
  const cargoGroups = [...candidates.reduce((map, row) => {
    if (!row.cargoType) return map
    const cargo = row.cargoType.toLowerCase()
    if (!map.has(cargo)) map.set(cargo, [])
    map.get(cargo).push(row)
    return map
  }, new Map())]
  const groups = cargoGroups.filter(([, rows]) => new Set(rows.map(row => row.containerId)).size >= 2)
  const cannotSelect = row => (trips.length > 0 && row.cargoType !== trips[0].source.cargoType) ||
    (!trips.some(trip => trip.key === sourceKey(row)) && (!inDocumentScope(row) ||
      trips.some(trip => trip.selection.containerId === row.containerId && trip.key !== sourceKey(row))))
  const selectSources = keys => {
    if (keys.length > 50) { setError('Mỗi lô tối đa 50 container.'); return }
    const selected = keys.map(key => {
      const existing = trips.find(trip => trip.key === key)
      if (existing) return existing
      const source = candidates.find(row => sourceKey(row) === key)
      return { key, selection: { containerId: source.containerId, declarationId: direction === 'Dropoff' ? source.declarationId : emptyId, yardCode: source.yardCode || null }, source,
        date, start: startTime, end: endTime, truckId: '', driverId: '', trailerNumber: '', temperature: '', power: false }
    })
    if (new Set(selected.map(trip => trip.selection.containerId)).size !== selected.length) { setError('Chỉ chọn một bản khai/lượt bãi cho mỗi container.'); return }
    if (selected.some(trip => !trip.source.cargoType || trip.source.cargoType !== selected[0].source.cargoType)) { setError('Chỉ chọn container cùng loại hàng với container đầu tiên.'); return }
    invalidate(); setTrips(selected); setConfirmed(false)
    if (!selected.length) { setDocuments([]); setRequirements([]) }
  }

  const shapeKey = JSON.stringify({ direction, trips: trips.map(trip => ({ id: trip.selection.containerId, declarationId: trip.selection.declarationId, yardCode: trip.selection.yardCode, date: trip.date, start: trip.start, end: trip.end })) })
  const currentPlan = plannedKey === shapeKey ? plan : null
  useEffect(() => {
    if (trips.length < 2) { setBusy(false); return }
    const timer = setTimeout(() => optimizeLatest.current(), 400)
    return () => clearTimeout(timer)
  }, [shapeKey])
  const patchTrip = (index, patch, affectsPlan = false) => {
    if (affectsPlan) invalidate()
    setTrips(previous => previous.map((trip, i) => i === index ? { ...trip, ...patch } : trip))
  }
  const payload = () => ({ bookingType: direction, description: description || null, sharedDocumentsConfirmed: confirmed,
    allowUnassignedTrips: allowUnassigned, sharedDocuments: documents,
    trips: trips.map(trip => ({ selection: trip.selection, ...bookingWindow(trip.date, trip.start, trip.end),
      truckId: trip.truckId || null, driverId: trip.driverId || null, trailerNumber: trip.trailerNumber || null,
      isReeferPowerRequired: !!trip.power, tempTolerance: 2,
      operation: { temperatureSetpoint: trip.temperature === '' || trip.temperature == null ? null : Number(trip.temperature), temperatureUnit: 'C',
        unNumber: trip.unNumber || null, dgClass: trip.dgClass || null, documents: [] } })) })

  const optimize = async () => {
    setError('')
    const requestedVersion = ++version.current
    try {
      if (trips.length < 2) throw new Error('Chọn ít nhất 2 container để lập lô.')
      const data = payload()
      const pastTrip = data.trips.findIndex(trip => Date.parse(trip.appointmentStart) < Date.now() - 600000)
      if (pastTrip >= 0) throw new Error(`Chuyến ${pastTrip + 1}: giờ hẹn đã qua. Chọn ngày và giờ trong tương lai để kiểm tra xe, tài xế rảnh.`)
      setBusy(true)
      setRequirements([])
      const result = await bookingService.planBatch(data)
      if (!active.current || version.current !== requestedVersion) return
      setPlan(result); setPlannedKey(shapeKey)
      setTrips(previous => previous.map((trip, index) => ({ ...trip, source: result.trips[index].plan.source.containerNumber ? result.trips[index].plan.source : trip.source,
        truckId: result.trips[index].truckId || '', driverId: result.trips[index].driverId || '',
        trailerNumber: result.trips[index].trailerNumber || '' })))
      if (result.validationMessages?.length) return
      const specs = await bookingService.getOperationRequirements({ operationType: direction === 'Dropoff' ? 'Export' : 'Import', cargoStatus: 'Loaded', cargoType: sourceOperation({ cargoType: result.cargoType }).cargoType })
      if (!active.current || version.current !== requestedVersion) return
      setRequirements(specs)
    } catch (err) { if (active.current && version.current === requestedVersion) setError(errorMessage(err)) }
    finally { if (active.current && version.current === requestedVersion) setBusy(false) }
  }
  optimizeLatest.current = optimize
  const overlaps = (a, b) => {
    try {
      const left = bookingWindow(a.date, a.start, a.end), right = bookingWindow(b.date, b.start, b.end)
      return left.appointmentStart < right.appointmentEnd && left.appointmentEnd > right.appointmentStart
    } catch { return true }
  }
  const plateKey = value => (value || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
  const reservedByOther = (index, field, value) => trips.some((other, i) => i !== index && value &&
    (field === 'trailerNumber' ? plateKey(other[field]) === plateKey(value) : other[field] === value) && overlaps(trips[index], other))
  const upload = async (type, file) => {
    if (!file) return
    setUploading(true); setError('')
    try {
      const uploaded = await bookingService.uploadDocumentFile(file)
      setDocuments(previous => [...previous.filter(doc => doc.documentType !== type), { documentType: type, documentNumber: null,
        fileUrl: uploaded.fileUrl, fileName: uploaded.fileName, fileSizeBytes: uploaded.fileSizeBytes, containerNumbers: [] }])
      setConfirmed(false)
    } catch (err) { setError(errorMessage(err)) }
    finally { setUploading(false) }
  }
  const save = async event => {
    event.preventDefault(); setError('')
    try {
      if (!currentPlan) throw new Error('Bấm Tối ưu để kiểm tra lại toàn bộ chuyến trước khi tạo lô.')
      if (currentPlan.validationMessages?.length) throw new Error(currentPlan.validationMessages.join(' '))
      if (currentPlan.trips.some(trip => !trip.cargoAvailable)) throw new Error('Có container chưa đủ điều kiện theo giờ hẹn. Đổi giờ hoặc chọn container khác rồi Tối ưu lại.')
      if (requirements.some(spec => spec.isMandatory && !documents.some(doc => doc.documentType === spec.documentType))) throw new Error('Bổ sung đủ chứng từ bắt buộc dùng chung cho lô.')
      const expectedNumbers = trips.map(trip => trip.source.containerNumber.toUpperCase()).sort()
      if (documents.some(doc => !doc.fileUrl || new Set(doc.containerNumbers || []).size !== (doc.containerNumbers || []).length || !expectedNumbers.every(number => doc.containerNumbers?.includes(number)))) {
        throw new Error('Mỗi chứng từ dùng chung cần tệp gốc và danh sách số container bao gồm toàn bộ lô, không trùng số. Đối chiếu nội dung chứng từ rồi bổ sung phạm vi.')
      }
      if (!confirmed) throw new Error('Xác nhận chứng từ chung áp dụng cho tất cả container đã chọn.')
      if (!allowUnassigned && trips.some(trip => !trip.truckId || !trip.driverId)) throw new Error('Cần đủ xe/tài xế hoặc cho phép chuyến chờ phân công.')
      const data = payload(), key = JSON.stringify(data)
      for (let i = 0; i < data.trips.length; i++) for (let j = 0; j < i; j++) {
        const a = data.trips[i], b = data.trips[j]
        if (a.appointmentStart < b.appointmentEnd && a.appointmentEnd > b.appointmentStart &&
          ((a.truckId && a.truckId === b.truckId) || (a.driverId && a.driverId === b.driverId))) {
          throw new Error(`Chuyến ${j + 1} và ${i + 1} trùng xe hoặc tài xế. Bấm Tối ưu lại hoặc đổi giờ hẹn.`)
        }
      }
      if (attempt.current?.key !== key) attempt.current = { key, requestId: crypto.randomUUID() }
      setBusy(true)
      const saved = await bookingService.createBatch({ ...data, requestId: attempt.current.requestId })
      setDetail(saved); setTrips([]); setDocuments([]); setDescription(''); setRequirements([]); setAllowUnassigned(false); setConfirmed(false); invalidate(); attempt.current = null
      onSaved?.()
      try { const remaining = await bookingService.getBatchContainerOptions(direction); setOptions(remaining); setCatalog(remaining) }
      catch (err) { setError(`Lô đã được tạo. Không tải lại được danh sách container: ${errorMessage(err)}`) }
      await reloadBatches()
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  const open = async id => {
    setError(''); setBusy(true)
    try { setDetail(await bookingService.getBatch(id)) }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  const assign = async trip => {
    setError(''); setBusy(true)
    try {
      const booking = trip.booking
      const proposed = await bookingService.planBooking({ bookingId: booking.id, containerId: booking.containerIds[0], bookingType: booking.bookingType,
        appointmentStart: booking.appointmentStart, appointmentEnd: booking.appointmentEnd })
      if (!proposed.schedule.isAvailable || !proposed.fleet.recommendedTruckId || !proposed.fleet.recommendedDriverId) {
        throw new Error(proposed.schedule.message || 'Chưa có cặp xe và tài xế phù hợp với giờ hẹn của chuyến.')
      }
      await bookingService.assignBookingResources(booking.id, { truckId: proposed.fleet.recommendedTruckId, driverId: proposed.fleet.recommendedDriverId, containerIds: booking.containerIds })
      setDetail(await bookingService.getBatch(detail.id)); await reloadBatches(); onSaved?.()
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  const documentOrder = direction === 'Dropoff'
    ? ['CarrierBookingReference', 'CustomsDeclaration', 'VgmCertificate', 'ReeferTemperatureInstructions', 'DangerousGoodsDeclaration']
    : ['DeliveryOrder', 'BillOfLading', 'CustomsDeclaration', 'ReeferTemperatureInstructions', 'DangerousGoodsDeclaration']
  const orderedRequirements = [...requirements].sort((a, b) =>
    (documentOrder.includes(a.documentType) ? documentOrder.indexOf(a.documentType) : 99) - (documentOrder.includes(b.documentType) ? documentOrder.indexOf(b.documentType) : 99))
  return <div className="space-y-6">
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    <form onSubmit={save} className="space-y-5 rounded-2xl border border-chalk bg-white p-5">
      <div><h3 className="text-lg font-bold">Booking theo lô</h3><p className="text-sm text-slate-600">Cùng loại hàng, cùng bộ hồ sơ. Mỗi container có chuyến xe, tài xế, giờ hẹn và lượt qua cổng riêng.</p></div>
      <fieldset disabled={busy || uploading} className="space-y-5 disabled:opacity-70">
        <div className="max-w-md">
          <label className="text-sm font-semibold">Nghiệp vụ<select aria-label="Nghiệp vụ của lô" className={input} value={direction} onChange={event => { invalidate(); setDirection(event.target.value) }}><option value="Dropoff">Giao container vào cảng</option><option value="Pickup">Nhận container ra cảng</option></select></label>
        </div>
        <div role="group" aria-label="Container trong lô" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-bold">Chọn container theo nhóm</h4>{trips.length > 0 && <button type="button" className="text-sm font-semibold underline" onClick={() => selectSources([])}>Bỏ chọn tất cả</button>}</div>
          <p className="text-xs text-slate-600">Tích chọn từng container hoặc chọn cả nhóm, tối đa 50 container. Cùng màu là cùng loại hàng; chứng từ dùng chung vẫn cần đối chiếu.</p>
          {trips.length === 1 && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Bạn đang chọn 1 container, chưa đủ điều kiện Booking theo lô. Chọn thêm ít nhất 1 container cùng nhóm hoặc sử dụng Booking riêng lẻ.
          </div>}
          {!groups.length && <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">Chưa có nhóm từ 2 container trở lên cho nghiệp vụ này.</p>}
          <div className="grid gap-4 lg:grid-cols-2">{groups.map(([cargo, rows]) => {
            const blocked = trips.length > 0 && trips[0].source.cargoType.toLowerCase() !== cargo
            const additions = [...new Map(rows.filter(row => !cannotSelect(row) && !trips.some(trip => trip.selection.containerId === row.containerId)).map(row => [row.containerId, row])).values()]
            const selectedCount = rows.filter(row => trips.some(trip => trip.key === sourceKey(row))).length
            return <section key={cargo} aria-label={`Nhóm ${cargoName(cargo)}`} className={`rounded-2xl border p-4 ${groupStyles[cargo] || 'border-slate-200 bg-slate-50 text-slate-900'}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div><h5 className="font-bold">{cargoName(cargo)}</h5><p className="text-xs">{new Set(rows.map(row => row.containerId)).size} container · Đã chọn {selectedCount}</p></div>
                <button type="button" aria-label={`Chọn nhóm ${cargoName(cargo)}`} disabled={blocked || !additions.length || trips.length >= 50} className="rounded-lg border border-current bg-white px-3 py-1.5 text-xs font-bold disabled:opacity-40" onClick={() => selectSources([...trips.map(trip => trip.key), ...additions.slice(0, 50 - trips.length).map(sourceKey)])}>Chọn nhóm</button>
              </div>
              {blocked && <p className="mb-2 text-xs">Bỏ chọn nhóm hiện tại để chuyển sang loại hàng này.</p>}
              <div className="max-h-72 space-y-2 overflow-y-auto">{rows.map(row => {
                const selected = trips.some(trip => trip.key === sourceKey(row)), disabled = cannotSelect(row)
                return <label key={sourceKey(row)} className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3 ${selected ? 'border-current ring-1 ring-current' : 'border-white'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
                  <input type="checkbox" aria-label={`Chọn ${row.containerNumber}`} checked={selected} disabled={disabled} className="mt-1 h-4 w-4 accent-orange-600" onChange={event => selectSources(event.target.checked ? [...trips.map(trip => trip.key), sourceKey(row)] : trips.filter(trip => trip.key !== sourceKey(row)).map(trip => trip.key))} />
                  <span className="min-w-0"><span className="block font-semibold">{row.containerNumber}</span><span className="block text-xs">{row.containerTypeCode} · {row.carrierName || 'Công ty của bạn'}</span>{!inDocumentScope(row) && <span className="block text-xs text-rose-700">Chưa thuộc phạm vi chứng từ chung</span>}</span>
                </label>
              })}</div>
            </section>
          })}</div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Ngày chung<input aria-label="Ngày chung của lô" type="date" className={input} value={date} onChange={event => setDate(event.target.value)} /></label>
          <label className="text-sm">Từ<input aria-label="Giờ bắt đầu chung" type="time" className={input} value={startTime} onChange={event => setStartTime(event.target.value)} /></label>
          <label className="text-sm">Đến<input aria-label="Giờ kết thúc chung" type="time" className={input} value={endTime} onChange={event => setEndTime(event.target.value)} /></label>
          <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => { invalidate(); setTrips(previous => previous.map(trip => ({ ...trip, date, start: startTime, end: endTime }))) }}>Áp dụng giờ cho các chuyến</button>
          <button type="button" disabled={trips.length < 2} className="ml-auto rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" onClick={optimize}>Tối ưu các chuyến</button>
        </div>
        <p className="text-sm">Đã chọn {trips.length} container{currentPlan ? ` · Loại hàng: ${cargoName(currentPlan.cargoType)}` : ''}</p>
        {trips.length > 0 && <p className="text-xs text-slate-600">Nguồn: {trips[0].source.containerNumber} · Chỉ hiển thị container cùng loại hàng. Bỏ chọn toàn bộ để đổi nhóm hàng. Chứng từ sẽ được đối chiếu riêng.</p>}
        {trips.some(trip => !inDocumentScope(trip.source)) && <p role="alert" className="text-sm text-rose-700">Có container đã chọn chưa nằm trong phạm vi của mọi chứng từ dùng chung. Đối chiếu lại hồ sơ hoặc bỏ container không cùng bộ chứng từ.</p>}
        {currentPlan?.validationMessages?.length > 0 && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{currentPlan.validationMessages.map(message => <p key={message}>{message}</p>)}</div>}
        {error && !currentPlan && <p className="text-sm text-rose-700">Chưa tải được phương tiện: {error}</p>}
        <div className="space-y-4">{trips.map((trip, index) => {
          const recommendation = currentPlan?.trips[index], fleet = recommendation?.plan.fleet
          const cargo = sourceOperation(trip.source).cargoType?.toLowerCase()
          const cold = cargo === 'reefer', dangerous = ['dangerous', 'dangerous_goods', 'dangerousgoods'].includes(cargo)
          const trucks = fleet?.trucks.filter(truck => truck.id && truck.id !== emptyId && !reservedByOther(index, 'truckId', truck.id)) || []
          const drivers = fleet?.drivers.filter(driver => driver.id && driver.id !== emptyId && !reservedByOther(index, 'driverId', driver.id)) || []
          return <section key={trip.key} className="space-y-3 rounded-xl border border-chalk p-4">
            <h4 className="font-bold">Chuyến {index + 1} · {trip.source.containerNumber}</h4>
            <p className="text-xs text-slate-600">{trip.source.containerTypeCode} · Seal: {trip.source.sealNumber || 'Chưa khai báo'} · {trip.source.grossWeightKg == null ? 'Chờ xác minh hàng' : `${trip.source.grossWeightKg.toLocaleString()} kg`}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">Ngày<input required aria-label={`Ngày chuyến ${index + 1}`} type="date" className={input} value={trip.date} onChange={event => patchTrip(index, { date: event.target.value }, true)} /></label>
              <label className="text-sm">Từ<input required aria-label={`Giờ bắt đầu chuyến ${index + 1}`} type="time" className={input} value={trip.start} onChange={event => patchTrip(index, { start: event.target.value }, true)} /></label>
              <label className="text-sm">Đến<input required aria-label={`Giờ kết thúc chuyến ${index + 1}`} type="time" className={input} value={trip.end} onChange={event => patchTrip(index, { end: event.target.value }, true)} /></label>
              <label className="text-sm">Xe đầu kéo<select aria-label={`Xe chuyến ${index + 1}`} disabled={!fleet} className={input} value={trip.truckId} onChange={event => {
                const truckId = event.target.value, truck = trucks.find(row => row.id === truckId)
                const driverId = drivers.some(row => row.id === truck?.driverId) ? truck.driverId : trip.driverId
                const trailer = recommendation.trailerSuggestions?.find(row => row.truckId === truckId)?.trailerNumber || ''
                const trailerNumber = reservedByOther(index, 'trailerNumber', trailer) ? '' : trailer
                patchTrip(index, truckId ? { truckId, driverId, trailerNumber } : { truckId: '', driverId: '', trailerNumber: '' })
              }}><option value="">{fleet && !trucks.length ? 'Chưa có xe rảnh trong khung giờ' : 'Chọn xe rảnh'}</option>{trucks.map(truck => <option key={truck.id} value={truck.id}>{truck.plateNumber} · {truck.currentLocation || truck.vehicleType}</option>)}</select></label>
              <label className="text-sm">Tài xế<select aria-label={`Tài xế chuyến ${index + 1}`} disabled={!fleet} className={input} value={trip.driverId} onChange={event => patchTrip(index, event.target.value ? { driverId: event.target.value } : { truckId: '', driverId: '', trailerNumber: '' })}><option value="">{fleet && !drivers.length ? 'Chưa có tài xế rảnh trong khung giờ' : 'Chọn tài xế rảnh'}</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.fullName}{driver.phone ? ` · ${driver.phone}` : ''}</option>)}</select></label>
              <label className="text-sm">Rơ-moóc<input aria-label={`Rơ-moóc chuyến ${index + 1}`} maxLength={50} className={input} value={trip.trailerNumber} onChange={event => patchTrip(index, { trailerNumber: event.target.value.toUpperCase() })} /><span className="mt-1 block text-xs text-slate-500">{trip.trailerNumber && recommendation?.trailerSuggestions?.some(row => row.truckId === trip.truckId && row.trailerNumber === trip.trailerNumber) ? 'Gợi ý từ lịch sử xe; kiểm tra đúng moóc đang sử dụng.' : 'Chưa có gợi ý phù hợp; nhập biển theo hồ sơ moóc thực tế.'}</span></label>
              {cold && <label className="text-sm">Nhiệt độ (°C)<input required type="number" step="0.5" aria-label={`Nhiệt độ chuyến ${index + 1}`} className={input} value={trip.temperature} onChange={event => patchTrip(index, { temperature: event.target.value })} /></label>}
              {cold && direction === 'Dropoff' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={trip.power} disabled={!(trip.source.requiredPowerKw > 0)} onChange={event => patchTrip(index, { power: event.target.checked })} />Yêu cầu cấp điện ({trip.source.requiredPowerKw || 0} kW)</label>}
              {dangerous && <><label className="text-sm">Mã UN<input required aria-label={`Mã UN chuyến ${index + 1}`} className={input} value={trip.unNumber || ''} onChange={event => patchTrip(index, { unNumber: event.target.value })} /></label><label className="text-sm">Phân lớp nguy hiểm<input required aria-label={`Phân lớp chuyến ${index + 1}`} className={input} value={trip.dgClass || ''} onChange={event => patchTrip(index, { dgClass: event.target.value })} /></label></>}
            </div>
            <BookingFleetDetails vehicle={trucks.find(truck => truck.id === trip.truckId)} driver={drivers.find(driver => driver.id === trip.driverId)} />
            {recommendation && <p role={recommendation.cargoAvailable ? 'status' : 'alert'} className={`text-sm ${recommendation.cargoAvailable ? 'text-slate-600' : 'text-rose-700'}`}>{recommendation.plan.schedule.message}</p>}
          </section>
        })}</div>
        {currentPlan && !currentPlan.validationMessages?.length && <div className="space-y-4 rounded-2xl border border-chalk p-5">
          <div className="flex items-center gap-3 border-b border-chalk pb-4"><span aria-hidden="true" className="material-symbols-outlined rounded-full border border-orange-200 bg-orange-50 p-2 text-orange-600">folder_open</span><div><h4 className="font-bold uppercase">Chứng từ yêu cầu cho nghiệp vụ {direction === 'Dropoff' ? 'xuất khẩu' : 'nhập khẩu'}</h4><p className="text-xs text-slate-500">{direction === 'Dropoff' ? 'Booking Note, VGM và hồ sơ hải quan xuất khẩu' : 'Vận đơn B/L, lệnh D/O và hồ sơ hải quan nhập khẩu'} · Dùng chung cho {trips.length} container</p></div></div>
          <p className="text-sm text-slate-600">Tải tệp chứng từ rồi chọn container áp dụng từ danh sách có sẵn trong lô. Nhân viên đối chiếu nội dung tệp trước khi duyệt chuyến.</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{orderedRequirements.map(spec => {
            const meta = documentView(spec, direction), document = documents.find(doc => doc.documentType === spec.documentType)
            return <article key={spec.documentType} aria-label={meta.title} className={`flex min-w-0 flex-col gap-3 rounded-2xl border p-4 ${spec.isMandatory ? 'border-amber-300 bg-white' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-start justify-between gap-2"><h5 className="flex min-w-0 items-center gap-2 text-sm font-bold"><span aria-hidden="true" className="material-symbols-outlined text-slate-500">{meta.icon}</span>{meta.title}</h5><span className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold ${spec.isMandatory ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{spec.isMandatory ? 'BẮT BUỘC' : 'KHUYẾN NGHỊ'}</span></div>
            <p className="text-xs text-slate-500">{spec.description}</p>
            <label className={`mt-auto flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold focus-within:ring-2 focus-within:ring-orange-400 ${spec.isMandatory ? 'bg-amber-50 text-amber-800' : 'bg-white text-slate-700'}`}><span aria-hidden="true" className="material-symbols-outlined text-lg">upload</span>{document ? 'Thay tệp chứng từ' : 'Tải lên tệp chứng từ'}<input aria-label={`Tải ${spec.documentType}`} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={event => { const file = event.target.files[0]; event.target.value = ''; upload(spec.documentType, file) }} className="sr-only" /></label>
            {document && <div className="flex min-w-0 items-center justify-between gap-2 text-xs"><a href={document.fileUrl} target="_blank" rel="noopener noreferrer" className="truncate font-semibold text-teal-700 underline" title={document.fileName}>{document.fileName}</a><button type="button" className="shrink-0 font-semibold text-rose-700 underline" onClick={() => { setDocuments(previous => previous.filter(doc => doc.documentType !== spec.documentType)); setConfirmed(false) }}>Xóa</button></div>}
            {document && <fieldset aria-label={`Phạm vi ${spec.documentType}`} className="space-y-2 border-t border-slate-100 pt-3 text-xs">
              <legend className="pt-2 font-semibold">Container áp dụng</legend>
              <label className="flex cursor-pointer items-center gap-2 font-semibold"><input type="checkbox" aria-label={`Áp dụng ${spec.documentType} cho toàn bộ lô`} checked={trips.every(trip => document.containerNumbers.includes(trip.source.containerNumber.toUpperCase()))} onChange={event => {
                const containerNumbers = event.target.checked ? trips.map(trip => trip.source.containerNumber.toUpperCase()) : []
                setDocuments(previous => previous.map(doc => doc.documentType === spec.documentType ? { ...doc, containerNumbers } : doc)); setConfirmed(false)
              }} />Áp dụng cho toàn bộ lô</label>
              <div className="flex flex-wrap gap-2">{trips.map(trip => {
                const number = trip.source.containerNumber.toUpperCase()
                return <label key={trip.key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 ${document.containerNumbers.includes(number) ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600'}`}><input type="checkbox" aria-label={`Áp dụng ${spec.documentType} cho ${number}`} checked={document.containerNumbers.includes(number)} onChange={event => {
                  const containerNumbers = event.target.checked ? [...document.containerNumbers, number] : document.containerNumbers.filter(value => value !== number)
                  setDocuments(previous => previous.map(doc => doc.documentType === spec.documentType ? { ...doc, containerNumbers } : doc)); setConfirmed(false)
                }} />{number}</label>
              })}</div>
            </fieldset>}
          </article>})}</div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Tôi xác nhận chứng từ chung hợp lệ và áp dụng cho tất cả container trong lô.</label>
        </div>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={allowUnassigned} onChange={event => setAllowUnassigned(event.target.checked)} />Cho phép lưu chuyến chưa đủ xe/tài xế để phân công sau. Các chuyến này chưa có quyền qua cổng.</label>
        <label className="block text-sm">Ghi chú chung<textarea maxLength={1000} className={input} value={description} onChange={event => setDescription(event.target.value)} /></label>
        <div className="flex justify-end"><button type="submit" disabled={!currentPlan || currentPlan.validationMessages?.length > 0 || currentPlan.trips.some(trip => !trip.cargoAvailable)} className="rounded-xl bg-orange-600 px-5 py-3 font-bold text-white disabled:opacity-50">Tạo Booking theo lô</button></div>
      </fieldset>
      {(busy || uploading) && <p role="status" className="text-sm">{uploading ? 'Đang tải chứng từ…' : 'Đang xử lý lô…'}</p>}
    </form>
    <section className="space-y-3 rounded-2xl border border-chalk bg-white p-5">
      <div className="flex items-center justify-between"><h3 className="font-bold">Các Booking theo lô</h3><button type="button" className="text-sm underline" disabled={busy} onClick={reloadBatches}>Tải lại danh sách lô</button></div>
      {!batches.length && <p className="text-sm text-slate-500">Chưa có lô ở trang này.</p>}
      {batches.map(batch => <button key={batch.id} type="button" disabled={busy} onClick={() => open(batch.id)} className="flex w-full flex-wrap justify-between gap-2 rounded-xl border p-3 text-left text-sm"><b>{batch.batchCode}</b><span>{batch.totalTrips} chuyến · Đã ra cổng {batch.completedTrips} · {labels[batch.status] || batch.status}</span></button>)}
      <div className="flex justify-end gap-3 text-sm"><button type="button" disabled={page === 1 || busy} onClick={() => setPage(value => value - 1)}>Trang trước</button><span>Trang {page}</span><button type="button" disabled={batches.length < 20 || busy} onClick={() => setPage(value => value + 1)}>Trang sau</button></div>
    </section>
    {detail && <section className="space-y-3 rounded-2xl border border-teal-200 bg-white p-5" aria-label="Chi tiết Booking theo lô">
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{detail.batchCode} · {labels[detail.status] || detail.status}</h3><button type="button" disabled={busy} className="text-sm underline" onClick={() => open(detail.id)}>Cập nhật tiến độ lô</button></div>
      <p className="text-sm">{detail.totalTrips} chuyến · Đã ra cổng {detail.completedTrips} · Chờ phân công {detail.unassignedTrips} · Đã hủy {detail.canceledTrips}</p>
      {!!detail.sharedDocuments?.length && <div className="space-y-1 text-sm"><h4 className="font-semibold">Chứng từ dùng chung</h4><ul className="list-inside list-disc">{detail.sharedDocuments.map((document, index) => <li key={`${document.documentType}-${index}`}>
        {document.fileUrl && /^(https?:\/\/|\/uploads\/documents\/)/i.test(document.fileUrl)
          ? <a href={document.fileUrl} target="_blank" rel="noopener noreferrer" className="text-teal-800 underline">{document.fileName || document.documentType}</a>
          : <span>{document.documentNumber || document.fileName || document.documentType}</span>}
        <span className="ml-2 text-xs text-slate-600">Phạm vi: {document.containerNumbers?.length ? document.containerNumbers.join(', ') : 'Hồ sơ cũ chưa khai báo phạm vi'}</span>
      </li>)}</ul></div>}
      {detail.trips.map(trip => <div key={trip.booking.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm"><div><b>Chuyến {trip.sequenceNumber} · {trip.booking.operations?.[0]?.containerNumber}</b><p>{trip.booking.vehiclePlate || 'Chưa có xe'} · {trip.booking.driverName || 'Chưa có tài xế'} · {new Date(trip.booking.appointmentStart).toLocaleString('vi-VN')}</p><p>{trip.gateOutCompleted ? 'Đã ra cổng' : trip.gateInCompleted ? 'Đã vào cổng' : 'Chưa vào cổng'} · {trip.booking.status === 'Completed' && !trip.gateOutCompleted ? 'Đã giao nhận' : labels[trip.booking.status] || trip.booking.status}</p></div><div className="flex gap-2">
        {!trip.gateInCompleted && ['Pending', 'Ready', 'Approved'].includes(trip.booking.status) && (!trip.booking.truckId || !trip.booking.driverId) && <button type="button" disabled={busy} className="rounded-xl bg-orange-600 px-3 py-2 font-semibold text-white disabled:opacity-50" onClick={() => assign(trip)}>Tự phân công chuyến {trip.sequenceNumber}</button>}
        <button type="button" className="rounded-xl border px-3 py-2 font-semibold" onClick={() => navigate(`/booking?bookingId=${encodeURIComponent(trip.booking.id)}`)}>Xem chuyến / phân công</button></div></div>)}
    </section>}
  </div>
}
