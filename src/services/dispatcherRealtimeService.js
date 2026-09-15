const REALTIME_URL = import.meta.env.VITE_REALTIME_URL || 'http://localhost:4000'
const EVENT_NAME = 'dispatcher.status.updated'

const getToken = () => {
  try {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
    return stored ? JSON.parse(stored)?.token : null
  } catch {
    return null
  }
}

export function connectDispatcherRealtime(onStatusUpdated, onConnectionError) {
  const token = getToken()
  if (!token) return () => {}

  try {
    const io = window?.io;
    if (typeof io === 'function') {
      const socket = io(REALTIME_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
      })
      socket.on(EVENT_NAME, onStatusUpdated)
      socket.on('connect_error', onConnectionError)

      return () => {
        socket.off(EVENT_NAME, onStatusUpdated)
        socket.off('connect_error', onConnectionError)
        socket.disconnect()
      }
    }
  } catch (err) {
    if (onConnectionError) onConnectionError(err)
  }

  return () => {}
}

export default connectDispatcherRealtime
