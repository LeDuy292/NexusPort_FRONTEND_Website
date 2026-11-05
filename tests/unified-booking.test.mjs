import test from 'node:test'
import assert from 'node:assert/strict'
import { submissionTrip, buildSubmission, availableForTrip, tripFromSubmission } from '../src/features/booking-dispatch/unifiedBooking.js'

const window = { appointmentDate: '2026-12-01', startTime: '08:00', endTime: '09:00' }
const source = { containerId: 'container-a', declarationId: 'declaration-a', containerNumber: 'MSCU1234566', cargoType: 'general', sealNumber: 'SEAL-A', grossWeightKg: 24000 }
test('source cargo weight never becomes verified VGM', () => {
  const trip = submissionTrip(source, window)
  assert.equal(trip.sealNumber, 'SEAL-A')
  assert.equal(trip.grossWeightKg, 24000)
  assert.equal(trip.vgmKg, '')
})
test('submission keeps exact private source and independent per-container appointments', () => {
  const a = { ...submissionTrip(source, window), vgmKg: '26000', truckId: 'truck-a', driverId: 'driver-a', trailerNumber: '43R-12345' }
  const b = { ...a, containerId: 'container-b', declarationId: 'declaration-b', startTime: '10:00', endTime: '11:00' }
  const request = buildSubmission({ shippingLineId: 'line-a', voyageId: 'voyage-a', trips: [a, b] })
  assert.equal(request.trips.length, 2)
  assert.equal(request.trips[0].vgmKg, 26000)
  assert.equal(request.trips[0].declarationId, 'declaration-a')
  assert.notEqual(request.trips[0].appointmentStart, request.trips[1].appointmentStart)
  assert.equal('carrierId' in request, false)
  assert.equal('status' in request, false)
})
test('overlapping trips exclude the already selected truck, driver and normalized trailer', () => {
  const trips = [{ ...submissionTrip(source, window), truckId: 'a', driverId: 'd', trailerNumber: '43R-123.45' }, submissionTrip(source, window)]
  assert.deepEqual(availableForTrip([{ id: 'a' }, { id: 'b' }], 'truckId', 1, trips), [{ id: 'b' }])
  assert.deepEqual(availableForTrip([{ id: 'd' }, { id: 'e' }], 'driverId', 1, trips), [{ id: 'e' }])
  assert.deepEqual(availableForTrip([{ trailerNumber: '43R12345' }, { trailerNumber: '43R99999' }], 'trailerNumber', 1, trips), [{ trailerNumber: '43R99999' }])
})
test('back-to-back appointments may reuse resources', () => {
  const trips = [{ ...submissionTrip(source, window), truckId: 'a' }, submissionTrip(source, { ...window, startTime: '09:00', endTime: '10:00' })]
  assert.deepEqual(availableForTrip([{ id: 'a' }], 'truckId', 1, trips), [{ id: 'a' }])
})
test('revising a pending request preserves the proposed appointment and verified cargo input', () => {
  const request = buildSubmission({ shippingLineId: 'l', voyageId: 'v', trips: [{ ...submissionTrip(source, window), vgmKg: 26000 }] })
  const restored = tripFromSubmission(request.trips[0], source)
  assert.equal(restored.startTime, '08:00')
  assert.equal(restored.vgmKg, 26000)
  assert.equal(restored.containerNumber, source.containerNumber)
})
test('two-way submission keeps one fleet assignment and a separate authorized pickup source', () => {
  const outgoing = { ...submissionTrip(source, window), vgmKg: 26000, truckId: 'truck-a', driverId: 'driver-a', trailerNumber: '43R-12345' }
  const pickup = { containerId: 'container-b', yardCode: ' tc-abcd-1234-5678 ', grossWeightKg: 19000, targetTemperature: '', documents: [{ documentType: 'BillOfLading', fileUrl: 'https://example.invalid/bl.pdf' }] }
  const request = buildSubmission({ shippingLineId: 'line-a', voyageId: 'voyage-a', trips: [outgoing], pickup })
  assert.equal(request.trips.length, 1)
  assert.equal(request.trips[0].truckId, 'truck-a')
  assert.equal(request.trips[0].vgmKg, 26000)
  assert.equal(request.pickup.containerId, 'container-b')
  assert.equal(request.pickup.yardCode, 'TC-ABCD-1234-5678')
  assert.equal(request.pickup.targetTemperature, null)
  assert.equal('grossWeightKg' in request.pickup, false)
  assert.equal('truckId' in request.pickup, false)
  assert.equal(request.pickup.documents.length, 1)
})
