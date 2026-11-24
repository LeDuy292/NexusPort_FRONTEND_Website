import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../../services/apiClient'
import { connectDispatcherRealtime } from '../../services/dispatcherRealtimeService'
import { Card, Stat, Pill, Meter, Donut, Empty, ErrorBox, num, fmtDateTime, errText } from '../../components/admin/AdminUi'

const PRIORITY = {
  Critical: { label: 'Khẩn cấp', tone: 'red' },
  High: { label: 'Cao', tone: 'amber' },
  Medium: { label: 'Trung bình', tone: 'blue' },
  Low: { label: 'Thấp', tone: 'slate' },
}
const TASK_STATUS = {
  Ready: { label: 'Sẵn sàng', tone: 'blue' },
  Assigned: { label: 'Đã giao', tone: 'violet' },
  InProgress: { label: 'Đang thực hiện', tone: 'amber' },
  Completed: { label: 'Hoàn thành', tone: 'green' },
  Cancelled: { label: 'Đã hủy', tone: 'slate' },
}
const EQUIPMENT_STATUS = {
  available: { label: 'Sẵn sàng', tone: 'green' },
  working: { label: 'Đang làm việc', tone: 'blue' },
  maintenance: { label: 'Bảo trì', tone: 'amber' },
}
const EQUIPMENT_TYPE = { RTG: 'Cẩu RTG', QC: 'Cẩu bờ QC', ReachStacker: 'Xe nâng Reach Stacker', RMG: 'Cẩu RMG' }
const SEVERITY = { CRITICAL: { label: 'Nghiêm trọng', tone: 'red' }, HIGH: { label: 'Cao', tone: 'amber' }, MEDIUM: { label: 'Trung bình', tone: 'blue' }, LOW: { label: 'Thấp', tone: 'slate' } }
const TRIP_TYPE = { pickup: 'Lấy hàng nhập', dropoff: 'Giao hàng xuất' }
const BOOKING_STATUS = { approved: { label: 'Đã duyệt', tone: 'blue' }, ready: { label: 'Sẵn sàng', tone: 'green' } }

