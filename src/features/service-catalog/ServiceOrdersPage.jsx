import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ArrowUpRight, ClipboardList, Container, FileText, Filter, Loader2, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { catalogApi, money } from './catalogApi'
import { draftDateTime, draftError, draftSession, serviceDraftKey } from './serviceDraftsApi'
import { orderStatusLabels, paymentStateLabel, paymentStatusLabels, serviceOrderKey, serviceOrdersApi, statusTone } from './serviceOrdersApi'
import OrderBadge from './ServiceOrderBadge'
import ServiceOrderDetail from './ServiceOrderDetail'
import ServiceDraftWizard from './ServiceDraftWizard'
import ServiceRegistrationReview from './ServiceRegistrationReview'
import './serviceCatalog.css'
import './serviceDrafts.css'
import './serviceRegistrations.css'
import './serviceOrders.css'

export default function ServiceOrdersPage() {
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('order') || params.get('orderId')
  const session = draftSession()
  let role = ''
  try { role = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}')?.role?.trim().toLowerCase() || '' } catch { /* The route handles invalid sessions. */ }
  const staff = ['dispatcher', 'administrator', 'admin'].includes(role)
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [status, setStatus] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [flow, setFlow] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const [reviewing, setReviewing] = useState(null)
  const [notice, setNotice] = useState('')
  useEffect(() => { const timer = setTimeout(() => { setTerm(search.trim()); setPage(1) }, 280); return () => clearTimeout(timer) }, [search])
  const filters = { search: term || undefined, status: status || undefined, paymentStatus: paymentStatus || undefined, flow: flow || undefined, page, pageSize: 10 }
  const query = useQuery({ queryKey: [...serviceOrderKey, session, 'list', filters], queryFn: () => serviceOrdersApi.list(filters), retry: false })
  const catalog = useQuery({ queryKey: ['eport-service-catalog', session, 'orders'], queryFn: catalogApi.list, enabled: !!editing, retry: false })
  const total = query.data?.total || 0
  const pages = Math.max(1, Math.ceil(total / 10))
  const items = query.data?.items || []
  const filtered = !!(search || status || paymentStatus || flow)
  const choose = id => setParams(previous => { const next = new URLSearchParams(previous); next.delete('orderId'); next.delete('code'); next.delete('status'); next.delete('cancel'); next.delete('id'); if (id) next.set('order', id); else next.delete('order'); return next })
  const changeFilter = (setter, value) => { setter(value); setPage(1) }
  const refresh = async () => {
    await Promise.all([client.invalidateQueries({ queryKey: serviceOrderKey }), client.invalidateQueries({ queryKey: serviceDraftKey })])
  }
  const editDraft = id => { choose(null); setReviewing(null); setEditing(id) }
  const reviewDraft = id => { choose(null); setEditing(null); setReviewing(id) }
  const saved = async draft => { setEditing(null); setNotice(`Đã lưu bản nháp ${draft.number || ''}.`); await refresh() }
  const registered = async registration => { setReviewing(null); await refresh(); choose(registration.draftId || registration.id) }

  return <div className="epc epo-page">
    <div className="epc-page-header"><div><div className="epc-breadcrumb">{staff ? 'Cổng nhân viên cảng' : 'Cổng doanh nghiệp'}<span>/</span>Đơn dịch vụ</div><h1>{staff ? 'Xử lý đơn dịch vụ' : 'Đơn dịch vụ của tôi'}</h1><p>{staff ? 'Tiếp nhận hồ sơ, ghi nhận quyết định và theo dõi thanh toán.' : 'Theo dõi đăng ký, thanh toán và quá trình xử lý tại cảng.'}</p></div><div className="epc-page-actions"><button type="button" className="epc-button secondary" disabled={query.isFetching} onClick={refresh}><RefreshCw size={16} className={query.isFetching ? 'epc-spin' : ''} />Làm mới</button>{!staff && <Link to="/services" className="epc-button primary"><Container size={17} />Đăng ký dịch vụ<ArrowUpRight size={16} /></Link>}</div></div>
    <section className="epo-hero" aria-labelledby="epo-hero-title"><div className="epo-hero-lines" aria-hidden="true" /><div className="epo-hero-copy"><span className="epo-brand"><span />NEXUSPORT E-PORT</span><h2 id="epo-hero-title">Mỗi hồ sơ.<br /><span>Một hành trình rõ ràng.</span></h2><p>{staff ? 'Mọi quyết định và giao dịch được lưu cùng đơn dịch vụ để khách hàng và cảng cùng theo dõi.' : 'Thông tin đăng ký, chi phí và lịch sử xử lý được kết nối trong cùng một hồ sơ.'}</p><span className="epo-hero-assurance"><ShieldCheck size={15} />Đơn giá đã xác nhận được giữ nguyên</span></div><div className="epo-hero-summary"><span className="epo-summary-icon"><ClipboardList size={28} /></span><span>HỒ SƠ {filtered ? 'PHÙ HỢP' : staff ? 'ĐÃ ĐĂNG KÝ' : 'CỦA DOANH NGHIỆP'}</span><strong>{query.isPending || query.isError ? '—' : new Intl.NumberFormat('vi-VN').format(total)}</strong><small>{staff ? 'Theo dõi tiếp nhận & thanh toán' : 'Từ bản nháp đến xác nhận'}</small></div></section>
    {notice && <div className="epc-success" role="status"><ShieldCheck size={17} />{notice}<button type="button" className="epc-icon-button" onClick={() => setNotice('')} aria-label="Đóng thông báo">×</button></div>}
    <section className="epo-worklist" aria-labelledby="epo-list-title">
      <div className="epo-worklist-heading"><div><span className="epo-caption">KHÔNG GIAN HỒ SƠ</span><h2 id="epo-list-title">{staff ? 'Danh sách xử lý' : 'Danh sách đơn dịch vụ'}</h2></div><span className="epo-result-count">{query.isSuccess ? `${total} hồ sơ` : 'Đang kết nối'}</span></div>
      <div className="epo-filters"><div className="epc-search epo-search"><Search size={17} /><input aria-label="Tìm đơn dịch vụ" maxLength={100} placeholder="Mã đơn, Booking, dịch vụ hoặc container…" value={search} onChange={event => setSearch(event.target.value)} /></div><label><span className="epc-sr-only">Trạng thái đơn</span><select value={status} onChange={event => changeFilter(setStatus, event.target.value)}><option value="">Mọi trạng thái đơn</option>{Object.entries(orderStatusLabels).filter(([value]) => !staff || value !== 'DRAFT').map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span className="epc-sr-only">Trạng thái thanh toán</span><select value={paymentStatus} onChange={event => changeFilter(setPaymentStatus, event.target.value)}><option value="">Mọi thanh toán</option>{['UNPAID', 'PENDING', 'PAID', 'FAILED', 'NOT_REQUIRED'].map(value => <option key={value} value={value}>{paymentStatusLabels[value]}</option>)}</select></label><label><span className="epc-sr-only">Luồng hàng</span><select value={flow} onChange={event => changeFilter(setFlow, event.target.value)}><option value="">Mọi luồng hàng</option><option value="EXPORT">Hàng xuất</option><option value="IMPORT">Hàng nhập</option></select></label></div>
      {query.isPending ? <div className="epo-empty" role="status"><Loader2 size={29} className="epc-spin" /><h3>Đang tải hồ sơ…</h3></div> : query.isError ? <div className="epo-empty"><FileText size={33} /><h3>Chưa tải được danh sách</h3><p role="alert">{draftError(query.error)}</p><button type="button" className="epc-button secondary" onClick={() => query.refetch()}><RefreshCw size={16} />Thử lại</button></div> : !items.length ? <div className="epo-empty"><Filter size={33} /><h3>{filtered ? 'Không có hồ sơ phù hợp' : 'Chưa có đơn dịch vụ'}</h3><p>{filtered ? 'Thử điều chỉnh từ khóa hoặc bộ lọc để tìm lại hồ sơ.' : staff ? 'Đơn đã xác nhận của khách hàng sẽ xuất hiện tại đây.' : 'Bắt đầu từ danh mục, chọn dịch vụ và tạo đăng ký cho container của bạn.'}</p>{filtered ? <button type="button" className="epc-button secondary" onClick={() => { setSearch(''); setStatus(''); setPaymentStatus(''); setFlow(''); setPage(1) }}>Xóa bộ lọc</button> : !staff && <Link to="/services" className="epc-button primary">Khám phá dịch vụ<ArrowRight size={16} /></Link>}</div> : <div className="epo-order-table" role="table" aria-label="Danh sách đơn dịch vụ"><div className="epo-table-head" role="row"><span role="columnheader">Hồ sơ / dịch vụ</span><span role="columnheader">Nguồn / container</span><span role="columnheader">Trạng thái xử lý</span><span role="columnheader">Giá trị đăng ký</span><span role="columnheader" className="epc-sr-only">Chi tiết</span></div>{items.map((order, index) => <button type="button" className="epo-order-row" role="row" key={order.id} onClick={() => choose(order.id)} aria-label={`Xem đơn ${order.number}`} aria-haspopup="dialog" style={{ '--epo-row': Math.min(index, 5) }}><span className="epo-order-identity" role="cell"><span className="epo-order-icon"><FileText size={19} /></span><span><strong>{order.number}</strong><span>{order.mainServiceName || 'Chưa chọn dịch vụ chính'}</span>{staff && <small>{order.companyName || 'Doanh nghiệp đăng ký'}</small>}</span></span><span className="epo-source" role="cell"><strong>{order.sourceLabel || 'Chưa chọn hồ sơ nguồn'}</strong><small><Container size={12} />{order.containerCount || 0} container<span>·</span>{order.flow === 'IMPORT' ? 'Hàng nhập' : 'Hàng xuất'}</small></span><span className="epo-order-status" role="cell"><OrderBadge status={order.status} />{order.paymentStatus && <small className={`epo-payment-label ${order.paymentReviewRequired ? 'orange' : statusTone(order.paymentStatus)}`}>{paymentStateLabel(order)}</small>}</span><span className="epo-order-amount" role="cell"><strong>{order.total == null ? 'Chưa xác định' : money(order.total)}</strong><small>{draftDateTime(order.updatedAt)}</small></span><span className="epo-open-arrow" role="cell"><ArrowUpRight size={17} /></span></button>)}</div>}
      {query.isSuccess && total > 0 && <div className="epo-pagination"><span>Trang {page} / {pages} · {total} hồ sơ</span><div><button type="button" className="epc-icon-button" disabled={page <= 1 || query.isFetching} onClick={() => setPage(value => value - 1)} aria-label="Trang trước"><ArrowLeft size={17} /></button><button type="button" className="epc-icon-button" disabled={page >= pages || query.isFetching} onClick={() => setPage(value => value + 1)} aria-label="Trang sau"><ArrowRight size={17} /></button></div></div>}
    </section>
    {selectedId && <ServiceOrderDetail key={`${session}:${selectedId}`} orderId={selectedId} initialTab={params.has('orderId') || params.get('tab') === 'payments' ? 'payments' : 'information'} onClose={() => choose(null)} onEdit={editDraft} onReview={reviewDraft} />}
    {editing && (catalog.isPending ? <div className="epo-loading-overlay" role="status"><Loader2 className="epc-spin" size={22} />Đang tải danh mục…<button type="button" onClick={() => setEditing(null)}>Đóng</button></div> : catalog.isError ? <div className="epo-loading-overlay" role="alert"><p>{draftError(catalog.error)}</p><button type="button" className="epc-button secondary" onClick={() => catalog.refetch()}>Thử lại</button><button type="button" onClick={() => setEditing(null)}>Đóng</button></div> : <ServiceDraftWizard key={editing} draftId={editing} services={catalog.data?.services || []} onClose={() => setEditing(null)} onSaved={saved} onReview={draft => reviewDraft(draft.id)} />)}
    {reviewing && <ServiceRegistrationReview key={reviewing} draftId={reviewing} onClose={() => setReviewing(null)} onEdit={editDraft} onRegistered={registered} />}
  </div>
}
