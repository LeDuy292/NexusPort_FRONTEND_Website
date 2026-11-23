import apiClient from './apiClient'

// Báo cáo sự cố / hư hỏng tại bãi: nhân viên bãi gửi, Dispatcher nhận và xử lý.
export const yardIncidentService = {
  create: async (payload) => (await apiClient.post('/yard/incident-reports', payload)).data?.data,
  list: async (params = {}) => (await apiClient.get('/yard/incident-reports', { params })).data?.data || { items: [], counts: {} },
  updateStatus: async (id, status, note = '') => (await apiClient.patch(`/yard/incident-reports/${id}`, { status, note })).data?.data,
  // Dispatcher chấp nhận một ô đề xuất cho báo cáo xung đột vị trí đặt chỗ
  applyProposal: async (id, slot) => (await apiClient.post(`/yard/incident-reports/${id}/apply-proposal`, { slot })).data?.data,
}

// Thu nhỏ ảnh chụp từ camera điện thoại (thường vài MB) trước khi gửi: tối đa 1280px, JPEG chất lượng 0.72.
export function compressImageToDataUrl(file, maxSide = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Tệp không phải ảnh hợp lệ.'))
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default yardIncidentService
