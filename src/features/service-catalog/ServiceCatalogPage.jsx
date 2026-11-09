import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Container, Truck, PlugZap, ArrowLeftRight, Clock3, Scale, Search, Plus, ArrowUpRight, Check, X, ShieldCheck, CalendarDays, Calculator, Pencil, Loader2, RefreshCw, CircleHelp, ReceiptText, CheckCircle2, Ban, SlidersHorizontal, ArrowRight, Layers3, Pause, Play, FolderOpen } from 'lucide-react'
import { catalogApi, labels, money, formatDate, rateState, liveRates } from './catalogApi'
import CatalogDialog from './CatalogDialog'
import ServiceDraftWizard from './ServiceDraftWizard'
import ServiceDraftList from './ServiceDraftList'
import ServiceRegistrationReview from './ServiceRegistrationReview'
import './serviceCatalog.css'
import './serviceDrafts.css'
import './serviceRegistrations.css'

const iconMap = { container: Container, truck: Truck, plug: PlugZap, move: ArrowLeftRight, clock: Clock3, scale: Scale }
const directionIcons = { ALL: Layers3, EXPORT: Container, IMPORT: Truck, BOTH: PlugZap }
const tabIcons = { conditions: ShieldCheck, tariffs: ReceiptText, history: Clock3 }
const key = ['eport-service-catalog']
const getError = error => error?.response?.data?.message || error?.response?.data?.Message || error?.message || 'Không thể hoàn tất thao tác. Vui lòng thử lại.'
const emptyService = { code: '', name: '', description: '', direction: 'BOTH', unit: 'CONTAINER', icon: 'container', conditions: [''], isActive: true, requiresApproval: false }

