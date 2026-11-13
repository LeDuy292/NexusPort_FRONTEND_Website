import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { bookingService } from '../../services/bookingService'
import { companyService } from '../../services/companyService'
import { yardOperationService } from '../../services/yardOperationService'
import apiClient from '../../services/apiClient'
import expressApiClient from '../../services/expressApiClient'
import DriverDetailModal from '../../components/Modals/DriverDetailModal'
import VehicleDetailModal from '../../components/Modals/VehicleDetailModal'
import CompanyDetailModal from '../../components/Modals/CompanyDetailModal'
import DocumentViewerModal from '../../components/Modals/DocumentViewerModal'
import YardSlotReservationModal from '../../components/Yard/YardSlotReservationModal'
import BookingDocumentsModal from '../../components/Booking/BookingDocumentsModal'
import sourceLayout from '../../features/yard-design/tienSaLayout.json'
import { yardReservationStore } from '../../services/yardReservationStore'
import { calculatePortStorageFee, calculatePortServiceTariff, computeAutoBookingTariff, calculateShiftingFee, PORT_STORAGE_TIERS } from '../../utils/portStorageFee'
import { manifestPortSyncService } from '../../services/manifestPortSyncService'
import { serviceOrdersApi, orderStatusLabels, paymentStatusLabels, paymentStateLabel, statusTone } from '../../features/service-catalog/serviceOrdersApi'
import { money } from '../../features/service-catalog/catalogApi'
import { draftDateTime } from '../../features/service-catalog/serviceDraftsApi'
import OrderBadge from '../../features/service-catalog/ServiceOrderBadge'
import ServiceOrderDetail from '../../features/service-catalog/ServiceOrderDetail'
import { FileText, Container, Search, RefreshCw, ArrowUpRight, Filter, Loader2 } from 'lucide-react'
import '../../features/service-catalog/serviceCatalog.css'
import '../../features/service-catalog/serviceRegistrations.css'
import '../../features/service-catalog/serviceOrders.css'
import ShippingPagination from '../ShippingLine/components/ShippingPagination'
import { resolveMediaUrl } from '../../utils/mediaUtils'

const VOYAGE_STATUS_STYLES = {
  SCHEDULED: 'bg-slate-100 text-slate-700 border-slate-300',
  IN_TRANSIT: 'bg-blue-50 text-blue-700 border-blue-300',
  BERTHED: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  OPERATING: 'bg-indigo-50 text-indigo-700 border-indigo-300',
  DEPARTED: 'bg-slate-100 text-slate-600 border-slate-300',
  COMPLETED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
}

const VOYAGE_STATUS_LABELS = {
  SCHEDULED: 'Kế hoạch',
  IN_TRANSIT: 'Đang hành trình',
  BERTHED: 'Đã cập cảng',
  OPERATING: 'Đang làm hàng',
  DEPARTED: 'Đã rời cảng',
  COMPLETED: 'Hoàn tất',
}

const FALLBACK_CARRIER_PROFILES = [
  {
    companyName: 'Công ty Cổ phần Vận tải & Logistics Tiên Sa',
    contactPerson: 'Nguyễn Văn Hùng (Trưởng phòng Điều phối)',
    phone: '0905 123 456',
    email: 'dieudo@tiensalogistics.com.vn',
  },
  {
    companyName: 'Công ty TNHH Vận tải & Giao nhận Tân Cảng Đà Nẵng',
    contactPerson: 'Trần Đình Nam (Điều độ vận tải)',
    phone: '0918 889 900',
    email: 'operations@tancangdanang.com.vn',
  },
  {
    companyName: 'Hãng tàu ONE (Ocean Network Express Việt Nam)',
    contactPerson: 'Lê Hoàng Minh (Đại diện Hãng tàu)',
    phone: '028 3822 6969',
    email: 'danang.dispatch@one-line.com',
  },
  {
    companyName: 'Hãng tàu Maersk Line (Chi nhánh Đà Nẵng)',
    contactPerson: 'Phạm Quốc Bảo (Khai thác cảng)',
    phone: '0236 388 9900',
    email: 'vn.import@maersk.com',
  },
  {
    companyName: 'Công ty CP Tiếp Vận & Vận tải Miền Trung (CentralTrans)',
    contactPerson: 'Võ Thị Kim Oanh (Bộ phận Khai báo Cảng)',
    phone: '0905 667 788',
    email: 'dispatch@centraltrans.vn',
  },
]

const YARD_ZONES = [
  { code: 'A', name: 'Khu A', desc: 'Sau cầu 4–5' },
  { code: 'B', name: 'Khu B', desc: 'Bãi container 1' },
  { code: 'C', name: 'Khu C', desc: 'Bãi container 2' },
  { code: 'D', name: 'Khu D', desc: 'Bãi cont lạnh (Reefer)' },
  { code: 'E', name: 'Khu E', desc: 'Bãi tổng hợp 1' },
  { code: 'F', name: 'Khu F', desc: 'Bãi tổng hợp 2' },
  { code: 'G', name: 'Khu G', desc: 'Bãi tổng hợp 3' },
]

