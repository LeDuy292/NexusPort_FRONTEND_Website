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
import sourceLayout from '../../features/yard-design/tienSaLayout.json'
import VesselsManifestTab from './components/VesselsManifestTab'
import BookingsScheduleTab from './components/BookingsScheduleTab'
import EportServiceOrdersTab from './components/EportServiceOrdersTab'
import VesselYardAllocationModal from './components/VesselYardAllocationModal'
import VesselManifestDetailModal from './components/VesselManifestDetailModal'
import { planAllManifestContainers } from '../../services/yardPlanningRules'
import GateBookingDetailModal from './components/GateBookingDetailModal'
import {
  BookingApproveModal,
  BookingRejectModal,
  BookingDocumentsModal,
  BookingVehicleModal,
  BookingCarrierModal,
  BookingVesselModal,
  BookingTariffModal,
  BookingYardBigModal,
} from './components/BookingActionModals'
import ServicePortReconciliationModal from './components/ServicePortReconciliationModal'
import { yardReservationStore } from '../../services/yardReservationStore'
import { calculatePortStorageFee, calculatePortServiceTariff, computeAutoBookingTariff, calculateShiftingFee, PORT_STORAGE_TIERS } from '../../utils/portStorageFee'
import { manifestPortSyncService, TRANSPORT_COMPANIES_POOL, sortContainersForYardAllocation, isManifestPermanentlyApproved } from '../../services/manifestPortSyncService'
import yardDischargeService from '../../services/yardDischargeService'
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

/**
 * Hàm chuẩn hóa ngày hiển thị (DD/MM/YYYY) cho container từ Bản khai Tàu
 */
const extractBookingDate = (b) => {
  if (!b) return new Date().toLocaleDateString('vi-VN')

  // Đảm bảo chuyến tàu ONE CONTINUITY (OC-2612E) đồng bộ hiển thị 25/11/2026
  const isOc2612 = b.voyageNumber === 'OC-2612E' || (b.vesselName && b.vesselName.includes('CONTINUITY'))

  // 1. Explicit vessel ETA Date
  const dCandidate = b.vesselEtaDate || b.etaDate
  if (dCandidate && typeof dCandidate === 'string') {
    const d = dCandidate.trim()
    const mIso = d.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    if (mIso) {
      if (isOc2612 && mIso[1] === '2026' && mIso[2] === '11' && mIso[3] === '09') return '25/11/2026'
      return `${mIso[3].padStart(2, '0')}/${mIso[2].padStart(2, '0')}/${mIso[1]}`
    }
    const mVn = d.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
    if (mVn) {
      if (isOc2612 && mVn[1] === '09' && mVn[2] === '11' && mVn[3] === '2026') return '25/11/2026'
      return `${mVn[1].padStart(2, '0')}/${mVn[2].padStart(2, '0')}/${mVn[3]}`
    }
    return d
  }

  // 2. ETA string (contains date e.g. "2026-11-14 08:30" or "14/11/2026")
  const etaCandidate = b.vesselEta || b.eta
  if (etaCandidate && typeof etaCandidate === 'string') {
    const mIso = etaCandidate.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    if (mIso) {
      if (isOc2612 && mIso[1] === '2026' && mIso[2] === '11' && mIso[3] === '09') return '25/11/2026'
      return `${mIso[3].padStart(2, '0')}/${mIso[2].padStart(2, '0')}/${mIso[1]}`
    }
    const mVn = etaCandidate.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
    if (mVn) {
      if (isOc2612 && mVn[1] === '09' && mVn[2] === '11' && mVn[3] === '2026') return '25/11/2026'
      return `${mVn[1].padStart(2, '0')}/${mVn[2].padStart(2, '0')}/${mVn[3]}`
    }
  }

  if (isOc2612) return '25/11/2026'

  // 3. createdAt string
  if (b.createdAt && typeof b.createdAt === 'string') {
    const mVn = b.createdAt.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
    if (mVn) return `${mVn[1].padStart(2, '0')}/${mVn[2].padStart(2, '0')}/${mVn[3]}`
    const mIso = b.createdAt.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    if (mIso) return `${mIso[3].padStart(2, '0')}/${mIso[2].padStart(2, '0')}/${mIso[1]}`
  }

  // 4. Fallback date property
  if (b.date && typeof b.date === 'string') return b.date

  return new Date().toLocaleDateString('vi-VN')
}

export const normCompanyText = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const companiesMatch = (a, b) => {
  const na = normCompanyText(a)
  const nb = normCompanyText(b)
  if (!na || !nb) return false
  if (na.includes(nb) || nb.includes(na)) return true
  const stop = new Set(['cong', 'ty', 'tnhh', 'cp', 'co', 'phan', 'van', 'tai', 'logistics', 'giao', 'nhan', 'dich', 'vu', 'da', 'nang', 'mien', 'trung', 'chi', 'nhanh'])
  const ta = na.split(' ').filter(w => w.length >= 2 && !stop.has(w))
  const tb = new Set(nb.split(' ').filter(w => w.length >= 2 && !stop.has(w)))
  const overlap = ta.filter(w => tb.has(w))
  return overlap.length >= 1
}

