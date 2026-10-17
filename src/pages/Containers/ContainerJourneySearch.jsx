import { bookingService } from '../../services/bookingService'
import { useRef, useState } from 'react'
import { containerService } from '../../services/containerService'

const fieldClass = 'w-full rounded-xl border border-chalk bg-fog px-3.5 py-2.5 text-sm outline-none focus:ring-0 focus:border-signal-orange focus:bg-white'
const time = value => value ? new Date(value).toLocaleString('vi-VN') : '—'
const statusName = { planned: 'Đã lên kế hoạch', active: 'Đang lưu bãi', completed: 'Đã kết thúc', canceled: 'Đã hủy' }

export default function ContainerJourneySearch({ isTransport = false, onDeclare }) {
  const [filters, setFilters] = useState({ containerNumber: '', plateNumber: '', customerName: '', dateFrom: '', dateTo: '' })
  const [result, setResult] = useState(null)
  const [submitted, setSubmitted] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [gates, setGates] = useState([])
  const [gateId, setGateId] = useState('')
  const [gateNotice, setGateNotice] = useState('')
  const [companySearch, setCompanySearch] = useState('')
  const [companies, setCompanies] = useState([])
  const [accessNotice, setAccessNotice] = useState('')
  let canGateOut = false
  let canGrant = false
  try { canGateOut = ['Administrator','Admin','Gate Officer','Gate'].includes(JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}').role); canGrant = ['Administrator','Admin','Dispatcher'].includes(JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}').role) } catch { /* no staff grants */ }
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
    const params = { containerNumber: query.containerNumber.trim().toUpperCase(), page, limit: 20 }
    if (!isTransport) {
      Object.assign(params, { plateNumber: query.plateNumber, customerName: query.customerName,
        dateFrom: query.dateFrom ? new Date(`${query.dateFrom}T00:00:00`).toISOString() : undefined,
        dateTo: query.dateTo ? new Date(new Date(`${query.dateTo}T00:00:00`).setDate(new Date(`${query.dateTo}T00:00:00`).getDate() + 1)).toISOString() : undefined })
    }
    try {
      const data = await containerService.searchJourneys(params)
      if (id === requestId.current) { setResult(data); setSubmitted(query) }
    } catch (e) { if (id === requestId.current) { setError(e.message); setResult(null) } }
    finally { if (id === requestId.current) setLoading(false) }
  }
  const input = (label, key, type = 'text') => <label className="space-y-2 text-xs font-bold text-slate"><span>{label}</span><input type={type} className={fieldClass} value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })} maxLength={key === 'containerNumber' ? 11 : 250} /></label>
  return <div className={isTransport ? 'space-y-4' : 'space-y-4 p-6 lg:p-8'}>
    {!isTransport && <div><p className="text-xs font-bold uppercase tracking-wider text-signal-orange">Kho bãi · Tra cứu lịch sử</p><h1 className="mt-2 font-heading text-3xl font-bold text-carbon">Lượt lưu bãi Container</h1><p className="mt-2 text-sm text-slate">Mỗi dòng là một lượt bãi, gồm lịch đưa vào và lấy ra. Nhập điều kiện để tìm kiếm.</p></div>}
    <form onSubmit={e => { e.preventDefault(); search(filters) }} className="rounded-2xl border border-chalk bg-white p-5">
      <div className={`grid items-end gap-4 ${isTransport ? 'sm:grid-cols-[1fr_auto]' : 'md:grid-cols-3 xl:grid-cols-6'}`}>
        {input('Số Container', 'containerNumber')}
        {!isTransport && <>{input('Biển số xe', 'plateNumber')}{input('Khách hàng / chủ hàng', 'customerName')}{input('Từ ngày', 'dateFrom', 'date')}{input('Đến ngày', 'dateTo', 'date')}</>}
        <button disabled={loading} className="rounded-xl bg-signal-orange px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? 'Đang tìm…' : 'Tìm kiếm'}</button>
      </div>
      <p className="mt-3 text-xs text-slate">{isTransport ? 'Tra cứu dùng chung chỉ hiển thị số và loại Container. Thông tin khai báo hàng hóa nằm trong danh sách khai báo của công ty.' : 'Có thể nhập đầu số Container (từ 4 ký tự), biển số xe hoặc tên khách hàng. Ngày lọc theo thời điểm bắt đầu lượt bãi.'}</p>
    </form>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="overflow-hidden rounded-2xl border border-chalk bg-white">
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-fog text-xs uppercase text-slate"><tr>
        {(isTransport ? ['Số Container', 'Loại Container', 'Thao tác'] : ['Số Container / lượt bãi', 'Loại', 'Số xe', 'Khách hàng', 'Vào bãi', 'Ra bãi', 'Trạng thái', 'Thao tác']).map(h => <th className="px-5 py-4" key={h}>{h}</th>)}
      </tr></thead><tbody className="divide-y divide-chalk">
        {!result?.items?.length ? <tr><td colSpan={isTransport ? 3 : 8} className="px-5 py-16 text-center text-slate"><span className="material-symbols-outlined mb-3 block text-4xl">search</span>{loading ? 'Đang tìm kiếm…' : result ? 'Không có kết quả phù hợp.' : 'Chưa tải danh sách. Nhập điều kiện và bấm Tìm kiếm.'}</td></tr> : result.items.map(item => <tr key={item.id} className="hover:bg-fog">
          <td className="px-5 py-4 font-mono font-bold">{item.containerNumber}{!isTransport && <p className="mt-1 max-w-52 truncate text-xs font-normal text-slate" title={item.visitReference}>{item.visitReference}</p>}</td>
          <td className="px-5 py-4">{item.containerTypeCode}</td>
          {!isTransport && <><td className="px-5 py-4 font-mono text-xs">{[...new Set((item.bookings || []).map(b => b.plateNumber).filter(Boolean))].join(' / ') || '—'}</td><td className="px-5 py-4">{item.customerName || '—'}</td><td className="px-5 py-4 text-xs">{time(item.startedAt)}</td><td className="px-5 py-4 text-xs">{time(item.completedAt)}</td><td className="px-5 py-4"><span className="rounded-full bg-fog px-3 py-1 text-xs font-bold">{statusName[item.visitStatus] || item.visitStatus}</span></td></>}
          <td className="px-5 py-4"><button className="rounded-lg border border-chalk px-3 py-2 text-xs font-bold hover:border-signal-orange" onClick={() => isTransport ? onDeclare?.(item) : (setSelected(item),setAccessNotice(''),setCompanies([]))}>{isTransport ? 'Khai báo lần giao nhận' : 'Xem lượt bãi'}</button></td>
        </tr>)}
      </tbody></table></div>
      {result && <div className="flex items-center justify-between border-t border-chalk p-4 text-xs text-slate"><span>{result.total} kết quả · Trang {result.page}/{Math.max(1, result.totalPages)}</span><div className="flex gap-2"><button disabled={loading || result.page <= 1} onClick={() => search(submitted, result.page - 1)} className="rounded-lg border border-chalk px-3 py-2 disabled:opacity-40">Trước</button><button disabled={loading || result.page >= result.totalPages} onClick={() => search(submitted, result.page + 1)} className="rounded-lg border border-chalk px-3 py-2 disabled:opacity-40">Sau</button></div></div>}
    </div>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/60 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-label="Chi tiết lượt bãi" className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">{selected.containerNumber} · Lượt bãi</h2><button aria-label="Đóng" onClick={() => setSelected(null)} className="material-symbols-outlined p-2">close</button></div>
      <dl className="my-5 grid gap-4 rounded-xl bg-fog p-4 text-sm sm:grid-cols-3">{[['Chủ hàng', selected.customerName], ['Seal', selected.sealNumber], ['Tình trạng hàng', { full: 'Đầy hàng', empty: 'Rỗng', unknown: 'Chưa xác định' }[selected.loadStatus]], ['Khối lượng', selected.grossWeightKg == null ? null : `${selected.grossWeightKg} kg`], ['Điện yêu cầu', selected.requiredPowerKw == null ? null : `${selected.requiredPowerKw} kW`]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate">{label}</dt><dd className="mt-1 font-semibold">{value || '—'}</dd></div>)}</dl>
      <h3 className="my-3 font-bold">Booking vào / ra bãi</h3><div className="space-y-2">{(selected.bookings || []).map(b => <div className="grid gap-2 rounded-xl border border-chalk p-3 text-sm sm:grid-cols-3" key={b.id}><b>{b.bookingCode} · {b.bookingType === 'dropoff' ? 'Đưa vào bãi' : 'Lấy ra khỏi bãi'}</b><span>{b.plateNumber || 'Chưa gán xe'} · {b.status}</span><span>{time(b.appointmentStart)} → {time(b.appointmentEnd)}</span></div>)}{!selected.bookings?.length && <p className="text-sm text-slate">Chưa có booking được liên kết.</p>}</div>
      {canGateOut && selected.visitStatus==='active' && (selected.bookings||[]).some(b=>b.bookingType==='pickup'&&b.status==='completed') && <section className="my-4 rounded-xl border border-chalk p-4"><h3 className="font-bold">Xác nhận container ra khỏi cổng</h3><p className="my-2 text-xs text-slate">Chỉ thực hiện sau khi đã đối chiếu xe và giao nhận thực tế. Xác nhận sẽ kết thúc lượt bãi và phát hành biên nhận xuất.</p><button onClick={prepareGateOut} className="rounded-lg border border-chalk px-3 py-2 text-sm">Chọn cổng ra</button>{gates.length>0 && <div className="mt-3 flex flex-wrap gap-2"><select aria-label="Cổng ra" className={fieldClass} value={gateId} onChange={e=>setGateId(e.target.value)}><option value="">Chọn cổng</option>{gates.map(g=><option key={g.id} value={g.id}>{g.code} · {g.name}</option>)}</select>{(selected.bookings||[]).filter(b=>b.bookingType==='pickup'&&b.status==='completed').map(b=><button disabled={loading||!gateId} key={b.id} onClick={()=>completeGateOut(b.id)} className="rounded-lg bg-signal-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Xác nhận ra cổng · {b.bookingCode}</button>)}</div>}{gateNotice&&<p role="alert" className="mt-2 text-sm text-red-700">{gateNotice}</p>}</section>}
      <h3 className="my-4 font-bold">Biên nhận giao nhận</h3><div className="space-y-2">{(selected.receipts || []).map(r => <div key={r.id} className="grid gap-2 rounded-xl border border-chalk p-3 text-sm sm:grid-cols-3"><b>{r.referenceNo} · {r.activity === 'in' ? 'Nhập bãi' : 'Xuất bãi'}</b><span>{r.plateNumber || '—'} · {r.locationCode || 'Chưa ghi vị trí'}</span><span>{time(r.checkInAt)}<br />Seal: {r.sealNumber || '—'}<br />{r.customerName || '—'} · {r.cargoTypeName || '—'}<br />{r.grossWeightKg == null ? 'Chưa có khối lượng' : `${r.grossWeightKg} kg`}{r.requiredPowerKw != null && ` · ${r.requiredPowerKw} kW`}</span></div>)}{!selected.receipts?.length && <p className="text-sm text-slate">Chưa phát hành biên nhận.</p>}</div>
      {canGrant && ['planned','active'].includes(selected.visitStatus) && <section className="mt-5 border-t border-chalk pt-4"><h3 className="font-bold">Cấp quyền lấy container cho công ty vận tải</h3><p className="my-2 text-xs text-slate">Dùng khi một công ty khác thực hiện Pickup. Quyền này chỉ áp dụng cho lượt bãi đang xem.</p><div className="flex gap-2"><input aria-label="Tên công ty vận tải" value={companySearch} onChange={e=>setCompanySearch(e.target.value)} className={fieldClass} placeholder="Nhập tên công ty" /><button disabled={companySearch.trim().length<2} onClick={searchCompanies} className="whitespace-nowrap rounded-xl border border-chalk px-4 text-sm font-bold disabled:opacity-40">Tìm công ty</button></div><div className="mt-3 space-y-2">{companies.map(c=><button className="block w-full rounded-lg border border-chalk p-3 text-left text-sm hover:bg-fog" key={c.id} onClick={()=>grantAccess(c.id)}>Cấp quyền cho {c.name}</button>)}</div>{accessNotice && <p role="status" className="mt-3 text-sm">{accessNotice}</p>}</section>}
    </div></div>}
  </div>
}
