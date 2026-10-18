import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGatePassageSimulation, passageOpenSeconds } from '../src/services/gatePassageSimulation.js'

const cycle = (mode = 'checkin') => ({ mode, gate: { id: 'gate-id', code: mode === 'checkin' ? 'GATE-01' : 'GATE-03' },
  booking: { id: 'booking-id', licensePlate: '29Y3-036.58' },
  evidence: { verificationRecordId: 'verification-id', vehiclePlate: '29Y3-036.58' }, closeRequestId: 'close-id' })

function fixture(options = {}) {
  let time = 0
  const values = new Map()
  const events = []
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  const dependencies = {
    storage, now: () => time, wait: async ms => { time += ms },
    recordPassage: async job => { events.push(['passage', time, job.mode]); return { success: true } },
    closeBarrier: async job => { events.push(['close', time, job.closeRequestId]); return { status: 'simulated' } },
    ...options,
  }
  const simulator = createGatePassageSimulation(dependencies)
  return { simulator, dependencies, events, values, setTime: value => { time = value } }
}

test('duration defaults to 10 seconds and only accepts whole values in 3–120', () => {
  for (const value of [undefined, '', 'bad', 0, -1, 2, 121, 4.5]) assert.equal(passageOpenSeconds(value), 10)
  for (const value of [3, '15', 120]) assert.equal(passageOpenSeconds(value), Number(value))
})

for (const mode of ['checkin', 'checkout']) {
  test(`${mode}: wait before recording passage, then close and clear recovery`, async () => {
    const f = fixture()
    const states = []
    f.simulator.subscribe(state => states.push(state))
    const result = await f.simulator.start(cycle(mode), 10)
    assert.deepEqual(f.events, [['passage', 10000, mode], ['close', 10000, 'close-id']])
    assert.equal(states[0].secondsRemaining, 10)
    assert.equal(states.at(-1).stage, 'completed')
    assert.equal(result.passageRecorded, true)
    assert.equal(result.barrierClosed, true)
    assert.equal(f.simulator.pending(), null)
  })
}

test('a configured duration is honored', async () => {
  const f = fixture()
  await f.simulator.start(cycle(), 15)
  assert.equal(f.events[0][1], 15000)
})

test('a passage failure closes the barrier, retains evidence and never publishes completion', async () => {
  const f = fixture({ recordPassage: async () => { throw new Error('offline') } })
  const states = []
  f.simulator.subscribe(state => states.push(state))
  await assert.rejects(f.simulator.start(cycle(), 3), /offline/)
  assert.equal(states.at(-1).stage, 'error')
  assert.equal(states.some(s => s.stage === 'completed'), false)
  assert.equal(f.simulator.pending().passageRecorded, false)
  assert.equal(f.simulator.pending().barrierClosed, true)
  assert.equal(f.simulator.pending().evidence.verificationRecordId, 'verification-id')
  assert.deepEqual(f.events, [['close', 3000, 'close-id']])
})

test('an HTTP success containing business failure is not treated as passage', async () => {
  const f = fixture({ recordPassage: async () => ({ success: false, message: 'permission expired' }) })
  await assert.rejects(f.simulator.start(cycle(), 3), /permission expired/)
  assert.equal(f.simulator.pending().passageRecorded, false)
})

test('retry after a close failure uses the same ID and does not repeat passage', async () => {
  let closes = 0
  const ids = []
  const f = fixture({ closeBarrier: async job => {
    closes++
    ids.push(job.closeRequestId)
    if (closes === 1) throw new Error('network')
    return { status: 'simulated' }
  } })
  await assert.rejects(f.simulator.start(cycle(), 3), /network/)
  assert.equal(f.simulator.pending().passageRecorded, true)
  await f.simulator.resume()
  assert.deepEqual(ids, ['close-id', 'close-id'])
  assert.equal(f.events.filter(event => event[0] === 'passage').length, 1)
  assert.equal(f.simulator.pending(), null)
})

test('refresh recovery honors the stored deadline instead of starting a new countdown', async () => {
  const f = fixture()
  const key = 'nexusport.gate-passage-simulation.v1'
  f.values.set(key, JSON.stringify({ ...cycle(), dueAt: 10000, passageRecorded: false, barrierClosed: false }))
  f.setTime(6000)
  const recovered = createGatePassageSimulation(f.dependencies)
  const states = []
  recovered.subscribe(state => states.push(state))
  await recovered.resume()
  assert.equal(states[0].secondsRemaining, 4)
  assert.equal(f.events[0][1], 10000)
})

test('overlapping resumes reuse one operation and a pending cycle prevents another vehicle', async () => {
  let release
  const f = fixture({ wait: () => new Promise(resolve => { release = resolve }) })
  const first = f.simulator.start(cycle(), 10)
  const second = f.simulator.resume()
  assert.equal(first, second)
  assert.throws(() => f.simulator.start(cycle('checkout'), 10), /chưa hoàn tất/)
  f.setTime(10000)
  release()
  await first
  assert.equal(f.events.filter(event => event[0] === 'passage').length, 1)
})

test('an unaccepted close command remains retryable', async () => {
  const f = fixture({ closeBarrier: async () => ({ status: 'requested' }) })
  await assert.rejects(f.simulator.start(cycle(), 3), /chưa được chấp nhận/)
  assert.equal(f.simulator.pending().barrierClosed, false)
})
