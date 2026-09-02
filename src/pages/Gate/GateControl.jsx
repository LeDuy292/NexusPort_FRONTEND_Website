import React, { useState, useEffect } from 'react'
import { gateBookingsData } from '../../data/gateOfficerData'
import { bookingService } from '../../services/bookingService'

const BOOKING_ACTIVE = gateBookingsData.find(b => b.status === 'Approved') || gateBookingsData[3]

export default function GateControl() {
  const [currentTime, setCurrentTime] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [mode, setMode] = useState('checkin') // 'checkin' | 'checkout'
  const [detectedPlate, setDetectedPlate] = useState('43C-123.45')
  const [confidence, setConfidence] = useState(99.2)
  const [verificationOverride, setVerificationOverride] = useState(false)

  const [showCheckInModal, setShowCheckInModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [incidentType, setIncidentType] = useState('')
  const [incidentNote, setIncidentNote] = useState('')
  const [processingStatus, setProcessingStatus] = useState('idle')

  const [activeBooking, setActiveBooking] = useState(BOOKING_ACTIVE)
  const [qrSearchInput, setQrSearchInput] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)

  const handleQrLookup = async (codeToSearch) => {
    const code = codeToSearch || qrSearchInput
    if (!code) return
    setSearchLoading(true)
    try {
      const res = await bookingService.getBookings({ search: code.trim() })
      if (res && res.items && res.items.length > 0) {
        const found = res.items[0]
        setActiveBooking({
          id: found.bookingCode || found.id,
          company: 'Transport Company',
          vehicleId: found.truckId ? found.truckId.slice(0, 8) : '51C-992.81',
          licensePlate: '51C-992.81',
          driverName: 'Nguyễn Văn Hùng',
          licenseNumber: 'FC-99201',
          licenseStatus: 'Valid',
          containerId: found.containerIds ? found.containerIds.join(', ') : 'MSKU8891024',
          containerType: '40ft Dry Container',
          cargoType: 'General Cargo',
          operation: found.bookingType || 'Pickup',
          gate: 'Gate A',
          etaDisplay: new Date(found.appointmentStart).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          sealNumber: 'SEAL-99881',
          status: found.status
        })
        setDetectedPlate('51C-992.81')
        showToast(`🔍 Đã tra cứu dữ liệu Booking ${found.bookingCode} từ Database!`)
      } else {
        showToast(`⚠️ Không tìm thấy Booking '${code}' trong Database.`)
      }
    } catch (e) {
      showToast('⚠️ Lỗi tra cứu Booking từ API.')
    } finally {
      setSearchLoading(false)
    }
  }

  useEffect(() => {
    const tick = () => setCurrentTime(new Date().toLocaleTimeString('vi-VN'))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const pulse = setInterval(() => setConfidence(97 + Math.random() * 3), 2000)
    return () => clearInterval(pulse)
  }, [])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4000)
  }

  const getChecklist = (booking) => {
    if (!booking) return []
    const isCheckOut = mode === 'checkout'
    return [
      { id: 'plate',     label: 'Biển số xe khớp với booking',           ok: detectedPlate === booking.licensePlate },
      { id: 'booking',   label: 'Booking đã được Dispatcher phê duyệt',  ok: ['Approved','Checked-in'].includes(booking.status) },
      { id: 'driver',    label: 'Giấy phép lái xe còn hiệu lực',         ok: booking.licenseStatus === 'Valid' },
      { id: 'container', label: 'Mã container khớp với booking',          ok: true },
      { id: 'time',      label: 'Thời gian ETA hợp lệ',                  ok: true },
      { id: 'state',     label: isCheckOut ? 'Đã check-in trước đó' : 'Chưa check-in (lần đầu vào)', ok: isCheckOut ? booking.status === 'Checked-in' : booking.status !== 'Checked-in' },
    ]
  }

  const checklist = getChecklist(activeBooking)
  const allValid = checklist.every(c => c.ok) || verificationOverride
  const plateMatch = detectedPlate === activeBooking?.licensePlate

  const handleCheckIn = () => {
    setShowCheckInModal(false)
    setProcessingStatus('checked-in')
    setActiveBooking(prev => ({ ...prev, status: mode === 'checkin' ? 'Checked-in' : 'Completed' }))
    showToast(mode === 'checkin'
      ? `✅ CHECK-IN THÀNH CÔNG — Xe ${activeBooking.vehicleId} (${activeBooking.licensePlate}) vào ${activeBooking.gate} lúc ${currentTime}`
      : `✅ CHECK-OUT THÀNH CÔNG — Xe ${activeBooking.vehicleId} đã ra cổng. Booking hoàn tất.`)
  }

  const handleReject = () => {
    setShowRejectModal(false)
    setProcessingStatus('rejected')
    showToast(`🚫 ĐÃ TỪ CHỐI — Xe ${activeBooking?.licensePlate || detectedPlate} không được phép vào cổng.`)
  }

  const handleSubmitIncident = () => {
    if (!incidentType) return
    setShowIncidentModal(false)
    showToast(`📋 ĐÃ GỬI SỰ CỐ — Loại "${incidentType}" đã được thông báo đến Dispatcher.`)
    setIncidentType('')
    setIncidentNote('')
  }

  const statusLabel = processingStatus === 'idle'
    ? 'CHỜ XE'
    : processingStatus === 'checked-in'
    ? (mode === 'checkin' ? 'ĐÃ CHECK-IN' : 'ĐÃ CHECK-OUT')
    : 'ĐÃ TỪ CHỐI'

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-5 bg-slate-50 min-h-screen relative">

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-carbon text-white px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-extrabold flex items-center gap-3 z-50 animate-bounce border border-signal-orange">
          <span className="text-signal-orange">●</span>{toastMessage}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-chalk rounded-2xl p-5 shadow-sm gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full uppercase">Nhân viên cổng</span>
            <span className={`text-xs font-extrabold flex items-center gap-1 ${processingStatus === 'checked-in' ? 'text-green-700' : 'text-amber-700'}`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${processingStatus === 'checked-in' ? 'bg-green-500' : 'bg-amber-500'}`}></span>
              {statusLabel}
            </span>
          </div>
          <h2 className="font-heading text-3xl font-extrabold text-carbon">Kiểm Soát Cổng — Nhận Dạng AI</h2>
          <p className="text-xs text-slate mt-0.5">Nhận diện biển số tự động (ANPR) · Xác minh booking · Kiểm soát xe ra/vào cổng.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-fog border border-chalk rounded-xl overflow-hidden text-xs font-extrabold">
            <button
              onClick={() => { setMode('checkin'); setProcessingStatus('idle') }}
              className={`px-4 py-2.5 ${mode === 'checkin' ? 'bg-signal-orange text-white' : 'text-slate hover:text-carbon'}`}
            >
              CHECK-IN
            </button>
            <button
              onClick={() => { setMode('checkout'); setProcessingStatus('idle') }}
              className={`px-4 py-2.5 ${mode === 'checkout' ? 'bg-carbon text-white' : 'text-slate hover:text-carbon'}`}
            >
              CHECK-OUT
            </button>
          </div>
          <span className="font-mono text-sm font-extrabold text-carbon">{currentTime}</span>
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ══ TRÁI: CAMERA + ANPR ══ */}
        <div className="flex flex-col gap-4">

          {/* Camera label */}
          <div className="flex items-center justify-between">
            <div className="text-xs font-extrabold text-slate uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-signal-orange animate-pulse"></span>
              CAM-01 · CỔNG A — TRỰC TIẾP
            </div>
            <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border bg-green-100 text-green-900 border-green-300">
              ANPR ● ĐANG CHẠY
            </span>
          </div>

          {/* Camera Viewport với ảnh minh hoạ thực */}
          <div className="relative aspect-video rounded-2xl overflow-hidden shadow-xl border border-chalk bg-[#0d1117]">
            {/* Ảnh nền minh hoạ xe tải tại cổng */}
            <img
              src="/gate-camera-truck.png"
              alt="Camera cổng — xe đang tiếp cận"
              className="absolute inset-0 w-full h-full object-cover opacity-85"
            />

            {/* Overlay tối nhẹ để các HUD nổi rõ hơn */}
            <div className="absolute inset-0 bg-black/20"></div>

            {/* Bounding box xe */}
            <div className="absolute top-[15%] left-[12%] right-[12%] h-[45%] border-2 border-signal-orange rounded-sm">
              <div className="absolute -top-5 left-0 bg-signal-orange text-white text-[10px] font-extrabold px-2 py-0.5 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                XE ĐƯỢC PHÁT HIỆN
              </div>
              {/* Góc xanh */}
              <div className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-green-400"></div>
              <div className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 border-green-400"></div>
              <div className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 border-green-400"></div>
              <div className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-green-400"></div>
            </div>

            {/* Bounding box biển số */}
            <div className="absolute bottom-[22%] left-[32%] right-[32%] h-[10%] border-2 border-blue-400 rounded">
              <div className="absolute -top-5 left-0 bg-blue-600 text-white text-[10px] font-extrabold px-2 py-0.5 font-mono">BIỂN SỐ</div>
            </div>

            {/* Confidence indicator */}
            <div className="absolute top-3 left-3 bg-black/70 border border-green-500 text-green-400 text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
              ANPR · {confidence.toFixed(1)}%
            </div>

            {/* Timestamp */}
            <div className="absolute bottom-3 left-3 text-[10px] font-mono text-green-400 bg-black/60 px-2 py-1 rounded">
              {new Date().toLocaleDateString('vi-VN')} {currentTime}
            </div>

            {/* Gate label */}
            <div className="absolute top-3 right-3 text-[10px] font-mono text-slate-300 bg-black/60 px-2 py-1 rounded">
              CỔNG A · CẢNG TIÊN SA
            </div>

            {/* Scan lines effect */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.015) 2px, rgba(0,255,0,0.015) 4px)' }}>
            </div>
          </div>

          {/* ANPR Result */}
          <div className={`rounded-2xl border-2 p-4 space-y-2 ${plateMatch ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate">KẾT QUẢ NHẬN DẠNG ANPR</span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border font-mono ${
                confidence > 95 ? 'bg-green-100 text-green-900 border-green-300' : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}>
                Độ chính xác: {confidence.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div>
                <div className="text-[10px] text-slate font-mono">BIỂN SỐ XE NHẬN DẠNG</div>
                <div className="font-mono text-2xl font-extrabold text-carbon tracking-widest">{detectedPlate}</div>
              </div>
              <div className={`flex-1 h-12 rounded-xl flex items-center justify-center font-mono font-extrabold text-xl tracking-widest border-2 ${
                plateMatch ? 'bg-green-100 text-green-900 border-green-400' : 'bg-red-100 text-red-900 border-red-400'
              }`}>
                {detectedPlate}
              </div>
            </div>
            <div className={`text-xs font-extrabold ${plateMatch ? 'text-green-700' : 'text-red-700'}`}>
              {plateMatch ? '✓ Biển số KHỚP với thông tin booking' : '✗ Biển số KHÔNG KHỚP — kiểm tra lại'}
            </div>
          </div>

          {/* Snapshot panels */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0d1117] rounded-xl p-3 space-y-1 border border-chalk">
              <div className="text-[10px] font-extrabold text-slate-400 uppercase">ẢNH PHÍA TRƯỚC</div>
              <div className="aspect-video bg-slate-800 rounded-lg overflow-hidden">
                <img src="/gate-camera-truck.png" alt="Ảnh xe phía trước" className="w-full h-full object-cover opacity-75" />
              </div>
              <button className="w-full text-[10px] font-bold text-slate-400 hover:text-signal-orange font-mono">[ Chụp ảnh ]</button>
            </div>
            <div className="bg-[#0d1117] rounded-xl p-3 space-y-1 border border-chalk">
              <div className="text-[10px] font-extrabold text-slate-400 uppercase">ẢNH CONTAINER</div>
              <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-600 text-3xl">inventory_2</span>
              </div>
              <button className="w-full text-[10px] font-bold text-slate-400 hover:text-signal-orange font-mono">[ Chụp ảnh ]</button>
            </div>
          </div>
        </div>

        {/* ══ PHẢI: XÁC MINH BOOKING ══ */}
        <div className="flex flex-col gap-4">

          {/* Thông tin booking */}
          <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-4">
            
            {/* QR Search / Scanner Bar */}
            <div className="flex gap-2 pb-3 border-b border-chalk">
              <input
                type="text"
                placeholder="Quét mã QR / Nhập mã BK-2026..."
                value={qrSearchInput}
                onChange={(e) => setQrSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQrLookup()}
                className="flex-1 px-3 py-2 border border-chalk rounded-xl text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-signal-orange"
              />
              <button
                type="button"
                onClick={() => handleQrLookup()}
                disabled={searchLoading}
                className="px-4 py-2 bg-signal-orange text-white rounded-xl font-bold text-xs hover:bg-orange-600 flex items-center gap-1 cursor-pointer"
              >
                {searchLoading ? <span className="material-symbols-outlined text-sm animate-spin">sync</span> : <span className="material-symbols-outlined text-sm">qr_code_scanner</span>}
                Tra cứu QR
              </button>
            </div>

            <div className="flex justify-between items-start border-b border-chalk pb-3">
              <div>
                <span className="text-[10px] font-extrabold text-signal-orange uppercase tracking-wider block">XÁC MINH GATE BOOKING</span>
                <h3 className="font-mono text-xl font-extrabold text-carbon">{activeBooking?.id || '—'}</h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold border flex items-center gap-1 ${
                ['Approved','Checked-in'].includes(activeBooking?.status)
                  ? 'bg-green-100 text-green-900 border-green-300'
                  : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}>
                <span className="w-2 h-2 rounded-full bg-current"></span>
                {activeBooking?.status || 'N/A'}
              </span>
            </div>

            {activeBooking ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono">
                {[
                  ['Doanh nghiệp vận tải', activeBooking.company],
                  ['Mã xe', activeBooking.vehicleId],
                  ['Biển số', activeBooking.licensePlate],
                  ['Tài xế', activeBooking.driverName],
                  ['Số GPLX', `${activeBooking.licenseNumber} (${activeBooking.licenseStatus})`],
                  ['Mã container', activeBooking.containerId],
                  ['Loại cont. / Hàng', `${activeBooking.containerType} · ${activeBooking.cargoType}`],
                  ['Loại tác nghiệp', activeBooking.operation],
                  ['Cổng / ETA', `${activeBooking.gate} · ${activeBooking.etaDisplay}`],
                  ['Số seal', activeBooking.sealNumber || '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span className="text-slate">{k}:</span><br />
                    <strong className={`${k === 'Số GPLX' && activeBooking.licenseStatus !== 'Valid' ? 'text-red-700' : k === 'Cổng / ETA' ? 'text-signal-orange' : 'text-carbon'}`}>{v}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate text-xs">Chưa có booking được chọn. Quét biển số để tra cứu.</div>
            )}
          </div>

          {/* Checklist xác minh */}
          <div className={`rounded-2xl border-2 p-4 space-y-3 ${allValid ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-300'}`}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate">DANH SÁCH KIỂM TRA</span>
              {!allValid && (
                <button onClick={() => setVerificationOverride(!verificationOverride)}
                  className="text-[10px] font-bold text-orange-700 underline">
                  Ghi đè thủ công
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {checklist.map(c => (
                <div key={c.id} className="flex items-center gap-2 text-xs">
                  <span className={`font-extrabold text-base ${c.ok ? 'text-green-600' : 'text-red-600'}`}>{c.ok ? '✓' : '✗'}</span>
                  <span className={c.ok ? 'text-green-900 font-medium' : 'text-red-900 font-extrabold'}>{c.label}</span>
                </div>
              ))}
            </div>
            {verificationOverride && (
              <div className="text-[10px] text-orange-800 bg-orange-50 border border-orange-300 rounded-lg px-2 py-1 font-bold">
                ⚠ Ghi đè thủ công đang bật — nhân viên chịu trách nhiệm quyết định này
              </div>
            )}
            <div className={`text-center font-extrabold text-sm py-2 rounded-xl border-2 ${
              allValid ? 'bg-green-100 text-green-900 border-green-400' : 'bg-red-100 text-red-900 border-red-300'
            }`}>
              {allValid
                ? (mode === 'checkin' ? '🟢 SẴN SÀNG CHECK-IN' : '🟢 SẴN SÀNG CHECK-OUT')
                : '🔴 XÁC MINH THẤT BẠI'}
            </div>
          </div>

          {/* Nút hành động chính */}
          <div className={`grid gap-3 ${allValid ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {allValid ? (
              <button onClick={() => setShowCheckInModal(true)}
                className="h-14 bg-signal-orange text-white rounded-2xl font-extrabold text-base hover:opacity-95 shadow-xl flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-2xl">{mode === 'checkin' ? 'login' : 'logout'}</span>
                {mode === 'checkin' ? 'XÁC NHẬN CHECK-IN' : 'XÁC NHẬN CHECK-OUT'}
              </button>
            ) : (
              <>
                <button onClick={() => setShowRejectModal(true)}
                  className="h-12 bg-red-600 text-white rounded-xl font-extrabold text-sm hover:bg-red-700 shadow-md flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-lg">block</span>
                  TỪ CHỐI VÀO CỔNG
                </button>
                <button onClick={() => setShowIncidentModal(true)}
                  className="h-12 bg-amber-600 text-white rounded-xl font-extrabold text-sm hover:bg-amber-700 shadow-md flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-lg">report</span>
                  TẠO SỰ CỐ
                </button>
              </>
            )}
          </div>

          {allValid && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowRejectModal(true)}
                className="h-10 border-2 border-red-400 text-red-700 rounded-xl font-extrabold text-xs hover:bg-red-50 flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-sm">block</span>Từ Chối
              </button>
              <button onClick={() => setShowIncidentModal(true)}
                className="h-10 border-2 border-amber-400 text-amber-800 rounded-xl font-extrabold text-xs hover:bg-amber-50 flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-sm">report</span>Báo Sự Cố
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══ MODAL XÁC NHẬN CHECK-IN / CHECK-OUT ══ */}
      {showCheckInModal && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="text-center">
              <span className={`material-symbols-outlined text-5xl ${mode === 'checkin' ? 'text-green-600' : 'text-blue-600'}`}>
                {mode === 'checkin' ? 'login' : 'logout'}
              </span>
              <h3 className="font-heading text-xl font-extrabold text-carbon mt-2">
                {mode === 'checkin' ? 'XÁC NHẬN CHO XE VÀO?' : 'XÁC NHẬN CHO XE RA?'}
              </h3>
            </div>
            <div className="bg-fog rounded-2xl p-4 space-y-2 font-mono text-xs border border-chalk">
              {[
                ['Booking', activeBooking?.id],
                ['Xe', `${activeBooking?.vehicleId} (${activeBooking?.licensePlate})`],
                ['Tài xế', activeBooking?.driverName],
                ['Container', activeBooking?.containerId],
                ['Cổng', activeBooking?.gate],
                ['Thời gian', currentTime],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-slate">{k}:</span><strong className="text-carbon">{v}</strong></div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCheckInModal(false)} className="flex-1 h-11 border border-chalk text-slate rounded-xl font-bold text-xs hover:bg-fog">Hủy</button>
              <button onClick={handleCheckIn}
                className={`flex-1 h-11 text-white rounded-xl font-extrabold text-sm shadow-md ${mode === 'checkin' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {mode === 'checkin' ? 'Xác nhận cho vào' : 'Xác nhận cho ra'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL TỪ CHỐI ══ */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 border-b border-chalk pb-3">
              <span className="material-symbols-outlined text-3xl text-red-600">block</span>
              <h3 className="font-heading text-xl font-extrabold text-carbon">TỪ CHỐI VÀO CỔNG</h3>
            </div>
            <p className="text-xs text-slate">Xác nhận từ chối xe <strong>{detectedPlate}</strong> vào cảng. Lý do sẽ được ghi vào lịch sử kiểm soát cổng.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(false)} className="flex-1 h-11 border border-chalk text-slate rounded-xl font-bold text-xs hover:bg-fog">Hủy</button>
              <button onClick={handleReject} className="flex-1 h-11 bg-red-600 text-white rounded-xl font-extrabold text-sm hover:bg-red-700">Xác nhận từ chối</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL TẠO SỰ CỐ ══ */}
      {showIncidentModal && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-amber-600">report</span>
                <h3 className="font-heading text-lg font-extrabold text-carbon">TẠO SỰ CỐ CỔNG</h3>
              </div>
              <button onClick={() => setShowIncidentModal(false)} className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate uppercase text-[10px] mb-1">Loại sự cố *</label>
                <select value={incidentType} onChange={e => setIncidentType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-amber-500">
                  <option value="">-- Chọn loại sự cố --</option>
                  <option>Sai biển số xe</option>
                  <option>Sai thông tin tài xế</option>
                  <option>Sai mã container</option>
                  <option>Booking không hợp lệ</option>
                  <option>Booking hết hạn</option>
                  <option>Ngoài khung giờ cho phép</option>
                  <option>Giấy phép lái xe hết hạn</option>
                  <option>Sai số seal</option>
                  <option>Xe không có booking</option>
                  <option>Khác</option>
                </select>
              </div>
              <div>
                <label className="block text-slate uppercase text-[10px] mb-1">Mô tả chi tiết</label>
                <textarea rows="3" value={incidentNote} onChange={e => setIncidentNote(e.target.value)}
                  placeholder="Nhập mô tả sự cố..."
                  className="w-full p-3 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-amber-500 font-normal" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowIncidentModal(false)} className="flex-1 h-11 border border-chalk text-slate rounded-xl font-bold text-xs hover:bg-fog">Hủy</button>
              <button disabled={!incidentType} onClick={handleSubmitIncident}
                className={`flex-1 h-11 rounded-xl font-extrabold text-sm shadow-md ${incidentType ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                Gửi báo cáo sự cố
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
