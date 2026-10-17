import apiClient from './apiClient'

export const yardRestackService = {
  /**
   * NXP-126: Phân tích Stack, phát hiện container bị chặn và tìm slot đệm
   * @param {Object} payload - { containerNo, location, blockCode, targetDestination, restackBackToOriginal }
   */
  analyzeBlockedContainer: async (payload) => {
    try {
      const res = await apiClient.post('/v1/YardRestack/analyze', payload)
      return res.data
    } catch (error) {
      console.error('Error analyzing blocked container:', error)
      throw error
    }
  },

  /**
   * NXP-126: Tạo kế hoạch di dời container chồng
   * @param {Object} payload - { targetContainerNo, targetLocation, blockCode, targetDestination, restackBackToOriginal, assignedEquipmentCode, assignedOperatorName, isBillable, notes, steps }
   */
  createPlan: async (payload) => {
    try {
      const res = await apiClient.post('/v1/YardRestack/plan', payload)
      return res.data
    } catch (error) {
      console.error('Error creating restack plan:', error)
      throw error
    }
  },

  /**
   * NXP-126: Lấy chi tiết kế hoạch theo ID
   * @param {string} id
   */
  getPlanById: async (id) => {
    try {
      const res = await apiClient.get(`/v1/YardRestack/${id}`)
      return res.data
    } catch (error) {
      console.error(`Error fetching restack plan ${id}:`, error)
      throw error
    }
  },

  /**
   * NXP-126: Lấy toàn bộ danh sách kế hoạch / lịch sử di dời
   * @param {Object} params - { status }
   */
  getAllPlans: async (params = {}) => {
    try {
      const res = await apiClient.get('/v1/YardRestack', { params })
      return res.data || []
    } catch (error) {
      console.error('Error fetching restack plans:', error)
      throw error
    }
  },

  /**
   * NXP-126: Phát chuỗi lệnh cẩu RTG xuống bãi (Triển khai)
   * @param {string} id
   */
  deployPlan: async (id) => {
    try {
      const res = await apiClient.post(`/v1/YardRestack/${id}/deploy`)
      return res.data
    } catch (error) {
      console.error(`Error deploying restack plan ${id}:`, error)
      throw error
    }
  },

  /**
   * NXP-126: Xác nhận hoàn thành một bước cẩu và tự động chuyển bước tiếp theo
   * @param {string} id
   * @param {number} stepNumber
   * @param {Object} payload - { completedLocation, notes }
   */
  completeStep: async (id, stepNumber, payload = {}) => {
    try {
      const res = await apiClient.post(`/v1/YardRestack/${id}/steps/${stepNumber}/complete`, payload)
      return res.data
    } catch (error) {
      console.error(`Error completing restack step ${stepNumber}:`, error)
      throw error
    }
  },

  /**
   * NXP-126: Hủy kế hoạch
   * @param {string} id
   * @param {Object} payload - { notes }
   */
  cancelPlan: async (id, payload = {}) => {
    try {
      const res = await apiClient.post(`/v1/YardRestack/${id}/cancel`, payload)
      return res.data
    } catch (error) {
      console.error(`Error canceling restack plan ${id}:`, error)
      throw error
    }
  }
}

export default yardRestackService
