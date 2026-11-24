import { useCallback, useEffect, useRef, useState } from 'react'
import importDocumentService from '../../services/importDocumentService'
import exportBookingService from '../../services/exportBookingService'
import ImportDocumentTimeline from '../../components/Containers/ImportDocumentTimeline'
import EdoDocument from '../../components/Containers/EdoDocument'
import PostIssuancePanel from '../../components/Containers/PostIssuancePanel'
import { btn, btnPrimary, card as box, PageHeader, StatCard, Pill, EmptyState, SectionTitle, Info, Pager, inputCls } from '../../components/Containers/docUi'
import Select from '../../components/ui/Select'

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
const PAGE_SIZE = 8
const STEPS = ['Hãng tàu đối chiếu', 'Xác nhận Arrival Notice', 'Lấy lệnh D/O', 'Đã có D/O']
const stepOf = status => ({ RECEIVED: 0, MISMATCH: 0, NOTICE_SENT: 1, AMENDMENT_REQUESTED: 1, CONFIRMED: 2, RELEASE_VERIFIED: 2, DO_ISSUED: 3 }[status] ?? 0)
const NEXT_ACTION = {
  RECEIVED: ['info', 'Hãng tàu đang đối chiếu vận đơn. Bạn chưa cần làm gì.'],
  MISMATCH: ['info', 'Hãng tàu đang kiểm tra thông tin với đầu xuất. Bạn chưa cần làm gì.'],
  NOTICE_SENT: ['action', 'Kiểm tra Arrival Notice bên dưới. Đúng thì xác nhận, sai thì gửi yêu cầu sửa.'],
  AMENDMENT_REQUESTED: ['info', 'Yêu cầu sửa đã gửi, đang chờ hãng tàu xử lý.'],
  CONFIRMED: ['action', 'Đã xác nhận. Bấm "Yêu cầu lấy D/O" khi sẵn sàng nhận lệnh giao hàng.'],
  RELEASE_VERIFIED: ['info', 'Đủ điều kiện nhận hàng. Đang chờ hãng tàu phát hành D/O.'],
  DO_ISSUED: ['done', 'Đã có D/O. Bạn có thể đặt lịch lấy hàng.'],
}
const errorText = err => err?.response?.data?.message || err?.message || 'Không thể xử lý yêu cầu.'

