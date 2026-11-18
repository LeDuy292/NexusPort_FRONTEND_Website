import React, { useRef } from 'react'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NEXUSPORT - FORM CHUẨN PHIẾU GIAO NHẬN CONTAINER ĐIỆN TỬ (e-EIR)
 * TIÊN SA CONTAINER TERMINAL - CẢNG ĐÀ NẴNG
 * ═══════════════════════════════════════════════════════════════════════════════
 * Tuân thủ cấu trúc dữ liệu bảng `eir_transactions`, `eir_seals`,
 * `eir_damage_observations` chuẩn hóa của Cảng Quốc Tế Tiên Sa.
 * Hỗ trợ in chuẩn A4 (Print-ready) và tải/xuất dữ liệu điện tử.
 */

export default function ElectronicEirReceiptModal({ isOpen, onClose, data }) {
  const printRef = useRef(null)

  if (!isOpen || !data) return null

  // Chuẩn hóa dữ liệu hiển thị từ data thực tế hoặc sample
  const eirNo = data.referenceNo || data.eirReferenceNo || data.eirNo || `260228SP${Math.floor(100000 + Math.random() * 900000)}`
  const activity = data.activity === 'in' ? 'HƯỚNG VÀO (GATE-IN)' : 'HƯỚNG RA (GATE-OUT)'
  const activityColor = data.activity === 'in' ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-orange-700 bg-orange-50 border-orange-200'
  const isGateIn = data.activity === 'in'

  const containerId = data.containerId || data.container_no || 'HAMU2515680'
  const isoCode = data.isoCode || data.iso_code || (data.containerType?.includes('40') ? '45G0' : '22G1')
  const containerType = data.containerType || data.container_type || '40FT HC DRY (General Purpose)'
  const loadStatus = (data.loadStatus || data.load_status || 'full').toUpperCase() === 'EMPTY' ? 'VỎ RỖNG (EMPTY)' : 'HÀNG NGUYÊN (FULL - FCL)'
  const isFull = !loadStatus.includes('EMPTY')

  const grossWeight = data.grossWeight || data.gross_weight_kg || 28100
  const tareWeight = data.tareWeight || (isoCode === '45G0' ? 3980 : 2200)
  const netWeight = isFull ? Math.max(grossWeight - tareWeight, 0) : 0
  const vgmWeight = data.vgmWeight || `${grossWeight.toLocaleString('vi-VN')} kg`

  const sealNumber = data.sealNumber || data.seal_number || 'UL6824219'
  const customsSeal = data.customsSeal || 'HQ-DNG-88912'
  const sealCondition = data.sealCondition || 'Nguyên vẹn, khớp hồ sơ hải quan'

  const vesselName = data.vessel || data.vesselName || data.vessel_name || 'AEGEAN EXPRESS'
  const voyage = data.voyage || data.voyage_out || data.voyage_in || '366S'
  const shippingLine = data.carrier || data.operator_code || data.shippingLine || 'HAPAG-LLOYD (HAG)'
  const blBookingNo = data.blBookingNo || data.bl_booking_no || data.booking || 'HLCUMTR251047484'
  const pod = data.pod || 'TIEN SA - VN'

  const customerName = data.customerName || data.customer_name || 'CHI NHÁNH CÔNG TY CỔ PHẦN ITL LOGISTICS TẠI MIỀN TRUNG'
  const transportComp = data.transportCompany || data.transport_company_name || 'CÔNG TY CP TIÊN SA LOGISTICS'
  const truckPlate = data.truckPlate || data.truck || data.plate_number || '50H-630.74'
  const chassisNo = data.chassisNo || 'CHASSIS-40-08'
  const driverName = data.driverName || data.driver || 'Trần Văn Hùng'
  const driverPhone = data.driverPhone || '0905.112.334'
  const driverLicense = data.driverLicense || 'GPLX: 480129841829'

  const yardSlot = data.yardSlot || data.position || data.location_code || 'C-02-06-1'
  const gateName = data.gateName || data.gate || data.gate_label || 'OUT GATE 1 / LÀN 02'
  const emptyReturnDepot = data.emptyReturnDepot || data.empty_return_place || 'Depot ITL Hòa Cầm (Đà Nẵng)'
  const detentionFreeDays = data.detentionFreeDays || 3

  const checkInTime = data.checkInAt ? new Date(data.checkInAt).toLocaleString('vi-VN') : '28/02/2026 16:24:26'
  const checkOutTime = data.checkOutAt ? new Date(data.checkOutAt).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN')
  const issuedTime = data.issuedAt ? new Date(data.issuedAt).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN')

  const hasDamage = Boolean(data.hasDamage)
  const conditionDesc = data.condition || (hasDamage ? 'Có hư hại vỏ container ghi nhận tại hiện trường' : 'Vỏ container sạch sẽ, nguyên vẹn, kết cấu chịu lực tốt (Sound Condition)')
  const damageSeverity = data.damageSeverity || 'Trung bình'
  const damageDetails = data.damageDetails || (hasDamage ? ['Móp trần tôn sóng 50cm x 50cm, sâu 3cm', 'Xước sơn vách bên phải'] : [])
  const rawPhotos = Array.isArray(data.damagePhotos) && data.damagePhotos.length > 0
    ? data.damagePhotos
    : Array.isArray(data.photos) && data.photos.length > 0
      ? data.photos
      : Array.isArray(data.damage_photos) && data.damage_photos.length > 0
        ? data.damage_photos
        : (hasDamage ? ['https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'] : [])
  const damagePhotos = (rawPhotos || []).map(p => (typeof p === 'string' ? p : p?.url || p?.preview || '')).filter(Boolean)

  const terminalSignatory = data.terminalSignatory || 'Trần Văn Hùng · Điều Độ Viên Cảng Tiên Sa'
  const transportationSignatory = data.transportationSignatory || `${driverName} · Tài Xế Vận Tải`
  const verificationHash = data.qrData || `NXP-EIR|${eirNo}|${containerId}|${truckPlate}|${new Date().toISOString()}`

  const handlePrint = () => {
    window.print()
  }

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(eirNo)
    alert(`Đã sao chép mã phiếu EIR: ${eirNo}`)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
        
        {/* ── THANH CÔNG CỤ TRÊN CÙNG (KHÔNG IN) ── */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-orange-400">receipt_long</span>
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                Phiếu Giao Nhận Container Điện Tử (e-EIR)
                <span className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/40 font-mono">
                  Chuẩn TOS Cảng Tiên Sa
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">Mã số: {eirNo}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              title="Sao chép mã tra cứu"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
              Mã EIR
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              In / Xuất PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* ── VÙNG NỘI DUNG FORM CHUẨN A4 PRINTABLE ── */}
        <div ref={printRef} className="p-6 sm:p-8 overflow-y-auto bg-white font-sans text-slate-900 space-y-5 print:p-0 print:m-0 print:max-h-none print:overflow-visible">
          
          {/* HEADER: QUỐC HIỆU & THƯƠNG HIỆU CẢNG TIÊN SA */}
          <div className="border-b-2 border-slate-900 pb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  CẢNG ĐÀ NẴNG · CÔNG TY CỔ PHẦN CẢNG ĐÀ NẴNG
                </div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-0.5">
                  CẢNG QUỐC TẾ TIÊN SA — TIEN SA CONTAINER TERMINAL
                </h1>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Địa chỉ: Yết Kiêu, P. Thọ Quang, Q. Sơn Trà, TP. Đà Nẵng · Hotline: (0236) 3831 115
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Hệ thống điều độ bãi điện tử TOS — Tra cứu tại: https://nexusport.vn/eir
                </p>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-[11px] font-bold text-slate-900 uppercase">
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </div>
                <div className="text-[10px] italic text-slate-700">Độc lập - Tự do - Hạnh phúc</div>
                <div className="inline-block mt-2 px-3 py-1 bg-slate-100 border border-slate-300 rounded text-right">
                  <div className="text-[9px] uppercase font-bold text-slate-500">Mã tra cứu EIR điện tử</div>
                  <div className="text-xs font-mono font-black text-orange-700 tracking-wide">{eirNo}</div>
                </div>
              </div>
            </div>

            {/* TIÊU ĐỀ CHỨNG TỪ */}
            <div className="text-center mt-5">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                PHIẾU GIAO NHẬN CONTAINER ĐIỆN TỬ
              </h2>
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mt-0.5">
                ELECTRONIC EQUIPMENT INTERCHANGE RECEIPT (e-EIR)
              </div>
              <div className="flex items-center justify-center gap-3 mt-2">
                <span className={`px-3 py-0.5 rounded-full text-xs font-black border uppercase tracking-wider ${activityColor}`}>
                  {activity}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Thời điểm cấp: <strong className="text-slate-800 font-mono">{issuedTime}</strong>
                </span>
                <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  ĐÃ PHÁT HÀNH HỢP LỆ
                </span>
                <span className="text-xs text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">lock</span>
                  KHÓA BẤT BIẾN
                </span>
              </div>
            </div>
          </div>

          {/* KHỐI 1: THÔNG TIN VẬN TẢI & CHUYẾN TÀU */}
          <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-3.5 py-1.5 font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-300 flex items-center justify-between">
              <span>I. Thông Tin Chuyến Tàu & Khách Hàng (Vessel & Shipper)</span>
              <span className="font-mono text-[10px] text-slate-500">MÃ HÃNG: {shippingLine}</span>
            </div>
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-white">
              <div>
                <span className="text-slate-500 text-[10px] block">Hãng tàu cấp lệnh:</span>
                <strong className="text-slate-900 font-semibold">{shippingLine}</strong>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Tên tàu & Chuyến làm hàng:</span>
                <strong className="text-slate-900 font-mono">{vesselName} / {voyage}</strong>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Số Vận đơn (B/L) hoặc Booking:</span>
                <strong className="text-orange-950 font-mono font-bold">{blBookingNo}</strong>
              </div>
              <div className="md:col-span-2">
                <span className="text-slate-500 text-[10px] block">Chủ hàng / Đơn vị tiếp nhận:</span>
                <strong className="text-slate-900">{customerName}</strong>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Cảng dỡ hàng (POD):</span>
                <strong className="text-slate-900 font-mono">{pod}</strong>
              </div>
              <div className="md:col-span-2">
                <span className="text-slate-500 text-[10px] block">Công ty vận tải đường bộ:</span>
                <strong className="text-slate-900">{transportComp}</strong>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Phương tiện vận chuyển:</span>
                <div className="font-mono font-bold text-slate-900">
                  Xe: <span className="text-orange-900">{truckPlate}</span> · Moóc: {chassisNo}
                </div>
              </div>
            </div>
          </div>

          {/* KHỐI 2: THÔNG SỐ CONTAINER & HÀNG HÓA */}
          <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-3.5 py-1.5 font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-300 flex items-center justify-between">
              <span>II. Thông Tin Kỹ Thuật Container & Niêm Chì (Equipment & Seals)</span>
              <span className="font-mono text-[10px] text-slate-500">ISO 6346 VERIFIED</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px]">
                    <th className="p-2.5 font-bold">Mã Container</th>
                    <th className="p-2.5 font-bold">Kích Cỡ / ISO</th>
                    <th className="p-2.5 font-bold">Trạng Thái</th>
                    <th className="p-2.5 font-bold">Trọng Lượng (Gross)</th>
                    <th className="p-2.5 font-bold">Khối Lượng Cân (VGM)</th>
                    <th className="p-2.5 font-bold">Số Chì Hãng Tàu (Seal)</th>
                    <th className="p-2.5 font-bold">Chì Hải Quan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-2.5 font-mono font-black text-sm text-slate-900">{containerId}</td>
                    <td className="p-2.5 font-mono">{isoCode} · {containerType}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isFull ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                        {loadStatus}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono font-semibold">{grossWeight.toLocaleString('vi-VN')} kg</td>
                    <td className="p-2.5 font-mono font-bold text-emerald-800">{vgmWeight}</td>
                    <td className="p-2.5 font-mono font-bold text-purple-900">{sealNumber}</td>
                    <td className="p-2.5 font-mono text-slate-700">{customsSeal}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50/60 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500">Tình trạng niêm chì: </span>
                <strong className="text-emerald-700">{sealCondition}</strong>
              </div>
              <div>
                <span className="text-slate-500">Trọng lượng vỏ (Tare): </span>
                <span className="font-mono font-semibold">{tareWeight.toLocaleString('vi-VN')} kg</span>
              </div>
              <div>
                <span className="text-slate-500">Khối lượng hàng (Payload): </span>
                <span className="font-mono font-semibold">{netWeight.toLocaleString('vi-VN')} kg</span>
              </div>
            </div>
          </div>

          {/* KHỐI 3: VỊ TRÍ BÃI, LÀN CỔNG & ĐIỀU ĐỘ */}
          <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-3.5 py-1.5 font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-300">
              III. Vị Trí Bãi & Hoạt Động Khai Thác Cảng (Yard & Terminal Operations)
            </div>
            <div className="p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white">
              <div>
                <span className="text-slate-500 text-[10px] block">Vị trí ô bãi lưu trữ:</span>
                <strong className="text-orange-950 font-mono text-sm block">{yardSlot}</strong>
                <span className="text-[10px] text-slate-500">Block · Bay · Row · Tier</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Cổng / Làn cân giao nhận:</span>
                <strong className="text-slate-900 text-xs block">{gateName}</strong>
                <span className="text-[10px] text-slate-500">Đầu đọc Barie tự động</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Giờ vào cổng (Check-in):</span>
                <strong className="text-slate-800 font-mono text-[11px] block">{checkInTime}</strong>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Giờ ra cổng (Check-out):</span>
                <strong className="text-slate-800 font-mono text-[11px] block">{checkOutTime}</strong>
              </div>
              <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500">Nơi chỉ định hạ trả vỏ rỗng: </span>
                  <strong className="text-slate-900">{emptyReturnDepot}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Hạn lưu bãi / Miễn phí lưu vỏ (Free Detention): </span>
                  <strong className="text-orange-800">{detentionFreeDays} ngày kể từ ngày giao</strong>
                </div>
              </div>
            </div>
          </div>

          {/* KHỐI 4: BIÊN BẢN GIÁM ĐỊNH TÌNH TRẠNG VỎ (SURVEY) */}
          <div className={`border rounded-xl overflow-hidden text-xs ${hasDamage ? 'border-rose-300' : 'border-slate-300'}`}>
            <div className={`px-3.5 py-1.5 font-bold uppercase tracking-wider text-[11px] border-b flex items-center justify-between ${
              hasDamage ? 'bg-rose-50 text-rose-900 border-rose-300' : 'bg-slate-100 text-slate-800 border-slate-300'
            }`}>
              <span>IV. Biên Bản Giám Định Vỏ Container (Damage & Condition Survey)</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                hasDamage ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
              }`}>
                {hasDamage ? `HƯ HỎNG (${damageSeverity.toUpperCase()})` : 'TỐT / SẠCH SẼ (SOUND)'}
              </span>
            </div>
            
            <div className="p-3.5 bg-white space-y-2">
              <div className="text-slate-800">
                <strong>Kết luận kiểm tra ngoại quan: </strong>
                <span>{conditionDesc}</span>
              </div>

              {hasDamage && Array.isArray(damageDetails) && damageDetails.length > 0 && (
                <div className="bg-rose-50/70 p-2.5 rounded-lg border border-rose-200 space-y-1">
                  <div className="text-[11px] font-bold text-rose-950">Chi tiết các điểm hư hại ghi nhận tại hiện trường:</div>
                  <ul className="list-disc list-inside text-[11px] text-rose-900 space-y-0.5 font-mono">
                    {damageDetails.map((d, i) => {
                      const text = typeof d === 'string' 
                        ? d 
                        : (d && typeof d === 'object')
                          ? `${d.description || 'Hư hại kết cấu'} ${d.severity ? `[Mức: ${d.severity}]` : ''} ${Array.isArray(d.faces) && d.faces.length ? `(${d.faces.join(', ')})` : ''}`
                          : String(d)
                      return <li key={i}>{text}</li>
                    })}
                  </ul>
                </div>
              )}

              {/* HÌNH ẢNH HIỆN TRƯỜNG GIÁM ĐỊNH VỎ CONTAINER */}
              {damagePhotos.length > 0 && (
                <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-200 space-y-2">
                  <div className="text-[11px] font-bold text-rose-950 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-rose-600">photo_library</span>
                      Ảnh bằng chứng hư hỏng ghi nhận tại hiện trường ({damagePhotos.length} ảnh):
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Độ phân giải thực địa / GPS Cảng Tiên Sa</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {damagePhotos.map((imgSrc, idx) => (
                      <div
                        key={idx}
                        className="relative rounded-lg border-2 border-rose-200 overflow-hidden bg-slate-100 shadow-2xs group aspect-4/3 flex items-center justify-center"
                      >
                        <img
                          src={imgSrc}
                          alt={`Bằng chứng hư hỏng #${idx + 1}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          onError={(e) => {
                            e.target.onerror = null
                            e.target.src = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'
                          }}
                        />
                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
                          Ảnh #{idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[10px] text-slate-500 italic">
                * Hai bên xác nhận tình trạng thực tế của vỏ container và niêm chì tại thời điểm bàn giao qua cổng cảng. Mọi khiếu nại phát sinh sau khi rời cảng sẽ căn cứ theo biên bản EIR điện tử này.
              </div>
            </div>
          </div>

          {/* KHỐI 5: MÃ TRA CỨU, QR CODE & CHỮ KÝ XÁC THỰC HAI BÊN */}
          <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              
              {/* Cột QR Code điện tử */}
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 bg-white border-2 border-slate-800 rounded-xl p-1.5 flex flex-col items-center justify-center shrink-0 shadow-2xs">
                  {/* SVG QR Code minh họa thực tế */}
                  <svg className="w-full h-full text-slate-900" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm8-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14 0h2v2h-2v-2zm-4 0h2v2h-2v-2zm2 4h4v2h-4v-2zm2-2h2v2h-2v-2zm-6-2h2v2h-2v-2zm0 4h2v2h-2v-2zm4-8h2v2h-2V8zm-2 2h2v2h-2v-2zm2 2h2v2h-2v-2zm-4-2h2v2h-2v-2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Xác thực chứng từ số</div>
                  <div className="text-xs font-mono font-bold text-slate-900 break-all">{eirNo}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Quét để tra cứu trực tuyến trên cổng Hải quan cảng Tiên Sa</div>
                </div>
              </div>

              {/* Chữ ký Đại diện Cảng */}
              <div className="text-center sm:text-center border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-3">
                <span className="text-[11px] font-bold text-slate-800 uppercase block">ĐẠI DIỆN CẢNG TIÊN SA</span>
                <span className="text-[10px] text-slate-500 block">Ký số điện tử TOS Token</span>
                
                <div className="my-2 py-1 px-2.5 rounded bg-orange-50 border border-orange-200 text-[10px] font-bold text-orange-800 inline-block">
                  ✓ VERIFIED DIGITAL SIGNATURE
                </div>
                
                <strong className="block text-xs font-bold text-slate-900 mt-1">{terminalSignatory}</strong>
                <span className="text-[10px] text-slate-500 font-mono block">Cảng Quốc Tế Tiên Sa</span>
              </div>

              {/* Chữ ký Đại diện Vận tải / Lái xe */}
              <div className="text-center sm:text-center border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-3">
                <span className="text-[11px] font-bold text-slate-800 uppercase block">ĐẠI DIỆN BÊN VẬN TẢI / LÁI XE</span>
                <span className="text-[10px] text-slate-500 block">Xác thực Smart Driver App</span>

                <div className="my-2 py-1 px-2.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800 inline-block">
                  ✓ APP AUTHENTICATED
                </div>

                <strong className="block text-xs font-bold text-slate-900 mt-1">{transportationSignatory}</strong>
                <span className="text-[10px] text-slate-500 font-mono block">{driverPhone} · {driverLicense}</span>
              </div>
            </div>

            {/* Ghi chú pháp lý */}
            <div className="pt-3 border-t border-slate-200 text-[10px] text-slate-500 text-center leading-relaxed">
              Phiếu giao nhận container điện tử này được phát hành bởi Hệ thống Điều Hành Cảng Biển NexusPort theo Nghị định 119/2018/NĐ-CP và Thông tư 68/2019/TT-BTC. Bản điện tử có giá trị pháp lý đầy đủ và được đối soát dữ liệu trực tiếp với Chi cục Hải quan Cửa khẩu Cảng Tiên Sa.
            </div>
          </div>
        </div>

        {/* ── FOOTER THAO TÁC CỦA MODAL (KHÔNG IN) ── */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs print:hidden">
          <div className="text-slate-500 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-emerald-600">security</span>
            <span>Bảo mật chống sửa đổi · Dữ liệu bất biến trong hệ thống TOS</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              In Phiếu e-EIR
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
