import React, { useEffect, useRef, useState } from 'react'
import { driverSmartRouteService } from '../../services/driverSmartRouteService'

function RouteMap({ navigation }) {
  const points = navigation.waypoints
  if (!points?.length) return null
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  const left = Math.min(...xs), top = Math.min(...ys)
  const width = Math.max(Math.max(...xs) - left, 1)
  const height = Math.max(Math.max(...ys) - top, 1)
  const project = point => ({ x: 45 + (point.x - left) / width * 410, y: 45 + (point.y - top) / height * 230 })
  return (
    <svg viewBox="0 0 500 330" className="w-full rounded-xl bg-slate-900" role="img" aria-label={`Tuyến từ ${points[0].label} đến ${points[points.length - 1].label}`}>
      <title>Lộ trình nội bộ từ bản đồ bãi được cấu hình</title>
      <polyline points={points.map(point => { const p = project(point); return `${p.x},${p.y}` }).join(' ')} fill="none" stroke="#334155" strokeWidth="18" strokeLinejoin="round" />
      <polyline points={points.map(point => { const p = project(point); return `${p.x},${p.y}` }).join(' ')} fill="none" stroke="#38bdf8" strokeWidth="5" strokeLinejoin="round" />
      {points.map((point, index) => {
        const p = project(point)
        const endpoint = index === 0 || index === points.length - 1
        return <g key={point.id}>
          <circle cx={p.x} cy={p.y} r={endpoint ? 9 : 5} fill={index === 0 ? '#34d399' : index === points.length - 1 ? '#fb923c' : '#e2e8f0'} stroke="#0f172a" strokeWidth="2" />
          <text x={p.x} y={p.y + (index % 2 ? 24 : -18)} textAnchor={p.x > 400 ? 'end' : p.x < 100 ? 'start' : 'middle'} fill="#e2e8f0" fontSize="11">{point.label.length > 28 ? `${point.label.slice(0, 27)}…` : point.label}</text>
        </g>
      })}
      <text x="20" y="315" fill="#94a3b8" fontSize="10">● Xanh lá: xuất phát · Cam: điểm đến · Sơ đồ tuyến, không phải GPS</text>
    </svg>
  )
}

