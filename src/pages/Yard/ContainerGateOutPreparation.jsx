import React, { useState } from 'react'

// ─── GATE-OUT REQUEST LIST (simulated from Gate Staff notifications) ───────────
const GATE_OUT_REQUESTS = [
  {
    id: 'GOR-001',
    containerId: 'CAIU1234567',
    containerType: '40FT HC',
    cargoType: 'Hàng Khô Thông Thường',
    driver: 'Nguyễn Văn A',
    truck: '51C-123.45',
    gate: 'Cổng A',
    booking: 'BK-20260812-001',
    requestedTime: '16:30',
    position: 'B-04-10-2',
    block: 'B', bay: '04', row: '10', tier: '2',
    stackLevel: 'Tầng 2',
    blockingContainers: 0,
    rtgCrane: 'RTG-05',
    rtgOperator: 'Trần Văn Hùng',
    sealNumber: 'SL-99210',
    weight: '26,500 KG',
    carrier: 'Hapag-Lloyd',
    vessel: 'EVER GIVEN',
    condition: 'Tốt (Không Hư Hỏng)',
    status: 'CHỜ TIẾP NHẬN',
    urgency: 'HIGH',
    arrivalTime: '16:05',
  },
  {
    id: 'GOR-002',
    containerId: 'HLBU7781920',
    containerType: '40FT HC',
    cargoType: 'Nông Sản Đóng Thùng Xuất Khẩu',
    driver: 'Trần Văn Hải',
    truck: '79B-441.22',
    gate: 'Cổng B',
    booking: 'BK-20260812-002',
    requestedTime: '14:00',
    position: 'A-03-01-1',
    block: 'A', bay: '03', row: '01', tier: '1',
    stackLevel: 'Tầng 1',
    blockingContainers: 0,
    rtgCrane: 'RTG-02',
    rtgOperator: 'Lê Văn Thành',
    sealNumber: 'SL-11092',
    weight: '24,000 KG',
    carrier: 'Hapag-Lloyd',
    vessel: 'NEXUS CARRIER',
    condition: 'Tốt (Không Hư Hỏng)',
    status: 'CHỜ TIẾP NHẬN',
    urgency: 'CRITICAL',
    arrivalTime: '13:48',
  },
  {
    id: 'GOR-003',
    containerId: 'ONEY3399102',
    containerType: '40FT HC',
    cargoType: 'Linh Kiện Điện Tử & Bo Mạch',
    driver: 'Phạm Văn Tú',
    truck: '60A-889.11',
    gate: 'Cổng A',
    booking: 'BK-20260812-005',
    requestedTime: '17:15',
    position: 'B-02-01-1',
    block: 'B', bay: '02', row: '01', tier: '1',
    stackLevel: 'Tầng 1',
    blockingContainers: 1,
    rtgCrane: 'RTG-03',
    rtgOperator: 'Nguyễn Văn B',
    sealNumber: 'SL-77881',
    weight: '27,300 KG',
    carrier: 'ONE Ocean Network',
    vessel: 'ONE EXPONENT',
    condition: 'Tốt (Không Hư Hỏng)',
    status: 'ĐANG THỰC HIỆN',
    urgency: 'MEDIUM',
    arrivalTime: '16:55',
  },
  {
    id: 'GOR-004',
    containerId: 'MSCU9901123',
    containerType: '20FT ST',
    cargoType: 'Phụ Tùng Xe Máy Xuất Khẩu',
    driver: 'Võ Văn Bình',
    truck: '43A-321.99',
    gate: 'Cổng B',
    booking: 'BK-20260812-009',
    requestedTime: '18:00',
    position: 'B-04-02-1',
    block: 'B', bay: '04', row: '02', tier: '1',
    stackLevel: 'Tầng 1',
    blockingContainers: 0,
    rtgCrane: 'RTG-01',
    rtgOperator: 'Hoàng Văn Sơn',
    sealNumber: 'SL-33910',
    weight: '18,500 KG',
    carrier: 'CMA CGM Logistics',
    vessel: 'MSC GULSUN',
    condition: 'Tốt (Không Hư Hỏng)',
    status: 'CHỜ TIẾP NHẬN',
    urgency: 'LOW',
    arrivalTime: '17:40',
  },
]

