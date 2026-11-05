import { bookingWindow, suggestedBookingWindow } from './bookingPlanning.js'

export const cargoLabels = { general: 'Hàng bách hóa', reefer: 'Hàng lạnh', dangerous: 'Hàng nguy hiểm', dangerous_goods: 'Hàng nguy hiểm', perishable: 'Hàng dễ hư hỏng', oversized: 'Hàng quá khổ', overweight: 'Hàng quá tải' }
export const sourceKey = row => `${row.containerId}:${row.declarationId}`
export const windowsOverlap = (a, b) => a.appointmentStart < b.appointmentEnd && a.appointmentEnd > b.appointmentStart
export const normalizedPlate = value => (value || '').replace(/[^a-z0-9]/gi, '').toUpperCase()
export function submissionTrip(source, window = {}) {
  return { ...source, ...window, sealNumber: source.sealNumber || '', vgmKg: source.vgmKg ?? '',
    targetTemperature: source.targetTemperature ?? '', unNumber: source.unNumber || '', dgClass: source.dgClass || '',
    truckId: source.truckId || '', driverId: source.driverId || '', trailerNumber: source.trailerNumber || '',
    isReeferPowerRequired: Boolean(source.isReeferPowerRequired || (source.cargoType === 'reefer' && Number(source.requiredPowerKw) > 0)), documents: source.documents || [] }
}
export function buildSubmission({ shippingLineId, voyageId, description, trips, sharedDocuments = [], sharedDocumentsConfirmed = false, bookingId, expectedVersion, pickup }) {
  return { ...(bookingId ? { bookingId, expectedVersion } : {}), shippingLineId, voyageId, description: description || null,
    ...(pickup ? { pickup: { containerId: pickup.containerId, yardCode: (pickup.yardCode || '').trim().toUpperCase(),
      targetTemperature: pickup.targetTemperature === '' || pickup.targetTemperature == null ? null : Number(pickup.targetTemperature),
      unNumber: pickup.unNumber || null, dgClass: pickup.dgClass || null, documents: pickup.documents || [] } } : {}),
    sharedDocuments, sharedDocumentsConfirmed, trips: trips.map(trip => ({ containerId: trip.containerId, declarationId: trip.declarationId,
      sealNumber: trip.sealNumber.trim(), vgmKg: Number(trip.vgmKg), targetTemperature: trip.targetTemperature === '' || trip.targetTemperature == null ? null : Number(trip.targetTemperature),
      unNumber: trip.unNumber || null, dgClass: trip.dgClass || null, ...bookingWindow(trip.appointmentDate, trip.startTime, trip.endTime),
      truckId: trip.truckId || null, driverId: trip.driverId || null, trailerNumber: trip.trailerNumber || null,
      isReeferPowerRequired: Boolean(trip.isReeferPowerRequired), documents: trip.documents })) }
}
export function tripFromSubmission(trip, source) {
  return submissionTrip({ ...source, ...trip }, suggestedBookingWindow(trip))
}
export function availableForTrip(values, field, index, trips) {
  const target = bookingWindow(trips[index].appointmentDate, trips[index].startTime, trips[index].endTime)
  return values.filter(value => !trips.some((other, i) => {
    if (i === index) return false
    const matches = field === 'trailerNumber' ? normalizedPlate(other[field]) === normalizedPlate(value.trailerNumber) : other[field] === value.id
    return matches && windowsOverlap(target, bookingWindow(other.appointmentDate, other.startTime, other.endTime))
  }))
}
