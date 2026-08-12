import React, { useState, useEffect, useMemo } from 'react'

// Initial Hatch Data in Vietnamese
const INITIAL_HATCHES = [
  { id: 'H01', name: 'Hầm Tàu 01', planned: 250, completed: 250, remaining: 0, progress: 100, status: 'Hoàn Thành', statusBadge: 'Hoàn Thành 🟢', statusColor: 'bg-emerald-100 text-emerald-950 border-emerald-400' },
  { id: 'H02', name: 'Hầm Tàu 02', planned: 310, completed: 220, remaining: 90, progress: 71, status: 'Đang Khai Thác', statusBadge: 'Đang Khai Thác ⚡', statusColor: 'bg-blue-100 text-blue-950 border-blue-400' },
  { id: 'H03', name: 'Hầm Tàu 03', planned: 280, completed: 177, remaining: 103, progress: 63, status: 'Đang Khai Thác', statusBadge: 'Đang Khai Thác ⚡', statusColor: 'bg-blue-100 text-blue-950 border-blue-400' },
  { id: 'H04', name: 'Hầm Tàu 04', planned: 407, completed: 200, remaining: 207, progress: 49, status: 'Đang Khai Thác', statusBadge: 'Đang Khai Thác ⚡', statusColor: 'bg-purple-100 text-purple-950 border-purple-400' },
]