function ServiceIcon({ service, size = 24 }) {
  const Icon = iconMap[service.icon] || Container
  return <span className={`epc-icon epc-icon-${service.icon}`}><Icon size={size} strokeWidth={1.7} aria-hidden="true" /></span>
}
function Badge({ children, tone = '' }) { return <span className={`epc-badge ${tone}`}>{children}</span> }
function Price({ service, today }) {
  const rates = liveRates(service, today)
  if (!rates.length) return <span className="epc-unpriced">Chưa có biểu phí</span>
  return <span className="epc-card-price"><small>Từ </small>{money(Math.min(...rates.map(r => r.amount)))}<small> / {labels.unit[service.unit]}</small></span>
}
function Modal({ title, description, children, onClose }) {
  const id = useId()
  return <CatalogDialog labelledBy={`${id}-title`} describedBy={`${id}-description`} onClose={onClose}>
    <header><div><span className="epc-eyebrow">NEXUSPORT / E-PORT</span><h2 id={`${id}-title`} tabIndex={-1} data-dialog-initial-focus>{title}</h2><p id={`${id}-description`}>{description}</p></div><button type="button" className="epc-icon-button" aria-label="Đóng cửa sổ" onClick={onClose}><X size={20} /></button></header>
    {children}
  </CatalogDialog>
}
function Field({ label, children, hint, wide = false }) { return <label className={`epc-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label> }
function Options({ values }) { return Object.entries(values).map(([value, label]) => <option key={value} value={value}>{label}</option>) }

function ServiceForm({ service, onClose, onSaved }) {
  const [form, setForm] = useState(service ? { ...service, expectedVersion: service.version } : emptyService)
  const update = (name, value) => setForm(f => ({ ...f, [name]: value }))
  const save = useMutation({ mutationFn: () => catalogApi.save(service?.id, form), onSuccess: onSaved })
  return <Modal title={service ? 'Chỉnh sửa dịch vụ' : 'Thêm dịch vụ cảng'} description="Khai báo nội dung, đơn vị tính và điều kiện để khách hàng tra cứu." onClose={onClose}>
    <form onSubmit={e => { e.preventDefault(); save.mutate() }}>
      <div className="epc-form-grid">
        <Field label="Mã dịch vụ"><input required maxLength={40} pattern="[A-Z][A-Z0-9_]{2,39}" value={form.code} disabled={!!service} onChange={e => update('code', e.target.value.toUpperCase())} placeholder="VD: REEFER_POWER" /></Field>
        <Field label="Tên dịch vụ"><input required maxLength={100} value={form.name} onChange={e => update('name', e.target.value)} placeholder="Tên hiển thị cho khách hàng" /></Field>
        <Field label="Mô tả ngắn" wide><textarea required maxLength={600} rows={3} value={form.description} onChange={e => update('description', e.target.value)} /></Field>
        <Field label="Luồng hàng"><select value={form.direction} onChange={e => update('direction', e.target.value)}><Options values={{ EXPORT: 'Hàng xuất', IMPORT: 'Hàng nhập', BOTH: 'Cả hai chiều / tại bãi' }} /></select></Field>
        <Field label="Đơn vị tính" hint={service?.tariffs?.length ? 'Đơn vị được giữ cố định khi đã có lịch sử giá.' : null}><select value={form.unit} disabled={!!service?.tariffs?.length} onChange={e => update('unit', e.target.value)}><Options values={labels.unit} /></select></Field>
        <Field label="Biểu tượng"><select value={form.icon} onChange={e => update('icon', e.target.value)}><Options values={{ container: 'Container', truck: 'Xe giao nhận', plug: 'Cấp điện', move: 'Di chuyển', clock: 'Thời gian', scale: 'Cân' }} /></select></Field>
        <Field label="Trạng thái cung cấp"><select value={String(form.isActive)} onChange={e => update('isActive', e.target.value === 'true')}><option value="true">Đang cung cấp</option><option value="false">Tạm ngừng</option></select></Field>
        <Field label="Điều kiện sử dụng" hint="Mỗi dòng là một điều kiện. Tối đa 12 dòng, 240 ký tự mỗi dòng." wide><textarea required rows={5} value={form.conditions.join('\n')} onChange={e => update('conditions', e.target.value.split('\n'))} /></Field>
        <label className="epc-checkbox wide"><input type="checkbox" checked={form.requiresApproval} onChange={e => update('requiresApproval', e.target.checked)} />Yêu cầu điều độ phê duyệt</label>
      </div>
      {save.error && <div className="epc-error" role="alert">{getError(save.error)}</div>}
      <footer><button type="button" className="epc-button secondary" onClick={onClose}>Hủy bỏ</button><button className="epc-button primary" disabled={save.isPending}>{save.isPending ? <Loader2 size={16} className="epc-spin" /> : <Check size={16} />}Lưu dịch vụ</button></footer>
    </form>
  </Modal>
}
function TariffForm({ service, today, onClose, onSaved }) {
  const [form, setForm] = useState({ size: 'ALL', equipment: 'ALL', amount: '', effectiveFrom: today, effectiveTo: '', note: '' })
  const update = (name, value) => setForm(f => ({ ...f, [name]: value }))
  const save = useMutation({ mutationFn: () => catalogApi.addTariff(service.id, { ...form, amount: Number(form.amount), effectiveTo: form.effectiveTo || null }), onSuccess: onSaved })
  return <Modal title="Thêm biểu phí" description={service.name} onClose={onClose}>
    <form onSubmit={e => { e.preventDefault(); save.mutate() }}>
      <div className="epc-form-grid">
        <Field label="Kích thước container"><select value={form.size} onChange={e => update('size', e.target.value)}><Options values={labels.size} /></select></Field>
        <Field label="Nhóm tính giá"><select value={form.equipment} onChange={e => update('equipment', e.target.value)}><Options values={labels.equipment} /></select></Field>
        <Field label={`Đơn giá (VND / ${labels.unit[service.unit]})`} wide><div className="epc-money-input"><input type="number" required min="0" max="999999999999" step="1" value={form.amount} onChange={e => update('amount', e.target.value)} placeholder="Nhập đơn giá đã được phê duyệt" /><span>VND</span></div></Field>
        <Field label="Áp dụng từ"><input type="date" required value={form.effectiveFrom} onChange={e => update('effectiveFrom', e.target.value)} /></Field>
        <Field label="Đến hết ngày" hint="Để trống nếu chưa giới hạn ngày kết thúc."><input type="date" min={form.effectiveFrom} value={form.effectiveTo} onChange={e => update('effectiveTo', e.target.value)} /></Field>
        <Field label="Ghi chú" wide><textarea maxLength={500} rows={2} value={form.note} onChange={e => update('note', e.target.value)} placeholder="Căn cứ hoặc ghi chú áp dụng" /></Field>
      </div>
      <div className="epc-notice"><ShieldCheck size={18} /><p>Biểu phí được lưu thành một bản riêng. Các khoảng ngày của cùng kích thước và nhóm container không được chồng nhau.</p></div>
      {save.error && <div className="epc-error" role="alert">{getError(save.error)}</div>}
      <footer><button type="button" className="epc-button secondary" onClick={onClose}>Hủy bỏ</button><button className="epc-button primary" disabled={save.isPending}>{save.isPending ? <Loader2 size={16} className="epc-spin" /> : <Plus size={16} />}Lưu biểu phí</button></footer>
    </form>
  </Modal>
}

function Estimate({ service }) {
  const [form, setForm] = useState({ size: '20FT', equipment: 'DRY', quantity: '1' })
  const resultRef = useRef(null)
  const quote = useMutation({ mutationFn: () => catalogApi.quote(service.id, { ...form, quantity: Number(form.quantity) }) })
  useEffect(() => {
    if (!quote.data || !resultRef.current) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || resultRef.current.closest('.epc-motion-paused')
    resultRef.current.scrollIntoView({ block: 'nearest', behavior: reduced ? 'instant' : 'smooth' })
  }, [quote.data])
  const update = (name, value) => { setForm(f => ({ ...f, [name]: value })); quote.reset() }
  return <section className="epc-estimate"><div className="epc-section-title"><Calculator size={18} /><h3>Dự tính chi phí</h3><Badge>VND</Badge></div>
    <p className="epc-estimate-intro">Chọn thông tin container để tra đơn giá phù hợp.</p>
    <form onSubmit={e => { e.preventDefault(); quote.mutate() }}><fieldset disabled={quote.isPending}>
      <div className="epc-form-grid"><Field label="Kích thước"><select value={form.size} onChange={e => update('size', e.target.value)}><Options values={Object.fromEntries(Object.entries(labels.size).filter(([k]) => k !== 'ALL'))} /></select></Field>
        <Field label="Nhóm container"><select value={form.equipment} onChange={e => update('equipment', e.target.value)}><Options values={Object.fromEntries(Object.entries(labels.equipment).filter(([k]) => k !== 'ALL'))} /></select></Field>
        <Field label={`Số ${labels.unit[service.unit]}`} wide><input type="number" required min={service.unit === 'HOUR' ? '.01' : '1'} max="10000" step={service.unit === 'HOUR' ? '.01' : '1'} value={form.quantity} onChange={e => update('quantity', e.target.value)} /></Field></div>
      <button className="epc-button primary full" disabled={!service.isActive || quote.isPending}>{quote.isPending ? <Loader2 size={16} className="epc-spin" /> : <Calculator size={16} />}Tính chi phí dự kiến<ArrowRight size={16} aria-hidden="true" /></button>
    </fieldset></form>
    {!quote.data && !quote.error && <div className="epc-estimate-hint"><ShieldCheck size={16} /><p>Tham khảo chi phí theo biểu phí hiện hành trước khi đăng ký dịch vụ.</p></div>}
    {quote.error && <p className="epc-error" role="alert">{getError(quote.error)}</p>}
    {quote.data && <div ref={resultRef} className="epc-quote" aria-live="polite">{quote.data.status === 'PRICED' ? <><div className="epc-quote-heading"><span>Tổng dự kiến</span><CheckCircle2 size={18} /></div><strong>{money(quote.data.total)}</strong><small>{money(quote.data.unitPrice)} × {quote.data.quantity} {labels.unit[service.unit]}</small></> : <strong className="epc-quote-unpriced">{quote.data.message}</strong>}<p>{quote.data.status === 'PRICED' ? quote.data.message : 'Vui lòng liên hệ bộ phận dịch vụ để được hỗ trợ về đơn giá.'}</p></div>}
  </section>
}
function HistoryPanel({ id }) {
  const query = useQuery({ queryKey: [...key, 'history', id], queryFn: () => catalogApi.history(id) })
  if (query.isPending) return <p className="epc-muted">Đang tải lịch sử…</p>
  if (query.isError) return <p className="epc-error" role="alert">{getError(query.error)}</p>
  const names = { SERVICE_CREATED: 'Khai báo dịch vụ', SERVICE_UPDATED: 'Cập nhật dịch vụ', TARIFF_CREATED: 'Thêm biểu phí', TARIFF_RETIRED: 'Ngừng áp dụng biểu phí' }
  return <ol className="epc-timeline">{query.data.length ? query.data.map(item => <li key={item.id}><span className="epc-timeline-dot" /><div><strong>{names[item.action] || item.action}</strong><time>{new Date(item.createdAt).toLocaleString('vi-VN')}</time>{item.action === 'TARIFF_CREATED' && <small>{money(item.after.amount)} / {labels.unit[item.after.unit]}</small>}</div></li>) : <li className="epc-muted">Chưa có thay đổi do quản trị viên ghi nhận.</li>}</ol>
}

function ServiceWorkspace({ service, today, management, tab, onTab, onClose, onEdit, onAddTariff, onRetire, onRegister, notice }) {
  const id = useId()
  const tabs = [['conditions', 'Điều kiện sử dụng'], ['tariffs', 'Biểu phí'], ...(management ? [['history', 'Lịch sử']] : [])]
  const rates = liveRates(service, today)
  const changeTabWithKeyboard = (event, value) => {
    const current = tabs.findIndex(([key]) => key === value)
    let next
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (current + tabs.length - 1) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return
    event.preventDefault()
    onTab(tabs[next][0])
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus()
  }

  return <CatalogDialog className="epc-workspace" accent={service.icon} labelledBy={`${id}-title`} describedBy={`${id}-description`} onClose={onClose}>
    <header className="epc-workspace-header">
      <div className="epc-workspace-heading">
        <ServiceIcon service={service} size={28} />
        <div className="epc-workspace-title">
          <span className="epc-eyebrow">DỊCH VỤ CẢNG / {labels.direction[service.direction]}</span>
          <span className="epc-workspace-code">{service.code}</span>
          <h2 id={`${id}-title`} tabIndex={-1} data-dialog-initial-focus>{service.name}</h2>
          <p id={`${id}-description`}>{service.description}</p>
        </div>
      </div>
      <button type="button" className="epc-icon-button" aria-label="Đóng chi tiết dịch vụ" onClick={onClose}><X size={22} /></button>
    </header>
    <div className="epc-workspace-meta">
      <Badge tone={service.isActive ? 'green' : 'neutral'}>{service.isActive ? 'Đang cung cấp' : 'Tạm ngừng'}</Badge>
      <Badge>Đơn vị: {labels.unit[service.unit]}</Badge>
      {service.requiresApproval && <Badge tone="orange">Cần điều độ phê duyệt</Badge>}
      <span><ShieldCheck size={14} />{service.conditions.length} điều kiện sử dụng</span>
    </div>
    {notice && <div className="epc-workspace-notice" role="status"><CheckCircle2 size={16} />{notice}</div>}
    <div className="epc-workspace-grid">
      <section className="epc-workspace-content">
        <div className="epc-detail-tabs" role="tablist" aria-label="Thông tin dịch vụ" style={{ '--tab-index': tabs.findIndex(([value]) => value === tab), '--tab-count': tabs.length }}>
          <span className="epc-tab-indicator" aria-hidden="true" />
          {tabs.map(([value, label]) => { const TabIcon = tabIcons[value]; return <button
            key={value} type="button" role="tab" id={`${id}-tab-${value}`}
            aria-label={label}
            aria-selected={tab === value} aria-controls={`${id}-panel`} tabIndex={tab === value ? 0 : -1}
            onClick={() => onTab(value)} onKeyDown={event => changeTabWithKeyboard(event, value)}
          ><TabIcon size={16} aria-hidden="true" /><span>{label}</span>{value !== 'history' && <small>{value === 'conditions' ? service.conditions.length : service.tariffs.length}</small>}</button> })}
        </div>
        <div key={tab} className="epc-detail-body" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`} tabIndex={0}>
          {tab === 'conditions' ? <>
            <div className="epc-panel-intro"><span className="epc-panel-step" aria-hidden="true">01</span><div><div className="epc-section-title"><ShieldCheck size={19} /><h3>Chuẩn bị trước khi sử dụng</h3></div><p>Đối chiếu các điều kiện để chuẩn bị hồ sơ đầy đủ.</p></div></div>
            <ol className="epc-conditions">
              {service.conditions.map((condition, index) => <li key={index} style={{ '--condition-index': index }}><span>{String(index + 1).padStart(2, '0')}</span><p>{condition}</p></li>)}
            </ol>
            <div className="epc-notice"><CircleHelp size={18} /><p>Hồ sơ và trạng thái container sẽ được đối chiếu khi đăng ký dịch vụ.</p></div>
          </> : tab === 'tariffs' ? <>
            <div className="epc-panel-intro"><span className="epc-panel-step" aria-hidden="true">02</span><div><div className="epc-section-title"><ReceiptText size={19} /><h3>Đơn giá theo phạm vi áp dụng</h3></div><p>Tra cứu kích thước, nhóm container và thời gian hiệu lực.</p></div>{management && <button type="button" className="epc-text-button" onClick={onAddTariff}><Plus size={16} />Thêm biểu phí</button>}</div>
            <div className="epc-rate-list">
              {service.tariffs.length ? service.tariffs.map(rate => <div className="epc-rate" key={rate.id}>
                <div><strong>{money(rate.amount)} <small>/ {labels.unit[rate.unit]}</small></strong><Badge tone={rateState(rate, today) === 'Đang áp dụng' ? 'green' : 'neutral'}>{rateState(rate, today)}</Badge></div>
                <div className="epc-rate-scope"><span><Container size={13} />{labels.size[rate.size]}</span><span><Layers3 size={13} />{labels.equipment[rate.equipment]}</span></div>
                <small><CalendarDays size={14} />{formatDate(rate.effectiveFrom)} — {formatDate(rate.effectiveTo)}</small>
                {rate.note && <p className="epc-rate-note">{rate.note}</p>}
                {management && rate.isActive && <button type="button" className="epc-text-button danger" onClick={() => onRetire(rate)}><Ban size={14} />Ngừng áp dụng</button>}
              </div>) : <div className="epc-no-rate"><ReceiptText size={32} /><strong>Chưa có biểu phí</strong><p>Đơn giá sẽ hiển thị khi được quản trị viên cấu hình.</p>{management && <button type="button" className="epc-button secondary" onClick={onAddTariff}><Plus size={16} />Thêm biểu phí đầu tiên</button>}</div>}
            </div>
          </> : <><div className="epc-panel-intro"><span className="epc-panel-step" aria-hidden="true">03</span><div><div className="epc-section-title"><Clock3 size={19} /><h3>Lịch sử thay đổi</h3></div><p>Theo dõi các lần cập nhật dịch vụ và biểu phí.</p></div></div><HistoryPanel id={service.id} /></>}
        </div>
      </section>
      <aside className="epc-workspace-aside" aria-label={management ? 'Thao tác quản trị dịch vụ' : 'Dự tính chi phí dịch vụ'}>
        {management ? <div className="epc-workspace-tools">
          <div className="epc-section-title"><SlidersHorizontal size={19} /><h3>Quản lý dịch vụ</h3></div>
          <div className="epc-workspace-price"><span>Đơn giá đang hiệu lực</span><Price service={service} today={today} /></div>
          <dl className="epc-workspace-facts">
            <div><dt>Luồng hàng</dt><dd>{labels.direction[service.direction]}</dd></div>
            <div><dt>Đơn vị tính</dt><dd>{labels.unit[service.unit]}</dd></div>
            <div><dt>Biểu phí hiệu lực</dt><dd>{rates.length}</dd></div>
          </dl>
          <button type="button" className="epc-button primary full" onClick={onAddTariff}><Plus size={17} />Thêm biểu phí</button>
          <button type="button" className="epc-button secondary full" onClick={onEdit}><Pencil size={16} />Chỉnh sửa dịch vụ</button>
          <p className="epc-workspace-helper">Mỗi biểu phí được lưu theo khoảng ngày áp dụng. Lịch sử thay đổi luôn được giữ lại.</p>
        </div> : <>
          <div className="epc-price-summary"><div className="epc-price-summary-heading"><ReceiptText size={17} /><span>Đơn giá tham khảo</span><Badge>VND</Badge></div><Price service={service} today={today} /><p>Áp dụng theo kích thước, nhóm container và thời gian sử dụng.</p><div className="epc-price-summary-meta"><CalendarDays size={14} />Tra cứu tại ngày {formatDate(today)}</div></div>
          {!service.isActive && <div className="epc-notice"><Ban size={17} /><p>Dịch vụ đang tạm ngừng. Bạn vẫn có thể xem điều kiện và biểu phí đã công bố.</p></div>}
          <Estimate key={service.id} service={service} />
        </>}
      </aside>
    </div>
    <footer className={`epc-workspace-footer ${onRegister && service.isActive ? 'epc-workspace-footer-register' : ''}`}><span><span className="epc-workspace-footer-mark"><ShieldCheck size={15} /></span>Thông tin theo danh mục hiện hành</span><div className="epc-workspace-footer-actions"><button type="button" className="epc-button secondary" onClick={onClose}>Đóng chi tiết</button>{onRegister && service.isActive && <button type="button" className="epc-button primary" onClick={onRegister}><Plus size={16} />Đăng ký dịch vụ</button>}</div></footer>
  </CatalogDialog>
}

