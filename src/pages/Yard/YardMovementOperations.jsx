import React, { useState } from 'react'

// Helpers to parse position string "A-03-12-2" → { block, bay, row, tier }
const parsePosition = (pos) => {
  if (!pos || !pos.includes('-')) return { block: pos, bay: '?', row: '?', tier: '?' }
  const parts = pos.split('-')
  return {
    block: parts[0] || '?',
    bay: parts[1] || '?',
    row: parts[2] || '?',
    tier: parts[3] || '?',
  }
}

// Flow Steps
const TASK_FLOW = ['PENDING', 'IN PROGRESS', 'TẠI VỊ TRÍ ĐÍCH', 'COMPLETED']

// Yard Equipment Options
const EQUIPMENT_LIST = [
  { id: 'RTG-001', name: 'RTG-001', operator: 'Trần Văn Hùng', status: 'Sẵn sàng' },
  { id: 'RTG-003', name: 'RTG-003', operator: 'Lê Văn Thành', status: 'Sẵn sàng' },
  { id: 'RTG-005', name: 'RTG-005', operator: 'Nguyễn Văn B', status: 'Đang bận' },
  { id: 'RS-001',  name: 'Reach Stacker RS-001', operator: 'Phạm Văn An', status: 'Sẵn sàng' },
]

const INCIDENT_REASONS = [
  'Không tìm thấy container tại vị trí gốc',
  'RTG / Cẩu bị hỏng, không hoạt động',
  'Vị trí đích đã bị container khác chiếm',
  'Không thể tiếp cận container (vật cản đường đi)',
  'Container bị hư hỏng nặng, không thể di chuyển',
  'Lệnh bị trùng lặp / đã thực hiện trước đó',
  'Lý do khác',
]

