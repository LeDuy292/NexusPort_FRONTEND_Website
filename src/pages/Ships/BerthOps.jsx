import React, { useState, useEffect } from 'react'

const initialVesselsData = {
  'EVER GIVEN': {
    name: 'EVER GIVEN',
    lane: 'B-01',
    status: 'Đang đồng bộ với cần cẩu',
    badge: 'Đang đồng bộ',
    imo: '9811000',
    teu: '1,247 TEU',
    progress: 68,
    arrivedTime: 'Hôm nay, 08:30',
    etaTime: 'Hôm nay, 21:45',
    handledCont: 847,
    totalCont: 1247,
    remainingCont: 400,
    countdownSeconds: 15120, // 04:12:00
    actionPlan: [
      { part: 'Đuôi tàu', status: 'Đã xong', progress: 100, isDone: true },
      { part: 'Giữa tàu', status: 'Đang dỡ hàng', progress: 40, isDone: false, isActive: true },
      { part: 'Mũi tàu', status: 'Đang chờ', progress: 0, isDone: false },
    ],
    events: [
      { title: 'Đã xác nhận thủ tục hải quan', time: '09:15:02', active: false },
      { title: 'Đang đồng bộ với cần cẩu', time: 'Hoạt động từ 10:00:45', active: true },
      { title: 'Khởi tạo quy trình rời bến', time: 'Dự kiến 13:00', active: false },
    ]
  },
  'MSC GULSUN': {
    name: 'MSC GULSUN',
    lane: 'B-02',
    status: 'Đang tiếp cận khu vực 7',
    badge: 'Đang vào',
    imo: '9839430',
    teu: '2,100 TEU',
    progress: 0,
    arrivedTime: 'Hôm nay, 11:15',
    etaTime: 'Ngày mai, 06:00',
    handledCont: 0,
    totalCont: 2100,
    remainingCont: 2100,
    countdownSeconds: 35100, // 09:45:00
    actionPlan: [
      { part: 'Đuôi tàu', status: 'Đang chờ', progress: 0, isDone: false },
      { part: 'Giữa tàu', status: 'Đang chờ', progress: 0, isDone: false },
      { part: 'Mũi tàu', status: 'Đang chờ', progress: 0, isDone: false },
    ],
    events: [
      { title: 'Đã thông qua luồng hoa tiêu', time: '10:30:00', active: false },
      { title: 'Đang tiếp cận khu vực 7', time: 'Hoạt động từ 11:15:00', active: true },
      { title: 'Dự kiến buộc dây cập bến B-02', time: 'Dự kiến 12:00', active: false },
    ]
  },
  'CMA CGM J. SAADE': {
    name: 'CMA CGM J. SAADE',
    lane: 'B-03',
    status: 'Đã hoàn thành',
    badge: 'Hoàn thành',
    imo: '9839174',
    teu: '1,850 TEU',
    progress: 100,
    arrivedTime: 'Hôm qua, 14:00',
    etaTime: 'Hôm nay, 06:30',
    handledCont: 1850,
    totalCont: 1850,
    remainingCont: 0,
    countdownSeconds: 0,
    actionPlan: [
      { part: 'Đuôi tàu', status: 'Đã xong', progress: 100, isDone: true },
      { part: 'Giữa tàu', status: 'Đã xong', progress: 100, isDone: true },
      { part: 'Mũi tàu', status: 'Đã xong', progress: 100, isDone: true },
    ],
    events: [
      { title: 'Hoàn thành giải phóng tàu', time: '06:30:00', active: false },
      { title: 'Đã nhận giấy phép rời bến', time: '07:00:00', active: true },
    ]
  }
}

