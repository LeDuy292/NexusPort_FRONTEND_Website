/**
 * manifestPortSyncService.js
 * Dịch vụ đồng bộ dữ liệu Bản Khai Hàng Hóa (Manifest) giữa 3 phân hệ:
 * 1. Hãng Tàu (Shipping Line) -> Gửi Bản khai Manifest sang Cảng Tiên Sa (Trạng thái: Chờ phê duyệt).
 * 2. Điều Độ Cảng (Gate Booking) -> Bấm Phê duyệt Tàu -> Tách thành các Bảng mới chia theo từng Công ty vận tải.
 *    Lúc mới duyệt tàu xong: CHƯA CÓ TÀI XẾ, CHƯA CÓ XE ĐẦU KÉO, CHƯA CÓ GIỜ HẸN (Trạng thái: Chờ Transport gửi lại).
 * 3. Công Ty Vận Tải (Transport Company - /booking) -> Nhận danh sách Container của công ty mình,
 *    điều phối Xe đầu kéo + Tài xế + Khung giờ ETA + Chứng từ (eDO, Tờ khai HQ, VGM, GPLX, Đăng kiểm) và GỬI LẠI CHO CẢNG.
 *    Sau khi Transport gửi lại -> Bên Gate Booking mới hiện Xe, Tài xế, Giờ hẹn và mở nút "Kiểm duyệt" để xét duyệt vào cổng!
 */

import { yardReservationStore } from './yardReservationStore'
import { shippingLineApi } from '../pages/ShippingLine/api/shippingLineApi'
import yardDischargeService from './yardDischargeService'

const STORAGE_KEY = 'nexusport_synced_manifests_v12'
const GENERATED_BOOKINGS_KEY = 'nexusport_manifest_gate_bookings_v12'

/**
 * Phân tích chuỗi tọa độ vị trí bãi thành cấu trúc chuẩn (Block, Bay, Row, Tier)
 */
export function parseSlotCoordinate(slotStr) {
  if (!slotStr) return null
  const clean = String(slotStr).trim().toUpperCase()

  // Format 1: D01-22-01-1 or D01-22-1-1 or D01.22.01.1 or D01_22_01_1 or R-02-01-1
  let m = clean.match(/^([A-Z][0-9]{2}|[A-Z])[-\._](?:B)?(\d+)[-\._](?:R)?(\d+)[-\._](?:T)?(\d+)$/i)
  if (m) {
    let blockCode = m[1].length === 1 ? (m[1] === 'R' ? 'D01' : `${m[1]}01`) : m[1]
    const bay = parseInt(m[2], 10)
    const row = parseInt(m[3], 10)
    const tier = parseInt(m[4], 10)
    return {
      blockCode,
      bay,
      row,
      tier,
      formattedSlot: `Block ${blockCode} · Bay ${String(bay).padStart(2, '0')} (${row}-${tier})`,
      slotCode: `${blockCode}.${String(bay).padStart(2, '0')}.${String(row).padStart(2, '0')}.${tier}`,
      coordinate: `${blockCode}-${String(bay).padStart(2, '0')}-${String(row).padStart(2, '0')}-${tier}`,
    }
  }

  // Format 2: Block D01 · Bay 02 (1-1) or Block D01 - Bay 02 (1-1)
  m = clean.match(/BLOCK\s+([A-Z0-9]+)\s*[·\-\–_]\s*BAY\s*(\d+)\s*\(([0-9]+)\s*[-/_]\s*([0-9]+)\)/i)
  if (m) {
    const blockCode = m[1]
    const bay = parseInt(m[2], 10)
    const row = parseInt(m[3], 10)
    const tier = parseInt(m[4], 10)
    return {
      blockCode,
      bay,
      row,
      tier,
      formattedSlot: `Block ${blockCode} · Bay ${String(bay).padStart(2, '0')} (${row}-${tier})`,
      slotCode: `${blockCode}.${String(bay).padStart(2, '0')}.${String(row).padStart(2, '0')}.${tier}`,
      coordinate: `${blockCode}-${String(bay).padStart(2, '0')}-${String(row).padStart(2, '0')}-${tier}`,
    }
  }

  // Format 3: D01-B02-R01-T1
  m = clean.match(/^([A-Z0-9]+)-B(\d+)-R(\d+)-T(\d+)$/i)
  if (m) {
    const blockCode = m[1]
    const bay = parseInt(m[2], 10)
    const row = parseInt(m[3], 10)
    const tier = parseInt(m[4], 10)
    return {
      blockCode,
      bay,
      row,
      tier,
      formattedSlot: `Block ${blockCode} · Bay ${String(bay).padStart(2, '0')} (${row}-${tier})`,
      slotCode: `${blockCode}.${String(bay).padStart(2, '0')}.${String(row).padStart(2, '0')}.${tier}`,
      coordinate: `${blockCode}-${String(bay).padStart(2, '0')}-${String(row).padStart(2, '0')}-${tier}`,
    }
  }

  // Format 4: Block D01 · Bay 02 · Tầng 2 · Hàng 01 or Block D01 • Bay 02 • Tầng 2 • Hàng 01
  m = clean.match(/BLOCK\s+([A-Z0-9]+).*?BAY\s*(\d+).*?TẦNG\s*(\d+).*?HÀNG\s*(\d+)/i)
  if (m) {
    const blockCode = m[1]
    const bay = parseInt(m[2], 10)
    const tier = parseInt(m[3], 10)
    const row = parseInt(m[4], 10)
    return {
      blockCode,
      bay,
      row,
      tier,
      formattedSlot: `Block ${blockCode} · Bay ${String(bay).padStart(2, '0')} (${row}-${tier})`,
      slotCode: `${blockCode}.${String(bay).padStart(2, '0')}.${String(row).padStart(2, '0')}.${tier}`,
      coordinate: `${blockCode}-${String(bay).padStart(2, '0')}-${String(row).padStart(2, '0')}-${tier}`,
    }
  }

  return null
}

/**
 * Tự động phân bổ & đặt vị trí bãi (Auto Yard Slot Placement) theo đúng loại Container:
 * - Cont Lạnh (Reefer: 40RF, 20RF, hoặc có nhiệt độ âm): Đặt vào Khu D - Bãi cont lạnh (Block D01, D02) có ổ cắm điện Reefer.
 * - Cont Nguy Hiểm (DG / IMO Class): Đặt vào Khu E - Bãi tổng hợp / hàng nguy hiểm (Block E01).
 * - Cont Thường Xuất Khẩu (Export Dry: 40HC, 20GP): Đặt vào Khu A - Sau cầu 4–5 (Block A01, A02).
 * - Cont Thường Nhập Khẩu (Import Dry: 40HC, 20GP): Đặt vào Khu B - Bãi container 1 (Block B01, B02).
 */

/**
 * QUY TẮC SẮP XẾP CONTAINER TRƯỚC KHI PHÂN BỔ BÃI TỰ ĐỘNG (Smart Yard Pre-Sorting Rule):
 * 1. Hàng Lạnh (Reefer) và Hàng Nguy Hiểm (DG) ưu tiên xếp đầu danh sách để cấp ô đặc thù (ổ cắm / cách ly)
 * 2. Gom nhóm theo Vận Đơn (B/L) hoặc Chủ hàng để đặt liền kề nhau trong cùng Bay / Block
 * 3. Quy tắc tải trọng bãi (Heavy at bottom): Sắp xếp theo trọng lượng tổng giảm dần (Cont nặng hạ Tier 1, Cont nhẹ lên Tier 2-3)
 * 4. Kích thước container (40ft xếp bay chẵn, 20ft xếp bay lẻ)
 */
export function sortContainersForYardAllocation(containers = []) {
  if (!Array.isArray(containers)) return []
  return [...containers].sort((a, b) => {
    const aIso = String(a.isoType || a.containerType || '').toUpperCase()
    const bIso = String(b.isoType || b.containerType || '').toUpperCase()
    const aTemp = String(a.tempRequired || '').toLowerCase()
    const bTemp = String(b.tempRequired || '').toLowerCase()
    const aDg = String(a.dgClass || '').toUpperCase()
    const bDg = String(b.dgClass || '').toUpperCase()

    const aIsReefer = Boolean(a.isReefer) || /RF|RH|R[01]/.test(aIso) || aTemp.includes('-') || aTemp.includes('frozen')
    const bIsReefer = Boolean(b.isReefer) || /RF|RH|R[01]/.test(bIso) || bTemp.includes('-') || bTemp.includes('frozen')

    const aIsDG = aDg.includes('IMO') || aDg.includes('CLASS')
    const bIsDG = bDg.includes('IMO') || bDg.includes('CLASS')

    const aPriority = aIsReefer ? 3 : (aIsDG ? 2 : 1)
    const bPriority = bIsReefer ? 3 : (bIsDG ? 2 : 1)
    if (aPriority !== bPriority) {
      return bPriority - aPriority // Reefer (3) -> DG (2) -> Dry (1)
    }

    // 2. Gom nhóm theo Vận Đơn (B/L)
    const aBl = String(a.blNumber || a.cargoDeclarationId || a.transportCompany || '').trim().toUpperCase()
    const bBl = String(b.blNumber || b.cargoDeclarationId || b.transportCompany || '').trim().toUpperCase()
    if (aBl && bBl && aBl !== bBl) {
      return aBl.localeCompare(bBl)
    }

    // 3. Xếp theo trọng lượng tổng giảm dần (Heavy first)
    const aWeight = Number(a.grossWeightKg || a.weight || 20000)
    const bWeight = Number(b.grossWeightKg || b.weight || 20000)
    if (aWeight !== bWeight) {
      return bWeight - aWeight
    }

    // 4. Kích thước: 40ft trước, 20ft sau
    const aIs20 = aIso.startsWith('20')
    const bIs20 = bIso.startsWith('20')
    if (aIs20 !== bIs20) {
      return aIs20 ? 1 : -1
    }

    return 0
  })
}

export function computeAutoYardSlot(container, direction = 'EXPORT', index = 0, contextList = []) {
  const iso = String(container?.isoType || container?.containerType || '40HC').toUpperCase()
  const temp = String(container?.tempRequired || '')
  const dg = String(container?.dgClass || '')
  const is20 = iso.startsWith('20')
  const size = is20 ? 20 : 40
  const grossWeightKg = Number(container?.grossWeightKg || container?.weight || 24000)
  const isHeavy = grossWeightKg >= 22000
  const blNumber = String(container?.blNumber || container?.cargoDeclarationId || '').trim().toUpperCase()

  const isReefer = Boolean(container?.isReefer) || /RF|RH|R[01]/.test(iso) || temp.includes('-') || temp.toLowerCase().includes('frozen')
  const isDG = dg.includes('IMO') || dg.includes('Class')

  let zoneCode = 'B'
  let zoneName = 'Khu B · Bãi Cont Xuất Khẩu Gần Cổng Gate 1 (Dễ Giao Nhận)'
  let blockCode = 'B01'
  let cargoCategory = 'Cont Khô Xuất Khẩu (Gần Cổng Gate)'
  let badgeTheme = 'emerald'

  if (isReefer) {
    zoneCode = 'D'
    zoneName = 'Khu D · Bãi Container Lạnh (Reefer Zone)'
    blockCode = 'D01'
    cargoCategory = 'Container lạnh (Reefer)'
    badgeTheme = 'cyan'
  } else if (isDG) {
    zoneCode = 'E'
    zoneName = 'Khu E · Bãi Hàng Nguy Hiểm (DG Hazmat)'
    blockCode = 'E01'
    cargoCategory = `Cont Nguy Hiểm (${dg || 'IMO'})`
    badgeTheme = 'rose'
  } else if (direction === 'IMPORT') {
    // HÀNG NHẬP: Dỡ từ tàu xuống bãi -> Đặt GẦN BIỂN / CẦU TÀU (Khu A sát Cầu 4-5) để cẩu bốc dỡ ngay
    zoneCode = 'A'
    zoneName = 'Khu A · Bãi Cont Nhập Khẩu Sát Cầu Tàu 4–5 (Gần Biển)'
    blockCode = 'A01'
    cargoCategory = 'Cont Khô Nhập Khẩu (Dỡ Tàu Gần Biển)'
    badgeTheme = 'blue'
  } else {
    // HÀNG XUẤT: Xe tải từ ngoài vào hạ hàng hoặc lấy hàng -> Đặt GẦN CỔNG GATE (Khu F / Khu E sát Cổng Gate 1) để xe dễ vào/ra, TUYỆT ĐỐI TRÁNH khu C01 gần biển
    zoneCode = 'F'
    zoneName = 'Khu F · Bãi Cont Xuất Khẩu Sát Cổng Gate 1 (Dễ Giao Nhận)'
    blockCode = (index % 2 === 0) ? 'F01' : 'E01'
    cargoCategory = 'Cont Khô Xuất Khẩu (Sát Cổng Gate 1)'
    badgeTheme = 'emerald'
  }

  // Phân bổ ô bãi không va chạm (Collision-free placement):
  // - Đối với cont 40ft: Mỗi cont chiếm 2 bay 20ft liền kề (Bay chẵn: 02, 06, 10, 14, 18, 22, 26, 30).
  // - Đối với cont 20ft: Bay lẻ: 01, 03, 05, 07, 09, 11, 13, 15...
  const bayNum = is20 ? (1 + (index % 16) * 2) : (2 + (index % 8) * 4)
  const bayStr = String(bayNum).padStart(2, '0')
  const rowNum = is20 ? (Math.floor(index / 16) + 1) : (Math.floor(index / 8) + 1)
  const rowStr = String(rowNum).padStart(2, '0')

  // Quy tắc xếp tầng (Tier stacking rule):
  // - Cont nặng (>= 22 tấn): Ưu tiên Tier 1 (hạ đất vững chắc, trọng tâm thấp chống lật)
  // - Cont trung bình (16 - 22 tấn): Tier 1 hoặc Tier 2
  // - Cont nhẹ (< 16 tấn): Tier 2 hoặc Tier 3
  let tierNum = 1
  if (isHeavy) {
    tierNum = 1
  } else if (grossWeightKg > 16000) {
    tierNum = (index % 2 === 0) ? 1 : 2
  } else {
    tierNum = 2 + (index % 2)
  }
  if (tierNum > 3) tierNum = 3

  const posId = `${blockCode}-B${bayStr}-R${rowNum}-T${tierNum}`
  const defaultGate = 'Gate 1'

  // Thuật toán chấm điểm và ghi chú phân bổ
  const reasons = []
  let score = 70
  if (isReefer) {
    score += 25
    reasons.push('Khu lạnh Block D01 có ổ cắm điện (+25đ)')
  } else if (isDG) {
    score += 20
    reasons.push(`Khu cách ly hàng nguy hiểm Block E01 (+20đ)`)
  } else if (direction === 'IMPORT') {
    score += 20
    reasons.push('Hàng nhập dỡ từ tàu đặt gần Biển / Cầu tàu 4–5 bốc dỡ thuận lợi (+20đ)')
  } else {
    score += 25
    reasons.push(`Hàng xuất đặt tại Block ${blockCode} sát Cổng Gate 1 cho xe tải ngoài dễ vào giao nhận / lấy hàng (+25đ)`)
  }

  if (blNumber) {
    score += 10
    reasons.push(`Gom nhóm theo B/L ${blNumber} (+10đ)`)
  }

  if (isHeavy && tierNum === 1) {
    score += 15
    reasons.push(`Tải trọng ${Math.round(grossWeightKg / 1000)}T hạ Tier 1 vững chắc (+15đ)`)
  } else if (!isHeavy && tierNum >= 2) {
    score += 10
    reasons.push(`Hàng nhẹ ${Math.round(grossWeightKg / 1000)}T xếp Tier ${tierNum} tối ưu luân chuyển (+10đ)`)
  }

  const allocationReason = reasons.join('; ')

  return {
    slotId: posId,
    posId,
    zoneCode,
    zoneName,
    blockCode,
    bay: bayNum,
    bayCode: bayStr,
    bayDisplay: `Bay ${bayStr}`,
    row: rowNum,
    rowCode: rowStr,
    tier: tierNum,
    tierCode: String(tierNum),
    gate: 'Gate 1',
    gateDisplay: 'Gate 1 (Cổng Cảng Tiên Sa)',
    slotName: `Khu ${blockCode} · Bay ${bayStr} (R${rowStr}-T${tierNum})`,
    fullLocation: `Block ${blockCode} · Bay ${bayStr} · Row ${rowStr} · Tier ${tierNum}`,
    size,
    isoType: iso,
    isReefer,
    isDG,
    grossWeightKg,
    blNumber,
    allocationScore: Math.min(100, score),
    allocationReason,
    tempRequired: isReefer ? (temp || '-18.0°C') : null,
    cargoCategory,
    badgeTheme,
    autoAssigned: true,
    assignedAt: new Date().toLocaleString('vi-VN'),
  }
}

