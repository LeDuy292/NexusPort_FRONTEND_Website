import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../../services/apiClient'
import gateService from '../../services/gateService'
import { driverSmartRouteService } from '../../services/driverSmartRouteService'

export default function GateControl() {
  const [currentTime, setCurrentTime] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [mode, setMode] = useState('checkin') // 'checkin' | 'checkout'
  const [gateLocations, setGateLocations] = useState([])
  const [selectedGateId, setSelectedGateId] = useState('')
  const [gateError, setGateError] = useState('')
  const [verificationBusy, setVerificationBusy] = useState(false)
  const [gateOutBusy, setGateOutBusy] = useState(false)
  const availableGates = gateLocations.filter(gate => gate.isActive !== false && gate.gateType === (mode === 'checkin' ? 'gate_in' : 'gate_out'))
  const selectedGate = availableGates.find(gate => gate.id === selectedGateId)
  
  // Trạng thái Camera máy (Webcam)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [capturedImage, setCapturedImage] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [previewImageModal, setPreviewImageModal] = useState(null)

  // Trạng thái Nhận dạng (ANPR) & Thao tác thủ công
  const [detectedPlate, setDetectedPlate] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [isAiScanning, setIsAiScanning] = useState(false)
  const isScanningRef = useRef(false)
  const scanActionRef = useRef(null)
  const lastScannedPlateRef = useRef('')
  const [aiCropImage, setAiCropImage] = useState(null)

  // Trạng thái Barie & Xử lý Cổng
  // 'idle' | 'passed' | 'rejected' | 'checked-in' | 'incident-reported'
  const [processingStatus, setProcessingStatus] = useState('idle')
  const [barrierState, setBarrierState] = useState('closed') // 'closed' | 'opening' | 'opened'
  const [rejectionReason, setRejectionReason] = useState('')

  // Modals
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
    let active = true
    driverSmartRouteService.gateLocations().then(items => {
      if (active) { setGateLocations(Array.isArray(items) ? items : []); setGateError('') }
    }).catch(error => { if (active) setGateError(error.message || 'Không thể tải danh sách cổng.') })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const matching = gateLocations.filter(gate => gate.isActive !== false && gate.gateType === (mode === 'checkin' ? 'gate_in' : 'gate_out'))
    setSelectedGateId(current => matching.some(gate => gate.id === current) ? current : matching[0]?.id || '')
    setActiveBooking(null); setProcessingStatus('idle'); setBarrierState('closed')
    lastScannedPlateRef.current = ''
  }, [mode, gateLocations])

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

  // Dọn dẹp camera khi rời màn hình kiểm soát cổng
  useEffect(() => {
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

  const evaluateVerification = async (plate, currentConfidence = 98, overviewImg = null, plateImg = null) => {
    if (!plate || !plate.trim()) return
    if (!selectedGate || gateError) { showToast('Vui lòng chọn cổng thực tế đang hoạt động trước khi xác minh.'); return }
    if (verificationBusy || gateOutBusy) return
    setVerificationBusy(true)

    const trimmedPlate = plate.trim().toUpperCase()
    setDetectedPlate(trimmedPlate)
    setConfidence(currentConfidence)

    const finalOverviewImg = overviewImg || capturedImage || null
    const finalPlateImg = plateImg || aiCropImage || null

    if (finalOverviewImg && !capturedImage) setCapturedImage(finalOverviewImg)
    if (finalPlateImg && !aiCropImage) setAiCropImage(finalPlateImg)

    showToast(`🔍 Đang gửi biển số "${trimmedPlate}" đến Rule Engine backend để đối soát...`)

    try {
      // Gọi trực tiếp API đối soát qua 7 điều kiện Rule Engine của Backend C# (kèm hình ảnh lưu trữ)
      const verifyRes = await gateService.verifyGateScan({
        gateCode: selectedGate.code,
        laneCode: 'LANE_01',
        detectedVehiclePlate: trimmedPlate,
        vehicleDetected: true,
        plateConfidence: (currentConfidence || 98) / 100,
        verificationType: mode === 'checkin' ? 'AI_GATE_IN' : 'AI_GATE_OUT',
        overviewImageUrl: finalOverviewImg,
        vehiclePlateImageUrl: finalPlateImg,
      })

      if (verifyRes.success && verifyRes.data) {
        const result = verifyRes.data
        const isPass = result.status === 'PASS' || result.isSuccess === true

        if (isPass) {
          // ✅ KIỂM TRA ĐÚNG: Nạp thông tin thật từ Backend và TỰ ĐỘNG MỞ CỔNG
          const bkg = result.booking
          const drv = result.driver
          const matchedFull = cachedBookings.find(
            (b) => b.bookingCode === bkg?.bookingNumber || b.bookingNumber === bkg?.bookingNumber || b.id === bkg?.bookingId
          )
          const matchedVehicle = cachedVehicles.find((v) => normalizePlate(v.plateNumber) === normalizePlate(plate))

          const bookingData = {
            id: bkg?.bookingId || matchedFull?.id,
            bookingCode: bkg?.bookingNumber || matchedFull?.bookingCode || '—',
            company: drv?.carrierName || bkg?.carrierName || matchedFull?.carrierName || 'Chưa cập nhật',
            vehicleId: matchedVehicle?.id ? `TRK-${matchedVehicle.id.slice(0, 4).toUpperCase()}` : `TRK-${normalizePlate(plate).slice(0, 4)}`,
            licensePlate: plate,
            status: 'Checked-in',
            licenseNumber: drv?.licenseNumber || bkg?.driverLicenseNumber || matchedFull?.licenseNumber || 'Chưa cập nhật',
            licenseStatus: 'Valid', // The backend Rule Engine returned PASS.
            driverId: drv?.driverId || 'Chưa cập nhật',
            driverName: drv?.fullName || bkg?.driverName || matchedFull?.driverName || 'Chưa cập nhật',
            driverPhone: drv?.phone || bkg?.driverPhone || matchedFull?.driverPhone || 'Chưa cập nhật',
            driverIdCard: drv?.idCardNumber || 'Chưa cập nhật',
            containerId: bkg?.containerNumber || matchedFull?.containers?.[0]?.containerNumber || matchedFull?.containers?.[0]?.containerNo,
            containerType: matchedFull?.containers?.[0]?.containerType || 'Chưa cập nhật',
            cargoType: matchedFull?.containers?.[0]?.cargoType || 'Theo booking',
            operation: bkg?.gateType === 'GateOut' ? 'Giao container hàng' : 'Hạ bãi container',
            gate: `${selectedGate.code} · Làn 01`,
            etaDisplay: bkg?.validFrom
              ? `${new Date(bkg.validFrom).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(bkg.validTo).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
              : 'Trong khung giờ hợp lệ',
            sealNumber: matchedFull?.containers?.[0]?.sealNumber || 'Chưa cập nhật',
          }
          if (!bookingData.id) throw new Error('Booking không có mã định danh hợp lệ. Không thể ghi nhận qua cổng.')
          if (mode === 'checkin') {
            const approval = await gateService.approveGateIn({
            verificationRecordId: result.recordId,
            gateCode: selectedGate.code,
            laneCode: 'LANE_01',
            vehiclePlate: plate,
            bookingNumber: bookingData.bookingCode,
            containerNumber: bookingData.containerId,
            approvedBy: 'Auto-Gate AI',
            notes: 'Tự động mở cổng sau xác minh thành công.',
            overviewImageUrl: finalOverviewImg,
            vehiclePlateImageUrl: finalPlateImg,
            })
            if (!approval.success) throw new Error(approval.error || approval.data?.message || 'Không ghi nhận được Gate In. Vui lòng thử lại.')
          }
          setActiveBooking(bookingData)
          setProcessingStatus(mode === 'checkin' ? 'checked-in' : 'passed')
          setBarrierState('opening')
          setTimeout(() => setBarrierState('opened'), 600)
          setRejectionReason('')
          showToast(mode === 'checkin' ? `Đã ghi nhận xe ${plate} vào ${selectedGate.code}. Smart Route đã sẵn sàng cho tài xế.` : `Xe ${plate} đủ điều kiện ra ${selectedGate.code}. Xác nhận bên dưới khi xe đã qua cổng.`)
        } else {
          // 🚫 KIỂM TRA SAI: Không tìm thấy booking hoặc điều kiện không hợp lệ
          setActiveBooking(null)
          setProcessingStatus('rejected')
          setBarrierState('closed')
          const reason = result.message || result.failureReason || `Biển số "${plate}" không có thông tin đăng ký hợp lệ trong hệ thống`
          setRejectionReason(reason)
          setIncidentNote(reason)
          showToast(`⛔ TỰ ĐỘNG TỪ CHỐI VÀO CỔNG — ${reason}`)
        }
      } else {
        // Backend API trả về lỗi hoặc không tìm thấy
        setActiveBooking(null)
        setProcessingStatus('rejected')
        setBarrierState('closed')
        const reason = verifyRes.error || `Biển số "${plate}" không khớp bất kỳ thông tin đăng ký nào trong hệ thống`
        setRejectionReason(reason)
        setIncidentNote(reason)
        showToast(`⛔ TỰ ĐỘNG TỪ CHỐI VÀO CỔNG — ${reason}`)
      }
    } catch (err) {
      setActiveBooking(null)
      setProcessingStatus('rejected')
      setBarrierState('closed')
      const reason = `Lỗi hệ thống khi kiểm tra: ${err.message}`
      setRejectionReason(reason)
      showToast(`⛔ ${reason}`)
    } finally {
      setVerificationBusy(false)
    }
  }

  const completePhysicalGateOut = async () => {
    if (!activeBooking?.id || !selectedGate || processingStatus !== 'passed' || gateOutBusy) return
    setGateOutBusy(true)
    try {
      await gateService.completeGateOut(activeBooking.id, selectedGate.id)
      setProcessingStatus('checked-in')
      showToast(`Đã xác nhận xe ${activeBooking.licensePlate} qua ${selectedGate.code}. Driver và Dispatcher sẽ nhận trạng thái mới.`)
    } catch (error) { showToast(`Không ghi nhận được Gate Out: ${error.message}`) }
    finally { setGateOutBusy(false) }
  }

  // ── 5. QUÉT ANPR TỰ ĐỘNG LIÊN TỤC TỪ CAMERA LIVE STREAM (AUTO-SCAN) ──
  const performAutoScan = async (isManual = false) => {
    if (!selectedGate || verificationBusy || gateOutBusy) return
    if (!videoRef.current || videoRef.current.readyState < 2 || isScanningRef.current) {
      if (isManual) showToast('⚠️ Camera chưa sẵn sàng nhận hình ảnh. Vui lòng thử lại sau 1-2 giây!')
      return
    }
    // Nếu barie đã mở hoặc xe vừa xác nhận xong thì tạm dừng quét tự động để tránh lặp
    if (!isManual && (barrierState === 'opened' || barrierState === 'opening')) {
      return
    }

    try {
      isScanningRef.current = true
      setIsAiScanning(true)
      const video = videoRef.current
      if (!video || !video.videoWidth || !video.videoHeight) {
        if (isManual) showToast('⚠️ Chưa lấy được khung hình từ Camera.')
        return
      }
      const canvas = canvasRef.current || document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

      // Cập nhật ảnh hiện trường để người dùng thấy rõ khung hình camera vừa chụp
      setCapturedImage(dataUrl)

      const res = await fetch(dataUrl)
      const imageBlob = await res.blob()

      const aiRes = await gateService.recognizeVehicleImage(imageBlob, selectedGate.code, 'LANE_01')
      if (aiRes.success && aiRes.data) {
        const data = aiRes.data
        const plateObj = data.license_plate || {}
        const plate = plateObj.plate_number ? plateObj.plate_number.trim().toUpperCase() : ''
        const conf = plateObj.ocr_confidence ? plateObj.ocr_confidence * 100 : (plate ? 97.5 : 0)
        const cropImg = plateObj.plate_image_base64 || null

        if (plate) {
          if (isManual || plate !== lastScannedPlateRef.current) {
            setDetectedPlate(plate)
            setConfidence(conf)
            if (cropImg) setAiCropImage(cropImg)
            lastScannedPlateRef.current = plate
            showToast(`🎯 Nhận diện xe thành công: "${plate}" (${conf.toFixed(1)}%)`)
            await evaluateVerification(plate, conf, dataUrl, cropImg)
          }
        } else if (isManual) {
          showToast('⚠️ Không phát hiện biển số rõ ràng trong khung hình. Vui lòng căn chỉnh lại góc camera hoặc tăng độ sáng!')
        }
      } else if (isManual) {
        showToast('⚠️ Hệ thống không thể xử lý khung hình: ' + (aiRes.error || 'Lỗi nhận dạng'))
      }
    } catch (err) {
      if (isManual) showToast('⚠️ Lỗi khi quét camera: ' + err.message)
    } finally {
      isScanningRef.current = false
      setIsAiScanning(false)
    }
  }


  scanActionRef.current = performAutoScan
  // Tự động quét theo chu kỳ 2.5s khi camera đang bật
  useEffect(() => {
    if (!cameraActive) return
    const timer = setInterval(() => {
      scanActionRef.current?.()
    }, 2500)
    const initialTimer = setTimeout(() => {
      scanActionRef.current?.()
    }, 1000)

    return () => {
      clearInterval(timer)
      clearTimeout(initialTimer)
    }
  }, [cameraActive, barrierState, selectedGateId, mode, verificationBusy, gateOutBusy])


  // Danh sách checklist kiểm tra
  const normDetected = normalizePlate(detectedPlate)
  const normBooking = normalizePlate(activeBooking?.licensePlate)
  const plateMatch = Boolean(normDetected && normDetected === normBooking)

  const checklist = [
    { id: 'plate', label: 'Biển số xe khớp với thông tin đăng ký', ok: plateMatch },
    { id: 'booking', label: 'Lệnh đã được Điều độ phê duyệt', ok: ['Approved', 'Checked-in'].includes(activeBooking?.status) },
    { id: 'driver', label: 'Giấy phép lái xe còn hiệu lực sử dụng', ok: activeBooking?.licenseStatus === 'Valid' },
    { id: 'container', label: 'Mã container khớp với đăng ký', ok: Boolean(activeBooking?.containerId) },
    { id: 'time', label: 'Khung giờ tiếp cận hợp lệ', ok: true },
    { id: 'state', label: mode === 'checkout' ? 'Đã hoàn tất thủ tục giao nhận tại bãi' : 'Chưa hoàn tất thủ tục vào cổng', ok: true },
  ]

  const allValid = checklist.every((c) => c.ok)

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
      gateCode: mode === 'checkin' ? 'Cổng A · Làn Vào' : 'Cổng A · Làn Ra',
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
    showToast(`📋 Đã gửi báo cáo sự cố #${incidentCode} tới Điều độ viên thành công!`)
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
            <span className="text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200 px-3 py-0.5 rounded-full">
              Nhân viên cổng
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Cổng Kiểm Soát — Camera & Barie Tự Động
          </h1>
        </div>

        {/* Nút điều hướng Mode & Đồng hồ */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs font-bold">
            <button
              disabled={verificationBusy || isAiScanning || gateOutBusy}
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
              Cổng Vào
            </button>
            <button
              disabled={verificationBusy || isAiScanning || gateOutBusy}
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
              Cổng Ra
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <label className="flex items-center gap-3 flex-wrap text-xs font-bold text-slate-700">Cổng đang kiểm soát
          <select className="border border-slate-300 rounded-lg p-2 bg-white max-w-full" value={selectedGateId} disabled={verificationBusy || isAiScanning || gateOutBusy} onChange={event => { setSelectedGateId(event.target.value); setActiveBooking(null); setProcessingStatus('idle'); setBarrierState('closed'); lastScannedPlateRef.current = '' }}>
            {!availableGates.length && <option value="">Chưa tải được cổng hoạt động</option>}
            {availableGates.map(gate => <option key={gate.id} value={gate.id}>{gate.code} · {gate.name}</option>)}
          </select>
        </label>
        {gateError && <p role="alert" className="text-xs text-red-700">{gateError} Không thể xác minh xe khi chưa có cấu hình cổng thực tế.</p>}
        {selectedGate && <p className="text-xs text-slate-500">{mode === 'checkin' ? 'Gate In được ghi nhận sau khi backend duyệt xác minh thành công.' : 'Sau khi xe qua cổng, nhân viên cổng xác nhận bên dưới để hoàn tất hành trình và cập nhật điều độ.'}</p>}
        {mode === 'checkout' && processingStatus === 'passed' && activeBooking && <button type="button" onClick={() => void completePhysicalGateOut()} disabled={gateOutBusy || !selectedGate} className="w-full bg-emerald-700 text-white font-bold rounded-xl px-4 py-3 text-sm disabled:opacity-50">{gateOutBusy ? 'Đang ghi nhận…' : `Xác nhận xe ${activeBooking.licensePlate} đã qua ${selectedGate?.code}`}</button>}
        {mode === 'checkout' && processingStatus === 'checked-in' && <p role="status" className="text-xs text-emerald-700 font-bold">Đã ghi nhận Gate Out. Trạng thái xe và container đã được cập nhật.</p>}
      </div>

      {/* ── MAIN CONTENT (2 CỘT) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ══ CỘT TRÁI (7 cols): CAMERA MÁY + HUD NHẬN DIỆN ══ */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Thanh điều khiển Camera làn xe */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-3 h-3 rounded-full ${
                  cameraActive ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500' : 'bg-slate-400'
                }`}
              ></span>
              <div>
                <span className="text-xs font-bold text-slate-800 tracking-wide font-mono block">
                  CAM-01 · Cổng A — {mode === 'checkin' ? 'Làn Vào' : 'Làn Ra'} {cameraActive ? '(Camera đang hoạt động)' : '(Chưa bật camera)'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">

              {cameraActive && (
                <>
                  <button
                    type="button"
                    onClick={() => performAutoScan(true)}
                    disabled={isAiScanning}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-all cursor-pointer font-mono active:scale-95"
                    title="Chụp ngay khung hình hiện tại và phân tích nhận diện biển số"
                  >
                    <span className="material-symbols-outlined text-base">photo_camera</span>
                    {isAiScanning ? 'Đang phân tích...' : 'Chụp & quét ngay'}
                  </button>

                  <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 font-mono shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className="material-symbols-outlined text-sm text-emerald-600">radar</span>
                    {isAiScanning ? 'Đang phân tích...' : 'Tự động quét liên tục'}
                  </div>
                </>
              )}

              {!cameraActive ? (
                <button
                  onClick={startCamera}
                  disabled={cameraLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-all cursor-pointer font-mono active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">videocam</span>
                  {cameraLoading ? 'Đang mở camera...' : 'Bật camera quan sát'}
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="px-3.5 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer font-mono"
                >
                  <span className="material-symbols-outlined text-base">videocam_off</span>
                  Tắt camera
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

            {/* 2. Khi Camera chưa bật: hiển thị màn hình chờ */}
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-[#070b14]/90 backdrop-blur-xs">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400 mb-3 shadow-xl shadow-blue-500/10">
                  <span className="material-symbols-outlined text-3xl">videocam</span>
                </div>
                <div className="text-slate-300 text-xs font-mono font-bold tracking-wider mb-1.5 px-3.5 py-1 bg-slate-800 border border-slate-700 rounded-full">
                  Camera làn cổng chưa bật
                </div>
                <p className="text-slate-400 text-xs max-w-sm mt-2 mb-4 leading-relaxed font-sans">
                  Hệ thống camera thông minh sẽ tự động quét liên tục luồng hình ảnh, nhận diện biển số xe khi xe tiến vào vạch dừng và kích hoạt đối soát tự động.
                </p>
                <button
                  onClick={startCamera}
                  disabled={cameraLoading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xl shadow-blue-600/30 flex items-center gap-2 transition-all active:scale-95 cursor-pointer font-mono"
                >
                  <span className="material-symbols-outlined text-base">videocam</span>
                  {cameraLoading ? 'Đang kết nối...' : 'Bật camera quan sát'}
                </button>
              </div>
            )}

            {/* Overlay kính mờ & khung ngắm */}
            <div className="absolute inset-0 bg-black/25 pointer-events-none"></div>

            {/* Tia quét Laser tự động chuyển động khi bật camera */}
            {cameraActive && (
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] pointer-events-none animate-pulse"></div>
            )}

            {/* HUD Bounding Box Xe */}
            <div className="absolute top-[12%] left-[10%] right-[10%] h-[55%] border-2 border-slate-400/60 rounded pointer-events-none overflow-hidden">
              <div className="absolute -top-6 left-0 bg-slate-700 text-white text-[10px] font-bold px-2 py-0.5 font-mono flex items-center gap-1">
                Khung quan sát phương tiện
              </div>
              <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-400"></div>
              <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-400"></div>
              <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-400"></div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-400"></div>
            </div>

            {/* HUD Bounding Box Biển số */}
            <div className="absolute bottom-[20%] left-[28%] right-[28%] h-[12%] border-2 border-blue-400/90 rounded bg-blue-500/10 pointer-events-none flex items-center justify-center">
              <div className="absolute -top-5 left-0 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 font-mono">
                Vùng biển số xe
              </div>
              {detectedPlate && (
                <span className="text-white font-mono font-bold text-sm tracking-widest drop-shadow-md">
                  {detectedPlate}
                </span>
              )}
            </div>

            {/* Trạng thái trên góc */}
            <div className="absolute top-3 left-3 bg-black/75 border border-slate-600 text-slate-300 text-[10px] font-mono px-2.5 py-1 rounded-lg flex items-center gap-1.5 backdrop-blur-sm">
              <span className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
              Trực tiếp · {confidence > 0 ? `Độ chính xác: ${confidence.toFixed(1)}%` : 'Đang quét tự động'}
            </div>

            {/* Timestamp trên góc */}
            <div className="absolute bottom-3 left-3 text-[10px] font-mono text-slate-300 bg-black/70 px-2.5 py-1 rounded-lg backdrop-blur-sm">
              {new Date().toLocaleDateString('vi-VN')} {currentTime}
            </div>

            {/* Badge báo hiệu chế độ tự động */}
            {cameraActive && (
              <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
                <div className="px-3.5 py-1.5 bg-black/80 backdrop-blur-md border border-emerald-600/60 rounded-xl text-xs font-mono font-bold text-emerald-400 flex items-center gap-2 shadow-2xl">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{isAiScanning ? '⚡ Đang phân tích khung hình...' : '🟢 Tự động quét trực tiếp'}</span>
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

          {/* KẾT QUẢ NHẬN DIỆN PHƯƠNG TIỆN */}
          <div
            className={`rounded-2xl border-2 p-4 transition-all shadow-xs ${
              plateMatch
                ? 'bg-emerald-50/70 border-emerald-400'
                : detectedPlate
                ? 'bg-rose-50/70 border-rose-400'
                : 'bg-white border-slate-200/90'
            }`}
          >
            {/* Header Thẻ */}
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-blue-600">directions_car</span>
                Kết Quả Nhận Diện Biển Số
              </span>
              {detectedPlate ? (
                <span
                  className={`text-[11px] font-bold px-3 py-1 rounded-full border font-mono ${
                    confidence > 85
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}
                >
                  Độ chính xác: {confidence.toFixed(1)}%
                </span>
              ) : (
                <span className="text-[11px] font-bold px-3 py-1 rounded-full border font-mono bg-blue-50 text-blue-700 border-blue-200/80 flex items-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Camera đang quét trực tiếp
                </span>
              )}
            </div>

            {/* Khung Nội Dung: Biển số & Trạng thái */}
            <div className="bg-slate-50/90 rounded-xl p-3.5 border border-slate-200/80">
              {detectedPlate ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  {/* Cột Trái: Mô phỏng biển số xe thực tế */}
                  <div className="flex flex-col items-center sm:items-start">
                    <div className="relative bg-white border-2 border-slate-900 rounded-xl px-7 py-2.5 shadow-sm flex items-center justify-center font-mono font-black text-2xl sm:text-3xl tracking-widest text-slate-900 ring-4 ring-slate-900/5">
                      <span className="absolute left-2.5 w-1.5 h-1.5 rounded-full bg-slate-400 ring-1 ring-slate-300"></span>
                      <span>{detectedPlate}</span>
                      <span className="absolute right-2.5 w-1.5 h-1.5 rounded-full bg-slate-400 ring-1 ring-slate-300"></span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1.5">Biển số nhận diện thành công</span>
                  </div>

                  {/* Cột Phải: Trạng thái đối soát */}
                  <div className="flex flex-col sm:items-end justify-center">
                    <div
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 border shadow-2xs ${
                        processingStatus === 'passed'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-rose-100 text-rose-900 border-rose-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">
                        {processingStatus === 'passed' ? 'verified' : 'cancel'}
                      </span>
                      <span>{processingStatus === 'passed' ? 'Hợp lệ với lệnh điều độ' : 'Không khớp thông tin đăng ký'}</span>
                    </div>
                    <span className={`text-[11px] mt-1.5 font-medium ${processingStatus === 'passed' ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {processingStatus === 'passed'
                        ? 'Hệ thống tự động kích hoạt mở barie'
                        : rejectionReason || 'Vui lòng kiểm tra lại thông tin xe'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  {/* Cột Trái: Khung chờ biển số với hiệu ứng */}
                  <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-dashed border-slate-300">
                    <div className="relative bg-slate-50 border-2 border-slate-300/80 rounded-lg px-6 py-2 shadow-2xs flex items-center justify-center font-mono font-black text-xl tracking-widest text-slate-300 select-none">
                      <span className="absolute left-2 w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                      <span>••• • - •••.••</span>
                      <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs font-medium text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                      <span>Chờ xe dừng tại vạch kiểm soát...</span>
                    </div>
                  </div>

                  {/* Cột Phải: Các bước quy trình tự động */}
                  <div className="flex flex-col justify-center space-y-2 border-t sm:border-t-0 sm:border-l border-slate-200/90 pt-3 sm:pt-0 sm:pl-4">
                    <div className="flex items-center gap-2.5 text-xs text-slate-600">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                      <span>Phương tiện dừng trước <b>vạch kiểm soát</b></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-slate-600">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                      <span>Camera AI tự động <b>quét & nhận diện biển số</b></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-slate-600">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                      <span>Hệ thống tự động <b>đối soát & mở barie</b></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ẢNH CHỤP HIỆN TRƯỜNG & BIỂN SỐ */}
          <div className="grid grid-cols-2 gap-4">
            {/* THẺ 1: ẢNH HIỆN TRƯỜNG */}
            <div className="bg-white rounded-2xl p-3.5 space-y-2 border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-blue-600">photo_camera</span>
                  Ảnh Hiện Trường
                </span>
                {capturedImage && (
                  <button
                    onClick={() => setPreviewImageModal(capturedImage)}
                    className="text-[10px] font-bold text-blue-600 font-mono hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">zoom_in</span> Xem lớn
                  </button>
                )}
              </div>
              <div
                className="aspect-video bg-slate-100 rounded-xl overflow-hidden flex flex-col items-center justify-center cursor-pointer group relative border border-slate-200"
                onClick={() => capturedImage && setPreviewImageModal(capturedImage)}
              >
                {capturedImage ? (
                  <>
                    <img src={capturedImage} alt="Hiện trường" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                      <span className="material-symbols-outlined text-base">zoom_in</span> Bấm phóng to
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-slate-400 p-2 text-center">
                    <div className="w-9 h-9 rounded-full bg-white shadow-xs border border-slate-200/80 flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined text-lg">photo_camera</span>
                    </div>
                    <span className="text-[11px] font-medium">Chờ lưu ảnh toàn cảnh</span>
                  </div>
                )}
              </div>
              <div className="text-center text-[10px] font-medium text-slate-500 font-mono pt-0.5">
                {capturedImage ? '✓ Đã chụp hiện trường' : 'Tự động chụp khi xe dừng'}
              </div>
            </div>

            {/* THẺ 2: ẢNH CẮT BIỂN SỐ */}
            <div className="bg-white rounded-2xl p-3.5 space-y-2 border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-blue-600">crop</span>
                  Ảnh Cắt Biển Số
                </span>
                {aiCropImage && (
                  <button
                    onClick={() => setPreviewImageModal(aiCropImage)}
                    className="text-[10px] font-bold text-blue-600 font-mono hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">zoom_in</span> Xem lớn
                  </button>
                )}
              </div>
              <div
                className="aspect-video bg-slate-100 rounded-xl overflow-hidden flex flex-col items-center justify-center cursor-pointer group relative border border-slate-200"
                onClick={() => aiCropImage && setPreviewImageModal(aiCropImage)}
              >
                {aiCropImage ? (
                  <>
                    <img src={aiCropImage} alt="Ảnh cắt biển số" className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform bg-slate-900" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                      <span className="material-symbols-outlined text-base">zoom_in</span> Bấm phóng to
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-slate-400 p-2 text-center">
                    <div className="w-9 h-9 rounded-full bg-white shadow-xs border border-slate-200/80 flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined text-lg">crop</span>
                    </div>
                    <span className="text-[11px] font-medium">Chờ trích xuất biển số</span>
                  </div>
                )}
              </div>
              <div className="text-center text-[10px] font-medium text-slate-500 font-mono pt-0.5">
                {aiCropImage ? (detectedPlate ? `Biển số: ${detectedPlate}` : '✓ Đã trích xuất') : 'Tự động cắt khi nhận diện'}
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
                  <h3 className="text-sm font-bold tracking-wide uppercase text-slate-900 font-mono flex items-center gap-1.5">
                    Trạng thái Barie Cổng A
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono font-medium block">
                    {mode === 'checkin' ? 'Làn Vào' : 'Làn Ra'} · Hệ thống barie tự động
                  </span>
                </div>
              </div>

              {/* Badge trạng thái Barie: Nổi bật, cực kỳ rõ ràng */}
              <div
                className="px-3.5 py-1.5 rounded-full text-xs font-bold font-mono tracking-wider flex items-center gap-2 shadow-xs transition-all"
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
                  {barrierState === 'opened' ? 'Barie Đã Mở' : 'Barie Đang Đóng'}
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
                <span className="text-[8px] font-mono font-bold text-amber-400 tracking-widest">
                  ◄◄ {mode === 'checkin' ? 'CỔNG VÀO · LÀN XE' : 'CỔNG RA · LÀN XE'}
                </span>
                <span className="text-[8px] font-mono font-bold text-slate-400 tracking-wider">
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
                  CẢNG
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
              className="py-3 px-4 rounded-xl text-center font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
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
                  ? 'Cổng đang mở — Phương tiện được phép lưu thông qua cổng'
                  : processingStatus === 'rejected'
                  ? 'Cổng tự động khóa — Xe bị từ chối do không khớp đăng ký'
                  : 'Cổng đang đóng — Chờ hệ thống xác minh phương tiện'}
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
                    showToast(`Đã mở barie ${selectedGate?.code}.`)
                  }}
                  disabled={barrierState === 'opened'}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">lock_open</span>
                  Mở barie
                </button>
                <button
                  onClick={() => {
                    setBarrierState('closed')
                    showToast(`Đã đóng barie ${selectedGate?.code}.`)
                  }}
                  disabled={barrierState === 'closed'}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">lock</span>
                  Hạ barie
                </button>
              </div>
            </div>
          </div>

          {/* THÔNG TIN GATE BOOKING ĐỐI SOÁT HỢP LỆ */}
          {(processingStatus === 'passed' || processingStatus === 'checked-in') && activeBooking ? (
            <div className="bg-white border-2 border-emerald-400 rounded-2xl p-5 shadow-lg space-y-4 animate-in zoom-in-95">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">fact_check</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                      <span className="material-symbols-outlined text-sm">verified</span>
                      Xác minh cổng hợp lệ
                    </div>
                    <h4 className="font-heading font-bold text-sm text-slate-900">
                      Mã đăng ký: {activeBooking.bookingCode}
                    </h4>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-bold border bg-emerald-100 text-emerald-900 border-emerald-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  {activeBooking.status === 'Approved' ? 'Đã duyệt' : activeBooking.status === 'Checked-in' ? 'Đã vào cổng' : activeBooking.status || 'Hợp lệ'}
                </span>
              </div>

              {/* THÔNG TIN CƠ BẢN ĐỂ KIỂM SOÁT CỔNG */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs font-mono">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-[10px] block uppercase font-bold">Mã đăng ký:</span>
                  <div className="font-bold text-blue-700 text-sm">{activeBooking.bookingCode}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-[10px] block uppercase font-bold">Biển số đăng ký:</span>
                  <div className="font-bold text-blue-700 text-sm">{activeBooking.licensePlate}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-[10px] block uppercase font-bold">Doanh nghiệp vận tải:</span>
                  <div className="font-bold text-slate-800 truncate">{activeBooking.company}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-[10px] block uppercase font-bold">Tài xế đăng ký:</span>
                  <div className="font-bold text-slate-800">{activeBooking.driverName}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-[10px] block uppercase font-bold">Mã container:</span>
                  <div className="font-bold text-slate-800">{activeBooking.containerId}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-[10px] block uppercase font-bold">Loại container / Tác nghiệp:</span>
                  <div className="font-bold text-slate-800 truncate">{activeBooking.containerType} · {activeBooking.operation}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-[10px] block uppercase font-bold">Cổng / Giờ dự kiến:</span>
                  <div className="font-bold text-orange-600">{activeBooking.gate} · {activeBooking.etaDisplay}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-[10px] block uppercase font-bold">Số chì niêm phong:</span>
                  <div className="font-bold text-slate-800">{activeBooking.sealNumber}</div>
                </div>
              </div>

              {/* NÚT ĐIỀU HƯỚNG SANG TRANG XÁC MINH XE & TÀI XẾ */}
              <Link
                to={`/gate/verification?plate=${encodeURIComponent(activeBooking.licensePlate || detectedPlate)}&booking=${encodeURIComponent(activeBooking.bookingCode || '')}`}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold font-mono flex items-center justify-between shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-base">fact_check</span>
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] text-blue-200 uppercase tracking-wider font-bold">Chi tiết đối soát hồ sơ</div>
                    <div className="text-xs font-bold">Xem thông tin tài xế tại trang xác minh ➔</div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </Link>
            </div>
          ) : processingStatus === 'rejected' ? (
            /* TRẠNG THÁI TỰ ĐỘNG TỪ CHỐI */
            <div className="bg-white border-2 border-rose-300 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-rose-700 border-b border-rose-100 pb-3">
                <span className="material-symbols-outlined text-2xl">gpp_bad</span>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-rose-500">Kết quả đối soát cổng</span>
                  <h4 className="text-sm font-bold text-rose-950 uppercase">Tự động từ chối — Không hợp lệ</h4>
                </div>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-1 text-xs">
                <div className="font-bold text-rose-900 flex items-center justify-between">
                  <span>Biển số phát hiện:</span>
                  <span className="font-mono text-rose-700 text-sm font-bold">{detectedPlate || 'Chưa rõ'}</span>
                </div>
                <div className="text-[11px] text-rose-800 leading-relaxed pt-1 border-t border-rose-200/60">
                  {rejectionReason || 'Không tìm thấy thông tin đăng ký hợp lệ trong hệ thống tương ứng với thông tin phương tiện.'}
                </div>
              </div>
              <div className="text-[10px] text-slate-500 flex items-center justify-between font-mono">
                <span>Trạng thái Barie: <strong className="text-rose-600">Đang khóa</strong></span>
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
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Chờ phương tiện tiến vào vùng quét
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  Camera đang tự động nhận diện biển số xe. Thông tin đăng ký và chứng từ điều độ sẽ tự động hiển thị tại đây khi hệ thống đối soát hợp lệ.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {mode === 'checkin' ? 'Làn Vào' : 'Làn Ra'} · Camera sẵn sàng
              </div>
            </div>
          )}

          {/* DANH SÁCH KIỂM TRA ĐIỀU KIỆN */}
          <div
            className={`rounded-2xl border-2 p-4 space-y-3 transition-all shadow-xs ${
              allValid
                ? 'bg-emerald-50/60 border-emerald-400'
                : processingStatus === 'rejected'
                ? 'bg-rose-50/60 border-rose-300'
                : 'bg-white border-slate-200/80'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-blue-600">checklist</span>
                Danh Sách Kiểm Tra Điều Kiện
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                allValid ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
              }`}>
                {checklist.filter(c => c.ok).length}/{checklist.length} đạt chuẩn
              </span>
            </div>

            <div className="space-y-2">
              {checklist.map((c) => (
                <div key={c.id} className="flex items-center gap-2.5 p-1.5 rounded-lg text-xs hover:bg-slate-50/50 transition-colors">
                  <span
                    className={`material-symbols-outlined text-base shrink-0 ${
                      c.ok
                        ? 'text-emerald-600'
                        : processingStatus === 'rejected'
                        ? 'text-rose-600'
                        : 'text-slate-300'
                    }`}
                  >
                    {c.ok ? 'check_circle' : processingStatus === 'rejected' ? 'cancel' : 'radio_button_unchecked'}
                  </span>
                  <span
                    className={
                      c.ok
                        ? 'text-emerald-950 font-semibold'
                        : processingStatus === 'rejected'
                        ? 'text-rose-950 font-bold'
                        : 'text-slate-600'
                    }
                  >
                    {c.label}
                  </span>
                </div>
              ))}
            </div>

            {/* BANNER KẾT QUẢ ĐỐI SOÁT */}
            <div
              className={`text-center font-bold text-xs py-2 px-3 rounded-xl border flex items-center justify-center gap-2 ${
                processingStatus === 'passed' || processingStatus === 'checked-in'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : processingStatus === 'rejected'
                  ? 'bg-rose-100 text-rose-900 border-rose-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {processingStatus === 'passed' || processingStatus === 'checked-in'
                  ? 'check_circle'
                  : processingStatus === 'rejected'
                  ? 'warning'
                  : 'hourglass_empty'}
              </span>
              <span>
                {processingStatus === 'passed' || processingStatus === 'checked-in'
                  ? (mode === 'checkin' ? 'Xác minh thành công — Barie tự động nâng cần' : 'Sẵn sàng mở cổng cho xe xuất cảng')
                  : processingStatus === 'rejected'
                  ? 'Xác minh thất bại — Cổng đã tự động khóa'
                  : 'Chờ phương tiện — Camera quét tự động khi xe dừng'}
              </span>
            </div>

            {rejectionReason && !allValid && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-start gap-1.5">
                <span className="material-symbols-outlined text-sm text-rose-600 mt-0.5">error</span>
                <span>{rejectionReason}</span>
              </div>
            )}
          </div>

          {/* ══ NÚT HÀNH ĐỘNG CHÍNH ══ */}
          {processingStatus === 'checked-in' ? (
            // KHI ĐÃ MỞ CỔNG TỰ ĐỘNG THÀNH CÔNG
            <div className="flex flex-col gap-2.5">
              <div className="h-14 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-bold text-base shadow-xl flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-2xl">check_circle</span>
                {mode === 'checkin' ? '🎉 Cổng đã tự động mở — Xe được phép vào cảng' : '🎉 Cổng đã tự động mở — Xe được phép ra ngoài'}
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
                  Báo sự cố Điều độ
                </button>
              </div>
            </div>
          ) : processingStatus === 'rejected' ? (
            // KHI BỊ TỪ CHỐI: HIỂN THỊ CÁC HÀNH ĐỘNG XỬ LÝ SỰ CỐ
            <div className="flex flex-col gap-3">
              <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-900 text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-xl text-rose-600">block</span>
                <div>
                  <div>Đã tự động từ chối vào cổng</div>
                  <div className="text-[11px] font-normal text-rose-700">
                    Xe không đủ điều kiện an toàn. Cổng đã tự động khóa. Vui lòng tạo sự cố để gửi cho Điều độ.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setShowIncidentModal(true)}
                  className="h-13 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl">report</span>
                  Tạo sự cố gửi Điều độ
                </button>

                <button
                  onClick={() => {
                    setProcessingStatus('idle')
                    setDetectedPlate('')
                    setCapturedImage(null)
                    setAiCropImage(null)
                    setRejectionReason('')
                    lastScannedPlateRef.current = ''
                    performAutoScan()
                  }}
                  className="h-13 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl">refresh</span>
                  Quét lại camera
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Modal xác nhận mở cổng đã bị xóa — cổng tự động mở khi xác minh thành công */}

      {/* ══ MODAL TỪ CHỐI THỦ CÔNG ══ */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
              <span className="material-symbols-outlined text-3xl text-rose-600">block</span>
              <h3 className="text-xl font-bold text-slate-900">Từ chối vào cổng</h3>
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
                className="flex-1 h-11 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700"
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
                  <h3 className="text-lg font-bold text-slate-900">Báo cáo sự cố gửi Điều độ</h3>
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
                <strong className="text-slate-900">Cổng A · {mode === 'checkin' ? 'Làn Vào' : 'Làn Ra'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Biển số phát hiện:</span>
                <strong className="text-rose-600">{detectedPlate || 'Chưa nhận diện'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hồ sơ đăng ký liên quan:</span>
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
                  <option value="Sai biển số xe so với đăng ký">Sai biển số xe so với đăng ký</option>
                  <option value="Xe không có đăng ký trong hệ thống">Xe không có đăng ký trong hệ thống</option>
                  <option value="Đăng ký chưa được phê duyệt hoặc hết hạn">Đăng ký chưa được phê duyệt hoặc hết hạn</option>
                  <option value="Giấy phép lái xe tài xế hết hạn / vi phạm">Giấy phép lái xe tài xế hết hạn / vi phạm</option>
                  <option value="Mã container không khớp thông tin đăng ký">Mã container không khớp thông tin đăng ký</option>
                  <option value="Số chì niêm phong bị rách / không khớp">Số chì niêm phong bị rách / không khớp</option>
                  <option value="Xe tải hỏng hóc gây ùn tắc tại cổng">Xe tải hỏng hóc gây ùn tắc tại cổng</option>
                  <option value="Lỗi thiết bị nhận diện camera / cảm biến">Lỗi thiết bị nhận diện camera / cảm biến</option>
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
                  placeholder="Mô tả hiện trường, phản ánh của tài xế hoặc chỉ đạo điều phối mong muốn từ Điều độ..."
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
                Gửi Điều độ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal phóng to ảnh */}
      {previewImageModal && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImageModal(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl p-4 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center w-full pb-3 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">photo_library</span>
                <span className="text-xs font-mono font-bold text-slate-200">
                  Bằng chứng hình ảnh cổng
                </span>
              </div>
              <button
                onClick={() => setPreviewImageModal(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="w-full flex items-center justify-center py-4 bg-black/40 rounded-xl mt-3">
              <img
                src={previewImageModal}
                alt="Enlarged"
                className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
