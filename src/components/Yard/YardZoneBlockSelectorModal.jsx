import { useState, useMemo } from 'react'
import { zoneViolation } from '../../features/yard-design/zoneRules'
import TienSaMap from '../../features/yard-design/TienSaMap'
import '../../features/yard-design/TienSaMap.css'
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
    description: 'Bãi gần cầu 4–5 (A01–A04 ưu tiên hàng xuất)',
    defaultTag: 'Hàng Xuất Gần Cầu 4–5'
  },
  {
    code: 'B',
    label: 'Khu B',
    subtitle: 'Bãi container 1',
    blockCount: 4,
    blockPrefix: 'B',
    description: 'B01–B02 sát mép nước cầu 1 (Xuất); B03–B04 bãi trong (Nhập)',
    defaultTag: 'B01–B02 Xuất Cầu 1 · B03–B04 Nhập'
  },
  {
    code: 'C',
    label: 'Khu C',
    subtitle: 'Bãi container 2',
    blockCount: 10,
    blockPrefix: 'C',
    description: 'C01–C03 gần cầu 2 (Xuất); C04–C10 bãi trong (Nhập)',
    defaultTag: 'C01–C03 Xuất Cầu 2 · C04–C10 Nhập'
  },
  {
    code: 'D',
    label: 'Khu D',
    subtitle: 'Bãi cont lạnh (Reefer)',
    blockCount: 2,
    blockPrefix: 'D',
    description: 'Bãi chuyên dụng container lạnh có trụ cắm điện 380V/440V',
    defaultTag: 'Khu Cont Lạnh (D01–D02)'
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
    description: 'Bãi hàng nhập gần cổng Gate 1 giao nhận xe ngoài',
    defaultTag: 'Hàng Nhập Gần Cổng 1'
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
    // Xuất khẩu: các dãy gần cầu (A01-A04, B01-B02, C01-C03); Nhập khẩu: các block bãi trong (B03-B04, C04-C10)
    const isImp = container?.direction === 'IMPORT' || String(container?.direction || '').toLowerCase().includes('nhập')
    if (isImp) return 'C'
    return 'B'
  }, [currentSlot, container])

  const [selectedZone, setSelectedZone] = useState(initialZoneCode)
  // Quy tắc phân khu: cont lạnh chỉ vào khu lạnh, cont thường không vào khu lạnh
  const [zoneWarning, setZoneWarning] = useState('')

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

  // Đếm số container đang lưu thực tế từ yardReservationStore theo từng Block
  const blockOccupancy = useMemo(() => {
    const res = yardReservationStore.getReservationsSync()
    const counts = {}
    res.forEach(r => {
      const b = (r.blockCode || r.block || '').trim().toUpperCase()
      if (b) {
        counts[b] = (counts[b] || 0) + 1
      }
    })
    return counts
  }, [isOpen])

  // Highlight blocks trên bản đồ Tiên Sa theo Zone đang chọn
  const highlightBlocks = useMemo(() => {
    const map = {}
    allBlocks.forEach(b => {
      const isSelectedZone = b.zonePrefix === selectedZone
      const occupied = blockOccupancy[b.blockCode] || 0
      if (isSelectedZone) {
        map[b.blockCode] = {
          count: occupied,
          color: '#f59e0b'
        }
      } else if (occupied > 0) {
        map[b.blockCode] = {
          count: occupied,
          color: '#38bdf8'
        }
      }
    })
    return map
  }, [allBlocks, selectedZone, blockOccupancy])
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
    const exportBlocks = ['A01', 'A02', 'A03', 'A04', 'B01', 'B02', 'C01', 'C02', 'C03']
    const isExp = exportBlocks.includes(b)
    let tag = isRf ? 'Khu Cont Lạnh (D01-D02)' : (isExp ? 'Hàng Xuất (Gần Cầu Tàu)' : 'Hàng Nhập (Bãi Trong)')
    
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
      <div className="bg-white w-[96vw] max-w-[1550px] h-[94vh] max-h-[94vh] rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-3.5 border border-slate-200 overflow-hidden">
        
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

        {/* ── BẢN ĐỒ BÃI CẢNG TIÊN SA TRỰC QUAN: NHẤP TRỰC TIẾP VÀO BLOCK ĐỂ CHỌN BAY & SLOT ── */}
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <div className="flex flex-wrap items-center justify-between text-xs font-black text-slate-900 uppercase tracking-wide gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600 text-lg">map</span>
              <span>BẢN ĐỒ CẢNG TIÊN SA · NHẤP TRỰC TIẾP VÀO BLOCK ĐỂ CHỌN BAY &amp; SLOT:</span>
            </div>
            <span className="text-[11px] font-medium text-slate-500 normal-case">
              (Nhấp vào bất kỳ Block nào trên bản đồ để mở ngay sơ đồ chọn Bay &amp; Slot của Block đó)
            </span>
          </div>

          {zoneWarning && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-800">{zoneWarning}</div>
          )}

          <div className="yard-design-preview flex-1 min-h-0 rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-50 flex flex-col [&_.tien-sa-design-map]:flex-1 [&_.tien-sa-design-map]:flex [&_.tien-sa-design-map]:flex-col [&_.yard-layout-viewport]:!flex-1 [&_.yard-layout-viewport]:!h-full [&_.yard-layout-viewport]:!min-h-[500px] sm:[&_.yard-layout-viewport]:!min-h-[600px] [&_.yard-map-controls]:!py-2 [&_.yard-map-controls]:!px-3 [&_.yard-layout-legend]:!py-1.5 [&_.yard-layout-legend]:!px-3">
            <TienSaMap
              layout={tienSaLayout}
              selectedCode={currentSlot?.split('-')[0]?.trim()}
              onSelectArea={(area) => {
                const targetBlock = allBlocks.find(b => b.blockCode === area.code) || area
                const violation = zoneViolation(container, targetBlock.blockCode || targetBlock.code || area.code)
                if (violation) { setZoneWarning(violation); return }
                setZoneWarning('')
                onSelectBlock?.(targetBlock)
              }}
              highlightBlocks={highlightBlocks}
              operational={true}
            />
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
