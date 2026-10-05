import apiClient from './apiClient'

export const yardOperationService = {
  complete: (operationId, data) => apiClient.post(`/v1/Yard/operations/${operationId}/complete`, data),
}

export default yardOperationService
