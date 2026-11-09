import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CalendarDays, Check, ClipboardList, Container, Copy, FileCheck2, FileText, FlaskConical, Layers3, Loader2, Save, Search, ShieldCheck, X } from 'lucide-react'
import CatalogDialog from './CatalogDialog'
import BookingSourceSelect from './BookingSourceSelect'
import { createServiceDraftSamples } from './serviceDraftSamples'
import { labels } from './catalogApi'
import { draftDateTime, draftError, draftSession, serviceDraftKey, serviceDraftsApi } from './serviceDraftsApi'

const stages = [['Hồ sơ', FileText], ['Container', Container], ['Dịch vụ & thời gian', Layers3], ['Kiểm tra nháp', FileCheck2]]
const blankSource = () => ({ bookingId: null, documentType: 'EDO', referenceNumber: '', blNumber: '', validUntil: '' })
const containerId = row => row.sourceContainerId || row.id
const timeUnit = service => ['HOUR', 'DAY'].includes(service?.unit)
const serviceLine = service => ({ serviceId: service.id, startsAt: '', endsAt: '', quantity: timeUnit(service) ? null : 1 })
const compatible = (service, flow) => service.isActive && (service.direction === 'BOTH' || service.direction === flow)
const isReefer = row => /reefer|lạnh|frozen/i.test(row?.cargoType || '') || /^..R|RF|RH/i.test(row?.typeCode || '')
const clearlyDry = row => !isReefer(row) && /^..[GPTU]|DC|DR|GP|HC|OT|FR/i.test(row?.typeCode || '')
const localTime = value => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const utcTime = value => value ? new Date(value).toISOString() : null
function useDebounced(value) {
  const [result, setResult] = useState(value)
  useEffect(() => { const timer = setTimeout(() => setResult(value), 250); return () => clearTimeout(timer) }, [value])
  return result
}
function Field({ label, hint, children, wide = false }) {
  return <label className={`epd-field ${wide ? 'epd-wide' : ''}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}
function Loading({ children }) { return <div className="epd-loading" role="status"><Loader2 size={20} className="epc-spin" />{children}</div> }
function SummaryItem({ label, children }) { return <div><dt>{label}</dt><dd>{children}</dd></div> }

export default function ServiceDraftWizard({ services = [], initialServiceId, draftId, onClose, onSaved, onReview }) {
  const headingId = useId()
  const client = useQueryClient()
  const session = draftSession()
  const initial = services.find(service => service.id === initialServiceId)
  const [id] = useState(() => draftId || crypto.randomUUID())
  const [form, setForm] = useState(() => ({ dataMode: 'LIVE', expectedVersion: 0, flow: initial?.direction === 'IMPORT' ? 'IMPORT' : 'EXPORT', mainServiceId: initial?.id || null, source: blankSource(), plannedAt: '', contactName: '', contactPhone: '', note: '', lines: [] }))
  const [sampleData] = useState(() => import.meta.env.DEV ? createServiceDraftSamples() : null)
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
  const loaded = useRef(false)
  const sourceTerm = useDebounced(sourceSearch)
  const containerTerm = useDebounced(search)
  const main = services.find(service => service.id === form.mainServiceId)
  const detail = useQuery({ queryKey: [...serviceDraftKey, session, id], queryFn: () => serviceDraftsApi.get(id), enabled: !!draftId, retry: false })
  useEffect(() => {
    if (!detail.data || loaded.current) return
    const saved = detail.data
    setForm({ dataMode: 'LIVE', expectedVersion: saved.version, flow: saved.flow, mainServiceId: saved.mainServiceId || null, source: { ...blankSource(), ...saved.source, validUntil: saved.source?.validUntil?.slice(0, 10) || '' }, plannedAt: localTime(saved.plannedAt), contactName: saved.contactName || '', contactPhone: saved.contactPhone || '', note: saved.note || '', lines: (saved.lines || []).map(line => ({ ...line, services: line.services.map(item => ({ ...item, startsAt: localTime(item.startsAt), endsAt: localTime(item.endsAt) })) })) })
    setSnapshots(Object.fromEntries((saved.containers || []).map(row => [containerId(row), row])))
    if (saved.source?.bookingId && saved.sourceSnapshot?.bookingNumber) setBookingSnapshots(previous => ({ ...previous, [saved.source.bookingId]: { ...saved.sourceSnapshot, id: saved.source.bookingId } }))
    loaded.current = true
  }, [detail.data])
  const liveSources = useQuery({ queryKey: [...serviceDraftKey, session, 'sources', form.flow, sourceTerm], queryFn: () => serviceDraftsApi.sources({ flow: form.flow, search: sourceTerm || undefined }), enabled: !sampleMode && (!draftId || loaded.current), retry: false })
  const sampleSources = useMemo(() => sampleMode ? { data: { items: sampleData.bookings.filter(row => `${row.bookingNumber} ${row.vesselName} ${row.voyageNumber}`.toLocaleLowerCase('vi').includes(sourceTerm.toLocaleLowerCase('vi'))) }, isFetching: false, isError: false } : null, [sampleMode, sampleData, sourceTerm])
  const sources = sampleSources || liveSources
  useEffect(() => {
    if (sources.data?.items) setBookingSnapshots(previous => ({ ...previous, ...Object.fromEntries(sources.data.items.map(row => [row.id, row])) }))
  }, [sources.data])
  const liveContainers = useQuery({ queryKey: [...serviceDraftKey, session, 'containers', form.flow, form.source.bookingId, containerTerm], queryFn: () => serviceDraftsApi.containers({ flow: form.flow, sourceId: form.flow === 'EXPORT' ? form.source.bookingId : undefined, search: containerTerm || undefined }), enabled: !sampleMode && (!draftId || loaded.current) && (form.flow === 'IMPORT' || !!form.source.bookingId), retry: false })
  const sampleContainers = useMemo(() => sampleMode ? { data: { items: (sampleData.containers[form.source.bookingId] || []).filter(row => row.containerNumber.toLowerCase().includes(containerTerm.toLowerCase())), limit: 50 }, isPending: false, isError: false } : null, [sampleMode, sampleData, form.source.bookingId, containerTerm])
  const containers = sampleContainers || liveContainers
  useEffect(() => {
    if (containers.data?.items) setSnapshots(previous => ({ ...previous, ...Object.fromEntries(containers.data.items.map(row => [containerId(row), row])) }))
  }, [containers.data])
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0, behavior: 'instant' }); setFeedback('') }, [step])
  const mutate = updater => { setForm(updater); setDirty(true); setFeedback(''); setLeaveConfirm(false) }
  const update = (field, value) => mutate(previous => ({ ...previous, [field]: value }))
  const sourceUpdate = (field, value) => mutate(previous => ({ ...previous, source: { ...previous.source, [field]: value } }))
  const changeContext = (apply, message) => {
    if (form.lines.length) setPendingChange({ apply, message })
    else { mutate(apply); setSnapshots({}); setSearch(''); setSourceSearch(''); setCopyFrom(''); setCopyPreview(null) }
  }
  const changeFlow = flow => { if (flow !== form.flow) changeContext(previous => ({ ...previous, flow, dataMode: flow === 'EXPORT' ? previous.dataMode : 'LIVE', mainServiceId: services.some(service => service.id === previous.mainServiceId && compatible(service, flow)) ? previous.mainServiceId : null, source: blankSource(), lines: [] }), 'Đổi luồng hàng sẽ bỏ danh sách container đã chọn. Bạn có thể chọn lại ở hồ sơ mới.') }
  const changeDataMode = () => changeContext(previous => ({ ...previous, dataMode: sampleMode ? 'LIVE' : 'SAMPLE', source: blankSource(), lines: [] }), 'Đổi chế độ dữ liệu sẽ bỏ Booking và container đang chọn. Dữ liệu mẫu chỉ dùng để xem thử, không lưu vào hồ sơ thật.')
  const changeMain = value => {
    const service = services.find(item => item.id === value)
    const flow = service?.direction === 'BOTH' ? form.flow : service?.direction || form.flow
    changeContext(previous => ({ ...previous, flow, dataMode: flow === 'EXPORT' ? previous.dataMode : 'LIVE', mainServiceId: value || null, source: flow === previous.flow ? previous.source : blankSource(), lines: [] }), 'Đổi dịch vụ chính sẽ bỏ lựa chọn container và dịch vụ kèm để tránh dùng nhầm hồ sơ.')
  }
  const chooseSource = value => { if (value !== form.source.bookingId) changeContext(previous => ({ ...previous, source: { ...blankSource(), bookingId: value || null }, lines: [] }), 'Đổi Booking sẽ bỏ danh sách container và dịch vụ kèm đã chọn.') }
  const chooseContainer = row => mutate(previous => ({ ...previous, lines: previous.lines.some(line => line.sourceContainerId === containerId(row)) ? previous.lines.filter(line => line.sourceContainerId !== containerId(row)) : [...previous.lines, { sourceContainerId: containerId(row), services: main ? [serviceLine(main)] : [] }] }))
  const changeLine = (sourceId, updater) => mutate(previous => ({ ...previous, lines: previous.lines.map(line => line.sourceContainerId === sourceId ? updater(line) : line) }))
  const toggleAddon = (sourceId, service) => changeLine(sourceId, line => ({ ...line, services: line.services.some(item => item.serviceId === service.id) ? line.services.filter(item => item.serviceId !== service.id) : [...line.services, serviceLine(service)] }))
  const changeUsage = (sourceId, serviceId, field, value) => changeLine(sourceId, line => ({ ...line, services: line.services.map(item => item.serviceId === serviceId ? { ...item, [field]: value } : item) }))
  const validateTimes = () => {
    for (const line of form.lines) for (const usage of line.services) {
      if (usage.startsAt && usage.endsAt && new Date(usage.endsAt) <= new Date(usage.startsAt)) return 'Thời gian kết thúc phải sau thời gian bắt đầu. Vui lòng kiểm tra từng dịch vụ.'
    }
    return ''
  }
  const save = useMutation({ mutationFn: async () => {
    if (sampleMode || form.dataMode === 'SAMPLE') throw new Error('Hồ sơ mẫu chỉ dùng để xem thử; chọn dữ liệu thật trước khi lưu.')
    const error = validateTimes()
    if (error) throw new Error(error)
    const payload = { ...form }; delete payload.dataMode
    return serviceDraftsApi.save(id, { ...payload, source: { ...form.source, validUntil: form.source.validUntil || null }, plannedAt: utcTime(form.plannedAt), lines: form.lines.map(line => ({ ...line, services: line.services.map(item => ({ ...item, startsAt: utcTime(item.startsAt), endsAt: utcTime(item.endsAt), quantity: item.quantity === '' || item.quantity == null ? null : Number(item.quantity) })) })) })
  }, onSuccess: async (saved, action) => { setDirty(false); await client.invalidateQueries({ queryKey: serviceDraftKey }); if (action === 'review' && onReview) onReview(saved); else onSaved(saved) } })
  const requestClose = () => { if (save.isPending) return; if (dirty) setLeaveConfirm(true); else onClose() }
  const next = () => {
    if (step === 0 && !main) return setFeedback('Chọn dịch vụ chính để tiếp tục.')
    if (step === 0 && form.flow === 'EXPORT' && !form.source.bookingId) return setFeedback('Chọn Booking trước khi chọn container.')
    if (step === 0 && form.flow === 'IMPORT' && !form.source.referenceNumber.trim()) return setFeedback('Nhập số DO/eDO để tiếp tục. Thông tin sẽ được lưu ở trạng thái chờ đối chiếu.')
    if (step === 1 && !form.lines.length) return setFeedback('Chọn ít nhất một container để tiếp tục.')
    const error = validateTimes()
    if (step === 2 && error) return setFeedback(error)
    setStep(previous => Math.min(3, previous + 1))
  }
  const addonOptions = services.filter(service => compatible(service, form.flow) && !['EXPORT_DROPOFF', 'IMPORT_PICKUP'].includes(service.code) && service.id !== form.mainServiceId)
  const selectedBooking = (sampleMode ? sampleData.bookings : sources.data?.items)?.find(item => item.id === form.source.bookingId) || bookingSnapshots[form.source.bookingId]
  const sourceLabel = form.flow === 'EXPORT' ? selectedBooking?.bookingNumber || detail.data?.sourceSnapshot?.bookingNumber || 'Chưa chọn Booking' : form.source.referenceNumber || 'Chưa khai báo DO/eDO'
  const ready = !draftId || loaded.current

  return <CatalogDialog className="epd-dialog" labelledBy={`${headingId}-title`} describedBy={`${headingId}-description`} onClose={requestClose}>
    <header className="epd-header"><div><span className="epc-eyebrow">NEXUSPORT / {sampleMode ? 'DỮ LIỆU MẪU' : 'ĐĂNG KÝ DỊCH VỤ'}</span><h2 id={`${headingId}-title`} tabIndex={-1} data-dialog-initial-focus>{draftId ? 'Tiếp tục bản nháp dịch vụ' : 'Tạo đăng ký dịch vụ'}</h2><p id={`${headingId}-description`}>{sampleMode ? 'Trải nghiệm chọn Booking, container và dịch vụ bằng hồ sơ mẫu.' : 'Lưu hồ sơ, container và dịch vụ để tiếp tục hoàn thiện đăng ký.'}</p></div><button type="button" className="epc-icon-button" aria-label="Đóng đăng ký dịch vụ" onClick={requestClose} disabled={save.isPending}><X size={21} /></button></header>
    <nav className="epd-steps" aria-label="Các bước tạo đăng ký">{stages.map(([label, Icon], index) => <button type="button" key={label} aria-current={step === index ? 'step' : undefined} disabled={index > step || save.isPending} onClick={() => setStep(index)}><span className="epd-step-number">{index < step ? <Check size={15} /> : <Icon size={16} />}</span><span><small>BƯỚC {index + 1}</small>{label}</span></button>)}</nav>
    <div className="epd-body" ref={bodyRef}>
      {detail.isError ? <div className="epd-empty"><FileText size={32} /><h3>Chưa mở được bản nháp</h3><p>{draftError(detail.error)}</p><button type="button" className="epc-button secondary" onClick={() => detail.refetch()}>Thử lại</button></div> : !ready ? <Loading>Đang tải hồ sơ đã lưu…</Loading> : <div className="epd-layout">
        <fieldset className="epd-content" disabled={save.isPending}>
          {sampleMode && <div className="epd-sample-banner" role="status"><FlaskConical size={21} /><div><strong>Dữ liệu mẫu · 3 Booking, 6 container</strong><p>Dùng để thử các bước đăng ký. Hồ sơ mẫu không được lưu hoặc gửi xác nhận.</p></div></div>}
          {pendingChange && <div className="epd-warning" role="alert"><p>{pendingChange.message}</p><div><button type="button" className="epc-button secondary" onClick={() => setPendingChange(null)}>Giữ lựa chọn</button><button type="button" className="epc-button primary" onClick={() => { mutate(pendingChange.apply); setSnapshots({}); setSearch(''); setSourceSearch(''); setPendingChange(null); setCopyFrom(''); setCopyPreview(null) }}>Đổi hồ sơ</button></div></div>}
          {feedback && <div className="epc-error" role="alert">{feedback}</div>}
          {step === 0 && <section className="epd-stage" aria-label="Hồ sơ đăng ký">
            <div className="epd-stage-heading"><span>01</span><div><h3>Chọn dịch vụ và hồ sơ nguồn</h3><p>Dữ liệu container được lấy theo hồ sơ và phạm vi truy cập của công ty.</p></div></div>
            <div className="epd-form-grid"><Field label="Dịch vụ chính" wide><select aria-label="Dịch vụ chính" value={form.mainServiceId || ''} onChange={event => changeMain(event.target.value)}><option value="">Chọn dịch vụ cần đăng ký</option>{services.filter(service => service.isActive || service.id === form.mainServiceId).map(service => <option key={service.id} value={service.id} disabled={!service.isActive}>{service.name}{!service.isActive ? ' — Tạm ngừng' : ''}</option>)}</select></Field></div>
            <div className="epd-flow" role="group" aria-label="Luồng đăng ký"><button type="button" aria-pressed={form.flow === 'EXPORT'} onClick={() => changeFlow('EXPORT')}><Container size={20} /><span>Hàng xuất<small>Chọn Booking hãng tàu</small></span><Check size={16} /></button><button type="button" aria-pressed={form.flow === 'IMPORT'} onClick={() => changeFlow('IMPORT')}><FileText size={20} /><span>Hàng nhập<small>Khai báo DO / eDO</small></span><Check size={16} /></button></div>
            {form.flow === 'EXPORT' ? <div className="epd-source-box"><div className="epd-section-label"><FileText size={17} /><h4>Booking hãng tàu</h4>{import.meta.env.DEV && !draftId && <button type="button" className="epc-button secondary epd-sample-toggle" onClick={changeDataMode}><FlaskConical size={14} />{sampleMode ? 'Dùng dữ liệu thật' : 'Nạp dữ liệu mẫu'}</button>}</div><BookingSourceSelect items={sources.data?.items || []} value={form.source.bookingId} selected={selectedBooking} search={sourceSearch} onSearch={setSourceSearch} onChange={chooseSource} loading={sources.isFetching || sourceSearch !== sourceTerm} error={sources.isError ? draftError(sources.error) : null} onRetry={() => liveSources.refetch()} />{selectedBooking && <div className="epd-source-detail"><span><Container size={14} />{selectedBooking.containerCount} container</span><span><CalendarDays size={14} />CY cut-off: {draftDateTime(selectedBooking.cyCutoff)}</span></div>}</div>
              : <div className="epd-source-box"><div className="epd-section-label"><FileText size={17} /><h4>Tham chiếu lệnh giao hàng</h4><span className="epd-status amber">Chờ đối chiếu</span></div><p className="epd-muted">Khai báo số lệnh trên chứng từ bạn có. Thông tin DO/eDO được lưu để đối chiếu cùng hồ sơ đăng ký.</p><div className="epd-form-grid"><Field label="Loại chứng từ"><select aria-label="Loại chứng từ" value={form.source.documentType} onChange={event => sourceUpdate('documentType', event.target.value)}><option value="EDO">eDO điện tử</option><option value="DO">DO giấy</option></select></Field><Field label="Số DO/eDO"><input aria-label="Số DO/eDO" maxLength={100} value={form.source.referenceNumber} onChange={event => sourceUpdate('referenceNumber', event.target.value)} placeholder="Nhập số lệnh giao hàng" /></Field><Field label="Số vận đơn (B/L)"><input maxLength={100} value={form.source.blNumber} onChange={event => sourceUpdate('blNumber', event.target.value)} placeholder="Nếu có" /></Field><Field label="Hạn DO/eDO"><input type="date" value={form.source.validUntil} onChange={event => sourceUpdate('validUntil', event.target.value)} /></Field></div></div>}
          </section>}
          {step === 1 && <section className="epd-stage" aria-label="Chọn container">
            <div className="epd-stage-heading"><span>02</span><div><h3>Chọn container cần sử dụng dịch vụ</h3><p>{form.flow === 'EXPORT' ? 'Danh sách theo Booking hãng tàu đã chọn.' : 'Các lượt container có hàng thuộc phạm vi truy cập của công ty.'}</p></div></div>
            {form.flow === 'IMPORT' && <div className="epd-info"><ShieldCheck size={17} /><p>Việc chọn container để lưu nháp chưa xác nhận hiệu lực DO/eDO hoặc quyền nhận hàng.</p></div>}
            <div className="epd-container-toolbar"><label className="epd-search"><Search size={16} /><input aria-label="Tìm container đăng ký" placeholder="Tìm theo số container…" value={search} onChange={event => setSearch(event.target.value)} /></label><span>{form.lines.length}/50 đã chọn</span></div>
            {form.lines.length > 0 && <div className="epd-selected" aria-label="Container đã chọn">{form.lines.map(line => <span key={line.sourceContainerId}><Container size={13} />{snapshots[line.sourceContainerId]?.containerNumber || line.sourceContainerId.slice(0, 8)}<button type="button" aria-label={`Bỏ chọn ${snapshots[line.sourceContainerId]?.containerNumber || line.sourceContainerId}`} onClick={() => mutate(previous => ({ ...previous, lines: previous.lines.filter(item => item.sourceContainerId !== line.sourceContainerId) }))}><X size={12} /></button></span>)}</div>}
            {containers.isPending ? <Loading>Đang tải container…</Loading> : containers.isError ? <div className="epc-error" role="alert">{draftError(containers.error)}<button type="button" className="epc-text-button" onClick={() => containers.refetch()}>Thử lại</button></div> : !containers.data?.items?.length ? <div className="epd-empty"><Container size={30} /><h3>Chưa có container phù hợp</h3><p>{search ? 'Thử số container khác hoặc xóa từ khóa tìm kiếm.' : 'Kiểm tra hồ sơ nguồn và quyền truy cập container của công ty.'}</p>{search && <button type="button" className="epc-button secondary" onClick={() => setSearch('')}>Xóa tìm kiếm</button>}</div> : <>
              <div className="epd-container-grid">{containers.data.items.map(row => {
                const selected = form.lines.some(line => line.sourceContainerId === containerId(row))
                const unavailable = !selected && (form.lines.length >= 50 || (main?.code === 'REEFER_POWER' && clearlyDry(row)))
                return <label key={containerId(row)} className={`epd-container-choice ${selected ? 'selected' : ''} ${unavailable ? 'disabled' : ''}`}><input type="checkbox" checked={selected} disabled={unavailable} onChange={() => chooseContainer(row)} aria-label={`Chọn container ${row.containerNumber}`} /><span className="epd-container-icon"><Container size={22} /></span><span className="epd-container-copy"><strong>{row.containerNumber}</strong><small>{row.typeCode} · Container có hàng</small>{row.cargoType && <small>{row.cargoType}</small>}</span><span className="epd-container-check"><Check size={14} /></span></label>
              })}</div>
              <p className="epd-muted">Hiển thị tối đa {containers.data.limit || 50} container mỗi lần tìm. Các lựa chọn vẫn được giữ khi tìm kiếm.</p>
            </>}
            {draftId && form.lines.length > 0 && <p className="epd-muted">Container đã lưu sẽ được kiểm tra lại khi bạn lưu thay đổi. Có thể bỏ lựa chọn cũ và chọn lại từ nguồn hiện tại.</p>}
          </section>}
          {step === 2 && <section className="epd-stage" aria-label="Dịch vụ và thời gian">
            <div className="epd-stage-heading"><span>03</span><div><h3>Dịch vụ theo từng container</h3><p>Chọn dịch vụ kèm và khai báo thời gian sử dụng khi cần.</p></div></div>
            <div className="epd-form-grid"><Field label="Thời gian dự kiến thực hiện" wide><input aria-label="Thời gian dự kiến thực hiện" type="datetime-local" value={form.plannedAt} onChange={event => update('plannedAt', event.target.value)} /></Field><Field label="Người liên hệ"><input maxLength={100} value={form.contactName} onChange={event => update('contactName', event.target.value)} autoComplete="name" placeholder="Họ và tên" /></Field><Field label="Điện thoại liên hệ"><input type="tel" maxLength={30} value={form.contactPhone} onChange={event => update('contactPhone', event.target.value)} autoComplete="tel" placeholder="Số điện thoại" /></Field></div>
            {form.lines.length > 1 && <div className="epd-copy-box"><div className="epd-section-label"><Copy size={17} /><h4>Áp dụng nhanh cùng lựa chọn</h4></div><p>Chọn container nguồn để sao chép dịch vụ kèm và thời gian sang các container còn lại.</p><div className="epd-copy-actions"><select aria-label="Container nguồn sao chép dịch vụ" value={copyFrom || form.lines[0].sourceContainerId} onChange={event => { setCopyFrom(event.target.value); setCopyPreview(null) }}>{form.lines.map(line => <option key={line.sourceContainerId} value={line.sourceContainerId}>{snapshots[line.sourceContainerId]?.containerNumber || line.sourceContainerId.slice(0, 8)}</option>)}</select><button type="button" className="epc-button secondary" onClick={() => setCopyPreview(copyFrom || form.lines[0].sourceContainerId)}><Copy size={15} />Áp dụng cho các container đã chọn</button></div>{copyPreview && <div className="epd-copy-preview"><p>Sao chép từ <strong>{snapshots[copyPreview]?.containerNumber}</strong> sang {form.lines.length - 1} container còn lại. Các dịch vụ kèm và thời gian đang chọn ở những container đó sẽ được thay thế; điện lạnh chỉ áp dụng cho container phù hợp.</p><div><button type="button" className="epc-button secondary" onClick={() => setCopyPreview(null)}>Giữ nguyên</button><button type="button" className="epc-button primary" onClick={() => {
              const sourceLine = form.lines.find(line => line.sourceContainerId === copyPreview)
              if (sourceLine) mutate(previous => ({ ...previous, lines: previous.lines.map(line => line.sourceContainerId === copyPreview ? line : { ...line, services: sourceLine.services.filter(usage => services.find(service => service.id === usage.serviceId)?.code !== 'REEFER_POWER' || !clearlyDry(snapshots[line.sourceContainerId])).map(usage => ({ ...usage })) }) }))
              setCopyPreview(null)
            }}><Check size={15} />Xác nhận áp dụng</button></div></div>}</div>}
            <div className="epd-line-list">{form.lines.map((line, index) => {
              const row = snapshots[line.sourceContainerId]
              return <article className="epd-line-card" key={line.sourceContainerId} aria-label={`Dịch vụ ${row?.containerNumber || index + 1}`}><header><span className="epd-container-icon"><Container size={22} /></span><div><strong>{row?.containerNumber || 'Container đã chọn'}</strong><small>{row?.typeCode || 'Theo hồ sơ nguồn'} · {line.services.length} dịch vụ</small></div><span className="epd-line-index">{String(index + 1).padStart(2, '0')}</span></header><div className="epd-line-content"><div className="epd-main-service"><ShieldCheck size={17} /><div><small>DỊCH VỤ CHÍNH</small><strong>{main?.name || 'Chưa chọn dịch vụ chính'}</strong></div></div>{addonOptions.length > 0 && <fieldset className="epd-addon-options"><legend>Dịch vụ đính kèm</legend>{addonOptions.filter(service => service.code !== 'REEFER_POWER' || !clearlyDry(row)).map(service => <label key={service.id}><input type="checkbox" checked={line.services.some(usage => usage.serviceId === service.id)} onChange={() => toggleAddon(line.sourceContainerId, service)} /><span>{service.name}<small>{labels.unit[service.unit]}</small></span></label>)}</fieldset>}
                {line.services.map(usage => {
                  const service = services.find(item => item.id === usage.serviceId)
                  if (!service) return <div className="epd-info" key={usage.serviceId}><FileText size={16} /><p>Dịch vụ đã lưu không còn trong danh mục hiện tại. Hãy chọn lại dịch vụ trước khi lưu.</p></div>
                  return timeUnit(service) ? <div className="epd-time-block" key={usage.serviceId}><div className="epd-section-label"><CalendarDays size={15} /><h4>{service.name}</h4><small>Theo {labels.unit[service.unit]}</small></div><div className="epd-form-grid"><Field label={`Bắt đầu — ${service.name}`}><input type="datetime-local" value={usage.startsAt || ''} onChange={event => changeUsage(line.sourceContainerId, service.id, 'startsAt', event.target.value)} /></Field><Field label={`Kết thúc — ${service.name}`}><input type="datetime-local" min={usage.startsAt || undefined} value={usage.endsAt || ''} onChange={event => changeUsage(line.sourceContainerId, service.id, 'endsAt', event.target.value)} /></Field></div></div> : ['MOVE', 'WEIGH'].includes(service.unit) ? <div className="epd-time-block" key={usage.serviceId}><Field label={`Số ${labels.unit[service.unit]} — ${service.name}`}><input type="number" min="1" max="10000" step="1" value={usage.quantity ?? 1} onChange={event => changeUsage(line.sourceContainerId, service.id, 'quantity', event.target.value)} /></Field></div> : null
                })}
              </div></article>
            })}</div>
            <Field label="Ghi chú đăng ký"><textarea maxLength={1000} rows={3} value={form.note} onChange={event => update('note', event.target.value)} placeholder="Thông tin cần lưu cùng hồ sơ dịch vụ…" /></Field>
          </section>}
          {step === 3 && <section className="epd-stage" aria-label="Kiểm tra bản nháp">
            <div className="epd-stage-heading"><span>04</span><div><h3>Kiểm tra thông tin đăng ký</h3><p>Lưu nháp để tiếp tục sau hoặc chuyển sang kiểm tra điều kiện và phí dịch vụ.</p></div></div>
            <div className="epd-review-card"><div className="epd-section-label"><ClipboardList size={18} /><h4>Thông tin đăng ký</h4><button type="button" className="epc-text-button" onClick={() => setStep(0)}>Chỉnh sửa</button></div><dl className="epd-review-facts"><SummaryItem label="Dịch vụ chính">{main?.name || 'Chưa chọn'}</SummaryItem><SummaryItem label="Luồng hàng">{labels.direction[form.flow]}</SummaryItem><SummaryItem label={form.flow === 'EXPORT' ? 'Booking' : 'DO/eDO'}>{sourceLabel}</SummaryItem><SummaryItem label="Dự kiến thực hiện">{form.plannedAt ? draftDateTime(utcTime(form.plannedAt)) : 'Chưa khai báo'}</SummaryItem><SummaryItem label="Liên hệ">{[form.contactName, form.contactPhone].filter(Boolean).join(' · ') || 'Chưa khai báo'}</SummaryItem></dl></div>
            <div className="epd-review-card"><div className="epd-section-label"><Container size={18} /><h4>Container và dịch vụ</h4><button type="button" className="epc-text-button" onClick={() => setStep(2)}>Chỉnh sửa</button></div><div className="epd-review-lines">{form.lines.map(line => <div key={line.sourceContainerId}><strong>{snapshots[line.sourceContainerId]?.containerNumber || 'Container đã chọn'}</strong><ul>{line.services.map(usage => <li key={usage.serviceId}><Check size={13} /><span>{services.find(service => service.id === usage.serviceId)?.name || 'Dịch vụ đã lưu'}{(usage.startsAt || usage.endsAt) && <small>{usage.startsAt ? draftDateTime(utcTime(usage.startsAt)) : 'Chưa có giờ bắt đầu'} → {usage.endsAt ? draftDateTime(utcTime(usage.endsAt)) : 'Chưa có giờ kết thúc'}</small>}</span></li>)}</ul></div>)}</div></div>
            {form.note && <div className="epd-review-card"><h4>Ghi chú</h4><p>{form.note}</p></div>}
            <div className="epd-info"><ShieldCheck size={17} /><p>{sampleMode ? 'Bạn đã xem hết hồ sơ mẫu. Quay lại bước Hồ sơ và chọn Dùng dữ liệu thật để bắt đầu đăng ký có thể lưu.' : <>Chọn <strong>Lưu & kiểm tra</strong> để lưu thông tin, đối chiếu điều kiện và xem từng dòng phí trước khi xác nhận. Bạn vẫn có thể chỉ lưu nháp.</>}</p></div>
          </section>}
          {save.error && <div className="epc-error" role="alert">{draftError(save.error)}{save.error?.response?.status === 409 && <p>Hồ sơ đã thay đổi hoặc được xác nhận. Đóng cửa sổ và mở lại từ danh sách để xem trạng thái mới nhất.</p>}</div>}
        </fieldset>
        <aside className="epd-summary" aria-label="Tóm tắt bản nháp"><div className="epd-summary-title"><span><ClipboardList size={22} /></span><div><small>HỒ SƠ DỊCH VỤ</small><strong>Tóm tắt bản nháp</strong></div></div><span className="epd-status">{sampleMode ? 'Dữ liệu mẫu' : 'Bản nháp'}</span><dl><SummaryItem label="Dịch vụ">{main?.name || 'Chưa chọn dịch vụ'}</SummaryItem><SummaryItem label="Hồ sơ nguồn">{sourceLabel}</SummaryItem><SummaryItem label="Container"><span className="epd-summary-count">{form.lines.length.toString().padStart(2, '0')}</span></SummaryItem><SummaryItem label="Dịch vụ kèm">{form.lines.reduce((total, line) => total + line.services.filter(usage => usage.serviceId !== form.mainServiceId).length, 0)} lựa chọn</SummaryItem></dl>{form.flow === 'IMPORT' && <div className="epd-summary-note"><ShieldCheck size={17} /><p>DO/eDO chờ đối chiếu cùng hồ sơ.</p></div>}<p className="epd-summary-footnote">{sampleMode ? 'Hồ sơ mẫu chỉ dùng để trải nghiệm, không lưu hoặc gửi xác nhận.' : 'Bạn có thể lưu nháp ở bất kỳ bước nào và mở lại để tiếp tục.'}</p></aside>
      </div>}
    </div>
    {leaveConfirm && <div className="epd-leave-confirm" role="alert"><p>{sampleMode ? 'Đóng cửa sổ sẽ bỏ các lựa chọn mẫu đang xem.' : 'Hồ sơ có thay đổi chưa lưu. Bạn muốn tiếp tục chỉnh sửa hay đóng cửa sổ?'}</p><div><button type="button" className="epc-button secondary" onClick={() => setLeaveConfirm(false)}>Tiếp tục chỉnh sửa</button><button type="button" className="epc-button secondary" onClick={onClose}>Đóng, bỏ thay đổi</button>{!sampleMode && <button type="button" className="epc-button primary" onClick={() => save.mutate()} disabled={save.isPending}><Save size={15} />Lưu nháp</button>}</div></div>}
    <footer className="epd-footer"><button type="button" className="epc-button secondary" disabled={save.isPending} onClick={step > 0 ? () => setStep(previous => previous - 1) : requestClose}>{step > 0 ? <ArrowLeft size={15} /> : <X size={15} />}{step > 0 ? 'Quay lại' : 'Đóng'}</button><div><button type="button" className="epc-button secondary" disabled={sampleMode || !ready || detail.isError || save.isPending || !!pendingChange} onClick={() => save.mutate()}>{save.isPending ? <Loader2 size={16} className="epc-spin" /> : <Save size={16} />}Lưu nháp</button>{step < 3 ? <button type="button" className="epc-button primary" disabled={!ready || detail.isError || save.isPending || !!pendingChange} onClick={next}>Tiếp tục<ArrowRight size={16} /></button> : onReview && <button type="button" className="epc-button primary" disabled={sampleMode || !ready || detail.isError || save.isPending || !!pendingChange} onClick={() => save.mutate('review')}><FileCheck2 size={16} />Lưu & kiểm tra</button>}</div></footer>
  </CatalogDialog>
}
