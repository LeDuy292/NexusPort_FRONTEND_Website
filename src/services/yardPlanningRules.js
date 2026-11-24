/**
 * yardPlanningRules.js
 * TẬP TRUNG TOÀN BỘ QUY TẮC QUY HOẠCH BÃI CẢNG TIÊN SA DÙNG CHUNG TOÀN BỘ HỆ THỐNG
 * (Chuẩn hóa từ YardSlotReservationModal, BlockDetail, manifestPortSyncService)
 */

import { yardReservationStore } from './yardReservationStore.js'

export const padPos = (val) => String(val || 1).padStart(2, '0')

/**
 * Lấy mã định danh chuẩn của container
 */
export function getContainerKey(c) {
  if (!c) return ''
  if (typeof c === 'string') return c.trim().toUpperCase()
  return String(c.containerNumber || c.containerId || c.containerNo || c.id || '').trim().toUpperCase()
}

/**
 * Kiểm tra container 20ft hay 40ft
 */
export function isContainer20(c) {
  if (!c) return false
  const sizeNum = Number(c.containerLengthFt || c.size || c.autoYardSlot?.size || c.slot?.size || 0)
  if (sizeNum === 20) return true
  if (sizeNum === 40 || sizeNum === 45) return false

  const bayNum = Number(c.bay || c.autoYardSlot?.bay || c.slot?.bay || 0)
  const t = String(c.containerType || c.isoType || c.type || '').toUpperCase()

  if (t.includes('20') || /^2[0-9A-Z]/.test(t) || t.includes('22G') || t.includes('22R') || t.includes('20GP') || t.includes('20DC')) {
    return true
  }
  if (t.includes('40') || t.includes('45') || /^4[0-9A-Z]/.test(t) || t.includes('42G') || t.includes('45G') || t.includes('40HC') || t.includes('40GP')) {
    return false
  }

  // Tiên Sa convention: Bay lẻ (01, 03, 05...) là vị trí 20ft (1 ô đơn)
  if (bayNum > 0 && bayNum % 2 !== 0) {
    return true
  }
  // Bay chẵn (02, 06, 10...) là vị trí 40ft (2 ô kép)
  if (bayNum > 0 && bayNum % 2 === 0) {
    return false
  }

  return false
}

/**
 * Kiểm tra container lạnh (Reefer)
 */
export function isContainerReefer(c) {
  if (!c) return false
  const iso = String(c.isoType || c.containerType || '').toUpperCase()
  const temp = String(c.tempRequired || '')
  return Boolean(c.isReefer || c.isRf || c.cargoType === 'REEFER') || /RF|RH|R[01]/.test(iso) || temp.includes('-') || temp.toLowerCase().includes('frozen')
}

/**
 * Kiểm tra container nguy hiểm (DG)
 */
export function isContainerDG(c) {
  if (!c) return false
  const dg = String(c.dgClass || '')
  return Boolean(c.isDG) || dg.includes('IMO') || dg.includes('Class')
}

/**
 * CÁC NHÓM BLOCK PHÂN KHU CHUẨN CẢNG TIÊN SA:
 * - HÀNG XUẤT KHẨU: Nằm ở các dãy gần cầu tàu (A01–A04 gần cầu 4–5, B01–B02 gần cầu 1 STS, C01–C03 gần cầu 2)
 * - HÀNG NHẬP KHẨU: Ưu tiên gần cổng trước -> Chọn C10 lùi dần về C04, rồi qua B04, B03 (C10, C09, C08, C07, C06, C05, C04, B04, B03)
 * - HÀNG LẠNH (REEFER): Khu D chuyên dụng có ổ cắm điện (D01–D02)
 * - Chỉ sắp xếp vào các khu A, B, C, D (Không dùng khu E, F).
 */
export const EXPORT_BLOCKS = ['A01', 'A02', 'A03', 'A04', 'B01', 'B02', 'C01', 'C02', 'C03']
export const IMPORT_BLOCK_PRIORITY = ['C10', 'C09', 'C08', 'C07', 'C06', 'C05', 'C04', 'B04', 'B03']
export const IMPORT_BLOCKS = IMPORT_BLOCK_PRIORITY
export const REEFER_BLOCKS = ['D01', 'D02']

export function isExportBlock(blockCode) {
  const code = String(blockCode || '').toUpperCase()
  return EXPORT_BLOCKS.includes(code)
}

export function isImportBlock(blockCode) {
  const code = String(blockCode || '').toUpperCase()
  return IMPORT_BLOCKS.includes(code)
}

