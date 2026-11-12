import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'

export default function VesselOperationControl() {
  const [toastMessage, setToastMessage] = useState('')
  const [timeString, setTimeString] = useState('')

  // ── VESSEL STATE MACHINE ──────────────────────────────────────
  // States: 'APPROACHING' | 'BERTHED' | 'DISCHARGING' | 'COMPLETED'
  const [vesselState, setVesselState] = useState('DISCHARGING')

  // Vessel Info Data
  const [vesselInfo, setVesselInfo] = useState({
    name: 'EVER GIVEN',
    imo: '9811000',
    berth: 'Cầu B-01',
    eta: '08:00',
    plannedEtd: '21:45',
    totalContainers: 1247,
    completedContainers: 847,
    remainingContainers: 400,
    progressPercent: 68,
    berthStatus: 'OCCUPIED', // 'OCCUPIED' | 'AVAILABLE'
  })

  // Timeline Step Timestamps
  const [timeline, setTimeline] = useState({
    approaching: { completed: true, time: '08:00 - 02/11/2026' },
    berthed: { completed: true, time: '08:30 - 02/11/2026' },
    discharging: { completed: true, time: '08:45 - Đang tác nghiệp' },
    completed: { completed: false, time: 'Dự kiến 21:32' },
  })

  // Approaching Checklist
  const [approachingChecklist, setApproachingChecklist] = useState({
    safelyPositioned: true,
    securelyBerthed: true,
    areaSafe: true,
  })

  // Discharging Plan & Crane Status
  const [hatchPlan] = useState([
    { name: 'Hầm Tàu 01 (Hatch 01)', containers: 250 },
    { name: 'Hầm Tàu 02 (Hatch 02)', containers: 310 },
    { name: 'Hầm Tàu 03 (Hatch 03)', containers: 280 },
    { name: 'Hầm Tàu 04 (Hatch 04)', containers: 407 },
  ])

  const [cranes] = useState([
    { name: 'Cẩu Bờ STS-01', status: 'Đang hoạt động', rate: '32 TEU/h', isWorking: true },
    { name: 'Cẩu Bờ STS-02', status: 'Đang hoạt động', rate: '28 TEU/h', isWorking: true },
    { name: 'Cẩu Bờ STS-03', status: 'Chờ dự phòng', rate: '0 TEU/h', isWorking: false },
  ])

  // Hatch Progress Breakdown
  const [hatches, setHatches] = useState([
    { id: 'H01', name: 'Hầm Tàu 01', planned: 250, completed: 250, remaining: 0, progress: 100, status: 'Hoàn tất', badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { id: 'H02', name: 'Hầm Tàu 02', planned: 310, completed: 220, remaining: 90, progress: 71, status: 'Đang dỡ hàng', badgeStyle: 'bg-orange-50 text-orange-700 border-orange-200' },
    { id: 'H03', name: 'Hầm Tàu 03', planned: 280, completed: 177, remaining: 103, progress: 63, status: 'Đang dỡ hàng', badgeStyle: 'bg-orange-50 text-orange-700 border-orange-200' },
    { id: 'H04', name: 'Hầm Tàu 04', planned: 407, completed: 200, remaining: 207, progress: 49, status: 'Đang dỡ hàng', badgeStyle: 'bg-orange-50 text-orange-700 border-orange-200' },
  ])

  // Operation Timer State
  const [timerSeconds, setTimerSeconds] = useState(8 * 3600 + 42 * 60 + 16)
  const [isTimerRunning, setIsTimerRunning] = useState(true)

  // Completion Checklist
  const [completionChecklist] = useState([
    { label: 'Tất cả container đã dỡ hoàn tất (1,247 / 1,247 TEU)', ok: true },
    { label: 'Không còn nhiệm vụ cẩu container tồn đọng tại các hầm', ok: true },
    { label: 'Cẩu bờ STS đã ngắt nguồn điện và đỗ an toàn theo quy định', ok: true },
    { label: 'Mặt bằng cầu bến B-01 đã kiểm tra đảm bảo an toàn lao động', ok: true },
  ])

  // Activity Log
  const [activityLogs, setActivityLogs] = useState([
    { time: '16:15', title: 'Hoàn thành Hầm Tàu 01', desc: 'Cẩu STS-01 dỡ xong 250/250 TEU, chuyển sang hỗ trợ Hầm 02.' },
    { time: '14:30', title: 'Cập nhật năng suất bốc dỡ', desc: 'Năng suất trung bình toàn bến đạt 60 TEU/h (đúng kế hoạch).' },
    { time: '08:45', title: 'Bắt đầu bốc dỡ container', desc: 'Cẩu STS-01 và STS-02 đồng loạt vận hành mở nắp hầm hàng.' },
    { time: '08:30', title: 'Tàu cập bến B-01 an toàn', desc: 'Hoàn tất thủ tục hoa tiêu và buộc dây cọc bích an toàn.' },
  ])

  // Modals State
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [selectedHatchId, setSelectedHatchId] = useState('H02')
  const [addMovesInput, setAddMovesInput] = useState(220)
  const [notesInput, setNotesInput] = useState('')

  const [showCompleteConfirmModal, setShowCompleteConfirmModal] = useState(false)
  const [completionInfo, setCompletionInfo] = useState(null)

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeString(
        now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        ' • ' +
        now.toLocaleDateString('vi-VN')
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Timer Increment
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

  // Confirm Berthing (APPROACHING -> BERTHED)
  const handleConfirmBerthing = () => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    setVesselState('BERTHED')
    setTimeline(p => ({ ...p, berthed: { completed: true, time: `${nowTime} - Đã cập bến` } }))
    setActivityLogs(p => [{ time: nowTime, title: 'Tàu cập bến an toàn', desc: `Tàu ${vesselInfo.name} đã buộc dây cập bến B-01 an toàn.` }, ...p])
    showToast(`Đã xác nhận tàu ${vesselInfo.name} cập bến B-01 an toàn.`)
  }

  // Start Discharging (BERTHED -> DISCHARGING)
  const handleStartDischarging = () => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    setVesselState('DISCHARGING')
    setIsTimerRunning(true)
    const comp = 847
    const rem = 1247 - comp
    const p = Math.round((comp / 1247) * 100)
    setVesselInfo(prev => ({
      ...prev,
      completedContainers: comp,
      remainingContainers: rem,
      progressPercent: p,
    }))
    setTimeline(prev => ({ ...prev, discharging: { completed: true, time: `${nowTime} - Đang dỡ hàng` } }))
    setActivityLogs(p => [{ time: nowTime, title: 'Khởi động bốc dỡ container', desc: 'Cẩu STS-01 & STS-02 bắt đầu tác nghiệp dỡ hàng.' }, ...p])
    showToast('Đã bắt đầu bốc dỡ container. Đồng hồ thời gian đã kích hoạt.')
  }

  // Open Update Progress Modal
  const handleOpenProgressModal = () => {
    const targetH = hatches.find(h => h.id === selectedHatchId) || hatches[1]
    setAddMovesInput(targetH.completed)
    setNotesInput('')
    setShowProgressModal(true)
  }

  // Save Progress Submit
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
          status: isHatchDone ? 'Hoàn tất' : 'Đang dỡ hàng',
          badgeStyle: isHatchDone ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200',
        }
      }
      return h
    })

    setHatches(updatedHatches)

    const totCompleted = updatedHatches.reduce((sum, h) => sum + h.completed, 0)
    const totPlanned = 1247
    const totPercent = Math.round((totCompleted / totPlanned) * 100)

    setVesselInfo(prev => ({
      ...prev,
      completedContainers: totCompleted,
      remainingContainers: totPlanned - totCompleted,
      progressPercent: totPercent,
    }))

    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    setActivityLogs(p => [
      { time: nowTime, title: `Cập nhật ${targetH.name}`, desc: `Đã dỡ ${newCompleted}/${targetH.planned} TEU (${Math.round((newCompleted / targetH.planned) * 100)}%). ${notesInput ? 'Ghi chú: ' + notesInput : ''}` },
      ...p
    ])

    setShowProgressModal(false)
    showToast(`Đã lưu tiến độ ${targetH.name}: ${newCompleted}/${targetH.planned} TEU.`)
  }

  // Complete Operation
  const handleConfirmCompleteOperation = () => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    setVesselState('COMPLETED')
    setIsTimerRunning(false)
    setVesselInfo(prev => ({
      ...prev,
      completedContainers: prev.totalContainers,
      remainingContainers: 0,
      progressPercent: 100,
      berthStatus: 'AVAILABLE',
    }))
    setTimeline(prev => ({ ...prev, completed: { completed: true, time: `${nowTime} - Hoàn tất` } }))
    setCompletionInfo({ time: nowTime, officer: 'Đại diện Hãng tàu' })
    setActivityLogs(p => [{ time: nowTime, title: 'Hoàn tất tác nghiệp tàu', desc: 'Toàn bộ 1,247 TEU đã dỡ xong. Cầu bến B-01 chuyển sang trạng thái Sẵn sàng.' }, ...p])
    setShowCompleteConfirmModal(false)
    showToast(`Đã xác nhận hoàn tất tác nghiệp tàu ${vesselInfo.name}. Cầu bến B-01 sẵn sàng tiếp nhận tàu mới.`)
  }

  const allApproachingChecked = approachingChecklist.safelyPositioned && approachingChecklist.securelyBerthed && approachingChecklist.areaSafe
  const is100PercentDone = vesselInfo.progressPercent >= 100

  return (
    <div className="p-6 w-full font-sans flex flex-col gap-5 bg-slate-50 min-h-screen text-[#1F2937]">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-8 bg-white text-slate-800 border border-slate-200 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2.5 z-50 animate-in fade-in slide-in-from-top-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── HEADER & QUICK ACTIONS ── */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 text-xs text-slate-500 font-medium">
            <span>Hãng tàu</span>
            <span>/</span>
            <span>Giám sát tác nghiệp</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">{vesselInfo.name}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Tàu {vesselInfo.name}
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
              IMO {vesselInfo.imo}
            </span>

            {/* Dynamic Status Badge */}
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded border ${
              vesselState === 'APPROACHING' ? 'bg-orange-50 text-orange-700 border-orange-200' :
              vesselState === 'BERTHED' ? 'bg-sky-50 text-sky-700 border-sky-200' :
              vesselState === 'DISCHARGING' ? 'bg-orange-50 text-orange-700 border-orange-200' :
              'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {
                vesselState === 'APPROACHING' ? 'Đang vào luồng' :
                vesselState === 'BERTHED' ? 'Đã cập bến B-01' :
                vesselState === 'DISCHARGING' ? 'Đang dỡ container' :
                'Đã hoàn tất khai thác'
              }
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-600">
            <span>Cầu bến: <strong className="text-slate-900 font-semibold">{vesselInfo.berth}</strong></span>
            <span className="text-slate-300">|</span>
            <span>Giờ đến (ETA): <strong className="text-slate-900 font-semibold">{vesselInfo.eta}</strong></span>
            <span className="text-slate-300">|</span>
            <span>Giờ rời kế hoạch (ETD): <strong className="text-slate-900 font-semibold">{vesselInfo.plannedEtd}</strong></span>
            <span className="text-slate-300">|</span>
            <span>Trạng thái bến: <strong className="text-emerald-700 font-semibold">{vesselInfo.berthStatus === 'OCCUPIED' ? 'Đang tiếp nhận' : 'Sẵn sàng'}</strong></span>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-end lg:self-center">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-800 font-semibold">Trực tuyến</span>
            <span className="text-slate-300">|</span>
            <span className="font-mono">{timeString}</span>
          </div>

          <a
            href="http://localhost:5174"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF3E8] hover:bg-orange-100 text-[#F97316] font-medium text-xs rounded-lg border border-orange-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            Cổng Booking & Manifest
          </a>

          <Link
            to="/berth-staff/incident-reporting"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg border border-slate-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-rose-500">warning</span>
            Báo sự cố
          </Link>
        </div>
      </div>

      {/* ── KPI METRICS CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-medium">Tổng sản lượng</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 font-mono">{vesselInfo.totalContainers.toLocaleString()}</span>
            <span className="text-xs text-slate-400 font-medium">TEU</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 font-mono">4 hầm container</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-medium">Đã bốc dỡ</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-emerald-700 font-mono">{vesselInfo.completedContainers.toLocaleString()}</span>
            <span className="text-xs text-emerald-600 font-medium">{vesselInfo.progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${vesselInfo.progressPercent}%` }}></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-medium">Còn lại trên tàu</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-orange-600 font-mono">{vesselInfo.remainingContainers.toLocaleString()}</span>
            <span className="text-xs text-slate-400 font-medium">TEU</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 font-mono">Dự kiến hoàn thành 21:32</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-medium">Thời gian tác nghiệp</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 font-mono">{timerDisplay}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <span className="text-[11px] text-emerald-700 font-medium mt-1">Đúng kế hoạch tiến độ</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-xs text-slate-500 font-medium">Cầu bến tiếp nhận</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 font-mono">B-01</span>
            <span className="text-xs text-emerald-600 font-medium">An toàn</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Độ sâu luồng: 14.5m</span>
        </div>
      </div>

      {/* ── WORKFLOW TIMELINE STEPPER ── */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#F97316]">timeline</span>
            Tiến trình khai thác tàu tại cầu bến
          </h2>
          <span className="text-xs text-slate-500">Quy trình chuẩn tác nghiệp bến cảng</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Step 1 */}
          <div className={`p-3.5 rounded-lg border transition-all ${
            vesselState === 'APPROACHING' ? 'bg-[#FFF3E8] border-orange-300' : 'bg-slate-50/70 border-slate-200'
          }`}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Mốc 1</span>
              <span className="text-xs font-semibold text-emerald-600">✓ Hoàn tất</span>
            </div>
            <div className="text-sm font-semibold text-slate-900">Vào luồng (Approaching)</div>
            <div className="text-xs text-slate-500 mt-1 font-mono">{timeline.approaching.time}</div>
          </div>

          {/* Step 2 */}
          <div className={`p-3.5 rounded-lg border transition-all ${
            vesselState === 'BERTHED' ? 'bg-[#FFF3E8] border-orange-300' :
            timeline.berthed.completed ? 'bg-slate-50/70 border-slate-200' : 'bg-white border-slate-200 opacity-60'
          }`}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Mốc 2</span>
              <span className={`text-xs font-semibold ${timeline.berthed.completed ? 'text-emerald-600' : 'text-slate-400'}`}>
                {timeline.berthed.completed ? '✓ Hoàn tất' : 'Chờ thực hiện'}
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-900">Cập bến (Berthed)</div>
            <div className="text-xs text-slate-500 mt-1 font-mono">{timeline.berthed.time}</div>
          </div>

          {/* Step 3 */}
          <div className={`p-3.5 rounded-lg border transition-all ${
            vesselState === 'DISCHARGING' ? 'bg-[#FFF3E8] border-orange-300 ring-1 ring-[#F97316]/30' :
            timeline.discharging.completed ? 'bg-slate-50/70 border-slate-200' : 'bg-white border-slate-200 opacity-60'
          }`}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Mốc 3</span>
              <span className="text-xs font-semibold text-[#F97316]">● Đang xử lý</span>
            </div>
            <div className="text-sm font-semibold text-slate-900">Dỡ hàng (Discharging)</div>
            <div className="text-xs text-slate-500 mt-1 font-mono">{timeline.discharging.time}</div>
          </div>

          {/* Step 4 */}
          <div className={`p-3.5 rounded-lg border transition-all ${
            vesselState === 'COMPLETED' ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200 opacity-60'
          }`}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Mốc 4</span>
              <span className={`text-xs font-semibold ${timeline.completed.completed ? 'text-emerald-600' : 'text-slate-400'}`}>
                {timeline.completed.completed ? '✓ Hoàn tất' : 'Kế hoạch 21:45'}
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-900">Rời bến (Completed)</div>
            <div className="text-xs text-slate-500 mt-1 font-mono">{timeline.completed.time}</div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT (2-COLUMN BALANCED LAYOUT) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

        {/* ── LEFT COLUMN (8 COLS): OPERATIONS & HATCH PROGRESS ── */}
        <div className="lg:col-span-8 flex flex-col gap-5">

          {/* ACTION PANEL ACCORDING TO CURRENT STATE */}
          {vesselState === 'APPROACHING' && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#F97316]">directions_boat</span>
                  Xác nhận an toàn cập bến B-01
                </h3>
                <span className="text-xs text-orange-700 bg-orange-50 px-2.5 py-0.5 rounded border border-orange-200 font-medium">
                  Tàu đang vào luồng
                </span>
              </div>

              <div className="my-4 space-y-2.5 text-xs text-slate-700">
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={approachingChecklist.safelyPositioned}
                    onChange={e => setApproachingChecklist(p => ({ ...p, safelyPositioned: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#F97316] accent-[#F97316]"
                  />
                  <span>Tàu đã hoàn thành thủ tục hoa tiêu và vào đúng vị trí neo đậu an toàn</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={approachingChecklist.securelyBerthed}
                    onChange={e => setApproachingChecklist(p => ({ ...p, securelyBerthed: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#F97316] accent-[#F97316]"
                  />
                  <span>Dây neo cáp tàu đã được buộc chặt chẽ vào cọc bích bến B-01</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={approachingChecklist.areaSafe}
                    onChange={e => setApproachingChecklist(p => ({ ...p, areaSafe: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#F97316] accent-[#F97316]"
                  />
                  <span>Mặt bến Cầu B-01 thông thoáng, bảo đảm an toàn lao động và sẵn sàng tác nghiệp</span>
                </label>
              </div>

              <button
                onClick={handleConfirmBerthing}
                disabled={!allApproachingChecked}
                className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                  allApproachingChecked
                    ? 'bg-[#F97316] hover:bg-[#EA580C] text-white shadow-xs cursor-pointer'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">anchor</span>
                Xác nhận tàu cập bến an toàn
              </button>
            </div>
          )}

          {vesselState === 'BERTHED' && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#F97316]">precision_manufacturing</span>
                  Kế hoạch triển khai bốc dỡ container
                </h3>
                <span className="text-xs text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded border border-sky-200 font-medium">
                  Đã cập bến B-01
                </span>
              </div>

              <div className="my-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <span className="font-semibold text-slate-700 block">Kế hoạch theo hầm hàng:</span>
                  {hatchPlan.map(hp => (
                    <div key={hp.name} className="flex justify-between items-center py-1 border-b border-slate-200/60 last:border-0">
                      <span className="text-slate-600">{hp.name}</span>
                      <strong className="text-slate-900 font-mono font-semibold">{hp.containers} TEU</strong>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <span className="font-semibold text-slate-700 block">Thiết bị cẩu bờ phục vụ:</span>
                  {cranes.map(cr => (
                    <div key={cr.name} className="flex justify-between items-center py-1 border-b border-slate-200/60 last:border-0">
                      <span className="text-slate-600">{cr.name}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${
                        cr.isWorking ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {cr.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleStartDischarging}
                className="w-full py-2.5 px-4 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">play_circle</span>
                Bắt đầu bốc dỡ container
              </button>
            </div>
          )}

          {/* OVERALL PROGRESS & HATCH TABLE (WHEN DISCHARGING OR COMPLETED) */}
          {(vesselState === 'DISCHARGING' || vesselState === 'COMPLETED') && (
            <>
              {/* Overall Progress Card */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#F97316]">bar_chart</span>
                    Tiến độ dỡ hàng tổng thể
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {vesselInfo.completedContainers} / {vesselInfo.totalContainers} TEU ({vesselInfo.progressPercent}%)
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Tiến độ thực hiện:</span>
                    <span className="font-semibold text-slate-800">{vesselInfo.progressPercent}% hoàn thành</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="bg-[#F97316] h-full rounded-full transition-all duration-500"
                      style={{ width: `${vesselInfo.progressPercent}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 pt-1 font-mono">
                    <span>Đã dỡ: {vesselInfo.completedContainers} TEU</span>
                    <span>Còn lại: {vesselInfo.remainingContainers} TEU</span>
                  </div>
                </div>
              </div>

              {/* Hatch Breakdown Table */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#F97316]">table_chart</span>
                      Tiến độ theo từng hầm tàu (Hatch Progress)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Theo dõi số lượng container dỡ thực tế tại từng vị trí hầm</p>
                  </div>

                  {vesselState === 'DISCHARGING' && (
                    <button
                      onClick={handleOpenProgressModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit_note</span>
                      Cập nhật tiến độ
                    </button>
                  )}
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                        <th className="py-2.5 px-3">Hầm tàu</th>
                        <th className="py-2.5 px-3">Kế hoạch</th>
                        <th className="py-2.5 px-3">Đã dỡ</th>
                        <th className="py-2.5 px-3">Còn lại</th>
                        <th className="py-2.5 px-3 w-36">Thanh tiến độ</th>
                        <th className="py-2.5 px-3 text-right">Tỷ lệ</th>
                        <th className="py-2.5 px-3 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {hatches.map(h => (
                        <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 font-semibold text-slate-800">{h.name}</td>
                          <td className="py-3 px-3 font-mono text-slate-600">{h.planned} TEU</td>
                          <td className="py-3 px-3 font-mono font-semibold text-emerald-700">{h.completed} TEU</td>
                          <td className="py-3 px-3 font-mono text-orange-600">{h.remaining} TEU</td>
                          <td className="py-3 px-3">
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                              <div
                                className={`h-full rounded-full transition-all ${h.progress >= 100 ? 'bg-emerald-600' : 'bg-[#F97316]'}`}
                                style={{ width: `${h.progress}%` }}
                              ></div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800">{h.progress}%</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded border ${h.badgeStyle}`}>
                              {h.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* COMPLETE OPERATION CONFIRMATION BLOCK */}
          {(is100PercentDone || vesselState === 'COMPLETED') && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">verified</span>
                  Nghiệm thu hoàn tất tác nghiệp khai thác tàu
                </h3>
                <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 font-medium">
                  {vesselState === 'COMPLETED' ? 'Đã hoàn tất' : 'Sẵn sàng nghiệm thu'}
                </span>
              </div>

              <div className="my-4 space-y-2 text-xs">
                {completionChecklist.map((c, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200/60 text-slate-700 font-medium">
                    <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
                    <span>{c.label}</span>
                  </div>
                ))}
              </div>

              {vesselState !== 'COMPLETED' ? (
                <button
                  onClick={() => setShowCompleteConfirmModal(true)}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">done_all</span>
                  Xác nhận hoàn tất khai thác tàu
                </button>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
                  <div className="font-semibold text-sm">Đã hoàn tất khai thác tàu thành công</div>
                  <div className="text-slate-600 mt-1">
                    Cầu bến B-01 đã chuyển sang trạng thái <strong>Sẵn sàng (Available)</strong> để đón lượt tàu tiếp theo.
                    {completionInfo && ` Xác nhận lúc ${completionInfo.time} bởi ${completionInfo.officer}.`}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── RIGHT COLUMN (4 COLS): CRANES, SCHEDULE, AND ACTIVITY LOG ── */}
        <div className="lg:col-span-4 flex flex-col gap-5">

          {/* STS Cranes Status Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#F97316]">precision_manufacturing</span>
                Trạng thái cẩu bờ STS
              </h3>
              <span className="text-xs text-slate-500 font-mono">3 cẩu bờ</span>
            </div>

            <div className="mt-3 space-y-2.5 text-xs">
              {cranes.map(cr => (
                <div key={cr.name} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800 block">{cr.name}</span>
                    <span className="text-[11px] text-slate-500">Năng suất: {cr.rate}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                    cr.isWorking ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {cr.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Operation Schedule Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#F97316]">schedule</span>
                Mốc thời gian tác nghiệp
              </h3>
              <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Đúng hạn
              </span>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Giờ bắt đầu:</span>
                <span className="font-mono font-semibold text-slate-800">08:45</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Giờ hiện tại:</span>
                <span className="font-mono font-semibold text-slate-800">16:30</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Dự kiến hoàn thành:</span>
                <span className="font-mono font-semibold text-emerald-700">21:32</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-500">Hạn rời bến (ETD):</span>
                <span className="font-mono font-semibold text-slate-900">21:45</span>
              </div>
            </div>
          </div>

          {/* Live Activity Feed */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#F97316]">history</span>
                Nhật ký tác nghiệp trực tiếp
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>

            <div className="mt-3 space-y-3 text-xs">
              {activityLogs.map((log, idx) => (
                <div key={idx} className="flex gap-2.5 items-start">
                  <span className="font-mono text-[11px] text-slate-400 shrink-0 mt-0.5">{log.time}</span>
                  <div>
                    <span className="font-semibold text-slate-800 block text-xs">{log.title}</span>
                    <span className="text-[11px] text-slate-500 leading-relaxed block">{log.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* ── MODAL: UPDATE PROGRESS ── */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-lg p-5 shadow-xl border border-slate-200 space-y-4 font-sans">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#F97316]">edit_note</span>
                Cập nhật tiến độ hầm tàu
              </h3>
              <button
                onClick={() => setShowProgressModal(false)}
                className="w-7 h-7 rounded hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveProgressSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Chọn hầm tàu *</label>
                <select
                  value={selectedHatchId}
                  onChange={e => {
                    setSelectedHatchId(e.target.value)
                    const targetH = hatches.find(h => h.id === e.target.value)
                    if (targetH) setAddMovesInput(targetH.completed)
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-[#F97316]"
                >
                  {hatches.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.completed}/{h.planned} TEU — {h.progress}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Số container đã dỡ (TEU) *</label>
                <input
                  type="number"
                  min="0"
                  max="450"
                  value={addMovesInput}
                  onChange={e => setAddMovesInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#F97316]"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Ghi chú tác nghiệp</label>
                <textarea
                  rows="2"
                  value={notesInput}
                  onChange={e => setNotesInput(e.target.value)}
                  placeholder="Nhập ghi chú thêm về tình hình dỡ hàng tại hầm này..."
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#F97316] resize-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProgressModal(false)}
                  className="flex-1 py-2 px-3 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg font-semibold shadow-xs transition-colors"
                >
                  Lưu tiến độ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRM COMPLETE ── */}
      {showCompleteConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-lg p-5 shadow-xl border border-slate-200 space-y-4 font-sans">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">check_circle</span>
                Xác nhận hoàn tất khai thác tàu?
              </h3>
              <button
                onClick={() => setShowCompleteConfirmModal(false)}
                className="w-7 h-7 rounded hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Sau khi xác nhận, toàn bộ tiến trình bốc dỡ của tàu <strong>{vesselInfo.name}</strong> sẽ được đánh dấu <strong>Hoàn tất (Completed)</strong>. Cầu bến B-01 sẽ giải phóng và chuyển sang trạng thái <strong>Sẵn sàng (Available)</strong> để phục vụ tàu tiếp theo.
            </p>

            <div className="flex gap-2.5 pt-2 text-xs">
              <button
                onClick={() => setShowCompleteConfirmModal(false)}
                className="flex-1 py-2 px-3 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmCompleteOperation}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs transition-colors"
              >
                Xác nhận hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
