import React, { useState, useMemo } from 'react'

export default function DriverContainerLocation({ driverMode = 'pickup', tripStep = 1, setTripStep, onStartNavigate }) {
  const [hasArrived, setHasArrived] = useState(tripStep >= 3)

  const details = useMemo(() => {
    if (driverMode === 'delivery') {
      return {
        title: 'Vị trí Hạ Container Cần Giao',
        subtitle: 'CONTAINER DELIVERY SPOT',
        badge: 'TRẢ CONTAINER (DELIVERY)',
        badgeColor: 'bg-green-600',
        containerId: 'EVER991203-4',
        coord: 'C-05-02',
        block: 'BLOCK C',
        row: 'ROW 05',
        pos: 'POS 02',
        desc: 'Tài xế đỗ đúng vạch sơn vàng và chờ Cẩu bãi RTG-01 phục vụ hạ container xuống bãi.',
        mapHeader: 'SƠ ĐỒ VỊ TRÍ KHỐI BÃI BLOCK C',
        crane: 'Cẩu RTG-01 đang trực',
        bays: ['C-03', 'C-04', 'C-05-02 ★', 'C-06'],
        arrivalSuccessMsg: '✓ Driver đã báo đến vị trí C05-02',
        arrivalBtnMsg: 'ĐÃ ĐẾN VỊ TRÍ C05-02',
        arrivalReportBtnMsg: 'BÁO ĐÃ ĐẾN VỊ TRÍ C05-02'
      }
    }
    // Default pickup
    return {
      title: 'Vị trí Container Cần Lấy',
      subtitle: 'CONTAINER PICKUP SPOT',
      badge: 'NHẬN CONTAINER (PICKUP)',
      badgeColor: 'bg-signal-orange',
      containerId: 'MSCU1234567',
      coord: 'B-12-04',
      block: 'BLOCK B',
      row: 'ROW 12',
      pos: 'POS 04',
      desc: 'Tài xế đỗ đúng vạch sơn vàng và chờ Cẩu bãi RTG-02 phục vụ.',
      mapHeader: 'SƠ ĐỒ VỊ TRÍ KHỐI BÃI BLOCK B',
      crane: 'Cẩu RTG-02 đang trực',
      bays: ['B-10', 'B-11', 'B-12-04 ★', 'B-13'],
      arrivalSuccessMsg: '✓ Driver đã báo đến vị trí B12-04',
      arrivalBtnMsg: 'ĐÃ ĐẾN VỊ TRÍ B12-04',
      arrivalReportBtnMsg: 'BÁO ĐÃ ĐẾN VỊ TRÍ B12-04'
    }
  }, [driverMode])

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-20 p-2">
      
      {/* Header */}
      <div className="border-b border-chalk pb-3 text-center">
        <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase">
          {details.subtitle}
        </span>
        <h2 className="font-heading text-xl text-carbon font-extrabold mt-1">{details.title}</h2>
      </div>

      {/* TRANSACTION BADGE */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-chalk shadow-sm">
        <span className="text-xs font-bold text-slate uppercase">LOẠI GIAO DỊCH</span>
        <span className={`${details.badgeColor} text-white text-xs font-extrabold px-3 py-1 rounded-full shadow`}>
          {details.badge}
        </span>
      </div>

      {/* CONTAINER ID & POSITION HIGHLIGHT */}
      <div className="bg-carbon text-white rounded-3xl p-6 shadow-2xl space-y-4 text-center border-2 border-carbon">
        <div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">MÃ CONTAINER</span>
          <h3 className="text-2xl font-extrabold text-white font-mono tracking-wider mt-0.5">{details.containerId}</h3>
        </div>

        {/* Big Position Display */}
        <div className="bg-white/10 rounded-2xl p-4 border border-white/20 space-y-2">
          <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">MÃ TỌA ĐỘ BÃI CHÍNH XÁC</span>
          <div className="text-4xl font-extrabold text-yellow-300 font-mono tracking-widest">
            {details.coord}
          </div>
          
          <div className="grid grid-cols-3 gap-2 pt-2 text-xs font-mono font-bold text-white border-t border-white/10">
            <div>
              <span className="text-[9px] text-gray-400 block font-sans">BLOCK</span>
              {details.block}
            </div>
            <div>
              <span className="text-[9px] text-gray-400 block font-sans">ROW</span>
              {details.row}
            </div>
            <div>
              <span className="text-[9px] text-gray-400 block font-sans">POSITION</span>
              {details.pos}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-gray-300">{details.desc}</p>
      </div>

      {/* MINI YARD MAP HIGHLIGHT */}
      <div className="bg-white border border-chalk rounded-3xl p-4 shadow-sm space-y-3">
        <span className="text-[10px] font-bold text-slate uppercase tracking-wider block text-center">
          {details.mapHeader}
        </span>
        
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 relative overflow-hidden h-36 flex items-center justify-center">
          <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold w-full">
            {details.bays.map((bay, idx) => {
              const isActive = bay.includes('★')
              return (
                <div
                  key={idx}
                  className={`p-2 rounded border transition-all ${
                    isActive 
                      ? 'bg-signal-orange text-white border-2 border-carbon font-extrabold shadow animate-pulse scale-105' 
                      : 'bg-white/80 border border-chalk text-slate'
                  }`}
                >
                  {bay}
                </div>
              )
            })}
          </div>
          
          <div className="absolute bottom-2 right-2 text-[9px] font-bold bg-white/90 text-carbon px-2 py-0.5 rounded shadow">
            {details.crane}
          </div>
        </div>
      </div>

      {/* CTA BUTTONS */}
      <div className="space-y-3 pt-2">
        {!hasArrived ? (
          <button
            onClick={() => {
              if (onStartNavigate) onStartNavigate()
            }}
            className="w-full h-14 bg-signal-orange text-white rounded-2xl font-extrabold text-base hover:opacity-95 transition-opacity shadow-lg flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-xl">navigation</span>
            BẮT ĐẦU DI CHUYỂN (NAVIGATE)
          </button>
        ) : (
          <div className="text-center text-xs font-bold text-green-600 bg-green-50 p-3 rounded-xl border border-green-200">
            {details.arrivalSuccessMsg}
          </div>
        )}

        <button
          onClick={() => {
            const nextState = !hasArrived
            setHasArrived(nextState)
            if (nextState && setTripStep && tripStep === 2) {
              setTripStep(3)
            } else if (!nextState && setTripStep && tripStep === 3) {
              setTripStep(2)
            }
          }}
          className={`w-full h-12 rounded-2xl font-bold text-xs transition-colors border ${
            hasArrived
              ? 'bg-green-600 text-white border-green-700'
              : 'bg-white border-carbon text-carbon hover:bg-fog'
          }`}
        >
          {hasArrived ? `✓ ${details.arrivalBtnMsg}` : details.arrivalReportBtnMsg}
        </button>
      </div>

    </div>
  )
}
