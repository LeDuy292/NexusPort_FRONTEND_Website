import React, { useState, useEffect, useMemo, useCallback } from 'react'

// ─── MOCK DATA ─────────────────────────────────────────────────────────────────
const INITIAL_CAMERAS = [
  // Gate Cameras
  {
    id: 'CAM-001', name: 'Cổng Vào', location: 'Cổng A – Cảng Tiên Sa',
    zone: 'GATE', type: 'GATE', status: 'ONLINE',
    vehicles: 4, trafficStatus: 'MODERATE', alertType: null,
    gateWaiting: 4, gateProcessing: 1, gateApproved: 8, gateRejected: 1,
    detectedVehicles: [
      { id: 'TRK-001', plate: '43C-123.45', driver: 'Nguyễn Văn A', status: 'ON_TRIP', task: 'DSP-20260811-001', container: 'MSCU1234567', gateBooking: 'GB-20260811-001', bookingStatus: 'PENDING' },
      { id: 'TRK-005', plate: '43C-567.89', driver: 'Trần Văn B', status: 'ASSIGNED', task: 'DSP-20260811-004', container: 'EVER991203', gateBooking: 'GB-20260811-002', bookingStatus: 'VERIFIED' },
      { id: 'TRK-012', plate: '92C-445.11', driver: 'Lê Văn C', status: 'ON_TRIP', task: 'DSP-20260811-005', container: 'MSCU9900112', gateBooking: 'GB-20260811-004', bookingStatus: 'PENDING' },
    ],
    lastUpdate: 2, avgSpeed: null, img: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=800',
  },
  {
    id: 'CAM-002', name: 'Cổng Ra', location: 'Cổng A – Cảng Tiên Sa',
    zone: 'GATE', type: 'GATE', status: 'ONLINE',
    vehicles: 2, trafficStatus: 'CLEAR', alertType: null,
    gateWaiting: 2, gateProcessing: 0, gateApproved: 12, gateRejected: 0,
    detectedVehicles: [
      { id: 'TRK-008', plate: '15C-882.19', driver: 'Phạm Văn D', status: 'ASSIGNED', task: 'DSP-20260811-007', container: 'MSCU4455667', gateBooking: 'GB-20260811-003', bookingStatus: 'VERIFIED' },
    ],
    lastUpdate: 5, avgSpeed: null, img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=800',
  },
  {
    id: 'CAM-003', name: 'Khu vực Kiểm tra (Gate Inspection)', location: 'Cổng A – Khu kiểm tra',
    zone: 'GATE', type: 'GATE', status: 'WARNING',
    vehicles: 1, trafficStatus: 'CLEAR', alertType: 'CONNECTION_UNSTABLE',
    gateWaiting: 1, gateProcessing: 1, gateApproved: 5, gateRejected: 1,
    detectedVehicles: [],
    lastUpdate: 18, avgSpeed: null, img: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=800',
  },
  // Yard Cameras
  {
    id: 'CAM-004', name: 'Khối bãi A (Block A)', location: 'Bãi Container – Khối A',
    zone: 'YARD', type: 'YARD', status: 'ONLINE',
    vehicles: 3, trafficStatus: 'CLEAR', alertType: null,
    containers: 124, yardActivity: 'NORMAL',
    detectedVehicles: [
      { id: 'YTR-003', plate: 'YT-003', driver: 'Võ Thị F', status: 'ON_TRIP', task: 'DSP-20260811-003', container: 'MSCU7788990', gateBooking: null, bookingStatus: null },
    ],
    lastUpdate: 3, avgSpeed: null, img: 'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?q=80&w=800',
  },
  {
    id: 'CAM-005', name: 'Khối bãi B (Block B)', location: 'Bãi Container – Khối B',
    zone: 'YARD', type: 'YARD', status: 'ONLINE',
    vehicles: 5, trafficStatus: 'MODERATE', alertType: 'VEHICLE_STOPPED',
    containers: 98, yardActivity: 'ALERT',
    detectedVehicles: [
      { id: 'YTR-005', plate: 'YT-005', driver: 'Hoàng Văn E', status: 'ON_TRIP', task: 'DSP-20260811-002', container: 'MSCU5577889', gateBooking: null, bookingStatus: null },
    ],
    lastUpdate: 1, avgSpeed: null, img: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=800',
  },
  {
    id: 'CAM-006', name: 'Khối bãi C (Block C)', location: 'Bãi Container – Khối C',
    zone: 'YARD', type: 'YARD', status: 'ONLINE',
    vehicles: 2, trafficStatus: 'CLEAR', alertType: null,
    containers: 112, yardActivity: 'NORMAL',
    detectedVehicles: [],
    lastUpdate: 8, avgSpeed: null, img: 'https://images.unsplash.com/photo-1493946740644-2d8a1f1a6aff?q=80&w=800',
  },
  // Traffic Cameras
  {
    id: 'CAM-007', name: 'Đường chính (Main Road)', location: 'Tuyến đường chính nội bãi',
    zone: 'ROAD', type: 'TRAFFIC', status: 'ONLINE',
    vehicles: 12, trafficStatus: 'CONGESTED', alertType: 'CONGESTION',
    detectedVehicles: [],
    lastUpdate: 2, avgSpeed: 12, img: 'https://images.unsplash.com/photo-1490317417942-8c7b3d4a4e3e?q=80&w=800',
  },
  {
    id: 'CAM-008', name: 'Giao lộ nội bãi (Yard Intersection)', location: 'Giao lộ trung tâm Yard',
    zone: 'ROAD', type: 'TRAFFIC', status: 'ONLINE',
    vehicles: 6, trafficStatus: 'HEAVY', alertType: null,
    detectedVehicles: [],
    lastUpdate: 4, avgSpeed: 18, img: 'https://images.unsplash.com/photo-1464219789935-c2d9d9aba644?q=80&w=800',
  },
  {
    id: 'CAM-009', name: 'Khu vực tiếp cận Cổng (Gate Approach)', location: 'Đường dẫn vào Cổng A',
    zone: 'ROAD', type: 'TRAFFIC', status: 'OFFLINE',
    vehicles: 0, trafficStatus: null, alertType: 'OFFLINE',
    detectedVehicles: [],
    lastUpdate: null, avgSpeed: null, img: null,
    lastSeen: '10:32',
  },
  // Loading Cameras
  {
    id: 'CAM-010', name: 'Khu xếp dỡ A (Loading Area A)', location: 'Bến dỡ – Khu A',
    zone: 'LOADING', type: 'LOADING', status: 'ONLINE',
    vehicles: 7, trafficStatus: 'HEAVY', alertType: null,
    detectedVehicles: [],
    lastUpdate: 1, avgSpeed: null, img: 'https://images.unsplash.com/photo-1569982175971-d92b01cf8694?q=80&w=800',
  },
  {
    id: 'CAM-011', name: 'Khu xếp dỡ B (Loading Area B)', location: 'Bến dỡ – Khu B',
    zone: 'LOADING', type: 'LOADING', status: 'ONLINE',
    vehicles: 3, trafficStatus: 'MODERATE', alertType: null,
    detectedVehicles: [],
    lastUpdate: 6, avgSpeed: null, img: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=800',
  },
]

