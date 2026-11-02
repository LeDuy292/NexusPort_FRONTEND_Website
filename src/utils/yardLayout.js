export const YARD_ZONE_COLORS = { A: '#185bb8', B: '#006b73', C: '#7546a7', D: '#40546f', S: '#a65300' }

export function slotsForArea(area, slots = []) {
  return slots.filter(slot => slot.block === area.zone && Number(slot.bay) === area.bay && area.rows.includes(Number(slot.row)))
}

export function slotState(slot) {
  const status = String(slot.status || '').toLowerCase()
  if (slot.containerId || status === 'occupied' || status === 'full') return 'occupied'
  return ['empty', 'reserved', 'maintenance'].includes(status) ? status : 'unknown'
}

export function slotStateLabel(slot) {
  return { occupied: 'Đang sử dụng', reserved: 'Đã giữ chỗ', empty: 'Trống', maintenance: 'Bảo trì', unknown: 'Chưa xác định' }[slotState(slot)]
}

export function summarizeSlots(slots) {
  return slots.reduce((counts, slot) => {
    counts[slotState(slot)] += 1
    counts.total += 1
    return counts
  }, { total: 0, occupied: 0, reserved: 0, maintenance: 0, empty: 0, unknown: 0 })
}
