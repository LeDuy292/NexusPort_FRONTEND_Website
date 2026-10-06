import React, { useState, useEffect, useMemo, useRef } from 'react'
import gateService from '../../services/gateService'

export default function GateVerification() {
  // Trạng thái Form đối soát (Không sử dụng mock data)
  const [licensePlate, setLicensePlate] = useState('')
  const [containerNumber, setContainerNumber] = useState('')
  const [driverName, setDriverName] = useState('')
  const [driverLicenseNumber, setDriverLicenseNumber] = useState('')
  const [operationType, setOperationType] = useState('GateIn')
  const [driverConfirmed, setDriverConfirmed] = useState(true)
  const [billingStatus, setBillingStatus] = useState('PAID')
  const [gateLane, setGateLane] = useState('GATE-A1')

  // Trạng thái AI Recognition
  const [aiScanning, setAiScanning] = useState(false)
  const [aiResult, setAiResult] = useState(null)

  // Trạng thái kết nối dịch vụ
  const [aiStatus, setAiStatus] = useState({ isOnline: false, checking: true })
  const [backendStatus, setBackendStatus] = useState({ isOnline: false, checking: true })

  // Trạng thái đối soát từ .NET Backend (Rule Engine)
  const [verifying, setVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState(null)
  const [verificationError, setVerificationError] = useState(null)

  // Trạng thái phê duyệt Gate-In
  const [approvingGateIn, setApprovingGateIn] = useState(false)
  const [gateInApprovalData, setGateInApprovalData] = useState(null)

  // UI state
  const [toastMessage, setToastMessage] = useState('')
  const [timeString, setTimeString] = useState('')
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const fileInputRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [autoScanEnabled, setAutoScanEnabled] = useState(true)
  const isScanningRef = useRef(false)
  const lastScannedPlateRef = useRef('')

  // Danh sách lịch sử giao dịch cổng lấy trực tiếp từ API backend
  const [transactions, setTransactions] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Đồng hồ thời gian thực
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeString(
        now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
          ' - ' +
          now.toLocaleDateString('vi-VN')
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Tải lịch sử giao dịch thực tế & kiểm tra kết nối khi mở trang
  useEffect(() => {
    loadLiveServicesAndHistory()
  }, [])

  const loadLiveServicesAndHistory = async () => {
    // 1. Kiểm tra AI Service
    const aiHealth = await gateService.checkAiHealth()
    setAiStatus({ isOnline: aiHealth.isOnline, checking: false })

    // 2. Lấy dữ liệu lịch sử xác thực thực tế từ Backend
    setLoadingHistory(true)
    const historyRes = await gateService.getVerificationHistory()
    if (historyRes.success) {
      setBackendStatus({ isOnline: true, checking: false })
      setTransactions(historyRes.data || [])
    } else {
      setBackendStatus({ isOnline: false, checking: false })
      setTransactions([])
    }
    setLoadingHistory(false)
  }

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4500)
  }

  // ── AI CAMERA RECOGNITION (GỬI ẢNH THẬT ĐẾN AI MICROSERVICE) ─────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAiScanning(true)
    setVerificationResult(null)
    setVerificationError(null)
    showToast(`📷 Đang gửi ảnh (${file.name}) tới AI Service (YOLOv8 + EasyOCR)...`)

    try {
      const res = await gateService.recognizeVehicleImage(file, 'GATE_IN_A', gateLane)
      if (res.success && res.data) {
        const data = res.data
        setAiResult({
          vehicleDetected: data.vehicle_detected ?? false,
          vehicleType: data.vehicle_type || 'unknown',
          vehicleConfidence: data.vehicle_confidence || 0,
          plateDetected: data.plate_detected ?? false,
          licensePlate: data.license_plate || '',
          ocrConfidence: data.ocr_confidence || 0,
          plateCropBase64: data.plate_crop_base64 || null,
          annotatedImageBase64: data.annotated_image_base64 || null,
          timestamp: new Date().toLocaleTimeString('vi-VN'),
        })

        if (data.license_plate) {
          setLicensePlate(data.license_plate)
          showToast(`✅ AI nhận diện biển số: "${data.license_plate}"`)
        } else {
          showToast('⚠️ Không phát hiện được biển số xe rõ ràng từ ảnh')
        }
      } else {
        showToast(`❌ Lỗi AI Service: ${res.error || 'Không thể nhận diện hình ảnh'}`)
      }
    } catch (err) {
      showToast(`❌ Lỗi: ${err.message}`)
    } finally {
      setAiScanning(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── WEBCAM (CAMERA MÁY) CONTROLS ─────────────────────────────────────────
  const startCamera = async () => {
    setCameraLoading(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ Webcam')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraActive(true)
      showToast('📷 Đã mở Camera máy (Webcam)!')
    } catch (err) {
      showToast('⚠️ Không thể mở Camera: ' + err.message)
    } finally {
      setCameraLoading(false)
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  // Tự động khởi động camera khi mở trang
  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
    }
  }, [])

  // Tự động quét biển số liên tục từ luồng Camera (Auto-ANPR)
  useEffect(() => {
    if (!cameraActive || !autoScanEnabled) return

    const scanTimer = setInterval(async () => {
      if (isScanningRef.current || !videoRef.current || videoRef.current.readyState < 2) return

      try {
        isScanningRef.current = true
        setAiScanning(true)

        const video = videoRef.current
        const canvas = canvasRef.current || document.createElement('canvas')
        canvas.width = video.videoWidth || 1280
        canvas.height = video.videoHeight || 720
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

        const res = await fetch(dataUrl)
        const blob = await res.blob()

        const aiRes = await gateService.recognizeVehicleImage(blob, 'GATE_IN_A', gateLane)
        if (aiRes.success && aiRes.data) {
          const data = aiRes.data
          const plate = data.license_plate ? data.license_plate.trim().toUpperCase() : ''
          if (plate && plate.length >= 4) {
            setAiResult({
              vehicleDetected: data.vehicle_detected ?? false,
              vehicleType: data.vehicle_type || 'unknown',
              vehicleConfidence: data.vehicle_confidence || 0,
              plateDetected: data.plate_detected ?? false,
              licensePlate: plate,
              ocrConfidence: data.ocr_confidence || 0,
              plateCropBase64: data.plate_crop_base64 || null,
              annotatedImageBase64: data.annotated_image_base64 || dataUrl,
              timestamp: new Date().toLocaleTimeString('vi-VN'),
            })

            if (lastScannedPlateRef.current !== plate) {
              lastScannedPlateRef.current = plate
              setLicensePlate(plate)
              showToast(`🎯 AI tự động nhận diện biển số: "${plate}"`)
            }
          }
        }
      } catch (_err) {
        // Tự động quét trong nền
      } finally {
        setAiScanning(false)
        isScanningRef.current = false
      }
    }, 1800)

    return () => clearInterval(scanTimer)
  }, [cameraActive, autoScanEnabled, gateLane])

  const handleSimulateAiScan = async () => {
    if (!licensePlate.trim()) {
      showToast('⚠️ Vui lòng nhập biển số xe để quét')
      return
    }

    setAiScanning(true)
    setVerificationResult(null)
    setVerificationError(null)
    showToast('📷 Đang gửi yêu cầu nhận diện tới AI Service...')

    try {
      const res = await gateService.simulateRecognition(licensePlate.trim(), 'container_truck')
      if (res.success && res.data) {
        const data = res.data
        setAiResult({
          vehicleDetected: data.vehicle_detected ?? true,
          vehicleType: data.vehicle_type || 'container_truck',
          vehicleConfidence: data.vehicle_confidence || 0.94,
          plateDetected: data.plate_detected ?? true,
          licensePlate: data.license_plate || licensePlate,
          ocrConfidence: data.ocr_confidence || 0.96,
          plateCropBase64: data.plate_crop_base64 || null,
          annotatedImageBase64: data.annotated_image_base64 || null,
          timestamp: new Date().toLocaleTimeString('vi-VN'),
        })
        showToast(`✅ AI Camera: Nhận diện thành công biển số "${data.license_plate || licensePlate}"!`)
      } else {
        showToast(`❌ Lỗi AI Service: ${res.error}`)
      }
    } catch (err) {
      showToast(`❌ Lỗi: ${err.message}`)
    } finally {
      setAiScanning(false)
    }
  }

  // ── BACKEND RULE ENGINE VERIFICATION (GỌI TRỰC TIẾP .NET BACKEND API) ───
  const handleRunVerification = async () => {
    if (!licensePlate.trim()) {
      showToast('⚠️ Vui lòng nhập biển số xe trước khi đối soát!')
      return
    }

    setVerifying(true)
    setVerificationResult(null)
    setVerificationError(null)
    setGateInApprovalData(null)

    const payload = {
      gateId: gateLane || 'GATE_A',
      vehiclePlate: licensePlate.trim().toUpperCase(),
      licensePlate: licensePlate.trim().toUpperCase(),
      containerNumber: containerNumber.trim().toUpperCase() || undefined,
      driverName: driverName.trim() || undefined,
      driverLicenseNumber: driverLicenseNumber.trim() || undefined,
      operationType,
      driverConfirmed: Boolean(driverConfirmed),
      billingSettled: billingStatus === 'PAID',
      billingStatus,
    }

    try {
      const res = await gateService.verifyGateScan(payload)
      if (res.success && res.data) {
        setBackendStatus({ isOnline: true, checking: false })
        setVerificationResult(res.data)

        if (res.data.status === 'PASS') {
          showToast('🟢 VERIFICATION PASS: Tất cả điều kiện tại cổng đã thỏa mãn!')
        } else {
          showToast(`🔴 VERIFICATION FAIL: ${res.data.failureReason || 'Một hoặc nhiều điều kiện không đạt!'}`)
        }
      } else {
        setBackendStatus({ isOnline: false, checking: false })
        setVerificationError(res.error || 'Không thể kết nối đến .NET Backend API')
        showToast(`❌ Lỗi Backend: ${res.error || 'Không có phản hồi từ máy chủ'}`)
      }
    } catch (err) {
      setBackendStatus({ isOnline: false, checking: false })
      setVerificationError(err.message)
      showToast(`❌ Lỗi kết nối: ${err.message}`)
    } finally {
      setVerifying(false)
    }
  }

  // ── GATE-IN APPROVAL (GỌI TRỰC TIẾP .NET BACKEND APPROVE-IN API) ──────────
  const handleApproveGateIn = async () => {
    if (!verificationResult || verificationResult.status !== 'PASS') {
      showToast('⚠️ Không thể phê duyệt Gate-In khi điều kiện đối soát chưa PASS!')
      return
    }

    setApprovingGateIn(true)
    const bookingId = verificationResult?.booking?.id

    const payload = {
      bookingId,
      containerNumber: containerNumber.trim().toUpperCase(),
      licensePlate: licensePlate.trim().toUpperCase(),
      driverId: verificationResult?.driver?.id || 'DRV-UNKNOWN',
      gateLaneId: gateLane,
      notes: 'Gate-In được phê duyệt tự động qua Smart Port Gate API',
    }

    try {
      const res = await gateService.approveGateIn(payload)
      if (res.success && res.data) {
        setGateInApprovalData(res.data)
        showToast(`🎉 GATE-IN APPROVED THÀNH CÔNG! Bản ghi ID: ${res.data.gateRecordId}`)
        // Cập nhật lại danh sách lịch sử từ Backend
        loadLiveServicesAndHistory()
      } else {
        showToast(`❌ Phê duyệt thất bại: ${res.error || 'Lỗi xử lý từ Backend'}`)
      }
    } catch (err) {
      showToast(`❌ Lỗi: ${err.message}`)
    } finally {
      setApprovingGateIn(false)
    }
  }

  // ── OVERRIDE THỦ CÔNG (UC86) ─────────────────────────────────────────────
  const handleOverrideSubmit = (e) => {
    e.preventDefault()
    setShowOverrideModal(false)
    showToast(
      `⚠️ Cấp quyền Override cho xe ${licensePlate}. Lý do: "${overrideReason || 'Ngoại lệ điều hành'}"`
    )
    setOverrideReason('')
    setVerificationResult((prev) =>
      prev
        ? {
            ...prev,
            status: 'PASS',
            failureReason: null,
            isSuccess: true,
          }
        : {
            status: 'PASS',
            isSuccess: true,
            failureReason: null,
            ruleResults: [],
          }
    )
  }

  // Phân tích trạng thái 7 bước từ kết quả đối soát thực tế của Backend
  const pipelineSteps = useMemo(() => {
    const rules = verificationResult?.ruleResults || []
    const findRule = (name) => rules.find((r) => r.ruleName === name)

    const bookingRule = findRule('BookingExistenceRule')
    const timeRule = findRule('BookingTimeWindowRule')
    const vehicleRule = findRule('VehicleMatchRule')
    const containerRule = findRule('ContainerMatchRule')
    const driverRule = findRule('DriverEligibilityRule')
    const operationRule = findRule('OperationMatchRule')
    const driverConfirmRule = findRule('DriverConfirmationRule')
    const billingRule = findRule('BillingAndPaymentStatusRule')

    return [
      {
        id: 1,
        title: 'Recognition',
        subtitle: 'YOLOv8 + License Plate + EasyOCR',
        isPassed: Boolean(aiResult?.plateDetected && aiResult?.licensePlate),
        detail: aiResult
          ? `Biển số nhận diện: "${aiResult.licensePlate}" (Độ tin cậy: ${(aiResult.ocrConfidence * 100).toFixed(1)}%)`
          : 'Chưa có ảnh/tín hiệu nhận diện từ Camera',
      },
      {
        id: 2,
        title: 'Check Booking',
        subtitle: 'Tìm Booking & Kiểm tra Time Slot',
        isPassed: Boolean(bookingRule?.isPassed && (timeRule ? timeRule.isPassed : true)),
        detail:
          bookingRule?.message ||
          (verificationResult ? 'Không tìm thấy thông tin Booking' : 'Chờ đối soát...'),
      },
      {
        id: 3,
        title: 'Check Vehicle',
        subtitle: 'Hồ sơ xe trùng khớp đăng kiểm',
        isPassed: Boolean(vehicleRule?.isPassed),
        detail: vehicleRule?.message || 'Chờ đối soát thông tin phương tiện...',
      },
      {
        id: 4,
        title: 'Check Container',
        subtitle: 'Khớp danh sách khai báo trong Booking',
        isPassed: Boolean(containerRule?.isPassed),
        detail: containerRule?.message || 'Chờ đối soát container...',
      },
      {
        id: 5,
        title: 'Check Operation',
        subtitle: 'Loại hình tác nghiệp (GateIn/GateOut)',
        isPassed: Boolean(operationRule ? operationRule.isPassed : true),
        detail: operationRule?.message || `Quy trình tác nghiệp: ${operationType}`,
      },
      {
        id: 6,
        title: 'Check Driver Confirmation',
        subtitle: 'Tài xế xác nhận trên Mobile Driver App',
        isPassed: Boolean(driverConfirmRule?.isPassed),
        detail:
          driverConfirmRule?.message ||
          (driverConfirmed ? 'Tài xế đã xác nhận' : 'Tài xế chưa xác nhận trên App'),
      },
      {
        id: 7,
        title: 'Check Billing',
        subtitle: 'Kiểm tra hóa đơn dịch vụ cảng E-Port',
        isPassed: Boolean(billingRule?.isPassed),
        detail: billingRule?.message || `Trạng thái thanh toán: ${billingStatus}`,
      },
    ]
  }, [verificationResult, aiResult, operationType, driverConfirmed, billingStatus])

  const isAllPassed = verificationResult?.status === 'PASS'

  return (
    <div className="p-4 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen text-slate-900 relative">
      {/* Toast thông báo */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-slate-900 text-white border border-slate-700 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-3 z-[100] animate-bounce">
          <span className="text-emerald-400">●</span>
          {toastMessage}
        </div>
      )}

      {/* ── HEADER & SERVICE STATUS BAR ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black bg-blue-100 text-blue-900 border border-blue-300 px-3 py-0.5 rounded-full uppercase">
              SMART GATE AUTOMATION PIPELINE
            </span>
            <span className="text-xs font-mono font-bold text-slate-500">
              NexusPort Gate System · Cảng Container Tiên Sa
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Vehicle & Container Gate Verification
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Luồng trực tiếp kết nối .NET Backend & AI Camera Service (Không dùng Mock Data).
          </p>
        </div>

        {/* Trạng thái kết nối dịch vụ & Đồng hồ */}
        <div className="flex flex-wrap items-center gap-3">
          {/* AI Microservice status */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold font-mono ${
              aiStatus.isOnline
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-rose-50 text-rose-900 border-rose-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${aiStatus.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}
            ></span>
            <span>AI Service (Port 8000): {aiStatus.isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          {/* .NET Backend status */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold font-mono ${
              backendStatus.isOnline
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-rose-50 text-rose-900 border-rose-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                backendStatus.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            ></span>
            <span>.NET Backend (Port 5000): {backendStatus.isOnline ? 'CONNECTED' : 'DISCONNECTED'}</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold text-slate-700">
            <span>{timeString}</span>
          </div>
        </div>
      </div>

      {/* ── 2 CỘT CHÍNH: CỘT TRÁI (AI CAMERA & FORM) - CỘT PHẢI (FLOW PIPELINE & GATE DECISION) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CỘT TRÁI (5 cols): AI CAMERA RECOGNITION & INPUT FORM */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Card AI Camera */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <span className="text-xs font-black text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">photo_camera</span>
                AI CAMERA & RECOGNITION PIPELINE
              </span>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 rounded-full text-[10px] font-black">
                YOLOv8 + EasyOCR
              </span>
            </div>

            {/* Live Camera View Box */}
            <div className="relative rounded-xl overflow-hidden bg-slate-900 border-2 border-slate-800 aspect-video flex flex-col items-center justify-center text-white shadow-inner">
              <canvas ref={canvasRef} className="hidden" />

              {/* Webcam stream khi bật camera máy */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              />

              {!cameraActive && aiResult?.annotatedImageBase64 ? (
                <img
                  src={aiResult.annotatedImageBase64}
                  alt="AI Detection Output"
                  className="w-full h-full object-contain"
                />
              ) : !cameraActive ? (
                <div className="text-center p-4 space-y-2">
                  <span className="material-symbols-outlined text-4xl text-slate-500">
                    videocam
                  </span>
                  <div className="text-xs font-mono font-bold text-slate-300">
                    AI GATE CAMERA STREAM · {gateLane}
                  </div>
                  <div className="text-[11px] text-amber-400 font-mono font-bold">
                    ⚠️ BẮT BUỘC SỬ DỤNG CAMERA MÁY (WEBCAM) ĐỂ AI QUÉT BIỂN SỐ TRỰC TIẾP
                  </div>
                </div>
              ) : null}

              {/* Overlay HUD Scan Effect */}
              {aiScanning && (
                <div className="absolute inset-0 bg-blue-950/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-20">
                  <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-xs font-mono font-black text-emerald-300 tracking-wider">
                    SCANNING YOLO VEHICLE & LICENSE PLATE...
                  </div>
                </div>
              )}

              {/* Bounding box result badge overlay */}
              {!aiScanning && aiResult && (
                <div className="absolute bottom-2 left-2 right-2 bg-black/75 backdrop-blur-xs px-3 py-2 rounded-lg text-[11px] font-mono flex justify-between items-center border border-white/20 z-10">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-emerald-300 font-bold">Plate:</span>
                    <span className="font-black text-white text-xs">{aiResult.licensePlate || 'N/A'}</span>
                  </div>
                  <div className="text-slate-300 text-[10px]">
                    OCR: {(aiResult.ocrConfidence * 100).toFixed(1)}% · YOLO: {(aiResult.vehicleConfidence * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>

            {/* AI Action Controls */}
            <div className="flex flex-col sm:flex-row gap-2">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={cameraLoading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">videocam</span>
                  {cameraLoading ? 'Đang mở...' : 'Bật Camera máy (Webcam)'}
                </button>
              ) : (
                <>
                  <div className="flex-1 px-4 py-2.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                    </span>
                    <span className="material-symbols-outlined text-sm">radar</span>
                    <span>TỰ ĐỘNG QUÉT BIỂN SỐ (AUTO-ANPR)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoScanEnabled(!autoScanEnabled)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      autoScanEnabled
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >
                    {autoScanEnabled ? 'Đang bật' : 'Tạm dừng'}
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">videocam_off</span>
                    Tắt
                  </button>
                </>
              )}

              {/* Đã bỏ nút tải ảnh — Bắt buộc sử dụng camera máy */}
            </div>
          </div>

          {/* Card Form Thông Tin Đối Soát */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">fact_check</span>
                THÔNG TIN THỰC TẾ TẠI CỔNG
              </span>
              <span className="text-[10px] font-mono text-slate-500">Dữ liệu thực gửi tới API</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Biển số xe (License Plate) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 51C-123.45"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-black text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-blue-600 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Mã Container (Container ID)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: MSCU1234567"
                    value={containerNumber}
                    onChange={(e) => setContainerNumber(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-black text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-blue-600 uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tên tài xế (Driver Name)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Nguyễn Văn A"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Số GPLX (Driver License)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: FC-123456"
                    value={driverLicenseNumber}
                    onChange={(e) => setDriverLicenseNumber(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-blue-600 uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Làn xe</label>
                  <select
                    value={gateLane}
                    onChange={(e) => setGateLane(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 text-xs"
                  >
                    <option value="GATE-A1">Gate A1 (In)</option>
                    <option value="GATE-A2">Gate A2 (In)</option>
                    <option value="GATE-B1">Gate B1 (Out)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Tác nghiệp</label>
                  <select
                    value={operationType}
                    onChange={(e) => setOperationType(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 text-xs"
                  >
                    <option value="GateIn">Gate In</option>
                    <option value="GateOut">Gate Out</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Hóa đơn</label>
                  <select
                    value={billingStatus}
                    onChange={(e) => setBillingStatus(e.target.value)}
                    className={`w-full px-2 py-2 border rounded-xl font-bold text-xs ${
                      billingStatus === 'PAID'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-black'
                        : 'bg-rose-50 border-rose-300 text-rose-950 font-black'
                    }`}
                  >
                    <option value="PAID">PAID (Đã TT)</option>
                    <option value="UNPAID">UNPAID (Chưa TT)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="driverConfirmedCheck"
                  checked={driverConfirmed}
                  onChange={(e) => setDriverConfirmed(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                />
                <label
                  htmlFor="driverConfirmedCheck"
                  className="text-xs font-bold text-slate-800 cursor-pointer select-none"
                >
                  Tài xế đã xác nhận trên Mobile Driver App (Driver Confirmation)
                </label>
              </div>

              {/* Nút kích hoạt đối soát */}
              <button
                type="button"
                onClick={handleRunVerification}
                disabled={verifying}
                className="w-full mt-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
              >
                <span className="material-symbols-outlined text-base">rule</span>
                {verifying ? 'ĐANG GỬI TỚI BACKEND RULE ENGINE...' : '🔍 GỬI ĐỐI SOÁT (POST /api/v1/gate/verify)'}
              </button>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI (7 cols): FLOW PIPELINE THEO YÊU CẦU & KẾT QUẢ PASS/FAIL */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Card Pipeline đối soát 7 bước */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-heading text-base font-black text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">account_tree</span>
                  GATE VERIFICATION PIPELINE FLOW
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Quy trình 7 bước đối soát tự động từ AI Camera đến .NET Backend Rule Engine
                </p>
              </div>

              {/* Overall Status Badge */}
              {verificationResult && (
                <div
                  className={`px-4 py-1.5 rounded-xl font-black text-sm border-2 flex items-center gap-2 shadow-xs ${
                    isAllPassed
                      ? 'bg-emerald-100 text-emerald-950 border-emerald-500'
                      : 'bg-rose-100 text-rose-950 border-rose-500'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    {isAllPassed ? 'check_circle' : 'cancel'}
                  </span>
                  <span>KẾT QUẢ: {verificationResult.status}</span>
                </div>
              )}
            </div>

            {/* Thông báo lỗi nếu không kết nối được Backend */}
            {verificationError && (
              <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-xl text-xs text-rose-950 space-y-1">
                <div className="font-black flex items-center gap-2 text-rose-900">
                  <span className="material-symbols-outlined text-base text-rose-600">error</span>
                  <span>LỖI KẾT NỐI BACKEND:</span>
                </div>
                <div className="font-mono text-rose-800">{verificationError}</div>
                <div className="text-[11px] text-slate-600 mt-1">
                  Vui lòng đảm bảo .NET Backend đang chạy tại <code className="bg-slate-200 px-1 py-0.5 rounded">http://localhost:5000</code>.
                </div>
              </div>
            )}

            {/* Danh sách 7 bước đối soát */}
            <div className="space-y-2.5">
              {pipelineSteps.map((step) => (
                <div
                  key={step.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                    step.isPassed
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Step Number Circle */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                        step.isPassed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-400 text-white'
                      }`}
                    >
                      {step.id}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs font-mono uppercase text-slate-900">
                          {step.title}
                        </span>
                        <span className="text-[10px] text-slate-500 hidden sm:inline">
                          ({step.subtitle})
                        </span>
                      </div>
                      <div
                        className={`text-[11px] truncate mt-0.5 ${
                          step.isPassed ? 'text-emerald-800' : 'text-slate-600 font-medium'
                        }`}
                      >
                        {step.detail}
                      </div>
                    </div>
                  </div>

                  {/* Status Tag */}
                  <div className="shrink-0 flex items-center gap-1 font-mono text-xs font-black">
                    {step.isPassed ? (
                      <span className="px-2 py-0.5 bg-emerald-200/80 text-emerald-900 rounded-md">
                        ✓ PASS
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                        ⋯ PENDING
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Cảnh báo chi tiết lý do FAIL nếu có */}
            {verificationResult && !isAllPassed && (
              <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-xl text-xs text-rose-950 space-y-2">
                <div className="flex items-center gap-2 font-black text-rose-900">
                  <span className="material-symbols-outlined text-lg text-rose-600">error</span>
                  <span>LÝ DO TỪ CHỐI (FAILURE REASON):</span>
                </div>
                <div className="font-mono bg-white/80 p-2.5 rounded-lg border border-rose-200 font-bold text-rose-900">
                  {verificationResult.failureReason || 'Một trong các điều kiện kiểm tra không thỏa mãn.'}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => setShowOverrideModal(true)}
                    className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-400 rounded-lg font-bold text-xs cursor-pointer"
                  >
                    ⚠️ Cấp Quyền Override Ngoại Lệ (UC86)
                  </button>
                </div>
              </div>
            )}

            {/* Khối Phê Duyệt Gate-In khi PASS */}
            {isAllPassed && (
              <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-2xl">
                      verified
                    </span>
                    <div>
                      <div className="font-black text-emerald-950 text-sm">
                        ĐỦ ĐIỀU KIỆN PHÊ DUYỆT QUA CỔNG
                      </div>
                      <div className="text-xs text-emerald-800">
                        Hồ sơ xe, container, tài xế và hóa đơn đã được Backend xác thực thành công.
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleApproveGateIn}
                    disabled={approvingGateIn}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm shadow-md flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <span className="material-symbols-outlined text-base">login</span>
                    {approvingGateIn ? 'ĐANG PHÊ DUYỆT...' : '✓ PHÊ DUYỆT GATE-IN (APPROVE)'}
                  </button>
                </div>

                {/* Kết quả cập nhật thực tế sau khi Gate-In */}
                {gateInApprovalData && (
                  <div className="p-3 bg-white border border-emerald-300 rounded-xl text-xs space-y-2 font-mono">
                    <div className="flex items-center gap-2 text-emerald-900 font-black">
                      <span className="material-symbols-outlined text-base text-emerald-600">
                        task_alt
                      </span>
                      <span>KẾT QUẢ CẬP NHẬT TRẠNG THÁI ENTITY TỪ BACKEND:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-800">
                      <div className="bg-slate-50 p-2 rounded-lg border">
                        <span className="text-[10px] text-slate-500 block">Booking Status</span>
                        <span className="font-black text-blue-800 text-xs">
                          {gateInApprovalData.bookingStatus?.toUpperCase() || 'CHECKED-IN'}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border">
                        <span className="text-[10px] text-slate-500 block">Container Status</span>
                        <span className="font-black text-emerald-800 text-xs">
                          {gateInApprovalData.containerStatus?.toUpperCase() || 'IN-YARD'}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border">
                        <span className="text-[10px] text-slate-500 block">Vehicle Status</span>
                        <span className="font-black text-purple-800 text-xs">
                          {gateInApprovalData.vehicleStatus?.toUpperCase() || 'INSIDE'}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-600 flex items-center gap-1.5 pt-1">
                      <span className="material-symbols-outlined text-sm text-blue-600">
                        notifications_active
                      </span>
                      <span>
                        Mã bản ghi Gate Record:{' '}
                        <b>{gateInApprovalData.gateRecordId}</b>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BẢNG NHẬT KÝ GIAO DỊCH CỔNG THỰC TẾ (GATE TRANSACTIONS FROM BACKEND) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">history</span>
              NHẬT KÝ XÁC THỰC CỔNG THỰC TẾ (GATE VERIFICATION RECORDS FROM BACKEND)
            </h3>
            <p className="text-xs text-slate-500">
              Dữ liệu được truy vấn trực tiếp từ API <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">GET /api/v1/gate/verifications</code>
            </p>
          </div>
          <button
            onClick={loadLiveServicesAndHistory}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Làm mới
          </button>
        </div>

        <div className="overflow-x-auto">
          {loadingHistory ? (
            <div className="text-center py-8 text-xs font-mono text-slate-500">
              Đang tải dữ liệu từ Backend...
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-xs font-mono text-slate-400">
              Chưa có bản ghi xác thực cổng nào trong cơ sở dữ liệu.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Thời Gian</th>
                  <th className="py-3 px-4">Biển Số Xe</th>
                  <th className="py-3 px-4">Tài Xế</th>
                  <th className="py-3 px-4">Mã Container</th>
                  <th className="py-3 px-4">Booking ID</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4">Lý Do (Nếu có)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-600">
                      {tx.checkedAtUtc ? new Date(tx.checkedAtUtc).toLocaleTimeString('vi-VN') : tx.time || '—'}
                    </td>
                    <td className="py-3 px-4 font-black text-slate-900">{tx.licensePlate || tx.vehicle}</td>
                    <td className="py-3 px-4 font-sans font-bold text-slate-800">{tx.driverName || tx.driver || '—'}</td>
                    <td className="py-3 px-4 font-bold text-blue-900">{tx.containerNumber || tx.container || '—'}</td>
                    <td className="py-3 px-4 font-bold text-purple-900">{tx.bookingId || '—'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          tx.status === 'PASS' || tx.status?.includes('Approved') || tx.status?.includes('Inside')
                            ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                            : 'bg-rose-100 text-rose-950 border border-rose-300'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-500 text-[11px] truncate max-w-xs">
                      {tx.failureReason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── MODAL OVERRIDE THỦ CÔNG (UC86) ── */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[200]">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-2 text-amber-600 font-black text-base">
              <span className="material-symbols-outlined">warning</span>
              <h4>CẤP QUYỀN OVERRIDE NGOẠI LỆ (UC86)</h4>
            </div>
            <p className="text-xs text-slate-600">
              Bạn đang kích hoạt quyền Gate Officer Override cho phương tiện <b>{licensePlate}</b>.
            </p>
            <form onSubmit={handleOverrideSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lý do phê duyệt ngoại lệ:
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Nhập lý do chi tiết..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs cursor-pointer"
                >
                  Xác nhận Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
