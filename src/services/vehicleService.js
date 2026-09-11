import apiClient from './apiClient'

const vehicleService = {
  getAllVehicles: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    if (filters.searchTerm) params.append('searchTerm', filters.searchTerm)
    if (filters.carrierId) params.append('carrierId', filters.carrierId)

    const response = await apiClient.get(`/v1/Vehicle?${params.toString()}`)
    return response.data
  },

  getVehicleById: async (id) => {
    const response = await apiClient.get(`/v1/Vehicle/${id}`)
    return response.data
  },

  createVehicle: async (data, carrierId = null) => {
    const params = new URLSearchParams()
    if (carrierId) params.append('carrierId', carrierId)
    
    const response = await apiClient.post(`/v1/Vehicle?${params.toString()}`, data)
    return response.data
  },

  updateVehicle: async (id, data) => {
    const response = await apiClient.put(`/v1/Vehicle/${id}`, data)
    return response.data
  },

  toggleStatus: async (id, status) => {
    const response = await apiClient.patch(`/v1/Vehicle/${id}/status`, status, {
      headers: { 'Content-Type': 'application/json' }
    })
    return response.data
  },

  assignDriver: async (id, driverId) => {
    const response = await apiClient.patch(`/v1/Vehicle/${id}/assign-driver`, { driverId })
    return response.data
  }
}

export default vehicleService
