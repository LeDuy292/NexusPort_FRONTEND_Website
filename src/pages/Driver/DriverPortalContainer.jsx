import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DriverHome from './DriverHome'
import DriverAppointments from './DriverAppointments'
import DriverQR from './DriverQR'
import DriverSmartRoute from './DriverSmartRoute'
import { connectDriverRealtime } from '../../services/driverRealtimeService'
import { driverContainerConfirmationService } from '../../services/driverContainerConfirmationService'
import DriverTripDashboard from './DriverTripDashboard'
import useAuth from '../../hooks/useAuth'

export default function DriverPortalContainer() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const displayName = user?.fullName || user?.username || 'Tài xế'
  const initials = displayName.split(/\s+/).slice(-2).map(word => word[0]).join('').toUpperCase()
  const [activeTab, setActiveTab] = useState('home')
  const [subView, setSubView] = useState(null) // 'navigation' | 'qr_fullscreen'
  const [selectedApp, setSelectedApp] = useState(null)
  const [navigationSelection, setNavigationSelection] = useState(null)
  const [toastMessage, setToastMessage] = useState('')
  const [yardNotifications, setYardNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] = useState(null)

  const [driverUser, setDriverUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user') || sessionStorage.getItem('user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user')
    if (storedUser) {
      driverContainerConfirmationService.getAssignedOperations()
        .then(operations => {
          const items = Array.isArray(operations) ? operations : []
          if (items[0]) setPendingConfirmation(items[0])
        })
        .catch(() => {
          // The driver app remains usable when the API is unavailable.
        })
    }

    return connectDriverRealtime((event) => {
      setYardNotifications(current => [{ ...event, receivedAt: new Date().toISOString() }, ...current].slice(0, 20))
      setToastMessage(`✅ Container ${event.containerId} · ${event.operationStatus}`)
      driverContainerConfirmationService.getAssignedOperations().then(operations => {
        const matching = (Array.isArray(operations) ? operations : []).find(item => item.containerId === event.containerId)
        if (matching) setPendingConfirmation(matching)
      }).catch(() => setToastMessage('Không tải được booking cần xác nhận. Vui lòng thử lại.'))
      setTimeout(() => setToastMessage(''), 5000)
    }, () => {
      // The app remains usable offline; Socket.IO will retry in the background.
    })
  }, [])

  const handleSelectQR = (app) => {
    setSelectedApp(app)
    setSubView('qr_fullscreen')
  }

  const handleGoToNavigation = (item) => {
    setNavigationSelection(item?.containerId ? { containerId: item.containerId, bookingId: item.bookingId } : null)
    setActiveTab('trip')
    setSubView('navigation')
  }
  const handleLogout = async () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất khỏi tài khoản tài xế không?')) {
      try {
        const apiBase = import.meta.env.VITE_API_URL || '/api'
        const token = localStorage.getItem('token') || sessionStorage.getItem('token')
        await fetch(`${apiBase}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        }).catch(() => {})
      } catch (_) {}
      localStorage.removeItem('user')
      sessionStorage.removeItem('user')
      localStorage.removeItem('token')
      sessionStorage.removeItem('token')
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen bg-fog text-carbon font-sans flex flex-col justify-between max-w-[480px] mx-auto shadow-2xl relative border-x border-chalk">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-carbon text-white px-5 py-3 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 z-50 animate-bounce border border-signal-orange whitespace-nowrap">
          <span className="text-signal-orange">●</span>
          {toastMessage}
        </div>
      )}

      {/* TOP HEADER & DRIVER PROFILE BAR */}
      <header className="bg-white border-b border-chalk px-5 py-3.5 sticky top-0 z-40 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-carbon text-white flex items-center justify-center font-bold text-sm shadow">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-carbon text-sm">{displayName}</h1>
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
            </div>
            <p className="text-[11px] text-slate font-mono font-bold">Driver · Điều hướng và giao nhận container</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {subView && (
            <button
              onClick={() => setSubView(null)}
              className="text-xs font-bold text-slate hover:text-carbon bg-fog px-2.5 py-1.5 rounded-lg border border-chalk mr-1"
            >
              ← Về trang chủ
            </button>
          )}

          <button onClick={() => setShowNotifications(current => !current)} className="relative p-2 text-slate hover:text-carbon transition-colors">
            <span className="material-symbols-outlined text-2xl">notifications</span>
            {yardNotifications.length > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-signal-orange text-white rounded-full ring-2 ring-white text-[9px] font-bold leading-4">{yardNotifications.length}</span>}
          </button>

          <button
            onClick={handleLogout}
            title="Đăng xuất"
            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center ml-1"
          >
            <span className="material-symbols-outlined text-2xl">logout</span>
          </button>
        </div>
      </header>

      {showNotifications && (
        <section className="absolute top-16 right-3 left-3 max-w-[450px] mx-auto bg-white border border-chalk rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-chalk flex justify-between items-center">
            <strong className="text-xs">Thông báo tác nghiệp bãi</strong>
            <button onClick={() => setYardNotifications([])} className="text-[10px] text-slate">Xóa tất cả</button>
          </div>
          <div className="max-h-56 overflow-auto">
            {yardNotifications.length === 0 ? <p className="p-4 text-xs text-slate">Chưa có thông báo realtime.</p> : yardNotifications.map(item => (
              <div key={item.eventId} className="p-3 border-b border-chalk text-xs">
                <p className="font-bold text-carbon">Container ID: {item.containerId}</p>
                <p className="text-green-600 font-bold">Operation status: {item.operationStatus}</p>
                <p className="text-[10px] text-slate mt-1">{new Date(item.completedAt).toLocaleString('vi-VN')}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* NXP-062: driver reviews the assigned operation and confirms the container. */}
      {pendingConfirmation && (
        <section className="mx-5 mt-4 bg-white border-2 border-signal-orange rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider">XÁC NHẬN CONTAINER</span>
              <h2 className="text-sm font-extrabold text-carbon mt-1">Operation đã hoàn tất</h2>
            </div>
            <span className="material-symbols-outlined text-signal-orange">fact_check</span>
          </div>
          <div className="bg-fog rounded-xl border border-chalk p-3 text-xs space-y-1.5 font-mono">
            <div className="flex justify-between gap-3"><span className="text-slate">Container</span><strong>{pendingConfirmation.containerNumber || pendingConfirmation.containerId}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-slate">Operation</span><strong className="text-green-700">{pendingConfirmation.operationStatus || 'Completed'}</strong></div>
            {pendingConfirmation.bookingCode && <div className="flex justify-between gap-3"><span className="text-slate">Booking</span><strong>{pendingConfirmation.bookingCode}</strong></div>}
          </div>
          {pendingConfirmation.containerStatus === 'ReadyForGateOut' || pendingConfirmation.operationStatus === 'ReadyForGateOut' ? (
            <div className="text-center text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg py-2">Đã xác nhận · Ready for Gate-Out</div>
          ) : (
            <button
              onClick={() => handleGoToNavigation(pendingConfirmation)}
              className="w-full bg-carbon text-white rounded-xl py-3 text-xs font-extrabold disabled:opacity-50"
            >
              MỞ ĐIỂM GIAO NHẬN ĐỂ XÁC NHẬN
            </button>
          )}
        </section>
      )}

      {/* MAIN CONTAINER CONTENT AREA */}
      <main className="flex-1 p-5 overflow-y-auto pb-24">
        {!subView && <div className="mb-5"><DriverSmartRoute compact onOpen={handleGoToNavigation} /></div>}
        
        {/* SUBVIEWS (WORKFLOW STEP OVERLAYS) */}
        {subView === 'navigation' && (
          <DriverSmartRoute {...navigationSelection} onStatusUpdated={() => setPendingConfirmation(null)} />
        )}

        {subView === 'qr_fullscreen' && (
          <DriverQR currentApp={selectedApp} />
        )}

        {/* MAIN TAB VIEWS (WHEN NO SUBVIEW ACTIVE) */}
        {!subView && (
          <>
            {activeTab === 'home' && (
              <DriverTripDashboard />
            )}

            {activeTab === 'appointments' && (
              <DriverAppointments onSelectQR={handleSelectQR} />
            )}

            {activeTab === 'qr' && (
              <DriverQR currentApp={selectedApp} />
            )}

            {activeTab === 'trip' && (
              <DriverTripDashboard />
            )}

            {activeTab === 'profile' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm text-center space-y-3">
                  <div className="w-20 h-20 rounded-full bg-carbon text-white text-2xl font-bold flex items-center justify-center mx-auto shadow">
                    {initials}
                  </div>
                  <h2 className="font-bold text-carbon text-xl">{displayName}</h2>
                  <p className="text-xs text-slate font-mono">{user?.email || user?.username}</p>
                  <div className="inline-block bg-orange-50 text-signal-orange text-xs font-bold px-3 py-1 rounded-full border border-orange-200">
                    Tài khoản Driver
                  </div>
                </div>

                <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm divide-y divide-chalk text-xs font-bold">
                  <div className="py-3 flex justify-between items-center text-carbon">
                    <span>Số điện thoại</span>
                    <span className="font-mono text-slate">{user?.phone || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="py-3 flex justify-between items-center text-carbon">
                    <span>Xe vận chuyển</span>
                    <span className="font-mono text-slate">Theo chuyến được phân công</span>
                  </div>
                  <div className="py-3 flex justify-between items-center text-carbon">
                    <span>Điều hướng trong bãi</span>
                    <button type="button" onClick={handleGoToNavigation} className="text-teal-700">Xem Smart Route →</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </main>

      {/* BOTTOM NAVIGATION BAR (5 TABS MOBILE PWA) */}
      <nav className="bg-white border-t border-chalk fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-16 flex items-center justify-around z-40 px-2 shadow-lg">
        
        <button
          onClick={() => { setActiveTab('home'); setSubView(null); }}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'home' && !subView ? 'text-signal-orange font-bold' : 'text-slate hover:text-carbon'
          }`}
        >
          <span className="material-symbols-outlined text-xl">home</span>
          <span className="text-[10px]">Trang chủ</span>
        </button>

        <button
          onClick={() => { setActiveTab('appointments'); setSubView(null); }}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'appointments' && !subView ? 'text-signal-orange font-bold' : 'text-slate hover:text-carbon'
          }`}
        >
          <span className="material-symbols-outlined text-xl">calendar_month</span>
          <span className="text-[10px]">Lịch hẹn</span>
        </button>

        {/* Floating Center QR Action */}
        <button
          onClick={() => { setActiveTab('qr'); setSubView('qr_fullscreen'); }}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-carbon text-white shadow-lg border-2 border-white -translate-y-3 active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-2xl">qr_code_scanner</span>
        </button>

        <button
          onClick={() => { setActiveTab('trip'); setSubView(null); }}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'trip' && !subView ? 'text-signal-orange font-bold' : 'text-slate hover:text-carbon'
          }`}
        >
          <span className="material-symbols-outlined text-xl">local_shipping</span>
          <span className="text-[10px]">Chuyến xe</span>
        </button>

        <button
          onClick={() => { setActiveTab('profile'); setSubView(null); }}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'profile' && !subView ? 'text-slate font-bold' : 'text-slate hover:text-carbon'
          }`}
        >
          <span className="material-symbols-outlined text-xl">person</span>
          <span className="text-[10px]">Tài khoản</span>
        </button>

      </nav>

    </div>
  )
}
