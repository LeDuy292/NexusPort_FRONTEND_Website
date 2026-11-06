import apiClient from './apiClient'

// Customer export booking requests and their progress come from C#.
const base = '/v1/Booking/export'
const get = async (path = '', params) => (await apiClient.get(`${base}${path}`, { params })).data
const post = async (path, body) => (await apiClient.post(`${base}${path}`, body)).data

export const exportBookingService = {
  getOptions: () => get('/options'),
  getDrafts: () => get('/drafts'),
  getDraft: id => get(`/drafts/${id}`),
  saveDraft: async (id, data) => (await apiClient.put(`${base}/drafts/${id}`, data)).data,
  submitPreparation: data => post('/requests', data),
  checkPreparation: data => post('/preparation/readiness', data),
  confirmPreparation: (id, data) => post(`/${id}/preparation/confirm`, data),
  getSiSuggestions: id => get(`/${id}/si-suggestions`),
  uploadPreparationDocument: file => {
    const form = new FormData()
    form.append('file', file)
    return post('/documents', form)
  },
  planSubmission: data => post('/submissions/plan', data),
  submitBooking: data => post('/submissions', data),
  getBookings: params => get('', params),
  getBooking: id => get(`/${id}`),
  createBooking: data => post('', data),
  declareContainers: (id, data) => post(`/${id}/containers`, data),
  submitSi: (id, data) => post(`/${id}/si`, data),
  confirmDraft: (id, data) => post(`/${id}/confirm-draft`, data),
  cancelBooking: (id, data) => post(`/${id}/cancel`, data),
  getVoyages: () => get('/voyages'),
}

export default exportBookingService
