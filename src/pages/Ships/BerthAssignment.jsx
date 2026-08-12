import React, { useState, useMemo } from 'react'
import { INITIAL_BERTHS, INITIAL_ASSIGNED_SLOTS, UNASSIGNED_VESSELS } from '../../data/berthAssignmentData'

const STATUS_BADGE = {
  'Đang Xếp Dỡ':   'bg-purple-100 text-purple-900 border-purple-300',
  'Đã Cập Cầu':    'bg-amber-100 text-amber-900 border-amber-300',
  'Đang Vào Cảng': 'bg-blue-100 text-blue-900 border-blue-300',
  'Lập Lịch':      'bg-slate-100 text-slate-800 border-slate-300',
  'Đã Hoàn Thành': 'bg-green-100 text-green-900 border-green-300',
  'Chậm Lịch':     'bg-red-100 text-red-900 border-red-300',
}

export default function BerthAssignment() {
  const [berths, setBerths] = useState(INITIAL_BERTHS)
  const [assignedSlots, setAssignedSlots] = useState(INITIAL_ASSIGNED_SLOTS)
  const [unassignedVessels, setUnassignedVessels] = useState(UNASSIGNED_VESSELS)
  const [toastMessage, setToastMessage] = useState('')

  // Drawer / Modal states
  const [showDrawer, setShowDrawer] = useState(false)
  const [selectedVessel, setSelectedVessel] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [drawerBerth, setDrawerBerth] = useState('B-01')
  const [drawerStartTime, setDrawerStartTime] = useState('10:00')
  const [drawerEndTime, setDrawerEndTime] = useState('18:00')

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // ── KPI Calculations ───────────────────────────────────────
  const kpi = useMemo(() => {
    const totalBerths = berths.length
    const occupiedCount = new Set(assignedSlots.map(s => s.berthId)).size
    const availableCount = totalBerths - occupiedCount
    const arrivingCount = unassignedVessels.filter(v => v.status === 'Đang Vào Cảng').length

    let conflictCount = 0
    for (let i = 0; i < assignedSlots.length; i++) {
      for (let j = i + 1; j < assignedSlots.length; j++) {
        const a = assignedSlots[i]
        const b = assignedSlots[j]
        if (a.berthId === b.berthId) {
          if (Math.max(a.startHour, b.startHour) < Math.min(a.endHour, b.endHour)) {
            conflictCount++
          }
        }
      }
    }
    return { availableCount, occupiedCount, arrivingCount, conflictCount }
  }, [berths, assignedSlots, unassignedVessels])

  // ── Live Conflict Detector for Drawer ──────────────────────
  const drawerConflict = useMemo(() => {
    const startNum = parseFloat(drawerStartTime.replace(':', '.'))
    const endNum = parseFloat(drawerEndTime.replace(':', '.'))
    if (startNum >= endNum) return { conflict: true, reason: 'Thời gian bắt đầu phải trước thời gian kết thúc.' }

    const existing = assignedSlots.filter(s => s.berthId === drawerBerth && s.id !== selectedSlot?.id)
    for (const slot of existing) {
      if (Math.max(startNum, slot.startHour) < Math.min(endNum, slot.endHour)) {
        return {
          conflict: true,
          conflictingVessel: slot.vesselName,
          overlapTime: `${slot.startTime} - ${slot.endTime}`,
          reason: `Phát hiện trùng lịch với tàu ${slot.vesselName} (Khung giờ ${slot.startTime} - ${slot.endTime}) tại cùng cầu bến.`,
        }
      }
    }
    return { conflict: false }
  }, [drawerBerth, drawerStartTime, drawerEndTime, assignedSlots, selectedSlot])

  // ── Handlers ──────────────────────────────────────────────
  const openAssignModal = (vessel) => {
    setSelectedVessel(vessel)
    setSelectedSlot(null)
    setDrawerBerth('B-04')
    setDrawerStartTime(vessel.eta)
    setDrawerEndTime(vessel.etd)
    setShowDrawer(true)
  }

  const openEditSlotModal = (slot) => {
    setSelectedSlot(slot)
    setSelectedVessel({
      id: slot.vesselId,
      vesselName: slot.vesselName,
      imo: slot.imo,
      shippingLine: slot.shippingLine,
      containerCount: slot.containerCount,
      cargoType: slot.cargoType,
    })
    setDrawerBerth(slot.berthId)
    setDrawerStartTime(slot.startTime)
    setDrawerEndTime(slot.endTime)
    setShowDrawer(true)
  }

  const handleConfirmAssignment = () => {
    if (drawerConflict.conflict) return
    const berthObj = berths.find(b => b.id === drawerBerth)

    if (selectedSlot) {
      setAssignedSlots(prev => prev.map(s => s.id === selectedSlot.id ? {
        ...s,
        berthId: drawerBerth,
        berthName: berthObj.name,
        startTime: drawerStartTime,
        endTime: drawerEndTime,
        startHour: parseFloat(drawerStartTime.replace(':', '.')),
        endHour: parseFloat(drawerEndTime.replace(':', '.')),
      } : s))
      showToast(`⚓ Đã cập nhật thành công lịch gán ${berthObj.name} cho tàu ${selectedSlot.vesselName}`)
    } else if (selectedVessel) {
      const newSlot = {
        id: `SLOT-${Date.now()}`,
        vesselId: selectedVessel.id,
        vesselName: selectedVessel.vesselName,
        imo: selectedVessel.imo,
        shippingLine: selectedVessel.shippingLine,
        berthId: drawerBerth,
        berthName: berthObj.name,
        startTime: drawerStartTime,
        endTime: drawerEndTime,
        startHour: parseFloat(drawerStartTime.replace(':', '.')),
        endHour: parseFloat(drawerEndTime.replace(':', '.')),
        containerCount: selectedVessel.containerCount,
        cargoType: selectedVessel.cargoType,
        status: 'Đã Cập Cầu',
        color: 'bg-emerald-600 border-emerald-700 text-white',
      }
      setAssignedSlots(prev => [...prev, newSlot])
      setUnassignedVessels(prev => prev.filter(v => v.id !== selectedVessel.id))
      showToast(`✅ Phân bổ thành công ${berthObj.name} cho tàu ${selectedVessel.vesselName}`)
    }

    setShowDrawer(false)
  }

  const handleRemoveAssignment = (slotId) => {
    const slot = assignedSlots.find(s => s.id === slotId)
    if (!slot) return
    setAssignedSlots(prev => prev.filter(s => s.id !== slotId))
    setUnassignedVessels(prev => [...prev, {
      id: slot.vesselId,
      vesselName: slot.vesselName,
      imo: slot.imo,
      shippingLine: slot.shippingLine,
      eta: slot.startTime,
      etd: slot.endTime,
      startHour: slot.startHour,
      endHour: slot.endHour,
      containerCount: slot.containerCount,
      cargoType: slot.cargoType,
      status: 'Đang Vào Cảng',
    }])
    setShowDrawer(false)
    showToast(`🗑️ Đã hủy phân bổ cầu cảng cho tàu ${slot.vesselName}`)
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen relative">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-slate-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-extrabold flex items-center gap-3 z-[100] animate-bounce border border-blue-500">
          <span className="text-blue-400">●</span>{toastMessage}
        </div>
      )}

      {/* ── 1. HEADER ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold bg-blue-100 text-blue-800 px-3 py-0.5 rounded-full uppercase">ĐIỀU ĐỘ CẢNG (DISPATCHER)</span>
            <span className="text-xs font-mono text-slate-600">Cảng Tiên Sa · Điều phối cầu bến</span>
          </div>
          <h2 className="font-heading text-3xl font-extrabold text-slate-900">Phân Bổ Cầu Bến (Berth Assignment)</h2>
          <p className="text-xs text-slate-600 mt-0.5">Phân bổ vị trí cầu bến tối ưu cho tàu container và giám sát xung đột lịch chiếm dụng thời gian thực.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            TIMELINE HOẠT ĐỘNG: HÔM NAY 00:00 - 24:00
          </span>
        </div>
      </div>

      {/* ── 2. KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Cầu Bến Trống', kpi.availableCount, 'text-emerald-600', 'border-emerald-300', 'bg-emerald-50', 'door_open'],
          ['Cầu Bến Đang Chiếm', kpi.occupiedCount, 'text-amber-600', 'border-amber-300', 'bg-amber-50', 'anchor'],
          ['Tàu Đang Vào Cảng', kpi.arrivingCount, 'text-blue-600', 'border-blue-300', 'bg-blue-50', 'directions_boat'],
          ['Xung Đột Lịch Cầu', kpi.conflictCount, kpi.conflictCount > 0 ? 'text-red-600' : 'text-slate-600', kpi.conflictCount > 0 ? 'border-red-400 animate-pulse' : 'border-slate-200', kpi.conflictCount > 0 ? 'bg-red-50' : 'bg-white', 'warning'],
        ].map(([label, val, color, border, bg, icon]) => (
          <div key={label} className={`${bg} rounded-2xl border-2 ${border} p-4 shadow-sm flex justify-between items-center`}>
            <div>
              <span className="text-[10px] font-bold text-slate-600 uppercase">{label}</span>
              <div className={`text-3xl font-extrabold font-mono ${color} mt-0.5`}>{val}</div>
            </div>
            <span className={`material-symbols-outlined text-3xl ${color}`}>{icon}</span>
          </div>
        ))}
      </div>

      {/* ── 3. UNASSIGNED VESSEL PANEL ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-heading text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">notification_important</span>
              Danh Sách Tàu Chờ Phân Bổ Cầu Bến ({unassignedVessels.length})
            </h3>
            <p className="text-xs text-slate-600">Các tàu container đã/sắp đến cảng nhưng chưa được xếp vị trí cầu bến cụ thể</p>
          </div>
        </div>

        {unassignedVessels.length === 0 ? (
          <div className="bg-slate-100 rounded-xl p-6 text-center text-xs font-bold text-slate-600">
            ✓ Tất cả các tàu đến cảng trong ngày đã được phân bổ cầu bến hoàn tất.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  {['Tên Tàu & Hãng Tàu', 'Số IMO', 'ETA (Giờ Đến)', 'ETD (Giờ Đi)', 'Số Container', 'Loại Hàng', 'Trạng Thái', 'Thao Tác'].map(h => (
                    <th key={h} className={`py-3 px-4 ${h === 'Thao Tác' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {unassignedVessels.map(v => (
                  <tr key={v.id} className="hover:bg-slate-100/60">
                    <td className="py-3 px-4 font-sans font-extrabold text-slate-900">
                      <div>{v.vesselName}</div>
                      <div className="text-[10px] text-slate-600 font-normal font-mono">{v.shippingLine}</div>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-600">{v.imo}</td>
                    <td className="py-3 px-4 font-bold text-blue-700">{v.eta}</td>
                    <td className="py-3 px-4 font-bold text-purple-700">{v.etd}</td>
                    <td className="py-3 px-4 font-extrabold text-slate-900">{v.containerCount} TEU</td>
                    <td className="py-3 px-4 font-sans">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-bold text-[10px]">
                        {v.cargoType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${STATUS_BADGE[v.status] || 'bg-gray-100 text-gray-800'}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <button onClick={() => openAssignModal(v)}
                        className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-950 border border-blue-400 font-black text-xs rounded-xl shadow-xs flex items-center gap-1 ml-auto cursor-pointer">
                        <span className="material-symbols-outlined text-xs text-blue-800">anchor</span>
                        Phân Bổ Cầu Bến
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 4. BERTH TIMELINE (00:00 -> 24:00) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div>
            <h3 className="font-heading text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">schedule</span>
              Biểu Đồ Lịch Chiếm Dụng Cầu Bến (Timeline 24H)
            </h3>
            <p className="text-xs text-slate-600">Biểu diễn khung giờ tàu cập cầu và làm hàng tại từng vị trí bến từ 00:00 đến 24:00</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-extrabold">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-600"></span>Đang Xếp Dỡ</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-600"></span>Đã Cập Cầu</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-600"></span>Hàng Nhập Khẩu</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-teal-600"></span>Lập Lịch Dự Kiến</span>
          </div>
        </div>

        {/* Timeline Grid Container */}
        <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-slate-100/50">
          <div className="min-w-[900px] p-4">

            {/* Time Header Scale */}
            <div className="grid grid-cols-[140px_1fr] border-b border-slate-300 pb-2 mb-2 font-mono text-[10px] text-slate-600 font-bold">
              <div>CẦU BẾN / KHUNG GIỜ</div>
              <div className="grid grid-cols-12 text-center divide-x divide-slate-300">
                {['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00'].map(t => (
                  <div key={t}>{t}</div>
                ))}
              </div>
            </div>

            {/* Berths Rows */}
            <div className="space-y-3">
              {berths.map(berth => {
                const slotsOnBerth = assignedSlots.filter(s => s.berthId === berth.id)

                return (
                  <div key={berth.id} className="grid grid-cols-[140px_1fr] items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                    <div>
                      <div className="font-extrabold text-slate-900 text-xs">{berth.name}</div>
                      <div className="text-[10px] font-mono text-slate-600">Dài {berth.lengthMeters}m · Mớn {berth.maxDraft}m</div>
                      <span className={`inline-block mt-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full ${slotsOnBerth.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {slotsOnBerth.length > 0 ? `${slotsOnBerth.length} Tàu đang gán` : 'Cầu bến trống'}
                      </span>
                    </div>

                    <div className="relative h-14 bg-slate-100 rounded-xl border border-slate-300 overflow-hidden">
                      <div className="absolute inset-0 grid grid-cols-24 divide-x divide-slate-300/60 pointer-events-none">
                        {Array.from({ length: 24 }).map((_, i) => <div key={i} className="h-full"></div>)}
                      </div>

                      {slotsOnBerth.map(slot => {
                        const leftPct = (slot.startHour / 24) * 100
                        const widthPct = ((slot.endHour - slot.startHour) / 24) * 100

                        return (
                          <div key={slot.id}
                            onClick={() => openEditSlotModal(slot)}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            className={`absolute top-1 bottom-1 ${slot.color} rounded-lg p-2 shadow-md hover:scale-[1.01] transition-transform cursor-pointer overflow-hidden border flex flex-col justify-between group z-10`}>
                            <div className="flex justify-between items-center font-bold text-[11px] truncate">
                              <span className="truncate">{slot.vesselName}</span>
                              <span className="font-mono text-[9px] opacity-90">{slot.startTime}-{slot.endTime}</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] font-mono opacity-90">
                              <span>{slot.containerCount} TEU</span>
                              <span className="uppercase text-[8px] bg-black/20 px-1.5 py-0.5 rounded">{slot.cargoType}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

          </div>
        </div>
      </div>

      {/* ── 5. ASSIGN / REASSIGN BERTH DRAWER ── */}
      {showDrawer && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-y-auto animate-in zoom-in-95 duration-200 font-sans flex flex-col">

            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-extrabold text-slate-600 uppercase font-mono">
                  {selectedSlot ? 'THAY ĐỔI CẦU BẾN PHÂN BỔ' : 'PHÂN BỔ CẦU BẾN MỚI'}
                </span>
                <h3 className="font-heading text-xl font-extrabold text-slate-900 mt-0.5">
                  {selectedVessel?.vesselName || selectedSlot?.vesselName}
                </h3>
              </div>
              <button onClick={() => setShowDrawer(false)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">

              <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-600 uppercase block font-sans font-bold">Hãng Tàu (Carrier)</span>
                  <span className="font-bold text-slate-900">{selectedVessel?.shippingLine}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-600 uppercase block font-sans font-bold">Số Lượng Container</span>
                  <span className="font-bold text-slate-900">{selectedVessel?.containerCount} TEU</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Chọn Cầu Cảng *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {berths.map(b => (
                      <button key={b.id} type="button" onClick={() => setDrawerBerth(b.id)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${drawerBerth === b.id ? 'bg-blue-600 text-white border-blue-600 font-extrabold shadow' : 'bg-slate-100 border-slate-300 text-slate-900 hover:border-blue-400 font-bold'}`}>
                        <div className="text-xs font-heading">{b.name}</div>
                        <div className="text-[10px] font-mono opacity-80">Dài {b.lengthMeters}m · Mớn {b.maxDraft}m</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Giờ Bắt Đầu (Bắt Đầu Cập) *</label>
                    <input type="time" value={drawerStartTime} onChange={e => setDrawerStartTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Giờ Kết Thúc (Dự Kiến Rời) *</label>
                    <input type="time" value={drawerEndTime} onChange={e => setDrawerEndTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900" />
                  </div>
                </div>
              </div>

              {/* CONFLICT DETECTION BANNER */}
              <div className="space-y-2">
                <div className="text-[10px] font-extrabold text-slate-600 uppercase">TRẠNG THÁI KIỂM TRA XUNG ĐỘT (CONFLICT DETECTION)</div>

                {drawerConflict.conflict ? (
                  <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-500 text-red-950 space-y-1 animate-pulse">
                    <div className="flex items-center gap-2 font-extrabold text-xs text-red-700">
                      <span className="material-symbols-outlined text-red-600">warning</span>
                      ⚠ Phát Hiện Xung Đột Lịch Cầu Bến
                    </div>
                    <p className="text-xs font-bold text-red-900">{drawerConflict.reason}</p>
                    <p className="text-[10px] text-red-800">Hệ thống khóa xác nhận để tránh 2 tàu cập cùng một vị trí cầu bến trong một khoảng thời gian.</p>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-xl">check_circle</span>
                    <div>
                      <div className="font-extrabold text-xs text-emerald-900">✓ Cầu Bến Hợp Lệ (Trống)</div>
                      <div className="text-[10px] text-emerald-800">Cầu {drawerBerth} hoàn toàn trống trong khoảng thời gian từ {drawerStartTime} đến {drawerEndTime}.</div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            <div className="p-6 border-t border-slate-200 flex flex-col gap-2">
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowDrawer(false)}
                  className="flex-1 h-11 border border-slate-300 text-slate-700 rounded-xl font-extrabold text-xs hover:bg-slate-100">
                  Hủy
                </button>
                <button type="button"
                  disabled={drawerConflict.conflict}
                  onClick={handleConfirmAssignment}
                  className={`flex-1 h-11 rounded-xl font-extrabold text-sm shadow-md flex items-center justify-center gap-1 ${
                    drawerConflict.conflict ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}>
                  <span className="material-symbols-outlined text-sm">anchor</span>
                  {selectedSlot ? 'Xác Nhận Đổi Cầu' : 'Xác Nhận Phân Bổ'}
                </button>
              </div>

              {selectedSlot && (
                <button type="button" onClick={() => handleRemoveAssignment(selectedSlot.id)}
                  className="w-full h-10 border border-red-200 text-red-700 hover:bg-red-50 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 mt-1">
                  <span className="material-symbols-outlined text-sm">delete</span>
                  Hủy Phân Bổ Cầu Bến
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
