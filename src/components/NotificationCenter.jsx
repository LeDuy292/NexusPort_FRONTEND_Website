import React, { useState, useEffect, useRef } from 'react'
import { notificationService } from '../services/notificationService'

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterUnread, setFilterUnread] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    fetchUnreadCount()
    const timer = setInterval(fetchUnreadCount, 10000) // Polling unread count every 10s
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen, filterUnread])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchUnreadCount = async () => {
    try {
      const count = await notificationService.getUnreadCount()
      setUnreadCount(typeof count === 'number' ? count : (count?.unreadCount || 0))
    } catch (e) {
      // Fallback count if offline/mock
    }
  }

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res = await notificationService.getNotifications({ unreadOnly: filterUnread, pageSize: 20 })
      setNotifications(res.items || [])
    } catch (e) {
      console.error('Lỗi tải thông báo:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (e) {
      console.error('Lỗi đánh dấu đã đọc:', e)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (e) {
      console.error('Lỗi đánh dấu tất cả đã đọc:', e)
    }
  }

  const getSeverityStyle = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'error':
        return { badge: 'bg-rose-100 text-rose-800 border-rose-300', dot: 'bg-rose-600', icon: 'error' }
      case 'warning':
        return { badge: 'bg-amber-100 text-amber-900 border-amber-300', dot: 'bg-amber-600', icon: 'warning' }
      case 'success':
        return { badge: 'bg-emerald-100 text-emerald-950 border-emerald-300', dot: 'bg-emerald-600', icon: 'check_circle' }
      default:
        return { badge: 'bg-blue-100 text-blue-900 border-blue-300', dot: 'bg-blue-600', icon: 'info' }
    }
  }

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      {/* Bell Icon Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-center"
        title="Trung tâm Thông báo NexusPort"
      >
        <span className="material-symbols-outlined text-[24px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-black bg-rose-600 text-white rounded-full font-mono animate-pulse border-2 border-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
          
          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-900">Trung Tâm Thông Báo</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-black bg-rose-100 text-rose-800 rounded-full font-mono">
                  {unreadCount} chưa đọc
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                Đã đọc tất cả
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="px-4 py-2 bg-white border-b border-slate-100 flex gap-2 text-xs font-bold">
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
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
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
                const style = getSeverityStyle(item.severity)
                return (
                  <div
                    key={item.id}
                    onClick={() => !item.isRead && handleMarkAsRead(item.id)}
                    className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3 ${!item.isRead ? 'bg-blue-50/30' : ''}`}
                  >
                    <div className={`p-2 rounded-xl border flex items-center justify-center ${style.badge}`}>
                      <span className="material-symbols-outlined text-base">{style.icon}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className={`text-xs font-bold truncate ${!item.isRead ? 'text-slate-900 font-black' : 'text-slate-700'}`}>
                          {item.title}
                        </h4>
                        {!item.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0"></span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                      <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                        {new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
            <span className="text-[10px] font-bold text-slate-500 font-mono">NexusPort Notification Center · Realtime DB</span>
          </div>

        </div>
      )}
    </div>
  )
}
