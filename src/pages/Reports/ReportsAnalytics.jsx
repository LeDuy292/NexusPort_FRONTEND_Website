import React, { useState } from 'react'
import Select from '../../components/ui/Select'
import { Card, Stat, DailyBars, Donut, HBars, Meter, Empty, ErrorBox, money, num, fmtDateTime, useAdminData } from '../../components/admin/AdminUi'

const STATUS_LABEL = {
  pending: 'Chờ duyệt', approved: 'Đã duyệt', ready: 'Sẵn sàng', checked_in: 'Đã vào cổng', completed: 'Hoàn thành',
  canceled: 'Đã hủy', rejected: 'Từ chối', expired: 'Hết hạn',
}
const TYPE_LABEL = { pickup: 'nhận hàng', dropoff: 'hạ hàng' }

export default function ReportsAnalytics() {
  const [days, setDays] = useState(30)
  const { data, loading, error } = useAdminData('/reports', { days })

  const exportCsv = () => {
    if (!data) return
    const lines = [['Ngày', 'Lịch hẹn', 'Xe vào cổng', 'Xe ra cổng', 'Doanh thu (đ)'], ...data.daily.map((d) => [d.day, d.bookings, d.gateIn, d.gateOut, d.revenue])]
    const blob = new Blob([`﻿${lines.map((l) => l.join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bao-cao-${days}-ngay.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="p-6 md:p-8 w-full max-w-7xl mx-auto font-sans space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} size="md" className="w-44">
            <option value={7}>7 ngày gần nhất</option>
            <option value={30}>30 ngày gần nhất</option>
            <option value={90}>90 ngày gần nhất</option>
            <option value={180}>180 ngày gần nhất</option>
          </Select>
          {data && <span className="text-xs text-slate-500">Cập nhật {fmtDateTime(data.generatedAt)}</span>}
        </div>
        <button type="button" onClick={exportCsv} disabled={!data} className="px-4 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer">
          Xuất CSV
        </button>
      </div>

      <ErrorBox>{error}</ErrorBox>
      {loading && !data ? <div className="text-sm text-slate-500 py-10 text-center">Đang tải báo cáo…</div> : null}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Lịch hẹn" value={num(data.totals.bookings)} tone="blue" />
            <Stat label="Xe vào cổng" value={num(data.totals.gateIn)} tone="green" />
            <Stat label="Xe ra cổng" value={num(data.totals.gateOut)} />
            <Stat label="Doanh thu dịch vụ" value={money(data.totals.revenue)} tone="orange" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card title="Lịch hẹn và lưu lượng cổng theo ngày">
              <DailyBars data={data.daily} series={[{ key: 'bookings', label: 'Lịch hẹn', color: '#f97316' }, { key: 'gateIn', label: 'Vào cổng', color: '#3b82f6' }, { key: 'gateOut', label: 'Ra cổng', color: '#10b981' }]} />
            </Card>
            <Card title="Doanh thu dịch vụ theo ngày">
              <DailyBars data={data.daily} type="bar" formatValue={money} series={[{ key: 'revenue', label: 'Doanh thu', color: '#8b5cf6' }]} />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card title="Doanh nghiệp vận tải nhiều lịch hẹn nhất">
              <HBars rows={data.topCarriers.map((c) => ({ label: c.name, value: c.bookings }))} color="#f97316" />
            </Card>
            <Card title="Container theo hãng tàu">
              <HBars rows={data.containersByLine.map((c) => ({ label: c.name, value: c.containers }))} color="#3b82f6" />
            </Card>
            <Card title="Lưu lượng theo cổng">
              <Donut items={data.gateTraffic.map((g) => ({ label: g.name, value: g.n }))} centerLabel="Lượt qua cổng" size={140} thickness={20} empty="Chưa có lượt qua cổng trong kỳ." />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card title="Lịch hẹn theo trạng thái" className="lg:col-span-1">
              <Donut items={data.bookingStatus.map((b) => ({ label: `${STATUS_LABEL[b.status] || b.status} · ${TYPE_LABEL[b.type] || b.type}`, value: b.n }))} centerLabel="Lịch hẹn" size={140} thickness={20} empty="Chưa có lịch hẹn trong kỳ." />
            </Card>
            <Card title="Sự cố bãi theo loại" className="lg:col-span-1">
              <HBars rows={data.incidentsByType.map((i) => ({ label: i.name, value: i.n }))} color="#ef4444" empty="Không có sự cố trong kỳ." />
            </Card>
            <Card title="Mức dùng ô bãi theo block" className="lg:col-span-1">
              {data.yardBlocks.length === 0 ? <Empty /> : (
                <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {data.yardBlocks.filter((b) => b.total > 0).map((b) => {
                    const pct = Math.round((b.used / b.total) * 100)
                    return (
                      <li key={b.block} className="flex items-center gap-3 text-xs">
                        <span className="w-12 font-semibold text-slate-700 tabular-nums">{b.block}</span>
                        <div className="flex-1"><Meter value={b.used} max={b.total} /></div>
                        <span className="w-20 text-right text-slate-500 tabular-nums">{num(b.used)}/{num(b.total)}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
