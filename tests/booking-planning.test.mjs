import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bookingWindow, suggestedBookingWindow, sourceOperation, retainAvailableFleet } from '../src/features/booking-dispatch/bookingPlanning.js'

test('suggested windows populate local gate date and time without appending a false UTC suffix', () => {
  const start = new Date(2026, 9, 31, 12, 0)
  const end = new Date(2026, 9, 31, 14, 0)
  assert.deepEqual(suggestedBookingWindow({ appointmentStart: start.toISOString(), appointmentEnd: end.toISOString() }), {
    appointmentDate: '2026-10-31', startTime: '12:00', endTime: '14:00',
  })
  assert.throws(() => suggestedBookingWindow({ appointmentStart: 'invalid', appointmentEnd: 'invalid' }))
  assert.throws(() => suggestedBookingWindow({ appointmentStart: start.toISOString(), appointmentEnd: new Date(2026, 10, 1, 1, 0).toISOString() }))
})

test('booking times preserve the user local time when serialized to UTC', () => {
  const result = bookingWindow('2026-10-30', '08:00', '10:00')
  const local = new Date(result.appointmentStart)
  assert.equal(local.getHours(), 8)
  assert.equal(local.getDate(), 30)
  assert.equal(new Date(result.appointmentEnd) - local, 2 * 3600000)
})

test('invalid, reversed or excessively long appointment windows cannot be submitted', () => {
  for (const args of [['', '08:00', '10:00'], ['2026-10-30', '10:00', '08:00'], ['invalid', '08:00', '10:00']])
    assert.throws(() => bookingWindow(...args))
})

test('cargo is inherited without inventing mass, seal or dangerous cargo defaults', () => {
  const result = sourceOperation({ containerNumber: 'MSKU9082103', containerTypeCode: '40RF', cargoType: 'reefer', loadStatus: 'full' })
  assert.equal(result.cargoType, 'Reefer')
  assert.equal(result.grossWeightKg, null)
  assert.equal(result.sealNumber, '')
  assert.equal(sourceOperation({ cargoType: null }).cargoType, '')
  assert.equal(sourceOperation({ cargoType: 'dangerous' }).cargoType, 'DangerousGoods')
})

test('changing the window removes stale fleet IDs and accepts only available recommendations', () => {
  const fleet = { trucks: [{ id: 'new-truck' }], drivers: [{ id: 'new-driver' }], recommendedTruckId: 'new-truck', recommendedDriverId: 'new-driver' }
  assert.deepEqual(retainAvailableFleet({ truckId: 'busy-truck', driverId: 'busy-driver' }, fleet), { truckId: 'new-truck', driverId: 'new-driver' })
  assert.deepEqual(retainAvailableFleet({ truckId: 'new-truck', driverId: 'new-driver' }, fleet), { truckId: 'new-truck', driverId: 'new-driver' })
  assert.deepEqual(retainAvailableFleet({ truckId: 'busy-truck', driverId: 'busy-driver' }, { trucks: [], drivers: [] }), { truckId: '', driverId: '' })
})

test('automatic mode replaces a valid old pair with the new optimal recommendation', () => {
  const fleet = { trucks: [{ id: 'old-truck' }, { id: 'best-truck' }], drivers: [{ id: 'old-driver' }, { id: 'best-driver' }], recommendedTruckId: 'best-truck', recommendedDriverId: 'best-driver' }
  const previous = { truckId: 'old-truck', driverId: 'old-driver' }
  assert.deepEqual(retainAvailableFleet(previous, fleet, true), { truckId: 'best-truck', driverId: 'best-driver' })
  assert.deepEqual(retainAvailableFleet(previous, fleet, false), previous)
  assert.deepEqual(retainAvailableFleet(previous, { ...fleet, recommendedTruckId: null, recommendedDriverId: null }, true), { truckId: '', driverId: '' })
})
