import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { io } from 'socket.io-client'
import apiClient from '../../services/apiClient'
import gateService from '../../services/gateService'
import { webSerialGate, browserCamera } from '../../services/webSerialGate'
import { gateOpenSeconds, getGatePassageSimulation } from '../../services/gatePassageSimulationService'
import { driverSmartRouteService } from '../../services/driverSmartRouteService'
import { formatPlateNumber, normalizePlate } from '../../utils/format'
import Select from '../../components/ui/Select'

const DEFAULT_GATES = [
  { id: 'gate-in-01', code: 'GATE_IN', name: 'Cổng Vào', gateType: 'gate_in', isActive: true },
  { id: 'gate-out-01', code: 'GATE_OUT', name: 'Cổng Ra', gateType: 'gate_out', isActive: true },
]

export default function GateControl() {
  const [iotConnected, setIotConnected] = useState(false)
  const [hwStatus, setHwStatus] = useState(null)
  const [deviceConnected, setDeviceConnected] = useState(webSerialGate.connected)
  const [deviceBusy, setDeviceBusy] = useState(false)
  const [browserStream, setBrowserStream] = useState(browserCamera.stream)
  const serialScanBusyRef = useRef(false)
  const [currentTime, setCurrentTime] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [mode, setMode] = useState('checkin') // 'checkin' | 'checkout'
  const modeRef = useRef(mode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  const [gateLocations, setGateLocations] = useState(DEFAULT_GATES)
  const [selectedGateId, setSelectedGateId] = useState('')
  const [gateError, setGateError] = useState('')
  const [verificationBusy, setVerificationBusy] = useState(false)
  const [simulation, setSimulation] = useState(null)
  const simulationLockRef = useRef(false)
  const verificationInFlightRef = useRef(false)
  const cyclePending = simulation && simulation.stage !== 'completed'
  const gateOutBusy = Boolean(cyclePending)
  const availableGates = gateLocations.filter(gate => gate.isActive !== false && gate.gateType === (mode === 'checkin' ? 'gate_in' : 'gate_out'))
  const selectedGate = availableGates.find(gate => gate.id === selectedGateId) || availableGates[0] || DEFAULT_GATES[mode === 'checkin' ? 0 : 1]
  
  // Trạng thái Camera máy (Webcam)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [capturedImage, setCapturedImage] = useState(null)
  const [previewImageModal, setPreviewImageModal] = useState(null)

  // Trạng thái Nhận dạng (ANPR) & Thao tác thủ công
  const [detectedPlate, setDetectedPlate] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [isAiScanning, setIsAiScanning] = useState(false)
  const [aiCropImage, setAiCropImage] = useState(null)

  // Trạng thái Barie & Xử lý Cổng
  // 'idle' | 'passed' | 'rejected' | 'checked-in' | 'incident-reported'
  const [processingStatus, setProcessingStatus] = useState('idle')
  const [barrierState, setBarrierState] = useState('closed') // 'closed' | 'opening' | 'opened'
  const [barrierBusy,setBarrierBusy]=useState(false)
  const [manualReason,setManualReason]=useState('')
  const [selectedEntry,setSelectedEntry]=useState(null)
  const [passageEvidence,setPassageEvidence]=useState(null)
  const [passageBusy, setPassageBusy] = useState(false)
  const physicalPassagePending = passageEvidence?.physical && processingStatus === 'passed'
  const barrierRequestRef=useRef(null)
  const barrierInFlightRef=useRef(false)
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
      if (active) {
        const list = Array.isArray(items) && items.length > 0 ? items : DEFAULT_GATES
        setGateLocations(list)
        setGateError('')
      }
    }).catch(() => {
      if (active) {
        setGateLocations(DEFAULT_GATES)
        setGateError('')
      }
    })
    return () => { active = false }
  }, [])

  // Theo dõi tình trạng kết nối phần cứng thời gian thực (ESP32 COM8, Camera, AI Pipeline)
  useEffect(() => {
    let active = true
    const checkHw = async () => {
      const res = await gateService.getHardwareStatus()
      if (active && res.success) {
        setHwStatus(res.data)
        // Tự động đồng bộ trạng thái Barie từ phần cứng nếu có thay đổi (ví dụ ESP32 tự hạ sau 30s)
        const currentTarget = modeRef.current === 'checkout' ? 'out' : 'in'
        const hwBarrierState = res.data?.barrier?.[currentTarget]
        if (hwBarrierState && (hwBarrierState === 'opened' || hwBarrierState === 'closed')) {
          setBarrierState(prev => (prev !== hwBarrierState ? hwBarrierState : prev))
        }
      }
    }
    checkHw()
    const timer = setInterval(checkHw, 2000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  // Mở camera xem trực tiếp khi vào trang; chỉ ESP32/sensor mới kích hoạt quét OCR.
  useEffect(() => {
    let active = true
    const lane = mode === 'checkout' ? 'OUT' : 'IN'
    const enablePreview = async () => {
      const result = await gateService.setCameraPreview(lane, true)
      if (!active) {
        if (result.success) await gateService.setCameraPreview(lane, false)
        return
      }
      if (result.success && result.data.preview_enabled) {
        setCameraActive(true)
        setCameraError(null)
      } else {
        setCameraActive(false)
        setCameraError(result.error || 'AI Service chưa sẵn sàng để mở camera.')
      }
      setCameraLoading(false)
    }

    setCameraLoading(true)
    enablePreview()
    const leaseRenewal = setInterval(() => {
      if (document.visibilityState === 'visible') enablePreview()
    }, 8000)

    return () => {
      active = false
      clearInterval(leaseRenewal)
      gateService.setCameraPreview(lane, false)
      setCameraActive(false)
    }
  }, [mode])

  useEffect(() => {
    if (simulationLockRef.current) return
    const matching = gateLocations.filter(gate => gate.isActive !== false && gate.gateType === (mode === 'checkin' ? 'gate_in' : 'gate_out'))
    setSelectedGateId(current => matching.some(gate => gate.id === current) ? current : matching[0]?.id || '')
    setActiveBooking(null); setPassageEvidence(null); setProcessingStatus('idle'); setBarrierState('closed')
  }, [mode, gateLocations])

  useEffect(() => {
    if (!gateLocations.length) return
    const simulator = getGatePassageSimulation()
    const unsubscribe = simulator.subscribe(cycle => {
      simulationLockRef.current = cycle.stage !== 'completed' && cycle.stage !== 'error'
      setSimulation(cycle)
      setMode(cycle.mode)
      setSelectedGateId(cycle.gate.id)
      setActiveBooking({ ...cycle.booking, status: cycle.passageRecorded ? (cycle.mode === 'checkin' ? 'Checked-in' : 'Đã ra cổng') : 'Approved' })
      setPassageEvidence(cycle.evidence)
      setDetectedPlate(cycle.booking.licensePlate)
      setProcessingStatus(cycle.passageRecorded ? 'checked-in' : 'passed')
      if (cycle.stage !== 'error') {
        setBarrierState(cycle.barrierClosed ? 'closed' : 'opened')
      }
      if (cycle.stage === 'completed') showToast(`Đã ghi nhận xe ${cycle.booking.licensePlate} qua ${cycle.gate.code}.`)
    })
    void simulator.resume().catch(() => {})
    return unsubscribe
  }, [gateLocations])

  const loadInitialData = async () => {
    try {
      const [bookingRes, vehicleRes] = await Promise.all([
        gateService.getBookings({pageSize:150}).then(data=>({data})),
        apiClient.get('/v1/vehicle').catch(() => ({ data: [] }))
      ])

      // getBookings() đã trả về array trực tiếp sau khi wrap .then(data=>({data}))
      const rawBookings = bookingRes.data?.items ?? bookingRes.data ?? []
      const bookings = Array.isArray(rawBookings) ? rawBookings : []
      const vehicles = vehicleRes.data || []
      setCachedBookings(Array.isArray(bookings) ? bookings : [])
      setCachedVehicles(vehicles)

      // XÓA MOCK DATA: Tuyệt đối KHÔNG gán activeBooking mặc định
      // Thông tin Booking chỉ được hiển thị khi Camera AI quét và kiểm tra ĐÚNG với dữ liệu thật.
    } catch (err) {
      console.error('Lỗi tải dữ liệu cổng:', err)
      showToast(`Không tải được lịch booking cổng: ${err.message}`)
    }
  }

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4500)
  }

  const commandBarrier=async(action,source,verificationRecordId,reasonOverride,gate=selectedGate,physical=false)=>{
    if(!gate || barrierInFlightRef.current) throw new Error('Cổng chưa sẵn sàng hoặc đang xử lý lệnh.')
    const reason=reasonOverride??(manualReason.trim() || 'Thao tác thủ công của nhân viên trực cổng')
    if(source==='manual'&&!reason)throw new Error('Nhập lý do điều khiển cổng thủ công.')
    const outbound = gate.gateType === 'gate_out'
    const mappedGateCode = outbound && gate.code === 'GATE_OUT' ? 'GATE-02' : outbound ? gate.code : 'GATE-01'
    const key=JSON.stringify([mappedGateCode,action,source,verificationRecordId,reason])
    if(barrierRequestRef.current?.key!==key){
      const requestId=globalThis.crypto?.randomUUID?.()||'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=Math.floor(Math.random()*16);return(c==='x'?n:(n&3)|8).toString(16)})
      barrierRequestRef.current={key,requestId}
    }
    barrierInFlightRef.current=true;setBarrierBusy(true)
    try{
      const result=await gateService.commandBarrier({requestId:barrierRequestRef.current.requestId,gateCode:mappedGateCode,
        action,source,verificationRecordId:verificationRecordId||null,reason:source==='manual'?reason:undefined})
      if(result.status!=='simulated'&&result.status!=='acknowledged')throw new Error('Lệnh chưa được bộ điều khiển xác nhận.')
      if (action === 'open' && physical && !outbound) {
        setBarrierState('opening')
        try {
          await gateService.openAuthorizedInboundBarrier(result.commandId)
        } catch (error) {
          setBarrierState('closed')
          throw error
        }
      } else {
        if (action === 'open' && outbound) void gateService.manualBarrierOpen('OUT')
        if (action === 'close') void gateService.manualBarrierClose(outbound ? 'OUT' : 'IN')
        setBarrierState(action === 'open' ? 'opened' : 'closed')
      }
      barrierRequestRef.current=null
      return result
    }finally{barrierInFlightRef.current=false;setBarrierBusy(false)}
  }

  const manualBarrier = async (action) => {
    // 1. Luôn ưu tiên cập nhật trạng thái Barie ngay lập tức trên UI (không bị chặn)
    const nextState = action === 'open' ? 'opened' : 'closed'
    setBarrierState(nextState)
    simulationLockRef.current = false

    // Gửi tín hiệu điều khiển phần cứng ESP32 (Servo SG90 / Buzzer) theo làn Vào/Ra
    const targetLane = mode === 'checkout' ? 'OUT' : 'IN'
    try {
      if (action === 'open') {
        const res = await gateService.manualBarrierOpen(targetLane)
        if (res?.success) {
          showToast(`Đã mở barie ${mode === 'checkout' ? 'Cổng Ra' : 'Cổng Vào'}.`)
        } else {
          showToast(res?.error || `Đã gửi lệnh mở barie ${mode === 'checkout' ? 'Cổng Ra' : 'Cổng Vào'}.`)
        }
      } else {
        const res = await gateService.manualBarrierClose(targetLane)
        if (res?.success) {
          showToast(`Đã hạ barie ${mode === 'checkout' ? 'Cổng Ra' : 'Cổng Vào'}.`)
        } else {
          showToast(res?.error || `Đã gửi lệnh hạ barie ${mode === 'checkout' ? 'Cổng Ra' : 'Cổng Vào'}.`)
        }
      }
    } catch (err) {
      showToast(`Lỗi gửi lệnh barie: ${err.message}`)
    }

    // Xóa bỏ bất kỳ chu trình mô phỏng treo nào trong bộ nhớ
    try {
      getGatePassageSimulation().clear()
      const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null')
      const acc = user?.id || user?.userId || user?.username || user?.email || 'anonymous'
      sessionStorage.removeItem(`gate:${acc}:nexusport.gate-passage-simulation.v1`)
      sessionStorage.removeItem('nexusport.gate-passage-simulation.v1')
    } catch (_) {}
  }

  const nextVehicle=async()=>{
    if (simulationLockRef.current) return
    try{
      if(barrierState!=='closed')await commandBarrier('close','automatic')
      setProcessingStatus('idle');setActiveBooking(null);setPassageEvidence(null)
      setDetectedPlate('');setCapturedImage(null);setAiCropImage(null)
    }catch(error){showToast(`Chưa thể chuyển xe tiếp theo: ${error.message}`)}
  }

  // ── 4. ĐỐI SOÁT QUA RULE ENGINE BACKEND & TỰ ĐỘNG TỪ CHỐI NẾU THẤT BẠI ─────────────────────────
  const evaluateVerification = async (plate, currentConfidence = 98, overviewImg = null, plateImg = null, manual = false, scan = {}) => {
    if (!plate || !plate.trim()) return
    const scanMode = scan.mode || mode
    const inbound = scanMode === 'checkin'
    const activeGate = scan.gate || selectedGate
    const gateCode = inbound ? 'GATE-01' : activeGate?.code === 'GATE_OUT' ? 'GATE-02' : activeGate?.code
    // Chỉ chờ cảm biến barie khi ESP32 thật sự đang kết nối. Nếu không có thiết bị (lệnh barie ở chế độ mô phỏng),
    // dùng đếm ngược mô phỏng để tự ghi nhận xe qua cổng, kể cả khi lượt quét đến từ camera / thiết bị nhận diện.
    const physical = inbound && Boolean(hwStatus?.esp32?.connected)
    if (!activeGate || gateError) { showToast('Vui lòng chọn cổng thực tế đang hoạt động trước khi xác minh.'); return }
    if (barrierState === 'opened' || barrierState === 'opening') return // Cổng đang mở: giữ nguyên, không quét lại làm giật servo
    if (verificationInFlightRef.current || simulationLockRef.current || verificationBusy || gateOutBusy ||
      barrierInFlightRef.current || physicalPassagePending) return
    if(manual&&!manualReason.trim()){showToast('Nhập lý do xác minh thủ công (ví dụ: mưa, camera không đọc được biển số).');return}
    verificationInFlightRef.current = true
    setPassageEvidence(null)
    setVerificationBusy(true)

    const trimmedPlate = formatPlateNumber(plate)
    setDetectedPlate(trimmedPlate)
    setConfidence(currentConfidence)

    const finalOverviewImg = overviewImg || capturedImage || null
    const finalPlateImg = plateImg || aiCropImage || null

    if (finalOverviewImg && !capturedImage) setCapturedImage(finalOverviewImg)
    if (finalPlateImg && !aiCropImage) setAiCropImage(finalPlateImg)

    showToast(`Đang đối soát thông tin xe "${trimmedPlate}"...`)

    try {
      const selectedBooking = manual && selectedEntry && normalizePlate(selectedEntry.vehiclePlate) === normalizePlate(trimmedPlate)
        ? selectedEntry.bookingCode : undefined
      const admission = inbound ? await gateService.authorizeEntry({
        gateCode, vehiclePlate: trimmedPlate, bookingCode: selectedBooking,
      }) : null
      const verifyRes = await gateService.verifyGateScan({
        gateCode,
        laneCode: 'LANE_01',
        detectedVehiclePlate: trimmedPlate,
        vehicleDetected: true,
        plateConfidence: currentConfidence / 100,
        verificationType: `${manual?'MANUAL':'AI'}_GATE_${inbound?'IN':'OUT'}`,
        manualReason:manual?manualReason.trim():undefined,
        bookingNumber: admission?.bookingCode || selectedBooking,
        overviewImageUrl: finalOverviewImg,
        vehiclePlateImageUrl: finalPlateImg,
      })

      if (verifyRes.success && verifyRes.data) {
        const result = verifyRes.data
        const isPass = result.status === 'PASS' && Boolean(result.recordId)

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
            licensePlate: trimmedPlate,
            status: 'Approved',
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
            gate: `${gateCode} · Làn 01`,
            etaDisplay: bkg?.validFrom
              ? `${new Date(bkg.validFrom).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(bkg.validTo).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
              : 'Trong khung giờ hợp lệ',
            sealNumber: matchedFull?.containers?.[0]?.sealNumber || 'Chưa cập nhật',
          }
          if (!bookingData.id) throw new Error('Booking không có mã định danh hợp lệ. Không thể ghi nhận qua cổng.')
          const evidence={
            verificationRecordId: result.recordId,
            gateCode,
            laneCode: 'LANE_01',
            vehiclePlate: trimmedPlate,
            bookingNumber: bookingData.bookingCode,
            containerNumber: bookingData.containerId,
            physical,
            notes: manual ? manualReason.trim() : undefined,
          }
          const simulator = getGatePassageSimulation()
          if (simulator.pending()) {
            simulator.clear?.()
          }
          await commandBarrier('open', manual ? 'manual' : 'automatic', result.recordId, undefined, activeGate, physical)
          setPassageEvidence(evidence)
          setActiveBooking(bookingData)
          setProcessingStatus('passed')
          setRejectionReason('')
          if (!physical) {
            const gateInfo = { id: activeGate.id, code: gateCode }
            void simulator.start({ mode: scanMode, gate: gateInfo,
              booking: bookingData, evidence, closeRequestId: crypto.randomUUID() }, gateOpenSeconds).catch(() => {})
          }
          showToast(physical ? 'Đã gửi lệnh mở barie tới ESP32.' : `Đã mô phỏng mở barie ${gateCode}.`)
        } else {
          // 🚫 KIỂM TRA SAI: Không tìm thấy booking hoặc điều kiện không hợp lệ
          setActiveBooking(null)
          setProcessingStatus('rejected')
          const reason = result.message || result.failureReason || `Biển số "${plate}" không có thông tin đăng ký hợp lệ trong hệ thống`
          setRejectionReason(reason)
          setIncidentNote(reason)
          showToast(`⛔ TỰ ĐỘNG TỪ CHỐI VÀO CỔNG — ${reason}`)
        }
      } else {
        // Backend API trả về lỗi hoặc không tìm thấy
        setActiveBooking(null)
        setProcessingStatus('rejected')
        const reason = verifyRes.error || `Biển số "${plate}" không khớp bất kỳ thông tin đăng ký nào trong hệ thống`
        setRejectionReason(reason)
        setIncidentNote(reason)
        showToast(`⛔ TỰ ĐỘNG TỪ CHỐI VÀO CỔNG — ${reason}`)
      }
    } catch (err) {
      setActiveBooking(null)
      setProcessingStatus('rejected')
      const reason = err.message
      setRejectionReason(reason)
      showToast(`⛔ ${reason}`)
    } finally {
      verificationInFlightRef.current = false
      setVerificationBusy(false)
    }
  }

  const evaluateVerificationRef = useRef(evaluateVerification)
  const gateLocationsRef = useRef(gateLocations)
  useEffect(() => {
    evaluateVerificationRef.current = evaluateVerification
    gateLocationsRef.current = gateLocations
  })

  const confirmPhysicalPassage = async () => {
    if (!passageEvidence?.physical || passageBusy) return
    setPassageBusy(true)
    try {
      const result = await gateService.recordPassageIn(passageEvidence)
      if (!result?.success) throw new Error(result?.message || 'Chưa ghi nhận xe qua cổng.')
      setProcessingStatus('checked-in')
      showToast('Đã ghi nhận xe qua cổng vào.')
    } catch (error) {
      showToast(error.message)
    } finally {
      setPassageBusy(false)
    }
  }

  // Xử lý một lượt quét biển số (từ Socket.IO của dịch vụ AI hoặc từ cổng USB + webcam trong trình duyệt)
  const processIotScan = async (eventData) => {
    console.log('📡 [IoT Camera Event Received]', eventData)
    const plate = eventData?.detectedPlate ? eventData.detectedPlate.trim().toUpperCase() : ''
    if (!plate || eventData.vehicleDetected === false) return
    // Camera chưa đọc được biển số: không đối soát, chỉ nhắc nhân viên để tránh báo lỗi và khóa cổng oan.
    if (plate === 'KHÔNG_NHẬN_DIỆN' || eventData.decision === 'FAIL') {
      showToast('Chưa đọc được biển số. Đưa xe vào đúng vị trí và chạm cảm biến lại.')
      return
    }

    const isOutbound = eventData?.laneCode === 'LANE_02' || eventData?.gateCode === 'GATE_OUT' || eventData?.gateCode === 'GATE_OUT_A' || String(eventData?.lane).toUpperCase() === 'OUT'
    const targetMode = isOutbound ? 'checkout' : 'checkin'

    // Đồng bộ đúng tab làn xe tương ứng với cảm biến kích hoạt
    setMode(targetMode)
    const matchingGate = gateLocationsRef.current.find(g => g.isActive !== false && g.gateType === (isOutbound ? 'gate_out' : 'gate_in'))
    if (matchingGate) {
      setSelectedGateId(matchingGate.id)
    }

    const conf = eventData.plateConfidence ? eventData.plateConfidence * 100 : 98
    const overview = eventData.overviewImageUrl || null
    const crop = eventData.vehiclePlateImageUrl || null

    setDetectedPlate(plate)
    setConfidence(conf)
    if (overview) setCapturedImage(overview)
    if (crop) setAiCropImage(crop)

    // Bắt được biển số là tự đối chiếu booking / lệnh vào cổng; chỉ khi xác minh thành công mới gửi lệnh mở (servo xoay).
    showToast(`🚗 [${isOutbound ? 'CỔNG RA' : 'CỔNG VÀO'}] Nhận diện biển số: "${plate}" (${conf.toFixed(1)}%)`)
    setIsAiScanning(true)
    try {
      await evaluateVerificationRef.current?.(plate, conf, overview, crop, false, {
        mode: targetMode, gate: matchingGate, physical: !isOutbound,
      })
    } finally {
      setIsAiScanning(false)
    }
  }
  const processIotScanRef = useRef(processIotScan)
  useEffect(() => { processIotScanRef.current = processIotScan })

  // ── LẮNG NGHE SỰ KIỆN QUÉT XE TỪ THIẾT BỊ IOT QUA REALTIME SOCKET.IO ──
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

    socket.on('gate:iot_scan', (eventData) => { void processIotScanRef.current?.(eventData) })

    socket.on('gate:barrier_state_changed', (data) => {
      console.log('📡 [Barrier State Event Received]', data)
      const currentTargetLane = modeRef.current === 'checkout' ? 'OUT' : 'IN'
      if (data?.lane === currentTargetLane) {
        setBarrierState(data.state)
        if (data.state === 'closed') {
          showToast(`🔒 Barie ${data.lane === 'OUT' ? 'Cổng Ra' : 'Cổng Vào'} đã hạ (đóng cổng).`)
        } else if (data.state === 'opened') {
          showToast(`🔓 Barie ${data.lane === 'OUT' ? 'Cổng Ra' : 'Cổng Vào'} đã mở.`)
        }
      }
    })

    return () => {
      socket.off('gate:iot_scan')
      socket.off('gate:barrier_state_changed')
      if (socket.connected) {
        socket.disconnect()
      } else {
        socket.once('connect', () => socket.disconnect())
      }
    }
  }, [])


  // ── CỔNG USB (Web Serial) VÀ WEBCAM TRONG TRÌNH DUYỆT ───────────────────
  const refreshHardware = () => {
    gateService.getHardwareStatus().then(res => { if (res.success) setHwStatus(res.data) })
  }

  const handleSerialCapture = async (lane) => {
    if (serialScanBusyRef.current) return
    serialScanBusyRef.current = true
    setIsAiScanning(true)
    try {
      showToast('📸 Cảm biến báo có xe, đang chụp ảnh…')
      const blob = await browserCamera.captureBlob()
      if (!blob) { showToast('Webcam chưa cho hình. Kiểm tra quyền camera hoặc chương trình khác đang dùng webcam.'); return }
      const gateCode = lane === 'OUT' ? 'GATE_OUT_A' : 'GATE_IN_A'
      const laneCode = lane === 'OUT' ? 'LANE_02' : 'LANE_01'
      const overview = await new Promise(resolve => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.readAsDataURL(blob) })
      const res = await gateService.recognizeVehicleImage(blob, gateCode, laneCode)
      const plateObj = res.success ? res.data?.license_plate : null
      const plate = plateObj?.plate_number || ''
      if (!res.success) showToast(`Không đọc được biển số: ${res.error}`)
      await processIotScanRef.current?.({
        gateCode, laneCode, lane, cameraId: 'CAM_BROWSER',
        detectedPlate: plate,
        plateConfidence: plateObj?.ocr_confidence || plateObj?.confidence || 0,
        vehicleDetected: res.data?.vehicle?.detected !== false,
        overviewImageUrl: overview,
        vehiclePlateImageUrl: plateObj?.plate_image_base64 || null,
        source: 'Browser_USB',
        decision: plate ? 'SUCCESS' : 'FAIL',
      })
    } finally {
      serialScanBusyRef.current = false
      setIsAiScanning(false)
    }
  }

  const handleSerialLine = (line) => {
    if (line === 'CAPTURE_IN' || line === 'CAPTURE_OUT') {
      void handleSerialCapture(line.endsWith('OUT') ? 'OUT' : 'IN')
      return
    }
    const m = /^STATUS:(OPENED|CLOSED)_(IN|OUT)/i.exec(line)
    if (m) {
      const state = m[1].toUpperCase() === 'OPENED' ? 'opened' : 'closed'
      const lane = m[2].toUpperCase()
      if (lane === (modeRef.current === 'checkout' ? 'OUT' : 'IN')) {
        setBarrierState(state)
        showToast(state === 'opened' ? `🔓 Barie ${lane === 'OUT' ? 'Cổng Ra' : 'Cổng Vào'} đã mở.` : `🔒 Barie ${lane === 'OUT' ? 'Cổng Ra' : 'Cổng Vào'} đã hạ (đóng cổng).`)
      }
      // Báo backend để các màn hình khác cùng cập nhật trạng thái barie
      apiClient.post('/gate/barrier-status', { lane, state, gateCode: lane === 'OUT' ? 'GATE_OUT_A' : 'GATE_IN_A' }).catch(() => {})
    }
  }
  const handleSerialLineRef = useRef(handleSerialLine)
  useEffect(() => { handleSerialLineRef.current = handleSerialLine })

  useEffect(() => {
    const offState = webSerialGate.onState(({ connected }) => {
      setDeviceConnected(connected)
      showToast(connected ? '🔌 Đã kết nối ESP32 qua USB.' : 'ESP32 đã ngắt kết nối USB.')
      refreshHardware()
    })
    const offCamera = browserCamera.onChange(stream => {
      setBrowserStream(stream)
      if (stream) { setCameraActive(true); setCameraLoading(false); setCameraError(null) }
      refreshHardware()
    })
    const offLine = webSerialGate.onLine(line => handleSerialLineRef.current?.(line))
    // Cắm lại vào máy đã từng cấp quyền: tự kết nối, không cần bấm
    void webSerialGate.reconnect().then(ok => { if (ok) browserCamera.start().catch(() => {}) })
    return () => { offState(); offCamera(); offLine() }
  }, [])

  const connectDevice = async () => {
    setDeviceBusy(true)
    try {
      const ok = await webSerialGate.connect()
      if (ok) {
        try { await browserCamera.start() } catch (error) { showToast(`Chưa mở được webcam: ${error.message}`) }
      }
    } catch (error) {
      showToast(error.message || 'Không kết nối được thiết bị USB.')
    } finally {
      setDeviceBusy(false)
    }
  }

  const disconnectDevice = async () => {
    await webSerialGate.disconnect()
    browserCamera.stop()
  }

  // Danh sách checklist kiểm tra
  const normDetected = normalizePlate(detectedPlate)
  const normBooking = normalizePlate(activeBooking?.licensePlate)
  const plateMatch = Boolean(normDetected && normDetected === normBooking)

  const serverPassed = ['passed', 'checked-in'].includes(processingStatus)
  const checklist = [
    { id: 'plate', label: 'Biển số xe khớp với thông tin đăng ký', ok: plateMatch },
    { id: 'booking', label: 'Lệnh đã được Điều độ phê duyệt', ok: ['Approved', 'Checked-in', 'Đã ra cổng'].includes(activeBooking?.status) },
    { id: 'driver', label: 'Giấy phép lái xe còn hiệu lực sử dụng', ok: activeBooking?.licenseStatus === 'Valid' },
    { id: 'container', label: 'Mã container khớp với đăng ký', ok: Boolean(activeBooking?.containerId) },
    { id: 'time', label: 'Khung giờ tiếp cận hợp lệ', ok: true },
    { id: 'state', label: mode === 'checkout' ? 'Đã hoàn tất thủ tục giao nhận tại bãi' : 'Chưa hoàn tất thủ tục vào cổng', ok: true },
  ].map(item => ({ ...item, ok: serverPassed ? item.ok : null }))

  const allValid = checklist.every((c) => c.ok)
  const modeLane = mode === 'checkout' ? 'OUT' : 'IN'
  const scanStatus = hwStatus?.scan_status || {}
  const cameraLane = scanStatus.state === 'CAPTURING' ? scanStatus.lane : modeLane
  const cameraHardware = cameraLane === 'OUT' ? hwStatus?.camera_out : hwStatus?.camera_in
  const cameraConnected = Boolean(cameraHardware?.connected)
  const sensorConnected = Boolean(hwStatus?.esp32?.connected)
  const scanStatusText = isAiScanning
    ? 'Đang đối soát kết quả xe'
    : scanStatus.state === 'CAPTURING'
      ? `Đang chụp ảnh làn ${scanStatus.lane}`
      : scanStatus.state === 'PROCESSING'
        ? `Đang nhận diện làn ${scanStatus.lane}`
        : sensorConnected ? 'Đang chờ cảm biến' : 'Cảm biến chưa kết nối'
  const cameraStatusText = cameraLoading
    ? 'Đang kết nối'
    : cameraActive && cameraConnected ? 'Đang trực tiếp' : cameraActive ? 'Đang khởi động' : 'Ngoại tuyến'

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
      gateCode: selectedGate?.code,
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
      {/* ── HEADER & SERVICE STATUS BAR ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200 px-3 py-0.5 rounded-full">
              Nhân viên cổng
            </span>
            <span className={`text-xs font-bold px-3 py-0.5 rounded-full border flex items-center gap-1.5 transition-all ${
              iotConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${iotConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {iotConnected ? 'Trực tuyến' : 'Đang kết nối...'}
            </span>
            <span className={`text-xs font-bold px-3 py-0.5 rounded-full border flex items-center gap-1.5 transition-all ${
              hwStatus?.esp32?.connected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${hwStatus?.esp32?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              {hwStatus?.esp32?.connected ? `ESP32 (${hwStatus.esp32.port}): Sẵn sàng` : 'ESP32: Đang kết nối...'}
            </span>
            {webSerialGate.isSupported() && (deviceConnected ? (
              <button
                type="button"
                onClick={disconnectDevice}
                title="Ngắt kết nối ESP32 và webcam trong trình duyệt"
                className="text-xs font-bold px-3 py-0.5 rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Ngắt thiết bị USB
              </button>
            ) : (
              <button
                type="button"
                onClick={connectDevice}
                disabled={deviceBusy}
                title="Kết nối ESP32 qua cổng USB của máy này và dùng webcam trong trình duyệt (Chrome / Edge). Không cần chạy dịch vụ AI."
                className="text-xs font-bold px-3 py-0.5 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer disabled:opacity-60"
              >
                {deviceBusy ? 'Đang kết nối…' : 'Kết nối thiết bị (USB)'}
              </button>
            ))}
          </div>
        </div>

        {/* Nút điều hướng Mode & Cổng kiểm soát */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                try {
                  getGatePassageSimulation().clear()
                } catch (_) {}
                simulationLockRef.current = false
                setMode('checkin')
                setProcessingStatus('idle')
                setBarrierState('closed')
                setPassageEvidence(null)
                setDetectedPlate('')
                setActiveBooking(null)
                setSimulation(null)
                setVerificationBusy(false)
                setIsAiScanning(false)
              }}
              className={`px-4 py-2.5 transition-all cursor-pointer ${
                mode === 'checkin'
                  ? 'bg-orange-500 text-white font-black shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cổng Vào
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  getGatePassageSimulation().clear()
                } catch (_) {}
                simulationLockRef.current = false
                setMode('checkout')
                setProcessingStatus('idle')
                setBarrierState('closed')
                setPassageEvidence(null)
                setDetectedPlate('')
                setActiveBooking(null)
                setSimulation(null)
                setVerificationBusy(false)
                setIsAiScanning(false)
              }}
              className={`px-4 py-2.5 transition-all cursor-pointer ${
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

      {/* ── MAIN CONTENT (2 CỘT) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ══ CỘT TRÁI (7 cols): CAMERA MÁY + HUD NHẬN DIỆN ══ */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Thanh điều khiển Camera làn xe */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-3 h-3 rounded-full ${
                  cameraActive && cameraConnected ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500' : 'bg-slate-400'
                }`}
              ></span>
              <div>
                <span className="text-xs font-bold text-slate-800 tracking-wide block">
                  Camera · {selectedGate?.code || 'Chưa chọn cổng'} — {mode === 'checkin' ? 'Làn Vào' : 'Làn Ra'}
                </span>
                <span className="text-[10px] text-slate-500">Tự bật khi vào trang; chỉ cảm biến mới kích hoạt quét.</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-bold">
            <span className={`rounded-full border px-2.5 py-1 ${cameraActive && cameraConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
              Camera: {cameraStatusText}
            </span>
            <span className={`rounded-full border px-2.5 py-1 ${sensorConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
              Cảm biến: {sensorConnected ? 'Đã kết nối' : 'Chưa kết nối'}
            </span>
            <span className={`rounded-full border px-2.5 py-1 ${scanStatus.state === 'CAPTURING' || scanStatus.state === 'PROCESSING' || isAiScanning ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
              {scanStatusText}
            </span>
          </div>

          {/* Khung hiển thị camera từ AI Service dùng chung với bộ quét cảm biến */}
          <div className="relative aspect-video rounded-2xl overflow-hidden shadow-xl border-2 border-slate-800 bg-[#070b14] flex items-center justify-center">
            {browserStream && (
              <video
                ref={el => { if (el && el.srcObject !== browserStream) el.srcObject = browserStream; browserCamera.attach(el) }}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            {!browserStream && cameraActive && cameraConnected && (
              <img
                src={`${gateService.getVideoFeedUrl(cameraLane)}&t=gate-control`}
                alt={`Camera ${cameraLane === 'OUT' ? 'làn ra' : 'làn vào'}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
          </div>


          {/* Banner Báo lỗi Camera nếu có */}
          {cameraError && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">⚠️ {cameraError}</div>}

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
            <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-blue-600">directions_car</span>
                Kết Quả Nhận Diện Biển Số
              </span>
              <div className="flex items-center gap-2">
                {detectedPlate ? (
                  <span
                    className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                      confidence > 85
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                    }`}
                  >
                    Độ chính xác: {confidence.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full border bg-slate-100 text-slate-600 border-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Chờ cảm biến kích hoạt lượt quét
                  </span>
                )}
              </div>
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
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Biển số nhận diện từ camera</span>
                    </div>
                  </div>

                  {/* Cột Phải: Trạng thái đối soát */}
                  <div className="flex flex-col sm:items-end justify-center">
                    <div
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 border shadow-2xs ${
                        processingStatus === 'passed'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : processingStatus === 'rejected'
                            ? 'bg-rose-100 text-rose-900 border-rose-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">
                        {processingStatus === 'passed' ? 'verified' : processingStatus === 'rejected' ? 'cancel' : 'hourglass_top'}
                      </span>
                      <span>{serverPassed ? 'Lệnh vào cổng hợp lệ' : processingStatus === 'rejected' ? 'Chưa được cấp quyền qua cổng' : verificationBusy ? 'Đang đối soát…' : 'Chờ xác minh'}</span>
                    </div>
                    <span className={`text-[11px] mt-1.5 font-medium ${processingStatus === 'passed' ? 'text-emerald-700' : processingStatus === 'rejected' ? 'text-rose-600' : 'text-amber-700'}`}>
                      {processingStatus === 'passed'
                        ? 'Hệ thống tự động kích hoạt mở barie'
                        : processingStatus === 'rejected'
                          ? rejectionReason || 'Vui lòng kiểm tra lại thông tin xe'
                          : 'Đã nhận biển số, nhân viên cổng bấm xác minh để đối soát với lệnh vào cổng'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border border-dashed border-slate-300">
                  <div className="relative bg-slate-50 border-2 border-slate-300/80 rounded-lg px-7 py-2.5 shadow-2xs flex items-center justify-center font-mono font-black text-xl tracking-widest text-slate-300 select-none">
                    <span className="absolute left-2 w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    <span>••• • - •••.••</span>
                    <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5 text-xs font-medium text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                    <span>Chờ phương tiện tiến vào vị trí quét camera...</span>
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
                    className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
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
              <div className="text-center text-[10px] font-medium text-slate-500 pt-0.5">
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
                    className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
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
              <div className="text-center text-[10px] font-medium text-slate-500 pt-0.5">
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
                  <h3 className="text-sm font-bold tracking-wide uppercase text-slate-900 flex items-center gap-1.5">
                    Trạng thái Barie {selectedGate?.code}
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium block">
                    {mode === 'checkin' ? 'Làn Vào' : 'Làn Ra'}
                  </span>
                </div>
              </div>

              {/* Badge trạng thái Barie: Nổi bật, cực kỳ rõ ràng */}
              <div
                className="px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider flex items-center gap-2 shadow-xs transition-all"
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
              {/* Vạch sơn mặt đường */}
              <div className="absolute inset-x-0 bottom-0 h-3 bg-slate-950 border-t border-slate-800"></div>

              {/* Trụ Barie công nghiệp */}
              <div
                className="w-8 h-18 rounded-t-lg flex flex-col items-center justify-center py-1.5 z-10 shadow-2xl relative"
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
              className="py-3 px-4 rounded-xl text-center font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
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
                  ? 'Cổng đang mở — Cho phép phương tiện qua cổng'
                  : barrierState === 'opening'
                  ? 'Đang chờ ESP32 báo mở barie'
                  : processingStatus === 'rejected'
                  ? 'Cổng đang khóa — Xe không đủ điều kiện'
                  : 'Cổng đang đóng'}
              </span>
            </div>

            {/* Phím điều khiển Barie nhanh (Gate Officer Controls) */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <span className="text-[11px] text-slate-600 font-bold">
                Điều khiển thủ công:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void manualBarrier('open')}
                  disabled={barrierState === 'opened'}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                  title="Mở barie cho xe qua"
                >
                  <span className="material-symbols-outlined text-sm">lock_open</span>
                  Mở barie
                </button>
                <button
                  type="button"
                  onClick={() => void manualBarrier('close')}
                  disabled={barrierState === 'closed'}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                  title="Hạ barie đóng cổng"
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
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
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
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-between shadow-md transition-all cursor-pointer group"
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
              <div className="text-[10px] text-slate-500 flex items-center justify-between">
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
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold">
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
                        : c.ok === false
                        ? 'text-rose-600'
                        : 'text-slate-300'
                    }`}
                  >
                    {c.ok ? 'check_circle' : c.ok === false ? 'cancel' : 'radio_button_unchecked'}
                  </span>
                  <span
                    className={
                      c.ok
                        ? 'text-emerald-950 font-semibold'
                        : c.ok === false
                        ? 'text-rose-950 font-bold'
                        : 'text-slate-600'
                    }
                  >
                    {c.label}{c.ok === null ? ' · Chưa xác nhận' : ''}
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
                  ? (mode === 'checkin' ? 'Xác minh thành công — Đã mở barie' : 'Sẵn sàng mở cổng cho xe xuất cảng')
                  : processingStatus === 'rejected'
                  ? 'Không hợp lệ — Cổng đang khóa'
                  : 'Chờ phương tiện'}
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
                {mode === 'checkin' ? 'Đã ghi nhận xe qua cổng vào' : 'Đã ghi nhận xe qua cổng ra'}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => void nextVehicle()}
                  disabled={barrierBusy||gateOutBusy||verificationBusy}
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
                    Xe chưa được cấp quyền qua cổng. Kiểm tra trạng thái barie và gửi sự cố cho điều độ khi cần.
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
                  }}
                  className="h-13 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl">refresh</span>
                  Chờ lượt cảm biến tiếp theo
                </button>
              </div>
            </div>
          ) : processingStatus === 'passed' && passageEvidence?.physical ? (
            <button type="button" disabled={passageBusy} onClick={() => void confirmPhysicalPassage()}
              className="w-full px-4 py-3 rounded-xl bg-emerald-700 text-white font-semibold disabled:opacity-50">
              {passageBusy ? 'Đang ghi nhận…' : 'Xác nhận xe đã qua cổng'}
            </button>
          ) : mode === 'checkin' && detectedPlate && processingStatus === 'idle' ? (
            <div className="w-full px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold text-center">
              Hệ thống đang tự động đối soát biển số với booking…
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
                disabled={barrierBusy||verificationBusy||gateOutBusy}
                onClick={async () => {
                  try{
                    await commandBarrier('close','manual',passageEvidence?.verificationRecordId,`Từ chối xe ${detectedPlate||activeBooking?.licensePlate}: ${incidentNote||rejectionReason||'Nhân viên cổng yêu cầu dừng kiểm tra.'}`)
                    setShowRejectModal(false);setProcessingStatus('rejected');setPassageEvidence(null)
                    showToast(`Đã đóng barie, từ chối xe ${detectedPlate||activeBooking?.licensePlate}.`)
                  }catch(error){showToast(error.message)}
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
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Vị trí xảy ra:</span>
                <strong className="text-slate-900">{selectedGate?.code} · {mode === 'checkin' ? 'Làn Vào' : 'Làn Ra'}</strong>
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
                <Select
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
                </Select>
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
                <span className="text-xs font-bold text-slate-200">
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
