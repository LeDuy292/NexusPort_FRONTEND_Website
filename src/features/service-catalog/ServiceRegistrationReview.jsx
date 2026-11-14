import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertCircle, Check, CheckCircle2, ClipboardCheck, FileText, FolderOpen, Info, Loader2, LockKeyhole, Pencil, RefreshCw, ShieldCheck, X } from 'lucide-react'
import CatalogDialog from './CatalogDialog'
import ServiceReceiptButton from './ServiceRegistrationReceipt'
import { ServiceTripSummary } from './ServiceTripFleet'
import { FleetDocumentsReview } from './FleetDocumentsReview'
import { labels } from './catalogApi'
import { draftDateTime, draftError, draftSession, serviceDraftKey, serviceDraftsApi } from './serviceDraftsApi'
import { orderStatusLabels, paymentStatusLabels } from './serviceOrdersApi'

const statusLabel = status => orderStatusLabels[status] || (status === 'READY' ? 'Sẵn sàng gửi Dispatcher' : 'Cần bổ sung thông tin')
const paymentLabel = status => paymentStatusLabels[status] || 'Chưa thanh toán'

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
    {!errors.length && warnings.length > 0 && !confirmed && <p className="epd-muted">Các lưu ý dưới đây không chặn xác nhận đăng ký. Tích xác nhận thông tin ở cuối hồ sơ để gửi Dispatcher. Điều kiện giao nhận được cảng đối chiếu riêng.</p>}
    {!issues.length ? <div className="epr-all-clear"><CheckCircle2 size={21} /><div><strong>Hồ sơ đáp ứng các kiểm tra đăng ký</strong><p>{confirmed ? 'Kết quả kiểm tra được lưu cùng hồ sơ tại thời điểm xác nhận.' : 'Kiểm tra thông tin trước khi gửi Dispatcher.'}</p></div></div> : <>
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
      if (draft.registrationId) return { draft, registration: await serviceDraftsApi.registration(draftId) }
      if (draft.status && draft.status !== 'DRAFT') return { draft, closed: true }
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
  const state = registration?.status || check?.status || 'INCOMPLETE'
  const confirmed = !!registration
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
    <header className="epd-header"><div><span className="epc-eyebrow">NEXUSPORT / XÁC NHẬN DỊCH VỤ</span><h2 id={`${id}-title`} tabIndex={-1} data-dialog-initial-focus>{confirmed ? 'Hồ sơ đăng ký dịch vụ' : 'Kiểm tra & gửi đăng ký'}</h2><p id={`${id}-description`}>{confirmed ? 'Hồ sơ đã gửi. Bạn sẽ nhận thông báo thanh toán sau khi Dispatcher xác nhận và trả phí.' : 'Kiểm tra thông tin rồi gửi Dispatcher xác nhận và tính phí.'}</p></div><button type="button" className="epc-icon-button" aria-label="Đóng kiểm tra đăng ký" disabled={confirm.isPending} onClick={requestClose}><X size={21} /></button></header>
    <div className="epd-body epr-body" ref={bodyRef} aria-busy={query.isFetching || confirm.isPending}>
      {query.isPending ? <div className="epd-loading" role="status"><Loader2 size={23} className="epc-spin" />Đang kiểm tra hồ sơ đăng ký…</div> : query.data?.closed ? <div className="epd-empty"><LockKeyhole size={32} /><h3>{statusLabel(draft?.status)}</h3><p>Hồ sơ đã đóng và không thể tiếp tục xác nhận.</p><Link to={`/service-orders?order=${draftId}`} className="epc-button primary">Xem đơn dịch vụ</Link></div> : query.isError ? <div className="epd-empty"><AlertCircle size={32} /><h3>Chưa kiểm tra được hồ sơ</h3><p>{draftError(query.error)}</p><button type="button" className="epc-button secondary" onClick={refresh}><RefreshCw size={16} />Thử lại</button></div> : <>
        <div className={`epr-state-banner ${confirmed ? 'confirmed' : check?.canConfirm ? 'ready' : 'incomplete'}`} role="status">
          <span className="epr-state-icon">{confirmed ? <LockKeyhole size={25} /> : check?.canConfirm ? <ClipboardCheck size={27} /> : <AlertCircle size={26} />}</span><div><span className="epr-status-label">{statusLabel(state)}</span><strong>{confirmed ? registration.number : draft?.number}</strong><p>{confirmed ? `Xác nhận lúc ${draftDateTime(registration.confirmedAt)}` : `Kiểm tra lúc ${draftDateTime(check?.checkedAt)}`}</p></div>{confirmed && <span className="epr-payment-badge">{paymentLabel(registration.paymentStatus)}</span>}
        </div>
        <div className="epr-layout epr-submission-layout">
          <div className="epr-main">
            <section className="epr-facts-card" aria-label="Thông tin hồ sơ đăng ký"><div className="epr-section-heading"><FileText size={18} /><h3>Thông tin đăng ký</h3></div><dl className="epr-facts"><div><dt>Luồng hàng</dt><dd>{labels.direction[content.flow] || 'Chưa chọn'}</dd></div><div><dt>{content.flow === 'IMPORT' ? 'DO/eDO' : 'Booking'}</dt><dd>{sourceLabel || 'Chưa chọn hồ sơ nguồn'}</dd></div><div><dt>Dự kiến thực hiện</dt><dd>{draftDateTime(content.plannedAt)}</dd></div><div><dt>Người liên hệ</dt><dd>{[content.contactName, content.contactPhone].filter(Boolean).join(' · ') || 'Chưa khai báo'}</dd></div></dl></section>
            <Issues issues={issues} fees={fees} containers={containers} confirmed={confirmed} />
            {!!content.delivery?.trips?.length && (
              <section className="epr-facts-card">
                <div className="epr-section-heading">
                  <FileText size={18} />
                  <h3>Phân công phương tiện & Giấy tờ xe - tài xế</h3>
                </div>
                <ServiceTripSummary trips={content.delivery.trips} containers={check?.containers || []} showProfiles />
                <div style={{ marginTop: '16px' }}>
                  <FleetDocumentsReview trips={content.delivery.trips} containers={check?.containers || []} />
                </div>
              </section>
            )}
            {!!content.delivery?.documents?.length && (
              <section className="epr-facts-card">
                <div className="epr-section-heading">
                  <FolderOpen size={18} />
                  <h3>Hồ sơ & Chứng từ đính kèm ({content.delivery.documents.length} tệp)</h3>
                </div>
                <div className="epd-review-docs-list" style={{ marginTop: '10px' }}>
                  {content.delivery.documents.map((doc, idx) => (
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
              </section>
            )}
            {content.note && <section className="epr-note-card"><h3>Ghi chú đăng ký</h3><p>{content.note}</p></section>}
          </div>
        </div>
        <div className="epr-scope-note"><Info size={17} /><p>{confirmed ? 'Dispatcher sẽ xác nhận và trả số tiền. Sau đó bạn có thể thanh toán và nhận chứng từ qua email.' : 'Hồ sơ còn thiếu thông tin vẫn được giữ ở bản nháp. Bạn có thể quay lại chỉnh sửa và kiểm tra lại.'}</p></div>
        {confirm.error && <div className="epc-error" role="alert">{draftError(confirm.error)}{stale && <p>Thông tin hồ sơ có thể đã thay đổi. Nhấn <strong>Kiểm tra lại</strong>, xem lại thông tin trước khi gửi đăng ký.</p>}</div>}
      </>}
    </div>
    <footer className="epd-footer epr-footer">
      {!confirmed && canConfirm && <label className="epr-accept epr-footer-accept">
        <input type="checkbox" checked={accepted} disabled={confirm.isPending} onChange={event => setAccepted(event.target.checked)} />
        <span>Tôi xác nhận thông tin đăng ký và gửi hồ sơ cho Dispatcher.<small>{accepted ? 'Bạn có thể gửi hồ sơ cho Dispatcher.' : 'Tích ô xác nhận thông tin để gửi hồ sơ.'}</small></span>
      </label>}
      <div>{!confirmed && !query.data?.closed && !query.isPending && <button type="button" className="epc-button secondary" disabled={confirm.isPending} onClick={() => onEdit(draftId)}><Pencil size={15} />Chỉnh sửa bản nháp</button>}</div>
      <div>{!confirmed && !query.data?.closed && !query.isPending && <button type="button" className="epc-button secondary" disabled={query.isFetching || confirm.isPending} onClick={refresh}><RefreshCw size={15} className={query.isFetching ? 'epc-spin' : ''} />Kiểm tra lại</button>}{confirmed || query.data?.closed ? <>{confirmed && registration.paymentStatus === 'PAID' && <ServiceReceiptButton orderId={draftId} />}<Link className="epc-button secondary" to={`/services?order=${draftId}`}><FileText size={16} />Quản lý đơn & thanh toán</Link><button type="button" className="epc-button primary" onClick={requestClose}><Check size={16} />Hoàn tất</button></> : <button type="button" className="epc-button primary" disabled={!canConfirm || !accepted || confirm.isPending} onClick={() => confirm.mutate()}>{confirm.isPending ? <Loader2 size={16} className="epc-spin" /> : <CheckCircle2 size={16} />}Gửi đăng ký</button>}</div>
    </footer>
  </CatalogDialog>
}
