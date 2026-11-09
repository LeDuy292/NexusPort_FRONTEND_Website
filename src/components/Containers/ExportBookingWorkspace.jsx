import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, ArrowUpRight, Calendar, Check, ChevronDown, ChevronRight, Clock, Copy, FileText, FolderOpen, Package, Search, Ship, Truck, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import exportBookingService from '../../services/exportBookingService'
import { bookingService } from '../../services/bookingService'
import ContainerBookingForm from './ContainerBookingForm'
import BookingBatchWorkspace from './BookingBatchWorkspace'
import BookingRequestComposer from './BookingRequestComposer'
import ExportPreparationForm from './ExportPreparationForm'

const input = 'w-full rounded-xl border border-chalk bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-500 disabled:bg-slate-50 disabled:text-slate-500'
const primary = 'rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50'
const secondary = 'rounded-xl border border-chalk bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const statusLabels = { Pending: 'Chờ hãng tàu duyệt', Approved: 'Đã duyệt đặt chỗ', ContainersDeclared: 'Đã khai container', GateIn: 'Đã có container vào cảng', Loaded: 'Đã xếp tàu', BlIssued: 'Đã phát hành B/L', Rejected: 'Hãng tàu từ chối', Cancelled: 'Đã hủy' }
const containerLabels = { Expected: 'Dự kiến', Declared: 'Đã khai', GateIn: 'Đã qua cổng', Loaded: 'Đã xếp tàu', Excluded: 'Bị loại khỏi chuyến', Rolled: 'Chuyển chuyến', Cancelled: 'Đã hủy' }
const siLabels = { None: 'Chưa nộp', Submitted: 'Đã nộp SI', Draft: 'Có draft B/L cần xác nhận', Confirmed: 'Đã xác nhận draft B/L', RevisionRequested: 'Hãng tàu yêu cầu sửa/nộp SI' }
const portLabels = { Pending: 'Chờ hãng tàu duyệt hồ sơ', WaitingContainers: 'Chờ bổ sung container', WaitingContainerReview: 'Hãng tàu kiểm tra danh sách', ContainerRevisionRequested: 'Cần sửa danh sách container', Accepted: 'Cảng đã nhận hồ sơ', Cancelled: 'Đã hủy' }
const cargoLabels = { general: 'Hàng bách hóa', reefer: 'Hàng lạnh', dangerous: 'Hàng nguy hiểm', dangerous_goods: 'Hàng nguy hiểm', oversized: 'Hàng quá khổ', perishable: 'Hàng dễ hư hỏng', overweight: 'Hàng quá tải' }
const time = value => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa có'
const expired = value => Boolean(value && new Date(value).getTime() <= Date.now())
const lockedContainer = row => ['GateIn', 'Loaded', 'Excluded', 'Rolled'].includes(row.status)
const errorText = error => {
  const data = error.response?.data
  const errors = data?.errors || data?.Errors
  return errors ? Object.values(errors).flat().join(' ') : data?.message || data?.Message || error.message || 'Không thể xử lý yêu cầu.'
}
const sourceKey = row => `${row.containerId}:${row.declarationId}`
const declaredRow = row => ({ containerId: row.containerId, declarationId: row.declarationId, sealNumber: (row.sealNumber || '').trim(), vgmKg: Number(row.vgmKg), targetTemperature: row.targetTemperature === '' || row.targetTemperature == null ? null : Number(row.targetTemperature), unNumber: row.unNumber || null, dgClass: row.dgClass || null, customsDocumentUrl: row.customsDocumentUrl || null })
const emptyOptions = { shippingLines: [], voyages: [], sources: [], containerTypes: [], companyName: '' }
const statusTones = {
  Pending: 'border-amber-200 bg-amber-50 text-amber-800', Draft: 'border-amber-200 bg-amber-50 text-amber-800',
  Approved: 'border-sky-200 bg-sky-50 text-sky-800', Submitted: 'border-sky-200 bg-sky-50 text-sky-800', GateIn: 'border-sky-200 bg-sky-50 text-sky-800',
  ContainersDeclared: 'border-teal-200 bg-teal-50 text-teal-800', Accepted: 'border-teal-200 bg-teal-50 text-teal-800',
  Loaded: 'border-indigo-200 bg-indigo-50 text-indigo-800', BlIssued: 'border-emerald-200 bg-emerald-50 text-emerald-800', Confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Rejected: 'border-rose-200 bg-rose-50 text-rose-800', RevisionRequested: 'border-rose-200 bg-rose-50 text-rose-800',
}
const documentNames = { CarrierBookingReference: 'Booking Note', VgmCertificate: 'Xác nhận khối lượng VGM', CustomsDeclaration: 'Tờ khai hải quan', BillOfLading: 'Vận đơn B/L', DeliveryOrder: 'Lệnh giao hàng D/O', ReeferTemperatureInstructions: 'Chỉ dẫn bảo quản hàng lạnh', DangerousGoodsDeclaration: 'Khai báo hàng nguy hiểm' }
const equipment = code => code === 'MIXED' ? 'Nhiều kích cỡ' : code || 'Chưa có loại container'
const attachmentUrl = url => typeof url === 'string' && /^(https?:\/\/|\/uploads\/documents\/)/i.test(url) ? url : null