// Danh sách Công ty vận tải đối tác & Đội xe gợi ý khi Transport điều phối gửi lại cho Cảng
export const TRANSPORT_COMPANIES_POOL = [
  {
    companyName: 'Bien Dong Logistics - Nexus Logistics',
    companyId: 'c1010101-0000-0000-0000-000000000001',
    contactPerson: 'Võ Hàng Tàu (Điều độ Đội xe Biển Đông)',
    phone: '0909 123 889',
    email: 'carrier01@nexusport.vn',
    fleetOptions: [
      {
        licensePlate: '47AB-294.69',
        trailerPlate: '47R-012.88',
        driverName: 'TRẦN VĂN TÙNG',
        licenseNumber: '660225020133',
        idCardNumber: '066204016135',
        driverPhone: '0905 881 234',
        requestedGate: 'Gate 1',
        etaTime: '08:00 - 10:00',
        licenseImageUrl: 'https://nexusport.s3.us-east-1.amazonaws.com/NexusPort/drivers/gplx_cbae2e1c-bf49-4346-aea6-085acd02c15b.jpg?X-Amz-Expires=604800&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA5C5O6BXI7OI77VFE%2F20261014%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261014T115523Z&X-Amz-SignedHeaders=host&X-Amz-Signature=fb6971d5a14d223b8d9e1f2b413dbaceeea96179441e5fb9607a16bc5e775a55',
        idCardFrontUrl: 'https://nexusport.s3.us-east-1.amazonaws.com/NexusPort/drivers/cccd_front_c0e972b9-7e6e-4514-a38f-471e739e6c56.jpg?X-Amz-Expires=604800&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA5C5O6BXI7OI77VFE%2F20261014%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261014T115457Z&X-Amz-SignedHeaders=host&X-Amz-Signature=5c01f2520f71da01823a66c6f614e5b1f909f2e500fbc478c9dd12a3551b64b9',
      },
      {
        licensePlate: '47AB-882.15',
        trailerPlate: '47R-045.19',
        driverName: 'ĐẶNG QUỐC HUY',
        licenseNumber: 'FC-884120',
        idCardNumber: '001309053398',
        driverPhone: '0905 772 911',
        requestedGate: 'Gate 1',
        etaTime: '08:30 - 10:30',
        licenseImageUrl: 'https://nexusport.s3.us-east-1.amazonaws.com/NexusPort/drivers/gplx_874a7389-3e6a-4ed5-b9ff-74a30d1e5878.jpg?X-Amz-Expires=604800&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA5C5O6BXI7OI77VFE%2F20261017%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261017T170506Z&X-Amz-SignedHeaders=host&X-Amz-Signature=3d13ab2f80cfe8a6d52be00828b6130b035cabecb0aab8344315bc93c3635990',
        idCardFrontUrl: 'https://nexusport.s3.us-east-1.amazonaws.com/NexusPort/drivers/2d9ae45fac0c4f33ab5bd60683f5aa36.jpg',
      },
    ]
  },
  {
    companyName: 'Công ty Cổ phần Vận tải & Logistics Tiên Sa',
    companyId: 'tiensa-logistics-01',
    contactPerson: 'Nguyễn Văn Hùng (Trưởng phòng Điều phối)',
    phone: '0905 123 456',
    email: 'dieudo@tiensalogistics.com.vn',
    fleetOptions: [
      {
        licensePlate: '43C-567.89',
        trailerPlate: '43R-088.12',
        driverName: 'Nguyễn Văn Minh',
        licenseNumber: '660225020132',
        idCardNumber: '066204016131',
        driverPhone: '0913 445 678',
        requestedGate: 'Gate 1',
        etaTime: '09:00 - 11:00',
        licenseImageUrl: 'https://nexusport.s3.us-east-1.amazonaws.com/NexusPort/drivers/gplx_874a7389-3e6a-4ed5-b9ff-74a30d1e5878.jpg?X-Amz-Expires=604800&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA5C5O6BXI7OI77VFE%2F20261017%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261017T170506Z&X-Amz-SignedHeaders=host&X-Amz-Signature=3d13ab2f80cfe8a6d52be00828b6130b035cabecb0aab8344315bc93c3635990',
        idCardFrontUrl: 'https://nexusport.s3.us-east-1.amazonaws.com/NexusPort/drivers/cccd_front_42225215-912e-413c-b800-d9aad1c1023e.jpg?X-Amz-Expires=604800&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA5C5O6BXI7OI77VFE%2F20261017%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261017T170453Z&X-Amz-SignedHeaders=host&X-Amz-Signature=8291706ae6fce25e1c1357b87a7253964302286f1cf17737ae36613f245b968c',
      },
      {
        licensePlate: '43C-901.23',
        trailerPlate: '43R-091.45',
        driverName: 'Phan Thanh Bình',
        licenseNumber: '660225020139',
        idCardNumber: '066204016139',
        driverPhone: '0914 223 119',
        requestedGate: 'Gate 1',
        etaTime: '09:30 - 11:30',
        licenseImageUrl: 'https://nexusport.s3.us-east-1.amazonaws.com/NexusPort/drivers/gplx_20e6de34-fa9a-423c-999b-6c750b2800f3.jpg?X-Amz-Expires=604800&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA5C5O6BXI7OI77VFE%2F20261017%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261017T163025Z&X-Amz-SignedHeaders=host&X-Amz-Signature=306992292c1dff27ba891954785a2cd8eadbb63174ea0de65591207a678d1830',
        idCardFrontUrl: 'https://nexusport.s3.us-east-1.amazonaws.com/NexusPort/drivers/cccd_front_1724c3cf-bf5a-46f3-935a-05d975658333.jpg?X-Amz-Expires=604800&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA5C5O6BXI7OI77VFE%2F20261017%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261017T162950Z&X-Amz-SignedHeaders=host&X-Amz-Signature=4f11d6f15950dd595cbd1705903836c436125438bf12671720f4390ae5251d75',
      },
    ]
  },
  {
    companyName: 'Công ty TNHH Vận tải & Giao nhận Tân Cảng Đà Nẵng',
    companyId: 'tancang-danang-02',
    contactPerson: 'Trần Đình Nam (Điều độ vận tải)',
    phone: '0918 889 900',
    email: 'operations@tancangdanang.com.vn',
    fleetOptions: [
      { licensePlate: '43H-196.90', trailerPlate: '43R-112.05', driverName: 'Lê Hoàng Nam', licenseNumber: 'FC-992018', driverPhone: '0983 119 220', requestedGate: 'Gate 1', etaTime: '10:00 - 12:00' },
      { licensePlate: '43H-445.10', trailerPlate: '43R-209.33', driverName: 'Ngô Minh Tuấn', licenseNumber: 'FC-771234', driverPhone: '0988 554 321', requestedGate: 'Gate 1', etaTime: '10:30 - 12:30' },
    ]
  },
  {
    companyName: 'Công ty CP Tiếp Vận & Vận tải Miền Trung (CentralTrans)',
    companyId: 'central-trans-03',
    contactPerson: 'Võ Thị Kim Oanh (Bộ phận Khai báo Cảng)',
    phone: '0905 667 788',
    email: 'dispatch@centraltrans.vn',
    fleetOptions: [
      { licensePlate: '92C-884.12', trailerPlate: '92R-034.11', driverName: 'Phạm Quốc Bảo', licenseNumber: 'FC-338192', driverPhone: '0935 661 882', requestedGate: 'Gate 1', etaTime: '13:30 - 15:30' },
      { licensePlate: '92C-512.09', trailerPlate: '92R-077.80', driverName: 'Huỳnh Tấn Phát', licenseNumber: 'FC-619204', driverPhone: '0935 990 112', requestedGate: 'Gate 1', etaTime: '14:00 - 16:00' },
    ]
  },
  {
    companyName: 'Korao Logistics - Chi nhánh Đà Nẵng',
    companyId: 'cbb1317b-a692-402c-a47e-041ca619d241',
    contactPerson: 'Huy Phan (Điều hành Vận tải bộ)',
    phone: '0842 737 474',
    email: 'dispatch@koraologistics.vn',
    fleetOptions: [
      { licensePlate: '38AA-196.90', trailerPlate: '38R-019.90', driverName: 'Gia Huy', licenseNumber: 'FC-661209', driverPhone: '0842 737 474', requestedGate: 'Gate 1', etaTime: '14:30 - 16:30' },
      { licensePlate: '38C-771.25', trailerPlate: '38R-055.12', driverName: 'Trương Đình Khoa', licenseNumber: 'FC-710293', driverPhone: '0979 332 411', requestedGate: 'Gate 1', etaTime: '15:00 - 17:00' },
    ]
  },
]

// BỘ NHẬN DIỆN CÁC TÀU ĐÃ ĐƯỢC CẢNG PHÊ DUYỆT (LƯU TRÊN BỘ NHỚ ĐỂ F5 KHÔNG BỊ MẤT)
export const PERMANENT_APPROVED_MANIFESTS_KEY = 'nexusport_permanent_approved_manifests_v3'

export function extractManifestIdentifiers(m) {
  if (!m) return []
  if (typeof m === 'string') return [m.toUpperCase().trim()]
  const list = [
    m.id,
    m.manifestId,
    m.manifestNumber,
    m.voyageNumber,
    m.voyageInfo?.voyageNumber,
    m.payload?.voyageNumber,
    m.payload?.voyageInfo?.voyageNumber,
    m.vesselName,
    m.voyageInfo?.vesselName,
    m.payload?.vesselName,
    m.payload?.voyageInfo?.vesselName,
    m.bookingNumber,
    m.nswRef,
  ]
  if (Array.isArray(m.containers)) {
    m.containers.forEach(c => {
      if (c?.containerNumber) list.push(c.containerNumber)
    })
  }
  return list.filter(Boolean).map(k => String(k).toUpperCase().trim())
}

export function isManifestPermanentlyApproved(m) {
  if (!m) return false
  if (m.portApprovalStatus === 'PORT_APPROVED' || m.status === 'PORT_APPROVED') {
    return true
  }
  try {
    const list = JSON.parse(localStorage.getItem(PERMANENT_APPROVED_MANIFESTS_KEY) || '[]')
    if (!Array.isArray(list) || list.length === 0) {
      return m.portApprovalStatus === 'PORT_APPROVED' || m.status === 'PORT_APPROVED'
    }
    const keySet = new Set(list.map(k => String(k).toUpperCase().trim()))
    const candidates = extractManifestIdentifiers(m)
    return candidates.some(c => keySet.has(c)) || m.portApprovalStatus === 'PORT_APPROVED' || m.status === 'PORT_APPROVED'
  } catch {
    return m.portApprovalStatus === 'PORT_APPROVED' || m.status === 'PORT_APPROVED'
  }
}

export function registerPermanentlyApprovedManifest(m) {
  if (!m) return
  try {
    const list = JSON.parse(localStorage.getItem(PERMANENT_APPROVED_MANIFESTS_KEY) || '[]')
    const keySet = new Set((Array.isArray(list) ? list : []).map(k => String(k).toUpperCase().trim()))
    const candidates = extractManifestIdentifiers(m)
    candidates.forEach(c => keySet.add(c))
    localStorage.setItem(PERMANENT_APPROVED_MANIFESTS_KEY, JSON.stringify(Array.from(keySet)))
  } catch {}
}

export function unregisterPermanentlyApprovedManifest(m) {
  if (!m) return
  try {
    const list = JSON.parse(localStorage.getItem(PERMANENT_APPROVED_MANIFESTS_KEY) || '[]')
    const targetSet = new Set(extractManifestIdentifiers(m))
    const nextList = (Array.isArray(list) ? list : []).filter(k => !targetSet.has(String(k).toUpperCase().trim()))
    localStorage.setItem(PERMANENT_APPROVED_MANIFESTS_KEY, JSON.stringify(nextList))
  } catch {}
}

// Danh sách manifest mặc định đã được Hãng tàu truyền cho Cảng Tiên Sa (mặc định để rỗng khi reset về 0)
export const DEFAULT_SYNCED_MANIFESTS = []

const ORDER_FLEET_KEY = 'NEXUSPORT_ORDER_FLEET_MAP'

function clearLocalSyncStorage() {
  for (const key of Object.keys(localStorage)) {
    if (
      /^nexusport_(synced_manifests|manifest_gate_bookings|manifest_generated_gate_bookings|permanent_approved)/.test(key) ||
      key.includes('yard_reservations') ||
      key.includes('yard_reservation') ||
      key.includes('yard_slots') ||
      key.includes('yard_plans')
    ) {
      localStorage.removeItem(key)
    }
  }
  localStorage.removeItem(PERMANENT_APPROVED_MANIFESTS_KEY)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
  localStorage.setItem(GENERATED_BOOKINGS_KEY, JSON.stringify([]))
  localStorage.removeItem(ORDER_FLEET_KEY)
  localStorage.removeItem('NEXUSPORT_PORT_BILLS')
  localStorage.removeItem('NEXUSPORT_STORAGE_FEES')
  localStorage.removeItem('NEXUSPORT_TRANSPORT_SUBMISSIONS_ALERT')
  localStorage.removeItem('NEXUSPORT_DISMISSED_BILLS')
  localStorage.setItem('yard_reservations_backup', JSON.stringify([]))
  try {
    yardReservationStore.clearAll()
  } catch { /* ignore */ }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('yard-reservation-updated', { detail: { allCleared: true } }))
  }
}

