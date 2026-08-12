import React from 'react'

export default function DriverCheckin({ onNavigateToRoute }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-20 p-2">
      
      {/* Header */}
      <div className="border-b border-chalk pb-3 text-center">
        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2.5 py-0.5 rounded uppercase">
          AUTOMATED GATE CHECK-IN
        </span>
        <h2 className="font-heading text-2xl text-carbon font-extrabold mt-1">Xác nhận Cổng thành công</h2>
      </div>

      {/* FLOW PROGRESS STEPPER INDICATOR */}
      <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm">
        <span className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-3 text-center">
          TIẾN TRÌNH CHECK-IN CỔNG
        </span>
        
        <div className="flex items-center justify-between text-[10px] font-bold text-center">
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">✓</div>
            <span className="text-carbon mt-1">Booking</span>
          </div>
          <div className="h-0.5 flex-1 bg-green-500 mx-1"></div>

          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">✓</div>
            <span className="text-carbon mt-1">Arrive Gate</span>
          </div>
          <div className="h-0.5 flex-1 bg-green-500 mx-1"></div>

          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">✓</div>
            <span className="text-carbon mt-1">Show QR</span>
          </div>
          <div className="h-0.5 flex-1 bg-green-500 mx-1"></div>

          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">✓</div>
            <span className="text-carbon mt-1">Verified</span>
          </div>
        </div>
      </div>

      {/* CHECK-IN SUCCESSFUL BANNER (NỔI BẬT) */}
      <div className="bg-green-600 text-white rounded-3xl p-6 shadow-xl space-y-4 text-center border-2 border-green-700">
        <div className="w-16 h-16 rounded-full bg-white/20 text-white flex items-center justify-center mx-auto text-3xl font-bold shadow-inner">
          ✓
        </div>

        <div>
          <h3 className="text-xl font-extrabold tracking-wider uppercase font-heading">
            CHECK-IN SUCCESSFUL
          </h3>
          <p className="text-xs text-green-100 mt-1">Cổng đã mở tự động • Barie xác nhận xe qua bãi</p>
        </div>

        <div className="bg-black/20 rounded-2xl p-4 text-left space-y-2 text-xs font-mono">
          <div className="flex justify-between border-b border-white/20 pb-1.5">
            <span className="text-green-200">CỔNG KIỂM SOÁT:</span>
            <span className="font-bold text-white text-sm">Gate A (Cổng A)</span>
          </div>

          <div className="flex justify-between border-b border-white/20 pb-1.5">
            <span className="text-green-200">THỜI GIAN VÀO:</span>
            <span className="font-bold text-white">08:42 AM</span>
          </div>

          <div className="flex justify-between pt-1">
            <span className="text-green-200">ĐIỂM ĐẾN PHÂN BỔ:</span>
            <span className="font-bold text-yellow-300 text-sm">Block B – B12-04</span>
          </div>
        </div>
      </div>

      {/* PRIMARY CTA: XEM HƯỚNG DẪN */}
      <div className="pt-2">
        <button
          onClick={onNavigateToRoute}
          className="w-full h-14 bg-signal-orange text-white rounded-2xl font-extrabold text-base hover:opacity-95 transition-opacity shadow-lg flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-xl">navigation</span>
          XEM HƯỚNG DẪN DI CHUYỂN
        </button>
      </div>

    </div>
  )
}
