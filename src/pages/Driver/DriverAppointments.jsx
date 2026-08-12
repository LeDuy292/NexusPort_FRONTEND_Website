import React, { useState } from 'react'

const initialAppointments = [
  {
    id: 'BK-2093',
    date: '11/08/2026',
    time: '09:00 AM',
    vehicle: '43C-123.45',
    container: 'MSCU1234567',
    transType: 'NHẬN CONTAINER (PICKUP)',
    status: 'Confirmed',
    statusColor: 'bg-green-50 text-green-700 border-green-200',
    gate: 'Cổng A (Lối vào phía Bắc)',
    driverName: 'Nguyễn Văn A',
    qrData: 'NEXUSPORT_DRIVER_BK2093',
    tabGroup: 'Today'
  },
  {
    id: 'BK-2094',
    date: '11/08/2026',
    time: '14:00 PM',
    vehicle: '43C-123.45',
    container: 'EVER991203-4',
    transType: 'TRẢ CONTAINER (DELIVERY)',
    status: 'Upcoming',
    statusColor: 'bg-blue-50 text-blue-700 border-blue-200',
    gate: 'Cổng B',
    driverName: 'Nguyễn Văn A',
    qrData: 'NEXUSPORT_DRIVER_BK2094',
    tabGroup: 'Upcoming'
  },
  {
    id: 'BK-2088',
    date: '10/08/2026',
    time: '10:30 AM',
    vehicle: '43C-123.45',
    container: 'HLBU993210-5',
    transType: 'NHẬN CONTAINER (PICKUP)',
    status: 'Completed',
    statusColor: 'bg-[#202020] text-white',
    gate: 'Cổng A',
    driverName: 'Nguyễn Văn A',
    qrData: 'NEXUSPORT_DRIVER_BK2088',
    tabGroup: 'Completed'
  },
  {
    id: 'BK-2070',
    date: '08/08/2026',
    time: '16:00 PM',
    vehicle: '43C-123.45',
    container: 'TGHU102934-2',
    transType: 'TRẢ CONTAINER',
    status: 'Cancelled',
    statusColor: 'bg-red-50 text-red-700 border-red-200',
    gate: 'Cổng C',
    driverName: 'Nguyễn Văn A',
    qrData: 'NEXUSPORT_DRIVER_BK2070',
    tabGroup: 'Cancelled'
  }
]

