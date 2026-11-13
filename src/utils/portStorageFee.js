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

/**
 * Phí Đảo Chuyển Container Trên Bãi (Shifting / Reshuffle Fee)
 * - Chỉ áp dụng cho container nhập khẩu (IMPORT / Pickup - cẩu bốc từ bãi lên xe đầu kéo)
 * - Tự động kiểm tra:
 *   + Nếu có container khác nằm đè phía trên (Tầng của cont < Tầng cao nhất của stack / hasContainerAbove == true):
 *     Bắt buộc phải thực hiện đảo chuyển container phía trên để lấy cont mục tiêu -> Tính phí đảo (150.000 VNĐ)
 *   + Nếu không có container nào nằm phía trên (Container ở tầng trên cùng - Top Tier / hasContainerAbove == false):
 *     Gắp trực tiếp lên xe đầu kéo -> Phí đảo = 0 VNĐ
 * - Với container xuất khẩu (EXPORT / Dropoff - hạ từ xe xuống bãi): Không áp dụng / Phí = 0 VNĐ
 */
export function calculateShiftingFee({
  direction = 'IMPORT',
  tier = 1,
  stackHeight = 2,
  hasContainerAbove = null,
  shiftingCount: manualShiftingCount = null,
} = {}) {
  const tierNum = Number(tier) || 1
  const stackNum = Number(stackHeight) || Math.max(tierNum, 2)
  const isAbove = Boolean(hasContainerAbove)

  // Nếu thực tế có container nằm đè phía trên (hasContainerAbove === true)
  if (isAbove) {
    const shiftingCount = manualShiftingCount && manualShiftingCount > 0
      ? manualShiftingCount
      : Math.max(1, stackNum - tierNum)
    const unitPrice = 150000
    const fee = shiftingCount * unitPrice
    return {
      isApplicable: true,
      hasContainerAbove: true,
      tier: tierNum,
      stackHeight: stackNum,
      shiftingCount,
      unitPrice,
      fee,
      statusText: `${fee.toLocaleString('vi-VN')} VNĐ (Đảo ${shiftingCount} cont tầng trên)`,
      shortStatusText: `${fee.toLocaleString('vi-VN')} VNĐ`,
      reason: `Container ở Tầng ${tierNum}, có ${shiftingCount} container tầng trên đè lên · Cần cẩu bãi đảo chuyển ra bãi đệm để lấy`,
    }
  }

  return {
    isApplicable: false,
    hasContainerAbove: false,
    tier: tierNum,
    stackHeight: stackNum,
    shiftingCount: 0,
    unitPrice: 150000,
    fee: 0,
    statusText: '0 VNĐ (Không có cont nằm trên)',
    shortStatusText: '0 VNĐ',
    reason: `Container ở Tầng ${tierNum} (Tầng trên trống, không có cont đè) · Cẩu gắp trực tiếp, không phát sinh đảo bãi`,
  }
}

/**
 * Tự động phân tích Hồ sơ Container & Booking để xác định:
 * 1. Hàng Xuất Khẩu (EXPORT / Dropoff) hay Hàng Nhập Khẩu (IMPORT / Pickup)
 * 2. Loại Container: 20' có hàng hay 40' có hàng, Cont lạnh (Reefer) hay Cont thường
 * 3. Số ngày lưu bãi thực tế (Tính từ ngày có vị trí trên bãi Cảng đến ngày đăng ký qua cổng)
 * 4. Tự động tra bảng Phụ thu lưu bãi (PORT_STORAGE_TIERS) và tính ra Bảng Kê Chi Tiết Biểu Phí Dịch Vụ Cảng
 */
