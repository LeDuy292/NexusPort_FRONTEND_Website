import { useState, useMemo, useEffect } from 'react'
import apiClient from '../../services/apiClient'
import { yardReservationStore } from '../../services/yardReservationStore'
import tienSaLayout from '../../features/yard-design/tienSaLayout.json'

// Định nghĩa 7 Phân Khu Chuẩn Cảng Tiên Sa (Zone A ➔ G) theo đúng ảnh thiết kế nghiệp vụ
export const TIEN_SA_ZONES = [
  {
    code: 'A',
    label: 'Khu A',
    subtitle: 'Sau cầu 4–5',
    blockCount: 4,
    blockPrefix: 'A',
    description: 'Bãi container tiếp giáp bến số 4 & 5',
    defaultTag: 'Hàng Nhập Bến 4-5'
  },
  {
    code: 'B',
    label: 'Khu B',
    subtitle: 'Bãi container 1',
    blockCount: 4,
    blockPrefix: 'B',
    description: 'Bãi sát mép nước cầu tàu STS',
    defaultTag: 'Hàng Nhập STS'
  },
  {
    code: 'C',
    label: 'Khu C',
    subtitle: 'Bãi container 2',
    blockCount: 10,
    blockPrefix: 'C',
    description: 'Khu tập kết container khô trung tâm',
    defaultTag: 'Bãi Container Khô'
  },
  {
    code: 'D',
    label: 'Khu D',
    subtitle: 'Bãi cont lạnh (Reefer)',
    blockCount: 2,
    blockPrefix: 'D',
    description: 'Bãi chuyên dụng container lạnh có trụ cắm điện 380V/440V',
    defaultTag: 'Khu Cont Lạnh'
  },
  {
    code: 'E',
    label: 'Khu E',
    subtitle: 'Bãi tổng hợp 1',
    blockCount: 4,
    blockPrefix: 'E',
    description: 'Bãi tổng hợp và phân loại hàng nguy hiểm (DG)',
    defaultTag: 'Bãi Tổng Hợp & DG'
  },
  {
    code: 'F',
    label: 'Khu F',
    subtitle: 'Bãi tổng hợp 2',
    blockCount: 4,
    blockPrefix: 'F',
    description: 'Bãi hàng xuất gần cổng Gate 1',
    defaultTag: 'Hàng Xuất Cổng 1'
  },
  {
    code: 'G',
    label: 'Khu G',
    subtitle: 'Bãi tổng hợp 3',
    blockCount: 4,
    blockPrefix: 'G',
    description: 'Bãi container rỗng và lưu kho phụ trợ',
    defaultTag: 'Bãi Cont Rỗng'
  }
]

