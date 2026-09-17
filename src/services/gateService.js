import apiClient from './apiClient'

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
    formData.append('file', file)
    formData.append('gate_code', gateCode)
    formData.append('lane_code', laneCode)
    formData.append('camera_id', `CAM_${gateCode}_${laneCode}`)

    try {
      const res = await aiClient.post('/api/v1/gate/recognize', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
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

  // ── .NET BACKEND VERIFICATION & APPROVAL (PURE REAL API) ─────────────────

  /**
   * Gửi thông tin phương tiện đến .NET Backend để đối soát qua 7 điều kiện (Rule Engine)
   */
  async verifyGateScan(payload) {
    try {
      const res = await apiClient.post('/v1/gate/verify', payload)
      return { success: true, isLive: true, data: res.data }
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