function Field({ label, children }) {
  return <label className="block space-y-1.5 text-sm"><span className="font-semibold text-slate-700">{label}</span>{children}</label>
}
function Status({ value, labels = statusLabels }) {
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-relaxed ${statusTones[value] || 'border-slate-200 bg-slate-50 text-slate-600'}`}><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />{labels[value] || value || 'Chưa có'}</span>
}
function DetailValue({ label, children }) {
  return <div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-slate-800">{children == null || children === '' ? 'Chưa khai' : children}</dd></div>
}
function BookingProgress({ booking }) {
  const approved = ['Approved', 'ContainersDeclared', 'GateIn', 'Loaded', 'BlIssued'].includes(booking.status)
  const steps = [
    ['Đã gửi hồ sơ', true], ['Hãng tàu duyệt', approved],
    ['Chuyển cảng', approved && booking.portStatus === 'Accepted'], ['Phát hành B/L', booking.status === 'BlIssued'],
  ]
  const current = steps.findIndex(([, complete]) => !complete), stopped = ['Rejected', 'Cancelled'].includes(booking.status)
  return <ol aria-label="Tiến độ hồ sơ" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{steps.map(([label, complete], index) => <li key={label} aria-current={!stopped && current === index ? 'step' : undefined} className={`flex min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs ${complete ? 'bg-teal-50 text-teal-800' : !stopped && current === index ? 'bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-200' : 'bg-slate-50 text-slate-400'}`}>
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${complete ? 'bg-teal-600 text-white' : 'border border-current'}`}>{complete ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : index + 1}</span><span className="font-semibold">{label}</span>
  </li>)}</ol>
}
function bookingMessage(booking) {
  if (booking.status === 'Cancelled') return ['Hồ sơ đã hủy', 'Bạn có thể xem lại thông tin và lịch sử xử lý của hồ sơ này.']
  if (booking.status === 'Rejected') return ['Hãng tàu đã trả hồ sơ', [...(booking.history || [])].reverse().find(event => event.event === 'BookingRejected')?.description || 'Xem lý do trong Lịch sử, chỉnh sửa hồ sơ rồi gửi lại hãng tàu.']
  if (booking.status === 'Pending') return ['Đang chờ hãng tàu duyệt', booking.submission ? 'Container, chứng từ và lịch xe đề xuất đã được gửi. Bạn có thể chỉnh sửa hồ sơ trong khi chờ duyệt.' : 'Hãng tàu kiểm tra yêu cầu đặt chỗ trước khi tiếp nhận danh sách container.']
  if (booking.status === 'BlIssued') return ['Đã phát hành vận đơn', booking.blNumber ? `Số B/L: ${booking.blNumber}` : 'Hãng tàu đã phát hành B/L cho hồ sơ này.']
  if (booking.siStatus === 'Draft') return ['Draft B/L cần xác nhận', 'Mở mục SI & draft B/L để kiểm tra bản nháp và xác nhận thông tin.']
  if (booking.status === 'Loaded') return ['Đã ghi nhận xếp tàu', 'Theo dõi bước phát hành B/L và các yêu cầu bổ sung từ hãng tàu.']
  if (booking.status === 'GateIn') return ['Đã có container vào cảng', 'Mở từng container để theo dõi lịch xe và trạng thái tiếp nhận.']
  if (booking.portStatus === 'WaitingContainerReview') return ['Hãng tàu đang kiểm tra danh sách container', 'Phiên bản container, VGM và chứng từ đã gửi. Sau khi hãng tàu chấp nhận và chuyển cảng, bạn có thể đặt lịch xe.']
  if (booking.portStatus === 'ContainerRevisionRequested') return ['Danh sách container cần bổ sung', [...(booking.history || [])].reverse().find(event => event.event === 'ContainerRevisionRequested')?.description || 'Mở hồ sơ container để chỉnh sửa và gửi lại hãng tàu.']
  if (booking.portStatus === 'Accepted') return ['Hồ sơ đã chuyển sang cảng', 'Theo dõi kết quả xử lý lịch xe và tiếp nhận container của cảng.']
  return ['Đã duyệt đặt chỗ', 'Bổ sung danh sách container và hồ sơ để tiếp tục chuyển sang cảng.']
}
function evidenceGroups(booking) {
  if (!booking) return []
  const groups = [], submission = booking.submission || booking.preparation
  if (submission?.sharedDocuments?.length) groups.push({ key: 'shared', title: 'Chứng từ dùng chung', documents: submission.sharedDocuments })
  for (const container of booking.preparation?.containers || booking.containers || []) {
    const trip = (submission?.trips || submission?.containers)?.find(row => row.containerId === container.containerId)
    const documents = [...(trip?.documents || [])]
    const sharedCustoms = submission?.sharedDocuments?.some(doc => doc.documentType === 'CustomsDeclaration')
    if (container.customsDocumentUrl && !sharedCustoms && !documents.some(doc => doc.documentType === 'CustomsDeclaration')) documents.push({ documentType: 'CustomsDeclaration', fileUrl: container.customsDocumentUrl })
    if (documents.length) groups.push({ key: container.containerId, title: container.containerNumber, documents })
  }
  if (submission?.pickup?.documents?.length) groups.push({ key: 'pickup', title: `Container Nhận · ${submission.pickupSource?.containerNumber || 'Theo hồ sơ'}`, documents: submission.pickup.documents })
  return groups
}
function EvidenceList({ groups }) {
  if (!groups.length) return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center"><FileText aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="text-sm font-semibold text-slate-700">Chưa có chứng từ đính kèm</p><p className="mt-1 text-xs text-slate-500">Các tệp của hồ sơ sẽ hiển thị tại đây.</p></div>
  return <div className="space-y-4">{groups.map(group => <section key={group.key} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <h4 className="mb-3 flex items-center gap-2 text-sm font-bold"><FolderOpen aria-hidden="true" className="h-4 w-4 text-orange-600" />{group.title}<span className="font-normal text-slate-500">· {group.documents.length} chứng từ</span></h4>
    <div className="grid gap-2 xl:grid-cols-2">{group.documents.map((doc, index) => <div key={`${doc.documentType}:${index}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500"><FileText aria-hidden="true" className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-700">{documentNames[doc.documentType] || doc.documentType}</p><p className="mt-0.5 truncate text-xs text-slate-500" title={doc.fileName || undefined}>{doc.fileName || 'Tệp đính kèm'}</p>{doc.containerNumbers?.length > 0 && <p className="mt-1 text-[11px] text-slate-500">Phạm vi đã khai: {doc.containerNumbers.length} container</p>}</div>
      {attachmentUrl(doc.fileUrl) ? <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" aria-label={`Mở ${documentNames[doc.documentType] || doc.documentType}${doc.fileName ? ` · ${doc.fileName}` : ''}`} className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-2 text-xs font-bold text-teal-700 ring-1 ring-inset ring-slate-200 hover:bg-teal-50">Mở<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></a> : <span className="text-xs text-slate-400">Chưa có tệp</span>}
    </div>)}</div>
  </section>)}</div>
}
function SiPreview({ value }) {
  if (!value) return null
  return <dl className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
    <DetailValue label="Người gửi hàng (Shipper)">{value.shipper}</DetailValue>
    <DetailValue label="Người nhận hàng (Consignee)">{value.consignee}</DetailValue>
    <DetailValue label="Bên được thông báo (Notify party)">{value.notifyParty}</DetailValue>
    <DetailValue label="Cảng đến">{value.destinationPort}</DetailValue>
    <DetailValue label="Mô tả hàng">{value.cargoDescription}</DetailValue>
    <DetailValue label="Số kiện">{value.packagesCount?.toLocaleString('vi-VN')}</DetailValue>
    <DetailValue label="Tổng khối lượng hàng (kg)">{value.grossWeightKg?.toLocaleString('vi-VN')}</DetailValue>
    <DetailValue label="Điều khoản cước / phát hành B/L">{`${value.freightTerms === 'Collect' ? 'Trả sau' : 'Trả trước'} · ${value.blType === 'TelexRelease' ? 'Telex release' : 'Bản gốc'}`}</DetailValue>
  </dl>
}

export default function ExportBookingWorkspace({ initialBookingId, initialSource, initialDirection, createRequest, onGateSaved }) {
  const [options, setOptions] = useState(emptyOptions)
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedContainers, setExpandedContainers] = useState(() => new Set())
  const [copiedId, setCopiedId] = useState('')
  const panelId = useId()
  const [selectedId, setSelectedId] = useState(initialBookingId || '')
  const [detail, setDetail] = useState(null)
  const [section, setSection] = useState('containers')
  const [loading, setLoading] = useState(true)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsError, setOptionsError] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showCreate, setShowCreate] = useState(!initialBookingId)
  const [direction, setDirection] = useState(initialDirection === 'Pickup' ? 'Pickup' : 'Dropoff')
  const [pickupBatch, setPickupBatch] = useState(false)
  const [combined, setCombined] = useState(false)
  const [editing, setEditing] = useState(null)
  const [drafts, setDrafts] = useState([])
  const [showDrafts, setShowDrafts] = useState(false)
  const [activeDraft, setActiveDraft] = useState(null)
  const [preparationIntent, setPreparationIntent] = useState('request')
  const [siSuggestions, setSiSuggestions] = useState(null)
  const [rows, setRows] = useState([])
  const [sourceId, setSourceId] = useState('')
  const [si, setSi] = useState({})
  const [draftConfirmed, setDraftConfirmed] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')
  const [gateContext, setGateContext] = useState(null)
  const [uploadingKey, setUploadingKey] = useState('')
  const alive = useRef(true)
  const listRequest = useRef(0)
  const detailRequest = useRef(0)
  const optionsRequest = useRef(0)
  const mutationLock = useRef(false)
  const detailPanel = useRef(null)

  useEffect(() => {
    const pending = [detailRequest, listRequest, optionsRequest]
    alive.current = true
    return () => { alive.current = false; pending.forEach(request => request.current++) }
  }, [])
  useEffect(() => { if (initialBookingId) { setSelectedId(initialBookingId); setShowCreate(false) } }, [initialBookingId])
  useEffect(() => {
    if (search.trim() === searchTerm) return
    const timer = setTimeout(() => { setSearchTerm(search.trim()); setPage(1); setSelectedId('') }, 300)
    return () => clearTimeout(timer)
  }, [search, searchTerm])

  const reloadOptions = useCallback(async () => {
    const request = ++optionsRequest.current
    setOptionsLoading(true)
    try {
      const result = await exportBookingService.getOptions()
      if (alive.current && request === optionsRequest.current) {
        setOptions({ ...emptyOptions, ...result }); setOptionsError(false)
      }
    } catch (error) {
      if (alive.current && request === optionsRequest.current) {
        setOptions(current => ({ ...current, sources: [] }))
        setOptionsError(true)
        throw error
      }
    } finally {
      if (alive.current && request === optionsRequest.current) setOptionsLoading(false)
    }
  }, [])
  const openCreate = useCallback(() => {
    setShowCreate(true); setSelectedId(''); setEditing(null); setActiveDraft(null); setPreparationIntent('request'); setNotice(''); setError(''); setSection('containers')
    reloadOptions().catch(err => { if (alive.current) setError(errorText(err)) })
  }, [reloadOptions])
  useEffect(() => { if (createRequest) openCreate() }, [createRequest, openCreate])
  const reloadList = useCallback(async () => {
    const request = ++listRequest.current
    const result = await exportBookingService.getBookings({ page, pageSize: 10, search: searchTerm || undefined, status: statusFilter || undefined })
    if (alive.current && request === listRequest.current) { setItems(result.items || []); setTotal(result.totalCount || 0) }
  }, [page, searchTerm, statusFilter])
  const applyDetail = value => {
    setDetail(value)
    setRows((value.containers || []).map(row => ({ ...row, vgmKg: row.vgmKg ?? '', targetTemperature: row.targetTemperature ?? '', customsDocumentUrl: row.customsDocumentUrl || '' })))
    setSi(value.si ? { ...value.si } : { shipper: '', consignee: '', notifyParty: '', cargoDescription: value.commodityDescription || '', packagesCount: '', grossWeightKg: '', freightTerms: 'Prepaid', blType: 'Original', destinationPort: value.voyage?.portOfDischarge || '' })
    setSiSuggestions(null)
    setSourceId(''); setDraftConfirmed(false); setCancellationReason('')
  }
  const reloadDetail = useCallback(async id => {
    const request = ++detailRequest.current
    setDetailLoading(true)
    try {
      const result = await exportBookingService.getBooking(id)
      if (alive.current && request === detailRequest.current) applyDetail(result)
    } catch (error) {
      if (alive.current && request === detailRequest.current) throw error
    } finally { if (alive.current && request === detailRequest.current) setDetailLoading(false) }
  }, [])

  useEffect(() => {
    setLoading(true); setError('')
    Promise.all([reloadOptions(), reloadList()]).catch(err => { if (alive.current) setError(errorText(err)) })
      .finally(() => { if (alive.current) setLoading(false) })
  }, [reloadOptions, reloadList])
  useEffect(() => {
    setDetail(null); setGateContext(null); setError(''); setNotice(''); setExpandedContainers(new Set())
    if (selectedId) reloadDetail(selectedId).catch(err => { if (alive.current) setError(errorText(err)) })
    else detailRequest.current++
  }, [selectedId, reloadDetail])
  const reloadDrafts = useCallback(async () => {
    const result = await exportBookingService.getDrafts()
    if (alive.current) setDrafts(result.items || [])
  }, [])
  useEffect(() => { if (options.capabilities?.serverDrafts) reloadDrafts().catch(cause => { if (alive.current) setError(errorText(cause)) }) }, [options.capabilities?.serverDrafts, reloadDrafts])
  const resumeDraft = async id => {
    setBusy(true); setError('')
    try {
      const value = await exportBookingService.getDraft(id)
      const linkedId=value.submittedBookingId || value.content?.bookingId
      const booking = linkedId ? await exportBookingService.getBooking(linkedId) : null
      if (!alive.current) return
      if(value.submittedBookingId) { applyDetail(booking); setSelectedId(booking.id); setEditing(null); setActiveDraft(null); setShowCreate(false); setShowDrafts(false); setNotice('Nháp này đã được gửi. Đã mở hồ sơ được lưu trên hệ thống.'); return }
      setActiveDraft(value); setEditing(booking); setPreparationIntent(booking && !['Pending','Rejected'].includes(booking.status) ? 'containers' : 'request')
      setShowCreate(true); setCombined(false); setDirection('Dropoff'); setShowDrafts(false)
      await reloadOptions()
    } catch (cause) { if (alive.current) setError(errorText(cause)) }
    finally { if (alive.current) setBusy(false) }
  }
  const preparedSubmitted = async saved => {
    optionsRequest.current++
    const submitted = new Set([...(saved.containers || []), ...(saved.preparation?.containers || []), ...(saved.submission?.trips || [])].map(row => row.containerId))
    setOptions(current => ({ ...current, sources: current.sources.filter(source => !submitted.has(source.containerId)) }))
    applyDetail(saved); setSelectedId(saved.id); setShowCreate(false); setEditing(null); setActiveDraft(null)
    setNotice(saved.portStatus === 'WaitingContainerReview' ? 'Đã gửi danh sách container để hãng tàu kiểm tra trước khi chuyển cảng.' : 'Đã gửi yêu cầu đặt chỗ cho hãng tàu. Bạn có thể bổ sung hồ sơ sau khi được duyệt.')
    await Promise.all([reloadList(), reloadOptions(), ...(options.capabilities?.serverDrafts ? [reloadDrafts()] : [])]).catch(cause => setError(`Hồ sơ đã gửi. Chưa tải lại được danh sách: ${errorText(cause)}`))
  }
  const openPreparation = intent => {
    setActiveDraft(null); setEditing(detail); setPreparationIntent(intent); setCombined(false); setShowCreate(true)
    reloadOptions().catch(cause => setError(errorText(cause)))
  }

  const mutate = async (operation, success) => {
    if (mutationLock.current) return
    mutationLock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const result = await operation()
      if (!alive.current) return
      if (result?.id) { applyDetail(result); setSelectedId(result.id); setShowCreate(false) }
      if (alive.current) setNotice(success)
      await Promise.all([reloadList(), reloadOptions()]).catch(err => {
        if (alive.current) setError(`Thao tác đã được lưu. Chưa tải lại được danh sách: ${errorText(err)}`)
      })
    } catch (err) {
      if (alive.current) {
        setError(errorText(err))
        if ([409, 412].includes(err.response?.status) && selectedId) await reloadDetail(selectedId).catch(() => {})
      }
    } finally { mutationLock.current = false; if (alive.current) setBusy(false) }
  }
  const patchRow = (key, patch) => setRows(current => current.map(row => sourceKey(row) === key ? { ...row, ...patch } : row))
  const addSource = () => {
    const source = options.sources.find(row => sourceKey(row) === sourceId)
    if (!source || rows.some(row => row.containerId === source.containerId)) return
    setRows(current => [...current, { ...source, vgmKg: '', targetTemperature: '', unNumber: '', dgClass: '', customsDocumentUrl: '', status: 'Expected' }]); setSourceId('')
  }
  const uploadCustoms = async (row, event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploadingKey) return
    const key = sourceKey(row)
    setUploadingKey(key); setError('')
    try {
      const uploaded = await bookingService.uploadDocumentFile(file)
      const url = uploaded.fileUrl || uploaded.url
      if (!url) throw new Error('Máy chủ chưa trả đường dẫn tệp hải quan.')
      if (alive.current) patchRow(key, { customsDocumentUrl: url, customsFileName: uploaded.fileName || file.name })
    } catch (err) { if (alive.current) setError(errorText(err)) }
    finally { if (alive.current) setUploadingKey('') }
  }
  const saveContainers = event => {
    event.preventDefault()
    mutate(() => exportBookingService.declareContainers(detail.id, { expectedVersion: detail.version, containers: rows.map(declaredRow) }), 'Đã lưu danh sách container và kết quả tiếp nhận của cảng.')
  }
  const submitSi = event => {
    event.preventDefault()
    mutate(() => exportBookingService.submitSi(detail.id, { ...si, expectedVersion: detail.version, packagesCount: Number(si.packagesCount), grossWeightKg: Number(si.grossWeightKg) }), 'Đã gửi Shipping Instruction đến hãng tàu.')
  }
  const gateSaved = async result => {
    onGateSaved?.(result)
    await Promise.all([reloadList(), reloadOptions(), ...(selectedId ? [reloadDetail(selectedId)] : [])]).catch(err => { if (alive.current) setError(errorText(err)) })
  }
  const clearFilters = () => { setSearch(''); setSearchTerm(''); setStatusFilter(''); setPage(1); setSelectedId('') }
  const copyBookingNumber = async () => {
    try { await navigator.clipboard.writeText(detail.bookingNumber); setCopiedId(detail.id) }
    catch { setError('Không thể sao chép tự động. Bạn có thể chọn và sao chép mã Booking trực tiếp.') }
  }
  const selectBooking = id => {
    setSelectedId(id); setShowCreate(false); setSection('containers')
    if (window.matchMedia('(max-width: 1023px)').matches) requestAnimationFrame(() => detailPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  if (gateContext) return <div className="space-y-4">
    <button type="button" className={secondary} onClick={() => setGateContext(null)}>← Về Booking hãng tàu {gateContext.booking.bookingNumber}</button>
    {gateContext.batch
      ? <BookingBatchWorkspace key={gateContext.booking.id} exportContext={gateContext} onSaved={gateSaved} />
      : <ContainerBookingForm key={`${gateContext.booking.id}:${gateContext.container.id}`} exportContext={gateContext} onSaved={gateSaved} onClose={() => setGateContext(null)} />}
  </div>

  const voyage = detail?.voyage
  const availableSources = options.sources.filter(source => source.containerTypeCode === detail?.containerTypeCode && !rows.some(row => row.containerId === source.containerId))
  const editableContainers = detail && !detail.submission && !detail.preparation && ['Approved', 'ContainersDeclared', 'GateIn'].includes(detail.status) && detail.siStatus !== 'Confirmed' && !expired(voyage?.vgmCutoff) && !expired(voyage?.cyCutoff)
  const canPrepareContainers = detail?.preparation && ['Approved', 'ContainersDeclared'].includes(detail.status) && !detail.containers?.some(row => row.hasGateHistory) && detail.siStatus !== 'Confirmed' && !expired(voyage?.vgmCutoff) && !expired(voyage?.cyCutoff)
  const editableSi = detail && ['Approved', 'ContainersDeclared', 'GateIn', 'Loaded'].includes(detail.status) && detail.siStatus !== 'Confirmed' && (!expired(voyage?.siCutoff) || detail.siStatus === 'RevisionRequested')
  const canCancel = detail && !['Cancelled', 'Rejected', 'Loaded', 'BlIssued', 'GateIn'].includes(detail.status) && !detail.containers?.some(lockedContainer)
  const containersDirty = detail && JSON.stringify(rows.map(declaredRow)) !== JSON.stringify((detail.containers || []).map(declaredRow))
  const gateContainers = (detail?.containers || []).filter(row => !lockedContainer(row) && !row.gateBookingId)
  const gateGroupCounts = gateContainers.reduce((counts, row) => ({ ...counts, [row.cargoType]: (counts[row.cargoType] || 0) + 1 }), {})
  const batchAvailable = !detail?.submission && detail?.portStatus === 'Accepted' && !expired(voyage?.cyCutoff) && Object.values(gateGroupCounts).some(count => count >= 2)
  const hasFilters = Boolean(searchTerm || statusFilter)
  const documents = evidenceGroups(detail)
  const documentCount = documents.reduce((count, group) => count + group.documents.length, 0)
  const [messageTitle, messageDescription] = detail ? bookingMessage(detail) : []
  const detailTabs = [['containers', 'Container & lịch xe', Package, rows.length], ['documents', 'Chứng từ', FileText, documentCount], ['si', 'SI & draft B/L', Ship], ['history', 'Lịch sử', Clock]]
  const allContainersExpanded = rows.length > 0 && rows.every(row => expandedContainers.has(sourceKey(row)))
  const pickupModeSelector = <fieldset className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5" disabled={busy}>
    <legend className="px-2 text-sm font-extrabold text-slate-800">Hình thức Booking</legend>
    <div className={`grid grid-cols-1 gap-3 ${direction === 'Pickup' ? 'lg:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {[
        ...(direction === 'Pickup' ? [
          { value: 'single', title: 'Nhận một container', icon: 'local_shipping', description: 'Đặt một lịch hẹn với xe, moóc và tài xế cho một container.' },
          { value: 'batch', title: 'Nhận nhiều container theo lô', icon: 'view_list', description: 'Từ 2–50 container cùng loại hàng và bộ chứng từ. Mỗi container có lịch xe riêng.' },
        ] : [{ value: 'standard', title: 'Giao container riêng / theo lô', icon: 'local_shipping', description: 'Chọn một container để đặt riêng; từ 2 container cùng loại hàng để lập lô.' }]),
        { value: 'combined', title: 'Chuyến xe kết hợp hai chiều', icon: 'sync_alt', description: 'Một xe giao một container vào bãi rồi nhận một container khác ra cảng trong cùng chuyến.' },
      ].map(mode => {
        const selected = mode.value === (combined ? 'combined' : direction === 'Pickup' ? pickupBatch ? 'batch' : 'single' : 'standard')
        return <label key={mode.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors focus-within:ring-2 focus-within:ring-orange-400 focus-within:ring-offset-2 ${selected ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-300'}`}>
          <span aria-hidden="true" className={`material-symbols-outlined flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{mode.icon}</span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">{mode.title}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{mode.description}</span></span>
          <input type="radio" name="pickup-booking-mode" aria-label={mode.title} className="mt-1 h-4 w-4 shrink-0 accent-orange-600" checked={selected} onChange={() => {
            setCombined(mode.value === 'combined')
            if (mode.value === 'combined') { setDirection('Dropoff'); setShowCreate(true); if (!editing) setSelectedId('') }
            else setPickupBatch(mode.value === 'batch')
          }} />
        </label>
      })}
    </div>
  </fieldset>

  return <section className="space-y-5" aria-label="Booking xuất khẩu với hãng tàu">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-extrabold text-slate-900">{direction === 'Dropoff' && !showCreate ? 'Hồ sơ đã gửi' : 'Booking khách hàng'}</h2><p className="mt-1 text-sm text-slate-500">{direction === 'Dropoff' && !showCreate ? 'Theo dõi phản hồi hãng tàu, container và lịch xe trong từng hồ sơ.' : 'Xin đặt chỗ, hoàn thiện container và đặt lịch xe theo từng bước trong cùng hồ sơ.'}</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" className={secondary} disabled={busy || loading} onClick={() => { setError(''); Promise.all([reloadOptions(), reloadList(), ...(selectedId ? [reloadDetail(selectedId)] : [])]).catch(err => setError(errorText(err))) }}>Làm mới</button>
        <button type="button" className={direction === 'Dropoff' && !showCreate ? 'rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-bold text-orange-800 disabled:opacity-50' : secondary} disabled={busy || loading} onClick={() => { setShowCreate(false); setEditing(null); setCombined(false); setDirection('Dropoff'); if (!selectedId && items.length) setSelectedId(items[0].id) }}>Hồ sơ đã gửi{!hasFilters && ` (${total})`}</button>
        <button type="button" className={primary} disabled={busy || optionsLoading} onClick={openCreate}>Tạo Booking mới</button></div>
    </div>
    {options.capabilities?.serverDrafts && <div className="rounded-2xl border border-slate-200 bg-white"><button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left text-sm font-bold" aria-expanded={showDrafts} disabled={busy} onClick={() => { setShowDrafts(!showDrafts); reloadDrafts().catch(cause => setError(errorText(cause))) }}><span className="flex items-center gap-2"><FileText className="h-4 w-4 text-teal-600" />Nháp của công ty <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{drafts.length}</span></span><ChevronDown className={`h-4 w-4 transition-transform ${showDrafts ? 'rotate-180' : ''}`} /></button>{showDrafts && <div className="grid gap-2 border-t border-slate-100 p-3 sm:grid-cols-2 xl:grid-cols-3">{!drafts.length && <p className="p-2 text-xs text-slate-500">Chưa có nháp đang chuẩn bị. Hồ sơ mới tự lưu sau khi bạn thay đổi thông tin.</p>}{drafts.map(draft => <button type="button" key={draft.id} className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-orange-300 hover:bg-orange-50" disabled={busy} onClick={() => resumeDraft(draft.id)}><p className="truncate text-sm font-semibold">{draft.description || (draft.mode === 'capacity' ? 'Nhu cầu đặt chỗ' : 'Hồ sơ container')}</p><p className="mt-1 text-xs text-slate-500">{draft.containerCount} container · {time(draft.updatedAt)}</p><span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-teal-700">Tiếp tục hoàn thiện<ArrowRight className="h-3 w-3" /></span></button>)}</div>}</div>}
    {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm whitespace-pre-line text-rose-800">{error}</div>}
    {notice && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
    {loading && <p role="status" className="text-sm text-slate-500">Đang tải Booking và lịch chuyến từ database…</p>}
    {direction === 'Dropoff' && showCreate && !loading && !options.voyages.length && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Chưa có lịch chuyến do hãng tàu công bố. Hãng tàu cần tạo chuyến và các hạn CY, VGM, SI trước khi công ty gửi yêu cầu đặt chỗ.</div>}

    {(showCreate || direction === 'Pickup') && <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-chalk bg-white p-4">
      <span className="text-sm font-bold">Nghiệp vụ</span>
      <button type="button" disabled={busy} className={direction === 'Dropoff' ? primary : secondary} onClick={() => { setDirection('Dropoff'); setCombined(false) }}>Giao container xuất khẩu</button>
      <button type="button" disabled={busy} className={direction === 'Pickup' ? primary : secondary} onClick={() => { setDirection('Pickup'); setCombined(false); setEditing(null); setSelectedId(''); setShowCreate(true) }}>Nhận container nhập khẩu</button>
    </div>}
    {direction === 'Pickup' && <div className="space-y-4">
      {pickupBatch ? <BookingBatchWorkspace pickupModeSelector={pickupModeSelector} onExportBooking={() => setDirection('Dropoff')} onSaved={gateSaved} /> : <ContainerBookingForm pickupModeSelector={pickupModeSelector} onExportBooking={() => setDirection('Dropoff')} onSaved={gateSaved} onClose={() => setDirection('Dropoff')} />}
    </div>}
    {direction === 'Dropoff' && showCreate && !loading && options.capabilities?.preparation && !combined && !editing?.submission && <ExportPreparationForm key={activeDraft?.id || `${editing?.id || 'new'}:${editing?.version || 0}:${preparationIntent}:${createRequest || 0}`} options={options} sourcesLoading={optionsLoading} sourcesError={optionsError} initialSource={initialSource} existing={editing} draft={activeDraft} intent={preparationIntent} modeSelector={pickupModeSelector} onBusyChange={setBusy} onDraftSaved={reloadDrafts} onResumeDraft={resumeDraft} onClose={() => { setShowCreate(false); setEditing(null); setActiveDraft(null) }} onSubmitted={preparedSubmitted} />}
    {direction === 'Dropoff' && showCreate && !loading && (!options.capabilities?.preparation || combined || editing?.submission) && <BookingRequestComposer key={editing ? `${editing.id}:${editing.version}:${combined}` : `new:${createRequest || 0}:${combined}`} options={options} sourcesLoading={optionsLoading} sourcesError={optionsError} initialSource={initialSource} existing={editing} onBusyChange={setBusy} combined={combined} modeSelector={pickupModeSelector}
      onClose={() => { setShowCreate(false); setEditing(null) }} onSubmitted={async saved => {
        optionsRequest.current++
        const submitted = new Set((saved.containers || saved.submission?.trips || []).map(row => row.containerId))
        setOptions(current => ({ ...current, sources: current.sources.filter(source => !submitted.has(source.containerId)) }))
        applyDetail(saved); setSelectedId(saved.id); setShowCreate(false); setEditing(null);
        setNotice('Đã gửi hồ sơ Booking cho hãng tàu. Lịch xe đang là đề xuất, chưa được cảng chấp nhận.');
        await Promise.all([reloadList(), reloadOptions()]).catch(cause => setError(`Hồ sơ đã gửi. Chưa tải lại được danh sách: ${errorText(cause)}`));
      }} />}

    {direction === 'Dropoff' && !showCreate && <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside aria-label="Danh sách hồ sơ đã gửi" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-bold"><FolderOpen aria-hidden="true" className="h-4 w-4 text-orange-600" />Danh sách hồ sơ</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{total}</span></div>
          <label className="relative block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="Tìm mã Booking" value={search} disabled={busy} placeholder="Tìm theo mã Booking…" className={`${input} pl-9`} onChange={event => setSearch(event.target.value)} /></label>
          <select aria-label="Lọc trạng thái hồ sơ" value={statusFilter} disabled={busy} className={input} onChange={event => { setStatusFilter(event.target.value); setPage(1); setSelectedId('') }}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          {hasFilters && <div className="flex items-center justify-between gap-2 text-xs"><span className="text-slate-500">{total} hồ sơ phù hợp</span><button type="button" className="flex items-center gap-1 font-semibold text-teal-700" disabled={busy} onClick={clearFilters}><X aria-hidden="true" className="h-3 w-3" />Xóa bộ lọc</button></div>}
        </div>
        <div className="max-h-[34rem] space-y-2 overflow-y-auto p-3" aria-busy={loading}>
          {loading ? <div role="status" className="space-y-2"><span className="sr-only">Đang tải danh sách hồ sơ…</span>{[0, 1, 2].map(index => <div key={index} className="h-32 animate-pulse rounded-xl bg-slate-100" />)}</div> : !items.length ? <div className="px-3 py-8 text-center"><Search aria-hidden="true" className="mx-auto mb-3 h-7 w-7 text-slate-300" /><p className="text-sm font-semibold text-slate-700">{hasFilters ? 'Không tìm thấy hồ sơ' : 'Chưa có hồ sơ đã gửi'}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{hasFilters ? 'Thử mã Booking hoặc trạng thái khác.' : 'Tạo Booking để gửi hồ sơ đầu tiên đến hãng tàu.'}</p></div> : items.map(item => <button type="button" key={item.id} disabled={busy} aria-current={selectedId === item.id ? 'true' : undefined} onClick={() => selectBooking(item.id)} className={`group w-full min-w-0 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-orange-500 ${selectedId === item.id ? 'border-orange-300 bg-orange-50/70 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
            <div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate font-mono text-xs font-bold text-slate-900" title={item.bookingNumber}>{item.bookingNumber}</p><ChevronRight aria-hidden="true" className={`h-4 w-4 shrink-0 ${selectedId === item.id ? 'text-orange-600' : 'text-slate-300'}`} /></div>
            <p className="mt-1 truncate text-xs text-slate-500">{item.shippingLineName}</p>
            <div className="my-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600"><span className="inline-flex items-center gap-1"><Package aria-hidden="true" className="h-3.5 w-3.5" />{item.quantity} container</span><span>{equipment(item.containerTypeCode)}</span></div>
            {item.voyage?.voyageNumber && <p className="mb-2 flex items-center gap-1.5 truncate text-xs text-slate-500"><Ship aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{item.voyage.vesselName} · {item.voyage.voyageNumber}</span></p>}
            <div className="flex flex-wrap items-center justify-between gap-2"><Status value={item.status} />{item.createdAt && <span className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>}</div>
          </button>)}
        </div>
        {total > 10 && <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-3"><button type="button" className={secondary} disabled={busy || loading || page <= 1} onClick={() => setPage(value => value - 1)}>Trước</button><span className="text-xs text-slate-500">{page}/{Math.ceil(total / 10)}</span><button type="button" className={secondary} disabled={busy || loading || page * 10 >= total} onClick={() => setPage(value => value + 1)}>Sau</button></div>}
      </aside>
      <div ref={detailPanel} className="min-w-0 scroll-mt-4 space-y-4">
        {detailLoading && <div role="status" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-500">Đang tải chi tiết Booking…</p><div className="h-28 animate-pulse rounded-xl bg-slate-100" /><div className="h-36 animate-pulse rounded-xl bg-slate-50" /></div>}
        {!detail && !detailLoading && <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center"><FolderOpen aria-hidden="true" className="mx-auto mb-4 h-10 w-10 text-slate-300" /><p className="font-bold text-slate-700">Chọn hồ sơ để xem chi tiết</p><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">Trạng thái hãng tàu, lịch xe và các chứng từ được tập hợp theo từng Booking.</p></div>}
        {detail && !detailLoading && <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:p-5">
              <div className="flex min-w-0 flex-1 items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700"><FileText aria-hidden="true" className="h-5 w-5" /></span><div className="min-w-0"><p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Hồ sơ Booking</p><h3 className="break-all font-mono text-sm font-bold text-slate-900">{detail.bookingNumber}</h3><p className="mt-1 text-xs text-slate-500">{detail.createdAt ? `Gửi lúc ${time(detail.createdAt)}` : detail.companyName}</p></div></div>
              <button type="button" aria-label={copiedId === detail.id ? 'Đã sao chép' : 'Sao chép mã'} onClick={copyBookingNumber} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">{copiedId === detail.id ? <Check aria-hidden="true" className="h-3.5 w-3.5 text-teal-600" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}<span className="hidden sm:inline">{copiedId === detail.id ? 'Đã sao chép' : 'Sao chép mã'}</span></button>
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2"><Status value={detail.status} /><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{detail.quantity} container · {equipment(detail.containerTypeCode)}</span>{detail.submission?.pickup && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">Chuyến hai chiều</span>}</div>
              <dl className="grid gap-4 sm:grid-cols-2"><DetailValue label="Hãng tàu">{detail.shippingLineName}</DetailValue><DetailValue label="Tàu / chuyến">{[voyage?.vesselName, voyage?.voyageNumber].filter(Boolean).join(' · ') || 'Chưa khai'}</DetailValue></dl>
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600"><Ship aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" /><span>{voyage?.portOfLoading || 'Chưa có cảng xếp'}</span><ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span>{voyage?.portOfDischarge || 'Chưa có cảng đến'}</span></div>
              <BookingProgress booking={detail} />
              <div className={`rounded-xl border p-3.5 ${detail.status === 'Rejected' ? 'border-rose-200 bg-rose-50 text-rose-900' : detail.status === 'Pending' ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                <p className="flex items-center gap-2 text-sm font-bold">{detail.status === 'Rejected' ? <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" /> : <Clock aria-hidden="true" className="h-4 w-4 shrink-0" />}{messageTitle}</p><p className="mt-1.5 text-xs leading-relaxed">{messageDescription}</p>
                {(detail.submission || detail.preparation) && ['Pending', 'Rejected'].includes(detail.status) && <button type="button" className="mt-3 inline-flex items-center gap-1 rounded-lg border border-current bg-white/70 px-3 py-2 text-xs font-bold disabled:opacity-50" disabled={busy} onClick={() => detail.preparation ? openPreparation('request') : (setEditing(detail), setCombined(Boolean(detail.submission.pickup)), setShowCreate(true))}>Sửa hồ sơ và gửi lại<ChevronRight aria-hidden="true" className="h-3.5 w-3.5" /></button>}
                {canPrepareContainers && <button type="button" className={`${primary} mt-3`} disabled={busy} onClick={() => openPreparation('containers')}>{detail.portStatus === 'WaitingContainerReview' ? 'Chỉnh danh sách đang chờ kiểm tra' : 'Hoàn thiện container & chứng từ'}<ChevronRight className="h-4 w-4" /></button>}
              </div>
              <details key={detail.id} className="group border-t border-slate-100 pt-3"><summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-600 [&::-webkit-details-marker]:hidden"><span className="inline-flex items-center gap-1.5"><Calendar aria-hidden="true" className="h-4 w-4 text-slate-400" />Lịch tàu & hạn chứng từ</span><ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">{[['VGM', voyage?.vgmCutoff], ['CY', voyage?.cyCutoff], ['SI', voyage?.siCutoff]].map(([label, value]) => <div key={label} className={`rounded-xl border p-3 text-xs ${expired(value) ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-100 bg-slate-50 text-slate-600'}`}><p className="font-bold">{label} cut-off {expired(value) && '· Đã hết hạn'}</p><p className="mt-1 leading-relaxed">{time(value)}</p></div>)}</div><p className="mt-3 text-xs leading-relaxed text-slate-500">Giờ Việt Nam · Nhận từ {time(voyage?.receiveFrom)} · ETD {time(voyage?.etd)}</p><div className="mt-3 flex flex-wrap gap-2"><Status value={detail.portStatus} labels={portLabels} /><Status value={detail.siStatus} labels={siLabels} />{detail.blNumber && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">B/L: {detail.blNumber}</span>}</div>
              </details>
            </div>
          </div>
          <nav role="tablist" aria-label="Chi tiết Booking xuất khẩu" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5" onKeyDown={event => {
            if (busy || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const current = detailTabs.findIndex(([key]) => key === section), next = event.key === 'Home' ? 0 : event.key === 'End' ? detailTabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + detailTabs.length) % detailTabs.length
            setSection(detailTabs[next][0]); event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus()
          }}>{detailTabs.map(([key, label, Icon, count]) => <button type="button" role="tab" key={key} id={`${panelId}-tab-${key}`} aria-controls={`${panelId}-panel-${key}`} aria-selected={section === key} tabIndex={section === key ? 0 : -1} disabled={busy} onClick={() => setSection(key)} className={`inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-orange-500 ${section === key ? 'bg-orange-50 text-orange-800' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}><Icon aria-hidden="true" className="h-4 w-4" />{label}{count !== undefined && <span className={`rounded-full px-1.5 text-[10px] ${section === key ? 'bg-orange-100' : 'bg-slate-100'}`}>{count}</span>}</button>)}</nav>
          <div role="tabpanel" id={`${panelId}-panel-${section}`} aria-labelledby={`${panelId}-tab-${section}`} tabIndex={0} className="min-w-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-orange-500">

          {section === 'containers' && <form onSubmit={saveContainers} className="space-y-4 rounded-2xl border border-chalk bg-white p-5">
            {detail.preparation && !rows.length && <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50 p-4"><p className="text-sm font-bold text-sky-900">{detail.preparation.containers?.length || 0}/{detail.quantity} container đang chuẩn bị</p><p className="text-xs leading-relaxed text-sky-800">Danh sách chính thức được chuyển cảng sau khi hãng tàu kiểm tra container, VGM và chứng từ.</p><div className="flex flex-wrap gap-2">{(detail.preparation.containers || []).map(row => <span key={sourceKey(row)} className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600">{row.containerNumber} · {row.containerTypeCode}</span>)}</div></div>}
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="flex items-center gap-2 text-sm font-bold"><Package aria-hidden="true" className="h-4 w-4 text-orange-600" />Danh sách container ({rows.length}/{detail.quantity})</h4><p className="mt-1 text-xs leading-relaxed text-slate-500">{editableContainers ? 'Chọn bản khai và bổ sung VGM thực tế cho từng container.' : 'Mở từng container để xem thông tin hàng và lịch xe.'}</p></div>{!editableContainers && rows.length > 1 && <button type="button" className="text-xs font-bold text-teal-700 underline underline-offset-2" onClick={() => setExpandedContainers(allContainersExpanded ? new Set() : new Set(rows.map(sourceKey)))}>{allContainersExpanded ? 'Thu gọn tất cả container' : 'Mở tất cả container'}</button>}</div>
            {detail.submission?.pickup && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800"><Truck aria-hidden="true" className="h-4 w-4 shrink-0" /><span>Hai chiều · Giao <b>{detail.containers[0]?.containerNumber}</b></span><ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /><span>Nhận <b>{detail.submission.pickupSource?.containerNumber || 'Theo hồ sơ'}</b></span></div>}
            {batchAvailable && <button type="button" className={primary} disabled={busy || containersDirty} onClick={() => setGateContext({ booking: detail, containers: gateContainers, batch: true })}>Đặt lịch xe theo lô</button>}
            {containersDirty && detail.portStatus === 'Accepted' && <p className="text-xs text-amber-800">Lưu danh sách container đã sửa trước khi đặt lịch xe.</p>}
            {detail.status === 'Pending' && !detail.submission && <p className="text-sm text-amber-800">Chờ hãng tàu duyệt đặt chỗ trước khi khai số container.</p>}
            {!detail.submission && ['Approved', 'ContainersDeclared', 'GateIn'].includes(detail.status) && (detail.siStatus === 'Confirmed' || expired(voyage?.vgmCutoff) || expired(voyage?.cyCutoff)) && <p role="status" className="text-sm text-amber-800">{detail.siStatus === 'Confirmed' ? 'Draft B/L đã xác nhận. Cần hãng tàu yêu cầu sửa trước khi thay đổi hồ sơ container.' : 'Đã quá hạn khai VGM hoặc CY cut-off. Liên hệ hãng tàu để xử lý ngoại lệ hoặc chuyển chuyến.'}</p>}
            {editableContainers && <div className="flex flex-wrap items-end gap-2"><Field label="Container từ bản khai"><select aria-label="Container từ bản khai" className={input} value={sourceId} disabled={busy || rows.length >= detail.quantity} onChange={e => setSourceId(e.target.value)}><option value="">Chọn container {detail.containerTypeCode}</option>{availableSources.map(source => <option key={sourceKey(source)} value={sourceKey(source)}>{source.containerNumber} · {source.containerTypeCode} · {cargoLabels[source.cargoType] || source.cargoType}</option>)}</select></Field><button type="button" className={secondary} disabled={busy || !sourceId || rows.length >= detail.quantity} onClick={addSource}>Thêm container</button></div>}
            {editableContainers && !availableSources.length && <p className="text-xs text-slate-500">Chưa có bản khai khác phù hợp loại {detail.containerTypeCode}. <Link to="/transport/cargo-declarations" className="font-semibold underline">Tra cứu Container</Link></p>}
            {rows.map(row => {
              const key = sourceKey(row), frozen = lockedContainer(row) || Boolean(row.gateBookingId), reefer = row.cargoType === 'reefer', dg = ['dangerous', 'dangerous_goods'].includes(row.cargoType)
              const gateAllowed = detail.portStatus === 'Accepted' && !expired(voyage?.cyCutoff) && !frozen && !row.gateBookingId && !containersDirty
              const expanded = editableContainers || expandedContainers.has(key)
              const delivered = detail.submission?.delivery?.trips?.find(trip => trip.bookingId === row.gateBookingId)
              const trip = delivered || detail.submission?.trips?.find(trip => trip.containerId === row.containerId)
              const profile = detail.submission?.fleet?.find(item => item.containerId === row.containerId)
              return <article key={key} className="overflow-hidden rounded-xl border border-slate-200">
                <button type="button" aria-label={`Xem container ${row.containerNumber}`} aria-expanded={expanded} aria-controls={`${panelId}-container-${row.containerId}`} disabled={editableContainers} className="flex w-full flex-wrap items-center gap-3 bg-slate-50/50 p-4 text-left transition-colors hover:bg-slate-50 disabled:cursor-default" onClick={() => setExpandedContainers(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"><Package aria-hidden="true" className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block font-mono text-sm font-bold text-slate-900">{row.containerNumber}</span><span className="mt-0.5 block text-[11px] text-slate-500">{row.containerTypeCode} · {cargoLabels[row.cargoType] || row.cargoType}</span></span><Status value={row.status} labels={containerLabels} />{!editableContainers && <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />}
                </button>
                <div id={`${panelId}-container-${row.containerId}`} hidden={!expanded} className={expanded ? 'space-y-4 border-t border-slate-100 p-4' : 'hidden'}>
                {editableContainers ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Số seal *"><input aria-label={`Seal ${row.containerNumber}`} className={input} maxLength={100} required value={row.sealNumber || ''} disabled={frozen || busy} onChange={e => patchRow(key, { sealNumber: e.target.value.toUpperCase() })} /></Field><Field label="VGM đã xác minh (kg) *"><input aria-label={`VGM ${row.containerNumber}`} className={input} type="number" min="0.001" step="0.001" required value={row.vgmKg} disabled={frozen || busy} onChange={e => patchRow(key, { vgmKg: e.target.value })} /></Field>
                  {reefer && <Field label="Nhiệt độ bảo quản (°C) *"><input className={input} aria-label={`Nhiệt độ ${row.containerNumber}`} type="number" step="0.1" required value={row.targetTemperature ?? ''} disabled={!editableContainers || frozen || busy} onChange={e => patchRow(key, { targetTemperature: e.target.value })} /></Field>}
                  {dg && <><Field label="Mã UN *"><input className={input} required maxLength={20} value={row.unNumber || ''} disabled={!editableContainers || frozen || busy} onChange={e => patchRow(key, { unNumber: e.target.value })} /></Field><Field label="Phân lớp hàng nguy hiểm *"><input className={input} required maxLength={30} value={row.dgClass || ''} disabled={!editableContainers || frozen || busy} onChange={e => patchRow(key, { dgClass: e.target.value })} /></Field></>}
                </div> : <dl className="grid gap-3 sm:grid-cols-2"><DetailValue label="Số seal">{row.sealNumber}</DetailValue><DetailValue label="VGM đã xác minh">{row.vgmKg !== '' && row.vgmKg != null ? `${Number(row.vgmKg).toLocaleString('vi-VN')} kg` : null}</DetailValue>{reefer && <DetailValue label="Nhiệt độ bảo quản">{row.targetTemperature != null && row.targetTemperature !== '' ? `${row.targetTemperature} °C` : null}</DetailValue>}{dg && <><DetailValue label="Mã UN">{row.unNumber}</DetailValue><DetailValue label="Phân lớp hàng nguy hiểm">{row.dgClass}</DetailValue></>}</dl>}
                {trip && <div className="space-y-3 rounded-xl bg-slate-50 p-3"><h5 className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><Truck aria-hidden="true" className="h-4 w-4 text-slate-400" />{delivered ? 'Lịch xe đã tạo' : 'Lịch xe đề xuất'}</h5><dl className="grid gap-3 text-xs sm:grid-cols-2"><DetailValue label="Khung giờ">{`${time(trip.appointmentStart)} – ${time(trip.appointmentEnd)}`}</DetailValue><DetailValue label="Xe đầu kéo">{delivered?.vehiclePlate || profile?.vehicle?.plateNumber}</DetailValue><DetailValue label="Tài xế">{delivered?.driverName || profile?.driver?.fullName}</DetailValue><DetailValue label="Rơ-moóc">{trip.trailerNumber}</DetailValue></dl></div>}
                <div className="flex flex-wrap items-center gap-3 text-xs"><span className={`rounded-lg px-2 py-1 ${row.customsCleared ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{row.customsCleared ? 'Đã xác nhận thông quan' : 'Chưa được cảng xác nhận thông quan'}</span>{attachmentUrl(row.customsDocumentUrl) && <a href={row.customsDocumentUrl} target="_blank" rel="noreferrer" className="font-semibold text-teal-700 underline">{row.customsFileName || 'Hồ sơ hải quan'}</a>}
                  {editableContainers && !frozen && <label className="relative cursor-pointer font-semibold text-teal-700 underline">{uploadingKey === key ? 'Đang tải…' : 'Tải hồ sơ hải quan'}<input className="sr-only" aria-label={`Hồ sơ hải quan ${row.containerNumber}`} type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy || Boolean(uploadingKey)} onChange={e => uploadCustoms(row, e)} /></label>}
                </div>
                <div className="flex flex-wrap gap-2">{!detail.submission && row.id && <button type="button" className={primary} disabled={busy || !gateAllowed} onClick={() => setGateContext({ booking: detail, container: row })}>Đặt lịch xe giao container</button>}{row.gateBookingId && <Link className={`${secondary} inline-block`} to={`/booking?bookingId=${encodeURIComponent(row.gateBookingId)}`}>Xem lịch xe đã đặt</Link>}{editableContainers && !frozen && <button type="button" className={`${secondary} text-rose-700`} disabled={busy} onClick={() => setRows(current => current.filter(item => sourceKey(item) !== key))}>Bỏ khỏi danh sách</button>}</div>
                </div>
              </article>
            })}
            {editableContainers && <button type="submit" className={primary} disabled={busy || Boolean(uploadingKey) || !rows.length}>{busy ? 'Đang lưu…' : 'Gửi danh sách container & VGM'}</button>}
          </form>}

          {section === 'documents' && <EvidenceList groups={documents} />}

          {section === 'si' && <div className="space-y-4 rounded-2xl border border-chalk bg-white p-5">
            <div><h4 className="font-bold">Shipping Instruction (SI)</h4><p className="mt-1 text-sm text-slate-500">SI có hạn riêng. Có thể nộp trước khi container vào cảng; không dùng tổng VGM thay cho khối lượng hàng.</p></div>
            {editableSi && <div className="space-y-3 rounded-xl bg-teal-50 p-4"><button type="button" className={secondary} disabled={busy} onClick={async () => { try { setSiSuggestions(await exportBookingService.getSiSuggestions(detail.id)) } catch (cause) { setError(errorText(cause)) } }}>Lấy gợi ý từ hồ sơ đã xác nhận</button>{siSuggestions && <><p className="text-xs text-teal-900">Kiểm tra đúng đối tác trước khi áp dụng. Số kiện được lấy từ Packing List của lô hiện tại.</p>{siSuggestions.grossWeightKg != null && <button type="button" className={secondary} onClick={() => setSi(current => ({ ...current, grossWeightKg: siSuggestions.grossWeightKg }))}>Dùng khối lượng hàng từ bản khai: {siSuggestions.grossWeightKg.toLocaleString('vi-VN')} kg</button>}{siSuggestions.templates.map(template => <button type="button" key={template.bookingNumber} className={`${secondary} mr-2 text-left`} onClick={() => setSi(current => ({ ...current, shipper: template.shipper || '', consignee: template.consignee || '', notifyParty: template.notifyParty || '', freightTerms: template.freightTerms || current.freightTerms, blType: template.blType || current.blType }))}>Đối tác từ {template.bookingNumber}</button>)}{!siSuggestions.templates.length && <p className="text-xs text-slate-500">Chưa có SI được xác nhận trước đây để gợi ý đối tác.</p>}</>}</div>}
            {editableSi ? <form onSubmit={submitSi} className="space-y-4"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[['shipper', 'Người gửi hàng (Shipper) *'], ['consignee', 'Người nhận hàng (Consignee) *'], ['notifyParty', 'Bên được thông báo (Notify party)']].map(([key, label]) => <Field key={key} label={label}><textarea className={input} required={key !== 'notifyParty'} maxLength={2000} value={si[key] || ''} disabled={busy} onChange={e => setSi(current => ({ ...current, [key]: e.target.value }))} /></Field>)}
              <Field label="Cảng đến"><input className={input} readOnly value={voyage?.portOfDischarge || ''} /></Field>
              <div className="sm:col-span-2"><Field label="Mô tả hàng hóa *"><textarea className={input} required maxLength={4000} value={si.cargoDescription || ''} disabled={busy} onChange={e => setSi(current => ({ ...current, cargoDescription: e.target.value }))} /></Field></div>
              <Field label="Số kiện *"><input className={input} type="number" required min="1" step="1" value={si.packagesCount ?? ''} disabled={busy} onChange={e => setSi(current => ({ ...current, packagesCount: e.target.value }))} /></Field><Field label="Tổng khối lượng hàng (kg) *"><input className={input} type="number" required min="0.001" step="0.001" value={si.grossWeightKg ?? ''} disabled={busy} onChange={e => setSi(current => ({ ...current, grossWeightKg: e.target.value }))} /></Field>
              <Field label="Điều khoản cước"><select className={input} value={si.freightTerms || 'Prepaid'} disabled={busy} onChange={e => setSi(current => ({ ...current, freightTerms: e.target.value }))}><option value="Prepaid">Trả trước (Prepaid)</option><option value="Collect">Trả sau (Collect)</option></select></Field><Field label="Yêu cầu phát hành B/L"><select className={input} value={si.blType || 'Original'} disabled={busy} onChange={e => setSi(current => ({ ...current, blType: e.target.value }))}><option value="Original">Bản gốc</option><option value="TelexRelease">Telex release</option></select></Field>
            </div><button type="submit" className={primary} disabled={busy}>{busy ? 'Đang gửi…' : detail.si ? 'Gửi SI cập nhật' : 'Nộp SI'}</button></form> : <><SiPreview value={detail.si} /><p className="text-sm text-slate-600">{detail.siStatus === 'Confirmed' ? 'SI và draft B/L đã xác nhận được khóa. Liên hệ hãng tàu nếu cần yêu cầu sửa.' : expired(voyage?.siCutoff) ? 'Đã hết SI cut-off. Liên hệ hãng tàu để xử lý ngoại lệ.' : 'Hãng tàu cần duyệt đặt chỗ trước khi tiếp nhận SI.'}</p></>}
            {detail.siStatus === 'Draft' && detail.draft && <div className="space-y-4 border-t border-slate-200 pt-5"><h4 className="font-bold">Kiểm tra draft B/L · phiên bản {detail.draftVersion}</h4><SiPreview value={detail.draft.si} /><p className="text-sm">Container trên draft: {(detail.draft.containers || []).map(row => `${row.containerNumber} (Seal ${row.sealNumber})`).join(', ') || 'Chưa có'}</p><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={draftConfirmed} disabled={busy} onChange={e => setDraftConfirmed(e.target.checked)} /><span>Tôi đã kiểm tra người gửi, người nhận, hàng hóa và danh sách container trên draft B/L.</span></label><button type="button" className={primary} disabled={busy || !draftConfirmed || !detail.draftVersion} onClick={() => mutate(() => exportBookingService.confirmDraft(detail.id, { expectedVersion: detail.version, draftVersion: detail.draftVersion }), 'Đã xác nhận draft B/L. Hãng tàu sẽ phát hành khi đủ điều kiện.')}>Xác nhận draft B/L</button></div>}
            {detail.si?.freightTerms === 'Prepaid' && <p className="text-sm text-slate-600">Cước hãng tàu trả trước: {detail.freightPaid ? 'Đã ghi nhận thanh toán' : 'Chưa ghi nhận thanh toán'}. Phí dịch vụ cảng của lịch xe được theo dõi riêng.</p>}
          </div>}

          {section === 'history' && <div className="rounded-2xl border border-slate-200 bg-white p-5"><h4 className="mb-5 text-sm font-bold">Lịch sử xử lý</h4>{!(detail.history || []).length && <p className="text-sm text-slate-500">Chưa có sự kiện.</p>}<ol className="space-y-5">{[...(detail.history || [])].reverse().map(event => <li key={event.id} className="relative pl-9"><span className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-orange-50 text-orange-600"><Clock aria-hidden="true" className="h-3.5 w-3.5" /></span><p className="mb-1 text-[11px] text-slate-400">{time(event.createdAt)}</p><p className="text-sm leading-relaxed text-slate-700">{event.description || event.event}</p></li>)}</ol></div>}
          </div>
          {canCancel && <details key={detail.id} className="group rounded-2xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-xs font-semibold text-slate-500 hover:text-rose-700 [&::-webkit-details-marker]:hidden"><span>Hủy hồ sơ Booking</span><ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" /></summary><form onSubmit={event => { event.preventDefault(); mutate(() => exportBookingService.cancelBooking(detail.id, { expectedVersion: detail.version, reason: cancellationReason }), 'Đã hủy Booking xuất khẩu.') }} className="flex flex-wrap items-end gap-3 border-t border-slate-100 p-4"><p className="w-full text-xs leading-relaxed text-slate-500">Kiểm tra đúng mã Booking và nhập lý do trước khi xác nhận hủy.</p><div className="min-w-0 flex-1"><Field label="Lý do hủy Booking"><input className={input} required maxLength={1000} value={cancellationReason} disabled={busy} onChange={e => setCancellationReason(e.target.value)} /></Field></div><button type="submit" className={`${secondary} text-rose-700`} disabled={busy || !cancellationReason.trim()}>Hủy Booking hãng tàu</button></form></details>}
        </>}
      </div>
    </div>}
  </section>
}
