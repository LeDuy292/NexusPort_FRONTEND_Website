const REALTIME_URL = import.meta.env.VITE_REALTIME_URL || 'http://localhost:4000'
const EVENT_NAME = 'yard.operation.completed'

const getToken = () => {
  try {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
    return stored ? JSON.parse(stored)?.token : null
  } catch {
    return null
  }
}

export function connectDriverRealtime(onOperationCompleted, onConnectionError) {
  const token = getToken()
  if (!token) return () => {}

  try {
    // Dynamic import fallback for build stability
    const io = window?.io;
    if (typeof io === 'function') {
      const socket = io(REALTIME_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
      })
      socket.on(EVENT_NAME, onOperationCompleted)
      socket.on('connect_error', onConnectionError)

      return () => {
        socket.off(EVENT_NAME, onOperationCompleted)
        socket.off('connect_error', onConnectionError)
        socket.disconnect()
      }
    }
  } catch (err) {
    if (onConnectionError) onConnectionError(err)
  }

  return () => {}
}
