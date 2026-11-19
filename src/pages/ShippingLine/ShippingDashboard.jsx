import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import expressApiClient from '../../services/expressApiClient'
import { shippingLineApi, formatApiErrorMessage } from './api/shippingLineApi'
import { btn, btnSoft, card, inputCls, PageHeader, Pill, SectionTitle, StatCard } from '../../components/Containers/docUi'
import { manifestStatusView } from './manifestStatusView'

const when = (value) => (value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—')
const sumOf = (obj) => Object.values(obj || {}).reduce((a, b) => a + b, 0)

// Trạng thái hiển thị theo ngữ cảnh người dùng, không đưa mã nội bộ ra giao diện
const voyageLabel = { Scheduled: 'Đang nhận booking', Closed: 'Đã chốt nhận hàng', Departed: 'Đã rời cảng', Cancelled: 'Đã huỷ' }
const importLabel = {
  RECEIVED: 'Đã nhận pre-alert', MISMATCH: 'Lệch thông tin', NOTICE_SENT: 'Chờ chủ hàng xác nhận', AMENDMENT_REQUESTED: 'Chủ hàng yêu cầu sửa',
  CONFIRMED: 'Chủ hàng đã xác nhận', RELEASE_VERIFIED: 'Đủ điều kiện giao hàng', DO_ISSUED: 'Đã phát hành D/O',
}
const requestLabel = { LOI_RELEASE: 'Giao hàng theo LOI', CHANGE_CONSIGNEE: 'Đổi người nhận', CHANGE_POD: 'Đổi cảng dỡ', SCHEDULE_CHANGE: 'Đổi lịch tàu' }
const docLabel = { BL: 'Vận đơn', PRE_ALERT: 'Pre-alert', ARRIVAL_NOTICE: 'Thông báo hàng đến', DO: 'Lệnh giao hàng', MANIFEST: 'Bản khai' }
const alertTone = { ERROR: 'border-rose-200 bg-rose-50 text-rose-950', WARNING: 'border-amber-200 bg-amber-50 text-amber-950', INFO: 'border-chalk bg-fog text-carbon' }

function Breakdown({ items, labels, empty }) {
  const rows = Object.entries(items || {}).filter(([, n]) => n > 0)
  if (rows.length === 0) return <p className="text-xs italic text-slate">{empty}</p>
  return (
    <ul className="space-y-1.5">
      {rows.map(([key, n]) => (
        <li key={key} className="flex items-center justify-between text-xs">
          <span className="text-carbon font-semibold">{labels?.[key] || key}</span>
          <span className="font-mono font-extrabold text-carbon">{n}</span>
        </li>
      ))}
    </ul>
  )
}

export default function ShippingDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [containerNo, setContainerNo] = useState('')
  const [gateCheck, setGateCheck] = useState(null)
  const [checking, setChecking] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await shippingLineApi.getDashboard()
      setData(res?.export ? res : res?.data || null)
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Không thể tải dữ liệu tổng quan'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const checkGateOut = async (e) => {
    e.preventDefault()
    const no = containerNo.trim().toUpperCase()
    if (!no) return
    setChecking(true)
    setGateCheck(null)
    try {
      setGateCheck(await expressApiClient.get(`/shipping-line/gate-out/verify/${encodeURIComponent(no)}`))
    } catch (err) {
      setGateCheck({ canGateOut: false, reason: formatApiErrorMessage(err, 'Không kiểm tra được điều kiện ra cổng') })
    } finally {
      setChecking(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="p-8 w-full flex flex-col items-center justify-center min-h-[400px] gap-3 text-slate">
        <div className="w-8 h-8 border-2 border-signal-orange border-t-transparent rounded-full animate-spin" />
        <div className="text-xs font-bold uppercase tracking-wider">Đang tải tổng quan hãng tàu...</div>
      </div>
    )
  }

  const ex = data?.export || {}
  const im = data?.import || {}
  const manifests = ex.manifests || { export: {}, import: {}, total: 0 }
  const bills = ex.bills || {}
  const edo = im.edo || {}
  const alerts = data?.alerts || []
  const activity = data?.activity || []
  const voyages = ex.upcomingVoyages || []

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen">
      <PageHeader
        badge="Không gian Hãng tàu"
        title={`Tổng Quan Hoạt Động${data?.line ? ` · ${data.line.short_name}` : ''}`}
        subtitle="Chiều xuất: chuyến tàu → bản khai → phát hành vận đơn → chủ hàng khai báo ePort theo số vận đơn. Chiều nhập: pre-alert → thông báo hàng đến → giải phóng hàng → lệnh giao hàng."
        actions={(
          <>
            {data?.generatedAt && <span className="text-[11px] font-mono text-slate">Cập nhật {when(data.generatedAt)}</span>}
            <button type="button" onClick={load} disabled={loading} className={btnSoft}>
              <span className="material-symbols-outlined text-base">refresh</span>
              {loading ? 'Đang tải...' : 'Tải lại'}
            </button>
          </>
        )}
      />

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">{error}</div>}

      {/* Chỉ số chính, bấm vào để tới đúng trang nghiệp vụ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Chuyến tàu đang mở" value={ex.voyages?.byStatus?.Scheduled || 0} hint={`${ex.voyages?.total || 0} chuyến của hãng`} tone="text-blue-700" onClick={() => navigate('/shipping-line/voyages')} />
        <StatCard label="Vận đơn xuất" value={bills.total || 0} hint={`${bills.notIssued || 0} chờ phát hành`} tone="text-amber-700" onClick={() => navigate('/shipping-line/manifest')} />
        <StatCard label="Bản khai hàng hóa" value={manifests.total || 0} hint={`${sumOf(manifests.export)} xuất · ${sumOf(manifests.import)} nhập`} tone="text-purple-700" onClick={() => navigate('/shipping-line/manifest')} />
        <StatCard label="Vận đơn đã phát hành" value={bills.issued || 0} hint={`${bills.notIssued || 0} vận đơn chưa phát hành`} tone={bills.notIssued ? 'text-amber-700' : 'text-emerald-700'} onClick={() => navigate('/shipping-line/manifest')} />
        <StatCard label="Hồ sơ hàng nhập" value={im.shipments?.total || 0} hint={`${im.postIssuanceRequests?.total || 0} yêu cầu chờ duyệt`} tone="text-blue-700" onClick={() => navigate('/shipping-line/import-documents')} />
        <StatCard label="Lệnh giao hàng còn hiệu lực" value={edo.active || 0} hint={`${edo.expiringSoon || 0} sắp hết hạn · ${edo.expired || 0} đã hết hạn`} tone={edo.expiringSoon || edo.expired ? 'text-amber-700' : 'text-emerald-700'} onClick={() => navigate('/shipping-line/delivery-orders')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Chuyến tàu sắp chạy và các mốc hạn chót */}
          <div className={card}>
            <SectionTitle
              icon="directions_boat"
              aside={<button type="button" onClick={() => navigate('/shipping-line/voyages')} className="text-xs font-bold text-signal-orange hover:underline">Toàn bộ lịch tàu →</button>}
            >
              Chuyến tàu sắp chạy & hạn chót
            </SectionTitle>
            {voyages.length === 0 ? (
              <p className="p-6 text-center text-xs italic text-slate">Hãng chưa có chuyến tàu nào đang mở. Tạo chuyến mới ở trang Tàu & Chuyến Tàu.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-xs">
                  <thead>
                    <tr className="bg-fog text-[10px] font-bold uppercase text-slate border-b border-chalk">
                      <th className="py-2.5 px-3">Chuyến</th>
                      <th className="py-2.5 px-3">Tuyến</th>
                      <th className="py-2.5 px-3">Hạn SI</th>
                      <th className="py-2.5 px-3">Hạn VGM</th>
                      <th className="py-2.5 px-3">Hạn hạ bãi (CY)</th>
                      <th className="py-2.5 px-3">ETD</th>
                      <th className="py-2.5 px-3 text-right">Vận đơn / Cont</th>
                      <th className="py-2.5 px-3">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-chalk">
                    {voyages.map((v) => (
                      <tr key={v.id} className="hover:bg-fog/60">
                        <td className="py-3 px-3"><div className="font-mono font-bold text-carbon">{v.voyageNumber}</div><div className="text-[11px] text-slate">{v.vesselName}</div></td>
                        <td className="py-3 px-3 text-carbon">{v.pol} → {v.pod}</td>
                        <td className="py-3 px-3 font-mono text-slate">{when(v.siCutoff)}</td>
                        <td className="py-3 px-3 font-mono text-slate">{when(v.vgmCutoff)}</td>
                        <td className="py-3 px-3 font-mono font-bold text-amber-700">{when(v.cyCutoff)}</td>
                        <td className="py-3 px-3 font-mono text-slate">{when(v.etd)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-carbon">
                          {v.bills} / {v.containers}
                        </td>
                        <td className="py-3 px-3"><Pill tone={v.status === 'Scheduled' ? 'green' : 'slate'}>{voyageLabel[v.status] || v.status}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tình hình hai chiều xuất / nhập */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={card}>
              <SectionTitle icon="north_east">Chiều xuất</SectionTitle>
              <p className="text-[10px] font-bold uppercase text-slate mb-2">Bản khai xuất</p>
              <Breakdown
                items={Object.fromEntries(Object.entries(manifests.export || {}).map(([s, n]) => [manifestStatusView({ status: s, direction: 'EXPORT' }).label, n]))}
                empty="Chưa có bản khai xuất."
              />
              <p className="text-[10px] font-bold uppercase text-slate mt-4 mb-2">Vận đơn trong bản khai</p>
              <Breakdown items={{ 'Đã phát hành': bills.issued || 0, 'Chưa phát hành': bills.notIssued || 0 }} empty="Bản khai chưa có vận đơn." />
            </div>
            <div className={card}>
              <SectionTitle icon="south_west">Chiều nhập</SectionTitle>
              <p className="text-[10px] font-bold uppercase text-slate mb-2">Hồ sơ hàng nhập</p>
              <Breakdown items={im.shipments?.byStatus} labels={importLabel} empty="Chưa có hồ sơ hàng nhập." />
              <p className="text-[10px] font-bold uppercase text-slate mt-4 mb-2">Bản khai nhập</p>
              <Breakdown
                items={Object.fromEntries(Object.entries(manifests.import || {}).map(([s, n]) => [manifestStatusView({ status: s, direction: 'IMPORT' }).label, n]))}
                empty="Chưa có bản khai nhập."
              />
              <p className="text-[10px] font-bold uppercase text-slate mt-4 mb-2">Yêu cầu sau phát hành chờ duyệt</p>
              <Breakdown items={im.postIssuanceRequests?.byType} labels={requestLabel} empty="Không có yêu cầu chờ duyệt." />
              {(im.loi?.outstanding || 0) > 0 && (
                <p className="mt-3 text-xs text-carbon">B/L gốc chưa nộp lại sau LOI: <strong className="font-mono">{im.loi.outstanding}</strong>{im.loi.overdue ? <span className="text-rose-700 font-bold"> ({im.loi.overdue} quá hạn)</span> : null}</p>
              )}
            </div>
          </div>

          {/* Nhật ký hồ sơ gần đây */}
          <div className={card}>
            <SectionTitle icon="history">Hoạt động gần đây</SectionTitle>
            {activity.length === 0 ? (
              <p className="p-4 text-center text-xs italic text-slate">Chưa có hoạt động nào được ghi nhận.</p>
            ) : (
              <ul className="divide-y divide-chalk">
                {activity.map((a) => (
                  <li key={a.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-carbon">
                        <Pill tone={a.direction === 'IMPORT' ? 'blue' : 'orange'}>{a.direction === 'IMPORT' ? 'Nhập' : 'Xuất'}</Pill>{' '}
                        {docLabel[a.documentType] || a.documentType} <span className="font-mono">{a.fileRef}</span>
                      </div>
                      {a.note && <div className="mt-0.5 text-[11px] text-slate">{a.note}</div>}
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-slate">
                      <div className="font-mono">{when(a.createdAt)}</div>
                      {a.actor && <div>{a.actor}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Việc cần xử lý */}
          <div className={card}>
            <SectionTitle icon="notification_important">Việc cần xử lý ({alerts.length})</SectionTitle>
            {alerts.length === 0 ? (
              <p className="p-4 text-center text-xs italic text-slate">Không có việc tồn đọng.</p>
            ) : (
              <div className="space-y-3">
                {alerts.map((al) => (
                  <button key={al.id} type="button" onClick={() => navigate(al.targetPath)} className={`w-full text-left p-3.5 rounded-xl border text-xs hover:shadow-sm ${alertTone[al.type] || alertTone.INFO}`}>
                    <div className="font-bold flex items-center justify-between gap-2">
                      <span>{al.title}</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </div>
                    <div className="mt-1 text-[11px] opacity-90">{al.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Đối chiếu điều kiện ra cổng theo lệnh giao hàng */}
          <div className={card}>
            <SectionTitle icon="fact_check">Kiểm tra điều kiện ra cổng</SectionTitle>
            <p className="text-xs text-slate mb-3">Nhập số container để kiểm tra lệnh giao hàng còn hiệu lực và không bị giữ.</p>
            <form onSubmit={checkGateOut} className="flex gap-2">
              <input value={containerNo} onChange={(e) => setContainerNo(e.target.value.toUpperCase())} placeholder="Số container (11 ký tự)" maxLength={11} className={`${inputCls} font-mono uppercase`} />
              <button type="submit" disabled={checking || !containerNo.trim()} className={btn}>{checking ? '...' : 'Kiểm tra'}</button>
            </form>
            {gateCheck && (
              <div className={`mt-3 p-3.5 rounded-xl border text-xs ${gateCheck.canGateOut ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-rose-50 border-rose-200 text-rose-950'}`}>
                <div className="font-bold">{gateCheck.canGateOut ? 'Đủ điều kiện ra cổng' : 'Chưa được ra cổng'}</div>
                {gateCheck.reason && <p className="mt-1 text-[11px]">{gateCheck.reason}</p>}
              </div>
            )}
          </div>

          {/* Lối tắt theo đúng trình tự nghiệp vụ */}
          <div className={card}>
            <SectionTitle icon="alt_route">Lối tắt nghiệp vụ</SectionTitle>
            <div className="space-y-2">
              {[
                ['/shipping-line/voyages', 'Tàu & chuyến tàu, hạn chót'],
                ['/shipping-line/containers', 'Khai báo container'],
                ['/shipping-line/manifest', 'Bản khai hàng hóa & phát hành vận đơn'],
                ['/shipping-line/import-documents', 'Hồ sơ hàng nhập & yêu cầu sau phát hành'],
                ['/shipping-line/delivery-orders', 'Lệnh giao hàng (e-D/O)'],
              ].map(([path, label]) => (
                <button key={path} type="button" onClick={() => navigate(path)} className="w-full text-left p-2.5 rounded-xl bg-fog hover:bg-chalk border border-chalk flex items-center justify-between text-xs font-bold text-carbon">
                  <span>{label}</span>
                  <span className="material-symbols-outlined text-sm text-slate">arrow_forward</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
