import apiClient from './apiClient'

export const yardOperationService = {
  complete: (operationId, data) => apiClient.post(`/v1/Yard/operations/${operationId}/complete`, data),
  
  reserveSlot: async (payload) => {
    // Mock the backend API for now since endpoint doesn't exist
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, message: 'Reserved successfully', data: payload })
      }, 800)
    })
  }
}

export default yardOperationService
