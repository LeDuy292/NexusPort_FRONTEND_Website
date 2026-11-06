import { useState, useEffect, useCallback } from 'react'
import yardSlotHistoryService from '../../services/yardSlotHistoryService'

export default function YardSlotHistoryModal({
  isOpen,
  onClose,
  initialSlotCode = '',
  initialSlotId = null,
  initialContainerNo = '',
  initialMode = 'slot', // 'slot' | 'container'
}) {
  const [mode, setMode] = useState(initialMode)
  const [slotCode, setSlotCode] = useState(initialSlotCode)
  const [containerNo, setContainerNo] = useState(initialContainerNo)
  const [searchInput, setSearchInput] = useState('')
  const [order, setOrder] = useState('DESC') // 'DESC' | 'ASC'
  const [page, setPage] = useState(1)
  const limit = 10

  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  // Sync props when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialContainerNo) {
        setMode('container')
        setContainerNo(initialContainerNo)
        setSearchInput(initialContainerNo)
      } else if (initialSlotCode) {
        setMode('slot')
        setSlotCode(initialSlotCode)
        setSearchInput(initialSlotCode)
      } else {
        setMode(initialMode || 'slot')
      }
      setPage(1)
      setError('')
    }
  }, [isOpen, initialSlotCode, initialContainerNo, initialMode])

  const fetchHistory = useCallback(async (targetPage = 1) => {
    setLoading(true)
    setError('')
    try {
      const params = {
        page: targetPage,
        limit,
        order,
      }

      if (mode === 'container') {
        const queryCont = (containerNo || searchInput).trim()
        if (queryCont) {
          params.containerNo = queryCont
        }
      } else {
        const querySlot = (slotCode || searchInput).trim()
        if (initialSlotId) {
          params.slotId = initialSlotId
        }
        if (querySlot) {
          params.slotCode = querySlot
        }
      }

      // If user typed in generic search
      if (!params.containerNo && !params.slotCode && !params.slotId && searchInput.trim()) {
        params.search = searchInput.trim()
      }

      const res = await yardSlotHistoryService.getHistory(params)
      setData(res)
    } catch (err) {
      setError(err.message || 'Không thể tải lịch sử vị trí.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [mode, slotCode, containerNo, searchInput, initialSlotId, order])

  // Fetch data on parameters change
  useEffect(() => {
    if (isOpen) {
      fetchHistory(page)
    }
  }, [isOpen, page, order, fetchHistory])

  // Handle Search Submit
  const handleSearch = (e) => {
    e?.preventDefault()
    setPage(1)
    if (mode === 'container') {
      setContainerNo(searchInput)
    } else {
      setSlotCode(searchInput)
    }
    fetchHistory(1)
  }

  // Handle Export CSV
  const handleExport = async () => {
    try {
      setExporting(true)
      const params = {}
      if (mode === 'container') {
        params.containerNo = (containerNo || searchInput).trim()
      } else {
        params.slotCode = (slotCode || searchInput).trim()
        if (initialSlotId) params.slotId = initialSlotId
      }
      if (searchInput.trim()) {
        params.search = searchInput.trim()
      }
      await yardSlotHistoryService.exportCsv(params)
    } catch (err) {
      alert(err.message || 'Lỗi khi xuất file báo cáo.')
    } finally {
      setExporting(false)
    }
  }

  if (!isOpen) return null

  const items = data?.items || []
  const pagination = data?.pagination || { page: 1, totalPages: 1, totalItems: 0 }
  const currentOccupant = items.find((i) => i.isCurrent)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-chalk flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-chalk flex items-center justify-between bg-gradient-to-r from-fog to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-signal-orange/10 flex items-center justify-center text-signal-orange">
              <span className="material-symbols-outlined text-2xl">timeline</span>
            </div>
            <div>
              <h2 id="modal-title" className="text-lg font-bold text-carbon">
                Lịch Sử Vị Trí Bãi & Timeline Container
              </h2>
              <p className="text-xs text-slate">
                Cảng Tiên Sa · Tra cứu vị trí từng lưu & container từng chiếm slot
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate hover:text-carbon hover:bg-chalk transition"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="p-6 pb-4 border-b border-chalk space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Mode Tabs */}
            <div className="inline-flex rounded-xl bg-fog p-1 border border-chalk text-xs font-bold">
              <button
                type="button"
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition ${
                  mode === 'slot'
                    ? 'bg-white text-signal-orange shadow-sm'
                    : 'text-slate hover:text-carbon'
                }`}
                onClick={() => {
                  setMode('slot')
                  setPage(1)
                }}
              >
                <span className="material-symbols-outlined text-sm">grid_view</span>
                Tra cứu theo Slot
              </button>
              <button
                type="button"
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition ${
                  mode === 'container'
                    ? 'bg-white text-signal-orange shadow-sm'
                    : 'text-slate hover:text-carbon'
                }`}
                onClick={() => {
                  setMode('container')
                  setPage(1)
                }}
              >
                <span className="material-symbols-outlined text-sm">inventory_2</span>
                Tra cứu theo Container
              </button>
            </div>

            {/* Quick Export Button */}
            <button
              type="button"
              disabled={exporting || items.length === 0}
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-forest-green hover:bg-forest-green/90 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              {exporting ? 'Đang xuất CSV…' : 'Xuất dữ liệu làm bằng chứng (CSV)'}
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate text-sm">
                search
              </span>
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-chalk bg-fog text-xs font-semibold text-carbon outline-none focus:border-signal-orange focus:bg-white transition"
                placeholder={
                  mode === 'slot'
                    ? 'Nhập mã slot (VD: C01.12.01.1, C01-06-01-1, A01.01.01.1)...'
                    : 'Nhập số Container (VD: HLCU7719204, EMCU8361795, CAIU...)...'
                }
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-signal-orange text-white text-xs font-bold hover:bg-signal-orange/90 transition shadow-sm disabled:opacity-50"
            >
              {loading ? 'Đang tìm…' : 'Tìm kiếm'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOrder((o) => (o === 'DESC' ? 'ASC' : 'DESC'))
                setPage(1)
              }}
              className="px-3.5 py-2.5 rounded-xl border border-chalk bg-white hover:bg-fog text-xs font-bold text-slate hover:text-carbon transition flex items-center gap-1.5"
              title="Đổi thứ tự thời gian"
            >
              <span className="material-symbols-outlined text-sm">swap_vert</span>
              {order === 'DESC' ? 'Mới nhất trước' : 'Cũ nhất trước'}
            </button>
          </form>

          {/* Quick Summary Strip */}
          {items.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-2xl bg-fog border border-chalk">
                <span className="text-[10px] uppercase font-bold text-slate block tracking-wider">
                  {mode === 'slot' ? 'VỊ TRÍ SLOT' : 'SỐ CONTAINER'}
                </span>
                <span className="text-sm font-bold text-carbon">
                  {mode === 'slot'
                    ? items[0]?.slot?.slotCode || 'Slot đã chọn'
                    : items[0]?.container?.containerNo || 'Container đã chọn'}
                </span>
                <span className="text-[11px] text-slate block">
                  {mode === 'slot' ? items[0]?.slot?.blockName : `Loại: ${items[0]?.container?.cargoType || 'Chuẩn'}`}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-fog border border-chalk">
                <span className="text-[10px] uppercase font-bold text-slate block tracking-wider">
                  TRẠNG THÁI HIỆN TẠI
                </span>
                {currentOccupant ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {mode === 'slot'
                      ? `Đang chứa Cont ${currentOccupant.container.containerNo}`
                      : `Đang lưu tại ${currentOccupant.slot.slotCode}`}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate mt-0.5 block">
                    {mode === 'slot' ? 'Vị trí hiện đang trống' : 'Đã xuất cảng / không ở bãi'}
                  </span>
                )}
                <span className="text-[11px] text-slate block">
                  {currentOccupant ? `Thời lượng: ${currentOccupant.duration}` : 'Chưa có lượt mới'}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-fog border border-chalk">
                <span className="text-[10px] uppercase font-bold text-slate block tracking-wider">
                  TỔNG LƯỢT LƯU BÃI
                </span>
                <span className="text-sm font-bold text-signal-orange">
                  {pagination.totalItems} lượt ghi nhận
                </span>
                <span className="text-[11px] text-slate block">
                  Hiển thị {items.length} lượt trên trang này
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Content Body / Timeline */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate">
              <div className="w-8 h-8 border-3 border-signal-orange border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-xs font-medium">Đang tải timeline lịch sử bãi…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-slate space-y-2">
              <span className="material-symbols-outlined text-4xl block text-chalk">
                history_toggle_off
              </span>
              <p className="text-sm font-bold text-carbon">Không tìm thấy dữ liệu lịch sử</p>
              <p className="text-xs max-w-sm mx-auto">
                Không có dữ liệu lượt bãi nào phù hợp với điều kiện tìm kiếm. Hãy kiểm tra lại mã
                slot hoặc số container.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-8 border-l-2 border-chalk/80 space-y-8 my-2">
              {items.map((item, idx) => {
                const isCurrent = item.isCurrent
                return (
                  <div key={item.id || idx} className="relative group">
                    {/* Timeline Node Dot */}
                    <div
                      className={`absolute -left-[31px] sm:-left-[39px] top-1.5 w-5 h-5 rounded-full border-4 border-white transition shadow-sm ${
                        isCurrent
                          ? 'bg-emerald-500 ring-4 ring-emerald-100 scale-110'
                          : 'bg-slate/40 group-hover:bg-signal-orange'
                      }`}
                    ></div>

                    {/* Timeline Event Card */}
                    <div
                      className={`p-5 rounded-2xl border transition shadow-sm ${
                        isCurrent
                          ? 'bg-white border-emerald-300 ring-1 ring-emerald-100'
                          : 'bg-white hover:bg-fog border-chalk'
                      }`}
                    >
                      {/* Top status bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-chalk/70">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isCurrent
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate/10 text-slate'
                            }`}
                          >
                            {isCurrent ? '● Đang chiếm slot (Hiện tại)' : '○ Đã rời slot'}
                          </span>
                          <span className="text-xs font-bold text-slate">
                            Lượt #{item.index}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate">
                          <span className="material-symbols-outlined text-sm text-signal-orange">
                            schedule
                          </span>
                          <span>Thời lượng lưu: </span>
                          <strong className="text-carbon">{item.duration}</strong>
                        </div>
                      </div>

                      {/* Main Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        {/* Container Info */}
                        <div className="space-y-1.5 p-3 rounded-xl bg-fog/60 border border-chalk/60">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate uppercase text-[10px]">
                              Container
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white font-mono text-[11px] font-bold text-signal-orange border border-chalk">
                              {item.container?.sizeFt}FT
                            </span>
                          </div>
                          <p className="text-sm font-bold font-mono text-carbon">
                            {item.container?.containerNo}
                          </p>
                          <div className="text-[11px] text-slate space-y-0.5">
                            <p>
                              Loại hàng:{' '}
                              <span className="font-semibold text-carbon">
                                {item.container?.cargoType || 'Chuẩn'}
                              </span>
                            </p>
                            {item.container?.sealNo && (
                              <p>
                                Số chì (Seal):{' '}
                                <span className="font-mono text-carbon">
                                  {item.container.sealNo}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Slot Position Info */}
                        <div className="space-y-1.5 p-3 rounded-xl bg-fog/60 border border-chalk/60">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate uppercase text-[10px]">
                              Vị trí bãi (Slot)
                            </span>
                            {item.slot?.hasReeferPlug && (
                              <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 font-bold text-[10px] border border-cyan-200 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-xs">power</span>
                                Reefer
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-carbon">{item.slot?.slotCode}</p>
                          <p className="text-[11px] text-slate font-medium">
                            {item.slot?.slotLabel}
                          </p>
                        </div>
                      </div>

                      {/* Times & Performer Footer */}
                      <div className="mt-4 pt-3 border-t border-chalk/70 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                        {/* Start and End Times */}
                        <div className="flex flex-wrap items-center gap-4 text-slate">
                          <div>
                            <span className="text-[10px] uppercase font-bold block text-slate/70">
                              Bắt đầu chiếm Slot:
                            </span>
                            <span className="font-semibold text-carbon">
                              {item.placedAt
                                ? new Date(item.placedAt).toLocaleString('vi-VN')
                                : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold block text-slate/70">
                              Rời Slot:
                            </span>
                            <span
                              className={`font-semibold ${
                                isCurrent ? 'text-emerald-600' : 'text-carbon'
                              }`}
                            >
                              {item.removedAt
                                ? new Date(item.removedAt).toLocaleString('vi-VN')
                                : 'Chưa rời (Đang lưu)'}
                            </span>
                          </div>
                        </div>

                        {/* Changed By / Performer */}
                        <div className="flex items-center gap-2 pl-3 border-l border-chalk">
                          <div className="w-7 h-7 rounded-full bg-signal-orange/10 flex items-center justify-center text-signal-orange">
                            <span className="material-symbols-outlined text-xs">person</span>
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-bold text-carbon">
                              {item.placedBy?.fullName || 'Điều phối viên Bãi'}
                            </p>
                            <p className="text-[10px] text-slate">
                              {item.placedBy?.role || 'Yard Staff'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer / Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-chalk bg-fog flex items-center justify-between text-xs">
            <span className="text-slate">
              Trang <strong>{pagination.page}</strong> / <strong>{pagination.totalPages}</strong>{' '}
              (Tổng số {pagination.totalItems} lượt)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!pagination.hasPrev || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-chalk bg-white text-carbon font-bold hover:bg-chalk transition disabled:opacity-40"
              >
                Trang trước
              </button>
              <button
                type="button"
                disabled={!pagination.hasNext || loading}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-chalk bg-white text-carbon font-bold hover:bg-chalk transition disabled:opacity-40"
              >
                Trang sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

