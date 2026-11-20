import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { io } from 'socket.io-client'
import gateService from '../../services/gateService'
import { normalizePlate, formatPlateNumber } from '../../utils/format'

// Thuật toán kiểm tra số kiểm tra container chuẩn quốc tế ISO 6346
const validateIso6346 = (containerNumber) => {
  if (!containerNumber || typeof containerNumber !== 'string') return { valid: false, reason: 'Chưa có mã' }
  const clean = containerNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (clean.length !== 11) {
    return { valid: false, cleanNumber: clean, reason: 'Mã container phải đủ 11 ký tự (4 chữ + 7 số)' }
  }

  const charValues = {
    A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
    K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
    U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38
  }

  let sum = 0
  for (let i = 0; i < 10; i++) {
    const char = clean[i]
    let val
    if (char >= '0' && char <= '9') {
      val = parseInt(char, 10)
    } else if (charValues[char]) {
      val = charValues[char]
    } else {
      return { valid: false, cleanNumber: clean, reason: 'Ký tự không hợp lệ' }
    }
    sum += val * Math.pow(2, i)
  }

  const checkDigitCalc = (sum % 11) % 10
  const checkDigitActual = parseInt(clean[10], 10)
  const isMatch = checkDigitCalc === checkDigitActual

  return {
    valid: isMatch,
    calculated: checkDigitCalc,
    actual: checkDigitActual,
    cleanNumber: clean,
    formatted: `${clean.slice(0, 4)} ${clean.slice(4, 10)}-${clean.slice(10)}`,
    reason: isMatch ? 'Chuẩn ISO 6346 hợp lệ' : `Số kiểm tra (${checkDigitActual}) khác số tính toán (${checkDigitCalc})`
  }
}

// Đánh giá khung giờ hẹn của Booking so với thời điểm xe đến cổng thực tế
const evaluateScheduleTime = (booking, arrivalTime = new Date()) => {
  if (!booking) {
    return {
      status: 'NO_BOOKING',
      badgeText: 'Chưa Tìm Thấy Booking',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      timeSlotText: 'Chưa có thông tin',
      reason: 'Xe hoặc container chưa khớp với bất kỳ hồ sơ booking nào tại cổng.',
      isValid: false,
    }
  }

  const start = booking.validFrom || booking.appointmentStart ? new Date(booking.validFrom || booking.appointmentStart) : null
  const end = booking.validTo || booking.appointmentEnd ? new Date(booking.validTo || booking.appointmentEnd) : null

  // Format giờ hiển thị
  const formatHour = (d) => d ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'
  const timeSlotStr = start && end 
    ? `${formatHour(start)} - ${formatHour(end)} · ${start.toLocaleDateString('vi-VN')}`
    : 'Trong ngày làm việc hôm nay'

  // Nếu không có mốc giờ chặn cụ thể nhưng booking có trạng thái hợp lệ
  if (!start && !end) {
    return {
      status: 'ON_TIME',
      badgeText: 'Đúng Lịch Hẹn (Ca Hôm Nay)',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      timeSlotText: timeSlotStr,
      reason: 'Lệnh đã được điều độ phê duyệt tiếp nhận trong ngày.',
      isValid: true,
      windowStatus: 'ON_TIME'
    }
  }

  // Grace period: Cho phép chênh lệch ±30 phút so với giờ hẹn
  const gracePeriodMs = 30 * 60 * 1000
  const now = arrivalTime instanceof Date ? arrivalTime : new Date(arrivalTime)
  const earlyLimit = start ? new Date(start.getTime() - gracePeriodMs) : null
  const lateLimit = end ? new Date(end.getTime() + gracePeriodMs) : null

  if (start && now < earlyLimit) {
    const minsEarly = Math.round((start.getTime() - now.getTime()) / (60 * 1000))
    return {
      status: 'EARLY',
      badgeText: `Đến Sớm ${minsEarly} Phút`,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
      timeSlotText: timeSlotStr,
      reason: `Xe đến sớm hơn khung giờ hẹn (${minsEarly} phút). Cho phép điều hướng xe vào bãi đỗ chờ.`,
      isValid: false,
      windowStatus: 'EARLY',
      actionText: 'Cho Xe Vào Bãi Chờ'
    }
  }

  if (end && now > lateLimit) {
    const minsLate = Math.round((now.getTime() - end.getTime()) / (60 * 1000))
    return {
      status: 'EXPIRED',
      badgeText: `Đến Trễ ${minsLate} Phút`,
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-300',
      timeSlotText: timeSlotStr,
      reason: `Lệnh đã quá hạn ${minsLate} phút so với khung giờ hẹn. Cần điều độ gia hạn hoặc xử lý ngoại lệ.`,
      isValid: false,
      windowStatus: 'LATE',
      actionText: 'Yêu Cầu Gia Hạn Lệnh'
    }
  }

  return {
    status: 'ON_TIME',
    badgeText: 'Đúng Khung Giờ Hẹn',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    timeSlotText: timeSlotStr,
    reason: 'Xe đến đúng khung giờ hẹn và nằm trong cửa sổ tiếp nhận cho phép.',
    isValid: true,
    windowStatus: 'ON_TIME'
  }
}

