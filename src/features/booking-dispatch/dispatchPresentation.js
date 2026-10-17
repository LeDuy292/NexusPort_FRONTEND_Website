export const DISPATCH_STATUS = {
  'not-arrived': 'Chưa xác nhận đến',
  arrived: 'Đã đến · chưa sẵn sàng',
  ready: 'Sẵn sàng · chờ gọi',
  called: 'Đã gọi · chờ phản hồi',
  acknowledged: 'Tài xế đã nhận lệnh',
}

export const stateOf = booking => booking.dispatch?.status === 'withdrawn'
  ? 'not-arrived' : booking.dispatch?.status || 'not-arrived'

export const displayState = booking => booking.coordination?.isHeld ? 'held' : stateOf(booking)
export const statusLabel = booking => booking.coordination?.isHeld
  ? 'Điều độ yêu cầu chờ' : DISPATCH_STATUS[stateOf(booking)]

export const vietnamDate = value => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Ho_Chi_Minh',
}).format(new Date(value))

export const dateTime = value => value ? new Date(value).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
}) : '—'
