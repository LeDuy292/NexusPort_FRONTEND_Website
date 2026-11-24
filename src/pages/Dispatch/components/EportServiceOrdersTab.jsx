import React from 'react'
import { FileText, Container, Search, ArrowUpRight, Filter, Loader2 } from 'lucide-react'
import OrderBadge from '../../../features/service-catalog/ServiceOrderBadge'
import { money } from '../../../features/service-catalog/catalogApi'
import { draftDateTime } from '../../../features/service-catalog/serviceDraftsApi'
import { orderStatusLabels, paymentStatusLabels, paymentStateLabel, statusTone } from '../../../features/service-catalog/serviceOrdersApi'
import { companiesMatch } from '../GateBookingRequests'
import Select from '../../../components/ui/Select'

export default function EportServiceOrdersTab({
  eportListTotal = 0,
  eportListPage = 1,
  setEportListPage,
  eportListSearch,
  setEportListSearch,
  eportListStatus,
  setEportListStatus,
  eportListPaymentStatus,
  setEportListPaymentStatus,
  eportListFlow,
  setEportListFlow,
  eportListError,
  eportListLoading,
  eportListItems = [],
  eportValidationMap = {},
  manifestGeneratedBookings = [],
  bookings = [],
  serviceOrdersApi,
  loadAllEportRequests,
  onOpenOrder,
  onOpenReconciliation,
}) {
  return (
    <section className="epo-worklist" aria-labelledby="epo-port-list-title">
      <div className="epo-worklist-heading">
        <div>
          <span className="epo-caption">KHÔNG GIAN HỒ SƠ</span>
          <h2 id="epo-port-list-title">Tất Cả Yêu Cầu Dịch Vụ ePort Gửi Đến Cảng</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="epo-result-count">{eportListTotal} hồ sơ</span>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setEportListPage(1)
          loadAllEportRequests?.({ page: 1 })
        }}
        className="epo-filters"
      >
        <div className="epc-search epo-search">
          <Search size={17} />
          <input
            aria-label="Tìm đơn dịch vụ ePort"
            maxLength={100}
            placeholder="Mã đơn, Booking, dịch vụ hoặc container…"
            value={eportListSearch}
            onChange={(e) => setEportListSearch(e.target.value)}
          />
        </div>
        <label>
          <span className="epc-sr-only">Trạng thái đơn</span>
          <Select
            value={eportListStatus}
            onChange={(e) => {
              setEportListStatus(e.target.value)
              setEportListPage(1)
            }}
          >
            <option value="">Mọi trạng thái đơn</option>
            {Object.entries(orderStatusLabels)
              .filter(([val]) => val !== 'DRAFT')
              .map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
          </Select>
        </label>
        <label>
          <span className="epc-sr-only">Trạng thái thanh toán</span>
          <Select
            value={eportListPaymentStatus}
            onChange={(e) => {
              setEportListPaymentStatus(e.target.value)
              setEportListPage(1)
            }}
          >
            <option value="">Mọi thanh toán</option>
            {['UNPAID', 'PENDING', 'PAID', 'FAILED', 'NOT_REQUIRED'].map((val) => (
              <option key={val} value={val}>{paymentStatusLabels[val] || val}</option>
            ))}
          </Select>
        </label>
        <label>
          <span className="epc-sr-only">Luồng hàng</span>
          <Select
            value={eportListFlow}
            onChange={(e) => {
              setEportListFlow(e.target.value)
              setEportListPage(1)
            }}
          >
            <option value="">Mọi luồng hàng</option>
            <option value="EXPORT">Hàng xuất</option>
            <option value="IMPORT">Hàng nhập</option>
          </Select>
        </label>
      </form>

      {eportListError && (
        <div className="mx-6 mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {eportListError}
        </div>
      )}

      {eportListLoading ? (
        <div className="epo-empty" role="status">
          <Loader2 size={29} className="epc-spin" />
          <h3>Đang tải hồ sơ…</h3>
        </div>
      ) : eportListItems.length === 0 ? (
        <div className="epo-empty">
          <Filter size={33} />
          <h3>Không có hồ sơ phù hợp</h3>
          <p>Thử điều chỉnh từ khóa hoặc bộ lọc để tìm lại hồ sơ ePort gửi đến cảng.</p>
          {(eportListSearch || eportListStatus || eportListPaymentStatus || eportListFlow) && (
            <button
              type="button"
              className="epc-button secondary"
              onClick={() => {
                setEportListSearch('')
                setEportListStatus('')
                setEportListPaymentStatus('')
                setEportListFlow('')
                setEportListPage(1)
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto w-full rounded-2xl border border-[#e2e8f0] bg-white shadow-2xs">
          <table className="w-full text-left border-collapse text-xs min-w-[1100px]">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#71869f] font-bold uppercase text-[10px] tracking-wider select-none">
                <th className="py-3 px-4 w-[280px]">Hồ Sơ / Dịch Vụ</th>
                <th className="py-3 px-4 w-[210px]">Nguồn / Container</th>
                <th className="py-3 px-3.5 w-[160px]">Trạng Thái Xử Lý</th>
                <th className="py-3 px-3.5 w-[210px]">Lý Do Từ Chối</th>
                <th className="py-3 px-4 w-[140px] text-right">Giá Trị Đăng Ký</th>
                <th className="py-3 px-4 w-[210px] text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f7]">
              {eportListItems.map((order) => {
                const validation = eportValidationMap[order.id] || eportValidationMap[String(order.id)]
                const srcUpper = String(order.sourceLabel || '').toUpperCase()
                const orderConts = (order.containers || []).map((x) => String(x.containerNumber || '').toUpperCase())
                const orderBl = String(order.content?.source?.blNumber || order.sourceSnapshot?.blNumber || '').toUpperCase()
                const orderBk = String(order.content?.source?.bookingNumber || order.sourceSnapshot?.bookingNumber || '').toUpperCase()
                const allGates = [...manifestGeneratedBookings, ...bookings]
                const matchedGate =
                  (validation?.bookingId
                    ? allGates.find((b) => b.id === validation.bookingId)
                    : null) ||
                  allGates.find((b) => {
                    const c = String(b.containerId || '').toUpperCase()
                    const bl = String(b.cargoDeclarationId || b.billOfLading || '').toUpperCase()
                    const bid = String(b.id || '').toUpperCase()
                    return (
                      (c && (srcUpper.includes(c) || orderConts.includes(c))) ||
                      (bl && bl !== 'N/A' && (srcUpper.includes(bl) || orderBl === bl)) ||
                      (bid && (srcUpper.includes(bid) || orderBk === bid))
                    )
                  })

                // Tự động kiểm tra đối chiếu ngay tại tab nếu validation map chưa kịp phản hồi:
                const isImport = String(order.flow || '').toUpperCase() === 'IMPORT'
                const targetCompany = matchedGate
                  ? (isImport ? (matchedGate.consignee || matchedGate.company) : (matchedGate.shipper || matchedGate.company))
                  : null
                const companyMismatch = Boolean(
                  matchedGate &&
                  targetCompany &&
                  order.companyName &&
                  typeof companiesMatch === 'function' &&
                  !companiesMatch(order.companyName, targetCompany)
                )

                const isAutoRejected = validation?.status === 'AUTO_REJECTED' || (order.status !== 'APPROVED' && order.status !== 'REJECTED' && companyMismatch)
                const isRejectedOrder = order.status === 'REJECTED' || isAutoRejected

                let fallbackReason = ''
                if (companyMismatch) {
                  fallbackReason = isImport ? 'Sai người nhận hàng' : 'Sai người gửi hàng'
                } else if (!matchedGate && allGates.length > 0 && orderConts.length > 0) {
                  fallbackReason = 'Cont không nằm trong danh sách'
                }

                const rawRejectReason = isRejectedOrder
                  ? (order.rejectionReason || validation?.reason || fallbackReason || 'Sai người nhận hàng')
                  : ''
                const rejectReasonText = !rawRejectReason
                  ? ''
                  : rawRejectReason.toLowerCase().includes('không nằm trong danh sách')
                    ? 'Cont không nằm trong danh sách'
                    : rawRejectReason.toLowerCase().includes('sai mã vận đơn')
                      ? 'Sai mã vận đơn / booking'
                      : (rawRejectReason.toLowerCase().includes('người nhận') || rawRejectReason.toLowerCase().includes('consignee'))
                        ? 'Sai người nhận hàng'
                        : (rawRejectReason.toLowerCase().includes('người gửi') || rawRejectReason.toLowerCase().includes('shipper'))
                          ? 'Sai người gửi hàng'
                          : rawRejectReason.toLowerCase().includes('sai tên công ty')
                            ? 'Sai tên công ty'
                            : rawRejectReason.replace(/^Tự động Reject:\s*/i, '').trim()

                return (
                  <tr
                    key={order.id}
                    onClick={() => onOpenOrder?.(order.id)}
                    className="hover:bg-[#f8faff] transition-colors cursor-pointer group"
                  >
                    {/* 1. Hồ sơ / Dịch vụ */}
                    <td className="py-3.5 px-4 align-middle">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-[#e2e9f1] bg-[#f5f8fc] text-[#8a9eb6]">
                          <FileText size={18} />
                        </span>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <strong className="font-mono text-xs font-semibold text-[#2b425b] group-hover:text-orange-600 transition-colors">
                            {order.number}
                          </strong>
                          <span className="text-xs text-[#526a85] truncate font-medium">
                            {order.mainServiceName || 'Chưa chọn dịch vụ chính'}
                          </span>
                          <small className="text-[11px] text-[#8c9eb2] truncate">
                            {order.companyName || 'Doanh nghiệp đăng ký'}
                          </small>
                        </div>
                      </div>
                    </td>

                    {/* 2. Nguồn / Container */}
                    <td className="py-3.5 px-4 align-middle">
                      <div className="flex flex-col gap-1">
                        <strong className="text-xs font-semibold text-[#405670]">
                          {order.sourceLabel || 'Chưa chọn hồ sơ nguồn'}
                        </strong>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#7d91a6]">
                          <Container size={13} className="shrink-0" />
                          <span>{order.containerCount || 0} container</span>
                          <span>·</span>
                          <span className={order.flow === 'IMPORT' ? 'text-sky-700 font-semibold' : 'text-purple-700 font-semibold'}>
                            {order.flow === 'IMPORT' ? 'Hàng nhập' : 'Hàng xuất'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 3. Trạng thái xử lý */}
                    <td className="py-3.5 px-3.5 align-middle whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <OrderBadge status={isRejectedOrder ? 'REJECTED' : order.status} />
                        {order.paymentStatus && (
                          <small className={`epo-payment-label ${order.paymentReviewRequired ? 'orange' : statusTone(order.paymentStatus)}`}>
                            {paymentStateLabel(order)}
                          </small>
                        )}
                      </div>
                    </td>

                    {/* 4. Lý do từ chối */}
                    <td className="py-3.5 px-3.5 align-middle">
                      {rejectReasonText ? (
                        <span
                          title={rawRejectReason}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold leading-tight whitespace-nowrap shadow-2xs"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                          <span>{rejectReasonText}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* 5. Giá trị đăng ký */}
                    <td className="py-3.5 px-4 align-middle text-right whitespace-nowrap">
                      <div className="flex flex-col items-end gap-0.5">
                        <strong className="text-slate-900 font-bold text-xs">
                          {order.total == null ? 'Chưa xác định' : money(order.total)}
                        </strong>
                        <small className="text-[10px] text-slate-400">
                          {draftDateTime(order.updatedAt)}
                        </small>
                      </div>
                    </td>

                    {/* 6. Thao tác */}
                    <td className="py-3.5 px-4 align-middle text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            let detail = order
                            try {
                              detail = await serviceOrdersApi.get(order.id)
                            } catch { }
                            onOpenReconciliation?.(detail, matchedGate, validation)
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap shadow-xs transition ${isRejectedOrder
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                            : order.status === 'APPROVED'
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-orange-600 hover:bg-orange-700 text-white'
                            }`}
                        >
                          {isRejectedOrder
                            ? 'Xem chi tiết ➔'
                            : order.status === 'APPROVED'
                              ? 'Xem chi tiết ➔'
                              : 'Đối chiếu & Duyệt ➔'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenOrder?.(order.id)}
                          aria-label={`Xem chi tiết đơn ${order.number}`}
                          title="Xem chi tiết đơn"
                          className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:border-orange-300 hover:text-orange-600 text-slate-400 flex items-center justify-center cursor-pointer shrink-0 transition"
                        >
                          <ArrowUpRight size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {eportListTotal > 10 && (
        <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
          <span>Trang {eportListPage} / {Math.max(1, Math.ceil(eportListTotal / 10))} · Tổng {eportListTotal} đơn ePort</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={eportListPage <= 1 || eportListLoading}
              onClick={() => setEportListPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 rounded border border-slate-300 bg-white disabled:opacity-50 cursor-pointer"
            >
              Trước
            </button>
            <button
              type="button"
              disabled={eportListPage >= Math.ceil(eportListTotal / 10) || eportListLoading}
              onClick={() => setEportListPage(p => p + 1)}
              className="px-3 py-1 rounded border border-slate-300 bg-white disabled:opacity-50 cursor-pointer"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
