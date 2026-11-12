import apiClient from '../../services/apiClient'

const root = '/v1/ServiceDrafts'
export const serviceDraftKey = ['eport-service-drafts']
export function draftSession() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}')
    return `${user.id || user.username || ''}:${user.role || ''}`
  } catch { return '' }
}
export const serviceDraftsApi = {
  sources: async params => (await apiClient.get(`${root}/sources`, { params })).data,
  containers: async params => (await apiClient.get(`${root}/containers`, { params })).data,
  list: async params => (await apiClient.get(root, { params })).data,
  get: async id => (await apiClient.get(`${root}/${id}`)).data,
  save: async (id, body) => (await apiClient.put(`${root}/${id}`, body)).data,
  validate: async (id, body) => (await apiClient.post(`${root}/${id}/validate`, body)).data,
  confirm: async (id, body) => (await apiClient.post(`${root}/${id}/confirm`, body)).data,
  registration: async id => (await apiClient.get(`${root}/${id}/registration`)).data,
  deliveryProfile: async () => (await apiClient.get(`${root}/delivery-profile`)).data,
  sendEmail: async (id, body) => (await apiClient.post(`${root}/${id}/email-verification`, body)).data,
  verifyEmail: async (id, body) => (await apiClient.post(`${root}/${id}/verify-email`, body)).data,
  emailStatus: async (id, body) => (await apiClient.post(`${root}/${id}/email-status`, body)).data,
  checkCustoms: async (id, body) => (await apiClient.post(`${root}/${id}/check-customs`, body)).data,
  confirmCustoms: async (id, body) => (await apiClient.post(`${root}/${id}/confirm-customs`, body)).data,
}
export const draftError = error => error?.response?.data?.message || error?.response?.data?.Message || error?.message || 'Không thể hoàn tất thao tác. Vui lòng thử lại.'
export const draftDateTime = value => value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa khai báo'
