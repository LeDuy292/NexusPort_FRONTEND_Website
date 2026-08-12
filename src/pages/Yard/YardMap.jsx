import React, { useState, useMemo } from 'react'
import CreateYardMoveModal from '../../components/Yard/CreateYardMoveModal'
import {
  INITIAL_CONTAINERS,
  INITIAL_YARD_TRACTORS,
  INITIAL_YARD_DRIVERS,
  INITIAL_YARD_MOVEMENTS,
} from '../../data/yardMoveData'

export default function YardMap() {
  const [filterType, setFilterType] = useState('Tất cả')
  const [timeSnapshot, setTimeSnapshot] = useState('Hiện tại')
  const [selectedBlockDrawer, setSelectedBlockDrawer] = useState(null)
  const [selectedVehiclePopover, setSelectedVehiclePopover] = useState(null)
  const [hoveredBay, setHoveredBay] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  // User Role Check (Dispatcher vs Yard Operator / Admin)
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || { role: 'Dispatcher' }
    } catch {
      return { role: 'Dispatcher' }
    }
  }, [])

  const isDispatcher = user.role === 'Dispatcher'

  // Create Yard Move Modal State
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false)
  const [preSelectedContId, setPreSelectedContId] = useState('')

  // Live state for container movements, tractors, drivers, and containers
  const [containers, setContainers] = useState(INITIAL_CONTAINERS)
  const [tractors, setTractors] = useState(INITIAL_YARD_TRACTORS)
  const [drivers, setDrivers] = useState(INITIAL_YARD_DRIVERS)
  const [movements, setMovements] = useState(INITIAL_YARD_MOVEMENTS)

  // Handlers for Movement creation & placement confirmation
  const handleOpenMoveModal = (contId = '') => {
    setPreSelectedContId(contId)
    setIsMoveModalOpen(true)
  }

  const handleMoveCreated = (newMove) => {
    setMovements(prev => [newMove, ...prev])

    // Update container state
    setContainers(prev => prev.map(c => {
      if (c.id === newMove.containerId) {
        return { ...c, hasActiveMove: true, activeMovementId: newMove.id }
      }
      return c
    }))

    // Update tractor state
    setTractors(prev => prev.map(t => {
      if (t.id === newMove.yardTractor) {
        return {
          ...t,
          status: 'ASSIGNED',
          statusLabel: `🟡 Assigned (${newMove.id})`,
          selectable: false,
          reason: `⚠️ Xe ${t.id} đang chạy lệnh ${newMove.id}`,
          activeTask: newMove.id,
        }
      }
      return t
    }))

    // Update driver state
    setDrivers(prev => prev.map(d => {
      if (d.name === newMove.yardDriver) {
        return {
          ...d,
          status: 'ON_TRIP',
          statusLabel: `🔵 On Trip (${newMove.id})`,
          selectable: false,
          reason: `⚠️ Tài xế ${d.name} đang chạy lệnh ${newMove.id}`,
          activeTask: newMove.id,
        }
      }
      return d
    }))

    setToastMessage(`✅ Đã tạo Lệnh Di Chuyển Bãi ${newMove.id} cho container ${newMove.containerId}`)
    setTimeout(() => setToastMessage(''), 4000)
  }

  const handleConfirmPlacement = (movementId) => {
    const targetMove = movements.find(m => m.id === movementId)
    if (!targetMove) return

    setMovements(prev => prev.map(m => {
      if (m.id === movementId) {
        return {
          ...m,
          status: 'COMPLETED',
          statusBadge: 'bg-green-100 text-green-800 border-green-300',
          statusLabel: '🟢 Completed (Hoàn tất vị trí)',
        }
      }
      return m
    }))

    setContainers(prev => prev.map(c => {
      if (c.id === targetMove.containerId) {
        return {
          ...c,
          hasActiveMove: false,
          activeMovementId: null,
          currentLocation: {
            block: targetMove.toBlock || 'Block D',
            bay: targetMove.toBay || 'D-02',
            row: targetMove.toRow || '01',
            tier: targetMove.toTier || '02',
          }
        }
      }
      return c
    }))

    setTractors(prev => prev.map(t => {
      if (t.id === targetMove.yardTractor) {
        return {
          ...t,
          status: 'AVAILABLE',
          statusLabel: '🟢 Available',
          selectable: true,
          reason: '',
          activeTask: null,
        }
      }
      return t
    }))

    setDrivers(prev => prev.map(d => {
      if (d.name === targetMove.yardDriver) {
        return {
          ...d,
          status: 'AVAILABLE',
          statusLabel: '🟢 Available',
          selectable: true,
          reason: '',
          activeTask: null,
        }
      }
      return d
    }))

    setToastMessage(`🎉 Đã xác nhận hoàn tất xếp vị trí container ${targetMove.containerId} tại ${targetMove.to}`)
    setTimeout(() => setToastMessage(''), 4000)
  }

  // 1. Blocks Data with Status (Operational, Nearly Full, Full, Blocked) & Occupancy / Free Slots
  const blocksData = [
    {
      id: 'Khối bãi A',
      code: 'Khối A',
      type: 'CONTAINER HÀNG KHÔ XUẤT KHẨU',
      status: 'Operational',
      statusLabel: '🟢 Operational (Thông thoáng)',
      occupancy: 72,
      containers: 145,
      maxCapacity: 200,
      freeSlots: 55,
      vehicles: 5,
      crane: 'Cẩu RTG-01 (Tải 72%)',
      colorClass: 'border-emerald-400 bg-white text-carbon shadow-sm hover:border-emerald-600',
      badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold',
      barGradient: 'from-emerald-500 to-teal-400',
      bays: [
        { code: 'A-01', stack: 4, type: 'dry' },
        { code: 'A-02', stack: 3, type: 'dry' },
        { code: 'A-03', stack: 4, type: 'dry' },
        { code: 'A-04', stack: 2, type: 'blocked', note: 'Bảo trì đường ray' },
        { code: 'A-05', stack: 3, type: 'dry' },
        { code: 'A-06', stack: 1, type: 'empty' },
      ]
    },
    {
      id: 'Khối bãi B',
      code: 'Khối B',
      type: 'CONTAINER HÀNG NHẬP (QUÁ TẢI)',
      status: 'Full',
      statusLabel: '🔴 Full (Đã lấp đầy 94%)',
      occupancy: 94,
      containers: 188,
      maxCapacity: 200,
      freeSlots: 12,
      vehicles: 8,
      crane: 'Cẩu RTG-02 (Tải 94% ⚠ Quá tải)',
      colorClass: 'border-red-500 bg-red-50/50 text-carbon shadow-sm hover:border-red-600 ring-1 ring-red-200',
      badgeClass: 'bg-red-600 text-white font-extrabold',
      barGradient: 'from-amber-500 to-red-600',
      bays: [
        { code: 'B-01', stack: 4, type: 'overload' },
        { code: 'B-02', stack: 4, type: 'overload' },
        { code: 'B-03', stack: 4, type: 'overload' },
        { code: 'B-04', stack: 4, type: 'overload' },
        { code: 'B-05', stack: 3, type: 'overload' },
        { code: 'B-06', stack: 4, type: 'overload' },
      ]
    },
    {
      id: 'Khối bãi C',
      code: 'Khối C',
      type: 'CONTAINER LẠNH',
      status: 'Nearly Full',
      statusLabel: '🟡 Nearly Full',
      occupancy: 78,
      containers: 156,
      maxCapacity: 200,
      freeSlots: 44,
      vehicles: 3,
      crane: 'Cẩu RTG-03',
      colorClass: 'border-cyan-500 bg-cyan-50/30 text-carbon shadow-sm hover:border-cyan-600',
      badgeClass: 'bg-cyan-100 text-cyan-900 border border-cyan-300 font-extrabold',
      barGradient: 'from-blue-500 to-cyan-400',
      bays: [
        { code: 'C-01', stack: 3, type: 'reefer' },
        { code: 'C-02', stack: 3, type: 'reefer' },
        { code: 'C-03', stack: 4, type: 'reefer' },
        { code: 'C-04', stack: 2, type: 'blocked', note: 'Kiểm tra ổ cắm' },
        { code: 'C-05', stack: 3, type: 'reefer' },
        { code: 'C-06', stack: 1, type: 'empty' },
      ]
    },
    {
      id: 'Khối bãi D',
      code: 'Khối D',
      type: 'BÃI CONTAINER RỖNG',
      status: 'Operational',
      statusLabel: '🟢 Operational',
      occupancy: 38,
      containers: 76,
      maxCapacity: 200,
      freeSlots: 124,
      vehicles: 2,
      crane: 'Xe nâng Reach Stacker RS-01',
      colorClass: 'border-teal-500 bg-white text-carbon shadow-sm hover:border-teal-600',
      badgeClass: 'bg-teal-100 text-teal-900 border border-teal-300 font-extrabold',
      barGradient: 'from-emerald-500 to-teal-400',
      bays: [
        { code: 'D-01', stack: 2, type: 'dry' },
        { code: 'D-02', stack: 1, type: 'dry' },
        { code: 'D-03', stack: 2, type: 'dry' },
        { code: 'D-04', stack: 1, type: 'empty' },
        { code: 'D-05', stack: 1, type: 'empty' },
        { code: 'D-06', stack: 1, type: 'empty' },
      ]
    },
    {
      id: 'Khối bãi E',
      code: 'Khối E',
      type: 'CONTAINER CHỜ CHUYỂN TẢI',
      status: 'Operational',
      statusLabel: '🟢 Operational',
      occupancy: 65,
      containers: 130,
      maxCapacity: 200,
      freeSlots: 70,
      vehicles: 4,
      crane: 'Cẩu RTG-04',
      colorClass: 'border-blue-500 bg-white text-carbon shadow-sm hover:border-blue-600',
      badgeClass: 'bg-blue-100 text-blue-900 border border-blue-300 font-extrabold',
      barGradient: 'from-blue-600 to-indigo-400',
      bays: [
        { code: 'E-01', stack: 3, type: 'dry' },
        { code: 'E-02', stack: 3, type: 'dry' },
        { code: 'E-03', stack: 2, type: 'dry' },
        { code: 'E-04', stack: 3, type: 'dry' },
        { code: 'E-05', stack: 2, type: 'dry' },
        { code: 'E-06', stack: 1, type: 'empty' },
      ]
    },
    {
      id: 'Khối bãi F',
      code: 'Khối F',
      type: 'HÀNG NGUY HIỂM',
      status: 'Blocked',
      statusLabel: '⚫ Blocked',
      occupancy: 82,
      containers: 164,
      maxCapacity: 200,
      freeSlots: 36,
      vehicles: 6,
      crane: 'Cẩu RTG-05',
      colorClass: 'border-amber-500 bg-amber-50/40 text-carbon shadow-sm hover:border-amber-600',
      badgeClass: 'bg-amber-100 text-amber-950 border border-amber-300 font-extrabold',
      barGradient: 'from-amber-500 to-yellow-500',
      bays: [
        { code: 'F-01', stack: 4, type: 'dg' },
        { code: 'F-02', stack: 3, type: 'dg' },
        { code: 'F-03', stack: 4, type: 'dg' },
        { code: 'F-04', stack: 3, type: 'dg' },
        { code: 'F-05', stack: 2, type: 'dg' },
        { code: 'F-06', stack: 2, type: 'empty' },
      ]
    }
  ]

  // 2. Trip-related Containers List & Tracking Status
  const tripContainers = [
    {
      id: 'MSCU1234567',
      type: 'Standard 20ft • MSC',
      location: 'Block A / Bay A-03',
      status: 'IN_YARD',
      statusLabel: '🏗️ In Yard',
      badge: 'bg-blue-100 text-blue-800 border-blue-300',
      driver: 'Phạm Văn D (15C-882.19)',
      gateBooking: 'GB-20260811-001',
    },
    {
      id: 'TEMU882219',
      type: 'High Cube 40ft • ONE',
      location: 'Block A / Bay A-01',
      status: 'READY_FOR_PICKUP',
      statusLabel: '🟢 Ready for Pickup',
      badge: 'bg-green-100 text-green-800 border-green-300',
      driver: 'Nguyễn Văn A (43C-123.45)',
      gateBooking: 'GB-20260811-002',
    },
    {
      id: 'EVER991203',
      type: 'Reefer 40ft • Evergreen',
      location: 'Block C / Bay C-01',
      status: 'WAITING_HANDLING',
      statusLabel: '⏳ Waiting for Handling',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      driver: 'Trần Văn B (43C-567.89)',
      gateBooking: 'GB-20260811-003',
    },
    {
      id: 'CMAU889012',
      type: 'High Cube 40ft • CMA CGM',
      location: 'Cổng Vào A (Gate In)',
      status: 'AT_GATE',
      statusLabel: '🚚 At Gate',
      badge: 'bg-orange-100 text-orange-800 border-orange-300',
      driver: 'Lê Văn C (92C-445.11)',
      gateBooking: 'GB-20260811-004',
    },
  ]

  // 3. Terminal Vehicle Status Lifecycle Flow
  const terminalVehicles = [
    { id: 'TRK-001', plate: '43C-123.45', container: 'TEMU882219', flowStatus: '🚚 Xe đang ở Gate', dest: 'Cổng A (Làn 01)', speed: '0 km/h' },
    { id: 'TRK-005', plate: '43C-567.89', container: 'EVER991203', flowStatus: '🚛 Đang vào Yard', dest: 'Đường Road 01 → Khối C', speed: '22 km/h' },
    { id: 'TRK-002', plate: '15C-882.19', container: 'MSCU1234567', flowStatus: '⏳ Đang chờ lấy container', dest: 'Khối B (Bay B-02)', speed: '0 km/h' },
    { id: 'TRK-008', plate: '92C-445.11', container: 'CMAU889012', flowStatus: '📦 Đã lấy container', dest: 'Bãi hạ cont Khối A', speed: '18 km/h' },
    { id: 'TRK-012', plate: '51D-998.22', container: 'OOLU445566', flowStatus: '🏁 Đang rời Yard', dest: 'Cổng Out → QL1A', speed: '28 km/h' },
  ]

  // 4. Coordination Alerts (Cảnh báo ảnh hưởng đến việc điều phối)
  const coordinationAlerts = [
    {
      id: 'ALT-Y01',
      type: 'BLOCK_FULL',
      severity: 'HIGH',
      title: '🔴 Khối bãi B quá tải',
      message: 'Đã lấp đầy 188/200 TEU. Hàng đợi Cẩu RTG-02 bị nghẽn 14 phút.',
      action: 'Khuyến nghị di chuyển container sang Khối D.',
    },
    {
      id: 'ALT-Y02',
      type: 'GATE_QUEUE',
      severity: 'HIGH',
      title: '⚠️ Cổng Vào A đang ùn tắc 12 xe',
      message: 'Hàng xe tải chờ trước cổng kéo dài đến đường dẫn bãi.',
      action: 'Mở thêm Làn 03 để giải tỏa.',
    },
    {
      id: 'ALT-Y03',
      type: 'CONT_NOT_READY',
      severity: 'MEDIUM',
      title: '🟡 Container TEMU882219 chưa sẵn sàng',
      message: 'Đang chờ thủ tục soi chiếu hải quan tại Khu vực kiểm tra.',
      action: 'Chưa phát lệnh gắp container.',
    },
    {
      id: 'ALT-Y04',
      type: 'WAITING_HANDLING',
      severity: 'MEDIUM',
      title: '⏳ Container MSCU1234567 đang chờ cẩu gắp',
      message: 'Xe TRK-002 đã đỗ tại Bay B-02 được 12 phút chờ Cẩu RTG-02.',
      action: 'Ưu tiên cẩu RTG-02.',
    },
    {
      id: 'ALT-Y05',
      type: 'RESTRICTED_AREA',
      severity: 'LOW',
      title: '⛔ Khu vực bị hạn chế: Bay A-04 & Bay C-04',
      message: 'Tạm phong tỏa phục vụ bảo trì hệ thống ray cẩu và điện lạnh.',
      action: 'Không xếp container vào 2 dãy này.',
    },
  ]

  const filteredBlocks = blocksData.filter(b => {
    if (filterType === 'Khối bãi') return true
    if (filterType === 'Ún tắc') return b.occupancy > 80
    if (filterType === 'Còn chỗ trống') return b.occupancy < 60
    return true
  })

  return (
    <div className="p-6 sm:p-8 w-full font-sans flex flex-col gap-6 relative bg-mist">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-carbon text-white px-6 py-3.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 z-[100] animate-bounce border border-signal-orange">
          <span className="text-signal-orange text-base">●</span>
          {toastMessage}
        </div>
      )}



      {/* ── HEADER BAR ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-chalk rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[10px] font-extrabold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase tracking-wider">
              {isDispatcher ? 'Dispatcher Portal' : 'Yard Operator Control Center'}
            </span>
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
              TRỰC TUYẾN
            </span>
          </div>
          <h2 className="font-heading text-3xl text-carbon font-extrabold">Sơ Đồ Vận Hành Bãi Container</h2>
          <p className="text-xs text-slate mt-0.5">Theo dõi sơ đồ không gian các Khối bãi, vị trí container, luồng xe và cảnh báo vận hành.</p>
        </div>

        {/* Header Snapshot Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate font-bold">Thời điểm:</span>
          <select
            value={timeSnapshot}
            onChange={e => setTimeSnapshot(e.target.value)}
            className="px-3.5 py-2 bg-fog border border-chalk rounded-xl text-xs font-bold text-carbon focus:outline-none focus:border-signal-orange"
          >
            <option value="Hiện tại">Hiện tại (08:45)</option>
            <option value="Dự báo +1h">Dự báo +1h</option>
            <option value="Dự báo +3h">Dự báo +3h</option>
          </select>
        </div>
      </div>

      {/* ── FILTER BAR & LEGEND ── */}
      <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-bold">
        <div className="flex flex-wrap gap-2">
          {['Tất cả', 'Khối bãi', 'Ún tắc', 'Còn chỗ trống'].map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-4 py-2 rounded-full transition-colors ${
                filterType === f ? 'bg-carbon text-white shadow-sm' : 'bg-fog text-slate hover:text-carbon border border-chalk'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Stack Type Legend */}
        <div className="flex items-center gap-4 text-[11px] font-mono flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500"></span> 🟢 Operational</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500"></span> 🟡 Nearly Full</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-600"></span> 🔴 Full</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-700"></span> ⚫ Blocked</span>
        </div>
      </div>

      {/* ── MAIN SPATIAL YARD MAP LAYOUT (70% MAP CANVAS & 30% RIGHT PANEL) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: SPATIAL TERMINAL CANVAS WITH 2.5D BAY STACKS (8 cols ~70%) */}
        <div className="lg:col-span-8 bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-6 relative min-h-[640px] overflow-hidden">
          
          {/* Spatial Grid Background */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="spatialYardGridLight" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#cbd5e1" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#spatialYardGridLight)" />
          </svg>

          {/* Top Gate & Dock Layout Runway Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono z-10">
            {/* Gate In */}
            <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-red-300 shadow-sm font-bold">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                <span>CỔNG VÀO</span>
              </div>
              <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded border border-red-200 font-extrabold">12 xe chờ</span>
            </div>

            {/* Road 01 Movement Status */}
            <div className="flex items-center justify-center gap-2 bg-orange-50 text-orange-950 px-4 py-2.5 rounded-xl border border-orange-200 shadow-sm font-bold text-center">
              <span className="material-symbols-outlined text-signal-orange text-base animate-bounce">local_shipping</span>
              <span className="truncate">ĐƯỜNG NỘI BÃI ROAD 01 — 5 XE LƯU THÔNG</span>
            </div>

            {/* Gate Out */}
            <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-green-300 shadow-sm font-bold">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                <span>CỔNG RA</span>
              </div>
              <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded border border-green-200 font-extrabold">Thông thoáng</span>
            </div>
          </div>

          {/* 6 TERMINAL YARD BLOCKS GRID WITH 2.5D BAY STACKS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 z-10 my-2">
            
            {filteredBlocks.map(block => (
              <div
                key={block.id}
                onClick={() => setSelectedBlockDrawer(block)}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all relative overflow-hidden ${block.colorClass}`}
              >
                {/* Block Header Info */}
                <div className="flex justify-between items-center font-bold font-mono border-b border-slate-200/80 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-800">
                        {block.id} ({block.code})
                      </span>
                      <span className="text-[11px] font-sans font-bold">
                        {block.statusLabel.split(' ')[0]}
                      </span>
                    </div>
                    <span className="text-[10px] font-sans text-slate-500 font-bold block mt-0.5">{block.type}</span>
                  </div>

                  <div className="text-right">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-extrabold ${block.badgeClass}`}>
                      {block.occupancy}% Dung tích
                    </span>
                    <span className="text-[10px] text-slate-600 font-sans block mt-0.5 font-bold">
                      Còn {block.freeSlots} slots trống
                    </span>
                  </div>
                </div>

                {/* Progress Occupancy Bar */}
                <div className="w-full bg-slate-200/80 h-2 rounded-full my-3 overflow-hidden border border-slate-300">
                  <div className={`bg-gradient-to-r ${block.barGradient} h-full rounded-full`} style={{ width: `${block.occupancy}%` }}></div>
                </div>

                {/* 2.5D CONTAINER BAY STACKS GRID */}
                <div className="my-3 space-y-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block font-mono">DÃY BAY CONTAINER (BAY 01-06)</span>
                  <div className="grid grid-cols-6 gap-2">
                    {block.bays.map((bay, idx) => (
                      <div
                        key={idx}
                        onMouseEnter={() => setHoveredBay({ block: block.id, ...bay })}
                        onMouseLeave={() => setHoveredBay(null)}
                        className="bg-white p-1 rounded-lg border border-slate-300 shadow-2xs flex flex-col items-center justify-between font-mono h-14 hover:border-signal-orange transition-colors"
                      >
                        <span className="font-extrabold text-carbon text-[10px]">{bay.code}</span>
                        
                        {/* Stack Height visualizer */}
                        <div className="w-full flex flex-col-reverse gap-0.5 items-center px-0.5">
                          {Array.from({ length: bay.stack }).map((_, tierIdx) => (
                            <div
                              key={tierIdx}
                              className={`w-full h-1.5 rounded-xs ${
                                bay.type === 'overload'
                                  ? 'bg-red-600'
                                  : bay.type === 'reefer'
                                  ? 'bg-cyan-600'
                                  : bay.type === 'dg'
                                  ? 'bg-amber-500'
                                  : bay.type === 'blocked'
                                  ? 'bg-slate-400'
                                  : 'bg-emerald-600'
                              }`}
                            ></div>
                          ))}
                        </div>

                        <span className="text-[9px] text-carbon font-extrabold">T{bay.stack}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Info */}
                <div className="flex justify-between items-center text-[10px] text-slate-700 font-mono pt-2 border-t border-slate-200 font-bold">
                  <span>🚛 {block.vehicles} Xe đỗ • {block.containers}/{block.maxCapacity} Cont</span>
                  <span className="text-signal-orange">{block.crane} ➔</span>
                </div>
              </div>
            ))}

          </div>

          {/* TERMINAL VEHICLE FLOW STATUS BAR */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs shadow-sm space-y-2.5 z-10">
            <div className="flex justify-between items-center font-bold">
              <span className="text-carbon uppercase text-[11px]">TRẠNG THÁI LUỒNG XE TRONG TERMINAL (REALTIME VEHICLE FLOW)</span>
              <span className="text-slate text-[10px] font-mono">{terminalVehicles.length} xe đang theo dõi</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {terminalVehicles.map(v => (
                <div key={v.id} className="p-2.5 bg-fog rounded-xl border border-chalk text-[11px] space-y-1">
                  <div className="font-mono font-extrabold text-carbon">{v.id} ({v.plate})</div>
                  <div className="font-bold text-signal-orange">{v.flowStatus}</div>
                  <div className="text-[10px] text-slate truncate">Cont: <strong>{v.container}</strong></div>
                  <div className="text-[10px] text-slate truncate">Vị trí: {v.dest}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: TRIP CONTAINERS + ALERTS + YARD MOVEMENTS (4 cols ~30%) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* 1. CONTAINER LIÊN QUAN ĐẾN CHUYẾN XE (TRIP CONTAINERS PANEL) */}
          <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-4">
            <div className="border-b border-chalk pb-3 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">QUẢN LÝ TÌNH TRẠNG CONTAINER</span>
                <h3 className="font-heading text-sm font-extrabold text-carbon flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-signal-orange text-[18px]">inventory_2</span>
                  Container Theo Chuyến Xe ({tripContainers.length})
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate">Tiên Sa Terminal</span>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {tripContainers.map(c => (
                <div key={c.id} className="p-3 bg-fog border border-chalk rounded-xl text-xs space-y-1.5 hover:border-slate transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-extrabold text-carbon text-sm">{c.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${c.badge}`}>
                      {c.statusLabel}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate">{c.type} • Booking: <strong className="text-carbon font-mono">{c.gateBooking}</strong></div>

                  {/* THÔNG TIN VỊ TRÍỞ MỨC CẦN THIẾT */}
                  <div className="text-[11px] font-bold text-carbon bg-white p-2 rounded-lg border border-chalk flex items-center justify-between">
                    <span>Vị trí hiện tại:</span>
                    <span className="text-signal-orange font-mono font-extrabold">📍 {c.location}</span>
                  </div>

                  <div className="text-[10px] text-slate flex justify-between pt-1">
                    <span>Xe phụ trách: <strong>{c.driver}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. CẢNH BÁO ẢNH HƯỞNG ĐẾN ĐIỀU PHỐI (COORDINATION ALERTS BOX) */}
          <div className="bg-white border-2 border-red-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="border-b border-chalk pb-3 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">CẢNH BÁO ĐIỀU PHỐI KHẨN CẤP</span>
                <h3 className="font-heading text-sm font-extrabold text-carbon flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-red-600 text-[18px]">warning</span>
                  Cảnh Báo Vận Hành Bãi ({coordinationAlerts.length})
                </h3>
              </div>
              <span className="bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">ACTIVE</span>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {coordinationAlerts.map(alt => (
                <div key={alt.id} className={`p-3 rounded-xl border text-xs space-y-1 ${
                  alt.severity === 'HIGH' ? 'bg-red-50 border-red-300 text-red-950' :
                  alt.severity === 'MEDIUM' ? 'bg-amber-50 border-amber-300 text-amber-950' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}>
                  <div className="font-bold text-xs leading-snug">{alt.title}</div>
                  <div className="text-[11px] opacity-90">{alt.message}</div>
                  <div className="text-[10px] font-bold text-signal-orange pt-1 border-t border-chalk/50">
                    ➔ Hướng xử lý: {alt.action}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* ── BLOCK OPERATIONAL DETAIL DRAWER MODAL (MATCHING USER WIREFRAME) ── */}
      {selectedBlockDrawer && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 font-sans">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-chalk pb-3.5">
              <div>
                <span className="text-[10px] font-extrabold text-signal-orange uppercase tracking-wider block">
                  BẢNG ĐIỀU HÀNH KHỐI BÃI
                </span>
                <h3 className="font-heading text-2xl font-extrabold text-carbon mt-0.5">
                  {selectedBlockDrawer.id} ({selectedBlockDrawer.code})
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-block text-xs font-extrabold px-3 py-0.5 rounded-full ${selectedBlockDrawer.badgeClass}`}>
                    {selectedBlockDrawer.statusLabel}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedBlockDrawer(null)}
                className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* 3 Metrics KPI Cards */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-fog p-3 rounded-xl border border-chalk">
                <span className="text-[10px] font-bold text-slate uppercase block mb-1">DUNG TÍCH BÃI</span>
                <strong className="text-xl text-carbon font-mono font-extrabold">{selectedBlockDrawer.occupancy}%</strong>
              </div>
              <div className="bg-fog p-3 rounded-xl border border-chalk">
                <span className="text-[10px] font-bold text-slate uppercase block mb-1">TỔNG CONTAINER</span>
                <strong className="text-xl text-carbon font-mono font-extrabold">{selectedBlockDrawer.containers}</strong>
              </div>
              <div className="bg-fog p-3 rounded-xl border border-chalk">
                <span className="text-[10px] font-bold text-slate uppercase block mb-1">SLOT CÒN TRỐNG</span>
                <strong className="text-xl text-green-600 font-mono font-extrabold">{selectedBlockDrawer.freeSlots}</strong>
              </div>
            </div>

            {/* Functional Info Box */}
            <div className="bg-fog p-3.5 rounded-xl border border-chalk space-y-1.5 text-xs font-medium">
              <div className="flex justify-between">
                <span className="text-slate">Chức năng bãi:</span>
                <strong className="text-carbon">{selectedBlockDrawer.type}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate">Cẩu phụ trách:</span>
                <strong className="text-carbon">{selectedBlockDrawer.crane}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate">Sức chứa tối đa:</span>
                <strong className="text-carbon font-mono">{selectedBlockDrawer.maxCapacity} TEU</strong>
              </div>
            </div>

            {/* CHI TIẾT SỨC CHỨA THEO BAY */}
            <div className="space-y-2">
              <div className="text-[11px] font-extrabold text-carbon uppercase tracking-wider">
                CHI TIẾT SỨC CHỨA THEO BAY
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {selectedBlockDrawer.bays.map((bay, idx) => {
                  const statusIcon = bay.stack === 4 ? '🔴' : bay.stack === 3 ? '🟡' : '🟢'
                  const statusColor = bay.stack === 4 ? 'border-red-300 bg-red-50/50' : bay.stack === 3 ? 'border-amber-300 bg-amber-50/50' : 'border-green-300 bg-green-50/50'
                  return (
                    <div key={idx} className={`p-2.5 rounded-xl border flex flex-col justify-between text-xs ${statusColor}`}>
                      <div className="flex justify-between items-center font-mono font-extrabold text-carbon">
                        <span>{bay.code}</span>
                        <span className="text-xs">{statusIcon}</span>
                      </div>
                      <div className="text-[10px] text-slate font-bold font-mono mt-1">
                        Tier {bay.stack}/4
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* CONTAINER LIÊN QUAN ĐẾN ĐIỀU PHỐI */}
            <div className="space-y-2 border-t border-chalk pt-3">
              <div className="text-[11px] font-extrabold text-carbon uppercase tracking-wider flex items-center justify-between">
                <span>CONTAINER LIÊN QUAN ĐẾN ĐIỀU PHỐI</span>
                <span className="text-[10px] font-mono text-slate">Bãi {selectedBlockDrawer.code}</span>
              </div>

              <div className="bg-fog p-3 rounded-xl border border-chalk text-xs space-y-1">
                <div className="flex justify-between items-center font-mono font-extrabold text-carbon">
                  <span className="text-sm">MSCU1234567</span>
                  <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                    🟡 Waiting for Pickup
                  </span>
                </div>
                <div className="text-[11px] text-slate font-medium">
                  📍 <strong className="text-carbon font-mono">{selectedBlockDrawer.code} / Bay A-03</strong>
                </div>
                <div className="text-[10px] font-mono text-slate pt-1 border-t border-chalk flex justify-between">
                  <span>DO-00125 • TRK-012</span>
                  <span className="font-bold text-carbon">Tài xế: Nguyễn Văn A</span>
                </div>
              </div>
            </div>

            {/* Footer Close Button */}
            <div className="pt-2 border-t border-chalk flex justify-center">
              <button
                onClick={() => setSelectedBlockDrawer(null)}
                className="w-full h-11 bg-carbon text-white rounded-xl text-xs font-extrabold hover:bg-black transition-colors shadow"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

      {/* VEHICLE POPOVER MODAL */}
      {selectedVehiclePopover && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate uppercase">CHI TIẾT XE TRÊN BẢN ĐỒ</span>
                <h3 className="font-heading text-xl font-extrabold text-carbon font-mono">{selectedVehiclePopover.id}</h3>
              </div>
              <button onClick={() => setSelectedVehiclePopover(null)} className="text-slate hover:text-carbon">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="bg-fog p-4 rounded-xl border border-chalk text-xs font-mono space-y-2">
              <div className="flex justify-between"><span className="text-slate font-sans">Biển số xe:</span><strong>{selectedVehiclePopover.plate}</strong></div>
              <div className="flex justify-between"><span className="text-slate font-sans">Container:</span><strong>{selectedVehiclePopover.container}</strong></div>
              <div className="flex justify-between"><span className="text-slate font-sans">Trạng thái:</span><strong className="text-blue-600">{selectedVehiclePopover.flowStatus}</strong></div>
              <div className="flex justify-between"><span className="text-slate font-sans">Điểm đến đề xuất:</span><strong className="text-signal-orange">{selectedVehiclePopover.dest}</strong></div>
              <div className="flex justify-between"><span className="text-slate font-sans">Tốc độ:</span><strong>{selectedVehiclePopover.speed}</strong></div>
            </div>

            <button
              onClick={() => setSelectedVehiclePopover(null)}
              className="w-full h-10 bg-carbon text-white rounded-full font-bold text-xs hover:bg-black"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* CREATE YARD MOVE MODAL */}
      <CreateYardMoveModal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        preSelectedContainerId={preSelectedContId}
        onMoveCreated={handleMoveCreated}
        containersList={containers}
        tractorsList={tractors}
        driversList={drivers}
      />

    </div>
  )
}
