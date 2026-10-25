import { useEffect, useRef, useState } from 'react'
import { connectDispatchBoard, connectYardMonitor, getDispatchBoard } from './dispatchService'

export function useDispatchBoard(date) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const reloadRef = useRef(async () => {})
  useEffect(() => {
    let active = true, busy = false, pending = false
    async function reload() {
      if (busy) { pending = true; return }
      busy = true
      try {
        const next = await getDispatchBoard(date)
        if (active) { setData(next); setError('') }
      } catch (err) { if (active) setError(err.message) }
      finally {
        busy = false
        if (active) {
          setLoading(false)
          if (pending) { pending = false; void reload() }
        }
      }
    }
    reloadRef.current = reload
    setLoading(true); setData(null); setConnected(false)
    void reload()
    const cleanup = connectDispatchBoard({
      onChange: () => { if (active) void reload() },
      onConnected: () => { if (active) { setConnected(true); void reload() } },
      onDisconnected: () => { if (active) setConnected(false) },
    })
    const timer = setInterval(() => { if (!document.hidden) void reload() }, 15000)
    const cleanupYard = connectYardMonitor(() => { if (active) void reload() })
    const onFocus = () => { if (!document.hidden) void reload() }
    document.addEventListener('visibilitychange', onFocus)
    return () => { active = false; cleanup(); cleanupYard(); clearInterval(timer); document.removeEventListener('visibilitychange', onFocus) }
  }, [date])
  return { data, loading, error, connected, reload: () => reloadRef.current() }
}
