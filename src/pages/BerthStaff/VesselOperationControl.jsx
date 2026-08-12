import React, { useState, useEffect, useMemo } from 'react'

export default function VesselOperationControl() {
  const [toastMessage, setToastMessage] = useState('')
  const [timeString, setTimeString] = useState('')

  // ── VESSEL STATE MACHINE ──────────────────────────────────────
  // States: 'APPROACHING' | 'BERTHED' | 'DISCHARGING' | 'COMPLETED'
  const [vesselState, setVesselState] = useState('APPROACHING')

  // Vessel Info Data
  const [vesselInfo, setVesselInfo] = useState({
    name: 'EVER GIVEN',
    imo: '9811000',
    berth: 'Cầu B-01',
    eta: '08:00',
    plannedEtd: '21:45',
    totalContainers: 1247,
    completedContainers: 0,
    remainingContainers: 1247,
    progressPercent: 0,
    berthStatus: 'OCCUPIED', // 'OCCUPIED' | 'AVAILABLE'
  })

  // Timeline Step Timestamps
  const [timeline, setTimeline] = useState({
    approaching: { completed: true, time: '08:00 - 12/08/2026' },
    berthed: { completed: false, time: 'Chưa cập bến' },
    discharging: { completed: false, time: 'Chưa bắt đầu' },
    completed: { completed: false, time: 'Chưa hoàn tất' },
  })

  // Approaching Checklist (Section 2)
  const [approachingChecklist, setApproachingChecklist] = useState({
    safelyPositioned: true,
    securelyBerthed: true,
    areaSafe: true,
  })

  // Discharging Plan & Crane Status (Section 3)
  const [hatchPlan] = useState([
    { name: 'Hầm Tàu 01 (Hatch 01)', containers: 250 },
    { name: 'Hầm Tàu 02 (Hatch 02)', containers: 310 },
    { name: 'Hầm Tàu 03 (Hatch 03)', containers: 280 },
    { name: 'Hầm Tàu 04 (Hatch 04)', containers: 407 },
  ])

  const [cranes] = useState([
    { name: 'STS-01 (Cẩu Bờ 01)', status: 'Sẵn Sàng (Ready)', color: 'text-emerald-950 bg-emerald-100 border-emerald-400' },
    { name: 'STS-02 (Cẩu Bờ 02)', status: 'Sẵn Sàng (Ready)', color: 'text-emerald-950 bg-emerald-100 border-emerald-400' },
    { name: 'STS-03 (Cẩu Bờ 03)', status: 'Dự Phòng (Standby)', color: 'text-amber-950 bg-amber-100 border-amber-400' },
  ])

  // Hatch Progress Breakdown (Section 5)
  const [hatches, setHatches] = useState([
    { id: 'H01', name: 'Hầm Tàu 01', planned: 250, completed: 250, remaining: 0, progress: 100, status: 'Hoàn Thành 🟢', color: 'bg-emerald-100 text-emerald-950 border-emerald-400' },
    { id: 'H02', name: 'Hầm Tàu 02', planned: 310, completed: 220, remaining: 90, progress: 71, status: 'Đang Khai Thác ⚡', color: 'bg-blue-100 text-blue-950 border-blue-400' },
    { id: 'H03', name: 'Hầm Tàu 03', planned: 280, completed: 177, remaining: 103, progress: 63, status: 'Đang Khai Thác ⚡', color: 'bg-blue-100 text-blue-950 border-blue-400' },
    { id: 'H04', name: 'Hầm Tàu 04', planned: 407, completed: 200, remaining: 207, progress: 49, status: 'Đang Khai Thác ⚡', color: 'bg-purple-100 text-purple-950 border-purple-400' },
  ])

  // Operation Timer State (Section 6)
  const [timerSeconds, setTimerSeconds] = useState(8 * 3600 + 42 * 60 + 16)
  const [isTimerRunning, setIsTimerRunning] = useState(false)

  // Completion Checklist (Section 7)
  const [completionChecklist] = useState([
    { label: 'Tất cả container đã dỡ hoàn tất (1,247 / 1,247 TEU)', ok: true },
    { label: 'Không còn nhiệm vụ dỡ container tại hầm tàu', ok: true },
    { label: 'Cẩu bờ đã ngắt nguồn và đỗ an toàn', ok: true },
    { label: 'Khu vực cầu bến B-01 đảm bảo an toàn lao động', ok: true },
  ])

  // Modals State
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [selectedHatchId, setSelectedHatchId] = useState('H02')
  const [addMovesInput, setAddMovesInput] = useState(220)
  const [notesInput, setNotesInput] = useState('')

  const [showCompleteConfirmModal, setShowCompleteConfirmModal] = useState(false)
  const [completionInfo, setCompletionInfo] = useState(null)

  // ── LIVE CLOCK TICKER ───────────────────────────────────────────
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeString(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' - ' + now.toLocaleDateString('vi-VN'))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Live operation timer increment when Discharging
  useEffect(() => {
    let timer
    if (isTimerRunning) {
      timer = setInterval(() => setTimerSeconds(p => p + 1), 1000)
    }
    return () => clearInterval(timer)
  }, [isTimerRunning])

  const timerDisplay = useMemo(() => {
    const hrs = Math.floor(timerSeconds / 3600).toString().padStart(2, '0')
    const mins = Math.floor((timerSeconds % 3600) / 60).toString().padStart(2, '0')
    const secs = (timerSeconds % 60).toString().padStart(2, '0')
    return `${hrs}:${mins}:${secs}`
  }, [timerSeconds])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // ── 8. SMART ACTION BUTTON HANDLERS (STATE TRANSITIONS) ─────────

  // State 1 ➔ State 2: Confirm Berthing (APPROACHING ➔ BERTHED)
  const handleConfirmBerthing = () => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('vi-VN')
    setVesselState('BERTHED')
    setTimeline(p => ({ ...p, berthed: { completed: true, time: nowTime } }))
    showToast(`⚓ ĐÃ XÁC NHẬN TÀU CẬP BẾN: Tàu ${vesselInfo.name} đã cập bến B-01 an toàn lúc ${nowTime}!`)
  }

  // State 2 ➔ State 3: Start Discharging (BERTHED ➔ DISCHARGING)
  const handleStartDischarging = () => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('vi-VN')
    setVesselState('DISCHARGING')
    setIsTimerRunning(true)
    
    // Set initial 68% progress for demonstration
    const comp = 847
    const rem = 1247 - comp
    const p = Math.round((comp / 1247) * 100)
    setVesselInfo(prev => ({
      ...prev,
      completedContainers: comp,
      remainingContainers: rem,
      progressPercent: p,
    }))

    setTimeline(prev => ({ ...prev, discharging: { completed: true, time: nowTime } }))
    showToast(`🏗️ BẮT ĐẦU DỠ HÀNG: Cẩu STS-01 & STS-02 tiến hành bốc dỡ container. Đồng hồ thời gian đã kích hoạt. Thông báo đã gửi cho Operator!`)
  }

  // State 3 Action: Open Update Progress Modal
  const handleOpenProgressModal = () => {
    const targetH = hatches.find(h => h.id === selectedHatchId) || hatches[1]
    setAddMovesInput(targetH.completed)
    setShowProgressModal(true)
  }

  // State 3 Submit: Save Progress Modal
  const handleSaveProgressSubmit = (e) => {
    e.preventDefault()
    const targetH = hatches.find(h => h.id === selectedHatchId)
    if (!targetH) return

    const newCompleted = Math.min(targetH.planned, Number(addMovesInput) || 0)
    const isHatchDone = newCompleted >= targetH.planned

    const updatedHatches = hatches.map(h => {
      if (h.id === selectedHatchId) {
        const p = Math.round((newCompleted / h.planned) * 100)
        return {
          ...h,
          completed: newCompleted,
          remaining: h.planned - newCompleted,
          progress: p,
          status: isHatchDone ? 'Hoàn Thành 🟢' : 'Đang Khai Thác ⚡',
          color: isHatchDone ? 'bg-emerald-100 text-emerald-950 border-emerald-400' : 'bg-blue-100 text-blue-950 border-blue-400',
        }
      }
      return h
    })

    setHatches(updatedHatches)

    // Calculate total vessel progress
    const totCompleted = updatedHatches.reduce((sum, h) => sum + h.completed, 0)
    const totPlanned = 1247
    const totPercent = Math.round((totCompleted / totPlanned) * 100)

    setVesselInfo(prev => ({
      ...prev,
      completedContainers: totCompleted,
      remainingContainers: totPlanned - totCompleted,
      progressPercent: totPercent,
    }))

    setShowProgressModal(false)
    showToast(`📦 ĐÃ LƯU TIẾN ĐỘ: ${targetH.name} ➔ ${newCompleted}/${targetH.planned} TEU. Tổng tiến độ: ${totPercent}%. Operator đã nhận dữ liệu realtime!`)
  }

  // State 4: Complete Vessel Operation (100% COMPLETED ➔ COMPLETED)
  const handleConfirmCompleteOperation = () => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('vi-VN')
    setVesselState('COMPLETED')
    setIsTimerRunning(false)
    setVesselInfo(prev => ({
      ...prev,
      completedContainers: prev.totalContainers,
      remainingContainers: 0,
      progressPercent: 100,
      berthStatus: 'AVAILABLE',
    }))
    setTimeline(prev => ({ ...prev, completed: { completed: true, time: nowTime } }))
    setCompletionInfo({ time: nowTime, officer: 'Trần Văn Hải (Nhân Viên Cầu Bến)' })
    setShowCompleteConfirmModal(false)
    showToast(`🟢 ĐÃ HOÀN TẤT KHAI THÁC TÀU: Tàu ${vesselInfo.name} ➔ HOÀN TẤT · Cầu bến B-01 ➔ SẴN SÀNG (AVAILABLE)!`)
  }

  const allApproachingChecked = approachingChecklist.safelyPositioned && approachingChecklist.securelyBerthed && approachingChecklist.areaSafe
  const is100PercentDone = vesselInfo.progressPercent >= 100

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen text-slate-900 relative">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-amber-100 text-amber-950 border-2 border-amber-400 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-3 z-[100] animate-bounce">
          <span className="text-amber-600">●</span>{toastMessage}
        </div>
      )}

      {/* ── HEADER (THÔNG TIN TÀU CỐ ĐỊNH Ở ĐẦU MÀN HÌNH) ── */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs font-mono">
            <span className="font-heading font-black text-orange-600 tracking-wider">NEXUSPORT</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 font-bold">Khai Thác Cầu Bến</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-extrabold">Điều Hành Tác Nghiệp Tàu</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-heading text-3xl font-black text-slate-900">Điều Hành Tác Nghiệp Tàu (Vessel Operation Control)</h2>
            
            {/* Dynamic Status Badge */}
            <span className={`px-3.5 py-1 rounded-xl border-2 font-mono font-black text-xs ${
              vesselState === 'APPROACHING' ? 'bg-amber-100 text-amber-950 border-amber-400' :
              vesselState === 'BERTHED' ? 'bg-emerald-100 text-emerald-950 border-emerald-400' :
              vesselState === 'DISCHARGING' ? 'bg-blue-100 text-blue-950 border-blue-400' :
              'bg-purple-100 text-purple-950 border-purple-400'
            }`}>
              TRẠNG THÁI: {
                vesselState === 'APPROACHING' ? '🟡 TÀU ĐANG VÀO LUỒNG' :
                vesselState === 'BERTHED' ? '🟢 TÀU ĐÃ CẬP BẾN' :
                vesselState === 'DISCHARGING' ? '🟣 ĐANG DỠ CONTAINER' :
                '🟢 HOÀN TẤT KHAI THÁC'
              }
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-mono">
            <span>Tàu: <strong className="text-slate-900 font-black text-sm">{vesselInfo.name}</strong></span>
            <span className="text-slate-300">|</span>
            <span>IMO: <strong className="text-slate-800">{vesselInfo.imo}</strong></span>
            <span className="text-slate-300">|</span>
            <span>Cầu Bến: <strong className="text-amber-900 font-extrabold text-sm">{vesselInfo.berth}</strong></span>
            <span className="text-slate-300">|</span>
            <span>Giờ Đến (ETA): <strong className="text-blue-900">{vesselInfo.eta}</strong></span>
            <span className="text-slate-300">|</span>
            <span>Giờ Rời Kế Hoạch (ETD): <strong className="text-purple-900">{vesselInfo.plannedEtd}</strong></span>
          </div>
        </div>

        {/* Right Corner Widgets */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-700 uppercase font-sans font-black">TRỰC TUYẾN (LIVE)</span>
            <span className="text-slate-300">|</span>
            <span>{timeString}</span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => showToast('🔔 Thông báo: Operator đã duyệt khởi động cẩu bờ STS-01 & STS-02.')}
              className="w-10 h-10 bg-white border border-slate-300 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 shadow-xs relative cursor-pointer">
              <span className="material-symbols-outlined text-lg">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500"></span>
            </button>
            
            <div className="flex items-center gap-2 bg-slate-100 text-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-300 shadow-xs text-xs font-extrabold">
              <span className="material-symbols-outlined text-base text-amber-600">anchor</span>
              <div>
                <div className="text-[11px] font-black leading-tight text-slate-900">Trần Văn Hải</div>
                <div className="text-[9px] text-slate-600 font-mono font-bold">Nhân Viên Cầu B-01</div>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* ── 1. VESSEL OPERATION STATUS (MỐC THỜI GIAN TIMELINE TRẠNG THÁI TÀU) ── */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-600">timeline</span>
            1. VESSEL OPERATION STATUS (MỐC THỜI GIAN TRẠNG THÁI TÀU)
          </h3>
        </div>

        {/* Timeline Stepper Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Step 1: APPROACHING */}
          <div className={`p-4 rounded-2xl border-2 transition-all ${
            vesselState === 'APPROACHING' ? 'bg-amber-100/70 border-amber-400 ring-2 ring-amber-400/20' : 'bg-emerald-50/70 border-emerald-300'
          }`}>
            <div className="flex justify-between items-center mb-1 font-mono text-xs">
              <span className="text-[10px] font-black uppercase text-slate-500">MỐC 01</span>
              <span className="font-black text-emerald-800 text-sm">✓</span>
            </div>
            <div className="font-heading font-black text-slate-900 text-sm">APPROACHING (VÀO LUỒNG)</div>
            <div className="text-xs font-mono font-bold text-slate-600 mt-2">{timeline.approaching.time}</div>
          </div>

          {/* Step 2: BERTHED */}
          <div className={`p-4 rounded-2xl border-2 transition-all ${
            vesselState === 'BERTHED' ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-400/20' :
            timeline.berthed.completed ? 'bg-emerald-50/70 border-emerald-300' : 'bg-slate-100 border-slate-300'
          }`}>
            <div className="flex justify-between items-center mb-1 font-mono text-xs">
              <span className="text-[10px] font-black uppercase text-slate-500">MỐC 02</span>
              <span className="font-black text-slate-700">{timeline.berthed.completed ? '✓' : '●'}</span>
            </div>
            <div className="font-heading font-black text-slate-900 text-sm">BERTHED (CẬP BẾN)</div>
            <div className={`text-xs font-mono font-bold mt-2 ${timeline.berthed.completed ? 'text-emerald-800' : 'text-slate-500'}`}>
              {timeline.berthed.time}
            </div>
          </div>

          {/* Step 3: DISCHARGING */}
          <div className={`p-4 rounded-2xl border-2 transition-all ${
            vesselState === 'DISCHARGING' ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-400/20' :
            timeline.discharging.completed ? 'bg-emerald-50/70 border-emerald-300' : 'bg-slate-100 border-slate-300'
          }`}>
            <div className="flex justify-between items-center mb-1 font-mono text-xs">
              <span className="text-[10px] font-black uppercase text-slate-500">MỐC 03</span>
              <span className="font-black text-slate-700">{timeline.discharging.completed ? '✓' : '○'}</span>
            </div>
            <div className="font-heading font-black text-slate-900 text-sm">DISCHARGING (DỠ HÀNG)</div>
            <div className={`text-xs font-mono font-bold mt-2 ${timeline.discharging.completed ? 'text-blue-900' : 'text-slate-500'}`}>
              {timeline.discharging.time}
            </div>
          </div>

          {/* Step 4: COMPLETED */}
          <div className={`p-4 rounded-2xl border-2 transition-all ${
            vesselState === 'COMPLETED' ? 'bg-purple-100 border-purple-400 ring-2 ring-purple-400/20' : 'bg-slate-100 border-slate-300'
          }`}>
            <div className="flex justify-between items-center mb-1 font-mono text-xs">
              <span className="text-[10px] font-black uppercase text-slate-500">MỐC 04</span>
              <span className="font-black text-slate-700">{timeline.completed.completed ? '✓' : '○'}</span>
            </div>
            <div className="font-heading font-black text-slate-900 text-sm">COMPLETED (HOÀN TẤT)</div>
            <div className={`text-xs font-mono font-bold mt-2 ${timeline.completed.completed ? 'text-purple-900' : 'text-slate-500'}`}>
              {timeline.completed.time}
            </div>
          </div>

        </div>
      </div>

      {/* ── 2 & 3. CURRENT OPERATION & START DISCHARGING (DYNAMIC CARDS BASED ON STATE) ── */}

      {/* STATE 1: APPROACHING CARD */}
      {vesselState === 'APPROACHING' && (
        <div className="bg-white border-2 border-amber-300 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="font-heading text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">directions_boat</span>
              2. CURRENT OPERATION — TÀU ĐANG ĐẾN BẾN (APPROACHING)
            </h3>
            <span className="px-3 py-1 bg-amber-100 text-amber-950 border border-amber-300 rounded-full text-xs font-mono font-bold">
              "Vessel is approaching Berth B-01"
            </span>
          </div>

          <div className="space-y-3 bg-slate-100 p-4 rounded-xl border border-slate-200 text-xs font-bold">
            <div className="text-slate-700 font-extrabold uppercase font-mono">DANH MỤC KIỂM TRA ĐỊNH VỊ AN TOÀN TRƯỚC KHI CẬP BẾN:</div>
            
            <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-300 cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={approachingChecklist.safelyPositioned} onChange={e => setApproachingChecklist(p => ({ ...p, safelyPositioned: e.target.checked }))} className="w-4 h-4 accent-orange-600" />
              <span>✓ Vessel is safely positioned (Tàu đã di chuyển đúng luồng và định vị vị trí an toàn)</span>
            </label>

            <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-300 cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={approachingChecklist.securelyBerthed} onChange={e => setApproachingChecklist(p => ({ ...p, securelyBerthed: e.target.checked }))} className="w-4 h-4 accent-orange-600" />
              <span>✓ Vessel is securely berthed (Dây neo cáp tàu đã được buộc chặt vào cọc bích)</span>
            </label>

            <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-300 cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={approachingChecklist.areaSafe} onChange={e => setApproachingChecklist(p => ({ ...p, areaSafe: e.target.checked }))} className="w-4 h-4 accent-orange-600" />
              <span>✓ Berth area is safe (Mặt bến Cầu B-01 thông thoáng, đảm bảo an toàn lao động)</span>
            </label>
          </div>

          <button onClick={handleConfirmBerthing} disabled={!allApproachingChecked}
            className={`w-full h-14 rounded-xl font-black text-sm flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
              allApproachingChecked ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-400 shadow-xs' : 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed'
            }`}>
            <span className="material-symbols-outlined text-xl">anchor</span>
            [ CONFIRM BERTHING ]
          </button>
        </div>
      )}

      {/* STATE 2: BERTHED CARD */}
      {vesselState === 'BERTHED' && (
        <div className="bg-white border-2 border-emerald-400 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="font-heading text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">precision_manufacturing</span>
              3. START DISCHARGING — KẾ HOẠCH BẮT ĐẦU DỠ HÀNG
            </h3>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-950 border border-emerald-400 rounded-full text-xs font-mono font-bold">
              Status: 🟢 BERTHED
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Hatch Plan List */}
            <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[10px] text-slate-600 uppercase font-sans font-extrabold block">Kế Hoạch Khai Thác Container Theo Hầm:</span>
              {hatchPlan.map(hp => (
                <div key={hp.name} className="flex justify-between items-center p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-900 font-sans">{hp.name}</span>
                  <strong className="text-blue-900 font-black">{hp.containers} containers</strong>
                </div>
              ))}
            </div>

            {/* Crane Status */}
            <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[10px] text-slate-600 uppercase font-sans font-extrabold block">Trạng Thái Cẩu Bờ (Crane Status):</span>
              {cranes.map(cr => (
                <div key={cr.name} className="flex justify-between items-center p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-900 font-sans">{cr.name}</span>
                  <span className={`px-2.5 py-0.5 rounded font-black text-[10px] border ${cr.color}`}>{cr.status}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleStartDischarging}
            className="w-full h-14 bg-orange-100 hover:bg-orange-200 text-orange-950 border-2 border-orange-400 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all">
            <span className="material-symbols-outlined text-xl">precision_manufacturing</span>
            [ START DISCHARGING ]
          </button>
        </div>
      )}

      {/* ── 4 & 5. DISCHARGING PROGRESS & HATCH PROGRESS (WHEN DISCHARGING OR COMPLETED) ── */}
      {(vesselState === 'DISCHARGING' || vesselState === 'COMPLETED') && (
        <div className="space-y-6">

          {/* 4. DISCHARGING PROGRESS (OVERALL PROGRESS) */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-3">
              <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">bar_chart</span>
                4. DISCHARGING PROGRESS (TỔNG QUAN TIẾN ĐỘ DỠ HÀNG)
              </h3>
              <span className="text-xs font-mono font-black text-emerald-700">Tiến độ tổng: {vesselInfo.progressPercent}%</span>
            </div>

            {/* 4 Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Total Containers</span>
                <strong className="text-slate-900 font-black text-xl">{vesselInfo.totalContainers.toLocaleString()} TEU</strong>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-300">
                <span className="text-[10px] text-emerald-800 uppercase font-sans font-bold block">Completed</span>
                <strong className="text-emerald-950 font-black text-xl">{vesselInfo.completedContainers.toLocaleString()} TEU</strong>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-300">
                <span className="text-[10px] text-amber-800 uppercase font-sans font-bold block">Remaining</span>
                <strong className="text-amber-950 font-black text-xl">{vesselInfo.remainingContainers.toLocaleString()} TEU</strong>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-300">
                <span className="text-[10px] text-blue-800 uppercase font-sans font-bold block">Progress</span>
                <strong className="text-blue-950 font-black text-xl">{vesselInfo.progressPercent}%</strong>
              </div>
            </div>

            {/* Large Progress Bar */}
            <div className="bg-slate-100 p-5 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="font-sans font-extrabold text-slate-700">TIẾN ĐỘ THỰC TẾ:</span>
                <span className="font-black text-slate-900 text-sm">
                  {vesselInfo.completedContainers} / {vesselInfo.totalContainers} TEU — <strong className="text-emerald-700 font-black">{vesselInfo.progressPercent}%</strong>
                </span>
              </div>
              <div className="w-full bg-slate-300 h-5 rounded-full overflow-hidden shadow-inner border border-slate-300 relative">
                <div className="bg-emerald-600 h-full rounded-full transition-all duration-500 shadow-md" style={{ width: `${vesselInfo.progressPercent}%` }}></div>
              </div>
            </div>
          </div>

          {/* 5. HATCH PROGRESS TABLE */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600">grid_view</span>
                5. HATCH PROGRESS TABLE (TIẾN ĐỘ THEO TỪNG HẦM TÀU)
              </h3>
              
              {vesselState === 'DISCHARGING' && (
                <button onClick={handleOpenProgressModal}
                  className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-2 border-emerald-400 rounded-xl font-black text-xs flex items-center gap-1 shadow-xs cursor-pointer">
                  <span className="material-symbols-outlined text-sm text-emerald-800">edit_square</span>
                  [ UPDATE PROGRESS ]
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                    {['Hầm Tàu (Hatch)', 'Kế Hoạch (Planned)', 'Đã Dỡ (Completed)', 'Còn Lại (Remaining)', 'Thanh Tiến Độ', 'Tiến Độ (%)', 'Trạng Thái'].map(h => (
                      <th key={h} className="py-3 px-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {hatches.map(h => (
                    <tr key={h.id} className="hover:bg-slate-100/60">
                      <td className="py-3.5 px-4 font-black text-slate-900 text-sm font-heading">{h.name}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-700">{h.planned} TEU</td>
                      <td className="py-3.5 px-4 font-black text-emerald-800">{h.completed} TEU</td>
                      <td className="py-3.5 px-4 font-bold text-amber-800">{h.remaining} TEU</td>
                      <td className="py-3.5 px-4 w-32">
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden border border-slate-300">
                          <div className="bg-blue-600 h-full rounded-full" style={{ width: `${h.progress}%` }}></div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-black text-blue-900">{h.progress}%</td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${h.color}`}>
                          {h.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ── 6. OPERATION TIMER ── */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">timer</span>
            6. OPERATION TIMER (ĐỒNG HỒ KHAI THÁC THỜI GIAN THỰC)
          </h3>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-950 border border-emerald-400 rounded-full text-xs font-mono font-black">
            🟢 ON SCHEDULE (ĐÚNG KẾ HOẠCH)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
          <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 col-span-2 sm:col-span-1 text-center">
            <span className="text-[10px] text-amber-400 uppercase font-sans font-extrabold block">OPERATION TIME</span>
            <strong className="text-2xl text-emerald-400 font-black tracking-widest block mt-1">{timerDisplay}</strong>
          </div>
          <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Giờ Bắt Đầu (Start)</span>
            <strong className="text-slate-900 font-extrabold text-sm">08:45</strong>
          </div>
          <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Giờ Hiện Tại (Current)</span>
            <strong className="text-blue-900 font-extrabold text-sm">16:30</strong>
          </div>
          <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Dự Kiến Hoàn Thành</span>
            <strong className="text-emerald-900 font-extrabold text-sm">21:32</strong>
          </div>
          <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Kế Hoạch Hoàn Thành</span>
            <strong className="text-purple-900 font-extrabold text-sm">21:45</strong>
          </div>
        </div>
      </div>

      {/* ── 7. COMPLETE OPERATION ── */}
      {(is100PercentDone || vesselState === 'COMPLETED') && (
        <div className="bg-white border-2 border-emerald-400 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">verified</span>
              7. COMPLETE OPERATION (XÁC NHẬN HOÀN TẤT KHAI THÁC TÀU)
            </h3>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-950 border border-emerald-400 rounded-full text-xs font-mono font-black">
              🟢 READY TO COMPLETE
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            {completionChecklist.map((c, i) => (
              <div key={i} className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 font-bold flex items-center gap-2">
                <span className="font-black text-emerald-600 text-base">✓</span>
                <span>{c.label}</span>
              </div>
            ))}
          </div>

          {vesselState !== 'COMPLETED' ? (
            <button onClick={() => setShowCompleteConfirmModal(true)}
              className="w-full h-14 bg-purple-100 hover:bg-purple-200 text-purple-950 border-2 border-purple-400 rounded-xl font-black text-sm shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all">
              <span className="material-symbols-outlined text-xl">check_circle</span>
              [ COMPLETE VESSEL OPERATION ]
            </button>
          ) : (
            <div className="p-4 bg-purple-50 border-2 border-purple-400 rounded-2xl space-y-1 font-mono text-xs">
              <div className="font-black text-purple-950 text-sm">✓ COMPLETED — KHAI THÁC HOÀN TẤT 100%</div>
              <div className="text-slate-800 font-bold">Trạng thái Tàu: <strong className="text-purple-900 font-black">HOÀN TẤT (COMPLETED)</strong> · Cầu B-01: <strong className="text-emerald-700 font-black">🟢 SẴN SÀNG (AVAILABLE)</strong></div>
              {completionInfo && <div className="text-[11px] text-slate-600 font-sans mt-1">Xác nhận lúc {completionInfo.time} bởi {completionInfo.officer}</div>}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL 1: UPDATE PROGRESS MODAL (SECTION 5) ── */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 font-sans">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-xl">rate_review</span>
                <h3 className="font-heading text-lg font-extrabold text-slate-900">Cập Nhật Tiến Độ Hầm Tàu</h3>
              </div>
              <button onClick={() => setShowProgressModal(false)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveProgressSubmit} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Select Hatch (Chọn Hầm Tàu) *</label>
                <select value={selectedHatchId} onChange={e => {
                  setSelectedHatchId(e.target.value)
                  const targetH = hatches.find(h => h.id === e.target.value)
                  if (targetH) setAddMovesInput(targetH.completed)
                }} className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-extrabold text-sm focus:outline-none focus:border-slate-900">
                  {hatches.map(h => (
                    <option key={h.id} value={h.id}>{h.name} ({h.completed}/{h.planned} TEU — {h.progress}%)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Containers Completed (Số Container Đã Dỡ) *</label>
                <input type="number" min="0" max="450" value={addMovesInput} onChange={e => setAddMovesInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-sm font-mono font-black text-slate-900 focus:outline-none focus:border-slate-900" required />
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Notes (Ghi Chú)</label>
                <textarea rows="2" value={notesInput} onChange={e => setNotesInput(e.target.value)}
                  placeholder="Ghi chú thêm về tiến độ hầm tàu..."
                  className="w-full p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-normal text-slate-900 focus:outline-none focus:border-slate-900 resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowProgressModal(false)} className="flex-1 h-11 border border-slate-300 text-slate-700 rounded-xl font-extrabold text-xs hover:bg-slate-100">
                  Hủy
                </button>
                <button type="submit" className="flex-1 h-11 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-2 border-emerald-400 rounded-xl font-black text-xs shadow-xs">
                  [ 💾 SAVE PROGRESS ]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: CONFIRMATION MODAL (SECTION 7) ── */}
      {showCompleteConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 font-sans border-2 border-purple-400">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading text-lg font-black text-slate-900">Xác Nhận Hoàn Tất Khai Thác Tàu?</h3>
              <button onClick={() => setShowCompleteConfirmModal(false)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="p-3.5 bg-purple-50 border border-purple-300 rounded-xl text-purple-950 text-xs font-bold leading-relaxed">
              "Sau khi xác nhận hoàn tất, trạng thái tàu sẽ chuyển sang <strong className="text-purple-900 font-black">HOÀN TẤT (COMPLETED)</strong> và Cầu bến B-01 sẽ chuyển sang <strong className="text-emerald-700 font-black">SẴN SÀNG (AVAILABLE)</strong> để đón tàu tiếp theo."
            </div>

            <div className="flex gap-3 pt-3 text-xs font-bold">
              <button onClick={() => setShowCompleteConfirmModal(false)} className="flex-1 h-12 border-2 border-slate-300 text-slate-800 rounded-xl font-extrabold hover:bg-slate-100 cursor-pointer">
                [ HỦY BỎ ]
              </button>
              <button onClick={handleConfirmCompleteOperation} className="flex-1 h-12 bg-purple-100 hover:bg-purple-200 text-purple-950 border-2 border-purple-400 rounded-xl font-black shadow-xs cursor-pointer">
                [ XÁC NHẬN HOÀN TẤT ]
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
