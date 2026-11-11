import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Mail, RefreshCw, ShieldCheck } from 'lucide-react'
import { draftError, serviceDraftsApi } from './serviceDraftsApi'

export default function ServiceSourceEmailPanel({ draftId, request, onVerified, onBusy, recipientEmail }) {
  const [challenge, setChallenge] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [retryAt, setRetryAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const started = useRef(false)
  const sending = useRef(false)
  const current = useRef({ request, onVerified, onBusy })
  current.current = { request, onVerified, onBusy }

  const send = useCallback(async (resend = false) => {
    if (sending.current) return
    sending.current = true
    setBusy(true)
    current.current.onBusy(true)
    setError('')
    try {
      const status = await serviceDraftsApi.emailStatus(draftId, current.current.request)
      if (status.verified) {
        current.current.onVerified()
        return
      }
      if (status.challenge) {
        setChallenge(status.challenge)
        setRetryAt(Date.now() + status.challenge.retryAfterSeconds * 1000)
        if (!resend || status.challenge.retryAfterSeconds > 0) return
      }
      const result = await serviceDraftsApi.sendEmail(draftId, current.current.request)
      setChallenge(result)
      setCode('')
      setRetryAt(Date.now() + result.retryAfterSeconds * 1000)
    } catch (failure) {
      setError(draftError(failure))
      if (failure?.response?.status === 429) setRetryAt(Date.now() + 60000)
    } finally {
      sending.current = false
      setBusy(false)
      current.current.onBusy(false)
    }
  }, [draftId])

  useEffect(() => {
    if (!started.current) {
      started.current = true
      send()
    }
  }, [send])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const verify = async () => {
    if (busy || !challenge) return
    setBusy(true)
    current.current.onBusy(true)
    setError('')
    try {
      await serviceDraftsApi.verifyEmail(draftId, { challengeId: challenge.challengeId, code })
      current.current.onVerified()
    } catch (failure) {
      setError(draftError(failure))
      if (failure?.response?.data?.errorCode === 'SERVICE_EMAIL_EXPIRED') setChallenge(null)
      setCode('')
    } finally {
      setBusy(false)
      current.current.onBusy(false)
    }
  }

  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000))

  return (
    <section className="epd-email-panel" aria-label="Xác thực email đăng ký">
      <span className="epd-email-icon">
        <Mail size={25} />
      </span>
      <div>
        <span className="epc-eyebrow">BẢO VỆ HỒ SƠ CỦA BẠN</span>
        <h4>Xác thực email</h4>
        <p>
          {challenge ? (
            <>Mã đã được gửi đến <strong>{challenge.maskedEmail}</strong>. Kiểm tra cả thư mục Spam. Mã có hiệu lực 5 phút.</>
          ) : recipientEmail ? (
            <>Email nhận mã của tài khoản đang đăng nhập: <strong>{recipientEmail}</strong>.</>
          ) : (
            'Mã xác thực được gửi đến email đã đăng ký của tài khoản đang đăng nhập.'
          )}
        </p>
        <p className="epd-muted">
          Xác thực email không thay thế kiểm tra hiệu lực Booking, DO/eDO hoặc thông quan.
        </p>

        {challenge && (
          <div>
            <div className="epd-otp-actions">
              <label>
                <span>Mã xác thực 6 số <b className="epd-required">*</b></span>
                <input
                  aria-label="Mã xác thực email"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
                  disabled={busy}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && code.length === 6) {
                      event.preventDefault()
                      verify()
                    }
                  }}
                />
              </label>
              <button
                type="button"
                className="epc-button primary"
                disabled={busy || code.length !== 6}
                onClick={verify}
              >
                {busy ? <Loader2 size={15} className="epc-spin" /> : <ShieldCheck size={15} />}
                Xác nhận mã
              </button>
            </div>
          </div>
        )}

        {error && <p className="epc-error" role="alert">{error}</p>}

        <button
          type="button"
          className="epc-text-button"
          disabled={busy || remaining > 0}
          onClick={() => send(true)}
        >
          {busy ? <Loader2 size={14} className="epc-spin" /> : <RefreshCw size={14} />}
          {remaining ? `Gửi lại sau ${remaining}s` : challenge ? 'Gửi lại mã' : 'Thử gửi mã'}
        </button>
      </div>
    </section>
  )
}
