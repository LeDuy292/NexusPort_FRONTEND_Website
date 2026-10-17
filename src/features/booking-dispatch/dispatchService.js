import { io } from 'socket.io-client'
import apiClient from '../../services/apiClient'

export async function getDispatchBoard(date) {
  const response = await apiClient.get('/booking-dispatch/board', { params: { date } })
  return response.data.data
}
export async function updateDispatch(booking, action, values = {}) {
  const response = await apiClient.post('/booking-dispatch/' + booking.id + '/' + action,
    { ...values, expectedVersion: booking.dispatch?.version || 0 })
  return response.data.data.booking
}
export function connectDispatchBoard({ onChange, onConnected, onDisconnected }) {
  let token
  try { token = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}').token } catch { return () => {} }
  if (!token) return () => {}
  const url = import.meta.env.VITE_DISPATCH_SOCKET_URL ||
    new URL(import.meta.env.VITE_API_URL || '/api', window.location.origin).origin
  const socket = io(url, { auth: { token }, transports: ['websocket', 'polling'], reconnection: true })
  socket.on('booking:dispatch_updated', onChange)
  socket.on('connect', onConnected)
  socket.on('disconnect', onDisconnected)
  socket.on('connect_error', onDisconnected)
  return () => { socket.removeAllListeners(); socket.disconnect() }
}
