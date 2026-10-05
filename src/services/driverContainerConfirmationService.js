import apiClient from './apiClient'

export const driverContainerConfirmationService = {
  async getAssignedOperations() {
    const response = await apiClient.get('/v1/Booking/driver/operations')
    return response.data
  },

  async confirmContainer(containerId, condition = 'OK', notes = '') {
    const response = await apiClient.post('/v1/Booking/driver/container-confirmation', {
      containerId,
      condition,
      notes: notes || null
    })
    return response.data
  }
}

export default driverContainerConfirmationService
