import React, { useState } from 'react'

export default function VehicleDispatch() {
  const [activeFilter, setActiveFilter] = useState('All') // 'All' | 'PORT_PICKUP' | 'YARD_MOVE' | 'DELIVERY' | 'High' | 'Waiting'
  const [selectedTask, setSelectedTask] = useState({
    id: 'TSK-1001',
    taskType: 'PORT_PICKUP',
    taskTypeName: 'Lấy Container Tại Cảng (Port Pickup)',
    container: 'MSCU1234567',
    containerType: '40ft Dry',
    origin: 'Cảng Tiên Sa (Tiên Sa Port)',
    destination: 'Kho Depot A',
    position: 'Bến Dỡ D01',
    priority: 'HIGH',
    priorityClass: 'bg-red-100 text-red-800 border-red-300 font-bold',
    requiredVehicleType: 'ROAD_TRUCK',
    requiredVehicleName: '🚚 Xe Đầu Kéo Đường Dài (Road Truck)',
    waitingTime: '8 phút',
    status: 'Pending'
  })

  const [selectedVehicleForTask, setSelectedVehicleForTask] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false)
  const [newTaskForm, setNewTaskForm] = useState({
    taskType: 'PORT_DELIVERY',
    container: 'COSU' + Math.floor(1000000 + Math.random() * 9000000),
    containerType: '40ft HC',
    origin: 'Kho Hòa Cầm - Đà Nẵng',
    destination: 'Cảng Tiên Sa (Bãi Khối A)',
    priority: 'HIGH',
    requiredVehicleType: 'ROAD_TRUCK'
  })
  const [dispatchSuccessData, setDispatchSuccessData] = useState(null)
  const [selectedActiveDispatchTimeline, setSelectedActiveDispatchTimeline] = useState(null)
  const [selectedMapVehiclePopover, setSelectedMapVehiclePopover] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  // 1. KPI Stats
  const [kpiStats, setKpiStats] = useState({
    pending: 12,
    assigned: 8,
    inTransit: 14,
    handling: 6,
    delayed: 2,
    completed: 42
  })

  // 2. Dispatch Requests List (Tasks Pending Dispatch)
  const [pendingTasks, setPendingTasks] = useState([
    {
      id: 'TSK-1001',
      taskType: 'PORT_PICKUP',
      taskTypeName: 'Lấy Container Tại Cảng (Port Pickup)',
      container: 'MSCU1234567',
      containerType: '40ft Dry',
      origin: 'Cảng Tiên Sa',
      destination: 'Kho Depot A',
      position: 'Bến Dỡ D01',
      priority: 'HIGH',
      priorityClass: 'bg-red-100 text-red-800 border-red-300 font-bold',
      requiredVehicleType: 'ROAD_TRUCK',
      requiredVehicleName: '🚚 Road Truck (Xe Đường Dài)',
      waitingTime: '8 phút',
      status: 'Pending'
    },
    {
      id: 'TSK-1002',
      taskType: 'YARD_MOVE',
      taskTypeName: 'Chuyển Nội Bãi (Yard Move)',
      container: 'MSCU7654321',
      containerType: '20ft Dry',
      origin: 'Khối bãi B (B12-04)',
      destination: 'Khu Vực Cẩu Bãi RTG-02',
      position: 'B12-04',
      priority: 'NORMAL',
      priorityClass: 'bg-blue-100 text-blue-800 border-blue-300',
      requiredVehicleType: 'YARD_TRACTOR',
      requiredVehicleName: '🚜 Yard Tractor (Xe Nội Bãi)',
      waitingTime: '4 phút',
      status: 'Pending'
    },
    {
      id: 'TSK-1003',
      taskType: 'PORT_DELIVERY',
      taskTypeName: 'Giao Container Về Cảng (Port Delivery)',
      container: 'COSU609123',
      containerType: '20ft Dry',
      origin: 'Kho An Đồn - Đà Nẵng',
      destination: 'Cảng Tiên Sa (Bãi Khối A)',
      position: 'Cổng 01 -> Khối bãi A',
      priority: 'HIGH',
      priorityClass: 'bg-red-100 text-red-800 border-red-300 font-bold',
      requiredVehicleType: 'ROAD_TRUCK',
      requiredVehicleName: '🚚 Xe Đầu Kéo Đường Dài',
      waitingTime: '5 phút',
      status: 'Pending'
    },
    {
      id: 'TSK-1004',
      taskType: 'PORT_DELIVERY',
      taskTypeName: 'Điều Phối Xe Hàng Xuất Về Cảng (Port Delivery)',
      container: 'EVER441920',
      containerType: '40ft HC',
      origin: 'Khu Công Nghiệp Hòa Cầm',
      destination: 'Cảng Tiên Sa (Bãi Khối B)',
      position: 'Cổng 02 -> Khối bãi B',
      priority: 'NORMAL',
      priorityClass: 'bg-blue-100 text-blue-800 border-blue-300 font-bold',
      requiredVehicleType: 'ROAD_TRUCK',
      requiredVehicleName: '🚚 Xe Đầu Kéo Đường Dài',
      waitingTime: '12 phút',
      status: 'Pending'
    },
    {
      id: 'TSK-1005',
      taskType: 'YARD_MOVE',
      taskTypeName: 'Chuyển Container Rỗng Nội Bãi (Yard Move)',
      container: 'HLBU993210-5',
      containerType: '40ft Dry Empty',
      origin: 'Khối bãi A',
      destination: 'Khối bãi D (Bãi Rỗng)',
      position: 'A-04-02',
      priority: 'LOW',
      priorityClass: 'bg-slate-100 text-slate-700 border-slate-300',
      requiredVehicleType: 'YARD_TRACTOR',
      requiredVehicleName: '🚜 Xe Nội Bãi (Yard Tractor)',
      waitingTime: '2 phút',
      status: 'Pending'
    }
  ])

  // 3. Vehicles Available Fleet (Strictly Enforcement Checks)
  const allFleetVehicles = [
    { id: 'TRK-001', type: 'ROAD_TRUCK', plate: '43C-123.45', driver: 'Nguyễn Văn A', phone: '0905-123-456', distance: '450m', eta: '3 phút', status: 'AVAILABLE', statusLabel: '🟢 Sẵn sàng' },
    { id: 'TRK-005', type: 'ROAD_TRUCK', plate: '43C-556.78', driver: 'Hoàng Văn E', phone: '0935-778-990', distance: '800m', eta: '5 phút', status: 'AVAILABLE', statusLabel: '🟢 Sẵn sàng' },
    { id: 'YTR-003', type: 'YARD_TRACTOR', plate: 'YT-003', driver: 'Trần Văn B', phone: '0914-987-654', distance: '200m', eta: '2 phút', status: 'AVAILABLE', statusLabel: '🟢 Sẵn sàng' },
    { id: 'YTR-005', type: 'YARD_TRACTOR', plate: 'YT-005', driver: 'Lê Văn C', phone: '0903-887-112', distance: '350m', eta: '3 phút', status: 'AVAILABLE', statusLabel: '🟢 Sẵn sàng' },
    { id: 'TRK-008', type: 'ROAD_TRUCK', plate: '15C-882.19', driver: 'Phạm Văn D', phone: '0983-221-443', distance: '1.2km', eta: '14 phút', status: 'DELAYED', statusLabel: '🔴 Trễ hạn' },
    { id: 'YTR-001', type: 'YARD_TRACTOR', plate: 'YT-001', driver: 'Đặng Văn F', phone: '0977-123-998', distance: 'N/A', eta: 'Bảo trì', status: 'MAINTENANCE', statusLabel: '🔧 Bảo trì' },
  ]

  // Filter available vehicles matching selected task required type and AVAILABLE status
  const matchedAvailableVehicles = allFleetVehicles.filter(
    v => v.type === selectedTask.requiredVehicleType && v.status === 'AVAILABLE'
  )

  // 4. Active Running Dispatches
  const [activeDispatches, setActiveDispatches] = useState([
    {
      dspId: 'DSP-20260811-010',
      taskType: 'PORT_DELIVERY',
      vehicle: 'TRK-005',
      plate: '43C-556.78',
      driver: 'Hoàng Văn E',
      container: 'TEMU882219',
      origin: 'Kho Depot Liên Chiểu',
      destination: 'Cảng Tiên Sa (Cổng 01 -> Bãi Khối A)',
      status: 'IN_TRANSIT',
      statusLabel: '🔵 Xe đang di chuyển về Cảng',
      statusClass: 'bg-blue-100 text-blue-900 border-blue-300 font-bold',
      eta: '10 phút',
      gateBookingId: 'GB-20260811-010',
      timelineStep: 3
    },
    {
      dspId: 'DSP-20260811-008',
      taskType: 'PORT_PICKUP',
      vehicle: 'TRK-001',
      plate: '43C-123.45',
      driver: 'Nguyễn Văn A',
      container: 'MSCU881920',
      origin: 'Cảng Tiên Sa (Bãi Khối B)',
      destination: 'Kho Depot Tân Cảng',
      status: 'IN_TRANSIT',
      statusLabel: '🔵 Đang vận chuyển ra khỏi Cảng',
      statusClass: 'bg-purple-100 text-purple-900 border-purple-300 font-bold',
      eta: '18 phút',
      gateBookingId: 'GB-20260811-008',
      timelineStep: 5
    },
    {
      dspId: 'DSP-20260811-005',
      taskType: 'YARD_MOVE',
      vehicle: 'YTR-003',
      plate: 'YT-003',
      driver: 'Trần Văn B',
      container: 'MSCU7654321',
      origin: 'Khối bãi B',
      destination: 'Khu vực Cẩu RTG-02',
      status: 'HANDLING',
      statusLabel: '🟡 Đang cẩu dỡ (Handling)',
      statusClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
      eta: '2 phút',
      gateBookingId: 'N/A (Nội Bãi)',
      timelineStep: 7
    }
  ])

  // Filter Tasks
  const filteredTasks = pendingTasks.filter(t => {
    if (activeFilter === 'PORT_PICKUP') return t.taskType === 'PORT_PICKUP'
    if (activeFilter === 'PORT_DELIVERY') return t.taskType === 'PORT_DELIVERY'
    if (activeFilter === 'YARD_MOVE') return t.taskType === 'YARD_MOVE'
    if (activeFilter === 'High') return t.priority === 'HIGH'
    return true
  })

  // Confirm Dispatch Execution
  const handleExecuteDispatch = () => {
    if (!selectedVehicleForTask) {
      alert('Vui lòng chọn phương tiện sẵn sàng trước khi xác nhận!')
      return
    }

    const newDspId = `DSP-${Date.now().toString().slice(-6)}`
    const generatedGateBookingId = selectedTask.taskType !== 'YARD_MOVE' ? `GB-${Date.now().toString().slice(-6)}` : 'N/A (Nội Bãi)'

    const newDispatchItem = {
      dspId: newDspId,
      taskType: selectedTask.taskType,
      vehicle: selectedVehicleForTask.id,
      plate: selectedVehicleForTask.plate,
      driver: selectedVehicleForTask.driver,
      container: selectedTask.container,
      origin: selectedTask.origin,
      destination: selectedTask.destination,
      status: 'ASSIGNED',
      statusLabel: '🔵 Đã gán lệnh (Assigned)',
      statusClass: 'bg-blue-100 text-blue-800 border-blue-300',
      eta: selectedVehicleForTask.eta,
      gateBookingId: generatedGateBookingId,
      timelineStep: 3
    }

    // Update States
    setActiveDispatches([newDispatchItem, ...activeDispatches])
    setPendingTasks(pendingTasks.filter(t => t.id !== selectedTask.id))
    setKpiStats(prev => ({
      ...prev,
      pending: prev.pending - 1,
      assigned: prev.assigned + 1
    }))

    setShowConfirmModal(false)
    setDispatchSuccessData(newDispatchItem)
    setSelectedVehicleForTask(null)

    setToastMessage(`⚡ Đã tạo lệnh điều độ ${newDspId} và tự động gửi Gate Booking ${generatedGateBookingId} thành công!`)
    setTimeout(() => setToastMessage(''), 4000)
  }

  // Reassign Delayed Vehicle Execution
  const handleConfirmReassign = (backupVehicle) => {
    const updatedActive = activeDispatches.map(item => {
      if (item.status === 'DELAYED') {
        return {
          ...item,
          vehicle: backupVehicle.id,
          plate: backupVehicle.plate,
          driver: backupVehicle.driver,
          status: 'ASSIGNED',
          statusLabel: '🔵 Đã đổi xe (Reassigned)',
          statusClass: 'bg-blue-100 text-blue-800 border-blue-300',
          eta: backupVehicle.eta,
          timelineStep: 4
        }
      }
      return item
    })

    setActiveDispatches(updatedActive)
    setShowReassignModal(false)
    setKpiStats(prev => ({
      ...prev,
      delayed: prev.delayed - 1,
      assigned: prev.assigned + 1
    }))

    setToastMessage(`🔄 Đã tái chỉ định xe ${backupVehicle.id} thay thế cho lệnh bị trễ thành công!`)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // Create New Dispatch Task Handler
  const handleCreateTask = (e) => {
    e.preventDefault()
    const taskTypeName =
      newTaskForm.taskType === 'PORT_DELIVERY'
        ? 'Giao Container Về Cảng (Port Delivery)'
        : newTaskForm.taskType === 'PORT_PICKUP'
        ? 'Lấy Container Tại Cảng (Port Pickup)'
        : 'Chuyển Nội Bãi (Yard Move)'

    const createdTask = {
      id: `TSK-${Date.now().toString().slice(-4)}`,
      taskType: newTaskForm.taskType,
      taskTypeName,
      container: newTaskForm.container,
      containerType: newTaskForm.containerType,
      origin: newTaskForm.origin,
      destination: newTaskForm.destination,
      position: newTaskForm.origin + ' ➔ ' + newTaskForm.destination,
      priority: newTaskForm.priority,
      priorityClass: newTaskForm.priority === 'HIGH' ? 'bg-red-100 text-red-800 border-red-300 font-bold' : 'bg-blue-100 text-blue-800 border-blue-300',
      requiredVehicleType: newTaskForm.requiredVehicleType,
      requiredVehicleName: newTaskForm.requiredVehicleType === 'ROAD_TRUCK' ? '🚚 Xe Đầu Kéo Đường Dài' : '🚜 Xe Nội Bãi (Yard Tractor)',
      waitingTime: 'Vừa tạo',
      status: 'Pending'
    }

    setPendingTasks(prev => [createdTask, ...prev])
    setSelectedTask(createdTask)
    setShowCreateTaskModal(false)
    setKpiStats(prev => ({ ...prev, pending: prev.pending + 1 }))
    setToastMessage(`✅ Đã tạo nhiệm vụ điều phối mới: ${createdTask.taskTypeName} (${createdTask.container})!`)
    setTimeout(() => setToastMessage(''), 3500)
  }

  return (
    <div className="p-8 w-full font-sans flex flex-col gap-6 relative">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-carbon text-white px-6 py-3.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 z-50 animate-bounce border border-signal-orange">
          <span className="text-signal-orange text-base">●</span>
          {toastMessage}
        </div>
      )}

      {/* HEADER BAR */}
      <div className="flex justify-between items-center bg-white border border-chalk rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase">
              HỆ THỐNG ĐIỀU PHỐI TẬP TRUNG CẢNG TIÊN SA
            </span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span>
              🟢 TRỰC TUYẾN
            </span>
          </div>
          <h2 className="font-heading text-3xl text-carbon font-extrabold mt-1">Điều Phối Phương Tiện</h2>
          <p className="text-xs text-slate mt-0.5">Điều phối xe nhận/giao container về Cảng Tiên Sa & xe nội bãi, theo dõi quá trình realtime.</p>
        </div>

        <button
          onClick={() => setShowCreateTaskModal(true)}
          className="h-11 px-5 bg-signal-orange text-white rounded-xl font-extrabold text-xs hover:opacity-95 transition-opacity shadow-lg flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">add_task</span>
          + Tạo Yêu Cầu Điều Phối
        </button>
      </div>

      {/* KPI BAR (6 CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        
        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Đang Chờ Gán Xe</span>
          <div className="text-3xl font-extrabold text-amber-500 font-mono">{kpiStats.pending}</div>
          <span className="text-[11px] text-slate font-bold">Nhiệm vụ chờ gán xe</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Đã Phân Công</span>
          <div className="text-3xl font-extrabold text-blue-600 font-mono">{kpiStats.assigned}</div>
          <span className="text-[11px] text-blue-600 font-bold">Đã có tài xế nhận lệnh</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Đang Di Chuyển</span>
          <div className="text-3xl font-extrabold text-purple-600 font-mono">{kpiStats.inTransit}</div>
          <span className="text-[11px] text-purple-600 font-bold">Đang di chuyển lưu thông</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Đang Cẩu Dỡ</span>
          <div className="text-3xl font-extrabold text-amber-600 font-mono">{kpiStats.handling}</div>
          <span className="text-[11px] text-amber-600 font-bold">Đang bốc dỡ cẩu RTG</span>
        </div>

        <div className="bg-white border-2 border-red-400 rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Trễ Hạn</span>
          <div className="text-3xl font-extrabold text-red-600 font-mono">{kpiStats.delayed}</div>
          <span className="text-[11px] text-red-600 font-bold">Cần tái chỉ định xe</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Hoàn Thành</span>
          <div className="text-3xl font-extrabold text-green-600 font-mono">{kpiStats.completed}</div>
          <span className="text-[11px] text-green-600 font-bold">Hoàn thành hôm nay</span>
        </div>

      </div>

      {/* 3-COLUMN DISPATCH CONTROL CENTER LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* 1. LEFT PANEL: DISPATCH REQUESTS (3 cols ~25%) */}
        <div className="lg:col-span-3 bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-4">
          
          <div className="border-b border-chalk pb-3">
            <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">HÀNG ĐỢI NHIỆM VỤ</span>
            <h3 className="font-heading text-lg font-extrabold text-carbon">Yêu Cầu Điều Phối</h3>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
            {['All', 'PORT_PICKUP', 'PORT_DELIVERY', 'YARD_MOVE', 'High'].map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-2.5 py-1 rounded-full transition-colors ${
                  activeFilter === f ? 'bg-carbon text-white shadow-sm' : 'bg-fog text-slate hover:text-carbon border border-chalk'
                }`}
              >
                {f === 'PORT_PICKUP' ? 'Lấy từ Cảng' : f === 'PORT_DELIVERY' ? 'Giao Về Cảng' : f === 'YARD_MOVE' ? 'Chuyển Nội Bãi' : f === 'High' ? 'Ưu tiên' : 'Tất cả'}
              </button>
            ))}
          </div>

          {/* Pending Tasks Cards List */}
          <div className="space-y-3 font-mono text-xs max-h-[500px] overflow-y-auto pr-1">
            {filteredTasks.map(task => (
              <div
                key={task.id}
                onClick={() => {
                  setSelectedTask(task)
                  setSelectedVehicleForTask(null)
                }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedTask.id === task.id
                    ? 'border-signal-orange bg-orange-50/70 shadow-md'
                    : 'border-chalk bg-white hover:border-slate'
                }`}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span className={`px-2 py-0.5 rounded text-[9px] ${task.priorityClass}`}>
                    ● {task.priority} PRIORITY
                  </span>
                  <span className="text-[10px] text-slate font-sans">Chờ: {task.waitingTime}</span>
                </div>

                <h4 className="font-heading font-extrabold text-sm text-carbon">{task.taskTypeName}</h4>
                <div className="text-signal-orange font-bold text-xs mt-0.5">{task.container} ({task.containerType})</div>

                <div className="bg-fog p-2.5 rounded-lg border border-chalk my-2 text-[11px] font-sans space-y-1">
                  <div>Từ: <strong className="text-carbon font-mono">{task.origin}</strong></div>
                  <div>Đến: <strong className="text-carbon font-mono">{task.destination}</strong></div>
                </div>

                <div className="flex justify-between items-center text-[10px] pt-1">
                  <span className="text-slate font-sans">Yêu cầu loại xe:</span>
                  <strong className="text-carbon font-mono">{task.requiredVehicleName}</strong>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* 2. CENTER PANEL: LIVE PORT BLUEPRINT MAP (6 cols ~50%) */}
        <div className="lg:col-span-6 bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 relative min-h-[560px] overflow-hidden flex flex-col justify-between">
          
          {/* Blueprint Canvas Graphic Overlay */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dispatchBlueprintGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#cbd5e1" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dispatchBlueprintGrid)" />
            <line x1="0" y1="160" x2="100%" y2="160" stroke="#ff682c" strokeWidth="2.5" strokeDasharray="6 4" />
            <line x1="0" y1="380" x2="100%" y2="380" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="6 4" />
          </svg>

          {/* Map Top Runway Header */}
          <div className="flex justify-between items-center text-xs font-mono border-b border-slate-200 pb-3 z-10">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-blue-300 shadow-sm font-bold">
              <span className="material-symbols-outlined text-blue-600 text-sm">directions_boat</span>
              <span>BẾN DỠ TÀU CẢNG TIÊN SA (DOCK D01)</span>
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-green-300 shadow-sm font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span>
              <span>CỔNG VÀO (GATE 01)</span>
            </div>
          </div>

          {/* Interactive Port Layout Nodes */}
          <div className="grid grid-cols-3 gap-4 z-10 font-mono text-xs my-2">
            <div className="bg-white/90 p-3 rounded-xl border border-slate-300 shadow-sm text-center">
              <strong className="text-carbon block">KHỐI BÃI A</strong>
              <span className="text-[10px] text-slate-500 font-sans">145 Container • RTG-01</span>
            </div>
            <div className="bg-red-50 p-3 rounded-xl border-2 border-red-400 shadow-sm text-center">
              <strong className="text-red-900 block">KHỐI BẢI B (QUÁ TẢI)</strong>
              <span className="text-[10px] text-red-700 font-sans font-bold">188 Cont • RTG-02 (94%)</span>
            </div>
            <div className="bg-white/90 p-3 rounded-xl border border-slate-300 shadow-sm text-center">
              <strong className="text-carbon block">KHỐI BÃI C (REEFER)</strong>
              <span className="text-[10px] text-slate-500 font-sans">108 Container Lạnh</span>
            </div>
          </div>

          {/* LIVE MOVING VEHICLES ON MAP */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2 z-10">
            <span className="text-[10px] font-bold text-slate-500 uppercase block font-sans">VỊ TRÍ PHƯƠNG TIỆN REALTIME TRÊN BẢN ĐỒ:</span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {allFleetVehicles.map(v => (
                <div
                  key={v.id}
                  onClick={() => setSelectedMapVehiclePopover(v)}
                  className={`p-2.5 rounded-lg border cursor-pointer flex justify-between items-center transition-colors ${
                    v.status === 'AVAILABLE' ? 'bg-green-50 border-green-300 hover:border-green-500' : 'bg-slate-50 border-slate-300'
                  }`}
                >
                  <div>
                    <strong className="text-carbon block">{v.id} ({v.plate})</strong>
                    <span className="text-[10px] text-slate-500 font-sans">{v.driver}</span>
                  </div>
                  <span className="text-[10px] font-bold">{v.statusLabel}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Map Footer Route Path info */}
          <div className="bg-carbon text-white p-3 rounded-xl text-xs font-mono flex justify-between items-center z-10 shadow-lg">
            <span>NHIỆM VỤ ĐANG CHỌN: <strong className="text-signal-orange">{selectedTask.id}</strong> ({selectedTask.taskTypeName})</span>
            <span className="text-[11px] text-gray-300">Yêu cầu xe: {selectedTask.requiredVehicleType}</span>
          </div>

        </div>

        {/* 3. RIGHT PANEL: TASK DETAIL & VEHICLE SELECTION (3 cols ~25%) */}
        <div className="lg:col-span-3 bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-4">
          
          <div className="border-b border-chalk pb-3">
            <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">CHI TIẾT & CHỌN XE</span>
            <h3 className="font-heading text-lg font-extrabold text-carbon">Chi Tiết Lệnh Điều Động</h3>
          </div>

          {/* Selected Task Summary Card */}
          <div className="bg-fog p-4 rounded-xl border border-chalk space-y-2 text-xs font-mono">
            <div className="flex justify-between"><span className="text-slate font-sans">Mã Nhiệm vụ:</span><strong className="text-carbon">{selectedTask.id}</strong></div>
            <div className="flex justify-between"><span className="text-slate font-sans">Loại lệnh:</span><strong className="text-signal-orange font-sans font-bold">{selectedTask.taskTypeName}</strong></div>
            <div className="flex justify-between"><span className="text-slate font-sans">Mã Container:</span><strong className="text-carbon font-bold">{selectedTask.container}</strong></div>
            <div className="flex justify-between"><span className="text-slate font-sans">Điểm xuất phát:</span><strong className="text-carbon font-sans">{selectedTask.origin}</strong></div>
            <div className="flex justify-between"><span className="text-slate font-sans">Điểm đến:</span><strong className="text-signal-orange font-sans font-bold">{selectedTask.destination}</strong></div>
            <div className="flex justify-between border-t border-chalk pt-2"><span className="text-slate font-sans">Xe bắt buộc:</span><strong className="text-carbon font-bold">{selectedTask.requiredVehicleName}</strong></div>
          </div>

          {/* MATCHED AVAILABLE VEHICLES SELECTION SECTION */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate uppercase block font-sans">DANH SÁCH XE SẴN SÀNG PHÙ HỢP ({matchedAvailableVehicles.length})</span>
            
            {matchedAvailableVehicles.length === 0 ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-sans space-y-1">
                <strong>⚠ Không có xe {selectedTask.requiredVehicleType} nào sẵn sàng!</strong>
                <p className="text-[11px]">Tất cả các xe loại này đều đang di chuyển hoặc bảo trì.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto font-mono text-xs">
                {matchedAvailableVehicles.map(veh => (
                  <div
                    key={veh.id}
                    onClick={() => setSelectedVehicleForTask({ ...veh, selectedDriver: veh.driver })}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center ${
                      selectedVehicleForTask?.id === veh.id
                        ? 'border-signal-orange bg-orange-50/80 shadow-md'
                        : 'border-chalk bg-fog/50 hover:border-slate'
                    }`}
                  >
                    <div>
                      <strong className="text-carbon block">{veh.id} ({veh.plate})</strong>
                      <span className="text-[10px] text-slate font-sans">Tài xế mặc định: {veh.driver} • ETA: {veh.eta}</span>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${selectedVehicleForTask?.id === veh.id ? 'bg-signal-orange text-white' : 'bg-green-600 text-white'}`}>
                      {selectedVehicleForTask?.id === veh.id ? '✓ Đã chọn' : 'Chọn xe'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DRIVER ASSIGNMENT SELECTOR FOR SELECTED VEHICLE */}
          {selectedVehicleForTask && (
            <div className="p-3.5 bg-orange-50 border border-orange-200 rounded-xl space-y-2 text-xs font-mono">
              <label className="block text-[10px] font-bold text-orange-900 font-sans uppercase">
                👨‍✈️ PHÂN CÔNG TÀI XẾ CHO XE {selectedVehicleForTask.id}:
              </label>
              <select
                value={selectedVehicleForTask.selectedDriver || selectedVehicleForTask.driver}
                onChange={e => setSelectedVehicleForTask({ ...selectedVehicleForTask, driver: e.target.value, selectedDriver: e.target.value })}
                className="w-full p-2 bg-white border border-orange-300 rounded-lg font-bold text-carbon focus:outline-none focus:border-signal-orange text-xs"
              >
                <option value="Nguyễn Văn A">Nguyễn Văn A (Bằng FC - Kinh nghiệm 8 năm)</option>
                <option value="Trần Văn B">Trần Văn B (Bằng FC - Kinh nghiệm 5 năm)</option>
                <option value="Phạm Văn D">Phạm Văn D (Bằng FC - Kinh nghiệm 6 năm)</option>
                <option value="Lê Văn C">Lê Văn C (Bằng FE - Chuyên xe Lạnh)</option>
                <option value="Hoàng Văn E">Hoàng Văn E (Bằng FC - Kinh nghiệm 4 năm)</option>
              </select>
              <span className="text-[10px] text-slate font-sans block">Dispatcher có thể giữ tài xế mặc định hoặc chọn tài xế khác nhận lệnh này.</span>
            </div>
          )}

          {/* CONFIRM DISPATCH TRIGGER BUTTON */}
          <button
            disabled={!selectedVehicleForTask}
            onClick={() => setShowConfirmModal(true)}
            className={`w-full h-12 rounded-full font-extrabold text-xs transition-opacity shadow-lg flex items-center justify-center gap-2 ${
              selectedVehicleForTask ? 'bg-signal-orange text-white hover:opacity-95' : 'bg-chalk text-slate cursor-not-allowed'
            }`}
          >
            <span className="material-symbols-outlined text-base">alt_route</span>
            XÁC NHẬN ĐIỀU PHỐI (CONFIRM DISPATCH)
          </button>

        </div>

      </div>

      {/* BOTTOM PANEL: ACTIVE RUNNING DISPATCHES & PROGRESS TIMELINE & REASSIGN */}
      <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
        
        <div className="flex justify-between items-center border-b border-chalk pb-3">
          <div>
            <h3 className="font-heading text-xl font-extrabold text-carbon">Nhiệm Vụ Đang Thực Hiện (Active Dispatches)</h3>
            <p className="text-xs text-slate font-mono mt-0.5">Theo dõi quá trình vận chuyển container thời gian thực</p>
          </div>
          <span className="text-xs font-bold text-carbon font-mono">{activeDispatches.length} Lệnh đang chạy</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activeDispatches.map(dsp => (
            <div
              key={dsp.dspId}
              onClick={() => setSelectedActiveDispatchTimeline(dsp)}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-3 font-mono text-xs ${
                dsp.status === 'DELAYED'
                  ? 'border-red-400 bg-red-50/80 shadow-md animate-pulse'
                  : 'border-chalk bg-fog/40 hover:border-slate'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-slate block">{dsp.dspId}</span>
                  <strong className="text-base text-carbon">{dsp.vehicle} ({dsp.plate})</strong>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${dsp.statusClass}`}>
                  ● {dsp.statusLabel}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-chalk space-y-1 font-sans">
                <div className="font-bold text-carbon">Container: {dsp.container}</div>
                <div className="text-slate text-[11px]">Từ: <strong>{dsp.origin}</strong> ➔ Đến: <strong className="text-signal-orange">{dsp.destination}</strong></div>
                <div className="text-[10px] text-slate font-mono pt-1">Gate Booking: <strong>{dsp.gateBookingId}</strong></div>
              </div>

              <div className="flex justify-between items-center pt-1 font-sans">
                <span className="text-slate text-[11px]">Dự kiến: {dsp.eta}</span>
                {dsp.status === 'DELAYED' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowReassignModal(true)
                    }}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold text-[11px] hover:bg-red-700 transition-colors shadow"
                  >
                    🔄 Tái Chỉ Định Xe
                  </button>
                ) : (
                  <span className="text-signal-orange font-bold text-[11px]">Xem Timeline ➔</span>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* DISPATCH CONFIRMATION MODAL & AUTOMATIC GATE BOOKING CREATION */}
      {showConfirmModal && selectedVehicleForTask && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">DISPATCH CONFIRMATION</span>
                <h3 className="font-heading text-2xl font-extrabold text-carbon">Xác Nhận Phát Lệnh Điều Động</h3>
              </div>
              <button onClick={() => setShowConfirmModal(false)} className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="bg-fog p-5 rounded-2xl border border-chalk space-y-3 font-mono text-xs">
              <div className="flex justify-between"><span className="text-slate font-sans">Nhiệm vụ:</span><strong className="text-carbon font-bold">{selectedTask.taskTypeName}</strong></div>
              <div className="flex justify-between"><span className="text-slate font-sans">Mã Container:</span><strong className="text-carbon font-bold">{selectedTask.container}</strong></div>
              <div className="flex justify-between"><span className="text-slate font-sans">Phương tiện chọn:</span><strong className="text-signal-orange font-bold">{selectedVehicleForTask.id} ({selectedVehicleForTask.plate})</strong></div>
              <div className="flex justify-between"><span className="text-slate font-sans">Tài xế phụ trách:</span><strong className="text-carbon font-bold">{selectedVehicleForTask.driver}</strong></div>
              <div className="flex justify-between"><span className="text-slate font-sans">Điểm xuất phát:</span><strong className="text-carbon font-sans">{selectedTask.origin}</strong></div>
              <div className="flex justify-between"><span className="text-slate font-sans">Điểm đến:</span><strong className="text-signal-orange font-sans font-bold">{selectedTask.destination}</strong></div>
              <div className="flex justify-between border-t border-chalk pt-2"><span className="text-slate font-sans font-bold text-green-700">Tự động liên kết:</span><strong className="text-green-700 font-bold">Gate Booking (Kèm theo)</strong></div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 h-12 rounded-full border border-chalk font-bold text-xs hover:bg-fog transition-colors"
              >
                Hủy bỏ (Cancel)
              </button>

              <button
                onClick={handleExecuteDispatch}
                className="flex-1 h-12 bg-signal-orange text-white rounded-full font-extrabold text-xs hover:opacity-95 transition-opacity shadow-lg"
              >
                XÁC NHẬN ĐIỀU PHỐI
              </button>
            </div>

          </div>
        </div>
      )}

      {/* REASSIGN VEHICLE MODAL (KHI GẶP SỰ CỐ XE TRỄ HẠN) */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">REASSIGN VEHICLE</span>
                <h3 className="font-heading text-2xl font-extrabold text-carbon">Tái Chỉ Định Xe Thay Thế</h3>
              </div>
              <button onClick={() => setShowReassignModal(false)} className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs font-mono space-y-1">
              <strong className="text-red-900 font-bold block">🔴 LỆNH ĐANG TRỄ HẠN: TRK-008 (MSCU9876543)</strong>
              <p className="text-[11px] text-red-800 font-sans">Lý do: Kẹt thủ tục tại Cổng 01. Vui lòng chọn xe thay thế ngay để giải phóng container.</p>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <span className="text-[10px] font-bold text-slate uppercase block font-sans">DANH SÁCH XE ROAD TRUCK SẴN SÀNG THAY THẾ:</span>
              {allFleetVehicles.filter(v => v.type === 'ROAD_TRUCK' && v.status === 'AVAILABLE').map(veh => (
                <div key={veh.id} className="p-3 bg-fog rounded-xl border border-chalk flex justify-between items-center">
                  <div>
                    <strong className="text-carbon block">{veh.id} ({veh.plate})</strong>
                    <span className="text-[10px] text-slate font-sans">Tài xế: {veh.driver} • ETA: {veh.eta}</span>
                  </div>
                  <button
                    onClick={() => handleConfirmReassign(veh)}
                    className="px-3 py-1.5 bg-signal-orange text-white rounded-lg font-bold text-[11px] hover:opacity-90 transition-opacity"
                  >
                    Gán Xe Này
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowReassignModal(false)}
              className="w-full h-11 border border-chalk rounded-full text-slate font-bold text-xs hover:bg-fog"
            >
              Hủy bỏ
            </button>

          </div>
        </div>
      )}

      {/* DISPATCH TIMELINE MODAL */}
      {selectedActiveDispatchTimeline && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">DISPATCH TIMELINE</span>
                <h3 className="font-heading text-2xl font-extrabold text-carbon">{selectedActiveDispatchTimeline.dspId}</h3>
                <span className="text-xs text-slate font-mono block mt-0.5">{selectedActiveDispatchTimeline.vehicle} • {selectedActiveDispatchTimeline.container}</span>
              </div>
              <button onClick={() => setSelectedActiveDispatchTimeline(null)} className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs pl-2 border-l-2 border-chalk">
              <div className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                <span className="text-carbon font-bold">1. Đã khởi tạo nhiệm vụ (Task Created)</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                <span className="text-carbon font-bold">2. Đã chỉ định xe ({selectedActiveDispatchTimeline.vehicle})</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                <span className="text-carbon font-bold">3. Xác nhận điều động (Dispatch Confirmed)</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                <span className="text-carbon font-bold">4. Tự động tạo Gate Booking ({selectedActiveDispatchTimeline.gateBookingId})</span>
              </div>

              <div className="flex items-center gap-3">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedActiveDispatchTimeline.timelineStep >= 5 ? 'bg-purple-600 text-white animate-pulse' : 'bg-chalk text-slate'}`}>●</span>
                <span className={`font-bold ${selectedActiveDispatchTimeline.timelineStep >= 5 ? 'text-purple-600' : 'text-slate'}`}>5. Xe đang di chuyển lưu thông</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-chalk text-slate flex items-center justify-center text-[10px] font-bold">○</span>
                <span className="text-slate">6. Xe đã đến vị trí dỡ</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-chalk text-slate flex items-center justify-center text-[10px] font-bold">○</span>
                <span className="text-slate">7. Hoàn tất dỡ container</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedActiveDispatchTimeline(null)}
              className="w-full h-11 bg-carbon text-white rounded-full font-bold text-xs hover:bg-black"
            >
              Đóng lại
            </button>

          </div>
        </div>
      )}

      {/* CREATE DISPATCH TASK MODAL */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 font-sans">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <div>
                <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">DISPATCH MANAGEMENT</span>
                <h3 className="font-heading text-xl font-extrabold text-carbon">Tạo Yêu Cầu Điều Phối Xe Mới</h3>
              </div>
              <button onClick={() => setShowCreateTaskModal(false)} className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate uppercase text-[10px] mb-1">Loại Nhiệm Vụ *</label>
                <select
                  value={newTaskForm.taskType}
                  onChange={e => {
                    const tType = e.target.value
                    let origin = newTaskForm.origin
                    let dest = newTaskForm.destination
                    let reqVeh = 'ROAD_TRUCK'

                    if (tType === 'PORT_DELIVERY') {
                      origin = 'Kho Hòa Cầm - Đà Nẵng'
                      dest = 'Cảng Tiên Sa (Bãi Khối A)'
                    } else if (tType === 'PORT_PICKUP') {
                      origin = 'Cảng Tiên Sa (Bãi Khối B)'
                      dest = 'Kho Depot Tân Cảng'
                    } else {
                      origin = 'Khối bãi A'
                      dest = 'Khối bãi B (RTG-02)'
                      reqVeh = 'YARD_TRACTOR'
                    }

                    setNewTaskForm({
                      ...newTaskForm,
                      taskType: tType,
                      origin,
                      destination: dest,
                      requiredVehicleType: reqVeh
                    })
                  }}
                  className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange font-bold"
                >
                  <option value="PORT_DELIVERY">🚛 Giao Container Về Cảng (Port Delivery - Kho ➔ Cảng)</option>
                  <option value="PORT_PICKUP">🚚 Lấy Container Tại Cảng (Port Pickup - Cảng ➔ Kho)</option>
                  <option value="YARD_MOVE">🚜 Chuyển Container Nội Bãi (Yard Move - Bãi A ➔ Bãi B)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate uppercase text-[10px] mb-1">Mã Container *</label>
                  <input
                    type="text"
                    value={newTaskForm.container}
                    onChange={e => setNewTaskForm({ ...newTaskForm, container: e.target.value.toUpperCase() })}
                    required
                    placeholder="MSCU1234567"
                    className="w-full px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon font-mono focus:outline-none focus:border-signal-orange uppercase font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate uppercase text-[10px] mb-1">Loại Container</label>
                  <select
                    value={newTaskForm.containerType}
                    onChange={e => setNewTaskForm({ ...newTaskForm, containerType: e.target.value })}
                    className="w-full px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
                  >
                    <option value="40ft HC">40ft High Cube</option>
                    <option value="20ft Dry">20ft Standard Dry</option>
                    <option value="40ft Reefer">40ft Reefer (Container Lạnh)</option>
                    <option value="45ft HC">45ft High Cube</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate uppercase text-[10px] mb-1">Điểm Đi (Origin) *</label>
                <input
                  type="text"
                  value={newTaskForm.origin}
                  onChange={e => setNewTaskForm({ ...newTaskForm, origin: e.target.value })}
                  required
                  placeholder="Ví dụ: Kho Hòa Cầm / Depot Liên Chiểu"
                  className="w-full px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange font-bold"
                />
              </div>

              <div>
                <label className="block text-slate uppercase text-[10px] mb-1">Điểm Đến (Destination) *</label>
                <input
                  type="text"
                  value={newTaskForm.destination}
                  onChange={e => setNewTaskForm({ ...newTaskForm, destination: e.target.value })}
                  required
                  placeholder="Ví dụ: Cảng Tiên Sa (Bãi Khối A)"
                  className="w-full px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange font-bold text-signal-orange"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate uppercase text-[10px] mb-1">Mức Ưu Tiên</label>
                  <select
                    value={newTaskForm.priority}
                    onChange={e => setNewTaskForm({ ...newTaskForm, priority: e.target.value })}
                    className="w-full px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
                  >
                    <option value="HIGH">🔴 Cao (High Priority)</option>
                    <option value="NORMAL">🔵 Bình thường (Normal)</option>
                    <option value="LOW">⚪ Thấp (Low Priority)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate uppercase text-[10px] mb-1">Loại Xe Yêu Cầu</label>
                  <select
                    value={newTaskForm.requiredVehicleType}
                    onChange={e => setNewTaskForm({ ...newTaskForm, requiredVehicleType: e.target.value })}
                    className="w-full px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
                  >
                    <option value="ROAD_TRUCK">🚚 Xe Đầu Kéo Đường Dài</option>
                    <option value="YARD_TRACTOR">🚜 Xe Đầu Kéo Nội Bãi</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTaskModal(false)}
                  className="flex-1 h-11 border border-chalk rounded-xl font-bold hover:bg-fog text-slate"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 h-11 bg-signal-orange text-white font-extrabold rounded-xl hover:opacity-95 shadow-md"
                >
                  Tạo Nhiệm Vụ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
