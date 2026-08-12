import React, { useState, useEffect } from 'react'

// Initial Berth Cards Data
const INITIAL_BERTHS_DATA = [
  {
    id: 'B-01',
    name: 'Cầu B-01',
    vesselName: 'EVER GIVEN',
    imo: '9811000',
    eta: '08:00',
    etd: '21:45',
    status: 'BERTHED',
    statusBadge: '🟢 ĐÃ CẬP BẾN',
    statusColor: 'bg-emerald-100 text-emerald-950 border-emerald-400',
    containerCount: '1,247 TEU',
    isCurrent: true,
  },
  {
    id: 'B-02',
    name: 'Cầu B-02',
    vesselName: 'MSC GULSUN',
    imo: '9833412',
    eta: '15:30',
    etd: '04:00 (+1)',
    status: 'APPROACHING',
    statusBadge: '🟡 ĐANG VÀO LUỒNG',
    statusColor: 'bg-amber-100 text-amber-950 border-amber-400',
    containerCount: '1,890 TEU',
    isCurrent: false,
  },
  {
    id: 'B-03',
    name: 'Cầu B-03',
    vesselName: '— (Cầu bến trống)',
    imo: '—',
    eta: '—',
    etd: '—',
    status: 'AVAILABLE',
    statusBadge: '🟢 CẦU BẾN TRỐNG',
    statusColor: 'bg-emerald-100 text-emerald-950 border-emerald-400',
    containerCount: '0 TEU',
    isCurrent: false,
  },
]

