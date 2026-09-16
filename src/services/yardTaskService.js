import apiClient from './apiClient'

export const yardTaskService = {
  /**
   * Lấy danh sách nhiệm vụ tác nghiệp bãi
   * @param {Object} params - { block, status }
   */
  getTasks: async (params = {}) => {
    try {
      const res = await apiClient.get('/v1/YardTask', { params })
      return res.data || []
    } catch (error) {
      console.error('Error fetching yard tasks:', error)
      throw error
    }
  },

  /**
   * Lấy chi tiết nhiệm vụ theo ID
   * @param {string} id
   */
  getTaskById: async (id) => {
    try {
      const res = await apiClient.get(`/v1/YardTask/${id}`)
      return res.data
    } catch (error) {
      console.error(`Error fetching yard task ${id}:`, error)
      throw error
    }
  },

  /**
   * Lấy danh sách Thiết bị nâng hạ đang Available theo Block
   * @param {string} block
   */
  getAvailableEquipments: async (block = '') => {
    try {
      const params = block ? { block } : {}
      const res = await apiClient.get('/v1/Equipment/available', { params })
      return res.data || []
    } catch (error) {
      console.error('Error fetching available equipments:', error)
      throw error
    }
  },

  /**
   * Lấy danh sách Cần thủ (Yard Operators) trực ca
   */
  getAvailableOperators: async () => {
    try {
      const res = await apiClient.get('/v1/YardTask/operators/available')
      return res.data || []
    } catch (error) {
      console.error('Error fetching available operators:', error)
      throw error
    }
  },

  /**
   * Gán Thiết bị Nâng hạ và Cần thủ cho Task (NXP-056)
   * @param {string} taskId
   * @param {Object} payload - { equipmentId, operatorId, operatorName, notes }
   */
  assignEquipment: async (taskId, payload) => {
    try {
      const res = await apiClient.post(`/v1/YardTask/${taskId}/assign-equipment`, payload)
      return res.data
    } catch (error) {
      console.error(`Error assigning equipment for task ${taskId}:`, error)
      throw error
    }
  },

  /**
   * NXP-055: Tiếp nhận & Kiểm tra Đối soát Container tại Bãi (Yard Receiving)
   * @param {Object} payload - { containerNo, actualSealNo, isSealIntact, condition, notes, inspectorName, yardBlockCode, locationCoordinate }
   */
  receiveContainer: async (payload) => {
    try {
      const res = await apiClient.post('/v1/YardTask/receiving-inspect', payload)
      return res.data
    } catch (error) {
      console.error('Error receiving container at yard:', error)
      throw error
    }
  },

  /**
   * NXP-060 BƯỚC 1: Bắt đầu cẩu (Start Lift)
   * @param {string} taskId
   * @param {Object} payload - { notes }
   */
  startLift: async (taskId, payload = {}) => {
    try {
      const res = await apiClient.post(`/v1/YardTask/${taskId}/start-lift`, payload)
      return res.data
    } catch (error) {
      console.error(`Error starting lift for task ${taskId}:`, error)
      throw error
    }
  },

  /**
   * NXP-060 BƯỚC 3: Hoàn thành cẩu (Complete Lift)
   * @param {string} taskId
   * @param {Object} payload - { completedLocation, notes, completedBy }
   */
  completeLift: async (taskId, payload = {}) => {
    try {
      const res = await apiClient.post(`/v1/YardTask/${taskId}/complete-lift`, payload)
      return res.data
    } catch (error) {
      console.error(`Error completing lift for task ${taskId}:`, error)
      throw error
    }
  },

  /**
   * NXP-057: Dispatcher tạo Operation Task mới
   * @param {Object} payload - { taskCode, containerNo, blockCode, operationType, fromLocation, toLocation, priority, containerType, cargoType, vehiclePlate, driverName, dueTime, notes }
   */
  createTask: async (payload) => {
    try {
      const res = await apiClient.post('/v1/YardTask', payload)
      return res.data
    } catch (error) {
      console.error('Error creating yard task:', error)
      throw error
    }
  }
}

export default yardTaskService
