import React, { useState } from 'react'
import { Card, Stat, Pill, Empty, ErrorBox, adminApi, errText, fmtDateTime, num, useAdminData } from '../../components/admin/AdminUi'

const inputCls = 'w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100'

export default function GateManagement() {
  const { data: gates, loading, error, reload } = useAdminData('/gates', undefined, { refreshMs: 30000 })
  const [form, setForm] = useState({ code: '', name: '', location: '' })
  const [editing, setEditing] = useState(null) // { id, name, location }
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const run = async (fn, okText) => {
    setBusy(true); setErr(''); setMsg('')
    try { await fn(); setMsg(okText); await reload() } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }

  const create = (e) => {
    e.preventDefault()
    run(async () => { await adminApi.post('/gates', form); setForm({ code: '', name: '', location: '' }) }, 'Đã thêm cổng.')
  }
  const toggle = (g) => run(() => adminApi.patch(`/gates/${g.id}`, { isActive: !g.isActive }), g.isActive ? `Đã ngừng hoạt động cổng ${g.code}.` : `Đã kích hoạt cổng ${g.code}.`)
  const saveEdit = () => run(async () => { await adminApi.patch(`/gates/${editing.id}`, { name: editing.name, location: editing.location }); setEditing(null) }, 'Đã cập nhật cổng.')

  const list = gates || []
  const active = list.filter((g) => g.isActive).length
  const todayTotal = list.reduce((s, g) => s + g.todayCount, 0)

  return (
    <div className="p-6 md:p-8 w-full max-w-6xl mx-auto font-sans space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Tổng số cổng" value={num(list.length)} />
        <Stat label="Đang hoạt động" value={num(active)} tone="green" />
        <Stat label="Lượt qua cổng hôm nay" value={num(todayTotal)} tone="blue" />
      </div>

      {msg && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</div>}
      <ErrorBox>{err || error}</ErrorBox>

      <Card title="Danh sách cổng">
        {loading && !gates ? <Empty>Đang tải…</Empty> : list.length === 0 ? <Empty>Chưa có cổng nào.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                {['Mã cổng', 'Tên cổng', 'Vị trí', 'Hôm nay', 'Hoạt động gần nhất', 'Trạng thái', ''].map((h) => <th key={h} className="py-2 pr-4 font-semibold whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {list.map((g) => {
                  const isEdit = editing?.id === g.id
                  return (
                    <tr key={g.id} className="border-b border-slate-50 last:border-0 align-middle">
                      <td className="py-3 pr-4 font-semibold text-slate-900 tabular-nums whitespace-nowrap">{g.code}</td>
                      <td className="py-3 pr-4">{isEdit ? <input className={inputCls} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /> : g.name}</td>
                      <td className="py-3 pr-4 text-slate-600">{isEdit ? <input className={inputCls} value={editing.location || ''} onChange={(e) => setEditing({ ...editing, location: e.target.value })} /> : (g.location || '—')}</td>
                      <td className="py-3 pr-4 tabular-nums font-semibold">{num(g.todayCount)}</td>
                      <td className="py-3 pr-4 text-slate-500 tabular-nums whitespace-nowrap">{fmtDateTime(g.lastActivityAt)}</td>
                      <td className="py-3 pr-4"><Pill tone={g.isActive ? 'green' : 'slate'}>{g.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Pill></td>
                      <td className="py-3 text-right whitespace-nowrap">
                        {isEdit ? (
                          <span className="inline-flex gap-2">
                            <button type="button" disabled={busy} onClick={saveEdit} className="px-3 h-9 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer">Lưu</button>
                            <button type="button" onClick={() => setEditing(null)} className="px-3 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">Hủy</button>
                          </span>
                        ) : (
                          <span className="inline-flex gap-2">
                            <button type="button" onClick={() => setEditing({ id: g.id, name: g.name, location: g.location })} className="px-3 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">Sửa</button>
                            <button type="button" disabled={busy} onClick={() => toggle(g)} className="px-3 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-xs font-semibold text-slate-700 cursor-pointer">{g.isActive ? 'Ngừng' : 'Kích hoạt'}</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Thêm cổng mới">
        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Mã cổng *</span>
            <input className={`${inputCls} uppercase`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="GATE-03" maxLength={30} required /></label>
          <label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Tên cổng *</span>
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cổng vào làn 3" maxLength={120} required /></label>
          <label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Vị trí</span>
            <input className={inputCls} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Khu vực phía Bắc" maxLength={200} /></label>
          <button type="submit" disabled={busy} className="h-10 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer transition-colors">Thêm cổng</button>
        </form>
      </Card>
    </div>
  )
}
