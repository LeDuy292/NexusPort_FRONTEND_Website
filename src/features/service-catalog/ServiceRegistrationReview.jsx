import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CalendarDays, Check, CheckCircle2, ClipboardCheck, Container, FileText, Info, Loader2, LockKeyhole, Pencil, ReceiptText, RefreshCw, ShieldCheck, X } from 'lucide-react'
import CatalogDialog from './CatalogDialog'
import { labels, money } from './catalogApi'
import { draftDateTime, draftError, draftSession, serviceDraftKey, serviceDraftsApi } from './serviceDraftsApi'

const quantity = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)
const statusLabel = status => status === 'PENDING_APPROVAL' ? 'Chờ cảng duyệt' : status === 'CONFIRMED' ? 'Đã xác nhận' : status === 'READY' ? 'Đủ điều kiện xác nhận' : 'Cần bổ sung thông tin'
const paymentLabel = status => status === 'NOT_REQUIRED' ? 'Không phát sinh tiền dịch vụ' : 'Chưa thanh toán'

function FeeLines({ fees }) {
  if (!fees.length) return <div className="epr-fees-empty"><ReceiptText size={27} /><p>Chưa có dòng phí. Bổ sung container và dịch vụ để tính tiền.</p></div>
  return <div className="epr-fee-table" role="table" aria-label="Các dòng phí đăng ký">
    <div className="epr-fee-head" role="row"><span role="columnheader">Container / Dịch vụ</span><span role="columnheader">Số lượng</span><span role="columnheader">Đơn giá</span><span role="columnheader">Thành tiền</span></div>
    {fees.map((fee, index) => <div className={`epr-fee-row ${fee.amount == null ? 'unpriced' : ''}`} role="row" key={`${fee.sourceContainerId}-${fee.serviceId}-${index}`}>
      <div className="epr-fee-description" role="cell"><span className="epr-container-number"><Container size={13} />{fee.containerNumber || 'Container đã chọn'}</span><strong>{fee.serviceName || fee.serviceCode || 'Dịch vụ đã chọn'}</strong><small>{labels.size[fee.size] || fee.size || 'Chưa rõ kích thước'} · {labels.equipment[fee.equipment] || fee.equipment || 'Chưa rõ nhóm'}</small>{(fee.startsAt || fee.endsAt) && <small className="epr-usage-time"><CalendarDays size={12} />{draftDateTime(fee.startsAt)} → {draftDateTime(fee.endsAt)}</small>}{fee.billingNote && <small className="epr-billing-note">{fee.billingNote}</small>}{fee.pricingDate && <small>Ngày áp dụng giá: {new Date(`${fee.pricingDate.slice(0, 10)}T12:00:00`).toLocaleDateString('vi-VN')}</small>}</div>
      <div className="epr-fee-value" role="cell"><span className="epr-mobile-label">Số lượng</span><strong>{fee.quantity == null ? '—' : quantity(fee.quantity)}</strong><small>{labels.unit[fee.unit] || fee.unit}</small></div>
      <div className="epr-fee-value" role="cell"><span className="epr-mobile-label">Đơn giá</span><strong>{fee.unitPrice == null ? 'Chưa có giá' : money(fee.unitPrice)}</strong></div>
      <div className="epr-fee-value epr-fee-amount" role="cell"><span className="epr-mobile-label">Thành tiền</span><strong>{fee.amount == null ? 'Chưa xác định' : money(fee.amount)}</strong></div>
    </div>)}
  </div>
}

