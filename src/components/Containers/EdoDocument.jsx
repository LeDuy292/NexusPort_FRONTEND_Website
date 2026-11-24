import { QRCodeSVG } from 'qrcode.react'

const dt = value => (value ? new Date(String(value).replace(' ', 'T')).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—')
const STATUS = {
  ISSUED: { label: 'Đang hiệu lực', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  RELEASED: { label: 'Đang hiệu lực', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  HELD: { label: 'Đang bị giữ', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  EXPIRED: { label: 'Đã hết hạn', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  CANCELLED: { label: 'Đã hủy', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
}

function Field({ label, children, wide }) {
  return (
    <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-slate-900">{children == null || children === '' ? '—' : children}</dd>
    </div>
  )
}

/** Bản điện tử của lệnh giao hàng (e-D/O): dữ liệu lấy trực tiếp từ lệnh đã phát hành, có mã QR và có thể in. */
export default function EdoDocument({ edo }) {
  if (!edo) return <p className="text-sm text-slate-500">Chưa phát hành lệnh giao hàng.</p>
  const st = STATUS[edo.status] || { label: edo.status, cls: 'bg-slate-100 text-slate-700 border-slate-300' }
  const valid = edo.validUntil ? new Date(String(edo.validUntil).replace(' ', 'T')) : null
  const daysLeft = valid ? Math.ceil((valid.getTime() - Date.now()) / 86400000) : null
  const qr = `NXP-EDO|${edo.edoNumber}|${edo.blNumber}|${edo.pinCode || ''}`
  const containers = edo.containers || []

  return (
    <div>
      <style>{`@media print { body * { visibility: hidden; } #edo-print, #edo-print * { visibility: visible; } #edo-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: 0; } .edo-no-print { display: none !important; } }`}</style>
      <div className="edo-no-print mb-3 flex justify-end">
        <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-carbon px-4 text-xs font-bold text-white hover:bg-graphite cursor-pointer">
          <span className="material-symbols-outlined text-base">print</span>In hoặc lưu PDF
        </button>
      </div>

      <article id="edo-print" className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
        {/* Đầu lệnh */}
        <header className="flex flex-wrap items-center justify-between gap-4 bg-carbon px-6 py-5 text-white">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-orange-300">Cảng Tiên Sa · NexusPort</p>
            <h3 className="mt-1 text-xl font-extrabold tracking-tight">Lệnh giao hàng điện tử (e-D/O)</h3>
            <p className="mt-1 text-sm text-slate-300">Số lệnh <span className="font-extrabold tabular-nums text-white">{edo.edoNumber}</span></p>
          </div>
          <div className="flex items-center gap-4">
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${st.cls}`}>{st.label}</span>
            <div className="rounded-xl bg-white p-2"><QRCodeSVG value={qr} size={84} level="M" /></div>
          </div>
        </header>

        {/* Thời hạn hiệu lực + mã PIN */}
        <div className="grid grid-cols-1 gap-px bg-slate-200 sm:grid-cols-3">
          <div className="bg-orange-50 px-6 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700">Có hiệu lực đến</p>
            <p className="mt-0.5 text-base font-extrabold tabular-nums text-slate-900">{dt(edo.validUntil)}</p>
            {daysLeft != null && <p className={`text-xs font-semibold ${daysLeft < 0 ? 'text-rose-700' : daysLeft <= 2 ? 'text-amber-700' : 'text-slate-500'}`}>{daysLeft < 0 ? 'Đã quá hạn' : daysLeft === 0 ? 'Hết hạn hôm nay' : `Còn ${daysLeft} ngày`}</p>}
          </div>
          <div className="bg-orange-50 px-6 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700">Ngày phát hành</p>
            <p className="mt-0.5 text-base font-extrabold tabular-nums text-slate-900">{dt(edo.issueDate)}</p>
            <p className="text-xs text-slate-500">Bởi {edo.releaseOfficer || edo.issuedBy || '—'}</p>
          </div>
          <div className="bg-orange-50 px-6 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700">Mã PIN nhận hàng</p>
            <p className="mt-0.5 text-base font-extrabold tabular-nums tracking-wider text-slate-900">{edo.pinCode || '—'}</p>
            <p className="text-xs text-slate-500">Đọc cho nhân viên cổng khi lấy hàng</p>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          {/* Người nhận & vận đơn */}
          <section>
            <h4 className="mb-3 border-b border-slate-200 pb-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-700">Người nhận hàng và vận đơn</h4>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <Field label="Người nhận hàng" wide>{edo.consignee}</Field>
              <Field label="Mã số thuế">{edo.consigneeTaxCode}</Field>
              <Field label="Số vận đơn (B/L)">{edo.blNumber}</Field>
            </dl>
          </section>

          {/* Chuyến tàu */}
          <section>
            <h4 className="mb-3 border-b border-slate-200 pb-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-700">Chuyến tàu</h4>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <Field label="Tàu / chuyến">{[edo.vesselName, edo.voyageNumber].filter(Boolean).join(' / ')}</Field>
              <Field label="Ngày tàu đến (ETA)">{dt(edo.eta)}</Field>
              <Field label="Cảng bốc hàng">{edo.portOfLoading}</Field>
              <Field label="Cảng dỡ hàng">{edo.portOfDischarge}</Field>
            </dl>
          </section>

          {/* Container */}
          <section>
            <h4 className="mb-3 border-b border-slate-200 pb-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-700">Container được giao ({containers.length})</h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr><th className="px-3 py-2">Số container</th><th className="px-3 py-2">Loại</th><th className="px-3 py-2">Số seal</th><th className="px-3 py-2 text-right">Trọng lượng</th><th className="px-3 py-2">Vị trí lấy hàng</th></tr>
                </thead>
                <tbody>
                  {containers.map(c => (
                    <tr key={c.containerNumber} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-extrabold tabular-nums text-slate-900">{c.containerNumber}</td>
                      <td className="px-3 py-2 text-slate-700">{c.isoType || '—'}</td>
                      <td className="px-3 py-2 tabular-nums text-slate-700">{c.sealNumber && c.sealNumber !== c.containerNumber ? c.sealNumber : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{c.grossWeightKg != null ? `${Number(c.grossWeightKg).toLocaleString('vi-VN')} kg` : '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{c.yardSlot ? <span className="font-bold tabular-nums text-slate-900">{c.yardSlot}</span> : (edo.stockLocation || '—')}{c.yardSlot && edo.stockLocation ? <span className="text-slate-500"> · {edo.stockLocation}</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Điều kiện */}
          <section>
            <h4 className="mb-3 border-b border-slate-200 pb-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-700">Điều kiện lưu bãi và trả vỏ</h4>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <Field label="Miễn phí lưu bãi (DEM)">{edo.demDays != null ? `${edo.demDays} ngày` : (edo.freeTimeDays != null ? `${edo.freeTimeDays} ngày` : null)}</Field>
              <Field label="Miễn phí lưu vỏ (DET)">{edo.detDays != null ? `${edo.detDays} ngày` : null}</Field>
              <Field label="Nơi trả vỏ container rỗng" wide>{edo.emptyReturnDepot}</Field>
            </dl>
          </section>

          {edo.notes && <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><strong>Ghi chú: </strong>{edo.notes}</p>}
          {edo.status === 'CANCELLED' && edo.cancelReason && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><strong>Lý do hủy: </strong>{edo.cancelReason}</p>}
        </div>

        <footer className="border-t border-slate-200 bg-slate-50 px-6 py-3 text-[11px] text-slate-500">
          Lệnh giao hàng điện tử do hệ thống NexusPort phát hành, có giá trị khi xuất trình mã QR hoặc mã PIN tại cổng cảng. Mỗi lệnh chỉ dùng một lần cho các container ghi trên lệnh.
        </footer>
      </article>
    </div>
  )
}
