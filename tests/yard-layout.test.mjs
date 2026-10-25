import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { slotsForArea, slotState, summarizeSlots } from '../src/utils/yardLayout.js'
const plan = JSON.parse(fs.readFileSync(new URL('../src/data/referenceYardLayout.json', import.meta.url)))

test('source numbering and the two gate identities remain intact', () => {
  assert.equal(plan.areas.length, 66)
  assert.equal(plan.areas.flatMap(area => area.rows).length, 376)
  assert.deepEqual(plan.areas.find(area => area.code === 'C12').rows, [5, 6, 7, 8, 9])
  assert.deepEqual(plan.gates.map(gate => gate.code), ['GATE-01', 'GATE-02'])
})
test('a position requires exact block, bay and original row numbering', () => {
  const area = plan.areas.find(area => area.code === 'B11')
  const slots = [{ id: 'valid', block: 'B', bay: 11, row: 3, tier: 1 }, { id: 'invalid-row', block: 'B', bay: 11, row: 1 }, { id: 'alias', block: 'B11', bay: 11, row: 3 }]
  assert.deepEqual(slotsForArea(area, slots).map(slot => slot.id), ['valid'])
})
test('unconfigured and unknown inventory never becomes free capacity', () => {
  assert.equal(summarizeSlots([]).total, 0)
  const summary = summarizeSlots([{ status: 'reserved' }, { status: 'maintenance' }, { status: 'empty' }, { status: 'unrecognized' }, { status: 'empty', containerId: 'current-container' }])
  assert.deepEqual(summary, { total: 5, occupied: 1, reserved: 1, maintenance: 1, empty: 1, unknown: 1 })
  assert.equal(slotState({ status: 'empty', containerId: 'current-container' }), 'occupied')
})
