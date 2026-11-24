import React, { useState, useEffect } from 'react'
import sourceLayout from '../../../features/yard-design/tienSaLayout.json'
import TienSaMap from '../../../features/yard-design/TienSaMap'
import BlockDetail from '../../../features/yard-design/BlockDetail'
import ContainerYardDetailModal from '../../../components/Yard/ContainerYardDetailModal'
import YardZoneBlockSelectorModal from '../../../components/Yard/YardZoneBlockSelectorModal'
import YardSlotReservationModal from '../../../components/Yard/YardSlotReservationModal'
import { yardReservationStore } from '../../../services/yardReservationStore'
import { isManifestPermanentlyApproved, manifestPortSyncService } from '../../../services/manifestPortSyncService'
import {
  planContainersForBlock,
  resolveTargetBlock,
  isContainer20,
  isContainerReefer,
  isContainerDG,
  getContainerKey,
  createSlotRecord
} from '../../../services/yardPlanningRules'
import '../../../features/yard-design/YardDesignPreview.css'

export default function VesselYardAllocationModal({
  isOpen,
  vessel,
  onClose,
  containerList = [],
  allBookings = [],
  yardInventory,
  blocksData = [],
  onAcceptAndNext,
}) {
  const [popupYardBlockFilter, setPopupYardBlockFilter] = useState('ALL')
  const [viewingYardMapContainer, setViewingYardMapContainer] = useState(null)
  const [selectedMapBlockCode, setSelectedMapBlockCode] = useState(null)
  const [yardViewMode, setYardViewMode] = useState('map') // 'map' (toàn cảnh bãi trước) | 'detail' (mặt bằng Bay × Row)
  const [yardContainerDetailModal, setYardContainerDetailModal] = useState({ isOpen: false, data: null })
  const [changeYardTargetContainer, setChangeYardTargetContainer] = useState(null)
  const [selectedBlockForSlot, setSelectedBlockForSlot] = useState(null)
  const [isZoneSelectorOpen, setIsZoneSelectorOpen] = useState(false)
  const [manualSlotOverrides, setManualSlotOverrides] = useState({})
  const [toastMessage, setToastMessage] = useState('')
  const [localContainers, setLocalContainers] = useState(containerList)

  useEffect(() => {
    setLocalContainers(containerList)
  }, [containerList])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4500)
  }

  if (!isOpen || !vessel) return null

  const popupReeferList = localContainers.filter(c => c.isRf || Boolean(c.isReefer) || (c.containerType || '').includes('RF') || (c.tempRequired || '').includes('-'))
  const popupDryList = localContainers.filter(c => !(c.isRf || Boolean(c.isReefer) || (c.containerType || '').includes('RF') || (c.tempRequired || '').includes('-')))
  const isApproved = isManifestPermanentlyApproved(vessel) || vessel.portApprovalStatus === 'PORT_APPROVED' || vessel.status === 'PORT_APPROVED'
  const isImport = String(vessel.direction || '').toUpperCase() === 'IMPORT' || vessel.direction === 'Nhập khẩu'

  // Mở luồng đổi bãi 2 bước chuẩn Tiên Sa: Bước 1 (Sơ đồ phân khu / Bản đồ Tiên Sa) ➔ Bước 2 (Mặt bằng Bay & Slot)
  const handleOpenChangeYard = (item, slot, block, bayNum, rowNum, tierNum) => {
    const cKey = getContainerKey(item)
    const cSize = isContainer20(item) ? 20 : 40
    const containerData = {
      ...item,
      id: cKey,
      containerId: cKey,
      containerNumber: cKey,
      containerNo: cKey,
      autoYardSlot: slot,
      blockCode: block,
      block,
      bay: bayNum,
      row: rowNum,
      tier: tierNum,
      size: cSize,
      isoType: item.containerType || item.isoType || (cSize === 20 ? '20GP' : '40HC'),
      direction: isImport ? 'IMPORT' : 'EXPORT',
    }
    setChangeYardTargetContainer(containerData)
    setSelectedBlockForSlot(null)
    setIsZoneSelectorOpen(true)
  }

  // Map container theo từng Block bãi Tiên Sa để thể hiện trực quan trên Sơ Đồ Bãi 2D (qua module yardPlanningRules)
  const blockContainerMap = {}
  localContainers.forEach(c => {
    const key = getContainerKey(c)
    const override = manualSlotOverrides[key] || manualSlotOverrides[c.containerNumber] || manualSlotOverrides[c.id]
    const bCode = override?.blockCode || c.autoYardSlot?.blockCode || resolveTargetBlock(c, isImport ? 'IMPORT' : 'EXPORT')
    if (!blockContainerMap[bCode]) blockContainerMap[bCode] = []
    blockContainerMap[bCode].push(c)
  })

  // Lọc danh sách container theo Block được click trên Sơ đồ (hoặc hiện tất cả khi chọn ALL)
  const displayedReeferList = popupYardBlockFilter === 'ALL'
    ? popupReeferList
    : popupReeferList.filter(c => {
        const key = getContainerKey(c)
        const override = manualSlotOverrides[key] || manualSlotOverrides[c.containerNumber] || manualSlotOverrides[c.id]
        const b = override?.blockCode || c.autoYardSlot?.blockCode || resolveTargetBlock(c, isImport ? 'IMPORT' : 'EXPORT')
        return b === popupYardBlockFilter
      })

  const displayedDryList = popupYardBlockFilter === 'ALL'
    ? popupDryList
    : popupDryList.filter(c => {
        const key = getContainerKey(c)
        const override = manualSlotOverrides[key] || manualSlotOverrides[c.containerNumber] || manualSlotOverrides[c.id]
        const b = override?.blockCode || c.autoYardSlot?.blockCode || resolveTargetBlock(c, isImport ? 'IMPORT' : 'EXPORT')
        return b === popupYardBlockFilter
      })

  // Chuẩn bị dữ liệu cho Modal Đổi Bãi (YardSlotReservationModal)
  const changeYardKey = changeYardTargetContainer ? getContainerKey(changeYardTargetContainer) : ''
  const changeYardOverride = changeYardKey ? (manualSlotOverrides[changeYardKey] || manualSlotOverrides[changeYardTargetContainer.containerNumber] || manualSlotOverrides[changeYardTargetContainer.id]) : null
  const changeYardSlot = changeYardOverride || changeYardTargetContainer?.autoYardSlot || {}
  const changeYardBlockCode = (selectedBlockForSlot?.blockCode || selectedBlockForSlot?.code) || changeYardSlot.blockCode || changeYardSlot.block || changeYardTargetContainer?.blockCode || changeYardTargetContainer?.block || resolveTargetBlock(changeYardTargetContainer, isImport ? 'IMPORT' : 'EXPORT') || (isImport ? 'C10' : 'B01')

  const targetBlockObj = selectedBlockForSlot || blocksData.find(b => (b.blockCode || b.code) === changeYardBlockCode) || {
    code: changeYardBlockCode,
    blockCode: changeYardBlockCode,
    planning: { bayModules: 28, rows: 6, tiers: 4 }
  }

  const isTarget20 = isContainer20(changeYardTargetContainer)
  const changeYardBay = Number(changeYardSlot.bay || changeYardTargetContainer?.bay || (isTarget20 ? 1 : 2))
  const changeYardRow = Number(changeYardSlot.row || changeYardTargetContainer?.row || 1)
  const changeYardTier = Number(changeYardSlot.tier || changeYardTargetContainer?.tier || 1)

  const changeYardBooking = changeYardTargetContainer ? {
    ...changeYardTargetContainer,
    id: changeYardKey,
    containerId: changeYardKey,
    containerNumber: changeYardKey,
    containerNo: changeYardKey,
    containerType: changeYardTargetContainer.containerType || changeYardTargetContainer.isoType || (isTarget20 ? '20GP' : '40HC'),
    vesselName: vessel?.vesselName,
    voyageNumber: vessel?.voyageNumber,
    manifestId: vessel?.manifestId || vessel?.id,
  } : null

  const changeYardCurrentReservation = changeYardTargetContainer ? {
    blockCode: changeYardBlockCode,
    bay: changeYardBay,
    row: changeYardRow,
    tier: changeYardTier,
    size: isTarget20 ? 20 : 40,
    containerNo: changeYardKey,
    containerId: changeYardKey,
  } : null

  const handleConfirmChangeYardSlot = (newRes) => {
    if (!changeYardTargetContainer) return
    const key = getContainerKey(changeYardTargetContainer)
    const is20 = Number(newRes.size) === 20 || (Number(newRes.bay) % 2 !== 0)
    const sizeNum = is20 ? 20 : 40
    const bayNum = Number(newRes.bay)
    const rowNum = Number(newRes.row)
    const tierNum = Number(newRes.tier)
    const bCode = newRes.blockCode || changeYardBlockCode

    const updatedSlotRecord = {
      blockCode: bCode,
      block: bCode,
      bay: bayNum,
      row: rowNum,
      tier: tierNum,
      size: sizeNum,
      containerLengthFt: sizeNum,
      coordinate: `${bCode}-${String(bayNum).padStart(2, '0')}-${String(rowNum).padStart(2, '0')}-${tierNum}`,
      formattedSlot: `Block ${bCode} · Bay ${String(bayNum).padStart(2, '0')} (${rowNum}-${tierNum})`,
      posId: newRes.posId || `${bCode}-${String(bayNum).padStart(2, '0')}-R${rowNum}-T${tierNum}`,
      posCode: newRes.posCode || `${bCode}.${String(bayNum).padStart(2, '0')}.${String(rowNum).padStart(2, '0')}.${tierNum}`,
      moduleSpan: is20 ? 1 : 2,
      moduleStart: is20 ? Math.floor((bayNum - 1) / 2) : (bayNum % 2 === 0 ? Math.floor(bayNum / 2) - 1 : Math.floor((bayNum - 1) / 2)),
    }

    // 1. Cập nhật ngay manualSlotOverrides với tất cả alias của container
    setManualSlotOverrides(prev => ({
      ...prev,
      [key]: updatedSlotRecord,
      ...(changeYardTargetContainer.containerNumber ? { [changeYardTargetContainer.containerNumber]: updatedSlotRecord } : {}),
      ...(changeYardTargetContainer.containerId ? { [changeYardTargetContainer.containerId]: updatedSlotRecord } : {}),
      ...(changeYardTargetContainer.id ? { [changeYardTargetContainer.id]: updatedSlotRecord } : {})
    }))

    // 2. Cập nhật trực tiếp localContainers để view "VỊ TRÍ BÃI TIÊN SA" đổi ngay lập tức
    setLocalContainers(prevList => prevList.map(item => {
      const itemKey = getContainerKey(item)
      if (itemKey === key || item.containerNumber === key || item.containerId === key || item.id === key) {
        return {
          ...item,
          autoYardSlot: updatedSlotRecord,
          blockCode: bCode,
          bay: bayNum,
          row: rowNum,
          tier: tierNum,
        }
      }
      return item
    }))

    // 3. Lưu vào yardReservationStore (dùng addReservation)
    yardReservationStore.addReservation({
      posId: updatedSlotRecord.posId,
      posCode: updatedSlotRecord.posCode,
      blockCode: bCode,
      bay: bayNum,
      row: rowNum,
      tier: tierNum,
      size: sizeNum,
      containerNo: key,
      containerId: key,
      vesselName: vessel?.vesselName,
      voyageNumber: vessel?.voyageNumber,
      status: 'reserved'
    })

    // 4. Đồng bộ đa tầng qua manifestPortSyncService
    manifestPortSyncService.syncYardSlotAcrossAll({
      containerNumber: key,
      manifestId: vessel?.manifestId || vessel?.id || null,
      newSlotCoordinate: updatedSlotRecord.coordinate,
      reason: 'Điều độ viên đổi vị trí bãi',
      status: 'reserved',
      vesselName: vessel?.vesselName || '',
      voyageNumber: vessel?.voyageNumber || '',
    }).catch(err => console.warn('Sync yard slot warning:', err))

    // 5. Cập nhật Modal chi tiết nếu đang mở
    setYardContainerDetailModal(prev => {
      if (!prev.isOpen || !prev.data) return prev
      const currentKey = getContainerKey(prev.data)
      if (currentKey !== key) return prev
      return {
        ...prev,
        data: {
          ...prev.data,
          ...updatedSlotRecord,
          slotCode: `${bCode}.${String(bayNum).padStart(2, '0')}.${String(rowNum).padStart(2, '0')}.${tierNum}`,
        }
      }
    })

    showToast(`✅ Đã đổi vị trí container ${key} sang Block ${bCode} · Bay ${String(bayNum).padStart(2, '0')} (Hàng ${rowNum} · Tầng ${tierNum}) thành công!`)

    setChangeYardTargetContainer(null)
    setSelectedBlockForSlot(null)
    setIsZoneSelectorOpen(false)
  }

  return (
    <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white w-full max-w-6xl max-h-[92vh] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl overflow-y-auto animate-in zoom-in-95 duration-150 font-sans border border-slate-200">
        {/* Header Popup */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-xl">grid_view</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 font-heading">
                  Vị Trí Đặt Chỗ Bãi · Tàu {vessel.vesselName} ({vessel.voyageNumber})
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${isImport ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                  {isImport ? 'Hàng Nhập Khẩu' : 'Hàng Xuất Khẩu'}
                </span>
                {isApproved ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 inline-flex items-center gap-1">
                    ✓ Đã Duyệt Bãi
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                    ⏳ Chờ Điều Độ Chấp Nhận (Accept)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kiểm tra vị trí bãi container đề xuất trước khi chuyển tiếp sang quy trình điều phối xe. Bấm vào bất kỳ vị trí nào để xem trên Bản Đồ Bãi Cảng Tiên Sa.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer transition shrink-0"
            title="Đóng popup"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* ── BẢNG 1: CONTAINER LẠNH (REEFER) - HIỆN RIÊNG BIỆT NẾU CÓ ── */}
        {displayedReeferList.length > 0 && (
          <div className="border border-cyan-200 rounded-2xl overflow-hidden bg-white shadow-xs">
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50/60 border-b border-cyan-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-cyan-700 font-bold text-base">❄</span>
                <h4 className="font-extrabold text-xs uppercase tracking-wide text-cyan-950 font-heading">
                  1. Danh Sách Container Lạnh (Reefer - Cắm Điện Bãi) ({displayedReeferList.length} Container)
                </h4>
              </div>
              <span className="text-xs text-cyan-800 font-semibold bg-white/80 px-2 py-0.5 rounded-md border border-cyan-300">
                ⚡ Quy hoạch Bãi Cont Lạnh: Khu D (D01 · D02) có sẵn ổ cắm Receptacle
              </span>
            </div>

            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-cyan-50/80 text-[10px] font-extrabold uppercase text-cyan-900 border-b border-cyan-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10">STT</th>
                    <th className="py-2.5 px-3">Container Lạnh</th>
                    <th className="py-2.5 px-3">Loại ISO</th>
                    <th className="py-2.5 px-3">Vị Trí Bãi Tiên Sa</th>
                    <th className="py-2.5 px-3">Vận Đơn / Niêm Chì</th>
                    <th className="py-2.5 px-3 text-center">Ổ Cắm Bãi</th>
                    <th className="py-2.5 px-3 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-100 text-[12px] font-medium">
                  {displayedReeferList.map((item, idx) => {
                    const key = getContainerKey(item)
                    const manualSlot = manualSlotOverrides[key] ||
                      manualSlotOverrides[item.containerNumber] ||
                      manualSlotOverrides[item.containerId] ||
                      manualSlotOverrides[item.id]
                    const slot = manualSlot || item.autoYardSlot || {}
                    const block = slot.blockCode || slot.block || 'D01'
                    const bayNum = slot.bay || slot.bayCode || (item.containerType?.includes('20') ? (1 + (idx * 2) % 15) : (2 + (idx * 2) % 16))
                    const bayStr = String(bayNum).padStart(2, '0')
                    const rowNum = slot.row || slot.rowCode || ((idx % 4) + 1)
                    const rowStr = String(rowNum).padStart(2, '0')
                    const grossKg = Number(item.grossWeightKg || 24000)
                    const tierNum = slot.tier || (grossKg >= 22000 ? 1 : 2)
                    const locationText = `Khu ${block} · Bay ${bayStr} (R${rowStr}-T${tierNum})`

                    return (
                      <tr key={`rf-pop-${idx}`} className="hover:bg-cyan-50/40 transition">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <span className="bg-cyan-50 text-cyan-950 border border-cyan-300 px-2 py-0.5 rounded-md">
                            {item.containerId || item.containerNumber}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-cyan-800 whitespace-nowrap">
                          {item.containerType || item.isoType || '40RF'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setViewingYardMapContainer(item)
                              setYardViewMode('map')
                              setSelectedMapBlockCode(null)
                            }}
                            className="font-mono font-bold text-cyan-950 bg-cyan-100/90 hover:bg-cyan-200 px-2.5 py-1 rounded-lg border border-cyan-300 text-[11px] inline-flex items-center gap-1.5 shadow-2xs cursor-pointer transition active:scale-95 group"
                            title="Bấm để mở Bản Đồ Bãi (Chi tiết Bay & Ô đặt chỗ)"
                          >
                            <span>📍 {locationText}</span>
                            <span className="material-symbols-outlined text-[13px] text-cyan-700 opacity-60 group-hover:opacity-100">map</span>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          <span className="font-semibold text-slate-900">{item.blNumber || 'BL-VNDAD'}</span>
                          <span className="text-slate-400 mx-1">·</span>
                          <span>{item.sealNumber || 'SL-88412'}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-bold inline-flex items-center gap-1">
                            <span>⚡</span> Có ổ cắm
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenChangeYard(item, slot, block, bayNum, rowNum, tierNum)
                            }}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                            title="Đổi vị trí xếp bãi cho container này"
                          >
                            <span className="material-symbols-outlined text-sm">swap_horiz</span>
                            <span>Đổi bãi</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── BẢNG 2: CONTAINER KHÔ & HÀNG THƯỜNG (HIỂN THỊ TẤT CẢ) ── */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-700 text-base">inventory_2</span>
              <h4 className="font-extrabold text-xs uppercase tracking-wide text-slate-900 font-heading">
                {popupReeferList.length > 0 ? '2. ' : ''}Danh Sách Container Khô &amp; Hàng Tiêu Chuẩn ({displayedDryList.length} Container)
              </h4>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {isImport ? 'Hàng nhập ưu tiên gần cổng trước (C10 lùi dần C09–C04, rồi đến B04, B03)' : 'Hàng xuất phân bổ các dãy gần cầu tàu (A01–A04, B01–B02, C01–C03)'}
            </span>
          </div>

          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 text-[10px] font-extrabold uppercase text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10">STT</th>
                  <th className="py-2.5 px-3">Container</th>
                  <th className="py-2.5 px-3">Loại</th>
                  <th className="py-2.5 px-3">Vị Trí Bãi Tiên Sa</th>
                  <th className="py-2.5 px-3">Vận Đơn (B/L)</th>
                  <th className="py-2.5 px-3 text-center">Trạng Thái Xe</th>
                  <th className="py-2.5 px-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[12px] font-medium">
                {displayedDryList.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400 italic">
                      {popupYardBlockFilter !== 'ALL'
                        ? `Không có container khô nào trong Block ${popupYardBlockFilter}`
                        : 'Toàn bộ tàu là container lạnh chuyên dụng'}
                    </td>
                  </tr>
                ) : (
                  displayedDryList.map((item, idx) => {
                    const bTarget = resolveTargetBlock(item, isImport ? 'IMPORT' : 'EXPORT')
                    const key = getContainerKey(item)
                    const manualSlot = manualSlotOverrides[key] ||
                      manualSlotOverrides[item.containerNumber] ||
                      manualSlotOverrides[item.containerId] ||
                      manualSlotOverrides[item.id]
                    const slot = manualSlot || item.autoYardSlot || {}
                    const block = slot.blockCode || slot.block || bTarget
                    const bayNum = slot.bay || (isContainer20(item) ? (1 + (idx * 2) % 15) : (2 + (idx * 2) % 16))
                    const bayStr = String(bayNum).padStart(2, '0')
                    const rowNum = slot.row || ((idx % 4) + 1)
                    const rowStr = String(rowNum).padStart(2, '0')
                    const grossKg = Number(item.grossWeightKg || 22000)
                    const tierNum = slot.tier || (grossKg >= 22000 ? 1 : 2)
                    const locationText = `Khu ${block} · Bay ${bayStr} (R${rowStr}-T${tierNum})`
                    const isDg = isContainerDG(item)

                    return (
                      <tr key={`dry-pop-${idx}`} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <span className="bg-slate-100 text-slate-900 border border-slate-300 px-2 py-0.5 rounded-md">
                            {item.containerId || item.containerNumber}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${isDg
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-slate-100 text-slate-700'
                            }`}>
                            {item.containerType || item.isoType || '40HC'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setViewingYardMapContainer(item)
                              setYardViewMode('map')
                              setSelectedMapBlockCode(null)
                            }}
                            className="font-mono font-bold text-indigo-950 bg-indigo-50/90 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 text-[11px] inline-flex items-center gap-1.5 shadow-2xs cursor-pointer transition active:scale-95 group"
                            title="Bấm để mở Bản Đồ Bãi (Chi tiết Bay & Ô đặt chỗ)"
                          >
                            <span>📍 {locationText}</span>
                            <span className="material-symbols-outlined text-[13px] text-indigo-700 opacity-60 group-hover:opacity-100">map</span>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          <span className="font-semibold text-slate-900">{item.blNumber || 'BL-VNDAD'}</span>
                          <span className="text-slate-400 mx-1">·</span>
                          <span>{item.sealNumber || 'SL-88412'}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[10px]">
                            {item.transportSubmitted ? '● Đã có xe' : '○ Chờ Transport gửi xe'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenChangeYard(item, slot, block, bayNum, rowNum, tierNum)
                            }}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                            title="Đổi vị trí xếp bãi cho container này"
                          >
                            <span className="material-symbols-outlined text-sm">swap_horiz</span>
                            <span>Đổi bãi</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer popup - Hành động Accept ➔ Chuyển bước tiếp theo */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-slate-100 text-xs">
          <span className="text-slate-500">
            Hiển thị 1 lần toàn bộ: <strong className="text-slate-900 font-mono">{containerList.length} Container</strong> gửi qua Hãng tàu.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <span className="material-symbols-outlined text-base">print</span>
              In Lịch Bãi
            </button>

            {/* NÚT ACCEPT LOGIC BÃI ➔ SANG BƯỚC TIẾP THEO (ĐIỀU PHỐI XE) */}
            <button
              type="button"
              onClick={() => onAcceptAndNext?.(vessel, manualSlotOverrides, localContainers)}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-lg active:scale-95"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>✓ Xác Nhận &amp; Duyệt Bãi (Accept) ➔ Sang Bước Tiếp Theo</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold cursor-pointer transition shadow-xs"
            >
              Đóng
            </button>
          </div>
        </div>

        {/* ── MODAL BẢN ĐỒ BÃI CẢNG TIÊN SA (TIEN SA YARD MAP MODAL) ── */}
        {viewingYardMapContainer && (() => {
          const defaultBlock = resolveTargetBlock(viewingYardMapContainer, isImport ? 'IMPORT' : 'EXPORT')
          const activeBlockCode = selectedMapBlockCode || defaultBlock

          // Tạo map các Block có container của chuyến tàu này để highlight phát sáng và đánh dấu ĐT (chuẩn Tiên Sa)
          const manifestHighlightBlocks = {}
          localContainers.forEach(c => {
            const key = getContainerKey(c)
            const override = manualSlotOverrides[key] || manualSlotOverrides[c.containerNumber] || manualSlotOverrides[c.id]
            const bCode = override?.blockCode || c.autoYardSlot?.blockCode || resolveTargetBlock(c, isImport ? 'IMPORT' : 'EXPORT')
            if (!manifestHighlightBlocks[bCode]) {
              manifestHighlightBlocks[bCode] = { count: 0, containers: [] }
            }
            manifestHighlightBlocks[bCode].count += 1
            manifestHighlightBlocks[bCode].containers.push(c)
          })

          const highlightBlockKeys = Object.keys(manifestHighlightBlocks)

          // Layout Area cho BlockDetail
          const currentArea = sourceLayout.areas.find(a => a.code === activeBlockCode) || sourceLayout.areas[0]
          const maxModules = Math.max(...sourceLayout.areas.map(a => a.planning.bayModules))

          // 1. Thu thập các container đã có sẵn trước đó trong Block này (BẢO VỆ 100% KHÔNG ĐƯỢC ĐÈ LÊN)
          const currentManifestContNumbers = new Set(
            localContainers.map(c => String(c.containerId || c.containerNumber || '').trim().toUpperCase())
          )

          // 1a. Container đã đặt chỗ trong yardReservationStore (của chuyến tàu khác hoặc đã lưu từ trước)
          const storeRes = (yardReservationStore.getReservations() || [])
            .filter(r => (r.blockCode || r.block) === activeBlockCode)
            .filter(r => {
              const cNo = String(r.containerNo || r.containerId || '').trim().toUpperCase()
              return Boolean(cNo) && cNo !== 'CONT' && !cNo.startsWith('SLOT-') && !currentManifestContNumbers.has(cNo)
            })
            .map(r => {
              const bayNum = Number(r.bay) || 1
              const is20 = isContainer20(r) || (bayNum % 2 !== 0)
              const is40 = !is20
              const size = is40 ? 40 : 20
              return {
                id: `res-${r.posId || `${r.blockCode}-${bayNum}-${r.row}-${r.tier}`}`,
                block: r.blockCode || activeBlockCode,
                blockCode: r.blockCode || activeBlockCode,
                bay: bayNum,
                row: Number(r.row) || 1,
                tier: Number(r.tier) || 1,
                status: 'reserved',
                containerNumber: r.containerNo || r.containerId,
                reservedContainerNumber: r.containerNo || r.containerId,
                containerLengthFt: size,
                size,
                moduleSpan: is40 ? 2 : 1,
                moduleStart: is40 ? (bayNum % 2 === 0 ? Math.floor(bayNum / 2) - 1 : Math.floor((bayNum - 1) / 2)) : Math.floor((bayNum - 1) / 2),
                bookingDetails: r.booking || {},
                driverName: r.driverName || r.booking?.driverName,
                company: r.company || r.booking?.company,
              }
            })

          // 1b. Container từ các booking đã duyệt của các tàu khác (allBookings)
          const otherBookingSlots = (allBookings || [])
            .filter(b => {
              const cNo = String(b.containerId || b.containerNo || '').trim().toUpperCase()
              if (!cNo || cNo === 'CONT' || cNo.startsWith('SLOT-') || currentManifestContNumbers.has(cNo)) return false
              const vName = b.vesselName || ''
              if (vessel?.vesselName && vName.toLowerCase().trim() === vessel.vesselName.toLowerCase().trim()) return false
              const slot = b.autoYardSlot || {}
              const bCode = slot.blockCode || slot.block
              return bCode === activeBlockCode
            })
            .map(b => {
              const slot = b.autoYardSlot || {}
              const bayNum = Number(slot.bay) || 1
              const is20 = isContainer20({ ...b, ...slot, bay: bayNum }) || (bayNum % 2 !== 0)
              const is40 = !is20
              return {
                id: `booking-${b.id || b.containerId}`,
                block: activeBlockCode,
                blockCode: activeBlockCode,
                bay: bayNum,
                row: Number(slot.row) || 1,
                tier: Number(slot.tier) || 1,
                status: 'reserved',
                containerNumber: b.containerId || b.containerNo,
                reservedContainerNumber: b.containerId || b.containerNo,
                containerLengthFt: is40 ? 40 : 20,
                size: is40 ? 40 : 20,
                moduleSpan: is40 ? 2 : 1,
                moduleStart: is40 ? (bayNum % 2 === 0 ? Math.floor(bayNum / 2) - 1 : Math.floor((bayNum - 1) / 2)) : Math.floor((bayNum - 1) / 2),
                vesselName: b.vesselName,
                company: b.company,
              }
            })

          // 1c. Container đã ở trong bãi thực tế (API tồn kho bãi hoặc blocksData)
          // CHÚ Ý: CHỈ LẤY NHỮNG Ô THỰC SỰ CÓ CONTAINER (có containerNumber hợp lệ và status != 'empty')
          // TUYỆT ĐỐI KHÔNG lấy các ô hình học trống từ layout của bãi!
          const rawBackendSlots = (yardInventory?.slots || []).filter(s => s.block === activeBlockCode)
          const liveBlock = blocksData.find(b => (b.blockCode || b.code) === activeBlockCode)
          const rawLiveSlots = (liveBlock?.slots || []).filter(s => s.block === activeBlockCode || !s.block)
          const candidateInYard = (rawBackendSlots.length > 0 ? rawBackendSlots : rawLiveSlots).filter(s => {
            const cNo = String(s.containerNumber || s.containerId || s.reservedContainerNumber || '').trim().toUpperCase()
            const st = String(s.status || '').toLowerCase()
            const hasRealCont = Boolean(cNo) && cNo !== 'CONT' && !cNo.startsWith('SLOT-') && cNo !== 'UNDEFINED' && cNo !== 'NULL'
            const isRealStatus = st === 'occupied' || st === 'in_yard' || st === 'reserved'
            return hasRealCont && isRealStatus && st !== 'empty' && st !== 'available'
          })

          const inYardSlots = candidateInYard
            .filter(s => {
              const cNo = String(s.containerNumber || s.containerId || s.reservedContainerNumber || '').trim().toUpperCase()
              return Boolean(cNo) && !currentManifestContNumbers.has(cNo)
            })
            .map(s => {
              const bayNum = Number(s.bay) || 1
              const is20 = isContainer20(s) || (bayNum % 2 !== 0)
              const is40 = !is20
              return {
                id: `inyard-${s.id || `${s.block || activeBlockCode}-${bayNum}-${s.row}-${s.tier}`}`,
                block: s.block || activeBlockCode,
                blockCode: s.block || activeBlockCode,
                bay: bayNum,
                row: Number(s.row) || 1,
                tier: Number(s.tier) || 1,
                status: 'occupied',
                containerNumber: s.containerNumber || s.containerId || s.reservedContainerNumber,
                containerLengthFt: is40 ? 40 : 20,
                size: is40 ? 40 : 20,
                moduleSpan: is40 ? 2 : 1,
                moduleStart: s.moduleStart ?? (is40 ? (bayNum % 2 === 0 ? Math.floor(bayNum / 2) - 1 : Math.floor((bayNum - 1) / 2)) : Math.floor((bayNum - 1) / 2)),
                vesselName: s.vesselName || 'Đang lưu bãi',
              }
            })

          // Hợp nhất toàn bộ các ô đã có container sẵn trước đó (để thuật toán quy hoạch tránh xa ra):
          const existingOccupiedSlots = []
          const seenOccKeys = new Set()
          const seenOccConts = new Set()
          ;[...storeRes, ...otherBookingSlots, ...inYardSlots].forEach(item => {
            const cNo = String(item.containerNumber || item.reservedContainerNumber || '').trim().toUpperCase()
            const coordKey = `${item.blockCode || item.block}-${item.bay}-${item.row}-${item.tier}`
            if (!cNo || cNo === 'CONT' || cNo.startsWith('SLOT-')) return
            if (!seenOccKeys.has(coordKey) && !seenOccConts.has(cNo)) {
              seenOccKeys.add(coordKey)
              seenOccConts.add(cNo)
              existingOccupiedSlots.push(item)
            }
          })

          // 2. Container chuẩn bị hạ đặt của chuyến tàu này (sáng vàng hổ phách + nhãn ĐT)
          // QUAN TRỌNG: Chỉ hiển thị các container thuộc Block đang xem (activeBlockCode)
          const containersInThisBlock = manifestHighlightBlocks[activeBlockCode]?.containers || []

          // Lập kế hoạch xếp bãi chuẩn Tiên Sa qua module tập trung yardPlanningRules:
          // Xếp 40ft trước, 20ft sau, VÀ TRÁNH 100% TOÀN BỘ CÁC Ô ĐÃ CÓ CONTAINER SẴN
          const blockSlotMap = planContainersForBlock(
            containersInThisBlock,
            activeBlockCode,
            existingOccupiedSlots,
            currentArea?.planning?.rows || 6,
            currentArea?.planning?.bayModules || 28
          )

          const manifestSlots = containersInThisBlock.map((c, blockIdx) => {
            const key = getContainerKey(c)
            const manualPos = manualSlotOverrides[key]
            const pos = manualPos || blockSlotMap.get(c) || (key ? blockSlotMap.get(key) : null) || c.autoYardSlot || createSlotRecord(activeBlockCode, 2, (blockIdx % 6) + 1, 1, 40)
            const is40 = pos.size === 40 || !isContainer20(c)
            const bayNum = pos.bay
            const rowNum = pos.row
            const tierNum = pos.tier
            const grossKg = Number(c.grossWeightKg || 22000)

            return {
              id: `slot-manifest-${c.containerId || c.containerNumber || blockIdx}`,
              block: activeBlockCode,
              blockCode: activeBlockCode,
              bay: bayNum,
              row: rowNum,
              tier: tierNum,
              status: 'reserved',
              tag: 'ĐT',
              isPendingPlacement: true,
              containerNumber: c.containerId || c.containerNumber,
              reservedContainerNumber: c.containerId || c.containerNumber,
              containerLengthFt: is40 ? 40 : 20,
              size: is40 ? 40 : 20,
              containerType: c.containerType || c.isoType || (is40 ? '40HC' : '20GP'),
              moduleSpan: is40 ? 2 : 1,
              moduleStart: is40 ? (bayNum % 2 === 0 ? Math.floor(bayNum / 2) - 1 : Math.floor((bayNum - 1) / 2)) : Math.floor((bayNum - 1) / 2),
              blNumber: c.blNumber || 'BL-DEMO',
              grossWeightKg: grossKg,
              vesselName: vessel?.vesselName,
              voyageNumber: vessel?.voyageNumber,
              sealNumber: c.sealNumber,
              bookingDetails: {
                containerNumber: c.containerId || c.containerNumber,
                driverName: 'Nguyễn Văn Long',
                licensePlate: '43C-091.22',
                company: c.shipperName || c.consigneeName || 'Công ty TNHH Vận tải Tiên Sa',
              }
            }
          })

          // 3. HỢP NHẤT TOÀN BỘ CÁC VỊ TRÍ CONTAINER VÀO SƠ ĐỒ:
          // Container cũ (existingOccupiedSlots) ĐƯỢC BẢO VỆ 100%, container mới (manifestSlots) xếp vào các ô còn lại
          const combinedYardSlots = [...existingOccupiedSlots]
          const isCellOccupied = (bCode, row, tier, bay) => {
            return combinedYardSlots.some(existing => {
              if ((existing.blockCode || existing.block) !== bCode || Number(existing.row) !== Number(row) || Number(existing.tier) !== Number(tier)) {
                return false
              }
              if (Number(existing.bay) === Number(bay)) return true
              if (existing.moduleSpan === 2) {
                const mStart = existing.moduleStart
                const bayA = mStart * 2 + 1
                const bayB = mStart * 2 + 2
                const bayC = mStart * 2 + 3
                if (Number(bay) === bayA || Number(bay) === bayB || Number(bay) === bayC) return true
              }
              return false
            })
          }

          manifestSlots.forEach(mSlot => {
            if (!isCellOccupied(mSlot.blockCode || mSlot.block, mSlot.row, mSlot.tier, mSlot.bay)) {
              combinedYardSlots.push(mSlot)
            }
          })

          const yardSlots = combinedYardSlots
          const targetContNo = viewingYardMapContainer?.containerId || viewingYardMapContainer?.containerNumber
          const targetManifestSlot = manifestSlots.find(s => s.containerNumber === targetContNo) || manifestSlots[0]
          const isTarget20 = Boolean(viewingYardMapContainer?.containerType?.includes('20') || Number(viewingYardMapContainer?.size) === 20 || Number(viewingYardMapContainer?.containerLengthFt) === 20)
          const targetBay = targetManifestSlot ? targetManifestSlot.bay : (isTarget20 ? 1 : 2)
          const targetRow = targetManifestSlot ? targetManifestSlot.row : 1
          const targetTier = targetManifestSlot ? targetManifestSlot.tier : 1 // Tier tương ứng của container (Tier 1 hoặc Tier 2 nếu xếp chồng)
          const focusPos = `${activeBlockCode}.${String(targetBay).padStart(2, '0')}.${String(targetRow).padStart(2, '0')}.${targetTier}`

          return (
            <div className="fixed inset-0 bg-carbon/80 backdrop-blur-md z-[70] flex items-center justify-center p-2 sm:p-4">
              <div className="bg-white w-full max-w-6xl max-h-[96vh] rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xl border border-slate-200 overflow-y-auto animate-in zoom-in-95 duration-150 font-sans">
                {/* Header Bản Đồ Bãi */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <span className="material-symbols-outlined text-xl">map</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 font-heading">
                          Bản Đồ Bãi Cảng Tiên Sa · Tàu {vessel.vesselName} ({vessel.voyageNumber})
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          {yardViewMode === 'detail' ? `Mặt bằng Bay × Row: Block ${activeBlockCode}` : 'Sơ đồ toàn cảng Tiên Sa'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {yardViewMode === 'detail'
                          ? `Mặt bằng chi tiết Block ${activeBlockCode}. Các ô hạ đặt được đánh dấu [ĐT] và sáng màu vàng hổ phách. Bấm vào ô để xem thông tin container.`
                          : 'Các block có container của tàu đang sáng màu vàng và đánh dấu [ĐT]. Bấm vào từng Block để xem mặt bằng Bay × Row.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Nút chuyển chế độ xem: BlockDetail vs Toàn Cảng */}
                    <button
                      type="button"
                      onClick={() => setYardViewMode(m => m === 'detail' ? 'map' : 'detail')}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition flex items-center gap-1.5 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {yardViewMode === 'detail' ? 'public' : 'grid_view'}
                      </span>
                      <span>{yardViewMode === 'detail' ? '← Xem Toàn Cảng' : `Xem Block ${activeBlockCode} →`}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setViewingYardMapContainer(null)
                        setSelectedMapBlockCode(null)
                      }}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer transition shrink-0"
                      title="Đóng bản đồ bãi"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>
                </div>

                {/* Thanh nút bấm nhanh các Block có container của tàu */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                  <span className="text-slate-500 text-[11px] font-semibold shrink-0">Các Block có container (ĐT):</span>
                  {highlightBlockKeys.map(bCode => {
                    const info = manifestHighlightBlocks[bCode]
                    const isActive = activeBlockCode === bCode
                    return (
                      <button
                        key={bCode}
                        type="button"
                        onClick={() => {
                          setSelectedMapBlockCode(bCode)
                          setYardViewMode('detail')
                        }}
                        className={`px-3 py-1.5 rounded-xl border font-mono text-xs font-bold cursor-pointer transition flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-md ring-2 ring-amber-300'
                            : 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100'
                        }`}
                      >
                        <span className="px-1.5 py-0.2 rounded bg-slate-900 text-amber-300 text-[10px] font-black">ĐT</span>
                        <span>Block {bCode}</span>
                        <span className="text-[10px] opacity-75">({info.count} cont)</span>
                      </button>
                    )
                  })}
                </div>

                {/* KHUNG NỘI DUNG: BLOCKDETAIL (MẶT BẰNG BAY x ROW) HOẶC TIENSAMAP (TOÀN CẢNG) */}
                <div className="yard-design-preview rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-50">
                  {yardViewMode === 'detail' ? (
                    <BlockDetail
                      key={`${activeBlockCode}-${focusPos}`}
                      area={currentArea}
                      inventorySlots={yardSlots}
                      focusPosition={focusPos}
                      maxModules={maxModules}
                      onBack={() => setYardViewMode('map')}
                      onOpenContainerDetail={(contData) => {
                        setYardContainerDetailModal({
                          isOpen: true,
                          data: contData
                        })
                      }}
                    />
                  ) : (
                    <TienSaMap
                      layout={sourceLayout}
                      selectedCode={activeBlockCode}
                      onSelectArea={(area) => {
                        setSelectedMapBlockCode(area.code)
                        setYardViewMode('detail')
                      }}
                      highlightBlocks={manifestHighlightBlocks}
                    />
                  )}
                </div>

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setViewingYardMapContainer(null)
                      setSelectedMapBlockCode(null)
                    }}
                    className="px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold cursor-pointer transition shadow-xs"
                  >
                    Đóng Bản Đồ Bãi
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Modal Xem Chi Tiết Container Bãi */}
        {yardContainerDetailModal.isOpen && (
          <ContainerYardDetailModal
            isOpen={yardContainerDetailModal.isOpen}
            onClose={() => setYardContainerDetailModal({ isOpen: false, data: null })}
            containerData={yardContainerDetailModal.data}
            onChangeYardSlot={(contData) => {
              setYardContainerDetailModal({ isOpen: false, data: null })
              const slot = contData.autoYardSlot || {
                blockCode: contData.blockCode || contData.block,
                bay: contData.bay,
                row: contData.row,
                tier: contData.tier,
                coordinate: contData.slotCode || `${contData.blockCode || contData.block}-${contData.bay}-R${contData.row}-T${contData.tier}`
              }
              handleOpenChangeYard(contData, slot, contData.blockCode || contData.block, contData.bay, contData.row, contData.tier)
            }}
          />
        )}

        {/* BƯỚC 1: POP-UP SƠ ĐỒ PHÂN KHU BÃI CẢNG TIÊN SA (BẢN ĐỒ TIÊN SA ĐỂ CHỌN BLOCK) */}
        {isZoneSelectorOpen && changeYardTargetContainer && (
          <YardZoneBlockSelectorModal
            isOpen={isZoneSelectorOpen}
            onClose={() => {
              setIsZoneSelectorOpen(false)
              setChangeYardTargetContainer(null)
              setSelectedBlockForSlot(null)
            }}
            container={changeYardTargetContainer}
            currentSlot={
              changeYardTargetContainer.autoYardSlot?.coordinate ||
              `${changeYardTargetContainer.blockCode || 'B01'}-${String(changeYardTargetContainer.bay || 1).padStart(2, '0')}-R${String(changeYardTargetContainer.row || 1).padStart(2, '0')}-T${changeYardTargetContainer.tier || 1}`
            }
            onSelectBlock={(targetBlock) => {
              setSelectedBlockForSlot(targetBlock)
              setIsZoneSelectorOpen(false)
            }}
          />
        )}

        {/* BƯỚC 2: MODAL ĐỔI VỊ TRÍ BÃI 2D (SƠ ĐỒ CHỌN BAY & SLOT TRÊN MẶT CẮT BLOCK) */}
        {selectedBlockForSlot && changeYardTargetContainer && (
          <YardSlotReservationModal
            isOpen={Boolean(selectedBlockForSlot && changeYardTargetContainer)}
            onClose={() => {
              setSelectedBlockForSlot(null)
              setChangeYardTargetContainer(null)
            }}
            block={targetBlockObj}
            booking={changeYardBooking}
            currentReservation={changeYardCurrentReservation}
            onConfirm={handleConfirmChangeYardSlot}
            siblingContainers={localContainers}
            manualOverrides={manualSlotOverrides}
          />
        )}

        {/* Floating Success Toast */}
        {toastMessage && (
          <div className="fixed top-8 right-8 z-[200] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500/60 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
            <span className="text-xs font-bold">{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  )
}
