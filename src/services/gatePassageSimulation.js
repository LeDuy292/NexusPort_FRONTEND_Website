// This adapter supplies a passage event until a crossing sensor is available.
// Keep it separate from recognition and from hardware acknowledgments.
export const passageOpenSeconds = (value) => {
  const seconds = Number(value)
  return Number.isInteger(seconds) && seconds >= 3 && seconds <= 120 ? seconds : 10
}

export function createGatePassageSimulation({ storage, recordPassage, closeBarrier,
  now = Date.now, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const key = 'nexusport.gate-passage-simulation.v1'
  let running = null
  const listeners = new Set()
  let state = null
  const publish = (cycle, stage, error = '') => {
    state = { ...cycle, stage, error, secondsRemaining: Math.max(0, Math.ceil((cycle.dueAt - now()) / 1000)) }
    for (const listener of listeners) listener(state)
  }
  const pending = () => {
    const saved = storage.getItem(key)
    return saved ? JSON.parse(saved) : null
  }
  const save = cycle => storage.setItem(key, JSON.stringify(cycle))

  const run = cycle => {
    if (running) return running
    // Persist immutable gate/booking/evidence and IDs before starting the timer.
    save(cycle)
    running = (async () => {
      let failure = null
      try {
        while (now() < cycle.dueAt) {
          publish(cycle, 'waiting')
          await wait(Math.min(250, cycle.dueAt - now()))
        }
        if (!cycle.passageRecorded) {
          publish(cycle, 'recording')
          const result = await recordPassage(cycle)
          if (result?.success === false) throw new Error(result.message || 'Không ghi nhận được xe qua cổng.')
          cycle.passageRecorded = true
          save(cycle)
        }
      } catch (error) { failure = error }

      // Close even when passage recording fails. A retry reuses the evidence
      // and the close request ID, and never repeats a successful passage call.
      if (!cycle.barrierClosed) {
        try {
          publish(cycle, 'closing')
          const result = await closeBarrier(cycle)
          if (!['simulated', 'acknowledged'].includes(result?.status)) {
            throw new Error('Lệnh đóng barie chưa được chấp nhận.')
          }
          cycle.barrierClosed = true
          save(cycle)
        } catch (error) {
          failure = new Error([failure?.message, `Không đóng được barie: ${error.message}`].filter(Boolean).join(' '))
        }
      }
      if (failure) {
        publish(cycle, 'error', failure.message)
        throw failure
      }
      storage.removeItem(key)
      publish(cycle, 'completed')
      return cycle
    })().finally(() => { running = null })
    return running
  }

  return {
    pending,
    subscribe(listener) {
      listeners.add(listener)
      if (state && pending()) listener(state)
      return () => listeners.delete(listener)
    },
    start(cycle, seconds) {
      if (pending()) throw new Error('Còn lượt qua cổng chưa hoàn tất. Vui lòng thử lại cập nhật lượt đó.')
      return run({ ...cycle, dueAt: now() + passageOpenSeconds(seconds) * 1000,
        passageRecorded: false, barrierClosed: false })
    },
    resume() {
      const cycle = pending()
      return cycle ? run(cycle) : Promise.resolve(null)
    },
  }
}
