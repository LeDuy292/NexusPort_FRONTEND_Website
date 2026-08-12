import React, { useState, useEffect } from 'react'

/**
 * 🗺️ CẤU HÌNH TỌA ĐỘ VÀ KHU VỰC CẢNG (PORT ZONES DICTIONARY)
 * Chuẩn hóa mã khu vực (Zone ID) giúp đấu nối trực tiếp với Backend ASP.NET Core / SignalR API
 */
export const PORT_ZONES = {
  GATE_IN: { id: 'GATE_IN', label: 'GATE IN', type: 'GATE', x: 80, y: 165, color: '#ea580c', bg: '#ffedd5' },
  GATE_OUT: { id: 'GATE_OUT', label: 'GATE OUT', type: 'GATE', x: 80, y: 325, color: '#ea580c', bg: '#ffedd5' },
  DOCK_D01: { id: 'DOCK_D01', label: 'DOCK D01', type: 'DOCK', x: 150, y: 45, color: '#0284c7', bg: '#bae6fd' },
  DOCK_D02: { id: 'DOCK_D02', label: 'DOCK D02', type: 'DOCK', x: 270, y: 45, color: '#0284c7', bg: '#bae6fd' },
  DOCK_D03: { id: 'DOCK_D03', label: 'DOCK D03', type: 'DOCK', x: 390, y: 45, color: '#0284c7', bg: '#bae6fd' },
  DOCK_D04: { id: 'DOCK_D04', label: 'DOCK D04', type: 'DOCK', x: 510, y: 45, color: '#0284c7', bg: '#bae6fd' },
  BLOCK_A: { id: 'BLOCK_A', label: 'BLOCK A', type: 'YARD', x: 230, y: 165, capacity: 45, slots: 'A01 - A04', color: '#166534', bg: '#f0fdf4' },
  BLOCK_B: { id: 'BLOCK_B', label: 'BLOCK B', type: 'YARD', x: 470, y: 165, capacity: 88, slots: 'B01 - B12', color: '#92400e', bg: '#fffbeb' },
  BLOCK_C: { id: 'BLOCK_C', label: 'BLOCK C', type: 'YARD', x: 230, y: 325, capacity: 12, slots: 'C01 - C08', color: '#166534', bg: '#f0fdf4' },
  BLOCK_D: { id: 'BLOCK_D', label: 'BLOCK D', type: 'YARD', x: 470, y: 325, capacity: 96, slots: 'D01 - D04', color: '#991b1b', bg: '#fef2f2' },
  MAIN_ROAD: { id: 'MAIN_ROAD', label: 'Trục đường chính', type: 'ROAD', x: 350, y: 245 },
}

// Data mẫu phản hồi từ Backend (Dễ dàng thay thế bằng Axios REST API / WebSocket)
const initialTrucksData = [
  { 
    id: 'TRK-001', 
    license: '43C-123.45', 
    driver: 'Nguyễn Văn A', 
    container: 'MSKU1234567', 
    status: 'Waiting', // Waiting, Moving, Handling, Complete
    task: 'Lấy hàng', 
    priority: 'Cao', 
    currentZoneId: 'GATE_IN', 
    destZoneId: 'BLOCK_B',
    destSlot: 'B12-04',
    steps: ['Gate In', 'Xác định container', 'Đang di chuyển đến Block B', 'Đang xếp dỡ', 'Hoàn thành'],
    activeStep: 2
  },
  { 
    id: 'TRK-004', 
    license: '15C-338.45', 
    driver: 'Hoàng Văn D', 
    container: 'EVER991203-4', 
    status: 'Waiting', 
    task: 'Nhập bãi', 
    priority: 'Khẩn cấp', 
    currentZoneId: 'GATE_IN', 
    destZoneId: 'BLOCK_A',
    destSlot: 'A02-01',
    steps: ['Gate In', 'Đề xuất vị trí bãi', 'Đang di chuyển đến Block A', 'Đặt container hạ bãi', 'Hoàn thành'],
    activeStep: 1
  },
  { 
    id: 'TRK-002', 
    license: '29C-773.81', 
    driver: 'Trần Văn B', 
    container: 'MSCU7654321', 
    status: 'Moving', 
    task: 'Nhập bãi', 
    priority: 'Thường', 
    currentZoneId: 'MAIN_ROAD', 
    destZoneId: 'BLOCK_C',
    destSlot: 'C04-02',
    steps: ['Gate In', 'Đề xuất vị trí bãi', 'Đang di chuyển đến Block C', 'Đặt container hạ bãi', 'Hoàn thành'],
    activeStep: 2
  },
  { 
    id: 'TRK-003', 
    license: '51D-992.12', 
    driver: 'Lê Văn C', 
    container: 'CMAU882190-2', 
    status: 'Handling', 
    task: 'Lấy hàng', 
    priority: 'Khẩn cấp', 
    currentZoneId: 'DOCK_D02', 
    destZoneId: 'GATE_OUT',
    destSlot: 'Gate Out',
    steps: ['Cập bến tàu', 'Điều phối xe đến cẩu', 'Đang xếp dỡ tại D02', 'Di chuyển ra cổng', 'Hoàn thành'],
    activeStep: 2
  },
]

