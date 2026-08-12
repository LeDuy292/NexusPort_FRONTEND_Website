import React, { useState } from 'react'

export default function DriverQR({ currentApp }) {
  const [isBrightMode, setIsBrightMode] = useState(false)

  const bookingData = currentApp || {
    id: 'BK-2093',
    driver: 'Nguyễn Văn A',
    vehicle: '43C-123.45',
    container: 'MSCU1234567',
    time: '09:00 AM Today',
    status: 'Valid',
    qrData: 'NEXUSPORT_DRIVER_BK2093'
  }

  return (
    <div className={`space-y-6 animate-in fade-in duration-200 pb-20 p-2 text-center rounded-3xl transition-colors ${
      isBrightMode ? 'bg-white text-black ring-8 ring-white' : 'bg-transparent'
    }`}>
      
      {/* Status Badge Top */}
      <div className="flex justify-between items-center px-2">
        <span className="text-[10px] font-extrabold bg-carbon text-white px-3 py-1 rounded-full uppercase">
          GATE SCAN PASS
        </span>

        <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
          bookingData.status === 'Valid'
            ? 'bg-green-100 text-green-800 border-green-300'
            : bookingData.status === 'Used'
            ? 'bg-gray-100 text-gray-800 border-gray-300'
            : 'bg-red-100 text-red-800 border-red-300'
        }`}>
          ● {bookingData.status === 'Valid' ? 'MÃ HỢP LỆ (VALID)' : bookingData.status}
        </span>
      </div>

      {/* QR CODE CONTAINER (THÀNH PHẦN LỚN NHẤT MÀN HÌNH - TỐI ƯU NGOÀI TRỜI) */}
      <div className="bg-white p-6 rounded-3xl border-4 border-carbon shadow-2xl space-y-4 max-w-[320px] mx-auto">
        <div className="bg-white p-2 border-2 border-black rounded-2xl">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${bookingData.qrData}`}
            alt="Driver Gate QR"
            className="w-64 h-64 mx-auto object-cover"
          />
        </div>
        <p className="text-[11px] font-bold text-slate uppercase tracking-wider">
          ĐƯA MÀN HÌNH NÀY CHO GATE OFFICER QUÉT
        </p>
      </div>

      {/* COMPACT SUMMARY INFO (KHÔNG RỐI MẮT) */}
      <div className="bg-white border border-chalk rounded-2xl p-4 max-w-[320px] mx-auto text-xs space-y-1.5 shadow-sm text-left font-mono">
        <div className="flex justify-between border-b border-chalk pb-1.5 font-bold">
          <span className="text-slate">BOOKING:</span>
          <span className="text-carbon font-extrabold text-sm">{bookingData.id}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate">TÀI XẾ:</span>
          <span className="text-carbon font-bold">{bookingData.driver}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate">XE KÉO:</span>
          <span className="text-carbon font-bold">{bookingData.vehicle}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate">CONTAINER:</span>
          <span className="text-carbon font-bold">{bookingData.container}</span>
        </div>
        <div className="flex justify-between pt-1 border-t border-chalk">
          <span className="text-slate">GIỜ HẸN:</span>
          <span className="text-signal-orange font-bold">{bookingData.time}</span>
        </div>
      </div>

      {/* CTA TĂNG ĐỘ SÁNG MÀN HÌNH NGOÀI TRỜI */}
      <div className="max-w-[320px] mx-auto pt-2">
        <button
          onClick={() => setIsBrightMode(!isBrightMode)}
          className="w-full h-12 bg-carbon text-white rounded-xl font-extrabold text-xs hover:bg-black transition-all shadow-md flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-base">wb_sunny</span>
          {isBrightMode ? 'TẮT CHẾ ĐỘ NỔI BẬT' : 'BẬT CHẾ ĐỘ HIỂN THỊ NGOÀI TRỜI'}
        </button>
      </div>

    </div>
  )
}
