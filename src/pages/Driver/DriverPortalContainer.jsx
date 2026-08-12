import React, { useState } from 'react'
import DriverHome from './DriverHome'
import DriverAppointments from './DriverAppointments'
import DriverQR from './DriverQR'
import DriverCheckin from './DriverCheckin'
import DriverNavigation from './DriverNavigation'
import DriverContainerLocation from './DriverContainerLocation'
import DriverTransactionStatus from './DriverTransactionStatus'

export default function DriverPortalContainer() {
  const [activeTab, setActiveTab] = useState('home')
  const [subView, setSubView] = useState(null) // 'checkin', 'navigation', 'location', 'status', 'qr_fullscreen'
  const [selectedApp, setSelectedApp] = useState(null)
  const [toastMessage, setToastMessage] = useState('')
  const [driverMode, setDriverMode] = useState('pickup') // 'pickup' | 'delivery'
  const [tripStep, setTripStep] = useState(1) // 1: Nhận xe, 2: Di chuyển, 3: Xếp dỡ, 4: Rời cảng, 5: Hoàn thành

  const handleSelectQR = (app) => {
    setSelectedApp(app)
    setSubView('qr_fullscreen')
  }

  const handleGoToNavigation = () => {
    setActiveTab('trip')
    setSubView('navigation')
  }

  const handleGoToLocation = () => {
    setTripStep(3) // Advance to step 3 (load/unload cargo)
    setActiveTab('home') // Bring back to home to see step 3 CTA
    setSubView(null)
    setToastMessage('📍 Đã đến vị trí bãi! Vui lòng cẩu hàng.')
    setTimeout(() => setToastMessage(''), 3000)
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
            VA
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-carbon text-sm">Nguyễn Văn A</h1>
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
            </div>
            <p className="text-[11px] text-slate font-mono font-bold">Xe: 43C-123.45 • NexusPort Fleet</p>
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

          <button className="relative p-2 text-slate hover:text-carbon transition-colors">
            <span className="material-symbols-outlined text-2xl">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-signal-orange rounded-full ring-2 ring-white"></span>
          </button>
        </div>
      </header>

      {/* DRIVER TRIP TYPE SWITCHER (PICKUP VS DELIVERY) */}
      <div className="bg-white border-b border-chalk px-5 py-2.5 flex items-center justify-between gap-2 z-30">
        <span className="text-[10px] font-bold text-slate uppercase tracking-wider">Chế độ xe:</span>
        <div className="flex bg-fog p-0.5 rounded-lg border border-chalk text-[11px] font-bold">
          <button
            onClick={() => {
              setDriverMode('pickup')
              setToastMessage('📥 Đã chuyển sang Lấy Container (Pickup)')
              setTimeout(() => setToastMessage(''), 2000)
            }}
            className={`px-2.5 py-1 rounded-md transition-all ${
              driverMode === 'pickup' ? 'bg-carbon text-white shadow-xs' : 'text-slate hover:text-carbon'
            }`}
          >
            📥 Lấy cont
          </button>
          <button
            onClick={() => {
              setDriverMode('delivery')
              setToastMessage('📤 Đã chuyển sang Trả Container (Delivery)')
              setTimeout(() => setToastMessage(''), 2000)
            }}
            className={`px-2.5 py-1 rounded-md transition-all ${
              driverMode === 'delivery' ? 'bg-carbon text-white shadow-xs' : 'text-slate hover:text-carbon'
            }`}
          >
            📤 Trả cont
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER CONTENT AREA */}
      <main className="flex-1 p-5 overflow-y-auto pb-24">
        
        {/* SUBVIEWS (WORKFLOW STEP OVERLAYS) */}
        {subView === 'checkin' && (
          <DriverCheckin onNavigateToRoute={handleGoToNavigation} />
        )}

        {subView === 'navigation' && (
          <DriverNavigation driverMode={driverMode} tripStep={tripStep} setTripStep={setTripStep} onArrived={handleGoToLocation} />
        )}

        {subView === 'location' && (
          <DriverContainerLocation driverMode={driverMode} tripStep={tripStep} setTripStep={setTripStep} onStartNavigate={handleGoToNavigation} />
        )}

        {subView === 'status' && (
          <DriverTransactionStatus driverMode={driverMode} tripStep={tripStep} />
        )}

        {subView === 'qr_fullscreen' && (
          <DriverQR currentApp={selectedApp} />
        )}

        {/* MAIN TAB VIEWS (WHEN NO SUBVIEW ACTIVE) */}
        {!subView && (
          <>
            {activeTab === 'home' && (
              <DriverHome driverMode={driverMode} tripStep={tripStep} setTripStep={setTripStep} onNavigateToTrip={handleGoToNavigation} />
            )}

            {activeTab === 'appointments' && (
              <DriverAppointments onSelectQR={handleSelectQR} />
            )}

            {activeTab === 'qr' && (
              <DriverQR currentApp={selectedApp} />
            )}

            {activeTab === 'trip' && (
              <div className="space-y-4">
                {/* Trip Quick Selector Sub-menu */}
                <div className="grid grid-cols-3 gap-2 bg-fog p-1 rounded-xl border border-chalk text-[11px] font-bold text-center">
                  <button
                    onClick={() => setSubView('navigation')}
                    className="py-2 bg-white rounded-lg border border-chalk text-carbon shadow-sm"
                  >
                    🗺️ Hướng dẫn
                  </button>
                  <button
                    onClick={() => setSubView('location')}
                    className="py-2 bg-white rounded-lg border border-chalk text-carbon shadow-sm"
                  >
                    📍 Vị trí Cont
                  </button>
                  <button
                    onClick={() => setSubView('status')}
                    className="py-2 bg-white rounded-lg border border-chalk text-carbon shadow-sm"
                  >
                    ⏱️ Trạng thái
                  </button>
                </div>

                <DriverTransactionStatus driverMode={driverMode} tripStep={tripStep} />
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm text-center space-y-3">
                  <div className="w-20 h-20 rounded-full bg-carbon text-white text-2xl font-bold flex items-center justify-center mx-auto shadow">
                    VA
                  </div>
                  <h2 className="font-bold text-carbon text-xl">Nguyễn Văn A</h2>
                  <p className="text-xs text-slate font-mono">BẰNG LÁI: DL-8472848 (CDL-A)</p>
                  <div className="inline-block bg-orange-50 text-signal-orange text-xs font-bold px-3 py-1 rounded-full border border-orange-200">
                    Hãng xe: NexusPort Logistics Fleet
                  </div>
                </div>

                <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm divide-y divide-chalk text-xs font-bold">
                  <div className="py-3 flex justify-between items-center text-carbon">
                    <span>Số điện thoại</span>
                    <span className="font-mono text-slate">+84 905 123 456</span>
                  </div>
                  <div className="py-3 flex justify-between items-center text-carbon">
                    <span>Biển số xe kéo cố định</span>
                    <span className="font-mono text-slate">43C-123.45</span>
                  </div>
                  <div className="py-3 flex justify-between items-center text-carbon">
                    <span>Trạng thái sức khỏe</span>
                    <span className="text-green-600">✓ Đã kiểm tra đạt</span>
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