export default function DischargingProgress() {
  const [hatches, setHatches] = useState(INITIAL_HATCHES)
  const [selectedHatchId, setSelectedHatchId] = useState('H02')
  const [completedInput, setCompletedInput] = useState(220)
  const [notesInput, setNotesInput] = useState('')
  
  const [toastMessage, setToastMessage] = useState('')
  const [lastUpdateInfo, setLastUpdateInfo] = useState({
    time: '16:25',
    updatedBy: 'Trần Văn Hải (Nhân Viên Cầu Bến)',
    hatchName: 'Hầm Tàu 02',
    addedCount: 25,
    newProgress: 71,
  })

  // Live Timer State (08:42:16 running timer)
  const [timerSeconds, setTimerSeconds] = useState(8 * 3600 + 42 * 60 + 16)

  // Bottom Recent Updates List
  const [recentUpdates, setRecentUpdates] = useState([
    { time: '16:25', hatch: 'Hầm Tàu 02', added: '+25 container', updatedBy: 'Trần Văn Hải', newCompleted: 220 },
    { time: '16:10', hatch: 'Hầm Tàu 03', added: '+18 container', updatedBy: 'Trần Văn Hải', newCompleted: 177 },
    { time: '15:55', hatch: 'Hầm Tàu 04', added: '+20 container', updatedBy: 'Trần Văn Hải', newCompleted: 200 },
  ])

  // Live operation timer increment
  useEffect(() => {
    const timer = setInterval(() => {
      setTimerSeconds(prev => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Format running timer HH:MM:SS
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

  // Calculate Overall Progress
  const overall = useMemo(() => {
    const totalPlanned = hatches.reduce((sum, h) => sum + h.planned, 0)
    const totalCompleted = hatches.reduce((sum, h) => sum + h.completed, 0)
    const totalRemaining = totalPlanned - totalCompleted
    const percent = Math.round((totalCompleted / totalPlanned) * 100)
    return { planned: totalPlanned, completed: totalCompleted, remaining: totalRemaining, percent }
  }, [hatches])

  // When selected hatch changes, pre-fill completedInput
  const handleSelectHatchChange = (e) => {
    const id = e.target.value
    setSelectedHatchId(id)
    const targetH = hatches.find(h => h.id === id)
    if (targetH) {
      setCompletedInput(targetH.completed)
    }
  }

  // Quick add count buttons (+10, +25, +50)
  const handleQuickAdd = (amount) => {
    const targetH = hatches.find(h => h.id === selectedHatchId)
    if (!targetH) return
    const nextVal = Math.min(targetH.planned, completedInput + amount)
    setCompletedInput(nextVal)
  }

  // Submit Update Progress
  const handleUpdateProgressSubmit = (e) => {
    e.preventDefault()
    const targetH = hatches.find(h => h.id === selectedHatchId)
    if (!targetH) return

    const newCompleted = Math.min(targetH.planned, Number(completedInput) || 0)
    const addedCount = newCompleted - targetH.completed

    if (addedCount <= 0 && newCompleted === targetH.completed) {
      showToast('⚠️ Vui lòng nhập số container dỡ đã thay đổi (khác với hiện tại)!')
      return
    }

    const newRemaining = targetH.planned - newCompleted
    const newProgress = Math.round((newCompleted / targetH.planned) * 100)
    const isDone = newCompleted >= targetH.planned

    // Update Hatches state
    setHatches(prev => prev.map(h => {
      if (h.id === selectedHatchId) {
        return {
          ...h,
          completed: newCompleted,
          remaining: newRemaining,
          progress: newProgress,
          status: isDone ? 'Hoàn Thành' : 'Đang Khai Thác',
          statusBadge: isDone ? 'Hoàn Thành 🟢' : 'Đang Khai Thác ⚡',
          statusColor: isDone ? 'bg-emerald-100 text-emerald-950 border-emerald-400' : 'bg-blue-100 text-blue-950 border-blue-400',
        }
      }
      return h
    }))

    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

    // Update last feedback info
    setLastUpdateInfo({
      time: nowTime,
      updatedBy: 'Trần Văn Hải (Nhân Viên Cầu Bến)',
      hatchName: targetH.name,
      addedCount: addedCount > 0 ? addedCount : 0,
      newProgress: newProgress,
    })

    // Prepend to Recent Updates list
    setRecentUpdates(prev => [
      {
        time: nowTime,
        hatch: targetH.name,
        added: addedCount > 0 ? `+${addedCount} container` : `${newCompleted} container`,
        updatedBy: 'Trần Văn Hải',
        newCompleted: newCompleted,
      },
      ...prev,
    ])

    showToast(`✅ Đã cập nhật tiến độ ${targetH.name}: ${newCompleted} / ${targetH.planned} TEU (${newProgress}%). Đã đồng bộ realtime!`)
  }

  const activeHatch = hatches.find(h => h.id === selectedHatchId) || hatches[1]

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
            <span className="text-slate-600 font-bold">Khai Thác Cầu Bến</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-extrabold">Tiến Độ Dỡ Container</span>
          </div>

          <div className="flex items-center gap-3">
            <h2 className="font-heading text-3xl font-black text-slate-900">Tiến Độ Dỡ Container Theo Hầm Tàu</h2>
            <span className="px-3 py-1 bg-purple-100 text-purple-950 border border-purple-400 font-mono font-black text-xs rounded-xl">
              TRẠNG THÁI: ĐANG DỠ CONTAINER 🟣
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">Tàu: <strong className="text-slate-900 font-black">EVER GIVEN</strong> · Cầu Bến: <strong className="text-amber-900 font-black">B-01</strong> · Cập nhật số container thực tế dỡ theo từng Hầm tàu thời gian thực.</p>
        </div>

        {/* Right Corner: Operation Timer & Live Indicator */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-2xl border border-slate-800 text-xs font-mono font-bold shadow-sm">
            <span className="text-amber-400 font-extrabold uppercase font-sans">THỜI GIAN TÁC NGHIỆP:</span>
            <span className="text-base text-emerald-400 font-black tracking-wider">{timerDisplay}</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-700 uppercase font-sans font-black">TRỰC TUYẾN (LIVE)</span>
          </div>
        </div>
      </div>

      {/* ── PERMISSION NOTICE BANNER ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
        <span className="material-symbols-outlined text-blue-600 text-2xl">info</span>
        <div className="text-xs text-blue-900 font-medium">
          <strong className="font-extrabold">PHÂN QUYỀN CẬP NHẬT:</strong> Nhân viên Cầu bến chỉ cập nhật số lượng container thực tế dỡ (`Đã Dỡ`). Số lượng kế hoạch (`Kế Hoạch`) do Điều độ Dispatcher/Operator thiết lập và không thể chỉnh sửa tại đây.
        </div>
      </div>

      {/* ── 2. OVERALL PROGRESS (PROGRESS BAR LỚN) ── */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">donut_large</span>
            TỔNG QUAN TIẾN ĐỘ DỠ CONTAINER (OVERALL PROGRESS)
          </h3>
          <span className="text-xs font-mono font-black text-emerald-700">Hoàn thành: {overall.percent}%</span>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Tổng Số Container</span>
            <strong className="text-slate-900 font-black text-xl">{overall.planned.toLocaleString()} TEU</strong>
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-300">
            <span className="text-[10px] text-emerald-800 uppercase font-sans font-bold block">Đã Hoàn Thành</span>
            <strong className="text-emerald-950 font-black text-xl">{overall.completed.toLocaleString()} TEU</strong>
          </div>
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-300">
            <span className="text-[10px] text-amber-800 uppercase font-sans font-bold block">Còn Phải Dỡ</span>
            <strong className="text-amber-950 font-black text-xl">{overall.remaining.toLocaleString()} TEU</strong>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-300">
            <span className="text-[10px] text-blue-800 uppercase font-sans font-bold block">Tỷ Lệ Tiến Độ</span>
            <strong className="text-blue-950 font-black text-xl">{overall.percent}%</strong>
          </div>
        </div>

        {/* Large Progress Bar */}
        <div className="bg-slate-100 p-5 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="font-sans font-extrabold text-slate-700">TIẾN ĐỘ TỔNG THỂ TÀU EVER GIVEN:</span>
            <span className="font-black text-slate-900 text-sm">
              {overall.completed} / {overall.planned} TEU — <strong className="text-emerald-700 font-black">{overall.percent}%</strong>
            </span>
          </div>
          <div className="w-full bg-slate-300 h-5 rounded-full overflow-hidden shadow-inner border border-slate-300 relative">
            <div className="bg-emerald-600 h-full rounded-full transition-all duration-500 shadow-md" style={{ width: `${overall.percent}%` }}></div>
          </div>
        </div>
      </div>

      {/* ── 3 & 4. HATCH PROGRESS TABLE & UPDATE FORM ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2 Cols: HATCH PROGRESS TABLE */}
        <div className="lg:col-span-2 bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-600">grid_view</span>
              BẢNG TIẾN ĐỘ THEO TỪNG HẦM TÀU (HATCH PROGRESS TABLE)
            </h3>
            <span className="text-xs font-mono font-bold text-slate-500">4 Hầm tác nghiệp</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                  {['Hầm Tàu', 'Kế Hoạch', 'Đã Dỡ', 'Còn Lại', 'Thanh Tiến Độ', 'Tiến Độ', 'Trạng Thái'].map(h => (
                    <th key={h} className="py-3 px-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {hatches.map(h => (
                  <tr key={h.id} className={`hover:bg-slate-100/60 cursor-pointer ${selectedHatchId === h.id ? 'bg-orange-50/70 font-extrabold' : ''}`}
                    onClick={() => { setSelectedHatchId(h.id); setCompletedInput(h.completed); }}>
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
                      <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${h.statusColor}`}>
                        {h.statusBadge}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-[11px] font-sans text-slate-500 flex items-center gap-1.5 pt-1">
            <span className="material-symbols-outlined text-sm text-slate-400">info</span>
            Mẹo: Click vào bất kỳ hàng Hầm tàu nào trong bảng để chọn hầm cần cập nhật tiến độ bên phải.
          </div>
        </div>

        {/* Right 1 Col: UPDATE PROGRESS FORM */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <span className="material-symbols-outlined text-orange-600 text-xl">edit_square</span>
              <h3 className="font-heading text-base font-extrabold text-slate-900">CẬP NHẬT TIẾN ĐỘ (UPDATE PROGRESS)</h3>
            </div>

            <form onSubmit={handleUpdateProgressSubmit} className="mt-4 space-y-4 text-xs font-bold">
              {/* Select Hatch */}
              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Chọn Hầm Tàu (Select Hatch) *</label>
                <select value={selectedHatchId} onChange={handleSelectHatchChange}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-extrabold text-sm focus:outline-none focus:border-slate-900">
                  {hatches.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.completed}/{h.planned} TEU — {h.progress}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* Readonly Planned Quantity */}
              <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 flex justify-between items-center font-mono">
                <span className="text-[10px] text-slate-600 uppercase font-sans font-bold">Kế Hoạch Dỡ (Planned):</span>
                <strong className="text-slate-900 font-black text-sm">{activeHatch.planned} TEU (Cố định)</strong>
              </div>

              {/* Quick add buttons */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-600 uppercase text-[10px] font-extrabold">Số Container Đã Dỡ (Completed) *</label>
                  <span className="text-[10px] text-slate-500 font-mono">Cộng nhanh:</span>
                </div>

                <div className="flex gap-2 mb-2">
                  {[10, 25, 50].map(val => (
                    <button type="button" key={val} onClick={() => handleQuickAdd(val)}
                      className="flex-1 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border border-emerald-400 rounded-lg text-xs font-mono font-black transition-all cursor-pointer">
                      +{val} TEU
                    </button>
                  ))}
                </div>

                <input type="number" min="0" max={activeHatch.planned} value={completedInput} onChange={e => setCompletedInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-sm font-mono font-black text-slate-900 focus:outline-none focus:border-slate-900" required />
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Ghi Chú Tiến Độ (Notes)</label>
                <textarea rows="2" value={notesInput} onChange={e => setNotesInput(e.target.value)}
                  placeholder="Ghi chú hầm tàu hoặc lý do thay đổi..."
                  className="w-full p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-normal text-slate-900 focus:outline-none focus:border-slate-900 resize-none" />
              </div>

              {/* Submit Button */}
              <button type="submit"
                className="w-full h-12 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-2 border-emerald-400 font-black text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all">
                <span className="material-symbols-outlined text-lg">rate_review</span>
                [ 📦 CẬP NHẬT TIẾN ĐỘ ]
              </button>
            </form>
          </div>

          {/* Realtime Synced Feedback Display */}
          <div className="bg-emerald-50 border-2 border-emerald-400 p-3.5 rounded-2xl space-y-1.5 text-xs font-mono">
            <div className="flex items-center gap-2 text-emerald-950 font-black text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              🟢 Tiến độ đã đồng bộ realtime với trung tâm Operator
            </div>
            <div className="text-[10px] text-emerald-900 space-y-0.5 pt-1 border-t border-emerald-200">
              <div>Thời gian cập nhật: <strong>{lastUpdateInfo.time}</strong></div>
              <div>Người cập nhật: <strong>{lastUpdateInfo.updatedBy}</strong></div>
              <div>Tiến độ mới: <strong>{lastUpdateInfo.hatchName} ({lastUpdateInfo.newProgress}%)</strong></div>
            </div>
          </div>
        </div>

      </div>

      {/* ── 5. RECENT UPDATES (LỊCH SỬ CẬP NHẬT GẦN ĐÂY) ── */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">history</span>
            LỊCH SỬ CẬP NHẬT GẦN ĐÂY (RECENT UPDATES)
          </h3>
          <p className="text-xs text-slate-600">Nhật ký ghi nhận số container dỡ thành công theo thời gian thực tại các hầm tàu</p>
        </div>

        <div className="space-y-2.5 font-mono text-xs">
          {recentUpdates.map((item, idx) => (
            <div key={idx} className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-slate-200/60 transition-all">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 bg-white border border-slate-300 font-bold text-slate-700 rounded-lg text-[11px]">
                  {item.time}
                </span>
                <span className="font-black text-slate-900 text-sm font-heading">{item.hatch}</span>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold text-xs rounded-full">
                  {item.added}
                </span>
              </div>

              <div className="text-[11px] text-slate-600 font-sans">
                Cập nhật bởi <strong className="text-slate-900 font-extrabold">{item.updatedBy}</strong> · Đã đạt <strong className="text-blue-900 font-extrabold">{item.newCompleted} TEU</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
