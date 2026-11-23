import BookingFleetDetails from '../../components/Containers/BookingFleetDetails'
import { useSearchParams, useNavigate } from 'react-router-dom'
import React, { useState, useEffect, useMemo } from 'react'
import { bookingService } from '../../services/bookingService'
import driverService from '../../services/driverService'
import vehicleService from '../../services/vehicleService'
import { formatPlateNumber } from '../../utils/format'
import { manifestPortSyncService } from '../../services/manifestPortSyncService'
import { yardReservationStore } from '../../services/yardReservationStore'
import { calculatePortServiceTariff, computeAutoBookingTariff } from '../../utils/portStorageFee'
import { serviceOrdersApi } from '../../features/service-catalog/serviceOrdersApi'

const mapLocalPortBookings = (generated = [], activePaymentCache = {}) => {
  return (generated || []).map((p, idx) => {
    const voyClean = (p.voyageNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
    const isPaid = (p.bookingCode && activePaymentCache[p.bookingCode]?.status === 'Paid') ||
      (p.id && activePaymentCache[p.id]?.status === 'Paid') ||
      (p.containerId && activePaymentCache[p.containerId]?.status === 'Paid') ||
      (voyClean && activePaymentCache[voyClean]?.status === 'Paid') ||
      Boolean(p.portBillPaid) ||
      p.status === 'Ready' ||
      (p.portBill && (p.portBill.status === 'PAID' || p.portBill.status === 'Paid'))

    const opName = p.operation || (p.direction === 'IMPORT' ? 'Lấy container nhập' : 'Hạ container xuất')
    const defaultStart = new Date(Date.now() + (idx * 3600000)).toISOString()

    const orderFleet = manifestPortSyncService.getOrderFleet(p.containerId) ||
      manifestPortSyncService.getOrderFleet(p.bookingCode) ||
      manifestPortSyncService.getOrderFleet(p.id)

    const vPlate = orderFleet?.plate ||
      (p.licensePlate && !['Chưa gán xe', 'Chưa điều phối', '47AB-294.69', '43C-567.89'].includes(p.licensePlate)
        ? p.licensePlate
        : null)

    const vDriver = orderFleet?.driver ||
      (p.driverName && !['Chưa điều phối', 'TRẦN VĂN TÙNG', 'Nguyễn Văn Minh'].includes(p.driverName)
        ? p.driverName
        : null)

    const resolvedStartRaw = p.appointmentStart || p.eta || defaultStart
    const resolvedStartMs = Date.parse(resolvedStartRaw)
    const appointmentStartIso = Number.isFinite(resolvedStartMs) ? new Date(resolvedStartMs).toISOString() : defaultStart
    const appointmentEndIso = p.appointmentEnd || new Date((Number.isFinite(resolvedStartMs) ? resolvedStartMs : Date.now()) + 90 * 60000).toISOString()

    return {
      id: p.id,
      bookingCode: p.bookingCode || p.id,
      bookingType: p.bookingType || (p.direction === 'IMPORT' ? 'Pickup' : 'Dropoff'),
      operation: opName,
      containerNumbers: [p.containerId],
      containerIds: [p.containerId],
      containerType: p.containerType || '40HC',
      vehiclePlate: vPlate,
      driverName: vDriver,
      appointmentStart: appointmentStartIso,
      appointmentEnd: appointmentEndIso,
      status: isPaid ? 'Ready' : (p.status || 'Pending'),
      paymentStatus: isPaid ? 'Paid' : 'Unpaid',
      yardSlot: p.yardSlot || p.autoYardSlot?.fullLocation || p.autoYardSlot?.slotName || p.autoYardSlot?.posId,
      autoYardSlot: p.autoYardSlot,
      portBill: p.portBill,
      company: p.company,
      vesselName: p.vesselName,
      billOfLading: p.billOfLading,
      documents: (() => {
        const rawDocs = orderFleet?.documents || p.eportDocuments || p.documents || []
        return (Array.isArray(rawDocs) ? rawDocs : []).filter(
          d => d && !String(d.fileUrl || '').includes('pdfobject.com/pdf/sample.pdf')
        )
      })(),
      isFromPortSync: true,
      createdAt: p.createdAt || new Date().toISOString()
    }
  })
}

export default function BookingManagement() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const detailBookingId = searchParams.get('bookingId')
  const [activeTab, setActiveTab] = useState('my_bookings')

  const isFetchingRef = React.useRef(false)
  const debounceTimerRef = React.useRef(null)

  // Data States for My Bookings - khởi tạo dữ liệu ngay từ local/sync để hiển thị lập tức
  const [bookings, setBookings] = useState(() => {
    try {
      const generated = manifestPortSyncService.getGeneratedGateBookings() || []
      const initial = mapLocalPortBookings(generated)
      return initial.filter(b => b.paymentStatus === 'Paid' || ['Ready', 'CheckedIn', 'Completed'].includes(b.status))
    } catch {
      return []
    }
  })
  const [totalCount, setTotalCount] = useState(() => {
    try {
      const generated = manifestPortSyncService.getGeneratedGateBookings() || []
      return generated.length
    } catch {
      return 0
    }
  })
  const [loading, setLoading] = useState(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize] = useState(10)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Ready')
  const [typeFilter, setTypeFilter] = useState('All')

  // Available Fleet & Yard Resources (Loaded 100% from Database)
  const [availableResources, setAvailableResources] = useState({ containers: [], trucks: [], drivers: [] })
  const [resourcesLoading, setResourcesLoading] = useState(false)

  // Danh sách các container từ Bản khai tàu đã được Cảng phê duyệt chuyển về Công ty Vận tải để gán Xe & Tài xế gửi lại cho Cảng
  const [manifestTransportBookings, setManifestTransportBookings] = useState(() => {
    try {
      return manifestPortSyncService.getGeneratedGateBookings()
    } catch {
      return []
    }
  })

  const isRefreshingManifestRef = React.useRef(false)
  useEffect(() => {
    const refreshManifestTransport = (e) => {
      if (isRefreshingManifestRef.current) return
      isRefreshingManifestRef.current = true
      try {
        setManifestTransportBookings(manifestPortSyncService.getGeneratedGateBookings())
        if (e?.detail?.type === 'REMOTE_FETCH_SYNC' || e?.detail?.type === 'REJECTED_FLEET_UNASSIGNED') {
          return
        }
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = setTimeout(() => {
          fetchBookings(true)
        }, 1500)
        if (e?.detail?.type === 'PORT_BILL_SENT' && e?.detail?.bill) {
          const bill = e.detail.bill
          setToast({
            message: `🧾 Cảng Tiên Sa đã duyệt đơn & gửi Bill ${bill.billNumber} (${bill.totalFormatted}) cho Container ${bill.containerId}!`,
            type: 'success'
          })
          setTimeout(() => setToast(null), 5000)
        }
      } catch { }
      finally {
        isRefreshingManifestRef.current = false
      }
    }
    window.addEventListener('storage', refreshManifestTransport)
    window.addEventListener('nexusport:manifest_synced', refreshManifestTransport)
    window.addEventListener('nexusport_manifest_synced', refreshManifestTransport)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      window.removeEventListener('storage', refreshManifestTransport)
      window.removeEventListener('nexusport:manifest_synced', refreshManifestTransport)
      window.removeEventListener('nexusport_manifest_synced', refreshManifestTransport)
    }
  }, [])

  // Local persistent cache để lưu thông tin phương tiện, tài xế & container cho booking
  const [fleetCache, setFleetCache] = useState(() => {
    try {
      const saved = null
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
        /* Server remains the source of booking facts. */
      } catch { }
      return next
    })
  }

  // Local persistent cache để lưu thông tin thanh toán (Payment Status, cước phí, mã giao dịch)
  const [paymentCache, setPaymentCache] = useState(() => {
    try {
      const saved = null
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const updatePaymentCache = (bookingCode, bookingId, paymentData) => {
    setPaymentCache(prev => {
      const next = { ...prev }
      if (bookingCode) next[bookingCode] = paymentData
      if (bookingId) next[bookingId] = paymentData
      try {
        /* Payment facts are read from the server. */
      } catch (err) {
        console.warn('Failed to save payment cache', err)
      }
      return next
    })
  }

  // Helper tính cước phí dịch vụ cảng TOS (Port Tariff Calculation - 2 Trường hợp: Xuất Khẩu & Nhập Khẩu)
  const getBookingPaymentInfo = (booking) => {
    if (!booking) {
      const defaultTariff = calculatePortServiceTariff({ direction: 'EXPORT', size: 20 })
      return {
        status: 'Unpaid',
        tariff: defaultTariff,
        baseHandling: 450000,
        weighFee: 50000,
        securityFee: 40000,
        subtotal: defaultTariff.subtotal,
        vat: defaultTariff.vat,
        amount: defaultTariff.total,
        paidAt: null,
        transactionId: null,
        method: 'VietQR (Napas 247)'
      }
    }

    // 1. Kiểm tra cache đã lưu (theo bookingCode hoặc theo id)
    const code = booking.bookingCode || booking.id
    if (booking.bookingCode && paymentCache[booking.bookingCode]) {
      return paymentCache[booking.bookingCode]
    }
    if (booking.id && paymentCache[booking.id]) {
      return paymentCache[booking.id]
    }
    if (code && paymentCache[code]) {
      return paymentCache[code]
    }

    const contNo =
      (booking.containerNumbers && booking.containerNumbers[0]) ||
      booking.containerId ||
      booking.containerNo

    // 1b. Kiểm tra Bill chính thức do Cảng Tiên Sa gửi sang sau khi duyệt (NEXUSPORT_PORT_BILLS)
    let matchedPortBill = booking.portBill || null
    try {
      const storedBills = JSON.parse(localStorage.getItem('NEXUSPORT_PORT_BILLS') || '{}')
      matchedPortBill = matchedPortBill || storedBills[booking.bookingCode] || storedBills[booking.id] || (contNo ? storedBills[contNo] : null) || null
    } catch { }

    const mnfInfo = contNo ? manifestPortSyncService.getManifestForContainer(contNo) : null
    const tariff = matchedPortBill?.tariff || computeAutoBookingTariff(
      {
        ...booking,
        containerId: contNo || booking.id,
      },
      mnfInfo
    )

    const statusLower = (booking.status || '').toLowerCase()
    const paymentStatusLower = (booking.paymentStatus || '').toLowerCase()
    const isSystemPaid = paymentStatusLower === 'paid' ||
      statusLower === 'ready' ||
      statusLower === 'checkedin' ||
      statusLower === 'completed'

    return {
      status: isSystemPaid ? 'Paid' : 'Unpaid',
      fromPortBill: !!matchedPortBill,
      billNumber: matchedPortBill?.billNumber || null,
      yardSlot: matchedPortBill?.yardSlot || null,
      billApprovedAt: matchedPortBill?.approvedAt || null,
      tariff,
      baseHandling: tariff?.items?.[0]?.amount || 450000,
      weighFee: tariff?.items?.[1]?.amount || 50000,
      securityFee: tariff?.items?.[2]?.amount || 40000,
      subtotal: matchedPortBill?.subtotal ?? (tariff?.subtotal || 540000),
      vat: matchedPortBill?.vat ?? (tariff?.vat || 43200),
      amount: matchedPortBill?.total ?? (tariff?.total || 583200),
      paidAt: isSystemPaid ? (booking.paidAt || booking.createdAt || new Date().toISOString()) : null,
      transactionId: isSystemPaid ? (booking.transactionRef || `TXN-NP-${code?.slice(-8) || '88391023'}`) : null,
      method: 'VietQR (Napas 247)'
    }
  }

  // Danh sách ID container đã có trong booking đang hoạt động

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


  // NXP Payment & TOS Port Charges Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentBooking, setPaymentBooking] = useState(null)
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [copiedPaymentField, setCopiedPaymentField] = useState(null)

  // NXP-049: State phân tích tải trọng cho Modal Điều phối
  const [assignPayloadAnalysis, setAssignPayloadAnalysis] = useState(null)
  const [assignAiLoading, setAssignAiLoading] = useState(false)

  useEffect(() => {
    if (!detailBookingId) return undefined
    let current = true
    setActiveTab('my_bookings')
    setShowDetailModal(false)
    bookingService.getBookingById(detailBookingId).then(booking => {
      if (!current) return
      setSelectedBooking(booking)
      setShowDetailModal(true)
    }).catch(error => {
      if (current) setToast({ message: error.response?.data?.Message || error.message || 'Không thể tải booking.', type: 'error' })
    })
    return () => { current = false }
  }, [detailBookingId])

  const closeBookingDetail = () => {
    setShowDetailModal(false)
    if (detailBookingId) setSearchParams(params => {
      const next = new URLSearchParams(params)
      next.delete('bookingId')
      return next
    }, { replace: true })
  }

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

      }
    } catch (err) {
      console.error('Lỗi tải tài nguyên từ Database:', err)
    } finally {
      setResourcesLoading(false)
    }
  }

  // Helper lấy biển số xe chính xác cho từng booking
  const getBookingVehiclePlate = (bk) => {
    if (!bk) return null
    const conts = getBookingContainers(bk)
    const contNo = conts[0]
    const orderFleet = manifestPortSyncService.getOrderFleet(contNo) ||
      manifestPortSyncService.getOrderFleet(bk.bookingCode) ||
      manifestPortSyncService.getOrderFleet(bk.id)
    if (orderFleet?.plate) return formatPlateNumber(orderFleet.plate)

    const isFakePlate = p => !p || ['Chưa gán xe', 'Chưa gán', 'Chưa điều phối', '47AB-294.69', '43C-567.89'].includes(p)
    if (!isFakePlate(bk.vehiclePlate)) return formatPlateNumber(bk.vehiclePlate)
    if (!isFakePlate(bk.licensePlate)) return formatPlateNumber(bk.licensePlate)
    if (!isFakePlate(bk.suggestedPlate)) return formatPlateNumber(bk.suggestedPlate)
    if (bk.vehicleDetails?.plateNumber) return formatPlateNumber(bk.vehicleDetails.plateNumber)
    if (bk.vehicleDetails?.licensePlate) return formatPlateNumber(bk.vehicleDetails.licensePlate)

    const cached = fleetCache[bk.bookingCode] || fleetCache[bk.id]
    if (cached?.vehiclePlate && !isFakePlate(cached.vehiclePlate)) return formatPlateNumber(cached.vehiclePlate)
    if (cached?.licensePlate && !isFakePlate(cached.licensePlate)) return formatPlateNumber(cached.licensePlate)

    const truck = (availableResources.trucks || []).find(t => t.id === bk.truckId || t.id === bk.vehicleId)
    if (truck?.plateNumber) return formatPlateNumber(truck.plateNumber)

    const matched = manifestTransportBookings.find(m =>
      (m.id && m.id === bk.id) ||
      (m.bookingCode && m.bookingCode === bk.bookingCode) ||
      (contNo && m.containerId === contNo)
    )
    if (!isFakePlate(matched?.licensePlate)) return formatPlateNumber(matched.licensePlate)
    if (!isFakePlate(matched?.suggestedPlate)) return formatPlateNumber(matched.suggestedPlate)
    if (!isFakePlate(matched?.vehiclePlate)) return formatPlateNumber(matched.vehiclePlate)

    return null
  }

  // Helper lấy tên tài xế chính xác cho từng booking
  const getBookingDriverName = (bk) => {
    if (!bk) return null
    const conts = getBookingContainers(bk)
    const contNo = conts[0]
    const orderFleet = manifestPortSyncService.getOrderFleet(contNo) ||
      manifestPortSyncService.getOrderFleet(bk.bookingCode) ||
      manifestPortSyncService.getOrderFleet(bk.id)
    if (orderFleet?.driver) return orderFleet.driver

    const isFakeDriver = d => !d || ['Chưa điều phối', 'Chưa có tài xế', 'TRẦN VĂN TÙNG', 'Nguyễn Văn Minh'].includes(d)
    if (!isFakeDriver(bk.driverName)) return bk.driverName
    if (!isFakeDriver(bk.suggestedDriver)) return bk.suggestedDriver
    if (bk.driverDetails?.fullName) return bk.driverDetails.fullName
    if (bk.driverDetails?.name) return bk.driverDetails.name

    const cached = fleetCache[bk.bookingCode] || fleetCache[bk.id]
    if (cached?.driverName && !isFakeDriver(cached.driverName)) return cached.driverName

    const driver = (availableResources.drivers || []).find(d => d.id === bk.driverId)
    if (driver?.fullName) return driver.fullName

    const matched = manifestTransportBookings.find(m =>
      (m.id && m.id === bk.id) ||
      (m.bookingCode && m.bookingCode === bk.bookingCode) ||
      (contNo && m.containerId === contNo)
    )
    if (!isFakeDriver(matched?.driverName)) return matched.driverName
    if (!isFakeDriver(matched?.suggestedDriver)) return matched.suggestedDriver

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

  // Helper lấy vị trí container trên bãi cảng Tiên Sa (TOS Smart Yard)
  const getBookingYardSlot = (bk) => {
    if (!bk) return null

    const conts = getBookingContainers(bk)
    const contNo = (conts[0] || bk.containerNumber || bk.containerId || '').trim().toUpperCase()
    const bookNo = (bk.bookingCode || bk.id || '').trim().toUpperCase()

    // 1. ƯU TIÊN SỐ 1: Vị trí thực tế mới nhất từ yardReservationStore (Khi điều độ viên đổi vị trí bãi)
    try {
      if (contNo || bookNo) {
        const resv = (contNo ? yardReservationStore.getReservation(contNo) : null) || (bookNo ? yardReservationStore.getReservation(bookNo) : null)
        if (resv && (resv.bay || resv.posId)) {
          const block = resv.blockCode || resv.block || 'D01'
          const bayNum = Number(resv.bay) || 1
          const bayStr = String(bayNum).padStart(2, '0')
          const rowNum = Number(resv.row) || 1
          const rowStr = String(rowNum).padStart(2, '0')
          const tierNum = Number(resv.tier) || 1
          return {
            short: `Khu ${block} · Bay ${bayStr} (R${rowStr}-T${tierNum})`,
            detail: `Block ${block} - Bay ${bayStr} (${rowNum}-${tierNum})`,
            zoneName: resv.zoneName || `Khu ${block[0]} Bãi Cảng Tiên Sa`,
            slotCode: resv.slotCode || `${block}.${bayStr}.${rowStr}.${tierNum}`
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc yardReservationStore:', e)
    }

    // 2. ƯU TIÊN SỐ 2: Vị trí cập nhật từ Lịch tài xế Transport (orderFleet)
    try {
      const fleet = (contNo ? manifestPortSyncService.getOrderFleet(contNo) : null) || (bookNo ? manifestPortSyncService.getOrderFleet(bookNo) : null)
      if (fleet?.yardSlot || (fleet?.blockCode && fleet?.bay)) {
        const block = fleet.blockCode || 'D01'
        const bayNum = Number(fleet.bay) || 1
        const bayStr = String(bayNum).padStart(2, '0')
        const rowNum = Number(fleet.row) || 1
        const rowStr = String(rowNum).padStart(2, '0')
        const tierNum = Number(fleet.tier) || 1
        return {
          short: fleet.yardSlot?.includes('·') ? fleet.yardSlot : `Khu ${block} · Bay ${bayStr} (R${rowStr}-T${tierNum})`,
          detail: `Block ${block} - Bay ${bayStr} (${rowNum}-${tierNum})`,
          zoneName: `Khu ${block[0]} Bãi Cảng Tiên Sa`
        }
      }
    } catch {}

    // 3. Từ NEXUSPORT_PORT_BILLS
    try {
      const storedBills = JSON.parse(localStorage.getItem('NEXUSPORT_PORT_BILLS') || '{}')
      const bill = storedBills[bk.bookingCode] || storedBills[bk.id] || (contNo ? storedBills[contNo] : null)
      if (bill?.yardSlot) {
        return {
          short: bill.yardSlot,
          detail: bill.yardSlot,
          zoneName: 'Khu Bãi Container Tiên Sa'
        }
      }
    } catch { }

    // 4. Từ autoYardSlot có sẵn trên booking (nếu chưa có điều chỉnh mới)
    if (bk.autoYardSlot?.slotName || bk.autoYardSlot?.fullLocation) {
      return {
        short: bk.autoYardSlot.slotName || bk.autoYardSlot.posId || `Block ${bk.autoYardSlot.blockCode} · ${bk.autoYardSlot.bayDisplay || 'Bay 01'}`,
        detail: bk.autoYardSlot.fullLocation || `Block ${bk.autoYardSlot.blockCode} · ${bk.autoYardSlot.bayDisplay || 'Bay 01'} · T${bk.autoYardSlot.tier || 1}-R${bk.autoYardSlot.row || 1}`,
        zoneName: bk.autoYardSlot.zoneName || 'Khu Bãi Container Tiên Sa'
      }
    }

    // 5. Từ yardSlot
    if (bk.yardSlot) {
      return {
        short: bk.yardSlot,
        detail: bk.yardSlot,
        zoneName: 'Khu Bãi Container Tiên Sa'
      }
    }

    // 5. Từ manifestTransportBookings
    try {
      const matched = manifestTransportBookings.find(m =>
        (m.id && m.id === bk.id) ||
        (m.bookingCode && m.bookingCode === bk.bookingCode) ||
        (contNo && m.containerId === contNo)
      )
      if (matched?.autoYardSlot) {
        return {
          short: matched.autoYardSlot.slotName || matched.autoYardSlot.posId || `Block ${matched.autoYardSlot.blockCode} · ${matched.autoYardSlot.bayDisplay || 'Bay 01'}`,
          detail: matched.autoYardSlot.fullLocation || `Block ${matched.autoYardSlot.blockCode} · ${matched.autoYardSlot.bayDisplay || 'Bay 01'}`,
          zoneName: matched.autoYardSlot.zoneName || 'Khu Bãi Container Tiên Sa'
        }
      }
    } catch { }

    // 6. Phân bổ vị trí bãi thực tế theo flow nếu đã được duyệt / sẵn sàng
    if (bk.status === 'Ready' || bk.status === 'Approved' || bk.status === 'CheckedIn' || bk.status === 'Completed' || (bk.paymentStatus || '').toLowerCase() === 'paid') {
      const isImport = (bk.bookingType || bk.operation || '').toLowerCase().includes('pickup') || (bk.bookingType || bk.operation || '').toLowerCase().includes('import') || (bk.bookingType || bk.operation || '').toLowerCase().includes('nhập')
      const isReefer = bk.isReeferPowerRequired || (bk.containerType || '').includes('RF')
      const block = isReefer ? 'D01' : (isImport ? 'B01' : 'A01')
      return {
        short: `Khu ${block} · Bay 01 (R01-T1)`,
        detail: `Block ${block} · Bay 01 · Row 01 · Tier 1`,
        zoneName: isReefer ? 'Khu D · Bãi Container Lạnh (Reefer Zone)' : (isImport ? 'Khu B · Bãi Cont Nhập Khẩu (Bãi Container 1)' : 'Khu A · Bãi Cont Xuất Khẩu (Sau cầu 4–5)')
      }
    }

    return null
  }

  // 🤖 GỌI BACKEND XỬ LÝ AI TỰ ĐỘNG PHỐI XE & TÀI XẾ TỐI ƯU TỪ CSDL VÀ ĐỒNG BỘ TỪ CẢNG
  const fetchBookings = async (isBackground = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    if (!isBackground && bookings.length === 0) {
      setLoading(true)
    }
    try {
      const params = {
        pageNumber,
        pageSize,

        search: searchTerm.trim() || undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        bookingType: typeFilter !== 'All' ? typeFilter : undefined
      }

      const res = await bookingService.getBookings(params).catch(() => ({ items: [], totalCount: 0 }))
      let activePaymentCache = {}
      try {
        const storedBills = JSON.parse(localStorage.getItem('NEXUSPORT_PORT_BILLS') || '{}')
        Object.entries(storedBills).forEach(([k, bill]) => {
          if (bill.status === 'PAID' || bill.paid || bill.status === 'Paid') {
            activePaymentCache[k] = { status: 'Paid' }
          }
        })
      } catch { }

      // Đọc các đơn dịch vụ ePort từ Database API nhẹ nhàng (chỉ 1 request list, không gọi chi tiết lặp lại)
      try {
        const eportRes = await serviceOrdersApi.list({ pageSize: 20 }).catch(() => ({ items: [] }))
        const allEportItems = eportRes?.items || []
        for (const orderToSync of allEportItems) {
          try {
            manifestPortSyncService.saveAllOrderFleets(orderToSync)
          } catch {}

          if (['PAID', 'SUCCEEDED'].includes(String(orderToSync?.paymentStatus || '').toUpperCase())) {
            if (orderToSync.id) activePaymentCache[orderToSync.id] = { status: 'Paid' }
            if (orderToSync.number) activePaymentCache[orderToSync.number] = { status: 'Paid' }
            if (orderToSync.sourceLabel) activePaymentCache[orderToSync.sourceLabel] = { status: 'Paid' }
            const voyMatch = String(orderToSync.sourceLabel || '').match(/[A-Z]{2}-?\d{4}[A-Z]?/i)
            if (voyMatch) activePaymentCache[voyMatch[0].toUpperCase()] = { status: 'Paid' }
            const contMatch = String(orderToSync.sourceLabel || '').match(/[A-Z]{4}\d{7}/g)
            if (contMatch) contMatch.forEach(c => { activePaymentCache[c.toUpperCase()] = { status: 'Paid' } })
            ;(orderToSync.containers || []).forEach(c => {
              const cNo = String(c.containerNumber || c || '').toUpperCase()
              if (cNo) activePaymentCache[cNo] = { status: 'Paid' }
            })
          }
        }
      } catch (e) {}

      const apiItems = res.items || []

      // Lấy danh sách booking đồng bộ từ Cảng (e-Manifest / Gate Booking đã phân bổ cho công ty vận tải)
      let portItems = []
      try {
        const generated = manifestPortSyncService.getGeneratedGateBookings() || []
        portItems = mapLocalPortBookings(generated, activePaymentCache)
      } catch (err) {
        console.warn('Lỗi đồng bộ danh sách booking từ cảng:', err)
      }

      // Merge: Kết hợp danh sách từ DB API và danh sách từ Cảng (không trùng bookingCode hoặc containerNumber)
      const existingCodes = new Set(apiItems.map(b => (b.bookingCode || '').toUpperCase()))
      const existingConts = new Set(apiItems.flatMap(b => getBookingContainers(b).map(c => c.toUpperCase())))

      const newPortBookings = portItems.filter(p => {
        const code = (p.bookingCode || '').toUpperCase()
        const cont = (p.containerNumbers[0] || '').toUpperCase()
        return !existingCodes.has(code) && !existingConts.has(cont)
      })

      let allCombined = [...newPortBookings, ...apiItems]

      // Áp dụng bộ lọc tìm kiếm & trạng thái
      if (searchTerm.trim()) {
        const s = searchTerm.trim().toLowerCase()
        allCombined = allCombined.filter(b =>
          (b.bookingCode || '').toLowerCase().includes(s) ||
          getBookingContainers(b).some(c => c.toLowerCase().includes(s)) ||
          (b.vehiclePlate || '').toLowerCase().includes(s) ||
          (b.driverName || '').toLowerCase().includes(s)
        )
      }
      if (typeFilter !== 'All') {
        allCombined = allCombined.filter(b => b.bookingType === typeFilter)
      }

      const enriched = allCombined.map(b => {
        const isPaid = (b.bookingCode && activePaymentCache[b.bookingCode]?.status === 'Paid') ||
          (b.id && activePaymentCache[b.id]?.status === 'Paid') ||
          (b.paymentStatus || '').toLowerCase() === 'paid' ||
          Boolean(b.portBillPaid) ||
          b.status === 'Ready' ||
          b.status === 'CheckedIn' ||
          b.status === 'Completed' ||
          (b.portBill && (b.portBill.status === 'PAID' || b.portBill.status === 'Paid'))
        return {
          ...b,
          paymentStatus: isPaid ? 'Paid' : (b.paymentStatus || 'Unpaid'),
          status: isPaid && (b.status === 'Approved' || b.status === 'Pending') ? 'Ready' : b.status
        }
      })

      // Xử lý bộ lọc trạng thái: tab "Tất cả" hiển thị toàn bộ hồ sơ; tab "Sẵn sàng" hiển thị đơn đã thanh toán/sẵn sàng
      const isReady = b => b.paymentStatus === 'Paid' || ['Ready', 'CheckedIn', 'Completed'].includes(b.status)
      const isCanceled = b => ['Canceled', 'Cancelled'].includes(String(b.status || '').toLowerCase().replace(/^./, c => c.toUpperCase()))
      const selected = statusFilter === 'Ready' ? enriched.filter(isReady)
        : statusFilter === 'Canceled' ? enriched.filter(isCanceled)
          : enriched
      selected.sort((a, b) => {
        if (statusFilter === 'All' && isReady(a) !== isReady(b)) return isReady(a) ? -1 : 1
        const timeA = Date.parse(a.appointmentStart || a.createdAt || '')
        const timeB = Date.parse(b.appointmentStart || b.createdAt || '')
        return (Number.isFinite(timeA) ? timeA : Number.MAX_SAFE_INTEGER)
          - (Number.isFinite(timeB) ? timeB : Number.MAX_SAFE_INTEGER)
      })
      setBookings(selected)
      setTotalCount(selected.length)
    } catch (err) {
      console.error('Lỗi tải danh sách booking:', err)
    } finally {
      setLoading(false)
      isFetchingRef.current = false
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

  // Hàm chuyển đổi tất cả thông báo lỗi nghiệp vụ cảng sang 100% Tiếng Việt

  const triggerAssignAiMatch = async () => {
    setAssignAiLoading(true)
    try {
      const rec = await bookingService.getSelectionRecommendation({ bookingId: assignForm.bookingId, containerId: assignForm.containerId })
      if (rec) {
        setAssignForm(prev => ({
          ...prev,
          truckId: rec.recommendedTruckId || prev.truckId,
          driverId: rec.recommendedDriverId || prev.driverId
        }))
        setAssignPayloadAnalysis({
          grossWeightTon: rec.containerGrossWeightTon,
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
        truckId: assignForm.truckId,
        customGrossWeightTon: assignPayloadAnalysis?.grossWeightTon
      })
      if (evalRes) {
        setAssignPayloadAnalysis({
          grossWeightTon: evalRes.containerGrossWeightTon,
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
        truckId,
        customGrossWeightTon: assignPayloadAnalysis?.grossWeightTon
      })
      if (evalRes) {
        setAssignPayloadAnalysis({
          grossWeightTon: evalRes.containerGrossWeightTon,
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
        driverName: selectedDriverObj?.fullName || '',
        truckId: assignForm.truckId,
        vehiclePlate: selectedTruckObj?.plateNumber || '',
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

      try {
        const contNo = selectedContObj?.containerNumber || assignForm.containerNo || ''
        manifestPortSyncService.recordTransportSubmissionAlert({
          id: assignForm.bookingCode || assignForm.bookingId,
          containerId: contNo || assignForm.bookingCode,
          company: 'Công ty Vận tải (Carrier)',
          licensePlate: selectedTruckObj?.plateNumber || 'Đã gán xe',
          driverName: selectedDriverObj?.fullName || 'Đã gán tài xế',
          operation: 'TransportSubmit',
          billOfLading: '',
          submittedAt: new Date().toLocaleString('vi-VN'),
        })
        window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', {
          detail: {
            type: 'TRANSPORT_SUBMITTED',
            item: {
              id: assignForm.bookingCode || assignForm.bookingId,
              containerId: contNo || assignForm.bookingCode,
              company: 'Công ty Vận tải (Carrier)',
              licensePlate: selectedTruckObj?.plateNumber || 'Đã gán xe',
              driverName: selectedDriverObj?.fullName || 'Đã gán tài xế',
            }
          }
        }))
        window.dispatchEvent(new Event('storage'))
      } catch { }

      showNotification(`✨ Đã điều phối Xe & Tài xế cho Booking ${assignForm.bookingCode}! Đã gửi thông báo kiểm tra khớp sang Cảng.`, 'success')
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

  const openBookingDetail = async (bk) => {
    try {
      setSelectedBooking(bk)
      setShowDetailModal(true)
      if (bk.id && !bk.isFromPortSync) {
        const fresh = await bookingService.getBookingById(bk.id).catch(() => null)
        if (fresh) {
          setSelectedBooking(prev => ({
            ...prev,
            ...fresh,
            autoYardSlot: fresh.autoYardSlot || bk.autoYardSlot,
            yardSlot: fresh.yardSlot || bk.yardSlot,
            portBill: fresh.portBill || bk.portBill
          }))
        }
      }
    } catch {
      setSelectedBooking(bk)
      setShowDetailModal(true)
    }
  }

  const handleVerifyDocument = async (bookingId, documentId) => {
    setActionLoading(true)
    try {
      await bookingService.verifyDocument(bookingId, documentId, {
        isApproved: true
      })
      showNotification('Đã duyệt và xác thực chứng từ thành công!')
      const fresh = await bookingService.getBookingById(bookingId)
      if (fresh) {
        setSelectedBooking(fresh)
        setBookings(prev => prev.map(b => b.id === bookingId ? fresh : b))
      }
    } catch (err) {
      showNotification('Lỗi khi duyệt chứng từ: ' + (err.response?.data?.message || err.message), 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateOperationStatus = async (bookingId, operationId, newStatus) => {
    setActionLoading(true)
    try {
      await bookingService.updateOperationStatus(bookingId, operationId, { status: newStatus })
      showNotification(`Đã chuyển trạng thái nghiệp vụ sang: ${newStatus}`)
      const fresh = await bookingService.getBookingById(bookingId)
      if (fresh) {
        setSelectedBooking(fresh)
        setBookings(prev => prev.map(b => b.id === bookingId ? fresh : b))
      }
    } catch (err) {
      showNotification('Lỗi cập nhật nghiệp vụ: ' + (err.response?.data?.message || err.message), 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Xử lý mở Modal Thanh Toán & Sao Chép thông tin
  const openPaymentModal = async (booking) => {
    if (!booking) return
    setPaymentBooking(booking)
    setShowPaymentModal(true)

    // Đồng bộ thông tin cước phí và hóa đơn từ Backend CSDL nếu có ID
    if (booking.id) {
      try {
        const apiInfo = await bookingService.getPaymentInfo(booking.id)
        if (apiInfo) {
          updatePaymentCache(booking.bookingCode || booking.id, {
            status: apiInfo.paymentStatus || 'Unpaid',
            baseHandling: apiInfo.handlingFee || 450000,
            weighFee: apiInfo.weighingFee || 50000,
            securityFee: apiInfo.infrastructureFee || 40000,
            subtotal: apiInfo.subtotal || 540000,
            vat: apiInfo.taxAmount || 43200,
            amount: apiInfo.totalAmount || 583200,
            paidAt: apiInfo.paidAt,
            transactionId: apiInfo.transactionRef,
            invoiceNo: apiInfo.invoiceNo,
            method: apiInfo.paymentMethod || 'VietQR (Napas 247)'
          })
        }
      } catch (err) {
        console.warn('Backend payment info sync fallback:', err?.message)
      }
    }
  }

  const handleCopyPaymentInfo = (text, fieldName) => {
    navigator.clipboard?.writeText(text)
    setCopiedPaymentField(fieldName)
    setTimeout(() => setCopiedPaymentField(null), 2500)
  }

  // Xác nhận đã thanh toán VietQR (đồng bộ qua Backend API CSDL & Napas 24/7)
  const handleConfirmPayment = async () => {
    if (!paymentBooking) return
    setPaymentProcessing(true)
    try {
      const code = paymentBooking.bookingCode || paymentBooking.id
      const currentInfo = getBookingPaymentInfo(paymentBooking)
      const txnId = `TXN-NP-${Date.now().toString().slice(-8)}`
      const paidDate = new Date().toISOString()

      // Gửi yêu cầu thanh toán tới C# Backend API (lưu vào CSDL invoices & payments)
      let backendTxn = txnId
      let invoiceNo = `INV-NP-${code}`
      try {
        const res = await bookingService.processPayment(paymentBooking.id, {
          method: 'vietqr',
          transactionRef: txnId,
          amount: currentInfo.amount
        })
        if (res) {
          if (res.transactionRef) backendTxn = res.transactionRef
          if (res.invoiceNo) invoiceNo = res.invoiceNo
        }
      } catch (err) {
        console.warn('Backend payment processing fallback:', err?.message)
      }

      const newPaymentData = {
        ...currentInfo,
        status: 'Paid',
        paidAt: paidDate,
        transactionId: backendTxn,
        invoiceNo: invoiceNo,
        method: 'VietQR (Napas 247)'
      }

      // Lưu trực tiếp vào localStorage đồng thời cập nhật cache
      let rawCache = {}
      try {
        rawCache = {}
      } catch { }
      if (paymentBooking.bookingCode) rawCache[paymentBooking.bookingCode] = newPaymentData
      if (paymentBooking.id) rawCache[paymentBooking.id] = newPaymentData
      if (code) rawCache[code] = newPaymentData
      try {
        /* Read payment state from the API. */
      } catch { }

      updatePaymentCache(paymentBooking.bookingCode, paymentBooking.id, newPaymentData)

      try {
        await manifestPortSyncService.updateGeneratedGateBookingStatus(code, {
          status: 'Ready',
          portBillPaid: true,
          paymentStatus: 'Paid',
          paidAt: paidDate,
        })
      } catch (syncErr) {
        console.warn('Sync ready status to manifest warning:', syncErr)
      }

      // Cập nhật booking trong state danh sách:
      // Nếu booking đang ở Approved hoặc Pending thì chuyển sang Ready (đủ điều kiện để tài xế báo đã đến cổng và điều độ gọi xe)
      setBookings(prev => prev.map(b => {
        if ((b.bookingCode && b.bookingCode === code) || b.id === paymentBooking.id) {
          return {
            ...b,
            paymentStatus: 'Paid',
            status: (b.status === 'Approved' || b.status === 'Pending') ? 'Ready' : b.status
          }
        }
        return b
      }))

      if (selectedBooking && ((selectedBooking.bookingCode === code) || selectedBooking.id === paymentBooking.id)) {
        setSelectedBooking(prev => ({
          ...prev,
          paymentStatus: 'Paid',
          status: (prev.status === 'Approved' || prev.status === 'Pending') ? 'Ready' : prev.status
        }))
      }

      // Cập nhật paymentBooking đang mở trong modal để hiển thị ngay biên lai
      setPaymentBooking(prev => ({
        ...prev,
        paymentStatus: 'Paid',
        status: (prev.status === 'Approved' || prev.status === 'Pending') ? 'Ready' : prev.status
      }))

      showNotification(`Thanh toán cước cảng thành công qua VietQR! Mã GD: ${backendTxn}`, 'success')
      fetchBookings() // refresh danh sách từ server
    } catch (err) {
      showNotification('Không thể hoàn tất thanh toán: ' + err.message, 'error')
    } finally {
      setPaymentProcessing(false)
    }
  }

  // 1. Dịch thuật các thuật ngữ nghiệp vụ cảng sang Tiếng Việt
  const getOperationNameVi = (type) => {
    switch (type) {
      case 'Export': return 'Giao container hàng xuất'
      case 'Import': return 'Nhận container hàng nhập'
      case 'EmptyPickup': return 'Bốc vỏ container rỗng'
      case 'EmptyReturn': return 'Hạ trả container rỗng'
      case 'Combined': return 'Chuyến xe kết hợp 2 chiều'
      case 'Pickup': return 'Nhận container'
      case 'Dropoff': return 'Giao container'
      default: return type || 'Nghiệp vụ container'
    }
  }

  const getDirectionVi = (direction) => {
    if (direction === 'GateIn') return 'Cổng vào'
    if (direction === 'GateOut') return 'Cổng ra'
    return direction || ''
  }

  const getDocTypeVi = (docType) => {
    switch (docType) {
      case 'BookingNote':
      case 'CarrierBookingReference': return 'Booking Note / Đặt chỗ Hãng tàu'
      case 'BillOfLading': return 'Vận đơn đường biển (B/L)'
      case 'DeliveryOrder': return 'Lệnh giao hàng điện tử (eDO)'
      case 'CustomsDeclaration': return 'Tờ khai Hải quan điện tử'
      case 'VgmCertificate': return 'Chứng thư khối lượng VGM'
      case 'ReeferInstructions': return 'Chỉ dẫn nhiệt độ lạnh'
      case 'DangerousGoodsDeclaration': return 'Khai báo hàng nguy hiểm (DG/IMO)'
      case 'EirReceipt': return 'Phiếu hạ/giao nhận EIR'
      case 'Other': return 'Chứng từ / Hồ sơ đính kèm khác'
      case 'EmptyContainerReleaseOrder': return 'Lệnh cấp vỏ container'
      case 'EmptyReturnAuthorization': return 'Lệnh hạ vỏ rỗng'
      default: return docType || 'Chứng từ thẩm định'
    }
  }

  const getCargoTypeVi = (cargoType) => {
    switch (cargoType) {
      case 'Reefer': return 'Hàng đông lạnh'
      case 'DangerousGoods': return 'Hàng nguy hiểm'
      case 'Oversized': return 'Hàng quá khổ quá tải'
      case 'General':
      default:
        return 'Hàng bách hóa'
    }
  }

  const getOperationStatusVi = (status) => {
    switch (status) {
      case 'Approved': return 'Đã duyệt'
      case 'Completed': return 'Hoàn tất'
      case 'InProgress': return 'Đang xử lý'
      case 'OnHold': return 'Tạm giữ'
      case 'PendingVerification':
      default:
        return 'Chờ thẩm định'
    }
  }

  const getDocStatusVi = (status) => {
    switch (status) {
      case 'Verified': return 'Đã duyệt'
      case 'Rejected': return 'Từ chối'
      case 'Pending':
      default:
        return 'Chờ thẩm định'
    }
  }

  // 1. Render Trạng Thái Booking (Hoàn toàn bằng Tiếng Việt, chuẩn vận hành cảng)
  const renderBookingStatusBadge = (status) => {
    switch (status) {
      case 'Ready':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Sẵn sàng
          </span>
        )
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Chờ điều phối
          </span>
        )
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-300 shadow-2xs">
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
            Đã vào cổng
          </span>
        )
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            Hoàn tất
          </span>
        )
      case 'Canceled':
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Đã hủy
          </span>
        )
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            Từ chối
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

  // Render Badge Loại Nghiệp Vụ Cảng (Export, Import, EmptyPickup, EmptyReturn, Combined)
  const renderOperationTypeBadge = (bk) => {
    if (bk.isCombined || (bk.operations && bk.operations.length > 1) || bk.bookingType === 'Combined') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1 shadow-2xs">
          <span>⚡ 2 Chiều</span>
          <span className="text-[9px] bg-purple-200/70 px-1 rounded font-bold">({bk.operations?.length || 2} tác nghiệp)</span>
        </span>
      )
    }
    switch (bk.bookingType) {
      case 'Export':
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">Giao hàng xuất</span>
      case 'Import':
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-50 text-blue-700 border border-blue-200">Nhận hàng nhập</span>
      case 'EmptyPickup':
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200">Bốc vỏ rỗng</span>
      case 'EmptyReturn':
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-teal-50 text-teal-700 border border-teal-200">Hạ trả rỗng</span>
      case 'Pickup':
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">Nhận container</span>
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-200">{bk.bookingType === 'Dropoff' ? 'Giao container' : (bk.bookingType || 'Giao container')}</span>
    }
  }

  // 2. Render Cột Riêng Biệt Cho Trạng Thái Thanh Toán Cước Cảng (Payment)
  const renderPaymentStatusBadge = (booking) => {
    if (!booking) return null
    const payment = getBookingPaymentInfo(booking)
    const isPaid = payment?.status === 'Paid'
    const amountStr = `${(payment?.amount || 0).toLocaleString('vi-VN')}đ`

    if (isPaid) {
      return (
        <div className="flex flex-col items-start gap-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">
            <span className="material-symbols-outlined text-[13px] text-emerald-600">verified</span>
            Đã thanh toán
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              openPaymentModal(booking)
            }}
            className="text-[10px] text-emerald-700 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
            title="Bấm để xem biên lai cước điện tử"
          >
            <span className="material-symbols-outlined text-[12px]">receipt_long</span>
            <span>Biên lai ({amountStr})</span>
          </button>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-start gap-1">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          Chưa thanh toán
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openPaymentModal(booking)
          }}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-orange-50 hover:bg-orange-100 text-signal-orange border border-orange-200 hover:border-orange-300 transition-all cursor-pointer shadow-2xs group"
          title="Bấm để mở cổng thanh toán VietQR"
        >
          <span className="material-symbols-outlined text-[12px]">payments</span>
          <span>{amountStr}</span>
          <span className="underline ml-0.5 font-black text-orange-600">Đóng ngay</span>
        </button>
      </div>
    )
  }

  // Tương thích ngược
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6 font-sans">

      {/* ========================================================================= */}
      {/* FLOATING TOAST NOTIFICATION */}
      {/* ========================================================================= */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl border text-sm font-medium flex items-center gap-3 backdrop-blur-md transition-all transform animate-in slide-in-from-top-4 duration-300 ${toast.type === 'error'
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
      <div className="text-carbon">

        {/* METRICS / STATS RIBBON - SÁNG, TRONG TRẺO, TINH TẾ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/80 shadow-2xs hover:border-indigo-300 hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-semibold">
              <span>Tổng Lịch Hẹn</span>
              <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-base">receipt_long</span>
              </div>
            </div>
            <div className="text-2xl font-black font-heading text-carbon tracking-tight">{metrics.total}</div>
          </div>

          <div
            onClick={() => navigate('/dispatch')}
            className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/80 shadow-2xs hover:border-emerald-300 hover:shadow-sm transition-all group cursor-pointer"
            title="Chuyển sang Theo dõi & điều phối xe"
          >
            <div className="flex items-center justify-between text-emerald-700 text-xs mb-1 font-semibold">
              <span>Sẵn Sàng Vào Cổng</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-base">verified</span>
              </div>
            </div>
            <div className="text-2xl font-black font-heading text-emerald-600 tracking-tight">{metrics.ready}</div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/80 shadow-2xs hover:border-amber-300 hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between text-amber-700 text-xs mb-1 font-semibold">
              <span>Chờ Điều Phối</span>
              <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-base">pending_actions</span>
              </div>
            </div>
            <div className="text-2xl font-black font-heading text-amber-600 tracking-tight">{metrics.pending}</div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/80 shadow-2xs hover:border-blue-300 hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between text-blue-700 text-xs mb-1 font-semibold">
              <span>Đã Vào Cổng / Hoàn Tất</span>
              <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-base">check_circle</span>
              </div>
            </div>
            <div className="text-2xl font-black font-heading text-blue-600 tracking-tight">{metrics.checkedIn}</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEGMENTED TAB NAVIGATION */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between gap-4 bg-paper p-1.5 rounded-2xl border border-chalk shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none w-full sm:w-auto">
          {[
            { key: 'my_bookings', label: 'Danh Sách Lịch Hẹn', icon: 'format_list_bulleted', badge: totalCount },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeTab === tab.key
                  ? 'bg-gradient-to-r from-signal-orange to-orange-600 hover:from-orange-500 hover:to-orange-600 text-white shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/35 hover:-translate-y-0.5'
                  : 'text-slate-600 hover:text-carbon hover:bg-fog'
                }`}
            >
              <span className={`material-symbols-outlined text-lg ${activeTab === tab.key ? 'text-white' : 'text-slate-400'}`}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

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
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-signal-orange to-orange-600 hover:from-orange-500 hover:to-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/35 hover:-translate-y-0.5 transition-all flex items-center gap-1.5 justify-center cursor-pointer"
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
                  className="px-3 py-2.5 rounded-xl border border-chalk bg-white text-xs font-semibold text-carbon focus:ring-2 focus:ring-signal-orange cursor-pointer focus:border-signal-orange"
                >
                  <option value="All">Tất cả nghiệp vụ</option>
                  <option value="Export">Giao container hàng xuất (Cổng vào)</option>
                  <option value="Import">Nhận container hàng nhập (Cổng ra)</option>
                  <option value="Combined">Chuyến xe kết hợp 2 chiều</option>
                  <option value="Pickup">Nhận container</option>
                  <option value="Dropoff">Giao container</option>
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
                  { id: 'Ready', label: 'Sẵn sàng' },
                  { id: 'Canceled', label: 'Đã hủy' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setStatusFilter(s.id)
                      setPageNumber(1)
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${statusFilter === s.id
                        ? 'bg-gradient-to-r from-signal-orange to-orange-600 text-white shadow-md shadow-orange-500/25'
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
            {loading && bookings.length === 0 ? (
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
                    Thử thay đổi bộ lọc tìm kiếm để xem các lịch hẹn phù hợp.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-chalk text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-3">Mã Booking</th>
                      <th className="py-3 px-3">Nghiệp Vụ</th>
                      <th className="py-3 px-3">Container</th>
                      <th className="py-3 px-3">Ngày Hẹn</th>
                      <th className="py-3 px-3">Vị Trí Bãi</th>
                      <th className="py-3 px-3">Trạng Thái</th>
                      <th className="py-3 px-3 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-chalk/80">
                    {bookings.map((bk) => {
                      const resolvedContainers = getBookingContainers(bk)

                      return (
                        <tr key={bk.id} className="hover:bg-orange-50/30 transition-all duration-150 group">

                          {/* 1. Mã Booking */}
                          <td className="py-3 px-3">
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
                          </td>

                          {/* 2. Nghiệp vụ */}
                          <td className="py-3 px-3">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {renderOperationTypeBadge(bk)}


                              </div>

                            </div>
                          </td>

                          {/* 3. Container */}
                          <td className="py-3 px-3">
                            {resolvedContainers.length > 0 ? (
                              <div className="space-y-1.5">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50/60 border border-orange-200/90 text-signal-orange font-mono font-black text-xs shadow-2xs">
                                  <span className="material-symbols-outlined text-xs">inventory_2</span>
                                  <span>{resolvedContainers.join(', ')}</span>
                                </div>
                                {bk.isReeferPowerRequired && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 border border-cyan-300 text-cyan-800 text-[10px] font-bold shadow-2xs">
                                      <span className="material-symbols-outlined text-[12px] text-cyan-600 animate-pulse">ac_unit</span>
                                      <span>Lạnh{bk.targetTemperature ? ` ${bk.targetTemperature}°C` : ''}</span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 italic inline-block">
                                  Chưa gắn container
                                </span>
                              </div>
                            )}
                          </td>

                          {/* 4. Ngày Hẹn */}
                          <td className="py-3 px-3">
                            <div className="space-y-0.5">
                              <div className="font-bold text-carbon text-xs flex items-center gap-1.5 whitespace-nowrap">
                                <span>{new Date(bk.appointmentStart).toLocaleDateString('vi-VN')}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono bg-fog px-2 py-0.5 rounded w-fit border border-chalk whitespace-nowrap">
                                {new Date(bk.appointmentStart).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(bk.appointmentEnd).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </td>

                          {/* 5. Vị Trí Container */}
                          <td className="py-3 px-3">
                            {(() => {
                              const yard = getBookingYardSlot(bk)
                              if (yard) {
                                return (
                                  <div className="space-y-1">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 font-mono font-bold text-xs shadow-2xs whitespace-nowrap">
                                      <span className="material-symbols-outlined text-xs text-sky-600">location_on</span>
                                      <span>{yard.short}</span>
                                    </div>
                                  </div>
                                )
                              }
                              return (
                                <span className="text-[11px] text-slate-400 italic bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 inline-block whitespace-nowrap">
                                  Chờ phân bổ bãi
                                </span>
                              )
                            })()}
                          </td>

                          {/* 6. Trạng Thái Booking */}
                          <td className="py-3 px-3">
                            {renderBookingStatusBadge(bk.status)}
                          </td>

                          {/* 7. Chi Tiết & Thao Tác Nghiệp Vụ */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">

                              {/* Nút Xem chi tiết (kèm biên lai cước bên trong) */}
                              <button
                                onClick={() => openBookingDetail(bk)}
                                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs hover:shadow cursor-pointer whitespace-nowrap"
                                title="Xem hồ sơ chi tiết lịch hẹn & biên lai cước cảng"
                              >
                                <span>Chi tiết</span>
                              </button>

                              {bk.status === 'Pending' && (
                                <button
                                  onClick={() => openEditModal(bk)}
                                  className="w-8 h-8 rounded-xl border border-amber-200 hover:border-amber-400 text-amber-700 hover:bg-amber-50 transition-all flex items-center justify-center cursor-pointer shrink-0"
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
                                  className="w-8 h-8 rounded-xl border border-rose-200 hover:border-rose-400 text-rose-600 hover:bg-rose-50 transition-all flex items-center justify-center cursor-pointer shrink-0"
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
                        className={`w-8 h-8 rounded-xl font-bold transition-all cursor-pointer ${pageNumber === page
                            ? 'bg-gradient-to-r from-signal-orange to-orange-600 text-white shadow-md shadow-orange-500/25'
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

      {/* ========================================================================= */}
      {/* TAB 3: CONTAINER JOURNEY TRACKING */}
      {/* ========================================================================= */}

      {/* ========================================================================= */}
      {/* MODAL 1: FLEET ASSIGNMENT MODAL (NXP-049 CHUYỂN SANG READY) */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-paper border border-chalk rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">

            <div className="flex justify-between items-center border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider">
                  Điều Phối Phương Tiện & Tài Xế
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
                {assignAiLoading ? 'Đang xử lý...' : '✨ Gợi Ý Xe & Tài Xế Tự Động'}
              </button>
            </div>

            <form onSubmit={handleConfirmAssignFleet} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold uppercase text-slate-500">1. Container Liên Kết</label>
                <select
                  value={assignForm.containerId}
                  onChange={(e) => handleAssignContainerChange(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-chalk bg-white font-mono font-bold text-carbon cursor-pointer focus:outline-none focus:ring-0 focus:border-signal-orange"
                >
                  {(availableResources.containers || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      📦 {c.containerNumber} ({c.size} · {c.grossWeightTon || (c.grossWeightKg / 1000)}T)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold uppercase text-slate-500">2. Chọn Xe Đầu Kéo</label>
                <select
                  value={assignForm.truckId}
                  onChange={(e) => handleAssignTruckChange(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-chalk bg-white font-bold text-carbon cursor-pointer focus:outline-none focus:ring-0 focus:border-signal-orange"
                >
                  {(availableResources.trucks || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      🚚 Biển số: {t.plateNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold uppercase text-slate-500">3. Chọn Tài Xế Phụ Trách</label>
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
                  className="w-full p-3 rounded-2xl border border-chalk bg-white font-bold text-carbon cursor-pointer focus:outline-none focus:ring-0 focus:border-signal-orange"
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
                    <span className={`font-bold font-mono ${assignPayloadAnalysis.severity === 'danger' ? 'text-rose-600' : assignPayloadAnalysis.severity === 'warning' ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                      {assignPayloadAnalysis.ratio}% tải · {assignPayloadAnalysis.status}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-chalk rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${Math.min(assignPayloadAnalysis.ratio, 100)}%` }}
                      className={`h-full transition-all duration-300 rounded-full ${assignPayloadAnalysis.severity === 'danger' ? 'bg-rose-600' : assignPayloadAnalysis.severity === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
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
                <span>Sau khi xác nhận, lịch hẹn chuyển sang <strong>Sẵn sàng</strong>. Tài xế xác nhận chuyến và báo đã đến cổng để điều độ gọi xe vào cảng.</span>
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
                  <span>Xác Nhận Điều Phối ➔</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: BOOKING DETAIL VIEW */}
      {/* ========================================================================= */}
      {showDetailModal && selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-paper border border-chalk rounded-3xl max-w-2xl max-h-[90vh] overflow-y-auto w-full p-6 sm:p-7 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">

            <div className="flex justify-between items-center border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Hồ Sơ Chi Tiết Lịch Hẹn</span>
                <h3 className="font-mono font-black text-xl text-carbon">{selectedBooking.bookingCode}</h3>
              </div>
              <button
                onClick={closeBookingDetail}
                className="w-8 h-8 rounded-full bg-fog hover:bg-chalk flex items-center justify-center text-slate-500 hover:text-carbon font-bold text-base transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {selectedBooking.bookingType === 'Dropoff' && (selectedBooking.containerSelections || []).filter(link => link.yardCode).map(link => <div key={link.containerVisitId} className="space-y-2 rounded-2xl border border-orange-200 bg-orange-50 p-4"><p className="text-xs font-bold">Mã lượt bãi · {link.containerNumber}</p><div className="flex items-center justify-between gap-2"><b className="select-all break-all font-mono text-sm">{link.yardCode}</b><button onClick={() => copyToClipboard(link.yardCode, 'yard-code')} className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs font-bold">{copiedText === 'yard-code' ? 'Đã copy' : 'Copy'}</button></div><p className="text-xs text-slate">Gửi mã cho công ty được phép đặt Pickup của lượt bãi này.</p></div>)}
            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center bg-fog p-3.5 rounded-2xl border border-chalk">
                <span className="text-slate-600 font-bold">Trạng thái vận hành:</span>
                {renderBookingStatusBadge(selectedBooking.status)}
              </div>

              <BookingFleetDetails vehicle={selectedBooking.vehicleDetails} driver={selectedBooking.driverDetails} saved />
              {selectedBooking.trailerNumber && <p className="text-xs font-bold">Biển số rơ-moóc: {selectedBooking.trailerNumber}</p>}

              {/* Thông tin Cước & Thanh Toán TOS */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-signal-orange text-lg">payments</span>
                    <span className="font-bold text-carbon text-xs">Cước Phí Cảng & Thanh Toán:</span>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getBookingPaymentInfo(selectedBooking).status === 'Paid'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    {getBookingPaymentInfo(selectedBooking).status === 'Paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Tổng tiền cước TOS (đã gồm VAT 8%):</span>
                  <span className="font-mono font-black text-carbon text-sm">
                    {getBookingPaymentInfo(selectedBooking).amount.toLocaleString('vi-VN')} VNĐ
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openPaymentModal(selectedBooking)}
                  className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-carbon font-bold text-xs border border-slate-200 shadow-2xs hover:shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm text-signal-orange">
                    {getBookingPaymentInfo(selectedBooking).status === 'Paid' ? 'receipt_long' : 'qr_code_scanner'}
                  </span>
                  <span>{getBookingPaymentInfo(selectedBooking).status === 'Paid' ? 'Xem Chi Tiết Biên Lai Thanh Toán' : 'Mở VietQR & Thanh Toán Ngay'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl border border-chalk bg-white">
                <div>
                  <span className="text-slate-400 text-[11px]">Loại Booking:</span>
                  <p className="font-bold text-carbon text-sm mt-0.5">{getOperationNameVi(selectedBooking.bookingType)}</p>
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

              {/* VỊ TRÍ CONTAINER TRÊN BÃI CẢNG (SMART YARD ALLOCATION) */}
              {(() => {
                const yard = getBookingYardSlot(selectedBooking)
                return (
                  <div className="p-4 rounded-2xl border border-sky-200 bg-sky-50/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sky-600 text-lg">location_on</span>
                        <span className="font-extrabold uppercase text-sky-950 text-[11px] tracking-wider">
                          Vị Trí Container &amp; Điều Phối Bãi Thông Minh (TOS)
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                        Đã Phân Bổ Bãi Tiên Sa
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="bg-white p-3 rounded-xl border border-sky-100 shadow-2xs">
                        <span className="text-slate-400 text-[10px] font-bold uppercase block">Vị Trí Bãi Đã Cấp</span>
                        <div className="font-mono font-black text-sky-900 text-base mt-0.5">
                          {yard?.short || 'Chờ điều độ chỉ định'}
                        </div>
                        {yard?.detail && (
                          <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                            {yard.detail}
                          </div>
                        )}
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-sky-100 shadow-2xs">
                        <span className="text-slate-400 text-[10px] font-bold uppercase block">Khu Vực Bãi / Cổng Vào</span>
                        <div className="font-bold text-slate-800 text-xs mt-0.5">
                          {yard?.zoneName || 'Khu Bãi Container Tiên Sa (VNDAD)'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                          {selectedBooking.requestedGate ? `Cổng: ${selectedBooking.requestedGate}` : 'Cổng chỉ định: Cổng 1 (Gate 1)'}
                        </div>
                      </div>
                    </div>

                    {selectedBooking.vesselName && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-sky-100/80">
                        <div>
                          <span className="text-slate-400 text-[10px] font-bold uppercase block">Tàu / Chuyến</span>
                          <span className="font-bold text-slate-800 text-xs">{selectedBooking.vesselName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] font-bold uppercase block">Số Vận Đơn (B/L)</span>
                          <span className="font-mono font-bold text-slate-800 text-xs">{selectedBooking.billOfLading || '—'}</span>
                        </div>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-600 bg-white/90 p-2.5 rounded-xl border border-sky-100 flex items-start gap-2">
                      <span className="material-symbols-outlined text-sm text-sky-600 shrink-0 mt-0.5">info</span>
                      <span>
                        Tài xế xác nhận chuyến trên app, báo <strong>đã đến cổng</strong> để điều độ gọi xe (tự động nếu bãi còn chỗ). Camera cổng nhận diện biển số và hệ thống chỉ dẫn di chuyển thẳng vào vị trí container trên bãi.
                      </span>
                    </div>
                  </div>
                )
              })()}

              {/* HỒ SƠ CHỨNG TỪ DÙNG CHUNG CỦA ĐƠN HÀNG (Áp dụng cho nhiều container) */}
              {selectedBooking.documents && selectedBooking.documents.length > 0 && (
                <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-blue-600">folder_shared</span>
                      <span className="text-[11px] font-extrabold uppercase text-blue-900 tracking-wider">
                        Chứng Từ Dùng Chung Đơn Hàng ({selectedBooking.documents.length} Tệp)
                      </span>
                    </div>
                    <span className="text-[10px] text-blue-700 bg-blue-100 font-bold px-2 py-0.5 rounded-full">
                      Áp dụng chung toàn bộ container
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedBooking.documents.map((doc, dIdx) => (
                      <div key={doc.id || dIdx} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-blue-100 text-xs shadow-2xs">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-blue-500">description</span>
                          <div>
                            <span className="font-bold text-carbon">{getDocTypeVi(doc.documentType)}</span>
                            {doc.fileName && (
                              <span className="text-[11px] text-slate-600 font-medium ml-1.5 font-mono">
                                ({doc.fileName})
                              </span>
                            )}
                            {doc.documentNumber && (
                              <span className="text-[10px] text-slate-400 font-mono ml-2">#{doc.documentNumber}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${doc.verificationStatus === 'Verified' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              doc.verificationStatus === 'Rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                            {doc.verificationStatus === 'Verified' ? '✓ Đã thẩm định' :
                              doc.verificationStatus === 'Rejected' ? '✕ Bị từ chối' : '⏳ Chờ duyệt'}
                          </span>
                          {(doc.fileUrl || doc.fileReference) && (
                            <a
                              href={doc.fileUrl || doc.fileReference}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 text-[10px] font-bold flex items-center gap-1 transition-all"
                              title="Xem tệp chứng từ"
                            >
                              <span className="material-symbols-outlined text-xs">open_in_new</span>
                              <span>Xem tệp</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CHI TIẾT CÁC NGHIỆP VỤ & CHỨNG TỪ (NEXUSPORT TOS SMART GATE) */}
              {selectedBooking.operations && selectedBooking.operations.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                      Danh Mục Nghiệp Vụ Cảng ({selectedBooking.operations.length} Nghiệp Vụ)
                    </span>
                    {selectedBooking.isCombined && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800">
                        ⚡ Chuyến Xe Kết Hợp Hai Chiều
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {selectedBooking.operations.map((op, opIdx) => (
                      <div key={op.id || opIdx} className="p-4 rounded-2xl border border-chalk bg-white shadow-xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-chalk pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${op.expectedGateDirection === 'GateIn' ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                              {opIdx + 1}
                            </span>
                            <span className="font-extrabold text-carbon text-sm">{getOperationNameVi(op.operationType)}</span>
                            <span className="text-[10px] font-bold text-slate-500 font-mono">({getDirectionVi(op.expectedGateDirection)})</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${op.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                                op.status === 'Completed' ? 'bg-slate-200 text-slate-800' :
                                  op.status === 'InProgress' ? 'bg-blue-100 text-blue-800' :
                                    op.status === 'OnHold' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                              {getOperationStatusVi(op.status)}
                            </span>

                            {op.status !== 'Approved' && op.status !== 'Completed' && (
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleUpdateOperationStatus(selectedBooking.id, op.id, 'Approved')}
                                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] border border-emerald-200 transition-all cursor-pointer"
                              >
                                ✓ Duyệt nghiệp vụ
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Số Container:</span>
                            <span className="font-mono font-extrabold text-signal-orange">{op.containerNumber || '—'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Trạng thái:</span>
                            <span className="font-semibold text-carbon">{op.cargoStatus === 'Empty' ? 'Vỏ Rỗng' : 'Có Hàng'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Loại hàng:</span>
                            <span className="font-semibold text-carbon">{getCargoTypeVi(op.cargoType)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Trọng lượng:</span>
                            <span className="font-mono font-semibold text-carbon">{op.grossWeightKg ? `${op.grossWeightKg} Kg` : '—'}</span>
                          </div>
                        </div>

                        {/* References */}
                        <div className="flex flex-wrap gap-2 text-[11px] pt-1 border-t border-chalk/60">
                          {op.carrierBookingNumber && (
                            <span className="bg-fog px-2 py-0.5 rounded text-slate-600 font-mono">
                              Booking Hãng: <b>{op.carrierBookingNumber}</b>
                            </span>
                          )}
                          {op.billOfLadingNumber && (
                            <span className="bg-fog px-2 py-0.5 rounded text-slate-600 font-mono">
                              B/L: <b>{op.billOfLadingNumber}</b>
                            </span>
                          )}
                          {op.deliveryOrderNumber && (
                            <span className="bg-fog px-2 py-0.5 rounded text-slate-600 font-mono">
                              eDO: <b>{op.deliveryOrderNumber}</b>
                            </span>
                          )}
                          {op.customsDeclarationNumber && (
                            <span className="bg-fog px-2 py-0.5 rounded text-slate-600 font-mono">
                              Hải quan: <b>{op.customsDeclarationNumber}</b>
                            </span>
                          )}
                          {op.emptyReleaseOrderNumber && (
                            <span className="bg-fog px-2 py-0.5 rounded text-slate-600 font-mono">
                              Lệnh cấp vỏ: <b>{op.emptyReleaseOrderNumber}</b>
                            </span>
                          )}
                          {op.emptyReturnAuthNumber && (
                            <span className="bg-fog px-2 py-0.5 rounded text-slate-600 font-mono">
                              Lệnh trả rỗng: <b>{op.emptyReturnAuthNumber}</b>
                            </span>
                          )}
                          {op.eirNumber && (
                            <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-mono font-bold">
                              Phiếu EIR: {op.eirNumber}
                            </span>
                          )}
                        </div>

                        {/* Documents */}
                        {op.documents && op.documents.length > 0 && (
                          <div className="space-y-1.5 pt-1 border-t border-chalk/60">
                            <span className="text-[10px] font-bold text-slate-600 uppercase">Bộ chứng từ riêng của container này ({op.documents.length} tệp):</span>
                            <div className="space-y-1">
                              {op.documents.map((doc) => (
                                <div key={doc.id} className="flex items-center justify-between p-2 rounded-xl bg-fog text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm text-slate-500">description</span>
                                    <div>
                                      <span className="font-bold text-carbon">{getDocTypeVi(doc.documentType)}</span>
                                      {doc.fileName && (
                                        <span className="text-[11px] text-slate-600 font-medium ml-1.5 font-mono">
                                          ({doc.fileName})
                                        </span>
                                      )}
                                      <span className="text-[10px] text-slate-400 font-mono ml-2">{doc.documentNumber}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {(doc.fileUrl || doc.fileReference) && (
                                      <a
                                        href={doc.fileUrl || doc.fileReference}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-blue-600 border border-slate-200 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                        title="Xem tệp chứng từ"
                                      >
                                        <span className="material-symbols-outlined text-xs">open_in_new</span>
                                        <span>Xem tệp</span>
                                      </a>
                                    )}
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${(doc.verificationStatus || doc.status) === 'Verified' ? 'bg-emerald-100 text-emerald-800' :
                                        (doc.verificationStatus || doc.status) === 'Rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                      }`}>
                                      {getDocStatusVi(doc.verificationStatus || doc.status)}
                                    </span>
                                    {(doc.verificationStatus || doc.status) !== 'Verified' && (
                                      <button
                                        type="button"
                                        disabled={actionLoading}
                                        onClick={() => handleVerifyDocument(selectedBooking.id, doc.id)}
                                        className="px-2 py-0.5 rounded bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold transition-all cursor-pointer"
                                      >
                                        Duyệt
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Thông tin Cấp Điện Kho Lạnh Reefer */}
              {selectedBooking.isReeferPowerRequired && (
                <div className="p-4 rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50/60 to-blue-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-cyan-600">ac_unit</span>
                      <span className="font-bold text-cyan-950 text-xs">Dịch Vụ Cấp Điện Kho Lạnh</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300">
                      3 Pha 380V / 15kW
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-cyan-200/80 text-xs">
                    <div className="bg-white/80 p-2.5 rounded-xl border border-cyan-100">
                      <span className="text-slate-400 text-[10px] block font-medium">Nhiệt độ cài đặt</span>
                      <span className="font-mono font-black text-cyan-800 text-sm">
                        {selectedBooking.targetTemperature ?? -18}°{selectedBooking.temperatureUnit || 'C'}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">±{selectedBooking.tempTolerance ?? 2.0}°C</span>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-cyan-100">
                      <span className="text-slate-400 text-[10px] block font-medium">Trụ / Ổ cấp điện</span>
                      <span className="font-mono font-black text-emerald-700 text-sm">
                        {selectedBooking.reeferPlugCode || 'Tự động phân bổ'}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Khu Vực Bãi Lạnh (Block R)</span>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-cyan-100">
                      <span className="text-slate-400 text-[10px] block font-medium">Trạng thái cấp điện</span>
                      <span className="font-bold text-signal-orange text-xs block mt-0.5">
                        {selectedBooking.reeferPowerStatus === 'POWERED_ON' ? '⚡ Đang cấp điện' : '⏳ Chờ cắm điện'}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Hệ Thống Kho Lạnh</span>
                    </div>
                  </div>

                  <div className="pt-1 flex justify-end">
                    <a
                      href="/yard/reefer"
                      className="text-[11px] font-bold text-cyan-700 hover:text-cyan-900 flex items-center gap-1 hover:underline"
                    >
                      <span>Mở trung tâm quản lý kho lạnh</span>
                      <span className="material-symbols-outlined text-xs">arrow_forward</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-chalk">
              <button
                type="button"
                onClick={() => openPaymentModal(selectedBooking)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">receipt_long</span>
                <span>Xem Biên Lai Cước Điện Tử ({getBookingPaymentInfo(selectedBooking).amount.toLocaleString('vi-VN')}đ)</span>
              </button>
              <button
                onClick={closeBookingDetail}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all cursor-pointer"
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
                className="w-full p-3 rounded-2xl border border-chalk bg-white text-xs text-carbon focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
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
                  className="w-full p-3 rounded-2xl border border-chalk bg-white font-mono font-bold text-carbon focus:outline-none focus:ring-0 focus:border-signal-orange"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold uppercase text-slate-500">Ngày Hẹn Dự Kiến</label>
                <input
                  type="date"
                  required
                  value={editForm.appointmentDate}
                  onChange={(e) => setEditForm({ ...editForm, appointmentDate: e.target.value })}
                  className="w-full p-3 rounded-2xl border border-chalk bg-white font-bold text-carbon focus:outline-none focus:ring-0 focus:border-signal-orange"
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
                    className="w-full p-3 rounded-2xl border border-chalk bg-white font-bold text-carbon focus:outline-none focus:ring-0 focus:border-signal-orange"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold uppercase text-slate-500">Giờ Kết Thúc</label>
                  <input
                    type="time"
                    required
                    value={editForm.endTime}
                    onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                    className="w-full p-3 rounded-2xl border border-chalk bg-white font-bold text-carbon focus:outline-none focus:ring-0 focus:border-signal-orange"
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

      {/* ========================================================================= */}
      {/* MODAL 6: PAYMENT & TOS PORT CHARGES MODAL (VIETQR NAPAS 24/7) */}
      {/* ========================================================================= */}
      {showPaymentModal && paymentBooking && (() => {
        const pInfo = getBookingPaymentInfo(paymentBooking)
        const isPaid = pInfo.status === 'Paid'
        const code = paymentBooking.bookingCode || paymentBooking.id
        const bankName = 'MB Bank (Ngân Hàng TMCP Quân Đội)'
        const accountNo = '190388668899'
        const accountName = 'CÔNG TY CP CẢNG QUỐC TẾ NEXUSPORT'
        const transferContent = `NP ${code}`
        const vietQrUrl = `https://img.vietqr.io/image/MB-${accountNo}-compact2.png?amount=${pInfo.amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(accountName)}`
        const fallbackQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`00020101021238540010A0000007270124000697042201121903886688990208QRIBFTTA5303704540${pInfo.amount}5802VN62190815${transferContent}6304`)}`

        return (
          <div className="w-full mt-6" ref={el => { if (el && !el.dataset.scrolled) { el.dataset.scrolled = '1'; el.scrollIntoView({ block: 'start', behavior: 'smooth' }) } }}>
            <div className="bg-paper border border-slate-200 rounded-3xl w-full p-6 sm:p-7 shadow-sm space-y-6">

              {/* Header */}
              <div className="flex justify-between items-start border-b border-chalk pb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-signal-orange'
                    }`}>
                    <span className="material-symbols-outlined text-2xl">
                      {isPaid ? 'verified' : 'payments'}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Hệ Thống Thu Phí Cảng Điện Tử
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${isPaid
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-amber-50 text-amber-700 border-amber-300 animate-pulse'
                        }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {isPaid ? 'Đã Thanh Toán' : 'Chờ Thanh Toán'}
                      </span>
                    </div>
                    <h3 className="font-mono font-black text-xl text-carbon mt-0.5">
                      {code}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="w-9 h-9 rounded-full bg-fog hover:bg-chalk flex items-center justify-center text-slate-500 hover:text-carbon font-bold text-base transition-colors cursor-pointer"
                  title="Đóng cửa sổ"
                >
                  ✕
                </button>
              </div>

              {/* Bảng Chi Tiết Biểu Phí Dịch Vụ Cảng TOS (Xuất Khẩu vs Nhập Khẩu) */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-signal-orange">receipt</span>
                      Bảng Kê Chi Tiết Biểu Phí Dịch Vụ Cảng
                    </h4>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${pInfo.tariff?.caseCode === 'IMPORT'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                      {pInfo.tariff?.badgeLabel || 'BIỂU PHÍ XUẤT KHẨU'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Đơn vị tính: VNĐ</span>
                </div>

                {pInfo.fromPortBill && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-base">verified</span>
                      <span>
                        <strong>Bill chính thức từ Cảng Tiên Sa ({pInfo.billNumber})</strong>
                        {pInfo.yardSlot ? ` · Vị trí bãi đã cấp: ${pInfo.yardSlot}` : ''}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                      Đã duyệt &amp; gửi Bill
                    </span>
                  </div>
                )}

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white text-xs divide-y divide-slate-100">
                  {(pInfo.tariff?.items || []).map((item) => (
                    <div key={item.no} className="px-3.5 py-2.5 flex justify-between items-center hover:bg-slate-50/50 gap-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-carbon">{item.title}</span>
                        {item.desc && (
                          <span className="text-[11px] text-slate-500 font-normal">{item.desc}</span>
                        )}
                      </div>
                      <span className={`font-mono font-bold shrink-0 ${item.amount === 0 ? 'text-emerald-700' : 'text-carbon'}`}>
                        {item.amount === 0 ? '0 đ (Miễn phí)' : `${item.amount.toLocaleString('vi-VN')} đ`}
                      </span>
                    </div>
                  ))}

                  <div className="px-3.5 py-2.5 flex justify-between items-center bg-slate-50/40">
                    <span className="text-slate-500">Cộng tiền dịch vụ trước thuế:</span>
                    <span className="font-mono font-semibold text-slate-700">{pInfo.subtotal.toLocaleString('vi-VN')} đ</span>
                  </div>

                  <div className="px-3.5 py-2.5 flex justify-between items-center bg-slate-50/40">
                    <span className="text-slate-500">Thuế GTGT (VAT 8%):</span>
                    <span className="font-mono font-semibold text-slate-700">{pInfo.vat.toLocaleString('vi-VN')} đ</span>
                  </div>

                  <div className="p-3.5 flex justify-between items-center bg-orange-50/50 border-t-2 border-orange-200">
                    <span className="font-extrabold text-sm text-carbon uppercase tracking-wider">Tổng Cộng Tiền Thanh Toán:</span>
                    <span className="font-mono font-black text-xl text-signal-orange">
                      {pInfo.amount.toLocaleString('vi-VN')} VNĐ
                    </span>
                  </div>
                </div>
              </div>

              {/* Phần Hành Động: ĐÃ THANH TOÁN (BIÊN LAI) hoặc CHƯA THANH TOÁN (VIETQR) */}
              {isPaid ? (
                /* GIAO DIỆN BIÊN LAI ĐÃ THANH TOÁN */
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
                        <span className="material-symbols-outlined text-2xl">check</span>
                      </div>
                      <div>
                        <h4 className="font-black text-emerald-900 text-sm">GIAO DỊCH ĐÃ THANH TOÁN THÀNH CÔNG</h4>
                        <p className="text-xs text-emerald-700">
                          Hệ thống đã ghi nhận thanh toán phí cảng. Chuyến xe đủ điều kiện để điều độ gọi vào cảng.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-emerald-200/80">
                      <div>
                        <span className="text-slate-400 text-[11px]">Mã Giao Dịch Quyết Toán:</span>
                        <p className="font-mono font-black text-carbon mt-0.5">{pInfo.transactionId || `TXN-NP-${code}`}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px]">Thời Gian Thanh Toán:</span>
                        <p className="font-semibold text-carbon mt-0.5">
                          {pInfo.paidAt ? new Date(pInfo.paidAt).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN')}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px]">Phương Thức:</span>
                        <p className="font-semibold text-carbon mt-0.5">{pInfo.method || 'VietQR Napas 247'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px]">Trạng Thái Kế Toán Cảng:</span>
                        <p className="font-bold text-emerald-600 mt-0.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">done_all</span>
                          Đã Đối Soát
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        showNotification('Đã xuất hóa đơn điện tử e-Invoice PDF về máy!', 'success')
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-carbon font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-sm">print</span>
                      In Biên Lai Hóa Đơn
                    </button>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(false)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-carbon font-bold text-xs hover:bg-slate-50 cursor-pointer"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* GIAO DIỆN THANH TOÁN QUA VIETQR */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-5 rounded-2xl border border-slate-200 bg-slate-50/70">

                    {/* Cột trái: Mã QR Chuyển Khoản VietQR */}
                    <div className="flex flex-col items-center text-center space-y-2.5 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                      <div className="relative p-2 rounded-2xl bg-white border border-slate-200 shadow-inner group">
                        <img
                          src={vietQrUrl}
                          alt="VietQR Payment"
                          className="w-48 h-48 sm:w-52 sm:h-52 object-contain rounded-xl"
                          onError={(e) => {
                            e.currentTarget.src = fallbackQrUrl
                          }}
                        />
                        <div className="absolute inset-x-2 bottom-2 bg-gradient-to-t from-black/60 to-transparent p-1.5 rounded-b-xl flex items-center justify-center gap-1.5 text-white text-[10px] font-bold">
                          <span className="material-symbols-outlined text-xs">center_focus_strong</span>
                          Quét mã bằng App Ngân Hàng
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        <span>Mã QR động Napas 247 · Khớp lệnh tức thì</span>
                      </div>
                    </div>

                    {/* Cột phải: Thông tin chuyển khoản chi tiết */}
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <span className="text-slate-400 text-[11px]">Ngân Hàng Thụ Hưởng:</span>
                        <div className="font-bold text-carbon mt-0.5 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                          {bankName}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                        <span className="text-slate-400 text-[10px]">Chủ Tài Khoản:</span>
                        <div className="font-mono font-bold text-carbon text-xs mt-0.5">{accountName}</div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-slate-400 text-[10px]">Số Tài Khoản:</span>
                          <div className="font-mono font-black text-carbon text-sm mt-0.5 tracking-wider">{accountNo}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyPaymentInfo(accountNo, 'acc')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs">
                            {copiedPaymentField === 'acc' ? 'check' : 'content_copy'}
                          </span>
                          {copiedPaymentField === 'acc' ? 'Đã chép' : 'Sao chép'}
                        </button>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-slate-400 text-[10px]">Số Tiền Cần Chuyển:</span>
                          <div className="font-mono font-black text-signal-orange text-sm mt-0.5">
                            {pInfo.amount.toLocaleString('vi-VN')} VNĐ
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyPaymentInfo(pInfo.amount.toString(), 'amount')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs">
                            {copiedPaymentField === 'amount' ? 'check' : 'content_copy'}
                          </span>
                          {copiedPaymentField === 'amount' ? 'Đã chép' : 'Sao chép'}
                        </button>
                      </div>

                      <div className="p-2.5 rounded-xl bg-orange-50/70 border border-orange-200 flex items-center justify-between">
                        <div>
                          <span className="text-amber-800 text-[10px] font-bold">Nội Dung Chuyển Khoản (Bắt buộc):</span>
                          <div className="font-mono font-black text-carbon text-xs mt-0.5">{transferContent}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyPaymentInfo(transferContent, 'content')}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-orange-100 text-amber-900 border border-orange-300 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs">
                            {copiedPaymentField === 'content' ? 'check' : 'content_copy'}
                          </span>
                          {copiedPaymentField === 'content' ? 'Đã chép' : 'Sao chép'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Thanh nút bấm xác nhận */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-200">
                    <p className="text-[11px] text-slate-400 text-center sm:text-left">
                      💡 Mở app ngân hàng quét mã VietQR hoặc chuyển khoản đúng nội dung để hệ thống tự động đối soát.
                    </p>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(false)}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-carbon font-bold text-xs hover:bg-slate-50 cursor-pointer"
                      >
                        Đóng
                      </button>

                      <button
                        type="button"
                        disabled={paymentProcessing}
                        onClick={handleConfirmPayment}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-signal-orange to-orange-600 hover:from-orange-500 hover:to-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/35 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {paymentProcessing ? (
                          <>
                            <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                            <span>Đang Đối Soát Napas...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-sm">task_alt</span>
                            <span>Xác Nhận Đã Thanh Toán</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )
      })()}

    </div>
  )
}
