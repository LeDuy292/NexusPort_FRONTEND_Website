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
            <div className="w-[880px] max-w-[94vw] bg-white text-slate-900 rounded-2xl p-5 md:p-7 shadow-2xl border-2 border-slate-800 font-sans text-xs space-y-3.5 print:border-black">
              {/* Header của B/L Chuẩn Hàng Hải */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-900 pb-3 gap-2">
                <div>
                  <div className="font-heading font-black text-base tracking-widest text-slate-900 uppercase flex items-center gap-2">
                    <span className="material-symbols-outlined text-signal-orange text-lg">directions_boat</span>
                    <span>{isBL ? (booking.shippingLine || 'EVERGREEN MARINE CORP. / OCEAN NETWORK EXPRESS') : isEDO ? 'CẢNG TIÊN SA - ĐÀ NẴNG (PORT OF TIEN SA)' : 'TỔNG CỤC HẢI QUAN VIỆT NAM — CỤC HQ ĐÀ NẴNG'}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono tracking-wider uppercase mt-0.5">
                    {isBL && 'STANDARD OCEAN BILL OF LADING — NON-NEGOTIABLE COPY'}
                    {isEDO && 'ELECTRONIC DELIVERY ORDER (LỆNH GIAO HÀNG ĐIỆN TỬ eDO)'}
                    {isCustoms && 'CHI CỤC HẢI QUAN CỬA KHẨU CẢNG ĐÀ NẴNG — HỆ THỐNG VNACCS/VCIS'}
                  </div>
                </div>

                <div className="text-left sm:text-right font-mono">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Số Hiệu Chứng Từ:</div>
                  <div className="font-mono font-black text-sm text-blue-900">
                    {currentDoc.documentNumber || currentDoc.code || (isBL ? (booking.blNumber || 'EMCU-DAD-2026-8891') : isEDO ? 'EDO-2026-990184' : '105829104820')}
                  </div>
                  <div className="text-[9px] text-slate-500">
                    Ngày cấp: {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString('vi-VN') : '2026-11-10'}
                  </div>
                </div>
              </div>

              {/* Form B/L Hàng Hải Chuẩn Quốc Tế */}
              {isBL ? (
                <div className="space-y-3">
                  {/* Grid 2 Cột Chuẩn B/L */}
                  <div className="grid grid-cols-1 md:grid-cols-2 border border-slate-300 rounded-xl overflow-hidden font-mono text-[11px]">
                    {/* Cột Trái: Shipper, Consignee, Notify Party */}
                    <div className="divide-y divide-slate-300 border-r border-slate-300">
                      <div className="p-2.5 bg-slate-50/60">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">1. SHIPPER / EXPORTER (Người gửi hàng)</span>
                        <strong className="text-slate-900 font-bold block">{booking.shipper || 'GLOBAL TRADING & AGRI-SEAFOOD CORP.'}</strong>
                        <span className="text-[10px] text-slate-500">Industrial Zone, Port of Loading • Ref: EXP-8892</span>
                      </div>
                      <div className="p-2.5 bg-white">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">2. CONSIGNEE (Người nhận hàng)</span>
                        <strong className="text-slate-900 font-bold block">{booking.consignee || companyName}</strong>
                        <span className="text-[10px] text-slate-500">Tien Sa Port Logistics, Da Nang • Tax: 0401889212</span>
                      </div>
                      <div className="p-2.5 bg-slate-50/60">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">3. NOTIFY PARTY (Bên thông báo)</span>
                        <span className="font-semibold text-slate-800 block">TIEN SA LOGISTICS & DISPATCH CENTER</span>
                        <span className="text-[10px] text-slate-500">Tel: 0905 123 456 • dispatch@nexusport.vn</span>
                      </div>
                    </div>

                    {/* Cột Phải: Vessel, Port, Freight */}
                    <div className="divide-y divide-slate-300">
                      <div className="p-2.5 bg-white grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">VESSEL / VOYAGE</span>
                          <strong className="text-slate-900 block truncate">{booking.vesselName || 'EVER GLORY'} / {booking.voyageNumber || 'EG-2605W'}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">BOOKING NO.</span>
                          <strong className="text-slate-900 font-mono block">{bookingCode}</strong>
                        </div>
                      </div>

                      <div className="p-2.5 bg-slate-50/60 grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">PORT OF LOADING (Cảng bốc)</span>
                          <span className="font-bold text-slate-800 block truncate">{booking.pol || 'SHANGHAI PORT (CNSHA)'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">PORT OF DISCHARGE (Cảng dỡ)</span>
                          <span className="font-bold text-slate-800 block truncate">TIEN SA PORT, DA NANG (VNDAD)</span>
                        </div>
                      </div>

                      <div className="p-2.5 bg-white grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">PLACE OF DELIVERY</span>
                          <span className="font-bold text-slate-800 block">TIEN SA CONTAINER TERMINAL</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">FREIGHT PAYMENT</span>
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block text-[10px]">FREIGHT PREPAID</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bảng Chi Tiết Container Của Vận Đơn */}
                  <div className="border border-slate-300 rounded-xl overflow-hidden font-mono text-[11px]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] border-b border-slate-300">
                          <th className="py-2 px-3">Container No. &amp; Seal No.</th>
                          <th className="py-2 px-3">Loại Cont</th>
                          <th className="py-2 px-3">Mô Tả Hàng Hóa</th>
                          <th className="py-2 px-3 text-right">Trọng Lượng (KGS)</th>
                          <th className="py-2 px-3 text-right">Thể Tích (CBM)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        <tr>
                          <td className="py-2 px-3 font-extrabold text-blue-900">
                            <div>{containerNo}</div>
                            <div className="text-[10px] text-slate-500 font-normal">Seal: <span className="font-bold text-blue-700">{booking.sealNumber || 'SL-88412'}</span></div>
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-bold text-[10px]">
                              {booking.containerType || '40HC'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-800">
                            <div>{booking.cargoDescription || 'Hàng đông lạnh / Thiết bị điện tử tiêu chuẩn'}</div>
                            {booking.tempRequired && (
                              <div className="text-[10px] text-cyan-700 font-bold">Nhiệt độ cài đặt: {booking.tempRequired}</div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {Number(booking.grossWeightKg || 24000).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">
                            {Number(booking.cbm || 55).toFixed(1)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Footer của Form B/L */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-300 grid grid-cols-1 sm:grid-cols-3 gap-2 items-center text-[10px] font-mono">
                    <div>
                      <span className="text-slate-400 block uppercase font-bold text-[9px]">PLACE &amp; DATE OF ISSUE</span>
                      <strong className="text-slate-900">TIEN SA PORT, DA NANG • 2026-11-10</strong>
                    </div>
                    <div className="text-center">
                      <span className="px-2.5 py-1 rounded border-2 border-emerald-600 text-emerald-800 bg-emerald-50 font-black uppercase text-[10px] inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">verified</span>
                        <span>VẬN ĐƠN GỐC HỢP LỆ</span>
                      </span>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="text-slate-400 block uppercase font-bold text-[9px]">SIGNED AS CARRIER / AGENT</span>
                      <strong className="text-slate-900">{booking.shippingLine || 'EVERGREEN LINE (AGENT)'}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                /* Giao diện cho eDO hoặc Hải Quan */
                <div className="space-y-3 font-mono">
                  {/* Banner */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    isEDO ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}>
                    <div>
                      <h4 className="font-heading font-extrabold text-sm uppercase">
                        {isEDO ? 'LỆNH GIAO HÀNG ĐIỆN TỬ (ELECTRONIC DELIVERY ORDER - eDO)' : 'TỜ KHAI HẢI QUAN ĐIỆN TỬ THÔNG QUAN NHẬP KHẨU'}
                      </h4>
                      <p className="text-[10px] opacity-80">Phục vụ kiểm soát cổng điện tử &amp; hạ bãi tại Cảng Tiên Sa Đà Nẵng</p>
                    </div>
                    <div className="text-center font-mono font-black text-xs px-2.5 py-1 bg-white rounded-lg border shadow-2xs">
                      {isEDO ? 'eDO: ĐÃ DUYỆT' : 'LUỒNG XANH: ĐÃ THÔNG QUAN'}
                    </div>
                  </div>

                  {/* Grid thông tin eDO/HQ */}
                  <div className="grid grid-cols-2 gap-3 text-[11px] bg-slate-50 p-4 rounded-xl border border-slate-200">
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
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Phương tiện &amp; Tài xế:</span>
                      <span className="text-slate-800 font-semibold">{licensePlate} • {driverName}</span>
                    </div>
                  </div>

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
                    </div>
                  )}

                  {isCustoms && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-[10px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold">Chi cục Hải quan đăng ký:</span>
                        <span className="font-mono text-slate-800">HQ CỬA KHẨU CẢNG ĐÀ NẴNG (MÃ: 04C1)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold">Trạng thái tờ khai VNACCS:</span>
                        <span className="font-mono font-bold text-emerald-600">ĐÃ THÔNG QUAN — ĐỦ ĐIỀU KIỆN QUA KHU VỰC GIÁM SÁT</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
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

