import { useEffect, useState } from 'react'
import { containerService } from '../../services/containerService'

const empty = { id: '', fullName: '', shortName: '', prefixes: '', userIds: [] }
const inputClass = 'w-full rounded-xl border border-chalk bg-fog px-3 py-2 text-sm focus:border-signal-orange focus:outline-none'

export default function ShippingLineDirectory() {
  const [lines, setLines] = useState([])
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState(empty)
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
    setForm(line ? {
      ...line,
      prefixes: line.prefixes.join(', '),
      userIds: accounts.filter(account => account.shippingLineId === line.id).map(account => account.id),
    } : empty)
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
      setForm(empty)
      setNotice(`Đã lưu hồ sơ ${line.shortName}.`)
      await load()
    } catch (error) {
      setError(error.details ? Object.values(error.details).flat().join(' ') : error.message)
    } finally {
      setSaving(false)
    }
  }

  const availableAccounts = accounts.filter(account => !account.shippingLineId || account.shippingLineId === form.id)
  return (
    <main className="space-y-5 p-6 lg:p-8">
      <header>
        <h1 className="font-heading text-3xl font-bold text-carbon">Danh mục hãng tàu</h1>
        <p className="mt-2 text-sm text-slate">Quản lý tên đầy đủ, tên viết tắt, tiền tố BIC và tài khoản thuộc từng hãng.</p>
      </header>
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
                <p className="mt-1 font-mono text-xs text-slate">{line.prefixes.join(' · ')}</p>
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
              {availableAccounts.map(account => <label key={account.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.userIds.includes(account.id)} onChange={event => field('userIds',
                  event.target.checked ? [...form.userIds, account.id] : form.userIds.filter(id => id !== account.id))} />
                {account.fullName ? `${account.fullName} (${account.username})` : account.username}{!account.isActive && ' · Tạm khóa'}
              </label>)}
              {!availableAccounts.length && <p className="text-xs text-slate">Có thể tạo tài khoản Hãng tàu trong Quản lý người dùng.</p>}
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
