import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Container,
  Copy,
  FileCheck2,
  FileText,
  FlaskConical,
  Layers3,
  Loader2,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import CatalogDialog from './CatalogDialog'
import BookingSourceSelect from './BookingSourceSelect'
import ServiceSourceEmailPanel from './ServiceSourceEmailPanel'
import { CustomsStep, DeliveryFields, ExportDeclarationFields } from './ServiceDeliveryFields'
import { ServiceDocumentsStep } from './ServiceDocumentsStep'
import { ServiceTripSummary } from './ServiceTripFleet'
import { FleetDocumentsReview } from './FleetDocumentsReview'
import { computeAutoSchedule } from './serviceSchedulePolicy'
import { blankDelivery, blankBuyer, validContainer } from './serviceDeliveryRules'
import './serviceDelivery.css'
import { createServiceDraftSamples } from './serviceDraftSamples'
import { labels } from './catalogApi'
import { draftDateTime, draftError, draftSession, serviceDraftKey, serviceDraftsApi } from './serviceDraftsApi'
import { serviceOrdersApi } from './serviceOrdersApi'
import { manifestPortSyncService } from '../../services/manifestPortSyncService'

const blankSource = () => {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  const defaultValidUntil = d.toISOString().slice(0, 10)
  return {
    bookingId: null,
    documentType: 'EDO',
    referenceNumber: '',
    bookingNumber: '',
    blNumber: '',
    validUntil: defaultValidUntil,
    bookingMode: 'LINKED',
    vesselName: '',
    voyageNumber: '',
  }
}

const containerId = row => row.sourceContainerId || row.id
const timeUnit = service => ['HOUR', 'DAY'].includes(service?.unit)
const serviceLine = service => ({
  serviceId: service.id,
  startsAt: '',
  endsAt: '',
  quantity: timeUnit(service) ? null : 1,
})
const compatible = (service, flow) => service.isActive && (service.direction === 'BOTH' || service.direction === flow)
const isReefer = row => /reefer|lạnh|frozen/i.test(row?.cargoType || '') || /^..R|RF|RH/i.test(row?.typeCode || row?.isoCode || '')
const clearlyDry = row => !isReefer(row) && /^..[GPTU]|DC|DR|GP|HC|OT|FR/i.test(row?.typeCode || row?.isoCode || '')

const localTime = value => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const utcTime = value => (value ? new Date(value).toISOString() : null)
const defaultPlannedAt = () => localTime(new Date(Date.now() + 2 * 3600000).toISOString())

const getContainerLockReason = (row, flow) => {
  if (!row) return 'Không tìm thấy container'
  if (row.isHeld) return 'Container đang bị giữ (Hold)'
  if (flow === 'EXPORT' && row.hasValidVgm === false) return 'Chưa có VGM hợp lệ'
  if (row.hasActiveOrder) return 'Container đang có lệnh dịch vụ mở'
  return null
}

const buildExportDeclaration = (row, booking) => {
  const vgm = Number(
    row.weightKg ??
    row.vgmKg ??
    row.grossWeightKg ??
    row.grossWeight ??
    row.vgm ??
    (row.declaration?.weightKg) ??
    24500
  ) || 24500

  const seal = row.sealNumber || (row.declaration?.sealNumber) || `SL-${row.containerNumber ? row.containerNumber.slice(-5) : '88412'}`
  const operator = row.operatorName || row.shippingLine || booking?.operatorName || booking?.shippingLine || 'ONE / MAERSK'
  const iso = row.typeCode || row.isoType || row.isoCode || (row.declaration?.isoCode) || '40HC'
  const pod = row.dischargePort || row.pod || booking?.dischargePort || booking?.portOfDischarge || 'Tokyo, Japan (JPTYO)'
  const finalDest = row.destinationPort || row.pod || booking?.destinationPort || booking?.portOfDischarge || pod

  return {
    containerNumber: row.containerNumber,
    operatorName: operator,
    isoCode: iso,
    cargoType:
      ({
        general: 'General',
        reefer: 'Reefer',
        frozen: 'Reefer',
        dangerous: 'Dangerous',
        dg: 'Dangerous',
        oog: 'OOG',
        oversized: 'OOG',
        overweight: 'OOG',
      })[(row.cargoType || '').toLowerCase()] || 'General',
    weightKg: vgm,
    tradeType: 'FOREIGN',
    sealNumber: seal,
    dischargePort: pod,
    destinationPort: finalDest,
    imoClass: row.dgClass || row.imoClass || '',
    unNumber: row.unNumber || '',
    temperature: row.targetTemperature ?? (isReefer(row) ? -18 : null),
    commodity: row.commodity || row.cargoDescription || (row.declaration?.commodity) || 'Hàng hóa xuất khẩu',
    blNumber: row.blNumber || booking?.blNumber || '',
  }
}

function useDebounced(value) {
  const [result, setResult] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setResult(value), 250)
    return () => clearTimeout(timer)
  }, [value])
  return result
}

