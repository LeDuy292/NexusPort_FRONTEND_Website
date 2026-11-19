import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { containerService } from '../../services/containerService'
import yardTaskService from '../../services/yardTaskService'

const VN_TZ = 'Asia/Ho_Chi_Minh'

function vietnamDateKey(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

function dayDifference(dateKey) {
  if (!dateKey) return null
  const today = vietnamDateKey(new Date())
  const [year, month, day] = dateKey.split('-').map(Number)
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number)
  return Math.floor((Date.UTC(todayYear, todayMonth - 1, todayDay) - Date.UTC(year, month - 1, day)) / 86400000)
}

function formatDateTime(value) {
  if (!value) return 'Chưa ghi nhận'
  return new Intl.DateTimeFormat('vi-VN', { timeZone: VN_TZ, dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function storageFor(visit) {
  if (visit.visitStatus !== 'active') return null
  const bookings = visit.bookings || []
  // Có lịch pickup (xe/tàu) KHÔNG đồng nghĩa cont đã rời bãi.
  // Chỉ dừng tính khi visit_status !== 'active' (sự kiện thực tế: Gate Out hoặc Loaded lên tàu).
  const booking = bookings.find(b => b.bookingType?.toLowerCase() === 'dropoff' && b.appointmentStart)
  if (!booking) return null
  const day = dayDifference(vietnamDateKey(booking.appointmentStart))
  return day === null || day < 0 ? null : { booking, day }
}

function getStatusStyle(visit) {
  if (visit.visitStatus === 'planned') return 'bg-amber-100 text-amber-800 border-amber-300'
  if (visit.visitStatus === 'completed') return 'bg-green-100 text-green-800 border-green-300'
  const storage = storageFor(visit)
  if (storage?.day >= 30) return 'bg-red-100 text-red-800 border-red-300'
  if (storage?.day >= 15) return 'bg-orange-100 text-orange-800 border-orange-300'
  if (storage?.day >= 5) return 'bg-red-100 text-red-700 border-red-300'
  if (storage?.day === 4) return 'bg-amber-100 text-amber-800 border-amber-300'
  return 'bg-blue-100 text-blue-800 border-blue-300'
}

function getVisitLabel(visit) {
  if (visit.visitStatus === 'planned') return 'Chưa vào bãi'
  if (visit.visitStatus === 'completed') return 'Đã rời bãi'
  return 'Đang trong bãi'
}

function getStorageLabel(visit) {
  const storage = storageFor(visit)
  if (!storage) return ''
  if (storage.day >= 30) return 'Tồn trên 30 ngày'
  if (storage.day >= 15) return 'Tồn trên 15 ngày'
  if (storage.day >= 5) return `Quá booking ${storage.day - 4} ngày`
  if (storage.day === 4) return 'Ngày cuối booking'
  return 'Trong 5 ngày booking'
}

export default function ContainerFlow() {
  const navigate = useNavigate()
  const [visits, setVisits] = useState([])
  const [tasks, setTasks] = useState([])
  const [relocations, setRelocations] = useState([])
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState('Tất cả')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalVisits, setTotalVisits] = useState(0)

  const reload = useCallback(async (requestedPage = 1) => {
    setLoading(true)
    setError('')
    const results = await Promise.allSettled([
      containerService.searchYardVisits({ sort: 'recentActivity', page: requestedPage, limit: 10 }),
      yardTaskService.getTasks(),
      yardTaskService.getRelocationTasks(),
      containerService.getYardOverview(),
    ])
    const [visitResult, taskResult, relocationResult, overviewResult] = results
    const failure = results.find(result => result.status === 'rejected')
    if (failure) setError(`Một số dữ liệu chưa tải được: ${failure.reason?.message || 'dịch vụ không phản hồi'}`)
    if (visitResult.status === 'fulfilled') {
      setVisits(visitResult.value?.items || [])
      setPage(visitResult.value?.page || requestedPage)
      setTotalPages(Math.max(1, visitResult.value?.totalPages || 1))
      setTotalVisits(visitResult.value?.total || 0)
    } else {
      setVisits([])
    }
    setTasks(taskResult.status === 'fulfilled' && Array.isArray(taskResult.value) ? taskResult.value : [])
    setRelocations(relocationResult.status === 'fulfilled' && Array.isArray(relocationResult.value) ? relocationResult.value : [])
    if (overviewResult.status === 'fulfilled') setOverview(overviewResult.value)
    setLoading(false)
  }, [])

  useEffect(() => { reload(1) }, [reload])

  const overdueVisits = useMemo(() => visits.filter(visit => visit.visitStatus === 'active' && storageFor(visit)?.day >= 5), [visits])
  const openTasks = useMemo(() => {
    const unique = new Map([...tasks, ...relocations].map(task => [task.id || task.taskCode, task]))
    return [...unique.values()].filter(task => !['completed', 'cancelled', 'canceled', 'failed'].includes(String(task.status || '').toLowerCase()))
  }, [relocations, tasks])

  const locationByContainer = useMemo(() => {
    const map = new Map()
    const finished = [...tasks, ...relocations]
      .filter(task => String(task.status || '').toLowerCase() === 'completed')
      .sort((a, b) => new Date(b.endTime || b.completedAt || 0) - new Date(a.endTime || a.completedAt || 0))
    for (const task of finished) {
      const container = String(task.containerNo || task.containerNumber || '').toUpperCase()
      const location = task.completedLocation || task.toLocation
      if (container && location && !map.has(container)) map.set(container, location)
    }
    return map
  }, [relocations, tasks])

  const rows = useMemo(() => visits.map(visit => {
    const storage = storageFor(visit)
    const booking = storage?.booking || visit.bookings?.find(item => item.bookingType?.toLowerCase() === 'dropoff')
    const receipts = visit.receipts || []
    const gateLocation = receipts.find(receipt => receipt.locationCode)?.locationCode
    const yardLocation = locationByContainer.get(String(visit.containerNumber || '').toUpperCase()) || gateLocation || ''
    const containerTasks = [...tasks, ...relocations].filter(task => String(task.containerNo || task.containerNumber || '').toUpperCase() === String(visit.containerNumber || '').toUpperCase())
    const recentTask = containerTasks.sort((a, b) => new Date(b.endTime || b.startTime || b.createdAt || 0) - new Date(a.endTime || a.startTime || a.createdAt || 0))[0]
    const taskBooking = (visit.bookings || []).find(item => item.bookingType?.toLowerCase() === 'dropoff')
    return {
      ...visit,
      storage,
      booking: booking || taskBooking,
      yardLocation,
      task: recentTask,
      label: getVisitLabel(visit),
      statusClass: getStatusStyle(visit),
      type: visit.containerTypeCode || 'Chưa rõ loại',
    }
  }), [locationByContainer, relocations, tasks, visits])

  const filteredRows = useMemo(() => rows.filter(row => {
    const overdue = row.storage?.day >= 5
    const filterMatches = filterStatus === 'Tất cả'
      || (filterStatus === 'Đang trong bãi' && row.visitStatus === 'active')
      || (filterStatus === 'Chưa vào bãi' && row.visitStatus === 'planned')
      || (filterStatus === 'Đã rời bãi' && row.visitStatus === 'completed')
      || (filterStatus === 'Sắp quá hạn' && row.storage?.day === 4)
      || (filterStatus === 'Quá hạn' && overdue)
      || (filterStatus === 'Tồn trên 15 ngày' && row.storage?.day >= 15)
      || (filterStatus === 'Tồn trên 30 ngày' && row.storage?.day >= 30)
      || (filterStatus === 'Có lệnh' && !!row.task && !['completed', 'cancelled', 'canceled', 'failed'].includes(String(row.task.status || '').toLowerCase()))
    const query = searchQuery.trim().toLowerCase()
    const matchesSearch = !query || [row.containerNumber, row.visitReference, row.customerName, row.booking?.bookingCode, row.yardLocation]
      .some(value => String(value || '').toLowerCase().includes(query))
    return filterMatches && matchesSearch
  }), [filterStatus, rows, searchQuery])

  const selectedContainer = filteredRows.find(row => row.id === selectedId) || rows.find(row => row.id === selectedId) || filteredRows[0] || null
  const selectedTasks = selectedContainer ? [...tasks, ...relocations].filter(task => String(task.containerNo || task.containerNumber || '').toUpperCase() === String(selectedContainer.containerNumber || '').toUpperCase()) : []
  const recentEvents = useMemo(() => visits.flatMap(visit => (visit.receipts || []).flatMap(receipt => [
    receipt.checkInAt && { id: `${receipt.referenceNo}-in-${visit.id}`, containerNumber: visit.containerNumber, at: receipt.checkInAt, label: 'Vào cổng', location: receipt.locationCode },
    receipt.checkOutAt && { id: `${receipt.referenceNo}-out-${visit.id}`, containerNumber: visit.containerNumber, at: receipt.checkOutAt, label: 'Rời cổng', location: receipt.locationCode },
  ].filter(Boolean))).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8), [visits])

  const filters = ['Tất cả', 'Đang trong bãi', 'Chưa vào bãi', 'Sắp quá hạn', 'Quá hạn', 'Tồn trên 15 ngày', 'Tồn trên 30 ngày', 'Có lệnh', 'Đã rời bãi']
  const stages = [
    { label: 'DỰ KIẾN VÀO HÔM NAY', count: Number(overview?.expectedInboundToday || 0), description: 'Booking Dropoff có lịch trong hôm nay', style: 'bg-amber-50/70 border-amber-400 text-amber-900' },
    { label: 'TỒN KHO HIỆN TẠI', count: Number(overview?.yardInventory || 0), description: 'Container đang được ghi nhận trong bãi', style: 'bg-blue-50/70 border-blue-400 text-blue-900' },
    { label: 'DỰ KIẾN RA HÔM NAY', count: Number(overview?.expectedOutboundToday || 0), description: 'Booking Pickup có lịch trong hôm nay', style: 'bg-purple-50/70 border-purple-400 text-purple-900' },
    { label: 'QUÁ HẠN', count: Number(overview?.overdue || 0), description: 'Đã hết 5 ngày giữ vị trí theo booking', style: 'bg-rose-50/70 border-rose-400 text-rose-900' },
  ]

  return <div className="p-6 w-full font-sans flex flex-col gap-6 relative">
    <div className="flex flex-col gap-4 bg-white border border-chalk rounded-2xl p-5 shadow-sm lg:flex-row lg:justify-between lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase">ĐIỀU HÀNH BÃI</span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> DỮ LIỆU HỆ THỐNG
          </span>
        </div>
        <h1 className="font-heading text-3xl text-carbon font-extrabold mt-1">Luồng Container Trong Bãi</h1>
        <p className="text-xs text-slate mt-0.5">Theo dõi lượt bãi, booking lưu vị trí, tình trạng quá hạn và công việc đang xử lý.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => reload(page)} disabled={loading} className="h-10 px-4 bg-white border border-chalk text-carbon rounded-xl font-bold text-xs hover:bg-fog disabled:opacity-50">{loading ? 'ĐANG TẢI…' : 'LÀM MỚI DỮ LIỆU'}</button>
        <button onClick={() => navigate('/yard-staff/movement-operations')} className="h-10 px-4 bg-carbon text-white rounded-xl font-bold text-xs hover:bg-black flex items-center gap-2"><span className="material-symbols-outlined text-base">swap_horiz</span>LỆNH DI CHUYỂN</button>
      </div>
    </div>

    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <div className="text-[11px] font-semibold text-slate">Bảng lấy tối đa 10 lượt có hoạt động gần nhất mỗi trang · {totalVisits} lượt trong danh sách · Trang {page}/{totalPages}. Tổng quan bãi không thay đổi khi phân trang.</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {[
        ['Dự kiến vào hôm nay', overview?.expectedInboundToday, 'text-amber-600'],
        ['Dự kiến ra hôm nay', overview?.expectedOutboundToday, 'text-purple-600'],
        ['Tồn kho hiện tại', overview?.yardInventory, 'text-blue-600'],
        ['Booking quá hạn', overview?.overdue, 'text-red-600'],
        ['Công việc bãi chưa xong', openTasks.length, 'text-green-600'],
      ].map(([label, value, color]) => <div key={label} className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
        <span className="text-slate text-[10px] uppercase font-bold tracking-wider">{label}</span>
        <div className={`text-3xl font-extrabold font-mono ${color}`}>{value === undefined ? '—' : Number(value || 0)}</div>
        {label === 'Công việc bãi chưa xong' && <p className="text-[10px] leading-4 text-slate">Lệnh đã giao hoặc đang làm như hạ bãi, nâng giao, chuyển ô; không phải booking chờ vào.</p>}
      </div>)}
    </div>

    <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap justify-between items-center border-b border-chalk pb-3 gap-2">
        <div><span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider">TÌNH HÌNH TÁC NGHIỆP</span><h2 className="font-heading text-lg font-extrabold text-carbon">Tổng quan luồng bãi</h2></div>
        <span className="text-xs text-slate font-mono">Ngày thống kê: {overview?.today ? formatDateTime(`${overview.today}T12:00:00Z`).split(' ')[0] : '—'}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
        {stages.map((stage, index) => <div key={stage.label} className={`text-left border-2 p-4 rounded-xl space-y-2 ${stage.style}`}>
          <div className="flex justify-between items-center font-bold"><span>{index + 1}. {stage.label}</span><span className="text-lg font-extrabold">{overview ? stage.count : '—'}</span></div>
          <p className="text-[11px] text-slate font-sans">{stage.description}</p>
        </div>)}
      </div>
    </div>

    {Number(overview?.overdue || 0) > 0 && <section className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <strong className="text-red-900 font-extrabold text-sm uppercase flex items-center gap-2"><span className="material-symbols-outlined text-red-600">notifications_active</span>BOOKING QUÁ HẠN CẦN THEO DÕI</strong>
        <span className="text-xs font-bold text-red-700">{overview?.overdue || 0} lượt booking quá hạn</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {overdueVisits.slice(0, 3).map(visit => {
          const storage = storageFor(visit)
          return <article key={visit.id} className="bg-white p-4 rounded-xl border border-red-200 shadow-sm space-y-2 text-xs">
            <div className="flex justify-between gap-2 font-bold"><span className="font-mono text-red-700">{visit.containerNumber}</span><span className="text-slate">Ngày {storage.day + 1}/5</span></div>
            <p className="text-[11px] text-graphite">Booking {storage.booking.bookingCode || '—'} · {visit.customerName || 'Chưa có tên khách hàng'}</p>
            <p className="text-[11px] font-semibold text-red-800">Quá hạn {storage.day - 4} ngày theo booking.</p>
          </article>
        })}
      </div>
      {overdueVisits.length === 0 && <p className="text-[11px] text-red-800">Không có container quá hạn trong 10 lượt đang xem. Có thể chuyển trang để xem các lượt cũ hơn.</p>}
      <p className="text-[11px] text-red-800">Tổng quá hạn lấy từ toàn bãi; danh sách minh họa chỉ lấy trong 10 lượt đang xem. Phí lưu bãi chưa được tính tại đây.</p>
    </section>}

    <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
      <div className="flex flex-wrap gap-1.5 text-xs font-bold">
        {filters.map(filter => <button key={filter} onClick={() => setFilterStatus(filter)} className={`px-3 py-1.5 rounded-full transition-colors ${filterStatus === filter ? 'bg-carbon text-white shadow-sm' : 'bg-fog text-slate hover:text-carbon border border-chalk'}`}>{filter}</button>)}
      </div>
      <div className="relative w-full md:w-80 shrink-0">
        <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate text-base">search</span>
        <input type="text" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Tìm số container, booking, vị trí…" className="w-full pl-9 pr-4 py-2 bg-fog border border-chalk rounded-xl text-xs font-medium focus:outline-none focus:border-signal-orange" />
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <section className="lg:col-span-8 bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap justify-between items-center border-b border-chalk pb-3 gap-2"><div><h2 className="font-heading text-lg font-extrabold text-carbon">Container và lượt bãi</h2><p className="text-[11px] text-slate mt-1">Nhấn vào một dòng để xem booking, lịch sử cổng và lệnh liên quan.</p></div><span className="text-xs text-slate font-mono">{filteredRows.length} / 10 lượt trang này</span></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left border-collapse text-xs">
            <thead><tr className="bg-fog text-slate font-bold uppercase text-[10px] border-b border-chalk"><th className="py-3 px-3">Container</th><th className="py-3 px-3">Booking / khách hàng</th><th className="py-3 px-3">Vị trí bãi</th><th className="py-3 px-3">Theo dõi booking</th><th className="py-3 px-3 text-right">Trạng thái</th></tr></thead>
            <tbody className="divide-y divide-chalk font-medium">
              {filteredRows.map(row => <tr key={row.id} onClick={() => setSelectedId(row.id)} className={`cursor-pointer transition-colors ${selectedContainer?.id === row.id ? 'bg-orange-50/80 border-l-4 border-l-signal-orange' : 'hover:bg-fog/60'}`}>
                <td className="py-3.5 px-3"><div className="font-mono font-bold text-carbon">{row.containerNumber}</div><div className="text-[10px] text-slate">{row.type} · {row.visitReference || 'Lượt bãi'}</div></td>
                <td className="py-3.5 px-3"><div className="font-mono text-carbon">{row.booking?.bookingCode || 'Chưa liên kết'}</div><div className="text-[10px] text-slate">{row.customerName || 'Chưa có khách hàng'}</div></td>
                <td className="py-3.5 px-3 font-mono text-graphite">{row.yardLocation || 'Chưa ghi nhận ô bãi'}</td>
                <td className="py-3.5 px-3">{row.storage ? <><div className="font-semibold">Ngày {row.storage.day + 1}/5</div><div className="text-[10px] text-slate">Booking: {formatDateTime(row.storage.booking.appointmentStart)}</div></> : <span className="text-[10px] text-slate">{row.visitStatus === 'planned' ? 'Chưa bắt đầu lưu bãi' : 'Chưa đủ dữ liệu booking'}</span>}</td>
                <td className="py-3.5 px-3 text-right"><div className="flex flex-col items-end gap-1"><span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${row.statusClass}`}>● {row.label}</span>{row.storage && <span className={`text-[10px] font-bold ${row.storage.day >= 5 ? 'text-red-700' : row.storage.day === 4 ? 'text-amber-700' : 'text-slate'}`}>{getStorageLabel(row)}</span>}</div></td>
              </tr>)}
              {!loading && filteredRows.length === 0 && <tr><td colSpan="5" className="py-10 text-center text-slate">Không có lượt bãi phù hợp.</td></tr>}
              {loading && <tr><td colSpan="5" className="py-10 text-center text-slate">Đang tải dữ liệu từ hệ thống…</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-chalk pt-4">
          <span className="text-[11px] text-slate">Mỗi lần tải chỉ lấy 10 lượt; backend sắp theo hoạt động mới nhất.</span>
          <div className="flex items-center gap-2">
            <button onClick={() => reload(page - 1)} disabled={loading || page <= 1} className="rounded-lg border border-chalk px-3 py-2 text-xs font-bold text-carbon hover:bg-fog disabled:cursor-not-allowed disabled:opacity-40">Trước</button>
            <span className="min-w-20 text-center text-xs font-mono text-slate">{page} / {totalPages}</span>
            <button onClick={() => reload(page + 1)} disabled={loading || page >= totalPages} className="rounded-lg border border-chalk px-3 py-2 text-xs font-bold text-carbon hover:bg-fog disabled:cursor-not-allowed disabled:opacity-40">Tiếp</button>
          </div>
        </div>
      </section>

      <aside className="lg:col-span-4 space-y-5">
        <section className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-4">
          <div className="border-b border-chalk pb-3"><span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider">CHI TIẾT LƯỢT BÃI</span><h2 className="font-heading text-xl font-extrabold text-carbon mt-1">{selectedContainer?.containerNumber || 'Chọn container'}</h2><p className="text-xs text-slate font-mono mt-1">{selectedContainer ? `${selectedContainer.type} · ${selectedContainer.visitReference || 'Chưa có mã lượt'}` : 'Chọn một container trong danh sách'}</p></div>
          {selectedContainer && <>
            <div className="bg-fog p-4 rounded-xl border border-chalk space-y-2 text-xs">
              <div className="flex justify-between gap-3"><span className="text-slate">Trạng thái bãi:</span><strong>{getVisitLabel(selectedContainer)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-slate">Trạng thái booking:</span><strong>{getStorageLabel(selectedContainer) || 'Chưa có booking lưu bãi'}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-slate">Booking:</span><strong className="font-mono">{selectedContainer.booking?.bookingCode || '—'}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-slate">Khách hàng:</span><strong>{selectedContainer.customerName || '—'}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-slate">Ô bãi:</span><strong className="text-signal-orange font-mono">{selectedContainer.yardLocation || 'Chưa ghi nhận'}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-slate">Bắt đầu lượt:</span><strong>{formatDateTime(selectedContainer.startedAt)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-slate">Hoàn tất lượt:</span><strong>{formatDateTime(selectedContainer.completedAt)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-slate">Booking giữ vị trí đến:</span><strong>{selectedContainer.storage ? formatDateTime(selectedContainer.storage.booking.appointmentStart) : 'Chưa có'}</strong></div>
            </div>
            <div className="space-y-2"><h3 className="text-[10px] font-bold text-slate uppercase">LỆNH TÁC NGHIỆP LIÊN QUAN</h3>
              {selectedTasks.slice(0, 4).map(task => <div key={task.id || task.taskCode} className="rounded-lg border border-chalk p-3 text-xs"><div className="flex justify-between gap-2"><strong className="font-mono">{task.taskCode || task.shiftingReason || 'Lệnh bãi'}</strong><span className="capitalize text-slate">{String(task.status || '—').replaceAll('_', ' ')}</span></div><div className="mt-1 text-slate">{task.fromLocation || task.sourceBlockCode || '—'} → {task.completedLocation || task.toLocation || task.targetBlockCode || '—'}</div></div>)}
              {selectedTasks.length === 0 && <p className="text-xs text-slate">Chưa có lệnh liên quan đến container này.</p>}
            </div>
          </>}
          <button onClick={() => navigate('/yard-staff/movement-operations')} className="w-full h-10 bg-signal-orange text-white rounded-xl font-bold text-xs hover:opacity-95">MỞ QUẢN LÝ LỆNH DI CHUYỂN →</button>
        </section>

        <section className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-3">
          <div className="border-b border-chalk pb-3"><h2 className="font-heading text-base font-extrabold text-carbon">Sự kiện vào / ra gần đây</h2><p className="text-[10px] text-slate mt-1">Theo biên nhận EIR đã phát hành</p></div>
          <div className="space-y-3">{recentEvents.map(event => <div key={event.id} className="flex gap-3 text-xs"><span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-signal-orange"></span><div className="min-w-0"><div className="font-bold text-carbon">{event.label} · <span className="font-mono">{event.containerNumber}</span></div><div className="text-[10px] text-slate">{formatDateTime(event.at)}{event.location ? ` · ${event.location}` : ''}</div></div></div>)}
            {!loading && recentEvents.length === 0 && <p className="text-xs text-slate">Chưa có sự kiện cổng gần đây.</p>}</div>
        </section>
      </aside>
    </div>

    <p className="text-[11px] text-slate">Mốc lưu bãi đang theo booking 5 ngày: ngày booking tính là ngày đầu. Hệ thống hiện theo dõi và thông báo; phí lưu bãi chưa được tính tại trang này.</p>
  </div>
}
