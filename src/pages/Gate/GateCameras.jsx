import React, { useState, useEffect, useCallback, useRef } from 'react'
import gateService from '../../services/gateService'

export default function GateCameras() {
  const [currentTime, setCurrentTime] = useState('')
  const [fullscreen, setFullscreen] = useState(null)
  const [cameraError, setCameraError] = useState('')
  const previewLanes = useRef(new Set())
  const [cameras, setCameras] = useState([
    { id: 'CAM-01', lane: 'IN', gate: 'Cổng Vào (Làn kiểm soát)', status: 'Checking...', enabled: false, anpr: true, lastPlate: '—', lastConfidence: 0, lastTime: '—', vehiclesProcessed: 0 },
    { id: 'CAM-02', lane: 'OUT', gate: 'Cổng Ra (Làn xuất cảng)', status: 'Checking...', enabled: false, anpr: true, lastPlate: '—', lastConfidence: 0, lastTime: '—', vehiclesProcessed: 0 },
  ])

  const refreshCameraStatus = useCallback(async () => {
    const health = await gateService.checkAiHealth()
    if (!health.isOnline) {
      setCameras(prev => prev.map(camera => ({ ...camera, status: 'Offline', enabled: false })))
      setFullscreen(null)
      return
    }

    const status = await gateService.getHardwareStatus()
    if (!status.success) return
    setCameras(prev => prev.map(camera => {
      const hardware = camera.lane === 'IN' ? status.data.camera_in : status.data.camera_out
      const enabled = Boolean(hardware?.enabled)
      const connected = Boolean(hardware?.connected)
      return {
        ...camera,
        enabled,
        connected,
        status: enabled ? (connected ? 'Online' : 'Đang mở') : 'Tắt',
      }
    }))
    const activeLane = ['IN', 'OUT'].find(lane => {
      const hardware = lane === 'IN' ? status.data.camera_in : status.data.camera_out
      return Boolean(hardware?.enabled)
    })
    setFullscreen(current => {
      if (!current) return null
      if (!activeLane) return null
      if (current.lane === activeLane) return current
      return cameras.find(camera => camera.lane === activeLane) || current
    })
  }, [])

  useEffect(() => {
    refreshCameraStatus()
    const poll = setInterval(refreshCameraStatus, 2000)
    return () => clearInterval(poll)
  }, [refreshCameraStatus])

  useEffect(() => {
    let mounted = true
    const enableEntryCamera = async () => {
      const result = await gateService.setCameraPreview('IN', true)
      if (!mounted) {
        if (result.success) await gateService.setCameraPreview('IN', false)
        return
      }
      if (result.success && result.data.preview_enabled) {
        previewLanes.current.add('IN')
        setCameraError('')
        refreshCameraStatus()
      } else {
        setCameraError(`Không thể bật camera: ${result.error || 'AI Service chưa sẵn sàng'}`)
      }
    }

    enableEntryCamera()
    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') enableEntryCamera()
    }, 8000)

    return () => {
      mounted = false
      clearInterval(heartbeat)
      previewLanes.current.forEach(lane => gateService.setCameraPreview(lane, false))
      previewLanes.current.clear()
    }
  }, [refreshCameraStatus])

  useEffect(() => {
    const tick = () => setCurrentTime(new Date().toLocaleTimeString('vi-VN'))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen">

      {/* Header */}
      <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm flex justify-between items-center">
        <div>
          <span className="text-xs font-extrabold bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full uppercase">Nhân viên cổng</span>
          <h2 className="font-heading text-3xl font-extrabold text-carbon mt-1">Giám Sát Camera Cổng</h2>
          <p className="text-xs text-slate mt-0.5">Camera tự bật khi vào trang và tắt khi rời trang. Chỉ cảm biến mới kích hoạt quét xe; camera chỉ xử lý một làn cùng lúc.</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-extrabold text-carbon">{currentTime}</div>
          <div className="text-xs text-slate font-mono">
            {cameras.filter(c => c.enabled).length}/{cameras.length} camera đang bật
          </div>
        </div>
      </div>

      {cameraError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{cameraError}</div>}

      {/* Camera Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {cameras.map(cam => (
          <div key={cam.id} className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden flex flex-col ${cam.status === 'Online' ? 'border-green-300' : 'border-slate-300 opacity-75'}`}>

            {/* Camera Header */}
            <div className="p-4 border-b border-chalk flex justify-between items-center">
              <div>
                <span className="font-extrabold text-carbon text-sm">{cam.gate}</span>
                <div className="text-[10px] font-mono text-slate">{cam.id}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border flex items-center gap-1 ${
                  cam.enabled ? 'bg-green-100 text-green-900 border-green-300' : cam.status === 'Offline' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cam.enabled ? 'bg-green-500 animate-pulse' : cam.status === 'Offline' ? 'bg-red-500' : 'bg-slate-400'}`}></span>
                  {cam.enabled ? cam.status : cam.status === 'Offline' ? 'AI Service ngoại tuyến' : 'Đang tắt'}
                </span>
              </div>
            </div>

            {/* Camera Viewport */}
            <div
              className="relative bg-[#0d1117] cursor-pointer group"
              style={{ aspectRatio: '16/9' }}
              onClick={() => cam.connected && setFullscreen(cam)}
            >
              {cam.connected ? (
                <>
                  <img
                    src={`${gateService.getVideoFeedUrl(cam.lane)}&t=${cam.id}`}
                    alt={`Camera ${cam.gate}`}
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                  />
                  <div className="absolute top-2 left-2 bg-black/70 text-green-400 text-[9px] font-mono px-1.5 py-0.5 rounded">LIVE · {currentTime}</div>
                </>
              ) : (
                <div className="absolute inset-0 bg-[#0d1117]" aria-label="Chưa có luồng hình ảnh" />
              )}
            </div>

            {/* Camera Info */}
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-fog p-2.5 rounded-xl border border-chalk">
                  <div className="text-[9px] text-slate uppercase mb-0.5">Trạng thái camera</div>
                  <div className={`font-extrabold text-[11px] flex items-center gap-1 ${cam.anpr ? 'text-green-700' : 'text-slate-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cam.anpr ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    {cam.enabled ? 'Đang quan sát' : 'Chờ cảm biến / UI'}
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
                  <span className={`font-mono font-extrabold text-sm ${cam.enabled ? 'text-carbon' : 'text-slate-400'}`}>
                    {cam.lastPlate}
                  </span>
                  <span className="text-[10px] text-slate font-mono">{cam.lastTime}</span>
                </div>
              </div>

              <button
                onClick={() => setFullscreen(cam)}
                  disabled={!cam.connected}
                  className={`w-full h-9 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 ${cam.connected ? 'border-2 border-chalk text-slate hover:bg-fog hover:border-carbon hover:text-carbon' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
              >
                <span className="material-symbols-outlined text-sm">fullscreen</span>
                Toàn màn hình
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
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>XEM CAMERA TRỰC TIẾP
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
              src={gateService.getVideoFeedUrl(fullscreen.lane)}
              alt={`Camera ${fullscreen.gate} toàn màn hình`}
              className="w-full h-full object-cover opacity-85"
            />
            <div className="absolute top-4 left-4 bg-black/70 text-green-400 font-mono text-sm px-4 py-2 rounded-xl">LIVE · {fullscreen.gate} · {currentTime}</div>
          </div>
        </div>
      )}
    </div>
  )
}