function Issues({ issues, fees, containers, confirmed }) {
  const errors = issues.filter(issue => issue.severity === 'ERROR')
  const warnings = issues.filter(issue => issue.severity !== 'ERROR')
  const context = issue => {
    const fee = fees.find(row => row.sourceContainerId === issue.sourceContainerId && (!issue.serviceId || row.serviceId === issue.serviceId))
    const container = containers.find(row => row.sourceContainerId === issue.sourceContainerId)
    return [fee?.containerNumber || container?.containerNumber, issue.serviceId ? fee?.serviceName : null].filter(Boolean).join(' · ')
  }
  return <section className="epr-issue-section" aria-label="Kết quả kiểm tra điều kiện">
    <div className="epr-section-heading"><ShieldCheck size={18} /><h3>Điều kiện đăng ký</h3><span>{errors.length ? `${errors.length} cần xử lý` : 'Đã kiểm tra'}</span></div>
    {!issues.length ? <div className="epr-all-clear"><CheckCircle2 size={21} /><div><strong>Hồ sơ đáp ứng các kiểm tra đăng ký</strong><p>{confirmed ? 'Kết quả kiểm tra được lưu cùng hồ sơ tại thời điểm xác nhận.' : 'Kiểm tra thông tin và các dòng phí trước khi xác nhận.'}</p></div></div> : <>
      {[...errors, ...warnings].map((issue, index) => <div className={`epr-issue ${issue.severity === 'ERROR' ? 'error' : 'warning'}`} key={`${issue.code}-${issue.sourceContainerId}-${issue.serviceId}-${index}`}>
        {issue.severity === 'ERROR' ? <AlertCircle size={18} /> : <Info size={18} />}<div>{context(issue) && <small>{context(issue)}</small>}<p>{issue.message}</p></div>
      </div>)}
    </>}
  </section>
}

