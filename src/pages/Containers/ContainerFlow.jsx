import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ContainerFlow() {
  const navigate = useNavigate()
  const [filterStatus, setFilterStatus] = useState('Tất cả')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContainer, setSelectedContainer] = useState({
    id: 'MSCU1234567',
    type: '40ft Dry (Hàng khô)',
    task: 'Lấy container (Pickup)',
    vehicle: 'TRK-001',
    plate: '43C-123.45',
    driver: 'Nguyễn Văn A',
    location: 'Cổng A (Gate A)',
    destination: 'Khối bãi B',
    position: 'B-12-04',
    status: 'Đang thực hiện',
    statusClass: 'bg-blue-100 text-blue-800 border-blue-300',
    eta: '3 phút',
    timelineStep: 5
  })

  // 1. KPI Stats
  const kpis = {
    waiting: 18,
    assigned: 12,
    inOperation: 8,
    completedToday: 42,
    delayed: 3
  }

  // 2. Container List
  const containersList = [
    {
      id: 'MSCU1234567',
      type: '40ft Dry',
      task: 'Lấy cont (Pickup)',
      vehicle: 'TRK-001',
      plate: '43C-123.45',
      driver: 'Nguyễn Văn A',
      location: 'Cổng A',
      destination: 'Khối bãi B',
      position: 'B-12-04',
      status: 'Đang thực hiện',
      statusClass: 'bg-blue-100 text-blue-800 border-blue-300',
      eta: '3 phút',
      waitingTime: '10 phút',
      timelineStep: 5
    },
    {
      id: 'MSCU7654321',
      type: '20ft Dry',
      task: 'Hạ cont (Delivery)',
      vehicle: 'TRK-008',
      plate: '15C-882.19',
      driver: 'Phạm Văn D',
      location: 'Cổng vào',
      destination: 'Khối bãi C',
      position: 'C-05-02',
      status: 'Trễ hạn',
      statusClass: 'bg-red-100 text-red-700 border-red-300 animate-pulse',
      eta: '18 phút',
      waitingTime: '18 phút',
      timelineStep: 3,
      delayReason: 'Xe tải di chuyển chậm do nghẽn luồng Cổng In'
    },
    {
      id: 'EVER991203-4',
      type: '40ft Reefer (Lạnh)',
      task: 'Hạ cont (Delivery)',
      vehicle: 'TRK-002',
      plate: '43C-234.56',
      driver: 'Trần Văn B',
      location: 'Cổng vào',
      destination: 'Khối bãi C',
      position: 'C-02-01',
      status: 'Đang chờ',
      statusClass: 'bg-amber-100 text-amber-800 border-amber-300',
      eta: '8 phút',
      waitingTime: '8 phút',
      timelineStep: 2
    },
    {
      id: 'HLBU993210-5',
      type: '40ft Dry',
      task: 'Lấy cont (Pickup)',
      vehicle: 'TRK-003',
      plate: '43C-345.67',
      driver: 'Lê Văn C',
      location: 'Khối bãi A',
      destination: 'Bến tàu D01',
      position: 'D01-B02',
      status: 'Hoàn thành',
      statusClass: 'bg-green-100 text-green-800 border-green-300',
      eta: 'Hoàn tất',
      waitingTime: '0 phút',
      timelineStep: 7
    }
  ]

  // 3. Container Volume Breakdown by Area
  const areaBreakdown = [
    { area: 'Cổng A (Gate A)', count: 12, percentage: '20%' },
    { area: 'Khối bãi A (Hàng khô)', count: 18, percentage: '30%' },
    { area: 'Khối bãi B (Hàng nhập)', count: 27, percentage: '45%' },
    { area: 'Khối bãi C (Lạnh Reefer)', count: 8, percentage: '15%' },
  ]

  const filteredContainers = containersList.filter(c => {
    if (filterStatus === 'Lấy Cont') return c.task.includes('Lấy')
    if (filterStatus === 'Hạ Cont') return c.task.includes('Hạ')
    if (filterStatus === 'Đang chờ') return c.status === 'Đang chờ'
    if (filterStatus === 'Đã chỉ định') return c.status === 'Đã chỉ định'
    if (filterStatus === 'Đang thực hiện') return c.status === 'Đang thực hiện'
    if (filterStatus === 'Hoàn thành') return c.status === 'Hoàn thành'
    if (filterStatus === 'Trễ hạn') return c.status === 'Trễ hạn'

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return c.id.toLowerCase().includes(q) || c.vehicle.toLowerCase().includes(q) || c.destination.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="p-8 w-full font-sans flex flex-col gap-6 relative">
      
      {/* HEADER BAR */}
      <div className="flex justify-between items-center bg-white border border-chalk rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase">
              QUẢN LÝ TIẾN TRÌNH CONTAINER
            </span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
              🟢 THỜI GIAN THỰC
            </span>
          </div>
          <h2 className="font-heading text-3xl text-carbon font-extrabold mt-1">Quản Lý Luồng Container</h2>
          <p className="text-xs text-slate mt-0.5">Theo dõi vòng đời container từ lúc chờ xử lý ➔ chỉ định ➔ cẩu di chuyển ➔ hoàn tất.</p>
        </div>

        <button
          onClick={() => navigate('/dispatch')}
          className="h-11 px-5 bg-signal-orange text-white rounded-xl font-extrabold text-xs hover:opacity-95 transition-opacity shadow-lg flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">alt_route</span>
          ĐIỀU PHỐI PHƯƠNG TIỆN
        </button>
      </div>

      {/* KPI BAR (5 CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        
        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Đang Chờ Xử Lý</span>
          <div className="text-3xl font-extrabold text-amber-500 font-mono">{kpis.waiting}</div>
          <span className="text-[11px] text-slate font-bold">Container hàng đợi</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Đã Chỉ Định Xe</span>
          <div className="text-3xl font-extrabold text-blue-600 font-mono">{kpis.assigned}</div>
          <span className="text-[11px] text-blue-600 font-bold">Đã có lệnh điều động</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Đang Cẩu / Di Chuyển</span>
          <div className="text-3xl font-extrabold text-purple-600 font-mono">{kpis.inOperation}</div>
          <span className="text-[11px] text-purple-600 font-bold">Đang làm nhiệm vụ</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Hoàn Thành Hôm Nay</span>
          <div className="text-3xl font-extrabold text-green-600 font-mono">{kpis.completedToday}</div>
          <span className="text-[11px] text-green-600 font-bold">Đã thông quan / giao</span>
        </div>

        <div className="bg-white border-2 border-red-400 rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Container Bị Trễ</span>
          <div className="text-3xl font-extrabold text-red-600 font-mono">{kpis.delayed}</div>
          <span className="text-[11px] text-red-600 font-bold">Cần kiểm tra sự cố</span>
        </div>

      </div>

      {/* PIPELINE FLOW VISUALIZATION (SƠ ĐỒ LUỒNG PIPELINE) */}
      <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
        
        <div className="flex justify-between items-center border-b border-chalk pb-3">
          <div>
            <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider">TIẾN TRÌNH VẬN HÀNH CONTAINER</span>
            <h3 className="font-heading text-lg font-extrabold text-carbon">Container Flow Pipeline</h3>
          </div>
          <span className="text-xs font-mono text-slate font-bold">Tổng số: 80 TEU</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
          
          <div className="bg-amber-50/70 border-2 border-amber-400 p-4 rounded-xl space-y-2">
            <div className="flex justify-between items-center font-bold text-amber-900">
              <span>1. ĐANG CHỜ XỬ LÝ</span>
              <span className="text-base font-extrabold">{kpis.waiting}</span>
            </div>
            <p className="text-[11px] text-amber-800 font-sans">Container đang đỗ tại cổng chờ chỉ định xe tải</p>
          </div>

          <div className="bg-blue-50/70 border-2 border-blue-400 p-4 rounded-xl space-y-2">
            <div className="flex justify-between items-center font-bold text-blue-900">
              <span>2. ĐÃ CHỈ ĐỊNH XE</span>
              <span className="text-base font-extrabold">{kpis.assigned}</span>
            </div>
            <p className="text-[11px] text-blue-800 font-sans">Đã gán xe tải nhận lệnh di chuyển</p>
          </div>

          <div className="bg-purple-50/70 border-2 border-purple-400 p-4 rounded-xl space-y-2">
            <div className="flex justify-between items-center font-bold text-purple-900">
              <span>3. ĐANG CẨU & VẬN CHUYỂN</span>
              <span className="text-base font-extrabold">{kpis.inOperation}</span>
            </div>
            <p className="text-[11px] text-purple-800 font-sans">Cẩu RTG/Reach Stacker đang bốc dỡ</p>
          </div>

          <div className="bg-green-50/70 border-2 border-green-500 p-4 rounded-xl space-y-2">
            <div className="flex justify-between items-center font-bold text-green-900">
              <span>4. HOÀN THÀNH</span>
              <span className="text-base font-extrabold">{kpis.completedToday}</span>
            </div>
            <p className="text-[11px] text-green-800 font-sans">Container đã hạ bãi hoặc xuất cổng ra</p>
          </div>

        </div>

      </div>

      {/* DELAYED CONTAINERS SECTION */}
      <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 space-y-3">
        <div className="flex justify-between items-center">
          <strong className="text-red-900 font-extrabold text-sm uppercase flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
            DANH SÁCH CONTAINER BỊ CHẬM / TRỄ HẠN
          </strong>
          <span className="text-xs font-bold text-red-700 font-mono">3 Container bị trễ</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-red-300 shadow-sm space-y-2 text-xs font-mono">
            <div className="flex justify-between font-bold">
              <span className="text-red-600">🔴 MSCU7654321</span>
              <span className="text-slate">Trễ: 18 phút</span>
            </div>
            <p className="text-[11px] text-graphite font-sans">Lý do: Xe TRK-008 di chuyển chậm tại Cổng In do quét OCR lỗi.</p>
            <button
              onClick={() => navigate('/dispatch')}
              className="w-full h-8 bg-red-600 text-white rounded-lg font-bold text-[11px] hover:bg-red-700 transition-colors shadow"
            >
              XEM LỆNH ĐIỀU PHỐI ➔
            </button>
          </div>

          <div className="bg-white p-4 rounded-xl border border-red-300 shadow-sm space-y-2 text-xs font-mono">
            <div className="flex justify-between font-bold">
              <span className="text-red-600">🔴 HLBU223910</span>
              <span className="text-slate">Trễ: 14 phút</span>
            </div>
            <p className="text-[11px] text-graphite font-sans">Lý do: Hàng đợi cẩu RTG-02 Khối B quá tải.</p>
            <button
              onClick={() => navigate('/dispatch')}
              className="w-full h-8 bg-red-600 text-white rounded-lg font-bold text-[11px] hover:bg-red-700 transition-colors shadow"
            >
              XEM LỆNH ĐIỀU PHỐI ➔
            </button>
          </div>

          <div className="bg-white p-4 rounded-xl border border-red-300 shadow-sm space-y-2 text-xs font-mono">
            <div className="flex justify-between font-bold">
              <span className="text-amber-600">🟡 EVER881203</span>
              <span className="text-slate">Chờ: 12 phút</span>
            </div>
            <p className="text-[11px] text-graphite font-sans">Lý do: Chờ tài xế xác nhận mã QR tại cổng.</p>
            <button
              onClick={() => navigate('/dispatch')}
              className="w-full h-8 bg-carbon text-white rounded-lg font-bold text-[11px] hover:bg-black transition-colors shadow"
            >
              XEM LỆNH ĐIỀU PHỐI ➔
            </button>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        
        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1.5 text-xs font-bold">
          {['Tất cả', 'Lấy Cont', 'Hạ Cont', 'Đang chờ', 'Đã chỉ định', 'Đang thực hiện', 'Hoàn thành', 'Trễ hạn'].map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                filterStatus === f ? 'bg-carbon text-white shadow-sm' : 'bg-fog text-slate hover:text-carbon border border-chalk'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate text-base">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm Container ID, Mã Xe, Lộ trình..."
            className="w-full pl-9 pr-4 py-2 bg-fog border border-chalk rounded-xl text-xs font-medium focus:outline-none focus:border-signal-orange"
          />
        </div>

      </div>

      {/* MAIN CONTAINER TABLE & TIMELINE SPLIT VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT SECTION: CONTAINER TABLE (7 cols ~58%) */}
        <div className="lg:col-span-7 bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
          
          <div className="flex justify-between items-center border-b border-chalk pb-3">
            <h3 className="font-heading text-lg font-extrabold text-carbon">Bảng Tiến Trình Luồng Container</h3>
            <span className="text-xs text-slate font-mono">Nhấn vào dòng để xem vòng đời</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-fog text-slate font-bold uppercase text-[10px] border-b border-chalk">
                  <th className="py-3 px-3">Mã Container</th>
                  <th className="py-3 px-3">Phân Loại</th>
                  <th className="py-3 px-3">Nhiệm Vụ</th>
                  <th className="py-3 px-3">Xe Đảm Nhận</th>
                  <th className="py-3 px-3">Vị Trí ➔ Điểm Đến</th>
                  <th className="py-3 px-3 text-right">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk font-medium font-mono">
                {filteredContainers.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedContainer(c)}
                    className={`cursor-pointer transition-colors ${
                      selectedContainer.id === c.id ? 'bg-orange-50/80 border-l-4 border-l-signal-orange' : 'hover:bg-fog/60'
                    }`}
                  >
                    <td className="py-3.5 px-3 font-bold text-carbon">{c.id}</td>
                    <td className="py-3.5 px-3 font-sans text-graphite">{c.type}</td>
                    <td className="py-3.5 px-3 font-sans text-signal-orange font-bold">{c.task}</td>
                    <td className="py-3.5 px-3 font-bold text-carbon">{c.vehicle}</td>
                    <td className="py-3.5 px-3 font-sans text-graphite">
                      {c.location} ➔ <strong className="text-carbon">{c.destination}</strong>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${c.statusClass}`}>
                        ● {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

        {/* RIGHT SECTION: CONTAINER TIMELINE STEPPER & AREA BREAKDOWN (5 cols ~42%) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* CONTAINER LIFECYCLE TIMELINE STEPPER */}
          {selectedContainer && (
            <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
              
              <div className="border-b border-chalk pb-3">
                <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider">CONTAINER TIMELINE</span>
                <h3 className="font-heading text-xl font-extrabold text-carbon">{selectedContainer.id}</h3>
                <p className="text-xs text-slate font-mono mt-0.5">{selectedContainer.type} • {selectedContainer.task}</p>
              </div>

              <div className="bg-fog p-4 rounded-xl border border-chalk space-y-2 text-xs font-mono">
                <div className="flex justify-between"><span className="text-slate font-sans">Xe đảm nhận:</span><strong>{selectedContainer.vehicle} ({selectedContainer.plate})</strong></div>
                <div className="flex justify-between"><span className="text-slate font-sans">Tài xế:</span><strong>{selectedContainer.driver}</strong></div>
                <div className="flex justify-between"><span className="text-slate font-sans">Vị trí hiện tại:</span><strong>{selectedContainer.location}</strong></div>
                <div className="flex justify-between"><span className="text-slate font-sans">Vị trí hạ/xếp bãi:</span><strong className="text-signal-orange">{selectedContainer.position}</strong></div>
                <div className="flex justify-between"><span className="text-slate font-sans">Dự kiến hoàn thành:</span><strong>{selectedContainer.eta}</strong></div>
              </div>

              {/* TIMELINE STEPPER LIST */}
              <div className="space-y-3 pt-2 font-mono text-xs">
                <span className="text-[10px] font-bold text-slate uppercase font-sans block">CÁC BƯỚC TIẾN TRÌNH VÒNG ĐỜI</span>
                
                <div className="space-y-2.5 pl-2 border-l-2 border-chalk">
                  
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                    <span className="text-carbon font-bold">1. Đã xác nhận Booking</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                    <span className="text-carbon font-bold">2. Đã chỉ định vị trí bãi ({selectedContainer.position})</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                    <span className="text-carbon font-bold">3. Đã gán xe tải ({selectedContainer.vehicle})</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                    <span className="text-carbon font-bold">4. Đã phát lệnh điều động xe</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedContainer.timelineStep >= 5 ? 'bg-blue-600 text-white animate-pulse' : 'bg-chalk text-slate'}`}>●</span>
                    <span className={`font-bold ${selectedContainer.timelineStep >= 5 ? 'text-blue-600' : 'text-slate'}`}>5. Xe đang di chuyển tới container</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedContainer.timelineStep >= 6 ? 'bg-purple-600 text-white' : 'bg-chalk text-slate'}`}>○</span>
                    <span className={`font-bold ${selectedContainer.timelineStep >= 6 ? 'text-purple-600' : 'text-slate'}`}>6. Đang cẩu bãi RTG / xếp dỡ</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedContainer.timelineStep >= 7 ? 'bg-green-600 text-white' : 'bg-chalk text-slate'}`}>○</span>
                    <span className={`font-bold ${selectedContainer.timelineStep >= 7 ? 'text-green-600' : 'text-slate'}`}>7. Hoàn thành lệnh giao nhận</span>
                  </div>

                </div>
              </div>

              <button
                onClick={() => navigate('/dispatch')}
                className="w-full h-11 bg-signal-orange text-white rounded-full font-bold text-xs hover:opacity-95 transition-opacity shadow"
              >
                ĐIỀU PHỐI XE PHỤ TRÁCH ➔
              </button>

            </div>
          )}

          {/* AREA CONTAINER BREAKDOWN */}
          <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-heading text-base font-extrabold text-carbon border-b border-chalk pb-3">
              Phân Bổ Container Theo Khu Vực
            </h3>

            <div className="space-y-3 font-mono text-xs">
              {areaBreakdown.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between font-bold text-carbon">
                    <span>{item.area}</span>
                    <strong className="text-signal-orange">{item.count} TEU</strong>
                  </div>
                  <div className="w-full bg-fog h-2 rounded-full overflow-hidden border border-chalk">
                    <div className="h-full bg-signal-orange" style={{ width: item.percentage }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  )
}
