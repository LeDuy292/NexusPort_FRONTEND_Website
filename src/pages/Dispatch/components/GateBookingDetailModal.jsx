import React from 'react'
import { Container, FileText } from 'lucide-react'

export default function GateBookingDetailModal({
  isOpen,
  booking,
  onClose,
  isImportBooking,
  isBookingTransportSubmitted,
  stripTrailingDigits,
  getGateBookingVehicle,
  getGateBookingDriver,
  getBookingRealDocuments,
  manifestPortSyncService,
  reservedSlot,
  selectedManifestInfo,
  eportComparison,
  eportLoading,
  orderStatusLabels = {},
  paymentStateLabel,
  bookingTariffSummary = {},
  totalBillFormatted,
  orderContainersList = [],
  onOpenCarrier,
  onOpenContainerPopup,
  onOpenVehicle,
  onOpenYardPicker,
  onOpenDocuments,
  onOpenEportSync,
  onOpenEportOrder,
  onOpenTariff,
}) {
  if (!isOpen || !booking) return null

  return (
    <div className="fixed inset-0 z-[85] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white border border-[#e3eaf3] rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-xs">
        {/* 1. Header chuẩn ePort */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#edf1f6] bg-[#fafcfe] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`epo-order-icon ${isImportBooking ? 'epo-order-icon--import' : 'epo-order-icon--export'}`}>
              <Container size={19} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] text-[#7a8fa6] flex-wrap">
                <span className="font-semibold text-[#5a7088]">Chi Tiết Container</span>
                <span>·</span>
                <span className="font-mono font-bold text-blue-700">{booking.containerId}</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">Mã Booking:</span>
                <span className="font-mono font-semibold text-slate-700">{stripTrailingDigits ? stripTrailingDigits(booking.id) : booking.id}</span>
              </div>
              <h3 className="text-base font-bold text-[#1e2d3d] mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="font-mono">{booking.containerId}</span>
                <span className="text-xs font-medium text-[#627891]">
                  ({booking.containerType || `${booking.size || '40'}${booking.isReefer ? 'RF' : 'HC'}`} · {isImportBooking ? 'Lấy cont hàng' : 'Hạ cont'})
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs font-semibold text-slate-700">{booking.company || 'Bien Dong Logistics'}</span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {booking.isFromVesselManifest && isBookingTransportSubmitted && !isBookingTransportSubmitted(booking) ? (
              <span className="epo-badge orange">
                <span />
                Chờ vận tải
              </span>
            ) : booking.status === 'Approved' || booking.status === 'Ready' ? (
              <span className="epo-badge green">
                <span />
                Đã duyệt
              </span>
            ) : booking.status === 'Rejected' ? (
              <span className="epo-badge red">
                <span />
                Đã từ chối
              </span>
            ) : (
              <span className="epo-badge blue">
                <span />
                {booking.status === 'Pending'
                  ? 'Chờ duyệt'
                  : booking.status === 'Under Review'
                    ? 'Đang kiểm tra'
                    : 'Vận tải đã gửi · Chờ duyệt'}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-[#e3eaf3] text-[#7a8fa6] hover:text-[#1e2d3d] hover:bg-[#f3f6fa] flex items-center justify-center text-lg leading-none cursor-pointer transition"
              aria-label="Đóng"
            >
              &times;
            </button>
          </div>
        </div>

        {/* 2. Body 2 cột chuẩn epo-detail-layout */}
        <div className="p-6 overflow-y-auto flex-1">
          {booking.status === 'Rejected' && (
            <div className="mb-4 p-3 rounded-xl bg-[#fcf3f2] border border-[#eddbd8] text-[#ad7a73] flex items-start gap-2">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              <div className="text-[11px]">
                <strong className="font-bold">Đơn đã bị từ chối:</strong>{' '}
                {booking.rejectionReason || 'Không đạt yêu cầu'}
                {booking.rejectionNote && ` — "${booking.rejectionNote}"`}
              </div>
            </div>
          )}

          <div className="epo-detail-layout !p-0">
            {/* Cột trái: Thông tin hồ sơ */}
            <section className="epo-detail-content space-y-4">
              {/* Khối 1: Vận tải & Tàu / B/L */}
              <div className="border border-[#e6ecf3] rounded-xl p-4 bg-[#fafcfe]">
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#edf1f6]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#7a8fa6]">
                    Thông tin vận tải &amp; lô hàng
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onOpenCarrier}
                      className="text-[11px] font-semibold text-[#5a7088] hover:text-orange-600 cursor-pointer"
                    >
                      Công ty vận tải ➔
                    </button>
                    <button
                      type="button"
                      onClick={onOpenContainerPopup}
                      className="text-[11px] font-semibold text-[#5a7088] hover:text-orange-600 cursor-pointer"
                    >
                      Chi tiết cont ➔
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-[12px]">
                  <div>
                    <div className="text-[11px] text-[#8a9bb0]">Công ty vận tải</div>
                    <div className="font-semibold text-[#1e2d3d] mt-0.5 truncate" title={booking.company}>
                      {booking.company || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8a9bb0]">Điều phối &amp; liên hệ</div>
                    <div className="font-medium text-[#334155] mt-0.5">
                      {booking.isFromVesselManifest && isBookingTransportSubmitted && !isBookingTransportSubmitted(booking) && booking.status !== 'Approved'
                        ? 'Chờ bên vận tải gửi xác nhận'
                        : `${booking.contactName || booking.contactPerson || 'Võ Hàng Tàu'} · ${booking.phone || '0842737474'}`}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8a9bb0]">Tàu / Chuyến</div>
                    <div className="font-medium text-[#334155] mt-0.5">
                      {booking.vesselName || 'MAERSK MC-KINNEY MOLLER'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8a9bb0]">Số vận đơn (B/L) · VGM</div>
                    <div className="font-mono font-medium text-[#334155] mt-0.5">
                      {booking.billOfLading || (booking.cargoDeclarationId && booking.cargoDeclarationId !== 'N/A' ? booking.cargoDeclarationId : '') || selectedManifestInfo?.blNumber || 'BL-INB-DAD-2605'}
                      {' · '}
                      {booking.vgm ? `${booking.vgm} kg` : (booking.grossWeightKg ? `${booking.grossWeightKg.toLocaleString()} kg` : '19.800 kg')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Khối 2: Điều phối cổng & vị trí bãi */}
              <div className="border border-[#e6ecf3] rounded-xl p-4 bg-white">
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#edf1f6]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#7a8fa6]">
                      Điều phối cổng &amp; vị trí bãi
                    </span>
                    <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Cont {booking.containerId}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onOpenVehicle}
                      className="text-[11px] font-semibold text-[#5a7088] hover:text-orange-600 cursor-pointer"
                    >
                      Xe &amp; tài xế ➔
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const targetZone = reservedSlot?.zoneCode || (reservedSlot?.blockCode || 'D')[0]
                        onOpenYardPicker?.(targetZone)
                      }}
                      className="text-[11px] font-semibold text-[#5a7088] hover:text-orange-600 cursor-pointer"
                    >
                      Đổi bãi ➔
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-[12px]">
                  <div>
                    <div className="text-[11px] text-[#8a9bb0]">Biển số xe · Tài xế phụ trách</div>
                    <div className="font-medium text-[#1e2d3d] mt-0.5">
                      {(() => {
                        const vPlate = getGateBookingVehicle ? getGateBookingVehicle(booking) : booking.licensePlate
                        const dName = getGateBookingDriver ? getGateBookingDriver(booking) : booking.driverName
                        const cId = String(booking.containerId || '').trim().toUpperCase()
                        const orderFleetInfo = manifestPortSyncService?.getOrderFleet ? manifestPortSyncService.getOrderFleet(cId) : null
                        const phone = booking.phone || orderFleetInfo?.phone || ''
                        if (vPlate) {
                          return (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">{vPlate}</span>
                              <span className="text-slate-400">·</span>
                              <span className="font-bold text-slate-800">{dName || 'Tài xế theo xe'}</span>
                              {phone && <span className="text-slate-500 text-[11px]">({phone})</span>}
                            </div>
                          )
                        }
                        return (
                          <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium inline-flex items-center gap-1">
                            <span>⏳</span>
                            <span>Chờ bên vận tải điều phối xe &amp; tài xế</span>
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8a9bb0]">Cổng · Giờ dự kiến (ETA)</div>
                    <div className="font-mono font-medium text-[#334155] mt-0.5">
                      {(booking.requestedGate || 'Gate 1').replace(/^Gate\s*/i, 'Cổng ')} · {booking.eta ? booking.eta.replace('T', ' ').slice(0, 16) : 'Hôm nay 08:30'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8a9bb0]">Vị trí bãi Tiên Sa</div>
                    <div className="font-mono font-semibold text-[#1e2d3d] mt-0.5">
                      {(() => {
                        const slot = reservedSlot || booking?.autoYardSlot || booking?.reservedSlot
                        if (slot?.blockCode && slot?.bay) {
                          const bStr = String(slot.bay).padStart(2, '0')
                          const rStr = slot.row ? String(slot.row).padStart(2, '0') : '01'
                          const tStr = slot.tier || '1'
                          return `Block ${slot.blockCode} · Bay ${bStr} · Tầng ${tStr} · Hàng ${rStr}`
                        }
                        if (booking?.yardSlot) {
                          const parsed = manifestPortSyncService?.parseSlotCoordinate ? manifestPortSyncService.parseSlotCoordinate(booking.yardSlot) : null
                          if (parsed) {
                            return `Block ${parsed.blockCode} · Bay ${String(parsed.bay).padStart(2, '0')} · Tầng ${parsed.tier} · Hàng ${String(parsed.row).padStart(2, '0')}`
                          }
                          return booking.yardSlot
                        }
                        return 'Block D01 · Bay 02 · Tầng 1 · Hàng 01'
                      })()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#8a9bb0]">Chứng từ đính kèm</div>
                    {(() => {
                      const realDocs = getBookingRealDocuments ? getBookingRealDocuments(booking) : []
                      const orderDocsCount = realDocs.filter(d => !d.isDriverDoc).length
                      const fleetDocsCount = realDocs.filter(d => d.isDriverDoc).length
                      return (
                        <button
                          type="button"
                          onClick={onOpenDocuments}
                          className="mt-0.5 text-[12px] font-semibold text-[#2e78a8] hover:underline cursor-pointer text-left"
                        >
                          {realDocs.length > 0
                            ? `${realDocs.length} tệp hồ sơ (${orderDocsCount} chứng từ ePort · ${fleetDocsCount} xe & tài xế) ➔`
                            : 'Chưa có chứng từ (Chờ đơn ePort) ➔'}
                        </button>
                      )
                    })()}
                  </div>
                </div>
              </div>

              {/* Khối 3: Đối chiếu ePort */}
              <div className="border border-[#e6ecf3] rounded-xl px-4 py-3 bg-[#fafcfe] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-[#5a7088]">
                    Đối chiếu Dịch Vụ ePort:{' '}
                    <span className={
                      eportComparison?.status === 'matched'
                        ? 'text-emerald-700'
                        : eportComparison?.status === 'mismatch'
                          ? 'text-rose-700'
                          : 'text-[#627891]'
                    }>
                      {eportLoading ? 'Đang kiểm tra...' : (eportComparison?.badgeText || 'Chưa có đơn ePort khớp')}
                    </span>
                  </div>
                  {eportComparison?.order && (
                    <div className="text-[11px] text-[#7a8fa6] mt-0.5 truncate">
                      Đơn <span className="font-mono text-[#334155]">{eportComparison.order.number}</span> · {orderStatusLabels[eportComparison.order.status] || eportComparison.order.status} · {paymentStateLabel ? paymentStateLabel(eportComparison.order) : ''}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={onOpenEportSync}
                    className="epc-button secondary !min-h-[32px] !py-1 !px-3 !text-[11px]"
                  >
                    Đối chiếu 2 bên
                  </button>
                  {eportComparison?.order && (
                    <button
                      type="button"
                      onClick={() => onOpenEportOrder?.(eportComparison.order.id)}
                      className="epc-button secondary !min-h-[32px] !py-1 !px-3 !text-[11px]"
                    >
                      Xem đơn ePort
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Cột phải: Sidebar tóm tắt & biểu phí */}
            <aside className="epo-order-sidebar">
              <div className="epo-sidebar-heading">
                <span>
                  <FileText size={20} />
                </span>
                <div>
                  <small>HỒ SƠ ĐĂNG KÝ</small>
                  <h3>Chi tiết Booking</h3>
                </div>
              </div>

              <div className="epo-sidebar-total">
                <small>Tổng biểu phí cảng</small>
                <strong>{bookingTariffSummary?.totalFormatted || '583.200 VNĐ'}</strong>
                {orderContainersList.length > 1 && (
                  <div className="text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-200 flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Tổng 1 Bill ({orderContainersList.length} Cont)</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">{totalBillFormatted}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={onOpenTariff}
                  className="text-[11px] text-[#2e78a8] hover:underline font-medium mt-1.5 cursor-pointer text-left block"
                >
                  Xem bảng kê chi tiết ➔
                </button>
              </div>

              <dl>
                <div>
                  <dt>Đang xem cont</dt>
                  <dd className="font-mono font-bold text-blue-700">{booking.containerId}</dd>
                </div>
                <div>
                  <dt>Xe &amp; Tài xế</dt>
                  <dd className="font-mono text-slate-800 font-semibold">
                    {getGateBookingVehicle && getGateBookingVehicle(booking)
                      ? `${getGateBookingVehicle(booking)} · ${getGateBookingDriver(booking) || 'Tài xế theo xe'}`
                      : <span className="text-amber-700 font-normal italic">Chờ điều phối xe</span>}
                  </dd>
                </div>
                <div>
                  <dt>Vị trí</dt>
                  <dd className="font-mono">{reservedSlot?.posId || 'D01-B02-R1-T1'}</dd>
                </div>
                <div>
                  <dt>Quy mô lô</dt>
                  <dd className="font-bold text-slate-800">{orderContainersList.length > 1 ? `${orderContainersList.length} Container (1 Bill)` : '1 Container'}</dd>
                </div>
                <div>
                  <dt>Chứng từ</dt>
                  <dd>{getBookingRealDocuments ? getBookingRealDocuments(booking).length : 0} tệp</dd>
                </div>
              </dl>

              <div className="epo-sidebar-actions">
                <button
                  type="button"
                  onClick={onClose}
                  className="epc-button secondary"
                >
                  Đóng
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
