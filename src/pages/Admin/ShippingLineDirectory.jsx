import { useEffect, useState } from 'react'
import { containerService } from '../../services/containerService'
import apiClient from '../../services/apiClient'

const empty = { id: '', fullName: '', shortName: '', prefixes: '', userIds: [] }
const emptyAccount = { email: '', fullName: '', username: '', password: '', sendEmail: true }
const randomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint32Array(10))
  return Array.from(bytes, b => chars[b % chars.length]).join('') + '#7'
}
const inputClass = 'w-full rounded-xl border border-chalk bg-fog px-3 py-2 text-sm focus:border-signal-orange focus:outline-none'

export default function ShippingLineDirectory() {
  const [lines, setLines] = useState([])
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState(empty)
  const [account, setAccount] = useState(emptyAccount)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    const [directory, users] = await Promise.all([
      containerService.getShippingLines(),
      containerService.getShippingLineAccounts(),
    ])
    setLines(directory)
    setAccounts(users)
  }

  useEffect(() => {
    load().catch(error => setError(error.message)).finally(() => setLoading(false))
  }, [])

  function edit(line) {
    setError('')
    setNotice('')
    setAccount(emptyAccount)
    setForm(line ? {
      ...line,
      prefixes: line.prefixes.join(', '),
      userIds: accounts.filter(account => account.shippingLineId === line.id).map(account => account.id),
    } : empty)
  }

  // Đặt lại mật khẩu ngẫu nhiên và gửi lại thông tin đăng nhập về email của tài khoản
  async function resend(accountItem) {
    if (!window.confirm(`Đặt lại mật khẩu của ${accountItem.username} và gửi thông tin đăng nhập mới về email của tài khoản này?`)) return
    setError('')
    setNotice('')
    setSaving(true)
    try {
      const res = (await apiClient.post(`/admin/shipping-line-accounts/${accountItem.id}/resend`, {})).data?.data
      setNotice(res.emailSent
        ? `Đã đặt lại mật khẩu và gửi thông tin đăng nhập tới ${res.email}.`
        : `Đã đặt lại mật khẩu của ${res.username} nhưng chưa gửi được email (${res.emailError || 'lỗi không xác định'}). Mật khẩu mới: ${res.newPassword} — hãy gửi cho người nhận bằng cách khác.`)
    } catch (e) {
      setError(e.response?.data?.message || e.message)
    } finally {
      setSaving(false)
    }
  }

  function field(key, value) {
    setForm(previous => ({ ...previous, [key]: value }))
  }

  async function save(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setSaving(true)
    try {
      const { id, fullName, shortName, prefixes, userIds } = form
      const line = await containerService.saveShippingLine(id, {
        fullName, shortName, prefixes: prefixes.split(/[\s,;]+/).filter(Boolean), userIds,
      })
      let message = `Đã lưu hồ sơ ${line.shortName}.`
      // Tạo tài khoản đăng nhập cho hãng tàu và gửi thông tin về email người nhận
      if (account.email.trim()) {
        const res = await apiClient.post('/admin/shipping-line-accounts', {
          shippingLineId: line.id || id,
          email: account.email.trim(),
          fullName: account.fullName.trim(),
          username: account.username.trim(),
          password: account.password,
          sendEmail: account.sendEmail,
        })
        const created = res.data?.data
        message += ` Đã tạo tài khoản ${created.username}`
        message += created.emailSent
          ? ` và gửi thông tin đăng nhập tới ${created.email}.`
          : account.sendEmail
            ? `, nhưng chưa gửi được email (${created.emailError || 'lỗi không xác định'}). Hãy gửi mật khẩu cho người nhận bằng cách khác.`
            : '.'
      }
      setForm(empty)
      setAccount(emptyAccount)
      setNotice(message)
      await load()
    } catch (error) {
      setError(error.response?.data?.message || (error.details ? Object.values(error.details).flat().join(' ') : error.message))
    } finally {
      setSaving(false)
    }
  }

  const availableAccounts = accounts.filter(account => !account.shippingLineId || account.shippingLineId === form.id)
  return (
    <main className="space-y-5 p-6 lg:p-8">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-chalk bg-white">
          <h2 className="border-b border-chalk p-4 font-bold">Hãng tàu đã đăng ký</h2>
          {loading && <p className="p-4 text-sm">Đang tải…</p>}
          {!loading && !lines.length && <p className="p-4 text-sm text-slate">Chưa có hãng tàu trong danh mục.</p>}
          <ul className="divide-y divide-chalk">
            {lines.map(line => <li key={line.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-bold">{line.shortName}</p>
                <p className="text-sm">{line.fullName}</p>
                <p className="mt-1 tabular-nums text-xs text-slate">{line.prefixes.join(' · ')}</p>
              </div>
              <button type="button" onClick={() => edit(line)} disabled={saving} className="rounded-lg border border-chalk px-3 py-2 text-sm font-bold">Sửa</button>
            </li>)}
          </ul>
        </section>
        <form onSubmit={save} className="space-y-4 rounded-2xl border border-chalk bg-white p-5">
          <h2 className="font-bold">{form.id ? 'Cập nhật hồ sơ hãng tàu' : 'Thêm hãng tàu'}</h2>
          <fieldset disabled={loading || saving} className="space-y-4">
            <label className="block space-y-1 text-sm font-semibold">
              <span>Tên đầy đủ</span>
              <input required maxLength={250} className={inputClass} value={form.fullName} onChange={event => field('fullName', event.target.value)} />
            </label>
            <label className="block space-y-1 text-sm font-semibold">
              <span>Tên viết tắt</span>
              <input required maxLength={80} className={inputClass} value={form.shortName} onChange={event => field('shortName', event.target.value)} />
            </label>
            <label className="block space-y-1 text-sm font-semibold">
              <span>Tiền tố BIC</span>
              <input required className={inputClass} placeholder="Ví dụ HAMU, HLCU" value={form.prefixes}
                onChange={event => field('prefixes', event.target.value.toUpperCase())} />
              <span className="block text-xs font-normal text-slate">Ngăn cách các tiền tố bằng dấu phẩy.</span>
            </label>
            <fieldset className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-chalk p-3">
              <legend className="text-sm font-semibold">Tài khoản Hãng tàu</legend>
              {availableAccounts.map(account => <div key={account.id} className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.userIds.includes(account.id)} onChange={event => field('userIds',
                    event.target.checked ? [...form.userIds, account.id] : form.userIds.filter(id => id !== account.id))} />
                  {account.fullName ? `${account.fullName} (${account.username})` : account.username}{!account.isActive && ' · Tạm khóa'}
                </label>
                {form.id && account.shippingLineId === form.id && (
                  <button type="button" className="shrink-0 rounded-lg border border-chalk px-2.5 py-1 text-xs font-bold" onClick={() => resend(account)}>
                    Gửi lại mật khẩu
                  </button>
                )}
              </div>)}
              {!availableAccounts.length && <p className="text-xs text-slate">Có thể tạo tài khoản Hãng tàu trong Quản lý người dùng.</p>}
            </fieldset>
            <fieldset className="space-y-3 rounded-xl border border-chalk p-3">
              <legend className="px-1 text-sm font-semibold">Tạo tài khoản đăng nhập mới (không bắt buộc)</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm font-semibold">
                  <span>Email người nhận</span>
                  <input type="email" className={inputClass} placeholder="ten@gmail.com" value={account.email}
                    onChange={event => setAccount(a => ({ ...a, email: event.target.value }))} />
                </label>
                <label className="block space-y-1 text-sm font-semibold">
                  <span>Họ và tên</span>
                  <input className={inputClass} maxLength={255} value={account.fullName} onChange={event => setAccount(a => ({ ...a, fullName: event.target.value }))} />
                </label>
                <label className="block space-y-1 text-sm font-semibold">
                  <span>Tên đăng nhập</span>
                  <input className={inputClass} maxLength={100} placeholder="Để trống: lấy phần trước @ của email" value={account.username}
                    onChange={event => setAccount(a => ({ ...a, username: event.target.value }))} />
                </label>
                <label className="block space-y-1 text-sm font-semibold">
                  <span>Mật khẩu</span>
                  <span className="flex gap-2">
                    <input type={showPassword ? 'text' : 'password'} required={Boolean(account.email.trim())} minLength={6} autoComplete="new-password"
                      className={inputClass} value={account.password} onChange={event => setAccount(a => ({ ...a, password: event.target.value }))} />
                    <button type="button" className="shrink-0 rounded-xl border border-chalk px-3 text-xs font-bold"
                      onClick={() => { setAccount(a => ({ ...a, password: randomPassword() })); setShowPassword(true) }}>Tạo ngẫu nhiên</button>
                  </span>
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-normal">
                <input type="checkbox" checked={account.sendEmail} onChange={event => setAccount(a => ({ ...a, sendEmail: event.target.checked }))} />
                Gửi thông tin đăng nhập (tên đăng nhập và mật khẩu) về email người nhận
              </label>
              <label className="flex items-center gap-2 text-xs font-normal text-slate">
                <input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />
                Hiện mật khẩu
              </label>
            </fieldset>
            <div className="flex gap-2">
              <button className="rounded-xl bg-signal-orange px-4 py-2.5 text-sm font-bold text-white">{saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
              {form.id && <button type="button" className="rounded-xl border border-chalk px-4 py-2.5 text-sm font-bold" onClick={() => edit(null)}>Thêm hãng khác</button>}
            </div>
          </fieldset>
        </form>
      </div>
    </main>
  )
}
