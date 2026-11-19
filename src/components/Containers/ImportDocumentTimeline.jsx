const documentLabels = { PRE_ALERT: 'Pre-alert', BL: 'Vận đơn B/L', ARRIVAL_NOTICE: 'Arrival Notice', DO: 'Lệnh giao hàng (D/O)', PAYMENT: 'Phí' }
const actionLabels = {
  RECEIVED: 'Đã nhận', CONSIGNEE_ASSIGNED: 'Gắn Transport company', RECONCILED: 'Đối chiếu khớp manifest', MISMATCH_FOUND: 'Phát hiện lệch manifest',
  ORIGIN_REPLIED: 'Đầu xuất trả lời', SENT: 'Đã gửi', CONFIRMED: 'Đã xác nhận', REVISION_REQUESTED: 'Yêu cầu sửa', AMENDMENT_ACCEPTED: 'Chấp nhận yêu cầu sửa',
  AMENDMENT_REJECTED: 'Từ chối yêu cầu sửa', AUTO_ACCEPTED: 'Tự giữ nguyên do quá hạn', FEES_COLLECTED: 'Đã thu phí', SURRENDERED: 'Đã thu hồi B/L gốc',
  AUTHORIZATION_UPLOADED: 'Tải lên giấy ủy quyền', REQUESTED: 'Yêu cầu lấy D/O', RELEASE_VERIFIED: 'Đủ điều kiện nhận hàng', RELEASE_BLOCKED: 'Chưa đủ điều kiện nhận hàng',
  ISSUED: 'Đã phát hành', ACCOMPLISHED: 'B/L gốc hết hiệu lực',
}
const when = value => (value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '')
const show = value => (value == null || value === '' ? '—' : String(value))

/** Dòng thời gian hồ sơ hàng nhập: người thực hiện, thời điểm, kênh, trường đổi và ghi chú. */
export default function ImportDocumentTimeline({ events }) {
  const rows = events || []
  if (rows.length === 0) return <p className="text-sm text-slate-500">Chưa có hoạt động nào.</p>
  return (
    <ol className="space-y-2">
      {rows.map(event => (
        <li key={event.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-slate-800">
              {documentLabels[event.documentType] || event.documentType} · {actionLabels[event.action] || event.action}
              {event.documentVersion ? <span className="ml-2 text-xs font-normal text-slate-500">phiên bản {event.documentVersion}</span> : null}
            </p>
            <span className="text-xs text-slate-500">{when(event.createdAt)}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{event.actorUsername ? `${event.actorUsername}${event.actorRole ? ` (${event.actorRole})` : ''}` : 'Hệ thống'} · {event.channel === 'SYSTEM' ? 'Hệ thống' : event.channel === 'EMAIL' ? 'Email' : 'Cổng thông tin'}</p>
          {Array.isArray(event.fieldChanges) && event.fieldChanges.length > 0 && (
            <ul className="mt-2 space-y-0.5 rounded bg-slate-50 p-2 text-xs">
              {event.fieldChanges.map((c, i) => (
                <li key={`${c.field}-${i}`}><span className="font-semibold">{c.field}:</span> <span className="text-slate-500 line-through">{show(c.old)}</span> → <span className="font-semibold">{show(c.new)}</span></li>
              ))}
            </ul>
          )}
          {event.note && <p className="mt-1.5 text-xs text-slate-600">Ghi chú: {event.note}</p>}
        </li>
      ))}
    </ol>
  )
}
