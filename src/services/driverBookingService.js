import apiClient from './apiClient'

export async function getDriverAssignmentOptions() {
  const response = await apiClient.get('/driver-bookings/assignment-options')
  return response.data.data
}