const URGENCY_CFG = {
  CRITICAL: { cls: 'bg-red-200 text-red-950 border-red-500',       label: '🔴 KHẨN CẤP' },
  HIGH:     { cls: 'bg-orange-100 text-orange-950 border-orange-400', label: '🟠 ƯU TIÊN CAO' },
  MEDIUM:   { cls: 'bg-amber-100 text-amber-950 border-amber-400',   label: '🟡 TRUNG BÌNH' },
  LOW:      { cls: 'bg-emerald-100 text-emerald-950 border-emerald-400', label: '🟢 THÔNG THƯỜNG' },
}

const STATUS_CFG = {
  'CHỜ TIẾP NHẬN':   { cls: 'bg-amber-100 text-amber-950 border-amber-400',    icon: '⏳' },
  'ĐANG THỰC HIỆN':  { cls: 'bg-blue-100 text-blue-950 border-blue-400',       icon: '⚡' },
  'HOÀN THÀNH':      { cls: 'bg-emerald-100 text-emerald-950 border-emerald-400', icon: '✓' },
}

// ─── DETAIL EXECUTION VIEW ────────────────────────────────────────────────────
function GateOutDetailView({ request, onBack, showToast }) {
  const [pickupStarted, setPickupStarted] = useState(false)
  const [isLoadedConfirmed, setIsLoadedConfirmed] = useState(false)
  const [flowStep, setFlowStep] = useState(0) // 0=idle, 1=pickup, 2=arrived, 3=verify, 4=done
  const [checklist, setChecklist] = useState({ correctContainer: false, correctSeal: false, noDamage: false })
  const [confirmedPos, setConfirmedPos] = useState(request.position)

  const allChecksPassed = checklist.correctContainer && checklist.correctSeal && checklist.noDamage

  const handleStartPickup = () => {
    setPickupStarted(true)
    setFlowStep(1)
    showToast(`🚛 BẮT ĐẦU PICKUP: Cẩu ${request.rtgCrane} đang di chuyển tới ô ${request.position} để gắp container ${request.containerId}.`)
  }

  const handleMarkArrived = () => {
    setFlowStep(2)
    showToast(`📍 CẨU ĐÃ ĐẾN VỊ TRÍ ${request.position}. Đang tiến hành gắp container ${request.containerId}.`)
  }

  const handleStartVerify = () => {
    setFlowStep(3)
    showToast(`🔍 BẮT ĐẦU ĐỐI SOÁT: Xác nhận mã container, số chì niêm phong và tình trạng vỏ trước khi cẩu lên xe.`)
  }

  const handleConfirmLoaded = () => {
    setIsLoadedConfirmed(true)
    setFlowStep(4)
    showToast(`🟢 XÁC NHẬN CẨU LÊN XE THÀNH CÔNG! Đã phát thông báo tới Nhân viên ${request.gate} sẵn sàng cho xe xuất cổng.`)
  }

  const FLOW_STEPS = ['Chờ Bắt Đầu', 'Cẩu Đang Di Chuyển', 'Đến Vị Trí', 'Đối Soát Container', 'Hoàn Thành']

  return (
    <div className="flex flex-col gap-6">
      {/* Back Button */}
      <button onClick={onBack}
        className="flex items-center gap-2 text-xs font-black text-slate-700 hover:text-orange-700 transition-colors w-fit font-sans">
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Quay lại Danh Sách Yêu Cầu Xuất Cổng
      </button>

      {/* Header */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs font-mono">
            <span className="font-heading font-black text-orange-600 tracking-wider">NEXUSPORT</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 font-bold">Chuẩn Bị Xuất Cổng</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-extrabold">{request.containerId}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-heading text-3xl font-black text-slate-900 font-mono">{request.containerId}</h2>
            <span className="px-3.5 py-1 bg-emerald-100 text-emerald-950 border-2 border-emerald-400 font-mono font-black text-xs rounded-xl flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              TÀI XẾ ĐÃ Ở CỔNG 🟢
            </span>
            {URGENCY_CFG[request.urgency] && (
              <span className={`px-3 py-1 border-2 font-mono font-black text-xs rounded-xl ${URGENCY_CFG[request.urgency].cls}`}>
                {URGENCY_CFG[request.urgency].label}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-0.5">Nhận lệnh từ Gate Staff — Điều phối RTG cẩu container từ bãi lên xe tải và xác nhận hoàn tất.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-emerald-700 uppercase font-sans font-black">TRỰC TUYẾN (LIVE)</span>
        </div>
      </div>

      {/* SUCCESS BANNER */}
      {flowStep === 4 && (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-6 shadow-md space-y-3 font-mono">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-600 text-4xl">task_alt</span>
            <div>
              <div className="font-black text-emerald-950 text-base">🟢 XÁC NHẬN CẨU LÊN XE THÀNH CÔNG</div>
              <div className="text-xs text-emerald-900 font-extrabold font-sans mt-0.5">
                Đã cẩu container lên xe tải thành công. Nhân viên cổng có thể cho xe xuất cổng.
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 font-sans">
            {[
              ['Trạng Thái Container', 'TRONG BÃI ➔ SẴN SÀNG XUẤT', 'text-emerald-950 font-mono'],
              ['Xe Tải', request.truck, 'text-slate-900'],
              ['Thông Báo Cổng', `Đã gửi tới ${request.gate}`, 'text-blue-900'],
              ['Người Xác Nhận', 'Nguyễn Văn Nam (Nhân Viên Bãi)', 'text-purple-900'],
            ].map(([label, val, cls]) => (
              <div key={label} className="bg-white p-3 rounded-xl border border-emerald-300">
                <span className="text-[10px] text-slate-500 font-bold block">{label}</span>
                <strong className={`font-black text-xs ${cls}`}>{val}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FLOW PROGRESS BAR ── */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="text-[10px] text-slate-500 uppercase font-mono font-black mb-3">TIẾN TRÌNH THỰC HIỆN LỆNH XUẤT CỔNG:</div>
        <div className="flex items-center gap-0">
          {FLOW_STEPS.map((step, idx) => (
            <React.Fragment key={idx}>
              <div className={`flex-1 py-2 px-1 text-center rounded-lg border-2 text-[10px] font-black font-mono transition-all ${
                flowStep === idx ? 'bg-orange-500 text-white border-orange-600 shadow-md'
                : flowStep > idx  ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                : 'bg-white text-slate-400 border-slate-200'
              }`}>
                {flowStep > idx ? '✓ ' : ''}{step}
              </div>
              {idx < FLOW_STEPS.length - 1 && <div className="w-3 h-0.5 bg-slate-300 flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── 2-COLUMN: REQUEST INFO + EQUIPMENT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Gate-Out Request Info */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
            <span className="material-symbols-outlined text-orange-600">output</span>
            THÔNG TIN TÀI XẾ & YÊU CẦU XUẤT CỔNG
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            {[
              ['Mã Container', request.containerId, 'text-slate-900 text-base'],
              ['Loại Container', request.containerType, 'text-slate-900'],
              ['Tài Xế (Driver)', request.driver, 'text-slate-900'],
              ['Biển Số Xe (Truck)', request.truck, 'text-blue-900'],
              ['Cổng Đang Đợi', request.gate, 'text-emerald-900'],
              ['Tàu Chở / Hãng', `${request.vessel} · ${request.carrier}`, 'text-purple-900'],
              ['Mã Booking', request.booking, 'text-slate-900'],
              ['Thời Gian Yêu Cầu', request.requestedTime, 'text-slate-900'],
            ].map(([label, val, cls]) => (
              <div key={label} className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block">{label}</span>
                <strong className={`font-black ${cls}`}>{val}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Position Info + Equipment + Navigate */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
              <span className="material-symbols-outlined text-blue-600">local_shipping</span>
              VỊ TRÍ CONTAINER & CẨU RTG
            </h3>

            {/* Position Breakdown */}
            <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-3 space-y-2">
              <div className="text-[10px] font-mono font-black text-orange-950 uppercase">VỊ TRÍ Ô BÃI HIỆN TẠI:</div>
              <div className="grid grid-cols-4 gap-2 font-mono text-xs text-center">
                {[['Khu', request.block], ['Dãy (Bay)', request.bay], ['Hàng (Row)', request.row], ['Tầng (Tier)', request.tier]].map(([k, v]) => (
                  <div key={k} className="bg-white rounded-xl border border-orange-200 p-2">
                    <div className="text-[9px] text-slate-500 font-sans">{k}</div>
                    <div className="font-black text-orange-950">{v}</div>
                  </div>
                ))}
              </div>
              <div className="text-center font-mono font-black text-lg text-orange-950">{request.position}</div>
            </div>

            {/* Equipment */}
            <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 space-y-2 font-mono text-xs">
              <div className="text-[10px] text-slate-600 uppercase font-sans font-black flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-orange-600">precision_manufacturing</span>
                THIẾT BỊ CẨU ĐƯỢC ĐIỀU PHỐI:
              </div>
              <div className="flex justify-between items-center">
                <strong className="text-orange-900 font-black text-base">{request.rtgCrane}</strong>
                <span className="px-2 py-0.5 rounded border text-[10px] font-black bg-emerald-100 text-emerald-950 border-emerald-400">Sẵn Sàng</span>
              </div>
              <div className="text-[11px] text-slate-700 font-sans font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-slate-500">person</span>
                Thợ điều khiển: <strong className="text-slate-900">{request.rtgOperator}</strong>
              </div>
              <div className="text-[11px] text-slate-700 font-sans font-bold">
                Tầng xếp: <strong>{request.stackLevel}</strong> ·
                Cont đè: <strong className={request.blockingContainers > 0 ? 'text-red-700' : 'text-emerald-700'}>
                  {request.blockingContainers} container
                </strong>
              </div>
            </div>

            {/* Mini-map route */}
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2 font-mono text-xs text-white">
              <div className="text-amber-400 font-black text-[10px] uppercase">SƠ ĐỒ CHỈ ĐƯỜNG ĐIỆN TỬ:</div>
              <div className="bg-slate-800 p-2.5 rounded border border-slate-700 text-slate-300 text-[11px]">
                Vị trí Nhân viên bãi ➔ Đi thẳng 80m qua Rãnh {request.block} ➔ Rẽ vào {request.block}-{request.bay} ➔ Ô {request.position}
              </div>
              <div className="text-emerald-400 font-bold text-[10px]">📍 Khoảng cách ước tính: ~{request.block === 'B' ? '120' : '85'} mét</div>
            </div>
          </div>

          {/* Primary CTA: Start Pickup */}
          {flowStep === 0 && (
            <button onClick={handleStartPickup}
              className="w-full h-14 bg-orange-100 hover:bg-orange-200 text-orange-950 border-2 border-orange-400 font-black text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all">
              <span className="material-symbols-outlined text-xl">play_arrow</span>
              [ BẮT ĐẦU CẨU PICKUP CONTAINER ]
            </button>
          )}
          {flowStep === 1 && (
            <button onClick={handleMarkArrived}
              className="w-full h-14 bg-purple-100 hover:bg-purple-200 text-purple-950 border-2 border-purple-400 font-black text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all">
              <span className="material-symbols-outlined text-xl">location_on</span>
              [ CẨU ĐÃ ĐẾN VỊ TRÍ CONTAINER ]
            </button>
          )}
          {flowStep === 2 && (
            <button onClick={handleStartVerify}
              className="w-full h-14 bg-blue-100 hover:bg-blue-200 text-blue-950 border-2 border-blue-400 font-black text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all">
              <span className="material-symbols-outlined text-xl">fact_check</span>
              [ BẮT ĐẦU ĐỐI SOÁT CONTAINER ]
            </button>
          )}
          {flowStep >= 3 && flowStep < 4 && (
            <div className="p-3 bg-blue-100 text-blue-950 border-2 border-blue-400 rounded-xl font-black text-xs text-center font-mono">
              ⚡ Đang tiến hành đối soát container — Hoàn thành checklist bên dưới
            </div>
          )}
          {flowStep === 4 && (
            <div className="p-3 bg-emerald-100 text-emerald-950 border-2 border-emerald-400 rounded-xl font-black text-xs text-center font-mono">
              ✓ ĐÃ HOÀN THÀNH — Container đã cẩu lên xe {request.truck}
            </div>
          )}
        </div>
      </div>

      {/* ── CONTAINER VERIFICATION (shows when flowStep >= 3) ── */}
      {flowStep >= 3 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-5">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
            <span className="material-symbols-outlined text-purple-600">fact_check</span>
            ĐỐI SOÁT CHÌ NIÊM PHONG & VỎ CONTAINER THỰC ĐỊA
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: container info to verify */}
            <div className="space-y-3 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block">Mã Container</span>
                  <strong className="text-slate-900 font-black text-sm">{request.containerId}</strong>
                </div>
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block">Số Chì Niêm Phong</span>
                  <strong className="text-purple-900 font-black">{request.sealNumber}</strong>
                </div>
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block">Trọng Lượng</span>
                  <strong className="text-slate-900 font-bold">{request.weight}</strong>
                </div>
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block">Tình Trạng Vỏ</span>
                  <strong className="text-emerald-900 font-bold font-sans text-[11px]">{request.condition}</strong>
                </div>
              </div>
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-[11px] text-slate-600 font-sans">
                📷 Ảnh tự động từ camera cẩu {request.rtgCrane} đã lưu vào Nhật ký xuất bãi.
              </div>
            </div>

            {/* Right: checklist + confirm */}
            <div className="space-y-3 font-sans">
              <div className="text-xs font-extrabold text-slate-900 uppercase font-mono">CHECKLIST XÁC NHẬN THỰC ĐỊA:</div>
              <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border font-bold text-sm transition-all ${checklist.correctContainer ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'}`}>
                <input type="checkbox" checked={checklist.correctContainer} onChange={e => setChecklist(p => ({ ...p, correctContainer: e.target.checked }))} className="w-5 h-5 accent-emerald-600" />
                <span>☑ Đúng mã container: <strong className="font-mono">{request.containerId}</strong></span>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border font-bold text-sm transition-all ${checklist.correctSeal ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'}`}>
                <input type="checkbox" checked={checklist.correctSeal} onChange={e => setChecklist(p => ({ ...p, correctSeal: e.target.checked }))} className="w-5 h-5 accent-emerald-600" />
                <span>☑ Số chì <strong className="font-mono">{request.sealNumber}</strong> nguyên vẹn chưa bị phá</span>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border font-bold text-sm transition-all ${checklist.noDamage ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'}`}>
                <input type="checkbox" checked={checklist.noDamage} onChange={e => setChecklist(p => ({ ...p, noDamage: e.target.checked }))} className="w-5 h-5 accent-emerald-600" />
                <span>☑ Không hư hỏng móp méo nặng vỏ container</span>
              </label>

              <button onClick={handleConfirmLoaded} disabled={!allChecksPassed || flowStep === 4}
                className={`w-full h-16 rounded-xl font-black text-base flex items-center justify-center gap-2 border-2 transition-all ${
                  allChecksPassed && flowStep < 4
                    ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-emerald-400 cursor-pointer shadow-md'
                    : flowStep === 4
                      ? 'bg-emerald-100 text-emerald-950 border-emerald-400 cursor-default'
                      : 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed'
                }`}>
                <span className="material-symbols-outlined text-2xl">check_circle</span>
                {flowStep === 4 ? '✓ ĐÃ XÁC NHẬN HOÀN TẤT' : '[ XÁC NHẬN ĐÃ CẨU CONTAINER LÊN XE ]'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── LIST VIEW ────────────────────────────────────────────────────────────────
function GateOutListView({ onSelect }) {
  const [search, setSearch] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState('All')

  const filtered = GATE_OUT_REQUESTS.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = r.containerId.toLowerCase().includes(q) || r.driver.toLowerCase().includes(q) || r.truck.toLowerCase().includes(q) || r.gate.toLowerCase().includes(q)
    const matchUrgency = urgencyFilter === 'All' || r.urgency === urgencyFilter
    return matchSearch && matchUrgency
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1 text-xs font-mono">
          <span className="font-heading font-black text-orange-600 tracking-wider">NEXUSPORT</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-extrabold">Chuẩn Bị Xuất Cổng</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-heading text-3xl font-black text-slate-900">Danh Sách Yêu Cầu Xuất Cổng</h2>
          <span className="px-3.5 py-1 bg-emerald-100 text-emerald-950 border-2 border-emerald-400 font-mono font-black text-xs rounded-xl flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            {GATE_OUT_REQUESTS.filter(r => r.status === 'CHỜ TIẾP NHẬN').length} TÀI XẾ ĐANG Ở CỔNG
          </span>
        </div>
        <p className="text-xs text-slate-600 mt-0.5">Nhận lệnh từ Gate Staff khi xe tải đã check-in tại cổng. Nhấn vào một yêu cầu để điều phối cẩu RTG và thực hiện xuất bãi.</p>
      </div>

      {/* Search & Filter */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm Mã Container / Tài Xế / Biển Số Xe / Cổng..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:border-slate-900 uppercase" />
        </div>
        <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)}
          className="px-3 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:outline-none">
          <option value="All">Mức Ưu Tiên: Tất Cả</option>
          <option value="CRITICAL">🔴 Khẩn Cấp</option>
          <option value="HIGH">🟠 Ưu Tiên Cao</option>
          <option value="MEDIUM">🟡 Trung Bình</option>
          <option value="LOW">🟢 Thông Thường</option>
        </select>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-2 bg-white rounded-2xl border-2 border-slate-200 p-12 text-center text-slate-500 font-sans font-bold">
            Không tìm thấy yêu cầu xuất cổng phù hợp.
          </div>
        ) : filtered.map(r => {
          const urg = URGENCY_CFG[r.urgency]
          const st = STATUS_CFG[r.status] || STATUS_CFG['CHỜ TIẾP NHẬN']
          return (
            <button key={r.id} onClick={() => onSelect(r)}
              className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-sm hover:border-orange-400 hover:shadow-md cursor-pointer transition-all text-left group space-y-4 w-full">

              {/* Card Header */}
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-heading font-black text-slate-900 text-xl group-hover:text-orange-700 transition-colors font-mono">{r.containerId}</div>
                  <div className="text-[11px] text-slate-500 font-sans font-bold mt-0.5">{r.containerType} · {r.cargoType}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className={`px-2.5 py-0.5 rounded-full border font-black text-[10px] font-mono ${urg?.cls}`}>{urg?.label}</span>
                  <span className={`px-2.5 py-0.5 rounded-full border font-black text-[10px] font-mono ${st.cls}`}>{st.icon} {r.status}</span>
                </div>
              </div>

              {/* Driver & Gate info */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[9px] text-slate-500 font-sans block font-bold">Tài Xế</span>
                  <strong className="text-slate-900 font-bold font-sans text-[11px]">{r.driver}</strong>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[9px] text-slate-500 font-sans block font-bold">Xe Đầu Kéo</span>
                  <strong className="text-blue-900 font-black">{r.truck}</strong>
                </div>
                <div className="bg-orange-50 p-2.5 rounded-xl border border-orange-200">
                  <span className="text-[9px] text-slate-500 font-sans block font-bold">Vị Trí Container</span>
                  <strong className="text-orange-800 font-black">{r.position}</strong>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  <span className="text-[9px] text-slate-500 font-sans block font-bold">Cổng · Thời Gian Hẹn</span>
                  <strong className="text-emerald-900 font-black">{r.gate} · {r.requestedTime}</strong>
                </div>
              </div>

              {/* RTG Equipment */}
              <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[11px] font-sans">
                <span className="text-slate-500 font-bold">
                  Cẩu: <strong className="text-orange-800">{r.rtgCrane}</strong> · Thợ: <strong className="text-slate-700">{r.rtgOperator}</strong>
                </span>
                <span className="text-orange-600 font-black group-hover:underline flex items-center gap-0.5">
                  Thực Hiện Xuất Bãi
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

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────
export default function ContainerGateOutPreparation() {
  const [selectedRequest, setSelectedRequest] = useState(null)
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

      {selectedRequest ? (
        <GateOutDetailView
          request={selectedRequest}
          onBack={() => setSelectedRequest(null)}
          showToast={showToast}
        />
      ) : (
        <GateOutListView onSelect={setSelectedRequest} />
      )}
    </div>
  )
}
