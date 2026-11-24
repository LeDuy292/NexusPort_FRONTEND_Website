const documentLabels = { PRE_ALERT: 'Pre-alert', BL: 'Vận đơn B/L', ARRIVAL_NOTICE: 'Arrival Notice', DO: 'Lệnh giao hàng (D/O)', PAYMENT: 'Phí' }

const baseActions = {
  RECEIVED: 'Đã nhận', CONSIGNEE_ASSIGNED: 'Gắn Transport company', RECONCILED: 'Đối chiếu khớp manifest', MISMATCH_FOUND: 'Phát hiện lệch manifest',
  ORIGIN_REPLIED: 'Đầu xuất trả lời', SENT: 'Đã gửi', CONFIRMED: 'Đã xác nhận', CONFIRMATION_UPDATED: 'Cập nhật thông tin xác nhận', REVISION_REQUESTED: 'Yêu cầu sửa',
  AMENDMENT_ACCEPTED: 'Chấp nhận yêu cầu sửa', AMENDMENT_REJECTED: 'Từ chối yêu cầu sửa', AUTO_ACCEPTED: 'Tự giữ nguyên do quá hạn', FEES_COLLECTED: 'Đã thu phí',
  SURRENDERED: 'Đã thu hồi B/L gốc', AUTHORIZATION_UPLOADED: 'Tải lên giấy ủy quyền', REQUESTED: 'Yêu cầu lấy D/O', RELEASE_VERIFIED: 'Đủ điều kiện nhận hàng',
  RELEASE_BLOCKED: 'Chưa đủ điều kiện nhận hàng', ISSUED: 'Đã phát hành', ACCOMPLISHED: 'B/L gốc hết hiệu lực', SCHEDULE_CHANGED: 'Đổi lịch tàu',
  LOI_ORIGINAL_RETURNED: 'Đã nộp lại B/L gốc theo LOI', LOI_ORIGINAL_REMINDER: 'Nhắc nộp B/L gốc theo LOI', LOI_ORIGINAL_OVERDUE: 'Quá hạn nộp B/L gốc theo LOI',
}
const requestTypes = { LOI_RELEASE: 'nhận hàng bằng thư bảo lãnh (LOI)', CHANGE_CONSIGNEE: 'đổi người nhận', CHANGE_POD: 'đổi cảng dỡ' }
const outcomes = { REQUESTED: 'Yêu cầu', APPROVED: 'Đã duyệt', ACCEPTED: 'Đã chấp nhận', REJECTED: 'Từ chối', CANCELLED: 'Đã rút yêu cầu', CANCELED: 'Đã rút yêu cầu', COMPLETED: 'Hoàn tất' }

function actionLabel(action) {
  if (baseActions[action]) return baseActions[action]
  const m = String(action || '').match(/^(LOI_RELEASE|CHANGE_CONSIGNEE|CHANGE_POD)_([A-Z]+)$/)
  if (m) return `${outcomes[m[2]] || m[2]} ${requestTypes[m[1]]}`
  return action
}

const fieldLabels = {
  localChargesStatus: 'Trạng thái phí tại cảng nhập', freightStatus: 'Trạng thái cước', status: 'Trạng thái', consignee: 'Người nhận hàng', shipper: 'Người gửi hàng',
  notifyParty: 'Bên thông báo', cargoDescription: 'Mô tả hàng', portOfDischarge: 'Cảng dỡ hàng', portOfLoading: 'Cảng bốc hàng', vesselName: 'Tên tàu',
  voyageNumber: 'Số chuyến', eta: 'Ngày tàu đến (ETA)', etd: 'Ngày tàu đi (ETD)', consigneeCompany: 'Transport company của người nhận', blType: 'Hình thức B/L',
  containers: 'Danh sách container', 'invoice.companyName': 'Tên công ty xuất hóa đơn', 'invoice.taxCode': 'Mã số thuế', 'invoice.address': 'Địa chỉ xuất hóa đơn',
  'invoice.email': 'Email nhận hóa đơn', 'contact.name': 'Người liên hệ nhận D/O', 'contact.phone': 'Số điện thoại liên hệ',
}
const valueLabels = {
  UNPAID: 'Chưa thu', PAID: 'Đã thu', PARTIAL: 'Thu một phần', PREPAID: 'Trả trước', COLLECT: 'Trả sau',
  RECEIVED: 'Đã nhận B/L', MISMATCH: 'Lệch thông tin', NOTICE_SENT: 'Đã gửi Arrival Notice', AMENDMENT_REQUESTED: 'Yêu cầu sửa', CONFIRMED: 'Đã xác nhận',
  RELEASE_VERIFIED: 'Đủ điều kiện nhận hàng', DO_ISSUED: 'Đã phát hành D/O',
}
const roleLabels = { 'Shipping Line': 'Hãng tàu', 'Transport Company': 'Doanh nghiệp vận tải', Administrator: 'Quản trị viên', Dispatcher: 'Điều phối', 'Gate Officer': 'Nhân viên cổng', 'Yard Operator': 'Nhân viên bãi' }

const when = value => (value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '')
const showValue = value => {
  if (value == null || value === '') return '—'
  if (typeof value === 'object') return Array.isArray(value) ? `${value.length} mục` : JSON.stringify(value)
  return valueLabels[String(value)] || String(value)
}

/** Dòng thời gian hồ sơ hàng nhập: mới nhất ở trên cùng, nội dung hiển thị bằng tiếng Việt. */
export default function ImportDocumentTimeline({ events }) {
  const rows = [...(events || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  if (rows.length === 0) return <p className="text-sm text-slate-500">Chưa có hoạt động nào.</p>
  return (
    <ol className="space-y-2">
      {rows.map((event, index) => {
        // Bỏ các dòng đổi giá trị mà thực chất không đổi (ví dụ Đã thu → Đã thu)
        const changes = (Array.isArray(event.fieldChanges) ? event.fieldChanges : []).filter(c => JSON.stringify(c.old) !== JSON.stringify(c.new))
        const actor = event.actorUsername
          ? `${event.actorUsername}${event.actorRole ? ` · ${roleLabels[event.actorRole] || event.actorRole}` : ''}`
          : 'Hệ thống'
        return (
          <li key={event.id} className={`rounded-xl border bg-white p-3 text-sm ${index === 0 ? 'border-orange-200 ring-1 ring-orange-100' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-slate-800">
                {actionLabel(event.action)}
                <span className="ml-2 text-xs font-normal text-slate-500">{documentLabels[event.documentType] || event.documentType}{event.documentVersion ? ` · phiên bản ${event.documentVersion}` : ''}</span>
              </p>
              <span className="text-xs tabular-nums text-slate-500">{when(event.createdAt)}</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{actor}{event.channel === 'EMAIL' ? ' · qua email' : ''}</p>
            {changes.length > 0 && (
              <ul className="mt-2 space-y-0.5 rounded-lg bg-slate-50 p-2 text-xs">
                {changes.map((c, i) => (
                  <li key={`${c.field}-${i}`}><span className="font-semibold">{fieldLabels[c.field] || c.field}:</span> <span className="text-slate-500 line-through">{showValue(c.old)}</span> → <span className="font-semibold">{showValue(c.new)}</span></li>
                ))}
              </ul>
            )}
            {event.note && <p className="mt-1.5 text-xs text-slate-600">Ghi chú: {event.note}</p>}
          </li>
        )
      })}
    </ol>
  )
}
