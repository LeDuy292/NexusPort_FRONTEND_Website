import React, { useState, useEffect } from 'react'
import yardTaskService from '../../services/yardTaskService'
import AssignEquipmentModal from '../../components/Yard/AssignEquipmentModal'
import YardReceivingModal from '../../components/Yard/YardReceivingModal'
import CompleteLiftModal from '../../components/Yard/CompleteLiftModal'

export default function YardOperationsDashboard() {
  const [toastMessage, setToastMessage] = useState('')
  const [todayDate] = useState(
    new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  )
  const [activeShift] = useState('Ca 1 (06:00 – 14:00)')
  const [selectedBlockFilter, setSelectedBlockFilter] = useState('ALL')
  const [taskStatusTab, setTaskStatusTab] = useState('ALL') // 'ALL' | 'Assigned' | 'Ready' | 'In_Progress' | 'Completed'
  const [searchQuery, setSearchQuery] = useState('')
  
  // Modals state
  const [selectedTaskToAssign, setSelectedTaskToAssign] = useState(null)
  const [receivingModalOpen, setReceivingModalOpen] = useState(false)
  const [selectedTaskToReceive, setSelectedTaskToReceive] = useState(null)
  const [completeLiftModalOpen, setCompleteLiftModalOpen] = useState(false)
  const [selectedTaskToCompleteLift, setSelectedTaskToCompleteLift] = useState(null)
  
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [operatingTaskId, setOperatingTaskId] = useState(null)

  const DEFAULT_INCOMING = [
    {
      id: 'TEMU4451920',
      vessel: 'MSC GULSUN',
      berth: 'B-02',
      type: '40FT HC',
      weight: '28,400 KG',
      seal: 'SEAL-VN-889922',
      status: 'IN TRANSIT',
      statusBadge: 'Đang tới bãi',
      suggestedPosition: 'A01-04-02-1',
      blockCode: 'A01',
      taskCode: 'TSK-0801'
    },
    {
      id: 'CMAU3381920',
      vessel: 'EVER GIVEN',
      berth: 'B-01',
      type: '20FT ST',
      weight: '14,200 KG',
      seal: 'SEAL-VN-998811',
      status: 'UNLOADED',
      statusBadge: 'Đã dỡ cầu cảng',
      suggestedPosition: 'B02-02-05-2',
      blockCode: 'B02',
      taskCode: 'TSK-0802'
    },
    {
      id: 'ONEU8821903',
      vessel: 'ONE APUS',
      berth: 'B-01',
      type: '40FT RF',
      weight: '31,500 KG',
      seal: 'SEAL-TH-445566',
      status: 'IN TRANSIT',
      statusBadge: 'Cont lạnh khẩn',
      suggestedPosition: 'C01-02-04-2',
      blockCode: 'C01',
      taskCode: 'TSK-0806'
    },
    {
      id: 'HLCU7719204',
      vessel: 'HAPAG LLOYD',
      berth: 'CỔNG IN-GATE',
      type: '20FT TK',
      weight: '19,800 KG',
      seal: 'SEAL-DE-112288',
      status: 'IN TRANSIT',
      statusBadge: 'Hàng bồn hóa chất',
      suggestedPosition: 'B02-04-01-1',
      blockCode: 'B02',
      taskCode: 'TSK-0807'
    },
    {
      id: 'MAEU5519205',
      vessel: 'MAERSK MC-KINNEY',
      berth: 'B-03',
      type: '40FT HC',
      weight: '25,200 KG',
      seal: 'SEAL-DK-990033',
      status: 'UNLOADED',
      statusBadge: 'Đã qua cổng',
      suggestedPosition: 'A01-05-02-3',
      blockCode: 'A01',
      taskCode: 'TSK-0808'
    }
  ]

  // Incoming Containers List (Được đồng bộ tự động theo Database)
  const [incomingContainers, setIncomingContainers] = useState(DEFAULT_INCOMING)

  // AI Positioning Recommendations
  const [positioningTasks, setPositioningTasks] = useState([
    {
      id: 'COSU8819201',
      type: '40FT HC',
      weight: '26,800 KG',
      cargoType: 'Xuất Khẩu Khô',
      departure: '22:00 Hôm nay',
      aiSuggestedPos: 'A01-03-12-2',
      blockCode: 'A01',
      reasoning: 'Gần cẩu bờ QC-01 & cân bằng trọng tải tầng 2.',
    },
    {
      id: 'EVER1129983',
      type: '20FT ST',
      weight: '12,500 KG',
      cargoType: 'Hàng Nguy Hiểm (Class 3)',
      departure: '04:00 Ngày mai',
      aiSuggestedPos: 'B02-DG-01-1',
      blockCode: 'B02',
      reasoning: 'Bãi cách ly an toàn hóa chất có cảm biến nhiệt.',
    },
  ])

  // Yard Tasks List
  const [yardTasks, setYardTasks] = useState([])

  // Load live tasks from API & Sync with Database
  const loadLiveTasks = async () => {
    try {
      setLoadingTasks(true)
      const data = await yardTaskService.getTasks()
      if (Array.isArray(data)) {
        setYardTasks(data)

        // Lọc bỏ bất kỳ Container nào đã được tiếp nhận trong Database (receivedAt != null)
        const receivedContSet = new Set(
          data.filter(t => !!t.receivedAt).map(t => t.containerNo?.toUpperCase())
        )

        // Lấy danh sách nhiệm vụ đang chờ tiếp nhận thực tế từ DB
        const pendingFromDb = data
          .filter(t => !t.receivedAt && t.status?.toLowerCase() === 'assigned')
          .map(t => ({
            id: t.containerNo,
            vessel: t.fromLocation || 'Cầu Tàu B-01',
            berth: 'B-01',
            type: t.containerType || '40FT HC',
            weight: '24,000 KG',
            seal: t.expectedSealNo || 'SEAL-889922',
            status: 'IN TRANSIT',
            statusBadge: 'Chờ tiếp nhận',
            suggestedPosition: t.toLocation || 'A01-05-02-3',
            blockCode: t.blockCode || 'A01',
            taskCode: t.taskCode
          }))

        // Kết hợp và loại trừ những container đã hoàn tất tiếp nhận trong DB
        const combined = [
          ...pendingFromDb,
          ...DEFAULT_INCOMING.filter(c => !receivedContSet.has(c.id?.toUpperCase()) && !pendingFromDb.some(p => p.id?.toUpperCase() === c.id?.toUpperCase()))
        ]

        setIncomingContainers(combined)
      }
    } catch (err) {
      console.warn('Error loading live tasks:', err)
    } finally {
      setLoadingTasks(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadLiveTasks()
  }, [])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4000)
  }

  // Dynamic KPI counts
  const totalInYard = 4820
  const maxCapacity = 6500
  const capacityPercent = Math.round((totalInYard / maxCapacity) * 100)
  const uninspectedCount = yardTasks.filter(t => !t.receivedAt).length
  const assignedCount = yardTasks.filter(t => t.status?.toLowerCase() === 'assigned').length
  const readyCount = yardTasks.filter(t => t.status?.toLowerCase() === 'ready').length
  const inProgressCount = yardTasks.filter(t => t.status?.toLowerCase() === 'in_progress').length
  const completedCount = yardTasks.filter(t => t.status?.toLowerCase() === 'completed').length

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Filtered tasks logic
  const filteredTasks = yardTasks.filter(task => {
    if (selectedBlockFilter !== 'ALL' && task.blockCode?.toUpperCase() !== selectedBlockFilter) {
      return false
    }
    if (taskStatusTab !== 'ALL' && task.status?.toLowerCase() !== taskStatusTab.toLowerCase()) {
      return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchCode = task.taskCode?.toLowerCase().includes(q)
      const matchCont = task.containerNo?.toLowerCase().includes(q)
      const matchPlate = task.vehiclePlate?.toLowerCase().includes(q)
      const matchDriver = task.driverName?.toLowerCase().includes(q)
      if (!matchCode && !matchCont && !matchPlate && !matchDriver) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize))
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Reset to page 1 on filter changes
  const handleBlockFilterChange = (val) => {
    setSelectedBlockFilter(val)
    setCurrentPage(1)
  }

  const handleStatusTabChange = (val) => {
    setTaskStatusTab(val)
    setCurrentPage(1)
  }

  const handleSearchChange = (val) => {
    setSearchQuery(val)
    setCurrentPage(1)
  }

  // Handle NXP-055: Open Receiving & Inspection Modal
  const handleOpenReceiveModal = (containerOrTask) => {
    if (containerOrTask.taskCode) {
      setSelectedTaskToReceive(containerOrTask)
    } else {
      const matched = yardTasks.find(t => t.containerNo?.toLowerCase() === containerOrTask.id?.toLowerCase())
      setSelectedTaskToReceive(matched || {
        containerNo: containerOrTask.id,
        blockCode: containerOrTask.blockCode || 'A01',
        toLocation: containerOrTask.suggestedPosition || 'A01-05-02-3',
        expectedSealNo: containerOrTask.seal || 'SEAL-889922'
      })
    }
    setReceivingModalOpen(true)
  }

  // Handle NXP-060 STEP 1: Start Lift
  const handleStartLift = async (task) => {
    setOperatingTaskId(task.id)
    try {
      const payload = {
        notes: `Cần thủ ${task.operatorName || 'hiện trường'} bắt đầu cẩu container ${task.containerNo}`
      }
      const res = await yardTaskService.startLift(task.id, payload)
      showToast(`Đã bắt đầu cẩu container ${task.containerNo} (Task ${task.taskCode}).`)
      
      setYardTasks(prev => prev.map(t => t.id === task.id ? {
        ...t,
        status: 'In_Progress',
        startTime: res.data?.startTime || new Date().toISOString(),
        notes: res.data?.notes || t.notes
      } : t))
    } catch (err) {
      console.error('Start lift error:', err)
      const msg = err.response?.data?.message || err.message || 'Lỗi khi bắt đầu cẩu!'
      showToast(`Lỗi: ${msg}`)
    } finally {
      setOperatingTaskId(null)
    }
  }

  // Handle NXP-060 STEP 3: Open Complete Lift Modal
  const handleOpenCompleteLift = (task) => {
    setSelectedTaskToCompleteLift(task)
    setCompleteLiftModalOpen(true)
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full font-sans flex flex-col gap-5 bg-slate-50/60 min-h-screen text-slate-800">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-3 z-[100] border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse"></span>
          <span className="text-white font-medium leading-tight">{toastMessage}</span>
        </div>
      )}

      {/* ── 1. HEADER (Bố cục chuẩn Enterprise hiện đại) ── */}
      <header className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden border-t-4 border-t-indigo-600 bg-gradient-to-r from-white via-white to-indigo-50/20">
        <div>
          <div className="flex items-center gap-2 mb-1.5 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1 text-slate-500">
              <span className="material-symbols-outlined text-sm text-indigo-500">grid_view</span>
              Quản Lý Bãi Container
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-indigo-800 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
              Điều Hành Tác Nghiệp Hiện Trường
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Bảng Điều Hành Khai Thác Bãi</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Quy trình khép kín: Nhận lệnh Dispatcher → Gán cẩu RTG → Đối soát Seal → Nâng hạ container bãi.
          </p>
        </div>

        {/* Right Side: Metadata & Refresh Action */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Shift info */}
          <div className="px-3 py-1.5 bg-teal-50/80 border border-teal-200/80 rounded-xl text-xs font-semibold text-teal-900 flex items-center gap-1.5 shadow-2xs">
            <span className="material-symbols-outlined text-sm text-teal-600">schedule</span>
            <span>{activeShift}</span>
          </div>

          {/* Date info */}
          <div className="px-3 py-1.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs font-semibold text-blue-900 flex items-center gap-1.5 shadow-2xs">
            <span className="material-symbols-outlined text-sm text-blue-600">calendar_today</span>
            <span className="font-mono">{todayDate}</span>
          </div>

          {/* Operator Profile */}
          <div className="px-3 py-1.5 bg-violet-50/80 border border-violet-200/80 rounded-xl text-xs flex items-center gap-1.5 text-violet-900 font-medium shadow-2xs">
            <span className="material-symbols-outlined text-sm text-violet-600">person</span>
            <span className="font-bold">Phạm Bãi Hàng</span>
            <span className="text-[11px] text-violet-600/80 font-normal">(Yard Staff)</span>
          </div>
        </div>
      </header>

      {/* ── 2. KPI METRICS (5 Thẻ chỉ số sắc nét, màu sắc hài hòa) ── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        
        {/* Card 1: Total Yard Occupancy */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-t-4 border-t-blue-600 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all bg-gradient-to-b from-blue-50/20 to-white">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tồn Bãi Khai Thác</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/70 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined text-base">grid_view</span>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-blue-950 tracking-tight">
              {totalInYard.toLocaleString()} <span className="text-xs font-normal text-slate-400 font-sans">TEU</span>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Dung lượng</span>
                <span className="font-bold text-blue-700">{capacityPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full" style={{ width: `${capacityPercent}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Pending Inspection (NXP-055) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-t-4 border-t-amber-500 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all bg-gradient-to-b from-amber-50/20 to-white">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Chờ Đối Soát & Nhận</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-700">
              <span className="material-symbols-outlined text-base">qr_code_scanner</span>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-amber-950 tracking-tight">
              {uninspectedCount} <span className="text-xs font-normal text-slate-400 font-sans">Cont</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Chờ quét mã & đối soát seal</span>
            </div>
          </div>
        </div>

        {/* Card 3: Ready for Lift (NXP-056) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-t-4 border-t-sky-500 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all bg-gradient-to-b from-sky-50/20 to-white">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sẵn Sàng Cẩu</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200/70 flex items-center justify-center text-sky-700">
              <span className="material-symbols-outlined text-base">forklift</span>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-sky-950 tracking-tight">
              {readyCount} <span className="text-xs font-normal text-slate-400 font-sans">Task</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-sky-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              <span>Đã chỉ định cẩu & cần thủ</span>
            </div>
          </div>
        </div>

        {/* Card 4: In Progress Lift (NXP-060) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-t-4 border-t-orange-500 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all bg-gradient-to-b from-orange-50/20 to-white">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Đang Cẩu Nâng Hạ</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200/70 flex items-center justify-center text-orange-700">
              <span className="material-symbols-outlined text-base">precision_manufacturing</span>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-orange-950 tracking-tight">
              {inProgressCount} <span className="text-xs font-normal text-slate-400 font-sans">Task</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-orange-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
              <span>Cần thủ đang tác nghiệp</span>
            </div>
          </div>
        </div>

        {/* Card 5: Completed */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-t-4 border-t-emerald-500 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all col-span-2 sm:col-span-1 bg-gradient-to-b from-emerald-50/20 to-white">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hoàn Tất Trong Ca</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-700">
              <span className="material-symbols-outlined text-base">task_alt</span>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-emerald-950 tracking-tight">
              {completedCount} <span className="text-xs font-normal text-slate-400 font-sans">Task</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Đã hạ bãi an toàn</span>
            </div>
          </div>
        </div>

      </section>

      {/* ── 3. MAIN WORKSPACE (Bố cục 8 - 4 cân đối) ── */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ── KHU VỰC CHÍNH (8/12): BẢNG QUẢN LÝ NHIỆM VỤ BÃI ── */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col gap-4">
            
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Nhiệm Vụ Khai Thác Bãi
                </h2>
                <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  {filteredTasks.length}
                </span>
              </div>

              {/* Block Filter Selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Khu vực (Block):</span>
                <select
                  value={selectedBlockFilter}
                  onChange={e => handleBlockFilterChange(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">Tất cả Block</option>
                  <option value="A01">Block A01</option>
                  <option value="B02">Block B02</option>
                  <option value="C01">Block C01</option>
                </select>
              </div>
            </div>

            {/* Search & Modern Segmented Status Tabs Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Search input */}
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="Tìm kiếm mã task, số container, biển số xe..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors shadow-2xs"
                />
              </div>

              {/* Segmented Status Tabs */}
              <div className="flex flex-wrap gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 text-xs">
                {[
                  { key: 'ALL', label: 'Tất cả', count: yardTasks.length, activeBg: 'bg-slate-900 text-white', badgeActive: 'bg-slate-700 text-slate-200' },
                  { key: 'Assigned', label: 'Chờ gán', count: assignedCount, activeBg: 'bg-amber-500 text-white', badgeActive: 'bg-amber-600 text-amber-100' },
                  { key: 'Ready', label: 'Sẵn sàng', count: readyCount, activeBg: 'bg-sky-600 text-white', badgeActive: 'bg-sky-700 text-sky-100' },
                  { key: 'In_Progress', label: 'Đang cẩu', count: inProgressCount, activeBg: 'bg-orange-500 text-white', badgeActive: 'bg-orange-600 text-orange-100' },
                  { key: 'Completed', label: 'Xong', count: completedCount, activeBg: 'bg-emerald-600 text-white', badgeActive: 'bg-emerald-700 text-emerald-100' }
                ].map(tab => {
                  const isActive = taskStatusTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      onClick={() => handleStatusTabChange(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? `${tab.activeBg} shadow-xs`
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? tab.badgeActive : 'bg-slate-200/80 text-slate-600'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Task Table / Row List */}
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-2xs">
              {filteredTasks.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs bg-slate-50/30">
                  <span className="material-symbols-outlined text-3xl text-slate-300 block mb-1.5">inbox</span>
                  Không tìm thấy nhiệm vụ nào phù hợp với điều kiện lọc.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-500 font-semibold uppercase text-[10px] tracking-wider whitespace-nowrap">
                      <th className="py-3 px-4 min-w-[180px]">Mã Task & Loại</th>
                      <th className="py-3 px-4 min-w-[220px]">Container & Xe</th>
                      <th className="py-3 px-4 min-w-[240px]">Lộ Trình Bãi</th>
                      <th className="py-3 px-4 min-w-[190px]">Thiết Bị / Cần Thủ</th>
                      <th className="py-3 px-4 min-w-[130px] text-center">Trạng Thái</th>
                      <th className="py-3 px-4 min-w-[190px] text-right">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedTasks.map(task => {
                      const isAssigned = task.status?.toLowerCase() === 'assigned'
                      const isReady = task.status?.toLowerCase() === 'ready'
                      const isInProgress = task.status?.toLowerCase() === 'in_progress'
                      const isCompleted = task.status?.toLowerCase() === 'completed'
                      const isInspected = !!task.receivedAt

                      // Determine operation badge style
                      const opStr = (task.operationType || '').toLowerCase()
                      let opBadgeStyle = {
                        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/90',
                        icon: 'download'
                      }
                      if (opStr.includes('xuất') || opStr.includes('export') || opStr.includes('giao xe')) {
                        opBadgeStyle = {
                          bg: 'bg-blue-50 text-blue-800 border-blue-200/90',
                          icon: 'upload'
                        }
                      } else if (opStr.includes('đảo') || opStr.includes('chuyển') || opStr.includes('shift')) {
                        opBadgeStyle = {
                          bg: 'bg-purple-50 text-purple-800 border-purple-200/90',
                          icon: 'sync_alt'
                        }
                      }

                      return (
                        <tr
                          key={task.id}
                          className="hover:bg-slate-50/80 transition-colors group"
                        >
                          {/* Mã Task & Loại */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900 text-xs px-2 py-0.5 bg-slate-100/90 rounded border border-slate-200">
                                {task.taskCode}
                              </span>
                              {task.priority?.toLowerCase() === 'critical' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                                  Khẩn
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${opBadgeStyle.bg}`}>
                                <span className="material-symbols-outlined text-[11px]">{opBadgeStyle.icon}</span>
                                <span>{task.operationType}</span>
                              </span>
                              {task.blockCode && (
                                <span className="font-mono font-bold text-indigo-800 bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.5 rounded text-[10px]">
                                  Block {task.blockCode}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Container & Xe */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-sky-950 bg-sky-50 border border-sky-200/90 px-2 py-0.5 rounded text-xs shadow-2xs">
                                {task.containerNo}
                              </span>
                              <span className="text-[10px] text-slate-600 bg-slate-100 font-mono font-semibold px-1.5 py-0.5 rounded border border-slate-200/60">
                                {task.containerType || '40FT HC'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-700 mt-1.5 flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-xs text-slate-400">local_shipping</span>
                              <span className="font-mono font-semibold text-slate-800 bg-slate-50 border border-slate-200/80 px-1.5 py-0.5 rounded text-[11px]">
                                {task.vehiclePlate || 'Chưa gán xe'}
                              </span>
                              {task.driverName && (
                                <span className="text-slate-500 font-medium">({task.driverName})</span>
                              )}
                            </div>
                          </td>

                          {/* Lộ Trình Bãi */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="text-slate-400 font-medium">Từ:</span>
                              <span className="text-slate-700 font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60 font-mono">
                                {task.fromLocation || 'Cầu Tàu B-01'}
                              </span>
                              <span className="material-symbols-outlined text-xs text-slate-300">arrow_forward</span>
                              <span className="text-slate-400 font-medium">Đích:</span>
                              <span className="font-mono font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-xs">
                                {task.completedLocation || task.toLocation || 'A01-05-02-3'}
                              </span>
                            </div>
                            <div className="mt-1.5">
                              {isInspected ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200/90 px-2 py-0.5 rounded font-medium">
                                  <span className="material-symbols-outlined text-xs text-emerald-600">verified</span>
                                  <span>Seal: {task.actualSealNo || 'Đã khớp seal'}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 border border-amber-200/90 px-2 py-0.5 rounded font-medium">
                                  <span className="material-symbols-outlined text-xs text-amber-600">pending</span>
                                  <span>Chưa đối soát seal</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Thiết Bị / Cần Thủ */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            {task.equipmentCode ? (
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-xs text-teal-600">precision_manufacturing</span>
                                  <span className="font-mono font-bold text-teal-900 bg-teal-50 border border-teal-200/90 px-2 py-0.5 rounded text-xs">
                                    {task.equipmentCode}
                                  </span>
                                  <span className="text-[10px] text-teal-700 bg-teal-50/60 font-mono px-1.5 py-0.5 rounded border border-teal-100">
                                    {task.equipmentType || 'RTG'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs text-slate-400">person</span>
                                  <span className="font-medium text-slate-700">{task.operatorName || 'Chưa gán cần thủ'}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 px-2.5 py-1 rounded-lg italic inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                <span>Chưa chỉ định cẩu</span>
                              </span>
                            )}
                          </td>

                          {/* Trạng Thái */}
                          <td className="py-3.5 px-4 align-top text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                              isCompleted
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isInProgress
                                ? 'bg-orange-50 text-orange-700 border-orange-200'
                                : isReady
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                isCompleted
                                  ? 'bg-emerald-500'
                                  : isInProgress
                                  ? 'bg-orange-500 animate-pulse'
                                  : isReady
                                  ? 'bg-blue-500'
                                  : 'bg-amber-500'
                              }`}></span>
                              <span>{task.status}</span>
                            </span>
                          </td>

                          {/* Hành Động Nút Bấm */}
                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {isAssigned && (
                                <>
                                  {!isInspected && (
                                    <button
                                      onClick={() => handleOpenReceiveModal(task)}
                                      title="Đối soát seal & ngoại quan container"
                                      className="px-2.5 py-1.5 bg-white hover:bg-amber-50 border border-amber-300 text-amber-800 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shadow-2xs active:scale-[0.98] flex items-center gap-1"
                                    >
                                      <span className="material-symbols-outlined text-xs text-amber-600">qr_code_scanner</span>
                                      <span>Đối Soát</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setSelectedTaskToAssign(task)}
                                    title="Gán Cẩu RTG & Cần thủ"
                                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-medium transition-all cursor-pointer shadow-xs active:scale-[0.98] flex items-center gap-1"
                                  >
                                    <span className="material-symbols-outlined text-xs text-slate-300">forklift</span>
                                    <span>Gán Cẩu</span>
                                  </button>
                                </>
                              )}

                              {isReady && (
                                <button
                                  onClick={() => handleStartLift(task)}
                                  disabled={operatingTaskId === task.id}
                                  title="Bắt đầu nâng hạ container"
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-[0.98] disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-xs">play_arrow</span>
                                  <span>Bắt Đầu Cẩu</span>
                                </button>
                              )}

                              {isInProgress && (
                                <button
                                  onClick={() => handleOpenCompleteLift(task)}
                                  title="Xác nhận hạ bãi & giải phóng cẩu"
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-[0.98]"
                                >
                                  <span className="material-symbols-outlined text-xs">task_alt</span>
                                  <span>Hoàn Tất</span>
                                </button>
                              )}

                              {isCompleted && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                  <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
                                  <span>Đã hạ bãi</span>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            {filteredTasks.length > 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 text-xs">
                <div className="flex items-center gap-2 text-slate-500">
                  <span>Hiển thị</span>
                  <select
                    value={pageSize}
                    onChange={e => {
                      setPageSize(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="pl-3 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <span>nhiệm vụ / trang (Tổng <strong>{filteredTasks.length}</strong>)</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer shadow-2xs"
                  >
                    Trang trước
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNo => (
                      <button
                        key={pageNo}
                        onClick={() => setCurrentPage(pageNo)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          currentPage === pageNo
                            ? 'bg-slate-900 text-white font-bold shadow-2xs'
                            : 'bg-white hover:bg-slate-50 border border-slate-300 text-slate-700'
                        }`}
                      >
                        {pageNo}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer shadow-2xs"
                  >
                    Trang sau
                  </button>
                </div>
              </div>
            )}

          </div>
        </section>

        {/* ── KHU VỰC PHỤ (4/12): TIẾP NHẬN CONTAINER & GỢI Ý VỊ TRÍ AI ── */}
        <aside className="lg:col-span-4 flex flex-col gap-5">
          
          {/* Panel 1: Container Đang Tới Làn Bãi */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col gap-4 border-t-4 border-t-sky-500">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200/80 flex items-center justify-center text-sky-600">
                  <span className="material-symbols-outlined text-base">input</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Hàng Chờ Tiếp Nhận (Làn Bãi)
                  </h3>
                  <p className="text-[11px] text-slate-500">Đối soát cont từ cầu cảng & xe kéo</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold bg-sky-50 text-sky-700 px-2.5 py-0.5 rounded-full border border-sky-200">
                {incomingContainers.length}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {incomingContainers.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs bg-emerald-50/40 rounded-xl border border-dashed border-emerald-200 p-4">
                  <span className="material-symbols-outlined text-3xl text-emerald-600 block mb-1">task_alt</span>
                  <p className="font-semibold text-emerald-900">Đã tiếp nhận hết các container</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Không còn container nào chờ đối soát tại làn bãi.</p>
                </div>
              ) : (
                incomingContainers.map(c => (
                <div
                  key={c.id}
                  className="p-3.5 bg-slate-50/80 border border-slate-200/90 rounded-xl flex flex-col gap-2.5 hover:border-sky-300 hover:bg-sky-50/20 transition-all shadow-2xs"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-sky-950 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded text-xs shadow-2xs">
                          {c.id}
                        </span>
                        <span className="text-[10px] text-slate-600 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 font-semibold">
                          {c.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-blue-500">directions_boat</span>
                        <span className="font-medium text-slate-700">{c.vessel}</span>
                        <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-1.5 py-0.2 rounded border border-blue-200/60">Bến {c.berth}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold rounded-md">
                      {c.statusBadge}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-600 pt-2 border-t border-slate-200/70 font-mono">
                    <span className="flex items-center gap-1">
                      <span className="text-slate-400 font-sans">Seal:</span>
                      <strong className="text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">{c.seal}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-slate-400 font-sans">Ô hạ:</span>
                      <strong className="text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs">{c.suggestedPosition}</strong>
                    </span>
                  </div>

                  <button
                    onClick={() => handleOpenReceiveModal(c)}
                    className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-xs">qr_code_scanner</span>
                    <span>Đối Soát & Nhận Cont</span>
                  </button>
                </div>
              )))}
            </div>
          </div>

          {/* Panel 2: Gợi Ý Vị Trí Bãi AI */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col gap-4 border-t-4 border-t-purple-500">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-600">
                  <span className="material-symbols-outlined text-base">auto_awesome</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Gợi Ý Vị Trí Bãi AI
                  </h3>
                  <p className="text-[11px] text-slate-500">Tối ưu hóa phân tầng & giảm đảo chuyển</p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-2.5 py-0.5 rounded-full shadow-2xs">
                AI Engine
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {positioningTasks.map(pt => (
                <div
                  key={pt.id}
                  className="p-3.5 bg-slate-50/80 border border-slate-200/90 rounded-xl flex flex-col gap-2 hover:border-purple-300 hover:bg-purple-50/20 transition-all shadow-2xs"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded text-xs">
                      {pt.id}
                    </span>
                    <span className="font-mono font-bold text-purple-900 text-xs bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/80 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[11px] text-purple-600">location_on</span>
                      {pt.aiSuggestedPos}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex items-center justify-between">
                    <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px]">{pt.cargoType}</span>
                    <span className="text-slate-500 text-[10px] font-mono">Rời cảng: {pt.departure}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed bg-white p-2.5 rounded-lg border border-purple-100/80 text-justify">
                    {pt.reasoning}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </aside>

      </main>

      {/* ── MODALS QUY TRÌNH ── */}

      {/* MODAL 1: Yard Receiving Modal */}
      {receivingModalOpen && (
        <YardReceivingModal
          task={selectedTaskToReceive}
          allTasks={yardTasks}
          isOpen={receivingModalOpen}
          onClose={() => {
            setReceivingModalOpen(false)
            setSelectedTaskToReceive(null)
          }}
          onSuccess={(updated) => {
            const contNo = updated?.containerNo || updated?.data?.containerNo || selectedTaskToReceive?.containerNo
            showToast(`Tiếp nhận thành công container ${contNo || ''}. Đã cập nhật vào bãi.`)
            if (contNo) {
              setIncomingContainers(prev => prev.filter(c => c.id?.toLowerCase() !== contNo.toLowerCase()))
              setYardTasks(prev => prev.map(t => {
                if (t.containerNo?.toLowerCase() === contNo.toLowerCase()) {
                  return {
                    ...t,
                    receivedAt: new Date().toISOString(),
                    actualSealNo: updated?.actualSealNo || t.actualSealNo || 'SEAL-889922'
                  }
                }
                return t
              }))
            }
            loadLiveTasks()
          }}
        />
      )}

      {/* MODAL 2: NXP-056 Assign Equipment Modal */}
      {selectedTaskToAssign && (
        <AssignEquipmentModal
          task={selectedTaskToAssign}
          isOpen={!!selectedTaskToAssign}
          onClose={() => setSelectedTaskToAssign(null)}
          onSuccess={(updatedTask) => {
            showToast(`Đã gán Cẩu ${updatedTask.equipmentCode} cho nhiệm vụ ${updatedTask.taskCode}.`)
            loadLiveTasks()
          }}
        />
      )}

      {/* MODAL 3: NXP-060 Complete Lift Modal */}
      {completeLiftModalOpen && selectedTaskToCompleteLift && (
        <CompleteLiftModal
          task={selectedTaskToCompleteLift}
          isOpen={completeLiftModalOpen}
          onClose={() => {
            setCompleteLiftModalOpen(false)
            setSelectedTaskToCompleteLift(null)
          }}
          onSuccess={(updatedTask) => {
            showToast(`Hoàn thành cẩu container ${updatedTask.containerNo}. Đã hạ bãi an toàn.`)
            loadLiveTasks()
          }}
        />
      )}

    </div>
  )
}
