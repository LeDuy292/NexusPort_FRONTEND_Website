import React, { useState, useMemo } from 'react'

export default function DriverHome({ driverMode = 'pickup', tripStep = 1, setTripStep, onNavigateToTrip }) {
  const [showQrModal, setShowQrModal] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // State thông tin chuyến xe hiện tại theo driverMode
  const currentTrip = useMemo(() => {
    if (driverMode === 'delivery') {
      return {
        tripId: 'TRIP-002',
        vehiclePlate: '43C-123.45',
        containerNo: 'EVER991203-4',
        containerType: "40' High Cube",
        transType: 'TRẢ CONTAINER (HẠ BÃI)',
        status: 'Check-in completed',
        statusDesc: 'Đã check-in thành công tại Cổng B',
        nextDestination: 'Block C – C05-02',
        appointmentTime: '14:00 PM Hôm nay',
        gateName: 'Cổng B',
        step: 2,
      }
    }
    // Default pickup
    return {
      tripId: 'TRIP-001',
      vehiclePlate: '43C-123.45',
      containerNo: 'MSCU1234567',
      containerType: "40' High Cube",
      transType: 'NHẬN CONTAINER (LẤY HÀNG)',
      status: 'Check-in completed',
      statusDesc: 'Đã check-in thành công tại Cổng A',
      nextDestination: 'Block B – B12-04',
      appointmentTime: '09:00 AM Hôm nay',
      gateName: 'Cổng A',
      step: 2,
    }
  }, [driverMode])

  // Lịch hẹn khác trong ngày theo driverMode
  const todayAppointments = useMemo(() => {
    if (driverMode === 'delivery') {
      return [
        { id: 'BK-2093', time: '09:00 AM', type: 'NHẬN CONTAINER', container: 'MSCU1234567', gate: 'Cổng A', status: 'Đã xác nhận' }
      ]
    }
    return [
      { id: 'BK-2094', time: '14:00 PM', type: 'TRẢ CONTAINER', container: 'EVER991203-4', gate: 'Cổng B', status: 'Đã lên lịch' }
    ]
  }, [driverMode])

  const handleCTAAction = () => {
    if (onNavigateToTrip) {
      onNavigateToTrip()
    } else {
      setToastMessage('🗺️ Đã mở Sơ đồ Hướng dẫn di chuyển đến vị trí chỉ định!')
      setTimeout(() => setToastMessage(''), 3000)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-carbon text-white px-5 py-3 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 z-50 animate-bounce border border-signal-orange whitespace-nowrap">
          <span className="text-signal-orange">●</span>
          {toastMessage}
        </div>
      )}

      {/* WORKFLOW TRACKER STEP BAR */}
      <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-2">
        <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">TIẾN TRÌNH CÔNG VIỆC TÀI XẾ</span>
        <div className="grid grid-cols-4 gap-1 text-[9px] font-bold text-center font-mono">
          <div className={`py-2 rounded-lg border transition-all ${
            tripStep === 1 
              ? 'bg-signal-orange text-white border-orange-600 animate-pulse' 
              : tripStep > 1 
              ? 'bg-green-600 text-white border-green-700' 
              : 'bg-fog text-slate border-chalk'
          }`}>
            1. Nhận xe
          </div>
          <div className={`py-2 rounded-lg border transition-all ${
            tripStep === 2 
              ? 'bg-signal-orange text-white border-orange-600 animate-pulse' 
              : tripStep > 2 
              ? 'bg-green-600 text-white border-green-700' 
              : 'bg-fog text-slate border-chalk'
          }`}>
            2. Đi đến bãi
          </div>
          <div className={`py-2 rounded-lg border transition-all ${
            tripStep === 3 
              ? 'bg-signal-orange text-white border-orange-600 animate-pulse' 
              : tripStep > 3 
              ? 'bg-green-600 text-white border-green-700' 
              : 'bg-fog text-slate border-chalk'
          }`}>
            3. Xếp dỡ cont
          </div>
          <div className={`py-2 rounded-lg border transition-all ${
            tripStep === 4 
              ? 'bg-signal-orange text-white border-orange-600 animate-pulse' 
              : tripStep > 4 
              ? 'bg-green-600 text-white border-green-700' 
              : 'bg-fog text-slate border-chalk'
          }`}>
            4. Bàn giao
          </div>
        </div>
      </div>

      {/* STEP CARD RENDERER */}
      {tripStep === 1 && (
        <section className="bg-white border-2 border-carbon rounded-2xl p-6 shadow-md space-y-5 text-center">
          <div className="w-16 h-16 rounded-full bg-orange-100 text-signal-orange flex items-center justify-center mx-auto shadow-sm animate-bounce">
            <span className="material-symbols-outlined text-3xl">local_shipping</span>
          </div>
          <div className="space-y-1">
            <span className="bg-orange-50 text-signal-orange text-[10px] font-extrabold px-2.5 py-1 rounded border border-orange-200 uppercase tracking-wider">
              BƯỚC 1: ĐI LẤY XE CHỈ ĐỊNH
            </span>
            <h3 className="text-xl font-extrabold text-carbon mt-2">Xác nhận xe đầu kéo chỉ định</h3>
            <p className="text-xs text-slate mt-1 leading-relaxed">
              Tài xế Nguyễn Văn A được chỉ định chạy xe kéo biển số <strong className="font-mono text-carbon text-sm">43C-123.45</strong>. Vui lòng nhận đúng phương tiện kéo được giao và xác nhận.
            </p>
          </div>

          <div className="bg-fog p-4 rounded-xl border border-chalk text-left space-y-1.5 text-xs font-mono font-bold">
            <div className="flex justify-between">
              <span className="text-slate">Loại xe đầu kéo:</span>
              <span className="text-carbon">Hyundai Xcient GT (Màu vàng)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate">Hãng xe quản lý:</span>
              <span className="text-carbon">NexusPort Fleet Services</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate">Biển số kéo chỉ định:</span>
              <span className="text-signal-orange">43C-123.45</span>
            </div>
          </div>

          <button
            onClick={() => {
              setTripStep(2)
              setToastMessage('✅ Đã xác nhận nhận xe đầu kéo 43C-123.45!')
              setTimeout(() => setToastMessage(''), 3000)
            }}
            className="w-full h-13 bg-carbon text-white rounded-xl font-extrabold text-sm hover:bg-black transition-colors shadow-lg py-3.5 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">check_circle</span>
            XÁC NHẬN NHẬN XE 43C-123.45
          </button>
        </section>
      )}

      {tripStep === 2 && (
        <section className="bg-white border-2 border-carbon rounded-2xl p-6 shadow-md space-y-5">
          <div className="flex justify-between items-center border-b border-chalk pb-4">
            <div className="flex items-center gap-2">
              <span className="bg-signal-orange text-white text-[10px] font-extrabold px-2.5 py-1 rounded uppercase tracking-wider">
                BƯỚC 2: DI CHUYỂN ĐẾN ĐIỂM HẸN
              </span>
              <span className="font-mono font-bold text-xs text-carbon">{currentTrip.tripId}</span>
            </div>
            
            <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
              ✓ {currentTrip.status}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[10px] font-bold text-slate uppercase tracking-wider">BIỂN SỐ XE KÉO ĐÃ NHẬN</span>
                <div className="text-2xl font-extrabold text-carbon font-mono mt-0.5">{currentTrip.vehiclePlate}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate uppercase tracking-wider">LOẠI GIAO DỊCH</span>
                <div className="text-xs font-extrabold text-signal-orange bg-orange-50 px-2.5 py-1 rounded-md border border-orange-200 mt-0.5">
                  {currentTrip.transType}
                </div>
              </div>
            </div>

            <div className="bg-fog p-4 rounded-xl border border-chalk space-y-1">
              <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">
                {driverMode === 'delivery' ? 'MÃ CONTAINER CẦN GIAO' : 'MÃ CONTAINER TIẾP NHẬN'}
              </span>
              <div className="text-xl font-extrabold text-carbon font-mono tracking-wider">{currentTrip.containerNo}</div>
              <div className="text-[11px] text-slate font-semibold">{currentTrip.containerType}</div>
            </div>
          </div>

          <div className="bg-carbon text-white rounded-xl p-4 space-y-1 shadow-inner">
            <div className="flex justify-between items-center text-[10px] text-slate uppercase font-bold tracking-wider">
              <span>ĐIỂM ĐẾN CHỈ ĐỊNH</span>
              <span className="text-signal-orange">BÃI CONTAINER</span>
            </div>
            <div className="text-2xl font-extrabold text-white tracking-wide font-heading">
              {currentTrip.nextDestination}
            </div>
            <p className="text-[11px] text-gray-300">
              {driverMode === 'delivery' 
                ? 'Vào Cổng B ➔ Di chuyển đến Block C ➔ Hàng 05, Vị trí 02'
                : 'Vào Cổng A ➔ Di chuyển đến Block B ➔ Hàng 12, Vị trí 04'}
            </p>
          </div>

          <button
            onClick={handleCTAAction}
            className="w-full h-13 bg-signal-orange text-white rounded-xl font-extrabold text-sm hover:opacity-95 active:scale-98 transition-all shadow-lg flex items-center justify-center gap-2 py-3.5"
          >
            <span className="material-symbols-outlined text-xl">navigation</span>
            XEM SƠ ĐỒ CHỈ ĐƯỜNG GPS
          </button>
        </section>
      )}

      {tripStep === 3 && (
        <section className="bg-white border-2 border-carbon rounded-2xl p-6 shadow-md space-y-5 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-sm animate-pulse">
            <span className="material-symbols-outlined text-3xl">precision_manufacturing</span>
          </div>
          
          <div className="space-y-1">
            <span className="bg-blue-50 text-blue-700 text-[10px] font-extrabold px-2.5 py-1 rounded border border-blue-200 uppercase tracking-wider">
              BƯỚC 3: XẾP DỠ CONTAINER TẠI BÃI
            </span>
            <h3 className="text-xl font-extrabold text-carbon mt-2">
              {driverMode === 'delivery' ? 'Xác nhận hạ container thành công' : 'Xác nhận nhận hàng thành công'}
            </h3>
            <p className="text-xs text-slate mt-1 leading-relaxed">
              {driverMode === 'delivery' 
                ? `Vui lòng đỗ xe đúng vạch sơn tại ${currentTrip.nextDestination} và chờ cẩu RTG-01 hạ container ${currentTrip.containerNo} xuống bãi.` 
                : `Vui lòng đỗ xe đúng vạch sơn tại ${currentTrip.nextDestination} và chờ cẩu RTG-02 nâng container ${currentTrip.containerNo} lên rơ-moóc.`}
            </p>
          </div>

          <div className="bg-fog p-4 rounded-xl border border-chalk text-left space-y-1.5 text-xs font-mono font-bold">
            <div className="flex justify-between">
              <span className="text-slate">Vị trí đỗ chỉ định:</span>
              <span className="text-carbon">{currentTrip.nextDestination}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate">Mã Container:</span>
              <span className="text-signal-orange">{currentTrip.containerNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate">Cẩu phụ trách bãi:</span>
              <span className="text-carbon">{driverMode === 'delivery' ? 'Cẩu RTG-01' : 'Cẩu RTG-02'}</span>
            </div>
          </div>

          <button
            onClick={() => {
              setTripStep(4)
              setToastMessage(driverMode === 'delivery' ? '✅ Đã xác nhận hạ container xuống bãi thành công!' : '✅ Đã xác nhận lấy hàng thành công!')
              setTimeout(() => setToastMessage(''), 3000)
            }}
            className="w-full h-13 bg-carbon text-white rounded-xl font-extrabold text-sm hover:bg-black transition-colors shadow-lg py-3.5 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">fact_check</span>
            {driverMode === 'delivery' ? 'XÁC NHẬN HẠ CONTAINER THÀNH CÔNG' : 'XÁC NHẬN LẤY HÀNG THÀNH CÔNG'}
          </button>
        </section>
      )}

      {tripStep === 4 && (
        <section className="bg-white border-2 border-carbon rounded-2xl p-6 shadow-md space-y-5 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto shadow-sm animate-bounce">
            <span className="material-symbols-outlined text-3xl">login</span>
          </div>

          <div className="space-y-1">
            <span className="bg-green-50 text-green-700 text-[10px] font-extrabold px-2.5 py-1 rounded border border-green-200 uppercase tracking-wider">
              BƯỚC 4: BÀN GIAO & RỜI CẢNG (GATE OUT)
            </span>
            <h3 className="text-xl font-extrabold text-carbon mt-2">Báo cáo hoàn tất chặng giao</h3>
            <p className="text-xs text-slate mt-1 leading-relaxed">
              {driverMode === 'delivery' 
                ? 'Đã hạ hàng thành công. Vui lòng di chuyển ra Cổng Ra (Gate Out), xuất trình QR Code check-out để hoàn tất giao dịch giao bãi.'
                : 'Đã chất cont lên rơ-moóc. Vui lòng di chuyển ra Cổng Ra (Gate Out), quét QR Code check-out để hoàn tất nhận hàng rời cảng.'}
            </p>
          </div>

          <div className="bg-fog p-4 rounded-xl border border-chalk text-left space-y-1 text-xs font-mono font-bold">
            <div className="flex justify-between">
              <span className="text-slate">Chuyến xe ID:</span>
              <span className="text-carbon">{currentTrip.tripId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate">Mã QR Gate Out:</span>
              <span className="text-signal-orange">Sẵn sàng để quét</span>
            </div>
          </div>

          <button
            onClick={() => {
              setTripStep(5)
              setToastMessage('🏁 Đã xác nhận hoàn tất chặng giao / Gate Out thành công!')
              setTimeout(() => setToastMessage(''), 3000)
            }}
            className="w-full h-13 bg-green-600 text-white rounded-xl font-extrabold text-sm hover:bg-green-700 transition-colors shadow-lg py-3.5 flex items-center justify-center gap-2 animate-pulse"
          >
            <span className="material-symbols-outlined text-lg">task_alt</span>
            XÁC NHẬN GIAO ĐẾN NƠI THÀNH CÔNG
          </button>
        </section>
      )}

      {tripStep === 5 && (
        <section className="bg-white border-2 border-dashed border-green-500 rounded-2xl p-6 shadow-md space-y-5 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto shadow-lg">
            <span className="material-symbols-outlined text-3xl">done_all</span>
          </div>

          <div className="space-y-1">
            <span className="bg-green-50 text-green-700 text-[10px] font-extrabold px-3 py-1 rounded-full border border-green-200 uppercase tracking-wider">
              HOÀN THÀNH XUẤT SẮC
            </span>
            <h3 className="text-2xl font-extrabold text-carbon mt-2">Chuyến xe hoàn tất!</h3>
            <p className="text-xs text-slate mt-1">
              Hệ thống ghi nhận giao dịch của tài xế <strong className="text-carbon">Nguyễn Văn A</strong> trên xe đầu kéo <strong className="font-mono text-carbon">43C-123.45</strong> đã hoàn tất thành công.
            </p>
          </div>

          <div className="bg-fog p-5 rounded-2xl border border-chalk text-left space-y-2 text-xs font-mono font-bold">
            <div className="flex justify-between border-b border-chalk pb-1.5">
              <span className="text-slate">MÃ TRIP:</span>
              <span className="text-carbon">{currentTrip.tripId}</span>
            </div>
            <div className="flex justify-between border-b border-chalk pb-1.5">
              <span className="text-slate">THỜI GIAN HOÀN TẤT:</span>
              <span className="text-carbon">Vừa xong (Live)</span>
            </div>
            <div className="flex justify-between border-b border-chalk pb-1.5">
              <span className="text-slate">CONTAINER:</span>
              <span className="text-carbon">{currentTrip.containerNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate">LOẠI LỆNH:</span>
              <span className="text-signal-orange">{currentTrip.transType}</span>
            </div>
          </div>

          <button
            onClick={() => {
              setTripStep(1)
              setToastMessage('🔄 Đang tải chặng xe mới...')
              setTimeout(() => setToastMessage(''), 2000)
            }}
            className="w-full h-12 bg-carbon text-white rounded-full font-bold text-sm hover:bg-black transition-colors"
          >
            BẮT ĐẦU CHUYẾN XE MỚI
          </button>
        </section>
      )}

      {/* QUICK QR CARD */}
      {tripStep >= 2 && tripStep < 5 ? (
        <section className="bg-white border border-chalk rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate uppercase tracking-wider">MÃ QR CHECK-IN CỔNG</span>
            <h3 className="font-bold text-carbon text-sm">Mã quét qua cổng tự động</h3>
            <p className="text-[11px] text-slate">Đưa màn hình cho Gate Officer quét khi vào bãi</p>
          </div>

          <button
            onClick={() => setShowQrModal(true)}
            className="w-16 h-16 bg-fog border border-chalk rounded-xl p-1.5 shrink-0 flex items-center justify-center hover:border-carbon transition-colors"
          >
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=NEXUSPORT_DRIVER_${currentTrip.tripId}`}
              alt="Quick QR"
              className="w-full h-full object-cover rounded-sm"
            />
          </button>
        </section>
      ) : tripStep < 2 ? (
        <section className="bg-white border border-chalk rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4 opacity-50 relative select-none">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate uppercase tracking-wider">MÃ QR CHECK-IN CỔNG</span>
            <h3 className="font-bold text-carbon text-sm">Mã quét qua cổng tự động</h3>
            <p className="text-[11px] text-slate">Khóa cho đến khi xác nhận nhận xe</p>
          </div>
          <div className="w-12 h-12 bg-fog rounded-xl flex items-center justify-center shrink-0 border border-chalk">
            <span className="material-symbols-outlined text-slate text-xl">lock</span>
          </div>
        </section>
      ) : null}

      {/* TRIP STATUS LIFECYCLE TIMELINE */}
      {tripStep < 5 && (
        <section className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-carbon text-xs uppercase tracking-wider border-b border-chalk pb-2">
            TRẠNG THÁI GIAO DỊCH THỜI GIAN THỰC
          </h3>

          <div className="relative pl-6 space-y-4 text-xs">
            {/* Connecting Line */}
            <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-chalk"></div>

            {/* Step 1: Lịch hẹn */}
            <div className="relative flex justify-between items-center">
              <div className="absolute -left-6 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold">✓</div>
              <span className="font-bold text-carbon">Lịch hẹn đã xác nhận</span>
              <span className="text-[10px] text-slate">08:30 AM</span>
            </div>

            {/* Step 2: Nhận xe */}
            <div className="relative flex justify-between items-center">
              {tripStep > 1 ? (
                <div className="absolute -left-6 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold">✓</div>
              ) : (
                <div className="absolute -left-6 w-5 h-5 rounded-full bg-signal-orange ring-4 ring-orange-100 text-white flex items-center justify-center text-[10px] font-bold animate-pulse">●</div>
              )}
              <span className={`font-bold ${tripStep === 1 ? 'text-signal-orange' : 'text-carbon'}`}>Nhận xe kéo chỉ định (43C-123.45)</span>
              <span className="text-[10px] text-slate">{tripStep > 1 ? '08:45 AM' : 'Hiện tại'}</span>
            </div>

            {/* Step 3: Check-in & Di chuyển */}
            <div className="relative flex justify-between items-center opacity-100">
              {tripStep > 2 ? (
                <div className="absolute -left-6 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold">✓</div>
              ) : tripStep === 2 ? (
                <div className="absolute -left-6 w-5 h-5 rounded-full bg-signal-orange ring-4 ring-orange-100 text-white flex items-center justify-center text-[10px] font-bold animate-pulse">●</div>
              ) : (
                <div className="absolute -left-6 w-5 h-5 rounded-full bg-chalk text-slate flex items-center justify-center text-[10px]">○</div>
              )}
              <span className={`font-bold ${tripStep === 2 ? 'text-signal-orange' : tripStep > 2 ? 'text-carbon' : 'text-slate opacity-50'}`}>
                {driverMode === 'delivery' ? 'Check-in Cổng B & Đến Block C' : 'Check-in Cổng A & Đến Block B'}
              </span>
              <span className="text-[10px] text-slate">{tripStep > 2 ? '08:55 AM' : tripStep === 2 ? 'Hiện tại' : 'Dự kiến'}</span>
            </div>

            {/* Step 4: Xếp dỡ cont */}
            <div className="relative flex justify-between items-center">
              {tripStep > 3 ? (
                <div className="absolute -left-6 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold">✓</div>
              ) : tripStep === 3 ? (
                <div className="absolute -left-6 w-5 h-5 rounded-full bg-signal-orange ring-4 ring-orange-100 text-white flex items-center justify-center text-[10px] font-bold animate-pulse">●</div>
              ) : (
                <div className="absolute -left-6 w-5 h-5 rounded-full bg-chalk text-slate flex items-center justify-center text-[10px]">○</div>
              )}
              <span className={`font-bold ${tripStep === 3 ? 'text-signal-orange' : tripStep > 3 ? 'text-carbon' : 'text-slate opacity-50'}`}>
                {driverMode === 'delivery' ? 'Cẩu RTG-01 hạ container xuống bãi' : 'Cẩu RTG-02 nâng container lên xe'}
              </span>
              <span className="text-[10px] text-slate">{tripStep > 3 ? '09:10 AM' : tripStep === 3 ? 'Hiện tại' : 'Dự kiến'}</span>
            </div>

            {/* Step 5: Gate out rời cảng */}
            <div className="relative flex justify-between items-center">
              {tripStep === 4 ? (
                <div className="absolute -left-6 w-5 h-5 rounded-full bg-signal-orange ring-4 ring-orange-100 text-white flex items-center justify-center text-[10px] font-bold animate-pulse">●</div>
              ) : (
                <div className="absolute -left-6 w-5 h-5 rounded-full bg-chalk text-slate flex items-center justify-center text-[10px]">○</div>
              )}
              <span className={`font-bold ${tripStep === 4 ? 'text-signal-orange' : 'text-slate opacity-50'}`}>Check-out Cổng Ra (Hoàn tất giao dịch)</span>
              <span className="text-[10px] text-slate">{tripStep === 4 ? 'Hiện tại' : 'Dự kiến'}</span>
            </div>
          </div>
        </section>
      )}

      {/* TODAY'S OTHER APPOINTMENTS */}
      {tripStep < 5 && (
        <section className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-carbon text-xs uppercase tracking-wider border-b border-chalk pb-2">
            LỊCH HẸN KHÁC TRONG NGÀY HÔM NAY
          </h3>

          {todayAppointments.map((app) => (
            <div key={app.id} className="p-3 bg-fog rounded-xl border border-chalk flex justify-between items-center text-xs">
              <div>
                <div className="font-bold text-carbon">{app.id} • <span className="text-signal-orange">{app.type}</span></div>
                <div className="text-slate text-[11px] mt-0.5">Cont: {app.container} • {app.gate}</div>
              </div>
              <span className="font-bold text-carbon font-mono bg-white px-2.5 py-1 rounded border border-chalk">
                {app.time}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* FULLSCREEN QR MODAL */}
      {showQrModal && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-xs w-full text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div>
              <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">NEXUSPORT DRIVER PASS</span>
              <h3 className="font-bold text-carbon text-lg mt-0.5">{currentTrip.tripId}</h3>
              <p className="text-xs text-signal-orange font-bold mt-1">{currentTrip.transType}</p>
            </div>

            <div className="p-4 bg-white border-2 border-carbon rounded-2xl inline-block shadow-md">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=NEXUSPORT_DRIVER_${currentTrip.tripId}`}
                alt="Full QR"
                className="w-48 h-48 mx-auto"
              />
            </div>

            <div className="text-xs space-y-1 font-mono font-bold text-carbon">
              <div>Xe: {currentTrip.vehiclePlate}</div>
              <div>Cont: {currentTrip.containerNo}</div>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full h-12 bg-carbon text-white rounded-full font-bold text-sm hover:bg-black transition-colors"
            >
              Đóng màn hình QR
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
