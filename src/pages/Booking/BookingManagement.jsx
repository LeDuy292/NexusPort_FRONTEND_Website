import React, { useState, useEffect } from 'react'
import { bookingService } from '../../services/bookingService'

export default function BookingManagement() {
  const [activeTab, setActiveTab] = useState('my_bookings')
  
  // Data States for My Bookings
  const [bookings, setBookings] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize] = useState(10)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')

  // Notification Toast State
  const [toast, setToast] = useState(null)

  // Modals States
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Create Form Wizard State (Step 1 -> Step 2 -> Step 3)
  const [wizardStep, setWizardStep] = useState(1)
  const [form, setForm] = useState({
    bookingType: 'Pickup', // Pickup or Dropoff
    carrierId: 'c1010101-0000-0000-0000-000000000001',
    driverId: 'd1010101-0000-0000-0000-000000000001',
    truckId: 'v1010101-0000-0000-0000-000000000001',
    bookingCode: `BK-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`,
    containerNo: 'MSKU8891024',
    sealNumber: 'SEAL-99881',
    appointmentDate: new Date().toISOString().slice(0, 10),
    startTime: '08:00',
    endTime: '10:00'
  })

  // Load Bookings Data from API on filters or page change
  useEffect(() => {
    fetchBookings()
  }, [pageNumber, statusFilter, typeFilter])

  const fetchBookings = async () => {
    setLoading(true)
    try {
      const params = {
        pageNumber,
        pageSize,
        search: searchTerm.trim() || undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        bookingType: typeFilter !== 'All' ? typeFilter : undefined
      }

      const res = await bookingService.getBookings(params)
      setBookings(res.items || [])
      setTotalCount(res.totalCount || 0)
    } catch (err) {
      console.error('Lỗi tải danh sách booking:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPageNumber(1)
    fetchBookings()
  }

  const showNotification = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const [validationErrors, setValidationErrors] = useState([])

  // Handle Form Submit (Create Booking)
  const handleCreateBooking = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    setValidationErrors([])
    try {
      const startIso = new Date(`${form.appointmentDate}T${form.startTime}:00Z`).toISOString()
      const endIso = new Date(`${form.appointmentDate}T${form.endTime}:00Z`).toISOString()

      const payload = {
        carrierId: form.carrierId,
        driverId: form.driverId,
        truckId: form.truckId,
        bookingCode: form.bookingCode,
        bookingType: form.bookingType,
        appointmentStart: startIso,
        appointmentEnd: endIso,
        containerIds: [form.containerNo]
      }

      await bookingService.createBooking(payload)
      showNotification(`Tạo Đặt chỗ ${form.bookingCode} thành công! Trạng thái: Pending`)
      
      // Reset form and return to My Bookings tab
      setForm({
        ...form,
        bookingCode: `BK-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`,
        containerNo: `MSKU${Math.floor(1000000 + Math.random() * 9000000)}`
      })
      setWizardStep(1)
      setActiveTab('my_bookings')
      fetchBookings()
    } catch (err) {
      const errResponse = err?.response?.data
      if (errResponse && errResponse.Errors) {
        const errorList = Object.entries(errResponse.Errors).flatMap(([_, msgs]) => msgs)
        setValidationErrors(errorList)
        showNotification('Yêu cầu bị từ chối do vi phạm điều kiện nghiệp vụ!', 'error')
      } else {
        showNotification(errResponse?.message || 'Lỗi kiểm tra tạo đặt chỗ. Vui lòng kiểm tra lại!', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Edit/Update Booking
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    id: '',
    bookingCode: '',
    appointmentDate: '',
    startTime: '08:00',
    endTime: '10:00',
    containerNo: ''
  })

  const openEditModal = (bk) => {
    setSelectedBooking(bk)
    const startDate = bk.appointmentStart ? new Date(bk.appointmentStart) : new Date()
    const endDate = bk.appointmentEnd ? new Date(bk.appointmentEnd) : new Date()

    setEditForm({
      id: bk.id,
      bookingCode: bk.bookingCode,
      appointmentDate: startDate.toISOString().slice(0, 10),
      startTime: startDate.toTimeString().slice(0, 5),
      endTime: endDate.toTimeString().slice(0, 5),
      containerNo: bk.containerIds && bk.containerIds.length > 0 ? bk.containerIds[0] : 'MSKU8891024'
    })
    setShowEditModal(true)
  }

  const handleUpdateBooking = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const startIso = new Date(`${editForm.appointmentDate}T${editForm.startTime}:00Z`).toISOString()
      const endIso = new Date(`${editForm.appointmentDate}T${editForm.endTime}:00Z`).toISOString()

      const payload = {
        appointmentStart: startIso,
        appointmentEnd: endIso,
        containerIds: [editForm.containerNo]
      }

      await bookingService.updateBooking(editForm.id, payload)
      showNotification(`Đã cập nhật Booking ${editForm.bookingCode} thành công vào Database!`)
      setShowEditModal(false)
      fetchBookings()
    } catch (err) {
      showNotification('Không thể cập nhật Booking này. Vui lòng kiểm tra trạng thái!', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Cancel Booking
  const handleConfirmCancel = async () => {
    if (!selectedBooking) return
    setActionLoading(true)
    try {
      await bookingService.cancelBooking(selectedBooking.id, cancelReason)
      showNotification(`Đã hủy đặt chỗ ${selectedBooking.bookingCode} thành công.`)
      setShowCancelModal(false)
      setCancelReason('')
      fetchBookings()
    } catch (err) {
      showNotification('Không thể hủy đặt chỗ này.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Helper function: Render Status Badge with Curated HSL Palette
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs font-bold flex items-center gap-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            Chờ phê duyệt
          </span>
        )
      case 'Approved':
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs font-bold flex items-center gap-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Đã duyệt
          </span>
        )
      case 'CheckedIn':
        return (
          <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 text-xs font-bold flex items-center gap-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Đã Gate-In
          </span>
        )
      case 'Completed':
        return (
          <span className="px-3 py-1 rounded-full bg-slate-500/10 border border-slate-500/30 text-slate-600 text-xs font-bold flex items-center gap-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            Đã hoàn thành
          </span>
        )
      case 'Canceled':
        return (
          <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs font-bold flex items-center gap-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Đã hủy
          </span>
        )
      default:
        return (
          <span className="px-3 py-1 rounded-full bg-gray-500/10 border border-gray-500/30 text-gray-600 text-xs font-bold">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 max-w-7xl mx-auto">
      
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold flex items-center gap-3 transition-all animate-bounce ${
          toast.type === 'error' ? 'bg-rose-900 border-rose-700 text-rose-100' : 'bg-emerald-900 border-emerald-700 text-emerald-100'
        }`}>
          <span className="material-symbols-outlined">{toast.type === 'error' ? 'error' : 'check_circle'}</span>
          {toast.message}
        </div>
      )}

      {/* HEADER TITLE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl md:text-4xl text-primary font-extrabold tracking-tight flex items-center gap-3">
            <span className="material-symbols-outlined text-signal-orange text-4xl">event_available</span>
            Quản lý Đặt chỗ (Booking Management)
          </h2>
          <p className="text-sm text-slate mt-1">
            Đăng ký phương tiện, chọn khung giờ ra/vào cảng và kết nối dữ liệu Gateway thông minh.
          </p>
        </div>

        <button
          onClick={() => {
            setActiveTab('create')
            setWizardStep(1)
          }}
          className="px-5 py-2.5 rounded-xl bg-signal-orange hover:bg-orange-600 text-white font-bold text-sm transition-all shadow-md hover:shadow-orange-500/25 flex items-center gap-2 w-fit"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          Tạo Đặt chỗ Mới
        </button>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex gap-4 border-b border-chalk overflow-x-auto pb-1">
        {[
          { key: 'my_bookings', label: 'Đặt chỗ của tôi (Live Data)', icon: 'list_alt' },
          { key: 'create', label: 'Tạo mới (Booking Wizard)', icon: 'edit_calendar' },
          { key: 'container_status', label: 'Lộ trình Container', icon: 'route' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 px-4 font-semibold text-sm transition-all flex items-center gap-2 whitespace-nowrap border-b-2 ${
              activeTab === tab.key
                ? 'text-signal-orange border-signal-orange font-bold'
                : 'text-slate border-transparent hover:text-carbon'
            }`}
          >
            <span className="material-symbols-outlined text-xl">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MY BOOKINGS LIST (LIVE DATABASE INTEGRATION) */}
      {/* ========================================================================= */}
      {activeTab === 'my_bookings' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* SEARCH AND FILTERS TOOLBAR */}
          <div className="bg-paper border border-chalk rounded-2xl p-5 shadow-sm space-y-4">
            <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4 justify-between items-center">
              
              {/* Search Bar */}
              <div className="relative flex-1 w-full">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate text-xl">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Tìm kiếm theo mã Booking (VD: BK-20260902)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-chalk bg-white text-sm text-carbon focus:outline-none focus:ring-2 focus:ring-signal-orange transition-all"
                />
              </div>

              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-carbon text-white font-bold text-xs hover:bg-black transition-colors"
              >
                Tìm kiếm
              </button>
            </form>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-chalk pt-4 text-xs font-semibold">
              
              {/* Status Filter */}
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                <span className="text-slate font-bold uppercase text-[10px]">Trạng thái:</span>
                {['All', 'Pending', 'Approved', 'CheckedIn', 'Completed', 'Canceled'].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(status)
                      setPageNumber(1)
                    }}
                    className={`px-3.5 py-1.5 rounded-full transition-all ${
                      statusFilter === status
                        ? 'bg-carbon text-white shadow-sm font-bold'
                        : 'bg-fog border border-chalk text-graphite hover:border-carbon'
                    }`}
                  >
                    {status === 'All' ? 'Tất cả' : status}
                  </button>
                ))}
              </div>

              {/* Booking Type Filter */}
              <div className="flex items-center gap-2">
                <span className="text-slate font-bold uppercase text-[10px]">Loại:</span>
                {['All', 'Pickup', 'Dropoff'].map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setTypeFilter(type)
                      setPageNumber(1)
                    }}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      typeFilter === type
                        ? 'bg-signal-orange text-white font-bold'
                        : 'border border-chalk text-slate hover:border-carbon'
                    }`}
                  >
                    {type === 'All' ? 'Tất cả' : type === 'Pickup' ? ' Pickup (Lấy cont)' : ' Dropoff (Giao cont)'}
                  </button>
                ))}
              </div>

            </div>
          </div>

          {/* BOOKINGS DATA TABLE */}
          <div className="bg-paper border border-chalk rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate space-y-3">
                <span className="material-symbols-outlined text-4xl animate-spin text-signal-orange">sync</span>
                <p className="text-xs font-bold">Đang tải dữ liệu Đặt chỗ từ Database...</p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <span className="material-symbols-outlined text-5xl text-chalk">event_busy</span>
                <h4 className="font-bold text-carbon text-base">Không tìm thấy Đặt chỗ nào</h4>
                <p className="text-xs text-slate">Vui lòng thay đổi từ khóa tìm kiếm hoặc nhấn nút Tạo Đặt chỗ mới.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-fog border-b border-chalk text-slate font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-4 px-6">Mã Booking</th>
                      <th className="py-4 px-4">Loại Booking</th>
                      <th className="py-4 px-4">Khung Giờ Hẹn (Appointment)</th>
                      <th className="py-4 px-4">Container ID(s)</th>
                      <th className="py-4 px-4">Trạng thái</th>
                      <th className="py-4 px-6 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-chalk">
                    {bookings.map((bk) => (
                      <tr key={bk.id} className="hover:bg-fog/60 transition-colors">
                        
                        {/* Booking Code */}
                        <td className="py-4 px-6 font-bold font-mono text-sm text-carbon">
                          {bk.bookingCode}
                        </td>

                        {/* Booking Type */}
                        <td className="py-4 px-4 font-semibold">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            bk.bookingType === 'Pickup' ? 'bg-indigo-50 text-indigo-600' : 'bg-teal-50 text-teal-600'
                          }`}>
                            {bk.bookingType === 'Pickup' ? ' Pickup (Lấy)' : ' Dropoff (Giao)'}
                          </span>
                        </td>

                        {/* Appointment Time */}
                        <td className="py-4 px-4 text-graphite">
                          <div className="flex flex-col">
                            <span className="font-bold text-carbon">
                              {new Date(bk.appointmentStart).toLocaleDateString('vi-VN')}
                            </span>
                            <span className="text-[11px] text-slate font-mono">
                              {new Date(bk.appointmentStart).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(bk.appointmentEnd).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>

                        {/* Container IDs */}
                        <td className="py-4 px-4 font-mono text-slate">
                          {bk.containerIds && bk.containerIds.length > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-chalk text-carbon font-bold text-[11px]">
                              {bk.containerIds.join(', ')}
                            </span>
                          ) : (
                            <span className="text-slate italic">Chưa gán</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-4">
                          {renderStatusBadge(bk.status)}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedBooking(bk)
                                setShowDetailModal(true)
                              }}
                              className="px-3 py-1.5 rounded-lg border border-chalk text-carbon hover:bg-carbon hover:text-white font-bold text-[11px] transition-all flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">visibility</span>
                              Chi tiết
                            </button>

                            {bk.status === 'Pending' && (
                              <button
                                onClick={() => openEditModal(bk)}
                                className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-600 hover:text-white font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                                Sửa
                              </button>
                            )}

                            {(bk.status === 'Pending' || bk.status === 'Approved') && (
                              <button
                                onClick={() => {
                                  setSelectedBooking(bk)
                                  setShowCancelModal(true)
                                }}
                                className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white font-bold text-[11px] transition-all flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-sm">cancel</span>
                                Hủy
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CREATE BOOKING WIZARD */}
      {/* ========================================================================= */}
      {activeTab === 'create' && (
        <div className="bg-paper border border-chalk rounded-2xl p-6 md:p-8 shadow-sm space-y-8 animate-in fade-in duration-300">
          
          {/* STEPPER HEADER */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-chalk pb-6">
            <div>
              <h3 className="font-heading text-xl font-bold text-primary">Đăng ký Lịch hẹn Đặt chỗ Mới</h3>
              <p className="text-xs text-slate mt-1">Bước {wizardStep} trên 3: Khai báo thông tin phương tiện, container và khung giờ hẹn</p>
            </div>

            {/* Stepper Indicators */}
            <div className="flex items-center gap-2 text-xs font-bold">
              {[
                { step: 1, label: '1. Loại & Phương tiện' },
                { step: 2, label: '2. Container' },
                { step: 3, label: '3. Khung giờ & Xác nhận' },
              ].map((s) => (
                <div key={s.step} className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      wizardStep === s.step
                        ? 'bg-signal-orange text-white ring-4 ring-orange-100'
                        : wizardStep > s.step
                        ? 'bg-carbon text-white'
                        : 'bg-chalk text-slate'
                    }`}
                  >
                    {wizardStep > s.step ? '✓' : s.step}
                  </div>
                  <span className={wizardStep === s.step ? 'text-carbon font-bold' : 'text-slate'}>{s.label}</span>
                  {s.step < 3 && <div className="w-6 h-0.5 bg-chalk"></div>}
                </div>
              ))}
            </div>
          </div>

          {validationErrors.length > 0 && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 text-xs text-rose-900 space-y-2 animate-in fade-in">
              <div className="font-bold flex items-center gap-2 text-rose-700 text-sm">
                <span className="material-symbols-outlined">gpp_bad</span>
                Yêu cầu Đặt chỗ bị Từ chối do vi phạm quy tắc Nghiệp vụ (Validation Rejected):
              </div>
              <ul className="list-disc list-inside space-y-1 font-medium pl-1">
                {validationErrors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleCreateBooking}>
            
            {/* WIZARD STEP 1: TRANSACTION TYPE & VEHICLE/DRIVER */}
            {wizardStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate mb-2">Loại Giao dịch (Booking Type)</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, bookingType: 'Pickup' })}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        form.bookingType === 'Pickup'
                          ? 'border-signal-orange bg-orange-50/50 shadow-sm'
                          : 'border-chalk hover:border-carbon'
                      }`}
                    >
                      <div className="font-bold text-carbon text-sm">Pickup (Bốc container từ cảng)</div>
                      <div className="text-xs text-slate mt-1">Xe tải đến cảng nhận container hạ từ tàu/bãi mang đi.</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setForm({ ...form, bookingType: 'Dropoff' })}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        form.bookingType === 'Dropoff'
                          ? 'border-signal-orange bg-orange-50/50 shadow-sm'
                          : 'border-chalk hover:border-carbon'
                      }`}
                    >
                      <div className="font-bold text-carbon text-sm">Dropoff (Giao container vào cảng)</div>
                      <div className="text-xs text-slate mt-1">Xe tải chở container hàng/rỗng vào bãi cảng chờ xuất.</div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate mb-2">Chọn Tài xế (Driver)</label>
                    <select
                      value={form.driverId}
                      onChange={(e) => setForm({ ...form, driverId: e.target.value })}
                      className="w-full p-3 rounded-xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange"
                    >
                      <option value="d1010101-0000-0000-0000-000000000001">Nguyễn Văn Hùng (BLX: FC-99201)</option>
                      <option value="d1010101-0000-0000-0000-000000000002">Trần Quốc Tuấn (BLX: FC-88123)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate mb-2">Chọn Xe đầu kéo (Truck)</label>
                    <select
                      value={form.truckId}
                      onChange={(e) => setForm({ ...form, truckId: e.target.value })}
                      className="w-full p-3 rounded-xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange"
                    >
                      <option value="v1010101-0000-0000-0000-000000000001">Biển số: 51C-992.81 (Xe 40ft)</option>
                      <option value="v1010101-0000-0000-0000-000000000002">Biển số: 29H-771.02 (Xe 20ft)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-6 py-3 rounded-xl bg-carbon text-white font-bold text-xs hover:bg-black transition-colors"
                  >
                    Tiếp tục: Khai báo Container ➔
                  </button>
                </div>
              </div>
            )}

            {/* WIZARD STEP 2: CONTAINER & SEAL DETAILS */}
            {wizardStep === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate mb-2">Mã số Container (Container Number)</label>
                    <input
                      type="text"
                      required
                      value={form.containerNo}
                      onChange={(e) => setForm({ ...form, containerNo: e.target.value })}
                      className="w-full p-3 rounded-xl border border-chalk bg-white font-mono text-sm font-bold text-carbon focus:ring-2 focus:ring-signal-orange"
                      placeholder="VD: MSKU1234567"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate mb-2">Số Niêm Chì (Seal Number)</label>
                    <input
                      type="text"
                      value={form.sealNumber}
                      onChange={(e) => setForm({ ...form, sealNumber: e.target.value })}
                      className="w-full p-3 rounded-xl border border-chalk bg-white font-mono text-sm font-bold text-carbon focus:ring-2 focus:ring-signal-orange"
                      placeholder="VD: SEAL-88192"
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="px-6 py-3 rounded-xl border border-chalk text-carbon font-bold text-xs hover:bg-fog transition-colors"
                  >
                    ← Quay lại Step 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="px-6 py-3 rounded-xl bg-carbon text-white font-bold text-xs hover:bg-black transition-colors"
                  >
                    Tiếp tục: Khung giờ hẹn ➔
                  </button>
                </div>
              </div>
            )}

            {/* WIZARD STEP 3: TIME SLOT & SUBMIT */}
            {wizardStep === 3 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate mb-2">Ngày Hẹn Dự Kiến</label>
                    <input
                      type="date"
                      required
                      value={form.appointmentDate}
                      onChange={(e) => setForm({ ...form, appointmentDate: e.target.value })}
                      className="w-full p-3 rounded-xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate mb-2">Giờ Bắt Đầu (Start Time)</label>
                    <input
                      type="time"
                      required
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="w-full p-3 rounded-xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate mb-2">Giờ Kết Thúc (End Time)</label>
                    <input
                      type="time"
                      required
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="w-full p-3 rounded-xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange"
                    />
                  </div>
                </div>

                {/* SUMMARY REVIEW CARD */}
                <div className="bg-fog border border-chalk rounded-xl p-5 space-y-2 text-xs">
                  <div className="font-bold text-carbon text-sm border-b border-chalk pb-2">Tóm tắt Thông tin Booking:</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                    <div>
                      <span className="text-slate">Mã Booking:</span>
                      <p className="font-mono font-bold text-carbon">{form.bookingCode}</p>
                    </div>
                    <div>
                      <span className="text-slate">Loại Đặt chỗ:</span>
                      <p className="font-bold text-signal-orange">{form.bookingType}</p>
                    </div>
                    <div>
                      <span className="text-slate">Container:</span>
                      <p className="font-mono font-bold text-carbon">{form.containerNo}</p>
                    </div>
                    <div>
                      <span className="text-slate">Khung giờ:</span>
                      <p className="font-bold text-carbon">{form.startTime} - {form.endTime} ({form.appointmentDate})</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-6 py-3 rounded-xl border border-chalk text-carbon font-bold text-xs hover:bg-fog transition-colors"
                  >
                    ← Quay lại Step 2
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-8 py-3 rounded-xl bg-signal-orange text-white font-bold text-xs hover:bg-orange-600 shadow-md transition-all flex items-center gap-2"
                  >
                    {actionLoading && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                    Xác nhận & Khởi tạo Booking ➔
                  </button>
                </div>
              </div>
            )}

          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CONTAINER STATUS TIMELINE */}
      {/* ========================================================================= */}
      {activeTab === 'container_status' && (
        <div className="bg-paper border border-chalk rounded-2xl p-6 md:p-8 shadow-sm space-y-6 animate-in fade-in duration-300">
          <h3 className="font-heading text-lg font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-signal-orange">route</span>
            Lộ trình Container Thời gian thực: <span className="text-signal-orange font-mono">MSKU8891024</span>
          </h3>

          <div className="relative flex justify-between items-center px-6 py-8">
            <div className="absolute top-1/2 left-10 right-10 h-1 bg-chalk -translate-y-1/2 z-0"></div>
            <div className="absolute top-1/2 left-10 w-[60%] h-1 bg-signal-orange -translate-y-1/2 z-0 transition-all duration-1000"></div>

            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-signal-orange border-4 border-paper shadow-sm"></div>
              <span className="text-[10px] font-bold text-primary uppercase text-center w-24">ĐÃ ĐẶT LỊCH</span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-signal-orange border-4 border-paper shadow-sm"></div>
              <span className="text-[10px] font-bold text-primary uppercase text-center w-24">GATE-IN</span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-paper border-4 border-signal-orange shadow-sm animate-pulse"></div>
              <span className="text-[10px] font-bold text-signal-orange uppercase text-center w-24">LƯU BÃI (YARD)</span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-chalk border-4 border-paper shadow-sm"></div>
              <span className="text-[10px] font-bold text-slate uppercase text-center w-24">GATE-OUT</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: BOOKING DETAIL VIEW */}
      {/* ========================================================================= */}
      {showDetailModal && selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-paper border border-chalk rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate">Chi tiết Đặt chỗ</span>
                <h3 className="font-mono font-bold text-xl text-carbon">{selectedBooking.bookingCode}</h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate hover:text-carbon font-bold text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center bg-fog p-3 rounded-xl border border-chalk">
                <span className="text-slate font-bold">Trạng thái:</span>
                {renderStatusBadge(selectedBooking.status)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate">Loại Booking:</span>
                  <p className="font-bold text-carbon">{selectedBooking.bookingType}</p>
                </div>
                <div>
                  <span className="text-slate">Ngày khởi tạo:</span>
                  <p className="font-bold text-carbon">{new Date(selectedBooking.createdAt).toLocaleDateString('vi-VN')}</p>
                </div>
              </div>

              <div>
                <span className="text-slate">Khung giờ Hẹn:</span>
                <p className="font-bold text-carbon">
                  {new Date(selectedBooking.appointmentStart).toLocaleString('vi-VN')} ➔ {new Date(selectedBooking.appointmentEnd).toLocaleString('vi-VN')}
                </p>
              </div>

              <div>
                <span className="text-slate">Danh sách Container:</span>
                <p className="font-mono font-bold text-signal-orange">
                  {selectedBooking.containerIds?.join(', ') || 'Chưa cập nhật'}
                </p>
              </div>

              {/* REAL SCANNABLE QR CODE SECTION */}
              <div className="border-t border-chalk pt-4 text-center space-y-3">
                <p className="text-[11px] font-semibold text-slate flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-sm text-signal-orange">qr_code_scanner</span>
                  Mã QR đối soát Gate Pass chính thức tại Cổng cảng:
                </p>
                
                <div className="relative w-44 h-44 mx-auto bg-white p-3 border-2 border-chalk rounded-2xl shadow-md flex items-center justify-center group">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selectedBooking.bookingCode)}`}
                    alt={`QR Code ${selectedBooking.bookingCode}`}
                    className="w-full h-full object-contain rounded-lg transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                
                <p className="text-[10px] text-graphite font-mono font-bold bg-fog py-1 px-3 rounded-full w-fit mx-auto border border-chalk">
                  Mã Gate-In: {selectedBooking.bookingCode}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2 rounded-xl bg-carbon text-white text-xs font-bold hover:bg-black"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CANCEL BOOKING CONFIRMATION */}
      {/* ========================================================================= */}
      {showCancelModal && selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-paper border border-chalk rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-rose-600 flex items-center gap-2">
              <span className="material-symbols-outlined">warning</span>
              Xác nhận Hủy Đặt chỗ
            </h3>

            <p className="text-xs text-slate">
              Bạn có chắc chắn muốn hủy Đặt chỗ <strong className="text-carbon font-mono">{selectedBooking.bookingCode}</strong> không?
            </p>

            <div>
              <label className="block text-xs font-bold uppercase text-slate mb-1">Lý do Hủy (Không bắt buộc)</label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Nhập lý do hủy đặt chỗ..."
                className="w-full p-3 rounded-xl border border-chalk bg-white text-xs text-carbon focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-xl border border-chalk text-carbon text-xs font-bold hover:bg-fog"
              >
                Bỏ qua
              </button>

              <button
                onClick={handleConfirmCancel}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 flex items-center gap-1"
              >
                {actionLoading && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                Xác nhận Hủy ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT BOOKING MODAL */}
      {/* ========================================================================= */}
      {showEditModal && selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-paper border border-chalk rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-600">Cập nhật Booking</span>
                <h3 className="font-mono font-bold text-xl text-carbon">{editForm.bookingCode}</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate font-bold text-xl">✕</button>
            </div>

            <form onSubmit={handleUpdateBooking} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase text-slate mb-1">Mã Container</label>
                <input
                  type="text"
                  required
                  value={editForm.containerNo}
                  onChange={(e) => setEditForm({ ...editForm, containerNo: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-chalk bg-white font-mono font-bold text-carbon"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-slate mb-1">Ngày Hẹn Dự Kiến</label>
                <input
                  type="date"
                  required
                  value={editForm.appointmentDate}
                  onChange={(e) => setEditForm({ ...editForm, appointmentDate: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-chalk bg-white font-bold text-carbon"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate mb-1">Giờ Bắt Đầu</label>
                  <input
                    type="time"
                    required
                    value={editForm.startTime}
                    onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-chalk bg-white font-bold text-carbon"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate mb-1">Giờ Kết Thúc</label>
                  <input
                    type="time"
                    required
                    value={editForm.endTime}
                    onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-chalk bg-white font-bold text-carbon"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-chalk">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl border border-chalk text-carbon font-bold"
                >
                  Bỏ qua
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 flex items-center gap-1 cursor-pointer"
                >
                  {actionLoading && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                  Lưu Cập nhật ➔
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
