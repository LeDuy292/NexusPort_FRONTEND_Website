import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import driverService from '../../services/driverService'

export default function ActivateAccount() {
  // Keep the bearer capability out of server request URLs and referrer headers.
  const [token] = useState(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') || ''
    return value
  })
  useEffect(() => { window.history.replaceState(null, '', window.location.pathname) }, [])
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault(); setError('')
    if (password !== confirmation) return setError('Mật khẩu xác nhận chưa khớp.')
    setBusy(true)
    try { await driverService.activateAccount({token, password}); setDone(true) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <main className="min-h-screen bg-fog flex items-center justify-center p-6">
    <div className="bg-white border border-chalk rounded-2xl p-8 w-full max-w-md space-y-5">
      <h1 className="text-2xl font-bold">Liên kết tài khoản tài xế</h1>
      {done ? <><p>Đã liên kết tài khoản và tạo mật khẩu thành công.</p><Link className="underline" to="/login">Đăng nhập</Link></> : <form onSubmit={submit} className="space-y-4">
        <p>Đặt mật khẩu mới từ 10 đến 72 ký tự. Liên kết chỉ dùng một lần trong 24 giờ.</p>
        {!token && <p role="alert">Thiếu liên kết kích hoạt. Hãy mở liên kết trong email.</p>}
        <label className="block">Mật khẩu mới<input className="border rounded-lg p-3 w-full" required type="password" autoComplete="new-password" minLength={10} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label className="block">Nhập lại mật khẩu<input className="border rounded-lg p-3 w-full" required type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button disabled={busy || !token} className="bg-carbon text-white rounded-lg p-3 w-full">{busy ? 'Đang liên kết…' : 'Liên kết và tạo mật khẩu'}</button>
      </form>}
    </div>
  </main>
}