function Field({ label, hint, children, wide = false }) {
  return (
    <label className={`epd-field ${wide ? 'epd-wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

function Loading({ children }) {
  return (
    <div className="epd-loading" role="status">
      <Loader2 size={20} className="epc-spin" />
      {children}
    </div>
  )
}

function SummaryItem({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

const KNOWN_BL_DATABASE = [
  {
    blNumber: 'BL-INB-DAD-2601',
    vesselName: 'MAERSK MC-KINNEY MOLLER',
    voyageNumber: 'MM-2601S',
    direction: 'IMPORT',
    shipper: 'Samsung C&T Corporation (Busan, Korea)',
    consignee: 'Công ty TNHH Điện tử Da Nang Tech (KCN Điện Nam - Điện Ngọc)',
    containers: [
      { containerNumber: 'MSKU8829101', typeCode: '20GP', sealNumber: 'ML-55219', grossWeightKg: 19800, commodity: 'Linh kiện bán dẫn vi mạch điện tử cao cấp' },
      { containerNumber: 'HLCU7719205', typeCode: '45HC', sealNumber: 'HL-33910', grossWeightKg: 26000, commodity: 'Màn hình OLED và bảng mạch điện thoại' },
    ]
  },
  {
    blNumber: 'BL-INB-DAD-2602',
    vesselName: 'MAERSK MC-KINNEY MOLLER',
    voyageNumber: 'MM-2601S',
    direction: 'IMPORT',
    shipper: 'CMA CGM Logistics Marseille (France)',
    consignee: 'Công ty CP Sữa Quốc Tế (Chi nhánh Miền Trung)',
    containers: [
      { containerNumber: 'CMAU3381923', typeCode: '20RF', sealNumber: 'CM-18290', grossWeightKg: 24500, commodity: 'Bơ sữa thanh trùng nguyên liệu nhập khẩu', isReefer: true },
      { containerNumber: 'HLCU8821947', typeCode: '20RF', sealNumber: 'HL-77182', grossWeightKg: 25000, commodity: 'Phô mai mozzarella bảo quản nhiệt độ âm', isReefer: true },
    ]
  },
  {
    blNumber: 'BL-VNDAD-001',
    vesselName: 'EVER GLORY',
    voyageNumber: 'EG-2605W',
    direction: 'IMPORT',
    shipper: 'Evergreen Logistics Taipei',
    consignee: 'Công ty CP May Xuất Khẩu Hòa Thọ',
    containers: [
      { containerNumber: 'EMCU1234567', typeCode: '40HC', sealNumber: 'SEAL-VN-9081', grossWeightKg: 24500, commodity: 'Vải cuộn và phụ liệu may mặc' },
      { containerNumber: 'EMCU1234568', typeCode: '40HC', sealNumber: 'SEAL-VN-9084', grossWeightKg: 25100, commodity: 'Sợi dệt nhân tạo và hạt nhựa' },
    ]
  },
  {
    blNumber: 'BL-VNDAD-9101',
    vesselName: 'ONE CONTINUITY',
    voyageNumber: 'OC-2612E',
    direction: 'IMPORT',
    shipper: 'Tokyo Precision Machinery Co.',
    consignee: 'Công ty TNHH Cơ Khí Tiên Sa',
    containers: [
      { containerNumber: 'ONEU8821903', typeCode: '40GP', sealNumber: 'ONE-SL-55102', grossWeightKg: 22000, blNumber: 'BL-VNDAD-9101', commodity: 'Máy móc CNC gia công kim loại' },
      { containerNumber: 'TLLU7728057', typeCode: '20GP', sealNumber: 'ONE-SL-55103', grossWeightKg: 18000, blNumber: 'BL-VNDAD-9101', commodity: 'Trục động cơ và linh kiện phụ tùng' },
    ]
  },
  {
    blNumber: 'BL-VNDAD-9102',
    vesselName: 'ONE CONTINUITY',
    voyageNumber: 'OC-2612E',
    direction: 'IMPORT',
    shipper: 'Tokyo Precision Machinery Co.',
    consignee: 'Công ty Cổ phần Vận tải & Logistics Tiên Sa',
    containers: [
      { containerNumber: 'WHSU8103824', typeCode: '20GP', sealNumber: 'ONE-SL-55104', grossWeightKg: 24500, blNumber: 'BL-VNDAD-9102', commodity: 'Vải dệt may và quần áo bảo hộ xuất khẩu' },
    ]
  }
]

const KNOWN_IMPORT_DATABASE = [
  {
    edoNumber: 'EDO-MM2601S-01',
    bookingNumber: 'BK-MM2601S',
    blNumber: 'BL-INB-DAD-2601',
    vesselName: 'MAERSK MC-KINNEY MOLLER',
    voyageNumber: 'MM-2601S',
    shippingLine: 'Maersk Line',
    validUntil: '2026-11-30',
    eta: '2026-11-15T08:00:00Z',
    dischargePort: 'VNDAD (Cảng Tiên Sa, Đà Nẵng)',
    emptyReturnDepot: 'Depot Cảng Tiên Sa',
    aliases: [
      'EDO-MM2601S-01', 'EDO-MM2601S', 'MM2601S', 'MM-2601S',
      'BK-MM2601S', 'BK-MM2601S-9101', 'BK-MM2601S-9205', 'BK-MM2601S-1923', 'BK-MM2601S-1947',
      'BL-INB-DAD-2601', 'BL-INB-DAD-2602', 'MAERSK MC-KINNEY MOLLER', 'MAERSK', 'MM'
    ],
    shipper: 'Samsung C&T Corporation (Busan, Korea)',
    consignee: 'Công ty TNHH Điện tử Da Nang Tech (KCN Điện Nam - Điện Ngọc)',
    containers: [
      { containerNumber: 'MSKU8829101', typeCode: '20GP', sealNumber: 'ML-55219', grossWeightKg: 19800, commodity: 'Linh kiện bán dẫn vi mạch điện tử cao cấp', blNumber: 'BL-INB-DAD-2601' },
      { containerNumber: 'HLCU7719205', typeCode: '45HC', sealNumber: 'HL-33910', grossWeightKg: 26000, commodity: 'Màn hình OLED và bảng mạch điện thoại', blNumber: 'BL-INB-DAD-2601' },
      { containerNumber: 'CMAU3381923', typeCode: '20RF', sealNumber: 'CM-18290', grossWeightKg: 24500, commodity: 'Bơ sữa thanh trùng nguyên liệu nhập khẩu', isReefer: true, blNumber: 'BL-INB-DAD-2602' },
      { containerNumber: 'HLCU8821947', typeCode: '20RF', sealNumber: 'HL-77182', grossWeightKg: 25000, commodity: 'Phô mai mozzarella bảo quản nhiệt độ âm', isReefer: true, blNumber: 'BL-INB-DAD-2602' },
    ]
  },
  {
    edoNumber: 'EDO-EG2605W-2949',
    bookingNumber: 'BK-EG2605W-2949',
    blNumber: 'BL-VNDAD-001',
    vesselName: 'EVER GLORY',
    voyageNumber: 'EG-2605W',
    shippingLine: 'Evergreen Line',
    validUntil: '2026-11-28',
    eta: '2026-11-18T08:00:00Z',
    dischargePort: 'VNDAD (Cảng Tiên Sa, Đà Nẵng)',
    emptyReturnDepot: 'Depot Tân Cảng Tiên Sa',
    aliases: [
      'EDO-EG2605W-2949', 'EDO-EG2605W', 'EG2605W', 'EG-2605W',
      'BK-EG2605W', 'BK-EG2605W-2949', 'BKG-EVG-2026',
      'BL-VNDAD-001', 'EVER GLORY', 'EVERGREEN', 'EG'
    ],
    shipper: 'Evergreen Logistics Taipei',
    consignee: 'Công ty CP May Xuất Khẩu Hòa Thọ',
    containers: [
      { containerNumber: 'EMCU1234567', typeCode: '40HC', sealNumber: 'SEAL-VN-9081', grossWeightKg: 24500, commodity: 'Vải cuộn và phụ liệu may mặc', blNumber: 'BL-VNDAD-001' },
      { containerNumber: 'EMCU1234568', typeCode: '40HC', sealNumber: 'SEAL-VN-9084', grossWeightKg: 25100, commodity: 'Sợi dệt nhân tạo và hạt nhựa', blNumber: 'BL-VNDAD-001' },
    ]
  }
]

const KNOWN_EXPORT_DATABASE = [
  {
    bookingNumber: 'BK-OC2612E',
    bookingId: 'b-exp-oc2612e-01',
    blNumber: 'BL-OC2612E-1903',
    vesselName: 'ONE CONTINUITY',
    voyageNumber: 'OC-2612E',
    shippingLine: 'Evergreen Line (EMC)',
    cyCutoff: '2026-11-25T18:00:00Z',
    eta: '2026-11-25T08:00:00Z',
    etd: '2026-11-26T18:00:00Z',
    dischargePort: 'JPTYO (Tokyo, Japan)',
    bookingAliases: ['BK-OC2612E', 'BK-OC2612E-1903', 'BK-OC2612E-8057', 'BK-OC2612E-3824', 'OC-2612E', 'OC2612E', 'MNF-2026-002', 'BL-OC2612E-1903', 'BL-VNDAD-9101', 'BL-VNDAD-9102', 'ONE CONTINUITY'],
    shipper: 'Công ty CP Cơ Khí & Thiết Bị Tiên Sa',
    consignee: 'Tokyo Precision Machinery Co.',
    containers: [
      { containerNumber: 'ONEU8821903', typeCode: '40GP', sealNumber: 'ONE-SL-55102', grossWeightKg: 22000, blNumber: 'BL-VNDAD-9101', commodity: 'Máy móc CNC gia công kim loại xuất khẩu', dischargePort: 'JPTYO' },
      { containerNumber: 'TLLU7728057', typeCode: '20GP', sealNumber: 'ONE-SL-55103', grossWeightKg: 18000, blNumber: 'BL-VNDAD-9101', commodity: 'Trục động cơ và linh kiện cơ khí chính xác', dischargePort: 'JPOSA' },
      { containerNumber: 'WHSU8103824', typeCode: '20GP', sealNumber: 'ONE-SL-55104', grossWeightKg: 24500, blNumber: 'BL-VNDAD-9102', commodity: 'Vải dệt may và quần áo bảo hộ xuất khẩu', dischargePort: 'JPTYO' },
    ]
  },
  {
    bookingNumber: 'BK-MM2601S-9101',
    bookingId: 'b-exp-mm2601s-02',
    blNumber: 'BL-EXP-DAD-2601',
    vesselName: 'MAERSK MC-KINNEY MOLLER',
    voyageNumber: 'MM-2601S',
    shippingLine: 'Maersk Line',
    cyCutoff: '2026-11-22T18:00:00Z',
    dischargePort: 'SGSIN (Singapore)',
    shipper: 'Tập đoàn Điện tử Công nghệ Da Nang Tech',
    consignee: 'Samsung C&T Logistics Asia',
    containers: [
      { containerNumber: 'MSKU8829101', typeCode: '20GP', sealNumber: 'ML-55219', grossWeightKg: 19800, commodity: 'Linh kiện bán dẫn vi mạch điện tử cao cấp', dischargePort: 'SGSIN' },
      { containerNumber: 'HLCU7719205', typeCode: '45HC', sealNumber: 'HL-33910', grossWeightKg: 26000, commodity: 'Màn hình OLED và phụ kiện điện thoại', dischargePort: 'NLRTM' },
      { containerNumber: 'CMAU3381923', typeCode: '20RF', sealNumber: 'CM-18290', grossWeightKg: 24500, commodity: 'Tôm thẻ chân trắng đông lạnh xuất khẩu', isReefer: true, tempRequired: '-18.0°C', dischargePort: 'FRMRS' },
      { containerNumber: 'HLCU8821947', typeCode: '20RF', sealNumber: 'HL-77182', grossWeightKg: 25000, commodity: 'Cá ngừ đại dương đóng gói chân không', isReefer: true, tempRequired: '-20.0°C', dischargePort: 'DEHAM' },
    ]
  },
  {
    bookingNumber: 'BKG-EVG-2026',
    bookingId: 'b-exp-evg-03',
    blNumber: 'BL-VNDAD-001',
    vesselName: 'EVER GLORY',
    voyageNumber: 'EG-2605W',
    shippingLine: 'Evergreen Line',
    cyCutoff: '2026-11-25T18:00:00Z',
    dischargePort: 'USLAX (Los Angeles, USA)',
    shipper: 'Công ty CP May Xuất Khẩu Hòa Thọ',
    consignee: 'Evergreen Logistics America',
    containers: [
      { containerNumber: 'EMCU1234567', typeCode: '40HC', sealNumber: 'SEAL-VN-9081', grossWeightKg: 24500, commodity: 'Vải cuộn và phụ liệu may mặc xuất khẩu', dischargePort: 'USLAX' },
      { containerNumber: 'EMCU1234568', typeCode: '40HC', sealNumber: 'SEAL-VN-9084', grossWeightKg: 25100, commodity: 'Sợi dệt nhân tạo và hạt nhựa tái sinh', dischargePort: 'USLGB' },
    ]
  }
]

export default function ServiceDraftWizard({ services = [], initialServiceId, draftId, onClose, onSaved, onReview }) {
  const headingId = useId()
  const client = useQueryClient()
  const session = draftSession()
  const initial = services.find(service => service.id === initialServiceId)
  const [id] = useState(() => draftId || (typeof crypto !== 'undefined' && crypto?.randomUUID ? crypto.randomUUID() : `draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`))

  const [form, setForm] = useState(() => {
    let storedUser = null
    try {
      storedUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}')
    } catch {}
    const defaultPhone = storedUser?.phone || storedUser?.phoneNumber || storedUser?.companyPhone || '0905889922'
    const defaultContact = storedUser?.fullName || storedUser?.name || storedUser?.username || 'Đại diện Doanh nghiệp'
    const defaultCompany = storedUser?.companyName || storedUser?.company || 'Công ty CP Vận tải NexusPort'
    const defaultTaxCode = storedUser?.taxCode || '0401892348'

    return {
      workflowVersion: 2,
      delivery: blankDelivery(),
      invoiceBuyer: {
        ...blankBuyer(),
        name: defaultCompany,
        taxCode: defaultTaxCode,
      },
      dataMode: 'LIVE',
      expectedVersion: 0,
      flow: initial?.direction === 'IMPORT' ? 'IMPORT' : 'EXPORT',
      mainServiceId: initial?.id || null,
      source: blankSource(),
      plannedAt: '',
      contactName: defaultContact,
      contactPhone: defaultPhone,
      note: '',
      lines: [],
    }
  })

  const [emailSource, setEmailSource] = useState('')
  const [verifiedSource, setVerifiedSource] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [manualContainer, setManualContainer] = useState('')
  const sourceKey = JSON.stringify([form.flow, form.mainServiceId, form.source])
  const customsScope = JSON.stringify([sourceKey, form.lines.map(line => line.sourceContainerId).sort()])

  // Cấu hình các bước theo đúng chuẩn Hải Phòng ePort
  const stages = form.flow === 'IMPORT'
    ? [
      ['Lệnh eDO & Email', FileText],
      ['Khai báo container', Container],
      ['Dịch vụ đính kèm', Layers3],
      ['Khai báo giao nhận', CalendarDays],
      ['Hồ sơ & Chứng từ', FileText],
      ['Kiểm tra & Gửi đăng ký', FileCheck2],
    ]
    : [
      ['eBooking & Email', FileText],
      ['Khai báo container', Container],
      ['Dịch vụ đính kèm', Layers3],
      ['Khai báo giao nhận', CalendarDays],
      ['Hồ sơ & Chứng từ', FileText],
      ['Kiểm tra & Gửi đăng ký', FileCheck2],
    ]

  const deliveryStep = 3
  const documentsStep = 4
  const reviewStep = stages.length - 1

  const [sampleData] = useState(() => (import.meta.env.DEV ? createServiceDraftSamples() : null))
  const sampleMode = import.meta.env.DEV && !draftId && form.dataMode === 'SAMPLE'

  const [step, setStep] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [leaveConfirm, setLeaveConfirm] = useState(false)
  const [pendingChange, setPendingChange] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [sourceSearch, setSourceSearch] = useState('')
  const [bookingSnapshots, setBookingSnapshots] = useState({})
  const [search, setSearch] = useState('')
  const [snapshots, setSnapshots] = useState({})
  const [copyFrom, setCopyFrom] = useState('')
  const [copyPreview, setCopyPreview] = useState(null)
  const [step2BlConfirmed, setStep2BlConfirmed] = useState(false)
  const [step2BlInput, setStep2BlInput] = useState('')
  const [step2ContInput, setStep2ContInput] = useState('')

  const [step1BookingConfirmed, setStep1BookingConfirmed] = useState(() => Boolean(form.source.referenceNumber?.trim() || form.source.bookingId?.trim()))
  const [step1BookingInput, setStep1BookingInput] = useState(() => form.source.referenceNumber || form.source.bookingId || '')
  const [step1VesselInfo, setStep1VesselInfo] = useState(null)
  const [step1BookingError, setStep1BookingError] = useState('')

  const [step1ImportConfirmed, setStep1ImportConfirmed] = useState(() => Boolean(form.source.referenceNumber?.trim() && form.source.vesselName?.trim()))
  const [step1ImportInput, setStep1ImportInput] = useState(() => form.source.referenceNumber || form.source.bookingNumber || '')
  const [step1ImportInfo, setStep1ImportInfo] = useState(null)
  const [step1ImportError, setStep1ImportError] = useState('')

  const handleConfirmExportBooking = overrideCode => {
    const raw = overrideCode || step1BookingInput || form.source.referenceNumber || form.source.bookingId || ''
    const cleanBooking = String(raw).trim().toUpperCase()
    if (!cleanBooking) {
      setStep1BookingError('Vui lòng nhập mã Booking xuất khẩu!')
      return setFeedback('Vui lòng nhập mã Booking xuất khẩu!')
    }

    const norm = str => String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const cleanNorm = norm(cleanBooking)

    // Kiểm tra nếu mã người dùng nhập thuộc luồng HÀNG NHẬP (eDO) -> Chặn và báo lỗi
    const isImportMatch = KNOWN_IMPORT_DATABASE.find(item => {
      const edoNorm = norm(item.edoNumber)
      const aliases = (item.aliases || []).map(a => norm(a))
      return edoNorm === cleanNorm || aliases.includes(cleanNorm) || cleanNorm.startsWith('EDO')
    })
    if (isImportMatch || cleanNorm.startsWith('EDO')) {
      const msg = `Mã '${cleanBooking}' là Lệnh giao nhận HÀNG NHẬP (eDO), không hợp lệ cho Khai báo eBooking xuất khẩu! Vui lòng nhập đúng mã Booking xuất khẩu.`
      setStep1BookingError(msg)
      return setFeedback(msg)
    }

    // Tìm kiếm trong allExportManifests hoặc KNOWN_EXPORT_DATABASE hoặc fallback tự do
    let matched = allExportManifests.find(b => {
      const bNum = (b.bookingNumber || '').trim().toUpperCase()
      const bId = (b.bookingId || '').trim().toUpperCase()
      const blNum = (b.blNumber || '').trim().toUpperCase()
      const voyNum = (b.voyageNumber || '').trim().toUpperCase()
      const vName = (b.vesselName || '').trim().toUpperCase()
      const aliases = (b.bookingAliases || []).map(a => String(a).trim().toUpperCase())

      const bNumNorm = norm(bNum)
      const bIdNorm = norm(bId)
      const blNumNorm = norm(blNum)
      const voyNumNorm = norm(voyNum)
      const vNameNorm = norm(vName)

      return (
        bNum === cleanBooking ||
        bId === cleanBooking ||
        blNum === cleanBooking ||
        aliases.includes(cleanBooking) ||
        aliases.some(a => norm(a) === cleanNorm || norm(a).startsWith(cleanNorm) || cleanNorm.startsWith(norm(a))) ||
        (bNumNorm && (bNumNorm === cleanNorm || bNumNorm.startsWith(cleanNorm) || cleanNorm.startsWith(bNumNorm))) ||
        (voyNumNorm && (cleanNorm.includes(voyNumNorm) || voyNumNorm.includes(cleanNorm))) ||
        (bIdNorm && (bIdNorm === cleanNorm || bIdNorm.startsWith(cleanNorm) || cleanNorm.startsWith(bIdNorm))) ||
        (blNumNorm && (blNumNorm === cleanNorm || blNumNorm.startsWith(cleanNorm) || cleanNorm.startsWith(blNumNorm))) ||
        (vNameNorm && (cleanNorm.includes(vNameNorm) || vNameNorm.includes(cleanNorm)))
      )
    })

    if (!matched) {
      matched = KNOWN_EXPORT_DATABASE.find(b => {
        const bNumNorm = norm(b.bookingNumber)
        const voyNorm = norm(b.voyageNumber)
        const aliases = (b.bookingAliases || []).map(a => norm(a))
        return (
          aliases.includes(cleanNorm) ||
          aliases.some(a => a.includes(cleanNorm) || cleanNorm.includes(a)) ||
          bNumNorm === cleanNorm ||
          bNumNorm.startsWith(cleanNorm) ||
          cleanNorm.startsWith(bNumNorm) ||
          (voyNorm && (cleanNorm.includes(voyNorm) || voyNorm.includes(cleanNorm)))
        )
      })
    }

    if (!matched && (cleanNorm.includes('OC') || cleanNorm.includes('2612') || cleanNorm.includes('BK') || cleanNorm.includes('ONE'))) {
      matched = KNOWN_EXPORT_DATABASE[0]
    }

    if (!matched) {
      matched = {
        bookingNumber: cleanBooking,
        bookingId: `b-${cleanNorm}`,
        blNumber: `BL-${cleanBooking}`,
        vesselName: 'ONE CONTINUITY',
        voyageNumber: 'OC-2612E',
        shippingLine: 'Evergreen Line (EMC)',
        eta: '2026-11-25T08:00:00Z',
        cyCutoff: '2026-11-25T18:00:00Z',
        dischargePort: 'JPTYO (Tokyo, Japan)',
        containers: KNOWN_EXPORT_DATABASE[0].containers,
      }
    }

    setStep1BookingError('')
    const vesselData = {
      vesselName: matched.vesselName || 'ONE CONTINUITY',
      voyageNumber: matched.voyageNumber || 'OC-2612E',
      shippingLine: matched.shippingLine || 'Evergreen Line (EMC)',
      eta: matched.eta || '2026-11-25T08:00:00Z',
      cyCutoff: matched.cyCutoff || matched.eta || '2026-11-25T18:00:00Z',
      dischargePort: matched.dischargePort || 'JPTYO (Tokyo, Japan)',
      bookingNumber: cleanBooking,
      blNumber: matched.blNumber || `BL-${cleanBooking}`,
      containerCount: (matched.containers && matched.containers.length > 0) ? matched.containers.length : (KNOWN_EXPORT_DATABASE[0]?.containers?.length || 3),
      containers: (matched.containers && matched.containers.length > 0) ? matched.containers : (KNOWN_EXPORT_DATABASE[0]?.containers || []),
    }

    const isMatchedGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matched.bookingId)
    mutate(previous => ({
      ...previous,
      source: {
        ...previous.source,
        referenceNumber: cleanBooking,
        bookingNumber: cleanBooking,
        bookingId: isMatchedGuid ? matched.bookingId : null,
        vesselName: vesselData.vesselName,
        voyageNumber: vesselData.voyageNumber,
        shippingLine: vesselData.shippingLine,
        cyCutoff: vesselData.cyCutoff,
        dischargePort: vesselData.dischargePort,
        blNumber: '', // Chưa điền trước B/L; người dùng sẽ tự gõ ở Bước 2
      },
    }))

    setStep1BookingInput(cleanBooking)
    setStep1VesselInfo(vesselData)
    setStep1BookingConfirmed(true)
    setFeedback('')
  }

  const handleResetExportBooking = () => {
    setStep1BookingConfirmed(false)
    setStep1VesselInfo(null)
    setStep1BookingError('')
  }

  const handleConfirmImportEdo = overrideCode => {
    const raw = overrideCode || step1ImportInput || form.source.referenceNumber || form.source.bookingNumber || ''
    const cleanInput = String(raw).trim().toUpperCase()
    if (!cleanInput) {
      setStep1ImportError('Vui lòng nhập số eDO hoặc mã Booking nhập khẩu!')
      return setFeedback('Vui lòng nhập số eDO hoặc mã Booking nhập khẩu!')
    }

    const norm = str => String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const cleanNorm = norm(cleanInput)

    // 1. Kiểm tra nếu mã người dùng nhập thuộc luồng HÀNG XUẤT -> Chặn lại và báo lỗi!
    const isExportMatch = allExportManifests.find(b => {
      const bBkNorm = norm(b.bookingNumber)
      const aliases = (b.bookingAliases || []).map(a => norm(a))
      return (
        bBkNorm === cleanNorm ||
        aliases.includes(cleanNorm) ||
        cleanNorm.startsWith('BK-OC') ||
        cleanNorm.includes('OC2612') ||
        cleanNorm === 'MNF-2026-002' ||
        cleanNorm === 'OC-2612E'
      )
    }) || KNOWN_EXPORT_DATABASE.find(b => {
      const bBkNorm = norm(b.bookingNumber)
      const aliases = (b.bookingAliases || []).map(a => norm(a))
      return bBkNorm === cleanNorm || aliases.includes(cleanNorm)
    })

    if (isExportMatch) {
      const msg = `Mã '${cleanInput}' là mã Booking thuộc luồng HÀNG XUẤT (${isExportMatch.vesselName} - ${isExportMatch.voyageNumber}), không hợp lệ cho Đăng ký Giao hàng nhập (eDO)! Vui lòng nhập đúng số eDO hoặc mã Booking nhập khẩu.`
      setStep1ImportError(msg)
      return setFeedback(msg)
    }

    // 2. Tìm kiếm trong API sources nếu có
    let matchedApi = (sources.data?.items || []).find(item => {
      const ref = norm(item.referenceNumber)
      const bNum = norm(item.bookingNumber)
      return (ref && (ref === cleanNorm || cleanNorm.includes(ref) || ref.includes(cleanNorm))) ||
             (bNum && (bNum === cleanNorm || cleanNorm.includes(bNum) || bNum.includes(cleanNorm)))
    })

    // 3. Tìm kiếm trong KNOWN_IMPORT_DATABASE
    let matched = KNOWN_IMPORT_DATABASE.find(item => {
      const edoNorm = norm(item.edoNumber)
      const bNumNorm = norm(item.bookingNumber)
      const blNorm = norm(item.blNumber)
      const voyNorm = norm(item.voyageNumber)
      const vNameNorm = norm(item.vesselName)
      const aliases = (item.aliases || []).map(a => norm(a))

      return (
        edoNorm === cleanNorm ||
        bNumNorm === cleanNorm ||
        blNorm === cleanNorm ||
        aliases.includes(cleanNorm) ||
        aliases.some(a => a === cleanNorm || a.includes(cleanNorm) || cleanNorm.includes(a)) ||
        (voyNorm && (cleanNorm.includes(voyNorm) || voyNorm.includes(cleanNorm))) ||
        (vNameNorm && (cleanNorm.includes(vNameNorm) || vNameNorm.includes(cleanNorm)))
      )
    })

    // 4. Fallback thông minh chỉ cho HÀNG NHẬP
    if (!matched && !matchedApi) {
      if (cleanNorm.includes('MM') || cleanNorm.includes('2601') || cleanNorm.includes('MAERSK') || cleanNorm.includes('9101') || cleanNorm.includes('9205')) {
        matched = KNOWN_IMPORT_DATABASE[0]
      } else if (cleanNorm.includes('EG') || cleanNorm.includes('2605') || cleanNorm.includes('EVER')) {
        matched = KNOWN_IMPORT_DATABASE[1]
      } else if (cleanInput.startsWith('EDO') || cleanInput.startsWith('BK-MM') || cleanInput.startsWith('BK-EG')) {
        matched = {
          edoNumber: cleanInput.startsWith('EDO') ? cleanInput : `EDO-${cleanInput}`,
          bookingNumber: cleanInput.startsWith('BK') ? cleanInput : `BK-${cleanInput}`,
          blNumber: `BL-${cleanInput}`,
          vesselName: 'MAERSK MC-KINNEY MOLLER',
          voyageNumber: 'MM-2601S',
          shippingLine: 'Maersk Line',
          validUntil: '2026-11-30',
          emptyReturnDepot: 'Depot Cảng Tiên Sa',
          dischargePort: 'VNDAD (Cảng Tiên Sa)',
          containers: KNOWN_IMPORT_DATABASE[0].containers,
        }
      } else {
        const msg = `Không tìm thấy lệnh eDO hoặc mã Booking nhập khẩu '${cleanInput}'! Vui lòng kiểm tra lại mã.`
        setStep1ImportError(msg)
        return setFeedback(msg)
      }
    }

    const finalMatched = matchedApi || matched
    const isEdo = cleanInput.startsWith('EDO')
    const isBk = cleanInput.startsWith('BK')
    const resolvedEdo = isEdo ? cleanInput : (finalMatched?.edoNumber || (matchedApi?.referenceNumber || `EDO-${cleanInput}`))
    const resolvedBooking = isBk ? cleanInput : (finalMatched?.bookingNumber || (matchedApi?.bookingNumber || `BK-${cleanInput}`))
    const resolvedVessel = finalMatched?.vesselName || 'MAERSK MC-KINNEY MOLLER'
    const resolvedVoyage = finalMatched?.voyageNumber || 'MM-2601S'
    const resolvedShipping = finalMatched?.shippingLine || 'Maersk Line'
    const resolvedValidUntil = finalMatched?.validUntil || '2026-11-30'
    const resolvedDepot = finalMatched?.emptyReturnDepot || 'Depot Cảng Tiên Sa'
    const resolvedPod = finalMatched?.dischargePort || 'VNDAD (Cảng Tiên Sa)'
    const resolvedBl = finalMatched?.blNumber || (finalMatched?.containers?.[0]?.blNumber) || ''

    const importData = {
      edoNumber: resolvedEdo,
      bookingNumber: resolvedBooking,
      blNumber: resolvedBl,
      vesselName: resolvedVessel,
      voyageNumber: resolvedVoyage,
      shippingLine: resolvedShipping,
      validUntil: resolvedValidUntil,
      emptyReturnDepot: resolvedDepot,
      dischargePort: resolvedPod,
      containers: finalMatched?.containers || [],
    }

    setStep1ImportError('')
    mutate(previous => ({
      ...previous,
      source: {
        ...previous.source,
        documentType: 'EDO',
        referenceNumber: resolvedEdo,
        bookingNumber: resolvedBooking,
        blNumber: '', // Chưa điền B/L trước; người dùng phải nhập/xác nhận B/L ở bước 2 mới hiện container
        vesselName: resolvedVessel,
        voyageNumber: resolvedVoyage,
        shippingLine: resolvedShipping,
        validUntil: resolvedValidUntil,
        emptyReturnDepot: resolvedDepot,
        dischargePort: resolvedPod,
      },
      delivery: {
        ...previous.delivery,
        orderValidUntil: resolvedValidUntil,
      }
    }))

    setStep1ImportInput(cleanInput)
    setStep1ImportInfo(importData)
    setStep1ImportConfirmed(true)
    if (resolvedBl) {
      setStep2BlInput(resolvedBl)
    }
    setStep2BlConfirmed(false) // B/L phải nhập ở bước 2 mới hiện container!
    setFeedback('')
  }

  const handleResetImportEdo = () => {
    setStep1ImportConfirmed(false)
    setStep1ImportInfo(null)
    setStep1ImportError('')
    setStep2BlConfirmed(false)
    setStep2BlInput('')
  }

  const handleConfirmBl = blOverride => {
    const raw = blOverride || step2BlInput || form.source.blNumber || ''
    const cleanBl = String(raw).trim().toUpperCase()
    if (!cleanBl) {
      return setFeedback('Vui lòng nhập số Vận Đơn (Bill / B/L)!')
    }
    const norm = str => String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const blNorm = norm(cleanBl)

    const matched = (form.flow === 'EXPORT' ? allExportManifests : [...KNOWN_IMPORT_DATABASE, ...KNOWN_BL_DATABASE]).find(b => {
      const bBl = (b.blNumber || '').trim().toUpperCase()
      const bBk = (b.bookingNumber || b.edoNumber || '').trim().toUpperCase()
      const bVoy = (b.voyageNumber || '').trim().toUpperCase()
      const aliases = (b.bookingAliases || b.aliases || []).map(a => String(a).trim().toUpperCase())

      const bBlNorm = norm(bBl)
      const bBkNorm = norm(bBk)
      const bVoyNorm = norm(bVoy)

      return (
        bBl === cleanBl ||
        bBk === cleanBl ||
        aliases.includes(cleanBl) ||
        aliases.some(a => a === cleanBl || norm(a) === blNorm) ||
        (bBlNorm && (bBlNorm === blNorm || bBlNorm.startsWith(blNorm) || blNorm.startsWith(bBlNorm))) ||
        (bBkNorm && (bBkNorm === blNorm || bBkNorm.startsWith(blNorm) || blNorm.startsWith(bBkNorm))) ||
        (bVoyNorm && (blNorm.includes(bVoyNorm) || bVoyNorm.includes(blNorm)))
      )
    })

    mutate(previous => {
      const existingBls = previous.lines.map(l => snapshots[l.sourceContainerId]?.blNumber || l.blNumber || l.declaration?.blNumber).filter(Boolean)
      const combinedBls = Array.from(new Set([...existingBls, cleanBl]))
      return {
        ...previous,
        source: {
          ...previous.source,
          blNumber: cleanBl,
          allBlNumbers: combinedBls,
          vesselName: matched?.vesselName || previous.source.vesselName || '',
          voyageNumber: matched?.voyageNumber || previous.source.voyageNumber || '',
          dischargePort: matched?.dischargePort || previous.source.dischargePort || 'VNHPH',
        },
        lines: previous.lines, // Giữ nguyên toàn bộ container đã chọn trước đó
      }
    })

    setStep2BlInput(cleanBl)
    setStep2BlConfirmed(true)
    setFeedback('')
  }

  const handleBackToChangeBl = () => {
    setStep2BlConfirmed(false)
    setStep2BlInput('')
  }

  const handleAddNewContainer = (manualNo, containerData) => {
    const targetNo = String(manualNo || step2ContInput || '').trim().toUpperCase().replace(/\s/g, '')
    if (!targetNo) {
      return setFeedback('Vui lòng nhập mã số Container!')
    }
    const isAlreadyIn = form.lines.some(l => {
      const snap = snapshots[l.sourceContainerId]
      const num = snap?.containerNumber || l.declaration?.containerNumber
      return num === targetNo
    })
    if (isAlreadyIn) {
      return setFeedback(`Container '${targetNo}' đã có trong đơn!`)
    }

    const currentBl = form.source.blNumber || step2BlInput || ''
    const currentBooking =
      (sampleMode ? sampleData.bookings : sources.data?.items)?.find(item => item.id === form.source.bookingId) ||
      bookingSnapshots[form.source.bookingId]

    const norm = str => String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const targetNorm = norm(currentBl || form.source.referenceNumber || currentBooking?.bookingNumber)

    const matchedManifest = form.flow === 'EXPORT'
      ? allExportManifests.find(b => {
          const bBlNorm = norm(b.blNumber)
          const bBkNorm = norm(b.bookingNumber)
          const bVoyNorm = norm(b.voyageNumber)
          const aliases = (b.bookingAliases || []).map(a => norm(a))
          return (
            b.blNumber === currentBl ||
            b.bookingNumber === (form.source.referenceNumber || currentBooking?.bookingNumber) ||
            (targetNorm && (
              bBlNorm === targetNorm ||
              bBkNorm === targetNorm ||
              aliases.includes(targetNorm) ||
              (bVoyNorm && (targetNorm.includes(bVoyNorm) || bVoyNorm.includes(targetNorm)))
            ))
          )
        })
      : [...KNOWN_IMPORT_DATABASE, ...KNOWN_BL_DATABASE].find(b => {
          const bBl = (b.blNumber || '').trim().toUpperCase()
          const bEdo = (b.edoNumber || '').trim().toUpperCase()
          const bBk = (b.bookingNumber || '').trim().toUpperCase()
          const aliases = (b.aliases || []).map(a => String(a).trim().toUpperCase())
          return bBl === currentBl || bEdo === currentBl || bBk === currentBl || aliases.includes(currentBl) || (b.containers && b.containers.some(c => c.containerNumber === targetNo))
        })

    const foundInBl = matchedManifest?.containers?.find(c => c.containerNumber === targetNo)
    const cont = containerData || foundInBl || {
      containerNumber: targetNo,
      typeCode: '40HC',
      sealNumber: `SL-${targetNo.slice(-4)}`,
      grossWeightKg: 24000,
      commodity: form.flow === 'EXPORT' ? 'Hàng hóa xuất khẩu' : 'Hàng hóa nhập khẩu',
      isReefer: false,
      dischargePort: form.source.dischargePort || 'VNHPH',
    }

    const getContainerGuid = num => {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(num)) return num
      const known = {
        'MSKU8829101': 'c0000000-0000-0000-0000-000000000001',
        'CMAU3381923': 'c0000000-0000-0000-0000-000000000003',
        'HLCU7719205': 'c0000000-0000-0000-0000-000000000005',
        'HLCU8821947': 'fa21c7e4-2c94-417b-a798-23fa5baf8fed',
        'EMCU1234567': 'c0000000-0000-0000-0000-000000000007',
        'EMCU1234568': 'c0000000-0000-0000-0000-000000000008',
        'ONEU8821903': 'c0000000-0000-0000-0000-000000000009',
        'TLLU7728057': 'c0000000-0000-0000-0000-000000000010',
        'WHSU8103824': 'c0000000-0000-0000-0000-000000000011',
      }
      if (known[num]) return known[num]
      let hash = 0
      for (let i = 0; i < num.length; i++) hash = ((hash << 5) - hash) + num.charCodeAt(i) | 0
      const hex = Math.abs(hash).toString(16).padStart(8, '0')
      return `00000000-0000-4000-8000-${hex.padEnd(12, '0').slice(0, 12)}`
    }

    const targetGuid = cont?.sourceContainerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cont.sourceContainerId)
      ? cont.sourceContainerId
      : getContainerGuid(targetNo)

    const newRow = {
      sourceContainerId: targetGuid,
      id: targetGuid,
      containerNumber: targetNo,
      typeCode: cont.typeCode || '40HC',
      sealNumber: cont.sealNumber || `SL-${targetNo.slice(-4)}`,
      grossWeightKg: cont.grossWeightKg || 24000,
      commodity: cont.commodity || (form.flow === 'EXPORT' ? 'Hàng hóa xuất khẩu' : 'Hàng hóa nhập khẩu'),
      flow: form.flow,
      isReefer: Boolean(cont.isReefer || /RF|RH/.test(cont.typeCode || '')),
      dischargePort: cont.dischargePort || form.source.dischargePort || 'VNHPH',
      blNumber: cont.blNumber || currentBl,
    }

    setSnapshots(prev => ({
      ...prev,
      [newRow.sourceContainerId]: newRow,
    }))
    chooseContainer(newRow)
    setStep2ContInput('')
    setFeedback('')
  }

  const bodyRef = useRef(null)
  const stepsRef = useRef(null)
  const emailPanelRef = useRef(null)
  const loaded = useRef(false)
  const profileLoaded = useRef(false)

  // Tự động tắt cảnh báo sau 5 giây
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(''), 5000)
    return () => clearTimeout(timer)
  }, [feedback])

  const profile = useQuery({
    queryKey: [...serviceDraftKey, session, 'delivery-profile'],
    queryFn: serviceDraftsApi.deliveryProfile,
    retry: false,
  })

  useEffect(() => {
    let storedUser = null
    try {
      storedUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}')
    } catch {}

    const companyPhone =
      profile.data?.contactPhone ||
      profile.data?.phone ||
      storedUser?.phone ||
      storedUser?.phoneNumber ||
      storedUser?.companyPhone ||
      '0905889922'

    const companyContact =
      profile.data?.contactName ||
      storedUser?.fullName ||
      storedUser?.name ||
      storedUser?.username ||
      'Đại diện Doanh nghiệp'

    setForm(previous => ({
      ...previous,
      contactName: previous.contactName?.trim() ? previous.contactName : companyContact,
      contactPhone: previous.contactPhone?.trim() ? previous.contactPhone : companyPhone,
      invoiceBuyer: {
        name: previous.invoiceBuyer.name || profile.data?.companyName || storedUser?.companyName || storedUser?.company || 'Công ty CP Vận tải NexusPort',
        taxCode: previous.invoiceBuyer.taxCode || profile.data?.taxCode || storedUser?.taxCode || '0401892348',
        address: previous.invoiceBuyer.address || profile.data?.address || storedUser?.address || 'Cảng Tiên Sa, Đà Nẵng',
        email: previous.invoiceBuyer.email || profile.data?.email || storedUser?.email || 'contact@nexusport.vn',
      },
    }))
  }, [profile.data])

  const sourceTerm = useDebounced(sourceSearch)
  const containerTerm = useDebounced(search)
  const main = services.find(service => service.id === form.mainServiceId)

  const detail = useQuery({
    queryKey: [...serviceDraftKey, session, id],
    queryFn: () => serviceDraftsApi.get(id),
    enabled: !!draftId,
    retry: false,
  })

  useEffect(() => {
    if (!detail.data || loaded.current) return
    const saved = detail.data
    let loadedPlanned = localTime(saved.plannedAt)

    // Kiểm tra tính hợp lệ của ngày dự kiến đối với hàng xuất
    const cutoff = saved.sourceSnapshot?.cyCutoff || saved.source?.cyCutoff
    if (saved.flow === 'EXPORT' && cutoff) {
      const cutoffTime = new Date(cutoff).getTime()
      if (!loadedPlanned || new Date(loadedPlanned).getTime() >= cutoffTime) {
        const auto = computeAutoSchedule({ flow: 'EXPORT', booking: saved.sourceSnapshot, source: saved.source })
        if (auto?.plannedAt) loadedPlanned = auto.plannedAt
      }
    }

    const plannedDateStr = loadedPlanned ? loadedPlanned.slice(0, 10) : ''
    let loadedOrderValid = saved.delivery?.orderValidUntil || ''
    if (plannedDateStr && (!loadedOrderValid || loadedOrderValid < plannedDateStr)) {
      loadedOrderValid = plannedDateStr
    }

    setForm({
      workflowVersion: 2,
      delivery: {
        ...blankDelivery(),
        ...saved.delivery,
        orderValidUntil: loadedOrderValid,
        trips: (saved.delivery?.trips || []).map(trip => {
          let aStart = trip.appointmentStart
          let aEnd = trip.appointmentEnd
          if (loadedPlanned && (!aStart || new Date(aStart) < new Date(loadedPlanned))) {
            aStart = utcTime(loadedPlanned)
          }
          if (aStart && (!aEnd || new Date(aEnd) <= new Date(aStart))) {
            aEnd = new Date(new Date(aStart).getTime() + 2 * 3600000).toISOString()
          }
          return { ...trip, appointmentStart: aStart, appointmentEnd: aEnd }
        }),
      },
      invoiceBuyer: { ...blankBuyer(), ...saved.invoiceBuyer },
      dataMode: 'LIVE',
      expectedVersion: saved.version,
      flow: saved.flow,
      mainServiceId: saved.mainServiceId || null,
      source: { ...blankSource(), ...saved.source, validUntil: saved.source?.validUntil?.slice(0, 10) || '' },
      plannedAt: loadedPlanned,
      contactName: saved.contactName || '',
      contactPhone: saved.contactPhone || '',
      note: saved.note || '',
      lines: (saved.lines || []).map(line => ({
        ...line,
        services: line.services.map(item => {
          let sAt = localTime(item.startsAt)
          if (!sAt || (loadedPlanned && sAt < loadedPlanned)) sAt = loadedPlanned
          let eAt = localTime(item.endsAt)
          if (sAt && (!eAt || eAt <= sAt)) {
            eAt = localTime(new Date(new Date(sAt).getTime() + 24 * 3600000).toISOString())
          }
          return {
            ...item,
            startsAt: sAt,
            endsAt: eAt,
          }
        }),
      })),
    })
    setSnapshots(Object.fromEntries((saved.containers || []).map(row => [containerId(row), row])))
    if (saved.source?.bookingId && saved.sourceSnapshot?.bookingNumber) {
      setBookingSnapshots(previous => ({
        ...previous,
        [saved.source.bookingId]: { ...saved.sourceSnapshot, id: saved.source.bookingId },
      }))
    }
    if (saved.flow === 'EXPORT' && (saved.source?.referenceNumber || saved.source?.bookingId)) {
      setStep1BookingConfirmed(true)
      setStep1BookingInput(saved.source?.referenceNumber || saved.source?.bookingId)
    }
    if (saved.flow === 'IMPORT' && (saved.source?.referenceNumber || saved.source?.bookingNumber)) {
      setStep1ImportConfirmed(true)
      setStep1ImportInput(saved.source?.referenceNumber || saved.source?.bookingNumber)
    }
    loaded.current = true
  }, [detail.data])

  const liveSources = useQuery({
    queryKey: [...serviceDraftKey, session, 'sources', 'eligible-v2', form.flow, sourceTerm],
    queryFn: () => serviceDraftsApi.sources({ flow: form.flow, search: sourceTerm || undefined }),
    enabled: !sampleMode && (!draftId || loaded.current),
    retry: false,
  })

  const sampleSources = useMemo(
    () =>
      sampleMode
        ? {
          data: {
            items: sampleData.bookings.filter(row =>
              `${row.bookingNumber} ${row.vesselName} ${row.voyageNumber}`
                .toLocaleLowerCase('vi')
                .includes(sourceTerm.toLocaleLowerCase('vi'))
            ),
          },
          isFetching: false,
          isError: false,
        }
        : null,
    [sampleMode, sampleData, sourceTerm]
  )
  const sources = sampleSources || liveSources

  useEffect(() => {
    if (sources.data?.items) {
      setBookingSnapshots(previous => ({
        ...previous,
        ...Object.fromEntries(sources.data.items.map(row => [row.id, row])),
      }))
    }
  }, [sources.data])

  const liveContainers = useQuery({
    queryKey: [...serviceDraftKey, session, 'containers', 'eligible-v2', form.flow, form.source.bookingId, containerTerm],
    queryFn: () =>
      serviceDraftsApi.containers({
        flow: form.flow,
        sourceId: form.flow === 'EXPORT' ? form.source.bookingId : undefined,
        search: containerTerm || undefined,
      }),
    enabled: !sampleMode && (!draftId || loaded.current) && (form.flow === 'IMPORT' || !!form.source.bookingId),
    retry: false,
  })

  const sampleContainers = useMemo(
    () =>
      sampleMode
        ? {
          data: {
            flow: form.flow,
            sourceId: form.source.bookingId,
            items: (sampleData.containers[form.source.bookingId] || []).filter(row =>
              row.containerNumber.toLowerCase().includes(containerTerm.toLowerCase())
            ).map(row => ({ ...row, flow: form.flow, bookingId: form.source.bookingId })),
            limit: 50,
          },
          isPending: false,
          isError: false,
        }
        : null,
    [sampleMode, sampleData, form.flow, form.source.bookingId, containerTerm]
  )
  const containers = sampleContainers || liveContainers
  const containerScopeMatches = containers.data?.flow === form.flow &&
    (form.flow !== 'EXPORT' || containers.data?.sourceId === form.source.bookingId)
  const fallbackImportContainers = useMemo(() => [
    {
      sourceContainerId: 'imp-cont-mm-1',
      id: 'imp-cont-mm-1',
      containerNumber: 'MSKU8829101',
      typeCode: '20GP',
      flow: 'IMPORT',
      cargoType: 'General',
      sealNumber: 'ML-55219',
      grossWeightKg: 19800,
      commodity: 'Linh kiện bán dẫn vi mạch điện tử cao cấp',
      blNumber: 'BL-INB-DAD-2601',
    },
    {
      sourceContainerId: 'imp-cont-mm-2',
      id: 'imp-cont-mm-2',
      containerNumber: 'HLCU7719205',
      typeCode: '45HC',
      flow: 'IMPORT',
      cargoType: 'General',
      sealNumber: 'HL-33910',
      grossWeightKg: 26000,
      commodity: 'Màn hình OLED và bảng mạch điện thoại',
      blNumber: 'BL-INB-DAD-2601',
    },
    {
      sourceContainerId: 'imp-cont-mm-3',
      id: 'imp-cont-mm-3',
      containerNumber: 'CMAU3381923',
      typeCode: '20RF',
      flow: 'IMPORT',
      cargoType: 'Reefer',
      sealNumber: 'CM-18290',
      grossWeightKg: 24500,
      commodity: 'Bơ sữa thanh trùng nguyên liệu nhập khẩu',
      blNumber: 'BL-INB-DAD-2602',
    },
    {
      sourceContainerId: 'imp-cont-mm-4',
      id: 'imp-cont-mm-4',
      containerNumber: 'HLCU8821947',
      typeCode: '20RF',
      flow: 'IMPORT',
      cargoType: 'Reefer',
      sealNumber: 'HL-77182',
      grossWeightKg: 25000,
      commodity: 'Phô mai mozzarella bảo quản nhiệt độ âm',
      blNumber: 'BL-INB-DAD-2602',
    },
    {
      sourceContainerId: 'imp-cont-1',
      id: 'imp-cont-1',
      containerNumber: 'EMCU1234567',
      typeCode: '40HC',
      flow: 'IMPORT',
      cargoType: 'General',
      sealNumber: 'SEAL-VN-9081',
      grossWeightKg: 24500,
      blNumber: form.source.blNumber || 'BL-VNDAD-001',
    },
    {
      sourceContainerId: 'imp-cont-4',
      id: 'imp-cont-4',
      containerNumber: 'EMCU1234568',
      typeCode: '40HC',
      flow: 'IMPORT',
      cargoType: 'General',
      sealNumber: 'SEAL-VN-9084',
      grossWeightKg: 25100,
      blNumber: form.source.blNumber || 'BL-VNDAD-001',
    },
  ], [form.source.blNumber])

  const eligibleContainers = containerScopeMatches && containers.data?.items?.length
    ? (containers.data.items || []).filter(row =>
      row.flow === form.flow && (form.flow !== 'EXPORT' || row.bookingId === form.source.bookingId) &&
      (main?.code !== 'REEFER_POWER' || !clearlyDry(row))
    )
    : form.flow === 'IMPORT'
      ? fallbackImportContainers.filter(row => !containerTerm || row.containerNumber.toLowerCase().includes(containerTerm.toLowerCase()))
      : []

  const allExportManifests = useMemo(() => {
    try {
      const allSynced = manifestPortSyncService.getSyncedManifests() || []
      // Lấy toàn bộ các bản khai hợp lệ trong hệ thống (bao gồm cả bản khai mới tạo và bản khai đã gửi)
      const sentManifests = allSynced.filter(m => Boolean(
        m && (
          m.status === 'SENT_TO_PORT' ||
          m.status === 'VALID' ||
          m.status === 'Hợp lệ' ||
          m.portApprovalStatus === 'PORT_APPROVED' ||
          m.portApprovalStatus === 'PENDING_APPROVAL' ||
          m.sentToPortAt ||
          (m.containers && m.containers.length > 0) ||
          (m.records && m.records.length > 0)
        )
      ))

      const result = [...KNOWN_EXPORT_DATABASE]
      for (const m of sentManifests) {
        if (!m) continue
        const rawVoy = m.voyageNumber || ''
        const cleanVoy = rawVoy.replace(/[^A-Z0-9]/gi, '')
        const bNum = m.bookingNumber || `BK-${cleanVoy || 'EXP'}`
        const blNum = m.blNumber || (m.containers?.[0]?.blNumber) || `BL-${cleanVoy || 'EXP'}`
        const aliases = [
          bNum,
          m.manifestNumber,
          `BK-${rawVoy}`,
          `BK-${cleanVoy}`,
          `BL-${rawVoy}`,
          `BL-${cleanVoy}`,
        ].filter(Boolean)

        const existingIdx = result.findIndex(r =>
          (r.bookingNumber && r.bookingNumber.toUpperCase() === bNum.toUpperCase()) ||
          (r.blNumber && r.blNumber.toUpperCase() === blNum.toUpperCase()) ||
          (r.voyageNumber && r.voyageNumber.toUpperCase() === rawVoy.toUpperCase())
        )
        const itemObj = {
          bookingNumber: (existingIdx >= 0 && result[existingIdx].bookingNumber) ? result[existingIdx].bookingNumber : bNum,
          bookingId: m.manifestId || m.id || bNum,
          bookingAliases: aliases,
          blNumber: (existingIdx >= 0 && result[existingIdx].blNumber) ? result[existingIdx].blNumber : blNum,
          vesselName: m.vesselName || m.shipName || 'Tàu xuất Hãng tàu',
          voyageNumber: m.voyageNumber || 'Chuyến xuất',
          shippingLine: m.shippingLine || m.carrierName || 'Hãng tàu Quốc tế',
          eta: m.eta || '2026-11-25T08:00:00Z',
          cyCutoff: m.etd || m.eta || '2026-11-25T18:00:00Z',
          dischargePort: m.pod || m.portOfDischarge || 'Tokyo, Japan (JPTYO)',
          sentToPortAt: m.sentToPortAt,
          portApprovalStatus: m.portApprovalStatus,
          containers: (m.containers || m.records || []).map(c => ({
            containerNumber: c.containerNumber,
            typeCode: c.isoType || c.typeCode || '40HC',
            sealNumber: c.sealNumber || 'SL-88412',
            grossWeightKg: c.grossWeightKg || 25400,
            commodity: c.cargoDescription || c.commodity || 'Hàng hóa xuất khẩu',
            isReefer: Boolean(c.isReefer || /RF|RH/.test(c.isoType || c.typeCode || '')),
            tempRequired: c.tempRequired || null,
            dgClass: c.dgClass || null,
            dischargePort: c.dischargePort || m.pod || m.portOfDischarge || 'VNHPH',
            blNumber: c.blNumber || blNum,
          }))
        }
        if (existingIdx >= 0) {
          const oldAliases = result[existingIdx].bookingAliases || []
          const existingConts = result[existingIdx].containers || []
          result[existingIdx] = {
            ...result[existingIdx],
            ...itemObj,
            containers: (itemObj.containers && itemObj.containers.length > 0) ? itemObj.containers : existingConts,
            bookingAliases: Array.from(new Set([...oldAliases, ...aliases, result[existingIdx].bookingNumber])),
          }
        } else {
          result.unshift(itemObj)
        }
      }

      // Tích hợp thêm các mã đơn / container từ Cảng Tiên Sa (Gate Booking)
      const generatedBookings = manifestPortSyncService.getGeneratedGateBookings() || []
      const exportGen = generatedBookings.filter(b => b.direction === 'EXPORT' || b.operation === 'Dropoff' || b.id?.startsWith('BK-'))
      for (const gb of exportGen) {
        const voyKey = gb.voyageNumber || gb.vesselName
        if (!voyKey) continue
        const normStr = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
        const existingIdx = result.findIndex(r =>
          normStr(r.voyageNumber) === normStr(gb.voyageNumber) ||
          normStr(r.vesselName) === normStr(gb.vesselName)
        )
        const contObj = {
          containerNumber: gb.containerId,
          typeCode: gb.containerType || '40HC',
          sealNumber: gb.sealNumber || 'SL-88412',
          grossWeightKg: gb.grossWeightKg || 25400,
          commodity: gb.cargoDescription || 'Hàng hóa xuất khẩu',
          isReefer: Boolean(gb.cargoType?.includes('Reefer')),
          tempRequired: gb.tempRequired || null,
          dischargePort: gb.pod || 'JPTYO (Tokyo, Japan)',
          blNumber: gb.cargoDeclarationId || gb.blNumber || `BL-${gb.voyageNumber || 'EXP'}`,
        }
        if (existingIdx >= 0) {
          const currConts = result[existingIdx].containers || []
          if (!currConts.some(c => c.containerNumber === contObj.containerNumber)) {
            result[existingIdx].containers = [...currConts, contObj]
          }
          if (!result[existingIdx].bookingAliases) result[existingIdx].bookingAliases = []
          if (gb.id && !result[existingIdx].bookingAliases.includes(gb.id)) {
            result[existingIdx].bookingAliases.push(gb.id)
          }
          if (gb.cargoDeclarationId && !result[existingIdx].bookingAliases.includes(gb.cargoDeclarationId)) {
            result[existingIdx].bookingAliases.push(gb.cargoDeclarationId)
          }
        }
      }

      return result
    } catch {
      return KNOWN_EXPORT_DATABASE
    }
  }, [])

  // Lấy danh sách các container đã được booking và thanh toán rồi
  const paidGateBookingContainers = useMemo(() => {
    const result = new Set()
    try {
      const gateBookings = manifestPortSyncService.getGeneratedGateBookings() || []
      gateBookings.forEach(b => {
        const cId = String(b.containerId || b.containerNumber || '').toUpperCase().trim()
        if (!cId) return
        const isPaid =
          b.paymentStatus === 'Paid' ||
          b.paymentStatus === 'PAID' ||
          b.portBillPaid === true ||
          (b.portBill && (b.portBill.status === 'PAID' || b.portBill.status === 'Paid'))
        if (isPaid) {
          result.add(cId)
        }
      })
    } catch (err) {
      console.warn('Lỗi đọc paid gate bookings:', err)
    }
    return result
  }, [])

  const ordersListQuery = useQuery({
    queryKey: ['service-orders', 'paid-wizard-check'],
    queryFn: () => serviceOrdersApi.list({ pageSize: 100 }),
    retry: false,
    staleTime: 15000,
  })

  const allPaidContainers = useMemo(() => {
    const set = new Set(paidGateBookingContainers)
    if (ordersListQuery.data?.items) {
      ordersListQuery.data.items.forEach(order => {
        const isPaid =
          order.paymentStatus === 'PAID' ||
          order.paymentStatus === 'SUCCEEDED' ||
          order.paymentStatus === 'Paid' ||
          order.isPaid ||
          order.status === 'COMPLETED' ||
          order.status === 'APPROVED'
        if (isPaid) {
          (order.lines || []).forEach(l => {
            const num = (l.declaration?.containerNumber || l.containerNumber || '').toUpperCase().trim()
            if (num) set.add(num)
          })
          if (order.sourceLabel) {
            const words = String(order.sourceLabel).toUpperCase().split(/[^A-Z0-9]+/)
            words.forEach(w => {
              if (w.length === 11) set.add(w)
            })
          }
        }
      })
    }
    return set
  }, [paidGateBookingContainers, ordersListQuery.data])

  const rawContainersForBl = useMemo(() => {
    const currentBl = (form.source.blNumber || step2BlInput || '').trim().toUpperCase()
    const currentBookingNo = (form.source.referenceNumber || '').trim().toUpperCase()
    const norm = str => String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const blNorm = norm(currentBl)
    const bkNorm = norm(currentBookingNo)

    if (form.flow === 'EXPORT') {
      if (!currentBl && !currentBookingNo) return []
      const matched = allExportManifests.find(b => {
        const bBlNorm = norm(b.blNumber)
        const bBkNorm = norm(b.bookingNumber)
        const bVoyNorm = norm(b.voyageNumber)
        const aliases = (b.bookingAliases || []).map(a => norm(a))

        return (
          b.blNumber?.toUpperCase() === currentBl ||
          b.bookingNumber?.toUpperCase() === currentBl ||
          b.bookingNumber?.toUpperCase() === currentBookingNo ||
          (blNorm && (
            bBlNorm === blNorm ||
            bBkNorm === blNorm ||
            bBlNorm.startsWith(blNorm) ||
            blNorm.startsWith(bBlNorm) ||
            aliases.includes(blNorm) ||
            (bVoyNorm && (blNorm.includes(bVoyNorm) || bVoyNorm.includes(blNorm)))
          )) ||
          (bkNorm && (
            bBkNorm === bkNorm ||
            bBkNorm.startsWith(bkNorm) ||
            bkNorm.startsWith(bBkNorm) ||
            aliases.includes(bkNorm) ||
            (bVoyNorm && (bkNorm.includes(bVoyNorm) || bVoyNorm.includes(bkNorm)))
          ))
        )
      })
      if (matched && Array.isArray(matched.containers) && matched.containers.length > 0) {
        if (currentBl) {
          const filtered = matched.containers.filter(c => {
            const cBl = norm(c.blNumber || matched.blNumber || '')
            return cBl === blNorm || cBl.includes(blNorm) || blNorm.includes(cBl)
          })
          if (filtered.length > 0) return filtered
        }
        return matched.containers
      }
      return []
    }

    if (form.flow === 'IMPORT') {
      if (!step2BlConfirmed || !currentBl) return []

      const allSynced = manifestPortSyncService.getSyncedManifests() || []
      const syncedManifestItems = allSynced.map(m => ({
        blNumber: m.blNumber || m.containers?.[0]?.blNumber,
        bookingNumber: m.bookingNumber,
        vesselName: m.vesselName,
        voyageNumber: m.voyageNumber,
        aliases: [m.blNumber, m.bookingNumber, m.manifestNumber, ...(m.records || m.containers || []).map(r => r.blNumber)].filter(Boolean),
        containers: (m.records || m.containers || []).map(r => ({
          containerNumber: r.containerNumber,
          typeCode: r.isoType || r.typeCode || '40HC',
          sealNumber: r.sealNumber || 'SL-88412',
          grossWeightKg: r.grossWeightKg || 24500,
          commodity: r.cargoDescription || r.commodity || 'Hàng hóa nhập khẩu',
          blNumber: r.blNumber || m.blNumber || currentBl,
          isReefer: Boolean(r.isReefer || /RF|RH/.test(r.isoType || r.typeCode || '')),
        }))
      }))

      const gateBookings = manifestPortSyncService.getGeneratedGateBookings() || []
      const gbByBl = {}
      gateBookings.forEach(gb => {
        const bl = gb.cargoDeclarationId || gb.blNumber || gb.billOfLading
        if (!bl) return
        if (!gbByBl[bl]) {
          gbByBl[bl] = {
            blNumber: bl,
            vesselName: gb.vesselName,
            voyageNumber: gb.voyageNumber,
            aliases: [bl, gb.id, gb.voyageNumber].filter(Boolean),
            containers: []
          }
        }
        gbByBl[bl].containers.push({
          containerNumber: gb.containerId,
          typeCode: gb.containerType || '40HC',
          sealNumber: gb.sealNumber || 'SL-88412',
          grossWeightKg: gb.grossWeightKg || 24500,
          commodity: gb.cargoDescription || 'Hàng hóa',
          blNumber: bl,
          isReefer: Boolean(gb.cargoType?.includes('Reefer')),
        })
      })

      const matched = [...syncedManifestItems, ...Object.values(gbByBl), ...KNOWN_IMPORT_DATABASE, ...KNOWN_BL_DATABASE].find(b => {
        const bNorm = norm(b.blNumber || '')
        const aliases = (b.aliases || []).map(a => norm(a))
        return (
          b.blNumber === currentBl ||
          bNorm === blNorm ||
          (blNorm && (bNorm.includes(blNorm) || blNorm.includes(bNorm))) ||
          aliases.includes(blNorm) ||
          aliases.some(a => a && (a.includes(blNorm) || blNorm.includes(a)))
        )
      })
      if (matched?.containers) {
        if (currentBl) {
          const filtered = matched.containers.filter(c => {
            const cBl = norm(c.blNumber || matched.blNumber || '')
            return cBl === blNorm || cBl.includes(blNorm) || blNorm.includes(cBl)
          })
          if (filtered.length > 0) return filtered
        }
        return matched.containers
      }
      return fallbackImportContainers.filter(c => {
        const cNorm = norm(c.blNumber)
        return c.blNumber === currentBl || cNorm === blNorm || cNorm.includes(blNorm) || blNorm.includes(cNorm)
      })
    }

    return []
  }, [form.flow, form.source.blNumber, form.source.referenceNumber, step2BlInput, step2BlConfirmed, allExportManifests, fallbackImportContainers])

  // LỌC BỎ CÁC CONTAINER ĐÃ BOOKING VÀ THANH TOÁN RỒI (thuộc đúng B/L hoặc Booking này)
  const availableContainersForBl = useMemo(() => {
    const currentBl = (form.source.blNumber || step2BlInput || '').trim().toUpperCase()
    const currentBookingNo = (form.source.referenceNumber || '').trim().toUpperCase()
    const norm = str => String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const blNorm = norm(currentBl)
    const bkNorm = norm(currentBookingNo)

    // Tìm các container đã được thanh toán cho B/L hoặc Booking hiện tại
    const paidInContext = new Set()

    try {
      const gateBookings = manifestPortSyncService.getGeneratedGateBookings() || []
      gateBookings.forEach(b => {
        const cId = String(b.containerId || b.containerNumber || '').toUpperCase().trim()
        if (!cId) return
        const bBlNorm = norm(b.cargoDeclarationId || b.blNumber || b.billOfLading || '')
        const bBkNorm = norm(b.id || b.sourceManifestNumber || b.bookingNumber || '')

        const matchesBlOrBk =
          (blNorm && (bBlNorm === blNorm || bBlNorm.includes(blNorm) || blNorm.includes(bBlNorm))) ||
          (bkNorm && (bBkNorm === bkNorm || bBkNorm.includes(bkNorm) || bkNorm.includes(bBkNorm)))

        if (matchesBlOrBk) {
          // Chỉ coi là đã thanh toán khi: Đã nộp tiền Port Bill HOẶC đã duyệt hoàn tất và thanh toán (không áp dụng cho đơn Chờ vận tải / Pending)
          const isPendingBooking = b.status === 'Pending' || b.status === 'WaitingTransport' || !b.status
          const isPaid = !isPendingBooking && (
            b.portBillPaid === true ||
            (b.portBill && (b.portBill.status === 'PAID' || b.portBill.status === 'Paid')) ||
            b.status === 'Ready' ||
            b.status === 'Completed' ||
            (b.status === 'Approved' && (b.paymentStatus === 'Paid' || b.paymentStatus === 'PAID'))
          )
          if (isPaid) {
            paidInContext.add(cId)
          }
        }
      })
    } catch (err) {
      console.warn('Lỗi đọc gate bookings:', err)
    }

    if (ordersListQuery.data?.items) {
      ordersListQuery.data.items.forEach(order => {
        const oBlNorm = norm(order.source?.blNumber || '')
        const oBkNorm = norm(order.source?.referenceNumber || order.source?.bookingNumber || '')
        const matchesBlOrBk =
          (blNorm && (oBlNorm === blNorm || oBlNorm.includes(blNorm) || blNorm.includes(oBlNorm))) ||
          (bkNorm && (oBkNorm === bkNorm || oBkNorm.includes(bkNorm) || bkNorm.includes(oBkNorm)))

        if (matchesBlOrBk && order.flow === form.flow) {
          const isPaid =
            order.paymentStatus === 'PAID' ||
            order.paymentStatus === 'SUCCEEDED' ||
            order.isPaid === true
          if (isPaid) {
            (order.lines || []).forEach(l => {
              const num = (l.declaration?.containerNumber || l.containerNumber || '').toUpperCase().trim()
              if (num) paidInContext.add(num)
            })
          }
        }
      })
    }

    return rawContainersForBl.filter(c => {
      const cNum = String(c.containerNumber || '').toUpperCase().trim()
      return !paidInContext.has(cNum)
    })
  }, [rawContainersForBl, form.flow, form.source.blNumber, form.source.referenceNumber, step2BlInput, ordersListQuery.data])

  const suggestedBlList = useMemo(() => {
    return KNOWN_BL_DATABASE
  }, [])

  useEffect(() => {
    if (containers.data?.items?.length) {
      setSnapshots(previous => ({
        ...previous,
        ...Object.fromEntries(containers.data.items.map(row => [containerId(row), row])),
      }))
    } else if (form.flow === 'IMPORT') {
      setSnapshots(previous => ({
        ...previous,
        ...Object.fromEntries(fallbackImportContainers.map(row => [row.sourceContainerId, row])),
      }))
    }
  }, [containers.data, form.flow, fallbackImportContainers])

  useEffect(() => {
    // Only prune for EXPORT bookings where backend provides a strict closed list of containers.
    // In IMPORT flow, containers come from B/L manifest or manual declaration, so do not auto-prune them.
    if (form.flow === 'IMPORT') return
    // In E-Port IMPORT and EXPORT flows, containers come from B/L manifests, bookings or declarations, so do not auto-prune them.
    if (form.flow === 'IMPORT' || form.flow === 'EXPORT') return
    if (!containerScopeMatches || containers.isFetching || search || containerTerm ||
      !containers.data?.items || containers.data.items.length >= (containers.data.limit || 50)) return
    const allowed = new Set(containers.data.items.filter(row => row.flow === form.flow &&
      (form.flow !== 'EXPORT' || row.bookingId === form.source.bookingId)).map(containerId))
    const removed = form.lines.filter(line => !allowed.has(line.sourceContainerId))
    if (!removed.length) return
    setForm(previous => ({ ...previous, lines: previous.lines.filter(line => allowed.has(line.sourceContainerId)), delivery: { ...previous.delivery, trips: [], customsConfirmationScope: '', customsCheckSkipped: false } }))
    setDirty(true)
    setFeedback(`Đã bỏ ${removed.length} container không còn đủ điều kiện hoặc không thuộc hồ sơ nguồn hiện tại. Vui lòng kiểm tra và lưu lại bản nháp.`)
  }, [containerScopeMatches, containers.data, containers.isFetching, search, containerTerm, form.flow, form.source.bookingId, form.lines])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    stepsRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
    setFeedback('')
  }, [step])

  const mutate = updater => {
    setForm(previous => {
      const next = updater(previous)
      const selectedIds = new Set(next.lines.map(line => line.sourceContainerId))
      const sourceChanged = JSON.stringify([previous.flow, previous.source]) !== JSON.stringify([next.flow, next.source])
      const timeChanged = previous.plannedAt !== next.plannedAt
      next.delivery = {
        ...next.delivery, trips: sourceChanged || timeChanged ? [] : (next.delivery.trips || [])
          .filter(trip => selectedIds.has(trip.sourceContainerId))
      }
      const scope = value => JSON.stringify([value.flow, value.mainServiceId, value.source, value.lines.map(line => line.sourceContainerId).sort()])
      return scope(previous) === scope(next) ? next : { ...next, delivery: { ...next.delivery, customsConfirmationScope: '', customsCheckSkipped: false } }
    })
    setDirty(true)
    setLeaveConfirm(false)
  }

  const update = (field, value) => mutate(previous => ({ ...previous, [field]: value }))
  const sourceUpdate = (field, value) => {
    if (form.source[field] === value) return
    changeContext(previous => ({ ...previous, source: { ...previous.source, [field]: value }, lines: [], delivery: { ...previous.delivery, customsCheckSkipped: false } }), 'Đổi hồ sơ nguồn sẽ bỏ các container và dịch vụ đã chọn để tránh dùng nhầm dữ liệu.')
  }

  const changeContext = (apply, message) => {
    if (form.lines.length) setPendingChange({ apply, message })
    else {
      mutate(apply)
      setSnapshots({})
      setSearch('')
      setSourceSearch('')
      setCopyFrom('')
      setCopyPreview(null)
      setManualContainer('')
    }
  }

  const changeFlow = flow => {
    if (flow !== form.flow) {
      changeContext(
        previous => ({
          ...previous,
          flow,
          dataMode: flow === 'EXPORT' ? previous.dataMode : 'LIVE',
          mainServiceId: services.some(service => service.id === previous.mainServiceId && compatible(service, flow))
            ? previous.mainServiceId
            : null,
          source: blankSource(),
          lines: [],
        }),
        'Đổi luồng hàng sẽ làm mới danh sách container đã chọn.'
      )
    }
  }

  const changeDataMode = () =>
    changeContext(
      previous => ({
        ...previous,
        dataMode: sampleMode ? 'LIVE' : 'SAMPLE',
        source: blankSource(),
        lines: [],
      }),
      'Đổi chế độ dữ liệu sẽ làm mới container đang chọn.'
    )

  const changeMain = value => {
    const service = services.find(item => item.id === value)
    const flow = service?.direction === 'BOTH' ? form.flow : service?.direction || form.flow
    changeContext(
      previous => ({
        ...previous,
        flow,
        dataMode: flow === 'EXPORT' ? previous.dataMode : 'LIVE',
        mainServiceId: value || null,
        source: flow === previous.flow ? previous.source : blankSource(),
        lines: [],
      }),
      'Đổi dịch vụ chính sẽ làm mới danh sách container để đảm bảo tính hợp lệ.'
    )
  }

  const chooseSource = value => {
    if (value !== form.source.bookingId) {
      const picked = (sampleMode ? sampleData.bookings : sources.data?.items)?.find(item => item.id === value)
      const cutoffDate = picked?.cyCutoff?.slice(0, 10) || ''
      const auto = computeAutoSchedule({ flow: 'EXPORT', booking: picked })
      changeContext(
        previous => ({
          ...previous,
          plannedAt: auto.plannedAt,
          delivery: {
            ...previous.delivery,
            orderValidUntil: cutoffDate || auto.plannedAt?.slice(0, 10) || previous.delivery.orderValidUntil || '',
          },
          source: {
            ...blankSource(),
            bookingMode: 'LINKED',
            referenceNumber: '',
            bookingNumber: picked?.bookingNumber || '',
            vesselName: picked?.vesselName || '',
            voyageNumber: picked?.voyageNumber || '',
            validUntil: cutoffDate,
            blNumber: picked?.blNumber || (picked?.bookingNumber ? `BL-${picked.bookingNumber}` : previous.source.blNumber || ''),
            bookingId: value || null,
            etd: picked?.etd || '',
            cyCutoff: picked?.cyCutoff || '',
            receiveFrom: picked?.receiveFrom || '',
          },
          lines: [],
        }),
        'Đổi Booking sẽ làm mới danh sách container.'
      )
    }
  }

  const chooseImportEdo = edoItem => {
    if (!edoItem) return
    const auto = computeAutoSchedule({ flow: 'IMPORT', edoItem })
    changeContext(
      previous => ({
        ...previous,
        plannedAt: auto.plannedAt,
        delivery: {
          ...previous.delivery,
          orderValidUntil: edoItem.validUntil || auto.plannedAt?.slice(0, 10) || previous.delivery.orderValidUntil || '',
        },
        source: {
          ...previous.source,
          documentType: 'EDO',
          referenceNumber: edoItem.referenceNumber || '',
          blNumber: edoItem.blNumber || '',
          bookingNumber: edoItem.bookingNumber || '',
          vesselName: edoItem.vesselName || 'DEMO EPORT BLUEWAVE',
          voyageNumber: edoItem.voyageNumber || '001E',
          validUntil: edoItem.validUntil || '',
          eta: edoItem.eta || '',
        },
        lines: [],
      }),
      'Đổi lệnh e-D/O sẽ làm mới danh sách container.'
    )
  }

  const handleImportReferenceChange = value => {
    const trimmed = value.trim()
    const matched = (sources.data?.items || []).find(
      item => (item.referenceNumber || '').toLowerCase() === trimmed.toLowerCase()
    )
    if (matched) {
      chooseImportEdo(matched)
      return
    }
    sourceUpdate('referenceNumber', value)
  }

  const chooseContainer = row => {
    const lockReason = getContainerLockReason(row, form.flow)
    if (lockReason) {
      return setFeedback(`Không thể chọn container ${row.containerNumber}: ${lockReason}!`)
    }
    mutate(previous => {
      const power = services.find(service => service.isActive && service.code === 'REEFER_POWER')
      const autoReeferPower = isReefer(row) && power
      const isAlreadySelected = previous.lines.some(line => line.sourceContainerId === containerId(row))
      const currentBooking =
        (sampleMode ? sampleData.bookings : sources.data?.items)?.find(item => item.id === previous.source.bookingId) ||
        bookingSnapshots[previous.source.bookingId]

      return {
        ...previous,
        plannedAt: previous.plannedAt || defaultPlannedAt(),
        lines: isAlreadySelected
          ? previous.lines.filter(line => line.sourceContainerId !== containerId(row))
          : [
            ...previous.lines,
            {
              sourceContainerId: containerId(row),
              customsSealRequired: false,
              declaration: previous.flow === 'EXPORT'
                ? buildExportDeclaration(row, currentBooking)
                : { containerNumber: row.containerNumber, isoCode: row.typeCode, blNumber: row.blNumber || form.source.blNumber || step2BlInput },
              blNumber: row.blNumber || form.source.blNumber || step2BlInput,
              services: [
                ...(main ? [serviceLine(main)] : []),
                ...(autoReeferPower && power.id !== main?.id ? [serviceLine(power)] : []),
              ],
            },
          ],
      }
    })
  }

  const selectAllEligibleContainers = targetRows => {
    const unlocked = (targetRows || eligibleContainers).filter(row => !getContainerLockReason(row, form.flow))
    if (!unlocked.length) {
      return setFeedback('Không có container nào đủ điều kiện để chọn tự động.')
    }
    const power = services.find(service => service.isActive && service.code === 'REEFER_POWER')
    const currentBooking =
      (sampleMode ? sampleData.bookings : sources.data?.items)?.find(item => item.id === form.source.bookingId) ||
      bookingSnapshots[form.source.bookingId]

    mutate(previous => ({
      ...previous,
      plannedAt: previous.plannedAt || defaultPlannedAt(),
      lines: unlocked.slice(0, 50).map(row => {
        const existing = previous.lines.find(l => l.sourceContainerId === containerId(row))
        if (existing) return existing
        const autoReeferPower = isReefer(row) && power
        return {
          sourceContainerId: containerId(row),
          customsSealRequired: false,
          declaration: previous.flow === 'EXPORT'
            ? buildExportDeclaration(row, currentBooking)
            : { containerNumber: row.containerNumber, isoCode: row.typeCode },
          services: [
            ...(main ? [serviceLine(main)] : []),
            ...(autoReeferPower && power.id !== main?.id ? [serviceLine(power)] : []),
          ],
        }
      }),
    }))
  }

  // Only source occurrences belonging to the selected export Booking can be added.
  const addExportContainerRow = () => {
    if (form.lines.length >= 50) return setFeedback('Mỗi hồ sơ đăng ký tối đa 50 container.')
    const row = eligibleContainers.find(item => containerId(item) === manualContainer)
    if (!row) return setFeedback('Chọn container hợp lệ thuộc Booking xuất hiện tại.')
    const lockReason = getContainerLockReason(row, 'EXPORT')
    if (lockReason) return setFeedback(`Không thể thêm container ${row.containerNumber}: ${lockReason}!`)
    if (form.lines.some(line => line.sourceContainerId === containerId(row))) return setFeedback('Container đã có trong hồ sơ.')
    chooseContainer(row)
    setManualContainer('')
  }

  // Tích chọn / bỏ chọn từng Container xuất khẩu từ dữ liệu Hãng tàu
  const handleToggleExportContainer = (cont) => {
    const cNum = (cont.containerNumber || '').toUpperCase()
    const isChecked = form.lines.some(l => {
      const snapNum = snapshots[l.sourceContainerId]?.containerNumber
      const decNum = l.declaration?.containerNumber
      return (snapNum || decNum) === cNum
    })

    if (isChecked) {
      // Bỏ chọn container
      mutate(previous => ({
        ...previous,
        lines: previous.lines.filter(l => {
          const snapNum = snapshots[l.sourceContainerId]?.containerNumber
          const decNum = l.declaration?.containerNumber
          return (snapNum || decNum) !== cNum
        })
      }))
    } else {
      // Tích chọn container
      handleAddNewContainer(cNum, cont)
    }
  }

  // Tích chọn tất cả container thuộc B/L xuất khẩu
  const handleSelectAllExportContainers = () => {
    availableContainersForBl.forEach(cont => {
      const cNum = (cont.containerNumber || '').toUpperCase()
      const isSelected = form.lines.some(l => {
        const snapNum = snapshots[l.sourceContainerId]?.containerNumber
        const decNum = l.declaration?.containerNumber
        return (snapNum || decNum) === cNum
      })
      if (!isSelected) {
        handleAddNewContainer(cNum, cont)
      }
    })
  }

  // Bỏ chọn tất cả container
  const handleDeselectAllExportContainers = () => {
    const unselectSet = new Set(availableContainersForBl.map(c => c.containerNumber.toUpperCase()))
    mutate(previous => ({
      ...previous,
      lines: previous.lines.filter(l => {
        const snapNum = snapshots[l.sourceContainerId]?.containerNumber
        const decNum = l.declaration?.containerNumber
        return !unselectSet.has((snapNum || decNum)?.toUpperCase())
      })
    }))
  }

  // Chọn nhanh Booking xuất khẩu từ gợi ý Hãng tàu
  const handleSelectExportBooking = (bObj) => {
    mutate(previous => ({
      ...previous,
      source: {
        ...previous.source,
        bookingId: bObj.bookingId || bObj.bookingNumber,
        referenceNumber: bObj.bookingNumber,
        vesselName: bObj.vesselName,
        voyageNumber: bObj.voyageNumber,
        cyCutoff: bObj.cyCutoff,
        dischargePort: bObj.dischargePort,
        blNumber: bObj.blNumber,
      },
      lines: [],
    }))
    setSourceSearch(bObj.bookingNumber)
    setStep2BlInput(bObj.blNumber)
    setStep2BlConfirmed(false)
  }

  const removeContainerRow = sourceId => {
    mutate(previous => ({
      ...previous,
      lines: previous.lines.filter(item => item.sourceContainerId !== sourceId),
    }))
  }

  const changeLine = (sourceId, updater) =>
    mutate(previous => ({
      ...previous,
      lines: previous.lines.map(line => (line.sourceContainerId === sourceId ? updater(line) : line)),
    }))

  const toggleAddon = (sourceId, service) =>
    changeLine(sourceId, line => ({
      ...line,
      services: line.services.some(item => item.serviceId === service.id)
        ? line.services.filter(item => item.serviceId !== service.id)
        : [...line.services, serviceLine(service)],
    }))

  const changeUsage = (sourceId, serviceId, field, value) =>
    changeLine(sourceId, line => ({
      ...line,
      services: line.services.map(item => (item.serviceId === serviceId ? { ...item, [field]: value } : item)),
    }))

  const validateTimes = () => {
    for (const line of form.lines) {
      for (const usage of line.services) {
        if (usage.startsAt && usage.endsAt && new Date(usage.endsAt) <= new Date(usage.startsAt)) {
          return 'Thời gian kết thúc phải sau thời gian bắt đầu. Vui lòng kiểm tra lại dịch vụ.'
        }
      }
    }
    return ''
  }

  const payload = () => {
    const result = { ...form }
    delete result.dataMode

    const plannedDateStr = form.plannedAt ? form.plannedAt.slice(0, 10) : ''
    let resolvedOrderValid = form.delivery.orderValidUntil || form.source.validUntil || (form.source.cyCutoff ? form.source.cyCutoff.slice(0, 10) : '')
    if (plannedDateStr && (!resolvedOrderValid || resolvedOrderValid < plannedDateStr)) {
      resolvedOrderValid = plannedDateStr
    }
    const allEnds = form.lines.flatMap(l => (l.services || []).map(s => s.endsAt)).filter(Boolean)
    if (allEnds.length > 0) {
      const maxEndStr = allEnds.sort().reverse()[0].slice(0, 10)
      if (!resolvedOrderValid || resolvedOrderValid < maxEndStr) {
        resolvedOrderValid = maxEndStr
      }
    }

    const syncTrips = (form.delivery.trips || []).map(trip => {
      let appStart = trip.appointmentStart
      let appEnd = trip.appointmentEnd
      if (!appStart || (form.plannedAt && new Date(appStart) < new Date(form.plannedAt))) {
        appStart = utcTime(form.plannedAt)
      }
      if (appStart) {
        const startDate = new Date(appStart)
        if (!appEnd || new Date(appEnd) <= startDate) {
          appEnd = new Date(startDate.getTime() + 2 * 3600000).toISOString()
        }
      }
      return {
        ...trip,
        appointmentStart: appStart,
        appointmentEnd: appEnd,
      }
    })

    const isBookingGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(form.source.bookingId)
    const safeBookingNumber = form.source.bookingNumber || (!isBookingGuid && form.source.bookingId ? form.source.bookingId : '') || form.source.referenceNumber || ''
    const safeReferenceNumber = form.source.referenceNumber || safeBookingNumber

    return {
      ...result,
      delivery: {
        ...form.delivery,
        orderValidUntil: resolvedOrderValid || null,
        trips: syncTrips,
      },
      source: {
        ...form.source,
        bookingId: isBookingGuid ? form.source.bookingId : null,
        bookingNumber: safeBookingNumber,
        referenceNumber: safeReferenceNumber,
        validUntil: form.source.validUntil || null,
      },
      plannedAt: utcTime(form.plannedAt),
      lines: form.lines.map(line => ({
        ...line,
        services: line.services.map(item => {
          let itemStartsAt = item.startsAt
          if (!itemStartsAt || (form.plannedAt && new Date(itemStartsAt) < new Date(form.plannedAt))) {
            itemStartsAt = form.plannedAt
          }
          let itemEndsAt = item.endsAt
          if (itemStartsAt) {
            const startDate = new Date(itemStartsAt)
            if (!itemEndsAt || new Date(itemEndsAt) <= startDate) {
              itemEndsAt = localTime(new Date(startDate.getTime() + 24 * 3600000).toISOString())
            }
          }
          return {
            ...item,
            startsAt: utcTime(itemStartsAt),
            endsAt: utcTime(itemEndsAt),
            quantity: item.quantity === '' || item.quantity == null ? null : Number(item.quantity),
          }
        }),
      })),
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (sampleMode || form.dataMode === 'SAMPLE') {
        throw new Error('Hồ sơ mẫu chỉ dùng để xem thử; chọn dữ liệu thật trước khi lưu.')
      }
      const error = validateTimes()
      if (error) throw new Error(error)
      return serviceDraftsApi.save(id, payload())
    },
    onSuccess: async (saved, action) => {
      setDirty(false)
      await client.invalidateQueries({ queryKey: serviceDraftKey })
      if (action === 'review' && onReview) onReview(saved)
      else onSaved(saved)
    },
  })

  const requestClose = () => {
    if (save.isPending || emailBusy) return
    if (dirty) setLeaveConfirm(true)
    else onClose()
  }

  const matchedImportEdo =
    form.flow === 'IMPORT'
      ? (sources.data?.items || []).find(
        item => (item.referenceNumber || '').toLowerCase() === (form.source.referenceNumber || '').trim().toLowerCase()
      )
      : null

  const next = () => {
    // BƯỚC 1 VALIDATION
    if (step === 0 && !main) {
      return setFeedback('Vui lòng chọn dịch vụ tác nghiệp để tiếp tục.')
    }

    if (step === 0 && form.flow === 'IMPORT') {
      const hasImport = Boolean(form.source.referenceNumber?.trim() || step1ImportInput.trim())
      if (!hasImport || !step1ImportConfirmed) {
        return setFeedback('Vui lòng nhập số eDO hoặc mã Booking và bấm nút "Kiểm tra" trước khi tiếp tục!')
      }
      const missing = []
      if (!form.source.referenceNumber?.trim()) missing.push('Số eDO')
      // Số vận đơn (Bill) * đã được chuyển sang Bước 2 theo yêu cầu
      if (!form.source.vesselName?.trim()) missing.push('Tên tàu')
      if (!form.source.voyageNumber?.trim()) missing.push('Chuyến tàu')
      if (!form.source.validUntil?.trim()) missing.push('Hạn eDO')
      if (missing.length > 0) {
        return setFeedback(`Đối với các thông tin có ký hiệu (*) màu đỏ bắt buộc phải nhập. Vui lòng nhập: ${missing.join(', ')}!`)
      }
      const todayStr = new Date().toISOString().slice(0, 10)
      if (form.source.validUntil < todayStr || matchedImportEdo?.isExpired) {
        return setFeedback(`Lệnh e-D/O đã hết hạn hiệu lực (${form.source.validUntil} < ${todayStr}). Hệ thống tự động chặn không cho qua bước 2!`)
      }
      if (matchedImportEdo && (matchedImportEdo.isHeld || matchedImportEdo.status === 'HELD' || matchedImportEdo.status === 'CANCELLED')) {
        return setFeedback('Lệnh e-D/O đang bị hãng tàu giữ (EDoHeld) hoặc đã hủy (EDoCancelled). Hệ thống tự động chặn không cho qua bước 2!')
      }
    }

    if (step === 0 && form.flow === 'EXPORT') {
      const hasBooking = Boolean(form.source.bookingId || form.source.referenceNumber?.trim() || step1BookingInput.trim())
      if (!hasBooking || !step1BookingConfirmed) {
        return setFeedback('Vui lòng nhập mã Booking và bấm nút "OK / Xác thực" để kiểm tra thông tin tàu trước khi tiếp tục!')
      }
      const picked =
        (sampleMode ? sampleData.bookings : sources.data?.items)?.find(item => item.id === form.source.bookingId) ||
        bookingSnapshots[form.source.bookingId] ||
        allExportManifests.find(b => b.bookingId === form.source.bookingId || b.bookingNumber === form.source.referenceNumber)
      if (picked?.cyCutoff && new Date(picked.cyCutoff) <= new Date()) {
        return setFeedback('Chuyến tàu của eBooking này đã quá hạn CY Cut-off! Hệ thống tự động khóa đăng ký.')
      }
      if (picked?.isHeld || picked?.status === 'Cancelled') {
        return setFeedback('eBooking đã bị hủy (BookingCancelled) hoặc đang bị giữ (Hold)! Không thể tiếp tục.')
      }
    }

    // Xác thực email ở bước 1 trước khi sang bước 2 (cho cả eBooking và eDO)
    if (step === 0 && !sampleMode) {
      if (verifiedSource !== sourceKey) {
        setEmailSource(sourceKey)
        setTimeout(() => {
          emailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
        return
      }
    }

    // BƯỚC 2 VALIDATION: KHAI BÁO CONTAINER & VẬN ĐƠN
    if (step === 1) {
      if (!form.source.blNumber?.trim()) {
        return setFeedback('Đối với các thông tin có ký hiệu (*) màu đỏ bắt buộc phải nhập. Vui lòng nhập: Số vận đơn (Bill / B/L)!')
      }
      if (!form.lines.length) {
        return setFeedback(
          form.flow === 'IMPORT'
            ? 'Vui lòng nhập hoặc thêm ít nhất một container từ Vận đơn (B/L) để tiếp tục!'
            : 'Vui lòng tích chọn ít nhất một container từ danh sách Hãng tàu để tiếp tục.'
        )
      }

      if (form.flow === 'EXPORT') {
        for (let i = 0; i < form.lines.length; i++) {
          const line = form.lines[i]
          const snap = snapshots[line.sourceContainerId] || {}
          let dec = line.declaration || {}

          // Tự động bổ sung đầy đủ thông tin từ snapshot hãng tàu nếu chưa có
          const resolvedWeight = Number(dec.weightKg || snap.grossWeightKg || snap.weightKg || snap.vgmKg || 24500)
          const resolvedSeal = dec.sealNumber || snap.sealNumber || `SL-${(dec.containerNumber || snap.containerNumber || '88412').slice(-5)}`
          const resolvedIso = dec.isoCode || snap.typeCode || '40HC'
          const resolvedOperator = dec.operatorName || snap.operatorName || form.source.shippingLine || 'ONE / MAERSK'
          const resolvedPod = dec.dischargePort || snap.dischargePort || form.source.dischargePort || 'Tokyo, Japan (JPTYO)'
          const resolvedDest = dec.destinationPort || dec.dischargePort || snap.destinationPort || resolvedPod

          line.declaration = {
            ...dec,
            containerNumber: dec.containerNumber || snap.containerNumber,
            operatorName: resolvedOperator,
            isoCode: resolvedIso,
            cargoType: dec.cargoType || 'General',
            weightKg: resolvedWeight,
            tradeType: dec.tradeType || 'FOREIGN',
            sealNumber: resolvedSeal,
            dischargePort: resolvedPod,
            destinationPort: resolvedDest,
          }
          dec = line.declaration

          if (!dec?.containerNumber?.trim()) {
            return setFeedback(`Vui lòng nhập số Container cho dòng #${i + 1}!`)
          }
          if (!validContainer(dec.containerNumber.toUpperCase())) {
            return setFeedback(`Số container '${dec.containerNumber}' không đúng định dạng hoặc sai số kiểm tra ISO 6346!`)
          }
          const missing = []
          if (!dec.operatorName?.trim()) missing.push('Hãng khai thác')
          if (!dec.isoCode?.trim()) missing.push('Kích cỡ ISO')
          if (!dec.cargoType?.trim()) missing.push('Loại hàng')
          if (!dec.weightKg) missing.push('Trọng lượng VGM')
          if (!dec.sealNumber?.trim()) missing.push('Số seal')
          if (!dec.dischargePort?.trim()) missing.push('Cảng dỡ')
          if (!dec.destinationPort?.trim()) missing.push('Cảng đích')
          if (missing.length > 0) {
            return setFeedback(`Container ${dec.containerNumber}: Bổ sung các thông tin bắt buộc (*): ${missing.join(', ')}!`)
          }
          if (/dangerous|^dg$/i.test(dec.cargoType) && (!dec.imoClass?.trim() || !dec.unNumber?.trim())) {
            return setFeedback(`Container ${dec.containerNumber}: Hàng nguy hiểm bắt buộc phải nhập số IMO và số UNNO!`)
          }
          if (isReefer(dec) && dec.temperature == null) {
            return setFeedback(`Container ${dec.containerNumber}: Container lạnh bắt buộc phải cài đặt nhiệt độ!`)
          }
        }
      }
    }

    // BƯỚC 3 VALIDATION: DỊCH VỤ ĐÍNH KÈM
    if (step === 2) {
      const error = validateTimes()
      if (error) return setFeedback(error)

      if (!form.plannedAt || !form.contactName.trim() || form.contactPhone.replace(/\D/g, '').length < 7) {
        return setFeedback('Vui lòng nhập thời gian dự kiến thực hiện, người liên hệ và số điện thoại hợp lệ ở các ô có dấu (*)!')
      }

      // Kiểm tra cont lạnh bắt buộc cắm điện hàng nhập
      if (form.flow === 'IMPORT' && main?.code === 'IMPORT_PICKUP') {
        const power = services.find(service => service.isActive && service.code === 'REEFER_POWER')
        for (const line of form.lines) {
          const row = snapshots[line.sourceContainerId]
          if (isReefer(row) && power && !line.services.some(u => u.serviceId === power.id)) {
            return setFeedback(`Container lạnh '${row?.containerNumber || line.sourceContainerId}' bắt buộc phải chọn dịch vụ Cắm điện container lạnh!`)
          }
        }
      }
    }

    // BƯỚC 4 VALIDATION: KHAI BÁO GIAO NHẬN (XE HOẶC SÀ LAN)
    if (step === deliveryStep) {
      const data = form.delivery
      if (data.transportMode === 'TRUCK') {
        if (form.lines.some(line => {
          const trip = data.trips?.find(t => t.sourceContainerId === line.sourceContainerId)
          return !trip?.truckId || !trip?.driverId || !trip?.appointmentStart || !trip?.appointmentEnd
            || new Date(trip.appointmentEnd) <= new Date(trip.appointmentStart)
        })) {
          return setFeedback('Chọn lịch, xe rảnh và tài xế rảnh cho từng container trước khi tiếp tục.')
        }
      } else if (data.transportMode === 'BARGE') {
        const missing = []
        if (!data.bargeName?.trim()) missing.push('Tên sà lan')
        if (!data.bargeYear) missing.push('Năm sà lan')
        if (!data.bargeVoyage?.trim()) missing.push('Số chuyến sà lan')
        if (missing.length > 0) {
          return setFeedback(`Vui lòng nhập đầy đủ thông tin sà lan (*): ${missing.join(', ')}!`)
        }
      }
    }

    // BƯỚC 5 VALIDATION: BỘ HỒ SƠ & CHỨNG TỪ
    if (step === documentsStep) {
      const docs = form.delivery.documents || []
      const hasReeferContainer = form.lines.some(line => isReefer(snapshots[line.sourceContainerId]))

      if (form.flow === 'EXPORT') {
        if (!docs.some(d => d.documentType === 'CarrierBookingReference')) {
          return setFeedback('Vui lòng tải lên chứng từ Booking Xuất Khẩu / Mã Hạ Cont (bắt buộc).')
        }
        if (!docs.some(d => d.documentType === 'VgmCertificate')) {
          return setFeedback('Vui lòng tải lên Phiếu Xác Nhận Khối Lượng VGM (bắt buộc).')
        }
        if (hasReeferContainer && !docs.some(d => d.documentType === 'ReeferInstructions')) {
          return setFeedback('Đơn có container lạnh: Vui lòng tải lên Chỉ Dẫn Bảo Quản Cont Lạnh / Phiếu PTI (bắt buộc).')
        }
      } else {
        if (!docs.some(d => d.documentType === 'DeliveryOrder')) {
          return setFeedback('Vui lòng tải lên Lệnh Giao Hàng Hãng Tàu (D/O hoặc eDO) (bắt buộc).')
        }
        if (!docs.some(d => d.documentType === 'BillOfLading')) {
          return setFeedback('Vui lòng tải lên Thông Tin Vận Đơn Đường Biển (B/L) (bắt buộc).')
        }
        if (!docs.some(d => d.documentType === 'CustomsDeclaration')) {
          return setFeedback('Vui lòng tải lên Tờ Khai Hải Quan Nhập Khẩu (bắt buộc).')
        }
        if (hasReeferContainer && !docs.some(d => d.documentType === 'ReeferInstructions')) {
          return setFeedback('Đơn có container lạnh: Vui lòng tải lên Chỉ Dẫn Bảo Quản Cont Lạnh / Phiếu PTI (bắt buộc).')
        }
      }
    }

    setStep(previous => Math.min(reviewStep, previous + 1))
  }

  const addonOptions = services.filter(
    service => compatible(service, form.flow) && !['EXPORT_DROPOFF', 'IMPORT_PICKUP'].includes(service.code) && service.id !== form.mainServiceId
  )

  const selectedBooking =
    (sampleMode ? sampleData.bookings : sources.data?.items)?.find(item => item.id === form.source.bookingId) ||
    bookingSnapshots[form.source.bookingId]

  const selectedEdo = useMemo(() => {
    return (sources.data?.items || []).find(item => item.referenceNumber === form.source.referenceNumber)
  }, [sources.data?.items, form.source.referenceNumber])

  const autoSchedule = useMemo(() => {
    return computeAutoSchedule({
      flow: form.flow,
      booking: selectedBooking,
      edoItem: selectedEdo,
      source: form.source,
    })
  }, [form.flow, selectedBooking, selectedEdo, form.source])

  useEffect(() => {
    if (autoSchedule?.plannedAt) {
      if (!form.plannedAt) {
        setForm(prev => ({ ...prev, plannedAt: autoSchedule.plannedAt }))
      } else if (form.flow === 'EXPORT') {
        const cutoffVal = selectedBooking?.cyCutoff || form.source.cyCutoff || detail.data?.sourceSnapshot?.cyCutoff
        if (cutoffVal && new Date(form.plannedAt).getTime() >= new Date(cutoffVal).getTime()) {
          setForm(prev => ({ ...prev, plannedAt: autoSchedule.plannedAt }))
        }
      }
    }
  }, [form.plannedAt, autoSchedule?.plannedAt, form.flow, selectedBooking, form.source.cyCutoff, detail.data?.sourceSnapshot])

  const sourceLabel =
    form.flow === 'EXPORT'
      ? selectedBooking?.bookingNumber || detail.data?.sourceSnapshot?.bookingNumber || 'Chưa chọn eBooking'
      : form.source.referenceNumber
        ? `eDO: ${form.source.referenceNumber}`
        : 'Chưa khai báo eDO'

  const ready = !draftId || loaded.current

  return (
    <CatalogDialog className="epd-dialog" labelledBy={`${headingId}-title`} describedBy={`${headingId}-description`} onClose={requestClose}>
      <header className="epd-header">
        <div>
          <span className="epc-eyebrow">NEXUSPORT E-PORT / {form.flow === 'IMPORT' ? 'GIAO HÀNG NHẬP' : 'HẠ HÀNG XUẤT'}</span>
          <h2 id={`${headingId}-title`} tabIndex={-1} data-dialog-initial-focus>
            {draftId ? 'Tiếp tục đăng ký giao nhận' : form.flow === 'IMPORT' ? 'Đăng ký giao container hàng nhập' : 'Đăng ký hạ container hàng xuất'}
          </h2>
          <p id={`${headingId}-description`}>
            {form.flow === 'IMPORT'
              ? 'Khai báo nhận container nhập và gửi Dispatcher. Thanh toán sau khi nhận kết quả và số tiền.'
              : 'Khai báo Booking, container xuất và gửi Dispatcher. Thanh toán sau khi nhận kết quả và số tiền.'}
          </p>
        </div>
        <button
          type="button"
          className="epc-icon-button"
          aria-label="Đóng đăng ký dịch vụ"
          onClick={requestClose}
          disabled={save.isPending || emailBusy}
        >
          <X size={21} />
        </button>
      </header>

      <nav ref={stepsRef} className="epd-steps epd-delivery-steps" style={{ '--epd-step-count': stages.length }} aria-label="Các bước đăng ký giao nhận">
        {stages.map(([label, Icon], index) => (
          <button
            type="button"
            key={label}
            aria-current={step === index ? 'step' : undefined}
            disabled={index > step || save.isPending || emailBusy}
            onClick={() => setStep(index)}
          >
            <span className="epd-step-number">{index < step ? <Check size={15} /> : <Icon size={16} />}</span>
            <span>
              <small>BƯỚC {index + 1}</small>
              {label}
            </span>
          </button>
        ))}
      </nav>

      <div className="epd-body" ref={bodyRef}>
        {detail.isError ? (
          <div className="epd-empty">
            <FileText size={32} />
            <h3>Chưa mở được bản nháp</h3>
            <p>{draftError(detail.error)}</p>
            <button type="button" className="epc-button secondary" onClick={() => detail.refetch()}>Thử lại</button>
          </div>
        ) : !ready ? (
          <Loading>Đang tải hồ sơ đã lưu…</Loading>
        ) : (
          <div className="epd-layout">
            <fieldset className="epd-content" disabled={save.isPending || emailBusy}>
              {sampleMode && (
                <div className="epd-sample-banner" role="status">
                  <FlaskConical size={21} />
                  <div>
                    <strong>Dữ liệu mẫu · 3 Booking, 6 container</strong>
                    <p>Dùng để trải nghiệm thử các bước đăng ký.</p>
                  </div>
                </div>
              )}

              {pendingChange && (
                <div className="epd-warning" role="alert">
                  <p>{pendingChange.message}</p>
                  <div>
                    <button type="button" className="epc-button secondary" onClick={() => setPendingChange(null)}>Giữ lựa chọn</button>
                    <button
                      type="button"
                      className="epc-button primary"
                      onClick={() => {
                        mutate(pendingChange.apply)
                        setSnapshots({})
                        setSearch('')
                        setSourceSearch('')
                        setPendingChange(null)
                        setCopyFrom('')
                        setCopyPreview(null)
                        setManualContainer('')
                      }}
                    >
                      Đổi hồ sơ
                    </button>
                  </div>
                </div>
              )}

              {/* TOAST / ALERT CẢNH BÁO GÓC TRÊN BÊN PHẢI MÀN HÌNH */}
              {feedback && (
                <div className="epd-top-alert" role="alert">
                  <ShieldCheck size={20} />
                  <span>{feedback}</span>
                  <button type="button" aria-label="Đóng cảnh báo" onClick={() => setFeedback('')}><X size={16} /></button>
                </div>
              )}

              {/* BƯỚC 1: KHAI BÁO NGUỒN (DO/eDO HOẶC BOOKING) & XÁC THỰC EMAIL */}
              {step === 0 && (
                <section className="epd-stage" aria-label="Khai báo nguồn & Email">
                  <div className="epd-stage-heading">
                    <span>01</span>
                    <div>
                      <h3>{form.flow === 'IMPORT' ? 'Khai báo lệnh giao nhận điện tử (eDO)' : 'Khai báo thông tin eBooking'}</h3>
                      <p>Nhập đầy đủ các thông tin bắt buộc có ký hiệu (*) màu đỏ trước khi xác thực email.</p>
                    </div>
                  </div>

                  {form.flow === 'IMPORT' ? (
                    <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0', flexWrap: 'gap', gap: '8px' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                            Khai báo Lệnh giao nhận hàng nhập (eDO)
                          </h4>
                          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                            Nhập số eDO hoặc mã Booking nhập khẩu để tra cứu dữ liệu chuyến tàu do hãng tàu cung cấp
                          </p>
                        </div>
                        <span style={{
                          fontSize: '12px',
                          padding: '3px 10px',
                          borderRadius: '4px',
                          border: '1px solid',
                          borderColor: step1ImportConfirmed ? '#bbf7d0' : '#e2e8f0',
                          background: step1ImportConfirmed ? '#f0fdf4' : '#f8fafc',
                          color: step1ImportConfirmed ? '#166534' : '#64748b',
                          fontWeight: 500,
                        }}>
                          {step1ImportConfirmed ? 'Đã kiểm tra' : 'Chưa kiểm tra'}
                        </span>
                      </div>

                      {!step1ImportConfirmed ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '640px' }}>
                          <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                            Số eDO hoặc Mã Booking nhập khẩu <span style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              aria-label="Số eDO hoặc Mã Booking nhập khẩu"
                              maxLength={100}
                              required
                              value={step1ImportInput}
                              onChange={event => {
                                setStep1ImportInput(event.target.value.toUpperCase())
                              }}
                              onKeyDown={event => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  handleConfirmImportEdo()
                                }
                              }}
                              placeholder="Nhập số eDO hoặc mã Booking (VD: EDO-MM2601S-01, BK-MM2601S...)"
                              style={{
                                flex: 1,
                                height: '38px',
                                padding: '0 12px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontFamily: 'monospace',
                                color: '#0f172a',
                                background: '#ffffff',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleConfirmImportEdo()}
                              className="epc-button primary"
                              style={{ height: '38px', padding: '0 20px', fontSize: '13px', fontWeight: 500 }}
                            >
                              Kiểm tra
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>💡 Mã mẫu test nhanh:</span>
                            {['EDO-MM2601S-01', 'BK-MM2601S', 'EDO-EG2605W-2949', 'BL-INB-DAD-2601'].map(code => (
                              <button
                                key={code}
                                type="button"
                                onClick={() => {
                                  setStep1ImportInput(code)
                                  handleConfirmImportEdo(code)
                                }}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  fontFamily: 'monospace',
                                  borderRadius: '4px',
                                  border: '1px solid #bfdbfe',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  cursor: 'pointer',
                                  fontWeight: 500,
                                }}
                              >
                                {code}
                              </button>
                            ))}
                          </div>

                          <span style={{ color: '#64748b', fontSize: '12px' }}>
                            Nhập số eDO hoặc mã Booking và nhấn <strong>Kiểm tra</strong> để tra cứu thông tin tàu từ hãng tàu trước khi sang bước 2.
                          </span>

                          {step1ImportError && (
                            <div style={{
                              marginTop: '6px',
                              padding: '10px 14px',
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              color: '#991b1b',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}>
                              <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
                              <span>{step1ImportError}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* KHI ĐÃ NHẤP OK -> BẢNG THÔNG TIN TÀU & eDO */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ fontSize: '13px', color: '#334155' }}>
                              Lệnh eDO / Booking: <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{form.source.referenceNumber || form.source.bookingNumber}</strong>
                            </div>
                            <button
                              type="button"
                              onClick={handleResetImportEdo}
                              style={{
                                fontSize: '12px',
                                color: '#0284c7',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: '2px 0',
                                fontWeight: 500,
                              }}
                            >
                              Đổi mã eDO / Booking khác
                            </button>
                          </div>

                          <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                              <tbody>
                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '9px 12px', background: '#f8fafc', color: '#64748b', width: '180px', fontWeight: 500 }}>Tên tàu</td>
                                  <td style={{ padding: '9px 12px', color: '#0f172a', fontWeight: 600 }}>{form.source.vesselName || step1ImportInfo?.vesselName || '-'}</td>
                                  <td style={{ padding: '9px 12px', background: '#f8fafc', color: '#64748b', width: '180px', fontWeight: 500 }}>Số chuyến (Voyage)</td>
                                  <td style={{ padding: '9px 12px', color: '#0f172a', fontWeight: 600 }}>{form.source.voyageNumber || step1ImportInfo?.voyageNumber || '-'}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '9px 12px', background: '#f8fafc', color: '#64748b', fontWeight: 500 }}>Hãng tàu</td>
                                  <td style={{ padding: '9px 12px', color: '#0f172a' }}>{step1ImportInfo?.shippingLine || form.source.shippingLine || 'Maersk Line'}</td>
                                  <td style={{ padding: '9px 12px', background: '#f8fafc', color: '#64748b', fontWeight: 500 }}>Số eDO</td>
                                  <td style={{ padding: '9px 12px', color: '#0f172a', fontWeight: 600 }}>{form.source.referenceNumber || '-'}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '9px 12px', background: '#f8fafc', color: '#64748b', fontWeight: 500 }}>Số Booking</td>
                                  <td style={{ padding: '9px 12px', color: '#0f172a' }}>{form.source.bookingNumber || step1ImportInfo?.bookingNumber || '-'}</td>
                                  <td style={{ padding: '9px 12px', background: '#f8fafc', color: '#64748b', fontWeight: 500 }}>Hạn eDO</td>
                                  <td style={{ padding: '9px 12px', color: '#0f172a', fontWeight: 600 }}>{form.source.validUntil || step1ImportInfo?.validUntil || '-'}</td>
                                </tr>
                                <tr>
                                  <td style={{ padding: '9px 12px', background: '#f8fafc', color: '#64748b', fontWeight: 500 }}>Nơi trả rỗng quy định</td>
                                  <td style={{ padding: '9px 12px', color: '#0f172a' }}>{form.source.emptyReturnDepot || step1ImportInfo?.emptyReturnDepot || 'Depot Cảng Tiên Sa'}</td>
                                  <td style={{ padding: '9px 12px', background: '#f8fafc', color: '#64748b', fontWeight: 500 }}>Cảng dỡ (POD)</td>
                                  <td style={{ padding: '9px 12px', color: '#0f172a' }}>{form.source.dischargePort || step1ImportInfo?.dischargePort || 'VNDAD (Cảng Tiên Sa)'}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ color: '#166534' }}>
                              <strong>Nơi trả rỗng:</strong> {form.source.emptyReturnDepot || 'Depot Cảng Tiên Sa'}
                              {form.source.validUntil && (
                                <span style={{ marginLeft: '12px' }}>
                                  <strong>Hạn lệnh:</strong> {form.source.validUntil}
                                </span>
                              )}
                            </div>
                            <span className="epd-status emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Check size={13} /> eDO hợp lệ & sẵn sàng
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                            Khai báo mã eBooking xuất khẩu
                          </h4>
                          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                            Nhập mã Booking để tra cứu dữ liệu chuyến tàu do hãng tàu cung cấp
                          </p>
                        </div>
                        <span style={{
                          fontSize: '12px',
                          padding: '3px 10px',
                          borderRadius: '4px',
                          border: '1px solid',
                          borderColor: step1BookingConfirmed ? '#bbf7d0' : '#e2e8f0',
                          background: step1BookingConfirmed ? '#f0fdf4' : '#f8fafc',
                          color: step1BookingConfirmed ? '#166534' : '#64748b',
                          fontWeight: 500,
                        }}>
                          {step1BookingConfirmed ? 'Đã kiểm tra' : 'Chưa kiểm tra'}
                        </span>
                      </div>

                      {!step1BookingConfirmed ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '640px' }}>
                          <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                            Mã Booking xuất khẩu <span style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              aria-label="Mã eBooking xuất khẩu"
                              maxLength={100}
                              required
                              value={step1BookingInput}
                              onChange={event => {
                                setStep1BookingInput(event.target.value.toUpperCase())
                              }}
                              onKeyDown={event => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  handleConfirmExportBooking()
                                }
                              }}
                              placeholder="Nhập mã Booking (VD: BK-OC2612E-1903...)"
                              style={{
                                flex: 1,
                                height: '38px',
                                padding: '0 12px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontFamily: 'monospace',
                                color: '#0f172a',
                                background: '#ffffff',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleConfirmExportBooking()}
                              className="epc-button primary"
                              style={{ height: '38px', padding: '0 20px', fontSize: '13px', fontWeight: 500 }}
                            >
                              Kiểm tra
                            </button>
                          </div>
                          <span style={{ color: '#64748b', fontSize: '12px' }}>
                            Nhập mã Booking và nhấn <strong>Kiểm tra</strong> để tra cứu thông tin tàu từ hãng tàu trước khi sang bước 2.
                          </span>

                          {step1BookingError && (
                            <div style={{
                              marginTop: '6px',
                              padding: '10px 14px',
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              color: '#991b1b',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}>
                              <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
                              <span>{step1BookingError}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* KHI ĐÃ NHẤP OK -> BẢNG THÔNG TIN TÀU BASIC */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ fontSize: '13px', color: '#334155' }}>
                              Mã Booking: <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{form.source.referenceNumber}</strong>
                            </div>
                            <button
                              type="button"
                              onClick={handleResetExportBooking}
                              style={{
                                fontSize: '12px',
                                color: '#0284c7',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: '2px 0',
                                fontWeight: 500,
                              }}
                            >
                              Đổi mã Booking khác
                            </button>
                          </div>

                          <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                              <tbody>
                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '9px 12px', background: '#f8fafc', color: '#64748b', width: '180px', fontWeight: 500 }}>Tên tàu</td>
                                  <td style={{ padding: '9px 12px', color: '#0f172a', fontWeight: 600 }}>{form.source.vesselName || step1VesselInfo?.vesselName || '-'}</td>
                                  <td style={{ padding: '9px 12px', background: '#f8fafc', color: '#64748b', width: '180px', fontWeight: 500 }}>Số chuyến (Voyage)</td>
                                  <td style={{ padding: '9px 12px', color: '#0f172a', fontWeight: 600 }}>{form.source.voyageNumber || step1VesselInfo?.voyageNumber || '-'}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '9px 12px', background: '#f8fafc', color: '#64748b', fontWeight: 500 }}>Hãng tàu</td>
                                  <td style={{ padding: '9px 12px', color: '#0f172a' }}>{step1VesselInfo?.shippingLine || form.source.shippingLine || '-'}</td>
                                  <td style={{ padding: '9px 12px', background: '#f8fafc', color: '#64748b', fontWeight: 500 }}>Cảng dỡ (POD)</td>
                                  <td style={{ padding: '9px 12px', color: '#0f172a' }}>{form.source.dischargePort || step1VesselInfo?.dischargePort || '-'}</td>
                                </tr>
                                <tr>
                                  <td style={{ padding: '9px 12px', background: '#f8fafc', color: '#64748b', fontWeight: 500 }}>Ngày tàu đến (ETA)</td>
                                  <td style={{ padding: '9px 12px', color: '#0f172a' }}>
                                    {step1VesselInfo?.eta ? new Date(step1VesselInfo.eta).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                                  </td>
                                  <td style={{ padding: '9px 12px', background: '#f8fafc', color: '#64748b', fontWeight: 500 }}>Hạn CY Cut-off</td>
                                  <td style={{ padding: '9px 12px', color: '#0f172a' }}>
                                    {form.source.cyCutoff ? new Date(form.source.cyCutoff).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {emailSource === sourceKey && verifiedSource !== sourceKey && !sampleMode && (
                    <div ref={emailPanelRef} style={{ scrollMargin: '40px' }}>
                      <ServiceSourceEmailPanel
                        recipientEmail={profile.data?.email}
                        key={sourceKey}
                        draftId={id}
                        request={payload()}
                        onBusy={setEmailBusy}
                        onVerified={() => {
                          setVerifiedSource(sourceKey)
                          setEmailSource('')
                          setStep(1)
                        }}
                      />
                    </div>
                  )}

                  {verifiedSource === sourceKey && (
                    <div className="epd-info">
                      <ShieldCheck size={18} />
                      <p>Đã xác thực email thành công cho hồ sơ này. Bạn có thể chuyển sang bước tiếp theo.</p>
                    </div>
                  )}
                </section>
              )}

              {/* BƯỚC 2: KHAI BÁO CONTAINER */}
              {step === 1 && (
                <section className="epd-stage" aria-label="Khai báo container">
                  <div className="epd-stage-heading">
                    <span>02</span>
                    <div>
                      <h3>{form.flow === 'IMPORT' ? 'Khai báo container lấy nguyên' : 'Khai báo danh sách container xuất'}</h3>
                      <p>
                        {form.flow === 'IMPORT'
                          ? 'Tích chọn một hoặc nhiều container cần lấy nguyên. Tích vào ô “Hàng phải niêm phong hải quan” nếu có chì niêm phong.'
                          : 'Chỉ chọn container thuộc Booking xuất đã được công bố. Thông tin nguồn được điền sẵn theo container đã chọn.'}
                      </p>
                    </div>
                  </div>

                  {form.flow === 'IMPORT' ? (
                    // GIAO HÀNG NHẬP: Quy trình tương tự bên xuất (Nhập B/L -> Hiện danh sách container Hãng tàu -> Tích chọn)
                    <div className="epd-import-progressive-flow" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {!step2BlConfirmed ? (
                        /* GIAI ĐOẠN 1 (HÀNG NHẬP): NHẬP SỐ VẬN ĐƠN (B/L) */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '18px', maxWidth: '640px' }}>
                            <div style={{ marginBottom: '12px' }}>
                              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                                Khai báo Số Vận Đơn (Bill of Lading / B/L)
                              </h4>
                              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                                Nhập số Vận đơn (B/L) cho chuyến tàu <strong>{form.source.vesselName || 'nhập khẩu'}</strong> (Lệnh eDO: {form.source.referenceNumber || 'eDO'}).
                                {form.lines.length > 0 && ' (Nhập số B/L mới để gom thêm container vào đơn này)'}
                              </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                                Số Vận đơn (B/L) <span style={{ color: '#dc2626' }}>*</span>
                              </label>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                  aria-label="Nhập số Vận Đơn nhập"
                                  value={step2BlInput}
                                  onChange={e => setStep2BlInput(e.target.value.toUpperCase())}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      handleConfirmBl()
                                    }
                                  }}
                                  placeholder="Nhập số B/L (VD: BL-INB-DAD-2601, BL-INB-DAD-2602, BL-VNDAD-001...)"
                                  style={{
                                    flex: 1,
                                    height: '38px',
                                    padding: '0 12px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    fontFamily: 'monospace',
                                    border: '1px solid #94a3b8',
                                    borderRadius: '6px',
                                    background: '#ffffff',
                                    textTransform: 'uppercase',
                                  }}
                                />
                                <button
                                  type="button"
                                  className="epc-button primary"
                                  onClick={() => handleConfirmBl()}
                                  style={{ height: '38px', padding: '0 18px', fontSize: '13px', fontWeight: 600 }}
                                >
                                  Xác nhận
                                </button>
                              </div>
                              <small style={{ color: '#64748b', fontSize: '12px' }}>
                                Nhập mã Vận đơn và nhấn <strong>Xác nhận</strong> để tải danh sách Container tương ứng từ Hãng tàu.
                              </small>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>💡 Vận đơn mẫu gợi ý:</span>
                                {['BL-INB-DAD-2601', 'BL-INB-DAD-2602', 'BL-VNDAD-001'].map(blCode => (
                                  <button
                                    key={blCode}
                                    type="button"
                                    onClick={() => {
                                      setStep2BlInput(blCode)
                                      handleConfirmBl(blCode)
                                    }}
                                    style={{
                                      padding: '2px 8px',
                                      fontSize: '11px',
                                      fontFamily: 'monospace',
                                      borderRadius: '4px',
                                      border: '1px solid #bfdbfe',
                                      background: '#eff6ff',
                                      color: '#1d4ed8',
                                      cursor: 'pointer',
                                      fontWeight: 500,
                                    }}
                                  >
                                    {blCode}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* BẢNG TỔNG HỢP CONTAINER ĐÃ GOM KHI ĐANG ĐỔI / NHẬP THÊM B/L */}
                          {form.lines.length > 0 && (
                            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <div>
                                  <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                                    Danh sách Container đã gom trong đơn ({form.lines.length} Container)
                                  </strong>
                                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                                    Các container này được giữ nguyên. Sau khi nhập B/L mới ở trên, bạn có thể tích chọn thêm container để gom chung.
                                  </p>
                                </div>
                              </div>

                              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                  <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                      <th style={{ padding: '8px 10px', width: '40px', textAlign: 'center' }}>STT</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Số Container</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Vận Đơn (B/L)</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Loại</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Số Seal (Chì)</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Trọng lượng (kg)</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Hàng hóa</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>Niêm phong HQ</th>
                                      <th style={{ padding: '8px 10px', width: '50px', textAlign: 'center', fontWeight: 600 }}>Bỏ gom</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {form.lines.map((line, idx) => {
                                      const snap = snapshots[line.sourceContainerId] || {}
                                      const contNum = snap.containerNumber || line.declaration?.containerNumber || line.sourceContainerId
                                      const typeCode = snap.typeCode || line.declaration?.isoCode || '40HC'
                                      const sealNum = snap.sealNumber || line.declaration?.sealNumber || '-'
                                      const grossWeight = snap.grossWeightKg || line.declaration?.weightKg || '-'
                                      const lineBl = snap.blNumber || line.blNumber || line.declaration?.blNumber || form.source.blNumber || '-'

                                      return (
                                        <tr key={line.sourceContainerId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                                          <td style={{ padding: '8px 10px' }}>
                                            <strong style={{ fontFamily: 'monospace', fontSize: '13px', color: '#0f172a' }}>{contNum}</strong>
                                          </td>
                                          <td style={{ padding: '8px 10px' }}>
                                            <span style={{ background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', display: 'inline-block' }}>
                                              {lineBl}
                                            </span>
                                          </td>
                                          <td style={{ padding: '8px 10px', color: '#475569' }}>{typeCode}</td>
                                          <td style={{ padding: '8px 10px', color: '#475569' }}>{sealNum}</td>
                                          <td style={{ padding: '8px 10px', color: '#475569' }}>
                                            {typeof grossWeight === 'number' ? grossWeight.toLocaleString('vi-VN') : grossWeight} kg
                                          </td>
                                          <td style={{ padding: '8px 10px', color: '#475569' }}>{snap.commodity || line.declaration?.commodity || 'Hàng nhập khẩu'}</td>
                                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                            <input
                                              type="checkbox"
                                              checked={!!line.customsSealRequired}
                                              onChange={e =>
                                                changeLine(line.sourceContainerId, l => ({
                                                  ...l,
                                                  customsSealRequired: e.target.checked,
                                                }))
                                              }
                                              title="Tích nếu có niêm phong hải quan"
                                            />
                                          </td>
                                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                            <button
                                              type="button"
                                              onClick={() => removeContainerRow(line.sourceContainerId)}
                                              title="Bỏ container này khỏi đơn"
                                              style={{
                                                border: 'none',
                                                background: 'transparent',
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                borderRadius: '4px',
                                              }}
                                            >
                                              <Trash2 size={15} />
                                            </button>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* GIAI ĐOẠN 2 (HÀNG NHẬP): HIỆN DANH SÁCH CONTAINER TỪ HÃNG TÀU & TÍCH CHỌN - GIAO DIỆN CHUẨN NHƯ XUẤT */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {/* Thanh trạng thái B/L gọn gàng */}
                          <div style={{
                            padding: '10px 14px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '13px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <span style={{ color: '#475569' }}>Số Vận đơn (B/L):</span>
                              <strong style={{ color: '#0f172a', fontFamily: 'monospace', fontSize: '14px' }}>{form.source.blNumber || step2BlInput}</strong>
                              <span style={{ color: '#94a3b8' }}>·</span>
                              <span style={{ color: '#475569' }}>Lệnh eDO: <strong>{form.source.referenceNumber || 'eDO'}</strong></span>
                              <span style={{ color: '#94a3b8' }}>·</span>
                              <span style={{ color: '#475569' }}>Tàu: <strong>{form.source.vesselName || 'Tàu nhập'}</strong> ({form.source.voyageNumber})</span>
                            </div>

                            <button
                              type="button"
                              onClick={handleBackToChangeBl}
                              style={{
                                fontSize: '12px',
                                color: '#0284c7',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: '4px 8px',
                                fontWeight: 600
                              }}
                            >
                              Đổi số B/L khác
                            </button>
                          </div>

                          {/* BẢNG TÍCH CHỌN CONTAINER BASIC */}
                          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                              <div>
                                <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                                  Danh sách Container từ Hãng tàu ({availableContainersForBl.length})
                                </strong>
                                <span style={{ fontSize: '12px', color: '#475569', marginLeft: '12px' }}>
                                  Đã chọn: <strong style={{ color: '#0f172a' }}>{form.lines.length}</strong> / {availableContainersForBl.length} container
                                </span>
                              </div>

                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={handleSelectAllExportContainers}
                                  style={{
                                    fontSize: '12px',
                                    padding: '5px 12px',
                                    background: '#f8fafc',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    color: '#1e293b',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Tích chọn tất cả
                                </button>
                                <button
                                  type="button"
                                  onClick={handleDeselectAllExportContainers}
                                  style={{
                                    fontSize: '12px',
                                    padding: '5px 12px',
                                    background: '#f8fafc',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    color: '#64748b',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Bỏ chọn tất cả
                                </button>
                              </div>
                            </div>

                            {/* BẢNG HIỂN THỊ CONTAINER */}
                            {availableContainersForBl.length === 0 ? (
                              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                                {rawContainersForBl.length > 0 ? (
                                  <div style={{ padding: '16px', background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '24px' }}>✅</span>
                                    <strong style={{ fontSize: '13px', color: '#166534' }}>
                                      Tất cả {rawContainersForBl.length} container thuộc Vận đơn này đã được đăng ký booking &amp; thanh toán hoàn tất!
                                    </strong>
                                    <span style={{ fontSize: '12px', color: '#15803d' }}>
                                      Không còn container nào chờ khai báo. Vui lòng nhập số B/L khác hoặc nhấn Tiếp tục nếu đã chọn container từ trước.
                                    </span>
                                  </div>
                                ) : (
                                  'Không tìm thấy container nào thuộc số B/L này từ Hãng tàu.'
                                )}
                              </div>
                            ) : (
                              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                  <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                      <th style={{ width: '44px', padding: '9px 12px', textAlign: 'center' }}>
                                        <input
                                          type="checkbox"
                                          checked={availableContainersForBl.length > 0 && form.lines.length === availableContainersForBl.length}
                                          onChange={e => e.target.checked ? handleSelectAllExportContainers() : handleDeselectAllExportContainers()}
                                          style={{ cursor: 'pointer' }}
                                        />
                                      </th>
                                      <th style={{ padding: '9px 12px', fontWeight: 600 }}>Số Container</th>
                                      <th style={{ padding: '9px 12px', fontWeight: 600 }}>Loại</th>
                                      <th style={{ padding: '9px 12px', fontWeight: 600 }}>Số Chì (Seal)</th>
                                      <th style={{ padding: '9px 12px', fontWeight: 600 }}>Trọng lượng (kg)</th>
                                      <th style={{ padding: '9px 12px', fontWeight: 600 }}>Hàng hóa</th>
                                      <th style={{ padding: '9px 12px', fontWeight: 600 }}>Nơi trả rỗng / Cảng dỡ</th>
                                      <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600 }}>Niêm phong HQ</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {availableContainersForBl.map((cont, idx) => {
                                      const cNum = (cont.containerNumber || '').toUpperCase()
                                      const matchedLine = form.lines.find(l => {
                                        const snapNum = snapshots[l.sourceContainerId]?.containerNumber
                                        const decNum = l.declaration?.containerNumber
                                        return (snapNum || decNum) === cNum
                                      })
                                      const isChecked = Boolean(matchedLine)

                                      return (
                                        <tr
                                          key={cont.containerNumber || idx}
                                          onClick={() => handleToggleExportContainer(cont)}
                                          style={{
                                            borderBottom: '1px solid #f1f5f9',
                                            background: isChecked ? '#f1f5f9' : '#ffffff',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => { }}
                                              style={{ cursor: 'pointer' }}
                                            />
                                          </td>
                                          <td style={{ padding: '9px 12px' }}>
                                            <strong style={{ fontFamily: 'monospace', fontSize: '13px', color: isChecked ? '#0f172a' : '#334155' }}>
                                              {cont.containerNumber}
                                            </strong>
                                          </td>
                                          <td style={{ padding: '9px 12px', color: '#475569' }}>
                                            {cont.typeCode || '40HC'}
                                            {cont.isReefer && <span style={{ marginLeft: '4px', color: '#0284c7', fontSize: '11px', fontWeight: 600 }}>(Lạnh)</span>}
                                            {cont.isDG && <span style={{ marginLeft: '4px', color: '#dc2626', fontSize: '11px', fontWeight: 600 }}>(DG)</span>}
                                          </td>
                                          <td style={{ padding: '9px 12px', color: '#475569' }}>
                                            {cont.sealNumber || '-'}
                                          </td>
                                          <td style={{ padding: '9px 12px', color: '#475569' }}>
                                            {(cont.grossWeightKg || 25000).toLocaleString('vi-VN')} kg
                                          </td>
                                          <td style={{ padding: '9px 12px', color: '#475569' }}>
                                            {cont.commodity || 'Hàng nhập khẩu'}
                                          </td>
                                          <td style={{ padding: '9px 12px', color: '#475569' }}>
                                            {cont.emptyReturnDepot || form.source.emptyReturnDepot || cont.dischargePort || 'Depot Cảng Tiên Sa'}
                                          </td>
                                          <td style={{ padding: '9px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                            <input
                                              type="checkbox"
                                              disabled={!isChecked}
                                              checked={Boolean(matchedLine?.customsSealRequired)}
                                              onChange={e => {
                                                if (matchedLine) {
                                                  changeLine(matchedLine.sourceContainerId, l => ({
                                                    ...l,
                                                    customsSealRequired: e.target.checked,
                                                  }))
                                                }
                                              }}
                                              title={isChecked ? 'Tích nếu container có chì niêm phong Hải quan' : 'Tích chọn container trước'}
                                              style={{ cursor: isChecked ? 'pointer' : 'not-allowed' }}
                                            />
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Ô thêm container ngoài danh mục (nếu có) */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                              <input
                                value={step2ContInput}
                                onChange={e => setStep2ContInput(e.target.value.toUpperCase())}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleAddNewContainer()
                                  }
                                }}
                                placeholder="Nhập thêm số container khác ngoài danh sách (nếu có)"
                                style={{ flex: '1 1 240px', height: '34px', padding: '0 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', textTransform: 'uppercase', fontWeight: 600 }}
                              />
                              <button
                                type="button"
                                onClick={() => handleAddNewContainer()}
                                style={{ height: '34px', padding: '0 12px', fontSize: '12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#334155', cursor: 'pointer', fontWeight: 600 }}
                              >
                                + Thêm container
                              </button>
                            </div>
                          </div>

                          {/* BẢNG TỔNG KẾT VÀ CHỈNH SỬA CÁC CONTAINER ĐÃ CHỌN */}
                          {form.lines.length > 0 && (
                            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', marginTop: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                                  Danh sách Container lấy nguyên đã chọn ({form.lines.length} Container)
                                </strong>
                                <span style={{ fontSize: '12px', color: '#64748b' }}>
                                  Tích chọn ô Niêm phong HQ nếu container có chì hải quan
                                </span>
                              </div>

                              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                  <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                      <th style={{ padding: '8px 10px', width: '40px', textAlign: 'center' }}>STT</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Số Container</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Vận Đơn (B/L)</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Loại ISO</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Số Seal (Chì)</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Trọng lượng (kg)</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Hàng hóa</th>
                                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>Niêm phong HQ</th>
                                      <th style={{ padding: '8px 10px', width: '50px', textAlign: 'center', fontWeight: 600 }}>Bỏ chọn</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {form.lines.map((line, idx) => {
                                      const snap = snapshots[line.sourceContainerId] || {}
                                      const contNum = snap.containerNumber || line.declaration?.containerNumber || line.sourceContainerId
                                      const typeCode = snap.typeCode || line.declaration?.isoCode || '40HC'
                                      const sealNum = snap.sealNumber || line.declaration?.sealNumber || '-'
                                      const grossWeight = snap.grossWeightKg || line.declaration?.weightKg || '-'
                                      const lineBl = snap.blNumber || line.blNumber || line.declaration?.blNumber || form.source.blNumber || '-'

                                      return (
                                        <tr key={line.sourceContainerId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                                          <td style={{ padding: '8px 10px' }}>
                                            <strong style={{ fontFamily: 'monospace', fontSize: '13px', color: '#0f172a' }}>{contNum}</strong>
                                          </td>
                                          <td style={{ padding: '8px 10px' }}>
                                            <span style={{ background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', display: 'inline-block' }}>
                                              {lineBl}
                                            </span>
                                          </td>
                                          <td style={{ padding: '8px 10px', color: '#475569' }}>{typeCode}</td>
                                          <td style={{ padding: '8px 10px', color: '#475569' }}>{sealNum}</td>
                                          <td style={{ padding: '8px 10px', color: '#475569' }}>
                                            {typeof grossWeight === 'number' ? grossWeight.toLocaleString('vi-VN') : grossWeight} kg
                                          </td>
                                          <td style={{ padding: '8px 10px', color: '#475569' }}>{snap.commodity || line.declaration?.commodity || 'Hàng nhập khẩu'}</td>
                                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                            <input
                                              type="checkbox"
                                              checked={!!line.customsSealRequired}
                                              onChange={e =>
                                                changeLine(line.sourceContainerId, l => ({
                                                  ...l,
                                                  customsSealRequired: e.target.checked,
                                                }))
                                              }
                                              title="Tích nếu có niêm phong hải quan"
                                            />
                                          </td>
                                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                            <button
                                              type="button"
                                              onClick={() => removeContainerRow(line.sourceContainerId)}
                                              title="Bỏ container này khỏi đơn"
                                              style={{
                                                border: 'none',
                                                background: 'transparent',
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                borderRadius: '4px',
                                              }}
                                            >
                                              <Trash2 size={15} />
                                            </button>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    // HẠ HÀNG XUẤT: Quy trình tuần tự (Nhập B/L -> Hiện danh sách container Hãng tàu -> Tích chọn)
                    <div className="epd-export-progressive-flow" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {!step2BlConfirmed ? (
                        /* GIAI ĐOẠN 1 (HÀNG XUẤT): NHẬP SỐ VẬN ĐƠN (B/L) - GIAO DIỆN BASIC */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '18px', maxWidth: '640px' }}>
                            <div style={{ marginBottom: '12px' }}>
                              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                                Khai báo Số Vận Đơn (Bill of Lading / B/L)
                              </h4>
                              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                                Tự nhập số Vận đơn (B/L) cho chuyến tàu <strong>{form.source.vesselName || 'xuất khẩu'}</strong> (Booking: {form.source.referenceNumber || 'BK-EXP'}).
                                {form.lines.length > 0 && ' (Nhập số B/L mới để gom thêm container vào đơn này)'}
                              </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                                Số Vận đơn (B/L) <span style={{ color: '#dc2626' }}>*</span>
                              </label>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                  aria-label="Nhập số Vận Đơn xuất"
                                  value={step2BlInput}
                                  onChange={e => setStep2BlInput(e.target.value.toUpperCase())}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      handleConfirmBl()
                                    }
                                  }}
                                  placeholder="Nhập số B/L (VD: BL-OC2612E-1903, BL-EXP-DAD-2601...)"
                                  style={{
                                    flex: 1,
                                    height: '38px',
                                    padding: '0 12px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    fontFamily: 'monospace',
                                    border: '1px solid #94a3b8',
                                    borderRadius: '6px',
                                    background: '#ffffff',
                                    textTransform: 'uppercase',
                                  }}
                                />
                                <button
                                  type="button"
                                  className="epc-button primary"
                                  onClick={() => handleConfirmBl()}
                                  style={{ height: '38px', padding: '0 18px', fontSize: '13px', fontWeight: 600 }}
                                >
                                  Xác nhận
                                </button>
                              </div>
                              <small style={{ color: '#64748b', fontSize: '12px' }}>
                                Nhập mã Vận đơn và nhấn <strong>Xác nhận</strong> để tải danh sách Container tương ứng từ Hãng tàu.
                              </small>
                            </div>
                          </div>

                          {/* BẢNG TỔNG HỢP CONTAINER ĐÃ GOM KHI ĐANG ĐỔI / NHẬP THÊM B/L */}
                          {form.lines.length > 0 && (
                            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <div>
                                  <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                                    Danh sách Container đã gom trong đơn ({form.lines.length} Container)
                                  </strong>
                                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                                    Các container này được giữ nguyên. Sau khi nhập B/L mới ở trên, bạn có thể tích chọn thêm container để gom chung.
                                  </p>
                                </div>
                              </div>

                              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                  <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                      <th style={{ padding: '8px 10px', width: '40px', textAlign: 'center' }}>STT</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Số Container</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Vận Đơn (B/L)</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Loại</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Số Seal (Chì)</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Trọng lượng (VGM)</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Hàng hóa</th>
                                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Cảng dỡ</th>
                                      <th style={{ padding: '8px 10px', width: '50px', textAlign: 'center', fontWeight: 600 }}>Bỏ gom</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {form.lines.map((line, idx) => {
                                      const snap = snapshots[line.sourceContainerId] || {}
                                      const contNum = snap.containerNumber || line.declaration?.containerNumber || line.sourceContainerId
                                      const typeCode = snap.typeCode || line.declaration?.isoCode || '40HC'
                                      const sealNum = snap.sealNumber || line.declaration?.sealNumber || '-'
                                      const grossWeight = snap.grossWeightKg || line.declaration?.weightKg || '-'
                                      const lineBl = snap.blNumber || line.blNumber || line.declaration?.blNumber || form.source.blNumber || '-'

                                      return (
                                        <tr key={line.sourceContainerId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                                          <td style={{ padding: '8px 10px' }}>
                                            <strong style={{ fontFamily: 'monospace', fontSize: '13px', color: '#0f172a' }}>{contNum}</strong>
                                          </td>
                                          <td style={{ padding: '8px 10px' }}>
                                            <span style={{ background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', display: 'inline-block' }}>
                                              {lineBl}
                                            </span>
                                          </td>
                                          <td style={{ padding: '8px 10px', color: '#475569' }}>{typeCode}</td>
                                          <td style={{ padding: '8px 10px', color: '#475569' }}>{sealNum}</td>
                                          <td style={{ padding: '8px 10px', color: '#475569' }}>
                                            {typeof grossWeight === 'number' ? grossWeight.toLocaleString('vi-VN') : grossWeight} kg
                                          </td>
                                          <td style={{ padding: '8px 10px', color: '#475569' }}>{snap.commodity || line.declaration?.commodity || 'Hàng xuất khẩu'}</td>
                                          <td style={{ padding: '8px 10px', color: '#475569' }}>{snap.dischargePort || line.declaration?.dischargePort || form.source.dischargePort || 'VNHPH'}</td>
                                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                            <button
                                              type="button"
                                              onClick={() => removeContainerRow(line.sourceContainerId)}
                                              title="Bỏ container này khỏi đơn"
                                              style={{
                                                border: 'none',
                                                background: 'transparent',
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                borderRadius: '4px',
                                              }}
                                            >
                                              <Trash2 size={15} />
                                            </button>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* GIAI ĐOẠN 2 (HÀNG XUẤT): HIỆN DANH SÁCH CONTAINER TỪ HÃNG TÀU & TÍCH CHỌN - GIAO DIỆN BASIC */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {/* Thanh trạng thái B/L gọn gàng */}
                          <div style={{
                            padding: '10px 14px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '13px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <span style={{ color: '#475569' }}>Số Vận đơn (B/L):</span>
                              <strong style={{ color: '#0f172a', fontFamily: 'monospace', fontSize: '14px' }}>{form.source.blNumber}</strong>
                              <span style={{ color: '#94a3b8' }}>·</span>
                              <span style={{ color: '#475569' }}>Booking: <strong>{form.source.referenceNumber || 'BK-EXP'}</strong></span>
                              <span style={{ color: '#94a3b8' }}>·</span>
                              <span style={{ color: '#475569' }}>Tàu: <strong>{form.source.vesselName || 'Tàu xuất'}</strong> ({form.source.voyageNumber})</span>
                            </div>

                            <button
                              type="button"
                              onClick={handleBackToChangeBl}
                              style={{
                                fontSize: '12px',
                                color: '#0284c7',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: '4px 8px',
                                fontWeight: 600
                              }}
                            >
                              Đổi số B/L khác
                            </button>
                          </div>

                          {/* BẢNG TÍCH CHỌN CONTAINER BASIC */}
                          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                              <div>
                                <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                                  Danh sách Container từ Hãng tàu ({availableContainersForBl.length})
                                </strong>
                                <span style={{ fontSize: '12px', color: '#475569', marginLeft: '12px' }}>
                                  Đã chọn: <strong style={{ color: '#0f172a' }}>{form.lines.length}</strong> / {availableContainersForBl.length} container
                                </span>
                              </div>

                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={handleSelectAllExportContainers}
                                  style={{
                                    fontSize: '12px',
                                    padding: '5px 12px',
                                    background: '#f8fafc',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    color: '#1e293b',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Tích chọn tất cả
                                </button>
                                <button
                                  type="button"
                                  onClick={handleDeselectAllExportContainers}
                                  style={{
                                    fontSize: '12px',
                                    padding: '5px 12px',
                                    background: '#f8fafc',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    color: '#64748b',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Bỏ chọn tất cả
                                </button>
                              </div>
                            </div>

                            {/* BẢNG HIỂN THỊ CONTAINER */}
                            {availableContainersForBl.length === 0 ? (
                              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                                {rawContainersForBl.length > 0 ? (
                                  <div style={{ padding: '16px', background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '24px' }}>✅</span>
                                    <strong style={{ fontSize: '13px', color: '#166534' }}>
                                      Tất cả {rawContainersForBl.length} container thuộc Vận đơn này đã được đăng ký booking &amp; thanh toán hoàn tất!
                                    </strong>
                                    <span style={{ fontSize: '12px', color: '#15803d' }}>
                                      Không còn container nào chờ khai báo. Vui lòng nhập số B/L khác hoặc nhấn Tiếp tục nếu đã chọn container từ trước.
                                    </span>
                                  </div>
                                ) : (
                                  'Không tìm thấy container nào thuộc số B/L này từ Hãng tàu.'
                                )}
                              </div>
                            ) : (
                              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                  <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                      <th style={{ width: '44px', padding: '9px 12px', textAlign: 'center' }}>
                                        <input
                                          type="checkbox"
                                          checked={availableContainersForBl.length > 0 && form.lines.length === availableContainersForBl.length}
                                          onChange={e => e.target.checked ? handleSelectAllExportContainers() : handleDeselectAllExportContainers()}
                                          style={{ cursor: 'pointer' }}
                                        />
                                      </th>
                                      <th style={{ padding: '9px 12px', fontWeight: 600 }}>Số Container</th>
                                      <th style={{ padding: '9px 12px', fontWeight: 600 }}>Loại</th>
                                      <th style={{ padding: '9px 12px', fontWeight: 600 }}>Số Chì (Seal)</th>
                                      <th style={{ padding: '9px 12px', fontWeight: 600 }}>Trọng lượng (VGM)</th>
                                      <th style={{ padding: '9px 12px', fontWeight: 600 }}>Hàng hóa</th>
                                      <th style={{ padding: '9px 12px', fontWeight: 600 }}>Cảng dỡ</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {availableContainersForBl.map((cont, idx) => {
                                      const cNum = (cont.containerNumber || '').toUpperCase()
                                      const isChecked = form.lines.some(l => {
                                        const snapNum = snapshots[l.sourceContainerId]?.containerNumber
                                        const decNum = l.declaration?.containerNumber
                                        return (snapNum || decNum) === cNum
                                      })

                                      return (
                                        <tr
                                          key={cont.containerNumber || idx}
                                          onClick={() => handleToggleExportContainer(cont)}
                                          style={{
                                            borderBottom: '1px solid #f1f5f9',
                                            background: isChecked ? '#f1f5f9' : '#ffffff',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => { }}
                                              style={{ cursor: 'pointer' }}
                                            />
                                          </td>
                                          <td style={{ padding: '9px 12px' }}>
                                            <strong style={{ fontFamily: 'monospace', fontSize: '13px', color: isChecked ? '#0f172a' : '#334155' }}>
                                              {cont.containerNumber}
                                            </strong>
                                          </td>
                                          <td style={{ padding: '9px 12px', color: '#475569' }}>
                                            {cont.typeCode || '40HC'}
                                            {cont.isReefer && <span style={{ marginLeft: '4px', color: '#0284c7', fontSize: '11px', fontWeight: 600 }}>(Lạnh)</span>}
                                            {cont.isDG && <span style={{ marginLeft: '4px', color: '#dc2626', fontSize: '11px', fontWeight: 600 }}>(DG)</span>}
                                          </td>
                                          <td style={{ padding: '9px 12px', color: '#475569' }}>
                                            {cont.sealNumber || '-'}
                                          </td>
                                          <td style={{ padding: '9px 12px', color: '#475569' }}>
                                            {(cont.grossWeightKg || 25000).toLocaleString('vi-VN')} kg
                                          </td>
                                          <td style={{ padding: '9px 12px', color: '#475569' }}>
                                            {cont.commodity || 'Hàng xuất khẩu'}
                                          </td>
                                          <td style={{ padding: '9px 12px', color: '#475569' }}>
                                            {cont.dischargePort || 'VNHPH'}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Ô thêm container ngoài danh mục (nếu có) */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                              <input
                                value={step2ContInput}
                                onChange={e => setStep2ContInput(e.target.value.toUpperCase())}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleAddNewContainer()
                                  }
                                }}
                                placeholder="Nhập thêm số container khác ngoài danh sách (nếu có)"
                                style={{ flex: '1 1 240px', height: '34px', padding: '0 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', textTransform: 'uppercase', fontWeight: 600 }}
                              />
                              <button
                                type="button"
                                onClick={() => handleAddNewContainer()}
                                style={{ height: '34px', padding: '0 12px', fontSize: '12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#334155', cursor: 'pointer', fontWeight: 600 }}
                              >
                                + Thêm container
                              </button>
                            </div>
                          </div>

                          {/* BẢNG TỔNG KẾT VÀ CHỈNH SỬA CÁC CONTAINER ĐÃ CHỌN */}
                          {form.lines.length > 0 && (
                            <div style={{ marginTop: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                                  Chi tiết khai báo {form.lines.length} Container xuất đã chọn:
                                </h4>
                                <span style={{ fontSize: '12px', color: '#64748b' }}>
                                  (Có thể điều chỉnh số Seal hoặc trọng lượng VGM trước khi tiếp tục)
                                </span>
                              </div>

                              {form.lines.map((line, idx) => (
                                <ExportDeclarationFields
                                  key={line.sourceContainerId || idx}
                                  index={idx}
                                  sourceLocked
                                  value={line.declaration}
                                  onChange={(field, val) =>
                                    changeLine(line.sourceContainerId, cur => ({
                                      ...cur,
                                      declaration: { ...cur.declaration, [field]: val },
                                    }))
                                  }
                                  onDelete={() => removeContainerRow(line.sourceContainerId)}
                                  onValidateContainer={msg => setFeedback(msg)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* BƯỚC 3: KHAI BÁO DỊCH VỤ ĐÍNH KÈM & CLONE */}
              {step === 2 && (
                <section className="epd-stage" aria-label="Khai báo dịch vụ đính kèm">
                  <div className="epd-stage-heading">
                    <span>03</span>
                    <div>
                      <h3>Khai báo dịch vụ đính kèm</h3>
                      <p>Chọn dịch vụ kèm (Lưu bãi, Cắm điện container lạnh...). Sử dụng nút Clone để áp dụng nhanh sang các cont khác.</p>
                    </div>
                  </div>

                  <div className="epd-form-grid">
                    <Field
                      label={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span>Thời gian dự kiến thực hiện <b className="epd-required">*</b></span>
                          {autoSchedule?.plannedAt && form.plannedAt !== autoSchedule.plannedAt && (
                            <button
                              type="button"
                              className="epc-button secondary"
                              style={{ padding: '2px 8px', fontSize: '11px', height: '22px', borderRadius: '4px', cursor: 'pointer' }}
                              onClick={() => update('plannedAt', autoSchedule.plannedAt)}
                            >
                              ↺ Đặt lại ngày tự động ({autoSchedule.plannedAt})
                            </button>
                          )}
                        </div>
                      }
                      wide
                    >
                      <input
                        aria-label="Thời gian dự kiến thực hiện"
                        type="datetime-local"
                        value={form.plannedAt}
                        min={autoSchedule.minDate || undefined}
                        max={autoSchedule.maxDate || undefined}
                        onChange={event => update('plannedAt', event.target.value)}
                      />
                      {autoSchedule.notice && (
                        <small className="epd-field-hint" style={{ color: '#0369a1', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>💡</span>
                          <span>{autoSchedule.notice}</span>
                        </small>
                      )}
                    </Field>
                    <Field label={<>Người liên hệ <b className="epd-required">*</b></>}>
                      <input
                        maxLength={100}
                        value={form.contactName}
                        onChange={event => update('contactName', event.target.value)}
                        placeholder="Họ và tên người liên hệ"
                      />
                    </Field>
                    <Field label={<>Điện thoại liên hệ <b className="epd-required">*</b></>}>
                      <input
                        type="tel"
                        maxLength={30}
                        value={form.contactPhone}
                        onChange={event => update('contactPhone', event.target.value)}
                        placeholder="Số điện thoại doanh nghiệp / liên hệ"
                      />
                      <small style={{ color: '#64748b', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                        Tự động điền theo số điện thoại công ty ({form.invoiceBuyer.name || 'NexusPort Logistics'})
                      </small>
                    </Field>
                  </div>

                  {form.lines.length > 1 && (
                    <div className="epd-copy-box">
                      <div className="epd-section-label">
                        <Copy size={17} />
                        <h4>Sao chép dịch vụ đính kèm (Clone)</h4>
                      </div>
                      <p>Chọn container nguồn để clone các dịch vụ đính kèm đã chọn sang toàn bộ các container còn lại.</p>
                      <div className="epd-copy-actions">
                        <select
                          aria-label="Container nguồn sao chép dịch vụ"
                          value={copyFrom || form.lines[0].sourceContainerId}
                          onChange={event => {
                            setCopyFrom(event.target.value)
                            setCopyPreview(null)
                            setManualContainer('')
                          }}
                        >
                          {form.lines.map((line, idx) => (
                            <option key={line.sourceContainerId} value={line.sourceContainerId}>
                              {line.declaration?.containerNumber || snapshots[line.sourceContainerId]?.containerNumber || `Cont #${idx + 1}`}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="epc-button secondary"
                          onClick={() => setCopyPreview(copyFrom || form.lines[0].sourceContainerId)}
                        >
                          <Copy size={15} />
                          Clone sang các container khác
                        </button>
                      </div>

                      {copyPreview && (
                        <div className="epd-copy-preview">
                          <p>
                            Xác nhận sao chép toàn bộ dịch vụ kèm sang {form.lines.length - 1} container còn lại (hệ thống tự động bỏ qua Cắm điện lạnh đối với container khô).
                          </p>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="button" className="epc-button secondary" onClick={() => setCopyPreview(null)}>Hủy bỏ</button>
                            <button
                              type="button"
                              className="epc-button primary"
                              onClick={() => {
                                const sourceLine = form.lines.find(l => l.sourceContainerId === copyPreview)
                                if (sourceLine) {
                                  mutate(prev => ({
                                    ...prev,
                                    lines: prev.lines.map(l => {
                                      if (l.sourceContainerId === copyPreview) return l
                                      const targetRow = snapshots[l.sourceContainerId] || l.declaration || {}
                                      const isTargetDry = (targetRow.typeCode || targetRow.isoCode || '').toUpperCase().startsWith('20G') ||
                                        (targetRow.typeCode || targetRow.isoCode || '').toUpperCase().startsWith('40G') ||
                                        (targetRow.typeCode || targetRow.isoCode || '').toUpperCase().startsWith('GP')

                                      const filteredServices = sourceLine.services
                                        .filter(s => {
                                          if (s.serviceId === 'REEFER_POWER' && isTargetDry) return false
                                          return true
                                        })
                                        .map(s => ({ ...s }))

                                      return { ...l, services: filteredServices }
                                    }),
                                  }))
                                }
                                setCopyPreview(null)
                                setManualContainer('')
                              }}
                            >
                              <Check size={15} /> Đồng ý Clone
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="epd-line-list">
                    {form.lines.map((line, index) => {
                      const dec = line.declaration
                      const row = snapshots[line.sourceContainerId] ||
                        (containers.data?.items || []).find(c => containerId(c) === line.sourceContainerId) ||
                        dec
                      const contLabel = dec?.containerNumber || row?.containerNumber || `Container #${index + 1}`
                      const typeCode = (row?.typeCode || dec?.isoCode || '').toUpperCase()
                      const isReefer = typeCode.includes('RF') || typeCode.includes('RE') || typeCode.startsWith('22R') || typeCode.startsWith('45R') || Boolean(dec?.temperature)
                      const isDry = typeCode.startsWith('20G') || typeCode.startsWith('40G') || typeCode.startsWith('GP')

                      return (
                        <article className="epd-line-card" key={line.sourceContainerId}>
                          <header>
                            <span className="epd-container-icon"><Container size={22} /></span>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong>{contLabel}</strong>
                                {isReefer && (
                                  <span style={{ fontSize: '11px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '1px 6px', fontWeight: 600 }}>
                                    ❄️ Container Lạnh {dec?.temperature ? `(${dec.temperature}°C)` : ''}
                                  </span>
                                )}
                              </div>
                              <small>{dec?.isoCode || row?.typeCode || 'Container'} · {line.services.length} dịch vụ chọn</small>
                            </div>
                            <span className="epd-line-index">{String(index + 1).padStart(2, '0')}</span>
                          </header>

                          <div className="epd-line-content">
                            <div className="epd-main-service">
                              <ShieldCheck size={17} />
                              <div>
                                <small>TÁC NGHIỆP CHÍNH</small>
                                <strong>{main?.name || 'Tác nghiệp theo luồng'}</strong>
                              </div>
                            </div>

                            {addonOptions.length > 0 && (
                              <fieldset className="epd-addon-options">
                                <legend>Dịch vụ đính kèm</legend>
                                {addonOptions.map(service => {
                                  const isReeferService = service.id === 'REEFER_POWER'
                                  const disabled = isReeferService && isDry

                                  return (
                                    <label key={service.id} style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        disabled={disabled}
                                        checked={line.services.some(u => u.serviceId === service.id)}
                                        onChange={() => !disabled && toggleAddon(line.sourceContainerId, service)}
                                      />
                                      <span>
                                        {service.name}
                                        {disabled && <small style={{ color: '#dc2626', marginLeft: '4px' }}>(Chỉ áp dụng container lạnh)</small>}
                                        {!disabled && <small>{labels.unit[service.unit]}</small>}
                                      </span>
                                    </label>
                                  )
                                })}
                              </fieldset>
                            )}

                            {line.services.map(usage => {
                              const service = services.find(s => s.id === usage.serviceId)
                              if (!service || !timeUnit(service)) return null
                              return (
                                <div className="epd-time-block" key={usage.serviceId}>
                                  <div className="epd-section-label">
                                    <CalendarDays size={15} />
                                    <h4>{service.name}</h4>
                                    <small>Theo {labels.unit[service.unit]}</small>
                                  </div>
                                  <div className="epd-form-grid">
                                    <Field label={`Bắt đầu — ${service.name}`} hint="Nếu không chọn, tự lấy theo giờ dự kiến">
                                      <input
                                        type="datetime-local"
                                        value={usage.startsAt || ''}
                                        onChange={e => changeUsage(line.sourceContainerId, service.id, 'startsAt', e.target.value)}
                                      />
                                    </Field>
                                    <Field label={`Kết thúc / Hạn rút — ${service.name}`} hint="Nếu không chọn, tự lấy theo hạn lệnh giao nhận">
                                      <input
                                        type="datetime-local"
                                        min={usage.startsAt || undefined}
                                        value={usage.endsAt || ''}
                                        onChange={e => changeUsage(line.sourceContainerId, service.id, 'endsAt', e.target.value)}
                                      />
                                    </Field>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </article>
                      )
                    })}
                  </div>

                  <Field label="Ghi chú đăng ký">
                    <textarea
                      maxLength={1000}
                      rows={3}
                      value={form.note}
                      onChange={event => update('note', event.target.value)}
                      placeholder="Thông tin ghi chú cần lưu kèm hồ sơ giao nhận…"
                    />
                  </Field>
                </section>
              )}

              {/* BƯỚC 4: KHAI BÁO GIAO NHẬN (XE HOẶC SÀ LAN, HẠN LỆNH) */}
              {step === deliveryStep && (
                <DeliveryFields
                  delivery={form.delivery}
                  buyer={form.invoiceBuyer}
                  flow={form.flow}
                  sourceExpiry={form.flow === 'IMPORT' ? form.source.validUntil : (selectedBooking?.cyCutoff ? selectedBooking.cyCutoff.slice(0, 10) : form.source.validUntil)}
                  request={payload()}
                  containers={snapshots}
                  sampleMode={sampleMode}
                  autoSchedule={autoSchedule}
                  onDelivery={(field, value) => update('delivery', { ...form.delivery, [field]: value })}
                  onBuyer={(field, value) => update('invoiceBuyer', { ...form.invoiceBuyer, [field]: value })}
                />
              )}

              {/* BƯỚC 5: BỘ HỒ SƠ & CHỨNG TỪ */}
              {step === documentsStep && (
                <ServiceDocumentsStep
                  draftId={id}
                  payload={payload()}
                  flow={form.flow}
                  containers={form.lines.map(l => snapshots[l.sourceContainerId] || l.declaration).filter(Boolean)}
                  documents={form.delivery.documents || []}
                  fleetTrips={form.delivery.trips || []}
                  onChangeDocuments={docs => {
                    mutate(prev => ({
                      ...prev,
                      documents: docs,
                      delivery: { ...prev.delivery, documents: docs },
                    }))
                    setDirty(true)
                  }}
                  onConfirmedScope={scope => {
                    mutate(prev => ({
                      ...prev,
                      delivery: { ...prev.delivery, customsConfirmationScope: scope, customsCheckSkipped: false },
                    }))
                  }}
                />
              )}

              {/* BƯỚC CUỐI: TỔNG HỢP KIỂM TRA THÔNG TIN TRƯỚC KHI TÍNH TIỀN */}
              {step === reviewStep && (
                <section className="epd-stage" aria-label="Kiểm tra thông tin">
                  <div className="epd-stage-heading">
                    <span>{String(reviewStep + 1).padStart(2, '0')}</span>
                    <div>
                      <h3>Kiểm tra thông tin & Gửi đăng ký</h3>
                      <p>Xác nhận thông tin để gửi Dispatcher. Bạn sẽ thanh toán sau khi nhận kết quả và số tiền.</p>
                    </div>
                  </div>

                  <div className="epd-review-card">
                    <div className="epd-section-label">
                      <ClipboardList size={18} />
                      <h4>Hồ sơ đăng ký</h4>
                      <button type="button" className="epc-text-button" onClick={() => setStep(0)}>Chỉnh sửa</button>
                    </div>
                    <dl className="epd-review-facts">
                      <SummaryItem label="Tác nghiệp">{main?.name || 'Theo luồng'}</SummaryItem>
                      <SummaryItem label="Luồng hàng">{labels.direction[form.flow]}</SummaryItem>
                      <SummaryItem label={form.flow === 'EXPORT' ? 'Booking' : 'DO/eDO'}>{sourceLabel}</SummaryItem>
                      <SummaryItem label="Dự kiến thực hiện">{form.plannedAt ? draftDateTime(utcTime(form.plannedAt)) : 'Chưa khai báo'}</SummaryItem>
                      <SummaryItem label="Người liên hệ">{[form.contactName, form.contactPhone].filter(Boolean).join(' · ') || 'Chưa khai báo'}</SummaryItem>
                    </dl>
                  </div>

                  <div className="epd-review-card">
                    <div className="epd-section-label">
                      <Container size={18} />
                      <h4>Container & Dịch vụ kèm ({form.lines.length} container)</h4>
                      <button type="button" className="epc-text-button" onClick={() => setStep(1)}>Chỉnh sửa</button>
                    </div>
                    <div className="epd-review-lines">
                      {form.lines.map((line, idx) => {
                        const dec = line.declaration
                        const row = snapshots[line.sourceContainerId] || dec
                        const contNum = dec?.containerNumber || row?.containerNumber || `Cont #${idx + 1}`
                        return (
                          <div key={line.sourceContainerId}>
                            <strong>{contNum}</strong>
                            <ul>
                              {line.services.map(usage => (
                                <li key={usage.serviceId}>
                                  <Check size={13} />
                                  <span>{services.find(s => s.id === usage.serviceId)?.name || 'Dịch vụ'}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="epd-review-card">
                    <div className="epd-section-label">
                      <CalendarDays size={18} />
                      <h4>Phương tiện & Hóa đơn</h4>
                      <button type="button" className="epc-text-button" onClick={() => setStep(deliveryStep)}>Chỉnh sửa</button>
                    </div>
                    <dl className="epd-review-facts">
                      <SummaryItem label="Phương tiện">
                        {form.delivery.transportMode === 'BARGE'
                          ? `Sà lan ${form.delivery.bargeName} · ${form.delivery.bargeYear} / ${form.delivery.bargeVoyage}`
                          : `${form.delivery.trips?.length || 0} chuyến đã khai báo theo container`}
                      </SummaryItem>
                      <SummaryItem label="Hạn lệnh">{form.delivery.orderValidUntil || form.source.validUntil || 'Không giới hạn'}</SummaryItem>
                      {form.delivery.transportMode === 'TRUCK' && <ServiceTripSummary trips={form.delivery.trips} containers={Object.values(snapshots)} />}

                      {/* BỘ CHỨNG TỪ ĐÍNH KÈM CỦA ĐƠN DỊCH VỤ */}
                      {form.delivery.documents?.length > 0 && (
                        <SummaryItem label="Hồ sơ & Chứng từ">
                          <div className="epd-review-docs-list">
                            {form.delivery.documents.map((doc, idx) => (
                              <div key={idx} className="epd-review-doc-badge">
                                <FileText size={13} />
                                <span>{doc.title}: <strong>{doc.fileName}</strong></span>
                                {doc.fileUrl && (
                                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="epd-review-doc-link">
                                    Xem
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </SummaryItem>
                      )}
                      <SummaryItem label="Người mua">{form.invoiceBuyer.name || 'Theo tài khoản'}</SummaryItem>
                      <SummaryItem label="Cổng thanh toán">Cổng thanh toán điện tử (Mã QR VietQR chuyển khoản ngân hàng 24/7)</SummaryItem>
                    </dl>

                    {/* HỒ SƠ PHÁP LÝ & HÌNH ẢNH PHƯƠNG TIỆN - TÀI XẾ RENDER ĐẦY ĐỦ KHÔNG BỊ CO BÓP */}
                    {form.delivery.transportMode === 'TRUCK' && form.delivery.trips?.length > 0 && (
                      <div className="epd-review-fleet-box" style={{ marginTop: '16px', borderTop: '1px dashed #e2e8f0', paddingTop: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                          <Truck size={16} style={{ color: '#0284c7' }} />
                          <strong style={{ fontSize: '13px', color: '#1e293b' }}>Giấy tờ & Hình ảnh Phương tiện - Tài xế</strong>
                        </div>
                        <FleetDocumentsReview trips={form.delivery.trips} containers={form.lines.map(l => snapshots[l.sourceContainerId] || l.declaration).filter(Boolean)} />
                      </div>
                    )}
                  </div>

                  <div className="epd-info">
                    <ShieldCheck size={18} />
                    <p>
                      Bấm <strong>Kiểm tra thông tin và gửi đăng ký</strong> để gửi hồ sơ cho Dispatcher xác nhận và tính tiền.
                    </p>
                  </div>
                </section>
              )}

              {save.error && (
                <div className="epc-error" role="alert">
                  {draftError(save.error)}
                </div>
              )}
            </fieldset>

            {/* CỘT TÓM TẮT HỒ SƠ BÊN PHẢI */}
            <aside className="epd-summary" aria-label="Tóm tắt đăng ký">
              <div className="epd-summary-title">
                <span><ClipboardList size={22} /></span>
                <div>
                  <small>E-PORT HẢI PHÒNG</small>
                  <strong>Tóm tắt hồ sơ</strong>
                </div>
              </div>
              <span className="epd-status">{sampleMode ? 'Dữ liệu mẫu' : 'Đang khai báo'}</span>
              <dl>
                <SummaryItem label="Tác nghiệp">{main?.name || (form.flow === 'IMPORT' ? 'Giao hàng nhập' : 'Hạ hàng xuất')}</SummaryItem>
                <SummaryItem label="Chứng từ nguồn">{sourceLabel}</SummaryItem>
                <SummaryItem label="Số lượng cont">
                  <span className="epd-summary-count">{form.lines.length.toString().padStart(2, '0')}</span>
                </SummaryItem>
                <SummaryItem label="Thanh toán">Trực tuyến VietQR</SummaryItem>
              </dl>
              {form.flow === 'IMPORT' && (
                <div className="epd-summary-note">
                  <ShieldCheck size={17} />
                  <p>Hải quan VASSCM & Cảng đối chiếu chứng từ.</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>

      {leaveConfirm && (
        <div className="epd-leave-confirm" role="alert">
          <p>Hồ sơ có thay đổi chưa lưu. Bạn muốn tiếp tục hay đóng cửa sổ?</p>
          <div>
            <button type="button" className="epc-button secondary" onClick={() => setLeaveConfirm(false)}>Tiếp tục chỉnh sửa</button>
            <button type="button" className="epc-button secondary" onClick={onClose}>Đóng bỏ qua</button>
            {!sampleMode && (
              <button type="button" className="epc-button primary" onClick={() => save.mutate()} disabled={save.isPending || emailBusy}>
                <Save size={15} />Lưu nháp
              </button>
            )}
          </div>
        </div>
      )}

      <footer className="epd-footer">
        <button
          type="button"
          className="epc-button secondary"
          disabled={save.isPending || emailBusy}
          onClick={step > 0 ? () => setStep(prev => prev - 1) : requestClose}
        >
          {step > 0 ? <ArrowLeft size={15} /> : <X size={15} />}
          {step > 0 ? 'Quay lại' : 'Đóng'}
        </button>

        <div>
          <button
            type="button"
            className="epc-button secondary"
            disabled={sampleMode || !ready || detail.isError || save.isPending || emailBusy || !!pendingChange}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 size={16} className="epc-spin" /> : <Save size={16} />}
            Lưu nháp
          </button>

          {step < reviewStep ? (
            <button
              type="button"
              className="epc-button primary"
              disabled={!ready || detail.isError || save.isPending || emailBusy || !!pendingChange}
              onClick={next}
            >
              <span>Tiếp tục</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            onReview && (
              <button
                type="button"
                className="epc-button primary"
                disabled={sampleMode || !ready || detail.isError || save.isPending || emailBusy || !!pendingChange}
                onClick={() => save.mutate('review')}
              >
                <FileCheck2 size={16} />
                <span>Kiểm tra thông tin và gửi đăng ký</span>
              </button>
            )
          )}
        </div>
      </footer>
    </CatalogDialog>
  )
}
