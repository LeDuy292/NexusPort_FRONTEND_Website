import apiClient from './apiClient'
import nodeApiClient from './nodeApiClient'

// Địa chỉ dịch vụ AI / phần cứng. Mặc định theo cấu hình build (thường là dịch vụ trên cloud).
// Máy tại cổng có cắm ESP32/webcam đặt khóa này để dùng dịch vụ chạy ngay trên máy đó (http://localhost:8000).
const AI_URL_KEY = 'nexusport_ai_url'
const LOCAL_AI_URL = 'http://localhost:8000'
const readAiOverride = () => {
  try { return (localStorage.getItem(AI_URL_KEY) || '').trim().replace(/\/+$/, '') } catch { return '' }
}
const AI_URL = readAiOverride() || import.meta.env.VITE_AI_URL || LOCAL_AI_URL
export const hardwareSource = {
  url: AI_URL,
  isOverridden: Boolean(readAiOverride()),
  isLocal: /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(AI_URL),
  // Chọn máy đang cắm ESP32/webcam: localhost (cùng máy) hoặc địa chỉ máy khác trong mạng, ví dụ http://192.168.1.20:8000
  choose() {
    const typed = window.prompt(
      'Nhập địa chỉ dịch vụ AI của máy đang cắm ESP32/webcam.\nCùng máy: http://localhost:8000\nMáy khác trong mạng: http://192.168.1.20:8000',
      readAiOverride() || LOCAL_AI_URL,
    )
    if (typed == null) return
    const url = typed.trim().replace(/\/+$/, '')
    if (!/^https?:\/\/[^\s/]+(:\d+)?$/i.test(url)) { window.alert('Địa chỉ không hợp lệ. Ví dụ: http://192.168.1.20:8000'); return }
    try { localStorage.setItem(AI_URL_KEY, url) } catch { /* bỏ qua */ }
    window.location.reload()
  },
  useCloud() { try { localStorage.removeItem(AI_URL_KEY) } catch { /* bỏ qua */ } window.location.reload() },
}

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
  async authorizeEntry(payload) {
    return (await apiClient.post('/gate/entry-admission', payload)).data.data
  },
  async commandBarrier(payload) {
    return (await apiClient.post('/v1/Gate/barrier-commands', payload)).data
  },
  async openAuthorizedInboundBarrier(commandId) {
    const { data } = await aiClient.post('/api/v1/gate/barrier/open/in', { commandId })
    if (!data.success) throw new Error(data.message || 'Chưa gửi được lệnh mở barie tới ESP32.')
    return data
  },
  async recordPassageIn(payload) {
    return (await apiClient.post('/v1/Gate/passage-in', { ...payload, passageConfirmed: true })).data
  },

  // ── AI CONTAINER ONNX & OCR INSPECTION (C# Core container.onnx + OCR + ISO 6346) ──

  /**
   * Kiểm tra tình trạng mô hình AI ONNX nhận diện container (container.onnx)
   */
  async getContainerModelStatus() {
    try {
      const res = await apiClient.get('/v1/Gate/containers/model-status')
      return { success: true, isLive: true, data: res.data }
    } catch (err) {
      return {
        success: false,
        isLive: false,
        error: err.response?.data?.message || err.message,
      }
    }
  },

  /**
   * Tải ảnh chụp/khung hình container lên C# Backend để:
   * 1. YOLO ONNX container.onnx nhận diện vùng ID & Type
   * 2. OCR đọc ký tự và kiểm tra chuẩn ISO 6346
   * 3. Đối chiếu tự động với Booking & Đăng ký tại Cảng
   */
  async inspectContainerImage(file, query = {}) {
    const formData = new FormData()
    if (file instanceof Blob && !(file instanceof File)) {
      formData.append('file', file, 'container_capture.jpg')
    } else {
      formData.append('file', file)
    }
    if (query.bookingNumber) formData.append('bookingNumber', query.bookingNumber)
    if (query.vehiclePlate) formData.append('vehiclePlate', query.vehiclePlate)
    if (query.gateCode) formData.append('gateCode', query.gateCode)
    if (query.laneCode) formData.append('laneCode', query.laneCode)
    if (query.gateType) formData.append('gateType', query.gateType)
    if (query.autoVerify !== undefined) formData.append('autoVerify', String(query.autoVerify))

    try {
      const res = await apiClient.post('/v1/Gate/containers/inspect', formData)
      return { success: true, isLive: true, data: res.data }
    } catch (err) {
      return {
        success: false,
        isLive: false,
        error: err.response?.data?.message || err.message,
      }
    }
  },

  /**
   * Gửi chuỗi ảnh Base64 kiểm duyệt container qua container.onnx
   */
  async inspectContainerBase64(payload) {
    try {
      const res = await apiClient.post('/v1/Gate/containers/inspect-base64', payload)
      return { success: true, isLive: true, data: res.data }
    } catch (err) {
      return {
        success: false,
        isLive: false,
        error: err.response?.data?.message || err.message,
      }
    }
  },

  /**
   * Gate Officer xác nhận Đạt (Approved) hoặc Từ chối (Rejected) container, lưu log nghiệp vụ
   */
  async recordContainerDecision(payload) {
    try {
      const res = await apiClient.post('/v1/Gate/containers/verify-decision', payload)
      return { success: true, isLive: true, data: res.data }
    } catch (err) {
      return {
        success: false,
        isLive: false,
        error: err.response?.data?.message || err.message,
      }
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

  async setCameraPreview(lane = 'IN', enabled = true) {
    try {
      const action = enabled ? 'start' : 'stop'
      const res = await aiClient.post(`/api/v1/gate/camera/${action}?lane=${lane}`)
      return { success: true, data: res.data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async getHardwareStatus() {
    try {
      const res = await aiClient.get('/api/v1/gate/hardware-status')
      return { success: true, data: res.data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async manualBarrierOpen(lane = 'IN') {
    try {
      const endpoint = String(lane).toUpperCase() === 'OUT' ? '/api/v1/gate/barrier/open/out' : '/api/v1/gate/barrier/open/in'
      const res = await aiClient.post(endpoint)
      return { success: true, data: res.data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async manualBarrierClose(lane = 'IN') {
    try {
      const endpoint = String(lane).toUpperCase() === 'OUT' ? '/api/v1/gate/barrier/close/out' : '/api/v1/gate/barrier/close/in'
      const res = await aiClient.post(endpoint)
      return { success: true, data: res.data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async manualBarrierFail(lane = 'IN') {
    try {
      const endpoint = String(lane).toUpperCase() === 'OUT' ? '/api/v1/gate/barrier/fail/out' : '/api/v1/gate/barrier/fail/in'
      const res = await aiClient.post(endpoint)
      return { success: true, data: res.data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  // ── .NET BACKEND VERIFICATION & APPROVAL (PURE REAL API) ─────────────────

  async verifyGateScan(payload) {
    const { data } = await apiClient.post('/v1/Gate/verify', payload)
    return { success: true, isLive: true, data }
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
