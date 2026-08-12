import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function TrafficManagement() {
  const navigate = useNavigate()
  const [timeAnalysis, setTimeAnalysis] = useState('Today') // 'Today' | '24h' | '7days'
  const [selectedCongestedArea, setSelectedCongestedArea] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  // 1. KPI Stats
  const kpis = {
    vehiclesInside: 42,
    waiting: 12,
    moving: 24,
    avgWaitTime: '8 phút',
    congestedAreas: 2
  }

  // 2. Traffic Flow Hourly Chart Data (24h)
  const trafficChartData = [
    { hour: '00:00', count: 12, status: 'normal' },
    { hour: '02:00', count: 8, status: 'normal' },
    { hour: '04:00', count: 14, status: 'normal' },
    { hour: '06:00', count: 28, status: 'moderate' },
    { hour: '08:00', count: 48, status: 'critical' }, // Peak hour
    { hour: '10:00', count: 42, status: 'critical' },
    { hour: '12:00', count: 32, status: 'moderate' },
    { hour: '14:00', count: 38, status: 'moderate' },
    { hour: '16:00', count: 45, status: 'critical' },
    { hour: '18:00', count: 26, status: 'normal' },
    { hour: '20:00', count: 18, status: 'normal' },
    { hour: '22:00', count: 15, status: 'normal' },
  ]

  // 3. Gate Traffic Data
  const gateStatus = {
    gateIn: {
      status: 'THÔNG THOÁNG',
      colorClass: 'text-green-600 bg-green-50 border-green-200',
      badgeClass: 'bg-green-500 text-white',
      current: 8,
      waiting: 2,
      avgWait: '3 phút'
    },
    gateOut: {
      status: 'ĐÔNG VỪA',
      colorClass: 'text-amber-600 bg-amber-50 border-amber-200',
      badgeClass: 'bg-amber-500 text-white',
      current: 12,
      waiting: 5,
      avgWait: '7 phút'
    }
  }

  // 4. Area Traffic & Congestion Map Nodes
  const areaTrafficList = [
    { id: 'Gate A', name: 'Cổng vào Phía Bắc (Gate A)', status: 'Thông thoáng', type: 'Normal', color: 'text-green-600', badgeBg: 'bg-green-500', vehicles: 8, waiting: 2, avgWait: '3 phút', cap: '35%' },
    { id: 'Block A', name: 'Khối bãi A (Hàng khô)', status: 'Thông thoáng', type: 'Normal', color: 'text-green-600', badgeBg: 'bg-green-500', vehicles: 5, waiting: 1, avgWait: '4 phút', cap: '78%' },
    { id: 'Block B', name: 'Khối bãi B (Hàng nhập)', status: 'Ún tắc nghiêm trọng', type: 'Critical', color: 'text-red-600', badgeBg: 'bg-red-600', vehicles: 12, waiting: 7, avgWait: '14 phút', cap: '94%' },
    { id: 'Block C', name: 'Khối bãi C (Reefer lạnh)', status: 'Đông vừa', type: 'Moderate', color: 'text-amber-600', badgeBg: 'bg-amber-500', vehicles: 6, waiting: 3, avgWait: '8 phút', cap: '54%' },
    { id: 'Block D', name: 'Khối bãi D (Bãi rỗng)', status: 'Thông thoáng', type: 'Normal', color: 'text-green-600', badgeBg: 'bg-green-500', vehicles: 2, waiting: 0, avgWait: '1 phút', cap: '38%' },
  ]

  // 5. Queue Monitor Table Data
  const queueTableData = [
    { area: 'Cổng vào Gate A', vehiclesWaiting: 2, avgWait: '3 phút', status: 'Thông thoáng', statusClass: 'bg-green-100 text-green-800' },
    { area: 'Cổng ra Gate B', vehiclesWaiting: 8, avgWait: '14 phút', status: 'Ún tắc khẩn cấp', statusClass: 'bg-red-100 text-red-700 animate-pulse' },
    { area: 'Khối bãi B (RTG-02)', vehiclesWaiting: 7, avgWait: '12 phút', status: 'Cảnh báo ùn tắc', statusClass: 'bg-amber-100 text-amber-800' },
    { area: 'Khối bãi C (Điện lạnh)', vehiclesWaiting: 3, avgWait: '8 phút', status: 'Đông vừa', statusClass: 'bg-blue-100 text-blue-800' },
  ]

  // 6. Realtime Traffic Alerts
  const trafficAlerts = [
    { id: 1, severity: '🔴 NGHÊM TRỌNG', time: '5 phút trước', desc: 'Hàng đợi Cổng B vượt ngưỡng cho phép (8 xe chờ > 14 phút).' },
    { id: 2, severity: '🔴 NGHIÊM TRỌNG', time: '12 phút trước', desc: 'Khối bãi B ùn tắc giao thông nghiêm trọng do mật độ lấp đầy 94%.' },
    { id: 3, severity: '🟡 CẢNH BÁO', time: '20 phút trước', desc: 'Xe TRK-008 đứng yên quá lâu tại luồng quét OCR Cổng In (Trễ 12 phút).' },
  ]

  const handleRerouteAction = () => {
    setToastMessage('⚡ Đã kích hoạt lệnh phân luồng tự động: Chuyển hướng 5 xe chờ từ Khối B sang Khối D thành công!')
    setSelectedCongestedArea(null)
    setTimeout(() => setToastMessage(''), 3500)
  }

  return (
    <div className="p-8 w-full font-sans flex flex-col gap-6 relative">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-carbon text-white px-6 py-3.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 z-50 animate-bounce border border-signal-orange">
          <span className="text-signal-orange text-base">●</span>
          {toastMessage}
        </div>
      )}

      {/* HEADER BAR */}
      <div className="flex justify-between items-center bg-white border border-chalk rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase">
              HỆ THỐNG KIỂM SOÁT GIAO THÔNG CẢNG
            </span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
              🟢 TRỰC TUYẾN
            </span>
          </div>
          <h2 className="font-heading text-3xl text-carbon font-extrabold mt-1">Quản Lý Giao Thông Cảng</h2>
          <p className="text-xs text-slate mt-0.5">Giám sát lưu lượng xe, hàng đợi cổng và giải quyết tình trạng ùn tắc tức thì.</p>
        </div>

        {/* Time Analysis Selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate font-bold">Phân tích:</span>
          <div className="flex bg-fog p-1 rounded-xl border border-chalk text-xs font-bold">
            <button
              onClick={() => setTimeAnalysis('Today')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${timeAnalysis === 'Today' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'}`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => setTimeAnalysis('24h')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${timeAnalysis === '24h' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'}`}
            >
              24h Qua
            </button>
            <button
              onClick={() => setTimeAnalysis('7days')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${timeAnalysis === '7days' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'}`}
            >
              7 Ngày Qua
            </button>
          </div>
        </div>
      </div>

      {/* KPI BAR (5 CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        
        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Tổng số xe trong cảng</span>
          <div className="text-3xl font-extrabold text-carbon font-mono">{kpis.vehiclesInside}</div>
          <span className="text-[11px] text-slate font-bold">Phương tiện hiện diện</span>
        </div>

        <div className="bg-white border-2 border-amber-400 rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Xe đang chờ lệnh</span>
          <div className="text-3xl font-extrabold text-amber-500 font-mono">{kpis.waiting}</div>
          <span className="text-[11px] text-amber-600 font-bold">Đang xếp hàng chờ</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Xe đang di chuyển</span>
          <div className="text-3xl font-extrabold text-blue-600 font-mono">{kpis.moving}</div>
          <span className="text-[11px] text-blue-600 font-bold">Đang lưu thông trên đường</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Thời gian chờ trung bình</span>
          <div className="text-3xl font-extrabold text-purple-600 font-mono">{kpis.avgWaitTime}</div>
          <span className="text-[11px] text-slate font-bold">Trung bình toàn hệ thống</span>
        </div>

        <div className="bg-white border-2 border-red-400 rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Khu vực bị ùn tắc</span>
          <div className="text-3xl font-extrabold text-red-600 font-mono">{kpis.congestedAreas}</div>
          <span className="text-[11px] text-red-600 font-bold">Khu vực vượt ngưỡng</span>
        </div>

      </div>

      {/* DISPATCH RECOMMENDATION ENGINE CARD (GỢI Ý AI GIẢI TỎA ÚN TẮC - LIGHT THEME) */}
      <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 text-slate-900 rounded-2xl p-6 shadow-md border-2 border-orange-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-orange-700 font-extrabold text-xs uppercase tracking-wider font-mono">
            <span className="material-symbols-outlined text-signal-orange text-base animate-spin" style={{ animationDuration: '6s' }}>psychology</span>
            RECOMMENDATION ENGINE — GỢI Ý ĐIỀU ĐỘ TỨC THÌ
          </div>
          <h3 className="font-heading text-xl font-extrabold text-carbon">
            Khối bãi B đang ùn tắc nghiêm trọng (8 xe đang chờ • Thời gian chờ 14 phút)
          </h3>
          <p className="text-xs text-slate-700 font-sans font-medium leading-relaxed">
            💡 Hành động khuyến nghị: <strong className="text-carbon font-bold">Tự động điều hướng các xe container tiếp theo sang Khối bãi D</strong> để giảm ngay 40% áp lực hạ hàng tại Cẩu RTG-02.
          </p>
        </div>

        <div className="flex gap-3 shrink-0">
          <button
            onClick={() => navigate('/dispatch')}
            className="h-12 px-6 bg-signal-orange text-white rounded-full font-extrabold text-xs hover:opacity-95 transition-opacity shadow-md flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">alt_route</span>
            MỞ TRANG ĐIỀU PHỐI
          </button>
        </div>

      </div>

      {/* GATE TRAFFIC STATUS CARDS (CỔNG VÀO & CỔNG RA) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* GATE IN CARD */}
        <div className="bg-white border-2 border-green-400 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-chalk pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-green-600 text-xl">login</span>
              <h3 className="font-heading text-lg font-extrabold text-carbon">CỔNG VÀO</h3>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${gateStatus.gateIn.colorClass}`}>
              ● {gateStatus.gateIn.status}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 font-mono text-xs text-center">
            <div className="bg-fog p-3 rounded-xl border border-chalk">
              <span className="text-[10px] text-slate font-sans block">XE ĐANG CÓ MẶT</span>
              <strong className="text-xl text-carbon font-extrabold">{gateStatus.gateIn.current} xe</strong>
            </div>
            <div className="bg-fog p-3 rounded-xl border border-chalk">
              <span className="text-[10px] text-slate font-sans block">ĐANG XẾP HÀNG CHỜ</span>
              <strong className="text-xl text-green-600 font-extrabold">{gateStatus.gateIn.waiting} xe</strong>
            </div>
            <div className="bg-fog p-3 rounded-xl border border-chalk">
              <span className="text-[10px] text-slate font-sans block">THỜI GIAN CHỜ TB</span>
              <strong className="text-xl text-carbon font-extrabold">{gateStatus.gateIn.avgWait}</strong>
            </div>
          </div>
        </div>

        {/* GATE OUT CARD */}
        <div className="bg-white border-2 border-amber-400 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-chalk pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600 text-xl">logout</span>
              <h3 className="font-heading text-lg font-extrabold text-carbon">CỔNG RA</h3>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${gateStatus.gateOut.colorClass}`}>
              ● {gateStatus.gateOut.status}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 font-mono text-xs text-center">
            <div className="bg-fog p-3 rounded-xl border border-chalk">
              <span className="text-[10px] text-slate font-sans block">XE ĐANG CÓ MẶT</span>
              <strong className="text-xl text-carbon font-extrabold">{gateStatus.gateOut.current} xe</strong>
            </div>
            <div className="bg-fog p-3 rounded-xl border border-chalk">
              <span className="text-[10px] text-slate font-sans block">ĐANG XẾP HÀNG CHỜ</span>
              <strong className="text-xl text-amber-600 font-extrabold">{gateStatus.gateOut.waiting} xe</strong>
            </div>
            <div className="bg-fog p-3 rounded-xl border border-chalk">
              <span className="text-[10px] text-slate font-sans block">THỜI GIAN CHỜ TB</span>
              <strong className="text-xl text-carbon font-extrabold">{gateStatus.gateOut.avgWait}</strong>
            </div>
          </div>
        </div>

      </div>

      {/* MIDDLE SECTION: TRAFFIC OVERVIEW CHART (24H) & CONGESTION MINI MAP */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* TRAFFIC OVERVIEW CHART (7 cols ~58%) */}
        <div className="lg:col-span-7 bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
          
          <div className="flex justify-between items-center border-b border-chalk pb-3">
            <div>
              <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider">BIỂU ĐỒ NĂNG LƯỢNG GIAO THÔNG</span>
              <h3 className="font-heading text-lg font-extrabold text-carbon">Lưu Lượng Xe Cảng 24 Giờ Qua</h3>
            </div>
            <span className="text-xs font-bold text-slate font-mono">Giờ cao điểm: 08:00 - 10:00</span>
          </div>

          {/* 24-HOUR TRAFFIC BAR CHART */}
          <div className="bg-fog p-5 rounded-2xl border border-chalk space-y-3 font-mono">
            <div className="h-44 flex items-end justify-between gap-2 pt-6">
              {trafficChartData.map((d, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                  
                  {/* Tooltip Hover */}
                  <div className="absolute -top-8 bg-carbon text-white text-[9px] py-0.5 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-bold whitespace-nowrap shadow-lg">
                    {d.hour}: {d.count} xe
                  </div>

                  {/* Bar height */}
                  <div
                    className={`w-full rounded-t-lg transition-all group-hover:brightness-110 ${
                      d.status === 'critical' ? 'bg-red-600' : d.status === 'moderate' ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{ height: `${(d.count / 50) * 100}%` }}
                  ></div>

                  <span className="text-[9px] text-slate font-bold mt-1">{d.hour}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate border-t border-chalk pt-2 font-sans font-bold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Thấp (&lt;30 xe)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Trung bình (30-40 xe)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-600"></span> Cao điểm (&gt;40 xe)</span>
            </div>
          </div>

        </div>

        {/* CONGESTION MINI MAP & AREA TRAFFIC (5 cols ~42%) */}
        <div className="lg:col-span-5 bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
          
          <div className="flex justify-between items-center border-b border-chalk pb-3">
            <div>
              <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider">CONGESTION MINI MAP</span>
              <h3 className="font-heading text-lg font-extrabold text-carbon">Mật Độ Ún Tắc Theo Khu Vực</h3>
            </div>
            <span className="text-xs text-slate font-mono">Nhấn vào khu vực để xem chi tiết</span>
          </div>

          <div className="space-y-2.5 text-xs font-mono">
            {areaTrafficList.map(area => (
              <div
                key={area.id}
                onClick={() => setSelectedCongestedArea(area)}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center ${
                  area.type === 'Critical'
                    ? 'border-red-500 bg-red-50/80 shadow-md animate-pulse'
                    : area.type === 'Moderate'
                    ? 'border-amber-400 bg-amber-50/60'
                    : 'border-chalk bg-fog/50 hover:border-slate'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 font-bold text-carbon">
                    <span className={`w-2.5 h-2.5 rounded-full ${area.badgeBg}`}></span>
                    {area.name}
                  </div>
                  <span className="text-[10px] text-slate font-sans mt-0.5 block">
                    Xe hiện diện: <strong>{area.vehicles} xe</strong> • Chờ: <strong>{area.waiting} xe</strong>
                  </span>
                </div>

                <div className="text-right">
                  <span className={`font-bold text-xs ${area.color}`}>{area.status}</span>
                  <span className="text-[10px] text-slate block font-mono">Dung tích: {area.cap}</span>
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>

      {/* BOTTOM ROW: QUEUE MONITOR TABLE & REALTIME ALERTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* QUEUE MONITOR TABLE (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-heading text-lg font-extrabold text-carbon border-b border-chalk pb-3">
            Bảng Giám Sát Hàng Đợi Các Khu Vực (Queue Monitor)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-fog text-slate font-bold uppercase text-[10px] border-b border-chalk">
                  <th className="py-3 px-4">Khu Vực</th>
                  <th className="py-3 px-4">Xe Đang Chờ Hàng</th>
                  <th className="py-3 px-4">Thời Gian Chờ TB</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk font-medium">
                {queueTableData.map((q, idx) => (
                  <tr key={idx} className="hover:bg-fog/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-carbon">{q.area}</td>
                    <td className="py-3.5 px-4 font-bold text-red-600">{q.vehiclesWaiting} xe</td>
                    <td className="py-3.5 px-4 text-graphite">{q.avgWait}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${q.statusClass}`}>
                        ● {q.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => navigate('/dispatch')}
                        className="px-3 py-1 bg-carbon text-white rounded-lg font-bold text-[11px] hover:bg-black transition-colors shadow"
                      >
                        Giải Tỏa ➔
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* REALTIME TRAFFIC ALERTS FEED (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-heading text-lg font-extrabold text-carbon border-b border-chalk pb-3">
            Cảnh Báo Giao Thông Realtime
          </h3>

          <div className="space-y-3 text-xs">
            {trafficAlerts.map(alt => (
              <div key={alt.id} className="p-3.5 bg-fog rounded-xl border border-chalk space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-red-600">{alt.severity}</span>
                  <span className="text-slate font-mono text-[10px]">{alt.time}</span>
                </div>
                <p className="text-graphite font-medium">{alt.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* CONGESTION DETAIL MODAL (KHI CLICK KHU VỰC BỊ NGHẼN) */}
      {selectedCongestedArea && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-start border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">CHI TIẾT NGHẼN GIAO THÔNG</span>
                <h3 className="font-heading text-2xl font-extrabold text-carbon">{selectedCongestedArea.name}</h3>
                <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full mt-1 ${selectedCongestedArea.type === 'Critical' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
                  ● Trạng thái: {selectedCongestedArea.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedCongestedArea(null)}
                className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="bg-fog p-4 rounded-xl border border-chalk space-y-2 text-xs font-mono">
              <div className="flex justify-between"><span className="text-slate font-sans">Số xe có mặt:</span><strong>{selectedCongestedArea.vehicles} xe</strong></div>
              <div className="flex justify-between"><span className="text-slate font-sans">Xe đang chờ cẩu:</span><strong className="text-red-600 font-bold">{selectedCongestedArea.waiting} xe</strong></div>
              <div className="flex justify-between"><span className="text-slate font-sans">Thời gian chờ trung bình:</span><strong className="text-carbon font-bold">{selectedCongestedArea.avgWait}</strong></div>
              <div className="flex justify-between"><span className="text-slate font-sans">Dung tích bãi sử dụng:</span><strong className="text-carbon font-bold">{selectedCongestedArea.cap}</strong></div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleRerouteAction}
                className="w-full h-11 bg-signal-orange text-white rounded-full font-bold text-xs hover:opacity-95 transition-opacity shadow flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">bolt</span>
                TỰ ĐỘNG PHÂN LUỒNG GIẢI TỎA
              </button>

              <button
                onClick={() => setSelectedCongestedArea(null)}
                className="w-full h-10 border border-chalk rounded-full text-slate font-bold text-xs hover:bg-fog"
              >
                Đóng lại
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
