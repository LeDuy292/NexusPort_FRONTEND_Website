import React, { useState } from 'react'

const initialDrivers = [
  { id: 'D01', name: 'Nguyễn Văn A', license: 'DL-8472848', class: 'CDL-A', status: 'Hoạt động', health: 'Tốt', healthColor: 'text-green-600', phone: '+84 905 123 456', trips: ['05/10/2026 - Cảng B đến Kho 12', '02/10/2026 - Kho 7 đến Cảng A'] },
  { id: 'D02', name: 'Nguyễn Văn B', license: 'DL-8472849', class: 'CDL-A', status: 'Đang làm nhiệm vụ', health: 'Khá', healthColor: 'text-amber-600', phone: '+84 905 234 567', trips: ['06/10/2026 - Gate A đến Block C'] },
  { id: 'D03', name: 'Trần Văn C', license: 'DL-8472950', class: 'CDL-A', status: 'Hoạt động', health: 'Tốt', healthColor: 'text-green-600', phone: '+84 905 345 678', trips: ['04/10/2026 - Bến D01 đến Yard B'] },
  { id: 'D04', name: 'Lê Văn D', license: 'DL-8472951', class: 'CDL-A', status: 'Hoạt động', health: 'Tốt', healthColor: 'text-green-600', phone: '+84 905 456 789', trips: ['03/10/2026 - Cầu cảng 3 đến Kho 5'] },
  { id: 'D05', name: 'Phạm Văn E', license: 'DL-1937465', class: 'HazMat', status: 'Nghỉ phép', health: 'Khá', healthColor: 'text-amber-600', phone: '+84 905 567 890', trips: ['01/10/2026 - Cảng A đến Tổng kho'] },
  { id: 'D06', name: 'Hoàng Văn F', license: 'DL-8472953', class: 'CDL-A', status: 'Hoạt động', health: 'Tốt', healthColor: 'text-green-600', phone: '+84 905 678 901', trips: ['05/10/2026 - Trạm Gate B đến Yard D'] },
]

