import React, { useState, useMemo } from 'react'

// ─── MOCK DATA ─────────────────────────────────────────────────────────────────
const MOCK_DRIVERS = [
  {
    id: 'DRV-001', name: 'Nguyễn Văn A', phone: '0901-234-567',
    licenseNumber: 'FC-123456', licenseType: 'FC', status: 'AVAILABLE',
    currentVehicle: null, currentVehiclePlate: null, currentVehicleType: null,
    currentTask: null, currentContainer: null, currentOrigin: null, currentDestination: null,
    currentTaskStatus: null, eta: null, lastActivity: '2 phút trước', experience: '8 năm',
    todayTasks: 8, todayWorkingTime: '6g 20p', todayDistance: '82 km', todayContainers: 8, todayDelays: 1,
    recentTasks: [
      { id: 'DSP-20260811-001', type: 'Lấy Container', container: 'MSCU1234567', origin: 'Cảng Tiên Sa', destination: 'Kho Lạnh', status: 'COMPLETED', time: '09:12' },
      { id: 'DSP-20260810-008', type: 'Giao Container', container: 'MSCU7654321', origin: 'Kho Hòa Cầm', destination: 'Cảng Tiên Sa', status: 'COMPLETED', time: '07:40' },
    ]
  },
  {
    id: 'DRV-002', name: 'Trần Văn B', phone: '0912-345-678',
    licenseNumber: 'FC-456789', licenseType: 'FC', status: 'ON_TRIP',
    currentVehicle: 'TRK-003', currentVehiclePlate: '43A-567.90', currentVehicleType: 'ROAD_TRUCK',
    currentTask: 'DSP-20260811-004', currentContainer: 'EVER991203',
    currentOrigin: 'Kho Hòa Cầm', currentDestination: 'Cảng Tiên Sa',
    currentTaskStatus: 'IN_TRANSIT', eta: '32 phút', lastActivity: '30 giây trước', experience: '5 năm',
    todayTasks: 5, todayWorkingTime: '5g 10p', todayDistance: '61 km', todayContainers: 5, todayDelays: 0,
    recentTasks: [
      { id: 'DSP-20260811-004', type: 'Giao Container', container: 'EVER991203', origin: 'Kho Hòa Cầm', destination: 'Cảng Tiên Sa', status: 'IN_TRANSIT', time: '10:45' },
      { id: 'DSP-20260810-015', type: 'Lấy Container', container: 'MSCU3344556', origin: 'Cảng Tiên Sa', destination: 'Kho An Đồn', status: 'COMPLETED', time: '08:20' },
    ]
  },
  {
    id: 'DRV-003', name: 'Lê Văn C', phone: '0987-654-321',
    licenseNumber: 'FE-889910', licenseType: 'FE', status: 'AVAILABLE',
    currentVehicle: null, currentVehiclePlate: null, currentVehicleType: null,
    currentTask: null, currentContainer: null, currentOrigin: null, currentDestination: null,
    currentTaskStatus: null, eta: null, lastActivity: '10 phút trước', experience: '6 năm',
    todayTasks: 4, todayWorkingTime: '4g 30p', todayDistance: '55 km', todayContainers: 4, todayDelays: 0,
    recentTasks: [
      { id: 'DSP-20260810-022', type: 'Lấy Container Lạnh', container: 'MSCU5566778', origin: 'Cảng Tiên Sa', destination: 'Kho Lạnh Hòa Cầm', status: 'COMPLETED', time: '11:30' },
    ]
  },
  {
    id: 'DRV-004', name: 'Phạm Văn D', phone: '0903-111-222',
    licenseNumber: 'FC-223344', licenseType: 'FC', status: 'ASSIGNED',
    currentVehicle: 'TRK-008', currentVehiclePlate: '15C-882.19', currentVehicleType: 'ROAD_TRUCK',
    currentTask: 'DSP-20260811-007', currentContainer: 'MSCU4455667',
    currentOrigin: 'Cảng Tiên Sa', currentDestination: 'Depot Liên Chiểu',
    currentTaskStatus: 'ASSIGNED', eta: '—', lastActivity: '5 phút trước', experience: '6 năm',
    todayTasks: 6, todayWorkingTime: '5g 50p', todayDistance: '74 km', todayContainers: 6, todayDelays: 1,
    recentTasks: [
      { id: 'DSP-20260811-007', type: 'Lấy Container', container: 'MSCU4455667', origin: 'Cảng Tiên Sa', destination: 'Depot Liên Chiểu', status: 'ASSIGNED', time: '12:00' },
    ]
  },
  {
    id: 'DRV-005', name: 'Hoàng Văn E', phone: '0916-333-444',
    licenseNumber: 'FC-778899', licenseType: 'FC', status: 'OFF_DUTY',
    currentVehicle: null, currentVehiclePlate: null, currentVehicleType: null,
    currentTask: null, currentContainer: null, currentOrigin: null, currentDestination: null,
    currentTaskStatus: null, eta: null, lastActivity: '2 giờ trước', experience: '4 năm',
    todayTasks: 3, todayWorkingTime: '3g 00p', todayDistance: '36 km', todayContainers: 3, todayDelays: 0,
    recentTasks: [
      { id: 'DSP-20260810-030', type: 'Lấy Container', container: 'MSCU6677889', origin: 'Cảng Tiên Sa', destination: 'Kho Đà Nẵng', status: 'COMPLETED', time: '14:20' },
    ]
  },
  {
    id: 'DRV-006', name: 'Võ Thị F', phone: '0934-555-666',
    licenseNumber: 'YT-112233', licenseType: 'B2', status: 'ON_TRIP',
    currentVehicle: 'YTR-003', currentVehiclePlate: 'YT-003', currentVehicleType: 'YARD_TRACTOR',
    currentTask: 'DSP-20260811-003', currentContainer: 'MSCU7788990',
    currentOrigin: 'Khối bãi B', currentDestination: 'Khu vực cẩu RTG-02',
    currentTaskStatus: 'IN_TRANSIT', eta: '5 phút', lastActivity: '1 phút trước', experience: '3 năm',
    todayTasks: 11, todayWorkingTime: '7g 00p', todayDistance: '22 km', todayContainers: 11, todayDelays: 0,
    recentTasks: [
      { id: 'DSP-20260811-003', type: 'Di chuyển nội bãi', container: 'MSCU7788990', origin: 'Khối bãi B', destination: 'RTG-02', status: 'IN_TRANSIT', time: '11:55' },
    ]
  },
  {
    id: 'DRV-007', name: 'Đặng Văn G', phone: '0945-777-888',
    licenseNumber: 'FC-334455', licenseType: 'FC', status: 'SUSPENDED',
    currentVehicle: null, currentVehiclePlate: null, currentVehicleType: null,
    currentTask: null, currentContainer: null, currentOrigin: null, currentDestination: null,
    currentTaskStatus: null, eta: null, lastActivity: '1 ngày trước', experience: '2 năm',
    todayTasks: 0, todayWorkingTime: '0g 00p', todayDistance: '0 km', todayContainers: 0, todayDelays: 0,
    recentTasks: []
  },
]

