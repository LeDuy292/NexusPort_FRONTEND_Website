import React, { useState, useEffect, useMemo } from 'react'
import {
  INITIAL_CONTAINERS,
  YARD_BLOCKS,
  YARD_BAYS,
  getSlotsForBay,
  INITIAL_YARD_TRACTORS,
  INITIAL_YARD_DRIVERS,
} from '../../data/yardMoveData'

export default function CreateYardMoveModal({
  isOpen,
  onClose,
  preSelectedContainerId,
  onMoveCreated,
  containersList = INITIAL_CONTAINERS,
  tractorsList = INITIAL_YARD_TRACTORS,
  driversList = INITIAL_YARD_DRIVERS,
}) {
  // Form State
  const [selectedContainerId, setSelectedContainerId] = useState('')
  const [destBlock, setDestBlock] = useState('Block D')
  const [destBay, setDestBay] = useState('Bay D-02')
  const [destRow, setDestRow] = useState('01')
  const [destTier, setDestTier] = useState('02')
  const [selectedTractorId, setSelectedTractorId] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [priority, setPriority] = useState('Normal')
  const [notes, setNotes] = useState('')
  
  // UI & Submit State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successResult, setSuccessResult] = useState(null)

  // Initialize or update selected container on open / pre-select
  useEffect(() => {
    if (isOpen) {
      setSuccessResult(null)
      const containerToSelect = preSelectedContainerId || containersList[0]?.id || ''
      setSelectedContainerId(containerToSelect)

      // Auto-select first available tractor
      const availTractor = tractorsList.find(t => t.selectable)
      if (availTractor) setSelectedTractorId(availTractor.id)

      // Auto-select first available driver
      const availDriver = driversList.find(d => d.selectable)
      if (availDriver) setSelectedDriverId(availDriver.id)

      // Reset destination defaults
      setDestBlock('Block D')
      setDestBay('Bay D-02')
      setDestRow('01')
      setDestTier('02')
      setPriority('Normal')
      setNotes('')
    }
  }, [isOpen, preSelectedContainerId, containersList, tractorsList, driversList])

  // Current selected container object
  const currentContainer = useMemo(() => {
    return containersList.find(c => c.id === selectedContainerId) || containersList[0]
  }, [containersList, selectedContainerId])

  // Available bays for selected destination block
  const availableBays = useMemo(() => {
    return YARD_BAYS[destBlock] || []
  }, [destBlock])

  // Available slots (Row / Tier grid) for selected bay
  const availableSlots = useMemo(() => {
    return getSlotsForBay(destBay)
  }, [destBay])

  // Update Bay & Slot options when Block changes
  const handleBlockChange = (newBlock) => {
    setDestBlock(newBlock)
    const bays = YARD_BAYS[newBlock] || []
    const firstSelectableBay = bays.find(b => b.selectable) || bays[0]
    if (firstSelectableBay) {
      setDestBay(firstSelectableBay.code)
      const slots = getSlotsForBay(firstSelectableBay.code)
      const firstAvailSlot = slots.find(s => s.status === 'AVAILABLE') || slots[0]
      if (firstAvailSlot) {
        setDestRow(firstAvailSlot.row)
        setDestTier(firstAvailSlot.tier)
      }
    }
  }

  // Update Slot options when Bay changes
  const handleBayChange = (newBayCode) => {
    setDestBay(newBayCode)
    const slots = getSlotsForBay(newBayCode)
    const firstAvailSlot = slots.find(s => s.status === 'AVAILABLE') || slots[0]
    if (firstAvailSlot) {
      setDestRow(firstAvailSlot.row)
      setDestTier(firstAvailSlot.tier)
    }
  }

  // Selected Slot details
  const selectedSlot = useMemo(() => {
    return availableSlots.find(s => s.row === destRow && s.tier === destTier)
  }, [availableSlots, destRow, destTier])

  // Selected Tractor details
  const selectedTractor = useMemo(() => {
    return tractorsList.find(t => t.id === selectedTractorId)
  }, [tractorsList, selectedTractorId])

  // Selected Driver details
  const selectedDriver = useMemo(() => {
    return driversList.find(d => d.id === selectedDriverId)
  }, [driversList, selectedDriverId])

  // ─── VALIDATION ENGINE ────────────────────────────────────────────────────────
  const validationErrors = useMemo(() => {
    const errors = []

    if (!currentContainer) {
      errors.push('Vui lòng chọn container cần di chuyển.')
      return errors
    }

    // 1. Container active movement check
    if (currentContainer.hasActiveMove) {
      errors.push(`⚠️ Container ${currentContainer.id} hiện đang có lệnh di chuyển chưa hoàn thành.`)
    }

    // 2. Destination Bay check
    const bayObj = availableBays.find(b => b.code === destBay)
    if (bayObj && !bayObj.selectable) {
      errors.push(`⚠️ ${destBay} không thể chọn: ${bayObj.reason || 'Vị trí bãi không khả dụng.'}`)
    }

    // 3. Destination Slot Occupied check
    if (selectedSlot && selectedSlot.status === 'OCCUPIED') {
      errors.push(`⚠️ Slot ${destBay} / Hàng ${destRow} / Tầng ${destTier} đã có container (${selectedSlot.container || 'Occupied'}).`)
    }

    // 4. Same location check
    if (currentContainer.currentLocation) {
      const { block, bay, row, tier } = currentContainer.currentLocation
      if (block === destBlock && bay === destBay && row === destRow && tier === destTier) {
        errors.push(`⚠️ Vị trí đích đến (${destBlock} / ${destBay} / Row ${destRow} / Tier ${destTier}) trùng với vị trí hiện tại của container.`)
      }
    }

    // 5. Yard Tractor check
    if (!selectedTractorId) {
      errors.push('⚠️ Vui lòng phân công xe đầu kéo bãi (Yard Tractor).')
    } else if (selectedTractor && !selectedTractor.selectable) {
      errors.push(`⚠️ Xe ${selectedTractor.id} không khả dụng: ${selectedTractor.reason || 'Xe đang thực hiện nhiệm vụ khác.'}`)
    }

    // 6. Yard Driver check
    if (!selectedDriverId) {
      errors.push('⚠️ Vui lòng phân công tài xế bãi (Yard Driver).')
    } else if (selectedDriver && !selectedDriver.selectable) {
      errors.push(`⚠️ Tài xế ${selectedDriver.name} không khả dụng: ${selectedDriver.reason || 'Tài xế đang trong ca chạy khác.'}`)
    }

    return errors
  }, [
    currentContainer,
    destBlock,
    destBay,
    destRow,
    destTier,
    availableBays,
    selectedSlot,
    selectedTractorId,
    selectedTractor,
    selectedDriverId,
    selectedDriver,
  ])

  const isValid = validationErrors.length === 0

  // ─── FORM SUBMIT HANDLER ──────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isValid || isSubmitting) return

    setIsSubmitting(true)

    // Simulate API network call
    setTimeout(() => {
      const newMovement = {
        id: `YM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 900) + 100)}`,
        containerId: currentContainer.id,
        containerInfo: `${currentContainer.size} • ${currentContainer.shippingLine}`,
        from: `${currentContainer.currentLocation.block} / ${currentContainer.currentLocation.bay} / Row ${currentContainer.currentLocation.row} / Tier ${currentContainer.currentLocation.tier}`,
        to: `${destBlock} / ${destBay} / Row ${destRow} / Tier ${destTier}`,
        toBlock: destBlock,
        toBay: destBay,
        toRow: destRow,
        toTier: destTier,
        yardTractor: selectedTractor.id,
        yardDriver: selectedDriver.name,
        priority,
        notes: notes || 'Không có chỉ dẫn đặc biệt.',
        status: 'ASSIGNED',
        statusBadge: 'bg-blue-100 text-blue-800 border-blue-300',
        statusLabel: '🔵 Assigned (Đã giao lệnh)',
        createdAt: new Date().toLocaleTimeString('vi-VN'),
      }

      setIsSubmitting(false)
      setSuccessResult(newMovement)

      if (onMoveCreated) {
        onMoveCreated(newMovement)
      }
    }, 900)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans">
      {/* Dark backdrop */}
      <div
        className="fixed inset-0 bg-carbon/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-chalk w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* ─── MODAL HEADER ─── */}
        <div className="px-6 py-4 border-b border-chalk bg-fog flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-extrabold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase tracking-wider">
                YÊU CẦU DI CHUYỂN BÃI
              </span>
              <span className="text-[10px] font-mono text-slate">Role: Yard Operator · Cảng Tiên Sa</span>
            </div>
            <h2 className="font-heading text-xl font-extrabold text-carbon leading-snug">
              TẠO LỆNH DI CHUYỂN BÃI
            </h2>
            <p className="text-xs text-slate">Create an internal container movement order</p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-chalk hover:bg-mist text-slate hover:text-carbon transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* ─── SUCCESS SCREEN VIEW ─── */}
        {successResult ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-6 overflow-y-auto flex-1">
            <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-[36px]">check_circle</span>
            </div>

            <div>
              <span className="text-xs font-bold bg-green-100 text-green-800 border border-green-300 px-3 py-1 rounded-full uppercase tracking-wider">
                ✅ Tạo lệnh di chuyển bãi thành công
              </span>
              <h3 className="font-heading text-2xl font-extrabold text-carbon mt-3">
                {successResult.id}
              </h3>
              <p className="text-xs text-slate mt-1">
                Đã gán nhiệm vụ thành công cho xe đầu kéo & tài xế bãi
              </p>
            </div>

            {/* Summary Details Card */}
            <div className="w-full max-w-xl bg-fog border border-chalk rounded-2xl p-5 text-left text-xs space-y-3 shadow-sm">
              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-chalk">
                <div>
                  <span className="text-slate uppercase text-[10px] font-bold block mb-0.5">Container</span>
                  <span className="font-mono font-extrabold text-carbon text-sm">{successResult.containerId}</span>
                  <span className="text-[11px] text-slate block">{successResult.containerInfo}</span>
                </div>
                <div>
                  <span className="text-slate uppercase text-[10px] font-bold block mb-0.5">Trạng Thái Lệnh</span>
                  <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                    🔵 ASSIGNED
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-chalk">
                <div>
                  <span className="text-slate uppercase text-[10px] font-bold block mb-0.5">Từ Vị Trí</span>
                  <span className="font-bold text-carbon">{successResult.from}</span>
                </div>
                <div>
                  <span className="text-slate uppercase text-[10px] font-bold block mb-0.5">Đến Vị Trí Đích</span>
                  <span className="font-bold text-signal-orange">{successResult.to}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate uppercase text-[10px] font-bold block mb-0.5">Xe Đầu Kéo Bãi (Yard Tractor)</span>
                  <span className="font-bold text-carbon">{successResult.yardTractor}</span>
                </div>
                <div>
                  <span className="text-slate uppercase text-[10px] font-bold block mb-0.5">Tài Xế Bãi (Yard Driver)</span>
                  <span className="font-bold text-carbon">{successResult.yardDriver}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="px-6 h-11 bg-signal-orange text-white text-xs font-extrabold rounded-xl hover:opacity-90 transition-all shadow-md flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">done_all</span>
              Hoàn Tất & Quay Lại Bản Đồ Bãi
            </button>
          </div>
        ) : (

          /* ─── SCROLLABLE FORM BODY ─── */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* ── SECTION 1: CHỌN CONTAINER & CURRENT LOCATION ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Container Selector Card */}
              <div className="bg-fog rounded-xl p-4 border border-chalk flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[11px] font-bold text-slate uppercase tracking-wider">
                      CHỌN CONTAINER <span className="text-red-500">*</span>
                    </label>
                    {currentContainer?.category && (
                      <span className="text-[10px] font-bold bg-white border border-chalk px-2 py-0.5 rounded text-carbon">
                        {currentContainer.category}
                      </span>
                    )}
                  </div>

                  <select
                    value={selectedContainerId}
                    onChange={e => setSelectedContainerId(e.target.value)}
                    className="w-full h-10 px-3 border border-chalk rounded-lg text-xs font-mono font-bold text-carbon bg-white focus:outline-none focus:border-signal-orange"
                  >
                    {containersList.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.id} ({c.size} • {c.currentLocation.block} / {c.currentLocation.bay}) {c.hasActiveMove ? '⚠ Đang di chuyển' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pre-selected Container Summary Display */}
                {currentContainer && (
                  <div className="bg-white rounded-lg p-3 border border-chalk space-y-1">
                    <div className="font-mono font-extrabold text-carbon text-base">
                      {currentContainer.id}
                    </div>
                    <div className="text-[11px] text-slate font-medium">
                      {currentContainer.size} • {currentContainer.shippingLine} • Seal: {currentContainer.sealNumber}
                    </div>
                    <div className="text-[11px] font-bold text-carbon flex items-center gap-1 pt-1">
                      <span className="text-signal-orange">📍</span>
                      <span>Vị trí: {currentContainer.currentLocation.block} / {currentContainer.currentLocation.bay} / Row {currentContainer.currentLocation.row} / Tier {currentContainer.currentLocation.tier}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Current Location Read-Only Display */}
              <div className="bg-white rounded-xl p-4 border border-chalk space-y-3 shadow-sm">
                <div className="text-[11px] font-bold text-slate uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-slate">my_location</span>
                  VỊ TRÍ HIỆN TẠI (CURRENT LOCATION - READ ONLY)
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-fog rounded-lg p-2.5 border border-chalk">
                    <span className="text-[9px] font-bold text-slate uppercase block">Khối Bãi</span>
                    <span className="font-extrabold text-carbon text-sm font-mono">{currentContainer?.currentLocation?.block || '—'}</span>
                  </div>
                  <div className="bg-fog rounded-lg p-2.5 border border-chalk">
                    <span className="text-[9px] font-bold text-slate uppercase block">Bay</span>
                    <span className="font-extrabold text-carbon text-sm font-mono">{currentContainer?.currentLocation?.bay || '—'}</span>
                  </div>
                  <div className="bg-fog rounded-lg p-2.5 border border-chalk">
                    <span className="text-[9px] font-bold text-slate uppercase block">Hàng (Row)</span>
                    <span className="font-extrabold text-carbon text-sm font-mono">{currentContainer?.currentLocation?.row || '—'}</span>
                  </div>
                  <div className="bg-fog rounded-lg p-2.5 border border-chalk">
                    <span className="text-[9px] font-bold text-slate uppercase block">Tầng (Tier)</span>
                    <span className="font-extrabold text-carbon text-sm font-mono">{currentContainer?.currentLocation?.tier || '—'}</span>
                  </div>
                </div>

                <div className="text-[10px] text-slate italic bg-fog p-2 rounded-lg border border-chalk text-center">
                  🔒 Vị trí hiện tại được xác nhận tự động từ cơ sở dữ liệu container cảng.
                </div>
              </div>

            </div>

            {/* ── SECTION 2: VỊ TRÍ ĐÍCH ĐẾN (DESTINATION SECTION) ── */}
            <div className="bg-white rounded-xl p-5 border border-chalk shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-chalk pb-3">
                <div className="text-xs font-extrabold text-carbon uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-signal-orange">place</span>
                  VỊ TRÍ ĐÍCH ĐẾN (DESTINATION SLOT) <span className="text-red-500">*</span>
                </div>
                <span className="text-[11px] text-slate font-mono">Chỉ cho phép chọn vị trí AVAILABLE 🟢</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                
                {/* 1. Khối Bãi Đích */}
                <div>
                  <label className="block text-[10px] font-bold text-slate uppercase mb-1.5">
                    Khối Bãi Đích
                  </label>
                  <select
                    value={destBlock}
                    onChange={e => handleBlockChange(e.target.value)}
                    className="w-full h-10 px-3 border border-chalk rounded-xl font-bold text-carbon bg-fog focus:outline-none focus:border-signal-orange"
                  >
                    {YARD_BLOCKS.map(b => (
                      <option key={b.code} value={b.code}>
                        {b.code} ({b.name.split('–')[1] || b.name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Vị trí Bay Đích */}
                <div>
                  <label className="block text-[10px] font-bold text-slate uppercase mb-1.5">
                    Vị trí Bay Đích
                  </label>
                  <select
                    value={destBay}
                    onChange={e => handleBayChange(e.target.value)}
                    className="w-full h-10 px-3 border border-chalk rounded-xl font-bold text-carbon bg-fog focus:outline-none focus:border-signal-orange"
                  >
                    {availableBays.map(b => (
                      <option
                        key={b.code}
                        value={b.code}
                        disabled={!b.selectable}
                        className={!b.selectable ? 'text-slate bg-chalk' : ''}
                      >
                        {b.code} — {b.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Hàng (Row) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate uppercase mb-1.5">
                    Hàng (Row)
                  </label>
                  <select
                    value={destRow}
                    onChange={e => setDestRow(e.target.value)}
                    className="w-full h-10 px-3 border border-chalk rounded-xl font-bold text-carbon bg-fog focus:outline-none focus:border-signal-orange font-mono"
                  >
                    {Array.from(new Set(availableSlots.map(s => s.row))).map(r => (
                      <option key={r} value={r}>
                        Row {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Tầng (Tier) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate uppercase mb-1.5">
                    Tầng (Tier)
                  </label>
                  <select
                    value={destTier}
                    onChange={e => setDestTier(e.target.value)}
                    className="w-full h-10 px-3 border border-chalk rounded-xl font-bold text-carbon bg-fog focus:outline-none focus:border-signal-orange font-mono"
                  >
                    {availableSlots
                      .filter(s => s.row === destRow)
                      .map(s => (
                        <option
                          key={`${s.row}-${s.tier}`}
                          value={s.tier}
                          disabled={s.status === 'OCCUPIED'}
                          className={s.status === 'OCCUPIED' ? 'text-slate bg-chalk' : ''}
                        >
                          Tier {s.tier} {s.status === 'OCCUPIED' ? '🔴 (Đã chiếm)' : '🟢 (Trống)'}
                        </option>
                      ))}
                  </select>
                </div>

              </div>

              {/* Slot Preview Badge */}
              <div className="bg-fog rounded-xl p-3 border border-chalk flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate">Vị trí đích đã chọn:</span>
                  <span className="font-mono font-extrabold text-carbon bg-white px-2.5 py-1 rounded border border-chalk text-sm">
                    📍 {destBlock} / {destBay} / Row {destRow} / Tier {destTier}
                  </span>
                </div>
                {selectedSlot ? (
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    selectedSlot.status === 'AVAILABLE'
                      ? 'bg-green-50 text-green-800 border-green-300'
                      : 'bg-red-50 text-red-800 border-red-300'
                  }`}>
                    {selectedSlot.status === 'AVAILABLE' ? '🟢 SLOT HỢP LỆ & KHẢ DỤNG' : '🔴 SLOT ĐÃ BỊ CHIẾM SỬ DỤNG'}
                  </span>
                ) : (
                  <span className="text-amber-700 text-xs font-bold">⚠️ Vui lòng chọn slot hợp lệ</span>
                )}
              </div>
            </div>

            {/* ── SECTION 3: YARD TRACTOR & YARD DRIVER ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Yard Tractor Assignment */}
              <div className="bg-white rounded-xl p-5 border border-chalk shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-extrabold text-carbon uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-blue-600">front_loader</span>
                    PHÂN CÔNG XE ĐẦU KÉO BÃI <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-blue-700 font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                    Terminal Yard Tractor Only
                  </span>
                </div>

                <select
                  value={selectedTractorId}
                  onChange={e => setSelectedTractorId(e.target.value)}
                  className="w-full h-10 px-3 border border-chalk rounded-xl text-xs font-mono font-bold text-carbon bg-fog focus:outline-none focus:border-signal-orange"
                >
                  <option value="">-- Chọn Xe Đầu Kéo Bãi --</option>
                  {tractorsList.map(t => (
                    <option
                      key={t.id}
                      value={t.id}
                      disabled={!t.selectable}
                      className={!t.selectable ? 'text-slate bg-chalk' : ''}
                    >
                      {t.id} — {t.statusLabel} ({t.location})
                    </option>
                  ))}
                </select>

                {/* Selected Tractor Details Card */}
                {selectedTractor ? (
                  <div className={`rounded-xl p-3 border text-xs space-y-1 ${
                    selectedTractor.selectable ? 'bg-green-50/70 border-green-200' : 'bg-red-50/70 border-red-200'
                  }`}>
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-carbon font-mono">{selectedTractor.id} ({selectedTractor.name})</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        selectedTractor.selectable ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                      }`}>
                        {selectedTractor.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate">
                      Vị trí hiện tại: <strong>{selectedTractor.location}</strong> • Nhiên liệu: <strong>{selectedTractor.fuelLevel}</strong>
                    </div>
                    {!selectedTractor.selectable && (
                      <div className="text-[11px] font-bold text-red-700 pt-1">
                        {selectedTractor.reason}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-amber-800 text-xs font-bold bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                    ⚠️ Chưa có xe đầu kéo bãi khả dụng.
                  </div>
                )}
              </div>

              {/* Yard Driver Assignment */}
              <div className="bg-white rounded-xl p-5 border border-chalk shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-extrabold text-carbon uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-purple-600">badge</span>
                    PHÂN CÔNG TÀI XẾ BÃI <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-purple-700 font-bold bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                    Terminal Driver Only
                  </span>
                </div>

                <select
                  value={selectedDriverId}
                  onChange={e => setSelectedDriverId(e.target.value)}
                  className="w-full h-10 px-3 border border-chalk rounded-xl text-xs font-bold text-carbon bg-fog focus:outline-none focus:border-signal-orange"
                >
                  <option value="">-- Chọn Tài Xế Bãi --</option>
                  {driversList.map(d => (
                    <option
                      key={d.id}
                      value={d.id}
                      disabled={!d.selectable}
                      className={!d.selectable ? 'text-slate bg-chalk' : ''}
                    >
                      {d.name} — {d.statusLabel} ({d.shift})
                    </option>
                  ))}
                </select>

                {/* Selected Driver Details Card */}
                {selectedDriver ? (
                  <div className={`rounded-xl p-3 border text-xs space-y-1 ${
                    selectedDriver.selectable ? 'bg-purple-50/70 border-purple-200' : 'bg-red-50/70 border-red-200'
                  }`}>
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-carbon">{selectedDriver.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        selectedDriver.selectable ? 'bg-purple-600 text-white' : 'bg-red-600 text-white'
                      }`}>
                        {selectedDriver.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate">
                      Bằng cấp: <strong>{selectedDriver.license}</strong> • {selectedDriver.shift}
                    </div>
                    {!selectedDriver.selectable && (
                      <div className="text-[11px] font-bold text-red-700 pt-1">
                        {selectedDriver.reason}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-amber-800 text-xs font-bold bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                    ⚠️ Chưa có tài xế bãi khả dụng.
                  </div>
                )}
              </div>

            </div>

            {/* ── SECTION 4: PRIORITY & NOTES ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Priority Selection */}
              <div className="bg-white rounded-xl p-4 border border-chalk shadow-sm space-y-2">
                <label className="block text-[11px] font-bold text-slate uppercase tracking-wider">
                  MỨC ĐỘ ƯU TIÊN (PRIORITY)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Low', 'Low (Thấp)', 'bg-slate-100 text-slate-700 border-slate-300'],
                    ['Normal', 'Normal (Bình thường)', 'bg-blue-50 text-blue-800 border-blue-300'],
                    ['High', 'High (Cao)', 'bg-orange-50 text-orange-800 border-orange-300'],
                    ['Urgent', 'Urgent (Khẩn cấp)', 'bg-red-50 text-red-800 border-red-300'],
                  ].map(([pKey, pLabel]) => (
                    <button
                      key={pKey}
                      type="button"
                      onClick={() => setPriority(pKey)}
                      className={`h-9 px-2 rounded-lg text-xs font-bold border transition-all ${
                        priority === pKey
                          ? 'bg-signal-orange text-white border-signal-orange shadow-sm'
                          : 'bg-fog text-graphite border-chalk hover:border-slate'
                      }`}
                    >
                      {pLabel.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Movement Notes */}
              <div className="md:col-span-2 bg-white rounded-xl p-4 border border-chalk shadow-sm space-y-2">
                <label className="block text-[11px] font-bold text-slate uppercase tracking-wider">
                  GHI CHÚ DI CHUYỂN (SPECIAL INSTRUCTIONS)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder='Nhập chỉ dẫn di chuyển đặc biệt (Ví dụ: "Ưu tiên hoàn thành trước 11:00", "Chuyển trước khi RTG-02 bảo trì")...'
                  className="w-full p-2.5 bg-fog border border-chalk rounded-xl text-xs font-medium focus:outline-none focus:border-signal-orange text-carbon resize-none"
                />
              </div>

            </div>

            {/* ── VALIDATION ERROR MESSAGES BOX ── */}
            {validationErrors.length > 0 && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 space-y-2 text-xs text-red-800 animate-in fade-in duration-200">
                <div className="font-extrabold flex items-center gap-1.5 text-red-900 uppercase">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  KHÔNG THỂ TẠO LỆNH (CÓ LỖI XÁC THỰC):
                </div>
                <ul className="list-disc list-inside space-y-1 font-medium">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── MODAL ACTIONS (SUBMIT / CANCEL) ── */}
            <div className="flex items-center justify-between pt-3 border-t border-chalk">
              <button
                type="button"
                onClick={onClose}
                className="h-11 px-6 border border-chalk rounded-xl text-xs font-extrabold text-graphite hover:bg-fog transition-colors"
              >
                HỦY BỎ
              </button>

              <button
                type="submit"
                disabled={!isValid || isSubmitting}
                className={`h-11 px-8 rounded-xl text-xs font-extrabold text-white flex items-center gap-2 shadow-lg transition-all ${
                  !isValid || isSubmitting
                    ? 'bg-slate-300 border border-slate-400 cursor-not-allowed text-slate-500 shadow-none'
                    : 'bg-signal-orange hover:opacity-95'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Creating Yard Movement...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    XÁC NHẬN TẠO LỆNH
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  )
}