export default function DriverManagement() {
  const [drivers] = useState(initialDrivers)
  const [activeTab, setActiveTab] = useState('drivers')
  const [selectedDriver, setSelectedDriver] = useState(initialDrivers[0])
  const [toastMessage, setToastMessage] = useState('')

  const handleContact = (driverName) => {
    setToastMessage(`📞 Đã kết nối tổng đài gọi tài xế: ${driverName}!`)
    setTimeout(() => setToastMessage(''), 3000)
  }

  return (
    <div className="p-8 w-full font-sans flex flex-col lg:flex-row gap-8 relative items-start">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-8 bg-[#202020] text-white px-6 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 z-50 animate-bounce border border-signal-orange">
          <span className="text-signal-orange">●</span>
          {toastMessage}
        </div>
      )}

      {/* LEFT MAIN AREA */}
      <div className="flex-1 space-y-6 w-full">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-chalk pb-6">
          <div>
            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase">
              Fleet & Workforce
            </span>
            <h2 className="font-heading text-4xl text-carbon font-bold mt-1">Quản lý Đội ngũ Tài xế</h2>
            <p className="text-sm text-slate mt-1">Giám sát trạng thái bằng lái, hồ sơ sức khỏe và lịch trình làm việc tài xế.</p>
          </div>

          {/* View Tabs */}
          <div className="flex bg-white rounded-lg p-1 border border-chalk shadow-sm text-xs font-bold">
            {['drivers', 'vehicles', 'schedules'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  activeTab === tab ? 'bg-fog text-carbon border border-chalk' : 'text-slate hover:text-carbon'
                }`}
              >
                {tab === 'drivers' ? 'Tài xế' : tab === 'vehicles' ? 'Phương tiện' : 'Lịch trình'}
              </button>
            ))}
          </div>
        </div>

        {/* TAB CONTENT: DRIVERS GRID */}
        {activeTab === 'drivers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-200">
            {drivers.map((d) => {
              const isSelected = selectedDriver?.id === d.id
              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDriver(d)}
                  className={`bg-white rounded-xl p-6 shadow-sm border transition-all cursor-pointer flex flex-col justify-between space-y-4 hover:shadow-md ${
                    isSelected ? 'border-2 border-carbon ring-1 ring-carbon/10' : 'border-chalk hover:border-slate'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-full bg-fog border border-chalk flex items-center justify-center font-bold text-carbon text-sm">
                        {d.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h3 className="font-bold text-carbon text-base">{d.name}</h3>
                        <p className="text-xs text-slate mt-0.5">{d.license} • {d.class}</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate text-sm">more_vert</span>
                  </div>

                  <div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold ${
                      d.status === 'Hoạt động'
                        ? 'bg-carbon text-white'
                        : d.status === 'Đang làm nhiệm vụ'
                        ? 'bg-orange-100 text-orange-700 border border-orange-200'
                        : 'bg-chalk text-slate'
                    }`}>
                      {d.status === 'Đang làm nhiệm vụ' && <span className="w-1.5 h-1.5 rounded-full bg-signal-orange mr-1.5 animate-ping"></span>}
                      {d.status}
                    </span>
                  </div>

                  <div className="pt-4 border-t border-chalk flex justify-between items-center text-xs">
                    <div>
                      <span className="text-slate block text-[10px] uppercase font-bold">Hạng bằng</span>
                      <strong className="text-carbon">{d.class}</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-slate block text-[10px] uppercase font-bold">Sức khỏe</span>
                      <strong className={d.healthColor}>{d.health}</strong>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* OTHER TABS PLACEHOLDER */}
        {(activeTab === 'vehicles' || activeTab === 'schedules') && (
          <div className="bg-white border border-chalk rounded-xl p-12 text-center text-slate space-y-2 animate-in fade-in duration-200">
            <span className="material-symbols-outlined text-4xl text-slate">local_shipping</span>
            <h4 className="font-bold text-carbon text-lg">Danh mục Phương tiện & Lịch trình đang hoạt động</h4>
            <p className="text-xs">Dữ liệu xe đầu kéo và sơ đồ phân ca kíp được đồng bộ trực tiếp từ trạm điều hành cảng.</p>
          </div>
        )}

      </div>

      {/* RIGHT SIDEBAR (320px): SELECTED DRIVER PROFILE */}
      {selectedDriver && (
        <div className="w-full lg:w-[320px] bg-white rounded-xl border border-chalk shadow-sm shrink-0 p-6 space-y-6 animate-in slide-in-from-right duration-300">
          
          {/* Profile Header */}
          <div className="flex items-center space-x-4 border-b border-chalk pb-5">
            <div className="w-14 h-14 rounded-full bg-fog border border-chalk flex items-center justify-center text-carbon font-bold text-lg">
              {selectedDriver.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h3 className="text-lg font-bold text-carbon">{selectedDriver.name}</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-carbon text-white uppercase tracking-wider mt-1">
                {selectedDriver.status}
              </span>
            </div>
          </div>

          {/* Contact & ID Info */}
          <div className="space-y-3 text-xs border-b border-chalk pb-5">
            <h4 className="text-[10px] font-bold text-slate uppercase tracking-wider">LIÊN HỆ & BẰNG LÁI</h4>
            <div className="flex justify-between">
              <span className="text-slate">Số điện thoại</span>
              <strong className="text-carbon font-mono">{selectedDriver.phone}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate">Giấy phép DL</span>
              <strong className="text-carbon font-mono">{selectedDriver.license}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate">Hạng bằng</span>
              <strong className="text-carbon">{selectedDriver.class}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate">Trạng thái sức khỏe</span>
              <strong className={selectedDriver.healthColor}>{selectedDriver.health}</strong>
            </div>
          </div>

          {/* Recent Trips History */}
          <div className="space-y-3 text-xs border-b border-chalk pb-5">
            <h4 className="text-[10px] font-bold text-slate uppercase tracking-wider">LỊCH SỬ CHUYẾN ĐI GẦN ĐÂY</h4>
            <ul className="space-y-2 text-graphite">
              {selectedDriver.trips.map((t, idx) => (
                <li key={idx} className="flex justify-between items-center text-[11px] p-2 bg-fog rounded border border-chalk">
                  <span>{t}</span>
                  <span className="text-green-600 font-bold shrink-0 ml-2">✓ Hoàn thành</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions Footer */}
          <div className="space-y-3 pt-2">
            <button
              onClick={() => handleContact(selectedDriver.name)}
              className="w-full py-2.5 px-4 rounded-full bg-carbon text-white font-bold text-xs hover:bg-black transition-colors shadow"
            >
              Liên hệ ngay
            </button>
          </div>

        </div>
      )}

    </div>
  )
}
