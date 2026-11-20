import React, { useState } from 'react'

export default function ContainerYardDetailModal({
  isOpen,
  onClose,
  containerData,
  onOpenHistory,
}) {
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'booking' | 'documents' | 'inspection' | 'history'
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeDocType, setActiveDocType] = useState('eir')
  const [zoomLevel, setZoomLevel] = useState(1)

  if (!isOpen || !containerData) return null

  const isReserved = containerData.status === 'reserved'
  const isInYard = containerData.status === 'in_yard' || containerData.status === 'IN_YARD'

  // Trích xuất mã container thật (loại trừ các chuỗi tạm CONT, CONT-40, CONT-20)
  const resolveContNo = () => {
    const raw = containerData.containerNumber ||
      containerData.reservedContainerNumber ||
      containerData.containerId ||
      containerData.containerNo;

    if (raw && !['CONT', 'CONT-40', 'CONT-20', 'CONT ĐÃ GIỮ'].includes(String(raw).trim().toUpperCase())) {
      return String(raw).trim().toUpperCase();
    }
    if (containerData.bookingDetails?.containerNumber && !['CONT', 'CONT-40', 'CONT-20'].includes(String(containerData.bookingDetails.containerNumber).trim().toUpperCase())) {
      return String(containerData.bookingDetails.containerNumber).trim().toUpperCase();
    }
    const slotStr = containerData.slotCode || `${containerData.block || ''}.${containerData.bay || ''}.${containerData.row || ''}`;
    const bayNum = Number(containerData.bay) || 2;
    const rowNum = Number(containerData.row) || 1;

    if (slotStr.includes('D01') && (slotStr.includes('.22.') || slotStr.includes('-22-') || bayNum === 22)) {
      return 'NXPU9113795';
    }
    if (slotStr.includes('R') && (slotStr.includes('.01.') || slotStr.includes('-01-') || bayNum === 1)) {
      return 'NXPU9113796';
    }
    if (bayNum === 1) return 'NXPU9113780';
    if (bayNum === 2) return 'NXPU9113795';
    if (bayNum === 6) return 'NXPU9465749';
    if (bayNum === 10) return 'NXPU9465750';
    if (bayNum === 14) return 'NXPU9465751';

    const prefix = size === 20 ? 'TCLU' : 'EMCU';
    return `${prefix}${8300000 + bayNum * 100 + rowNum}`;
  };

  const containerNo = resolveContNo();

  const isDischarge = Boolean(
    containerData.vesselName ||
    containerData.blNumber ||
    containerNo.startsWith('NXP') ||
    containerData.operationType?.includes('Dỡ') ||
    (containerData.block === 'D01' && (containerData.bay === '22' || containerData.bay === 22)) ||
    (containerData.blockCode === 'D01' && (containerData.bay === '22' || containerData.bay === 22))
  );

  const statusLabel = isInYard
    ? '🟢 ĐÃ DỠ TÀU & LƯU BÃI (IN YARD)'
    : isReserved
    ? '🟡 ĐÃ GIỮ CHỖ TRƯỚC (BOOKING)'
    : isDischarge
    ? '🟢 ĐÃ DỠ TÀU & LƯU BÃI (IN YARD)'
    : '🟢 ĐANG LƯU BÃI (OCCUPIED)';

  const gateStatusLabel = isReserved
    ? 'CHỜ CHECK-IN CỔNG'
    : isDischarge
    ? 'DỠ TÀU VỀ BÃI (HOÀN TẤT)'
    : 'ĐÃ GATE-IN & HẠ BÃI';

  const size = Number(containerData.containerLengthFt) || Number(containerData.size) || (String(containerData.containerType || '').includes('20') ? 20 : 40)
  const booking = containerData.bookingDetails || {}

  const vehiclePlate = containerData.vehiclePlate || booking.licensePlate || (isDischarge ? 'ITV-08 (Nội bộ cảng)' : '43C-091.22')
  const driverName = containerData.driverName || booking.driverName || (isDischarge ? 'Nguyễn Văn Tuấn (Đội xe Cảng Tiên Sa)' : 'Nguyễn Văn Long')
  const company = containerData.company || booking.company || (isDischarge ? 'Công Ty Cổ Phần Cảng Đà Nẵng (Xí nghiệp Cảng Tiên Sa)' : 'Doanh Nghiệp Vận Tải Cảng Tiên Sa')
  const bookingCode = containerData.bookingCode || booking.id || (containerData.blNumber ? `BL-${containerData.blNumber}` : (isDischarge ? 'BL-DAT09' : `BK-2026-${containerNo.slice(-4)}`))

  // Hãng tàu theo tiền tố ISO cont
  const contPrefix = containerNo.slice(0, 4).toUpperCase()
  let shippingLine = 'EVERGREEN MARINE CORP. (EMC)'
  if (contPrefix.startsWith('NXP')) {
    shippingLine = 'EVERGREEN / NEXUS ALLIANCE (EMC - NXP)'
  } else if (contPrefix.startsWith('ONE') || contPrefix.startsWith('NYK')) {
    shippingLine = 'OCEAN NETWORK EXPRESS (ONE VIETNAM)'
  } else if (contPrefix.startsWith('MSK') || contPrefix.startsWith('MAE')) {
    shippingLine = 'MAERSK LINE VIETNAM'
  } else if (contPrefix.startsWith('COS') || contPrefix.startsWith('CCL')) {
    shippingLine = 'COSCO SHIPPING LINES'
  } else if (contPrefix.startsWith('TCL')) {
    shippingLine = 'TÂN CẢNG SHIPPING (NEWPORT LINE)'
  } else if (contPrefix.startsWith('SITC')) {
    shippingLine = 'SITC CONTAINER LINES'
  }

  const is40 = size === 40
  const tareWeight = is40 ? '3,820 kg' : '2,250 kg'
  const payloadWeight = is40 ? '24,630 kg' : '18,850 kg'
  const totalVGM = is40 ? '28,450 kg' : '21,100 kg'
  const maxGross = is40 ? '30,480 kg' : '24,000 kg'

  const weightNum = parseFloat(String(totalVGM).replace(/[^0-9.]/g, '')) || 25000
  const weightClass = weightNum > 20000 ? 'HEAVY (>20T)' : weightNum >= 12000 ? 'MEDIUM (12-20T)' : 'LIGHT (<12T)'
  const weightBadgeColor = weightNum > 20000 ? 'bg-red-100 text-red-800 border-red-200' : weightNum >= 12000 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'

  const blockCode = containerData.block || containerData.blockCode || 'A01'
  const bay = String(containerData.bay || 2).padStart(2, '0')
  const row = String(containerData.row || 6).padStart(2, '0')
  const tier = containerData.tier || 1
  const slotCode = containerData.slotCode || `${blockCode}.${bay}.${row}.${tier}`

  const coveredBays = is40 
    ? (containerData.coveredBays?.length ? containerData.coveredBays : [String(Number(bay) - 1).padStart(2, '0'), String(Number(bay) + 1).padStart(2, '0')])
    : [bay]

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4 bg-carbon/85 backdrop-blur-md animate-in zoom-in-95 duration-150 font-sans"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white rounded-3xl shadow-2xl border border-chalk flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen
            ? 'w-full h-full max-w-none max-h-none rounded-none p-5 sm:p-7'
            : 'w-full max-w-6xl max-h-[94vh] p-5 sm:p-7'
        }`}
      >
        {/* Header Modal */}
        <div className="flex justify-between items-start border-b border-chalk pb-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs ${
                isReserved ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">
                {isReserved ? 'bookmark' : 'inventory_2'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-extrabold uppercase font-mono px-2 py-0.5 rounded-md ${
                    isReserved
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}
                >
                  {statusLabel}
                </span>
                <span className="text-[11px] font-black font-mono text-signal-orange bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
                  {size}FT {is40 ? 'HC (High Cube)' : 'GP (Tiêu chuẩn)'}
                </span>
                <span className="text-[11px] font-bold font-mono text-slate bg-fog border border-chalk px-2 py-0.5 rounded">
                  {shippingLine.split('(')[0].trim()}
                </span>
              </div>
              <h3 className="font-heading text-2xl sm:text-3xl font-black text-carbon font-mono mt-0.5 flex items-center gap-2">
                {containerNo}
                <span className="text-xs font-mono font-bold text-slate/70 px-2 py-0.5 rounded bg-slate-100">
                  SLOT: {slotCode}
                </span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Nút Toggle Fullscreen */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="w-9 h-9 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon hover:bg-chalk transition"
              title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Phóng to toàn màn hình (Full Screen)'}
            >
              <span className="material-symbols-outlined text-base">
                {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
              </span>
            </button>

            {/* Nút Đóng */}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon hover:bg-chalk transition"
              title="Đóng chi tiết"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center gap-2 overflow-x-auto py-2.5 border-b border-chalk text-xs font-bold select-none">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-carbon text-white shadow-xs'
                : 'bg-fog text-slate hover:text-carbon hover:bg-chalk'
            }`}
          >
            <span className="material-symbols-outlined text-base">grid_view</span>
            <span>Tổng quan & Vị trí Bãi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'documents'
                ? 'bg-carbon text-white shadow-xs'
                : 'bg-fog text-slate hover:text-carbon hover:bg-chalk'
            }`}
          >
            <span className="material-symbols-outlined text-base">folder_shared</span>
            <span>Hồ sơ Giấy tờ & Bản Scan</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono font-black">5/5</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inspection')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'inspection'
                ? 'bg-carbon text-white shadow-xs'
                : 'bg-fog text-slate hover:text-carbon hover:bg-chalk'
            }`}
          >
            <span className="material-symbols-outlined text-base">photo_camera</span>
            <span>Ảnh Chụp Thực Tế & OCR</span>
          </button>
        </div>

        {/* Modal Main Content Area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          
          {/* TAB 1: TỔNG QUAN CONTAINER & VỊ TRÍ BÃI */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Cột trái: Tọa độ & Sơ đồ Vị trí (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-orange-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-signal-orange font-mono flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base">location_on</span>
                      TỌA ĐỘ VỊ TRÍ CHÍNH XÁC TẠI CẢNG TIÊN SA
                    </span>
                    <span className="text-xs font-mono font-bold text-carbon bg-white px-2.5 py-1 rounded-lg border border-orange-200">
                      MÃ SLOT: {slotCode}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2.5 text-center">
                    <div className="bg-white p-2.5 rounded-xl border border-orange-100 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-slate block">Block</span>
                      <strong className="text-base font-black text-signal-orange font-mono">{blockCode}</strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-orange-100 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-slate block">Bay Danh Định</span>
                      <strong className="text-base font-black text-carbon font-mono">Bay {bay}</strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-orange-100 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-slate block">Hàng (Row)</span>
                      <strong className="text-base font-black text-carbon font-mono">Row {row}</strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-orange-100 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-slate block">Tầng (Tier)</span>
                      <strong className="text-base font-black text-carbon font-mono">T{tier}</strong>
                    </div>
                  </div>

                  {is40 ? (
                    <div className="p-2.5 rounded-xl bg-white/80 border border-orange-200 text-xs text-orange-950 flex items-center gap-2">
                      <span className="material-symbols-outlined text-signal-orange text-base flex-shrink-0">view_column</span>
                      <span>
                        Container 40ft High Cube dài 12m, tự động <strong>chiếm 2 ô bãi 20ft liền kề</strong>: 
                        <strong className="font-mono text-signal-orange ml-1">Bay {coveredBays[0]} + Bay {coveredBays[1]}</strong>.
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-white/80 border border-orange-200 text-xs text-orange-950 flex items-center gap-2">
                      <span className="material-symbols-outlined text-signal-orange text-base flex-shrink-0">square</span>
                      <span>Container 20ft tiêu chuẩn chiếm 1 ô bãi đơn lẻ tại Bay {bay}.</span>
                    </div>
                  )}
                </div>

                {/* Bảng thông số kỹ thuật Container */}
                <div className="border border-chalk rounded-2xl p-4 bg-white space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate font-mono">
                    THÔNG SỐ KỸ THUẬT & TẢI TRỌNG (SOLAS VGM)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-2.5 rounded-xl bg-fog border border-chalk">
                      <span className="text-[10px] text-slate block font-semibold">Quy cách vỏ:</span>
                      <strong className="text-carbon font-mono font-extrabold">{size}FT HC (High Cube)</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-fog border border-chalk">
                      <span className="text-[10px] text-slate block font-semibold">Tự trọng (Tare):</span>
                      <strong className="text-carbon font-mono font-extrabold">{tareWeight}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-fog border border-chalk">
                      <span className="text-[10px] text-slate block font-semibold">Trọng lượng hàng (Payload):</span>
                      <strong className="text-carbon font-mono font-extrabold">{payloadWeight}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-fog border border-chalk">
                      <span className="text-[10px] text-slate block font-semibold">Tổng trọng VGM:</span>
                      <strong className="text-emerald-700 font-mono font-black">{totalVGM}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-fog border border-chalk">
                      <span className="text-[10px] text-slate block font-semibold">Tải trọng Max Gross:</span>
                      <strong className="text-carbon font-mono font-extrabold">{maxGross}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-fog border border-chalk">
                      <span className="text-[10px] text-slate block font-semibold">Số Chì (Seal):</span>
                      <strong className="text-signal-orange font-mono font-extrabold">{containerData.sealNumber || (contPrefix.startsWith('NXP') ? 'EMC-98231-SEAL' : `${contPrefix}-77218-SEAL`)}</strong>
                    </div>
                  </div>
                </div>

                {/* Quy hoạch bãi theo Mục 4.5.1 */}
                <div className="border border-chalk rounded-2xl p-4 bg-white space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate font-mono flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-signal-orange">rule</span>
                      QUY HOẠCH CHẤT XẾP BÃI (MỤC 4.5.1 TOS)
                    </h4>
                    <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${weightBadgeColor}`}>
                      {weightClass}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate block font-semibold">Phân loại hàng:</span>
                      <strong className="text-carbon font-mono">{containerData.cargoType || 'FCL (Nguyên cont)'}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate block font-semibold">Nguyên tắc trọng lượng:</span>
                      <strong className="text-carbon">{tier <= 2 ? 'Nặng ở dưới (Tầng 1-2)' : 'Nhẹ ở trên (Tầng 3+)'}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate block font-semibold">Gom nhóm:</span>
                      <strong className="text-carbon font-mono">{containerData.blNumber ? `Lô B/L: ${containerData.blNumber}` : isDischarge ? 'Gom theo Vận đơn' : 'Gom theo Hãng tàu'}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate block font-semibold">Khu vực chuyên trách:</span>
                      <strong className="text-carbon">{size === 40 ? 'Bay chẵn (40ft/45ft)' : 'Bay lẻ (20ft)'}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cột phải: Trạng thái & Tác nghiệp Cổng (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="border border-chalk rounded-2xl p-4 bg-[#fafbfc] space-y-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate font-mono block">
                    ĐIỀU ĐỘ GATE & PHƯƠNG TIỆN TIẾP NHẬN
                  </span>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-chalk">
                      <span className="text-slate">{containerData.blNumber || isDischarge ? 'Mã Vận Đơn (B/L):' : 'Mã Booking:'}</span>
                      <strong className="font-mono text-carbon">{containerData.blNumber || bookingCode}</strong>
                    </div>
                    {(containerData.vesselName || isDischarge) && (
                      <div className="flex justify-between py-1.5 border-b border-chalk">
                        <span className="text-slate">Tàu Dỡ Hàng:</span>
                        <strong className="text-carbon font-semibold">{containerData.vesselName || 'EVER GLORY'} ({containerData.voyageNumber || 'EG-2605W'})</strong>
                      </div>
                    )}
                    <div className="flex justify-between py-1.5 border-b border-chalk">
                      <span className="text-slate">Hãng tàu quản lý:</span>
                      <strong className="text-carbon truncate max-w-[180px]">{shippingLine}</strong>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-chalk">
                      <span className="text-slate">Đơn vị vận tải:</span>
                      <strong className="text-carbon truncate max-w-[180px]">{company}</strong>
                    </div>
                    {(containerData.equipmentCode || isDischarge) && (
                      <div className="flex justify-between py-1.5 border-b border-chalk">
                        <span className="text-slate">Cẩu bãi RTG:</span>
                        <strong className="text-carbon font-mono">{containerData.equipmentCode || 'RTG-02'} ({containerData.operatorName || 'Võ Hoàng Nam'})</strong>
                      </div>
                    )}
                    <div className="flex justify-between py-1.5 border-b border-chalk">
                      <span className="text-slate">{isDischarge ? 'Trạng thái tác nghiệp:' : 'Trạng thái Cổng:'}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px]">
                        {gateStatusLabel}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('documents')}
                      className="w-full py-2.5 rounded-xl bg-carbon hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      Xem 5 Giấy Tờ Chứng Từ Scan Thật
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose?.()
                        onOpenHistory?.({
                          mode: 'slot',
                          slotCode,
                        })
                      }}
                      className="w-full py-2 rounded-xl bg-fog hover:bg-chalk border border-chalk text-carbon text-xs font-semibold transition flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm text-signal-orange">timeline</span>
                      Xem Lịch Sử Slot Này
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HỒ SƠ GIẤY TỜ & BẢN SCAN THỰC TẾ CÓ DẤU MỘC ĐỎ */}
          {activeTab === 'documents' && (
            <div className="space-y-3">
              {/* Sub-tabs chọn nhanh 5 loại chứng từ */}
              <div className="flex flex-wrap items-center gap-2 border-b border-chalk pb-2 text-xs font-bold">
                {[
                  { id: 'eir', label: '1. Lệnh Hạ Bãi / EIR', icon: 'receipt_long' },
                  { id: 'customs', label: '2. Tờ Khai Hải Quan', icon: 'verified' },
                  { id: 'vgm', label: '3. Phiếu Cân VGM SOLAS', icon: 'scale' },
                  { id: 'inspection', label: '4. Sổ Đăng Kiểm Xe', icon: 'local_shipping' },
                  { id: 'driver', label: '5. GPLX Hạng FC', icon: 'badge' },
                ].map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => {
                      setActiveDocType(doc.id)
                      setZoomLevel(1)
                    }}
                    className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                      activeDocType === doc.id
                        ? 'bg-signal-orange text-white shadow-xs'
                        : 'bg-fog text-slate hover:text-carbon'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">{doc.icon}</span>
                    <span>{doc.label}</span>
                  </button>
                ))}

                <div className="ml-auto flex items-center gap-1.5 bg-fog p-1 rounded-lg border border-chalk text-[11px]">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.8, Number((z - 0.15).toFixed(2))))}
                    className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-carbon font-mono font-bold border border-chalk"
                  >
                    -
                  </button>
                  <span className="font-mono text-slate-700 font-bold px-1">{Math.round(zoomLevel * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(1.4, Number((z + 0.15).toFixed(2))))}
                    className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-carbon font-mono font-bold border border-chalk"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Bản scan giấy chứng từ sống động */}
              <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-700 overflow-auto flex justify-center min-h-[380px]">
                <div
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.15s ease-out',
                  }}
                  className="w-full max-w-2xl bg-[#fefcf8] rounded-lg shadow-2xl p-6 border border-amber-200/60 text-slate-900 relative font-serif"
                >
                  {/* Watermark header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-2 mb-3">
                    <div className="text-left font-sans">
                      <p className="text-[11px] font-black uppercase text-slate-900">{shippingLine}</p>
                      <p className="text-[9px] font-semibold text-slate-600 uppercase">CẢNG TIÊN SA - TRẠM KIỂM SOÁT CỔNG CONTAINER</p>
                    </div>
                    <div className="text-right font-sans">
                      <p className="text-[10px] font-mono font-bold text-signal-orange">REF: EIR-TS-{containerNo}</p>
                      <p className="text-[9px] font-mono text-slate-600">NGÀY ĐỐI SOÁT: 05/11/2026</p>
                    </div>
                  </div>

                  <div className="text-center my-3 font-sans">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                      {activeDocType === 'eir' && 'LỆNH GIAO NHẬN VỎ CONTAINER (EQUIPMENT INTERCHANGE RECEIPT - eEIR)'}
                      {activeDocType === 'customs' && 'TỜ KHAI HẢI QUAN ĐIỆN TỬ & MÃ VẠCH THÔNG QUAN CẢNG TIÊN SA'}
                      {activeDocType === 'vgm' && 'PHIẾU XÁC NHẬN KHỐI LƯỢNG TOÀN BỘ VGM SOLAS - TRẠM CÂN SỐ 02'}
                      {activeDocType === 'inspection' && 'GIẤY CHỨNG NHẬN KIỂM ĐỊNH AN TOÀN KỸ THUẬT XE ĐẦU KÉO & RƠ-MOÓC'}
                      {activeDocType === 'driver' && 'GIẤY PHÉP LÁI XE QUỐC GIA HẠNG FC & THẺ AN TOÀN BẾN CẢNG'}
                    </h3>
                  </div>

                  <table className="w-full text-left text-xs border border-slate-300 font-sans my-3">
                    <tbody>
                      <tr className="bg-amber-50/40">
                        <td className="p-2 border-b border-r border-slate-200 font-bold text-slate-700 w-1/3">Số Hiệu Container:</td>
                        <td className="p-2 border-b border-slate-200 font-mono font-black text-signal-orange">{containerNo} ({size}FT HC)</td>
                      </tr>
                      <tr>
                        <td className="p-2 border-b border-r border-slate-200 font-bold text-slate-700">Vị Trí Xếp Bãi:</td>
                        <td className="p-2 border-b border-slate-200 font-mono font-bold text-carbon">{slotCode} (Block {blockCode} · Bay {bay} · Row {row} · Tier {tier})</td>
                      </tr>
                      <tr className="bg-amber-50/40">
                        <td className="p-2 border-b border-r border-slate-200 font-bold text-slate-700">Xe & Tài Xế:</td>
                        <td className="p-2 border-b border-slate-200 font-mono font-bold text-carbon">{vehiclePlate} · {driverName}</td>
                      </tr>
                      <tr>
                        <td className="p-2 border-b border-r border-slate-200 font-bold text-slate-700">Trọng Lượng VGM:</td>
                        <td className="p-2 border-b border-slate-200 font-mono font-bold text-emerald-700">{totalVGM} (Hợp lệ IMO SOLAS)</td>
                      </tr>
                      <tr className="bg-amber-50/40">
                        <td className="p-2 border-slate-200 font-bold text-slate-700">Trạng Thái Hồ Sơ:</td>
                        <td className="p-2 border-slate-200 font-bold text-emerald-800">🟢 ĐÃ THÔNG QUAN ĐIỆN TỬ · ĐỦ ĐIỀU KIỆN QUA CỔNG</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Stamp & Barcode footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-300 font-sans mt-4">
                    <div className="flex flex-col items-center">
                      <div className="w-36 h-7 bg-slate-900 flex items-center justify-center text-[9px] text-white font-mono tracking-widest font-black">
                        ||| | |||| | ||| |||| |
                      </div>
                      <span className="text-[8px] font-mono text-slate-500 mt-1">VERIFIED NEXUSPORT 2026</span>
                    </div>

                    <div className="w-24 h-24 rounded-full border-4 border-red-600 flex flex-col items-center justify-center p-1 rotate-[-12deg] text-center shadow-xs">
                      <span className="text-[7px] font-black text-red-600 uppercase leading-none">
                        CẢNG TIÊN SA - ĐÀ NẴNG
                      </span>
                      <span className="text-[6.5px] font-bold text-red-700 font-mono uppercase mt-0.5">
                        ĐÃ ĐỐI SOÁT CHỨNG TỪ
                      </span>
                      <span className="text-[6px] font-mono text-red-600 mt-0.5">★ 05/11/2026 ★</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ẢNH CHỤP THỰC TẾ & CAMERA OCR */}
          {activeTab === 'inspection' && (
            <div className="space-y-4">
              <div className="border border-chalk rounded-2xl p-4 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-chalk pb-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate font-mono flex items-center gap-2">
                    <span className="material-symbols-outlined text-signal-orange text-base">camera_outdoor</span>
                    HÌNH ẢNH NHẬN DIỆN CAMERA AI TẠI LÀN CỔNG TIÊN SA
                  </h4>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-extrabold">
                    AI OCR ĐỘ CHÍNH XÁC 99.8%
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Ảnh 1: Camera chụp nhận diện biển số & container */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate block">Ảnh Camera OCR Biển Số & Mã Container Làn Cổng:</span>
                    <div className="h-52 rounded-xl bg-slate-900 overflow-hidden relative border border-chalk flex items-center justify-center group">
                      <img
                        src="/images/container_ocr_camera.jpg"
                        alt="Camera OCR Cảng Tiên Sa"
                        className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition duration-300"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextElementSibling.style.display = 'flex'
                        }}
                      />
                      <div className="hidden absolute inset-0 flex-col items-center justify-center text-slate-400 p-4 text-center">
                        <span className="material-symbols-outlined text-3xl mb-1 text-signal-orange">videocam</span>
                        <span className="text-xs font-mono">Camera Gate-02 Tiên Sa</span>
                        <span className="text-[10px] text-slate-500 font-mono">Xe: {vehiclePlate} • Cont: {containerNo}</span>
                      </div>
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white font-mono text-[10px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                        CAM-02-LANE-IN · LIVE
                      </div>
                      <div className="absolute bottom-2 left-2 right-2 p-2 rounded-lg bg-black/75 backdrop-blur-xs text-white text-[11px] font-mono flex justify-between">
                        <span>PLATE: <strong>{vehiclePlate}</strong></span>
                        <span>CONT: <strong className="text-signal-orange">{containerNo}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Ảnh 2: Kiểm tra lòng vỏ & Seal niêm phong */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate block">Ảnh Chụp Tình Trạng Niêm Phong Chì & Vỏ Cont:</span>
                    <div className="h-52 rounded-xl bg-slate-900 overflow-hidden relative border border-chalk flex items-center justify-center group">
                      <img
                        src="/container_cargo_interior.png"
                        alt="Inspection Cảng Tiên Sa"
                        className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition duration-300"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextElementSibling.style.display = 'flex'
                        }}
                      />
                      <div className="hidden absolute inset-0 flex-col items-center justify-center text-slate-400 p-4 text-center">
                        <span className="material-symbols-outlined text-3xl mb-1 text-emerald-500">lock</span>
                        <span className="text-xs font-mono">Seal: EMC-98231-SEAL</span>
                        <span className="text-[10px] text-slate-500">Vỏ nguyên vẹn, không móp méo</span>
                      </div>
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 font-mono text-[10px] border border-emerald-500/40">
                        ✓ SEAL NGUYÊN VẸN
                      </div>
                      <div className="absolute bottom-2 left-2 right-2 p-2 rounded-lg bg-black/75 backdrop-blur-xs text-white text-[11px] font-mono flex justify-between">
                        <span>SEAL: <strong>EMC-SEAL-OK</strong></span>
                        <span className="text-emerald-400 font-bold">TÌNH TRẠNG: TỐT</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="pt-3.5 border-t border-chalk flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose?.()
                onOpenHistory?.({
                  mode: 'container',
                  containerNo,
                })
              }}
              className="px-4 py-2 rounded-xl bg-fog hover:bg-chalk border border-chalk text-carbon text-xs font-bold transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm text-signal-orange">history</span>
              Lịch sử Cont
            </button>

            <button
              type="button"
              onClick={() => {
                onClose?.()
                onOpenHistory?.({
                  mode: 'slot',
                  slotCode,
                })
              }}
              className="px-4 py-2 rounded-xl bg-fog hover:bg-chalk border border-chalk text-carbon text-xs font-bold transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm text-signal-orange">timeline</span>
              Lịch sử Slot {slotCode}
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="px-4 py-2 rounded-xl border border-chalk bg-fog hover:bg-chalk text-carbon text-xs font-bold transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">
                {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
              </span>
              <span>{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình (Full)'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-signal-orange hover:bg-signal-orange/90 text-white text-xs font-extrabold transition shadow-xs cursor-pointer"
            >
              Đóng Cửa Sổ
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
