import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { cargoNotificationService } from '../services/cargoNotificationService'

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

export default function NotificationCenter() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [urgentCount, setUrgentCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterUnread, setFilterUnread] = useState(false)
  const dropdownRef = useRef(null)

  const fetchUnreadCount = async () => {
    try {
      const res = await cargoNotificationService.getUnreadCount()
      const unread = typeof res === 'number' ? res : (res?.unreadCount || 0)
      const urgent = res?.urgentCount || 0
      setUnreadCount(unread)
      setUrgentCount(urgent)
    } catch (e) {
      // offline/silent fallback
    }
  }

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res = await cargoNotificationService.getNotifications({
        isRead: filterUnread ? false : undefined,
        limit: 25,
      })
      const items = res?.data || res?.items || []
      setNotifications(items)
    } catch (e) {
      console.error('Lỗi tải danh sách thông báo:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUnreadCount()

    // 1. Lắng nghe custom event từ Simulator hoặc thao tác trong cùng ứng dụng
    const handleLocalUpdate = () => {
      fetchUnreadCount()
      if (isOpen) fetchNotifications()
    }
    window.addEventListener('cargo_notification_updated', handleLocalUpdate)

    // 2. Kết nối Socket.IO nhận thông báo realtime
    let socket = null
    try {
      const token = getToken()
      if (token) {
        socket = io(getRealtimeUrl(), {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        })

        socket.on('cargo_notification:new', (notif) => {
          fetchUnreadCount()
          if (isOpen) {
            fetchNotifications()
          }
        })

        socket.on('cargo_notification:broadcast', () => {
          fetchUnreadCount()
          if (isOpen) {
            fetchNotifications()
          }
        })
      }
    } catch (err) {
      console.warn('Lỗi kết nối Socket NotificationCenter:', err)
    }

    // 3. Polling dự phòng mỗi 6s
    const timer = setInterval(fetchUnreadCount, 6000)

    return () => {
      clearInterval(timer)
      window.removeEventListener('cargo_notification_updated', handleLocalUpdate)
      if (socket) {
        socket.off('cargo_notification:new')
        socket.off('cargo_notification:broadcast')
        socket.disconnect()
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen, filterUnread])

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMarkAsRead = async (id, actionUrl) => {
    try {
      await cargoNotificationService.markAsRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true, isRead: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
      if (actionUrl) {
        setIsOpen(false)
        navigate(actionUrl)
      }
    } catch (e) {
      console.error('Lỗi đánh dấu đã đọc:', e)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await cargoNotificationService.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, isRead: true })))
      setUnreadCount(0)
      setUrgentCount(0)
    } catch (e) {
      console.error('Lỗi đánh dấu tất cả đã đọc:', e)
    }
  }

  const getPriorityStyle = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return { badge: 'bg-rose-100 text-rose-800 border-rose-300', dot: 'bg-rose-600', icon: 'priority_high', label: 'Khẩn' }
      case 'normal':
        return { badge: 'bg-amber-100 text-amber-900 border-amber-300', dot: 'bg-amber-600', icon: 'notifications', label: 'Quan trọng' }
      default:
        return { badge: 'bg-blue-100 text-blue-900 border-blue-300', dot: 'bg-blue-600', icon: 'info', label: 'Thông tin' }
    }
  }

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      {/* Bell Icon Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-center"
        title="Trung tâm Thông báo & Chứng từ NexusPort"
      >
        <span className="material-symbols-outlined text-[24px]">notifications</span>
        {unreadCount > 0 && (
          <span className={`absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-black text-white rounded-full font-mono animate-pulse border-2 border-white shadow-sm ${
            urgentCount > 0 ? 'bg-rose-600' : 'bg-orange-500'
          }`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-84 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
          
          {/* Header */}
          <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-900">Thông Báo Chủ Hàng</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-black bg-rose-100 text-rose-800 rounded-full font-mono">
                  {unreadCount} chưa đọc
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
              >
                Đã đọc tất cả
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="px-3 py-2 bg-white border-b border-slate-100 flex gap-2 text-xs font-bold">
            <button
              onClick={() => setFilterUnread(false)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${!filterUnread ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Tất Cả
            </button>
            <button
              onClick={() => setFilterUnread(true)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${filterUnread ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Chưa Đọc ({unreadCount})
            </button>
          </div>

          {/* List Content */}
          <div className="max-h-88 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-slate-500 font-bold text-xs">
                <span className="material-symbols-outlined animate-spin text-2xl text-slate-400 block mb-1">sync</span>
                Đang tải thông báo...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-bold text-xs space-y-1">
                <span className="material-symbols-outlined text-3xl text-slate-300">notifications_off</span>
                <p>Không có thông báo nào.</p>
              </div>
            ) : (
              notifications.map((item) => {
                const isRead = item.is_read || item.isRead
                const priority = item.priority || 'normal'
                const style = getPriorityStyle(priority)
                const actionUrl = item.action_url || item.actionUrl
                const actionLabel = item.action_label || item.actionLabel
                const createdAt = item.created_at || item.createdAt

                return (
                  <div
                    key={item.id}
                    onClick={() => handleMarkAsRead(item.id, actionUrl)}
                    className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3 ${!isRead ? 'bg-orange-50/25' : ''}`}
                  >
                    <div className={`p-2 rounded-xl border flex items-center justify-center shrink-0 ${style.badge}`}>
                      <span className="material-symbols-outlined text-base">{style.icon}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                            priority === 'urgent' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {style.label}
                          </span>
                          <h4 className={`text-xs truncate ${!isRead ? 'text-slate-900 font-black' : 'text-slate-700 font-semibold'}`}>
                            {item.title}
                          </h4>
                        </div>
                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-orange-600 flex-shrink-0"></span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                      
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] font-mono text-slate-400">
                          {createdAt ? new Date(createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''} · {createdAt ? new Date(createdAt).toLocaleDateString('vi-VN') : ''}
                        </span>
                        {actionLabel && (
                          <span className="text-[10px] font-bold text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-0.5">
                            {actionLabel} →
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-4">
            <span className="text-[10px] font-bold text-emerald-700 font-mono flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              Realtime Sync
            </span>
            <button
              onClick={() => {
                setIsOpen(false)
                navigate('/cargo/tracking')
              }}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
            >
              Mở Trung tâm chứng từ & Việc cần làm →
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
