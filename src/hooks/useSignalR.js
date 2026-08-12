import { useEffect } from 'react'
import websocketService from '../services/websocketService'

export default function useSignalR(hubUrl, eventName, onMessageReceived) {
  useEffect(() => {
    if (!hubUrl) return

    // Kết nối websocket
    websocketService.connect(hubUrl)
      .then(() => {
        // Đăng ký lắng nghe sự kiện
        websocketService.subscribe(eventName, onMessageReceived)
      })
      .catch(err => console.error('Error starting SignalR connection:', err))

    return () => {
      // Hủy đăng ký và ngắt kết nối khi component bị hủy
      websocketService.unsubscribe(eventName, onMessageReceived)
      websocketService.disconnect()
    }
  }, [hubUrl, eventName, onMessageReceived])
}
