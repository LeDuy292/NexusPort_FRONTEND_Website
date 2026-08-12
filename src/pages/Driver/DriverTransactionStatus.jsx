import React, { useMemo } from 'react'

export default function DriverTransactionStatus({ driverMode = 'pickup', tripStep = 1 }) {
  const tripInfo = useMemo(() => {
    if (driverMode === 'delivery') {
      return {
        tripId: 'TRIP-002',
        vehicle: '43C-123.45',
        container: 'EVER991203-4',
        currentLoc: tripStep === 1 ? 'Bãi xe kéo đầu vàng' : tripStep === 2 ? 'Đường nội bộ Road 01' : 'Khối bãi Block C',
        destination: 'Block C - Position C05-02',
        isDelayed: false,
        delayReason: ''
      }
    }
    // Default pickup
    return {
      tripId: 'TRIP-001',
      vehicle: '43C-123.45',
      container: 'MSCU1234567',
      currentLoc: tripStep === 1 ? 'Bãi xe kéo đầu vàng' : tripStep === 2 ? 'Đường nội bộ Road 01' : 'Khối bãi Block B',
      destination: 'Block B - Position B12-04',
      isDelayed: false,
      delayReason: ''
    }
  }, [driverMode, tripStep])

  const steps = useMemo(() => {
    const isDelivery = driverMode === 'delivery'
    return [
      { title: 'Lịch hẹn đã xác nhận', time: '08:30 AM', done: true, active: false },
      { title: 'Đến cổng kiểm soát', time: '08:50 AM', done: true, active: false },
      { title: isDelivery ? 'Check-in Cổng B thành công' : 'Check-in Cổng A thành công', time: '08:55 AM', done: true, active: false },
      { title: 'Nhận xe đầu kéo chỉ định (43C-123.45)', time: '09:00 AM', done: tripStep > 1, active: tripStep === 1 },
      { title: isDelivery ? 'Đang di chuyển vào bãi hạ cont' : 'Đang di chuyển đến bãi lấy cont', time: '09:05 AM', done: tripStep > 2, active: tripStep === 2 },
      { title: isDelivery ? 'Cẩu RTG-01 hạ container xuống bãi' : 'Cẩu RTG-02 nâng container lên xe', time: 'Dự kiến 09:15 AM', done: tripStep > 3, active: tripStep === 3 },
      { title: 'Xác nhận Gate Out rời cảng', time: 'Dự kiến 09:30 AM', done: tripStep > 4, active: tripStep === 4 },
      { title: 'Hoàn tất giao dịch', time: 'Dự kiến 09:45 AM', done: tripStep === 5, active: false }
    ]
  }, [driverMode, tripStep])

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-20 p-2">
      
      {/* Header */}
      <div className="border-b border-chalk pb-3 text-center">
        <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded uppercase">
          LIVE TRANSACTION LIFECYCLE
        </span>
        <h2 className="font-heading text-xl text-carbon font-extrabold mt-1">Trạng thái Giao dịch</h2>
      </div>

      {/* DELAY ALERT BANNER (NẾU CÓ DELAY) */}
      {tripInfo.isDelayed && (
        <div className="bg-amber-500 text-white rounded-2xl p-4 shadow-md flex items-center gap-3 border border-amber-600">
          <span className="material-symbols-outlined text-3xl font-bold">warning</span>
          <div>
            <h4 className="font-extrabold text-sm uppercase">⚠ DELAYED — TẮC NGHẼN BÃI TEMPORARY</h4>
            <p className="text-xs text-amber-100">{tripInfo.delayReason || 'Cẩu RTG-02 đang dỡ container quá tải tại Hàng 11, vui lòng chờ 5 phút.'}</p>
          </div>
        </div>
      )}

      {/* TRIP METADATA CARD */}
      <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-3 font-mono text-xs">
        <div className="flex justify-between border-b border-chalk pb-2 font-bold text-sm">
          <span className="text-slate">TRIP ID:</span>
          <span className="text-carbon font-extrabold">{tripInfo.tripId}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-slate text-[10px] uppercase font-bold block">BIỂN SỐ XE KÉO</span>
            <strong className="text-carbon">{tripInfo.vehicle}</strong>
          </div>
          <div className="text-right">
            <span className="text-slate text-[10px] uppercase font-bold block">MÃ CONTAINER</span>
            <strong className="text-carbon">{tripInfo.container}</strong>
          </div>
        </div>

        <div className="pt-2 border-t border-chalk grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-slate text-[10px] uppercase font-bold block font-sans">VỊ TRÍ HIỆN TẠI</span>
            <span className="text-carbon font-bold font-sans">{tripInfo.currentLoc}</span>
          </div>
          <div className="text-right">
            <span className="text-slate text-[10px] uppercase font-bold block font-sans">ĐIỂM ĐẾN</span>
            <span className="text-signal-orange font-bold font-sans">{tripInfo.destination}</span>
          </div>
        </div>
      </div>

      {/* TIMELINE TRACKER (HIGHLIGHT TRẠNG THÁI HIỆN TẠI) */}
      <div className="bg-white border border-chalk rounded-3xl p-6 shadow-sm space-y-4">
        <h4 className="font-bold text-carbon text-xs uppercase tracking-wider border-b border-chalk pb-3">
          TIẾN TRÌNH THỜI GIAN THỰC
        </h4>

        <div className="relative pl-6 space-y-5 text-xs">
          {/* Vertical Connecting Line */}
          <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-chalk"></div>

          {steps.map((step, idx) => (
            <div key={idx} className="relative flex justify-between items-center">
              {step.done ? (
                <div className="absolute -left-6 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                  ✓
                </div>
              ) : step.active ? (
                <div className="absolute -left-6 w-5 h-5 rounded-full bg-signal-orange ring-4 ring-orange-100 text-white flex items-center justify-center text-[10px] font-bold animate-pulse shadow-md">
                  ●
                </div>
              ) : (
                <div className="absolute -left-6 w-5 h-5 rounded-full bg-fog border border-chalk text-slate flex items-center justify-center text-[10px]">
                  ○
                </div>
              )}

              <span className={`font-bold ${
                step.active
                  ? 'text-signal-orange text-sm'
                  : step.done
                  ? 'text-carbon'
                  : 'text-slate'
              }`}>
                {step.title}
              </span>

              <span className={`text-[10px] font-mono ${
                step.active ? 'text-signal-orange font-extrabold' : 'text-slate'
              }`}>
                {step.time}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
