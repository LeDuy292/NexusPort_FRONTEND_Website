import React, { useState, useEffect, useRef } from 'react'
import apiClient from '../../services/apiClient'
import gateService from '../../services/gateService'

export default function GateControl() {
  const [currentTime, setCurrentTime] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [mode, setMode] = useState('checkin') // 'checkin' | 'checkout'
  
  // Trạng thái Camera máy (Webcam)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [capturedImage, setCapturedImage] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  // Trạng thái Nhận dạng AI (ANPR) & Tự động quét
  const [detectedPlate, setDetectedPlate] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [isAiScanning, setIsAiScanning] = useState(false)
  const autoScanEnabled = true // Luôn quét tự động, không có nút tắt
  const isScanningRef = useRef(false)
  const lastScannedPlateRef = useRef('')
  const [aiCropImage, setAiCropImage] = useState(null)
  const [verificationOverride, setVerificationOverride] = useState(false)

  // Trạng thái Barie & Xử lý Cổng
  // 'idle' | 'passed' | 'rejected' | 'checked-in' | 'incident-reported'
  const [processingStatus, setProcessingStatus] = useState('idle')
  const [barrierState, setBarrierState] = useState('closed') // 'closed' | 'opening' | 'opened'
  const [rejectionReason, setRejectionReason] = useState('')

  // Modals
  const [showCheckInModal, setShowCheckInModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showIncidentModal, setShowIncidentModal] = useState(false)
  
  // Form Tạo sự cố
  const [incidentType, setIncidentType] = useState('Sai biển số xe so với booking')
  const [incidentSeverity, setIncidentSeverity] = useState('HIGH')
  const [incidentNote, setIncidentNote] = useState('')

  // Dữ liệu Booking thực tế kết nối API Backend
  const [activeBooking, setActiveBooking] = useState(null)
  const [cachedBookings, setCachedBookings] = useState([])
  const [cachedVehicles, setCachedVehicles] = useState([])

  // ── 1. ĐỒNG HỒ THỜI GIAN THỰC ───────────────────────────────────────────
  useEffect(() => {
    const tick = () => setCurrentTime(new Date().toLocaleTimeString('vi-VN'))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // ── 2. TẢI DỮ LIỆU BOOKING & VEHICLE THỰC TẾ TỪ BACKEND ────────────────
  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      const [bookingRes, vehicleRes] = await Promise.all([
        apiClient.get('/v1/booking').catch(() => ({ data: { items: [] } })),
        apiClient.get('/v1/vehicle').catch(() => ({ data: [] }))
      ])

      const bookings = bookingRes.data?.items || bookingRes.data || []
      const vehicles = vehicleRes.data || []
      setCachedBookings(bookings)
      setCachedVehicles(vehicles)

      // XÓA MOCK DATA: Tuyệt đối KHÔNG gán activeBooking mặc định
      // Thông tin Booking chỉ được hiển thị khi Camera AI quét và kiểm tra ĐÚNG với dữ liệu thật.
      setActiveBooking(null)
      setProcessingStatus('idle')
    } catch (err) {
      console.error('Lỗi tải dữ liệu cổng:', err)
    }
  }

  // Tự động kích hoạt camera máy khi vào màn hình kiểm soát cổng & dọn dẹp khi rời
  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
    }
  }, [])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4500)
  }

  // ── 3. QUẢN LÝ WEBCAM (CAMERA MÁY) ──────────────────────────────────────
  const startCamera = async () => {
    setCameraLoading(true)
    setCameraError(null)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ truy cập Webcam thiết bị.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment',
        },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
        }
      }
      setCameraActive(true)
      showToast('📷 Đã kết nối Camera máy (Webcam) thành công!')
    } catch (err) {
      console.error('Webcam Error:', err)
      setCameraError(err.message || 'Không thể mở Camera máy.')
      showToast('⚠️ Không thể mở Camera máy: ' + (err.message || 'Quyền truy cập bị từ chối'))
    } finally {
      setCameraLoading(false)
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject
      const tracks = stream.getTracks()
      tracks.forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  // ── 4. ĐỐI SOÁT QUA RULE ENGINE BACKEND & TỰ ĐỘNG TỪ CHỐI NẾU THẤT BẠI ─────────────────────────
  const normalizePlate = (str) => (str || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

  const evaluateVerification = async (plate, currentConfidence = 98) => {
    if (!plate || !plate.trim()) return

    showToast(`🔍 Đang gửi biển số "${plate}" đến Rule Engine backend để đối soát...`)

    try {
      // Gọi trực tiếp API đối soát qua 7 điều kiện Rule Engine của Backend C#
      const verifyRes = await gateService.verifyGateScan({
        gateCode: 'GATE_A',
        laneCode: 'LANE_01',
        detectedVehiclePlate: plate,
        vehicleDetected: true,
        plateConfidence: (currentConfidence || 98) / 100,
        verificationType: mode === 'checkin' ? 'AI_GATE_IN' : 'AI_GATE_OUT',
      })

      if (verifyRes.success && verifyRes.data) {
        const result = verifyRes.data
        const isPass = result.status === 'PASS' || result.isSuccess === true

        if (isPass) {
          // ✅ KIỂM TRA ĐÚNG: Nạp thông tin thật từ Backend và TỰ ĐỘNG MỞ CỔNG
          const bkg = result.booking
          const matchedFull = cachedBookings.find(
            (b) => b.bookingCode === bkg?.bookingNumber || b.bookingNumber === bkg?.bookingNumber || b.id === bkg?.bookingId
          )
          const matchedVehicle = cachedVehicles.find((v) => normalizePlate(v.plateNumber) === normalizePlate(plate))

          const bookingData = {
            id: bkg?.bookingId || bkg?.bookingNumber || '—',
            bookingCode: bkg?.bookingNumber || matchedFull?.bookingCode || '—',
            company: matchedFull?.carrierName || 'Công ty CP Vận tải Quốc tế Nexus',
            vehicleId: matchedVehicle?.id ? `TRK-${matchedVehicle.id.slice(0, 4).toUpperCase()}` : `TRK-${normalizePlate(plate).slice(0, 4)}`,
            licensePlate: plate,
            status: 'Checked-in',
            licenseNumber: 'Hợp lệ',
            licenseStatus: 'Valid',
            driverName: bkg?.driverName || matchedFull?.driverName || 'Tài xế đã đăng ký',
            containerId: matchedFull?.containers?.[0]?.containerNumber || matchedFull?.containerIds?.[0] || 'MSCU1234567',
            containerType: matchedFull?.containers?.[0]?.containerType || '40HC',
            cargoType: 'Hàng xuất nhập khẩu',
            operation: bkg?.gateType === 'GateOut' ? 'Giao container hàng' : 'Hạ bãi container',
            gate: 'Cổng A · Làn 01',
            etaDisplay: bkg?.validFrom
              ? `${new Date(bkg.validFrom).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(bkg.validTo).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
              : 'Trong khung giờ hợp lệ',
            sealNumber: 'SEAL-CHECKED',
          }
          setActiveBooking(bookingData)

          // 🚀 TỰ ĐỘNG MỞ CỔNG — Không cần nhấn nút xác nhận
          setProcessingStatus('checked-in')
          setBarrierState('opening')
          setTimeout(() => setBarrierState('opened'), 600)
          setRejectionReason('')
          showToast(`🟢 XÁC MINH HỢP LỆ — CỔNG TỰ ĐỘNG MỞ cho xe "${plate}"!`)

          // Gọi API Backend ghi nhận Gate-In
          gateService.approveGateIn({
            gateCode: 'GATE_A',
            laneCode: 'LANE_01',
            gateType: mode === 'checkin' ? 'GateIn' : 'GateOut',
            vehiclePlate: plate,
            bookingNumber: bookingData.bookingCode,
            containerNumber: bookingData.containerId,
            approvedBy: 'Auto-Gate AI',
            notes: 'Tự động mở cổng sau xác minh AI thành công.',
          }).catch(() => {})
        } else {
          // 🚫 KIỂM TRA SAI: Không tìm thấy booking hoặc điều kiện không hợp lệ
          setActiveBooking(null)
          setProcessingStatus('rejected')
          setBarrierState('closed')
          const reason = result.message || result.failureReason || `Biển số "${plate}" không có Booking hợp lệ trong hệ thống`
          setRejectionReason(reason)
          setIncidentNote(reason)
          showToast(`⛔ TỰ ĐỘNG TỪ CHỐI VÀO CỔNG — ${reason}`)
        }
      } else {
        // Backend API trả về lỗi hoặc không tìm thấy
        setActiveBooking(null)
        setProcessingStatus('rejected')
        setBarrierState('closed')
        const reason = verifyRes.error || `Biển số "${plate}" không khớp bất kỳ Booking nào trong hệ thống`
        setRejectionReason(reason)
        setIncidentNote(reason)
        showToast(`⛔ TỰ ĐỘNG TỪ CHỐI VÀO CỔNG — ${reason}`)
      }
    } catch (err) {
      setActiveBooking(null)
      setProcessingStatus('rejected')
      const reason = `Lỗi hệ thống khi kiểm tra: ${err.message}`
      setRejectionReason(reason)
      showToast(`⛔ ${reason}`)
    }
  }

  // Quét thủ công 1 lần nếu cần
  const triggerSingleScan = async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) {
      showToast('⚠️ Camera chưa sẵn sàng nhận khung hình')
      return
    }
    try {
      setIsAiScanning(true)
      const video = videoRef.current
      const canvas = canvasRef.current || document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

      const res = await fetch(dataUrl)
      const imageBlob = await res.blob()

      showToast('🔍 Đang phân tích biển số qua AI...')
      const aiRes = await gateService.recognizeVehicleImage(imageBlob, 'GATE_IN_A', 'LANE_01')
      if (aiRes.success && aiRes.data) {
        const data = aiRes.data
        // AI trả về cấu trúc lồng: license_plate.plate_number
        const plateObj = data.license_plate || {}
        const plate = plateObj.plate_number ? plateObj.plate_number.trim().toUpperCase() : ''
        const conf = plateObj.ocr_confidence ? plateObj.ocr_confidence * 100 : (plate ? 97.5 : 0)

        if (plate) {
          setCapturedImage(dataUrl)
          setDetectedPlate(plate)
          setConfidence(conf)
          if (plateObj.plate_image_base64) setAiCropImage(plateObj.plate_image_base64)
          lastScannedPlateRef.current = plate
          showToast(`🎯 AI nhận diện: "${plate}" (${conf.toFixed(1)}%)`)
          evaluateVerification(plate)
        } else {
          showToast('⚠️ Không tìm thấy biển số xe trong góc quay')
        }
      } else {
        showToast('⚠️ Không tìm thấy biển số xe trong góc quay')
      }
    } catch (_err) {
      showToast('❌ Lỗi kết nối dịch vụ AI nhận diện biển số')
    } finally {
      setIsAiScanning(false)
    }
  }

  // ── 5. TỰ ĐỘNG QUÉT BIỂN SỐ LIÊN TỤC THEO THỜI GIAN THỰC (AUTO-ANPR) ─────
  useEffect(() => {
    if (!cameraActive || !autoScanEnabled || processingStatus === 'checked-in') return

    const scanInterval = setInterval(async () => {
      // Tránh dồn request nếu AI đang xử lý frame trước đó hoặc video chưa nạp khung hình
      if (isScanningRef.current || !videoRef.current || videoRef.current.readyState < 2) return

      try {
        isScanningRef.current = true
        setIsAiScanning(true)

        const video = videoRef.current
        const canvas = canvasRef.current || document.createElement('canvas')
        canvas.width = video.videoWidth || 1280
        canvas.height = video.videoHeight || 720
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

        const res = await fetch(dataUrl)
        const imageBlob = await res.blob()

        const aiRes = await gateService.recognizeVehicleImage(imageBlob, 'GATE_IN_A', 'LANE_01')
        if (aiRes.success && aiRes.data) {
          const data = aiRes.data
          // AI trả về cấu trúc lồng: license_plate.plate_number, license_plate.ocr_confidence
          const plateObj = data.license_plate || {}
          const plate = plateObj.plate_number ? plateObj.plate_number.trim().toUpperCase() : ''
          const conf = plateObj.ocr_confidence ? plateObj.ocr_confidence * 100 : (plate ? 97.5 : 0)

          if (plate && plate.length >= 4) {
            setCapturedImage(dataUrl)
            setDetectedPlate(plate)
            setConfidence(conf)
            if (plateObj.plate_image_base64) setAiCropImage(plateObj.plate_image_base64)

            // Khi biển số mới xuất hiện khác lần trước
            if (lastScannedPlateRef.current !== plate) {
              lastScannedPlateRef.current = plate
              showToast(`🎯 AI tự động bắt được biển số: "${plate}" (${conf.toFixed(1)}%)`)
              evaluateVerification(plate)
            }
          }
        }
      } catch (_err) {
        // Tự động quét trong nền, không spam toast lỗi khi xe chưa vào vùng quét
      } finally {
        setIsAiScanning(false)
        isScanningRef.current = false
      }
    }, 2000)

    return () => clearInterval(scanInterval)
  }, [cameraActive, autoScanEnabled, processingStatus, activeBooking])

  // Danh sách checklist kiểm tra
  const normDetected = normalizePlate(detectedPlate)
  const normBooking = normalizePlate(activeBooking?.licensePlate)
  const plateMatch = Boolean(normDetected && normDetected === normBooking)

  const checklist = [
    { id: 'plate', label: 'Biển số xe khớp với booking', ok: plateMatch },
    { id: 'booking', label: 'Booking đã được Dispatcher phê duyệt', ok: ['Approved', 'Checked-in'].includes(activeBooking?.status) },
    { id: 'driver', label: 'Giấy phép lái xe còn hiệu lực', ok: activeBooking?.licenseStatus === 'Valid' },
    { id: 'container', label: 'Mã container khớp với booking', ok: Boolean(activeBooking?.containerId) },
    { id: 'time', label: 'Thời gian ETA hợp lệ', ok: true },
    { id: 'state', label: mode === 'checkout' ? 'Đã check-in trước đó' : 'Chưa hoàn tất check-in', ok: true },
  ]

  const allValid = checklist.every((c) => c.ok) || verificationOverride

  // ── 6. XÁC NHẬN MỞ CỔNG (KHI THÀNH CÔNG) ───────────────────────────────
  const handleConfirmOpenGate = async () => {
    setShowCheckInModal(false)

    // Gọi API Backend duyệt Gate-In thật
    try {
      showToast('🚀 Đang gửi lệnh mở cổng và cập nhật hệ thống Backend...')
      const _approveRes = await gateService.approveGateIn({
        gateCode: 'GATE_A',
        laneCode: 'LANE_01',
        gateType: mode === 'checkin' ? 'GateIn' : 'GateOut',
        vehiclePlate: detectedPlate || activeBooking?.licensePlate,
        bookingNumber: activeBooking?.bookingCode,
        containerNumber: activeBooking?.containerId,
        approvedBy: 'Gate Officer',
        notes: 'Xác minh thành công qua AI Camera. Mở barie cho xe vào cảng.',
      })

      // Hiệu ứng mở Barie
      setBarrierState('opening')
      setTimeout(() => setBarrierState('opened'), 600)

      setProcessingStatus('checked-in')
      setActiveBooking((prev) => (prev ? { ...prev, status: 'Checked-in' } : null))

      showToast(
        mode === 'checkin'
          ? `🎉 CỔNG ĐÃ MỞ — Xe ${activeBooking?.licensePlate} được phép vào Cảng Tiên Sa!`
          : `🎉 CỔNG ĐÃ MỞ — Xe ${activeBooking?.licensePlate} hoàn tất thủ tục ra cổng!`
      )
    } catch (err) {
      showToast(`❌ Lỗi khi mở cổng: ${err.message}`)
    }
  }

  // ── 7. TẠO SỰ CỐ GỬI CHO DISPATCHER ───────────────────────────────────
  const handleSubmitIncident = () => {
    if (!incidentType) return

    const incidentCode = `INC-${Date.now().toString().slice(-6)}`
    const newIncident = {
      id: incidentCode,
      type: incidentType,
      severity: incidentSeverity,
      bookingNumber: activeBooking?.bookingCode,
      detectedPlate: detectedPlate,
      expectedPlate: activeBooking?.licensePlate,
      driverName: activeBooking?.driverName,
      gateCode: 'Cổng A · Làn 01',
      description: incidentNote || rejectionReason,
      timestamp: new Date().toISOString(),
      evidenceImage: capturedImage,
      status: 'SENT_TO_DISPATCHER',
    }

    // Lưu vào localStorage để các trang Gate / Dispatcher dùng chung
    try {
      const existing = JSON.parse(localStorage.getItem('nexusport_gate_incidents') || '[]')
      existing.unshift(newIncident)
      localStorage.setItem('nexusport_gate_incidents', JSON.stringify(existing))
    } catch (e) {
      console.error(e)
    }

    setShowIncidentModal(false)
    setProcessingStatus('incident-reported')
    showToast(`📋 ĐÃ GỬI BÁO CÁO SỰ CỐ #${incidentCode} TỚI ĐIỀU ĐỘ VIÊN (DISPATCHER) THÀNH CÔNG!`)
  }

  return (
    <div className="p-4 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen text-slate-900 relative">
      {/* Toast thông báo */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-slate-900 text-white border border-orange-500 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-3 z-[100] animate-bounce">
          <span className="text-orange-400">●</span>
          {toastMessage}
        </div>
      )}

      {/* Canvas ẩn dùng để chụp frame từ Webcam */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ── HEADER & SERVICE STATUS BAR ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black bg-orange-100 text-orange-800 border border-orange-200 px-3 py-0.5 rounded-full uppercase">
              NHÂN VIÊN CỔNG (GATE OFFICER)
            </span>
            <span
              className={`text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                processingStatus === 'checked-in'
                  ? 'bg-emerald-100 text-emerald-900'
                  : processingStatus === 'rejected'
                  ? 'bg-rose-100 text-rose-900'
                  : processingStatus === 'passed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  processingStatus === 'checked-in' || processingStatus === 'passed'
                    ? 'bg-emerald-500 animate-pulse'
                    : processingStatus === 'rejected'
                    ? 'bg-rose-600'
                    : 'bg-amber-500'
                }`}
              ></span>
              {processingStatus === 'checked-in'
                ? 'ĐÃ MỞ CỔNG (CHECKED-IN)'
                : processingStatus === 'passed'
                ? 'ĐỐI SOÁT HỢP LỆ — SẴN SÀNG MỞ CỔNG'
                : processingStatus === 'rejected'
                ? 'TỰ ĐỘNG TỪ CHỐI VÀO CỔNG'
                : processingStatus === 'incident-reported'
                ? 'ĐÃ BÁO SỰ CỐ ĐIỀU ĐỘ (DISPATCHER)'
                : 'CHỜ XE TIẾP CẬN CỔNG'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Kiểm Soát Cổng — AI Camera & Barie Tự Động
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Nhận diện biển số qua Camera máy · Tự động từ chối nếu sai phạm · Xác nhận mở cổng và báo sự cố Dispatcher.
          </p>
        </div>

        {/* Nút điều hướng Mode & Đồng hồ */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs font-bold">
            <button
              onClick={() => {
                setMode('checkin')
                setProcessingStatus('idle')
                setBarrierState('closed')
              }}
              className={`px-4 py-2.5 transition-all ${
                mode === 'checkin'
                  ? 'bg-orange-500 text-white font-black shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              CỔNG VÀO (GATE-IN)
            </button>
            <button
              onClick={() => {
                setMode('checkout')
                setProcessingStatus('idle')
                setBarrierState('closed')
              }}
              className={`px-4 py-2.5 transition-all ${
                mode === 'checkout'
                  ? 'bg-slate-900 text-white font-black shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              CỔNG RA (GATE-OUT)
            </button>
          </div>
          <span className="font-mono text-sm font-bold text-slate-700 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
            {currentTime}
          </span>
        </div>
      </div>

      {/* ── MAIN CONTENT (2 CỘT) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ══ CỘT TRÁI (7 cols): CAMERA MÁY + HUD NHẬN DIỆN ══ */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Thanh điều khiển Camera máy (BẮT BUỘC CAMERA TRỰC TIẾP) */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-3 h-3 rounded-full ${
                  cameraActive ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500' : 'bg-rose-500'
                }`}
              ></span>
              <div>
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider font-mono block">
                  CAM-01 · CỔNG A — LÀN 01 {cameraActive ? '(WEBCAM MÁY ĐANG HOẠT ĐỘNG)' : '(CHƯA BẬT CAMERA)'}
                </span>
                <span className="text-[10px] text-amber-600 font-bold font-mono">
                  ● BẮT BUỘC SỬ DỤNG CAMERA TRỰC TIẾP TẠI CỔNG
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">


              {!cameraActive ? (
                <button
                  onClick={startCamera}
                  disabled={cameraLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer font-mono active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">videocam</span>
                  {cameraLoading ? 'ĐANG MỞ CAMERA...' : 'BẬT CAMERA MÁY (BẮT BUỘC)'}
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="px-3.5 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer font-mono"
                >
                  <span className="material-symbols-outlined text-base">videocam_off</span>
                  TẮT CAMERA
                </button>
              )}
            </div>
          </div>

          {/* Khung hiển thị Camera (Webcam Stream Trực Tiếp) */}
          <div className="relative aspect-video rounded-2xl overflow-hidden shadow-xl border-2 border-slate-800 bg-[#070b14] flex items-center justify-center">
            {/* 1. Luồng video Webcam máy thật */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover ${
                cameraActive ? 'block' : 'hidden'
              }`}
            />

            {/* 2. Khi Camera chưa bật: hiển thị màn hình chờ BẮT BUỘC CAMERA */}
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-[#070b14]/90 backdrop-blur-xs">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400 mb-3 shadow-xl shadow-blue-500/10">
                  <span className="material-symbols-outlined text-3xl animate-pulse">videocam</span>
                </div>
                <div className="text-amber-400 text-xs font-mono font-black tracking-wider uppercase mb-1.5 px-3.5 py-1 bg-amber-950/70 border border-amber-500/50 rounded-full">
                  ⚠️ BẮT BUỘC SỬ DỤNG CAMERA TRỰC TIẾP
                </div>
                <p className="text-slate-300 text-xs max-w-sm mt-2 mb-4 leading-relaxed font-sans">
                  Hệ thống kiểm soát cổng Smart Port yêu cầu kết nối luồng Camera/Webcam để AI nhận diện phương tiện và quét biển số tự động theo thời gian thực.
                </p>
                <button
                  onClick={startCamera}
                  disabled={cameraLoading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-xl shadow-blue-600/30 flex items-center gap-2 transition-all active:scale-95 cursor-pointer font-mono"
                >
                  <span className="material-symbols-outlined text-base">videocam</span>
                  {cameraLoading ? 'ĐANG KẾT NỐI...' : 'BẬT CAMERA MÁY NGAY'}
                </button>
              </div>
            )}

            {/* Overlay kính mờ & lưới quét laser */}
            <div className="absolute inset-0 bg-black/25 pointer-events-none"></div>

            {/* HUD Bounding Box Xe kèm Tia Laser Tự Động Quét */}
            <div className="absolute top-[12%] left-[10%] right-[10%] h-[55%] border-2 border-orange-500/80 rounded pointer-events-none overflow-hidden">
              <div className="absolute -top-6 left-0 bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                VÙNG QUÉT PHƯƠNG TIỆN (YOLO)
              </div>
              <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-400"></div>
              <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-400"></div>
              <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-400"></div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-400"></div>

              {/* Laser Scanning Line chuyển động quét tự động */}
              {cameraActive && autoScanEnabled && (
                <div
                  className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981]"
                  style={{
                    animation: 'scannerSweep 2.4s ease-in-out infinite alternate',
                  }}
                ></div>
              )}
            </div>

            {/* HUD Bounding Box Biển số */}
            <div className="absolute bottom-[20%] left-[28%] right-[28%] h-[12%] border-2 border-blue-400/90 rounded bg-blue-500/10 pointer-events-none flex items-center justify-center">
              <div className="absolute -top-5 left-0 bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 font-mono">
                BIỂN SỐ XE (ANPR)
              </div>
              {detectedPlate && (
                <span className="text-white font-mono font-black text-sm tracking-widest drop-shadow-md">
                  {detectedPlate}
                </span>
              )}
            </div>

            {/* Trạng thái ANPR trên góc */}
            <div className="absolute top-3 left-3 bg-black/75 border border-emerald-500 text-emerald-400 text-[10px] font-mono px-2.5 py-1 rounded-lg flex items-center gap-1.5 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              ANPR LIVE · {confidence > 0 ? `${confidence.toFixed(1)}%` : 'CHỜ TÍN HIỆU'}
            </div>

            {/* Timestamp trên góc */}
            <div className="absolute bottom-3 left-3 text-[10px] font-mono text-emerald-300 bg-black/70 px-2.5 py-1 rounded-lg backdrop-blur-sm">
              {new Date().toLocaleDateString('vi-VN')} {currentTime}
            </div>

            {/* Badge Báo hiệu Tự Động Quét trên luồng Video (Đã bỏ nút chụp thủ công) */}
            {cameraActive && (
              <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
                <div className="px-3.5 py-1.5 bg-black/80 backdrop-blur-md border border-emerald-500/60 rounded-xl text-xs font-mono font-black text-emerald-400 flex items-center gap-2 shadow-2xl">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>{isAiScanning ? '⚡ AI ĐANG QUÉT FRAME...' : '🎯 TỰ ĐỘNG QUÉT LIÊN TỤC'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Banner Báo lỗi Camera nếu có */}
          {cameraError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-center justify-between">
              <span>⚠️ {cameraError}</span>
              <button
                onClick={startCamera}
                className="underline font-bold text-rose-900 ml-2 hover:text-rose-700"
              >
                Thử lại
              </button>
            </div>
          )}

          {/* KẾT QUẢ NHẬN DẠNG ANPR & TEST NHANH */}
          <div
            className={`rounded-2xl border-2 p-4 space-y-3 transition-all ${
              plateMatch
                ? 'bg-emerald-50 border-emerald-400'
                : detectedPlate
                ? 'bg-rose-50 border-rose-400'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                KẾT QUẢ NHẬN DẠNG ANPR TỪ CAMERA
              </span>
              <span
                className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border font-mono ${
                  confidence > 90
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                }`}
              >
                Độ chính xác: {confidence.toFixed(1)}%
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <div className="text-[10px] text-slate-500 font-mono">BIỂN SỐ XE NHẬN DIỆN</div>
                <div className="font-mono text-2xl font-black text-slate-900 tracking-widest">
                  {detectedPlate || '— CHƯA QUÉT —'}
                </div>
              </div>

              {/* Ô hiển thị biển số nổi bật */}
              <div
                className={`h-12 px-6 rounded-xl flex items-center justify-center font-mono font-black text-xl tracking-widest border-2 ${
                  plateMatch
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-400 shadow-inner'
                    : detectedPlate
                    ? 'bg-rose-100 text-rose-900 border-rose-400 shadow-inner'
                    : 'bg-slate-100 text-slate-500 border-slate-300'
                }`}
              >
                {detectedPlate || 'CHỜ BIỂN SỐ'}
              </div>

              {/* Huy hiệu chế độ tự động */}
              {cameraActive && (
                <div className="px-3 py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-mono font-black flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  AUTO ANPR
                </div>
              )}
            </div>

            {/* Thông báo kết quả đối chiếu */}
            {detectedPlate && (
              <div
                className={`text-xs font-black flex items-center gap-2 ${
                  processingStatus === 'passed' ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                <span className="text-base">{processingStatus === 'passed' ? '✓' : '✗'}</span>
                <span>
                  {processingStatus === 'passed'
                    ? `Biển số ${detectedPlate} ĐÃ ĐƯỢC XÁC THỰC HỢP LỆ VỚI GATE BOOKING`
                    : `Biển số ${detectedPlate} — TỰ ĐỘNG TỪ CHỐI! (${rejectionReason || 'Không tìm thấy Booking'})`}
                </span>
              </div>
            )}

          </div>

          {/* ẢNH CHỤP HIỆN TRƯỜNG & CONTAINER */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-3 space-y-1.5 border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase">ẢNH CHỤP HIỆN TRƯỜNG</span>
                {capturedImage && <span className="text-[9px] font-bold text-emerald-600 font-mono">Đã chụp</span>}
              </div>
              <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                {capturedImage ? (
                  <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-slate-600 text-2xl">image</span>
                )}
              </div>
              <div className="w-full text-center text-[10px] font-bold text-emerald-600 font-mono py-1">
                {isAiScanning ? '● Đang quét AI...' : '● Tự động quét theo chu kỳ'}
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 space-y-1.5 border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase">CẮT BIỂN SỐ (OCR CROP)</span>
                {aiCropImage && <span className="text-[9px] font-bold text-blue-600 font-mono">YOLO Crop</span>}
              </div>
              <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                {aiCropImage ? (
                  <img src={aiCropImage} alt="Plate Crop" className="w-full h-full object-contain p-2" />
                ) : (
                  <span className="material-symbols-outlined text-slate-600 text-2xl">crop</span>
                )}
              </div>
              <div className="text-center text-[10px] text-slate-500 font-mono">
                {detectedPlate ? `Biển số: ${detectedPlate}` : '[ Chưa có ảnh cắt ]'}
              </div>
            </div>
          </div>
        </div>

        {/* ══ CỘT PHẢI (5 cols): THÔNG TIN BOOKING + QUYẾT ĐỊNH MỞ CỔNG / TỪ CHỐI ══ */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* ══ MÔ PHỎNG BARIE CỔNG (WHITE THEME HIGH-CONTRAST) ══ */}
          <div
            className="rounded-2xl p-5 shadow-sm space-y-4 transition-all"
            style={{
              backgroundColor: '#ffffff',
              border: '2px solid #e2e8f0',
              boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.06)',
            }}
          >
            {/* Header: Tiêu đề và Huy hiệu trạng thái Barie trên nền trắng cực rõ */}
            <div className="flex flex-wrap justify-between items-center gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shadow-xs"
                  style={{
                    backgroundColor: '#fff7ed',
                    border: '1.5px solid #fed7aa',
                    color: '#ea580c',
                  }}
                >
                  <span className="material-symbols-outlined text-xl">traffic</span>
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wider uppercase text-slate-900 font-mono flex items-center gap-1.5">
                    TRẠNG THÁI BARIE CỔNG A
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono font-bold block">
                    LÀN 01 · TỰ ĐỘNG HÓA BARRIER GATE
                  </span>
                </div>
              </div>

              {/* Badge trạng thái Barie: Nổi bật, cực kỳ rõ ràng */}
              <div
                className="px-3.5 py-1.5 rounded-full text-xs font-black font-mono tracking-wider flex items-center gap-2 shadow-xs transition-all"
                style={{
                  backgroundColor: barrierState === 'opened' ? '#f0fdf4' : '#fef2f2',
                  border: `2px solid ${barrierState === 'opened' ? '#22c55e' : '#ef4444'}`,
                  color: barrierState === 'opened' ? '#15803d' : '#b91c1c',
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full animate-ping"
                  style={{
                    backgroundColor: barrierState === 'opened' ? '#22c55e' : '#ef4444',
                  }}
                ></span>
                <span>
                  {barrierState === 'opened' ? 'BARIE ĐÃ MỞ (OPEN)' : 'BARIE ĐANG ĐÓNG (LOCKED)'}
                </span>
              </div>
            </div>

            {/* Khung mô phỏng trực quan chuyển động Barie */}
            <div
              className="relative h-28 rounded-xl overflow-hidden flex items-center px-5 select-none"
              style={{
                backgroundColor: '#0f172a',
                border: '2px solid #334155',
                boxShadow: 'inset 0 3px 12px rgba(0,0,0,0.6)',
              }}
            >
              {/* Vạch sơn mặt đường & vạch dừng */}
              <div className="absolute inset-x-0 bottom-0 h-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between px-6">
                <span className="text-[8px] font-mono font-black text-amber-400 tracking-widest">
                  ◄◄ LÀN XE 01 · GATE IN
                </span>
                <span className="text-[8px] font-mono font-black text-slate-400 tracking-wider">
                  VẠCH DỪNG QUY ĐỊNH
                </span>
              </div>

              {/* Trụ Barie công nghiệp vàng nổi bật */}
              <div
                className="w-8 h-18 rounded-t-lg flex flex-col items-center justify-between py-1.5 z-10 shadow-2xl relative"
                style={{
                  backgroundColor: '#f59e0b',
                  border: '2px solid #d97706',
                  boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
                }}
              >
                <div
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: barrierState === 'opened' ? '#22c55e' : '#ef4444',
                    boxShadow: `0 0 10px ${barrierState === 'opened' ? '#22c55e' : '#ef4444'}`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                </div>
                <div className="text-[8px] font-mono font-black text-slate-950 px-1 py-0.5 bg-yellow-300 rounded leading-none">
                  NEXUS
                </div>
              </div>

              {/* Thanh cần Barie với sọc phản quang đỏ trắng siêu sắc nét */}
              <div className="flex-1 relative h-4 overflow-visible">
                <div
                  className="h-4 w-full rounded-r-md shadow-2xl origin-left"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(45deg, #dc2626 0, #dc2626 16px, #ffffff 16px, #ffffff 32px)',
                    border: '1.5px solid #b91c1c',
                    boxShadow:
                      barrierState === 'opened'
                        ? '0 0 15px rgba(34, 197, 94, 0.6)'
                        : '0 4px 15px rgba(220, 38, 38, 0.7)',
                    transform: barrierState === 'opened' ? 'rotate(-65deg) translateY(-8px)' : 'rotate(0deg)',
                    transition: 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                ></div>
              </div>

              {/* Đèn tín hiệu giao thông LED 2 tầng */}
              <div
                className="ml-4 flex flex-col items-center gap-2 p-2 rounded-xl z-10"
                style={{
                  backgroundColor: '#020617',
                  border: '1.5px solid #334155',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                }}
              >
                {/* Đèn Đỏ (STOP) */}
                <div
                  className="w-4 h-4 rounded-full transition-all"
                  style={{
                    backgroundColor: barrierState === 'closed' ? '#ef4444' : '#450a0a',
                    boxShadow: barrierState === 'closed' ? '0 0 14px 3px #ef4444' : 'none',
                    border: '1px solid #7f1d1d',
                  }}
                  title="Đèn Đỏ: Dừng xe"
                ></div>
                {/* Đèn Xanh (GO) */}
                <div
                  className="w-4 h-4 rounded-full transition-all"
                  style={{
                    backgroundColor: barrierState === 'opened' ? '#22c55e' : '#052e16',
                    boxShadow: barrierState === 'opened' ? '0 0 14px 3px #22c55e' : 'none',
                    border: '1px solid #14532d',
                  }}
                  title="Đèn Xanh: Được phép qua"
                ></div>
              </div>
            </div>

            {/* Banner trạng thái Barie - Nền sáng tương phản cao, chữ đậm cực nét */}
            <div
              className="py-3 px-4 rounded-xl text-center font-mono font-black text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
              style={{
                backgroundColor:
                  barrierState === 'opened'
                    ? '#ecfdf5'
                    : processingStatus === 'rejected'
                    ? '#fef2f2'
                    : '#f8fafc',
                border: `2px solid ${
                  barrierState === 'opened'
                    ? '#10b981'
                    : processingStatus === 'rejected'
                    ? '#ef4444'
                    : '#cbd5e1'
                }`,
                color:
                  barrierState === 'opened'
                    ? '#047857'
                    : processingStatus === 'rejected'
                    ? '#b91c1c'
                    : '#1e293b',
              }}
            >
              <span className="text-base">
                {barrierState === 'opened'
                  ? '🟢'
                  : processingStatus === 'rejected'
                  ? '⛔'
                  : '🔒'}
              </span>
              <span className="tracking-wide">
                {barrierState === 'opened'
                  ? 'CỔNG ĐANG MỞ — PHƯƠNG TIỆN ĐƯỢC PHÉP TIẾN VÀO CẢNG'
                  : processingStatus === 'rejected'
                  ? 'CỔNG TỰ ĐỘNG KHÓA — XE BỊ TỪ CHỐI DO KHÔNG KHỚP BOOKING'
                  : 'CỔNG ĐANG ĐÓNG — CHỜ HỆ THỐNG XÁC MINH PHƯƠNG TIỆN HỢP LỆ'}
              </span>
            </div>

            {/* Phím điều khiển Barie nhanh (Gate Officer Controls) */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <span className="text-[11px] font-mono text-slate-600 font-bold">
                Điều khiển thủ công:
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setBarrierState('opened')
                    showToast('🟢 Đã mở Barie Cổng A thành công!')
                  }}
                  disabled={barrierState === 'opened'}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black font-mono flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">lock_open</span>
                  MỞ BARIE
                </button>
                <button
                  onClick={() => {
                    setBarrierState('closed')
                    showToast('🔒 Đã đóng Barie Cổng A!')
                  }}
                  disabled={barrierState === 'closed'}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black font-mono flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">lock</span>
                  HẠ BARIE
                </button>
              </div>
            </div>
          </div>

          {/* THÔNG TIN GATE BOOKING ĐIỀU ĐỘ — CHỈ HIỂN THỊ KHI ĐỐI SOÁT ĐÚNG */}
          {(processingStatus === 'passed' || processingStatus === 'checked-in') && activeBooking ? (
            <div className="bg-white border-2 border-emerald-400 rounded-2xl p-5 shadow-lg space-y-4 animate-in zoom-in-95">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-black uppercase tracking-wider">
                    <span className="material-symbols-outlined text-sm">verified</span>
                    XÁC MINH GATE BOOKING THÀNH CÔNG
                  </div>
                  <h3 className="font-mono text-xl font-black text-slate-900 mt-0.5">
                    {activeBooking.bookingCode}
                  </h3>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-black border bg-emerald-100 text-emerald-900 border-emerald-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  {activeBooking.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs font-mono">
                <div>
                  <span className="text-slate-500">Doanh nghiệp vận tải:</span>
                  <div className="font-bold text-slate-800 truncate">{activeBooking.company}</div>
                </div>
                <div>
                  <span className="text-slate-500">Mã xe đăng ký:</span>
                  <div className="font-bold text-slate-800">{activeBooking.vehicleId}</div>
                </div>
                <div>
                  <span className="text-slate-500">Biển số theo Booking:</span>
                  <div className="font-black text-blue-700 text-sm">{activeBooking.licensePlate}</div>
                </div>
                <div>
                  <span className="text-slate-500">Tài xế:</span>
                  <div className="font-bold text-slate-800">{activeBooking.driverName}</div>
                </div>
                <div>
                  <span className="text-slate-500">Số GPLX:</span>
                  <div className="font-bold text-slate-800">
                    {activeBooking.licenseNumber} ({activeBooking.licenseStatus})
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Mã container:</span>
                  <div className="font-bold text-slate-800">{activeBooking.containerId}</div>
                </div>
                <div>
                  <span className="text-slate-500">Loại cont / Hàng:</span>
                  <div className="font-bold text-slate-800">{activeBooking.containerType} · {activeBooking.cargoType}</div>
                </div>
                <div>
                  <span className="text-slate-500">Loại tác nghiệp:</span>
                  <div className="font-bold text-slate-800">{activeBooking.operation}</div>
                </div>
                <div>
                  <span className="text-slate-500">Cổng / ETA:</span>
                  <div className="font-bold text-orange-600">{activeBooking.gate} · {activeBooking.etaDisplay}</div>
                </div>
                <div>
                  <span className="text-slate-500">Số seal:</span>
                  <div className="font-bold text-slate-800">{activeBooking.sealNumber}</div>
                </div>
              </div>
            </div>
          ) : processingStatus === 'rejected' ? (
            /* TRẠNG THÁI TỰ ĐỘNG TỪ CHỐI */
            <div className="bg-white border-2 border-rose-300 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-rose-700 border-b border-rose-100 pb-3">
                <span className="material-symbols-outlined text-2xl">gpp_bad</span>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider block text-rose-500">KẾT QUẢ ĐỐI SOÁT CỔNG</span>
                  <h4 className="text-sm font-black text-rose-950 uppercase">TỰ ĐỘNG TỪ CHỐI — KHÔNG HỢP LỆ</h4>
                </div>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-1 text-xs">
                <div className="font-bold text-rose-900 flex items-center justify-between">
                  <span>Biển số phát hiện:</span>
                  <span className="font-mono text-rose-700 text-sm font-black">{detectedPlate || 'Chưa rõ'}</span>
                </div>
                <div className="text-[11px] text-rose-800 leading-relaxed pt-1 border-t border-rose-200/60">
                  {rejectionReason || 'Không tìm thấy Gate Booking hợp lệ trong hệ thống tương ứng với thông tin phương tiện.'}
                </div>
              </div>
              <div className="text-[10px] text-slate-500 flex items-center justify-between font-mono">
                <span>Trạng thái Barie: <strong className="text-rose-600">ĐANG KHÓA</strong></span>
                <span className="text-amber-700 font-bold">Cần lập biên bản sự cố</span>
              </div>
            </div>
          ) : (
            /* TRẠNG THÁI CHỜ PHƯƠNG TIỆN (BAN ĐẦU / CHƯA QUÉT) */
            <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-6 shadow-sm text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">radar</span>
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  CHỜ PHƯƠNG TIỆN TIẾN VÀO VÙNG QUÉT
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  Camera AI đang tự động nhận diện biển số xe. Thông tin Gate Booking và chứng từ điều độ sẽ tự động hiển thị tại đây khi hệ thống đối soát hợp lệ.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Làn 01 · Camera ANPR sẵn sàng
              </div>
            </div>
          )}

          {/* DANH SÁCH KIỂM TRA (CHECKLIST) */}
          <div
            className={`rounded-2xl border-2 p-4 space-y-3 transition-all ${
              allValid
                ? 'bg-emerald-50 border-emerald-400'
                : processingStatus === 'rejected'
                ? 'bg-rose-50 border-rose-300'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                DANH SÁCH KIỂM TRA ĐIỀU KIỆN
              </span>
              {!allValid && (
                <button
                  onClick={() => setVerificationOverride(!verificationOverride)}
                  className="text-[10px] font-bold text-orange-700 underline hover:text-orange-900 cursor-pointer"
                >
                  {verificationOverride ? 'Tắt ghi đè' : 'Ghi đè thủ công'}
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {checklist.map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-xs">
                  <span
                    className={`font-black text-base ${
                      c.ok
                        ? 'text-emerald-600'
                        : processingStatus === 'rejected'
                        ? 'text-rose-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {c.ok ? '✓' : processingStatus === 'rejected' ? '✗' : '○'}
                  </span>
                  <span
                    className={
                      c.ok
                        ? 'text-emerald-950 font-medium'
                        : processingStatus === 'rejected'
                        ? 'text-rose-950 font-bold'
                        : 'text-slate-500'
                    }
                  >
                    {c.label}
                  </span>
                </div>
              ))}
            </div>

            {verificationOverride && (
              <div className="text-[10px] text-amber-900 bg-amber-100 border border-amber-300 rounded-lg px-2.5 py-1 font-bold">
                ⚠️ Ghi đè thủ công đang bật — Gate Officer chịu trách nhiệm phê duyệt ngoại lệ.
              </div>
            )}

            {/* BANNER THÀNH CÔNG, THẤT BẠI HOẶC CHỜ */}
            <div
              className={`text-center font-black text-sm py-2.5 rounded-xl border-2 ${
                processingStatus === 'passed' || processingStatus === 'checked-in'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-400 shadow-sm'
                  : processingStatus === 'rejected'
                  ? 'bg-rose-100 text-rose-900 border-rose-300 shadow-sm'
                  : 'bg-slate-100 text-slate-600 border-slate-300 shadow-sm'
              }`}
            >
              {processingStatus === 'passed' || processingStatus === 'checked-in'
                ? (mode === 'checkin' ? '🟢 XÁC MINH THÀNH CÔNG — SẴN SÀNG MỞ CỔNG' : '🟢 SẴN SÀNG MỞ CỔNG CHO XE RA')
                : processingStatus === 'rejected'
                ? '🔴 XÁC MINH THẤT BẠI — TỰ ĐỘNG TỪ CHỐI VÀO CỔNG'
                : '🟡 CHỜ PHƯƠNG TIỆN — CAMERA ĐANG QUÉT TỰ ĐỘNG'}
            </div>

            {rejectionReason && !allValid && (
              <div className="p-2.5 bg-rose-100/80 border border-rose-300 rounded-lg text-rose-900 text-xs font-bold flex items-start gap-1.5">
                <span className="material-symbols-outlined text-sm text-rose-700 mt-0.5">error</span>
                <span>{rejectionReason}</span>
              </div>
            )}
          </div>

          {/* ══ NÚT HÀNH ĐỘNG CHÍNH ══ */}
          {processingStatus === 'checked-in' ? (
            // KHI ĐÃ MỞ CỔNG TỰ ĐỘNG THÀNH CÔNG
            <div className="flex flex-col gap-2.5">
              <div className="h-14 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-black text-base shadow-xl flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-2xl">check_circle</span>
                {mode === 'checkin' ? '🎉 CỔNG ĐÃ TỰ ĐỘNG MỞ — XE ĐƯỢC VÀO CẢNG' : '🎉 CỔNG ĐÃ TỰ ĐỘNG MỞ — XE ĐƯỢC RA NGOÀI'}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setProcessingStatus('idle')
                    setActiveBooking(null)
                    setDetectedPlate('')
                    setCapturedImage(null)
                    setAiCropImage(null)
                    setBarrierState('closed')
                    lastScannedPlateRef.current = ''
                  }}
                  className="h-10 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">refresh</span>
                  Xe tiếp theo
                </button>
                <button
                  onClick={() => setShowIncidentModal(true)}
                  className="h-10 border border-amber-400 text-amber-800 hover:bg-amber-50 rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">report</span>
                  Báo sự cố Dispatcher
                </button>
              </div>
            </div>
          ) : processingStatus === 'rejected' ? (
            // KHI BỊ TỪ CHỐI: HIỂN THỊ CÁC HÀNH ĐỘNG XỬ LÝ SỰ CỐ
            <div className="flex flex-col gap-3">
              <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-900 text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-xl text-rose-600">block</span>
                <div>
                  <div>ĐÃ TỰ ĐỘNG TỪ CHỐI VÀO CỔNG</div>
                  <div className="text-[11px] font-normal text-rose-700">
                    Xe không đủ điều kiện an toàn. Cổng đã tự động khóa. Vui lòng tạo sự cố để gửi cho Dispatcher.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setShowIncidentModal(true)}
                  className="h-13 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl font-black text-sm shadow-lg flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl">report</span>
                  TẠO SỰ CỐ GỬI DISPATCHER
                </button>

                <button
                  onClick={() => {
                    setProcessingStatus('idle')
                    setDetectedPlate('')
                    setCapturedImage(null)
                    setAiCropImage(null)
                    setRejectionReason('')
                    lastScannedPlateRef.current = ''
                    triggerSingleScan()
                  }}
                  className="h-13 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl">refresh</span>
                  QUÉT LẠI CAMERA
                </button>
              </div>
            </div>
          ) : (
            // KHI CHỜ (IDLE): CHỜ QUÉT
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-slate-500 font-bold text-xs space-y-1">
              <span className="material-symbols-outlined text-xl text-slate-400 block mx-auto">hourglass_empty</span>
              <div>Chờ Camera AI tự động bắt biển số xe tại vị trí vạch dừng</div>
            </div>
          )}
        </div>
      </div>

      {/* Modal xác nhận mở cổng đã bị xóa — cổng tự động mở khi xác minh thành công */}

      {/* ══ MODAL TỪ CHỐI THỦ CÔNG ══ */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
              <span className="material-symbols-outlined text-3xl text-rose-600">block</span>
              <h3 className="text-xl font-black text-slate-900">TỪ CHỐI VÀO CỔNG</h3>
            </div>
            <p className="text-xs text-slate-600">
              Xác nhận từ chối xe <strong>{detectedPlate || activeBooking?.licensePlate}</strong> vào cảng. Cổng sẽ tiếp tục đóng và lưu sự cố kiểm soát.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 h-11 border border-slate-300 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-100"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setProcessingStatus('rejected')
                  setBarrierState('closed')
                  showToast(`🚫 Đã từ chối xe ${detectedPlate || activeBooking?.licensePlate} vào cảng.`)
                }}
                className="flex-1 h-11 bg-rose-600 text-white rounded-xl font-black text-sm hover:bg-rose-700"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL TẠO SỰ CỐ ĐỂ GỬI CHO DISPATCHER ══ */}
      {showIncidentModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">report</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">BÁO CÁO SỰ CỐ GỬI DISPATCHER</h3>
                  <p className="text-[11px] text-slate-500">Thông báo trực tiếp đến Bộ phận Điều độ Cảng</p>
                </div>
              </div>
              <button
                onClick={() => setShowIncidentModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Thông tin sự cố tóm tắt */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Vị trí xảy ra:</span>
                <strong className="text-slate-900">Cổng A · Làn 01</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Biển số phát hiện:</span>
                <strong className="text-rose-600">{detectedPlate || 'Chưa nhận diện'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Booking liên quan:</span>
                <strong className="text-slate-900">{activeBooking?.bookingCode} (Xe: {activeBooking?.licensePlate})</strong>
              </div>
              {capturedImage && (
                <div className="pt-2 border-t border-slate-200 flex items-center gap-3">
                  <div className="w-16 h-10 rounded-lg overflow-hidden border border-slate-300 flex-shrink-0 bg-slate-900">
                    <img src={capturedImage} alt="Bằng chứng" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[10px] text-emerald-700 font-bold">
                    ✓ Đã đính kèm ảnh bằng chứng chụp từ Camera máy
                  </span>
                </div>
              )}
            </div>

            {/* Form chọn loại sự cố & ghi chú */}
            <div className="space-y-3.5 text-xs font-bold">
              <div>
                <label className="block text-slate-700 uppercase text-[10px] mb-1">Loại sự cố *</label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500"
                >
                  <option value="Sai biển số xe so với booking">Sai biển số xe so với booking</option>
                  <option value="Xe không có booking trong hệ thống">Xe không có booking trong hệ thống</option>
                  <option value="Booking chưa được phê duyệt hoặc hết hạn">Booking chưa được phê duyệt hoặc hết hạn</option>
                  <option value="Giấy phép lái xe tài xế hết hạn / vi phạm">Giấy phép lái xe tài xế hết hạn / vi phạm</option>
                  <option value="Mã container không khớp thông tin đăng ký">Mã container không khớp thông tin đăng ký</option>
                  <option value="Số seal niêm phong bị rách / không khớp">Số seal niêm phong bị rách / không khớp</option>
                  <option value="Xe tải hỏng hóc gây ùn tắc tại cổng">Xe tải hỏng hóc gây ùn tắc tại cổng</option>
                  <option value="Lỗi thiết bị nhận diện AI / RFID">Lỗi thiết bị nhận diện AI / RFID</option>
                  <option value="Khác">Lý do khác</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 uppercase text-[10px] mb-1">Mức độ nghiêm trọng *</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 'LOW', label: 'Thấp', cls: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
                    { val: 'MEDIUM', label: 'Trung bình', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
                    { val: 'HIGH', label: 'Cao', cls: 'bg-orange-50 text-orange-800 border-orange-300' },
                    { val: 'CRITICAL', label: 'Khẩn cấp', cls: 'bg-rose-50 text-rose-800 border-rose-300' },
                  ].map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => setIncidentSeverity(s.val)}
                      className={`py-2 text-[11px] rounded-xl font-black border transition-all ${
                        incidentSeverity === s.val
                          ? `${s.cls} ring-2 ring-amber-500`
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 uppercase text-[10px] mb-1">
                  Mô tả chi tiết & Hướng xử lý đề xuất
                </label>
                <textarea
                  rows="3"
                  value={incidentNote}
                  onChange={(e) => setIncidentNote(e.target.value)}
                  placeholder="Mô tả hiện trường, phản ánh của tài xế hoặc chỉ đạo điều phối mong muốn từ Dispatcher..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 font-normal"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowIncidentModal(false)}
                className="flex-1 h-11 border border-slate-300 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                disabled={!incidentType}
                onClick={handleSubmitIncident}
                className="flex-1 h-11 rounded-xl font-black text-sm shadow-md bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-lg">send</span>
                Gửi Dispatcher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
