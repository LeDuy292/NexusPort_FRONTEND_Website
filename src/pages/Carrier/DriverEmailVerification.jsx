export default function DriverEmailVerification({ driver, onResend, busy = false, disabled = false }) {
  if (!driver.userId) return <span className="text-[10px] text-slate">Chưa có tài khoản</span>
  const verified = driver.emailVerified === true
  const expired = driver.invitationExpiresAt && new Date(driver.invitationExpiresAt) <= new Date()
  return <div className="flex flex-wrap items-center gap-2 text-[10px]" aria-label="Xác minh email tài xế">
    <span title={verified ? 'Tài xế đã xác nhận email' : 'Tài xế chưa xác nhận email'}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${verified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
      <span aria-hidden="true" className="material-symbols-outlined text-[13px]">{verified ? 'verified' : 'mark_email_unread'}</span>
      {verified ? 'Đã xác minh' : 'Chưa xác minh'}
    </span>
    {!verified && onResend && <button type="button" disabled={busy || disabled}
      onClick={event => { event.stopPropagation(); onResend(driver) }}
      title={`Gửi link xác nhận mới có hiệu lực 24 giờ đến ${driver.email || 'email tài xế'}`}
      className="font-semibold text-carbon underline underline-offset-2 hover:text-signal-orange disabled:opacity-50">
      {busy ? 'Đang gửi…' : 'Gửi lại link'}
    </button>}
    {!verified && expired && <span className="text-red-600">Link đã hết hạn</span>}
  </div>
}
