import apiClient from './apiClient'

// Hồ sơ hàng nhập (Express): pre-alert, đối chiếu B/L-manifest, Arrival Notice, D/O.
const base = '/import-documents'
const unwrap = res => res.data?.data ?? res.data
const get = async (path = '', params) => unwrap(await apiClient.get(`${base}${path}`, { params }))
const post = async (path, body) => unwrap(await apiClient.post(`${base}${path}`, body ?? {}))

export const importDocumentService = {
  list: params => get('', params),
  get: id => get(`/${id}`),
  // Hãng tàu
  listPreAlerts: () => get('/pre-alerts'),
  receivePreAlert: id => post(`/pre-alerts/${id}/receive`),
  listCompanies: () => get('/companies'),
  assignConsignee: (id, carrierId) => post(`/${id}/assign-consignee`, { carrierId }),
  reconcile: (id, manifestBill) => post(`/${id}/reconcile`, manifestBill ? { manifestBill } : {}),
  resolveMismatch: (id, data) => post(`/${id}/resolve-mismatch`, data),
  sendArrivalNotice: (id, data) => post(`/${id}/arrival-notice`, data),
  resolveAmendment: (id, data) => post(`/${id}/resolve-amendment`, data),
  collectFees: id => post(`/${id}/collect-fees`),
  confirmOriginal: id => post(`/${id}/confirm-original`),
  verifyRelease: id => post(`/${id}/verify-release`),
  issueDo: (id, data) => post(`/${id}/issue-do`, data),
  // Ngoại lệ sau phát hành B/L
  listRequests: id => get(`/${id}/requests`),
  resolveRequest: (requestId, data) => post(`/requests/${requestId}/resolve`, data),
  confirmOriginalReturned: requestId => post(`/requests/${requestId}/original-returned`),
  changeSchedule:(id, data) => post(`/${id}/schedule-change`, data),
  // Transport company
  createRequest: (id, data) => post(`/${id}/requests`, data),
  cancelRequest: requestId => post(`/requests/${requestId}/cancel`),
  confirmNotice: (id, data) => post(`/${id}/confirm-notice`, data),
  requestAmendment: (id, data) => post(`/${id}/request-amendment`, data),
  setAuthorization: (id, url) => post(`/${id}/authorization`, { url }),
  requestDo: id => post(`/${id}/request-do`),
}

export default importDocumentService
