import { useEffect, useState } from 'react'
import api from '../../../services/nodeApiClient'

const labels = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' }
export default function AccountRequests({ admin = false }) {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => api.get('/account-requests').then(setRows).catch(e => setError(e.message))
  useEffect(() => { load() }, [])
  const review = async (id, action) => {
    setBusy(true); setError('')
    try { await api.post(`/account-requests/${id}/${action}`, {}); await load() }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <section className="bg-white border border-chalk rounded-2xl p-5 space-y-4">
    <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Yêu cầu thêm tài xế</h2><button onClick={load} disabled={busy}>Làm mới</button></div>
    <p className="text-sm text-slate">Công ty cung cấp hồ sơ, tên đăng nhập và email. Admin duyệt mới tạo hồ sơ và tài khoản bị chặn. Tài xế phải mở liên kết email và tạo mật khẩu trong 24 giờ để đăng nhập.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!rows.length && <p className="text-slate">Chưa có yêu cầu.</p>}
    {rows.map(row => <article key={row.id} className="border rounded-xl p-4 space-y-2">
      <div className="flex justify-between gap-4"><strong>{row.profile.fullName} · {row.username}</strong><span>{labels[row.status]}</span></div>
      <p className="text-sm">{row.company_name} · {row.email}</p>
      <details className="text-sm"><summary className="cursor-pointer">Xem hồ sơ đề nghị</summary>
        <p>Điện thoại: {row.profile.phone} · CCCD: {row.profile.idCardNumber} · GPLX: {row.profile.licenseNumber}</p>
        <p>Hạn CCCD: {row.profile.idCardExpiryDate?.slice(0, 10) || 'Chưa cung cấp'} · Hạn GPLX: {row.profile.licenseExpiryDate?.slice(0, 10) || 'Chưa cung cấp'}</p>
        <div className="flex flex-wrap gap-3">{['photoUrl', 'idCardFrontUrl', 'idCardBackUrl', 'licenseImageUrl', 'licenseBackImageUrl'].map(k => row.profile[k] && <a key={k} href={row.profile[k]} target="_blank" rel="noreferrer" className="underline">{({photoUrl:'Ảnh tài xế',idCardFrontUrl:'CCCD trước',idCardBackUrl:'CCCD sau',licenseImageUrl:'GPLX trước',licenseBackImageUrl:'GPLX sau'})[k]}</a>)}</div>
      </details>
      {admin && row.status === 'pending' && <div className="flex gap-3"><button disabled={busy} className="bg-carbon text-white rounded-lg px-4 py-2" onClick={() => review(row.id, 'approve')}>Duyệt và gửi email</button><button disabled={busy} onClick={() => review(row.id, 'reject')}>Từ chối</button></div>}
      {row.status === 'approved' && <p className="text-sm">{row.invitation_pending ? 'Chờ tài xế liên kết tài khoản' : 'Tài khoản đã liên kết'}</p>}
      {admin && row.status === 'approved' && row.invitation_pending && <button disabled={busy} className="underline" onClick={() => review(row.id, 'resend')}>Gửi lại liên kết kích hoạt</button>}
    </article>)}
  </section>
}
