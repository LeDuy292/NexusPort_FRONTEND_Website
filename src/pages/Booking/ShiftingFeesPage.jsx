import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import apiClient from '../../services/apiClient'

const money = (v) => `${Number(v || 0).toLocaleString('vi-VN')} đ`
const when = (v) => (v ? new Date(v).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—')
const unwrap = (res) => res.data?.data
const errText = (e) => e?.response?.data?.message || e?.message || 'Không thể xử lý yêu cầu.'

/** Transport Company xem và thanh toán phí đảo container chiều xuất. Thanh toán hiển thị ngay trong trang, không dùng pop-up. */
export default function ShiftingFeesPage() {
  const [data, setData] = useState({ items: [], summary: { unpaid: 0, unpaidAmount: 0 } })
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payingId, setPayingId] = useState(null) // khoản đang mở khung thanh toán
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState('')
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const load = useCallback(async () => {
    try {
      const d = unwrap(await apiClient.get('/yard/shifting-charges'))
      if (alive.current) { setData(d || { items: [], summary: { unpaid: 0, unpaidAmount: 0 } }); setError('') }
    } catch (e) {
      if (alive.current) setError(errText(e))
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, payingId ? 5000 : 20000)
    return () => clearInterval(t)
  }, [load, payingId])

  // Khi khoản đang thanh toán chuyển sang đã thanh toán -> báo thành công
  useEffect(() => {
    if (!payingId) return
    const item = data.items.find((i) => i.id === payingId)
    if (item?.status === 'PAID') { setPayingId(null); setNotice(`Đã ghi nhận thanh toán ${item.code}. Container ${item.containerNo} đủ điều kiện về phí để ra cổng.`) }
  }, [data, payingId])

  const startPayment = async (id) => {
    setBusyId(id); setError(''); setNotice('')
    try {
      await apiClient.post(`/yard/shifting-charges/${id}/payment`)
      setPayingId(id)
      await load()
    } catch (e) { setError(errText(e)) } finally { setBusyId(null) }
  }
  const checkNow = async (id) => {
    setBusyId(id)
    try { await apiClient.post(`/yard/shifting-charges/${id}/sync`); await load() } catch (e) { setError(errText(e)) } finally { setBusyId(null) }
  }

  const items = data.items.filter((i) => filter === 'ALL' || i.status === filter)

  return (
    <div className="p-6 md:p-8 w-full max-w-5xl mx-auto font-sans space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Khoản chưa thanh toán</div>
          <div className="text-2xl font-bold tabular-nums text-red-600 mt-1">{data.summary.unpaid}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Tổng phải thanh toán</div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 mt-1">{money(data.summary.unpaidAmount)}</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 leading-relaxed">
          Container thuộc booking xuất chỉ được <strong>ra cổng</strong> sau khi thanh toán đủ phí đảo container.
          Biểu phí: 20ft 350.000 đ, 40ft 550.000 đ mỗi lần đảo.
        </div>
      </div>

      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="inline-flex p-1 rounded-xl bg-slate-100" role="tablist">
        {[['ALL', 'Tất cả'], ['UNPAID', 'Chưa thanh toán'], ['PAID', 'Đã thanh toán']].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
            className={`px-3.5 h-9 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${filter === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Đang tải…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Chưa có khoản phí đảo container nào.</div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => {
            const open = payingId === c.id && c.status === 'UNPAID'
            return (
              <article key={c.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 tabular-nums">{c.code}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${c.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {c.status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                      </span>
                    </div>
                    <div className="text-sm text-slate-700">
                      Container <strong className="tabular-nums">{c.containerNo}</strong>
                      {c.bookingCode ? <> · booking <span className="tabular-nums">{c.bookingCode}</span></> : null}
                      {c.moves > 1 ? ` · ${c.moves} lượt đảo` : ''}
                    </div>
                    <div className="text-xs text-slate-500">{c.reason}</div>
                    <div className="text-[11px] text-slate-400 tabular-nums">Phát sinh {when(c.createdAt)}{c.paidAt ? ` · thanh toán ${when(c.paidAt)}` : ''}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-slate-900 tabular-nums">{money(c.amount)}</div>
                    {c.status === 'UNPAID' && (
                      <button type="button" disabled={busyId === c.id} onClick={() => (open ? setPayingId(null) : startPayment(c.id))}
                        className="mt-2 px-5 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer transition-colors">
                        {busyId === c.id ? 'Đang tạo…' : open ? 'Ẩn thanh toán' : 'Thanh toán'}
                      </button>
                    )}
                  </div>
                </div>

                {open && (
                  <div className="border-t border-slate-100 bg-slate-50 p-5 flex flex-col sm:flex-row gap-6 items-center">
                    <div className="rounded-xl bg-white border border-slate-200 p-3 shrink-0">
                      {c.qrCode ? <QRCodeSVG value={c.qrCode} size={176} /> : <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-400">Chưa có mã QR</div>}
                    </div>
                    <div className="space-y-2 text-sm text-slate-700">
                      <p>Quét mã VietQR bằng ứng dụng ngân hàng để thanh toán <strong>{money(c.amount)}</strong>. Hệ thống tự ghi nhận sau khi thanh toán thành công.</p>
                      <div className="flex flex-wrap gap-2">
                        {c.checkoutUrl && (
                          <a href={c.checkoutUrl} target="_blank" rel="noreferrer" className="px-4 h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold inline-flex items-center">Mở trang thanh toán payOS</a>
                        )}
                        <button type="button" disabled={busyId === c.id} onClick={() => checkNow(c.id)} className="px-4 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer">
                          Kiểm tra kết quả
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
