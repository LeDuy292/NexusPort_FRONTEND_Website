/**
 * Hàm tiện ích định dạng dữ liệu (ngày, tiền tệ, biển số xe)
 */

// Định dạng ngày giờ: 2026-08-10T14:00:00 -> 10/08/2026 14:00
export function formatDateTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Định dạng tiền tệ VND: 12500000 -> 12.500.000 đ
export function formatCurrency(value) {
  if (value === undefined || value === null) return '0 đ'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value)
}

// Chuẩn hóa biển số xe: 29c12345 -> 29C-123.45
export function formatPlateNumber(plate) {
  if (!plate) return ''
  const cleaned = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (cleaned.length >= 7) {
    const head = cleaned.substring(0, 3)
    const mid = cleaned.substring(3, 6)
    const tail = cleaned.substring(6)
    return `${head}-${mid}.${tail}`
  }
  return cleaned
}
