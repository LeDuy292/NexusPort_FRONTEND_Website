import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function DispatcherDashboard() {
  const navigate = useNavigate()
  const [lastUpdated, setLastUpdated] = useState('Vừa xong')
  
  const [selectedBlock, setSelectedBlock] = useState({
    id: 'Khối bãi B',
    type: 'QUÁ TẢI KHẨN CẤP',
    occupancy: '92%',
    vehicles: 8,
    containers: 124,
    status: 'Quá tải',
    activeOps: 5,
    crane: 'Cẩu RTG-02 (Tải 92%)',
    waitingTrucks: [
      { id: 'TRK-001', plate: '43C-123.45', waitMin: 18, task: 'Lấy container MSCU1234567' },
      { id: 'TRK-008', plate: '15C-882.19', waitMin: 12, task: 'Hạ container MSCU7654321' }
    ],
    statusColor: 'text-red-600 bg-red-50 border-red-200'
  })

  const [activeBlockModal, setActiveBlockModal] = useState(null) // Modal khi click ô khối bãi
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [dispatchingTask, setDispatchingTask] = useState(null)
  const [vehicleFilter, setVehicleFilter] = useState('Tất cả')
  const [toastMessage, setToastMessage] = useState('')

  // 1. KPI DATA
  const kpis = {
    totalVehicles: 42,
    waitingDispatch: 12,
    inOperation: 24,
    containersWaiting: 18,
    yardUtilization: '78%',
    congestedAreas: 2
  }

  // 2. LIVE VEHICLES
  const vehicles = [
    { id: 'TRK-001', plate: '43C-123.45', driver: 'Nguyễn Văn A', container: 'MSCU1234567', loc: 'Cổng A', dest: 'Khối bãi B', task: 'Lấy container', status: 'Đang di chuyển', statusColor: 'bg-blue-500 text-white', eta: '3 phút' },
    { id: 'TRK-002', plate: '43C-234.56', driver: 'Trần Văn B', container: 'EVER991203-4', loc: 'Cổng vào', dest: 'Khối bãi C', task: 'Hạ container', status: 'Đang chờ', statusColor: 'bg-amber-500 text-white', eta: '5 phút' },
    { id: 'TRK-003', plate: '43C-345.67', driver: 'Lê Văn C', container: 'HLBU993210-5', loc: 'Khối bãi A', dest: 'Bến D01', task: 'Xếp dỡ bãi', status: 'Đang cẩu', statusColor: 'bg-purple-600 text-white', eta: 'Đang làm' },
    { id: 'TRK-008', plate: '15C-882.19', driver: 'Phạm Văn D', container: 'MSCU7654321', loc: 'Cổng vào', dest: 'Khối bãi B', task: 'Hạ container', status: 'Trễ hạn', statusColor: 'bg-red-600 text-white', eta: '12 phút' },
  ]

  // 3. PENDING DISPATCH TASKS
  const pendingTasks = [
    { id: 'TASK-101', vehicle: 'TRK-001', driver: 'Nguyễn Văn A', container: 'MSCU1234567', taskType: 'Lấy container', currentLoc: 'Cổng A', destination: 'Khối bãi B – B12-04', priority: 'ƯU TIÊN CAO', waitingTime: '18 phút', status: 'Chờ chỉ định' },
    { id: 'TASK-102', vehicle: 'TRK-008', driver: 'Phạm Văn D', container: 'MSCU7654321', taskType: 'Hạ container', currentLoc: 'Cổng vào', destination: 'Khối bãi C – C05-02', priority: 'TRUNG BÌNH', waitingTime: '12 phút', status: 'Chờ chỉ định' },
    { id: 'TASK-103', vehicle: 'TRK-002', driver: 'Trần Văn B', container: 'EVER991203-4', taskType: 'Hạ container', currentLoc: 'Cổng vào', destination: 'Khối bãi A – A02-01', priority: 'THƯỜNG', waitingTime: '8 phút', status: 'Chờ chỉ định' },
  ]

  // 4. TRAFFIC STATUS
  const trafficStatus = [
    { location: 'Cổng vào', status: 'Thông thoáng', color: 'text-green-600', badgeBg: 'bg-green-500' },
    { location: 'Cổng ra', status: 'Đông vừa', color: 'text-amber-600', badgeBg: 'bg-amber-500' },
    { location: 'Khối bãi A', status: 'Thông thoáng', color: 'text-green-600', badgeBg: 'bg-green-500' },
    { location: 'Khối bãi B', status: 'Ún tắc giao thông', color: 'text-red-600', badgeBg: 'bg-red-600' },
    { location: 'Khối bãi C', status: 'Thông thoáng', color: 'text-green-600', badgeBg: 'bg-green-500' },
  ]

  // 5. OPERATIONAL ALERTS
  const alerts = [
    { severity: '🔴 NGHIÊM TRỌNG', time: '10 phút trước', loc: 'Khối bãi B', desc: 'Khối bãi B bị quá tải (92% dung tích). Khuyến nghị điều hướng xe sang Khối C.' },
    { severity: '🟡 CẢNH BÁO', time: '15 phút trước', loc: 'Cổng vào', desc: '8 phương tiện đang chờ tại Cổng vào. Luồng quét camera OCR di chuyển chậm.' },
    { severity: '🟡 CẢNH BÁO', time: '22 phút trước', loc: 'TRK-008', desc: 'Xe TRK-008 bị trễ 12 phút do hàng đợi Cẩu bãi RTG-02.' },
  ]

  // 6. RECENT DISPATCH ACTIVITY
  const recentActivities = [
    { time: '08:42', vehicle: 'TRK-001', dest: 'Khối bãi B', container: 'MSCU1234567', action: 'Đã điều động', status: 'Hoạt động' },
    { time: '08:39', vehicle: 'TRK-004', dest: 'Khối bãi A', container: 'MSCU2345678', action: 'Đã hoàn thành', status: 'Hoàn tất' },
    { time: '08:35', vehicle: 'TRK-008', dest: 'Cổng ra', container: 'MSCU3456789', action: 'Đã hoàn thành', status: 'Hoàn tất' },
  ]

  const filteredVehicles = vehicles.filter(v => {
    if (vehicleFilter === 'Tất cả') return true
    if (vehicleFilter === 'Waiting') return v.status === 'Đang chờ'
    if (vehicleFilter === 'Moving') return v.status === 'Đang di chuyển'
    if (vehicleFilter === 'Handling') return v.status === 'Đang cẩu'
    if (vehicleFilter === 'Delayed') return v.status === 'Trễ hạn'
    return true
  })

  const handleBlockClick = (blockData) => {
    setSelectedBlock(blockData)
    setActiveBlockModal(blockData)
  }

  const handleRerouteBlock = (blockId) => {
    setToastMessage(`⚡ Đã tự động phân luồng chuyển hướng 4 xe tải từ ${blockId} sang Khối C!`)
    setActiveBlockModal(null)
    setTimeout(() => setToastMessage(''), 3000)
  }

  const handleConfirmDispatch = () => {
    if (!dispatchingTask) return
    setToastMessage(`✅ Đã xác nhận điều phối xe ${dispatchingTask.vehicle} đến ${dispatchingTask.destination} thành công!`)
    setDispatchingTask(null)
    setTimeout(() => setToastMessage(''), 3000)
  }

  return (
    <div className="p-8 w-full font-sans flex flex-col gap-6 relative">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-[#202020] text-white px-6 py-3.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 z-50 animate-bounce border border-signal-orange">
          <span className="text-signal-orange">●</span>
          {toastMessage}
        </div>
      )}

      {/* HEADER BAR */}
      <div className="flex justify-between items-center bg-white border border-chalk rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase">
              TRUNG TÂM ĐIỀU PHỐI VẬN HÀNH
            </span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
              🟢 HỆ THỐNG HOẠT ĐỘNG
            </span>
            <span className="text-xs text-slate font-mono">Cập nhật: {lastUpdated}</span>
          </div>
          <h2 className="font-heading text-3xl text-carbon font-extrabold mt-1">Trung tâm Điều phối Cảng NexusPort</h2>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div className="text-right">
            <span className="text-slate block text-[10px] uppercase font-bold">CA LÀM VIỆC</span>
            <strong className="text-carbon">Ca 1 (06:00 - 14:00)</strong>
          </div>
          
          <div className="flex items-center gap-3 border-l border-chalk pl-6">
            <div className="w-10 h-10 rounded-full bg-carbon text-white font-bold flex items-center justify-center text-sm shadow">
              NH
            </div>
            <div>
              <div className="font-bold text-carbon">Nguyễn Văn Hải</div>
              <span className="text-slate text-[11px]">Trưởng ca Điều độ</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI SECTION (6 CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Tổng số xe trong cảng</span>
          <div className="text-3xl font-extrabold text-carbon font-mono">{kpis.totalVehicles}</div>
          <span className="text-[11px] text-slate font-bold">Xe đang hoạt động</span>
        </div>

        <div className="bg-white border-2 border-amber-400 rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Xe đang chờ điều phối</span>
          <div className="text-3xl font-extrabold text-amber-500 font-mono">{kpis.waitingDispatch}</div>
          <span className="text-[11px] text-amber-600 font-bold">Đang chờ chỉ định</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Xe đang làm nhiệm vụ</span>
          <div className="text-3xl font-extrabold text-blue-600 font-mono">{kpis.inOperation}</div>
          <span className="text-[11px] text-blue-600 font-bold">Đang thực hiện lệnh</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Container chờ xử lý</span>
          <div className="text-3xl font-extrabold text-purple-600 font-mono">{kpis.containersWaiting}</div>
          <span className="text-[11px] text-slate font-bold">Chờ xếp dỡ bãi</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Hiệu suất dùng bãi</span>
          <div className="text-3xl font-extrabold text-carbon font-mono">{kpis.yardUtilization}</div>
          <span className="text-[11px] text-slate font-bold">Dung tích bãi sử dụng</span>
        </div>

        <div className="bg-white border-2 border-red-400 rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Khu vực ùn tắc</span>
          <div className="text-3xl font-extrabold text-red-600 font-mono">{kpis.congestedAreas}</div>
          <span className="text-[11px] text-red-600 font-bold">Mật độ quá tải</span>
        </div>
      </div>

      {/* MAIN CONTENT AREA: LIVE PORT MAP & PENDING DISPATCH PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: LIVE PORT MAP (7 cols - ~58%) */}
        <div className="lg:col-span-7 bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-6">
          
          <div className="flex justify-between items-center border-b border-chalk pb-3">
            <div>
              <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider">SƠ ĐỒ VẬN HÀNH THỜI GIAN THỰC</span>
              <h3 className="font-heading text-xl font-extrabold text-carbon">Sơ đồ Cảng & Trạng thái Bãi Realtime</h3>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Thông thoáng</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Cảnh báo</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600"></span> Quá tải</span>
            </div>
          </div>

          {/* INTERACTIVE DYNAMIC LIVE PORT MAP VIEWPORT (LIGHT THEME / GIAO DIỆN SÁNG) */}
          <div className="bg-slate-50 rounded-2xl p-6 relative border border-slate-200 text-slate-800 min-h-[460px] flex flex-col justify-between overflow-hidden shadow-sm">
            
            {/* SVG Background Traffic Lanes */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="portGridLight" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#cbd5e1" strokeWidth="0.8" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#portGridLight)" />
              <path d="M 120 40 L 120 180 Q 120 220 200 220 L 500 220" fill="none" stroke="#ff682c" strokeWidth="3" strokeDasharray="8 6" className="animate-pulse" />
              <path d="M 500 220 L 750 220 Q 820 220 820 320 L 820 400" fill="none" stroke="#2563eb" strokeWidth="3" strokeDasharray="6 4" />
              <path d="M 220 220 L 220 380" fill="none" stroke="#16a34a" strokeWidth="3" strokeDasharray="8 6" />
            </svg>

            {/* Top Gate Control Bar */}
            <div className="flex justify-between items-center text-xs font-mono border-b border-slate-200 pb-3.5 z-10">
              <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-green-300 shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span>
                <span className="text-slate-800 font-bold">CỔNG VÀO</span>
                <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded border border-green-200">5 Xe chờ</span>
              </div>
              
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-amber-300 shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="text-slate-800 font-bold">CỔNG RA</span>
                <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded border border-amber-200">2 Xe ra</span>
              </div>
            </div>

            {/* Moving Vehicle Tags Overlay */}
            <div className="relative z-10 my-3 grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between text-[11px] font-mono bg-orange-50 border border-orange-200 px-4 py-2.5 rounded-xl text-orange-950 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-signal-orange text-base animate-bounce">local_shipping</span>
                  <strong className="text-carbon">LUỒNG GIAO THÔNG ĐƯỜNG 01:</strong>
                  <span>🚛 TRK-001 (43C-123.45) đang di chuyển ➔ Khối bãi B (Dự kiến 3 phút)</span>
                </div>
                <span className="bg-signal-orange text-white font-bold px-2.5 py-0.5 rounded text-[10px]">Tốc độ: 25 km/h</span>
              </div>

              {/* Yard Blocks Grid (Clickable Block Cards) */}
              <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                
                {/* BLOCK A */}
                <div
                  onClick={() => handleBlockClick({
                    id: 'Khối bãi A',
                    type: 'HÀNG KHÔ',
                    occupancy: '78%',
                    vehicles: 5,
                    containers: 98,
                    status: 'Thông thoáng',
                    activeOps: 3,
                    crane: 'Cẩu RTG-01 (Tải 78%)',
                    waitingTrucks: [
                      { id: 'TRK-002', plate: '43C-234.56', waitMin: 8, task: 'Hạ container EVER991203-4' }
                    ],
                    statusColor: 'text-green-600 bg-green-50 border-green-200'
                  })}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative overflow-hidden bg-white shadow-sm ${
                    selectedBlock.id === 'Khối bãi A' ? 'border-green-600 ring-2 ring-green-100 shadow-md scale-[1.01]' : 'border-green-500/60 hover:border-green-600'
                  }`}
                >
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-slate-800 text-sm flex items-center gap-1.5 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                      KHỐI BÃI A (HÀNG KHÔ)
                    </span>
                    <span className="text-green-600 font-extrabold text-sm">78%</span>
                  </div>

                  <div className="w-full bg-slate-100 h-2 rounded-full mt-2.5 overflow-hidden border border-slate-200">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-400 h-full w-[78%] rounded-full"></div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-600 mt-3 pt-2 border-t border-slate-100 font-semibold">
                    <span>🚛 5 Xe làm việc • 98 Cont</span>
                    <span className="text-green-700 font-bold">Cẩu RTG-01 đang trực ➔</span>
                  </div>
                </div>

                {/* BLOCK B */}
                <div
                  onClick={() => handleBlockClick({
                    id: 'Khối bãi B',
                    type: 'QUÁ TẢI KHẨN CẤP ⚠',
                    occupancy: '92%',
                    vehicles: 8,
                    containers: 124,
                    status: 'Quá tải',
                    activeOps: 5,
                    crane: 'Cẩu RTG-02 (Tải 92%)',
                    waitingTrucks: [
                      { id: 'TRK-001', plate: '43C-123.45', waitMin: 18, task: 'Lấy container MSCU1234567' },
                      { id: 'TRK-008', plate: '15C-882.19', waitMin: 12, task: 'Hạ container MSCU7654321' }
                    ],
                    statusColor: 'text-red-600 bg-red-50 border-red-200'
                  })}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative overflow-hidden bg-red-50/80 shadow-md ${
                    selectedBlock.id === 'Khối bãi B' ? 'border-red-600 ring-2 ring-red-200 scale-[1.01]' : 'border-red-500 hover:border-red-600 animate-pulse'
                  }`}
                >
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-red-900 text-sm flex items-center gap-1.5 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
                      KHỐI BÃI B (QUÁ TẢI KHẨN CẤP)
                    </span>
                    <span className="text-red-600 font-extrabold text-sm">92% ⚠</span>
                  </div>

                  <div className="w-full bg-red-200/60 h-2 rounded-full mt-2.5 overflow-hidden border border-red-300">
                    <div className="bg-gradient-to-r from-amber-500 to-red-600 h-full w-[92%] rounded-full"></div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-red-900 mt-3 pt-2 border-t border-red-200 font-bold">
                    <span>🚛 8 Xe chờ Cẩu RTG-02</span>
                    <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px]">Bấm xem chi tiết ➔</span>
                  </div>
                </div>

                {/* BLOCK C */}
                <div
                  onClick={() => handleBlockClick({
                    id: 'Khối bãi C',
                    type: 'CONTAINER LẠNH (REEFER)',
                    occupancy: '54%',
                    vehicles: 3,
                    containers: 62,
                    status: 'Thông thoáng',
                    activeOps: 2,
                    crane: 'Cẩu RTG-03 (Tải 54%)',
                    waitingTrucks: [
                      { id: 'TRK-003', plate: '43C-345.67', waitMin: 5, task: 'Lấy container HLBU993210-5' }
                    ],
                    statusColor: 'text-blue-600 bg-blue-50 border-blue-200'
                  })}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative overflow-hidden bg-cyan-50/70 shadow-sm ${
                    selectedBlock.id === 'Khối bãi C' ? 'border-cyan-600 ring-2 ring-cyan-100 shadow-md scale-[1.01]' : 'border-cyan-500/60 hover:border-cyan-600'
                  }`}
                >
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-slate-800 text-sm flex items-center gap-1.5 font-bold">
                      <span className="material-symbols-outlined text-cyan-600 text-sm">ac_unit</span>
                      KHỐI BÃI C (CONTAINER LẠNH)
                    </span>
                    <span className="text-cyan-600 font-extrabold text-sm">54%</span>
                  </div>

                  <div className="w-full bg-cyan-200/60 h-2 rounded-full mt-2.5 overflow-hidden border border-cyan-300">
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full w-[54%] rounded-full"></div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-700 mt-3 pt-2 border-t border-cyan-200 font-semibold">
                    <span>🚛 3 Xe làm việc • 62 Cont</span>
                    <span className="text-cyan-700 font-bold">Điện lạnh 100% OK ➔</span>
                  </div>
                </div>

                {/* BLOCK D */}
                <div
                  onClick={() => handleBlockClick({
                    id: 'Khối bãi D',
                    type: 'BÃI RỖNG / EMPTY',
                    occupancy: '38%',
                    vehicles: 2,
                    containers: 40,
                    status: 'Thông thoáng',
                    activeOps: 1,
                    crane: 'Xe nâng Reach Stacker RS-01',
                    waitingTrucks: [],
                    statusColor: 'text-green-600 bg-green-50 border-green-200'
                  })}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative overflow-hidden bg-white shadow-sm ${
                    selectedBlock.id === 'Khối bãi D' ? 'border-emerald-600 ring-2 ring-emerald-100 shadow-md scale-[1.01]' : 'border-emerald-400 hover:border-emerald-600'
                  }`}
                >
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-slate-800 text-sm flex items-center gap-1.5 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      KHỐI BÃI D (BÃI RỖNG / EMPTY)
                    </span>
                    <span className="text-emerald-600 font-extrabold text-sm">38%</span>
                  </div>

                  <div className="w-full bg-slate-100 h-2 rounded-full mt-2.5 overflow-hidden border border-slate-200">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full w-[38%] rounded-full"></div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-600 mt-3 pt-2 border-t border-slate-100 font-semibold">
                    <span>🚛 2 Xe di chuyển • 40 Cont</span>
                    <span className="text-emerald-700 font-bold">Sẵn sàng nhận hàng ➔</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Bottom Dock Bar */}
            <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-xs font-mono z-10 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-signal-orange font-bold">
                <span className="material-symbols-outlined text-lg animate-spin" style={{ animationDuration: '8s' }}>anchor</span>
                <span>BẾN DỠ TÀU D01 & D02</span>
              </div>
              
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-700">Tàu: <strong className="text-carbon font-bold">MSC CAPELLA</strong> (Tiến độ dỡ: 85%)</span>
                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded text-[10px] font-bold">
                  2 Cẩu bờ QC-01 & QC-02 đang dỡ
                </span>
              </div>
            </div>

          </div>

          {/* SELECTED BLOCK DETAILS FOOTER */}
          {selectedBlock && (
            <div className="bg-fog rounded-xl p-4 border border-chalk flex justify-between items-center text-xs font-mono">
              <div>
                <strong className="text-carbon text-sm font-sans">Chi tiết {selectedBlock.id} ({selectedBlock.type})</strong>
                <div className="text-slate text-[11px] mt-0.5">
                  Xe đang bốc dỡ: <strong>{selectedBlock.vehicles} xe</strong> • Số Container: <strong>{selectedBlock.containers} Cont</strong> • {selectedBlock.crane}
                </div>
              </div>
              <button
                onClick={() => setActiveBlockModal(selectedBlock)}
                className="bg-carbon text-white font-sans px-4 py-2 rounded-full font-bold hover:bg-black transition-colors"
              >
                Mở Bảng Điều Hành ➔
              </button>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: PENDING DISPATCH PANEL */}
        <div className="lg:col-span-5 bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
          
          <div className="flex justify-between items-center border-b border-chalk pb-3">
            <div>
              <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider">CẦN XỬ LÝ GẤP</span>
              <h3 className="font-heading text-lg font-extrabold text-carbon">Nhiệm Vụ Chờ Điều Phối</h3>
            </div>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {pendingTasks.length} Nhiệm vụ
            </span>
          </div>

          <div className="space-y-4">
            {pendingTasks.map(task => (
              <div key={task.id} className="bg-fog/50 border border-chalk rounded-xl p-4 space-y-3 shadow-sm hover:border-signal-orange transition-colors">
                
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold bg-carbon text-white px-2 py-0.5 rounded tracking-wider font-mono">
                      {task.priority}
                    </span>
                    <h4 className="font-bold text-carbon text-sm font-mono mt-1">{task.vehicle}</h4>
                    <span className="text-xs text-slate font-mono">Tài xế: {task.driver}</span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate uppercase font-bold block">THỜI GIAN CHỜ</span>
                    <span className="text-red-600 font-bold font-mono text-xs">{task.waitingTime}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-chalk text-xs space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate">Loại lệnh:</span>
                    <strong className="text-signal-orange">{task.taskType}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate">Container:</span>
                    <strong className="text-carbon">{task.container}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate">Lộ trình:</span>
                    <strong className="text-carbon">{task.currentLoc} ➔ {task.destination}</strong>
                  </div>
                </div>

                <button
                  onClick={() => setDispatchingTask(task)}
                  className="w-full h-10 bg-signal-orange text-white rounded-full font-bold text-xs hover:opacity-95 transition-opacity shadow flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  ĐIỀU PHỐI NHIỆM VỤ NGAY
                </button>

              </div>
            ))}
          </div>

        </div>

      </div>

      {/* MIDDLE ROW: LIVE VEHICLE TRACKING PANEL & TRAFFIC MONITOR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-chalk pb-3">
            <h3 className="font-heading text-lg font-extrabold text-carbon">Theo Dõi Phương Tiện Trực Tiếp</h3>
            <div className="flex gap-1 text-[10px] font-bold">
              {['Tất cả', 'Waiting', 'Moving', 'Handling', 'Delayed'].map(f => (
                <button
                  key={f}
                  onClick={() => setVehicleFilter(f)}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    vehicleFilter === f ? 'bg-carbon text-white shadow-sm' : 'border border-chalk text-slate hover:text-carbon'
                  }`}
                >
                  {f === 'Waiting' ? 'Đang chờ' : f === 'Moving' ? 'Đang di chuyển' : f === 'Handling' ? 'Đang cẩu' : f === 'Delayed' ? 'Trễ hạn' : 'Tất cả'}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-fog text-slate font-bold uppercase text-[10px] border-b border-chalk">
                  <th className="py-3 px-4">Mã Xe</th>
                  <th className="py-3 px-4">Tài xế</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Vị trí ➔ Điểm đến</th>
                  <th className="py-3 px-4 text-right">Dự kiến (ETA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk font-medium font-mono">
                {filteredVehicles.map(v => (
                  <tr
                    key={v.id}
                    onClick={() => setSelectedVehicle(v)}
                    className="hover:bg-fog/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-carbon">{v.id} ({v.plate})</td>
                    <td className="py-3.5 px-4 font-sans text-graphite">{v.driver}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${v.statusColor}`}>
                        ● {v.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-graphite">{v.loc} ➔ {v.dest}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-carbon">{v.eta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-heading text-lg font-extrabold text-carbon border-b border-chalk pb-3">
            Trạng Thái Giao Thông & Luồng Cont
          </h3>
          <div className="space-y-3 text-xs">
            {trafficStatus.map((t, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-fog rounded-xl border border-chalk">
                <span className="font-bold text-carbon">{t.location}</span>
                <span className={`font-bold flex items-center gap-1.5 ${t.color}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${t.badgeBg}`}></span>
                  {t.status}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-chalk space-y-2">
            <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">TIẾN TRÌNH LUỒNG CONTAINER</span>
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono font-bold">
              <div className="bg-fog p-2 rounded-lg border border-chalk">
                <span className="text-[10px] text-slate block font-sans">ĐANG CHỜ</span>
                <span className="text-amber-600 text-sm">18</span>
              </div>
              <div className="bg-fog p-2 rounded-lg border border-chalk">
                <span className="text-[10px] text-slate block font-sans">ĐÃ CHỈ ĐỊNH</span>
                <span className="text-blue-600 text-sm">12</span>
              </div>
              <div className="bg-fog p-2 rounded-lg border border-chalk">
                <span className="text-[10px] text-slate block font-sans">ĐANG CẨU</span>
                <span className="text-purple-600 text-sm">8</span>
              </div>
              <div className="bg-fog p-2 rounded-lg border border-chalk">
                <span className="text-[10px] text-slate block font-sans">HOÀN TẤT</span>
                <span className="text-green-600 text-sm">26</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 💥 MODAL BẢNG ĐIỀU HÀNH KHI CLICK VÀO BẤT KỲ KHỐI BÃI NÀO (BLOCK OPERATIONAL MODAL) 💥 */}
      {activeBlockModal && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-start border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">BẢNG ĐIỀU HÀNH KHỐI BÃI CONTAINER</span>
                <h3 className="font-heading text-2xl font-extrabold text-carbon">{activeBlockModal.id}</h3>
                <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full mt-1 ${activeBlockModal.statusColor}`}>
                  ● Trạng thái: {activeBlockModal.status} ({activeBlockModal.occupancy} Dung tích)
                </span>
              </div>
              <button
                onClick={() => setActiveBlockModal(null)}
                className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-fog p-3 rounded-xl border border-chalk">
                  <span className="text-[10px] text-slate font-sans block">XE ĐANG LÀM VIỆC</span>
                  <strong className="text-lg text-carbon">{activeBlockModal.vehicles} xe</strong>
                </div>
                <div className="bg-fog p-3 rounded-xl border border-chalk">
                  <span className="text-[10px] text-slate font-sans block">TỔNG CONTAINER</span>
                  <strong className="text-lg text-carbon">{activeBlockModal.containers} Cont</strong>
                </div>
                <div className="bg-fog p-3 rounded-xl border border-chalk">
                  <span className="text-[10px] text-slate font-sans block">CẨU TRỰC BÃI</span>
                  <strong className="text-xs text-signal-orange font-bold block mt-1">{activeBlockModal.crane}</strong>
                </div>
              </div>

              {/* Danh sách xe đang chờ tại khối bãi này */}
              <div className="space-y-2 border-t border-chalk pt-3">
                <span className="text-[10px] font-bold text-slate uppercase font-sans">DANH SÁCH XE ĐANG CHỜ TẠI KHỐI NÀY</span>
                {activeBlockModal.waitingTrucks && activeBlockModal.waitingTrucks.length > 0 ? (
                  activeBlockModal.waitingTrucks.map((trk, idx) => (
                    <div key={idx} className="p-3 bg-fog rounded-xl border border-chalk flex justify-between items-center">
                      <div>
                        <strong className="text-carbon">{trk.id} ({trk.plate})</strong>
                        <div className="text-[11px] text-slate font-sans mt-0.5">{trk.task}</div>
                      </div>
                      <span className="text-red-600 font-bold text-xs">Chờ {trk.waitMin}p</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate italic font-sans">Không có xe đang chờ ùn ứ tại khối này.</p>
                )}
              </div>
            </div>

            {/* HÀNH ĐỘNG NGHIỆP VỤ ĐIỀU PHỐI KHẨN CẤP */}
            <div className="space-y-3 pt-2 border-t border-chalk">
              <button
                onClick={() => handleRerouteBlock(activeBlockModal.id)}
                className="w-full h-11 bg-signal-orange text-white rounded-full font-extrabold text-xs hover:opacity-95 transition-opacity shadow flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">alt_route</span>
                TỰ ĐỘNG PHÂN LUỒNG GIẢI TỎA XE SANG KHỐI C
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setToastMessage(`🚜 Đã gửi yêu cầu tăng cường Cẩu RTG dự phòng đến ${activeBlockModal.id}!`)
                    setActiveBlockModal(null)
                    setTimeout(() => setToastMessage(''), 3000)
                  }}
                  className="flex-1 h-10 rounded-full border border-carbon text-carbon font-bold text-xs hover:bg-fog transition-colors"
                >
                  TĂNG CƯỜNG CẨU BÃI
                </button>

                <button
                  onClick={() => {
                    setActiveBlockModal(null)
                    navigate('/yard')
                  }}
                  className="flex-1 h-10 rounded-full bg-carbon text-white font-bold text-xs hover:bg-black transition-colors"
                >
                  XEM SƠ ĐỒ BAY BÃI ➔
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* DISPATCH CONFIRMATION MODAL */}
      {dispatchingTask && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">THAO TÁC ĐIỀU PHỐI</span>
                <h3 className="font-heading text-2xl font-extrabold text-carbon">Xác Nhận Lệnh Điều Động</h3>
              </div>
              <button onClick={() => setDispatchingTask(null)} className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="bg-fog p-5 rounded-2xl border border-chalk space-y-3 font-mono text-xs">
              <div className="flex justify-between"><span className="text-slate font-sans">Mã Phương tiện:</span><strong className="text-carbon text-sm font-bold">{dispatchingTask.vehicle}</strong></div>
              <div className="flex justify-between"><span className="text-slate font-sans">Tài xế điều khiển:</span><strong className="text-carbon font-bold">{dispatchingTask.driver}</strong></div>
              <div className="flex justify-between"><span className="text-slate font-sans">Container tiếp nhận:</span><strong className="text-carbon font-bold">{dispatchingTask.container}</strong></div>
              <div className="flex justify-between"><span className="text-slate font-sans">Loại nhiệm vụ:</span><strong className="text-signal-orange font-bold">{dispatchingTask.taskType}</strong></div>
              <div className="flex justify-between"><span className="text-slate font-sans">Vị trí hiện tại:</span><strong className="text-carbon font-bold">{dispatchingTask.currentLoc}</strong></div>
              <div className="flex justify-between border-t border-chalk pt-2"><span className="text-slate font-sans">Điểm đến đề xuất:</span><strong className="text-signal-orange text-sm font-extrabold">{dispatchingTask.destination}</strong></div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setDispatchingTask(null)} className="flex-1 h-12 rounded-full border border-chalk font-bold text-xs hover:bg-fog transition-colors">Hủy bỏ</button>
              <button onClick={handleConfirmDispatch} className="flex-1 h-12 bg-signal-orange text-white rounded-full font-extrabold text-xs hover:opacity-95 transition-opacity shadow-lg">XÁC NHẬN ĐIỀU PHỐI</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
