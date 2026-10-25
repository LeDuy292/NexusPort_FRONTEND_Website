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

// Identity for comparisons/searches is independent of separators used by OCR or bookings.
export function normalizePlate(plate) {
  return String(plate ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

export function matchesPlateSearch(plate, query) {
  const key = normalizePlate(query)
  return Boolean(key) && normalizePlate(plate).includes(key)
}

// Keep the entire series (C, LD, Y3...) before the five-digit serial number.
export function formatPlateNumber(plate) {
  if (!plate) return ''
  const cleaned = normalizePlate(plate)
  const match = cleaned.match(/^(\d{2})([A-Z]{1,2}|[A-Z]\d)(\d{3})(\d{2})$/)
  if (match) return `${match[1]}${match[2]}-${match[3]}.${match[4]}`
  // Do not invent punctuation for older, foreign or unrecognized formats.
  return String(plate).trim().toUpperCase()
}
