import React, { useState, useEffect, useRef, useMemo } from 'react'

const routePoints = [
  { x: 50, y: 320, desc: 'Cổng A', turn: 'straight', distance: 450, time: '3 min', voice: 'Đã check-in thành công tại Cổng A. Đi thẳng 250 mét trên đường nội bộ Road 01.' },
  { x: 180, y: 320, desc: 'Road 01', turn: 'straight', distance: 320, time: '2 min', voice: 'Tiếp tục đi thẳng trên đường Road 01.' },
  { x: 340, y: 320, desc: 'Ngã rẽ Block B', turn: 'turn_left', distance: 180, time: '1 min', voice: 'Chuẩn bị rẽ trái vào lối vào Khối bãi B.' },
  { x: 340, y: 220, desc: 'Lối vào Block B', turn: 'turn_right', distance: 100, time: '1 min', voice: 'Rẽ trái, sau đó rẽ phải ở lối vào Dãy 12.' },
  { x: 420, y: 220, desc: 'Dãy Row 12', turn: 'straight', distance: 40, time: '30 sec', voice: 'Rẽ phải vào Dãy 12. Đi thẳng tới Vị trí số 04.' },
  { x: 420, y: 110, desc: 'Vị trí B12-04', turn: 'arrive', distance: 0, time: '0 sec', voice: 'Bạn đã đến Vị trí B12-04. Vui lòng dừng xe và đợi cẩu RTG hạ container.' }
]

