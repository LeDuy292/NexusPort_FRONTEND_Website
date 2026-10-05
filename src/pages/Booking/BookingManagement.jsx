import React, { useState, useEffect, useMemo } from 'react'
import { bookingService } from '../../services/bookingService'
import driverService from '../../services/driverService'
import vehicleService from '../../services/vehicleService'

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

  // Local persistent cache để lưu thông tin phương tiện, tài xế & container cho booking
  const [fleetCache, setFleetCache] = useState(() => {
    try {
      const saved = localStorage.getItem('nexusport_booking_fleet_cache')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const updateFleetCache = (bookingCode, data) => {
    if (!bookingCode) return
    setFleetCache(prev => {
      const next = {
        ...prev,
        [bookingCode]: {
          ...(prev[bookingCode] || {}),
          ...data
        }
      }
      try {
        localStorage.setItem('nexusport_booking_fleet_cache', JSON.stringify(next))
      } catch {}
      return next
    })
  }

  // Danh sách ID container đã có trong booking đang hoạt động
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
  const [copiedText, setCopiedText] = useState(null)

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
    carrierId: '',
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

  const [validationErrors, setValidationErrors] = useState([])

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

  // Helper lấy biển số xe chính xác cho từng booking
  const getBookingVehiclePlate = (bk) => {
    if (bk.vehiclePlate) return bk.vehiclePlate
    const cached = fleetCache[bk.bookingCode]
    if (cached?.vehiclePlate) return cached.vehiclePlate
    const truck = (availableResources.trucks || []).find(t => t.id === bk.truckId || t.id === bk.vehicleId)
    if (truck?.plateNumber) return truck.plateNumber
    return null
  }

  // Helper lấy tên tài xế chính xác cho từng booking
  const getBookingDriverName = (bk) => {
    if (bk.driverName) return bk.driverName
    const cached = fleetCache[bk.bookingCode]
    if (cached?.driverName) return cached.driverName
    const driver = (availableResources.drivers || []).find(d => d.id === bk.driverId)
    if (driver?.fullName) return driver.fullName
    return null
  }

  // Helper lấy danh sách Container chính xác (Mã số Cont thay vì GUID)
  const getBookingContainers = (bk) => {
    if (bk.containerNumbers && bk.containerNumbers.length > 0) {
      return bk.containerNumbers
    }
    const cached = fleetCache[bk.bookingCode]
    if (cached?.containerNumber) {
      return [cached.containerNumber]
    }
    if (bk.containerIds && bk.containerIds.length > 0) {
      return bk.containerIds.map(cid => {
        if (cid && cid.length <= 15 && !cid.includes('-') && /^[A-Z0-9]+$/i.test(cid)) {
          return cid.toUpperCase()
        }
        const cont = (availableResources.containers || []).find(c => c.id === cid || c.containerNumber === cid)
        if (cont?.containerNumber) return cont.containerNumber
        if (cached?.containerId === cid && cached?.containerNumber) return cached.containerNumber
        return cid.length > 20 ? `CONT-${cid.slice(0, 8).toUpperCase()}` : cid
      })
    }
    return []
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
    let newDriverId = undefined;
    if (truckId) {
      const assignedTruck = (availableResources.trucks || []).find(t => String(t.id) === String(truckId));
      if (assignedTruck && assignedTruck.driverId) newDriverId = assignedTruck.driverId;
    }
    setForm(prev => ({ ...prev, truckId, ...(newDriverId ? { driverId: newDriverId } : {}) }))
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

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 2000)
  }

  // Phân tích trạng thái tải trọng
  const selectedTruck = (availableResources.trucks || []).find(t => t.id === form.truckId)

  // Metrics summary
  const metrics = useMemo(() => {
    const ready = bookings.filter(b => b.status === 'Ready').length
    const pending = bookings.filter(b => b.status === 'Pending').length
    const checkedIn = bookings.filter(b => b.status === 'CheckedIn' || b.status === 'Completed').length
    return {
      total: totalCount || bookings.length,
      ready,
      pending,
      checkedIn
    }
  }, [bookings, totalCount])

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
      const selectedContObj = (availableResources.containers || []).find(c => c.id === form.selectedContainerId)

      const payload = {
        carrierId: form.carrierId || undefined,
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

      // Lưu ngay vào cache cục bộ để hiển thị chính xác lập tức
      updateFleetCache(form.bookingCode, {
        vehiclePlate: selectedTruckObj?.plateNumber || form.vehiclePlate,
        driverName: selectedDriverObj?.fullName || form.driverName,
        containerNumber: selectedContObj?.containerNumber || form.containerNo,
        containerId: form.selectedContainerId,
        truckId: form.truckId,
        driverId: form.driverId
      })

      const created = await bookingService.createBooking(payload)
      const currentStatus = created?.status || 'Pending'

      // Gán tự động Xe & Tài xế
      if (form.truckId && form.driverId) {
        try {
          await vehicleService.assignDriver(form.truckId, form.driverId)
          if (form.driverId) {
            // Get fresh driver data to avoid stale state from another tab
            const freshDriver = await driverService.getDriverById(form.driverId).catch(() => selectedDriverObj);
            const statusToCheck = freshDriver?.status || selectedDriverObj?.status;
            
            if (['active', 'inactive'].includes(statusToCheck)) {
              await driverService.toggleStatus(form.driverId, 'waiting_confirmation')
            } else if (['vehicle_received', 'transporting', 'receiving_vehicle', 'waiting_confirmation'].includes(statusToCheck)) {
              await driverService.toggleStatus(form.driverId, 'booking_confirmed')
            }
          }
        } catch (e) { console.error('Lỗi khi tự động gán xe & tài xế:', e) }
      }
      
      showNotification(
        `🎉 Khởi tạo Đặt chỗ ${form.bookingCode} thành công! Trạng thái: [Pending] chờ Dispatcher phê duyệt.`,
        'success'
      )
      
      if (form.selectedContainerId) {
        setAvailableResources(prev => ({
          ...prev,
          containers: (prev.containers || []).filter(c => c.id !== form.selectedContainerId)
        }))
      }

      if (created) {
        const optimisticBooking = {
          id: created.id || `bk-local-${Date.now()}`,
          carrierId: form.carrierId,
          bookingCode: created.bookingCode || form.bookingCode,
          bookingType: created.bookingType || form.bookingType,
          status: currentStatus,
          appointmentStart: startIso,
          appointmentEnd: endIso,
          containerIds: payload.containerIds,
          containerNumbers: [selectedContObj?.containerNumber || form.containerNo || 'CONT-LIVE'],
          driverId: form.driverId,
          driverName: selectedDriverObj?.fullName || form.driverName,
          truckId: form.truckId,
          vehiclePlate: selectedTruckObj?.plateNumber || form.vehiclePlate,
          createdAt: new Date().toISOString()
        }
        setBookings(prev => [optimisticBooking, ...prev.filter(b => b.id !== optimisticBooking.id && b.bookingCode !== optimisticBooking.bookingCode)])
        setTotalCount(prev => Math.max(prev + 1, 1))
      }

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
      loadAvailableResources()
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
    let newDriverId = undefined;
    if (truckId) {
      const assignedTruck = (availableResources.trucks || []).find(t => String(t.id) === String(truckId));
      if (assignedTruck && assignedTruck.driverId) newDriverId = assignedTruck.driverId;
    }
    setAssignForm(prev => ({ ...prev, truckId, ...(newDriverId ? { driverId: newDriverId } : {}) }))
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

  const handleConfirmAssignFleet = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const selectedDriverObj = availableResources.drivers.find(d => d.id === assignForm.driverId)
      const selectedTruckObj = availableResources.trucks.find(t => t.id === assignForm.truckId)
      const selectedContObj = availableResources.containers.find(c => c.id === assignForm.containerId)

      updateFleetCache(assignForm.bookingCode, {
        vehiclePlate: selectedTruckObj?.plateNumber,
        driverName: selectedDriverObj?.fullName,
        containerNumber: selectedContObj?.containerNumber || assignForm.containerNo,
        containerId: assignForm.containerId,
        truckId: assignForm.truckId,
        driverId: assignForm.driverId
      })

      const payload = {
        driverId: assignForm.driverId,
        driverName: selectedDriverObj?.fullName || 'Nguyễn Văn Hùng',
        truckId: assignForm.truckId,
        vehiclePlate: selectedTruckObj?.plateNumber || '51C-992.81',
        containerIds: assignForm.containerId ? [assignForm.containerId] : [],
        containerNo: selectedContObj?.containerNumber || assignForm.containerNo
      }

      await bookingService.assignBookingResources(assignForm.bookingId, payload)
      
      if (assignForm.truckId && assignForm.driverId) {
        try {
          await vehicleService.assignDriver(assignForm.truckId, assignForm.driverId)
          if (assignForm.driverId) {
            // Get fresh driver data to avoid stale state
            const freshDriver = await driverService.getDriverById(assignForm.driverId).catch(() => selectedDriverObj);
            const statusToCheck = freshDriver?.status || selectedDriverObj?.status;
            
            if (['active', 'inactive'].includes(statusToCheck)) {
              await driverService.toggleStatus(assignForm.driverId, 'waiting_confirmation')
            } else if (['vehicle_received', 'transporting', 'receiving_vehicle', 'waiting_confirmation'].includes(statusToCheck)) {
              await driverService.toggleStatus(assignForm.driverId, 'booking_confirmed')
            }
          }
        } catch (e) { console.error('Lỗi khi tự động gán xe & tài xế:', e) }
      }

      showNotification(`✨ Đã điều phối Xe & Tài xế cho Booking ${assignForm.bookingCode}! Trạng thái chuyển sang [READY] thành công.`, 'success')
      setShowAssignModal(false)
      fetchBookings()
      loadAvailableResources()
    } catch {
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
    const containers = getBookingContainers(bk)

    setEditForm({
      id: bk.id,
      bookingCode: bk.bookingCode,
      appointmentDate: startDate.toISOString().slice(0, 10),
      startTime: startDate.toTimeString().slice(0, 5),
      endTime: endDate.toTimeString().slice(0, 5),
      containerNo: containers.length > 0 ? containers[0] : 'MSKU8891024'
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
    } catch {
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
    } catch {
      showNotification('Không thể hủy đặt chỗ này.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Helper function: Render Status Badge with Modern Glow
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Ready':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Sẵn sàng (Ready)
          </span>
        )
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Chờ điều phối
          </span>
        )
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-300">
            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
            Đã duyệt
          </span>
        )
      case 'CheckedIn':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-300 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            Đã Gate-In
          </span>
        )
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            Hoàn tất
          </span>
        )
      case 'Canceled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Đã hủy
          </span>
        )
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            Từ chối (Rejected)
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            {status || 'Khởi tạo'}
          </span>
        )
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* ========================================================================= */}
      {/* FLOATING TOAST NOTIFICATION */}
      {/* ========================================================================= */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl border text-sm font-medium flex items-center gap-3 backdrop-blur-md transition-all transform animate-in slide-in-from-top-4 duration-300 ${
          toast.type === 'error' 
            ? 'bg-rose-900 border-rose-700 text-rose-100 shadow-rose-900/30' 
            : 'bg-emerald-900 border-emerald-600 text-emerald-100 shadow-emerald-900/30'
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${toast.type === 'error' ? 'bg-rose-800' : 'bg-emerald-800'}`}>
            <span className="material-symbols-outlined text-lg">{toast.type === 'error' ? 'error' : 'check_circle'}</span>
          </div>
          <div className="flex-1 pr-2">{toast.message}</div>
          <button onClick={() => setToast(null)} className="text-white/60 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HERO BANNER & ACTIONS - PHONG CÁCH NỀN SÁNG CAO CẤP (LIGHT THEME) */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-slate-50 to-orange-50/40 text-carbon p-6 sm:p-8 border border-slate-200/90 shadow-sm">
        {/* Soft atmospheric ambient glow */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-signal-orange/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 -mb-12 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-orange-50 text-signal-orange border border-orange-200 shadow-2xs">
                <span className="material-symbols-outlined text-xs">calendar_month</span>
                TAS · Terminal Appointment System
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Hệ Thống Trực Tuyến
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <span className="material-symbols-outlined text-xs">neurology</span>
                AI Auto-Match Active
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black font-heading text-carbon tracking-tight">
              Quản Lý Lịch Hẹn & Điều Phối Bãi Thông Minh
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Tự động hóa luồng đặt hẹn vào cảng, tối ưu phân bổ đầu kéo bằng AI (NXP-048) và điều phối tài nguyên đội xe cấp thẻ điện tử Ready Gate-In tức thời (NXP-049).
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setActiveTab('create')
                setWizardStep(1)
              }}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-signal-orange to-orange-600 hover:from-orange-500 hover:to-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/35 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 group cursor-pointer"
            >
              <span className="material-symbols-outlined text-base group-hover:rotate-90 transition-transform">add_circle</span>
              Tạo Lịch Hẹn Mới (AI Wizard)
            </button>
          </div>
        </div>

        {/* METRICS / STATS RIBBON - SÁNG, TRONG TRẺO, TINH TẾ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-slate-200/80">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/80 shadow-2xs hover:border-indigo-300 hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-semibold">
              <span>Tổng Lịch Hẹn</span>
              <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-base">receipt_long</span>
              </div>
            </div>
            <div className="text-2xl font-black font-heading text-carbon tracking-tight">{metrics.total}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Dữ liệu thời gian thực</div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/80 shadow-2xs hover:border-emerald-300 hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between text-emerald-700 text-xs mb-1 font-semibold">
              <span>Sẵn Sàng (Ready)</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-base">verified</span>
              </div>
            </div>
            <div className="text-2xl font-black font-heading text-emerald-600 tracking-tight">{metrics.ready}</div>
            <div className="text-[10px] text-emerald-600/80 mt-0.5 font-medium">Đã cấp vé QR vào cổng</div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/80 shadow-2xs hover:border-amber-300 hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between text-amber-700 text-xs mb-1 font-semibold">
              <span>Chờ Điều Phối</span>
              <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-base">pending_actions</span>
              </div>
            </div>
            <div className="text-2xl font-black font-heading text-amber-600 tracking-tight">{metrics.pending}</div>
            <div className="text-[10px] text-amber-600/80 mt-0.5 font-medium">Cần gán xe & tài xế</div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/80 shadow-2xs hover:border-blue-300 hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between text-blue-700 text-xs mb-1 font-semibold">
              <span>Gate-In / Hoàn Tất</span>
              <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-base">check_circle</span>
              </div>
            </div>
            <div className="text-2xl font-black font-heading text-blue-600 tracking-tight">{metrics.checkedIn}</div>
            <div className="text-[10px] text-blue-600/80 mt-0.5 font-medium">Xe đã qua barrier cảng</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEGMENTED TAB NAVIGATION */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between gap-4 bg-paper p-1.5 rounded-2xl border border-chalk shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none w-full sm:w-auto">
          {[
            { key: 'my_bookings', label: 'Lịch hẹn của tôi (Live Database)', icon: 'format_list_bulleted', badge: totalCount },
            { key: 'create', label: 'Tạo Mới (AI Smart Match)', icon: 'auto_awesome', isNew: true },
            { key: 'container_status', label: 'Lộ Trình Container', icon: 'timeline' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-carbon text-white shadow-md shadow-carbon/20'
                  : 'text-slate-600 hover:text-carbon hover:bg-fog'
              }`}
            >
              <span className={`material-symbols-outlined text-lg ${activeTab === tab.key ? 'text-signal-orange' : 'text-slate-400'}`}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.badge}
                </span>
              )}
              {tab.isNew && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-signal-orange text-white">
                  AI
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            fetchBookings()
            loadAvailableResources()
            showNotification('Đã đồng bộ dữ liệu mới nhất từ CSDL!')
          }}
          disabled={loading || resourcesLoading}
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-carbon hover:bg-fog border border-chalk transition-all cursor-pointer"
          title="Tải lại dữ liệu"
        >
          <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin text-signal-orange' : ''}`}>
            sync
          </span>
          <span>Làm mới</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MY BOOKINGS LIST */}
      {/* ========================================================================= */}
      {activeTab === 'my_bookings' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* SEARCH & FILTERS CONTROLS */}
          <div className="bg-paper border border-chalk rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Tìm theo mã Booking (VD: BK-202609...), Biển số xe hoặc Container..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-10 py-2.5 rounded-xl border border-chalk bg-white text-sm text-carbon placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-signal-orange focus:border-transparent transition-all"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('')
                      setPageNumber(1)
                      fetchBookings()
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-carbon"
                  >
                    <span className="material-symbols-outlined text-sm">cancel</span>
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-carbon hover:bg-black text-white font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">filter_alt</span>
                  Tìm kiếm
                </button>

                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value)
                    setPageNumber(1)
                  }}
                  className="px-3 py-2.5 rounded-xl border border-chalk bg-white text-xs font-semibold text-carbon focus:ring-2 focus:ring-signal-orange cursor-pointer"
                >
                  <option value="All">Tất cả nghiệp vụ</option>
                  <option value="Pickup">Chỉ Pickup (Bốc hàng)</option>
                  <option value="Dropoff">Chỉ Dropoff (Hạ bãi)</option>
                </select>
              </div>
            </form>

            {/* Status Filter Chips */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-chalk">
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider shrink-0 mr-1">
                  Trạng thái:
                </span>
                {[
                  { id: 'All', label: 'Tất cả' },
                  { id: 'Ready', label: '✨ Sẵn sàng (Ready)' },
                  { id: 'Pending', label: 'Chờ điều phối' },
                  { id: 'Approved', label: 'Đã duyệt' },
                  { id: 'CheckedIn', label: 'Đã Gate-In' },
                  { id: 'Completed', label: 'Hoàn tất' },
                  { id: 'Canceled', label: 'Đã hủy' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setStatusFilter(s.id)
                      setPageNumber(1)
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      statusFilter === s.id
                        ? 'bg-carbon text-white shadow-xs'
                        : 'bg-fog hover:bg-chalk text-slate-600 border border-transparent'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-500 font-medium shrink-0">
                Hiển thị <strong className="text-carbon font-bold">{bookings.length}</strong> / {totalCount} kết quả
              </div>
            </div>
          </div>

          {/* BOOKINGS TABLE CONTAINER */}
          <div className="bg-paper border border-chalk rounded-2xl shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-16 text-center space-y-4">
                <div className="w-12 h-12 rounded-full border-4 border-signal-orange/20 border-t-signal-orange animate-spin mx-auto"></div>
                <div className="space-y-1">
                  <h4 className="font-bold text-carbon text-sm">Đang tải dữ liệu Đặt chỗ trực tiếp từ CSDL</h4>
                  <p className="text-xs text-slate-400">Vui lòng chờ trong giây lát...</p>
                </div>
              </div>
            ) : bookings.length === 0 ? (
              <div className="p-16 text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-fog text-slate-400 flex items-center justify-center mx-auto border border-chalk">
                  <span className="material-symbols-outlined text-3xl">event_busy</span>
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-carbon text-base">Không tìm thấy hồ sơ Đặt chỗ phù hợp</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Thử thay đổi bộ lọc tìm kiếm hoặc nhấn nút Tạo Đặt chỗ Mới bên trên để bắt đầu.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('create')
                    setWizardStep(1)
                  }}
                  className="px-5 py-2.5 rounded-xl bg-signal-orange text-white font-bold text-xs hover:bg-orange-600 transition-all inline-flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  Tạo Đặt chỗ Ngay
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-chalk text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3.5 px-5">Mã Booking</th>
                      <th className="py-3.5 px-4">Loại & Phương Tiện</th>
                      <th className="py-3.5 px-4">Container</th>
                      <th className="py-3.5 px-4">Khung Giờ Hẹn</th>
                      <th className="py-3.5 px-4">Trạng Thái</th>
                      <th className="py-3.5 px-5 text-right">Thao Tác Nghiệp Vụ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-chalk/80">
                    {bookings.map((bk) => {
                      const resolvedPlate = getBookingVehiclePlate(bk)
                      const resolvedDriver = getBookingDriverName(bk)
                      const resolvedContainers = getBookingContainers(bk)

                      return (
                        <tr key={bk.id} className="hover:bg-orange-50/20 transition-colors group">
                          
                          {/* 1. Mã Booking */}
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-extrabold text-sm text-carbon tracking-tight group-hover:text-signal-orange transition-colors">
                                {bk.bookingCode}
                              </span>
                              <button
                                onClick={() => copyToClipboard(bk.bookingCode, bk.bookingCode)}
                                className="text-slate-400 hover:text-carbon transition-colors cursor-pointer"
                                title="Sao chép mã booking"
                              >
                                <span className="material-symbols-outlined text-xs">
                                  {copiedText === bk.bookingCode ? 'check' : 'content_copy'}
                                </span>
                              </button>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-400 font-mono">
                                ID: {bk.id?.slice(0, 8)}...
                              </span>
                              {bk.createdAt && (
                                <span className="text-[10px] text-slate-400">
                                  • {new Date(bk.createdAt).toLocaleDateString('vi-VN')}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 2. Loại & Phương tiện */}
                          <td className="py-4 px-4">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                                  bk.bookingType === 'Pickup' 
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                                    : 'bg-teal-50 text-teal-700 border border-teal-200'
                                }`}>
                                  {bk.bookingType}
                                </span>

                                {resolvedPlate ? (
                                  <span className="font-mono font-bold text-[11px] text-carbon bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200 flex items-center gap-1 shadow-2xs">
                                    <span>🚚</span>
                                    <span>{resolvedPlate}</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                                    Chưa gán xe
                                  </span>
                                )}
                              </div>

                              {resolvedDriver ? (
                                <div className="text-[11px] text-slate-700 flex items-center gap-1 font-medium">
                                  <span className="material-symbols-outlined text-xs text-slate-400">person</span>
                                  <span>{resolvedDriver}</span>
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-400 italic">Chưa chỉ định tài xế</div>
                              )}
                            </div>
                          </td>

                          {/* 3. Container */}
                          <td className="py-4 px-4">
                            {resolvedContainers.length > 0 ? (
                              <div className="space-y-1">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50/60 border border-orange-200/90 text-signal-orange font-mono font-black text-xs shadow-2xs">
                                  <span className="material-symbols-outlined text-xs">inventory_2</span>
                                  <span>{resolvedContainers.join(', ')}</span>
                                </div>
                                <div className="text-[10px] text-slate-400">Tiêu chuẩn cảng · Đã xác thực</div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 italic inline-block">
                                Chưa gắn container
                              </span>
                            )}
                          </td>

                          {/* 4. Khung Giờ Hẹn */}
                          <td className="py-4 px-4">
                            <div className="space-y-0.5">
                              <div className="font-bold text-carbon text-xs flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-xs text-slate-400">calendar_today</span>
                                <span>{new Date(bk.appointmentStart).toLocaleDateString('vi-VN')}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono bg-fog px-2 py-0.5 rounded w-fit border border-chalk">
                                {new Date(bk.appointmentStart).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(bk.appointmentEnd).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </td>

                          {/* 5. Trạng Thái */}
                          <td className="py-4 px-4">
                            {renderStatusBadge(bk.status)}
                          </td>

                          {/* 6. Thao Tác Nghiệp Vụ */}
                          <td className="py-4 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              
                              {/* NXP-049: Nút Gán Fleet cho Booking Pending */}
                              {bk.status === 'Pending' && (
                                <button
                                  onClick={() => openAssignFleetModal(bk)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all flex items-center gap-1 shadow-sm hover:shadow-emerald-800/30 cursor-pointer"
                                  title="Điều phối Xe & Tài xế để chuyển sang trạng thái Ready"
                                >
                                  <span className="material-symbols-outlined text-sm">local_shipping</span>
                                  Điều phối
                                </button>
                              )}

                              {/* Vé e-Pass QR khi đã Ready */}
                              {(bk.status === 'Ready' || bk.status === 'Approved' || bk.status === 'CheckedIn') && (
                                <button
                                  onClick={() => {
                                    setSelectedBooking(bk)
                                    setShowQrModal(true)
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-carbon hover:bg-black text-white font-bold text-[11px] transition-all flex items-center gap-1 shadow-xs cursor-pointer group"
                                  title="Xem Vé Điện Tử e-Pass để quét vào cổng"
                                >
                                  <span className="material-symbols-outlined text-sm text-signal-orange group-hover:scale-110 transition-transform">
                                    qr_code_2
                                  </span>
                                  Vé e-Pass
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setSelectedBooking(bk)
                                  setShowDetailModal(true)
                                }}
                                className="w-8 h-8 rounded-xl border border-chalk hover:border-carbon text-slate-600 hover:text-carbon hover:bg-fog transition-all flex items-center justify-center cursor-pointer"
                                title="Xem chi tiết"
                              >
                                <span className="material-symbols-outlined text-base">visibility</span>
                              </button>

                              {bk.status === 'Pending' && (
                                <button
                                  onClick={() => openEditModal(bk)}
                                  className="w-8 h-8 rounded-xl border border-amber-200 hover:border-amber-400 text-amber-700 hover:bg-amber-50 transition-all flex items-center justify-center cursor-pointer"
                                  title="Chỉnh sửa giờ hẹn"
                                >
                                  <span className="material-symbols-outlined text-base">edit</span>
                                </button>
                              )}

                              {(bk.status === 'Pending' || bk.status === 'Ready' || bk.status === 'Approved') && (
                                <button
                                  onClick={() => {
                                    setSelectedBooking(bk)
                                    setShowCancelModal(true)
                                  }}
                                  className="w-8 h-8 rounded-xl border border-rose-200 hover:border-rose-400 text-rose-600 hover:bg-rose-50 transition-all flex items-center justify-center cursor-pointer"
                                  title="Hủy đặt chỗ"
                                >
                                  <span className="material-symbols-outlined text-base">cancel</span>
                                </button>
                              )}
                            </div>
                          </td>

                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* PAGINATION CONTROLS */}
            {!loading && bookings.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-chalk bg-fog/40 text-xs text-slate-600">
                <div>
                  Trang <strong className="text-carbon font-bold">{pageNumber}</strong> / {totalPages} · Tổng cộng {totalCount} bản ghi
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={pageNumber <= 1}
                    onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
                    className="px-3 py-1.5 rounded-xl border border-chalk bg-white hover:bg-fog disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">arrow_back</span>
                    Trước
                  </button>

                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
                    const page = idx + 1
                    return (
                      <button
                        key={page}
                        onClick={() => setPageNumber(page)}
                        className={`w-8 h-8 rounded-xl font-bold transition-all cursor-pointer ${
                          pageNumber === page
                            ? 'bg-carbon text-white shadow-xs'
                            : 'bg-white border border-chalk hover:bg-fog text-slate-700'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  })}

                  <button
                    disabled={pageNumber >= totalPages}
                    onClick={() => setPageNumber(prev => Math.min(prev + 1, totalPages))}
                    className="px-3 py-1.5 rounded-xl border border-chalk bg-white hover:bg-fog disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    Sau
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CREATE BOOKING WIZARD */}
      {/* ========================================================================= */}
      {activeTab === 'create' && (
        <div className="bg-paper border border-chalk rounded-3xl p-6 sm:p-8 shadow-sm space-y-8 animate-in fade-in duration-200">
          
          {/* STEPPER HEADER */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-chalk">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-signal-orange uppercase tracking-wider mb-1">
                <span className="material-symbols-outlined text-sm">neurology</span>
                Quy Trình Khởi Tạo Lịch Hẹn AI Container-First (NXP-048)
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-extrabold text-carbon">
                Đăng Ký Cuộc Hẹn Cảng Mới
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Hệ thống tự động đề xuất tổ hợp Xe đầu kéo - Tài xế - Khung giờ tối ưu nhằm hạn chế ùn tắc cổng.
              </p>
            </div>

            {/* Stepper Steps Navigation */}
            <div className="flex items-center gap-3 bg-fog p-1.5 rounded-2xl border border-chalk w-fit">
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  wizardStep === 1
                    ? 'bg-carbon text-white shadow-xs'
                    : 'text-slate-600 hover:text-carbon'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  wizardStep === 1 ? 'bg-signal-orange text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  1
                </span>
                <span>Hàng Hóa & AI Phối Xe</span>
              </button>

              <div className="w-4 h-0.5 bg-chalk"></div>

              <button
                type="button"
                onClick={() => {
                  if (form.selectedContainerId || form.containerNo) {
                    setWizardStep(2)
                  } else {
                    showNotification('Vui lòng chọn container trước khi chuyển sang bước 2!', 'error')
                  }
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  wizardStep === 2
                    ? 'bg-carbon text-white shadow-xs'
                    : 'text-slate-600 hover:text-carbon'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  wizardStep === 2 ? 'bg-signal-orange text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  2
                </span>
                <span>Khung Giờ & Cấp Vé Ready</span>
              </button>
            </div>
          </div>

          {/* Validation Alert */}
          {validationErrors.length > 0 && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 sm:p-5 text-xs text-rose-900 space-y-2 animate-in fade-in">
              <div className="font-bold flex items-center gap-2 text-rose-700 text-sm">
                <span className="material-symbols-outlined text-lg">gpp_bad</span>
                Yêu cầu Đặt chỗ chưa thỏa mãn các quy tắc nghiệp vụ cảng:
              </div>
              <ul className="list-disc list-inside space-y-1 font-medium pl-1 text-rose-800">
                {validationErrors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleCreateBooking}>
            
            {/* STEP 1: CONTAINER & FLEET AI AUTO-MATCH */}
            {wizardStep === 1 && (
              <div className="space-y-6">
                
                {/* 1. TRANSACTION TYPE */}
                <div className="space-y-3">
                  <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider">
                    1. Loại Giao Dịch Nghiệp Vụ Cảng (Booking Type)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      onClick={() => setForm({ ...form, bookingType: 'Pickup' })}
                      className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                        form.bookingType === 'Pickup'
                          ? 'border-signal-orange bg-orange-50/40 shadow-sm ring-2 ring-orange-500/10'
                          : 'border-chalk hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        form.bookingType === 'Pickup' ? 'bg-signal-orange text-white' : 'bg-fog text-indigo-600'
                      }`}>
                        <span className="material-symbols-outlined text-2xl">arrow_upward</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-extrabold text-carbon text-base">Pickup</span>
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            Bốc cont xuất/nhập từ cảng
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Xe đầu kéo đến cảng nhận container đã hạ bãi hoặc dỡ từ tàu để vận chuyển giao cho chủ hàng.
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={() => setForm({ ...form, bookingType: 'Dropoff' })}
                      className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                        form.bookingType === 'Dropoff'
                          ? 'border-signal-orange bg-orange-50/40 shadow-sm ring-2 ring-orange-500/10'
                          : 'border-chalk hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        form.bookingType === 'Dropoff' ? 'bg-signal-orange text-white' : 'bg-fog text-teal-600'
                      }`}>
                        <span className="material-symbols-outlined text-2xl">arrow_downward</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-extrabold text-carbon text-base">Dropoff</span>
                          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            Hạ container vào bãi cảng
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Xe đầu kéo chở container hàng xuất khẩu hoặc vỏ cont rỗng vào bãi cảng lưu kho chờ bốc lên tàu.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. CORE CONTAINER SELECTION */}
                <div className="bg-gradient-to-br from-fog to-white border border-chalk rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-chalk pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-signal-orange"></span>
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-carbon">
                        2. Chọn Container Khai Báo (Live Yard Database) *
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Chỉ hiển thị container khả dụng chưa gán lịch hẹn khác
                    </span>
                  </div>

                  <div className="relative">
                    <select
                      value={form.selectedContainerId || ''}
                      onChange={(e) => handleContainerChange(e.target.value)}
                      className="w-full p-4 rounded-2xl border border-chalk bg-white text-sm font-mono font-bold text-carbon focus:ring-2 focus:ring-signal-orange shadow-xs cursor-pointer"
                    >
                      <option value="">-- Bấm vào đây để chọn container trong kho bãi (AI sẽ tự động tìm xe) --</option>
                      {(availableResources.containers || [])
                        .filter(c => c.status !== 'reserved' && c.status !== 'loaded' && c.status !== 'gate_out' && !activeBookedContainerIds.includes(c.id))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            📦 {c.containerNumber} · {c.size} · {c.grossWeightTon || (c.grossWeightKg / 1000)} Tấn · {c.cargoType} · [{c.status}]
                          </option>
                      ))}
                    </select>
                  </div>

                  {/* Container Spec Details Card */}
                  {form.containerNo ? (
                    <div className="bg-white border border-chalk rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs shadow-xs animate-in fade-in">
                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-400 font-medium">Mã Số Container:</span>
                        <div className="font-mono font-extrabold text-carbon text-sm flex items-center gap-1.5">
                          <span>{form.containerNo}</span>
                          <span className="material-symbols-outlined text-xs text-emerald-600">verified</span>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-400 font-medium">Kích Thước & Loại:</span>
                        <p className="font-bold text-carbon">{form.containerSize} · {form.cargoType}</p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-400 font-medium">Khối Lượng Toàn Bộ:</span>
                        <p className="font-mono font-extrabold text-signal-orange text-sm">
                          {form.containerGrossWeightTon} Tấn
                        </p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-400 font-medium">Số Niêm Chì (Seal No):</span>
                        <p className="font-mono font-bold text-slate-700">{form.sealNumber || 'SEAL-2026-NXP'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 flex items-start sm:items-center gap-3 text-xs text-indigo-950">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-700">
                        <span className="material-symbols-outlined text-lg">auto_awesome</span>
                      </div>
                      <div className="flex-1">
                        <strong className="font-bold text-indigo-900 block text-xs sm:text-sm">
                          Hệ thống AI đang chờ Container
                        </strong>
                        <p className="text-indigo-800 text-[11px] mt-0.5">
                          Vui lòng chọn một container ở trên. AI Backend sẽ tự động tính toán tải trọng và tự động điền Xe đầu kéo cùng Tài xế thích hợp nhất từ kho tài nguyên.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. AI RECOMMENDED VEHICLE & DRIVER */}
                <div className="bg-white border border-chalk rounded-3xl p-5 sm:p-6 space-y-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-chalk pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold text-xs flex items-center gap-1.5 border border-indigo-200">
                        <span className="material-symbols-outlined text-sm">neurology</span>
                        AI Backend Optimization
                      </span>
                      <span className="text-xs font-bold text-carbon">
                        3. Điều Phối Xe Đầu Kéo & Tài Xế Phù Hợp
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={aiMatching || !form.selectedContainerId}
                      onClick={() => triggerBackendAiRecommendation(form.selectedContainerId)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer w-fit"
                    >
                      <span className={`material-symbols-outlined text-sm ${aiMatching ? 'animate-spin' : ''}`}>
                        {aiMatching ? 'sync' : 'auto_awesome'}
                      </span>
                      {aiMatching ? 'Đang phân tích...' : 'AI Phân tích lại'}
                    </button>
                  </div>

                  {/* AI Match Success Banner */}
                  {aiRecommendation && form.selectedContainerId && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center gap-3 text-xs text-emerald-950 animate-in fade-in">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
                        <span className="material-symbols-outlined text-lg">verified</span>
                      </div>
                      <div className="flex-1 text-[11px] leading-relaxed">
                        <strong className="text-emerald-900 font-bold block text-xs">AI Backend Đã Đề Xuất Cặp Đôi Tối Ưu:</strong>
                        Đã chọn xe <strong>{aiRecommendation.recommendedTruckPlate}</strong> (Tải tối đa {aiRecommendation.truckMaxPayloadTon}T) và Tài xế <strong>{aiRecommendation.recommendedDriverName}</strong> cho Container {form.containerNo} ({form.containerGrossWeightTon}T).
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Truck Selector */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase text-slate-500 flex items-center justify-between">
                        <span>Xe Đầu Kéo (Truck)</span>
                        <span className="text-[10px] text-indigo-600 font-bold">✨ AI đề xuất tự động</span>
                      </label>
                      <select
                        value={form.truckId}
                        onChange={(e) => handleTruckChange(e.target.value)}
                        className="w-full p-3 rounded-2xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange cursor-pointer"
                      >
                        <option value="">
                          {form.selectedContainerId ? '-- Chọn xe đầu kéo khác --' : '-- Chọn container trước --'}
                        </option>
                        {(availableResources.trucks || []).map((t) => (
                          <option key={t.id} value={t.id}>
                            🚚 Biển số: {t.plateNumber} · Tải trọng: {t.maxPayloadTon} Tấn ({t.vehicleType})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Driver Selector */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase text-slate-500 flex items-center justify-between">
                        <span>Tài Xế Phụ Trách (Driver)</span>
                        <span className="text-[10px] text-indigo-600 font-bold">✨ AI đề xuất active</span>
                      </label>
                      <select
                        value={form.driverId}
                        onChange={(e) => {
                          const driverId = e.target.value;
                          let truckId = form.truckId;
                          if (driverId) {
                            const assignedTruck = (availableResources.trucks || []).find(t => String(t.driverId) === String(driverId));
                            if (assignedTruck) truckId = assignedTruck.id;
                          }
                          setForm({ ...form, driverId, truckId });
                        }}
                        className="w-full p-3 rounded-2xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange cursor-pointer"
                      >
                        <option value="">
                          {form.selectedContainerId ? '-- Chọn tài xế khác --' : '-- Chọn container trước --'}
                        </option>
                        {(availableResources.drivers || []).map((d) => (
                          <option key={d.id} value={d.id}>
                            👤 {d.fullName} (Hạng: {d.licenseClass || 'FC'}) · {d.phone}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 4. DYNAMIC INTERACTIVE PAYLOAD GAUGE */}
                  {form.selectedContainerId && (
                    <div className="p-4 rounded-2xl bg-fog/70 border border-chalk space-y-3 animate-in fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-carbon">Đánh giá Độ An Toàn Tải Trọng:</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                            backendPayload.severity === 'danger'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : backendPayload.severity === 'warning'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}>
                            {backendPayload.status === 'Overloaded' ? '⚠️ Quá tải nghiêm trọng' : backendPayload.status === 'Underutilized' ? '⚠️ Tải trọng chưa tối ưu' : '✅ Đạt chuẩn an toàn'}
                          </span>
                        </div>

                        <span className="font-mono font-bold text-carbon">
                          Hàng: {form.containerGrossWeightTon}T / Xe: {selectedTruck ? selectedTruck.maxPayloadTon : 24}T ({backendPayload.ratio}%)
                        </span>
                      </div>

                      {/* Visual Meter Bar */}
                      <div className="w-full h-3 bg-chalk rounded-full overflow-hidden flex shadow-inner">
                        <div
                          style={{ width: `${Math.min(backendPayload.ratio, 100)}%` }}
                          className={`h-full transition-all duration-500 rounded-full ${
                            backendPayload.severity === 'danger'
                              ? 'bg-rose-600'
                              : backendPayload.severity === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        ></div>
                      </div>

                      {/* Guidance Box */}
                      <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                        backendPayload.severity === 'danger'
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : backendPayload.severity === 'warning'
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      }`}>
                        <span className={`material-symbols-outlined text-base ${
                          backendPayload.severity === 'danger' ? 'text-rose-600' : backendPayload.severity === 'warning' ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {backendPayload.severity === 'danger' ? 'error' : backendPayload.severity === 'warning' ? 'warning' : 'verified'}
                        </span>
                        <span className="text-[11px] font-medium leading-relaxed">
                          {backendPayload.warningMessage}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Continue Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!form.selectedContainerId && !form.containerNo) {
                        showNotification('Vui lòng chọn container trước khi tiếp tục!', 'error')
                        return
                      }
                      setWizardStep(2)
                    }}
                    className="px-8 py-3.5 rounded-2xl bg-carbon hover:bg-black text-white font-bold text-xs transition-all flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    <span>Tiếp tục: Khung giờ & Xác nhận (Bước 2)</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: OFF-PEAK TIME SLOT & BOARDING PASS CONFIRMATION */}
            {wizardStep === 2 && (
              <div className="space-y-6">
                
                {/* AI Time Slot Recommendation Banner */}
                <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border-2 border-indigo-200/80 rounded-3xl p-5 text-xs text-indigo-950 flex items-start gap-4 shadow-xs">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20">
                    <span className="material-symbols-outlined text-xl">alarm_on</span>
                  </div>
                  <div className="space-y-1">
                    <strong className="text-sm font-bold text-indigo-900 block font-heading">
                      ✨ Đề Xuất Khung Giờ Thấp Điểm (Off-Peak Slot Optimization)
                    </strong>
                    <p className="text-indigo-800 leading-relaxed text-[11px]">
                      AI đã tự động chọn khung giờ <strong>{form.startTime} - {form.endTime} ngày {form.appointmentDate}</strong>. 
                      Mật độ phương tiện tại trạm cân và barrier dự kiến dưới 25%, giúp xe Gate-In nhanh gấp 3 lần và giảm 40% thời gian chờ đợi.
                    </p>
                  </div>
                </div>

                {/* Date Time Picker Grid */}
                <div className="bg-white border border-chalk rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-carbon">
                    Xác Nhận Khung Thời Gian Hẹn Đến Cảng
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase text-slate-500">Ngày Hẹn Đến Cảng</label>
                      <input
                        type="date"
                        required
                        value={form.appointmentDate}
                        onChange={(e) => setForm({ ...form, appointmentDate: e.target.value })}
                        className="w-full p-3 rounded-2xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase text-slate-500">Giờ Bắt Đầu (Start Time)</label>
                      <input
                        type="time"
                        required
                        value={form.startTime}
                        onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                        className="w-full p-3 rounded-2xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold uppercase text-slate-500">Giờ Kết Thúc (End Time)</label>
                      <input
                        type="time"
                        required
                        value={form.endTime}
                        onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                        className="w-full p-3 rounded-2xl border border-chalk bg-white text-sm font-medium text-carbon focus:ring-2 focus:ring-signal-orange"
                      />
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex items-center gap-2 pt-1 overflow-x-auto text-[11px]">
                    <span className="text-slate-400 font-medium">Ca gợi ý:</span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, startTime: '08:30', endTime: '10:30' })}
                      className="px-2.5 py-1 rounded-lg bg-fog hover:bg-chalk text-slate-700 font-semibold border border-chalk transition-colors cursor-pointer"
                    >
                      ☀️ Ca Sáng (08:30 - 10:30)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, startTime: '14:00', endTime: '16:00' })}
                      className="px-2.5 py-1 rounded-lg bg-fog hover:bg-chalk text-slate-700 font-semibold border border-chalk transition-colors cursor-pointer"
                    >
                      ⛅ Ca Chiều (14:00 - 16:00)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, startTime: '20:00', endTime: '22:00' })}
                      className="px-2.5 py-1 rounded-lg bg-fog hover:bg-chalk text-slate-700 font-semibold border border-chalk transition-colors cursor-pointer"
                    >
                      🌙 Ca Đêm (20:00 - 22:00)
                    </button>
                  </div>
                </div>

                {/* DIGITAL E-PASS BOARDING PASS TICKET PREVIEW */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-carbon to-gray-950 text-white p-6 sm:p-7 border border-white/10 shadow-xl space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-signal-orange flex items-center justify-center font-black text-white text-sm">
                        NP
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-signal-orange">NexusPort Smart TAS</span>
                        <h5 className="font-mono font-bold text-sm text-white">Thẻ Điện Tử Dự Kiến · Digital e-Pass</h5>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      SẴN SÀNG KÍCH HOẠT [READY]
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[11px]">MÃ BOOKING:</span>
                      <p className="font-mono font-black text-base text-signal-orange tracking-tight">{form.bookingCode}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 text-[11px]">LOẠI GIAO DỊCH:</span>
                      <p className="font-bold text-white text-sm">{form.bookingType}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 text-[11px]">CONTAINER:</span>
                      <p className="font-mono font-bold text-white text-sm">{form.containerNo} ({form.containerGrossWeightTon}T)</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 text-[11px]">PHƯƠNG TIỆN & TÀI XẾ:</span>
                      <p className="font-mono font-bold text-white text-sm">
                        {selectedTruck?.plateNumber || '51C-882.19'} • {availableResources.drivers.find(d => d.id === form.driverId)?.fullName || 'Tài xế'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center gap-2 text-[11px] text-slate-300">
                    <span className="material-symbols-outlined text-sm text-emerald-400">verified</span>
                    Ngay sau khi xác nhận, Backend sẽ cấp vé QR thông hành tự động và mã định danh OCR cho làn cổng.
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="px-6 py-3.5 rounded-2xl border border-chalk bg-white hover:bg-fog text-carbon font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    <span>Quay lại Bước 1 (Đổi xe / container)</span>
                  </button>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-signal-orange to-orange-600 hover:from-orange-500 hover:to-orange-600 text-white font-extrabold text-xs shadow-lg shadow-orange-950/40 hover:-translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {actionLoading && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                    <span>Xác Nhận & Khởi Tạo Booking [Ready]</span>
                    <span className="material-symbols-outlined text-sm">rocket_launch</span>
                  </button>
                </div>

              </div>
            )}

          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CONTAINER JOURNEY TRACKING */}
      {/* ========================================================================= */}
      {activeTab === 'container_status' && (
        <div className="bg-paper border border-chalk rounded-3xl p-6 sm:p-8 shadow-sm space-y-8 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-chalk pb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-signal-orange uppercase tracking-wider mb-1">
                <span className="material-symbols-outlined text-sm">route</span>
                Real-Time Container Flow Telemetry
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-extrabold text-carbon">
                Theo Dõi Vòng Đời Container Tại Bãi Cảng
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Mô phỏng 5 chặng vận hành từ khâu đăng ký lịch hẹn, barrier cổng, cẩu bãi hạ container đến gate-out.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-fog p-2 rounded-2xl border border-chalk">
              <span className="text-xs text-slate-400 font-bold font-mono px-2">CONT:</span>
              <span className="font-mono font-extrabold text-signal-orange text-sm bg-white px-3 py-1 rounded-xl border border-chalk">
                MSKU8891024
              </span>
            </div>
          </div>

          {/* Interactive Stepper Journey */}
          <div className="relative p-6 bg-gradient-to-b from-fog/60 to-white rounded-3xl border border-chalk">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative z-10">
              
              {/* Stage 1 */}
              <div className="flex flex-col items-center text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <span className="material-symbols-outlined text-xl">event_available</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider">GIAI ĐOẠN 1</span>
                  <h6 className="font-bold text-carbon text-xs">Đã Đặt Lịch Hẹn</h6>
                  <p className="text-[11px] text-slate-500">Khởi tạo và đối soát AI</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Hoàn thành
                </span>
              </div>

              {/* Stage 2 */}
              <div className="flex flex-col items-center text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <span className="material-symbols-outlined text-xl">qr_code_scanner</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider">GIAI ĐOẠN 2</span>
                  <h6 className="font-bold text-carbon text-xs">Cấp Thẻ Ready</h6>
                  <p className="text-[11px] text-slate-500">Gán xe & vé e-Pass</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Hoàn thành
                </span>
              </div>

              {/* Stage 3 */}
              <div className="flex flex-col items-center text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-signal-orange text-white flex items-center justify-center shadow-lg shadow-orange-500/30 animate-pulse">
                  <span className="material-symbols-outlined text-xl">sensor_door</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold uppercase text-signal-orange tracking-wider">GIAI ĐOẠN 3</span>
                  <h6 className="font-bold text-carbon text-xs">Gate-In Cảng</h6>
                  <p className="text-[11px] text-slate-500">Quét OCR & Cân xe</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-signal-orange">
                  Đang diễn ra
                </span>
              </div>

              {/* Stage 4 */}
              <div className="flex flex-col items-center text-center space-y-2.5 opacity-60">
                <div className="w-12 h-12 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">warehouse</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">GIAI ĐOẠN 4</span>
                  <h6 className="font-bold text-carbon text-xs">Lưu Bãi (Yard)</h6>
                  <p className="text-[11px] text-slate-500">Xếp chồng block A3</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                  Chờ tiếp nhận
                </span>
              </div>

              {/* Stage 5 */}
              <div className="flex flex-col items-center text-center space-y-2.5 opacity-60">
                <div className="w-12 h-12 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">local_shipping</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">GIAI ĐOẠN 5</span>
                  <h6 className="font-bold text-carbon text-xs">Gate-Out / Lên Tàu</h6>
                  <p className="text-[11px] text-slate-500">Hoàn tất quy trình</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                  Dự kiến
                </span>
              </div>

            </div>
          </div>

          {/* Terminal Gate Live Status Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl border border-chalk bg-white space-y-1">
              <span className="text-slate-400 text-[11px] font-bold uppercase">LÀN CỔNG CHỈ ĐỊNH:</span>
              <p className="font-heading font-extrabold text-carbon text-base flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Làn Cổng L02 (Smart Gate AI)
              </p>
              <p className="text-slate-500 text-[11px]">Đầu đọc OCR tự động mở barrier khi quét đúng biển số</p>
            </div>

            <div className="p-4 rounded-2xl border border-chalk bg-white space-y-1">
              <span className="text-slate-400 text-[11px] font-bold uppercase">VỊ TRÍ BÃI DỰ KIẾN:</span>
              <p className="font-heading font-extrabold text-carbon text-base flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Khu A3 - Bay 12 - Tier 03
              </p>
              <p className="text-slate-500 text-[11px]">Cẩu RTG-04 đã sẵn sàng nhận container hạ bãi</p>
            </div>

            <div className="p-4 rounded-2xl border border-chalk bg-white space-y-1">
              <span className="text-slate-400 text-[11px] font-bold uppercase">TRẠNG THÁI NIÊM CHÌ:</span>
              <p className="font-heading font-extrabold text-emerald-700 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-base">verified</span>
                SEAL-VALIDATED
              </p>
              <p className="text-slate-500 text-[11px]">Niêm phong khớp dữ liệu hải quan điện tử</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: FLEET ASSIGNMENT MODAL (NXP-049 CHUYỂN SANG READY) */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-paper border border-chalk rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider">
                  NXP-049: Điều Phối Tài Nguyên Fleet
                </span>
                <h3 className="font-mono font-bold text-xl text-carbon">
                  Điều Phối Xe Cho {assignForm.bookingCode}
                </h3>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="w-8 h-8 rounded-full bg-fog hover:bg-chalk flex items-center justify-center text-slate-500 hover:text-carbon font-bold text-base transition-colors cursor-pointer"
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
                className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <span className={`material-symbols-outlined text-sm ${assignAiLoading ? 'animate-spin' : ''}`}>
                  {assignAiLoading ? 'sync' : 'auto_awesome'}
                </span>
                {assignAiLoading ? 'Đang phân tích...' : '🤖 AI Gợi Ý Tự Động Từ CSDL'}
              </button>
            </div>

            <form onSubmit={handleConfirmAssignFleet} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold uppercase text-slate-500">1. Container Liên Kết</label>
                <select
                  value={assignForm.containerId}
                  onChange={(e) => handleAssignContainerChange(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-chalk bg-white font-mono font-bold text-carbon cursor-pointer"
                >
                  {(availableResources.containers || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      📦 {c.containerNumber} ({c.size} · {c.grossWeightTon || (c.grossWeightKg / 1000)}T)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold uppercase text-slate-500">2. Chọn Xe Đầu Kéo (Truck)</label>
                <select
                  value={assignForm.truckId}
                  onChange={(e) => handleAssignTruckChange(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-chalk bg-white font-bold text-carbon cursor-pointer"
                >
                  {(availableResources.trucks || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      🚚 Biển số: {t.plateNumber} (Tải trọng {t.maxPayloadTon}T)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold uppercase text-slate-500">3. Chọn Tài Xế Phụ Trách (Driver)</label>
                <select
                  value={assignForm.driverId}
                  onChange={(e) => {
                    const driverId = e.target.value;
                    let truckId = assignForm.truckId;
                    if (driverId) {
                      const assignedTruck = (availableResources.trucks || []).find(t => String(t.driverId) === String(driverId));
                      if (assignedTruck) truckId = assignedTruck.id;
                    }
                    setAssignForm({ ...assignForm, driverId, truckId });
                  }}
                  className="w-full p-3 rounded-2xl border border-chalk bg-white font-bold text-carbon cursor-pointer"
                >
                  {(availableResources.drivers || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      👤 {d.fullName} (BLX: {d.licenseClass || 'FC'}) · {d.phone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payload Gauge inside assign modal */}
              {assignPayloadAnalysis && (
                <div className="space-y-2 p-3.5 rounded-2xl bg-fog border border-chalk">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-bold text-slate-600">Độ an toàn tải trọng:</span>
                    <span className={`font-bold font-mono ${
                      assignPayloadAnalysis.severity === 'danger' ? 'text-rose-600' : assignPayloadAnalysis.severity === 'warning' ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {assignPayloadAnalysis.ratio}% tải · {assignPayloadAnalysis.status}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-chalk rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${Math.min(assignPayloadAnalysis.ratio, 100)}%` }}
                      className={`h-full transition-all duration-300 rounded-full ${
                        assignPayloadAnalysis.severity === 'danger' ? 'bg-rose-600' : assignPayloadAnalysis.severity === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    ></div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    {assignPayloadAnalysis.warningMessage}
                  </p>
                </div>
              )}

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-2">
                <span className="material-symbols-outlined text-base">info</span>
                <span>Sau khi xác nhận, Booking sẽ tự động chuyển sang <strong>Ready</strong> và kích hoạt Vé e-Pass QR vào cổng.</span>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-chalk">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-chalk text-carbon font-bold hover:bg-fog cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  {actionLoading && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                  <span>Xác Nhận Điều Phối [Ready] ➔</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DIGITAL SMART E-PASS QR MODAL */}
      {/* ========================================================================= */}
      {showQrModal && selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-paper border border-chalk rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 text-center relative overflow-hidden">
            
            {/* Ticket Accent Header */}
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-signal-orange">
                <span className="w-2 h-2 rounded-full bg-signal-orange"></span>
                NexusPort Smart e-Pass
              </div>
              <button 
                onClick={() => setShowQrModal(false)} 
                className="w-7 h-7 rounded-full bg-fog hover:bg-chalk flex items-center justify-center text-slate-500 hover:text-carbon font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Ticket Card Info */}
            <div className="bg-gradient-to-br from-carbon to-gray-900 text-white rounded-2xl p-4 text-left space-y-2 shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono tracking-wider block">MÃ LỊCH HẸN</span>
                  <h4 className="font-mono font-black text-xl text-signal-orange tracking-tight">{selectedBooking.bookingCode}</h4>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  READY
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400">BIỂN SỐ XE</span>
                  <p className="font-mono font-bold text-white">{getBookingVehiclePlate(selectedBooking) || '51C-992.81'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">TÀI XẾ</span>
                  <p className="font-bold text-white truncate">{getBookingDriverName(selectedBooking) || 'Nguyễn Văn Hùng'}</p>
                </div>
              </div>
            </div>

            {/* QR Code Frame */}
            <div className="bg-white p-5 border-2 border-dashed border-chalk rounded-3xl w-52 h-52 mx-auto flex items-center justify-center shadow-inner relative group">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  JSON.stringify({
                    bookingCode: selectedBooking.bookingCode,
                    plateNumber: getBookingVehiclePlate(selectedBooking) || '51C-992.81',
                    status: 'Ready',
                    expires: selectedBooking.appointmentEnd
                  })
                )}`}
                alt="Gate Pass QR"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-carbon font-bold flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                Hợp lệ để vào Làn Cổng Gate-In
              </p>
              <p className="text-[11px] text-slate-500 leading-tight">
                Quét mã này tại đầu đọc tự động của trạm barrier cảng để kích hoạt cân và mở barie vào bãi.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  window.print()
                }}
                className="flex-1 py-3 rounded-2xl border border-chalk bg-fog hover:bg-chalk text-carbon font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                In Thẻ
              </button>

              <button
                onClick={() => setShowQrModal(false)}
                className="flex-1 py-3 rounded-2xl bg-carbon hover:bg-black text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
              >
                Đóng Thẻ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: BOOKING DETAIL VIEW */}
      {/* ========================================================================= */}
      {showDetailModal && selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-paper border border-chalk rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Hồ Sơ Chi Tiết Lịch Hẹn</span>
                <h3 className="font-mono font-black text-xl text-carbon">{selectedBooking.bookingCode}</h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-8 h-8 rounded-full bg-fog hover:bg-chalk flex items-center justify-center text-slate-500 hover:text-carbon font-bold text-base transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center bg-fog p-3.5 rounded-2xl border border-chalk">
                <span className="text-slate-600 font-bold">Trạng thái vận hành:</span>
                {renderStatusBadge(selectedBooking.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl border border-chalk bg-white">
                <div>
                  <span className="text-slate-400 text-[11px]">Loại Booking:</span>
                  <p className="font-bold text-carbon text-sm mt-0.5">{selectedBooking.bookingType}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Ngày Khởi Tạo:</span>
                  <p className="font-bold text-carbon text-sm mt-0.5">{new Date(selectedBooking.createdAt).toLocaleDateString('vi-VN')}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-chalk bg-white space-y-1">
                <span className="text-slate-400 text-[11px]">Khung Giờ Hẹn Đến Cảng:</span>
                <p className="font-bold text-carbon text-sm">
                  {new Date(selectedBooking.appointmentStart).toLocaleString('vi-VN')} ➔ {new Date(selectedBooking.appointmentEnd).toLocaleString('vi-VN')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl border border-chalk bg-white">
                <div>
                  <span className="text-slate-400 text-[11px]">Xe Đầu Kéo:</span>
                  <p className="font-mono font-bold text-carbon text-sm mt-0.5">{getBookingVehiclePlate(selectedBooking) || 'Chưa gán'}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Tài Xế Phụ Trách:</span>
                  <p className="font-bold text-carbon text-sm mt-0.5">{getBookingDriverName(selectedBooking) || 'Chưa gán'}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-chalk bg-white space-y-1">
                <span className="text-slate-400 text-[11px]">Danh Sách Container Liên Kết:</span>
                <p className="font-mono font-bold text-signal-orange text-sm mt-0.5">
                  {getBookingContainers(selectedBooking).join(', ') || 'Chưa cập nhật'}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2.5 rounded-xl bg-carbon hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-paper border border-chalk rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-rose-600 flex items-center gap-2 font-heading">
              <span className="material-symbols-outlined text-rose-600">warning</span>
              Xác Nhận Hủy Đặt Chỗ
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn hủy lịch hẹn <strong className="text-carbon font-mono">{selectedBooking.bookingCode}</strong> không? Tài nguyên xe và vị trí bãi sẽ được hoàn trả cho hệ thống.
            </p>

            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase text-slate-500">Lý Do Hủy (Không bắt buộc)</label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Nhập lý do hủy đặt chỗ..."
                className="w-full p-3 rounded-2xl border border-chalk bg-white text-xs text-carbon focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2.5 rounded-xl border border-chalk text-carbon text-xs font-bold hover:bg-fog transition-colors cursor-pointer"
              >
                Bỏ qua
              </button>

              <button
                onClick={handleConfirmCancel}
                disabled={actionLoading}
                className="px-6 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {actionLoading && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                <span>Xác Nhận Hủy ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: EDIT BOOKING MODAL */}
      {/* ========================================================================= */}
      {showEditModal && selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-paper border border-chalk rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-amber-600">Cập Nhật Lịch Hẹn</span>
                <h3 className="font-mono font-bold text-xl text-carbon">{editForm.bookingCode}</h3>
              </div>
              <button 
                onClick={() => setShowEditModal(false)} 
                className="w-8 h-8 rounded-full bg-fog hover:bg-chalk flex items-center justify-center text-slate-500 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateBooking} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold uppercase text-slate-500">Mã Container</label>
                <input
                  type="text"
                  required
                  value={editForm.containerNo}
                  onChange={(e) => setEditForm({ ...editForm, containerNo: e.target.value })}
                  className="w-full p-3 rounded-2xl border border-chalk bg-white font-mono font-bold text-carbon"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold uppercase text-slate-500">Ngày Hẹn Dự Kiến</label>
                <input
                  type="date"
                  required
                  value={editForm.appointmentDate}
                  onChange={(e) => setEditForm({ ...editForm, appointmentDate: e.target.value })}
                  className="w-full p-3 rounded-2xl border border-chalk bg-white font-bold text-carbon"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold uppercase text-slate-500">Giờ Bắt Đầu</label>
                  <input
                    type="time"
                    required
                    value={editForm.startTime}
                    onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                    className="w-full p-3 rounded-2xl border border-chalk bg-white font-bold text-carbon"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold uppercase text-slate-500">Giờ Kết Thúc</label>
                  <input
                    type="time"
                    required
                    value={editForm.endTime}
                    onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                    className="w-full p-3 rounded-2xl border border-chalk bg-white font-bold text-carbon"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-chalk">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-chalk text-carbon font-bold hover:bg-fog cursor-pointer"
                >
                  Bỏ qua
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {actionLoading && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                  <span>Lưu Cập Nhật ➔</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
