import React, { useState } from 'react'

export default function ReportsAnalytics() {
  const [dateFilter, setDateFilter] = useState('This month')
  const [toastMessage, setToastMessage] = useState('')

  const monthlyValues = [
    { month: 'Jan', val: 40, rev: '6.0M' },
    { month: 'Feb', val: 55, rev: '8.2M' },
    { month: 'Mar', val: 45, rev: '6.7M' },
    { month: 'Apr', val: 60, rev: '9.0M' },
    { month: 'May', val: 75, rev: '11.2M' },
    { month: 'Jun', val: 65, rev: '9.7M' },
    { month: 'Jul', val: 80, rev: '12.0M' },
    { month: 'Aug', val: 95, rev: '14.2M' },
    { month: 'Sep', val: 85, rev: '12.7M' },
    { month: 'Oct', val: 100, rev: '15.0M' },
    { month: 'Nov', val: 90, rev: '13.5M' },
    { month: 'Dec', val: 70, rev: '10.5M' },
  ]

  const handleExport = (type) => {
    setToastMessage(`📥 Đã xuất báo cáo dữ liệu định dạng ${type.toUpperCase()} thành công!`)
    setTimeout(() => setToastMessage(''), 3000)
  }

  return (
    <div className="p-8 w-full font-sans flex flex-col gap-8 relative">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-24 right-8 bg-[#202020] text-white px-6 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 z-50 animate-bounce border border-signal-orange">
          <span className="text-signal-orange">●</span>
          {toastMessage}
        </div>
      )}

      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-chalk pb-6">
        <div>
          <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase">
            Executive Analytics
          </span>
          <h2 className="font-heading text-4xl text-primary font-bold mt-1">Báo cáo & Phân tích Vận hành</h2>
          <p className="text-sm text-slate mt-1">Tổng quan doanh thu cảng, lưu lượng bốc dỡ TEU và hiệu suất khai thác bến bãi.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Date Filter Pills */}
          <div className="flex items-center gap-1.5 bg-fog p-1 rounded-full border border-chalk text-xs font-bold">
            {['This month', 'Last 3 months', 'This year', 'Custom'].map(pill => (
              <button
                key={pill}
                onClick={() => setDateFilter(pill)}
                className={`px-4 py-1.5 rounded-full transition-all ${
                  dateFilter === pill
                    ? 'bg-carbon text-white shadow-sm'
                    : 'text-graphite hover:text-carbon'
                }`}
              >
                {pill === 'This month' ? 'Tháng này' : pill === 'Last 3 months' ? '3 tháng qua' : pill === 'This year' ? 'Năm nay' : 'Tùy chỉnh'}
              </button>
            ))}
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('PDF')}
              className="flex items-center gap-2 px-4 h-10 rounded-full border border-carbon text-carbon font-bold text-xs hover:bg-fog transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              Xuất PDF
            </button>
            <button
              onClick={() => handleExport('Excel')}
              className="flex items-center gap-2 px-4 h-10 rounded-full border border-carbon text-carbon font-bold text-xs hover:bg-fog transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">table_chart</span>
              Xuất Excel
            </button>
          </div>
        </div>
      </div>

      {/* KPI ROW (5 Cards Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-white rounded-xl p-5 border border-chalk shadow-sm space-y-2">
          <h3 className="text-xs font-bold text-slate uppercase">Tổng doanh thu</h3>
          <div className="font-heading text-3xl font-bold text-carbon">$12.4M</div>
          <div className="flex items-center gap-1 text-xs text-signal-orange font-bold">
            <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            +8.2% <span className="text-slate font-normal">so với tháng trước</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-xl p-5 border border-chalk shadow-sm space-y-2">
          <h3 className="text-xs font-bold text-slate uppercase">Lượt tàu cập bến</h3>
          <div className="font-heading text-3xl font-bold text-carbon">142</div>
          <div className="flex items-center gap-1 text-xs text-signal-orange font-bold">
            <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            +12% <span className="text-slate font-normal">so với tháng trước</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white rounded-xl p-5 border border-chalk shadow-sm space-y-2">
          <h3 className="text-xs font-bold text-slate uppercase">Container TEU</h3>
          <div className="font-heading text-3xl font-bold text-carbon">845k</div>
          <div className="flex items-center gap-1 text-xs text-signal-orange font-bold">
            <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            +4.1% <span className="text-slate font-normal">so với tháng trước</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white rounded-xl p-5 border border-chalk shadow-sm space-y-2">
          <h3 className="text-xs font-bold text-slate uppercase">Thời gian giải phóng</h3>
          <div className="font-heading text-3xl font-bold text-carbon">18.4h</div>
          <div className="flex items-center gap-1 text-xs text-green-600 font-bold">
            <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
            -1.2h <span className="text-slate font-normal">nhanh hơn</span>
          </div>
        </div>

        {/* KPI 5 */}
        <div className="bg-white rounded-xl p-5 border border-chalk shadow-sm space-y-2">
          <h3 className="text-xs font-bold text-slate uppercase">Điều động đường sắt</h3>
          <div className="font-heading text-3xl font-bold text-carbon">328</div>
          <div className="flex items-center gap-1 text-xs text-signal-orange font-bold">
            <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            +2.5% <span className="text-slate font-normal">so với tháng trước</span>
          </div>
        </div>

      </div>

      {/* CHARTS GRID (2x2 Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Top-Left: Revenue by month (Bar Chart) */}
        <div className="bg-white rounded-xl p-6 border border-chalk shadow-sm h-[380px] flex flex-col justify-between">
          <h3 className="font-heading text-lg font-bold text-carbon">Doanh thu theo tháng</h3>

          <div className="flex-1 relative flex items-end justify-between px-2 pt-6 pb-6">
            {/* Y-Axis Labels */}
            <div className="absolute left-0 top-2 bottom-8 flex flex-col justify-between text-[10px] font-bold text-slate text-right pr-2">
              <span>15M</span>
              <span>10M</span>
              <span>5M</span>
              <span>0</span>
            </div>

            {/* Grid Background Lines */}
            <div className="absolute left-8 right-0 top-2 bottom-8 flex flex-col justify-between pointer-events-none">
              <div className="border-t border-chalk w-full"></div>
              <div className="border-t border-chalk w-full"></div>
              <div className="border-t border-chalk w-full"></div>
              <div className="border-t border-chalk w-full"></div>
            </div>

            {/* Bars Render */}
            <div className="relative z-10 flex-1 flex items-end justify-between ml-8 h-full">
              {monthlyValues.map((item, idx) => (
                <div key={idx} className="flex flex-col items-center group w-[6%] h-full justify-end cursor-pointer">
                  <div
                    className={`w-full bg-signal-orange rounded-t-md transition-all duration-300 group-hover:brightness-90 ${
                      idx === 9 ? 'opacity-100 ring-2 ring-signal-orange' : 'opacity-65'
                    }`}
                    style={{ height: `${item.val}%` }}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-carbon text-white text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30 font-bold">
                      {item.month}: ${item.rev}
                    </div>
                  </div>
                  <span className="absolute -bottom-5 text-[10px] font-bold text-slate">{item.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top-Right: Container types (SVG Donut Chart) */}
        <div className="bg-white rounded-xl p-6 border border-chalk shadow-sm h-[380px] flex flex-col justify-between">
          <h3 className="font-heading text-lg font-bold text-carbon">Cơ cấu loại Container</h3>
          
          <div className="flex-1 flex items-center justify-between">
            {/* SVG Donut */}
            <div className="relative w-48 h-48 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" fill="transparent" r="40" stroke="#e8e8e8" strokeWidth="12"></circle>
                
                {/* Dry (45%) */}
                <circle cx="50" cy="50" fill="transparent" r="40" stroke="#ff682c" strokeDasharray="251.2" strokeDashoffset="138" strokeWidth="12"></circle>
                
                {/* Reefer (30%) */}
                <circle cx="50" cy="50" fill="transparent" r="40" stroke="#745b1e" strokeDasharray="251.2" strokeDashoffset="175" strokeWidth="12" style={{ transformOrigin: 'center', transform: 'rotate(162deg)' }}></circle>
                
                {/* Open Top (15%) */}
                <circle cx="50" cy="50" fill="transparent" r="40" stroke="#4d4d4d" strokeDasharray="251.2" strokeDashoffset="213" strokeWidth="12" style={{ transformOrigin: 'center', transform: 'rotate(270deg)' }}></circle>
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading text-2xl font-bold text-carbon">124k</span>
                <span className="text-[10px] text-slate font-bold uppercase">containers</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-col gap-3 pl-6 border-l border-chalk text-xs">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-signal-orange"></div>
                <div>
                  <div className="font-bold text-carbon">Standard Dry (Hàng khô)</div>
                  <div className="text-slate text-[10px]">45% (55.8k cont)</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#745b1e]"></div>
                <div>
                  <div className="font-bold text-carbon">Refrigerated (Hàng lạnh)</div>
                  <div className="text-slate text-[10px]">30% (37.2k cont)</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-graphite"></div>
                <div>
                  <div className="font-bold text-carbon">Open Top (Mở mái)</div>
                  <div className="text-slate text-[10px]">15% (18.6k cont)</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-chalk"></div>
                <div>
                  <div className="font-bold text-carbon">Flat Rack (Quá khổ)</div>
                  <div className="text-slate text-[10px]">10% (12.4k cont)</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom-Left: Booking trends (SVG Line Chart) */}
        <div className="bg-white rounded-xl p-6 border border-chalk shadow-sm h-[380px] flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <h3 className="font-heading text-lg font-bold text-carbon">Xu hướng đặt chỗ (Booking trends)</h3>
            <div className="flex gap-3 text-[10px] font-bold text-slate">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-signal-orange"></span> Đã đặt</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-graphite"></span> Hoàn thành</span>
            </div>
          </div>

          <div className="flex-1 relative mt-4">
            <svg className="w-full h-full" viewBox="0 0 400 200">
              <line stroke="#e8e8e8" strokeWidth="1" x1="0" x2="400" y1="50" y2="50"></line>
              <line stroke="#e8e8e8" strokeWidth="1" x1="0" x2="400" y1="100" y2="100"></line>
              <line stroke="#e8e8e8" strokeWidth="1" x1="0" x2="400" y1="150" y2="150"></line>

              <path d="M0,180 L50,150 L100,160 L150,120 L200,130 L250,90 L300,100 L350,50 L400,60 L400,200 L0,200 Z" fill="#ff682c" fillOpacity="0.1"></path>
              
              <path d="M0,180 L50,150 L100,160 L150,120 L200,130 L250,90 L300,100 L350,50 L400,60" fill="none" stroke="#ff682c" strokeWidth="2.5"></path>
              <path d="M0,190 L50,170 L100,175 L150,140 L200,150 L250,110 L300,120 L350,80 L400,85" fill="none" stroke="#4d4d4d" strokeWidth="2.5"></path>
            </svg>
          </div>
        </div>

        {/* Bottom-Right: Berth Utilization Heatmap */}
        <div className="bg-white rounded-xl p-6 border border-chalk shadow-sm h-[380px] flex flex-col justify-between">
          <h3 className="font-heading text-lg font-bold text-carbon">Tải trọng Cầu bến (Berth utilization Heatmap)</h3>

          <div className="flex-1 flex flex-col justify-center">
            <div className="flex mb-2 text-slate text-[10px] font-bold">
              <div className="w-10"></div>
              <div className="flex-1 flex justify-between pr-2">
                <span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span>
              </div>
            </div>

            <div className="flex gap-2 h-full">
              <div className="flex flex-col justify-between text-slate font-bold text-[10px] w-8 py-1">
                <span>B1</span><span>B2</span><span>B3</span><span>B4</span><span>B5</span>
              </div>

              <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-2">
                {[
                  ['80%', '100%', '80%', '50%', '20%', '20%', '50%'],
                  ['50%', '80%', '80%', '100%', '80%', '50%', '20%'],
                  ['20%', '50%', '80%', '80%', '80%', '100%', '80%'],
                  ['80%', '50%', '20%', '50%', '80%', '80%', '100%'],
                  ['100%', '80%', '50%', '20%', '20%', '50%', '80%'],
                ].flatMap((row, r) =>
                  row.map((val, c) => (
                    <div
                      key={`${r}-${c}`}
                      className={`rounded flex items-center justify-center text-[9px] font-bold transition-transform hover:scale-105 cursor-pointer ${
                        val === '100%'
                          ? 'bg-signal-orange text-white'
                          : val === '80%'
                          ? 'bg-orange-300 text-carbon'
                          : val === '50%'
                          ? 'bg-orange-100 text-carbon'
                          : 'bg-fog text-slate'
                      }`}
                      title={`Bến ${r+1}: Tải ${val}`}
                    >
                      {val}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* BOTTOM TABLE: Top Carriers */}
      <div className="bg-white rounded-xl border border-chalk shadow-sm overflow-hidden">
        <div className="p-6 border-b border-chalk flex justify-between items-center">
          <h3 className="font-heading text-lg font-bold text-carbon">Top Hãng tàu có sản lượng lớn nhất</h3>
          <span className="text-xs font-bold text-signal-orange">Xếp hạng theo Doanh thu</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-fog border-b border-chalk text-slate font-bold uppercase text-[10px]">
                <th className="py-3 px-6">Hãng tàu</th>
                <th className="py-3 px-6">Sản lượng (TEU)</th>
                <th className="py-3 px-6">Doanh thu cảng</th>
                <th className="py-3 px-6">Trạng thái hợp đồng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk font-medium">
              <tr className="hover:bg-fog/50">
                <td className="py-4 px-6 font-bold text-carbon border-l-4 border-signal-orange">Oceanic Global Lines</td>
                <td className="py-4 px-6 text-carbon font-mono font-bold">245,000 TEU</td>
                <td className="py-4 px-6 font-bold text-carbon">$12.4M</td>
                <td className="py-4 px-6">
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold">Hoạt động tốt</span>
                </td>
              </tr>
              <tr className="hover:bg-fog/50">
                <td className="py-4 px-6 font-bold text-carbon border-l-4 border-transparent">Pacific Freightway</td>
                <td className="py-4 px-6 text-carbon font-mono font-bold">182,500 TEU</td>
                <td className="py-4 px-6 font-bold text-carbon">$9.1M</td>
                <td className="py-4 px-6">
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold">Hoạt động tốt</span>
                </td>
              </tr>
              <tr className="hover:bg-fog/50">
                <td className="py-4 px-6 font-bold text-carbon border-l-4 border-transparent">Nordic Sea Transport</td>
                <td className="py-4 px-6 text-carbon font-mono font-bold">156,200 TEU</td>
                <td className="py-4 px-6 font-bold text-carbon">$7.8M</td>
                <td className="py-4 px-6">
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold">Hoạt động tốt</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