export default function DriverSmartRoute({ containerId, containerNumber, compact = false, onOpen }) {
  const [routes, setRoutes] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [currentNodeId, setCurrentNodeId] = useState('')
  const [route, setRoute] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [refreshKey, setRefreshKey] = useState(0)
  const previousRevision = useRef(null)
  const gateTransaction = useRef(null)

  useEffect(() => {
    let active = true
    let timer
    let pending = false
    async function refresh() {
      if (!active || pending) return
      if (!navigator.onLine) { setOnline(false); setLoading(false); return }
      pending = true
      try {
        const items = await driverSmartRouteService.list()
        if (!active) return
        const available = Array.isArray(items) ? items : []
        setRoutes(available)
        // A trip must never silently display a different container's route.
        const selected = containerId ? available.find(item => item.containerId === containerId)
          : containerNumber ? available.find(item => item.containerNumber === containerNumber)
            : available.find(item => item.containerId === selectedId) ?? available[0]
        if (!selected) { setRoute(null); setError(''); return }
        const sameGate = gateTransaction.current === selected.gateTransactionId
        const position = sameGate ? currentNodeId : ''
        const detail = compact || !selected.target ? selected
          : await driverSmartRouteService.get(selected.containerId, position)
        if (!active) return
        if (!sameGate) setCurrentNodeId('')
        gateTransaction.current = selected.gateTransactionId
        const revision = `${detail.containerId}:${detail.navigation?.revision}`
        setUpdated(previousRevision.current !== null && previousRevision.current !== revision)
        previousRevision.current = revision
        setRoute(detail)
        setOnline(true)
        setError('')
      } catch (err) {
        if (active) setError(err.message || 'Không thể tải lộ trình. Vui lòng thử lại.')
      } finally {
        pending = false
        if (active) { setLoading(false); timer = setTimeout(refresh, 15000) }
      }
    }
    const wake = () => {
      if (!active) return
      setOnline(navigator.onLine)
      clearTimeout(timer)
      if (navigator.onLine) void refresh()
    }
    setLoading(true)
    void refresh()
    window.addEventListener('online', wake)
    window.addEventListener('offline', wake)
    window.addEventListener('focus', wake)
    return () => {
      active = false
      clearTimeout(timer)
      window.removeEventListener('online', wake)
      window.removeEventListener('offline', wake)
      window.removeEventListener('focus', wake)
    }
  }, [containerId, containerNumber, selectedId, currentNodeId, compact, refreshKey])

  const target = route?.target
  const navigation = route?.navigation
  const canNavigate = navigation?.status === 'available' && !error && online && !loading
  const destination = target?.type === 'slot'
    ? `Block ${target.block} · Bay ${target.bay} · Row ${target.row} · Tier ${target.tier}`
    : target?.location

  return (
    <section className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-4" aria-label="Smart Route">
      <div className="flex justify-between items-center gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-wider uppercase text-slate">Điều hướng sau Gate In</p>
          <h2 className="text-lg font-extrabold text-carbon">Smart Route</h2>
        </div>
        <button type="button" onClick={() => setRefreshKey(value => value + 1)} disabled={loading} className="text-xs font-bold rounded-lg bg-fog border border-chalk p-2 disabled:opacity-50">{loading ? 'Đang tải…' : 'Cập nhật'}</button>
      </div>

      {(!online || error) && <p role="alert" className="text-sm bg-red-50 text-red-800 border border-red-200 rounded-xl p-3">{!online ? 'Mất kết nối. Lộ trình chưa được xác nhận lại. Vui lòng dừng ở nơi an toàn và kết nối lại.' : error}</p>}
      {!loading && !route && !error && online && <p role="status" className="text-sm text-slate bg-fog rounded-xl p-3">{containerId || containerNumber ? 'Container của chuyến này chưa có Gate In hợp lệ hoặc đã kết thúc hành trình.' : 'Chưa có container qua Gate In. Điểm đến và lộ trình sẽ tự cập nhật sau khi Gate In thành công.'}</p>}
      {!containerId && !containerNumber && routes.length > 1 && <label className="block text-xs font-bold text-slate">Container cần di chuyển
        <select value={route?.containerId || ''} onChange={event => { setRoute(null); setCurrentNodeId(''); setSelectedId(event.target.value); previousRevision.current = null }} className="block mt-1 w-full border border-chalk rounded-lg p-2 bg-white text-carbon">
          {routes.map(item => <option key={item.containerId} value={item.containerId}>{item.containerNumber}</option>)}
        </select>
      </label>}
      {route && <>
        <div className="bg-slate-900 text-white rounded-xl p-4 space-y-2">
          <p className="text-xs text-slate-300">Container <strong className="text-white font-mono">{route.containerNumber}</strong></p>
          <h3 className="font-bold">{destination || 'Đang chờ phân công điểm đến'}</h3>
          {target?.zone && <p className="text-xs text-slate-300">Khu {target.zone}</p>}
          <p className="text-xs text-slate-300">Cổng Gate In: {route.gateCode || route.route?.fromGate || navigation?.origin?.label || 'Đã xác nhận'}</p>
          {route.operation && <p className="text-xs text-slate-300">Operation: {route.operation.taskCode || route.operation.id} · {route.operation.type}</p>}
        </div>
        {updated && <p role="status" className="text-xs text-blue-800 bg-blue-50 p-3 rounded-xl">Điểm đến hoặc lộ trình đã được cập nhật. Vui lòng kiểm tra lại hướng dẫn.</p>}
        {navigation && !error && online && <p role="status" className={`text-sm p-3 rounded-xl border ${canNavigate ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>{navigation.message}</p>}
        {compact ? (
          <button type="button" onClick={onOpen} className="w-full rounded-xl bg-indigo-600 text-white font-bold py-3 text-sm">Xem điểm đến và tuyến đường</button>
        ) : canNavigate && <>
          <div className="flex gap-4 text-sm font-bold text-indigo-800">
            <span>{Math.round(navigation.distanceMeters)} m</span>
            <span>{navigation.estimatedSeconds === 0 ? 'Đang ở điểm đến' : `Khoảng ${Math.max(1, Math.ceil(navigation.estimatedSeconds / 60))} phút`}</span>
            {navigation.rerouted && <span className="text-amber-700">Tuyến thay thế</span>}
          </div>
          <RouteMap navigation={navigation} />
          <ol className="space-y-2 list-decimal pl-5 text-sm text-carbon">{navigation.directions.map((direction, index) => <li key={`${index}:${direction}`}>{direction}</li>)}</ol>
          <label className="block text-xs font-bold text-slate">Xác nhận vị trí hiện tại để tính lại tuyến
            <select value={currentNodeId || navigation.origin?.id || ''} onChange={event => setCurrentNodeId(event.target.value)} className="block mt-1 w-full border border-chalk rounded-lg p-2 bg-white text-carbon">
              {navigation.waypoints.map(point => <option key={point.id} value={point.id}>{point.label}</option>)}
            </select>
          </label>
          <p className="text-[11px] text-slate">Chỉ xác nhận khi xe đã đến điểm trên sơ đồ. Thời gian di chuyển là ước tính.</p>
        </>}
        {currentNodeId && !compact && <button type="button" onClick={() => setCurrentNodeId('')} className="text-xs font-bold text-indigo-700 underline">Tính lại từ cổng Gate In</button>}
        <p className="text-[10px] text-slate">Tự cập nhật mỗi 15 giây{navigation?.generatedAt ? ` · Đã kiểm tra ${new Date(navigation.generatedAt).toLocaleTimeString('vi-VN')}` : ''}</p>
      </>}
    </section>
  )
}