export default function YardZoneBlockSelectorModal({
  isOpen,
  onClose,
  container,
  currentSlot,
  onSelectBlock
}) {
  if (!isOpen) return null

  // Nhận diện Khu mặc định dựa theo vị trí đang có hoặc loại container
  const initialZoneCode = useMemo(() => {
    if (currentSlot) {
      const bCode = currentSlot.split('-')[0].trim().toUpperCase()
      const firstChar = bCode[0]
      if (['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(firstChar)) return firstChar
    }
    // Nếu là cont lạnh -> Khu D
    const isRf = container?.isReefer || /RF|RH|R[01]/.test(container?.isoType || container?.containerType || '')
    if (isRf) return 'D'
    // Nếu là cont xuất -> Khu F
    if (container?.direction === 'EXPORT') return 'F'
    // Mặc định Khu A
    return 'A'
  }, [currentSlot, container])

  const [selectedZone, setSelectedZone] = useState(initialZoneCode)

  // Danh sách các block thực tế từ Bản đồ Cảng Tiên Sa
  const allBlocks = useMemo(() => {
    const rawAreas = tienSaLayout.areas || tienSaLayout.blocks || []
    return rawAreas.map(a => {
      const code = a.code || a.blockCode
      const rows = a.planning?.rows || 6
      const tiers = a.planning?.tiers || 4
      const modules = a.planning?.bayModules || 28
      const capacity = modules * rows * tiers
      return {
        blockCode: code,
        code,
        zone: a.zone || code[0],
        zonePrefix: code[0],
        maxRows: rows,
        maxTiers: tiers,
        bayModules: modules,
        capacity,
        planning: a.planning || { bayModules: modules, rows, tiers },
        note: a.note || ''
      }
    })
  }, [])

  // Hiện trạng bãi THẬT: số ô đang có container / đã giữ chỗ trên từng block (từ sơ đồ bãi)
  const [liveStats, setLiveStats] = useState(null)
  useEffect(() => {
    if (!isOpen) return undefined
    let alive = true
    apiClient.get('/yard/layout')
      .then((res) => {
        if (!alive) return
        const stats = {}
        ;(res.data?.data?.slots || []).forEach((sl) => {
          const code = String(sl.block || '').toUpperCase()
          if (!code) return
          const st = (stats[code] ||= { total: 0, used: 0, containers: 0 })
          st.total += 1
          if (sl.containerNumber || sl.status === 'occupied' || sl.status === 'reserved') st.used += 1
          if (sl.containerNumber) st.containers += 1
        })
        setLiveStats(stats)
      })
      .catch(() => { if (alive) setLiveStats(null) })
    return () => { alive = false }
  }, [isOpen])

  // Lấy các block thuộc phân khu đang chọn (ví dụ Khu A có A01, A02, A03, A04)
  const blocksInSelectedZone = useMemo(() => {
    const filtered = allBlocks.filter(b => b.zonePrefix === selectedZone)
    if (filtered.length > 0) return filtered

    // Fallback nếu layout chưa đủ block
    const zoneDef = TIEN_SA_ZONES.find(z => z.code === selectedZone)
    const count = zoneDef?.blockCount || 4
    const res = []
    for (let i = 1; i <= count; i++) {
      const code = `${selectedZone}${String(i).padStart(2, '0')}`
      res.push({
        blockCode: code,
        code,
        zonePrefix: selectedZone,
        maxRows: 6,
        maxTiers: 4,
        bayModules: 28,
        capacity: 28 * 6 * 4,
        planning: { bayModules: 28, rows: 6, tiers: 4 }
      })
    }
    return res
  }, [allBlocks, selectedZone])

  // Format toạ độ đang xếp chỗ
  const currentSlotDisplay = useMemo(() => {
    if (!currentSlot) {
      return {
        text: 'Chưa xếp vị trí bãi',
        posCode: 'CHƯA GÁN',
        tag: 'Chờ phân bổ'
      }
    }
    const parts = currentSlot.split('-')
    const b = parts[0] || 'A01'
    const bay = parts[1] || '01'
    const row = parts[2] ? parts[2].replace(/[^0-9]/g, '') : '01'
    const tier = parts[3] ? parts[3].replace(/[^0-9]/g, '') : '1'
    
    const isRf = container?.isReefer || /RF|RH/.test(container?.isoType || '')
    let tag = isRf ? 'Khu Cont Lạnh' : (b.startsWith('F') ? 'Hàng Xuất Gần Cổng' : (b.startsWith('B') ? 'Hàng Nhập STS' : 'Bãi Container Thường'))
    
    return {
      text: `Block ${b} • Bay ${Number(bay)} • Tầng ${tier} • Hàng ${Number(row)}`,
      posCode: `POS: ${currentSlot}`,
      tag
    }
  }, [currentSlot, container])

  const contNo = container?.containerNumber || container?.containerId || 'HAMU9350051'

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white w-full max-w-5xl rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 border border-slate-200 max-h-[92vh] overflow-y-auto">
        
        {/* ── HEADER ── */}
        <div className="flex justify-between items-start pb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
              <span className="material-symbols-outlined text-2xl">grid_view</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">
                Sơ Đồ Phân Khu Bãi Container Tiên Sa
              </h2>
              <p className="text-xs text-slate-500">
                Tự động chọn khu theo loại cont và mở sơ đồ Bay &amp; Slot để đổi vị trí
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* ── BANNER VỊ TRÍ BÃI ĐANG XẾP CHỖ (Chuẩn ảnh người dùng gửi) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[#ecfdf5] border border-[#a7f3d0] text-emerald-950 shadow-2xs">
          <div>
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
              VỊ TRÍ BÃI ĐANG XẾP CHỖ CHO CONT {contNo}:
            </span>
            <div className="font-mono font-bold text-sm sm:text-base text-slate-900 mt-0.5 flex flex-wrap items-center gap-2">
              <span>{currentSlotDisplay.text}</span>
              <span className="text-xs text-emerald-700 font-semibold">({currentSlotDisplay.posCode})</span>
            </div>
          </div>

          <span className="px-3.5 py-1 rounded-full bg-white border border-emerald-300 text-xs font-bold text-emerald-800 shadow-2xs self-start sm:self-center shrink-0">
            {currentSlotDisplay.tag}
          </span>
        </div>

        {/* ── MỤC 1: CHỌN PHÂN KHU BÃI CẢNG TIÊN SA (ZONE A ➔ G) ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-black flex items-center justify-center">
              1
            </span>
            <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
              CHỌN PHÂN KHU BÃI CẢNG TIÊN SA (ZONE A ➔ G):
            </span>
          </div>

          {/* Hàng các Thẻ Phân Khu Zone */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            {TIEN_SA_ZONES.map(z => {
              const isSelected = selectedZone === z.code
              return (
                <button
                  key={z.code}
                  type="button"
                  onClick={() => setSelectedZone(z.code)}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer relative shadow-2xs ${
                    isSelected
                      ? 'bg-[#fff7ed] border-[#f97316] text-[#c2410c] ring-2 ring-orange-400/30'
                      : 'bg-white border-slate-200/90 text-slate-700 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-black text-sm ${isSelected ? 'text-orange-700' : 'text-slate-900'}`}>
                      {z.label}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${
                      isSelected ? 'bg-orange-100 border-orange-300 text-orange-800' : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      {z.blockCount}
                    </span>
                  </div>
                  <span className={`text-[11px] leading-tight ${isSelected ? 'text-orange-900 font-medium' : 'text-slate-500'}`}>
                    {z.subtitle}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── MỤC 2: CÁC BLOCK THUỘC KHU ĐANG CHỌN (Grid 4 cột chuẩn hình) ── */}
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-black flex items-center justify-center">
              2
            </span>
            <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
              CÁC BLOCK THUỘC KHU {selectedZone}:
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {blocksInSelectedZone.map(b => {
              const live = liveStats ? liveStats[String(b.blockCode).toUpperCase()] : null
              const capacity = live?.total || b.capacity || (b.bayModules * b.maxRows * b.maxTiers) || 672
              const occupied = live ? live.used : null
              const freeSlots = occupied == null ? null : Math.max(0, capacity - occupied)

              return (
                <div
                  key={b.blockCode}
                  className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-heading font-black text-slate-900 text-base">
                        Block {b.blockCode}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-bold text-[11px]">
                        {freeSlots == null ? 'Đang tải…' : `${freeSlots.toLocaleString('vi-VN')} ô trống`}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1.5 font-medium">
                      Tổng {capacity.toLocaleString('vi-VN')} ô · Đang dùng {occupied == null ? '—' : occupied.toLocaleString('vi-VN')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectBlock?.(b)
                    }}
                    className="mt-4 w-full py-2 px-3 bg-[#0f172a] hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    <span>Chọn Bay &amp; Slot ➔</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── FOOTER: NÚT ĐÓNG ── */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-[#0f172a] hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs active:scale-98"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  )
}
