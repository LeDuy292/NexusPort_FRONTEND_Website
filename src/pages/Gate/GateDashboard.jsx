import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../../services/apiClient'
import { Card, Stat, Pill, Empty, ErrorBox, num, fmtDateTime, errText } from '../../components/admin/AdminUi'

const TRIP_TYPE = { pickup: 'Lấy hàng', dropoff: 'Hạ hàng' }
const BOOKING_STATUS = { approved: { label: 'Đã duyệt', tone: 'blue' }, ready: { label: 'Sẵn sàng', tone: 'green' } }
const TX_STATUS = {
  completed: { label: 'Thành công', tone: 'green' }, pending: { label: 'Đang xử lý', tone: 'blue' },
  blocked: { label: 'Bị chặn', tone: 'red' }, rejected: { label: 'Bị từ chối', tone: 'red' }, failed: { label: 'Thất bại', tone: 'red' },
}
const timeOnly = v => (v ? new Date(v).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—')
const when = v => (v ? new Date(v).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—')

export default function GateDashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/gate-overview/overview')
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
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load() }, 20000)
    return () => clearInterval(timer)
  }, [load])

  if (loading && !data) return <div className="p-8 text-sm text-slate-500">Đang tải số liệu cổng…</div>
  if (!data) return <div className="p-8"><ErrorBox>{error || 'Không tải được số liệu cổng.'}</ErrorBox></div>

  const { today, inPort, upcoming, gates, recent, failures, hourly } = data
  const activeGates = gates.filter(g => g.isActive)
  const maxHour = Math.max(1, ...hourly.map(h => h.gateIn + h.gateOut))

  return (
    <div className="p-6 md:p-8 w-full max-w-7xl mx-auto font-sans space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Tổng quan cổng</h2>
          <p className="text-xs text-slate-500 mt-0.5">Cập nhật {fmtDateTime(data.generatedAt)} · tự làm mới mỗi 20 giây</p>
        </div>
        <div className="flex gap-2">
          <Link to="/gate" className="px-4 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold inline-flex items-center">Mở cổng kiểm soát</Link>
          <button type="button" onClick={load} className="px-4 h-9 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 cursor-pointer">Làm mới</button>
        </div>
      </div>
      <ErrorBox>{error}</ErrorBox>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Xe vào cổng hôm nay" value={num(today.gateIn)} sub="Đã hoàn tất kiểm tra" tone="green" />
        <Stat label="Xe ra cổng hôm nay" value={num(today.gateOut)} sub="Đã hoàn tất kiểm tra" tone="blue" />
        <Stat label="Xe đang trong cảng" value={num(inPort.count)} sub="Đã vào, chưa ra cổng" tone="orange" />
        <Stat label="Lịch hẹn sắp đến" value={num(upcoming.count)} sub="Trong 24 giờ tới" tone="slate" />
        <Stat label="Lượt bị chặn hôm nay" value={num(today.blocked)} sub={today.blocked ? 'Xem bảng bên dưới' : 'Không có lượt nào bị chặn'} tone={today.blocked ? 'red' : 'slate'} />
      </div>

      {data.overdue > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{num(data.overdue)} lịch hẹn</strong> đã quá giờ nhưng xe chưa vào cổng trong 7 ngày qua.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Trạng thái các cổng" className="lg:col-span-2" right={<Pill tone="green">{activeGates.length} cổng hoạt động</Pill>}>
          {activeGates.length === 0 ? <Empty>Chưa cấu hình cổng nào.</Empty> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeGates.map(g => (
                <div key={g.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{g.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{g.code}{g.location ? ` · ${g.location}` : ''}</p>
                    </div>
                    <Pill tone="green">Hoạt động</Pill>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-50 py-2"><dt className="text-[10px] text-slate-500">Vào</dt><dd className="text-lg font-bold tabular-nums text-emerald-600">{g.gateIn}</dd></div>
                    <div className="rounded-lg bg-slate-50 py-2"><dt className="text-[10px] text-slate-500">Ra</dt><dd className="text-lg font-bold tabular-nums text-blue-600">{g.gateOut}</dd></div>
                    <div className="rounded-lg bg-slate-50 py-2"><dt className="text-[10px] text-slate-500">Bị chặn</dt><dd className={`text-lg font-bold tabular-nums ${g.blocked ? 'text-red-600' : 'text-slate-400'}`}>{g.blocked}</dd></div>
                  </dl>
                  <p className="mt-2 text-[11px] text-slate-500">Lượt gần nhất: {g.lastActivityAt ? when(g.lastActivityAt) : 'chưa có hôm nay'}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Lượt qua cổng theo giờ (hôm nay)">
          {hourly.length === 0 ? <Empty>Hôm nay chưa có lượt qua cổng.</Empty> : (
            <ul className="space-y-2">
              {hourly.map(h => (
                <li key={h.hour} className="flex items-center gap-3 text-xs">
                  <span className="w-10 tabular-nums text-slate-500">{String(h.hour).padStart(2, '0')}:00</span>
                  <div className="flex-1 flex h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="bg-emerald-500" style={{ width: `${(h.gateIn / maxHour) * 100}%` }} title={`${h.gateIn} xe vào`} />
                    <div className="bg-blue-500" style={{ width: `${(h.gateOut / maxHour) * 100}%` }} title={`${h.gateOut} xe ra`} />
                  </div>
                  <span className="w-8 text-right tabular-nums font-semibold text-slate-700">{h.gateIn + h.gateOut}</span>
                </li>
              ))}
              <li className="flex gap-4 pt-1 text-[11px] text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Vào</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-500" />Ra</span></li>
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Lịch hẹn sắp đến" right={<Link to="/gate/bookings" className="text-xs font-semibold text-orange-600 hover:underline">Xem tất cả</Link>}>
          {upcoming.list.length === 0 ? <Empty>Không có lịch hẹn nào trong 24 giờ tới.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-100"><th className="py-2 font-semibold">Biển số</th><th className="py-2 font-semibold">Tài xế</th><th className="py-2 font-semibold">Loại</th><th className="py-2 font-semibold">Hẹn lúc</th><th className="py-2 font-semibold">Trạng thái</th></tr></thead>
                <tbody>
                  {upcoming.list.map(b => {
                    const st = BOOKING_STATUS[b.status] || { label: b.status, tone: 'slate' }
                    return (
                      <tr key={b.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2.5 pr-3"><div className="font-semibold text-slate-900 tabular-nums">{b.plate || '—'}</div><div className="text-[11px] text-slate-500 truncate max-w-[160px]" title={b.carrier}>{b.carrier || '—'}</div></td>
                        <td className="py-2.5 pr-3 text-slate-700">{b.driver || '—'}</td>
                        <td className="py-2.5 pr-3 text-slate-700">{TRIP_TYPE[b.type] || b.type}</td>
                        <td className="py-2.5 pr-3 text-slate-600 tabular-nums">{when(b.appointmentStart)}</td>
                        <td className="py-2.5"><Pill tone={st.tone}>{st.label}</Pill></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Xe đang trong cảng" right={<Pill tone="blue">{inPort.count} xe</Pill>}>
          {inPort.list.length === 0 ? <Empty>Hiện không có xe nào trong cảng.</Empty> : (
            <ul className="space-y-3">
              {inPort.list.map(v => (
                <li key={v.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 tabular-nums">{v.plate || '—'} <span className="font-normal text-slate-500">· {TRIP_TYPE[v.type] || v.type}</span></p>
                    <p className="text-[11px] text-slate-500 truncate">{[v.driver, v.carrier].filter(Boolean).join(' · ') || v.code}</p>
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">từ {timeOnly(v.since)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Lượt qua cổng gần đây" className="lg:col-span-2" right={<Link to="/gate/history" className="text-xs font-semibold text-orange-600 hover:underline">Lịch sử kiểm soát</Link>}>
          {recent.length === 0 ? <Empty>Chưa có lượt qua cổng nào.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-100"><th className="py-2 font-semibold">Thời gian</th><th className="py-2 font-semibold">Cổng</th><th className="py-2 font-semibold">Biển số</th><th className="py-2 font-semibold">Container</th><th className="py-2 font-semibold">Kết quả</th></tr></thead>
                <tbody>
                  {recent.map(t => {
                    const st = TX_STATUS[t.status] || { label: t.status, tone: 'slate' }
                    return (
                      <tr key={t.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2.5 pr-3 text-slate-600 tabular-nums whitespace-nowrap">{when(t.checkedAt)}</td>
                        <td className="py-2.5 pr-3 text-slate-700">{t.gateName || (t.gateType === 'gate_out' ? 'Cổng ra' : 'Cổng vào')}</td>
                        <td className="py-2.5 pr-3 font-semibold tabular-nums text-slate-900">{t.plate || '—'}</td>
                        <td className="py-2.5 pr-3 tabular-nums text-slate-700">{t.container || '—'}</td>
                        <td className="py-2.5"><Pill tone={st.tone}>{st.label}</Pill>{t.blockReason ? <div className="mt-1 max-w-[220px] text-[11px] text-red-700">{t.blockReason}</div> : null}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Đối chiếu không đạt" right={<Link to="/gate/verification" className="text-xs font-semibold text-orange-600 hover:underline">Đối chiếu xe</Link>}>
          {failures.length === 0 ? <Empty>Không có lượt đối chiếu nào không đạt.</Empty> : (
            <ul className="space-y-3">
              {failures.map(f => (
                <li key={f.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold tabular-nums text-slate-900">{f.plate || '—'}</span><span className="text-[11px] text-slate-500 tabular-nums">{when(f.verifiedAt)}</span></div>
                  <p className="text-[11px] text-red-700 mt-0.5">{f.reason || 'Không đạt điều kiện'}{f.gateCode ? ` · ${f.gateCode}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