const fmtTime = (v) => (v ? new Date(v).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—')
const fmtSlot = (v) => v || '—'
const cleanPlace = (v) => (v ? String(v).replace(/\s*\(.*\)\s*$/, '') : '—')

function barColor(pct) {
  if (pct >= 90) return '#ef4444'
  if (pct >= 75) return '#f59e0b'
  return '#10b981'
}

export default function DispatcherDashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [taskFilter, setTaskFilter] = useState('ALL')
  const reloadTimer = useRef(null)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/dispatcher/overview')
      setData(res.data?.data)
      setError('')
    } catch (e) {
      setError(errText(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load() }, 30000)
    return () => clearInterval(timer)
  }, [load])

  // Kênh realtime: khi có sự kiện mới thì ghi vào dòng sự kiện và làm mới số liệu (gộp trong 1 giây)
  useEffect(() => connectDispatcherRealtime((event) => {
    setEvents((cur) => [event, ...cur].slice(0, 8))
    clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(load, 1000)
  }, () => {}), [load])

  useEffect(() => () => clearTimeout(reloadTimer.current), [])

  if (loading && !data) return <div className="p-8 text-sm text-slate-500">Đang tải số liệu điều phối…</div>
  if (!data) return <div className="p-8"><ErrorBox>{error || 'Không tải được số liệu.'}</ErrorBox></div>

  const { tasks, vehicles, equipment, yard, incidents, gate } = data
  const queue = tasks.queue.filter((t) => taskFilter === 'ALL' || t.priority === taskFilter)
  const criticalCount = tasks.queue.filter((t) => t.priority === 'Critical').length
  const hotBlocks = yard.blocks.filter((b) => b.total && b.used / b.total >= 0.9)
  const equipmentByType = Object.values(equipment.list.reduce((acc, e) => {
    const k = e.type || 'Khác'
    acc[k] = acc[k] || { type: k, total: 0, available: 0 }
    acc[k].total += 1
    if (e.status === 'available') acc[k].available += 1
    return acc
  }, {}))

  return (
    <div className="p-6 md:p-8 w-full max-w-7xl mx-auto font-sans space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Tổng quan điều phối</h2>
          <p className="text-xs text-slate-500 mt-0.5">Cập nhật {fmtDateTime(data.generatedAt)} · tự làm mới mỗi 30 giây và khi có sự kiện mới</p>
        </div>
        <button type="button" onClick={load} className="px-4 h-9 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 cursor-pointer">Làm mới</button>
      </div>
      <ErrorBox>{error}</ErrorBox>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Lệnh bãi đang mở" value={num(tasks.open)} sub={`${num(tasks.inProgress)} đang thực hiện · ${num(tasks.completed)} đã xong`} tone="blue" />
        <Stat label="Lệnh khẩn cấp" value={num(criticalCount)} sub={criticalCount ? 'Cần ưu tiên điều phối' : 'Không có lệnh khẩn'} tone={criticalCount ? 'red' : 'slate'} />
        <Stat label="Xe đang trong cảng" value={num(vehicles.inPort)} sub={`${num(gate.gate_in)} vào · ${num(gate.gate_out)} ra hôm nay`} tone="green" />
        <Stat label="Xe sắp đến hôm nay" value={num(vehicles.arrivalsToday)} sub="Lịch hẹn đã duyệt / sẵn sàng" tone="orange" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Công suất bãi" value={`${yard.utilization}%`} sub={`${num(yard.usedSlots)} / ${num(yard.totalSlots)} ô đã dùng`} tone={yard.utilization >= 90 ? 'red' : 'orange'} />
        <Stat label="Thiết bị sẵn sàng" value={`${num(equipment.available)} / ${num(equipment.total)}`} sub={`${num(equipment.working)} đang làm · ${num(equipment.maintenance)} bảo trì`} tone="green" />
        <Stat label="Sự cố đang mở" value={num(incidents.open)} sub={incidents.open ? 'Xem tại mục Sự cố bãi' : 'Không có sự cố'} tone={incidents.open ? 'red' : 'slate'} />
        <Stat label="Xung đột vị trí đặt chỗ" value={num(data.conflicts)} sub={data.conflicts ? 'Cần xác nhận vị trí thay thế' : 'Không có xung đột'} tone={data.conflicts ? 'red' : 'slate'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card
          title="Lệnh bãi cần điều phối"
          className="lg:col-span-2"
          right={
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 text-xs font-semibold">
              {[['ALL', 'Tất cả'], ['Critical', 'Khẩn cấp'], ['High', 'Cao']].map(([k, label]) => (
                <button key={k} type="button" onClick={() => setTaskFilter(k)} className={`px-3 h-7 rounded-md cursor-pointer transition-colors ${taskFilter === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>
              ))}
            </div>
          }
        >
          {queue.length === 0 ? <Empty>Không có lệnh phù hợp.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="py-2 font-semibold">Container</th>
                    <th className="py-2 font-semibold">Công việc</th>
                    <th className="py-2 font-semibold">Vị trí đích</th>
                    <th className="py-2 font-semibold">Thiết bị / xe</th>
                    <th className="py-2 font-semibold">Ưu tiên</th>
                    <th className="py-2 font-semibold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((t) => {
                    const pr = PRIORITY[t.priority] || { label: t.priority, tone: 'slate' }
                    const st = TASK_STATUS[t.status] || { label: t.status, tone: 'slate' }
                    return (
                      <tr key={t.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2.5 pr-3"><div className="font-semibold text-slate-900 tabular-nums">{t.container || '—'}</div><div className="text-[11px] text-slate-500">{t.containerType || t.code}</div></td>
                        <td className="py-2.5 pr-3 text-slate-700">{t.type}<div className="text-[11px] text-slate-500 truncate max-w-[180px]" title={t.from}>{cleanPlace(t.from)}</div></td>
                        <td className="py-2.5 pr-3 font-semibold text-slate-900 tabular-nums">{fmtSlot(t.to)}</td>
                        <td className="py-2.5 pr-3 text-slate-700">{t.equipment || <span className="text-amber-600">Chưa gán thiết bị</span>}<div className="text-[11px] text-slate-500">{t.plate || '—'}</div></td>
                        <td className="py-2.5 pr-3"><Pill tone={pr.tone}>{pr.label}</Pill></td>
                        <td className="py-2.5"><Pill tone={st.tone}>{st.label}</Pill></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
            <Link to="/dispatcher/yard-discharge" className="px-3 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center">Kế hoạch dỡ tàu</Link>
            <Link to="/dispatcher/gate-bookings" className="px-3 h-9 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center">Lịch hẹn cổng</Link>
          </div>
        </Card>

        <Card title="Tiến độ lệnh bãi">
          <Donut
            items={tasks.byStatus.map((s) => ({ label: (TASK_STATUS[s.status] || {}).label || s.status, value: s.n }))}
            centerLabel="Lệnh"
            size={150}
            empty="Chưa có lệnh bãi."
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Công suất theo khối bãi" right={hotBlocks.length ? <Pill tone="red">{hotBlocks.length} khối ≥ 90%</Pill> : <Pill tone="green">Ổn định</Pill>} className="lg:col-span-2">
          {yard.blocks.length === 0 ? <Empty>Chưa có sơ đồ bãi.</Empty> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {yard.blocks.map((b) => {
                const pct = b.total ? Math.round((b.used / b.total) * 100) : 0
                return (
                  <div key={b.block}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-800">Khối {b.block}{b.reefer ? <span className="ml-1.5 text-sky-600 font-medium">· cont lạnh</span> : null}</span>
                      <span className="text-slate-500 tabular-nums">{b.used}/{b.total} ô</span>
                    </div>
                    <Meter value={b.used} max={b.total} color={barColor(pct)} />
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card title="Thiết bị bãi" right={<Link to="/yard-staff/movement-operations" className="text-xs font-semibold text-orange-600 hover:underline">Xem lệnh di chuyển</Link>}>
          {equipment.list.length === 0 ? <Empty>Chưa có thiết bị.</Empty> : (
            <ul className="space-y-2.5">
              {equipment.list.map((e) => {
                const st = EQUIPMENT_STATUS[e.status] || { label: e.status, tone: 'slate' }
                return (
                  <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{e.code}</div>
                      <div className="text-[11px] text-slate-500 truncate">{EQUIPMENT_TYPE[e.type] || e.type}{e.operator ? ` · ${e.operator}` : ''}</div>
                    </div>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </li>
                )
              })}
            </ul>
          )}
          {equipmentByType.length > 0 && (
            <p className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
              {equipmentByType.map((g) => `${EQUIPMENT_TYPE[g.type] || g.type}: ${g.available}/${g.total} sẵn sàng`).join(' · ')}
            </p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Xe đang trong cảng & sắp đến" className="lg:col-span-2" right={<Pill tone="blue">{vehicles.inPort} trong cảng</Pill>}>
          {vehicles.list.length === 0 && vehicles.arrivals.length === 0 ? <Empty>Không có xe trong cảng hoặc sắp đến.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="py-2 font-semibold">Biển số</th>
                    <th className="py-2 font-semibold">Tài xế</th>
                    <th className="py-2 font-semibold">Loại chuyến</th>
                    <th className="py-2 font-semibold">Doanh nghiệp</th>
                    <th className="py-2 font-semibold">Hẹn lúc</th>
                    <th className="py-2 font-semibold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {[...vehicles.list.map((v) => ({ ...v, inPort: true })), ...vehicles.arrivals].map((v) => {
                    const st = v.inPort ? { label: 'Đang trong cảng', tone: 'green' } : (BOOKING_STATUS[v.status] || { label: v.status, tone: 'slate' })
                    return (
                      <tr key={`${v.id}-${v.inPort ? 'in' : 'arr'}`} className="border-b border-slate-50 last:border-0">
                        <td className="py-2.5 pr-3 font-semibold text-slate-900 tabular-nums">{v.plate || '—'}</td>
                        <td className="py-2.5 pr-3 text-slate-700">{v.driver || '—'}</td>
                        <td className="py-2.5 pr-3 text-slate-700">{TRIP_TYPE[v.type] || v.type}</td>
                        <td className="py-2.5 pr-3 text-slate-600 max-w-[200px] truncate" title={v.carrier}>{v.carrier || '—'}</td>
                        <td className="py-2.5 pr-3 text-slate-600 tabular-nums">{fmtDateTime(v.appointmentStart)}</td>
                        <td className="py-2.5"><Pill tone={st.tone}>{st.label}</Pill></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Sự cố đang mở" right={<Link to="/dispatcher/yard-incidents" className="text-xs font-semibold text-orange-600 hover:underline">Xử lý</Link>}>
          {incidents.list.length === 0 ? <Empty>Không có sự cố đang mở.</Empty> : (
            <ul className="space-y-3">
              {incidents.list.map((i) => {
                const sv = SEVERITY[i.severity] || { label: i.severity, tone: 'slate' }
                return (
                  <li key={i.id} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 truncate">{i.type}</span>
                      <Pill tone={sv.tone}>{sv.label}</Pill>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{[i.container, i.location].filter(Boolean).join(' · ') || i.code} · {fmtDateTime(i.reportedAt)}</div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Lệnh vừa hoàn thành">
          {tasks.recentDone.length === 0 ? <Empty>Chưa có lệnh nào hoàn thành.</Empty> : (
            <ul className="space-y-2.5 text-sm">
              {tasks.recentDone.map((t) => (
                <li key={t.code} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 tabular-nums">{t.container}</span>
                    <span className="text-slate-500"> · {t.type}{t.location ? ` · ${t.location}` : ''}</span>
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">{fmtTime(t.doneAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Sự kiện vận hành trực tiếp" right={<Pill tone={events.length ? 'green' : 'slate'}>{events.length ? 'Đang nhận' : 'Chưa có sự kiện'}</Pill>}>
          {events.length === 0 ? <Empty>Sự kiện mới từ cổng, bãi và phương tiện sẽ hiện ở đây.</Empty> : (
            <ul className="space-y-2.5 text-sm">
              {events.map((e, idx) => (
                <li key={`${e.eventId || idx}-${e.domain}`} className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-800 truncate">{e.label || e.entityId || e.domain}</span>
                  <span className="text-xs text-emerald-700 font-semibold whitespace-nowrap">{e.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
