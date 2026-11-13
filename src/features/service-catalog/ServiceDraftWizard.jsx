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
  X,
} from 'lucide-react'
import CatalogDialog from './CatalogDialog'
import BookingSourceSelect from './BookingSourceSelect'
import ServiceSourceEmailPanel from './ServiceSourceEmailPanel'
import { CustomsStep, DeliveryFields, ExportDeclarationFields } from './ServiceDeliveryFields'
import { ServiceTripSummary } from './ServiceTripFleet'
import { blankDelivery, blankBuyer, validContainer } from './serviceDeliveryRules'
import './serviceDelivery.css'
import { createServiceDraftSamples } from './serviceDraftSamples'
import { labels } from './catalogApi'
import { draftDateTime, draftError, draftSession, serviceDraftKey, serviceDraftsApi } from './serviceDraftsApi'

const blankSource = () => ({
  bookingId: null,
  documentType: 'EDO',
  referenceNumber: '',
  bookingNumber: '',
  blNumber: '',
  validUntil: '',
  bookingMode: 'LINKED',
  vesselName: '',
  voyageNumber: '',
})

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

const buildExportDeclaration = (row, booking) => ({
  containerNumber: row.containerNumber,
  operatorName: row.operatorName || booking?.operatorName || 'ONE / MAERSK',
  isoCode: row.typeCode || '',
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
  weightKg: row.vgmKg ?? null,
  tradeType: 'FOREIGN',
  sealNumber: row.sealNumber || '',
  dischargePort: row.dischargePort || booking?.portOfDischarge || 'Singapore',
  destinationPort: row.destinationPort || booking?.portOfDischarge || 'Singapore',
  imoClass: row.dgClass || '',
  unNumber: row.unNumber || '',
  temperature: row.targetTemperature ?? (isReefer(row) ? -18 : null),
})

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