export default function ServiceRegistrationReview({ draftId, onClose, onEdit, onRegistered }) {
  const id = useId()
  const client = useQueryClient()
  const [accepted, setAccepted] = useState(false)
  const [stale, setStale] = useState(false)
  const [savedRegistration, setSavedRegistration] = useState(null)
  const bodyRef = useRef(null)
  const session = draftSession()
  const query = useQuery({
    queryKey: [...serviceDraftKey, session, 'review', draftId],
    queryFn: async () => {
      const draft = await serviceDraftsApi.get(draftId)
      if (draft.registrationId || (draft.status && draft.status !== 'DRAFT')) return { draft, registration: await serviceDraftsApi.registration(draftId) }
      return { draft, check: await serviceDraftsApi.validate(draftId, { expectedVersion: draft.version }) }
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  })
  const draft = query.data?.draft
  const check = query.data?.check
  const registration = savedRegistration || query.data?.registration || check?.registration
  const content = registration?.content || check?.content || draft || {}
  const fees = registration?.fees || check?.fees || []
  const issues = registration?.issues || check?.issues || []
  const containers = registration?.containers || check?.containers || draft?.containers || []
  const source = registration?.sourceSnapshot || check?.sourceSnapshot || draft?.sourceSnapshot || {}
  const total = registration?.total ?? check?.total
  const state = registration?.status || check?.status || 'INCOMPLETE'
  const confirmed = !!registration
  const pendingApproval = state === 'PENDING_APPROVAL' || !!check?.requiresApproval || fees.some(fee => fee.requiresApproval)
  const canConfirm = !confirmed && !!check?.canConfirm && !!check?.quoteToken && !stale && !query.isFetching
  useEffect(() => { setAccepted(false) }, [check?.quoteToken])
  useEffect(() => { if (registration?.id) bodyRef.current?.scrollTo({ top: 0, behavior: 'instant' }) }, [registration?.id])
  const confirm = useMutation({
    mutationFn: () => serviceDraftsApi.confirm(draftId, { expectedVersion: check.draftVersion, quoteToken: check.quoteToken }),
    onSuccess: async result => {
      setSavedRegistration(result)
      setAccepted(false)
      await client.invalidateQueries({ queryKey: serviceDraftKey, refetchType: 'none' })
      onRegistered?.(result)
    },
    onError: error => { if (error?.response?.status === 409 || error?.response?.status === 422) { setStale(true); setAccepted(false) } },
  })
  const requestClose = () => { if (!confirm.isPending) onClose() }
  const refresh = async () => { confirm.reset(); setAccepted(false); setStale(false); await query.refetch() }
  const sourceLabel = content.flow === 'IMPORT' ? content.source?.referenceNumber || source.referenceNumber : source.bookingNumber

  return <CatalogDialog className="epd-dialog epr-dialog" labelledBy={`${id}-title`} describedBy={`${id}-description`} onClose={requestClose}>
    <header className="epd-header"><div><span className="epc-eyebrow">NEXUSPORT / XÁC NHẬN DỊCH VỤ</span><h2 id={`${id}-title`} tabIndex={-1} data-dialog-initial-focus>{confirmed ? 'Hồ sơ đăng ký dịch vụ' : 'Kiểm tra & xác nhận đăng ký'}</h2><p id={`${id}-description`}>{confirmed ? 'Thông tin đăng ký và đơn giá được lưu tại thời điểm xác nhận.' : 'Đối chiếu điều kiện, xem từng dòng phí rồi xác nhận hồ sơ.'}</p></div><button type="button" className="epc-icon-button" aria-label="Đóng kiểm tra đăng ký" disabled={confirm.isPending} onClick={requestClose}><X size={21} /></button></header>
    <div className="epd-body epr-body" ref={bodyRef} aria-busy={query.isFetching || confirm.isPending}>
      {query.isPending ? <div className="epd-loading" role="status"><Loader2 size={23} className="epc-spin" />Đang kiểm tra hồ sơ và tính các dòng phí…</div> : query.isError ? <div className="epd-empty"><AlertCircle size={32} /><h3>Chưa kiểm tra được hồ sơ</h3><p>{draftError(query.error)}</p><button type="button" className="epc-button secondary" onClick={refresh}><RefreshCw size={16} />Thử lại</button></div> : <>
        <div className={`epr-state-banner ${confirmed ? 'confirmed' : check?.canConfirm ? 'ready' : 'incomplete'}`} role="status">
          <span className="epr-state-icon">{confirmed ? <LockKeyhole size={25} /> : check?.canConfirm ? <ClipboardCheck size={27} /> : <AlertCircle size={26} />}</span><div><span className="epr-status-label">{statusLabel(state)}</span><strong>{confirmed ? registration.number : draft?.number}</strong><p>{confirmed ? `Xác nhận lúc ${draftDateTime(registration.confirmedAt)}` : `Kiểm tra lúc ${draftDateTime(check?.checkedAt)}`}</p></div>{confirmed && <span className="epr-payment-badge">{paymentLabel(registration.paymentStatus)}</span>}
        </div>
        <div className="epr-layout">
          <div className="epr-main">
            <section className="epr-facts-card" aria-label="Thông tin hồ sơ đăng ký"><div className="epr-section-heading"><FileText size={18} /><h3>Thông tin đăng ký</h3></div><dl className="epr-facts"><div><dt>Luồng hàng</dt><dd>{labels.direction[content.flow] || 'Chưa chọn'}</dd></div><div><dt>{content.flow === 'IMPORT' ? 'DO/eDO' : 'Booking'}</dt><dd>{sourceLabel || 'Chưa chọn hồ sơ nguồn'}</dd></div><div><dt>Dự kiến thực hiện</dt><dd>{draftDateTime(content.plannedAt)}</dd></div><div><dt>Người liên hệ</dt><dd>{[content.contactName, content.contactPhone].filter(Boolean).join(' · ') || 'Chưa khai báo'}</dd></div></dl></section>
            <Issues issues={issues} fees={fees} containers={containers} confirmed={confirmed} />
            <section className="epr-fees-card"><div className="epr-section-heading"><ReceiptText size={18} /><h3>Chi tiết phí dịch vụ</h3><span>{fees.length} dòng phí</span></div><FeeLines fees={fees} /><div className="epr-fee-footnote"><Info size={15} /><p>Phí dịch vụ bằng số lượng tính phí × đơn giá. Số tiền hiển thị chưa bao gồm thuế và các khoản ngoài danh mục.</p></div></section>
            {content.note && <section className="epr-note-card"><h3>Ghi chú đăng ký</h3><p>{content.note}</p></section>}
          </div>
          <aside className="epr-summary" aria-label="Số tiền đăng ký">
            <div className="epr-summary-title"><span><ReceiptText size={22} /></span><div><small>{confirmed ? 'ĐƠN GIÁ ĐÃ LƯU' : 'ĐỐI CHIẾU CHI PHÍ'}</small><h3>{confirmed ? 'Giá trị đăng ký' : 'Tổng phí dịch vụ'}</h3></div></div>
            <div className="epr-total"><small>Chưa bao gồm thuế · VND</small><strong>{total == null ? 'Chưa xác định' : money(total)}</strong></div>
            <dl className="epr-summary-facts"><div><dt>Container</dt><dd>{containers.length || content.lines?.length || 0}</dd></div><div><dt>Dòng phí</dt><dd>{fees.length}</dd></div><div><dt>Trạng thái</dt><dd>{statusLabel(state)}</dd></div>{confirmed && <div><dt>Thanh toán</dt><dd>{paymentLabel(registration.paymentStatus)}</dd></div>}</dl>
            {!confirmed && total == null && <p className="epr-partial">{check?.subtotal == null ? 'Chưa thể hiển thị số tiền. Kiểm tra lại biểu phí và số lượng theo thông báo của hồ sơ.' : <>Các dòng đã xác định: <strong>{money(check.subtotal)}</strong>. Đây chưa phải tổng tiền đăng ký.</>}</p>}
            {confirmed ? <div className="epr-lock-note"><LockKeyhole size={17} /><p>Đơn giá và dòng phí đã được lưu cùng hồ sơ. Biểu phí thay đổi sau đó không làm đổi số tiền này.</p></div> : <div className="epr-lock-note"><ShieldCheck size={17} /><p>Khi xác nhận, hệ thống kiểm tra lại hồ sơ và lưu đơn giá áp dụng cho từng dịch vụ.</p></div>}
            {pendingApproval && <div className="epr-approval-note"><Info size={16} /><p>{confirmed ? <>Hồ sơ đang <strong>Chờ cảng duyệt</strong>. Cảng cần kiểm tra các điều kiện tác nghiệp trước khi thực hiện.</> : <>Hồ sơ có dịch vụ cần cảng xem xét. Xác nhận sẽ lưu trạng thái <strong>Chờ cảng duyệt</strong>.</>}</p></div>}
            {!confirmed && canConfirm && <label className="epr-accept"><input type="checkbox" checked={accepted} disabled={confirm.isPending} onChange={event => setAccepted(event.target.checked)} /><span>Tôi đã kiểm tra hồ sơ và đồng ý với các dòng phí trên.</span></label>}
          </aside>
        </div>
        <div className="epr-scope-note"><Info size={17} /><p>{confirmed ? 'Xác nhận đăng ký ghi nhận hồ sơ và phí dịch vụ. Tình trạng thanh toán, phê duyệt và điều kiện giao nhận được theo dõi riêng.' : 'Hồ sơ còn thiếu thông tin vẫn được giữ ở bản nháp. Bạn có thể quay lại chỉnh sửa và kiểm tra lại.'}</p></div>
        {confirm.error && <div className="epc-error" role="alert">{draftError(confirm.error)}{stale && <p>Thông tin hoặc biểu phí có thể đã thay đổi. Nhấn <strong>Kiểm tra lại</strong>, xem lại kết quả và số tiền trước khi xác nhận.</p>}</div>}
      </>}
    </div>
    <footer className="epd-footer epr-footer"><div>{!confirmed && !query.isPending && <button type="button" className="epc-button secondary" disabled={confirm.isPending} onClick={() => onEdit(draftId)}><Pencil size={15} />Chỉnh sửa bản nháp</button>}</div><div>{!confirmed && !query.isPending && <button type="button" className="epc-button secondary" disabled={query.isFetching || confirm.isPending} onClick={refresh}><RefreshCw size={15} className={query.isFetching ? 'epc-spin' : ''} />Kiểm tra lại</button>}{confirmed ? <button type="button" className="epc-button primary" onClick={requestClose}><Check size={16} />Hoàn tất</button> : <button type="button" className="epc-button primary" disabled={!canConfirm || !accepted || confirm.isPending} onClick={() => confirm.mutate()}>{confirm.isPending ? <Loader2 size={16} className="epc-spin" /> : <CheckCircle2 size={16} />}Xác nhận đăng ký</button>}</div></footer>
  </CatalogDialog>
}
