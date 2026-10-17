// A declaration's own booking direction differs from the other bookings of its stay.
export function declarationBookingSummary(declaration) {
  const bookings = declaration.bookings || []
  return {
    directBookings: bookings.filter(booking => booking.isDeclarationBooking === true
      && ['dropoff', 'pickup'].includes(booking.bookingType)),
    pickupBooking: bookings.find(booking => booking.bookingType?.toLowerCase() === 'pickup'
      && !['canceled', 'cancelled', 'rejected', 'expired'].includes(booking.status?.toLowerCase())),
  }
}