export default function ServiceDraftWizard({ services = [], initialServiceId, draftId, onClose, onSaved, onReview }) {
  const headingId = useId()
  const client = useQueryClient()
  const session = draftSession()
  const initial = services.find(service => service.id === initialServiceId)
  const [id] = useState(() => draftId || crypto.randomUUID())

  const [form, setForm] = useState(() => ({
    workflowVersion: 2,
    delivery: blankDelivery(),
    invoiceBuyer: blankBuyer(),
    dataMode: 'LIVE',
    expectedVersion: 0,
    flow: initial?.direction === 'IMPORT' ? 'IMPORT' : 'EXPORT',
    mainServiceId: initial?.id || null,
    source: blankSource(),
    plannedAt: '',
    contactName: '',
    contactPhone: '',
    note: '',
    lines: [],
  }))

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
        ['Xác nhận thông quan', ShieldCheck],
        ['Khai báo giao nhận', CalendarDays],
        ['Kiểm tra & Gửi đăng ký', FileCheck2],
      ]
    : [
        ['eBooking & Email', FileText],
        ['Khai báo container', Container],
        ['Dịch vụ đính kèm', Layers3],
        ['Xác nhận thông quan', ShieldCheck],
        ['Khai báo giao nhận', CalendarDays],
        ['Kiểm tra & Gửi đăng ký', FileCheck2],
      ]

  const deliveryStep = 4
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
    if (draftId || !profile.data || profileLoaded.current) return
    profileLoaded.current = true
    const data = profile.data
    setForm(previous => ({
      ...previous,
      contactName: previous.contactName || data.contactName || '',
      contactPhone: previous.contactPhone || data.contactPhone || '',
      invoiceBuyer: {
        name: previous.invoiceBuyer.name || data.companyName || '',
        taxCode: previous.invoiceBuyer.taxCode || data.taxCode || '',
        address: previous.invoiceBuyer.address || data.address || '',
        email: previous.invoiceBuyer.email || data.email || '',
      },
    }))
  }, [draftId, profile.data])

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
    setForm({
      workflowVersion: 2,
      delivery: { ...blankDelivery(), ...saved.delivery, orderValidUntil: saved.delivery?.orderValidUntil || '' },
      invoiceBuyer: { ...blankBuyer(), ...saved.invoiceBuyer },
      dataMode: 'LIVE',
      expectedVersion: saved.version,
      flow: saved.flow,
      mainServiceId: saved.mainServiceId || null,
      source: { ...blankSource(), ...saved.source, validUntil: saved.source?.validUntil?.slice(0, 10) || '' },
      plannedAt: localTime(saved.plannedAt),
      contactName: saved.contactName || '',
      contactPhone: saved.contactPhone || '',
      note: saved.note || '',
      lines: (saved.lines || []).map(line => ({
        ...line,
        services: line.services.map(item => ({
          ...item,
          startsAt: localTime(item.startsAt),
          endsAt: localTime(item.endsAt),
        })),
      })),
    })
    setSnapshots(Object.fromEntries((saved.containers || []).map(row => [containerId(row), row])))
    if (saved.source?.bookingId && saved.sourceSnapshot?.bookingNumber) {
      setBookingSnapshots(previous => ({
        ...previous,
        [saved.source.bookingId]: { ...saved.sourceSnapshot, id: saved.source.bookingId },
      }))
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
  const eligibleContainers = containerScopeMatches ? (containers.data.items || []).filter(row =>
    row.flow === form.flow && (form.flow !== 'EXPORT' || row.bookingId === form.source.bookingId) &&
    (main?.code !== 'REEFER_POWER' || !clearlyDry(row))
  ) : []

  useEffect(() => {
    if (containers.data?.items) {
      setSnapshots(previous => ({
        ...previous,
        ...Object.fromEntries(containers.data.items.map(row => [containerId(row), row])),
      }))
    }
  }, [containers.data])

  useEffect(() => {
    // A short, unfiltered response is the complete eligible set. Never prune
    // saved selections just because a search/page does not contain them.
    if (!containerScopeMatches || containers.isFetching || search || containerTerm ||
      containers.data.items.length >= (containers.data.limit || 50)) return
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
      next.delivery = { ...next.delivery, trips: sourceChanged || timeChanged ? [] : (next.delivery.trips || [])
        .filter(trip => selectedIds.has(trip.sourceContainerId)) }
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
      changeContext(
        previous => ({
          ...previous,
          plannedAt: previous.plannedAt || defaultPlannedAt(),
          delivery: {
            ...previous.delivery,
            orderValidUntil: cutoffDate || previous.delivery.orderValidUntil || '',
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
          },
          lines: [],
        }),
        'Đổi Booking sẽ làm mới danh sách container.'
      )
    }
  }

  const chooseImportEdo = edoItem => {
    if (!edoItem) return
    changeContext(
      previous => ({
        ...previous,
        plannedAt: previous.plannedAt || defaultPlannedAt(),
        delivery: {
          ...previous.delivery,
          orderValidUntil: edoItem.validUntil || previous.delivery.orderValidUntil || '',
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
                  : { containerNumber: row.containerNumber, isoCode: row.typeCode },
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
    return {
      ...result,
      delivery: { ...form.delivery, orderValidUntil: form.delivery.orderValidUntil || null },
      source: { ...form.source, validUntil: form.source.validUntil || null },
      plannedAt: utcTime(form.plannedAt),
      lines: form.lines.map(line => ({
        ...line,
        services: line.services.map(item => ({
          ...item,
          startsAt: utcTime(item.startsAt),
          endsAt: utcTime(item.endsAt || form.delivery.orderValidUntil || form.source.validUntil || null),
          quantity: item.quantity === '' || item.quantity == null ? null : Number(item.quantity),
        })),
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
      const missing = []
      if (!form.source.referenceNumber?.trim()) missing.push('Số eDO')
      if (!form.source.blNumber?.trim()) missing.push('Số vận đơn (Bill)')
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
      if (!form.source.bookingId) {
        return setFeedback('Đối với các thông tin có ký hiệu (*) màu đỏ bắt buộc phải nhập: Vui lòng chọn eBooking của công ty!')
      }
      const picked =
        (sampleMode ? sampleData.bookings : sources.data?.items)?.find(item => item.id === form.source.bookingId) ||
        bookingSnapshots[form.source.bookingId]
      if (picked?.cyCutoff && new Date(picked.cyCutoff) <= new Date()) {
        return setFeedback('Chuyến tàu của eBooking này đã quá hạn CY Cut-off! Hệ thống tự động khóa đăng ký.')
      }
      if (picked?.isHeld || picked?.status === 'Cancelled') {
        return setFeedback('eBooking đã bị hủy (BookingCancelled) hoặc đang bị giữ (Hold)! Không thể tiếp tục.')
      }
    }

    // Xác thực email ở bước 1 trước khi sang bước 2
    if (step === 0 && !sampleMode) {
      if (verifiedSource !== sourceKey) {
        setEmailSource(sourceKey)
        setTimeout(() => {
          emailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
        return
      }
    }

    // BƯỚC 2 VALIDATION: KHAI BÁO CONTAINER
    if (step === 1) {
      if (containers.isError || !containerScopeMatches) {
        return setFeedback('Chưa đối chiếu được container hợp lệ của hồ sơ hiện tại. Tải lại dữ liệu hoặc chọn lại Booking/DO trước khi tiếp tục.')
      }
      if (!form.lines.length) {
        return setFeedback(
          form.flow === 'IMPORT'
            ? 'Nếu không tích chọn container, hệ thống không thể chuyển sang bước tiếp theo. Vui lòng tích chọn ít nhất một container cần lấy nguyên!'
            : 'Vui lòng thêm ít nhất một dòng container để tiếp tục.'
        )
      }

      if (form.flow === 'EXPORT') {
        for (let i = 0; i < form.lines.length; i++) {
          const dec = form.lines[i].declaration
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

    // BƯỚC 4 VALIDATION: THÔNG QUAN VASSCM (chỉ luồng Nhập)
    if (step === 3 && !form.delivery.customsConfirmationScope) {
      return setFeedback('Bấm “Xác nhận thông quan” để tiếp tục.')
    }

    // BƯỚC GIAO NHẬN VALIDATION
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

    setStep(previous => Math.min(reviewStep, previous + 1))
  }

  const addonOptions = services.filter(
    service => compatible(service, form.flow) && !['EXPORT_DROPOFF', 'IMPORT_PICKUP'].includes(service.code) && service.id !== form.mainServiceId
  )

  const selectedBooking =
    (sampleMode ? sampleData.bookings : sources.data?.items)?.find(item => item.id === form.source.bookingId) ||
    bookingSnapshots[form.source.bookingId]

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
                    <div className="epd-source-box">
                      <div className="epd-section-label">
                        <FileText size={17} />
                        <h4>Lệnh giao nhận hàng nhập (eDO)</h4>
                        <span className="epd-status emerald">Lệnh điện tử eDO</span>
                      </div>
                      <div className="epd-form-grid">
                        <Field label={<>Lệnh giao nhận <b className="epd-required">*</b></>}>
                          <input
                            aria-label="Loại chứng từ"
                            readOnly
                            disabled
                            value="Lệnh giao nhận điện tử eDO"
                            className="epd-readonly-input"
                          />
                        </Field>

                        <Field label={<>Chọn eDO khả dụng <b className="epd-required">*</b></>}>
                          <select
                            aria-label="Chọn eDO khả dụng"
                            value={form.source.referenceNumber || ''}
                            onChange={e => {
                              const found = (sources.data?.items || []).find(item => item.referenceNumber === e.target.value)
                              if (found) {
                                chooseImportEdo(found)
                              } else {
                                handleImportReferenceChange(e.target.value)
                              }
                            }}
                          >
                            <option value="">-- Chọn eDO từ danh sách đã cấp --</option>
                            {(sources.data?.items || []).map(item => (
                              <option key={item.id || item.referenceNumber} value={item.referenceNumber}>
                                {item.referenceNumber} · Vận đơn: {item.blNumber} {item.isExpired ? '(Hết hạn)' : ''}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label={<>Số eDO <b className="epd-required">*</b></>}>
                          <input
                            aria-label="Số eDO"
                            maxLength={100}
                            value={form.source.referenceNumber}
                            onChange={event => handleImportReferenceChange(event.target.value)}
                            placeholder="Nhập vào số lệnh điện tử eDO"
                          />
                        </Field>

                        <Field label={<>Số vận đơn (Bill) <b className="epd-required">*</b></>}>
                          <input
                            aria-label="Số vận đơn"
                            maxLength={100}
                            value={form.source.blNumber}
                            onChange={event => sourceUpdate('blNumber', event.target.value)}
                            placeholder="Nhập số vận đơn đường biển"
                          />
                        </Field>

                        <Field label="Số Booking">
                          <input
                            aria-label="Số Booking"
                            maxLength={100}
                            value={form.source.bookingNumber || ''}
                            onChange={event => sourceUpdate('bookingNumber', event.target.value)}
                            placeholder="Nhập số Booking (nếu có)"
                          />
                        </Field>

                        <Field label={<>Tên tàu <b className="epd-required">*</b></>}>
                          <input
                            aria-label="Tên tàu nhập"
                            maxLength={150}
                            value={form.source.vesselName}
                            onChange={event => sourceUpdate('vesselName', event.target.value)}
                            placeholder="Tên tàu chở hàng nhập"
                          />
                        </Field>

                        <Field label={<>Chuyến tàu <b className="epd-required">*</b></>}>
                          <input
                            aria-label="Chuyến tàu nhập"
                            maxLength={80}
                            value={form.source.voyageNumber}
                            onChange={event => sourceUpdate('voyageNumber', event.target.value)}
                            placeholder="Số hiệu chuyến tàu"
                          />
                        </Field>

                        <Field label={<>Hạn eDO <b className="epd-required">*</b></>}>
                          <input
                            aria-label="Hạn eDO"
                            type="date"
                            value={form.source.validUntil}
                            onChange={event => sourceUpdate('validUntil', event.target.value)}
                          />
                        </Field>
                      </div>

                      {form.source.referenceNumber && (
                        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <strong>Nơi trả rỗng quy định:</strong> {form.source.emptyReturnDepot || 'Depot Tân Cảng - Hải Phòng'}
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
                      )}
                    </div>
                  ) : (
                    <div className="epd-source-box">
                      <div className="epd-section-label">
                        <FileText size={17} />
                        <h4>Khai báo eBooking xuất khẩu</h4>
                        <span className="epd-status emerald">eBooking đã liên kết</span>
                      </div>
                      <div className="epd-form-grid">
                        <div className="epd-wide">
                          <BookingSourceSelect
                            items={sources.data?.items || []}
                            value={form.source.bookingId}
                            selected={selectedBooking}
                            search={sourceSearch}
                            onSearch={setSourceSearch}
                            onChange={chooseSource}
                            loading={sources.isFetching || sourceSearch !== sourceTerm}
                            error={sources.isError ? draftError(sources.error) : null}
                            onRetry={() => liveSources.refetch()}
                          />
                        </div>

                        <Field label="Số vận đơn (Bill / B/L)" wide>
                          <input
                            aria-label="Số vận đơn xuất"
                            maxLength={100}
                            value={form.source.blNumber || ''}
                            onChange={event => sourceUpdate('blNumber', event.target.value)}
                            placeholder="Nhập số vận đơn đường biển (VD: BL-VNCMT-7721)"
                          />
                        </Field>
                      </div>

                      {selectedBooking && (
                        <div style={{ marginTop: '14px', padding: '12px 16px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '12px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#166534', marginBottom: '2px' }}>
                              ✓ Tự động đối chiếu thông tin Booking {selectedBooking.bookingNumber}
                            </div>
                            <div style={{ color: '#374151' }}>
                              Tàu: <strong>{selectedBooking.vesselName || form.source.vesselName || 'Tàu xuất'}</strong> · Chuyến: <strong>{selectedBooking.voyageNumber || form.source.voyageNumber}</strong> · Cảng dỡ: <strong>{selectedBooking.portOfDischarge || selectedBooking.destinationPort || 'VNHPH'}</strong>
                            </div>
                            <div style={{ color: '#4b5563', marginTop: '2px' }}>
                              Hạn CY Cut-off: <strong>{selectedBooking.cyCutoff ? new Date(selectedBooking.cyCutoff).toLocaleString('vi-VN') : 'Đang cập nhật'}</strong>
                            </div>
                          </div>
                          <span className="epd-status emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={13} /> Trước CY Cut-off · Hợp lệ
                          </span>
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
                    <>
                      <div className="epd-container-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <label className="epd-search">
                          <Search size={16} />
                          <input
                            aria-label="Tìm container"
                            placeholder="Tìm theo số container…"
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                          />
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            type="button"
                            className="epc-button secondary"
                            onClick={() => selectAllEligibleContainers(eligibleContainers)}
                            style={{ fontSize: '13px', padding: '6px 12px' }}
                          >
                            <Check size={14} /> Chọn tất cả container đủ điều kiện ({eligibleContainers.filter(c => !getContainerLockReason(c, 'IMPORT')).length})
                          </button>
                          <span>{form.lines.length} container đã chọn</span>
                        </div>
                      </div>

                      {containers.isPending ? (
                        <Loading>Đang tải container…</Loading>
                      ) : containers.isError ? (
                        <div className="epc-error" role="alert">
                          {draftError(containers.error)}
                          <button type="button" className="epc-text-button" onClick={() => containers.refetch()}>Thử lại</button>
                        </div>
                      ) : !eligibleContainers.length ? (
                        <div className="epd-empty">
                          <Container size={30} />
                          <h3>Chưa có container phù hợp</h3>
                          <p>Kiểm tra lệnh DO/eDO và quyền nhận hàng của doanh nghiệp.</p>
                        </div>
                      ) : (
                        <div className="epd-container-grid">
                          {eligibleContainers.map(row => {
                            const isSelected = form.lines.some(line => line.sourceContainerId === containerId(row))
                            const currentLine = form.lines.find(line => line.sourceContainerId === containerId(row))
                            const lockReason = getContainerLockReason(row, 'IMPORT')
                            const isLocked = Boolean(lockReason)

                            return (
                              <div
                                key={containerId(row)}
                                className={`epd-container-choice ${isSelected ? 'selected' : ''}`}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px',
                                  cursor: isLocked ? 'not-allowed' : 'default',
                                  opacity: isLocked ? 0.65 : 1,
                                  background: isLocked ? '#f8fafc' : undefined,
                                  borderColor: isLocked ? '#e2e8f0' : undefined,
                                }}
                              >
                                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: isLocked ? 'not-allowed' : 'pointer', width: '100%' }}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isLocked}
                                    onChange={() => !isLocked && chooseContainer(row)}
                                    aria-label={`Chọn container ${row.containerNumber}`}
                                  />
                                  <span className="epd-container-icon"><Container size={22} /></span>
                                  <span className="epd-container-copy">
                                    <strong>{row.containerNumber}</strong>
                                    <small>{row.typeCode} · Hàng nhập</small>
                                  </span>
                                  {!isLocked && <span className="epd-container-check"><Check size={14} /></span>}
                                </label>

                                {isLocked ? (
                                  <div style={{ marginTop: '4px', fontSize: '11px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertCircle size={13} /> {lockReason}
                                  </div>
                                ) : (
                                  isSelected && (
                                    <label
                                      className="epd-checkbox-inline"
                                      style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontSize: '11px' }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={!!currentLine?.customsSealRequired}
                                        onChange={e =>
                                          changeLine(containerId(row), l => ({
                                            ...l,
                                            customsSealRequired: e.target.checked,
                                          }))
                                        }
                                      />
                                      <span>Hàng phải niêm phong hải quan</span>
                                    </label>
                                  )
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    // HẠ HÀNG XUẤT: Form khai báo từng dòng container
                    <div className="epd-export-container-section">
                      {containers.isFetching && <Loading>Đang đối chiếu container của Booking xuất…</Loading>}
                      {containers.isError && <div className="epc-error" role="alert">{draftError(containers.error)}<button type="button" className="epc-text-button" onClick={() => containers.refetch()}>Thử lại</button></div>}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#193247' }}>
                          Tổng cộng: <strong>{form.lines.length}</strong> container khai báo
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="epc-button secondary"
                            disabled={containers.isFetching || !eligibleContainers.length}
                            onClick={() => selectAllEligibleContainers(eligibleContainers)}
                            style={{ fontSize: '13px', padding: '7px 12px' }}
                          >
                            <Check size={14} /> Chọn tất cả cont hợp lệ ({eligibleContainers.filter(c => !getContainerLockReason(c, 'EXPORT')).length})
                          </button>
                          <select
                            aria-label="Container xuất theo Booking"
                            value={manualContainer}
                            disabled={containers.isFetching || !eligibleContainers.length}
                            onChange={event => setManualContainer(event.target.value)}
                            style={{ minWidth: 0, maxWidth: '100%', flex: '1 1 200px' }}
                          >
                            <option value="">Chọn container xuất hợp lệ…</option>
                            {eligibleContainers
                              .filter(row => !form.lines.some(line => line.sourceContainerId === containerId(row)))
                              .map(row => {
                                const lock = getContainerLockReason(row, 'EXPORT')
                                return (
                                  <option key={containerId(row)} value={containerId(row)} disabled={Boolean(lock)}>
                                    {row.containerNumber} · {row.typeCode} {lock ? `(${lock})` : ''}
                                  </option>
                                )
                              })}
                          </select>
                          <button
                            type="button"
                            className="epc-button primary"
                            disabled={!manualContainer || containers.isFetching}
                            onClick={addExportContainerRow}
                            style={{ padding: '8px 16px', fontSize: '13px' }}
                          >
                            <Plus size={16} />
                            <span>Thêm dòng</span>
                          </button>
                        </div>
                      </div>

                      {!form.lines.length ? (
                        <div className="epd-empty" style={{ padding: '36px' }}>
                          <Container size={36} />
                          <h3>Chưa có dòng container nào</h3>
                          <p>Bấm “Chọn tất cả cont hợp lệ” để nạp tự động toàn bộ container của Booking, hoặc chọn từng container trong danh sách Booking phía trên rồi bấm “Thêm dòng”.</p>
                          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="epc-button secondary"
                              disabled={containers.isFetching || !eligibleContainers.length}
                              onClick={() => selectAllEligibleContainers(eligibleContainers)}
                            >
                              <Check size={16} /> Tự động chọn tất cả cont đủ điều kiện
                            </button>
                            <button type="button" className="epc-button primary" disabled={!manualContainer || containers.isFetching} onClick={addExportContainerRow}>
                              <Plus size={16} />Thêm dòng container
                            </button>
                          </div>
                        </div>
                      ) : (
                        (containerScopeMatches && !containers.isError ? form.lines : []).map((line, idx) => (
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
                        ))
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
                    <Field label={<>Thời gian dự kiến thực hiện <b className="epd-required">*</b></>} wide>
                      <input
                        aria-label="Thời gian dự kiến thực hiện"
                        type="datetime-local"
                        value={form.plannedAt}
                        onChange={event => update('plannedAt', event.target.value)}
                      />
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
                        placeholder="Số điện thoại di động"
                      />
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

              {/* BƯỚC 4: ĐỐI CHIẾU THÔNG QUAN */}
              {step === 3 && (
                <CustomsStep
                  key={customsScope}
                  flow={form.flow}
                  draftId={id}
                  payload={payload()}
                  confirmed={!!form.delivery.customsConfirmationScope}
                  onConfirmed={scope => mutate(previous => JSON.stringify([JSON.stringify([previous.flow, previous.mainServiceId, previous.source]), previous.lines.map(line => line.sourceContainerId).sort()]) !== customsScope ? previous : ({ ...previous, delivery: { ...previous.delivery, customsConfirmationScope: scope, customsCheckSkipped: false } }))}
                  sampleMode={sampleMode}
                />
              )}

              {/* BƯỚC GIAO NHẬN: XE HOẶC SÀ LAN, HẠN LỆNH */}
              {step === deliveryStep && (
                <DeliveryFields
                  delivery={form.delivery}
                  buyer={form.invoiceBuyer}
                  flow={form.flow}
                  sourceExpiry={form.flow === 'IMPORT' ? form.source.validUntil : (selectedBooking?.cyCutoff ? selectedBooking.cyCutoff.slice(0, 10) : form.source.validUntil)}
                  request={payload()}
                  containers={snapshots}
                  sampleMode={sampleMode}
                  onDelivery={(field, value) => update('delivery', { ...form.delivery, [field]: value })}
                  onBuyer={(field, value) => update('invoiceBuyer', { ...form.invoiceBuyer, [field]: value })}
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
                      <SummaryItem label="Người mua">{form.invoiceBuyer.name || 'Theo tài khoản'}</SummaryItem>
                      <SummaryItem label="Cổng thanh toán">Duy nhất PayOS (QR Code chuyển khoản ngân hàng 24/7)</SummaryItem>
                    </dl>
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

            {/* CỘT TÓM TẮT BÊN PHẢI */}
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
                <SummaryItem label="Thanh toán">PayOS</SummaryItem>
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
