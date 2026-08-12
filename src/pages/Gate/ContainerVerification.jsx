import React, { useState, useEffect } from 'react'

// Demo datasets for testing different OCR scenarios
const DEMO_SCENARIOS = {
  match: {
    expected: {
      bookingId: 'GB-20260811-001',
      containerId: 'MSCU1234567',
      containerType: '40HC',
      sealNumber: 'SL-928371',
      company: 'Maersk Line',
      vehicle: 'TRK-001 (Biển số NEX 8922)',
      driver: 'Nguyễn Văn A',
      status: 'READY FOR PICKUP',
    },
    detected: {
      containerId: 'MSCU1234567',
      sealNumber: 'SL-928371',
      containerType: '40HC',
      confidence: 99.8,
    },
    status: 'MATCH',
  },
  low_confidence: {
    expected: {
      bookingId: 'GB-20260811-003',
      containerId: 'EVER991203',
      containerType: '40HC',
      sealNumber: 'SL-334892',
      company: 'Evergreen Marine',
      vehicle: 'TRK-008 (Biển số 15C-882.19)',
      driver: 'Lê Văn C',
      status: 'READY FOR PICKUP',
    },
    detected: {
      containerId: 'EVER991203',
      sealNumber: 'SL-3348??',
      containerType: '40HC',
      confidence: 84.5,
    },
    status: 'NEEDS_MANUAL',
  },
  mismatch: {
    expected: {
      bookingId: 'GB-20260811-007',
      containerId: 'NYKU112233',
      containerType: '40HC',
      sealNumber: 'SL-998877',
      company: 'ONE Line / Phú Xuân Logistics',
      vehicle: 'TRK-030 (Biển số 75C-112.99)',
      driver: 'Phan Văn N',
      status: 'READY FOR DELIVERY',
    },
    detected: {
      containerId: 'MSKU9988231',
      sealNumber: 'SL-776655',
      containerType: '20FT',
      confidence: 94.2,
    },
    status: 'MISMATCH',
  },
}