export default function DriverAppointments({ onSelectQR }) {
  const [appointments] = useState(initialAppointments)
  const [activeTab, setActiveTab] = useState('Today')
  const [selectedApp, setSelectedApp] = useState(null)

  const filteredApps = appointments.filter(a => {
    if (activeTab === 'Today') return a.tabGroup === 'Today'
    if (activeTab === 'Upcoming') return a.tabGroup === 'Upcoming'
    if (activeTab === 'Completed') return a.tabGroup === 'Completed'
    if (activeTab === 'Cancelled') return a.tabGroup === 'Cancelled'
    return true
  })

  return (
    <div className="space-y-5 animate-in fade-in duration-200 pb-20">
      
      {/* Header */}
      <div className="border-b border-chalk pb-3">
        <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded uppercase">
          DRIVER SCHEDULE
        </span>
        <h2 className="font-heading text-2xl text-carbon font-extrabold mt-1">Lịch hẹn của tôi</h2>
        <p className="text-xs text-slate mt-0.5">Danh sách các khung giờ check-in đã được xác nhận bởi hãng tàu.</p>
      </div>

      {/* Tabs (Today / Upcoming / Completed / Cancelled) */}
      <div className="flex bg-fog p-1 rounded-xl border border-chalk text-xs font-bold gap-1">
        {[
          { key: 'Today', label: 'Hôm nay' },
          { key: 'Upcoming', label: 'Sắp tới' },
          { key: 'Completed', label: 'Hoàn thành' },
          { key: 'Cancelled', label: 'Đã hủy' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 rounded-lg transition-all text-center ${
              activeTab === tab.key
                ? 'bg-white text-carbon shadow-sm border border-chalk font-extrabold'
                : 'text-slate hover:text-carbon'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Appointments List */}
      <div className="space-y-3">
        {filteredApps.length === 0 ? (
          <div className="bg-white rounded-2xl border border-chalk p-8 text-center text-slate space-y-2">
            <span className="material-symbols-outlined text-3xl text-chalk">calendar_today</span>
            <p className="text-xs font-bold">Không có lịch hẹn nào trong mục này</p>
          </div>
        ) : (
          filteredApps.map(app => (
            <div
              key={app.id}
              onClick={() => setSelectedApp(app)}
              className="bg-white rounded-2xl p-5 border border-chalk shadow-sm hover:border-carbon transition-all cursor-pointer space-y-3 active:scale-98"
            >
              <div className="flex justify-between items-center border-b border-chalk pb-3">
                <div>
                  <span className="text-[10px] text-slate font-bold uppercase tracking-wider block">BOOKING ID</span>
                  <span className="font-mono font-bold text-carbon text-sm">{app.id}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${app.statusColor}`}>
                  {app.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate text-[10px] uppercase font-bold block">CONTAINER</span>
                  <strong className="text-carbon font-mono text-sm">{app.container}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate text-[10px] uppercase font-bold block">THỜI GIAN HẸN</span>
                  <strong className="text-carbon font-mono">{app.time}</strong>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-chalk text-[11px]">
                <span className="text-signal-orange font-bold">{app.transType}</span>
                <span className="text-slate flex items-center gap-1 font-bold">
                  Chi tiết <span className="material-symbols-outlined text-sm">chevron_right</span>
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* APPOINTMENT DETAIL MODAL */}
      {selectedApp && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-md z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate uppercase">CHI TIẾT LỊCH HẸN</span>
                <h3 className="font-mono font-extrabold text-carbon text-lg">{selectedApp.id}</h3>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-fog p-4 rounded-xl border border-chalk space-y-2 font-bold">
                <div className="flex justify-between">
                  <span className="text-slate">Loại giao dịch:</span>
                  <span className="text-signal-orange">{selectedApp.transType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">Trạng thái:</span>
                  <span className="text-carbon">{selectedApp.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">Cổng chỉ định:</span>
                  <span className="text-carbon">{selectedApp.gate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">Thời gian:</span>
                  <span className="text-carbon font-mono">{selectedApp.date} - {selectedApp.time}</span>
                </div>
              </div>

              <div className="space-y-1 font-mono text-[11px] text-slate font-bold px-1">
                <div>Tài xế: {selectedApp.driverName}</div>
                <div>Biển số xe: {selectedApp.vehicle}</div>
                <div>Container: {selectedApp.container}</div>
              </div>
            </div>

            {/* QR Preview Mini Card */}
            <div className="bg-white p-3 border-2 border-dashed border-chalk rounded-2xl flex items-center justify-between gap-3">
              <div className="text-left space-y-0.5">
                <span className="text-[10px] font-bold text-slate uppercase">MÃ QR CHECK-IN</span>
                <p className="text-[11px] font-bold text-carbon">Quét trực tiếp tại cổng kiểm soát</p>
              </div>
              <div className="w-12 h-12 bg-fog p-1 rounded-lg shrink-0">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${selectedApp.qrData}`}
                  alt="QR Mini"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Primary CTA */}
            <button
              onClick={() => {
                const appToPass = selectedApp
                setSelectedApp(null)
                if (onSelectQR) onSelectQR(appToPass)
              }}
              className="w-full h-12 bg-signal-orange text-white rounded-xl font-extrabold text-sm hover:opacity-95 transition-opacity shadow-lg flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">qr_code</span>
              XEM MÃ QR FULLSCREEN
            </button>

          </div>
        </div>
      )}

    </div>
  )
}
