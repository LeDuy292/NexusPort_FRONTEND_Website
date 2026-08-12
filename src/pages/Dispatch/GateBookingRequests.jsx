import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { initialGateBookings } from '../../data/gateBookings'

export default function GateBookingRequests() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState(initialGateBookings)

  // Filters State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [operationFilter, setOperationFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState('Today')
  const [gateFilter, setGateFilter] = useState('All')
  const [companyFilter, setCompanyFilter] = useState('All')

  // Selected Booking Drawer State
  const [selectedBooking, setSelectedBooking] = useState(null)

  // Action Modals State
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionNote, setRejectionNote] = useState('')

  // Toast State
  const [toastMessage, setToastMessage] = useState('')

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4000)
  }

  // Refresh handler
  const handleRefresh = () => {
    showToast('🔄 Đã cập nhật danh sách Yêu Cầu Booking Cổng mới nhất từ các Hãng xe!')
  }

  // 1. KPI Stats Calculation
  const kpiStats = useMemo(() => {
    const pending = bookings.filter(b => b.status === 'Pending').length
    const underReview = bookings.filter(b => b.status === 'Under Review').length
    const approvedToday = bookings.filter(b => b.status === 'Approved').length + 22
    const rejectedToday = bookings.filter(b => b.status === 'Rejected').length + 2
    const atRisk = bookings.filter(b => b.paymentStatus !== 'Paid' || b.gateCapacity?.status === 'Full').length
    return { pending, underReview, approvedToday, rejectedToday, atRisk }
  }, [bookings])

  // Unique companies list for filter dropdown
  const companyList = useMemo(() => {
    const companies = new Set(bookings.map(b => b.company))
    return Array.from(companies)
  }, [bookings])

  // 2. Filtered Bookings List
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      // Search
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        b.id.toLowerCase().includes(q) ||
        b.containerId.toLowerCase().includes(q) ||
        b.licensePlate.toLowerCase().includes(q) ||
        b.company.toLowerCase().includes(q) ||
        b.driverName.toLowerCase().includes(q)

      // Status
      let matchesStatus = true
      if (statusFilter !== 'All') {
        matchesStatus = b.status === statusFilter
      }

      // Operation
      let matchesOp = true
      if (operationFilter !== 'All') {
        matchesOp = b.operation === operationFilter
      }

      // Gate
      let matchesGate = true
      if (gateFilter !== 'All') {
        matchesGate = b.requestedGate === gateFilter
      }

      // Company
      let matchesCompany = true
      if (companyFilter !== 'All') {
        matchesCompany = b.company === companyFilter
      }

      return matchesSearch && matchesStatus && matchesOp && matchesGate && matchesCompany
    })
  }, [bookings, searchQuery, statusFilter, operationFilter, gateFilter, companyFilter])

  // Start Reviewing Booking (Pending -> Under Review)
  const handleStartReview = (booking) => {
    const updated = {
      ...booking,
      status: 'Under Review',
      reviewStartedAt: new Date().toLocaleString('vi-VN'),
      reviewedBy: 'Dispatcher - Nguyễn Văn Q',
      timelineStep: 3
    }
    setBookings(prev => prev.map(b => b.id === booking.id ? updated : b))
    setSelectedBooking(updated)
    showToast(`🔵 Đã chuyển Booking ${booking.id} sang trạng thái Under Review (Đang kiểm tra).`)
  }

  // Confirm Approval Handler
  const handleConfirmApproval = () => {
    if (!selectedBooking) return
    const updated = {
      ...selectedBooking,
      status: 'Approved',
      approvedAt: new Date().toLocaleString('vi-VN'),
      approvedBy: 'Dispatcher - Nguyễn Văn Q',
      dispatchOrderId: `DSP-${Date.now().toString().slice(-6)}`,
      timelineStep: 4
    }
    setBookings(prev => prev.map(b => b.id === selectedBooking.id ? updated : b))
    setSelectedBooking(updated)
    setShowApproveModal(false)
    showToast(`🟢 Đã duyệt thành công Gate Booking ${selectedBooking.id}! Đã chuyển dữ liệu sang Cổng & Lệnh điều phối.`)
  }

  // Confirm Rejection Handler
  const handleConfirmRejection = () => {
    if (!rejectionReason) {
      showToast('⚠️ Vui lòng chọn lý do từ chối trước khi xác nhận!')
      return
    }
    if (!selectedBooking) return

    const updated = {
      ...selectedBooking,
      status: 'Rejected',
      rejectionReason,
      rejectionNote,
      timelineStep: 3
    }
    setBookings(prev => prev.map(b => b.id === selectedBooking.id ? updated : b))
    setSelectedBooking(updated)
    setShowRejectModal(false)
    setRejectionReason('')
    setRejectionNote('')
    showToast(`🔴 Đã từ chối Gate Booking ${selectedBooking.id}. Lý do: ${rejectionReason}`)
  }

  // Render Status Badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full font-extrabold text-[11px] inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Pending (Chờ duyệt)</span>
      case 'Under Review':
        return <span className="px-3 py-1 bg-blue-100 text-blue-900 border border-blue-300 rounded-full font-extrabold text-[11px] inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Under Review (Đang duyệt)</span>
      case 'Approved':
        return <span className="px-3 py-1 bg-green-100 text-green-900 border border-green-300 rounded-full font-extrabold text-[11px] inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"></span> Approved (Đã duyệt)</span>
      case 'Rejected':
        return <span className="px-3 py-1 bg-red-100 text-red-900 border border-red-300 rounded-full font-extrabold text-[11px] inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> Rejected (Từ chối)</span>
      case 'Cancelled':
        return <span className="px-3 py-1 bg-slate-100 text-slate-800 border border-slate-300 rounded-full font-extrabold text-[11px] inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400"></span> Cancelled</span>
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full font-bold text-[11px]">{status}</span>
    }
  }

  // Calculate Eligibility Verification Checklist for Selected Booking
  const checkEligibility = (b) => {
    if (!b) return { isEligible: false, checks: [] }
    const checks = [
      { id: 'cargo', label: 'Cargo Declaration Approved', ok: b.cargoDeclarationStatus === 'Approved' },
      { id: 'container', label: 'Container Information Valid', ok: !!b.containerId },
      { id: 'vehicle', label: 'Vehicle Registered & Available', ok: b.vehicleStatus === 'Available' },
      { id: 'driver', label: 'Driver License Valid & Active', ok: b.licenseStatus === 'Valid' && b.driverStatus === 'Available' },
      { id: 'schedule', label: 'ETA Schedule Valid', ok: true },
      { id: 'capacity', label: 'Gate Capacity Available', ok: b.gateCapacity?.status !== 'Full' },
      { id: 'duplicate', label: 'No Duplicate Booking ID', ok: true },
      { id: 'fee', label: 'Port Fee Paid', ok: b.paymentStatus === 'Paid' }
    ]
    const isEligible = checks.every(c => c.ok)
    return { isEligible, checks }
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 relative bg-slate-50 min-h-screen">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-carbon text-white px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-extrabold flex items-center gap-3 z-50 animate-bounce border border-signal-orange">
          <span className="material-symbols-outlined text-signal-orange text-base animate-spin">info</span>
          {toastMessage}
        </div>
      )}

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-chalk rounded-2xl p-5 shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full uppercase">
              DISPATCHER CONTROL PORTAL
            </span>
            <span className="text-xs font-bold text-slate font-mono">Cảng Tiên Sa · Đà Nẵng</span>
          </div>
          <h2 className="font-heading text-3xl text-carbon font-extrabold">Gate Booking Requests</h2>
          <p className="text-xs text-slate mt-0.5">Tiếp nhận và phê duyệt lịch xe ra vào cảng do các Transport Company bên ngoài đăng ký.</p>
        </div>

        <button
          onClick={handleRefresh}
          className="h-11 px-5 bg-fog border border-chalk text-carbon rounded-xl font-extrabold text-xs hover:bg-slate-200 transition-colors shadow-2xs flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          Refresh
        </button>
      </div>

      {/* ── KPI SUMMARY (5 CARDS) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white border-2 border-amber-400 rounded-xl p-4 shadow-sm space-y-1 bg-amber-50/20">
          <span className="text-amber-900 text-[10px] uppercase font-extrabold tracking-wider">PENDING REVIEW</span>
          <div className="text-3xl font-extrabold text-amber-600 font-mono">{kpiStats.pending}</div>
          <span className="text-[11px] text-amber-800 font-bold">Booking đang chờ xử lý</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">UNDER REVIEW</span>
          <div className="text-3xl font-extrabold text-blue-600 font-mono">{kpiStats.underReview}</div>
          <span className="text-[11px] text-blue-600 font-bold">Đang được Dispatcher kiểm tra</span>
        </div>

        <div className="bg-white border border-green-300 rounded-xl p-4 shadow-sm space-y-1 bg-green-50/20">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">APPROVED TODAY</span>
          <div className="text-3xl font-extrabold text-green-600 font-mono">{kpiStats.approvedToday}</div>
          <span className="text-[11px] text-green-700 font-bold">Đã duyệt hôm nay</span>
        </div>

        <div className="bg-white border border-red-300 rounded-xl p-4 shadow-sm space-y-1 bg-red-50/20">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">REJECTED TODAY</span>
          <div className="text-3xl font-extrabold text-red-600 font-mono">{kpiStats.rejectedToday}</div>
          <span className="text-[11px] text-red-600 font-bold">Từ chối không đủ điều kiện</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">LATE / AT RISK</span>
          <div className="text-3xl font-extrabold text-orange-600 font-mono">{kpiStats.atRisk}</div>
          <span className="text-[11px] text-orange-600 font-bold">Chưa nạp phí hoặc Cổng đầy</span>
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ── */}
      <div className="bg-white rounded-2xl border border-chalk p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Search Input */}
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate text-sm">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search Booking ID, Container, Vehicle, Company..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-chalk bg-fog text-xs font-bold text-carbon placeholder:text-slate focus:outline-none focus:border-signal-orange"
          />
        </div>

        {/* Filters Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
          >
            <option value="All">All Statuses ▼</option>
            <option value="Pending">Pending (Chờ duyệt)</option>
            <option value="Under Review">Under Review (Đang duyệt)</option>
            <option value="Approved">Approved (Đã duyệt)</option>
            <option value="Rejected">Rejected (Bị từ chối)</option>
            <option value="Cancelled">Cancelled (Đã hủy)</option>
          </select>

          {/* Operation Filter */}
          <select
            value={operationFilter}
            onChange={e => setOperationFilter(e.target.value)}
            className="px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
          >
            <option value="All">All Operations ▼</option>
            <option value="Pickup">Pickup (Lấy cont)</option>
            <option value="Delivery">Delivery (Hạ cont)</option>
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
          >
            <option value="Today">Today (Hôm nay)</option>
            <option value="Tomorrow">Tomorrow (Ngày mai)</option>
            <option value="This Week">This Week (Tuần này)</option>
          </select>

          {/* Gate Filter */}
          <select
            value={gateFilter}
            onChange={e => setGateFilter(e.target.value)}
            className="px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
          >
            <option value="All">All Gates ▼</option>
            <option value="Gate 1">Gate 1</option>
            <option value="Gate 2">Gate 2</option>
            <option value="Gate 3">Gate 3</option>
          </select>

          {/* Transport Company Filter */}
          <select
            value={companyFilter}
            onChange={e => setCompanyFilter(e.target.value)}
            className="px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange max-w-[160px] truncate"
          >
            <option value="All">All Companies ▼</option>
            {companyList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── BOOKING TABLE ── */}
      <div className="bg-white rounded-2xl border border-chalk shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-fog border-b border-chalk text-slate font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-6">Booking ID</th>
                <th className="py-3.5 px-6">Transport Company</th>
                <th className="py-3.5 px-6">Container ID</th>
                <th className="py-3.5 px-6">Operation</th>
                <th className="py-3.5 px-6">Vehicle & Plate</th>
                <th className="py-3.5 px-6">Driver</th>
                <th className="py-3.5 px-6">ETA</th>
                <th className="py-3.5 px-6">Gate</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk font-medium">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate font-bold">
                    <div className="space-y-2">
                      <span className="material-symbols-outlined text-4xl text-slate-400">inbox</span>
                      <p className="text-sm text-carbon font-extrabold">Không có Gate Booking nào phù hợp.</p>
                      <p className="text-xs text-slate">Tất cả yêu cầu đặt lịch hẹn từ Transport Company sẽ xuất hiện ở đây.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBookings.map(b => (
                  <tr key={b.id} className="hover:bg-fog/80 transition-colors">
                    <td
                      onClick={() => setSelectedBooking(b)}
                      className="py-4 px-6 font-mono font-extrabold text-signal-orange cursor-pointer hover:underline"
                    >
                      {b.id}
                    </td>
                    <td className="py-4 px-6 font-bold text-carbon">
                      <div>{b.company}</div>
                      <div className="text-[10px] text-slate font-mono font-normal">ID: {b.companyId}</div>
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-carbon">
                      {b.containerId}
                      <div className="text-[10px] text-slate font-sans font-normal">{b.containerType} • {b.cargoType}</div>
                    </td>
                    <td className="py-4 px-6 font-bold">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono ${
                        b.operation === 'Pickup' ? 'bg-blue-100 text-blue-900 border border-blue-200' : 'bg-purple-100 text-purple-900 border border-purple-200'
                      }`}>
                        {b.operation}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-carbon">
                      {b.vehicleId}
                      <div className="text-[10px] text-slate font-normal">{b.licensePlate}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-carbon">{b.driverName}</div>
                      <div className="text-[10px] text-slate font-mono font-normal">GPLX: {b.licenseNumber} ({b.licenseClass})</div>
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-carbon">
                      {b.eta.split('T')[1]?.slice(0, 5) || b.eta}
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-slate-800">
                      {b.requestedGate}
                    </td>
                    <td className="py-4 px-6">
                      {renderStatusBadge(b.status)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {(b.status === 'Pending' || b.status === 'Under Review') ? (
                        <button
                          onClick={() => setSelectedBooking(b)}
                          className="px-3.5 py-1.5 bg-amber-500 text-white rounded-xl font-extrabold text-xs hover:bg-amber-600 transition-colors shadow-xs flex items-center gap-1 ml-auto"
                        >
                          <span className="material-symbols-outlined text-[15px]">fact_check</span>
                          Review
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedBooking(b)}
                          className="px-3.5 py-1.5 bg-carbon text-white rounded-xl font-extrabold text-xs hover:bg-black transition-colors shadow-2xs flex items-center gap-1 ml-auto"
                        >
                          <span className="material-symbols-outlined text-[15px]">visibility</span>
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── GATE BOOKING DETAIL DRAWER / SLIDE-OVER ── */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
          <div className="bg-white w-full max-w-3xl max-h-[92vh] rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl overflow-y-auto animate-in zoom-in-95 duration-200 font-sans">
            
            {/* Drawer Top Header */}
            <div className="flex justify-between items-start border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-extrabold text-slate uppercase block font-mono">GATE BOOKING REVIEW CENTER</span>
                <h3 className="font-heading text-3xl font-extrabold text-carbon font-mono">
                  {selectedBooking.id}
                </h3>
                <div className="mt-1 flex items-center gap-3">
                  {renderStatusBadge(selectedBooking.status)}
                  {selectedBooking.status === 'Pending' && (
                    <button
                      onClick={() => handleStartReview(selectedBooking)}
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg font-extrabold text-xs hover:bg-blue-700 shadow-xs flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">play_arrow</span>
                      Start Review
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => setSelectedBooking(null)}
                className="w-9 h-9 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* AUTOMATION VERDICT BANNER */}
            {(() => {
              const { isEligible, checks } = checkEligibility(selectedBooking)
              return (
                <div className={`p-4 rounded-2xl border-2 space-y-2 text-xs font-mono ${
                  isEligible ? 'bg-green-50 border-green-400 text-green-900' : 'bg-red-50 border-red-300 text-red-900'
                }`}>
                  <div className="flex items-center justify-between font-extrabold text-sm">
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">{isEligible ? 'verified' : 'gpp_bad'}</span>
                      {isEligible ? '🟢 Booking is eligible for approval' : '🔴 Booking cannot be approved'}
                    </span>
                    <span className="text-[11px] font-sans">
                      {isEligible ? 'Tất cả tiêu chí kiểm tra hợp lệ' : 'Phát hiện tiêu chí không đạt'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-200">
                    {checks.map(c => (
                      <div key={c.id} className="flex items-center gap-1.5">
                        <span className={c.ok ? 'text-green-600 font-extrabold' : 'text-red-600 font-extrabold'}>
                          {c.ok ? '☑' : '☒'}
                        </span>
                        <span className={c.ok ? 'text-slate-700' : 'text-red-700 font-extrabold'}>{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Rejection Notice if Status = Rejected */}
            {selectedBooking.status === 'Rejected' && (
              <div className="bg-red-50 border-2 border-red-300 p-4 rounded-2xl space-y-1 text-xs">
                <strong className="text-red-900 font-extrabold flex items-center gap-1.5 text-sm">
                  🔴 BOOKING BỊ TỪ CHỐI BỞI DISPATCHER
                </strong>
                <div className="text-red-800 font-bold">Lý do chính: {selectedBooking.rejectionReason}</div>
                {selectedBooking.rejectionNote && (
                  <div className="text-red-700 font-medium">Ghi chú: "{selectedBooking.rejectionNote}"</div>
                )}
              </div>
            )}

            {/* SECTIONS GRID */}
            <div className="space-y-4 text-xs">

              {/* 1. TRANSPORT COMPANY */}
              <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-signal-orange uppercase font-mono block">1. TRANSPORT COMPANY</span>
                  <button
                    onClick={() => showToast(`🏢 Mã Doanh nghiệp Vận tải: ${selectedBooking.companyId} (${selectedBooking.company})`)}
                    className="px-2.5 py-1 bg-white border border-chalk rounded-lg text-carbon font-bold text-[11px] hover:bg-slate-100"
                  >
                    View Company
                  </button>
                </div>
                <div className="font-extrabold text-carbon text-sm">{selectedBooking.company}</div>
                <div className="grid grid-cols-2 gap-2 text-slate font-mono">
                  <div>Company ID: {selectedBooking.companyId}</div>
                  <div>Người liên hệ: {selectedBooking.contactName}</div>
                  <div>Điện thoại: {selectedBooking.phone}</div>
                  <div>Email: {selectedBooking.email}</div>
                </div>
              </div>

              {/* 2. CONTAINER INFORMATION */}
              <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-signal-orange uppercase font-mono block">2. CONTAINER INFORMATION</span>
                  <button
                    onClick={() => showToast(`📄 Mở Cargo Declaration: ${selectedBooking.cargoDeclarationId}`)}
                    className="px-2.5 py-1 bg-white border border-chalk rounded-lg text-carbon font-bold text-[11px] hover:bg-slate-100"
                  >
                    View Cargo Declaration
                  </button>
                </div>
                <div className="flex justify-between font-mono font-bold text-carbon text-sm">
                  <span>Mã Cont: {selectedBooking.containerId}</span>
                  <span>Loại: {selectedBooking.containerType}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate font-mono">
                  <div>Loại hàng: {selectedBooking.cargoType}</div>
                  <div>Loại giao nhận: <strong>{selectedBooking.operation}</strong></div>
                  <div>Mã Khai Báo Hàng: <strong>{selectedBooking.cargoDeclarationId}</strong></div>
                  <div>
                    Trạng thái Khai báo: {' '}
                    <span className="px-2 py-0.5 bg-green-100 text-green-900 border border-green-300 rounded font-bold">
                      {selectedBooking.cargoDeclarationStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. VEHICLE INFORMATION */}
              <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-signal-orange uppercase font-mono block">3. VEHICLE INFORMATION</span>
                  <button
                    onClick={() => navigate('/fleet')}
                    className="px-2.5 py-1 bg-white border border-chalk rounded-lg text-carbon font-bold text-[11px] hover:bg-slate-100"
                  >
                    View Vehicle
                  </button>
                </div>
                <div className="flex justify-between font-mono font-bold text-carbon text-sm">
                  <span>Vehicle ID: {selectedBooking.vehicleId}</span>
                  <span>Biển Số: {selectedBooking.licensePlate}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate font-mono">
                  <div>Loại xe: {selectedBooking.vehicleType}</div>
                  <div>Trạng thái xe: <strong className="text-green-700">{selectedBooking.vehicleStatus}</strong></div>
                </div>
              </div>

              {/* 4. DRIVER INFORMATION */}
              <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-signal-orange uppercase font-mono block">4. DRIVER INFORMATION</span>
                  <button
                    onClick={() => navigate('/dispatcher/drivers')}
                    className="px-2.5 py-1 bg-white border border-chalk rounded-lg text-carbon font-bold text-[11px] hover:bg-slate-100"
                  >
                    View Driver
                  </button>
                </div>
                <div className="flex justify-between font-mono font-bold text-carbon text-sm">
                  <span>Tài Xế: {selectedBooking.driverName}</span>
                  <span>Driver ID: {selectedBooking.driverId}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate font-mono">
                  <div>Số GPLX: {selectedBooking.licenseNumber} ({selectedBooking.licenseClass})</div>
                  <div>Tình trạng bằng lái: <strong className="text-green-700">🟢 {selectedBooking.licenseStatus}</strong></div>
                  <div>Trạng thái hoạt động: <strong className="text-green-700">🟢 {selectedBooking.driverStatus}</strong></div>
                </div>
              </div>

              {/* 5. SCHEDULE & GATE CAPACITY */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2">
                  <span className="text-[10px] font-extrabold text-signal-orange uppercase font-mono block">5. SCHEDULE INFO</span>
                  <div className="font-mono text-carbon font-bold">ETA: {selectedBooking.eta.replace('T', ' - ')}</div>
                  <div className="text-slate">Thời gian xử lý dự kiến: {selectedBooking.expectedDuration}</div>
                  <div className="text-slate">Cổng yêu cầu: <strong>{selectedBooking.requestedGate}</strong></div>
                  <div className="text-slate text-[11px]">Ngày tạo booking: {selectedBooking.createdAt}</div>
                </div>

                <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2">
                  <span className="text-[10px] font-extrabold text-signal-orange uppercase font-mono block">6. GATE CAPACITY METER</span>
                  <div className="font-mono text-carbon font-bold">{selectedBooking.gateCapacity.gate}</div>
                  <div className="text-slate">Sức chứa hiện tại: <strong>{selectedBooking.gateCapacity.current} / {selectedBooking.gateCapacity.max} xe</strong></div>
                  <div className="mt-1">
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                      selectedBooking.gateCapacity.status === 'Available' ? 'bg-green-100 text-green-900 border border-green-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      ● Status: {selectedBooking.gateCapacity.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* 6. PORT FEES PAYMENT */}
              <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2">
                <span className="text-[10px] font-extrabold text-signal-orange uppercase font-mono block">7. PORT FEES PAYMENT STATUS</span>
                <div className="flex justify-between items-center font-mono">
                  <span>Phí Cổng: 300,000 VND | Phí Nâng Hạ: 200,000 VND</span>
                  <strong className="text-carbon text-sm">Tổng: {selectedBooking.totalFee.toLocaleString()} VND</strong>
                </div>
                <div>
                  Payment Status: {' '}
                  <span className={`px-2.5 py-0.5 rounded font-extrabold font-mono text-[11px] ${
                    selectedBooking.paymentStatus === 'Paid' ? 'bg-green-100 text-green-900 border border-green-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}>
                    {selectedBooking.paymentStatus === 'Paid' ? '🟢 Paid (Đã thanh toán)' : '🟠 Pending Payment (Chờ thanh toán)'}
                  </span>
                </div>
              </div>

              {/* 7. BOOKING LIFECYCLE TIMELINE */}
              <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2">
                <span className="text-[10px] font-extrabold text-signal-orange uppercase font-mono block">8. BOOKING LIFECYCLE TIMELINE</span>
                <div className="grid grid-cols-4 gap-2 font-mono text-[11px] text-center pt-1">
                  <div className="p-2 bg-green-100 text-green-900 border border-green-300 rounded-xl">
                    ✓ Created
                  </div>
                  <div className="p-2 bg-green-100 text-green-900 border border-green-300 rounded-xl">
                    ✓ Submitted
                  </div>
                  <div className={`p-2 rounded-xl border ${
                    selectedBooking.timelineStep >= 3 ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-white text-slate'
                  }`}>
                    {selectedBooking.timelineStep >= 3 ? '✓ Under Review' : '○ Under Review'}
                  </div>
                  <div className={`p-2 rounded-xl border ${
                    selectedBooking.status === 'Approved' ? 'bg-green-100 text-green-900 border-green-300' : selectedBooking.status === 'Rejected' ? 'bg-red-100 text-red-900 border-red-300' : 'bg-white text-slate'
                  }`}>
                    {selectedBooking.status === 'Approved' ? '🟢 Approved' : selectedBooking.status === 'Rejected' ? '🔴 Rejected' : '○ Approval'}
                  </div>
                </div>
              </div>

            </div>

            {/* Drawer Bottom Actions */}
            <div className="pt-4 border-t border-chalk flex justify-between items-center">
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-5 py-2.5 bg-fog border border-chalk text-carbon rounded-xl font-extrabold text-xs hover:bg-slate-200"
              >
                Đóng
              </button>

              <div className="flex gap-3">
                {selectedBooking.status !== 'Approved' && (
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-extrabold text-xs hover:bg-red-700 shadow-sm flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">block</span>
                    Reject Booking
                  </button>
                )}

                {selectedBooking.status !== 'Approved' ? (
                  <button
                    onClick={() => setShowApproveModal(true)}
                    className="px-6 py-2.5 bg-signal-orange text-white rounded-xl font-extrabold text-xs hover:opacity-95 shadow-lg flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">task_alt</span>
                    Approve Booking
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      showToast(`🔄 Đã chuyển sang Lệnh Điều Phối cho Booking ${selectedBooking.id}`)
                      navigate('/dispatch')
                    }}
                    className="px-6 py-2.5 bg-carbon text-white rounded-xl font-extrabold text-xs hover:bg-black shadow-md flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">alt_route</span>
                    View Dispatch Order ➔
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── APPROVE CONFIRMATION MODAL ── */}
      {showApproveModal && selectedBooking && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 font-sans">
            <div className="flex items-center gap-3 border-b border-chalk pb-3">
              <span className="material-symbols-outlined text-green-600 text-3xl">task_alt</span>
              <div>
                <h3 className="font-heading text-xl font-extrabold text-carbon">APPROVE GATE BOOKING?</h3>
                <p className="text-xs text-slate">Xác nhận phê duyệt lịch hẹn xe vào cảng.</p>
              </div>
            </div>

            <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2 font-mono text-xs">
              <div className="flex justify-between"><span>Booking ID:</span><strong className="text-carbon font-bold">{selectedBooking.id}</strong></div>
              <div className="flex justify-between"><span>Container ID:</span><strong className="text-carbon font-bold">{selectedBooking.containerId}</strong></div>
              <div className="flex justify-between"><span>Phương tiện:</span><strong className="text-carbon font-bold">{selectedBooking.vehicleId} ({selectedBooking.licensePlate})</strong></div>
              <div className="flex justify-between"><span>Tài xế:</span><strong className="text-carbon font-bold">{selectedBooking.driverName}</strong></div>
              <div className="flex justify-between"><span>Cổng & ETA:</span><strong className="text-signal-orange font-bold">{selectedBooking.requestedGate} • {selectedBooking.eta.split('T')[1]?.slice(0, 5)}</strong></div>
            </div>

            <p className="text-xs text-blue-900 bg-blue-50 p-3 rounded-xl border border-blue-200 font-medium">
              ℹ️ "Booking này sẽ được chuyển sang Cổng kiểm soát (Gate Officer) để thực hiện thủ tục Check-in khi xe đến cảng."
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2.5 bg-fog border border-chalk text-slate font-bold rounded-xl text-xs hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApproval}
                className="px-6 py-2.5 bg-green-600 text-white font-extrabold rounded-xl text-xs hover:bg-green-700 shadow-md"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REJECT BOOKING MODAL ── */}
      {showRejectModal && selectedBooking && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 font-sans">
            <div className="flex items-center gap-3 border-b border-chalk pb-3">
              <span className="material-symbols-outlined text-red-600 text-3xl">block</span>
              <div>
                <h3 className="font-heading text-xl font-extrabold text-carbon">REJECT GATE BOOKING</h3>
                <p className="text-xs text-slate">Chọn lý do từ chối đăng ký lịch hẹn cảng.</p>
              </div>
            </div>

            <div className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate uppercase text-[10px] mb-1">Lý do từ chối *</label>
                <select
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-red-500 font-bold"
                >
                  <option value="">-- Chọn lý do từ chối --</option>
                  <option value="Invalid Vehicle">Invalid Vehicle (Xe không hợp lệ/hết hạn kiểm định)</option>
                  <option value="Invalid Driver">Invalid Driver (Tài xế không hợp lệ/hết hạn bằng lái)</option>
                  <option value="Invalid Container">Invalid Container (Mã container sai quy chuẩn)</option>
                  <option value="Missing Cargo Declaration">Missing Cargo Declaration (Chưa được duyệt khai báo hàng hóa)</option>
                  <option value="Gate Capacity Full">Gate Capacity Full (Cổng yêu cầu đã đầy dung lượng)</option>
                  <option value="Duplicate Booking">Duplicate Booking (Trùng lặp lịch hẹn)</option>
                  <option value="Payment Not Completed">Payment Not Completed (Chưa hoàn tất phí cảng)</option>
                  <option value="Invalid Schedule">Invalid Schedule (Khung giờ không hợp lệ)</option>
                  <option value="Other">Other (Lý do khác)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate uppercase text-[10px] mb-1">Ghi chú chi tiết (Optional)</label>
                <textarea
                  rows="3"
                  value={rejectionNote}
                  onChange={e => setRejectionNote(e.target.value)}
                  placeholder="Nhập ghi chú giải thích lý do cho Hãng xe..."
                  className="w-full p-3 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-red-500"
                ></textarea>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2.5 bg-fog border border-chalk text-slate font-bold rounded-xl text-xs hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={!rejectionReason}
                onClick={handleConfirmRejection}
                className={`px-6 py-2.5 rounded-xl font-extrabold text-xs shadow-md ${
                  rejectionReason ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Reject Booking
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
