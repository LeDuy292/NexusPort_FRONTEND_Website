import { useCallback, useEffect, useRef, useState } from 'react'
import YardLayoutMap from '../../components/Yard/YardLayoutMap'
import CreateBlockModal from '../../components/Yard/CreateBlockModal'
import referenceLayout from '../../data/referenceYardLayout.json'
import expressApiClient from '../../services/expressApiClient'
import { slotsForArea, slotState, slotStateLabel, summarizeSlots } from '../../utils/yardLayout'
import './YardMap.css'

export default function YardMap() {
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCode, setSelectedCode] = useState('A1')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [externalSelection, setExternalSelection] = useState(null)
  const latest = useRef(0)
  const mounted = useRef(false)
  const mutation = useRef(false)
  const plan = snapshot?.referenceLayout || referenceLayout
  const slots = snapshot?.slots || []
  const selected = plan.areas.find(area => area.code === selectedCode)
  const selectedSlots = externalSelection ? slots.filter(slot => slot.block === externalSelection)
    : selected ? slotsForArea(selected, slots) : []
  const summary = summarizeSlots(slots)
  const userRole = (() => { try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}').role } catch { return '' } })()
  const canManage = ['Yard Operator', 'Administrator'].includes(userRole)
  const reload = useCallback(async () => {
    const request = ++latest.current
    setLoading(true)
    try {
      const next = await expressApiClient.get('/yard/layout')
      if (mounted.current && request === latest.current) { setSnapshot(next); setError('') }
    } catch (err) {
      if (mounted.current && request === latest.current) setError(err.message || 'Không tải được dữ liệu tồn kho bãi.')
    } finally { if (mounted.current && request === latest.current) setLoading(false) }
  }, [])
  useEffect(() => {
    mounted.current = true
    void reload()
    const refresh = () => { if (!document.hidden && !mutation.current) void reload() }
    const timer = setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => { mounted.current = false; clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [reload])
  const chooseArea = area => { setSelectedCode(area.code); setExternalSelection(null); setMessage('') }
  function search(event) {
    event.preventDefault()
    const term = query.trim().toUpperCase()
    if (!term) return
    const area = plan.areas.find(item => item.code === term)
    if (area) { chooseArea(area); return }
    if (!snapshot || error) { setMessage('Chưa có dữ liệu tồn kho hiện tại. Vui lòng tải lại trước khi tìm container.'); return }
    const slot = slots.find(item => item.containerNumber?.toUpperCase().includes(term))
    if (!slot) { setMessage(`Không tìm thấy container hoặc khu vực phù hợp với ${term}.`); return }
    const targetArea = plan.areas.find(item => slotsForArea(item, [slot]).length)
    if (targetArea) chooseArea(targetArea)
    else setExternalSelection(slot.block)
    setMessage(`${slot.containerNumber}: ${slot.block} / Dãy ${slot.bay} / Hàng ${slot.row} / Tầng ${slot.tier}`)
  }
  async function toggleMaintenance(slot) {
    if (!canManage || error || loading || mutation.current || slot.containerId || !['empty', 'maintenance'].includes(slotState(slot))) return
    mutation.current = true; setBusy(true); setMessage('')
    try {
      await expressApiClient.post(`/yard/slots/${encodeURIComponent(slot.id)}/maintenance`, { maintenance: slotState(slot) !== 'maintenance' })
      if (mounted.current) { setMessage('Đã cập nhật trạng thái vị trí.'); await reload() }
    } catch (err) { if (mounted.current) setMessage(err.response?.data?.message || err.message || 'Không cập nhật được vị trí.') }
    finally { mutation.current = false; if (mounted.current) setBusy(false) }
  }
  return <div className="yard-map-page">
    <header className="yard-page-heading"><div><span>NEXUSPORT / BÃI CONTAINER</span><h1>Bản đồ bãi container</h1><p>Sơ đồ tham khảo kết hợp tồn kho hiện tại theo khu, dãy và hàng.</p></div><div className="yard-page-actions"><button type="button" disabled={loading || busy} onClick={() => void reload()}>{loading ? 'Đang tải…' : 'Cập nhật tồn kho'}</button>{canManage && <button type="button" onClick={() => setCreateOpen(true)}>Tạo khu bãi</button>}</div></header>
    <div className="yard-page-toolbar"><form onSubmit={search}><label htmlFor="yard-map-search">Tìm khu vực hoặc container</label><div><input id="yard-map-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="A1 hoặc số container" /><button type="submit">Tìm</button></div></form><span>{snapshot ? `Cập nhật tồn kho: ${new Date(snapshot.generatedAt).toLocaleTimeString('vi-VN')}` : 'Sơ đồ tham khảo'} · {error ? 'Chưa có dữ liệu tồn kho' : loading ? 'Đang cập nhật' : 'Dữ liệu hiện tại'}</span></div>
    {error && <div className="yard-page-alert" role="alert">{error} {snapshot ? 'Dữ liệu đang hiển thị là lần cập nhật thành công gần nhất.' : 'Sơ đồ vẫn hiển thị; chưa xác định được tồn kho.'}</div>}
    {message && <p className="yard-page-message" role="status">{message}</p>}
    <div className="yard-page-workspace">
      <YardLayoutMap layout={plan} slots={slots} selectedCode={externalSelection ? '' : selectedCode} onSelectArea={chooseArea} showDetails={false} />
      <aside className="yard-page-details" aria-label="Chi tiết khu vực đã chọn">
        <div aria-live="polite"><span className="yard-page-eyebrow">KHU VỰC ĐÃ CHỌN</span><h2>{externalSelection || selected?.code || 'Chọn một khu vực'}</h2><p>{externalSelection ? 'Khu bãi đang vận hành nằm ngoài sơ đồ tham khảo' : selected?.note || 'Chưa có ghi chú trong bản gốc'}</p></div>
        {!externalSelection && selected && <><p>{plan.zones.find(zone => zone.code === selected.zone)?.label}{plan.zones.find(zone => zone.code === selected.zone)?.maxContainerRows ? ` · Tối đa ${plan.zones.find(zone => zone.code === selected.zone).maxContainerRows} hàng container` : ''}</p><div className="yard-position-list">{selected.rows.map(row => <span key={row}>{selected.code}-{row}</span>)}</div>{selected.sourceHighlight && <p className="yard-page-caption">Được đánh dấu đỏ trong bản gốc; chưa có giải thích về ý nghĩa vận hành.</p>}</>}
        <h3>Vị trí vận hành ({selectedSlots.length})</h3>
        {!selectedSlots.length ? <p className="yard-page-caption">Chưa có vị trí vận hành được cấu hình tương ứng với các vị trí tham khảo này.</p> : <div className="yard-slot-table"><table><thead><tr><th>Vị trí</th><th>Container / trạng thái</th>{canManage && <th>Thao tác</th>}</tr></thead><tbody>{selectedSlots.map(slot => <tr key={slot.id}><td>D{slot.bay} · H{slot.row} · T{slot.tier}</td><td><strong>{slot.containerNumber || '—'}</strong><span className={`yard-slot-status ${slotState(slot)}`}>{slotStateLabel(slot)}</span></td>{canManage && <td>{['empty', 'maintenance'].includes(slotState(slot)) && !slot.containerId && <button type="button" disabled={busy || loading || Boolean(error)} onClick={() => void toggleMaintenance(slot)}>{slotState(slot) === 'maintenance' ? 'Mở lại' : 'Bảo trì'}</button>}</td>}</tr>)}</tbody></table></div>}
        <hr /><h3>Tổng quan tồn kho</h3><p>{snapshot ? `${summary.occupied} đang sử dụng · ${summary.reserved} đã giữ chỗ · ${summary.empty} còn trống · ${summary.maintenance} đang bảo trì${summary.unknown ? ` · ${summary.unknown} chưa xác định` : ''}` : 'Chưa có dữ liệu tồn kho'}</p>
        {!!snapshot?.unmappedSlotCount && <div className="yard-unmapped"><h3>Ngoài sơ đồ tham khảo</h3><p>{snapshot.unmappedSlotCount} vị trí vận hành chưa có vị trí tương ứng trong sơ đồ tham khảo.</p>{[...new Set(slots.filter(slot => !slot.mapped).map(slot => slot.block))].map(block => <button key={block} type="button" onClick={() => { setExternalSelection(block); setMessage('') }}>Xem khu {block}</button>)}</div>}
      </aside>
    </div>
    <CreateBlockModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onBlockCreated={() => { setCreateOpen(false); void reload() }} />
  </div>
}
