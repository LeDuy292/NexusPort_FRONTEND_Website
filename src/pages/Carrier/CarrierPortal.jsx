import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function CarrierPortal() {
  const navigate = useNavigate()

  return (
    <div className="p-8 w-full font-sans flex flex-col gap-6">
      
      {/* Welcome Banner */}
      <div className="bg-white rounded-xl p-8 border border-chalk shadow-sm space-y-4">
        <div>
          <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase">
            Transport Company Portal
          </span>
          <h2 className="font-heading text-4xl text-carbon font-bold mt-2">
            Chào buổi sáng, Oceanic Global Lines
          </h2>
          <p className="text-sm text-graphite mt-1">
            3 đơn đặt chỗ đang hoạt động • 1 hóa đơn đang chờ thanh toán
          </p>
        </div>

        {/* Alert Banner */}
        <div className="bg-fog rounded-xl p-4 border-l-4 border-signal-orange border border-chalk flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-signal-orange">warning</span>
            <span className="text-sm font-bold text-carbon">Hóa đơn cước phí cảng đến hạn trong 2 ngày</span>
          </div>
          <button
            onClick={() => navigate('/billing')}
            className="bg-carbon text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-black transition-colors shadow"
          >
            Thanh toán ngay ➔
          </button>
        </div>
      </div>

      {/* Main Grid: Left 8 cols / Right 4 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 border border-chalk shadow-sm flex flex-col justify-between h-32">
              <div className="flex justify-between items-start text-xs font-bold text-slate">
                <span>Container hoạt động</span>
                <span className="material-symbols-outlined text-signal-orange bg-fog p-1 rounded-full text-base">inventory_2</span>
              </div>
              <div className="font-heading text-3xl font-bold text-carbon">142</div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-chalk shadow-sm flex flex-col justify-between h-32">
              <div className="flex justify-between items-start text-xs font-bold text-slate">
                <span>Đặt chỗ đang chờ</span>
                <span className="material-symbols-outlined text-signal-orange bg-fog p-1 rounded-full text-base">event_note</span>
              </div>
              <div className="font-heading text-3xl font-bold text-carbon">18</div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-chalk shadow-sm flex flex-col justify-between h-32">
              <div className="flex justify-between items-start text-xs font-bold text-slate">
                <span>Hóa đơn chưa trả</span>
                <span className="material-symbols-outlined text-signal-orange bg-fog p-1 rounded-full text-base">receipt_long</span>
              </div>
              <div className="font-heading text-3xl font-bold text-carbon">1</div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-chalk shadow-sm flex flex-col justify-between h-32">
              <div className="flex justify-between items-start text-xs font-bold text-slate">
                <span>Lịch hẹn tiếp theo</span>
                <span className="material-symbols-outlined text-signal-orange bg-fog p-1 rounded-full text-base">schedule</span>
              </div>
              <div className="font-heading text-2xl font-bold text-carbon mt-1 truncate">14:00</div>
            </div>
          </div>

          {/* Active Containers Table */}
          <div className="bg-white rounded-xl p-6 border border-chalk shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-chalk pb-4">
              <h3 className="font-heading text-lg font-bold text-carbon">Container đang hoạt động</h3>
              <button
                onClick={() => navigate('/cargo')}
                className="text-xs font-bold text-signal-orange hover:underline"
              >
                Xem tất cả ➔
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-chalk text-slate font-bold uppercase text-[10px]">
                    <th className="pb-3">Mã container</th>
                    <th className="pb-3">Loại</th>
                    <th className="pb-3">Vị trí hiện tại</th>
                    <th className="pb-3">Trạng thái thông quan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chalk">
                  <tr className="hover:bg-fog/50">
                    <td className="py-3.5 font-bold text-carbon">MSKU1234567</td>
                    <td className="py-3.5 text-graphite font-semibold">40' HC</td>
                    <td className="py-3.5">
                      <span className="bg-carbon text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold">Yard A2</span>
                    </td>
                    <td className="py-3.5">
                      <span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">✓ Đã thông quan</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-fog/50">
                    <td className="py-3.5 font-bold text-carbon">CMAU7654321</td>
                    <td className="py-3.5 text-graphite font-semibold">20' Dry</td>
                    <td className="py-3.5">
                      <span className="bg-carbon text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold">Vessel Loading</span>
                    </td>
                    <td className="py-3.5">
                      <span className="bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">Đang xử lý</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-fog/50">
                    <td className="py-3.5 font-bold text-carbon">HLXU9876543</td>
                    <td className="py-3.5 text-graphite font-semibold">40' Reefer</td>
                    <td className="py-3.5">
                      <span className="bg-carbon text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold">Gate In</span>
                    </td>
                    <td className="py-3.5">
                      <span className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold">Chờ kiểm hóa</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Bookings */}
          <div className="bg-white rounded-xl p-6 border border-chalk shadow-sm space-y-4">
            <h3 className="font-heading text-lg font-bold text-carbon border-b border-chalk pb-3">Đơn đặt chỗ gần đây</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 border-l-4 border-signal-orange bg-fog rounded-r-xl border border-chalk">
                <div>
                  <p className="font-bold text-carbon text-sm">BKG-88210</p>
                  <p className="text-xs text-slate mt-0.5">5x 40' HC • Cảng Thượng Hải (Shanghai)</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <span className="bg-carbon text-white px-3 py-1 rounded-full text-[10px]">Đã xác nhận</span>
                  <button onClick={() => navigate('/booking')} className="text-signal-orange hover:underline">Xem ➔</button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border-l-4 border-transparent hover:bg-fog rounded-r-xl border border-chalk transition-colors">
                <div>
                  <p className="font-bold text-carbon text-sm">BKG-88209</p>
                  <p className="text-xs text-slate mt-0.5">2x 20' Dry • Cảng Rotterdam</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <span className="bg-gray-200 text-slate px-3 py-1 rounded-full text-[10px]">Đang xử lý</span>
                  <button onClick={() => navigate('/booking')} className="text-signal-orange hover:underline">Xem ➔</button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/booking')}
              className="bg-white border border-chalk rounded-xl h-24 flex flex-col items-center justify-center gap-2 hover:bg-fog hover:shadow-md transition-all shadow-sm group"
            >
              <span className="material-symbols-outlined text-signal-orange group-hover:scale-110 transition-transform">add_circle</span>
              <span className="font-bold text-carbon text-xs">Đặt chỗ mới</span>
            </button>

            <button
              onClick={() => navigate('/cargo')}
              className="bg-white border border-chalk rounded-xl h-24 flex flex-col items-center justify-center gap-2 hover:bg-fog hover:shadow-md transition-all shadow-sm group"
            >
              <span className="material-symbols-outlined text-signal-orange group-hover:scale-110 transition-transform">location_searching</span>
              <span className="font-bold text-carbon text-xs">Theo dõi container</span>
            </button>

            <button
              onClick={() => navigate('/billing')}
              className="bg-white border border-chalk rounded-xl h-24 flex flex-col items-center justify-center gap-2 hover:bg-fog hover:shadow-md transition-all shadow-sm group"
            >
              <span className="material-symbols-outlined text-signal-orange group-hover:scale-110 transition-transform">payments</span>
              <span className="font-bold text-carbon text-xs">Thanh toán hóa đơn</span>
            </button>

            <button
              onClick={() => navigate('/carrier-profile')}
              className="bg-white border border-chalk rounded-xl h-24 flex flex-col items-center justify-center gap-2 hover:bg-fog hover:shadow-md transition-all shadow-sm group"
            >
              <span className="material-symbols-outlined text-signal-orange group-hover:scale-110 transition-transform">person_add</span>
              <span className="font-bold text-carbon text-xs">Hồ sơ hãng tàu</span>
            </button>
          </div>

          {/* Notifications List */}
          <div className="bg-white rounded-xl p-6 border border-chalk shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-chalk pb-3">
              <h3 className="font-heading text-base font-bold text-carbon">Thông báo mới</h3>
              <span className="bg-carbon text-white text-[10px] font-bold px-2 py-0.5 rounded-full">3</span>
            </div>

            <ul className="space-y-4 text-xs">
              <li className="flex gap-3 items-start bg-fog p-3 rounded-lg border border-chalk">
                <span className="w-2 h-2 rounded-full bg-signal-orange mt-1.5 shrink-0 animate-ping"></span>
                <div>
                  <p className="font-bold text-carbon">Cập nhật thời gian ETA của tàu sắp cập bến</p>
                  <p className="text-[10px] text-slate mt-0.5">10 phút trước</p>
                </div>
              </li>

              <li className="flex gap-3 items-start p-2">
                <span className="w-2 h-2 rounded-full bg-slate mt-1.5 shrink-0"></span>
                <div>
                  <p className="font-bold text-carbon">Đơn đặt chỗ BKG-88210 đã được phê duyệt</p>
                  <p className="text-[10px] text-slate mt-0.5">2 giờ trước</p>
                </div>
              </li>

              <li className="flex gap-3 items-start p-2">
                <span className="w-2 h-2 rounded-full bg-slate mt-1.5 shrink-0"></span>
                <div>
                  <p className="font-bold text-carbon">Đã phát hành thẻ ra vào cổng cho Tài xế Nguyễn Văn A</p>
                  <p className="text-[10px] text-slate mt-0.5">Hôm qua</p>
                </div>
              </li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  )
}
