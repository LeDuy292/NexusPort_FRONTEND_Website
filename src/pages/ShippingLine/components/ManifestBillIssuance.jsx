import { useCallback, useEffect, useRef, useState } from 'react'
import apiClient from '../../../services/apiClient'
import { btn, btnPrimary, card, Pill, SectionTitle, inputCls, labelCls, theadCls, thCls } from '../../../components/Containers/docUi'

const unwrap = res => res.data?.data ?? res.data
const errorText = err => err?.response?.data?.message || err?.message || 'Không thể xử lý yêu cầu.'
const blTypes = [['Original', 'B/L gốc (Original)'], ['TelexRelease', 'Surrender / Telex release'], ['SeawayBill', 'Seaway Bill']]
const stateTone = { NOT_FOUND: 'red', EXPECTED: 'amber', AT_PORT: 'blue', LOADED: 'green', DISCHARGED: 'green', RELEASED: 'purple' }

/**
 * Phát hành vận đơn trong bản khai: tạo B/L chính thức, gửi pre-alert (xuất) hoặc mở hồ sơ hàng nhập,
 * và thông báo cho chủ hàng / người nhận. Có nút đối chiếu với container thực tế tại cảng.
 */
export default function ManifestBillIssuance({ manifest }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [issuing, setIssuing] = useState(null)
  const [form, setForm] = useState({ blType: 'Original', freightTerms: 'Prepaid', notifyParty: '', bookingNo: '' })
  const [recon, setRecon] = useState(null)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const load = useCallback(async () => {
    try { const result = unwrap(await apiClient.get(`/bl-imports/manifests/${manifest.id}/bills`)); if (alive.current) { setData(result); setError('') } } catch (err) { if (alive.current) setError(errorText(err)) }
  }, [manifest.id])
  useEffect(() => { load() }, [load, manifest.status])

  const open = bill => { setIssuing(bill); setForm({ blType: 'Original', freightTerms: 'Prepaid', notifyParty: '', bookingNo: '' }); setNotice('') }

  const issue = async () => {
    setBusy('issue'); setError('')
    try {
      const result = unwrap(await apiClient.post(`/bl-imports/manifests/${manifest.id}/bills/${encodeURIComponent(issuing.blNumber)}/issue`, form))
      if (!alive.current) return
      setNotice(`Đã phát hành vận đơn ${result.blNumber}. ${result.notified ? 'Đã gửi thông báo cho công ty.' : 'Chưa khớp được công ty nên chưa gửi thông báo.'}`)
      setIssuing(null); await load()
    } catch (err) { if (alive.current) setError(errorText(err)) } finally { if (alive.current) setBusy('') }
  }

  const reconcile = async blNumber => {
    setBusy(`r-${blNumber}`); setError('')
    try { const result = unwrap(await apiClient.get(`/bl-imports/bills/${encodeURIComponent(blNumber)}/reconcile`)); if (alive.current) setRecon(result) } catch (err) { if (alive.current) setError(errorText(err)) } finally { if (alive.current) setBusy('') }
  }

  if (manifest.status === 'DRAFT') return <section className={card}><SectionTitle icon="receipt_long">Phát hành vận đơn</SectionTitle><p className="text-xs text-slate">Hoàn tất bản khai (bỏ trạng thái nháp) để phát hành vận đơn.</p></section>
  const directionText = data?.direction === 'IMPORT' ? 'mở hồ sơ hàng nhập và báo cho người nhận hàng' : 'gửi pre-alert cho đầu nhập và báo cho chủ hàng'

  return (
    <section className={`${card} space-y-4`}>
      <SectionTitle icon="receipt_long">Phát hành vận đơn</SectionTitle>
      <p className="text-xs text-slate">Khi phát hành, hệ thống tạo B/L chính thức, {directionText}.</p>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">{notice}</p>}

      {!data ? <p className="text-xs text-slate">Đang tải…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead className={theadCls}><tr><th className={thCls}>Số vận đơn</th><th className={thCls}>{data.direction === 'IMPORT' ? 'Người nhận khớp' : 'Chủ hàng khớp'}</th><th className={thCls}>Trạng thái</th><th className={thCls}>Lưu ý</th><th className={thCls}>Thao tác</th></tr></thead>
            <tbody className="divide-y divide-chalk">
              {data.bills.map(b => (
                <tr key={b.blNumber} className="align-top">
                  <td className="py-3 px-3 font-mono font-bold text-carbon">{b.blNumber}</td>
                  <td className="py-3 px-3">{b.companyName || <span className="text-rose-700">Chưa là công ty đã đăng ký</span>}</td>
                  <td className="py-3 px-3"><Pill tone={b.issued ? 'green' : 'amber'}>{b.issued ? 'Đã phát hành' : 'Chưa phát hành'}</Pill></td>
                  <td className="py-3 px-3 text-rose-700">{b.notes.length ? b.notes.join(' ') : <span className="text-slate">—</span>}</td>
                  <td className="py-3 px-3"><div className="flex flex-wrap gap-2">
                    {!b.issued && <button type="button" className={btnPrimary} disabled={!b.canIssue || Boolean(busy)} onClick={() => open(b)}>Phát hành</button>}
                    <button type="button" className={btn} disabled={Boolean(busy)} onClick={() => reconcile(b.blNumber)}>{busy === `r-${b.blNumber}` ? 'Đang đối chiếu…' : 'Đối chiếu cảng'}</button>
                  </div></td>
                </tr>
              ))}
              {data.bills.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate">Bản khai chưa có vận đơn.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {issuing && (
        <div className="space-y-4 rounded-xl border border-chalk bg-fog/50 p-4">
          <h4 className="font-mono text-sm font-extrabold text-carbon">Phát hành {issuing.blNumber}</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={labelCls}>Hình thức B/L *</span><select className={inputCls} value={form.blType} onChange={e => setForm({ ...form, blType: e.target.value })}>{blTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span className={labelCls}>Điều kiện cước *</span><select className={inputCls} value={form.freightTerms} onChange={e => setForm({ ...form, freightTerms: e.target.value })}><option value="Prepaid">Trả trước (Prepaid)</option><option value="Collect">Trả sau (Collect)</option></select></label>
            <label><span className={labelCls}>Bên thông báo</span><input className={inputCls} value={form.notifyParty} onChange={e => setForm({ ...form, notifyParty: e.target.value })} placeholder="Để trống nếu giống người nhận" /></label>
            <label><span className={labelCls}>Mã booking {data.direction === 'EXPORT' ? '*' : '(nếu có)'}</span><input className={inputCls} value={form.bookingNo} onChange={e => setForm({ ...form, bookingNo: e.target.value })} placeholder={data.direction === 'EXPORT' ? 'Mã booking của chủ hàng' : ''} /></label>
          </div>
          <p className="text-xs text-slate">Thông báo sẽ gửi cho {issuing.companyName}. {data.direction === 'EXPORT' ? 'Mã booking phải đúng booking của chủ hàng này, đúng chuyến tàu, và container trên vận đơn phải nằm trong booking.' : ''}</p>
          <div className="flex gap-2"><button type="button" className={btnPrimary} disabled={Boolean(busy) || (data.direction === 'EXPORT' && !form.bookingNo.trim())} onClick={issue}>{busy === 'issue' ? 'Đang phát hành…' : 'Xác nhận phát hành'}</button><button type="button" className={btn} onClick={() => setIssuing(null)}>Hủy</button></div>
        </div>
      )}

      {recon && (
        <div className="space-y-3 rounded-xl border border-chalk bg-fog/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-mono text-sm font-extrabold text-carbon">Đối chiếu {recon.blNumber} với cảng</h4>
            <div className="flex items-center gap-2">{recon.matched ? <Pill tone="green">Khớp hoàn toàn</Pill> : <Pill tone="amber">Cần xem lại</Pill>}<button type="button" className={btn} onClick={() => setRecon(null)}>Đóng</button></div>
          </div>
          <p className="text-xs text-slate">{recon.summary.total} container: {recon.summary.onTrack} đã hoàn tất chặng, {recon.summary.waiting} đang chờ, {recon.summary.notFound} chưa có trong hệ thống cảng, {recon.summary.withIssues} có sai khác.</p>
          <table className="w-full border-collapse text-left text-xs">
            <thead className={theadCls}><tr><th className={thCls}>Số container</th><th className={thCls}>Seal (B/L → cảng)</th><th className={thCls}>Khối lượng (B/L → cảng)</th><th className={thCls}>Tình trạng</th><th className={thCls}>Sai khác</th></tr></thead>
            <tbody className="divide-y divide-chalk">
              {recon.containers.map(c => (
                <tr key={c.containerNumber} className="align-top">
                  <td className="py-2.5 px-3 font-mono font-bold text-carbon">{c.containerNumber}</td>
                  <td className="py-2.5 px-3 font-mono">{c.sealNumber || '—'} → {c.port?.sealNumber || '—'}</td>
                  <td className="py-2.5 px-3">{c.vgmKg || '—'} → {c.port?.grossWeightKg || '—'}</td>
                  <td className="py-2.5 px-3"><Pill tone={stateTone[c.state]}>{c.stateLabel}</Pill></td>
                  <td className="py-2.5 px-3">{c.issues.length ? <ul className="space-y-0.5 text-rose-700">{c.issues.map((t, i) => <li key={i}>{t}</li>)}</ul> : <span className="text-slate">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
