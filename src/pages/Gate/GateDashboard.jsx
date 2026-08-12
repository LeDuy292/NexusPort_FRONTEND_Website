import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { gateStatusData, waitingVehiclesData, gateBookingsData, gateIncidentsData } from '../../data/gateOfficerData'

export default function GateDashboard() {
  const navigate = useNavigate()
  const [currentTime, setCurrentTime] = useState('')

  useEffect(() => {
    const tick = () => setCurrentTime(new Date().toLocaleTimeString('vi-VN'))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // KPI calculations
  const checkedIn = gateBookingsData.filter(b => b.status === 'Checked-in').length
  const completed = gateBookingsData.filter(b => b.status === 'Completed').length
  const rejected = gateBookingsData.filter(b => b.status === 'Rejected').length
  const waiting = waitingVehiclesData.length
  const expiredCount = gateBookingsData.filter(b => b.status === 'Expired').length
  const pendingIncidents = gateIncidentsData.filter(i => i.status === 'Pending' || i.status === 'Under Review').length

  const statusBadge = (s) => {
    switch (s) {
      case 'On Time': return <span className="px-2 py-0.5 bg-green-100 text-green-900 border border-green-300 rounded-full text-[10px] font-bold">On Time</span>
      case 'Late': return <span className="px-2 py-0.5 bg-red-100 text-red-900 border border-red-300 rounded-full text-[10px] font-bold">⚠ Late</span>
      case 'Early': return <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 rounded-full text-[10px] font-bold">Early</span>
      default: return null
    }
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen">

      {/* ── HEADER ── */}
      <div className="flex justify-between items-center bg-white border border-chalk rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full uppercase">GATE OFFICER WORKSPACE</span>
            <span className="text-xs font-mono text-slate">Cảng Tiên Sa · Đà Nẵng</span>
          </div>
          <h2 className="font-heading text-3xl font-extrabold text-carbon">Gate Dashboard</h2>
          <p className="text-xs text-slate mt-0.5">Tổng quan hoạt động kiểm soát cổng theo thời gian thực.</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-extrabold text-carbon">{currentTime}</div>
          <div className="text-xs text-slate">11/08/2026</div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-2xl border-2 border-amber-400 p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold text-amber-900 uppercase">Xe Đang Chờ</span>
          <div className="text-3xl font-extrabold text-amber-600 font-mono">{waiting}</div>
          <span className="text-[11px] text-amber-800 font-bold">Chờ vào cổng</span>
        </div>
        <div className="bg-white rounded-2xl border border-blue-300 p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate uppercase">Đang Xử Lý</span>
          <div className="text-3xl font-extrabold text-blue-600 font-mono">2</div>
          <span className="text-[11px] text-blue-700 font-bold">Đang kiểm tra</span>
        </div>
        <div className="bg-white rounded-2xl border border-green-300 p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate uppercase">Checked-in</span>
          <div className="text-3xl font-extrabold text-green-600 font-mono">{checkedIn + 17}</div>
          <span className="text-[11px] text-green-700 font-bold">Đã vào cảng</span>
        </div>
        <div className="bg-white rounded-2xl border border-chalk p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate uppercase">Checked-out</span>
          <div className="text-3xl font-extrabold text-carbon font-mono">{completed + 12}</div>
          <span className="text-[11px] text-slate font-bold">Đã ra cổng</span>
        </div>
        <div className="bg-white rounded-2xl border border-red-300 p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate uppercase">Bị Từ Chối</span>
          <div className="text-3xl font-extrabold text-red-600 font-mono">{rejected + 2}</div>
          <span className="text-[11px] text-red-600 font-bold">Không đủ điều kiện</span>
        </div>
        <div className="bg-white rounded-2xl border border-orange-300 p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate uppercase">Incidents</span>
          <div className="text-3xl font-extrabold text-signal-orange font-mono">{pendingIncidents}</div>
          <span className="text-[11px] text-orange-800 font-bold">Cần xử lý</span>
        </div>
      </div>

      {/* ── GATE STATUS + ALERTS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Gate Status Cards */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-extrabold text-carbon text-sm uppercase tracking-wider">Trạng Thái Cổng</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {gateStatusData.map(gate => (
              <div key={gate.id} className={`bg-white rounded-2xl border-2 p-4 shadow-sm space-y-3 ${
                gate.status === 'Online' ? 'border-green-300' : 'border-slate-300 opacity-70'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-carbon text-base">{gate.label}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                    gate.status === 'Online' ? 'bg-green-100 text-green-900 border border-green-300' : 'bg-slate-100 text-slate-700 border border-slate-300'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${gate.status === 'Online' ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    {gate.status}
                  </span>
                </div>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between text-slate"><span>Xe đang chờ:</span><strong className="text-carbon">{gate.waiting}</strong></div>
                  <div className="flex justify-between text-slate"><span>Camera:</span><strong className="text-carbon">{gate.cam}</strong></div>
                  <div className="flex justify-between text-slate"><span>ANPR:</span><strong className={gate.anpr ? 'text-green-700' : 'text-red-700'}>{gate.anpr ? '● Đang chạy' : '○ Offline'}</strong></div>
                  <div className="flex justify-between text-slate"><span>Officer:</span><strong className="text-carbon text-[11px]">{gate.officer}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alert Panel */}
        <div className="space-y-3">
          <h3 className="font-extrabold text-carbon text-sm uppercase tracking-wider">Cảnh Báo Cần Xử Lý</h3>
          <div className="space-y-2">
            <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-xs">
              <div className="font-extrabold text-red-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">emergency_home</span>
                Unauthorized Vehicle
              </div>
              <div className="text-red-700 mt-0.5">Gate A — Xe 43C-777.11 không có booking</div>
            </div>
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs">
              <div className="font-extrabold text-amber-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">warning</span>
                Seal Mismatch
              </div>
              <div className="text-amber-700 mt-0.5">GB-20260811-005 — Seal không khớp</div>
            </div>
            <div className="bg-orange-50 border border-orange-300 rounded-xl p-3 text-xs">
              <div className="font-extrabold text-orange-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">schedule</span>
                Xe Trễ ETA
              </div>
              <div className="text-orange-700 mt-0.5">GB-20260811-008 — TRK-022 đến trễ 30 phút</div>
            </div>
            {expiredCount > 0 && (
              <div className="bg-slate-100 border border-slate-300 rounded-xl p-3 text-xs">
                <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">timer_off</span>
                  Booking Hết Hạn
                </div>
                <div className="text-slate-600 mt-0.5">{expiredCount} booking đã quá giờ không vào cổng</div>
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/gate/incidents')}
            className="w-full h-10 bg-carbon text-white rounded-xl font-extrabold text-xs hover:bg-black flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">report</span>
            Xem Tất Cả Incidents
          </button>
        </div>
      </div>

      {/* ── VEHICLES WAITING TABLE ── */}
      <div className="bg-white rounded-2xl border border-chalk shadow-sm overflow-hidden">
        <div className="p-4 border-b border-chalk flex justify-between items-center">
          <div>
            <span className="text-[10px] font-extrabold text-signal-orange uppercase tracking-wider block">HÀNG ĐỢI XE NHẬP CỔNG</span>
            <h3 className="font-extrabold text-carbon text-base">Vehicles Waiting for Entry</h3>
          </div>
          <button
            onClick={() => navigate('/gate')}
            className="px-4 py-2 bg-signal-orange text-white rounded-xl font-extrabold text-xs hover:opacity-95 flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">sensor_door</span>
            Mở Gate Control
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-fog border-b border-chalk text-slate font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-5">Booking ID</th>
                <th className="py-3 px-5">Vehicle & Plate</th>
                <th className="py-3 px-5">Driver</th>
                <th className="py-3 px-5">Container</th>
                <th className="py-3 px-5">ETA</th>
                <th className="py-3 px-5">Gate</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk">
              {waitingVehiclesData.map(v => (
                <tr key={v.bookingId} className="hover:bg-fog/70">
                  <td className="py-3.5 px-5 font-mono font-extrabold text-signal-orange">{v.bookingId}</td>
                  <td className="py-3.5 px-5">
                    <div className="font-bold text-carbon">{v.vehicle}</div>
                    <div className="text-[10px] font-mono text-slate">{v.plate}</div>
                  </td>
                  <td className="py-3.5 px-5 font-bold text-carbon">{v.driver}</td>
                  <td className="py-3.5 px-5 font-mono font-bold text-carbon">{v.container}</td>
                  <td className="py-3.5 px-5 font-mono font-bold text-carbon">{v.eta}</td>
                  <td className="py-3.5 px-5 font-mono font-bold">{v.gate}</td>
                  <td className="py-3.5 px-5">{statusBadge(v.status)}</td>
                  <td className="py-3.5 px-5 text-right">
                    <button
                      onClick={() => navigate('/gate')}
                      className="px-3 py-1.5 bg-amber-500 text-white rounded-lg font-extrabold text-[11px] hover:bg-amber-600 flex items-center gap-1 ml-auto"
                    >
                      <span className="material-symbols-outlined text-sm">fact_check</span>
                      Process
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