const INITIAL_ALERTS = [
  { id: 'ALT-001', type: 'CONGESTION',      severity: 'HIGH',   camId: 'CAM-007', location: 'Đường chính',     message: 'Ùn tắc giao thông nghiêm trọng. 12 xe đang bị kẹt.', age: 2 },
  { id: 'ALT-002', type: 'VEHICLE_STOPPED', severity: 'MEDIUM', camId: 'CAM-005', location: 'Khối bãi B',      message: 'Xe YTR-005 dừng bất thường hơn 18 phút tại B12.', age: 5 },
  { id: 'ALT-003', type: 'GATE_QUEUE',      severity: 'LOW',    camId: 'CAM-001', location: 'Cổng Vào',        message: '4 xe đang chờ tại cổng vào. Hàng đợi tăng dần.', age: 8 },
]

// ─── CONFIG ─────────────────────────────────────────────────────────────────────
const TRAFFIC_CFG = {
  CLEAR:     { label: 'Thông thoáng', color: 'text-green-700',  badge: 'bg-green-50 text-green-800 border-green-300',  dot: 'bg-green-500' },
  MODERATE:  { label: 'Bình thường',  color: 'text-amber-700',  badge: 'bg-amber-50 text-amber-800 border-amber-300',  dot: 'bg-amber-400' },
  HEAVY:     { label: 'Đông đúc',     color: 'text-orange-700', badge: 'bg-orange-50 text-orange-800 border-orange-300', dot: 'bg-orange-500' },
  CONGESTED: { label: 'Ùn tắc',       color: 'text-red-700',    badge: 'bg-red-50 text-red-800 border-red-300',        dot: 'bg-red-500' },
}

const ZONE_LABELS = { GATE: 'Cổng', YARD: 'Bãi container', ROAD: 'Đường nội bãi', LOADING: 'Khu xếp dỡ' }
const TYPE_LABELS = { GATE: 'Camera Cổng', YARD: 'Camera Bãi', TRAFFIC: 'Camera Giao thông', LOADING: 'Camera Xếp dỡ' }

const ALERT_SEVERITY = {
  HIGH:   { badge: 'bg-red-100 text-red-800 border-red-300',     dot: 'bg-red-500',    icon: '🔴' },
  MEDIUM: { badge: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-400', icon: '🟠' },
  LOW:    { badge: 'bg-yellow-100 text-yellow-800 border-yellow-300', dot: 'bg-yellow-400', icon: '🟡' },
}

const INCIDENT_TYPES = [
  'Ùn tắc giao thông', 'Xe hỏng / Dừng bất thường', 'Vấn đề container',
  'Xe không có phép vào', 'Tai nạn', 'Khác'
]

// ─── HELPERS ────────────────────────────────────────────────────────────────────
function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-600 text-white">
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
      LIVE
    </span>
  )
}

function StatusDot({ status }) {
  const color = status === 'ONLINE' ? 'bg-green-500' : status === 'WARNING' ? 'bg-amber-400' : 'bg-red-500'
  return <span className={`w-2 h-2 rounded-full ${color} ${status === 'ONLINE' ? 'animate-pulse' : ''}`} />
}

