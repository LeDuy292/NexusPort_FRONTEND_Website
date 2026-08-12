import React, { useState } from 'react'

export default function BookingManagement() {
  const [activeTab, setActiveTab] = useState('create')
  const [wizardStep, setWizardStep] = useState(2)
  const [selectedSlot, setSelectedSlot] = useState('09:00-Gate-B')
  const [bookingFilter, setBookingFilter] = useState('Tất cả')

  // Data mẫu các khung giờ đặt chỗ
  const timeSlots = [
    { time: '08:00', slots: [
      { gate: 'Gate A', status: 'available' },
      { gate: 'Gate B', status: 'available' },
      { gate: 'Gate C', status: 'full' },
      { gate: 'Gate D', status: 'available' },
      { gate: 'Gate E', status: 'available' },
    ]},
    { time: '09:00', slots: [
      { gate: 'Gate A', status: 'full' },
      { gate: 'Gate B', status: 'selected' },
      { gate: 'Gate C', status: 'available' },
      { gate: 'Gate D', status: 'full' },
      { gate: 'Gate E', status: 'available' },
    ]}
  ]

  // Data mẫu danh sách đặt chỗ gần đây
  const bookingsData = [
    { id: 'BK-2093', statusTag: 'ĐANG VẬN CHUYỂN', statusColor: 'text-signal-orange border-l-signal-orange', carrier: 'Maersk Sealand', detail: 'Gate B • 09:00 AM Hôm nay', mode: 'Vessel 4', modeIcon: 'directions_boat', statusGroup: 'Chờ xử lý' },
    { id: 'BK-2094', statusTag: 'ĐÃ LÊN LỊCH', statusColor: 'text-slate border-l-slate', carrier: 'Evergreen Marine', detail: 'Gate A • 14:00 PM Ngày mai', mode: 'Rail Link', modeIcon: 'train', statusGroup: 'Chờ xử lý' },
    { id: 'BK-2088', statusTag: 'ĐÃ HOÀN THÀNH', statusColor: 'text-graphite border-l-graphite', carrier: 'CMA CGM', detail: 'Gate D • 11:30 AM Hôm qua', mode: 'Road', modeIcon: 'local_shipping', statusGroup: 'Đã hoàn thành' },
  ]

  const filteredBookings = bookingsData.filter(b => {
    if (bookingFilter === 'Tất cả') return true
    return b.statusGroup === bookingFilter
  })

  return (
    <div className="p-8 w-full font-sans flex flex-col gap-8">
      {/* Title */}
      <div>
        <h2 className="font-heading text-4xl text-primary font-bold">Quản lý Đặt chỗ</h2>
        <p className="text-sm text-slate mt-1">Đăng ký khung giờ và theo dõi lộ trình container cho doanh nghiệp vận tải.</p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-8 border-b border-chalk">
        {[
          { key: 'create', label: 'Tạo đặt chỗ' },
          { key: 'my_bookings', label: 'Đặt chỗ của tôi' },
          { key: 'container_status', label: 'Trạng thái container' },
          { key: 'approval_queue', label: 'Hàng đợi phê duyệt' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 px-1 font-semibold text-sm transition-colors ${
              activeTab === tab.key
                ? 'text-primary border-b-2 border-signal-orange font-bold'
                : 'text-slate hover:text-carbon'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT 1: CREATE BOOKING WIZARD */}
      {activeTab === 'create' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          
          {/* Section Wizard (Step 2 of 3) */}
          <section className="bg-paper border border-chalk rounded-xl p-8 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-chalk pb-6">
              <div>
                <h3 className="font-heading text-xl font-bold text-primary">Tạo đặt chỗ mới</h3>
                <p className="text-xs text-slate mt-0.5">Bước {wizardStep} trên 3: Chọn khung giờ và cổng kiểm soát mong muốn</p>
              </div>

              {/* Wizard Stepper */}
              <div className="flex items-center gap-0">
                {/* Step 1 Done */}
                <div className="flex items-center">
                  <div className="w-7 h-7 rounded-full bg-signal-orange text-white flex items-center justify-center font-bold text-xs">
                    ✓
                  </div>
                  <div className="w-12 h-0.5 bg-signal-orange"></div>
                </div>

                {/* Step 2 Active */}
                <div className="flex items-center">
                  <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-xs ${
                    wizardStep === 2 ? 'bg-carbon ring-2 ring-carbon ring-offset-2' : 'bg-chalk text-slate'
                  }`}>
                    2
                  </div>
                  <div className="w-12 h-0.5 bg-chalk"></div>
                </div>

                {/* Step 3 Pending */}
                <div className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                    wizardStep === 3 ? 'bg-carbon text-white' : 'bg-chalk text-slate'
                  }`}>
                    3
                  </div>
                </div>
              </div>
            </div>

            {/* Time Slot Grid */}
            <div className="space-y-4">
              {timeSlots.map((row, idx) => (
                <div key={idx} className="grid grid-cols-6 gap-3 items-center">
                  <div className="col-span-1">
                    <span className="text-xs font-bold text-slate uppercase font-mono">{row.time}</span>
                  </div>
                  {row.slots.map((slot, sIdx) => {
                    const slotKey = `${row.time}-${slot.gate}`
                    const isSelected = selectedSlot === slotKey
                    const isFull = slot.status === 'full'

                    return (
                      <button
                        key={sIdx}
                        disabled={isFull}
                        onClick={() => setSelectedSlot(slotKey)}
                        className={`h-12 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                          isSelected
                            ? 'bg-carbon text-white shadow-md ring-2 ring-carbon ring-offset-2'
                            : isFull
                            ? 'bg-fog border border-transparent text-slate line-through cursor-not-allowed opacity-60'
                            : 'bg-white border border-chalk text-primary hover:border-carbon hover:shadow-sm'
                        }`}
                      >
                        {slot.gate}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Footer Buttons */}
            <div className="mt-8 flex justify-end gap-4 border-t border-chalk pt-6">
              <button
                onClick={() => setWizardStep(1)}
                className="px-6 py-2.5 rounded-full border border-carbon text-carbon text-xs font-bold hover:bg-fog transition-colors"
              >
                Quay lại
              </button>
              <button
                onClick={() => setWizardStep(3)}
                className="px-6 py-2.5 rounded-full bg-signal-orange text-white text-xs font-bold hover:opacity-90 transition-opacity shadow"
              >
                Xác nhận lựa chọn
              </button>
            </div>
          </section>

          {/* My Bookings Preview */}
          <section className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-heading text-lg font-bold text-primary">Đặt chỗ gần đây</h3>
              <div className="flex gap-2 text-xs font-bold">
                {['Tất cả', 'Chờ xử lý', 'Đã hoàn thành'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setBookingFilter(f)}
                    className={`px-4 py-1.5 rounded-full transition-colors ${
                      bookingFilter === f ? 'bg-carbon text-white' : 'border border-chalk text-graphite hover:border-carbon'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredBookings.map((bk) => (
                <div
                  key={bk.id}
                  className={`bg-paper border border-chalk rounded-xl p-6 shadow-sm border-l-4 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow ${
                    bk.id === 'BK-2093' ? 'border-l-signal-orange' : 'border-l-slate'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider">{bk.statusTag}</span>
                    <span className="text-xs text-slate font-mono">{bk.id}</span>
                  </div>

                  <div>
                    <h4 className="font-bold text-carbon text-base">{bk.carrier}</h4>
                    <p className="text-xs text-graphite mt-1">{bk.detail}</p>
                  </div>

                  <div className="pt-4 border-t border-chalk flex justify-between items-center text-xs">
                    <span className="text-graphite font-semibold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">{bk.modeIcon}</span>
                      {bk.mode}
                    </span>
                    <button className="text-primary font-bold hover:underline">Chi tiết ➔</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Container Tracking Timeline */}
          <section className="bg-paper border border-chalk rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="font-heading text-lg font-bold text-primary">
              Lộ trình container đang hoạt động: <span className="text-signal-orange">CNT-992A</span>
            </h3>

            <div className="relative flex justify-between items-center px-6 py-4">
              {/* Connecting Background Line */}
              <div className="absolute top-1/2 left-10 right-10 h-1 bg-chalk -translate-y-1/2 z-0"></div>

              {/* Animated Progress Line */}
              <div className="absolute top-1/2 left-10 w-[60%] h-1 bg-signal-orange -translate-y-1/2 z-0 transition-all duration-1000"></div>

              {/* Step 1 Done */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-signal-orange border-4 border-paper shadow-sm"></div>
                <span className="text-[10px] font-bold text-primary uppercase text-center w-24">ĐÃ DỠ HÀNG</span>
              </div>

              {/* Step 2 Done */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-signal-orange border-4 border-paper shadow-sm"></div>
                <span className="text-[10px] font-bold text-primary uppercase text-center w-24">HẢI QUAN</span>
              </div>

              {/* Step 3 Active */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-paper border-4 border-signal-orange shadow-sm animate-pulse"></div>
                <span className="text-[10px] font-bold text-signal-orange uppercase text-center w-24">CHUYỂN BÃI</span>
              </div>

              {/* Step 4 Pending */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-chalk border-4 border-paper shadow-sm"></div>
                <span className="text-[10px] font-bold text-slate uppercase text-center w-24">XUẤT CỔNG</span>
              </div>
            </div>
          </section>

        </div>
      )}

      {/* TAB CONTENT 2: MY BOOKINGS LIST */}
      {activeTab === 'my_bookings' && (
        <div className="bg-paper border border-chalk rounded-xl p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
          <h3 className="font-heading text-lg font-bold text-primary">Danh sách đặt chỗ của tôi</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-chalk text-slate font-bold uppercase text-[10px]">
                  <th className="py-3">Mã đặt chỗ</th>
                  <th className="py-3">Hãng tàu</th>
                  <th className="py-3">Cổng & Khung giờ</th>
                  <th className="py-3">Phương thức</th>
                  <th className="py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk">
                {bookingsData.map(bk => (
                  <tr key={bk.id} className="hover:bg-fog font-medium">
                    <td className="py-4 font-bold text-carbon">{bk.id}</td>
                    <td className="py-4">{bk.carrier}</td>
                    <td className="py-4 text-slate">{bk.detail}</td>
                    <td className="py-4 font-bold text-carbon">{bk.mode}</td>
                    <td className="py-4">
                      <span className="px-2.5 py-1 rounded bg-orange-50 text-signal-orange text-[10px] font-bold">
                        {bk.statusTag}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OTHER TABS PLACEHOLDER */}
      {(activeTab === 'container_status' || activeTab === 'approval_queue') && (
        <div className="bg-paper border border-chalk rounded-xl p-12 text-center text-slate space-y-2 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-4xl text-slate">analytics</span>
          <h4 className="font-bold text-carbon text-lg">Dữ liệu đang đồng bộ thời gian thực</h4>
          <p className="text-xs">Vui lòng kiểm tra lại sau khi luồng cổng và kiểm soát container được cập nhật.</p>
        </div>
      )}

    </div>
  )
}