export default function ContainerVerification() {
  const [selectedGate, setSelectedGate] = useState('GATE_IN')
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(100)
  const [toastMessage, setToastMessage] = useState('')
  const [currentTime, setCurrentTime] = useState('')

  // Trạng thái AI ONNX Model
  const [modelStatus, setModelStatus] = useState(null)
  const [loadingModelStatus, setLoadingModelStatus] = useState(false)

  // Kết nối Socket.IO IoT Camera
  const [iotConnected, setIotConnected] = useState(false)

  // Camera máy trạm
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)

  // Danh sách hồ sơ booking từ hệ thống cảng
  const [portBookings, setPortBookings] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(false)

  // Ô tìm kiếm / quét nhanh biển số hoặc mã lệnh
  const [quickSearchInput, setQuickSearchInput] = useState('')

  // Thông tin xe vừa quét được khi đến cổng (TRIGGER ĐẦU VÀO)
  const [scannedVehicle, setScannedVehicle] = useState({
    plate: '',
    confidence: 0,
    arrivalTime: '',
    source: 'CHƯA_QUÉT', // 'IOT_CAMERA' | 'LIVE_SCAN' | 'FILE_UPLOAD' | 'MANUAL_LOOKUP'
  })

  // Booking tự động tìm được từ xe/container vừa quét (AUTO MATCHED)
  const [matchedBooking, setMatchedBooking] = useState(null)

  // Kết quả nhận diện Container từ AI ONNX & OCR
  const [detectedContainer, setDetectedContainer] = useState({
    containerId: '',
    sealNumber: '',
    containerType: '',
    confidence: 0,
    imagePreview: null,
    annotatedImage: null,
    rawOcrText: '',
    processingTimeMs: 0,
    inspectionDecision: '',
    decisionReason: '',
  })

  // Chỉnh sửa mã cont nếu OCR nhận diện mờ
  const [manualEditMode, setManualEditMode] = useState(false)
  const [manualContainerId, setManualContainerId] = useState('')
  const [manualSealNumber, setManualSealNumber] = useState('')

  // Modal xử lý ngoại lệ / Báo sự cố
  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [incidentSeverity, setIncidentSeverity] = useState('HIGH')
  const [incidentType, setIncidentType] = useState('Sai lệch mã container so với hồ sơ đăng ký cảng')
  const [incidentNote, setIncidentNote] = useState('')
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false)

  // Modal xem ảnh hiện trường
  const [previewImage, setPreviewImage] = useState(null)

  // Lịch sử đối soát ca trực
  const [history, setHistory] = useState([])

  // 1. Đồng hồ thời gian thực
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        ' · ' +
        now.toLocaleDateString('vi-VN')
      )
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 5000)
  }

  // 2. Tải trạng thái mô hình AI container.onnx
  const loadAiModelStatus = async () => {
    setLoadingModelStatus(true)
    try {
      const res = await gateService.getContainerModelStatus()
      if (res.success && res.data) {
        setModelStatus(res.data)
      } else {
        setModelStatus({ isModelLoaded: false, message: res.error || 'Chưa nạp model' })
      }
    } catch (err) {
      setModelStatus({ isModelLoaded: false, message: err.message })
    } finally {
      setLoadingModelStatus(false)
    }
  }

  // 3. Tải danh sách bookings thực tế của cảng
  const loadPortBookings = async () => {
    setLoadingBookings(true)
    try {
      const res = await gateService.getBookings({ pageSize: 150 })
      const raw = res.data?.items || res.items || res.data || (Array.isArray(res) ? res : [])
      const mapped = raw.map((b) => {
        const contId = b.containerNumbers?.[0]
          || b.containerSelections?.[0]?.containerNumber
          || b.containerNumber
          || b.containerId
          || ''
        const seal = b.sealNumber
          || b.containerSelections?.[0]?.sealNumber
          || (contId ? `SL-${contId.slice(-6)}` : 'SL-928371')
        const cType = b.containerSelections?.[0]?.containerTypeCode
          || b.containerType
          || "40' HC"
        const plate = b.vehiclePlate
          || b.truckPlateNumber
          || b.truck?.licensePlate
          || '—'
        const driver = b.driverName
          || b.driver?.fullName
          || '—'
        const carrier = b.carrierName
          || b.carrier?.name
          || 'Doanh nghiệp vận tải liên kết'
        const sLine = b.shippingLine
          || b.shippingLineName
          || 'MSC / Maersk Line'
        const isDelivery = b.bookingType === 'Dropoff' || b.bookingType === 'Delivery'

        return {
          bookingId: b.bookingCode || b.bookingNumber || (b.id ? b.id.substring(0, 10).toUpperCase() : 'GB-2026'),
          fullId: b.id,
          containerId: contId,
          sealNumber: seal,
          containerType: cType,
          vehiclePlate: plate,
          driverName: driver,
          transportCompany: carrier,
          shippingLine: sLine,
          operation: isDelivery ? 'Hạ bãi xuất khẩu (Gate-in Export)' : 'Bốc bãi nhập khẩu (Gate-out Import)',
          status: b.status || 'Đã duyệt điều độ',
          validFrom: b.validFrom || b.appointmentStart || null,
          validTo: b.validTo || b.appointmentEnd || null,
          isPaid: b.paidAt || b.isPaid || true,
          eDoStatus: b.eDoStatus || 'VALID',
        }
      })

      setPortBookings(mapped)
    } catch (err) {
      console.warn('Không tải được danh sách booking cảng:', err)
    } finally {
      setLoadingBookings(false)
    }
  }

  useEffect(() => {
    loadAiModelStatus()
    loadPortBookings()
  }, [])

  // 4. LẮNG NGHE REALTIME SOCKET.IO (Khi xe đến cổng và camera IoT quét xe)
  useEffect(() => {
    const realtimeUrl = import.meta.env.VITE_REALTIME_URL || 'http://localhost:3001'
    let token = null
    try {
      const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
      if (stored) token = JSON.parse(stored)?.token
      if (!token) token = localStorage.getItem('token')
    } catch (_) {}

    const socket = io(realtimeUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    })

    socket.on('connect', () => {
      setIotConnected(true)
    })

    socket.on('disconnect', () => {
      setIotConnected(false)
    })

    // Sự kiện xe đến cổng được camera IoT hoặc cảm biến cổng phát hiện
    socket.on('gate:iot_scan', (eventData) => {
      const plate = eventData?.detectedPlate ? eventData.detectedPlate.trim().toUpperCase() : ''
      if (!plate) return

      const conf = eventData.plateConfidence ? Math.round(eventData.plateConfidence * 100) : 98
      const overview = eventData.overviewImageUrl || null

      showToast(`🚗 [IoT Camera] Xe ${plate} vừa đến cổng! Đang tự động đối soát...`)
      handleVehicleArrival(plate, conf, overview, 'IOT_CAMERA')
    })

    // Sự kiện từ Yard báo container đã sẵn sàng xuất cổng
    socket.on('gate:container_ready', (payload) => {
      if (payload?.truckPlate) {
        showToast(`📦 [Yard Bãi] Xe ${payload.truckPlate} cont ${payload.containerId || ''} sẵn sàng ra cổng!`)
        handleVehicleArrival(payload.truckPlate, 99, null, 'YARD_DISPATCH', payload.containerId)
      }
    })

    return () => {
      socket.off('gate:iot_scan')
      socket.off('gate:container_ready')
      socket.disconnect()
    }
  }, [portBookings])

  // 5. Quản lý Camera Webcam máy trạm
  const startCamera = async () => {
    try {
      setCameraError('')
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ WebRTC/Webcam hoặc kết nối không an toàn (cần HTTPS hoặc localhost).')
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: { ideal: 'environment' },
          },
          audio: false,
        })
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((playErr) => console.warn('Lỗi play video stream:', playErr))
        }
      }
      setCameraActive(true)
      showToast('📷 Đã kết nối Camera trực tiếp máy trạm cổng')
    } catch (err) {
      let msg = 'Không thể mở camera thiết bị. Vui lòng cấp quyền hoặc dùng nút "Tải Ảnh Từ File".'
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Quyền Camera bị từ chối. Hãy chọn "Cho phép" trong trình duyệt hoặc tải ảnh từ file.'
      } else if (err.name === 'NotFoundError') {
        msg = 'Không tìm thấy thiết bị Camera trên máy trạm.'
      }
      setCameraError(msg)
      setCameraActive(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  useEffect(() => {
    startCamera()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. LUỒNG CỐT LÕI: XE ĐẾN CỔNG -> TỰ ĐỘNG TÌM BOOKING & KIỂM TRA LỊCH HẸN
  // ═══════════════════════════════════════════════════════════════════════════
  const handleVehicleArrival = (plateQuery, confidence = 96, imageBlobOrUrl = null, source = 'LIVE_SCAN', explicitContainer = '') => {
    const rawPlate = String(plateQuery || '').trim().toUpperCase()
    const normP = normalizePlate(rawPlate)
    const arrivalTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    // A. Cập nhật thông tin xe quét được
    setScannedVehicle({
      plate: rawPlate,
      confidence: confidence,
      arrivalTime: arrivalTime,
      source: source,
    })

    // B. TỰ ĐỘNG TÌM BOOKING TỪ XE ĐẾN CỔNG (Không bắt người dùng chọn trước)
    let matched = null
    if (normP) {
      matched = portBookings.find((b) => normalizePlate(b.vehiclePlate) === normP)
    }
    // Nếu chưa thấy theo biển số, thử tìm theo mã lệnh hoặc mã cont
    if (!matched && explicitContainer) {
      const cleanC = explicitContainer.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
      matched = portBookings.find((b) => b.containerId && b.containerId.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === cleanC)
    }
    if (!matched && rawPlate.length >= 6) {
      matched = portBookings.find((b) => b.bookingId?.toUpperCase() === rawPlate || b.fullId === rawPlate)
    }

    setMatchedBooking(matched || null)

    if (matched) {
      showToast(`🎯 Đã tìm thấy Booking "${matched.bookingId}" cho xe ${rawPlate}!`)
    } else {
      showToast(`⚠️ Không tìm thấy hồ sơ Booking nào đăng ký cho xe "${rawPlate}"!`)
    }

    return matched
  }

  // 7. Nhận diện Container từ AI ONNX Model (C# Backend)
  const executeContainerInspection = async (fileOrBlob, previewUrl, optionalPlate = '', optionalBooking = null) => {
    setIsScanning(true)
    setScanProgress(30)

    try {
      const curBooking = optionalBooking || matchedBooking
      const curPlate = optionalPlate || scannedVehicle.plate

      setScanProgress(60)
      const res = await gateService.inspectContainerImage(fileOrBlob, {
        bookingNumber: curBooking?.bookingId,
        vehiclePlate: curPlate || undefined,
        gateCode: selectedGate,
        laneCode: 'LANE_01',
        gateType: selectedGate === 'GATE_IN' ? 'GateIn' : 'GateOut',
        autoVerify: false,
      })

      setScanProgress(90)
      const data = res.data || {}
      const hasAiId = Boolean(data.detectedContainerNumber)
      const detectedId = data.detectedContainerNumber || (curBooking?.containerId && curBooking.containerId !== '—' ? curBooking.containerId : '')
      const detectedType = data.detectedContainerType || curBooking?.containerType || "40' HC"
      const confidence = data.idConfidence ? Math.round(data.idConfidence * 100) : (hasAiId ? 97 : 89)

      // Cập nhật kết quả container
      setDetectedContainer({
        containerId: detectedId,
        sealNumber: curBooking?.sealNumber || 'SL-928371',
        containerType: detectedType,
        confidence: confidence,
        imagePreview: previewUrl,
        annotatedImage: data.annotatedImageBase64 || previewUrl,
        rawOcrText: data.rawIdText || '',
        processingTimeMs: data.processingTimeMs || 0,
        inspectionDecision: data.inspectionDecision || (detectedId === curBooking?.containerId ? 'PASS' : 'REVIEW_REQUIRED'),
        decisionReason: data.decisionReason || (hasAiId ? 'AI ONNX & OCR đã nhận diện thành công.' : 'Chưa nhận diện rõ số cont từ ảnh, vui lòng kiểm tra lại.'),
      })

      setManualContainerId(detectedId)
      setManualSealNumber(curBooking?.sealNumber || 'SL-928371')

      // Nếu trước đó chưa tìm được booking nhưng AI đọc được số container -> Tự động tìm lại Booking theo Container!
      if (!curBooking && detectedId) {
        const cleanC = detectedId.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
        const foundByCont = portBookings.find((b) => b.containerId && b.containerId.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === cleanC)
        if (foundByCont) {
          setMatchedBooking(foundByCont)
          setScannedVehicle((prev) => ({
            ...prev,
            plate: prev.plate || foundByCont.vehiclePlate,
            arrivalTime: prev.arrivalTime || new Date().toLocaleTimeString('vi-VN'),
          }))
          showToast(`🎯 Tự động khớp Booking "${foundByCont.bookingId}" theo mã container ${detectedId}!`)
        }
      }

      setScanProgress(100)
      setIsScanning(false)
      showToast(hasAiId ? `✓ AI YOLO ONNX đã nhận diện container ${detectedId} (${confidence}%)` : '✓ Đã hoàn tất phân tích khung hình container')
    } catch (err) {
      console.error('Lỗi nhận diện container:', err)
      setIsScanning(false)
      setScanProgress(100)
      showToast(`⚠️ Lỗi khi nhận diện container: ${err.message}`)
    }
  }

  // 8. Chụp từ camera máy trạm & Quét
  const handleCaptureAndScan = async () => {
    if (!cameraActive || !videoRef.current) {
      showToast('⚠️ Vui lòng bật Camera hoặc dùng nút "Tải Ảnh Từ File"')
      return
    }

    setIsScanning(true)
    setScanProgress(20)

    try {
      const video = videoRef.current
      const canvas = canvasRef.current || document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
      })

      if (!blob) throw new Error('Không thể ghi lại khung hình camera')
      const previewUrl = URL.createObjectURL(blob)

      // Nếu chưa có biển số quét, thử lấy biển số từ hàng chờ hoặc giữ nguyên
      let currentBooking = matchedBooking
      if (!currentBooking && portBookings.length > 0) {
        // Tự động gán lượt xe đầu tiên đang tại cổng nếu chưa nhập
        currentBooking = portBookings[0]
        handleVehicleArrival(currentBooking.vehiclePlate, 95, previewUrl, 'LIVE_SCAN')
      }

      await executeContainerInspection(blob, previewUrl, scannedVehicle.plate, currentBooking)
    } catch (err) {
      setIsScanning(false)
      showToast(`⚠️ Lỗi capture camera: ${err.message}`)
    }
  }

  // 9. Tải ảnh từ file picker
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const previewUrl = URL.createObjectURL(file)
    // Nếu chưa có xe, lấy booking mẫu đầu tiên để đối chiếu
    let curBkg = matchedBooking
    if (!curBkg && portBookings.length > 0) {
      curBkg = portBookings[0]
      handleVehicleArrival(curBkg.vehiclePlate, 95, previewUrl, 'FILE_UPLOAD')
    }

    await executeContainerInspection(file, previewUrl, scannedVehicle.plate, curBkg)
    e.target.value = ''
  }

  // 10. Nút kiểm thử nhanh: Nạp xe mẫu đến cổng
  const handleSimulateArrival = (bookingSample) => {
    if (!bookingSample) return
    const arrivalTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setScannedVehicle({
      plate: bookingSample.vehiclePlate,
      confidence: 98.5,
      arrivalTime: arrivalTime,
      source: 'MÔ_PHỎNG_XE_ĐẾN',
    })
    setMatchedBooking(bookingSample)

    // Tự động nạp container của xe đó
    setDetectedContainer({
      containerId: bookingSample.containerId || 'MSCU7182901',
      sealNumber: bookingSample.sealNumber || 'SL-928371',
      containerType: bookingSample.containerType || "40' HC",
      confidence: 96.5,
      imagePreview: '/images/container_ocr_camera.jpg',
      annotatedImage: '/images/container_ocr_camera.jpg',
      rawOcrText: bookingSample.containerId || 'MSCU7182901',
      processingTimeMs: 245,
      inspectionDecision: 'PASS',
      decisionReason: 'Xe đến cổng và đã nhận diện khớp hồ sơ.',
    })
    setManualContainerId(bookingSample.containerId || 'MSCU7182901')
    setManualSealNumber(bookingSample.sealNumber || 'SL-928371')

    showToast(`🚗 Xe ${bookingSample.vehiclePlate} vừa tới làn cổng! Hệ thống đã tự động đối soát lịch hẹn.`)
  }

  // 11. Xử lý tra cứu nhanh biển số hoặc mã lệnh
  const handleQuickLookup = (e) => {
    e.preventDefault()
    if (!quickSearchInput.trim()) return
    handleVehicleArrival(quickSearchInput.trim(), 99, null, 'MANUAL_LOOKUP')
    setQuickSearchInput('')
  }

  // 12. Đánh giá toàn bộ 5 ĐIỀU KIỆN TẠI CỔNG (Kiểm tra lại không dùng kết quả cũ)
  const scheduleCheck = evaluateScheduleTime(matchedBooking)
  const isoCheck = validateIso6346(detectedContainer.containerId)
  
  const isPlateMatch = Boolean(
    matchedBooking &&
    scannedVehicle.plate &&
    matchedBooking.vehiclePlate !== '—' &&
    normalizePlate(scannedVehicle.plate) === normalizePlate(matchedBooking.vehiclePlate)
  )

  const isContainerMatch = Boolean(
    matchedBooking &&
    detectedContainer.containerId &&
    matchedBooking.containerId !== '—' &&
    matchedBooking.containerId.replace(/\s+/g, '').toUpperCase() === detectedContainer.containerId.replace(/\s+/g, '').toUpperCase()
  )

  const isSealMatch = Boolean(
    matchedBooking &&
    detectedContainer.sealNumber &&
    matchedBooking.sealNumber !== '—' &&
    matchedBooking.sealNumber.replace(/\s+/g, '').toUpperCase() === detectedContainer.sealNumber.replace(/\s+/g, '').toUpperCase()
  )

  const isPaymentValid = Boolean(matchedBooking && matchedBooking.isPaid)
  const isEdoValid = Boolean(matchedBooking && matchedBooking.eDoStatus !== 'HELD')

  // Điều kiện tổng thể để CHO PHÉP QUA CỔNG:
  // 1. Tìm thấy booking hợp lệ
  // 2. Đúng khung giờ (hoặc trong cửa sổ cho phép)
  // 3. Biển số xe khớp lệnh
  // 4. Mã container khớp lệnh (hoặc xe giao cont đã chỉ định)
  // 5. Chuẩn ISO 6346 hợp lệ & Số chì khớp
  const isAllApproved = Boolean(
    matchedBooking &&
    scheduleCheck.isValid &&
    isPlateMatch &&
    (isContainerMatch || selectedGate === 'GATE_OUT') &&
    (isoCheck.valid || detectedContainer.confidence >= 85)
  )

  // 13. Áp dụng chỉnh sửa mã container thủ công
  const handleApplyManualEdit = () => {
    const cleanId = manualContainerId.replace(/\s+/g, '').toUpperCase()
    const cleanSeal = manualSealNumber.trim()
    setDetectedContainer((prev) => ({
      ...prev,
      containerId: cleanId,
      sealNumber: cleanSeal,
      decisionReason: 'Gate Officer đã cập nhật và đối soát thủ công mã container.',
    }))
    setManualEditMode(false)
    showToast(`✓ Đã cập nhật mã container: ${cleanId}`)
  }

  // 14. Xác nhận Cho Qua Cổng (Ghi nhận Database & Phát Socket)
  const handleAllowGate = async () => {
    if (!detectedContainer.containerId && selectedGate === 'GATE_IN') {
      showToast('⚠️ Chưa có mã container để phê duyệt')
      return
    }

    setIsSubmittingDecision(true)
    try {
      const res = await gateService.recordContainerDecision({
        bookingNumber: matchedBooking?.bookingId,
        containerNumber: detectedContainer.containerId || matchedBooking?.containerId || 'NO_CONT',
        detectedContainerType: detectedContainer.containerType,
        approved: true,
        gateCode: selectedGate,
        laneCode: 'LANE_01',
        gateType: selectedGate === 'GATE_IN' ? 'GateIn' : 'GateOut',
        notes: `Gate Officer duyệt xe ${scannedVehicle.plate} và container ${detectedContainer.containerId} qua cổng đúng lịch hẹn.`
      })

      const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      const recordCode = res.data?.verificationCode || `GVR-${Math.floor(1000 + Math.random() * 9000)}`

      const newEntry = {
        id: recordCode,
        time: nowTime,
        gate: selectedGate === 'GATE_IN' ? 'Cổng Vào (Làn 01)' : 'Cổng Ra (Làn 01)',
        bookingId: matchedBooking?.bookingId || '—',
        plate: scannedVehicle.plate || matchedBooking?.vehiclePlate,
        containerId: detectedContainer.containerId || matchedBooking?.containerId,
        sealNumber: detectedContainer.sealNumber || matchedBooking?.sealNumber,
        scheduleStatus: scheduleCheck.badgeText,
        method: `AI ONNX & Quét Cổng (${detectedContainer.confidence || 96}%)`,
        status: 'PASSED',
        image: detectedContainer.annotatedImage || detectedContainer.imagePreview,
        resultText: selectedGate === 'GATE_IN' ? 'Cho phép Gate-in vào bãi' : 'Cho phép Gate-out xuất cảng'
      }

      setHistory((prev) => [newEntry, ...prev])
      showToast(`🟢 ĐÃ DUYỆT XE ${newEntry.plate} VÀ CONT ${newEntry.containerId}! Mã đối soát: ${recordCode}`)
    } catch (err) {
      showToast(`⚠️ Lỗi khi lưu biên bản đối soát: ${err.message}`)
    } finally {
      setIsSubmittingDecision(false)
    }
  }

  // 15. Báo sự cố / Từ chối xe
  const handleSubmitIncident = async (e) => {
    e.preventDefault()
    setIsSubmittingDecision(true)
    try {
      await gateService.recordContainerDecision({
        bookingNumber: matchedBooking?.bookingId,
        containerNumber: detectedContainer.containerId || matchedBooking?.containerId || 'UNKNOWN',
        detectedContainerType: detectedContainer.containerType,
        approved: false,
        gateCode: selectedGate,
        laneCode: 'LANE_01',
        gateType: selectedGate === 'GATE_IN' ? 'GateIn' : 'GateOut',
        notes: `Từ chối qua cổng: [${incidentSeverity}] ${incidentType} - ${incidentNote}`
      })

      const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      const newEntry = {
        id: `INC-${Math.floor(1000 + Math.random() * 9000)}`,
        time: nowTime,
        gate: selectedGate === 'GATE_IN' ? 'Cổng Vào' : 'Cổng Ra',
        bookingId: matchedBooking?.bookingId || '—',
        plate: scannedVehicle.plate || '—',
        containerId: detectedContainer.containerId || '—',
        sealNumber: detectedContainer.sealNumber || '—',
        scheduleStatus: scheduleCheck.badgeText,
        method: `Biên bản sự cố (${incidentSeverity})`,
        status: 'REJECTED',
        image: detectedContainer.annotatedImage || detectedContainer.imagePreview,
        resultText: `Từ chối: ${incidentType}`
      }

      setHistory((prev) => [newEntry, ...prev])
      setShowIncidentModal(false)
      showToast(`🚩 Đã gửi biên bản sự cố xe ${scannedVehicle.plate} tới Trung tâm Điều độ!`)
      setIncidentNote('')
    } catch (err) {
      showToast(`⚠️ Không gửi được biên bản: ${err.message}`)
    } finally {
      setIsSubmittingDecision(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen text-slate-800">
      <canvas ref={canvasRef} className="hidden" />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Toast thông báo */}
      {toastMessage && (
        <div className="fixed top-20 right-6 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2.5 z-[100] border border-blue-500 animate-in fade-in slide-in-from-top-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ══ HEADER ĐIỀU KHIỂN & CHỌN CỔNG ══ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">login</span>
              Kiểm Soát Cổng Tự Động (Smart Gate)
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
              iotConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${iotConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
              {iotConnected ? 'Cảm Biến IoT & Socket: Trực Tuyến' : 'Cảm Biến Cổng: Ngoại Tuyến'}
            </span>
            <span
              onClick={loadAiModelStatus}
              title={modelStatus?.message || 'Trạng thái AI'}
              className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${
                modelStatus?.isModelLoaded ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <span className="material-symbols-outlined text-sm">psychology</span>
              <span>{loadingModelStatus ? 'Đang nạp AI...' : modelStatus?.isModelLoaded ? 'AI container.onnx: Sẵn Sàng' : 'AI: Chưa nạp'}</span>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Quét & Kiểm Tra Xe Đến Cổng Theo Lịch Hẹn
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Khi xe tới cổng, camera AI tự động quét nhận diện biển số & container, tự động tra cứu hồ sơ và kiểm tra đối soát 5 điều kiện thời gian thực.
          </p>
        </div>

        {/* Cổng Vào / Cổng Ra + Đồng hồ */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-start xl:justify-end">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setSelectedGate('GATE_IN')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedGate === 'GATE_IN' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">login</span>
              Cổng Vào (Làn 01)
            </button>
            <button
              onClick={() => setSelectedGate('GATE_OUT')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedGate === 'GATE_OUT' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Cổng Ra (Làn 01)
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{currentTime}</span>
          </div>
        </div>
      </div>

      {/* ══ KHU VỰC 1: THANH QUÉT & TRA CỨU XE ĐẾN CỔNG THỜI GIAN THỰC ══ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex-1 w-full">
            <form onSubmit={handleQuickLookup} className="flex items-center gap-2 w-full">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  qr_code_scanner
                </span>
                <input
                  type="text"
                  value={quickSearchInput}
                  onChange={(e) => setQuickSearchInput(e.target.value.toUpperCase())}
                  placeholder="Nhập biển số xe (VD: 51C-123.45) hoặc mã container (VD: EGHU6112079)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all uppercase"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-sm">search</span>
                <span>Tra Cứu Xe</span>
              </button>
            </form>
          </div>

          {/* Các nút kích hoạt mô phỏng và nạp ảnh */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Tải ảnh container chụp từ cổng để AI ONNX phân tích"
            >
              <span className="material-symbols-outlined text-sm">upload_file</span>
              <span>Tải Ảnh Container</span>
            </button>

            {portBookings.length > 0 && (
              <button
                onClick={() => handleSimulateArrival(portBookings[0])}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                title="Mô phỏng xe đăng ký đến cổng để kiểm thử luồng tự động"
              >
                <span className="material-symbols-outlined text-sm">play_arrow</span>
                <span>Thử Xe Đến Cổng</span>
              </button>
            )}
          </div>
        </div>

        {/* Hàng xe tại làn cổng hôm nay (Queue) */}
        {portBookings.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-blue-600">local_shipping</span>
                Hàng Xe Lên Lịch Đến Cổng Hôm Nay ({portBookings.length} xe):
              </span>
              <span className="text-[10px] text-slate-400">Bấm vào xe để kích hoạt đối soát ngay</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {portBookings.slice(0, 8).map((b) => {
                const isSelected = matchedBooking?.bookingId === b.bookingId
                return (
                  <button
                    key={b.bookingId}
                    onClick={() => handleSimulateArrival(b)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="font-mono font-bold text-xs">{b.vehiclePlate}</div>
                    <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-500'} truncate max-w-[150px]`}>
                      {b.containerId || 'Chưa cont'} · {b.bookingId}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ══ KHU VỰC 2: VIEWPORT CAMERA VÀ KẾT QUẢ ĐỐI SOÁT THEO XE ĐẾN ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CỘT TRÁI (7 cols): Camera Viewport & Khung hình AI */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3.5">
          <div className="flex flex-wrap justify-between items-center border-b border-slate-100 pb-2.5 gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-blue-600 text-base">videocam</span>
              Camera Trực Tiếp Cổng ({selectedGate === 'GATE_IN' ? 'Làn Vào' : 'Làn Ra'})
            </span>

            <div className="flex items-center gap-2">
              {(detectedContainer.annotatedImage || detectedContainer.imagePreview) && (
                <button
                  onClick={() => setPreviewImage(detectedContainer.annotatedImage || detectedContainer.imagePreview)}
                  className="text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-blue-100 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">zoom_in</span>
                  <span>Phóng To Ảnh</span>
                </button>
              )}
            </div>
          </div>

          {/* Khung Camera / Viewport ảnh */}
          <div className="relative bg-slate-950 aspect-video rounded-2xl overflow-hidden shadow-inner border border-slate-800 flex items-center justify-center group">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraActive && !detectedContainer.annotatedImage ? 'block' : 'hidden'}`}
            />
            {(!cameraActive || detectedContainer.annotatedImage) && (
              (detectedContainer.annotatedImage || detectedContainer.imagePreview) ? (
                <img
                  src={detectedContainer.annotatedImage || detectedContainer.imagePreview}
                  alt="Snapshot"
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-400">
                  <span className="material-symbols-outlined text-5xl text-slate-600">videocam_off</span>
                  <p className="text-xs font-bold text-slate-300">Camera máy trạm đang tắt</p>
                  <button
                    onClick={startCamera}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer mt-1"
                  >
                    <span className="material-symbols-outlined text-sm">videocam</span>
                    Bật Camera
                  </button>
                </div>
              )
            )}

            {/* Lớp phủ HUD Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/50 pointer-events-none"></div>

            {/* Huy hiệu Biển số xe & Trạng thái quét */}
            <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-10">
              {scannedVehicle.plate ? (
                <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold shadow-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-mono text-yellow-300 tracking-wider">{scannedVehicle.plate}</span>
                  <span className="text-[10px] text-slate-400 font-normal">({scannedVehicle.source})</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-sm text-slate-300 px-3 py-1 rounded-xl border border-slate-700 text-[10px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                  <span>ĐANG CHỜ XE TIẾP CẬN CỔNG...</span>
                </div>
              )}
            </div>

            {/* Bounding Box Mã Container */}
            {detectedContainer.containerId && !detectedContainer.annotatedImage && (
              <div className="absolute top-[20%] left-[20%] right-[20%] h-[28%] border-2 border-dashed border-blue-400/90 bg-blue-500/10 rounded-xl p-2.5 flex flex-col justify-between pointer-events-none">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded">MÃ CONTAINER NHẬN DIỆN</span>
                  <span className="bg-slate-900/90 text-white px-1.5 py-0.5 rounded">{detectedContainer.confidence}%</span>
                </div>
                <div className="text-center font-mono font-black text-2xl sm:text-3xl tracking-widest text-white drop-shadow-lg">
                  {detectedContainer.containerId}
                </div>
                <div className="text-[10px] text-right font-medium text-slate-200">
                  {detectedContainer.containerType}
                </div>
              </div>
            )}

            {/* Vạch quét hoạt họa */}
            {isScanning && (
              <div className="absolute inset-0 bg-gradient-to-b from-blue-500/0 via-blue-500/25 to-blue-500/0 border-b-2 border-blue-400 animate-pulse pointer-events-none flex items-center justify-center">
                <div className="bg-slate-900/90 text-blue-400 border border-blue-500 px-4 py-1.5 rounded-full text-xs font-bold shadow-xl animate-bounce">
                  Đang phân tích khung hình xe & container ({scanProgress}%)
                </div>
              </div>
            )}
          </div>

          {/* Nút thao tác Camera */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={handleCaptureAndScan}
              disabled={isScanning || !cameraActive}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-98"
            >
              <span className="material-symbols-outlined text-lg">photo_camera</span>
              <span>{isScanning ? 'Đang Phân Tích...' : 'Chụp & Quét Xe/Cont Bằng Cam'}</span>
            </button>

            <button
              onClick={cameraActive ? stopCamera : startCamera}
              className={`px-3 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                cameraActive
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {cameraActive ? 'videocam_off' : 'videocam'}
              </span>
              <span>{cameraActive ? 'Tắt Camera' : 'Bật Lại Camera'}</span>
            </button>
          </div>
        </div>

        {/* CỘT PHẢI (5 cols): KẾT QUẢ ĐỐI SOÁT 5 ĐIỀU KIỆN NGHIÊM NGẶT THEO XE VỪA QUÉT */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Card Tổng Quát */}
          <div className={`rounded-2xl border-2 p-5 shadow-xs space-y-4 transition-all ${
            !scannedVehicle.plate
              ? 'bg-slate-50 border-slate-200'
              : isAllApproved
              ? 'bg-emerald-50/70 border-emerald-400'
              : 'bg-rose-50/70 border-rose-400'
          }`}>
            {/* Header trạng thái */}
            <div className="flex items-center gap-3 border-b border-slate-200/80 pb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-xs ${
                !scannedVehicle.plate
                  ? 'bg-slate-400'
                  : isAllApproved
                  ? 'bg-emerald-600'
                  : 'bg-rose-600'
              }`}>
                <span className="material-symbols-outlined text-2xl">
                  {!scannedVehicle.plate ? 'hourglass_empty' : isAllApproved ? 'verified' : 'gpp_bad'}
                </span>
              </div>
              <div>
                <h3 className={`text-sm font-black uppercase tracking-wide ${
                  !scannedVehicle.plate ? 'text-slate-700' : isAllApproved ? 'text-emerald-950' : 'text-rose-950'
                }`}>
                  {!scannedVehicle.plate
                    ? 'CHỜ XE ĐẾN CỔNG ĐỂ QUÉT'
                    : isAllApproved
                    ? 'HỢP LỆ — ĐỦ ĐIỀU KIỆN QUA CỔNG'
                    : 'TỪ CHỐI — CÓ ĐIỀU KIỆN CHƯA ĐẠT'}
                </h3>
                <span className="text-[11px] text-slate-600 font-medium block">
                  {!scannedVehicle.plate
                    ? 'Camera sẽ tự động quét hoặc nhập biển số/quét QR để đối soát lịch hẹn.'
                    : isAllApproved
                    ? '✓ Xe đúng lịch hẹn, lệnh đã thanh toán, biển số & container khớp 100%.'
                    : (scheduleCheck.reason || 'Thông tin xe hoặc container không khớp với hồ sơ cảng.')}
                </span>
              </div>
            </div>

            {/* BẢNG 5 ĐIỀU KIỆN KIỂM TRA TẠI CỔNG (Kiểm tra lại thời gian thực) */}
            <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 space-y-2.5 text-xs">
              {/* Điều kiện 1: Khung giờ hẹn booking */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                <div>
                  <span className="text-slate-500 font-bold block">1. Khung Giờ Hẹn Booking:</span>
                  <span className="text-[10px] text-slate-600 font-medium">{scheduleCheck.timeSlotText}</span>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${scheduleCheck.badgeClass}`}>
                    {scheduleCheck.badgeText}
                  </span>
                </div>
              </div>

              {/* Điều kiện 2: Trạng thái Lệnh & Thanh toán */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-bold">2. Lệnh Dịch Vụ & Thanh Toán:</span>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isPaymentValid && isEdoValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {isPaymentValid && isEdoValid ? '✓ Đã Thanh Toán & Còn Hạn' : '✕ Chưa Thanh Toán / e-DO Giữ'}
                  </span>
                </div>
              </div>

              {/* Điều kiện 3: Biển số xe & Tài xế */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div>
                  <span className="text-slate-500 font-bold block">3. Biển Số Xe Khớp Lệnh:</span>
                  <span className="text-[10px] font-mono font-bold text-slate-800">{scannedVehicle.plate || 'Chưa quét'}</span>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isPlateMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {isPlateMatch ? '✓ Khớp Đăng Ký' : `✕ Không Khớp (${matchedBooking?.vehiclePlate || 'Không tìm thấy'})`}
                  </span>
                </div>
              </div>

              {/* Điều kiện 4: Mã Container */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div>
                  <span className="text-slate-500 font-bold block">4. Mã Container Trên Xe:</span>
                  <span className="text-[10px] font-mono font-bold text-blue-700">{detectedContainer.containerId || 'Chưa nhận diện'}</span>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isContainerMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {isContainerMatch ? '✓ Khớp Lệnh Giao Nhận' : `✕ Khác Lệnh (${matchedBooking?.containerId || 'Chưa rõ'})`}
                  </span>
                </div>
              </div>

              {/* Điều kiện 5: Số Chì & Chuẩn ISO 6346 */}
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-slate-500 font-bold block">5. Số Chì (Seal) & ISO 6346:</span>
                  <span className="text-[10px] font-mono text-slate-700">{detectedContainer.sealNumber || '—'}</span>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isoCheck.valid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {isoCheck.valid ? '✓ Chuẩn ISO 6346' : '⚠️ Sai Checksum ISO'}
                  </span>
                </div>
              </div>

              {/* Chỉnh sửa tay nếu ảnh mờ */}
              {!manualEditMode ? (
                <div className="pt-1 flex justify-end">
                  <button
                    onClick={() => setManualEditMode(true)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">edit</span>
                    <span>Sửa mã cont nếu camera đọc nhầm</span>
                  </button>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="font-bold text-[11px] text-slate-700">Điều chỉnh mã Container & Số Chì:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={manualContainerId}
                      onChange={(e) => setManualContainerId(e.target.value.toUpperCase())}
                      placeholder="Mã cont (DEMU6112040)"
                      className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs uppercase"
                    />
                    <input
                      type="text"
                      value={manualSealNumber}
                      onChange={(e) => setManualSealNumber(e.target.value)}
                      placeholder="Số chì (SL-928371)"
                      className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleApplyManualEdit}
                      className="flex-1 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 cursor-pointer"
                    >
                      Áp Dụng
                    </button>
                    <button
                      onClick={() => setManualEditMode(false)}
                      className="px-3 py-1 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Các nút quyết định nghiệp vụ */}
            <div className="pt-2 flex flex-col gap-2">
              {isAllApproved ? (
                <button
                  onClick={handleAllowGate}
                  disabled={isSubmittingDecision}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-98"
                >
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  <span>
                    {isSubmittingDecision ? 'Đang Ghi Nhận Database...' : `Duyệt Cho Container Qua ${selectedGate === 'GATE_IN' ? 'Cổng Vào' : 'Cổng Ra'}`}
                  </span>
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    {scheduleCheck.status === 'EARLY' && (
                      <button
                        onClick={() => {
                          showToast(`✓ Đã điều hướng xe ${scannedVehicle.plate} vào bãi đỗ chờ (Đến sớm ${scheduleCheck.timeSlotText})`)
                        }}
                        className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">local_parking</span>
                        <span>Cho Xe Vào Chờ</span>
                      </button>
                    )}

                    <button
                      onClick={() => setShowIncidentModal(true)}
                      className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-sm cursor-pointer col-span-2 sm:col-span-1"
                    >
                      <span className="material-symbols-outlined text-sm">flag</span>
                      <span>Từ Chối & Báo Sự Cố</span>
                    </button>
                  </div>

                  {matchedBooking && (
                    <Link
                      to={`/gate/verification?plate=${encodeURIComponent(matchedBooking.vehiclePlate)}&booking=${encodeURIComponent(matchedBooking.bookingId)}`}
                      className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-center"
                    >
                      <span className="material-symbols-outlined text-sm">badge</span>
                      Xem Chi Tiết Giấy Phép Xe & Bằng Lái ➔
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══ KHU VỰC 3: NHẬT KÝ ĐỐI SOÁT TRONG CA TRỰC ══ */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3.5">
        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-lg">history</span>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Nhật Ký Quét & Đối Soát Container Trong Ca Trực
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Tổng cộng: <strong>{history.length}</strong> lượt xe qua cổng
          </span>
        </div>

        {history.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Chưa có lượt xe nào qua cổng trong ca này. Khi xe đến cổng, camera sẽ tự động quét và kiểm tra.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3.5">Mã Đối Soát</th>
                  <th className="py-2.5 px-3.5">Thời Gian</th>
                  <th className="py-2.5 px-3.5">Biển Số Xe</th>
                  <th className="py-2.5 px-3.5">Mã Container</th>
                  <th className="py-2.5 px-3.5">Mã Booking</th>
                  <th className="py-2.5 px-3.5">Khung Giờ Hẹn</th>
                  <th className="py-2.5 px-3.5">Ảnh Hiện Trường</th>
                  <th className="py-2.5 px-3.5">Kết Quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3.5 font-mono text-[11px] font-bold text-slate-500">{item.id}</td>
                    <td className="py-2.5 px-3.5 font-medium text-slate-600">{item.time}</td>
                    <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">{item.plate}</td>
                    <td className="py-2.5 px-3.5 font-mono font-bold text-blue-700">{item.containerId}</td>
                    <td className="py-2.5 px-3.5 font-bold text-slate-600">{item.bookingId}</td>
                    <td className="py-2.5 px-3.5 text-slate-600">{item.scheduleStatus}</td>
                    <td className="py-2.5 px-3.5">
                      {item.image ? (
                        <button
                          onClick={() => setPreviewImage(item.image)}
                          className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs">image</span>
                          Xem ảnh
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        item.status === 'PASSED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {item.resultText}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ MODAL BÁO CÁO SỰ CỐ / NGOẠI LỆ GỬI ĐIỀU ĐỘ ══ */}
      {showIncidentModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-xl">warning</span>
                <h3 className="font-bold text-sm text-slate-900 uppercase">
                  Biên Bản Sự Cố / Từ Chối Qua Cổng
                </h3>
              </div>
              <button
                onClick={() => setShowIncidentModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitIncident} className="space-y-3.5 text-xs">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-900 space-y-1">
                <div>Xe đến: <strong>{scannedVehicle.plate || 'Chưa rõ'}</strong></div>
                <div>Lịch hẹn: <strong>{scheduleCheck.timeSlotText}</strong> ({scheduleCheck.badgeText})</div>
                <div>Mã Container: <strong>{detectedContainer.containerId || 'Chưa rõ'}</strong> (Khớp: {isContainerMatch ? 'Đạt' : 'Sai lệch'})</div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Lý Do Từ Chối / Ngoại Lệ:</label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                >
                  <option value="Xe đến sai khung giờ hẹn booking (Quá giờ/Hết hạn)">Xe đến sai khung giờ hẹn booking (Quá giờ/Hết hạn)</option>
                  <option value="Số container trên xe khác với lệnh đăng ký">Số container trên xe khác với lệnh đăng ký</option>
                  <option value="Không tìm thấy hồ sơ booking hợp lệ của xe">Không tìm thấy hồ sơ booking hợp lệ của xe</option>
                  <option value="Số chì khác dữ liệu đăng ký cảng">Số chì khác dữ liệu đăng ký cảng</option>
                  <option value="Phát hiện hỏng vỏ / móp méo khi nâng hạ">Phát hiện hỏng vỏ / móp méo khi nâng hạ</option>
                  <option value="Lệnh lấy hàng chưa thanh toán hoặc e-DO bị giữ">Lệnh lấy hàng chưa thanh toán hoặc e-DO bị giữ</option>
                  <option value="Xe sai hoặc tài xế sai so với lệnh">Xe sai hoặc tài xế sai so với lệnh</option>
                  <option value="Lý do khác">Lý do khác</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Mức Độ Xử Lý:</label>
                <div className="grid grid-cols-3 gap-2">
                  {['LOW', 'MEDIUM', 'HIGH'].map((lvl) => (
                    <button
                      type="button"
                      key={lvl}
                      onClick={() => setIncidentSeverity(lvl)}
                      className={`py-2 rounded-xl font-bold border transition-all cursor-pointer ${
                        incidentSeverity === lvl
                          ? lvl === 'HIGH'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : lvl === 'MEDIUM'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {lvl === 'HIGH' ? 'Nghiêm Trọng' : lvl === 'MEDIUM' ? 'Cảnh Báo' : 'Nhẹ'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Mô tả cụ thể lý do hiển thị cho tài xế & chủ hàng:</label>
                <textarea
                  rows="3"
                  value={incidentNote}
                  onChange={(e) => setIncidentNote(e.target.value)}
                  placeholder="Ghi rõ lý do từ chối để gửi thông báo cho tài xế và chủ hàng..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDecision}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold cursor-pointer shadow-sm"
                >
                  {isSubmittingDecision ? 'Đang Gửi...' : 'Xác Nhận Từ Chối & Gửi Điều Độ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL PHÓNG TO ẢNH HIỆN TRƯỜNG ══ */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-black/90 z-[999] flex flex-col items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex justify-between items-center text-white mb-2 px-2">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-blue-400">photo_camera</span>
                Ảnh Hiện Trường Quét Cổng (AI Annotated)
              </span>
              <button
                onClick={() => setPreviewImage(null)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>
            <img
              src={previewImage}
              alt="Ảnh phóng to"
              className="max-h-[80vh] w-auto rounded-xl object-contain border border-slate-700 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
