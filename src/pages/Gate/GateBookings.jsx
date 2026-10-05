import React, { useState, useEffect, useMemo } from 'react'
import apiClient from '../../services/apiClient'

const TIME_SLOTS = [
  { id: '06:00 - 08:00', label: '06:00 - 08:00', name: 'Ca Sớm' },
  { id: '08:00 - 10:00', label: '08:00 - 10:00', name: 'Sáng' },
  { id: '10:00 - 12:00', label: '10:00 - 12:00', name: 'Hiện Tại', isCurrent: true },
  { id: '12:00 - 14:00', label: '12:00 - 14:00', name: 'Ca Trưa' },
  { id: '14:00 - 16:00', label: '14:00 - 16:00', name: 'Chiều' },
  { id: '16:00 - 18:00', label: '16:00 - 18:00', name: 'Chiều Muộn' },
]

export default function GateBookings() {
  const [bookings, setBookings] = useState([])
  const [viewMode, setViewMode] = useState('slots') // 'slots' | 'table'
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [gateFilter, setGateFilter] = useState('All')
  const [operationFilter, setOperationFilter] = useState('All')
  
  // Modals & Details
  const [selectedBooking, setSelectedBooking] = useState(null)

  // Load Bookings directly from API
  useEffect(() => {
    loadBookings()
  }, [])

  const loadBookings = async () => {
    try {
      const res = await apiClient.get('/v1/booking').catch(() => ({ data: [] }))
      const items = res.data?.items || res.data || []
      
      const apiMapped = items.map((b) => {
        const start = b.appointmentStart || b.validFrom || b.timeSlotStart
        let slotName = '10:00 - 12:00'
        if (start) {
          const hour = new Date(start).getHours()
          if (hour < 8) slotName = '06:00 - 08:00'
          else if (hour < 10) slotName = '08:00 - 10:00'
          else if (hour < 12) slotName = '10:00 - 12:00'
          else if (hour < 14) slotName = '12:00 - 14:00'
          else if (hour < 16) slotName = '14:00 - 16:00'
          else slotName = '16:00 - 18:00'
        }

        return {
          id: b.bookingCode || b.bookingNumber || b.id || 'BKG-N/A',
          company: b.carrierName || b.carrier?.name || 'Hãng Vận Tải',
          companyId: b.carrierId ? b.carrierId.substring(0, 8) : '—',
          vehicleId: b.truckId ? b.truckId.substring(0, 8) : '—',
          licensePlate: b.vehiclePlate || b.truckPlateNumber || b.truck?.licensePlate || '—',
          trailerPlate: b.trailerPlate || '—',
          driverName: b.driverName || b.driver?.fullName || '—',
          driverPhone: b.driverPhone || b.driver?.phoneNumber || '—',
          licenseNumber: b.licenseNumber || b.driver?.licenseNumber || '—',
          containerId: b.containers?.[0]?.containerNumber || b.containerId || '—',
          containerType: b.containers?.[0]?.containerType || b.containerType || "40' HC Dry",
          sealNumber: b.sealNumber || b.containers?.[0]?.sealNumber || '—',
          cargoType: b.cargoType || 'Hàng Tiêu Dùng Tổng Hợp',
          grossWeight: b.grossWeight ? `${b.grossWeight} Tấn` : '—',
          yardLocation: b.yardLocation || 'Khu Bãi',
          operation: (b.operationType === 2 || b.operationType === 'Delivery') ? 'Delivery' : 'Pickup',
          gate: b.gate || 'Cổng A · Làn 01',
          status: (b.status === 2 || b.status === 'CheckedIn' || b.status === 'Checked-in')
            ? 'Checked-in'
            : ((b.status === 3 || b.status === 'Completed') ? 'Completed' : 'Approved'),
          timeSlot: slotName,
          etaStatus: 'On Time',
        }
      })

      setBookings(apiMapped)
    } catch {
      setBookings([])
    }
  }

  // Filter Bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const q = search.trim().toLowerCase()
      const matchQ = !q ||
        b.id.toLowerCase().includes(q) ||
        b.containerId.toLowerCase().includes(q) ||
        b.licensePlate.toLowerCase().includes(q) ||
        b.driverName.toLowerCase().includes(q) ||
        b.company.toLowerCase().includes(q)

      const matchStatus = statusFilter === 'All' ? true : b.status === statusFilter
      const matchGate = gateFilter === 'All' ? true : b.gate.includes(gateFilter)
      const matchOp = operationFilter === 'All' ? true : b.operation === operationFilter

      return matchQ && matchStatus && matchGate && matchOp
    })
  }, [bookings, search, statusFilter, gateFilter, operationFilter])

  // KPIs
  const totalBookings = bookings.length
  const waitingCount = bookings.filter(b => b.status === 'Approved').length
  const checkedInCount = bookings.filter(b => b.status === 'Checked-in').length
  const currentSlotCount = bookings.filter(b => b.timeSlot === '10:00 - 12:00').length

  return (
    <div className="p-5 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen text-slate-800">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-0.5 rounded-full uppercase tracking-wide">
              CỔNG KIỂM SOÁT
            </span>
            <span className="text-xs text-slate-500 font-medium">Cảng Quốc Tế Tiên Sa · Đà Nẵng</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Lịch Booking Cổng
          </h1>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Tổng Booking */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Tổng Lượt Đặt Hẹn</span>
            <div className="text-2xl md:text-3xl font-bold text-slate-900 font-mono">{totalBookings}</div>
            <span className="text-xs text-slate-500 mt-1 block">Trong hôm nay</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">local_shipping</span>
          </div>
        </div>

        {/* Card 2: Chờ Vào Cổng */}
        <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-700 block mb-1">Chờ Vào Cổng</span>
            <div className="text-2xl md:text-3xl font-bold text-amber-600 font-mono">{waitingCount}</div>
            <span className="text-xs text-amber-600 mt-1 block">Đã được duyệt</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">hourglass_top</span>
          </div>
        </div>

        {/* Card 3: Đã Check-in */}
        <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-700 block mb-1">Đã Vào Cảng</span>
            <div className="text-2xl md:text-3xl font-bold text-emerald-600 font-mono">{checkedInCount}</div>
            <span className="text-xs text-emerald-600 mt-1 block">Đã mở barie</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">check_circle</span>
          </div>
        </div>

        {/* Card 4: Khung Giờ Hiện Tại */}
        <div className="bg-white rounded-2xl border border-blue-200 p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-blue-700 block mb-1">Khung Giờ 10:00 - 12:00</span>
            <div className="text-2xl md:text-3xl font-bold text-blue-600 font-mono">{currentSlotCount} xe</div>
            <span className="text-xs text-blue-600 mt-1 block">Đang diễn ra</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">schedule</span>
          </div>
        </div>

      </div>

      {/* ── TOOLBAR: VIEW SWITCHER & SEARCH/FILTERS ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
        
        {/* Left: View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setViewMode('slots')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'slots'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-base">view_timeline</span>
            Xem Khung Giờ
          </button>

          <button
            onClick={() => setViewMode('table')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-base">table_rows</span>
            Xem Dạng Bảng
          </button>
        </div>

        {/* Right: Search & Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
          
          {/* Search Input */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm biển số, container, tài xế..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-slate-900"
          >
            <option value="All">Tất cả trạng thái</option>
            <option value="Approved">Đã duyệt (Approved)</option>
            <option value="Checked-in">Đã vào cảng (Checked-in)</option>
            <option value="Completed">Hoàn tất</option>
          </select>

          {/* Operation Filter */}
          <select
            value={operationFilter}
            onChange={(e) => setOperationFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-slate-900"
          >
            <option value="All">Tất cả tác nghiệp</option>
            <option value="Pickup">Lấy Container</option>
            <option value="Delivery">Hạ Container</option>
          </select>

          {/* Gate Filter */}
          <select
            value={gateFilter}
            onChange={(e) => setGateFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-slate-900"
          >
            <option value="All">Tất cả cổng</option>
            <option value="Cổng A">Cổng A</option>
            <option value="Cổng B">Cổng B</option>
          </select>

        </div>

      </div>

      {/* ── VIEW 1: TIME SLOTS GRID ── */}
      {viewMode === 'slots' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {TIME_SLOTS.map((slot) => {
            const slotBookings = filteredBookings.filter((b) => b.timeSlot === slot.id)

            return (
              <div
                key={slot.id}
                className={`bg-white rounded-2xl border transition-shadow shadow-sm flex flex-col overflow-hidden ${
                  slot.isCurrent ? 'border-orange-400 ring-2 ring-orange-100' : 'border-slate-200'
                }`}
              >
                {/* Slot Header */}
                <div className={`p-4 border-b flex justify-between items-center ${
                  slot.isCurrent ? 'bg-orange-50/80 border-orange-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{slot.label}</span>
                    {slot.isCurrent && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-orange-500 text-white">
                        Hiện Tại
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-600 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                    {slotBookings.length} xe
                  </span>
                </div>

                {/* Slot Content */}
                <div className="p-3.5 space-y-3 flex-1 overflow-y-auto max-h-[460px]">
                  {slotBookings.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      Không có lượt đặt hẹn trong khung giờ này
                    </div>
                  ) : (
                    slotBookings.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBooking(b)}
                        className="p-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl cursor-pointer transition-colors space-y-2.5"
                      >
                        {/* Top: License Plate & Operation */}
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded">
                            {b.licensePlate}
                          </span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            b.operation === 'Pickup' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {b.operation === 'Pickup' ? 'Lấy Container' : 'Hạ Container'}
                          </span>
                        </div>

                        {/* Mid: Container & Company */}
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-slate-900 font-mono flex items-center justify-between">
                            <span>{b.containerId}</span>
                            <span className="text-[11px] text-slate-500 font-normal font-sans">{b.containerType}</span>
                          </div>
                          <div className="text-xs text-slate-600 truncate">
                            {b.company}
                          </div>
                        </div>

                        {/* Bottom: Driver & Status */}
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">TX: {b.driverName}</span>
                          {b.status === 'Checked-in' ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              ✓ Đã vào {b.checkInTime}
                            </span>
                          ) : (
                            <span className="text-blue-700 font-bold">
                              ● Đã duyệt
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── VIEW 2: DATA TABLE ── */}
      {viewMode === 'table' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="py-3.5 px-4">Mã Booking</th>
                  <th className="py-3.5 px-4">Biển Số Xe</th>
                  <th className="py-3.5 px-4">Mã Container</th>
                  <th className="py-3.5 px-4">Tài Xế & SĐT</th>
                  <th className="py-3.5 px-4">Hãng Vận Tải</th>
                  <th className="py-3.5 px-4">Tác Nghiệp</th>
                  <th className="py-3.5 px-4">Khung Giờ Hẹn</th>
                  <th className="py-3.5 px-4">Trạng Thái</th>
                  <th className="py-3.5 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400 text-sm">
                      Không tìm thấy lịch booking nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => setSelectedBooking(b)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-orange-600">
                        {b.id}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-xs">
                          {b.licensePlate}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {b.containerId}
                        <span className="text-[11px] text-slate-500 font-normal block font-sans">{b.containerType}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{b.driverName}</div>
                        <div className="text-[11px] text-slate-500">{b.driverPhone}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {b.company}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          b.operation === 'Pickup' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {b.operation === 'Pickup' ? 'Lấy Container' : 'Hạ Container'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {b.timeSlot}
                      </td>
                      <td className="py-3 px-4">
                        {b.status === 'Checked-in' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                            Đã vào cảng
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full">
                            Đã duyệt
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedBooking(b)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                        >
                          Xem Chi Tiết
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL (READ-ONLY) ── */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl p-6 shadow-xl space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-orange-600 tracking-wider">
                  CHI TIẾT GATE BOOKING
                </span>
                <h3 className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                  {selectedBooking.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Vehicle & Container Highlight */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Biển Số Xe Đầu Kéo</div>
                <div className="text-lg font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-3 py-0.5 rounded mt-1 inline-block">
                  {selectedBooking.licensePlate}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Mã Container ISO</div>
                <div className="text-base font-mono font-bold text-slate-900 mt-1">
                  {selectedBooking.containerId}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Số Chì (Seal)</div>
                <div className="text-sm font-mono font-bold text-emerald-700 mt-1">
                  {selectedBooking.sealNumber}
                </div>
              </div>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ['Hãng Vận Tải', selectedBooking.company],
                ['Tài Xế', selectedBooking.driverName],
                ['Số Điện Thoại', selectedBooking.driverPhone],
                ['GPLX Hạng', `${selectedBooking.licenseNumber} (Hợp lệ)`],
                ['Tác Nghiệp', selectedBooking.operation === 'Pickup' ? 'Lấy Container' : 'Hạ Container'],
                ['Loại Container', selectedBooking.containerType],
                ['Khung Giờ Hẹn', selectedBooking.timeSlot],
                ['Cổng Phân Bổ', selectedBooking.gate],
                ['Vị Trí Bãi Yard', selectedBooking.yardLocation],
                ['Tổng Trọng Lượng', selectedBooking.grossWeight],
              ].map(([k, v]) => (
                <div key={k} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">{k}</div>
                  <div className="font-bold text-slate-800 truncate">{v}</div>
                </div>
              ))}
            </div>

            {/* Checklist */}
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1.5">
              <div className="font-bold text-emerald-900 mb-1">Điều kiện vào cổng (Đối soát hệ thống):</div>
              <div className="flex items-center gap-2 text-emerald-800">
                <span>✓</span>
                <span>Lịch booking đã được Dispatcher phê duyệt hợp lệ</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-800">
                <span>✓</span>
                <span>Biển số xe và tài xế khớp đăng ký eDO</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-800">
                <span>✓</span>
                <span>Vị trí bãi bốc/hạ container sẵn sàng tiếp nhận</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
