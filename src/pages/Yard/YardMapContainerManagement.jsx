import React, { useState, useMemo } from 'react'

// ─── DATA ──────────────────────────────────────────────────────────────────────
const INITIAL_YARD_BLOCKS = {
  'Khu A': {
    totalSlots: 32,
    cells: [
      { bay: 'A-01', row: 1, tier: 1, id: 'MSCU1234567', type: '40FT HC', status: 'Occupied',  weight: '28,500 KG', seal: 'SEAL-88921', vessel: 'EVER GIVEN',   carrier: 'Maersk Line',    departure: '12/08/2026 21:45', prevPos: 'A-01-05-1', movedBy: 'Trần Văn Hùng',    moveTime: '09:15', moveReason: 'Tối ưu xếp dỡ lên tàu EVER GIVEN' },
      { bay: 'A-01', row: 1, tier: 2, id: 'CMAU9918234', type: '20FT ST', status: 'Occupied',  weight: '14,200 KG', seal: 'SEAL-99102', vessel: 'EVER GIVEN',   carrier: 'CMA CGM',        departure: '12/08/2026 21:45', prevPos: 'B-02-01-1', movedBy: 'Lê Văn C',         moveTime: '08:30', moveReason: 'Gán vị trí bãi dỡ từ tàu' },
      { bay: 'A-01', row: 2, tier: 1, id: null, type: 'EMPTY', status: 'Empty' },
      { bay: 'A-01', row: 2, tier: 2, id: null, type: 'EMPTY', status: 'Empty' },

      { bay: 'A-02', row: 1, tier: 1, id: 'TEMU4451920', type: '40FT RF', status: 'Reserved',  weight: '31,000 KG', seal: 'SEAL-44819', vessel: 'MSC GULSUN',   carrier: 'MSC',            departure: '13/08/2026 08:00', prevPos: 'BÃI-LẠNH', movedBy: 'Nguyễn Văn Nam', moveTime: '10:00', moveReason: 'Đặt trước bãi lạnh',
        reservedFor: { container: 'TEMU4451920', vessel: 'MSC GULSUN', eta: '14:30', estArrival: '15:10', carrier: 'MSC Mediterranean' } },
      { bay: 'A-02', row: 1, tier: 2, id: 'COSU8819201', type: '40FT HC', status: 'Moving',    weight: '26,800 KG', seal: 'SEAL-77192', vessel: 'EVER GIVEN',   carrier: 'COSCO',          departure: '12/08/2026 21:45', prevPos: 'A-02-01-1', movedBy: 'Cẩu RTG-01',      moveTime: '10:15', moveReason: 'Đang cẩu đảo vị trí theo lệnh MOV-1024' },
      { bay: 'A-02', row: 2, tier: 1, id: null, type: 'EMPTY', status: 'Empty' },
      { bay: 'A-02', row: 2, tier: 2, id: null, type: 'EMPTY', status: 'Empty' },

      { bay: 'A-03', row: 1, tier: 1, id: 'HLBU7781920', type: '40FT HC', status: 'Ready for Gate Out', weight: '24,000 KG', seal: 'SEAL-11092', vessel: 'NEXUS CARRIER', carrier: 'Hapag-Lloyd', departure: '12/08/2026 14:00', prevPos: 'A-03-01-1', movedBy: 'Nguyễn Văn Nam', moveTime: '07:45', moveReason: 'Hạ bãi sẵn sàng xuất cổng' },
      { bay: 'A-03', row: 1, tier: 2, id: 'MSCU9901123', type: '20FT ST', status: 'Damaged',   weight: '18,500 KG', seal: 'SEAL-33910', vessel: 'MSC GULSUN',   carrier: 'MSC',            departure: 'Tạm dừng',          prevPos: 'A-03-02-1', movedBy: 'Võ Thị F',         moveTime: '06:30', moveReason: 'Báo cáo móp vỏ container nghiêm trọng' },
      { bay: 'A-03', row: 2, tier: 1, id: null, type: 'EMPTY', status: 'Empty' },
      { bay: 'A-03', row: 2, tier: 2, id: null, type: 'EMPTY', status: 'Empty',
        reservedFor: { container: 'MSCU0011234', vessel: 'EVER GIVEN', eta: '16:00', estArrival: '16:45', carrier: 'Maersk Line' }, reservedForIncoming: true },

      { bay: 'A-04', row: 1, tier: 1, id: 'EVER9910022', type: '40FT HC', status: 'Occupied',  weight: '29,100 KG', seal: 'SEAL-99012', vessel: 'EVER GIVEN',   carrier: 'Maersk Line',    departure: '12/08/2026 21:45', prevPos: 'A-04-01-1', movedBy: 'Trần Văn Hải',    moveTime: '08:15', moveReason: 'Xếp tầng 1 bãi A-04' },
      { bay: 'A-04', row: 1, tier: 2, id: null, type: 'EMPTY', status: 'Empty' },
      { bay: 'A-04', row: 2, tier: 1, id: null, type: 'EMPTY', status: 'Empty',
        reservedFor: { container: 'ONEY9918802', vessel: 'ONE EXPONENT', eta: '17:00', estArrival: '17:30', carrier: 'ONE Ocean Network' }, reservedForIncoming: true },
      { bay: 'A-04', row: 2, tier: 2, id: null, type: 'EMPTY', status: 'Empty' },
    ],
  },

  'Khu B': {
    totalSlots: 16,
    cells: [
      { bay: 'B-01', row: 1, tier: 1, id: 'KLINE881920', type: '20FT ST', status: 'Occupied',  weight: '15,000 KG', seal: 'SEAL-22190', vessel: 'ONE EXPONENT',  carrier: 'ONE',            departure: '13/08/2026 12:00', prevPos: 'B-01-00-0', movedBy: 'Nguyễn Văn Nam', moveTime: '09:00', moveReason: 'Nhập bãi Khu B từ tàu' },
      { bay: 'B-01', row: 1, tier: 2, id: null, type: 'EMPTY', status: 'Empty' },
      { bay: 'B-01', row: 2, tier: 1, id: null, type: 'EMPTY', status: 'Empty' },
      { bay: 'B-01', row: 2, tier: 2, id: null, type: 'EMPTY', status: 'Empty' },

      { bay: 'B-02', row: 1, tier: 1, id: 'ONEY3399102', type: '40FT HC', status: 'Ready for Gate Out', weight: '27,300 KG', seal: 'SEAL-77881', vessel: 'ONE EXPONENT', carrier: 'ONE', departure: '12/08/2026 16:00', prevPos: 'B-02-01-1', movedBy: 'Trần Văn Hùng', moveTime: '08:00', moveReason: 'Chuẩn bị giao xe tải xuất cổng' },
      { bay: 'B-02', row: 1, tier: 2, id: null, type: 'EMPTY', status: 'Empty' },
      { bay: 'B-02', row: 2, tier: 1, id: null, type: 'EMPTY', status: 'Empty' },
      { bay: 'B-02', row: 2, tier: 2, id: null, type: 'EMPTY', status: 'Empty' },
    ],
  },

  'Khu Lạnh': {
    totalSlots: 12,
    cells: [
      { bay: 'RF-01', row: 1, tier: 1, id: 'CLHU5519201', type: '40FT RF', status: 'Occupied',  weight: '22,000 KG', seal: 'SEAL-55102', vessel: 'MSC GULSUN',   carrier: 'MSC',            departure: '14/08/2026 08:00', prevPos: 'RF-00', movedBy: 'Phạm Thị Hoa', moveTime: '11:00', moveReason: 'Bãi lạnh ưu tiên nguồn điện reefer' },
      { bay: 'RF-01', row: 1, tier: 2, id: null, type: 'EMPTY', status: 'Empty' },
      { bay: 'RF-01', row: 2, tier: 1, id: null, type: 'EMPTY', status: 'Empty' },
      { bay: 'RF-01', row: 2, tier: 2, id: null, type: 'EMPTY', status: 'Empty' },
    ],
  },
}

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  'Occupied':           { label: 'Có Hàng',           bg: 'bg-blue-100 border-blue-400 text-blue-950',     icon: '📦', dot: 'bg-blue-500' },
  'Empty':              { label: 'Ô Trống',            bg: 'bg-slate-100 border-slate-300 text-slate-400',  icon: '⬜', dot: 'bg-slate-300' },
  'Reserved':           { label: 'Đặt Trước',          bg: 'bg-amber-100 border-amber-400 text-amber-950',  icon: '🔒', dot: 'bg-amber-500' },
  'Moving':             { label: 'Đang Di Chuyển',     bg: 'bg-purple-100 border-purple-400 text-purple-950', icon: '⚡', dot: 'bg-purple-500' },
  'Ready for Gate Out': { label: 'Sẵn Sàng Xuất Cổng', bg: 'bg-emerald-100 border-emerald-400 text-emerald-950', icon: '🚛', dot: 'bg-emerald-500' },
  'Damaged':            { label: 'Hư Hỏng',            bg: 'bg-red-200 border-red-500 text-red-950',        icon: '⚠️', dot: 'bg-red-500' },
}

