import React, { useState } from 'react'

// ─── CONTAINER MASTER LIST (simulated database) ───────────────────────────────
const CONTAINER_LIST = [
  {
    id: 'MSCU1234567',
    status: 'TRONG BÃI',
    type: '40FT HC',
    weight: '28,500 KG',
    seal: 'SEAL-88921',
    cargoType: 'Hàng Khô Thông Thường',
    vessel: 'EVER GIVEN',
    voyage: 'EVG-2026-08',
    carrier: 'Maersk Line',
    block: 'A', bay: '03', row: '12', tier: '2',
    fullPosition: 'A-03-12-2',
    condition: 'TỐT',
    lastInspection: '12/08/2026 14:30',
    inspectionBy: 'Trần Văn Nam',
    expectedAction: 'Xuất Cổng Xe Tải',
    expectedDeparture: '12/08/2026 16:30',
    driver: 'Nguyễn Văn A',
    truck: '51C-123.45',
    timeline: [
      { date: '12/08', time: '14:30', event: 'Xác Nhận Kiểm Kê', desc: 'Kiểm kê bãi hoàn tất bởi Trần Văn Nam' },
      { date: '12/08', time: '09:42', event: 'Gán Vị Trí A-03-12-2', desc: 'Gán vị trí bằng hệ thống AI' },
      { date: '12/08', time: '09:30', event: 'Dỡ Từ Tàu Vào Bãi', desc: 'Dỡ từ tàu EVER GIVEN tại Cầu B-01' },
    ],
  },
  {
    id: 'TEMU882219',
    status: 'TRONG BÃI',
    type: '20FT ST',
    weight: '14,200 KG',
    seal: 'SEAL-99102',
    cargoType: 'Hạt Nhựa PET Công Nghiệp',
    vessel: 'MSC GULSUN',
    voyage: 'MSC-2026-08',
    carrier: 'MSC Mediterranean',
    block: 'B', bay: '01', row: '08', tier: '1',
    fullPosition: 'B-01-08-1',
    condition: 'TỐT',
    lastInspection: '11/08/2026 09:15',
    inspectionBy: 'Lê Văn Minh',
    expectedAction: 'Chờ Lệnh Vận Chuyển',
    expectedDeparture: '15/08/2026 08:00',
    driver: '—',
    truck: '—',
    timeline: [
      { date: '11/08', time: '09:15', event: 'Xác Nhận Kiểm Kê', desc: 'Kiểm kê bãi hoàn tất bởi Lê Văn Minh' },
      { date: '11/08', time: '08:50', event: 'Gán Vị Trí B-01-08-1', desc: 'Gán vị trí bằng hệ thống AI' },
      { date: '11/08', time: '07:00', event: 'Dỡ Từ Tàu Vào Bãi', desc: 'Dỡ từ tàu MSC GULSUN tại Cầu B-02' },
    ],
  },
  {
    id: 'CMAU9918234',
    status: 'TRONG BÃI',
    type: '40FT HC',
    weight: '26,800 KG',
    seal: 'SEAL-44819',
    cargoType: 'Động Cơ Máy Công Nghiệp Nặng',
    vessel: 'EVER GIVEN',
    voyage: 'EVG-2026-08',
    carrier: 'CMA CGM Logistics',
    block: 'A', bay: '01', row: '02', tier: '1',
    fullPosition: 'A-01-02-1',
    condition: 'MÓP MÉO VỎ SƯỜN',
    lastInspection: '12/08/2026 10:00',
    inspectionBy: 'Nguyễn Văn Nam',
    expectedAction: 'Chờ Xử Lý Hư Hỏng',
    expectedDeparture: '—',
    driver: '—',
    truck: '—',
    timeline: [
      { date: '12/08', time: '10:00', event: 'Lập Báo Cáo Hư Hỏng', desc: 'Phát hiện móp vỏ sườn phải 30cm' },
      { date: '12/08', time: '09:20', event: 'Kiểm Kê Sai Lệch Vị Trí', desc: 'Thực tế ở A-01-05-3 thay vì A-01-02-1' },
      { date: '12/08', time: '08:00', event: 'Dỡ Từ Tàu Vào Bãi', desc: 'Dỡ từ tàu EVER GIVEN tại Cầu B-01' },
    ],
  },
  {
    id: 'HLBU7781920',
    status: 'SẴN SÀNG XUẤT CỔNG',
    type: '40FT HC',
    weight: '24,000 KG',
    seal: 'SEAL-11092',
    cargoType: 'Nông Sản Đóng Thùng Xuất Khẩu',
    vessel: 'NEXUS CARRIER',
    voyage: 'NXC-2026-08',
    carrier: 'Hapag-Lloyd',
    block: 'A', bay: '03', row: '01', tier: '1',
    fullPosition: 'A-03-01-1',
    condition: 'TỐT',
    lastInspection: '12/08/2026 08:15',
    inspectionBy: 'Phạm Thị Hoa',
    expectedAction: 'Xuất Cổng Xe Tải',
    expectedDeparture: '12/08/2026 14:00',
    driver: 'Trần Văn Hải',
    truck: '79B-441.22',
    timeline: [
      { date: '12/08', time: '08:15', event: 'Xác Nhận Sẵn Sàng Xuất Cổng', desc: 'Hạ bãi sẵn sàng vị trí A-03-01-1' },
      { date: '12/08', time: '07:45', event: 'Kiểm Kê Đầy Đủ', desc: 'Xác nhận đủ số lượng 2,100 thùng carton' },
      { date: '11/08', time: '22:00', event: 'Dỡ Từ Tàu Vào Bãi', desc: 'Dỡ từ tàu NEXUS CARRIER tại Cầu A-01' },
    ],
  },
  {
    id: 'TEMU4451920',
    status: 'TRONG BÃI',
    type: '40FT RF',
    weight: '31,000 KG',
    seal: 'SEAL-44819',
    cargoType: 'Hàng Lạnh Thực Phẩm Đông Lạnh',
    vessel: 'MSC GULSUN',
    voyage: 'MSC-2026-08',
    carrier: 'MSC Mediterranean',
    block: 'A', bay: '02', row: '01', tier: '1',
    fullPosition: 'A-02-01-1',
    condition: 'TỐT',
    lastInspection: '12/08/2026 11:00',
    inspectionBy: 'Võ Thị Lan',
    expectedAction: 'Đặt Trước Bãi Lạnh',
    expectedDeparture: '13/08/2026 08:00',
    driver: '—',
    truck: '—',
    timeline: [
      { date: '12/08', time: '11:00', event: 'Kiểm Nhiệt Độ Container Lạnh', desc: 'Nhiệt độ -18°C ổn định, cảm biến hoạt động tốt' },
      { date: '12/08', time: '09:00', event: 'Gán Vị Trí Bãi Lạnh', desc: 'Đặt ưu tiên ô bãi lạnh có nguồn điện' },
      { date: '12/08', time: '08:30', event: 'Dỡ Từ Tàu Vào Bãi', desc: 'Dỡ từ tàu MSC GULSUN tại Cầu B-02' },
    ],
  },
  {
    id: 'COSU8819201',
    status: 'ĐANG DI CHUYỂN',
    type: '40FT HC',
    weight: '26,800 KG',
    seal: 'SEAL-77192',
    cargoType: 'Hàng Xuất Khẩu Khô',
    vessel: 'EVER GIVEN',
    voyage: 'EVG-2026-08',
    carrier: 'COSCO Shipping',
    block: 'A', bay: '02', row: '01', tier: '2',
    fullPosition: 'A-02-01-2',
    condition: 'TỐT',
    lastInspection: '12/08/2026 10:15',
    inspectionBy: 'Cẩu RTG-01',
    expectedAction: 'Đang Đảo Chuyển Bãi',
    expectedDeparture: '12/08/2026 21:45',
    driver: '—',
    truck: '—',
    timeline: [
      { date: '12/08', time: '10:15', event: 'Bắt Đầu Đảo Chuyển Vị Trí', desc: 'RTG-01 đang di chuyển container theo lệnh MOV-1024' },
      { date: '12/08', time: '09:00', event: 'Gán Lệnh Di Chuyển', desc: 'Operator Nguyễn Văn Q phát lệnh đảo chuyển bãi' },
      { date: '12/08', time: '08:00', event: 'Dỡ Từ Tàu Vào Bãi', desc: 'Dỡ từ tàu EVER GIVEN tại Cầu B-01' },
    ],
  },
]

