import { ServiceTripSummary } from './ServiceTripFleet'
import { Anchor, FileText, Info, Truck } from 'lucide-react'

export function OrderDeliveryInfo({ order }) {
  const content = order.content || {}
  const delivery = content.delivery || {}
  if (content.workflowVersion !== 2) return null
  return <section className="epo-panel"><div className="epo-panel-title">{delivery.transportMode === 'BARGE' ? <Anchor size={17} /> : <Truck size={17} />}<h3>Khai báo giao nhận</h3></div><dl className="epo-facts"><div><dt>Phương tiện</dt><dd>{delivery.transportMode === 'BARGE' ? 'Sà lan' : 'Xe đầu kéo'}</dd></div>{delivery.transportMode === 'BARGE' ? <><div><dt>Tên sà lan</dt><dd>{delivery.bargeName}</dd></div><div><dt>Năm / chuyến</dt><dd>{delivery.bargeYear} / {delivery.bargeVoyage}</dd></div></> : <><div><dt>Biển số xe</dt><dd>{delivery.trips?.length ? `${delivery.trips.length} chuyến theo container` : delivery.truckPlate}</dd></div><div><dt>Tài xế / điện thoại</dt><dd>{delivery.trips?.length ? 'Chi tiết phân công bên dưới' : `${delivery.driverName} · ${delivery.driverPhone}`}</dd></div></>}<div><dt>Hạn lệnh giao nhận</dt><dd>{delivery.orderValidUntil || 'Không khai báo'}</dd></div></dl>{delivery.transportMode === 'TRUCK' && <ServiceTripSummary trips={delivery.trips} containers={order.containers} showProfiles />}<div className="epo-note"><strong>Thông quan: {order.customsStatus === 'CLEARED_PORT_RECORD' ? 'Đã ghi nhận tại cảng khi xác nhận đăng ký' : 'Chờ cảng đối chiếu trước giao nhận'}</strong><p>{order.customsStatus === 'CLEARED_PORT_RECORD' ? 'Theo hồ sơ cảng đã lưu cùng đơn, chưa phải phản hồi trực tiếp từ VASSCM.' : 'Cảnh báo này không chặn xử lý đăng ký hoặc thanh toán sau khi duyệt. Việc giao nhận thực tế vẫn cần cảng kiểm tra điều kiện thông quan.'}</p></div><div className="epo-container-list">{(content.lines || []).filter(line => line.customsSealRequired).map(line => <p key={line.sourceContainerId}>Hàng phải niêm phong hải quan: {order.containers?.find(container => container.sourceContainerId === line.sourceContainerId)?.containerNumber || 'Container trong hồ sơ'}</p>)}</div></section>
}

export function OrderInvoiceInfo({ order }) {
  const buyer = order.content?.invoiceBuyer || {}
  const invoice = order.invoice
  const isPaid = order.paymentStatus === 'PAID' || Boolean(invoice)

  const formatVnd = val => typeof val === 'number' ? val.toLocaleString('vi-VN') + ' đ' : val

  return (
    <section className="epo-panel">
      <div className="epo-panel-title">
        <FileText size={17} />
        <h3>Hóa đơn dịch vụ điện tử</h3>
      </div>

      {isPaid && invoice ? (
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>HÓA ĐƠN ĐIỆN TỬ GIÁ TRỊ GIA TĂNG</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Ký hiệu: 1C26TNP · Số: <strong>{invoice.invoiceNumber}</strong></div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Ngày lập: {new Date(invoice.issuedAt).toLocaleString('vi-VN')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="epd-status emerald" style={{ display: 'inline-block', marginBottom: '6px' }}>ĐÃ PHÁT HÀNH</span>
              <br />
              <button
                type="button"
                className="epc-button secondary"
                onClick={() => window.print()}
                style={{ fontSize: '12px', padding: '4px 10px' }}
              >
                In hóa đơn
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', fontSize: '12px', marginBottom: '16px' }}>
            <div><strong>Đơn vị bán hàng:</strong> CÔNG TY CỔ PHẦN CẢNG NEXUSPORT HẢI PHÒNG</div>
            <div><strong>Mã số thuế:</strong> 0200123456</div>
            <div><strong>Đơn vị mua hàng:</strong> {buyer.name || order.companyName || 'Khách hàng ePort'}</div>
            <div><strong>Mã số thuế người mua:</strong> {buyer.taxCode || 'Chưa cung cấp'}</div>
            <div style={{ gridColumn: '1 / -1' }}><strong>Địa chỉ người mua:</strong> {buyer.address || 'Hải Phòng, Việt Nam'}</div>
          </div>

          {Array.isArray(invoice.items) && invoice.items.length > 0 && (
            <div style={{ overflowX: 'auto', marginBottom: '12px' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '6px 8px' }}>STT</th>
                    <th style={{ padding: '6px 8px' }}>Tên dịch vụ / Diễn giải</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Số lượng</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Đơn giá</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 8px' }}>{idx + 1}</td>
                      <td style={{ padding: '6px 8px' }}>{item.serviceName}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{item.quantity}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatVnd(item.unitPrice)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{formatVnd(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ textAlign: 'right', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
            <div>Tiền dịch vụ chưa thuế: <strong>{formatVnd(invoice.subtotal)}</strong></div>
            <div>Thuế suất GTGT (8%): <strong>{formatVnd(invoice.vatAmount)}</strong></div>
            <div style={{ fontSize: '15px', color: '#166534', fontWeight: 700, marginTop: '4px' }}>
              Tổng tiền thanh toán: {formatVnd(invoice.totalAmount)}
            </div>
          </div>
        </div>
      ) : (
        <div className="epo-guidance">
          <Info size={19} />
          <p>
            {order.paymentStatus === 'AWAITING_PAYMENT'
              ? 'Hồ sơ đang chờ thanh toán theo bảng phí Dispatcher đã duyệt. Sau khi thanh toán PayOS thành công, hóa đơn điện tử sẽ tự động xuất tại đây.'
              : 'Chưa có hóa đơn điện tử được phát hành. Hóa đơn sẽ tự động tạo ngay khi lệnh dịch vụ hoàn tất thanh toán.'}
          </p>
        </div>
      )}

      <dl className="epo-facts">
        <div>
          <dt>Đơn vị / người mua</dt>
          <dd>{buyer.name || order.companyName || 'Chưa khai báo'}</dd>
        </div>
        <div>
          <dt>Mã số thuế</dt>
          <dd>{buyer.taxCode || 'Chưa khai báo'}</dd>
        </div>
        <div>
          <dt>Địa chỉ</dt>
          <dd>{buyer.address || 'Chưa khai báo'}</dd>
        </div>
        <div>
          <dt>Email nhận hóa đơn</dt>
          <dd>{buyer.email || 'Chưa khai báo'}</dd>
        </div>
      </dl>
    </section>
  )
}
