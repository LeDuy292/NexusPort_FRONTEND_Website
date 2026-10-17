import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatchBoard } from './useDispatchBoard'
import { updateDispatch } from './dispatchService'
import { dateTime as time, displayState, stateOf, statusLabel, vietnamDate } from './dispatchPresentation'
import './DispatchBoard.css'
import SmartRouteMonitor from './SmartRouteMonitor'

const dateToday = () => vietnamDate(new Date())

export default function DispatchBoard() {
  const [date, setDate] = useState(dateToday)
  const { data, loading, error, connected, reload } = useDispatchBoard(date)
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [note, setNote] = useState('')
  const [minutes, setMinutes] = useState(15)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const bookings = data?.bookings || []
  const selected = bookings.find(b => b.id === selectedId)
  const counts = {
    ready: bookings.filter(b => b.coordination.canCall).length,
    absent: bookings.filter(b => stateOf(b) === 'not-arrived').length,
    called: bookings.filter(b => ['called', 'acknowledged'].includes(stateOf(b))).length,
  }
  const visible = bookings.filter(b => filter === 'all' || (filter === 'waiting' && ['ready', 'arrived'].includes(stateOf(b)))
    || (filter === 'called' && ['called', 'acknowledged'].includes(stateOf(b))) || (filter === 'absent' && stateOf(b) === 'not-arrived'))
  const choose = booking => {
    if (busy) return
    if (booking.id !== selectedId) { setNote(''); setFeedback(null) }
    setSelectedId(booking.id)
  }
  async function act(action) {
    if (!selected || busy) return
    setBusy(true); setFeedback(null)
    try {
      await updateDispatch(selected, action, { note, minutes: Number(minutes) })
      setFeedback({ ok: true, text: action === 'call' ? 'Đã gửi lệnh gọi tới tài xế.' : action === 'delay' ? 'Đã báo thời gian chờ mới tới tài xế.' : 'Đã đưa xe về hàng chờ.' })
      setNote('')
    } catch (err) { setFeedback({ ok: false, text: err.message }) }
    finally { await reload(); setBusy(false) }
  }
  const selectedState = selected && stateOf(selected)
  const canDelay = ['ready', 'called', 'acknowledged'].includes(selectedState)
  return <div className="arrival-page">
    <header className="arrival-header">
      <div><p className="arrival-eyebrow">ĐIỀU ĐỘ · KHU CHỜ</p><h1>Lệnh điều phối xe</h1>
        <p>Tài xế báo sẵn sàng → điều độ gọi → tài xế xác nhận nhận lệnh.</p></div>
      <span className={'arrival-live ' + (connected ? 'connected' : '')}>{connected ? '● Realtime đang kết nối' : '◌ Đang nối lại realtime'}</span>
    </header>
    <div className="arrival-toolbar">
      <label>Ngày hẹn <input type="date" value={date} disabled={busy} onChange={e => { setDate(e.target.value); setSelectedId(null) }} /></label>
      <button type="button" onClick={() => void reload()} disabled={loading}>Làm mới</button>
      <Link to="/dispatcher/gate-bookings">Duyệt booking →</Link>
      <span className="arrival-muted">Cập nhật: {time(data?.serverTime)} · Giờ Việt Nam</span>
    </div>
    {error && <div className="arrival-error" role="alert">Không tải được hàng chờ: {error} <button type="button" onClick={() => void reload()}>Thử lại</button></div>}
    <div className="arrival-counts">
      <div className="count-ready"><span className="arrival-stat-icon material-symbols-outlined" aria-hidden="true">local_shipping</span><div><span>Có thể gọi ngay</span><strong>{counts.ready}</strong></div></div>
      <div className="count-absent"><span className="arrival-stat-icon material-symbols-outlined" aria-hidden="true">schedule</span><div><span>Chưa xác nhận đến</span><strong>{counts.absent}</strong></div></div>
      <div className="count-called"><span className="arrival-stat-icon material-symbols-outlined" aria-hidden="true">campaign</span><div><span>Đã gọi / đã nhận lệnh</span><strong>{counts.called}</strong></div></div>
    </div>
    <SmartRouteMonitor />
    <div className="arrival-workspace">
      <section className="arrival-queue" aria-label="Hàng chờ điều phối">
        <div className="arrival-panel-heading">
          <div><h2>Hàng chờ điều phối</h2><span>{visible.length} booking · chọn để xem chi tiết và điều phối</span></div>
        </div>
        <div className="arrival-tabs" aria-label="Lọc hàng chờ">
          {[['all','Tất cả'],['waiting','Chờ gọi'],['called','Đã gọi'],['absent','Chưa đến']].map(([key,label]) =>
            <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
        </div>
        <p className="arrival-muted arrival-order">Ưu tiên xe đủ điều kiện, đúng giờ; cùng khung giờ ưu tiên booking tạo trước. Xe đến muộn được xếp sau.</p>
        {loading && <p className="arrival-empty">Đang tải booking…</p>}
        {!loading && !visible.length && <p className="arrival-empty">Chưa có booking trong nhóm này. Booking phải được duyệt và có tài xế trước khi xác nhận đến.</p>}
        <div className="arrival-list">
          {visible.map(booking => <button key={booking.id} type="button" onClick={() => choose(booking)} aria-pressed={selectedId === booking.id} className={'arrival-row ' + displayState(booking) + (selectedId === booking.id ? ' selected' : '')}>
            <div><strong>{booking.bookingCode}</strong><span>{booking.truckPlate || 'Chưa gán xe'} · {booking.driverName}</span><small>{booking.carrierName}</small></div>
            <div><span className={'arrival-status ' + displayState(booking)}>{statusLabel(booking)}</span>
              <small>Hẹn: {time(booking.appointmentStart)}</small>
              <small>{stateOf(booking) !== 'not-arrived' ? 'Đến: ' + time(booking.dispatch.arrivedAt) : 'Chưa báo đến'}{booking.coordination.isLate ? ' · Muộn >10 phút' : ''}</small>
            </div>
          </button>)}
        </div>
      </section>
      {selected && <aside className="arrival-detail" aria-label="Chi tiết điều phối">
          <div className="arrival-detail-heading"><div><p className="arrival-eyebrow">CHI TIẾT ĐIỀU PHỐI</p><h2>{selected.bookingCode}</h2></div><button type="button" disabled={busy} onClick={() => setSelectedId(null)} aria-label="Đóng chi tiết">×</button></div>
          <div className="arrival-detail-tools"><span className={'arrival-status ' + displayState(selected)}>{statusLabel(selected)}</span>
          </div>
          <dl className="arrival-facts">
            <div><dt>Tài xế</dt><dd>{selected.driverName}</dd></div>
            <div><dt>Xe</dt><dd>{selected.truckPlate || 'Chưa gán'}</dd></div>
            <div><dt>Công ty</dt><dd>{selected.carrierName}</dd></div>
            <div><dt>Thao tác</dt><dd>{selected.bookingType?.toLowerCase() === 'pickup' ? 'Lấy container' : 'Giao container'}</dd></div>
            <div><dt>Lịch hẹn</dt><dd>{time(selected.appointmentStart)} – {time(selected.appointmentEnd)}</dd></div>
            <div><dt>Đến khu chờ</dt><dd>{selectedState === 'not-arrived' ? 'Chưa xác nhận' : time(selected.dispatch?.arrivedAt)}</dd></div>
            {selected.dispatch?.callExpiresAt && <div><dt>Hạn phản hồi</dt><dd>{time(selected.dispatch.callExpiresAt)}</dd></div>}
            {selected.dispatch?.acknowledgedAt && <div><dt>Đã nhận lệnh</dt><dd>{time(selected.dispatch.acknowledgedAt)}</dd></div>}
            {selected.coordination.isHeld && <div><dt>Chờ dự kiến đến</dt><dd>{time(selected.dispatch.holdUntil)}</dd></div>}
          </dl>
          <div className="arrival-cargo"><h3>Container / hàng hóa</h3>
            {selected.containers.map(c => <div key={c.id}><strong>{c.containerNo}</strong> · {c.containerType || '—'}<small>{c.cargoType || 'Chưa khai báo hàng'} · {c.grossWeightKg == null ? 'Chưa có tải trọng' : Number(c.grossWeightKg).toLocaleString('vi-VN') + ' kg'}</small></div>)}
            {!selected.containers.length && <p className="arrival-muted">Chưa có container liên kết.</p>}
          </div>
          {selected.dispatch?.message && <div className="arrival-message" aria-live="polite">{selected.dispatch.message}</div>}
          <label className="arrival-note">Hướng dẫn / lý do chờ
            <textarea rows="3" maxLength="500" value={note} onChange={e => setNote(e.target.value)} placeholder="Ví dụ: Tiếp tục chờ tại khu chờ, thiết bị đang phục vụ xe trước." />
          </label>
          <button type="button" className="arrival-call" disabled={busy || !selected.coordination.canCall || Boolean(error)} onClick={() => void act('call')}>{busy ? 'Đang gửi…' : 'Gọi tài xế'}</button>
          {!selected.coordination.canCall && <p className="arrival-muted">Chỉ gọi khi tài xế sẵn sàng, tới giờ hẹn và không còn thời gian chờ thêm.</p>}
          <div className="arrival-delay"><label>Chờ thêm (phút)<input type="number" min="1" max="120" value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
            <button type="button" disabled={busy || !canDelay || !note.trim() || Boolean(error)} onClick={() => void act('delay')}>Báo chờ thêm</button></div>
          {(['called','acknowledged'].includes(selectedState) || selected.dispatch?.holdUntil) && <button type="button" disabled={busy || Boolean(error)} onClick={() => void act('release')}>Thu hồi lệnh / bỏ thời gian chờ</button>}
          {feedback && <p role="status" className={feedback.ok ? 'arrival-success' : 'arrival-error'}>{feedback.text}</p>}
          <p className="arrival-boundary">Lệnh gọi chỉ điều phối xe tới bước tiếp theo. Chưa ghi nhận xe vào cổng hoặc tính số xe đang ở trong bãi.</p>
      </aside>}
    </div>
  </div>
}
