import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Container, Truck, PlugZap, ArrowLeftRight, Clock3, Scale, Search, Plus, ArrowUpRight, Check, X, ShieldCheck, CalendarDays, Calculator, Pencil, Loader2, RefreshCw, CircleHelp, ReceiptText, CheckCircle2, Ban, SlidersHorizontal, ArrowRight, Layers3, Pause, Play, ArrowDownToLine, ArrowUpFromLine, CheckCircle, ClipboardList, Filter, FileText } from 'lucide-react'
import { catalogApi, labels, money, formatDate, rateState, liveRates } from './catalogApi'
import CatalogDialog from './CatalogDialog'
import ServiceDraftWizard from './ServiceDraftWizard'
import ServiceDraftList from './ServiceDraftList'
import ServiceRegistrationReview from './ServiceRegistrationReview'
import ServiceOrderDetail from './ServiceOrderDetail'
import OrderBadge from './ServiceOrderBadge'
import { draftDateTime, draftError, draftSession, serviceDraftKey } from './serviceDraftsApi'
import { orderStatusLabels, paymentStateLabel, paymentStatusLabels, serviceOrderKey, serviceOrdersApi, statusTone } from './serviceOrdersApi'
import './serviceCatalog.css'
import './serviceDrafts.css'
import './serviceRegistrations.css'
import './serviceDelivery.css'
import './serviceOrders.css'

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
  if (service.pricingManagedByDispatcher) return <span className="epc-unpriced">Dispatcher xác nhận phí sau đăng ký</span>
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

function HistoryPanel({ id }) {
  const query = useQuery({ queryKey: [...key, 'history', id], queryFn: () => catalogApi.history(id) })
  if (query.isPending) return <p className="epc-muted">Đang tải lịch sử…</p>
  if (query.isError) return <p className="epc-error" role="alert">{getError(query.error)}</p>
  const names = { SERVICE_CREATED: 'Khai báo dịch vụ', SERVICE_UPDATED: 'Cập nhật dịch vụ', TARIFF_CREATED: 'Thêm biểu phí', TARIFF_RETIRED: 'Ngừng áp dụng biểu phí' }
  return <ol className="epc-timeline">{query.data.length ? query.data.map(item => <li key={item.id}><span className="epc-timeline-dot" /><div><strong>{names[item.action] || item.action}</strong><time>{new Date(item.createdAt).toLocaleString('vi-VN')}</time>{item.action === 'TARIFF_CREATED' && <small>{money(item.after.amount)} / {labels.unit[item.after.unit]}</small>}</div></li>) : <li className="epc-muted">Chưa có thay đổi do quản trị viên ghi nhận.</li>}</ol>
}

