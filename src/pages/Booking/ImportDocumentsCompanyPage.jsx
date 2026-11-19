import { useCallback, useEffect, useRef, useState } from 'react'
import importDocumentService from '../../services/importDocumentService'
import exportBookingService from '../../services/exportBookingService'
import ImportDocumentTimeline from '../../components/Containers/ImportDocumentTimeline'
import PostIssuancePanel from '../../components/Containers/PostIssuancePanel'
import { btn, btnPrimary, card as box, PageHeader, StatCard, Pill, EmptyState, SectionTitle, inputCls } from '../../components/Containers/docUi'

const field = inputCls
const when = value => (value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—')
const money = value => `${Number(value || 0).toLocaleString('vi-VN')} VND`
const statusLabels = {
  RECEIVED: 'Hãng tàu đang đối chiếu', MISMATCH: 'Hãng tàu đang kiểm tra thông tin', NOTICE_SENT: 'Cần xác nhận Arrival Notice', AMENDMENT_REQUESTED: 'Đã gửi yêu cầu sửa, chờ hãng tàu',
  CONFIRMED: 'Đã xác nhận, chờ nhận D/O', RELEASE_VERIFIED: 'Đủ điều kiện, chờ hãng tàu phát hành D/O', DO_ISSUED: 'Đã phát hành D/O',
}
const AMEND_FIELDS = [
  ['invoice.companyName', 'Tên công ty xuất hóa đơn (hành chính)'], ['invoice.taxCode', 'Mã số thuế (hành chính)'], ['invoice.address', 'Địa chỉ xuất hóa đơn (hành chính)'],
  ['invoice.email', 'Email nhận hóa đơn (hành chính)'], ['contact.name', 'Người liên hệ nhận D/O (hành chính)'], ['contact.phone', 'Số điện thoại liên hệ (hành chính)'],
  ['consignee', 'Người nhận hàng trên B/L (qua đầu xuất)'], ['notifyParty', 'Bên thông báo trên B/L (qua đầu xuất)'], ['cargoDescription', 'Mô tả hàng trên B/L (qua đầu xuất)'], ['shipper', 'Người gửi hàng trên B/L (qua đầu xuất)'],
]
const errorText = err => err?.response?.data?.message || err?.message || 'Không thể xử lý yêu cầu.'

/** Hồ sơ hàng nhập phía Transport company (consignee hoặc đại diện): xác nhận Arrival Notice, yêu cầu sửa, lấy D/O. */
export default function ImportDocumentsCompanyPage() {
  const [files, setFiles] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [d, setD] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [invoice, setInvoice] = useState({ companyName: '', taxCode: '', address: '', email: '' })
  const [contact, setContact] = useState({ name: '', phone: '' })
  const [pickup, setPickup] = useState('')
  const [ack, setAck] = useState(false)
  const [amend, setAmend] = useState({ field: 'invoice.email', value: '', reason: '' })
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const loadList = useCallback(async () => {
    try { const rows = await importDocumentService.list(); if (alive.current) setFiles(rows || []) } catch (err) { if (alive.current) setError(errorText(err)) }
  }, [])
  const loadDetail = useCallback(async id => {
    if (!id) { setD(null); return }
    try { const row = await importDocumentService.get(id); if (alive.current) setD(row) } catch (err) { if (alive.current) setError(errorText(err)) }
  }, [])
  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { loadDetail(selectedId); setAck(false) }, [selectedId, loadDetail])

  const act = async (operation, success) => {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await operation()
      if (!alive.current) return
      if (result?.id) setD(result)
      setNotice(success)
      await loadList()
    } catch (err) {
      if (!alive.current) return
      setError(errorText(err))
      if (err?.response?.status === 409) await loadDetail(selectedId)
    } finally { if (alive.current) setBusy(false) }
  }

  const uploadAuthorization = async event => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    if (file.size > 25 * 1024 * 1024) { setError('Tệp tối đa 25 MB.'); return }
    setBusy(true); setError('')
    try {
      const uploaded = await exportBookingService.uploadPreparationDocument(file)
      if (!uploaded?.fileUrl) throw new Error('Chưa lưu được giấy ủy quyền.')
      const result = await importDocumentService.setAuthorization(d.id, uploaded.fileUrl)
      if (alive.current) { setD(result); setNotice('Đã tải lên giấy ủy quyền của consignee.') }
    } catch (err) { if (alive.current) setError(errorText(err)) } finally { if (alive.current) setBusy(false) }
  }

  const notice1 = d?.notice
  const confirmValid = invoice.companyName.trim() && invoice.taxCode.trim() && invoice.address.trim() && invoice.email.trim() && contact.name.trim() && contact.phone.trim() && ack

  const statusTone = { RECEIVED: 'blue', MISMATCH: 'blue', NOTICE_SENT: 'orange', AMENDMENT_REQUESTED: 'amber', CONFIRMED: 'blue', RELEASE_VERIFIED: 'purple', DO_ISSUED: 'green' }
  const count = predicate => files.filter(predicate).length

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen">
      <PageHeader
        badge="Không gian doanh nghiệp vận tải"
        title="Chứng từ hàng nhập"
        subtitle="Kiểm tra và xác nhận Arrival Notice, yêu cầu sửa thông tin, gửi yêu cầu thay đổi sau phát hành B/L và yêu cầu lấy lệnh giao hàng (D/O)."
        actions={<button type="button" className={btn} onClick={loadList} title="Tải lại dữ liệu"><span className="material-symbols-outlined text-base">refresh</span>Tải lại</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Cần xác nhận" value={count(f => f.status === 'NOTICE_SENT')} hint="Arrival Notice chờ bạn" tone="text-orange-700" />
        <StatCard label="Chờ hãng tàu" value={count(f => ['RECEIVED', 'MISMATCH', 'AMENDMENT_REQUESTED', 'RELEASE_VERIFIED'].includes(f.status))} hint="Đối chiếu / duyệt / cấp D/O" tone="text-blue-700" />
        <StatCard label="Chờ lấy D/O" value={count(f => f.status === 'CONFIRMED')} hint="Đã xác nhận notice" tone="text-purple-700" />
        <StatCard label="Đã có D/O" value={count(f => f.status === 'DO_ISSUED')} hint="Có thể đặt lịch lấy hàng" tone="text-emerald-700" />
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">{notice}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] items-start">
        <section className={box}>
          <SectionTitle icon="inventory_2" aside={<span className="text-xs font-mono text-slate">{files.length} vận đơn</span>}>Vận đơn của công ty</SectionTitle>
          {files.length === 0 ? (
            <EmptyState icon="inventory_2" title="Chưa có hồ sơ nào gắn với công ty của bạn">Hồ sơ xuất hiện khi hãng tàu tiếp nhận pre-alert và gắn công ty bạn làm bên nhận hàng.</EmptyState>
          ) : (
            <ul className="divide-y divide-chalk">
              {files.map(f => (
                <li key={f.id} onClick={() => setSelectedId(f.id)} className={`cursor-pointer rounded-xl px-3 py-3 transition-colors hover:bg-fog/60 ${selectedId === f.id ? 'bg-orange-50/60' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs font-bold text-carbon">{f.blNumber}</p>
                    <Pill tone={statusTone[f.status]}>{statusLabels[f.status] || f.status}</Pill>
                  </div>
                  <p className="mt-1 truncate text-xs text-carbon">{f.vesselName} / {f.voyageNumber}</p>
                  <p className="text-[11px] text-slate">ETA {when(f.eta)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-6">
          {!d && <div className={box}><EmptyState icon="touch_app" title="Chọn một vận đơn">Chọn vận đơn ở danh sách bên trái để xem Arrival Notice và thao tác.</EmptyState></div>}
          {d && (
            <>
              <div className={`${box} space-y-2`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><h2 className="font-heading text-lg font-extrabold text-carbon font-mono">{d.blNumber}</h2><p className="text-sm text-slate-600">{d.vesselName} / {d.voyageNumber} · ETA {when(d.eta)}</p></div>
                  <p className="text-sm font-semibold">{statusLabels[d.status] || d.status}</p>
                </div>
                <p className="text-sm">Người gửi: <strong>{d.shipper}</strong> · Người nhận: <strong>{d.consignee}</strong></p>
                <p className="text-xs text-slate-500">Container: {(d.containers || []).map(c => `${c.containerNumber} (seal ${c.sealNumber})`).join('; ') || '—'}</p>
                {d.doNumber && <p className="text-sm font-semibold text-emerald-700">Lệnh giao hàng D/O: {d.doNumber}</p>}
              </div>

              {notice1 && ['NOTICE_SENT', 'AMENDMENT_REQUESTED', 'CONFIRMED', 'RELEASE_VERIFIED', 'DO_ISSUED'].includes(d.status) && (
                <div className={`${box} space-y-3`}>
                  <h3 className="font-heading text-base font-extrabold text-carbon">Arrival Notice phiên bản {d.noticeVersion}</h3>
                  <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                    <div><dt className="text-xs text-slate-500">Nơi lưu hàng</dt><dd className="font-medium">{notice1.stockLocation}</dd></div>
                    <div><dt className="text-xs text-slate-500">Hạn xác nhận</dt><dd className="font-medium">{when(d.noticeDeadline)}</dd></div>
                    <div><dt className="text-xs text-slate-500">Free time DEM / DET</dt><dd className="font-medium">{notice1.freeTime?.demDays} ngày / {notice1.freeTime?.detDays} ngày · tính từ {notice1.freeTime?.startsFrom}</dd></div>
                    <div><dt className="text-xs text-slate-500">Chứng từ cần xuất trình để lấy D/O</dt><dd className="font-medium">{(notice1.requiredDocuments || []).join('; ')}</dd></div>
                  </dl>
                  <table className="w-full text-sm"><tbody>
                    {(notice1.fees || []).map(f => <tr key={f.name} className="border-b border-slate-100"><td className="py-1">{f.name}</td><td className="py-1 text-right">{money(f.amountVnd)}</td></tr>)}
                    <tr><td className="py-1 font-semibold">Tổng cộng</td><td className="py-1 text-right font-semibold">{money(notice1.totalFeesVnd)}</td></tr>
                  </tbody></table>
                  <p className="text-xs text-slate-500">{notice1.freeTime?.overdueFeeNote}</p>
                </div>
              )}

              {d.status === 'NOTICE_SENT' && (
                <>
                  <form className={`${box} space-y-3`} onSubmit={e => { e.preventDefault(); act(() => importDocumentService.confirmNotice(d.id, { noticeVersion: d.noticeVersion, invoiceInfo: invoice, contactInfo: contact, expectedPickupDate: pickup || undefined, freeTimeAcknowledged: ack }), 'Đã xác nhận Arrival Notice.') }}>
                    <h3 className="font-heading text-base font-extrabold text-carbon">Xác nhận Arrival Notice</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input className={field} placeholder="Tên công ty xuất hóa đơn" value={invoice.companyName} onChange={e => setInvoice(p => ({ ...p, companyName: e.target.value }))} />
                      <input className={field} placeholder="Mã số thuế" value={invoice.taxCode} onChange={e => setInvoice(p => ({ ...p, taxCode: e.target.value }))} />
                      <input className={field} placeholder="Địa chỉ" value={invoice.address} onChange={e => setInvoice(p => ({ ...p, address: e.target.value }))} />
                      <input className={field} type="email" placeholder="Email nhận hóa đơn" value={invoice.email} onChange={e => setInvoice(p => ({ ...p, email: e.target.value }))} />
                      <input className={field} placeholder="Người liên hệ nhận D/O" value={contact.name} onChange={e => setContact(p => ({ ...p, name: e.target.value }))} />
                      <input className={field} placeholder="Số điện thoại liên hệ" value={contact.phone} onChange={e => setContact(p => ({ ...p, phone: e.target.value }))} />
                      <label className="text-xs text-slate-500 sm:col-span-2">Ngày dự kiến đến nhận hàng<input className={field} type="date" value={pickup} onChange={e => setPickup(e.target.value)} /></label>
                    </div>
                    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={ack} onChange={e => setAck(e.target.checked)} /><span>Tôi đã kiểm tra thông tin lô hàng, biết các khoản phí phải trả, số ngày free time và ngày dự kiến nhận hàng.</span></label>
                    <button type="submit" className={btnPrimary} disabled={busy || !confirmValid}>Xác nhận</button>
                  </form>

                  <form className={`${box} space-y-3`} onSubmit={e => { e.preventDefault(); act(() => importDocumentService.requestAmendment(d.id, { noticeVersion: d.noticeVersion, reason: amend.reason, changes: [{ field: amend.field, newValue: amend.value }] }), 'Đã gửi yêu cầu sửa cho hãng tàu.') }}>
                    <h3 className="font-heading text-base font-extrabold text-carbon">Yêu cầu sửa thông tin</h3>
                    <select className={field} value={amend.field} onChange={e => setAmend(p => ({ ...p, field: e.target.value }))}>{AMEND_FIELDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    <input className={field} placeholder="Nội dung đúng" value={amend.value} onChange={e => setAmend(p => ({ ...p, value: e.target.value }))} />
                    <textarea className={field} rows={2} placeholder="Lý do sửa" value={amend.reason} onChange={e => setAmend(p => ({ ...p, reason: e.target.value }))} />
                    <p className="text-xs text-slate-500">Thông tin trên B/L do đầu xuất sửa và cần shipper xác nhận. Thông tin hành chính được cập nhật trực tiếp.</p>
                    <button type="submit" className={btn} disabled={busy || !amend.value.trim() || !amend.reason.trim()}>Gửi yêu cầu sửa</button>
                  </form>
                </>
              )}

              {d.status === 'AMENDMENT_REQUESTED' && d.amendmentRequest && (
                <div className={`${box} border-sky-200 bg-sky-50 text-sm`}>
                  <p className="font-semibold text-sky-900">Yêu cầu sửa đang chờ hãng tàu</p>
                  <ul className="mt-1 text-xs">{d.amendmentRequest.changes.map(c => <li key={c.field}>{c.field}: {String(c.oldValue ?? '—')} → <strong>{c.newValue}</strong></li>)}</ul>
                </div>
              )}

              {['CONFIRMED', 'RELEASE_VERIFIED'].includes(d.status) && (
                <div className={`${box} space-y-3`}>
                  <h3 className="font-heading text-base font-extrabold text-carbon">Lấy lệnh giao hàng (D/O)</h3>
                  {d.autoAccepted && <p className="text-xs text-amber-700">Arrival Notice được giữ nguyên do quá hạn xác nhận; bạn chịu trách nhiệm về phí phát sinh do chậm nhận hàng.</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className={btnPrimary} disabled={busy || Boolean(d.releaseCheck?.requestedAt)} onClick={() => act(() => importDocumentService.requestDo(d.id), 'Đã gửi yêu cầu lấy D/O.')}>{d.releaseCheck?.requestedAt ? 'Đã yêu cầu D/O' : 'Yêu cầu lấy D/O'}</button>
                    <label className={`${btn} cursor-pointer`}>Tải lên giấy ủy quyền của consignee<input type="file" className="hidden" accept=".pdf,image/*" onChange={uploadAuthorization} disabled={busy} /></label>
                  </div>
                  <p className="text-xs text-slate-500">Nếu công ty bạn không phải consignee ghi trên vận đơn thì bắt buộc có giấy ủy quyền.</p>
                  {d.authorizationFileUrl && <p className="text-sm"><a className="text-sky-700 underline" href={d.authorizationFileUrl} target="_blank" rel="noreferrer">Đã tải lên giấy ủy quyền</a></p>}
                  {(d.releaseCheck?.reasons || []).length > 0 && d.status === 'CONFIRMED' && <ul className="list-disc pl-5 text-xs text-rose-700">{d.releaseCheck.reasons.map(r => <li key={r}>{r}</li>)}</ul>}
                </div>
              )}

              <PostIssuancePanel file={d} mode="company" onChanged={() => { loadDetail(d.id); loadList() }} />

              <div className={`${box} space-y-3`}><h3 className="font-heading text-base font-extrabold text-carbon">Lịch sử hồ sơ</h3><ImportDocumentTimeline events={d.events} /></div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
