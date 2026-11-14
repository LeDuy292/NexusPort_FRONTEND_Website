import { useCallback, useEffect, useRef, useState } from 'react'
import { bookingService } from '../../services/bookingService'
import PrimaryButton from '../../components/PrimaryButton'

const vnDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
const time = value => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Chưa xác định'
const statusLabel = status => ({ pending: 'Chờ hoàn thiện', ready: 'Sẵn sàng', approved: 'Đã duyệt', checked_in: 'Đã vào cảng', Assigned: 'Đã phân công', Acknowledged: 'Đã nhận lệnh', DRAFT: 'Đã giữ lịch dịch vụ' })[status] || status
const fieldClass = 'w-full rounded-lg border border-chalk bg-white px-3 py-2 text-sm text-carbon focus:outline-none focus:ring-2 focus:ring-signal-orange'

export default function FleetSchedule({ onAssigned }) {
  const [date, setDate] = useState(vnDate)
  const [period, setPeriod] = useState('day')
  const [search, setSearch] = useState('')
  const [resource, setResource] = useState('all')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [assignmentError, setAssignmentError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const sequence = useRef(0)
  const editSequence = useRef(0)
  const closeRef = useRef(null)
  const load = useCallback(async () => {
    const id = ++sequence.current
    setLoading(true); setError('')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Chọn ngày để xem lịch trình.'); setLoading(false); return }
    const starts = { day: '00:00', morning: '06:00', afternoon: '12:00' }
    const ends = { day: '00:00', morning: '12:00', afternoon: '18:00' }
    const from = new Date(`${date}T${starts[period]}:00+07:00`)
    const to = new Date(`${date}T${ends[period]}:00+07:00`)
    if (period === 'day') to.setTime(to.getTime() + 86400000)
    try {
      const response = await bookingService.getFleetSchedule(from.toISOString(), to.toISOString())
      if (sequence.current === id) setData(response)
    } catch (e) { if (sequence.current === id) setError(e.message) }
    finally { if (sequence.current === id) setLoading(false) }
  }, [date, period])
  useEffect(() => {
    let mounted = true
    Promise.resolve().then(() => { if (mounted) load() })
    return () => { mounted = false; sequence.current += 1 }
  }, [load])
  const dialogOpen = Boolean(editing)
  useEffect(() => {
    if (!dialogOpen) return
    closeRef.current?.focus()
    const onKey = event => {
      if (event.key === 'Escape' && !saving) { editSequence.current++; setEditing(null) }
      if (event.key === 'Tab') {
        const nodes = [...event.currentTarget.querySelectorAll?.('[data-fleet-dialog] button:not(:disabled), [data-fleet-dialog] select:not(:disabled)') || []]
        if (nodes.length && event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1).focus() }
        else if (nodes.length && !event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0].focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dialogOpen, saving])

  const openAssignment = async item => {
    const id = ++editSequence.current
    setAssignmentError('')
    setEditing({ item, loading: true, driverId: item.driverId || '', truckId: item.vehicleId || '' })
    try {
      const [booking, fleet] = await Promise.all([bookingService.getBookingById(item.bookingId), bookingService.getAssignmentOptions(item.bookingId)])
      if (id === editSequence.current) setEditing(current => ({ ...current, booking, fleet, loading: false }))
    } catch (e) {
      if (id === editSequence.current) { setAssignmentError(e.message); setEditing(current => ({ ...current, loading: false })) }
    }
  }
  const save = async event => {
    event.preventDefault()
    if (saving || !editing?.booking) return
    setSaving(true); setAssignmentError('')
    try {
      await bookingService.assignBookingResources(editing.booking.id, { driverId: editing.driverId, truckId: editing.truckId,
        containerIds: editing.booking.containerIds, containerSelections: editing.booking.containerSelections })
      setEditing(null); setSuccess('Đã cập nhật phân công cho booking.'); await load(); onAssigned?.()
    } catch (e) { setAssignmentError(e.message) }
    finally { setSaving(false) }
  }

  const items = (data?.items || []).filter(item => {
    const query = search.trim().toLocaleLowerCase('vi')
    return (!query || [item.code, item.driverName, item.vehiclePlate].some(value => value?.toLocaleLowerCase('vi').includes(query)))
      && (resource === 'all' || (resource === 'drivers' ? item.driverId : item.vehicleId))
  })
  const busyDrivers = new Set((data?.items || []).map(i => i.driverId).filter(Boolean))
  const busyVehicles = new Set((data?.items || []).map(i => i.vehicleId).filter(Boolean))
  const freeDrivers = (data?.drivers || []).filter(d => d.isAvailable)
  const freeVehicles = (data?.vehicles || []).filter(v => v.isAvailable)
  const stats = [ ['Lịch trong khung giờ', data?.items.length], ['Tài xế có lịch', busyDrivers.size], ['Xe có lịch', busyVehicles.size], ['Sẵn sàng nhận việc', `${freeDrivers.length} tài xế · ${freeVehicles.length} xe`] ]

  return <section className="w-full min-w-0 max-w-full space-y-4" aria-label="Lịch trình tài xế và phương tiện">
    {success && <p role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">{success}</p>}
    {error && <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">{error} <button onClick={load} className="ml-3 underline font-bold">Thử lại</button></div>}
    <div className="grid min-w-0 grid-cols-2 md:grid-cols-4 gap-3 mb-6" aria-busy={loading}>
      {stats.map(([label, value], index) => <div key={label} className={'min-w-0 min-h-[106px] bg-white rounded-xl p-4 shadow-sm ' + (index === 3 ? 'border-2 border-green-500' : 'border border-chalk')}>
        <p className="text-[10px] font-bold text-slate uppercase">{label}</p>
        <p className={'mt-1 font-black ' + (index === 3 ? 'text-lg text-green-600' : 'text-2xl text-carbon')}>{loading || !data ? '—' : value}</p>
        <p className="text-[10px] text-slate mt-1">{['Booking, vận chuyển và dịch vụ', 'Tài xế đã được phân công', 'Phương tiện đang có lịch', 'Trong toàn bộ khung giờ chọn'][index]}</p>
      </div>)}
    </div>
    <div className="bg-white rounded-xl p-3 shadow-sm border border-chalk flex flex-col xl:flex-row gap-3 items-center min-w-0">
      <div className="relative w-full xl:flex-1 min-w-0">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate text-lg" aria-hidden="true">search</span>
        <input aria-label="Tìm lịch trình" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm booking, tài xế hoặc biển số…" className="w-full pl-10 pr-4 py-2 bg-fog border border-transparent rounded-lg text-xs focus:bg-white focus:border-carbon focus:ring-1 focus:ring-carbon outline-none" />
      </div>
      <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full xl:w-auto min-w-0">
        <label className="flex-1 min-w-0"><span className="sr-only">Ngày xem lịch (giờ Việt Nam)</span><input aria-label="Ngày xem lịch" type="date" value={date} onChange={e => { setDate(e.target.value); setSuccess('') }} className="w-full h-9 px-3 bg-fog border border-transparent rounded-lg text-xs font-bold text-carbon focus:bg-white focus:border-carbon outline-none" /></label>
        <select aria-label="Khung giờ" value={period} onChange={e => setPeriod(e.target.value)} className="flex-1 min-w-0 h-9 px-3 bg-fog border border-transparent rounded-lg text-xs font-bold text-carbon focus:bg-white focus:border-carbon outline-none">
          <option value="day">Cả ngày · 00:00 – 24:00</option><option value="morning">Buổi sáng · 06:00 – 12:00</option><option value="afternoon">Buổi chiều · 12:00 – 18:00</option>
        </select>
        <select aria-label="Lọc loại nguồn lực" value={resource} onChange={e => setResource(e.target.value)} className="flex-1 min-w-0 h-9 px-3 bg-fog border border-transparent rounded-lg text-xs font-bold text-carbon focus:bg-white focus:border-carbon outline-none"><option value="all">Tất cả nguồn lực</option><option value="drivers">Có tài xế</option><option value="vehicles">Có phương tiện</option></select>
      </div>
    </div>
    <p className="text-xs text-slate">Giờ Việt Nam. Nguồn lực rảnh không trùng lịch trong toàn bộ khung giờ chọn và đủ điều kiện hoạt động. Chuyến chưa kết thúc vẫn giữ lịch.</p>
    {loading ? <div role="status" className="min-h-60 flex items-center justify-center text-sm text-slate animate-pulse">Đang tải lịch trình đội xe…</div> : data && <>
      <div className="min-w-0 max-w-full rounded-xl border border-chalk bg-white overflow-hidden">
        <div className="p-4 border-b border-chalk"><h3 className="font-bold text-carbon">Lịch đã phân công</h3><p className="text-xs text-slate mt-1">Booking, chuyến vận chuyển và lịch dịch vụ đã giữ chỗ</p></div>
        {!items.length ? <div className="p-12 text-center"><span className="material-symbols-outlined text-4xl text-slate" aria-hidden="true">event_available</span><p className="font-bold mt-3 text-carbon">{data.items.length ? 'Không có lịch phù hợp bộ lọc' : 'Chưa có lịch trong khung giờ này'}</p><p className="mt-1 text-sm text-slate">Chọn ngày khác hoặc xem nguồn lực rảnh bên dưới.</p></div> : <div className="w-full max-w-full overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-fog text-xs text-slate"><tr>{['Chuyến / Booking', 'Thời gian', 'Tài xế', 'Phương tiện', 'Trạng thái', 'Phân công'].map(label => <th key={label} scope="col" className="px-5 py-3 whitespace-nowrap font-bold">{label}</th>)}</tr></thead><tbody className="divide-y divide-chalk">
          {items.map((item, index) => <tr key={`${item.source}-${item.id}-${index}`} className="hover:bg-fog/60"><td className="px-5 py-4"><p className="font-mono font-bold text-carbon whitespace-nowrap">{item.code}</p><p className="text-xs text-slate mt-1">{{ Booking: 'Booking cảng', Transport: 'Chuyến vận chuyển', Service: 'Đăng ký dịch vụ' }[item.source]}</p></td><td className="px-5 py-4 whitespace-nowrap"><p>{time(item.startsAt)}</p><p className="text-xs text-slate mt-1">đến {time(item.endsAt)}</p>{item.endsAt && new Date(item.endsAt) < new Date(data.generatedAt) && <span className="text-xs text-amber-700">Chưa kết thúc chuyến</span>}</td><td className="px-5 py-4">{item.driverName || <span className="text-amber-700">Chưa phân công</span>}</td><td className="px-5 py-4 font-mono font-bold whitespace-nowrap">{item.vehiclePlate || <span className="font-sans font-normal text-amber-700">Chưa phân công</span>}</td><td className="px-5 py-4"><span className="inline-block rounded-full bg-blue-50 text-blue-800 px-2.5 py-1 text-xs font-semibold whitespace-nowrap">{statusLabel(item.status)}</span></td><td className="px-5 py-4">{item.canReassign ? <PrimaryButton icon="edit_calendar" onClick={() => openAssignment(item)} className="whitespace-nowrap">Sửa phân công</PrimaryButton> : <span className="text-xs text-slate">Theo dõi chuyến</span>}</td></tr>)}
        </tbody></table></div>}
      </div>
      <div className="grid min-w-0 lg:grid-cols-2 gap-4">{[['Tài xế đang rảnh', freeDrivers, 'person'], ['Phương tiện đang rảnh', freeVehicles, 'local_shipping']].map(([title, rows, icon]) => <div key={title} className="min-w-0 rounded-xl border border-chalk bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><span className="material-symbols-outlined text-emerald-700" aria-hidden="true">{icon}</span><h3 className="font-bold text-carbon">{title}</h3><span className="ml-auto rounded-full bg-emerald-50 text-emerald-800 px-2.5 py-1 text-xs font-bold">{rows.length}</span></div>{rows.length ? <ul className="mt-4 divide-y divide-chalk max-h-72 overflow-y-auto">{rows.map(row => <li key={row.id} className="py-3 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-carbon">{row.label}</p>{row.phone && <a href={`tel:${row.phone}`} className="text-xs text-slate hover:underline">{row.phone}</a>}</div><span className="text-xs text-emerald-700">Sẵn sàng</span></li>)}</ul> : <p className="mt-4 text-sm text-slate">Không có nguồn lực đủ điều kiện rảnh trong khung giờ này.</p>}</div>)}</div>
      <p className="text-xs text-slate">Không hiển thị ở danh sách rảnh: {data.drivers.length - freeDrivers.length} tài xế và {data.vehicles.length - freeVehicles.length} xe đang bận hoặc chưa đủ điều kiện. Phân công theo booking không thay đổi tài xế mặc định của xe.</p>
    </>}
    {editing && <div className="fixed inset-0 z-[80] bg-carbon/40 backdrop-blur-sm p-4 flex items-center justify-center"><form data-fleet-dialog role="dialog" aria-modal="true" aria-labelledby="fleet-assignment-title" onSubmit={save} className="w-full max-w-lg rounded-2xl bg-white shadow-2xl p-6 space-y-5"><div className="flex justify-between gap-3"><div><h3 id="fleet-assignment-title" className="text-lg font-bold text-carbon">Sửa phân công</h3><p className="text-sm text-slate mt-1">{editing.item.code} · {time(editing.item.startsAt)}</p></div><button ref={closeRef} type="button" aria-label="Đóng" disabled={saving} onClick={() => { editSequence.current++; setEditing(null) }} className="text-slate">✕</button></div>
      <p className="text-xs text-slate">Chọn xe và tài xế rảnh trong lịch hẹn của booking. Hệ thống kiểm tra lại lịch trùng khi lưu. Booking đã vào cảng cần được xử lý theo quy trình vận hành.</p>
      {editing.loading ? <p role="status" className="text-sm text-slate">Đang kiểm tra nguồn lực rảnh…</p> : editing.fleet && <>
        <label className="block text-sm font-semibold space-y-2">Tài xế<select required disabled={saving} className={fieldClass} value={editing.driverId} onChange={e => setEditing({ ...editing, driverId: e.target.value })}><option value="">Chọn tài xế</option>{editing.fleet.drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.fullName}</option>)}</select></label>
        <label className="block text-sm font-semibold space-y-2">Phương tiện<select required disabled={saving} className={fieldClass} value={editing.truckId} onChange={e => setEditing({ ...editing, truckId: e.target.value })}><option value="">Chọn phương tiện</option>{editing.fleet.trucks.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber}</option>)}</select></label>
      </>}
      {assignmentError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{assignmentError}</p>}
      <PrimaryButton icon="save" size="md" loading={saving} type="submit" disabled={saving || editing.loading || !editing.fleet?.drivers.some(d => d.id === editing.driverId) || !editing.fleet?.trucks.some(v => v.id === editing.truckId)} className="w-full">{saving ? 'Đang lưu…' : 'Lưu phân công'}</PrimaryButton>
    </form></div>}
  </section>
}
