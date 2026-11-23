import React, { useState } from 'react'
import Select from '../../components/ui/Select'
import { Card, Stat, Pill, Empty, ErrorBox, money, num, fmtDateTime, useAdminData } from '../../components/admin/AdminUi'

const PAY_STATUS = {
  SUCCEEDED: { label: 'Đã thanh toán', tone: 'green' }, PENDING: { label: 'Chờ thanh toán', tone: 'amber' }, SUBMITTED: { label: 'Đang xử lý', tone: 'blue' },
  FAILED: { label: 'Thất bại', tone: 'red' }, CANCELLED: { label: 'Đã hủy', tone: 'slate' },
}

export default function BillingChargesManagement() {
  const [status, setStatus] = useState('')
  const [tab, setTab] = useState('payments')
  const { data, loading, error } = useAdminData('/billing', status ? { status } : undefined, { refreshMs: 30000 })

  return (
    <div className="p-6 md:p-8 w-full max-w-7xl mx-auto font-sans space-y-5">
      <ErrorBox>{error}</ErrorBox>
      {loading && !data ? <div className="text-sm text-slate-500 py-10 text-center">Đang tải dữ liệu thanh toán…</div> : null}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Đã thu (dịch vụ ePort)" value={money(data.paymentTotals.succeeded.amount)} sub={`${num(data.paymentTotals.succeeded.count)} giao dịch`} tone="green" />
            <Stat label="Đang chờ thanh toán" value={money(data.paymentTotals.pending.amount)} sub={`${num(data.paymentTotals.pending.count)} giao dịch`} tone="orange" />
            <Stat label="Phí đảo container đã thu" value={money(data.shiftingTotals.paid.amount)} sub={`${num(data.shiftingTotals.paid.count)} khoản`} tone="green" />
            <Stat label="Phí đảo container chưa thu" value={money(data.shiftingTotals.unpaid.amount)} sub={`${num(data.shiftingTotals.unpaid.count)} khoản`} tone={data.shiftingTotals.unpaid.count ? 'red' : 'slate'} />
          </div>

          <div className="inline-flex p-1 rounded-xl bg-slate-100" role="tablist">
            {[['payments', 'Thanh toán dịch vụ'], ['shifting', 'Phí đảo container'], ['tariff', 'Biểu phí']].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`px-3.5 h-9 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>
            ))}
          </div>

          {tab === 'payments' && (
            <Card title="Giao dịch thanh toán đơn dịch vụ" right={
              <Select value={status} onChange={(e) => setStatus(e.target.value)} size="sm" className="w-44">
                <option value="">Tất cả trạng thái</option>
                {Object.entries(PAY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>}>
              {data.payments.length === 0 ? <Empty>Chưa có giao dịch nào.</Empty> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      {['Mã giao dịch', 'Đơn dịch vụ', 'Doanh nghiệp', 'Số tiền', 'Trạng thái', 'Tạo lúc', 'Cập nhật'].map((h) => <th key={h} className="py-2 pr-4 font-semibold whitespace-nowrap">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {data.payments.map((p) => {
                        const st = PAY_STATUS[p.status] || { label: p.status, tone: 'slate' }
                        return (
                          <tr key={p.id} className="border-b border-slate-50 last:border-0">
                            <td className="py-2.5 pr-4 font-semibold text-slate-900 tabular-nums whitespace-nowrap">{p.number}</td>
                            <td className="py-2.5 pr-4 tabular-nums text-slate-700">{p.orderNumber || '—'}</td>
                            <td className="py-2.5 pr-4 text-slate-700">{p.company || '—'}</td>
                            <td className="py-2.5 pr-4 font-semibold tabular-nums whitespace-nowrap">{money(p.amount)}</td>
                            <td className="py-2.5 pr-4"><Pill tone={st.tone}>{st.label}</Pill></td>
                            <td className="py-2.5 pr-4 text-slate-500 tabular-nums whitespace-nowrap">{fmtDateTime(p.createdAt)}</td>
                            <td className="py-2.5 text-slate-500 tabular-nums whitespace-nowrap">{p.status === 'SUCCEEDED' ? fmtDateTime(p.paidAt) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {tab === 'shifting' && (
            <Card title="Phí đảo container chiều xuất">
              {data.shiftingCharges.length === 0 ? <Empty>Chưa phát sinh phí đảo container nào.</Empty> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      {['Mã phí', 'Container', 'Booking', 'Doanh nghiệp', 'Lý do', 'Số tiền', 'Trạng thái', 'Phát sinh'].map((h) => <th key={h} className="py-2 pr-4 font-semibold whitespace-nowrap">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {data.shiftingCharges.map((c) => (
                        <tr key={c.id} className="border-b border-slate-50 last:border-0">
                          <td className="py-2.5 pr-4 font-semibold tabular-nums whitespace-nowrap">{c.code}</td>
                          <td className="py-2.5 pr-4 tabular-nums">{c.containerNo}</td>
                          <td className="py-2.5 pr-4 tabular-nums text-slate-600">{c.bookingCode || '—'}</td>
                          <td className="py-2.5 pr-4 text-slate-700">{c.company || '—'}</td>
                          <td className="py-2.5 pr-4 text-slate-500 max-w-[260px] truncate" title={c.reason}>{c.reason || '—'}</td>
                          <td className="py-2.5 pr-4 font-semibold tabular-nums whitespace-nowrap">{money(c.amount)}</td>
                          <td className="py-2.5 pr-4"><Pill tone={c.status === 'PAID' ? 'green' : 'red'}>{c.status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</Pill></td>
                          <td className="py-2.5 text-slate-500 tabular-nums whitespace-nowrap">{fmtDateTime(c.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {tab === 'tariff' && (
            <Card title="Biểu phí đang áp dụng">
              <ul className="divide-y divide-slate-100">
                {data.tariff.map((t) => (
                  <li key={t.name} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="text-slate-800">{t.name}</span>
                    <span className="font-semibold tabular-nums text-slate-900">{money(t.amount)} <span className="text-slate-400 font-normal">/ {t.unit}</span></span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-500">Phí các dịch vụ ePort khác được quản lý tại mục &quot;Danh Mục &amp; Biểu Phí&quot;.</p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
