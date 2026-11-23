import { useCallback, useEffect, useState } from 'react'
import importDocumentService from '../../services/importDocumentService'
import exportBookingService from '../../services/exportBookingService'
import { btn, btnPrimary, card, inputCls, SectionTitle } from './docUi'
import Select from '../ui/Select'

const typeLabels = { LOI_RELEASE: 'LOI nhận hàng không cần B/L gốc', CHANGE_CONSIGNEE: 'Đổi consignee', CHANGE_POD: 'Đổi cảng dỡ', SCHEDULE_CHANGE: 'Đổi lịch tàu' }
const statusLabels = { PENDING: 'Chờ xử lý', APPROVED: 'Đã chấp nhận', REJECTED: 'Bị từ chối', CANCELLED: 'Đã rút' }
const statusTone = { PENDING: 'bg-amber-100 text-amber-800', APPROVED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-rose-100 text-rose-800', CANCELLED: 'bg-slate-100 text-slate-600' }
const input = inputCls

function summary(r) {
  const p = r.payload || {}
  if (r.type === 'CHANGE_CONSIGNEE') return `${p.oldConsignee || '—'} → ${p.newConsignee}`
  if (r.type === 'CHANGE_POD') return `${p.oldPod || '—'} → ${p.newPod}`
  if (r.type === 'SCHEDULE_CHANGE') return `ETA mới ${p.eta ? new Date(p.eta).toLocaleString('vi-VN') : '—'}${p.vesselName ? ` · ${p.vesselName} ${p.voyageNumber || ''}` : ''}`
  return ''
}

/**
 * Ngoại lệ sau phát hành B/L trên hồ sơ hàng nhập.
 * mode="company": gửi/rút yêu cầu LOI, đổi consignee, đổi cảng dỡ. mode="line": duyệt/từ chối, đổi lịch tàu.
 */
export default function PostIssuancePanel({ file, mode, onChanged }) {
  const [requests, setRequests] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ type: 'LOI_RELEASE', reason: '', newConsignee: '', newPod: '', letterUrl: '' })
  const [sched, setSched] = useState({ eta: '', vesselName: '', voyageNumber: '', reason: '' })
  const [decision, setDecision] = useState({})
  const closed = file.status === 'DO_ISSUED'

  const load = useCallback(async () => {
    try { setRequests(await importDocumentService.listRequests(file.id)) } catch (err) { setError(err?.response?.data?.message || err.message) }
  }, [file.id])
  useEffect(() => { load() }, [load, file.version])

  const run = async fn => {
    setBusy(true); setError('')
    try { await fn(); await load(); onChanged?.() } catch (err) { setError(err?.response?.data?.message || err.message) } finally { setBusy(false) }
  }

  const upload = event => {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked) return
    run(async () => {
      const uploaded = await exportBookingService.uploadPreparationDocument(picked)
      if (!uploaded?.fileUrl) throw new Error('Chưa lưu được văn bản.')
      setForm(f => ({ ...f, letterUrl: uploaded.fileUrl }))
    })
  }

  const needsLetter = true
  return (
    <div className={`${card} space-y-4`}>
      <SectionTitle icon="edit_document">Thay đổi sau khi phát hành B/L</SectionTitle>
      {error && <p className="rounded bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
      {closed && <p className="text-xs text-slate-500">Đã phát hành D/O: không thể thay đổi thêm.</p>}

      {mode === 'company' && !closed && (
        <div className="space-y-2 rounded-xl border border-chalk bg-fog/50 p-3">
          <Select className={input} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            {['LOI_RELEASE', 'CHANGE_CONSIGNEE', 'CHANGE_POD'].map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
          </Select>
          {form.type === 'CHANGE_CONSIGNEE' && <input className={input} placeholder="Tên consignee mới" value={form.newConsignee} onChange={e => setForm({ ...form, newConsignee: e.target.value })} />}
          {form.type === 'CHANGE_POD' && <input className={input} placeholder="Cảng dỡ mới (trong cảng này)" value={form.newPod} onChange={e => setForm({ ...form, newPod: e.target.value })} />}
          <textarea className={input} rows={2} placeholder="Lý do" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
          <div className="flex flex-wrap items-center gap-2">
            <label className={`${btn} cursor-pointer`}>
              {form.type === 'LOI_RELEASE' ? 'Tải lên thư bảo lãnh (LOI)' : 'Tải lên văn bản đồng ý của shipper'}
              <input type="file" className="hidden" accept=".pdf,image/*" onChange={upload} disabled={busy} />
            </label>
            {form.letterUrl && <a className="text-sm text-sky-700 underline" href={form.letterUrl} target="_blank" rel="noreferrer">Đã tải lên</a>}
            <button type="button" className={btnPrimary} disabled={busy || !form.reason.trim() || (needsLetter && !form.letterUrl)}
              onClick={() => run(async () => {
                await importDocumentService.createRequest(file.id, { type: form.type, reason: form.reason, letterUrl: form.letterUrl, newConsignee: form.newConsignee, newPod: form.newPod })
                setForm({ type: form.type, reason: '', newConsignee: '', newPod: '', letterUrl: '' })
              })}>Gửi yêu cầu</button>
          </div>
        </div>
      )}

      {mode === 'line' && !closed && (
        <div className="space-y-2 rounded-xl border border-chalk bg-fog/50 p-3">
          <p className="text-xs font-semibold text-slate-600">Đổi lịch tàu (rớt tàu, đổi chuyến)</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input type="datetime-local" className={input} value={sched.eta} onChange={e => setSched({ ...sched, eta: e.target.value })} />
            <input className={input} placeholder="Tên tàu mới (nếu đổi)" value={sched.vesselName} onChange={e => setSched({ ...sched, vesselName: e.target.value })} />
            <input className={input} placeholder="Chuyến mới (nếu đổi)" value={sched.voyageNumber} onChange={e => setSched({ ...sched, voyageNumber: e.target.value })} />
          </div>
          <input className={input} placeholder="Lý do đổi lịch" value={sched.reason} onChange={e => setSched({ ...sched, reason: e.target.value })} />
          <button type="button" className={btnPrimary} disabled={busy || !sched.eta || !sched.reason.trim()}
            onClick={() => run(async () => {
              await importDocumentService.changeSchedule(file.id, { ...sched, eta: new Date(sched.eta).toISOString() })
              setSched({ eta: '', vesselName: '', voyageNumber: '', reason: '' })
            })}>Cập nhật lịch tàu và báo người nhận</button>
        </div>
      )}

      {requests.length === 0 ? <p className="text-sm text-slate-500">Chưa có yêu cầu nào.</p> : (
        <ul className="space-y-2">
          {requests.map(r => {
            const d = decision[r.id] || { note: '', fee: '', paid: false }
            const set = patch => setDecision(prev => ({ ...prev, [r.id]: { ...d, ...patch } }))
            return (
              <li key={r.id} className="rounded-xl border border-chalk bg-fog/50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{typeLabels[r.type]}</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusTone[r.status]}`}>{statusLabels[r.status]}</span>
                </div>
                {summary(r) && <p className="mt-1 text-xs text-slate-600">{summary(r)}</p>}
                {r.payload?.reason && <p className="mt-1 text-xs text-slate-600">Lý do: {r.payload.reason}</p>}
                {r.payload?.letterUrl && <a className="text-xs text-sky-700 underline" href={r.payload.letterUrl} target="_blank" rel="noreferrer">Xem văn bản đính kèm</a>}
                {r.feeVnd > 0 && <p className="mt-1 text-xs text-slate-600">Phí xử lý: {r.feeVnd.toLocaleString('vi-VN')} đ (đã thu)</p>}
                {r.type === 'LOI_RELEASE' && r.status === 'APPROVED' && r.originalDueAt && (
                  r.originalReturnedAt
                    ? <p className="mt-1 text-xs font-semibold text-emerald-700">Đã nhận lại B/L gốc ngày {new Date(r.originalReturnedAt).toLocaleDateString('vi-VN')}</p>
                    : (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className={`text-xs font-semibold ${r.originalOverdue ? 'text-rose-700' : 'text-amber-700'}`}>
                          {r.originalOverdue ? 'Quá hạn' : 'Hạn'} nộp lại B/L gốc: {new Date(r.originalDueAt).toLocaleDateString('vi-VN')}
                        </p>
                        {mode === 'line' && <button type="button" className={btn} disabled={busy} onClick={() => run(() => importDocumentService.confirmOriginalReturned(r.id))}>Đã nhận lại B/L gốc</button>}
                      </div>
                    )
                )}
                {r.resolutionNote &&<p className="mt-1 text-xs text-slate-600">Hãng tàu: {r.resolutionNote}</p>}
                {r.status === 'PENDING' && mode === 'company' && (
                  <button type="button" className={`${btn} mt-2`} disabled={busy} onClick={() => run(() => importDocumentService.cancelRequest(r.id))}>Rút yêu cầu</button>
                )}
                {r.status === 'PENDING' && mode === 'line' && (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="number" min="0" className={`${input} max-w-[10rem]`} placeholder="Phí xử lý (đ)" value={d.fee} onChange={e => set({ fee: e.target.value })} />
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={d.paid} onChange={e => set({ paid: e.target.checked })} /> Đã thu phí</label>
                    </div>
                    <input className={input} placeholder="Ghi chú (bắt buộc khi từ chối)" value={d.note} onChange={e => set({ note: e.target.value })} />
                    <div className="flex gap-2">
                      <button type="button" className={btnPrimary} disabled={busy} onClick={() => run(() => importDocumentService.resolveRequest(r.id, { approve: true, feeVnd: Number(d.fee) || 0, feePaid: d.paid, note: d.note }))}>Chấp nhận</button>
                      <button type="button" className={btn} disabled={busy} onClick={() => run(() => importDocumentService.resolveRequest(r.id, { approve: false, note: d.note }))}>Từ chối</button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
