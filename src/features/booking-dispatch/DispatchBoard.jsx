import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatchBoard } from './useDispatchBoard'
import { updateDispatch } from './dispatchService'
import { dateTime as time, displayState, stateOf, statusLabel, vietnamDate } from './dispatchPresentation'
import './DispatchBoard.css'
import { SmartRouteDetail } from './SmartRouteMonitor'
import { useYardMonitor } from './useYardMonitor'
import DispatchJourney from './JourneyTimeline'
import { dispatchVehicles } from './dispatchJourney'
import { routePhaseLabel, routeDestination } from '../../utils/smartRoutePresentation'
import { formatPlateNumber } from '../../utils/format'

const dateToday = () => vietnamDate(new Date())

export default function DispatchBoard() {
  const [date, setDate] = useState(dateToday)
  const { data, loading, error, connected, reload } = useDispatchBoard(date)
  const monitor = useYardMonitor()
  const [containerId, setContainerId] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [note, setNote] = useState('')
  const [minutes, setMinutes] = useState(15)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const bookings = data?.bookings || []
  const vehicles = dispatchVehicles(bookings, monitor.data?.routes || [])
  const vehicle = vehicles.find(row => row.id === selectedId)
  const selected = vehicle?.booking
  const route = vehicle?.routes.find(item => item.containerId === containerId) || vehicle?.routes[0]
  const yard = data?.yard
  const inside = vehicles.filter(row => row.group === 'inside').length
  const counts = {
    ready: bookings.filter(b => b.coordination.canCall).length,
    absent: bookings.filter(b => stateOf(b) === 'not-arrived').length,
    called: bookings.filter(b => ['called', 'acknowledged'].includes(stateOf(b))).length,
  }
  const visible = vehicles.filter(row => filter === 'all' || filter === row.group
    || (row.group === 'queue' && ((filter === 'waiting' && ['ready','arrived'].includes(stateOf(row.booking)))
      || (filter === 'called' && ['called','acknowledged'].includes(stateOf(row.booking)))
      || (filter === 'absent' && stateOf(row.booking) === 'not-arrived'))))
  const choose = row => {
    if (busy) return
    if (row.id !== selectedId) { setNote(''); setFeedback(null); setContainerId('') }
    setSelectedId(row.id)
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
      <div><p className="arrival-eyebrow">ĐIỀU ĐỘ · HÀNH TRÌNH XE</p><h1>Theo dõi & điều phối xe</h1>
        <p>Từ khu chờ đến khi ra cổng · tài xế xác nhận các mốc, điều độ theo dõi hành trình.</p></div>
      <span className={'arrival-live ' + (connected ? 'connected' : '')}>{connected ? '● Realtime đang kết nối' : '◌ Đang nối lại realtime'}</span>
    </header>
    <div className="arrival-toolbar">
      <label>Ngày hẹn <input type="date" value={date} disabled={busy} onChange={e => { setDate(e.target.value); setSelectedId(null) }} /></label>
      <button type="button" onClick={() => { void reload(); void monitor.reload() }} disabled={loading}>Làm mới</button>
      <Link to="/dispatcher/gate-bookings">Duyệt booking →</Link>
      <span className="arrival-muted">Cập nhật: {time(data?.serverTime)} · Giờ Việt Nam</span>
    </div>
    {error && <div className="arrival-error" role="alert">Không tải được hàng chờ: {error} <button type="button" onClick={() => { void reload(); void monitor.reload() }}>Thử lại</button></div>}
    <div className="arrival-counts">
      <div className="count-ready"><span className="arrival-stat-icon material-symbols-outlined" aria-hidden="true">local_shipping</span><div><span>Có thể gọi ngay</span><strong>{counts.ready}</strong></div></div>
      <div className="count-absent"><span className="arrival-stat-icon material-symbols-outlined" aria-hidden="true">schedule</span><div><span>Chưa xác nhận đến</span><strong>{counts.absent}</strong></div></div>
      <div className="count-called"><span className="arrival-stat-icon material-symbols-outlined" aria-hidden="true">campaign</span><div><span>Đã gọi / đã nhận lệnh</span><strong>{counts.called}</strong></div></div>
    </div>
    <div className="dispatch-capacity" role="status"><strong>{yard ? yard.inside + ' / ' + yard.capacity + ' xe trong bãi' : inside + ' xe trong bãi'}</strong>
      <span>{yard ? yard.reserved + ' chỗ đã giữ cho lệnh vào · Còn ' + yard.available + ' chỗ' : 'Đang tải sức chứa từ hệ thống'}</span>
      <span>{yard?.automatic ? 'Tự gọi xe sẵn sàng khi còn sức chứa' : 'Điều độ gọi xe theo sức chứa'}</span>
    </div>
    {monitor.error && <p className="arrival-error" role="alert">Chưa cập nhật được xe trong bãi: {monitor.error}. Dữ liệu đang hiển thị có thể cũ. <button type="button" onClick={() => void monitor.reload()}>Thử lại</button></p>}
    <div className="arrival-workspace">
      <section className="arrival-queue" aria-label="Hàng chờ điều phối">
        <div className="arrival-panel-heading">
          <div><h2>Danh sách xe</h2><span>{visible.length} chuyến · chọn xe để xem lộ trình bên phải</span></div>
        </div>
        <div className="arrival-tabs" aria-label="Lọc hàng chờ">
          {[['all','Tất cả'],['waiting','Chờ gọi'],['called','Đã gọi'],['inside','Trong bãi'],['exited','Đã ra'],['absent','Chưa đến']].map(([key,label]) =>
            <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
        </div>
        <p className="arrival-muted arrival-order">Ngày hẹn lọc hàng chờ. Xe đang trong bãi luôn hiển thị; xe đã ra được giữ trong 24 giờ.</p>
        {loading && <p className="arrival-empty">Đang tải booking…</p>}
        {!loading && !visible.length && <p className="arrival-empty">Chưa có booking trong nhóm này. Booking phải được duyệt và có tài xế trước khi xác nhận đến.</p>}
        <div className="arrival-list">
          {visible.map(row => {
            const booking = row.booking, trip = row.routes[0]
            const label = row.group === 'queue' ? statusLabel(booking) : row.group === 'exited' ? 'Hoàn thành · đã ra cổng' : routePhaseLabel[trip?.journey?.phase] || 'Trong bãi'
            return <button key={row.id} type="button" onClick={() => choose(row)} aria-pressed={selectedId === row.id} className={'arrival-row ' + row.group + (selectedId === row.id ? ' selected' : '')}>
              <div><strong>{formatPlateNumber(booking?.truckPlate || trip?.truckPlate) || 'Chưa gán xe'}</strong><span>{booking?.driverName || trip?.driverName}</span><small>{booking?.bookingCode || trip?.bookingCode}</small></div>
              <div><span className="arrival-status">{label}</span><small>{trip ? routeDestination(trip) : 'Hẹn: ' + time(booking.appointmentStart)}</small>
                <small>{trip ? row.routes.length + ' container' : booking.coordination.isLate ? 'Đến muộn >10 phút' : booking.dispatch?.arrivedAt ? 'Đến: ' + time(booking.dispatch.arrivedAt) : 'Chưa xác nhận đến'}</small></div>
            </button>
          })}
        </div>
      </section>
      <aside key={vehicle ? `${vehicle.id}:${route?.containerId || 'queue'}` : 'empty'} className="arrival-detail" aria-label="Chi tiết điều phối">
        {!vehicle ? <div className="dispatch-no-selection"><span className="material-symbols-outlined" aria-hidden="true">route</span><h2>{selectedId ? 'Đang chuyển sang hành trình trong bãi…' : 'Chọn xe để theo dõi hành trình'}</h2><p>Lộ trình, các bước đã hoàn tất và việc cần làm sẽ hiển thị ở đây.</p></div> : <>
          <div className="arrival-detail-heading"><div><p className="arrival-eyebrow">CHI TIẾT ĐIỀU PHỐI</p><h2>{selected?.bookingCode || route?.bookingCode}</h2></div><button type="button" disabled={busy} onClick={() => setSelectedId(null)} aria-label="Đóng chi tiết">×</button></div>
          <DispatchJourney booking={selected} route={route} />
          {vehicle.routes.length > 1 && <label className="dispatch-container-picker">Container<select value={route?.containerId || ''} onChange={event => setContainerId(event.target.value)}>{vehicle.routes.map(item => <option key={item.containerId} value={item.containerId}>{item.containerNumber}</option>)}</select></label>}
          {route && <SmartRouteDetail selected={route} error={monitor.error} />}
          {selected && !route && <>
          <div className="arrival-detail-tools"><span className={'arrival-status ' + displayState(selected)}>{statusLabel(selected)}</span>
          </div>
          <dl className="arrival-facts">
            <div><dt>Tài xế</dt><dd>{selected.driverName}</dd></div>
            <div><dt>Xe</dt><dd>{formatPlateNumber(selected.truckPlate) || 'Chưa gán'}</dd></div>
            <div><dt>Công ty</dt><dd>{selected.carrierName}</dd></div>
            <div><dt>Thao tác</dt><dd>{selected.bookingType?.toLowerCase() === 'pickup' ? 'Lấy container' : 'Giao container'}</dd></div>
            <div><dt>Lịch hẹn</dt><dd>{time(selected.appointmentStart)} – {time(selected.appointmentEnd)}</dd></div>
            <div><dt>Đến khu chờ</dt><dd>{selectedState === 'not-arrived' ? 'Chưa xác nhận' : time(selected.dispatch?.arrivedAt)}</dd></div>
            {selected.dispatch?.callExpiresAt && <div><dt>Hạn phản hồi</dt><dd>{time(selected.dispatch.callExpiresAt)}</dd></div>}
            {selected.dispatch?.acknowledgedAt && <div><dt>Đã nhận lệnh</dt><dd>{time(selected.dispatch.acknowledgedAt)}</dd></div>}
            {selected.gateEntryOrder&&<div><dt>Lệnh vào cổng</dt><dd>{({pending_ack:'Chờ tài xế nhận lệnh',active:'Được phép vào',expired:'Hết hạn',consumed:'Đã Gate In',revoked:'Đã thu hồi'})[selected.gateEntryOrder.status]||selected.gateEntryOrder.status} · Hạn {time(selected.gateEntryOrder.validUntil)}</dd></div>}
            {selected.coordination.isHeld && <div><dt>Chờ dự kiến đến</dt><dd>{time(selected.dispatch.holdUntil)}</dd></div>}
          </dl>
          <div className="arrival-cargo"><h3>Container / hàng hóa</h3>
            {selected.containers.map(c => <div key={c.id}><strong>{c.containerNo}</strong> · {c.containerType || '—'}<small>{c.cargoType || 'Chưa khai báo hàng'} · {c.grossWeightKg == null ? 'Chưa có tải trọng' : Number(c.grossWeightKg).toLocaleString('vi-VN') + ' kg'}</small></div>)}
            {!selected.containers.length && <p className="arrival-muted">Chưa có container liên kết.</p>}
          </div>
          {selected.dispatch?.message && <div className="arrival-message" aria-live="polite">{selected.dispatch.message}</div>}
          <details className="dispatch-intervention"><summary>Can thiệp điều phối / gọi thủ công</summary>
          <label className="arrival-note">Hướng dẫn / lý do chờ
            <textarea rows="3" maxLength="500" value={note} onChange={e => setNote(e.target.value)} placeholder="Ví dụ: Tiếp tục chờ tại khu chờ, thiết bị đang phục vụ xe trước." />
          </label>
          <button type="button" className="arrival-call" disabled={busy || !selected.coordination.canCall || yard?.available === 0 || Boolean(error)} onClick={() => void act('call')}>{busy ? 'Đang gửi…' : 'Gọi tài xế'}</button>
          {yard?.available === 0 && <p className="arrival-muted">Đã đủ xe hoặc chỗ giữ cho lệnh vào. Chờ xe Gate Out để có chỗ.</p>}
          {!selected.coordination.canCall && <p className="arrival-muted">{selectedState === 'acknowledged'
            ? 'Tài xế đã nhận lệnh. Dùng lệnh còn hạn tại cổng; không cần gọi thêm. Khi lệnh hết hạn, hệ thống trả xe về sẵn sàng để gọi lại.'
            : selectedState === 'called' ? 'Đã gửi lệnh gọi, đang chờ tài xế nhận trên app trong 10 phút.'
            : 'Chỉ gọi khi tài xế sẵn sàng, từ 12 giờ trước giờ hẹn và không còn thời gian chờ thêm.'}</p>}
          <div className="arrival-delay"><label>Chờ thêm (phút)<input type="number" min="1" max="120" value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
            <button type="button" disabled={busy || !canDelay || !note.trim() || Boolean(error)} onClick={() => void act('delay')}>Báo chờ thêm</button></div>
          {(['called','acknowledged'].includes(selectedState) || selected.dispatch?.holdUntil) && <button type="button" disabled={busy || Boolean(error)} onClick={() => void act('release')}>Thu hồi lệnh / bỏ thời gian chờ</button>}
          </details>
          {feedback && <p role="status" className={feedback.ok ? 'arrival-success' : 'arrival-error'}>{feedback.text}</p>}
          <p className="arrival-boundary">Lệnh vào còn hạn giữ một chỗ trong bãi. Gate In chuyển chỗ đã giữ thành xe trong bãi; Gate Out mới giải phóng chỗ.</p>
          </>}
          {route && <p className="arrival-boundary">Dùng cùng booking đến Gate Out. Tài xế xác nhận đã đến và kiểm tra container; nhân viên bãi hoàn tất thao tác hàng. Điều độ theo dõi và xử lý ngoại lệ.</p>}
        </>}
      </aside>
    </div>
  </div>
}
