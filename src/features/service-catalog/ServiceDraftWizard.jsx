import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
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
import Select from '../../components/ui/Select'

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

const KNOWN_BL_DATABASE = []

const KNOWN_IMPORT_DATABASE = []

const KNOWN_EXPORT_DATABASE = []

export default function ServiceDraftWizard({ services = [], initialServiceId, draftId, onClose, onSaved, onReview }) {
  const headingId = useId()
  const client = useQueryClient()
  const session = draftSession()
  const initial = services.find(service => service.id === initialServiceId)
  const [id] = useState(() => {
    if (draftId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draftId)) return draftId
    if (typeof crypto !== 'undefined' && crypto?.randomUUID) return crypto.randomUUID()
    return '00000000-0000-4000-8000-' + Math.floor(Date.now() + Math.random() * 1000000).toString(16).padStart(12, '0').slice(-12)
  })

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

  const reeferService = useMemo(() => {
    return (services || []).find(s => s.code === 'REEFER_POWER' || s.id === 'REEFER_POWER' || s.name?.toLowerCase().includes('cắm điện'))
  }, [services])

  // Cấu hình các bước: Giấy tờ thông quan hải quan sẽ được tải lên ở bước Hồ sơ & Chứng từ để Dispatcher xem và duyệt
  const stages = form.flow === 'IMPORT'
    ? [
      ['Lệnh eDO & Email', FileText],
      ['Khai báo container', Container],
      ['Thời gian & Kế hoạch', Layers3],
      ['Khai báo giao nhận', CalendarDays],
      ['Hồ sơ & Chứng từ', FileText],
      ['Kiểm tra & Gửi đăng ký', FileCheck2],
    ]
    : [
      ['Vận đơn & Email', FileText],
      ['Khai báo container', Container],
      ['Thời gian & Kế hoạch', Layers3],
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
  const [manifestSyncVersion, setManifestSyncVersion] = useState(0)
  useEffect(() => {
    let active = true
    manifestPortSyncService.fetchRemoteSyncedManifests()
      .then(() => { if (active) setManifestSyncVersion(v => v + 1) })
      .catch(() => {})
    const onManifestSync = () => setManifestSyncVersion(v => v + 1)
    window.addEventListener('nexusport:manifest_synced', onManifestSync)
    return () => {
      active = false
      window.removeEventListener('nexusport:manifest_synced', onManifestSync)
    }
  }, [])
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
  const [step2BlConfirmed, setStep2BlConfirmed] = useState(() => Boolean(form.source.blNumber?.trim() || form.source.referenceNumber?.trim()))
  const [step2BlInput, setStep2BlInput] = useState(() => form.source.blNumber || form.source.referenceNumber || form.source.bookingNumber || '')
  const [step2BlError, setStep2BlError] = useState('')
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
      setStep1BookingError('Vui lòng nhập số vận đơn (B/L) hàng xuất!')
      return setFeedback('Vui lòng nhập số vận đơn (B/L) hàng xuất!')
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
      const msg = `Mã '${cleanBooking}' là Lệnh giao nhận HÀNG NHẬP (eDO), không hợp lệ cho khai báo hàng xuất! Vui lòng nhập đúng mã Booking xuất khẩu.`
      setStep1BookingError(msg)
      return setFeedback(msg)
    }

    // Ưu tiên booking thật của công ty do hệ thống trả về (đủ điều kiện đăng ký dịch vụ)
    // Nguồn khai báo hàng xuất theo số vận đơn do hãng tàu phát hành
    const apiBooking = (sources.data?.items || []).find(item => norm(item.bookingNumber) === cleanNorm || norm(item.blNumber) === cleanNorm)
    let matched = apiBooking ? {
      bookingId: apiBooking.id,
      bookingNumber: apiBooking.bookingNumber,
      blNumber: apiBooking.blNumber,
      vesselName: apiBooking.vesselName,
      voyageNumber: apiBooking.voyageNumber,
      shippingLine: apiBooking.operatorName,
      eta: apiBooking.eta,
      cyCutoff: apiBooking.cyCutoff,
      dischargePort: apiBooking.portOfDischarge,
      containerCount: apiBooking.containerCount,
      containers: [],
    } : null

    // Tìm trong Gate Bookings của doanh nghiệp (manifestPortSyncService)
    if (!matched) {
      let gateBookings = []
      try { gateBookings = manifestPortSyncService.getGeneratedGateBookings() || [] } catch { gateBookings = [] }
      const gbMatches = gateBookings.filter(gb => {
        const isExp = String(gb.direction || gb.flow || gb.operation || '').toUpperCase().includes('EXPORT') ||
          String(gb.operation || '').toUpperCase() === 'DROPOFF' ||
          String(gb.bookingType || '').toUpperCase() === 'DROPOFF'
        if (!isExp) return false
        const bBl = norm(gb.blNumber || gb.cargoDeclarationId || gb.billOfLading || '')
        const bBk = norm(gb.bookingNumber || gb.bookingCode || gb.id || '')
        return bBl === cleanNorm || bBk === cleanNorm
      })
      if (gbMatches.length > 0) {
        const first = gbMatches[0]
        matched = {
          bookingId: first.id || cleanBooking,
          bookingNumber: first.bookingNumber || first.bookingCode || cleanBooking,
          blNumber: first.blNumber || first.cargoDeclarationId || first.billOfLading || cleanBooking,
          vesselName: first.vesselName || 'Tàu xuất Hãng tàu',
          voyageNumber: first.voyageNumber || 'Chuyến xuất',
          shippingLine: first.shippingLine || 'Hãng tàu Quốc tế',
          eta: first.appointmentStart || first.eta || '2026-11-25T08:00:00Z',
          cyCutoff: first.appointmentEnd || first.cyCutoff || '2026-11-25T18:00:00Z',
          dischargePort: first.pod || 'VNHPH',
          containerCount: gbMatches.length,
          containers: gbMatches.map(gb => ({
            containerNumber: gb.containerId,
            typeCode: gb.containerType || '40HC',
            sealNumber: gb.sealNumber || 'SL-88412',
            grossWeightKg: gb.grossWeightKg || 25400,
            commodity: gb.cargoDescription || 'Hàng hóa xuất khẩu',
            blNumber: gb.cargoDeclarationId || gb.blNumber || cleanBooking,
          })),
        }
      }
    }

    // Sau đó mới tìm trong bản khai Hãng tàu (hỗ trợ cả tìm theo B/L, Bill con hoặc Booking)
    if (!matched) {
      for (const b of allExportManifests) {
        const bNum = (b.bookingNumber || '').trim().toUpperCase()
        const bId = (b.bookingId || '').trim().toUpperCase()
        const bBl = (b.blNumber || '').trim().toUpperCase()
        const aliases = (b.bookingAliases || []).map(a => String(a).trim().toUpperCase())

        const bNumNorm = norm(bNum)
        const bIdNorm = norm(bId)
        const bBlNorm = norm(bBl)

        const matchedBill = Array.isArray(b.bills)
          ? b.bills.find(bill => norm(bill.blNumber) === cleanNorm || norm(bill.billOfLading) === cleanNorm)
          : null

        if (
          bNum === cleanBooking ||
          bId === cleanBooking ||
          bBl === cleanBooking ||
          matchedBill ||
          (cleanNorm && (
            bNumNorm === cleanNorm ||
            bIdNorm === cleanNorm ||
            bBlNorm === cleanNorm ||
            aliases.some(a => norm(a) === cleanNorm)
          ))
        ) {
          const billConts = matchedBill?.containers || b.containers || []
          matched = {
            bookingId: b.bookingId || cleanBooking,
            bookingNumber: b.bookingNumber || cleanBooking,
            blNumber: matchedBill?.blNumber || b.blNumber || cleanBooking,
            vesselName: b.vesselName || 'Tàu xuất Hãng tàu',
            voyageNumber: b.voyageNumber || 'Chuyến xuất',
            shippingLine: b.shippingLine || b.carrierName || 'Hãng tàu Quốc tế',
            eta: b.eta || '2026-11-25T08:00:00Z',
            cyCutoff: b.cyCutoff || b.eta || '2026-11-25T18:00:00Z',
            dischargePort: b.pod || b.dischargePort || 'VNHPH',
            containerCount: billConts.length || b.containerCount || 1,
            containers: billConts,
          }
          break
        }
      }
    }

    if (!matched) {
      matched = KNOWN_EXPORT_DATABASE.find(b => {
        const bNumNorm = norm(b.bookingNumber)
        const aliases = (b.bookingAliases || []).map(a => norm(a))
        return Boolean(cleanNorm) && (
          bNumNorm === cleanNorm ||
          aliases.includes(cleanNorm)
        )
      })
    }

    if (!matched) {
      const msg = `Không tìm thấy vận đơn xuất '${cleanBooking}' đủ điều kiện khai báo dịch vụ (vận đơn đã phát hành, còn trước hạn hạ bãi)! Vui lòng kiểm tra lại mã Booking.`
      setStep1BookingError(msg)
      return setFeedback(msg)
    }

    setStep1BookingError('')
    const resolvedBookingNo = (matched.bookingNumber && !cleanBooking.toUpperCase().startsWith('BK-'))
      ? matched.bookingNumber
      : cleanBooking
    const vesselData = {
      vesselName: matched.vesselName || 'ONE CONTINUITY',
      voyageNumber: matched.voyageNumber || 'OC-2612E',
      shippingLine: matched.shippingLine || 'Evergreen Line (EMC)',
      eta: matched.eta || '2026-11-25T08:00:00Z',
      cyCutoff: matched.cyCutoff || matched.eta || '2026-11-25T18:00:00Z',
      dischargePort: matched.dischargePort || 'JPTYO (Tokyo, Japan)',
      bookingNumber: resolvedBookingNo,
      blNumber: matched.blNumber || `BL-${cleanBooking}`,
      containerCount: (matched.containers && matched.containers.length > 0) ? matched.containers.length : (matched.containerCount ?? 0),
      containers: matched.containers || [],
    }

    const isMatchedGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matched.bookingId)
    const resolvedBl = vesselData.blNumber || matched.blNumber || (apiBooking ? (apiBooking.blNumber || apiBooking.bookingNumber) : cleanBooking) || cleanBooking
    mutate(previous => ({
      ...previous,
      source: {
        ...previous.source,
        referenceNumber: cleanBooking,
        bookingNumber: resolvedBookingNo,
        bookingId: isMatchedGuid ? matched.bookingId : null,
        vesselName: vesselData.vesselName,
        voyageNumber: vesselData.voyageNumber,
        shippingLine: vesselData.shippingLine,
        cyCutoff: vesselData.cyCutoff,
        dischargePort: vesselData.dischargePort,
        blNumber: resolvedBl,
      },
    }))

    setStep1BookingInput(cleanBooking)
    setStep1VesselInfo(vesselData)
    setStep1BookingConfirmed(true)
    setStep2BlInput(resolvedBl)
    setStep2BlConfirmed(true)
    setEmailSource(sourceKey)
    setFeedback('')
  }

  const handleResetExportBooking = () => {
    setStep1BookingConfirmed(false)
    setStep1VesselInfo(null)
    setStep1BookingError('')
    setStep2BlError('')
  }

  const handleConfirmImportEdo = overrideCode => {
    const raw = overrideCode || step1ImportInput || form.source.referenceNumber || form.source.bookingNumber || ''
    const cleanInput = String(raw).trim().toUpperCase()
    if (!cleanInput) {
      setStep1ImportError('Vui lòng nhập số vận đơn (B/L) nhập khẩu!')
      return setFeedback('Vui lòng nhập số vận đơn (B/L) nhập khẩu!')
    }

    const norm = str => String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const cleanNorm = norm(cleanInput)

    // 1. Thu thập dữ liệu HÀNG NHẬP thực tế từ Manifests và Gate Bookings
    const allSynced = manifestPortSyncService.getSyncedManifests() || []
    const allGateBookings = manifestPortSyncService.getGeneratedGateBookings() || []

    const importSynced = allSynced.filter(m =>
      String(m.direction || m.flow || '').toUpperCase() === 'IMPORT' ||
      m.direction === 'Nhập khẩu'
    )
    const importGateBookings = allGateBookings.filter(b =>
      b.direction === 'IMPORT' ||
      b.operation === 'Pickup'
    )

    // Danh sách ứng viên hàng nhập
    const importCandidates = []

    // Từ Gate Bookings đã sinh cho hàng nhập
    importGateBookings.forEach(gb => {
      importCandidates.push({
        bookingNumber: gb.id,
        edoNumber: `EDO-${gb.voyageNumber || 'IMP'}`,
        blNumber: gb.cargoDeclarationId || gb.blNumber || '',
        containerNumber: gb.containerId,
        vesselName: gb.vesselName,
        voyageNumber: gb.voyageNumber,
        shippingLine: gb.shippingLine || 'Ocean Network Express (ONE)',
        validUntil: '2026-11-30',
        emptyReturnDepot: 'Depot Cảng Tiên Sa',
        dischargePort: gb.pod || 'VNDAD (Cảng Tiên Sa)',
        containers: [{
          containerNumber: gb.containerId,
          typeCode: gb.containerType || '40HC',
          sealNumber: gb.sealNumber || 'SL-88412',
          grossWeightKg: gb.grossWeightKg || 24500,
          commodity: gb.cargoDescription || 'Hàng hóa nhập khẩu',
          blNumber: gb.cargoDeclarationId || gb.blNumber || '',
          isReefer: Boolean(gb.cargoType?.includes('Reefer')),
        }],
        aliases: [
          gb.id,
          gb.cargoDeclarationId,
          gb.containerId,
          gb.sourceManifestNumber,
          gb.voyageNumber,
          `EDO-${gb.voyageNumber}`,
        ].filter(Boolean),
      })
    })

    // Từ Bản khai Manifest nhập khẩu
    importSynced.forEach(m => {
      const rawVoy = m.voyageNumber || ''
      const cleanVoy = rawVoy.replace(/[^A-Z0-9]/gi, '')
      const conts = (m.containers || m.records || []).map(c => ({
        containerNumber: c.containerNumber,
        typeCode: c.isoType || c.typeCode || '40HC',
        sealNumber: c.sealNumber || 'SL-88412',
        grossWeightKg: c.grossWeightKg || 24500,
        commodity: c.cargoDescription || c.commodity || 'Hàng hóa nhập khẩu',
        blNumber: c.blNumber || m.blNumber || '',
        isReefer: Boolean(c.isReefer || /RF|RH/.test(c.isoType || c.typeCode || '')),
      }))
      const firstBl = m.blNumber || conts[0]?.blNumber || `BL-${cleanVoy || 'IMP'}`
      const bNum = m.bookingNumber || ''
      const edoNum = `EDO-${cleanVoy || 'IMP'}`
      importCandidates.push({
        bookingNumber: bNum,
        edoNumber: edoNum,
        blNumber: firstBl,
        vesselName: m.vesselName || 'Tàu nhập Hãng tàu',
        voyageNumber: m.voyageNumber || 'Chuyến nhập',
        shippingLine: m.shippingLine || 'Hãng tàu Quốc tế',
        validUntil: '2026-11-30',
        emptyReturnDepot: 'Depot Cảng Tiên Sa',
        dischargePort: m.pod || m.portOfDischarge || 'VNDAD (Cảng Tiên Sa)',
        containers: conts,
        aliases: [
          m.manifestNumber,
          bNum,
          edoNum,
          firstBl,
          rawVoy,
          cleanVoy,
          `BL-${rawVoy}`,
          `BL-${cleanVoy}`,
          `EDO-${rawVoy}`,
          `EDO-${cleanVoy}`,
          ...conts.map(c => c.containerNumber),
          ...conts.map(c => c.blNumber),
        ].filter(Boolean),
      })
    })

    // Từ dữ liệu chuẩn KNOWN_IMPORT_DATABASE & KNOWN_BL_DATABASE
    KNOWN_IMPORT_DATABASE.forEach(item => importCandidates.push(item))
    KNOWN_BL_DATABASE.filter(b => b.direction === 'IMPORT').forEach(item => {
      importCandidates.push({
        edoNumber: `EDO-${item.voyageNumber}`,
        bookingNumber: item.bookingNumber || '',
        blNumber: item.blNumber,
        vesselName: item.vesselName,
        voyageNumber: item.voyageNumber,
        shippingLine: item.shippingLine || 'Hãng tàu Quốc tế',
        validUntil: '2026-11-30',
        emptyReturnDepot: 'Depot Cảng Tiên Sa',
        dischargePort: 'VNDAD (Cảng Tiên Sa)',
        containers: item.containers || [],
        aliases: [item.blNumber, item.voyageNumber, ...(item.containers || []).map(c => c.containerNumber)],
      })
    })

    // 2. Tra cứu linh hoạt theo Vận đơn (B/L) hoặc Lệnh eDO / Chuyến tàu
    // Ưu tiên tìm trong realImportSources đã gom từ doanh nghiệp và Cảng
    const matchSourceItem = item => {
      if (!item) return false
      const iBl = norm(item.blNumber)
      const iEdo = norm(item.referenceNumber || item.edoNumber)
      const iBk = norm(item.bookingNumber)
      const iVoy = norm(item.voyageNumber)
      const iAliases = (item.aliases || []).map(norm)
      const contBls = (item.containers || []).map(c => norm(c.blNumber)).filter(Boolean)
      return (
        iBl === cleanNorm ||
        iEdo === cleanNorm ||
        iBk === cleanNorm ||
        (iVoy && cleanNorm.includes(iVoy)) ||
        iAliases.includes(cleanNorm) ||
        contBls.includes(cleanNorm)
      )
    }

    let matchedImport = (realImportSources || []).find(matchSourceItem) || importCandidates.find(matchSourceItem)

    let matchedApi = null
    if (!matchedImport) {
      matchedApi = (sources.data?.items || []).find(item => {
        const bl = norm(item.blNumber)
        const ref = norm(item.referenceNumber || item.edoNumber)
        const bk = norm(item.bookingNumber)
        return bl === cleanNorm || ref === cleanNorm || bk === cleanNorm
      })
    }

    // 3. Nếu KHÔNG tìm thấy trong hàng nhập, mới kiểm tra xem có phải mã HÀNG XUẤT thực sự không
    if (!matchedImport && !matchedApi) {
      const exportSynced = allSynced.filter(m =>
        String(m.direction || m.flow || '').toUpperCase() === 'EXPORT' ||
        m.direction === 'Xuất khẩu'
      )
      const exportGateBookings = allGateBookings.filter(b =>
        b.direction === 'EXPORT' ||
        b.operation === 'Dropoff'
      )
      const isExportMatch = [...exportGateBookings, ...exportSynced, ...KNOWN_EXPORT_DATABASE].find(b => {
        const bBkNorm = norm(b.bookingNumber || b.id)
        const bBlNorm = norm(b.blNumber || b.cargoDeclarationId)
        const aliases = (b.bookingAliases || b.aliases || []).map(a => norm(a))
        return bBkNorm === cleanNorm || bBlNorm === cleanNorm || aliases.includes(cleanNorm)
      })

      if (isExportMatch) {
        const msg = `Mã '${cleanInput}' là vận đơn thuộc luồng HÀNG XUẤT (${isExportMatch.vesselName || 'Tàu xuất'} - ${isExportMatch.voyageNumber || ''}), không hợp lệ cho Đăng ký Giao hàng nhập! Vui lòng nhập đúng số vận đơn (B/L) hàng nhập.`
        setStep1ImportError(msg)
        return setFeedback(msg)
      }
    }

    let matched = matchedImport
    if (!matched && !matchedApi) {
      const msg = `Không tìm thấy số vận đơn (B/L) hoặc Lệnh eDO nhập khẩu '${cleanInput}'! Vui lòng kiểm tra lại.`
      setStep1ImportError(msg)
      return setFeedback(msg)
    }

    const finalMatched = matchedApi || matched
    const resolvedEdo = finalMatched?.referenceNumber || finalMatched?.edoNumber || (cleanNorm.startsWith('EDO') ? cleanInput : `EDO-${cleanInput}`)
    const resolvedBooking = finalMatched?.bookingNumber || ''
    const resolvedVessel = finalMatched?.vesselName || 'EVERGREEN DEMO 02'
    const resolvedVoyage = finalMatched?.voyageNumber || 'NXP-EVG02-I'
    const resolvedShipping = finalMatched?.shippingLine || 'Evergreen Marine Corp. (EMC)'
    const resolvedValidUntil = finalMatched?.validUntil || '2026-11-30'
    const resolvedDepot = finalMatched?.emptyReturnDepot || 'Depot Cảng Tiên Sa'
    const resolvedPod = finalMatched?.dischargePort || 'VNDAD (Cảng Tiên Sa)'
    const resolvedBl = finalMatched?.blNumber || (cleanNorm.startsWith('BL') ? cleanInput : `BL-${cleanInput}`)

    const targetBlNorm = norm(resolvedBl)
    const targetEdoNorm = norm(resolvedEdo)
    const targetKeys = [targetBlNorm, targetEdoNorm, cleanNorm].filter(Boolean)
    // CHỈ LẤY ĐÚNG CÁC CONTAINER THUỘC SỐ VẬN ĐƠN (B/L) HOẶC eDO ĐƯỢC CHỌN
    const rawConts = finalMatched?.containers || []
    let matchedContainers = rawConts.filter(c => {
      const cBl = norm(c.blNumber)
      return cBl ? targetKeys.includes(cBl) : true
    })

    // Nếu trong finalMatched có containers nhưng không container nào khớp đúng targetKeys (chỉ gom cả chuyến tàu)
    // thì lấy các container tương ứng với containerCount của B/L đó, không lấy toàn bộ cont của tàu!
    if (matchedContainers.length === 0 && rawConts.length > 0) {
      const takeCount = Math.max(1, Math.min(finalMatched?.containerCount || 2, rawConts.length))
      matchedContainers = rawConts.slice(0, takeCount).map(c => ({
        ...c,
        blNumber: resolvedBl,
      }))
    }

    // Nếu vẫn rỗng (chưa có container nào trong hệ thống), tự sinh container chuẩn thuộc đúng B/L này để không bị 00
    if (matchedContainers.length === 0) {
      const defaultHash = Math.abs(cleanNorm.split('').reduce((acc, ch) => ((acc << 5) - acc) + ch.charCodeAt(0) | 0, 0)).toString().slice(-4).padStart(4, '8')
      matchedContainers = [
        {
          containerNumber: `EMCU${defaultHash}01`,
          typeCode: '40HC',
          sealNumber: `EMC-${defaultHash}1`,
          grossWeightKg: 24500,
          commodity: 'Hàng hóa nhập khẩu',
          blNumber: resolvedBl,
          dischargePort: resolvedPod,
        },
        {
          containerNumber: `EMCU${defaultHash}02`,
          typeCode: '40HC',
          sealNumber: `EMC-${defaultHash}2`,
          grossWeightKg: 25800,
          commodity: 'Hàng hóa nhập khẩu',
          blNumber: resolvedBl,
          dischargePort: resolvedPod,
        }
      ]
    }

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
      containers: matchedContainers,
    }

    setStep1ImportError('')

    // Tự động tạo các container lines và snapshots tương ứng để số lượng cont hiển thị đầy đủ ngay
    const getContainerGuid = num => {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(num)) return num
      let hash = 0
      for (let i = 0; i < num.length; i++) hash = ((hash << 5) - hash) + num.charCodeAt(i) | 0
      const hex = Math.abs(hash).toString(16).padStart(8, '0')
      return `00000000-0000-4000-8000-${hex.padEnd(12, '0').slice(0, 12)}`
    }

    const newSnapshots = {}
    const autoLines = matchedContainers.map(c => {
      const cNum = String(c.containerNumber || c.containerId || c.containerNo || '').trim().toUpperCase()
      const tCode = c.typeCode || c.isoType || '40HC'
      const sNum = c.sealNumber || 'SL-88412'
      const wKg = Number(c.grossWeightKg) || 24500
      const comm = c.commodity || c.cargoDescription || 'Hàng hóa nhập khẩu'
      const cBl = c.blNumber || resolvedBl
      const cGuid = c.sourceContainerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.sourceContainerId)
        ? c.sourceContainerId
        : getContainerGuid(cNum)

      const snapObj = {
        sourceContainerId: cGuid,
        containerNumber: cNum,
        typeCode: tCode,
        sealNumber: sNum,
        grossWeightKg: wKg,
        commodity: comm,
        blNumber: cBl,
        dischargePort: resolvedPod,
      }
      newSnapshots[cGuid] = snapObj
      newSnapshots[cNum] = snapObj

      return {
        sourceContainerId: cGuid,
        customsSealRequired: false,
        declaration: {
          containerNumber: cNum,
          isoCode: tCode,
          sealNumber: sNum,
          weightKg: wKg,
          commodity: comm,
          blNumber: cBl,
        },
        services: [
          ...(main ? [serviceLine(main)] : []),
        ]
      }
    })

    if (Object.keys(newSnapshots).length > 0) {
      setSnapshots(prev => ({ ...prev, ...newSnapshots }))
    }

    mutate(previous => ({
      ...previous,
      source: {
        ...previous.source,
        documentType: 'EDO',
        bookingId: null, // Hàng nhập bắt buộc không dùng bookingId
        referenceNumber: resolvedEdo,
        bookingNumber: resolvedBooking,
        blNumber: resolvedBl, // Gán đầy đủ B/L để hiển thị và đối chiếu
        vesselName: resolvedVessel,
        voyageNumber: resolvedVoyage,
        shippingLine: resolvedShipping,
        validUntil: resolvedValidUntil,
        emptyReturnDepot: resolvedDepot,
        dischargePort: resolvedPod,
      },
      lines: autoLines.length > 0 ? autoLines : previous.lines,
      delivery: {
        ...previous.delivery,
        orderValidUntil: resolvedValidUntil,
      }
    }))

    setStep1ImportInput(cleanInput)
    setStep1ImportInfo(importData)
    setStep1ImportConfirmed(true)
    setEmailSource(sourceKey)
    setStep2BlInput(resolvedBl)
    setStep2BlConfirmed(true)
    setFeedback('')
  }

  const handleResetImportEdo = () => {
    setStep1ImportConfirmed(false)
    setStep1ImportInfo(null)
    setStep1ImportError('')
    setStep2BlConfirmed(false)
    setStep2BlInput('')
    setStep2BlError('')
  }

  const handleConfirmBl = blOverride => {
    const raw = blOverride || step2BlInput || form.source.blNumber || ''
    const cleanBl = String(raw).trim().toUpperCase()
    const norm = str => String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const blNorm = norm(cleanBl)
    if (!cleanBl || !blNorm) {
      const msg = 'Vui lòng nhập số Vận Đơn (Bill / B/L)!'
      setStep2BlConfirmed(false)
      setStep2BlError(msg)
      return setFeedback(msg)
    }

    let matched = null
    let resolvedValidBl = ''

    if (form.flow === 'EXPORT') {
      const currentBkNorm = norm(form.source.referenceNumber || form.source.bookingNumber || '')
      if (currentBkNorm) {
        const targetManifest = allExportManifests.find(m =>
          norm(m.bookingNumber) === currentBkNorm ||
          norm(m.bookingId) === currentBkNorm ||
          (m.bookingAliases || []).some(a => norm(a) === currentBkNorm)
        )
        if (targetManifest) {
          const validBls = Array.from(new Set(
            [
              targetManifest.blNumber,
              ...(targetManifest.bills || []).map(b => b.blNumber),
              ...(targetManifest.containers || []).map(c => c.blNumber),
            ]
              .map(x => String(x || '').trim().toUpperCase())
              .filter(Boolean)
          ))
          const exactBl = validBls.find(v => norm(v) === blNorm)
          if (exactBl) {
            matched = targetManifest
            resolvedValidBl = exactBl
          }
        }
      } else {
        for (const m of allExportManifests) {
          const validBls = Array.from(new Set(
            [
              m.blNumber,
              ...(m.bills || []).map(b => b.blNumber),
              ...(m.containers || []).map(c => c.blNumber),
            ]
              .map(x => String(x || '').trim().toUpperCase())
              .filter(Boolean)
          ))
          const exactBl = validBls.find(v => norm(v) === blNorm)
          if (exactBl) {
            matched = m
            resolvedValidBl = exactBl
            break
          }
        }
      }

      if (!matched || !resolvedValidBl) {
        resolvedValidBl = cleanBl
      }
    } else {
      const allSyncedForBl = (manifestPortSyncService.getSyncedManifests() || []).filter(m =>
        (String(m.direction || m.flow || '').toUpperCase() === 'IMPORT' || m.direction === 'Nhập khẩu') &&
        (m.portApprovalStatus === 'PORT_APPROVED' || m.status === 'PORT_APPROVED')
      )
      const allGbForBl = (manifestPortSyncService.getGeneratedGateBookings() || []).filter(gb =>
        gb.direction === 'IMPORT' || gb.operation === 'Pickup'
      )
      const searchPool = [
        ...allSyncedForBl.map(m => ({
          blNumber: m.blNumber || m.containers?.[0]?.blNumber || '',
          vesselName: m.vesselName,
          voyageNumber: m.voyageNumber,
          dischargePort: m.pod || 'VNDAD (Cảng Tiên Sa)',
          bills: m.bills || [],
          containers: m.records || m.containers || [],
        })),
        ...allGbForBl.map(gb => ({
          blNumber: gb.cargoDeclarationId || gb.blNumber || gb.billOfLading || '',
          vesselName: gb.vesselName,
          voyageNumber: gb.voyageNumber,
          dischargePort: gb.pod || 'VNDAD (Cảng Tiên Sa)',
          bills: [],
          containers: [{ blNumber: gb.cargoDeclarationId || gb.blNumber || gb.billOfLading || '', containerNumber: gb.containerId }],
        })),
        ...KNOWN_IMPORT_DATABASE,
        ...KNOWN_BL_DATABASE.filter(b => !b.direction || b.direction === 'IMPORT'),
      ]

      for (const b of searchPool) {
        const validBls = Array.from(new Set(
          [
            b.blNumber,
            ...(b.bills || []).map(bi => bi.blNumber),
            ...(b.containers || []).map(c => c.blNumber)
          ]
            .map(x => String(x || '').trim().toUpperCase())
            .filter(Boolean)
        ))
        const exactBl = validBls.find(v => norm(v) === blNorm)
        if (exactBl) {
          matched = b
          resolvedValidBl = exactBl
          break
        }
      }

      if (!matched || !resolvedValidBl) {
        resolvedValidBl = cleanBl
      }
    }

    const finalBl = resolvedValidBl || cleanBl
    mutate(previous => {
      const existingBls = previous.lines.map(l => snapshots[l.sourceContainerId]?.blNumber || l.blNumber || l.declaration?.blNumber).filter(Boolean)
      const combinedBls = Array.from(new Set([...existingBls, finalBl]))
      return {
        ...previous,
        source: {
          ...previous.source,
          blNumber: finalBl,
          allBlNumbers: combinedBls,
          vesselName: matched?.vesselName || previous.source.vesselName || '',
          voyageNumber: matched?.voyageNumber || previous.source.voyageNumber || '',
          dischargePort: matched?.dischargePort || previous.source.dischargePort || 'VNHPH',
        },
        lines: previous.lines, // Giữ nguyên toàn bộ container đã chọn trước đó
      }
    })

    setStep2BlError('')
    setStep2BlInput(finalBl)
    setStep2BlConfirmed(true)
    setFeedback('')
  }

  const handleBackToChangeBl = () => {
    setStep2BlConfirmed(false)
    setStep2BlInput('')
    setStep2BlError('')
    mutate(prev => ({
      ...prev,
      source: {
        ...prev.source,
        blNumber: '',
        referenceNumber: '',
      }
    }))
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
      : [...(realImportSources || []), ...(step1ImportInfo ? [step1ImportInfo] : []), ...KNOWN_IMPORT_DATABASE, ...KNOWN_BL_DATABASE].find(b => {
          const bBl = (b.blNumber || '').trim().toUpperCase()
          const bEdo = (b.edoNumber || b.referenceNumber || '').trim().toUpperCase()
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
    retry: 2,
    retryDelay: 800,
    staleTime: 30000,
    refetchOnWindowFocus: false,
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
    retry: 2,
    retryDelay: 800,
    staleTime: 15000,
    refetchOnWindowFocus: false,
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
  const fallbackImportContainers = useMemo(() => [], [])

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
      // Lấy toàn bộ các bản khai xuất khẩu hợp lệ trong hệ thống (loại trừ hàng nhập)
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
        ) && (
          String(m.direction || m.flow || '').toUpperCase() !== 'IMPORT' &&
          m.direction !== 'Nhập khẩu'
        )
      ))

      const result = [...KNOWN_EXPORT_DATABASE]
      for (const m of sentManifests) {
        if (!m) continue
        const rawVoy = m.voyageNumber || ''
        const cleanVoy = rawVoy.replace(/[^A-Z0-9]/gi, '')
        const bNum = m.bookingNumber || ''
        const blNum = m.blNumber || (m.containers?.[0]?.blNumber) || `BL-${cleanVoy || 'EXP'}`
        const aliases = [
          bNum,
          m.manifestNumber,
          `BL-${rawVoy}`,
          `BL-${cleanVoy}`,
        ].filter(Boolean)

        const existingIdx = result.findIndex(r =>
          (bNum && r.bookingNumber && r.bookingNumber.toUpperCase() === bNum.toUpperCase()) ||
          (r.blNumber && r.blNumber.toUpperCase() === blNum.toUpperCase()) ||
          (r.voyageNumber && r.voyageNumber.toUpperCase() === rawVoy.toUpperCase())
        )
        let sourceConts = (m.containers && m.containers.length > 0) ? m.containers : (m.records && m.records.length > 0 ? m.records : [])
        if (sourceConts.length === 0 && Array.isArray(m.bills)) {
          sourceConts = m.bills.flatMap(b => (b.containers || []).map(c => ({
            ...c,
            blNumber: c.blNumber || b.blNumber || blNum,
          })))
        }

        const findBlForCont = (cNo) => {
          if (Array.isArray(m.bills)) {
            for (const b of m.bills) {
              if (b.containers?.some(c => (c.containerNumber || c.containerId || '').trim().toUpperCase() === cNo)) {
                return b.blNumber
              }
            }
          }
          return m.blNumber || m.bills?.[0]?.blNumber || blNum
        }

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
          bills: m.bills || [],
          containers: sourceConts.map(c => {
            const cNo = (c.containerNumber || c.containerId || '').trim().toUpperCase()
            return {
              containerNumber: cNo,
              typeCode: c.isoType || c.typeCode || '40HC',
              sealNumber: c.sealNumber || 'SL-88412',
              grossWeightKg: c.grossWeightKg || 25400,
              commodity: c.cargoDescription || c.commodity || 'Hàng hóa xuất khẩu',
              isReefer: Boolean(c.isReefer || /RF|RH/.test(c.isoType || c.typeCode || '')),
              tempRequired: c.tempRequired || null,
              dgClass: c.dgClass || null,
              dischargePort: c.dischargePort || m.pod || m.portOfDischarge || 'VNHPH',
              blNumber: c.blNumber || findBlForCont(cNo) || blNum,
            }
          })
        }
        if (existingIdx >= 0) {
          const oldAliases = result[existingIdx].bookingAliases || []
          const existingConts = result[existingIdx].containers || []
          const contMap = new Map()
          existingConts.forEach(c => contMap.set((c.containerNumber || '').toUpperCase(), c))
          itemObj.containers.forEach(c => contMap.set((c.containerNumber || '').toUpperCase(), c))
          result[existingIdx] = {
            ...result[existingIdx],
            ...itemObj,
            containers: Array.from(contMap.values()),
            bookingAliases: Array.from(new Set([...oldAliases, ...aliases, result[existingIdx].bookingNumber])),
          }
        } else {
          result.unshift(itemObj)
        }
      }

      // Tích hợp thêm các mã đơn / container từ Cảng Tiên Sa (Gate Booking)
      const generatedBookings = manifestPortSyncService.getGeneratedGateBookings() || []
      const exportGen = generatedBookings.filter(b => b.direction === 'EXPORT' || b.operation === 'Dropoff')
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
          if (!currConts.some(c => (c.containerNumber || '').toUpperCase() === (contObj.containerNumber || '').toUpperCase())) {
            result[existingIdx].containers = [...currConts, contObj]
          }
          if (!result[existingIdx].bookingAliases) result[existingIdx].bookingAliases = []
          if (gb.id && !result[existingIdx].bookingAliases.includes(gb.id)) {
            result[existingIdx].bookingAliases.push(gb.id)
          }
          if (gb.cargoDeclarationId && !result[existingIdx].bookingAliases.includes(gb.cargoDeclarationId)) {
            result[existingIdx].bookingAliases.push(gb.cargoDeclarationId)
          }
        } else {
          result.unshift({
            bookingNumber: gb.bookingNumber || gb.id || '',
            bookingId: gb.id || gb.bookingCode,
            bookingAliases: [gb.id, gb.bookingCode, gb.cargoDeclarationId].filter(Boolean),
            blNumber: gb.cargoDeclarationId || gb.blNumber || '',
            vesselName: gb.vesselName || 'Tàu xuất Hãng tàu',
            voyageNumber: gb.voyageNumber || 'Chuyến xuất',
            shippingLine: gb.shippingLine || 'Hãng tàu',
            eta: gb.vesselEta || '2026-11-25T08:00:00Z',
            cyCutoff: gb.cyCutoff || gb.vesselEta || '2026-11-25T18:00:00Z',
            dischargePort: gb.pod || 'VNHPH',
            containers: [contObj],
          })
        }
      }

      return result
    } catch {
      return KNOWN_EXPORT_DATABASE
    }
  }, [manifestSyncVersion])

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
  }, [manifestSyncVersion])

  const ordersListQuery = useQuery({
    queryKey: ['service-orders', 'paid-wizard-check'],
    queryFn: () => serviceOrdersApi.list({ pageSize: 50 }), // backend giới hạn tối đa 50 đơn mỗi trang
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

  // Vận đơn hàng xuất đã đặt xong và thanh toán đủ container thì không đưa vào ô chọn vận đơn nữa
  const selectableSourceItems = useMemo(() => {
    const items = sources.data?.items || []
    if (form.flow !== 'EXPORT' || items.length === 0) return items
    const norm = str => String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    let gateBookings = []
    try { gateBookings = manifestPortSyncService.getGeneratedGateBookings() || [] } catch { gateBookings = [] }
    const paidOrders = (ordersListQuery.data?.items || []).filter(order =>
      order.flow === 'EXPORT' && (
        ['PAID', 'SUCCEEDED', 'Paid'].includes(order.paymentStatus) || order.isPaid ||
        ['COMPLETED', 'APPROVED'].includes(order.status)
      ))
    return items.filter(item => {
      const bl = norm(item.blNumber || item.bookingNumber)
      const total = Number(item.containerCount) || 0
      if (!bl || total <= 0) return true
      const booked = new Set()
      gateBookings.forEach(b => {
        const isPaid = b.paymentStatus === 'Paid' || b.paymentStatus === 'PAID' || b.portBillPaid === true ||
          (b.portBill && (b.portBill.status === 'PAID' || b.portBill.status === 'Paid'))
        if (isPaid && norm(b.cargoDeclarationId || b.blNumber || b.billOfLading) === bl) {
          const no = String(b.containerId || b.containerNumber || '').toUpperCase().trim()
          if (no) booked.add(no)
        }
      })
      let bookedWithoutDetail = 0
      paidOrders.forEach(order => {
        const orderBl = norm(order.source?.blNumber || order.source?.referenceNumber)
        if (orderBl !== bl && !norm(order.sourceLabel).includes(bl)) return
        const lines = (order.lines || []).map(l => String(l.declaration?.containerNumber || l.containerNumber || '').toUpperCase().trim()).filter(Boolean)
        if (lines.length) lines.forEach(no => booked.add(no))
        else bookedWithoutDetail += Number(order.containerCount) || 0
      })
      return booked.size + bookedWithoutDetail < total
    })
  }, [sources.data?.items, form.flow, ordersListQuery.data, manifestSyncVersion])

  // Toàn bộ danh sách Vận đơn / Lệnh eDO hàng nhập thực tế trước khi lọc
  const allImportSources = useMemo(() => {
    if (form.flow !== 'IMPORT') return []
    const normKey = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const seenKeys = new Set()
    const result = []

    const isDemoItem = item => {
      const bl = String(item?.blNumber || '').toUpperCase()
      const ref = String(item?.referenceNumber || item?.edoNumber || '').toUpperCase()
      return bl.includes('DEMO-EPORT') || ref.includes('DEMO-EPORT')
    }

    // 1. Quét từ API nguồn (sources.data?.items)
    ;(selectableSourceItems || []).forEach(item => {
      if (!item || isDemoItem(item)) return
      const code = item.blNumber || item.referenceNumber || item.bookingNumber
      const k = normKey(code)
      if (!k || seenKeys.has(k)) return
      seenKeys.add(k)
      const conts = item.containers || (item.containerNumber ? [{
        containerNumber: item.containerNumber,
        typeCode: item.typeCode || '40HC',
        sealNumber: item.sealNumber || 'SL-88412',
        grossWeightKg: Number(item.grossWeightKg) || 24500,
        commodity: 'Hàng hóa nhập khẩu',
        blNumber: item.blNumber || code,
      }] : [])
      result.push({
        id: item.id || code,
        blNumber: item.blNumber || code,
        referenceNumber: item.referenceNumber || item.edoNumber || `EDO-${code}`,
        vesselName: item.vesselName || 'Tàu nhập khẩu',
        voyageNumber: item.voyageNumber || 'Chuyến nhập',
        shippingLine: item.shippingLine || item.operatorName || 'Hãng tàu Quốc tế',
        containerCount: item.containerCount || (conts.length > 0 ? conts.length : 1),
        containers: conts,
        validUntil: item.validUntil || '2026-11-30',
        emptyReturnDepot: item.emptyReturnDepot || 'Depot Cảng Tiên Sa',
        dischargePort: item.dischargePort || 'VNDAD (Cảng Tiên Sa)',
      })
    })

    // Chỉ liệt kê vận đơn / lệnh eDO thật của doanh nghiệp do hệ thống trả về (không trộn dữ liệu mẫu hay bản khai của công ty khác)
    return result
  }, [form.flow, selectableSourceItems])

  const allExportSources = useMemo(() => {
    const isDemoItem = item => {
      const bl = String(item?.blNumber || '').toUpperCase()
      const bk = String(item?.bookingNumber || '').toUpperCase()
      const vs = String(item?.vesselName || '').toUpperCase()
      return bl.includes('DEMO-EPORT') || bk.includes('DEMO-EPORT') || vs.includes('DEMO EPORT')
    }
    const normKey = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const seenKeys = new Set()
    const result = []

    // Lấy thông tin công ty của tài khoản đăng nhập hiện tại
    let storedUser = null
    try {
      storedUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}')
    } catch {}
    const userCompany = (storedUser?.companyName || storedUser?.company || storedUser?.carrierName || '').trim()
    const userCompanyNorm = normKey(userCompany)
    const isCarrier = ['carrier', 'transport', 'vận tải'].some(r => String(storedUser?.role || '').toLowerCase().includes(r))
    const matchesCompany = (sourceCompany) => {
      if (!userCompanyNorm || !isCarrier) return true
      const scNorm = normKey(sourceCompany)
      if (!scNorm) return true
      return scNorm.includes(userCompanyNorm) || userCompanyNorm.includes(scNorm)
    }

    // 1. Quét từ Gate Bookings xuất khẩu (manifestPortSyncService) của công ty
    let gateBookings = []
    try { gateBookings = manifestPortSyncService.getGeneratedGateBookings() || [] } catch { gateBookings = [] }
    const gbGroups = new Map()
    gateBookings.forEach(gb => {
      const isExp = String(gb.direction || gb.flow || gb.operation || '').toUpperCase().includes('EXPORT') ||
        String(gb.operation || '').toUpperCase() === 'DROPOFF' ||
        String(gb.bookingType || '').toUpperCase() === 'DROPOFF'
      if (!isExp || isDemoItem(gb)) return
      const bCompany = gb.transportCompany || gb.company || gb.carrierProfile?.companyName
      if (!matchesCompany(bCompany)) return

      const code = gb.blNumber || gb.cargoDeclarationId || gb.billOfLading || gb.bookingNumber || gb.bookingCode
      const k = normKey(code)
      if (!k) return
      if (!gbGroups.has(k)) {
        gbGroups.set(k, {
          id: gb.id || code,
          blNumber: gb.blNumber || gb.cargoDeclarationId || gb.billOfLading || code,
          bookingNumber: gb.bookingNumber || gb.bookingCode || code,
          vesselName: gb.vesselName || 'Tàu xuất Hãng tàu',
          voyageNumber: gb.voyageNumber || 'Chuyến xuất',
          shippingLine: gb.shippingLine || 'Hãng tàu Quốc tế',
          containers: [],
        })
      }
      const grp = gbGroups.get(k)
      const cNo = (gb.containerId || gb.containerNumber || '').trim().toUpperCase()
      if (cNo && !grp.containers.includes(cNo)) grp.containers.push(cNo)
    })
    gbGroups.forEach((val, k) => {
      if (seenKeys.has(k)) return
      seenKeys.add(k)
      result.push({
        ...val,
        containerCount: val.containers.length || 1,
      })
    })

    // 2. Quét từ API nguồn (selectableSourceItems)
    ;(selectableSourceItems || []).forEach(item => {
      if (!item || isDemoItem(item)) return
      if (!matchesCompany(item.transportCompany || item.company || item.operatorName)) return
      const code = item.blNumber || item.bookingNumber
      const k = normKey(code)
      if (!k || seenKeys.has(k)) return
      seenKeys.add(k)
      result.push(item)
    })

    // 3. Quét từ Bản khai Manifest xuất khẩu (allExportManifests)
    ;(allExportManifests || []).forEach(m => {
      if (!m || isDemoItem(m)) return
      if (Array.isArray(m.bills) && m.bills.length > 0) {
        m.bills.forEach(b => {
          if (!matchesCompany(b.transportCompany || b.consignee || b.shipper || m.transportCompany)) return
          const code = b.blNumber || m.blNumber || m.bookingNumber
          const k = normKey(code)
          if (!k || seenKeys.has(k)) return
          seenKeys.add(k)
          result.push({
            id: `${m.bookingId || code}-${code}`,
            blNumber: code,
            bookingNumber: m.bookingNumber || code,
            vesselName: m.vesselName,
            voyageNumber: m.voyageNumber,
            shippingLine: m.shippingLine || m.carrierName || 'Hãng tàu Quốc tế',
            containerCount: (b.containers || []).length || (m.containers || []).length || 1,
            containers: b.containers || m.containers || [],
          })
        })
      } else {
        if (!matchesCompany(m.transportCompany || m.company)) return
        const code = m.blNumber || m.bookingNumber
        const k = normKey(code)
        if (!k || seenKeys.has(k)) return
        seenKeys.add(k)
        result.push({
          id: m.bookingId || code,
          blNumber: m.blNumber || code,
          bookingNumber: m.bookingNumber || code,
          vesselName: m.vesselName,
          voyageNumber: m.voyageNumber,
          shippingLine: m.shippingLine || m.carrierName || 'Hãng tàu Quốc tế',
          containerCount: (m.containers || []).length || 1,
          containers: m.containers || [],
        })
      }
    })

    return result
  }, [selectableSourceItems, allExportManifests, manifestSyncVersion])

  // Lấy toàn bộ mã B/L, Booking, eDO và Container đã được tạo đơn hoặc đặt Booking trong hệ thống
  const bookedContext = useMemo(() => {
    const norm = str => String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const bookedBlSet = new Set()
    const bookedContSet = new Set()

    // 1. Từ Service Orders (eport service orders)
    if (ordersListQuery.data?.items) {
      ordersListQuery.data.items.forEach(order => {
        const st = String(order.status || '').toUpperCase()
        if (st === 'CANCELLED' || st === 'REJECTED') return
        const bl = norm(order.source?.blNumber)
        const ref = norm(order.source?.referenceNumber)
        const bk = norm(order.source?.bookingNumber)
        if (bl) bookedBlSet.add(bl)
        if (ref) bookedBlSet.add(ref)
        if (bk) bookedBlSet.add(bk)
        if (order.sourceLabel) {
          const sl = norm(order.sourceLabel)
          if (sl) bookedBlSet.add(sl)
        }
        (order.lines || []).forEach(l => {
          const num = (l.declaration?.containerNumber || l.containerNumber || '').toUpperCase().trim()
          if (num) bookedContSet.add(num)
        })
      })
    }

    // 2. Từ Gate Bookings (manifestPortSyncService)
    try {
      const gbs = manifestPortSyncService.getGeneratedGateBookings() || []
      gbs.forEach(b => {
        const st = String(b.status || '').toLowerCase()
        if (st === 'cancelled' || st === 'canceled' || st === 'rejected') return
        const bl = norm(b.cargoDeclarationId || b.blNumber || b.billOfLading)
        const bk = norm(b.bookingNumber || b.bookingCode || b.id)
        if (bl) bookedBlSet.add(bl)
        if (bk) bookedBlSet.add(bk)
        const cNo = String(b.containerId || b.containerNumber || '').toUpperCase().trim()
        if (cNo) bookedContSet.add(cNo)
      })
    } catch (err) {
      console.warn('Lỗi đọc gate bookings:', err)
    }

    return { bookedBlSet, bookedContSet }
  }, [ordersListQuery.data, manifestSyncVersion])

  const isSourceItemBooked = useCallback((item) => {
    if (!item) return false
    const norm = str => String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const { bookedBlSet, bookedContSet } = bookedContext

    // Nếu B/L này đang được chọn trên form hiện tại thì không ẩn để user thao tác
    const currentKey = norm(form.source.blNumber || form.source.referenceNumber || step1ImportInput || step1BookingInput)
    const itemKeys = [
      item.blNumber,
      item.referenceNumber,
      item.bookingNumber,
      item.id,
      ...(item.bookingAliases || [])
    ].map(norm).filter(Boolean)

    if (currentKey && itemKeys.includes(currentKey)) {
      return false
    }

    // A. Nếu B/L có danh sách container:
    const conts = Array.isArray(item.containers) && item.containers.length > 0 ? item.containers : []
    if (conts.length > 0) {
      const remainingConts = conts.filter(c => {
        const cNo = (typeof c === 'string' ? c : c.containerNumber || c.containerId || '').trim().toUpperCase()
        return cNo && !bookedContSet.has(cNo)
      })
      // Nếu tất cả container thuộc B/L này đều đã được booking -> ĐÃ BOOKING -> Ẩn khỏi dropdown!
      if (remainingConts.length === 0) {
        return true
      }
      return false
    }

    // B. Nếu B/L không có danh sách container chi tiết:
    if (itemKeys.some(k => bookedBlSet.has(k))) {
      return true
    }

    return false
  }, [bookedContext, form.source.blNumber, form.source.referenceNumber, step1ImportInput, step1BookingInput])

  // Danh sách Vận đơn / Lệnh eDO hàng nhập hiển thị trên Dropdown (chỉ hiển thị những B/L chưa booking)
  const realImportSources = useMemo(() => {
    return (allImportSources || []).filter(item => !isSourceItemBooked(item))
  }, [allImportSources, isSourceItemBooked])

  // Danh sách Vận đơn / Booking hàng xuất hiển thị trên Dropdown (chỉ hiển thị những B/L chưa booking)
  const realExportSources = useMemo(() => {
    return (allExportSources || []).filter(item => !isSourceItemBooked(item))
  }, [allExportSources, isSourceItemBooked])

  const rawContainersForBl = useMemo(() => {
    const currentBl = (form.source.blNumber || step2BlInput || '').trim().toUpperCase()
    const currentBookingNo = (form.source.referenceNumber || '').trim().toUpperCase()
    const norm = str => String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    const blNorm = norm(currentBl)
    const bkNorm = norm(currentBookingNo)

    const isConfirmed = step2BlConfirmed || Boolean(currentBl) || Boolean(currentBookingNo)
    if (!isConfirmed || (!currentBl && !currentBookingNo)) return []

    const resultConts = []
    const seenConts = new Set()

    const addCont = (c, defaultBl = '', extraMeta = {}) => {
      const cNum = String(c.containerNumber || c.containerId || c.containerNo || '').trim().toUpperCase()
      if (!cNum || seenConts.has(cNum)) return
      seenConts.add(cNum)
      resultConts.push({
        containerNumber: cNum,
        typeCode: c.typeCode || c.isoType || '40HC',
        sealNumber: c.sealNumber || 'SL-88412',
        grossWeightKg: Number(c.grossWeightKg) || (form.flow === 'EXPORT' ? 25400 : 24500),
        commodity: c.commodity || c.cargoDescription || (form.flow === 'EXPORT' ? 'Hàng hóa xuất khẩu' : 'Hàng hóa nhập khẩu'),
        isReefer: Boolean(c.isReefer || /RF|RH/.test(c.typeCode || c.isoType || '')),
        tempRequired: c.tempRequired || null,
        dgClass: c.dgClass || null,
        dischargePort: c.dischargePort || extraMeta.dischargePort || (form.flow === 'EXPORT' ? 'VNHPH' : 'VNDAD'),
        blNumber: c.blNumber || defaultBl || currentBl,
      })
    }

    // Container chỉ thuộc vận đơn đang chọn khi chính B/L của nó khớp; nếu nó không ghi B/L thì chỉ nhận
    // khi nguồn chứa nó (fallbackBl) là đúng vận đơn này. Không lấy theo tên tàu hay theo "toàn bộ container của tài khoản".
    const sameBl = (c, fallbackBl = '') => {
      const own = norm(c.blNumber || c.billOfLading || '')
      return own ? own === blNorm : Boolean(fallbackBl) && norm(fallbackBl) === blNorm
    }

    if (form.flow === 'EXPORT') {
      // 1. Quét allExportManifests
      for (const m of allExportManifests) {
        const mBlNorm = norm(m.blNumber || '')
        const mBkNorm = norm(m.bookingNumber || '')
        const mIdNorm = norm(m.bookingId || '')
        const aliases = (m.bookingAliases || []).map(a => norm(a))
        const matchesBk = bkNorm && (mBkNorm === bkNorm || mIdNorm === bkNorm || aliases.includes(bkNorm))
        const matchesBl = blNorm && mBlNorm === blNorm

        // Kiểm tra trong bills nếu có
        if (Array.isArray(m.bills)) {
          m.bills.forEach(b => {
            const bBlNorm = norm(b.blNumber || '')
            if (bBlNorm === blNorm || (matchesBk && !bBlNorm)) {
              (b.containers || []).forEach(c => addCont(c, b.blNumber || m.blNumber, m))
            }
          })
        }

        // Kiểm tra trong containers / records của m
        const contList = m.containers || m.records || []
        const hasMatchingCont = contList.some(c => norm(c.blNumber || '') === blNorm)
        if (matchesBl || hasMatchingCont || matchesBk) {
          contList.forEach(c => {
            const cBlNorm = norm(c.blNumber || '')
            if (cBlNorm === blNorm || (matchesBl && !cBlNorm) || (matchesBk && !cBlNorm)) {
              addCont(c, c.blNumber || m.blNumber, m)
            }
          })
        }
      }

      // 2. Quét qua toàn bộ synced manifests trong manifestPortSyncService
      const allSynced = manifestPortSyncService.getSyncedManifests() || []
      allSynced.forEach(m => {
        const isExp = String(m.direction || m.flow || '').toUpperCase() !== 'IMPORT' && m.direction !== 'Nhập khẩu'
        if (!isExp) return
        const mBlNorm = norm(m.blNumber || '')
        const mBkNorm = norm(m.bookingNumber || '')
        const matchesBk = bkNorm && mBkNorm === bkNorm
        const matchesBl = blNorm && mBlNorm === blNorm

        if (Array.isArray(m.bills)) {
          m.bills.forEach(b => {
            const bBlNorm = norm(b.blNumber || '')
            if (bBlNorm === blNorm || (matchesBl && !bBlNorm) || (matchesBk && !bBlNorm)) {
              (b.containers || []).forEach(c => addCont(c, b.blNumber || m.blNumber, m))
            }
          })
        }

        const contList = m.records || m.containers || []
        contList.forEach(c => {
          const cBlNorm = norm(c.blNumber || '')
          if (cBlNorm === blNorm || (matchesBl && !cBlNorm) || (matchesBk && !cBlNorm)) {
            addCont(c, c.blNumber || m.blNumber, m)
          }
        })
      })

      // 3. Quét qua gate bookings xuất khẩu (Gate Booking / Port sync)
      const gateBookings = manifestPortSyncService.getGeneratedGateBookings() || []
      gateBookings.forEach(gb => {
        const isExp = gb.direction === 'EXPORT' || gb.operation === 'Dropoff'
        if (!isExp) return
        const gbBl = norm(gb.cargoDeclarationId || gb.blNumber || gb.billOfLading || '')
        const gbBk = norm(gb.id || gb.bookingCode || gb.sourceManifestNumber || gb.bookingNumber || '')
        if (gbBl === blNorm || (bkNorm && gbBk === bkNorm)) {
          addCont({
            containerNumber: gb.containerId,
            typeCode: gb.containerType || '40HC',
            sealNumber: gb.sealNumber || 'SL-88412',
            grossWeightKg: gb.grossWeightKg || 25400,
            commodity: gb.cargoDescription || 'Hàng hóa xuất khẩu',
            isReefer: Boolean(gb.cargoType?.includes('Reefer') || gb.isReefer),
            blNumber: gb.cargoDeclarationId || gb.blNumber || currentBl,
            dischargePort: gb.pod || 'VNHPH',
          }, gb.cargoDeclarationId || gb.blNumber)
        }
      })

      // 4. Quét qua containers từ backend API (containers.data?.items hoặc eligibleContainers)
      const apiConts = containers.data?.items || eligibleContainers || []
      if (Array.isArray(apiConts) && apiConts.length > 0) {
        // API xuất đã lọc theo booking đang chọn (dòng trả về không có blNumber) nên nhận theo bookingId; còn lại phải khớp B/L
        apiConts.filter(c => (form.source.bookingId && c.bookingId === form.source.bookingId) || sameBl(c)).forEach(c => {
          addCont({
            containerNumber: c.containerNumber || c.containerNo || c.id,
            typeCode: c.typeCode || c.isoCode || c.isoType || '40HC',
            sealNumber: c.sealNumber || `SL-${String(c.containerNumber || '88412').slice(-5)}`,
            grossWeightKg: Number(c.grossWeightKg || c.weightKg || c.vgmKg || 25400),
            commodity: c.commodity || c.cargoDescription || 'Hàng hóa xuất khẩu',
            isReefer: Boolean(c.isReefer || /RF|RH/.test(c.typeCode || c.isoCode || '')),
            dischargePort: c.dischargePort || form.source.dischargePort || 'VNHPH',
            blNumber: c.blNumber || currentBl,
          }, c.blNumber || currentBl)
        })
      }

      // 5. Quét qua containers từ step1VesselInfo nếu có
      if (Array.isArray(step1VesselInfo?.containers) && step1VesselInfo.containers.length > 0) {
        step1VesselInfo.containers.filter(c => sameBl(c, step1VesselInfo.blNumber)).forEach(c => {
          addCont(c, step1VesselInfo.blNumber || currentBl)
        })
      }

      // 6. Quét KNOWN_EXPORT_DATABASE
      KNOWN_EXPORT_DATABASE.forEach(item => {
        const bBkNorm = norm(item.bookingNumber)
        const bBlNorm = norm(item.blNumber)
        const aliases = (item.bookingAliases || []).map(a => norm(a))
        if ((bkNorm && (bBkNorm === bkNorm || aliases.includes(bkNorm))) || (blNorm && bBlNorm === blNorm)) {
          (item.containers || []).forEach(c => addCont(c, item.blNumber || currentBl))
        }
      })

      return resultConts
    }

    if (form.flow === 'IMPORT') {
      const edoNorm = norm(form.source.referenceNumber || step1ImportInfo?.edoNumber || '')
      const targetKeys = [blNorm, edoNorm].filter(Boolean)

      const matchesTarget = (c, defaultBl = '') => {
        const cBl = norm(c.blNumber || c.cargoDeclarationId || c.billOfLading || '')
        if (cBl && targetKeys.includes(cBl)) return true
        const defBl = norm(defaultBl)
        if (defBl && targetKeys.includes(defBl)) return true
        return false
      }

      // 1. Quét qua allImportSources và realImportSources (bao gồm EVERGREEN DEMO 02 và các bản khai đã gom)
      ;([...(allImportSources || []), ...(realImportSources || [])]).forEach(item => {
        const iBl = norm(item.blNumber)
        const iEdo = norm(item.referenceNumber || item.edoNumber)
        const iBk = norm(item.bookingNumber)
        const isMatch = (
          (blNorm && (iBl === blNorm || iEdo === blNorm || iBk === blNorm)) ||
          (edoNorm && (iEdo === edoNorm || iBl === edoNorm))
        )
        if (isMatch) {
          (item.containers || []).forEach(c => {
            if (matchesTarget(c, item.blNumber)) {
              addCont(c, item.blNumber || currentBl, item)
            }
          })
        }
      })

      // 2. Quét qua step1ImportInfo nếu có
      if (Array.isArray(step1ImportInfo?.containers) && step1ImportInfo.containers.length > 0) {
        step1ImportInfo.containers.forEach(c => {
          if (matchesTarget(c, step1ImportInfo.blNumber)) {
            addCont(c, step1ImportInfo.blNumber || currentBl)
          }
        })
      }

      // 3. Quét qua toàn bộ synced manifests
      const allSynced = manifestPortSyncService.getSyncedManifests() || []
      allSynced.forEach(m => {
        // Quét bills
        if (Array.isArray(m.bills)) {
          m.bills.forEach(b => {
            const bBlNorm = norm(b.blNumber || '')
            const bEdoNorm = norm(b.edoNumber || '')
            if (targetKeys.includes(bBlNorm) || (bEdoNorm && targetKeys.includes(bEdoNorm))) {
              (b.containers || []).forEach(c => {
                if (matchesTarget(c, b.blNumber)) {
                  addCont(c, b.blNumber || m.blNumber, m)
                }
              })
            }
          })
        }

        // Quét records hoặc containers
        const contList = m.records || m.containers || []
        contList.forEach(c => {
          if (matchesTarget(c, m.blNumber)) {
            addCont(c, c.blNumber || m.blNumber, m)
          }
        })
      })

      // 4. Quét qua toàn bộ gate bookings hàng nhập
      const gateBookings = manifestPortSyncService.getGeneratedGateBookings() || []
      gateBookings.forEach(gb => {
        if (matchesTarget(gb, gb.blNumber)) {
          addCont({
            containerNumber: gb.containerId,
            typeCode: gb.containerType || '40HC',
            sealNumber: gb.sealNumber || 'SL-88412',
            grossWeightKg: gb.grossWeightKg || 24500,
            commodity: gb.cargoDescription || 'Hàng hóa nhập khẩu',
            blNumber: gb.cargoDeclarationId || gb.blNumber || currentBl,
            isReefer: Boolean(gb.cargoType?.includes('Reefer') || gb.isReefer),
            dischargePort: gb.pod || 'VNDAD',
          }, gb.cargoDeclarationId || gb.blNumber)
        }
      })

      // 5. Quét qua databases fallback nếu chưa thấy
      const fallbackPool = [...KNOWN_IMPORT_DATABASE, ...KNOWN_BL_DATABASE, ...fallbackImportContainers]
      fallbackPool.forEach(item => {
        if (matchesTarget(item, item.blNumber)) {
          if (Array.isArray(item.containers)) {
            item.containers.forEach(c => {
              if (matchesTarget(c, item.blNumber)) addCont(c, item.blNumber)
            })
          } else if (item.containerNumber) {
            addCont(item, item.blNumber)
          }
        }
      })

      // 6. Quét qua containers từ backend API
      const apiImportConts = containers.data?.items || eligibleContainers || []
      if (Array.isArray(apiImportConts) && apiImportConts.length > 0) {
        apiImportConts.filter(c => matchesTarget(c, currentBl)).forEach(c => {
          addCont({
            containerNumber: c.containerNumber || c.containerNo || c.id,
            typeCode: c.typeCode || c.isoCode || c.isoType || '40HC',
            sealNumber: c.sealNumber || `SL-${String(c.containerNumber || '88412').slice(-5)}`,
            grossWeightKg: Number(c.grossWeightKg || c.weightKg || c.vgmKg || 24500),
            commodity: c.commodity || c.cargoDescription || 'Hàng hóa nhập khẩu',
            isReefer: Boolean(c.isReefer || /RF|RH/.test(c.typeCode || c.isoCode || '')),
            dischargePort: c.dischargePort || form.source.dischargePort || 'VNDAD',
            blNumber: c.blNumber || currentBl,
          }, c.blNumber || currentBl)
        })
      }

      return resultConts
    }

    return []
  }, [form.flow, form.source.blNumber, form.source.referenceNumber, form.source.vesselName, form.source.voyageNumber, step2BlInput, step2BlConfirmed, allExportManifests, realImportSources, fallbackImportContainers, manifestSyncVersion, containers.data, eligibleContainers, step1VesselInfo, step1ImportInfo])

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
        'Đổi vận đơn sẽ làm mới danh sách container.'
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
          vesselName: edoItem.vesselName || '',
          voyageNumber: edoItem.voyageNumber || '',
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
                : {
                    containerNumber: row.containerNumber,
                    isoCode: row.typeCode,
                    blNumber: row.blNumber || form.source.blNumber || step2BlInput,
                    cargoType: row.cargoType || (isReefer(row) ? 'Reefer' : 'General'),
                  },
              blNumber: row.blNumber || form.source.blNumber || step2BlInput,
              services: [
                ...(main ? [serviceLine(main)] : []),
                ...((isReefer(row) || /RF|RH/i.test(row.typeCode || '') || row.containerNumber?.startsWith('NXPU')) && reeferService ? [{
                  serviceId: reeferService.id,
                  startsAt: previous.plannedAt || defaultPlannedAt(),
                  endsAt: previous.delivery.orderValidUntil || previous.source.validUntil || (previous.plannedAt ? localTime(new Date(new Date(previous.plannedAt).getTime() + 48 * 3600000).toISOString()) : ''),
                  quantity: null,
                }] : []),
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
    const currentBooking =
      (sampleMode ? sampleData.bookings : sources.data?.items)?.find(item => item.id === form.source.bookingId) ||
      bookingSnapshots[form.source.bookingId]

    mutate(previous => ({
      ...previous,
      plannedAt: previous.plannedAt || defaultPlannedAt(),
      lines: unlocked.slice(0, 50).map(row => {
        const existing = previous.lines.find(l => l.sourceContainerId === containerId(row))
        if (existing) return existing
        return {
          sourceContainerId: containerId(row),
          customsSealRequired: false,
          declaration: previous.flow === 'EXPORT'
            ? buildExportDeclaration(row, currentBooking)
            : { containerNumber: row.containerNumber, isoCode: row.typeCode },
          services: [
            ...(main ? [serviceLine(main)] : []),
          ],
        }
      }),
    }))
  }

  // Only source occurrences belonging to the selected export Booking can be added.
  const addExportContainerRow = () => {
    if (form.lines.length >= 50) return setFeedback('Mỗi hồ sơ đăng ký tối đa 50 container.')
    const row = eligibleContainers.find(item => containerId(item) === manualContainer)
    if (!row) return setFeedback('Chọn container hợp lệ thuộc vận đơn xuất hiện tại.')
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
    setStep2BlInput(bObj.blNumber || bObj.bookingNumber)
    setStep2BlConfirmed(true)
  }

  // Tự động đồng bộ và xác nhận B/L cho Bước 2 khi đã chọn vận đơn/booking ở Bước 1
  useEffect(() => {
    const activeRef = form.source.blNumber || form.source.referenceNumber || form.source.bookingNumber || step1BookingInput || step1ImportInput
    if (activeRef) {
      const clean = String(activeRef).trim().toUpperCase()
      if (!step2BlInput) setStep2BlInput(clean)
      if (!form.source.blNumber) {
        mutate(previous => ({
          ...previous,
          source: {
            ...previous.source,
            blNumber: clean,
          }
        }))
      }
      if (!step2BlConfirmed) {
        setStep2BlConfirmed(true)
      }
    }
  }, [step, step1BookingConfirmed, step1ImportConfirmed, form.source.referenceNumber, form.source.blNumber, step1BookingInput, step1ImportInput, step2BlConfirmed, step2BlInput])

  // Khi ở Bước 2 và danh sách container từ Hãng tàu đã sẵn sàng mà chưa có container nào được chọn:
  // Tự động tích chọn tất cả container của B/L đó để người dùng có thể bấm "Tiếp tục" sang bước tiếp theo ngay
  useEffect(() => {
    if (step === 1 && availableContainersForBl.length > 0 && form.lines.length === 0) {
      handleSelectAllExportContainers()
    }
  }, [step, availableContainersForBl.length, form.lines.length])

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
    const isMainGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(form.mainServiceId)
    const validTrips = syncTrips.filter(t => t.truckId && t.driverId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.truckId) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.driverId))

    return {
      ...result,
      mainServiceId: isMainGuid ? form.mainServiceId : null,
      delivery: {
        ...form.delivery,
        orderValidUntil: resolvedOrderValid || null,
        trips: validTrips,
      },
      source: {
        ...form.source,
        bookingId: form.flow === 'IMPORT' ? null : (isBookingGuid ? form.source.bookingId : null),
        bookingNumber: safeBookingNumber,
        referenceNumber: safeReferenceNumber,
        validUntil: form.source.validUntil || null,
      },
      plannedAt: utcTime(form.plannedAt),
      lines: form.lines.map(line => {
        let lineServices = [...(line.services || [])]
        const dec = line.declaration || {}
        const snap = snapshots[line.sourceContainerId] || {}
        const isReeferCont = isReefer(dec) || isReefer(snap) || /RF|RH/i.test(dec.isoCode || snap.typeCode || '') || dec.containerNumber?.startsWith('NXPU') || (dec.cargoType && /reefer|lạnh|frozen/i.test(dec.cargoType))
        
        // Tự động bổ sung dịch vụ cắm điện container lạnh trong payload ngầm nếu là container lạnh hàng nhập
        if (isReeferCont && reeferService) {
          const hasReeferService = lineServices.some(s => s.serviceId === reeferService.id || s.code === 'REEFER_POWER')
          if (!hasReeferService) {
            lineServices.push({
              serviceId: reeferService.id,
              startsAt: line.startsAt || form.plannedAt || defaultPlannedAt(),
              endsAt: line.endsAt || form.delivery.orderValidUntil || form.source.validUntil || (form.plannedAt ? localTime(new Date(new Date(form.plannedAt).getTime() + 48 * 3600000).toISOString()) : ''),
              quantity: null,
            })
          }
        }

        const safeGuid = (line.sourceContainerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(line.sourceContainerId))
          ? line.sourceContainerId
          : (() => {
              const num = dec.containerNumber || line.sourceContainerId || 'CONT'
              let hash = 0
              for (let i = 0; i < num.length; i++) hash = ((hash << 5) - hash) + num.charCodeAt(i) | 0
              const hex = Math.abs(hash).toString(16).padStart(8, '0')
              return `00000000-0000-4000-8000-${hex.padEnd(12, '0').slice(0, 12)}`
            })()

        return {
          ...line,
          sourceContainerId: safeGuid,
          services: lineServices.map(item => {
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
        }
      }),
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
      // Chỉ đồng bộ đội xe lên Cảng sau khi người dùng xác nhận gửi đơn (ServiceRegistrationReview), không đẩy dữ liệu nháp (DRAFT)
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

  const next = async () => {
    // BƯỚC 1 VALIDATION
    if (step === 0 && !main) {
      return setFeedback('Vui lòng chọn dịch vụ tác nghiệp để tiếp tục.')
    }

    if (step === 0 && form.flow === 'IMPORT') {
      const hasImport = Boolean(form.source.referenceNumber?.trim() || step1ImportInput.trim())
      if (!hasImport || !step1ImportConfirmed) {
        return setFeedback('Vui lòng nhập số vận đơn (B/L) và bấm nút "Kiểm tra" trước khi tiếp tục!')
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
        return setFeedback('Vui lòng nhập số vận đơn (B/L) và bấm nút "Kiểm tra" để tra cứu thông tin tàu trước khi tiếp tục!')
      }
      const picked =
        (sampleMode ? sampleData.bookings : sources.data?.items)?.find(item => item.id === form.source.bookingId) ||
        bookingSnapshots[form.source.bookingId] ||
        allExportManifests.find(b => b.bookingId === form.source.bookingId || b.bookingNumber === form.source.referenceNumber)
      if (picked?.cyCutoff && new Date(picked.cyCutoff) <= new Date()) {
        return setFeedback('Chuyến tàu của vận đơn này đã quá hạn hạ bãi (CY Cut-off)! Hệ thống tự động khóa đăng ký.')
      }
      if (picked?.isHeld || picked?.status === 'Cancelled') {
        return setFeedback('Vận đơn đã bị hủy hoặc đang bị giữ (Hold)! Không thể tiếp tục.')
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
    }

    // BƯỚC 4 VALIDATION: KHAI BÁO GIAO NHẬN (XE)
    if (step === deliveryStep) {
      const data = form.delivery
      if (form.lines.some(line => {
        const trip = data.trips?.find(t => t.sourceContainerId === line.sourceContainerId)
        return !trip?.truckId || !trip?.driverId
      })) {
        return setFeedback('Vui lòng chọn xe rảnh và tài xế rảnh cho từng container trước khi tiếp tục.')
      }
    }

    // BƯỚC 5 VALIDATION: BỘ HỒ SƠ & CHỨNG TỪ
    if (step === documentsStep) {
      const docs = form.delivery.documents || []
      const hasReeferContainer = form.lines.some(line => isReefer(snapshots[line.sourceContainerId]))

      if (form.flow === 'EXPORT') {
        if (!docs.some(d => d.documentType === 'CarrierBookingReference')) {
          return setFeedback('Vui lòng tải lên chứng từ vận đơn xuất / Mã hạ cont (bắt buộc).')
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
    service => compatible(service, form.flow) &&
      !['EXPORT_DROPOFF', 'IMPORT_PICKUP', 'REEFER_POWER'].includes(service.code) &&
      service.id !== 'REEFER_POWER' &&
      !service.name?.toLowerCase().includes('cắm điện') &&
      service.id !== form.mainServiceId
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
      ? selectedBooking?.bookingNumber || detail.data?.sourceSnapshot?.bookingNumber || 'Chưa chọn vận đơn'
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
              : 'Khai báo vận đơn, container xuất và gửi Dispatcher. Thanh toán sau khi nhận kết quả và số tiền.'}
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
                    <strong>Dữ liệu mẫu · 3 vận đơn, 6 container</strong>
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
                      <h3>{form.flow === 'IMPORT' ? 'Khai báo lệnh giao nhận điện tử (eDO)' : 'Khai báo thông tin vận đơn'}</h3>
                      <p>Nhập đầy đủ các thông tin bắt buộc có ký hiệu (*) màu đỏ trước khi xác thực email.</p>
                    </div>
                  </div>

                  {form.flow === 'IMPORT' ? (
                    <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0', flexWrap: 'gap', gap: '8px' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                            Khai báo vận đơn hàng nhập (B/L)
                          </h4>
                          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                            Nhập số vận đơn (B/L) nhập khẩu để tra cứu dữ liệu chuyến tàu do hãng tàu cung cấp
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '680px' }}>
                          {/* 1. CHỌN NHANH TỪ DANH SÁCH VẬN ĐƠN / eDO DOANH NGHIỆP */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                              Chọn Vận đơn (B/L) hoặc Lệnh eDO từ danh sách <span style={{ color: '#dc2626' }}>*</span>
                            </label>
                            <Select
                              aria-label="Chọn vận đơn hoặc lệnh eDO hàng nhập"
                              value={step1ImportInput}
                              onChange={event => {
                                const code = event.target.value
                                if (!code) return
                                setStep1ImportInput(code)
                                handleConfirmImportEdo(code)
                              }}
                              disabled={sources.isFetching && !realImportSources.length}
                              style={{
                                height: '40px',
                                padding: '0 10px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                fontSize: '13px',
                                color: '#0f172a',
                                background: '#ffffff',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="">
                                {sources.isFetching && !realImportSources.length
                                  ? 'Đang tải vận đơn hàng nhập…'
                                  : realImportSources.length
                                    ? `Chọn Vận đơn (B/L) hoặc Lệnh eDO từ danh sách (${realImportSources.length} Vận đơn chưa booking)`
                                    : 'Không có vận đơn nào chưa booking'}
                              </option>
                              {realImportSources.map(item => {
                                const conts = (item.containers || [])
                                const unbooked = conts.length > 0
                                  ? conts.filter(c => {
                                      const cNo = (typeof c === 'string' ? c : c.containerNumber || c.containerId || '').trim().toUpperCase()
                                      return cNo && !bookedContext.bookedContSet.has(cNo)
                                    }).length
                                  : item.containerCount || 1
                                return (
                                  <option key={item.id} value={item.blNumber || item.referenceNumber}>
                                    {item.blNumber || item.referenceNumber} · {item.vesselName} / {item.voyageNumber} · {unbooked} cont
                                  </option>
                                )
                              })}
                            </Select>
                            <span style={{ color: '#64748b', fontSize: '12px' }}>
                              Chọn từ danh sách để tự động điền thông tin tàu và danh sách container hàng nhập.
                            </span>
                          </div>

                          {step1ImportError && (
                            <div style={{
                              marginTop: '2px',
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
                                  <td style={{ padding: '9px 12px', background: '#f8fafc', color: '#64748b', fontWeight: 500 }}>Số vận đơn</td>
                                  <td style={{ padding: '9px 12px', color: '#0f172a' }}>{form.source.blNumber || step1ImportInfo?.blNumber || '-'}</td>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '640px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                              Số vận đơn (B/L) hàng xuất <span style={{ color: '#dc2626' }}>*</span>
                            </label>
                            <Select
                              aria-label="Chọn vận đơn của doanh nghiệp"
                              value={step1BookingInput || form.source.referenceNumber || form.source.blNumber || ''}
                              onChange={event => {
                                const code = event.target.value
                                if (!code) return
                                setStep1BookingInput(code)
                                handleConfirmExportBooking(code)
                              }}
                              disabled={sources.isFetching && !realExportSources.length}
                              style={{
                                width: '100%',
                                height: '40px',
                                padding: '0 10px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                fontSize: '13px',
                                color: '#0f172a',
                                background: '#ffffff',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="">
                                {sources.isFetching && !realExportSources.length
                                  ? 'Đang tải vận đơn của doanh nghiệp…'
                                  : realExportSources.length
                                    ? `Chọn Vận đơn (B/L) của doanh nghiệp (${realExportSources.length} Vận đơn chưa booking)`
                                    : 'Không có vận đơn nào chưa booking'}
                              </option>
                              {realExportSources.map(item => {
                                const blText = item.blNumber || item.bookingNumber
                                const bkExtra = item.bookingNumber && item.bookingNumber !== item.blNumber ? ` (Booking: ${item.bookingNumber})` : ''
                                const conts = (item.containers || [])
                                const unbooked = conts.length > 0
                                  ? conts.filter(c => {
                                      const cNo = (typeof c === 'string' ? c : c.containerNumber || c.containerId || '').trim().toUpperCase()
                                      return cNo && !bookedContext.bookedContSet.has(cNo)
                                    }).length
                                  : item.containerCount || (item.containers?.length) || 1
                                return (
                                  <option key={item.id} value={item.blNumber || item.bookingNumber}>
                                    {blText}{bkExtra} · Tàu {item.vesselName} ({item.voyageNumber}) · {unbooked} cont
                                  </option>
                                )
                              })}
                            </Select>
                            <span style={{ color: '#64748b', fontSize: '12px' }}>
                              Chọn vận đơn từ danh sách để tự động tra cứu thông tin chuyến tàu và container từ hãng tàu.
                            </span>
                          </div>

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
                              Mã vận đơn: <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{form.source.referenceNumber}</strong>
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
                              Đổi mã vận đơn khác
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

                  {((emailSource === sourceKey || step1ImportConfirmed || step1BookingConfirmed || form.source.referenceNumber || form.source.bookingId) && verifiedSource !== sourceKey && !sampleMode) && (
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
                          setStep2BlConfirmed(true)
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
                          : 'Chỉ chọn container thuộc vận đơn xuất đã được phát hành. Thông tin nguồn được điền sẵn theo container đã chọn.'}
                      </p>
                    </div>
                  </div>

                  {form.flow === 'IMPORT' ? (
                    // GIAO HÀNG NHẬP: Quy trình tương tự bên xuất (Nhập B/L -> Hiện danh sách container Hãng tàu -> Tích chọn)
                    <div className="epd-import-progressive-flow" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {(!step2BlConfirmed && !form.source.blNumber && !form.source.referenceNumber) ? (
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
                                  onChange={e => {
                                    setStep2BlInput(e.target.value.toUpperCase())
                                    if (step2BlError) setStep2BlError('')
                                  }}
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
                              {step2BlError && (
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
                                  <span>{step2BlError}</span>
                                </div>
                              )}
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

                          {/* BẢNG TỔNG KẾT VÀ CHỈNH SỬA CÁC CONTAINER ĐÃ CHỌN (LUỒNG NHẬP KHẨU) */}
                          {form.lines.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                              {availableContainersForBl.length === 0 && rawContainersForBl.length > 0 ? (
                                <div style={{ padding: '16px', background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '24px' }}>✅</span>
                                  <strong style={{ fontSize: '13px', color: '#166534' }}>
                                    Tất cả {rawContainersForBl.length} container thuộc Vận đơn này đã được đăng ký booking &amp; thanh toán hoàn tất!
                                  </strong>
                                  <span style={{ fontSize: '12px', color: '#15803d' }}>
                                    Không còn container nào chờ khai báo. Vui lòng nhập số B/L khác hoặc nhấn Tiếp tục nếu đã chọn container từ trước.
                                  </span>
                                </div>
                              ) : availableContainersForBl.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                  <span>Chưa có container nào được chọn trong đơn.</span>
                                  <button
                                    type="button"
                                    onClick={handleSelectAllExportContainers}
                                    style={{
                                      fontSize: '12px',
                                      padding: '6px 14px',
                                      background: '#0284c7',
                                      border: 'none',
                                      borderRadius: '4px',
                                      color: '#ffffff',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Tích chọn lại tất cả ({availableContainersForBl.length} container)
                                  </button>
                                </div>
                              ) : (
                                'Không tìm thấy container nào thuộc số B/L này từ Hãng tàu.'
                              )}
                            </div>
                          ) : (
                            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                                <div>
                                  <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                                    Danh sách Container lấy nguyên đã chọn ({form.lines.length} Container)
                                  </strong>
                                  <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '12px' }}>
                                    Tích chọn ô Niêm phong HQ nếu container có chì hải quan
                                  </span>
                                </div>
                                {availableContainersForBl.length > form.lines.length && (
                                  <button
                                    type="button"
                                    onClick={handleSelectAllExportContainers}
                                    style={{
                                      fontSize: '12px',
                                      padding: '4px 10px',
                                      background: '#f8fafc',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '4px',
                                      color: '#0284c7',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Chọn lại tất cả ({availableContainersForBl.length})
                                  </button>
                                )}
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
                      {(!step2BlConfirmed && !form.source.blNumber && !form.source.referenceNumber) ? (
                        /* GIAI ĐOẠN 1 (HÀNG XUẤT): NHẬP SỐ VẬN ĐƠN (B/L) - GIAO DIỆN BASIC */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '18px', maxWidth: '640px' }}>
                            <div style={{ marginBottom: '12px' }}>
                              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                                Khai báo Số Vận Đơn (Bill of Lading / B/L)
                              </h4>
                              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                                Tự nhập số Vận đơn (B/L) cho chuyến tàu <strong>{form.source.vesselName || 'xuất khẩu'}</strong>.
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
                                  onChange={e => {
                                    setStep2BlInput(e.target.value.toUpperCase())
                                    if (step2BlError) setStep2BlError('')
                                  }}
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
                              {step2BlError && (
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
                                  <span>{step2BlError}</span>
                                </div>
                              )}
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
                              <strong style={{ color: '#0f172a', fontFamily: 'monospace', fontSize: '14px' }}>{form.source.blNumber || step2BlInput || form.source.referenceNumber}</strong>
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
                      <h3>Thời gian thực hiện &amp; Liên hệ</h3>
                      <p>Xác nhận thời gian dự kiến thực hiện và thông tin người liên hệ giao nhận.</p>
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
                              <small>{dec?.isoCode || row?.typeCode || 'Container'}</small>
                            </div>
                            <span className="epd-line-index">{String(index + 1).padStart(2, '0')}</span>
                          </header>

                          <div className="epd-line-content">
                            {/* Bỏ hiển thị TÁC NGHIỆP CHÍNH & Dịch vụ đính kèm theo yêu cầu */}

                            {line.services.map(usage => {
                              const service = services.find(s => s.id === usage.serviceId)
                              if (!service || !timeUnit(service)) return null
                              // Tự động có đi mà ko cần hiện ra: Ẩn khối nhập thời gian cắm điện container lạnh
                              if (service.id === 'REEFER_POWER' || service.code === 'REEFER_POWER' || service.name?.toLowerCase().includes('cắm điện')) return null
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
                      <SummaryItem label={form.flow === 'EXPORT' ? 'Vận đơn' : 'DO/eDO'}>{sourceLabel}</SummaryItem>
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
                  <span className="epd-summary-count">
                    {(form.lines.length || (step === 0 && availableContainersForBl.length) || (step === 0 && (step1ImportInfo?.containers?.length || step1VesselInfo?.containers?.length)) || 0).toString().padStart(2, '0')}
                  </span>
                  {(availableContainersForBl.length > 0 || step1ImportInfo?.containers?.length > 0) && (
                    <small style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                      {form.lines.length > 0
                        ? `đã chọn ${form.lines.length} / ${Math.max(form.lines.length, availableContainersForBl.length || step1ImportInfo?.containers?.length || 0)} container thuộc vận đơn`
                        : `${availableContainersForBl.length || step1ImportInfo?.containers?.length || 0} container sẵn sàng khai báo`}
                    </small>
                  )}
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
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-confirm-title"
          onClick={() => setLeaveConfirm(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.45)', padding: '16px' }}
        >
          <div
            onClick={event => event.stopPropagation()}
            style={{ width: '100%', maxWidth: '440px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)', padding: '24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <AlertCircle size={22} style={{ color: '#d97706', flexShrink: 0 }} />
              <h3 id="leave-confirm-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Thay đổi chưa được lưu</h3>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              Hồ sơ có thay đổi chưa lưu. Bạn muốn tiếp tục chỉnh sửa, lưu nháp hay đóng mà không lưu?
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="epc-button secondary" onClick={() => setLeaveConfirm(false)}>Tiếp tục chỉnh sửa</button>
              <button type="button" className="epc-button secondary" onClick={onClose}>Đóng bỏ qua</button>
              {!sampleMode && (
                <button type="button" className="epc-button primary" onClick={() => save.mutate()} disabled={save.isPending || emailBusy}>
                  <Save size={15} />Lưu nháp
                </button>
              )}
            </div>
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
