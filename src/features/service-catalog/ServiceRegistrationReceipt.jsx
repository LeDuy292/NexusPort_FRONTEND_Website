import { ServiceTripSummary } from './ServiceTripFleet'
import { useId, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Download, FileText, Loader2, Printer, RefreshCw, X } from 'lucide-react'
import CatalogDialog from './CatalogDialog'
import { labels, money } from './catalogApi'
import { draftError, draftSession } from './serviceDraftsApi'
import { orderStatusLabels, paymentStateLabel, serviceOrderKey, serviceOrdersApi } from './serviceOrdersApi'
import printStyles from './serviceReceiptPrint.css?inline'
import './serviceReceiptPrint.css'
import './serviceReceipt.css'

const date = value => value ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '—'
const number = value => value == null ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)
const approval = { NOT_REQUIRED: 'Không yêu cầu', PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối' }

function ReceiptDelivery({ content, flow, containers }) {
  if (content.workflowVersion !== 2) return null
  const delivery = content.delivery || {}; const buyer = content.invoiceBuyer || {}
  const barge = delivery.transportMode === 'BARGE'
  return <section><h3><span>04 /</span> GIAO NHẬN VÀ THÔNG TIN HÓA ĐƠN</h3><dl className="esr-facts"><div><dt>Phương tiện</dt><dd>{barge ? 'Sà lan' : 'Xe đầu kéo'}</dd></div><div><dt>{barge ? 'Tên sà lan' : 'Biển số xe'}</dt><dd>{barge ? delivery.bargeName : delivery.trips?.length ? `${delivery.trips.length} chuyến theo container` : delivery.truckPlate}</dd></div><div><dt>{barge ? 'Năm / chuyến' : 'Tài xế / điện thoại'}</dt><dd>{barge ? `${delivery.bargeYear} / ${delivery.bargeVoyage}` : delivery.trips?.length ? 'Chi tiết phân công bên dưới' : `${delivery.driverName} / ${delivery.driverPhone}`}</dd></div><div><dt>Hạn lệnh giao nhận</dt><dd>{delivery.orderValidUntil?.split('-').reverse().join('/') || 'Không khai báo'}</dd></div><div><dt>Đơn vị nhận hóa đơn</dt><dd>{buyer.name || '—'}</dd></div><div><dt>Mã số thuế</dt><dd>{buyer.taxCode || '—'}</dd></div><div><dt>Địa chỉ nhận hóa đơn</dt><dd>{buyer.address || '—'}</dd></div><div><dt>Email hóa đơn</dt><dd>{buyer.email || '—'}</dd></div></dl>{!barge && <ServiceTripSummary trips={(delivery.trips || []).filter(t => containers.some(c => c.sourceContainerId === t.sourceContainerId))} containers={containers} />}{flow === 'IMPORT' && <p className="esr-warning">Chưa xác minh thông quan từ VASSCM. Cảng phải đối chiếu trước khi giao nhận.</p>}</section>
}

function ReceiptPaper({ receipt, paperRef }) {
  const content = receipt.content || {}
  const source = receipt.sourceSnapshot || {}
  const closed = ['CANCELLED', 'REJECTED'].includes(receipt.status)
  const perContainer = receipt.scope === 'CONTAINER'
  return <article className="esr-paper" ref={paperRef} aria-label="Nội dung phiếu đăng ký dịch vụ">
    <header className="esr-brand"><strong>NexusPort<span>.</span></strong><span>E-PORT / DỊCH VỤ CẢNG</span></header>
    <div className="esr-document-title"><span>ĐĂNG KÝ DỊCH VỤ CẢNG / E-PORT</span><h2>PHIẾU ĐĂNG KÝ DỊCH VỤ</h2><strong>Mã phiếu: {receipt.number}</strong><p>Xác nhận: {date(receipt.confirmedAt)}<span>Xuất phiếu: {date(receipt.generatedAt)}</span></p></div>
    <div className={`esr-status ${closed ? 'closed' : ''}`}>{orderStatusLabels[receipt.status] || receipt.status}{closed && ' · PHIẾU LỊCH SỬ'}</div>
    {perContainer && <p className="esr-scope">PHẠM VI PHIẾU: CONTAINER {receipt.selectedContainerNumber}</p>}
    {receipt.paymentReviewRequired && <p className="esr-warning">CẦN CẢNG ĐỐI SOÁT: Có giao dịch cần kiểm tra; trạng thái thanh toán chưa được kết luận cho hồ sơ này.</p>}
    {closed && <p className="esr-warning">Hồ sơ đã đóng. Phiếu lưu thông tin đăng ký trước đây và không xác nhận quyền tiếp tục sử dụng dịch vụ.</p>}
    <section><h3><span>01 /</span> THÔNG TIN ĐĂNG KÝ</h3><dl className="esr-facts">
      <div><dt>Đơn vị đăng ký</dt><dd>{receipt.companyName || '—'}</dd></div><div><dt>Luồng hàng</dt><dd>{labels.direction[receipt.flow] || receipt.flow}</dd></div>
      <div><dt>{receipt.flow === 'EXPORT' ? 'Booking hãng tàu' : 'DO / eDO'}</dt><dd>{receipt.sourceLabel || '—'}</dd></div><div><dt>Dịch vụ chính</dt><dd>{receipt.mainServiceName || '—'}</dd></div>
      <div><dt>Người liên hệ</dt><dd>{content.contactName || '—'}</dd></div><div><dt>Điện thoại</dt><dd>{content.contactPhone || '—'}</dd></div>
      <div><dt>Dự kiến sử dụng</dt><dd>{date(content.plannedAt)}</dd></div><div><dt>Tàu / chuyến</dt><dd>{[source.vesselName, source.voyageNumber].filter(Boolean).join(' / ') || '—'}</dd></div>
      <div><dt>{source.cyCutoff ? 'CY cut-off' : 'Tham chiếu vận đơn'}</dt><dd>{source.cyCutoff ? date(source.cyCutoff) : content.source?.blNumber || '—'}</dd></div><div><dt>Trạng thái phê duyệt</dt><dd>{approval[receipt.approvalStatus] || '—'}</dd></div>
    </dl></section>
    <section><h3><span>02 /</span> CONTAINER ĐĂNG KÝ</h3><table className="esr-containers"><thead><tr><th>STT</th><th>Container</th><th>Mã loại</th><th>Seal</th><th>VGM (kg)</th><th>Trạng thái hàng</th></tr></thead><tbody>{receipt.containers.map((container, index) => <tr key={container.sourceContainerId || `${container.containerId}-${index}`}><td>{index + 1}</td><td><strong>{container.containerNumber}</strong>{container.customsSealRequired && <small>Phải niêm phong hải quan</small>}{container.declaration?.operatorName && <small>Hãng khai thác: {container.declaration.operatorName}</small>}{container.declaration?.dischargePort && <small>Dỡ / đích: {container.declaration.dischargePort} / {container.declaration.destinationPort}</small>}</td><td>{container.typeCode || '—'}</td><td>{container.sealNumber || '—'}</td><td>{number(container.vgmKg)}</td><td>{container.loadStatus === 'full' ? 'Có hàng' : '—'}</td></tr>)}</tbody></table></section>
    <section><h3><span>03 /</span> CHI TIẾT DỊCH VỤ VÀ PHÍ</h3><table className="esr-fees"><thead><tr><th>STT</th><th>Container</th><th>Dịch vụ / thời gian</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{receipt.fees.map((fee, index) => <tr key={`${fee.sourceContainerId}-${fee.serviceCode}-${index}`}><td>{index + 1}</td><td><strong>{fee.containerNumber}</strong></td><td><strong>{fee.serviceName}</strong><small>{fee.serviceCode}</small>{(fee.startsAt || fee.endsAt) && <small>{date(fee.startsAt)} → {date(fee.endsAt)}</small>}<small>Ngày tính giá: {fee.pricingDate ? fee.pricingDate.slice(0, 10).split('-').reverse().join('/') : '—'}</small></td><td>{number(fee.quantity)}<small>{labels.unit[fee.unit] || fee.unit}</small></td><td>{money(fee.unitPrice)}</td><td><strong>{money(fee.amount)}</strong></td></tr>)}</tbody></table>
      <div className="esr-totals"><strong>{perContainer ? 'PHÍ CONTAINER NÀY:' : 'TỔNG PHÍ DỊCH VỤ:'} <span>{money(receipt.total)}</span></strong><p>Đơn vị tiền tệ: VND · Chưa bao gồm thuế và các khoản ngoài danh mục.</p>{perContainer && <p>Tổng phí toàn đơn: {money(receipt.orderTotal)}. Thanh toán được theo dõi cho toàn đơn, không tách theo phiếu container.</p>}<b>{perContainer ? 'Thanh toán toàn đơn:' : 'Thanh toán:'} {paymentStateLabel(receipt)}</b></div>
    </section>
    <ReceiptDelivery content={content} flow={receipt.flow} containers={receipt.containers} /><section className="esr-notes"><h3><span>{content.workflowVersion === 2 ? '05 /' : '04 /'}</span> GHI CHÚ VÀ GIÁ TRỊ PHIẾU</h3>{content.note && <p>{content.note}</p>}{receipt.statusNotes.map((note, index) => <p key={`${note.action}-${index}`}><strong>{note.action === 'CANCEL' ? 'Lý do hủy: ' : note.action === 'REJECT' ? 'Lý do từ chối: ' : 'Đối soát: '}</strong>{note.reason}</p>)}<p className="esr-warning">{receipt.notice}</p><p>Nội dung và đơn giá được lưu tại lúc xác nhận. Trạng thái xử lý và thanh toán trên phiếu phản ánh thời điểm xuất; kiểm tra đơn trên e-Port để xem cập nhật mới nhất.</p></section>
    <div className="esr-signatures"><div><strong>ĐƠN VỊ ĐĂNG KÝ</strong><small>Ký, ghi rõ họ tên nếu cần bản giấy</small></div><div><strong>BỘ PHẬN TIẾP NHẬN</strong><small>Ký, ghi rõ họ tên nếu cần bản giấy</small></div></div>
    <footer className="esr-document-footer">{receipt.number} · Thời gian hiển thị: UTC+7 · NexusPort e-Port</footer>
  </article>
}

async function printReceipt(paper, title) {
  const frame = document.createElement('iframe')
  frame.title = 'Bản in phiếu đăng ký dịch vụ'
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals')
  Object.assign(frame.style, { position: 'fixed', width: '1px', height: '1px', right: '0', bottom: '0', border: '0', opacity: '0' })
  document.body.appendChild(frame)
  try {
    const target = frame.contentDocument
    target.open(); target.write('<!doctype html><html lang="vi"><head><meta charset="utf-8"></head><body></body></html>'); target.close()
    target.title = title
    const style = target.createElement('style'); style.textContent = printStyles; target.head.appendChild(style)
    target.body.appendChild(paper.cloneNode(true))
    await target.fonts?.ready
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const cleanup = () => frame.remove()
    frame.contentWindow.addEventListener('afterprint', cleanup, { once: true })
    frame.contentWindow.focus(); frame.contentWindow.print()
    setTimeout(cleanup, 300000)
  } catch (error) { frame.remove(); throw error }
}

export function ServiceRegistrationReceipt({ orderId, onClose }) {
  const id = useId()
  const paperRef = useRef(null)
  const [working, setWorking] = useState('')
  const [error, setError] = useState('')
  const [changed, setChanged] = useState(false)
  const [selectedContainer, setSelectedContainer] = useState('')
  const whole = useQuery({ queryKey: [...serviceOrderKey, draftSession(), 'receipt', orderId], queryFn: () => serviceOrdersApi.receipt(orderId), retry: false, staleTime: 0, refetchOnWindowFocus: false })
  const selected = useQuery({ queryKey: [...serviceOrderKey, draftSession(), 'receipt', orderId, selectedContainer], queryFn: () => serviceOrdersApi.receipt(orderId, selectedContainer), enabled: !!selectedContainer, retry: false, staleTime: 0, refetchOnWindowFocus: false })
  const query = selectedContainer ? selected : whole
  const busy = !!working || query.isFetching
  const refresh = async () => { setError(''); setChanged(false); await query.refetch() }
  const exportReceipt = async kind => {
    setWorking(kind); setError('')
    try {
      await printReceipt(paperRef.current, `Phieu-dang-ky-${query.data.number}`)
    } catch (failure) { setError(draftError(failure)); if (failure?.response?.status === 409) setChanged(true) }
    finally { setWorking('') }
  }
  return <CatalogDialog className="epd-dialog esr-dialog" labelledBy={`${id}-title`} describedBy={`${id}-description`} onClose={() => { if (!working) onClose() }}>
    <header className="epd-header"><div><span className="epc-eyebrow">NEXUSPORT / PHIẾU ĐĂNG KÝ</span><h2 id={`${id}-title`} tabIndex={-1} data-dialog-initial-focus>Phiếu đăng ký dịch vụ</h2><p id={`${id}-description`}>Xem trước phiếu A4, in hoặc tải PDF theo thông tin đã xác nhận.</p></div><button type="button" className="epc-icon-button" aria-label="Đóng phiếu đăng ký" disabled={!!working} onClick={onClose}><X size={21} /></button></header>
    <div className="esr-toolbar"><span><FileText size={16} />Khổ A4 · Tiếng Việt · VND</span><button type="button" className="epc-text-button" disabled={busy} onClick={refresh}><RefreshCw size={14} className={query.isFetching ? 'epc-spin' : ''} />Cập nhật trạng thái</button></div>
    {whole.isSuccess && <label className="esr-scope-picker"><span>Phạm vi in phiếu</span><select aria-label="Phạm vi in phiếu" value={selectedContainer} disabled={!!working} onChange={event => { setSelectedContainer(event.target.value); setError(''); setChanged(false) }}><option value="">Toàn bộ đơn đăng ký</option>{whole.data.containers.map(container => <option key={container.sourceContainerId} value={container.sourceContainerId}>Container {container.containerNumber}</option>)}</select><small>Chọn từng container để xem dịch vụ và phí tương ứng. Trạng thái thanh toán thuộc toàn đơn.</small></label>}
    {error && <div className="esr-export-error" role="alert"><AlertCircle size={18} /><div>{error}{changed && <button type="button" className="epc-text-button" onClick={refresh}>Tải lại bản xem trước</button>}</div></div>}
    <div className="esr-scroll" aria-busy={busy}>{query.isPending ? <div className="epd-loading" role="status"><Loader2 size={24} className="epc-spin" />Đang chuẩn bị phiếu…</div> : query.isError ? <div className="epd-empty"><AlertCircle size={32} /><h3>Chưa mở được phiếu</h3><p role="alert">{draftError(query.error)}</p><button type="button" className="epc-button secondary" onClick={refresh}><RefreshCw size={16} />Thử lại</button></div> : <ReceiptPaper receipt={query.data} paperRef={paperRef} />}</div>
    <footer className="epd-footer esr-footer"><span>Trạng thái được ghi tại thời điểm xuất phiếu.</span><div><button type="button" className="epc-button secondary" disabled={busy || changed || !query.isSuccess} onClick={() => exportReceipt('print')}>{working === 'print' ? <Loader2 size={16} className="epc-spin" /> : <Printer size={16} />}In phiếu</button><button type="button" className="epc-button primary" disabled={busy || changed || !query.isSuccess} onClick={() => exportReceipt('pdf')}>{working === 'pdf' ? <Loader2 size={16} className="epc-spin" /> : <Download size={16} />}Tải PDF</button></div></footer>
  </CatalogDialog>
}

export default function ServiceReceiptButton({ orderId, disabled = false }) {
  const [open, setOpen] = useState(false)
  return <><button type="button" className="epc-button secondary" disabled={disabled} onClick={() => setOpen(true)} aria-haspopup="dialog"><Printer size={16} />Phiếu đăng ký</button>{open && <ServiceRegistrationReceipt orderId={orderId} onClose={() => setOpen(false)} />}</>
}
