import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { io } from 'socket.io-client'
import { createSessionHeartbeat, SESSION_HEARTBEAT_MS } from '../services/sessionHeartbeat'
import { endConfirmedSession, verifySession } from '../services/sessionValidation'

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
  } catch { }
  return localStorage.getItem('token') || sessionStorage.getItem('token') || null
}

/**
 * SessionListener: Giám sát phiên đăng nhập duy nhất (Single Active Session).
 * Tích hợp 4 lớp bảo vệ:
 * 1. Lắng nghe trực tiếp sự kiện 'auth:session_kicked' từ Socket.IO
 * 2. Phân biệt chính xác giữa ngắt kết nối mạng và bị đá do đăng nhập trùng lặp
 * 3. Polling kiểm tra trạng thái phiên mỗi 15 giây (/api/auth/me)
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

    let active = true
    const confirmSession = () => { if (active && getToken() === token) void verifySession(token) }
    socket.on('auth:session_kicked', confirmSession)
    socket.on('connect_error', err => {
      if (/SESSION_KICKED|SESSION_LOGGED_OUT|SESSION_EXPIRED/.test(err?.message || '')) confirmSession()
    })

    // 3: Deduplicate polling/focus checks and ignore stale responses after cleanup.
    const heartbeat = createSessionHeartbeat({
      getToken,
      isVisible: () => !document.hidden,
      request: async (currentToken, signal) => {
        const res = await fetch(`${(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')}/auth/me`, {
          signal,
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${currentToken}`,
            'Cache-Control': 'no-cache',
          },
        })
        return res
      },
      onUnauthorized: body => { if (active) endConfirmedSession(token, body.code) },
    })

    const heartbeatInterval = setInterval(() => void heartbeat.check(), SESSION_HEARTBEAT_MS)

    // 4: Kiểm tra ngay lập tức khi user focus / đổi tab
    const handleWindowFocus = () => {
      void heartbeat.check()
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleWindowFocus)

    return () => {
      active = false
      clearInterval(heartbeatInterval)
      heartbeat.stop()
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleWindowFocus)
      socket.off('auth:session_kicked')
      socket.off('disconnect')
      socket.off('connect_error')
      socket.disconnect()
    }
  }, [location.pathname])

  return null
}
