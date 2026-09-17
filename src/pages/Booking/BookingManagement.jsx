import React, { useState, useEffect, useMemo } from 'react'
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

  // Available Fleet & Yard Resources (Loaded 100% from Database)
  const [availableResources, setAvailableResources] = useState({ containers: [], trucks: [], drivers: [] })
  const [resourcesLoading, setResourcesLoading] = useState(false)

  // Danh sách ID container đã có trong booking đang hoạt động (loại trừ đã hủy hoặc đã hoàn tất)
  const activeBookedContainerIds = useMemo(() => {
    return (bookings || [])
      .filter(b => {
        const s = (b.status || '').toLowerCase()
        return s !== 'canceled' && s !== 'cancelled' && s !== 'rejected' && s !== 'expired'
      })
      .flatMap(b => b.containerIds || [])
  }, [bookings])

  // Notification Toast State
  const [toast, setToast] = useState(null)

  // Modals States
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // NXP-049: Fleet Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignForm, setAssignForm] = useState({
    bookingId: '',
    bookingCode: '',
    driverId: '',
    truckId: '',
    containerId: '',
    containerNo: ''
  })

  // Smart e-Pass QR Modal
  const [showQrModal, setShowQrModal] = useState(false)

  // Backend AI Recommendation & Payload Analysis States
  const [aiMatching, setAiMatching] = useState(false)
  const [backendPayload, setBackendPayload] = useState({
    ratio: 74.0,
    status: 'Optimal',
    severity: 'optimal',
    warningMessage: 'TỐI ƯU: Tải trọng đạt chuẩn, xe vận hành an toàn và tiết kiệm nhiên liệu.',
    isSafe: true
  })
  const [aiRecommendation, setAiRecommendation] = useState(null)

  // NXP-049: State phân tích tải trọng cho Modal Điều phối
  const [assignPayloadAnalysis, setAssignPayloadAnalysis] = useState(null)
  const [assignAiLoading, setAssignAiLoading] = useState(false)

  // Create Form Wizard State (Step 1: Container & Fleet AI Match -> Step 2: Optimal Time Slot & Confirm)
  const [wizardStep, setWizardStep] = useState(1)
  const [form, setForm] = useState({
    bookingType: 'Pickup', // Pickup or Dropoff
    carrierId: 'c1010101-0000-0000-0000-000000000001',
    selectedContainerId: '',
    containerNo: '',
    sealNumber: '',
    containerGrossWeightTon: 0,
    containerSize: 'ft40',
    cargoType: 'general',
    driverId: '',
    truckId: '',
    bookingCode: `BK-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`,
    appointmentDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), // Ngày mai
    startTime: '08:30',
    endTime: '10:30'
  })

  // Load Bookings Data from API on filters, page change, or entering tab
  useEffect(() => {
    fetchBookings()
  }, [pageNumber, statusFilter, typeFilter, activeTab])

  // Load Fleet & Container resources from Database on mount and when entering create tab
  useEffect(() => {
    loadAvailableResources()
  }, [activeTab])

  const loadAvailableResources = async () => {
    setResourcesLoading(true)
    try {
      const res = await bookingService.getAvailableResources()
      if (res) {
        setAvailableResources(res)
        // Nếu user đã chủ động chọn container trước đó thì re-trigger lại AI recommendation
        if (form.selectedContainerId) {
          triggerBackendAiRecommendation(form.selectedContainerId, res)
        }
      }
    } catch (err) {
      console.error('Lỗi tải tài nguyên từ Database:', err)
    } finally {
      setResourcesLoading(false)
    }
  }

  // 🤖 GỌI BACKEND XỬ LÝ AI TỰ ĐỘNG PHỐI XE & TÀI XẾ TỐI ƯU TỪ CSDL
  const triggerBackendAiRecommendation = async (containerId, currentResources = null) => {
    if (!containerId) return
    setAiMatching(true)
    const resources = currentResources || availableResources
    try {
      const rec = await bookingService.getFleetRecommendation({ containerId, bookingType: form.bookingType })
      if (rec) {
        setAiRecommendation(rec)
        setBackendPayload({
          ratio: Number(rec.payloadRatio) || 0,
          status: rec.payloadStatus || 'Optimal',
          severity: rec.payloadSeverity || 'optimal',
          warningMessage: rec.payloadMessage || '',
          isSafe: rec.payloadStatus !== 'Overloaded'
        })
        setForm(prev => {
          const matchedTruckId = rec.recommendedTruckId || prev.truckId || resources.trucks?.[0]?.id || ''
          const matchedDriverId = rec.recommendedDriverId || prev.driverId || resources.drivers?.[0]?.id || ''
          return {
            ...prev,
            selectedContainerId: rec.containerId || containerId,
            containerNo: rec.containerNumber || prev.containerNo,
            containerGrossWeightTon: Number(rec.containerGrossWeightTon) || prev.containerGrossWeightTon,
            containerSize: rec.containerSize || prev.containerSize,
            cargoType: rec.cargoType || prev.cargoType,
            truckId: matchedTruckId,
            driverId: matchedDriverId,
            appointmentDate: rec.recommendedDate || prev.appointmentDate,
            startTime: rec.recommendedStartTime || '08:30',
            endTime: rec.recommendedEndTime || '10:30'
          }
        })
      } else {
        // Fallback nếu rec không có dữ liệu
        setForm(prev => ({
          ...prev,
          selectedContainerId: containerId,
          truckId: prev.truckId || resources.trucks?.[0]?.id || '',
          driverId: prev.driverId || resources.drivers?.[0]?.id || ''
        }))
      }
    } catch (err) {
      console.error('Lỗi khi gọi backend AI Smart Match:', err)
    } finally {
      setAiMatching(false)
    }
  }

  const handleContainerChange = (containerId) => {
    if (!containerId) {
      // Khi người dùng bấm về lựa chọn trống
      setForm(prev => ({
        ...prev,
        selectedContainerId: '',
        containerNo: '',
        sealNumber: '',
        containerGrossWeightTon: 0,
        truckId: '',
        driverId: ''
      }))
      setAiRecommendation(null)
      return
    }

    const selectedCont = (availableResources.containers || []).find(c => c.id === containerId)
    if (selectedCont) {
      setForm(prev => ({
        ...prev,
        selectedContainerId: selectedCont.id,
        containerNo: selectedCont.containerNumber,
        sealNumber: selectedCont.sealNumber || 'SEAL-LIVE',
        containerGrossWeightTon: Number(selectedCont.grossWeightTon) || (Number(selectedCont.grossWeightKg) / 1000) || 20,
        containerSize: selectedCont.size || 'ft40',
        cargoType: selectedCont.cargoType || 'general'
      }))
    }

    triggerBackendAiRecommendation(containerId)
  }

  // Khi người dùng chỉnh chọn xe đầu kéo khác -> gọi backend đánh giá lại tải trọng
  const handleTruckChange = async (truckId) => {
    setForm(prev => ({ ...prev, truckId }))
    try {
      const evalRes = await bookingService.evaluatePayload({
        containerId: form.selectedContainerId,
        truckId
      })
      if (evalRes) {
        setBackendPayload({
          ratio: Number(evalRes.payloadRatio) || 0,
          status: evalRes.status || 'Optimal',
          severity: evalRes.severity || 'optimal',
          warningMessage: evalRes.warningMessage || '',
          isSafe: evalRes.isSafe
        })
      }
    } catch (err) {
      console.warn('Lỗi gọi backend evaluate payload:', err)
    }
  }


  const fetchBookings = async () => {
    setLoading(true)
    try {
      const params = {
        pageNumber,
        pageSize,
        carrierId: form.carrierId || undefined,
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
    setTimeout(() => setToast(null), 4500)
  }

  const [validationErrors, setValidationErrors] = useState([])

  // Tính toán Tỷ lệ tải trọng và Đánh giá an toàn (Interactive Payload Checker)
  const selectedTruck = (availableResources.trucks || []).find(t => t.id === form.truckId)
  const currentTruckPayload = selectedTruck ? Number(selectedTruck.maxPayloadTon || 24) : 24
  const currentContWeight = Number(form.containerGrossWeightTon || 20)
  const payloadRatio = currentTruckPayload > 0 ? (currentContWeight / currentTruckPayload) * 100 : 0

  // Handle Form Submit (Create Booking - NXP-048)
  const handleCreateBooking = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    setValidationErrors([])
    try {
      const startIso = new Date(`${form.appointmentDate}T${form.startTime}:00Z`).toISOString()
      const endIso = new Date(`${form.appointmentDate}T${form.endTime}:00Z`).toISOString()

      const selectedDriverObj = (availableResources.drivers || []).find(d => d.id === form.driverId)
      const selectedTruckObj = (availableResources.trucks || []).find(t => t.id === form.truckId)

      const payload = {
        carrierId: form.carrierId,
        driverId: form.driverId || undefined,
        driverName: selectedDriverObj?.fullName,
        truckId: form.truckId || undefined,
        vehicleId: form.truckId || undefined,
        vehiclePlate: selectedTruckObj?.plateNumber,
        bookingCode: form.bookingCode,
        bookingType: form.bookingType,
        appointmentStart: startIso,
        appointmentEnd: endIso,
        containerIds: form.selectedContainerId ? [form.selectedContainerId] : []
      }

      const created = await bookingService.createBooking(payload)
      const isReady = created?.status === 'Ready' || (payload.driverId && payload.truckId && payload.containerIds.length > 0)
      
      showNotification(
        isReady 
          ? `🎉 Tạo Đặt chỗ ${form.bookingCode} thành công! Đã tự động kích hoạt trạng thái [READY] sẵn sàng vào cổng.`
          : `Tạo Đặt chỗ ${form.bookingCode} thành công! Trạng thái: [Pending] chờ gán xe.`,
        'success'
      )
      
      // Eagerly loại trừ ngay container đã book khỏi state availableResources
      if (form.selectedContainerId) {
        setAvailableResources(prev => ({
          ...prev,
          containers: (prev.containers || []).filter(c => c.id !== form.selectedContainerId)
        }))
      }

      // Eagerly đưa booking vừa tạo vào danh sách hiển thị
      if (created) {
        const optimisticBooking = {
          id: created.id || `bk-local-${Date.now()}`,
          carrierId: form.carrierId,
          bookingCode: created.bookingCode || form.bookingCode,
          bookingType: created.bookingType || form.bookingType,
          status: created.status || (isReady ? 'Ready' : 'Pending'),
          appointmentStart: startIso,
          appointmentEnd: endIso,
          containerIds: payload.containerIds,
          driverName: selectedDriverObj?.fullName || form.driverName,
          vehiclePlate: selectedTruckObj?.plateNumber || form.vehiclePlate,
          createdAt: new Date().toISOString()
        }
        setBookings(prev => [optimisticBooking, ...prev.filter(b => b.id !== optimisticBooking.id && b.bookingCode !== optimisticBooking.bookingCode)])
        setTotalCount(prev => Math.max(prev + 1, 1))
      }

      // Reset form to empty and return to My Bookings tab
      setForm({
        bookingType: 'Pickup',
        carrierId: form.carrierId,
        selectedContainerId: '',
        containerNo: '',
        sealNumber: '',
        containerGrossWeightTon: 0,
        containerSize: 'ft40',
        cargoType: 'general',
        driverId: '',
        truckId: '',
        bookingCode: `BK-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`,
        appointmentDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        startTime: '08:30',
        endTime: '10:30'
      })
      setAiRecommendation(null)
      setWizardStep(1)
      setActiveTab('my_bookings')
      fetchBookings()
      loadAvailableResources() // Nạp lại danh sách tài nguyên, container đã book sẽ biến mất khỏi dropdown
    } catch (err) {
      const errResponse = err?.response?.data
      if (errResponse && errResponse.Errors) {
        let errorList = []
        if (typeof errResponse.Errors === 'string') {
          errorList = [errResponse.Errors]
        } else if (typeof errResponse.Errors === 'object') {
          errorList = Object.entries(errResponse.Errors).flatMap(([_, msgs]) => Array.isArray(msgs) ? msgs : [msgs])
        }
        setValidationErrors(errorList)
        showNotification(errResponse?.Message || errResponse?.message || 'Yêu cầu bị từ chối do vi phạm điều kiện nghiệp vụ!', 'error')
      } else {
        const errorMsg = errResponse?.Message || errResponse?.message || err?.message || 'Lỗi kiểm tra tạo đặt chỗ. Vui lòng kiểm tra lại!'
        setValidationErrors([errorMsg])
        showNotification(errorMsg, 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // NXP-049: Mở Modal Điều phối Fleet cho Booking đang Pending
  const openAssignFleetModal = async (bk) => {
    const existingCont = availableResources.containers.find(c => bk.containerIds?.includes(c.id)) || availableResources.containers[0]
    const initialTruckId = bk.truckId || availableResources.trucks[0]?.id || ''
    const initialContainerId = existingCont?.id || availableResources.containers[0]?.id || ''

    setAssignForm({
      bookingId: bk.id,
      bookingCode: bk.bookingCode,
      driverId: bk.driverId || availableResources.drivers[0]?.id || '',
      truckId: initialTruckId,
      containerId: initialContainerId,
      containerNo: existingCont?.containerNumber || 'MSKU8829104'
    })
    setShowAssignModal(true)

    // Đánh giá tải trọng từ backend CSDL khi mở modal
    if (initialContainerId && initialTruckId) {
      try {
        const evalRes = await bookingService.evaluatePayload({
          containerId: initialContainerId,
          truckId: initialTruckId
        })
        if (evalRes) {
          setAssignPayloadAnalysis({
            ratio: Number(evalRes.payloadRatio) || 0,
            status: evalRes.status || 'Optimal',
            severity: evalRes.severity || 'optimal',
            warningMessage: evalRes.warningMessage || ''
          })
        }
      } catch { /* ignore */ }
    }
  }

  // Gọi AI Auto-Match cho Modal Điều phối từ backend CSDL
  const triggerAssignAiMatch = async () => {
    setAssignAiLoading(true)
    try {
      const rec = await bookingService.getFleetRecommendation({ containerId: assignForm.containerId })
      if (rec) {
        setAssignForm(prev => ({
          ...prev,
          truckId: rec.recommendedTruckId || prev.truckId,
          driverId: rec.recommendedDriverId || prev.driverId
        }))
        setAssignPayloadAnalysis({
          ratio: Number(rec.payloadRatio) || 0,
          status: rec.payloadStatus || 'Optimal',
          severity: rec.payloadSeverity || 'optimal',
          warningMessage: rec.payloadMessage || ''
        })
      }
    } catch (err) {
      console.warn('Lỗi AI assign:', err)
    } finally {
      setAssignAiLoading(false)
    }
  }

  const handleAssignContainerChange = async (containerId) => {
    const cont = availableResources.containers.find(c => c.id === containerId)
    setAssignForm(prev => ({
      ...prev,
      containerId,
      containerNo: cont?.containerNumber || prev.containerNo
    }))
    try {
      const evalRes = await bookingService.evaluatePayload({
        containerId,
        truckId: assignForm.truckId
      })
      if (evalRes) {
        setAssignPayloadAnalysis({
          ratio: Number(evalRes.payloadRatio) || 0,
          status: evalRes.status || 'Optimal',
          severity: evalRes.severity || 'optimal',
          warningMessage: evalRes.warningMessage || ''
        })
      }
    } catch { /* ignore */ }
  }

  const handleAssignTruckChange = async (truckId) => {
    setAssignForm(prev => ({ ...prev, truckId }))
    try {
      const evalRes = await bookingService.evaluatePayload({
        containerId: assignForm.containerId,
        truckId
      })
      if (evalRes) {
        setAssignPayloadAnalysis({
          ratio: Number(evalRes.payloadRatio) || 0,
          status: evalRes.status || 'Optimal',
          severity: evalRes.severity || 'optimal',
          warningMessage: evalRes.warningMessage || ''
        })
      }
    } catch { /* ignore */ }
  }

  // NXP-049: Xác nhận Điều phối Fleet & Chuyển sang Ready
  const handleConfirmAssignFleet = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const selectedDriverObj = availableResources.drivers.find(d => d.id === assignForm.driverId)
      const selectedTruckObj = availableResources.trucks.find(t => t.id === assignForm.truckId)
      const selectedContObj = availableResources.containers.find(c => c.id === assignForm.containerId)

      const payload = {
        driverId: assignForm.driverId,
        driverName: selectedDriverObj?.fullName || 'Nguyễn Văn Hùng',
        truckId: assignForm.truckId,
        vehiclePlate: selectedTruckObj?.plateNumber || '51C-992.81',
        containerIds: assignForm.containerId ? [assignForm.containerId] : [],
        containerNo: selectedContObj?.containerNumber || assignForm.containerNo
      }

      await bookingService.assignBookingResources(assignForm.bookingId, payload)
      showNotification(`✨ Đã điều phối Xe & Tài xế cho Booking ${assignForm.bookingCode}! Trạng thái chuyển sang [READY] thành công.`, 'success')
      setShowAssignModal(false)
      fetchBookings()
      loadAvailableResources()
    } catch (err) {
      showNotification('Không thể điều phối booking này. Vui lòng kiểm tra lại!', 'error')
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
      loadAvailableResources()
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
      loadAvailableResources()
    } catch (err) {
      showNotification('Không thể hủy đặt chỗ này.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Helper function: Render Status Badge with Curated HSL Palette
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Ready':
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-700 text-xs font-bold flex items-center gap-1.5 w-fit shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Sẵn sàng (Ready)
          </span>
        )
      case 'Pending':
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs font-bold flex items-center gap-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            Chờ điều phối
          </span>
        )
      case 'Approved':
        return (
          <span className="px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-700 text-xs font-bold flex items-center gap-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
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
          toast.type === 'error' ? 'bg-rose-900 border-rose-700 text-rose-100' : 'bg-emerald-950 border-emerald-600 text-emerald-100'
        }`}>
          <span className="material-symbols-outlined">{toast.type === 'error' ? 'error' : 'check_circle'}</span>
          {toast.message}
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-chalk pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-signal-orange uppercase tracking-wider mb-1">
            <span className="material-symbols-outlined text-sm">calendar_month</span>
            Hệ thống Đặt Lịch & Điều Phối Bãi · Terminal Appointment System (TAS)
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-carbon">
            Quản lý Lịch hẹn & Điều phối Phương tiện
          </h1>
          <p className="text-xs text-slate mt-1">
            NXP-048 (Tạo Booking AI Auto-Match) & NXP-049 (Điều phối Fleet chuyển trạng thái Ready vào cổng)
          </p>
        </div>

        <button
          onClick={() => {
            setActiveTab('create')
            setWizardStep(1)
          }}
          className="px-5 py-3 rounded-xl bg-signal-orange text-white font-bold text-xs hover:bg-orange-600 transition-all flex items-center gap-2 shadow-sm w-fit"
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          Tạo Đặt chỗ Mới (AI Auto-Match)
        </button>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex gap-4 border-b border-chalk overflow-x-auto pb-1">
        {[
          { key: 'my_bookings', label: 'Đặt chỗ của tôi (Live Database)', icon: 'list_alt' },
          { key: 'create', label: 'Tạo mới (Container-First AI Wizard)', icon: 'auto_awesome' },
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
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                <span className="text-slate font-bold uppercase text-[10px]">Trạng thái:</span>
                {['All', 'Ready', 'Pending', 'Approved', 'CheckedIn', 'Completed', 'Canceled'].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(status)
                      setPageNumber(1)
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                      statusFilter === status
                        ? 'bg-carbon text-white border-carbon font-bold shadow-xs'
                        : 'bg-white border-chalk text-slate hover:border-carbon hover:text-carbon'
                    }`}
                  >
                    {status === 'All' ? 'Tất cả' : status === 'Ready' ? '✨ Sẵn sàng (Ready)' : status}
                  </button>
                ))}
              </div>

              <div className="text-slate text-[11px]">
                Tổng số: <strong className="text-carbon">{totalCount}</strong> hồ sơ đặt chỗ
              </div>
            </div>
          </div>

          {/* BOOKINGS DATA TABLE */}
          <div className="bg-paper border border-chalk rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate space-y-3">
                <span className="material-symbols-outlined text-4xl animate-spin text-signal-orange">sync</span>
                <p className="text-xs font-bold">Đang tải dữ liệu Đặt chỗ trực tiếp từ Database...</p>
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
                      <th className="py-4 px-4">Loại & Phương tiện</th>
                      <th className="py-4 px-4">Khung Giờ Hẹn</th>
                      <th className="py-4 px-4">Container ID</th>
                      <th className="py-4 px-4">Trạng thái</th>
                      <th className="py-4 px-6 text-right">Thao tác Nghiệp vụ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-chalk">
                    {bookings.map((bk) => (
                      <tr key={bk.id} className="hover:bg-fog/60 transition-colors">
                        
                        {/* Booking Code */}
                        <td className="py-4 px-6">
                          <div className="font-bold font-mono text-sm text-carbon flex items-center gap-1.5">
                            {bk.bookingCode}
                          </div>
                          <span className="text-[10px] text-slate font-mono">ID: {bk.id?.slice(0, 8)}...</span>
                        </td>

                        {/* Booking Type & Assigned Fleet */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              bk.bookingType === 'Pickup' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-teal-50 text-teal-700 border border-teal-200'
                            }`}>
                              {bk.bookingType === 'Pickup' ? 'Pickup' : 'Dropoff'}
                            </span>
                            {bk.vehiclePlate && (
                              <span className="font-mono font-bold text-carbon bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                                🚚 {bk.vehiclePlate}
                              </span>
                            )}
                          </div>
                          {bk.driverName && (
                            <p className="text-[11px] text-slate mt-1">Tài xế: <strong className="text-carbon">{bk.driverName}</strong></p>
                          )}
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
                        <td className="py-4 px-4 font-mono">
                          {bk.containerIds && bk.containerIds.length > 0 ? (
                            <span className="px-2.5 py-1 rounded-md bg-orange-50 text-signal-orange border border-orange-200 font-bold text-xs">
                              {bk.containerIds.join(', ')}
                            </span>
                          ) : (
                            <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[11px] italic">Chưa gán cont</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-4">
                          {renderStatusBadge(bk.status)}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end items-center gap-2">
                            
                            {/* NXP-049: Nút Gán Fleet cho Booking Pending */}
                            {bk.status === 'Pending' && (
                              <button
                                onClick={() => openAssignFleetModal(bk)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                                title="Gán Xe & Tài xế để chuyển sang trạng thái Ready"
                              >
                                <span className="material-symbols-outlined text-sm">local_shipping</span>
                                Điều phối Fleet
                              </button>
                            )}

                            {/* Nút Xem Vé QR điện tử khi đã Ready */}
                            {(bk.status === 'Ready' || bk.status === 'Approved' || bk.status === 'CheckedIn') && (
                              <button
                                onClick={() => {
                                  setSelectedBooking(bk)
                                  setShowQrModal(true)
                                }}
                                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white font-bold text-[11px] transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-sm text-signal-orange">qr_code_2</span>
                                Vé e-Pass
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setSelectedBooking(bk)
                                setShowDetailModal(true)
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-chalk text-carbon hover:bg-carbon hover:text-white font-bold text-[11px] transition-all flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">visibility</span>
                            </button>

                            {bk.status === 'Pending' && (
                              <button
                                onClick={() => openEditModal(bk)}
                                className="px-2.5 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-600 hover:text-white font-bold text-[11px] transition-all flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                              </button>
                            )}

                            {(bk.status === 'Pending' || bk.status === 'Ready' || bk.status === 'Approved') && (
                              <button
                                onClick={() => {
                                  setSelectedBooking(bk)
                                  setShowCancelModal(true)
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white font-bold text-[11px] transition-all flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-sm">cancel</span>
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
      {/* TAB 2: CREATE BOOKING WIZARD (CONTAINER-FIRST AI AUTO-MATCH WORKFLOW) */}
      {/* ========================================================================= */}
      {activeTab === 'create' && (
        <div className="bg-paper border border-chalk rounded-2xl p-6 md:p-8 shadow-sm space-y-8 animate-in fade-in duration-300">
          
          {/* STEPPER HEADER */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-chalk pb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-signal-orange uppercase tracking-wider mb-1">
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                AI Smart Container-First Booking Pipeline (NXP-048)
              </div>
              <h3 className="font-heading text-xl font-bold text-carbon">Đăng ký Lịch hẹn Đặt chỗ Mới</h3>
              <p className="text-xs text-slate mt-1">
                Bước {wizardStep} trên 2: {wizardStep === 1 ? 'Chọn Container & AI Tự động phối Xe/Tài xế tối ưu' : 'Xác nhận Khung giờ thấp điểm & Khởi tạo Vé e-Pass'}
              </p>
            </div>

            {/* Stepper Indicators */}
            <div className="flex items-center gap-3 text-xs font-bold">
              {[
                { step: 1, label: '1. Container & Điều phối AI' },
                { step: 2, label: '2. Khung giờ & Cấp vé Ready' },
              ].map((s) => (
                <div key={s.step} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      wizardStep === s.step
                        ? 'bg-signal-orange text-white ring-4 ring-orange-100 shadow-sm'
                        : wizardStep > s.step
                        ? 'bg-carbon text-white'
                        : 'bg-chalk text-slate'
                    }`}
                  >
                    {wizardStep > s.step ? '✓' : s.step}
                  </div>
                  <span className={wizardStep === s.step ? 'text-carbon font-bold' : 'text-slate'}>{s.label}</span>
                  {s.step < 2 && <div className="w-8 h-0.5 bg-chalk"></div>}
                </div>
              ))}
            </div>
          </div>

          {validationErrors.length > 0 && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 text-xs text-rose-900 space-y-2 animate-in fade-in">
              <div className="font-bold flex items-center gap-2 text-rose-700 text-sm">
                <span className="material-symbols-outlined">gpp_bad</span>
                Yêu cầu Đặt chỗ bị Từ chối do vi phạm quy tắc Nghiệp vụ:
              </div>
              <ul className="list-disc list-inside space-y-1 font-medium pl-1">
                {validationErrors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleCreateBooking}>
            
            {/* WIZARD STEP 1: CONTAINER-FIRST AI AUTO-MATCH & PAYLOAD GUARD */}
            {wizardStep === 1 && (
              <div className="space-y-6">
                
                {/* 1. TRANSACTION TYPE */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate mb-2">Loại Giao dịch Nghiệp vụ Cảng (Booking Type)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, bookingType: 'Pickup' })}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        form.bookingType === 'Pickup'
                          ? 'border-signal-orange bg-orange-50/50 shadow-sm'
                          : 'border-chalk hover:border-carbon'
                      }`}
                    >
                      <div className="font-bold text-carbon text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-indigo-600">vertical_align_top</span>
                        Pickup (Bốc container từ cảng về)
                      </div>
                      <div className="text-xs text-slate mt-1">Xe tải đến cảng nhận container hạ từ tàu/bãi mang đi giao cho khách hàng.</div>
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
                      <div className="font-bold text-carbon text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-teal-600">vertical_align_bottom</span>
                        Dropoff (Hạ container hàng vào bãi cảng)
                      </div>
                      <div className="text-xs text-slate mt-1">Xe tải chở container hàng xuất hoặc vỏ rỗng vào bãi cảng chờ xếp lên tàu.</div>
                    </button>
                  </div>
                </div>

                {/* 2. CORE CARGO: SELECT CONTAINER FIRST */}
                <div className="bg-fog/60 border border-chalk rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase text-carbon flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-signal-orange"></span>
                      1. Chọn Container Sẵn Sàng (Khai báo Hàng Hóa) *
                    </label>
                    <span className="text-[11px] text-slate">Dữ liệu nạp trực tiếp từ Database kho bãi</span>
                  </div>

                  <select
                    value={form.selectedContainerId || ''}
                    onChange={(e) => handleContainerChange(e.target.value)}
                    className="w-full p-3.5 rounded-xl border border-chalk bg-white text-sm font-mono font-bold text-carbon focus:ring-2 focus:ring-signal-orange shadow-xs"
                  >
                    <option value="">-- Bấm chọn container trong kho bãi để AI tự động phối xe --</option>
                    {(availableResources.containers || [])
                      .filter(c => c.status !== 'reserved' && c.status !== 'loaded' && c.status !== 'gate_out' && !activeBookedContainerIds.includes(c.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.containerNumber} · {c.size} · {c.grossWeightTon || (c.grossWeightKg / 1000)} Tấn · {c.cargoType} · [{c.status}]
                        </option>
                    ))}
                  </select>

                  {/* Container Info Card */}
                  {form.containerNo && (
                    <div className="bg-white border border-chalk rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate text-[11px]">Mã Container:</span>
                        <p className="font-mono font-extrabold text-carbon text-sm">{form.containerNo}</p>
                      </div>
                      <div>
                        <span className="text-slate text-[11px]">Kích thước / Loại:</span>
                        <p className="font-bold text-carbon">{form.containerSize} · {form.cargoType}</p>
                      </div>
                      <div>
                        <span className="text-slate text-[11px]">Khối lượng toàn bộ:</span>
                        <p className="font-mono font-extrabold text-signal-orange text-sm">{form.containerGrossWeightTon} Tấn</p>
                      </div>
                      <div>
                        <span className="text-slate text-[11px]">Số Niêm Chì (Seal):</span>
                        <p className="font-mono font-bold text-slate-700">{form.sealNumber}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. AI AUTO-RECOMMENDED VEHICLE & DRIVER WITH PAYLOAD GUARD */}
                <div className="border border-chalk rounded-2xl p-5 bg-white space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-chalk pb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-extrabold text-[11px] flex items-center gap-1 border border-indigo-200">
                        <span className="material-symbols-outlined text-xs">neurology</span>
                        AI Backend Optimization
                      </span>
                      <span className="text-xs font-bold text-carbon">Điều phối Phương tiện & Tài xế (Dữ liệu CSDL)</span>
                    </div>

                    <button
                      type="button"
                      disabled={aiMatching || !form.selectedContainerId}
                      onClick={() => triggerBackendAiRecommendation(form.selectedContainerId)}
                      className="px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer w-fit"
                    >
                      <span className={`material-symbols-outlined text-sm ${aiMatching ? 'animate-spin' : ''}`}>
                        {aiMatching ? 'sync' : 'auto_awesome'}
                      </span>
                      {aiMatching ? 'Đang phân tích CSDL...' : 'AI Phân tích tối ưu lại'}
                    </button>
                  </div>

                  {/* GUIDANCE BANNER OR AI SUCCESS BANNER */}
                  {!form.selectedContainerId ? (
                    <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center gap-3 text-xs text-indigo-950 animate-in fade-in">
                      <span className="material-symbols-outlined text-indigo-600 text-2xl">auto_awesome</span>
                      <div>
                        <strong className="text-sm font-bold text-indigo-900 block">
                          AI Sẵn Sàng Tự Động Phối Xe & Tài Xế
                        </strong>
                        <p className="text-indigo-800 text-[11px] mt-0.5">
                          Vui lòng bấm chọn <strong>Container</strong> ở Mục 1 ở trên. Hệ thống AI Backend sẽ tự động phân tích khối lượng hàng hóa và tự động chọn <strong>Xe đầu kéo</strong> cùng <strong>Tài xế</strong> tối ưu nhất từ CSDL.
                        </p>
                      </div>
                    </div>
                  ) : (
                    aiRecommendation && (
                      <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center gap-2.5 text-xs text-emerald-950 animate-in fade-in">
                        <span className="material-symbols-outlined text-emerald-600 text-xl">verified</span>
                        <div className="flex-1">
                          <span className="font-bold text-emerald-900">✨ AI Backend Đã Tự Động Tối Ưu: </span>
                          <span>
                            Đã chọn Xe đầu kéo <strong>{aiRecommendation.recommendedTruckPlate}</strong> (Tải tối đa {aiRecommendation.truckMaxPayloadTon}T) và Tài xế <strong>{aiRecommendation.recommendedDriverName}</strong> ({aiRecommendation.driverLicense || 'FC'}) cho Container <strong>{form.containerNo}</strong> ({form.containerGrossWeightTon}T).
                          </span>
                        </div>
                      </div>
                    )
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Chọn Xe đầu kéo */}
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate mb-1.5 flex items-center justify-between">
                        <span>Chọn Xe đầu kéo (Truck)</span>
                        <span className="text-[10px] text-indigo-600 font-bold">✨ AI đề xuất theo tải trọng</span>
                      </label>
                      <select
                        value={form.truckId}
                        onChange={(e) => handleTruckChange(e.target.value)}
                        className="w-full p-3 rounded-xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange"
                      >
                        <option value="">
                          {form.selectedContainerId ? '-- Chọn xe đầu kéo khác --' : '-- Chọn container trước để AI tự động phối xe --'}
                        </option>
                        {(availableResources.trucks || []).map((t) => (
                          <option key={t.id} value={t.id}>
                            Biển số: {t.plateNumber} · Tải trọng: {t.maxPayloadTon} Tấn ({t.vehicleType})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Chọn Tài xế */}
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate mb-1.5 flex items-center justify-between">
                        <span>Chọn Tài xế (Driver)</span>
                        <span className="text-[10px] text-indigo-600 font-bold">✨ AI đề xuất Active</span>
                      </label>
                      <select
                        value={form.driverId}
                        onChange={(e) => setForm({ ...form, driverId: e.target.value })}
                        className="w-full p-3 rounded-xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange"
                      >
                        <option value="">
                          {form.selectedContainerId ? '-- Chọn tài xế khác --' : '-- Chọn container trước để AI tự động phối tài xế --'}
                        </option>
                        {(availableResources.drivers || []).map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.fullName} (BLX: {d.licenseClass || 'FC'}) · SĐT: {d.phone}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 4. THANH CẢNH BÁO TẢI TRỌNG THÔNG MINH (INTERACTIVE PAYLOAD BAR FROM BACKEND - HIỆN KHI ĐÃ CHỌN CONT) */}
                  {form.selectedContainerId && (
                    <div className="space-y-2.5 pt-2 animate-in fade-in">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate">Độ khớp Tải trọng (Backend AI):</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                            backendPayload.severity === 'danger'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : backendPayload.severity === 'warning'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}>
                            {backendPayload.status === 'Overloaded' ? '⚠️ Quá tải' : backendPayload.status === 'Underutilized' ? '⚠️ Lãng phí tải' : '✅ Đạt chuẩn'}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-carbon">
                          Cont {form.containerGrossWeightTon}T / Xe {selectedTruck ? selectedTruck.maxPayloadTon : 24}T ({backendPayload.ratio}% tải)
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-3 bg-chalk rounded-full overflow-hidden flex shadow-inner">
                        <div
                          style={{ width: `${Math.min(backendPayload.ratio, 100)}%` }}
                          className={`h-full transition-all duration-500 ${
                            backendPayload.severity === 'danger'
                              ? 'bg-rose-600'
                              : backendPayload.severity === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        ></div>
                      </div>

                      {/* DYNAMIC PAYLOAD ALERTS FROM BACKEND */}
                      <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
                        backendPayload.severity === 'danger'
                          ? 'bg-rose-50 border-rose-300 text-rose-800'
                          : backendPayload.severity === 'warning'
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      }`}>
                        <span className={`material-symbols-outlined text-lg ${
                          backendPayload.severity === 'danger' ? 'text-rose-600' : backendPayload.severity === 'warning' ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {backendPayload.severity === 'danger' ? 'error' : backendPayload.severity === 'warning' ? 'warning' : 'verified'}
                        </span>
                        <div className="flex-1">
                          <span className="font-medium leading-relaxed">{backendPayload.warningMessage}</span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* NAVIGATION BUTTON */}
                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (!form.selectedContainerId && !form.containerNo) {
                        showNotification('Vui lòng chọn container trước khi tiếp tục!', 'error')
                        return
                      }
                      setWizardStep(2)
                    }}
                    className="px-8 py-3.5 rounded-xl bg-carbon text-white font-bold text-xs hover:bg-black transition-all flex items-center gap-2 shadow-md"
                  >
                    Tiếp tục: Khung giờ hẹn tối ưu (Step 2) ➔
                  </button>
                </div>
              </div>
            )}

            {/* WIZARD STEP 2: AI OPTIMAL TIME SLOT & CONFIRMATION */}
            {wizardStep === 2 && (
              <div className="space-y-6">
                
                {/* AI TIME SLOT RECOMMENDATION BANNER */}
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 text-xs text-indigo-950 flex items-start gap-3 shadow-xs">
                  <span className="material-symbols-outlined text-indigo-600 text-2xl">alarm_on</span>
                  <div className="space-y-1">
                    <strong className="text-sm font-bold text-indigo-900 block">
                      ✨ AI đã tự động điền Khung Giờ Hẹn Thấp Điểm (Off-Peak Slot)
                    </strong>
                    <p className="text-indigo-800">
                      Khung giờ <strong>08:30 - 10:30 ngày {form.appointmentDate}</strong> có mật độ phương tiện tại làn cổng cảng dưới 20%. Xe qua Barrier tự động nhanh gấp 3 lần so với giờ cao điểm.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white border border-chalk rounded-2xl p-5">
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
                <div className="bg-fog border border-chalk rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-chalk pb-3">
                    <span className="font-bold text-carbon text-sm">Tóm tắt Hồ sơ Đặt chỗ & Thẻ thông hành:</span>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-300">
                      Sẵn sàng kích hoạt [READY]
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-1">
                    <div>
                      <span className="text-slate block text-[11px]">Mã Booking:</span>
                      <p className="font-mono font-extrabold text-carbon text-sm">{form.bookingCode}</p>
                    </div>
                    <div>
                      <span className="text-slate block text-[11px]">Nghiệp vụ:</span>
                      <p className="font-bold text-signal-orange text-sm">{form.bookingType}</p>
                    </div>
                    <div>
                      <span className="text-slate block text-[11px]">Container:</span>
                      <p className="font-mono font-extrabold text-carbon text-sm">{form.containerNo} ({form.containerGrossWeightTon}T)</p>
                    </div>
                    <div>
                      <span className="text-slate block text-[11px]">Xe đầu kéo & Tài xế:</span>
                      <p className="font-mono font-bold text-carbon">{selectedTruck?.plateNumber} · {availableResources.drivers.find(d => d.id === form.driverId)?.fullName}</p>
                    </div>
                  </div>

                  <div className="border-t border-chalk pt-3 flex items-center gap-2 text-[11px] text-slate">
                    <span className="material-symbols-outlined text-sm text-emerald-600">verified</span>
                    Ngay sau khi bấm Xác nhận, hệ thống Backend sẽ sinh mã số Token và cấp trạng thái <strong>Ready</strong> để tài xế sẵn sàng Gate-In.
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="px-6 py-3.5 rounded-xl border border-chalk text-carbon font-bold text-xs hover:bg-fog transition-colors"
                  >
                    ← Quay lại Bước 1 (Đổi xe / cont)
                  </button>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-9 py-3.5 rounded-xl bg-signal-orange text-white font-extrabold text-xs hover:bg-orange-600 shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {actionLoading && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                    Xác nhận & Khởi tạo Booking [Ready] ➔
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
              <span className="text-[10px] font-bold text-primary uppercase text-center w-24">READY / GATE-IN</span>
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
      {/* MODAL 1: NXP-049 FLEET ASSIGNMENT MODAL (CHUYỂN SANG READY) */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-paper border border-chalk rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-600">NXP-049: Điều phối Tài nguyên Fleet</span>
                <h3 className="font-mono font-bold text-xl text-carbon">Gán Xe & Tài xế cho {assignForm.bookingCode}</h3>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate hover:text-carbon font-bold text-xl"
              >
                ✕
              </button>
            </div>

            {/* AI Auto-Match Button inside Modal */}
            <div className="flex justify-end">
              <button
                type="button"
                disabled={assignAiLoading}
                onClick={triggerAssignAiMatch}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span className={`material-symbols-outlined text-sm ${assignAiLoading ? 'animate-spin' : ''}`}>
                  {assignAiLoading ? 'sync' : 'auto_awesome'}
                </span>
                {assignAiLoading ? 'Đang phân tích...' : '🤖 AI Gợi ý Tối ưu từ CSDL'}
              </button>
            </div>

            <form onSubmit={handleConfirmAssignFleet} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase text-slate mb-1">1. Chọn Container liên kết</label>
                <select
                  value={assignForm.containerId}
                  onChange={(e) => handleAssignContainerChange(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-chalk bg-white font-mono font-bold text-carbon"
                >
                  {(availableResources.containers || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.containerNumber} ({c.size} - {c.grossWeightTon || (c.grossWeightKg / 1000)}T)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate mb-1">2. Chọn Xe đầu kéo (Truck)</label>
                <select
                  value={assignForm.truckId}
                  onChange={(e) => handleAssignTruckChange(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-chalk bg-white font-bold text-carbon"
                >
                  {(availableResources.trucks || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      Biển số: {t.plateNumber} (Tải trọng {t.maxPayloadTon}T)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate mb-1">3. Chọn Tài xế phụ trách (Driver)</label>
                <select
                  value={assignForm.driverId}
                  onChange={(e) => setAssignForm({ ...assignForm, driverId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-chalk bg-white font-bold text-carbon"
                >
                  {(availableResources.drivers || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} (BLX: {d.licenseClass || 'FC'}) · {d.phone}
                    </option>
                  ))}
                </select>
              </div>

              {/* LIVE PAYLOAD METER IN ASSIGN MODAL */}
              {assignPayloadAnalysis && (
                <div className="space-y-1.5 p-3 rounded-xl bg-fog border border-chalk">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-bold text-slate">Độ khớp tải trọng:</span>
                    <span className={`font-bold font-mono ${
                      assignPayloadAnalysis.severity === 'danger' ? 'text-rose-600' : assignPayloadAnalysis.severity === 'warning' ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {assignPayloadAnalysis.ratio}% tải · {assignPayloadAnalysis.status}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-chalk rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${Math.min(assignPayloadAnalysis.ratio, 100)}%` }}
                      className={`h-full transition-all duration-300 ${
                        assignPayloadAnalysis.severity === 'danger' ? 'bg-rose-600' : assignPayloadAnalysis.severity === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    ></div>
                  </div>
                  <p className="text-[10px] text-slate-600 italic leading-tight">
                    {assignPayloadAnalysis.warningMessage}
                  </p>
                </div>
              )}

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">info</span>
                Sau khi xác nhận, Booking sẽ tự động chuyển sang trạng thái <strong>Ready</strong> và kích hoạt Vé e-Pass QR vào cổng.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-chalk">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl border border-chalk text-carbon font-bold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {actionLoading && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                  Xác nhận Điều phối [Ready] ➔
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SMART E-PASS QR CODE MODAL */}
      {/* ========================================================================= */}
      {showQrModal && selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-paper border border-chalk rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 text-center">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-signal-orange">NexusPort Smart e-Pass</span>
              <button onClick={() => setShowQrModal(false)} className="text-slate font-bold text-xl">✕</button>
            </div>

            <div className="bg-carbon text-white rounded-2xl p-4 text-left space-y-1">
              <p className="text-[10px] text-slate-400 font-mono">BOOKING CODE</p>
              <h4 className="font-mono font-extrabold text-xl text-signal-orange">{selectedBooking.bookingCode}</h4>
              <p className="text-[11px] text-slate-300">Phương tiện: <strong>{selectedBooking.vehiclePlate || '51C-992.81'}</strong></p>
              <p className="text-[11px] text-slate-300">Tài xế: <strong>{selectedBooking.driverName || 'Nguyễn Văn Hùng'}</strong></p>
            </div>

            <div className="bg-white p-4 border-2 border-dashed border-chalk rounded-2xl w-48 h-48 mx-auto flex items-center justify-center shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  JSON.stringify({
                    bookingCode: selectedBooking.bookingCode,
                    plateNumber: selectedBooking.vehiclePlate || '51C-992.81',
                    status: 'Ready',
                    expires: selectedBooking.appointmentEnd
                  })
                )}`}
                alt="Gate Pass QR"
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-[11px] text-slate font-medium">
              Quét mã này tại đầu đọc tự động của <strong>Làn Cổng Gate-In</strong> để nâng barrier vào bãi.
            </p>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-3 rounded-xl bg-carbon text-white font-bold text-xs hover:bg-black"
            >
              Đóng thẻ thông hành
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: BOOKING DETAIL VIEW */}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate">Xe đầu kéo:</span>
                  <p className="font-mono font-bold text-carbon">{selectedBooking.vehiclePlate || 'Chưa gán'}</p>
                </div>
                <div>
                  <span className="text-slate">Tài xế phụ trách:</span>
                  <p className="font-bold text-carbon">{selectedBooking.driverName || 'Chưa gán'}</p>
                </div>
              </div>

              <div>
                <span className="text-slate">Danh sách Container:</span>
                <p className="font-mono font-bold text-signal-orange text-sm">
                  {selectedBooking.containerIds?.join(', ') || 'Chưa cập nhật'}
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
      {/* MODAL 4: CANCEL BOOKING CONFIRMATION */}
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
                className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 flex items-center gap-1 cursor-pointer"
              >
                {actionLoading && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                Xác nhận Hủy ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: EDIT BOOKING MODAL */}
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
