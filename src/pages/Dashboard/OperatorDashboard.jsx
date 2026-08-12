import React, { useState, useEffect } from 'react'

export default function OperatorDashboard() {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // Density colors for Yard Heatmap (8 columns x 6 rows)
  const densities = [
    'bg-fog border border-chalk',                         // 0: Trống
    'bg-signal-orange/20 border border-signal-orange/30', // 1: Thấp
    'bg-signal-orange/50 border border-signal-orange/60', // 2: Cao
    'bg-signal-orange text-white font-bold',              // 3: Đầy
  ]

  // Distribution data for 48 cells (6 rows x 8 cols: A-F, 01-08)
  const heatmapData = [
    1, 2, 3, 2, 1, 0, 2, 3,
    0, 1, 2, 3, 3, 2, 1, 0,
    2, 3, 3, 2, 1, 1, 2, 2,
    1, 2, 1, 0, 2, 3, 3, 1,
    3, 3, 2, 1, 0, 1, 2, 2,
    2, 1, 0, 1, 2, 2, 3, 3,
  ]

  const rows = ['A', 'B', 'C', 'D', 'E', 'F']
  const cols = ['01', '02', '03', '04', '05', '06', '07', '08']

  return (
    <div className="p-8 w-full">
      <h2 className="font-heading text-4xl text-primary mb-8 font-bold">
        Tổng quan vận hành
      </h2>

      {/* KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-paper border border-chalk rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate font-medium text-sm">Tàu tại bến</span>
            <span className="material-symbols-outlined text-signal-orange text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              directions_boat
            </span>
          </div>
          <div className="font-heading text-4xl text-primary font-bold">04</div>
        </div>

        <div className="bg-paper border border-chalk rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate font-medium text-sm">Container tại bãi</span>
            <span className="material-symbols-outlined text-signal-orange text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              inventory_2
            </span>
          </div>
          <div className="font-heading text-4xl text-primary font-bold">12,450</div>
        </div>

        <div className="bg-paper border border-chalk rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate font-medium text-sm">Giao dịch tại cổng</span>
            <span className="material-symbols-outlined text-signal-orange text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              local_shipping
            </span>
          </div>
          <div className="font-heading text-4xl text-primary font-bold">
            892 <span className="text-sm text-slate font-normal">/hr</span>
          </div>
        </div>

        <div className="bg-paper border border-chalk rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate font-medium text-sm">Cảnh báo hoạt động</span>
            <span className="material-symbols-outlined text-signal-orange text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              warning
            </span>
          </div>
          <div className="font-heading text-4xl text-primary font-bold">03</div>
        </div>
      </div>

      {/* MIDDLE ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Heatmap Yard Density (7 cols = ~60%) */}
        <div className="lg:col-span-7 bg-paper border border-chalk rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-heading text-lg font-bold text-primary">Mật độ bãi</h3>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-[2px] bg-fog border border-chalk"></div>
                <span className="text-slate">Trống</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-[2px] bg-signal-orange/30"></div>
                <span className="text-slate">Thấp</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-[2px] bg-signal-orange/60"></div>
                <span className="text-slate">Cao</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-[2px] bg-signal-orange"></div>
                <span className="text-slate">Đầy</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {/* Y-axis Labels A-F */}
            <div className="flex flex-col justify-between py-1 text-[11px] text-slate font-bold uppercase tracking-wider">
              {rows.map((r) => (
                <span key={r}>{r}</span>
              ))}
            </div>

            {/* Grid Cells & X-axis Labels */}
            <div className="flex-1">
              <div className="grid grid-cols-8 gap-1.5 h-[240px]">
                {heatmapData.map((val, idx) => (
                  <div
                    key={idx}
                    className={`rounded-[2px] transition-all duration-300 hover:scale-105 transform cursor-pointer ${densities[val]}`}
                    title={`Vị trí: ${rows[Math.floor(idx / 8)]}-${cols[idx % 8]}`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-8 gap-1.5 mt-2 text-[11px] text-slate font-bold text-center">
                {cols.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle Flow Gate A (5 cols = ~40%) */}
        <div className="lg:col-span-5 bg-paper border border-chalk rounded-lg p-6 shadow-sm flex flex-col justify-between">
          <h3 className="font-heading text-lg font-bold text-primary mb-6">Lưu lượng xe (Cổng A)</h3>
          
          <div className="space-y-6 flex-1 flex flex-col justify-center">
            {/* Flow In */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate mb-1">
                <span>Vào</span>
                <span className="text-carbon font-bold">45/min</span>
              </div>
              <div className="h-2.5 w-full bg-fog rounded-full overflow-hidden border border-chalk">
                <div
                  className="h-full bg-signal-orange transition-all duration-1000 ease-out"
                  style={{ width: animated ? '75%' : '0%' }}
                />
              </div>
            </div>

            {/* Flow Out */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate mb-1">
                <span>Ra</span>
                <span className="text-carbon font-bold">32/min</span>
              </div>
              <div className="h-2.5 w-full bg-fog rounded-full overflow-hidden border border-chalk">
                <div
                  className="h-full bg-signal-orange/70 transition-all duration-1000 ease-out"
                  style={{ width: animated ? '50%' : '0%' }}
                />
              </div>
            </div>

            {/* Turnaround Time */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate mb-1">
                <span>Thời gian quay vòng</span>
                <span className="text-carbon font-bold">14m 20s</span>
              </div>
              <div className="h-2.5 w-full bg-fog rounded-full overflow-hidden border border-chalk">
                <div
                  className="h-full bg-signal-orange/40 transition-all duration-1000 ease-out"
                  style={{ width: animated ? '30%' : '0%' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Vessels Table */}
        <div className="bg-paper border border-chalk rounded-lg overflow-hidden shadow-sm flex flex-col justify-between">
          <div className="p-5 border-b border-chalk">
            <h3 className="font-heading text-lg font-bold text-primary">Tàu đang hoạt động</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-mist text-slate text-xs font-semibold uppercase">
                  <th className="py-3 px-6">Tàu</th>
                  <th className="py-3 px-6">Trạng thái</th>
                  <th className="py-3 px-6">Tiến độ dỡ hàng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk">
                <tr className="hover:bg-fog transition-colors">
                  <td className="py-4 px-6 font-bold text-primary">Evergreen Star</td>
                  <td className="py-4 px-6">
                    <span className="inline-block px-3 py-1 bg-carbon text-white rounded-full text-xs font-semibold">
                      Đã cập bến
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 bg-fog border border-chalk rounded-full overflow-hidden">
                        <div
                          className="h-full bg-signal-orange transition-all duration-1000 ease-out"
                          style={{ width: animated ? '85%' : '0%' }}
                        />
                      </div>
                      <span className="text-slate font-bold text-xs">85%</span>
                    </div>
                  </td>
                </tr>

                <tr className="hover:bg-fog transition-colors">
                  <td className="py-4 px-6 font-bold text-primary">Maersk Alpha</td>
                  <td className="py-4 px-6">
                    <span className="inline-block px-3 py-1 bg-chalk text-graphite rounded-full text-xs font-semibold border border-chalk">
                      Đang đến
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 bg-fog border border-chalk rounded-full overflow-hidden">
                        <div
                          className="h-full bg-signal-orange transition-all duration-1000 ease-out"
                          style={{ width: '0%' }}
                        />
                      </div>
                      <span className="text-slate font-bold text-xs">0%</span>
                    </div>
                  </td>
                </tr>

                <tr className="hover:bg-fog transition-colors">
                  <td className="py-4 px-6 font-bold text-primary">MSC Horizon</td>
                  <td className="py-4 px-6">
                    <span className="inline-block px-3 py-1 bg-carbon text-white rounded-full text-xs font-semibold">
                      Đã cập bến
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 bg-fog border border-chalk rounded-full overflow-hidden">
                        <div
                          className="h-full bg-signal-orange transition-all duration-1000 ease-out"
                          style={{ width: animated ? '42%' : '0%' }}
                        />
                      </div>
                      <span className="text-slate font-bold text-xs">42%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* System Alert Feed */}
        <div className="bg-paper border border-chalk rounded-lg p-6 shadow-sm">
          <h3 className="font-heading text-lg font-bold text-primary mb-6">Nguồn tin cảnh báo</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 bg-fog rounded-lg border border-chalk">
              <div className="w-2.5 h-2.5 rounded-full bg-signal-orange mt-1 flex-shrink-0 animate-pulse"></div>
              <div>
                <p className="text-sm font-semibold text-primary">Cần bảo trì Cẩu 4. Hiệu suất vận hành đang giảm.</p>
                <p className="text-xs text-slate mt-1">2 mins ago</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 bg-white rounded-lg border border-chalk">
              <div className="w-2.5 h-2.5 rounded-full bg-slate mt-1 flex-shrink-0"></div>
              <div>
                <p className="text-sm font-medium text-graphite">Ùn tắc giao thông tại Cổng B đang giải tỏa. Lưu thông trở lại bình thường.</p>
                <p className="text-xs text-slate mt-1">15 mins ago</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 bg-white rounded-lg border border-chalk">
              <div className="w-2.5 h-2.5 rounded-full bg-slate mt-1 flex-shrink-0"></div>
              <div>
                <p className="text-sm font-medium text-graphite">Tàu 'MSC Horizon' đã cập bến an toàn tại Bến 2.</p>
                <p className="text-xs text-slate mt-1">1 hr ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