export default function YardMovementOperations() {
  const [toastMessage, setToastMessage] = useState('')

  // Top KPI Stats
  const [kpiStats] = useState({
    pending: '6 Lệnh',
    inProgress: '2 Lệnh',
    completedToday: '18 Lệnh',
    highPriority: '3 Lệnh 🟠',
  })

  // Movement Tasks List — enriched with equipment & flow step
  const [tasks, setTasks] = useState([
    {
      id: 'MOV-1024',
      containerId: 'MSCU1234567',
      from: 'A-03-12-2',
      to: 'B-02-08-3',
      reason: 'Tái cơ cấu xếp bãi',
      priority: 'HIGH',
      assignedBy: 'Operator - Nguyễn Văn Q',
      status: 'PENDING',
      flowStep: 0,           // index into TASK_FLOW
      equipment: null,       // selected equipment object
      confirmedPos: '',      // actual final position confirmed by staff
    },
    {
      id: 'MOV-1025',
      containerId: 'TEMU8822190',
      from: 'B-01-02-1',
      to: 'KHU-XUẤT-CỔNG',
      reason: 'Chuẩn bị xuất cổng khẩn',
      priority: 'CRITICAL',
      assignedBy: 'Operator - Nguyễn Văn Q',
      status: 'PENDING',
      flowStep: 0,
      equipment: null,
      confirmedPos: '',
    },
    {
      id: 'MOV-1022',
      containerId: 'CMAU9918234',
      from: 'A-01-05-3',
      to: 'A-01-01-1',
      reason: 'Đảo tầng cẩu bãi',
      priority: 'MEDIUM',
      assignedBy: 'Điều phối viên',
      status: 'IN PROGRESS',
      flowStep: 1,
      equipment: EQUIPMENT_LIST[0],
      confirmedPos: '',
    },
  ])

  // Active Task Panel
  const [activeTask, setActiveTask] = useState(null)
  const [confirmedPosInput, setConfirmedPosInput] = useState('')

  // Incident Report Modal
  const [incidentTask, setIncidentTask] = useState(null)
  const [incidentReason, setIncidentReason] = useState(INCIDENT_REASONS[0])
  const [incidentNotes, setIncidentNotes] = useState('')

  // Mini Map modal
  const [mapViewTask, setMapViewTask] = useState(null)

  // Stacking Conflict Dataset
  const [stackingConflict, setStackingConflict] = useState({
    targetContainer: 'CAIU1234567',
    currentPosition: 'C-04-10-1 (Tầng 1)',
    containersBlocking: 2,
    blockingContainers: [
      { step: 1, id: 'MSCU1111111', tier: 'Tầng 3', moveTarget: 'C-04-12-1' },
      { step: 2, id: 'MSCU2222222', tier: 'Tầng 2', moveTarget: 'C-04-12-2' },
    ],
    recommendedOrder: [
      '1 ➔ MSCU1111111 (Di chuyển sang C-04-12-1)',
      '2 ➔ MSCU2222222 (Di chuyển sang C-04-12-2)',
      '3 ➔ CAIU1234567 (Giải phóng container mục tiêu xuất cảng)',
    ],
    planStarted: false,
  })

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // Advance task one flow step (PENDING → IN PROGRESS → TẠI VỊ TRÍ ĐÍCH → COMPLETED)
  const advanceFlow = (taskId, nextStep) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t
      const nextStatus = TASK_FLOW[nextStep]
      const updated = { ...t, flowStep: nextStep, status: nextStatus }
      if (nextStep === 1) setActiveTask(updated)
      if (nextStep === 3) {
        updated.status = 'COMPLETED'
        setActiveTask(null)
      }
      return updated
    }))
  }

  // Handle "Bắt đầu lệnh" — opens active panel, picks first available RTG
  const handleStartTask = (task) => {
    const firstAvail = EQUIPMENT_LIST.find(e => e.status === 'Sẵn sàng') || EQUIPMENT_LIST[0]
    const updated = { ...task, flowStep: 1, status: 'IN PROGRESS', equipment: firstAvail }
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    setActiveTask(updated)
    setConfirmedPosInput(task.to)
    showToast(`⚡ ĐÃ BẮT ĐẦU TASK ${task.id} — Thiết bị: ${firstAvail.name} (${firstAvail.operator}). Đang vận hành cẩu gắp container ${task.containerId}.`)
  }

  // Handle "Đã đến vị trí đích"
  const handleMarkArrived = (task) => {
    const updated = { ...task, flowStep: 2, status: 'TẠI VỊ TRÍ ĐÍCH' }
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    setActiveTask(updated)
    showToast(`📍 TASK ${task.id}: Container ${task.containerId} đã đến vị trí đích [${task.to}]. Đang chờ xác nhận hạ container.`)
  }

  // Handle "Xác nhận hoàn thành" — final step
  const handleConfirmComplete = (task) => {
    const finalPos = confirmedPosInput || task.to
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, flowStep: 3, status: 'COMPLETED', confirmedPos: finalPos } : t))
    setActiveTask(null)
    showToast(`🟢 ĐÃ HOÀN THÀNH TASK ${task.id}: Container ${task.containerId} đặt tại vị trí thực tế [${finalPos}]! Hệ thống đã cập nhật vị trí mới.`)
  }

  // Handle "Báo sự cố"
  const handleSubmitIncident = (e) => {
    e.preventDefault()
    showToast(`🚨 ĐÃ GỬI BÁO CÁO SỰ CỐ TASK ${incidentTask?.id}: "${incidentReason}". Operator đã nhận thông báo tức thì!`)
    setTasks(prev => prev.map(t => t.id === incidentTask?.id ? { ...t, status: 'INCIDENT', flowStep: -1 } : t))
    setActiveTask(null)
    setIncidentTask(null)
    setIncidentNotes('')
  }

  // Assign equipment to active task
  const handleAssignEquipment = (equipId) => {
    const eq = EQUIPMENT_LIST.find(e => e.id === equipId)
    if (!eq || !activeTask) return
    setTasks(prev => prev.map(t => t.id === activeTask.id ? { ...t, equipment: eq } : t))
    setActiveTask(prev => ({ ...prev, equipment: eq }))
    showToast(`🏗️ ĐÃ GÁN THIẾT BỊ ${eq.name} (Thợ điều khiển: ${eq.operator}) cho Task ${activeTask.id}.`)
  }

  const renderPriorityBadge = (prio) => {
    const map = {
      'LOW': 'bg-emerald-100 text-emerald-950 border-emerald-400',
      'MEDIUM': 'bg-amber-100 text-amber-950 border-amber-400',
      'HIGH': 'bg-orange-100 text-orange-950 border-orange-400',
      'CRITICAL': 'bg-red-200 text-red-950 border-red-500',
    }
    const label = {
      'LOW': '🟢 THẤP', 'MEDIUM': '🟡 TRUNG BÌNH', 'HIGH': '🟠 CAO', 'CRITICAL': '🔴 RẤT NGHIÊM TRỌNG',
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full border font-black text-[10px] font-mono ${map[prio] || 'bg-slate-100 text-slate-800 border-slate-300'}`}>
        {label[prio] || prio}
      </span>
    )
  }

  const renderStatusBadge = (task) => {
    const cfg = {
      'PENDING':          { cls: 'bg-amber-100 text-amber-950 border-amber-400',   lbl: '🟡 ĐANG CHỜ' },
      'IN PROGRESS':      { cls: 'bg-blue-100 text-blue-950 border-blue-400',      lbl: '⚡ ĐANG DI CHUYỂN' },
      'TẠI VỊ TRÍ ĐÍCH': { cls: 'bg-purple-100 text-purple-950 border-purple-400', lbl: '📍 TẠI VỊ TRÍ ĐÍCH' },
      'COMPLETED':        { cls: 'bg-emerald-100 text-emerald-950 border-emerald-400', lbl: '✓ HOÀN THÀNH' },
      'INCIDENT':         { cls: 'bg-red-200 text-red-950 border-red-500',          lbl: '🚨 SỰ CỐ' },
    }
    const c = cfg[task.status] || cfg['PENDING']
    return <span className={`px-2.5 py-0.5 rounded-full border font-black text-[10px] font-mono ${c.cls}`}>{c.lbl}</span>
  }

  // Position detail block renderer
  const PositionDetail = ({ label, pos, color = 'text-slate-900' }) => {
    const p = parsePosition(pos)
    return (
      <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 space-y-2">
        <span className="text-[10px] text-slate-500 uppercase font-sans font-extrabold block">{label}</span>
        <div className={`font-black text-base font-mono ${color}`}>{pos}</div>
        <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
          {[['Khu', p.block], ['Dãy (Bay)', p.bay], ['Hàng (Row)', p.row], ['Tầng (Tier)', p.tier]].map(([k, v]) => (
            <div key={k} className="bg-white rounded border border-slate-200 p-1.5 text-center">
              <div className="text-slate-500 font-sans">{k}</div>
              <div className="font-black text-slate-900">{v}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen text-slate-900 relative">

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-amber-100 text-amber-950 border-2 border-amber-400 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-3 z-[100] animate-bounce">
          <span className="text-amber-600">●</span>{toastMessage}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs font-mono">
            <span className="font-heading font-black text-orange-600 tracking-wider">NEXUSPORT</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 font-bold">Khai Thác Bãi</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-extrabold">Lệnh Di Chuyển Container</span>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-3xl font-black text-slate-900">Lệnh Di Chuyển Container</h2>
            <span className="px-3.5 py-1 bg-orange-100 text-orange-950 border-2 border-orange-400 font-mono font-black text-xs rounded-xl">LỆNH ĐẢO CHUYỂN BÃI</span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">Quản lý và thực hiện các lệnh di chuyển container từ Operator/Dispatcher, gỡ xung đột xếp tầng, theo dõi trạng thái thiết bị cẩu.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-emerald-700 uppercase font-sans font-black">TRỰC TUYẾN (LIVE)</span>
        </div>
      </div>

      {/* ── TOP KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Lệnh Chờ Đảo', val: kpiStats.pending, sub: 'Đang chờ thực hiện', border: 'border-slate-200', txt: 'text-amber-950' },
          { label: 'Đang Di Chuyển', val: kpiStats.inProgress, sub: 'Đang đảo bãi', border: 'border-blue-300', txt: 'text-blue-950' },
          { label: 'Hoàn Thành Hôm Nay', val: kpiStats.completedToday, sub: 'Hoàn thành trong ca', border: 'border-emerald-300', txt: 'text-emerald-950' },
          { label: 'Ưu Tiên Cao', val: kpiStats.highPriority, sub: 'Cần xử lý trước', border: 'border-orange-300', txt: 'text-orange-950' },
        ].map(c => (
          <div key={c.label} className={`bg-white p-4 rounded-2xl border-2 ${c.border} shadow-sm space-y-1`}>
            <span className="text-[10px] text-slate-500 uppercase font-sans font-extrabold block">{c.label}</span>
            <strong className={`text-2xl font-black font-mono block ${c.txt}`}>{c.val}</strong>
            <span className="text-[10px] text-slate-600 font-bold font-sans">{c.sub}</span>
          </div>
        ))}
      </div>

      {/* ── ACTIVE TASK EXECUTION PANEL ── */}
      {activeTask && (
        <div className="bg-blue-50 border-2 border-blue-400 rounded-2xl p-6 shadow-md space-y-5">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-blue-200 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-2xl">precision_manufacturing</span>
              <h3 className="font-heading text-lg font-black text-blue-950">ĐANG THỰC HIỆN: {activeTask.id}</h3>
            </div>
            <div className="flex items-center gap-2">
              {renderStatusBadge(activeTask)}
              <button onClick={() => { setIncidentTask(activeTask) }}
                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-400 font-black text-xs rounded-xl cursor-pointer transition-all flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">report_problem</span>
                Báo Sự Cố
              </button>
            </div>
          </div>

          {/* Flow Step Progress Bar */}
          <div className="flex items-center gap-0 font-mono text-[10px] font-black">
            {['Đang Chờ', 'Đang Thực Hiện', 'Tại Vị Trí Đích', 'Hoàn Thành'].map((stepLabel, idx) => (
              <React.Fragment key={idx}>
                <div className={`flex-1 py-2 px-1 text-center rounded-lg border-2 transition-all ${
                  activeTask.flowStep === idx
                    ? 'bg-blue-600 text-white border-blue-700 shadow-md'
                    : activeTask.flowStep > idx
                      ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                      : 'bg-white text-slate-400 border-slate-200'
                }`}>
                  {activeTask.flowStep > idx ? '✓ ' : ''}{stepLabel}
                </div>
                {idx < 3 && <div className="w-4 h-0.5 bg-slate-300 flex-shrink-0" />}
              </React.Fragment>
            ))}
          </div>

          {/* 3-Column: Positions + Equipment + Confirm */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Position Detail — From & To */}
            <div className="space-y-3">
              <PositionDetail label="VỊ TRÍ GỐC (TỪ)" pos={activeTask.from} color="text-blue-900" />
              <PositionDetail label="VỊ TRÍ ĐÍCH (ĐẾN)" pos={activeTask.to} color="text-emerald-900" />
              <button onClick={() => setMapViewTask(activeTask)}
                className="w-full py-2.5 bg-blue-100 hover:bg-blue-200 text-blue-950 border-2 border-blue-400 rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all">
                <span className="material-symbols-outlined text-sm">map</span>
                [ 🗺️ XEM TRÊN SƠ ĐỒ BÃI 2D ]
              </button>
            </div>

            {/* Equipment Assignment */}
            <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 space-y-3">
              <div className="text-xs font-black text-slate-900 uppercase font-mono border-b border-slate-200 pb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-orange-600 text-base">forklift</span>
                THIẾT BỊ THỰC HIỆN
              </div>

              {activeTask.equipment ? (
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-3 bg-orange-50 border-2 border-orange-300 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center">
                      <strong className="text-orange-950 font-black text-base">{activeTask.equipment.name}</strong>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                        activeTask.equipment.status === 'Sẵn sàng'
                          ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                          : 'bg-amber-100 text-amber-950 border-amber-400'
                      }`}>
                        {activeTask.equipment.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-700 font-sans font-bold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-slate-500">person</span>
                      Thợ điều khiển: <strong className="text-slate-900">{activeTask.equipment.operator}</strong>
                    </div>
                  </div>

                  <select onChange={e => handleAssignEquipment(e.target.value)} defaultValue=""
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:outline-none">
                    <option value="" disabled>Đổi thiết bị khác...</option>
                    {EQUIPMENT_LIST.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.name} — {eq.operator} ({eq.status})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-slate-600 font-sans">Chưa gán thiết bị. Vui lòng chọn:</div>
                  <select onChange={e => handleAssignEquipment(e.target.value)} defaultValue=""
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:outline-none">
                    <option value="" disabled>Chọn RTG / Reach Stacker...</option>
                    {EQUIPMENT_LIST.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.name} — {eq.operator} ({eq.status})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-1 space-y-1 font-mono text-[10px] text-slate-500 border-t border-slate-100">
                <div className="font-sans font-bold text-[11px] text-slate-700">Lý do di chuyển:</div>
                <div className="text-slate-800 font-sans">{activeTask.reason}</div>
                <div className="font-bold text-slate-600">Gán bởi: {activeTask.assignedBy}</div>
              </div>
            </div>

            {/* Confirm / Advance Flow */}
            <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 space-y-3 flex flex-col justify-between">
              <div className="text-xs font-black text-slate-900 uppercase font-mono border-b border-slate-200 pb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-600 text-base">task_alt</span>
                TIẾN TRÌNH THỰC HIỆN
              </div>

              {activeTask.flowStep === 1 && (
                <div className="space-y-3 font-sans text-xs">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 font-bold">
                    ⚡ RTG đang cẩu container. Khi đã đến vị trí đích, nhấn tiếp theo.
                  </div>
                  <button onClick={() => handleMarkArrived(activeTask)}
                    className="w-full py-3 bg-purple-100 hover:bg-purple-200 text-purple-950 border-2 border-purple-400 rounded-xl font-black text-xs cursor-pointer transition-all flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-base">location_on</span>
                    [ ĐÃ ĐẾN VỊ TRÍ ĐÍCH ]
                  </button>
                </div>
              )}

              {activeTask.flowStep === 2 && (
                <div className="space-y-3 font-sans text-xs">
                  <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 font-bold text-[11px]">
                    📍 Container đã tới vị trí đích. Nhập vị trí thực tế hạ container và xác nhận.
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Vị Trí Hạ Container Thực Tế *</label>
                    <input type="text" value={confirmedPosInput} onChange={e => setConfirmedPosInput(e.target.value.toUpperCase())}
                      placeholder="VD: B-02-08-3"
                      className="w-full px-3 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-mono font-black text-sm uppercase focus:outline-none focus:border-slate-900" />
                  </div>
                  <button onClick={() => handleConfirmComplete(activeTask)}
                    className="w-full py-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-2 border-emerald-400 rounded-xl font-black text-xs cursor-pointer transition-all flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    [ XÁC NHẬN HOÀN THÀNH & HẠ CONTAINER ]
                  </button>
                </div>
              )}

              {activeTask.flowStep < 1 && (
                <div className="text-xs text-slate-500 font-sans text-center py-4">Đang khởi động lệnh...</div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── SECTION "DANH SÁCH LỆNH DI CHUYỂN" ── */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-600">swap_horiz</span>
            DANH SÁCH LỆNH DI CHUYỂN CONTAINER
          </h3>
          <span className="text-xs font-mono font-bold text-slate-500">{tasks.length} Lệnh từ Điều phối</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                {['Mã Lệnh', 'Container', 'Vị Trí Gốc → Vị Trí Đích', 'Lý Do', 'Thiết Bị', 'Ưu Tiên', 'Trạng Thái', 'Thao Tác'].map(h => (
                  <th key={h} className={`py-3.5 px-3 ${h === 'Thao Tác' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {tasks.map(task => {
                const fromP = parsePosition(task.from)
                const toP = parsePosition(task.to)
                return (
                  <tr key={task.id} className={`hover:bg-slate-100/60 ${task.status === 'INCIDENT' ? 'bg-red-50' : ''}`}>

                    <td className="py-3.5 px-3 font-black text-slate-900 text-sm font-heading">{task.id}</td>

                    <td className="py-3.5 px-3 font-black text-blue-900">{task.containerId}</td>

                    {/* Positions with mini breakdown */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="text-center">
                          <div className="font-black text-amber-800 text-xs">{task.from}</div>
                          <div className="text-[9px] text-slate-500">Khu {fromP.block} · Bay {fromP.bay} · T{fromP.tier}</div>
                        </div>
                        <span className="text-slate-400 font-black text-base">➔</span>
                        <div className="text-center">
                          <div className="font-black text-emerald-800 text-xs">{task.to}</div>
                          <div className="text-[9px] text-slate-500">Khu {toP.block} · Bay {toP.bay} · T{toP.tier}</div>
                        </div>
                        <button onClick={() => setMapViewTask(task)}
                          className="ml-1 p-1 bg-blue-100 text-blue-950 border border-blue-300 rounded-lg text-[10px] font-black cursor-pointer hover:bg-blue-200 transition-all" title="Xem trên bản đồ 2D">
                          🗺️
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 font-sans font-bold text-slate-700 max-w-[120px] truncate" title={task.reason}>
                      {task.reason}
                    </td>

                    {/* Equipment column */}
                    <td className="py-3.5 px-3 font-sans">
                      {task.equipment ? (
                        <div>
                          <div className="font-black text-orange-900 text-[11px]">{task.equipment.name}</div>
                          <div className="text-[10px] text-slate-500">{task.equipment.operator}</div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic font-sans">Chưa gán</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 font-sans">{renderPriorityBadge(task.priority)}</td>

                    <td className="py-3.5 px-3 font-sans">{renderStatusBadge(task)}</td>

                    <td className="py-3.5 px-3 text-right font-sans">
                      <div className="flex justify-end gap-1.5">
                        {task.status === 'PENDING' && (
                          <button onClick={() => handleStartTask(task)}
                            className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-950 border-2 border-orange-400 font-black text-xs rounded-xl cursor-pointer transition-all">
                            [ BẮT ĐẦU ]
                          </button>
                        )}
                        {task.status === 'IN PROGRESS' && (
                          <button onClick={() => setActiveTask(task)}
                            className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-950 border border-blue-400 font-black text-xs rounded-xl cursor-pointer transition-all">
                            Xem Panel ↑
                          </button>
                        )}
                        {task.status === 'TẠI VỊ TRÍ ĐÍCH' && (
                          <button onClick={() => setActiveTask(task)}
                            className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-950 border border-purple-400 font-black text-xs rounded-xl cursor-pointer transition-all">
                            Xác Nhận ↑
                          </button>
                        )}
                        {task.status === 'COMPLETED' && (
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-950 border border-emerald-400 rounded-xl text-xs font-black">✓ Hoàn thành</span>
                        )}
                        {task.status === 'INCIDENT' && (
                          <span className="px-3 py-1 bg-red-100 text-red-950 border border-red-400 rounded-xl text-xs font-black">🚨 Sự cố</span>
                        )}
                        {/* Always show incident button for active tasks */}
                        {(task.status === 'PENDING' || task.status === 'IN PROGRESS' || task.status === 'TẠI VỊ TRÍ ĐÍCH') && (
                          <button onClick={() => setIncidentTask(task)}
                            className="px-2 py-1.5 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-400 font-black text-xs rounded-xl cursor-pointer transition-all" title="Báo sự cố">
                            🚨
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION "QUY TRÌNH ĐẢO CHUYỂN GỠ XUNG ĐỘT TẦNG" ── */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-600">layers_clear</span>
            QUY TRÌNH ĐẢO CHUYỂN GỠ XUNG ĐỘT TẦNG CONTAINER
          </h3>
          <span className="px-3 py-1 bg-purple-100 text-purple-950 border border-purple-400 rounded-full text-xs font-mono font-black">
            2 CONTAINER ĐANG ĐÈ TRÊN CONTAINER MỤC TIÊU
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-mono text-xs">
          <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 space-y-2">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Container Mục Tiêu Xuất Bãi</span>
            <strong className="text-purple-950 font-black text-lg block">{stackingConflict.targetContainer}</strong>
            <div className="text-slate-700 font-sans font-bold">Vị trí hiện tại: <strong className="text-orange-700">{stackingConflict.currentPosition}</strong></div>
            <div className="text-slate-700 font-sans font-bold">Số container chặn phía trên: <strong className="text-red-700 font-black text-sm">{stackingConflict.containersBlocking} container</strong></div>
          </div>

          <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 space-y-2">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Container Đang Đè Phía Trên</span>
            <div className="space-y-1.5 font-sans">
              {stackingConflict.blockingContainers.map(b => (
                <div key={b.id} className="p-2 bg-white rounded border border-slate-300 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-900 font-mono">{b.step}. {b.id} ({b.tier})</span>
                  <span className="text-blue-900 font-mono font-bold">➔ Di chuyển sang {b.moveTarget}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
            <div>
              <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block mb-1">Thứ Tự Đảo Chuyển Cẩu RTG Gợi Ý:</span>
              <div className="space-y-1.5 text-xs font-sans">
                {stackingConflict.recommendedOrder.map((ord, idx) => (
                  <div key={idx} className="p-2.5 bg-purple-50 rounded-lg border-l-4 border-purple-500 border border-purple-200 text-slate-900 font-bold">{ord}</div>
                ))}
              </div>
            </div>

            <button onClick={() => { setStackingConflict(prev => ({ ...prev, planStarted: true })); showToast('🏗️ CẨU RTG ĐÃ BẮT ĐẦU QUY TRÌNH ĐẢO CHUYỂN!') }}
              disabled={stackingConflict.planStarted}
              className={`w-full h-12 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all border-2 ${
                !stackingConflict.planStarted ? 'bg-purple-100 hover:bg-purple-200 text-purple-950 border-purple-400' : 'bg-emerald-100 text-emerald-950 border-emerald-400 cursor-default'
              }`}>
              <span className="material-symbols-outlined text-base">precision_manufacturing</span>
              {!stackingConflict.planStarted ? '[ BẮT ĐẦU QUY TRÌNH ĐẢO TẦNG ]' : '✓ QUY TRÌNH ĐẢO TẦNG ĐANG CHẠY'}
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL: BÁO SỰ CỐ ── */}
      {incidentTask && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 border-2 border-red-500 font-sans">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600 text-xl">report_problem</span>
                <h3 className="font-heading text-lg font-black text-slate-900">Báo Cáo Sự Cố Lệnh {incidentTask.id}</h3>
              </div>
              <button onClick={() => setIncidentTask(null)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitIncident} className="space-y-4 text-xs font-bold">
              <div className="grid grid-cols-2 gap-3 font-mono bg-red-50 p-3 rounded-xl border border-red-200">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-sans block">Mã Container</span>
                  <strong className="text-slate-900">{incidentTask.containerId}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-sans block">Vị Trí Gốc</span>
                  <strong className="text-amber-800">{incidentTask.from}</strong>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-2 font-extrabold">Lý Do Không Thể Thực Hiện *</label>
                <div className="space-y-1.5">
                  {INCIDENT_REASONS.map(r => (
                    <label key={r} className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all text-xs font-bold font-sans ${
                      incidentReason === r ? 'bg-red-100 border-red-400 text-red-950' : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                    }`}>
                      <input type="radio" name="incidentReason" value={r} checked={incidentReason === r} onChange={() => setIncidentReason(r)} className="accent-red-600" />
                      {r}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Ghi Chú Thêm</label>
                <textarea rows="2" value={incidentNotes} onChange={e => setIncidentNotes(e.target.value)}
                  placeholder="Mô tả chi tiết tình huống tại hiện trường..."
                  className="w-full p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-normal text-slate-900 focus:outline-none resize-none" />
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Ảnh Bằng Chứng (Tùy Chọn)</label>
                <div className="p-3 bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-500 font-medium">
                  <span className="material-symbols-outlined text-lg block text-slate-400">photo_camera</span>
                  Chụp ảnh hiện trường / Tải lên
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setIncidentTask(null)} className="flex-1 h-12 border border-slate-300 text-slate-700 rounded-xl font-extrabold text-xs hover:bg-slate-100">
                  Hủy Bỏ
                </button>
                <button type="submit" className="flex-1 h-12 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-500 rounded-xl font-black text-xs">
                  [ 🚨 GỬI BÁO CÁO SỰ CỐ ]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: XEM TRÊN SƠ ĐỒ BÃI 2D (mini-map) ── */}
      {mapViewTask && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl p-6 shadow-2xl space-y-4 border-2 border-blue-400 font-sans">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-xl">map</span>
                <h3 className="font-heading text-lg font-black text-slate-900">Sơ Đồ Bãi 2D — Lệnh {mapViewTask.id}</h3>
              </div>
              <button onClick={() => setMapViewTask(null)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Mini Map Visual */}
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 space-y-4">
              <div className="text-[10px] text-amber-400 font-mono font-black uppercase">SƠ ĐỒ DI CHUYỂN — Container: {mapViewTask.containerId}</div>

              <div className="grid grid-cols-5 gap-2 font-mono text-[10px] text-center">
                {['A-01', 'A-02', 'A-03', 'A-04', 'A-05'].map(cell => (
                  <div key={cell} className={`p-2.5 rounded-xl border-2 font-black ${
                    cell.includes(parsePosition(mapViewTask.from).bay)
                      ? 'bg-blue-500 text-white border-blue-300 shadow-lg shadow-blue-900/50 animate-pulse'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    {cell}
                    {cell.includes(parsePosition(mapViewTask.from).bay) && <div className="text-[9px] mt-0.5">📦 GỐC</div>}
                  </div>
                ))}

                <div className="col-span-5 flex items-center justify-center gap-2 py-2 text-slate-400 font-bold text-xs">
                  <span>Khu A</span>
                  <div className="flex-1 h-px bg-slate-700"></div>
                  <span>Khu B</span>
                </div>

                {['B-01', 'B-02', 'B-03', 'B-04', 'B-05'].map(cell => (
                  <div key={cell} className={`p-2.5 rounded-xl border-2 font-black ${
                    cell.includes(parsePosition(mapViewTask.to).bay)
                      ? 'bg-emerald-500 text-white border-emerald-300 shadow-lg shadow-emerald-900/50 animate-pulse'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    {cell}
                    {cell.includes(parsePosition(mapViewTask.to).bay) && <div className="text-[9px] mt-0.5">🎯 ĐÍCH</div>}
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center font-mono text-xs pt-2 border-t border-slate-700">
                <div className="bg-blue-900/40 border border-blue-400 px-3 py-2 rounded-xl">
                  <span className="text-blue-300 text-[10px] font-sans font-bold block">VỊ TRÍ GỐC</span>
                  <strong className="text-white">{mapViewTask.from}</strong>
                </div>
                <div className="text-slate-400 text-2xl font-black">➔</div>
                <div className="bg-emerald-900/40 border border-emerald-400 px-3 py-2 rounded-xl">
                  <span className="text-emerald-300 text-[10px] font-sans font-bold block">VỊ TRÍ ĐÍCH</span>
                  <strong className="text-white">{mapViewTask.to}</strong>
                </div>
              </div>
            </div>

            <div className="flex gap-3 font-sans text-xs">
              <button onClick={() => setMapViewTask(null)} className="flex-1 h-11 border border-slate-300 text-slate-700 rounded-xl font-extrabold hover:bg-slate-100">
                Đóng
              </button>
              <a href="/yard-staff/map"
                className="flex-1 h-11 bg-blue-100 hover:bg-blue-200 text-blue-950 border-2 border-blue-400 rounded-xl font-black flex items-center justify-center gap-1.5 transition-all">
                <span className="material-symbols-outlined text-base">open_in_new</span>
                Mở Sơ Đồ Bãi 2D Đầy Đủ
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
