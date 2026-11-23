import React, { useMemo, useState } from 'react'
import Select from '../../components/ui/Select'
import { Card, Stat, Pill, Empty, ErrorBox, adminApi, errText, num, useAdminData } from '../../components/admin/AdminUi'

const TYPES = { RTG: 'Cẩu khung RTG', ReachStacker: 'Xe nâng chụp', EmptyHandler: 'Xe nâng vỏ', Forklift: 'Xe nâng càng', STS: 'Cẩu bờ STS', Tractor: 'Đầu kéo nội bãi', Other: 'Khác' }
const STATUS = {
  available: { label: 'Sẵn sàng', tone: 'green' }, working: { label: 'Đang làm việc', tone: 'blue' },
  maintenance: { label: 'Bảo trì', tone: 'amber' }, inactive: { label: 'Ngừng sử dụng', tone: 'slate' },
}
const inputCls = 'w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100'

export default function EquipmentManagement() {
  const { data, loading, error, reload } = useAdminData('/equipment', undefined, { refreshMs: 30000 })
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ code: '', name: '', type: 'RTG', block: '', description: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const list = data || []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return list.filter((e) => (!filter || e.status === filter) && (!q || [e.code, e.name, e.block, e.operatorName].filter(Boolean).join(' ').toLowerCase().includes(q)))
  }, [list, filter, search])
  const count = (s) => list.filter((e) => e.status === s).length

  const run = async (fn, okText) => {
    setBusy(true); setErr(''); setMsg('')
    try { await fn(); setMsg(okText); await reload() } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }
  const create = (e) => {
    e.preventDefault()
    run(async () => { await adminApi.post('/equipment', form); setForm({ code: '', name: '', type: 'RTG', block: '', description: '' }) }, 'Đã thêm thiết bị.')
  }
  const remove = (e) => { if (window.confirm(`Xóa thiết bị ${e.code}?`)) run(() => adminApi.del(`/equipment/${e.id}`), `Đã xóa thiết bị ${e.code}.`) }

  return (
    <div className="p-6 md:p-8 w-full max-w-7xl mx-auto font-sans space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Tổng thiết bị" value={num(list.length)} />
        <Stat label="Sẵn sàng" value={num(count('available'))} tone="green" />
        <Stat label="Đang làm việc" value={num(count('working'))} tone="blue" />
        <Stat label="Bảo trì" value={num(count('maintenance'))} tone="orange" />
        <Stat label="Ngừng sử dụng" value={num(count('inactive'))} />
      </div>

      {msg && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</div>}
      <ErrorBox>{err || error}</ErrorBox>

      <Card title="Danh sách thiết bị" right={
        <div className="flex flex-wrap items-center gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã, tên, block…" className={`${inputCls} w-52`} />
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} size="md" className="w-44">
            <option value="">Mọi trạng thái</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </div>}>
        {loading && !data ? <Empty>Đang tải…</Empty> : filtered.length === 0 ? <Empty>Không có thiết bị phù hợp.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                {['Mã', 'Tên thiết bị', 'Loại', 'Block', 'Người vận hành', 'Trạng thái', ''].map((h) => <th key={h} className="py-2 pr-4 font-semibold whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map((e) => {
                  const st = STATUS[e.status] || { label: e.status, tone: 'slate' }
                  return (
                    <tr key={e.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-3 pr-4 font-semibold text-slate-900 tabular-nums whitespace-nowrap">{e.code}</td>
                      <td className="py-3 pr-4"><div className="text-slate-800">{e.name}</div>{e.description ? <div className="text-[11px] text-slate-400">{e.description}</div> : null}</td>
                      <td className="py-3 pr-4 text-slate-600 whitespace-nowrap">{TYPES[e.type] || e.type}</td>
                      <td className="py-3 pr-4 tabular-nums text-slate-600">{e.block || '—'}</td>
                      <td className="py-3 pr-4 text-slate-600">{e.operatorName || '—'}</td>
                      <td className="py-3 pr-4">
                        <Select value={e.status} size="sm" className="w-40" disabled={busy}
                          onChange={(ev) => run(() => adminApi.patch(`/equipment/${e.id}`, { status: ev.target.value }), `Đã cập nhật trạng thái ${e.code}.`)}>
                          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </Select>
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <button type="button" disabled={busy} onClick={() => remove(e)} className="px-3 h-9 rounded-lg border border-red-200 bg-white hover:bg-red-50 disabled:opacity-60 text-xs font-semibold text-red-600 cursor-pointer">Xóa</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Thêm thiết bị mới">
        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Mã *</span>
            <input className={`${inputCls} uppercase`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="RTG-04" maxLength={30} required /></label>
          <label className="block md:col-span-2"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Tên thiết bị *</span>
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cẩu bánh lốp RTG 04" maxLength={150} required /></label>
          <label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Loại</span>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} size="md">
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select></label>
          <label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Block</span>
            <input className={`${inputCls} uppercase`} value={form.block} onChange={(e) => setForm({ ...form, block: e.target.value })} placeholder="A01" maxLength={20} /></label>
          <button type="submit" disabled={busy} className="h-10 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer transition-colors">Thêm</button>
        </form>
      </Card>
    </div>
  )
}
