import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../../services/apiClient'
import ImportDocumentTimeline from '../../components/Containers/ImportDocumentTimeline'
import { btn, card as box, Info, PageHeader, StatCard, Pill, EmptyState, SectionTitle, inputCls, theadCls, thCls } from '../../components/Containers/docUi'
import Select from '../../components/ui/Select'

const unwrap = res => res.data?.data ?? res.data
const errorText = err => err?.response?.data?.message || err?.message || 'Không thể xử lý yêu cầu.'
const when = value => (value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—')
const directionLabel = { EXPORT: 'Xuất khẩu', IMPORT: 'Nhập khẩu' }
const directionTone = { EXPORT: 'blue', IMPORT: 'purple' }
// Trạng thái vận đơn nói theo ngữ cảnh chủ hàng
const blStatus = { ISSUED: 'Đã phát hành', TELEX_RELEASED: 'Đã điện giao hàng', SURRENDERED: 'Đã nộp B/L gốc', DRAFT: 'Bản nháp' }
const blStatusTone = { ISSUED: 'green', TELEX_RELEASED: 'blue', SURRENDERED: 'purple' }
const blTypes = { ORIGINAL: 'B/L gốc', TELEX_RELEASE: 'Telex release', SEAWAY_BILL: 'Seaway Bill' }
const stateTone = { NOT_FOUND: 'slate', EXPECTED: 'amber', AT_PORT: 'blue', LOADED: 'green', DISCHARGED: 'green', RELEASED: 'purple' }

/** Transport company xem vận đơn của mình: chủ hàng (xuất) hoặc người nhận hàng (nhập). */
export default function MyBillsPage() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState('')
  const [selected, setSelected] = useState('')
  const [detail, setDetail] = useState(null)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const data = unwrap(await apiClient.get('/bl-imports/my-bills')); if (alive.current) setBills(data || []) } catch (err) { if (alive.current) setError(errorText(err)) } finally { if (alive.current) setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!selected) { setDetail(null); return }
    apiClient.get(`/bl-imports/my-bills/${encodeURIComponent(selected)}`).then(res => { if (alive.current) setDetail(unwrap(res)) }).catch(err => { if (alive.current) setError(errorText(err)) })
  }, [selected])

  const shown = bills.filter(b => (!direction || b.direction === direction) && (!search.trim() || `${b.blNumber} ${b.voyageNumber} ${b.shipper} ${b.consignee}`.toLowerCase().includes(search.trim().toLowerCase())))

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen">
      <PageHeader
        badge="Không gian doanh nghiệp vận tải"
        title="Vận đơn của tôi"
        subtitle="Các vận đơn hãng tàu đã phát hành cho công ty bạn, hàng xuất (bạn là chủ hàng) và hàng nhập (bạn là người nhận). Theo dõi container đã vào cảng, xếp tàu hay đã dỡ."
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Tổng vận đơn" value={bills.length} />
        <StatCard label="Hàng xuất" value={bills.filter(b => b.direction === 'EXPORT').length} tone="text-blue-700" hint="Bạn là chủ hàng" />
        <StatCard label="Hàng nhập" value={bills.filter(b => b.direction === 'IMPORT').length} tone="text-purple-700" hint="Bạn là người nhận" />
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
        <section className={`${box} space-y-4`}>
          <SectionTitle icon="receipt_long" aside={<span className="text-xs font-mono text-slate">{shown.length} vận đơn</span>}>Danh sách vận đơn</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <input className={`${inputCls} min-w-0 flex-1`} placeholder="Số B/L, chuyến tàu, người gửi, người nhận" value={search} onChange={e => setSearch(e.target.value)} />
            <Select className={`${inputCls} !w-auto`} value={direction} onChange={e => setDirection(e.target.value)}>
              <option value="">Cả hai chiều</option><option value="EXPORT">Xuất khẩu</option><option value="IMPORT">Nhập khẩu</option>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-xs">
              <thead className={theadCls}><tr><th className={thCls}>Số B/L</th><th className={thCls}>Chiều</th><th className={thCls}>Chuyến</th><th className={thCls}>Container</th><th className={thCls}>Trạng thái</th></tr></thead>
              <tbody className="divide-y divide-chalk">
                {loading && <tr><td colSpan={5} className="py-8 text-center text-slate">Đang tải…</td></tr>}
                {!loading && shown.length === 0 && <tr><td colSpan={5}><EmptyState icon="receipt_long" title="Chưa có vận đơn nào">Vận đơn xuất hiện khi hãng tàu phát hành B/L có ghi tên công ty bạn là người gửi hoặc người nhận hàng.</EmptyState></td></tr>}
                {shown.map(b => (
                  <tr key={b.blNumber} onClick={() => setSelected(b.blNumber)} className={`cursor-pointer hover:bg-fog/60 ${selected === b.blNumber ? 'bg-orange-50/60' : ''}`}>
                    <td className="py-3 px-3 font-mono font-bold text-carbon">{b.blNumber}</td>
                    <td className="py-3 px-3"><Pill tone={directionTone[b.direction]}>{directionLabel[b.direction]}</Pill></td>
                    <td className="py-3 px-3">{b.voyageNumber}</td>
                    <td className="py-3 px-3">{b.containerCount}</td>
                    <td className="py-3 px-3"><Pill tone={blStatusTone[b.status]}>{blStatus[b.status] || 'Đang cập nhật'}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-6">
          {!detail && <div className={box}><EmptyState icon="touch_app" title="Chọn một vận đơn">Chọn vận đơn ở danh sách bên trái để xem thông tin và tình trạng container.</EmptyState></div>}
          {detail && (
            <>
              <div className={`${box} space-y-4`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-heading text-lg font-extrabold text-carbon font-mono">{detail.blNumber}</h2>
                    <p className="text-sm text-slate">{detail.vesselName} / {detail.voyageNumber}</p>
                  </div>
                  <div className="space-x-2"><Pill tone={directionTone[detail.direction]}>{directionLabel[detail.direction]}</Pill><Pill tone={blStatusTone[detail.status]}>{blStatus[detail.status] || 'Đang cập nhật'}</Pill></div>
                </div>
                <dl className="grid gap-3 sm:grid-cols-3">
                  <Info label="Cảng bốc → cảng dỡ">{detail.pol} → {detail.pod}</Info>
                  <Info label="Hình thức B/L">{blTypes[detail.blType] || detail.blType}</Info>
                  <Info label="Điều kiện cước">{detail.freightStatus === 'COLLECT' ? 'Trả sau' : 'Trả trước'}</Info>
                  <Info label="Người gửi">{detail.shipper}</Info>
                  <Info label="Người nhận">{detail.consignee}</Info>
                  <Info label="Bên thông báo">{detail.notifyParty}</Info>
                  <Info label="Mô tả hàng">{detail.cargoDescription}</Info>
                  <Info label="Khối lượng">{detail.grossWeightKg ? `${Number(detail.grossWeightKg).toLocaleString('vi-VN')} kg` : '—'}</Info>
                  <Info label="Ngày phát hành">{when(detail.issueDate)}</Info>
                </dl>
                {detail.direction === 'IMPORT' && <Link to={`/import-documents?bl=${encodeURIComponent(detail.blNumber)}`} className="inline-block text-xs font-bold text-signal-orange hover:underline">Mở Chứng từ hàng nhập (Arrival Notice, D/O) →</Link>}
              </div>

              <div className={box}>
                <SectionTitle icon="inventory_2">Container và tình trạng tại cảng</SectionTitle>
                {detail.containers.length === 0 ? <p className="text-xs text-slate">Chưa có danh sách container.</p> : (
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className={theadCls}><tr><th className={thCls}>Số container</th><th className={thCls}>Seal</th><th className={thCls}>VGM (kg)</th><th className={thCls}>Tình trạng</th></tr></thead>
                    <tbody className="divide-y divide-chalk">
                      {detail.containers.map(c => (
                        <tr key={c.containerNumber}>
                          <td className="py-2.5 px-3 font-mono font-bold text-carbon">{c.containerNumber}</td>
                          <td className="py-2.5 px-3 font-mono">{c.sealNumber || '—'}</td>
                          <td className="py-2.5 px-3">{c.vgmKg ? Number(c.vgmKg).toLocaleString('vi-VN') : '—'}</td>
                          <td className="py-2.5 px-3"><Pill tone={stateTone[c.state]}>{c.stateLabel}</Pill>{c.hasIssues && <p className="mt-1 text-[11px] text-rose-700">Có sai khác thông tin, hãng tàu đang kiểm tra.</p>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className={`${box} space-y-3`}>
                <SectionTitle icon="history">Lịch sử vận đơn</SectionTitle>
                <ImportDocumentTimeline events={detail.events} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