export default function DriverNavigation({ driverMode = 'pickup', tripStep = 1, setTripStep, onArrived }) {
  const [simProgress, setSimProgress] = useState(0) // 0 to 1
  const [isPlaying, setIsPlaying] = useState(true)
  const [speedMultiplier, setSpeedMultiplier] = useState(2) // Default 2x for faster demonstration
  const [mapTheme, setMapTheme] = useState('vector') // 'vector' | 'satellite' | 'night'
  const [isAutoCenter, setIsAutoCenter] = useState(true)
  const [isMuted, setIsMuted] = useState(true)
  const [isArrivedState, setIsArrivedState] = useState(false)

  // Map panning & zooming states
  const [zoom, setZoom] = useState(1.3)
  const [offset, setOffset] = useState({ x: 20, y: -80 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const mapRef = useRef(null)
  const prevVoiceRef = useRef('')

  // Interpolation helper for simulation coordinates
  const getInterpolatedPosition = (progress) => {
    const segments = [
      { start: { x: 50, y: 320 }, end: { x: 180, y: 320 }, len: 130 },
      { start: { x: 180, y: 320 }, end: { x: 340, y: 320 }, len: 160 },
      { start: { x: 340, y: 320 }, end: { x: 340, y: 220 }, len: 100 },
      { start: { x: 340, y: 220 }, end: { x: 420, y: 220 }, len: 80 },
      { start: { x: 420, y: 220 }, end: { x: 420, y: 110 }, len: 110 }
    ]
    const totalLen = segments.reduce((sum, s) => sum + s.len, 0)
    const targetDist = progress * totalLen

    let currentDist = 0
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i]
      if (targetDist <= currentDist + s.len) {
        const segProgress = (targetDist - currentDist) / s.len
        const x = s.start.x + (s.end.x - s.start.x) * segProgress
        const y = s.start.y + (s.end.y - s.start.y) * segProgress
        
        // Calculate heading angle
        const dx = s.end.x - s.start.x
        const dy = s.end.y - s.start.y
        const angle = Math.atan2(dy, dx) * (180 / Math.PI)
        
        // Dynamic speed simulation (slow down at corners)
        let speed = 24
        if (segProgress < 0.15 || segProgress > 0.85) {
          speed = 7
        } else if (i === 2 || i === 3) {
          speed = 10
        }
        
        return { x, y, angle, segmentIndex: i, speed }
      }
      currentDist += s.len
    }

    const lastSeg = segments[segments.length - 1]
    return { x: lastSeg.end.x, y: lastSeg.end.y, angle: -90, segmentIndex: segments.length - 1, speed: 0 }
  }

  // Get current state values
  const { vx, vy, vAngle, vSpeed, vSegIdx } = useMemo(() => {
    const pos = getInterpolatedPosition(simProgress)
    return {
      vx: pos.x,
      vy: pos.y,
      vAngle: pos.angle,
      vSpeed: pos.speed,
      vSegIdx: pos.segmentIndex
    }
  }, [simProgress])

  // Get current active instruction block
  const currentInstruction = useMemo(() => {
    if (simProgress < 0.05) return routePoints[0]
    if (simProgress < 0.28) return routePoints[1]
    if (simProgress < 0.55) return routePoints[2]
    if (simProgress < 0.72) return routePoints[3]
    if (simProgress < 0.90) return routePoints[4]
    return routePoints[5]
  }, [simProgress])

  // Map theme values
  const themeColors = useMemo(() => {
    switch (mapTheme) {
      case 'satellite':
        return {
          bgColor: '#161d24',
          gridColor: '#202a35',
          gridOpacity: 0.35,
          roadColor: '#2b3641',
          roadDashedColor: '#ffba08',
          blockBg: '#1e2630',
          blockStroke: '#374151',
          textMuted: '#94a3b8',
          pathColor: '#ff5500',
          waterColor: '#1b324d',
          pointerColor: '#ff5500'
        }
      case 'night':
        return {
          bgColor: '#070a13',
          gridColor: '#151e2e',
          gridOpacity: 0.4,
          roadColor: '#141d2b',
          roadDashedColor: '#00d2d3',
          blockBg: '#0f172a',
          blockStroke: '#1e293b',
          textMuted: '#64748b',
          pathColor: '#0984e3',
          waterColor: '#081220',
          pointerColor: '#0984e3'
        }
      case 'vector':
      default:
        return {
          bgColor: '#f8f9fa',
          gridColor: '#e9ecef',
          gridOpacity: 0.8,
          roadColor: '#cbd5e1',
          roadDashedColor: '#f59e0b',
          blockBg: '#ffffff',
          blockStroke: '#94a3b8',
          textMuted: '#64748b',
          pathColor: '#ff5500',
          waterColor: '#bae6fd',
          pointerColor: '#ff5500'
        }
    }
  }, [mapTheme])

  // Simulation play loop
  useEffect(() => {
    if (!isPlaying) return
    let lastTime = performance.now()
    let animationFrameId

    const tick = (time) => {
      const delta = (time - lastTime) / 1000 // seconds
      lastTime = time

      // Complete in ~35 seconds at 1x speed
      const step = (delta / 35) * speedMultiplier
      
      setSimProgress(prev => Math.min(prev + step, 1))

      animationFrameId = requestAnimationFrame(tick)
    }

    animationFrameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrameId)
  }, [isPlaying, speedMultiplier])

  // Stop playback when simulation finishes
  useEffect(() => {
    if (simProgress >= 1) {
      setIsPlaying(false)
    }
  }, [simProgress])

  // GPS Auto-Centering logic
  useEffect(() => {
    if (isAutoCenter) {
      // SVGs simulated center is roughly (220, 150)
      setOffset({
        x: 220 - vx * zoom,
        y: 150 - vy * zoom
      })
    }
  }, [vx, vy, zoom, isAutoCenter])

  // Voice speech synthesis
  useEffect(() => {
    if (!isMuted && currentInstruction.voice !== prevVoiceRef.current) {
      prevVoiceRef.current = currentInstruction.voice
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel()
          const utterance = new SpeechSynthesisUtterance(currentInstruction.voice)
          utterance.lang = 'vi-VN'
          utterance.rate = 1.05
          window.speechSynthesis.speak(utterance)
        }
      } catch (e) {
        console.warn('Speech synthesis unsupported or failed:', e)
      }
    }
  }, [currentInstruction, isMuted])

  // Mute speech synthesis on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // Drag interaction handlers
  const handleMouseDown = (e) => {
    setIsAutoCenter(false) // break lock
    setIsDragging(true)
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsAutoCenter(false)
      setIsDragging(true)
      dragStart.current = { x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y }
    }
  }

  const handleTouchMove = (e) => {
    if (!isDragging) return
    if (e.touches.length === 1) {
      setOffset({
        x: e.touches[0].clientX - dragStart.current.x,
        y: e.touches[0].clientY - dragStart.current.y
      })
    }
  }

  // Zoom helpers
  const handleZoomIn = () => setZoom(z => Math.min(z + 0.2, 4))
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.2, 0.6))
  const handleRecenter = () => {
    setIsAutoCenter(true)
    setZoom(1.3)
  }

  // Completion CTA trigger
  const handleArrivedClick = () => {
    setIsArrivedState(true)
    if (onArrived) onArrived()
  }

  // Render proper directional instruction icon
  const renderTurnIcon = (turn) => {
    switch (turn) {
      case 'turn_left':
        return <span className="material-symbols-outlined text-3xl text-white">turn_left</span>
      case 'turn_right':
        return <span className="material-symbols-outlined text-3xl text-white">turn_right</span>
      case 'arrive':
        return <span className="material-symbols-outlined text-3xl text-yellow-300">destination</span>
      case 'straight':
      default:
        return <span className="material-symbols-outlined text-3xl text-white">straight</span>
    }
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200 p-2 relative pb-28">
      
      {/* Route Animation Styles */}
      <style>{`
        @keyframes route-dash {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animate-route-dash {
          animation: route-dash 0.9s linear infinite;
        }
      `}</style>

      {/* TOP COMPACT GPS BAR */}
      <div className="bg-carbon text-white rounded-2xl p-4 shadow-lg flex items-center justify-between border border-gray-800">
        <div>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">KHOẢNG CÁCH CÒN LẠI</span>
          <div className="text-2xl font-extrabold text-signal-orange font-mono">
            {Math.round(450 * (1 - simProgress))}m
          </div>
        </div>
        
        <div className="h-8 w-px bg-gray-700"></div>
        
        <div>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">THỜI GIAN DỰ KIẾN</span>
          <div className="text-2xl font-extrabold text-white font-mono">
            {simProgress >= 0.9 ? '0s' : simProgress >= 0.7 ? '30s' : simProgress >= 0.5 ? '1m' : simProgress >= 0.3 ? '2m' : '3m'}
          </div>
        </div>

        <div className="h-8 w-px bg-gray-700"></div>

        <div className="text-right">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">TỐC ĐỘ XE</span>
          <div className="text-2xl font-extrabold text-green-400 font-mono">
            {vSpeed} <span className="text-[10px] font-bold font-sans text-gray-400">km/h</span>
          </div>
        </div>
      </div>

      {/* COMPACT VOICE ASSISTANT AUDIO NOTIFICATION */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-3 shadow-xs">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
            isMuted ? 'bg-slate-200 text-slate-600' : 'bg-signal-orange text-white'
          }`}
          title={isMuted ? "Bật âm thanh chỉ đường" : "Tắt âm thanh"}
        >
          <span className="material-symbols-outlined text-lg">
            {isMuted ? 'volume_off' : 'volume_up'}
          </span>
        </button>
        <div className="flex-1 text-[11px] text-orange-950 font-bold leading-tight">
          <span className="text-signal-orange text-[9px] block uppercase tracking-wider">Trợ Lý Giọng Nói GPT</span>
          {currentInstruction.voice}
        </div>
      </div>

      {/* INTERACTIVE NAVIGATION MAP BOX */}
      <div className="bg-white border-2 border-carbon rounded-3xl overflow-hidden shadow-md relative h-[320px] flex flex-col">
        
        {/* Map Top Overlay Controls */}
        <div className="absolute top-3 left-3 right-3 z-20 flex justify-between pointer-events-none">
          {/* Theme Selector */}
          <div className="flex bg-carbon/80 backdrop-blur-md p-1 rounded-xl border border-gray-700 pointer-events-auto">
            <button
              onClick={() => setMapTheme('vector')}
              className={`text-[9px] font-bold px-2 py-1.5 rounded-lg transition-colors ${
                mapTheme === 'vector' ? 'bg-white text-carbon' : 'text-gray-300 hover:text-white'
              }`}
            >
              2D Bản vẽ
            </button>
            <button
              onClick={() => setMapTheme('satellite')}
              className={`text-[9px] font-bold px-2 py-1.5 rounded-lg transition-colors ${
                mapTheme === 'satellite' ? 'bg-white text-carbon' : 'text-gray-300 hover:text-white'
              }`}
            >
              Vệ tinh
            </button>
            <button
              onClick={() => setMapTheme('night')}
              className={`text-[9px] font-bold px-2 py-1.5 rounded-lg transition-colors ${
                mapTheme === 'night' ? 'bg-white text-carbon' : 'text-gray-300 hover:text-white'
              }`}
            >
              Ban đêm
            </button>
          </div>

          {/* Compass Rose Indicator */}
          <div className="w-8 h-8 rounded-full bg-carbon/85 border border-gray-700 flex items-center justify-center text-white text-xs pointer-events-auto shadow">
            <span
              className="material-symbols-outlined text-lg transition-transform duration-200"
              style={{ transform: `rotate(${-vAngle - 90}deg)` }}
            >
              explore
            </span>
          </div>
        </div>

        {/* Map Right Floating Controls */}
        <div className="absolute right-3 bottom-3 z-20 flex flex-col gap-2 pointer-events-auto">
          {/* Zoom & Recenter controls */}
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-lg bg-carbon/85 border border-gray-700 text-white flex items-center justify-center hover:bg-black shadow"
            title="Phóng to"
          >
            <span className="material-symbols-outlined text-lg">zoom_in</span>
          </button>
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-lg bg-carbon/85 border border-gray-700 text-white flex items-center justify-center hover:bg-black shadow"
            title="Thu nhỏ"
          >
            <span className="material-symbols-outlined text-lg">zoom_out</span>
          </button>
          <button
            onClick={handleRecenter}
            className={`w-8 h-8 rounded-lg border text-white flex items-center justify-center shadow transition-all ${
              isAutoCenter 
                ? 'bg-signal-orange border-orange-600' 
                : 'bg-carbon/85 border-gray-700 hover:bg-black'
            }`}
            title="Khóa vị trí xe"
          >
            <span className="material-symbols-outlined text-lg">my_location</span>
          </button>
        </div>

        {/* Legend Overlay at Bottom Left */}
        <div className="absolute left-3 bottom-3 z-20 bg-carbon/80 backdrop-blur-md text-[9px] text-gray-300 p-2 rounded-xl border border-gray-700 font-bold space-y-1 select-none pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ff5500]"></span>
            <span>Tuyến đi của bạn</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-slate-500"></span>
            <span>Đường nội bộ Cảng</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 inline-block border border-[#ff5500] bg-orange-500/20"></span>
            <span>Vị trí Cont chỉ định</span>
          </div>
        </div>

        {/* ACTUAL RENDERED MAP CONTAINER (DRAGGABLE & ZOOMABLE) */}
        <div className="flex-1 overflow-hidden relative" style={{ backgroundColor: themeColors.bgColor }}>
          <svg
            ref={mapRef}
            viewBox="0 0 600 400"
            className="w-full h-full select-none cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          >
            {/* Grid Definition */}
            <defs>
              <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke={themeColors.gridColor} strokeWidth="1" opacity={themeColors.gridOpacity} />
              </pattern>
              <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Transform Group */}
            <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
              
              {/* Grid Background Overlay */}
              <rect width="2000" height="2000" x="-1000" y="-1000" fill="url(#gridPattern)" />

              {/* Water Area (Shipping Channel) */}
              <rect x="-300" y="-300" width="310" height="1200" fill={themeColors.waterColor} opacity="0.6" rx="8" />
              <text x="-150" y="200" fill={themeColors.textMuted} fontSize="14" fontWeight="bold" fontFamily="monospace" transform="rotate(-90 -150 200)" opacity="0.5" textAnchor="middle">
                LUỒNG TÀU CONTAINER - PORT WATER
              </text>

              {/* Roads Underlay */}
              {/* Road 01 */}
              <rect x="-100" y="300" width="900" height="40" fill={themeColors.roadColor} rx="4" />
              <line x1="-100" y1="320" x2="800" y2="320" stroke={themeColors.roadDashedColor} strokeWidth="1.5" strokeDasharray="10,10" opacity="0.8" />
              <text x="5" y="337" fill={themeColors.textMuted} fontSize="8" fontWeight="bold" fontFamily="monospace">ROAD 01</text>
              
              {/* Block B Access Road */}
              <rect x="325" y="180" width="30" height="140" fill={themeColors.roadColor} />
              
              {/* Horizontal corridor inside Block B */}
              <rect x="325" y="205" width="115" height="30" fill={themeColors.roadColor} />
              
              {/* Row 12 Road */}
              <rect x="408" y="130" width="24" height="90" fill={themeColors.roadColor} />
              <text x="420" y="180" fill={themeColors.textMuted} fontSize="6" fontWeight="bold" fontFamily="monospace" transform="rotate(-90 420 180)" textAnchor="middle">ROW 12</text>

              {/* Block C Access Road (for Delivery Mode) */}
              <rect x="118" y="110" width="24" height="210" fill={themeColors.roadColor} />
              
              {/* Horizontal corridor to Row 05 (Block C) */}
              <rect x="118" y="125" width="45" height="30" fill={themeColors.roadColor} />
              
              {/* Row 05 Road */}
              <rect x="138" y="30" width="24" height="110" fill={themeColors.roadColor} />
              <text x="150" y="90" fill={themeColors.textMuted} fontSize="6" fontWeight="bold" fontFamily="monospace" transform="rotate(-90 150 90)" textAnchor="middle">ROW 05</text>

              {/* BLOCK A */}
              <rect x="80" y="140" width="160" height="120" fill={themeColors.blockBg} stroke={themeColors.blockStroke} strokeWidth="2" rx="8" />
              <text x="160" y="250" fill={themeColors.textMuted} fontSize="10" fontWeight="extrabold" textAnchor="middle" fontFamily="monospace">BLOCK A (DRY)</text>
              
              {/* Container Stacks inside Block A */}
              <g opacity="0.65">
                <rect x="90" y="150" width="18" height="36" fill="#20bf6b" rx="2" />
                <rect x="112" y="150" width="18" height="36" fill="#eb3b5a" rx="2" />
                <rect x="134" y="150" width="18" height="36" fill="#4b7bec" rx="2" />
                <rect x="156" y="150" width="18" height="36" fill="#fa8231" rx="2" />
                <rect x="178" y="150" width="18" height="36" fill="#8854d0" rx="2" />
                <rect x="200" y="150" width="18" height="36" fill="#2d98da" rx="2" />
                
                <rect x="90" y="195" width="18" height="36" fill="#4b7bec" rx="2" />
                <rect x="112" y="195" width="18" height="36" fill="#fa8231" rx="2" />
                <rect x="134" y="195" width="18" height="36" fill="#20bf6b" rx="2" />
                <rect x="156" y="195" width="18" height="36" fill="#cbd5e1" rx="2" opacity="0.3" />
                <rect x="178" y="195" width="18" height="36" fill="#8854d0" rx="2" />
                <rect x="200" y="195" width="18" height="36" fill="#eb3b5a" rx="2" />
              </g>

              {/* BLOCK C (Drawn fully for Delivery Mode) */}
              <rect x="80" y="15" width="160" height="90" fill={themeColors.blockBg} stroke={themeColors.blockStroke} strokeWidth="2" rx="8" />
              <text x="160" y="25" fill={themeColors.textMuted} fontSize="8" fontWeight="extrabold" textAnchor="middle" fontFamily="monospace">BLOCK C (EXPORT)</text>
              
              {/* Container Stacks inside Block C */}
              <g opacity="0.65">
                <rect x="90" y="30" width="18" height="30" fill="#eb3b5a" rx="2" />
                <rect x="112" y="30" width="18" height="30" fill="#20bf6b" rx="2" />
                {/* Row 05 target slot left blank */}
                <rect x="178" y="30" width="18" height="30" fill="#4b7bec" rx="2" />
                <rect x="200" y="30" width="18" height="30" fill="#fa8231" rx="2" />

                <rect x="90" y="68" width="18" height="30" fill="#2d98da" rx="2" />
                <rect x="112" y="68" width="18" height="30" fill="#8854d0" rx="2" />
                {/* Row 05 target slot C05-02 is at y=50 */}
                <rect x="178" y="68" width="18" height="30" fill="#eb3b5a" rx="2" />
                <rect x="200" y="68" width="18" height="30" fill="#20bf6b" rx="2" />
              </g>

              {/* BLOCK B */}
              <rect x="300" y="60" width="240" height="120" fill={themeColors.blockBg} stroke={themeColors.blockStroke} strokeWidth="2" rx="8" />
              <text x="420" y="72" fill={themeColors.textMuted} fontSize="10" fontWeight="extrabold" textAnchor="middle" fontFamily="monospace">BLOCK B (REEFER/IMPORT)</text>

              {/* Container Stacks inside Block B */}
              <g opacity="0.65">
                <rect x="310" y="80" width="18" height="36" fill="#fa8231" rx="2" />
                <rect x="332" y="80" width="18" height="36" fill="#20bf6b" rx="2" />
                <rect x="354" y="80" width="18" height="36" fill="#4b7bec" rx="2" />
                {/* Row 12 target space left empty here for destination */}
                <rect x="444" y="80" width="18" height="36" fill="#eb3b5a" rx="2" />
                <rect x="466" y="80" width="18" height="36" fill="#20bf6b" rx="2" />
                <rect x="488" y="80" width="18" height="36" fill="#fa8231" rx="2" />

                <rect x="310" y="130" width="18" height="36" fill="#eb3b5a" rx="2" />
                <rect x="332" y="130" width="18" height="36" fill="#4b7bec" rx="2" />
                <rect x="354" y="130" width="18" height="36" fill="#8854d0" rx="2" />
                {/* Row 12 target area */}
                <rect x="444" y="130" width="18" height="36" fill="#2d98da" rx="2" />
                <rect x="466" y="130" width="18" height="36" fill="#8854d0" rx="2" />
                <rect x="488" y="130" width="18" height="36" fill="#eb3b5a" rx="2" />
              </g>

              {/* ROUTE PATH INDICATOR */}
              <path
                d={driverMode === 'delivery' 
                  ? "M 200 320 L 130 320 L 130 140 L 150 140 L 150 50"
                  : "M 50 320 L 180 320 L 340 320 L 340 220 L 420 220 L 420 110"
                }
                fill="none"
                stroke={themeColors.pathColor}
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.8"
              />
              <path
                d={driverMode === 'delivery' 
                  ? "M 200 320 L 130 320 L 130 140 L 150 140 L 150 50"
                  : "M 50 320 L 180 320 L 340 320 L 340 220 L 420 220 L 420 110"
                }
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="8,8"
                className="animate-route-dash"
              />

              {/* TARGET DESTINATION CONTAINER HIGHLIGHT */}
              {driverMode === 'delivery' ? (
                <g transform="translate(150, 50)">
                  <circle r="12" fill="none" stroke="#20bf6b" strokeWidth="2" className="animate-ping" filter="url(#glowFilter)" />
                  <rect x="-8" y="-12" width="16" height="24" fill="rgba(32, 191, 107, 0.25)" stroke="#20bf6b" strokeWidth="1.5" rx="2" className="animate-pulse" />
                  <text y="-16" fill="#20bf6b" fontSize="8" fontWeight="extrabold" textAnchor="middle" fontFamily="monospace">C05-02</text>
                </g>
              ) : (
                <g transform="translate(420, 110)">
                  <circle r="14" fill="none" stroke="#ff5500" strokeWidth="2" className="animate-ping" filter="url(#glowFilter)" />
                  <rect x="-10" y="-18" width="20" height="36" fill="rgba(255, 85, 0, 0.25)" stroke="#ff5500" strokeWidth="2" rx="2" className="animate-pulse" />
                  <text y="-22" fill="#ff5500" fontSize="8" fontWeight="extrabold" textAnchor="middle" fontFamily="monospace">B12-04</text>
                </g>
              )}

              {/* STARTING GATE A BOOTH & FLAG */}
              {driverMode === 'delivery' ? (
                <g transform="translate(200, 320)">
                  <circle r="6" fill="#2d98da" stroke="#ffffff" strokeWidth="1.5" />
                  <text y="15" fill="#2d98da" fontSize="8" fontWeight="extrabold" textAnchor="middle" fontFamily="monospace">GATE B</text>
                </g>
              ) : (
                <g transform="translate(50, 320)">
                  <circle r="6" fill="#20bf6b" stroke="#ffffff" strokeWidth="1.5" />
                  <text y="15" fill="#20bf6b" fontSize="8" fontWeight="extrabold" textAnchor="middle" fontFamily="monospace">GATE A</text>
                </g>
              )}

              {/* TRUCK / VEHICLE INDICATOR (SMOOTH ROTATED VALUE) */}
              <g transform={`translate(${vx}, ${vy}) rotate(${vAngle})`}>
                <circle r="15" fill={themeColors.pointerColor} opacity="0.3" className="animate-ping" />
                <circle r="9" fill={themeColors.pointerColor} stroke="#ffffff" strokeWidth="1.5" shadow="0 2px 4px rgba(0,0,0,0.5)" />
                {/* Heading indicator arrowhead */}
                <path d="M 4 -3 L 8 0 L 4 3 L 4 1 L -4 1 L -4 -1 L 4 -1 Z" fill="#ffffff" />
              </g>

            </g>
          </svg>
        </div>
      </div>

      {/* GPS PLAYBACK & CONTROLLER HUD */}
      <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-all shadow ${
              isPlaying ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            <span className="material-symbols-outlined text-xl">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>
          
          {/* Replay */}
          <button
            onClick={() => { setSimProgress(0); setIsPlaying(true); }}
            className="w-10 h-10 rounded-full bg-fog border border-chalk text-carbon flex items-center justify-center hover:bg-slate-200 transition-colors shadow-2xs"
            title="Khởi động lại mô phỏng"
          >
            <span className="material-symbols-outlined text-xl">replay</span>
          </button>
        </div>

        {/* Speed Multiplier selectors */}
        <div className="flex items-center gap-1.5 bg-fog p-1 rounded-xl border border-chalk">
          <span className="text-[10px] font-bold text-slate px-2">Tốc độ mô phỏng:</span>
          {[1, 2, 5].map(mult => (
            <button
              key={mult}
              onClick={() => setSpeedMultiplier(mult)}
              className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg transition-all ${
                speedMultiplier === mult ? 'bg-carbon text-white shadow-xs' : 'text-slate hover:text-carbon'
              }`}
            >
              {mult}x
            </button>
          ))}
        </div>

        {/* Progress Slider (Manually seek route position) */}
        <div className="w-full flex items-center gap-3 mt-1">
          <span className="text-[10px] font-bold text-slate whitespace-nowrap">Tiến trình:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={simProgress}
            onChange={(e) => {
              setIsPlaying(false)
              setSimProgress(parseFloat(e.target.value))
            }}
            className="flex-1 accent-signal-orange h-1.5 bg-chalk rounded-full appearance-none cursor-pointer"
          />
          <span className="text-xs font-mono font-bold text-carbon w-10 text-right">
            {Math.round(simProgress * 100)}%
          </span>
        </div>
      </div>

      {/* CURRENT NAVIGATION DIRECTIVE CARD */}
      <div className="bg-white border-2 border-carbon rounded-2xl p-5 shadow-sm flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-carbon text-white flex items-center justify-center font-bold shrink-0 shadow">
          {renderTurnIcon(currentInstruction.turn)}
        </div>
        <div className="flex-1">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">CHỈ DẪN DI CHUYỂN HIỆN TẠI</span>
          <h3 className="font-extrabold text-carbon text-base mt-0.5">
            {currentInstruction.desc === 'Vị trí B12-04' 
              ? 'ĐÃ ĐẾN ĐIỂM CHỈ ĐỊNH' 
              : currentInstruction.turn === 'turn_left' 
              ? 'Chuẩn bị rẽ trái' 
              : currentInstruction.turn === 'turn_right' 
              ? 'Chuẩn bị rẽ phải' 
              : 'Đi thẳng'}
          </h3>
          <p className="text-xs text-slate mt-0.5">
            {simProgress >= 0.9 
              ? 'Vui lòng đỗ đúng vị trí hàng Row 12.' 
              : `Sau khi hoàn tất chặng, tiếp tục đi đến ${routePoints[vSegIdx + 1]?.desc || 'Điểm bãi'}`}
          </p>
        </div>
      </div>

      {/* MAIN ARRIED CTA CONFIRMATION BUTTON */}
      <div className="pt-2">
        <button
          onClick={handleArrivedClick}
          className={`w-full h-14 rounded-2xl font-extrabold text-base transition-all shadow-lg flex items-center justify-center gap-2 ${
            simProgress >= 1 
              ? 'bg-green-600 hover:bg-green-700 text-white animate-pulse' 
              : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
          disabled={simProgress < 0.95 && !isArrivedState}
        >
          <span className="material-symbols-outlined text-xl">location_on</span>
          {simProgress >= 1 ? 'XÁC NHẬN ĐÃ ĐẾN VỊ TRÍ' : 'VUI LÒNG DI CHUYỂN ĐÚNG VỊ TRÍ'}
        </button>
      </div>

    </div>
  )
}
