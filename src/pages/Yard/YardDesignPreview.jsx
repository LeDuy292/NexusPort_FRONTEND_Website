import { useEffect, useMemo, useRef, useState } from 'react'
import TienSaMap from '../../features/yard-design/TienSaMap'
import sourceLayout from '../../features/yard-design/tienSaLayout.json'
import { cleanDesign } from '../../features/yard-design/geometry'
import BlockDetail from '../../features/yard-design/BlockDetail'
import operationalPlan from '../../features/yard-design/operationalPlan.json'
import expressApiClient from '../../services/expressApiClient'
import YardSlotHistoryModal from '../../components/Yard/YardSlotHistoryModal'
import ContainerYardDetailModal from '../../components/Yard/ContainerYardDetailModal'
import { yardReservationStore } from '../../services/yardReservationStore'
import { padPosition } from '../../features/yard-design/positions'
import '../../features/yard-design/YardDesignPreview.css'

export default function YardDesignPreview({ previewOnly = false }) {
  const pageRoot = useRef(null)
  const layout = useMemo(() => cleanDesign(sourceLayout), [])
  const [detail, setDetail] = useState(false)
  const [code, setCode] = useState('')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [inventory, setInventory] = useState(null)
  const [inventoryError, setInventoryError] = useState('')

  // State quản lý Modal tra cứu lịch sử Slot & Container
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    mode: 'slot',
    slotCode: '',
    slotId: null,
    containerNo: '',
  })

  // State quản lý Modal thông tin chi tiết Container bãi
  const [containerModal, setContainerModal] = useState({
    isOpen: false,
    data: null,
  })

  // Đồng bộ danh sách giữ chỗ từ Gate Booking sang Sơ đồ bãi Tiên Sa
  const [localReservations, setLocalReservations] = useState(() => yardReservationStore.getReservations())

  useEffect(() => {
    const handleUpdate = () => {
      setLocalReservations(yardReservationStore.getReservations())
    }
    window.addEventListener('yard-reservation-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('yard-reservation-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  useEffect(() => {
    if (previewOnly) return
    let active = true, pending = false
    const refresh = async () => {
      if (pending || document.hidden) return
      pending = true
      try {
        const snapshot = await expressApiClient.get('/yard/layout')
        if (snapshot.terminalPlan?.version !== operationalPlan.version)
          throw Error('Tồn kho chưa khớp phiên bản mặt bằng này.')
        if (active) {
          setInventory(snapshot)
          setInventoryError('')
        }
      } catch (error) {
        if (active) setInventoryError(error.message || 'Không tải được tồn kho.')
      } finally {
        pending = false
      }
    }
    void refresh()
    const timer = setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [previewOnly])

  useEffect(() => {
    if (detail) pageRoot.current?.closest('main')?.scrollTo({ top: 0 })
  }, [code, detail])

  const selected = layout.areas.find((area) => area.code === code)

  // Gộp dữ liệu tồn kho API Backend với danh sách đã Giữ chỗ
  const mergedInventorySlots = useMemo(() => {
    if (!selected) return []
    const backendSlots = inventory?.slots?.filter((slot) => slot.block === selected.code) || []

    const blockRes = localReservations.filter((r) => r.blockCode === selected.code)
    if (blockRes.length === 0) return backendSlots

    // 1 container chỉ nằm ở 1 vị trí: Lọc trùng giữ lại đặt chỗ mới nhất
    const seen = new Set()
    const uniqueRes = []
    for (let i = blockRes.length - 1; i >= 0; i--) {
      const r = blockRes[i]
      const key = (r.containerNo || r.containerId || r.bookingCode || '').trim().toUpperCase()
      if (key && !seen.has(key)) {
        seen.add(key)
        uniqueRes.unshift(r)
      }
    }

    const syntheticSlots = uniqueRes.map((r) => {
      const size = Number(r.size) || 40
      const bayNum = Number(r.bay)
      const moduleStart = size === 40 ? Math.floor(bayNum / 2) : Math.ceil(bayNum / 2)
      return {
        id: `res-${r.posId || r.slotId || bayNum}`,
        block: r.blockCode,
        bay: bayNum,
        row: Number(r.row),
        tier: Number(r.tier),
        moduleStart: Math.max(1, moduleStart),
        moduleSpan: size === 40 ? 2 : 1,
        containerLengthFt: size,
        status: 'reserved',
        containerNumber: r.containerNo || r.containerId || 'CONT',
        reservedContainerNumber: r.containerNo || r.containerId || 'CONT',
        bookingDetails: r.booking || {},
        bookingCode: r.bookingCode || r.booking?.id,
        vehiclePlate: r.vehiclePlate || r.booking?.licensePlate,
        driverName: r.driverName || r.booking?.driverName,
        company: r.company || r.booking?.company,
        coveredBays: r.coveredBays || [],
        slotCode: r.posCode || `${r.blockCode}.${padPosition(bayNum)}.${padPosition(r.row)}.${r.tier}`,
      }
    })

    const filteredBackend = backendSlots.filter((bs) => {
      return !syntheticSlots.some((ss) => {
        if (Number(ss.row) !== Number(bs.row) || Number(ss.tier) !== Number(bs.tier)) {
          return false
        }
        if (Number(ss.bay) === Number(bs.bay)) return true
        if (ss.moduleSpan === 2) {
          const coveredBay1 = (ss.moduleStart - 1) * 2 + 1
          const coveredBay2 = (ss.moduleStart - 1) * 2 + 3
          if (Number(bs.bay) === coveredBay1 || Number(bs.bay) === coveredBay2) {
            return true
          }
        }
        return false
      })
    })

    // syntheticSlots (vị trí giữ chỗ mới nhất) có ưu tiên cao nhất
    return [...syntheticSlots, ...filteredBackend]
  }, [selected, inventory, localReservations])
  const choose = (area) => {
    setCode(area.code)
    setDetail(true)
    setMessage('')
  }

  function search(event) {
    event.preventDefault()
    const raw = query.trim()
    if (!raw) return

    // 1. Nếu là dạng mã Slot (VD: C01.12.01.1 hoặc C01-06-01-1)
    if (/[.-_/s]/.test(raw) && raw.split(/[.-_/s]+/).length >= 3) {
      setHistoryModal({
        isOpen: true,
        mode: 'slot',
        slotCode: raw.toUpperCase(),
        slotId: null,
        containerNo: '',
      })
      setMessage(`Đang mở lịch sử vị trí slot ${raw}…`)
      return
    }

    // 2. Nếu là số Container (4 chữ cái + số hoặc từ 7 ký tự)
    const upper = raw.toUpperCase().replace(/^CONTs*/, '')
    if (/^[A-Z]{3,4}[0-9]{4,}/.test(upper) || upper.length >= 8) {
      setHistoryModal({
        isOpen: true,
        mode: 'container',
        slotCode: '',
        slotId: null,
        containerNo: upper,
      })
      setMessage(`Đang mở lịch sử di chuyển container ${upper}…`)
      return
    }

    // 3. Nếu là tìm Block thông thường
    const term = upper.replace(/^BLOCK\s*/, '')
    const area = layout.areas.find((item) => item.code === term)
    if (area) {
      choose(area)
      return
    }
    setMessage('Không tìm thấy block, slot hoặc container này.')
  }

  const handleOpenHistory = (historyParams) => {
    setHistoryModal({
      isOpen: true,
      mode: historyParams.mode || 'slot',
      slotCode: historyParams.slotCode || '',
      slotId: historyParams.slotId || null,
      containerNo: historyParams.containerNo || '',
    })
  }

  return (
    <div ref={pageRoot} className="yard-design-preview">
      <div className="yard-map-page">
        <header className="yard-page-heading">
          <div>
            <h1>Bản đồ bãi container</h1>
            <p>Cảng Tiên Sa · Giám sát & Tra cứu vị trí</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-signal-orange text-white text-xs font-bold shadow-sm hover:bg-signal-orange/90 transition cursor-pointer"
              onClick={() =>
                setHistoryModal({
                  isOpen: true,
                  mode: 'container',
                  slotCode: '',
                  slotId: null,
                  containerNo: '',
                })
              }
            >
              <span className="material-symbols-outlined text-sm">timeline</span>
              Tra cứu Lịch sử Slot & Cont
            </button>
            <form className="yard-map-search" onSubmit={search}>
              <label className="yard-sr-only" htmlFor="design-map-search">
                Tìm block, slot hoặc container
              </label>
              <input
                id="design-map-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Block (A01, B02) hoặc Cont (HLCU...)..."
              />
              <button type="submit">Tìm</button>
            </form>
          </div>
        </header>

        {message && (
          <p className="yard-page-message" role="status">
            {message}
          </p>
        )}

        {!previewOnly && (
          <p className="yard-page-message" role="status">
            {inventoryError
              ? `${inventoryError}${inventory ? ' · Đang hiển thị lần cập nhật gần nhất.' : ''}`
              : inventory
              ? `${inventory.slots.filter((s) => s.containerId).length} container đang lưu bãi · ${
                  inventory.slots.filter((s) => s.status === 'reserved').length
                } vị trí đã giữ · Cập nhật ${new Date(inventory.generatedAt).toLocaleTimeString(
                  'vi-VN'
                )}`
              : 'Đang tải tồn kho…'}
          </p>
        )}

        <div hidden={detail}>
          <TienSaMap layout={sourceLayout} selectedCode={code} onSelectArea={choose} />
        </div>

        {detail && selected && (
          <BlockDetail
            key={selected.code}
            area={selected}
            inventorySlots={mergedInventorySlots}
            maxModules={Math.max(...layout.areas.map((area) => area.planning.bayModules))}
            onBack={() => setDetail(false)}
            onOpenHistory={handleOpenHistory}
            onOpenContainerDetail={(contData) => {
              setContainerModal({ isOpen: true, data: contData })
            }}
          />
        )}

        <div className="yard-selection-strip" aria-live="polite">
          {selected ? (
            <>
              <strong>Block {selected.code}</strong>
              <span>
                {layout.sectors.find((sector) => sector.code === selected.sector)?.label}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCode('')
                  setDetail(false)
                }}
              >
                Bỏ chọn
              </button>
            </>
          ) : (
            <span>Chọn một block trên bản đồ để xem khu bãi hoặc click vào ô Slot để xem lịch sử.</span>
          )}
        </div>

        <details className="yard-block-directory">
          <summary>
            Danh sách block <span>7 khu · 32 block</span>
          </summary>
          {layout.sectors.map((zone) => (
            <div className="yard-block-group" key={zone.code}>
              <strong>{zone.label}</strong>
              <div>
                {layout.areas
                  .filter((area) => area.sector === zone.code)
                  .map((area) => (
                    <button
                      type="button"
                      key={area.code}
                      aria-label={`Chọn block ${area.code}`}
                      aria-pressed={code === area.code}
                      onClick={() => choose(area)}
                    >
                      {area.code}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </details>

        {/* Modal tra cứu lịch sử Slot & Container */}
        <YardSlotHistoryModal
          isOpen={historyModal.isOpen}
          onClose={() => setHistoryModal((prev) => ({ ...prev, isOpen: false }))}
          initialMode={historyModal.mode}
          initialSlotCode={historyModal.slotCode}
          initialSlotId={historyModal.slotId}
          initialContainerNo={historyModal.containerNo}
        />

        {/* Modal hiển thị chi tiết Container bãi */}
        <ContainerYardDetailModal
          isOpen={containerModal.isOpen}
          onClose={() => setContainerModal({ isOpen: false, data: null })}
          containerData={containerModal.data}
          onOpenHistory={handleOpenHistory}
        />
      </div>
    </div>
  )
}