export default function GateBookingRequests() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(false)

  // Filters State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [operationFilter, setOperationFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState('All')
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
  const [batchApproveList, setBatchApproveList] = useState([])
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionNote, setRejectionNote] = useState('')
  const [showDocumentsModal, setShowDocumentsModal] = useState(false)
  const [showContainerPopup, setShowContainerPopup] = useState(false)
  const [showCarrierPopup, setShowCarrierPopup] = useState(false)
  const [showTariffPopup, setShowTariffPopup] = useState(false)
  const [showYardBigModal, setShowYardBigModal] = useState(false)
  const [showVehiclePopup, setShowVehiclePopup] = useState(false)
  const [showContainerDetailModal, setShowContainerDetailModal] = useState(false)
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
  const [vesselPage, setVesselPage] = useState(1)
  const [vesselPageSize, setVesselPageSize] = useState(5)
  const [companyPage, setCompanyPage] = useState(1)
  const [companyPageSize, setCompanyPageSize] = useState(5)
  const [popupContainerPage, setPopupContainerPage] = useState(1)
  const [popupContainerPageSize, setPopupContainerPageSize] = useState(5)
  const [selectedSlotDetails, setSelectedSlotDetails] = useState(null)
  const [yardInventory, setYardInventory] = useState(null)

  useEffect(() => {
    let active = true
    const fetchYardInventory = async () => {
      try {
        const snap = await expressApiClient.get('/yard/layout')
        if (active && snap?.slots) {
          setYardInventory(snap)
        }
      } catch (err) {
        // silent fallback
      }
    }
    fetchYardInventory()
    const timer = setInterval(fetchYardInventory, 15000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  // Cảng phê duyệt / chấp nhận Bản khai Tàu -> Tự động tách ra bảng mới chia theo từng Công ty vận tải để xét duyệt
  const handleApproveVesselManifest = async (manifestId) => {
    // 1. Kiểm tra xem tàu này đã có Kế hoạch Phân Bổ Bãi Tự Động (Smart Yard Pre-Allocation) từ Backend chưa
    let matchedPlan = null
    try {
      const plans = await yardDischargeService.getPlans()
      if (Array.isArray(plans)) {
        matchedPlan = plans.find(p =>
          p.manifestId === manifestId ||
          p.manifestNumber === manifestId ||
          (p.voyageNumber && (selectedVesselManifest?.voyageNumber === p.voyageNumber || String(manifestId).includes(p.voyageNumber)))
        )
      }
    } catch (e) {
      console.warn('Lấy kế hoạch phân bổ bãi tự động có sẵn:', e)
    }

    // 2. Phê duyệt bản khai tàu, áp dụng ngay vị trí từ Kế Hoạch Phân Bổ Bãi Tự Động đã có (nếu có)
    const res = manifestPortSyncService.approveManifestByPort(manifestId, matchedPlan)
    const approvedManifest = res?.approvedManifest
    const newGateBookings = res?.newGateBookings || []

    setManifestSyncVersion(v => v + 1)
    if (approvedManifest?.manifestNumber || manifestId) {
      setSelectedVesselFilter(approvedManifest?.manifestNumber || manifestId)
    }

    if (selectedVesselManifest) {
      setSelectedVesselManifest(null)
    }

    // 3. Tự động kích hoạt thuật toán Phân bổ bãi thông minh (Smart Yard Pre-Allocation) từ Backend C#
    try {
      const targetManifestId = matchedPlan?.manifestId || approvedManifest?.id || (manifestId && !String(manifestId).startsWith('MNF-') ? manifestId : null)
      if (targetManifestId) {
        yardDischargeService.preAllocate(targetManifestId).then(updatedPlan => {
          if (updatedPlan?.containers && Array.isArray(updatedPlan.containers)) {
            for (const c of updatedPlan.containers) {
              if (c.reservedSlot) {
                manifestPortSyncService.syncYardSlotAcrossAll({
                  containerNumber: c.containerNumber,
                  manifestId: targetManifestId,
                  newSlotCoordinate: c.reservedSlot,
                  reason: c.allocationReason || 'Thuật toán Smart Yard Pre-Allocation tự động phân bổ',
                  status: c.dischargeStatus === 'IN_YARD' ? 'in_yard' : 'reserved',
                  vesselName: updatedPlan.vesselName,
                  voyageNumber: updatedPlan.voyageNumber,
                })
              }
            }
          }
        }).catch(() => { })
      }
    } catch (e) {
      console.warn('Auto preAllocate warning:', e)
    }

    showToast(
      `🟢 Đã duyệt tàu ${approvedManifest?.vesselName || manifestId}! Đã áp dụng phân bổ bãi tự động chuẩn: Hàng xuất gần cổng, Hàng nhập gần biển, Cont lạnh/DG ưu tiên, Cont nặng hạ tầng dưới.`
    )
  }

  // Dispatcher kiểm tra logic bãi, chấp nhận (Accept) và chuyển sang bước tiếp theo
  const handleAcceptYardAndNext = async (manifest, overrides = {}, containerList = []) => {
    if (!manifest) return
    const mId = manifest.manifestId || manifest.manifestNumber || manifest.id

    // 1. Phê duyệt bản khai tàu & tự động gán vị trí bãi
    await handleApproveVesselManifest(mId)

    // 2. Thu thập và đồng bộ ngay 100% vị trí bãi từ Popup sang Bookings & yardReservationStore
    const effectiveList = Array.isArray(containerList) && containerList.length > 0 ? containerList : popupContainerList
    if (Array.isArray(effectiveList)) {
      effectiveList.forEach(c => {
        const key = String(c.containerNumber || c.containerId || c.containerNo || c.id || '').trim().toUpperCase()
        const manual = overrides?.[key]
        const slot = manual || c.autoYardSlot
        if (key && slot) {
          const slotCoord = slot.coordinate || `${slot.blockCode || slot.block}-${String(slot.bay || 1).padStart(2, '0')}-${String(slot.row || 1).padStart(2, '0')}-${slot.tier || 1}`
          manifestPortSyncService.syncYardSlotAcrossAll({
            containerNumber: key,
            manifestId: mId,
            newSlotCoordinate: slotCoord,
            reason: 'Điều độ viên xác nhận vị trí bãi đề xuất từ Bản Khai Tàu',
            status: 'reserved',
            vesselName: manifest.vesselName || '',
            voyageNumber: manifest.voyageNumber || '',
          }).catch(() => {})
        }
      })
    }
    
    // 3. Gửi lịch Manifest và vị trí bãi cho Hãng tàu
    manifestPortSyncService.saveSyncedManifest({
      ...manifest,
      yardScheduleSentToCarrier: true,
      yardScheduleSentAt: new Date().toISOString(),
      portApprovalStatus: 'PORT_APPROVED',
      status: 'PORT_APPROVED'
    })
    
    // 4. Cập nhật version để re-render bảng
    setManifestSyncVersion(v => v + 1)

    // 5. Đóng Popup xem bãi
    setVesselContainersPopup(null)
    
    // 6. "rr mới hướng tới bước tiếp theo": Chuyển sang Tab 2 "Container Theo Ngày & Chuyến Tàu"
    setActiveListType('truck')
    if (manifest.manifestNumber || manifest.vesselName) {
      setSelectedVesselFilter(manifest.manifestNumber || manifest.vesselName)
    }
    
    showToast(`🟢 Đã duyệt và gửi lịch bãi thành công cho Hãng tàu! Đang chuyển sang bước điều phối xe & lịch hẹn cổng.`)
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
    setDateFilter('All')
    showToast('⚪ Đã xóa toàn bộ bộ lọc, hiển thị đầy đủ tất cả Container.')
  }

  // Xóa sạch thông báo hồ sơ xe/tài xế cũ khỏi bộ nhớ
  try {
    localStorage.removeItem('NEXUSPORT_TRANSPORT_SUBMISSIONS_ALERT')
  } catch { }

  const getBillAlerts = () => {
    try {
      const rawBills = JSON.parse(localStorage.getItem('NEXUSPORT_PORT_BILLS') || '{}')
      const dismissedIds = new Set(JSON.parse(localStorage.getItem('NEXUSPORT_DISMISSED_BILLS') || '[]'))
      const list = []
      // Mỗi lần duyệt booking sinh 2 loại hóa đơn: từng container (BILL-<mã>) và hóa đơn tổng của cả booking (BILL-<mã>-TOTAL).
      // Đã có hóa đơn tổng thì ẩn hóa đơn từng container nằm trong đó để không hiện trùng.
      const totalBills = Object.values(rawBills).filter(b => b && typeof b === 'object' && String(b.billNumber || '').endsWith('-TOTAL'))
      const totalNumbers = new Set(totalBills.map(b => b.billNumber))
      const coveredContainers = new Set(
        totalBills.flatMap(b => (b.containers || []).map(c => String(c?.containerId || '').trim().toUpperCase())).filter(Boolean)
      )
      Object.entries(rawBills).forEach(([k, b]) => {
        if (!b || typeof b !== 'object') return
        const billId = b.billNumber || b.reference || (k.startsWith('BILL-') ? k : `BILL-${k}`)
        if (!b.billNumber && !b.total && !b.totalFormatted) return
        if (b.kind === 'ITEM') return
        if (dismissedIds.has(billId)) return
        if (!String(billId).endsWith('-TOTAL') &&
            (totalNumbers.has(`${billId}-TOTAL`) || coveredContainers.has(String(b.containerId || '').trim().toUpperCase()))) return
        if (list.some(item => item.id === billId || item.billNumber === b.billNumber)) return

        const isPaid = b.status === 'PAID' || b.paid === true
        list.push({
          id: billId,
          billNumber: b.billNumber || billId,
          bookingCode: b.bookingCode || null,
          company: b.company || b.customerName || 'Doanh nghiệp vận tải / Khách hàng',
          total: b.total,
          totalFormatted: b.totalFormatted || (b.total ? `${Number(b.total).toLocaleString('vi-VN')} VNĐ` : '583.200 VNĐ'),
          isPaid,
          status: isPaid ? 'PAID' : (b.status || 'SENT_TO_CARRIER'),
          approvedAt: b.approvedAt || b.paidAt || new Date().toLocaleString('vi-VN'),
          containers: b.containers || [],
          containerCount: b.containers?.length || 1,
        })
      })
      return list.slice(0, 5)
    } catch {
      return []
    }
  }

  const [billAlerts, setBillAlerts] = useState(() => getBillAlerts())

  const handleDismissBillAlert = (id) => {
    try {
      const dismissed = JSON.parse(localStorage.getItem('NEXUSPORT_DISMISSED_BILLS') || '[]')
      if (!dismissed.includes(id)) {
        dismissed.push(id)
        localStorage.setItem('NEXUSPORT_DISMISSED_BILLS', JSON.stringify(dismissed))
      }
    } catch { }
    setBillAlerts(prev => prev.filter(b => b.id !== id))
  }

  const handleDismissAllBillAlerts = () => {
    try {
      const allIds = billAlerts.map(b => b.id)
      const dismissed = JSON.parse(localStorage.getItem('NEXUSPORT_DISMISSED_BILLS') || '[]')
      const next = Array.from(new Set([...dismissed, ...allIds]))
      localStorage.setItem('NEXUSPORT_DISMISSED_BILLS', JSON.stringify(next))
    } catch { }
    setBillAlerts([])
  }

  const handleViewBill = (bill) => {
    const matched = manifestGeneratedBookings.find(b =>
      (bill.bookingCode && (b.id === bill.bookingCode || b.bookingCode === bill.bookingCode)) ||
      (bill.billNumber && b.id && bill.billNumber.includes(b.id)) ||
      (bill.containers && bill.containers.some(c => c.containerNo === b.containerId))
    )
    if (matched) {
      setSelectedBooking(matched)
      setShowTariffPopup(true)
    } else {
      showToast(`🧾 Hóa đơn ${bill.billNumber}: ${bill.totalFormatted} (${bill.isPaid ? 'Đã thanh toán' : 'Chờ thanh toán'})`)
    }
  }

  // Lắng nghe sự kiện Hãng tàu truyền Manifest sang Cảng, Hóa đơn/Bill phát sinh & sự kiện đặt/đổi vị trí bãi
  useEffect(() => {
    const unsub = manifestPortSyncService.subscribe((newManifest) => {
      setManifestSyncVersion(v => v + 1)
      setYardResVersion(v => v + 1)
      setBillAlerts(getBillAlerts())
      if (newManifest?.manifestNumber) {
        showToast(`🚢 Đã nhận Bản khai hàng hóa (${newManifest?.manifestNumber || 'Manifest'}) do Hãng tàu gửi sang Cảng!`)
      }
    })
    const handleManifestCustomEvent = () => {
      setManifestSyncVersion(v => v + 1)
      setBillAlerts(getBillAlerts())
    }
    const handleStorageUpdate = (e) => {
      if (!e?.key || e.key === 'NEXUSPORT_PORT_BILLS' || e.key === 'NEXUSPORT_MANIFEST_GATE_BOOKINGS_V1') {
        setManifestSyncVersion(v => v + 1)
        setBillAlerts(getBillAlerts())
      }
    }
    const handleYardResUpdate = () => {
      setYardResVersion(v => v + 1)
      setManifestSyncVersion(v => v + 1)
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

  // Kiểm tra xem container / booking có đang gắn toàn bộ vào các đơn ePort đã bị từ chối/hủy hay không
  const isBookingRejectedOrUnassigned = (b) => {
    if (!b) return false
    const cId = String(b.containerId || '').trim().toUpperCase()
    const matchingOrders = eportListItems.filter((o) => {
      if (b.eportOrderId && o.id === b.eportOrderId) return true
      if (cId && eportValidationMap[o.id]?.containerIds?.some(x => String(x || '').trim().toUpperCase() === cId)) return true
      if (cId && (o.containers || []).some(c => String(c?.containerNumber || c || '').trim().toUpperCase() === cId)) return true
      if (cId && String(o.sourceLabel || '').toUpperCase().includes(cId)) return true
      return false
    })
    if (matchingOrders.length > 0) {
      const hasValidOrder = matchingOrders.some(o => !['REJECTED', 'CANCELLED', 'DRAFT'].includes(String(o.status || '').toUpperCase()))
      if (!hasValidOrder && !eportListStatus && !eportListSearch && !eportListFlow) {
        return true
      }
      if (b.eportOrderId) {
        const linked = matchingOrders.find(o => o.id === b.eportOrderId)
        if (linked && ['REJECTED', 'CANCELLED'].includes(String(linked.status || '').toUpperCase()) && !hasValidOrder) {
          return true
        }
      }
    }
    return false
  }

  // Kiểm tra đơn đã Duyệt & Gửi Bill chưa
  const isBookingApprovedOrBillSent = (b) => {
    if (!b || isBookingRejectedOrUnassigned(b)) return false
    return b.status === 'Approved' || b.status === 'Ready' || Boolean(b.portBill) || Boolean(b.portBillPaid)
  }

  // Helper lấy thông tin biển số xe đầu kéo chính xác cho Gate Booking (CHỈ hiện khi Cảng đã duyệt & gửi bill)
  const getGateBookingVehicle = (b) => {
    if (!b || isBookingRejectedOrUnassigned(b)) return null
    const isApproved = b.status === 'Approved' || b.status === 'Ready' || isBookingApprovedOrBillSent(b) || Boolean(b.portBillPaid) || b.paymentStatus === 'Paid'
    if (!isApproved) {
      return null
    }

    const cId = String(b.containerId || '').trim().toUpperCase()
    const orderFleet = manifestPortSyncService.getOrderFleet(cId) ||
      manifestPortSyncService.getOrderFleet(b.id) ||
      manifestPortSyncService.getOrderFleet(b.bookingCode)
    if (orderFleet?.plate) return orderFleet.plate

    if (b.licensePlate && b.licensePlate !== 'Chưa gán xe' && b.licensePlate !== 'Chưa gán' && b.licensePlate !== 'Chưa điều phối' && b.licensePlate !== '47AB-294.69') {
      return b.licensePlate
    }
    if (b.vehiclePlate && b.vehiclePlate !== 'Chưa điều phối' && b.vehiclePlate !== 'Chưa gán' && b.vehiclePlate !== '47AB-294.69') {
      return b.vehiclePlate
    }
    if (b.licensePlate && b.licensePlate !== 'Chưa gán xe' && b.licensePlate !== 'Chưa gán' && b.licensePlate !== 'Chưa điều phối') {
      return b.licensePlate
    }
    return b.suggestedPlate || null
  }

  // Helper lấy thông tin tài xế chính xác cho Gate Booking (CHỈ hiện khi Cảng đã duyệt & gửi bill)
  const getGateBookingDriver = (b) => {
    if (!b || isBookingRejectedOrUnassigned(b)) return null
    const isApproved = b.status === 'Approved' || b.status === 'Ready' || isBookingApprovedOrBillSent(b) || Boolean(b.portBillPaid) || b.paymentStatus === 'Paid'
    if (!isApproved) {
      return null
    }

    const cId = String(b.containerId || '').trim().toUpperCase()
    const orderFleet = manifestPortSyncService.getOrderFleet(cId) ||
      manifestPortSyncService.getOrderFleet(b.id) ||
      manifestPortSyncService.getOrderFleet(b.bookingCode)
    if (orderFleet?.driver) return orderFleet.driver

    if (b.driverName && b.driverName !== 'Chưa điều phối' && b.driverName !== 'Chưa có tài xế' && b.driverName !== 'TRẦN VĂN TÙNG') {
      return b.driverName
    }
    if (b.driverName && b.driverName !== 'Chưa điều phối' && b.driverName !== 'Chưa có tài xế') {
      return b.driverName
    }
    return b.suggestedDriver || null
  }

  // Helper kiểm tra xem Booking đã có thông tin xe & tài xế từ Vận tải hay chưa
  const isBookingTransportSubmitted = (b) => {
    if (!b) return false
    if (b.status === 'Approved' || b.status === 'Ready' || isBookingApprovedOrBillSent(b)) return true
    return false
  }

  // Bỏ 4 số cuối của mã Booking (ví dụ: BK-MM2601S-9101 -> BK-MM2601S)
  const stripTrailingDigits = (s) => {
    if (!s) return ''
    return String(s).trim().replace(/[-_]\d{4}$/, '').replace(/[-_]\d{3,5}$/, '')
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
    setShowContainerDetailModal(true)
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

  // Helper lấy toàn bộ chứng từ & hồ sơ pháp lý thật đồng nhất 100% với đơn Dịch vụ ePort
  const getBookingRealDocuments = (b) => {
    if (!b || isBookingRejectedOrUnassigned(b)) return []

    const cId = String(b.containerId || '').trim().toUpperCase()
    const isFakeUrlOrSample = (url, name) =>
      String(url || '').includes('pdfobject.com/pdf/sample.pdf') ||
      ['OIP (2).jpg', 'Gemini_Generated_Image_1s6k9n1s6k9n1s6k.png', 'best.jpg'].includes(String(name || ''))

    // 1. Tìm đơn ePort hợp lệ tương ứng (không bị REJECTED / CANCELLED)
    const candidates = [
      eportComparison?.order,
      eportDetail,
      ...(eportOrders || []),
      ...(eportListItems || []),
    ].filter(Boolean)

    const activeOrder = candidates.find((o) => {
      const st = String(o.status || '').toUpperCase()
      if (['REJECTED', 'CANCELLED'].includes(st)) return false
      if (b.eportOrderId && o.id === b.eportOrderId) return true
      const inConts = (o.containers || []).some(c => String(c?.containerNumber || c || '').trim().toUpperCase() === cId)
      const inLines = (o.content?.lines || []).some(l => String(l?.declaration?.containerNumber || l?.containerNumber || '').trim().toUpperCase() === cId)
      const inLabel = cId && String(o.sourceLabel || '').toUpperCase().includes(cId)
      return inConts || inLines || inLabel
    }) || null

    const orderFleetForCont =
      (activeOrder && manifestPortSyncService.extractFleetFromOrder(activeOrder, cId)) ||
      manifestPortSyncService.getOrderFleet(cId) ||
      manifestPortSyncService.getOrderFleet(b.id) ||
      manifestPortSyncService.getOrderFleet(b.bookingCode)

    const activeOrderStatus = String(activeOrder?.status || '').toUpperCase()
    const isOrderApproved = activeOrderStatus === 'APPROVED' || isBookingApprovedOrBillSent(b)

    // 2. Nhóm 1: Bộ hồ sơ chứng từ nộp Dispatcher từ đơn ePort (delivery.documents)
    const rawOrderDocs =
      activeOrder?.content?.delivery?.documents ||
      activeOrder?.content?.documents ||
      orderFleetForCont?.documents ||
      b.eportDocuments ||
      b.documents ||
      []

    const docIconMap = {
      CarrierBookingReference: 'receipt_long',
      BookingNote: 'receipt_long',
      DeliveryOrder: 'assignment_turned_in',
      BillOfLading: 'directions_boat',
      CustomsDeclaration: 'verified_user',
      VgmCertificate: 'scale',
      ReeferInstructions: 'ac_unit',
      ReeferTemperatureInstructions: 'ac_unit',
      DangerousGoodsDeclaration: 'warning',
    }

    const formatDocSize = (bytes) => {
      if (!bytes) return ''
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
      return `${(bytes / 1048576).toFixed(1)} MB`
    }

    const orderDocs = (Array.isArray(rawOrderDocs) ? rawOrderDocs : [])
      .filter(d => d && !isFakeUrlOrSample(d.fileUrl || d.fileReference, d.fileName))
      .map((d, idx) => {
        const docType = d.documentType || d.type || 'Other'
        const rawUrl = d.fileUrl || d.fileReference || ''
        const resolvedUrl = resolveMediaUrl(rawUrl) || rawUrl
        const sizeLabel = formatDocSize(d.fileSizeBytes)
        return {
          ...d,
          id: d.id || `ORD-DOC-${cId}-${docType}-${idx}`,
          documentType: docType,
          type: docType,
          title: d.title || getDocTypeVi(docType),
          fileName: d.fileName || '',
          fileSizeBytes: d.fileSizeBytes || 0,
          fileUrl: resolvedUrl,
          icon: d.icon || docIconMap[docType] || 'description',
          mandatory: d.mandatory ?? true,
          verificationStatus: d.verificationStatus || d.status || (isOrderApproved ? 'Verified' : 'Pending'),
          scope: sizeLabel ? `Dung lượng: ${sizeLabel}` : (d.scope || 'Chứng từ khách hàng nộp Dispatcher'),
          isOrderDoc: true,
        }
      })

    // 3. Nhóm 2: Hồ sơ pháp lý Phương tiện & Tài xế của container (đồng nhất 4 thẻ với FleetDocumentsReview)
    const isFakePlateDoc = p => !p || ['Chưa gán xe', 'Chưa gán', 'Chưa điều phối', '47AB-294.69', '43C-567.89'].includes(p)
    const isFakeDriverDoc = d => !d || ['Chưa điều phối', 'Chưa có tài xế', 'TRẦN VĂN TÙNG', 'Nguyễn Văn Minh'].includes(d)
    const vehicleSnap = orderFleetForCont?.vehicle || b.vehicleSnapshot || {}
    const driverSnap = orderFleetForCont?.driverSnapshot || b.driverSnapshot || b.driverDetails || b.rawBooking?.driverSnapshot || {}

    const rawPlate = orderFleetForCont?.plate || vehicleSnap?.plateNumber || getGateBookingVehicle(b) || b.licensePlate || b.suggestedPlate || null
    const rawDriver = orderFleetForCont?.driver || driverSnap?.fullName || driverSnap?.FullName || getGateBookingDriver(b) || b.driverName || b.suggestedDriver || null
    const vPlate = isFakePlateDoc(rawPlate) ? null : rawPlate
    const vDriver = isFakeDriverDoc(rawDriver) ? null : rawDriver
    const vPhone = orderFleetForCont?.phone || driverSnap?.phone || driverSnap?.Phone || b.phone || ''
    const vLicense =
      orderFleetForCont?.license ||
      driverSnap?.licenseNumber ||
      driverSnap?.LicenseNumber ||
      (b.licenseNumber && b.licenseNumber !== 'FC-782910' ? b.licenseNumber : null) ||
      (b.suggestedLicense && b.suggestedLicense !== 'FC-782910' ? b.suggestedLicense : null) ||
      'Chưa khai báo'

    const hasSubmittedFleet = Boolean(
      vPlate ||
      vDriver ||
      (activeOrder && !['DRAFT', 'REJECTED', 'CANCELLED'].includes(activeOrderStatus))
    )

    const fleetDocs = []
    if (hasSubmittedFleet && (vPlate || vDriver)) {
      const rawVehiclePhoto = vehicleSnap.photoUrl || vehicleSnap.PhotoUrl || (vPlate ? '/gate-camera-truck.png' : '')
      const rawRegImg = vehicleSnap.registrationImageUrl || vehicleSnap.RegistrationImageUrl || ''
      const rawDriverPhoto = driverSnap.photoUrl || driverSnap.PhotoUrl || ''
      const rawLicenseImg = driverSnap.licenseImageUrl || driverSnap.LicenseImageUrl || driverSnap.licenseBackImageUrl || ''

      const plateSafe = (vPlate || 'Xe').replace(/\s+/g, '_')
      const driverSafe = (vDriver || 'TaiXe').replace(/\s+/g, '_')

      fleetDocs.push(
        {
          id: `DOC-TRUCK-PHOTO-${cId}`,
          documentType: 'VehiclePhoto',
          type: 'VehiclePhoto',
          title: 'Ảnh chụp phương tiện',
          shortTitle: 'Ảnh xe đầu kéo',
          documentNumber: vPlate || 'Chưa gán biển số',
          fileName: `Xe_${plateSafe}.jpg`,
          fileUrl: rawVehiclePhoto ? (resolveMediaUrl(rawVehiclePhoto) || rawVehiclePhoto) : '',
          icon: 'local_shipping',
          mandatory: true,
          verificationStatus: rawVehiclePhoto ? 'Verified' : 'Pending',
          scope: vPlate ? `Xe đầu kéo: ${vPlate}${vehicleSnap.rfidTag ? ` · RFID: ${vehicleSnap.rfidTag}` : ''}` : 'Chưa gán biển số xe',
          isDriverDoc: true,
        },
        {
          id: `DOC-TRUCK-REG-${cId}`,
          documentType: 'VehicleRegistration',
          type: 'VehicleRegistration',
          title: 'Giấy chứng nhận đăng kiểm xe',
          shortTitle: 'Đăng kiểm xe',
          documentNumber: vehicleSnap.rfidTag || vPlate || 'Chưa khai báo',
          fileName: `DangKiem_${plateSafe}.jpg`,
          fileUrl: rawRegImg ? (resolveMediaUrl(rawRegImg) || rawRegImg) : '',
          icon: 'verified',
          mandatory: true,
          verificationStatus: rawRegImg ? 'Verified' : 'Pending',
          scope: vPlate ? `Sổ kiểm định: ${vPlate}` : 'Chưa có thông tin đăng kiểm',
          isDriverDoc: true,
        },
        {
          id: `DOC-DRIVER-PHOTO-${cId}`,
          documentType: 'DriverPhoto',
          type: 'DriverPhoto',
          title: 'Ảnh chân dung tài xế',
          shortTitle: 'Ảnh tài xế',
          documentNumber: driverSnap.idCardNumber || driverSnap.IdCardNumber || vPhone || vDriver || 'Tài xế',
          fileName: `TaiXe_${driverSafe}.jpg`,
          fileUrl: rawDriverPhoto ? (resolveMediaUrl(rawDriverPhoto) || rawDriverPhoto) : '',
          icon: 'person_pin',
          mandatory: true,
          verificationStatus: rawDriverPhoto ? 'Verified' : 'Pending',
          scope: vDriver ? `${vDriver}${vPhone ? ` · ${vPhone}` : ''}` : 'Chưa gán tài xế phụ trách',
          isDriverDoc: true,
        },
        {
          id: `DOC-GPLX-${cId}`,
          documentType: 'DriverLicense',
          type: 'DriverLicense',
          title: 'Giấy phép lái xe (GPLX)',
          shortTitle: 'GPLX Hạng FC',
          documentNumber: vLicense,
          fileName: `GPLX_FC_${driverSafe}.jpg`,
          fileUrl: rawLicenseImg ? (resolveMediaUrl(rawLicenseImg) || rawLicenseImg) : '',
          icon: 'badge',
          mandatory: true,
          verificationStatus: rawLicenseImg ? 'Verified' : 'Pending',
          scope: vLicense && vLicense !== 'Chưa khai báo' ? `Số GPLX: ${vLicense} (Hạng FC)` : `Tài xế: ${vDriver || 'Chưa khai báo'}`,
          isDriverDoc: true,
        }
      )
    }

    const seenIds = new Set()
    const merged = []
    for (const d of [...orderDocs, ...fleetDocs]) {
      if (!seenIds.has(d.id)) {
        seenIds.add(d.id)
        merged.push(d)
      }
    }
    return merged
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

  const fetchBookings = async () => {
    setLoading(true)
    try {
      await manifestPortSyncService.fetchRemoteSyncedManifests().catch(() => { })

      // Trích xuất thông tin đội xe từ các đơn ePort trong cơ sở dữ liệu để đồng bộ trên tất cả thiết bị
      try {
        const eportRes = await serviceOrdersApi.list({ pageSize: 50 }).catch(() => ({ items: [] }))
        const allEportItems = eportRes?.items || []
        const ordersToSync = allEportItems
          .filter(ord => !['REJECTED', 'CANCELLED', 'DRAFT'].includes(String(ord?.status || '').toUpperCase()))
          .slice(0, 15)
        const rejectedOrders = allEportItems
          .filter(ord => ['REJECTED', 'CANCELLED'].includes(String(ord?.status || '').toUpperCase()))
          .slice(0, 15)
        const detailedOrders = await Promise.all(
          ordersToSync.map(async (ord) => {
            try {
              if (!ord?.content?.delivery?.trips && ord?.id) {
                return await serviceOrdersApi.get(ord.id).catch(() => ord)
              }
              return ord
            } catch {
              return ord
            }
          })
        )
        const detailedRejected = await Promise.all(
          rejectedOrders.map(async (ord) => {
            try {
              if (!ord?.containers?.length && !ord?.content?.lines?.length && ord?.id) {
                return await serviceOrdersApi.get(ord.id).catch(() => ord)
              }
              return ord
            } catch {
              return ord
            }
          })
        )
        // Gỡ xe & tài xế khỏi Gate Booking nếu toàn bộ đơn ePort của container đó đã bị từ chối/hủy
        for (const rejOrd of detailedRejected) {
          try {
            await manifestPortSyncService.unassignRejectedOrderFromGateBookings(rejOrd, detailedOrders, { silent: true })
          } catch { }
        }
        // Duyệt từ đơn cũ nhất đến đơn mới nhất để thông tin đội xe của đơn mới nhất luôn được ưu tiên
        for (const orderToSync of [...detailedOrders].reverse()) {
          try {
            manifestPortSyncService.saveAllOrderFleets(orderToSync)
          } catch { }
        }
      } catch (e) { }

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
            requestedGate: 'Gate 1',
            gateFee: 300000,
            handlingFee: 200000,
            totalFee: 500000,
            paymentStatus: 'Paid',
            gateCapacity: { gate: 'Gate 1', current: 10, max: 20, status: 'Available' },
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
      await yardReservationStore.getReservationsAsync().catch(() => {})
      const blocks = await expressApiClient.get('/yard/blocks')
      setBlocksData(blocks)
      if (blocks.length > 0) {
        const firstBlock = blocks.find(block => block.blockCode === 'C01') || blocks[0]
        const firstCode = firstBlock.blockCode || firstBlock.description
        setSelectedBlock(firstCode)
        setSelectedBay(firstBlock.slots?.length ? String(Math.min(...firstBlock.slots.map(slot => slot.bay))).padStart(2, '0') : '')
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
    const pending = sourceList.filter(b => b.status === 'Pending' || b.status === 'WaitingTransport').length
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

  // Danh sách các Ngày có container để lọc
  const availableDates = useMemo(() => {
    const dates = new Set()
    manifestGeneratedBookings.forEach(b => {
      const d = extractBookingDate(b)
      if (d) dates.add(d)
    })
    return Array.from(dates).sort()
  }, [manifestGeneratedBookings])

  // Danh sách các Tàu có container để lọc (Tách riêng theo chiều Nhập khẩu & Xuất khẩu)
  const availableVessels = useMemo(() => {
    const vessels = new Map()
    manifestGeneratedBookings.forEach(b => {
      const vName = b.vesselName
      if (!vName) return
      const normDir = (String(b.direction || '').toUpperCase() === 'IMPORT' || b.operation === 'Pickup') ? 'IMPORT' : 'EXPORT'
      const dirLabel = normDir === 'IMPORT' ? 'Nhập khẩu' : 'Xuất khẩu'
      const mKey = b.sourceManifestNumber || b.sourceManifestId || `${vName}___${normDir}`
      if (!vessels.has(mKey)) {
        vessels.set(mKey, {
          key: mKey,
          vesselName: vName,
          voyageNumber: b.voyageNumber || '',
          direction: normDir,
          label: `${vName}${b.voyageNumber ? ` (${b.voyageNumber})` : ''} · ${dirLabel}`,
          manifestNumber: mKey,
        })
      }
    })
    return Array.from(vessels.values())
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

  // Tự động đối chiếu với đơn Dịch Vụ ePort khi mở chi tiết Lịch Hẹn Cổng
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
        const preferred = items.find(x => !['REJECTED', 'CANCELLED'].includes(String(x?.status || '').toUpperCase())) || items[0]
        let orderObj = preferred
        try {
          const detail = await serviceOrdersApi.get(preferred.id)
          setEportDetail(detail)
          orderObj = detail
        } catch {
          setEportDetail(preferred)
        }
        try {
          manifestPortSyncService.saveAllOrderFleets(orderObj)
        } catch (e) {
          console.warn('Lỗi lưu fleet từ eport order:', e)
        }
      } else {
        // Chỉ khớp khi và chỉ khi đơn đã thực sự được khách hàng gửi về cho Cảng
        setEportOrders([])
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
    if (!eportListItems.length || (!manifestGeneratedBookings.length && !bookings.length)) return

    let cancelled = false
    const runValidation = async () => {
      const nextMap = {}
      let anyBookingUpdated = false
      let anyOrderRejected = false

      for (const order of [...eportListItems].reverse()) {
        if (cancelled) break
        if (order.status === 'DRAFT' || order.status === 'CANCELLED') continue

        let detail = order
        if (!detail.containers?.length && !detail.content?.source && detail.id) {
          try {
            detail = await serviceOrdersApi.get(order.id)
          } catch {
            detail = order
          }
        }

        const containerTokens = [
          ...(detail.containers || []).map(c => String(c.containerNumber || '').trim().toUpperCase()),
          ...((String(order.sourceLabel || '').toUpperCase().match(/[A-Z]{4}\d{7}/g)) || []),
        ].filter(Boolean)

        const allGatesMap = new Map()
        for (const b of [...manifestGeneratedBookings, ...bookings]) {
          const cId = String(b.containerId || '').trim().toUpperCase()
          if (cId && !allGatesMap.has(cId)) allGatesMap.set(cId, b)
        }
        const allGates = Array.from(allGatesMap.values())
        let matchedBookings = allGates.filter(b =>
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

        const cleanBookingCode = (s) => String(s || '').trim().replace(/[-_]\d{4}$/, '').replace(/[-_]\d{3,5}$/, '')

        // Nếu containerTokens trống nhưng có mã B/L hoặc mã Booking, tìm các booking cổng cùng B/L hoặc Booking đó
        if (matchedBookings.length === 0 && (orderBl || orderBk)) {
          matchedBookings = allGates.filter(b => {
            const blExpected = String(b.cargoDeclarationId || b.billOfLading || '').trim().toUpperCase()
            const bkExpected = cleanBookingCode(b.bookingNumber || b.bookingNo || b.id || '').toUpperCase()
            const cleanOrderBk = cleanBookingCode(orderBk).toUpperCase()
            const blMatch = orderBl && blExpected && blExpected !== 'N/A' && (orderBl.includes(blExpected) || blExpected.includes(orderBl))
            const bkMatch = cleanOrderBk && bkExpected && (cleanOrderBk.includes(bkExpected) || bkExpected.includes(cleanOrderBk))
            return blMatch || bkMatch
          })
        }

        let rejectReason = ''
        const isOrderImport = String(order.flow || detail.flow || '').toUpperCase() === 'IMPORT'
        let targetCompanyOnGate = ''
        if (matchedBookings.length === 0) {
          rejectReason = 'Cont không nằm trong danh sách'
        } else {
          // Kiểm tra xem có container nào trong đơn ePort bị thiếu trong danh sách Cảng không
          const foundContIds = new Set(matchedBookings.map(b => String(b.containerId || '').trim().toUpperCase()))
          const missingTokens = containerTokens.filter(t => !foundContIds.has(t))
          if (missingTokens.length > 0 && containerTokens.length > matchedBookings.length) {
            rejectReason = `Cont ${missingTokens[0]} không nằm trong danh sách Cảng`
          } else {
            const primary = matchedBookings[0]
            const blExpected = String(primary.cargoDeclarationId || primary.billOfLading || '').trim().toUpperCase()
            const bkExpected = cleanBookingCode(primary.bookingNumber || primary.bookingNo || primary.id || '').toUpperCase()
            const mfExpected = String(primary.sourceManifestNumber || '').trim().toUpperCase()
            const voyExpected = String(primary.voyageNumber || '').trim().toUpperCase()
            const orderVoy = String(detail.content?.source?.voyageNumber || detail.sourceSnapshot?.voyageNumber || '').trim().toUpperCase()
            const cleanOrderBk = cleanBookingCode(orderBk).toUpperCase()

            const blMatches = !blExpected || blExpected === 'N/A' ||
              (orderBl && (orderBl.includes(blExpected) || blExpected.includes(orderBl))) ||
              refTokens.some(t => t.includes(blExpected) || blExpected.includes(t))

            const bkMatches = !bkExpected ||
              (cleanOrderBk && (cleanOrderBk.includes(bkExpected) || bkExpected.includes(cleanOrderBk))) ||
              (mfExpected && ((cleanOrderBk && (cleanOrderBk.includes(mfExpected) || mfExpected.includes(cleanOrderBk))) || refTokens.some(t => t.includes(mfExpected) || mfExpected.includes(t)))) ||
              (voyExpected && orderVoy && voyExpected === orderVoy) ||
              (containerTokens.length > 0 && missingTokens.length === 0) ||
              refTokens.some(t => cleanBookingCode(t).toUpperCase().includes(bkExpected) || bkExpected.includes(cleanBookingCode(t).toUpperCase()))

            const refMatches = blMatches || bkMatches
            // ĐỐI CHIẾU THỐNG NHẤT THEO LOẠI HÀNG (từ thông tin Vận đơn Hãng tàu):
            // - Hàng xuất: Người gửi hàng (Shipper / Booking)
            // - Hàng nhập: Người nhận hàng (Consignee)
            targetCompanyOnGate = isOrderImport
              ? (primary.consignee || primary.company)
              : (primary.shipper || primary.company)
            const companyMatches = companiesMatch(order.companyName, targetCompanyOnGate)

            if (!refMatches) {
              rejectReason = 'Sai mã vận đơn / booking'
            } else if (!companyMatches) {
              rejectReason = isOrderImport
                ? 'Sai người nhận hàng'
                : 'Sai người gửi hàng'
            }
          }
        }

        const containerIdsList = matchedBookings.map(b => b.containerId)
        if (rejectReason) {
          // Chỉ ghi nhận cảnh báo trên giao diện, KHÔNG tự động gọi API từ chối ngầm trong background
          nextMap[order.id] = {
            status: 'AUTO_REJECTED',
            reason: rejectReason,
            detailReason: isOrderImport
              ? `Sai Người nhận hàng (ePort: ${order.companyName || '—'} ≠ Consignee: ${targetCompanyOnGate || '—'})`
              : `Sai Người gửi hàng (ePort: ${order.companyName || '—'} ≠ Shipper: ${targetCompanyOnGate || '—'})`,
            ...(containerIdsList.length > 0 ? { containerIds: containerIdsList } : {}),
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
          nextMap[order.id] = {
            status: 'REJECTED',
            reason: manualReason || 'Đơn đã bị từ chối.',
            ...(containerIdsList.length > 0 ? { containerIds: containerIdsList } : {}),
          }
        } else if (matchedBookings.length > 0) {
          const primary = matchedBookings[0]
          nextMap[order.id] = {
            status: 'MATCHED',
            bookingId: primary.id,
            bookingIds: matchedBookings.map(b => b.id),
            containerId: primary.containerId,
            containerIds: matchedBookings.map(b => b.containerId),
            orderNumber: order.number,
            containerCount: matchedBookings.length,
          }

          for (const mb of matchedBookings) {
            const syncKey = `sync:${order.id}:${mb.id}`
            if (!processedEportOrderRef.current.has(syncKey)) {
              processedEportOrderRef.current.add(syncKey)
              const extractedFleet = manifestPortSyncService.extractFleetFromOrder(detail, mb.containerId)
              const isOrdPaid = String(order.paymentStatus || '').toUpperCase() === 'PAID'
              const isOrdApproved = String(order.status || '').toUpperCase() === 'APPROVED' || String(order.approvalStatus || '').toUpperCase() === 'APPROVED' || isOrdPaid
              const targetStatus = isOrdPaid
                ? 'Ready'
                : (isOrdApproved ? (mb.status === 'Ready' ? 'Ready' : 'Approved') : (mb.status === 'WaitingTransport' ? 'Pending' : mb.status))
              const needsBookingUpdate =
                !mb.transportSubmitted ||
                mb.eportOrderId !== order.id ||
                mb.status !== targetStatus ||
                (extractedFleet?.plate && mb.licensePlate !== extractedFleet.plate) ||
                (extractedFleet?.driver && mb.driverName !== extractedFleet.driver)
              if (needsBookingUpdate) {
                manifestPortSyncService.updateGeneratedGateBookingStatus(mb.id, {
                  transportSubmitted: true,
                  status: targetStatus,
                  company: order.companyName || mb.company,
                  contactName: detail.content?.contactName || mb.contactName,
                  phone: extractedFleet?.phone || detail.content?.contactPhone || mb.phone,
                  email: detail.content?.contactEmail || mb.email,
                  ...(extractedFleet?.plate ? { licensePlate: extractedFleet.plate, vehiclePlate: extractedFleet.plate, suggestedPlate: extractedFleet.plate } : {}),
                  ...(extractedFleet?.driver ? { driverName: extractedFleet.driver, suggestedDriver: extractedFleet.driver } : {}),
                  ...(extractedFleet?.license ? { licenseNumber: extractedFleet.license } : {}),
                  ...(extractedFleet?.trailer ? { trailerPlate: extractedFleet.trailer } : {}),
                  ...(extractedFleet?.driverSnapshot ? { driverSnapshot: extractedFleet.driverSnapshot } : {}),
                  ...(extractedFleet?.vehicle ? { vehicleSnapshot: extractedFleet.vehicle } : {}),
                  ...(extractedFleet?.appointmentStart ? { appointmentStart: extractedFleet.appointmentStart, eta: extractedFleet.appointmentStart } : {}),
                  ...(extractedFleet?.appointmentEnd ? { appointmentEnd: extractedFleet.appointmentEnd } : {}),
                  eportOrderId: order.id,
                  eportOrderNumber: order.number,
                  eportMatched: true,
                  transportSentAt: mb.transportSentAt || new Date().toLocaleString('vi-VN'),
                })
                manifestPortSyncService.recordTransportSubmissionAlert({
                  id: mb.id,
                  containerId: mb.containerId,
                  company: order.companyName || mb.company,
                  licensePlate: mb.licensePlate || 'Từ đơn ePort ' + order.number,
                  driverName: detail.content?.contactName || mb.driverName || 'Đã xác nhận từ ePort',
                  operation: mb.operation,
                  billOfLading: mb.cargoDeclarationId || mb.billOfLading || '',
                  submittedAt: new Date().toLocaleString('vi-VN'),
                })
                anyBookingUpdated = true
              }
            }
          }
        }
      }

      if (!cancelled) {
        setEportValidationMap(prev => ({ ...prev, ...nextMap }))
        if (anyBookingUpdated) {
          setManifestSyncVersion(v => v + 1)
          setBillAlerts(getBillAlerts())
          showToast('✅ Đơn ePort khớp thông tin! Đã tự động cập nhật Đơn vị vận tải và sẵn sàng phê duyệt cổng.')
        }
        if (anyOrderRejected) {
          loadAllEportRequests()
        }
      }
    }

    runValidation()
    return () => { cancelled = true }
  }, [eportListItems, manifestGeneratedBookings, bookings])

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
        checks: [],
        containerBreakdown: [],
        matchedGateBookings: [selectedBooking],
        totalContainers: 1
      }
    }

    const eportFlow = String(activeOrder.flow || activeOrder.content?.flow || '').toUpperCase()
    const eportContainers = (activeOrder.containers || []).map(c => String(c.containerNumber || '').trim().toUpperCase())
    const regexMatches = (String(activeOrder.sourceLabel || '').toUpperCase().match(/[A-Z]{4}\d{7}/g)) || []
    const allEportContList = Array.from(new Set([...eportContainers, ...regexMatches])).filter(Boolean)

    // Tìm TẤT CẢ các container phía Cổng thuộc về cùng booking / ePort order này (tách biệt rõ chiều Nhập & Xuất)
    const allGatesMap = new Map()
    for (const b of [...manifestGeneratedBookings, ...bookings]) {
      const cId = String(b.containerId || '').trim().toUpperCase()
      if (!cId) continue
      const bDir = (String(b.direction || '').toUpperCase() === 'IMPORT' || b.operation === 'Pickup') ? 'IMPORT' : 'EXPORT'
      const mapKey = `${cId}___${bDir}`
      if (!allGatesMap.has(mapKey) || b.id === selectedBooking.id) {
        allGatesMap.set(mapKey, b)
      }
    }
    const allGates = Array.from(allGatesMap.values())
    const matchedGateBookings = allGates.filter(b => {
      const bDir = (String(b.direction || '').toUpperCase() === 'IMPORT' || b.operation === 'Pickup') ? 'IMPORT' : 'EXPORT'
      if (bDir !== gateFlow) return false
      const bCont = String(b.containerId || '').trim().toUpperCase()
      if (allEportContList.length > 0) {
        return Boolean(bCont && allEportContList.includes(bCont))
      }
      if (b.id === selectedBooking.id || b.containerId === selectedBooking.containerId) return true
      if (activeOrder.id && b.eportOrderId === activeOrder.id) return true
      // Cùng chung mã Vận đơn (B/L), cùng Bản khai và cùng chiều Xuất/Nhập
      if (selectedBooking.cargoDeclarationId && selectedBooking.cargoDeclarationId !== 'N/A' &&
        b.cargoDeclarationId === selectedBooking.cargoDeclarationId &&
        (b.sourceManifestNumber === selectedBooking.sourceManifestNumber || b.vesselName === selectedBooking.vesselName)) {
        return true
      }
      // Cùng chung mã Booking
      if (selectedBooking.bookingNumber && b.bookingNumber === selectedBooking.bookingNumber) {
        return true
      }
      return false
    })

    // Ma trận đối chiếu chi tiết từng container giữa Cổng ↔ ePort
    const allKnownConts = Array.from(new Set([
      ...allEportContList,
      ...matchedGateBookings.map(b => String(b.containerId || '').trim().toUpperCase())
    ])).filter(Boolean)

    const containerBreakdown = allKnownConts.map(contNo => {
      const inEport = allEportContList.length === 0 || allEportContList.includes(contNo)
      const gateItem = matchedGateBookings.find(b => String(b.containerId || '').trim().toUpperCase() === contNo)
      const inGate = Boolean(gateItem)

      // 1. Tìm B/L phía Cổng cho container này
      let gateBl = String(
        gateItem?.billOfLading ||
        (gateItem?.cargoDeclarationId && gateItem?.cargoDeclarationId !== 'N/A' ? gateItem?.cargoDeclarationId : '') ||
        gateItem?.blNumber ||
        ''
      ).trim()
      if (!gateBl) {
        gateBl = selectedManifestInfo?.blNumber || selectedBooking.billOfLading || ''
      }

      // 2. Tìm B/L phía ePort cho container này
      let eportBl = ''
      const eCont = (activeOrder.containers || []).find(c => String(c.containerNumber || '').trim().toUpperCase() === contNo)
      if (eCont?.blNumber) {
        eportBl = eCont.blNumber
      }
      if (!eportBl && activeOrder.content?.lines) {
        const line = activeOrder.content.lines.find(l => {
          const num = l.declaration?.containerNumber || l.containerNumber || l.sourceContainerId
          return String(num || '').trim().toUpperCase() === contNo
        })
        if (line?.blNumber || line?.declaration?.blNumber) {
          eportBl = line.blNumber || line.declaration.blNumber
        }
      }
      if (!eportBl) {
        eportBl = activeOrder.content?.source?.blNumber || activeOrder.sourceSnapshot?.blNumber || ''
      }

      const isSubmittedToPort = Boolean(
        activeOrder &&
        activeOrder.status &&
        activeOrder.status !== 'DRAFT'
      )
      const normBl = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
      const blMatch = !gateBl || !eportBl
        || gateBl.toUpperCase() === eportBl.toUpperCase()
        || normBl(gateBl) === normBl(eportBl)
        || gateFlow === 'EXPORT'
        || (normBl(gateBl).startsWith('BLVNDAD') && normBl(eportBl).startsWith('BLVNDAD'))
        || inEport

      const isMatch = isSubmittedToPort && inEport && inGate && (blMatch || isSubmittedToPort)

      return {
        containerNumber: contNo,
        inEport,
        inGate,
        gateBl,
        eportBl,
        blMatch,
        isSubmittedToPort,
        isMatch,
        gateBooking: gateItem || null,
        gateBookingId: gateItem?.id || null,
        yardSlot: gateItem?.autoYardSlot
          ? `Block ${gateItem.autoYardSlot.blockCode} · Bay ${gateItem.autoYardSlot.bay || '02'} (T${gateItem.autoYardSlot.tier || 1}-R${gateItem.autoYardSlot.row || 1})`
          : (gateItem ? 'Chờ xếp bãi' : '—'),
        containerType: gateItem?.containerType || '40HC',
        operation: gateItem?.operation === 'Pickup' ? 'Lấy cont' : 'Hạ cont',
        transportSubmitted: Boolean(gateItem?.transportSubmitted),
        status: gateItem?.status || 'Chưa tạo',
      }
    })

    const gateContSet = new Set(matchedGateBookings.map(b => String(b.containerId || '').trim().toUpperCase()).filter(Boolean))
    const eportContSet = new Set(allEportContList.map(c => String(c || '').trim().toUpperCase()).filter(Boolean))

    const isContListIdentical = gateContSet.size > 0 && eportContSet.size > 0 &&
      gateContSet.size === eportContSet.size &&
      [...gateContSet].every(c => eportContSet.has(c))

    const containerMatch = isContListIdentical || (
      allKnownConts.length > 0
        ? containerBreakdown.every(c => c.inEport && c.inGate)
        : (allEportContList.length === 0 || allEportContList.includes(String(selectedBooking.containerId).toUpperCase()))
    )

    const flowMatch = !eportFlow || eportFlow === gateFlow
    // Bỏ 4 số cuối của mã Booking (ví dụ: BK-MM2601S-9101 -> BK-MM2601S, BK-MM2601S-9205 -> BK-MM2601S) để đối chiếu thống nhất
    const stripTrailingDigits = (s) => {
      if (!s) return ''
      return String(s).trim().replace(/[-_]\d{4}$/, '').replace(/[-_]\d{3,5}$/, '')
    }

    const rawGateBookingNo = String(
      selectedBooking.bookingNumber ||
      selectedBooking.bookingNo ||
      (String(selectedBooking.id || '').toUpperCase().startsWith('BK-') ? selectedBooking.id : '') ||
      selectedManifestInfo?.bookingNo ||
      ''
    ).trim()
    const rawEportBookingNo = String(
      activeOrder.content?.source?.bookingNumber ||
      activeOrder.sourceSnapshot?.bookingNumber ||
      (eportFlow === 'EXPORT' ? (activeOrder.sourceLabel || activeOrder.content?.source?.referenceNumber) : '') ||
      ''
    ).trim()

    const normCode = (s) => String(s || '').toUpperCase().replace(/^BK[-_]?/i, '').replace(/[^A-Z0-9]/g, '')
    const gateBookingNo = stripTrailingDigits(rawGateBookingNo)
    const eportBookingNo = stripTrailingDigits(rawEportBookingNo)
    const gateManifestNo = String(selectedBooking.sourceManifestNumber || selectedManifestInfo?.manifestNumber || '').trim()
    const gateVoyageNo = String(selectedBooking.voyageNumber || selectedManifestInfo?.voyageNumber || '').trim()
    const eportVoyageNo = String(activeOrder.content?.source?.voyageNumber || activeOrder.sourceSnapshot?.voyageNumber || '').trim()

    const bookingMatch = !gateBookingNo || !eportBookingNo
      || normCode(gateBookingNo) === normCode(eportBookingNo)
      || normCode(gateBookingNo).includes(normCode(eportBookingNo))
      || normCode(eportBookingNo).includes(normCode(gateBookingNo))
      || eportBookingNo.toUpperCase().includes(gateBookingNo.toUpperCase())
      || gateBookingNo.toUpperCase().includes(eportBookingNo.toUpperCase())
      || Boolean(gateManifestNo && (
        normCode(gateManifestNo) === normCode(eportBookingNo) ||
        normCode(gateManifestNo).includes(normCode(eportBookingNo)) ||
        normCode(eportBookingNo).includes(normCode(gateManifestNo))
      ))
      || Boolean(gateVoyageNo && eportVoyageNo && normCode(gateVoyageNo) === normCode(eportVoyageNo))
      || isContListIdentical

    const refTag = gateManifestNo || eportBookingNo
    const isManifestCodeMatch = Boolean(bookingMatch && gateBookingNo && eportBookingNo && normCode(gateBookingNo) !== normCode(eportBookingNo))

    const isCurrentImport = gateFlow === 'IMPORT' || eportFlow === 'IMPORT'
    // ĐỐI CHIẾU THỐNG NHẤT THEO LOẠI HÀNG (từ thông tin Vận đơn Hãng tàu):
    // - Hàng xuất: Người gửi hàng (Shipper / Booking)
    // - Hàng nhập: Người nhận hàng (Consignee)
    const gateExpectedCompany = isCurrentImport
      ? (selectedBooking.consignee || selectedBooking.company || '—')
      : (selectedBooking.shipper || selectedBooking.company || '—')

    const eportCompany = String(activeOrder.companyName || '').trim()
    const normTextMatch = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const companyMatch = !eportCompany || !gateExpectedCompany ||
      gateExpectedCompany === '—' ||
      companiesMatch(activeOrder.companyName, gateExpectedCompany) ||
      normTextMatch(eportCompany).includes(normTextMatch(gateExpectedCompany).slice(0, 8)) ||
      normTextMatch(gateExpectedCompany).includes(normTextMatch(eportCompany).slice(0, 8))

    const sortedGateConts = Array.from(new Set(matchedGateBookings.map(b => b.containerId).filter(Boolean))).sort().join(', ')
    const sortedEportConts = Array.from(new Set(allEportContList.filter(Boolean))).sort().join(', ')

    const checks = [
      {
        label: 'Số Lượng & Danh Sách Container',
        gateVal: `${matchedGateBookings.length} Cont (${sortedGateConts || selectedBooking.containerId || '—'})`,
        eportVal: `${allEportContList.length > 0 ? allEportContList.length : (matchedGateBookings.length || 1)} Cont (${sortedEportConts || activeOrder.sourceLabel || '—'})`,
        ok: containerMatch,
        isContainerRow: true
      },
      {
        label: 'Luồng hàng / Nghiệp vụ',
        gateVal: gateFlow === 'IMPORT' ? 'Hàng nhập (IMPORT)' : 'Hàng xuất (EXPORT)',
        eportVal: eportFlow === 'IMPORT' ? 'Hàng nhập (IMPORT)' : (eportFlow === 'EXPORT' ? 'Hàng xuất (EXPORT)' : 'Chưa chọn'),
        ok: flowMatch
      },
      {
        label: isCurrentImport ? 'Mã Lệnh eDO / Vận đơn B/L' : 'Mã Booking',
        gateVal: isManifestCodeMatch && refTag ? `${gateBookingNo} (${refTag})` : (gateBookingNo || (isCurrentImport ? 'Chưa có eDO' : 'Chưa có Booking')),
        eportVal: isManifestCodeMatch ? `${gateBookingNo} (${eportBookingNo})` : (eportBookingNo || (isCurrentImport ? 'Chưa nhập eDO' : 'Chưa nhập Booking')),
        ok: bookingMatch
      },
      {
        label: isCurrentImport ? 'Doanh nghiệp nhận hàng (Consignee)' : 'Doanh nghiệp gửi hàng (Shipper / Booking)',
        gateVal: isCurrentImport
          ? `${gateExpectedCompany} ${selectedBooking.consignee ? '(Consignee trên B/L)' : ''}`
          : `${gateExpectedCompany} ${selectedBooking.shipper ? '(Shipper trên B/L)' : ''}`,
        eportVal: `${activeOrder.companyName || 'Doanh nghiệp đăng ký'}${isCurrentImport ? ' (Đơn vị nhận ePort)' : ' (Đơn vị gửi ePort)'}`,
        ok: companyMatch,
        note: isCurrentImport ? 'Đối chiếu Người nhận hàng (Consignee) giữa Vận đơn Hãng tàu ↔ Đơn ePort' : 'Đối chiếu Người gửi hàng (Shipper) giữa Vận đơn Hãng tàu ↔ Đơn ePort'
      }
    ]

    const isSubmittedToPort = Boolean(
      activeOrder &&
      activeOrder.status &&
      activeOrder.status !== 'DRAFT'
    )
    const allDataMatch = isSubmittedToPort && containerMatch && flowMatch && bookingMatch && companyMatch
    const allReady = allDataMatch

    return {
      matched: allDataMatch,
      allReady,
      status: allReady ? 'matched' : (!isSubmittedToPort ? 'waiting' : 'mismatch'),
      badgeText: allReady
        ? `Khớp 2 bên · Đủ điều kiện duyệt (${matchedGateBookings.length} container trong Booking)`
        : !isSubmittedToPort
          ? 'Chưa gửi về Cảng (Chờ khách hàng hoàn tất gửi đăng ký ePort)'
          : 'Có sai lệch dữ liệu 2 bên',
      order: activeOrder,
      checks,
      matchedGateBookings,
      containerBreakdown,
      totalContainers: matchedGateBookings.length,
    }
  }, [selectedBooking, selectedManifestInfo, isImportBooking, eportDetail, eportOrders, manifestGeneratedBookings, bookings])

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
    } catch { }

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
      ; (bookings || []).forEach(b => {
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

  // Danh sách toàn bộ các container trong Booking / Đơn hàng này (để xem từng cont và tính tổng 1 Bill, tách biệt rõ chiều Nhập & Xuất)
  const orderContainersList = useMemo(() => {
    if (!selectedBooking) return []
    const selectedDir = isImportBooking ? 'IMPORT' : 'EXPORT'
    const allGatesMap = new Map()
    for (const b of [...manifestGeneratedBookings, ...bookings]) {
      const cId = String(b.containerId || '').trim().toUpperCase()
      if (!cId) continue
      const bDir = (String(b.direction || '').toUpperCase() === 'IMPORT' || b.operation === 'Pickup') ? 'IMPORT' : 'EXPORT'
      if (bDir !== selectedDir) continue
      if (!allGatesMap.has(cId) || b.id === selectedBooking.id) {
        allGatesMap.set(cId, b)
      }
    }
    const allGates = Array.from(allGatesMap.values())

    // 1. Quét theo containerBreakdown nếu có đơn ePort với từ 2 container trở lên của cùng 1 đơn
    const isEportMultiCont = Boolean(
      eportComparison?.containerBreakdown &&
      eportComparison.containerBreakdown.length > 1 &&
      (eportComparison.matchedGateBookings?.some(b => b.containerId === selectedBooking.containerId) ||
        eportComparison.containerBreakdown.some(c => c.containerNumber === selectedBooking.containerId))
    )
    if (isEportMultiCont) {
      return eportComparison.containerBreakdown.map((item, idx) => {
        const found = allGates.find(b => String(b.containerId || '').trim().toUpperCase() === item.containerNumber)
        const orderFleet = manifestPortSyncService.extractFleetFromOrder(eportComparison?.order, item.containerNumber) ||
          manifestPortSyncService.getOrderFleet(item.containerNumber)
        const fallbackSlot = `Block ${['D01', 'A01', 'D01', 'D01'][idx % 4]} · Bay 0${2 + idx * 2} (T1-R01)`
        const isRf = (item.containerType || found?.containerType || '').includes('RF') || found?.isReefer
        const vPlate = orderFleet?.plate || getGateBookingVehicle(found) || (found?.licensePlate && found?.licensePlate !== 'Chưa gán xe' ? found.licensePlate : null)
        const vDriver = orderFleet?.driver || getGateBookingDriver(found) || (found?.driverName && found?.driverName !== 'Chưa điều phối' ? found.driverName : null)
        return {
          ...(found || {}),
          id: found?.id || `BK-${(selectedBooking.voyageNumber || 'EG2605W').replace(/[^A-Z0-9]/gi, '')}-${item.containerNumber.slice(-4)}`,
          realId: found?.realId || found?.id,
          isFromVesselManifest: Boolean(found?.isFromVesselManifest ?? selectedBooking.isFromVesselManifest ?? true),
          sourceManifestId: found?.sourceManifestId || selectedBooking.sourceManifestId,
          sourceManifestNumber: found?.sourceManifestNumber || selectedBooking.sourceManifestNumber,
          containerId: item.containerNumber,
          containerType: item.containerType || found?.containerType || '20GP',
          company: found?.company || selectedBooking.company || '',
          vesselName: found?.vesselName || selectedBooking.vesselName || '',
          voyageNumber: found?.voyageNumber || selectedBooking.voyageNumber || '',
          cargoDeclarationId: item.gateBl || item.eportBl || found?.billOfLading || selectedBooking.cargoDeclarationId || '',
          billOfLading: item.gateBl || item.eportBl || found?.billOfLading || selectedBooking.billOfLading || '',
          operation: item.operation || found?.operation || selectedBooking.operation || 'Pickup',
          yardSlot: item.yardSlot && item.yardSlot !== '—' ? item.yardSlot : fallbackSlot,
          autoYardSlot: found?.autoYardSlot || { fullLocation: fallbackSlot, slotName: fallbackSlot },
          requestedGate: found?.requestedGate || selectedBooking.requestedGate || 'Gate 1',
          eta: found?.eta || selectedBooking.eta || '',
          status: found?.status || selectedBooking.status || 'Pending',
          licensePlate: vPlate,
          driverName: vDriver,
          phone: orderFleet?.phone || found?.phone || '',
          trailerPlate: orderFleet?.trailer || found?.trailerPlate || '',
          licenseNumber: orderFleet?.license || found?.licenseNumber || '',
          driverSnapshot: orderFleet?.driverSnapshot || found?.driverSnapshot,
          vehicleSnapshot: orderFleet?.vehicle || found?.vehicleSnapshot,
          isReefer: isRf,
          fee: isRf ? 669600 : 583200,
        }
      })
    }

    // 2. Nếu không phải lô từ 2 container trở lên của cùng 1 công ty -> Đơn lẻ 1 container, không gộp Bill
    return [{
      ...selectedBooking,
      fee: bookingTariffSummary.total || 583200,
      yardSlot: reservedSlot?.slotName || selectedBooking.autoYardSlot?.slotName || selectedBooking.yardSlot || 'Block A01 · Bay 02',
      licensePlate: getGateBookingVehicle(selectedBooking),
      driverName: getGateBookingDriver(selectedBooking)
    }]
  }, [selectedBooking, eportComparison, manifestGeneratedBookings, bookings, reservedSlot])

  // Tổng tiền cả 4 container gộp thành 1 Bill duy nhất
  const totalBillAmount = useMemo(() => {
    if (!orderContainersList.length) return 583200
    return orderContainersList.reduce((acc, c) => acc + (c.fee || 583200), 0)
  }, [orderContainersList])

  const totalBillFormatted = useMemo(() => {
    return `${totalBillAmount.toLocaleString('vi-VN')} VNĐ`
  }, [totalBillAmount])

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
    setSelectedSlotDetails(null)
  }, [vesselContainersPopup])

  // Lọc danh sách container theo Tàu được chọn / Tìm kiếm tàu / Từ khóa / Trạng thái / Công ty vận tải
  const filteredBookings = useMemo(() => {
    const vq = vesselSearch.toLowerCase().trim()
    return manifestGeneratedBookings.filter(b => {
      // 1. Lọc riêng theo Tàu & Bản khai được chọn (selectedVesselFilter) — Tách biệt rõ chiều Nhập & Xuất
      if (selectedVesselFilter !== 'All') {
        const sv = String(selectedVesselFilter).toLowerCase().trim()
        const bDir = (String(b.direction || '').toUpperCase() === 'IMPORT' || b.operation === 'Pickup') ? 'import' : 'export'
        const bKey = `${(b.vesselName || '').toLowerCase()}___${bDir}`
        const matchesSelectedVessel =
          (b.sourceManifestNumber && b.sourceManifestNumber.toLowerCase() === sv) ||
          (b.sourceManifestId && b.sourceManifestId.toLowerCase() === sv) ||
          bKey === sv
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
        } else if (statusFilter === 'Approved') {
          matchesStatus = b.status === 'Approved' || b.status === 'Ready'
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

      let matchesDate = true
      if (dateFilter !== 'All') {
        matchesDate = extractBookingDate(b) === dateFilter
      }

      return matchesSearch && matchesStatus && matchesOp && matchesGate && matchesCompany && matchesDate
    })
  }, [manifestGeneratedBookings, selectedVesselFilter, vesselSearch, searchQuery, statusFilter, operationFilter, gateFilter, companyFilter, dateFilter])


  // Phân trang danh sách Tàu cập cảng
  const pagedVessels = useMemo(() => {
    const start = (vesselPage - 1) * vesselPageSize
    return filteredVessels.slice(start, start + vesselPageSize)
  }, [filteredVessels, vesselPage, vesselPageSize])

  // Gom nhóm container theo Ngày, Chuyến Tàu & Chiều Xuất/Nhập riêng biệt (không gộp chung Xuất và Nhập vào 1 bảng)
  const manifestBookingsByCompany = useMemo(() => {
    const groups = {}
    filteredBookings.forEach((b) => {
      const dateStr = extractBookingDate(b)
      const vesselName = b.vesselName || 'Tàu Cập Cảng'
      const voyageNumber = b.voyageNumber || ''
      const shippingLine = b.shippingLine || ''
      const direction = (String(b.direction || '').toUpperCase() === 'IMPORT' || b.operation === 'Pickup') ? 'IMPORT' : 'EXPORT'
      const manifestKey = b.sourceManifestId || b.sourceManifestNumber || direction
      const groupKey = `${dateStr}___${vesselName}___${voyageNumber}___${direction}___${manifestKey}`

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          companyName: groupKey, // Alias để giữ nguyên logic toggle collapse
          date: dateStr,
          vesselName,
          voyageNumber,
          shippingLine,
          direction,
          sourceManifestNumber: b.sourceManifestNumber || '',
          items: [],
        }
      }
      groups[groupKey].items.push(b)
    })

    return Object.values(groups).map((g) => ({
      ...g,
      vesselList: `${g.vesselName}${g.voyageNumber ? ` (${g.voyageNumber})` : ''}`,
      pendingCount: g.items.filter(x => x.status === 'Pending' || x.status === 'Under Review' || !x.transportSubmitted).length,
      approvedCount: g.items.filter(x => x.status === 'Approved').length,
    }))
  }, [filteredBookings])

  // Phân trang danh sách Container theo Ngày & Chuyến Tàu
  const pagedCompanies = useMemo(() => {
    const start = (companyPage - 1) * companyPageSize
    return manifestBookingsByCompany.slice(start, start + companyPageSize)
  }, [manifestBookingsByCompany, companyPage, companyPageSize])

  // Gom nhóm container theo từng Vận đơn (B/L) cho tàu đang xem
  // Danh sách Container hiển thị trong Popup khi bấm Cái Phễu (Đồng bộ qua module quy hoạch bãi chuẩn yardPlanningRules)
  const popupContainerList = useMemo(() => {
    if (!vesselContainersPopup) return []
    const vKey = vesselContainersPopup.manifestNumber || vesselContainersPopup.manifestId
    const popupDir = (String(vesselContainersPopup.direction || '').toUpperCase() === 'IMPORT' || vesselContainersPopup.direction === 'Nhập khẩu') ? 'IMPORT' : 'EXPORT'
    const matched = manifestGeneratedBookings.filter(b => {
      const bDir = (String(b.direction || '').toUpperCase() === 'IMPORT' || b.operation === 'Pickup') ? 'IMPORT' : 'EXPORT'
      if (vKey && (b.sourceManifestNumber === vKey || b.sourceManifestId === vKey)) return true
      return b.vesselName === vesselContainersPopup.vesselName && bDir === popupDir
    })

    const sourceConts = matched.length > 0
      ? matched
      : (vesselContainersPopup.containers || []).map((c, idx) => ({
          ...c,
          id: `cont-${idx}`,
          containerId: c.containerNumber,
          containerType: c.isoType || '40HC',
          cargoDescription: c.cargoDescription || 'Hàng hóa thông quan',
          blNumber: c.blNumber || 'BL-VNDAD',
          sealNumber: c.sealNumber || 'SL-88412',
          customsStatus: c.customsStatus || 'Đã thông quan',
          requestedGate: 'Gate 1',
          transportSubmitted: false,
          status: 'WaitingTransport',
          isRf: Boolean(c.isReefer) || (c.isoType || '').includes('RF') || (c.tempRequired || '').includes('-'),
          isReefer: Boolean(c.isReefer) || (c.isoType || '').includes('RF') || (c.tempRequired || '').includes('-'),
          tempRequired: c.tempRequired || ((Boolean(c.isReefer) || (c.isoType || '').includes('RF')) ? '-18.0°C' : null),
          grossWeightKg: Number(c.grossWeightKg || 24000),
          isDg: (c.dgClass || '').includes('IMO') || (c.dgClass || '').includes('Class') || c.isDG,
          dgClass: c.dgClass || (c.isDG ? 'IMO Class 3' : null)
        }))

    const otherBookings = manifestGeneratedBookings.filter(b => !matched.includes(b))
    const { plannedContainers } = planAllManifestContainers(sourceConts, popupDir, otherBookings)
    return plannedContainers
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
  const handleConfirmApproval = async (overrideTargets = null) => {
    if (!selectedBooking) return
    setLoading(true)
    try {
      const realId = selectedBooking.realId || selectedBooking.id

      // Ưu tiên trích xuất đội xe thực tế từ đơn ePort đã gửi (khách hàng chọn xe & tài xế theo đơn)
      const activeEportOrder = eportComparison?.order || eportDetail || eportOrders[0]
      if (activeEportOrder) {
        try {
          manifestPortSyncService.saveAllOrderFleets(activeEportOrder)
        } catch (e) {
          console.warn('Lỗi lưu fleet từ đơn ePort:', e)
        }
      }
      const orderFleet = manifestPortSyncService.extractFleetFromOrder(activeEportOrder, selectedBooking.containerId) ||
        manifestPortSyncService.getOrderFleet(selectedBooking.containerId) ||
        manifestPortSyncService.getOrderFleet(selectedBooking.id) ||
        manifestPortSyncService.getOrderFleet(selectedBooking.bookingCode)

      const pool = (typeof TRANSPORT_COMPANIES_POOL !== 'undefined' && Array.isArray(TRANSPORT_COMPANIES_POOL)) ? TRANSPORT_COMPANIES_POOL : []
      const carrierProfile =
        pool.find(p => p.companyName === selectedBooking.company) ||
        pool[0]

      const isFakeApprovalPlate = p => !p || ['Chưa gán xe', 'Chưa gán', 'Chưa điều phối', '47AB-294.69', '43C-567.89'].includes(p)
      const isFakeApprovalDriver = d => !d || ['Chưa điều phối', 'Chưa có tài xế', 'TRẦN VĂN TÙNG', 'Nguyễn Văn Minh'].includes(d)

      const assignedPlate = orderFleet?.plate ||
        (!isFakeApprovalPlate(selectedBooking.licensePlate)
          ? selectedBooking.licensePlate
          : (!isFakeApprovalPlate(selectedBooking.suggestedPlate) ? selectedBooking.suggestedPlate : null))
      const assignedTrailer = orderFleet?.trailer ||
        (selectedBooking.trailerPlate !== '47R-012.88' ? selectedBooking.trailerPlate : null) ||
        (selectedBooking.suggestedTrailer !== '47R-012.88' ? selectedBooking.suggestedTrailer : null) ||
        null
      const assignedDriver = orderFleet?.driver ||
        (!isFakeApprovalDriver(selectedBooking.driverName)
          ? selectedBooking.driverName
          : (!isFakeApprovalDriver(selectedBooking.suggestedDriver) ? selectedBooking.suggestedDriver : null))
      const assignedLicense = orderFleet?.license ||
        (selectedBooking.licenseNumber !== 'FC-782910' ? selectedBooking.licenseNumber : null) ||
        (selectedBooking.suggestedLicense !== 'FC-782910' ? selectedBooking.suggestedLicense : null) ||
        null
      const assignedPhone = orderFleet?.phone || selectedBooking.phone || carrierProfile?.phone || null

      const targets = (Array.isArray(overrideTargets) && overrideTargets.length > 0)
        ? overrideTargets
        : (batchApproveList && batchApproveList.length > 0)
          ? batchApproveList
          : (orderContainersList && orderContainersList.length > 0 ? orderContainersList : [selectedBooking])

      const nowIso = new Date().toISOString()
      const approvedAtStr = new Date().toLocaleString('vi-VN')
      const storedFees = JSON.parse(localStorage.getItem('NEXUSPORT_STORAGE_FEES') || '{}')
      const storedBills = JSON.parse(localStorage.getItem('NEXUSPORT_PORT_BILLS') || '{}')

      const totalBillToPush = totalBillAmount || (583200 * targets.length)
      const totalBillStr = `${totalBillToPush.toLocaleString('vi-VN')} VNĐ`
      const isGuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || '').trim())
      const enrichedTargets = []
      // Mỗi lần duyệt chỉ có MỘT hóa đơn: hóa đơn tổng của booking. Dòng chi tiết từng container mang cùng số hóa đơn này.
      const totalBillNumber = `BILL-${selectedBooking.bookingCode || selectedBooking.id}-TOTAL`

      for (const targetBooking of targets) {
        const tCont = targetBooking.containerId
        const isTargetPrimary = targetBooking.id === selectedBooking.id || targetBooking.containerId === selectedBooking.containerId
        const tOrderFleet = manifestPortSyncService.extractFleetFromOrder(activeEportOrder, tCont) ||
          manifestPortSyncService.getOrderFleet(tCont) ||
          manifestPortSyncService.getOrderFleet(targetBooking.id) ||
          manifestPortSyncService.getOrderFleet(targetBooking.bookingCode)

        const carrierProfileForTarget = pool.find(p => p.companyName === targetBooking.company) || carrierProfile

        const tPlate = tOrderFleet?.plate ||
          (!isFakeApprovalPlate(targetBooking.licensePlate) && (targetBooking.containerId === selectedBooking.containerId || targetBooking.licensePlate !== assignedPlate)
            ? targetBooking.licensePlate
            : (!isFakeApprovalPlate(targetBooking.suggestedPlate) ? targetBooking.suggestedPlate : null))
        const tTrailer = tOrderFleet?.trailer ||
          (targetBooking.trailerPlate !== '47R-012.88' ? targetBooking.trailerPlate : null) ||
          (targetBooking.suggestedTrailer !== '47R-012.88' ? targetBooking.suggestedTrailer : null) ||
          null
        const tDriver = tOrderFleet?.driver ||
          (!isFakeApprovalDriver(targetBooking.driverName) && (targetBooking.containerId === selectedBooking.containerId || targetBooking.driverName !== assignedDriver)
            ? targetBooking.driverName
            : (!isFakeApprovalDriver(targetBooking.suggestedDriver) ? targetBooking.suggestedDriver : null))
        const tLicense = tOrderFleet?.license ||
          (targetBooking.licenseNumber !== 'FC-782910' ? targetBooking.licenseNumber : null) ||
          (targetBooking.suggestedLicense !== 'FC-782910' ? targetBooking.suggestedLicense : null) ||
          null
        const tPhone = tOrderFleet?.phone || targetBooking.phone || carrierProfileForTarget?.phone || null

        const isManifestBk = Boolean(
          targetBooking.isFromVesselManifest ||
          selectedBooking.isFromVesselManifest ||
          !isGuid(targetBooking.realId || targetBooking.id)
        )

        const tDays = bookingStorageDays[targetBooking.id] || 7
        const tStorageCalc = calculatePortStorageFee(tDays, targetBooking.containerType)
        const tStorageFee = tStorageCalc.fee
        const tStorageData = {
          days: tDays,
          fee: tStorageFee,
          tierLabel: tStorageCalc.tier.label,
          containerType: targetBooking.containerType,
          containerLabel: tStorageCalc.containerLabel,
          approvedAt: nowIso,
          containerId: targetBooking.containerId,
          bookingCode: targetBooking.bookingCode || targetBooking.id
        }

        const tSlot = (isTargetPrimary && reservedSlot) ? reservedSlot : (targetBooking.autoYardSlot || reservedSlot)
        const resolvedYardSlot = tSlot ? (tSlot.slotName || `Block ${tSlot.blockCode} · ${tSlot.bayDisplay || 'Bay 02'} · T${tSlot.tier || 1}-R${tSlot.row || 1}`) : (targetBooking.yardSlot || 'Đã cấp vị trí bãi')
        const targetFee = targetBooking.fee || (targetBooking.isReefer ? 669600 : 583200)
        const tPortBill = {
          billNumber: totalBillNumber,
          kind: 'ITEM', // dòng chi tiết của hóa đơn tổng, không hiển thị như một hóa đơn riêng
          bookingId: targetBooking.id,
          realId: targetBooking.realId || targetBooking.id,
          containerId: targetBooking.containerId,
          company: targetBooking.company,
          billOfLading: targetBooking.billOfLading || (targetBooking.cargoDeclarationId && targetBooking.cargoDeclarationId !== 'N/A' ? targetBooking.cargoDeclarationId : '') || selectedManifestInfo?.blNumber || '',
          direction: isImportBooking ? 'IMPORT' : 'EXPORT',
          yardSlot: resolvedYardSlot,
          tariff: bookingTariffSummary,
          items: bookingTariffSummary.items || [],
          subtotal: bookingTariffSummary.subtotal || 0,
          vat: bookingTariffSummary.vat || 0,
          total: targetFee,
          totalFormatted: `${targetFee.toLocaleString('vi-VN')} VNĐ`,
          shiftingFee: activeShiftingFee?.fee || 0,
          storageFee: tStorageFee,
          approvedAt: nowIso,
          status: 'SENT_TO_CARRIER'
        }

        // Lưu order fleet trước để đảm bảo mọi luồng đồng bộ đọc đúng xe & tài xế riêng của từng container
        if (tPlate || tDriver) {
          manifestPortSyncService.saveOrderFleet([targetBooking.containerId, targetBooking.id, targetBooking.bookingCode], {
            plate: tPlate,
            driver: tDriver,
            phone: tPhone,
            license: tLicense,
            trailer: tTrailer,
            ...(tOrderFleet?.documents ? { documents: tOrderFleet.documents } : {}),
            ...(tOrderFleet?.driverSnapshot ? { driverSnapshot: tOrderFleet.driverSnapshot } : {}),
            ...(tOrderFleet?.vehicle ? { vehicleSnapshot: tOrderFleet.vehicle, vehicle: tOrderFleet.vehicle } : {}),
          })
        }

        if (isManifestBk) {
          manifestPortSyncService.submitTransportBookingToPort(targetBooking.id, {
            licensePlate: tPlate,
            trailerPlate: tTrailer,
            driverName: tDriver,
            licenseNumber: tLicense,
            phone: tPhone,
          })
          await manifestPortSyncService.updateGeneratedGateBookingStatus(targetBooking.id, {
            status: 'Approved',
            approvedAt: approvedAtStr,
            approvedBy: 'Dispatcher',
            timelineStep: 4,
            transportSubmitted: true,
            licensePlate: tPlate,
            trailerPlate: tTrailer,
            driverName: tDriver,
            suggestedPlate: tPlate,
            suggestedDriver: tDriver,
            licenseNumber: tLicense,
            phone: tPhone,
            vehiclePlate: tPlate,
            vehicleStatus: 'Available',
            driverStatus: 'Available',
            portBill: tPortBill,
            storageData: tStorageData,
            ...(tOrderFleet?.appointmentStart || activeEportOrder?.content?.plannedAt
              ? {
                  appointmentStart: tOrderFleet?.appointmentStart || activeEportOrder?.content?.plannedAt,
                  eta: tOrderFleet?.appointmentStart || activeEportOrder?.content?.plannedAt,
                }
              : {}),
            ...(tOrderFleet?.appointmentEnd ? { appointmentEnd: tOrderFleet.appointmentEnd } : {}),
            ...(activeEportOrder?.id ? { eportOrderId: activeEportOrder.id, eportOrderNumber: activeEportOrder.number } : {}),
            ...(tOrderFleet?.documents ? { eportDocuments: tOrderFleet.documents, documents: tOrderFleet.documents } : {}),
            ...(tOrderFleet?.driverSnapshot ? { driverSnapshot: tOrderFleet.driverSnapshot } : {}),
            ...(tOrderFleet?.vehicle ? { vehicleSnapshot: tOrderFleet.vehicle } : {}),
          })
        } else {
          await bookingService.approveBooking(targetBooking.realId || targetBooking.id).catch(() => { })
        }

        storedFees[targetBooking.id] = tStorageData
        if (targetBooking.containerId) storedFees[targetBooking.containerId] = tStorageData
        storedBills[targetBooking.id] = tPortBill
        if (targetBooking.containerId) storedBills[targetBooking.containerId] = tPortBill

        manifestPortSyncService.dismissTransportSubmissionAlert(targetBooking.id)

        enrichedTargets.push({
          ...targetBooking,
          licensePlate: tPlate,
          trailerPlate: tTrailer,
          driverName: tDriver,
          licenseNumber: tLicense,
          phone: tPhone,
          yardSlot: resolvedYardSlot,
          fee: targetFee,
        })

        window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', {
          detail: { type: 'PORT_BILL_SENT', bookingId: targetBooking.id, containerId: targetBooking.containerId, bill: tPortBill }
        }))
      }

      // Lưu 1 Bill Tổng duy nhất đại diện cho toàn bộ các container trong Booking
      const consolidatedBill = {
        billNumber: totalBillNumber,
        kind: 'TOTAL',
        bookingId: selectedBooking.id,
        vesselName: selectedBooking.vesselName || 'MAERSK MC-KINNEY MOLLER',
        voyageNumber: selectedBooking.voyageNumber || 'MM-2601S',
        company: selectedBooking.company || 'Bien Dong Logistics - Nexus Logistics',
        containerCount: enrichedTargets.length,
        containers: enrichedTargets.map(t => ({
          containerId: t.containerId,
          containerType: t.containerType,
          billOfLading: t.billOfLading || t.cargoDeclarationId,
          plate: t.licensePlate,
          driver: t.driverName,
          yardSlot: t.yardSlot,
          fee: t.fee || (t.isReefer ? 669600 : 583200)
        })),
        total: totalBillToPush,
        totalFormatted: totalBillStr,
        approvedAt: nowIso,
        status: 'SENT_TO_CARRIER'
      }
      storedBills[totalBillNumber] = consolidatedBill

      try {
        localStorage.setItem('NEXUSPORT_STORAGE_FEES', JSON.stringify(storedFees))
        localStorage.setItem('NEXUSPORT_PORT_BILLS', JSON.stringify(storedBills))
        setBillAlerts(getBillAlerts())
        setManifestSyncVersion(v => v + 1)
        window.dispatchEvent(new Event('storage'))

        const targetEport = eportComparison?.order || eportOrders[0]
        if (targetEport?.id && (targetEport.pricingStatus === 'AWAITING' || targetEport.approvalStatus === 'PENDING' || targetEport.status === 'PENDING_APPROVAL')) {
          try {
            const eportDetailLive = await serviceOrdersApi.get(targetEport.id).catch(() => targetEport)
            await serviceOrdersApi.billingResult(targetEport.id, {
              requestId: crypto.randomUUID(),
              expectedVersion: eportDetailLive.version || targetEport.version || 1,
              status: 'APPROVED',
              reference: totalBillNumber,
              total: totalBillToPush,
              currency: 'VND',
              reason: `Dispatcher đã duyệt toàn bộ ${enrichedTargets.length} container trong Booking và xuất 1 Bill Tổng duy nhất (${totalBillStr})`,
              sourceDocumentsChecked: true,
              sourceEvidenceReference: selectedBooking.cargoDeclarationId || selectedBooking.id
            })
          } catch (syncErr) {
            console.warn('Could not push billingResult to eport order', syncErr)
          }
        }
      } catch (e) {
        console.warn('Could not save storage fee / port bill', e)
      }

      const updatedIds = new Set(enrichedTargets.map(t => t.id))
      const updatedConts = new Set(enrichedTargets.map(t => t.containerId))
      const targetByContOrId = new Map()
      for (const t of enrichedTargets) {
        if (t.id) targetByContOrId.set(t.id, t)
        if (t.containerId) targetByContOrId.set(String(t.containerId).trim().toUpperCase(), t)
      }

      const updatedBooking = {
        ...selectedBooking,
        status: 'Approved',
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
        approvedAt: approvedAtStr,
        approvedBy: 'Dispatcher',
      }

      setSelectedBooking(updatedBooking)
      setManifestSyncVersion(v => v + 1)
      setBookings(prev => prev.map(b => {
        const matched = targetByContOrId.get(b.id) || targetByContOrId.get(String(b.containerId || '').trim().toUpperCase())
        if (!matched && !updatedIds.has(b.id) && !updatedConts.has(b.containerId)) return b
        return {
          ...b,
          status: 'Approved',
          timelineStep: 4,
          transportSubmitted: true,
          licensePlate: matched?.licensePlate ?? b.licensePlate,
          trailerPlate: matched?.trailerPlate ?? b.trailerPlate,
          driverName: matched?.driverName ?? b.driverName,
          licenseNumber: matched?.licenseNumber ?? b.licenseNumber,
          phone: matched?.phone ?? b.phone,
          vehiclePlate: matched?.licensePlate ?? b.vehiclePlate,
          vehicleStatus: 'Available',
          driverStatus: 'Available',
          approvedAt: approvedAtStr,
          approvedBy: 'Dispatcher',
        }
      }))

      showToast(
        enrichedTargets.length > 1
          ? `🟢 Đã duyệt toàn bộ ${enrichedTargets.length} container trong Booking & Gửi 1 Bill Tổng (${totalBillStr}) sang Đơn vị Vận tải!`
          : `🟢 Đã duyệt Booking ${selectedBooking.id}${assignedPlate ? ` (${assignedPlate}${assignedDriver ? ` · ${assignedDriver}` : ''})` : ''}!`
      )
      setShowApproveModal(false)
      setBatchApproveList([])
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
      const targetList = (batchApproveList && batchApproveList.length > 0)
        ? batchApproveList
        : (eportComparison?.matchedGateBookings && eportComparison.matchedGateBookings.length > 0)
          ? eportComparison.matchedGateBookings
          : [selectedBooking]

      // Bên Cổng (Gate Booking): GIỮ NGUYÊN trạng thái điều phối xe & tài xế.
      // Chỉ đổi trạng thái bên Cổng khi và chỉ khi bấm "Duyệt cả 3 Cont & Gửi 1 Bill Tổng"!

      // Xử lý từ chối đơn Dịch Vụ ePort (DV-...) tương ứng và gỡ xe & tài xế nếu không còn đơn hợp lệ nào khác
      const eportOrderId = eportComparison?.order?.id || selectedEportOrderId || eportDetail?.id || (eportOrders?.length > 0 ? eportOrders[0].id : null)
      if (eportOrderId) {
        let rejectedDetail = eportComparison?.order || eportDetail || eportOrders.find(o => o.id === eportOrderId) || { id: eportOrderId }
        try {
          const detail = eportComparison?.order || await serviceOrdersApi.get(eportOrderId)
          rejectedDetail = detail || rejectedDetail
          const version = detail?.version ?? 1
          if (detail?.allowedActions?.includes('REJECT')) {
            await serviceOrdersApi.action(eportOrderId, {
              requestId: crypto.randomUUID(),
              expectedVersion: version,
              action: 'REJECT',
              reason: rejectionReason,
            })
          } else if (detail?.allowedActions?.includes('RECEIVE')) {
            const received = await serviceOrdersApi.action(eportOrderId, {
              requestId: crypto.randomUUID(),
              expectedVersion: version,
              action: 'RECEIVE',
              reason: 'Tiếp nhận để xử lý từ chối',
            })
            const nextVer = received?.version ?? (version + 1)
            await serviceOrdersApi.action(eportOrderId, {
              requestId: crypto.randomUUID(),
              expectedVersion: nextVer,
              action: 'REJECT',
              reason: rejectionReason,
            })
          }
        } catch (err) {
          console.warn('Lỗi gọi API reject đơn ePort:', err)
        }

        // Gỡ bỏ xe & tài xế khỏi Gate Booking (localStorage + PostgreSQL) cho các container chỉ gắn với đơn đã bị từ chối này
        try {
          const freshListRes = await serviceOrdersApi.list({ pageSize: 50 }).catch(() => null)
          const freshItems = freshListRes?.items || eportListItems || []
          const remainingCandidates = freshItems
            .filter(o => o && o.id !== eportOrderId && !['REJECTED', 'CANCELLED', 'DRAFT'].includes(String(o.status || '').toUpperCase()))
            .slice(0, 15)
          const remainingActive = await Promise.all(
            remainingCandidates.map(async (o) => {
              if (!o?.content?.delivery?.trips && o?.id) {
                return await serviceOrdersApi.get(o.id).catch(() => o)
              }
              return o
            })
          )
          // Đảm bảo danh sách container trong targetList cũng được truyền kèm để gỡ triệt để kể cả khi detail chưa có mảng containers
          const fallbackConts = (targetList || []).map(t => ({ containerNumber: t.containerId })).filter(x => x.containerNumber)
          const orderToUnassign = {
            ...rejectedDetail,
            containers: (rejectedDetail.containers && rejectedDetail.containers.length > 0) ? rejectedDetail.containers : fallbackConts,
          }
          const didUnassign = await manifestPortSyncService.unassignRejectedOrderFromGateBookings(orderToUnassign, remainingActive)
          if (didUnassign) {
            const rejectedIds = new Set((targetList || []).map(t => t.id))
            const rejectedConts = new Set((targetList || []).map(t => String(t.containerId || '').trim().toUpperCase()))
            const activeContSet = new Set()
            remainingActive.forEach(ao => {
              ; (ao?.containers || []).forEach(c => {
                const n = String(c?.containerNumber || c || '').trim().toUpperCase()
                if (n) activeContSet.add(n)
              })
                ; (ao?.content?.lines || []).forEach(l => {
                  const n = String(l?.declaration?.containerNumber || l?.containerNumber || '').trim().toUpperCase()
                  if (n) activeContSet.add(n)
                })
            })
            setBookings(prev => prev.map(b => {
              const bCont = String(b.containerId || '').trim().toUpperCase()
              if (!(rejectedIds.has(b.id) || (bCont && rejectedConts.has(bCont))) || (bCont && activeContSet.has(bCont))) {
                return b
              }
              return {
                ...b,
                status: 'WaitingTransport',
                transportSubmitted: false,
                licensePlate: null,
                vehiclePlate: null,
                suggestedPlate: null,
                trailerPlate: null,
                driverName: null,
                suggestedDriver: null,
                licenseNumber: null,
                phone: null,
                driverSnapshot: null,
                vehicleSnapshot: null,
                eportOrderId: null,
                eportOrderNumber: null,
                portBill: null,
                portBillPaid: false,
                paymentStatus: 'Unpaid',
              }
            }))
          }
        } catch (unassignErr) {
          console.warn('Lỗi gỡ xe/tài xế sau khi từ chối đơn:', unassignErr)
        }

        setEportValidationMap(prev => ({
          ...prev,
          [eportOrderId]: {
            status: 'REJECTED',
            reason: rejectionReason,
            containerIds: (targetList || []).map(t => t.containerId).filter(Boolean),
          }
        }))

        setEportListItems(prev => prev.map(o => {
          if (o.id === eportOrderId || (eportOrderId && String(o.id).includes(eportOrderId))) {
            return {
              ...o,
              status: 'REJECTED',
              rejectionReason,
            }
          }
          return o
        }))
        loadAllEportRequests()
      }

      setManifestSyncVersion(v => v + 1)
      fetchBookings()

      showToast(`🔴 Đã từ chối đơn Dịch vụ ePort & gỡ xe/tài xế khỏi container (nếu không còn đơn hợp lệ khác). Lý do: ${rejectionReason}`)
      setShowRejectModal(false)
      setShowEportSyncPopup(false)
      setShowContainerDetailModal(false)
      setBatchApproveList([])
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

  const handleSlotReservationConfirm = async (slotInfo) => {
    try {
      const newTier = Number(slotInfo.tier) || 1
      const bayStr = String(slotInfo.bay).padStart(2, '0')
      const rowStr = String(slotInfo.row).padStart(2, '0')
      const coordinate = `${slotInfo.blockCode}-${bayStr}-${rowStr}-${newTier}`

      // Đồng bộ 4 bên
      await manifestPortSyncService.syncYardSlotAcrossAll({
        containerNumber: selectedBooking?.containerId,
        bookingCode: selectedBooking?.id,
        manifestId: selectedBooking?.sourceManifestId || selectedBooking?.manifestId,
        newSlotCoordinate: coordinate,
        reason: 'Điều độ viên thay đổi vị trí bãi tại Gate Dispatching',
        vehiclePlate: selectedBooking?.licensePlate,
        driverName: selectedBooking?.driverName,
        company: selectedBooking?.company,
        vesselName: selectedBooking?.vesselName,
        voyageNumber: selectedBooking?.voyageNumber,
      })

      const updatedSlot = {
        ...(reservedSlot || selectedBooking?.autoYardSlot || {}),
        ...slotInfo,
        bay: bayStr,
        row: rowStr,
        tier: newTier,
        tierCode: String(newTier),
        zoneCode: (slotInfo.blockCode || 'A')[0],
        zoneName: `Khu ${(slotInfo.blockCode || 'A')[0]} · Block ${slotInfo.blockCode}`,
        autoAssigned: false,
        coordinate,
      }
      setReservedSlot(updatedSlot)
      setSelectedZone((slotInfo.blockCode || 'A')[0])
      setSelectedBlock(slotInfo.blockCode || 'A01')

      const updatedBooking = {
        ...selectedBooking,
        yardSlot: coordinate,
        autoYardSlot: updatedSlot,
        reservedSlot: updatedSlot,
        slotInfo: updatedSlot,
        yardBlockCode: slotInfo.blockCode,
        yardBay: Number(slotInfo.bay),
        yardRow: Number(slotInfo.row),
        yardTier: newTier,
      }
      setSelectedBooking(updatedBooking)
      setBookings(prev => prev.map(b => {
        const isMatch = (selectedBooking?.id && b.id === selectedBooking.id) ||
                        (selectedBooking?.containerId && b.containerId === selectedBooking.containerId)
        return isMatch ? { ...b, ...updatedBooking } : b
      }))

      setYardResVersion(v => v + 1)
      setManifestSyncVersion(v => v + 1)

      if (slotInfo.slotId && slotInfo.slotId.length > 10) {
        await apiClient.post(`/v1/Yard/Slots/${slotInfo.slotId}/Reserve`).catch(() => { })
      } else {
        await yardOperationService.reserveSlot({ posId: slotInfo.posId }).catch(() => { })
      }
      handleReserveSlot(slotInfo.slotId, slotInfo.blockCode, slotInfo)
      fetchYardMap()
      showToast(`🟢 Đã chuyển & đồng bộ container ${selectedBooking?.containerId || ''} sang Block ${slotInfo.blockCode} (${slotInfo.bayDisplay || `Bay ${slotInfo.bay}`}, Tầng ${newTier}, Hàng ${slotInfo.row}) cho cả 4 bên và lịch tài xế!`)
    } catch (err) {
      showToast(`❌ Không thể giữ chỗ: ${err.message}`, 'error')
    }
  }

  return (
    <div className="epc epo-page flex flex-col gap-5 relative min-h-screen">

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-carbon text-white px-5 py-3.5 rounded-2xl shadow-2xl text-xs font-extrabold flex items-center gap-3 z-[110] animate-in fade-in slide-in-from-top-3 border border-signal-orange/60">
          <span className="material-symbols-outlined text-signal-orange text-lg">notifications_active</span>
          <span>{toastMessage}</span>
        </div>
      )}

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

      {/* ── THANH TAB CHUYỂN ĐỔI DANH MỤC (VIBE ePORT SEGMENTED PILLS) ── */}
      <div className="rounded-[15px] border border-[#e3e8ed] bg-[#eaf0f5] p-1.5 flex flex-wrap gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveListType('vessel')}
          className={`px-4 py-2.5 rounded-[10px] text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeListType === 'vessel'
            ? 'bg-white text-[#b94717] border border-[#e2e5e9] shadow-xs'
            : 'text-[#68798c] hover:text-[#172638] hover:bg-white/50'
            }`}
        >
          <span className="material-symbols-outlined text-base">directions_boat</span>
          <span>Danh Sách Tàu (e-Manifest)</span>
          <span className={`px-2 py-0.5 text-[11px] rounded-md font-mono ${activeListType === 'vessel' ? 'bg-[#fff0e7] text-[#b94717]' : 'bg-[#dbe4ed]/90 text-[#6a7c8d]'
            }`}>
            {syncedManifestList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveListType('truck')}
          className={`px-4 py-2.5 rounded-[10px] text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeListType === 'truck'
            ? 'bg-white text-[#b94717] border border-[#e2e5e9] shadow-xs'
            : 'text-[#68798c] hover:text-[#172638] hover:bg-white/50'
            }`}
        >
          <span className="material-symbols-outlined text-base">calendar_month</span>
          <span>Container Theo Ngày &amp; Chuyến Tàu</span>
          <span className={`px-2 py-0.5 text-[11px] rounded-md font-mono ${activeListType === 'truck' ? 'bg-[#fff0e7] text-[#b94717]' : 'bg-[#dbe4ed]/90 text-[#6a7c8d]'
            }`}>
            {filteredBookings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveListType('eport')}
          className={`px-4 py-2.5 rounded-[10px] text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeListType === 'eport'
            ? 'bg-white text-[#b94717] border border-[#e2e5e9] shadow-xs'
            : 'text-[#68798c] hover:text-[#172638] hover:bg-white/50'
            }`}
        >
          <span className="material-symbols-outlined text-base">assignment_turned_in</span>
          <span>Danh Sách Đơn Dịch Vụ ePort</span>
          <span className={`px-2 py-0.5 text-[11px] rounded-md font-mono ${activeListType === 'eport' ? 'bg-[#fff0e7] text-[#b94717]' : 'bg-[#dbe4ed]/90 text-[#6a7c8d]'
            }`}>
            {eportListTotal}
          </span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
            {/* ───────────────────────────────────────────────────────────── */}
      {/* ── NỘI DUNG TAB 1: DANH SÁCH CONTAINER CHIA THEO CÔNG TY VẬN TẢI ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeListType === 'truck' && (
        <BookingsScheduleTab
          kpiStats={kpiStats}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          operationFilter={operationFilter}
          setOperationFilter={setOperationFilter}
          selectedVesselFilter={selectedVesselFilter}
          setSelectedVesselFilter={setSelectedVesselFilter}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          availableVessels={availableVessels}
          availableDates={availableDates}
          manifestGeneratedBookings={manifestGeneratedBookings}
          filteredBookings={filteredBookings}
          manifestBookingsByCompany={manifestBookingsByCompany}
          pagedCompanies={pagedCompanies}
          companyPage={companyPage}
          setCompanyPage={setCompanyPage}
          companyPageSize={companyPageSize}
          setCompanyPageSize={setCompanyPageSize}
          isBookingTransportSubmitted={isBookingTransportSubmitted}
          isBookingApprovedOrBillSent={isBookingApprovedOrBillSent}
          isBookingRejectedOrUnassigned={isBookingRejectedOrUnassigned}
          getGateBookingVehicle={getGateBookingVehicle}
          getGateBookingDriver={getGateBookingDriver}
          eportListItems={eportListItems}
          eportValidationMap={eportValidationMap}
          onSelectBooking={handleSelectBooking}
          handleClearAllFilters={handleClearAllFilters}
          approvedVesselsList={approvedVesselsList}
        />
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── NỘI DUNG TAB ĐẦU TIÊN: DANH SÁCH TÀU CẬP CẢNG (BẢN KHAI MANIFEST) ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeListType === 'vessel' && (
        <VesselsManifestTab
          vesselKpiStats={vesselKpiStats}
          vesselSearch={vesselSearch}
          setVesselSearch={setVesselSearch}
          selectedVesselFilter={selectedVesselFilter}
          setSelectedVesselFilter={setSelectedVesselFilter}
          filteredVessels={filteredVessels}
          pagedVessels={pagedVessels}
          vesselPage={vesselPage}
          setVesselPage={setVesselPage}
          vesselPageSize={vesselPageSize}
          setVesselPageSize={setVesselPageSize}
          onOpenManifestDetail={(m) => setSelectedVesselManifest(m)}
          onOpenYardPlanning={(m) => setVesselContainersPopup(m)}
        />
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── NỘI DUNG TAB 3: TẤT CẢ ĐƠN DỊCH VỤ ePORT GỬI ĐẾN ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeListType === 'eport' && (
        <EportServiceOrdersTab
          eportListTotal={eportListTotal}
          eportListPage={eportListPage}
          setEportListPage={setEportListPage}
          eportListSearch={eportListSearch}
          setEportListSearch={setEportListSearch}
          eportListStatus={eportListStatus}
          setEportListStatus={setEportListStatus}
          eportListPaymentStatus={eportListPaymentStatus}
          setEportListPaymentStatus={setEportListPaymentStatus}
          eportListFlow={eportListFlow}
          setEportListFlow={setEportListFlow}
          eportListError={eportListError}
          eportListLoading={eportListLoading}
          eportListItems={eportListItems}
          eportValidationMap={eportValidationMap}
          manifestGeneratedBookings={manifestGeneratedBookings}
          bookings={bookings}
          serviceOrdersApi={serviceOrdersApi}
          loadAllEportRequests={loadAllEportRequests}
          onOpenOrder={(orderId) => setSelectedEportOrderId(orderId)}
          onOpenReconciliation={(order, matchedGate, validation) => {
            setEportDetail(order)
            const allGates = [...manifestGeneratedBookings, ...bookings]
            const dConts = (order.containers || []).map((x) => String(x.containerNumber || '').toUpperCase())
            const dBl = String(order.content?.source?.blNumber || order.sourceSnapshot?.blNumber || '').toUpperCase()
            const dBk = String(order.content?.source?.bookingNumber || order.sourceSnapshot?.bookingNumber || '').toUpperCase()
            const dRef = String(order.sourceLabel || order.content?.source?.referenceNumber || '').toUpperCase()
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
                bookingType: order.flow === 'IMPORT' ? 'Import' : 'Export',
                billOfLading: 'Chưa có trên Lịch Hẹn Cổng',
                bookingNumber: 'Chưa có trên Lịch Hẹn Cổng',
                company: 'Chưa có Lịch Hẹn Cổng khớp',
                status: 'Pending',
                _noGateBooking: true
              }
            setSelectedBooking(gate)
            setShowContainerDetailModal(false)
            setShowEportSyncPopup(true)
          }}
        />
      )}

      {/* ── MODAL POPUP KIỂM TRA VỊ TRÍ BÃI CONTAINER & SƠ ĐỒ BÃI TRỰC QUAN ── */}
      <VesselYardAllocationModal
        isOpen={Boolean(vesselContainersPopup)}
        vessel={vesselContainersPopup}
        onClose={() => setVesselContainersPopup(null)}
        containerList={popupContainerList}
        allBookings={manifestGeneratedBookings}
        yardInventory={yardInventory}
        blocksData={blocksData}
        onAcceptAndNext={(v, overrides, conts) => handleAcceptYardAndNext(v, overrides, conts || popupContainerList)}
      />

      {/* ── MODAL CHI TIẾT TÀU CẬP CẢNG & BẢN KHAI HÀNG HÓA E-MANIFEST ── */}
      <VesselManifestDetailModal
        isOpen={Boolean(selectedVesselManifest)}
        manifest={selectedVesselManifest}
        onClose={() => setSelectedVesselManifest(null)}
        onOpenYardPlanning={(m) => setVesselContainersPopup(m)}
      />

      {/* ── GATE BOOKING DETAIL MODAL ── */}
      <GateBookingDetailModal
        isOpen={Boolean(showContainerDetailModal && selectedBooking)}
        booking={selectedBooking}
        onClose={() => {
          setShowContainerDetailModal(false)
          if (!showEportSyncPopup && !selectedEportOrderId) {
            setSelectedBooking(null)
          }
        }}
        isImportBooking={isImportBooking}
        isBookingTransportSubmitted={isBookingTransportSubmitted}
        stripTrailingDigits={stripTrailingDigits}
        getGateBookingVehicle={getGateBookingVehicle}
        getGateBookingDriver={getGateBookingDriver}
        getBookingRealDocuments={getBookingRealDocuments}
        manifestPortSyncService={manifestPortSyncService}
        reservedSlot={reservedSlot}
        selectedManifestInfo={selectedManifestInfo}
        eportComparison={eportComparison}
        eportLoading={eportLoading}
        orderStatusLabels={orderStatusLabels}
        paymentStateLabel={paymentStateLabel}
        bookingTariffSummary={bookingTariffSummary}
        totalBillFormatted={totalBillFormatted}
        orderContainersList={orderContainersList}
        onOpenCarrier={() => setShowCarrierPopup(true)}
        onOpenContainerPopup={() => setShowContainerPopup(true)}
        onOpenVehicle={() => setShowVehiclePopup(true)}
        onOpenYardPicker={(zone) => {
          setSelectedZone(zone)
          setShowYardBigModal(true)
        }}
        onOpenDocuments={() => setShowDocumentsModal(true)}
        onOpenEportSync={() => setShowEportSyncPopup(true)}
        onOpenEportOrder={(orderId) => setSelectedEportOrderId(orderId)}
        onOpenTariff={() => setShowTariffPopup(true)}
      />

      {/* ── APPROVE CONFIRMATION MODAL ── */}
      <BookingApproveModal
        isOpen={Boolean(showApproveModal && selectedBooking)}
        booking={selectedBooking}
        batchList={batchApproveList}
        orderContainersList={orderContainersList}
        totalBillFormatted={totalBillFormatted}
        bookingTariffSummary={bookingTariffSummary}
        isImportBooking={isImportBooking}
        selectedManifestInfo={selectedManifestInfo}
        getGateBookingVehicle={getGateBookingVehicle}
        getGateBookingDriver={getGateBookingDriver}
        onClose={() => setShowApproveModal(false)}
        onConfirm={handleConfirmApproval}
      />

      {/* ── REJECT BOOKING MODAL ── */}
      <BookingRejectModal
        isOpen={Boolean(showRejectModal && selectedBooking)}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleConfirmRejection}
        rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason}
        rejectionNote={rejectionNote}
        setRejectionNote={setRejectionNote}
      />

      {/* ── POP-UP CHỌN BAY & SLOT TRỰC QUAN ── */}
      <YardSlotReservationModal
        isOpen={Boolean(pickerBlock)}
        onClose={() => setPickerBlock(null)}
        block={pickerBlock}
        booking={selectedBooking}
        currentReservation={reservedSlot}
        onConfirm={handleSlotReservationConfirm}
      />

      {/* ── DETAIL MODALS (COMPANY / VEHICLE / DRIVER) ── */}
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

      {/* ── POPUP XEM DANH SÁCH BỘ CHỨNG TỪ CONTAINER ── */}
      <BookingDocumentsModal
        isOpen={Boolean(showDocumentsModal && selectedBooking)}
        booking={selectedBooking}
        onClose={() => setShowDocumentsModal(false)}
        getBookingRealDocuments={getBookingRealDocuments}
        getDocTypeVi={getDocTypeVi}
        onOpenViewer={(idx) => {
          setDocViewerIndex(idx)
          setShowDocViewer(true)
        }}
      />

      {/* ── MODAL XEM PHÓNG TO HÌNH ẢNH CHỨNG TỪ ── */}
      <DocumentViewerModal
        isOpen={showDocViewer}
        onClose={() => setShowDocViewer(false)}
        documents={getBookingRealDocuments(selectedBooking)}
        initialIndex={docViewerIndex}
        booking={selectedBooking}
      />

      {/* ── POPUP XEM CHI TIẾT XE ĐẦU KÉO & TÀI XẾ ── */}
      <BookingVehicleModal
        isOpen={Boolean(showVehiclePopup && selectedBooking)}
        booking={selectedBooking}
        onClose={() => setShowVehiclePopup(false)}
        getGateBookingVehicle={getGateBookingVehicle}
        getGateBookingDriver={getGateBookingDriver}
        reservedSlot={reservedSlot}
      />

      {/* ── POPUP XEM CHI TIẾT CÔNG TY VẬN TẢI ── */}
      <BookingCarrierModal
        isOpen={Boolean(showCarrierPopup && selectedBooking)}
        booking={selectedBooking}
        onClose={() => setShowCarrierPopup(false)}
        isImportBooking={isImportBooking}
        isBookingTransportSubmitted={isBookingTransportSubmitted}
        getGateBookingVehicle={getGateBookingVehicle}
      />

      {/* ── POPUP XEM CHI TIẾT CONTAINER & TÀU BIỂN ── */}
      <BookingVesselModal
        isOpen={Boolean(showContainerPopup && selectedBooking)}
        booking={selectedBooking}
        onClose={() => setShowContainerPopup(false)}
        selectedManifestInfo={selectedManifestInfo}
      />

      {/* ── POPUP XEM CHI TIẾT BIỂU PHÍ DỊCH VỤ CẢNG ── */}
      <BookingTariffModal
        isOpen={Boolean(showTariffPopup && selectedBooking)}
        booking={selectedBooking}
        onClose={() => setShowTariffPopup(false)}
        bookingTariffSummary={bookingTariffSummary}
        activeShiftingFee={activeShiftingFee}
        activePortTariff={activePortTariff}
      />

      {/* ── POPUP LỚN: SƠ ĐỒ PHÂN KHU BÃI TIÊN SA ── */}
      <BookingYardBigModal
        isOpen={Boolean(showYardBigModal && selectedBooking)}
        booking={selectedBooking}
        onClose={() => setShowYardBigModal(false)}
        reservedSlot={reservedSlot}
        selectedZone={selectedZone}
        setSelectedZone={setSelectedZone}
        yardZones={YARD_ZONES}
        combinedBlocks={combinedBlocks}
        currentZoneBlocks={currentZoneBlocks}
        onSelectBlock={(block) => {
          setPickerBlock(block)
          setShowYardBigModal(false)
        }}
      />

      {/* ── POPUP ĐỐI CHIẾU THỐNG NHẤT 2 BÊN ── */}
      <ServicePortReconciliationModal
        isOpen={Boolean(showEportSyncPopup && selectedBooking)}
        booking={selectedBooking}
        onClose={() => setShowEportSyncPopup(false)}
        eportSearchTerm={eportSearchTerm}
        setEportSearchTerm={setEportSearchTerm}
        loadEportMatches={loadEportMatches}
        eportLoading={eportLoading}
        eportError={eportError}
        eportOrders={eportOrders}
        eportComparison={eportComparison}
        eportValidationMap={eportValidationMap}
        serviceOrdersApi={serviceOrdersApi}
        manifestPortSyncService={manifestPortSyncService}
        setEportDetail={setEportDetail}
        setManifestSyncVersion={setManifestSyncVersion}
        setSelectedEportOrderId={setSelectedEportOrderId}
        setActiveListType={setActiveListType}
        bookingTariffSummary={bookingTariffSummary}
        orderContainersList={orderContainersList}
        onReject={(targetList) => {
          setBatchApproveList(targetList)
          setShowRejectModal(true)
        }}
        onConfirmApproval={(targetList) => {
          setShowEportSyncPopup(false)
          setBatchApproveList(targetList)
          handleConfirmApproval(targetList)
        }}
      />

      {/* ── MODAL CHI TIẾT ĐƠN DỊCH VỤ ePORT ── */}
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
