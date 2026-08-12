import React, { useState, useEffect, useMemo } from 'react'

// Rich dataset supporting UC42, UC49, UC45, UC43, UC46, UC86, UC47, UC44, UC95
const GATE_VERIFICATION_RECORDS = [
  {
    id: 'GB-20260812-001',
    licensePlate: '43C-123.45',
    vehicleId: 'TRK-001',
    vehicleType: 'Xe Đầu Kéo Container',
    vehicleStatus: 'Đã Đăng Ký / Hoạt Động',
    carrier: 'Maersk Transport Logistics',
    registrationExpiry: '30/12/2027',
    driverName: 'Nguyễn Văn A',
    driverId: 'DRV-001',
    driverCmnd: '048092001928',
    licenseNumber: 'FC-123456',
    licenseClass: 'Hạng FC',
    licenseStatus: 'Valid',
    licenseExpiry: '15/12/2028',
    containerId: 'MSCU1234567',
    containerType: '40HC',
    sealNumber: 'SL-928371',
    purpose: 'Lấy Container (Pickup)',
    timeSlot: '08:00 – 09:30 (Hôm Nay)',
    timeSlotValid: true,
    bookingStatus: 'APPROVED',
    paymentStatus: 'PAID', // UC95
    paymentInvoiceId: 'INV-20260812-99',
    yardHandoverStatus: 'COMPLETED', // UC47
    direction: 'Gate In',
    gate: 'Gate A',
    passChecklist: true,
    hasBooking: true,
  },
  {
    id: 'GB-20260812-002',
    licensePlate: '43C-556.78',
    vehicleId: 'TRK-005',
    vehicleType: 'Xe Đầu Kéo Container',
    vehicleStatus: 'Đã Đăng Ký / Hoạt Động',
    carrier: 'XYZ Transport Vietnam',
    registrationExpiry: '20/11/2027',
    driverName: 'Trần Văn B',
    driverId: 'DRV-002',
    driverCmnd: '048095003311',
    licenseNumber: 'FC-456789',
    licenseClass: 'Hạng FC',
    licenseStatus: 'Valid',
    licenseExpiry: '10/08/2029',
    containerId: 'TEMU882219',
    containerType: '20FT',
    sealNumber: 'SL-827461',
    purpose: 'Giao Container (Delivery)',
    timeSlot: '09:00 – 10:30 (Hôm Nay)',
    timeSlotValid: true,
    bookingStatus: 'APPROVED',
    paymentStatus: 'UNPAID', // UC95 Unpaid Trigger
    paymentInvoiceId: 'INV-20260812-102 (Chưa Thanh Toán)',
    yardHandoverStatus: 'COMPLETED',
    direction: 'Gate Out',
    gate: 'Gate B',
    passChecklist: false,
    failReason: 'Hóa đơn dịch vụ cảng E-Port chưa được thanh toán (Chặn Gate Out).',
    hasBooking: true,
  },
  {
    id: 'GB-20260812-003',
    licensePlate: '75C-112.99',
    vehicleId: 'TRK-030',
    vehicleType: 'Xe Đầu Kéo Container',
    vehicleStatus: 'Đăng Kiểm Hết Hạn',
    carrier: 'Phú Xuân Logistics',
    registrationExpiry: '10/05/2026',
    driverName: 'Phan Văn N',
    driverId: 'DRV-009',
    driverCmnd: '048088001122',
    licenseNumber: 'FC-998877',
    licenseClass: 'Hạng FC',
    licenseStatus: 'Expired', // UC49 Invalid License
    licenseExpiry: '01/01/2026',
    containerId: 'NYKU112233',
    containerType: '40HC',
    sealNumber: 'SL-998877',
    purpose: 'Giao Container (Delivery)',
    timeSlot: '11:00 – 12:00 (Hôm Nay)',
    timeSlotValid: false,
    bookingStatus: 'REJECTED',
    paymentStatus: 'PAID',
    paymentInvoiceId: 'INV-20260812-88',
    yardHandoverStatus: 'PENDING',
    direction: 'Gate In',
    gate: 'Gate B',
    passChecklist: false,
    failReason: 'Giấy phép lái xe (GPLX) của tài xế đã hết hạn sử dụng & Đăng ký bị từ chối.',
    hasBooking: true,
  },
]

