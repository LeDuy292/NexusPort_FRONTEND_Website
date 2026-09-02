import apiClient from './apiClient'

const driverService = {
  getAllDrivers: async (filters = {}) => {
    const res = await apiClient.get('/v1/Driver', { params: filters })
    return res.data
  },

  getDriverById: async (id) => {
    const res = await apiClient.get(`/v1/Driver/${id}`)
    return res.data
  },

  createDriver: async (data, carrierId) => {
    let url = '/v1/Driver'
    if (carrierId) {
      url += `?carrierId=${encodeURIComponent(carrierId)}`
    }
    const res = await apiClient.post(url, data)
    return res.data
  },

  updateDriver: async (id, data) => {
    const res = await apiClient.put(`/v1/Driver/${id}`, data)
    return res.data
  },

  toggleStatus: async (id, status) => {
    // Notice that our apiClient.patch takes body as the second argument
    // and Backend expects [FromBody] string status, which requires JSON serialization of string (like "active")
    const res = await apiClient.patch(`/v1/Driver/${id}/status`, status)
    return res.data
  }
}

export default driverService
