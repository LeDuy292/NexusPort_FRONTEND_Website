import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CalendarClock, Loader2, RefreshCw, Truck } from 'lucide-react'
import BookingFleetDetails from '../../components/Containers/BookingFleetDetails'
import { bookingService } from '../../services/bookingService'
import { draftDateTime, draftError, serviceDraftsApi } from './serviceDraftsApi'
import './serviceTripFleet.css'
import Select from '../../components/ui/Select'

const instant = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null
const local = value => {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const overlap = (a, b) => new Date(a.appointmentStart) < new Date(b.appointmentEnd) && new Date(b.appointmentStart) < new Date(a.appointmentEnd)

export default function ServiceTripFleet({
  request,
  containers,
  onTrips,
  disabled = false,
  minDate,
  maxDate,
  scheduleNotice,
}) {
  const [options, setOptions] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const defaultStartTime = new Date(Date.now() + 2 * 3600000).toISOString()
  const start = instant(request.plannedAt) || defaultStartTime
  const trips = request.lines.map(line => {
    const existing = request.delivery.trips?.find(t => t.sourceContainerId === line.sourceContainerId)
    const tripStart = existing?.appointmentStart || start
    const tripEnd = existing?.appointmentEnd || new Date(new Date(tripStart).getTime() + 2 * 3600000).toISOString()
    return {
      sourceContainerId: line.sourceContainerId,
      appointmentStart: tripStart,
      appointmentEnd: tripEnd,
      truckId: existing?.truckId || null,
      driverId: existing?.driverId || null,
      vehicle: existing?.vehicle || null,
      driver: existing?.driver || null,
    }
  })
  const body = { ...request, delivery: { ...request.delivery, trips } }
  const signature = JSON.stringify([request.flow, request.source, request.plannedAt, trips.map(t => [t.sourceContainerId, t.appointmentStart, t.appointmentEnd, t.truckId, t.driverId])])
  const latest = useRef({ signature, body, onTrips })
  latest.current = { signature, body, onTrips }

  useEffect(() => {
    let cancelled = false
    setOptions({})
    setError('')
    if (disabled || !trips.length || trips.some(t => !t.appointmentStart || !t.appointmentEnd || new Date(t.appointmentEnd) <= new Date(t.appointmentStart))) {
      setBusy(false)
      return
    }
    setBusy(true)
    const timer = setTimeout(async () => {
      const applyFallback = async (failure) => {
        try {
          const res = await bookingService.getAvailableResources()
          if (cancelled || latest.current.signature !== signature) return
          const trucks = res?.trucks || []
          const drivers = res?.drivers || []
          if (!trucks.length && !drivers.length) {
            setOptions({})
            setError(draftError(failure))
            return
          }
          const byId = Object.fromEntries(latest.current.body.delivery.trips.map((trip, idx) => {
            const truck = trucks.length ? trucks[idx % trucks.length] : null
            const driver = (truck?.driverId && drivers.find(d => d.id === truck.driverId)) ||
              (drivers.length ? drivers[idx % drivers.length] : null)
            return [trip.sourceContainerId, {
              sourceContainerId: trip.sourceContainerId,
              trucks,
              drivers,
              recommendedTruckId: truck?.id || null,
              recommendedDriverId: driver?.id || null,
              message: res?.message || 'Đã tự động ghép xe và tài xế phụ trách cho container từ đội xe trong CSDL.',
              unavailableReasons: res?.unavailableReasons || []
            }]
          }))
          setOptions(byId)
          latest.current.onTrips(latest.current.body.delivery.trips.map((trip) => {
            const item = byId[trip.sourceContainerId]
            const truck = item?.trucks.find(t => t.id === (trip.truckId || item.recommendedTruckId))
            const driver = item?.drivers.find(d => d.id === (trip.driverId || item.recommendedDriverId))
            return {
              ...trip,
              truckId: trip.truckId || item?.recommendedTruckId || null,
              driverId: trip.driverId || item?.recommendedDriverId || null,
              vehicle: trip.vehicle || truck || null,
              driver: trip.driver || driver || null
            }
          }))
          setError('')
        } catch {
          if (!cancelled && latest.current.signature === signature) {
            setOptions({})
            setError(draftError(failure))
          }
        }
      }

      try {
        const result = await serviceDraftsApi.fleetOptions(latest.current.body)
        if (cancelled || latest.current.signature !== signature) return
        const byId = Object.fromEntries(result.items.map(item => [item.sourceContainerId, item]))
        setOptions(byId)
        latest.current.onTrips(latest.current.body.delivery.trips.map(trip => {
          const item = byId[trip.sourceContainerId]
          return { ...trip, truckId: item?.recommendedTruckId || null, driverId: item?.recommendedDriverId || null,
            vehicle: item?.trucks.find(t => t.id === item.recommendedTruckId) || null,
            driver: item?.drivers.find(d => d.id === item.recommendedDriverId) || null }
        }))
      } catch (failure) {
        if (!cancelled && latest.current.signature === signature) {
          await applyFallback(failure)
        }
      } finally { if (!cancelled && latest.current.signature === signature) setBusy(false) }
    }, 400)
    return () => { cancelled = true; clearTimeout(timer) }
    // Signature deliberately excludes profile snapshots and volatile document URLs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, reload, disabled])

  const changeTime = (id, field, value) => onTrips(trips.map(t => t.sourceContainerId === id
    ? { ...t, [field]: instant(value), truckId: null, driverId: null, vehicle: null, driver: null } : t))
  const select = (id, field, value) => onTrips(trips.map(t => {
    if (t.sourceContainerId !== id) return t
    const item = options[id]
    if (field === 'truckId') {
      const vehicle = item?.trucks.find(x => x.id === value)
      const driver = item?.drivers.find(x => x.id === vehicle?.driverId
        && !trips.some(other => other.sourceContainerId !== id && overlap(other, t) && other.driverId === x.id))
      return { ...t, truckId: value || null, vehicle: vehicle || null,
        ...(driver ? { driverId: driver.id, driver } : {}) }
    }
    return { ...t, driverId: value || null, driver: item?.drivers.find(x => x.id === value) || null }
  }))

  return <div className="esf-root epd-wide" aria-label="Phân công theo từng container">
    <div className="esf-heading"><div><h4><CalendarClock size={18} /> Lịch xe và tài xế theo container</h4><p>Ưu tiên tài xế phụ trách xe, đối chiếu lịch rảnh theo Booking. Mỗi chuyến tối đa 24 giờ.</p></div>
      <button className="epc-button secondary" type="button" disabled={busy || disabled} onClick={() => setReload(v => v + 1)}><RefreshCw size={15} />Gợi ý lại</button></div>
    <p className="esf-notice">Đây là đề xuất gửi Dispatcher cùng hồ sơ. Xe và tài xế được kiểm tra lại khi gửi; việc giữ lịch vận chuyển do bộ phận điều phối thực hiện.</p>
    {scheduleNotice && (
      <div className="esf-auto-hint" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '8px 12px', margin: '10px 0', fontSize: '12px', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>💡</span>
        <span>{scheduleNotice}</span>
      </div>
    )}
    {busy && <p className="esf-loading" role="status"><Loader2 size={17} className="epc-spin" />Đang tìm xe và tài xế rảnh…</p>}
    {error && <p className="epd-warning" role="alert"><AlertCircle size={17} />{error}</p>}
    {trips.map((trip, index) => {
      const fleet = options[trip.sourceContainerId]
      const others = trips.filter(t => t.sourceContainerId !== trip.sourceContainerId && overlap(t, trip))
      return <article className="esf-trip" key={trip.sourceContainerId}>
        <header><span className="esf-index">{String(index + 1).padStart(2, '0')}</span><div><h4>{containers[trip.sourceContainerId]?.containerNumber || `Container ${index + 1}`}</h4><small>Chuyến giao nhận · {containers[trip.sourceContainerId]?.typeCode || 'Container hàng'}</small></div><Truck size={21} /></header>
        <div className="epd-form-grid">
          <label className="epd-field"><span>Xe rảnh <b className="epd-required">*</b></span><Select aria-label={`Xe chuyến ${index + 1}`} value={trip.truckId || ''} disabled={busy || disabled || !fleet} onChange={e => select(trip.sourceContainerId, 'truckId', e.target.value)}><option value="">Chọn xe trong khung giờ</option>{fleet?.trucks.filter(t => !others.some(x => x.truckId === t.id)).map(t => <option key={t.id} value={t.id}>{t.plateNumber} · {t.vehicleType}</option>)}</Select></label>
          <label className="epd-field"><span>Tài xế rảnh <b className="epd-required">*</b></span><Select aria-label={`Tài xế chuyến ${index + 1}`} value={trip.driverId || ''} disabled={busy || disabled || !fleet} onChange={e => select(trip.sourceContainerId, 'driverId', e.target.value)}><option value="">Chọn tài xế trong khung giờ</option>{fleet?.drivers.filter(d => !others.some(x => x.driverId === d.id)).map(d => <option key={d.id} value={d.id}>{d.fullName} · {d.phone || 'Chưa có SĐT'}</option>)}</Select></label>
        </div>
        {fleet && <p className={trip.truckId && trip.driverId ? 'esf-ready' : 'esf-unavailable'}>{fleet.message}{(!trip.truckId || !trip.driverId) && fleet.unavailableReasons?.length > 0 && ` ${fleet.unavailableReasons.join(' ')}`}</p>}
        <details className="esf-details"><summary>Xem thông tin xe và tài xế phụ trách</summary><BookingFleetDetails vehicle={trip.vehicle} driver={trip.driver} /></details>
      </article>
    })}
  </div>
}

export function ServiceTripSummary({ trips = [], containers = [], showProfiles = false }) {
  return <div className="esf-summaries">{trips.map((trip, index) => <div className="esf-summary" key={trip.sourceContainerId}>
    <strong>{containers.find(c => c.sourceContainerId === trip.sourceContainerId)?.containerNumber || `Container ${index + 1}`}</strong>
    <span>{draftDateTime(trip.appointmentStart)} → {draftDateTime(trip.appointmentEnd)}</span>
    <span>{trip.vehicle?.plateNumber || 'Chưa chọn xe'} · {trip.driver?.fullName || 'Chưa chọn tài xế'} · {trip.driver?.phone || 'Chưa có SĐT'}</span>
    {showProfiles && <details className="esf-details"><summary>Hồ sơ xe và tài xế đã lưu</summary><BookingFleetDetails vehicle={trip.vehicle} driver={trip.driver} saved /></details>}
  </div>)}</div>
}