/** Hồ sơ hàng nhập phía Transport company (consignee hoặc đại diện): xác nhận Arrival Notice, yêu cầu sửa, lấy D/O. */
export default function ImportDocumentsCompanyPage() {
  const [files, setFiles] = useState([])
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [d, setD] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [invoice, setInvoice] = useState({ companyName: '', taxCode: '', address: '', email: '' })
  const [contact, setContact] = useState({ name: '', phone: '' })
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
  useEffect(() => { setTab('') }, [selectedId])
  // Điền sẵn thông tin xác nhận: ưu tiên thông tin đã xác nhận trước đó, sau đó đến hồ sơ công ty
  useEffect(() => {
    if (!d?.id) return
    const prof = d.companyProfile || {}
    const real = v => (v && String(v).trim().toUpperCase() !== 'N/A' ? String(v).trim() : '')
    const inv = d.invoiceInfo || {}
    const con = d.contactInfo || {}
    setInvoice({
      companyName: inv.companyName || real(prof.companyName), taxCode: inv.taxCode || real(prof.taxCode),
      address: inv.address || real(prof.address), email: inv.email || real(prof.email),
    })
    setContact({ name: con.name || real(prof.contactName), phone: con.phone || real(prof.phone) })
  }, [d?.id, d?.version]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const pageCount = Math.max(1, Math.ceil(files.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pagedFiles = files.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const count = predicate => files.filter(predicate).length

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen">
      <PageHeader
        badge="Không gian doanh nghiệp vận tải"
        title="Chứng từ hàng nhập"
        subtitle="Kiểm tra và xác nhận Arrival Notice, yêu cầu sửa thông tin, gửi yêu cầu thay đổi sau phát hành B/L và yêu cầu lấy lệnh giao hàng (D/O)."
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
          <SectionTitle icon="inventory_2" aside={<span className="text-xs tabular-nums text-slate">{files.length} vận đơn</span>}>Vận đơn của công ty</SectionTitle>
          {files.length === 0 ? (
            <EmptyState icon="inventory_2" title="Chưa có hồ sơ nào gắn với công ty của bạn">Hồ sơ xuất hiện khi hãng tàu tiếp nhận pre-alert và gắn công ty bạn làm bên nhận hàng.</EmptyState>
          ) : (
            <ul className="divide-y divide-chalk">
              {pagedFiles.map(f => (
                <li key={f.id} onClick={() => setSelectedId(f.id)} className={`cursor-pointer rounded-xl px-3 py-3 transition-colors hover:bg-fog/60 ${selectedId === f.id ? 'bg-orange-50/60' : ''}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="tabular-nums text-xs font-bold text-carbon">{f.blNumber}</p>
                    <Pill tone={statusTone[f.status]}>{statusLabels[f.status] || f.status}</Pill>
                  </div>
                  <p className="mt-1 truncate text-xs text-carbon">{f.vesselName} / {f.voyageNumber}</p>
                  <p className="text-[11px] text-slate">ETA {when(f.eta)}</p>
                </li>
              ))}
            </ul>
          )}
          <Pager page={currentPage} pageCount={pageCount} total={files.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </section>

        <section className="space-y-6">
          {!d && <div className={box}><EmptyState icon="touch_app" title="Chọn một vận đơn">Chọn vận đơn ở danh sách bên trái để xem Arrival Notice và thao tác.</EmptyState></div>}
          {d && (() => {
            const step = stepOf(d.status)
            const [nextKind, nextText] = NEXT_ACTION[d.status] || ['info', '']
            const activeTab = tab || (d.status === 'DO_ISSUED' && d.edo ? 'edo' : nextKind === 'action' ? 'actions' : 'info')
            const canEditConfirm = d.status === 'NOTICE_SENT' || (d.status === 'CONFIRMED' && !d.releaseCheck?.requestedAt)
            const showNotice = notice1 && ['NOTICE_SENT', 'AMENDMENT_REQUESTED', 'CONFIRMED', 'RELEASE_VERIFIED', 'DO_ISSUED'].includes(d.status)
            const cargoText = [
              notice1?.cargo?.commodity,
              notice1?.cargo?.packageCount != null ? `${notice1.cargo.packageCount} ${notice1.cargo.packageUnit || 'kiện'}` : null,
              notice1?.cargo?.grossWeightKg != null ? `G.W ${Number(notice1.cargo.grossWeightKg).toLocaleString('vi-VN')} kg` : null,
              notice1?.cargo?.cbm != null ? `${notice1.cargo.cbm} CBM` : null,
              notice1?.cargo?.containerCount ? `${notice1.cargo.containerCount} container` : null,
            ].filter(Boolean).join(' · ')
            const bannerCls = { action: 'border-orange-200 bg-orange-50 text-orange-900', info: 'border-slate-200 bg-slate-50 text-slate-700', done: 'border-emerald-200 bg-emerald-50 text-emerald-800' }[nextKind]
            return (
              <>
                {/* Đầu hồ sơ: số B/L, trạng thái, tiến trình, việc cần làm */}
                <div className={`${box} space-y-4`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-heading text-xl font-extrabold text-carbon tabular-nums">{d.blNumber}</h2>
                      <p className="text-sm text-slate-600">{d.vesselName} / {d.voyageNumber} · ETA {when(d.eta)}</p>
                    </div>
                    <Pill tone={statusTone[d.status]}>{statusLabels[d.status] || d.status}</Pill>
                  </div>
                  <ol className="grid grid-cols-4 gap-2">
                    {STEPS.map((label, i) => (
                      <li key={label} className="min-w-0">
                        <div className={`h-1.5 rounded-full ${i < step || d.status === 'DO_ISSUED' ? 'bg-emerald-500' : i === step ? 'bg-orange-500' : 'bg-slate-200'}`} />
                        <p className={`mt-1.5 text-[11px] font-semibold leading-tight ${i === step && d.status !== 'DO_ISSUED' ? 'text-orange-700' : i < step || d.status === 'DO_ISSUED' ? 'text-emerald-700' : 'text-slate-400'}`}>{i + 1}. {label}</p>
                      </li>
                    ))}
                  </ol>
                  <p className={`rounded-xl border px-3.5 py-2.5 text-sm font-medium ${bannerCls}`}>{nextText}</p>
                  {d.doNumber && <p className="text-sm font-semibold text-emerald-700">Lệnh giao hàng D/O: {d.doNumber}</p>}
                </div>

                <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Nội dung hồ sơ">
                  {[['info', 'Arrival Notice', false], ['actions', 'Thao tác', nextKind === 'action'], ['post', 'Thay đổi sau phát hành B/L', false], ['history', 'Lịch sử', false]].concat(d.edo ? [['edo', 'Lệnh giao hàng (e-D/O)', false]] : []).map(([key, label, dot]) => (
                    <button key={key} type="button" role="tab" aria-selected={activeTab === key} onClick={() => setTab(key)}
                      className={`h-9 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${activeTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                      {label}{dot && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-orange-500 align-middle" />}
                    </button>
                  ))}
                </div>

                <div>
                  {/* Thẻ "Arrival Notice" */}
                  <div className="min-w-0">
                    <div className={activeTab === 'info' ? 'space-y-6' : 'hidden'}>
                    {showNotice ? (
                      <div className={`${box} space-y-5`}>
                        <SectionTitle icon="description" aside={<span className="text-xs text-slate">Phiên bản {d.noticeVersion}</span>}>Arrival Notice</SectionTitle>

                        <div>
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-orange-700">Chuyến tàu</p>
                          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                            <Info label="Tàu / chuyến">{[notice1.vesselName, notice1.voyageNumber].filter(Boolean).join(' / ')}</Info>
                            <Info label="Ngày hàng về dự kiến (ETA)">{when(notice1.eta)}</Info>
                            <Info label="Cảng bốc hàng (POL)">{notice1.portOfLoading}</Info>
                            <Info label="Cảng dỡ hàng (POD)">{notice1.portOfDischarge}</Info>
                          </dl>
                        </div>

                        <div className="border-t border-chalk pt-4">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-orange-700">Hàng hóa</p>
                          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                            <div className="sm:col-span-2"><Info label="Thông tin hàng">{cargoText}</Info></div>
                            <div className="sm:col-span-2"><Info label="Container / seal">{(notice1.bl?.containers || []).map(c => `${c.containerNumber}${c.sealNumber && c.sealNumber !== c.containerNumber ? ` (seal ${c.sealNumber})` : ''}`).join('; ')}</Info></div>
                          </dl>
                        </div>

                        <div className="border-t border-chalk pt-4">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-orange-700">Lưu hàng và thời hạn</p>
                          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                            <Info label="Nơi lưu hàng">{`${notice1.stockLocation || ''}${notice1.warehouseCode ? ` · mã lưu kho ${notice1.warehouseCode}` : ''}`}</Info>
                            <Info label="Hạn xác nhận">{when(d.noticeDeadline)}</Info>
                            <Info label="Free time DEM / DET">{`${notice1.freeTime?.demDays} ngày / ${notice1.freeTime?.detDays} ngày · tính từ ${notice1.freeTime?.startsFrom}`}</Info>
                            <Info label="Chứng từ cần xuất trình để lấy D/O">{(notice1.requiredDocuments || []).join('; ')}</Info>
                          </dl>
                        </div>

                        <div className="border-t border-chalk pt-4">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-orange-700">Phí phải thanh toán tại cảng nhập</p>
                          {(notice1.fees || []).length === 0 ? <p className="text-sm text-slate-500">Không có khoản phí nào.</p> : (
                            <table className="w-full text-sm"><tbody>
                              {notice1.fees.map(f => <tr key={f.name} className="border-b border-slate-100"><td className="py-1.5">{f.name}</td><td className="py-1.5 text-right tabular-nums">{money(f.amountVnd)}</td></tr>)}
                            </tbody></table>
                          )}
                          <div className="mt-2 flex items-center justify-between rounded-xl bg-fog px-3.5 py-2.5 text-sm"><span className="font-semibold">Tổng cộng</span><span className="font-extrabold tabular-nums">{money(notice1.totalFeesVnd)}</span></div>
                          <p className="mt-1.5 text-xs text-slate-500">{notice1.freeTime?.overdueFeeNote}</p>
                        </div>

                        {notice1.notes && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Lưu ý từ hãng tàu: </strong>{notice1.notes}</p>}
                      </div>
                    ) : (
                      <div className={`${box} space-y-3`}>
                        <SectionTitle icon="inventory_2">Thông tin vận đơn</SectionTitle>
                        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                          <Info label="Người gửi (shipper)">{d.shipper}</Info>
                          <Info label="Người nhận (consignee)">{d.consignee}</Info>
                          <div className="sm:col-span-2"><Info label="Container / seal">{(d.containers || []).map(c => `${c.containerNumber}${c.sealNumber && c.sealNumber !== c.containerNumber ? ` (seal ${c.sealNumber})` : ''}`).join('; ')}</Info></div>
                        </dl>
                        <p className="text-xs text-slate-500">Arrival Notice sẽ hiện ở đây khi hãng tàu gửi.</p>
                      </div>
                    )}

                    </div>

                    <div className={activeTab === 'post' ? '' : 'hidden'}>
                      <PostIssuancePanel file={d} mode="company" onChanged={() => { loadDetail(d.id); loadList() }} />
                    </div>

                    <div className={activeTab === 'edo' ? '' : 'hidden'}>
                      <EdoDocument edo={d.edo} />
                    </div>

                    <div className={activeTab === 'history' ? '' : 'hidden'}>
                      <div className={`${box} space-y-3`}><SectionTitle icon="history">Lịch sử hồ sơ</SectionTitle><ImportDocumentTimeline events={d.events} /></div>
                    </div>
                  </div>

                  {/* Thao tác */}
                  <div className={activeTab === 'actions' ? 'space-y-6 min-w-0' : 'hidden'}>
                    {canEditConfirm && (
                      <form className={`${box} space-y-3`} onSubmit={e => { e.preventDefault(); act(() => importDocumentService.confirmNotice(d.id, { noticeVersion: d.noticeVersion, invoiceInfo: invoice, contactInfo: contact, freeTimeAcknowledged: ack }), d.status === 'CONFIRMED' ? 'Đã cập nhật thông tin xác nhận và gửi lại cho hãng tàu.' : 'Đã xác nhận Arrival Notice.') }}>
                        <SectionTitle icon="task_alt">{d.status === 'CONFIRMED' ? 'Thông tin đã xác nhận' : 'Xác nhận Arrival Notice'}</SectionTitle>
                        <p className="text-xs text-slate-500">Thông tin được điền sẵn từ hồ sơ công ty. Kiểm tra lại, sửa nếu chưa đúng rồi {d.status === 'CONFIRMED' ? 'gửi lại' : 'xác nhận'}.</p>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate">Xuất hóa đơn</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input className={`${field} sm:col-span-2`} placeholder="Tên công ty xuất hóa đơn" value={invoice.companyName} onChange={e => setInvoice(p => ({ ...p, companyName: e.target.value }))} />
                          <input className={field} placeholder="Mã số thuế" value={invoice.taxCode} onChange={e => setInvoice(p => ({ ...p, taxCode: e.target.value }))} />
                          <input className={field} type="email" placeholder="Email nhận hóa đơn" value={invoice.email} onChange={e => setInvoice(p => ({ ...p, email: e.target.value }))} />
                          <input className={`${field} sm:col-span-2`} placeholder="Địa chỉ" value={invoice.address} onChange={e => setInvoice(p => ({ ...p, address: e.target.value }))} />
                        </div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate">Người nhận D/O</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input className={field} placeholder="Người liên hệ nhận D/O" value={contact.name} onChange={e => setContact(p => ({ ...p, name: e.target.value }))} />
                          <input className={field} placeholder="Số điện thoại liên hệ" value={contact.phone} onChange={e => setContact(p => ({ ...p, phone: e.target.value }))} />
                        </div>
                        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={ack} onChange={e => setAck(e.target.checked)} /><span>Tôi đã kiểm tra thông tin lô hàng, biết các khoản phí phải trả và số ngày free time.</span></label>
                        <button type="submit" className={btnPrimary} disabled={busy || !confirmValid}>{d.status === 'CONFIRMED' ? 'Gửi lại thông tin' : 'Xác nhận'}</button>
                      </form>
                    )}

                    {d.status === 'NOTICE_SENT' && (
                      <form className={`${box} space-y-3`} onSubmit={e => { e.preventDefault(); act(() => importDocumentService.requestAmendment(d.id, { noticeVersion: d.noticeVersion, reason: amend.reason, changes: [{ field: amend.field, newValue: amend.value }] }), 'Đã gửi yêu cầu sửa cho hãng tàu.') }}>
                        <SectionTitle icon="edit_note">Thông tin sai? Yêu cầu sửa</SectionTitle>
                        <Select className={field} value={amend.field} onChange={e => setAmend(p => ({ ...p, field: e.target.value }))}>{AMEND_FIELDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
                        <input className={field} placeholder="Nội dung đúng" value={amend.value} onChange={e => setAmend(p => ({ ...p, value: e.target.value }))} />
                        <textarea className={field} rows={2} placeholder="Lý do sửa" value={amend.reason} onChange={e => setAmend(p => ({ ...p, reason: e.target.value }))} />
                        <p className="text-xs text-slate-500">Thông tin trên B/L do đầu xuất sửa và cần shipper xác nhận. Thông tin hành chính được cập nhật trực tiếp.</p>
                        <button type="submit" className={btn} disabled={busy || !amend.value.trim() || !amend.reason.trim()}>Gửi yêu cầu sửa</button>
                      </form>
                    )}

                    {d.status === 'AMENDMENT_REQUESTED' && d.amendmentRequest && (
                      <div className={`${box} border-sky-200 bg-sky-50 text-sm`}>
                        <p className="font-semibold text-sky-900">Yêu cầu sửa đang chờ hãng tàu</p>
                        <ul className="mt-1 text-xs">{d.amendmentRequest.changes.map(c => <li key={c.field}>{c.field}: {String(c.oldValue ?? '—')} → <strong>{c.newValue}</strong></li>)}</ul>
                      </div>
                    )}

                    {['CONFIRMED', 'RELEASE_VERIFIED'].includes(d.status) && (
                      <div className={`${box} space-y-3`}>
                        <SectionTitle icon="local_shipping">Lấy lệnh giao hàng (D/O)</SectionTitle>
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

                  </div>
                </div>
              </>
            )
          })()}
        </section>
      </div>
    </div>
  )
}
