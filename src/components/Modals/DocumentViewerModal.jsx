import React, { useState, useEffect } from 'react'

/**
 * DocumentViewerModal: Modal xem chi tiết và phóng to hình ảnh chứng từ
 * Phục vụ nghiệp vụ Nhập khẩu (Vận đơn B/L, Lệnh eDO, Tờ khai Hải quan nhập)
 */
export default function DocumentViewerModal({
  isOpen,
  onClose,
  documents = [],
  initialIndex = 0,
  booking = {}
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    setCurrentIndex(initialIndex)
    setZoomLevel(1)
    setRotation(0)
  }, [initialIndex, isOpen])

  if (!isOpen || !documents || documents.length === 0) return null

  const currentDoc = documents[currentIndex] || documents[0]

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))
  const handleResetZoom = () => {
    setZoomLevel(1)
    setRotation(0)
  }
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setZoomLevel(1)
      setRotation(0)
    }
  }

  const handleNext = () => {
    if (currentIndex < documents.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setZoomLevel(1)
      setRotation(0)
    }
  }

  // Phân loại tài liệu
  const isBL = currentDoc.type === 'BillOfLading' || String(currentDoc.title || '').toLowerCase().includes('vận đơn') || String(currentDoc.title || '').toLowerCase().includes('b/l')
  const isEDO = currentDoc.type === 'DeliveryOrder' || String(currentDoc.title || '').toLowerCase().includes('edo') || String(currentDoc.title || '').toLowerCase().includes('lệnh giao hàng')
  const isCustoms = currentDoc.type === 'CustomsDeclaration' || String(currentDoc.title || '').toLowerCase().includes('hải quan')

  const containerNo = booking.containerId || booking.containerNumbers?.[0] || 'TCLU9876543'
  const bookingCode = booking.id || booking.bookingCode || 'BK-2026-NXP'
  const licensePlate = booking.licensePlate || booking.vehiclePlate || '43C-123.45'
  const companyName = booking.company || booking.carrierName || 'CÔNG TY TNHH VẬN TẢI QUỐC TẾ NEXUSPORT'
  const driverName = booking.driverName || 'Nguyễn Văn A'

  return (
    <div className="fixed inset-0 bg-carbon/90 backdrop-blur-md z-[100] flex flex-col justify-between p-2 md:p-6 select-none animate-in fade-in duration-200">
      {/* Top Bar Header */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xl text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-400 flex items-center justify-center font-bold text-lg">
            <span className="material-symbols-outlined">{currentDoc.icon || 'description'}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-black text-sm md:text-base text-white tracking-wide">
                {currentDoc.title || 'Chứng Từ Nghiệp Vụ Nhập Khẩu'}
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                ✓ HỢP LỆ / ĐÃ THẨM ĐỊNH
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Số hiệu: <span className="text-amber-400 font-bold">{currentDoc.documentNumber || currentDoc.code || 'DOC-2026-NXP-01'}</span>
              <span className="mx-2">•</span>
              Nghiệp vụ: <span className="text-blue-300 font-bold">Hàng Nhập Khẩu (Import Cargo)</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Zoom controls */}
          <div className="bg-slate-800/80 rounded-xl p-1 flex items-center border border-slate-700/80">
            <button
              onClick={handleZoomOut}
              title="Thu nhỏ"
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">zoom_out</span>
            </button>
            <span className="px-2 font-mono text-xs text-slate-300 font-bold min-w-[48px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              title="Phóng to"
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">zoom_in</span>
            </button>
            <button
              onClick={handleResetZoom}
              title="Đặt lại kích thước"
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition cursor-pointer ml-1"
            >
              <span className="material-symbols-outlined text-sm">restart_alt</span>
            </button>
            <button
              onClick={handleRotate}
              title="Xoay hình ảnh 90 độ"
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">rotate_right</span>
            </button>
          </div>

          {/* Document Switcher */}
          {documents.length > 1 && (
            <div className="flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700/80">
              <button
                disabled={currentIndex === 0}
                onClick={handlePrev}
                title="Chứng từ trước"
                className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <span className="px-2 text-xs font-mono font-bold text-amber-400">
                {currentIndex + 1} / {documents.length}
              </span>
              <button
                disabled={currentIndex === documents.length - 1}
                onClick={handleNext}
                title="Chứng từ tiếp theo"
                className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-red-600/80 hover:bg-red-600 text-white flex items-center justify-center transition cursor-pointer ml-1"
            title="Đóng cửa sổ xem ảnh (Esc)"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      </div>

      {/* Main Image / Document Display Area */}
      <div className="flex-1 my-3 relative overflow-hidden flex items-center justify-center rounded-2xl bg-slate-950/80 border border-slate-800/60 p-4">
        <div
          className="transition-transform duration-200 ease-out origin-center max-h-full max-w-full flex items-center justify-center"
          style={{
            transform: `scale(${zoomLevel}) rotate(${rotation}deg)`
          }}
        >
          {currentDoc.fileUrl || currentDoc.fileReference ? (
            <img
              src={currentDoc.fileUrl || currentDoc.fileReference}
              alt={currentDoc.title}
              className="max-h-[75vh] max-w-[85vw] object-contain rounded-xl shadow-2xl border border-slate-700/50 bg-white"
            />
          ) : (
            /* Render high-fidelity SVG/Vector Document View if no external image URL */
            <div className="w-[840px] max-w-[94vw] bg-white text-slate-900 rounded-2xl p-6 md:p-8 shadow-2xl border border-slate-200 font-sans text-xs space-y-4">
              {/* Header of Simulated Document */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3">
                <div>
                  <div className="font-heading font-black text-sm tracking-widest text-slate-900 uppercase">
                    {isBL && 'HAPAG-LLOYD / ONE OCEAN CONTAINER LINE'}
                    {isEDO && 'CẢNG TIÊN SA - ĐÀ NẴNG (PORT OF TIEN SA)'}
                    {isCustoms && 'TỔNG CỤC HẢI QUAN VIỆT NAM — CỤC HQ ĐÀ NẴNG'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {isBL && 'NON-NEGOTIABLE SEAWAY BILL / OCEAN BILL OF LADING'}
                    {isEDO && 'ELECTRONIC DELIVERY ORDER (LỆNH GIAO HÀNG ĐIỆN TỬ eDO)'}
                    {isCustoms && 'CHI CỤC HẢI QUAN CỬA KHẨU CẢNG ĐÀ NẴNG — HỆ THỐNG VNACCS/VCIS'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-black text-xs text-blue-800">
                    {currentDoc.documentNumber || currentDoc.code || (isBL ? 'HLCU-DAN-2026-8891' : isEDO ? 'EDO-2026-990184' : '105829104820')}
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono">
                    Ngày phát hành: {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString('vi-VN') : '29/10/2026'}
                  </div>
                </div>
              </div>

              {/* Document Banner */}
              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                isBL ? 'bg-blue-50 border-blue-200 text-blue-900' :
                isEDO ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div>
                  <h4 className="font-heading font-extrabold text-sm uppercase">
                    {isBL && 'VẬN ĐƠN ĐƯỜNG BIỂN CHÍNH THỨC (BILL OF LADING - B/L)'}
                    {isEDO && 'LỆNH GIAO HÀNG ĐIỆN TỬ (ELECTRONIC DELIVERY ORDER - eDO)'}
                    {isCustoms && 'TỜ KHAI HẢI QUAN ĐIỆN TỬ THÔNG QUAN NHẬP KHẨU'}
                  </h4>
                  <p className="text-[10px] opacity-80">
                    Phục vụ kiểm soát cổng điện tử & hạ bãi tại Cảng Tiên Sa Đà Nẵng
                  </p>
                </div>
                <div className="text-center font-mono font-black text-xs px-2.5 py-1 bg-white rounded-lg border shadow-2xs">
                  {isBL && 'B/L: GỐC HỢP LỆ'}
                  {isEDO && 'eDO: ĐÃ DUYỆT'}
                  {isCustoms && 'LUỒNG XANH: ĐÃ THÔNG QUAN'}
                </div>
              </div>

              {/* Grid Information */}
              <div className="grid grid-cols-2 gap-3 text-[11px] font-mono bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Mã Số Booking Cảng:</span>
                  <strong className="text-slate-900 font-extrabold">{bookingCode}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Số Hiệu Container:</span>
                  <strong className="text-signal-orange font-black text-xs">{containerNo}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Chủ hàng / Đơn vị vận tải:</span>
                  <span className="text-slate-800 font-semibold">{companyName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Phương tiện & Tài xế:</span>
                  <span className="text-slate-800 font-semibold">{licensePlate} • {driverName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Cảng Dỡ Hàng (Port of Discharge):</span>
                  <span className="text-slate-800 font-bold">TIEN SA PORT, DA NANG (VNDAD)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Loại Container & Tác nghiệp:</span>
                  <span className="text-slate-800 font-bold">40HC • Nhập khẩu (Gate Out / Pickup)</span>
                </div>
              </div>

              {/* Specific Content per Document Type */}
              {isBL && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-[10px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Tàu vận chuyển (Vessel/Voyage):</span>
                    <span className="font-mono font-bold text-slate-800">EVER GIVEN / VOY 0244W</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Cảng bốc hàng (Port of Loading):</span>
                    <span className="font-mono text-slate-800">SHANGHAI, CHINA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Số chì niêm phong (Seal No):</span>
                    <span className="font-mono font-bold text-blue-700">SEAL-VN-998811</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Khối lượng toàn bộ (Gross Weight):</span>
                    <span className="font-mono font-bold text-slate-800">28,100 KG</span>
                  </div>
                </div>
              )}

              {isEDO && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-[10px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Hạn lệnh giao hàng (eDO Expiry):</span>
                    <span className="font-mono font-bold text-emerald-700">31/12/2026 23:59 (Còn hiệu lực)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Nơi hạ vỏ rỗng sau khi dỡ:</span>
                    <span className="font-mono text-slate-800">Depot Tiên Sa / ICD Hòa Cầm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Cược vỏ container / Phí lưu bãi:</span>
                    <span className="font-mono font-bold text-slate-800">Đã thanh toán (Paid)</span>
                  </div>
                </div>
              )}

              {isCustoms && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-[10px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Chi cục Hải quan đăng ký:</span>
                    <span className="font-mono font-bold text-slate-800">HQ CỬA KHẨU CẢNG ĐÀ NẴNG (MÃ: 04C1)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Trạng thái tờ khai VNACCS:</span>
                    <span className="font-mono font-bold text-emerald-600">ĐÃ THÔNG QUAN — ĐỦ ĐIỀU KIỆN QUA KHU VỰC GIÁM SÁT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Nghĩa vụ thuế nhập khẩu:</span>
                    <span className="font-mono font-bold text-slate-800">Đã nộp thuế đầy đủ qua Cổng DVC Hải quan</span>
                  </div>
                </div>
              )}

              {/* Digital Stamps & Signatures Footer */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-base">verified</span>
                  </div>
                  <div>
                    <span className="font-bold block text-slate-800">CHỨNG TỰ ĐIỆN TỬ HỢP LỆ</span>
                    <span className="text-[9px] text-slate-400 font-mono">Xác thực bởi NexusPort Smart Gate</span>
                  </div>
                </div>

                <div className="px-3 py-1 rounded-lg border-2 border-red-600 text-red-600 font-black font-mono text-[10px] uppercase rotate-[-2deg] tracking-widest shadow-2xs">
                  {isCustoms ? '★ ĐÃ THÔNG QUAN ★' : isEDO ? '★ CHO PHÉP NHẬN HÀNG ★' : '★ VẬN ĐƠN GỐC HỢP LỆ ★'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Thumbnails Strip */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between gap-3 text-white shadow-2xl">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Danh mục chứng từ nhập khẩu:
          </span>
          {documents.map((doc, idx) => {
            const active = idx === currentIndex
            return (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx)
                  setZoomLevel(1)
                  setRotation(0)
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 border ${
                  active
                    ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{doc.icon || 'description'}</span>
                <span>{doc.shortTitle || doc.title}</span>
                {doc.mandatory && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                )}
              </button>
            )
          })}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Ấn <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">ESC</kbd> để thoát
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