// ─── STATUS CONFIG ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  AVAILABLE:  { label: 'Sẵn sàng',      dot: 'bg-green-500',  badge: 'bg-green-50 text-green-800 border-green-300',    icon: '🟢' },
  ASSIGNED:   { label: 'Đã giao lệnh',  dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-800 border-blue-300',      icon: '🔵' },
  ON_TRIP:    { label: 'Đang chạy',     dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-800 border-purple-300', icon: '🟣' },
  OFF_DUTY:   { label: 'Nghỉ ca',       dot: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-800 border-amber-300',    icon: '🟡' },
  SUSPENDED:  { label: 'Tạm đình chỉ', dot: 'bg-red-500',    badge: 'bg-red-50 text-red-800 border-red-300',          icon: '🔴' },
}

const TASK_STATUS_LABEL = { IN_TRANSIT: 'Đang di chuyển', ASSIGNED: 'Chờ thực hiện', COMPLETED: 'Hoàn thành' }
const VEHICLE_TYPE_LABELS = { ROAD_TRUCK: 'Xe Đầu Kéo Đường Dài', YARD_TRACTOR: 'Xe Đầu Kéo Nội Bãi' }
const LICENSE_TYPES = ['B2', 'C', 'D', 'E', 'FC', 'FD', 'FE']

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.AVAILABLE
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
      {cfg.label}
    </span>
  )
}

