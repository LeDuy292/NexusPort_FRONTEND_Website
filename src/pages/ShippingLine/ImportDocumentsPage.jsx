import { useCallback, useEffect, useRef, useState } from 'react'
import importDocumentService from '../../services/importDocumentService'
import ImportDocumentTimeline from '../../components/Containers/ImportDocumentTimeline'
import PostIssuancePanel from '../../components/Containers/PostIssuancePanel'
import { btn, btnPrimary, card as box, Info, PageHeader, StatCard, Pill, EmptyState, SectionTitle, inputCls } from '../../components/Containers/docUi'
import Select from '../../components/ui/Select'

const field = inputCls
const when = value => (value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—')
const money = value => `${Number(value || 0).toLocaleString('vi-VN')} VND`
const statusLabels = {
  RECEIVED: 'Đã nhận B/L và manifest', MISMATCH: 'Lệch thông tin, chờ đầu xuất', NOTICE_SENT: 'Đã gửi Arrival Notice, chờ xác nhận',
  AMENDMENT_REQUESTED: 'Người nhận yêu cầu sửa', CONFIRMED: 'Người nhận đã xác nhận', RELEASE_VERIFIED: 'Đã thu phí và kiểm quyền nhận hàng', DO_ISSUED: 'Đã phát hành D/O',
}
const blTypeLabels = { Original: 'B/L gốc', TelexRelease: 'Surrender / Telex release', SeawayBill: 'Seaway Bill' }
const errorText = err => err?.response?.data?.message || err?.message || 'Không thể xử lý yêu cầu.'
const emptyFee = { name: '', amountVnd: '' }

/** Hồ sơ hàng nhập của Hãng tàu (đại lý đầu nhập). */
export default function ImportDocumentsPage() {
  const [files, setFiles] = useState([])
  const [alerts, setAlerts] = useState([])
  const [companies, setCompanies] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [manifestJson, setManifestJson] = useState('')
  const [needManifest, setNeedManifest] = useState(false)
  const [replyNote, setReplyNote] = useState('')
  const [replyAnswer, setReplyAnswer] = useState('CORRECTED')
  const [corrected, setCorrected] = useState({ shipper: '', consignee: '', cargoDescription: '', containers: '' })
  const [fees, setFees] = useState([{ ...emptyFee }])
  const [freeTime, setFreeTime] = useState({ demDays: 5, detDays: 7 })
  const [stockLocation, setStockLocation] = useState('Bãi container Cảng Tiên Sa')
  const [decisionNote, setDecisionNote] = useState('')
  const [shipperConfirmed, setShipperConfirmed] = useState(false)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const loadAll = useCallback(async () => {
    try {
      const [f, a] = await Promise.all([importDocumentService.list(), importDocumentService.listPreAlerts()])
      if (!alive.current) return
      setFiles(f || []); setAlerts((a || []).filter(x => x.status === 'SENT'))
    } catch (err) { if (alive.current) setError(errorText(err)) }
  }, [])
  const loadDetail = useCallback(async id => {
    if (!id) { setDetail(null); return }
    try { const d = await importDocumentService.get(id); if (alive.current) { setDetail(d); setCompanyId(d.consigneeCompanyId || '') } } catch (err) { if (alive.current) setError(errorText(err)) }
  }, [])

  useEffect(() => { loadAll(); importDocumentService.listCompanies().then(c => alive.current && setCompanies(c || [])).catch(() => {}) }, [loadAll])
  useEffect(() => { loadDetail(selectedId); setNeedManifest(false); setManifestJson(''); setReplyNote(''); setDecisionNote(''); setShipperConfirmed(false) }, [selectedId, loadDetail])
  useEffect(() => {
    if (detail?.status === 'MISMATCH') setCorrected({ shipper: detail.shipper || '', consignee: detail.consignee || '', cargoDescription: detail.cargoDescription || '', containers: JSON.stringify(detail.containers || [], null, 2) })
  }, [detail?.id, detail?.status, detail?.version]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (operation, success) => {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await operation()
      if (!alive.current) return
      if (result?.id) setDetail(result)
      if (success) setNotice(success)
      await loadAll()
    } catch (err) {
      if (!alive.current) return
      if (err?.response?.status === 422) setNeedManifest(true)
      setError(errorText(err))
    } finally { if (alive.current) setBusy(false) }
  }

  const reconcile = () => {
    let bill
    if (manifestJson.trim()) { try { bill = JSON.parse(manifestJson) } catch { setError('Dòng manifest phải là JSON hợp lệ.'); return } }
    act(() => importDocumentService.reconcile(detail.id, bill), 'Đã đối chiếu B/L với manifest.')
  }
  const resolveMismatch = () => {
    let payload = { answer: replyAnswer, note: replyNote.trim() }
    if (replyAnswer === 'CORRECTED') {
      let containers
      try { containers = JSON.parse(corrected.containers || '[]') } catch { setError('Danh sách container phải là JSON hợp lệ.'); return }
      payload = { ...payload, correctedFields: { shipper: corrected.shipper, consignee: corrected.consignee, cargoDescription: corrected.cargoDescription, containers } }
    }
    act(() => importDocumentService.resolveMismatch(detail.id, payload), 'Đã cập nhật theo trả lời của đầu xuất. Chạy đối chiếu lại.')
  }
  const sendNotice = () => act(() => importDocumentService.sendArrivalNotice(detail.id, {
    fees: fees.filter(f => f.name.trim()).map(f => ({ name: f.name.trim(), amountVnd: Number(f.amountVnd) || 0 })), freeTime, stockLocation,
  }), 'Đã gửi Arrival Notice cho Transport company.')

  const d = detail
  const amendment = d?.amendmentRequest
  const checkReasons = d?.releaseCheck?.reasons || []

  const statusTone = { RECEIVED: 'blue', MISMATCH: 'red', NOTICE_SENT: 'amber', AMENDMENT_REQUESTED: 'orange', CONFIRMED: 'blue', RELEASE_VERIFIED: 'purple', DO_ISSUED: 'green' }
  const count = predicate => files.filter(predicate).length

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen">
      <PageHeader
        badge="Không gian doanh nghiệp hãng tàu"
        title="Hồ sơ hàng nhập"
        subtitle="Nhận pre-alert, đối chiếu B/L với manifest, gửi Arrival Notice, thu phí, kiểm quyền nhận hàng và phát hành D/O."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Pre-alert chờ nhận" value={alerts.length} hint="Từ đầu xuất gửi sang" tone="text-orange-700" />
        <StatCard label="Cần đối chiếu" value={count(f => f.status === 'RECEIVED' || f.status === 'MISMATCH')} hint="B/L so với manifest" tone="text-blue-700" />
        <StatCard label="Chờ người nhận" value={count(f => f.status === 'NOTICE_SENT' || f.status === 'AMENDMENT_REQUESTED')} hint="Arrival Notice / yêu cầu sửa" tone="text-amber-700" />
        <StatCard label="Sẵn sàng cấp D/O" value={count(f => f.status === 'CONFIRMED' || f.status === 'RELEASE_VERIFIED')} hint="Thu phí và kiểm quyền nhận" tone="text-purple-700" />
        <StatCard label="Đã phát hành D/O" value={count(f => f.status === 'DO_ISSUED')} hint="Hoàn tất" tone="text-emerald-700" />
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">{notice}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] items-start">
        <section className="space-y-6">
          {alerts.length > 0 && (
            <div className={box}>
              <SectionTitle icon="notifications_active" aside={<Pill tone="orange">{alerts.length} mới</Pill>}>Pre-alert chờ tiếp nhận</SectionTitle>
              <ul className="space-y-2">
                {alerts.map(a => (
                  <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-chalk bg-fog/50 p-3">
                    <div className="min-w-0"><p className="font-mono text-xs font-bold text-carbon">{a.blNumber}</p><p className="truncate text-[11px] text-slate">{a.vesselName} / {a.voyageNumber} · {a.containerCount} container</p></div>
                    <button type="button" className={btnPrimary} disabled={busy} onClick={() => act(() => importDocumentService.receivePreAlert(a.id).then(r => { setSelectedId(r.id); return r }), 'Đã tiếp nhận pre-alert và mở hồ sơ.')}>Tiếp nhận</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className={box}>
            <SectionTitle icon="inventory_2" aside={<span className="text-xs font-mono text-slate">{files.length} hồ sơ</span>}>Danh sách hồ sơ</SectionTitle>
            {files.length === 0 ? (
              <EmptyState icon="inventory_2" title="Chưa có hồ sơ hàng nhập nào">Hồ sơ được mở khi bạn tiếp nhận pre-alert. Pre-alert chỉ xuất hiện sau khi đầu xuất phát hành B/L cho lô hàng về cảng này.</EmptyState>
            ) : (
              <ul className="divide-y divide-chalk">
                {files.map(f => (
                  <li key={f.id} onClick={() => setSelectedId(f.id)} className={`cursor-pointer rounded-xl px-3 py-3 transition-colors hover:bg-fog/60 ${selectedId === f.id ? 'bg-orange-50/60' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-xs font-bold text-carbon">{f.blNumber}</p>
                      <Pill tone={statusTone[f.status]}>{statusLabels[f.status] || f.status}</Pill>
                    </div>
                    <p className="mt-1 truncate text-xs text-carbon">{f.consignee}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-6">
          {!d && <div className={box}><EmptyState icon="touch_app" title="Chọn một hồ sơ">Chọn hồ sơ ở danh sách bên trái hoặc tiếp nhận một pre-alert để bắt đầu.</EmptyState></div>}
          {d && (
            <>
              <div className={`${box} space-y-3`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><h2 className="font-heading text-lg font-extrabold text-carbon font-mono">{d.blNumber}</h2><p className="text-sm text-slate-600">{d.vesselName} / {d.voyageNumber} · ETA {when(d.eta)}</p></div>
                  <p className="text-sm font-semibold">{statusLabels[d.status] || d.status}</p>
                </div>
                <dl className="grid gap-3 sm:grid-cols-3">
                  <Info label="Người gửi (shipper)">{d.shipper}</Info><Info label="Người nhận (consignee)">{d.consignee}</Info><Info label="Bên thông báo">{d.notifyParty}</Info>
                  <Info label="Hình thức B/L">{blTypeLabels[d.blType] || d.blType}</Info><Info label="Điều kiện cước">{d.freightTerms === 'Collect' ? 'Trả sau (Collect)' : 'Trả trước (Prepaid)'}</Info>
                  <Info label="Transport company của người nhận">{d.consigneeCompanyName}</Info>
                </dl>
                <p className="text-xs text-slate-500">Container: {(d.containers || []).map(c => `${c.containerNumber} (seal ${c.sealNumber}, ${c.grossWeightKg} kg)`).join('; ') || '—'}</p>
              </div>

              {d.status === 'RECEIVED' && (
                <div className={`${box} space-y-3`}>
                  <h3 className="font-heading text-base font-extrabold text-carbon">1. Đối chiếu và gửi Arrival Notice</h3>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-[14rem] flex-1 text-sm"><span className="text-xs text-slate-500">Transport company của người nhận</span>
                      <Select className={field} value={companyId} onChange={e => setCompanyId(e.target.value)}>
                        <option value="">Chọn công ty</option>{companies.map(c => <option key={c.id} value={c.id}>{c.companyName}{c.taxCode ? ` · ${c.taxCode}` : ''}</option>)}
                      </Select></label>
                    <button type="button" className={btn} disabled={busy || !companyId || companyId === d.consigneeCompanyId} onClick={() => act(() => importDocumentService.assignConsignee(d.id, companyId), 'Đã gắn Transport company.')}>Gắn</button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className={btn} disabled={busy} onClick={reconcile}>Đối chiếu B/L với manifest</button>
                    {d.reconciledAt && <span className="text-sm text-emerald-700">Đã đối chiếu khớp lúc {when(d.reconciledAt)}</span>}
                  </div>
                  {needManifest && <textarea className={`${field} font-mono text-xs`} rows={6} placeholder='Chưa có manifest trong hệ thống. Dán dòng manifest: {"shipper":"...","consignee":"...","containers":[{"containerNumber":"...","sealNumber":"...","isoType":"...","grossWeightKg":0}]}' value={manifestJson} onChange={e => setManifestJson(e.target.value)} />}
                  {d.reconciledAt && (
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <p className="text-sm font-semibold">Khoản phí người nhận phải trả</p>
                      {fees.map((f, i) => (
                        <div key={i} className="flex gap-2">
                          <input className={field} placeholder="Tên khoản phí (THC, phí D/O, CIC...)" value={f.name} onChange={e => setFees(prev => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                          <input className={`${field} max-w-[10rem]`} type="number" min="0" placeholder="VND" value={f.amountVnd} onChange={e => setFees(prev => prev.map((x, j) => (j === i ? { ...x, amountVnd: e.target.value } : x)))} />
                        </div>
                      ))}
                      <button type="button" className={btn} onClick={() => setFees(prev => [...prev, { ...emptyFee }])}>Thêm khoản phí</button>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <label className="text-xs text-slate-500">Free time DEM (ngày)<input className={field} type="number" min="0" value={freeTime.demDays} onChange={e => setFreeTime(p => ({ ...p, demDays: e.target.value }))} /></label>
                        <label className="text-xs text-slate-500">Free time DET (ngày)<input className={field} type="number" min="0" value={freeTime.detDays} onChange={e => setFreeTime(p => ({ ...p, detDays: e.target.value }))} /></label>
                        <label className="text-xs text-slate-500">Nơi lưu hàng<input className={field} value={stockLocation} onChange={e => setStockLocation(e.target.value)} /></label>
                      </div>
                      <button type="button" className={btnPrimary} disabled={busy || !d.consigneeCompanyId} onClick={sendNotice}>Gửi Arrival Notice</button>
                      {!d.consigneeCompanyId && <p className="text-xs text-rose-700">Cần gắn Transport company trước khi gửi.</p>}
                    </div>
                  )}
                </div>
              )}

              {d.status === 'MISMATCH' && (
                <div className={`${box} space-y-3 border-amber-200 bg-amber-50`}>
                  <h3 className="text-sm font-bold text-amber-900">B/L lệch manifest, chờ đầu xuất trả lời</h3>
                  <ul className="space-y-1 text-sm">{(d.mismatch || []).map(m => <li key={m.field}><span className="font-mono text-xs font-semibold">{m.field}</span>: B/L <strong>{String(m.blValue ?? '—')}</strong> ≠ manifest <strong>{String(m.manifestValue ?? '—')}</strong></li>)}</ul>
                  <p className="text-xs text-amber-900">Không tự sửa. Gửi yêu cầu kiểm tra cho đầu xuất rồi ghi lại nội dung trả lời bên dưới.</p>
                  <Select className={field} value={replyAnswer} onChange={e => setReplyAnswer(e.target.value)}>
                    <option value="CORRECTED">Đầu xuất đã sửa B/L</option><option value="CONFIRMED_AS_IS">Đầu xuất xác nhận B/L đúng, giữ nguyên</option>
                  </Select>
                  {replyAnswer === 'CORRECTED' && (
                    <div className="space-y-2">
                      <input className={field} placeholder="Shipper" value={corrected.shipper} onChange={e => setCorrected(p => ({ ...p, shipper: e.target.value }))} />
                      <input className={field} placeholder="Consignee" value={corrected.consignee} onChange={e => setCorrected(p => ({ ...p, consignee: e.target.value }))} />
                      <textarea className={`${field} font-mono text-xs`} rows={6} value={corrected.containers} onChange={e => setCorrected(p => ({ ...p, containers: e.target.value }))} />
                    </div>
                  )}
                  <textarea className={field} rows={2} placeholder="Nội dung trả lời của đầu xuất (bắt buộc)" value={replyNote} onChange={e => setReplyNote(e.target.value)} />
                  <button type="button" className={btnPrimary} disabled={busy || !replyNote.trim()} onClick={resolveMismatch}>Ghi nhận trả lời</button>
                </div>
              )}

              {d.status === 'NOTICE_SENT' && d.notice && (
                <div className={`${box} space-y-2`}>
                  <h3 className="font-heading text-base font-extrabold text-carbon">Arrival Notice phiên bản {d.noticeVersion}</h3>
                  <p className="text-sm text-slate-700">Chờ người nhận xác nhận hoặc yêu cầu sửa trước <strong>{when(d.noticeDeadline)}</strong>. Quá hạn, thông tin được giữ nguyên và người nhận chịu phí phát sinh do chậm nhận hàng.</p>
                  <p className="text-sm">Tổng phí {money(d.notice.totalFeesVnd)} · free time DEM {d.notice.freeTime?.demDays} ngày / DET {d.notice.freeTime?.detDays} ngày</p>
                </div>
              )}

              {d.status === 'AMENDMENT_REQUESTED' && amendment && (
                <div className={`${box} space-y-3 border-sky-200 bg-sky-50`}>
                  <h3 className="text-sm font-bold text-sky-900">Người nhận yêu cầu sửa {amendment.type === 'BL' ? 'thông tin trên B/L' : 'thông tin hành chính'}</h3>
                  <ul className="space-y-1 text-sm">{amendment.changes.map(c => <li key={c.field}><span className="font-semibold">{c.field}</span>: <span className="line-through text-slate-500">{String(c.oldValue ?? '—')}</span> → <strong>{c.newValue}</strong></li>)}</ul>
                  <p className="text-sm">Lý do: {amendment.reason}</p>
                  {amendment.type === 'BL' && (
                    <label className="flex items-start gap-2 rounded bg-white p-2 text-sm"><input type="checkbox" className="mt-1" checked={shipperConfirmed} onChange={e => setShipperConfirmed(e.target.checked)} />
                      <span>Đã chuyển yêu cầu cho đầu xuất và <strong>Transport company phía shipper đã xác nhận</strong> bằng văn bản.</span></label>
                  )}
                  <textarea className={field} rows={2} placeholder="Lý do (bắt buộc khi từ chối)" value={decisionNote} onChange={e => setDecisionNote(e.target.value)} />
                  <div className="flex gap-2">
                    <button type="button" className={btnPrimary} disabled={busy || (amendment.type === 'BL' && !shipperConfirmed)} onClick={() => act(() => importDocumentService.resolveAmendment(d.id, { accept: true, shipperConfirmed, note: decisionNote.trim() || undefined }), 'Đã chấp nhận và gửi lại Arrival Notice.')}>Chấp nhận và gửi lại</button>
                    <button type="button" className={btn} disabled={busy || !decisionNote.trim()} onClick={() => act(() => importDocumentService.resolveAmendment(d.id, { accept: false, note: decisionNote.trim() }), 'Đã từ chối yêu cầu sửa.')}>Từ chối</button>
                  </div>
                </div>
              )}

              {['CONFIRMED', 'RELEASE_VERIFIED', 'DO_ISSUED'].includes(d.status) && (
                <div className={`${box} space-y-3`}>
                  <h3 className="font-heading text-base font-extrabold text-carbon">Thu phí, quyền nhận hàng và D/O</h3>
                  {d.autoAccepted && <p className="text-xs text-amber-700">Hồ sơ được giữ nguyên thông tin do người nhận không phản hồi đến hạn.</p>}
                  {d.invoiceInfo && <p className="text-sm text-slate-700">Xuất hóa đơn: {d.invoiceInfo.companyName} · MST {d.invoiceInfo.taxCode} · {d.invoiceInfo.email}. Liên hệ nhận D/O: {d.contactInfo?.name} {d.contactInfo?.phone}.</p>}
                  {d.releaseCheck?.requestedAt && <p className="text-sm text-slate-700">Người nhận đã yêu cầu lấy D/O lúc {when(d.releaseCheck.requestedAt)}.</p>}
                  {d.authorizationFileUrl && <p className="text-sm"><a className="text-sky-700 underline" href={d.authorizationFileUrl} target="_blank" rel="noreferrer">Giấy ủy quyền của consignee</a></p>}
                  {d.status !== 'DO_ISSUED' && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={btn} disabled={busy} onClick={() => act(() => importDocumentService.collectFees(d.id), 'Đã ghi nhận thu phí.')}>Ghi nhận đã thu phí</button>
                      {d.blType === 'Original' && <button type="button" className={btn} disabled={busy} onClick={() => act(() => importDocumentService.confirmOriginal(d.id), 'Đã thu hồi B/L gốc.')}>Đã nhận B/L gốc</button>}
                      <button type="button" className={btn} disabled={busy} onClick={() => act(() => importDocumentService.verifyRelease(d.id), 'Đã kiểm tra điều kiện nhận hàng.')}>Kiểm tra quyền nhận hàng</button>
                      <button type="button" className={btnPrimary} disabled={busy || d.status !== 'RELEASE_VERIFIED'} onClick={() => act(() => importDocumentService.issueDo(d.id, {}), 'Đã phát hành D/O.')}>Phát hành D/O</button>
                    </div>
                  )}
                  {d.status === 'CONFIRMED' && checkReasons.length > 0 && <ul className="list-disc pl-5 text-xs text-rose-700">{checkReasons.map(r => <li key={r}>{r}</li>)}</ul>}
                  {d.doNumber && <p className="text-sm font-semibold text-emerald-700">D/O {d.doNumber}</p>}
                </div>
              )}

              <PostIssuancePanel file={d} mode="line" onChanged={() => { loadDetail(d.id); loadAll() }} />

              <div className={`${box} space-y-3`}><h3 className="font-heading text-base font-extrabold text-carbon">Lịch sử hồ sơ</h3><ImportDocumentTimeline events={d.events} /></div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