export function resolveTargetBlock(c, direction = 'EXPORT', existingOccupancyByBlock = {}) {
  if (isContainerReefer(c)) return 'D01'
  if (isContainerDG(c)) return 'C01'
  const dir = String(direction || '').toUpperCase()
  if (dir === 'IMPORT') {
    // 1. Ưu tiên mong muốn cho Hàng Nhập: C10 lùi dần về C04, rồi qua B04, B03
    for (const b of IMPORT_BLOCK_PRIORITY) {
      const count = existingOccupancyByBlock[b] || 0
      if (count < 80) {
        return b
      }
    }
    // 2. Linh hoạt khi quá tải / đầy chỗ: Có thể dùng các block xuất còn trống (A01–A04, B01–B02, C01–C03)
    for (const b of EXPORT_BLOCKS) {
      const count = existingOccupancyByBlock[b] || 0
      if (count < 80) {
        return b
      }
    }
    return 'C10'
  }

  // 1. Ưu tiên mong muốn cho Hàng Xuất: các dãy gần cầu tàu (A01–A04, B01–B02, C01–C03)
  for (const b of EXPORT_BLOCKS) {
    const count = existingOccupancyByBlock[b] || 0
    if (count < 80) {
      return b
    }
  }
  // 2. Linh hoạt khi quá tải / đầy chỗ: Có thể tràn sang các block khác (C10 lùi dần, B04, B03)
  for (const b of IMPORT_BLOCK_PRIORITY) {
    const count = existingOccupancyByBlock[b] || 0
    if (count < 80) {
      return b
    }
  }
  return 'B01'
}

/**
 * Tạo bản ghi vị trí bãi chuẩn hoá
 */
export function createSlotRecord(blockCode, bayNum, rowNum, tierNum, size = 40) {
  const padB = padPos(bayNum)
  const padR = padPos(rowNum)
  const posCode = `${blockCode}.${padB}.${padR}.${tierNum}`
  const posId = `${blockCode}-B${padB}-R${rowNum}-T${tierNum}`

  return {
    block: blockCode,
    blockCode,
    bay: bayNum,
    bayCode: padB,
    bayDisplay: `Bay ${padB}`,
    row: rowNum,
    rowCode: padR,
    tier: tierNum,
    tierCode: String(tierNum),
    size,
    containerLengthFt: size,
    moduleSpan: size === 40 ? 2 : 1,
    moduleStart: size === 40 ? (bayNum % 2 === 0 ? Math.floor(bayNum / 2) - 1 : Math.floor((bayNum - 1) / 2)) : Math.floor((bayNum - 1) / 2),
    gate: 'Gate 1',
    gateDisplay: 'Gate 1 (Cổng Cảng Tiên Sa)',
    posCode,
    slotCode: posCode,
    posId,
    slotId: posId,
    slotName: `Khu ${blockCode} · Bay ${padB} (R${padR}-T${tierNum})`,
    fullLocation: `Block ${blockCode} · Bay ${padB} · Row ${padR} · Tier ${tierNum}`,
    tag: 'ĐT',
    status: 'reserved',
    isPendingPlacement: true
  }
}

/**
 * THUẬT TOÁN QUY HOẠCH CONTAINER TRONG 1 BLOCK (CHUẨN TIÊN SA):
 * 1. Gom toàn bộ container cùng chuyến tàu về chung 1 Block (B01 cho hàng xuất, A01 cho hàng nhập).
 * 2. BẢO VỆ VỊ TRÍ ĐÃ CÓ SẴN (Collision Avoidance): Kiểm tra existingOccupiedSlots, tuyệt đối KHÔNG đè lên cont cũ.
 * 3. ƯU TIÊN XẾP CONT 40FT TRƯỚC: Cont 40ft xếp dồn 2 tầng (Tier 1 và Tier 2 đè lên nhau) theo từng Row (Row 1, Row 2...) tại Bay chẵn (Bay 02, 06...) trên các ô hoàn toàn trống.
 * 4. XẾP CONT 20FT SAU ĐÓ: Sau khi xếp hết 40ft, cont 20ft tiếp tục từ hàng/ô kế tiếp (TUYỆT ĐỐI KHÔNG TRÙNG VỊ TRÍ).
 * 5. Ghép đôi cont 20ft chung 1 row (Bay 01 và Bay 03) để tối ưu diện tích bãi.
 * 6. Luôn xuất phát từ Tier 1 (nền bãi). Không bao giờ đặt Tier 2 khi Tier 1 đang trống.
 * 7. Đảm bảo hiển thị đủ 100% container, không trùng vị trí (Zero Collision).
 */
