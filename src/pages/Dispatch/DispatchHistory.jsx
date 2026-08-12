import React, { useState, useMemo } from 'react'

// ─── MOCK DATA ─────────────────────────────────────────────────────────────────
const MOCK_DISPATCHES = [
  {
    id: 'DSP-20260811-001', time: '08:42', date: 'Hôm nay',
    vehicle: 'TRK-001', vehiclePlate: '43C-123.45',
    driver: 'Nguyễn Văn A', driverId: 'DRV-001',
    container: 'MSCU1234567', taskType: 'PORT_PICKUP', taskLabel: 'Lấy Container',
    origin: 'Cổng A – Tiên Sa', destination: 'Kho Lạnh Hòa Cầm',
    dispatcher: 'Dispatcher 01',
    status: 'COMPLETED',
    dispatchTime: '08:42', startTime: '08:43', arrivalTime: '08:46', completionTime: '08:52',
    duration: '10 phút', waitTime: '3 phút',
    gateBooking: 'GB-20260811-001',
    timeline: [
      { time: '08:42', event: 'Tạo lệnh điều phối' },
      { time: '08:43', event: 'Xe bắt đầu di chuyển' },
      { time: '08:46', event: 'Xe đến điểm nhận hàng' },
      { time: '08:47', event: 'Bắt đầu bốc xếp container' },
      { time: '08:52', event: 'Hoàn thành nhiệm vụ' },
    ]
  },
  {
    id: 'DSP-20260811-002', time: '09:10', date: 'Hôm nay',
    vehicle: 'YTR-003', vehiclePlate: 'YT-003',
    driver: 'Võ Thị F', driverId: 'DRV-006',
    container: 'MSCU7788990', taskType: 'YARD_MOVE', taskLabel: 'Nội bãi',
    origin: 'Khối bãi A – A01-02', destination: 'Khu cẩu RTG-01',
    dispatcher: 'Dispatcher 01',
    status: 'COMPLETED',
    dispatchTime: '09:10', startTime: '09:11', arrivalTime: '09:14', completionTime: '09:18',
    duration: '8 phút', waitTime: '2 phút',
    gateBooking: 'N/A (Nội bãi)',
    timeline: [
      { time: '09:10', event: 'Tạo lệnh điều phối' },
      { time: '09:11', event: 'Xe đầu kéo nội bãi khởi động' },
      { time: '09:14', event: 'Đến vị trí Khối bãi A' },
      { time: '09:15', event: 'Kết nối đầu kéo với container' },
      { time: '09:18', event: 'Container đến RTG-01 – Hoàn thành' },
    ]
  },
  {
    id: 'DSP-20260811-003', time: '09:55', date: 'Hôm nay',
    vehicle: 'TRK-008', vehiclePlate: '15C-882.19',
    driver: 'Phạm Văn D', driverId: 'DRV-004',
    container: 'EVER991203', taskType: 'DELIVERY', taskLabel: 'Giao Container',
    origin: 'Kho Liên Chiểu', destination: 'Cảng Tiên Sa – Bến B',
    dispatcher: 'Dispatcher 02',
    status: 'DELAYED',
    dispatchTime: '09:55', startTime: '09:58', arrivalTime: '10:30', completionTime: '—',
    duration: '35+ phút', waitTime: '8 phút',
    gateBooking: 'GB-20260811-002',
    timeline: [
      { time: '09:55', event: 'Tạo lệnh điều phối' },
      { time: '09:58', event: 'Xe bắt đầu di chuyển' },
      { time: '10:12', event: '⚠ Phát hiện tắc đường QL14B' },
      { time: '10:30', event: 'Xe đến cổng cảng (trễ 15 phút)' },
    ]
  },
  {
    id: 'DSP-20260811-004', time: '10:20', date: 'Hôm nay',
    vehicle: 'TRK-003', vehiclePlate: '43A-567.90',
    driver: 'Trần Văn B', driverId: 'DRV-002',
    container: 'MSCU4455667', taskType: 'PORT_PICKUP', taskLabel: 'Lấy Container',
    origin: 'Cổng B – Tiên Sa', destination: 'Depot Liên Chiểu',
    dispatcher: 'Dispatcher 01',
    status: 'IN_PROGRESS',
    dispatchTime: '10:20', startTime: '10:21', arrivalTime: '—', completionTime: '—',
    duration: 'Đang chạy', waitTime: '1 phút',
    gateBooking: 'GB-20260811-003',
    timeline: [
      { time: '10:20', event: 'Tạo lệnh điều phối' },
      { time: '10:21', event: 'Xe khởi hành từ bãi đậu' },
      { time: '10:24', event: 'Xe qua cổng kiểm soát (Gate B)' },
    ]
  },
  {
    id: 'DSP-20260811-005', time: '11:05', date: 'Hôm nay',
    vehicle: 'TRK-012', vehiclePlate: '92C-445.11',
    driver: 'Lê Văn C', driverId: 'DRV-003',
    container: 'MSCU9900112', taskType: 'DELIVERY', taskLabel: 'Giao Container',
    origin: 'Kho An Đồn', destination: 'Cảng Tiên Sa – Bến A',
    dispatcher: 'Dispatcher 02',
    status: 'CANCELLED',
    dispatchTime: '11:05', startTime: '—', arrivalTime: '—', completionTime: '—',
    duration: '—', waitTime: '—',
    gateBooking: 'GB-20260811-004',
    timeline: [
      { time: '11:05', event: 'Tạo lệnh điều phối' },
      { time: '11:06', event: '❌ Lệnh bị hủy – Container đã được dỡ sớm' },
    ]
  },
  {
    id: 'DSP-20260810-021', time: '14:30', date: 'Hôm qua',
    vehicle: 'TRK-001', vehiclePlate: '43C-123.45',
    driver: 'Nguyễn Văn A', driverId: 'DRV-001',
    container: 'MSCU3311009', taskType: 'PORT_PICKUP', taskLabel: 'Lấy Container',
    origin: 'Cổng A – Tiên Sa', destination: 'Kho Hòa Cầm',
    dispatcher: 'Dispatcher 01',
    status: 'COMPLETED',
    dispatchTime: '14:30', startTime: '14:31', arrivalTime: '14:38', completionTime: '14:45',
    duration: '15 phút', waitTime: '4 phút',
    gateBooking: 'GB-20260810-009',
    timeline: [
      { time: '14:30', event: 'Tạo lệnh điều phối' },
      { time: '14:31', event: 'Xe khởi hành' },
      { time: '14:38', event: 'Đến điểm nhận' },
      { time: '14:45', event: 'Hoàn thành' },
    ]
  },
  {
    id: 'DSP-20260810-019', time: '12:15', date: 'Hôm qua',
    vehicle: 'YTR-005', vehiclePlate: 'YT-005',
    driver: 'Võ Thị F', driverId: 'DRV-006',
    container: 'MSCU5577889', taskType: 'YARD_MOVE', taskLabel: 'Nội bãi',
    origin: 'Khối bãi C – C03-01', destination: 'Khối bãi F – F01-02',
    dispatcher: 'Dispatcher 03',
    status: 'COMPLETED',
    dispatchTime: '12:15', startTime: '12:16', arrivalTime: '12:19', completionTime: '12:24',
    duration: '9 phút', waitTime: '1 phút',
    gateBooking: 'N/A (Nội bãi)',
    timeline: [
      { time: '12:15', event: 'Tạo lệnh điều phối' },
      { time: '12:16', event: 'Xe nội bãi khởi động' },
      { time: '12:19', event: 'Đến Khối C' },
      { time: '12:24', event: 'Hoàn thành – Container ở F01-02' },
    ]
  },
  {
    id: 'DSP-20260810-015', time: '09:00', date: 'Hôm qua',
    vehicle: 'TRK-008', vehiclePlate: '15C-882.19',
    driver: 'Hoàng Văn E', driverId: 'DRV-005',
    container: 'MSCU2200334', taskType: 'PORT_PICKUP', taskLabel: 'Lấy Container',
    origin: 'Cổng A – Tiên Sa', destination: 'Depot Bắc Mỹ An',
    dispatcher: 'Dispatcher 02',
    status: 'DELAYED',
    dispatchTime: '09:00', startTime: '09:02', arrivalTime: '09:45', completionTime: '10:00',
    duration: '60 phút', waitTime: '20 phút',
    gateBooking: 'GB-20260810-007',
    timeline: [
      { time: '09:00', event: 'Tạo lệnh điều phối' },
      { time: '09:02', event: 'Xe khởi hành' },
      { time: '09:25', event: '⚠ Xe hỏng lốp tại QL1A' },
      { time: '09:40', event: 'Sửa chữa tại chỗ hoàn tất' },
      { time: '09:45', event: 'Xe đến cảng (trễ 30 phút)' },
      { time: '10:00', event: 'Hoàn thành nhiệm vụ' },
    ]
  },
]

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  COMPLETED:   { label: 'Hoàn thành',    badge: 'bg-green-50 text-green-800 border-green-300',   dot: 'bg-green-500',  icon: '🟢' },
  DELAYED:     { label: 'Trễ hạn',       badge: 'bg-amber-50 text-amber-800 border-amber-300',   dot: 'bg-amber-400',  icon: '🟡' },
  CANCELLED:   { label: 'Đã hủy',        badge: 'bg-red-50 text-red-800 border-red-300',         dot: 'bg-red-500',    icon: '🔴' },
  IN_PROGRESS: { label: 'Đang thực hiện',badge: 'bg-blue-50 text-blue-800 border-blue-300',      dot: 'bg-blue-500',   icon: '🔵' },
}

