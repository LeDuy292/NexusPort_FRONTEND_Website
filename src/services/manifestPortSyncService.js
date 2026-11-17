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

const STORAGE_KEY = 'nexusport_synced_manifests_v12'
const GENERATED_BOOKINGS_KEY = 'nexusport_manifest_gate_bookings_v12'

/**
 * Tự động phân bổ & đặt vị trí bãi (Auto Yard Slot Placement) theo đúng loại Container:
 * - Cont Lạnh (Reefer: 40RF, 20RF, hoặc có nhiệt độ âm): Đặt vào Khu D - Bãi cont lạnh (Block D01, D02) có ổ cắm điện Reefer.
 * - Cont Nguy Hiểm (DG / IMO Class): Đặt vào Khu E - Bãi tổng hợp / hàng nguy hiểm (Block E01).
 * - Cont Thường Xuất Khẩu (Export Dry: 40HC, 20GP): Đặt vào Khu A - Sau cầu 4–5 (Block A01, A02).
 * - Cont Thường Nhập Khẩu (Import Dry: 40HC, 20GP): Đặt vào Khu B - Bãi container 1 (Block B01, B02).
 */
export function computeAutoYardSlot(container, direction = 'EXPORT', index = 0) {
  const iso = String(container?.isoType || container?.containerType || '40HC').toUpperCase()
  const temp = String(container?.tempRequired || '')
  const dg = String(container?.dgClass || '')
  const is20 = iso.startsWith('20')
  const size = is20 ? 20 : 40

  const isReefer = Boolean(container?.isReefer) || /RF|RH|R[01]/.test(iso) || temp.includes('-') || temp.toLowerCase().includes('frozen')
  const isDG = dg.includes('IMO') || dg.includes('Class')

  let zoneCode = 'A'
  let zoneName = 'Khu A · Bãi Cont Xuất Khẩu (Sau cầu 4–5)'
  let blockCode = index % 2 === 0 ? 'A01' : 'A02'
  let cargoCategory = 'Cont Khô Xuất Khẩu (Dry Export)'
  let badgeTheme = 'emerald'

  if (isReefer) {
    zoneCode = 'D'
    zoneName = 'Khu D · Bãi Container Lạnh (Reefer Zone)'
    blockCode = index % 2 === 0 ? 'D01' : 'D02'
    cargoCategory = 'Container lạnh (Reefer)'
    badgeTheme = 'cyan'
  } else if (isDG) {
    zoneCode = 'E'
    zoneName = 'Khu E · Bãi Hàng Nguy Hiểm (DG Hazmat)'
    blockCode = 'E01'
    cargoCategory = `Cont Nguy Hiểm (${dg})`
    badgeTheme = 'rose'
  } else if (direction === 'IMPORT') {
    zoneCode = 'B'
    zoneName = 'Khu B · Bãi Cont Nhập Khẩu (Bãi Container 1)'
    blockCode = index % 2 === 0 ? 'B01' : 'B02'
    cargoCategory = 'Cont Khô Nhập Khẩu (Dry Import)'
    badgeTheme = 'blue'
  }

  const bayNum = is20 ? (1 + (index * 2) % 15) : (2 + (index * 2) % 16)
  const bayStr = String(bayNum).padStart(2, '0')
  const rowNum = (index % 4) + 1
  const rowStr = String(rowNum).padStart(2, '0')
  const tierNum = 1
  const posId = `${blockCode}-B${bayStr}-R${rowNum}-T${tierNum}`
  const defaultGate = 'Gate 1'

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

// Danh sách manifest mặc định đã được Hãng tàu truyền cho Cảng Tiên Sa (mặc định Chờ phê duyệt)
const DEFAULT_SYNCED_MANIFESTS = []

const ORDER_FLEET_KEY = 'NEXUSPORT_ORDER_FLEET_MAP'

function clearLocalSyncStorage() {
  for (const key of Object.keys(localStorage)) {
    if (/^nexusport_(synced_manifests|manifest_gate_bookings|manifest_generated_gate_bookings)/.test(key)) {
      localStorage.removeItem(key)
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
  localStorage.setItem(GENERATED_BOOKINGS_KEY, JSON.stringify([]))
  localStorage.removeItem(ORDER_FLEET_KEY)
  localStorage.removeItem('NEXUSPORT_PORT_BILLS')
  localStorage.removeItem('NEXUSPORT_STORAGE_FEES')
  localStorage.removeItem('NEXUSPORT_TRANSPORT_SUBMISSIONS_ALERT')
  try {
    yardReservationStore.clearAll()
  } catch { /* ignore */ }
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
    const rawContainers = rm.records || rm.containers || []
    const mappedContainers = rawContainers.map((r, idx) => {
      const carrierProfile = TRANSPORT_COMPANIES_POOL[Math.floor(idx / 2) % TRANSPORT_COMPANIES_POOL.length]
      return {
        containerNumber: (r.containerNumber || r.container_no || '').trim().toUpperCase(),
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

    const manifestId = rm.id || rm.manifestId
    const isApproved = rm.portApprovalStatus === 'PORT_APPROVED' || rm.status === 'PORT_APPROVED'
    return {
      manifestId,
      id: manifestId,
      manifestNumber: rm.manifestNumber || `MNF-${manifestId.slice(0, 8)}`,
      bookingNumber: rm.bookingNumber || '',
      blNumber: rm.blNumber || rm.bills?.[0]?.blNumber || mappedContainers.find(c => c.blNumber)?.blNumber || '',
      voyageNumber: rm.voyageInfo?.voyageNumber || rm.voyageNumber || 'MM-2601S',
      vesselName: rm.voyageInfo?.vesselName || rm.vesselName || 'MAERSK MC-KINNEY MOLLER',
      shippingLine: rm.shippingLine || 'Maersk Line',
      direction: rm.direction || 'IMPORT',
      flag: rm.flag || 'Denmark (DK)',
      imoNumber: rm.imoNumber || 'IMO 9619907',
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
      portApprovedAt: rm.portApprovedAt || (isApproved ? new Date().toISOString() : null),
      portApprovedBy: rm.portApprovedBy || (isApproved ? 'Dispatcher Cảng Tiên Sa' : null),
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
        if (remoteList.length === 0) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
          localStorage.setItem(GENERATED_BOOKINGS_KEY, JSON.stringify([]))
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', {
              detail: { type: 'REMOTE_FETCH_SYNC', count: 0 }
            }))
          }
          return []
        }

        const current = []
        const remoteGenerated = []
        remoteList.forEach(rm => {
          const id = rm.id || rm.manifestId
          if (!id) return
          const mapped = this.mapRemoteManifest(rm)
          current.push(mapped)

          const isApproved = mapped.portApprovalStatus === 'PORT_APPROVED' || mapped.status === 'PORT_APPROVED'
          if (isApproved && Array.isArray(rm.generatedBookings) && rm.generatedBookings.length > 0) {
            rm.generatedBookings.forEach(gb => {
              if (gb) remoteGenerated.push(gb)
            })
          }
        })

        // Lưu danh sách manifest trước rồi thay thế GENERATED_BOOKINGS_KEY trực tiếp từ PostgreSQL
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
        localStorage.setItem(GENERATED_BOOKINGS_KEY, JSON.stringify(remoteGenerated))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('nexusport:manifest_synced', {
            detail: { type: 'REMOTE_FETCH_SYNC', count: remoteList.length }
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
        shippingLineApi.resetManifestPendingAtPort(manifestId)
          .catch(() => {})
          .then(() => shippingLineApi.savePortBookings(manifestId, []).catch(() => {}))
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
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          let hasMigrated = false
          const migrated = parsed.map(m => {
            if (m.voyageNumber === 'OC-2612E' || (m.vesselName && m.vesselName.includes('CONTINUITY'))) {
              if (m.eta === '2026-11-09 14:00' || !m.eta || m.eta.includes('2026-11-09')) {
                hasMigrated = true
                return {
                  ...m,
                  eta: '2026-11-25 14:00',
                  etd: '2026-11-26 18:00',
                  etaDate: '2026-11-25',
                  vesselEtaDate: '2026-11-25',
                }
              }
            }
            return m
          })
          if (hasMigrated) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
          }
          const manifestNumbers = new Set(migrated.map(m => m.manifestNumber || m.manifestId))
          const missingDefaults = DEFAULT_SYNCED_MANIFESTS.filter(d => !manifestNumbers.has(d.manifestNumber) && !manifestNumbers.has(d.manifestId))
          if (missingDefaults.length > 0) {
            const merged = [...migrated, ...missingDefaults]
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
            return merged
          }
          return migrated
        }
      }
    } catch (err) {
      console.warn('Lỗi đọc local manifests:', err)
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SYNCED_MANIFESTS))
    } catch (e) {}

    return DEFAULT_SYNCED_MANIFESTS
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

      // CHỈ hiển thị bookings của những tàu ĐÃ ĐƯỢC PHÊ DUYỆT (PORT_APPROVED)
      const approvedManifests = new Set(
        allManifests
          .filter(m => m.portApprovalStatus === 'PORT_APPROVED' || m.status === 'PORT_APPROVED')
          .map(m => m.manifestNumber || m.manifestId)
      )

      if (approvedManifests.size === 0) {
        return []
      }

      if (parsed.length > 0) {
        const filteredApproved = parsed.filter(b =>
          approvedManifests.has(b.sourceManifestNumber) || approvedManifests.has(b.sourceManifestId)
        )
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
            if (typeof item.eta === 'string' && item.eta.startsWith('2026-11-10')) {
              const refSource = item.paidAt || item.approvedAt
              const vnDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(refSource ? new Date(refSource) : new Date())
              const timePart = (item.eta.split('T')[1] || '08:30:00').replace(/[Zz]|([+-]\d{2}:\d{2})$/, '')
              patchDates = {
                ...patchDates,
                eta: `${vnDate}T${timePart}+07:00`,
              }
              hasBookingsMigrated = true
            }

            const slot = item.autoYardSlot || {}
            const isRf = (item.containerType || '').includes('RF') || item.isReefer
            const isDg = item.isDG || (item.dgClass && !item.dgClass.includes('Non-DG'))
            const bayNum = slot.bay || slot.bayCode || (item.containerType?.includes('20') ? (1 + (idx * 2) % 15) : (2 + (idx * 2) % 16))
            const bayStr = String(bayNum).padStart(2, '0')
            const rowNum = slot.row || ((idx % 4) + 1)
            const rowStr = String(rowNum).padStart(2, '0')
            const tierNum = slot.tier || 1
            const blockCode = slot.blockCode || (isRf ? 'D01' : (isDg ? 'E01' : (idx % 2 === 0 ? 'A01' : 'A02')))
            const autoGate = 'Gate 1'

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
              fullLocation: `Block ${blockCode} · Bay ${bayStr} · Row ${rowStr} · Tier ${tierNum}`,
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

            // 1. Nếu chưa có autoYardSlot (bản ghi cũ), tự động tính toán vị trí chuẩn theo loại Cont
            let slot = item.autoYardSlot
            if (!slot || !slot.blockCode) {
              slot = computeAutoYardSlot(
                {
                  containerNumber: item.containerId,
                  isoType: item.containerType,
                  tempRequired: item.tempRequired,
                  dgClass: item.dgClass,
                  cargoDescription: item.cargoDescription,
                },
                item.operation === 'Pickup' ? 'IMPORT' : 'EXPORT',
                idx
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
        const etaTime = customFleetData.etaTime || item.suggestedEta || '08:30'
        const todayVn = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
        const etaIso = customFleetData.eta || `${todayVn}T${etaTime.slice(0, 5)}:00+07:00`

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
          etaWindow: customFleetData.etaWindow || `${etaTime.slice(0, 5)} - ${Number(etaTime.slice(0, 2)) + 2}:00`,
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
    try {
      const raw = localStorage.getItem('NEXUSPORT_TRANSPORT_SUBMISSIONS_ALERT')
      const list = raw ? JSON.parse(raw) : []
      return Array.isArray(list) ? list : []
    } catch {
      return []
    }
  },

  recordTransportSubmissionAlert(alert) {
    if (!alert || !alert.id) return
    try {
      const current = this.getTransportSubmissionAlerts().filter(a => a.id !== alert.id)
      const next = [{ ...alert, read: false, createdAtIso: new Date().toISOString() }, ...current].slice(0, 15)
      localStorage.setItem('NEXUSPORT_TRANSPORT_SUBMISSIONS_ALERT', JSON.stringify(next))
    } catch (e) {
      console.warn(e)
    }
  },

  dismissTransportSubmissionAlert(id) {
    try {
      const current = this.getTransportSubmissionAlerts()
      const next = id ? current.filter(a => a.id !== id) : []
      localStorage.setItem('NEXUSPORT_TRANSPORT_SUBMISSIONS_ALERT', JSON.stringify(next))
    } catch (e) {
      console.warn(e)
    }
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
  approveManifestByPort(manifestId) {
    const list = this.getSyncedManifests()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    let approvedManifest = null

    const updated = list.map(m => {
      if (m.manifestId === manifestId || m.id === manifestId || m.manifestNumber === manifestId) {
        approvedManifest = {
          ...m,
          portApprovalStatus: 'PORT_APPROVED',
          portApprovedAt: now,
          portApprovedBy: 'Dispatcher Cảng Tiên Sa (Trần Hữu Long)',
        }
        return approvedManifest
      }
      return m
    })

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (e) {
      console.warn(e)
    }

    // Sinh danh sách Container chia về từng Công ty vận tải ở trạng thái CHỜ TRANSPORT GỬI XE & TÀI XẾ
    let newGateBookings = []
    if (approvedManifest && Array.isArray(approvedManifest.containers)) {
      const existingGenerated = this.getGeneratedGateBookings()
      const filteredExisting = existingGenerated.filter(
        b => b.sourceManifestNumber !== approvedManifest.manifestNumber && b.sourceManifestId !== approvedManifest.manifestId
      )

      const isImport = approvedManifest.direction === 'IMPORT'
      newGateBookings = approvedManifest.containers.map((c, idx) => {
        const carrierProfile =
          TRANSPORT_COMPANIES_POOL.find(p => p.companyName === c.transportCompany) ||
          TRANSPORT_COMPANIES_POOL[idx % TRANSPORT_COMPANIES_POOL.length]

        const shortVoyage = (approvedManifest.voyageNumber || 'V26').replace(/[^A-Z0-9]/gi, '')
        const contSuffix = (c.containerNumber || `00${idx + 1}`).slice(-4)
        const bookingCode = `BK-${shortVoyage}-${contSuffix}`

        // Tự động phân bổ & đặt container vào đúng khu vực bãi (Cont lạnh -> Khu D, Cont DG -> Khu E, Cont thường -> Khu A/B)
        const autoYardSlot = computeAutoYardSlot(c, approvedManifest.direction, idx)

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
          cargoDeclarationId: c.blNumber || 'BL-VNDAD',
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

      // Đồng bộ tuần tự lên PostgreSQL (duyệt manifest xong mới ghi danh sách generatedBookings) để tránh race condition JSONB
      try {
        shippingLineApi.approveManifestAtPort(manifestId)
          .catch(() => {})
          .then(() => shippingLineApi.savePortBookings(manifestId, newGateBookings).catch(() => {}))
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
    const list = this.getSyncedManifests()
    let targetManifestNumber = null
    const updated = list.map(m => {
      if (m.manifestId === manifestId || m.id === manifestId || m.manifestNumber === manifestId) {
        targetManifestNumber = m.manifestNumber
        return {
          ...m,
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
        shippingLineApi.resetManifestPendingAtPort(manifestId)
          .catch(() => {})
          .then(() => shippingLineApi.savePortBookings(manifestId, []).catch(() => {}))
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
   * Reset toàn bộ dữ liệu Bản khai & Container về rỗng để test lại từ đầu
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
