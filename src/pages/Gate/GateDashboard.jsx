import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { gateStatusData, waitingVehiclesData } from '../../data/gateOfficerData'
import gateService from '../../services/gateService'
import GateEntryOrders from '../../features/booking-dispatch/GateEntryOrders'

export default function GateDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    checkedIn: 0,
    completed: 0,
    rejected: 0,
    waiting: 0,
    expiredCount: 0,
    pendingIncidents: 0,
  })
  const [todayBookings, setTodayBookings] = useState([])
  const [loadError,setLoadError]=useState('')



  useEffect(() => {
    // Tải thống kê thực tế từ API
    Promise.all([
      gateService.getBookings({pageSize:150}).then(data=>({data})),
      gateService.getVerificationHistory().catch(() => ({ data: [] })),
    ]).then(([bookingRes, verifyRes]) => {
      const bookings = bookingRes.data?.items || bookingRes.data || []
      const verifications = verifyRes.data || []

      setTodayBookings(bookings)
      setStats({
        checkedIn: bookings.filter(b => b.status === 'Checked-in' || b.status === 'CheckedIn').length,
        completed: bookings.filter(b => b.status === 'Completed').length,
        rejected: verifications.filter(v => v.status === 'FAIL').length,
        waiting: bookings.filter(b => b.status === 'Approved').length,
        expiredCount: bookings.filter(b => b.status === 'Expired').length,
        pendingIncidents: 0,
      })
    }).catch(error=>setLoadError(error.message||'Không tải được lịch booking cổng.'))
  }, [])

  const { checkedIn, completed, rejected, waiting, expiredCount, pendingIncidents } = stats

  const displayWaitingVehicles = todayBookings.length > 0
    ? todayBookings.map(b => ({
        bookingId: b.bookingCode || b.bookingNumber || b.id,
        vehicle: b.truckType || 'Container Truck (Đầu kéo)',
        plate: b.licensePlate || b.truckPlateNumber || '—',
        driver: b.driverName || '—',
        container: b.containerId || b.containerNumber || b.containers?.[0]?.containerNumber || '—',
        eta: b.validFrom ? new Date(b.validFrom).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '08:30',
        gate: 'Cổng A · Làn 01',
        status: b.status === 'Approved' ? 'On Time' : (b.status === 'Early' ? 'Early' : 'On Time')
      }))
    : (waitingVehiclesData || [])

  const statusBadge = (s) => {
    switch (s) {
      case 'On Time': return <span className="px-2 py-0.5 bg-green-100 text-green-900 border border-green-300 rounded-full text-[10px] font-bold">Đúng giờ</span>
      case 'Late': return <span className="px-2 py-0.5 bg-red-100 text-red-900 border border-red-300 rounded-full text-[10px] font-bold">⚠ Trễ giờ</span>
      case 'Early': return <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 rounded-full text-[10px] font-bold">Đến sớm</span>
      default: return null
    }
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen">

      {/* ── HEADER ── */}
      <div className="flex justify-between items-center bg-white border border-chalk rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full uppercase">KHÔNG GIAN NHÂN VIÊN CỔNG</span>
            <span className="text-xs font-mono text-slate">Cảng Tiên Sa · Đà Nẵng</span>
          </div>
          <h2 className="font-heading text-3xl font-extrabold text-carbon">Bảng Điều Khiển Cổng</h2>
          <p className="text-xs text-slate mt-0.5">Tổng quan hoạt động kiểm soát cổng theo thời gian thực.</p>
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
          <div className="text-3xl font-extrabold text-blue-600 font-mono">{waiting > 0 ? 1 : 0}</div>
          <span className="text-[11px] text-blue-700 font-bold">Đang kiểm tra</span>
        </div>
        <div className="bg-white rounded-2xl border border-green-300 p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate uppercase">Checked-in</span>
          <div className="text-3xl font-extrabold text-green-600 font-mono">{checkedIn}</div>
          <span className="text-[11px] text-green-700 font-bold">Đã vào cảng</span>
        </div>
        <div className="bg-white rounded-2xl border border-chalk p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate uppercase">Checked-out</span>
          <div className="text-3xl font-extrabold text-carbon font-mono">{completed}</div>
          <span className="text-[11px] text-slate font-bold">Đã ra cổng</span>
        </div>
        <div className="bg-white rounded-2xl border border-red-300 p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate uppercase">Bị Từ Chối</span>
          <div className="text-3xl font-extrabold text-red-600 font-mono">{rejected}</div>
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
                  <div className="flex justify-between text-slate"><span>Nhận diện:</span><strong className={gate.anpr ? 'text-green-700' : 'text-red-700'}>{gate.anpr ? '● Đang chạy' : '○ Ngoại tuyến'}</strong></div>
                  <div className="flex justify-between text-slate"><span>Nhân viên:</span><strong className="text-carbon text-[11px]">{gate.officer}</strong></div>
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
                Phương Tiện Chưa Đăng Ký
              </div>
              <div className="text-red-700 mt-0.5">Cổng A — Xe 43C-777.11 không có đăng ký</div>
            </div>
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs">
              <div className="font-extrabold text-amber-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">warning</span>
                Sai Khớp Số Chì
              </div>
              <div className="text-amber-700 mt-0.5">GB-20260811-005 — Số chì niêm phong không khớp</div>
            </div>
            <div className="bg-orange-50 border border-orange-300 rounded-xl p-3 text-xs">
              <div className="font-extrabold text-orange-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">schedule</span>
                Xe Trễ Giờ Dự Kiến
              </div>
              <div className="text-orange-700 mt-0.5">GB-20260811-008 — TRK-022 đến trễ 30 phút</div>
            </div>
            {expiredCount > 0 && (
              <div className="bg-slate-100 border border-slate-300 rounded-xl p-3 text-xs">
                <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">timer_off</span>
                  Đăng Ký Hết Hạn
                </div>
                <div className="text-slate-600 mt-0.5">{expiredCount} lượt đăng ký đã quá giờ không vào cổng</div>
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/gate/incidents')}
            className="w-full h-10 bg-carbon text-white rounded-xl font-extrabold text-xs hover:bg-black flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">report</span>
            Xem Tất Cả Sự Cố
          </button>
        </div>
      </div>

      {loadError&&<p role="alert" className="text-red-700">Không tải được dữ liệu cổng: {loadError}</p>}
      <GateEntryOrders />
      {/* ── VEHICLES WAITING TABLE ── */}
      <div className="bg-white rounded-2xl border border-chalk shadow-sm overflow-hidden">
        <div className="p-4 border-b border-chalk flex justify-between items-center">
          <div>
            <span className="text-[10px] font-extrabold text-signal-orange uppercase tracking-wider block">HÀNG ĐỢI XE NHẬP CỔNG</span>
            <h3 className="font-extrabold text-carbon text-base">Xe Đang Chờ Tại Cổng</h3>
          </div>
          <button
            onClick={() => navigate('/gate')}
            className="px-4 py-2 bg-signal-orange text-white rounded-xl font-extrabold text-xs hover:opacity-95 flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">sensor_door</span>
            Mở Cổng Kiểm Soát
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-fog border-b border-chalk text-slate font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-5">Mã Đăng Ký</th>
                <th className="py-3 px-5">Phương Tiện & Biển Số</th>
                <th className="py-3 px-5">Tài Xế</th>
                <th className="py-3 px-5">Container</th>
                <th className="py-3 px-5">Giờ Dự Kiến</th>
                <th className="py-3 px-5">Cổng</th>
                <th className="py-3 px-5">Trạng Thái</th>
                <th className="py-3 px-5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk">
              {displayWaitingVehicles.length > 0 ? (
                displayWaitingVehicles.map(v => (
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
                        className="px-3 py-1.5 bg-amber-500 text-white rounded-lg font-extrabold text-[11px] hover:bg-amber-600 flex items-center gap-1 ml-auto cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">fact_check</span>
                        Xử lý
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-mono">
                    Hiện chưa có xe trong hàng đợi vào cổng
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
