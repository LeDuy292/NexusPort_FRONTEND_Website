import { useEffect, useRef, useState } from 'react'
import { driverSmartRouteService } from '../../services/driverSmartRouteService'
import { connectDispatchBoard, connectYardMonitor } from './dispatchService'

export function useYardMonitor() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const reloadRef = useRef(async () => {})
  useEffect(() => {
    let active = true, pending = false, retry = false
    async function reload() {
      if (!active) return
      if (pending) { retry = true; return }
      pending = true
      setLoading(true)
      try {
        const next = await driverSmartRouteService.monitor()
        if (active) { setData(next); setError('') }
      } catch (err) {
        if (active) setError(`${err.message || 'Không tải được trạng thái xe.'}${err.status ? ` (HTTP ${err.status})` : ''}`)
      }
      finally { pending = false; if (active) { setLoading(false); if (retry) { retry = false; void reload() } } }
    }
    reloadRef.current = reload
    void reload()
    const cleanup = connectDispatchBoard({ onChange: reload, onConnected: reload })
    const cleanupYard = connectYardMonitor(reload)
    const timer = setInterval(() => { if (!document.hidden) void reload() }, 15000)
    window.addEventListener('focus', reload)
    return () => { active = false; cleanup(); cleanupYard(); clearInterval(timer); window.removeEventListener('focus', reload) }
  }, [])

  return { data, error, loading, reload: () => reloadRef.current() }
}