const TASK_TYPE_CFG = {
  PORT_PICKUP: { label: 'Lấy Container',  color: 'bg-orange-50 text-orange-800 border-orange-300' },
  DELIVERY:    { label: 'Giao Container', color: 'bg-purple-50 text-purple-800 border-purple-300' },
  YARD_MOVE:   { label: 'Nội bãi',        color: 'bg-teal-50 text-teal-800 border-teal-300' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.IN_PROGRESS
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>{cfg.label}
    </span>
  )
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
export default function DispatchHistory() {
  const [search, setSearch]             = useState('')
  const [dateFilter, setDateFilter]     = useState('TODAY')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [taskFilter, setTaskFilter]     = useState('ALL')
  const [vehicleFilter, setVehicleFilter] = useState('')
  const [drawerItem, setDrawerItem]     = useState(null)
  const [currentPage, setCurrentPage]   = useState(1)
  const [toast, setToast]               = useState('')
  const PAGE_SIZE = 6

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2800) }

  const DATE_LABELS = { TODAY: 'Hôm nay', YESTERDAY: 'Hôm qua', LAST7: '7 ngày qua', LAST30: '30 ngày qua' }

  // KPIs
  const kpi = useMemo(() => {
    const all = MOCK_DISPATCHES
    const success = all.filter(d => d.status === 'COMPLETED').length
    return {
      total:      all.length,
      completed:  success,
      delayed:    all.filter(d => d.status === 'DELAYED').length,
      cancelled:  all.filter(d => d.status === 'CANCELLED').length,
      inProgress: all.filter(d => d.status === 'IN_PROGRESS').length,
      successRate: Math.round((success / all.length) * 100) + '%',
    }
  }, [])

  // Filtered list
  const filtered = useMemo(() => {
    let list = [...MOCK_DISPATCHES]
    if (dateFilter === 'TODAY')     list = list.filter(d => d.date === 'Hôm nay')
    if (dateFilter === 'YESTERDAY') list = list.filter(d => d.date === 'Hôm qua')
    if (statusFilter !== 'ALL') list = list.filter(d => d.status === statusFilter)
    if (taskFilter !== 'ALL')   list = list.filter(d => d.taskType === taskFilter)
    if (vehicleFilter) list = list.filter(d => d.vehicle.toLowerCase().includes(vehicleFilter.toLowerCase()) || d.vehiclePlate.toLowerCase().includes(vehicleFilter.toLowerCase()))
    const q = search.toLowerCase()
    if (q) list = list.filter(d =>
      d.id.toLowerCase().includes(q) || d.vehicle.toLowerCase().includes(q) ||
      d.driver.toLowerCase().includes(q) || d.container.toLowerCase().includes(q) ||
      d.gateBooking.toLowerCase().includes(q)
    )
    return list
  }, [search, dateFilter, statusFilter, taskFilter, vehicleFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Performance metrics
  const perf = useMemo(() => {
    const completed = MOCK_DISPATCHES.filter(d => d.status === 'COMPLETED')
    return {
      avgDispatch: '6.4 phút',
      avgWait: '4.2 phút',
      completionRate: '89%',
      delayed: kpi.delayed,
    }
  }, [kpi])

  const handleExportCSV = () => {
    const headers = 'Mã Lệnh,Giờ,Xe,Tài xế,Container,Loại,Xuất phát,Điểm đến,Dispatcher,Trạng thái\n'
    const rows = filtered.map(d =>
      `${d.id},${d.time},${d.vehicle},${d.driver},${d.container},${d.taskLabel},${d.origin},${d.destination},${d.dispatcher},${STATUS_CFG[d.status]?.label}`
    ).join('\n')
    const blob = new Blob(['\ufeff' + headers + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'dispatch_history.csv'; a.click()
    URL.revokeObjectURL(url)
    showToast('📥 Đã xuất file CSV lịch sử điều phối!')
  }

  return (
    <div className="p-8 w-full font-sans flex flex-col gap-6 relative min-h-full bg-mist">

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
          <h2 className="font-heading text-3xl text-carbon font-extrabold mt-0.5">Lịch Sử Điều Phối</h2>
          <p className="text-xs text-slate mt-0.5">Xem lại toàn bộ lịch sử lệnh điều phối xe và container. Dữ liệu lịch sử chỉ đọc.</p>
        </div>
        <button onClick={handleExportCSV}
          className="h-11 px-5 bg-white border border-chalk text-carbon rounded-xl font-extrabold text-xs hover:border-signal-orange hover:text-signal-orange transition-all shadow-sm flex items-center gap-2 flex-shrink-0">
          <span className="material-symbols-outlined text-lg">download</span>Xuất CSV
        </button>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Tổng Lệnh',     value: kpi.total,      border: 'border-slate-300',  icon: 'receipt_long',  text: 'text-carbon' },
          { label: 'Hoàn Thành',    value: kpi.completed,  border: 'border-green-400',  icon: 'check_circle',  text: 'text-green-700' },
          { label: 'Trễ Hạn',       value: kpi.delayed,    border: 'border-amber-400',  icon: 'schedule',      text: 'text-amber-700' },
          { label: 'Đã Hủy',        value: kpi.cancelled,  border: 'border-red-400',    icon: 'cancel',        text: 'text-red-700' },
          { label: 'Tỉ Lệ Thành Công', value: kpi.successRate, border: 'border-blue-400', icon: 'trending_up', text: 'text-blue-700' },
        ].map(k => (
          <div key={k.label} className={`bg-white rounded-xl p-4 border-l-4 ${k.border} border border-chalk shadow-sm flex flex-col gap-1`}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate uppercase tracking-wider leading-tight">{k.label}</span>
              <span className={`material-symbols-outlined text-[18px] ${k.text} opacity-60`}>{k.icon}</span>
            </div>
            <span className={`text-3xl font-extrabold font-heading ${k.text}`}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* ── FILTER BAR ── */}
      <div className="bg-white rounded-xl border border-chalk shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate text-[18px]">search</span>
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
              placeholder="Tìm theo mã lệnh, xe, tài xế, container, gate booking..."
              className="w-full pl-9 pr-4 h-9 border border-chalk rounded-lg text-xs text-carbon placeholder-slate focus:outline-none focus:border-signal-orange bg-fog" />
          </div>

          {/* Vehicle search */}
          <input type="text" value={vehicleFilter} onChange={e => { setVehicleFilter(e.target.value); setCurrentPage(1) }}
            placeholder="Lọc theo xe (VD: TRK-001)"
            className="h-9 px-3 border border-chalk rounded-lg text-xs text-carbon bg-fog focus:outline-none focus:border-signal-orange min-w-[160px]" />

          {/* Reset */}
          <button onClick={() => { setSearch(''); setDateFilter('TODAY'); setStatusFilter('ALL'); setTaskFilter('ALL'); setVehicleFilter(''); setCurrentPage(1) }}
            className="h-9 px-4 border border-chalk rounded-lg text-xs font-semibold text-slate hover:text-carbon hover:bg-fog transition-all">
            ↺ Đặt lại
          </button>

          <span className="text-[11px] text-slate ml-auto">{filtered.length} lệnh</span>
        </div>

        <div className="flex flex-wrap gap-2 items-center border-t border-chalk pt-3">
          {/* Date filter */}
          <div className="flex gap-1">
            {[['TODAY','Hôm nay'],['YESTERDAY','Hôm qua'],['LAST7','7 ngày'],['LAST30','30 ngày']].map(([val, lbl]) => (
              <button key={val} onClick={() => { setDateFilter(val); setCurrentPage(1) }}
                className={`px-3 h-8 rounded-lg text-[11px] font-semibold border transition-all ${dateFilter === val ? 'bg-signal-orange text-white border-signal-orange' : 'bg-fog text-graphite border-chalk hover:border-slate'}`}>
                {lbl}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-chalk mx-1" />

          {/* Status filter */}
          <div className="flex gap-1">
            {[['ALL','Tất cả'],['COMPLETED','🟢 Hoàn thành'],['IN_PROGRESS','🔵 Đang chạy'],['DELAYED','🟡 Trễ hạn'],['CANCELLED','🔴 Đã hủy']].map(([val, lbl]) => (
              <button key={val} onClick={() => { setStatusFilter(val); setCurrentPage(1) }}
                className={`px-3 h-8 rounded-lg text-[11px] font-semibold border transition-all ${statusFilter === val ? 'bg-slate-800 text-white border-slate-800' : 'bg-fog text-graphite border-chalk hover:border-slate'}`}>
                {lbl}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-chalk mx-1" />

          {/* Task type filter */}
          <div className="flex gap-1">
            {[['ALL','Tất cả loại'],['PORT_PICKUP','Lấy hàng'],['DELIVERY','Giao hàng'],['YARD_MOVE','Nội bãi']].map(([val, lbl]) => (
              <button key={val} onClick={() => { setTaskFilter(val); setCurrentPage(1) }}
                className={`px-3 h-8 rounded-lg text-[11px] font-semibold border transition-all ${taskFilter === val ? 'bg-purple-600 text-white border-purple-600' : 'bg-fog text-graphite border-chalk hover:border-slate'}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN 2-COLUMN LAYOUT ── */}
      <div className="flex gap-6 items-start">

        {/* ── HISTORY TABLE (Left / Main) ── */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-chalk shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-chalk bg-fog flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate uppercase tracking-wider">
              Lịch Sử Lệnh Điều Phối — {DATE_LABELS[dateFilter] || dateFilter}
            </span>
            <span className="text-[11px] text-slate">{filtered.length} lệnh</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-chalk text-[10px] uppercase text-slate font-bold tracking-wider bg-fog/50">
                  <th className="px-5 py-3 text-left">Giờ</th>
                  <th className="px-4 py-3 text-left">Phương Tiện</th>
                  <th className="px-4 py-3 text-left">Tài Xế</th>
                  <th className="px-4 py-3 text-left">Container</th>
                  <th className="px-4 py-3 text-left">Loại</th>
                  <th className="px-4 py-3 text-left">Điểm Đến</th>
                  <th className="px-4 py-3 text-left">Dispatcher</th>
                  <th className="px-4 py-3 text-left">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk">
                {paginated.length === 0 ? (
                  <tr><td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate">
                      <span className="material-symbols-outlined text-[48px] opacity-30">history</span>
                      <div className="font-bold text-carbon text-sm">Không tìm thấy kết quả nào</div>
                      <p className="text-xs">Thử thay đổi bộ lọc ngày hoặc từ khoá.</p>
                    </div>
                  </td></tr>
                ) : paginated.map(d => (
                  <tr key={d.id}
                    onClick={() => setDrawerItem(d)}
                    className={`hover:bg-orange-50/50 cursor-pointer transition-colors ${drawerItem?.id === d.id ? 'bg-orange-50 border-l-2 border-signal-orange' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-carbon">{d.time}</div>
                      <div className="text-[10px] text-slate font-mono">{d.date}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-carbon">{d.vehicle}</div>
                      <div className="text-[10px] text-slate">{d.vehiclePlate}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-carbon">{d.driver}</div>
                      <div className="text-[10px] text-slate font-mono">{d.driverId}</div>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-graphite">{d.container}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${TASK_TYPE_CFG[d.taskType]?.color}`}>
                        {d.taskLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-graphite max-w-[140px]">
                      <div className="truncate text-[11px]">{d.destination}</div>
                    </td>
                    <td className="px-4 py-3.5 text-slate text-[11px]">{d.dispatcher}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-chalk flex items-center justify-between bg-fog text-xs">
              <span className="text-slate">Trang {currentPage}/{totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1}
                  className="px-3 py-1.5 bg-white border border-chalk rounded-lg font-semibold disabled:opacity-40">‹ Trước</button>
                {Array.from({ length: totalPages }, (_, i) => i+1).map(pg => (
                  <button key={pg} onClick={() => setCurrentPage(pg)}
                    className={`w-8 h-8 rounded-lg font-bold border transition-all ${pg===currentPage ? 'bg-signal-orange text-white border-signal-orange' : 'bg-white border-chalk hover:border-slate'}`}>{pg}</button>
                ))}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages}
                  className="px-3 py-1.5 bg-white border border-chalk rounded-lg font-semibold disabled:opacity-40">Sau ›</button>
              </div>
            </div>
          )}
        </div>

        {/* ── PERFORMANCE SUMMARY PANEL (Right) ── */}
        <div className="w-[240px] flex-shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-chalk shadow-sm p-4 space-y-4">
            <div className="text-[10px] font-bold text-slate uppercase tracking-wider">Hiệu Suất Điều Phối</div>
            {[
              { label: 'Thời gian TB/Lệnh', value: perf.avgDispatch, icon: 'timer', color: 'text-blue-600' },
              { label: 'Thời gian chờ TB',  value: perf.avgWait,     icon: 'hourglass_empty', color: 'text-amber-600' },
              { label: 'Tỉ lệ hoàn thành',  value: perf.completionRate, icon: 'trending_up', color: 'text-green-600' },
              { label: 'Lệnh trễ hôm nay',  value: perf.delayed + ' lệnh', icon: 'warning', color: 'text-red-500' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-[18px] ${item.color}`}>{item.icon}</span>
                  <span className="text-[11px] text-graphite">{item.label}</span>
                </div>
                <span className={`font-extrabold text-sm ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Quick Status Breakdown */}
          <div className="bg-white rounded-xl border border-chalk shadow-sm p-4 space-y-3">
            <div className="text-[10px] font-bold text-slate uppercase tracking-wider">Phân Bổ Trạng Thái</div>
            {Object.entries(STATUS_CFG).map(([status, cfg]) => {
              const count = MOCK_DISPATCHES.filter(d => d.status === status).length
              const pct = Math.round((count / MOCK_DISPATCHES.length) * 100)
              return (
                <div key={status} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-graphite">{cfg.label}</span>
                    <span className="font-bold text-carbon">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-fog rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${cfg.dot}`} style={{ width: pct + '%' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ═══ DISPATCH DETAIL DRAWER ═══ */}
      {drawerItem && (
        <>
          <div className="fixed inset-0 bg-carbon/30 z-40 backdrop-blur-sm" onClick={() => setDrawerItem(null)} />
          <div className="fixed right-0 top-0 h-full w-[440px] bg-white z-50 shadow-2xl border-l border-chalk overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-chalk bg-fog flex-shrink-0">
              <div>
                <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">Chi Tiết Lệnh Điều Phối</span>
                <h3 className="font-heading text-base font-extrabold text-carbon font-mono">{drawerItem.id}</h3>
              </div>
              <button onClick={() => setDrawerItem(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-mist text-slate hover:text-carbon">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Status + Task type */}
              <div className="flex gap-2 flex-wrap">
                <StatusBadge status={drawerItem.status} />
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${TASK_TYPE_CFG[drawerItem.taskType]?.color}`}>
                  {drawerItem.taskLabel}
                </span>
              </div>

              {/* Core Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  ['Phương Tiện',    drawerItem.vehicle + ' · ' + drawerItem.vehiclePlate],
                  ['Tài Xế',         drawerItem.driver + ' (' + drawerItem.driverId + ')'],
                  ['Container',      drawerItem.container],
                  ['Gate Booking',   drawerItem.gateBooking],
                  ['Dispatcher',     drawerItem.dispatcher],
                  ['Điểm xuất phát', drawerItem.origin],
                  ['Điểm đến',       drawerItem.destination],
                  ['Tổng thời gian', drawerItem.duration],
                ].map(([label, value]) => (
                  <div key={label} className="bg-fog rounded-lg p-3 border border-chalk">
                    <div className="text-[10px] font-bold text-slate uppercase mb-0.5">{label}</div>
                    <div className="font-bold text-carbon text-[11px]">{value}</div>
                  </div>
                ))}
              </div>

              {/* Time breakdown */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs space-y-2">
                <div className="text-[10px] font-bold text-blue-900 uppercase tracking-wider mb-1">Mốc Thời Gian</div>
                {[
                  ['Tạo lệnh',        drawerItem.dispatchTime],
                  ['Xe khởi hành',    drawerItem.startTime],
                  ['Xe đến điểm',     drawerItem.arrivalTime],
                  ['Hoàn thành',      drawerItem.completionTime],
                  ['Thời gian chờ',   drawerItem.waitTime],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-slate">{label}</span>
                    <span className="font-bold text-carbon font-mono">{value}</span>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <div>
                <div className="text-[10px] font-bold text-slate uppercase tracking-wider mb-3">Dòng Thời Gian Sự Kiện</div>
                <div className="relative space-y-0">
                  {drawerItem.timeline.map((evt, idx) => (
                    <div key={idx} className="flex gap-4 relative">
                      {/* Vertical line */}
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 border-2 border-white shadow ${
                          idx === 0 ? 'bg-signal-orange' :
                          idx === drawerItem.timeline.length - 1 ? 'bg-green-500' : 'bg-slate-400'
                        }`} />
                        {idx < drawerItem.timeline.length - 1 && <div className="w-px flex-1 bg-chalk my-1 min-h-[24px]" />}
                      </div>
                      <div className="pb-4 flex-1">
                        <div className="text-[10px] font-bold font-mono text-slate">{evt.time}</div>
                        <div className="text-xs text-carbon">{evt.event}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Read-only notice */}
              <div className="bg-fog border border-chalk rounded-lg px-3 py-2 text-[11px] text-slate text-center">
                🔒 Dữ liệu lịch sử điều phối chỉ đọc — không thể chỉnh sửa.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