const initialContainersData = [
  { id: 'MSKU1234567', task: 'Lấy hàng', loc: 'B-12-04', truck: 'TRK-001', status: 'Waiting' },
  { id: 'MSCU7654321', task: 'Nhập bãi', loc: 'C-04-02', truck: 'TRK-002', status: 'Moving' },
  { id: 'CMAU882190-2', task: 'Lấy hàng', loc: 'D02-BERTH', truck: 'TRK-003', status: 'Handling' },
  { id: 'EVER991203-4', task: 'Nhập bãi', loc: 'A-02-01', truck: 'TRK-004', status: 'Waiting' },
]

const initialLogsData = [
  { time: '01:32', text: 'Xe TRK-001 đi vào khu vực Gate In, tải trọng 42 tấn, quét container MSKU1234567.' },
  { time: '01:30', text: 'Dispatcher chỉ định vị trí C-04-02 cho container nhập bãi của xe TRK-002.' },
  { time: '01:28', text: 'Cẩu nâng RTG hoàn tất bốc dỡ container CMAU882190-2 tại bến D02 lên xe TRK-003.' },
  { time: '01:25', text: 'Xe TRK-005 hoàn thành nhiệm vụ và rời cảng qua Gate Out.' }
]

export default function EquipmentDispatch() {
  const [trucks, setTrucks] = useState(initialTrucksData)
  const [containers, setContainers] = useState(initialContainersData)
  const [logs, setLogs] = useState(initialLogsData)
  const [activeTruckId, setActiveTruckId] = useState('TRK-001')
  const [filter, setFilter] = useState('Tất cả')
  const [showDispatchModal, setShowDispatchModal] = useState(false)

  // Form điều phối
  const [dispatchForm, setDispatchForm] = useState({
    truckId: 'TRK-001',
    task: 'Lấy hàng',
    destZoneId: 'BLOCK_B',
    destRow: 'B12',
    destPos: '04',
    priority: 'Cao',
    notes: ''
  })

  // Tìm xe đang được chọn
  const currentTruck = trucks.find(t => t.id === activeTruckId) || trucks[0]

  // Lấy tọa độ khu vực từ Zone ID
  const getZoneCoord = (zoneId) => {
    return PORT_ZONES[zoneId] || { x: 350, y: 200, label: zoneId }
  }

  /**
   * 🧮 HÀM TÍNH TOÁN VỊ TRÍ CHỐNG ĐÈ BADGE (COLLISION OFFSET ALGORITHM)
   * Giúp tự động dời các xe nằm cùng một Zone (ví dụ nhiều xe cùng ở GATE_IN)
   */
  const getCalculatedTruckPosition = (truck, allTrucks) => {
    const base = getZoneCoord(truck.currentZoneId)
    const sameZoneTrucks = allTrucks.filter(t => t.currentZoneId === truck.currentZoneId)
    const indexInZone = sameZoneTrucks.findIndex(t => t.id === truck.id)

    if (sameZoneTrucks.length <= 1 || indexInZone <= 0) {
      return { x: base.x, y: base.y }
    }

    // Tự động phân tách vị trí các xe ở cùng 1 khu vực để tránh đè chữ/icon
    const offsetX = (indexInZone % 2 === 1 ? 55 : -55)
    const offsetY = (Math.floor(indexInZone / 2) * 28 + (indexInZone % 2 === 1 ? 0 : 25))

    return {
      x: base.x + offsetX,
      y: base.y + offsetY
    }
  }

  // Filter xe
  const filteredTrucks = trucks.filter(t => {
    if (filter === 'Tất cả') return true
    if (filter === 'Lấy hàng') return t.task === 'Lấy hàng'
    if (filter === 'Đưa hàng vào bãi') return t.task === 'Nhập bãi'
    if (filter === 'Khẩn cấp') return t.priority === 'Khẩn cấp'
    if (filter === 'Đang chờ') return t.status === 'Waiting'
    return true
  })

  // Mở modal điều phối
  const handleOpenDispatch = (truck) => {
    setDispatchForm({
      truckId: truck.id,
      task: truck.task,
      destZoneId: truck.destZoneId || 'BLOCK_B',
      destRow: truck.destSlot?.split('-')[0] || 'B12',
      destPos: truck.destSlot?.split('-')[1] || '04',
      priority: truck.priority,
      notes: ''
    })
    setShowDispatchModal(true)
  }

  // Xử lý xác nhận điều phối (Sẵn sàng gắn API Axios POST lên ASP.NET Core)
  const handleConfirmDispatch = (e) => {
    e.preventDefault()

    const fullSlot = `${dispatchForm.destRow}-${dispatchForm.destPos}`
    const destZoneObj = PORT_ZONES[dispatchForm.destZoneId]

    // Cập nhật trạng thái phương tiện
    const updatedTrucks = trucks.map(t => {
      if (t.id === dispatchForm.truckId) {
        return {
          ...t,
          status: 'Moving',
          currentZoneId: 'MAIN_ROAD', // Chuyển trạng thái di chuyển trên đường chính
          destZoneId: dispatchForm.destZoneId,
          destSlot: fullSlot,
          task: dispatchForm.task,
          priority: dispatchForm.priority,
          activeStep: 2
        }
      }
      return t
    })

    // Cập nhật container
    const updatedContainers = containers.map(c => {
      if (c.truck === dispatchForm.truckId) {
        return {
          ...c,
          loc: fullSlot,
          status: 'Moving',
          task: dispatchForm.task
        }
      }
      return c
    })

    const newLog = {
      time: new Date().toLocaleTimeString().substr(0, 5),
      text: `[API Dispatch] Xác nhận lệnh điều phối xe ${dispatchForm.truckId} di chuyển tới ${destZoneObj?.label || dispatchForm.destZoneId} (Vị trí: ${fullSlot}).`
    }

    setTrucks(updatedTrucks)
    setContainers(updatedContainers)
    setLogs([newLog, ...logs])
    setShowDispatchModal(false)
  }

  // Metrics
  const totalTrucks = trucks.length
  const waitingTrucks = trucks.filter(t => t.status === 'Waiting').length
  const movingTrucks = trucks.filter(t => t.status === 'Moving').length
  const handlingTrucks = trucks.filter(t => t.status === 'Handling').length

  // Tính đường đi động cho xe đang chọn
  const startPos = currentTruck ? getCalculatedTruckPosition(currentTruck, trucks) : { x: 80, y: 165 }
  const endPos = currentTruck ? getZoneCoord(currentTruck.destZoneId) : { x: 470, y: 165 }

  return (
    <div className="p-8 w-full flex flex-col gap-6 font-sans">
      
      {/* 1. Header Control center title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-heading text-4xl text-primary font-bold">Trung tâm Điều phối Cảng (Dispatch Center)</h2>
          <p className="text-sm text-slate mt-1">Hệ thống giám sát, phân bổ bãi bốc xếp và điều phối xe đầu kéo theo thời gian thực.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleOpenDispatch(currentTruck)}
            className="h-10 px-5 bg-signal-orange text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">forklift</span>
            Lệnh điều hành mới
          </button>
        </div>
      </div>

      {/* 2. KPI Section */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm">
          <span className="text-slate text-[10px] uppercase font-bold">Xe chờ điều phối</span>
          <div className="text-2xl font-extrabold text-amber-500 mt-1">{waitingTrucks} xe</div>
        </div>
        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm">
          <span className="text-slate text-[10px] uppercase font-bold">Xe đang chạy</span>
          <div className="text-2xl font-extrabold text-blue-500 mt-1">{movingTrucks} xe</div>
        </div>
        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm">
          <span className="text-slate text-[10px] uppercase font-bold">Xe đang xử lý</span>
          <div className="text-2xl font-extrabold text-green-500 mt-1">{handlingTrucks} xe</div>
        </div>
        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm">
          <span className="text-slate text-[10px] uppercase font-bold">Khu vực quá tải</span>
          <div className="text-2xl font-extrabold text-red-500 mt-1">2 Blocks</div>
        </div>
        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm">
          <span className="text-slate text-[10px] uppercase font-bold">Container chờ lấy</span>
          <div className="text-2xl font-extrabold text-carbon mt-1">18 cont</div>
        </div>
        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm">
          <span className="text-slate text-[10px] uppercase font-bold">Hoạt động bến</span>
          <div className="text-2xl font-extrabold text-carbon mt-1">3/4 Docks</div>
        </div>
      </div>

      {/* 3. Port Map & Control Panel Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Side: Interactive SVG Map (2/3 width) */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          <div className="bg-white border border-chalk rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <h3 className="text-lg font-bold text-carbon flex items-center gap-2">
                <span className="material-symbols-outlined text-[#ff682c]">map</span>
                Sơ đồ phân bổ và vị trí phương tiện thời gian thực
              </h3>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-500"></span> Trống</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-400"></span> Gần đầy</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500"></span> Đầy</span>
              </div>
            </div>

            {/* Interactive Standardized SVG Map */}
            <div className="bg-fog rounded-xl border border-chalk relative overflow-hidden flex justify-center">
              <svg viewBox="0 0 660 420" className="w-full max-w-[660px] h-auto select-none py-4">
                
                {/* 1. Background Road Lanes Network */}
                <g id="roads" opacity="0.4">
                  {/* Road line from Gate to Blocks */}
                  <path d="M 80 165 L 230 165 L 470 165" stroke="#94a3b8" strokeWidth="12" fill="none" strokeDasharray="4 4" />
                  <path d="M 80 325 L 230 325 L 470 325" stroke="#94a3b8" strokeWidth="12" fill="none" strokeDasharray="4 4" />
                  <path d="M 230 45 L 230 325" stroke="#94a3b8" strokeWidth="10" fill="none" strokeDasharray="4 4" />
                  <path d="M 470 45 L 470 325" stroke="#94a3b8" strokeWidth="10" fill="none" strokeDasharray="4 4" />
                </g>

                {/* 2. Docks (Bến tàu) */}
                <g id="docks">
                  <rect x="0" y="0" width="660" height="70" fill="#e0f2fe" opacity="0.6" />
                  
                  {['DOCK_D01', 'DOCK_D02', 'DOCK_D03', 'DOCK_D04'].map((dockKey) => {
                    const zone = PORT_ZONES[dockKey]
                    return (
                      <g key={dockKey}>
                        <rect x={zone.x - 45} y={zone.y - 18} width="90" height="36" fill={zone.bg} stroke={zone.color} strokeWidth="1.5" rx="4" />
                        <text x={zone.x} y={zone.y + 4} textAnchor="middle" fontSize="10" fontWeight="bold" fill={zone.color}>
                          {zone.label}
                        </text>
                      </g>
                    )
                  })}
                </g>

                {/* 3. Gates (Cổng cảng) */}
                <g id="gates">
                  {['GATE_IN', 'GATE_OUT'].map((gateKey) => {
                    const zone = PORT_ZONES[gateKey]
                    return (
                      <g key={gateKey}>
                        <rect x={zone.x - 35} y={zone.y - 30} width="70" height="60" fill={zone.bg} stroke={zone.color} strokeWidth="1.5" rx="4" />
                        <text x={zone.x} y={zone.y + 4} textAnchor="middle" fontSize="10" fontWeight="bold" fill={zone.color}>
                          {zone.label}
                        </text>
                      </g>
                    )
                  })}
                </g>

                {/* 4. Yard Blocks (Bãi container) */}
                <g id="blocks">
                  {['BLOCK_A', 'BLOCK_B', 'BLOCK_C', 'BLOCK_D'].map((blockKey) => {
                    const zone = PORT_ZONES[blockKey]
                    return (
                      <g key={blockKey} onClick={() => {
                        // Tự động gán Block khi click trên sơ đồ
                        setDispatchForm(prev => ({ ...prev, destZoneId: blockKey }))
                      }} className="cursor-pointer">
                        <rect x={zone.x - 65} y={zone.y - 45} width="130" height="90" fill={zone.bg} stroke={zone.color} strokeWidth="1.5" rx="6" />
                        <text x={zone.x} y={zone.y - 20} textAnchor="middle" fontSize="11" fontWeight="bold" fill={zone.color}>
                          {zone.label} ({zone.capacity}%)
                        </text>
                        <text x={zone.x} y={zone.y + 10} textAnchor="middle" fontSize="9" fill={zone.color} opacity="0.8">
                          Vị trí: {zone.slots}
                        </text>
                      </g>
                    )
                  })}
                </g>

                {/* 5. Active Dynamic Truck Route Line */}
                {currentTruck && (
                  <path
                    d={`M ${startPos.x} ${startPos.y} Q ${(startPos.x + endPos.x)/2} ${(startPos.y + endPos.y)/2 - 30}, ${endPos.x} ${endPos.y}`}
                    fill="none"
                    stroke="#ff682c"
                    strokeWidth="3.5"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    className="animate-pulse"
                  />
                )}

                {/* 6. Dynamic Truck Markers (Gắn vị trí không bị chồng đè) */}
                {trucks.map((t) => {
                  const isActive = t.id === activeTruckId
                  const pos = getCalculatedTruckPosition(t, trucks)
                  const isWaiting = t.status === 'Waiting'

                  return (
                    <g
                      key={t.id}
                      onClick={() => setActiveTruckId(t.id)}
                      className="cursor-pointer transition-all duration-300"
                    >
                      {/* Vòng tròn định vị */}
                      <circle
                        cx={pos.x}
                        cy={pos.y + 12}
                        r={isActive ? 16 : 13}
                        fill={isActive ? '#ff682c' : isWaiting ? '#d97706' : '#202020'}
                        stroke="#ffffff"
                        strokeWidth={isActive ? '2 font-bold' : '1'}
                      />
                      <text x={pos.x} y={pos.y + 16} textAnchor="middle" fontSize={isActive ? "12" : "10"}>
                        🚛
                      </text>

                      {/* Tag tên xe không bị che khuất */}
                      <g transform={`translate(${pos.x - 24}, ${pos.y - 14})`}>
                        <rect width="48" height="15" rx="3" fill="#202020" opacity="0.9" />
                        <text x="24" y="11" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#ffffff">
                          {t.id}
                        </text>
                      </g>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* Right Side: Active Truck Details & Queue Panel (1/3 width) */}
        <div className="space-y-6">
          
          {/* Active selected truck card */}
          {currentTruck && (
            <div className="bg-white border border-chalk rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-start border-b border-chalk pb-3">
                <div>
                  <div className="text-xs text-slate uppercase font-bold tracking-wider">Thông tin xe đang theo dõi</div>
                  <h4 className="text-xl font-extrabold text-carbon mt-1 flex items-center gap-1.5">
                    🚛 {currentTruck.id}
                  </h4>
                  <p className="text-xs text-slate mt-0.5">Biển số: {currentTruck.license} • Tài xế: {currentTruck.driver}</p>
                </div>
                <button
                  onClick={() => handleOpenDispatch(currentTruck)}
                  className="h-8 px-3 bg-signal-orange text-white rounded-lg text-xs font-bold hover:opacity-90 shadow-sm"
                >
                  Điều phối
                </button>
              </div>

              {/* Status & Container Info */}
              <div className="grid grid-cols-2 gap-4 text-xs font-medium border-b border-chalk pb-3.5">
                <div>
                  <span className="text-slate block mb-0.5">Container</span>
                  <span className="font-bold text-carbon text-sm">{currentTruck.container}</span>
                </div>
                <div>
                  <span className="text-slate block mb-0.5">Nhiệm vụ</span>
                  <span className="font-bold text-carbon text-sm uppercase text-signal-orange">{currentTruck.task}</span>
                </div>
                <div>
                  <span className="text-slate block mb-0.5">Khu vực hiện tại</span>
                  <span className="font-bold text-carbon">
                    {PORT_ZONES[currentTruck.currentZoneId]?.label || currentTruck.currentZoneId}
                  </span>
                </div>
                <div>
                  <span className="text-slate block mb-0.5">Điểm đến chỉ định</span>
                  <span className="font-bold text-carbon">
                    {PORT_ZONES[currentTruck.destZoneId]?.label || currentTruck.destZoneId} ({currentTruck.destSlot})
                  </span>
                </div>
              </div>

              {/* Workflow Stepper */}
              <div>
                <h5 className="text-xs font-bold text-slate mb-3 uppercase tracking-wider">Tiến trình hoạt động</h5>
                <div className="space-y-3.5">
                  {currentTruck.steps.map((step, idx) => {
                    const isCompleted = idx < currentTruck.activeStep
                    const isActive = idx === currentTruck.activeStep
                    return (
                      <div key={idx} className="flex items-start gap-3 text-xs">
                        <div className="flex flex-col items-center">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                            isCompleted ? 'bg-green-500 text-white' : isActive ? 'bg-signal-orange text-white animate-pulse' : 'bg-chalk text-slate'
                          }`}>
                            {isCompleted ? '✓' : idx + 1}
                          </div>
                          {idx < currentTruck.steps.length - 1 && (
                            <div className="w-0.5 h-6 bg-chalk my-0.5"></div>
                          )}
                        </div>
                        <div className="pt-0.5">
                          <span className={`font-semibold ${isActive ? 'text-signal-orange font-bold' : isCompleted ? 'text-carbon' : 'text-slate'}`}>
                            {step}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
          )}

          {/* Xe chờ điều phối Queue Panel */}
          <div className="bg-white border border-chalk rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-bold text-carbon">Xe chờ điều hành</h3>
              <p className="text-xs text-slate mt-0.5">Hàng đợi phương tiện đang trực tuyến tại Gate hoặc Dock.</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 text-[10px] font-bold">
              {['Tất cả', 'Lấy hàng', 'Đưa hàng vào bãi', 'Khẩn cấp', 'Đang chờ'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded border transition-colors ${
                    filter === f ? 'bg-carbon text-white border-carbon' : 'border-chalk text-slate hover:bg-fog'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {filteredTrucks.map((truck) => (
                <div
                  key={truck.id}
                  onClick={() => setActiveTruckId(truck.id)}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-signal-orange flex justify-between items-center ${
                    truck.id === activeTruckId ? 'border-2 border-signal-orange bg-orange-50/20' : 'border-chalk'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-carbon text-xs">🚛 {truck.id}</span>
                      <span className="text-[9px] font-semibold text-slate">({truck.license})</span>
                      {truck.priority === 'Khẩn cấp' && (
                        <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold uppercase">Khẩn</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate">
                      Container: <strong className="text-carbon">{truck.container}</strong> • Nhiệm vụ: <strong className="text-signal-orange uppercase text-[9px]">{truck.task}</strong>
                    </div>
                    <div className="text-[10px] text-slate">
                      Khu vực: <strong className="text-carbon">{PORT_ZONES[truck.currentZoneId]?.label || truck.currentZoneId}</strong>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenDispatch(truck)
                    }}
                    className="h-7 px-2.5 bg-signal-orange text-white rounded text-[10px] font-bold hover:opacity-90"
                  >
                    Điều phối
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* 4. Queue Table & System Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Table of containers in queue (2/3 width) */}
        <div className="lg:col-span-2 bg-white border border-chalk rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-carbon">Container đang chờ xử lý</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-chalk text-slate font-bold uppercase text-[10px]">
                  <th className="py-2.5">Số Container</th>
                  <th className="py-2.5">Nhiệm vụ</th>
                  <th className="py-2.5">Vị trí hiện tại/Đề xuất</th>
                  <th className="py-2.5">Xe điều phối</th>
                  <th className="py-2.5">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk/60">
                {containers.map((c) => (
                  <tr key={c.id} className="hover:bg-fog/50 font-medium">
                    <td className="py-3 font-bold text-carbon">{c.id}</td>
                    <td className="py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        c.task === 'Lấy hàng' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {c.task}
                      </span>
                    </td>
                    <td className="py-3 font-mono font-bold text-carbon">{c.loc}</td>
                    <td className="py-3 text-slate">🚛 {c.truck}</td>
                    <td className="py-3">
                      <span className={`text-[10px] font-semibold ${
                        c.status === 'Waiting' ? 'text-amber-500' : c.status === 'Moving' ? 'text-blue-500' : 'text-green-600'
                      }`}>
                        ● {c.status === 'Waiting' ? 'Chờ điều phối' : c.status === 'Moving' ? 'Đang chạy' : 'Đang xử lý'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Warnings Panel (1/3 width) */}
        <div className="bg-white border border-chalk rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-carbon flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ba1a1a]">warning</span>
            Cảnh báo điều phối
          </h3>

          <div className="space-y-3 text-xs font-semibold">
            <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded flex gap-2 items-start">
              <span className="material-symbols-outlined text-red-600 text-base mt-0.5">report</span>
              <p className="text-red-700">Block B sắp đầy (mật độ xếp dỡ đạt 88%). Khuyên dùng Block C cho container nhập bãi mới.</p>
            </div>
            <div className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded flex gap-2 items-start">
              <span className="material-symbols-outlined text-yellow-600 text-base mt-0.5">schedule</span>
              <p className="text-yellow-700">5 xe đang chờ quá 15 phút tại Gate In do nghẽn luồng kiểm tra OCR.</p>
            </div>
            <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded flex gap-2 items-start">
              <span className="material-symbols-outlined text-blue-600 text-base mt-0.5">info</span>
              <p className="text-blue-700">Dock D02 đang quá tải hàng đợi cầu tàu MV PACIFIC STAR.</p>
            </div>
          </div>
        </div>

      </div>

      {/* 5. Dispatch History Logs */}
      <div className="bg-white border border-chalk rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-carbon">Lịch sử điều độ</h3>
        <div className="bg-fog rounded-lg border border-chalk p-4 max-h-40 overflow-y-auto space-y-2.5 font-mono text-xs">
          {logs.map((log, idx) => (
            <div key={idx} className="flex gap-3 text-graphite border-b border-chalk/40 pb-2 last:border-0 last:pb-0">
              <span className="text-[#ff682c] font-bold shrink-0">{log.time}</span>
              <span className="text-carbon">{log.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Dispatch Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-carbon/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <form
            onSubmit={handleConfirmDispatch}
            className="bg-white border border-chalk rounded-xl max-w-md w-full shadow-2xl p-6 space-y-6 animate-in fade-in zoom-in-95 duration-200"
          >
            <div>
              <h3 className="text-xl font-extrabold text-carbon">Ra lệnh điều phối xe</h3>
              <p className="text-xs text-slate mt-1">Giao nhiệm vụ và chỉ định vị trí bãi container cho phương tiện.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate tracking-wider mb-1">Mã xe</label>
                  <input
                    type="text"
                    readOnly
                    value={dispatchForm.truckId}
                    className="w-full h-10 border border-[#828282] bg-fog rounded px-3 text-sm font-bold text-carbon outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate tracking-wider mb-1">Ưu tiên</label>
                  <select
                    value={dispatchForm.priority}
                    onChange={e => setDispatchForm({ ...dispatchForm, priority: e.target.value })}
                    className="w-full h-10 border border-[#828282] rounded px-2 text-sm font-semibold bg-white"
                  >
                    <option value="Thường">Thường</option>
                    <option value="Cao">Cao</option>
                    <option value="Khẩn cấp">Khẩn cấp</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate tracking-wider mb-1">Loại nhiệm vụ</label>
                <div className="flex gap-6 mt-1 text-sm font-semibold">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="task"
                      checked={dispatchForm.task === 'Lấy hàng'}
                      onChange={() => setDispatchForm({ ...dispatchForm, task: 'Lấy hàng' })}
                      className="accent-signal-orange"
                    />
                    Lấy container ra giao
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="task"
                      checked={dispatchForm.task === 'Nhập bãi'}
                      onChange={() => setDispatchForm({ ...dispatchForm, task: 'Nhập bãi' })}
                      className="accent-signal-orange"
                    />
                    Đưa container vào bãi
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate tracking-wider mb-1">Chỉ định vị trí bãi đề xuất (Zone)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[9px] font-semibold text-slate">Block</span>
                    <select
                      value={dispatchForm.destZoneId}
                      onChange={e => setDispatchForm({ ...dispatchForm, destZoneId: e.target.value })}
                      className="w-full h-9 border border-chalk rounded px-1.5 text-xs bg-white mt-0.5 font-bold text-carbon"
                    >
                      <option value="BLOCK_A">Block A</option>
                      <option value="BLOCK_B">Block B</option>
                      <option value="BLOCK_C">Block C</option>
                      <option value="BLOCK_D">Block D</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate">Dãy (Row)</span>
                    <input
                      type="text"
                      value={dispatchForm.destRow}
                      onChange={e => setDispatchForm({ ...dispatchForm, destRow: e.target.value })}
                      className="w-full h-9 border border-chalk rounded px-2 text-xs text-carbon mt-0.5"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-slate">Tầng (Pos)</span>
                    <input
                      type="text"
                      value={dispatchForm.destPos}
                      onChange={e => setDispatchForm({ ...dispatchForm, destPos: e.target.value })}
                      className="w-full h-9 border border-chalk rounded px-2 text-xs text-carbon mt-0.5"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate tracking-wider mb-1">Ghi chú điều độ</label>
                <input
                  type="text"
                  placeholder="Nhập ghi chú cho Yard Operator..."
                  value={dispatchForm.notes}
                  onChange={e => setDispatchForm({ ...dispatchForm, notes: e.target.value })}
                  className="w-full h-10 border border-chalk rounded px-3 text-sm text-carbon focus:outline-none focus:ring-1 focus:ring-signal-orange"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-chalk pt-4">
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="h-10 px-4 border border-chalk text-slate rounded-lg text-xs font-semibold hover:bg-fog"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="h-10 px-5 bg-signal-orange text-white rounded-lg text-xs font-bold hover:opacity-90 shadow"
              >
                Xác nhận điều phối
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}
