import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function YardDashboard() {
  const navigate = useNavigate()

  return (
    <div className="p-8 w-full font-sans flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold bg-green-100 text-green-700 px-2.5 py-0.5 rounded uppercase">
            Không gian Vận hành Nhân viên Bãi
          </span>
          <h2 className="font-heading text-4xl text-primary font-bold mt-1">Tổng quan Vận hành Bãi Container</h2>
          <p className="text-sm text-slate mt-1">Giám sát sơ đồ khối bãi, hạ container và tình trạng thiết bị bãi time-real.</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/equipment-dispatch')}
            className="h-11 px-5 bg-primary-container text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md"
          >
            <span className="material-symbols-outlined text-[18px]">conveyor_belt</span>
            Điều phối thiết bị bãi
          </button>
          <button
            onClick={() => navigate('/yard')}
            className="h-11 px-5 bg-signal-orange text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md"
          >
            <span className="material-symbols-outlined text-[18px]">grid_view</span>
            Vào Bản đồ bãi Container
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-white border border-chalk rounded-xl p-5 shadow-sm">
          <span className="text-slate text-xs uppercase font-bold">Container tại bãi</span>
          <div className="text-3xl font-extrabold text-carbon mt-2">12,450 cont</div>
          <span className="text-xs text-slate mt-1 block">Mật độ trung bình 64%</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-5 shadow-sm">
          <span className="text-slate text-xs uppercase font-bold">Block cảnh báo gần đầy</span>
          <div className="text-3xl font-extrabold text-amber-500 mt-2">Block B (88%)</div>
          <span className="text-xs text-slate mt-1 block">Vị trí B01 - B12</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-5 shadow-sm">
          <span className="text-slate text-xs uppercase font-bold">Cẩu RTG bãi</span>
          <div className="text-3xl font-extrabold text-green-600 mt-2">6 cẩu chạy</div>
          <span className="text-xs text-slate mt-1 block">RTG-01, RTG-02 sẵn sàng</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-5 shadow-sm">
          <span className="text-slate text-xs uppercase font-bold">Hư hỏng cần xử lý</span>
          <div className="text-3xl font-extrabold text-red-600 mt-2">03 cont</div>
          <span className="text-xs font-bold text-red-600 cursor-pointer hover:underline" onClick={() => navigate('/damage-report')}>
            Xem báo cáo hư hỏng ➔
          </span>
        </div>
      </div>

      {/* Block Capacity Matrix Overview */}
      <div className="bg-white border border-chalk rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-chalk pb-3">
          <h3 className="font-heading text-lg font-bold text-primary">Tải trọng các Block bãi</h3>
          <button onClick={() => navigate('/yard')} className="text-xs font-bold text-signal-orange hover:underline">
            Chi tiết sơ đồ Bay ➔
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-semibold">
          <div className="p-4 border border-green-500 bg-green-50/50 rounded-lg space-y-2">
            <div className="flex justify-between font-bold text-green-800 text-sm">
              <span>BLOCK A</span>
              <span>45% (Trống)</span>
            </div>
            <p className="text-slate">Vị trí: A01 - A04 • Sẵn sàng nhận hạ hàng</p>
          </div>

          <div className="p-4 border border-amber-500 bg-amber-50/50 rounded-lg space-y-2">
            <div className="flex justify-between font-bold text-amber-800 text-sm">
              <span>BLOCK B</span>
              <span>88% (Gần đầy)</span>
            </div>
            <p className="text-slate">Vị trí: B01 - B12 • Khuyến nghị chuyển hướng sang Block C</p>
          </div>

          <div className="p-4 border border-green-500 bg-green-50/50 rounded-lg space-y-2">
            <div className="flex justify-between font-bold text-green-800 text-sm">
              <span>BLOCK C</span>
              <span>12% (Rất trống)</span>
            </div>
            <p className="text-slate">Vị trí: C01 - C08 • Thích hợp container rỗng/khô</p>
          </div>

          <div className="p-4 border border-red-500 bg-red-50/50 rounded-lg space-y-2">
            <div className="flex justify-between font-bold text-red-800 text-sm">
              <span>BLOCK D</span>
              <span>96% (Đầy)</span>
            </div>
            <p className="text-slate">Vị trí: D01 - D04 • Tạm dừng nhập hạ bãi</p>
          </div>
        </div>
      </div>
    </div>
  )
}