export function planContainersForBlock(containersInBlock, blockCode = 'B01', existingOccupiedSlots = [], maxRows = 6, maxModules = 28) {
  const conts20 = []
  const conts40 = []

  containersInBlock.forEach(c => {
    if (isContainer20(c)) conts20.push(c)
    else conts40.push(c)
  })

  const slotMap = new Map()

  const assignSlot = (item, slot) => {
    slotMap.set(item, slot)
    const key = getContainerKey(item)
    if (key) slotMap.set(key, slot)
  }

  // 1. Khởi tạo bản đồ chiếm dụng ô (Occupancy Map) tránh trùng vị trí
  const occupiedGrid = new Map()
  const getOccupancyKey = (mod, r, t) => `${mod}-${r}-${t}`
  const isOccupied = (mod, r, t) => occupiedGrid.has(getOccupancyKey(mod, r, t))
  const setOccupied = (mod, r, t, info = true) => {
    occupiedGrid.set(getOccupancyKey(mod, r, t), info)
  }

  // Nạp toàn bộ các container đã có sẵn trong bãi (existingOccupiedSlots)
  (existingOccupiedSlots || []).forEach(s => {
    if (!s) return
    const cNo = String(s.containerNumber || s.containerId || s.reservedContainerNumber || '').trim().toUpperCase()
    if (!cNo || cNo === 'CONT' || cNo.startsWith('SLOT-')) return

    const bCode = s.blockCode || s.block
    if (bCode && bCode !== blockCode) return

    const row = Number(s.row) || 1
    const tier = Number(s.tier) || 1
    const bayNum = Number(s.bay) || 1
    const is20 = isContainer20(s) || (bayNum % 2 !== 0)
    const is40 = !is20 || Number(s.size || s.containerLengthFt) === 40 || s.moduleSpan === 2

    if (is40) {
      const startMod = bayNum % 2 === 0 ? Math.floor(bayNum / 2) - 1 : Math.floor((bayNum - 1) / 2)
      setOccupied(startMod, row, tier, s)
      setOccupied(startMod + 1, row, tier, s)
    } else {
      const targetMod = Math.floor((bayNum - 1) / 2)
      setOccupied(targetMod, row, tier, s)
    }
  })

  // 2. ƯU TIÊN XẾP CONTAINER 40FT TRƯỚC (Hàng 1, 2, 3... - Chồng tối đa 2 tầng trên ô trống):
  let c40Idx = 0
  outer40: for (let m = 0; m < maxModules - 1; m += 2) {
    for (let r = 1; r <= maxRows; r++) {
      if (c40Idx >= conts40.length) break outer40

      // Để đặt cont 40ft tại (module m, row r), cả module m và m+1 ở Tier 1 phải TRỐNG
      const tier1Free = !isOccupied(m, r, 1) && !isOccupied(m + 1, r, 1)
      if (!tier1Free) continue

      const bottomCont = conts40[c40Idx]
      c40Idx++
      const bayNum = m * 2 + 2

      // Cont tầng 1 (nền bãi)
      const slotBottom = createSlotRecord(blockCode, bayNum, r, 1, 40)
      assignSlot(bottomCont, slotBottom)
      setOccupied(m, r, 1, slotBottom)
      setOccupied(m + 1, r, 1, slotBottom)

      // Cont tầng 2 (nếu còn cont 40ft và Tier 2 cũng hoàn toàn trống)
      if (c40Idx < conts40.length && !isOccupied(m, r, 2) && !isOccupied(m + 1, r, 2)) {
        const topCont = conts40[c40Idx]
        c40Idx++
        const slotTop = createSlotRecord(blockCode, bayNum, r, 2, 40)
        assignSlot(topCont, slotTop)
        setOccupied(m, r, 2, slotTop)
        setOccupied(m + 1, r, 2, slotTop)
      }
    }
  }

  // 3. XẾP CONTAINER 20FT SAU ĐÓ (Ghép đôi 2 cont 20ft vào Bay 01 và Bay 03 trên các ô/hàng còn trống):
  let c20Idx = 0
  // Lượt 1: Ưu tiên tìm các hàng mà CẢ 2 ô (Bay lẻ: m và m+1) đều trống để ghép cặp đôi
  outer20Pairs: for (let m = 0; m < maxModules - 1; m += 2) {
    for (let r = 1; r <= maxRows; r++) {
      if (c20Idx >= conts20.length) break outer20Pairs

      const mod1Free = !isOccupied(m, r, 1)
      const mod2Free = !isOccupied(m + 1, r, 1)

      if (mod1Free && mod2Free) {
        const first20 = conts20[c20Idx]
        c20Idx++
        const bay1 = m * 2 + 1
        const slot1 = createSlotRecord(blockCode, bay1, r, 1, 20)
        assignSlot(first20, slot1)
        setOccupied(m, r, 1, slot1)

        if (c20Idx < conts20.length) {
          const second20 = conts20[c20Idx]
          c20Idx++
          const bay2 = m * 2 + 3
          const slot2 = createSlotRecord(blockCode, bay2, r, 1, 20)
          assignSlot(second20, slot2)
          setOccupied(m + 1, r, 1, slot2)
        }
      }
    }
  }

  // Lượt 2: Nếu vẫn còn cont 20ft lẻ, tìm ô đơn lẻ Tier 1 còn trống để lấp vào (ví dụ ô cạnh cont 20ft cũ)
  if (c20Idx < conts20.length) {
    outer20Single: for (let m = 0; m < maxModules; m++) {
      for (let r = 1; r <= maxRows; r++) {
        if (c20Idx >= conts20.length) break outer20Single

        if (!isOccupied(m, r, 1)) {
          const cont = conts20[c20Idx]
          c20Idx++
          const bayNum = m * 2 + 1
          const slot = createSlotRecord(blockCode, bayNum, r, 1, 20)
          assignSlot(cont, slot)
          setOccupied(m, r, 1, slot)
        }
      }
    }
  }

  return slotMap
}

