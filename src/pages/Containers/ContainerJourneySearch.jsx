import { bookingService } from '../../services/bookingService'
import { useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { containerService } from '../../services/containerService'
import { CONTAINER_TRANSPORT_ROLES, ROLES, YARD_VISIT_OPERATORS } from '../../routes/routeConfig'

const fieldClass = 'w-full rounded-xl border border-chalk bg-fog px-3.5 py-2.5 text-sm outline-none focus:ring-0 focus:border-signal-orange focus:bg-white'
const time = value => value ? new Date(value).toLocaleString('vi-VN') : '—'
const statusName = { planned: 'Đã lên kế hoạch', active: 'Đang lưu bãi', completed: 'Đã kết thúc', canceled: 'Đã hủy' }
const inactiveBookings = ['rejected', 'canceled', 'expired']
const bookingStatusName = {
  pending: 'Chờ xử lý', ready: 'Sẵn sàng', approved: 'Đã duyệt', checked_in: 'Đã vào cổng',
  in_progress: 'Đang thực hiện', completed: 'Đã hoàn tất', rejected: 'Đã từ chối',
  canceled: 'Đã hủy', expired: 'Đã hết hạn',
}
const actionClass = 'rounded-lg border border-chalk px-3 py-2 text-xs font-bold hover:border-signal-orange'

function VisitTiming({ actual, bookings, direction }) {
  const schedule = (bookings || []).filter(booking =>
    booking.bookingType === direction && booking.appointmentStart && !inactiveBookings.includes(booking.status))
  return <div className="space-y-1 whitespace-nowrap text-xs">
    <p><span className="text-slate">Thực tế</span> · {time(actual)}</p>
    {schedule.map(booking => <p key={booking.id} className="text-slate" title={`Đến ${time(booking.appointmentEnd)}`}>
      Kế hoạch · {time(booking.appointmentStart)}
    </p>)}
  </div>
}

export default function ContainerJourneySearch() {
  const [filters, setFilters] = useState({ containerNumber: '', plateNumber: '', customerName: '', dateFrom: '', dateTo: '', visitStatus: '' })
  const [result, setResult] = useState(null)
  const [submitted, setSubmitted] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [showEir, setShowEir] = useState(false)
  const [gates, setGates] = useState([])
  const [gateId, setGateId] = useState('')
  const [gateNotice, setGateNotice] = useState('')
  const [companySearch, setCompanySearch] = useState('')
  const [companies, setCompanies] = useState([])
  const [accessNotice, setAccessNotice] = useState('')
  const role = useOutletContext()?.role?.trim().toLowerCase()
  const hasRole = roles => roles.some(value => value.toLowerCase() === role)
  const canReadPrivate = hasRole(YARD_VISIT_OPERATORS)
  const canGateOut = hasRole([ROLES.ADMINISTRATOR, ROLES.GATE_OFFICER])
  const canGrant = hasRole([ROLES.ADMINISTRATOR, ROLES.DISPATCHER])
  const columns = ['Số container / lượt bãi', 'Loại', ...(canReadPrivate ? ['Số xe', 'Khách hàng'] : []),
    'Vào bãi', 'Ra bãi', 'Trạng thái', 'Thao tác']
  const relatedLink = hasRole([ROLES.DRIVER]) ? ['/driver-portal', 'Về trang tài xế']
    : hasRole(CONTAINER_TRANSPORT_ROLES) ? ['/transport/cargo-declarations', 'Bản khai hàng của công ty'] : null
  function openVisit(item, eir = false) {
    setSelected(item)
    setShowEir(eir)
    setAccessNotice('')
    setCompanies([])
    setCompanySearch('')
    setGates([])
    setGateId('')
    setGateNotice('')
  }
  const prepareGateOut = async () => {
    try{setGates(await containerService.getGates());setGateNotice('')}catch(e){setGateNotice(e.message)}
  }
  const completeGateOut = async bookingId => {
    setLoading(true)
    try{await bookingService.completeGateOut(bookingId,gateId);setSelected(null);setGateNotice('');await search(submitted)}catch(e){setGateNotice(e.response?.data?.Message || e.message)}finally{setLoading(false)}
  }
  const searchCompanies = async () => {
    try { setCompanies(await containerService.searchAccessCarriers(companySearch)); setAccessNotice('') } catch(e) { setAccessNotice(e.message) }
  }
  const grantAccess = async carrierId => {
    try { await containerService.grantVisitAccess(selected.id,carrierId); setAccessNotice('Đã cấp quyền tạo Pickup cho công ty đã chọn.'); setCompanies([]) } catch(e) { setAccessNotice(e.message) }
  }
  const requestId = useRef(0)
  const search = async (query, page = 1) => {
    const id = ++requestId.current
    setLoading(true); setError('')
    try {
      const lastDay = query.dateTo && new Date(`${query.dateTo}T00:00:00`)
      if (lastDay) lastDay.setDate(lastDay.getDate() + 1)
      const data = await containerService.searchYardVisits({
        page, limit: 20, visitStatus: query.visitStatus,
        containerNumber: query.containerNumber.toUpperCase().replace(/[\s-]+/g, ''),
        plateNumber: canReadPrivate ? query.plateNumber : undefined,
        customerName: canReadPrivate ? query.customerName : undefined,
        dateFrom: query.dateFrom ? new Date(`${query.dateFrom}T00:00:00`).toISOString() : undefined,
        dateTo: lastDay ? lastDay.toISOString() : undefined,
      })
      if (id === requestId.current) { setResult(data); setSubmitted(query) }
    } catch (e) { if (id === requestId.current) { setError(e.message); setResult(null) } }
    finally { if (id === requestId.current) setLoading(false) }
  }
  const input = (label, key, type = 'text') => <label className="space-y-2 text-xs font-bold text-slate"><span>{label}</span><input type={type} className={fieldClass} value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })} maxLength={key === 'containerNumber' ? 20 : 250} /></label>
  return <div className="space-y-4 p-6 lg:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="mt-2 font-heading text-3xl font-bold text-carbon">Tra cứu lượt bãi</h1>
        <p className="mt-2 text-sm text-slate">Xem lịch dự kiến, thời gian vào ra thực tế và EIR đã phát hành của từng lượt bãi.</p>
      </div>
      {relatedLink && <Link to={relatedLink[0]} className={`${actionClass} bg-white`}>{relatedLink[1]}</Link>}
    </header>
    <form onSubmit={e => { e.preventDefault(); search(filters) }} className="rounded-2xl border border-chalk bg-white p-5">
      <div className={`grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4 ${canReadPrivate ? '2xl:grid-cols-7' : 'xl:grid-cols-5'}`}>
        {input('Số container', 'containerNumber')}
        {canReadPrivate && input('Biển số xe', 'plateNumber')}
        {canReadPrivate && input('Khách hàng / chủ hàng', 'customerName')}
        <label className="space-y-2 text-xs font-bold text-slate">
          <span>Trạng thái lượt bãi</span>
          <select className={fieldClass} value={filters.visitStatus} onChange={e => setFilters({ ...filters, visitStatus: e.target.value })}>
            <option value="">Tất cả</option>
            {Object.entries(statusName).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {input('Từ ngày', 'dateFrom', 'date')}{input('Đến ngày', 'dateTo', 'date')}
        <button disabled={loading} className="rounded-xl bg-signal-orange px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? 'Đang tìm…' : 'Tìm kiếm'}</button>
      </div>
      <p className="mt-3 text-xs text-slate">Nhập ít nhất 4 ký tự đầu của số container hoặc chọn bộ lọc. Khoảng ngày áp dụng cho lịch hẹn và thời điểm vào hoặc ra bãi thực tế.</p>
    </form>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="overflow-hidden rounded-2xl border border-chalk bg-white">
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-fog text-xs uppercase text-slate"><tr>
        {columns.map(h => <th scope="col" className="px-5 py-4" key={h}>{h}</th>)}
      </tr></thead><tbody className="divide-y divide-chalk">
        {!result?.items?.length ? <tr><td colSpan={columns.length} className="px-5 py-16 text-center text-slate"><span className="material-symbols-outlined mb-3 block text-4xl">search</span>{loading ? 'Đang tìm kiếm…' : result ? 'Không có kết quả phù hợp.' : 'Nhập điều kiện và bấm Tìm kiếm để xem lượt bãi.'}</td></tr> : result.items.map(item => <tr key={item.id} className="hover:bg-fog">
          <td className="px-5 py-4 font-mono font-bold">{item.containerNumber}<p className="mt-1 max-w-52 truncate text-xs font-normal text-slate" title={item.visitReference}>{item.visitReference}</p></td>
          <td className="px-5 py-4">{item.containerTypeCode}</td>
          {canReadPrivate && <>
            <td className="px-5 py-4 font-mono text-xs">{[...new Set((item.bookings || []).map(b => b.plateNumber).filter(Boolean))].join(' / ') || '—'}</td>
            <td className="px-5 py-4">{item.customerName || '—'}</td>
          </>}
          <td className="px-5 py-4"><VisitTiming actual={item.startedAt} bookings={item.bookings} direction="dropoff" /></td>
          <td className="px-5 py-4"><VisitTiming actual={item.completedAt} bookings={item.bookings} direction="pickup" /></td>
          <td className="px-5 py-4"><span className="whitespace-nowrap rounded-full bg-fog px-3 py-1 text-xs font-bold">{statusName[item.visitStatus] || item.visitStatus}</span></td>
          <td className="px-5 py-4"><div className="flex flex-wrap gap-2">
            <button className={actionClass} onClick={() => openVisit(item)}>Xem lượt bãi</button>
            {!!item.receipts?.length && <button className={actionClass} onClick={() => openVisit(item, true)}>Xem EIR</button>}
          </div></td>
        </tr>)}
      </tbody></table></div>
      {result && <div className="flex items-center justify-between border-t border-chalk p-4 text-xs text-slate"><span>{result.total} kết quả · Trang {result.page}/{Math.max(1, result.totalPages)}</span><div className="flex gap-2"><button disabled={loading || result.page <= 1} onClick={() => search(submitted, result.page - 1)} className="rounded-lg border border-chalk px-3 py-2 disabled:opacity-40">Trước</button><button disabled={loading || result.page >= result.totalPages} onClick={() => search(submitted, result.page + 1)} className="rounded-lg border border-chalk px-3 py-2 disabled:opacity-40">Sau</button></div></div>}
    </div>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/60 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-label="Chi tiết lượt bãi" className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">{selected.containerNumber} · Lượt bãi</h2><button aria-label="Đóng" onClick={() => setSelected(null)} className="material-symbols-outlined p-2">close</button></div>
      <dl className="my-5 grid gap-4 rounded-xl bg-fog p-4 text-sm sm:grid-cols-3">
        {[
          ['Trạng thái', statusName[selected.visitStatus] || selected.visitStatus],
          ['Vào bãi thực tế', time(selected.startedAt)],
          ['Ra bãi thực tế', time(selected.completedAt)],
          ['Tình trạng hàng', { full: 'Đầy hàng', empty: 'Rỗng', unknown: 'Chưa xác định' }[selected.loadStatus]],
          ...(canReadPrivate ? [
            ['Chủ hàng', selected.customerName], ['Seal', selected.sealNumber],
            ['Khối lượng', selected.grossWeightKg == null ? null : `${selected.grossWeightKg} kg`],
            ['Điện yêu cầu', selected.requiredPowerKw == null ? null : `${selected.requiredPowerKw} kW`],
          ] : []),
        ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate">{label}</dt><dd className="mt-1 font-semibold">{value || '—'}</dd></div>)}
      </dl>
      <h3 className="my-3 font-bold">Lịch hẹn vào / ra bãi</h3>
      <div className="space-y-2">
        {(selected.bookings || []).map(b => <div className="grid gap-2 rounded-xl border border-chalk p-3 text-sm sm:grid-cols-3" key={b.id}>
          <b>{b.bookingCode && `${b.bookingCode} · `}{b.bookingType === 'dropoff' ? 'Đưa vào bãi' : 'Lấy ra khỏi bãi'}</b>
          <span>{b.plateNumber && `${b.plateNumber} · `}{bookingStatusName[b.status] || b.status}</span>
          <span>{time(b.appointmentStart)} → {time(b.appointmentEnd)}</span>
        </div>)}
        {!selected.bookings?.length && <p className="text-sm text-slate">Chưa có lịch hẹn để hiển thị.</p>}
      </div>
      {canGateOut && selected.visitStatus==='active' && (selected.bookings||[]).some(b=>b.bookingType==='pickup'&&b.status==='completed') && <section className="my-4 rounded-xl border border-chalk p-4"><h3 className="font-bold">Xác nhận container ra khỏi cổng</h3><p className="my-2 text-xs text-slate">Chỉ thực hiện sau khi đã đối chiếu xe và giao nhận thực tế. Xác nhận sẽ kết thúc lượt bãi và phát hành biên nhận xuất.</p><button onClick={prepareGateOut} className="rounded-lg border border-chalk px-3 py-2 text-sm">Chọn cổng ra</button>{gates.length>0 && <div className="mt-3 flex flex-wrap gap-2"><select aria-label="Cổng ra" className={fieldClass} value={gateId} onChange={e=>setGateId(e.target.value)}><option value="">Chọn cổng</option>{gates.map(g=><option key={g.id} value={g.id}>{g.code} · {g.name}</option>)}</select>{(selected.bookings||[]).filter(b=>b.bookingType==='pickup'&&b.status==='completed').map(b=><button disabled={loading||!gateId} key={b.id} onClick={()=>completeGateOut(b.id)} className="rounded-lg bg-signal-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Xác nhận ra cổng · {b.bookingCode}</button>)}</div>}{gateNotice&&<p role="alert" className="mt-2 text-sm text-red-700">{gateNotice}</p>}</section>}
      {selected.receipts?.length ? <details open={showEir || undefined} className="my-4">
        <summary className="cursor-pointer font-bold">Biên nhận giao nhận (EIR) · {selected.receipts.length}</summary>
        <div className="mt-3 space-y-2">
          {selected.receipts.map(r => <div key={r.id} className="grid gap-2 rounded-xl border border-chalk p-3 text-sm sm:grid-cols-3">
            <b>{r.referenceNo} · {r.activity === 'in' ? 'Nhập bãi' : 'Xuất bãi'}</b>
            <span>{r.plateNumber && `${r.plateNumber} · `}{r.locationCode || 'Chưa ghi vị trí'}</span>
            <div>
              <p>{time(r.activity === 'out' ? r.checkOutAt || r.checkInAt : r.checkInAt)}</p>
              {canReadPrivate && <>
                <p>Seal · {r.sealNumber || '—'}</p>
                <p>{r.customerName || '—'} · {r.cargoTypeName || '—'}</p>
                <p>{r.grossWeightKg == null ? 'Chưa có khối lượng' : `${r.grossWeightKg} kg`}{r.requiredPowerKw != null && ` · ${r.requiredPowerKw} kW`}</p>
              </>}
            </div>
          </div>)}
        </div>
      </details> : <p className="my-4 text-sm text-slate">Chưa có EIR để hiển thị.</p>}
      {canGrant && ['planned','active'].includes(selected.visitStatus) && <section className="mt-5 border-t border-chalk pt-4"><h3 className="font-bold">Cấp quyền lấy container cho công ty vận tải</h3><p className="my-2 text-xs text-slate">Dùng khi một công ty khác thực hiện Pickup. Quyền này chỉ áp dụng cho lượt bãi đang xem.</p><div className="flex gap-2"><input aria-label="Tên công ty vận tải" value={companySearch} onChange={e=>setCompanySearch(e.target.value)} className={fieldClass} placeholder="Nhập tên công ty" /><button disabled={companySearch.trim().length<2} onClick={searchCompanies} className="whitespace-nowrap rounded-xl border border-chalk px-4 text-sm font-bold disabled:opacity-40">Tìm công ty</button></div><div className="mt-3 space-y-2">{companies.map(c=><button className="block w-full rounded-lg border border-chalk p-3 text-left text-sm hover:bg-fog" key={c.id} onClick={()=>grantAccess(c.id)}>Cấp quyền cho {c.name}</button>)}</div>{accessNotice && <p role="status" className="mt-3 text-sm">{accessNotice}</p>}</section>}
    </div></div>}
  </div>
}
