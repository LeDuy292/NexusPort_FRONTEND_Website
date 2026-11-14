import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowDownToLine, ArrowUpRight, Ban, Building2, Check, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, Container, CreditCard, FileCheck, FileText, History, Info, Loader2, LockKeyhole, Mail, Pencil, Phone, Plus, QrCode, RefreshCw, ShieldCheck, User, X, XCircle } from 'lucide-react'
import CatalogDialog from './CatalogDialog'
import ServiceReceiptButton from './ServiceRegistrationReceipt'
import { OrderDeliveryInfo, OrderInvoiceInfo } from './ServiceOrderDeliveryInfo'
import OrderBadge from './ServiceOrderBadge'
import { calculatePortServiceTariff } from '../../utils/portStorageFee'
import { labels, money } from './catalogApi'
import { draftDateTime, draftError, draftSession, serviceDraftKey } from './serviceDraftsApi'
import { orderStatusLabels, paymentStateLabel, paymentStatusLabels, serviceOrderKey, serviceOrdersApi } from './serviceOrdersApi'

const actionNames = { CANCEL: 'Hủy đơn dịch vụ', RECEIVE: 'Tiếp nhận hồ sơ', APPROVE: 'Duyệt đăng ký', REJECT: 'Từ chối đăng ký', CREATE_PAYMENT: 'Tạo mã thanh toán VietQR', SYNC_PAYMENT: 'Kiểm tra giao dịch VietQR', CANCEL_PAYMENT: 'Hủy yêu cầu thanh toán' }
const eventNames = { DRAFT_CREATED: 'Tạo bản nháp', DRAFT_UPDATED: 'Cập nhật bản nháp', BASELINE_RECORDED: 'Ghi nhận hồ sơ hiện có', REGISTERED: 'Xác nhận đăng ký', REGISTRATION_CONFIRMED: 'Xác nhận đăng ký', CONFIRMED: 'Xác nhận đăng ký', CANCEL: 'Hủy đơn dịch vụ', CANCELLED: 'Hủy đơn dịch vụ', RECEIVE: 'Cảng tiếp nhận hồ sơ', RECEIVED: 'Cảng tiếp nhận hồ sơ', APPROVE: 'Cảng duyệt đăng ký', APPROVED: 'Cảng duyệt đăng ký', REJECT: 'Cảng từ chối đăng ký', REJECTED: 'Cảng từ chối đăng ký', PAYMENT_CREATED: 'Tạo mã thanh toán VietQR', PAYMENT_SYNCED: 'Kiểm tra kết quả thanh toán', PAYMENT_SUCCEEDED: 'Xác nhận thanh toán thành công', PAYMENT_FAILED: 'Thanh toán không thành công', PAYMENT_CANCELLED: 'Hủy yêu cầu thanh toán', PAYMENT_REVIEW_REQUIRED: 'Giao dịch cần đối soát', PAYMENT_REFERENCE_OBSERVED: 'Bổ sung tham chiếu giao dịch', MIGRATED: 'Ghi nhận hồ sơ hiện có' }
const actionIcons = { CANCEL: Ban, RECEIVE: ArrowDownToLine, APPROVE: CheckCircle2, REJECT: XCircle }
const amountFormat = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)

function EmailDeliveryStatus({ order }) {
  if (order.staff || !order.emailNotifications?.length) return null
  return <section className="epo-panel"><div className="epo-panel-title"><FileText size={17}/><h3>Thông báo qua email</h3></div>{order.emailNotifications.map(item => <p key={item.kind}><strong>{item.kind === 'PAYMENT_RECEIPT' ? 'Biên lai và biểu mẫu' : 'Thông báo thanh toán'}</strong>: {({SENT:'Đã gửi email',PENDING:'Đang chờ gửi',SENDING:'Đang gửi',FAILED:'Gửi chưa thành công, vui lòng liên hệ cảng'})[item.status] || 'Đang cập nhật'}</p>)}</section>
}

function Facts({ order }) {
  const content = order.content || {}
  const source = order.sourceSnapshot || {}
  const bookingNo = content.source?.bookingNumber || source.bookingNumber || ''
  const blNo = content.source?.blNumber || source.blNumber || ''
  return <section className="epo-panel"><div className="epo-panel-title"><FileText size={17} /><h3>Thông tin đăng ký</h3></div><dl className="epo-facts"><div><dt>Hồ sơ nguồn</dt><dd>{order.sourceLabel || source.bookingNumber || content.source?.referenceNumber || 'Chưa chọn'}</dd></div><div><dt>Số Booking</dt><dd>{bookingNo || 'Chưa nhập'}</dd></div><div><dt>Số Vận đơn (B/L)</dt><dd>{blNo || 'Chưa nhập'}</dd></div><div><dt>Luồng hàng</dt><dd>{labels.direction[order.flow || content.flow] || 'Chưa chọn'}</dd></div><div><dt>Doanh nghiệp</dt><dd>{order.companyName || 'Doanh nghiệp đăng ký'}</dd></div><div><dt>Dự kiến sử dụng</dt><dd>{draftDateTime(content.plannedAt)}</dd></div><div><dt>Người liên hệ</dt><dd>{content.contactName || 'Chưa khai báo'}</dd></div><div><dt>Điện thoại</dt><dd>{content.contactPhone || 'Chưa khai báo'}</dd></div>{order.confirmedAt && <div><dt>Xác nhận đăng ký</dt><dd>{draftDateTime(order.confirmedAt)}</dd></div>}<div><dt>Cập nhật gần nhất</dt><dd>{draftDateTime(order.updatedAt)}</dd></div></dl>{content.note && <div className="epo-note"><strong>Ghi chú của khách hàng</strong><p>{content.note}</p></div>}</section>
}

