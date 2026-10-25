export const journeySteps = [
  ['Sẵn sàng', 'Tài xế xác nhận đến khu chờ, sẵn sàng và nhận lệnh vào còn hạn.'],
  ['Cổng vào', 'Cổng quét biển số, đối soát khai báo và lệnh vào trước khi mở cổng.'],
  ['Đến điểm nhận', 'Xe đang trên đường tới điểm giao nhận. Tài xế xác nhận khi đã đến đúng điểm; chưa theo dõi GPS.'],
  ['Giao / nhận hàng', 'Nhân viên bãi hoàn tất thao tác hàng; tài xế kiểm tra và xác nhận từng container.'],
  ['Đến cổng ra', 'Đủ container của cùng booking đã hoàn tất. Tài xế đi theo tuyến tới cổng ra.'],
  ['Gate Out', 'Cổng ra quét biển số và kiểm tra cùng booking, lượt vào và toàn bộ xác nhận container.'],
  ['Hoàn thành', 'Xe đã được ghi nhận ra khỏi bãi; sức chứa được giải phóng cho xe tiếp theo.'],
]
export function journeyStep(booking, route) {
  const journey = route?.journey
  if (journey?.phase === 'exited' || journey?.gateOutAt) return 6
  if (journey?.phase === 'ready_for_gate_out') return route.navigation?.origin?.gateCode === journey.exitGateCode ? 5 : 4
  if (journey?.phase === 'at_yard') return 3
  if (route?.gateTransactionId) return 2
  return booking?.gateEntryOrder?.status === 'active' ? 1 : 0
}
// One vehicle/booking row remains selected when it moves from queue into yard.
// Multiple containers are shown inside the detail instead of duplicating trucks.
export function dispatchVehicles(bookings, routes) {
  const byId = new Map(bookings.map(booking => [booking.id, { id: booking.id, booking, routes: [] }]))
  for (const route of routes) {
    const row = byId.get(route.bookingId) || { id: route.bookingId, booking: null, routes: [] }
    row.routes.push(route)
    byId.set(row.id, row)
  }
  return [...byId.values()].map(row => ({ ...row, group: row.routes.length
    ? row.routes.every(route => route.journey?.phase === 'exited') ? 'exited' : 'inside' : 'queue' }))
}
