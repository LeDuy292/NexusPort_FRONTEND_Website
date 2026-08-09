import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const kpis = [
  { title: 'Cẩu RTG', count: '17 / 24h', status: '3/4 sẵn sàng' },
  { title: 'Cẩu di động', count: '12 / 24h', status: '3/4 sẵn sàng' },
  { title: 'Xe nâng', count: '86 / 24h', status: '3/4 sẵn sàng' },
  { title: 'Xe tải', count: '26 / 24h', status: '3/4 sẵn sàng' },
]

export default function EquipmentDispatch() {
  const navigate = useNavigate()
  const [assignedCount, setAssignedCount] = useState(3)

  return (
    <div className="bg-[#efefef] text-[#202020] min-h-screen flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col hidden lg:flex">
        <div className="p-6">
          <h1 className="text-2xl font-bold font-mono tracking-tight text-[#080808]">NexusPort</h1>
          <p className="text-xs text-gray-500">Terminal Operations</p>
        </div>
        <nav className="flex-1 px-4 space-y-1 text-sm font-medium">
          <button className="w-full flex items-center px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100" onClick={() => navigate('/')}>
            📊 <span className="ml-3">Tổng quan</span>
          </button>
          <button className="w-full flex items-center px-3 py-2 rounded-md bg-[#202020] text-white font-bold">
            🚜 <span className="ml-3">Điều phối Thiết bị</span>
          </button>
          <button className="w-full flex items-center px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100" onClick={() => navigate('/berth')}>
            🚢 <span className="ml-3">Cầu cảng</span>
          </button>
          <button className="w-full flex items-center px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100" onClick={() => navigate('/gate')}>
            📷 <span className="ml-3">Cổng AI</span>
          </button>
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button className="w-full py-2.5 bg-[#ff682c] text-white rounded-full text-sm font-bold shadow hover:bg-orange-600" onClick={() => navigate('/')}>
            Quay lại Demo Nav
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-6">
          <div className="text-sm font-medium text-gray-500">
            Vận hành cảng ➔ <span className="text-[#202020] font-bold">Điều phối thiết bị</span>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono font-bold text-[#ff682c]">
            ● LIVE SYSTEM ACTIVE
          </div>
        </header>

        <main className="flex-1 p-6 flex flex-row gap-6 overflow-y-auto">
          {/* Center Area */}
          <div className="flex-1 flex flex-col space-y-6 min-w-0">
            <h2 className="text-2xl font-bold text-[#202020]">Điều phối Thiết bị Cảng - Hệ thống Quản trị</h2>

            {/* KPI Cards */}
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {kpis.map((kpi, i) => (
                <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">{kpi.title}</p>
                      <h3 className="text-2xl font-bold">{kpi.count}</h3>
                    </div>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{kpi.status}</span>
                  </div>
                  <div className="w-full h-1 bg-gray-100 rounded-full mt-3 overflow-hidden">
                    <div className="bg-[#ff682c] h-full" style={{ width: `${60 + i * 10}%` }} />
                  </div>
                </div>
              ))}
            </section>

            {/* Kanban Columns */}
            <section className="grid grid-cols-4 gap-4 flex-1">
              {/* Ready Column */}
              <div className="flex flex-col space-y-3">
                <h4 className="text-sm font-bold text-gray-600">Sẵn sàng (5)</h4>
                <div className="bg-white p-4 rounded-xl border hover:border-gray-300 shadow-sm space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>FL-04</span>
                    <span className="text-xs text-gray-400">RTG</span>
                  </div>
                  <p className="text-xs text-gray-500">Xe nâng • Hyster H360</p>
                  <div className="text-xs font-semibold text-green-600">● 85% Sẵn sàng</div>
                </div>
              </div>

              {/* Assigned Column */}
              <div className="flex flex-col space-y-3">
                <h4 className="text-sm font-bold text-gray-600">Đã phân công ({assignedCount})</h4>
                <div className="bg-white p-4 rounded-xl border-2 border-[#ff682c]/30 shadow-sm space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>FL-03</span>
                    <span className="text-xs text-gray-400">RTG</span>
                  </div>
                  <p className="text-xs text-gray-500">Xe nâng • Hyster H360</p>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#ff682c] h-full" style={{ width: '45%' }} />
                  </div>
                </div>
              </div>

              {/* Active Column */}
              <div className="flex flex-col space-y-3">
                <h4 className="text-sm font-bold text-gray-600">Đang hoạt động (8)</h4>
                <div className="bg-white p-4 rounded-xl border-2 border-[#ff682c] shadow-sm space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>FL-02</span>
                    <span className="text-xs text-gray-400">Crane</span>
                  </div>
                  <p className="text-xs text-gray-500">Cẩu bãi • Kalmar 45T</p>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#ff682c] h-full" style={{ width: '80%' }} />
                  </div>
                </div>
              </div>

              {/* Maintenance Column */}
              <div className="flex flex-col space-y-3">
                <h4 className="text-sm font-bold text-gray-600">Bảo trì (2)</h4>
                <div className="bg-white p-4 rounded-xl border opacity-75 shadow-sm space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>FL-05</span>
                    <span className="text-xs text-gray-400">Mainten</span>
                  </div>
                  <p className="text-xs text-gray-500">Đang kiểm tra động cơ</p>
                </div>
              </div>
            </section>

            {/* Roster Table */}
            <section className="bg-white p-6 rounded-xl border shadow-sm">
              <h4 className="text-lg font-bold mb-4">Danh sách ca trực hiện tại</h4>
              <table className="w-full text-left text-sm">
                <thead className="text-gray-400 border-b pb-2">
                  <tr>
                    <th className="py-2">Họ tên</th>
                    <th>Vai trò</th>
                    <th>Thiết bị</th>
                    <th>Ca trực</th>
                    <th>Hiệu suất</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs font-medium">
                  <tr>
                    <td className="py-3 font-bold">Sarah Jenkins</td>
                    <td className="text-gray-600">Vận hành RTG</td>
                    <td className="font-bold">RTG-02</td>
                    <td>06:00 - 14:00</td>
                    <td className="font-bold text-[#ff682c]">92%</td>
                    <td><span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">Hoạt động</span></td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold">David Thorne</td>
                    <td className="text-gray-600">Vận hành cẩu di động</td>
                    <td className="text-gray-400 italic">Chưa phân công</td>
                    <td>06:00 - 14:00</td>
                    <td className="font-bold">88%</td>
                    <td><span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-bold">Sẵn sàng</span></td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>

          {/* Right Queue Bar */}
          <aside className="w-80 flex flex-col space-y-4">
            <h4 className="text-sm font-bold text-gray-600">Hàng đợi ưu tiên</h4>
            {[
              { code: 'MSKU-998273-1', tag: 'Ưu tiên cao' },
              { code: 'HLCU-445129-0', tag: 'Ưu tiên cao' },
            ].map((q, idx) => (
              <div key={idx} className="bg-white p-5 rounded-xl border shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <h5 className="font-bold text-sm">{q.code}</h5>
                  <span className="px-2 py-0.5 bg-[#ff682c]/10 text-[#ff682c] text-[10px] font-bold rounded">{q.tag}</span>
                </div>
                <p className="text-xs text-gray-500">Nhiệm vụ: Chuyển hạ bãi bốc xếp container</p>
                <button
                  className="w-full py-2 bg-[#202020] text-white text-xs font-bold rounded-full hover:bg-black"
                  onClick={() => { setAssignedCount(prev => prev + 1); alert(`Đã phân công thiết bị cho ${q.code}`) }}
                >
                  Phân công thiết bị
                </button>
              </div>
            ))}
          </aside>
        </main>
      </div>
    </div>
  )
}
