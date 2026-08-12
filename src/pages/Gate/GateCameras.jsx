import React, { useState, useEffect } from 'react'
import { gateStatusData } from '../../data/gateOfficerData'

const CAMERAS = [
  { id: 'CAM-01', gate: 'Cổng A', status: 'Online', anpr: true, lastPlate: '43C-123.45', lastConfidence: 99.2, lastTime: '17:24:11', vehiclesProcessed: 18 },
  { id: 'CAM-02', gate: 'Cổng B', status: 'Online', anpr: true, lastPlate: '43C-556.78', lastConfidence: 97.8, lastTime: '17:21:44', vehiclesProcessed: 11 },
  { id: 'CAM-03', gate: 'Cổng C', status: 'Offline', anpr: false, lastPlate: '—', lastConfidence: 0, lastTime: '—', vehiclesProcessed: 0 },
]

export default function GateCameras() {
  const [currentTime, setCurrentTime] = useState('')
  const [fullscreen, setFullscreen] = useState(null)
  const [confidences, setConfidences] = useState({ 'CAM-01': 99.2, 'CAM-02': 97.8, 'CAM-03': 0 })

  useEffect(() => {
    const tick = () => setCurrentTime(new Date().toLocaleTimeString('vi-VN'))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // Simulate ANPR confidence fluctuation
  useEffect(() => {
    const pulse = setInterval(() => {
      setConfidences(prev => ({
        'CAM-01': 97 + Math.random() * 3,
        'CAM-02': 95 + Math.random() * 4,
        'CAM-03': 0,
      }))
    }, 2000)
    return () => clearInterval(pulse)
  }, [])

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen">

      {/* Header */}
      <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm flex justify-between items-center">
        <div>
          <span className="text-xs font-extrabold bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full uppercase">Nhân viên cổng</span>
          <h2 className="font-heading text-3xl font-extrabold text-carbon mt-1">Giám Sát Camera Cổng</h2>
          <p className="text-xs text-slate mt-0.5">Hệ thống camera ANPR theo dõi xe ra/vào tại tất cả cổng cảng theo thời gian thực.</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-extrabold text-carbon">{currentTime}</div>
          <div className="text-xs text-slate font-mono">
            {CAMERAS.filter(c => c.status === 'Online').length}/{CAMERAS.length} camera hoạt động
          </div>
        </div>
      </div>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {CAMERAS.map(cam => (
          <div key={cam.id} className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden flex flex-col ${cam.status === 'Online' ? 'border-green-300' : 'border-slate-300 opacity-75'}`}>

            {/* Camera Header */}
            <div className="p-4 border-b border-chalk flex justify-between items-center">
              <div>
                <span className="font-extrabold text-carbon text-sm">{cam.gate}</span>
                <div className="text-[10px] font-mono text-slate">{cam.id}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border flex items-center gap-1 ${
                  cam.status === 'Online' ? 'bg-green-100 text-green-900 border-green-300' : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cam.status === 'Online' ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></span>
                  {cam.status === 'Online' ? 'Hoạt động' : 'Ngoại tuyến'}
                </span>
              </div>
            </div>

            {/* Camera Viewport */}
            <div
              className="relative bg-[#0d1117] cursor-pointer group"
              style={{ aspectRatio: '16/9' }}
              onClick={() => cam.status === 'Online' && setFullscreen(cam)}
            >
              {cam.status === 'Online' ? (
                <>
                  <img
                    src="/gate-camera-truck.png"
                    alt={`Camera ${cam.gate}`}
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                  />
                  {/* Scanline effect */}
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.015) 2px, rgba(0,255,0,0.015) 4px)' }}
                  />
                  {/* Bounding box */}
                  <div className="absolute top-[18%] left-[15%] right-[15%] h-[40%] border-2 border-signal-orange rounded-sm animate-pulse">
                    <div className="absolute -top-4 left-0 bg-signal-orange text-white text-[9px] font-extrabold px-1.5 py-0.5 font-mono">XE</div>
                  </div>
                  {/* ANPR overlay */}
                  <div className="absolute top-2 left-2 bg-black/70 border border-green-500 text-green-400 text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    ANPR {confidences[cam.id].toFixed(1)}%
                  </div>
                  {/* Timestamp */}
                  <div className="absolute bottom-2 left-2 text-[9px] font-mono text-green-400 bg-black/60 px-1.5 py-0.5 rounded">{currentTime}</div>
                  {/* Fullscreen hint */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <span className="material-symbols-outlined text-white text-3xl bg-black/50 rounded-full p-2">fullscreen</span>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-slate-600 text-4xl">videocam_off</span>
                  <span className="text-slate-500 text-xs font-bold">Camera ngoại tuyến</span>
                  <span className="text-slate-600 text-[10px]">Kiểm tra kết nối thiết bị</span>
                </div>
              )}
            </div>

            {/* Camera Info */}
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-fog p-2.5 rounded-xl border border-chalk">
                  <div className="text-[9px] text-slate uppercase mb-0.5">Hệ thống ANPR</div>
                  <div className={`font-extrabold text-[11px] flex items-center gap-1 ${cam.anpr ? 'text-green-700' : 'text-slate-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cam.anpr ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    {cam.anpr ? 'Đang chạy' : 'Dừng'}
                  </div>
                </div>
                <div className="bg-fog p-2.5 rounded-xl border border-chalk">
                  <div className="text-[9px] text-slate uppercase mb-0.5">Xe đã xử lý</div>
                  <div className="font-extrabold text-carbon text-[11px]">{cam.vehiclesProcessed} xe hôm nay</div>
                </div>
              </div>

              <div className={`p-3 rounded-xl border-2 ${cam.status === 'Online' && cam.lastPlate !== '—' ? 'bg-blue-50 border-blue-200' : 'bg-fog border-chalk'}`}>
                <div className="text-[9px] text-slate uppercase mb-1 font-bold">Nhận dạng gần nhất</div>
                <div className="flex justify-between items-center">
                  <span className={`font-mono font-extrabold text-sm ${cam.status === 'Online' ? 'text-carbon' : 'text-slate-400'}`}>
                    {cam.lastPlate}
                  </span>
                  <span className="text-[10px] text-slate font-mono">{cam.lastTime}</span>
                </div>
                {cam.lastConfidence > 0 && (
                  <div className="mt-1">
                    <div className="flex justify-between text-[9px] font-mono text-slate mb-0.5">
                      <span>Độ chính xác ANPR</span>
                      <span>{confidences[cam.id].toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-chalk rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${confidences[cam.id]}%` }}></div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => cam.status === 'Online' && setFullscreen(cam)}
                disabled={cam.status !== 'Online'}
                className={`w-full h-9 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 ${
                  cam.status === 'Online' ? 'border-2 border-chalk text-slate hover:bg-fog hover:border-carbon hover:text-carbon' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span className="material-symbols-outlined text-sm">fullscreen</span>
                {cam.status === 'Online' ? 'Xem toàn màn hình' : 'Camera không khả dụng'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Fullscreen Modal */}
      {fullscreen && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Fullscreen toolbar */}
          <div className="flex justify-between items-center px-6 py-3 bg-[#0a0a0a] border-b border-white/10">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2 text-white font-extrabold text-sm">
                <span className="w-2 h-2 bg-signal-orange rounded-full animate-pulse"></span>
                {fullscreen.gate} · {fullscreen.id}
              </span>
              <span className="px-2.5 py-0.5 bg-green-900 text-green-300 border border-green-700 rounded-full text-[10px] font-extrabold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>ANPR ĐANG CHẠY
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-green-400 text-sm">{currentTime}</span>
              <button onClick={() => setFullscreen(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          </div>

          {/* Fullscreen camera feed */}
          <div className="flex-1 relative overflow-hidden">
            <img
              src="/gate-camera-truck.png"
              alt={`Camera ${fullscreen.gate} toàn màn hình`}
              className="w-full h-full object-cover opacity-85"
            />
            {/* Scanlines */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.02) 2px, rgba(0,255,0,0.02) 4px)' }}
            />
            {/* Big bounding box */}
            <div className="absolute top-[20%] left-[20%] right-[20%] h-[45%] border-2 border-signal-orange rounded-sm">
              <div className="absolute -top-6 left-0 bg-signal-orange text-white text-xs font-extrabold px-3 py-1 font-mono flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                XE ĐƯỢC PHÁT HIỆN
              </div>
            </div>
            {/* Plate box */}
            <div className="absolute bottom-[25%] left-[35%] right-[35%] h-[8%] border-2 border-blue-400 rounded">
              <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs font-extrabold px-3 py-1 font-mono">BIỂN SỐ</div>
            </div>
            {/* HUD overlay - bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <div className="text-green-400 font-mono text-xs">
                    ANPR · Độ chính xác: {confidences[fullscreen.id].toFixed(1)}%
                  </div>
                  <div className="text-white font-mono text-2xl font-extrabold tracking-widest">
                    {fullscreen.lastPlate}
                  </div>
                </div>
                <div className="text-green-400 font-mono text-xs text-right">
                  <div>{new Date().toLocaleDateString('vi-VN')}</div>
                  <div className="text-lg font-extrabold">{currentTime}</div>
                </div>
              </div>
            </div>
            {/* Top-left ANPR */}
            <div className="absolute top-4 left-4 bg-black/70 border border-green-500 text-green-400 font-mono text-sm px-4 py-2 rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              CẢNG TIÊN SA · {fullscreen.gate}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
