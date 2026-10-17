import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
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

const getToken = () => {
  try {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed?.token) return parsed.token
    }
  } catch (_) {}
  return localStorage.getItem('token') || sessionStorage.getItem('token') || null
}

const performKickout = (reason = 'SESSION_KICKED') => {
  console.warn('[SessionListener] Thực hiện cưỡng chế đăng xuất:', reason)
  try {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    sessionStorage.removeItem('user')
    sessionStorage.removeItem('token')
  } catch (_) {}

  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login?kicked=true'
  }
}

/**
 * SessionListener: Giám sát phiên đăng nhập duy nhất (Single Active Session).
 * Tích hợp 4 lớp bảo vệ:
 * 1. Lắng nghe trực tiếp sự kiện 'auth:session_kicked' từ Socket.IO
 * 2. Bắt sự kiện ngắt kết nối cưỡng chế ('io server disconnect') từ máy chủ
 * 3. Polling kiểm tra trạng thái phiên mỗi 2.5 giây
 * 4. Kiểm tra ngay lập tức khi người dùng click chuột hoặc quay lại cửa sổ (window focus/visibilitychange)
 */
export default function SessionListener() {
  const location = useLocation()

  useEffect(() => {
    if (location.pathname.startsWith('/login')) {
      return
    }

    const token = getToken()
    if (!token) return

    // 1 & 2: Socket.IO listener
    const socket = io(getRealtimeUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    socket.on('auth:session_kicked', (data) => {
      console.warn('[SessionListener] auth:session_kicked received:', data)
      performKickout('SOCKET_EVENT')
    })

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        performKickout('IO_SERVER_DISCONNECT')
      }
    })

    socket.on('connect_error', (err) => {
      const msg = err?.message || ''
      if (
        msg.includes('Phiên làm việc đã bị kết thúc') ||
        msg.includes('SESSION_KICKED') ||
        msg.includes('không còn hợp lệ')
      ) {
        performKickout('CONNECT_ERROR')
      }
    })

    // 3: Heartbeat liveness check (mỗi 2.5 giây)
    const checkSessionLiveness = async () => {
      const currentToken = getToken()
      if (!currentToken) return

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${currentToken}`,
            'Cache-Control': 'no-cache',
          },
        })
        if (res.status === 401) {
          const body = await res.json().catch(() => ({}))
          if (body.code === 'SESSION_KICKED' || !body.success) {
            performKickout('HEARTBEAT_401')
          }
        }
      } catch (_) {}
    }

    const heartbeatInterval = setInterval(checkSessionLiveness, 2500)

    // 4: Kiểm tra ngay lập tức khi user focus / đổi tab
    const handleWindowFocus = () => {
      checkSessionLiveness()
    }

    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener('visibilitychange', handleWindowFocus)

    return () => {
      clearInterval(heartbeatInterval)
      window.removeEventListener('focus', handleWindowFocus)
      window.removeEventListener('visibilitychange', handleWindowFocus)
      socket.off('auth:session_kicked')
      socket.off('disconnect')
      socket.off('connect_error')
      socket.disconnect()
    }
  }, [location.pathname])

  return null
}
