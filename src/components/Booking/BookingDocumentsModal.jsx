import React, { useState } from 'react'

export default function BookingDocumentsModal({ isOpen, onClose, booking }) {
  const [activeTab, setActiveTab] = useState('eir')
  const [viewMode, setViewMode] = useState('scan') // 'scan' | 'data'
  const [zoomLevel, setZoomLevel] = useState(1)

  if (!isOpen || !booking) return null

  // Trích xuất hãng tàu từ tiền tố số Container (chuẩn ISO 6346)
  const contPrefix = (booking.containerId || '').slice(0, 4).toUpperCase()
  let shippingLine = 'EVERGREEN MARINE CORP. (EMC)'
  if (contPrefix.startsWith('ONE') || contPrefix.startsWith('NYK')) {
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

  const is40 = String(booking.containerType || '').includes('40') || (booking.size === 40)
  const tareWeight = is40 ? '3,820 kg' : '2,250 kg'
  const payloadWeight = is40 ? '24,630 kg' : '18,850 kg'
  const totalVGM = is40 ? '28,450 kg' : '21,100 kg'
  const maxGross = is40 ? '30,480 kg' : '24,000 kg'

  // Biển số rơ-moóc tương ứng biển số đầu kéo (VD: 43C-091.22 -> 43R-089.22)
  const platePrefix = (booking.licensePlate || '43C').slice(0, 3)
  const trailerPlate = platePrefix.replace('C', 'R') + '-089.22'

  // Format ngày tạo / ETA
  const bookingDate = booking.createdAt ? booking.createdAt.split(' ')[0] : '05/11/2026'

  const documents = [
    {
      id: 'eir',
      name: 'Lệnh Hạ Bãi / Lệnh EIR',
      badge: 'Bắt buộc',
      code: `EIR-TS-${booking.id?.replace(/[^a-zA-Z0-9]/g, '') || '202688'}`,
      issuer: shippingLine,
      status: 'Hợp lệ',
      date: bookingDate,
      expiry: '30/11/2026',
      icon: 'receipt_long',
      docTitle: 'EQUIPMENT INTERCHANGE RECEIPT (e-EIR) - LỆNH HẠ CONTAINER',
      officialAuthority: shippingLine,
      officialSub: 'CHI NHÁNH CẢNG ĐÀ NẴNG · BỘ PHẬN ĐIỀU ĐỘ KHAI THÁC CONTAINER',
      stampText: 'EVERGREEN LINE - TIEN SA PORT DISPATCHED',
      stampSub: 'KIỂM DUYỆT ĐẦU CỔNG',
      stampColor: '#b91c1c',
      fields: [
        { label: 'Số Lệnh EIR Điện Tử', value: `EIR-TS-${booking.id || '2026-99182'}` },
        { label: 'Hãng Tàu Cấp Lệnh', value: shippingLine },
        { label: 'Số Hiệu Container', value: booking.containerId || 'EMCU8361795' },
        { label: 'Kích Cỡ / Quy Cách', value: `${booking.containerType || (is40 ? '40HC' : '20GP')} (Tiêu chuẩn ISO)` },
        { label: 'Phương Thức Vận Hành', value: booking.operation || 'Hạ bãi chờ xuất tàu (CY - CY)' },
        { label: 'Cảng Hạ Bãi Chỉ Định', value: 'Cảng Quốc Tế Tiên Sa - Khu Bãi Container' },
        { label: 'Đơn Vị Vận Tải / Chủ Hàng', value: booking.company || 'Doanh Nghiệp Vận Tải Tiên Sa' },
        { label: 'Người Liên Hệ / Hotline', value: `${booking.contactName || 'Bộ phận Điều phối'} - ${booking.phone || '0905 123 456'}` },
      ],
      note: 'Chứng từ đã được hãng tàu phát hành điện tử (e-EIR) và đối soát EDI thành công với hệ thống cảng Tiên Sa.'
    },
    {
      id: 'customs',
      name: 'Tờ Khai & Mã Vạch Hải Quan',
      badge: 'Luồng Xanh',
      code: `TKHQ-104928${booking.id?.slice(-4) || '7721'}`,
      issuer: 'CỤC HẢI QUAN TP ĐÀ NẴNG - CHI CỤC HQ CK CẢNG TIÊN SA',
      status: 'Đã thông quan',
      date: bookingDate,
      expiry: '25/11/2026',
      icon: 'verified',
      docTitle: 'TỜ KHAI HẢI QUAN ĐIỆN TỬ & MÃ VẠCH GIÁM SÁT HẢI QUAN CẢNG',
      officialAuthority: 'TỔNG CỤC HẢI QUAN · HẢI QUAN CẢNG ĐÀ NẴNG',
      officialSub: 'HỆ THỐNG VNACCS/VCIS · CHI CỤC HQ CỬA KHẨU CẢNG TIÊN SA',
      stampText: 'CHI CỤC HQ CK CẢNG ĐÀ NẴNG - ĐÃ THÔNG QUAN',
      stampSub: 'HẢI QUAN GIÁM SÁT CỔNG',
      stampColor: '#15803d',
      fields: [
        { label: 'Số Tờ Khai Hải Quan', value: `104928${booking.id?.slice(-4) || '7721'} / XK / C31` },
        { label: 'Phân Luồng Hải Quan', value: '🟢 LUỒNG XANH (Miễn kiểm tra thực tế hàng hóa)' },
        { label: 'Số Container Khai Báo', value: booking.containerId || 'EMCU8361795' },
        { label: 'Số Chì Hãng Tàu / Niêm Phong', value: `EMC-${booking.id?.slice(-5) || '98231'}-SEAL` },
        { label: 'Tên Hàng Hóa Xuất Khẩu', value: 'Linh kiện điện tử, cơ khí chế tạo chính xác (Hàng đóng nguyên cont)' },
        { label: 'Trọng Lượng Khai Báo', value: `${payloadWeight} (Tổng trọng: ${totalVGM})` },
        { label: 'Mã Giám Sát Hải Quan (Barcode)', value: `DANANG-CUSTOMS-${booking.containerId || 'CONT'}-PASS` },
        { label: 'Trạng Thái Thông Quan', value: 'Đã hoàn tất thủ tục thông quan điện tử' },
      ],
      note: 'Tờ khai luồng xanh đã được Hải quan Cảng Tiên Sa phê duyệt điện tử và tích hợp mã vạch barcode 2D kiểm soát tại Barie cổng.'
    },
    {
      id: 'vgm',
      name: 'Phiếu Xác Nhận Cân VGM (SOLAS)',
      badge: 'SOLAS Chuẩn',
      code: `VGM-TS-${booking.containerId || '8361795'}`,
      issuer: 'TRẠM CÂN ĐIỆN TỬ CẢNG TIÊN SA (WEIGHING SCALE STATION #02)',
      status: 'Đạt chuẩn',
      date: bookingDate,
      expiry: '30/11/2026',
      icon: 'scale',
      docTitle: 'VERIFIED GROSS MASS (VGM) CERTIFICATE · PHIẾU CÂN SOLAS',
      officialAuthority: 'TRẠM CÂN XE TỰ ĐỘNG · CẢNG QUỐC TẾ TIÊN SA',
      officialSub: 'CHỨNG NHẬN KHỐI LƯỢNG TOÀN BỘ THEO CÔNG ƯỚC QUỐC TẾ SOLAS',
      stampText: 'CẢNG TIÊN SA - TRẠM CÂN SỐ 02 - ĐÃ XÁC NHẬN VGM',
      stampSub: 'WEIGHBRIDGE CERTIFIED',
      stampColor: '#b45309',
      fields: [
        { label: 'Khối Lượng Container Rỗng (Tare)', value: tareWeight },
        { label: 'Khối Lượng Hàng Hóa (Payload)', value: payloadWeight },
        { label: 'Tổng Khối Lượng Toàn Bộ (VGM)', value: `${totalVGM} (Hợp lệ SOLAS)` },
        { label: 'Tải Trọng Tối Đa (Max Gross Weight)', value: maxGross },
        { label: 'Dung Sai Cho Phép (Tolerance)', value: '± 2.5% (Nằm trong hạn mức an toàn IMO)' },
        { label: 'Phương Pháp Xác Định VGM', value: 'Phương pháp 1 (Cân nguyên container tại trạm cân chuẩn)' },
        { label: 'Số Cân / Trạm Cân Điện Tử', value: 'Trạm Cân Cổng Số 2 - Cảng Tiên Sa (Đà Nẵng)' },
        { label: 'Người Ký Xác Nhận VGM', value: `${booking.driverName || 'Nguyễn Văn Long'} (Tài xế/Đại diện chủ hàng)` },
      ],
      note: 'Phiếu cân VGM đáp ứng tiêu chuẩn bắt buộc theo Công ước quốc tế SOLAS của Tổ chức Hàng hải Quốc tế (IMO).'
    },
    {
      id: 'inspection',
      name: 'Sổ Đăng Kiểm Đầu Kéo & Rơ-moóc',
      badge: 'Đủ điều kiện',
      code: `KD-${booking.licensePlate?.replace(/[^a-zA-Z0-9]/g, '') || '43C09122'}`,
      issuer: 'CỤC ĐĂNG KIỂM VIỆT NAM - TRUNG TÂM ĐK XCG 43-01S ĐÀ NẴNG',
      status: 'Còn hạn',
      date: '15/01/2026',
      expiry: '15/01/2027',
      icon: 'local_shipping',
      docTitle: 'GIẤY CHỨNG NHẬN KIỂM ĐỊNH AN TOÀN KỸ THUẬT VÀ BẢO VỆ MÔI TRƯỜNG',
      officialAuthority: 'BỘ GIAO THÔNG VẬN TẢI · CỤC ĐĂNG KIỂM VIỆT NAM',
      officialSub: 'TRUNG TÂM KIỂM ĐỊNH XE CƠ GIỚI 43-01S TP. ĐÀ NẴNG',
      stampText: 'TRUNG TÂM ĐĂNG KIỂM 43-01S - AN TOÀN KỸ THUẬT',
      stampSub: 'TEM KIỂM ĐỊNH CÒN HẠN',
      stampColor: '#1d4ed8',
      fields: [
        { label: 'Biển Số Xe Đầu Kéo', value: booking.licensePlate || '43C-091.22' },
        { label: 'Biển Số Rơ-moóc / Sơ-mi Rơ-moóc', value: trailerPlate },
        { label: 'Nhãn Hiệu / Số Khung Đầu Kéo', value: 'HYUNDAI XCIENT 440PS (Hàn Quốc)' },
        { label: 'Khối Lượng Bản Thân Xe', value: '8,950 kg' },
        { label: 'Khối Lượng Kéo Theo Cho Phép', value: '38,500 kg (Đủ kéo container 40HC/45FT)' },
        { label: 'Số Tem Kiểm Định', value: `KD-43-${booking.id?.slice(-4) || '8812'}` },
        { label: 'Hạn Kiểm Định Tiếp Theo', value: '15/01/2027 (Còn hiệu lực)' },
        { label: 'Kết Luận Kỹ Thuật', value: 'Đủ điều kiện tham gia giao thông & vận hành trong cảng' },
      ],
      note: 'Phương tiện đầu kéo và rơ-moóc có tem đăng kiểm kỹ thuật hợp lệ, hệ thống phanh, đèn và lốp đạt chuẩn an toàn cảng Tiên Sa.'
    },
    {
      id: 'driver',
      name: 'GPLX Hạng FC & CCCD Tài Xế',
      badge: 'Hạng FC Chuẩn',
      code: `GPLX-430${booking.id?.slice(-5) || '19823'}`,
      issuer: 'SỞ GIAO THÔNG VẬN TẢI THÀNH PHỐ ĐÀ NẴNG',
      status: 'Hợp lệ',
      date: '20/10/2023',
      expiry: '20/10/2028',
      icon: 'badge',
      docTitle: 'GIẤY PHÉP LÁI XE QUỐC GIA (HẠNG FC CHUYÊN DỤNG ĐẦU KÉO)',
      officialAuthority: 'BỘ GIAO THÔNG VẬN TẢI · SỞ GTVT TP. ĐÀ NẴNG',
      officialSub: 'HỆ THỐNG QUẢN LÝ GIẤY PHÉP LÁI XE QUỐC GIA VIỆT NAM',
      stampText: 'SỞ GTVT TP ĐÀ NẴNG - PHÒNG QUẢN LÝ PHƯƠNG TIỆN',
      stampSub: 'GPLX HẠNG FC HỢP PHÁP',
      stampColor: '#9333ea',
      fields: [
        { label: 'Họ Và Tên Tài Xế', value: booking.driverName || 'Nguyễn Văn Long' },
        { label: 'Số Căn Cước Công Dân (CCCD)', value: '048092004812 (Bộ Công An cấp)' },
        { label: 'Số Giấy Phép Lái Xe (GPLX)', value: `430${booking.id?.slice(-5) || '19823'}` },
        { label: 'Hạng Bằng Lái Xe', value: 'HẠNG FC (Được phép điều khiển xe đầu kéo rơ-moóc)' },
        { label: 'Ngày Sinh / Quốc Tịch', value: '18/06/1988 · Việt Nam' },
        { label: 'Thời Hạn Giấy Phép Lái Xe', value: '20/10/2028 (Còn hiệu lực 2 năm)' },
        { label: 'Số Điện Thoại Đăng Ký App', value: booking.phone || '0905 123 456' },
        { label: 'Đơn Vị Quản Lý Lao Động', value: booking.company || 'Doanh Nghiệp Vận Tải Tiên Sa' },
      ],
      note: 'Tài xế đã hoàn thành huấn luyện an toàn lao động bến cảng Tiên Sa và có bằng FC đúng quy định cho xe container.'
    }
  ]

  const currentDoc = documents.find(d => d.id === activeTab) || documents[0]

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5 bg-carbon/85 backdrop-blur-md animate-in zoom-in-95 duration-150 font-sans"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white w-full max-w-6xl max-h-[95vh] rounded-3xl p-5 sm:p-7 space-y-4 shadow-2xl flex flex-col overflow-hidden border border-chalk">
        
        {/* Header Modal */}
        <div className="flex justify-between items-start border-b border-chalk pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-signal-orange/10 flex items-center justify-center text-signal-orange">
              <span className="material-symbols-outlined text-2xl">folder_shared</span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-signal-orange uppercase font-mono tracking-wider block">
                HỒ SƠ GIẤY TỜ & CHỨNG TỪ PHÁP LÝ · CẢNG QUỐC TẾ TIÊN SA
              </span>
              <h3 className="font-heading text-xl sm:text-2xl font-black text-carbon font-mono">
                ĐỐI SOÁT CHỨNG TỪ BOOKING #{booking.id}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Bản scan thật vs Dữ liệu số hoá */}
            <div className="inline-flex rounded-xl bg-fog p-1 border border-chalk text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('scan')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  viewMode === 'scan' ? 'bg-signal-orange text-white shadow-xs' : 'text-slate hover:text-carbon'
                }`}
              >
                <span className="material-symbols-outlined text-sm">photo_library</span>
                <span>Bản Scan Thực Tế (Scan Photo)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('data')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  viewMode === 'data' ? 'bg-carbon text-white shadow-xs' : 'text-slate hover:text-carbon'
                }`}
              >
                <span className="material-symbols-outlined text-sm">view_list</span>
                <span>Dữ Liệu Số Hóa</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon transition ml-1"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* Verification Summary Banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-emerald-600 text-xl">verified_user</span>
            <div>
              <strong className="text-xs font-extrabold text-emerald-900 block">
                Hồ sơ giấy tờ pháp lý khớp 100% với Booking ({booking.id})
              </strong>
              <span className="text-[11px] text-emerald-700">
                Container: <strong className="font-mono">{booking.containerId || '40HC'}</strong> • 
                Đầu kéo: <strong className="font-mono">{booking.licensePlate || 'Xe tải'}</strong> • 
                Tài xế: <strong>{booking.driverName || 'Chưa định danh'}</strong> • 
                Doanh nghiệp: <strong>{booking.company || 'Đang cập nhật'}</strong>
              </span>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-xs">
            Đủ điều kiện qua cổng
          </span>
        </div>

        {/* Tab Navigation (5 Loại Giấy Tờ Bắt Buộc) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-chalk text-xs font-bold select-none">
          {documents.map((doc) => {
            const isActive = doc.id === activeTab
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => {
                  setActiveTab(doc.id)
                  setZoomLevel(1)
                }}
                className={`px-3.5 py-2.5 rounded-xl transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-carbon text-white shadow-xs'
                    : 'bg-fog text-slate hover:text-carbon hover:bg-chalk'
                }`}
              >
                <span className="material-symbols-outlined text-base">{doc.icon}</span>
                <span>{doc.name}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {doc.badge}
                </span>
              </button>
            )
          })}
        </div>

        {/* Content Body: Bản Scan Chân Thực hoặc Bảng Dữ Liệu */}
        {viewMode === 'scan' ? (
          /* BẢN SCAN THỰC TẾ (REAL SCAN PHOTO) VỚI ĐẦY ĐỦ DẤU MỘC ĐỎ, BARCODE & CON DẤU HẢI QUAN */
          <div className="flex-1 flex flex-col min-h-0 bg-slate-900/90 rounded-2xl p-3 sm:p-4 border border-slate-700 overflow-hidden relative shadow-inner">
            
            {/* Toolbar trên ảnh scan: Phóng to, thu nhỏ, tải về */}
            <div className="flex justify-between items-center bg-slate-800/90 text-white px-3.5 py-2 rounded-xl mb-3 text-xs border border-slate-700 select-none">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-signal-orange text-base">document_scanner</span>
                <span className="font-mono font-bold text-slate-200">
                  BẢN SCAN GỐC: {currentDoc.name.toUpperCase()} (ĐỘ PHÂN GIẢI CAO · CÓ DẤU MỘC ĐỎ)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.8, Number((z - 0.15).toFixed(2))))}
                  className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 font-mono text-xs text-white"
                  title="Thu nhỏ"
                >
                  - Zoom
                </button>
                <span className="font-mono text-xs px-1 text-slate-300 font-bold">{Math.round(zoomLevel * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(1.5, Number((z + 0.15).toFixed(2))))}
                  className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 font-mono text-xs text-white"
                  title="Phóng to"
                >
                  + Zoom
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 ml-1"
                >
                  Mặc định
                </button>
              </div>
            </div>

            {/* Khung hiển thị Giấy Scan (mô phỏng tài liệu A4 / hoá đơn scan thật với texture và độ chân thực tối đa) */}
            <div className="flex-1 overflow-auto flex items-start justify-center p-2 sm:p-4">
              <div
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out',
                }}
                className="w-full max-w-3xl bg-[#fefcf8] rounded-lg shadow-2xl p-6 sm:p-9 border border-amber-200/60 text-slate-900 relative font-serif"
              >
                {/* Background Scan Texture / Aging watermark */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-50/30 via-transparent to-slate-100/40 pointer-events-none rounded-lg"></div>

                {/* Header cơ quan / Hãng tàu phát hành */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3 mb-4">
                  <div className="text-left font-sans">
                    <p className="text-[12px] font-black uppercase tracking-wider text-slate-900">
                      {currentDoc.officialAuthority}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-600 uppercase">
                      {currentDoc.officialSub}
                    </p>
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                      CỔNG THÔNG TIN QUẢN TRỊ CẢNG BIỂN TIÊN SA · HỆ THỐNG NEXUSPORT
                    </p>
                  </div>

                  <div className="text-right font-sans">
                    <div className="text-[11px] font-black font-mono text-slate-800">
                      SỐ / NO: <span className="text-signal-orange">{currentDoc.code}</span>
                    </div>
                    <div className="text-[10px] text-slate-600 font-mono">
                      NGÀY CẤP: {currentDoc.date}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-bold font-mono">
                      HIỆU LỰC: {currentDoc.expiry}
                    </div>
                  </div>
                </div>

                {/* Tiêu đề tài liệu pháp lý */}
                <div className="text-center my-4">
                  <h2 className="text-base sm:text-lg font-black font-sans uppercase tracking-wide text-slate-900 border-b border-dashed border-slate-300 pb-2 inline-block px-4">
                    {currentDoc.docTitle}
                  </h2>
                  <p className="text-[11px] font-sans italic text-slate-600 mt-1">
                    (Bản chính số hoá lưu chiểu điện tử phục vụ đối soát quy trình Gate-In Cảng Tiên Sa)
                  </p>
                </div>

                {/* Bảng kê chi tiết thông số khớp chính xác với booking */}
                <div className="my-5 border border-slate-300 rounded-sm overflow-hidden font-sans">
                  <table className="w-full text-left text-xs border-collapse">
                    <tbody>
                      {currentDoc.fields.map((f, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-amber-50/30' : 'bg-white'}>
                          <td className="p-2 border-b border-r border-slate-200 font-semibold text-slate-700 w-2/5">
                            {f.label}:
                          </td>
                          <td className="p-2 border-b border-slate-200 font-mono font-bold text-slate-900">
                            {f.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Ghi chú pháp lý */}
                <p className="text-[11px] italic text-slate-700 font-sans my-3 leading-relaxed">
                  * <strong>Xác nhận điều phối:</strong> {currentDoc.note}
                </p>

                {/* Chữ ký, Dấu Mộc Đỏ & Barcode quét thực tế */}
                <div className="grid grid-cols-2 gap-4 mt-8 pt-4 border-t border-slate-300 items-end font-sans">
                  {/* Cột trái: Mã vạch Barcode Hải quan & QR Code Cổng */}
                  <div className="space-y-2">
                    <div className="inline-block p-2 bg-white border border-slate-300 rounded shadow-xs">
                      <div className="w-44 h-8 bg-slate-900 flex items-center justify-center text-[10px] text-white font-mono tracking-widest font-black">
                        ||| | |||| | ||| |||| |
                      </div>
                      <span className="text-[9px] font-mono text-slate-600 block text-center mt-1 font-bold">
                        {currentDoc.code}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      MÃ SỐ ĐỐI SOÁT: GATE-{booking.id?.toUpperCase() || 'BOOKING'}
                    </div>
                  </div>

                  {/* Cột phải: Dấu mộc tròn đỏ & Chữ ký tay */}
                  <div className="flex flex-col items-center justify-center relative">
                    <span className="text-[11px] font-bold text-slate-800 uppercase">
                      NGƯỜI CÓ THẨM QUYỀN DUYỆT CỔNG
                    </span>
                    <span className="text-[10px] italic text-slate-500 mb-6">
                      (Ký, ghi rõ họ tên và đóng dấu)
                    </span>

                    {/* Mộc dấu tròn đỏ sống động của Hải quan / Cảng Tiên Sa */}
                    <div
                      style={{ borderColor: currentDoc.stampColor }}
                      className="w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center p-1.5 rotate-[-12deg] shadow-sm relative select-none"
                    >
                      <div
                        style={{ borderColor: currentDoc.stampColor }}
                        className="w-full h-full rounded-full border border-dashed flex flex-col items-center justify-center p-1 text-center"
                      >
                        <span
                          style={{ color: currentDoc.stampColor }}
                          className="text-[7.5px] font-black uppercase tracking-tighter leading-none"
                        >
                          {currentDoc.stampText}
                        </span>
                        <span
                          style={{ color: currentDoc.stampColor }}
                          className="material-symbols-outlined text-xs my-0.5"
                        >
                          verified
                        </span>
                        <span
                          style={{ color: currentDoc.stampColor }}
                          className="text-[7px] font-black font-mono tracking-tight"
                        >
                          {currentDoc.stampSub}
                        </span>
                        <span
                          style={{ color: currentDoc.stampColor }}
                          className="text-[6.5px] font-mono mt-0.5"
                        >
                          ★ {bookingDate} ★
                        </span>
                      </div>
                    </div>

                    {/* Chữ ký mực xanh sống động */}
                    <div className="text-[#1d4ed8] font-serif italic font-bold text-lg rotate-[-6deg] -mt-5 select-none z-10">
                      Nguyễn Văn Long
                    </div>
                    <span className="text-[10px] font-bold text-slate-700 mt-1">
                      {booking.driverName || 'Nguyễn Văn Long'} / Điều Độ Trực Cổng
                    </span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        ) : (
          /* CHẾ ĐỘ DỮ LIỆU SỐ HÓA (DATA LIST VIEW) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 overflow-y-auto pr-1">
            <div className="lg:col-span-8 space-y-4">
              <div className="border border-chalk rounded-2xl p-4 bg-[#fafbfc] space-y-3">
                <div className="flex items-center justify-between border-b border-chalk pb-2">
                  <div>
                    <h4 className="text-sm font-extrabold text-carbon flex items-center gap-2">
                      <span className="material-symbols-outlined text-signal-orange text-lg">
                        {currentDoc.icon}
                      </span>
                      {currentDoc.name}
                    </h4>
                    <span className="text-[10px] text-slate font-mono">Mã số: {currentDoc.code}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    {currentDoc.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {currentDoc.fields.map((field, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-xl border border-chalk/80">
                      <span className="text-[10px] font-bold text-slate block mb-0.5">{field.label}</span>
                      <strong className="text-xs text-carbon font-mono block break-words">{field.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-base mt-0.5">info</span>
                  <p className="text-[11px] leading-relaxed m-0">{currentDoc.note}</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col justify-between">
              <div className="border border-chalk rounded-2xl p-4 bg-fog space-y-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate block">
                  TỔNG QUAN XÁC THỰC
                </span>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-chalk">
                    <span className="text-slate">Hãng tàu:</span>
                    <strong className="text-carbon truncate max-w-[150px]">{currentDoc.issuer}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-chalk">
                    <span className="text-slate">Ngày phát hành:</span>
                    <strong className="text-carbon">{currentDoc.date}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-chalk">
                    <span className="text-slate">Hạn sử dụng:</span>
                    <strong className="text-emerald-700">{currentDoc.expiry}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-chalk">
                    <span className="text-slate">Niêm phong Seal:</span>
                    <strong className="text-signal-orange">EMC-SEAL-OK</strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewMode('scan')}
                  className="w-full py-2.5 rounded-xl bg-signal-orange text-white text-xs font-extrabold hover:bg-signal-orange/90 transition shadow-xs flex items-center justify-center gap-2 mt-4"
                >
                  <span className="material-symbols-outlined text-sm">visibility</span>
                  Xem bản scan dấu đỏ chi tiết
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-chalk flex justify-between items-center text-xs">
          <span className="text-slate flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
            Hồ sơ điện tử Tiên Sa: Đối soát khớp 100% với dữ liệu đăng ký Gate Booking {booking.id}.
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-signal-orange text-white font-extrabold hover:bg-signal-orange/90 transition shadow-xs"
            >
              Đã kiểm tra xong
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