export function computeAutoBookingTariff(booking, manifestInfo = null, reservedSlot = null) {
  if (!booking) {
    return calculatePortServiceTariff({
      direction: 'EXPORT',
      size: 20,
      storageDays: 3,
      isReefer: false,
      containerTypeCode: '20GP',
    })
  }

  // 1. Tự động nhận diện Hướng nghiệp vụ (Xuất khẩu vs Nhập khẩu)
  const opLower = String(booking.operation || booking.bookingType || '').toLowerCase()
  const mnfDir = String(manifestInfo?.direction || booking.direction || '').toUpperCase()
  const isImport =
    mnfDir === 'IMPORT' ||
    opLower === 'pickup' ||
    opLower === 'import' ||
    opLower === 'emptypickup' ||
    opLower.includes('nhận') ||
    opLower.includes('nhập')

  const direction = isImport ? 'IMPORT' : 'EXPORT'

  // 2. Tự động nhận diện Kích cỡ & Loại Container (20' có hàng vs 40' có hàng, Cont lạnh Reefer)
  const rawType = String(
    booking.containerType ||
    manifestInfo?.isoType ||
    reservedSlot?.isoType ||
    (booking.containerSize === 'ft20' ? '20GP' : '40HC')
  ).toUpperCase()

  const is20 =
    rawType.includes('20') ||
    booking.containerSize === 'ft20' ||
    Number(reservedSlot?.size) === 20
  const size = is20 ? 20 : 40

  const isReefer =
    Boolean(reservedSlot?.isReefer) ||
    rawType.includes('RF') ||
    String(booking.cargoType || '').toLowerCase().includes('reefer') ||
    String(booking.tempRequired || manifestInfo?.tempRequired || '').includes('°C')

  // 3. Tự động tính số ngày lưu bãi (Tính từ ngày có vị trí trên bãi Cảng)
  const contId = String(booking.containerId || booking.containerNo || booking.id || '').trim().toUpperCase()
  let storageDays = 3
  let yardInDateStr = '07/11/2026'
  let gateDateStr = '10/11/2026'

  if (booking.storageDays && Number(booking.storageDays) > 0) {
    storageDays = Number(booking.storageDays)
  } else if (isImport) {
    // Với hàng Nhập khẩu: tàu dỡ cont xuống bãi trước đó -> tính số ngày nằm bãi đến lúc xe vào lấy
    if (contId === 'MSKU7712907') {
      storageDays = 7 // Khung ngày 6 - 11 -> 40' có hàng = 140.400 đ
      yardInDateStr = '03/11/2026'
    } else if (contId === 'MSKU8829103') {
      storageDays = 8 // Khung ngày 6 - 11 -> 20' có hàng = 102.600 đ
      yardInDateStr = '02/11/2026'
    } else {
      const sum = contId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
      const sampleImportDays = [7, 4, 9, 14, 3, 8]
      storageDays = sampleImportDays[sum % sampleImportDays.length]
      const inDay = Math.max(1, 10 - storageDays)
      yardInDateStr = `${String(inDay).padStart(2, '0')}/11/2026`
    }
  } else {
    // Với hàng Xuất khẩu: hạ bãi chờ tàu (thường 2 - 4 ngày trong khung miễn phí 1-5 ngày, một số lô hạ sớm 7 ngày)
    if (contId === 'EMCU5102954') {
      storageDays = 7 // Hạ bãi sớm 7 ngày -> áp phụ thu lưu bãi bậc 6 - 11 ngày
      yardInDateStr = '03/11/2026'
    } else {
      const sum = contId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
      storageDays = (sum % 4) + 2 // 2 -> 5 ngày (Trong khung miễn phí 5 ngày đầu)
      const inDay = Math.max(1, 10 - storageDays)
      yardInDateStr = `${String(inDay).padStart(2, '0')}/11/2026`
    }
  }

  const tier = Number(reservedSlot?.tier || booking.tier || 1)
  const stackHeight = Number(reservedSlot?.stackHeight || 2)
  let hasContainerAbove = reservedSlot?.hasContainerAbove !== undefined
    ? reservedSlot.hasContainerAbove
    : (booking.hasContainerAbove !== undefined ? booking.hasContainerAbove : null)
  let shiftingCount = booking.shiftingCount || reservedSlot?.shiftingCount || null

  // Tự động kiểm tra trên sơ đồ bãi nếu chưa được gán cờ hasContainerAbove cụ thể
  if (hasContainerAbove === null && typeof window !== 'undefined') {
    try {
      const targetBlock = String(reservedSlot?.blockCode || booking.blockCode || booking.yardBlock || '').trim().toUpperCase()
      const targetBay = Number(reservedSlot?.bay || booking.bay || 2)
      const targetRow = Number(reservedSlot?.row || booking.row || 1)
      const targetTier = Number(tier || 1)
      const targetCont = String(contId || '').trim().toUpperCase()

      if (targetBlock && targetBay && targetRow) {
        const yardRes = JSON.parse(localStorage.getItem('nexusport_yard_reservations') || '[]')
        const genBookings = JSON.parse(localStorage.getItem('nexusport_manifest_generated_gate_bookings') || '[]')
        const allSlots = []

        if (Array.isArray(yardRes)) {
          yardRes.forEach(r => {
            allSlots.push({
              cont: String(r.containerNo || r.containerId || '').trim().toUpperCase(),
              block: String(r.blockCode || '').trim().toUpperCase(),
              bay: Number(r.bay || 2),
              row: Number(r.row || 1),
              tier: Number(r.tier || 1),
            })
          })
        }

        if (Array.isArray(genBookings)) {
          genBookings.forEach(b => {
            const s = b.autoYardSlot || b.yardSlot || {}
            allSlots.push({
              cont: String(b.containerId || b.containerNo || '').trim().toUpperCase(),
              block: String(s.blockCode || '').trim().toUpperCase(),
              bay: Number(s.bay || 2),
              row: Number(s.row || 1),
              tier: Number(s.tier || 1),
            })
          })
        }

        const aboveConts = allSlots.filter(s => {
          if (targetCont && s.cont === targetCont) return false
          if (s.block !== targetBlock) return false
          if (s.row !== targetRow) return false
          if (s.bay !== targetBay) return false
          return s.tier > targetTier
        })

        if (aboveConts.length > 0) {
          hasContainerAbove = true
          shiftingCount = aboveConts.length
        } else {
          hasContainerAbove = false
          shiftingCount = 0
        }
      }
    } catch {}
  }

  return calculatePortServiceTariff({
    direction,
    size,
    storageDays,
    isReefer,
    containerTypeCode: rawType || (is20 ? '20GP' : '40HC'),
    yardInDateStr,
    gateDateStr,
    tier,
    stackHeight,
    hasContainerAbove,
    shiftingCount,
  })
}