export default function BerthOperationsDashboard() {
  const [berths, setBerths] = useState(INITIAL_BERTHS_DATA)
  const [toastMessage, setToastMessage] = useState('')
  const [timeString, setTimeString] = useState('')

  // Main Vessel State (EVER GIVEN at Berth B-01)
  const [mainVessel, setMainVessel] = useState({
    name: 'EVER GIVEN',
    imo: '9811000',
    berth: 'Cầu B-01',
    status: 'BERTHED', // 'APPROACHING' | 'BERTHED' | 'DISCHARGING' | 'COMPLETED'
    statusLabel: '🟢 ĐÃ CẬP BẾN',
    eta: '08:00',
    plannedEtd: '21:45',
    totalContainers: 1247,
    completedContainers: 847,
    remainingContainers: 400,
    progressPercent: 68,
    // Timeline timestamps
    timestamps: {
      approaching: '07:45 - 12/08/2026',
      berthed: '08:32 - 12/08/2026',
      discharging: '08:45 - 12/08/2026',
      completed: 'Dự kiến 21:45 - 12/08/2026',
    },
  })

  // Hatch Progress Breakdown
  const [hatches, setHatches] = useState([
    { id: 'H01', name: 'Hầm Tàu 01', progress: 100, completed: 300, total: 300, status: 'Hoàn Thành 🟢', color: 'bg-emerald-100 text-emerald-950 border-emerald-400' },
    { id: 'H02', name: 'Hầm Tàu 02', progress: 71, completed: 213, total: 300, status: 'Đang Dỡ ⚡', color: 'bg-blue-100 text-blue-950 border-blue-400' },
    { id: 'H03', name: 'Hầm Tàu 03', progress: 63, completed: 189, total: 300, status: 'Đang Dỡ ⚡', color: 'bg-blue-100 text-blue-950 border-blue-400' },
    { id: 'H04', name: 'Hầm Tàu 04', progress: 49, completed: 145, total: 347, status: 'Đang Dỡ ⚡', color: 'bg-purple-100 text-purple-950 border-purple-400' },
  ])

  // Operation KPIs
  const [kpis] = useState({
    productivity: '28.5 moves/giờ',
    estimatedCompletion: '21:15 - 12/08/2026',
    plannedCompletion: '21:45 - 12/08/2026',
    operationDuration: '07 giờ 45 phút',
    scheduleStatus: 'Đúng Kế Hoạch 🟢',
  })

  // Bottom Timeline Event Log
  const [timelineLogs, setTimelineLogs] = useState([
    { time: '08:32', title: 'Tàu Cập Bến An Toàn (UC16)', desc: 'Tàu EVER GIVEN buộc dây cập cầu B-01 an toàn', type: 'berthed' },
    { time: '08:45', title: 'Bắt Đầu Dỡ Hàng (UC17)', desc: 'Cẩu bờ QC-01 & QC-02 bắt đầu dỡ hàng từ hầm tàu 01, 02', type: 'discharging' },
    { time: '16:30', title: 'Tiến Độ Khai Thác (UC54)', desc: 'Đã bốc dỡ 847 / 1,247 container (Đạt 68% tiến độ)', type: 'progress' },
  ])

  // Modals
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [addMovesInput, setAddMovesInput] = useState(25)

  // Real-time clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeString(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' - ' + now.toLocaleDateString('vi-VN'))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // ── ACTION HANDLERS (UC16, UC17, UC54) ──────────────────────────

  // UC16: Confirm Vessel Berthing
  const handleConfirmBerthing = () => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    const nowFull = nowTime + ' - ' + new Date().toLocaleDateString('vi-VN')

    setMainVessel(prev => ({
      ...prev,
      status: 'BERTHED',
      statusLabel: '🟢 ĐÃ CẬP BẾN',
      timestamps: { ...prev.timestamps, berthed: nowFull },
    }))

    setBerths(prev => prev.map(b => b.id === 'B-01' ? { ...b, status: 'BERTHED', statusBadge: '🟢 ĐÃ CẬP BẾN' } : b))

    setTimelineLogs(prev => [
      { time: nowTime, title: 'Tàu Cập Bến An Toàn (UC16)', desc: `Xác nhận tàu ${mainVessel.name} đã cập bến B-01 an toàn`, type: 'berthed' },
      ...prev,
    ])

    showToast(`⚓ UC16: Đã xác nhận tàu ${mainVessel.name} cập bến B-01 an toàn lúc ${nowTime}!`)
  }

  // UC17: Start Discharging
  const handleStartDischarging = () => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    const nowFull = nowTime + ' - ' + new Date().toLocaleDateString('vi-VN')

    setMainVessel(prev => ({
      ...prev,
      status: 'DISCHARGING',
      statusLabel: '🟣 ĐANG DỠ CONTAINER',
      timestamps: { ...prev.timestamps, discharging: nowFull },
    }))

    setBerths(prev => prev.map(b => b.id === 'B-01' ? { ...b, status: 'DISCHARGING', statusBadge: '🟣 ĐANG DỠ CONTAINER' } : b))

    setTimelineLogs(prev => [
      { time: nowTime, title: 'Bắt Đầu Dỡ Hàng (UC17)', desc: `Bắt đầu hoạt động dỡ container từ tàu ${mainVessel.name}`, type: 'discharging' },
      ...prev,
    ])

    showToast(`🏗️ UC17: Bắt đầu bốc dỡ container khỏi tàu ${mainVessel.name}! Cẩu bờ QC-01 & QC-02 đã kích hoạt.`)
  }

  // UC54: View / Update Progress
  const handleUpdateProgressSubmit = (e) => {
    e.preventDefault()
    const added = Number(addMovesInput) || 0
    const newCompleted = Math.min(mainVessel.totalContainers, mainVessel.completedContainers + added)
    const newRemaining = mainVessel.totalContainers - newCompleted
    const newPercent = Math.round((newCompleted / mainVessel.totalContainers) * 100)
    const isDone = newPercent >= 100

    setMainVessel(prev => ({
      ...prev,
      completedContainers: newCompleted,
      remainingContainers: newRemaining,
      progressPercent: newPercent,
      status: isDone ? 'COMPLETED' : 'DISCHARGING',
      statusLabel: isDone ? '🟢 ĐÃ HOÀN TẤT' : '🟣 ĐANG DỠ CONTAINER',
    }))

    setHatches(prev => prev.map(h => {
      if (h.id === 'H02') {
        const nextH2 = Math.min(h.total, h.completed + added)
        const nextP = Math.round((nextH2 / h.total) * 100)
        return { ...h, completed: nextH2, progress: nextP, status: nextP >= 100 ? 'Hoàn Thành 🟢' : 'Đang Dỡ ⚡' }
      }
      return h
    }))

    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    setTimelineLogs(prev => [
      { time: nowTime, title: 'Cập Nhật Tiến Độ Khai Thác (UC54)', desc: `Cập nhật tiến độ: +${added} TEU. Tổng dỡ: ${newCompleted} / ${mainVessel.totalContainers} TEU (${newPercent}%)`, type: 'progress' },
      ...prev,
    ])

    setShowProgressModal(false)
    showToast(`📊 UC54: Đã cập nhật tiến độ bốc dỡ +${added} TEU! Tiến độ tổng: ${newPercent}%`)
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen text-slate-900 relative">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-amber-100 text-amber-950 border-2 border-amber-400 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-3 z-[100] animate-bounce">
          <span className="text-amber-600">●</span>{toastMessage}
        </div>
      )}

      {/* ── 1. HEADER ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs font-mono">
            <span className="font-heading font-black text-orange-600 tracking-wider">NEXUSPORT</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 font-bold">Khai Thác Cảng</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-extrabold">Tổng Quan Cầu Bến</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold bg-orange-100 text-orange-950 border border-orange-300 px-3 py-0.5 rounded-full uppercase">
              NHÂN VIÊN CẦU BẾN
            </span>
            <h2 className="font-heading text-3xl font-extrabold text-slate-900">Tổng Quan Khai Thác Cầu Bến</h2>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">Xác nhận tàu cập bến (UC16), Bắt đầu dỡ hàng (UC17) và Theo dõi tiến độ khai thác (UC54).</p>
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
            <button onClick={() => showToast('🔔 Thông báo: Tàu MSC GULSUN chuẩn bị vào Cầu B-02 lúc 15:30.')}
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

      {/* ── 2. TOP SECTION — CURRENT BERTH ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-600">foundation</span>
            DANH SÁCH CÁC CẦU BẾN (CURRENT BERTH STATUS)
          </h3>
          <span className="text-xs font-mono text-slate-500 font-bold">3 Cầu bến chính · Cảng Container Tiên Sa</span>
        </div>

        {/* 3 Berth Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {berths.map(b => (
            <div key={b.id} className={`rounded-2xl border-2 p-5 shadow-xs transition-all ${
              b.isCurrent ? 'bg-orange-50/70 border-orange-400 ring-2 ring-orange-400/20' : 'bg-white border-slate-200'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-heading font-black text-slate-900 text-lg">{b.id} — {b.vesselName}</span>
                <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black font-mono ${b.statusColor}`}>
                  {b.statusBadge}
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono mt-3">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase font-sans font-bold block">IMO</span>
                    <strong className="text-slate-800">{b.imo}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase font-sans font-bold block">Tên Cầu Bến</span>
                    <strong className="text-slate-800">{b.name}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase font-sans font-bold block">ETA (Giờ Đến)</span>
                    <strong className="text-blue-800">{b.eta}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase font-sans font-bold block">ETD (Giờ Rời)</span>
                    <strong className="text-purple-800">{b.etd}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-[11px]">
                  <span className="font-sans text-slate-600 font-bold">Khối lượng Container:</span>
                  <span className="font-black text-slate-900">{b.containerCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. MAIN VESSEL CARD & TIMELINE ── */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
          <div>
            <span className="text-[10px] font-extrabold text-orange-600 uppercase font-mono tracking-wider">TÀU ĐANG KHAI THÁC TRỌNG TÂM (MAIN VESSEL)</span>
            <div className="flex items-center gap-3 mt-1">
              <h2 className="font-heading text-3xl font-black text-slate-900">{mainVessel.name}</h2>
              <span className="px-3 py-1 bg-slate-100 text-slate-900 border border-slate-300 font-mono font-bold text-xs rounded-xl">
                IMO: {mainVessel.imo}
              </span>
              <span className="px-3 py-1 bg-amber-100 text-amber-950 border border-amber-300 font-heading font-extrabold text-xs rounded-xl">
                Cầu: {mainVessel.berth}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-4 py-2 bg-emerald-100 text-emerald-950 border-2 border-emerald-400 rounded-2xl text-xs font-mono font-black shadow-xs">
              TRẠNG THÁI: {mainVessel.statusLabel}
            </span>
          </div>
        </div>

        {/* ETA & ETD Data Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">ETA (Giờ Đến)</span>
            <strong className="text-blue-800 font-extrabold text-sm">{mainVessel.eta}</strong>
          </div>
          <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Planned ETD (Dự Kiến Rời)</span>
            <strong className="text-purple-800 font-extrabold text-sm">{mainVessel.plannedEtd}</strong>
          </div>
          <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Trạng Thái Tác Nghiệp</span>
            <strong className="text-emerald-800 font-extrabold text-sm">{mainVessel.statusLabel}</strong>
          </div>
          <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Vị Trí Cầu Cảng</span>
            <strong className="text-slate-900 font-extrabold text-sm">{mainVessel.berth} (Cảng Tiên Sa)</strong>
          </div>
        </div>

        {/* Vessel Status Timeline Banner */}
        <div className="bg-slate-100 p-5 rounded-2xl border border-slate-200 space-y-3">
          <div className="text-xs font-extrabold text-slate-700 uppercase font-mono">MỐC THỜI GIAN TRẠNG THÁI TÀU (VESSEL STATUS TIMELINE):</div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            
            {/* Step 1: APPROACHING */}
            <div className={`flex-1 p-3 rounded-xl border-2 text-center ${
              mainVessel.status === 'APPROACHING' ? 'bg-amber-100 border-amber-400 text-amber-950 font-black' : 'bg-white border-slate-300 text-slate-700 font-bold'
            }`}>
              <div className="text-[10px] uppercase font-sans">1. ĐANG VÀO LUỒNG</div>
              <div className="text-xs mt-0.5 font-extrabold">{mainVessel.timestamps.approaching}</div>
            </div>

            <span className="text-slate-400 font-black">➔</span>

            {/* Step 2: BERTHED */}
            <div className={`flex-1 p-3 rounded-xl border-2 text-center ${
              mainVessel.status === 'BERTHED' ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-black ring-2 ring-emerald-400/30' : 'bg-white border-slate-300 text-slate-700 font-bold'
            }`}>
              <div className="text-[10px] uppercase font-sans">2. ĐÃ CẬP BẾN</div>
              <div className="text-xs mt-0.5 font-extrabold">{mainVessel.timestamps.berthed}</div>
            </div>

            <span className="text-slate-400 font-black">➔</span>

            {/* Step 3: DISCHARGING */}
            <div className={`flex-1 p-3 rounded-xl border-2 text-center ${
              mainVessel.status === 'DISCHARGING' ? 'bg-blue-100 border-blue-400 text-blue-950 font-black ring-2 ring-blue-400/30' : 'bg-white border-slate-300 text-slate-700 font-bold'
            }`}>
              <div className="text-[10px] uppercase font-sans">3. ĐANG DỠ CONTAINER</div>
              <div className="text-xs mt-0.5 font-extrabold">{mainVessel.timestamps.discharging}</div>
            </div>

            <span className="text-slate-400 font-black">➔</span>

            {/* Step 4: COMPLETED */}
            <div className={`flex-1 p-3 rounded-xl border-2 text-center ${
              mainVessel.status === 'COMPLETED' ? 'bg-purple-100 border-purple-400 text-purple-950 font-black' : 'bg-white border-slate-300 text-slate-700 font-bold'
            }`}>
              <div className="text-[10px] uppercase font-sans">4. HOÀN TẤT KHAI THÁC</div>
              <div className="text-xs mt-0.5 font-extrabold">{mainVessel.timestamps.completed}</div>
            </div>

          </div>
        </div>

        {/* ── 4. ACTION AREA (DYNAMIC BUTTONS UC16, UC17, UC54) ── */}
        <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-200 space-y-3">
          <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-600">touch_app</span>
            KHU VỰC THAO TÁC THEO TRẠNG THÁI TÀU (ACTION AREA)
          </div>

          <div className="flex flex-wrap items-center gap-4">
            
            {/* UC16: If Approaching -> Show [ CONFIRM BERTHING ] */}
            {mainVessel.status === 'APPROACHING' && (
              <button onClick={handleConfirmBerthing}
                className="px-8 py-3.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border-2 border-amber-400 rounded-xl font-black text-sm shadow-md flex items-center gap-2 cursor-pointer transition-all">
                <span className="material-symbols-outlined text-lg">anchor</span>
                [ XÁC NHẬN TÀU CẬP BẾN (UC16) ]
              </button>
            )}

            {/* UC17: If Berthed -> Show [ START DISCHARGING ] */}
            {mainVessel.status === 'BERTHED' && (
              <button onClick={handleStartDischarging}
                className="px-8 py-3.5 bg-orange-100 hover:bg-orange-200 text-orange-950 border-2 border-orange-400 rounded-xl font-black text-sm shadow-md flex items-center gap-2 cursor-pointer transition-all">
                <span className="material-symbols-outlined text-lg">precision_manufacturing</span>
                [ BẮT ĐẦU DỠ HÀNG (UC17) ]
              </button>
            )}

            {/* UC54: If Discharging -> Show [ VIEW / UPDATE PROGRESS ] */}
            {(mainVessel.status === 'DISCHARGING' || mainVessel.status === 'BERTHED') && (
              <button onClick={() => setShowProgressModal(true)}
                className="px-8 py-3.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-2 border-emerald-400 rounded-xl font-black text-sm shadow-md flex items-center gap-2 cursor-pointer transition-all">
                <span className="material-symbols-outlined text-lg">rate_review</span>
                [ XEM & CẬP NHẬT TIẾN ĐỘ (UC54) ]
              </button>
            )}

            {mainVessel.status === 'COMPLETED' && (
              <div className="px-6 py-3 bg-purple-100 text-purple-950 border-2 border-purple-400 rounded-xl font-black text-xs">
                ✓ KHAI THÁC HOÀN TẤT 100%
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── 5. OPERATION OVERVIEW (PROGRESS BAR LỚN) ── */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">bar_chart</span>
            TỔNG QUAN TIẾN ĐỘ DỠ HÀNG (OPERATION OVERVIEW)
          </h3>
          <span className="text-xs font-mono font-black text-emerald-700">Tiến độ tổng thể: {mainVessel.progressPercent}%</span>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Tổng Số Container</span>
            <strong className="text-slate-900 font-black text-lg">{mainVessel.totalContainers.toLocaleString()} TEU</strong>
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-300">
            <span className="text-[10px] text-emerald-800 uppercase font-sans font-bold block">Đã Hoàn Thành</span>
            <strong className="text-emerald-950 font-black text-lg">{mainVessel.completedContainers.toLocaleString()} TEU</strong>
          </div>
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-300">
            <span className="text-[10px] text-amber-800 uppercase font-sans font-bold block">Còn Phải Dỡ</span>
            <strong className="text-amber-950 font-black text-lg">{mainVessel.remainingContainers.toLocaleString()} TEU</strong>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-300">
            <span className="text-[10px] text-blue-800 uppercase font-sans font-bold block">Phần Trăm Tiến Độ</span>
            <strong className="text-blue-950 font-black text-lg">{mainVessel.progressPercent}%</strong>
          </div>
        </div>

        {/* Large Progress Bar */}
        <div className="bg-slate-100 p-5 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="font-sans font-extrabold text-slate-700">TIẾN ĐỘ THỰC TẾ CẦU B-01:</span>
            <span className="font-black text-slate-900 text-sm">
              {mainVessel.completedContainers} / {mainVessel.totalContainers} TEU — <strong className="text-emerald-700 font-black">{mainVessel.progressPercent}%</strong>
            </span>
          </div>
          <div className="w-full bg-slate-300 h-5 rounded-full overflow-hidden shadow-inner border border-slate-300 relative">
            <div className="bg-emerald-600 h-full rounded-full transition-all duration-500 shadow-md" style={{ width: `${mainVessel.progressPercent}%` }}></div>
          </div>
        </div>
      </div>

      {/* ── 6 & 7. HATCH PROGRESS & OPERATION KPI ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 6. HATCH PROGRESS */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
            <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-600">view_module</span>
              TIẾN ĐỘ THEO HẦM TÀU (HATCH PROGRESS)
            </h3>
            <span className="text-xs font-mono font-bold text-slate-500">4 Hầm tác nghiệp</span>
          </div>

          <div className="space-y-3">
            {hatches.map(h => (
              <div key={h.id} className="p-4 bg-slate-100 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-heading font-black text-slate-900 text-sm">{h.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900">{h.completed} / {h.total} TEU ({h.progress}%)</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black font-sans ${h.color}`}>
                      {h.status}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-300 h-3 rounded-full overflow-hidden border border-slate-300">
                  <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${h.progress}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 7. OPERATION KPI */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
              <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">speed</span>
                CHỈ SỐ HIỆU SUẤT TÁC NGHIỆP (OPERATION KPI)
              </h3>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-black border bg-emerald-100 text-emerald-950 border-emerald-400">
                {kpis.scheduleStatus}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Năng Suất Cẩu Hiện Tại</span>
                <strong className="text-base text-blue-900 font-black">{kpis.productivity}</strong>
              </div>

              <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Dự Kiến Hoàn Thành</span>
                <strong className="text-base text-emerald-900 font-black">{kpis.estimatedCompletion}</strong>
              </div>

              <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Kế Hoạch Hoàn Thành</span>
                <strong className="text-base text-purple-900 font-black">{kpis.plannedCompletion}</strong>
              </div>

              <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Thời Gian Tác Nghiệp</span>
                <strong className="text-base text-slate-900 font-black">{kpis.operationDuration}</strong>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-sans text-emerald-950 font-extrabold flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
            Năng suất cẩu bờ QC đạt 28.5 moves/giờ — Tiến độ bốc dỡ hoàn toàn đúng kế hoạch.
          </div>
        </div>

      </div>

      {/* ── 8. BOTTOM SECTION — OPERATION TIMELINE ── */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-600">history</span>
            NHẬT KÝ KHAI THÁC TẠI CẦU BẾN (OPERATION TIMELINE)
          </h3>
          <p className="text-xs text-slate-600">Lịch sử các sự kiện mốc khai thác tàu tại Cầu B-01</p>
        </div>

        <div className="relative pl-6 border-l-2 border-slate-300 space-y-4 font-mono text-xs">
          {timelineLogs.map((log, idx) => (
            <div key={idx} className="relative">
              <span className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-white ${
                log.type === 'berthed' ? 'bg-emerald-500' : log.type === 'discharging' ? 'bg-orange-500' : 'bg-blue-600'
              }`}></span>
              <div className="font-black text-slate-900 text-sm font-sans">{log.time} — {log.title}</div>
              <div className="text-xs text-slate-600 font-sans mt-0.5">{log.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── PROGRESS UPDATE MODAL (UC54 POPUP) ── */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 font-sans">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-xl">rate_review</span>
                <h3 className="font-heading text-lg font-extrabold text-slate-900">Cập Nhật Tiến Độ Cầu Bến (UC54)</h3>
              </div>
              <button onClick={() => setShowProgressModal(false)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleUpdateProgressSubmit} className="space-y-4 text-xs font-bold">
              <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-200 space-y-1 font-mono">
                <div className="text-slate-600 text-[10px] font-sans">Tiến độ hiện tại:</div>
                <div className="text-slate-900 text-base font-black">
                  {mainVessel.completedContainers} / {mainVessel.totalContainers} TEU ({mainVessel.progressPercent}%)
                </div>
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Số TEU/Moves Vừa Dỡ Thành Công *</label>
                <div className="flex gap-2 mb-2">
                  {[10, 25, 50, 100].map(val => (
                    <button type="button" key={val} onClick={() => setAddMovesInput(val)}
                      className={`flex-1 py-2 rounded-xl border-2 text-xs font-mono font-black transition-all cursor-pointer ${
                        addMovesInput === val ? 'bg-emerald-200 text-emerald-950 border-emerald-500' : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
                      }`}>
                      +{val}
                    </button>
                  ))}
                </div>

                <input type="number" min="1" max={mainVessel.remainingContainers} value={addMovesInput} onChange={e => setAddMovesInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900" required />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowProgressModal(false)} className="flex-1 h-11 border border-slate-300 text-slate-700 rounded-xl font-extrabold text-xs hover:bg-slate-100">
                  Hủy
                </button>
                <button type="submit" className="flex-1 h-11 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-2 border-emerald-400 rounded-xl font-black text-xs shadow-xs">
                  Xác Nhận Cập Nhật Tiến Độ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