function AvatarCircle({ driver }) {
  const color = driver.status === 'SUSPENDED' ? 'bg-red-400' : driver.status === 'ON_TRIP' ? 'bg-purple-500'
    : driver.status === 'ASSIGNED' ? 'bg-blue-500' : driver.status === 'OFF_DUTY' ? 'bg-amber-400' : 'bg-green-500'
  const initials = driver.name.split(' ').pop().charAt(0) + driver.name.split(' ')[0].charAt(0)
  return <div className={`flex items-center justify-center text-white font-extrabold flex-shrink-0 ${color}`}>{initials}</div>
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function DispatcherDriverManagement() {
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState('ALL')
  const [vehicleFilter, setVehicleFilter] = useState('ALL')
  const [currentPage, setCurrentPage]     = useState(1)
  const [drawerDriver, setDrawerDriver]   = useState(null)
  const [showAddModal, setShowAddModal]   = useState(false)
  const [editMode, setEditMode]           = useState(false)
  const [toast, setToast]                 = useState('')
  const [drivers, setDrivers]             = useState(MOCK_DRIVERS)
  const [editForm, setEditForm]           = useState(null)
  const PAGE_SIZE = 5

  const nextId = `DRV-00${(drivers.length + 1).toString().padStart(1, '0')}`
  const [form, setForm] = useState({
    id: nextId, name: '', phone: '', licenseNumber: '', licenseType: 'FC', status: 'AVAILABLE', notes: '',
  })

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3200) }

  const kpi = useMemo(() => ({
    total:     drivers.length,
    available: drivers.filter(d => d.status === 'AVAILABLE').length,
    assigned:  drivers.filter(d => d.status === 'ASSIGNED').length,
    onTrip:    drivers.filter(d => d.status === 'ON_TRIP').length,
    offDuty:   drivers.filter(d => d.status === 'OFF_DUTY').length,
    suspended: drivers.filter(d => d.status === 'SUSPENDED').length,
  }), [drivers])

  const filtered = useMemo(() => {
    let list = [...drivers]
    const q = search.toLowerCase()
    if (q) list = list.filter(d =>
      d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q) ||
      d.licenseNumber.toLowerCase().includes(q) || d.phone.includes(q)
    )
    if (statusFilter !== 'ALL') list = list.filter(d => d.status === statusFilter)
    if (vehicleFilter === 'ASSIGNED')   list = list.filter(d => d.currentVehicle)
    if (vehicleFilter === 'NO_VEHICLE') list = list.filter(d => !d.currentVehicle)
    return list
  }, [drivers, search, statusFilter, vehicleFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const openAddModal = () => {
    const newId = `DRV-${String(drivers.length + 1).padStart(3, '0')}`
    setForm({
      id: newId,
      name: '',
      phone: '',
      licenseNumber: '',
      licenseType: 'FC',
      status: 'AVAILABLE',
      notes: ''
    })
    setShowAddModal(true)
  }

  const handleAddDriver = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim() || !form.licenseNumber.trim()) {
      showToast('⚠️ Vui lòng nhập đầy đủ các thông tin bắt buộc (*)!')
      return
    }
    const newDriverObj = {
      ...form,
      lastActivity: 'Vừa tạo',
      currentVehicle: null,
      currentVehiclePlate: null,
      currentVehicleType: null,
      currentTask: null,
      currentContainer: null,
      currentOrigin: null,
      currentDestination: null,
      currentTaskStatus: null,
      eta: null,
      experience: 'Chưa cập nhật',
      todayTasks: 0,
      todayWorkingTime: '0g 00p',
      todayDistance: '0 km',
      todayContainers: 0,
      todayDelays: 0,
      recentTasks: [],
    }
    setDrivers(prev => [newDriverObj, ...prev])
    setShowAddModal(false)
    showToast(`✅ Đã tạo thành công hồ sơ tài xế ${form.name} (${form.id})!`)
  }

  const handleSaveEdit = (e) => {
    e.preventDefault()
    setDrivers(prev => prev.map(d => d.id === editForm.id ? { ...d, ...editForm } : d))
    setDrawerDriver(prev => ({ ...prev, ...editForm }))
    setEditMode(false)
    showToast(`✅ Đã cập nhật hồ sơ tài xế ${editForm.name}!`)
  }

  const openDrawer = (drv) => { setDrawerDriver(drv); setEditMode(false); setEditForm({ ...drv }) }

  const KPI_CARDS = [
    { label: 'Tổng Tài Xế',   value: kpi.total,     border: 'border-slate-300',  icon: 'group',          text: 'text-carbon' },
    { label: 'Sẵn Sàng',      value: kpi.available,  border: 'border-green-400',  icon: 'check_circle',   text: 'text-green-700' },
    { label: 'Đã Giao Lệnh',  value: kpi.assigned,   border: 'border-blue-400',   icon: 'assignment_ind', text: 'text-blue-700' },
    { label: 'Đang Chạy',     value: kpi.onTrip,     border: 'border-purple-400', icon: 'directions_car', text: 'text-purple-700' },
    { label: 'Nghỉ Ca',       value: kpi.offDuty,    border: 'border-amber-400',  icon: 'bedtime',        text: 'text-amber-700' },
    { label: 'Tạm Đình Chỉ', value: kpi.suspended,  border: 'border-red-400',    icon: 'block',          text: 'text-red-700' },
  ]

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
          <h2 className="font-heading text-3xl text-carbon font-extrabold mt-0.5">Quản Lý Tài Xế</h2>
          <p className="text-xs text-slate mt-0.5">Theo dõi và quản lý đội tài xế phục vụ vận chuyển container. Quan hệ xe–tài xế được xác định qua Lệnh Điều Phối.</p>
        </div>
        <button onClick={openAddModal}
          className="h-11 px-5 bg-signal-orange text-white rounded-xl font-extrabold text-xs hover:opacity-95 transition-opacity shadow-lg flex items-center gap-2 flex-shrink-0">
          <span className="material-symbols-outlined text-lg">person_add</span>+ Thêm Tài Xế Mới
        </button>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {KPI_CARDS.map(k => (
          <div key={k.label} className={`bg-white rounded-xl p-4 border-l-4 ${k.border} border border-chalk shadow-sm flex flex-col gap-1`}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate uppercase tracking-wider leading-tight">{k.label}</span>
              <span className={`material-symbols-outlined text-[18px] ${k.text} opacity-60`}>{k.icon}</span>
            </div>
            <span className={`text-3xl font-extrabold font-heading ${k.text}`}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* ── SEARCH & FILTERS ── */}
      <div className="bg-white rounded-xl border border-chalk shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate text-[18px]">search</span>
          <input type="text" value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
            placeholder="Tìm theo tên, mã TX, GPLX, số điện thoại..."
            className="w-full pl-9 pr-4 h-9 border border-chalk rounded-lg text-xs text-carbon placeholder-slate focus:outline-none focus:border-signal-orange bg-fog"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {[['ALL','Tất cả'],['AVAILABLE','🟢 Sẵn sàng'],['ASSIGNED','🔵 Đã giao'],['ON_TRIP','🟣 Đang chạy'],['OFF_DUTY','🟡 Nghỉ ca'],['SUSPENDED','🔴 Đình chỉ']].map(([val, lbl]) => (
            <button key={val} onClick={() => { setStatusFilter(val); setCurrentPage(1) }}
              className={`px-3 h-8 rounded-lg text-[11px] font-semibold border transition-all ${statusFilter === val ? 'bg-signal-orange text-white border-signal-orange' : 'bg-fog text-graphite border-chalk hover:border-slate'}`}>
              {lbl}
            </button>
          ))}
        </div>
        <select value={vehicleFilter} onChange={e => { setVehicleFilter(e.target.value); setCurrentPage(1) }}
          className="h-9 px-3 border border-chalk rounded-lg text-xs text-carbon bg-fog focus:outline-none focus:border-signal-orange">
          <option value="ALL">Tất cả xe</option>
          <option value="ASSIGNED">Đang có xe</option>
          <option value="NO_VEHICLE">Chưa có xe</option>
        </select>
        <span className="text-[11px] text-slate ml-auto">{filtered.length} tài xế</span>
      </div>

      {/* ── DRIVER TABLE ── */}
      <div className="bg-white rounded-xl border border-chalk shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-fog border-b border-chalk text-[10px] uppercase text-slate font-bold tracking-wider">
                <th className="px-5 py-3 text-left">Tài Xế</th>
                <th className="px-4 py-3 text-left">Mã TX</th>
                <th className="px-4 py-3 text-left">GPLX</th>
                <th className="px-4 py-3 text-left">Điện Thoại</th>
                <th className="px-4 py-3 text-left">Xe Hiện Tại</th>
                <th className="px-4 py-3 text-left">Nhiệm Vụ</th>
                <th className="px-4 py-3 text-left">Trạng Thái</th>
                <th className="px-4 py-3 text-left">Cập Nhật</th>
                <th className="px-4 py-3 text-left">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk">
              {paginated.length === 0 ? (
                <tr><td colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-slate">
                    <span className="material-symbols-outlined text-[48px] opacity-30">manage_accounts</span>
                    <div className="font-bold text-carbon text-sm">Không tìm thấy tài xế nào</div>
                    <p className="text-xs">Thử thay đổi bộ lọc hoặc từ khoá tìm kiếm.</p>
                    <button onClick={() => { setSearch(''); setStatusFilter('ALL'); setVehicleFilter('ALL') }}
                      className="px-4 py-2 bg-fog border border-chalk rounded-lg text-xs font-semibold hover:bg-mist">Xóa bộ lọc</button>
                  </div>
                </td></tr>
              ) : paginated.map(drv => (
                <tr key={drv.id} className="hover:bg-fog/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full text-[11px]"><AvatarCircle driver={drv} /></div>
                      <div>
                        <div className="font-bold text-carbon">{drv.name}</div>
                        <div className="text-[10px] text-slate">{drv.experience} kinh nghiệm</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-mono font-bold text-graphite">{drv.id}</td>
                  <td className="px-4 py-3.5 font-mono text-carbon">{drv.licenseNumber}</td>
                  <td className="px-4 py-3.5 text-graphite">{drv.phone}</td>
                  <td className="px-4 py-3.5">
                    {drv.currentVehicle
                      ? <div><div className="font-bold text-carbon">{drv.currentVehicle}</div><div className="text-[10px] text-slate">{drv.currentVehiclePlate}</div></div>
                      : <span className="text-slate">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    {drv.currentTask
                      ? <span className="font-mono text-[11px] bg-orange-50 text-signal-orange border border-orange-200 px-2 py-0.5 rounded font-bold">{drv.currentTask}</span>
                      : <span className="text-slate">—</span>}
                  </td>
                  <td className="px-4 py-3.5"><StatusBadge status={drv.status} /></td>
                  <td className="px-4 py-3.5 text-slate text-[11px]">{drv.lastActivity}</td>
                  <td className="px-4 py-3.5">
                    <button onClick={() => openDrawer(drv)}
                      className="px-3 py-1.5 bg-fog border border-chalk rounded-lg text-[11px] font-semibold text-graphite hover:border-signal-orange hover:text-signal-orange transition-all">
                      Xem
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-chalk flex items-center justify-between bg-fog text-xs">
            <span className="text-slate">Trang {currentPage}/{totalPages} ({filtered.length} tài xế)</span>
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

      {/* ═══ DRIVER DETAIL DRAWER ═══ */}
      {drawerDriver && (
        <>
          <div className="fixed inset-0 bg-carbon/30 z-40 backdrop-blur-sm" onClick={() => setDrawerDriver(null)} />
          <div className="fixed right-0 top-0 h-full w-[420px] bg-white z-50 shadow-2xl border-l border-chalk overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-chalk bg-fog flex-shrink-0">
              <div>
                <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">Hồ Sơ Tài Xế</span>
                <h3 className="font-heading text-lg font-extrabold text-carbon">{drawerDriver.name}</h3>
              </div>
              <div className="flex gap-2">
                {!editMode && (
                  <button onClick={() => setEditMode(true)}
                    className="px-3 py-1.5 bg-white border border-chalk rounded-lg text-xs font-semibold text-graphite hover:border-signal-orange hover:text-signal-orange transition-all">
                    ✏ Chỉnh sửa
                  </button>
                )}
                <button onClick={() => setDrawerDriver(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-mist text-slate hover:text-carbon">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {editMode ? (
                <form onSubmit={handleSaveEdit} className="space-y-4">
                  {[['Họ và Tên','name'],['Số điện thoại','phone'],['Số GPLX','licenseNumber']].map(([label, field]) => (
                    <div key={field}>
                      <label className="block text-[10px] font-bold text-slate uppercase mb-1">{label}</label>
                      <input type="text" value={editForm[field]} onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                        className="w-full px-3 h-9 border border-chalk rounded-lg text-xs text-carbon focus:outline-none focus:border-signal-orange bg-fog" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Loại GPLX</label>
                    <select value={editForm.licenseType} onChange={e => setEditForm(f => ({ ...f, licenseType: e.target.value }))}
                      className="w-full px-3 h-9 border border-chalk rounded-lg text-xs text-carbon focus:outline-none focus:border-signal-orange bg-fog">
                      {LICENSE_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Trạng Thái</label>
                    <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 h-9 border border-chalk rounded-lg text-xs text-carbon focus:outline-none focus:border-signal-orange bg-fog">
                      {Object.entries(STATUS_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.icon} {cfg.label}</option>)}
                    </select>
                  </div>
                  <textarea value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                    placeholder="Ghi chú..." className="w-full px-3 py-2 border border-chalk rounded-lg text-xs focus:outline-none focus:border-signal-orange bg-fog resize-none" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditMode(false)}
                      className="flex-1 h-9 border border-chalk rounded-lg text-xs font-semibold text-graphite hover:bg-fog">Hủy</button>
                    <button type="submit"
                      className="flex-1 h-9 bg-signal-orange text-white rounded-lg text-xs font-extrabold hover:opacity-90 shadow">Lưu Thay Đổi</button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Profile */}
                  <section className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl text-xl"><AvatarCircle driver={drawerDriver} /></div>
                      <div>
                        <div className="font-extrabold text-carbon text-base">{drawerDriver.name}</div>
                        <div className="text-xs text-slate font-mono">{drawerDriver.id}</div>
                        <div className="mt-1"><StatusBadge status={drawerDriver.status} /></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {[['Số GPLX', drawerDriver.licenseNumber], ['Loại GPLX', drawerDriver.licenseType], ['Điện Thoại', drawerDriver.phone], ['Kinh Nghiệm', drawerDriver.experience]].map(([l, v]) => (
                        <div key={l} className="bg-fog rounded-lg p-3 border border-chalk">
                          <div className="text-[10px] font-bold text-slate uppercase mb-0.5">{l}</div>
                          <div className="font-bold text-carbon">{v}</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Current Assignment */}
                  <section>
                    <div className="text-[10px] font-bold text-slate uppercase tracking-wider mb-2">Nhiệm Vụ Hiện Tại</div>
                    {drawerDriver.currentTask ? (
                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2 text-xs">
                        <div className="flex justify-between items-center border-b border-orange-200 pb-2 mb-2">
                          <span className="font-mono font-extrabold text-signal-orange">{drawerDriver.currentTask}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                            {TASK_STATUS_LABEL[drawerDriver.currentTaskStatus] || drawerDriver.currentTaskStatus}
                          </span>
                        </div>
                        {[
                          ['Phương tiện', drawerDriver.currentVehicle + ' · ' + drawerDriver.currentVehiclePlate],
                          ['Loại xe', VEHICLE_TYPE_LABELS[drawerDriver.currentVehicleType] || drawerDriver.currentVehicleType],
                          ['Container', drawerDriver.currentContainer],
                          ['Xuất phát', drawerDriver.currentOrigin],
                          ['Điểm đến', drawerDriver.currentDestination],
                          ['ETA dự kiến', drawerDriver.eta],
                        ].map(([l, v]) => (
                          <div key={l} className="flex justify-between">
                            <span className="text-slate">{l}:</span>
                            <span className="font-bold text-carbon">{v}</span>
                          </div>
                        ))}
                        <p className="text-[10px] text-slate italic pt-1 border-t border-orange-200">Phân công qua lệnh điều phối · Không gắn cố định theo xe</p>
                      </div>
                    ) : (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center space-y-1">
                        <span className="material-symbols-outlined text-green-500 text-[32px]">check_circle</span>
                        <div className="text-sm font-bold text-green-800">Không có nhiệm vụ đang thực hiện</div>
                        <div className="text-xs text-green-700">🟢 Tài xế sẵn sàng nhận lệnh mới</div>
                      </div>
                    )}
                  </section>

                  {/* Today's Activity */}
                  <section>
                    <div className="text-[10px] font-bold text-slate uppercase tracking-wider mb-2">Hoạt Động Hôm Nay</div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {[
                        ['Nhiệm vụ', drawerDriver.todayTasks, 'task_alt', 'text-blue-600'],
                        ['Giờ làm', drawerDriver.todayWorkingTime, 'schedule', 'text-purple-600'],
                        ['Quãng đường', drawerDriver.todayDistance, 'route', 'text-green-600'],
                        ['Container', drawerDriver.todayContainers, 'inventory_2', 'text-signal-orange'],
                        ['Trễ hạn', drawerDriver.todayDelays, 'warning', 'text-red-500'],
                      ].map(([l, v, icon, color]) => (
                        <div key={l} className="bg-fog border border-chalk rounded-xl p-3 text-center">
                          <span className={`material-symbols-outlined text-[20px] ${color}`}>{icon}</span>
                          <div className={`font-extrabold text-base ${color}`}>{v}</div>
                          <div className="text-[10px] text-slate leading-tight">{l}</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Recent Tasks */}
                  <section>
                    <div className="text-[10px] font-bold text-slate uppercase tracking-wider mb-2">Nhiệm Vụ Gần Đây</div>
                    {drawerDriver.recentTasks.length === 0
                      ? <div className="text-xs text-slate text-center py-4 bg-fog rounded-xl border border-chalk">Chưa có nhiệm vụ nào.</div>
                      : drawerDriver.recentTasks.map(task => (
                        <div key={task.id} className="bg-fog border border-chalk rounded-xl p-3 text-xs space-y-1 mb-2">
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-extrabold text-signal-orange">{task.id}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${task.status==='COMPLETED' ? 'bg-green-100 text-green-800' : task.status==='IN_TRANSIT' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                              {TASK_STATUS_LABEL[task.status] || task.status}
                            </span>
                          </div>
                          <div className="font-semibold text-carbon">{task.type} · {task.container}</div>
                          <div className="text-slate">{task.origin} → {task.destination}</div>
                          <div className="text-[10px] text-slate">{task.time}</div>
                        </div>
                      ))
                    }
                  </section>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══ ADD DRIVER MODAL ═══ */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 bg-carbon/40 z-50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-chalk w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-chalk">
                <div>
                  <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">Dispatcher · Thêm Nhân Sự</span>
                  <h3 className="font-heading text-lg font-extrabold text-carbon">Tạo Hồ Sơ Tài Xế</h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-fog text-slate hover:text-carbon">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <form onSubmit={handleAddDriver} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate uppercase mb-1">Mã Tài Xế (Tự sinh)</label>
                  <input readOnly value={form.id} className="w-full px-3 h-9 border border-chalk rounded-lg text-xs font-mono font-bold bg-fog opacity-70 cursor-not-allowed text-carbon" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Họ và Tên <span className="text-red-500">*</span></label>
                    <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Nguyễn Văn X"
                      className="w-full px-3 h-9 border border-chalk rounded-lg text-xs focus:outline-none focus:border-signal-orange bg-fog text-carbon placeholder-slate" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Điện Thoại <span className="text-red-500">*</span></label>
                    <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required placeholder="090xxxxxxx"
                      className="w-full px-3 h-9 border border-chalk rounded-lg text-xs focus:outline-none focus:border-signal-orange bg-fog text-carbon placeholder-slate" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Số GPLX <span className="text-red-500">*</span></label>
                    <input type="text" value={form.licenseNumber} onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))} required placeholder="FC-xxxxx"
                      className="w-full px-3 h-9 border border-chalk rounded-lg text-xs focus:outline-none focus:border-signal-orange bg-fog text-carbon placeholder-slate" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Loại Bằng Lái</label>
                    <select value={form.licenseType} onChange={e => setForm(f => ({ ...f, licenseType: e.target.value }))}
                      className="w-full px-3 h-9 border border-chalk rounded-lg text-xs focus:outline-none focus:border-signal-orange bg-fog text-carbon">
                      {LICENSE_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Trạng Thái</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 h-9 border border-chalk rounded-lg text-xs focus:outline-none focus:border-signal-orange bg-fog text-carbon">
                      {Object.entries(STATUS_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.icon} {cfg.label}</option>)}
                    </select>
                  </div>
                </div>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Ghi chú thêm..."
                  className="w-full px-3 py-2 border border-chalk rounded-lg text-xs focus:outline-none focus:border-signal-orange bg-fog resize-none text-carbon placeholder-slate" />
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-[11px] text-blue-800">
                  <strong>Lưu ý:</strong> Tài xế không gán cố định vào xe. Phân công qua <em>Lệnh Điều Phối (/dispatch)</em>.
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowAddModal(false)}
                    className="flex-1 h-10 border border-chalk rounded-xl text-xs font-semibold text-graphite hover:bg-fog">Hủy</button>
                  <button type="submit"
                    className="flex-1 h-10 bg-signal-orange text-white rounded-xl text-xs font-extrabold hover:opacity-90 shadow-md">Tạo Tài Xế</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
