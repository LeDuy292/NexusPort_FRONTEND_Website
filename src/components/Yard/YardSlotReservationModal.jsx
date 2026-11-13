import { useState, useMemo, useEffect } from 'react'
import { padPosition } from '../../features/yard-design/positions'
import { yardReservationStore } from '../../services/yardReservationStore'

export default function YardSlotReservationModal({
  isOpen,
  onClose,
  block,
  booking,
  currentReservation,
  onConfirm,
}) {
  // Determine default container size from booking (e.g. '40FT HC' -> 40, '20FT' -> 20)
  const isDefault40 = useMemo(() => {
    const type = (booking?.containerType || '').toUpperCase()
    return type.includes('40') || type.includes('45') || (!type.includes('20') && Boolean(type))
  }, [booking?.containerType])

  const [size, setSize] = useState(isDefault40 ? 40 : 20)
  const [currentTier, setCurrentTier] = useState(1)
  const [warningMessage, setWarningMessage] = useState('')
  
  // Total modules, rows and tiers for this block
  const bayModules = useMemo(() => {
    if (block?.planning?.bayModules) return block.planning.bayModules
    if (block?.slots?.length) {
      const maxBay = Math.max(...block.slots.map((s) => Number(s.bay) || 1))
      return Math.max(10, Math.ceil(maxBay / 2))
    }
    return 20 // Default 20 modules (Bay 01 to 39)
  }, [block])

  const maxRows = block?.maxRows || block?.planning?.rows || 6
  const maxTiers = block?.maxTiers || block?.planning?.tiers || 4

  // Selection state: { module, row, tier } hoặc null nếu chưa chọn ô nào trong block hiện tại
  const [selection, setSelection] = useState(null)
  const [existingReservation, setExistingReservation] = useState(null)

  const currentBlockCode = block?.blockCode || block?.code || 'C01'
  const currentContId = (booking?.containerId || booking?.containerNo || '').trim().toUpperCase()
  const currentBookId = (booking?.id || booking?.bookingCode || '').trim().toUpperCase()

  // 1. TẬP HỢP TOÀN BỘ CÁC CONTAINER ĐANG CÓ MẶT TẠI BLOCK NÀY (ĐỂ HIỂN THỊ RÕ RÀNG VÀ TRÁNH VA CHẠM)
  const existingYardContainers = useMemo(() => {
    if (!isOpen) return []
    const allStoreReservations = yardReservationStore.getReservations()

    // 1.1 Các container KHÁC đã được giữ chỗ trước tại Block này
    const otherReservations = allStoreReservations.filter((r) => {
      const rCont = (r.containerId || r.containerNo || r.booking?.containerId || '').trim().toUpperCase()
      const rBook = (r.bookingCode || r.booking?.id || '').trim().toUpperCase()
      const isSameContainer = (currentContId && rCont === currentContId) || (currentBookId && rBook === currentBookId)
      const isSameBlock = (r.blockCode === currentBlockCode || r.block === currentBlockCode)
      return isSameBlock && !isSameContainer
    })

    const syntheticReservations = otherReservations.map((r) => {
      const rSize = Number(r.size) || 40
      const bayNum = Number(r.bay)
      // Với 40ft: bay 02 -> moduleStart = 1; bay 12 -> moduleStart = 6
      const modStart = rSize === 40 
        ? (bayNum % 2 === 0 ? bayNum / 2 : Math.floor(bayNum / 2))
        : Math.ceil(bayNum / 2)

      return {
        id: `res-${r.posId || r.slotId || bayNum}`,
        block: r.blockCode || currentBlockCode,
        bay: bayNum,
        row: Number(r.row),
        tier: Number(r.tier),
        moduleStart: Math.max(1, modStart),
        moduleSpan: rSize === 40 ? 2 : 1,
        containerLengthFt: rSize,
        status: 'reserved',
        containerNumber: r.containerNo || r.containerId || 'CONT ĐÃ GIỮ',
        isOtherReserved: true,
      }
    })

    // 1.2 Các container đang lưu bãi (occupied) từ API Backend của Block này
    const backendOccupied = (block?.slots || []).filter((s) => {
      const isBusy = s.status && s.status !== 'empty' && (s.status === 'occupied' || s.status === 'reserved' || s.containerNumber)
      if (!isBusy) return false
      // Không tính container của chính booking hiện tại
      const sCont = (s.containerNumber || s.containerId || '').trim().toUpperCase()
      if (currentContId && sCont === currentContId) return false
      return true
    }).map((s) => {
      const sSize = Number(s.containerLengthFt) || Number(s.size) || 20
      const bayNum = Number(s.bay)
      const modStart = sSize === 40 
        ? (bayNum % 2 === 0 ? bayNum / 2 : Math.floor(bayNum / 2))
        : Math.ceil(bayNum / 2)

      return {
        ...s,
        bay: bayNum,
        row: Number(s.row),
        tier: Number(s.tier),
        moduleStart: s.moduleStart || Math.max(1, modStart),
        moduleSpan: sSize === 40 ? 2 : 1,
        containerLengthFt: sSize,
        status: s.status || 'occupied',
        containerNumber: s.containerNumber || s.containerId || 'CONT LƯU BÃI',
        isBackendOccupied: true,
      }
    })

    // Gộp và ưu tiên reservation mới nhất
    return [...syntheticReservations, ...backendOccupied]
  }, [isOpen, currentBlockCode, currentContId, currentBookId, block?.slots])

  // Khi mở Modal: tự động lấy vị trí hiện tại đã lưu của container này để hiển thị chuẩn xác
  useEffect(() => {
    if (isOpen) {
      setWarningMessage('')
      const allRes = yardReservationStore.getReservations()
      
      const storeRes = allRes.find((r) => {
        const rCont = (r.containerId || r.containerNo || r.booking?.containerId || '').trim().toUpperCase()
        const rBook = (r.bookingCode || r.booking?.id || '').trim().toUpperCase()
        return (currentContId && rCont === currentContId) || (currentBookId && rBook === currentBookId)
      })
      const existingRes =
        storeRes ||
        currentReservation ||
        booking?.autoYardSlot ||
        booking?.reservedSlot ||
        booking?.slotInfo

      setExistingReservation(existingRes || null)

      const initialSize = existingRes?.size ? Number(existingRes.size) : (isDefault40 ? 40 : 20)
      setSize(initialSize)

      const isReservedInThisBlock = Boolean(
        existingRes &&
        existingRes.bay &&
        existingRes.row &&
        (existingRes.blockCode === currentBlockCode || existingRes.block === currentBlockCode)
      )

      if (isReservedInThisBlock) {
        // Container ĐÃ nằm tại chính Block này -> Highlight đúng vị trí đang nằm
        const bayNum = Number(existingRes.bay)
        let modIdx = initialSize === 40 
          ? (bayNum % 2 === 0 ? (bayNum / 2) - 1 : Math.floor(bayNum / 2))
          : Math.floor((bayNum - 1) / 2)
        
        modIdx = Math.max(0, Math.min(modIdx, bayModules - (initialSize === 40 ? 2 : 1)))
        const resTier = Number(existingRes.tier) || 1
        setCurrentTier(resTier)

        setSelection({
          module: modIdx,
          row: Number(existingRes.row) || maxRows,
          tier: resTier,
        })
      } else {
        // Container đang nằm ở Block khác -> Giữ selection = null để người dùng click chọn ô mới tại Block này
        setSelection(null)
        setCurrentTier(1)
      }
    }
  }, [isOpen, isDefault40, bayModules, booking, currentReservation, maxRows, currentBlockCode, currentContId, currentBookId])

  // Tọa độ gốc nơi container đang thực sự nằm trong Block này (nếu có)
  const originCellInThisBlock = useMemo(() => {
    if (!existingReservation) return null
    const resBlock = existingReservation.blockCode || existingReservation.block
    if (resBlock !== currentBlockCode) return null
    const resSize = Number(existingReservation.size) || (isDefault40 ? 40 : 20)
    const bayNum = Number(existingReservation.bay) || 2
    let modIdx = resSize === 40
      ? (bayNum % 2 === 0 ? (bayNum / 2) - 1 : Math.floor(bayNum / 2))
      : Math.floor((bayNum - 1) / 2)
    modIdx = Math.max(0, Math.min(modIdx, bayModules - (resSize === 40 ? 2 : 1)))
    return {
      module: modIdx,
      row: Number(existingReservation.row) || 1,
      tier: Number(existingReservation.tier) || 1,
      size: resSize,
      bay: bayNum,
    }
  }, [existingReservation, currentBlockCode, isDefault40, bayModules])

  // Handle switching container size (20ft vs 40ft)
  const handleChooseSize = (newSize) => {
    setSize(newSize)
    setWarningMessage('')
    if (selection) {
      setSelection((curr) => ({
        ...curr,
        module: Math.min(curr.module, Math.max(0, bayModules - (newSize === 40 ? 2 : 1))),
      }))
    }
  }

  // Helper tìm container đang nằm tại toạ độ moduleIndex, row, tier
  const findExistingContainerAt = (modIdx, rowNum, tierNum) => {
    return existingYardContainers.find((item) => {
      if (Number(item.row) !== rowNum || Number(item.tier) !== tierNum) return false
      if (item.moduleSpan === 2) {
        const mStart = item.moduleStart - 1
        return modIdx === mStart || modIdx === mStart + 1
      }
      const bayOdd = modIdx * 2 + 1
      return Number(item.bay) === bayOdd || Number(item.bay) === bayOdd + 1
    })
  }

  // Calculate coordinates & codes cho vị trí đang chọn
  const primaryBay = selection ? (size === 40 ? selection.module * 2 + 2 : selection.module * 2 + 1) : null
  const coveredBays = selection
    ? (size === 40 
        ? [selection.module * 2 + 1, selection.module * 2 + 3]
        : [selection.module * 2 + 1])
    : []

  const posCode = selection ? `${currentBlockCode}.${padPosition(primaryBay)}.${padPosition(selection.row)}.${currentTier}` : ''
  const posId = selection ? `${currentBlockCode}-${padPosition(primaryBay)}-T${currentTier}-R${selection.row}` : ''

  // Kiểm tra xem vị trí đang chọn có bị va chạm với container nào không
  const conflictContainer = useMemo(() => {
    if (!selection) return null
    for (const mod of (size === 40 ? [selection.module, selection.module + 1] : [selection.module])) {
      const busy = findExistingContainerAt(mod, selection.row, currentTier)
      if (busy) return busy
    }
    return null
  }, [selection, size, currentTier, existingYardContainers])

  if (!isOpen || !block) return null

  // Xử lý khi click vào ô trên mặt bằng
  const handleCellClick = (moduleIndex, row) => {
    setWarningMessage('')

    // 1. Kiểm tra xem ô được click có chứa container đang lưu/giữ chỗ khác không
    const clickedBusy = findExistingContainerAt(moduleIndex, row, currentTier)
    if (clickedBusy) {
      setWarningMessage(`⚠️ Ô này đã có container ${clickedBusy.containerNumber} (${clickedBusy.status === 'reserved' ? 'Đã giữ chỗ' : 'Đang lưu bãi'}). Không thể xếp đè!`)
      return
    }

    // 2. Nếu là container 40ft (chiếm 2 ô)
    if (size === 40) {
      // Nếu click vào ô cuối cùng của bãi thì dịch lùi lại 1 ô
      const adjustedModule = moduleIndex >= bayModules - 1 ? bayModules - 2 : moduleIndex
      
      // Kiểm tra cả 2 ô liền kề
      const busy1 = findExistingContainerAt(adjustedModule, row, currentTier)
      const busy2 = findExistingContainerAt(adjustedModule + 1, row, currentTier)

      if (busy1 || busy2) {
        const busyCont = busy1 || busy2
        setWarningMessage(`⚠️ Vị trí 40ft (Bay ${padPosition(adjustedModule * 2 + 1)} + Bay ${padPosition(adjustedModule * 2 + 3)}) bị vướng container ${busyCont.containerNumber}. Vui lòng chọn vị trí trống khác!`)
        return
      }

      setSelection({
        module: adjustedModule,
        row,
        tier: currentTier,
      })
    } else {
      // Container 20ft
      setSelection({
        module: moduleIndex,
        row,
        tier: currentTier,
      })
    }
  }

  const handleConfirmReservation = () => {
    if (!selection || conflictContainer) return

    onConfirm?.({
      posId,
      posCode,
      slotId: posId,
      blockCode: currentBlockCode,
      bay: padPosition(primaryBay),
      bayDisplay: size === 40 ? `Bay ${padPosition(primaryBay)} (${coveredBays.map(padPosition).join(' + ')})` : `Bay ${padPosition(primaryBay)}`,
      coveredBays: coveredBays.map(padPosition),
      tier: String(currentTier).padStart(2, '0'),
      row: padPosition(selection.row),
      size,
      containerNo: booking?.containerId,
      containerId: booking?.containerId,
    })
    onClose?.()
  }

  const isReservedInOtherBlock = existingReservation && 
    (existingReservation.blockCode !== currentBlockCode && existingReservation.block !== currentBlockCode)

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-3 bg-carbon/80 backdrop-blur-sm animate-in zoom-in-95 duration-150 font-sans"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white w-[97vw] max-w-[1460px] rounded-3xl p-4 sm:p-5 space-y-2.5 shadow-2xl flex flex-col border border-chalk">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-chalk pb-2.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-orange-600 shrink-0">
              <span className="material-symbols-outlined text-2xl">grid_view</span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-orange-600 uppercase font-mono tracking-wider block">
                SƠ ĐỒ BÃI TIÊN SA · CHỌN VỊ TRÍ BAY &amp; SLOT
              </span>
              <h3 className="font-heading text-base sm:text-lg font-black text-slate-900 leading-tight">
                BLOCK {currentBlockCode} · Dải container dựng theo sơ đồ thiết bị; mã chữ cái là quy ước quản lý đề xuất của NexusPort.
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Thông báo va chạm hoặc vị trí Block khác */}
        {warningMessage && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs shadow-xs animate-in fade-in duration-200">
            <span className="material-symbols-outlined text-red-600 text-lg flex-shrink-0">warning</span>
            <span className="font-bold flex-1">{warningMessage}</span>
            <button
              type="button"
              onClick={() => setWarningMessage('')}
              className="text-red-700 hover:text-red-900 font-bold text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Banner hiển thị rõ Container đang nằm ở vị trí nào trên bãi (Chuẩn vibe ảnh người dùng) */}
        {existingReservation && !warningMessage && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 rounded-2xl border border-amber-300 bg-amber-50/80 text-xs shadow-2xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 shadow-2xs">
                <span className="material-symbols-outlined text-lg">track_changes</span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black uppercase tracking-wide text-[11px] text-orange-950">
                    * VỊ TRÍ ĐANG NẰM HIỆN TẠI CỦA CONTAINER {booking?.containerId}:
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-orange-500 text-white font-mono font-black text-[10px] shadow-2xs">
                    Đang chiếm 1 vị trí ({existingReservation.size || size}ft)
                  </span>
                  <span className="font-extrabold font-mono text-xs text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-amber-300 shadow-2xs">
                    BLOCK {existingReservation.blockCode || existingReservation.block} · Bay {padPosition(existingReservation.bay)} · Hàng (Row) {padPosition(existingReservation.row)} · Tầng T{Number(existingReservation.tier) || 1}
                  </span>
                </div>
                <div className="mt-1 text-amber-900 font-medium text-[11px]">
                  👉 Nhắp vào ô trống bất kỳ bên dưới để chuyển container sang <strong>Block {currentBlockCode}</strong> (vị trí cũ sẽ tự động trả lại).
                </div>
              </div>
            </div>

            {originCellInThisBlock && (
              <button
                type="button"
                onClick={() => {
                  setCurrentTier(originCellInThisBlock.tier)
                  setSize(originCellInThisBlock.size)
                  setSelection({
                    module: originCellInThisBlock.module,
                    row: originCellInThisBlock.row,
                    tier: originCellInThisBlock.tier,
                  })
                }}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs flex items-center gap-1 transition cursor-pointer shrink-0 self-end sm:self-auto"
              >
                <span className="material-symbols-outlined text-sm">center_focus_strong</span>
                Trỏ về vị trí đang nằm (Bay {padPosition(originCellInThisBlock.bay)} · R{padPosition(originCellInThisBlock.row)} · T{originCellInThisBlock.tier})
              </button>
            )}
          </div>
        )}

        {/* Toolbar: Kích cỡ 20ft vs 40ft & Chọn Tầng Tier (Chuẩn vibe ảnh người dùng) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200">
          {/* Booking Container info */}
          <div className="flex items-center gap-2.5">
            <div className="text-xs">
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Booking Container:</span>
              <span className="font-mono font-black text-slate-900 text-sm">
                {booking?.containerId || 'EMCU9284712'}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-[11px] font-black text-orange-700 font-mono">
              {booking?.containerType || `${size}RF`}
            </span>
          </div>

          {/* 20ft vs 40ft Toggle Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Kích cỡ quy hoạch:</span>
            <div className="inline-flex rounded-full bg-slate-100 p-1 border border-slate-200 text-xs font-bold shadow-2xs">
              <button
                type="button"
                onClick={() => handleChooseSize(20)}
                className={`px-3.5 py-1 rounded-full transition flex items-center gap-1.5 cursor-pointer ${
                  size === 20
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 bg-white'
                }`}
              >
                <span>20 Feet (20ft)</span>
                <span className="text-[10px] opacity-80">(1 ô đơn)</span>
              </button>
              <button
                type="button"
                onClick={() => handleChooseSize(40)}
                className={`px-4 py-1 rounded-full transition flex items-center gap-1.5 cursor-pointer ${
                  size === 40
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 bg-white'
                }`}
              >
                <span>40 Feet (40ft)</span>
                <span className="text-[10px] opacity-80">(Tự động chọn 2 ô)</span>
              </button>
            </div>
          </div>

          {/* Chọn Tầng (Tier) Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Chọn Tầng (Tier):</span>
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold shadow-2xs gap-1">
              {[...Array(maxTiers)].map((_, i) => i + 1).map((tierNum) => (
                <button
                  key={`tier-${tierNum}`}
                  type="button"
                  onClick={() => {
                    setCurrentTier(tierNum)
                    setWarningMessage('')
                    if (selection) {
                      setSelection((curr) => ({ ...curr, tier: tierNum }))
                    }
                  }}
                  className={`px-3 py-1 rounded-lg transition text-xs font-mono font-black cursor-pointer ${
                    currentTier === tierNum
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80'
                  }`}
                  title={`Tầng ${tierNum} ${tierNum === 1 ? '(Nền bãi)' : ''}`}
                >
                  T{tierNum}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Thông số Block & Chú thích trực quan */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 border-b border-slate-100 pb-2 px-1">
          <div className="flex flex-wrap items-center gap-3">
            <span><strong className="text-slate-900 font-mono font-bold">{bayModules}</strong> mô-đun dọc Bay</span>
            <span><strong className="text-slate-900 font-mono font-bold">{maxRows}</strong> row</span>
            <span><strong className="text-slate-900 font-mono font-bold">{maxTiers}</strong> tier tối đa</span>
            <span className="px-2.5 py-0.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 font-bold text-[11px]">
              Đang chiếm tại Block {currentBlockCode}:{' '}
              <strong className="font-mono font-black">
                {existingYardContainers.length + (originCellInThisBlock || selection ? 1 : 0)} vị trí
              </strong>{' '}
              ({existingYardContainers.length + (originCellInThisBlock || selection ? 1 : 0)} Cont)
            </span>
          </div>

          {/* Legend chuẩn y chang ảnh */}
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded bg-emerald-500"></span>
              <span className="font-medium text-slate-700">Vị trí Cont đang nằm</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded bg-orange-500"></span>
              <span className="font-medium text-slate-700">Vị trí mới chọn</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded bg-amber-400"></span>
              <span className="font-medium text-slate-700">Cont khác đã đặt (Bận)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded bg-sky-400"></span>
              <span className="font-medium text-slate-700">Đang lưu bãi (Bận)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded bg-[#f8fafc] border border-slate-300"></span>
              <span className="text-slate-500">Ô trống (Có thể chọn)</span>
            </div>
          </div>
        </div>

        {/* SƠ ĐỒ MẶT BẰNG BAY × ROW TRỰC QUAN */}
        <div className="flex flex-col space-y-1.5">
          <div className="flex justify-between items-center text-xs font-bold text-slate-900">
            <span className="flex items-center gap-2 text-orange-600 font-extrabold">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
              * Mặt bằng Bay × Row (Mặt cắt Tầng T{currentTier})
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Đầu dãy ➔ Cuối dãy · Ô nền 20ft (Click vào ô trống để xếp chỗ)
            </span>
          </div>

          {/* Grid Viewport */}
          <div className="w-full border border-slate-200 rounded-2xl bg-white p-3 shadow-2xs">
            <div
              className="grid gap-1 w-full select-none"
              style={{
                gridTemplateColumns: `58px repeat(${bayModules}, minmax(0, 1fr))`,
              }}
            >
              {/* Header row: Bay numbers */}
              <div className="text-[10px] font-mono font-bold text-slate-500 flex items-center justify-center border-b border-slate-100 pb-1">
                ROW/BAY
              </div>
              {Array.from({ length: bayModules }, (_, i) => {
                const bayNum = i * 2 + 1
                const isBayCovered = coveredBays.includes(bayNum)
                return (
                  <div
                    key={`bay-head-${i}`}
                    className={`text-[10px] font-mono text-center pb-1 border-b transition ${
                      isBayCovered
                        ? 'font-black text-orange-600 border-orange-500 scale-105'
                        : 'font-semibold text-slate-400 border-slate-100'
                    }`}
                  >
                    {padPosition(bayNum)}
                  </div>
                )
              })}

              {/* Data rows */}
              {Array.from({ length: maxRows }, (_, i) => maxRows - i).map((row) => {
                let skipUntil = -1

                return (
                  <div key={`row-group-${row}`} className="contents">
                    {/* Row label on the left */}
                    <div className="text-[11px] font-mono font-bold text-slate-600 flex items-center justify-start pr-1 h-9">
                      Row {padPosition(row)}
                    </div>

                    {/* Modules in this row */}
                    {Array.from({ length: bayModules }, (_, moduleIdx) => {
                      if (moduleIdx <= skipUntil) {
                        return null
                      }

                      // 1. Kiểm tra nếu là VỊ TRÍ ĐANG ĐƯỢC CHỌN
                      const isSelected = Boolean(selection && row === selection.row && moduleIdx === selection.module)
                      const isOriginCell = Boolean(
                        originCellInThisBlock &&
                        originCellInThisBlock.tier === currentTier &&
                        row === originCellInThisBlock.row &&
                        moduleIdx === originCellInThisBlock.module
                      )

                      if (isSelected) {
                        const span = size === 40 ? 2 : 1
                        if (span > 1) {
                          skipUntil = moduleIdx + span - 1
                        }

                        return (
                          <button
                            key={`cell-${moduleIdx}-${row}`}
                            type="button"
                            style={span > 1 ? { gridColumn: `span ${span}` } : {}}
                            onClick={() => handleCellClick(moduleIdx, row)}
                            className={`h-9 border-2 rounded-xl z-20 shadow-xs px-1 flex flex-col items-center justify-center cursor-pointer transition ${
                              isOriginCell
                                ? 'border-emerald-600 bg-emerald-600 text-white ring-2 ring-emerald-500/30'
                                : 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-500/25'
                            }`}
                            title={`Container ${booking?.containerId || '40FT'}: Bay ${padPosition(primaryBay)} · Row ${padPosition(row)} · Tầng T${currentTier}`}
                          >
                            <span className="text-[10px] font-black tracking-tight truncate w-full text-center font-mono leading-none">
                              📦 {booking?.containerId || 'CONT-CHỌN'}
                            </span>
                            <span className={`text-[7.5px] font-black uppercase tracking-tighter leading-none mt-0.5 ${
                              isOriginCell ? 'text-emerald-100' : 'text-orange-600'
                            }`}>
                              {isOriginCell ? '📍 ĐANG NẰM' : '➔ VỊ TRÍ MỚI'}
                            </span>
                          </button>
                        )
                      }

                      // 1.5 Vị trí cũ
                      if (isOriginCell) {
                        const span = originCellInThisBlock.size === 40 ? 2 : 1
                        if (span > 1) {
                          skipUntil = moduleIdx + span - 1
                        }

                        return (
                          <button
                            key={`cell-origin-${moduleIdx}-${row}`}
                            type="button"
                            style={span > 1 ? { gridColumn: `span ${span}` } : {}}
                            onClick={() => handleCellClick(moduleIdx, row)}
                            className="h-9 border-2 border-dashed border-emerald-500 bg-emerald-50 text-emerald-900 rounded-xl z-15 px-1 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-100 transition"
                            title={`Vị trí hiện tại của ${booking?.containerId}`}
                          >
                            <span className="text-[10px] font-black tracking-tight truncate w-full text-center font-mono leading-none">
                              📍 {booking?.containerId}
                            </span>
                          </button>
                        )
                      }

                      // 2. Container khác
                      const existingCont = findExistingContainerAt(moduleIdx, row, currentTier)
                      if (existingCont) {
                        const is40Cont = existingCont.moduleSpan === 2 || Number(existingCont.containerLengthFt) === 40
                        const span = is40Cont ? 2 : 1
                        if (span > 1) {
                          skipUntil = moduleIdx + span - 1
                        }

                        const isRes = existingCont.status === 'reserved'

                        return (
                          <button
                            key={`cell-${moduleIdx}-${row}`}
                            type="button"
                            style={span > 1 ? { gridColumn: `span ${span}` } : {}}
                            onClick={() => {
                              setWarningMessage(`⚠️ Vị trí đã có container ${existingCont.containerNumber} (${isRes ? 'Đã giữ chỗ trước' : 'Đang lưu bãi'}). Không thể xếp đè!`)
                            }}
                            className={`h-9 border-2 rounded-xl z-10 px-1 flex items-center justify-center cursor-not-allowed opacity-90 transition ${
                              isRes
                                ? 'bg-amber-100 border-amber-400 text-amber-900'
                                : 'bg-sky-100 border-sky-400 text-sky-900'
                            }`}
                            title={`ĐÃ BẬN: Cont ${existingCont.containerNumber} (${isRes ? 'Đã giữ chỗ' : 'Đang lưu bãi'})`}
                          >
                            <span className="font-mono font-black text-xs">CONT</span>
                          </button>
                        )
                      }

                      // 3. Ô TRỐNG (Cực kỳ sạch sẽ theo đúng ảnh user)
                      return (
                        <button
                          key={`cell-${moduleIdx}-${row}`}
                          type="button"
                          onClick={() => handleCellClick(moduleIdx, row)}
                          className="h-9 border border-slate-200/90 bg-[#f8fafc] hover:bg-orange-50 hover:border-orange-400 rounded-xs flex items-center justify-center cursor-pointer transition shadow-2xs"
                          title={`Chọn vị trí trống: Bay ${padPosition(moduleIdx * 2 + 1)} Row ${padPosition(row)} Tầng T${currentTier}`}
                        >
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Convention text */}
          <p className="text-[11px] text-slate/80 leading-relaxed">
            💡 <strong>Quy ước bãi Tiên Sa:</strong> Bay lẻ ({coveredBays.length > 0 ? coveredBays.map(padPosition).join(', ') : '01, 03...'}) cho 20ft;{' '}
            {size === 40 ? (
              <span className="text-signal-orange font-bold">
                Cont 40ft tự động chiếm 2 ô liền kề {selection ? `(Bay ${padPosition(coveredBays[0])} + Bay ${padPosition(coveredBays[1])}) với Bay danh định là Bay ${padPosition(primaryBay)}` : 'với Bay chẵn tương ứng'}.
              </span>
            ) : (
              <span>Cont 20ft chiếm 1 ô nền tại Bay lẻ.</span>
            )}{' '}
            Row đánh số 01–06 theo chiều ngang; Tier 1 bắt đầu tại nền bãi.
          </p>
        </div>

        {/* Footer: Position Summary & Action buttons */}
        <div className="pt-3 border-t border-chalk flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              !selection 
                ? 'bg-slate-100 text-slate-500' 
                : conflictContainer 
                ? 'bg-red-100 text-red-600' 
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              <span className="material-symbols-outlined text-xl">
                {!selection ? 'touch_app' : conflictContainer ? 'error' : 'task_alt'}
              </span>
            </div>
            <div>
              {selection ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate block">
                      VỊ TRÍ ĐANG CHỌN CHO CONT {size}FT:
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-fog font-mono font-bold text-xs text-signal-orange border border-chalk">
                      {posCode}
                    </span>
                  </div>
                  <div className="text-sm font-extrabold text-carbon flex items-center gap-2">
                    <span className="text-signal-orange">BLOCK {currentBlockCode}</span> •{' '}
                    <span>
                      {size === 40 ? (
                        <>
                          BAY {padPosition(primaryBay)}{' '}
                          <span className="text-xs font-semibold text-slate font-mono">
                            ({padPosition(coveredBays[0])} + {padPosition(coveredBays[1])})
                          </span>
                        </>
                      ) : (
                        `BAY ${padPosition(primaryBay)}`
                      )}
                    </span> •{' '}
                    <span>TẦNG {currentTier}</span> •{' '}
                    <span>HÀNG {padPosition(selection.row)}</span>
                  </div>
                  {conflictContainer && (
                    <span className="text-[11px] font-bold text-red-600 block mt-0.5">
                      ⚠️ Ô đã có container {conflictContainer.containerNumber} ({conflictContainer.status === 'reserved' ? 'Đã giữ chỗ' : 'Lưu bãi'}). Vui lòng chọn ô khác!
                    </span>
                  )}
                </>
              ) : (
                <div>
                  <span className="text-xs font-bold text-slate block">
                    CHƯA CHỌN VỊ TRÍ TẠI BLOCK {currentBlockCode}
                  </span>
                  <span className="text-xs text-slate/70">
                    Nhấp vào 1 ô trống trên sơ đồ mặt bằng để chọn vị trí xếp container {booking?.containerId || ''}.
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={!selection || Boolean(conflictContainer)}
              onClick={handleConfirmReservation}
              className={`px-6 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 ${
                !selection || conflictContainer
                  ? 'bg-slate-200/90 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-orange-500 hover:bg-orange-600 text-white shadow-md cursor-pointer'
              }`}
            >
              <span className="material-symbols-outlined text-sm">how_to_reg</span>
              {!selection ? 'Vui lòng chọn 1 ô trên sơ đồ' : conflictContainer ? 'Vị trí bị trùng - Không thể chọn' : 'Xác Nhận Giữ Chỗ Vị Trí Này'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
