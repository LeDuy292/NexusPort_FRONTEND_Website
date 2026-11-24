import React from 'react'
import { Link } from 'react-router-dom'
import { Card, Stat, Pill, DailyBars, Donut, Empty, ErrorBox, money, num, fmtDateTime, useAdminData } from '../../components/admin/AdminUi'

const BOOKING_STATUS = {
  pending: 'Chờ duyệt', approved: 'Đã duyệt', ready: 'Sẵn sàng', checked_in: 'Đã vào cổng', completed: 'Hoàn thành',
  canceled: 'Đã hủy', rejected: 'Từ chối', expired: 'Hết hạn',
}
const ROLE_LABEL = {
  Administrator: 'Quản trị viên', Dispatcher: 'Điều phối', Driver: 'Tài xế', 'Gate Officer': 'Nhân viên cổng', 'Shipping Line': 'Hãng tàu',
  'Transport Company': 'Doanh nghiệp vận tải', 'Yard Operator': 'Nhân viên bãi',
}

export default function AdminDashboard() {
  const { data, loading, error, reload } = useAdminData('/overview', undefined, { refreshMs: 30000 })

  if (loading && !data) return <div className="p-8 text-sm text-slate-500">Đang tải số liệu hệ thống…</div>
  if (!data) return <div className="p-8"><ErrorBox>{error || 'Không tải được số liệu.'}</ErrorBox></div>

  const yardPct = data.yard?.total ? Math.round((data.yard.used / data.yard.total) * 100) : 0
  const unpaidTotal = (data.finance.unpaidShifting.amount || 0)

  return (
    <div className="p-6 md:p-8 w-full max-w-7xl mx-auto font-sans space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Cập nhật {fmtDateTime(data.generatedAt)} · tự làm mới mỗi 30 giây</p>
        <button type="button" onClick={reload} className="px-4 h-9 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 cursor-pointer">Làm mới</button>
      </div>
      <ErrorBox>{error}</ErrorBox>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Lịch hẹn hôm nay" value={num(data.bookings.today)} sub={`Tổng ${num(data.bookings.total)} lịch hẹn`} tone="blue" />
        <Stat label="Xe vào cổng hôm nay" value={num(data.gate.gate_in)} sub={`${num(data.gate.gate_out)} xe ra cổng`} tone="green" />
        <Stat label="Công suất bãi" value={`${yardPct}%`} sub={data.yard ? `${num(data.yard.used)} / ${num(data.yard.total)} ô · ${num(data.yard.containers)} container` : 'Chưa tải được sơ đồ bãi'} tone="orange" />
        <Stat label="Sự cố đang mở" value={num(data.incidents.open)} sub={data.incidents.open ? 'Cần Dispatcher xử lý' : 'Không có sự cố'} tone={data.incidents.open ? 'red' : 'slate'} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Thu hôm nay" value={money(data.finance.paidToday.amount)} sub={`${num(data.finance.paidToday.count)} giao dịch`} tone="green" />
        <Stat label="Thu trong tháng" value={money(data.finance.paidMonth.amount)} sub={`${num(data.finance.paidMonth.count)} giao dịch`} tone="green" />
        <Stat label="Đơn dịch vụ chưa thanh toán" value={num(data.finance.unpaidOrders.count)} tone={data.finance.unpaidOrders.count ? 'red' : 'slate'} />
        <Stat label="Phí đảo container chưa thu" value={money(unpaidTotal)} sub={`${num(data.finance.unpaidShifting.count)} khoản`} tone={unpaidTotal ? 'red' : 'slate'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="7 ngày gần đây" className="lg:col-span-2">
          <DailyBars data={data.trend7d} height={170} series={[{ key: 'bookings', label: 'Lịch hẹn', color: '#f97316' }, { key: 'gateIn', label: 'Xe vào cổng', color: '#3b82f6' }]} />
        </Card>
        <Card title="Lịch hẹn theo trạng thái">
          <Donut items={data.bookings.byStatus.map((b) => ({ label: BOOKING_STATUS[b.status] || b.status, value: b.n }))} centerLabel="Lịch hẹn" size={150} empty="Chưa có lịch hẹn." />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Tài khoản theo vai trò" right={<Pill tone="green">{num(data.users.online)} đang trực tuyến</Pill>} className="lg:col-span-2">
          {data.users.byRole.length === 0 ? <Empty /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-100"><th className="py-2 font-semibold">Vai trò</th><th className="py-2 font-semibold text-right">Tổng</th><th className="py-2 font-semibold text-right">Hoạt động</th><th className="py-2 font-semibold text-right">Trực tuyến</th></tr></thead>
                <tbody>
                  {data.users.byRole.map((r) => (
                    <tr key={r.role} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 text-slate-800">{ROLE_LABEL[r.role] || r.role}</td>
                      <td className="py-2 text-right tabular-nums font-semibold">{r.total}</td>
                      <td className="py-2 text-right tabular-nums text-slate-600">{r.active}</td>
                      <td className="py-2 text-right tabular-nums text-emerald-600">{r.online}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Khai thác">
          <dl className="space-y-3 text-sm">
            {[
              ['Doanh nghiệp vận tải', `${data.carriers.active} / ${data.carriers.total} đang hoạt động`],
              ['Chuyến tàu', `${data.vessels.active} đang hoạt động / ${data.vessels.total}`],
              ['Tổng số tài khoản', num(data.users.total)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 border-b border-slate-50 pb-2 last:border-0">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-semibold text-slate-900 tabular-nums text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/reports" className="px-3 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center">Xem báo cáo</Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