export default function YardMapContainerManagement() {
  const [yardData, setYardData] = useState(INITIAL_YARD_BLOCKS)
  const [searchQuery, setSearchQuery] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [activeBlock, setActiveBlock] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedCell, setSelectedCell] = useState(null)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [isMoveMode, setIsMoveMode] = useState(false)
  const [targetMoveCell, setTargetMoveCell] = useState(null)
  const [moveReasonInput, setMoveReasonInput] = useState('')

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 3500) }

  // ── GLOBAL CAPACITY STATS ──
  const globalStats = useMemo(() => {
    let total = 0, used = 0
    Object.values(yardData).forEach(({ totalSlots, cells }) => {
      total += totalSlots
      used += cells.filter(c => c.status !== 'Empty').length
    })
    return { total, used, free: total - used, pct: Math.round((used / total) * 100) }
  }, [yardData])

  // ── PER-BLOCK CAPACITY ──
  const blockStats = useMemo(() => {
    const s = {}
    Object.entries(yardData).forEach(([name, { totalSlots, cells }]) => {
      const used = cells.filter(c => c.status !== 'Empty').length
      s[name] = { total: totalSlots, used, free: totalSlots - used, pct: Math.round((used / totalSlots) * 100) }
    })
    return s
  }, [yardData])

  const isMatchSearch = (cell) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.trim().toLowerCase()
    return (
      (cell.id && cell.id.toLowerCase().includes(q)) ||
      (cell.seal && cell.seal.toLowerCase().includes(q)) ||
      (cell.vessel && cell.vessel.toLowerCase().includes(q))
    )
  }

  const matchesFilters = (cell) => {
    const matchType = typeFilter === 'All' || cell.type === typeFilter
    const matchStatus = statusFilter === 'All' || cell.status === statusFilter
    return matchType && matchStatus
  }

  // ── CELL CLICK ──
  const handleCellClick = (blockName, cell) => {
    if (isMoveMode) {
      if (cell.status !== 'Empty') { showToast('⚠️ Vui lòng chọn ô TRỐNG làm vị trí đích mới!'); return }
      setTargetMoveCell({ block: blockName, ...cell })
      showToast(`📍 Đã chọn ô đích: ${blockName} ${cell.bay}-${cell.row}-${cell.tier}`)
      return
    }
    setSelectedCell({ block: blockName, ...cell })
  }

  // ── CONFIRM MOVE ──
  const handleConfirmMove = () => {
    if (!selectedCell || !targetMoveCell) return
    const oldPos = `${selectedCell.block} ${selectedCell.bay}-${selectedCell.row}-${selectedCell.tier}`
    const newPos = `${targetMoveCell.block} ${targetMoveCell.bay}-${targetMoveCell.row}-${targetMoveCell.tier}`
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    const updatedItem = { ...selectedCell, prevPos: oldPos, movedBy: 'Nguyễn Văn Nam (Nhân Viên Bãi)', moveTime: nowTime, moveReason: moveReasonInput || 'Cập nhật vị trí thực tế' }

    setYardData(prev => {
      const next = {}
      Object.entries(prev).forEach(([name, { totalSlots, cells }]) => {
        let updated = cells
        if (name === selectedCell.block)
          updated = updated.map(c => c.bay === selectedCell.bay && c.row === selectedCell.row && c.tier === selectedCell.tier ? { bay: c.bay, row: c.row, tier: c.tier, id: null, type: 'EMPTY', status: 'Empty' } : c)
        if (name === targetMoveCell.block)
          updated = updated.map(c => c.bay === targetMoveCell.bay && c.row === targetMoveCell.row && c.tier === targetMoveCell.tier ? { ...updatedItem, bay: targetMoveCell.bay, row: targetMoveCell.row, tier: targetMoveCell.tier } : c)
        next[name] = { totalSlots, cells: updated }
      })
      return next
    })

    setSelectedCell({ ...updatedItem, block: targetMoveCell.block, bay: targetMoveCell.bay, row: targetMoveCell.row, tier: targetMoveCell.tier })
    setIsMoveMode(false); setTargetMoveCell(null)
    showToast(`✅ DỊCH CHUYỂN THÀNH CÔNG: ${selectedCell.id} [${oldPos}] ➔ [${newPos}]`)
  }

  // ─── RENDER SIDE PANEL ──────────────────────────────────────────────────────
  const renderSidePanel = () => {
    if (!selectedCell) return null
    const cfg = STATUS_CFG[selectedCell.status] || STATUS_CFG['Occupied']
    const isReservedEmpty = selectedCell.status === 'Empty' && selectedCell.reservedForIncoming
    const isReservedOccupied = selectedCell.status === 'Reserved'

    return (
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-sm space-y-4 font-sans flex flex-col justify-between animate-in slide-in-from-right-5">
        <div className="space-y-4">
          {/* Panel header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-3">
            <div>
              <span className="text-[10px] font-black text-orange-600 uppercase font-mono">THÔNG TIN Ô BÃI</span>
              {selectedCell.id ? (
                <h3 className="font-heading text-xl font-black text-slate-900 font-mono mt-0.5">{selectedCell.id}</h3>
              ) : (
                <h3 className="font-heading text-xl font-black text-slate-500 font-mono mt-0.5">Ô {selectedCell.block} {selectedCell.bay}-{selectedCell.row}-{selectedCell.tier}</h3>
              )}
              <div className="mt-1.5">
                <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black font-mono ${cfg.bg}`}>
                  {cfg.icon} {cfg.label}
                </span>
              </div>
            </div>
            <button onClick={() => { setSelectedCell(null); setIsMoveMode(false) }}
              className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer flex-shrink-0">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          {/* Position Breakdown */}
          <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-xs">
            {[['Khu', selectedCell.block], ['Dãy', selectedCell.bay?.split('-')[1]], ['Hàng', selectedCell.row], ['Tầng', selectedCell.tier]].map(([k, v]) => (
              <div key={k} className="bg-orange-50 border border-orange-200 rounded-xl p-2">
                <div className="text-[9px] text-slate-500 font-sans">{k}</div>
                <div className="font-black text-orange-950">{v}</div>
              </div>
            ))}
          </div>

          {/* RESERVED (incoming) slot */}
          {isReservedEmpty && selectedCell.reservedFor && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3.5 space-y-2 font-mono text-xs">
              <div className="font-black text-amber-950 text-[11px] uppercase flex items-center gap-1.5">
                🔒 TRẠNG THÁI: ĐẶT TRƯỚC CHỜ CONTAINER ĐẾN
              </div>
              {[
                ['Container Dự Kiến', selectedCell.reservedFor.container, 'text-slate-900 font-mono'],
                ['Tàu', selectedCell.reservedFor.vessel, 'text-blue-900'],
                ['Hãng', selectedCell.reservedFor.carrier, 'text-slate-700'],
                ['ETA Tàu', selectedCell.reservedFor.eta, 'text-orange-900'],
                ['Dự Kiến Vào Bãi', selectedCell.reservedFor.estArrival, 'text-emerald-900'],
              ].map(([label, val, cls]) => (
                <div key={label} className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-600 font-sans">{label}:</span>
                  <strong className={`font-black ${cls}`}>{val}</strong>
                </div>
              ))}
            </div>
          )}

          {/* RESERVED (occupied) slot */}
          {isReservedOccupied && selectedCell.reservedFor && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3.5 space-y-2 font-mono text-xs">
              <div className="font-black text-amber-950 text-[11px] uppercase flex items-center gap-1.5">
                🔒 ĐẶT TRƯỚC CHO CONTAINER ĐANG ĐẾN
              </div>
              {[
                ['Tàu', selectedCell.reservedFor.vessel, 'text-blue-900'],
                ['ETA', selectedCell.reservedFor.eta, 'text-orange-900'],
                ['Dự Kiến Vào Bãi', selectedCell.reservedFor.estArrival, 'text-emerald-900'],
              ].map(([label, val, cls]) => (
                <div key={label} className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-600 font-sans">{label}:</span>
                  <strong className={`font-black ${cls}`}>{val}</strong>
                </div>
              ))}
            </div>
          )}

          {/* Container Details (if occupied) */}
          {selectedCell.id && (
            <div className="space-y-2 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Loại Container', selectedCell.type, 'text-slate-900'],
                  ['Trọng Lượng', selectedCell.weight, 'text-slate-900'],
                  ['Hãng Tàu', selectedCell.carrier || '—', 'text-blue-900'],
                  ['Số Niêm Phong', selectedCell.seal, 'text-purple-900'],
                ].map(([label, val, cls]) => (
                  <div key={label} className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[9px] text-slate-500 font-sans font-bold block">{label}</span>
                    <strong className={`font-black text-[11px] ${cls}`}>{val}</strong>
                  </div>
                ))}
              </div>
              <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[9px] text-slate-500 font-sans font-bold block">Tàu Chở</span>
                <strong className="text-slate-900 font-black">{selectedCell.vessel}</strong>
              </div>
              <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[9px] text-slate-500 font-sans font-bold block">Dự Kiến Xuất Cảng</span>
                <strong className="text-purple-900 font-black">{selectedCell.departure}</strong>
              </div>
            </div>
          )}

          {/* Movement history */}
          {selectedCell.id && (
            <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-[11px] font-mono">
              <div className="text-slate-900 font-extrabold text-[10px] uppercase font-sans flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-purple-600">history</span> LỊCH SỬ DỊCH CHUYỂN
              </div>
              <div className="text-slate-600 font-sans">Vị trí trước: <strong className="text-slate-900">{selectedCell.prevPos || '—'}</strong></div>
              <div className="text-slate-600 font-sans">Thời gian: <strong className="text-blue-900">{selectedCell.moveTime}</strong></div>
              <div className="text-slate-600 font-sans">Thực hiện bởi: <strong className="text-slate-900">{selectedCell.movedBy}</strong></div>
              <div className="text-[10px] text-slate-600 bg-white p-2 rounded border border-slate-200 font-sans">
                "{selectedCell.moveReason}"
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-3 border-t border-slate-200">
          {selectedCell.id && (
            <a href="/yard-staff/container-detail"
              className="w-full h-10 bg-blue-100 hover:bg-blue-200 text-blue-950 border-2 border-blue-400 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all">
              <span className="material-symbols-outlined text-sm">inventory_2</span>
              [ XEM CHI TIẾT CONTAINER ]
            </a>
          )}
          {selectedCell.id && (
            <a href="/yard-staff/movement-operations"
              className="w-full h-10 bg-purple-100 hover:bg-purple-200 text-purple-950 border-2 border-purple-400 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all">
              <span className="material-symbols-outlined text-sm">swap_horiz</span>
              [ TẠO LỆNH DI CHUYỂN ]
            </a>
          )}

          {!isMoveMode && selectedCell.id ? (
            <button onClick={() => { setIsMoveMode(true); showToast('📍 Chọn ô TRỐNG trên bản đồ làm vị trí đích mới!') }}
              className="w-full h-10 bg-orange-100 hover:bg-orange-200 text-orange-950 border-2 border-orange-400 font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all">
              <span className="material-symbols-outlined text-sm">near_me</span>
              [ CẬP NHẬT VỊ TRÍ ]
            </button>
          ) : isMoveMode && (
            <div className="space-y-2 bg-amber-50 p-3 rounded-xl border border-amber-300 text-xs font-bold">
              <div className="text-amber-950 font-sans">Từ: <strong>{selectedCell.block} {selectedCell.bay}-{selectedCell.row}-{selectedCell.tier}</strong></div>
              <div className="text-emerald-950 font-sans">Sang: <strong>{targetMoveCell ? `${targetMoveCell.block} ${targetMoveCell.bay}-${targetMoveCell.row}-${targetMoveCell.tier}` : 'Chưa chọn — click ô trống'}</strong></div>
              <input type="text" value={moveReasonInput} onChange={e => setMoveReasonInput(e.target.value)}
                placeholder="Lý do di chuyển..."
                className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs font-normal font-sans focus:outline-none" />
              <div className="flex gap-2">
                <button onClick={() => { setIsMoveMode(false); setTargetMoveCell(null) }} className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-100">Hủy</button>
                <button onClick={handleConfirmMove} disabled={!targetMoveCell}
                  className={`flex-1 py-2 rounded-lg font-black text-xs border ${targetMoveCell ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-emerald-400 cursor-pointer' : 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed'}`}>
                  Xác Nhận ✓
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen text-slate-900 relative">

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-amber-100 text-amber-950 border-2 border-amber-400 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-3 z-[100] animate-bounce">
          <span className="text-amber-600">●</span>{toastMessage}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1 text-xs font-mono">
              <span className="font-heading font-black text-orange-600">NEXUSPORT</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600 font-bold">Khai Thác Bãi</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-900 font-extrabold">Sơ Đồ Bãi 2D</span>
            </div>
            <div className="flex items-center gap-3">
              <h2 className="font-heading text-3xl font-black text-slate-900">Sơ Đồ Bãi 2D & Quản Lý Container</h2>
              <span className="px-3 py-1 bg-orange-100 text-orange-950 border-2 border-orange-400 font-mono font-black text-xs rounded-xl">BẢN ĐỒ 2D TRỰC QUAN</span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">Tra cứu Block ➔ Bay ➔ Row ➔ Tier, click ô để xem chi tiết, tạo lệnh di chuyển, xem sức chứa theo khu.</p>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <button onClick={() => setZoomLevel(p => Math.max(70, p - 10))} className="w-9 h-9 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl font-black flex items-center justify-center cursor-pointer">-</button>
            <span className="px-3 py-1 bg-slate-100 border border-slate-300 rounded-xl font-bold">{zoomLevel}%</span>
            <button onClick={() => setZoomLevel(p => Math.min(150, p + 10))} className="w-9 h-9 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl font-black flex items-center justify-center cursor-pointer">+</button>
            <button onClick={() => setZoomLevel(100)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl font-bold font-sans text-xs">Đặt Lại</button>
          </div>
        </div>

        {/* ── GLOBAL CAPACITY BAR ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          {[
            ['TỔNG SỨC CHỨA', globalStats.total + ' ô',    'text-slate-900', 'border-slate-200'],
            ['ĐANG SỬ DỤNG',  globalStats.used + ' ô',     'text-blue-900',  'border-blue-300'],
            ['CÒN TRỐNG',     globalStats.free + ' ô',     'text-emerald-900','border-emerald-300'],
            ['CÔNG SUẤT',     globalStats.pct + '%',       globalStats.pct > 80 ? 'text-red-900' : 'text-amber-900', globalStats.pct > 80 ? 'border-red-400' : 'border-amber-400'],
          ].map(([label, val, cls, border]) => (
            <div key={label} className={`bg-white p-3 rounded-xl border-2 ${border} space-y-1`}>
              <span className="text-[9px] text-slate-500 uppercase font-sans font-extrabold block">{label}</span>
              <strong className={`text-xl font-black block ${cls}`}>{val}</strong>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono font-bold text-slate-600">
            <span>Tổng Công Suất Bãi</span><span>{globalStats.pct}% — {globalStats.used}/{globalStats.total} ô</span>
          </div>
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${globalStats.pct > 90 ? 'bg-red-500' : globalStats.pct > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${globalStats.pct}%` }} />
          </div>
        </div>

        {/* ── SEARCH + FILTERS ── */}
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 Tìm Mã Container / Số Niêm Phong / Tên Tàu..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 uppercase font-black placeholder:normal-case placeholder:font-sans" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:outline-none">
              <option value="All">Loại Cont: Tất Cả</option>
              <option value="40FT HC">40FT HC</option>
              <option value="20FT ST">20FT ST</option>
              <option value="40FT RF">40FT RF</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-bold text-xs focus:outline-none">
              <option value="All">Trạng Thái: Tất Cả</option>
              {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 text-[10px] font-mono">
          <span className="font-sans font-extrabold text-slate-500 uppercase">CHÚ THÍCH:</span>
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <span key={k} className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1 ${v.bg}`}>
              {v.icon} {v.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── BLOCK TABS ── */}
      <div className="flex gap-2 flex-wrap">
        {['All', ...Object.keys(yardData)].map(tab => (
          <button key={tab} onClick={() => setActiveBlock(tab)}
            className={`px-5 py-2.5 rounded-xl font-black text-xs border-2 transition-all cursor-pointer ${
              activeBlock === tab
                ? 'bg-orange-600 text-white border-orange-700 shadow-md'
                : 'bg-white text-slate-700 border-slate-200 hover:border-orange-400 hover:text-orange-700'
            }`}>
            {tab === 'All' ? '🗺️ Toàn Bãi' : tab}
            {tab !== 'All' && blockStats[tab] && (
              <span className="ml-2 font-mono text-[10px]">
                {blockStats[tab].used}/{blockStats[tab].total}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── MAIN: MAP + SIDE PANEL ── */}
      <div className={`grid gap-6 ${selectedCell ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>

        {/* MAP GRID */}
        <div className={`bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-6 ${selectedCell ? 'lg:col-span-2' : 'col-span-1'}`}>
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600">grid_on</span>
              SƠ ĐỒ BÃI 2D TRỰC QUAN
            </h3>
            {isMoveMode && (
              <span className="px-3 py-1 bg-amber-100 text-amber-950 border border-amber-400 font-mono font-black text-xs rounded-full animate-pulse">
                📍 ĐANG CHỌN VỊ TRÍ ĐÍCH — CLICK Ô TRỐNG
              </span>
            )}
          </div>

          <div className="space-y-6 overflow-x-auto" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left' }}>
            {Object.entries(yardData)
              .filter(([name]) => activeBlock === 'All' || activeBlock === name)
              .map(([blockName, { totalSlots, cells }]) => {
                const bs = blockStats[blockName]
                // Group by bay
                const bays = [...new Set(cells.map(c => c.bay))]
                return (
                  <div key={blockName} className="bg-slate-100 p-5 rounded-2xl border-2 border-slate-300 space-y-4">
                    {/* Block Header with capacity */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-300 pb-3 gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-heading font-black text-slate-900 text-lg">{blockName}</span>
                        <span className={`px-2.5 py-0.5 rounded-full font-mono font-black text-[10px] border ${
                          bs.pct > 90 ? 'bg-red-100 text-red-950 border-red-400' :
                          bs.pct > 75 ? 'bg-amber-100 text-amber-950 border-amber-400' :
                          'bg-emerald-100 text-emerald-950 border-emerald-400'
                        }`}>{bs.pct}% SỬ DỤNG</span>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] font-mono">
                        <span className="text-slate-600">{bs.used} / {bs.total} ô · Còn trống: <strong className="text-emerald-700">{bs.free} ô</strong></span>
                        {/* Mini capacity bar */}
                        <div className="w-24 h-2 bg-slate-300 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${bs.pct > 90 ? 'bg-red-500' : bs.pct > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${bs.pct}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Bay grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {bays.map(bayName => {
                        const bayCells = cells.filter(c => c.bay === bayName)
                        return (
                          <div key={bayName} className="bg-white p-3 rounded-xl border border-slate-300 space-y-2">
                            <div className="text-center font-mono font-black text-xs text-slate-700 bg-slate-100 py-1.5 rounded border border-slate-200">
                              DÃY {bayName}
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {bayCells
                                .filter(cell => matchesFilters(cell))
                                .map(cell => {
                                  const isSearchHit = isMatchSearch(cell) && searchQuery.trim() !== ''
                                  const isSelected = selectedCell && selectedCell.block === blockName && selectedCell.bay === cell.bay && selectedCell.row === cell.row && selectedCell.tier === cell.tier
                                  const isMoveTarget = targetMoveCell && targetMoveCell.block === blockName && targetMoveCell.bay === cell.bay && targetMoveCell.row === cell.row && targetMoveCell.tier === cell.tier
                                  const cfg = STATUS_CFG[cell.status] || STATUS_CFG['Empty']
                                  // Special: empty but reserved for incoming
                                  const displayStatus = (cell.status === 'Empty' && cell.reservedForIncoming) ? 'Reserved' : cell.status
                                  const displayCfg = STATUS_CFG[displayStatus] || cfg

                                  return (
                                    <div key={`${cell.bay}-${cell.row}-${cell.tier}`}
                                      onClick={() => handleCellClick(blockName, cell)}
                                      className={`p-2 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between h-[88px] relative select-none
                                        ${displayCfg.bg}
                                        ${isSelected ? 'ring-4 ring-orange-500 scale-105 z-10 shadow-xl' : ''}
                                        ${isMoveTarget ? 'ring-4 ring-amber-400 animate-bounce' : ''}
                                        ${isSearchHit ? 'ring-4 ring-violet-500 animate-pulse' : ''}
                                        ${isMoveMode && cell.status === 'Empty' && !cell.reservedForIncoming ? 'hover:scale-105 hover:ring-2 hover:ring-emerald-400' : ''}
                                      `}>
                                      {/* Row/Tier label */}
                                      <div className="flex justify-between items-center text-[9px] font-mono font-black">
                                        <span>H{cell.row}-T{cell.tier}</span>
                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: displayCfg.dot?.replace('bg-', '') || '#94a3b8' }}>
                                          <span className={`block w-2 h-2 rounded-full ${displayCfg.dot || 'bg-slate-300'}`}></span>
                                        </span>
                                      </div>

                                      {/* Container ID or status */}
                                      <div className="flex-1 flex items-center justify-center">
                                        {cell.id ? (
                                          <span className="font-black text-[10px] leading-tight text-center break-all font-heading">{cell.id}</span>
                                        ) : cell.reservedForIncoming ? (
                                          <span className="text-[9px] text-amber-700 font-black text-center leading-tight">🔒 Đặt trước</span>
                                        ) : (
                                          <span className="text-[9px] text-slate-400 italic text-center">trống</span>
                                        )}
                                      </div>

                                      {/* Type badge */}
                                      {cell.type && cell.type !== 'EMPTY' && (
                                        <div className="text-[8px] font-mono font-bold text-center opacity-80 truncate">{cell.type}</div>
                                      )}
                                    </div>
                                  )
                                })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* SIDE PANEL */}
        {selectedCell && renderSidePanel()}
      </div>

    </div>
  )
}