/**
 * QUY HOẠCH TOÀN BỘ DANH SÁCH CONTAINER CỦA CHUYẾN TÀU
 * Trả về:
 * - highlightBlocks: Map các block có container (ví dụ { B01: { count: 8, containers }, D01: { count: 2, containers } })
 * - plannedContainers: Danh sách container đã được gắn autoYardSlot chuẩn
 * - slotMap: Map tra cứu vị trí theo containerKey hoặc object
 */
export function planAllManifestContainers(rawContainerList = [], direction = 'EXPORT', existingOccupiedBookings = []) {
  const highlightBlocks = {}

  // 1. Phân loại block chuẩn (B01 cho khô xuất, C10 lùi dần cho khô nhập, D01 cho lạnh, C01 cho nguy hiểm)
  const occupancyTracker = {}
  // Gom cont cùng chuyến tàu đứng cạnh nhau (sắp xếp ổn định theo chuyến, cả hàng xuất và hàng nhập) để được xếp liền kề trong bãi
  const voyageKeyOf = (c) => String(c.voyageNumber || c.voyage || c.manifestNumber || c.vesselName || '').trim().toUpperCase()
  const planningOrder = rawContainerList
    .map((c, i) => ({ c, i, k: voyageKeyOf(c) }))
    .sort((x, y) => (x.k < y.k ? -1 : x.k > y.k ? 1 : x.i - y.i))
    .map(x => x.c)
  planningOrder.forEach(c => {
    const targetBlock = resolveTargetBlock(c, direction, occupancyTracker)
    occupancyTracker[targetBlock] = (occupancyTracker[targetBlock] || 0) + 1
    if (!highlightBlocks[targetBlock]) {
      highlightBlocks[targetBlock] = { count: 0, containers: [] }
    }
    highlightBlocks[targetBlock].count += 1
    highlightBlocks[targetBlock].containers.push(c)
  })

  const globalSlotMap = new Map()

  // Thu thập các slot đã có từ trước (từ existingOccupiedBookings hoặc yardReservationStore)
  const currentManifestContNumbers = new Set(
    rawContainerList.map(c => getContainerKey(c)).filter(Boolean)
  )

  const storeRes = (typeof window !== 'undefined' && yardReservationStore?.getReservations)
    ? (yardReservationStore.getReservations() || [])
    : []

  const allExisting = []
  const seenOccKeys = new Set()

  // 1.1 Thu thập các container trong manifest đã có vị trí được lưu từ trước (hoặc điều độ đã đổi bãi)
  const explicitContainerReservations = new Map()
  storeRes.forEach(r => {
    const cNo = String(r.containerNo || r.containerId || '').trim().toUpperCase()
    if (cNo && currentManifestContNumbers.has(cNo)) {
      explicitContainerReservations.set(cNo, r)
    }
  })

  // Đăng ký vị trí đã giữ vào globalSlotMap và chiếm dụng trước để các cont khác né ra
  explicitContainerReservations.forEach((r, cNo) => {
    const bayNum = Number(r.bay) || 1
    const rowNum = Number(r.row) || 1
    const tierNum = Number(r.tier) || 1
    const bCode = r.blockCode || r.block || 'C10'
    const is20 = isContainer20(r) || (bayNum % 2 !== 0)
    const slotRec = createSlotRecord(bCode, bayNum, rowNum, tierNum, is20 ? 20 : 40)
    slotRec.status = 'reserved'
    slotRec.isManualOverride = true
    globalSlotMap.set(cNo, slotRec)
    allExisting.push(slotRec)
    seenOccKeys.add(`${bCode}-${bayNum}-${rowNum}-${tierNum}`)
  })

  const addExistingSlot = (s) => {
    if (!s) return
    const cNo = String(s.containerNo || s.containerId || s.containerNumber || '').trim().toUpperCase()
    if (cNo && currentManifestContNumbers.has(cNo)) return
    const key = `${s.blockCode || s.block}-${s.bay}-${s.row}-${s.tier}`
    if (!seenOccKeys.has(key)) {
      seenOccKeys.add(key)
      allExisting.push(s)
    }
  }

  storeRes.forEach(addExistingSlot)
  ;(existingOccupiedBookings || []).forEach(b => {
    if (b.autoYardSlot) addExistingSlot({ ...b.autoYardSlot, containerNumber: b.containerId })
  })

  // 2. Lập kế hoạch xếp dồn không va chạm cho từng block (chỉ xếp những container chưa có vị trí giữ trước)
  Object.keys(highlightBlocks).forEach(bCode => {
    const blockConts = highlightBlocks[bCode].containers
    const blockContsToPlan = blockConts.filter(c => !globalSlotMap.has(getContainerKey(c)))
    const blockExisting = allExisting.filter(s => (s.blockCode || s.block) === bCode)
    const blockMap = planContainersForBlock(blockContsToPlan, bCode, blockExisting)
    blockContsToPlan.forEach(c => {
      const key = getContainerKey(c)
      const slot = blockMap.get(c) || (key ? blockMap.get(key) : null)
      if (slot) {
        globalSlotMap.set(c, slot)
        if (key) globalSlotMap.set(key, slot)
      }
    })
  })

  // 3. Gắn autoYardSlot vào container
  const plannedContainers = rawContainerList.map((c, idx) => {
    const key = getContainerKey(c)
    const slot = globalSlotMap.get(c) || (key ? globalSlotMap.get(key) : null) || c.autoYardSlot || createSlotRecord('C10', 2, (idx % 6) + 1, 1, 40)
    return {
      ...c,
      autoYardSlot: slot
    }
  })

  return {
    highlightBlocks,
    plannedContainers,
    slotMap: globalSlotMap
  }
}

