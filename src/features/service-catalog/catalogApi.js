import apiClient from '../../services/apiClient'

const root = '/v1/ServiceCatalog'
export const catalogApi = {
  list: async () => (await apiClient.get(root)).data,
  save: async (id, body) => (id ? await apiClient.put(`${root}/${id}`, body) : await apiClient.post(root, body)).data,
  addTariff: async (id, body) => (await apiClient.post(`${root}/${id}/tariffs`, body)).data,
  retire: async (id, tariffId) => (await apiClient.post(`${root}/${id}/tariffs/${tariffId}/retire`)).data,
  quote: async (id, body) => (await apiClient.post(`${root}/${id}/quote`, body)).data,
  history: async id => (await apiClient.get(`${root}/${id}/history`)).data,
}

export const labels = {
  direction: { ALL: 'Tất cả dịch vụ', EXPORT: 'Hàng xuất', IMPORT: 'Hàng nhập', BOTH: 'Dịch vụ tại bãi' },
  unit: { CONTAINER: 'container', MOVE: 'lượt chuyển', HOUR: 'giờ', DAY: 'ngày', WEIGH: 'lượt cân' },
  size: { ALL: 'Mọi kích thước', '20FT': '20 feet', '40FT': '40 feet', '45FT': '45 feet' },
  equipment: { ALL: 'Mọi nhóm', DRY: 'Thông thường', REEFER: 'Container lạnh', DG: 'Hàng nguy hiểm', OOG: 'Hàng quá khổ' },
}
export const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
export const formatDate = value => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('vi-VN') : 'Không giới hạn'
export function rateState(rate, today) {
  if (!rate.isActive) return 'Đã ngừng'
  if (rate.effectiveFrom > today) return 'Sắp áp dụng'
  if (rate.effectiveTo && rate.effectiveTo < today) return 'Hết hiệu lực'
  return 'Đang áp dụng'
}
export const liveRates = (service, today) => (service.tariffs || []).filter(r => rateState(r, today) === 'Đang áp dụng')
