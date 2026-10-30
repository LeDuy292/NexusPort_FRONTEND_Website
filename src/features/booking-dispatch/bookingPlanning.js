export function bookingWindow(date, startTime, endTime) {
  if (!date || !startTime || !endTime) throw new Error('Chọn ngày và giờ hẹn.')
  // Browser-local input is converted once to UTC; never append Z to local text.
  const start = new Date(`${date}T${startTime}:00`)
  const end = new Date(`${date}T${endTime}:00`)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || end - start > 86400000) {
    throw new Error('Giờ bắt đầu phải trước giờ kết thúc; khung giờ tối đa 24 giờ.')
  }
  return { appointmentStart: start.toISOString(), appointmentEnd: end.toISOString() }
}

export function suggestedBookingWindow(option) {
  const start = new Date(option.appointmentStart)
  const end = new Date(option.appointmentEnd)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || start.toDateString() !== end.toDateString()) {
    throw new Error('Khung giờ gợi ý không phù hợp với ngày hẹn. Vui lòng chọn lại.')
  }
  const pad = value => String(value).padStart(2, '0')
  return { appointmentDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`, endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}` }
}

export function sourceOperation(source) {
  const cargoType = ({ general: 'General', reefer: 'Reefer', dangerous: 'DangerousGoods', dangerous_goods: 'DangerousGoods', oversized: 'Oversized', perishable: 'Perishable', overweight: 'Overweight' })[source.cargoType] || ''
  return { containerNumber: source.containerNumber, containerIsoSize: source.containerTypeCode,
    cargoType, cargoStatus: source.loadStatus === 'full' ? 'Loaded' : 'Empty',
    sealNumber: source.sealNumber || '', grossWeightKg: source.grossWeightKg ?? null }
}

export function retainAvailableFleet(selection, fleet, automatic = false) {
  if (automatic) return {
    truckId: fleet.trucks.find(t => t.id === fleet.recommendedTruckId)?.id || '',
    driverId: fleet.drivers.find(d => d.id === fleet.recommendedDriverId)?.id || '',
  }
  return {
    truckId: fleet.trucks.some(t => t.id === selection.truckId) ? selection.truckId : (fleet.trucks.find(t => t.id === fleet.recommendedTruckId)?.id || ''),
    driverId: fleet.drivers.some(d => d.id === selection.driverId) ? selection.driverId : (fleet.drivers.find(d => d.id === fleet.recommendedDriverId)?.id || ''),
  }
}