// Reset marker để xóa sạch toàn bộ dữ liệu tàu cũ và khởi động trống để test lại từ đầu
const RESET_MARKER = 'nexusport_manifest_reset_clean_slate_20261117_v5'
try {
  if (!localStorage.getItem(RESET_MARKER)) {
    clearLocalSyncStorage()
    localStorage.setItem(RESET_MARKER, '1')
  }
} catch { /* Storage may be unavailable in private browsing. */ }

export const manifestPortSyncService = {
  /**
   * Lưu thông tin xe & tài xế thực tế theo đơn dịch vụ / container
   */
  saveOrderFleet(keys, fleetData) {
    if (!keys || !fleetData) return
    try {
      const map = JSON.parse(localStorage.getItem(ORDER_FLEET_KEY) || '{}')
      const keyArr = Array.isArray(keys) ? keys : [keys]
      keyArr.forEach(k => {
        if (k) {
          const cleanK = String(k).trim().toUpperCase()
          map[cleanK] = { ...(map[cleanK] || {}), ...fleetData }
        }
      })
      localStorage.setItem(ORDER_FLEET_KEY, JSON.stringify(map))
    } catch (e) {
      console.warn('Lỗi lưu order fleet map:', e)
    }
  },

  /**
   * Xóa thông tin xe & tài xế (và hóa đơn/phí tạm nếu có) theo danh sách key khỏi localStorage
   */
  clearOrderFleet(keys) {
    if (!keys) return
    const keyArr = (Array.isArray(keys) ? keys : [keys])
      .filter(Boolean)
      .map(k => String(k).trim())
      .filter(Boolean)
    if (keyArr.length === 0) return

    const upperKeys = new Set()
    keyArr.forEach(k => {
      const u = k.toUpperCase()
      upperKeys.add(u)
      const digits = u.match(/\d{4}$/)?.[0]
      if (digits) upperKeys.add(digits)
    })

    try {
      const map = JSON.parse(localStorage.getItem(ORDER_FLEET_KEY) || '{}')
      let mapChanged = false
      upperKeys.forEach(k => {
        if (Object.prototype.hasOwnProperty.call(map, k)) {
          delete map[k]
          mapChanged = true
        }
      })
      if (mapChanged) {
        localStorage.setItem(ORDER_FLEET_KEY, JSON.stringify(map))
      }
    } catch (e) {
      console.warn('Lỗi xóa order fleet map:', e)
    }

    for (const storeKey of ['NEXUSPORT_PORT_BILLS', 'NEXUSPORT_STORAGE_FEES']) {
      try {
        const obj = JSON.parse(localStorage.getItem(storeKey) || '{}')
        let changed = false
        keyArr.forEach(k => {
          if (Object.prototype.hasOwnProperty.call(obj, k)) {
            delete obj[k]
            changed = true
          }
          const totalKey = `BILL-${k}-TOTAL`
          if (Object.prototype.hasOwnProperty.call(obj, totalKey)) {
            delete obj[totalKey]
            changed = true
          }
        })
        if (changed) {
          localStorage.setItem(storeKey, JSON.stringify(obj))
        }
      } catch { /* ignore */ }
    }
  },

  /**
   * Gỡ bỏ xe & tài xế khỏi Gate Booking (localStorage + PostgreSQL) khi đơn ePort bị từ chối/hủy
   * và không còn đơn ePort hợp lệ nào khác gán cho container đó.
   */
  async unassignRejectedOrderFromGateBookings(rejectedOrder, activeOrders = [], { silent = false } = {}) {
    if (!rejectedOrder) return false

    const extractOrderContainers = (ord) => {
      const set = new Set()
      if (!ord) return set
      ;(ord.containers || []).forEach(c => {
        const num = String(c?.containerNumber || c?.containerNo || c || '').trim().toUpperCase()
        if (num) set.add(num)
      })
      ;(ord.content?.lines || []).forEach(l => {
        const num = String(l?.declaration?.containerNumber || l?.containerNumber || '').trim().toUpperCase()
        if (num) set.add(num)
      })
      ;(ord.containerSnapshots || ord.container_snapshots || []).forEach(c => {
        const num = String(c?.containerNumber || '').trim().toUpperCase()
        if (num) set.add(num)
      })
      ;(String(ord.sourceLabel || '').toUpperCase().match(/[A-Z]{4}\d{7}/g) || []).forEach(num => {
        if (num) set.add(num)
      })
      return set
    }

    const rejectedConts = extractOrderContainers(rejectedOrder)
    const validActiveOrders = (Array.isArray(activeOrders) ? activeOrders : []).filter(o => {
      const st = String(o?.status || o?.orderStatus || '').toUpperCase()
      return !['REJECTED', 'CANCELLED', 'DRAFT'].includes(st) && (!rejectedOrder.id || o?.id !== rejectedOrder.id)
    })

    const activeConts = new Set()
    validActiveOrders.forEach(ao => {
      extractOrderContainers(ao).forEach(c => activeConts.add(c))
    })

    // Xóa cache fleet của những container không còn nằm trong đơn hợp lệ nào
    const keysToClear = []
    rejectedConts.forEach(c => {
      if (!activeConts.has(c)) keysToClear.push(c)
    })
    if (rejectedOrder.id) keysToClear.push(rejectedOrder.id)
    if (rejectedOrder.number) keysToClear.push(rejectedOrder.number)
    if (keysToClear.length > 0) {
      this.clearOrderFleet(keysToClear)
    }

    let rawBookings = []
    try {
      rawBookings = JSON.parse(localStorage.getItem(GENERATED_BOOKINGS_KEY) || '[]')
      if (!Array.isArray(rawBookings)) rawBookings = []
    } catch {
      rawBookings = []
    }

    let bookingsChanged = false
    const touchedManifestKeys = new Set()
    const rejId = rejectedOrder.id ? String(rejectedOrder.id) : null
    const rejNum = rejectedOrder.number ? String(rejectedOrder.number).toUpperCase() : null

    const updatedRaw = rawBookings.map(b => {
      const bCont = String(b.containerId || '').trim().toUpperCase()
      const matchesRejected =
        (bCont && rejectedConts.has(bCont)) ||
        (rejId && b.eportOrderId === rejId) ||
        (rejNum && String(b.eportOrderNumber || '').toUpperCase() === rejNum)

      if (!matchesRejected) return b
      if (bCont && activeConts.has(bCont)) return b

      this.clearOrderFleet([bCont, b.id, b.bookingCode])
      this.dismissTransportSubmissionAlert(b.id)

      const needsReset =
        b.status !== 'WaitingTransport' ||
        Boolean(b.transportSubmitted) ||
        Boolean(b.licensePlate) ||
        Boolean(b.vehiclePlate) ||
        Boolean(b.suggestedPlate) ||
        Boolean(b.driverName) ||
        Boolean(b.suggestedDriver) ||
        Boolean(b.eportOrderId) ||
        Boolean(b.eportOrderNumber) ||
        Boolean(b.portBill) ||
        Boolean(b.portBillPaid)

      if (!needsReset) return b

      bookingsChanged = true
      if (b.sourceManifestId || b.sourceManifestNumber) {
        touchedManifestKeys.add(b.sourceManifestId || b.sourceManifestNumber)
      }

      return {
        ...b,
        status: 'WaitingTransport',
        transportSubmitted: false,
        licensePlate: null,
        vehiclePlate: null,
        suggestedPlate: null,
        trailerPlate: null,
        driverName: null,
        suggestedDriver: null,
        licenseNumber: null,
        phone: null,
        driverSnapshot: null,
        vehicleSnapshot: null,
        eportOrderId: null,
        eportOrderNumber: null,
        eportMatched: false,
        portBill: null,
        portBillPaid: false,
        paymentStatus: 'Unpaid',
        eportDocuments: [],
        documents: [],
        transportDocuments: [],
        approvedAt: null,
        approvedBy: null,
        timelineStep: 1,
      }
    })

    if (bookingsChanged) {
      try {
        localStorage.setItem(GENERATED_BOOKINGS_KEY, JSON.stringify(updatedRaw))
      } catch (e) {
        console.warn('Lỗi lưu generated gate bookings sau khi gỡ xe:', e)
      }

      const allManifests = this.getSyncedManifests()
      for (const mKey of touchedManifestKeys) {
        const matchedManifest = allManifests.find(m => m.id === mKey || m.manifestId === mKey || m.manifestNumber === mKey)
        const targetManifestId = matchedManifest?.id || (mKey && !String(mKey).startsWith('MNF-') ? mKey : null)
        if (targetManifestId) {
          const manifestBookings = updatedRaw.filter(
            b => b.sourceManifestId === targetManifestId ||
              (matchedManifest?.manifestNumber && b.sourceManifestNumber === matchedManifest.manifestNumber) ||
              b.sourceManifestNumber === mKey
          )
          try {
            await shippingLineApi.savePortBookings(targetManifestId, manifestBookings)
          } catch (err) {
            console.warn('Lỗi đồng bộ gỡ xe lên PostgreSQL:', err)
          }
        }
      }
    }

    // Nạp lại thông tin đội xe cho các đơn hợp lệ còn hiệu lực (nếu có)
    for (const activeOrd of [...validActiveOrders].reverse()) {
      try {
        this.saveAllOrderFleets(activeOrd)
      } catch { /* ignore */ }
    }

    if (bookingsChanged && !silent && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', {
        detail: { type: 'REJECTED_FLEET_UNASSIGNED', orderId: rejectedOrder.id }
      }))
      window.dispatchEvent(new Event('storage'))
    }

    return bookingsChanged
  },

  /**
   * Lấy thông tin xe & tài xế thực tế theo đơn dịch vụ / container (được khai báo từ Transport Company)
   */
  getOrderFleet(key) {
    if (!key) return null
    try {
      const map = JSON.parse(localStorage.getItem(ORDER_FLEET_KEY) || '{}')
      const cleanK = String(key).trim().toUpperCase()

      // 1. Khớp chính xác theo key (số container, mã booking,...)
      if (map[cleanK]) return map[cleanK]

      // 2. Tìm key trong map có đuôi số container khớp (ví dụ: BK-EG2605W-5749 khớp với container NXPU9465749)
      const digitsMatch = cleanK.match(/\d{4}$/) || cleanK.match(/\d{4}/)
      if (digitsMatch) {
        const d = digitsMatch[0]
        const matchedKey = Object.keys(map).find(k => k.includes(d))
        if (matchedKey && map[matchedKey]) return map[matchedKey]
      }

      return null
    } catch {
      return null
    }
  },

  /**
   * Lưu fleet của toàn bộ các container trong đơn vào map (độc lập từng container)
   */
  saveAllOrderFleets(order) {
    if (!order) return
    const ordStatus = String(order.status || order.orderStatus || '').toUpperCase()
    if (['REJECTED', 'CANCELLED'].includes(ordStatus)) return
    const content = order.content || {}
    const delivery = content.delivery || order.delivery || {}
    const trips = delivery.trips || []
    const lines = content.lines || []
    const conts = order.containers || []
    const orderDocuments = (delivery.documents || content.documents || order.documents || []).filter(
      d => d && (d.fileUrl || d.fileReference || d.fileName || d.title) && !String(d.fileUrl || '').includes('pdfobject.com/pdf/sample.pdf')
    )

    let rawBookings = []
    let bookingsChanged = false
    const touchedManifests = new Set()
    try {
      rawBookings = JSON.parse(localStorage.getItem(GENERATED_BOOKINGS_KEY) || '[]')
      if (!Array.isArray(rawBookings)) rawBookings = []
    } catch {
      rawBookings = []
    }

    trips.forEach((trip, idx) => {
      const line = lines.find(l => l.sourceContainerId === trip.sourceContainerId)
      const ordCont = conts.find(c => c.sourceContainerId === trip.sourceContainerId || c.id === trip.sourceContainerId)
      const rawContNum = ordCont?.containerNumber ||
        line?.declaration?.containerNumber ||
        line?.containerNumber ||
        trip.containerNumber ||
        conts[idx]?.containerNumber ||
        lines[idx]?.declaration?.containerNumber ||
        lines[idx]?.containerNumber ||
        ''
      const contNum = String(rawContNum).trim().toUpperCase()

      const plate = trip.vehicle?.plateNumber || trip.truckPlate
      const driver = trip.driver?.fullName || trip.driverName
      const phone = trip.driver?.phone || trip.driverPhone
      const license = trip.driver?.licenseNumber || trip.licenseNumber
      const idCard = trip.driver?.idCardNumber
      const trailer = trip.trailerPlate || trip.vehicle?.trailerPlate
      const vehicle = trip.vehicle
      const driverSnapshot = trip.driver

      if (contNum && (plate || driver || orderDocuments.length > 0)) {
        const fleetData = { plate, driver, phone, license, idCard, trailer, vehicle, driverSnapshot, documents: orderDocuments }
        this.saveOrderFleet(contNum, fleetData)

        // Lưu thêm 4 số cuối của container để map với booking code (ví dụ: BK-EG2605W-5749 khớp với 5749)
        const digits = contNum.match(/\d{4}$/)?.[0]
        if (digits) {
          this.saveOrderFleet(digits, fleetData)
        }

        // Cập nhật trực tiếp vào danh sách rawBookings nếu biển số/tài xế hoặc chứng từ khác, tránh gọi đệ quy getGeneratedGateBookings()
        rawBookings = rawBookings.map(b => {
          const bCont = String(b.containerId || '').trim().toUpperCase()
          const bId = String(b.id || '').trim().toUpperCase()
          const bCode = String(b.bookingCode || '').trim().toUpperCase()
          const matches = bCont === contNum || bId === contNum || b.realId === contNum ||
            (digits && (bId.includes(digits) || bCode.includes(digits) || bCont.includes(digits)))
          if (!matches) return b

          const docsNeedUpdate = orderDocuments.length > 0 && JSON.stringify(b.eportDocuments || []) !== JSON.stringify(orderDocuments)
          const needsUpdate =
            (plate && (b.licensePlate !== plate || b.suggestedPlate !== plate)) ||
            (driver && (b.driverName !== driver || b.suggestedDriver !== driver)) ||
            (phone && b.phone !== phone) ||
            (license && b.licenseNumber !== license) ||
            (trailer && b.trailerPlate !== trailer) ||
            docsNeedUpdate

          if (!needsUpdate) return b
          bookingsChanged = true
          if (b.sourceManifestId || b.sourceManifestNumber) {
            touchedManifests.add(b.sourceManifestId || b.sourceManifestNumber)
          }
          return {
            ...b,
            ...(plate ? { suggestedPlate: plate, licensePlate: plate } : {}),
            ...(driver ? { suggestedDriver: driver, driverName: driver } : {}),
            ...(phone ? { phone } : {}),
            ...(license ? { licenseNumber: license } : {}),
            ...(trailer ? { trailerPlate: trailer } : {}),
            ...(driverSnapshot ? { driverSnapshot } : {}),
            ...(vehicle ? { vehicleSnapshot: vehicle } : {}),
            ...(orderDocuments.length > 0 ? { eportDocuments: orderDocuments, documents: orderDocuments } : {}),
          }
        })
      }
    })

    if (bookingsChanged) {
      try {
        localStorage.setItem(GENERATED_BOOKINGS_KEY, JSON.stringify(rawBookings))
      } catch (e) {
        console.warn('Lỗi lưu generated gate bookings:', e)
      }
      const allManifests = this.getSyncedManifests()
      touchedManifests.forEach(mKey => {
        const matchedManifest = allManifests.find(m => m.id === mKey || m.manifestId === mKey || m.manifestNumber === mKey)
        const targetManifestId = matchedManifest?.id || (mKey && !String(mKey).startsWith('MNF-') ? mKey : null)
        if (targetManifestId) {
          const manifestBookings = rawBookings.filter(
            b => b.sourceManifestId === targetManifestId ||
              (matchedManifest?.manifestNumber && b.sourceManifestNumber === matchedManifest.manifestNumber) ||
              b.sourceManifestNumber === mKey
          )
          shippingLineApi.savePortBookings(targetManifestId, manifestBookings).catch(() => {})
        }
      })
    }

    // Nếu đơn chỉ có đúng 1 container thì mới lưu theo order.id / order.number
    if (trips.length === 1) {
      const singleFleet = this.extractFleetFromOrder(order)
      if (singleFleet) {
        if (order.id) this.saveOrderFleet(order.id, singleFleet)
        if (order.number) this.saveOrderFleet(order.number, singleFleet)
      }
    }
  },

  /**
   * Trích xuất thông tin xe & tài xế từ đối tượng đơn dịch vụ / draft (trips)
   */
  extractFleetFromOrder(order, containerId) {
    if (!order) return null
    const content = order.content || {}
    const delivery = content.delivery || order.delivery || {}
    const trips = delivery.trips || []
    const orderDocuments = (delivery.documents || content.documents || order.documents || []).filter(
      d => d && (d.fileUrl || d.fileReference || d.fileName || d.title) && !String(d.fileUrl || '').includes('pdfobject.com/pdf/sample.pdf')
    )
    if (!trips.length) {
      return orderDocuments.length > 0 ? { documents: orderDocuments } : null
    }

    const contUpper = String(containerId || '').trim().toUpperCase()
    const digits = contUpper.match(/\d{4}$/)?.[0] || contUpper.match(/\d{4}/)?.[0]

    let matchedTrip = null
    if (contUpper) {
      const lines = content.lines || []
      const ordConts = order.containers || []

      // 1. Match qua lines
      const line = lines.find(l => {
        const num = String(l.declaration?.containerNumber || l.containerNumber || l.sourceContainerId || '').trim().toUpperCase()
        return num === contUpper || (digits && num.includes(digits))
      })
      if (line) {
        matchedTrip = trips.find(t => t.sourceContainerId === line.sourceContainerId)
      }

      // 2. Match qua order.containers
      if (!matchedTrip) {
        const ordCont = ordConts.find(c => {
          const num = String(c.containerNumber || c.id || '').trim().toUpperCase()
          return num === contUpper || (digits && num.includes(digits))
        })
        if (ordCont) {
          matchedTrip = trips.find(t => t.sourceContainerId === ordCont.sourceContainerId || t.sourceContainerId === ordCont.id)
        }
      }

      // 3. Match qua containerNumber trực tiếp trên trip
      if (!matchedTrip) {
        matchedTrip = trips.find(t => {
          const cNum = String(t.containerNumber || t.containerId || '').trim().toUpperCase()
          return cNum === contUpper || (digits && cNum.includes(digits))
        })
      }

      // 4. Match qua index nếu số lượng lines/conts khớp với trips
      if (!matchedTrip && lines.length === trips.length) {
        const lineIdx = lines.findIndex(l => {
          const num = String(l.declaration?.containerNumber || l.containerNumber || '').trim().toUpperCase()
          return num === contUpper || (digits && num.includes(digits))
        })
        if (lineIdx >= 0) matchedTrip = trips[lineIdx]
      }
      if (!matchedTrip && ordConts.length === trips.length) {
        const contIdx = ordConts.findIndex(c => {
          const num = String(c.containerNumber || '').trim().toUpperCase()
          return num === contUpper || (digits && num.includes(digits))
        })
        if (contIdx >= 0) matchedTrip = trips[contIdx]
      }
    }

    // Nếu KHÔNG truyền containerId thì mới lấy trips[0] làm fallback chung
    if (!contUpper && !matchedTrip && trips.length > 0) {
      matchedTrip = trips[0]
    }

    if (!matchedTrip) {
      return orderDocuments.length > 0 ? { documents: orderDocuments } : null
    }

    const plate = matchedTrip?.vehicle?.plateNumber || matchedTrip?.truckPlate || delivery.truckPlate || null
    const driver = matchedTrip?.driver?.fullName || matchedTrip?.driverName || delivery.driverName || null
    const phone = matchedTrip?.driver?.phone || matchedTrip?.driverPhone || delivery.driverPhone || null
    const license = matchedTrip?.driver?.licenseNumber || matchedTrip?.licenseNumber || null
    const idCard = matchedTrip?.driver?.idCardNumber || matchedTrip?.idCardNumber || null
    const trailer = matchedTrip?.trailerPlate || matchedTrip?.vehicle?.trailerPlate || null
    const vehicle = matchedTrip?.vehicle || null
    const driverSnapshot = matchedTrip?.driver || null

    if (plate || driver || orderDocuments.length > 0) {
      return { plate, driver, phone, license, idCard, trailer, vehicle, driverSnapshot, documents: orderDocuments }
    }
    return null
  },
  /**
   * Chuyển đổi dữ liệu từ PostgreSQL shipping_manifests sang cấu trúc dùng chung trên giao diện Cảng
   */
  mapRemoteManifest(rm) {
    let rawContainers = rm.records || rm.containers || []
    if ((!rawContainers || rawContainers.length === 0) && Array.isArray(rm.bills)) {
      rawContainers = rm.bills.flatMap(b => (b.containers || []).map(c => ({
        ...c,
        blNumber: c.blNumber || b.blNumber,
        shipper: c.shipper || b.shipper,
        consignee: c.consignee || b.consignee,
      })))
    }

    const findBlForCont = (cNo) => {
      if (Array.isArray(rm.bills)) {
        for (const b of rm.bills) {
          if (b.containers?.some(c => (c.containerNumber || c.containerId || '').trim().toUpperCase() === cNo)) {
            return b.blNumber
          }
        }
      }
      return rm.blNumber || rm.bills?.[0]?.blNumber || ''
    }

    const mappedContainers = rawContainers.map((r, idx) => {
      const carrierProfile = TRANSPORT_COMPANIES_POOL[Math.floor(idx / 2) % TRANSPORT_COMPANIES_POOL.length]
      const cNo = (r.containerNumber || r.container_no || '').trim().toUpperCase()
      return {
        containerNumber: cNo,
        isoType: r.isoType || '40HC',
        sealNumber: r.sealNumber || '',
        blNumber: r.blNumber || findBlForCont(cNo) || rm.blNumber || '',
        shipper: r.shipper || '',
        consignee: r.consignee || '',
        isReefer: Boolean(r.isReefer || r.cargoType === 'REEFER' || /RF|RH|R[01]/.test(r.isoType || '')),
        transportCompany: r.transportCompany || carrierProfile.companyName,
        suggestedDriver: r.driverName || null,
        suggestedPlate: r.licensePlate || null,
        suggestedTrailer: r.trailerPlate || null,
        suggestedLicense: r.licenseNumber || null,
        suggestedGate: r.requestedGate || 'Gate 1',
        suggestedEta: `0${8 + (idx % 4)}:30`,
        cargoDescription: r.cargoDescription || r.commodity || '',
        packageCount: r.packageCount ?? null,
        grossWeightKg: Number(r.grossWeightKg) || 0,
        tareWeightKg: Number(r.tareWeightKg) || 3820,
        netWeightKg: Number(r.netWeightKg) || ((Number(r.grossWeightKg) || 25400) - 3820),
        cbm: Number(r.cbm) || 68.5,
        tempRequired: r.tempRequired || '',
        ventilation: r.ventilation || 'Kín gió',
        dgClass: r.dgClass || 'Non-DG (Hàng thường)',
        vgmStatus: 'Verified (Hợp lệ)',
        vgmMethod: 'Phương pháp 1 (Trạm cân điện tử)',
        stowageCell: r.stowageCell || `Bay 0${2 + idx * 2} - Row 04 - Tier 82`,
        customsStatus: 'Đã thông quan (Luồng Xanh)',
      }
    })

    const manifestId = rm.id || rm.manifestId
    const voyageNumber = rm.voyageInfo?.voyageNumber || rm.voyageNumber || rm.payload?.voyageInfo?.voyageNumber || rm.payload?.voyageNumber || 'EG-2605W'
    const vesselName = rm.voyageInfo?.vesselName || rm.vesselName || rm.payload?.voyageInfo?.vesselName || rm.payload?.vesselName || 'EVER GLORY'
    const isApproved = rm.portApprovalStatus === 'PORT_APPROVED' || rm.status === 'PORT_APPROVED' || isManifestPermanentlyApproved(rm) || isManifestPermanentlyApproved({ ...rm, vesselName, voyageNumber })
    if (isApproved) {
      registerPermanentlyApprovedManifest({ ...rm, vesselName, voyageNumber, manifestId })
    }
    return {
      manifestId,
      id: manifestId,
      manifestNumber: rm.manifestNumber || `MNF-${manifestId.slice(0, 8)}`,
      bookingNumber: rm.bookingNumber || '',
      blNumber: rm.blNumber || rm.bills?.[0]?.blNumber || mappedContainers.find(c => c.blNumber)?.blNumber || '',
      voyageNumber,
      vesselName,
      shippingLine: rm.shippingLine || 'Maersk Line',
      direction: rm.direction || 'IMPORT',
      flag: rm.flag || 'Panama (PA)',
      imoNumber: rm.imoNumber || 'IMO 9811000',
      callSign: rm.callSign || 'OWGR2',
      vesselType: rm.vesselType || 'Container Ship (Triple-E)',
      grossTonnage: rm.grossTonnage || '194,849 GT',
      deadweight: rm.deadweight || '194,153 DWT',
      lengthOverall: rm.lengthOverall || '399.2 m',
      beam: rm.beam || '59.0 m',
      draft: rm.draft || '16.0 m',
      agent: rm.agent || 'Maersk Vietnam - Da Nang Branch',
      nswRef: rm.nswRef || `NSW-DAD-2026-${manifestId.slice(-4)}`,
      berth: rm.berth || 'Bến số 1 (TS-01) - Cảng Tiên Sa',
      pol: rm.pol || 'Busan (KRPUS)',
      pod: rm.pod || 'Đà Nẵng (VNDAD)',
      eta: rm.eta || '2026-11-25 14:00',
      etd: rm.etd || '2026-11-26 22:00',
      sentToPortAt: rm.sentToPortAt || new Date().toISOString(),
      status: isApproved ? 'PORT_APPROVED' : 'SENT_TO_PORT',
      portApprovalStatus: isApproved ? 'PORT_APPROVED' : 'PENDING_APPROVAL',
      portApprovedAt: rm.portApprovedAt || (isApproved ? (rm.portApprovedAt || new Date().toISOString()) : null),
      portApprovedBy: rm.portApprovedBy || (isApproved ? 'Dispatcher Cảng Tiên Sa (Trần Hữu Long)' : null),
      vesselStatus: rm.vesselStatus || 'BERTHED',
      containers: mappedContainers,
      generatedBookings: rm.generatedBookings || null,
    }
  },

  /**
   * Kéo toàn bộ danh sách Manifest đã gửi từ PostgreSQL Server về trình duyệt
   */
  async fetchRemoteSyncedManifests() {
    try {
      const res = await shippingLineApi.getSyncedManifests()
      const remoteList = Array.isArray(res) ? res : (res?.data || res?.items || [])
      if (Array.isArray(remoteList)) {
        let existingLocal = this.getSyncedManifests()
        let existingGenerated = []
        try {
          existingGenerated = JSON.parse(localStorage.getItem(GENERATED_BOOKINGS_KEY) || '[]')
          if (!Array.isArray(existingGenerated)) existingGenerated = []
        } catch {}

        const current = []
        const remoteGenerated = []
        remoteList.forEach(rm => {
          const id = rm.id || rm.manifestId
          if (!id) return
          const mapped = this.mapRemoteManifest(rm)
          if (isManifestPermanentlyApproved(mapped)) {
            mapped.portApprovalStatus = 'PORT_APPROVED'
            mapped.status = 'PORT_APPROVED'
            mapped.portApprovedAt = mapped.portApprovedAt || new Date().toISOString()
            mapped.portApprovedBy = mapped.portApprovedBy || 'Dispatcher Cảng Tiên Sa (Trần Hữu Long)'
            registerPermanentlyApprovedManifest(mapped)
          }
          current.push(mapped)

          const isApproved = mapped.portApprovalStatus === 'PORT_APPROVED' || mapped.status === 'PORT_APPROVED'
          if (isApproved && Array.isArray(rm.generatedBookings) && rm.generatedBookings.length > 0) {
            rm.generatedBookings.forEach(gb => {
              if (gb) remoteGenerated.push(gb)
            })
          }
        })

        // 100% đồng bộ theo DB Deploy trên PostgreSQL - chỉ dùng local nếu DB rỗng hoàn toàn
        if (remoteList.length === 0) {
          existingLocal.forEach(localM => {
            if (isManifestPermanentlyApproved(localM)) {
              localM.portApprovalStatus = 'PORT_APPROVED'
              localM.status = 'PORT_APPROVED'
            }
            current.push(localM)
          })
        }

        // Luôn bảo lưu tuyệt đối trạng thái PORT_APPROVED
        current.forEach(m => {
          if (isManifestPermanentlyApproved(m)) {
            m.portApprovalStatus = 'PORT_APPROVED'
            m.status = 'PORT_APPROVED'
            registerPermanentlyApprovedManifest(m)
          }
        })

        let finalGenerated = remoteGenerated.length > 0 ? remoteGenerated : existingGenerated

        // Đảm bảo mọi tàu đã PORT_APPROVED đều có generated bookings đầy đủ (tách theo từng công ty vận tải)
        current.forEach(m => {
          const isApproved = m.portApprovalStatus === 'PORT_APPROVED' || m.status === 'PORT_APPROVED' || isManifestPermanentlyApproved(m)
          if (isApproved) {
            const hasBookings = finalGenerated.some(
              b => b.sourceManifestId === m.id || b.sourceManifestNumber === m.manifestNumber || b.sourceManifestNumber === m.id
            )
            if (!hasBookings && Array.isArray(m.containers) && m.containers.length > 0) {
              const res = this.approveManifestByPort(m.id || m.manifestNumber)
              if (res?.newGateBookings?.length) {
                finalGenerated = [...res.newGateBookings, ...finalGenerated]
              }
            }
          }
        })

        // Lưu danh sách manifest trước rồi thay thế GENERATED_BOOKINGS_KEY trực tiếp từ PostgreSQL
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
        localStorage.setItem(GENERATED_BOOKINGS_KEY, JSON.stringify(finalGenerated))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', {
            detail: { type: 'REMOTE_FETCH_SYNC', count: current.length }
          }))
        }
        return current
      }
    } catch (e) {
      console.warn('Lỗi fetch remote synced manifests:', e)
    }
    return this.getSyncedManifests()
  },

  /**
   * Lấy danh sách Manifest ĐÃ ĐƯỢC HÃNG TÀU BẤM GỬI CHO CẢNG
   */
  getManifestsSentToPort() {
    const list = this.getSyncedManifests()
    return list.filter(m => Boolean(m.sentToPortAt && (m.status === 'SENT_TO_PORT' || m.portApprovalStatus === 'PORT_APPROVED' || m.portApprovalStatus === 'PENDING_APPROVAL')))
  },

  /**
   * Hãng tàu thu hồi / hủy gửi Bản khai khỏi Cảng (để có thể test gửi lại từ đầu)
   */
  recallManifestFromPort(manifestId) {
    const list = this.getSyncedManifests()
    let recalledNumber = null
    const updated = list.map(m => {
      if (m.manifestId === manifestId || m.id === manifestId || m.manifestNumber === manifestId) {
        recalledNumber = m.manifestNumber
        return {
          ...m,
          sentToPortAt: null,
          status: 'VALIDATED',
          portApprovalStatus: 'NOT_SENT',
          portApprovedAt: null,
          portApprovedBy: null,
        }
      }
      return m
    })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      const existingGenerated = this.getGeneratedGateBookings()
      const remaining = existingGenerated.filter(
        b => b.sourceManifestId !== manifestId && b.sourceManifestNumber !== recalledNumber && b.sourceManifestNumber !== manifestId
      )
      localStorage.setItem(GENERATED_BOOKINGS_KEY, JSON.stringify(remaining))

      // Đồng bộ tuần tự trạng thái về Pending rồi xóa generatedBookings trên PostgreSQL
      try {
        const targetRemoteId = (targetManifestNumber && targetManifestNumber !== manifestId) ? targetManifestNumber : manifestId
        shippingLineApi.resetManifestPendingAtPort(targetRemoteId)
          .catch((err) => console.warn('Lỗi resetManifestPendingAtPort:', err))
          .then(() => shippingLineApi.savePortBookings(targetRemoteId, []).catch((err) => console.warn('Lỗi clearPortBookings:', err)))
      } catch (e) {}
    } catch (e) {
      console.warn(e)
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', {
        detail: { type: 'MANIFEST_RECALLED', manifestId, manifestNumber: recalledNumber }
      }))
    }
  },

  /**
   * Lấy toàn bộ danh sách Manifest đã truyền sang Cảng
   */
  getSyncedManifests() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      let parsed = stored ? JSON.parse(stored) : []
      if (!Array.isArray(parsed)) {
        parsed = []
      }

      // Tự động dọn dẹp các ID bản khai rác/thử nghiệm đã bị xóa khỏi PostgreSQL
      const beforeFilterLen = parsed.length
      parsed = parsed.filter(m => {
        const mId = String(m?.id || m?.manifestId || '')
        return mId !== '1e2fbb53-544b-44e6-abcc-1f461c8a311a'
      })
      let hasChanged = parsed.length !== beforeFilterLen
      const mapped = parsed.map(m => {
        if (isManifestPermanentlyApproved(m)) {
          if (m.portApprovalStatus !== 'PORT_APPROVED' || m.status !== 'PORT_APPROVED') {
            hasChanged = true
          }
          return {
            ...m,
            status: 'PORT_APPROVED',
            portApprovalStatus: 'PORT_APPROVED',
            portApprovedAt: m.portApprovedAt || new Date().toISOString(),
            portApprovedBy: m.portApprovedBy || 'Dispatcher Cảng Tiên Sa (Trần Hữu Long)',
          }
        }
        return m
      })

      if (hasChanged) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped))
      }
      return mapped
    } catch (err) {
      console.warn('Lỗi đọc local manifests:', err)
      return []
    }
  },

  /**
   * Lấy danh sách các Container / Booking đã được tách theo Công ty vận tải sau khi Cảng duyệt Tàu
   * Đồng thời đảm bảo 100% container đều có vị trí bãi (autoYardSlot) và được đếm trong yardReservationStore
   */
  getGeneratedGateBookings() {
    try {
      const allManifests = this.getSyncedManifests()
      let raw = localStorage.getItem(GENERATED_BOOKINGS_KEY)
      let parsed = raw ? JSON.parse(raw) : []
      if (!Array.isArray(parsed)) parsed = []

      // Lấy danh sách tàu đã được phê duyệt (PORT_APPROVED)
      let approvedManifests = new Set(
        allManifests
          .filter(m => m.portApprovalStatus === 'PORT_APPROVED' || m.status === 'PORT_APPROVED' || m.status === 'DISCHARGING')
          .map(m => m.manifestNumber || m.manifestId)
      )

      // TỰ ĐỘNG PHÂN BỔ BÃI & ĐẶT CHỖ CHO CÁC TÀU NẾU CHƯA CÓ BOOKINGS
      if (approvedManifests.size === 0 || parsed.length === 0) {
        const toAutoApprove = allManifests.filter(m => m.status === 'SENT_TO_PORT' || m.status === 'PORT_APPROVED' || m.status === 'DISCHARGING' || !m.portApprovalStatus)
        const targetList = toAutoApprove.length > 0 ? toAutoApprove : allManifests
        targetList.forEach(m => {
          try {
            const mId = m.manifestId || m.id || m.manifestNumber
            this.approveManifestByPort(mId, null, { silent: true })
          } catch (e) {}
        })
        raw = localStorage.getItem(GENERATED_BOOKINGS_KEY)
        parsed = raw ? JSON.parse(raw) : []
        if (!Array.isArray(parsed)) parsed = []
        approvedManifests = new Set(
          this.getSyncedManifests()
            .filter(m => m.portApprovalStatus === 'PORT_APPROVED' || m.status === 'PORT_APPROVED' || m.status === 'DISCHARGING')
            .map(m => m.manifestNumber || m.manifestId)
        )
      }

      if (approvedManifests.size === 0 && parsed.length === 0) {
        return []
      }

      if (parsed.length > 0) {
        const filteredApproved = approvedManifests.size > 0 
          ? parsed.filter(b => approvedManifests.has(b.sourceManifestNumber) || approvedManifests.has(b.sourceManifestId))
          : parsed
          const allReservations = yardReservationStore.getReservations()
          let hasBookingsMigrated = false
          const enriched = filteredApproved.map((item, idx) => {
            const isOc2612 = item.voyageNumber === 'OC-2612E' || (item.vesselName && item.vesselName.includes('CONTINUITY'))
            let patchDates = {}
            if (isOc2612 && (!item.vesselEtaDate || item.vesselEtaDate === '2026-11-09' || (item.vesselEta && item.vesselEta.includes('2026-11-09')))) {
              hasBookingsMigrated = true
              patchDates = {
                vesselEta: '2026-11-25 14:00',
                vesselEtaDate: '2026-11-25',
                etaDate: '2026-11-25',
                date: '25/11/2026',
              }
            }
            const contKey = String(item.containerId || '').trim().toUpperCase()
            const bookKey = String(item.id || item.bookingCode || '').trim().toUpperCase()
            const matchedRes = allReservations.find(r => {
              const rCont = String(r.containerNo || r.containerId || '').trim().toUpperCase()
              const rBook = String(r.bookingCode || '').trim().toUpperCase()
              return (contKey && rCont === contKey) || (bookKey && rBook === bookKey)
            })

            const slot = (matchedRes && matchedRes.blockCode)
              ? { ...item.autoYardSlot, ...matchedRes }
              : (item.autoYardSlot || {})

            const isRf = (item.containerType || '').includes('RF') || item.isReefer
            const isDg = item.isDG || (item.dgClass && !item.dgClass.includes('Non-DG'))
            const is20 = (item.containerType || '').includes('20')
            const bayNum = slot.bay || slot.bayCode || (is20 ? (1 + (idx % 16) * 2) : (2 + (idx % 8) * 4))
            const bayStr = String(bayNum).padStart(2, '0')
            const rowNum = slot.row || (is20 ? (Math.floor(idx / 16) + 1) : (Math.floor(idx / 8) + 1))
            const rowStr = String(rowNum).padStart(2, '0')
            const tierNum = slot.tier || 1
            const blockCode = slot.blockCode || (isRf ? 'D01' : (isDg ? 'E01' : (item.direction === 'IMPORT' ? 'B01' : 'A01')))
            const autoGate = 'Gate 1'
            const formattedSlot = `Block ${blockCode} · Bay ${bayStr} (${rowNum}-${tierNum})`

            if (item.requestedGate !== 'Gate 1' || slot.gate !== 'Gate 1') {
              hasBookingsMigrated = true
            }

            const updatedSlot = {
              ...slot,
              blockCode,
              bay: Number(bayNum) || 2,
              bayCode: bayStr,
              bayDisplay: `Bay ${bayStr}`,
              row: Number(rowNum) || 1,
              rowCode: rowStr,
              tier: Number(tierNum) || 1,
              tierCode: String(tierNum),
              gate: 'Gate 1',
              gateDisplay: 'Gate 1 (Cổng Cảng Tiên Sa)',
              slotName: `Khu ${blockCode} · Bay ${bayStr} (R${rowStr}-T${tierNum})`,
              fullLocation: formattedSlot,
            }

            // Tự động đồng bộ vị trí vào yardReservationStore để Sơ đồ bãi luôn hiển thị đủ container
            if (contKey && updatedSlot.blockCode) {
              const currentRes = yardReservationStore.getReservations()
              const foundInStore = currentRes.find(r => {
                const rCont = String(r.containerNo || r.containerId || '').trim().toUpperCase()
                return rCont === contKey
              })
              if (!foundInStore) {
                try {
                  yardReservationStore.addReservation({
                    ...updatedSlot,
                    containerId: item.containerId,
                    containerNo: item.containerId,
                    bookingCode: item.id || item.bookingCode,
                    company: item.company,
                    vesselName: item.vesselName,
                    voyageNumber: item.voyageNumber,
                  }, { silent: true })
                } catch (e) {}
              }
            }

            let restoredStatus = item.status || 'Pending'
            let isSubmitted = item.transportSubmitted
            let vPlate = item.licensePlate || item.vehiclePlate
            let vTrailer = item.trailerPlate
            let vDriver = item.driverName
            let pStatus = item.paymentStatus || 'Unpaid'
            let pPaid = Boolean(item.portBillPaid)

            // Ưu tiên kiểm tra hóa đơn đã lưu trực tiếp từ PostgreSQL (item.portBill) trước rồi mới fallback sang localStorage
            try {
              const storedBills = JSON.parse(localStorage.getItem('NEXUSPORT_PORT_BILLS') || '{}')
              const matchedBill = item.portBill || storedBills[item.id] || storedBills[item.bookingCode] || storedBills[item.containerId]
              if (matchedBill) {
                if (matchedBill.status === 'PAID' || matchedBill.paid || matchedBill.status === 'Paid') {
                  pPaid = true
                  pStatus = 'Paid'
                  restoredStatus = 'Ready'
                } else if (item.status === 'Approved' || matchedBill.status === 'SENT_TO_CARRIER') {
                  restoredStatus = restoredStatus === 'Ready' ? 'Ready' : 'Approved'
                }
              }
            } catch {}

            // Kiểm tra thông tin đội xe theo đơn thực tế (nếu có khai báo từ đơn ePort)
            const LEGACY_FAKE_PLATES = ['47AB-294.69', '43C-567.89', 'Chưa gán xe', 'Chưa gán', 'Chưa điều phối']
            const LEGACY_FAKE_DRIVERS = ['TRẦN VĂN TÙNG', 'Nguyễn Văn Minh', 'Chưa điều phối', 'Chưa có tài xế']
            if (LEGACY_FAKE_PLATES.includes(vPlate)) vPlate = null
            if (LEGACY_FAKE_DRIVERS.includes(vDriver)) vDriver = null
            let sPlate = LEGACY_FAKE_PLATES.includes(item.suggestedPlate) ? null : (item.suggestedPlate || null)
            let sDriver = LEGACY_FAKE_DRIVERS.includes(item.suggestedDriver) ? null : (item.suggestedDriver || null)

            const orderFleet = manifestPortSyncService.getOrderFleet(item.containerId) ||
              manifestPortSyncService.getOrderFleet(item.bookingCode) ||
              manifestPortSyncService.getOrderFleet(item.id)
            if (orderFleet) {
              if (orderFleet.plate) vPlate = orderFleet.plate
              if (orderFleet.driver) vDriver = orderFleet.driver
              if (orderFleet.phone) item.phone = orderFleet.phone
              if (orderFleet.license) item.licenseNumber = orderFleet.license
              if (orderFleet.trailer) vTrailer = orderFleet.trailer
              if (orderFleet.driverSnapshot) item.driverSnapshot = orderFleet.driverSnapshot
              if (orderFleet.vehicle) item.vehicleSnapshot = orderFleet.vehicle
            }

            const cleanRealDocs = (docs) => (Array.isArray(docs) ? docs : []).filter(
              d => d && !String(d.fileUrl || '').includes('pdfobject.com/pdf/sample.pdf')
            )
            const rawDocsHadFake = Array.isArray(item.documents) && item.documents.some(d => String(d?.fileUrl || '').includes('pdfobject.com/pdf/sample.pdf'))
            if (rawDocsHadFake) hasBookingsMigrated = true
            const realOrderDocs = cleanRealDocs(orderFleet?.documents)
            const realItemEportDocs = cleanRealDocs(item.eportDocuments)
            const realItemDocs = cleanRealDocs(item.documents)
            const mergedDocs = realOrderDocs.length > 0 ? realOrderDocs : (realItemEportDocs.length > 0 ? realItemEportDocs : realItemDocs)

            // Nếu booking đã được duyệt hoặc đã thanh toán: giữ thông tin thật từ orderFleet hoặc đã lưu, không chèn xe/tài xế ảo
            if (restoredStatus === 'Approved' || restoredStatus === 'Ready' || pPaid) {
              isSubmitted = true
              vPlate = orderFleet?.plate || vPlate || sPlate || null
              vDriver = orderFleet?.driver || vDriver || sDriver || null
            }

            return {
              ...item,
              ...patchDates,
              status: restoredStatus,
              transportSubmitted: isSubmitted,
              licensePlate: vPlate,
              trailerPlate: vTrailer,
              driverName: vDriver,
              suggestedPlate: orderFleet?.plate || sPlate || vPlate || null,
              suggestedDriver: orderFleet?.driver || sDriver || vDriver || null,
              eportDocuments: realOrderDocs.length > 0 ? realOrderDocs : realItemEportDocs,
              documents: mergedDocs,
              paymentStatus: pStatus,
              portBillPaid: pPaid,
              rejectionReason: '',
              rejectionNote: '',
              requestedGate: 'Gate 1',
              autoYardSlot: updatedSlot,
              yardSlot: formattedSlot,
            }
          })

          if (hasBookingsMigrated) {
            try {
              localStorage.setItem(GENERATED_BOOKINGS_KEY, JSON.stringify(enriched))
            } catch (e) {}
          }
          return enriched
        }
      } catch (err) {
        console.warn('Lỗi đọc generated gate bookings:', err)
      }
      return []
    },

  _old_getGeneratedGateBookings() {
    try {
      const raw = localStorage.getItem(GENERATED_BOOKINGS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          let dirty = false
          const allReservations = yardReservationStore.getReservations()

          const enriched = parsed.map((item, idx) => {
            const contKey = (item.containerId || '').trim().toUpperCase()
            const existingStoreRes = allReservations.find(
              r => (r.containerId || r.containerNo || '').trim().toUpperCase() === contKey
            )

            // 1. Tự động tính toán vị trí chuẩn theo quy tắc Cảng Tiên Sa (Không dùng bãi đệm tạm thời)
            let slot = item.autoYardSlot
            if (!slot || !slot.blockCode || slot.isTemporaryBuffer || slot.allocationScore === 50) {
              const opDirection = item.operation === 'Pickup' || item.direction === 'IMPORT' ? 'IMPORT' : 'EXPORT'
              slot = computeAutoYardSlot(
                {
                  containerNumber: item.containerId || item.containerNumber,
                  isoType: item.containerType || item.isoType,
                  tempRequired: item.tempRequired,
                  dgClass: item.dgClass,
                  cargoDescription: item.cargoDescription,
                  grossWeightKg: item.grossWeightKg || item.weight,
                  isReefer: item.isReefer,
                },
                opDirection,
                idx,
                items
              )
              dirty = true
            }

            // 2. Nếu người dùng đã đổi vị trí trong yardReservationStore, ưu tiên vị trí mới nhất trong store
            if (existingStoreRes && existingStoreRes.blockCode) {
              if (
                slot.blockCode !== existingStoreRes.blockCode ||
                String(slot.bay) !== String(existingStoreRes.bay) ||
                String(slot.row) !== String(existingStoreRes.row) ||
                String(slot.tier) !== String(existingStoreRes.tier)
              ) {
                slot = {
                  ...slot,
                  ...existingStoreRes,
                  zoneCode: (existingStoreRes.blockCode || 'A')[0],
                }
                dirty = true
              }
            } else if (contKey && slot?.blockCode) {
              // 3. Nếu trong yardReservationStore chưa có, thêm vào để đếm số lượng vị trí đang chiếm trên bãi
              yardReservationStore.addReservation({
                ...slot,
                containerId: item.containerId,
                containerNo: item.containerId,
                bookingCode: item.id,
                company: item.company,
                vesselName: item.vesselName,
                voyageNumber: item.voyageNumber,
              })
            }

            return dirty ? { ...item, autoYardSlot: slot } : item
          })

          if (dirty) {
            localStorage.setItem(GENERATED_BOOKINGS_KEY, JSON.stringify(enriched))
          }
          return enriched
        }
      }
    } catch (err) {
      console.warn('Lỗi đọc generated gate bookings:', err)
    }
    return []
  },

  /**
   * Cập nhật trạng thái của 1 Gate Booking được sinh từ Manifest (VD: khi Dispatcher duyệt/từ chối)
   */
  updateGeneratedGateBookingStatus(bookingId, updates = {}) {
    try {
      const current = this.getGeneratedGateBookings()
      const idx = current.findIndex(b => b.id === bookingId || b.realId === bookingId || b.containerId === bookingId)
      if (idx === -1) return Promise.resolve(false)
      current[idx] = { ...current[idx], ...updates }
      localStorage.setItem(GENERATED_BOOKINGS_KEY, JSON.stringify(current))

      // Đồng bộ trực tiếp lên cơ sở dữ liệu PostgreSQL Server qua shippingLineApi
      const allManifests = this.getSyncedManifests()
      const targetManifestId = current[idx]?.sourceManifestId ||
        allManifests.find(m => m.manifestNumber === current[idx]?.sourceManifestNumber || m.id === current[idx]?.sourceManifestId)?.id

      let savePromise = Promise.resolve(true)
      if (targetManifestId) {
        const manifestBookings = current.filter(b => b.sourceManifestId === targetManifestId || b.sourceManifestNumber === current[idx]?.sourceManifestNumber)
        savePromise = shippingLineApi.savePortBookings(targetManifestId, manifestBookings)
          .then(() => true)
          .catch(err => {
            console.warn('Lỗi lưu port bookings lên PostgreSQL:', err)
            return true
          })
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', { detail: { bookingId, updates } }))
      }
      return savePromise
    } catch (e) {
      return Promise.resolve(false)
    }
  },

  /**
   * BƯỚC 3: Bên Công ty Vận tải (Transport Company) gửi thông tin:
   * - Xe đầu kéo & Rơ-moóc (licensePlate, trailerPlate)
   * - Tài xế & GPLX Hạng FC (driverName, licenseNumber)
   * - Khung giờ hẹn đến cổng & Cổng đăng ký (eta, requestedGate)
   * - Bộ chứng từ vận tải (eDO / Booking Note, Tờ khai HQ VNACCS, Chứng thư VGM, GPLX, Đăng kiểm)
   * Sau khi gửi -> Trạng thái chuyển từ 'WaitingTransport' sang 'Pending' (Chờ Cảng kiểm duyệt)!
   */
  submitTransportBookingToPort(bookingIdOrContainerNo, customFleetData = {}) {
    const current = this.getGeneratedGateBookings()
    const nowStr = new Date().toLocaleString('vi-VN')
    let updatedItem = null

    const updated = current.map(item => {
      if (item.id === bookingIdOrContainerNo || item.containerId === bookingIdOrContainerNo) {
        const orderFleet = this.getOrderFleet(item.containerId) || this.getOrderFleet(item.bookingCode) || this.getOrderFleet(item.id)
        const plate = customFleetData.licensePlate || orderFleet?.plate || (['47AB-294.69', '43C-567.89'].includes(item.suggestedPlate) ? null : item.suggestedPlate) || null
        const trailer = customFleetData.trailerPlate || orderFleet?.trailer || (item.suggestedTrailer === '47R-012.88' ? null : item.suggestedTrailer) || null
        const driver = customFleetData.driverName || orderFleet?.driver || (['TRẦN VĂN TÙNG', 'Nguyễn Văn Minh'].includes(item.suggestedDriver) ? null : item.suggestedDriver) || null
        const licenseNo = customFleetData.licenseNumber || orderFleet?.license || (item.suggestedLicense === 'FC-782910' ? null : item.suggestedLicense) || null
        const gate = customFleetData.requestedGate || item.suggestedGate || 'Gate 1'
        const etaTime = customFleetData.etaTime?.slice(0, 5)
        const todayVn = etaTime && new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
        const etaIso = customFleetData.eta || (etaTime ? `${todayVn}T${etaTime}:00+07:00` : item.eta || null)

        const transportSubmittedDocs = [
          {
            code: 'EDO_BOOKING',
            name: item.operation === 'Pickup' ? 'Lệnh giao hàng điện tử (eDO)' : 'Booking Note / Lệnh hạ container xuất khẩu',
            docNo: `EDO-${item.cargoDeclarationId || '2026'}-${item.containerId?.slice(-4)}`,
            status: 'Đã xác thực chữ ký số'
          },
          {
            code: 'CUSTOMS_VNACCS',
            name: 'Tờ khai Hải quan điện tử (VNACCS/VCIS)',
            docNo: `HQ-104928${item.containerId?.slice(-4) || '8812'}-04C1`,
            status: 'Đã thông quan (Luồng Xanh)'
          },
          {
            code: 'VGM_CERT',
            name: 'Phiếu xác nhận khối lượng toàn bộ (VGM)',
            docNo: `VGM-${item.containerId}-${item.grossWeightKg || 25400}KG`,
            status: 'Hợp lệ SOLAS'
          },
          {
            code: 'VEHICLE_DRIVER_DOCS',
            name: 'Sổ đăng kiểm xe đầu kéo & GPLX Hạng FC',
            docNo: `${plate || 'Chưa khai báo'} · ${licenseNo || 'Chưa khai báo'}`,
            status: 'Còn hiệu lực'
          }
        ]

        updatedItem = {
          ...item,
          transportSubmitted: true,
          transportSentAt: nowStr,
          licensePlate: plate,
          trailerPlate: trailer,
          vehicleStatus: 'Available',
          driverName: driver,
          licenseNumber: licenseNo,
          licenseClass: 'FC',
          licenseStatus: 'Valid',
          driverStatus: 'Available',
          requestedGate: gate,
          eta: etaIso,
          etaWindow: customFleetData.etaWindow || item.etaWindow || null,
          transportDocuments: transportSubmittedDocs,
          status: 'Pending', // Chuyển từ WaitingTransport -> Pending để bên Gate Booking bấm Kiểm duyệt!
          timelineStep: 2,
        }
        return updatedItem
      }
      return item
    })

    try {
      localStorage.setItem(GENERATED_BOOKINGS_KEY, JSON.stringify(updated))
      if (updatedItem) {
        this.recordTransportSubmissionAlert({
          id: updatedItem.id,
          containerId: updatedItem.containerId,
          company: updatedItem.company,
          licensePlate: updatedItem.licensePlate,
          driverName: updatedItem.driverName,
          operation: updatedItem.operation,
          billOfLading: updatedItem.cargoDeclarationId || updatedItem.billOfLading || '',
          submittedAt: nowStr,
        })
      }
    } catch (e) {
      console.warn(e)
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', {
        detail: { type: 'TRANSPORT_SUBMITTED', item: updatedItem }
      }))
      window.dispatchEvent(new Event('storage'))
    }

    return updatedItem
  },

  getTransportSubmissionAlerts() {
    return []
  },

  recordTransportSubmissionAlert() {
    // Đã tắt: không tạo thông báo hồ sơ xe/tài xế, chỉ thông báo khi có Bill tới
    try {
      localStorage.removeItem('NEXUSPORT_TRANSPORT_SUBMISSIONS_ALERT')
    } catch {}
  },

  dismissTransportSubmissionAlert() {
    try {
      localStorage.removeItem('NEXUSPORT_TRANSPORT_SUBMISSIONS_ALERT')
    } catch {}
  },

  /**
   * Bên Công ty vận tải (Transport Company) gửi một lượt toàn bộ các container của công ty đó sang Cảng
   */
  submitAllTransportBookingsForCompany(companyName) {
    const current = this.getGeneratedGateBookings()
    const targets = current.filter(
      b => (!companyName || b.company === companyName) && !b.transportSubmitted
    )
    targets.forEach(t => {
      this.submitTransportBookingToPort(t.id)
    })
    return targets.length
  },

  /**
   * Lưu manifest vào danh sách đã đồng bộ với Cảng (mặc định trạng thái Chờ phê duyệt)
   */
  saveSyncedManifest(manifest) {
    if (!manifest) return
    const current = this.getSyncedManifests()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const rawContainers = manifest.records || manifest.containers || []
    const mappedContainers = rawContainers.map((r, idx) => {
      const carrierProfile = TRANSPORT_COMPANIES_POOL[Math.floor(idx / 2) % TRANSPORT_COMPANIES_POOL.length]
      return {
        containerNumber: r.containerNumber?.trim().toUpperCase(),
        isoType: r.isoType || '40HC',
        sealNumber: r.sealNumber || '',
        blNumber: r.blNumber || '',
        shipper: r.shipper || '',
        consignee: r.consignee || '',
        isReefer: Boolean(r.isReefer || r.cargoType === 'REEFER' || /RF|RH|R[01]/.test(r.isoType || '')),
        transportCompany: r.transportCompany || carrierProfile.companyName,
        suggestedDriver: r.driverName || null,
        suggestedPlate: r.licensePlate || null,
        suggestedTrailer: r.trailerPlate || null,
        suggestedLicense: r.licenseNumber || null,
        suggestedGate: r.requestedGate || 'Gate 1',
        suggestedEta: `0${8 + (idx % 4)}:30`,
        cargoDescription: r.cargoDescription || r.commodity || '',
        packageCount: r.packageCount ?? null,
        grossWeightKg: Number(r.grossWeightKg) || 0,
        tareWeightKg: Number(r.tareWeightKg) || 3820,
        netWeightKg: Number(r.netWeightKg) || ((Number(r.grossWeightKg) || 25400) - 3820),
        cbm: Number(r.cbm) || 68.5,
        tempRequired: r.tempRequired || '',
        ventilation: r.ventilation || 'Kín gió',
        dgClass: r.dgClass || 'Non-DG (Hàng thường)',
        vgmStatus: 'Verified (Hợp lệ)',
        vgmMethod: 'Phương pháp 1 (Trạm cân điện tử)',
        stowageCell: r.stowageCell || `Bay 0${2 + idx * 2} - Row 04 - Tier 82`,
        customsStatus: 'Đã thông quan (Luồng Xanh)',
      }
    })

    const newRecord = {
      manifestId: manifest.id || manifest.manifestId || `mnf-${Date.now()}`,
      manifestNumber: manifest.manifestNumber || `MNF-VNDAD-${Date.now().toString().slice(-4)}`,
      voyageNumber: manifest.voyageInfo?.voyageNumber || manifest.voyageNumber || 'EG-2605W',
      vesselName: manifest.voyageInfo?.vesselName || manifest.vesselName || 'EVER GLORY',
      shippingLine: manifest.shippingLine || manifest.carrierName || 'Evergreen Line (EMC)',
      direction: manifest.direction || 'EXPORT',
      flag: manifest.flag || 'Panama (PA)',
      imoNumber: manifest.imoNumber || 'IMO 9811000',
      callSign: manifest.callSign || '3FCA2',
      vesselType: manifest.vesselType || 'Container Ship (Feeder/Post-Panamax)',
      grossTonnage: manifest.grossTonnage || '68,200 GT',
      deadweight: manifest.deadweight || '80,500 DWT',
      lengthOverall: manifest.lengthOverall || '294.1 m',
      beam: manifest.beam || '32.2 m',
      draft: manifest.draft || '12.5 m',
      agent: manifest.agent || 'Evergreen Shipping Agency Vietnam - Da Nang Branch',
      nswRef: manifest.nswRef || `NSW-DAD-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      berth: manifest.berth || 'Bến số 1 (TS-01) - Cảng Tiên Sa',
      pol: manifest.pol || 'Đà Nẵng (VNDAD)',
      pod: manifest.pod || 'Tokyo, Nhật Bản (JPTYO)',
      eta: manifest.eta || '2026-11-25 14:00',
      etd: manifest.etd || '2026-11-26 22:00',
      sentToPortAt: manifest.sentToPortAt || now,
      status: 'SENT_TO_PORT',
      portApprovalStatus: 'PENDING_APPROVAL',
      portApprovedAt: null,
      portApprovedBy: null,
      vesselStatus: manifest.vesselStatus || 'BERTHED',
      containers: mappedContainers
    }

    const filtered = current.filter(m => m.manifestNumber !== newRecord.manifestNumber && m.manifestId !== newRecord.manifestId)
    const updated = [newRecord, ...filtered]

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (e) {
      console.warn('Lỗi ghi local manifests:', e)
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', {
        detail: { manifest: newRecord }
      }))
    }

    return newRecord
  },

  /**
   * Tra cứu thông tin Manifest theo số container
   */
  getManifestForContainer(containerNumber) {
    if (!containerNumber || containerNumber === 'N/A') return null
    const cleanNo = String(containerNumber).trim().toUpperCase()
    const list = this.getSyncedManifests()
    if (!list || list.length === 0) return null

    for (const mnf of list) {
      const matched = (mnf.containers || []).find(c => c.containerNumber === cleanNo)
      if (matched) {
        return {
          isSynced: true,
          manifestId: mnf.manifestId,
          manifestNumber: mnf.manifestNumber,
          voyageNumber: mnf.voyageNumber,
          vesselName: mnf.vesselName,
          shippingLine: mnf.shippingLine,
          direction: mnf.direction,
          flag: mnf.flag,
          imoNumber: mnf.imoNumber,
          callSign: mnf.callSign,
          berth: mnf.berth || 'Bến số 1 (TS-01)',
          pol: mnf.pol,
          pod: mnf.pod,
          eta: mnf.eta,
          etd: mnf.etd,
          sentToPortAt: mnf.sentToPortAt,
          portApprovalStatus: mnf.portApprovalStatus || 'PENDING_APPROVAL',
          containerNumber: matched.containerNumber,
          sealNumber: matched.sealNumber || `SL-${cleanNo.slice(-5)}`,
          grossWeightKg: matched.grossWeightKg || 25400,
          tareWeightKg: matched.tareWeightKg || 3820,
          netWeightKg: matched.netWeightKg || 21580,
          cbm: matched.cbm || 68.5,
          blNumber: matched.blNumber || `BL-VNDAD-${cleanNo.slice(-4)}`,
          shipper: matched.shipper || 'Công ty CP Sản xuất Linh kiện Cơ khí Đà Nẵng',
          consignee: matched.consignee || 'Tokyo Auto Parts Distribution Co., Ltd. (Japan)',
          transportCompany: matched.transportCompany || 'Bien Dong Logistics - Nexus Logistics',
          cargoDescription: matched.cargoDescription || 'Hàng hóa xuất khẩu tiêu chuẩn',
          isoType: matched.isoType || '40HC',
          tempRequired: matched.tempRequired || 'Nhiệt độ phòng (Dry)',
          dgClass: matched.dgClass || 'Non-DG',
          vgmStatus: matched.vgmStatus || 'Verified (Hợp lệ)',
          stowageCell: matched.stowageCell || 'Bay 02 - Row 04 - Tier 82',
          customsStatus: matched.customsStatus || 'Đã thông quan',
          status: 'SENT_TO_PORT',
          readyForGateReview: true,
        }
      }
    }

    return null
  },

  /**
   * BƯỚC 2: Cảng phê duyệt / chấp nhận Bản khai Tàu (Accept Manifest)
   * -> Tự động chuyển các container trên tàu về từng Công ty vận tải (Bảng mới chia theo công ty).
   * CHÚ Ý QUAN TRỌNG: Lúc vừa duyệt tàu xong, CHƯA CÓ TÀI XẾ HAY XE ĐẦU KÉO!
   * Phải chờ bên Công ty Vận tải (Transport) điều phối Xe + Tài xế + Giờ hẹn ETA + Chứng từ gửi lại 1 lần nữa!
   */
  approveManifestByPort(manifestId, preAllocatedPlan = null) {
    const list = this.getSyncedManifests()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    let approvedManifest = null

    const updated = list.map(m => {
      const isTarget = m.manifestId === manifestId || m.id === manifestId || m.manifestNumber === manifestId ||
        m.voyageNumber === manifestId || (m.vesselName && String(manifestId).includes(m.vesselName))
      if (isTarget) {
        // Tự động sắp xếp các container trên tàu theo đúng quy luật phân bổ bãi cảng
        const sourceConts = (m.containers && m.containers.length > 0)
          ? m.containers
          : (m.records && m.records.length > 0
              ? m.records
              : (m.bills ? m.bills.flatMap(b => (b.containers || []).map(c => ({ ...c, blNumber: c.blNumber || b.blNumber }))) : []))
        const sortedContainers = sortContainersForYardAllocation(sourceConts)
        approvedManifest = {
          ...m,
          containers: sortedContainers,
          status: 'PORT_APPROVED',
          portApprovalStatus: 'PORT_APPROVED',
          portApprovedAt: now,
          portApprovedBy: 'Dispatcher Cảng Tiên Sa (Trần Hữu Long)',
        }
        registerPermanentlyApprovedManifest(approvedManifest)
        return approvedManifest
      }
      return m
    })

    if (!approvedManifest && list.length > 0) {
      const fallbackTarget = list.find(m => isManifestPermanentlyApproved(m)) || list[0]
      if (fallbackTarget) {
        approvedManifest = {
          ...fallbackTarget,
          status: 'PORT_APPROVED',
          portApprovalStatus: 'PORT_APPROVED',
          portApprovedAt: now,
          portApprovedBy: 'Dispatcher Cảng Tiên Sa (Trần Hữu Long)',
        }
        registerPermanentlyApprovedManifest(approvedManifest)
      }
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (e) {
      console.warn(e)
    }

    // Đồng bộ trạng thái PORT_APPROVED lên cơ sở dữ liệu PostgreSQL (nếu không chạy silent và có remoteId hợp lệ)
    const remoteIdToApprove = approvedManifest?.id || approvedManifest?.manifestId || approvedManifest?.manifestNumber || manifestId
    if (remoteIdToApprove && remoteIdToApprove !== '1e2fbb53-544b-44e6-abcc-1f461c8a311a' && !options?.silent) {
      shippingLineApi.approveManifestAtPort(remoteIdToApprove).catch(() => {})
    }

    // Sinh danh sách Container chia về từng Công ty vận tải ở trạng thái CHỜ TRANSPORT GỬI XE & TÀI XẾ
    let newGateBookings = []
    if (approvedManifest && Array.isArray(approvedManifest.containers)) {
      const existingGenerated = this.getGeneratedGateBookings()
      const filteredExisting = existingGenerated.filter(
        b => b.sourceManifestNumber !== approvedManifest.manifestNumber && b.sourceManifestId !== approvedManifest.manifestId
      )

      // Đảm bảo thứ tự phân bổ chuẩn theo quy tắc: Cont lạnh/DG ưu tiên -> gom B/L -> Cont nặng hạ trước
      const sortedContainers = sortContainersForYardAllocation(approvedManifest.containers)
      approvedManifest.containers = sortedContainers

      const isImport = approvedManifest.direction === 'IMPORT'
      newGateBookings = sortedContainers.map((c, idx) => {
        const carrierProfile =
          TRANSPORT_COMPANIES_POOL.find(p => p.companyName === c.transportCompany) ||
          TRANSPORT_COMPANIES_POOL[idx % TRANSPORT_COMPANIES_POOL.length]

        const shortVoyage = (approvedManifest.voyageNumber || 'V26').replace(/[^A-Z0-9]/gi, '')
        const contSuffix = (c.containerNumber || `00${idx + 1}`).slice(-4)
        const bookingCode = `BK-${shortVoyage}-${contSuffix}`

        // NẾU TÀU ĐÃ CÓ KẾ HOẠCH DỠ BÃI SMART YARD PRE-ALLOCATION (ĐÃ CÓ SẴN VỊ TRÍ PHÂN BỔ):
        // CHỈ lấy vị trí nếu đã được bấm Phân Bổ Bãi Tự Động (isPreAllocated === true)
        const preAllocatedCont = preAllocatedPlan?.containers?.find(
          p => (p.containerNumber || '').trim().toUpperCase() === (c.containerNumber || '').trim().toUpperCase()
        )
        const isOfficiallyAllocated = Boolean(
          (preAllocatedCont && preAllocatedCont.isPreAllocated) ||
          c.isPreAllocated ||
          (preAllocatedPlan && preAllocatedPlan.isPreAllocated)
        )
        const existingSlotStr = isOfficiallyAllocated ? (preAllocatedCont?.reservedSlot || c.reservedSlot || c.yardSlot || c.allocatedSlot) : null
        let autoYardSlot = null
        if (existingSlotStr) {
          const parsed = parseSlotCoordinate(existingSlotStr)
          if (parsed) {
            const is20 = String(c.isoType || '40HC').startsWith('20')
            const isReefer = Boolean(c.isReefer) || /RF|RH|R[01]/.test(String(c.isoType || ''))
            const isDG = String(c.dgClass || '').includes('IMO') || String(c.dgClass || '').includes('Class')
            autoYardSlot = {
              slotId: parsed.coordinate,
              posId: parsed.coordinate,
              zoneCode: parsed.blockCode.slice(0, 1),
              zoneName: `Khu ${parsed.blockCode.slice(0, 1)}`,
              blockCode: parsed.blockCode,
              bay: parsed.bay,
              bayCode: String(parsed.bay).padStart(2, '0'),
              bayDisplay: `Bay ${String(parsed.bay).padStart(2, '0')}`,
              row: parsed.row,
              rowCode: String(parsed.row).padStart(2, '0'),
              tier: parsed.tier,
              tierCode: String(parsed.tier),
              gate: 'Gate 1',
              gateDisplay: 'Gate 1 (Cổng Cảng Tiên Sa)',
              slotName: `Khu ${parsed.blockCode} · Bay ${String(parsed.bay).padStart(2, '0')} (R${String(parsed.row).padStart(2, '0')}-T${parsed.tier})`,
              fullLocation: `Block ${parsed.blockCode} · Bay ${String(parsed.bay).padStart(2, '0')} · Row ${String(parsed.row).padStart(2, '0')} · Tier ${parsed.tier}`,
              size: is20 ? 20 : 40,
              isoType: c.isoType || '40HC',
              isReefer,
              isDG,
              allocationScore: preAllocatedCont?.allocationScore || 95,
              allocationReason: preAllocatedCont?.allocationReason || 'Phân bổ từ Kế Hoạch Dỡ Hàng Chiều Nhập (Smart Yard Pre-Allocation)',
              autoAssigned: true,
              assignedAt: new Date().toLocaleString('vi-VN'),
            }
          }
        }

        // Tự động phân bổ bãi trực tiếp theo chuẩn quy tắc Cảng Tiên Sa (Không dùng bãi đệm tạm Khu A)
        if (!autoYardSlot || autoYardSlot.isTemporaryBuffer || autoYardSlot.allocationScore === 50) {
          autoYardSlot = computeAutoYardSlot(c, approvedManifest.direction || (isImport ? 'IMPORT' : 'EXPORT'), idx, sortedContainers)
        }

        // Đồng bộ ngay vị trí tự động đặt vào yardReservationStore của Sơ đồ bãi Cảng Tiên Sa
        try {
          yardReservationStore.addReservation({
            ...autoYardSlot,
            containerId: c.containerNumber,
            containerNo: c.containerNumber,
            bookingCode,
            company: c.transportCompany || carrierProfile.companyName,
            vesselName: approvedManifest.vesselName,
            voyageNumber: approvedManifest.voyageNumber,
          })
        } catch (err) {
          console.warn('Auto yard reservation sync warning:', err)
        }

        // Bộ chứng từ chỉ lấy dữ liệu thật do khách hàng / vận tải tải lên từ đơn Dịch vụ ePort (không tự sinh sample.pdf giả)
        const manifestDocuments = []

        return {
          id: bookingCode,
          realId: bookingCode,
          isFromVesselManifest: true,
          sourceManifestId: approvedManifest.manifestId,
          sourceManifestNumber: approvedManifest.manifestNumber,
          vesselName: approvedManifest.vesselName,
          voyageNumber: approvedManifest.voyageNumber,
          shippingLine: approvedManifest.shippingLine,
          direction: approvedManifest.direction || (isImport ? 'IMPORT' : 'EXPORT'),
          vesselEta: approvedManifest.eta || null,
          vesselEtaDate: approvedManifest.etaDate || (approvedManifest.eta ? String(approvedManifest.eta).split(' ')[0] : null),
          etaDate: approvedManifest.etaDate || (approvedManifest.eta ? String(approvedManifest.eta).split(' ')[0] : null),
          company: c.transportCompany || carrierProfile.companyName,
          companyId: carrierProfile.companyId,
          contactName: carrierProfile.contactPerson,
          phone: carrierProfile.phone,
          email: carrierProfile.email,
          containerId: c.containerNumber,
          containerType: c.isoType || '40HC',
          cargoType: autoYardSlot.isReefer ? 'Reefer (Hàng lạnh)' : (autoYardSlot.isDG ? 'Dangerous (Hàng nguy hiểm)' : 'General (Hàng khô)'),
          cargoDescription: c.cargoDescription || 'Hàng hóa đóng container',
          tempRequired: c.tempRequired || 'Nhiệt độ phòng (Dry)',
          dgClass: c.dgClass || 'Non-DG',
          sealNumber: c.sealNumber || 'SL-88412',
          grossWeightKg: c.grossWeightKg || 25400,
          cargoDeclarationId: c.blNumber || approvedManifest.blNumber || (approvedManifest.bills?.[0]?.blNumber) || 'BL-VNDAD',
          cargoDeclarationStatus: 'Approved',

          // VỊ TRÍ BÃI ĐÃ ĐƯỢC HỆ THỐNG TỰ ĐỘNG ĐẶT ĐÚNG KHU VỰC (CONT LẠNH -> KHU D, CONT THƯỜNG -> KHU A/B)
          autoYardSlot,

          // BỘ GIẤY TỜ HÀNG HÓA ĐÃ CÓ TỪ MANIFEST (XEM ĐƯỢC NGAY LẬP TỨC)
          documents: manifestDocuments,

          // LÚC MỚI DUYỆT TÀU: CHƯA CÓ XE, CHƯA CÓ TÀI XẾ, CHƯA CÓ GIỜ HẸN (ĐỢI BÊN TRANSPORT LÀM & GỬI LẠI)
          transportSubmitted: false,
          transportSentAt: null,
          vehicleId: null,
          licensePlate: null,
          trailerPlate: null,
          vehicleType: 'Đang chờ Transport điều phối',
          vehicleStatus: 'Pending',
          driverId: null,
          driverName: null,
          licenseNumber: null,
          licenseClass: 'FC',
          licenseStatus: 'Pending',
          driverStatus: 'Pending',
          operation: isImport ? 'Pickup' : 'Dropoff',
          eta: null,
          etaWindow: null,
          expectedDuration: '45 phút',
          requestedGate: 'Gate 1',
          transportDocuments: [],

          // Chỉ giữ thông tin xe/tài xế thực tế nếu đã khai báo từ trước, không tự điền xe/tài xế mẫu
          suggestedPlate: c.suggestedPlate || null,
          suggestedTrailer: c.suggestedTrailer || null,
          suggestedDriver: c.suggestedDriver || null,
          suggestedLicense: c.suggestedLicense || null,
          suggestedGate: 'Gate 1',
          suggestedEta: c.suggestedEta || '08:30',

          gateFee: 300000,
          handlingFee: 200000,
          totalFee: 500000,
          paymentStatus: 'Unpaid',
          portBillPaid: false,
          gateCapacity: { gate: 'Gate 1', current: 8, max: 20, status: 'Available' },
          status: 'WaitingTransport', // Trạng thái: Chờ Công ty Vận tải gửi Xe & Tài xế
          createdAt: new Date().toLocaleString('vi-VN'),
          reviewStartedAt: null,
          reviewedBy: null,
          approvedAt: null,
          approvedBy: null,
          rejectionReason: '',
          rejectionNote: '',
          dispatchOrderId: null,
          timelineStep: 1,
        }
      })

      try {
        localStorage.setItem(GENERATED_BOOKINGS_KEY, JSON.stringify([...newGateBookings, ...filteredExisting]))
      } catch (e) {
        console.warn('Lỗi lưu generated gate bookings:', e)
      }

      // Đồng bộ danh sách generatedBookings lên PostgreSQL
      try {
        const targetRemoteId = approvedManifest?.id || approvedManifest?.manifestId || manifestId
        if (targetRemoteId && targetRemoteId !== '1e2fbb53-544b-44e6-abcc-1f461c8a311a' && !options?.silent) {
          shippingLineApi.savePortBookings(targetRemoteId, newGateBookings).catch(() => {})
        }
      } catch (e) {}
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', {
        detail: { manifestId, status: 'PORT_APPROVED', generatedBookings: newGateBookings }
      }))
    }

    return { updated, approvedManifest, newGateBookings }
  },

  /**
   * Chuyển Trạng Thái Cảng của Tàu về lại "Chờ phê duyệt" (PENDING_APPROVAL)
   */
  resetManifestToPending(manifestId) {
    unregisterPermanentlyApprovedManifest(manifestId)
    const list = this.getSyncedManifests()
    let targetManifestNumber = null
    const updated = list.map(m => {
      const isTarget = m.manifestId === manifestId || m.id === manifestId || m.manifestNumber === manifestId ||
        m.voyageNumber === manifestId || (m.vesselName && String(manifestId).includes(m.vesselName))
      if (isTarget) {
        unregisterPermanentlyApprovedManifest(m)
        targetManifestNumber = m.manifestNumber
        return {
          ...m,
          status: 'SENT_TO_PORT',
          portApprovalStatus: 'PENDING_APPROVAL',
          portApprovedAt: null,
          portApprovedBy: null,
        }
      }
      return m
    })

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      const existingGenerated = this.getGeneratedGateBookings()
      const toRemove = existingGenerated.filter(
        b => b.sourceManifestId === manifestId || b.sourceManifestNumber === targetManifestNumber || b.sourceManifestNumber === manifestId
      )
      toRemove.forEach(b => {
        if (b.containerId) yardReservationStore.clearContainerReservation(b.containerId)
      })
      const remaining = existingGenerated.filter(
        b => b.sourceManifestId !== manifestId && b.sourceManifestNumber !== targetManifestNumber && b.sourceManifestNumber !== manifestId
      )
      localStorage.setItem(GENERATED_BOOKINGS_KEY, JSON.stringify(remaining))

      // Đồng bộ tuần tự trạng thái về Pending rồi xóa generatedBookings trên PostgreSQL
      try {
        const targetRemoteId = (targetManifestNumber && targetManifestNumber !== manifestId) ? targetManifestNumber : manifestId
        shippingLineApi.resetManifestPendingAtPort(targetRemoteId)
          .catch((err) => console.warn('Lỗi resetManifestPendingAtPort:', err))
          .then(() => shippingLineApi.savePortBookings(targetRemoteId, []).catch((err) => console.warn('Lỗi clearPortBookings:', err)))
      } catch (e) {}
    } catch (e) {
      console.warn(e)
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', {
        detail: { manifestId, status: 'PENDING_APPROVAL' }
      }))
    }

    return updated
  },

  /**
   * Cập nhật trạng thái chuyến tàu (SCHEDULED, IN_TRANSIT, BERTHED, OPERATING, DEPARTED, COMPLETED)
   */
  updateManifestVesselStatus(manifestId, newStatus) {
    const list = this.getSyncedManifests()
    let updatedManifest = null
    const updated = list.map(m => {
      if (m.manifestId === manifestId || m.id === manifestId || m.manifestNumber === manifestId) {
        updatedManifest = {
          ...m,
          vesselStatus: newStatus
        }
        return updatedManifest
      }
      return m
    })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (e) {
      console.warn(e)
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', {
        detail: { type: 'VESSEL_STATUS_UPDATED', manifestId, vesselStatus: newStatus, manifest: updatedManifest }
      }))
    }
    return updatedManifest
  },

  /**
   * Cập nhật trạng thái chuyến tàu theo Mã Chuyến Tàu (đồng bộ từ phân hệ Hãng Tàu / Chuyến Tàu)
   */
  updateManifestVesselStatusByVoyage(voyageNumber, newStatus) {
    if (!voyageNumber) return
    const cleanVoy = voyageNumber.trim().toUpperCase()
    const list = this.getSyncedManifests()
    let updatedManifest = null
    const updated = list.map(m => {
      const mVoy = (m.voyageNumber || m.voyageInfo?.voyageNumber || '').trim().toUpperCase()
      if (mVoy === cleanVoy) {
        updatedManifest = {
          ...m,
          vesselStatus: newStatus
        }
        return updatedManifest
      }
      return m
    })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (e) {
      console.warn(e)
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', {
        detail: { type: 'VESSEL_STATUS_UPDATED', voyageNumber, vesselStatus: newStatus, manifest: updatedManifest }
      }))
    }
    return updatedManifest
  },

  /**
   * Reset toàn bộ dữ liệu test về 0 (TRUNCATE trên PostgreSQL và xóa sạch localStorage) để test lại từ đầu
   */
  async resetAllData() {
    try {
      await shippingLineApi.resetAllManifestsAtPort().catch(() => {})
    } catch (e) {
      console.warn('Lỗi gọi resetAllManifestsAtPort:', e)
    }
    try {
      clearLocalSyncStorage()
    } catch (e) {
      console.warn('Lỗi xóa localStorage khi reset:', e)
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', {
        detail: { type: 'RESET_ALL' }
      }))
      window.dispatchEvent(new Event('storage'))
    }
    return []
  },

  /**
   * ĐỒNG BỘ 4 BÊN TUYỆT ĐỐI KHI CẬP NHẬT VỊ TRÍ BÃI (SLOT):
   * 1. Smart Yard Pre-Allocation (Điều Phối Dỡ Tàu & Đặt Chỗ Trước)
   * 2. Danh Sách Container Theo Ngày & Chuyến Tàu (Gate Bookings)
   * 3. Sơ Đồ Bãi Tiên Sa (yardReservationStore & Layout)
   * 4. Lịch tài xế đã gửi cho Transport (Order Fleet & Dispatch Alerts)
   */
  async syncYardSlotAcrossAll({
    containerNumber,
    bookingCode,
    manifestId,
    newSlotCoordinate,
    reason = 'Điều độ cập nhật vị trí bãi đồng bộ',
    status = null,
    vehiclePlate = null,
    driverName = null,
    company = null,
    vesselName = null,
    voyageNumber = null,
  }) {
    if (!containerNumber && !bookingCode) return false
    const contNo = (containerNumber || '').trim().toUpperCase()
    const bookNo = (bookingCode || '').trim().toUpperCase()

    // 1. Phân tích tọa độ slot chuẩn
    const parsed = parseSlotCoordinate(newSlotCoordinate)
    if (!parsed) {
      console.warn('Không thể parse tọa độ slot:', newSlotCoordinate)
      return false
    }

    const { blockCode, bay, row, tier, formattedSlot, slotCode, coordinate } = parsed
    const resolvedStatus = status || (reason?.toLowerCase().includes('in yard') || reason?.toLowerCase().includes('hạ bãi') ? 'in_yard' : 'reserved')

    // 2. CẬP NHẬT BÊN 3: SƠ ĐỒ BÃI (yardReservationStore)
    try {
      yardReservationStore.addReservation({
        blockCode,
        bay,
        row,
        tier,
        slotCode,
        posId: `${blockCode}-B${String(bay).padStart(2, '0')}-R${row}-T${tier}`,
        containerId: contNo || bookNo,
        containerNo: contNo || bookNo,
        bookingCode: bookNo || `BK-${contNo}`,
        vehiclePlate: vehiclePlate || undefined,
        driverName: driverName || undefined,
        company: company || undefined,
        vesselName: vesselName || undefined,
        voyageNumber: voyageNumber || undefined,
        allocationReason: reason,
        status: resolvedStatus,
        source: 'syncYardSlotAcrossAll',
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      console.warn('Lỗi cập nhật yardReservationStore:', err)
    }

    // 3. CẬP NHẬT BÊN 2: DANH SÁCH CONTAINER THEO NGÀY & CHUYẾN TÀU (GENERATED_BOOKINGS_KEY)
    try {
      const raw = localStorage.getItem(GENERATED_BOOKINGS_KEY)
      const list = raw ? JSON.parse(raw) : []
      if (Array.isArray(list)) {
        let changed = false
        const updatedList = list.map(b => {
          const bCont = (b.containerId || b.containerNo || b.containerNumber || (Array.isArray(b.containerNumbers) ? b.containerNumbers[0] : '') || '').trim().toUpperCase()
          const bId = (b.id || b.bookingCode || '').trim().toUpperCase()
          const digits = contNo.match(/\d{4}$/)?.[0]
          const isMatch = (contNo && (bCont === contNo || (digits && bCont.includes(digits)))) ||
                          (bookNo && (bId === bookNo || bId.includes(bookNo) || bookNo.includes(bId)))

          if (isMatch) {
            changed = true
            const autoYardSlot = {
              ...(b.autoYardSlot || {}),
              blockCode,
              bay,
              bayCode: String(bay).padStart(2, '0'),
              bayDisplay: `Bay ${String(bay).padStart(2, '0')}`,
              row,
              rowCode: String(row).padStart(2, '0'),
              tier,
              tierCode: String(tier),
              slotName: `Khu ${blockCode} · Bay ${String(bay).padStart(2, '0')} (R${String(row).padStart(2, '0')}-T${tier})`,
              fullLocation: formattedSlot,
              posId: `${blockCode}-B${String(bay).padStart(2, '0')}-R${row}-T${tier}`,
              coordinate,
            }
            return {
              ...b,
              autoYardSlot: {
                ...autoYardSlot,
                isPreAllocated: true,
                isTemporaryBuffer: false,
              },
              isPreAllocated: true,
              yardSlot: formattedSlot,
              yardBlockCode: blockCode,
              yardBay: bay,
              yardRow: row,
              yardTier: tier,
            }
          }
          return b
        })
        if (changed) {
          localStorage.setItem(GENERATED_BOOKINGS_KEY, JSON.stringify(updatedList))
        }
      }
    } catch (err) {
      console.warn('Lỗi cập nhật GENERATED_BOOKINGS_KEY:', err)
    }

    // 3.5 CẬP NHẬT TRONG DANH SÁCH BẢN KHAI MANIFESTS (STORAGE_KEY)
    let resolvedManifestId = manifestId || null
    try {
      const manifests = this.getSyncedManifests()
      if (Array.isArray(manifests) && manifests.length > 0) {
        let manifestChanged = false
        const updatedManifests = manifests.map(m => {
          if (!Array.isArray(m.containers)) return m
          let contChanged = false
          const updatedContainers = m.containers.map(c => {
            const cNo = (c.containerNumber || c.containerId || '').trim().toUpperCase()
            if (contNo && cNo === contNo) {
              contChanged = true
              manifestChanged = true
              if (!resolvedManifestId) {
                resolvedManifestId = m.manifestId || m.id
              }
              return {
                ...c,
                isPreAllocated: true,
                yardSlot: formattedSlot,
                allocatedSlot: formattedSlot,
                blockCode,
                bay,
                row,
                tier
              }
            }
            return c
          })
          return contChanged ? { ...m, isPreAllocated: true, containers: updatedContainers } : m
        })
        if (manifestChanged) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedManifests))
        }
      }
    } catch (err) {
      console.warn('Lỗi cập nhật STORAGE_KEY:', err)
    }

    // 4. CẬP NHẬT BÊN 4: LỊCH TÀI XẾ ĐÃ GỬI CHO TRANSPORT (ORDER_FLEET_KEY & Alerts)
    try {
      const fleetKeys = [contNo, bookNo].filter(Boolean)
      const digits = contNo.match(/\d{4}$/)?.[0]
      if (digits) fleetKeys.push(digits)

      const existingFleet = this.getOrderFleet(contNo) || this.getOrderFleet(bookNo) || {}
      this.saveOrderFleet(fleetKeys, {
        ...existingFleet,
        yardSlot: formattedSlot,
        blockCode,
        bay,
        row,
        tier,
        slotCode,
        updatedAt: new Date().toISOString(),
        lastSlotUpdateReason: reason,
      })

      // Ghi thông báo cảnh báo/lịch mới cho Transport
      this.recordTransportSubmissionAlert({
        id: `slot-update-${contNo}-${Date.now()}`,
        bookingId: bookNo || contNo,
        containerId: contNo,
        title: `Cập nhật vị trí bãi container ${contNo}`,
        message: `Vị trí bãi cho container ${contNo} đã được điều độ chuyển sang ${formattedSlot}. Lịch điều xe và vị trí hạ/lấy container đã được cập nhật.`,
        carrierName: company || existingFleet.company || 'Đơn vị Vận tải',
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      console.warn('Lỗi cập nhật lịch tài xế transport:', err)
    }

    // 5. CẬP NHẬT BÊN 1: SMART YARD PRE-ALLOCATION (Backend C# API)
    const targetManifestId = manifestId || resolvedManifestId
    if (targetManifestId) {
      try {
        await yardDischargeService.overrideSlot({
          manifestId: targetManifestId,
          containerNumber: contNo,
          newSlotCoordinate: coordinate,
          reason,
        }).catch(err => console.warn('C# override-slot warning:', err))
      } catch (err) {
        console.warn('Lỗi gọi C# override-slot:', err)
      }
    }

    // 6. Phát sự kiện toàn cục để tất cả các UI component tự động re-render đồng bộ ngay lập tức!
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('yard-reservation-updated', {
        detail: { containerNumber: contNo, bookingCode: bookNo, blockCode, bay, row, tier, formattedSlot }
      }))
      window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', {
        detail: { type: 'YARD_SLOT_SYNCED', containerNumber: contNo, slot: formattedSlot }
      }))
      window.dispatchEvent(new Event('storage'))
    }

    return true
  },

  /**
   * Đăng ký lắng nghe sự kiện khi có Manifest mới được truyền cho Cảng, được duyệt, hoặc khi Transport gửi Xe/Tài xế
   */
  subscribe(callback) {
    if (typeof window === 'undefined') return () => {}
    const handler = (e) => callback(e.detail?.manifest || e.detail)
    window.addEventListener('nexusport:manifest_synced', handler)
    window.addEventListener('storage', () => callback(null))
    return () => {
      window.removeEventListener('nexusport:manifest_synced', handler)
      window.removeEventListener('storage', () => callback(null))
    }
  }
}
