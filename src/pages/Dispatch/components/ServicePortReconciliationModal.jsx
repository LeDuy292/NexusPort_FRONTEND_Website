import React from 'react'

export default function ServicePortReconciliationModal({
  isOpen,
  booking,
  onClose,
  eportSearchTerm,
  setEportSearchTerm,
  loadEportMatches,
  eportLoading,
  eportError,
  eportOrders = [],
  eportComparison,
  eportValidationMap = {},
  serviceOrdersApi,
  manifestPortSyncService,
  setEportDetail,
  setManifestSyncVersion,
  setSelectedEportOrderId,
  setActiveListType,
  bookingTariffSummary = {},
  orderContainersList = [],
  onReject,
  onConfirmApproval,
}) {
  if (!isOpen || !booking) return null

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[75] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 text-xs font-sans max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">compare_arrows</span>
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-slate-900">
                Đối Chiếu Thống Nhất: Dịch Vụ ePort ↔ Yêu Cầu Lịch Hẹn Cổng
              </h3>
              <p className="text-[11px] text-slate-500">
                Kiểm tra chéo giữa hồ sơ doanh nghiệp đăng ký trên ePort và đơn điều phối cổng của Cảng Tiên Sa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Thanh tìm kiếm đơn ePort để đối chiếu */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            loadEportMatches?.(eportSearchTerm)
          }}
          className="flex flex-col sm:flex-row gap-2 shrink-0"
        >
          <input
            type="text"
            value={eportSearchTerm}
            onChange={(e) => setEportSearchTerm?.(e.target.value)}
            placeholder="Tìm đơn ePort theo số Container, số B/L, Booking hoặc mã đơn SVO..."
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            type="submit"
            disabled={eportLoading}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer disabled:opacity-60"
          >
            {eportLoading ? 'Đang tìm...' : 'Tìm & Đối chiếu'}
          </button>
        </form>

        {eportError && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] shrink-0">
            {eportError}
          </div>
        )}

        {/* Chọn nếu có nhiều đơn ePort khớp */}
        {eportOrders.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <span className="text-[11px] font-semibold text-slate-500">Đơn ePort tìm thấy ({eportOrders.length}):</span>
            {eportOrders.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={async () => {
                  try {
                    const d = await serviceOrdersApi?.get(o.id)
                    manifestPortSyncService?.saveAllOrderFleets(d)
                    setEportDetail?.(d)
                    setManifestSyncVersion?.(v => v + 1)
                  } catch {
                    manifestPortSyncService?.saveAllOrderFleets(o)
                    setEportDetail?.(o)
                    setManifestSyncVersion?.(v => v + 1)
                  }
                }}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition ${eportComparison?.order?.id === o.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
              >
                {o.number}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {eportComparison?.order ? (
            <>
              {/* Tổng kết khớp hay lệch */}
              <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${eportComparison.status === 'matched'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : eportComparison.status === 'partial'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl">
                    {eportComparison.status === 'matched' ? 'check_circle' : eportComparison.status === 'partial' ? 'pending' : 'warning'}
                  </span>
                  <div>
                    <div className="font-bold text-xs">{eportComparison.badgeText}</div>
                    <div className="text-[11px] opacity-85">
                      Mã đơn ePort: <strong className="font-mono">{eportComparison.order.number}</strong> · Dịch vụ: {eportComparison.order.mainServiceName || 'Đăng ký dịch vụ cảng'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEportOrderId?.(eportComparison.order.id)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-[11px] font-bold cursor-pointer shrink-0 inline-flex items-center gap-1"
                >
                  <span>Xem chi tiết đơn ePort</span>
                  <span className="material-symbols-outlined text-sm">visibility</span>
                </button>
              </div>

              {/* Bảng so sánh 2 bên */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wide border-b border-slate-200">
                      <th className="py-2.5 px-3 w-[24%]">Tiêu chí đối chiếu</th>
                      <th className="py-2.5 px-3 w-[32%]">Bên Yêu Cầu Lịch Hẹn Cổng</th>
                      <th className="py-2.5 px-3 w-[32%]">Bên Dịch Vụ ePort</th>
                      <th className="py-2.5 px-3 w-[12%] text-center">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {(eportComparison.checks || []).map((row) => (
                      <tr key={row.label} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-semibold text-slate-600">
                          <div>{row.label}</div>
                          {row.note && (
                            <div className="text-[10px] text-blue-600 font-normal mt-0.5 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block shrink-0"></span>
                              <span>{row.note}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 break-words">
                          {row.useGateTariff ? (bookingTariffSummary?.totalFormatted || row.gateVal) : row.gateVal}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 break-words">{row.eportVal}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${row.ok
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                            {row.ok ? '✓ Khớp' : '⚠ Lệch'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bảng Chi Tiết Từng Container Trong Booking */}
              {eportComparison.containerBreakdown && eportComparison.containerBreakdown.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden mt-3 shadow-2xs">
                  <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                    <span className="font-bold text-[11px] uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-blue-600">inventory_2</span>
                      <span>Danh Sách Container Trong Lô ({eportComparison.containerBreakdown.length} Cont)</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${eportComparison.containerBreakdown.every(c => c.isMatch)
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                      {eportComparison.containerBreakdown.filter(c => c.isMatch).length}/{eportComparison.containerBreakdown.length} Cont Đã Khớp
                    </span>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200">
                        <th className="py-2.5 px-3">Mã Container</th>
                        <th className="py-2.5 px-3">Mã Vận Đơn (B/L)</th>
                        <th className="py-2.5 px-3">Vị Trí Bãi</th>
                        <th className="py-2.5 px-3 text-right">Biểu Phí</th>
                        <th className="py-2.5 px-3 text-center">Đối Chiếu ePort</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {eportComparison.containerBreakdown.map((item, idx) => (
                        <tr key={`${item.containerNumber || 'cont'}-${item.gateBl || ''}-${idx}`} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                            <div>{item.containerNumber}</div>
                            <div className="text-[10px] text-slate-500 font-sans font-normal">
                              {item.containerType} · {item.operation}
                            </div>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700">
                            {item.gateBl || '—'}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700">
                            {item.gateYardSlot || '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                            {(item.fee || 583200).toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${item.isMatch
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}>
                              {item.isMatch ? '✓ Khớp 100%' : '⚠ Lệch'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center space-y-3 bg-slate-50/50">
              <span className="material-symbols-outlined text-4xl text-slate-400">search_off</span>
              <div>
                <h4 className="font-heading text-sm font-bold text-slate-800">
                  Chưa tìm thấy đơn Dịch Vụ ePort nào khớp với Container này
                </h4>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto mt-1">
                  Nhập số Container, số B/L hoặc mã đơn dịch vụ SVO ở ô tìm kiếm bên trên để tìm và liên kết đối chiếu chéo.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => loadEportMatches?.('EMCU1234567')}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1 shadow-xs"
                >
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  <span>Nạp đơn ePort mẫu 2 Cont (EMCU1234567 &amp; EMCU1234568)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose?.()
                    setActiveListType?.('eport')
                  }}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                >
                  <span>Xem tất cả đơn Dịch vụ ePort</span>
                  <span className="material-symbols-outlined text-sm">list_alt</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={() => {
              const targetList = (eportComparison?.matchedGateBookings && eportComparison.matchedGateBookings.length > 0)
                ? eportComparison.matchedGateBookings
                : [booking]
              onReject?.(targetList)
            }}
            className="px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-200 rounded-lg text-xs font-bold cursor-pointer transition inline-flex items-center gap-1 mr-auto shadow-2xs"
            title="Từ chối đơn và nhập lý do từ chối"
          >
            <span className="material-symbols-outlined text-sm">block</span>
            <span>Từ chối</span>
          </button>
          {(() => {
            const isOrderRejected =
              eportComparison?.order?.status === 'REJECTED' ||
              eportValidationMap[eportComparison?.order?.id]?.status === 'AUTO_REJECTED'
            const targetList = (eportComparison?.matchedGateBookings && eportComparison.matchedGateBookings.length > 0)
              ? eportComparison.matchedGateBookings
              : (orderContainersList.length > 0 ? orderContainersList : [booking])
            const orderStatusUpper = String(eportComparison?.order?.status || '').toUpperCase()
            const hasUnapproved =
              booking.status !== 'Approved' ||
              targetList.some(b => b.status !== 'Approved') ||
              (orderContainersList || []).some(b => b.status !== 'Approved') ||
              (Boolean(eportComparison?.order) && !['APPROVED', 'REJECTED', 'CANCELLED'].includes(orderStatusUpper))
            if (!hasUnapproved) return null
            const canAccept = eportComparison?.status === 'matched' && !isOrderRejected && !booking._noGateBooking
            return (
              <button
                type="button"
                disabled={!canAccept}
                title={canAccept ? '' : 'Không thể duyệt khi dữ liệu 2 bên chưa khớp hoặc đơn ePort đã bị từ chối'}
                onClick={() => {
                  if (!canAccept) return
                  onConfirmApproval?.(targetList)
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 ${canAccept
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
              >
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span>
                  {targetList.length > 1
                    ? `Duyệt cả ${targetList.length} Cont & Gửi 1 Bill Tổng ➔`
                    : 'Duyệt & Gửi Bill sang Vận tải ➔'}
                </span>
              </button>
            )
          })()}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-black transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
