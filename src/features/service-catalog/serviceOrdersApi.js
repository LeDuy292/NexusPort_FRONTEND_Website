import apiClient from '../../services/apiClient'

const root = '/v1/ServiceOrders'
export const serviceOrderKey = ['eport-service-orders']
export const serviceOrdersApi = {
  list: async params => (await apiClient.get(root, { params })).data,
  get: async id => (await apiClient.get(`${root}/${id}`)).data,
  receipt: async (id, sourceContainerId) => (await apiClient.get(`${root}/${id}/receipt`, { params: { sourceContainerId: sourceContainerId || undefined } })).data,
  history: async id => (await apiClient.get(`${root}/${id}/history`)).data,
  action: async (id, body) => (await apiClient.post(`${root}/${id}/actions`, body)).data,
  payments: async id => (await apiClient.get(`${root}/${id}/payments`)).data,
  createPayment: async (id, body) => (await apiClient.post(`${root}/${id}/payments`, body)).data,
  syncPayment: async (id, paymentId, body) => (await apiClient.post(`${root}/${id}/payments/${paymentId}/sync`, body)).data,
  cancelPayment: async (id, paymentId, body) => (await apiClient.post(`${root}/${id}/payments/${paymentId}/cancel`, body)).data,
}

export const orderStatusLabels = {
  DRAFT: 'Bản nháp', CONFIRMED: 'Đã xác nhận', PENDING_APPROVAL: 'Chờ Dispatcher xác nhận',
  RECEIVED: 'Đã tiếp nhận', APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối', CANCELLED: 'Đã hủy',
}
export const paymentStatusLabels = {
  NOT_REQUIRED: 'Không phát sinh phí', UNPAID: 'Chưa thanh toán', PENDING: 'Chờ thanh toán',
  CREATING: 'Đang tạo liên kết', SUBMITTED: 'Đang đối chiếu', PAID: 'Đã thanh toán', SUCCEEDED: 'Đã thanh toán', FAILED: 'Không thành công', CANCELLED: 'Đã hủy yêu cầu', EXPIRED: 'Đã hết hạn',
}
export const paymentStateLabel = order => order.pricingStatus === 'AWAITING' ? 'Chờ Dispatcher trả phí' : order.paymentReviewRequired
  ? 'Cần cảng đối soát'
  : order.registrationId ? paymentStatusLabels[order.paymentStatus] || order.paymentStatus || 'Chưa xác nhận' : 'Chưa xác nhận phí'
export function statusTone(status) {
  const tones = {
    DRAFT: 'orange',
    CONFIRMED: 'blue',
    PENDING_APPROVAL: 'yellow',
    RECEIVED: 'teal',
    APPROVED: 'green',
    REJECTED: 'red',
    CANCELLED: 'red',
    // payment
    NOT_REQUIRED: 'neutral',
    UNPAID: 'yellow',
    PENDING: 'orange',
    CREATING: 'orange',
    SUBMITTED: 'purple',
    PAID: 'green',
    SUCCEEDED: 'green',
    FAILED: 'red',
    CANCELLED: 'red',
    EXPIRED: 'red',
  }
  return tones[status] || 'blue'
}