export default function ContainerVerification() {
  const [scenarioKey, setScenarioKey] = useState('match')
  const [scanning, setScanning] = useState(false)
  const [scanComplete, setScanComplete] = useState(true)
  const [scanProgress, setScanProgress] = useState(100)
  const [toastMessage, setToastMessage] = useState('')
  const [timeString, setTimeString] = useState('')

  // Manual verification modal state
  const [showManualModal, setShowManualModal] = useState(false)
  const [isManualVerified, setIsManualVerified] = useState(false)
  const [manualForm, setManualForm] = useState({
    containerId: '',
    sealNumber: '',
    containerType: '40HC',
    chkContainerPhysical: true,
    chkSealIntact: true,
    chkNoDamage: true,
    notes: '',
  })

  // Incident modal state
  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [incidentReason, setIncidentReason] = useState('')

  // Inspection history list
  const [history, setHistory] = useState([
    { time: '14:02', method: 'OCR', result: 'Match 99.8%', officer: 'Gate A - Nguyễn Văn Hùng', status: 'Passed' },
    { time: '09:15', method: 'Manual', result: 'Verified', officer: 'Gate B - Trần Thị Mai', status: 'Passed' },
    { time: '08:45', method: 'OCR', result: 'Mismatch (Wrong Container)', officer: 'Gate A - Nguyễn Văn Hùng', status: 'Failed' },
  ])

  // Real-time clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeString(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' - ' + now.toLocaleDateString('vi-VN'))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  const scenario = DEMO_SCENARIOS[scenarioKey]
  const expected = scenario.expected
  const detected = scenario.detected

  // Determine current verification state
  const isOcrMatch = expected.containerId === detected.containerId && expected.sealNumber === detected.sealNumber && detected.confidence >= 90
  const isCleared = isManualVerified || (isOcrMatch && scenarioKey === 'match')

  // Switch demo scenarios
  const handleSwitchScenario = (key) => {
    setScenarioKey(key)
    setIsManualVerified(false)
    setScanComplete(true)
    setScanProgress(100)
    setManualForm({
      containerId: DEMO_SCENARIOS[key].expected.containerId,
      sealNumber: DEMO_SCENARIOS[key].expected.sealNumber,
      containerType: DEMO_SCENARIOS[key].expected.containerType,
      chkContainerPhysical: true,
      chkSealIntact: true,
      chkNoDamage: true,
      notes: '',
    })
    showToast(`🔄 Đã chuyển kịch bản demo: ${key.toUpperCase()}`)
  }

  // Trigger camera OCR scan
  const handleStartOCRScan = () => {
    setScanning(true)
    setScanComplete(false)
    setScanProgress(0)
    setIsManualVerified(false)
    let p = 0
    const interval = setInterval(() => {
      p += 20
      setScanProgress(p)
      if (p >= 100) {
        clearInterval(interval)
        setScanning(false)
        setScanComplete(true)
        showToast('📷 Hoàn tất quét Camera OCR Container!')
      }
    }, 150)
  }

  // Open Manual Verification Modal
  const openManualModal = () => {
    setManualForm({
      containerId: expected.containerId,
      sealNumber: expected.sealNumber,
      containerType: expected.containerType,
      chkContainerPhysical: true,
      chkSealIntact: true,
      chkNoDamage: true,
      notes: '',
    })
    setShowManualModal(true)
  }

  // Submit Manual Verification Form
  const handleConfirmManualVerification = (e) => {
    e.preventDefault()
    if (!manualForm.containerId.trim() || !manualForm.sealNumber.trim()) {
      showToast('❌ Bắt buộc nhập Mã Container và Số Niêm Phong Seal!')
      return
    }
    setIsManualVerified(true)
    setShowManualModal(false)
    
    // Add to history table
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    setHistory(prev => [
      { time: nowTime, method: 'Manual', result: 'Verified (Chính Xác)', officer: 'Gate A - Nguyễn Văn Hùng', status: 'Passed' },
      ...prev
    ])

    showToast(`✅ Đã xác nhận kiểm tra thủ công thành công cho Container ${manualForm.containerId}`)
  }

  // Gate Decision Handlers
  const handleAllowGateIn = () => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    setHistory(prev => [
      { time: nowTime, method: isManualVerified ? 'Manual' : 'OCR', result: `Gate Cleared (${isManualVerified ? 'Verified' : 'Match 99.8%'})`, officer: 'Gate A - Nguyễn Văn Hùng', status: 'Passed' },
      ...prev
    ])
    showToast(`🟢 ĐÃ DUYỆT CHO PHÉP XE CHO CONTAINER ${expected.containerId} QUA CỔNG (GATE IN)!`)
  }

  const handleBlockEntry = () => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    setHistory(prev => [
      { time: nowTime, method: 'OCR/Gate', result: 'Blocked (Từ Chối Cổng)', officer: 'Gate A - Nguyễn Văn Hùng', status: 'Failed' },
      ...prev
    ])
    showToast(`⛔ ĐÃ TỪ CHỐI CHO XE VÀO CỔNG: Container ${detected.containerId} sai lệch thông tin so với Gate Booking.`)
  }

  const handleReportIncident = (e) => {
    e.preventDefault()
    setShowIncidentModal(false)
    showToast(`🚩 Đã gắn cờ sự cố (Incident Reported): "${incidentReason || 'Sai lệch container tại cổng'}" đến Dispatcher.`)
    setIncidentReason('')
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen relative text-slate-900">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-slate-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-extrabold flex items-center gap-3 z-[100] animate-bounce border border-orange-500">
          <span className="text-orange-500">●</span>{toastMessage}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold bg-orange-100 text-orange-800 border border-orange-300 px-3 py-0.5 rounded-full uppercase">
              GATE OFFICER
            </span>
            <span className="text-xs font-mono font-bold text-slate-600">Kiểm tra container qua Camera / OCR & Thủ công</span>
          </div>
          <h2 className="font-heading text-3xl font-extrabold text-slate-900">Container Verification</h2>
          <p className="text-xs text-slate-600 mt-0.5">Đối chiếu container thực tế với thông tin Gate Booking bằng OCR và kiểm tra thủ công.</p>
        </div>

        {/* Right Corner: Live Status & Demo Scenarios Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-700 uppercase font-sans">LIVE</span>
            <span className="text-slate-300">|</span>
            <span>{timeString}</span>
          </div>

          {/* Demo Scenario Selector Pill */}
          <div className="flex items-center bg-slate-100 border border-slate-300 rounded-xl p-1 text-xs font-extrabold">
            <button onClick={() => handleSwitchScenario('match')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${scenarioKey === 'match' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'}`}>
              ✓ Match (99.8%)
            </button>
            <button onClick={() => handleSwitchScenario('low_confidence')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${scenarioKey === 'low_confidence' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'}`}>
              ⚠ Low Confidence (84%)
            </button>
            <button onClick={() => handleSwitchScenario('mismatch')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${scenarioKey === 'mismatch' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'}`}>
              ✕ Mismatch
            </button>
          </div>
        </div>
      </div>

      {/* ── KHU VỰC 1 — EXPECTED BOOKING ── */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2 font-heading text-base font-extrabold text-slate-900">
            <span className="material-symbols-outlined text-blue-600">assignment</span>
            EXPECTED BOOKING (THÔNG TIN GATE BOOKING KỲ VỌNG)
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-900 border border-blue-300 rounded-full text-xs font-mono font-extrabold">
            STATUS: {expected.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs font-mono">
          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Booking ID</span>
            <strong className="text-blue-800 font-extrabold text-sm">{expected.bookingId}</strong>
          </div>
          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Container ID</span>
            <strong className="text-slate-900 font-black text-sm">{expected.containerId}</strong>
          </div>
          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Container Type</span>
            <strong className="text-slate-900 font-bold">{expected.containerType}</strong>
          </div>
          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Seal Number</span>
            <strong className="text-purple-800 font-extrabold">{expected.sealNumber}</strong>
          </div>
          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 col-span-2 sm:col-span-2">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Hãng Tàu / Vận Tải</span>
            <strong className="text-slate-900 font-bold truncate block">{expected.company}</strong>
          </div>
          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Phương Tiện</span>
            <strong className="text-slate-900 font-bold">{expected.vehicle}</strong>
          </div>
          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Tài Xế</span>
            <strong className="text-slate-900 font-bold">{expected.driver}</strong>
          </div>
        </div>
      </div>

      {/* ── KHU VỰC 2 — CAMERA / OCR ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Card Lớn: Camera Viewport với Overlay OCR */}
        <div className="lg:col-span-2 bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600 text-base">videocam</span>
              REALTIME CONTAINER ANPR/OCR CAMERA FEED
            </span>
            <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2.5 py-1 rounded border border-slate-700">
              CAM-01 · GATE A
            </span>
          </div>

          {/* Camera Viewport Canvas */}
          <div className="relative bg-slate-950 aspect-video rounded-2xl overflow-hidden shadow-xl border border-slate-800 flex items-center justify-center group">
            {/* Realtime Camera Background Image */}
            <img src="/images/container_ocr_camera.jpg" alt="Container OCR Camera Feed"
              className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-[1.02] transition-transform duration-500" />
            
            {/* HUD Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/60 pointer-events-none"></div>

            {/* Camera REC Badge */}
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-slate-900/90 text-white px-3 py-1 rounded-xl border border-slate-700 text-[10px] font-mono font-bold z-10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              REC · 1080P @ 60FPS · ANPR-CAM-01
            </div>

            {/* Bounding box simulation overlay around Container ID */}
            {scanComplete && (
              <div className={`absolute top-1/4 left-1/4 right-1/4 bottom-1/3 border-2 border-dashed rounded-xl p-3 flex flex-col justify-between transition-all ${
                isOcrMatch ? 'border-emerald-400 bg-emerald-950/40' : scenarioKey === 'low_confidence' ? 'border-amber-400 bg-amber-950/40' : 'border-red-400 bg-red-950/40'
              }`}>
                <div className="flex justify-between items-center text-[10px] font-mono font-black uppercase">
                  <span className={`px-2 py-0.5 rounded ${isOcrMatch ? 'bg-emerald-500 text-slate-950' : scenarioKey === 'low_confidence' ? 'bg-amber-500 text-slate-950' : 'bg-red-500 text-white'}`}>
                    {isOcrMatch ? '✓ CONTAINER DETECTED' : scenarioKey === 'low_confidence' ? '⚠ LOW CONFIDENCE' : '✕ CONTAINER MISMATCH'}
                  </span>
                  <span className="bg-slate-900/90 text-white px-2 py-0.5 rounded border border-slate-700">
                    Confidence: {detected.confidence}%
                  </span>
                </div>

                <div className="font-mono text-center my-auto">
                  <div className="text-2xl font-black tracking-widest text-white drop-shadow-md">
                    {detected.containerId}
                  </div>
                  <div className="text-xs font-bold text-amber-300 mt-1 font-mono">
                    SEAL DETECTED: {detected.sealNumber}
                  </div>
                </div>

                <div className="text-[9px] font-mono text-slate-300 text-right">
                  ISO TYPE: {detected.containerType}
                </div>
              </div>
            )}

            {/* Scanning Line Animation */}
            {scanning && (
              <div className="absolute inset-0 bg-gradient-to-b from-orange-500/0 via-orange-500/30 to-orange-500/0 border-b-2 border-orange-500 animate-pulse pointer-events-none flex items-center justify-center">
                <div className="bg-slate-900/90 text-orange-400 border border-orange-500 px-4 py-1.5 rounded-full font-mono text-xs font-extrabold animate-bounce">
                  ⚡ OCR SCANNING IN PROGRESS ({scanProgress}%)
                </div>
              </div>
            )}
          </div>

          {/* Action buttons under camera */}
          <div className="flex gap-2 pt-2">
            <button onClick={handleStartOCRScan} disabled={scanning}
              className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-extrabold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer">
              <span className="material-symbols-outlined text-sm">photo_camera</span>
              [ 🎥 Quét Lại OCR Container ]
            </button>
            
            <button onClick={openManualModal}
              className="px-5 h-11 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-extrabold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer">
              <span className="material-symbols-outlined text-sm">edit_note</span>
              [ 🛠️ Kiểm Tra Thủ Công ]
            </button>
          </div>
        </div>

        {/* Card Bên Cạnh: DETECTED BY OCR */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <span className="material-symbols-outlined text-orange-600 text-lg">camera</span>
              <h3 className="font-heading text-base font-extrabold text-slate-900">DETECTED BY OCR</h3>
            </div>

            <div className="mt-4 space-y-3 text-xs font-mono">
              <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Container ID</span>
                  <strong className="text-base text-slate-900 font-black">{detected.containerId}</strong>
                </div>
                <span className={`font-black text-base ${expected.containerId === detected.containerId ? 'text-emerald-600' : 'text-red-600'}`}>
                  {expected.containerId === detected.containerId ? '✓' : '✕'}
                </span>
              </div>

              <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Seal Number</span>
                  <strong className="text-base text-purple-900 font-extrabold">{detected.sealNumber}</strong>
                </div>
                <span className={`font-black text-base ${expected.sealNumber === detected.sealNumber ? 'text-emerald-600' : 'text-red-600'}`}>
                  {expected.sealNumber === detected.sealNumber ? '✓' : '✕'}
                </span>
              </div>

              <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Container Type</span>
                  <strong className="text-slate-900 font-bold">{detected.containerType}</strong>
                </div>
                <span className="font-black text-base text-emerald-600">✓</span>
              </div>

              <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">OCR Confidence</span>
                  <strong className={`text-base font-black ${detected.confidence >= 90 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {detected.confidence}%
                  </strong>
                </div>
                <span className={`px-2 py-0.5 rounded font-sans font-bold text-[10px] ${detected.confidence >= 90 ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
                  {detected.confidence >= 90 ? 'HIGH' : 'LOW'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-[11px] text-slate-600 font-sans">
            💡 <strong>Ghi chú:</strong> Hệ thống tự động so khớp mã OCR đọc được từ camera với Gate Booking đã duyệt. Gate Officer có quyền ghi đè kết quả bằng xác minh thủ công.
          </div>
        </div>

      </div>

      {/* ── KHU VỰC 3 — VERIFICATION RESULT & DIRECT COMPARISON ── */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">checklist_rtl</span>
            VERIFICATION RESULT (KẾT QUẢ ĐỐI SOÁT CONTAINER)
          </h3>
          {isManualVerified && (
            <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-mono font-bold">
              🛠️ ĐÃ XÁC NHẬN KIỂM TRA THỦ CÔNG
            </span>
          )}
        </div>

        {/* Result Banner */}
        {isCleared ? (
          <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-5 flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-600 text-3xl">verified</span>
            <div>
              <div className="font-black text-emerald-950 text-base">🟢 MATCH — CONTAINER VERIFIED</div>
              <div className="text-xs text-emerald-900 font-bold mt-0.5">
                {isManualVerified
                  ? '✓ Container đã được Gate Officer kiểm tra thủ công nguyên vẹn và xác nhận chính xác.'
                  : '✓ Mã container và số seal OCR khớp 100% với Gate Booking kỳ vọng.'}
              </div>
            </div>
          </div>
        ) : scenarioKey === 'low_confidence' ? (
          <div className="bg-amber-50 border-2 border-amber-500 rounded-2xl p-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-600 text-3xl">warning</span>
              <div>
                <div className="font-black text-amber-950 text-base">🟡 NEEDS MANUAL VERIFICATION</div>
                <div className="text-xs text-amber-900 font-bold mt-0.5">
                  Độ chính xác OCR dưới 90% (Seal mờ). Vui lòng thực hiện kiểm tra thủ công trước khi duyệt cho qua cổng.
                </div>
              </div>
            </div>
            <button onClick={openManualModal}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer shrink-0">
              Kiểm Tra Thủ Công Ngay
            </button>
          </div>
        ) : (
          <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-5 flex items-center gap-3">
            <span className="material-symbols-outlined text-red-600 text-3xl">gpp_bad</span>
            <div>
              <div className="font-black text-red-950 text-base">🔴 MISMATCH — ENTRY BLOCKED</div>
              <div className="text-xs text-red-900 font-bold mt-0.5">
                ✕ Sai lệch thông tin: Mã container hoặc số chì seal thực tế không đúng với thông tin đăng ký trong Gate Booking.
              </div>
            </div>
          </div>
        )}

        {/* Direct Comparison Grid (EXPECTED ↔ DETECTED) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* EXPECTED Column */}
          <div className="bg-blue-50/80 border-2 border-blue-300 rounded-2xl p-4 space-y-3">
            <div className="text-xs font-black text-blue-900 uppercase tracking-wider border-b border-blue-200 pb-2">
              EXPECTED (Kỳ vọng trong Booking)
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-blue-800 font-bold font-sans">Container ID:</span>
                <strong className="text-slate-900 font-black text-sm">{expected.containerId}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-800 font-bold font-sans">Seal Number:</span>
                <strong className="text-purple-900 font-bold">{expected.sealNumber}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-800 font-bold font-sans">Container Type:</span>
                <strong className="text-slate-900 font-bold">{expected.containerType}</strong>
              </div>
            </div>
          </div>

          {/* DETECTED Column */}
          <div className={`border-2 rounded-2xl p-4 space-y-3 ${
            isCleared ? 'bg-emerald-50/80 border-emerald-400' : 'bg-red-50/80 border-red-400'
          }`}>
            <div className={`text-xs font-black uppercase tracking-wider border-b pb-2 ${
              isCleared ? 'text-emerald-900 border-emerald-200' : 'text-red-900 border-red-200'
            }`}>
              DETECTED ({isManualVerified ? 'Xác Minh Thủ Công' : 'Camera OCR'})
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="font-bold font-sans text-slate-700">Container ID:</span>
                <strong className={`font-black text-sm ${
                  (isManualVerified ? manualForm.containerId : detected.containerId) === expected.containerId ? 'text-emerald-800' : 'text-red-800'
                }`}>
                  {isManualVerified ? manualForm.containerId : detected.containerId}
                </strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold font-sans text-slate-700">Seal Number:</span>
                <strong className={`font-bold ${
                  (isManualVerified ? manualForm.sealNumber : detected.sealNumber) === expected.sealNumber ? 'text-emerald-800' : 'text-red-800'
                }`}>
                  {isManualVerified ? manualForm.sealNumber : detected.sealNumber}
                </strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold font-sans text-slate-700">Container Type:</span>
                <strong className="text-slate-900 font-bold">
                  {isManualVerified ? manualForm.containerType : detected.containerType}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── KHU VỰC 5 — QUYẾT ĐỊNH GATE (GATE DECISION ACTIONS) ── */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="font-heading text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-600">gavel</span>
            GATE DECISION (QUYẾT ĐỊNH XỬ LÝ CỔNG)
          </h3>
          <p className="text-xs text-slate-600">Gate Officer duyệt cho xe container vào/ra cổng cảng hoặc khóa cổng từ chối.</p>
        </div>

        {isCleared ? (
          <div className="flex flex-wrap items-center gap-4">
            <button onClick={handleAllowGateIn}
              className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all">
              <span className="material-symbols-outlined text-xl">check_circle</span>
              [ ✓ CHO PHÉP GATE IN ]
            </button>
            <span className="text-xs text-emerald-800 font-bold">
              ✓ Container đã sẵn sàng đi qua cổng Tiên Sa.
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={handleBlockEntry}
              className="px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white font-black text-sm rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all">
              <span className="material-symbols-outlined text-lg">do_not_disturb_on</span>
              [ 🚫 BLOCK ENTRY ]
            </button>

            <button onClick={() => setShowIncidentModal(true)}
              className="px-5 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all">
              <span className="material-symbols-outlined text-lg">flag</span>
              [ 🚩 GẮN CỜ SỰ CỐ (REPORT INCIDENT) ]
            </button>

            <button onClick={openManualModal}
              className="px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all ml-auto">
              <span className="material-symbols-outlined text-lg">edit_note</span>
              [ 🛠️ Chuyển Sang Kiểm Tra Thủ Công ]
            </button>
          </div>
        )}
      </div>

      {/* ── LỊCH SỬ KIỂM TRA (INSPECTION HISTORY TABLE) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">history</span>
            LỊCH SỬ KIỂM TRA CONTAINER (INSPECTION HISTORY)
          </h3>
          <p className="text-xs text-slate-600">Nhật ký các lượt đối soát container tại cổng theo từng thời gian và phương thức</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                {['Thời Gian', 'Phương Thức Kiểm Tra', 'Kết Quả Đối Soát', 'Nhân Viên & Vị Trí Cổng', 'Trạng Thái'].map(h => (
                  <th key={h} className="py-3 px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {history.map((h, idx) => (
                <tr key={idx} className="hover:bg-slate-100/60">
                  <td className="py-3 px-4 font-bold text-slate-600">{h.time}</td>
                  <td className="py-3 px-4 font-sans">
                    <span className={`px-2.5 py-0.5 rounded font-extrabold text-[10px] ${h.method === 'OCR' ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'}`}>
                      {h.method === 'OCR' ? '📷 OCR Camera' : '🛠️ Manual (Thủ Công)'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">{h.result}</td>
                  <td className="py-3 px-4 font-sans font-bold text-slate-800">{h.officer}</td>
                  <td className="py-3 px-4 font-sans">
                    <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${
                      h.status === 'Passed' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-red-100 text-red-900 border-red-300'
                    }`}>
                      {h.status === 'Passed' ? '✓ Verified' : '✕ Failed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── KHU VỰC 4 — MANUAL VERIFICATION MODAL (CENTERED POPUP) ── */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 font-sans">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-xl">edit_note</span>
                <h3 className="font-heading text-lg font-extrabold text-slate-900">Kiểm Tra & Xác Nhận Thủ Công Container</h3>
              </div>
              <button onClick={() => setShowManualModal(false)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmManualVerification} className="space-y-4 text-xs font-bold">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Mã Container (Container ID) *</label>
                  <input type="text" value={manualForm.containerId} onChange={e => setManualForm(p => ({ ...p, containerId: e.target.value.toUpperCase() }))}
                    placeholder="VD: MSCU1234567"
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900 uppercase" required />
                </div>
                <div>
                  <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Số Niêm Phong (Seal Number) *</label>
                  <input type="text" value={manualForm.sealNumber} onChange={e => setManualForm(p => ({ ...p, sealNumber: e.target.value.toUpperCase() }))}
                    placeholder="VD: SL-928371"
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900 uppercase" required />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Loại ISO Container</label>
                <select value={manualForm.containerType} onChange={e => setManualForm(p => ({ ...p, containerType: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-slate-900">
                  {['40HC', '20FT', '40FT', '45HC', '20RF', '40RF'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Physical Inspection Checkboxes */}
              <div className="space-y-2 bg-slate-100 p-3.5 rounded-2xl border border-slate-200 text-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={manualForm.chkContainerPhysical} onChange={e => setManualForm(p => ({ ...p, chkContainerPhysical: e.target.checked }))} className="w-4 h-4 accent-amber-600" />
                  <span>Đã kiểm tra container thực tế tại cổng</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={manualForm.chkSealIntact} onChange={e => setManualForm(p => ({ ...p, chkSealIntact: e.target.checked }))} className="w-4 h-4 accent-amber-600" />
                  <span>Đã kiểm tra niêm phong chì (Seal) nguyên vẹn</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={manualForm.chkNoDamage} onChange={e => setManualForm(p => ({ ...p, chkNoDamage: e.target.checked }))} className="w-4 h-4 accent-amber-600" />
                  <span>Container không có dấu hiệu móp méo, rách vỡ hoặc bất thường</span>
                </label>
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Ghi Chú Kiểm Tra Thực Địa</label>
                <textarea rows="2" value={manualForm.notes} onChange={e => setManualForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Ghi chú thêm về tình trạng vỏ cont hoặc lí do đối soát thủ công..."
                  className="w-full p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-normal text-slate-900 focus:outline-none focus:border-slate-900 resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowManualModal(false)} className="flex-1 h-11 border border-slate-300 text-slate-700 rounded-xl font-extrabold text-xs hover:bg-slate-100">
                  Hủy
                </button>
                <button type="submit" className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-extrabold text-xs shadow-md">
                  Xác Nhận Kiểm Tra Thủ Công
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── REPORT INCIDENT MODAL (CENTERED POPUP) ── */}
      {showIncidentModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 font-sans">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading text-lg font-extrabold text-slate-900">Gắn Cờ Sự Cố (Report Incident)</h3>
              <button onClick={() => setShowIncidentModal(false)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleReportIncident} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Nội Dung Sự Cố / Sai Lệch *</label>
                <textarea rows="3" value={incidentReason} onChange={e => setIncidentReason(e.target.value)}
                  placeholder="VD: Sai lệch mã container, seal bị đứt rách hoặc vỏ container bị biến dạng nặng..."
                  className="w-full p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-normal text-slate-900 focus:outline-none focus:border-slate-900 resize-none" required />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowIncidentModal(false)} className="flex-1 h-11 border border-slate-300 text-slate-700 rounded-xl font-extrabold text-xs hover:bg-slate-100">
                  Hủy
                </button>
                <button type="submit" className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl font-extrabold text-xs shadow-md">
                  Gửi Báo Cáo Cho Dispatcher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
