import React, { useCallback, useEffect, useState } from 'react'
import Select from '../../components/ui/Select'
import { getUsers, createUser, updateUser, assignRole, activateUser, deactivateUser } from '../../services/userService'
import { Card, Stat, Pill, Empty, ErrorBox, errText, fmtDateTime, num } from '../../components/admin/AdminUi'

const ROLES = [
  ['Administrator', 'Quản trị viên'], ['Dispatcher', 'Điều phối'], ['Yard Operator', 'Nhân viên bãi'], ['Gate Officer', 'Nhân viên cổng'],
  ['Shipping Line', 'Hãng tàu'], ['Transport Company', 'Doanh nghiệp vận tải'], ['Carrier Staff', 'Nhân viên doanh nghiệp'], ['Driver', 'Tài xế'],
]
const ROLE_LABEL = Object.fromEntries(ROLES)
const ROLE_TONE = { Administrator: 'violet', Dispatcher: 'blue', 'Yard Operator': 'amber', 'Gate Officer': 'amber', 'Shipping Line': 'blue', 'Transport Company': 'green', 'Carrier Staff': 'green', Driver: 'slate' }
const inputCls = 'w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
const EMPTY_FORM = { username: '', email: '', password: '', fullName: '', role: 'Dispatcher' }

export default function UserRoleManagement() {
  const [users, setUsers] = useState([])
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 })
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editing, setEditing] = useState(null) // { id, fullName, email }

  const load = useCallback(async () => {
    try {
      const res = await getUsers({ search: search.trim() || undefined, role, status, page, limit: 15 })
      const d = res?.data || res
      setUsers(d.users || [])
      setMeta({ total: d.total || 0, page: d.page || 1, totalPages: d.totalPages || 1 })
      setErr('')
    } catch (e) {
      setErr(errText(e))
    } finally {
      setLoading(false)
    }
  }, [search, role, status, page])

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])
  useEffect(() => { setPage(1) }, [search, role, status])

  const act = async (id, fn, okText) => {
    setBusyId(id); setErr(''); setMsg('')
    try { await fn(); setMsg(okText); await load() } catch (e) { setErr(errText(e)) } finally { setBusyId(null) }
  }

  const submitCreate = async (e) => {
    e.preventDefault()
    setErr(''); setMsg(''); setBusyId('new')
    try {
      await createUser({ ...form, isActive: true })
      setMsg(`Đã tạo tài khoản ${form.username}.`)
      setForm(EMPTY_FORM); setCreating(false)
      await load()
    } catch (e2) { setErr(errText(e2)) } finally { setBusyId(null) }
  }

  const saveEdit = () => act(editing.id, async () => { await updateUser(editing.id, { fullName: editing.fullName, email: editing.email }); setEditing(null) }, 'Đã cập nhật tài khoản.')

  return (
    <div className="p-6 md:p-8 w-full max-w-7xl mx-auto font-sans space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Tài khoản (theo bộ lọc)" value={num(meta.total)} />
        <Stat label="Trang hiện tại" value={`${meta.page} / ${meta.totalPages}`} />
      </div>

      {msg && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</div>}
      <ErrorBox>{err}</ErrorBox>

      <Card title="Tài khoản và phân quyền" right={
        <button type="button" onClick={() => setCreating((v) => !v)} className="px-4 h-9 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold cursor-pointer transition-colors">
          {creating ? 'Đóng biểu mẫu' : 'Thêm tài khoản'}
        </button>}>
        {creating && (
          <form onSubmit={submitCreate} className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Tên đăng nhập *</span>
              <input className={inputCls} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required minLength={3} maxLength={100} /></label>
            <label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Email *</span>
              <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Họ và tên</span>
              <input className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} maxLength={255} /></label>
            <label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Mật khẩu * (tối thiểu 6 ký tự)</span>
              <input type="password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} autoComplete="new-password" /></label>
            <label className="block"><span className="block text-xs font-semibold text-slate-600 mb-1.5">Vai trò *</span>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} size="md">
                {ROLES.filter(([k]) => k !== 'Driver').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select></label>
            <button type="submit" disabled={busyId === 'new'} className="h-10 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer">Tạo tài khoản</button>
            <p className="md:col-span-3 text-[11px] text-slate-500">Tài khoản tài xế được tạo từ trang quản lý tài xế của doanh nghiệp vận tải.</p>
          </form>
        )}

        <div className="flex flex-col md:flex-row gap-2 mb-4">
          <input className={`${inputCls} md:flex-1`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên đăng nhập, email, họ tên…" />
          <Select value={role} onChange={(e) => setRole(e.target.value)} size="md" className="md:w-52">
            <option value="all">Mọi vai trò</option>
            {ROLES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} size="md" className="md:w-44">
            <option value="all">Mọi trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Đã vô hiệu hóa</option>
          </Select>
        </div>

        {loading ? <Empty>Đang tải…</Empty> : users.length === 0 ? <Empty>Không có tài khoản phù hợp.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                {['Tài khoản', 'Email', 'Vai trò', 'Trạng thái', 'Tạo lúc', ''].map((h) => <th key={h} className="py-2 pr-4 font-semibold whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {users.map((u) => {
                  const isEdit = editing?.id === u.id
                  return (
                    <tr key={u.id} className="border-b border-slate-50 last:border-0 align-middle">
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-slate-900">{u.username}</div>
                        {isEdit ? <input className={`${inputCls} mt-1`} value={editing.fullName || ''} onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} placeholder="Họ và tên" /> : <div className="text-[11px] text-slate-500">{u.fullName || '—'}</div>}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{isEdit ? <input className={inputCls} value={editing.email || ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /> : u.email}</td>
                      <td className="py-3 pr-4">
                        {u.role === 'Driver' ? <Pill tone="slate">{ROLE_LABEL.Driver}</Pill> : (
                          <Select value={u.role} size="sm" className="w-48" disabled={busyId === u.id}
                            onChange={(e) => act(u.id, () => assignRole(u.id, e.target.value), `Đã đổi vai trò của ${u.username} thành ${ROLE_LABEL[e.target.value] || e.target.value}.`)}>
                            {ROLES.filter(([k]) => k !== 'Driver').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </Select>
                        )}
                      </td>
                      <td className="py-3 pr-4"><Pill tone={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Hoạt động' : 'Đã vô hiệu hóa'}</Pill></td>
                      <td className="py-3 pr-4 text-slate-500 tabular-nums whitespace-nowrap">{fmtDateTime(u.createdAt)}</td>
                      <td className="py-3 text-right whitespace-nowrap">
                        {isEdit ? (
                          <span className="inline-flex gap-2">
                            <button type="button" disabled={busyId === u.id} onClick={saveEdit} className="px-3 h-9 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer">Lưu</button>
                            <button type="button" onClick={() => setEditing(null)} className="px-3 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">Hủy</button>
                          </span>
                        ) : (
                          <span className="inline-flex gap-2">
                            <button type="button" onClick={() => setEditing({ id: u.id, fullName: u.fullName, email: u.email })} className="px-3 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">Sửa</button>
                            <button type="button" disabled={busyId === u.id}
                              onClick={() => act(u.id, () => (u.isActive ? deactivateUser(u.id) : activateUser(u.id)), u.isActive ? `Đã vô hiệu hóa ${u.username}.` : `Đã kích hoạt ${u.username}.`)}
                              className={`px-3 h-9 rounded-lg border bg-white disabled:opacity-60 text-xs font-semibold cursor-pointer ${u.isActive ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                              {u.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                            </button>
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

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
            <span className="tabular-nums">Trang {meta.page} / {meta.totalPages} · {num(meta.total)} tài khoản</span>
            <div className="flex gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Trang trước" className="h-8 w-8 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
              <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} aria-label="Trang sau" className="h-8 w-8 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