function ServiceWorkspace({ service, today, management, tab, onTab, onClose, onEdit, onAddTariff, onRetire, onRegister, notice }) {
  const id = useId()
  const tabs = [['conditions', 'Điều kiện sử dụng'], ...(management ? [['tariffs', 'Biểu phí'], ['history', 'Lịch sử']] : [])]
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
        {management && <div className="epc-workspace-tools">
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
        </div>}
      </aside>
    </div>
    <footer className="epc-workspace-footer"><span><span className="epc-workspace-footer-mark"><ShieldCheck size={15} /></span>Thông tin theo danh mục hiện hành</span><div className="epc-workspace-footer-actions"><button type="button" className="epc-button secondary" onClick={onClose}>Đóng chi tiết</button></div></footer>
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
  const [activeSection, setActiveSection] = useState('orders') // 'orders' | 'register'
  const canDraft = !management && ['transport company', 'carrier', 'carrier staff'].includes(account?.role?.trim().toLowerCase())
  const services = query.data?.services || []
  const today = query.data?.asOf || ''
  const selected = services.find(service => service.id === selectedId)
  const filtered = services.filter(service => (!search || `${service.name} ${service.code} ${service.description}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) && (direction === 'ALL' || service.direction === direction) && (status === 'ALL' || service.isActive === (status === 'ACTIVE')))
  const ready = services.filter(service => service.isActive && liveRates(service, today).length)

  // Orders list state (merged from ServiceOrdersPage)
  const [params, setParams] = useSearchParams()
  const session = draftSession()
  const selectedOrderId = params.get('order') || params.get('orderId')
  const [orderSearch, setOrderSearch] = useState('')
  const [orderTerm, setOrderTerm] = useState('')
  const [orderStatus, setOrderStatus] = useState('')
  const [orderPaymentStatus, setOrderPaymentStatus] = useState('')
  const [orderFlow, setOrderFlow] = useState('')
  const [orderPage, setOrderPage] = useState(1)
  const [orderEditing, setOrderEditing] = useState(null)
  const [orderReviewing, setOrderReviewing] = useState(null)
  useEffect(() => { const timer = setTimeout(() => { setOrderTerm(orderSearch.trim()); setOrderPage(1) }, 280); return () => clearTimeout(timer) }, [orderSearch])
  const orderFilters = { search: orderTerm || undefined, status: orderStatus || undefined, paymentStatus: orderPaymentStatus || undefined, flow: orderFlow || undefined, page: orderPage, pageSize: 10 }
  const ordersQuery = useQuery({ queryKey: [...serviceOrderKey, session, 'list', orderFilters], queryFn: () => serviceOrdersApi.list(orderFilters), retry: false, enabled: canDraft, refetchInterval: activeSection === 'orders' ? 10000 : false })
  const ordersTotal = ordersQuery.data?.total || 0
  const ordersPages = Math.max(1, Math.ceil(ordersTotal / 10))
  const orderItems = ordersQuery.data?.items || []
  const ordersHasFilter = !!(orderSearch || orderStatus || orderPaymentStatus || orderFlow)
  const catalogForOrders = useQuery({ queryKey: ['eport-service-catalog', session, 'orders'], queryFn: catalogApi.list, enabled: !!orderEditing, retry: false })
  const chooseOrder = id => setParams(prev => { const next = new URLSearchParams(prev); ['orderId', 'code', 'status', 'cancel', 'id'].forEach(k => next.delete(k)); if (id) next.set('order', id); else next.delete('order'); return next })
  const refreshOrders = async () => { await Promise.all([client.invalidateQueries({ queryKey: serviceOrderKey }), client.invalidateQueries({ queryKey: serviceDraftKey })]) }
  const orderEditDraft = id => { chooseOrder(null); setOrderReviewing(null); setOrderEditing(id) }
  const orderReviewDraft = id => { chooseOrder(null); setOrderEditing(null); setOrderReviewing(id) }
  const orderChangeFilter = (setter, value) => { setter(value); setOrderPage(1) }

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
    await refreshOrders()
    setNotice(`Đã lưu bản nháp ${draft.number || ''}.`)
  }
  const reviewDraft = draftId => { setDraftDialog(null); setShowDraftList(false); setRegistrationReview(draftId); setNotice('') }
  const editDraft = draftId => { setRegistrationReview(null); setShowDraftList(false); setDraftDialog({ draftId }) }
  const registered = async registration => {
    setNotice(`Đã ghi nhận đăng ký ${registration.number || ''}${registration.status === 'PENDING_APPROVAL' ? ' — Chờ cảng duyệt.' : ' — Đã xác nhận.'}`)
    await refreshOrders()
  }

  const importService = services.find(s => s.code === 'IMPORT_PICKUP' && s.isActive) || services.find(s => s.code === 'IMPORT_PICKUP')
  const exportService = services.find(s => s.code === 'EXPORT_DROPOFF' && s.isActive) || services.find(s => s.code === 'EXPORT_DROPOFF')

  return (
    <div className={`epc ${motionPaused ? 'epc-motion-paused' : ''}`}>
      <div className="epc-page-header">
        <div>
          <div className="epc-breadcrumb">
            {management ? 'Quản trị' : 'Cổng doanh nghiệp'}
            <span>/</span>
            {management ? 'Danh mục dịch vụ & Biểu phí' : 'Đăng ký giao nhận'}
          </div>
          <h1>{management ? 'Danh mục & biểu phí' : 'Đăng Ký Giao Nhận (ePort)'}</h1>
          <p>
            {management
              ? 'Quản lý danh mục dịch vụ và đơn giá theo từng thời gian áp dụng.'
              : 'Hệ thống tiếp nhận và giải quyết thủ tục giao nhận container hàng xuất và nhập khẩu trực tuyến.'}
          </p>
        </div>
        {management ? (
          <button type="button" className="epc-button primary" onClick={() => setModal({ type: 'service' })}>
            <Plus size={18} />Thêm dịch vụ
          </button>
        ) : canDraft ? (
          <span className="epc-header-label">
            <ShieldCheck size={16} />Đăng ký giao nhận ePort
          </span>
        ) : (
          <span className="epc-header-label">
            <ShieldCheck size={16} />Thông tin dịch vụ & đơn giá
          </span>
        )}
      </div>

      <section className="epc-hero" aria-labelledby="epc-hero-title">
        <div className="epc-hero-grid" aria-hidden="true" />
        <button
          type="button"
          className="epc-motion-control"
          onClick={() => setMotionPaused(paused => !paused)}
          aria-label={motionPaused ? 'Bật hiệu ứng chuyển động' : 'Tạm dừng hiệu ứng chuyển động'}
        >
          {motionPaused ? <Play size={13} /> : <Pause size={13} />}
          <span>{motionPaused ? 'Bật chuyển động' : 'Chuyển động'}</span>
        </button>
        <div className="epc-hero-content">
          <div className="epc-hero-brand"><span />NEXUSPORT E-PORT</div>
          <h2 id="epc-hero-title">
            {management ? 'Một danh mục rõ ràng.' : 'Đăng ký giao nhận trực tuyến.'}
            <span>{management ? 'Mỗi đơn giá có căn cứ.' : 'Chuẩn hóa quy trình cảng biển.'}</span>
          </h2>
          <p>
            {management
              ? 'Thiết lập dịch vụ và thời gian hiệu lực. Giữ lịch sử cho mỗi lần cập nhật.'
              : 'Giao container hàng nhập (lệnh eDO điện tử, VASSCM) và Hạ container hàng xuất (eBooking liên kết, khai báo cont).'}
          </p>
          <div className="epc-hero-stats" aria-label="Tổng quan dịch vụ">
            <div>
              <strong>02</strong>
              <span>Tác nghiệp chính (Xuất & Nhập)</span>
            </div>
            <div>
              <strong>Cổng thanh toán VietQR 24/7</strong>
              <span>Cổng thanh toán điện tử</span>
            </div>
            <div>
              <strong>VASSCM</strong>
              <span>Hải quan điện tử</span>
            </div>
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

      {/* SECTION TABS: Điều hướng giữa 2 phần */}
      {!management && canDraft && (
        <div className="epc-section-tabs" role="tablist" aria-label="Chọn chế độ xem">
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'orders'}
            className={`epc-section-tab ${activeSection === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveSection('orders')}
          >
            <ClipboardList size={16} aria-hidden="true" />
            Đơn dịch vụ
            {ordersTotal > 0 && <span className="epc-tab-count">{ordersTotal}</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'register'}
            className={`epc-section-tab ${activeSection === 'register' ? 'active' : ''}`}
            onClick={() => setActiveSection('register')}
          >
            <Container size={16} aria-hidden="true" />
            Đăng ký dịch vụ
          </button>
        </div>
      )}

      {notice && !selected && (
        <div className="epc-success" role="status">
          <CheckCircle2 size={18} />{notice}
          <button type="button" aria-label="Đóng thông báo" onClick={() => setNotice('')}><X size={16} /></button>
        </div>
      )}

      {/* PORTAL FOR TRANSPORT COMPANY: CHỈ HIỂN THỊ DUY NHẤT 2 DỊCH VỤ XUẤT VÀ NHẬP */}
      {!management && query.isSuccess && activeSection === 'register' && (
        <section className="epc-eport-portal" aria-label="Hai dịch vụ xuất nhập khẩu">
          {/* Card 1: Giao container hàng nhập */}
          <article className="epc-portal-card import-card">
            <div>
              <header className="epc-portal-card-header">
                <div className="epc-portal-icon-wrapper">
                  <Truck size={30} strokeWidth={2} />
                </div>
                <Badge tone="blue">Hàng nhập · Import</Badge>
              </header>
              <h3>Giao container hàng nhập</h3>
              <p className="epc-portal-desc">
                Tác nghiệp bốc container hàng nhập ra khỏi cảng (lấy nguyên). Đăng ký lệnh giao hàng điện tử eDO,
                kiểm tra thông quan VASSCM cơ quan hải quan và điều động phương tiện xe/sà lan.
              </p>

              <div className="epc-portal-steps-box">
                <div className="epc-portal-steps-title">
                  <ShieldCheck size={14} />Quy trình 7 bước nghiệp vụ
                </div>
                <ul className="epc-portal-steps-list">
                  <li><span className="epc-portal-step-num">1</span>Khai báo lệnh giao nhận điện tử eDO & Xác thực email</li>
                  <li><span className="epc-portal-step-num">2</span>Khai báo container lấy nguyên (chì niêm phong HQ)</li>
                  <li><span className="epc-portal-step-num">3</span>Khai báo dịch vụ đính kèm (Lưu bãi, Cắm điện lạnh, Clone)</li>
                  <li><span className="epc-portal-step-num">4</span>Kiểm tra thông quan qua hệ thống VASSCM</li>
                  <li><span className="epc-portal-step-num">5</span>Khai báo giao nhận (Xe / Sà lan, Hạn lệnh)</li>
                  <li><span className="epc-portal-step-num">6</span>Gửi Dispatcher → Nhận thông báo → Thanh toán trực tuyến (VietQR)</li>
                  <li><span className="epc-portal-step-num">7</span>Hoàn tất: In phiếu giao nhận từng cont & Hóa đơn</li>
                </ul>
              </div>
            </div>

            <footer className="epc-portal-card-footer">
              <div className="epc-portal-price">
                <span>Xử lý đăng ký</span>
                {importService ? <Price service={importService} today={today} /> : <strong>Theo biểu phí cảng</strong>}
              </div>
              <button
                type="button"
                className="epc-portal-btn"
                disabled={!importService?.isActive}
                onClick={() => startDraft(importService?.id)}
              >
                <span>Đăng ký giao hàng nhập</span>
                <ArrowRight size={17} />
              </button>
            </footer>
          </article>

          {/* Card 2: Hạ container hàng xuất */}
          <article className="epc-portal-card export-card">
            <div>
              <header className="epc-portal-card-header">
                <div className="epc-portal-icon-wrapper">
                  <Container size={30} strokeWidth={2} />
                </div>
                <Badge tone="orange">Hàng xuất · Export</Badge>
              </header>
              <h3>Hạ container hàng xuất</h3>
              <p className="epc-portal-desc">
                Tác nghiệp hạ container hàng xuất vào bãi cảng chờ xếp tàu. Khai báo eBooking hãng tàu đã liên kết,
                khai báo danh sách container, seal, VGM, chỉ dẫn hàng lạnh/nguy hiểm và xe/sà lan giao nhận.
              </p>

              <div className="epc-portal-steps-box">
                <div className="epc-portal-steps-title">
                  <ShieldCheck size={14} />Quy trình 6 bước nghiệp vụ
                </div>
                <ul className="epc-portal-steps-list">
                  <li><span className="epc-portal-step-num">1</span>Khai báo eBooking & Xác thực email</li>
                  <li><span className="epc-portal-step-num">2</span>Khai báo Container (Thêm dòng, xóa dòng, seal, VGM, IMO/UN)</li>
                  <li><span className="epc-portal-step-num">3</span>Khai báo dịch vụ đính kèm & Clone dịch vụ</li>
                  <li><span className="epc-portal-step-num">4</span>Khai báo giao nhận (Xe / Sà lan, Hạn lệnh)</li>
                  <li><span className="epc-portal-step-num">5</span>Gửi Dispatcher → Nhận thông báo → Thanh toán trực tuyến (VietQR)</li>
                  <li><span className="epc-portal-step-num">6</span>Hoàn tất: In phiếu giao nhận từng cont & Hóa đơn</li>
                </ul>
              </div>
            </div>

            <footer className="epc-portal-card-footer">
              <div className="epc-portal-price">
                <span>Xử lý đăng ký</span>
                {exportService ? <Price service={exportService} today={today} /> : <strong>Theo biểu phí cảng</strong>}
              </div>
              <button
                type="button"
                className="epc-portal-btn"
                disabled={!exportService?.isActive}
                onClick={() => startDraft(exportService?.id)}
              >
                <span>Đăng ký hạ hàng xuất</span>
                <ArrowRight size={17} />
              </button>
            </footer>
          </article>
        </section>
      )}

      {/* ORDERS LIST SECTION: Danh sách đơn dịch vụ của doanh nghiệp */}
      {canDraft && activeSection === 'orders' && (
        <section className="epo-worklist" aria-labelledby="epo-list-title">
          <div className="epo-worklist-heading">
            <div>
              <span className="epo-caption">KHÔNG GIAN HỒ SƠ</span>
              <h2 id="epo-list-title">Danh sách đơn dịch vụ</h2>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="epo-result-count">{ordersQuery.isSuccess ? `${ordersTotal} hồ sơ` : 'Đang kết nối'}</span>
              <button type="button" className="epc-button secondary" disabled={ordersQuery.isFetching} onClick={refreshOrders}>
                <RefreshCw size={15} className={ordersQuery.isFetching ? 'epc-spin' : ''} />Làm mới
              </button>
            </div>
          </div>
          <div className="epo-filters">
            <div className="epc-search epo-search">
              <Search size={17} />
              <input aria-label="Tìm đơn dịch vụ" maxLength={100} placeholder="Mã đơn, Booking, dịch vụ hoặc container…" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
            </div>
            <label>
              <span className="epc-sr-only">Trạng thái đơn</span>
              <select value={orderStatus} onChange={e => orderChangeFilter(setOrderStatus, e.target.value)}>
                <option value="">Mọi trạng thái đơn</option>
                {Object.entries(orderStatusLabels).map(([v, l]) => <option value={v} key={v}>{l}</option>)}
              </select>
            </label>
            <label>
              <span className="epc-sr-only">Trạng thái thanh toán</span>
              <select value={orderPaymentStatus} onChange={e => orderChangeFilter(setOrderPaymentStatus, e.target.value)}>
                <option value="">Mọi thanh toán</option>
                {['UNPAID', 'PENDING', 'PAID', 'FAILED', 'NOT_REQUIRED'].map(v => <option key={v} value={v}>{paymentStatusLabels[v]}</option>)}
              </select>
            </label>
            <label>
              <span className="epc-sr-only">Luồng hàng</span>
              <select value={orderFlow} onChange={e => orderChangeFilter(setOrderFlow, e.target.value)}>
                <option value="">Mọi luồng hàng</option>
                <option value="EXPORT">Hàng xuất</option>
                <option value="IMPORT">Hàng nhập</option>
              </select>
            </label>
          </div>
          {ordersQuery.isPending ? (
            <div className="epo-empty" role="status"><Loader2 size={29} className="epc-spin" /><h3>Đang tải hồ sơ…</h3></div>
          ) : ordersQuery.isError ? (
            <div className="epo-empty"><FileText size={33} /><h3>Chưa tải được danh sách</h3><p role="alert">{draftError(ordersQuery.error)}</p><button type="button" className="epc-button secondary" onClick={() => ordersQuery.refetch()}><RefreshCw size={16} />Thử lại</button></div>
          ) : !orderItems.length ? (
            <div className="epo-empty">
              <Filter size={33} />
              <h3>{ordersHasFilter ? 'Không có hồ sơ phù hợp' : 'Chưa có đơn dịch vụ'}</h3>
              <p>{ordersHasFilter ? 'Thử điều chỉnh từ khóa hoặc bộ lọc để tìm lại hồ sơ.' : 'Bắt đầu từ danh mục, chọn dịch vụ và tạo đăng ký cho container của bạn.'}</p>
              {ordersHasFilter && <button type="button" className="epc-button secondary" onClick={() => { setOrderSearch(''); setOrderStatus(''); setOrderPaymentStatus(''); setOrderFlow(''); setOrderPage(1) }}>Xóa bộ lọc</button>}
            </div>
          ) : (
            <div className="epo-order-table" role="table" aria-label="Danh sách đơn dịch vụ">
              <div className="epo-table-head" role="row">
                <span role="columnheader">Hồ sơ / dịch vụ</span>
                <span role="columnheader">Nguồn / container</span>
                <span role="columnheader">Trạng thái xử lý</span>
                <span role="columnheader">Kết quả và cập nhật</span>
                <span role="columnheader" className="epc-sr-only">Chi tiết</span>
              </div>
              {orderItems.map((order, index) => (
                <button type="button" className="epo-order-row" role="row" key={order.id} data-flow={order.flow} onClick={() => chooseOrder(order.id)} aria-label={`Xem đơn ${order.number}`} aria-haspopup="dialog" style={{ '--epo-row': Math.min(index, 5) }}>
                  <span className="epo-order-identity" role="cell">
                    <span className={`epo-order-icon epo-order-icon--${(order.flow || 'other').toLowerCase()}`}><FileText size={19} /></span>
                    <span>
                      <strong>{order.number}</strong>
                      <span>{order.mainServiceName || 'Chưa chọn dịch vụ chính'}</span>
                    </span>
                  </span>
                  <span className={`epo-source epo-source--${(order.flow || 'other').toLowerCase()}`} role="cell">
                    <strong>{order.sourceLabel || 'Chưa chọn hồ sơ nguồn'}</strong>
                    <small><Container size={12} />{order.containerCount || 0} container<span>·</span>{order.flow === 'IMPORT' ? 'Hàng nhập' : 'Hàng xuất'}</small>
                  </span>
                  <span className="epo-order-status" role="cell">
                    <OrderBadge status={order.status} />
                    {order.paymentStatus && <small className={`epo-payment-label ${order.paymentReviewRequired ? 'orange' : statusTone(order.paymentStatus)}`}>{paymentStateLabel(order)}</small>}
                  </span>
                  <span className="epo-order-amount" role="cell">
                    <strong>{order.pricingStatus === 'AWAITING' ? 'Chờ Dispatcher trả phí' : order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Đã nhận kết quả'}</strong>
                    <small>{draftDateTime(order.updatedAt)}</small>
                  </span>
                  <span className="epo-open-arrow" role="cell"><ArrowUpRight size={17} /></span>
                </button>
              ))}
            </div>
          )}
          {ordersQuery.isSuccess && ordersTotal > 0 && (
            <div className="epo-pagination">
              <span>Trang {orderPage} / {ordersPages} · {ordersTotal} hồ sơ</span>
              <div>
                <button type="button" className="epc-icon-button" disabled={orderPage <= 1 || ordersQuery.isFetching} onClick={() => setOrderPage(v => v - 1)} aria-label="Trang trước"><ArrowDownToLine size={17} style={{ transform: 'rotate(90deg)' }} /></button>
                <button type="button" className="epc-icon-button" disabled={orderPage >= ordersPages || ordersQuery.isFetching} onClick={() => setOrderPage(v => v + 1)} aria-label="Trang sau"><ArrowUpFromLine size={17} style={{ transform: 'rotate(90deg)' }} /></button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ORDER DIALOGS */}
      {selectedOrderId && <ServiceOrderDetail key={`${session}:${selectedOrderId}`} orderId={selectedOrderId} initialTab={params.has('orderId') || params.get('tab') === 'payments' ? 'payments' : 'information'} onClose={() => chooseOrder(null)} onEdit={orderEditDraft} onReview={orderReviewDraft} />}
      {orderEditing && (
        catalogForOrders.isPending
          ? <div className="epo-loading-overlay" role="status"><Loader2 className="epc-spin" size={22} />Đang tải danh mục…<button type="button" onClick={() => setOrderEditing(null)}>Đóng</button></div>
          : catalogForOrders.isError
            ? <div className="epo-loading-overlay" role="alert"><p>{draftError(catalogForOrders.error)}</p><button type="button" className="epc-button secondary" onClick={() => catalogForOrders.refetch()}>Thử lại</button><button type="button" onClick={() => setOrderEditing(null)}>Đóng</button></div>
            : <ServiceDraftWizard key={orderEditing} draftId={orderEditing} services={catalogForOrders.data?.services || []} onClose={() => setOrderEditing(null)} onSaved={async draft => { setOrderEditing(null); setNotice(`Đã lưu bản nháp ${draft.number || ''}.`); await refreshOrders() }} onReview={draft => orderReviewDraft(draft.id)} />
      )}
      {orderReviewing && <ServiceRegistrationReview key={orderReviewing} draftId={orderReviewing} onClose={() => setOrderReviewing(null)} onEdit={orderEditDraft} onRegistered={async reg => { setOrderReviewing(null); await refreshOrders(); chooseOrder(reg.draftId || reg.id) }} />}

            {/* ADMIN MANAGEMENT VIEW: Quản lý danh mục & biểu phí toàn bộ dịch vụ */}
      {management && (
        query.isError ? (
          <section className="epc-load-error">
            <CircleHelp size={32} />
            <h2>Chưa tải được danh mục dịch vụ</h2>
            <p>{getError(query.error)}</p>
            <button type="button" className="epc-button secondary" onClick={() => query.refetch()}>
              <RefreshCw size={16} />Thử lại
            </button>
          </section>
        ) : query.isPending ? (
          <div className="epc-loading" aria-live="polite">
            <Loader2 className="epc-spin" size={28} />
            <p>Đang tải dịch vụ và biểu phí…</p>
          </div>
        ) : (
          <>
            <div className="epc-toolbar">
              <div
                className="epc-filters"
                aria-label="Lọc theo luồng hàng"
                style={{ '--filter-index': Object.keys(labels.direction).indexOf(direction) }}
              >
                <span className="epc-filter-indicator" aria-hidden="true" />
                {Object.entries(labels.direction).map(([value, label]) => {
                  const FilterIcon = directionIcons[value]
                  return (
                    <button
                      type="button"
                      key={value}
                      className={direction === value ? 'active' : ''}
                      aria-label={label}
                      aria-pressed={direction === value}
                      onClick={() => setDirection(value)}
                    >
                      <FilterIcon size={15} aria-hidden="true" />
                      <span>{label}</span>
                      <small>{services.filter(service => value === 'ALL' || service.direction === value).length}</small>
                    </button>
                  )
                })}
              </div>
              <div className="epc-search">
                <Search size={17} />
                <input
                  aria-label="Tìm dịch vụ"
                  placeholder="Tìm tên hoặc mã dịch vụ…"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />
              </div>
              <select
                className="epc-status-filter"
                aria-label="Lọc trạng thái dịch vụ"
                value={status}
                onChange={event => setStatus(event.target.value)}
              >
                <option value="ALL">Mọi trạng thái</option>
                <option value="ACTIVE">Đang cung cấp</option>
                <option value="PAUSED">Tạm ngừng</option>
              </select>
            </div>
            <div className="epc-layout">
              <section className="epc-catalog" aria-labelledby="epc-catalog-heading">
                <div className="epc-list-caption">
                  <h2 id="epc-catalog-heading" tabIndex={-1} data-catalog-heading>Danh sách dịch vụ</h2>
                  <span>{filtered.length} dịch vụ</span>
                </div>
                {!filtered.length ? (
                  <div className="epc-empty">
                    <Search size={28} />
                    <h3>Không có dịch vụ phù hợp</h3>
                    <p>Thử một từ khóa hoặc bộ lọc khác.</p>
                    <button
                      type="button"
                      className="epc-button secondary"
                      onClick={() => { setSearch(''); setDirection('ALL'); setStatus('ALL') }}
                    >
                      Xóa bộ lọc
                    </button>
                  </div>
                ) : (
                  <div className="epc-table-wrap">
                    <table className="epc-table">
                      <thead>
                        <tr>
                          <th>Dịch vụ</th>
                          <th>Đơn vị / luồng</th>
                          <th>Đơn giá hiện tại</th>
                          <th><span className="epc-sr-only">Thao tác</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(service => (
                          <tr key={service.id}>
                            <td>
                              <button
                                type="button"
                                className="epc-service-link"
                                onClick={() => choose(service.id)}
                                aria-haspopup="dialog"
                              >
                                <ServiceIcon service={service} size={21} />
                                <span>
                                  <strong>{service.name}</strong>
                                  <small>{service.code}</small>
                                  <Badge tone={service.isActive ? 'green' : 'neutral'}>
                                    {service.isActive ? 'Đang cung cấp' : 'Tạm ngừng'}
                                  </Badge>
                                </span>
                              </button>
                            </td>
                            <td>
                              <span>{labels.unit[service.unit]}</span>
                              <small>{labels.direction[service.direction]}</small>
                            </td>
                            <td>
                              <Price service={service} today={today} />
                              <small>{liveRates(service, today).length} biểu phí hiệu lực</small>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="epc-icon-button"
                                aria-label={`Chỉnh sửa ${service.name}`}
                                onClick={() => setModal({ type: 'service', service })}
                              >
                                <Pencil size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="epc-footnote">
                  <CircleHelp size={17} />
                  <p>Đơn giá phụ thuộc kích thước, nhóm container và thời gian hiệu lực. Nhấp vào dịch vụ để xem biểu phí chi tiết.</p>
                </div>
              </section>
            </div>
          </>
        )
      )}

      {selected && (
        <ServiceWorkspace
          key={selected.id}
          service={selected}
          today={today}
          management={management}
          tab={tab}
          onTab={setTab}
          onClose={() => setSelectedId(null)}
          onEdit={() => setModal({ type: 'service', service: selected })}
          onAddTariff={() => setModal({ type: 'tariff', service: selected })}
          onRetire={tariff => { retire.reset(); setConfirmRetire({ serviceId: selected.id, tariff }) }}
          onRegister={canDraft ? () => startDraft(selected.id) : null}
          notice={notice}
        />
      )}

      {canDraft && showDraftList && (
        <ServiceDraftList
          onClose={() => setShowDraftList(false)}
          onCreate={() => startDraft()}
          onEdit={editDraft}
          onReview={reviewDraft}
        />
      )}

      {canDraft && draftDialog && (
        <ServiceDraftWizard
          key={draftDialog.draftId || 'new'}
          services={services}
          initialServiceId={draftDialog.initialServiceId}
          draftId={draftDialog.draftId}
          onClose={() => setDraftDialog(null)}
          onSaved={draftSaved}
          onReview={draft => reviewDraft(draft.id)}
        />
      )}

      {canDraft && registrationReview && (
        <ServiceRegistrationReview
          key={registrationReview}
          draftId={registrationReview}
          onClose={() => setRegistrationReview(null)}
          onEdit={editDraft}
          onRegistered={registered}
        />
      )}

      {modal?.type === 'service' && (
        <ServiceForm
          service={modal.service}
          onClose={() => setModal(null)}
          onSaved={updated}
        />
      )}

      {modal?.type === 'tariff' && (
        <TariffForm
          service={modal.service}
          today={today}
          onClose={() => setModal(null)}
          onSaved={updated}
        />
      )}

      {confirmRetire && (
        <Modal
          title="Ngừng áp dụng biểu phí?"
          description="Lịch sử giá vẫn được giữ lại. Biểu phí này sẽ không còn được dùng để dự tính mới."
          onClose={() => { setConfirmRetire(null); retire.reset() }}
        >
          <div className="epc-confirm-body">
            <strong>{money(confirmRetire.tariff.amount)} / {labels.unit[confirmRetire.tariff.unit]}</strong>
            <p>{labels.size[confirmRetire.tariff.size]} · {labels.equipment[confirmRetire.tariff.equipment]}</p>
            {retire.error && <div className="epc-error" role="alert">{getError(retire.error)}</div>}
          </div>
          <footer>
            <button type="button" className="epc-button secondary" onClick={() => setConfirmRetire(null)}>Giữ biểu phí</button>
            <button type="button" className="epc-button destructive" disabled={retire.isPending} onClick={() => retire.mutate(confirmRetire)}>
              {retire.isPending && <Loader2 size={16} className="epc-spin" />}Ngừng áp dụng
            </button>
          </footer>
        </Modal>
      )}
    </div>
  )
}
