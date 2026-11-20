import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDispatchBoard } from './useDispatchBoard'
import { updateDispatch } from './dispatchService'
import { awaitingTrip, dateTime as time, displayState, stateOf, statusLabel, tripStepLabel, vietnamDate } from './dispatchPresentation'
import './DispatchBoard.css'
import './dispatchTheme.css'
import { SmartRouteDetail } from './SmartRouteMonitor'
import DispatchJourney from './JourneyTimeline'
import { formatPlateNumber } from '../../utils/format'

const dateToday = () => vietnamDate(new Date())

export default function DispatchBoard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const targetCode = (searchParams.get('bookingCode') || '').trim().toUpperCase()
  const targetId = (searchParams.get('bookingId') || '').trim()
  const hasSelection = Boolean(targetId || targetCode)
  const selection = targetId ? { bookingId: targetId } : targetCode ? { bookingCode: targetCode } : null
  const [date, setDate] = useState(dateToday)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const { data, loading, error, connected, selected, detailsLoading, detailError,
    routes, routesLoading, routeError, cacheBooking, reload } = useDispatchBoard(date, filter, page, selection)
  const [containerId, setContainerId] = useState('')
  const [note, setNote] = useState('')
  const [minutes, setMinutes] = useState(15)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const initialSelectionDone = useRef(hasSelection)
  const currentPage = loading ? page : data?.pagination?.page
  useEffect(() => {
    if (currentPage && currentPage !== page) setPage(currentPage)
  }, [currentPage, page])
  const route = routes.find(item => item.containerId === containerId) || routes[0]
  const yard = data?.yard
  const counts = data?.counts || { ready: 0, absent: 0, called: 0 }
  const bookings = loading ? [] : data?.bookings || []
  const { total, pageSize } = data?.pagination || { total: 0, pageSize: 3 }
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const firstPageButton = Math.max(1, Math.min(page - 2, totalPages - 4))
  const changeSelection = useCallback(id => {
    initialSelectionDone.current = true
    const params = new URLSearchParams(searchParams)
    params.delete('bookingCode')
    if (id) params.set('bookingId', id)
    else params.delete('bookingId')
    setSearchParams(params, { replace: true })
    setNote(''); setFeedback(null); setContainerId('')
  }, [searchParams, setSearchParams])
  const firstBooking = bookings[0]
  useEffect(() => {
    if (hasSelection) initialSelectionDone.current = true
    if (initialSelectionDone.current || !firstBooking || busy) return
    cacheBooking(firstBooking)
    changeSelection(firstBooking.id)
  }, [hasSelection, firstBooking, busy, cacheBooking, changeSelection])
  const choose = row => {
    if (busy || row.id === selected?.id) return
    cacheBooking(row)
    changeSelection(row.id)
  }
  async function act(action) {
    if (!selected || busy) return
    setBusy(true); setFeedback(null)
    try {
      await updateDispatch(selected, action, { note, minutes: Number(minutes) })
      setFeedback({ ok: true, text: action === 'call' ? 'Đã gửi lệnh gọi. Cổng đang chờ tài xế nhận lệnh.' : action === 'delay' ? 'Đã báo thời gian chờ mới tới tài xế.' : 'Đã đưa xe về hàng chờ.' })
      setNote('')
    } catch (err) { setFeedback({ ok: false, text: err.message }) }
    finally { await reload(); setBusy(false) }
  }
  const selectedState = selected && stateOf(selected)
  const entryOrder = selected?.gateEntryOrder
  const canDelay = ['ready', 'called', 'acknowledged'].includes(selectedState)
  return <div className="arrival-page">
    <header className="arrival-header">
      <div><p className="arrival-eyebrow"><span className="arrival-badge">KHÔNG GIAN ĐIỀU ĐỘ</span> NexusPort · Cảng Tiên Sa, Đà Nẵng (VNDAD)</p><h1>Theo dõi & điều phối xe</h1>
        <p>Tài xế xác nhận chuyến → báo đã đến cổng → điều độ gọi xe vào cổng → Gate In → làm hàng → Gate Out.</p></div>
      <span className={'arrival-live ' + (connected ? 'connected' : '')}>{connected ? '● Realtime đang kết nối' : '◌ Đang nối lại realtime'}</span>
    </header>
    <div className="arrival-toolbar">
      <label>Ngày hẹn <input type="date" value={date} disabled={busy} onChange={e => { setDate(e.target.value || dateToday()); setPage(1); changeSelection(null) }} /></label>
      <button type="button" onClick={() => void reload()} disabled={loading && !error}>Làm mới</button>
    </div>
    {error && <div className="arrival-error" role="alert">Không tải được danh sách xe: {error} <button type="button" onClick={() => void reload()}>Thử lại</button></div>}
    <div className="arrival-counts">
      <div className="count-ready"><span className="arrival-stat-icon material-symbols-outlined" aria-hidden="true">local_shipping</span><div><span>Đã đến cổng · có thể gọi ngay</span><strong>{counts.ready}</strong></div></div>
      <div className="count-absent"><span className="arrival-stat-icon material-symbols-outlined" aria-hidden="true">schedule</span><div><span>Chưa đến cổng</span><strong>{counts.absent}</strong></div></div>
      <div className="count-called"><span className="arrival-stat-icon material-symbols-outlined" aria-hidden="true">campaign</span><div><span>Đã gọi / đã nhận lệnh vào cổng</span><strong>{counts.called}</strong></div></div>
    </div>
    <div className="dispatch-capacity" role="status"><strong>{yard ? yard.inside + ' / ' + yard.capacity + ' xe trong bãi' : 'Sức chứa bãi'}</strong>
      <span>{yard ? yard.reserved + ' chỗ đã giữ cho lệnh vào · Còn ' + yard.available + ' chỗ' : 'Đang tải sức chứa từ hệ thống'}</span>
      <span>{yard?.automatic ? 'Tự gọi xe sẵn sàng khi còn sức chứa' : 'Điều độ gọi xe theo sức chứa'}</span>
      {yard && <div className={'dispatch-capacity-bar ' + (yard.available === 0 ? 'full' : yard.available / yard.capacity < 0.25 ? 'busy' : '')} aria-hidden="true">
        <span style={{ width: Math.min(100, Math.round(((yard.inside + yard.reserved) / yard.capacity) * 100)) + '%' }} /></div>}
    </div>
    <div className="arrival-workspace">
      <section className="arrival-queue" aria-label="Hàng chờ điều phối">
        <div className="arrival-panel-heading">
          <div><h2>Danh sách xe</h2>{data && <span>{total} lịch hẹn · {pageSize} lịch hẹn mỗi trang</span>}</div>
        </div>
        <div className="arrival-tabs" aria-label="Lọc hàng chờ">
          {[['all','Tất cả'],['waiting','Đã đến cổng'],['called','Đã gọi'],['inside','Trong bãi'],['exited','Đã ra'],['absent','Chưa đến cổng']].map(([key,label]) =>
            <button type="button" key={key} aria-pressed={filter === key} disabled={busy} onClick={() => { setFilter(key); setPage(1) }}>{label}</button>)}
        </div>
        {loading && <p className="arrival-empty" role="status">Đang tải danh sách xe…</p>}
        {data && !loading && !bookings.length && <p className="arrival-empty">Chưa có lịch hẹn trong nhóm này.</p>}
        <div className="arrival-list">
          {bookings.map(booking => {
            const inQueue = booking.group === 'queue'
            const selectedRow = selected?.id === booking.id || targetId === booking.id
            const label = inQueue ? statusLabel(booking) : booking.group === 'exited' ? 'Hoàn thành · đã ra cổng' : 'Trong bãi'
            return <button key={booking.id} type="button" disabled={busy} onClick={() => choose(booking)} aria-pressed={selectedRow}
              className={'arrival-row ' + (inQueue ? displayState(booking) : booking.group) + (selectedRow ? ' selected' : '')}>
              <div><strong>{formatPlateNumber(booking.truckPlate) || 'Chưa gán xe'}</strong><span>{booking.driverName}</span><small>{booking.bookingCode}</small></div>
              <div><span className="arrival-status">{label}</span>
                <small>Giờ hẹn: {time(booking.appointmentStart)}</small>
                {inQueue && <small className={'arrival-step ' + (booking.coordination?.tripConfirmed ? 'done' : 'todo')}>{booking.coordination?.tripConfirmed ? '✓' : '○'} {tripStepLabel(booking)}</small>}
                {booking.gateEntryOrder?.revokedAt
                  ? <small>Thu hồi lệnh: {time(booking.gateEntryOrder.revokedAt)}</small>
                  : booking.gateEntryOrder?.issuedAt && <small>Gọi vào cổng: {time(booking.gateEntryOrder.issuedAt)}</small>}
                {!inQueue && <small>{booking.containers.length} container</small>}</div>
            </button>
          })}
        </div>
        {totalPages > 1 && <nav aria-label="Phân trang danh sách xe" className="dispatch-pagination">
          <button type="button" disabled={busy || currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Trước</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstPageButton + index).map(number =>
            <button type="button" key={number} aria-label={`Trang ${number}`} aria-current={number === currentPage ? 'page' : undefined}
              disabled={busy} onClick={() => setPage(number)}>{number}</button>)}
          <button type="button" disabled={busy || currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Sau</button>
        </nav>}
      </section>
      <aside key={selected?.id || 'empty'} className="arrival-detail" aria-label="Chi tiết điều phối">
        {selection && <div className="arrival-detail-heading"><div><p className="arrival-eyebrow">CHI TIẾT ĐIỀU PHỐI</p><h2>{selected?.bookingCode || targetCode}</h2></div>
          <button type="button" disabled={busy} onClick={() => changeSelection(null)} aria-label="Đóng chi tiết">×</button></div>}
        {detailError && <div className="arrival-error" role="alert">{detailError} <button type="button" onClick={() => void reload()}>Thử lại</button></div>}
        {detailsLoading && <p className="arrival-empty" role="status">Đang tải chi tiết chuyến…</p>}
        {!selection && <div className="dispatch-no-selection"><span className="material-symbols-outlined" aria-hidden="true">route</span><h2>Chọn xe để theo dõi hành trình</h2><p>Lộ trình, các bước đã hoàn tất và việc cần làm sẽ hiển thị ở đây.</p></div>}
        {selected && <>
          <dl className="arrival-facts">
            <div><dt>Giờ hẹn</dt><dd>{time(selected.appointmentStart)} – {time(selected.appointmentEnd)}</dd></div>
            {entryOrder?.issuedAt && <div><dt>Gọi vào cổng</dt><dd>{time(entryOrder.issuedAt)}</dd></div>}
            {entryOrder?.revokedAt && <div><dt>Thu hồi lệnh</dt><dd>{time(entryOrder.revokedAt)}</dd></div>}
          </dl>
          {(selected.group === 'queue' || route) && <DispatchJourney booking={selected} route={route} />}
          {routesLoading && <p role="status" className="arrival-muted">Đang tải lộ trình xe…</p>}
          {routeError && <div className="arrival-error" role="alert">{routeError} <button type="button" onClick={() => void reload()}>Thử lại</button></div>}
          {selected.group !== 'queue' && !route && !routesLoading && !routeError &&
            <p className="arrival-muted">Chưa có lộ trình container cho chuyến này.</p>}
          {routes.length > 1 && <label className="dispatch-container-picker">Container<select value={route?.containerId || ''} onChange={event => setContainerId(event.target.value)}>{routes.map(item => <option key={item.containerId} value={item.containerId}>{item.containerNumber}</option>)}</select></label>}
          {route && <SmartRouteDetail selected={route} error={routeError} />}
          {selected.group === 'queue' && <>
          <div className="arrival-detail-tools"><span className={'arrival-status ' + displayState(selected)}>{statusLabel(selected)}</span>
          </div>
          <dl className="arrival-facts">
            <div><dt>Tài xế</dt><dd>{selected.driverName}</dd></div>
            <div><dt>Xe</dt><dd>{formatPlateNumber(selected.truckPlate) || 'Chưa gán'}</dd></div>
            <div><dt>Công ty</dt><dd>{selected.carrierName}</dd></div>
            {selected.description && <div><dt>Vị trí bãi</dt><dd>{selected.description}</dd></div>}
            <div><dt>Thao tác</dt><dd>{selected.bookingType?.toLowerCase() === 'pickup' ? 'Lấy container' : 'Giao container'}</dd></div>
            {selected.dispatch?.callExpiresAt && <div><dt>Hạn phản hồi</dt><dd>{time(selected.dispatch.callExpiresAt)}</dd></div>}
            {selected.dispatch?.acknowledgedAt && <div><dt>Đã nhận lệnh</dt><dd>{time(selected.dispatch.acknowledgedAt)}</dd></div>}
            {selected.gateEntryOrder&&<div><dt>Lệnh vào cổng</dt><dd>{({pending_ack:'Chờ tài xế nhận lệnh',active:'Được phép vào',expired:'Hết hạn',consumed:'Đã Gate In',revoked:'Đã thu hồi'})[selected.gateEntryOrder.status]||selected.gateEntryOrder.status} · Hạn {time(selected.gateEntryOrder.validUntil)}</dd></div>}
            {selected.coordination.isHeld && <div><dt>Chờ dự kiến đến</dt><dd>{time(selected.dispatch.holdUntil)}</dd></div>}
          </dl>
          <div className="arrival-cargo"><h3>Container / hàng hóa</h3>
            {selected.containers.map(c => <div key={c.id}><strong>{c.containerNo}</strong> · {c.containerType || '—'}<small>{c.cargoType || 'Chưa khai báo hàng'} · {c.grossWeightKg == null ? 'Chưa có tải trọng' : Number(c.grossWeightKg).toLocaleString('vi-VN') + ' kg'}</small></div>)}
            {!selected.containers.length && <p className="arrival-muted">Chưa có container liên kết.</p>}
          </div>
          {awaitingTrip(selected) && <div className="arrival-message" aria-live="polite">Tài xế chưa xác nhận chuyến vận chuyển. Xe sẽ hiện "Đã đến cổng" sau khi tài xế xác nhận chuyến và báo đã đến cổng.</div>}
          {selected.dispatch?.message && <div className="arrival-message" aria-live="polite">{selected.dispatch.message}</div>}
          <details className="dispatch-intervention"><summary>Can thiệp điều phối / gọi thủ công</summary>
          <label className="arrival-note">Hướng dẫn / lý do chờ
            <textarea rows="3" maxLength="500" value={note} onChange={e => setNote(e.target.value)} placeholder="Ví dụ: Tiếp tục chờ tại khu chờ, thiết bị đang phục vụ xe trước." />
          </label>
          <button type="button" className="arrival-call" disabled={busy || !selected.coordination.canCall || yard?.available === 0 || Boolean(detailError)} onClick={() => void act('call')}>{busy ? 'Đang gửi…' : 'Gọi tài xế'}</button>
          {yard?.available === 0 && <p className="arrival-muted">Đã đủ xe hoặc chỗ giữ cho lệnh vào. Chờ xe Gate Out để có chỗ.</p>}
          {!selected.coordination.canCall && <p className="arrival-muted">{selectedState === 'acknowledged'
            ? 'Xe đã có lệnh vào cổng. Khi lệnh hết hạn, hệ thống trả xe về sẵn sàng để gọi lại.'
            : selectedState === 'called' ? 'Đã gửi lệnh gọi, đang chờ tài xế nhận trên app trong 10 phút.'
            : 'Chỉ gọi khi tài xế đã xác nhận chuyến, báo đã đến cổng (từ 3 ngày trước giờ hẹn) và không còn thời gian chờ thêm.'}</p>}
          <div className="arrival-delay"><label>Chờ thêm (phút)<input type="number" min="1" max="120" value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
            <button type="button" disabled={busy || !canDelay || !note.trim() || Boolean(detailError)} onClick={() => void act('delay')}>Báo chờ thêm</button></div>
          {(['called','acknowledged'].includes(selectedState) || selected.dispatch?.holdUntil) && <button type="button" disabled={busy || Boolean(detailError)} onClick={() => void act('release')}>Thu hồi lệnh / bỏ thời gian chờ</button>}
          </details>
          {feedback && <p role="status" className={feedback.ok ? 'arrival-success' : 'arrival-error'}>{feedback.text}</p>}
          <p className="arrival-boundary">Lệnh vào còn hạn giữ một chỗ trong bãi. Gate In chuyển chỗ đã giữ thành xe trong bãi; Gate Out mới giải phóng chỗ.</p>
          </>}
          {route && <p className="arrival-boundary">Dùng cùng lịch hẹn đến Gate Out. Tài xế xác nhận đã đến và kiểm tra container; nhân viên bãi hoàn tất thao tác hàng. Điều độ theo dõi và xử lý ngoại lệ.</p>}
        </>}
      </aside>
    </div>
  </div>
}
