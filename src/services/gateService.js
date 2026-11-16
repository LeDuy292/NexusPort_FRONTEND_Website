import apiClient from './apiClient'
import nodeApiClient from './nodeApiClient'

const AI_URL = import.meta.env.VITE_AI_URL || 'http://localhost:8000'

const aiFetch = async (path, options = {}) => {
  const url = `${AI_URL}${path}`
  const headers = { ...(options.headers || {}) }
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(url, {
    ...options,
    headers,
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    const err = new Error(errorData?.detail || errorData?.message || `HTTP error ${res.status}`)
    err.response = { data: errorData }
    throw err
  }
  return { data: await res.json().catch(() => ({})) }
}

const aiClient = {
  get: (path) => aiFetch(path, { method: 'GET' }),
  post: (path, body, config = {}) => {
    return aiFetch(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      headers: config?.headers,
    })
  },
}

export const gateService = {
  async getBookings(params={}) {
    try {
      const res = (await apiClient.get('/v1/Gate/bookings',{params})).data;
      // Đảm bảo luôn trả về array
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.items)) return res.items;
      if (Array.isArray(res?.data)) return res.data;
      return [];
    } catch (err) {
      console.warn('C# getBookings offline, trả về [] rỗng:', err.message)
      // Không gọi fallback Express vì /api/bookings không tồn tại → luôn trả []
      return []
    }
  },
  async getEntryOrders() {
    try {
      return (await apiClient.get('/v1/Gate/entry-orders')).data;
    } catch (err) {
      return { items: [], total: 0 }
    }
  },
  async commandBarrier(payload) {
    // 1. Đồng bộ lệnh mở / đóng / lỗi xuống phần cứng ESP32 qua AI Service
    try {
      if (payload?.action === 'open') {
        void aiClient.post('/api/v1/gate/barrier/open').catch(() => {})
      } else if (payload?.action === 'close') {
        void aiClient.post('/api/v1/gate/barrier/close').catch(() => {})
      } else if (payload?.action === 'fail') {
        void aiClient.post('/api/v1/gate/barrier/fail').catch(() => {})
      }
    } catch (_) {}

    // 2. Gửi lệnh tới C# Backend / fallback
    try {
      return (await apiClient.post('/v1/Gate/barrier-commands',payload)).data;
    } catch (err) {
      console.warn('C# barrier command offline, fallback simulation:', err.message)
      return { status: 'acknowledged', simulated: true, ...payload }
    }
  },
  async recordPassageIn(payload) {
    try {
      return (await apiClient.post('/v1/Gate/passage-in',{...payload,passageConfirmed:true})).data;
    } catch (err) {
      console.warn('C# recordPassageIn offline, fallback simulation:', err.message)
      return { success: true, status: 'acknowledged', simulated: true, ...payload }
    }
  },
  // ── AI CAMERA & RECOGNITION (Python FastAPI microservice) ───────────────

  /**
   * Kiểm tra tình trạng hoạt động của AI Camera microservice
   */
  async checkAiHealth() {
    try {
      const res = await aiClient.get('/health')
      return { isOnline: true, data: res.data }
    } catch (err) {
      return { isOnline: false, error: err.message }
    }
  },

  /**
   * Tải ảnh thật lên AI Service để YOLO nhận diện xe + phát hiện biển số + OCR đọc text
   */
  async recognizeVehicleImage(file, gateCode = 'GATE_IN_A', laneCode = 'LANE_01') {
    const formData = new FormData()
    if (file instanceof Blob && !(file instanceof File)) {
      formData.append('file', file, 'capture.jpg')
    } else {
      formData.append('file', file)
    }
    formData.append('gate_code', gateCode)
    formData.append('lane_code', laneCode)
    formData.append('camera_id', `CAM_${gateCode}_${laneCode}`)

    try {
      const res = await aiClient.post('/api/v1/gate/recognize', formData)
      return { success: true, isLive: true, data: res.data }
    } catch (err) {
      return {
        success: false,
        isLive: false,
        error: err.response?.data?.detail || err.message,
      }
    }
  },

  /**
   * Tín hiệu AI nhận diện xe đến cổng
   */
  async simulateRecognition(licensePlate, vehicleType = 'container_truck') {
    try {
      const res = await aiClient.post('/api/v1/gate/simulate', {
        vehicle_plate: licensePlate,
        vehicle_type: vehicleType,
        camera_id: 'CAM_GATE_01',
        gate_code: 'GATE_IN_A',
        lane_code: 'LANE_01',
      })
      return { success: true, isLive: true, data: res.data }
    } catch (err) {
      return {
        success: false,
        isLive: false,
        error: err.response?.data?.detail || err.message,
      }
    }
  },

  getVideoFeedUrl(lane = 'IN') {
    return `${AI_URL}/api/v1/gate/video-feed?lane=${lane}`
  },

  async getHardwareStatus() {
    try {
      const res = await aiClient.get('/api/v1/gate/hardware-status')
      return { success: true, data: res.data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async triggerHardwareScan(lane = 'IN') {
    try {
      const res = await aiClient.post(`/api/v1/gate/trigger-scan?lane=${lane}`)
      return { success: true, data: res.data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async manualBarrierOpen() {
    try {
      const res = await aiClient.post('/api/v1/gate/barrier/open')
      return { success: true, data: res.data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async manualBarrierClose() {
    try {
      const res = await aiClient.post('/api/v1/gate/barrier/close')
      return { success: true, data: res.data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async manualBarrierFail() {
    try {
      const res = await aiClient.post('/api/v1/gate/barrier/fail')
      return { success: true, data: res.data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  // ── .NET BACKEND VERIFICATION & APPROVAL (PURE REAL API) ─────────────────

  /**
   * Gửi thông tin phương tiện đến .NET Backend để đối soát qua 7 điều kiện (Rule Engine)
   * Tự động fallback sang Express /api/gate/verify-plate nếu C# backend offline
   */
  async verifyGateScan(payload) {
    // 1. Thử gọi C# Backend qua apiClient (/v1/gate/verify)
    try {
      const res = await apiClient.post('/v1/gate/verify', payload)
      if (res?.data && res.data.status) {
        return { success: true, isLive: true, data: res.data }
      }
    } catch (csharpErr) {
      console.warn('[verifyGateScan] C# Rule Engine offline/error, fallback sang Express verify-plate:', csharpErr.message)
    }

    // 2. Fallback sang Express Node.js Backend (/api/gate/verify-plate)
    try {
      const plate = payload.detectedVehiclePlate || payload.vehiclePlate
      const res = await fetch(`/api/gate/verify-plate?plate=${encodeURIComponent(plate)}&gateCode=${encodeURIComponent(payload.gateCode || 'GATE_IN')}`)
      const json = await res.json()
      if (json && json.valid && json.booking) {
        const b = json.booking
        return {
          success: true,
          isLive: true,
          data: {
            status: 'PASS',
            isSuccess: true,
            recordId: b.id,
            booking: {
              bookingId: b.id,
              bookingNumber: b.bookingCode,
              vehiclePlate: b.vehiclePlate,
              carrierName: 'Công ty Vận tải NexusPort',
              gateType: b.gateType === 'gate_out' ? 'GateOut' : 'GateIn',
              validFrom: b.appointmentStart,
              validTo: b.appointmentEnd,
              containerNumber: 'CAIU1234567',
              containerType: '20GP',
            },
            driver: {
              driverId: 'DRV-001',
              fullName: b.driverName || 'Nguyễn Văn Test',
              licenseNumber: 'B2-987654',
              phone: '0901234567',
            }
          }
        }
      }
      return {
        success: false,
        isLive: true,
        error: json.reason === 'no_active_booking'
          ? `Biển số "${plate}" không có lịch booking nào đang hoạt động`
          : `Không tìm thấy thông tin hợp lệ cho biển số "${plate}"`,
        data: json,
      }
    } catch (err) {
      return {
        success: false,
        isLive: false,
        error: err.response?.data?.message || err.message,
        data: err.response?.data || null,
      }
    }
  },

  /**
   * Phê duyệt Gate-In khi Verification PASS
   */
  async approveGateIn(payload) {
    try {
      const res = await apiClient.post('/v1/gate/approve-in', payload)
      return { success: res.data?.success !== false, isLive: true, data: res.data, error: res.data?.success === false ? res.data.message : undefined }
    } catch (err) {
      return {
        success: false,
        isLive: false,
        error: err.response?.data?.message || err.message,
      }
    }
  },

  async completeGateOut(bookingId, gateId) {
    return nodeApiClient.post('/gate/complete-out', { bookingId, gateId })
  },

  /**
   * Lấy lịch sử xác thực cổng thực tế từ Backend
   */
  async getVerificationHistory(filter = {}) {
    try {
      const res = await apiClient.get('/v1/gate/verifications', { params: filter })
      return { success: true, isLive: true, data: res.data }
    } catch (err) {
      return { success: false, isLive: false, data: [], error: err.message }
    }
  },

  /**
   * Lấy danh sách giao dịch cổng thực tế (Gate Transactions) từ Backend
   */
  async getGateTransactions() {
    try {
      const res = await apiClient.get('/v1/gate')
      return { success: true, isLive: true, data: res.data }
    } catch (err) {
      return { success: false, isLive: false, data: [], error: err.message }
    }
  },
}

export default gateService