export default function ServiceCatalogPage({ management = false }) {
  const client = useQueryClient()
  let account = {}
  try { account = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}') } catch { /* ProtectedRoute handles an invalid session. */ }
  const query = useQuery({ queryKey: [...key, account?.id || account?.username, account?.role], queryFn: catalogApi.list })
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [selectedId, setSelectedId] = useState(null)
  const [tab, setTab] = useState('conditions')
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')
  const [confirmRetire, setConfirmRetire] = useState(null)
  const [motionPaused, setMotionPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [draftDialog, setDraftDialog] = useState(null)
  const [showDraftList, setShowDraftList] = useState(false)
  const [registrationReview, setRegistrationReview] = useState(null)
  const canDraft = !management && ['transport company', 'carrier', 'carrier staff'].includes(account?.role?.trim().toLowerCase())
  const services = query.data?.services || []
  const today = query.data?.asOf || ''
  // There is no implicit selection: detail content belongs only to the clicked service.
  const selected = services.find(service => service.id === selectedId)
  const filtered = services.filter(service => (!search || `${service.name} ${service.code} ${service.description}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) && (direction === 'ALL' || service.direction === direction) && (status === 'ALL' || service.isActive === (status === 'ACTIVE')))
  const ready = services.filter(service => service.isActive && liveRates(service, today).length)
  const updated = async () => {
    await client.invalidateQueries({ queryKey: key })
    setModal(null)
    setNotice('Đã lưu thay đổi thành công.')
  }
  const retire = useMutation({
    mutationFn: ({ serviceId, tariff }) => catalogApi.retire(serviceId, tariff.id),
    onSuccess: async () => { setConfirmRetire(null); await updated() },
  })
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4500)
    return () => clearTimeout(timer)
  }, [notice])
  useEffect(() => { setSelectedId(null); setModal(null); setConfirmRetire(null); setTab('conditions') }, [management])
  const choose = id => { setSelectedId(id); setTab('conditions'); setNotice(''); retire.reset() }
  const startDraft = (initialServiceId = null) => { setSelectedId(null); setShowDraftList(false); setRegistrationReview(null); setDraftDialog({ initialServiceId }) }
  const draftSaved = async draft => {
    setDraftDialog(null)
    await client.invalidateQueries({ queryKey: ['eport-service-drafts'] })
    setNotice(`Đã lưu bản nháp ${draft.number || ''}. Bạn có thể mở lại trong “Hồ sơ của tôi”.`)
  }
  const reviewDraft = draftId => { setDraftDialog(null); setShowDraftList(false); setRegistrationReview(draftId); setNotice('') }
  const editDraft = draftId => { setRegistrationReview(null); setShowDraftList(false); setDraftDialog({ draftId }) }
  const registered = registration => setNotice(`Đã ghi nhận đăng ký ${registration.number || ''}${registration.status === 'PENDING_APPROVAL' ? ' — Chờ cảng duyệt.' : ' — Đã xác nhận.'}`)

  return <div className={`epc ${motionPaused ? 'epc-motion-paused' : ''}`}>
    <div className="epc-page-header">
      <div>
        <div className="epc-breadcrumb">{management ? 'Quản trị' : 'Cổng doanh nghiệp'}<span>/</span>Dịch vụ cảng</div>
        <h1>{management ? 'Danh mục & biểu phí' : 'Dịch vụ cảng'}</h1>
        <p>{management ? 'Quản lý dịch vụ và đơn giá theo từng thời gian áp dụng.' : 'Chọn dịch vụ để xem điều kiện, biểu phí và dự tính chi phí.'}</p>
      </div>
      {management ? <button type="button" className="epc-button primary" onClick={() => setModal({ type: 'service' })}><Plus size={18} />Thêm dịch vụ</button> : canDraft ? <div className="epc-page-actions"><button type="button" className="epc-button secondary" onClick={() => setShowDraftList(true)}><FolderOpen size={16} />Hồ sơ của tôi</button><button type="button" className="epc-button primary" onClick={() => startDraft()}><Plus size={17} />Tạo đăng ký</button></div> : <span className="epc-header-label"><ShieldCheck size={16} />Thông tin dịch vụ & đơn giá</span>}
    </div>

    <section className="epc-hero" aria-labelledby="epc-hero-title">
      <div className="epc-hero-grid" aria-hidden="true" />
      <button type="button" className="epc-motion-control" onClick={() => setMotionPaused(paused => !paused)} aria-label={motionPaused ? 'Bật hiệu ứng chuyển động' : 'Tạm dừng hiệu ứng chuyển động'}>{motionPaused ? <Play size={13} /> : <Pause size={13} />}<span>{motionPaused ? 'Bật chuyển động' : 'Chuyển động'}</span></button>
      <div className="epc-hero-content">
        <div className="epc-hero-brand"><span />NEXUSPORT E-PORT</div>
        <h2 id="epc-hero-title">{management ? 'Một danh mục rõ ràng.' : 'Dịch vụ cho từng hành trình.'}<span>{management ? 'Mỗi đơn giá có căn cứ.' : 'Chi phí rõ từ đầu.'}</span></h2>
        <p>{management ? 'Thiết lập dịch vụ và thời gian hiệu lực. Giữ lịch sử cho mỗi lần cập nhật.' : 'Tra cứu giao nhận, dịch vụ bãi và điều kiện sử dụng tại một nơi.'}</p>
        <div className="epc-hero-stats" aria-label="Tổng quan danh mục">
          <div><strong>{query.isPending || query.isError ? '—' : String(services.filter(service => service.isActive).length).padStart(2, '0')}</strong><span>dịch vụ đang cung cấp</span></div>
          <div><strong>{query.isPending || query.isError ? '—' : String(ready.length).padStart(2, '0')}</strong><span>dịch vụ có giá hiệu lực</span></div>
          <div><strong>VND</strong><span>đơn vị tiền tệ</span></div>
        </div>
      </div>
      <div className="epc-hero-art" aria-hidden="true">
        <div className="epc-hero-orbit" />
        <div className="epc-hero-route"><span /><span /><span /></div>
        <div className="epc-hero-node"><Container size={17} /><span>E-PORT<span>Dịch vụ kết nối</span></span></div>
        <div className="epc-hero-container epc-hero-container-blue"><span>E-PORT</span></div>
        <div className="epc-hero-container epc-hero-container-green" />
        <div className="epc-hero-container epc-hero-container-orange"><Container size={40} strokeWidth={1.2} /><span>NEXUSPORT</span></div>
        <div className="epc-hero-art-caption"><ShieldCheck size={16} />KẾT NỐI MỌI TÁC NGHIỆP</div>
      </div>
    </section>
    {notice && !selected && <div className="epc-success" role="status"><CheckCircle2 size={18} />{notice}<button type="button" aria-label="Đóng thông báo" onClick={() => setNotice('')}><X size={16} /></button></div>}

    {query.isError ? <section className="epc-load-error"><CircleHelp size={32} /><h2>Chưa tải được danh mục dịch vụ</h2><p>{getError(query.error)}</p><button type="button" className="epc-button secondary" onClick={() => query.refetch()}><RefreshCw size={16} />Thử lại</button></section>
      : query.isPending ? <div className="epc-loading" aria-live="polite"><Loader2 className="epc-spin" size={28} /><p>Đang tải dịch vụ và biểu phí…</p></div> : <>
        <div className="epc-toolbar">
          <div className="epc-filters" aria-label="Lọc theo luồng hàng" style={{ '--filter-index': Object.keys(labels.direction).indexOf(direction) }}><span className="epc-filter-indicator" aria-hidden="true" />{Object.entries(labels.direction).map(([value, label]) => { const FilterIcon = directionIcons[value]; return <button type="button" key={value} className={direction === value ? 'active' : ''} aria-label={label} aria-pressed={direction === value} onClick={() => setDirection(value)}><FilterIcon size={15} aria-hidden="true" /><span>{label}</span><small>{services.filter(service => value === 'ALL' || service.direction === value).length}</small></button> })}</div>
          <div className="epc-search"><Search size={17} /><input aria-label="Tìm dịch vụ" placeholder="Tìm tên hoặc mã dịch vụ…" value={search} onChange={event => setSearch(event.target.value)} /></div>
          {management && <select className="epc-status-filter" aria-label="Lọc trạng thái dịch vụ" value={status} onChange={event => setStatus(event.target.value)}><option value="ALL">Mọi trạng thái</option><option value="ACTIVE">Đang cung cấp</option><option value="PAUSED">Tạm ngừng</option></select>}
        </div>
        <div className="epc-layout">
          <section className="epc-catalog" aria-labelledby="epc-catalog-heading">
            <div className="epc-list-caption"><h2 id="epc-catalog-heading" tabIndex={-1} data-catalog-heading>{management ? 'Danh sách dịch vụ' : 'Khám phá dịch vụ'}</h2><span>{filtered.length} dịch vụ</span></div>
            {!filtered.length ? <div className="epc-empty"><Search size={28} /><h3>Không có dịch vụ phù hợp</h3><p>Thử một từ khóa hoặc bộ lọc khác.</p><button type="button" className="epc-button secondary" onClick={() => { setSearch(''); setDirection('ALL'); setStatus('ALL') }}>Xóa bộ lọc</button></div>
              : management ? <div className="epc-table-wrap"><table className="epc-table">
                <thead><tr><th>Dịch vụ</th><th>Đơn vị / luồng</th><th>Đơn giá hiện tại</th><th><span className="epc-sr-only">Thao tác</span></th></tr></thead>
                <tbody>{filtered.map(service => <tr key={service.id}>
                  <td><button type="button" className="epc-service-link" onClick={() => choose(service.id)} aria-haspopup="dialog"><ServiceIcon service={service} size={21} /><span><strong>{service.name}</strong><small>{service.code}</small><Badge tone={service.isActive ? 'green' : 'neutral'}>{service.isActive ? 'Đang cung cấp' : 'Tạm ngừng'}</Badge></span></button></td>
                  <td><span>{labels.unit[service.unit]}</span><small>{labels.direction[service.direction]}</small></td>
                  <td><Price service={service} today={today} /><small>{liveRates(service, today).length} biểu phí hiệu lực</small></td>
                  <td><button type="button" className="epc-icon-button" aria-label={`Chỉnh sửa ${service.name}`} onClick={() => setModal({ type: 'service', service })}><Pencil size={16} /></button></td>
                </tr>)}</tbody>
              </table></div> : <div className="epc-cards">{filtered.map((service, index) => <button type="button" key={service.id} className={`epc-service-card ${!service.isActive ? 'paused' : ''}`} data-accent={service.icon} style={{ '--card-index': index }} onClick={() => choose(service.id)} aria-haspopup="dialog">
                <div className="epc-card-top"><ServiceIcon service={service} /><div className="epc-card-kicker"><small>{service.code}</small><Badge tone={!service.isActive ? 'neutral' : service.direction === 'EXPORT' ? 'orange' : service.direction === 'IMPORT' ? 'blue' : 'green'}>{service.isActive ? labels.direction[service.direction] : 'Tạm ngừng'}</Badge></div><span className="epc-card-watermark" aria-hidden="true"><ServiceIcon service={service} size={88} /></span></div>
                <h3>{service.name}</h3><p>{service.description}</p>
                <div className="epc-card-condition"><ShieldCheck size={14} /><span>{service.requiresApproval ? 'Cần điều độ phê duyệt' : `${service.conditions.length} điều kiện sử dụng`}</span></div>
                <div className="epc-card-bottom"><Price service={service} today={today} /><span className="epc-card-action">Xem dịch vụ<ArrowUpRight size={17} /></span></div>
              </button>)}</div>}
            <div className="epc-footnote"><CircleHelp size={17} /><p>Đơn giá phụ thuộc kích thước, nhóm container và thời gian hiệu lực. Mở một dịch vụ để xem thông tin và dự tính chi phí.</p></div>
          </section>
        </div>
      </>}

    {selected && <ServiceWorkspace
      key={selected.id} service={selected} today={today} management={management} tab={tab} onTab={setTab}
      onClose={() => setSelectedId(null)}
      onEdit={() => setModal({ type: 'service', service: selected })}
      onAddTariff={() => setModal({ type: 'tariff', service: selected })}
      onRetire={tariff => { retire.reset(); setConfirmRetire({ serviceId: selected.id, tariff }) }}
      onRegister={canDraft ? () => startDraft(selected.id) : null}
      notice={notice}
    />}
    {canDraft && showDraftList && <ServiceDraftList onClose={() => setShowDraftList(false)} onCreate={() => startDraft()} onEdit={editDraft} onReview={reviewDraft} />}
    {canDraft && draftDialog && <ServiceDraftWizard key={draftDialog.draftId || 'new'} services={services} initialServiceId={draftDialog.initialServiceId} draftId={draftDialog.draftId} onClose={() => setDraftDialog(null)} onSaved={draftSaved} onReview={draft => reviewDraft(draft.id)} />}
    {canDraft && registrationReview && <ServiceRegistrationReview key={registrationReview} draftId={registrationReview} onClose={() => setRegistrationReview(null)} onEdit={editDraft} onRegistered={registered} />}
    {modal?.type === 'service' && <ServiceForm service={modal.service} onClose={() => setModal(null)} onSaved={updated} />}
    {modal?.type === 'tariff' && <TariffForm service={modal.service} today={today} onClose={() => setModal(null)} onSaved={updated} />}
    {confirmRetire && <Modal title="Ngừng áp dụng biểu phí?" description="Lịch sử giá vẫn được giữ lại. Biểu phí này sẽ không còn được dùng để dự tính mới." onClose={() => { setConfirmRetire(null); retire.reset() }}>
      <div className="epc-confirm-body"><strong>{money(confirmRetire.tariff.amount)} / {labels.unit[confirmRetire.tariff.unit]}</strong><p>{labels.size[confirmRetire.tariff.size]} · {labels.equipment[confirmRetire.tariff.equipment]}</p>{retire.error && <div className="epc-error" role="alert">{getError(retire.error)}</div>}</div>
      <footer><button type="button" className="epc-button secondary" onClick={() => setConfirmRetire(null)}>Giữ biểu phí</button><button type="button" className="epc-button destructive" disabled={retire.isPending} onClick={() => retire.mutate(confirmRetire)}>{retire.isPending && <Loader2 size={16} className="epc-spin" />}Ngừng áp dụng</button></footer>
    </Modal>}
  </div>
}