function OrderInformation({ order }) {
  const fees = order.fees?.length ? order.fees : []
  const containers = order.containers || []
  const flow = order.flow || order.content?.flow || 'EXPORT'
  const isDraft = order?.status === 'DRAFT' || !order?.registrationId
  const isAwaitingPrice = order?.pricingStatus === 'AWAITING' || (order?.total == null && !fees.length)
  const isPriced = order?.total != null && !isDraft && order?.pricingStatus !== 'AWAITING'

  let guidanceText = ''
  if (['REJECTED', 'CANCELLED'].includes(order.status)) {
    guidanceText = 'Hồ sơ đã đóng. Xem lý do trong lịch sử xử lý.'
  } else if (isDraft) {
    guidanceText = 'Hồ sơ đang ở dạng Bản nháp (chưa gửi). Vui lòng bấm "Kiểm tra & xác nhận" để hoàn tất và gửi hồ sơ cho Dispatcher tiếp nhận và tính cước.'
  } else if (order.paymentStatus === 'PAID') {
    guidanceText = 'Đã thanh toán. Theo dõi trạng thái gửi biên lai và biểu mẫu trong mục Thông báo qua email.'
  } else if (isAwaitingPrice) {
    guidanceText = 'Hồ sơ đã gửi đến Dispatcher. Cảng đang kiểm tra điều kiện và xác nhận biểu phí. Vui lòng chờ Dispatcher phê duyệt để tiến hành thanh toán.'
  } else if (isPriced) {
    guidanceText = `Đã nhận kết quả từ Dispatcher. Số tiền cần trả: ${money(order.total)}. Kiểm tra email thông báo và mở mục Thanh toán để tiếp tục.`
  } else {
    guidanceText = 'Hồ sơ đang chờ xử lý từ phía Dispatcher.'
  }

  return (
    <div className="epo-info-sections">
      <Facts order={order} />
      <EmailDeliveryStatus order={order} />
      {!order.staff && (
        <div className="epo-guidance">
          <Info size={18} />
          <p>{guidanceText}</p>
        </div>
      )}
      <OrderDeliveryInfo order={order} />
      <section className="epo-panel">
        <div className="epo-panel-title">
          <Container size={17} />
          <h3>Container & dịch vụ</h3>
          <span>{containers.length} container</span>
        </div>
        {fees.length ? (
          <div className="epo-fee-lines">
            {fees.map((fee, index) => (
              <div className="epo-fee-line" key={`${fee.sourceContainerId}-${fee.serviceId}-${index}`}>
                <div>
                  <span className="epo-container-id"><Container size={13} />{fee.containerNumber}</span>
                  <strong>{fee.serviceName || fee.serviceCode}</strong>
                  <small>{amountFormat(fee.quantity)} {labels.unit[fee.unit] || fee.unit} × {fee.unitPrice == null ? 'Chưa có giá' : money(fee.unitPrice)}</small>
                  {fee.startsAt && <small>{draftDateTime(fee.startsAt)} → {draftDateTime(fee.endsAt)}</small>}
                </div>
                <strong>{fee.amount == null ? 'Chờ Dispatcher báo giá' : money(fee.amount)}</strong>
              </div>
            ))}
          </div>
        ) : containers.length ? (
          <div className="epo-container-list">
            {containers.map(container => (
              <div key={container.sourceContainerId || container.containerId}>
                <Container size={17} />
                <span>
                  <strong>{container.containerNumber}</strong>
                  <small>
                    {container.typeCode || 'Container hàng'}
                    {isPriced ? ` · Cước: ${money(order.total)}` : isDraft ? ' · Phí: Chưa phát hành' : ' · Cước: Chờ Dispatcher báo giá'}
                  </small>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="epo-panel-muted">Bản nháp chưa có container. Chọn chỉnh sửa để bổ sung.</p>
        )}
        <p className="epo-fee-note">
          <LockKeyhole size={14} />
          {fees.length
            ? 'Đơn giá và các dòng phí được ghi nhận tại thời điểm Dispatcher duyệt hồ sơ.'
            : isDraft
            ? 'Hồ sơ chưa gửi Dispatcher. Cảng sẽ thẩm định và phát hành biểu phí chính thức sau khi bạn gửi đăng ký.'
            : isPriced
            ? `Biểu phí cảng chính thức từ Dispatcher: ${money(order.total)}.`
            : `Biểu phí dịch vụ cảng sẽ được Dispatcher thẩm định và thông báo sau khi duyệt hồ sơ đăng ký.`}
        </p>
      </section>
    </div>
  )
}

function OrderTimeline({ query }) {
  if (query.isPending) return <div className="epo-tab-loading" role="status"><Loader2 size={23} className="epc-spin" />Đang tải lịch sử…</div>
  if (query.isError) return <div className="epo-inline-error"><p role="alert">{draftError(query.error)}</p><button className="epc-button secondary" type="button" onClick={() => query.refetch()}><RefreshCw size={15} />Thử lại</button></div>
  return <section className="epo-panel epo-history-panel"><div className="epo-panel-title"><History size={17} /><h3>Lịch sử xử lý</h3></div>{query.data?.items?.length ? <ol className="epo-history">{query.data.items.map(event => <li key={event.id}><span className="epo-history-dot" aria-hidden="true" /><div><div className="epo-history-heading"><strong>{eventNames[event.action] || 'Cập nhật hồ sơ dịch vụ'}</strong><time dateTime={event.createdAt}>{draftDateTime(event.createdAt)}</time></div><small>{event.actorName || 'Hệ thống'}</small>{event.toStatus && event.fromStatus !== event.toStatus && <div className="epo-history-transition">{event.fromStatus && <><span>{orderStatusLabels[event.fromStatus] || paymentStatusLabels[event.fromStatus] || event.fromStatus}</span><ChevronRight size={12} /></>}<span>{orderStatusLabels[event.toStatus] || paymentStatusLabels[event.toStatus] || event.toStatus}</span></div>}{event.reason && <p className="epo-history-reason">{event.reason}</p>}{event.data?.paymentNumber && <small>Mã thanh toán: {event.data.paymentNumber}</small>}</div></li>)}</ol> : <p className="epo-panel-muted">Chưa có sự kiện xử lý cho hồ sơ này.</p>}</section>
}

function checkoutAddress(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'pay.payos.vn' && !url.username && !url.password ? url.href : null } catch { return null }
}

function VietQrPaymentCard({ payment, order }) {
  const content = order?.content || {}
  const source = content.source || order?.sourceSnapshot || {}
  const containers = order?.containers || []
  const buyer = content.invoiceBuyer || {}
  const contactName = content.contactName || buyer.name || order?.companyName || 'Người đặt dịch vụ'
  const companyName = order?.companyName || buyer.name || 'Công ty đăng ký dịch vụ'
  const contactPhone = content.contactPhone || '—'
  const invoiceEmail = buyer.email || content.contactEmail || 'tvan20152@gmail.com'
  const containerNumbers = containers.map(c => `${c.containerNumber}${c.typeCode ? ` (${c.typeCode})` : ''}`).join(', ')
  const bookingBl = source.bookingNumber || source.blNumber || order?.sourceLabel || '—'

  const qrSrc = payment.qrCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payment.qrCode)}`
    : `https://img.vietqr.io/image/MB-VQRQANOSG2264-compact2.png?amount=${payment.amount || 0}&addInfo=${encodeURIComponent(payment.orderCode || payment.number || 'NEXUSPORT')}&accountName=TRAN%20VAN%20TUNG`

  return (
    <div style={{
      margin: '16px 0',
      padding: '20px',
      background: '#ffffff',
      border: '1.5px solid #0284c7',
      borderRadius: '12px',
      boxShadow: '0 4px 16px -2px rgba(2, 132, 199, 0.12)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-flex', padding: '6px', background: '#e0f2fe', borderRadius: '8px', color: '#0369a1' }}>
            <QrCode size={20} />
          </span>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>QUÉT MÃ VIETQR THANH TOÁN TỰ ĐỘNG 24/7</h4>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Hỗ trợ tất cả ứng dụng Ngân hàng (MB, VCB, BIDV, Techcombank,...) & Ví điện tử</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {payment.status === 'SUCCEEDED' ? (
            <span style={{ display: 'inline-flex', padding: '4px 12px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#166534' }}>
              ✓ ĐÃ THANH TOÁN THÀNH CÔNG
            </span>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#166534' }}>
              <span>Ngân hàng Quân Đội (MB Bank)</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* Cột trái: QR Code và Thông báo PDF về email */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <div style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', display: 'inline-block', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
              <img
                src={qrSrc}
                alt="Mã VietQR chuyển khoản"
                style={{ width: '190px', height: '190px', display: 'block', margin: '0 auto' }}
              />
            </div>
            <div style={{ marginTop: '10px', fontSize: '18px', fontWeight: 800, color: payment.status === 'SUCCEEDED' ? '#166534' : '#0369a1' }}>
              {money(payment.amount)} {payment.status === 'SUCCEEDED' && '(ĐÃ HOÀN TẤT)'}
            </div>
            {payment.status === 'PENDING' && (
              <>
                <div style={{ margin: '6px 0 4px', padding: '5px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: '#1d4ed8' }}>
                  ⚡ Test chuyển khoản thực tế: Quét mã QR chuyển đúng <strong>2.000 đ</strong> để hoàn tất đơn
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: '2px 0 6px', padding: '4px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', fontSize: '11px', color: '#64748b' }}>
                  <Loader2 size={12} className="epc-spin" style={{ color: '#0284c7' }} />
                  <span>Hệ thống đang tự động kiểm tra giao dịch (mỗi 2-3s)...</span>
                </div>
              </>
            )}
            <div style={{ fontSize: '12px', color: '#1e293b', marginTop: '4px' }}>
              Chủ tài khoản: <strong>TRAN VAN TUNG</strong>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Nội dung chuyển khoản: <strong style={{ color: '#0f172a' }}>{payment.orderCode || payment.number}</strong>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '12px 14px',
            background: payment.status === 'SUCCEEDED' ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' : 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
            border: '1px solid #a7f3d0',
            borderRadius: '8px',
            color: '#065f46'
          }}>
            <FileCheck size={20} style={{ color: '#059669', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
              <strong style={{ color: '#047857', display: 'block', fontSize: '13px', marginBottom: '2px' }}>
                {payment.status === 'SUCCEEDED'
                  ? 'Đã gửi hóa đơn điện tử & biên lai PDF về email'
                  : 'Hóa đơn điện tử và Biểu mẫu dịch vụ (PDF) sẽ được tự động gửi về email'}
              </strong>
              {payment.status === 'SUCCEEDED'
                ? `Hệ thống đã phát hành hóa đơn GTGT điện tử và gửi 01 tệp PDF biên lai & chứng từ đến email ${invoiceEmail}. Quý khách có thể mở tab "Hóa đơn" hoặc bấm nút "In biên lai & biểu mẫu" bên dưới để xem và tải về.`
                : `Sau khi thanh toán thành công, hệ thống tự động xuất Hóa đơn GTGT và gửi 01 tệp PDF biên lai & chứng từ trực tiếp đến email ${invoiceEmail} để doanh nghiệp lưu trữ và xuất trình tại cổng cảng.`}
            </div>
          </div>
        </div>

        {/* Cột phải: Thông tin chủ sở hữu & doanh nghiệp và Thông tin đơn hàng */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#0369a1', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={14} /> Thông tin chủ sở hữu & Doanh nghiệp
            </div>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '12px' }}>
              <div>
                <dt style={{ color: '#64748b', fontSize: '11px' }}>Tên công ty / Doanh nghiệp</dt>
                <dd style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>{companyName}</dd>
              </div>
              <div>
                <dt style={{ color: '#64748b', fontSize: '11px' }}>Chủ sở hữu / Người liên hệ</dt>
                <dd style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{contactName}</dd>
              </div>
              <div>
                <dt style={{ color: '#64748b', fontSize: '11px' }}>Số điện thoại</dt>
                <dd style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{contactPhone}</dd>
              </div>
              <div>
                <dt style={{ color: '#64748b', fontSize: '11px' }}>Email nhận hóa đơn</dt>
                <dd style={{ margin: 0, fontWeight: 600, color: '#0284c7' }}>{invoiceEmail}</dd>
              </div>
            </dl>
          </div>

          <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#0369a1', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} /> Thông tin dịch vụ cảng & Đơn hàng
            </div>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '12px' }}>
              <div>
                <dt style={{ color: '#64748b', fontSize: '11px' }}>Mã đơn dịch vụ</dt>
                <dd style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>{order?.number}</dd>
              </div>
              <div>
                <dt style={{ color: '#64748b', fontSize: '11px' }}>Dịch vụ đăng ký</dt>
                <dd style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{order?.mainServiceName || 'Lấy container'}</dd>
              </div>
              <div>
                <dt style={{ color: '#64748b', fontSize: '11px' }}>Container ({containers.length})</dt>
                <dd style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{containerNumbers || '—'}</dd>
              </div>
              <div>
                <dt style={{ color: '#64748b', fontSize: '11px' }}>Số Booking / B/L</dt>
                <dd style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{bookingBl}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

function PaymentPanel({ query, order, pending, onAction }) {
  if (query.isPending) return <div className="epo-tab-loading" role="status"><Loader2 size={23} className="epc-spin" />Đang tải thanh toán…</div>
  if (query.isError) return <div className="epo-inline-error"><p role="alert">{draftError(query.error)}</p><button className="epc-button secondary" type="button" onClick={() => query.refetch()}><RefreshCw size={15} />Thử lại</button></div>
  const items = query.data?.items || []
  const configured = query.data?.configured === true
  const canCreate = order.allowedActions?.includes('CREATE_PAYMENT')

  return <div className="epo-payment-sections">
    {order.paymentReviewRequired && <div className="epo-guidance" role="status"><Info size={17} /><p>Có giao dịch cần cảng đối soát. Hồ sơ giữ nguyên trạng thái; vui lòng liên hệ bộ phận thanh toán của cảng trước khi tiếp tục thanh toán hoặc hủy đơn.</p></div>}
    {!configured && order.paymentStatus !== 'PAID' && order.paymentStatus !== 'NOT_REQUIRED' && <div className="epo-guidance"><Info size={17} /><p>{query.data?.instructions || 'Kênh thanh toán trực tuyến chưa sẵn sàng. Vui lòng liên hệ cảng để được hỗ trợ thanh toán.'}</p></div>}
    <section className="epo-panel">
      <div className="epo-panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CreditCard size={17} />
          <h3>Thông tin thanh toán dịch vụ</h3>
          <span>{items.length} yêu cầu</span>
        </div>
        {canCreate && (
          <button type="button" className="epc-button primary" disabled={pending || !configured} onClick={() => onAction('CREATE_PAYMENT')}>
            <Plus size={16} />{items.length ? 'Tạo mã thanh toán mới' : 'Tạo mã thanh toán VietQR'}
          </button>
        )}
      </div>
      {items.length ? <div className="epo-payment-list">{items.map(payment => { const checkoutUrl = checkoutAddress(payment.checkoutUrl); return <article className="epo-payment-attempt" key={payment.id}><div className="epo-payment-attempt-heading"><div><strong>{payment.number}</strong><small>VietQR · {draftDateTime(payment.createdAt)}</small></div><OrderBadge status={payment.status} payment /></div><div className="epo-payment-attempt-amount">{money(payment.amount)}</div>{payment.bankReference && <p><span>Mã giao dịch:</span> {payment.bankReference}</p>}{payment.reason && <p className="epo-attempt-reason">{payment.reason}</p>}{payment.gatewayError && <p className="epo-attempt-warning" role="status">{payment.gatewayError}</p>}{!payment.gatewayError && !checkoutUrl && payment.status === 'PENDING' && <p>Liên kết chưa sẵn sàng. Kiểm tra kết quả để cập nhật thông tin thanh toán.</p>}{(payment.status === 'PENDING' || payment.status === 'SUCCEEDED') && (
        <VietQrPaymentCard payment={payment} order={order} />
      )}<div className="epo-attempt-actions">{checkoutUrl && payment.allowedActions?.includes('OPEN_CHECKOUT') && <a className={`epc-button primary ${pending ? 'epo-link-disabled' : ''}`} aria-disabled={pending} tabIndex={pending ? -1 : 0} href={pending ? undefined : checkoutUrl} target="_blank" rel="noopener noreferrer">Mở cổng thanh toán trực tuyến<ArrowUpRight size={14} /></a>}{payment.allowedActions?.includes('SYNC') && <button type="button" className="epc-button secondary" disabled={pending || !configured} onClick={() => onAction('SYNC_PAYMENT', payment)}><RefreshCw size={14} />Kiểm tra kết quả</button>}{payment.allowedActions?.includes('CANCEL') && <button type="button" className="epc-button secondary" disabled={pending || !configured} onClick={() => onAction('CANCEL_PAYMENT', payment)}><X size={14} />Hủy yêu cầu</button>}</div></article> })}</div> : <div className="epo-payment-empty"><CreditCard size={28} /><strong>Chưa có yêu cầu thanh toán</strong><p>{canCreate ? 'Tạo yêu cầu để nhận mã QR chuyển khoản và thông tin thanh toán cho đơn dịch vụ.' : 'Yêu cầu thanh toán sẽ được ghi nhận tại đây khi hồ sơ được Dispatcher phê duyệt.'}</p>{canCreate && <button type="button" className="epc-button primary" style={{ marginTop: '12px' }} disabled={pending || !configured} onClick={() => onAction('CREATE_PAYMENT')}><Plus size={16} />Tạo mã thanh toán VietQR</button>}</div>}
    </section>
    <p className="epo-payment-security"><ShieldCheck size={15} />Kết quả thanh toán được hệ thống ngân hàng và cảng tự động xác thực. Hóa đơn và biên lai điện tử PDF sẽ được gửi về email ngay sau khi thanh toán thành công.</p>
  </div>
}

export default function ServiceOrderDetail({ orderId, initialTab = 'information', onClose, onEdit, onReview }) {
  const id = useId()
  const client = useQueryClient()
  const session = draftSession()
  const [tab, setTab] = useState(initialTab)
  const [form, setForm] = useState(null)
  const [conflict, setConflict] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeWarning, setNoticeWarning] = useState(false)
  const formRef = useRef(null)
  const orderQuery = useQuery({ queryKey: [...serviceOrderKey, session, 'detail', orderId], queryFn: () => serviceOrdersApi.get(orderId), retry: false, refetchOnWindowFocus: true, refetchInterval: query => query.state.data?.pricingStatus === 'AWAITING' || query.state.data?.paymentStatus === 'PENDING' || query.state.data?.emailNotifications?.some(item => ['PENDING','SENDING'].includes(item.status)) ? 2000 : false })
  const historyQuery = useQuery({ queryKey: [...serviceOrderKey, session, 'history', orderId], queryFn: () => serviceOrdersApi.history(orderId), enabled: tab === 'history', retry: false, refetchOnWindowFocus: false })
  const paymentQuery = useQuery({ queryKey: [...serviceOrderKey, session, 'payments', orderId], queryFn: () => serviceOrdersApi.payments(orderId), enabled: tab === 'payments', retry: false, refetchOnWindowFocus: true, refetchInterval: () => tab === 'payments' && orderQuery.data?.paymentStatus === 'PENDING' ? 2000 : false })
  const order = orderQuery.data
  const canReceipt = order?.registrationId && (order.pricingMode !== 'DISPATCHER' || order.paymentStatus === 'PAID' || order.pricingStatus === 'PUBLISHED' && order.paymentStatus === 'NOT_REQUIRED')
  const mutation = useMutation({
    mutationFn: async value => {
      const body = { requestId: value.requestId, expectedVersion: value.expectedVersion }
      if (value.kind === 'CREATE_PAYMENT') return serviceOrdersApi.createPayment(orderId, body)
      if (value.kind === 'SYNC_PAYMENT') return serviceOrdersApi.syncPayment(orderId, value.payment.id, body)
      if (value.kind === 'CANCEL_PAYMENT') return serviceOrdersApi.cancelPayment(orderId, value.payment.id, { ...body, reason: value.reason.trim() })
      return serviceOrdersApi.action(orderId, { ...body, action: value.kind, reason: value.reason.trim(), sourceDocumentsChecked: !!value.sourceDocumentsChecked, sourceEvidenceReference: value.sourceEvidenceReference || '' })
    },
    retry: false,
    onSuccess: async (result, value) => {
      setForm(null)
      const uncertain = !!result.payment?.gatewayError
      setNoticeWarning(uncertain)
      if (value.kind === 'SYNC_PAYMENT') {
        if (result.paymentStatus === 'PAID') {
          setNotice('✓ Xác nhận thanh toán thành công! Hệ thống đã ghi nhận và gửi hóa đơn & biên lai (PDF) về email.')
        } else if (!value.silent) {
          setNotice(`Đã kiểm tra kết quả giao dịch. ${paymentStatusLabels[result.paymentStatus] || 'Kết quả đã được cập nhật'}.`)
        }
      } else if (value.kind === 'CREATE_PAYMENT') {
        setNotice(result.paymentStatus === 'PAID' ? 'Hệ thống đã xác nhận thanh toán thành công cho đơn dịch vụ.' : result.payment?.checkoutUrl ? 'Đã tạo mã thanh toán VietQR. Quét mã QR hoặc mở cổng thanh toán để tiếp tục.' : 'Yêu cầu thanh toán đã được lưu. Quét mã QR để hoàn tất.')
      } else {
        setNotice(`${actionNames[value.kind]} thành công.`)
      }
      if (value.kind.includes('PAYMENT')) setTab('payments')
      await Promise.all([client.invalidateQueries({ queryKey: serviceOrderKey }), client.invalidateQueries({ queryKey: serviceDraftKey })])
    },
    onError: error => { if (error?.response?.status === 409) setConflict(true) },
  })
  const pending = mutation.isPending
  const requestClose = () => { if (!pending) onClose() }
  const openAction = (kind, payment = null) => { mutation.reset(); setConflict(false); setNotice(''); const value = { kind, payment, requestId: crypto.randomUUID(), expectedVersion: order.version, reason: '', acknowledged: false }; setForm(value); if (kind === 'SYNC_PAYMENT') mutation.mutate(value) }
  const update = (name, value) => { if (!pending) { setForm(previous => ({ ...previous, [name]: value, requestId: crypto.randomUUID() })); mutation.reset() } }
  const refresh = async () => { setForm(null); setConflict(false); mutation.reset(); await Promise.all([orderQuery.refetch(), tab === 'payments' ? paymentQuery.refetch() : Promise.resolve(), tab === 'history' ? historyQuery.refetch() : Promise.resolve()]) }

  // Tự động kiểm tra đối soát giao dịch ngân hàng mỗi 2.5s khi có yêu cầu đang chờ thanh toán
  const pendingPayment = paymentQuery.data?.items?.find(p => p.status === 'PENDING')
  useEffect(() => {
    if (!pendingPayment || order?.paymentStatus === 'PAID') return
    const timer = setInterval(() => {
      if (!mutation.isPending && !form) {
        mutation.mutate({
          kind: 'SYNC_PAYMENT',
          payment: pendingPayment,
          requestId: crypto.randomUUID(),
          expectedVersion: order?.version,
          reason: '',
          acknowledged: false,
          silent: true,
        })
      }
    }, 2500)
    return () => clearInterval(timer)
  }, [pendingPayment?.id, pendingPayment?.status, order?.paymentStatus, order?.version, mutation.isPending, !!form])
  useEffect(() => { if (form?.kind) { formRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); formRef.current?.querySelector('input:not([type="checkbox"]),textarea,button')?.focus({ preventScroll: true }) } }, [form?.kind])
  const changeTab = value => { if (!pending) { setTab(value); setNotice('') } }
  const tabs = [['information', 'Thông tin', FileText], ['payments', 'Thanh toán', CreditCard], ['invoice', 'Hóa đơn', FileText], ['history', 'Lịch sử', History]]
  const handleTabKey = (event, index) => {
    let next
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return
    event.preventDefault(); changeTab(tabs[next][0]); event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus()
  }
  const destructive = form && ['CANCEL', 'REJECT', 'CANCEL_PAYMENT'].includes(form.kind)
  const needsReason = form && ['CANCEL', 'REJECT', 'CANCEL_PAYMENT'].includes(form.kind)
  const needsAck = form?.kind === 'CREATE_PAYMENT'
  const needsSourceReview = form?.kind === 'APPROVE' && order?.flow === 'IMPORT' && order.content?.workflowVersion === 2

  const isDraft = order?.status === 'DRAFT' || !order?.registrationId
  const isAwaitingPrice = order?.pricingStatus === 'AWAITING' || (order?.total == null && !order?.fees?.length)
  const isPriced = order?.total != null && !isDraft && order?.pricingStatus !== 'AWAITING'

  const displayAmount = isPriced
    ? money(order.total)
    : isDraft
    ? 'Chưa phát hành phí'
    : 'Chờ Dispatcher báo giá'

  return <CatalogDialog className="epd-dialog epo-detail-dialog" labelledBy={`${id}-title`} describedBy={`${id}-description`} onClose={requestClose}>
    <header className="epd-header"><div><span className="epc-eyebrow">NEXUSPORT / HỒ SƠ DỊCH VỤ</span><h2 id={`${id}-title`} tabIndex={-1} data-dialog-initial-focus>Chi tiết đơn dịch vụ</h2><p id={`${id}-description`}>Thông tin đăng ký, thanh toán và lịch sử xử lý của hồ sơ.</p></div><button type="button" className="epc-icon-button" aria-label="Đóng chi tiết đơn dịch vụ" disabled={pending} onClick={requestClose}><X size={21} /></button></header>
    {orderQuery.isPending ? <div className="epo-tab-loading" role="status"><Loader2 size={26} className="epc-spin" />Đang tải hồ sơ…</div> : orderQuery.isError ? <div className="epo-empty"><AlertCircle size={33} /><h3>Chưa mở được hồ sơ</h3><p role="alert">{draftError(orderQuery.error)}</p><button type="button" className="epc-button secondary" onClick={refresh}><RefreshCw size={16} />Thử lại</button></div> : <>
      <div className="epo-detail-identity"><span className="epo-detail-file"><FileText size={23} /></span><div><span>{order.mainServiceName || 'Đăng ký dịch vụ cảng'}</span><strong>{order.number}</strong><small>{order.sourceLabel || 'Chưa chọn hồ sơ nguồn'}{order.companyName ? ` · ${order.companyName}` : ''}</small></div><OrderBadge status={order.status} /></div>
      <div className="epo-detail-tabs" role="tablist" aria-label="Nội dung hồ sơ">{tabs.map(([value, label, Icon], index) => <button key={value} type="button" id={`${id}-tab-${value}`} role="tab" aria-controls={`${id}-panel`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} disabled={pending} onClick={() => changeTab(value)} onKeyDown={event => handleTabKey(event, index)}><Icon size={16} />{label}{value === 'payments' && order.paymentStatus === 'PAID' && <Check size={12} />}</button>)}<button type="button" className="epo-detail-refresh" aria-label="Tải lại hồ sơ" disabled={pending || orderQuery.isFetching} onClick={refresh}><RefreshCw size={16} className={orderQuery.isFetching ? 'epc-spin' : ''} /></button></div>
      <div className="epd-body epo-detail-body" aria-busy={pending || orderQuery.isFetching}>
        {notice && <div className={`epo-detail-notice ${noticeWarning ? 'warning' : ''}`} role="status">{noticeWarning ? <Info size={17} /> : <CheckCircle2 size={17} />}<p>{notice}</p></div>}
        {form && <form className={`epo-action-form ${destructive ? 'destructive' : ''}`} ref={formRef} onSubmit={event => { event.preventDefault(); if (!pending && !conflict) mutation.mutate(form) }} aria-label={actionNames[form.kind]}><div className="epo-action-form-title"><span><ShieldCheck size={19} /></span><div><h3>{actionNames[form.kind]}</h3><p>{form.kind === 'CREATE_PAYMENT' ? 'Tạo mã thanh toán trực tuyến (VietQR) theo số tiền đã phê duyệt.' : form.kind === 'SYNC_PAYMENT' ? 'Hệ thống đối chiếu trạng thái giao dịch trực tiếp với ngân hàng.' : form.kind === 'CANCEL' ? 'Hồ sơ và lịch sử vẫn được giữ lại sau khi hủy.' : form.kind === 'REJECT' ? 'Lý do từ chối sẽ được hiển thị cho doanh nghiệp đăng ký.' : 'Kiểm tra nội dung trước khi ghi nhận vào lịch sử xử lý.'}</p></div><button type="button" className="epc-icon-button" disabled={pending} aria-label="Đóng thao tác" onClick={() => { setForm(null); mutation.reset() }}><X size={17} /></button></div>
          {form.payment && <div className="epo-action-context"><span>{form.payment.number}</span><strong>{money(form.payment.amount)}</strong></div>}
          {form.kind === 'CREATE_PAYMENT' && <div className="epo-action-context"><span>Số tiền phải thanh toán do Dispatcher gửi</span><strong>{displayAmount}</strong></div>}
          <fieldset disabled={pending || conflict}>
            {needsSourceReview && <><label className="epo-field"><span>Tham chiếu chứng từ đã đối chiếu *</span><input aria-label="Tham chiếu đối chiếu DO/eDO" required minLength={3} maxLength={200} value={form.sourceEvidenceReference || ''} onChange={event => update('sourceEvidenceReference', event.target.value)} placeholder="Số chứng từ / mã xác minh làm căn cứ duyệt…" /></label><label className="epo-acknowledge"><input type="checkbox" required checked={!!form.sourceDocumentsChecked} onChange={event => update('sourceDocumentsChecked', event.target.checked)} /><span>Tôi đã đối chiếu DO/eDO, hiệu lực lệnh, đúng container và quyền nhận hàng của doanh nghiệp. Thao tác này không xác nhận thông quan hoặc cấp phép qua cổng.</span></label></>}
            {!['CREATE_PAYMENT', 'SYNC_PAYMENT'].includes(form.kind) && <label className="epo-field"><span>{needsReason ? 'Lý do / ghi chú xử lý *' : 'Ghi chú xử lý (không bắt buộc)'}</span><textarea required={needsReason} maxLength={1000} rows={3} value={form.reason} onChange={event => update('reason', event.target.value)} placeholder={needsReason ? 'Ghi rõ căn cứ hoặc lý do xử lý hồ sơ…' : 'Bổ sung thông tin để khách hàng cùng theo dõi…'} /></label>}
            {needsAck && <label className="epo-acknowledge"><input type="checkbox" checked={form.acknowledged} required onChange={event => update('acknowledged', event.target.checked)} /><span>Tôi đã kiểm tra số tiền dịch vụ và muốn thanh toán đơn này bằng mã chuyển khoản VietQR (Hóa đơn và PDF sẽ gửi về email).</span></label>}
          </fieldset>
          {mutation.error && <div className="epo-form-error" role="alert"><AlertCircle size={16} /><div><p>{draftError(mutation.error)}</p>{conflict && <p>Hồ sơ đã thay đổi. Tải lại và kiểm tra trạng thái mới trước khi thao tác tiếp.</p>}</div></div>}
          <div className="epo-form-actions"><button type="button" className="epc-button secondary" disabled={pending} onClick={() => { setForm(null); mutation.reset() }}>Quay lại</button>{conflict ? <button type="button" className="epc-button primary" disabled={pending} onClick={refresh}><RefreshCw size={15} />Tải lại hồ sơ</button> : <button type="submit" className={`epc-button ${destructive ? 'destructive' : 'primary'}`} disabled={pending || (needsAck && !form.acknowledged)}>{pending ? <Loader2 size={15} className="epc-spin" /> : <Check size={15} />}{pending ? 'Đang ghi nhận…' : actionNames[form.kind]}</button>}</div>
        </form>}
        <div className="epo-detail-layout" data-tab={tab}><section className="epo-detail-content" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} tabIndex={0}>{tab === 'information' ? <OrderInformation order={order} /> : tab === 'history' ? <OrderTimeline query={historyQuery} /> : tab === 'invoice' ? <OrderInvoiceInfo order={order} /> : <PaymentPanel query={paymentQuery} order={order} pending={pending || !!form} onAction={openAction} />}</section><aside className="epo-order-sidebar"><div className="epo-sidebar-heading"><span><ClipboardCheck size={22} /></span><div><small>HỒ SƠ ĐĂNG KÝ</small><h3>{order.registrationId ? 'Theo dõi đăng ký' : 'Bản nháp dịch vụ'}</h3></div></div><div className="epo-sidebar-total"><small>{order.staff ? 'Số tiền từ bên xử lý' : isPriced ? 'Số tiền cần thanh toán' : 'Trạng thái biểu phí'}</small><strong style={!isPriced ? { fontSize: '18px', color: '#64748b' } : undefined}>{displayAmount}</strong></div><dl><div><dt>Container</dt><dd>{order.containerCount ?? order.containers?.length ?? 0}</dd></div><div><dt>Xử lý</dt><dd>{orderStatusLabels[order.status] || order.status}</dd></div><div><dt>Phê duyệt</dt><dd>{({ PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', NOT_REQUIRED: 'Không yêu cầu' })[order.approvalStatus] || 'Chưa xác nhận'}</dd></div><div><dt>Thanh toán</dt><dd>{isDraft ? 'Chưa gửi hồ sơ' : isAwaitingPrice ? 'Chờ Dispatcher trả phí' : paymentStateLabel(order)}</dd></div></dl><div className="epo-sidebar-actions">{order.allowedActions?.includes('EDIT') && <button type="button" className="epc-button secondary" disabled={pending} onClick={() => onEdit(orderId)}><Pencil size={15} />Chỉnh sửa bản nháp</button>}{order.allowedActions?.includes('REVIEW') && <button type="button" className="epc-button primary" disabled={pending} onClick={() => onReview(orderId)}><ShieldCheck size={15} />Kiểm tra & xác nhận</button>}{['RECEIVE', 'APPROVE', 'REJECT', 'CANCEL'].filter(action => order.allowedActions?.includes(action)).map(action => { const Icon = actionIcons[action]; return <button key={action} type="button" className={`epc-button ${['CANCEL', 'REJECT'].includes(action) ? 'secondary epo-danger-button' : 'primary'}`} disabled={pending || !!form} onClick={() => openAction(action)}><Icon size={15} />{actionNames[action]}</button> })}{order.allowedActions?.includes('CREATE_PAYMENT') && tab !== 'payments' && <button type="button" className="epc-button primary" disabled={pending} onClick={() => changeTab('payments')}><CreditCard size={15} />Thanh toán dịch vụ</button>}</div><div className="epo-sidebar-note"><LockKeyhole size={15} /><p>{order.status === 'DRAFT' ? 'Bản nháp chưa xác nhận đơn giá và chưa tạo yêu cầu thanh toán.' : 'Hồ sơ đã gửi Dispatcher. Bạn nhận kết quả, thanh toán và chứng từ qua email.'}</p></div></aside></div>
      </div>
    </>}
    <footer className="epd-footer epo-detail-footer"><span><Clock3 size={14} />Trạng thái xử lý và thanh toán được theo dõi riêng.</span><div className="esr-entry-actions">{canReceipt && <ServiceReceiptButton orderId={orderId} disabled={pending || orderQuery.isFetching} />}<button type="button" className="epc-button secondary" disabled={pending} onClick={requestClose}>Đóng hồ sơ</button></div></footer>
  </CatalogDialog>
}
