/**
 * Biểu giá Phụ thu Nâng container Bãi => Ôtô / Phí lưu bãi Cảng Tiên Sa
 * Đơn vị tính: đồng / container (Theo quyết định biểu giá dịch vụ cảng biển)
 */

export const PORT_STORAGE_TIERS = [
  {
    id: 'tier1',
    label: 'Từ ngày thứ 1 đến ngày thứ 5',
    shortLabel: 'Ngày 1 - 5',
    minDays: 1,
    maxDays: 5,
    fee20: 0,
    fee40: 0,
    text20: 'Không phụ thu',
    text40: 'Không phụ thu',
    description: 'Miễn phí lưu bãi tiêu chuẩn 5 ngày đầu',
  },
  {
    id: 'tier2',
    label: 'Từ ngày thứ 6 đến ngày thứ 11',
    shortLabel: 'Ngày 6 - 11',
    minDays: 6,
    maxDays: 11,
    fee20: 102600,
    fee40: 140400,
    text20: '102.600',
    text40: '140.400',
    description: 'Phụ thu nâng bãi mức 1',
  },
  {
    id: 'tier3',
    label: 'Từ ngày thứ 12 đến ngày thứ 17',
    shortLabel: 'Ngày 12 - 17',
    minDays: 12,
    maxDays: 17,
    fee20: 167400,
    fee40: 243000,
    text20: '167.400',
    text40: '243.000',
    description: 'Phụ thu nâng bãi mức 2',
  },
  {
    id: 'tier4',
    label: 'Từ ngày thứ 18 đến ngày thứ 30',
    shortLabel: 'Ngày 18 - 30',
    minDays: 18,
    maxDays: 30,
    fee20: 264600,
    fee40: 410400,
    text20: '264.600',
    text40: '410.400',
    description: 'Phụ thu nâng bãi mức 3',
  },
  {
    id: 'tier5',
    label: 'Từ ngày thứ 31 trở đi',
    shortLabel: 'Từ ngày 31+',
    minDays: 31,
    maxDays: 9999,
    fee20: 1080000,
    fee40: 1587600,
    text20: '1.080.000',
    text40: '1.587.600',
    description: 'Phụ thu lưu bãi dài ngày',
  },
]

export function getStorageTier(days) {
  const d = Math.max(1, parseInt(days) || 1)
  if (d <= 5) return PORT_STORAGE_TIERS[0]
  if (d <= 11) return PORT_STORAGE_TIERS[1]
  if (d <= 17) return PORT_STORAGE_TIERS[2]
  if (d <= 30) return PORT_STORAGE_TIERS[3]
  return PORT_STORAGE_TIERS[4]
}

export function calculatePortStorageFee(days = 7, containerType = '40HC') {
  const d = Math.max(1, parseInt(days) || 7)
  const is20 = String(containerType || '').includes('20')
  const tier = getStorageTier(d)
  const fee = is20 ? tier.fee20 : tier.fee40

  return {
    days: d,
    is20,
    containerLabel: is20 ? "20' có hàng" : "40' có hàng",
    tier,
    tierLabel: tier.label,
    fee,
  }
}