/**
 * KIỂM TRA QUY TẮC KỸ THUẬT XẾP TẦNG (TÁI SỬ DỤNG TỪ YardSlotReservationModal)
 * - Tầng 1 (nền bãi) luôn hợp lệ.
 * - Tầng > 1 bắt buộc phải có cont ở tầng dưới (Tier - 1).
 * - Cấm xếp 20ft lên nóc 40ft (tránh thủng nóc).
 * - Cấm xếp 40ft lên 1 cont 20ft (trụ góc hẫng lơ lửng).
 */
export function validateStackingRule({ size, tier, lowerContainer1, lowerContainer2 }) {
  if (tier <= 1) return { valid: true }

  if (size === 40) {
    if (!lowerContainer1 && !lowerContainer2) {
      return {
        valid: false,
        message: `Tầng dưới (Tier ${tier - 1}) đang trống! Container không thể lơ lửng trên không, bắt buộc phải xếp từ nền bãi (Tier 1) lên.`
      }
    }
    if ((lowerContainer1 && !lowerContainer2) || (!lowerContainer1 && lowerContainer2)) {
      const present = lowerContainer1 || lowerContainer2
      return {
        valid: false,
        message: `Vi phạm góc chịu lực: Không thể đặt container 40ft lên trên chỉ 1 container 20ft (${present.containerNumber || '20ft'}). 4 trụ góc của cont 40ft sẽ bị hẫng lơ lửng gây sập đổ!`
      }
    }
  } else {
    // 20ft
    if (!lowerContainer1) {
      return {
        valid: false,
        message: `Tầng dưới (Tier ${tier - 1}) đang trống! Container bắt buộc phải có container đỡ bên dưới hoặc xếp từ Tier 1.`
      }
    }
    const isLower40 = lowerContainer1.moduleSpan === 2 || Number(lowerContainer1.containerLengthFt || lowerContainer1.size) === 40
    if (isLower40) {
      return {
        valid: false,
        message: `Vi phạm kỹ thuật chất xếp bãi: Không được xếp container 20ft lên trên container 40ft (${lowerContainer1.containerNumber || '40ft'}), vì gù chịu lực giữa của cont 20ft sẽ ấn vào giữa nóc cont 40ft gây bẹp thủng nóc!`
      }
    }
  }

  return { valid: true }
}