export default function GateVerification() {
  const [searchTab, setSearchTab] = useState('plate') // 'plate' | 'booking'
  const [searchInput, setSearchInput] = useState('43C-123.45')
  const [result, setResult] = useState(GATE_VERIFICATION_RECORDS[0])
  const [notFoundAlert, setNotFoundAlert] = useState(false) // UC86
  const [toastMessage, setToastMessage] = useState('')
  const [timeString, setTimeString] = useState('')

  // UC45: OCR ANPR Scanning animation state
  const [scanningOCR, setScanningOCR] = useState(false)
  const [ocrConfidence, setOcrConfidence] = useState(99.8)

  // UC43, UC46, UC44: Gate In/Out Photos trigger
  const [capturedPhotos, setCapturedPhotos] = useState(null)

  // UC86: Override Modal state
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  // History log state (UC44, UC43, UC46, UC86)
  const [transactions, setTransactions] = useState([
    { id: 'TX-101', time: '08:33', vehicle: '43C-123.45', driver: 'Nguyễn Văn A', container: 'MSCU1234567', bookingId: 'GB-20260812-001', action: 'Gate In', gate: 'Gate A', status: 'Approved', photos: 'Front/Rear Snapshot OK' },
    { id: 'TX-102', time: '09:05', vehicle: '43C-556.78', driver: 'Trần Văn B', container: 'TEMU882219', bookingId: 'GB-20260812-002', action: 'Gate Out', gate: 'Gate B', status: 'Blocked (Unpaid)', photos: 'Blocked' },
  ])

  // Real-time clock ticker
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

  // ── UC42: TRA CỨU BOOKING & VEHICLE ──────────────────────────────
  const handleSearch = () => {
    if (!searchInput.trim()) return
    const q = searchInput.trim().toUpperCase()

    const found = GATE_VERIFICATION_RECORDS.find(r =>
      searchTab === 'plate' ? r.licensePlate.toUpperCase() === q : r.id.toUpperCase() === q
    )

    if (found) {
      setResult(found)
      setNotFoundAlert(false)
      setCapturedPhotos(null)
      showToast(`🔍 UC42: Tra cứu thành công booking ${found.id} cho xe ${found.licensePlate}!`)
    } else {
      // UC86: AI Detect/Lookup failed trigger Alert!
      setResult(null)
      setNotFoundAlert(true)
      setCapturedPhotos(null)
      showToast(`🚨 UC86 CẢNH BÁO ĐỎ: Phát hiện biển số "${q}" không có lịch hẹn Gate Booking trong ngày!`)
    }
  }

  // ── UC45: QUÉT OCR NHẬN DIỆN BIỂN SỐ (YOLO + PADDLEOCR SIMULATION) ──
  const handleOCRScan = () => {
    setScanningOCR(true)
    showToast('📷 UC45: Camera chụp ảnh ➔ YOLO detect biển số ➔ PaddleOCR đọc text...')
    setTimeout(() => {
      setScanningOCR(false)
      setOcrConfidence(99.8)
      setSearchInput('43C-123.45')
      setSearchTab('plate')
      const found = GATE_VERIFICATION_RECORDS[0]
      setResult(found)
      setNotFoundAlert(false)
      showToast(`✅ UC45: OCR đọc thành công biển số "43C-123.45" (Khớp 99.8% trong 1.5s)!`)
    }, 1500)
  }

  // ── UC43 & UC46: THỰC HIỆN GATE IN ───────────────────────────────
  const handleGateIn = () => {
    if (!result) return
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    const photosSnapshot = { front: `CAM-A-FRONT-${Date.now()}.jpg`, rear: `CAM-A-REAR-${Date.now()}.jpg` }
    setCapturedPhotos(photosSnapshot)

    const newTx = {
      id: `TX-${Date.now().toString().slice(-3)}`,
      time: nowTime,
      vehicle: result.licensePlate,
      driver: result.driverName,
      container: result.containerId,
      bookingId: result.id,
      action: 'Gate In',
      gate: result.gate,
      status: 'Approved',
      photos: 'Front/Rear Captured 📷',
    }

    setTransactions(prev => [newTx, ...prev])
    showToast(`🟢 UC43/UC46: GATE IN THÀNH CÔNG! Xe ${result.licensePlate} ➔ Container trạng thái "In-Gate". Camera đã chụp ảnh Front/Rear xe.`)
  }

  // ── UC44 & UC95: THỰC HIỆN GATE OUT & KIỂM TRA HÓA ĐƠN ───────────
  const handleGateOut = () => {
    if (!result) return
    if (result.paymentStatus === 'UNPAID') {
      showToast(`🔴 UC95 CHẶN GATE OUT: Xe ${result.licensePlate} chưa thanh toán hóa đơn cảng E-Port (${result.paymentInvoiceId})!`)
      return
    }

    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    const photosSnapshot = { front: `CAM-B-FRONT-${Date.now()}.jpg`, rear: `CAM-B-REAR-${Date.now()}.jpg` }
    setCapturedPhotos(photosSnapshot)

    const newTx = {
      id: `TX-${Date.now().toString().slice(-3)}`,
      time: nowTime,
      vehicle: result.licensePlate,
      driver: result.driverName,
      container: result.containerId,
      bookingId: result.id,
      action: 'Gate Out',
      gate: result.gate,
      status: 'Completed',
      photos: 'Front/Rear Captured 📷',
    }

    setTransactions(prev => [newTx, ...prev])
    showToast(`🟢 UC44/UC95: GATE OUT THÀNH CÔNG! Đã xác nhận hóa đơn đã thanh toán. Container ➔ "Exited".`)
  }

  // ── UC86: REJECT / OVERVIEW UNRECORDED VEHICLE ────────────────────
  const handleBlockUnscheduledVehicle = () => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    const newTx = {
      id: `TX-${Date.now().toString().slice(-3)}`,
      time: nowTime,
      vehicle: searchInput || 'UNKNOWN',
      driver: 'Không xác định',
      container: '—',
      bookingId: 'NO-BOOKING',
      action: 'Gate In',
      gate: 'Gate A',
      status: 'Rejected (UC86)',
      photos: 'Captured',
    }
    setTransactions(prev => [newTx, ...prev])
    setNotFoundAlert(false)
    showToast(`🚫 UC86: ĐÃ TỪ CHỐI CHO XE QUA CỔNG & GHI NHẬT KÝ SỰ CỐ XE KHÔNG CÓ LỊCH HẸN.`)
  }

  const handleOverrideSubmit = (e) => {
    e.preventDefault()
    setShowOverrideModal(false)
    setNotFoundAlert(false)
    showToast(`⚠️ UC86: Gate Officer đã kích hoạt quyền Override Operator cho xe ${searchInput}. Lý do: "${overrideReason || 'Cấp phép ngoại lệ'}"`)
    setOverrideReason('')
  }

  // Verification Checklist Items (UC42, UC49, UC45, UC47, UC95)
  const checklist = useMemo(() => {
    if (!result) return []
    return [
      { id: 1, label: 'UC42: Tra cứu Gate Booking', detail: `Booking ${result.id} — Trạng thái: ${result.bookingStatus}`, ok: result.bookingStatus === 'APPROVED' },
      { id: 2, label: 'UC49: Xác thực thông tin tài xế', detail: `Tài xế ${result.driverName} (CMND: ${result.driverCmnd}) — GPLX ${result.licenseNumber} (${result.licenseStatus})`, ok: result.licenseStatus === 'Valid' },
      { id: 3, label: 'UC45: Quét OCR nhận diện biển số', detail: `Biển số xe ${result.licensePlate} khớp 99.8% với booking`, ok: true },
      { id: 4, label: 'UC42: Khung giờ hẹn (Time Slot)', detail: `Khung giờ ${result.timeSlot} còn hiệu lực`, ok: result.timeSlotValid },
      { id: 5, label: 'UC47: Xác nhận giao nhận container', detail: `Trạng thái cẩu bãi Yard Handover: ${result.yardHandoverStatus}`, ok: true },
      { id: 6, label: 'UC95: Kiểm tra hóa đơn thanh toán cảng', detail: `Trạng thái hóa đơn E-Port: ${result.paymentStatus === 'PAID' ? 'ĐÃ THANH TOÁN 🟢' : 'CHƯA THANH TOÁN 🔴'}`, ok: result.paymentStatus === 'PAID' },
    ]
  }, [result])

  const allVerified = checklist.length > 0 && checklist.every(c => c.ok)

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen text-slate-900 relative">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-amber-100 text-amber-950 border-2 border-amber-400 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-3 z-[100] animate-bounce">
          <span className="text-amber-600">●</span>{toastMessage}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold bg-orange-100 text-orange-950 border border-orange-300 px-3 py-0.5 rounded-full uppercase">
              GATE OFFICER
            </span>
            <span className="text-xs font-mono font-bold text-slate-600">Hệ Thống Kiểm Soát Cổng Cảng Container Tiên Sa</span>
          </div>
          <h2 className="font-heading text-3xl font-extrabold text-slate-900">Vehicle & Driver Verification</h2>
          <p className="text-xs text-slate-600 mt-0.5">Xác minh xe, tài xế, OCR nhận diện biển số (UC45), Gate In/Out (UC43/UC44) và kiểm tra hóa đơn (UC95).</p>
        </div>

        {/* Right Corner Widgets */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-700 uppercase font-sans font-black">TRỰC TUYẾN (LIVE)</span>
            <span className="text-slate-300">|</span>
            <span>{timeString}</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 text-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-300 shadow-xs text-xs font-extrabold">
            <span className="material-symbols-outlined text-base text-amber-600">local_police</span>
            <div>
              <div className="text-[11px] font-black leading-tight text-slate-900">Nguyễn Văn Hùng</div>
              <div className="text-[9px] text-slate-600 font-mono font-bold">Gate Officer · Cổng A</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SEARCH & ANPR OCR SCAN CARD (UC42, UC45) ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h3 className="font-heading text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-600">search</span>
            TRA CỨU VÀ QUÉT OCR XE ĐẾN CỔNG (UC42, UC45)
          </h3>
          <span className="text-xs font-mono text-slate-500 font-bold">Nhận diện biển số tự động qua Camera YOLO + PaddleOCR</span>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          {/* Tab Selector */}
          <div className="flex items-center bg-slate-100 border border-slate-300 rounded-xl p-1 text-xs font-extrabold shrink-0">
            <button onClick={() => setSearchTab('plate')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${searchTab === 'plate' ? 'bg-orange-100 text-orange-950 border border-orange-400 font-black' : 'text-slate-700 hover:text-slate-900'}`}>
              [ Biển Số Xe ]
            </button>
            <button onClick={() => setSearchTab('booking')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${searchTab === 'booking' ? 'bg-orange-100 text-orange-950 border border-orange-400 font-black' : 'text-slate-700 hover:text-slate-900'}`}>
              [ Gate Booking ID ]
            </button>
          </div>

          {/* Search Inputs & OCR Trigger */}
          <div className="flex flex-1 flex-col sm:flex-row gap-2">
            <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={searchTab === 'plate' ? 'Nhập biển số xe (VD: 43C-123.45 hoặc 43C-556.78)' : 'Nhập Gate Booking ID (VD: GB-20260812-001)'}
              className="flex-1 px-4 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 uppercase" />
            
            <button onClick={handleSearch}
              className="px-6 py-2.5 bg-blue-100 hover:bg-blue-200 text-blue-950 border-2 border-blue-400 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0">
              <span className="material-symbols-outlined text-sm text-blue-800">search</span>
              🔍 Tra Cứu (UC42)
            </button>

            <button onClick={handleOCRScan} disabled={scanningOCR}
              className="px-5 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-2 border-emerald-400 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0">
              <span className="material-symbols-outlined text-sm text-emerald-800">photo_camera</span>
              {scanningOCR ? 'Đang Quét OCR...' : '📷 Quét OCR Biển Số (UC45)'}
            </button>
          </div>
        </div>
      </div>

      {/* ── UC86: RED ALERT BANNER WHEN VEHICLE HAS NO BOOKING ── */}
      {notFoundAlert && (
        <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-6 space-y-3 shadow-md animate-pulse">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-red-600 text-4xl">gpp_bad</span>
            <div>
              <h4 className="font-black text-red-950 text-base">🔴 UC86 CẢNH BÁO ĐỎ: XE KHÔNG CÓ LỊCH HẸN GATE BOOKING TRONG NGÀY!</h4>
              <p className="text-xs text-red-900 font-extrabold mt-0.5">
                AI Camera phát hiện biển số "{searchInput}" chưa được doanh nghiệp vận tải đăng ký hoặc chưa được Dispatcher phê duyệt.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button onClick={handleBlockUnscheduledVehicle}
              className="px-6 py-2.5 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-400 rounded-xl font-black text-xs cursor-pointer">
              [ 🚫 Từ Chối Vào Cổng & Ghi Nhật Ký Sự Cố ]
            </button>
            <button onClick={() => setShowOverrideModal(true)}
              className="px-5 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border-2 border-amber-400 rounded-xl font-black text-xs cursor-pointer">
              [ ⚠️ Kích Hoạt Quyền Override Operator ]
            </button>
          </div>
        </div>
      )}

      {/* ── VERIFICATION CARDS & CHECKLIST ── */}
      {result && (
        <div className="space-y-6">

          {/* 3 Result Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* CARD 1 — THÔNG TIN XE */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <span className="text-xs font-black text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">local_shipping</span>
                  THÔNG TIN PHƯƠNG TIỆN
                </span>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-300 rounded-full text-[10px] font-black">
                  🟢 Đã Đăng Ký
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-600 uppercase font-sans font-bold">Biển Số Xe (License Plate)</div>
                  <div className="font-black text-slate-900 text-base">{result.licensePlate}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-600 uppercase font-sans font-bold">Mã Xe</div>
                    <div className="font-extrabold text-slate-900">{result.vehicleId}</div>
                  </div>
                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-600 uppercase font-sans font-bold">Loại Xe</div>
                    <div className="font-bold text-slate-900 text-[11px] truncate">{result.vehicleType}</div>
                  </div>
                </div>

                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-600 uppercase font-sans font-bold">Chủ Xe / Hãng Vận Tải</div>
                  <div className="font-extrabold text-slate-900">{result.carrier}</div>
                </div>
              </div>
            </div>

            {/* CARD 2 — XÁC THỰC TÀI XẾ (UC49) */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <span className="text-xs font-black text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">badge</span>
                  XÁC THỰC TÀI XẾ (UC49)
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                  result.licenseStatus === 'Valid' ? 'bg-emerald-100 text-emerald-950 border-emerald-400' : 'bg-red-100 text-red-950 border-red-400'
                }`}>
                  {result.licenseStatus === 'Valid' ? '🟢 GPLX Hợp Lệ' : '🔴 GPLX Hết Hạn'}
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-600 uppercase font-sans font-bold">Tên Tài Xế (Họ & Tên)</div>
                  <div className="font-black text-slate-900 text-base">{result.driverName}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-600 uppercase font-sans font-bold">Số CMND / CCCD</div>
                    <div className="font-extrabold text-slate-900">{result.driverCmnd}</div>
                  </div>
                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-600 uppercase font-sans font-bold">Hạng GPLX</div>
                    <div className="font-extrabold text-blue-900">{result.licenseClass}</div>
                  </div>
                </div>

                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-600 uppercase font-sans font-bold">Số GPLX Đối Chiếu</div>
                  <div className={`font-extrabold ${result.licenseStatus === 'Valid' ? 'text-slate-900' : 'text-red-700'}`}>
                    {result.licenseNumber} ({result.licenseExpiry})
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 3 — GATE BOOKING & THANH TOÁN (UC42, UC95) */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <span className="text-xs font-black text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">confirmation_number</span>
                  BOOKING & HÓA ĐƠN (UC95)
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                  result.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-950 border-emerald-400' : 'bg-red-100 text-red-950 border-red-400'
                }`}>
                  {result.paymentStatus === 'PAID' ? '🟢 ĐÃ THANH TOÁN' : '🔴 CHƯA THANH TOÁN'}
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="text-[10px] text-slate-600 uppercase font-sans font-bold">Booking ID</div>
                    <div className="font-extrabold text-blue-900">{result.id}</div>
                  </div>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-sans font-bold text-[10px]">
                    {result.purpose}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-600 uppercase font-sans font-bold">Mã Container</div>
                    <div className="font-black text-slate-900">{result.containerId}</div>
                  </div>
                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-600 uppercase font-sans font-bold">Số Niêm Phong (Seal)</div>
                    <div className="font-bold text-purple-900">{result.sealNumber}</div>
                  </div>
                </div>

                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-600 uppercase font-sans font-bold">Hóa Đơn Cảng E-Port (UC95)</div>
                  <div className={`font-extrabold ${result.paymentStatus === 'PAID' ? 'text-emerald-800' : 'text-red-800'}`}>
                    {result.paymentInvoiceId}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ── VERIFICATION CHECKLIST & GATE DECISION ── */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">fact_check</span>
                VERIFICATION CHECKLIST (ĐỐI SOÁT ĐẦY ĐỦ ĐIỀU KIỆN TẠI CỔNG)
              </h3>
              <span className="text-xs font-mono font-bold text-slate-500">{checklist.filter(c => c.ok).length} / {checklist.length} Điều kiện đạt</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {checklist.map(item => (
                <div key={item.id} className={`p-3 rounded-xl border flex items-start gap-2.5 ${item.ok ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950' : 'bg-red-50/70 border-red-300 text-red-950'}`}>
                  <span className={`font-black text-base shrink-0 leading-none ${item.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    {item.ok ? '✓' : '✕'}
                  </span>
                  <div>
                    <div className="font-extrabold text-xs font-mono uppercase">{item.label}</div>
                    <div className="text-[11px] font-medium text-slate-600 mt-0.5">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* UC43, UC44 Gate In / Out Actions */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-3">
              <button onClick={handleGateIn} disabled={!allVerified}
                className={`px-8 py-3.5 rounded-xl font-black text-sm shadow-xs flex items-center gap-2 cursor-pointer transition-all border-2 ${
                  allVerified ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-emerald-400' : 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed'
                }`}>
                <span className="material-symbols-outlined text-lg">login</span>
                [ ✓ THỰC HIỆN GATE IN (UC43, UC46) ]
              </button>

              <button onClick={handleGateOut} disabled={result.paymentStatus === 'UNPAID'}
                className={`px-8 py-3.5 rounded-xl font-black text-sm shadow-xs flex items-center gap-2 cursor-pointer transition-all border-2 ${
                  result.paymentStatus === 'PAID' ? 'bg-blue-100 hover:bg-blue-200 text-blue-950 border-blue-400' : 'bg-red-100 hover:bg-red-200 text-red-950 border-red-400'
                }`}>
                <span className="material-symbols-outlined text-lg">logout</span>
                [ ✓ THỰC HIỆN GATE OUT (UC44, UC95) ]
              </button>
            </div>

            {/* Captured Photos trigger notice */}
            {capturedPhotos && (
              <div className="p-3 bg-blue-50 border border-blue-300 rounded-xl text-xs font-mono text-blue-950 font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-base">photo_camera</span>
                Camera đã tự động chụp ảnh Snapshot Front/Rear của xe: {capturedPhotos.front} · {capturedPhotos.rear}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── UC44/UC86: TRANSACTIONS & HISTORY LOG TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">history</span>
            NHẬT KÝ GIAO DỊCH VÀ KHAI THÁC CỔNG (GATE TRANSACTIONS LOG)
          </h3>
          <p className="text-xs text-slate-600">Nhật ký chi tiết các lượt xe Gate In, Gate Out, ảnh chụp camera và trạng thái hóa đơn thanh toán</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                {['Thời Gian', 'Biển Số Xe', 'Tên Tài Xế', 'Mã Container', 'Booking ID', 'Hướng Xe', 'Cổng', 'Ảnh Snapshot Camera', 'Trạng Thái'].map(h => (
                  <th key={h} className="py-3 px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-100/60">
                  <td className="py-3 px-4 font-bold text-slate-600">{tx.time}</td>
                  <td className="py-3 px-4 font-black text-slate-900">{tx.vehicle}</td>
                  <td className="py-3 px-4 font-sans font-bold text-slate-800">{tx.driver}</td>
                  <td className="py-3 px-4 font-bold text-blue-900">{tx.container}</td>
                  <td className="py-3 px-4 font-bold text-purple-900">{tx.bookingId}</td>
                  <td className="py-3 px-4 font-sans">
                    <span className={`px-2.5 py-0.5 rounded font-extrabold text-[10px] ${tx.action === 'Gate In' ? 'bg-blue-100 text-blue-900' : 'bg-purple-100 text-purple-900'}`}>
                      {tx.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-extrabold text-slate-700">{tx.gate}</td>
                  <td className="py-3 px-4 font-sans text-slate-600 text-[11px]">{tx.photos}</td>
                  <td className="py-3 px-4 font-sans">
                    <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${
                      tx.status === 'Approved' || tx.status === 'Completed' ? 'bg-emerald-100 text-emerald-950 border-emerald-300' : 'bg-red-100 text-red-950 border-red-300'
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: UC86 OVERRIDE OPERATOR POPUP ── */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 font-sans border-2 border-amber-400">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading text-lg font-black text-slate-900">Kích Hoạt Quyền Override Operator (UC86)</h3>
              <button onClick={() => setShowOverrideModal(false)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleOverrideSubmit} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Lý Do Cấp Quyền Cho Xe Ngoại Lệ Vào Cổng *</label>
                <textarea rows="3" value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
                  placeholder="VD: Xe vận tải quốc tế gặp sự cố bão, đã có văn bản xác nhận khẩn từ Trưởng phòng Điều độ..."
                  className="w-full p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-normal text-slate-900 focus:outline-none focus:border-slate-900 resize-none" required />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowOverrideModal(false)} className="flex-1 h-11 border border-slate-300 text-slate-700 rounded-xl font-extrabold text-xs hover:bg-slate-100">
                  Hủy
                </button>
                <button type="submit" className="flex-1 h-11 bg-amber-100 hover:bg-amber-200 text-amber-950 border-2 border-amber-400 rounded-xl font-black text-xs shadow-xs">
                  Xác Nhận Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
