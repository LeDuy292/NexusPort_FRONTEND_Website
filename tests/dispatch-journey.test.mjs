import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dispatchVehicles, journeyStep } from '../src/features/booking-dispatch/dispatchJourney.js'

test('selection identity survives Gate In and multi-container trips remain one vehicle', () => {
  const booking = { id: 'booking-1' }
  const entered = [{ bookingId: booking.id, containerId: 'a', gateTransactionId: 'in', journey: { phase: 'to_yard' } },
    { bookingId: booking.id, containerId: 'b', gateTransactionId: 'in', journey: { phase: 'at_yard' } }]
  const before = dispatchVehicles([booking], [])
  const duringRefresh = dispatchVehicles([booking], entered)
  const after = dispatchVehicles([], entered)
  assert.equal(before[0].id, after[0].id)
  assert.equal(duringRefresh.length, 1)
  assert.equal(after[0].routes.length, 2)
  assert.equal(after[0].group, 'inside')
})
test('a trip is completed only when every route reports physical Gate Out', () => {
  const routes = [{ bookingId: 'a', journey: { phase: 'exited' } }, { bookingId: 'a', journey: { phase: 'ready_for_gate_out' } }]
  assert.equal(dispatchVehicles([], routes)[0].group, 'inside')
  routes[1].journey.phase = 'exited'
  assert.equal(dispatchVehicles([], routes)[0].group, 'exited')
})
test('no timer or assumed GPS advances a trip beyond its confirmed milestones', () => {
  assert.equal(journeyStep({}, null), 0)
  assert.equal(journeyStep({ gateEntryOrder: { status: 'active' } }, null), 1)
  const route = { gateTransactionId: 'in', journey: { phase: 'to_yard' } }
  assert.equal(journeyStep(null, route), 2)
  route.journey.phase = 'at_yard'
  assert.equal(journeyStep(null, route), 3)
  route.journey.phase = 'ready_for_gate_out'
  route.journey.exitGateCode = 'GATE-03'
  assert.equal(journeyStep(null, route), 4)
  route.navigation = { origin: { gateCode: 'GATE-03' } }
  assert.equal(journeyStep(null, route), 5)
  route.journey.gateOutAt = '2026-10-18T10:00:00Z'
  assert.equal(journeyStep(null, route), 6)
})