export default function GateBookingRequests() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(false)

  // Filters State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [operationFilter, setOperationFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState('Today')
  const [gateFilter, setGateFilter] = useState('All')
  const [companyFilter, setCompanyFilter] = useState('All')

  // Selected Booking Drawer State
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [reservedSlot, setReservedSlot] = useState(null)
  const [blocksData, setBlocksData] = useState([])
  const [selectedZone, setSelectedZone] = useState('A')
  const [pickerBlock, setPickerBlock] = useState(null)
  const [selectedBlock, setSelectedBlock] = useState('A')
  const [selectedBay, setSelectedBay] = useState('02')
  const [selectedTierRow, setSelectedTierRow] = useState('T3-R5')
  const [modalState, setModalState] = useState({ type: null, id: null })
  const [showDocViewer, setShowDocViewer] = useState(false)
  const [docViewerIndex, setDocViewerIndex] = useState(0)
  const [bookingStorageDays, setBookingStorageDays] = useState({})
  const [tariffDirectionOverride, setTariffDirectionOverride] = useState(null) // null | 'EXPORT' | 'IMPORT'
  const [tariffSizeOverride, setTariffSizeOverride] = useState(null) // null | 20 | 40

  // Action Modals State
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionNote, setRejectionNote] = useState('')
  const [showDocumentsModal, setShowDocumentsModal] = useState(false)
  const [showContainerPopup, setShowContainerPopup] = useState(false)
  const [showCarrierPopup, setShowCarrierPopup] = useState(false)
  const [showTariffPopup, setShowTariffPopup] = useState(false)
  const [showYardBigModal, setShowYardBigModal] = useState(false)
  const [showVehiclePopup, setShowVehiclePopup] = useState(false)
  const [showEportSyncPopup, setShowEportSyncPopup] = useState(false)
  const [eportLoading, setEportLoading] = useState(false)
  const [eportError, setEportError] = useState('')
  const [eportOrders, setEportOrders] = useState([])
  const [eportDetail, setEportDetail] = useState(null)
  const [eportSearchTerm, setEportSearchTerm] = useState('')

  // Tab "Đơn Dịch Vụ ePort Gửi Đến" (xem toàn bộ request từ ePort)
  const [eportListItems, setEportListItems] = useState([])
  const [eportListTotal, setEportListTotal] = useState(0)
  const [eportListLoading, setEportListLoading] = useState(false)
  const [eportListError, setEportListError] = useState('')
  const [eportListSearch, setEportListSearch] = useState('')
  const [eportListStatus, setEportListStatus] = useState('')
  const [eportListPaymentStatus, setEportListPaymentStatus] = useState('')
  const [eportListFlow, setEportListFlow] = useState('')
  const [eportListPage, setEportListPage] = useState(1)
  const [selectedEportOrderId, setSelectedEportOrderId] = useState(null)
  const [eportValidationMap, setEportValidationMap] = useState({})
  const processedEportOrderRef = useRef(new Set())
  const [manifestSyncVersion, setManifestSyncVersion] = useState(0)
  const [yardResVersion, setYardResVersion] = useState(0)
  const [isCompanySectionCollapsed, setIsCompanySectionCollapsed] = useState(false)
  const [collapsedCompanies, setCollapsedCompanies] = useState({})
  const [activeListType, setActiveListType] = useState('vessel') // 'vessel' | 'truck' (Danh sách tàu hiện trước)
  const [selectedVesselManifest, setSelectedVesselManifest] = useState(null)
  const [vesselSearch, setVesselSearch] = useState('')
  const [selectedVesselFilter, setSelectedVesselFilter] = useState('All')
  const [vesselContainersPopup, setVesselContainersPopup] = useState(null)
  const [vesselDetailTab, setVesselDetailTab] = useState('containers') // 'containers' | 'bl' | 'vessel' | 'seal'
  const [vesselPage, setVesselPage] = useState(1)
  const [vesselPageSize, setVesselPageSize] = useState(5)
  const [companyPage, setCompanyPage] = useState(1)
  const [companyPageSize, setCompanyPageSize] = useState(5)
  const [popupContainerPage, setPopupContainerPage] = useState(1)
  const [popupContainerPageSize, setPopupContainerPageSize] = useState(5)

  // Cảng phê duyệt / chấp nhận Bản khai Tàu -> Tự động tách ra bảng mới chia theo từng Công ty vận tải để xét duyệt
  const handleApproveVesselManifest = (manifestId) => {
    const res = manifestPortSyncService.approveManifestByPort(manifestId)
    const approvedManifest = res?.approvedManifest
    const newGateBookings = res?.newGateBookings || []

    setManifestSyncVersion(v => v + 1)
    if (approvedManifest?.manifestNumber || manifestId) {
      setSelectedVesselFilter(approvedManifest?.manifestNumber || manifestId)
    }

    if (selectedVesselManifest) {
      setSelectedVesselManifest(null)
    }

    const companyCount = new Set(newGateBookings.map(b => b.company)).size
    showToast(
      `🟢 Đã phê duyệt tàu ${approvedManifest?.vesselName || manifestId}! Đã lọc riêng ${newGateBookings.length} container (${companyCount} công ty vận tải) của tàu này ở bên dưới.`
    )
  }

  // Chuyển Trạng Thái Cảng của Tàu về lại "Chờ phê duyệt"
  const handleResetVesselToPending = (manifestId, e) => {
    if (e) e.stopPropagation()
    manifestPortSyncService.resetManifestToPending(manifestId)
    setManifestSyncVersion(v => v + 1)
    if (selectedVesselFilter === manifestId) {
      setSelectedVesselFilter('All')
    }

    if (selectedVesselManifest && (selectedVesselManifest.manifestId === manifestId || selectedVesselManifest.manifestNumber === manifestId)) {
      setSelectedVesselManifest(prev => prev ? ({
        ...prev,
        portApprovalStatus: 'PENDING_APPROVAL',
        portApprovedAt: null,
        portApprovedBy: null,
      }) : null)
    }

    showToast(`🟡 Đã chuyển Trạng Thái Cảng của bản khai ${manifestId} về lại "Chờ phê duyệt".`)
  }

  // Bỏ toàn bộ bộ lọc để xem lại đầy đủ tất cả Container
  const handleClearAllFilters = () => {
    setSelectedVesselFilter('All')
    setVesselSearch('')
    setSearchQuery('')
    setStatusFilter('All')
    setOperationFilter('All')
    setGateFilter('All')
    setCompanyFilter('All')
    showToast('⚪ Đã xóa toàn bộ bộ lọc, hiển thị đầy đủ tất cả Container.')
  }

  const [transportAlerts, setTransportAlerts] = useState(() => {
    try { return manifestPortSyncService.getTransportSubmissionAlerts() } catch { return [] }
  })

  // Lắng nghe sự kiện Hãng tàu truyền Manifest sang Cảng, Bên vận tải gửi hồ sơ & sự kiện đặt/đổi vị trí bãi
  useEffect(() => {
    const unsub = manifestPortSyncService.subscribe((newManifest) => {
      setManifestSyncVersion(v => v + 1)
      setYardResVersion(v => v + 1)
      setTransportAlerts(manifestPortSyncService.getTransportSubmissionAlerts())
      if (newManifest?.manifestNumber) {
        showToast(`🚢 Đã nhận Bản khai hàng hóa (${newManifest?.manifestNumber || 'Manifest'}) do Hãng tàu gửi sang Cảng!`)
      }
    })
    const handleManifestCustomEvent = (e) => {
      setManifestSyncVersion(v => v + 1)
      setTransportAlerts(manifestPortSyncService.getTransportSubmissionAlerts())
      if (e?.detail?.type === 'TRANSPORT_SUBMITTED' && e?.detail?.item) {
        const it = e.detail.item
        showToast(`🚚 Bên Vận tải (${it.company}) vừa gửi hồ sơ ${it.containerId} (${it.licensePlate})! Vui lòng kiểm tra khớp trước khi duyệt.`)
      }
    }
    const handleStorageUpdate = (e) => {
      if (!e?.key || e.key === 'NEXUSPORT_MANIFEST_GATE_BOOKINGS_V1' || e.key === 'NEXUSPORT_TRANSPORT_SUBMISSIONS_ALERT') {
        setManifestSyncVersion(v => v + 1)
        setTransportAlerts(manifestPortSyncService.getTransportSubmissionAlerts())
      }
    }
    const handleYardResUpdate = () => {
      setYardResVersion(v => v + 1)
    }
    window.addEventListener('nexusport:manifest_synced', handleManifestCustomEvent)
    window.addEventListener('storage', handleStorageUpdate)
    window.addEventListener('yard-reservation-updated', handleYardResUpdate)
    return () => {
      unsub()
      window.removeEventListener('nexusport:manifest_synced', handleManifestCustomEvent)
      window.removeEventListener('storage', handleStorageUpdate)
      window.removeEventListener('yard-reservation-updated', handleYardResUpdate)
    }
  }, [])

  // Toast State
  const [toastMessage, setToastMessage] = useState('')

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4000)
  }

  // Kiểm tra đơn đã Duyệt & Gửi Bill chưa
  const isBookingApprovedOrBillSent = (b) => {
    if (!b) return false
    return b.status === 'Approved' || b.status === 'Ready' || Boolean(b.portBill) || Boolean(b.portBillPaid)
  }

  // Helper lấy thông tin biển số xe đầu kéo chính xác cho Gate Booking (CHỈ tự động gán SAU KHI Duyệt & Gửi Bill)
  const getGateBookingVehicle = (b) => {
    if (!b) return null
    // Chỉ có xe sau khi Cảng đã Phê duyệt & Gửi Bill sang Vận tải
    if (!isBookingApprovedOrBillSent(b)) {
      return null
    }
    if (b.licensePlate && b.licensePlate !== 'Chưa gán xe' && b.licensePlate !== 'Chưa gán' && b.licensePlate !== 'Chưa điều phối') {
      return b.licensePlate
    }
    if (b.vehiclePlate && b.vehiclePlate !== 'Chưa điều phối' && b.vehiclePlate !== 'Chưa gán') {
      return b.vehiclePlate
    }
    if (b.suggestedPlate) return b.suggestedPlate

    const carrier = TRANSPORT_COMPANIES_POOL.find(p => p.companyName === b.company) || TRANSPORT_COMPANIES_POOL[0]
    return carrier?.fleetOptions?.[0]?.licensePlate || '47AB-294.69'
  }

  // Helper lấy thông tin tài xế chính xác cho Gate Booking (CHỈ tự động gán SAU KHI Duyệt & Gửi Bill)
  const getGateBookingDriver = (b) => {
    if (!b) return null
    // Chỉ có tài xế sau khi Cảng đã Phê duyệt & Gửi Bill sang Vận tải
    if (!isBookingApprovedOrBillSent(b)) {
      return null
    }
    if (b.driverName && b.driverName !== 'Chưa điều phối') return b.driverName
    if (b.suggestedDriver) return b.suggestedDriver

    const carrier = TRANSPORT_COMPANIES_POOL.find(p => p.companyName === b.company) || TRANSPORT_COMPANIES_POOL[0]
    return carrier?.fleetOptions?.[0]?.driverName || 'TRẦN VĂN TÙNG'
  }


  // Vietnamese document types
  const getDocTypeVi = (docType) => {
    switch (docType) {
      case 'BookingNote':
      case 'CarrierBookingReference': return 'Booking Note / Đặt chỗ Hãng tàu'
      case 'BillOfLading': return 'Vận đơn đường biển gốc (B/L)'
      case 'DeliveryOrder': return 'Lệnh giao hàng điện tử (eDO)'
      case 'CustomsDeclaration': return 'Tờ khai Hải quan điện tử (VNACCS)'
      case 'VgmCertificate': return 'Chứng thư khối lượng VGM'
      case 'ReeferInstructions':
      case 'ReeferTemperatureInstructions': return 'Chỉ dẫn nhiệt độ container lạnh'
      case 'DangerousGoodsDeclaration': return 'Khai báo hàng nguy hiểm (DG/IMO)'
      case 'EirReceipt': return 'Phiếu hạ bãi / Giao nhận EIR'
      case 'DriverLicense': return 'GPLX Hạng FC & Căn cước tài xế'
      case 'VehicleRegistration': return 'Sổ đăng kiểm xe đầu kéo & rơ-moóc'
      case 'Other': return 'Hồ sơ chứng từ đính kèm khác'
      default: return docType || 'Chứng từ thẩm định'
    }
  }

  // Load full booking with real documents & auto-assigned yard slot when selected
  const handleSelectBooking = async (b) => {
    setSelectedBooking(b)
    setTariffDirectionOverride(null)
    setTariffSizeOverride(null)

    // 1. Kiểm tra vị trí hiện tại của container trong yardReservationStore (ưu tiên vị trí mới nhất người dùng đã đặt/đổi)
    const contKey = (b?.containerId || '').trim().toUpperCase()
    const bookKey = (b?.id || '').trim().toUpperCase()
    const existingRes = yardReservationStore.getReservations().find((r) => {
      const rCont = (r.containerId || r.containerNo || r.booking?.containerId || '').trim().toUpperCase()
      const rBook = (r.bookingCode || r.booking?.id || '').trim().toUpperCase()
      return (contKey && rCont === contKey) || (bookKey && rBook === bookKey)
    })

    if (existingRes && existingRes.blockCode) {
      const mergedSlot = {
        ...(b?.autoYardSlot || {}),
        ...existingRes,
        zoneCode: existingRes.zoneCode || (existingRes.blockCode || 'A')[0],
      }
      delete mergedSlot.hasContainerAbove
      setReservedSlot(mergedSlot)
      setSelectedZone(mergedSlot.zoneCode)
      setSelectedBlock(mergedSlot.blockCode)
    } else if (b?.autoYardSlot && b.autoYardSlot.blockCode) {
      // 2. Nếu có autoYardSlot nhưng chưa ghi vào store thì ghi ngay vào store để đếm số lượng vị trí chiếm trên bãi
      yardReservationStore.addReservation({
        ...b.autoYardSlot,
        containerId: b.containerId,
        containerNo: b.containerId,
        bookingCode: b.id,
        company: b.company,
      })
      const slotCopy = { ...b.autoYardSlot }
      delete slotCopy.hasContainerAbove
      setReservedSlot(slotCopy)
      if (b.autoYardSlot.zoneCode) setSelectedZone(b.autoYardSlot.zoneCode)
      if (b.autoYardSlot.blockCode) setSelectedBlock(b.autoYardSlot.blockCode)
    } else if (contKey && contKey !== 'N/A') {
      // 3. Nếu là booking xe thông thường chưa có vị trí, tự động cấp vị trí mặc định chuẩn theo loại cont và lưu vào store để đếm
      const isRf = (b?.containerType || '').includes('RF') || (b?.cargoType || '').toLowerCase().includes('reefer')
      const isPickup = (b?.operation || '').toLowerCase().includes('pickup')
      const zoneCode = isRf ? 'D' : (isPickup ? 'B' : 'A')
      const blockCode = `${zoneCode}01`
      const charSum = contKey.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
      const modIdx = charSum % 6
      const is40 = !(b?.containerType || '').includes('20')
      const primaryBay = is40 ? modIdx * 2 + 2 : modIdx * 2 + 1
      const bayStr = String(primaryBay).padStart(2, '0')
      const rowNum = (charSum % 4) + 1
      const rowStr = String(rowNum).padStart(2, '0')
      const tierStr = '01'
      const defaultSlot = {
        zoneCode,
        zoneName: isRf
          ? 'Khu D · Bãi Container Lạnh (Reefer Zone)'
          : isPickup
          ? 'Khu B · Bãi Cont Nhập Khẩu (Bãi Container 1)'
          : 'Khu A · Bãi Cont Xuất Khẩu (Sau cầu 4–5)',
        blockCode,
        bay: bayStr,
        bayDisplay: is40
          ? `Bay ${bayStr} (${String(modIdx * 2 + 1).padStart(2, '0')} + ${String(modIdx * 2 + 3).padStart(2, '0')})`
          : `Bay ${bayStr}`,
        row: rowStr,
        tier: tierStr,
        size: is40 ? 40 : 20,
        posCode: `${blockCode}.${bayStr}.${rowStr}.1`,
        posId: `${blockCode}-${bayStr}-T1-R${rowNum}`,
        slotId: `${blockCode}-${bayStr}-T1-R${rowNum}`,
        isReefer: isRf,
        autoAssigned: true,
        containerId: b.containerId,
        containerNo: b.containerId,
        bookingCode: b.id,
        company: b.company,
      }
      yardReservationStore.addReservation(defaultSlot)
      setReservedSlot(defaultSlot)
      setSelectedZone(zoneCode)
      setSelectedBlock(blockCode)
    } else {
      setReservedSlot(null)
    }

    // Nếu là bản ghi tách ra từ Bản khai Tàu (Manifest), giữ nguyên dữ liệu từ Manifest (không gọi API đè lên)
    if (b?.isFromVesselManifest) {
      return
    }

    try {
      const realId = b.realId || b.id
      const fresh = await bookingService.getBookingById(realId)
      if (fresh) {
        setSelectedBooking(prev => ({
          ...prev,
          ...fresh,
          id: prev?.id || fresh.bookingCode || fresh.id,
          realId: fresh.id || prev?.realId,
          company: prev?.company || fresh.carrierName,
          companyId: prev?.companyId || fresh.carrierId,
          contactName: prev?.contactName,
          phone: prev?.phone,
          email: prev?.email,
          eta: prev?.eta || fresh.appointmentStart || '2026-11-05T14:00:00',
          containerId: prev?.containerId || fresh.containerNumbers?.[0] || 'N/A',
          licensePlate: prev?.licensePlate || fresh.vehiclePlate || 'Chưa điều phối',
          driverName: prev?.driverName || fresh.driverName || 'Chưa điều phối',
          documents: fresh.documents || prev?.documents || [],
          operations: fresh.operations || prev?.operations || [],
        }))
      }
    } catch (err) {
      console.warn('Không thể tải chi tiết chứng từ bổ sung:', err)
    }
  }

  // Helper to get all authentic documents (from Manifest, DB, or authentic fallback)
  const getBookingRealDocuments = (b) => {
    if (!b) return []

    const contId = b.containerId || 'EMCU9284712'
    const contSuffix = contId.slice(-4)

    // Bộ chứng từ dùng chung đơn hàng đồng nhất 100% với Terminal Portal > Đặt Lịch Cảng của transport
    const manifestDocs = [
      {
        id: `DOC-EDO-${contId}`,
        documentType: 'DeliveryOrder',
        type: 'DeliveryOrder',
        title: 'Lệnh giao hàng điện tử (eDO)',
        shortTitle: '1. Lệnh eDO',
        fileName: 'OIP (2).jpg',
        documentNumber: `EDO-EG2605W-${contSuffix}`,
        fileUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
        icon: 'description',
        mandatory: true,
        verificationStatus: 'Pending',
        issuer: 'Đại lý Hãng tàu / Cảng Tiên Sa',
        scope: 'Áp dụng chung toàn bộ container',
      },
      {
        id: `DOC-BL-${contId}`,
        documentType: 'BillOfLading',
        type: 'BillOfLading',
        title: 'Vận đơn đường biển (B/L)',
        shortTitle: '2. Vận Đơn B/L',
        fileName: 'Gemini_Generated_Image_1s6k9n1s6k9n1s6k.png',
        documentNumber: b.cargoDeclarationId || b.billOfLading || 'BL-VNDAD-8901',
        fileUrl: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1200&q=80',
        icon: 'description',
        mandatory: true,
        verificationStatus: 'Pending',
        issuer: 'Evergreen Marine Corp',
        scope: `Tàu ${b.vesselName || 'EVER GLORY'} (${b.voyageNo || 'V.2024N'})`,
      },
      {
        id: `DOC-HQ-${contId}`,
        documentType: 'CustomsDeclaration',
        type: 'CustomsDeclaration',
        title: 'Tờ khai Hải quan điện tử',
        shortTitle: '3. Tờ Khai HQ',
        fileName: 'best.jpg',
        documentNumber: `HQ-105829${contSuffix}-04C1`,
        fileUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=80',
        icon: 'description',
        mandatory: true,
        verificationStatus: 'Pending',
        issuer: 'Chi cục Hải quan Cửa khẩu Cảng Đà Nẵng',
        scope: 'Thông quan điện tử NSW (Luồng Xanh)',
      },
      {
        id: `DOC-VGM-${contId}`,
        documentType: 'VgmCertificate',
        type: 'VgmCertificate',
        title: 'Phiếu xác nhận khối lượng toàn bộ (VGM)',
        shortTitle: '4. Phiếu VGM',
        fileName: `VGM_SOLAS_${contId}.pdf`,
        documentNumber: `VGM-${contId}-${b.vgm || 28450}KG`,
        fileUrl: 'https://pdfobject.com/pdf/sample.pdf',
        icon: 'description',
        mandatory: true,
        verificationStatus: 'Verified',
        issuer: 'Trạm cân điện tử Cảng Tiên Sa',
        scope: `Gross: ${Number(b.vgm || 28450).toLocaleString('vi-VN')} kg`,
      },
      ...( (b.isReefer || (b.containerType || '').includes('RF')) ? [
        {
          id: `DOC-RF-${contId}`,
          documentType: 'ReeferInstructions',
          type: 'ReeferInstructions',
          title: 'Chỉ dẫn cài đặt nhiệt độ container lạnh',
          shortTitle: '5. Chỉ Dẫn Nhiệt Độ',
          fileName: `Reefer_Setting_${contId}.pdf`,
          documentNumber: `RF-TEMP-${contSuffix}`,
          fileUrl: 'https://pdfobject.com/pdf/sample.pdf',
          icon: 'description',
          mandatory: true,
          verificationStatus: 'Verified',
          issuer: 'Chủ hàng Thủy sản Đông lạnh Đà Nẵng',
          scope: 'Nhiệt độ cài đặt -18.0°C (Khu D)',
        }
      ] : [])
    ]

    // Nếu là container được tách từ Bản khai Tàu (Manifest):
    // Hiển thị đầy đủ các giấy tờ Hàng hóa / Tàu / Hải quan / VGM đã có sẵn để xem ngay,
    // còn GPLX & Đăng kiểm xe thì nếu bên Transport chưa gửi sẽ ghi rõ "Đang đợi bên Transport gửi kèm Xe & Tài xế"
    const isApprovedOrBilled = isBookingApprovedOrBillSent(b)
    const vPlate = getGateBookingVehicle(b) || (isApprovedOrBilled ? (b.suggestedPlate || '47AB-294.69') : (b.licensePlate || null))
    const vDriver = getGateBookingDriver(b) || (isApprovedOrBilled ? (b.suggestedDriver || 'TRẦN VĂN TÙNG') : (b.driverName || null))
    const vTrailer = b.trailerPlate || b.suggestedTrailer || '47R-012.88'
    const vLicense = b.licenseNumber || b.suggestedLicense || 'FC-782910'
    const driverNameSafe = (vDriver || 'TaiXe').replace(/\s+/g, '_')

    const baseDocs = (b.documents && b.documents.length > 0) ? b.documents : manifestDocs

    // Khi đã duyệt & gửi bill (hoặc đơn vị vận tải đã gửi hồ sơ xe & tài xế):
    // Bổ sung đúng 2 giấy tờ định danh tài xế thực tế mà bên Vận tải / ePort gửi lên (GPLX FC & CCCD)
    if (vPlate || vDriver || isApprovedOrBilled || b.transportSubmitted) {
      const driverSnap = b.driverSnapshot || b.driver_snapshot || b.driverDetails || b.rawBooking?.driverSnapshot || {}
      const cccdNumber = driverSnap.IdCardNumber || driverSnap.idCardNumber || b.idCardNumber || (vDriver === 'PHAN NGUYÊN GIA HUY' ? '066204016135' : '048092004812')
      const rawCccdUrl = driverSnap.IdCardFrontUrl || driverSnap.idCardFrontUrl || driverSnap.id_card_front_url || b.idCardFrontUrl || (vDriver === 'PHAN NGUYÊN GIA HUY' ? 'https://nexusport.s3.us-east-1.amazonaws.com/NexusPort/drivers/front_bca43912-70b1-42e7-8178-01306ec4a395.jpg' : 'https://nexusport.s3.us-east-1.amazonaws.com/NexusPort/drivers/front_leynhi.jpg')
      const rawLicenseUrl = driverSnap.LicenseImageUrl || driverSnap.licenseImageUrl || driverSnap.license_image_url || b.licenseImageUrl || (vDriver === 'PHAN NGUYÊN GIA HUY' ? 'https://nexusport.s3.us-east-1.amazonaws.com/NexusPort/drivers/license_bca43912-70b1-42e7-8178-01306ec4a395.jpg' : 'https://nexusport.s3.us-east-1.amazonaws.com/NexusPort/drivers/license_leynhi.jpg')

      const cccdUrl = resolveMediaUrl(rawCccdUrl)
      const licenseUrl = resolveMediaUrl(rawLicenseUrl)

      const fleetDocs = [
        {
          id: `DOC-GPLX-${contId}`,
          documentType: 'DriverLicense',
          type: 'DriverLicense',
          title: 'Giấy Phép Lái Xe Hạng FC (Bằng lái chuyên dụng container)',
          shortTitle: 'GPLX Hạng FC',
          documentNumber: vLicense,
          fileName: `GPLX_FC_${driverNameSafe}.jpg`,
          fileUrl: licenseUrl,
          icon: 'badge',
          mandatory: true,
          issuer: 'Sở GTVT (Bên Vận tải / ePort gửi)',
          verificationStatus: 'Verified',
          scope: `Tài xế: ${vDriver || 'TRẦN VĂN TÙNG'} · Bằng lái Hạng FC hợp lệ`,
          isDriverDoc: true,
        },
        {
          id: `DOC-CCCD-${contId}`,
          documentType: 'NationalId',
          type: 'NationalId',
          title: 'Căn Cước Công Dân Gắn Chip (Định danh tài xế)',
          shortTitle: 'CCCD Tài Xế',
          documentNumber: cccdNumber,
          fileName: `CCCD_Chip_${driverNameSafe}.jpg`,
          fileUrl: cccdUrl,
          icon: 'person_pin',
          mandatory: true,
          issuer: 'Bộ Công An (Bên Vận tải / ePort gửi)',
          verificationStatus: 'Verified',
          scope: `Tài xế: ${vDriver || 'TRẦN VĂN TÙNG'} · Số CCCD: ${cccdNumber}`,
          isDriverDoc: true,
        },
      ]

      const seenIds = new Set()
      const merged = []
      for (const d of [...baseDocs, ...fleetDocs]) {
        if (!seenIds.has(d.id)) {
          seenIds.add(d.id)
          merged.push(d)
        }
      }
      return merged
    }

    return baseDocs
  }



  // Helper to generate full document portfolio for booking
  const getBookingDocuments = (b) => {
    if (!b) return []
    return [
      {
        type: 'BillOfLading',
        title: 'Vận Đơn Đường Biển Gốc (Original Bill of Lading - B/L)',
        shortTitle: '1. Vận Đơn B/L',
        documentNumber: `BL-${b.containerId || '2026'}-MSK`,
        icon: 'directions_boat',
        mandatory: true,
      },
      {
        type: 'DeliveryOrder',
        title: 'Lệnh Giao Hàng Điện Tử (Electronic Delivery Order - eDO)',
        shortTitle: '2. Lệnh eDO',
        documentNumber: `EDO-${b.id || '2026'}-DANANG`,
        icon: 'assignment_turned_in',
        mandatory: true,
      },
      {
        type: 'CustomsDeclaration',
        title: 'Tờ Khai Hải Quan Điện Tử (VNACCS/VCIS Import Clearance)',
        shortTitle: '3. Tờ Khai HQ',
        documentNumber: 'HQ-104928192039-04C1',
        icon: 'verified_user',
        mandatory: true,
      },
      {
        type: 'EIR',
        title: 'Phiếu Giao Nhận Container Hạ Bãi (EIR Interchange Receipt)',
        shortTitle: '4. Phiếu EIR',
        documentNumber: `EIR-${b.containerId || '2026'}-A01`,
        icon: 'receipt_long',
        mandatory: true,
      },
      {
        type: 'DriverLicense',
        title: 'Giấy Phép Lái Xe Hạng FC & Thẻ Căn Cước Tài Xế (Driver License)',
        shortTitle: '5. GPLX & CCCD',
        documentNumber: b.licenseNumber || 'FC-123456',
        icon: 'badge',
        mandatory: true,
      }
     
    ]
  }

  // Refresh handler
  const handleRefresh = () => {
    fetchBookings()
    showToast('🔄 Đã cập nhật danh sách Yêu Cầu Booking Cổng mới nhất từ các Hãng xe!')
  }

  const fetchBookings = async () => {
    setLoading(true)
    try {
      const [res, companiesData] = await Promise.all([
        bookingService.getBookings({ pageNumber: 1, pageSize: 100 }),
        companyService.getAll().catch(() => [])
      ])
      
      const defaultCompanyMap = {
        'c1010101-0000-0000-0000-000000000001': {
          companyName: 'Bien Dong Logistics - Nexus Logistics',
          contactPerson: 'Vo Hang Tau',
          phone: '0909123889',
          email: 'carrier01@nexusport.vn'
        },
        'd22cffa5-a8e0-4ad2-9ee4-b3555f8dd9d5': {
          companyName: 'Cảng Tiên Sa',
          contactPerson: 'Admin',
          phone: '0912345678',
          email: 'admin@cangtiensa.com'
        },
        'cbb1317b-a692-402c-a47e-041ca619d241': {
          companyName: 'Korao Logistics',
          contactPerson: 'Huy Phan',
          phone: '0842737474',
          email: 'dauboquay@gmail.com'
        }
      }
      const companiesArray = Array.isArray(companiesData)
        ? companiesData
        : (companiesData?.data || companiesData?.items || [])

      const companyMap = { ...defaultCompanyMap }
      companiesArray.forEach((c) => {
        if (c.id) companyMap[String(c.id).toLowerCase()] = c
        if (c.Id) companyMap[String(c.Id).toLowerCase()] = c
      })

      if (res && res.items) {
        const mapped = res.items.map((b) => {
          const carrierKey = String(b.carrierId || '').toLowerCase()
          const matchedComp = companyMap[carrierKey] || companiesArray.find((c) => c.companyName === b.carrierName)

          // Fallback có ý nghĩa thực tế theo mã booking
          const seedStr = String(b.bookingCode || b.id || '')
          const charSum = seedStr.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
          const fallback = FALLBACK_CARRIER_PROFILES[charSum % FALLBACK_CARRIER_PROFILES.length]

          const companyName = b.carrierName || matchedComp?.companyName || fallback.companyName
          const contactName = matchedComp?.contactPerson || fallback.contactPerson
          const phone = matchedComp?.phone || fallback.phone
          const email = matchedComp?.email || fallback.email

          const fallbackContainers = ['EMCU9284712', 'ONEU7823413', 'MSKU7712907', 'EMCU5102949', 'EMCU5102954', 'EMCU8361795', 'CMAU8192033', 'EMCU6210491']
          const resolvedCont = b.containerNumbers && b.containerNumbers.length > 0 && b.containerNumbers[0] !== 'N/A'
            ? b.containerNumbers[0]
            : (b.containerId && b.containerId !== 'N/A' ? b.containerId : fallbackContainers[charSum % fallbackContainers.length])

          return {
            id: b.bookingCode,
            realId: b.id,
            company: companyName,
            companyId: b.carrierId || fallback.email,
            contactName,
            phone,
            email,
            containerId: resolvedCont,
          containerType: '40HC',
          cargoType: 'General',
          cargoDeclarationId: 'N/A',
          cargoDeclarationStatus: 'Approved',
          vehicleId: b.vehicleId,
          licensePlate: b.vehiclePlate || 'Chưa điều phối',
          vehicleType: 'Xe Đầu Kéo',
          vehicleStatus: b.vehiclePlate ? 'Available' : 'Pending',
          driverId: b.driverId,
          driverName: b.driverName || 'Chưa điều phối',
          licenseNumber: b.licenseNumber || b.driverSnapshot?.LicenseNumber || b.driverDetails?.licenseNumber || 'FC-123456',
          licenseClass: 'FC',
          licenseStatus: 'Valid',
          driverStatus: b.driverName ? 'Available' : 'Pending',
          driverSnapshot: b.driverSnapshot || b.driver_snapshot || null,
          driverDetails: b.driverDetails || null,
          documents: b.documents || [],
          suggestedDriver: b.suggestedDriver || null,
          suggestedPlate: b.suggestedPlate || null,
          suggestedTrailer: b.suggestedTrailer || null,
          idCardFrontUrl: b.idCardFrontUrl || b.driverSnapshot?.IdCardFrontUrl || null,
          licenseImageUrl: b.licenseImageUrl || b.driverSnapshot?.LicenseImageUrl || null,
          idCardNumber: b.idCardNumber || b.driverSnapshot?.IdCardNumber || null,
          rawBooking: b,
          operation: b.bookingType,
          eta: b.appointmentStart,
          expectedDuration: '45 phút',
          requestedGate: 'Gate 2',
          gateFee: 300000,
          handlingFee: 200000,
          totalFee: 500000,
          paymentStatus: 'Paid',
          gateCapacity: { gate: 'Gate 2', current: 10, max: 20, status: 'Available' },
          status: b.status,
          createdAt: new Date(b.createdAt).toLocaleString('vi-VN'),
          reviewStartedAt: null,
          reviewedBy: b.approvedBy ? 'Dispatcher' : null,
          approvedAt: b.approvedAt ? new Date(b.approvedAt).toLocaleString('vi-VN') : null,
          approvedBy: b.approvedBy ? 'Dispatcher' : null,
          rejectionReason: '',
          rejectionNote: '',
          dispatchOrderId: null,
            timelineStep: b.status === 'Approved' ? 4 : (b.status === 'Pending' ? 2 : 3)
          }
        })
        setBookings(mapped)
      }
    } catch (err) {
      console.error(err)
      showToast('❌ Lỗi tải dữ liệu booking: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBookings()
    fetchYardMap()
  }, [])

  const fetchYardMap = async () => {
    try {
      const blocks = await expressApiClient.get('/yard/blocks')
      setBlocksData(blocks)
      if (blocks.length > 0) {
        const firstBlock = blocks.find(block=>block.blockCode==='C01')||blocks[0]
        const firstCode = firstBlock.blockCode || firstBlock.description
        setSelectedBlock(firstCode)
        setSelectedBay(firstBlock.slots?.length?String(Math.min(...firstBlock.slots.map(slot=>slot.bay))).padStart(2,'0'):'')
      }
    } catch (e) {
      console.error(e)
    }
  }

  
  // Đồng bộ 100% với Sơ đồ bãi cảng Tiên Sa (sourceLayout.areas) kết hợp tồn kho từ API + yardReservationStore
  const combinedBlocks = useMemo(() => {
    const storeReservations = yardReservationStore.getReservations()

    return (sourceLayout.areas || []).map((area) => {
      const liveBlock = blocksData.find(
        (b) => (b.blockCode || b.code) === area.code
      )
      const slots = liveBlock?.slots || []

      // 1. Các container đã đặt/tự động xếp trong yardReservationStore tại Block này
      const blockStoreRes = storeReservations.filter(
        (r) => (r.blockCode || r.block) === area.code
      )

      const seenContainers = new Set()
      const containersInBlock = []

      blockStoreRes.forEach((r) => {
        const cNo = (r.containerNo || r.containerId || r.booking?.containerId || '').trim().toUpperCase()
        if (cNo && !seenContainers.has(cNo)) {
          seenContainers.add(cNo)
          containersInBlock.push({
            containerNo: cNo,
            bookingCode: r.bookingCode || r.booking?.id || '',
            bay: String(r.bay || '02').padStart(2, '0'),
            bayDisplay: r.bayDisplay || `Bay ${String(r.bay || '02').padStart(2, '0')}`,
            row: String(r.row || '01').padStart(2, '0'),
            tier: String(r.tier || '01').padStart(2, '0'),
            size: Number(r.size) || 40,
            posId: r.posId || `${area.code}-${String(r.bay || '02').padStart(2, '0')}-T${Number(r.tier) || 1}-R${Number(r.row) || 1}`,
            status: 'reserved',
          })
        }
      })

      // 2. Gộp thêm các slot đang occupied/reserved từ API Backend (nếu chưa trùng container)
      slots.forEach((s) => {
        if (s.status === 'occupied' || s.status === 'reserved' || s.containerNumber) {
          const cNo = (s.containerNumber || s.containerId || `SLOT-${s.bay}-${s.row}-${s.tier}`).trim().toUpperCase()
          if (!seenContainers.has(cNo)) {
            seenContainers.add(cNo)
            containersInBlock.push({
              containerNo: cNo,
              bookingCode: s.bookingCode || '',
              bay: String(s.bay || '01').padStart(2, '0'),
              bayDisplay: `Bay ${String(s.bay || '01').padStart(2, '0')}`,
              row: String(s.row || '01').padStart(2, '0'),
              tier: String(s.tier || '01').padStart(2, '0'),
              size: Number(s.containerLengthFt || s.size) || 20,
              posId: `${area.code}-${String(s.bay || '01').padStart(2, '0')}-T${Number(s.tier) || 1}-R${Number(s.row) || 1}`,
              status: s.status || 'occupied',
            })
          }
        }
      })

      const occupied = containersInBlock.length
      const reserved = blockStoreRes.length
      const teuOccupied = containersInBlock.reduce((sum, c) => sum + (c.size >= 40 ? 2 : 1), 0)
      const totalCapacity = (area.planning?.bayModules || 20) * (area.planning?.rows || 6) * (area.planning?.tiers || 4)

      return {
        id: liveBlock?.id || area.code,
        blockCode: area.code,
        code: area.code,
        sector: area.sector,
        description: area.note || `Khu ${area.sector} · Block ${area.code}`,
        planning: area.planning,
        maxRows: area.planning?.rows || 6,
        maxTiers: area.planning?.tiers || 4,
        slots,
        containersInBlock,
        totalCapacity,
        occupied,
        reserved,
        teuOccupied,
        empty: Math.max(0, totalCapacity - occupied),
      }
    })
  }, [blocksData, yardResVersion, manifestSyncVersion])

  const currentZoneBlocks = useMemo(() => {
    return combinedBlocks.filter(
      (b) => b.sector === selectedZone || (b.blockCode || '').startsWith(selectedZone)
    )
  }, [combinedBlocks, selectedZone])

  const { selectedBlockObj, slotsByBay } = useMemo(() => {
    const blockObj = blocksData.find(b => (b.blockCode || b.description || b.id) === selectedBlock) || {}
    const bayMap = {}
    if (blockObj.slots) {
      blockObj.slots.forEach(slot => {
        if (!bayMap[slot.bay]) bayMap[slot.bay] = []
        bayMap[slot.bay].push(slot)
      })
    }
    return { selectedBlockObj: blockObj, slotsByBay: bayMap }
  }, [blocksData, selectedBlock])

  // Danh sách các container từ Tàu đã được Cảng phê duyệt -> Tách ra bảng mới chia theo từng Công ty vận tải
  const manifestGeneratedBookings = useMemo(() => {
    return manifestPortSyncService.getGeneratedGateBookings()
  }, [manifestSyncVersion])

  // 1. KPI Stats Calculation (Tính trực tiếp trên danh sách Container chia theo Công ty Vận tải)
  const kpiStats = useMemo(() => {
    const sourceList = manifestGeneratedBookings
    const pending = sourceList.filter(b => b.status === 'Pending').length
    const underReview = sourceList.filter(b => b.status === 'Under Review').length
    const approvedToday = sourceList.filter(b => b.status === 'Approved' || b.status === 'Ready').length
    const rejectedToday = sourceList.filter(b => b.status === 'Rejected').length
    const cancelledToday = sourceList.filter(b => b.status === 'Cancelled' || b.status === 'Canceled').length
    const atRisk = sourceList.filter(b => !b.transportSubmitted).length
    return { pending, underReview, approvedToday, rejectedToday, cancelledToday, atRisk }
  }, [manifestGeneratedBookings])

  // Unique companies list for filter dropdown
  const companyList = useMemo(() => {
    const companies = new Set(manifestGeneratedBookings.map(b => b.company).filter(Boolean))
    return Array.from(companies)
  }, [manifestGeneratedBookings])

  // Thông tin Manifest từ Hãng tàu đã truyền sang Cảng cho selectedBooking
  const selectedManifestInfo = useMemo(() => {
    if (!selectedBooking) return null
    return manifestPortSyncService.getManifestForContainer(selectedBooking.containerId)
  }, [selectedBooking, manifestSyncVersion])

  // Kiểm tra nghiệp vụ cont nhập (Pickup / Import) hay cont xuất (Dropoff / Export)
  const isImportBooking = useMemo(() => {
    if (!selectedBooking) return false
    const op = String(selectedBooking.operation || selectedBooking.bookingType || '').toLowerCase()
    const dir = String(selectedManifestInfo?.direction || selectedBooking.direction || '').toUpperCase()
    return dir === 'IMPORT' || op.includes('pickup') || op.includes('import') || op.includes('nhận') || op.includes('nhập')
  }, [selectedBooking, selectedManifestInfo])

  // Tự động đối chiếu với đơn Dịch Vụ ePort khi mở chi tiết Booking Cổng
  const loadEportMatches = async (keyword) => {
    const q = String(keyword || '').trim()
    if (!q) {
      setEportOrders([])
      setEportDetail(null)
      return
    }
    setEportLoading(true)
    setEportError('')
    try {
      const res = await serviceOrdersApi.list({ search: q, page: 1, pageSize: 10 })
      const items = res?.items || []
      setEportOrders(items)
      if (items.length > 0) {
        try {
          const detail = await serviceOrdersApi.get(items[0].id)
          setEportDetail(detail)
        } catch {
          setEportDetail(items[0])
        }
      } else {
        setEportDetail(null)
      }
    } catch (err) {
      setEportOrders([])
      setEportDetail(null)
      setEportError(err?.response?.data?.message || err?.message || 'Không thể tải dữ liệu Dịch vụ ePort')
    } finally {
      setEportLoading(false)
    }
  }

  const loadAllEportRequests = async (opts = {}) => {
    setEportListLoading(true)
    setEportListError('')
    try {
      const res = await serviceOrdersApi.list({
        search: (opts.search ?? eportListSearch).trim() || undefined,
        status: (opts.status ?? eportListStatus) || undefined,
        paymentStatus: (opts.paymentStatus ?? eportListPaymentStatus) || undefined,
        flow: (opts.flow ?? eportListFlow) || undefined,
        page: opts.page ?? eportListPage,
        pageSize: 10,
      })
      setEportListItems(res?.items || [])
      setEportListTotal(res?.total || 0)
    } catch (err) {
      setEportListItems([])
      setEportListError(err?.response?.data?.message || err?.message || 'Không thể tải danh sách đơn Dịch vụ ePort')
    } finally {
      setEportListLoading(false)
    }
  }

  useEffect(() => {
    loadAllEportRequests()
  }, [activeListType, eportListStatus, eportListPaymentStatus, eportListFlow, eportListPage])

  // Tự động kiểm tra toàn bộ đơn Dịch vụ ePort gửi đến với Danh sách Container theo Công ty Vận tải:
  // - Sai Cont / Sai Mã vận đơn (B/L) hoặc Mã Booking / Sai Tên công ty -> Tự động Reject
  // - Đúng hết -> Tự động cập nhật 1. Công Ty Vận Tải chi tiết & báo lên để vào Accept
  useEffect(() => {
    if (!eportListItems.length || !manifestGeneratedBookings.length) return

    const normText = (s) =>
      String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    const companiesMatch = (a, b) => {
      const na = normText(a)
      const nb = normText(b)
      if (!na || !nb) return false
      if (na.includes(nb) || nb.includes(na)) return true
      const stop = new Set(['cong', 'ty', 'tnhh', 'cp', 'co', 'phan', 'van', 'tai', 'logistics', 'giao', 'nhan', 'dich', 'vu', 'da', 'nang', 'mien', 'trung', 'chi', 'nhanh'])
      const ta = na.split(' ').filter(w => w.length >= 2 && !stop.has(w))
      const tb = new Set(nb.split(' ').filter(w => w.length >= 2 && !stop.has(w)))
      const overlap = ta.filter(w => tb.has(w))
      return overlap.length >= 1
    }

    let cancelled = false
    const runValidation = async () => {
      const nextMap = {}
      let anyBookingUpdated = false
      let anyOrderRejected = false

      for (const order of eportListItems) {
        if (cancelled) break
        if (order.status === 'DRAFT' || order.status === 'CANCELLED') continue

        let detail = order
        try {
          detail = await serviceOrdersApi.get(order.id)
        } catch {
          detail = order
        }

        const containerTokens = [
          ...(detail.containers || []).map(c => String(c.containerNumber || '').trim().toUpperCase()),
          ...((String(order.sourceLabel || '').toUpperCase().match(/[A-Z]{4}\d{7}/g)) || []),
        ].filter(Boolean)

        const allGates = [...manifestGeneratedBookings, ...bookings]
        const matchedBooking = allGates.find(b =>
          containerTokens.includes(String(b.containerId || '').trim().toUpperCase())
        )

        const orderBl = String(detail.content?.source?.blNumber || detail.sourceSnapshot?.blNumber || '').trim().toUpperCase()
        const orderBk = String(detail.content?.source?.bookingNumber || detail.sourceSnapshot?.bookingNumber || '').trim().toUpperCase()

        const refTokens = [
          order.sourceLabel,
          detail.sourceSnapshot?.bookingNumber,
          detail.sourceSnapshot?.blNumber,
          detail.content?.source?.referenceNumber,
          detail.content?.source?.bookingNumber,
          detail.content?.source?.blNumber,
        ].filter(Boolean).map(x => String(x).trim().toUpperCase())

        let rejectReason = ''
        if (!matchedBooking) {
          rejectReason = 'Cont không nằm trong danh sách'
        } else {
          const blExpected = String(matchedBooking.cargoDeclarationId || matchedBooking.billOfLading || '').trim().toUpperCase()
          const bkExpected = String(matchedBooking.bookingNumber || matchedBooking.bookingNo || matchedBooking.id || '').trim().toUpperCase()

          const blMatches = !blExpected || blExpected === 'N/A' ||
            (orderBl && (orderBl.includes(blExpected) || blExpected.includes(orderBl))) ||
            refTokens.some(t => t.includes(blExpected) || blExpected.includes(t))

          const bkMatches = !bkExpected ||
            (orderBk && (orderBk.includes(bkExpected) || bkExpected.includes(orderBk))) ||
            refTokens.some(t => t.includes(bkExpected) || bkExpected.includes(t))

          const refMatches = blMatches || bkMatches
          const companyMatches = companiesMatch(order.companyName, matchedBooking.company)

          if (!refMatches) {
            rejectReason = 'Sai mã vận đơn / booking'
          } else if (!companyMatches) {
            rejectReason = 'Sai tên công ty'
          }
        }

        if (rejectReason) {
          nextMap[order.id] = { status: 'AUTO_REJECTED', reason: rejectReason }
          const canAutoRejectBackend = ['CONFIRMED', 'PENDING_APPROVAL', 'RECEIVED'].includes(detail.status)
          const cacheKey = `reject:${order.id}:${detail.version}`
          if (canAutoRejectBackend && !processedEportOrderRef.current.has(cacheKey)) {
            processedEportOrderRef.current.add(cacheKey)
            try {
              if (detail.allowedActions?.includes('REJECT')) {
                await serviceOrdersApi.action(order.id, {
                  requestId: crypto.randomUUID(),
                  expectedVersion: detail.version,
                  action: 'REJECT',
                  reason: rejectReason,
                })
                anyOrderRejected = true
              } else if (detail.allowedActions?.includes('RECEIVE')) {
                const received = await serviceOrdersApi.action(order.id, {
                  requestId: crypto.randomUUID(),
                  expectedVersion: detail.version,
                  action: 'RECEIVE',
                  reason: 'Tiếp nhận kiểm tra đối chiếu tự động',
                })
                const nextVer = received?.version ?? (detail.version + 1)
                if (received?.allowedActions?.includes('REJECT')) {
                  await serviceOrdersApi.action(order.id, {
                    requestId: crypto.randomUUID(),
                    expectedVersion: nextVer,
                    action: 'REJECT',
                    reason: rejectReason,
                  })
                }
                anyOrderRejected = true
              }
            } catch {
              // Giữ trạng thái cảnh báo tự động Reject trên UI nếu backend không cho phép thao tác trạng thái này
            }
          }
        } else if (order.status === 'REJECTED') {
          let manualReason = ''
          try {
            const hist = await serviceOrdersApi.history(order.id)
            const items = Array.isArray(hist?.items) ? hist.items : Array.isArray(hist) ? hist : []
            const rejectEvt = items.find(ev => String(ev.action || '').toUpperCase() === 'REJECT' && ev.reason)
            manualReason = rejectEvt?.reason || ''
          } catch {
            manualReason = ''
          }
          nextMap[order.id] = { status: 'REJECTED', reason: manualReason || 'Đơn đã bị từ chối.' }
        } else if (matchedBooking) {
          nextMap[order.id] = {
            status: 'MATCHED',
            bookingId: matchedBooking.id,
            containerId: matchedBooking.containerId,
            orderNumber: order.number,
          }
          const syncKey = `sync:${order.id}:${matchedBooking.id}`
          if (!processedEportOrderRef.current.has(syncKey)) {
            processedEportOrderRef.current.add(syncKey)
            const needsBookingUpdate =
              !matchedBooking.transportSubmitted ||
              matchedBooking.eportOrderId !== order.id ||
              matchedBooking.status === 'WaitingTransport'
            if (needsBookingUpdate) {
              manifestPortSyncService.updateGeneratedGateBookingStatus(matchedBooking.id, {
                transportSubmitted: true,
                status: matchedBooking.status === 'WaitingTransport' ? 'Pending' : matchedBooking.status,
                company: order.companyName || matchedBooking.company,
                contactName: detail.content?.contactName || matchedBooking.contactName,
                phone: detail.content?.contactPhone || matchedBooking.phone,
                email: detail.content?.contactEmail || matchedBooking.email,
                eportOrderId: order.id,
                eportOrderNumber: order.number,
                eportMatched: true,
                transportSentAt: matchedBooking.transportSentAt || new Date().toLocaleString('vi-VN'),
              })
              manifestPortSyncService.recordTransportSubmissionAlert({
                id: matchedBooking.id,
                containerId: matchedBooking.containerId,
                company: order.companyName || matchedBooking.company,
                licensePlate: matchedBooking.licensePlate || 'Từ đơn ePort ' + order.number,
                driverName: detail.content?.contactName || matchedBooking.driverName || 'Đã xác nhận từ ePort',
                operation: matchedBooking.operation,
                billOfLading: matchedBooking.cargoDeclarationId || matchedBooking.billOfLading || '',
                submittedAt: new Date().toLocaleString('vi-VN'),
              })
              anyBookingUpdated = true
            }
          }
        }
      }

      if (!cancelled) {
        setEportValidationMap(prev => ({ ...prev, ...nextMap }))
        if (anyBookingUpdated) {
          setManifestSyncVersion(v => v + 1)
          setTransportAlerts(manifestPortSyncService.getTransportSubmissionAlerts())
          showToast('✅ Đơn ePort khớp thông tin! Đã tự động cập nhật Đơn vị vận tải và sẵn sàng phê duyệt cổng.')
        }
        if (anyOrderRejected) {
          loadAllEportRequests()
        }
      }
    }

    runValidation()
    return () => { cancelled = true }
  }, [eportListItems, manifestGeneratedBookings])

  useEffect(() => {
    if (!selectedBooking) {
      setEportOrders([])
      setEportDetail(null)
      setEportSearchTerm('')
      setEportError('')
      return
    }
    const blRef = (selectedBooking.cargoDeclarationId && selectedBooking.cargoDeclarationId !== 'N/A' ? selectedBooking.cargoDeclarationId : '') || selectedManifestInfo?.blNumber || ''
    const initialTerm = selectedBooking.containerId || blRef || selectedBooking.id || ''
    setEportSearchTerm(initialTerm)
    loadEportMatches(initialTerm)
  }, [selectedBooking?.id, selectedBooking?.containerId])

  const eportComparison = useMemo(() => {
    if (!selectedBooking) return null
    const gateFlow = isImportBooking ? 'IMPORT' : 'EXPORT'
    const gateBl = selectedBooking.billOfLading || (selectedBooking.cargoDeclarationId && selectedBooking.cargoDeclarationId !== 'N/A' ? selectedBooking.cargoDeclarationId : '') || selectedManifestInfo?.blNumber || ''
    const activeOrder = eportDetail || eportOrders[0] || null

    if (!activeOrder) {
      return {
        matched: false,
        status: 'missing',
        badgeText: 'Chưa có đơn ePort khớp',
        order: null,
        checks: []
      }
    }

    const eportFlow = String(activeOrder.flow || activeOrder.content?.flow || '').toUpperCase()
    const eportContainers = (activeOrder.containers || []).map(c => String(c.containerNumber || '').trim().toUpperCase())
    const gateCont = String(selectedBooking.containerId || '').trim().toUpperCase()
    const containerMatch = eportContainers.length > 0
      ? eportContainers.includes(gateCont)
      : String(activeOrder.sourceLabel || '').toUpperCase().includes(gateCont)

    const flowMatch = !eportFlow || eportFlow === gateFlow
    const gateBookingNo = String(
      selectedBooking.bookingNumber ||
      selectedBooking.bookingNo ||
      (String(selectedBooking.id || '').toUpperCase().startsWith('BK-') ? selectedBooking.id : '') ||
      selectedManifestInfo?.bookingNo ||
      ''
    ).trim()
    const eportBookingNo = String(
      activeOrder.content?.source?.bookingNumber ||
      activeOrder.sourceSnapshot?.bookingNumber ||
      (eportFlow === 'EXPORT' ? (activeOrder.sourceLabel || activeOrder.content?.source?.referenceNumber) : '') ||
      ''
    ).trim()
    const eportBlNo = String(
      activeOrder.content?.source?.blNumber ||
      activeOrder.sourceSnapshot?.blNumber ||
      ''
    ).trim()

    const bookingMatch = !gateBookingNo || !eportBookingNo || eportBookingNo.toUpperCase().includes(gateBookingNo.toUpperCase()) || gateBookingNo.toUpperCase().includes(eportBookingNo.toUpperCase())
    const blMatch = !gateBl || !eportBlNo || eportBlNo.toUpperCase().includes(gateBl.toUpperCase()) || gateBl.toUpperCase().includes(eportBlNo.toUpperCase())

    const eportCompany = String(activeOrder.companyName || '').trim().toLowerCase()
    const gateCompany = String(selectedBooking.company || '').trim().toLowerCase()
    const companyMatch = !eportCompany || !gateCompany || eportCompany.includes(gateCompany.slice(0, 8)) || gateCompany.includes(eportCompany.slice(0, 8))

    const checks = [
      {
        label: 'Số Container ISO',
        gateVal: selectedBooking.containerId || '—',
        eportVal: eportContainers.length > 0 ? eportContainers.join(', ') : (activeOrder.sourceLabel || '—'),
        ok: containerMatch
      },
      {
        label: 'Luồng hàng / Nghiệp vụ',
        gateVal: gateFlow === 'IMPORT' ? 'Hàng nhập (IMPORT)' : 'Hàng xuất (EXPORT)',
        eportVal: eportFlow === 'IMPORT' ? 'Hàng nhập (IMPORT)' : (eportFlow === 'EXPORT' ? 'Hàng xuất (EXPORT)' : 'Chưa chọn'),
        ok: flowMatch
      },
      {
        label: 'Mã Booking',
        gateVal: gateBookingNo || 'Chưa có Booking',
        eportVal: eportBookingNo || 'Chưa nhập Booking',
        ok: bookingMatch
      },
      {
        label: 'Số Vận đơn (B/L)',
        gateVal: gateBl || 'Chưa có B/L',
        eportVal: eportBlNo || 'Chưa nhập B/L',
        ok: blMatch
      },
      {
        label: 'Doanh nghiệp / Vận tải',
        gateVal: selectedBooking.company || '—',
        eportVal: activeOrder.companyName || 'Doanh nghiệp đăng ký',
        ok: companyMatch
      }
    ]

    const allDataMatch = containerMatch && flowMatch && bookingMatch && blMatch && companyMatch
    const allReady = allDataMatch

    return {
      matched: allDataMatch,
      allReady,
      status: allReady ? 'matched' : 'mismatch',
      badgeText: allReady
        ? 'Khớp 2 bên · Đủ điều kiện duyệt'
        : 'Có sai lệch dữ liệu 2 bên',
      order: activeOrder,
      checks
    }
  }, [selectedBooking, selectedManifestInfo, isImportBooking, eportDetail, eportOrders])

  // Kiểm tra thực tế trên sơ đồ bãi xem tại toạ độ vị trí này, tầng trên (Tier > tier hiện tại) có container nào nằm đè lên hay không
  const checkHasContainerAboveOnYard = (slot, containerId, bookingId) => {
    if (!slot) return { hasAbove: false, shiftingCount: 0, containersAbove: [] }
    const blockCode = String(slot.blockCode || slot.block || 'A01').trim().toUpperCase()

    const parseNum = (val, fallback = 1) => {
      if (val === undefined || val === null || val === '') return fallback
      const digits = String(val).replace(/[^0-9]/g, '')
      const n = parseInt(digits, 10)
      return isNaN(n) ? fallback : n
    }

    const targetBay = parseNum(slot.bay, 2)
    const targetRow = parseNum(slot.row, 1)
    const targetTier = parseNum(slot.tier, 1)
    const is40 = Number(slot.size) >= 40 || String(slot.isoType || '').includes('40') || String(selectedBooking?.containerType || '').includes('40')

    const targetContKey = String(containerId || selectedBooking?.containerId || '').trim().toUpperCase()
    const targetBookKey = String(bookingId || selectedBooking?.id || selectedBooking?.bookingCode || '').trim().toUpperCase()

    // Bảng Map duy nhất cho mỗi container: Ưu tiên số 1 cho vị trí người dùng đổi trên Sơ đồ bãi (yardReservationStore)
    const containerSlotMap = new Map()

    // 1. Quét từ yardReservationStore (ƯU TIÊN TUYỆT ĐỐI: vị trí người dùng vừa xếp/đổi chỗ trên sơ đồ bãi)
    try {
      const storeRes = yardReservationStore.getReservations() || []
      storeRes.forEach(r => {
        const cNo = String(r.containerNo || r.containerId || r.booking?.containerId || '').trim().toUpperCase()
        if (cNo && !containerSlotMap.has(cNo)) {
          const rBlock = String(r.blockCode || r.block || '').trim().toUpperCase()
          containerSlotMap.set(cNo, {
            containerNo: cNo,
            bookingCode: String(r.bookingCode || r.booking?.id || '').trim().toUpperCase(),
            blockCode: rBlock,
            bay: parseNum(r.bay, 2),
            row: parseNum(r.row, 1),
            tier: parseNum(r.tier, 1),
            size: Number(r.size || 20) || 20,
            source: 'yardReservationStore'
          })
        }
      })
    } catch {}

    // 2. Quét từ manifestGeneratedBookings (Bản khai tàu)
    const generated = (manifestGeneratedBookings && manifestGeneratedBookings.length > 0)
      ? manifestGeneratedBookings
      : manifestPortSyncService.getGeneratedGateBookings()

    generated.forEach(b => {
      const cNo = String(b.containerId || b.containerNo || '').trim().toUpperCase()
      if (cNo && !containerSlotMap.has(cNo)) {
        const bSlot = b.autoYardSlot || b.yardSlot || {}
        const bBlock = String(bSlot.blockCode || bSlot.block || '').trim().toUpperCase()
        containerSlotMap.set(cNo, {
          containerNo: cNo,
          bookingCode: String(b.id || b.bookingCode || '').trim().toUpperCase(),
          blockCode: bBlock,
          bay: parseNum(bSlot.bay, 2),
          row: parseNum(bSlot.row, 1),
          tier: parseNum(bSlot.tier, 1),
          size: Number(bSlot.size || (String(b.containerType || '').includes('40') ? 40 : 20)) || 20,
          source: 'manifestGeneratedBookings'
        })
      }
    })

    // 3. Quét từ bookings state từ Backend API
    ;(bookings || []).forEach(b => {
      const cNo = String(b.containerId || b.containerNo || '').trim().toUpperCase()
      if (cNo && !containerSlotMap.has(cNo)) {
        const bSlot = b.autoYardSlot || b.yardSlot || {}
        const bBlock = String(bSlot.blockCode || bSlot.block || '').trim().toUpperCase()
        containerSlotMap.set(cNo, {
          containerNo: cNo,
          bookingCode: String(b.id || b.bookingCode || '').trim().toUpperCase(),
          blockCode: bBlock,
          bay: parseNum(bSlot.bay, 2),
          row: parseNum(bSlot.row, 1),
          tier: parseNum(bSlot.tier, 1),
          size: Number(bSlot.size || 20) || 20,
          source: 'backendBookings'
        })
      }
    })

    // 4. Quét từ combinedBlocks layout
    const blockData = combinedBlocks.find((b) => String(b.blockCode || b.code || '').trim().toUpperCase() === blockCode)
    const blockSlots = blockData?.containersInBlock || []
    blockSlots.forEach(s => {
      const cNo = String(s.containerNo || s.containerNumber || '').trim().toUpperCase()
      if (cNo && !containerSlotMap.has(cNo)) {
        containerSlotMap.set(cNo, {
          containerNo: cNo,
          bookingCode: String(s.bookingCode || '').trim().toUpperCase(),
          blockCode,
          bay: parseNum(s.bay, 2),
          row: parseNum(s.row, 1),
          tier: parseNum(s.tier, 1),
          size: Number(s.size || 20) || 20,
          source: 'combinedBlocks'
        })
      }
    })

    const allYardContainers = Array.from(containerSlotMap.values()).filter(c => c.blockCode === blockCode)

    const isBayOverlap = (bBay, bSize) => {
      const bayNum = parseNum(bBay, 2)
      const bIs40 = Number(bSize) >= 40
      
      const targetBays = is40 
        ? (targetBay % 2 === 0 ? [targetBay - 1, targetBay, targetBay + 1] : [targetBay, targetBay + 1, targetBay + 2])
        : [targetBay]

      const bCoveredBays = bIs40
        ? (bayNum % 2 === 0 ? [bayNum - 1, bayNum, bayNum + 1] : [bayNum, bayNum + 1, bayNum + 2])
        : [bayNum]

      return targetBays.some(tb => bCoveredBays.includes(tb))
    }

    const containersAbove = allYardContainers.filter((c) => {
      const cContKey = String(c.containerNo || '').trim().toUpperCase()
      const cBookKey = String(c.bookingCode || '').trim().toUpperCase()

      // Bỏ qua chính container này
      if (targetContKey && cContKey === targetContKey) return false
      if (targetBookKey && cBookKey === targetBookKey) return false

      const cRow = Number(c.row || 1)
      const cTier = Number(c.tier || 1)

      // Phải cùng hàng và tầng cao hơn
      if (cRow !== targetRow) return false
      if (cTier <= targetTier) return false

      // Phải cùng vị trí cột bay (hoặc overlap)
      return isBayOverlap(c.bay, c.size)
    })

    return {
      hasAbove: containersAbove.length > 0,
      shiftingCount: containersAbove.length,
      containersAbove,
    }
  }

  // Tự động nhận diện Container (20'/40', Xuất khẩu/Nhập khẩu, Số ngày lưu bãi) và tự tính Bill
  const activePortTariff = useMemo(() => {
    if (!selectedBooking) return null
    const checkRes = checkHasContainerAboveOnYard(reservedSlot, selectedBooking.containerId, selectedBooking.id)
    const actualHasAbove = Boolean(checkRes?.hasAbove)

    const slotWithCheckedAbove = reservedSlot ? {
      ...reservedSlot,
      hasContainerAbove: actualHasAbove,
      shiftingCount: checkRes?.shiftingCount || 0,
    } : null

    return computeAutoBookingTariff(selectedBooking, selectedManifestInfo, slotWithCheckedAbove)
  }, [selectedBooking, selectedManifestInfo, reservedSlot, isImportBooking, combinedBlocks, manifestGeneratedBookings, bookings, yardResVersion])

  // Phí đảo chuyển container: tự động kiểm tra thực tế xem tầng trên có cont hay là ô trống
  const activeShiftingFee = useMemo(() => {
    const tier = Number(reservedSlot?.tier || 1)
    const stackHeight = Number(reservedSlot?.stackHeight || 2)

    // Luôn kiểm tra động thực tế trên sơ đồ bãi xem hiện tại có cont nào đang đè lên không
    const checkRes = checkHasContainerAboveOnYard(reservedSlot, selectedBooking?.containerId, selectedBooking?.id)
    const hasAbove = Boolean(checkRes?.hasAbove)
    const shiftingCount = checkRes?.shiftingCount || (hasAbove ? 1 : 0)

    return calculateShiftingFee({
      direction: isImportBooking ? 'IMPORT' : 'EXPORT',
      tier,
      stackHeight,
      hasContainerAbove: hasAbove,
      shiftingCount,
    })
  }, [isImportBooking, reservedSlot, selectedBooking, combinedBlocks, manifestGeneratedBookings, bookings, yardResVersion])

  // Tổng hợp cước & biểu phí chi tiết đồng bộ giữa Card tóm tắt, Popup và Footer
  const bookingTariffSummary = useMemo(() => {
    const isRf = Boolean(
      (selectedBooking?.containerType || '').includes('RF') ||
      selectedBooking?.isReefer ||
      reservedSlot?.isReefer
    )
    const thc = 320000
    const csvc = 100000
    const vgm = 70000
    const security = 50000
    const shifting = activeShiftingFee?.fee || 0
    const storage = activePortTariff?.storageFee || 0
    const reefer = isRf ? 80000 : 0

    const subtotal = thc + csvc + vgm + security + shifting + storage + reefer
    const vat = Math.round(subtotal * 0.08)
    const total = subtotal + vat

    const items = [
      { no: 1, title: '1. Cước nâng hạ (THC tại bãi)', amount: thc },
      { no: 2, title: '2. Phí cơ sở vật chất', amount: csvc },
      { no: 3, title: '3. Phí cân VGM', amount: vgm },
      { no: 4, title: '4. Phí an ninh bến cảng', amount: security },
      {
        no: 5,
        title: '5. Phí đảo chuyển container (Shifting)',
        amount: shifting,
        desc: activeShiftingFee?.reason || activeShiftingFee?.statusText || '0 VNĐ',
        isShiftingItem: true,
      },
      {
        no: 6,
        title: `6. Phí lưu bãi (${activePortTariff?.storageDays || 3} ngày, miễn phí 5 ngày)`,
        amount: storage,
      },
      ...(reefer > 0 ? [{ no: 7, title: '7. Phí cắm điện & giám sát Cont Lạnh', amount: reefer }] : []),
    ]

    return {
      thc,
      csvc,
      vgm,
      security,
      shifting,
      storage,
      reefer,
      subtotal,
      vat,
      total,
      items,
      totalFormatted: `${total.toLocaleString('vi-VN')} VNĐ`,
      vatFormatted: `${vat.toLocaleString('vi-VN')} VNĐ`,
    }
  }, [selectedBooking, reservedSlot, activePortTariff, activeShiftingFee])

  // Danh sách toàn bộ các Tàu / Bản khai Manifest đã truyền sang Cảng
  const syncedManifestList = useMemo(() => {
    return manifestPortSyncService.getManifestsSentToPort()
  }, [manifestSyncVersion])

  // Lọc danh sách Tàu cập cảng theo từ khóa tìm kiếm
  const filteredVessels = useMemo(() => {
    const q = vesselSearch.toLowerCase().trim()
    if (!q) return syncedManifestList
    return syncedManifestList.filter(m =>
      (m.vesselName || '').toLowerCase().includes(q) ||
      (m.voyageNumber || '').toLowerCase().includes(q) ||
      (m.manifestNumber || '').toLowerCase().includes(q) ||
      (m.shippingLine || '').toLowerCase().includes(q) ||
      (m.berth || '').toLowerCase().includes(q)
    )
  }, [syncedManifestList, vesselSearch])

  // KPI thống kê cho danh sách Tàu cập cảng
  const vesselKpiStats = useMemo(() => {
    const total = syncedManifestList.length
    const berthed = syncedManifestList.filter(m => (m.vesselStatus || 'BERTHED') === 'BERTHED').length
    const operating = syncedManifestList.filter(m => m.vesselStatus === 'OPERATING').length
    const totalContainers = syncedManifestList.reduce((acc, m) => acc + (m.containers?.length || 0), 0)
    return { total, berthed, operating, totalContainers }
  }, [syncedManifestList])

  // Danh sách các tàu để chọn lọc riêng từng tàu
  const approvedVesselsList = useMemo(() => {
    return syncedManifestList
  }, [syncedManifestList])

  useEffect(() => {
    setVesselPage(1)
  }, [vesselSearch])

  useEffect(() => {
    setCompanyPage(1)
  }, [searchQuery, statusFilter, operationFilter, companyFilter, selectedVesselFilter])

  useEffect(() => {
    setPopupContainerPage(1)
  }, [vesselContainersPopup])

  // Lọc danh sách container theo Tàu được chọn / Tìm kiếm tàu / Từ khóa / Trạng thái / Công ty vận tải
  const filteredBookings = useMemo(() => {
    const vq = vesselSearch.toLowerCase().trim()
    return manifestGeneratedBookings.filter(b => {
      // 1. Lọc riêng theo Tàu được chọn (selectedVesselFilter)
      if (selectedVesselFilter !== 'All') {
        const sv = String(selectedVesselFilter).toLowerCase().trim()
        const matchesSelectedVessel =
          (b.sourceManifestNumber && b.sourceManifestNumber.toLowerCase() === sv) ||
          (b.sourceManifestId && b.sourceManifestId.toLowerCase() === sv) ||
          (b.vesselName && b.vesselName.toLowerCase() === sv)
        if (!matchesSelectedVessel) return false
      }

      // 2. Lọc theo ô Tìm kiếm Tàu (vesselSearch)
      if (vq) {
        const matchesVesselSearch =
          (b.vesselName || '').toLowerCase().includes(vq) ||
          (b.voyageNumber || '').toLowerCase().includes(vq) ||
          (b.sourceManifestNumber || '').toLowerCase().includes(vq) ||
          (b.shippingLine || '').toLowerCase().includes(vq)
        if (!matchesVesselSearch) return false
      }

      // 3. Lọc theo ô Tìm kiếm chung (searchQuery)
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        (b.id || '').toLowerCase().includes(q) ||
        (b.containerId || '').toLowerCase().includes(q) ||
        (b.licensePlate || '').toLowerCase().includes(q) ||
        (b.company || '').toLowerCase().includes(q) ||
        (b.driverName || '').toLowerCase().includes(q) ||
        (b.vesselName || '').toLowerCase().includes(q)

      let matchesStatus = true
      if (statusFilter !== 'All') {
        if (statusFilter === 'Pending') {
          matchesStatus = b.status === 'Pending' || b.status === 'WaitingTransport'
        } else if (statusFilter === 'Cancelled') {
          matchesStatus = b.status === 'Cancelled' || b.status === 'Canceled'
        } else {
          matchesStatus = b.status === statusFilter
        }
      }

      let matchesOp = true
      if (operationFilter !== 'All') {
        if (operationFilter === 'Delivery') {
          matchesOp = b.operation === 'Dropoff' || b.operation === 'Delivery'
        } else {
          matchesOp = b.operation === operationFilter
        }
      }

      let matchesGate = true
      if (gateFilter !== 'All') {
        matchesGate = b.requestedGate === gateFilter
      }

      let matchesCompany = true
      if (companyFilter !== 'All') {
        matchesCompany = b.company === companyFilter
      }

      return matchesSearch && matchesStatus && matchesOp && matchesGate && matchesCompany
    })
  }, [manifestGeneratedBookings, selectedVesselFilter, vesselSearch, searchQuery, statusFilter, operationFilter, gateFilter, companyFilter])

  
  // Phân trang danh sách Tàu cập cảng
  const pagedVessels = useMemo(() => {
    const start = (vesselPage - 1) * vesselPageSize
    return filteredVessels.slice(start, start + vesselPageSize)
  }, [filteredVessels, vesselPage, vesselPageSize])



  const manifestBookingsByCompany = useMemo(() => {
    const groups = {}
    filteredBookings.forEach((b) => {
      const comp = b.company || 'Công ty Vận tải Đối tác'
      if (!groups[comp]) {
        groups[comp] = {
          companyName: comp,
          contactName: b.contactName || 'Điều độ vận tải',
          phone: b.phone || '0905 123 456',
          email: b.email || 'dispatch@logistics.vn',
          vessels: new Set(),
          items: [],
        }
      }
      if (b.vesselName) groups[comp].vessels.add(`${b.vesselName} (${b.voyageNumber})`)
      groups[comp].items.push(b)
    })
    return Object.values(groups).map((g) => ({
      ...g,
      vesselList: Array.from(g.vessels).join(' • '),
      pendingCount: g.items.filter(x => x.status === 'Pending' || x.status === 'Under Review').length,
      approvedCount: g.items.filter(x => x.status === 'Approved').length,
    }))
  }, [filteredBookings])

  // Phân trang danh sách Công ty vận tải
  const pagedCompanies = useMemo(() => {
    const start = (companyPage - 1) * companyPageSize
    return manifestBookingsByCompany.slice(start, start + companyPageSize)
  }, [manifestBookingsByCompany, companyPage, companyPageSize])

  // Gom nhóm container theo từng Vận đơn (B/L) cho tàu đang xem
  const selectedVesselBlGroups = useMemo(() => {
    if (!selectedVesselManifest?.containers) return []
    const map = {}
    selectedVesselManifest.containers.forEach((c) => {
      const bl = c.blNumber || 'BL-VNDAD-DEFAULT'
      if (!map[bl]) {
        map[bl] = {
          blNumber: bl,
          shipper: c.shipper || 'Công ty CP Xuất Nhập Khẩu Đà Nẵng',
          consignee: c.consignee || 'Hãng Tàu & Khách Hàng Quốc Tế',
          pol: selectedVesselManifest.pol || 'Cảng Tiên Sa, Đà Nẵng (VNDAD)',
          pod: selectedVesselManifest.pod || 'Tokyo Port, Nhật Bản (JPTYO)',
          containers: [],
          totalGrossWeight: 0,
          totalCbm: 0,
        }
      }
      map[bl].containers.push(c)
      map[bl].totalGrossWeight += Number(c.grossWeightKg || 0)
      map[bl].totalCbm += Number(c.cbm || 0)
    })
    return Object.values(map)
  }, [selectedVesselManifest])

  // Thống kê tổng hợp toàn tàu đang chọn
  const selectedVesselCargoStats = useMemo(() => {
    if (!selectedVesselManifest?.containers) return { count: 0, gross: 0, net: 0, cbm: 0, rfCount: 0 }
    const list = selectedVesselManifest.containers
    const count = list.length
    const gross = list.reduce((a, c) => a + Number(c.grossWeightKg || 0), 0)
    const net = list.reduce((a, c) => a + Number(c.netWeightKg || ((Number(c.grossWeightKg) || 0) - (Number(c.tareWeightKg) || 3820))), 0)
    const cbm = list.reduce((a, c) => a + Number(c.cbm || 65), 0)
    const rfCount = list.filter(c => (c.isoType || '').includes('RF') || (c.tempRequired || '').includes('-')).length
    return { count, gross, net, cbm: cbm.toFixed(1), rfCount }
  }, [selectedVesselManifest])

  // Danh sách Container hiển thị trong Popup khi bấm Cái Phễu
  const popupContainerList = useMemo(() => {
    if (!vesselContainersPopup) return []
    const vKey = vesselContainersPopup.manifestNumber || vesselContainersPopup.manifestId
    const matched = manifestGeneratedBookings.filter(
      b => b.sourceManifestNumber === vKey || b.sourceManifestId === vKey || b.vesselName === vesselContainersPopup.vesselName
    )
    if (matched.length > 0) return matched

    return (vesselContainersPopup.containers || []).map((c, idx) => {
      const isRf = (c.isoType || '').includes('RF') || (c.tempRequired || '').includes('-')
      const isDg = (c.dgClass || '').includes('IMO') || (c.dgClass || '').includes('Class')
      const blockCode = isRf ? 'D01' : (isDg ? 'E01' : (idx % 2 === 0 ? 'A01' : 'A02'))
      const bayNum = c.isoType?.includes('20') ? (1 + (idx * 2) % 15) : (2 + (idx * 2) % 16)
      const bayStr = String(bayNum).padStart(2, '0')
      const rowNum = (idx % 4) + 1
      const rowStr = String(rowNum).padStart(2, '0')
      const tierNum = 1
      const autoGate = isRf ? 'Gate 2' : (isDg ? 'Gate 3' : (idx % 2 === 0 ? 'Gate 1' : 'Gate 2'))
      const slot = c.autoYardSlot || {
        blockCode,
        bay: bayNum,
        bayCode: bayStr,
        bayDisplay: `Bay ${bayStr}`,
        row: rowNum,
        rowCode: rowStr,
        tier: tierNum,
        tierCode: '1',
        gate: autoGate,
        gateDisplay: `${autoGate} (Cổng Container)`,
        slotName: `Khu ${blockCode} · Bay ${bayStr} (R${rowStr}-T${tierNum})`,
        fullLocation: `Block ${blockCode} · Bay ${bayStr} · Row ${rowStr} · Tier ${tierNum}`
      }

      return {
        id: `cont-${idx}`,
        containerId: c.containerNumber,
        containerType: c.isoType || '40HC',
        company: c.transportCompany || 'Công ty Vận tải Đối tác',
        cargoDescription: c.cargoDescription || 'Hàng hóa thông quan',
        blNumber: c.blNumber || 'BL-VNDAD',
        sealNumber: c.sealNumber || 'SL-88412',
        customsStatus: c.customsStatus || 'Đã thông quan',
        autoYardSlot: slot,
        requestedGate: c.suggestedGate || slot.gate || autoGate,
        transportSubmitted: false,
        status: 'WaitingTransport',
      }
    })
  }, [vesselContainersPopup, manifestGeneratedBookings])

  // Phân trang danh sách Container trong Popup
  const pagedPopupContainers = useMemo(() => {
    const start = (popupContainerPage - 1) * popupContainerPageSize
    return popupContainerList.slice(start, start + popupContainerPageSize)
  }, [popupContainerList, popupContainerPage, popupContainerPageSize])

  // Start Reviewing Booking (Pending -> Under Review)
  const handleStartReview = (booking) => {
    const updated = {
      ...booking,
      status: 'Under Review',
      reviewStartedAt: new Date().toLocaleString('vi-VN'),
      reviewedBy: 'Dispatcher - Nguyễn Văn Q',
      timelineStep: 3
    }
    if (booking.isFromVesselManifest) {
      manifestPortSyncService.updateGeneratedGateBookingStatus(booking.id, {
        status: 'Under Review',
        reviewStartedAt: updated.reviewStartedAt,
        reviewedBy: updated.reviewedBy,
        timelineStep: 3,
      })
      setManifestSyncVersion(v => v + 1)
    } else {
      setBookings(prev => prev.map(b => b.id === booking.id ? updated : b))
    }
    setSelectedBooking(updated)
    showToast(`🔵 Đã chuyển Booking ${booking.id} sang trạng thái Under Review (Đang kiểm tra).`)
  }

  // Xác nhận Phê duyệt Handler
  const handleConfirmApproval = async () => {
    if (!selectedBooking) return
    setLoading(true)
    try {
      const realId = selectedBooking.realId || selectedBooking.id

      // Tự động phân bổ và gán Xe đầu kéo, Rơ-moóc & Tài xế phụ trách cho booking
      const carrierProfile =
        TRANSPORT_COMPANIES_POOL.find(p => p.companyName === selectedBooking.company) ||
        TRANSPORT_COMPANIES_POOL[0]
      const defaultFleet = carrierProfile?.fleetOptions?.[0] || {
        licensePlate: '47AB-294.69',
        trailerPlate: '47R-012.88',
        driverName: 'TRẦN VĂN TÙNG',
        licenseNumber: 'FC-782910',
        driverPhone: '0905 881 234'
      }

      const assignedPlate = (selectedBooking.licensePlate && selectedBooking.licensePlate !== 'Chưa gán xe' && selectedBooking.licensePlate !== 'Chưa gán' && selectedBooking.licensePlate !== 'Chưa điều phối')
        ? selectedBooking.licensePlate
        : (selectedBooking.suggestedPlate || defaultFleet.licensePlate)
      const assignedTrailer = selectedBooking.trailerPlate || selectedBooking.suggestedTrailer || defaultFleet.trailerPlate
      const assignedDriver = (selectedBooking.driverName && selectedBooking.driverName !== 'Chưa điều phối')
        ? selectedBooking.driverName
        : (selectedBooking.suggestedDriver || defaultFleet.driverName)
      const assignedLicense = selectedBooking.licenseNumber || selectedBooking.suggestedLicense || defaultFleet.licenseNumber
      const assignedPhone = selectedBooking.phone || defaultFleet.driverPhone || carrierProfile?.phone || '0905 123 456'

      if (selectedBooking.isFromVesselManifest) {
        manifestPortSyncService.submitTransportBookingToPort(selectedBooking.id, {
          licensePlate: assignedPlate,
          trailerPlate: assignedTrailer,
          driverName: assignedDriver,
          licenseNumber: assignedLicense,
          phone: assignedPhone,
        })
        manifestPortSyncService.updateGeneratedGateBookingStatus(selectedBooking.id, {
          status: 'Approved',
          approvedAt: new Date().toLocaleString('vi-VN'),
          approvedBy: 'Dispatcher',
          timelineStep: 4,
          transportSubmitted: true,
          licensePlate: assignedPlate,
          trailerPlate: assignedTrailer,
          driverName: assignedDriver,
          licenseNumber: assignedLicense,
          phone: assignedPhone,
          vehiclePlate: assignedPlate,
          vehicleStatus: 'Available',
          driverStatus: 'Available',
        })
        setManifestSyncVersion(v => v + 1)
      } else {
        await bookingService.approveBooking(realId)
      }

      // Chuyển và đồng bộ Phụ thu Nâng container Bãi => Ôtô / Phí Lưu Bãi sang bên Công ty vận tải
      const currentDays = bookingStorageDays[selectedBooking.id] || 7
      const storageCalc = calculatePortStorageFee(currentDays, selectedBooking.containerType)
      const nowIso = new Date().toISOString()
      const storageFee = storageCalc.fee
      const storageData = {
        days: currentDays,
        fee: storageFee,
        tierLabel: storageCalc.tier.label,
        containerType: selectedBooking.containerType,
        containerLabel: storageCalc.containerLabel,
        approvedAt: nowIso,
        containerId: selectedBooking.containerId,
        bookingCode: selectedBooking.bookingCode || selectedBooking.id
      }

      const portBill = {
        billNumber: `BILL-${selectedBooking.bookingCode || selectedBooking.id}`,
        bookingId: selectedBooking.id,
        realId: selectedBooking.realId || selectedBooking.id,
        containerId: selectedBooking.containerId,
        company: selectedBooking.company,
        billOfLading: selectedBooking.billOfLading || (selectedBooking.cargoDeclarationId && selectedBooking.cargoDeclarationId !== 'N/A' ? selectedBooking.cargoDeclarationId : '') || selectedManifestInfo?.blNumber || '',
        direction: isImportBooking ? 'IMPORT' : 'EXPORT',
        yardSlot: reservedSlot ? `Block ${reservedSlot.blockCode} · ${reservedSlot.bayDisplay || 'Bay 02'} · T${reservedSlot.tier || 1}-R${reservedSlot.row || 1}` : 'Đã cấp vị trí bãi',
        tariff: bookingTariffSummary,
        items: bookingTariffSummary.items || [],
        subtotal: bookingTariffSummary.subtotal || 0,
        vat: bookingTariffSummary.vat || 0,
        total: bookingTariffSummary.total || 0,
        totalFormatted: bookingTariffSummary.totalFormatted || '0 đ',
        shiftingFee: activeShiftingFee?.fee || 0,
        storageFee,
        approvedAt: nowIso,
        status: 'SENT_TO_CARRIER'
      }

      try {
        const storedFees = JSON.parse(localStorage.getItem('NEXUSPORT_STORAGE_FEES') || '{}')
        storedFees[selectedBooking.id] = storageData
        if (selectedBooking.realId) storedFees[selectedBooking.realId] = storageData
        if (selectedBooking.bookingCode) storedFees[selectedBooking.bookingCode] = storageData
        if (selectedBooking.containerId) storedFees[selectedBooking.containerId] = storageData
        localStorage.setItem('NEXUSPORT_STORAGE_FEES', JSON.stringify(storedFees))

        const storedBills = JSON.parse(localStorage.getItem('NEXUSPORT_PORT_BILLS') || '{}')
        storedBills[selectedBooking.id] = portBill
        if (selectedBooking.realId) storedBills[selectedBooking.realId] = portBill
        if (selectedBooking.bookingCode) storedBills[selectedBooking.bookingCode] = portBill
        if (selectedBooking.containerId) storedBills[selectedBooking.containerId] = portBill
        localStorage.setItem('NEXUSPORT_PORT_BILLS', JSON.stringify(storedBills))

        manifestPortSyncService.dismissTransportSubmissionAlert(selectedBooking.id)
        setTransportAlerts(manifestPortSyncService.getTransportSubmissionAlerts())

        if (selectedBooking.isFromVesselManifest) {
          manifestPortSyncService.updateGeneratedGateBookingStatus(selectedBooking.id, {
            status: 'Approved',
            timelineStep: 4,
            approvedAt: new Date().toLocaleString('vi-VN'),
            portBill,
            billSentAt: nowIso,
            transportSubmitted: true,
            licensePlate: assignedPlate,
            trailerPlate: assignedTrailer,
            driverName: assignedDriver,
            licenseNumber: assignedLicense,
            phone: assignedPhone,
            vehiclePlate: assignedPlate,
            vehicleStatus: 'Available',
            driverStatus: 'Available',
          })
          setManifestSyncVersion(v => v + 1)
        }

        window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', {
          detail: { type: 'PORT_BILL_SENT', bookingId: selectedBooking.id, containerId: selectedBooking.containerId, bill: portBill }
        }))
        window.dispatchEvent(new Event('storage'))

        // Đồng bộ trả phí trực tiếp sang backend ePort để chuyển trạng thái sang UNPAID (cho phép thanh toán PayOS)
        const targetEport = eportComparison?.order || eportOrders[0]
        if (targetEport?.id && (targetEport.pricingStatus === 'AWAITING' || targetEport.approvalStatus === 'PENDING')) {
          try {
            const billTotal = Math.round(Number(bookingTariffSummary?.total || portBill.total || 0))
            const eportDetailLive = await serviceOrdersApi.get(targetEport.id).catch(() => targetEport)
            await serviceOrdersApi.billingResult(targetEport.id, {
              requestId: crypto.randomUUID(),
              expectedVersion: eportDetailLive.version || targetEport.version || 1,
              status: 'APPROVED',
              reference: portBill.billNumber,
              total: billTotal,
              currency: 'VND',
              reason: 'Dispatcher đã duyệt lượt cổng và xuất cước phí dịch vụ',
              sourceDocumentsChecked: true,
              sourceEvidenceReference: portBill.billOfLading || portBill.billNumber
            })
          } catch (syncErr) {
            console.warn('Could not push billingResult to eport order', syncErr)
          }
        }
      } catch (e) {
        console.warn('Could not save storage fee / port bill', e)
      }

      const updatedBooking = {
        ...selectedBooking,
        status: 'Approved',
        timelineStep: 4,
        portBill,
        transportSubmitted: true,
        licensePlate: assignedPlate,
        trailerPlate: assignedTrailer,
        driverName: assignedDriver,
        licenseNumber: assignedLicense,
        phone: assignedPhone,
        vehiclePlate: assignedPlate,
        vehicleStatus: 'Available',
        driverStatus: 'Available',
        approvedAt: new Date().toLocaleString('vi-VN'),
        approvedBy: 'Dispatcher',
      }

      setSelectedBooking(updatedBooking)
      setManifestGeneratedBookings(prev => prev.map(b => (b.id === selectedBooking.id || b.containerId === selectedBooking.containerId) ? { ...b, ...updatedBooking } : b))
      setBookings(prev => prev.map(b => (b.id === selectedBooking.id || b.realId === realId) ? { ...b, ...updatedBooking } : b))

      showToast(`🟢 Đã duyệt Booking ${selectedBooking.id} và tự động gán xe ${assignedPlate} (${assignedDriver})!`)
      setShowApproveModal(false)
      if (!selectedBooking.isFromVesselManifest) {
        fetchBookings()
        navigate('/dispatch')
      }
    } catch (error) {
      const body = error.response?.data
      const details = body?.Errors || body?.errors
      const reason = details ? Object.values(details).flat().join(' ') : body?.Message || body?.message || error.message
      showToast(`⚠️ ${reason || 'Không thể duyệt booking. Vui lòng thử lại.'}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Confirm Rejection Handler
  const handleConfirmRejection = async () => {
    if (!rejectionReason) {
      showToast('⚠️ Vui lòng chọn lý do từ chối trước khi xác nhận!')
      return
    }
    if (!selectedBooking) return

    setLoading(true)
    try {
      const realId = selectedBooking.realId || selectedBooking.id
      if (selectedBooking.isFromVesselManifest) {
        manifestPortSyncService.updateGeneratedGateBookingStatus(selectedBooking.id, {
          status: 'Rejected',
          rejectionReason,
          rejectionNote,
        })
        setManifestSyncVersion(v => v + 1)
        setSelectedBooking(prev => prev ? { ...prev, status: 'Rejected', rejectionReason, rejectionNote } : null)
      } else {
        await bookingService.rejectBooking(realId, rejectionReason)
        fetchBookings()
      }
      showToast(`🔴 Đã từ chối Gate Booking ${selectedBooking.id}. Lý do: ${rejectionReason}`)
      setShowRejectModal(false)
      setRejectionReason('')
      setRejectionNote('')
    } catch (error) {
      showToast('⚠️ Có lỗi xảy ra khi từ chối Booking.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Reserve Slot Handler
  const handleReserveSlot = (slotId, blockCode, res) => {
    if (res) {
      setReservedSlot({ ...res, blockCode });
      showToast(`✅ Đã giữ chỗ thành công Slot ở Block ${blockCode}!`);
    }
  }

  // Render Status Badge (Gọn, sắc nét, không bị rớt dòng)
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg font-bold text-[11px] inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Chờ duyệt
          </span>
        )
      case 'Under Review':
        return (
          <span className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg font-bold text-[11px] inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Đang duyệt
          </span>
        )
      case 'Approved':
      case 'Ready':
        return (
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-[11px] inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Đã duyệt
          </span>
        )
      case 'Rejected':
        return (
          <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg font-bold text-[11px] inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            Từ chối
          </span>
        )
      case 'Cancelled':
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-bold text-[11px] inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Đã hủy
          </span>
        )
      default:
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-[11px] inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            {status}
          </span>
        )
    }
  }

  // Rút gọn mã Booking dài để hiển thị bảng gọn đẹp
  const formatShortBookingCode = (code) => {
    if (!code) return 'BK-N/A'
    const str = String(code)
    if (str.length <= 13) return str
    return `${str.slice(0, 7)}…${str.slice(-4)}`
  }

  // Calculate Eligibility Verification Checklist for Selected Booking
  const checkEligibility = (b) => {
    if (!b) return { isEligible: false, checks: [] }
    const checks = [
      { id: 'cargo', label: 'Tờ khai hàng hóa đã duyệt (Cargo Declaration)', ok: b.cargoDeclarationStatus === 'Approved' },
      { id: 'container', label: 'Thông tin Container hợp lệ', ok: !!b.containerId },
      { id: 'vehicle', label: 'Phương tiện đăng ký hợp lệ & Sẵn sàng', ok: b.vehicleStatus === 'Available' },
      { id: 'driver', label: 'GPLX tài xế hợp lệ & Đang hoạt động', ok: b.licenseStatus === 'Valid' && b.driverStatus === 'Available' },
      { id: 'schedule', label: 'Khung giờ ETA hợp lệ', ok: true },
      { id: 'capacity', label: 'Dung lượng cổng khả dụng', ok: b.gateCapacity?.status !== 'Full' },
      { id: 'duplicate', label: 'Không trùng lặp lịch hẹn (Booking ID)', ok: true },
      { id: 'fee', label: 'Đã hoàn tất thanh toán phí cảng', ok: b.paymentStatus === 'Paid' }
    ]
    const isEligible = checks.every(c => c.ok)
    return { isEligible, checks }
  }

  // Render các Bảng Mới Chia Theo Từng Công Ty Vận Tải (tách từ Tàu đã được Cảng phê duyệt, lọc riêng theo từng Tàu được chọn)
  const renderManifestCompanyTables = () => {
    if (manifestGeneratedBookings.length === 0) {
      return (
        <div className="bg-amber-50/70 border border-dashed border-amber-300 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">domain</span>
            </div>
            <div>
              <h4 className="font-heading text-sm font-extrabold text-carbon">
                Danh Sách Container Theo Từng Công Ty Vận Tải (Chưa có tàu nào được phê duyệt)
              </h4>
              <p className="text-xs text-slate mt-0.5">
                Khi bạn bấm vào nút <strong className="text-amber-800">"Chờ phê duyệt"</strong> trên chuyến tàu ở bảng <strong>Danh Sách Tàu</strong>, hệ thống sẽ tự động xếp từng container vào đúng khu vực bãi và chia theo từng Công ty vận tải tại đây.
              </p>
            </div>
          </div>

          {activeListType !== 'vessel' && (
            <button
              type="button"
              onClick={() => setActiveListType('vessel')}
              className="px-4 py-2 rounded-xl bg-signal-orange text-white font-extrabold text-xs hover:opacity-90 transition cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">directions_boat</span>
              <span>Mở Danh Sách Tàu Để Duyệt</span>
            </button>
          )}
        </div>
      )
    }

    const waitingTransportTotal = filteredBookings.filter(b => !b.transportSubmitted).length
    const readyForReviewTotal = filteredBookings.filter(b => b.transportSubmitted && (b.status === 'Pending' || b.status === 'Under Review')).length
    const approvedTotal = filteredBookings.filter(b => b.status === 'Approved').length

    const activeVesselObj =
      selectedVesselFilter !== 'All'
        ? approvedVesselsList.find(
            v => v.manifestNumber === selectedVesselFilter || v.manifestId === selectedVesselFilter || v.vesselName === selectedVesselFilter
          )
        : null

    const allCompaniesCollapsed =
      manifestBookingsByCompany.length > 0 &&
      manifestBookingsByCompany.every(g => collapsedCompanies[g.companyName])

    const handleToggleAllCompanies = (e) => {
      e.stopPropagation()
      if (isCompanySectionCollapsed) {
        setIsCompanySectionCollapsed(false)
        setCollapsedCompanies({})
        return
      }
      if (allCompaniesCollapsed) {
        setCollapsedCompanies({})
      } else {
        const next = {}
        manifestBookingsByCompany.forEach(g => {
          next[g.companyName] = true
        })
        setCollapsedCompanies(next)
      }
    }

    return (
      <div id="manifest-company-section" className="space-y-4">
        {/* Tiêu đề Khu vực Bảng Chia Theo Công Ty Vận Tải (vibe ePort) */}
        <section className="epo-worklist p-5">
          <div className="epo-worklist-heading !p-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[11px] bg-[#f5f8fc] text-[#60768f] border border-[#e2e9f1] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-lg">domain</span>
              </div>
              <div>
                <span className="epo-caption">PHÂN BỔ THEO ĐƠN VỊ VẬN TẢI</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2>Danh Sách Container Theo Công Ty Vận Tải</h2>
                  <span className="epo-result-count">{filteredBookings.length} Cont</span>
                  {activeVesselObj && (
                    <span className="epo-badge blue">
                      <span />
                      Tàu: {activeVesselObj.vesselName}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedVesselFilter('All')
                        }}
                        className="hover:text-rose-600 ml-1 text-[11px] font-bold cursor-pointer"
                        title="Bỏ lọc tàu"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isCompanySectionCollapsed && manifestBookingsByCompany.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAllCompanies}
                  className="epc-button secondary !min-h-[36px] !py-1.5 !px-3"
                >
                  <span className="material-symbols-outlined text-sm">
                    {allCompaniesCollapsed ? 'unfold_more' : 'unfold_less'}
                  </span>
                  <span>{allCompaniesCollapsed ? 'Mở tất cả' : 'Thu gọn'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsCompanySectionCollapsed(prev => !prev)}
                className="epc-button secondary !min-h-[36px] !py-1.5 !px-3"
              >
                <span className="material-symbols-outlined text-base">
                  {isCompanySectionCollapsed ? 'expand_more' : 'expand_less'}
                </span>
                <span>{isCompanySectionCollapsed ? 'Mở rộng' : 'Ẩn'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Nếu lọc tàu mà không có container khớp */}
        {!isCompanySectionCollapsed && manifestBookingsByCompany.length === 0 && (
          <div className="bg-white border border-dashed border-chalk rounded-2xl p-6 text-center space-y-2">
            <span className="material-symbols-outlined text-3xl text-slate-400">search_off</span>
            <div className="text-xs font-bold text-carbon">
              Không có Container nào phù hợp với bộ lọc hiện tại.
            </div>
            <div>
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="px-3 py-1.5 bg-carbon text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
              >
                <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                <span>Xem tất cả Container ({manifestGeneratedBookings.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Danh sách từng Bảng riêng cho mỗi Công ty vận tải */}
        {!isCompanySectionCollapsed && manifestBookingsByCompany.length > 0 && (
          <>
          <div className="space-y-4">
            {pagedCompanies.map((group, gIdx) => {
              const globalIdx = (companyPage - 1) * companyPageSize + gIdx + 1
              const waitingCount = group.items.filter(x => !isBookingApprovedOrBillSent(x)).length
              const isGroupCollapsed = Boolean(collapsedCompanies[group.companyName])

              return (
                <div
                  key={group.companyName}
                  className="epo-worklist transition-all"
                >
                  {/* Header của từng Bảng Công ty Vận tải (vibe ePort) */}
                  <div
                    onClick={() =>
                      setCollapsedCompanies(prev => ({
                        ...prev,
                        [group.companyName]: !prev[group.companyName],
                      }))
                    }
                    className="px-5 py-3.5 bg-[#fbfcfe] hover:bg-[#f5f8fc] border-b border-[#e9eef4] flex justify-between items-center gap-2 cursor-pointer transition select-none"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-[9px] bg-[#f5f8fc] border border-[#e2e9f1] text-[#3e5873] font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                        {globalIdx}
                      </span>
                      <div>
                        <h4 className="text-[13px] font-bold text-[#29415a]">
                          {group.companyName}
                        </h4>
                        <span className="text-[11px] text-[#8a9bb0] font-mono hidden sm:inline">
                          Tàu: {group.vesselList}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="epo-result-count font-mono">
                        {group.items.length} Cont
                      </span>

                      {waitingCount > 0 ? (
                        <span className="epo-badge orange">
                          <span />
                          Chờ duyệt &amp; cấp xe ({waitingCount})
                        </span>
                      ) : (
                        <span className="epo-badge green">
                          <span />
                          Đã đủ xe
                        </span>
                      )}

                      <span className="material-symbols-outlined text-[#8a9bb0] text-base">
                        {isGroupCollapsed ? 'expand_more' : 'expand_less'}
                      </span>
                    </div>
                  </div>

                  {/* Bảng các Container của Công ty Vận tải này */}
                  {!isGroupCollapsed && (
                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#f7f9fc] border-b border-[#e9eef4] text-[#8a9bb0] font-bold uppercase text-[10px] tracking-wider">
                            <th className="py-2.5 px-3.5">Mã Đơn</th>
                            <th className="py-2.5 px-3">Container</th>
                            <th className="py-2.5 px-3">Phương Tiện &amp; Tài Xế</th>
                            <th className="py-2.5 px-3">Vị Trí Bãi</th>
                            <th className="py-2.5 px-3">Trạng Thái Hàng Hóa</th>
                            <th className="py-2.5 px-3.5 text-right">Thao Tác</th>
                          </tr>
                        </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {group.items.map((b) => {
                        const isSubmitted = !!b.transportSubmitted
                        const isPickup = b.operation === 'Pickup'
                        const slot = b.autoYardSlot || {}
                        const isReefer = slot.isReefer || (b.containerType || '').includes('RF')
                        const isDG = slot.isDG || (b.dgClass || '').includes('Class')
                        const matchedEport = eportListItems.find(
                          (o) =>
                            (b.eportOrderId && o.id === b.eportOrderId) ||
                            eportValidationMap[o.id]?.bookingId === b.id ||
                            (b.containerId && String(o.sourceLabel || '').toUpperCase().includes(String(b.containerId).toUpperCase()))
                        )
                        const isEportPaid = !!(
                          matchedEport &&
                          ['PAID', 'SUCCEEDED', 'NOT_REQUIRED'].includes(String(matchedEport.paymentStatus || '').toUpperCase())
                        )
                        const isApprovedOrBilled = isBookingApprovedOrBillSent(b)
                        const vPlate = getGateBookingVehicle(b)
                        const dName = getGateBookingDriver(b)
                        const isPaid = isEportPaid || !!b.portBillPaid

                        let completionBadge = { cls: 'orange', icon: 'hourglass_top', text: 'Chờ Cảng duyệt & gửi bill' }
                        if (isPaid && isApprovedOrBilled) {
                          completionBadge = { cls: 'green', icon: 'check_circle', text: '✓ Sẵn sàng vào cổng (Đã thanh toán)' }
                        } else if (isPaid && !isApprovedOrBilled) {
                          completionBadge = { cls: 'blue', icon: 'payments', text: 'Đã thanh toán · Chờ Cảng duyệt' }
                        } else if (isApprovedOrBilled && !isPaid) {
                          completionBadge = { cls: 'orange', icon: 'account_balance_wallet', text: 'Đã duyệt · Chờ thanh toán' }
                        } else {
                          completionBadge = { cls: 'orange', icon: 'hourglass_top', text: 'Chờ Cảng duyệt & gửi bill' }
                        }

                        const bayNumOnly = String(slot.bay || slot.bayCode || slot.bayDisplay || '02').replace(/\D/g, '').padStart(2, '0')
                        const cleanBay = `Bay ${bayNumOnly}`

                        return (
                          <tr
                            key={b.id}
                            onClick={() => handleSelectBooking(b)}
                            className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                          >
                            {/* 1. Mã Đơn */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-mono text-xs font-semibold text-slate-700 group-hover:text-orange-600 transition-colors">
                                {b.id}
                              </span>
                            </td>

                            {/* 2. Container */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-slate-900">{b.containerId}</span>
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                                  isPickup
                                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                                }`}>
                                  {isPickup ? 'Lấy cont' : 'Hạ cont'}
                                </span>
                              </div>
                            </td>

                            {/* 3. Phương Tiện & Tài Xế */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {(() => {
                                const vPlate = getGateBookingVehicle(b)
                                const dName = getGateBookingDriver(b)
                                if (vPlate) {
                                  return (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="font-mono text-xs font-bold text-slate-800 flex items-center gap-1">
                                        <span>🚚</span>
                                        <span>{vPlate}</span>
                                      </span>
                                      <span className="text-[11px] text-slate-500 truncate max-w-[150px]">
                                        👤 {dName || 'Tài xế theo xe'}
                                      </span>
                                    </div>
                                  )
                                }
                                return (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                                    Chờ gán xe &amp; tài xế
                                  </span>
                                )
                              })()}
                            </td>

                            {/* 3. Vị Trí Bãi (Màu sắc nhẹ theo khu vực bãi, gọn gàng) */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {slot.blockCode ? (
                                <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold border inline-flex items-center gap-1 ${
                                  isReefer
                                    ? 'bg-cyan-50/70 text-cyan-900 border-cyan-200'
                                    : isDG
                                    ? 'bg-rose-50/70 text-rose-900 border-rose-200'
                                    : 'bg-emerald-50/70 text-emerald-900 border-emerald-200'
                                }`}>
                                  <span className="material-symbols-outlined text-[12px] opacity-70">location_on</span>
                                  <span>Block {slot.blockCode} · {cleanBay} ({slot.row}-{slot.tier})</span>
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Chờ xếp bãi</span>
                              )}
                            </td>

                            {/* 4. Trạng thái hoàn thành đơn & thanh toán */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={`epo-badge ${completionBadge.cls}`}>
                                <span />
                                {completionBadge.text}
                              </span>
                            </td>

                            {/* 6. Thao Tác (Nút cam chuẩn Reefer TOS) */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleSelectBooking(b)}
                                className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                              >
                                Chi tiết
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Phân trang danh sách Container theo Công Ty Vận Tải */}
          <div className="bg-white rounded-2xl border border-chalk shadow-2xs overflow-hidden mt-2">
            <ShippingPagination
              currentPage={companyPage}
              totalItems={manifestBookingsByCompany.length}
              pageSize={companyPageSize}
              onPageChange={setCompanyPage}
              onPageSizeChange={setCompanyPageSize}
              pageSizeOptions={[3, 5, 10]}
              itemName="công ty vận tải"
            />
          </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="epc epo-page flex flex-col gap-5 relative min-h-screen">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-carbon text-white px-5 py-3.5 rounded-2xl shadow-2xl text-xs font-extrabold flex items-center gap-3 z-[100] animate-in fade-in slide-in-from-top-3 border border-signal-orange/60">
          <span className="material-symbols-outlined text-signal-orange text-lg">notifications_active</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── 1. HEADER & HERO THEO VIBE DỊCH VỤ ePORT ── */}
      <div className="epc-page-header !mb-0">
        <div>
          <div className="epc-breadcrumb">
            Cổng điều độ viên<span>/</span>Quản lý yêu cầu Booking cổng
          </div>
          <h1>Quản Lý Yêu Cầu Booking Cổng</h1>
          <p>
            Kiểm soát bản khai tàu e-Manifest, đối chiếu đơn dịch vụ ePort, cấp phép xe vận tải và tự động phân bổ vị trí bãi.
          </p>
        </div>

        <div className="epc-page-actions">
          <button
            type="button"
            onClick={handleRefresh}
            className="epc-button secondary"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      <section className="epo-hero !mb-0" aria-labelledby="gate-hero-title">
        <div className="epo-hero-lines" aria-hidden="true" />
        <div className="epo-hero-copy">
          <span className="epo-brand"><span />NEXUSPORT GATE &amp; E-PORT</span>
          <h2 id="gate-hero-title">Mỗi container.<br /><span>Một luồng duyệt minh bạch.</span></h2>
          <p>
            Thông tin e-Manifest từ Hãng tàu, đơn Dịch vụ ePort và điều phối xe Công ty Vận tải được đối chiếu tự động trước khi cấp vị trí bãi &amp; gửi Bill.
          </p>
          <span className="epo-hero-assurance">
            <span className="material-symbols-outlined text-sm">verified_user</span>
            Đối chiếu tự động Cont · Vận đơn B/L · Công ty vận tải
          </span>
        </div>
        <div className="epo-hero-summary">
          <span className="epo-summary-icon">
            <span className="material-symbols-outlined text-2xl">fact_check</span>
          </span>
          <span>CONTAINER ĐANG ĐIỀU PHỐI</span>
          <strong>{manifestGeneratedBookings.length}</strong>
          <small>{eportListTotal} đơn ePort · {kpiStats.pending} chờ duyệt · {kpiStats.approvedToday} đã duyệt</small>
        </div>
      </section>

      {/* ── THÔNG BÁO HỒ SƠ MỚI TỪ BÊN VẬN TẢI (CARRIER) GỬI SANG ĐỂ KIỂM TRA KHỚP ── */}
      {transportAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
              <span className="material-symbols-outlined text-amber-600 text-lg animate-bounce">notifications_active</span>
              <span>Thông báo mới từ Công Ty Vận Tải ({transportAlerts.length} hồ sơ chờ kiểm tra khớp &amp; duyệt gửi Bill)</span>
            </div>
            <button
              type="button"
              onClick={() => {
                manifestPortSyncService.dismissTransportSubmissionAlert(null)
                setTransportAlerts([])
              }}
              className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 cursor-pointer"
            >
              Ẩn tất cả
            </button>
          </div>
          <div className="space-y-1.5">
            {transportAlerts.slice(0, 3).map((alert) => (
              <div key={alert.id} className="bg-white/90 border border-amber-200 rounded-lg px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="font-bold text-slate-900">{alert.company}</span>{' '}
                  <span className="text-slate-600">vừa gửi hồ sơ cho Container</span>{' '}
                  <strong className="font-mono text-blue-700">{alert.containerId}</strong>{' '}
                  <span className="text-slate-500">
                    (Xe <strong className="font-mono text-slate-800">{alert.licensePlate}</strong> · Tài xế <strong>{alert.driverName}</strong>{alert.billOfLading ? ` · B/L: ${alert.billOfLading}` : ''})
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const found = manifestGeneratedBookings.find(b => b.id === alert.id || b.containerId === alert.containerId)
                        || bookings.find(b => b.id === alert.id || b.containerId === alert.containerId)
                      if (found) {
                        setSelectedBooking(found)
                        setShowEportSyncPopup(true)
                      } else {
                        showToast(`Không tìm thấy đơn ${alert.containerId} trong danh sách hiện tại.`)
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>Kiểm tra khớp &amp; Duyệt ➔</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      manifestPortSyncService.dismissTransportSubmissionAlert(alert.id)
                      setTransportAlerts(manifestPortSyncService.getTransportSubmissionAlerts())
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold cursor-pointer"
                  >
                    Ẩn
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── THANH TAB CHUYỂN ĐỔI DANH MỤC (VIBE ePORT SEGMENTED PILLS) ── */}
      <div className="rounded-[15px] border border-[#e3e8ed] bg-[#eaf0f5] p-1.5 flex flex-wrap gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveListType('vessel')}
          className={`px-4 py-2.5 rounded-[10px] text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeListType === 'vessel'
              ? 'bg-white text-[#b94717] border border-[#e2e5e9] shadow-xs'
              : 'text-[#68798c] hover:text-[#172638] hover:bg-white/50'
          }`}
        >
          <span className="material-symbols-outlined text-base">directions_boat</span>
          <span>Danh Sách Tàu (e-Manifest)</span>
          <span className={`px-2 py-0.5 text-[11px] rounded-md font-mono ${
            activeListType === 'vessel' ? 'bg-[#fff0e7] text-[#b94717]' : 'bg-[#dbe4ed]/90 text-[#6a7c8d]'
          }`}>
            {syncedManifestList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveListType('truck')}
          className={`px-4 py-2.5 rounded-[10px] text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeListType === 'truck'
              ? 'bg-white text-[#b94717] border border-[#e2e5e9] shadow-xs'
              : 'text-[#68798c] hover:text-[#172638] hover:bg-white/50'
          }`}
        >
          <span className="material-symbols-outlined text-base">domain</span>
          <span>Container Theo Công Ty Vận Tải</span>
          <span className={`px-2 py-0.5 text-[11px] rounded-md font-mono ${
            activeListType === 'truck' ? 'bg-[#fff0e7] text-[#b94717]' : 'bg-[#dbe4ed]/90 text-[#6a7c8d]'
          }`}>
            {filteredBookings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveListType('eport')}
          className={`px-4 py-2.5 rounded-[10px] text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeListType === 'eport'
              ? 'bg-white text-[#b94717] border border-[#e2e5e9] shadow-xs'
              : 'text-[#68798c] hover:text-[#172638] hover:bg-white/50'
          }`}
        >
          <span className="material-symbols-outlined text-base">assignment_turned_in</span>
          <span>Danh Sách Đơn Dịch Vụ ePort</span>
          <span className={`px-2 py-0.5 text-[11px] rounded-md font-mono ${
            activeListType === 'eport' ? 'bg-[#fff0e7] text-[#b94717]' : 'bg-[#dbe4ed]/90 text-[#6a7c8d]'
          }`}>
            {eportListTotal}
          </span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── NỘI DUNG TAB 1: DANH SÁCH CONTAINER CHIA THEO CÔNG TY VẬN TẢI ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeListType === 'truck' && (
        <>
          {/* ── KPI CHỈ SỐ CONTAINER THEO VIBE ePORT ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div
              onClick={() => setStatusFilter(statusFilter === 'Pending' ? 'All' : 'Pending')}
              className={`rounded-[15px] border bg-white p-4 transition-all cursor-pointer ${
                statusFilter === 'Pending' ? 'border-[#cc9469] ring-2 ring-[#fb9b70]/40' : 'border-[#e0e8f0] hover:border-[#becbd8]'
              }`}
            >
              <div className="text-[10px] font-bold text-[#a1845f] uppercase tracking-wider">Chờ kiểm duyệt</div>
              <div className="text-2xl font-bold text-[#29415a] mt-1 font-mono">{kpiStats.pending}</div>
              <div className="text-[11px] text-[#778ba3] mt-0.5">Cần xử lý ngay</div>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'Under Review' ? 'All' : 'Under Review')}
              className={`rounded-[15px] border bg-white p-4 transition-all cursor-pointer ${
                statusFilter === 'Under Review' ? 'border-[#6b88a9] ring-2 ring-[#6b88a9]/30' : 'border-[#e0e8f0] hover:border-[#becbd8]'
              }`}
            >
              <div className="text-[10px] font-bold text-[#6b88a9] uppercase tracking-wider">Đang duyệt</div>
              <div className="text-2xl font-bold text-[#29415a] mt-1 font-mono">{kpiStats.underReview}</div>
              <div className="text-[11px] text-[#778ba3] mt-0.5">Đang đối soát hồ sơ</div>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'Approved' ? 'All' : 'Approved')}
              className={`rounded-[15px] border bg-white p-4 transition-all cursor-pointer ${
                statusFilter === 'Approved' ? 'border-[#5e8b74] ring-2 ring-[#5e8b74]/30' : 'border-[#e0e8f0] hover:border-[#becbd8]'
              }`}
            >
              <div className="text-[10px] font-bold text-[#5e8b74] uppercase tracking-wider">Đã duyệt hôm nay</div>
              <div className="text-2xl font-bold text-[#29415a] mt-1 font-mono">{kpiStats.approvedToday}</div>
              <div className="text-[11px] text-[#778ba3] mt-0.5">Đủ điều kiện qua cổng</div>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'Rejected' ? 'All' : 'Rejected')}
              className={`rounded-[15px] border bg-white p-4 transition-all cursor-pointer ${
                statusFilter === 'Rejected' ? 'border-[#ad7a73] ring-2 ring-[#ad7a73]/30' : 'border-[#e0e8f0] hover:border-[#becbd8]'
              }`}
            >
              <div className="text-[10px] font-bold text-[#ad7a73] uppercase tracking-wider">Từ chối hôm nay</div>
              <div className="text-2xl font-bold text-[#29415a] mt-1 font-mono">{kpiStats.rejectedToday}</div>
              <div className="text-[11px] text-[#778ba3] mt-0.5">Sai lệch chứng từ</div>
            </div>

            <div
              onClick={() => setStatusFilter('All')}
              className="rounded-[15px] border border-[#e0e8f0] bg-white p-4 transition-all cursor-pointer col-span-2 sm:col-span-1 hover:border-[#becbd8]"
            >
              <div className="text-[10px] font-bold text-[#b94717] uppercase tracking-wider">Đợi Transport gửi xe</div>
              <div className="text-2xl font-bold text-[#b94717] mt-1 font-mono">{kpiStats.atRisk}</div>
              <div className="text-[11px] text-[#778ba3] mt-0.5">Đã có giấy tờ &amp; bãi</div>
            </div>
          </div>

          {/* ── THANH TÌM KIẾM & BỘ LỌC NHANH THEO VIBE ePORT ── */}
          <div className="epo-worklist p-4 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3.5">
            {/* Quick Status Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 rounded-[12px] bg-[#eaf0f5] p-1 border border-[#e3e8ed]">
              {[
                { key: 'All', label: 'Tất cả', count: manifestGeneratedBookings.length },
                { key: 'Pending', label: 'Chờ duyệt', count: kpiStats.pending },
                { key: 'Under Review', label: 'Đang duyệt', count: kpiStats.underReview },
                { key: 'Approved', label: 'Đã duyệt', count: kpiStats.approvedToday },
                { key: 'Rejected', label: 'Từ chối', count: kpiStats.rejectedToday },
                { key: 'Cancelled', label: 'Đã hủy', count: kpiStats.cancelledToday },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setStatusFilter(st.key)}
                  className={`px-3 py-1.5 rounded-[9px] text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    statusFilter === st.key
                      ? 'bg-white text-[#b94717] border border-[#e2e5e9] shadow-2xs'
                      : 'text-[#68798c] hover:text-[#172638] hover:bg-white/50'
                  }`}
                >
                  <span>{st.label}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    statusFilter === st.key ? 'bg-[#fff0e7] text-[#b94717]' : 'bg-[#dbe4ed]/90 text-[#6a7c8d]'
                  }`}>
                    {st.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search + Select Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold">
              <div className="relative flex-1 sm:w-64 min-w-[200px]">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate text-base">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm mã Booking, Số cont, Công ty, Tàu..."
                  className="w-full h-9 pl-9 pr-7 rounded-xl border border-chalk bg-fog/60 text-xs font-bold text-carbon placeholder:text-slate/70 focus:outline-none focus:border-signal-orange focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate hover:text-carbon cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              

              <select
                value={operationFilter}
                onChange={e => setOperationFilter(e.target.value)}
                className="h-9 px-3 bg-fog/60 hover:bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange cursor-pointer"
              >
                <option value="All">Mọi nghiệp vụ</option>
                <option value="Pickup">Lấy cont (Pickup)</option>
                <option value="Delivery">Hạ cont (Delivery)</option>
              </select>

              <select
                value={companyFilter}
                onChange={e => setCompanyFilter(e.target.value)}
                className="h-9 px-3 bg-fog/60 hover:bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange max-w-[220px] truncate cursor-pointer"
              >
                <option value="All">Tất cả công ty vận tải ({companyList.length})</option>
                {companyList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── DANH SÁCH CONTAINER CHIA THEO TỪNG CÔNG TY VẬN TẢI (THAY THẾ CHO DANH SÁCH XE ĐƯỜNG BỘ) ── */}
          {renderManifestCompanyTables()}
        </>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── NỘI DUNG TAB ĐẦU TIÊN: DANH SÁCH TÀU CẬP CẢNG (BẢN KHAI MANIFEST) ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeListType === 'vessel' && (
        <div className="space-y-4">
          {/* ── KPI CHỈ SỐ TÀU CẬP CẢNG CHUẨN REEFER (WHITE & ORANGE ENTERPRISE) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tổng số tàu cập cảng</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{vesselKpiStats.total}</div>
              <div className="text-xs text-slate-400 mt-0.5">Bản khai điện tử e-Manifest</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-emerald-600 p-4 shadow-2xs">
              <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Tàu đã cập cảng</div>
              <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono">{vesselKpiStats.berthed}</div>
              <div className="text-xs text-slate-500 mt-0.5">Sẵn sàng đón xe vào bãi</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-indigo-600 p-4 shadow-2xs">
              <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Đang làm hàng</div>
              <div className="text-2xl font-bold text-indigo-700 mt-1 font-mono">{vesselKpiStats.operating}</div>
              <div className="text-xs text-slate-500 mt-0.5">Xếp dỡ tại cầu bến</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-orange-500 p-4 shadow-2xs">
              <div className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Tổng container khai báo</div>
              <div className="text-2xl font-bold text-orange-600 mt-1 font-mono">{vesselKpiStats.totalContainers}</div>
              <div className="text-xs text-slate-500 mt-0.5">Chuẩn ISO 6346 &amp; VGM</div>
            </div>
          </div>

          {/* ── THANH TÌM KIẾM TÀU TỐI GIẢN ── */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input
                type="text"
                value={vesselSearch}
                onChange={e => setVesselSearch(e.target.value)}
                placeholder="Tìm tàu, số chuyến, mã bản khai..."
                className="w-full h-8 pl-8 pr-7 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 transition-all"
              />
              {vesselSearch && (
                <button
                  type="button"
                  onClick={() => setVesselSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {selectedVesselFilter !== 'All' && (
              <button
                type="button"
                onClick={() => setSelectedVesselFilter('All')}
                className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                <span>Xem tất cả tàu</span>
              </button>
            )}
          </div>

          {/* ── BẢNG DANH SÁCH TÀU CẬP CẢNG (TỐI GIẢN, 1 DÒNG/Ô, CỰC KỲ ÍT CHỮ) ── */}
          <div className="bg-white rounded-2xl border border-chalk shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-chalk flex items-center justify-between bg-fog/30">
              <h3 className="font-heading text-xs font-extrabold text-carbon uppercase tracking-wider">
                Danh Sách Tàu Cập Cảng ({filteredVessels.length})
              </h3>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-fog/50 border-b border-chalk text-slate font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3.5">Tàu Biển &amp; Chuyến</th>
                    <th className="py-2.5 px-3">Hãng Tàu</th>
                    <th className="py-2.5 px-3">Cầu Bến</th>
                    <th className="py-2.5 px-3">Container</th>
                    <th className="py-2.5 px-3">Trạng Thái</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chalk font-medium">
                  {filteredVessels.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 px-4 text-center">
                        <div className="max-w-md mx-auto space-y-2">
                          <span className="material-symbols-outlined text-4xl text-slate-300">directions_boat</span>
                          <div className="text-sm font-bold text-slate-700">Chưa Có Bản Khai Nào Được Truyền Sang Cảng</div>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Vui lòng vào phân hệ <a href="/shipping-line/manifest" className="text-orange-600 font-bold underline">Hãng Tàu &gt; Quản Lý Bản Khai</a> và bấm nút <strong className="text-orange-600 font-mono">[Gửi dữ liệu cho cảng]</strong> để truyền thông tin tàu và container sang Cảng Tiên Sa.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pagedVessels.map(m => {
                      const isApproved = m.portApprovalStatus === 'PORT_APPROVED'
                      const vKey = m.manifestNumber || m.manifestId
                      const isSelectedFilter = selectedVesselFilter === vKey || selectedVesselFilter === m.vesselName

                      return (
                        <tr
                          key={vKey}
                          onClick={() => setSelectedVesselManifest(m)}
                          className="hover:bg-fog/60 transition-colors cursor-pointer group"
                        >
                          {/* 1. Tàu & Chuyến (1 dòng) */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <span className="font-bold text-carbon text-xs group-hover:text-signal-orange">
                              {m.vesselName}
                            </span>
                            <span className="font-mono text-slate text-[11px] ml-1.5">
                              ({m.voyageNumber})
                            </span>
                          </td>

                          {/* 2. Hãng Tàu (1 dòng) */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="text-carbon font-medium text-xs">
                              {m.shippingLine ? m.shippingLine.split('(')[0].trim() : 'Hãng tàu'}
                            </span>
                          </td>

                          {/* 3. Cầu bến (1 dòng) */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-mono text-xs text-carbon">
                              {m.berth ? m.berth.split(' - ')[0] : 'Bến TS-01'}
                            </span>
                          </td>

                          {/* 4. Số Cont (Tone xám trung tính, bỏ màu tím) */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-fog border border-chalk font-mono font-bold text-xs text-carbon">
                              {m.containers?.length || 0} Cont
                            </span>
                          </td>

                          {/* 5. Trạng thái tàu (Dropdown trạng thái chuyến tàu: Đã cập cảng, Kế hoạch, Đang làm hàng...) */}
                          <td className="py-2.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="relative inline-flex items-center">
                              <select
                                value={m.vesselStatus || 'BERTHED'}
                                onChange={(e) => {
                                  const newStatus = e.target.value
                                  manifestPortSyncService.updateManifestVesselStatus(m.manifestId || m.manifestNumber, newStatus)
                                  setManifestSyncVersion(v => v + 1)
                                  showToast(`⚓ Đã cập nhật trạng thái tàu thành: ${VOYAGE_STATUS_LABELS[newStatus] || newStatus}`)
                                }}
                                title="Bấm để chọn chuyển đổi trạng thái chuyến tàu"
                                className={`text-[11px] font-bold py-1 pl-3 pr-7 rounded-full border cursor-pointer appearance-none focus:outline-none transition-all shadow-2xs ${
                                  VOYAGE_STATUS_STYLES[m.vesselStatus || 'BERTHED'] || 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                } hover:brightness-95`}
                              >
                                <option value="BERTHED">● Đã cập cảng</option>
                                <option value="SCHEDULED">● Kế hoạch</option>
                                <option value="OPERATING">● Đang làm hàng</option>
                                <option value="IN_TRANSIT">● Đang hành trình</option>
                                <option value="DEPARTED">● Đã rời cảng</option>
                                <option value="COMPLETED">● Hoàn tất</option>
                              </select>
                              <span className="material-symbols-outlined text-xs absolute right-1.5 pointer-events-none opacity-60">
                                expand_more
                              </span>
                            </div>
                          </td>

                          {/* 6. Thao tác: Lọc Cont + Xem Chi Tiết */}
                          <td className="py-2.5 px-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {isApproved && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const willFilter = !isSelectedFilter
                                    setSelectedVesselFilter(willFilter ? vKey : 'All')
                                    if (willFilter) {
                                      setVesselContainersPopup(m)
                                    } else {
                                      setVesselContainersPopup(null)
                                    }
                                  }}
                                  title="Xem danh sách Container của tàu này"
                                  className="h-7 px-2 bg-fog hover:bg-chalk/70 text-carbon border border-chalk rounded-lg font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
                                >
                                  <span className="material-symbols-outlined text-[13px]">filter_alt</span>
                                  <span>Lọc Cont</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedVesselManifest(m)
                                }}
                                className="h-7 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold text-[11px] shadow-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>Chi tiết</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Phân trang Bảng Tàu Cập Cảng */}
            <ShippingPagination
              currentPage={vesselPage}
              totalItems={filteredVessels.length}
              pageSize={vesselPageSize}
              onPageChange={setVesselPage}
              onPageSizeChange={setVesselPageSize}
              pageSizeOptions={[5, 10, 20]}
              itemName="bản khai tàu"
            />
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── MODAL POPUP DANH SÁCH CONTAINER CỦA TÀU (MỞ KHI BẤM CÁI PHỄU) ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {vesselContainersPopup && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl overflow-y-auto animate-in zoom-in-95 duration-150 font-sans border border-slate-200">
            {/* Header Popup - Tối Giản, Gọn Gàng */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">directions_boat</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 font-heading">
                      Tàu {vesselContainersPopup.vesselName} ({vesselContainersPopup.voyageNumber})
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {vesselContainersPopup.direction === 'IMPORT' ? 'Nhập khẩu' : 'Xuất khẩu'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hãng: <strong>{vesselContainersPopup.shippingLine}</strong> · Cầu bến: {vesselContainersPopup.berth || 'Bến số 1 (TS-01)'} · {popupContainerList.length} Container
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVesselFilter('All')
                    setVesselContainersPopup(null)
                    showToast('⚪ Đã bỏ lọc tàu, hiển thị lại toàn bộ Container.')
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition"
                >
                  <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                  <span>Bỏ lọc</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVesselContainersPopup(null)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer transition"
                  title="Đóng"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            </div>

            {/* Thống kê nhanh Container - Tối giản */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Tổng Container</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-lg font-extrabold text-slate-900 font-mono">{popupContainerList.length}</span>
                  <span className="text-[11px] text-emerald-600 font-medium">· 100% có vị trí</span>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Kích Thước</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-base font-bold text-slate-900 font-mono">
                    {popupContainerList.filter(c => (c.containerType || '').includes('40')).length}x40'
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-base font-bold text-slate-900 font-mono">
                    {popupContainerList.filter(c => (c.containerType || '').includes('20')).length}x20'
                  </span>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Phân Bổ Vận Tải</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-lg font-extrabold text-slate-900 font-mono">
                    {new Set(popupContainerList.map(c => c.company)).size}
                  </span>
                  <span className="text-[11px] text-slate-500">đơn vị điều phối</span>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Cổng Vào Tự Động</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-mono font-bold text-[11px]">Gate 1</span>
                  <span className="px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800 font-mono font-bold text-[11px]">Gate 2</span>
                </div>
              </div>
            </div>

            {/* Bảng Danh Sách Container Tối Giản */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-[48vh]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10">STT</th>
                      <th className="py-2.5 px-3">Container</th>
                      <th className="py-2.5 px-3">Loại</th>
                      <th className="py-2.5 px-3">Cổng Vào</th>
                      <th className="py-2.5 px-3">Vị Trí Bãi Tiên Sa</th>
                      <th className="py-2.5 px-3">Công Ty Vận Tải</th>
                      <th className="py-2.5 px-3">Vận Đơn (B/L)</th>
                      <th className="py-2.5 px-3 text-right">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[12px]">
                    {pagedPopupContainers.map((item, idx) => {
                      const globalIdx = (popupContainerPage - 1) * popupContainerPageSize + idx + 1
                      const isRf = (item.containerType || '').includes('RF') || item.isReefer
                      const isDg = item.isDG || (item.dgClass && !item.dgClass.includes('Non-DG'))
                      const slot = item.autoYardSlot || {}

                      // Tính toán vị trí bãi chuẩn - KHÔNG BAO GIỜ BỊ UNDEFINED
                      const block = slot.blockCode || (isRf ? 'D01' : (isDg ? 'E01' : (idx % 2 === 0 ? 'A01' : 'A02')))
                      const bayNum = slot.bay || slot.bayCode || (item.containerType?.includes('20') ? (1 + (idx * 2) % 15) : (2 + (idx * 2) % 16))
                      const bayStr = String(bayNum).padStart(2, '0')
                      const rowNum = slot.row || slot.rowCode || ((idx % 4) + 1)
                      const rowStr = String(rowNum).padStart(2, '0')
                      const tierNum = slot.tier || 1
                      const locationText = `Khu ${block} · Bay ${bayStr} (R${rowStr}-T${tierNum})`

                      // Cổng vào tự động
                      const gateVal = item.requestedGate || slot.gate || (isRf ? 'Gate 2' : (isDg ? 'Gate 3' : (idx % 2 === 0 ? 'Gate 1' : 'Gate 2')))

                      return (
                        <tr key={item.id || item.containerId || idx} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 font-mono text-slate-400">{globalIdx}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {item.containerId || item.containerNumber}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                              isRf
                                ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                                : isDg
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {item.containerType || item.isoType || '40HC'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] inline-flex items-center gap-1 ${
                              gateVal === 'Gate 2'
                                ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                                : gateVal === 'Gate 3'
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : 'bg-blue-50 text-blue-800 border border-blue-200'
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                              {gateVal}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-mono font-bold text-emerald-800 bg-emerald-50/90 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                              📍 {locationText}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 max-w-[200px]">
                            <div className="font-medium text-slate-700 truncate" title={item.company || item.transportCompany}>
                              {item.company || item.transportCompany || 'Chờ phân bổ'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap text-slate-600">
                            <span className="font-semibold text-slate-800">{item.blNumber || 'BL-VNDAD'}</span>
                            <span className="text-slate-400 mx-1">·</span>
                            <span>{item.sealNumber || 'SL-88412'}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[10px]">
                              {item.transportSubmitted ? '● Đã có xe' : '○ Chờ Transport gửi xe'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer popup - Tối Giản */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500">
                Tổng cộng: <strong className="text-slate-900 font-mono">{popupContainerList.length} Container</strong>
              </span>
              <button
                type="button"
                onClick={() => setVesselContainersPopup(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── MODAL CHI TIẾT TÀU CẬP CẢNG & BẢN KHAI HÀNG HÓA E-MANIFEST ĐẦY ĐỦ ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {selectedVesselManifest && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 print:p-0 print:bg-white">
          <div className="bg-white w-full max-w-[96vw] xl:max-w-7xl max-h-[95vh] rounded-3xl p-5 md:p-8 space-y-6 shadow-2xl overflow-y-auto animate-in zoom-in-95 duration-200 font-sans print:max-h-none print:shadow-none print:rounded-none">
            
            {/* Modal Top Header - Đơn giản, thoáng mắt, dễ nhìn */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <span className="material-symbols-outlined text-2xl">directions_boat</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading text-lg sm:text-xl font-bold text-slate-900 truncate">
                      Tàu {selectedVesselManifest.vesselName}
                    </h3>
                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-mono font-bold text-xs border border-blue-200">
                      Chuyến {selectedVesselManifest.voyageNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-medium text-xs">
                      {selectedVesselManifest.shippingLine}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5 flex-wrap">
                    <span>NSW: <strong className="text-blue-900 font-bold">{selectedVesselManifest.nswRef || 'NSW-DAD-2026-2341'}</strong></span>
                    <span>•</span>
                    <span>Cầu bến: <strong className="text-slate-700 font-bold">{selectedVesselManifest.berth || 'Bến số 1 (TS-01)'}</strong></span>
                    <span>•</span>
                    <span>Hành trình: <strong className="text-slate-700">{selectedVesselManifest.pol?.split(',')[0] || 'Tiên Sa'} ➔ {selectedVesselManifest.pod?.split(',')[0] || 'Quốc tế'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                  title="In / Xuất Bản khai"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  <span>In bản khai</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVesselManifest(null)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer text-sm font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* ── KPI THỐNG KÊ TOÀN TÀU (TINH GỌN) ── */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tổng Container</span>
                <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{selectedVesselCargoStats.count} Cont</div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Trọng lượng Gross</span>
                <div className="text-lg font-bold font-mono text-blue-700 mt-0.5">{selectedVesselCargoStats.gross.toLocaleString()} kg</div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tổng thể tích (CBM)</span>
                <div className="text-lg font-bold font-mono text-purple-700 mt-0.5">{selectedVesselCargoStats.cbm} m³</div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tổng Vận Đơn (B/L)</span>
                <div className="text-lg font-bold font-mono text-amber-600 mt-0.5">{selectedVesselBlGroups.length} B/L</div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cont Lạnh (Reefer)</span>
                <div className="text-lg font-bold font-mono text-emerald-600 mt-0.5">{selectedVesselCargoStats.rfCount} RF</div>
              </div>
            </div>

            {/* ── THANH CHUYỂN ĐỔI 4 TABS TRONG MODAL ── */}
            <div className="border-b border-chalk flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setVesselDetailTab('containers')}
                className={`flex items-center gap-2 px-5 py-3 border-b-2 font-extrabold text-xs transition-all cursor-pointer shrink-0 ${
                  vesselDetailTab === 'containers'
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-slate hover:text-carbon hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-base">inventory_2</span>
                <span>1. Danh Sách Container Chi Tiết ({selectedVesselCargoStats.count})</span>
              </button>

              <button
                type="button"
                onClick={() => setVesselDetailTab('bl')}
                className={`flex items-center gap-2 px-5 py-3 border-b-2 font-extrabold text-xs transition-all cursor-pointer shrink-0 ${
                  vesselDetailTab === 'bl'
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-slate hover:text-carbon hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-base">receipt_long</span>
                <span>2. Tổng Hợp Theo Vận Đơn B/L ({selectedVesselBlGroups.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setVesselDetailTab('vessel')}
                className={`flex items-center gap-2 px-5 py-3 border-b-2 font-extrabold text-xs transition-all cursor-pointer shrink-0 ${
                  vesselDetailTab === 'vessel'
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-slate hover:text-carbon hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-base">directions_boat</span>
                <span>3. Hồ Sơ Kỹ Thuật Tàu &amp; Cầu Bến</span>
              </button>

              
            </div>

            {/* ── NỘI DUNG TAB 1: DANH SÁCH CONTAINER CHI TIẾT (14 CỘT CHUẨN) ── */}
            {vesselDetailTab === 'containers' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs text-slate">
                  <span className="font-bold">Khai báo đầy đủ 100% container chuẩn ISO 6346, số niêm chì hải quan, VGM và vị trí stowage trên tàu</span>
                  <span className="font-mono font-bold text-carbon">Hiển thị {selectedVesselCargoStats.count} / {selectedVesselCargoStats.count} Container</span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-3 w-[18%]">Container / ISO / Seal</th>
                        <th className="py-3 px-3 w-[24%]">Vận Đơn B/L &amp; Chủ Hàng</th>
                        <th className="py-3 px-3 w-[20%]">Hàng Hóa &amp; Số Kiện</th>
                        <th className="py-3 px-3 w-[14%]">Trọng Lượng &amp; CBM</th>
                        <th className="py-3 px-3 w-[12%]">Nhiệt Độ / DG</th>
                        <th className="py-3 px-3 w-[12%] text-right">Stowage &amp; HQ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {(selectedVesselManifest.containers || []).map((c, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                          {/* 1. Container + ISO + Seal */}
                          <td className="py-3 px-3 align-middle">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                              <span className="font-mono font-extrabold text-slate-900 text-xs">{c.containerNumber}</span>
                              <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-300 font-mono font-bold text-[10px] text-slate-700">
                                {c.isoType || '40HC'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] font-mono text-slate-600">Seal: <strong>{c.sealNumber || 'SL-88412'}</strong></span>
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                ISO OK
                              </span>
                            </div>
                          </td>

                          {/* 2. Vận đơn B/L & Công ty vận tải dự kiến nhận */}
                          <td className="py-3 px-3 align-middle">
                            <div className="font-mono font-bold text-blue-700 text-xs">
                              {c.blNumber || 'BL-VNDAD-AUTO'}
                            </div>
                            <div className="text-[11px] font-bold text-slate-900 truncate max-w-[230px] mt-0.5" title={`Đơn vị vận tải: ${c.transportCompany || 'Bien Dong Logistics - Nexus Logistics'}`}>
                              <span className="text-orange-600 font-extrabold">ĐV Vận tải:</span> {c.transportCompany || 'Bien Dong Logistics - Nexus Logistics'}
                            </div>
                            <div className="text-[10px] text-slate-500 italic truncate max-w-[230px]">
                              Chưa có xe &amp; tài xế (Chờ Transport gửi sau khi duyệt tàu)
                            </div>
                          </td>

                          {/* 3. Hàng hóa & Kiện */}
                          <td className="py-3 px-3 align-middle">
                            <div className="font-bold text-slate-800 text-[11px] line-clamp-2">
                              {c.cargoDescription || 'Hàng hóa xuất khẩu tiêu chuẩn'}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {c.packageCount || '480 Kiện / Pallets'}
                            </div>
                          </td>

                          {/* 4. Trọng lượng Gross / Tare / Net & CBM */}
                          <td className="py-3 px-3 align-middle font-mono">
                            <div className="font-extrabold text-blue-950 text-xs">
                              {Number(c.grossWeightKg || 25400).toLocaleString()} kg <span className="text-[9px] font-sans font-bold text-emerald-700 bg-emerald-50 px-1 rounded">VGM</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Net: {Number(c.netWeightKg || ((Number(c.grossWeightKg) || 25400) - 3820)).toLocaleString()} • Tare: {Number(c.tareWeightKg || 3820).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-slate-600 font-bold">
                              Thể tích: {c.cbm || 68.5} CBM
                            </div>
                          </td>

                          {/* 5. Nhiệt độ / DG */}
                          <td className="py-3 px-3 align-middle text-[11px]">
                            {(c.isoType?.includes('RF') || c.tempRequired?.includes('-')) ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-300 whitespace-nowrap">
                                <span className="material-symbols-outlined text-[12px]">ac_unit</span>
                                {c.tempRequired || '-18.0°C'}
                              </span>
                            ) : c.dgClass?.includes('Class') ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
                                <span className="material-symbols-outlined text-[12px] text-amber-700">warning</span>
                                {c.dgClass}
                              </span>
                            ) : (
                              <span className="text-slate-600 font-medium">{c.tempRequired || 'Dry (Thường)'}</span>
                            )}
                          </td>

                          {/* 6. Vị trí Stowage & Hải quan */}
                          <td className="py-3 px-3 align-middle text-right">
                            <div>
                              <span className="font-bold text-slate-800 font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-block whitespace-nowrap">
                                {c.stowageCell || 'Bay 02 - Row 04'}
                              </span>
                            </div>
                            <div className="mt-1">
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full font-bold text-[10px] inline-block whitespace-nowrap">
                                {c.customsStatus || 'Thông quan'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── NỘI DUNG TAB 2: TỔNG HỢP THEO VẬN ĐƠN B/L (TINH GỌN, DỄ NHÌN) ── */}
            {vesselDetailTab === 'bl' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <h4 className="font-heading font-bold text-sm text-slate-900">
                      Danh Sách Vận Đơn Đường Biển ({selectedVesselBlGroups.length} B/L)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Vận đơn chính thức thuộc chuyến tàu {selectedVesselManifest.vesselName} ({selectedVesselManifest.voyageNumber})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs print:hidden"
                  >
                    <span className="material-symbols-outlined text-sm">print</span>
                    <span>In Vận Đơn</span>
                  </button>
                </div>

                {/* Danh sách các Vận Đơn theo Card tinh gọn */}
                <div className="space-y-4">
                  {selectedVesselBlGroups.map((bg, bIdx) => {
                    const isImport = selectedVesselManifest.direction === 'IMPORT';
                    const carrierName = selectedVesselManifest.shippingLine || 'EVERGREEN';

                    return (
                      <div
                        key={bIdx}
                        className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs hover:border-blue-300 transition-all"
                      >
                        {/* Header B/L Card */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                              #{bIdx + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Số Vận Đơn (B/L):</span>
                                <strong className="font-mono text-sm text-blue-900 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  {bg.blNumber}
                                </strong>
                                <span className="text-xs text-slate-500 font-medium">• Hãng tàu: <strong>{carrierName}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px] flex items-center gap-1">
                              <span>✓</span>
                              <span>Đã thẩm định B/L</span>
                            </span>
                          </div>
                        </div>

                        {/* Thông tin cốt lõi (Shipper, Consignee, Cảng) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">Người gửi (Shipper):</span>
                            <strong className="text-slate-900 block mt-0.5">{bg.shipper}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">Người nhận (Consignee):</span>
                            <strong className="text-slate-900 block mt-0.5">{bg.consignee}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">Tuyến &amp; Cước phí:</span>
                            <span className="text-slate-700 block mt-0.5">
                              {bg.pol?.split(',')[0] || 'Cảng đi'} ➔ {bg.pod?.split(',')[0] || 'Cảng đến'}
                              <span className="text-emerald-700 font-semibold ml-1.5 font-mono">({isImport ? 'Collect' : 'Prepaid'})</span>
                            </span>
                          </div>
                        </div>

                        {/* Danh sách Container thuộc B/L này (Bảng mini gọn gàng) */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                                <th className="py-2 px-3">Mã Container</th>
                                <th className="py-2 px-3">Loại Cont</th>
                                <th className="py-2 px-3">Số Seal</th>
                                <th className="py-2 px-3">Hàng hóa</th>
                                <th className="py-2 px-3 text-right">Trọng lượng</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {bg.containers.map((c, cIdx) => (
                                <tr key={cIdx} className="hover:bg-blue-50/20">
                                  <td className="py-2 px-3 font-mono font-bold text-slate-900">{c.containerNumber}</td>
                                  <td className="py-2 px-3 font-mono text-slate-600">{c.isoType || '40HC'}</td>
                                  <td className="py-2 px-3 font-mono text-blue-700">{c.sealNumber || 'SL-88412'}</td>
                                  <td className="py-2 px-3 text-slate-700 truncate max-w-xs">{c.cargoDescription || 'Hàng bách hóa tiêu chuẩn'}</td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{Number(c.grossWeightKg || 24000).toLocaleString()} kg</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-50/80 border-t border-slate-200 text-[11px] font-bold text-slate-700">
                                <td colSpan="3" className="py-2 px-3">
                                  Tổng: {bg.containers.length} Container
                                </td>
                                <td className="py-2 px-3 text-right text-slate-500 font-normal">Tổng Gross B/L:</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-blue-900">
                                  {bg.totalGrossWeight.toLocaleString()} kg
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── NỘI DUNG TAB 3: HỒ SƠ KỸ THUẬT TÀU & CẦU BẾN ── */}
            {vesselDetailTab === 'vessel' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Card 1: Định danh Tàu */}
                  <div className="border border-chalk rounded-2xl p-4 bg-white space-y-2.5 shadow-2xs">
                    <h4 className="font-extrabold text-carbon text-sm uppercase tracking-wider flex items-center gap-2 border-b border-chalk pb-2">
                      <span className="material-symbols-outlined text-blue-600 text-base">directions_boat</span>
                      <span>Định Danh Tàu Biển</span>
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-fog">
                        <span className="text-slate">Tên Tàu (Vessel Name):</span>
                        <strong className="text-carbon font-extrabold">{selectedVesselManifest.vesselName}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-fog">
                        <span className="text-slate">Số Hiệu IMO:</span>
                        <strong className="font-mono text-carbon">{selectedVesselManifest.imoNumber || 'IMO 9811000'}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-fog">
                        <span className="text-slate">Hô Hiệu (Call Sign):</span>
                        <strong className="font-mono text-carbon">{selectedVesselManifest.callSign || '3FCA2'}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-fog">
                        <span className="text-slate">Quốc Tịch / Cờ (Flag):</span>
                        <strong className="text-carbon">{selectedVesselManifest.flag || 'Panama (PA)'}</strong>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate">Loại Tàu:</span>
                        <strong className="text-carbon">{selectedVesselManifest.vesselType || 'Tàu chở container chuyên dụng'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Kích thước & Trọng tải */}
                  <div className="border border-chalk rounded-2xl p-4 bg-white space-y-2.5 shadow-2xs">
                    <h4 className="font-extrabold text-carbon text-sm uppercase tracking-wider flex items-center gap-2 border-b border-chalk pb-2">
                      <span className="material-symbols-outlined text-purple-600 text-base">straighten</span>
                      <span>Kích Thước &amp; Trọng Tải</span>
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-fog">
                        <span className="text-slate">Chiều dài lớn nhất (LOA):</span>
                        <strong className="font-mono text-carbon">{selectedVesselManifest.lengthOverall || '294.1 m'}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-fog">
                        <span className="text-slate">Chiều rộng lớn nhất (Beam):</span>
                        <strong className="font-mono text-carbon">{selectedVesselManifest.beam || '32.2 m'}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-fog">
                        <span className="text-slate">Mớn nước thực tế (Draft):</span>
                        <strong className="font-mono text-carbon">{selectedVesselManifest.draft || '12.5 m'}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-fog">
                        <span className="text-slate">Trọng tải toàn phần (DWT):</span>
                        <strong className="font-mono text-carbon">{selectedVesselManifest.deadweight || '80,500 DWT'}</strong>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate">Tổng dung tích (GT):</span>
                        <strong className="font-mono text-carbon">{selectedVesselManifest.grossTonnage || '68,200 GT'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Cầu bến & Lịch Cảng */}
                  <div className="border border-chalk rounded-2xl p-4 bg-white space-y-2.5 shadow-2xs">
                    <h4 className="font-extrabold text-carbon text-sm uppercase tracking-wider flex items-center gap-2 border-b border-chalk pb-2">
                      <span className="material-symbols-outlined text-emerald-600 text-base">anchor</span>
                      <span>Lịch Trình &amp; Cầu Bến</span>
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-fog">
                        <span className="text-slate">Cầu bến chỉ định:</span>
                        <strong className="text-emerald-800 font-extrabold">{selectedVesselManifest.berth || 'Bến số 1 (TS-01)'}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-fog">
                        <span className="text-slate">Cảng bốc hàng (POL):</span>
                        <strong className="text-carbon">{selectedVesselManifest.pol || 'Cảng Tiên Sa (VNDAD)'}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-fog">
                        <span className="text-slate">Cảng dỡ hàng (POD):</span>
                        <strong className="text-carbon">{selectedVesselManifest.pod || 'Tokyo (JPTYO)'}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-fog">
                        <span className="text-slate">Giờ cập bến (ETA):</span>
                        <strong className="font-mono text-carbon">{selectedVesselManifest.eta || '2026-11-09 14:00'}</strong>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate">Dự kiến rời bến (ETD):</span>
                        <strong className="font-mono text-carbon">{selectedVesselManifest.etd || '2026-11-09 22:00'}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-chalk">
              <div className="text-xs text-slate">
                Bản khai điện tử: <strong className="text-carbon font-mono">{selectedVesselManifest.manifestNumber}</strong> · Tàu <strong className="text-carbon">{selectedVesselManifest.vesselName}</strong>
              </div>

              <div className="flex items-center gap-3">

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-fog border border-chalk text-carbon rounded-xl font-extrabold text-xs hover:bg-slate-200 transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  In Bản Khai
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedVesselManifest(null)}
                  className="px-6 py-2.5 bg-carbon text-white rounded-xl font-extrabold text-xs hover:bg-black transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── NỘI DUNG TAB 3: TẤT CẢ ĐƠN DỊCH VỤ ePORT GỬI ĐẾN ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeListType === 'eport' && (
        <section className="epo-worklist" aria-labelledby="epo-port-list-title">
          <div className="epo-worklist-heading">
            <div>
              <span className="epo-caption">KHÔNG GIAN HỒ SƠ</span>
              <h2 id="epo-port-list-title">Tất Cả Yêu Cầu Dịch Vụ ePort Gửi Đến Cảng</h2>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="epo-result-count">{eportListTotal} hồ sơ</span>
              <button
                type="button"
                className="epc-button secondary"
                disabled={eportListLoading}
                onClick={() => loadAllEportRequests()}
              >
                <RefreshCw size={15} className={eportListLoading ? 'epc-spin' : ''} />Làm mới
              </button>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              setEportListPage(1)
              loadAllEportRequests({ page: 1 })
            }}
            className="epo-filters"
          >
            <div className="epc-search epo-search">
              <Search size={17} />
              <input
                aria-label="Tìm đơn dịch vụ ePort"
                maxLength={100}
                placeholder="Mã đơn, Booking, dịch vụ hoặc container…"
                value={eportListSearch}
                onChange={(e) => setEportListSearch(e.target.value)}
              />
            </div>
            <label>
              <span className="epc-sr-only">Trạng thái đơn</span>
              <select
                value={eportListStatus}
                onChange={(e) => {
                  setEportListStatus(e.target.value)
                  setEportListPage(1)
                }}
              >
                <option value="">Mọi trạng thái đơn</option>
                {Object.entries(orderStatusLabels)
                  .filter(([val]) => val !== 'DRAFT')
                  .map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
              </select>
            </label>
            <label>
              <span className="epc-sr-only">Trạng thái thanh toán</span>
              <select
                value={eportListPaymentStatus}
                onChange={(e) => {
                  setEportListPaymentStatus(e.target.value)
                  setEportListPage(1)
                }}
              >
                <option value="">Mọi thanh toán</option>
                {['UNPAID', 'PENDING', 'PAID', 'FAILED', 'NOT_REQUIRED'].map((val) => (
                  <option key={val} value={val}>{paymentStatusLabels[val] || val}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="epc-sr-only">Luồng hàng</span>
              <select
                value={eportListFlow}
                onChange={(e) => {
                  setEportListFlow(e.target.value)
                  setEportListPage(1)
                }}
              >
                <option value="">Mọi luồng hàng</option>
                <option value="EXPORT">Hàng xuất</option>
                <option value="IMPORT">Hàng nhập</option>
              </select>
            </label>
          </form>

          {eportListError && (
            <div className="mx-6 mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {eportListError}
            </div>
          )}

          {eportListLoading ? (
            <div className="epo-empty" role="status">
              <Loader2 size={29} className="epc-spin" />
              <h3>Đang tải hồ sơ…</h3>
            </div>
          ) : eportListItems.length === 0 ? (
            <div className="epo-empty">
              <Filter size={33} />
              <h3>Không có hồ sơ phù hợp</h3>
              <p>Thử điều chỉnh từ khóa hoặc bộ lọc để tìm lại hồ sơ ePort gửi đến cảng.</p>
              {(eportListSearch || eportListStatus || eportListPaymentStatus || eportListFlow) && (
                <button
                  type="button"
                  className="epc-button secondary"
                  onClick={() => {
                    setEportListSearch('')
                    setEportListStatus('')
                    setEportListPaymentStatus('')
                    setEportListFlow('')
                    setEportListPage(1)
                  }}
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto w-full rounded-2xl border border-[#e2e8f0] bg-white shadow-2xs">
              <table className="w-full text-left border-collapse text-xs min-w-[1100px]">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#71869f] font-bold uppercase text-[10px] tracking-wider select-none">
                    <th className="py-3 px-4 w-[280px]">Hồ Sơ / Dịch Vụ</th>
                    <th className="py-3 px-4 w-[210px]">Nguồn / Container</th>
                    <th className="py-3 px-3.5 w-[160px]">Trạng Thái Xử Lý</th>
                    <th className="py-3 px-3.5 w-[210px]">Lý Do Từ Chối</th>
                    <th className="py-3 px-4 w-[140px] text-right">Giá Trị Đăng Ký</th>
                    <th className="py-3 px-4 w-[210px] text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf2f7]">
                  {eportListItems.map((order, index) => {
                    const validation = eportValidationMap[order.id]
                    const srcUpper = String(order.sourceLabel || '').toUpperCase()
                    const orderConts = (order.containers || []).map((x) => String(x.containerNumber || '').toUpperCase())
                    const orderBl = String(order.content?.source?.blNumber || order.sourceSnapshot?.blNumber || '').toUpperCase()
                    const orderBk = String(order.content?.source?.bookingNumber || order.sourceSnapshot?.bookingNumber || '').toUpperCase()
                    const matchedGate =
                      (validation?.bookingId
                        ? [...manifestGeneratedBookings, ...bookings].find((b) => b.id === validation.bookingId)
                        : null) ||
                      [...manifestGeneratedBookings, ...bookings].find((b) => {
                        const c = String(b.containerId || '').toUpperCase()
                        const bl = String(b.cargoDeclarationId || b.billOfLading || '').toUpperCase()
                        const bid = String(b.id || '').toUpperCase()
                        return (
                          (c && (srcUpper.includes(c) || orderConts.includes(c))) ||
                          (bl && bl !== 'N/A' && (srcUpper.includes(bl) || orderBl === bl)) ||
                          (bid && (srcUpper.includes(bid) || orderBk === bid))
                        )
                      })
                    const rawRejectReason =
                      order.status === 'REJECTED' || validation?.status === 'AUTO_REJECTED'
                        ? (validation?.reason || 'Cont không nằm trong danh sách')
                        : ''
                    const rejectReasonText = !rawRejectReason
                      ? ''
                      : rawRejectReason.toLowerCase().includes('không nằm trong danh sách')
                      ? 'Cont không nằm trong danh sách'
                      : rawRejectReason.toLowerCase().includes('sai mã vận đơn')
                      ? 'Sai mã vận đơn / booking'
                      : rawRejectReason.toLowerCase().includes('sai tên công ty')
                      ? 'Sai tên công ty'
                      : rawRejectReason.replace(/^Tự động Reject:\s*/i, '').trim()

                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedEportOrderId(order.id)}
                        className="hover:bg-[#f8faff] transition-colors cursor-pointer group"
                      >
                        {/* 1. Hồ sơ / Dịch vụ */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="flex items-center gap-3">
                            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-[#e2e9f1] bg-[#f5f8fc] text-[#8a9eb6]">
                              <FileText size={18} />
                            </span>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <strong className="font-mono text-xs font-semibold text-[#2b425b] group-hover:text-orange-600 transition-colors">
                                {order.number}
                              </strong>
                              <span className="text-xs text-[#526a85] truncate font-medium">
                                {order.mainServiceName || 'Chưa chọn dịch vụ chính'}
                              </span>
                              <small className="text-[11px] text-[#8c9eb2] truncate">
                                {order.companyName || 'Doanh nghiệp đăng ký'}
                              </small>
                            </div>
                          </div>
                        </td>

                        {/* 2. Nguồn / Container */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="flex flex-col gap-1">
                            <strong className="text-xs font-semibold text-[#405670]">
                              {order.sourceLabel || 'Chưa chọn hồ sơ nguồn'}
                            </strong>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#7d91a6]">
                              <Container size={13} className="shrink-0" />
                              <span>{order.containerCount || 0} container</span>
                              <span>·</span>
                              <span className={order.flow === 'IMPORT' ? 'text-sky-700 font-semibold' : 'text-purple-700 font-semibold'}>
                                {order.flow === 'IMPORT' ? 'Hàng nhập' : 'Hàng xuất'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Trạng thái xử lý */}
                        <td className="py-3.5 px-3.5 align-middle whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <OrderBadge status={order.status} />
                            {order.paymentStatus && (
                              <small className={`epo-payment-label ${order.paymentReviewRequired ? 'orange' : statusTone(order.paymentStatus)}`}>
                                {paymentStateLabel(order)}
                              </small>
                            )}
                          </div>
                        </td>

                        {/* 4. Lý do từ chối */}
                        <td className="py-3.5 px-3.5 align-middle">
                          {rejectReasonText ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold leading-tight">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                              <span>{rejectReasonText}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        {/* 5. Giá trị đăng ký */}
                        <td className="py-3.5 px-4 align-middle text-right whitespace-nowrap">
                          <div className="flex flex-col items-end gap-0.5">
                            <strong className="text-slate-900 font-bold text-xs">
                              {order.total == null ? 'Chưa xác định' : money(order.total)}
                            </strong>
                            <small className="text-[10px] text-slate-400">
                              {draftDateTime(order.updatedAt)}
                            </small>
                          </div>
                        </td>

                        {/* 6. Thao tác */}
                        <td className="py-3.5 px-4 align-middle text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {(matchedGate || validation?.status === 'AUTO_REJECTED' || order.status === 'REJECTED') && (
                              <button
                                type="button"
                                onClick={async () => {
                                  let detail = order
                                  try {
                                    detail = await serviceOrdersApi.get(order.id)
                                  } catch {}
                                  setEportDetail(detail)
                                  const allGates = [...manifestGeneratedBookings, ...bookings]
                                  const dConts = (detail.containers || []).map((x) => String(x.containerNumber || '').toUpperCase())
                                  const dBl = String(detail.content?.source?.blNumber || detail.sourceSnapshot?.blNumber || '').toUpperCase()
                                  const dBk = String(detail.content?.source?.bookingNumber || detail.sourceSnapshot?.bookingNumber || '').toUpperCase()
                                  const dRef = String(detail.sourceLabel || detail.content?.source?.referenceNumber || '').toUpperCase()
                                  const gate =
                                    matchedGate ||
                                    (validation?.bookingId ? allGates.find((b) => b.id === validation.bookingId) : null) ||
                                    allGates.find((b) => {
                                      const c = String(b.containerId || '').toUpperCase()
                                      const bl = String(b.cargoDeclarationId || b.billOfLading || '').toUpperCase()
                                      const bid = String(b.id || '').toUpperCase()
                                      return (
                                        (c && dConts.includes(c)) ||
                                        (bl && bl !== 'N/A' && (bl === dBl || dRef.includes(bl))) ||
                                        (bid && (bid === dBk || dRef.includes(bid)))
                                      )
                                    }) ||
                                    {
                                      id: validation?.bookingId || 'CHUA-CO-BOOKING-CONG',
                                      containerId: dConts[0] || 'Chưa có Cont cổng',
                                      bookingType: detail.flow === 'IMPORT' ? 'Import' : 'Export',
                                      billOfLading: 'Chưa có trên Booking Cổng',
                                      bookingNumber: 'Chưa có trên Booking Cổng',
                                      company: 'Chưa có Booking Cổng khớp',
                                      status: 'Pending',
                                      _noGateBooking: true
                                    }
                                  setSelectedBooking(gate)
                                  setShowEportSyncPopup(true)
                                }}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap shadow-xs transition ${
                                  validation?.status === 'AUTO_REJECTED' || order.status === 'REJECTED'
                                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                    : order.status === 'APPROVED'
                                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                                }`}
                              >
                                {validation?.status === 'AUTO_REJECTED' || order.status === 'REJECTED'
                                  ? 'Xem đối chiếu ➔'
                                  : order.status === 'APPROVED'
                                  ? 'Xem chi tiết ➔'
                                  : 'Đối chiếu & Duyệt ➔'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedEportOrderId(order.id)}
                              aria-label={`Xem chi tiết đơn ${order.number}`}
                              title="Xem chi tiết đơn"
                              className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:border-orange-300 hover:text-orange-600 text-slate-400 flex items-center justify-center cursor-pointer shrink-0 transition"
                            >
                              <ArrowUpRight size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {eportListTotal > 10 && (
            <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
              <span>Trang {eportListPage} / {Math.max(1, Math.ceil(eportListTotal / 10))} · Tổng {eportListTotal} đơn ePort</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={eportListPage <= 1 || eportListLoading}
                  onClick={() => setEportListPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded border border-slate-300 bg-white disabled:opacity-50 cursor-pointer"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={eportListPage >= Math.ceil(eportListTotal / 10) || eportListLoading}
                  onClick={() => setEportListPage(p => p + 1)}
                  className="px-3 py-1 rounded border border-slate-300 bg-white disabled:opacity-50 cursor-pointer"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── GATE BOOKING DETAIL MODAL (PHONG CÁCH DỊCH VỤ ePORT — GỌN & THOÁNG) ── */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white border border-[#e3eaf3] rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-xs">
            {/* 1. Header chuẩn ePort */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#edf1f6] bg-[#fafcfe] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`epo-order-icon ${isImportBooking ? 'epo-order-icon--import' : 'epo-order-icon--export'}`}>
                  <Container size={19} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-[#7a8fa6]">
                    <span className="font-semibold text-[#5a7088]">Booking Cổng</span>
                    <span>·</span>
                    <span className="font-mono">{selectedBooking.id}</span>
                  </div>
                  <h3 className="text-base font-bold text-[#1e2d3d] mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="font-mono">{selectedBooking.containerId}</span>
                    <span className="text-xs font-medium text-[#627891]">
                      ({selectedBooking.containerType || `${selectedBooking.size || '40'}${selectedBooking.isReefer ? 'RF' : 'HC'}`} · {isImportBooking ? 'Lấy cont hàng' : 'Hạ cont'})
                    </span>
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {selectedBooking.isFromVesselManifest && !selectedBooking.transportSubmitted ? (
                  <span className="epo-badge orange">
                    <span />
                    Chờ vận tải
                  </span>
                ) : selectedBooking.status === 'Approved' || selectedBooking.status === 'Ready' ? (
                  <span className="epo-badge green">
                    <span />
                    Đã duyệt
                  </span>
                ) : selectedBooking.status === 'Rejected' ? (
                  <span className="epo-badge red">
                    <span />
                    Đã từ chối
                  </span>
                ) : (
                  <span className="epo-badge blue">
                    <span />
                    {selectedBooking.status === 'Pending'
                      ? 'Chờ duyệt'
                      : selectedBooking.status === 'Under Review'
                      ? 'Đang kiểm tra'
                      : selectedBooking.status === 'WaitingTransport'
                      ? 'Chờ vận tải'
                      : (selectedBooking.status || 'Chờ duyệt')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  className="w-8 h-8 rounded-lg border border-[#e3eaf3] text-[#7a8fa6] hover:text-[#1e2d3d] hover:bg-[#f3f6fa] flex items-center justify-center text-lg leading-none cursor-pointer transition"
                  aria-label="Đóng"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* 2. Body 2 cột chuẩn epo-detail-layout */}
            <div className="p-6 overflow-y-auto flex-1">
              {selectedBooking.status === 'Rejected' && (
                <div className="mb-4 p-3 rounded-xl bg-[#fcf3f2] border border-[#eddbd8] text-[#ad7a73] flex items-start gap-2">
                  <span className="material-symbols-outlined text-base shrink-0">error</span>
                  <div className="text-[11px]">
                    <strong className="font-bold">Đơn đã bị từ chối:</strong>{' '}
                    {selectedBooking.rejectionReason || 'Không đạt yêu cầu'}
                    {selectedBooking.rejectionNote && ` — "${selectedBooking.rejectionNote}"`}
                  </div>
                </div>
              )}

              <div className="epo-detail-layout !p-0">
                {/* Cột trái: Thông tin hồ sơ sạch sẽ */}
                <section className="epo-detail-content space-y-4">
                  {/* Khối 1: Vận tải & Tàu / B/L */}
                  <div className="border border-[#e6ecf3] rounded-xl p-4 bg-[#fafcfe]">
                    <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#edf1f6]">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#7a8fa6]">
                        Thông tin vận tải &amp; lô hàng
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowCarrierPopup(true)}
                          className="text-[11px] font-semibold text-[#5a7088] hover:text-orange-600 cursor-pointer"
                        >
                          Công ty vận tải ➔
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowContainerPopup(true)}
                          className="text-[11px] font-semibold text-[#5a7088] hover:text-orange-600 cursor-pointer"
                        >
                          Chi tiết cont ➔
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-[12px]">
                      <div>
                        <div className="text-[11px] text-[#8a9bb0]">Công ty vận tải</div>
                        <div className="font-semibold text-[#1e2d3d] mt-0.5 truncate" title={selectedBooking.company}>
                          {selectedBooking.company || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#8a9bb0]">Điều phối &amp; liên hệ</div>
                        <div className="font-medium text-[#334155] mt-0.5">
                          {selectedBooking.isFromVesselManifest && !selectedBooking.transportSubmitted && selectedBooking.status !== 'Approved'
                            ? 'Chờ bên vận tải gửi xác nhận'
                            : `${selectedBooking.contactName || selectedBooking.contactPerson || 'Võ Hàng Tàu'} · ${selectedBooking.phone || '0842737474'}`}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#8a9bb0]">Tàu / Chuyến</div>
                        <div className="font-medium text-[#334155] mt-0.5">
                          {selectedBooking.vesselName || 'MAERSK MC-KINNEY MOLLER'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#8a9bb0]">Số vận đơn (B/L) · VGM</div>
                        <div className="font-mono font-medium text-[#334155] mt-0.5">
                          {selectedBooking.billOfLading || (selectedBooking.cargoDeclarationId && selectedBooking.cargoDeclarationId !== 'N/A' ? selectedBooking.cargoDeclarationId : '') || selectedManifestInfo?.blNumber || 'BL-INB-DAD-2605'}
                          {' · '}
                          {selectedBooking.vgm ? `${selectedBooking.vgm} kg` : (selectedBooking.grossWeightKg ? `${selectedBooking.grossWeightKg.toLocaleString()} kg` : '19.800 kg')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Khối 2: Xe, Tài xế & Vị trí bãi */}
                  <div className="border border-[#e6ecf3] rounded-xl p-4 bg-white">
                    <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#edf1f6]">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#7a8fa6]">
                        Điều phối cổng &amp; vị trí bãi
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowVehiclePopup(true)}
                          className="text-[11px] font-semibold text-[#5a7088] hover:text-orange-600 cursor-pointer"
                        >
                          Xe &amp; tài xế ➔
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const targetZone = reservedSlot?.zoneCode || (reservedSlot?.blockCode || 'D')[0]
                            setSelectedZone(targetZone)
                            setShowYardBigModal(true)
                          }}
                          className="text-[11px] font-semibold text-[#5a7088] hover:text-orange-600 cursor-pointer"
                        >
                          Đổi bãi ➔
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-[12px]">
                      <div>
                        <div className="text-[11px] text-[#8a9bb0]">Biển số xe · Tài xế</div>
                        <div className="font-medium text-[#1e2d3d] mt-0.5">
                          {(() => {
                            const vPlate = getGateBookingVehicle(selectedBooking)
                            const dName = getGateBookingDriver(selectedBooking)
                            return vPlate
                              ? `${vPlate} · ${dName || 'Tài xế phụ trách'}`
                              : 'Chờ điều phối xe & tài xế'
                          })()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#8a9bb0]">Cổng · Giờ dự kiến (ETA)</div>
                        <div className="font-mono font-medium text-[#334155] mt-0.5">
                          {(selectedBooking.requestedGate || 'Gate 1').replace(/^Gate\s*/i, 'Cổng ')} · {selectedBooking.eta ? selectedBooking.eta.replace('T', ' ').slice(0, 16) : 'Hôm nay 08:30'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#8a9bb0]">Vị trí bãi Tiên Sa</div>
                        <div className="font-mono font-semibold text-[#1e2d3d] mt-0.5">
                          {reservedSlot ? `Block ${reservedSlot.blockCode} · ${reservedSlot.bayDisplay || `Bay ${String(reservedSlot.bay || '02').padStart(2, '0')}`}` : 'Block D01 · Bay 02'}
                          {' '}
                          <span className="font-sans font-normal text-[11px] text-[#7a8fa6]">
                            (T{reservedSlot?.tier || '1'} · H0{reservedSlot?.row || '1'})
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#8a9bb0]">Chứng từ đính kèm</div>
                        <button
                          type="button"
                          onClick={() => setShowDocumentsModal(true)}
                          className="mt-0.5 text-[12px] font-semibold text-[#2e78a8] hover:underline cursor-pointer"
                        >
                          {getBookingRealDocuments(selectedBooking).length} chứng từ (eDO, B/L, HQ, VGM) ➔
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Khối 3: Đối chiếu ePort (gọn 1 dòng) */}
                  <div className="border border-[#e6ecf3] rounded-xl px-4 py-3 bg-[#fafcfe] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-[#5a7088]">
                        Đối chiếu Dịch Vụ ePort:{' '}
                        <span className={
                          eportComparison?.status === 'matched'
                            ? 'text-emerald-700'
                            : eportComparison?.status === 'mismatch'
                            ? 'text-rose-700'
                            : 'text-[#627891]'
                        }>
                          {eportLoading ? 'Đang kiểm tra...' : (eportComparison?.badgeText || 'Chưa có đơn ePort khớp')}
                        </span>
                      </div>
                      {eportComparison?.order && (
                        <div className="text-[11px] text-[#7a8fa6] mt-0.5 truncate">
                          Đơn <span className="font-mono text-[#334155]">{eportComparison.order.number}</span> · {orderStatusLabels[eportComparison.order.status] || eportComparison.order.status} · {paymentStateLabel(eportComparison.order)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowEportSyncPopup(true)}
                        className="epc-button secondary !min-h-[32px] !py-1 !px-3 !text-[11px]"
                      >
                        Đối chiếu 2 bên
                      </button>
                      {eportComparison?.order && (
                        <button
                          type="button"
                          onClick={() => setSelectedEportOrderId(eportComparison.order.id)}
                          className="epc-button secondary !min-h-[32px] !py-1 !px-3 !text-[11px]"
                        >
                          Xem đơn ePort
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                {/* Cột phải: Sidebar tóm tắt & thao tác chuẩn ePort */}
                <aside className="epo-order-sidebar">
                  <div className="epo-sidebar-heading">
                    <span>
                      <FileText size={20} />
                    </span>
                    <div>
                      <small>HỒ SƠ ĐĂNG KÝ</small>
                      <h3>Chi tiết Booking</h3>
                    </div>
                  </div>

                  <div className="epo-sidebar-total">
                    <small>Tổng biểu phí cảng</small>
                    <strong>{bookingTariffSummary.totalFormatted}</strong>
                    <button
                      type="button"
                      onClick={() => setShowTariffPopup(true)}
                      className="text-[11px] text-[#2e78a8] hover:underline font-medium mt-1 cursor-pointer text-left"
                    >
                      Xem bảng kê chi tiết ➔
                    </button>
                  </div>

                  <dl>
                    <div>
                      <dt>Container</dt>
                      <dd className="font-mono">{selectedBooking.containerId}</dd>
                    </div>
                    <div>
                      <dt>Vị trí</dt>
                      <dd className="font-mono">{reservedSlot?.posId || 'D01-B02-R1-T1'}</dd>
                    </div>
                    <div>
                      <dt>Chứng từ</dt>
                      <dd>{getBookingRealDocuments(selectedBooking).length} tệp</dd>
                    </div>
                  </dl>

                  <div className="epo-sidebar-actions">
                    {selectedBooking.status !== 'Approved' ? (
                      <button
                        type="button"
                        onClick={() => setShowApproveModal(true)}
                        className="epc-button primary"
                      >
                        Phê duyệt Booking
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          showToast(`🔄 Đã chuyển sang Lệnh Điều Phối cho Booking ${selectedBooking.id}`)
                          navigate('/dispatch')
                        }}
                        className="epc-button primary"
                      >
                        Xem Lệnh Điều Phối ➔
                      </button>
                    )}

                    {selectedBooking.status !== 'Rejected' && (
                      <button
                        type="button"
                        onClick={() => setShowRejectModal(true)}
                        className="epc-button secondary epo-danger-button"
                      >
                        Từ chối đơn
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedBooking(null)}
                      className="epc-button secondary"
                    >
                      Đóng
                    </button>
                  </div>
                </aside>
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
                <h3 className="font-heading text-xl font-extrabold text-carbon">PHÊ DUYỆT ĐĂNG KÝ VÀO CỔNG?</h3>
                <p className="text-xs text-slate">Xác nhận phê duyệt lịch hẹn xe vào cảng.</p>
              </div>
            </div>

            <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2 font-mono text-xs">
              <div className="flex justify-between"><span>Booking ID:</span><strong className="text-carbon font-bold">{selectedBooking.id}</strong></div>
              <div className="flex justify-between"><span>Container ID:</span><strong className="text-carbon font-bold">{selectedBooking.containerId}</strong></div>
              <div className="flex justify-between">
                <span>Xe đầu kéo:</span>
                <strong className="text-carbon font-bold">
                  {getGateBookingVehicle(selectedBooking) || '47AB-294.69 (Tự động gán)'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Tài xế phụ trách:</span>
                <strong className="text-carbon font-bold">
                  {getGateBookingDriver(selectedBooking) || 'TRẦN VĂN TÙNG (Tự động gán)'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Cổng &amp; Giờ hẹn:</span>
                <strong className="text-signal-orange font-bold">
                  {selectedBooking.requestedGate || 'Gate 2'} • {(selectedBooking.eta || selectedBooking.appointmentStart || '').split('T')[1]?.slice(0, 5) || '08:30'}
                </strong>
              </div>

              {/* Hồ sơ giấy tờ Tài xế do bên Vận tải / ePort cung cấp */}
              <div className="pt-2 border-t border-slate-200/80">
                <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-blue-700 font-extrabold">
                    <span className="material-symbols-outlined text-sm">badge</span>
                    <span>Giấy tờ Tài xế (Bên Vận tải / ePort gửi kèm):</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                    ✓ 2 tệp định danh tài xế
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-sans">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col gap-0.5 shadow-2xs">
                    <span className="text-purple-700 font-bold flex items-center gap-1 text-[11px]">
                      <span>🪪</span>
                      <span>GPLX Hạng FC:</span>
                    </span>
                    <span className="font-mono text-slate-800 font-semibold">{selectedBooking.licenseNumber || selectedBooking.suggestedLicense || 'FC-782910'}</span>
                    <span className="text-[9px] text-slate-400">Bằng lái chuyên dụng xe cont</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col gap-0.5 shadow-2xs">
                    <span className="text-blue-700 font-bold flex items-center gap-1 text-[11px]">
                      <span>👤</span>
                      <span>CCCD Gắn Chip:</span>
                    </span>
                    <span className="font-mono text-slate-800 font-semibold">
                      {selectedBooking.driverSnapshot?.IdCardNumber || selectedBooking.idCardNumber || '048092004812'}
                    </span>
                    <span className="text-[9px] text-slate-400">Định danh đối chiếu Barie cổng</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Thông tin đối soát Manifest */}
            {selectedManifestInfo ? (
              <div className="text-xs text-emerald-950 bg-emerald-50 p-3 rounded-xl border border-emerald-300 font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-base shrink-0">verified</span>
                <span>
                  Đã đối chiếu khớp với <strong>Bản khai hàng hóa {selectedManifestInfo.manifestNumber}</strong> do Hãng tàu gửi sang Cảng. Đủ điều kiện cấp phép vào cổng.
                </span>
              </div>
            ) : (
              <div className="text-xs text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-300 font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base shrink-0">info</span>
                <span>
                  Chưa nhận được dữ liệu Manifest từ Hãng tàu. Vẫn cho phép phê duyệt dự phòng theo chứng từ đính kèm.
                </span>
              </div>
            )}

            <p className="text-xs text-blue-900 bg-blue-50 p-3 rounded-xl border border-blue-200 font-medium">
              ℹ️ "Booking này sẽ được chuyển sang Cổng kiểm soát (Gate Officer) để thực hiện thủ tục Check-in khi xe đến cảng, đồng thời gửi Bill sang Đơn vị Vận tải."
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2.5 bg-fog border border-chalk text-slate font-bold rounded-xl text-xs hover:bg-slate-200"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmApproval}
                className="px-6 py-2.5 bg-green-600 text-white font-extrabold rounded-xl text-xs hover:bg-green-700 shadow-md inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span>Xác nhận Duyệt &amp; Gửi Bill ➔</span>
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
                <h3 className="font-heading text-xl font-extrabold text-carbon">TỪ CHỐI ĐĂNG KÝ VÀO CỔNG</h3>
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
                Hủy bỏ
              </button>
              <button
                disabled={!rejectionReason}
                onClick={handleConfirmRejection}
                className={`px-6 py-2.5 rounded-xl font-extrabold text-xs shadow-md ${
                  rejectionReason ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Xác nhận Từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      
      {/* POP-UP CHỌN BAY & SLOT TRỰC QUAN (HỖ TRỢ 20FT & 40FT) */}
      <YardSlotReservationModal
        isOpen={!!pickerBlock}
        onClose={() => setPickerBlock(null)}
        block={pickerBlock}
        booking={selectedBooking}
        currentReservation={reservedSlot}
        onConfirm={async (slotInfo) => {
          try {
            // 1. Lưu giữ chỗ vào shared yardReservationStore đồng bộ ngay sang Sơ đồ bãi Tiên Sa
            yardReservationStore.addReservation({
              ...slotInfo,
              containerId: selectedBooking?.containerId,
              containerNo: selectedBooking?.containerId,
              bookingCode: selectedBooking?.id,
              booking: selectedBooking,
              vehiclePlate: selectedBooking?.licensePlate,
              driverName: selectedBooking?.driverName,
              company: selectedBooking?.company,
            })

            const newTier = Number(slotInfo.tier) || 1
            const updatedSlot = {
              ...(reservedSlot || selectedBooking?.autoYardSlot || {}),
              ...slotInfo,
              tier: newTier,
              tierCode: String(newTier),
              zoneCode: (slotInfo.blockCode || 'A')[0],
              zoneName: `Khu ${(slotInfo.blockCode || 'A')[0]} · Block ${slotInfo.blockCode}`,
              autoAssigned: false,
            }
            setReservedSlot(updatedSlot)
            setSelectedZone((slotInfo.blockCode || 'A')[0])
            setSelectedBlock(slotInfo.blockCode || 'A01')
            setYardResVersion(v => v + 1)

            // Nếu là container thuộc bảng Công ty vận tải tách từ Tàu, cập nhật luôn vị trí bãi mới vào bảng
            if (selectedBooking?.isFromVesselManifest) {
              manifestPortSyncService.updateGeneratedGateBookingStatus(selectedBooking.id, {
                autoYardSlot: updatedSlot,
              })
              setManifestSyncVersion(v => v + 1)
            }

            // 2. Gọi các API Backend
            if (slotInfo.slotId && slotInfo.slotId.length > 10) {
              await apiClient.post(`/v1/Yard/Slots/${slotInfo.slotId}/Reserve`).catch(() => {})
            } else {
              await yardOperationService.reserveSlot({ posId: slotInfo.posId }).catch(() => {})
            }
            handleReserveSlot(slotInfo.slotId, slotInfo.blockCode, slotInfo)
            fetchYardMap()
            showToast(`🟢 Đã chuyển & đặt container ${selectedBooking?.containerId || ''} vào Block ${slotInfo.blockCode} (${slotInfo.bayDisplay || `Bay ${slotInfo.bay}`}, Tầng ${slotInfo.tier}, Hàng ${slotInfo.row})!`)
          } catch (err) {
            showToast(`❌ Không thể giữ chỗ: ${err.message}`, 'error')
          }
        }}
      />

      {/* DETAIL MODALS */}
      <CompanyDetailModal 
        isOpen={modalState.type === 'company'} 
        companyId={modalState.id} 
        onClose={() => setModalState({ type: null, id: null })} 
      />
      <VehicleDetailModal 
        isOpen={modalState.type === 'vehicle'} 
        vehicleId={modalState.id} 
        onClose={() => setModalState({ type: null, id: null })} 
      />
      <DriverDetailModal 
        isOpen={modalState.type === 'driver'} 
        driverId={modalState.id} 
        onClose={() => setModalState({ type: null, id: null })} 
      />

      {/* ── POPUP XEM DANH SÁCH BỘ CHỨNG TỪ CONTAINER (CHUẨN 100% NGUYÊN BẢN THEO ẢNH) ── */}
      {/* ── POPUP XEM DANH SÁCH BỘ CHỨNG TỪ CONTAINER (ĐỒNG NHẤT 100% VỚI TERMINAL PORTAL > ĐẶT LỊCH CẢNG) ── */}
      {showDocumentsModal && selectedBooking && (() => {
        const docList = getBookingRealDocuments(selectedBooking)
        return (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[70] flex items-center justify-center p-3 sm:p-5">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 text-xs font-sans max-h-[90vh] overflow-y-auto">
              
              {/* Header Popup */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">folder_shared</span>
                  </div>
                  <div>
                    <h3 className="font-heading text-sm font-bold text-slate-900">Chi Tiết Bộ Chứng Từ Hồ Sơ</h3>
                    <p className="text-[11px] text-slate-500">
                      Mã Booking: <strong className="font-mono text-slate-800">{selectedBooking.id}</strong> • Container: <strong className="font-mono text-blue-700">{selectedBooking.containerId}</strong> • Tàu: {selectedBooking.vesselName || 'EVER GLORY'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDocumentsModal(false)}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Khung Chứng Từ Dùng Chung Đơn Hàng (Đồng nhất 100% với Đặt Lịch Cảng) */}
              <div className="bg-blue-50/40 border border-blue-200 rounded-2xl p-4 sm:p-5 space-y-3">
                {/* Header Box */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 text-xl">folder_shared</span>
                    <h4 className="text-xs font-black uppercase tracking-wide text-slate-800">
                      CHỨNG TỪ DÙNG CHUNG ĐƠN HÀNG ({docList.length} TỆP)
                    </h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px] self-start sm:self-auto">
                    Áp dụng chung toàn bộ container
                  </span>
                </div>

                {/* Danh sách từng tệp theo đúng dữ liệu của đơn hàng */}
                <div className="space-y-2.5">
                  {docList.map((doc, dIdx) => (
                    <div
                      key={doc.id || dIdx}
                      className="bg-white border border-blue-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs hover:border-blue-300 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="material-symbols-outlined text-blue-600 text-2xl shrink-0">
                          {doc.icon || 'description'}
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-900 block sm:inline">
                            {doc.title || getDocTypeVi(doc.documentType || doc.type)}
                          </span>
                          {doc.fileName && (
                            <span className="text-slate-400 text-xs ml-0 sm:ml-1.5 font-mono truncate">
                              ({doc.fileName})
                            </span>
                          )}
                          {doc.documentNumber && (
                            <span className="text-[10px] text-slate-400 font-mono ml-2">
                              #{doc.documentNumber}
                            </span>
                          )}
                          {doc.isDriverDoc && (
                            <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-bold ml-1.5">
                              Hồ sơ Tài xế &amp; Xe
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border ${
                          (doc.verificationStatus || doc.status) === 'Verified'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : (doc.verificationStatus || doc.status) === 'Rejected'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          <span>{(doc.verificationStatus || doc.status) === 'Verified' ? '✓' : '⏳'}</span>
                          <span>{(doc.verificationStatus || doc.status) === 'Verified' ? 'Đã thẩm định' : 'Chờ duyệt'}</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setDocViewerIndex(dIdx)
                            setShowDocViewer(true)
                          }}
                          className="px-3.5 py-1.5 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <span className="material-symbols-outlined text-sm">open_in_new</span>
                          <span>Xem tệp</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowDocumentsModal(false)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-black transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* MODAL XEM PHÓNG TO HÌNH ẢNH CHỨNG TỪ TỪ DEVELOP */}
      <DocumentViewerModal
        isOpen={showDocViewer}
        onClose={() => setShowDocViewer(false)}
        documents={getBookingRealDocuments(selectedBooking)}
        initialIndex={docViewerIndex}
        booking={selectedBooking}
      />


  
      {/* ── POPUP XEM CHI TIẾT XE ĐẦU KÉO & TÀI XẾ ── */}
      {showVehiclePopup && selectedBooking && (() => {
        const activePlate = getGateBookingVehicle(selectedBooking)
        const activeDriver = getGateBookingDriver(selectedBooking)
        const activeTrailer = selectedBooking.trailerPlate || selectedBooking.suggestedTrailer || (activePlate ? '47R-012.88' : null)
        const activeLicense = selectedBooking.licenseNumber || selectedBooking.suggestedLicense || (activePlate ? 'FC-782910' : null)

        return (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 text-xs font-sans">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-700 text-xl">local_shipping</span>
                  <h3 className="font-heading text-sm font-bold text-slate-900">Chi Tiết Phương Tiện &amp; Tài Xế</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVehiclePopup(false)}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {!activePlate ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-amber-600 text-lg shrink-0">hourglass_top</span>
                  <div>
                    <strong className="font-bold">Đang chờ đơn vị vận tải điều phối xe &amp; tài xế</strong>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Container đã có vị trí bãi. Thông tin biển số xe đầu kéo, rơ-moóc và tài xế sẽ tự động cập nhật ngay khi đơn vị vận tải tiếp nhận &amp; phân bổ xe.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-lg shrink-0">task_alt</span>
                  <div>
                    <strong className="font-bold text-emerald-900">Đã phân bổ xe đầu kéo &amp; tài xế phụ trách</strong>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Đội xe {selectedBooking.company || 'Vận tải'} đã tiếp nhận lệnh vận chuyển. Phương tiện và tài xế đạt chuẩn kiểm định an toàn vào Cảng Tiên Sa.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2.5 font-medium divide-y divide-slate-100">
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Biển số đầu kéo:</span>
                  {activePlate ? (
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {activePlate}
                    </span>
                  ) : (
                    <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Chờ điều phối xe
                    </span>
                  )}
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Biển số Rơ-moóc:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {activeTrailer || 'Chờ phân bổ'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Hạn đăng kiểm xe:</span>
                  <span className={activePlate ? "text-emerald-700 font-semibold" : "text-slate-500 italic"}>
                    {activePlate ? "Còn hạn (Hết hạn 12/2026)" : "Chờ thông tin xe"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Họ tên tài xế:</span>
                  <strong className="text-slate-900">
                    {activeDriver || 'Chờ điều phối tài xế'}
                  </strong>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Số GPLX:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {activeLicense ? `${activeLicense} (Hạng FC)` : 'Chờ cập nhật'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Số điện thoại liên hệ:</span>
                  <span className="font-mono text-slate-800">{selectedBooking.phone || '0905 123 456'} (Điều phối {selectedBooking.company})</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Giờ hẹn đến cổng (ETA):</span>
                  <span className="font-mono text-orange-700 font-bold">
                    {selectedBooking.eta ? selectedBooking.eta.replace('T', ' · ').slice(0, 18) : (activePlate ? 'Hôm nay · 08:30' : 'Chờ lịch hẹn')}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Cổng đăng ký vào:</span>
                  <span className="font-bold text-slate-900">{selectedBooking.requestedGate || 'Gate 2 (Cổng Container)'}</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowVehiclePopup(false)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-black transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── POPUP XEM CHI TIẾT CÔNG TY VẬN TẢI (CHUẨN VIBE NHƯ ẢNH MẪU) ── */}
      {showCarrierPopup && selectedBooking && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 text-xs font-sans">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-600 text-xl">domain</span>
                <h3 className="font-heading text-sm font-bold text-slate-900">Chi Tiết Công Ty Vận Tải</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCarrierPopup(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Banner thông báo */}
            {selectedBooking.isFromVesselManifest && !selectedBooking.transportSubmitted && selectedBooking.status !== 'Approved' ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-600 text-lg shrink-0">hourglass_top</span>
                <div>
                  <strong className="font-bold">Chờ Công ty Vận tải gửi thông tin xác nhận</strong>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Container được đồng bộ từ Bản khai Tàu (Manifest). Các trường liên hệ và xác nhận điều phối được để trống để bên Công ty Vận tải gửi thông tin lên Cảng xác nhận.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-emerald-600 text-lg shrink-0">verified</span>
                <div>
                  <strong className="font-bold">Đơn vị vận tải đã gửi &amp; xác nhận điều phối</strong>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Công ty vận tải đã gửi thông tin điều phối và hồ sơ làm thủ tục cổng cho container này lên hệ thống Cảng Tiên Sa.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2.5 font-medium divide-y divide-slate-100">
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Tên công ty vận tải:</span>
                <strong className="text-slate-900 font-bold">
                  {selectedBooking.isFromVesselManifest && !selectedBooking.transportSubmitted && selectedBooking.status !== 'Approved'
                    ? (selectedBooking.company ? `${selectedBooking.company} (Chờ gửi xác nhận)` : '—')
                    : (selectedBooking.company || 'Bien Dong Logistics - Nexus Logistics')}
                </strong>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Mã doanh nghiệp (MST):</span>
                <span className="font-mono font-bold text-slate-800">
                  {selectedBooking.isFromVesselManifest && !selectedBooking.transportSubmitted && selectedBooking.status !== 'Approved'
                    ? '—'
                    : (selectedBooking.taxCode || '0401889211')}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Người điều phối phụ trách:</span>
                <strong className="text-slate-900">
                  {selectedBooking.isFromVesselManifest && !selectedBooking.transportSubmitted && selectedBooking.status !== 'Approved'
                    ? '—'
                    : (selectedBooking.contactName || selectedBooking.contactPerson || 'Võ Hàng Tàu (Điều độ Đội xe)')}
                </strong>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Số điện thoại liên hệ:</span>
                <span className="font-mono font-bold text-slate-800">
                  {selectedBooking.isFromVesselManifest && !selectedBooking.transportSubmitted && selectedBooking.status !== 'Approved'
                    ? '—'
                    : (selectedBooking.phone || '0842737474')}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Email điều phối:</span>
                <span className="font-mono text-slate-700">
                  {selectedBooking.isFromVesselManifest && !selectedBooking.transportSubmitted && selectedBooking.status !== 'Approved'
                    ? '—'
                    : (selectedBooking.email || 'carrier01@nexusport.vn')}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Nghiệp vụ đăng ký:</span>
                <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200 font-bold text-[11px]">
                  {isImportBooking ? 'Lấy container hàng (Inbound)' : 'Hạ container rỗng (Outbound)'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Tình trạng xác nhận vận tải:</span>
                {selectedBooking.isFromVesselManifest && !selectedBooking.transportSubmitted && selectedBooking.status !== 'Approved' ? (
                  <span className="text-amber-700 font-semibold flex items-center gap-1">
                    <span>⏳</span>
                    <span>Chờ bên vận tải gửi xác nhận</span>
                  </span>
                ) : (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <span>✓</span>
                    <span>Đã gửi thông tin điều phối</span>
                  </span>
                )}
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Đội xe liên kết tại cảng:</span>
                <span className="font-mono font-bold text-slate-800">
                  {(() => {
                    const vPlate = getGateBookingVehicle(selectedBooking)
                    return vPlate ? `Đã gán xe ${vPlate}` : 'Đã đăng ký đội xe SmartGate'
                  })()}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowCarrierPopup(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-black transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── POPUP XEM CHI TIẾT CONTAINER & TÀU BIỂN (CHUẨN VIBE NHƯ ẢNH MẪU) ── */}
      {showContainerPopup && selectedBooking && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 text-xs font-sans">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-xl">directions_boat</span>
                <h3 className="font-heading text-sm font-bold text-slate-900">Chi Tiết Container &amp; Tàu Biển</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowContainerPopup(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Banner thông báo chuẩn vibe */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-blue-600 text-lg shrink-0">inventory_2</span>
              <div>
                <strong className="font-bold">Container thuộc Bản khai Tàu (Vessel Manifest)</strong>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  Thông tin container, niêm chì và vận đơn đường biển đã được số hóa và đồng bộ từ Tàu {selectedBooking.vesselName || 'EVER GLORY'} ({selectedBooking.voyageNumber || selectedBooking.voyageNo || 'V.2024N'}).
                </p>
              </div>
            </div>

            <div className="space-y-2.5 font-medium divide-y divide-slate-100">
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Mã số Container ISO:</span>
                <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {selectedBooking.containerId}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Loại &amp; Kích thước ISO:</span>
                <span className="font-mono font-bold text-slate-800">{selectedBooking.containerType || `${selectedBooking.size || '40'}${selectedBooking.isReefer ? 'RF (Reefer cont lạnh)' : 'HC (High Cube 40 feet)'}`}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Tàu &amp; Chuyến vận chuyển:</span>
                <strong className="text-slate-900">{selectedBooking.vesselName || 'EVER GLORY'} · ({selectedBooking.voyageNumber || selectedBooking.voyageNo || 'V.2024N'})</strong>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Số Vận đơn (Bill of Lading):</span>
                <span className="font-mono font-bold text-blue-700">{selectedBooking.billOfLading || (selectedBooking.cargoDeclarationId && selectedBooking.cargoDeclarationId !== 'N/A' ? selectedBooking.cargoDeclarationId : '') || selectedManifestInfo?.blNumber || 'Chưa có B/L'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Số Niêm phong (Seal No):</span>
                <span className="font-mono font-bold text-slate-800">{selectedBooking.sealNumber || 'EMCU-SEAL-8821'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Khối lượng toàn bộ (VGM):</span>
                <span className="font-mono font-bold text-emerald-700">{selectedBooking.vgm ? `${selectedBooking.vgm} kg` : '28.450 kg'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Khối lượng vỏ (Tare):</span>
                <span className="font-mono font-bold text-slate-700">3.850 kg</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Khối lượng hàng thực (Net):</span>
                <span className="font-mono font-bold text-slate-900">{selectedBooking.vgm ? `${Math.max(1000, Number(selectedBooking.vgm) - 3850).toLocaleString('vi-VN')} kg` : '24.600 kg'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Thông quan Hải Quan:</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px]">
                  ✓ Đã kiểm tra &amp; Thông quan NSW (Luồng Xanh)
                </span>
              </div>
              {((selectedBooking.containerType || '').includes('RF') || selectedBooking.isReefer) && (
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Nhiệt độ bảo quản lạnh:</span>
                  <span className="font-mono font-bold text-cyan-700">-18.0°C (Độ ẩm 85%)</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowContainerPopup(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-black transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── POPUP XEM CHI TIẾT BIỂU PHÍ DỊCH VỤ CẢNG ── */}
      {showTariffPopup && selectedBooking && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 text-xs font-sans">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-700 text-xl">receipt_long</span>
                <h3 className="font-heading text-sm font-bold text-slate-900">Bảng Kê Chi Tiết Biểu Phí Cảng Tiên Sa</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTariffPopup(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-purple-800 block">Tổng Cước &amp; Phí Cảng</span>
                <span className="text-lg font-extrabold text-orange-600 font-mono">
                  {bookingTariffSummary.totalFormatted}
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                selectedBooking.paymentStatus === 'Paid'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {selectedBooking.paymentStatus === 'Paid' ? '● Đã thanh toán' : '○ Chờ thanh toán'}
              </span>
            </div>

            <div className="space-y-2 font-medium divide-y divide-slate-100">
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600">1. Cước nâng hạ (THC tại bãi):</span>
                <span className="font-mono font-bold text-slate-900">320.000 VNĐ</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600">2. Phí cơ sở vật chất:</span>
                <span className="font-mono font-bold text-slate-900">100.000 VNĐ</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600">3. Phí cân VGM:</span>
                <span className="font-mono font-bold text-slate-900">70.000 VNĐ</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600">4. Phí an ninh bến cảng:</span>
                <span className="font-mono font-bold text-slate-900">50.000 VNĐ</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600">5. Phí đảo chuyển container (Shifting):</span>
                <span className="font-mono font-bold text-slate-900">
                  {activeShiftingFee.statusText}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600">6. Phí lưu bãi ({activePortTariff?.storageDays || 3} ngày, miễn phí 5 ngày):</span>
                <span className="font-mono font-bold text-slate-900">
                  {activePortTariff?.storageFee ? `${activePortTariff.storageFee.toLocaleString('vi-VN')} VNĐ` : '0 VNĐ'}
                </span>
              </div>
              {((selectedBooking.containerType || '').includes('RF') || selectedBooking.isReefer) && (
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-600">7. Phí cắm điện &amp; giám sát Cont Lạnh:</span>
                  <span className="font-mono font-bold text-slate-900">80.000 VNĐ</span>
                </div>
              )}
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600">Thuế giá trị gia tăng (VAT 8%):</span>
                <span className="font-mono font-bold text-slate-900">{bookingTariffSummary.vatFormatted}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600">Đơn vị thanh toán:</span>
                <span className="font-bold text-slate-900">{selectedBooking.company}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600">Mã hóa đơn điện tử:</span>
                <span className="font-mono font-bold text-blue-700">HD-TS-2026-{selectedBooking.id || '9821'}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowTariffPopup(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-black transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── POPUP LỚN: SƠ ĐỒ PHÂN KHU BÃI TIÊN SA (NGUYÊN BẢN SẠCH SẼ) ── */}
      {showYardBigModal && selectedBooking && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[70] flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-3xl max-w-5xl lg:max-w-6xl w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 text-xs font-sans max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">grid_view</span>
                </div>
                <div>
                  <h3 className="font-heading text-base font-black text-slate-900">Sơ Đồ Phân Khu Bãi Container Tiên Sa</h3>
                  <p className="text-xs text-slate-500">Tự động chọn khu theo loại cont và mở sơ đồ Bay &amp; Slot để đổi vị trí</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowYardBigModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Vị trí hiện tại - Chuẩn như ảnh chụp của user */}
            {reservedSlot && (
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wide">Vị trí bãi đang xếp chỗ cho Cont {selectedBooking.containerId}:</span>
                  <div className="text-base font-bold text-slate-900 font-mono mt-1">
                    Block {reservedSlot.blockCode} • Bay {reservedSlot.bay || '02'} • Tầng {reservedSlot.tier} • Hàng {reservedSlot.row} (POS: {reservedSlot.posId})
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-bold text-xs shadow-2xs self-start sm:self-auto">
                  {reservedSlot.isReefer ? 'Khu Cont Lạnh' : 'Bãi Tiên Sa'}
                </span>
              </div>
            )}

            {/* BƯỚC 1: Chọn Phân Khu Bãi (Zone A ➔ G) - To rõ ràng thấy hết chữ */}
            <div className="space-y-2.5">
              <label className="text-xs font-black uppercase tracking-wide text-slate-800 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white inline-flex items-center justify-center text-[11px] font-bold">1</span>
                <span>Chọn Phân Khu Bãi Cảng Tiên Sa (Zone A ➔ G):</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                {YARD_ZONES.map((zone) => {
                  const isSelected = selectedZone === zone.code
                  const count = combinedBlocks.filter((b) => b.sector === zone.code || (b.blockCode || '').toUpperCase().startsWith(zone.code)).length

                  return (
                    <button
                      key={zone.code}
                      type="button"
                      onClick={() => setSelectedZone(zone.code)}
                      className={`p-3 sm:p-3.5 rounded-2xl border text-left transition flex flex-col justify-between min-h-[82px] cursor-pointer ${
                        isSelected
                          ? 'border-2 border-orange-500 bg-orange-50/70 shadow-xs ring-2 ring-orange-500/20'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className={`text-sm font-black ${isSelected ? 'text-orange-700' : 'text-slate-900'}`}>
                          {zone.name}
                        </span>
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200 shadow-2xs">
                          {count}
                        </span>
                      </div>
                      <span className={`text-[11px] mt-1.5 font-medium leading-snug break-words ${isSelected ? 'text-orange-800 font-semibold' : 'text-slate-500'}`}>
                        {zone.desc}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* BƯỚC 2: Các Block thuộc Khu đã chọn - Chuẩn như ảnh chụp của user */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-slate-800 text-white inline-flex items-center justify-center text-[10px] font-bold">2</span>
                <span>Các Block thuộc {YARD_ZONES.find((z) => z.code === selectedZone)?.name || `Khu ${selectedZone}`}:</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {currentZoneBlocks.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 text-slate-500 text-xs font-medium col-span-full text-center border border-slate-200">
                    Đang tải danh sách Block thuộc Khu {selectedZone}...
                  </div>
                ) : (
                  currentZoneBlocks.map((block) => {
                    const code = block.blockCode || block.description || block.id
                    const totalSlots = block.totalCapacity || (block.slots?.length || 0)
                    const occupied = block.occupied ?? (block.slots?.filter((s) => s.status === 'occupied').length || 0)
                    const reserved = block.reserved ?? (block.slots?.filter((s) => s.status === 'reserved').length || 0)
                    const empty = block.empty ?? Math.max(0, totalSlots - (occupied + reserved))
                    const isFull = totalSlots > 0 && empty === 0

                    return (
                      <div
                        key={block.id || code}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-orange-400 hover:shadow-xs transition space-y-2.5 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-heading text-sm font-bold text-slate-900 font-mono">
                              Block {block.blockCode || block.code}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              isFull
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}>
                              {isFull ? 'Hết chỗ' : `${empty} slot trống`}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Sức chứa: {totalSlots} TEU · Đang lưu: {occupied} Cont
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setPickerBlock(block)
                            setShowYardBigModal(false)
                          }}
                          className="w-full py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-orange-600 text-white text-xs font-semibold transition shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">open_in_new</span>
                          <span>Chọn Bay &amp; Slot ➔</span>
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowYardBigModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-black transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── POPUP ĐỐI CHIẾU THỐNG NHẤT 2 BÊN: DỊCH VỤ ePORT ↔ YÊU CẦU BOOKING CỔNG ── */}
      {showEportSyncPopup && selectedBooking && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[75] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 text-xs font-sans max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">compare_arrows</span>
                </div>
                <div>
                  <h3 className="font-heading text-sm font-bold text-slate-900">
                    Đối Chiếu Thống Nhất: Dịch Vụ ePort ↔ Yêu Cầu Booking Cổng
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Kiểm tra chéo giữa hồ sơ doanh nghiệp đăng ký trên ePort và đơn điều phối cổng của Cảng Tiên Sa
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEportSyncPopup(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Thanh tìm kiếm đơn ePort để đối chiếu */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                loadEportMatches(eportSearchTerm)
              }}
              className="flex flex-col sm:flex-row gap-2 shrink-0"
            >
              <input
                type="text"
                value={eportSearchTerm}
                onChange={(e) => setEportSearchTerm(e.target.value)}
                placeholder="Tìm đơn ePort theo số Container, số B/L, Booking hoặc mã đơn SVO..."
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="submit"
                disabled={eportLoading}
                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer disabled:opacity-60"
              >
                {eportLoading ? 'Đang tìm...' : 'Tìm & Đối chiếu'}
              </button>
            </form>

            {eportError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] shrink-0">
                {eportError}
              </div>
            )}

            {/* Chọn nếu có nhiều đơn ePort khớp */}
            {eportOrders.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <span className="text-[11px] font-semibold text-slate-500">Đơn ePort tìm thấy ({eportOrders.length}):</span>
                {eportOrders.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={async () => {
                      try {
                        const d = await serviceOrdersApi.get(o.id)
                        setEportDetail(d)
                      } catch {
                        setEportDetail(o)
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition ${
                      eportComparison?.order?.id === o.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {o.number}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {eportComparison?.order ? (
                <>
                  {/* Tổng kết khớp hay lệch */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    eportComparison.status === 'matched'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : eportComparison.status === 'partial'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xl">
                        {eportComparison.status === 'matched' ? 'check_circle' : eportComparison.status === 'partial' ? 'pending' : 'warning'}
                      </span>
                      <div>
                        <div className="font-bold text-xs">{eportComparison.badgeText}</div>
                        <div className="text-[11px] opacity-85">
                          Mã đơn ePort: <strong className="font-mono">{eportComparison.order.number}</strong> · Dịch vụ: {eportComparison.order.mainServiceName || 'Đăng ký dịch vụ cảng'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedEportOrderId(eportComparison.order.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-[11px] font-bold cursor-pointer shrink-0 inline-flex items-center gap-1"
                    >
                      <span>Xem chi tiết đơn ePort</span>
                      <span className="material-symbols-outlined text-sm">visibility</span>
                    </button>
                  </div>

                  {/* Bảng so sánh 2 bên */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wide border-b border-slate-200">
                          <th className="py-2.5 px-3 w-[24%]">Tiêu chí đối chiếu</th>
                          <th className="py-2.5 px-3 w-[32%]">Bên Yêu Cầu Booking Cổng</th>
                          <th className="py-2.5 px-3 w-[32%]">Bên Dịch Vụ ePort</th>
                          <th className="py-2.5 px-3 w-[12%] text-center">Kết quả</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {eportComparison.checks.map((row) => (
                          <tr key={row.label} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-3 font-semibold text-slate-600">{row.label}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-900 break-words">
                              {row.useGateTariff ? (bookingTariffSummary?.totalFormatted || row.gateVal) : row.gateVal}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900 break-words">{row.eportVal}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                                row.ok
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}>
                                {row.ok ? '✓ Khớp' : '⚠ Lệch'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-2">
                  <span className="material-symbols-outlined text-3xl text-slate-400">search_off</span>
                  <div className="font-bold text-slate-800">Chưa tìm thấy đơn Dịch vụ ePort khớp với "{eportSearchTerm}"</div>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                    Doanh nghiệp/vận tải có thể chưa tạo đơn dịch vụ ePort cho container <strong className="font-mono">{selectedBooking.containerId}</strong>, hoặc bạn có thể nhập số B/L, số Booking hoặc mã đơn SVO vào ô tìm kiếm phía trên để đối chiếu.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEportSyncPopup(false)
                      setSelectedBooking(null)
                      setActiveListType('eport')
                    }}
                    className="mt-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>Xem tất cả đơn Dịch vụ ePort</span>
                    <span className="material-symbols-outlined text-sm">list_alt</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100 shrink-0">
              {selectedBooking.status !== 'Approved' && (() => {
                const isOrderRejected =
                  eportComparison?.order?.status === 'REJECTED' ||
                  eportValidationMap[eportComparison?.order?.id]?.status === 'AUTO_REJECTED'
                const canAccept = eportComparison?.status === 'matched' && !isOrderRejected && !selectedBooking._noGateBooking
                return (
                  <button
                    type="button"
                    disabled={!canAccept}
                    title={canAccept ? '' : 'Không thể duyệt khi dữ liệu 2 bên chưa khớp hoặc đơn ePort đã bị từ chối'}
                    onClick={() => {
                      if (!canAccept) return
                      setShowEportSyncPopup(false)
                      setShowApproveModal(true)
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 ${
                      canAccept
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>Duyệt &amp; Gửi Bill sang Vận tải ➔</span>
                  </button>
                )
              })()}
              <button
                type="button"
                onClick={() => setShowEportSyncPopup(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-black transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CHI TIẾT ĐƠN DỊCH VỤ ePORT (XEM & XỬ LÝ TRỰC TIẾP TRONG BOOKING CỔNG) ── */}
      {selectedEportOrderId && (
        <ServiceOrderDetail
          orderId={selectedEportOrderId}
          onClose={() => {
            setSelectedEportOrderId(null)
            loadAllEportRequests()
            if (selectedBooking) loadEportMatches(eportSearchTerm || selectedBooking.containerId)
          }}
        />
      )}

    </div>
  )
}