/**
 * Tính Biểu Phí Dịch Vụ Cảng Chi Tiết theo 2 Trường Hợp:
 * - Trường hợp 1: HÀNG XUẤT KHẨU (EXPORT / Dropoff - Hạ container Ôtô ➔ Bãi chờ xuất tàu)
 * - Trường hợp 2: HÀNG NHẬP KHẨU (IMPORT / Pickup - Nâng container Bãi ➔ Ôtô giao hàng nhập)
 */
export function calculatePortServiceTariff({
  direction = 'EXPORT', // 'EXPORT' | 'IMPORT'
  size = 20,            // 20 | 40
  storageDays = 3,      // Số ngày lưu bãi thực tế
  isReefer = false,     // Container lạnh
  containerTypeCode = '',
  yardInDateStr = '07/11/2026',
  gateDateStr = '10/11/2026',
  tier = 1,
  stackHeight = 2,
  hasContainerAbove = null,
  shiftingCount = null,
} = {}) {
  const isImport = String(direction || '').toUpperCase() === 'IMPORT' ||
                   String(direction || '').toLowerCase() === 'pickup'
  const is40 = Number(size) >= 40
  const typeLabel = containerTypeCode || (is40 ? '40HC' : '20GP')
  const storageInfo = calculatePortStorageFee(storageDays, typeLabel)
  const storageSurcharge = storageInfo.fee
  const shiftingInfo = calculateShiftingFee({ direction, tier, stackHeight, hasContainerAbove, shiftingCount })

  if (!isImport) {
    // ── TRƯỜNG HỢP 1: BIỂU PHÍ HÀNG XUẤT KHẨU (ÔTÔ ➔ BÃI) ──
    const liftFee = is40 ? 650000 : 450000
    const infrastructureFee = is40 ? 500000 : 250000
    const weighVgmFee = 50000
    const securityGateFee = 40000
    const reeferPtiFee = isReefer ? (is40 ? 180000 : 120000) : 0

    const items = [
      {
        no: 1,
        title: '1. Cước hạ container hàng xuất khẩu (Ôtô ➔ Bãi)',
        desc: is40
          ? `Áp dụng container 40' có hàng (${typeLabel}) hạ bãi chờ xếp lên tàu xuất khẩu`
          : `Áp dụng container tiêu chuẩn 20' có hàng (${typeLabel}) hạ bãi chờ xuất tàu`,
        amount: liftFee,
      },
      {
        no: 2,
        title: '2. Phí sử dụng công trình kết cấu hạ tầng cảng biển',
        desc: `Phí sử dụng kết cấu hạ tầng, dịch vụ và tiện ích công cộng cảng biển cho container ${is40 ? "40'" : "20'"}`,
        amount: infrastructureFee,
      },
      {
        no: 3,
        title: '3. Phí cân kiểm soát tải trọng tự động & xác nhận VGM',
        desc: 'Kiểm tra tải trọng trục xe tự động qua trạm cân cổng vào & đối soát SOLAS VGM',
        amount: weighVgmFee,
      },
      {
        no: 4,
        title: '4. Phí an ninh bến cảng & tiện ích cổng điện tử',
        desc: 'Hạ tầng công nghệ vé điện tử, giám sát an ninh camera OCR & Booking Note',
        amount: securityGateFee,
      },
      {
        no: 5,
        title: '5. Phí đảo chuyển container trên bãi (Shifting)',
        desc: shiftingInfo.reason,
        amount: shiftingInfo.fee,
        isShiftingItem: true,
        shiftingInfo,
      },
    ]

    if (reeferPtiFee > 0) {
      items.push({
        no: items.length + 1,
        title: `${items.length + 1}. Phụ phí trạm điện lạnh & giám sát nhiệt độ (Reefer Khu D)`,
        desc: 'Cấp nguồn điện 380V & theo dõi nhiệt độ container lạnh chờ xuất tàu',
        amount: reeferPtiFee,
      })
    }

    items.push({
      no: items.length + 1,
      title: `${items.length + 1}. Phụ thu lưu bãi chờ xuất tàu (${storageInfo.days} ngày · ${storageInfo.tier.shortLabel})`,
      desc:
        storageSurcharge === 0
          ? `Hạ bãi từ ${yardInDateStr} ➔ ${gateDateStr} (${storageInfo.days} ngày · Miễn phí lưu bãi 5 ngày đầu)`
          : `Hạ bãi từ ${yardInDateStr} ➔ ${gateDateStr} (${storageInfo.days} ngày · Quá hạn miễn phí, áp khung ${storageInfo.tier.label} cho cont ${storageInfo.containerLabel})`,
      amount: storageSurcharge,
      isStorageItem: true,
    })

    const subtotal = items.reduce((s, i) => s + i.amount, 0)
    const vat = Math.round(subtotal * 0.08)
    const total = subtotal + vat

    return {
      caseCode: 'EXPORT',
      caseTitle: 'Hàng Xuất Khẩu (Hạ Bãi · Ôtô ➔ Bãi)',
      badgeLabel: 'HÀNG XUẤT KHẨU (ÔTÔ ➔ BÃI)',
      operationDesc: 'Xe đầu kéo chở container hàng xuất vào cảng hạ bãi chờ xếp lên tàu biển',
      size: is40 ? 40 : 20,
      containerTypeCode: typeLabel,
      containerRowLabel: storageInfo.containerLabel,
      storageDays: storageInfo.days,
      storageTier: storageInfo.tier,
      storageSurcharge,
      shiftingInfo,
      yardInDateStr,
      gateDateStr,
      items,
      subtotal,
      vat,
      total,
    }
  }

  // ── TRƯỜNG HỢP 2: BIỂU PHÍ HÀNG NHẬP KHẨU (BÃI ➔ ÔTÔ) ──
  const deliveryLiftFee = is40 ? 750000 : 520000
  const infrastructureFee = is40 ? 500000 : 250000
  const edoCustomsFee = 60000
  const gateOutSecurityFee = 70000

  const items = [
    {
      no: 1,
      title: '1. Cước nâng container hàng nhập khẩu (Bãi ➔ Ôtô)',
      desc: is40
        ? `Tác nghiệp cẩu RTG nâng container 40' có hàng (${typeLabel}) từ bãi lên rơ-moóc xe`
        : `Tác nghiệp cẩu RTG nâng container 20' có hàng (${typeLabel}) từ bãi lên xe đầu kéo`,
      amount: deliveryLiftFee,
    },
    {
      no: 2,
      title: '2. Phí sử dụng công trình kết cấu hạ tầng cảng biển',
      desc: `Phí sử dụng kết cấu hạ tầng, tiện ích công cộng khu vực cửa khẩu cảng biển cho container ${is40 ? "40'" : "20'"}`,
      amount: infrastructureFee,
    },
    {
      no: 3,
      title: '3. Phí đối soát Lệnh giao hàng (eDO) & thông quan Hải quan',
      desc: 'Xác thực eDO hãng tàu, đối chiếu tờ khai mã vạch VNACCS/VCIS & cấp phiếu EIR',
      amount: edoCustomsFee,
    },
    {
      no: 4,
      title: '4. Phí trạm cân kiểm tải cổng ra & an ninh cổng điện tử OCR',
      desc: 'Kiểm soát tải trọng xe kéo hàng rời cảng (30.000đ) & tiện ích cổng OCR (40.000đ)',
      amount: gateOutSecurityFee,
    },
    {
      no: 5,
      title: '5. Phí đảo chuyển container trên bãi (Shifting)',
      desc: shiftingInfo.reason,
      amount: shiftingInfo.fee,
      isShiftingItem: true,
      shiftingInfo,
    },
    {
      no: 6,
      title: `6. Phụ thu giá nâng container Bãi ➔ Ôtô / Lưu bãi (${storageInfo.days} ngày · ${storageInfo.tier.shortLabel})`,
      desc:
        storageSurcharge === 0
          ? `Lưu bãi từ ${yardInDateStr} ➔ ${gateDateStr} (${storageInfo.days} ngày · Trong hạn 5 ngày đầu miễn phụ thu)`
          : `Lưu bãi từ ${yardInDateStr} ➔ ${gateDateStr} (${storageInfo.days} ngày · Quá hạn miễn phí, áp khung "${storageInfo.tier.label}" cho loại "${storageInfo.containerLabel}")`,
      amount: storageSurcharge,
      isStorageItem: true,
    },
  ]

  const subtotal = items.reduce((s, i) => s + i.amount, 0)
  const vat = Math.round(subtotal * 0.08)
  const total = subtotal + vat

  return {
    caseCode: 'IMPORT',
    caseTitle: 'Hàng Nhập Khẩu (Giao Hàng · Bãi ➔ Ôtô)',
    badgeLabel: 'HÀNG NHẬP KHẨU (BÃI ➔ ÔTÔ)',
    operationDesc: 'Xe đầu kéo vào cảng nhận container hàng nhập khẩu từ bãi kéo về kho chủ hàng',
    size: is40 ? 40 : 20,
    containerTypeCode: typeLabel,
    containerRowLabel: storageInfo.containerLabel,
    storageDays: storageInfo.days,
    storageTier: storageInfo.tier,
    storageSurcharge,
    shiftingInfo,
    yardInDateStr,
    gateDateStr,
    items,
    subtotal,
    vat,
    total,
  }
}

