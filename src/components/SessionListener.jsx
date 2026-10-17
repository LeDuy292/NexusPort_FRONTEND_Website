import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { io } from 'socket.io-client'

const getRealtimeUrl = () => {
  if (import.meta.env.VITE_REALTIME_URL) {
    return import.meta.env.VITE_REALTIME_URL
  }
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.startsWith('http')) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  }
  return 'http://localhost:3001'
}

/**
 * SessionListener: Lắng nghe sự kiện realtime trên toàn ứng dụng.
 * Khi tài khoản đăng nhập ở trình duyệt / thiết bị khác, server sẽ gửi sự kiện 'auth:session_kicked'.
 * Listener này lập tức dọn sạch token/storage và điều hướng về /login?kicked=true.
 */
export default function SessionListener() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Không kết nối socket khi đang ở trang đăng nhập
    if (location.pathname.startsWith('/login')) {
      return
    }

    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user')
    let token = null
    try {
      if (storedUser) {
        token = JSON.parse(storedUser)?.token
      }
    } catch (_) {}

    if (!token) {
      token = localStorage.getItem('token') || sessionStorage.getItem('token')
    }

    if (!token) return

    const socket = io(getRealtimeUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    })

    const handleKicked = (data) => {
      console.warn('[SessionListener] Phiên làm việc đã bị kết thúc:', data)
      try {
        localStorage.removeItem('user')
        localStorage.removeItem('token')
        sessionStorage.removeItem('user')
        sessionStorage.removeItem('token')
      } catch (_) {}

      try {
        socket.disconnect()
      } catch (_) {}

      navigate('/login?kicked=true', { replace: true })
    }

    socket.on('auth:session_kicked', handleKicked)

    socket.on('connect_error', (err) => {
      const msg = err?.message || ''
      if (
        msg.includes('Phiên làm việc đã bị kết thúc') ||
        msg.includes('SESSION_KICKED') ||
        msg.includes('không còn hợp lệ')
      ) {
        handleKicked({ reason: 'CONNECT_ERROR', message: msg })
      }
    })

    return () => {
      socket.off('auth:session_kicked', handleKicked)
      socket.disconnect()
    }
  }, [location.pathname, navigate])

  return null
}
