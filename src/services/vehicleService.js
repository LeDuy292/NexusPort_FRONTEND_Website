import apiClient from './apiClient'

const vehicleService = {
  getPhotos: async (ids, config = {}) => {
    const photos = {}
    for (let offset = 0; offset < ids.length; offset += 100) {
      const batch = ids.slice(offset, offset + 100)
      const response = await apiClient.get('/v1/Vehicle/photos?' + batch.map(id => 'ids=' + encodeURIComponent(id)).join('&'), config)
      Object.assign(photos, response.data)
    }
    return photos
  },
  getAllVehicles: async (filters = {}, config = {}) => {
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    if (filters.searchTerm) params.append('searchTerm', filters.searchTerm)
    if (filters.carrierId) params.append('carrierId', filters.carrierId)
    if (filters.includeDocuments !== undefined) params.append('includeDocuments', filters.includeDocuments)
    if (filters.includePhotos !== undefined) params.append('includePhotos', filters.includePhotos)

    const response = await apiClient.get(`/v1/Vehicle?${params.toString()}`, config)
    return response.data
  },

  getVehicleById: async (id, config = {}) => {
    const response = await apiClient.get(`/v1/Vehicle/${id}`, config)
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
  },

  extractRegistration: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post('/v1/Vehicle/extract-registration', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  },

  uploadPhoto: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post('/v1/Vehicle/upload-photo', formData)
    return response.data
  }
}

export default vehicleService
