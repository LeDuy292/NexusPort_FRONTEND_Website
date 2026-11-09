import { useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, CalendarDays, Check, ChevronDown, Container, FileText, Loader2, RefreshCw, Search, Ship, X } from 'lucide-react'
import { draftDateTime } from './serviceDraftsApi'

export default function BookingSourceSelect({ items = [], value, selected, search, onSearch, onChange, loading, error, onRetry }) {
  const id = useId()
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const activeId = `${id}-option-${active}`
  const display = selected?.bookingNumber || (value ? 'Booking đã lưu' : '')

  useEffect(() => { setActive(Math.max(0, items.findIndex(item => item.id === value))) }, [items, value])
  useEffect(() => {
    if (!open) return
    const outside = event => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  useEffect(() => { if (open) listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }) }, [active, open])

  const expand = () => { if (!open) { onSearch(''); setOpen(true) } }
  const choose = item => { onChange(item.id); setOpen(false); onSearch('') }
  const keys = event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) expand()
      else if (items.length && !loading && !error) setActive(previous => (previous + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length)
    }
    if (event.key === 'Enter' && open) { event.preventDefault(); if (!loading && !error && items[active]) choose(items[active]) }
  }

  return <div className={`epd-booking-select ${open ? 'open' : ''}`} ref={rootRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} onKeyDown={keys}>
    <label className="epd-booking-label" htmlFor={`${id}-input`}>Chọn Booking</label>
    <div className="epd-booking-control">
      <span className="epd-booking-control-icon">{selected ? <FileText size={18} /> : <Search size={18} />}</span>
      <input ref={inputRef} id={`${id}-input`} role="combobox" aria-label="Chọn Booking" aria-expanded={open}
        aria-controls={`${id}-list`} aria-autocomplete="list" aria-haspopup="listbox"
        aria-activedescendant={open && !loading && !error && items.length ? activeId : undefined}
        autoComplete="off" maxLength={100} placeholder={open ? 'Tìm số Booking, tên tàu hoặc chuyến…' : 'Chọn Booking phù hợp của công ty'}
        value={open ? search : display} onFocus={expand} onClick={expand}
        onChange={event => { setOpen(true); onSearch(event.target.value) }} />
      {open && search && <button type="button" className="epd-booking-clear" aria-label="Xóa tìm Booking" onMouseDown={event => event.preventDefault()} onClick={() => { onSearch(''); inputRef.current?.focus() }}><X size={14} /></button>}
      <button type="button" className="epd-booking-toggle" tabIndex={-1} aria-label={open ? 'Thu gọn danh sách Booking' : 'Mở danh sách Booking'} aria-expanded={open}
        onMouseDown={event => event.preventDefault()} onClick={() => { if (open) setOpen(false); else { expand(); inputRef.current?.focus() } }}><ChevronDown size={18} /></button>
    </div>
    {open && <div className="epd-booking-panel">
      <div className="epd-booking-panel-heading"><span>BOOKING PHÙ HỢP</span><small>{loading ? 'Đang tìm…' : error ? 'Chưa tải được dữ liệu' : `${items.length} kết quả`}</small></div>
      <div role="listbox" aria-label="Booking phù hợp" id={`${id}-list`} ref={listRef} className="epd-booking-options" aria-busy={loading}>
        {!loading && !error && items.map((item, index) => <button key={item.id} id={`${id}-option-${index}`} type="button" role="option" aria-selected={item.id === value}
          tabIndex={-1} data-active={active === index} className="epd-booking-option" onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(item)}>
          <span className="epd-booking-option-icon"><FileText size={19} /></span>
          <span className="epd-booking-option-copy"><strong>{item.bookingNumber}</strong><span><Ship size={13} />{item.vesselName} <b>·</b> {item.voyageNumber}</span><small><span><Container size={12} />{item.containerCount} container</span><span><CalendarDays size={12} />CY: {draftDateTime(item.cyCutoff)}</span></small></span>
          <span className="epd-booking-option-check"><Check size={16} /></span>
        </button>)}
      </div>
      {loading ? <div className="epd-booking-message" role="status"><Loader2 size={21} className="epc-spin" /><p>Đang tải Booking phù hợp…</p></div>
        : error ? <div className="epd-booking-message error" role="alert"><AlertCircle size={22} /><p>{error}</p><button type="button" className="epc-button secondary" onClick={onRetry}><RefreshCw size={14} />Thử lại</button></div>
          : !items.length ? <div className="epd-booking-message" role="status"><Search size={24} /><strong>{search ? 'Không tìm thấy Booking phù hợp' : 'Chưa có Booking đủ điều kiện'}</strong><p>{search ? 'Thử số Booking, tên tàu hoặc chuyến khác.' : 'Booking cần được cảng tiếp nhận và có danh sách container hàng đã công bố.'}</p>{search && <button type="button" className="epc-text-button" onClick={() => { onSearch(''); inputRef.current?.focus() }}>Xóa tìm kiếm</button>}</div> : null}
      {!error && <p className="epd-booking-panel-note">Chỉ hiển thị Booking thuộc công ty và đủ trạng thái đăng ký. Tối đa 50 kết quả mỗi lần tìm.</p>}
    </div>}
    {!open && selected && <p className="epd-booking-selection"><Ship size={13} />{[selected.vesselName, selected.voyageNumber].filter(Boolean).join(' · ') || 'Hồ sơ đã lưu; điều kiện sẽ được kiểm tra lại.'}</p>}
  </div>
}
