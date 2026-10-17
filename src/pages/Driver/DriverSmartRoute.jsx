import { useEffect, useRef, useState } from 'react'
import { driverSmartRouteService } from '../../services/driverSmartRouteService'
import { subscribeDriverTripEvents } from '../../services/driverRealtimeService'
import SmartYardMap from '../../components/Yard/SmartYardMap'
import { routePhaseLabel, routeDestination } from '../../utils/smartRoutePresentation'
import './DriverSmartRoute.css'

const routeKey = route => `${route.bookingId}:${route.containerId}`
const time = value => value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : ''

export function RouteJourney({ journey }) {
  const phase = journey?.phase
  const active = phase === 'exited' ? 4 : phase === 'ready_for_gate_out' ? 3 : phase === 'at_yard' ? 2 : 1
  return <ol className="smart-journey" aria-label="Tiến trình xe trong bãi">
    {[
      ['Gate In', journey?.gateInAt], ['Đến điểm đích', journey?.arrivedAt],
      ['Nhận / giao cont', journey?.containerConfirmedAt], ['Gate Out', journey?.gateOutAt],
    ].map(([label, at], index) => <li key={label} className={at ? 'done' : index === active ? 'active' : ''}>
      {at ? '✓ ' : ''}{label}{at && <time dateTime={at}>{time(at)}</time>}
    </li>)}
  </ol>
}