// Status badge config
const STATUS_CFG = {
  'TRONG BÃI':         { cls: 'bg-blue-100 text-blue-950 border-blue-400',     icon: '🔵' },
  'SẴN SÀNG XUẤT CỔNG':{ cls: 'bg-emerald-100 text-emerald-950 border-emerald-400', icon: '🟢' },
  'ĐANG DI CHUYỂN':    { cls: 'bg-purple-100 text-purple-950 border-purple-400', icon: '⚡' },
  'HƯ HỎNG':           { cls: 'bg-red-200 text-red-950 border-red-500',         icon: '🔴' },
}

// ─── DETAIL VIEW ─────────────────────────────────────────────────────────────
function DetailView({ container, onBack, showToast }) {
  const [movementTimeline, setMovementTimeline] = useState(container.timeline || [])
  const [currentData, setCurrentData] = useState(container)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [newPositionInput, setNewPositionInput] = useState(container.fullPosition)
  const [showDamageModal, setShowDamageModal] = useState(false)
  const [damageNotesInput, setDamageNotesInput] = useState('')

  const handleUpdatePositionSubmit = (e) => {
    e.preventDefault()
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    const oldPos = currentData.fullPosition
    const parts = newPositionInput.split('-')
    setCurrentData(prev => ({
      ...prev, fullPosition: newPositionInput,
      block: parts[0] || 'B', bay: parts[1] || '02', row: parts[2] || '08', tier: parts[3] || '3',
    }))
    setMovementTimeline(prev => [
      { date: '12/08', time: nowTime, event: `Cập Nhật Vị Trí Mới: ${newPositionInput}`, desc: `Dịch chuyển từ [${oldPos}] ➔ [${newPositionInput}]` },
      ...prev,
    ])
    setShowUpdateModal(false)
    showToast(`📍 ĐÃ CẬP NHẬT VỊ TRÍ MỚI: Container ${currentData.id} → [${newPositionInput}]!`)
  }

  const handleReportDamageSubmit = (e) => {
    e.preventDefault()
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    setCurrentData(prev => ({ ...prev, condition: 'HƯ HỎNG VỎ' }))
    setMovementTimeline(prev => [
      { date: '12/08', time: nowTime, event: 'Lập Báo Cáo Hư Hỏng', desc: `"${damageNotesInput || 'Trầy xước móp vỏ'}"` },
      ...prev,
    ])
    setShowDamageModal(false)
    showToast(`🚨 ĐÃ GỬI BÁO CÁO HƯ HỎNG VỎ CONTAINER ${currentData.id}!`)
  }

  const st = STATUS_CFG[currentData.status] || STATUS_CFG['TRONG BÃI']

  return (
    <div className="flex flex-col gap-6">
      {/* Back button */}
      <button onClick={onBack}
        className="flex items-center gap-2 text-xs font-black text-slate-700 hover:text-orange-700 transition-colors w-fit font-sans">
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Quay lại Danh Sách Container
      </button>

      {/* Header */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs font-mono">
            <span className="font-heading font-black text-orange-600 tracking-wider">NEXUSPORT</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 font-bold">Chi Tiết Container</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-heading text-3xl font-black text-slate-900 font-mono">{currentData.id}</h2>
            <span className={`px-3.5 py-1 border-2 font-mono font-black text-xs rounded-xl ${st.cls}`}>
              {st.icon} {currentData.status}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">Hồ sơ đầy đủ: thông số kỹ thuật, vị trí ô bãi, lịch sử dịch chuyển và kế hoạch xuất cảng.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href="/yard-staff/gate-out-preparation"
            className="px-4 py-2.5 bg-orange-100 hover:bg-orange-200 text-orange-950 border-2 border-orange-400 font-black text-xs rounded-xl flex items-center gap-2 transition-all">
            🚛 Chuẩn Bị Xuất Cổng
          </a>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => setShowUpdateModal(true)}
          className="h-12 bg-blue-100 hover:bg-blue-200 text-blue-950 border-2 border-blue-400 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all">
          <span className="material-symbols-outlined text-sm">near_me</span> Cập Nhật Vị Trí
        </button>
        <button onClick={() => setShowDamageModal(true)}
          className="h-12 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-400 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all">
          <span className="material-symbols-outlined text-sm">report_problem</span> Báo Hư Hỏng
        </button>
        <a href="#movement-history"
          className="h-12 bg-purple-100 hover:bg-purple-200 text-purple-950 border-2 border-purple-400 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all">
          <span className="material-symbols-outlined text-sm">history</span> Lịch Sử
        </a>
        <a href="/yard-staff/gate-out-preparation"
          className="h-12 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-2 border-emerald-400 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all">
          <span className="material-symbols-outlined text-sm">task_alt</span> Xuất Cổng
        </a>
      </div>

      {/* Main Info + Location */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4 lg:col-span-2">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
            <span className="material-symbols-outlined text-orange-600">info</span>
            THÔNG TIN CHÍNH CONTAINER
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
            {[
              ['Loại Container', currentData.type, 'text-slate-900'],
              ['Trọng Lượng', currentData.weight, 'text-slate-900'],
              ['Số Niêm Phong', currentData.seal, 'text-purple-900'],
              ['Tàu Chở', currentData.vessel, 'text-blue-900'],
              ['Số Chuyến', currentData.voyage, 'text-slate-900'],
              ['Hãng Tàu', currentData.carrier, 'text-emerald-900'],
            ].map(([label, val, cls]) => (
              <div key={label} className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block">{label}</span>
                <strong className={`font-black text-sm ${cls}`}>{val}</strong>
              </div>
            ))}
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 sm:col-span-3">
              <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block">Loại Hàng Hóa</span>
              <strong className="text-slate-900 font-extrabold font-sans text-xs">{currentData.cargoType}</strong>
            </div>
          </div>
        </div>

        {/* Location + Mini Map */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
            <span className="material-symbols-outlined text-blue-600">location_on</span>
            VỊ TRÍ Ô BÃI HIỆN TẠI
          </h3>
          <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs">
            {[['Khu', currentData.block], ['Dãy (Bay)', currentData.bay], ['Hàng (Row)', currentData.row], ['Tầng (Tier)', currentData.tier]].map(([k, v]) => (
              <div key={k} className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[9px] text-slate-500 font-sans block font-bold">{k}</span>
                <strong className="text-slate-900 font-black">{v}</strong>
              </div>
            ))}
          </div>
          <div className="p-3 bg-orange-50 border-2 border-orange-400 rounded-xl text-center font-mono">
            <span className="text-[10px] text-orange-950 uppercase font-sans font-black block">FULL POSITION</span>
            <strong className="text-orange-950 font-black text-xl">{currentData.fullPosition}</strong>
          </div>
          {/* Mini 2D Map */}
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
            <div className="text-[10px] text-amber-400 font-mono font-bold">SƠ ĐỒ 2D HIGHLIGHT VỊ TRÍ:</div>
            <div className="grid grid-cols-4 gap-1 font-mono text-[10px] text-center">
              {['A-01','A-02','A-03','A-04'].map(c => (
                <div key={c} className={`p-2 rounded border-2 font-black ${
                  c.includes(currentData.bay) && currentData.block === 'A'
                    ? 'bg-orange-500 text-white border-amber-400 animate-pulse'
                    : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}>{c}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Condition + Upcoming Action + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Condition */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
            <span className="material-symbols-outlined text-emerald-600">verified</span>
            TÌNH TRẠNG VỎ CONTAINER
          </h3>
          <div className={`p-3 border rounded-xl flex justify-between items-center ${currentData.condition === 'TỐT' ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}>
            <span className="text-xs font-sans font-bold text-slate-700">Tình trạng:</span>
            <span className={`px-2.5 py-0.5 rounded-full border font-black text-[11px] font-mono ${currentData.condition === 'TỐT' ? 'bg-emerald-100 text-emerald-950 border-emerald-400' : 'bg-red-200 text-red-950 border-red-500'}`}>
              {currentData.condition}
            </span>
          </div>
          <div className="text-xs font-mono space-y-2">
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans font-bold block">Lần Kiểm Tra Cuối</span>
              <strong className="text-slate-900 font-bold">{currentData.lastInspection}</strong>
            </div>
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans font-bold block">Người Kiểm Tra</span>
              <strong className="text-purple-900 font-bold font-sans">{currentData.inspectionBy}</strong>
            </div>
          </div>
        </div>

        {/* Upcoming Action */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
            <span className="material-symbols-outlined text-purple-600">schedule</span>
            TÁC NGHIỆP DỰ KIẾN KẾ TIẾP
          </h3>
          <div className="bg-purple-50 p-3 border border-purple-300 rounded-xl text-xs font-mono">
            <span className="text-[10px] text-purple-900 uppercase font-sans font-black block">Thao Tác Dự Kiến</span>
            <strong className="text-purple-950 font-black text-sm">{currentData.expectedAction}</strong>
          </div>
          <div className="text-xs font-mono space-y-2">
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans font-bold block">Thời Gian Xuất Cảng</span>
              <strong className="text-slate-900 font-bold">{currentData.expectedDeparture}</strong>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-sans font-bold block">Tài Xế</span>
                <strong className="text-slate-900 font-bold font-sans text-[11px]">{currentData.driver}</strong>
              </div>
              <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-sans font-bold block">Biển Số Xe</span>
                <strong className="text-blue-900 font-black text-[11px]">{currentData.truck}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Movement History */}
        <div id="movement-history" className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
            <span className="material-symbols-outlined text-orange-600">history</span>
            LỊCH SỬ DỊCH CHUYỂN
            <span className="ml-auto text-xs font-mono font-bold text-slate-500">{movementTimeline.length} sự kiện</span>
          </h3>
          <div className="space-y-2.5 font-mono text-xs">
            {movementTimeline.map((item, idx) => (
              <div key={idx} className="flex gap-3 items-start p-2.5 bg-slate-100 rounded-xl border border-slate-200">
                <div className="px-2 py-1 bg-white border border-slate-300 rounded font-black text-[10px] text-center flex-shrink-0">
                  <div>{item.date}</div>
                  <div className="text-orange-700">{item.time}</div>
                </div>
                <div>
                  <div className="font-black text-slate-900 text-xs">{item.event}</div>
                  <div className="text-[11px] text-slate-600 font-sans">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal: Update Position */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 border-2 border-blue-400 font-sans">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading text-lg font-black text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">near_me</span>
                Cập Nhật Vị Trí Ô Bãi Mới
              </h3>
              <button onClick={() => setShowUpdateModal(false)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <form onSubmit={handleUpdatePositionSubmit} className="space-y-4 text-xs font-bold">
              <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 font-mono">
                <span className="text-[10px] text-slate-500 uppercase font-sans block">Vị Trí Hiện Tại</span>
                <strong className="text-orange-700 font-black text-base">{currentData.fullPosition}</strong>
              </div>
              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Nhập Vị Trí Mới *</label>
                <input type="text" value={newPositionInput} onChange={e => setNewPositionInput(e.target.value.toUpperCase())}
                  placeholder="VD: B-02-08-3"
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-mono font-black text-sm uppercase" required />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowUpdateModal(false)} className="flex-1 h-12 border border-slate-300 text-slate-700 rounded-xl font-extrabold text-xs hover:bg-slate-100">Hủy Bỏ</button>
                <button type="submit" className="flex-1 h-12 bg-blue-100 hover:bg-blue-200 text-blue-950 border-2 border-blue-400 rounded-xl font-black text-xs">[ XÁC NHẬN ]</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Report Damage */}
      {showDamageModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 border-2 border-red-400 font-sans">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading text-lg font-black text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600">report_problem</span>
                Ghi Nhận Hư Hỏng Vỏ Container
              </h3>
              <button onClick={() => setShowDamageModal(false)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <form onSubmit={handleReportDamageSubmit} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Mô Tả Chi Tiết Vết Hư Hỏng *</label>
                <textarea rows="3" value={damageNotesInput} onChange={e => setDamageNotesInput(e.target.value)}
                  placeholder="Mô tả trầy xước, móp vỏ hoặc hư hỏng niêm phong chì..."
                  className="w-full p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-normal resize-none" required />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowDamageModal(false)} className="flex-1 h-12 border border-slate-300 text-slate-700 rounded-xl font-extrabold text-xs hover:bg-slate-100">Hủy Bỏ</button>
                <button type="submit" className="flex-1 h-12 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-400 rounded-xl font-black text-xs">[ GỬI BÁO CÁO ]</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── LIST VIEW ────────────────────────────────────────────────────────────────
function ListView({ onSelect }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')

  const filtered = CONTAINER_LIST.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = c.id.toLowerCase().includes(q) || c.cargoType.toLowerCase().includes(q) || c.vessel.toLowerCase().includes(q) || c.fullPosition.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'All' || c.status === statusFilter
    const matchType = typeFilter === 'All' || c.type === typeFilter
    return matchSearch && matchStatus && matchType
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1 text-xs font-mono">
          <span className="font-heading font-black text-orange-600 tracking-wider">NEXUSPORT</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-extrabold">Chi Tiết Container</span>
        </div>
        <div className="flex items-center gap-3">
          <h2 className="font-heading text-3xl font-black text-slate-900">Danh Sách Container Trong Bãi</h2>
          <span className="px-3.5 py-1 bg-orange-100 text-orange-950 border-2 border-orange-400 font-mono font-black text-xs rounded-xl">
            {CONTAINER_LIST.length} CONTAINER
          </span>
        </div>
        <p className="text-xs text-slate-600 mt-0.5">Nhấn vào một container để xem đầy đủ thông tin chi tiết, vị trí ô bãi, lịch sử dịch chuyển và tác nghiệp dự kiến.</p>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm Mã Container / Tên Hàng / Tên Tàu / Vị Trí..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:border-slate-900 uppercase" />
        </div>
        <div className="flex gap-2 text-xs font-bold">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none">
            <option value="All">Trạng Thái: Tất Cả</option>
            <option value="TRONG BÃI">Trong Bãi 🔵</option>
            <option value="SẴN SÀNG XUẤT CỔNG">Sẵn Sàng Xuất Cổng 🟢</option>
            <option value="ĐANG DI CHUYỂN">Đang Di Chuyển ⚡</option>
            <option value="HƯ HỎNG">Hư Hỏng 🔴</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none">
            <option value="All">Loại Cont: Tất Cả</option>
            <option value="40FT HC">40FT HC</option>
            <option value="20FT ST">20FT ST</option>
            <option value="40FT RF">40FT RF (Lạnh)</option>
          </select>
        </div>
      </div>

      {/* Container Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-3 bg-white rounded-2xl border-2 border-slate-200 p-12 text-center text-slate-500 font-sans font-bold">
            Không tìm thấy container phù hợp.
          </div>
        ) : filtered.map(c => {
          const st = STATUS_CFG[c.status] || STATUS_CFG['TRONG BÃI']
          return (
            <button key={c.id} onClick={() => onSelect(c)}
              className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-sm hover:border-orange-400 hover:shadow-md cursor-pointer transition-all text-left group space-y-3 w-full">

              {/* Card Header */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-heading font-black text-slate-900 text-base group-hover:text-orange-700 transition-colors font-mono">{c.id}</div>
                  <div className="text-[11px] text-slate-500 font-sans font-bold mt-0.5">{c.type} · {c.carrier}</div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full border font-black text-[10px] font-mono flex-shrink-0 ${st.cls}`}>
                  {st.icon} {c.status}
                </span>
              </div>

              {/* Cargo Type */}
              <div className="text-xs text-slate-800 font-sans font-bold truncate" title={c.cargoType}>
                📦 {c.cargoType}
              </div>

              {/* Key Info Row */}
              <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                <div className="bg-slate-100 p-2 rounded-lg border border-slate-200 text-center">
                  <div className="text-[9px] text-slate-500 font-sans">Vị Trí</div>
                  <div className="font-black text-orange-700">{c.fullPosition}</div>
                </div>
                <div className="bg-slate-100 p-2 rounded-lg border border-slate-200 text-center">
                  <div className="text-[9px] text-slate-500 font-sans">Trọng Lượng</div>
                  <div className="font-black text-slate-900">{c.weight}</div>
                </div>
                <div className="bg-slate-100 p-2 rounded-lg border border-slate-200 text-center">
                  <div className="text-[9px] text-slate-500 font-sans">Tàu Chở</div>
                  <div className="font-bold text-blue-900 text-[10px] truncate">{c.vessel}</div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[11px] text-slate-500 font-sans font-bold">
                <span>Kiểm tra: {c.lastInspection}</span>
                <span className="text-orange-600 font-black group-hover:underline flex items-center gap-0.5">
                  Xem chi tiết
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── ROOT COMPONENT (List → Detail navigation) ───────────────────────────────
export default function ContainerDetail() {
  const [selectedContainer, setSelectedContainer] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans bg-slate-50 min-h-screen text-slate-900 relative">

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-amber-100 text-amber-950 border-2 border-amber-400 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-3 z-[100] animate-bounce">
          <span className="text-amber-600">●</span>{toastMessage}
        </div>
      )}

      {selectedContainer ? (
        <DetailView
          container={selectedContainer}
          onBack={() => setSelectedContainer(null)}
          showToast={showToast}
        />
      ) : (
        <ListView onSelect={setSelectedContainer} />
      )}
    </div>
  )
}
