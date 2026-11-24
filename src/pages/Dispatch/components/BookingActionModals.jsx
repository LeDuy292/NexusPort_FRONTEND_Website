import React, { useState, useMemo } from 'react'
import TienSaMap from '../../../features/yard-design/TienSaMap'
import '../../../features/yard-design/TienSaMap.css'
import tienSaLayout from '../../../features/yard-design/tienSaLayout.json'
import Select from '../../../components/ui/Select'

/**
 * Phê duyệt Lịch hẹn xe vào cảng
 */
export function BookingApproveModal({
  isOpen,
  booking,
  batchList = [],
  orderContainersList = [],
  totalBillFormatted,
  bookingTariffSummary = {},
  isImportBooking,
  selectedManifestInfo,
  getGateBookingVehicle,
  getGateBookingDriver,
  onClose,
  onConfirm,
}) {
  if (!isOpen || !booking) return null

  const approveTargets = (batchList && batchList.length > 0)
    ? batchList
    : (orderContainersList && orderContainersList.length > 0 ? orderContainersList : [booking])
  const isMulti = approveTargets.length > 1
  const billTotalDisplay = isMulti ? totalBillFormatted : (bookingTariffSummary.totalFormatted || '583.200 VNĐ')

  return (
    <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-[95] flex items-center justify-center p-4">
      <div className={`bg-white rounded-3xl p-6 md:p-8 ${isMulti ? 'max-w-2xl' : 'max-w-md'} w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 font-sans max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-chalk pb-3">
          <span className="material-symbols-outlined text-green-600 text-3xl shrink-0">task_alt</span>
          <div>
            <div className="text-[11px] font-mono font-bold text-blue-700">
              Lịch Hẹn Cổng · {booking.id}
            </div>
            <h3 className="font-heading text-lg font-extrabold text-carbon mt-0.5">
              {booking.containerId} <span className="text-sm font-semibold text-slate-500">({booking.containerType || '20GP'} · {isImportBooking ? 'Lấy cont hàng' : 'Hạ cont'})</span>
            </h3>
            <p className="text-xs text-slate mt-0.5">
              {isMulti
                ? `Phê duyệt toàn bộ ${approveTargets.length} container trong Booking & Gửi 1 Bill Tổng (${billTotalDisplay}) sang Đơn vị Vận tải.`
                : 'Xác nhận phê duyệt lịch hẹn xe vào cảng.'}
            </p>
          </div>
        </div>

        {/* Thông tin đơn / Booking chung */}
        <div className="bg-fog p-3.5 rounded-2xl border border-chalk space-y-2 text-xs">
          <div className="flex flex-wrap justify-between items-center gap-1 font-mono">
            <span className="text-slate-500 font-sans">Mã Booking:</span>
            <strong className="text-carbon font-bold">{booking.id}</strong>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-sans">Tàu / Chuyến:</span>
            <span className="font-semibold text-slate-800">{booking.vesselName || 'MAERSK MC-KINNEY MOLLER'} ({booking.voyageNumber || 'MM-2601S'})</span>
          </div>
          <div className="flex flex-wrap justify-between items-center gap-1 text-[11px] pt-1 border-t border-slate-200/60">
            <span className="text-slate-500">Đơn vị vận tải:</span>
            <strong className="text-slate-800 font-semibold">{booking.company || 'Bien Dong Logistics'}</strong>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Cổng dự kiến:</span>
            <strong className="text-orange-600 font-bold font-mono">{(booking.requestedGate || 'Gate 1').replace(/^Gate\s*/i, 'Cổng ')} · 08:30</strong>
          </div>
        </div>

        {/* Danh sách từng container kèm xe, tài xế & vị trí bãi */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
          <div className="bg-slate-100/90 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-700">
            <span className="flex items-center gap-1.5 uppercase tracking-wide">
              <span className="material-symbols-outlined text-[16px] text-blue-600">inventory_2</span>
              Danh sách {approveTargets.length} Container &amp; Xe phụ trách
            </span>
            <span className="text-emerald-700 font-semibold">
              ✓ Đã đối chiếu ePort &amp; Manifest
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {approveTargets.map((c, idx) => (
              <div key={`${c.containerId || 'c'}-${c.id || ''}-${idx}`} className="p-3 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-slate-900 text-xs">
                      {c.containerId}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-200 font-semibold">
                      {c.containerType || '20GP'}
                    </span>
                    {c.isReefer && (
                      <span className="text-[9px] px-1 rounded bg-cyan-100 text-cyan-800 border border-cyan-200 font-semibold">
                        Lạnh
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-500">
                      B/L: {c.billOfLading || c.cargoDeclarationId || 'BL-INB-DAD-2601'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-emerald-700 text-xs">
                      {(c.fee || 583200).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">Xe &amp; TX:</span>
                    <strong className="font-mono text-slate-800">{c.licensePlate || (getGateBookingVehicle && getGateBookingVehicle(c)) || '47K1-137.87'}</strong>
                    <span className="text-slate-400">·</span>
                    <span className="font-semibold text-slate-800">{c.driverName || (getGateBookingDriver && getGateBookingDriver(c)) || 'Võ Hãng Tàu'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">Vị trí bãi:</span>
                    <span className="font-mono font-semibold text-slate-800">{c.yardSlot || 'Block D01 · Bay 02'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Box Tổng 1 Bill duy nhất */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-400/80 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-emerald-700">receipt_long</span>
              TỔNG BIỂU PHÍ CẢNG (1 BILL TỔNG · {approveTargets.length} CONTAINER)
            </div>
            <div className="text-[11px] text-emerald-700 mt-0.5">
              Toàn bộ cước THC, phí nâng hạ bãi Tiên Sa và phí cont lạnh được gom thành 1 Bill duy nhất.
            </div>
          </div>
          <div className="text-right shrink-0 pl-3">
            <div className="font-mono text-2xl font-black text-emerald-800 tracking-tight">
              {billTotalDisplay}
            </div>
          </div>
        </div>

        {/* Thông tin đối soát Manifest */}
        <div className="text-xs text-emerald-950 bg-emerald-50 p-2.5 rounded-xl border border-emerald-300 font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-600 text-base shrink-0">verified</span>
          <span>
            Đã đối chiếu khớp với <strong>Bản khai hàng hóa {selectedManifestInfo?.manifestNumber || 'MNF-2026-003'}</strong> do Hãng tàu gửi sang Cảng. Đủ điều kiện cấp phép vào cổng.
          </span>
        </div>

        <p className="text-xs text-blue-900 bg-blue-50 p-2.5 rounded-xl border border-blue-200 font-medium">
          ℹ️ "Toàn bộ {approveTargets.length} container trong Booking sẽ được chuyển sang Cổng kiểm soát (Gate Officer) để làm thủ tục Check-in, đồng thời gửi 1 Bill Tổng ({billTotalDisplay}) sang Đơn vị Vận tải."
        </p>

        {/* Nút thao tác */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-fog border border-chalk text-slate font-bold rounded-xl text-xs hover:bg-slate-200 cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={() => onConfirm?.(approveTargets)}
            className="px-6 py-2.5 bg-green-600 text-white font-extrabold rounded-xl text-xs hover:bg-green-700 shadow-md inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>
            <span>Xác nhận Duyệt &amp; Gửi 1 Bill Tổng ({billTotalDisplay}) ➔</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Từ chối Lịch hẹn cổng
 */
export function BookingRejectModal({
  isOpen,
  onClose,
  onConfirm,
  rejectionReason,
  setRejectionReason,
  rejectionNote,
  setRejectionNote,
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-[95] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 font-sans">
        <div className="flex items-center gap-3 border-b border-chalk pb-3">
          <span className="material-symbols-outlined text-red-600 text-3xl">block</span>
          <div>
            <h3 className="font-heading text-xl font-extrabold text-carbon">TỪ CHỐI ĐĂNG KÝ VÀO CỔNG</h3>
            <p className="text-xs text-slate">Chọn lý do từ chối đăng ký lịch hẹn cảng.</p>
          </div>
        </div>

        <div className="space-y-3 text-xs font-bold">
          <div>
            <label className="block text-slate uppercase text-[10px] mb-1">Lý do từ chối *</label>
            <Select
              value={rejectionReason}
              onChange={e => setRejectionReason?.(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-red-500 font-bold"
            >
              <option value="">-- Chọn lý do từ chối --</option>
              <option value="Sai lệch thông tin ePort và Cổng">Sai lệch thông tin giữa ePort và Cổng cảng (Mã Booking/B/L/Cont)</option>
              <option value="Chưa hoàn tất thanh toán phí">Chưa hoàn tất thanh toán biểu phí cảng</option>
              <option value="Mã container sai quy chuẩn">Mã container sai quy chuẩn / Không đúng thực tế</option>
              <option value="Xe hoặc tài xế không hợp lệ">Xe không hợp lệ / Hết hạn kiểm định hoặc tài xế thiếu bằng</option>
              <option value="Chưa duyệt bản khai hàng hóa">Chưa duyệt khai báo hàng hóa / Manifest</option>
              <option value="Cổng quá tải hoặc sai khung giờ">Cổng yêu cầu đã đầy dung lượng / Sai khung giờ hẹn</option>
              <option value="Lý do khác">Lý do khác</option>
            </Select>
          </div>

          <div>
            <label className="block text-slate uppercase text-[10px] mb-1">Ghi chú chi tiết (Optional)</label>
            <textarea
              rows="3"
              value={rejectionNote}
              onChange={e => setRejectionNote?.(e.target.value)}
              placeholder="Nhập ghi chú giải thích lý do cho Hãng xe..."
              className="w-full p-3 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-red-500"
            ></textarea>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-fog border border-chalk text-slate font-bold rounded-xl text-xs hover:bg-slate-200 cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={!rejectionReason}
            onClick={() => onConfirm?.()}
            className={`px-6 py-2.5 rounded-xl font-extrabold text-xs shadow-md cursor-pointer ${rejectionReason ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
          >
            Xác nhận Từ chối
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Xem danh sách hồ sơ chứng từ container
 */
export function BookingDocumentsModal({
  isOpen,
  booking,
  onClose,
  getBookingRealDocuments,
  getDocTypeVi,
  onOpenViewer,
}) {
  if (!isOpen || !booking) return null

  const docList = getBookingRealDocuments ? getBookingRealDocuments(booking) : []
  const orderDocs = docList.filter(d => !d.isDriverDoc)
  const fleetDocs = docList.filter(d => d.isDriverDoc)

  const renderDocRow = (doc) => {
    const viewerIdx = docList.indexOf(doc)
    const hasFileUrl = Boolean(doc.fileUrl || doc.fileReference)
    return (
      <div
        key={doc.id || viewerIdx}
        className="bg-white border border-blue-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs hover:border-blue-300 transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`material-symbols-outlined text-2xl shrink-0 ${doc.isDriverDoc ? 'text-indigo-600' : 'text-blue-600'}`}>
            {doc.icon || 'description'}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-900">
                {doc.title || (getDocTypeVi ? getDocTypeVi(doc.documentType || doc.type) : doc.type)}
              </span>
              {doc.isDriverDoc && (
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-bold">
                  Hồ sơ Tài xế &amp; Xe
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
              {doc.scope && <span>{doc.scope}</span>}
              {doc.fileName && (
                <span className="text-slate-400 font-mono truncate max-w-[260px]" title={doc.fileName}>
                  · {doc.fileName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border ${(doc.verificationStatus || doc.status) === 'Verified'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : (doc.verificationStatus || doc.status) === 'Rejected'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
            <span>{(doc.verificationStatus || doc.status) === 'Verified' ? '✓' : '⏳'}</span>
            <span>{(doc.verificationStatus || doc.status) === 'Verified' ? 'Đã xác thực' : 'Chờ duyệt'}</span>
          </span>

          {hasFileUrl ? (
            <button
              type="button"
              onClick={() => onOpenViewer?.(viewerIdx >= 0 ? viewerIdx : 0)}
              className="px-3 py-1.5 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              <span>Xem tệp</span>
            </button>
          ) : (
            <span className="px-2.5 py-1 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-[11px] font-medium">
              Chưa có ảnh
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[95] flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 text-xs font-sans max-h-[90vh] overflow-y-auto">
        {/* Header Popup */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">folder_shared</span>
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-slate-900">Chi Tiết Bộ Chứng Từ Hồ Sơ</h3>
              <p className="text-[11px] text-slate-500">
                Mã Booking: <strong className="font-mono text-slate-800">{booking.id}</strong> • Container: <strong className="font-mono text-blue-700">{booking.containerId}</strong> • Tàu: {booking.vesselName || 'EVER GLORY'}
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

        {docList.length === 0 ? (
          <div className="p-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 text-center space-y-1.5">
            <span className="material-symbols-outlined text-2xl text-amber-600">folder_off</span>
            <div className="font-bold text-amber-900 text-xs">Chưa có chứng từ hồ sơ từ đơn Dịch vụ ePort</div>
            <p className="text-[11px] text-amber-800">
              Container này hiện chưa có đơn Dịch vụ ePort hợp lệ gửi đến Cảng (hoặc các đơn ePort liên quan đã bị từ chối).
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orderDocs.length > 0 && (
              <div className="bg-blue-50/40 border border-blue-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 text-xl">folder_open</span>
                    <h4 className="text-xs font-black uppercase tracking-wide text-slate-800">
                      Bộ hồ sơ chứng từ nộp Dispatcher ({orderDocs.length} TỆP)
                    </h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px] self-start sm:self-auto">
                    Đồng bộ từ đơn Dịch vụ ePort
                  </span>
                </div>
                <div className="space-y-2">
                  {orderDocs.map(renderDocRow)}
                </div>
              </div>
            )}

            {fleetDocs.length > 0 && (
              <div className="bg-indigo-50/40 border border-indigo-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-600 text-xl">badge</span>
                    <h4 className="text-xs font-black uppercase tracking-wide text-slate-800">
                      Hồ sơ pháp lý Xe &amp; Tài xế ({fleetDocs.length} GIẤY TỜ)
                    </h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 font-bold text-[11px] self-start sm:self-auto">
                    Cont {booking.containerId}
                  </span>
                </div>
                <div className="space-y-2">
                  {fleetDocs.map(renderDocRow)}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
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

/**
 * Xem thông tin phương tiện & tài xế
 */
export function BookingVehicleModal({
  isOpen,
  booking,
  onClose,
  getGateBookingVehicle,
  getGateBookingDriver,
  reservedSlot,
}) {
  if (!isOpen || !booking) return null

  const activePlate = getGateBookingVehicle ? getGateBookingVehicle(booking) : booking.licensePlate
  const activeDriver = getGateBookingDriver ? getGateBookingDriver(booking) : booking.driverName
  const activeTrailer = booking.trailerPlate || booking.suggestedTrailer || (activePlate ? '47R-012.88' : null)
  const activeLicense = booking.licenseNumber || booking.suggestedLicense || (activePlate ? 'FC-782910' : null)

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[95] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 text-xs font-sans">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-700 text-xl">local_shipping</span>
            <h3 className="font-heading text-sm font-bold text-slate-900">Chi Tiết Phương Tiện &amp; Tài Xế</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {!activePlate ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-amber-600 text-lg shrink-0">hourglass_top</span>
            <div>
              <strong className="font-bold">Đang chờ đơn vị vận tải điều phối xe &amp; tài xế</strong>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Container đã có vị trí bãi. Thông tin biển số xe đầu kéo, rơ-moóc và tài xế sẽ tự động cập nhật ngay khi đơn vị vận tải tiếp nhận &amp; phân bổ xe.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-emerald-600 text-lg shrink-0">task_alt</span>
            <div>
              <strong className="font-bold text-emerald-900">Đã phân bổ xe đầu kéo &amp; tài xế phụ trách</strong>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Đội xe {booking.company || 'Vận tải'} đã tiếp nhận lệnh vận chuyển. Phương tiện và tài xế đạt chuẩn kiểm định an toàn vào Cảng Tiên Sa.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2.5 font-medium divide-y divide-slate-100">
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Biển số đầu kéo:</span>
            {activePlate ? (
              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {activePlate}
              </span>
            ) : (
              <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Chờ điều phối xe
              </span>
            )}
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Biển số Rơ-moóc:</span>
            <span className="font-mono font-bold text-slate-800">
              {activeTrailer || 'Chờ phân bổ'}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Hạn đăng kiểm xe:</span>
            <span className={activePlate ? "text-emerald-700 font-semibold" : "text-slate-500 italic"}>
              {activePlate ? "Còn hạn (Hết hạn 12/2026)" : "Chờ thông tin xe"}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Họ tên tài xế:</span>
            <strong className="text-slate-900">
              {activeDriver || 'Chờ điều phối tài xế'}
            </strong>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Số GPLX:</span>
            <span className="font-mono font-bold text-slate-800">
              {activeLicense ? `${activeLicense} (Hạng FC)` : 'Chờ cập nhật'}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Số điện thoại liên hệ:</span>
            <span className="font-mono text-slate-800">{booking.phone || '0905 123 456'} (Điều phối {booking.company})</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Giờ hẹn đến cổng (ETA):</span>
            <span className="font-mono text-orange-700 font-bold">
              {booking.eta ? booking.eta.replace('T', ' · ').slice(0, 18) : (activePlate ? 'Hôm nay · 08:30' : 'Chờ lịch hẹn')}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Cổng đăng ký vào:</span>
            <span className="font-bold text-slate-900">{booking.requestedGate || 'Gate 1 (Cổng Cảng Tiên Sa)'}</span>
          </div>
          <div className="flex justify-between py-1.5 border-t border-slate-100">
            <span className="text-slate-500 font-bold">Vị trí bãi chỉ định cho tài xế:</span>
            <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              {booking.yardSlot || (reservedSlot ? `Block ${reservedSlot.blockCode} · ${reservedSlot.bayDisplay || `Bay ${String(reservedSlot.bay || '02').padStart(2, '0')}`} (${reservedSlot.row}-${reservedSlot.tier})` : 'Block D01 · Bay 02 (1-1)')}
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
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

/**
 * Xem chi tiết doanh nghiệp vận tải
 */
export function BookingCarrierModal({
  isOpen,
  booking,
  onClose,
  isImportBooking,
  isBookingTransportSubmitted,
  getGateBookingVehicle,
}) {
  if (!isOpen || !booking) return null

  const isTransportWait = booking.isFromVesselManifest && isBookingTransportSubmitted && !isBookingTransportSubmitted(booking) && booking.status !== 'Approved'

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[95] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 text-xs font-sans">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-600 text-xl">domain</span>
            <h3 className="font-heading text-sm font-bold text-slate-900">Chi Tiết Công Ty Vận Tải</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {isTransportWait ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-amber-600 text-lg shrink-0">hourglass_top</span>
            <div>
              <strong className="font-bold">Chờ Công ty Vận tải gửi thông tin xác nhận</strong>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Container được đồng bộ từ Bản khai Tàu (Manifest). Các trường liên hệ và xác nhận điều phối được để trống để bên Công ty Vận tải gửi thông tin lên Cảng xác nhận.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-emerald-600 text-lg shrink-0">verified</span>
            <div>
              <strong className="font-bold">Đơn vị vận tải đã gửi &amp; xác nhận điều phối</strong>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Công ty vận tải đã gửi thông tin điều phối và hồ sơ làm thủ tục cổng cho container này lên hệ thống Cảng Tiên Sa.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2.5 font-medium divide-y divide-slate-100">
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Tên công ty vận tải:</span>
            <strong className="text-slate-900 font-bold">
              {isTransportWait ? (booking.company ? `${booking.company} (Chờ gửi xác nhận)` : '—') : (booking.company || 'Bien Dong Logistics')}
            </strong>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Mã doanh nghiệp (MST):</span>
            <span className="font-mono font-bold text-slate-800">
              {isTransportWait ? '—' : (booking.taxCode || '0401889211')}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Người điều phối phụ trách:</span>
            <strong className="text-slate-900">
              {isTransportWait ? '—' : (booking.contactName || booking.contactPerson || 'Võ Hàng Tàu (Điều độ Đội xe)')}
            </strong>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Số điện thoại liên hệ:</span>
            <span className="font-mono font-bold text-slate-800">
              {isTransportWait ? '—' : (booking.phone || '0842737474')}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Email điều phối:</span>
            <span className="font-mono text-slate-700">
              {isTransportWait ? '—' : (booking.email || 'carrier01@nexusport.vn')}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Nghiệp vụ đăng ký:</span>
            <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200 font-bold text-[11px]">
              {isImportBooking ? 'Lấy container hàng (Inbound)' : 'Hạ container rỗng (Outbound)'}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Tình trạng xác nhận vận tải:</span>
            {isTransportWait ? (
              <span className="text-amber-700 font-semibold flex items-center gap-1">
                <span>⏳</span>
                <span>Chờ bên vận tải gửi xác nhận</span>
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <span>✓</span>
                <span>Đã gửi thông tin điều phối</span>
              </span>
            )}
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Đội xe liên kết tại cảng:</span>
            <span className="font-mono font-bold text-slate-800">
              {(() => {
                const vPlate = getGateBookingVehicle ? getGateBookingVehicle(booking) : booking.licensePlate
                return vPlate ? `Đã gán xe ${vPlate}` : 'Đã đăng ký đội xe SmartGate'
              })()}
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
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

/**
 * Xem chi tiết Container & Tàu biển
 */
export function BookingVesselModal({
  isOpen,
  booking,
  onClose,
  selectedManifestInfo,
}) {
  if (!isOpen || !booking) return null

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[95] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 text-xs font-sans">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-xl">directions_boat</span>
            <h3 className="font-heading text-sm font-bold text-slate-900">Chi Tiết Container &amp; Tàu Biển</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-2.5">
          <span className="material-symbols-outlined text-blue-600 text-lg shrink-0">inventory_2</span>
          <div>
            <strong className="font-bold">Container thuộc Bản khai Tàu (Vessel Manifest)</strong>
            <p className="text-[11px] text-blue-700 mt-0.5">
              Thông tin container, niêm chì và vận đơn đường biển đã được số hóa và đồng bộ từ Tàu {booking.vesselName || 'EVER GLORY'} ({booking.voyageNumber || booking.voyageNo || 'V.2024N'}).
            </p>
          </div>
        </div>

        <div className="space-y-2.5 font-medium divide-y divide-slate-100">
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Mã số Container ISO:</span>
            <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {booking.containerId}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Loại &amp; Kích thước ISO:</span>
            <span className="font-mono font-bold text-slate-800">{booking.containerType || `${booking.size || '40'}${booking.isReefer ? 'RF (Reefer cont lạnh)' : 'HC (High Cube 40 feet)'}`}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Tàu &amp; Chuyến vận chuyển:</span>
            <strong className="text-slate-900">{booking.vesselName || 'EVER GLORY'} · ({booking.voyageNumber || booking.voyageNo || 'V.2024N'})</strong>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Số Vận đơn (Bill of Lading):</span>
            <span className="font-mono font-bold text-blue-700">{booking.billOfLading || (booking.cargoDeclarationId && booking.cargoDeclarationId !== 'N/A' ? booking.cargoDeclarationId : '') || selectedManifestInfo?.blNumber || 'Chưa có B/L'}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Số Niêm phong (Seal No):</span>
            <span className="font-mono font-bold text-slate-800">{booking.sealNumber || 'EMCU-SEAL-8821'}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Khối lượng toàn bộ (VGM):</span>
            <span className="font-mono font-bold text-emerald-700">{booking.vgm ? `${booking.vgm} kg` : '28.450 kg'}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Khối lượng vỏ (Tare):</span>
            <span className="font-mono font-bold text-slate-700">3.850 kg</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Khối lượng hàng thực (Net):</span>
            <span className="font-mono font-bold text-slate-900">{booking.vgm ? `${Math.max(1000, Number(booking.vgm) - 3850).toLocaleString('vi-VN')} kg` : '24.600 kg'}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Thông quan Hải Quan:</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px]">
              ✓ Đã kiểm tra &amp; Thông quan NSW (Luồng Xanh)
            </span>
          </div>
          {((booking.containerType || '').includes('RF') || booking.isReefer) && (
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Nhiệt độ bảo quản lạnh:</span>
              <span className="font-mono font-bold text-cyan-700">-18.0°C (Độ ẩm 85%)</span>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
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

/**
 * Xem biểu phí dịch vụ cảng
 */
export function BookingTariffModal({
  isOpen,
  booking,
  onClose,
  bookingTariffSummary = {},
  activeShiftingFee = {},
  activePortTariff = {},
}) {
  if (!isOpen || !booking) return null

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[95] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 text-xs font-sans">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-700 text-xl">receipt_long</span>
            <h3 className="font-heading text-sm font-bold text-slate-900">Bảng Kê Chi Tiết Biểu Phí Cảng Tiên Sa</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl flex justify-between items-center">
          <div>
            <span className="text-[10px] uppercase font-bold text-purple-800 block">Tổng Cước &amp; Phí Cảng</span>
            <span className="text-lg font-extrabold text-orange-600 font-mono">
              {bookingTariffSummary.totalFormatted || '583.200 VNĐ'}
            </span>
          </div>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${booking.paymentStatus === 'Paid'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
            {booking.paymentStatus === 'Paid' ? '● Đã thanh toán' : '○ Chờ thanh toán'}
          </span>
        </div>

        <div className="space-y-2 font-medium divide-y divide-slate-100">
          <div className="flex justify-between py-1.5">
            <span className="text-slate-600">1. Cước nâng hạ (THC tại bãi):</span>
            <span className="font-mono font-bold text-slate-900">320.000 VNĐ</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-600">2. Phí cơ sở vật chất:</span>
            <span className="font-mono font-bold text-slate-900">100.000 VNĐ</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-600">3. Phí cân VGM:</span>
            <span className="font-mono font-bold text-slate-900">70.000 VNĐ</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-600">4. Phí an ninh bến cảng:</span>
            <span className="font-mono font-bold text-slate-900">50.000 VNĐ</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-600">5. Phí đảo chuyển container (Shifting):</span>
            <span className="font-mono font-bold text-slate-900">
              {activeShiftingFee.statusText || '0 VNĐ (Không phát sinh đảo chuyển)'}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-600">6. Phí lưu bãi ({activePortTariff?.storageDays || 3} ngày, miễn phí 5 ngày):</span>
            <span className="font-mono font-bold text-slate-900">
              {activePortTariff?.storageFee ? `${activePortTariff.storageFee.toLocaleString('vi-VN')} VNĐ` : '0 VNĐ'}
            </span>
          </div>
          {((booking.containerType || '').includes('RF') || booking.isReefer) && (
            <div className="flex justify-between py-1.5">
              <span className="text-slate-600">7. Phí cắm điện &amp; giám sát Cont Lạnh:</span>
              <span className="font-mono font-bold text-slate-900">80.000 VNĐ</span>
            </div>
          )}
          <div className="flex justify-between py-1.5">
            <span className="text-slate-600">Thuế giá trị gia tăng (VAT 8%):</span>
            <span className="font-mono font-bold text-slate-900">{bookingTariffSummary.vatFormatted || '43.200 VNĐ'}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-600">Đơn vị thanh toán:</span>
            <span className="font-bold text-slate-900">{booking.company}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-600">Mã hóa đơn điện tử:</span>
            <span className="font-mono font-bold text-blue-700">HD-TS-2026-{booking.id || '9821'}</span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
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

/**
 * Chọn phân khu và Block bãi Tiên Sa
 */
export function BookingYardBigModal({
  isOpen,
  booking,
  onClose,
  reservedSlot,
  selectedZone,
  setSelectedZone,
  yardZones = [],
  combinedBlocks = [],
  currentZoneBlocks = [],
  onSelectBlock,
}) {
  if (!isOpen || !booking) return null

  // Highlight các blocks trên bản đồ Tiên Sa
  const highlightBlocks = useMemo(() => {
    const map = {}
      ; (combinedBlocks || []).forEach((b) => {
        const code = (b.blockCode || b.code || '').toUpperCase()
        const isSelectedZone = code.startsWith(selectedZone)
        const count = b.occupied ?? (b.slots?.filter((s) => s.status === 'occupied').length || 0)
        if (isSelectedZone) {
          map[code] = {
            count,
            color: '#f59e0b',
          }
        } else if (count > 0) {
          map[code] = {
            count,
            color: '#38bdf8',
          }
        }
      })
    return map
  }, [combinedBlocks, selectedZone])

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[95] flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl w-[96vw] max-w-[1550px] h-[94vh] max-h-[94vh] p-6 sm:p-7 flex flex-col gap-3.5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 text-xs font-sans overflow-hidden">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">grid_view</span>
            </div>
            <div>
              <h3 className="font-heading text-base font-black text-slate-900">Sơ Đồ Phân Khu Bãi Container Tiên Sa</h3>
              <p className="text-xs text-slate-500">Tự động chọn khu theo loại cont và mở sơ đồ Bay &amp; Slot để đổi vị trí</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Vị trí hiện tại */}
        {reservedSlot && (
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div>
              <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wide">Vị trí bãi đang xếp chỗ cho Cont {booking.containerId}:</span>
              <div className="text-base font-bold text-slate-900 font-mono mt-1">
                Block {reservedSlot.blockCode} • Bay {reservedSlot.bay || '02'} • Tầng {reservedSlot.tier} • Hàng {reservedSlot.row} (POS: {reservedSlot.posId})
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-bold text-xs shadow-2xs self-start sm:self-auto">
              {reservedSlot.isReefer ? 'Khu Cont Lạnh' : 'Bãi Tiên Sa'}
            </span>
          </div>
        )}

        {/* ── BẢN ĐỒ BÃI CẢNG TIÊN SA TRỰC QUAN: NHẤP TRỰC TIẾP VÀO BLOCK ĐỂ CHỌN BAY & SLOT ── */}
        <div className="flex flex-col gap-2 flex-1 min-h-0 pt-1">
          <div className="flex flex-wrap items-center justify-between text-xs font-black text-slate-900 uppercase tracking-wide gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600 text-lg">map</span>
              <span>BẢN ĐỒ CẢNG TIÊN SA · NHẤP TRỰC TIẾP VÀO BLOCK ĐỂ CHỌN BAY &amp; SLOT:</span>
            </div>
            <span className="text-[11px] font-medium text-slate-500 normal-case">
              (Nhấp vào bất kỳ Block nào trên bản đồ để mở ngay sơ đồ chọn Bay &amp; Slot của Block đó)
            </span>
          </div>

          <div className="yard-design-preview flex-1 min-h-0 rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-50 flex flex-col [&_.tien-sa-design-map]:flex-1 [&_.tien-sa-design-map]:flex [&_.tien-sa-design-map]:flex-col [&_.yard-layout-viewport]:!flex-1 [&_.yard-layout-viewport]:!h-full [&_.yard-layout-viewport]:!min-h-[500px] sm:[&_.yard-layout-viewport]:!min-h-[600px] [&_.yard-map-controls]:!py-2 [&_.yard-map-controls]:!px-3 [&_.yard-layout-legend]:!py-1.5 [&_.yard-layout-legend]:!px-3">
            <TienSaMap
              layout={tienSaLayout}
              selectedCode={reservedSlot?.blockCode}
              onSelectArea={(area) => {
                const code = (area.code || area.blockCode || '').toUpperCase()
                const found = (combinedBlocks || []).find((b) => (b.blockCode || b.code || '').toUpperCase() === code) || {
                  blockCode: code,
                  code,
                  planning: area.planning || { bayModules: 28, rows: 6, tiers: 4 },
                  maxRows: area.planning?.rows || 6,
                  maxTiers: area.planning?.tiers || 4,
                  bayModules: area.planning?.bayModules || 28,
                }
                onSelectBlock?.(found)
              }}
              highlightBlocks={highlightBlocks}
              operational={true}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer hover:bg-black transition shadow-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