export default function BerthOps() {
  const [selectedVesselKey, setSelectedVesselKey] = useState('EVER GIVEN')
  const [vessels, setVessels] = useState(initialVesselsData)

  const currentVessel = vessels[selectedVesselKey] || vessels['EVER GIVEN']

  // Format Countdown Timer (HH:MM:SS)
  const formatTime = (totalSecs) => {
    if (totalSecs <= 0) return '00:00:00'
    const h = Math.floor(totalSecs / 3600).toString().padStart(2, '0')
    const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0')
    const s = Math.floor(totalSecs % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  // Live Timer Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setVessels(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(k => {
          if (updated[k].countdownSeconds > 0) {
            updated[k] = { ...updated[k], countdownSeconds: updated[k].countdownSeconds - 1 }
          }
        })
        return updated
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="w-full flex flex-col h-full overflow-hidden bg-paper font-sans">
      
      {/* 1. TOP 50%: TIMELINE SECTION */}
      <div className="h-[340px] bg-paper border-b border-chalk flex flex-col relative overflow-hidden p-6">
        <h2 className="font-ui-standard font-semibold text-carbon mb-4">Lịch trình bến cảng</h2>
        
        {/* Hours Bar */}
        <div className="flex justify-between font-caption text-[11px] text-slate mb-2 pl-12 sticky top-0 bg-paper z-20">
          <span>06:00</span><span>08:00</span><span>10:00</span><span>12:00</span>
          <span>14:00</span><span>16:00</span><span>18:00</span><span>20:00</span><span>22:00</span>
        </div>

        {/* Timeline Lanes */}
        <div className="relative flex-1 flex flex-col gap-5 overflow-y-auto pt-2">
          {/* Current Time Indicator Vertical Bar */}
          <div className="absolute left-1/3 top-0 bottom-0 w-[1.5px] bg-signal-orange z-10 shadow-[0_0_8px_rgba(255,104,44,0.5)]"></div>

          {/* Lane B-01 */}
          <div className="flex items-center h-12 group relative">
            <span className="w-12 font-caption text-[11px] font-semibold text-carbon">B-01</span>
            <div className="flex-1 bg-fog border border-chalk rounded h-full relative overflow-hidden group-hover:bg-mist transition-colors">
              <div className="absolute inset-0 flex justify-between opacity-20 pointer-events-none">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="w-px h-full bg-slate"></div>
                ))}
              </div>

              {/* Tàu Ever Given Card */}
              <div
                onClick={() => setSelectedVesselKey('EVER GIVEN')}
                className={`absolute left-[10%] w-[40%] h-full bg-paper border-2 rounded flex flex-col justify-center px-3 z-20 shadow-md cursor-pointer transition-transform hover:scale-[1.01] ${
                  selectedVesselKey === 'EVER GIVEN' ? 'border-signal-orange' : 'border-chalk'
                }`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="font-ui-compact text-xs text-carbon font-semibold truncate">EVER GIVEN</span>
                  <span className="bg-signal-orange text-white text-[9px] px-1.5 rounded-sm uppercase tracking-wide">
                    {vessels['EVER GIVEN'].badge}
                  </span>
                </div>
                <span className="font-caption text-[10px] text-graphite truncate mt-0.5">
                  IMO: {vessels['EVER GIVEN'].imo} | {vessels['EVER GIVEN'].teu}
                </span>
                <div className="absolute bottom-0 left-0 h-1 bg-signal-orange" style={{ width: `${vessels['EVER GIVEN'].progress}%` }}></div>
              </div>
            </div>
          </div>

          {/* Lane B-02 */}
          <div className="flex items-center h-12 group relative">
            <span className="w-12 font-caption text-[11px] font-semibold text-carbon">B-02</span>
            <div className="flex-1 bg-fog border border-chalk rounded h-full relative overflow-hidden group-hover:bg-mist transition-colors">
              <div className="absolute inset-0 flex justify-between opacity-20 pointer-events-none">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="w-px h-full bg-slate"></div>
                ))}
              </div>

              {/* Tàu MSC Gulsun Card */}
              <div
                onClick={() => setSelectedVesselKey('MSC GULSUN')}
                className={`absolute left-[45%] w-[30%] h-full bg-paper border rounded flex flex-col justify-center px-3 z-20 shadow-sm cursor-pointer hover:border-graphite transition-all hover:scale-[1.01] ${
                  selectedVesselKey === 'MSC GULSUN' ? 'border-2 border-signal-orange' : 'border-slate'
                }`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="font-ui-compact text-xs text-carbon font-semibold truncate">MSC GULSUN</span>
                  <span className="bg-chalk text-graphite text-[9px] px-1.5 rounded-sm uppercase tracking-wide">
                    {vessels['MSC GULSUN'].badge}
                  </span>
                </div>
                <span className="font-caption text-[10px] text-graphite truncate mt-0.5">
                  IMO: {vessels['MSC GULSUN'].imo}
                </span>
              </div>
            </div>
          </div>

          {/* Lane B-03 */}
          <div className="flex items-center h-12 group relative">
            <span className="w-12 font-caption text-[11px] font-semibold text-carbon">B-03</span>
            <div className="flex-1 bg-fog border border-chalk border-dashed rounded h-full relative overflow-hidden">
              <div className="absolute inset-0 flex justify-between opacity-20 pointer-events-none">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="w-px h-full bg-slate"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. VESSEL SELECTOR RAIL */}
      <div className="h-24 bg-fog border-b border-chalk flex items-center px-6 gap-4 overflow-x-auto">
        <span className="font-caption text-[11px] text-slate uppercase tracking-widest mr-2 whitespace-nowrap">Tàu đang hoạt động</span>
        
        {/* Active Nodes */}
        {Object.keys(vessels).map((key) => {
          const v = vessels[key]
          const isSelected = key === selectedVesselKey
          return (
            <div
              key={key}
              onClick={() => setSelectedVesselKey(key)}
              className={`min-w-[240px] bg-paper rounded-lg p-3 border cursor-pointer flex gap-3 items-center shadow-sm transition-all ${
                isSelected ? 'border-2 border-signal-orange' : 'border-chalk hover:border-slate'
              }`}
            >
              {/* Donut Progress Ring */}
              <div className="relative w-10 h-10 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle className="stroke-chalk" cx="18" cy="18" fill="none" r="16" strokeWidth="4"></circle>
                  <circle
                    className="stroke-signal-orange transition-all duration-1000"
                    cx="18" cy="18" fill="none" r="16"
                    strokeDasharray="100"
                    strokeDashoffset={100 - v.progress}
                    strokeWidth="4"
                  ></circle>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-caption text-[10px] font-bold text-carbon">
                  {v.progress}%
                </span>
              </div>
              <div className="flex-1 truncate">
                <h3 className="font-ui-compact text-sm text-carbon font-semibold truncate">{v.name}</h3>
                <p className={`font-caption text-[10px] truncate ${isSelected ? 'text-signal-orange font-semibold' : 'text-graphite'}`}>
                  {v.status}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* 3. BOTTOM 3-COLUMN DETAILS */}
      <div className="flex-1 bg-paper p-6 overflow-y-auto space-y-6">
        <div className="flex justify-between items-end mb-2">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="bg-carbon text-white font-label-xs text-label-xs px-2 py-0.5 rounded-sm font-bold">
                {currentVessel.lane}
              </span>
              <span className="text-signal-orange font-ui-compact text-xs font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-signal-orange animate-ping inline-block"></span>
                Phép đo xa trực tiếp Realtime
              </span>
            </div>
            <h2 className="font-heading text-3xl font-bold text-carbon">{currentVessel.name}</h2>
          </div>

          <div className="text-right">
            <p className="font-ui-compact text-sm text-graphite">Cập bến: <strong className="text-carbon">{currentVessel.arrivedTime}</strong></p>
            <p className="font-ui-compact text-sm text-graphite">Dự kiến hoàn thành: <span className="text-carbon font-bold">{currentVessel.etaTime}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Col 1: Metrics */}
          <div className="flex flex-col gap-4">
            <div className="bg-mist rounded-xl p-5 border border-chalk">
              <p className="font-caption text-[11px] text-slate uppercase tracking-wider mb-1 font-bold">Trạng thái vận hành container</p>
              <div className="flex items-end gap-2 mb-2">
                <p className="font-heading text-4xl text-carbon font-bold leading-none">{currentVessel.handledCont}</p>
                <p className="font-ui-compact text-sm text-slate mb-1">/ {currentVessel.totalCont}</p>
              </div>
              <div className="h-2 bg-chalk rounded-full w-full overflow-hidden mt-3">
                <div
                  className="h-full bg-signal-orange rounded-full transition-all duration-1000"
                  style={{ width: `${currentVessel.progress}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-fog rounded-xl p-4 border border-chalk">
                <p className="font-caption text-[10px] text-slate uppercase mb-1 font-bold">Còn lại</p>
                <p className="font-heading text-2xl text-carbon font-bold">{currentVessel.remainingCont} cont</p>
              </div>
              <div className="bg-fog rounded-xl p-4 border border-chalk">
                <p className="font-caption text-[10px] text-slate uppercase mb-1 font-bold">Đếm ngược ETA</p>
                <p className="font-heading text-2xl text-carbon font-mono font-bold text-signal-orange">
                  {formatTime(currentVessel.countdownSeconds)}
                </p>
              </div>
            </div>
          </div>

          {/* Col 2: Action Plan Table */}
          <div className="border border-chalk rounded-xl overflow-hidden flex flex-col bg-paper">
            <div className="bg-fog px-4 py-3 border-b border-chalk">
              <span className="font-caption text-[11px] text-slate uppercase tracking-wider font-bold">Kế hoạch dỡ hàng tự động</span>
            </div>
            <table className="w-full text-left border-collapse flex-1">
              <tbody>
                {currentVessel.actionPlan.map((plan, idx) => (
                  <tr key={idx} className="border-b border-chalk last:border-0 hover:bg-fog/50">
                    <td className={`p-3.5 font-ui-compact text-xs ${plan.isActive ? 'text-carbon font-bold' : 'text-graphite'}`}>
                      {plan.part}
                    </td>
                    <td className={`p-3.5 font-ui-compact text-xs font-semibold ${
                      plan.isDone ? 'text-graphite' : plan.isActive ? 'text-signal-orange' : 'text-slate'
                    }`}>
                      {plan.status}
                    </td>
                    <td className="p-3.5 w-1/3">
                      <div className="h-1.5 bg-chalk rounded-full w-full overflow-hidden">
                        <div
                          className={`h-full ${plan.isDone ? 'bg-slate' : plan.isActive ? 'bg-signal-orange' : 'bg-transparent'}`}
                          style={{ width: `${plan.progress}%` }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Col 3: Event Stream */}
          <div className="border border-chalk rounded-xl overflow-hidden flex flex-col bg-paper">
            <div className="bg-fog px-4 py-3 border-b border-chalk flex justify-between items-center">
              <span className="font-caption text-[11px] text-slate uppercase tracking-wider font-bold">Dòng sự kiện hệ thống</span>
              <span className="material-symbols-outlined text-xs text-slate">history</span>
            </div>
            <div className="p-5 flex-1 bg-paper relative space-y-6">
              {/* Vertical Line */}
              <div className="absolute left-7 top-6 bottom-6 w-px bg-chalk"></div>

              {currentVessel.events.map((ev, idx) => (
                <div key={idx} className="relative pl-8">
                  <div className={`absolute left-[5px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-paper ${
                    ev.active ? 'bg-signal-orange animate-pulse' : 'bg-slate'
                  }`}></div>
                  <p className={`font-ui-compact text-xs ${ev.active ? 'text-carbon font-bold' : 'text-graphite'}`}>
                    {ev.title}
                  </p>
                  <p className={`font-caption text-[10px] mt-0.5 ${ev.active ? 'text-signal-orange font-semibold' : 'text-slate'}`}>
                    {ev.time}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
