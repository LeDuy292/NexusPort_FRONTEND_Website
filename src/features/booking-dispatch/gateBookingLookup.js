import { normalizePlate } from '../../utils/format.js'

// A plate may have many historical bookings. Only an explicitly entered booking
// code may override the server's selection by the current gate entry permission.
export function gateBookingLookup(bookings, query) {
  const text = String(query ?? '').trim().toUpperCase()
  const explicit = text && bookings.find(b =>
    String(b.bookingCode || b.bookingNumber || '').toUpperCase() === text)
  if (explicit) return { profileBooking: explicit, bookingNumber: explicit.bookingCode || explicit.bookingNumber }
  const key = normalizePlate(text)
  const profileBooking = key ? bookings.find(b =>
    ['approved', 'ready', '2'].includes(String(b.status).toLowerCase()) &&
    normalizePlate(b.vehiclePlate || b.licensePlate) === key) : undefined
  return { profileBooking, bookingNumber: undefined }
}