export default function DriverSmartRoute({ containerId, containerNumber, bookingId, compact = false, onOpen, onStatusUpdated }) {
  const [routes, setRoutes] = useState([])
  const [selectedKey, setSelectedKey] = useState('')
  const [currentNodeId, setCurrentNodeId] = useState('')
  const [route, setRoute] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [condition, setCondition] = useState('OK')
  const [notes, setNotes] = useState('')
  const [updated, setUpdated] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [refreshKey, setRefreshKey] = useState(0)
  const previousRevision = useRef(null)
  const previousJourney = useRef(null)

  useEffect(() => {
    let active = true, pending = false, retry = false, timer
    async function refresh() {
      if (!active) return
      if (pending) { retry = true; return }
      if (!navigator.onLine) { setOnline(false); setLoading(false); return }
      pending = true
      try {
        const items = await driverSmartRouteService.list()
        if (!active) return
        const available = Array.isArray(items) ? items : []
        setRoutes(available)
        const scoped = available.filter(item => !bookingId || item.bookingId === bookingId)
        const selected = containerId ? scoped.find(item => item.containerId === containerId)
          : containerNumber ? scoped.find(item => item.containerNumber === containerNumber)
            : selectedKey ? scoped.find(item => routeKey(item) === selectedKey) : scoped[0]
        if (!selected) { setRoute(null); setError(''); return }
        const identity = `${selected.gateTransactionId}:${selected.journey?.phase}`
        const sameJourney = previousJourney.current === identity
        const position = sameJourney ? currentNodeId : ''
        const detail = compact || !selected.target ? selected
          : await driverSmartRouteService.get(selected.containerId, position, selected.bookingId)
        if (!active) return
        if (!sameJourney) { setCurrentNodeId(''); setShowConfirm(false) }
        previousJourney.current = identity
        const revision = `${routeKey(detail)}:${detail.navigation?.revision}`
        if (previousRevision.current && previousRevision.current !== revision) setUpdated(true)
        previousRevision.current = revision
        setRoute(detail); setOnline(true); setError('')
      } catch (err) {
        if (!active) return
        // 401/403: tài xế chưa được phân công hoặc tài khoản chưa liên kết với driver
        // Đây không phải lỗi hệ thống — chỉ hiển thị trạng thái "chưa có Gate In"
        const status = err?.status
        if (status === 401 || status === 403) {
          setRoute(null); setError('')
        } else if (active) {
          setError(err.message || 'Không thể tải lộ trình. Vui lòng thử lại.')
        }
      } finally {
        pending = false
        if (active) {
          setLoading(false)
          if (retry) { retry = false; void refresh() }
          else timer = setTimeout(refresh, 15000)
        }
      }
    }
    const wake = () => { if (!active) return; setOnline(navigator.onLine); clearTimeout(timer); if (navigator.onLine) void refresh() }
    setLoading(true); void refresh()
    const stop = subscribeDriverTripEvents({ onOperationCompleted: wake, onTripStatusUpdated: wake, onConnected: wake })
    window.addEventListener('online', wake); window.addEventListener('offline', wake); window.addEventListener('focus', wake)
    return () => { active = false; clearTimeout(timer); stop(); window.removeEventListener('online', wake); window.removeEventListener('offline', wake); window.removeEventListener('focus', wake) }
  }, [containerId, containerNumber, bookingId, selectedKey, currentNodeId, compact, refreshKey])

  const navigation = route?.navigation
  const journey = route?.journey
  const isAvailable = navigation?.status === 'available' && !error && online && !loading
  const verified = !error && online && !loading && !busy
  const selectRoute = key => {
    setRoute(null); setSelectedKey(key); setCurrentNodeId(''); setShowConfirm(false); setActionError(''); setUpdated(false)
    previousRevision.current = null; previousJourney.current = null
  }
  async function perform(action) {
    if (!route || !verified) return
    setBusy(true); setActionError('')
    try {
      const result = action === 'arrive'
        ? await driverSmartRouteService.arrive(route.containerId, route.bookingId, navigation?.destinationNode?.id)
        : await driverSmartRouteService.confirmContainer(route.containerId, route.bookingId, condition, notes)
      if (result?.containerId) setRoute(result)
      setCurrentNodeId(''); setShowConfirm(false); setNotes(''); setUpdated(false)
      setRefreshKey(value => value + 1); onStatusUpdated?.()
    } catch (err) { setActionError(err.message || 'Không thể cập nhật. Vui lòng thử lại.') }
    finally { setBusy(false) }
  }

  return <section className="smart-route" aria-label="Smart Route">
    <header className="smart-route-heading"><div><p>SMART ROUTE · ĐIỀU HƯỚNG NỘI BỘ</p><h2>{journey?.phase === 'exited' ? 'Hành trình đã hoàn tất' : journey?.phase === 'ready_for_gate_out' ? 'Di chuyển tới cổng ra' : 'Từ cổng vào điểm giao nhận'}</h2></div>
      <button type="button" className="smart-route-refresh" disabled={loading || busy} onClick={() => setRefreshKey(value => value + 1)} aria-label="Cập nhật lộ trình">{loading ? 'Đang tải…' : '↻ Cập nhật'}</button>
    </header>
    <div className="smart-route-body">
      {(!online || error) && <p role="alert" className="smart-route-alert error">{!online ? 'Mất kết nối. Lộ trình chưa được xác nhận lại. Hãy dừng ở nơi an toàn và kết nối lại.' : error}</p>}
      {loading && !route && <div role="status" className="smart-route-empty">Đang kiểm tra Gate In và điểm đến…</div>}
      {!loading && !route && !error && online && <div role="status" className="smart-route-empty">{containerId || containerNumber ? 'Chưa có Gate In hợp lệ cho container của chuyến này.' : 'Chưa có xe qua Gate In. Khi nhân viên cổng xác nhận, điểm đến và lộ trình sẽ hiển thị tại đây.'}</div>}
      {!containerId && !containerNumber && routes.length > 1 && <label className="smart-route-position">Chuyến / container
        <select value={route ? routeKey(route) : ''} onChange={event => selectRoute(event.target.value)} disabled={busy} className="smart-route-select">{routes.map(item => <option key={routeKey(item)} value={routeKey(item)}>{item.containerNumber} · {item.bookingCode || item.bookingId.slice(0, 8)}</option>)}</select>
      </label>}
      {route && <>
        <div className="smart-route-destination"><small>{journey?.phase === 'ready_for_gate_out' ? 'ĐIỂM ĐẾN TIẾP THEO' : 'ĐIỂM GIAO NHẬN ĐƯỢC PHÂN CÔNG'}</small>
          <h3>{routeDestination(route)}</h3><div className="smart-route-meta"><span>{route.containerNumber}</span>{route.truckPlate && <span>{route.truckPlate}</span>}{route.bookingCode && <span>{route.bookingCode}</span>}</div>
          <div className="smart-route-meta"><span>Vào {route.gateCode || 'cổng được phân công'}</span>{route.operation && <span>Lệnh {route.operation.taskCode || route.operation.id.slice(0, 8)}</span>}</div>
          {journey && <span className="smart-route-phase">{routePhaseLabel[journey.phase] || journey.phase}</span>}
        </div>
        <RouteJourney journey={journey} />
        {updated && <div role="status" className="smart-route-alert info">Điểm đến hoặc điều kiện di chuyển đã thay đổi. Vui lòng kiểm tra tuyến mới.</div>}
        {navigation && online && !error && journey?.phase !== 'exited' && <div role="status" className={`smart-route-alert ${isAvailable ? 'success' : ''}`}>{navigation.message}</div>}
        {compact ? <button type="button" onClick={() => onOpen?.(route)} className="smart-route-primary">Xem bản đồ và hành trình →</button> : <>
          {isAvailable && <div className="smart-route-stats"><strong>{Math.round(navigation.distanceMeters || 0)}<small>m</small></strong><strong>{Math.max(0, Math.ceil((navigation.estimatedSeconds || 0) / 60))}<small>phút dự kiến</small></strong>{navigation.rerouted && <span className="alternate">Tuyến thay thế</span>}</div>}
          {online && !error && <SmartYardMap navigation={navigation} target={route.target} />}
          {isAvailable && <>
            <ol className="smart-route-directions">{navigation.directions?.map((direction, index) => <li key={`${index}:${direction}`}>{direction}</li>)}</ol>
            <label className="smart-route-position">Tính lại từ vị trí xe đã tới
              <select value={currentNodeId || navigation.origin?.id || ''} disabled={busy} onChange={event => { setCurrentNodeId(event.target.value); setUpdated(false) }} className="smart-route-select">{navigation.waypoints?.map(point => <option key={point.id} value={point.id}>{point.label}</option>)}</select>
            </label>
          </>}
          {actionError && <div role="alert" className="smart-route-alert error">{actionError}</div>}
          <div className="smart-route-actions">
            {journey?.canArrive && <button type="button" onClick={() => void perform('arrive')} disabled={!verified || !isAvailable} className="smart-route-primary">{busy ? 'Đang cập nhật…' : 'Tôi đã đến điểm giao nhận'}</button>}
            {journey?.phase === 'at_yard' && !journey.canConfirmContainer && <div className="smart-route-alert">{journey.containerConfirmedAt ? 'Đã xác nhận container này. Hoàn tất các container còn lại của booking trước khi ra cổng.' : 'Chờ nhân viên bãi hoàn tất lệnh giao nhận. Nút xác nhận container sẽ mở sau khi hệ thống ghi nhận kết quả.'}</div>}
            {journey?.canConfirmContainer && !showConfirm && <button type="button" onClick={() => setShowConfirm(true)} disabled={!verified} className="smart-route-primary">Xác nhận {String(route.bookingType).toLowerCase() === 'pickup' ? 'đã nhận' : 'giao nhận'} container</button>}
            {journey?.canConfirmContainer && showConfirm && <div className="smart-route-form">
              <label>Tình trạng container<select className="smart-route-select" disabled={busy} value={condition} onChange={event => setCondition(event.target.value)}><option value="OK">Nguyên vẹn · Đúng container</option><option value="DAMAGED">Hư hỏng · Cần kiểm tra</option><option value="ISSUE">Có vấn đề khác</option></select></label>
              <label>Ghi chú<textarea rows="2" maxLength="1000" disabled={busy} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Kiểm tra số container và tình trạng trước khi xác nhận" /></label>
              <button type="button" disabled={!verified || (condition !== 'OK' && !notes.trim())} onClick={() => void perform('confirm')} className="smart-route-primary">{busy ? 'Đang xác nhận…' : 'Xác nhận thông tin container'}</button>
              <button type="button" disabled={busy} onClick={() => setShowConfirm(false)} className="smart-route-secondary">Quay lại kiểm tra</button>
            </div>}
            {journey?.phase === 'ready_for_gate_out' && <p className="smart-route-alert info">Di chuyển theo tuyến đến {journey.exitGateCode || 'cổng ra'}. Nhân viên cổng sẽ kiểm tra và xác nhận xe đã ra cảng.</p>}
            {journey?.phase === 'exited' && <p className="smart-route-alert success">Đã hoàn tất hành trình. Xe đã được nhân viên cổng xác nhận Gate Out lúc {time(journey.gateOutAt)}.</p>}
          </div>
        </>}
        <div className="smart-route-footer"><span>Tự kiểm tra mỗi 15 giây{navigation?.generatedAt ? ` · ${time(navigation.generatedAt)}` : ''}</span><span>Gate In / Out do nhân viên cổng xác nhận</span></div>
      </>}
    </div>
  </section>
}
