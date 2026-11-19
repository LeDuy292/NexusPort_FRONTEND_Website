import { test } from 'node:test'
import assert from 'node:assert/strict'
import { journeyStep } from '../src/features/booking-dispatch/dispatchJourney.js'

test('no timer or assumed GPS advances a trip beyond its confirmed milestones', () => {
  assert.equal(journeyStep({}, null), 0)
  assert.equal(journeyStep({ gateEntryOrder: { status: 'active' } }, null), 1)
  const route = { gateTransactionId: 'in', journey: { phase: 'to_yard' } }
  assert.equal(journeyStep(null, route), 2)
  route.journey.phase = 'at_yard'
  assert.equal(journeyStep(null, route), 3)
  route.journey.phase = 'ready_for_gate_out'
  route.journey.exitGateCode = 'GATE-02'
  assert.equal(journeyStep(null, route), 4)
  route.navigation = { origin: { gateCode: 'GATE-02' } }
  assert.equal(journeyStep(null, route), 5)
  route.journey.gateOutAt = '2026-10-18T10:00:00Z'
  assert.equal(journeyStep(null, route), 6)
})
