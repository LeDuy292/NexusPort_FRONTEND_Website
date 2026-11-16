import apiClient from './apiClient'

const driverService = {
  getPhotos: async (ids, config = {}) => {
    const photos = {}
    for (let offset = 0; offset < ids.length; offset += 100) {
      const batch = ids.slice(offset, offset + 100)
      const response = await apiClient.get('/v1/Driver/photos?' + batch.map(id => 'ids=' + encodeURIComponent(id)).join('&'), config)
      Object.assign(photos, response.data)
    }
    return photos
  },
  createAccount: async (data) => (await apiClient.post('/v1/driver-accounts', data, { timeout: 30000 })).data,
  resendInvitation: async (id) => (await apiClient.post(`/v1/driver-accounts/${id}/resend`, {}, { timeout: 30000 })).data,
  activateAccount: async (data) => (await apiClient.post('/v1/driver-accounts/activate', data)).data,
  getAllDrivers: async (filters = {}, config = {}) => {
    const res = await apiClient.get('/v1/Driver', { ...config, params: filters })
    return res.data
  },

  getDriverById: async (id, config = {}) => {
    const res = await apiClient.get(`/v1/Driver/${id}`, config)
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

  extractCccd: async (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    // DO NOT set Content-Type manually, let Axios set it with the correct boundary
    const res = await apiClient.post('/v1/Driver/extract-cccd', formData);
    return res.data;
  },

  extractGplx: async (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    const res = await apiClient.post('/v1/Driver/extract-gplx', formData);
    return res.data;
  },

  uploadDocumentBack: async (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    const res = await apiClient.post('/v1/Driver/upload-document-back', formData);
    return res.data;
  },

  toggleStatus: async (id, status) => {
    // Notice that our apiClient.patch takes body as the second argument
    // and Backend expects [FromBody] string status, which requires JSON serialization of string (like "active")
    const res = await apiClient.patch(`/v1/Driver/${id}/status`, status)
    return res.data
  }
}

export default driverService
