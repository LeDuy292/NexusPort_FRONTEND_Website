import apiClient from './apiClient'

// All reads and mutations use the database-backed API. Failures stay visible.
const get = async (path, params) => (await apiClient.get(`/v1/Booking${path}`, { params })).data
const post = async (path, body) => (await apiClient.post(`/v1/Booking${path}`, body)).data
export const bookingService = {
  completeGateOut: async (bookingId, gateId) => (await apiClient.post('/v1/Gate/complete-out', { bookingId, gateId })).data,
  getBookings: params => get('', params),
  getBookingById: id => get(`/${id}`),
  createBooking: data => post('', data),
  updateBooking: async (id, data) => (await apiClient.put(`/v1/Booking/${id}`, data)).data,
  cancelBooking: (id, reason = '') => post(`/${id}/cancel`, { reason }),
  approveBooking: id => post(`/${id}/approve`),
  rejectBooking: (id, reason = '') => post(`/${id}/reject`, { reason }),
  getAvailableResources: () => get('/available-resources'),
  assignBookingResources: (id, data) => post(`/${id}/assign`, data),
  getSelectionRecommendation: data => post('/recommend-selection', data),
  getFleetRecommendation: params => get('/recommend-fleet', params),
  evaluatePayload: params => get('/evaluate-payload', params),
  getPaymentInfo: id => get(`/${id}/payment`),
  processPayment: (id, data = {}) => post(`/${id}/payment`, data),
}
export default bookingService
