import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import apiClient from '../../services/apiClient'

const money = (v) => `${Number(v || 0).toLocaleString('vi-VN')} đ`
const when = (v) => (v ? new Date(v).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—')
const errText = (e) => e?.response?.data?.message || e?.message || 'Không thể xử lý yêu cầu.'

/** Container thuộc đơn dịch vụ (hỗ trợ cả dạng chuỗi và đối tượng). */
export function orderContainerNumbers(order) {
  const list = [
    ...(order?.containers || []).map((c) => (typeof c === 'string' ? c : c?.containerNumber)),
    ...(order?.content?.lines || []).map((l) => l?.declaration?.containerNumber),
  ]
  return [...new Set(list.filter(Boolean).map((x) => String(x).trim().toUpperCase()))]
}

/**
 * Phí đảo container (chiều xuất) phát sinh cho các container của đơn dịch vụ.
 * Hiển thị ngay trong đơn; Transport Company thanh toán bằng QR payOS trong trang, không mở trang riêng.
 * Container chỉ được ra cổng sau khi các khoản phí này được thanh toán đủ.
 */
export default function ShiftingFeesPanel({ order }) {
  const containerNos = useMemo(() => orderContainerNumbers(order), [order])
  const canPay = !order?.staff
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [payingId, setPayingId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const load = useCallback(async () => {
    if (!containerNos.length) { setLoaded(true); return }
    try {
      const res = (await apiClient.get('/yard/shifting-charges')).data?.data
      if (!alive.current) return
      setItems((res?.items || []).filter((c) => containerNos.includes(String(c.containerNo).toUpperCase())))
      setError('')
    } catch (e) {
      if (alive.current) setError(errText(e))
    } finally {
      if (alive.current) setLoaded(true)
    }
  }, [containerNos])

  useEffect(() => {
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, payingId ? 5000 : 20000)
    return () => clearInterval(t)
  }, [load, payingId])

  useEffect(() => {
    if (!payingId) return
    const it = items.find((i) => i.id === payingId)
    if (it?.status === 'PAID') { setPayingId(null); setNotice(`Đã ghi nhận thanh toán phí ${it.code}. Container ${it.containerNo} đủ điều kiện về phí để ra cổng.`) }
  }, [items, payingId])

  const startPayment = async (id) => {
    setBusyId(id); setError(''); setNotice('')
    try { await apiClient.post(`/yard/shifting-charges/${id}/payment`); setPayingId(id); await load() } catch (e) { setError(errText(e)) } finally { setBusyId(null) }
  }
  const checkNow = async (id) => {
    setBusyId(id)
    try { await apiClient.post(`/yard/shifting-charges/${id}/sync`); await load() } catch (e) { setError(errText(e)) } finally { setBusyId(null) }
  }

  if (!loaded || (!items.length && !error)) return null // chưa có phí đảo container nào cho đơn này

  const unpaid = items.filter((i) => i.status === 'UNPAID')
  return (
    <section className="epo-panel" style={{ marginTop: 16 }} aria-label="Phí đảo container">
      <div className="epo-panel-title"><h3>Phí đảo container</h3></div>
      <div style={{ padding: '0 19px 19px' }}>
        {unpaid.length > 0 && (
          <p style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 10, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: 12, lineHeight: 1.6 }}>
            Bãi đã đảo container thuộc đơn này. Còn <strong>{unpaid.length}</strong> khoản phí chưa thanh toán ({money(unpaid.reduce((s, i) => s + i.amount, 0))}).
            Container chỉ được ra cổng sau khi thanh toán đủ.
          </p>
        )}
        {notice && <p role="status" style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 10, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 12 }}>{notice}</p>}
        {error && <p role="alert" style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 12 }}>{error}</p>}

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
          {items.map((c) => {
            const open = payingId === c.id && c.status === 'UNPAID'
            return (
              <li key={c.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 14 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <strong style={{ fontSize: 13 }}>{c.code}</strong>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, border: '1px solid', ...(c.status === 'PAID' ? { background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' } : { background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' }) }}>
                        {c.status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>
                      Container <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{c.containerNo}</strong>{c.moves > 1 ? ` · ${c.moves} lượt đảo` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{c.reason}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Phát sinh {when(c.createdAt)}{c.paidAt ? ` · thanh toán ${when(c.paidAt)}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(c.amount)}</div>
                    {c.status === 'UNPAID' && canPay && (
                      <button type="button" disabled={busyId === c.id} onClick={() => (open ? setPayingId(null) : startPayment(c.id))} className="epc-button primary" style={{ marginTop: 8 }}>
                        {busyId === c.id ? 'Đang tạo…' : open ? 'Ẩn thanh toán' : 'Thanh toán'}
                      </button>
                    )}
                  </div>
                </div>

                {open && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', padding: 16, background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 12px 12px' }}>
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 10 }}>
                      {c.qrCode ? <QRCodeSVG value={c.qrCode} size={168} /> : <div style={{ width: 168, height: 168, display: 'grid', placeItems: 'center', fontSize: 12, color: '#94a3b8' }}>Chưa có mã QR</div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: '#334155', display: 'grid', gap: 8 }}>
                      <p style={{ margin: 0 }}>Quét mã VietQR bằng ứng dụng ngân hàng để thanh toán <strong>{money(c.amount)}</strong>. Hệ thống tự ghi nhận sau khi thanh toán thành công.</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {c.checkoutUrl && <a href={c.checkoutUrl} target="_blank" rel="noreferrer" className="epc-button secondary">Mở trang thanh toán payOS</a>}
                        <button type="button" disabled={busyId === c.id} onClick={() => checkNow(c.id)} className="epc-button secondary">Kiểm tra kết quả</button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