function TrafficBadge({ trafficStatus }) {
  if (!trafficStatus) return null
  const cfg = TRAFFIC_CFG[trafficStatus]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ─── VIDEO FEED MOCK ─────────────────────────────────────────────────────────────
function CameraVideoFeed({ camera, isFullscreen = false }) {
  if (camera.status === 'OFFLINE') {
    return (
      <div className={`bg-slate-900 flex flex-col items-center justify-center gap-3 ${isFullscreen ? 'h-[480px]' : 'aspect-video'}`}>
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
          <span className="material-symbols-outlined text-slate-600 text-[28px]">videocam_off</span>
        </div>
        <div className="text-slate-500 font-bold text-sm">CAMERA OFFLINE</div>
        {camera.lastSeen && <div className="text-slate-600 text-[11px]">Lần cuối hoạt động: {camera.lastSeen}</div>}
      </div>
    )
  }

  return (
    <div className={`relative bg-slate-900 overflow-hidden ${isFullscreen ? 'h-[480px]' : 'aspect-video'}`}>
      {/* Background "camera" image */}
      {camera.img && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-70"
          style={{ backgroundImage: `url('${camera.img}')` }}
        />
      )}
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-slate-900/20" />

      {/* AR Corner brackets */}
      <div className="absolute inset-3 pointer-events-none">
        <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-signal-orange opacity-80" />
        <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-signal-orange opacity-80" />
        <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-signal-orange opacity-80" />
        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-signal-orange opacity-80" />
      </div>

      {/* Scan line animation */}
      {camera.status === 'ONLINE' && (
        <div className="absolute left-0 right-0 h-[1px] bg-signal-orange/40 shadow-[0_0_8px_#ff682c]"
          style={{ top: '40%', animation: 'pulse 2s ease-in-out infinite' }} />
      )}

      {/* Vehicle detection boxes overlay */}
      {camera.detectedVehicles.slice(0, 2).map((v, i) => (
        <div key={v.id}
          className="absolute border border-signal-orange/70 bg-signal-orange/10 rounded"
          style={{ left: `${15 + i * 35}%`, top: `${50 + i * 10}%`, width: '22%', height: '30%' }}>
          <div className="absolute -top-4 left-0 bg-signal-orange text-white text-[9px] font-bold px-1 rounded whitespace-nowrap">
            {v.plate}
          </div>
        </div>
      ))}

      {/* Status badge */}
      {camera.status === 'WARNING' ? (
        <div className="absolute top-2 right-2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />WARNING
        </div>
      ) : (
        <div className="absolute top-2 right-2 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />LIVE
        </div>
      )}

      {/* Camera ID watermark */}
      <div className="absolute top-2 left-2 bg-black/60 text-white text-[9px] font-mono px-1.5 py-0.5 rounded">
        {camera.id}
      </div>

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 flex items-end justify-between">
        <div className="text-white font-mono text-[9px] opacity-70">{new Date().toLocaleTimeString('vi-VN')}</div>
        {camera.trafficStatus && (
          <div className={`text-[9px] font-bold ${TRAFFIC_CFG[camera.trafficStatus]?.color}`}>
            {TRAFFIC_CFG[camera.trafficStatus]?.label}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CAMERA CARD ───────────────────────────────────────────────────────────────
function CameraCard({ camera, onView }) {
  const hasAlert = !!camera.alertType

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md ${
      hasAlert ? 'border-red-300 ring-1 ring-red-200' :
      camera.status === 'WARNING' ? 'border-amber-300' :
      camera.status === 'OFFLINE' ? 'border-slate-300' : 'border-chalk'
    }`}>
      {/* Camera header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-chalk bg-fog/50">
        <div className="flex items-center gap-2">
          <StatusDot status={camera.status} />
          <span className="font-mono font-bold text-[11px] text-carbon">{camera.id}</span>
          {hasAlert && (
            <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">!</span>
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate">{TYPE_LABELS[camera.type]}</span>
      </div>

      {/* Video feed — click to view modal */}
      <div className="cursor-pointer" onClick={() => onView(camera)}>
        <CameraVideoFeed camera={camera} />
      </div>

      {/* Camera info footer */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <div className="font-bold text-carbon text-sm leading-tight">{camera.name}</div>
          <div className="text-[11px] text-slate mt-0.5">{camera.location}</div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {camera.trafficStatus && <TrafficBadge trafficStatus={camera.trafficStatus} />}
          {camera.status === 'WARNING' && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full">
              ⚠ Kết nối yếu
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-3 text-graphite">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-slate">directions_car</span>
              <span className="font-bold text-carbon">{camera.vehicles}</span> xe
            </span>
            {camera.avgSpeed != null && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-slate">speed</span>
                <span className="font-bold text-carbon">{camera.avgSpeed}</span> km/h
              </span>
            )}
            {camera.containers != null && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-slate">inventory_2</span>
                <span className="font-bold text-carbon">{camera.containers}</span>
              </span>
            )}
          </div>
          <span className="text-slate">
            {camera.lastUpdate != null ? `${camera.lastUpdate}g trước` : '—'}
          </span>
        </div>

        {/* Alert banner */}
        {hasAlert && camera.alertType !== 'OFFLINE' && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 text-[11px] text-red-800 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">warning</span>
            {camera.alertType === 'CONGESTION' && 'Cảnh báo ùn tắc'}
            {camera.alertType === 'VEHICLE_STOPPED' && 'Xe dừng bất thường'}
            {camera.alertType === 'CONNECTION_UNSTABLE' && 'Kết nối không ổn định'}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mt-auto pt-1">
          {camera.status !== 'OFFLINE' ? (
            <button onClick={() => onView(camera)}
              className="flex-1 h-8 bg-signal-orange text-white rounded-lg text-[11px] font-extrabold hover:opacity-90 transition-all flex items-center justify-center gap-1.5 shadow-sm">
              <span className="material-symbols-outlined text-[15px]">visibility</span>
              Xem Chi Tiết
            </button>
          ) : (
            <button disabled
              className="flex-1 h-8 border border-chalk rounded-lg text-[11px] font-semibold text-slate bg-fog cursor-not-allowed">
              Camera Offline
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function CameraMonitoring() {
  const [cameras, setCameras]             = useState(INITIAL_CAMERAS)
  const [alerts, setAlerts]               = useState(INITIAL_ALERTS)
  const [search, setSearch]               = useState('')
  const [zoneFilter, setZoneFilter]       = useState('ALL')
  const [statusFilter, setStatusFilter]   = useState('ALL')
  const [typeFilter, setTypeFilter]       = useState('ALL')
  const [drawerCam, setDrawerCam]         = useState(null)
  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [incidentCam, setIncidentCam]     = useState(null)
  const [incidentForm, setIncidentForm]   = useState({ type: '', description: '' })
  const [incidents, setIncidents]         = useState([])
  const [clock, setClock]                 = useState('')
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [toast, setToast]                 = useState('')

  // Live clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('vi-VN'))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Mock realtime updates
  useEffect(() => {
    const id = setInterval(() => {
      setCameras(prev => prev.map(cam => {
        if (cam.status === 'OFFLINE') return cam
        const delta = Math.floor(Math.random() * 3) - 1
        return {
          ...cam,
          vehicles: Math.max(0, cam.vehicles + delta),
          lastUpdate: Math.max(1, (cam.lastUpdate || 0) - 1 + Math.floor(Math.random() * 3)),
          avgSpeed: cam.avgSpeed != null ? Math.max(5, Math.min(60, cam.avgSpeed + (Math.random() > 0.5 ? 1 : -1))) : null,
        }
      }))
    }, 4000)
    return () => clearInterval(id)
  }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // KPIs
  const kpi = useMemo(() => ({
    total:   cameras.length,
    online:  cameras.filter(c => c.status === 'ONLINE').length,
    offline: cameras.filter(c => c.status === 'OFFLINE').length,
    warning: cameras.filter(c => c.status === 'WARNING').length,
    alerts:  alerts.length,
  }), [cameras, alerts])

  // Filtered cameras
  const filtered = useMemo(() => {
    let list = [...cameras]
    const q = search.toLowerCase()
    if (q) list = list.filter(c =>
      c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.location.toLowerCase().includes(q)
    )
    if (zoneFilter !== 'ALL')   list = list.filter(c => c.zone === zoneFilter)
    if (statusFilter !== 'ALL') list = list.filter(c => c.status === statusFilter)
    if (typeFilter !== 'ALL')   list = list.filter(c => c.type === typeFilter)
    return list
  }, [cameras, search, zoneFilter, statusFilter, typeFilter])

  const handleReportIncident = (e) => {
    e.preventDefault()
    const newInc = {
      id: `INC-${String(incidents.length + 1).padStart(3, '0')}`,
      camId: incidentCam.id, location: incidentCam.location,
      type: incidentForm.type, description: incidentForm.description,
      time: new Date().toLocaleTimeString('vi-VN'), status: 'OPEN',
    }
    setIncidents(prev => [newInc, ...prev])
    setShowIncidentModal(false)
    setIncidentForm({ type: '', description: '' })
    showToast(`✅ Đã tạo sự cố ${newInc.id} – Camera ${incidentCam.id}`)
  }

  const openIncident = (cam) => { setIncidentCam(cam); setShowIncidentModal(true) }

  const handleAlertClick = (alert) => {
    const cam = cameras.find(c => c.id === alert.camId)
    if (cam) setDrawerCam(cam)
  }

  return (
    <div className="p-6 w-full font-sans flex flex-col gap-5 relative min-h-full bg-mist">

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-8 z-[100] bg-white border border-signal-orange shadow-2xl px-5 py-3 rounded-xl text-sm font-bold text-carbon flex items-center gap-3">
          <span className="text-signal-orange">●</span>{toast}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase tracking-wider">Dispatcher Workspace</span>
            <span className="text-[10px] text-slate font-mono">NexusPort · Cảng Tiên Sa · Đà Nẵng</span>
          </div>
          <h2 className="font-heading text-3xl text-carbon font-extrabold mt-0.5">Giám Sát Camera</h2>
          <p className="text-xs text-slate mt-0.5">Theo dõi trực tiếp các khu vực quan trọng tại cảng và bãi container.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            <LiveBadge />
            <span className="text-[10px] text-slate font-mono">Cập nhật: {clock}</span>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng Camera',  value: kpi.total,   border: 'border-slate-300',  icon: 'videocam',      text: 'text-carbon' },
          { label: 'Đang online',  value: kpi.online,  border: 'border-green-400',  icon: 'wifi',          text: 'text-green-700' },
          { label: 'Offline',      value: kpi.offline, border: 'border-red-400',    icon: 'videocam_off',  text: 'text-red-700' },
          { label: 'Cảnh báo',     value: kpi.alerts,  border: 'border-amber-400',  icon: 'notifications_active', text: 'text-amber-700' },
        ].map(k => (
          <div key={k.label} className={`bg-white rounded-xl p-4 border-l-4 ${k.border} border border-chalk shadow-sm flex flex-col gap-1`}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate uppercase tracking-wider">{k.label}</span>
              <span className={`material-symbols-outlined text-[18px] ${k.text} opacity-60`}>{k.icon}</span>
            </div>
            <span className={`text-3xl font-extrabold font-heading ${k.text}`}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* ── FILTER BAR ── */}
      <div className="bg-white rounded-xl border border-chalk shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate text-[18px]">search</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm camera, vị trí..."
            className="w-full pl-9 pr-4 h-9 border border-chalk rounded-lg text-xs text-carbon placeholder-slate focus:outline-none focus:border-signal-orange bg-fog" />
        </div>

        {/* Zone filter */}
        <div className="flex gap-1 flex-wrap">
          {[['ALL','Tất cả'],['GATE','Cổng'],['YARD','Bãi'],['ROAD','Đường'],['LOADING','Xếp dỡ']].map(([val, lbl]) => (
            <button key={val} onClick={() => setZoneFilter(val)}
              className={`px-3 h-8 rounded-lg text-[11px] font-semibold border transition-all ${zoneFilter===val ? 'bg-signal-orange text-white border-signal-orange' : 'bg-fog text-graphite border-chalk hover:border-slate'}`}>
              {lbl}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-9 px-3 border border-chalk rounded-lg text-xs text-carbon bg-fog focus:outline-none focus:border-signal-orange">
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ONLINE">🟢 Online</option>
          <option value="WARNING">🟡 Cảnh báo</option>
          <option value="OFFLINE">🔴 Offline</option>
        </select>

        <span className="text-[11px] text-slate ml-auto">{filtered.length} camera</span>
      </div>

      {/* ── MAIN CONTENT: GRID + ALERTS PANEL ── */}
      <div className="flex gap-5 items-start">

        {/* ── CAMERA GRID ── */}
        <div className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-chalk p-16 text-center">
              <span className="material-symbols-outlined text-[48px] text-slate opacity-40">videocam_off</span>
              <div className="font-bold text-carbon text-sm mt-3">Không tìm thấy camera nào</div>
              <p className="text-xs text-slate mt-1">Thử thay đổi bộ lọc hoặc từ khoá tìm kiếm.</p>
              <button onClick={() => { setSearch(''); setZoneFilter('ALL'); setStatusFilter('ALL') }}
                className="mt-4 px-4 py-2 bg-fog border border-chalk rounded-lg text-xs font-semibold hover:bg-mist">Xóa bộ lọc</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(cam => (
                <CameraCard key={cam.id} camera={cam}
                  onView={setDrawerCam} />
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: ALERTS + INCIDENTS ── */}
        <div className="w-[260px] flex-shrink-0 space-y-4">

          {/* Active Alerts */}
          <div className="bg-white rounded-xl border border-chalk shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-chalk bg-fog flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate uppercase tracking-wider">Cảnh Báo Đang Hoạt Động</span>
              <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">{alerts.length}</span>
            </div>
            <div className="divide-y divide-chalk">
              {alerts.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-slate">Không có cảnh báo nào.</div>
              ) : alerts.map(alert => (
                <div key={alert.id}
                  onClick={() => handleAlertClick(alert)}
                  className="px-4 py-3 cursor-pointer hover:bg-fog/60 transition-colors space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${ALERT_SEVERITY[alert.severity]?.dot}`} />
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${ALERT_SEVERITY[alert.severity]?.badge}`}>
                      {alert.severity === 'HIGH' ? 'Cao' : alert.severity === 'MEDIUM' ? 'Trung bình' : 'Thấp'}
                    </span>
                    <span className="text-[10px] text-slate ml-auto">{alert.age}p trước</span>
                  </div>
                  <div className="text-xs font-bold text-carbon">{alert.location}</div>
                  <div className="text-[11px] text-graphite leading-snug">{alert.message}</div>
                  <div className="text-[10px] text-signal-orange font-bold">→ Nhấp để xem camera</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Incidents */}
          {incidents.length > 0 && (
            <div className="bg-white rounded-xl border border-chalk shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-chalk bg-fog">
                <span className="text-[10px] font-bold text-slate uppercase tracking-wider">Sự Cố Đã Báo Cáo</span>
              </div>
              <div className="divide-y divide-chalk max-h-56 overflow-y-auto">
                {incidents.map(inc => (
                  <div key={inc.id} className="px-4 py-3 text-xs space-y-0.5">
                    <div className="flex justify-between">
                      <span className="font-mono font-bold text-signal-orange">{inc.id}</span>
                      <span className="bg-red-100 text-red-800 text-[10px] font-bold px-1.5 rounded">MỞ</span>
                    </div>
                    <div className="text-carbon font-semibold">{inc.type}</div>
                    <div className="text-slate">{inc.location} · {inc.camId}</div>
                    <div className="text-[10px] text-slate">{inc.time}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dispatcher notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-800 space-y-1">
            <div className="font-bold text-[10px] uppercase">Quyền Dispatcher</div>
            <div className="text-green-800">✓ Xem camera trực tiếp</div>
            <div className="text-green-800">✓ Xem thông tin xe</div>
            <div className="text-green-800">✓ Báo cáo sự cố</div>
            <div className="text-red-700">✗ Không thể duyệt/từ chối cổng</div>
            <div className="text-red-700">✗ Không thể cấu hình camera</div>
          </div>
        </div>
      </div>

      {/* ═══ CAMERA DETAIL MODAL ═══ */}
      {drawerCam && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-carbon/60 z-40 backdrop-blur-sm"
            onClick={() => { setDrawerCam(null); setSelectedVehicle(null) }}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white rounded-2xl shadow-2xl border border-chalk w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >

              {/* ── Modal Header ── */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-chalk bg-fog flex-shrink-0">
                <div className="flex items-center gap-3">
                  <StatusDot status={drawerCam.status} />
                  <div>
                    <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block leading-none mb-0.5">Chi Tiết Camera</span>
                    <h3 className="font-heading text-base font-extrabold text-carbon font-mono leading-none">
                      {drawerCam.id} — {drawerCam.name}
                    </h3>
                  </div>
                  <LiveBadge />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openIncident(drawerCam)}
                    className="px-3 h-8 bg-amber-50 border border-amber-300 rounded-lg text-[11px] font-bold text-amber-800 hover:bg-amber-100 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">report</span>Báo sự cố
                  </button>
                  <button onClick={() => { setDrawerCam(null); setSelectedVehicle(null) }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-chalk hover:bg-mist text-slate hover:text-carbon transition-all">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
              </div>

              {/* ── Scrollable body ── */}
              <div className="flex-1 overflow-y-auto">

                {/* ── BIG VIDEO FEED ── */}
                <div className="relative bg-slate-900 w-full" style={{ height: '320px' }}>
                  {drawerCam.status === 'OFFLINE' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900">
                      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-600 text-[36px]">videocam_off</span>
                      </div>
                      <div className="text-slate-400 font-bold text-base">CAMERA OFFLINE</div>
                      {drawerCam.lastSeen && <div className="text-slate-500 text-sm">Lần cuối hoạt động: {drawerCam.lastSeen}</div>}
                    </div>
                  ) : (
                    <>
                      {/* Background image */}
                      {drawerCam.img && (
                        <div className="absolute inset-0 bg-cover bg-center opacity-75"
                          style={{ backgroundImage: `url('${drawerCam.img}')` }} />
                      )}
                      {/* Dark overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-slate-900/20" />

                      {/* AR corner brackets */}
                      <div className="absolute inset-4 pointer-events-none">
                        <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-signal-orange opacity-80" />
                        <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-signal-orange opacity-80" />
                        <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-signal-orange opacity-80" />
                        <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-signal-orange opacity-80" />
                      </div>

                      {/* Vehicle detection overlays */}
                      {drawerCam.detectedVehicles.slice(0, 3).map((v, i) => (
                        <div key={v.id} className="absolute border-2 border-signal-orange/80 bg-signal-orange/10 rounded-sm"
                          style={{ left: `${12 + i * 28}%`, top: `${45 + (i % 2) * 15}%`, width: '18%', height: '28%' }}>
                          <div className="absolute -top-6 left-0 bg-signal-orange/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap backdrop-blur-sm">
                            {v.plate}
                          </div>
                        </div>
                      ))}

                      {/* LIVE badge */}
                      <div className="absolute top-3 right-3 bg-red-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />LIVE
                      </div>

                      {/* Camera ID */}
                      <div className="absolute top-3 left-3 bg-black/60 text-white text-[10px] font-mono font-bold px-2 py-1 rounded-lg backdrop-blur-sm">
                        {drawerCam.id}
                      </div>

                      {/* Scan line */}
                      <div className="absolute left-0 right-0 h-px bg-signal-orange/30 shadow-[0_0_10px_#ff682c]"
                        style={{ top: '45%', animation: 'pulse 2s ease-in-out infinite' }} />

                      {/* Bottom info bar overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 flex items-end justify-between">
                        <div className="flex items-center gap-4 text-white text-sm">
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-slate-300">directions_car</span>
                            <strong>{drawerCam.vehicles}</strong> xe phát hiện
                          </span>
                          {drawerCam.containers != null && (
                            <span className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-slate-300">inventory_2</span>
                              <strong>{drawerCam.containers}</strong> container
                            </span>
                          )}
                          {drawerCam.avgSpeed != null && (
                            <span className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-slate-300">speed</span>
                              <strong>{drawerCam.avgSpeed}</strong> km/h
                            </span>
                          )}
                          {drawerCam.trafficStatus && <TrafficBadge trafficStatus={drawerCam.trafficStatus} />}
                        </div>
                        <div className="text-slate-400 font-mono text-[10px]">{clock}</div>
                      </div>
                    </>
                  )}
                </div>

                {/* ── INFORMATION PANELS BELOW VIDEO ── */}
                <div className="p-5 grid grid-cols-3 gap-4">

                  {/* ── COL 1: Camera Info + Status ── */}
                  <div className="space-y-4">
                    <div>
                      <div className="text-[10px] font-bold text-slate uppercase tracking-wider mb-2">Thông Tin Camera</div>
                      <div className="space-y-2 text-xs">
                        {[
                          ['Mã camera', drawerCam.id],
                          ['Khu vực', ZONE_LABELS[drawerCam.zone]],
                          ['Loại', TYPE_LABELS[drawerCam.type]],
                          ['Vị trí', drawerCam.location],
                          ['Cập nhật', drawerCam.lastUpdate != null ? `${drawerCam.lastUpdate}g trước` : '—'],
                        ].map(([l, v]) => (
                          <div key={l} className="flex justify-between items-start gap-2">
                            <span className="text-slate flex-shrink-0">{l}:</span>
                            <span className="font-bold text-carbon text-right">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Traffic panel */}
                    {drawerCam.trafficStatus && (
                      <div className={`rounded-xl p-3 border text-xs space-y-1.5 ${
                        drawerCam.trafficStatus === 'CONGESTED' ? 'bg-red-50 border-red-200' :
                        drawerCam.trafficStatus === 'HEAVY' ? 'bg-orange-50 border-orange-200' :
                        drawerCam.trafficStatus === 'MODERATE' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
                      }`}>
                        <div className="text-[10px] font-bold uppercase text-slate mb-1">Tình Trạng Giao Thông</div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate">Trạng thái:</span>
                          <TrafficBadge trafficStatus={drawerCam.trafficStatus} />
                        </div>
                        <div className="flex justify-between"><span className="text-slate">Số xe:</span><strong className="text-carbon">{drawerCam.vehicles}</strong></div>
                        {drawerCam.avgSpeed != null && (
                          <div className="flex justify-between"><span className="text-slate">Tốc độ TB:</span><strong className="text-carbon">{drawerCam.avgSpeed} km/h</strong></div>
                        )}
                      </div>
                    )}

                    {/* Yard panel */}
                    {drawerCam.zone === 'YARD' && drawerCam.containers != null && (
                      <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs space-y-1.5">
                        <div className="text-[10px] font-bold uppercase text-teal-900 mb-1">Hoạt Động Bãi</div>
                        <div className="flex justify-between"><span className="text-slate">Container:</span><strong className="text-carbon">{drawerCam.containers}</strong></div>
                        <div className="flex justify-between"><span className="text-slate">Xe nội bãi:</span><strong className="text-carbon">{drawerCam.vehicles}</strong></div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate">Trạng thái:</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${drawerCam.yardActivity === 'NORMAL' ? 'bg-green-50 text-green-800 border-green-300' : 'bg-red-50 text-red-800 border-red-300'}`}>
                            {drawerCam.yardActivity === 'NORMAL' ? '🟢 Bình thường' : '🔴 Có cảnh báo'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Alert */}
                    {drawerCam.alertType && drawerCam.alertType !== 'OFFLINE' && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs space-y-1">
                        <div className="text-[10px] font-bold text-red-900 uppercase flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px]">warning</span>Cảnh Báo
                        </div>
                        <div className="font-bold text-red-800">
                          {drawerCam.alertType === 'CONGESTION' && 'Ùn tắc giao thông'}
                          {drawerCam.alertType === 'VEHICLE_STOPPED' && 'Xe dừng bất thường'}
                          {drawerCam.alertType === 'CONNECTION_UNSTABLE' && 'Kết nối không ổn định'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── COL 2: Gate Activity + Vehicles ── */}
                  <div className="space-y-4">
                    {/* Gate activity */}
                    {drawerCam.zone === 'GATE' && (
                      <div>
                        <div className="text-[10px] font-bold text-slate uppercase tracking-wider mb-2">Hoạt Động Cổng</div>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          {[
                            ['Xe đang chờ', drawerCam.gateWaiting, 'text-amber-700', 'bg-amber-50 border-amber-200'],
                            ['Đang xử lý', drawerCam.gateProcessing, 'text-blue-700', 'bg-blue-50 border-blue-200'],
                            ['Đã duyệt', drawerCam.gateApproved, 'text-green-700', 'bg-green-50 border-green-200'],
                            ['Từ chối', drawerCam.gateRejected, 'text-red-700', 'bg-red-50 border-red-200'],
                          ].map(([l, v, color, bg]) => (
                            <div key={l} className={`rounded-xl p-3 border text-center ${bg}`}>
                              <div className={`font-extrabold text-2xl ${color}`}>{v}</div>
                              <div className="text-[10px] text-slate mt-0.5">{l}</div>
                            </div>
                          ))}
                        </div>
                        <div className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 text-center">
                          ℹ️ Chỉ Gate Officer mới có thể Duyệt / Từ Chối
                        </div>
                      </div>
                    )}

                    {/* Detected Vehicles */}
                    {drawerCam.detectedVehicles && drawerCam.detectedVehicles.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-slate uppercase tracking-wider mb-2">
                          Xe Đang Phát Hiện ({drawerCam.detectedVehicles.length})
                        </div>
                        <div className="space-y-2">
                          {drawerCam.detectedVehicles.map(v => (
                            <div key={v.id}>
                              <div
                                onClick={() => setSelectedVehicle(selectedVehicle?.id === v.id ? null : v)}
                                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                  selectedVehicle?.id === v.id
                                    ? 'border-signal-orange bg-orange-50'
                                    : 'border-chalk bg-fog hover:border-slate'
                                }`}>
                                <div className="flex justify-between items-center">
                                  <div>
                                    <div className="font-bold text-carbon">{v.id}</div>
                                    <div className="font-mono text-[11px] text-slate">{v.plate}</div>
                                  </div>
                                  <div className="text-right">
                                    {v.gateBooking && <div className="text-[10px] font-mono font-bold text-signal-orange">{v.gateBooking}</div>}
                                    <span className="material-symbols-outlined text-[16px] text-slate">
                                      {selectedVehicle?.id === v.id ? 'expand_less' : 'expand_more'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {selectedVehicle?.id === v.id && (
                                <div className="mx-1 p-3 bg-white border border-orange-200 border-t-0 rounded-b-xl text-xs space-y-1.5">
                                  {[
                                    ['Tài xế', v.driver],
                                    ['Nhiệm vụ', v.task],
                                    ['Container', v.container],
                                    v.gateBooking ? ['Gate Booking', v.gateBooking] : null,
                                    v.bookingStatus ? ['Booking', v.bookingStatus === 'PENDING' ? '🟡 Chờ xác minh' : '🟢 Đã xác minh'] : null,
                                  ].filter(Boolean).map(([l, val]) => (
                                    <div key={l} className="flex justify-between">
                                      <span className="text-slate">{l}:</span>
                                      <span className="font-bold text-carbon">{val}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No vehicles */}
                    {(!drawerCam.detectedVehicles || drawerCam.detectedVehicles.length === 0) && drawerCam.zone !== 'GATE' && (
                      <div className="text-center py-8 text-slate text-xs bg-fog rounded-xl border border-chalk">
                        <span className="material-symbols-outlined text-[32px] opacity-30 block mb-1">directions_car</span>
                        Không phát hiện xe nào
                      </div>
                    )}
                  </div>

                  {/* ── COL 3: Quick Links + Actions ── */}
                  <div className="space-y-4">
                    <div>
                      <div className="text-[10px] font-bold text-slate uppercase tracking-wider mb-2">Liên Kết Nhanh</div>
                      <div className="space-y-2">
                        {[
                          { href: '/dispatch',        icon: 'alt_route',      label: 'Lệnh Điều Phối',       sub: 'Tạo / xem lệnh xe',         color: 'hover:border-signal-orange hover:text-signal-orange' },
                          { href: '/fleet',           icon: 'local_shipping', label: 'Quản Lý Đội Xe',       sub: 'Xem trạng thái xe',         color: 'hover:border-blue-500 hover:text-blue-600' },
                          { href: '/dispatcher/drivers', icon: 'badge',       label: 'Quản Lý Tài Xế',       sub: 'Xem danh sách tài xế',      color: 'hover:border-purple-500 hover:text-purple-600' },
                          { href: '/yard',            icon: 'grid_view',      label: 'Bản Đồ Bãi',           sub: 'Xem vị trí trên bãi',       color: 'hover:border-teal-500 hover:text-teal-600' },
                          { href: '/traffic',         icon: 'traffic',        label: 'Quản Lý Giao Thông',   sub: 'Xem tình trạng đường',      color: 'hover:border-amber-500 hover:text-amber-600' },
                          { href: '/dispatch-history',icon: 'history',        label: 'Lịch Sử Điều Phối',   sub: 'Tra cứu lệnh cũ',           color: 'hover:border-slate-500 hover:text-slate-600' },
                        ].map(link => (
                          <a key={link.href} href={link.href}
                            className={`flex items-center gap-3 p-3 rounded-xl border border-chalk bg-fog ${link.color} transition-all group`}>
                            <div className="w-8 h-8 rounded-lg bg-white border border-chalk flex items-center justify-center flex-shrink-0 group-hover:border-current transition-all">
                              <span className="material-symbols-outlined text-[18px] text-slate group-hover:text-current">{link.icon}</span>
                            </div>
                            <div>
                              <div className="text-[11px] font-bold text-carbon group-hover:text-current">{link.label}</div>
                              <div className="text-[10px] text-slate">{link.sub}</div>
                            </div>
                            <span className="material-symbols-outlined text-[16px] text-slate ml-auto opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
                          </a>
                        ))}
                      </div>
                    </div>

                    {/* Permission notice */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate space-y-1">
                      <div className="font-bold text-[10px] uppercase text-carbon mb-1">Quyền Dispatcher</div>
                      <div className="text-green-700">✓ Xem camera trực tiếp</div>
                      <div className="text-green-700">✓ Xem thông tin xe phát hiện</div>
                      <div className="text-green-700">✓ Báo cáo sự cố</div>
                      <div className="text-red-600">✗ Không duyệt/từ chối cổng</div>
                      <div className="text-red-600">✗ Không cấu hình camera</div>
                    </div>
                  </div>

                </div>{/* end grid */}
              </div>{/* end scrollable body */}
            </div>
          </div>
        </>
      )}


      {/* ═══ INCIDENT REPORT MODAL ═══ */}
      {showIncidentModal && incidentCam && (
        <>
          <div className="fixed inset-0 bg-carbon/50 z-[60] backdrop-blur-sm" onClick={() => setShowIncidentModal(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-chalk w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-chalk">
                <div>
                  <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Báo Cáo Sự Cố</span>
                  <h3 className="font-heading text-lg font-extrabold text-carbon">{incidentCam.id} — {incidentCam.name}</h3>
                </div>
                <button onClick={() => setShowIncidentModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-fog text-slate hover:text-carbon">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <form onSubmit={handleReportIncident} className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-fog rounded-lg p-2.5 border border-chalk">
                    <div className="text-[10px] font-bold text-slate uppercase mb-0.5">Camera</div>
                    <div className="font-bold text-carbon">{incidentCam.id}</div>
                  </div>
                  <div className="bg-fog rounded-lg p-2.5 border border-chalk">
                    <div className="text-[10px] font-bold text-slate uppercase mb-0.5">Vị trí</div>
                    <div className="font-bold text-carbon text-[11px] truncate">{incidentCam.location}</div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate uppercase mb-2">Loại Sự Cố <span className="text-red-500">*</span></label>
                  <div className="space-y-2">
                    {INCIDENT_TYPES.map(type => (
                      <label key={type} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${incidentForm.type === type ? 'border-signal-orange bg-orange-50' : 'border-chalk bg-fog hover:border-slate'}`}>
                        <input type="radio" name="incidentType" value={type}
                          checked={incidentForm.type === type}
                          onChange={e => setIncidentForm(f => ({ ...f, type: e.target.value }))}
                          className="accent-signal-orange" required />
                        <span className="text-xs font-semibold text-carbon">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate uppercase mb-1">Mô Tả Chi Tiết</label>
                  <textarea value={incidentForm.description}
                    onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))}
                    rows={3} placeholder="Mô tả chi tiết sự cố..."
                    className="w-full px-3 py-2 border border-chalk rounded-lg text-xs focus:outline-none focus:border-signal-orange bg-fog resize-none text-carbon placeholder-slate" />
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowIncidentModal(false)}
                    className="flex-1 h-10 border border-chalk rounded-xl text-xs font-semibold text-graphite hover:bg-fog">Hủy</button>
                  <button type="submit"
                    className="flex-1 h-10 bg-red-600 text-white rounded-xl text-xs font-extrabold hover:opacity-90 shadow-md">
                    Báo Cáo Sự Cố
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
