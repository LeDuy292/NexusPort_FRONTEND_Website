import assert from 'node:assert/strict'
import { test } from 'node:test'
import { declarationBookingSummary } from './declarationBookingSummary.js'

const dropoff = { id: 'in', bookingType: 'dropoff', status: 'pending', isDeclarationBooking: true }
const pickup = { id: 'out', bookingType: 'pickup', status: 'pending', isDeclarationBooking: false }

test('the Pickup snapshot is labeled Pickup and opens the existing booking', () => {
  const summary = declarationBookingSummary({ isBooked: true, bookings: [
    { ...dropoff, isDeclarationBooking: false }, { ...pickup, isDeclarationBooking: true },
  ] })
  assert.deepEqual(summary.directBookings.map(b => b.bookingType), ['pickup'])
  assert.equal(summary.pickupBooking.id, 'out')
})

test('the original declaration stays Dropoff while its Pickup action opens the paired booking', () => {
  const summary = declarationBookingSummary({ bookings: [dropoff, pickup] })
  assert.deepEqual(summary.directBookings.map(b => b.id), ['in'])
  assert.equal(summary.pickupBooking.id, 'out')
})

test('missing direction never becomes a fabricated Dropoff', () => {
  assert.deepEqual(declarationBookingSummary({ isBooked: true }).directBookings, [])
  assert.deepEqual(declarationBookingSummary({ bookings: [{ isDeclarationBooking: true }] }).directBookings, [])
})

test('a canceled Pickup does not prevent booking a replacement; a completed Pickup remains viewable', () => {
  assert.equal(declarationBookingSummary({ bookings: [{ ...pickup, status: 'canceled' }] }).pickupBooking, undefined)
  assert.equal(declarationBookingSummary({ bookings: [{ ...pickup, status: 'completed' }] }).pickupBooking.id, 'out')
})
