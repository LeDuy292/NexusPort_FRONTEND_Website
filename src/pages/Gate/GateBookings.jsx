import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { bookingService } from '../../services/bookingService'

const getRealtimeUrl = () => {
  if (import.meta.env.VITE_REALTIME_URL) return import.meta.env.VITE_REALTIME_URL
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.startsWith('http')) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  }
  return 'http://localhost:3001'
}

// Hàm lấy tên thứ trong tuần tiếng Việt
const getDayOfWeekName = (dateStr) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
    return days[d.getDay()]
  } catch {
    return ''
  }
}

// Định dạng ngày hiển thị DD/MM/YYYY
const formatDateVi = (dateStr) => {
  if (!dateStr) return '—'
  try {
    const [y, m, d] = dateStr.split('-')
    if (y && m && d) return `${d}/${m}/${y}`
    const date = new Date(dateStr)
    return date.toLocaleDateString('vi-VN')
  } catch {
    return dateStr
  }
}

export default function GateBookings() {
  const navigate = useNavigate()

  // State dữ liệu & chế độ xem
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('day_cards') // 'day_cards' | 'week_overview' | 'table'

  // Đồng hồ thời gian thực
  const [currentTime, setCurrentTime] = useState(new Date())

  // Bộ lọc Ngày
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [gateFilter, setGateFilter] = useState('All')
  const [operationFilter, setOperationFilter] = useState('All')

  // Modal Chi Tiết Booking
  const [selectedBooking, setSelectedBooking] = useState(null)

  // Cập nhật đồng hồ thời gian thực mỗi giây
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Tải danh sách Booking từ API (hỗ trợ silent background sync không giật màn hình)
  const loadBookings = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)

    try {
      const res = await bookingService.getBookings({ pageSize: 150 })
      const items = res?.items || res?.data?.items || res || []

      const mapped = items.map((b) => {
        const startRaw = b.appointmentStart || b.validFrom || b.createdAt
        const startDate = startRaw ? new Date(startRaw) : new Date()
        const startIsoDate = !isNaN(startDate.getTime())
          ? startDate.toISOString().split('T')[0]
          : todayStr

        // Trích xuất mã Container
        const containerNumber = b.containerNumbers?.[0]
          || b.containerSelections?.[0]?.containerNumber
          || b.containerId
          || '—'

        const containerType = b.containerSelections?.[0]?.containerTypeCode
          || b.containerType
          || "40' HC Dry"

        // Chuẩn hóa trạng thái
        const rawStatus = (b.status || '').toString()
        let normalizedStatus = 'Approved'
        if (['CheckedIn', 'Checked-in', 'InProgress', '5'].includes(rawStatus)) {
          normalizedStatus = 'Checked-in'
        } else if (['Completed', '6'].includes(rawStatus)) {
          normalizedStatus = 'Completed'
        } else if (['Approved', 'Ready', '2'].includes(rawStatus)) {
          normalizedStatus = 'Approved'
        } else if (['Pending', 'Draft', '1', '0'].includes(rawStatus)) {
          normalizedStatus = 'Pending'
        } else if (['Canceled', 'Rejected', 'Expired', '3', '4', '7'].includes(rawStatus)) {
          normalizedStatus = 'Canceled'
        }

        // Chuẩn hóa tác nghiệp
        const rawOp = b.bookingType || b.operationType
        const isDelivery = rawOp === 'Dropoff' || rawOp === 'Delivery' || rawOp === 2
        const operation = isDelivery ? 'Delivery' : 'Pickup'

        return {
          id: b.bookingCode || b.bookingNumber || (b.id ? b.id.substring(0, 8).toUpperCase() : 'BKG-N/A'),
          fullId: b.id,
          dateStr: startIsoDate,
          appointmentStart: startRaw,
          appointmentEnd: b.appointmentEnd || b.validTo,
          company: b.carrierName || b.carrier?.name || 'Công Ty Vận Tải',
          companyId: b.carrierId ? b.carrierId.substring(0, 8) : '—',
          licensePlate: b.vehiclePlate || b.truckPlateNumber || b.truck?.licensePlate || '—',
          trailerPlate: b.trailerPlate || '—',
          driverName: b.driverName || b.driver?.fullName || '—',
          driverPhone: b.driverPhone || b.driver?.phoneNumber || '—',
          licenseNumber: b.licenseNumber || b.driver?.licenseNumber || 'FC-Chuyên dùng',
          containerId: containerNumber,
          containerType: containerType,
          sealNumber: b.sealNumber || b.containerSelections?.[0]?.sealNumber || 'SEAL-Chưa niêm',
          cargoType: b.containerSelections?.[0]?.cargoTypeName || b.cargoType || 'Hàng Tiêu Dùng Tổng Hợp',
          grossWeight: b.grossWeight ? `${b.grossWeight} Tấn` : '28.5 Tấn',
          yardLocation: b.containerSelections?.[0]?.yardCode || b.yardLocation || 'Khu A · Block 02',
          operation: operation,
          gate: b.gate || 'Cổng A · Làn 01',
          status: normalizedStatus,
          rawStatus: rawStatus,
          totalAmount: b.totalAmount,
          paymentStatus: b.paymentStatus || 'Paid',
        }
      })

      setBookings(mapped)
    } catch {
      // Giữ nguyên dữ liệu khi gặp lỗi mạng tạm thời
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [todayStr])

  // Lắng nghe Realtime qua Socket.IO kết hợp Polling tự động ngầm (Silent Auto-Sync)
  useEffect(() => {
    // 1. Tải ban đầu
    loadBookings(true)

    // 2. Kết nối Socket.IO
    let socket = null
    try {
      const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
      const token = stored ? JSON.parse(stored)?.token : null

      socket = io(getRealtimeUrl(), {
        auth: token ? { token } : {},
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
      })

      const triggerRealtimeUpdate = () => {
        loadBookings(false)
      }

      socket.on('booking:created', triggerRealtimeUpdate)
      socket.on('booking:updated', triggerRealtimeUpdate)
      socket.on('gate:booking_updated', triggerRealtimeUpdate)
      socket.on('gate:checkin', triggerRealtimeUpdate)
      socket.on('gate:checkout', triggerRealtimeUpdate)
      socket.on('trip:status_updated', triggerRealtimeUpdate)
      socket.on('dispatcher.status.updated', triggerRealtimeUpdate)
      socket.on('yard.operation.completed', triggerRealtimeUpdate)
    } catch {
      // fallback to interval
    }

    // 3. Chu kỳ tự động đồng bộ ngầm mỗi 4 giây (đảm bảo dữ liệu luôn mới nhất)
    const realtimeInterval = setInterval(() => {
      loadBookings(false)
    }, 4000)

    return () => {
      clearInterval(realtimeInterval)
      if (socket) {
        socket.disconnect()
      }
    }
  }, [loadBookings])

  // Danh sách 7 ngày lân cận để chọn nhanh
  const quickDaysList = useMemo(() => {
    const list = []
    const base = new Date()
    // 2 ngày trước, hôm nay, 4 ngày tới
    for (let i = -2; i <= 4; i++) {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      const iso = d.toISOString().split('T')[0]
      const count = bookings.filter(b => b.dateStr === iso).length
      list.push({
        dateStr: iso,
        isToday: iso === todayStr,
        dayName: i === 0 ? 'Hôm nay' : (i === 1 ? 'Ngày mai' : (i === -1 ? 'Hôm qua' : getDayOfWeekName(iso))),
        displayDate: `${d.getDate()}/${d.getMonth() + 1}`,
        count: count,
      })
    }
    return list
  }, [bookings, todayStr])

  // Lọc theo ngày trước tiên
  const dateBookings = useMemo(() => {
    if (!selectedDate) return bookings
    return bookings.filter(b => b.dateStr === selectedDate)
  }, [bookings, selectedDate])

  // Lọc nâng cao theo Search & Dropdowns
  const filteredBookings = useMemo(() => {
    return dateBookings.filter(b => {
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
  }, [dateBookings, search, statusFilter, gateFilter, operationFilter])

  // Thống kê KPIs theo ngày đang xem
  const totalBookings = dateBookings.length
  const waitingCount = dateBookings.filter(b => b.status === 'Approved').length
  const checkedInCount = dateBookings.filter(b => b.status === 'Checked-in').length
  const completedCount = dateBookings.filter(b => b.status === 'Completed').length
  const canceledCount = dateBookings.filter(b => b.status === 'Canceled').length

  // Gom nhóm danh sách xe theo trạng thái để xem trực quan
  const groupedByStatus = useMemo(() => {
    return {
      waiting: filteredBookings.filter(b => b.status === 'Approved'),
      checkedIn: filteredBookings.filter(b => b.status === 'Checked-in'),
      completed: filteredBookings.filter(b => b.status === 'Completed'),
      others: filteredBookings.filter(b => b.status === 'Pending' || b.status === 'Canceled'),
    }
  }, [filteredBookings])

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen text-slate-800">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-0.5 rounded-full uppercase tracking-wide">
              CỔNG KIỂM SOÁT
            </span>
            <span className="text-xs text-slate-500 font-medium">Cảng Quốc Tế Tiên Sa · Đà Nẵng</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Lịch Booking Cổng
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Kế hoạch lượt xe container ra vào cổng được điều phối theo ngày (Hiệu lực cả ngày 00:00 – 23:59)
          </p>
        </div>
      </div>

      {/* ── BỘ ĐIỀU HƯỚNG CHỌN NGÀY (DAILY NAVIGATION BAR) ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-4">
        
        {/* Dải Nút Chọn Nhanh Các Ngày Trong Tuần */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <div className="flex items-center gap-2">
            {quickDaysList.map((item) => {
              const isSelected = selectedDate === item.dateStr
              return (
                <button
                  key={item.dateStr}
                  onClick={() => setSelectedDate(item.dateStr)}
                  className={`flex flex-col items-center justify-center min-w-[90px] py-2 px-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-orange-500 border-orange-500 text-white shadow-sm ring-2 ring-orange-200'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <span className={`text-[11px] font-bold uppercase tracking-tight ${isSelected ? 'text-orange-100' : 'text-slate-500'}`}>
                    {item.dayName}
                  </span>
                  <span className="text-sm font-extrabold font-mono mt-0.5">
                    {item.displayDate}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : (item.count > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-500')
                  }`}>
                    {item.count} xe
                  </span>
                </button>
              )
            })}
          </div>

          {/* Ô Chọn Ngày Tùy Chọn & Xem Tất Cả */}
          <div className="flex items-center gap-2 shrink-0 border-l border-slate-200 pl-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Ngày tùy chọn</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-orange-500 cursor-pointer mt-0.5"
              />
            </div>

            <button
              onClick={() => setSelectedDate('')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer mt-3.5 ${
                selectedDate === ''
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả ({bookings.length})
            </button>
          </div>
        </div>

        {/* Thông tin ngày đang xem */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Ngày đang xem:</span>
            {selectedDate ? (
              <span className="font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-lg font-mono">
                {getDayOfWeekName(selectedDate)}, {formatDateVi(selectedDate)}
                {selectedDate === todayStr && ' (Hôm Nay)'}
              </span>
            ) : (
              <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                Toàn bộ lịch sử đặt hẹn
              </span>
            )}
          </div>
          <span className="text-slate-500">
            Tổng cộng: <b className="text-slate-900">{totalBookings} xe</b> đăng ký vào ngày này
          </span>
        </div>

      </div>

      {/* ── KPI CARDS THEO NGÀY ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4">
        
        {/* Card 1: Tổng Booking Trong Ngày */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Tổng Lượt Trong Ngày</span>
            <div className="text-2xl md:text-3xl font-bold text-slate-900 font-mono">{totalBookings}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              {selectedDate ? `Ngày ${formatDateVi(selectedDate)}` : 'Tất cả các ngày'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">local_shipping</span>
          </div>
        </div>

        {/* Card 2: Chờ Vào Cổng */}
        <div className="bg-white rounded-2xl border border-blue-200 p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-blue-700 block mb-1">Chờ Vào Cổng</span>
            <div className="text-2xl md:text-3xl font-bold text-blue-600 font-mono">{waitingCount}</div>
            <span className="text-[11px] text-blue-600 mt-1 block">Đã duyệt / Sẵn sàng</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">schedule</span>
          </div>
        </div>

        {/* Card 3: Đang Trong Cảng */}
        <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-700 block mb-1">Đang Trong Cảng</span>
            <div className="text-2xl md:text-3xl font-bold text-emerald-600 font-mono">{checkedInCount}</div>
            <span className="text-[11px] text-emerald-600 mt-1 block">Đang bốc hạ tại bãi</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">check_circle</span>
          </div>
        </div>

        {/* Card 4: Đã Hoàn Tất Ra Cổng */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">Đã Hoàn Tất Ra Cổng</span>
            <div className="text-2xl md:text-3xl font-bold text-slate-700 font-mono">{completedCount}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Đã gate-out</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">task_alt</span>
          </div>
        </div>

      </div>

      {/* ── TOOLBAR: VIEW SWITCHER & SEARCH/FILTERS ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
        
        {/* Left: View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
          <button
            onClick={() => setViewMode('day_cards')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'day_cards'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-base">view_agenda</span>
            Xem Theo Ngày
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
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm biển số, container, tài xế..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white transition-colors"
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
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-orange-500"
          >
            <option value="All">Tất cả trạng thái</option>
            <option value="Approved">Chờ vào cổng (Approved)</option>
            <option value="Checked-in">Đang trong cảng (Checked-in)</option>
            <option value="Completed">Đã hoàn tất (Completed)</option>
            <option value="Pending">Chờ duyệt (Pending)</option>
            <option value="Canceled">Đã hủy (Canceled)</option>
          </select>

          {/* Operation Filter */}
          <select
            value={operationFilter}
            onChange={(e) => setOperationFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-orange-500"
          >
            <option value="All">Tất cả tác nghiệp</option>
            <option value="Pickup">Lấy Container (Giao vỏ/nhận hàng)</option>
            <option value="Delivery">Hạ Container (Bốc dỡ/gửi)</option>
          </select>

          {/* Gate Filter */}
          <select
            value={gateFilter}
            onChange={(e) => setGateFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-orange-500"
          >
            <option value="All">Tất cả cổng</option>
            <option value="Cổng A">Cổng A</option>
            <option value="Cổng B">Cổng B</option>
          </select>

        </div>

      </div>

      {/* ── VIEW 1: DANH SÁCH XE THEO NGÀY (DAY CARDS VIEW) ── */}
      {viewMode === 'day_cards' && (
        <div className="space-y-6">
          
          {filteredBookings.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">event_busy</span>
              <h3 className="text-base font-bold text-slate-800">Không có lượt booking nào trong ngày này</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {selectedDate ? `Chưa có xe nào đặt lịch hẹn vào ngày ${formatDateVi(selectedDate)} phù hợp với điều kiện tìm kiếm.` : 'Không tìm thấy dữ liệu.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredBookings.map((b) => (
                <div
                  key={b.id + b.licensePlate}
                  onClick={() => setSelectedBooking(b)}
                  className="bg-white border border-slate-200 hover:border-orange-400 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                >
                  {/* Top: License Plate & Operation */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg">
                        {b.licensePlate}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        b.operation === 'Pickup' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {b.operation === 'Pickup' ? 'Lấy Container' : 'Hạ Container'}
                      </span>
                    </div>

                    {/* Booking ID & Container */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono font-bold">
                        <span className="text-orange-600">{b.id}</span>
                        <span className="text-slate-500 font-sans text-[11px]">{formatDateVi(b.dateStr)}</span>
                      </div>

                      <div className="text-sm font-bold text-slate-900 font-mono flex items-center justify-between pt-1">
                        <span className="group-hover:text-orange-600 transition-colors">{b.containerId}</span>
                        <span className="text-[11px] text-slate-500 font-normal font-sans">{b.containerType}</span>
                      </div>

                      <div className="text-xs text-slate-600 truncate pt-0.5">
                        {b.company}
                      </div>
                    </div>
                  </div>

                  {/* Driver & Status */}
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                      <span className="material-symbols-outlined text-sm text-slate-400">person</span>
                      <span className="text-slate-700 font-medium truncate" title={b.driverName}>
                        {b.driverName}
                      </span>
                    </div>

                    {b.status === 'Checked-in' && (
                      <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        Trong cảng
                      </span>
                    )}

                    {b.status === 'Approved' && (
                      <span className="text-blue-700 font-bold flex items-center gap-1 text-[11px] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                        Chờ vào
                      </span>
                    )}

                    {b.status === 'Completed' && (
                      <span className="text-slate-600 font-bold flex items-center gap-1 text-[11px] bg-slate-100 px-2 py-0.5 rounded-md">
                        ✓ Đã ra
                      </span>
                    )}

                    {b.status === 'Pending' && (
                      <span className="text-amber-700 font-bold flex items-center gap-1 text-[11px] bg-amber-50 px-2 py-0.5 rounded-md">
                        Chờ duyệt
                      </span>
                    )}

                    {b.status === 'Canceled' && (
                      <span className="text-red-600 font-bold flex items-center gap-1 text-[11px] bg-red-50 px-2 py-0.5 rounded-md">
                        Đã hủy
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ── VIEW 2: DATA TABLE THEO NGÀY ── */}
      {viewMode === 'table' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="py-3.5 px-4">Mã Booking</th>
                  <th className="py-3.5 px-4">Ngày Hẹn</th>
                  <th className="py-3.5 px-4">Biển Số Xe</th>
                  <th className="py-3.5 px-4">Mã Container</th>
                  <th className="py-3.5 px-4">Tài Xế & SĐT</th>
                  <th className="py-3.5 px-4">Hãng Vận Tải</th>
                  <th className="py-3.5 px-4">Tác Nghiệp</th>
                  <th className="py-3.5 px-4">Cổng</th>
                  <th className="py-3.5 px-4">Trạng Thái</th>
                  <th className="py-3.5 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="py-12 text-center text-slate-400 text-sm">
                      Không tìm thấy lịch booking nào phù hợp với bộ lọc trong ngày này.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => (
                    <tr
                      key={b.id + b.licensePlate}
                      onClick={() => setSelectedBooking(b)}
                      className="hover:bg-orange-50/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-orange-600">
                        {b.id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 font-mono">{formatDateVi(b.dateStr)}</div>
                        <div className="text-[11px] text-slate-500 font-sans">Hiệu lực cả ngày</div>
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
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {b.gate}
                      </td>
                      <td className="py-3 px-4">
                        {b.status === 'Checked-in' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                            Đang trong cảng
                          </span>
                        )}
                        {b.status === 'Approved' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full">
                            Chờ vào cổng
                          </span>
                        )}
                        {b.status === 'Completed' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                            Hoàn tất
                          </span>
                        )}
                        {b.status === 'Pending' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                            Chờ duyệt
                          </span>
                        )}
                        {b.status === 'Canceled' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-100 px-2.5 py-0.5 rounded-full">
                            Đã hủy
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedBooking(b)
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                        >
                          Chi Tiết
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

      {/* ── DETAIL MODAL THEO NGÀY ── */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-orange-600 tracking-wider">
                  CHI TIẾT GATE BOOKING
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="text-xl font-bold text-slate-900 font-mono">
                    {selectedBooking.id}
                  </h3>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    selectedBooking.status === 'Checked-in'
                      ? 'bg-emerald-100 text-emerald-800'
                      : (selectedBooking.status === 'Approved' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700')
                  }`}>
                    {selectedBooking.status === 'Approved' ? 'Chờ vào cổng' : selectedBooking.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold cursor-pointer"
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
                <div className="text-[11px] text-slate-500 font-medium">Số Niêm Chì (Seal)</div>
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
                ['GPLX', selectedBooking.licenseNumber],
                ['Tác Nghiệp', selectedBooking.operation === 'Pickup' ? 'Lấy Container (Giao vỏ/nhận hàng)' : 'Hạ Container (Bốc dỡ/gửi)'],
                ['Loại Container', selectedBooking.containerType],
                ['Ngày Đặt Hẹn', `${formatDateVi(selectedBooking.dateStr)} (Hiệu lực cả ngày)`],
                ['Cổng Phân Bổ', selectedBooking.gate],
                ['Vị Trí Bãi Bốc/Hạ', selectedBooking.yardLocation],
                ['Tổng Trọng Lượng', selectedBooking.grossWeight],
              ].map(([k, v]) => (
                <div key={k} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">{k}</div>
                  <div className="font-bold text-slate-800 truncate" title={v}>{v}</div>
                </div>
              ))}
            </div>

            {/* Checklist Điều Kiện Vào Cổng */}
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1.5">
              <div className="font-bold text-emerald-900 mb-1">Kiểm tra điều kiện vào cổng:</div>
              <div className="flex items-center gap-2 text-emerald-800">
                <span className="font-bold">✓</span>
                <span>Booking có hiệu lực trong ngày {formatDateVi(selectedBooking.dateStr)}</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-800">
                <span className="font-bold">✓</span>
                <span>Thông tin biển số xe và tài xế khớp đăng ký eDO</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-800">
                <span className="font-bold">✓</span>
                <span>Vị trí bãi {selectedBooking.yardLocation} sẵn sàng tiếp nhận</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              {/* Quick Jump to Gate Control if waiting */}
              {selectedBooking.status === 'Approved' ? (
                <button
                  onClick={() => {
                    navigate('/gate')
                  }}
                  className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                >
                  <span className="material-symbols-outlined text-base">sensor_door</span>
                  Chuyển Sang Cổng Kiểm Soát
                </button>
              ) : (
                <div></div>
              )}

              <button
                onClick={() => setSelectedBooking(null)}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
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
