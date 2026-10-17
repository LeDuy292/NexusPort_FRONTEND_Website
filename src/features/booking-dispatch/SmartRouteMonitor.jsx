import { useEffect, useRef, useState } from 'react'
import SmartYardMap from '../../components/Yard/SmartYardMap'
import { driverSmartRouteService } from '../../services/driverSmartRouteService'
import { connectDispatchBoard } from './dispatchService'
import { RouteJourney } from '../../pages/Driver/DriverSmartRoute'
import { routeDestination, routePhaseLabel } from '../../utils/smartRoutePresentation'
import '../../pages/Driver/DriverSmartRoute.css'
import './SmartRouteMonitor.css'

const identity = route => `${route.bookingId}:${route.containerId}`
const checkedTime = value => value ? new Date(value).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa có'

export default function SmartRouteMonitor() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [phase, setPhase] = useState('all')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [conditionTarget, setConditionTarget] = useState('')
  const [restricted, setRestricted] = useState(false)
  const [congestion, setCongestion] = useState(0)
  const [minutes, setMinutes] = useState(30)
  const reloadRef = useRef(() => {})
  useEffect(() => {
    let active = true, pending = false, retry = false
    async function reload() {
      if (!active) return
      if (pending) { retry = true; return }
      pending = true
      try {
        const next = await driverSmartRouteService.monitor()
        if (active) { setData(next); setError('') }
      } catch (err) { if (active) setError(err.message || 'Không tải được trạng thái xe.') }
      finally { pending = false; if (active) { setLoading(false); if (retry) { retry = false; void reload() } } }
    }
    reloadRef.current = reload
    void reload()
    const cleanup = connectDispatchBoard({ onChange: reload, onConnected: reload })
    const timer = setInterval(() => { if (!document.hidden) void reload() }, 15000)
    window.addEventListener('focus', reload)
    return () => { active = false; cleanup(); clearInterval(timer); window.removeEventListener('focus', reload) }
  }, [])
  const routes = Array.isArray(data?.routes) ? data.routes : []
  const visible = routes.filter(route => phase === 'all' || route.journey?.phase === phase)
  const selected = visible.find(route => identity(route) === selectedId) || visible[0]
  const map = selected?.navigation?.map
  const nodes = map?.nodes || []
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const conditionOptions = [
    ...(map?.edges || []).filter(edge => {
      const from = nodeById.get(edge.from), to = nodeById.get(edge.to)
      return from && to && (from.x !== to.x || from.y !== to.y) && !from.slotId && !to.slotId
    }).map(edge => ({ key: `edge:${edge.id}`, type: 'edge', id: edge.id, label: `${nodeById.get(edge.from)?.label} → ${nodeById.get(edge.to)?.label}`, restricted: edge.restricted, congestion: edge.congestion || 0 })),
    ...nodes.filter(node => !node.slotId && (node.gateCode || node.location || node.blockCode)).map(node => ({ key: `node:${node.id}`, type: 'node', id: node.id, label: `Khu vực: ${node.label}`, restricted: node.restricted, congestion: 0 })),
  ]
  const activeCondition = conditionOptions.find(option => option.key === conditionTarget)
  const chooseCondition = key => {
    const option = conditionOptions.find(item => item.key === key)
    setConditionTarget(key); setRestricted(Boolean(option?.restricted)); setCongestion(Math.round((option?.congestion || 0) * 100)); setFeedback('')
  }
  async function applyCondition(clear = false) {
    if (!activeCondition || busy || error) return
    setBusy(true); setFeedback('')
    try {
      await driverSmartRouteService.updateCondition({
        targetType: activeCondition.type, targetId: activeCondition.id,
        restricted: clear ? false : restricted,
        congestion: clear || activeCondition.type === 'node' ? 0 : Number(congestion) / 100,
        validUntil: new Date(Date.now() + Number(minutes) * 60000).toISOString(),
      })
      if (clear) { setRestricted(false); setCongestion(0) }
      setFeedback(clear ? 'Đã khôi phục lưu thông. Lộ trình của tài xế sẽ được tính lại.' : 'Đã cập nhật điều kiện di chuyển. Lộ trình của tài xế sẽ được tính lại.')
      await reloadRef.current()
    } catch (err) { setFeedback(`Không thể cập nhật: ${err.message}`) }
    finally { setBusy(false) }
  }
  const trucks = new Set(routes.filter(route => route.journey?.phase !== 'exited').map(route => route.bookingId)).size
  return <section className="yard-route-monitor" aria-label="Theo dõi xe và tuyến đường trong bãi">
    <header className="yard-monitor-header"><div><p>SMART YARD · SAU GATE IN</p><h2>Theo dõi xe trong bãi <span>{trucks} chuyến đang hoạt động</span></h2><small>Gate In → điểm giao nhận → xác nhận container → Gate Out</small></div>
      <button type="button" disabled={busy} onClick={() => void reloadRef.current()}>↻ Cập nhật</button>
    </header>
    {error && <p className="smart-route-alert error" role="alert">Không xác nhận được dữ liệu mới: {error}. Trạng thái đang hiển thị là lần kiểm tra trước.</p>}
    <div className="yard-monitor-toolbar"><label>Trạng thái xe <select value={phase} onChange={event => { setPhase(event.target.value); setSelectedId('') }}><option value="all">Tất cả</option>{Object.entries(routePhaseLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><small>Cập nhật mỗi 15 giây · {checkedTime(data?.generatedAt)}</small></div>
    {loading && !data && <p className="smart-route-empty">Đang tải trạng thái xe từ giao dịch cổng…</p>}
    {!loading && !visible.length && <p className="smart-route-empty">Chưa có xe trong nhóm này. Xe xuất hiện sau khi Gate Officer xác nhận Gate In.</p>}
    {visible.length > 0 && <div className="yard-monitor-workspace">
      <div className="yard-monitor-vehicles">{visible.map(route => <button type="button" key={identity(route)} className={`yard-monitor-vehicle ${identity(route) === identity(selected) ? 'selected' : ''}`} onClick={() => { setSelectedId(identity(route)); setConditionTarget(''); setFeedback('') }}>
        <div><strong>{route.truckPlate || 'Chưa có biển số'}</strong><span>{route.driverName || 'Tài xế được phân công'}</span></div><span className={`yard-monitor-phase ${route.journey?.phase}`}>{routePhaseLabel[route.journey?.phase] || route.gateStatus}</span>
        <p>{route.containerNumber} · {route.bookingCode || route.bookingId.slice(0, 8)}</p><small>{routeDestination(route)}</small>
        {route.navigation?.status !== 'available' && route.journey?.phase !== 'exited' && <span className="yard-monitor-warning">⚠ {route.navigation?.message || 'Chưa có tuyến khả dụng'}</span>}
      </button>)}</div>
      {selected && <div className="yard-monitor-detail"><div className="yard-monitor-heading"><div><strong>{routeDestination(selected)}</strong><p>{selected.containerNumber} · Vào {selected.gateCode}{selected.operation ? ` · Lệnh ${selected.operation.taskCode || selected.operation.id.slice(0, 8)}` : ''}</p></div></div>
        <RouteJourney journey={selected.journey} />
        {!error && <SmartYardMap navigation={selected.navigation} target={selected.target} label={`Lộ trình của xe ${selected.truckPlate || selected.containerNumber}`} />}
        {selected.navigation?.status !== 'available' && selected.journey?.phase !== 'exited' && <div role="status" className="smart-route-alert">{selected.navigation?.message}</div>}
        <p className="smart-map-note">Vị trí xe được cập nhật khi tài xế xác nhận đến điểm bãi; cổng xác nhận vào / ra. Xe không được theo dõi bằng GPS.</p>
        {map && <details className="yard-condition-panel"><summary>Điều chỉnh hạn chế / ùn tắc trên bản đồ</summary>
          <label>Đoạn đường hoặc khu vực<select value={conditionTarget} disabled={busy || Boolean(error)} onChange={event => chooseCondition(event.target.value)}><option value="">Chọn vị trí cần cập nhật</option>{conditionOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
          {activeCondition && <><label className="yard-condition-check"><input type="checkbox" checked={restricted} disabled={busy} onChange={event => setRestricted(event.target.checked)} />Tạm hạn chế di chuyển qua vị trí này</label>
            {activeCondition.type === 'edge' && <label>Mức độ ùn tắc: {congestion}%<input type="range" min="0" max="100" step="10" disabled={busy} value={congestion} onChange={event => setCongestion(Number(event.target.value))} /></label>}
            <label>Hiệu lực (phút)<input type="number" min="1" max="1440" value={minutes} disabled={busy} onChange={event => setMinutes(event.target.value)} /></label>
            <div className="yard-condition-buttons"><button type="button" disabled={busy || Boolean(error) || Number(minutes) < 1 || Number(minutes) > 1440} onClick={() => void applyCondition()}>{busy ? 'Đang lưu…' : 'Áp dụng và tính lại tuyến'}</button><button type="button" disabled={busy || Boolean(error)} onClick={() => void applyCondition(true)}>Khôi phục lưu thông</button></div>
          </>}
          {feedback && <p role="status" className="smart-route-alert info">{feedback}</p>}
        </details>}
      </div>}
    </div>}
  </section>
}
