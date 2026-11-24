import React, { useState } from 'react'
import ShippingPagination from '../../ShippingLine/components/ShippingPagination'

export default function BookingsScheduleTab({
  kpiStats = {},
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  operationFilter,
  setOperationFilter,
  selectedVesselFilter,
  setSelectedVesselFilter,
  dateFilter,
  setDateFilter,
  availableVessels = [],
  availableDates = [],
  manifestGeneratedBookings = [],
  filteredBookings = [],
  manifestBookingsByCompany = [],
  pagedCompanies = [],
  companyPage = 1,
  setCompanyPage,
  companyPageSize = 5,
  setCompanyPageSize,
  isBookingTransportSubmitted,
  isBookingApprovedOrBillSent,
  isBookingRejectedOrUnassigned,
  getGateBookingVehicle,
  getGateBookingDriver,
  eportListItems = [],
  eportValidationMap = {},
  onSelectBooking,
  handleClearAllFilters,
  approvedVesselsList = [],
}) {
  const [collapsedCompanies, setCollapsedCompanies] = useState({})
  const [isCompanySectionCollapsed, setIsCompanySectionCollapsed] = useState(false)

  const activeVesselObj =
    selectedVesselFilter !== 'All'
      ? approvedVesselsList.find(
        v => v.manifestNumber === selectedVesselFilter || v.manifestId === selectedVesselFilter || v.vesselName === selectedVesselFilter
      )
      : null

  const allCompaniesCollapsed =
    manifestBookingsByCompany.length > 0 &&
    manifestBookingsByCompany.every(g => collapsedCompanies[g.groupKey || g.companyName])

  const handleToggleAllCompanies = (e) => {
    e.stopPropagation()
    if (isCompanySectionCollapsed) {
      setIsCompanySectionCollapsed(false)
      setCollapsedCompanies({})
      return
    }
    if (allCompaniesCollapsed) {
      setCollapsedCompanies({})
    } else {
      const next = {}
      manifestBookingsByCompany.forEach(g => {
        next[g.groupKey || g.companyName] = true
      })
      setCollapsedCompanies(next)
    }
  }

  return (
    <>
      {/* ── KPI CHỈ SỐ CONTAINER ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => setStatusFilter?.(statusFilter === 'Pending' ? 'All' : 'Pending')}
          className={`rounded-[15px] border bg-white p-4 transition-all cursor-pointer ${statusFilter === 'Pending' ? 'border-[#cc9469] ring-2 ring-[#fb9b70]/40' : 'border-[#e0e8f0] hover:border-[#becbd8]'
            }`}
        >
          <div className="text-[10px] font-bold text-[#a1845f] uppercase tracking-wider">Chờ xử lý</div>
          <div className="text-2xl font-bold text-[#29415a] mt-1 font-mono">{kpiStats.pending}</div>
          <div className="text-[11px] text-[#778ba3] mt-0.5">Cần xử lý ngay</div>
        </div>

        <div
          onClick={() => setStatusFilter?.(statusFilter === 'Under Review' ? 'All' : 'Under Review')}
          className={`rounded-[15px] border bg-white p-4 transition-all cursor-pointer ${statusFilter === 'Under Review' ? 'border-[#6b88a9] ring-2 ring-[#6b88a9]/30' : 'border-[#e0e8f0] hover:border-[#becbd8]'
            }`}
        >
          <div className="text-[10px] font-bold text-[#6b88a9] uppercase tracking-wider">Đang xem xét</div>
          <div className="text-2xl font-bold text-[#29415a] mt-1 font-mono">{kpiStats.underReview}</div>
          <div className="text-[11px] text-[#778ba3] mt-0.5">Đang đối soát hồ sơ</div>
        </div>

        <div
          onClick={() => setStatusFilter?.(statusFilter === 'Approved' ? 'All' : 'Approved')}
          className={`rounded-[15px] border bg-white p-4 transition-all cursor-pointer ${statusFilter === 'Approved' ? 'border-[#5e8b74] ring-2 ring-[#5e8b74]/30' : 'border-[#e0e8f0] hover:border-[#becbd8]'
            }`}
        >
          <div className="text-[10px] font-bold text-[#5e8b74] uppercase tracking-wider">Đã cấp lịch</div>
          <div className="text-2xl font-bold text-[#29415a] mt-1 font-mono">{kpiStats.approvedToday}</div>
          <div className="text-[11px] text-[#778ba3] mt-0.5">Đủ điều kiện qua cổng</div>
        </div>

        <div
          onClick={() => setStatusFilter?.(statusFilter === 'Rejected' ? 'All' : 'Rejected')}
          className={`rounded-[15px] border bg-white p-4 transition-all cursor-pointer ${statusFilter === 'Rejected' ? 'border-[#ad7a73] ring-2 ring-[#ad7a73]/30' : 'border-[#e0e8f0] hover:border-[#becbd8]'
            }`}
        >
          <div className="text-[10px] font-bold text-[#ad7a73] uppercase tracking-wider">Bị từ chối</div>
          <div className="text-2xl font-bold text-[#29415a] mt-1 font-mono">{kpiStats.rejectedToday}</div>
          <div className="text-[11px] text-[#778ba3] mt-0.5">Sai lệch chứng từ</div>
        </div>

        <div
          onClick={() => setStatusFilter?.('All')}
          className="rounded-[15px] border border-[#e0e8f0] bg-white p-4 transition-all cursor-pointer col-span-2 sm:col-span-1 hover:border-[#becbd8]"
        >
          <div className="text-[10px] font-bold text-[#b94717] uppercase tracking-wider">Đợi Transport gửi xe</div>
          <div className="text-2xl font-bold text-[#b94717] mt-1 font-mono">{kpiStats.atRisk}</div>
          <div className="text-[11px] text-[#778ba3] mt-0.5">Đã có giấy tờ &amp; bãi</div>
        </div>
      </div>

      {/* ── THANH TÌM KIẾM & BỘ LỌC ── */}
      <div className="epo-worklist p-4">
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold">
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate text-base">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery?.(e.target.value)}
              placeholder="Tìm mã Booking, Số cont, Công ty, Tàu..."
              className="w-full h-9 pl-9 pr-7 rounded-xl border border-chalk bg-fog/60 text-xs font-bold text-carbon placeholder:text-slate/70 focus:outline-none focus:border-signal-orange focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery?.('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate hover:text-carbon cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={operationFilter}
            onChange={e => setOperationFilter?.(e.target.value)}
            className="h-9 px-3 bg-fog/60 hover:bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange cursor-pointer"
          >
            <option value="All">Mọi nghiệp vụ</option>
            <option value="Pickup">Lấy cont (Pickup)</option>
            <option value="Delivery">Hạ cont (Delivery)</option>
          </select>

          <select
            value={selectedVesselFilter}
            onChange={e => setSelectedVesselFilter?.(e.target.value)}
            className="h-9 px-3 bg-fog/60 hover:bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange max-w-[220px] truncate cursor-pointer"
            title="Lọc theo Tàu"
          >
            <option value="All">Tất cả chuyến tàu ({availableVessels.length})</option>
            {availableVessels.map(v => (
              <option key={v.key || v.manifestNumber || v.vesselName} value={v.manifestNumber || v.vesselName}>
                🚢 {v.label}
              </option>
            ))}
          </select>

          <select
            value={dateFilter}
            onChange={e => setDateFilter?.(e.target.value)}
            className="h-9 px-3 bg-fog/60 hover:bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange cursor-pointer"
            title="Lọc theo Ngày"
          >
            <option value="All">Tất cả các ngày ({availableDates.length})</option>
            {availableDates.map(d => (
              <option key={d} value={d}>
                📅 {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── DANH SÁCH CONTAINER CHIA THEO NGÀY & CHUYẾN TÀU ── */}
      {manifestGeneratedBookings.length > 0 && (
        <div id="manifest-company-section" className="space-y-4">
          <section className="epo-worklist p-5">
            <div className="epo-worklist-heading !p-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[11px] bg-[#f5f8fc] text-[#60768f] border border-[#e2e9f1] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">calendar_month</span>
                </div>
                <div>
                  <span className="epo-caption">PHÂN BỔ THEO NGÀY &amp; CHUYẾN TÀU</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2>Danh Sách Container Theo Ngày &amp; Chuyến Tàu</h2>
                    <span className="epo-result-count">{filteredBookings.length} Cont</span>
                    {activeVesselObj && (
                      <span className="epo-badge blue">
                        <span />
                        Tàu: {activeVesselObj.vesselName}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedVesselFilter?.('All')
                          }}
                          className="hover:text-rose-600 ml-1 text-[11px] font-bold cursor-pointer"
                          title="Bỏ lọc tàu"
                        >
                          ✕
                        </button>
                      </span>
                    )}
                    {dateFilter !== 'All' && (
                      <span className="epo-badge orange">
                        <span />
                        Ngày: {dateFilter}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDateFilter?.('All')
                          }}
                          className="hover:text-rose-600 ml-1 text-[11px] font-bold cursor-pointer"
                          title="Bỏ lọc ngày"
                        >
                          ✕
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isCompanySectionCollapsed && manifestBookingsByCompany.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleAllCompanies}
                    className="epc-button secondary !min-h-[36px] !py-1.5 !px-3"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {allCompaniesCollapsed ? 'unfold_more' : 'unfold_less'}
                    </span>
                    <span>{allCompaniesCollapsed ? 'Mở tất cả' : 'Thu gọn'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsCompanySectionCollapsed(prev => !prev)}
                  className="epc-button secondary !min-h-[36px] !py-1.5 !px-3"
                >
                  <span className="material-symbols-outlined text-base">
                    {isCompanySectionCollapsed ? 'expand_more' : 'expand_less'}
                  </span>
                  <span>{isCompanySectionCollapsed ? 'Mở rộng' : 'Ẩn'}</span>
                </button>
              </div>
            </div>
          </section>

          {/* Nếu lọc tàu mà không có container khớp */}
          {!isCompanySectionCollapsed && manifestBookingsByCompany.length === 0 && (
            <div className="bg-white border border-dashed border-chalk rounded-2xl p-6 text-center space-y-2">
              <span className="material-symbols-outlined text-3xl text-slate-400">search_off</span>
              <div className="text-xs font-bold text-carbon">
                Không có Container nào phù hợp với bộ lọc hiện tại.
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="px-3 py-1.5 bg-carbon text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
                >
                  <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                  <span>Xem tất cả Container ({manifestGeneratedBookings.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* Danh sách từng Bảng riêng cho mỗi Ngày & Chuyến Tàu */}
          {!isCompanySectionCollapsed && manifestBookingsByCompany.length > 0 && (
            <>
              <div className="space-y-4">
                {pagedCompanies.map((group, gIdx) => {
                  const globalIdx = (companyPage - 1) * companyPageSize + gIdx + 1
                  const waitingTransportCount = group.items.filter(x => isBookingTransportSubmitted && !isBookingTransportSubmitted(x) && !isBookingApprovedOrBillSent(x)).length
                  const readyToReviewCount = group.items.filter(x => isBookingTransportSubmitted && isBookingTransportSubmitted(x) && !isBookingApprovedOrBillSent(x)).length
                  const isGroupCollapsed = Boolean(collapsedCompanies[group.groupKey || group.companyName])

                  return (
                    <div
                      key={group.groupKey || group.companyName}
                      className="epo-worklist transition-all"
                    >
                      {/* Header của từng Bảng Ngày & Chuyến Tàu */}
                      <div
                        onClick={() =>
                          setCollapsedCompanies(prev => ({
                            ...prev,
                            [group.groupKey || group.companyName]: !prev[group.groupKey || group.companyName],
                          }))
                        }
                        className="px-5 py-3.5 bg-[#fbfcfe] hover:bg-[#f5f8fc] border-b border-[#e9eef4] flex justify-between items-center gap-2 cursor-pointer transition select-none"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-[9px] bg-[#f5f8fc] border border-[#e2e9f1] text-[#3e5873] font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                            {globalIdx}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#eef4fb] text-[#1b4372] border border-[#d6e4f3] font-mono font-bold text-xs">
                                <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                                <span>{group.date}</span>
                              </span>
                              <h4 className="text-[13px] font-bold text-[#29415a] flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm text-[#ea580c]">directions_boat</span>
                                <span>{group.vesselName}</span>
                                {group.voyageNumber && (
                                  <span className="font-mono text-xs font-semibold text-[#60768f]">
                                    ({group.voyageNumber})
                                  </span>
                                )}
                              </h4>
                            </div>
                            <div className="text-[11px] text-[#8a9bb0] mt-0.5 flex items-center gap-2">
                              <span>Hãng tàu: <strong className="text-[#3e5873]">{group.shippingLine || 'Hãng tàu'}</strong></span>
                              <span>•</span>
                              <span className={group.direction === 'IMPORT' ? 'text-sky-700 font-semibold' : 'text-purple-700 font-semibold'}>
                                {group.direction === 'IMPORT' ? 'Hàng Nhập khẩu' : 'Hàng Xuất khẩu'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="epo-result-count font-mono">
                            {group.items.length} Cont
                          </span>

                          {waitingTransportCount > 0 ? (
                            <span className="epo-badge orange">
                              <span />
                              Chờ vận tải gửi booking ({waitingTransportCount})
                            </span>
                          ) : readyToReviewCount > 0 ? (
                            <span className="epo-badge blue">
                              <span />
                              Vận tải đã gửi · Chờ duyệt ({readyToReviewCount})
                            </span>
                          ) : (
                            <span className="epo-badge green">
                              <span />
                              Đã đủ xe &amp; duyệt
                            </span>
                          )}

                          <span className="material-symbols-outlined text-[#8a9bb0] text-base">
                            {isGroupCollapsed ? 'expand_more' : 'expand_less'}
                          </span>
                        </div>
                      </div>

                      {/* Bảng các Container */}
                      {!isGroupCollapsed && (
                        <div className="w-full overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-[#f7f9fc] border-b border-[#e9eef4] text-[#8a9bb0] font-bold uppercase text-[10px] tracking-wider">
                                <th className="py-2.5 px-3.5">Mã Đơn</th>
                                <th className="py-2.5 px-3">Container</th>
                                <th className="py-2.5 px-3">Phương Tiện &amp; Tài Xế</th>
                                <th className="py-2.5 px-3">Vị Trí Bãi</th>
                                <th className="py-2.5 px-3">Trạng Thái Hàng Hóa</th>
                                <th className="py-2.5 px-3.5 text-right">Thao Tác</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {group.items.map((b, bIdx) => {
                                const isPickup = b.operation === 'Pickup'
                                const slot = b.autoYardSlot || {}
                                const isReefer = slot.isReefer || (b.containerType || '').includes('RF')
                                const isDG = slot.isDG || (b.dgClass || '').includes('Class')
                                const matchedEport = eportListItems.find(
                                  (o) =>
                                    (b.eportOrderId && o.id === b.eportOrderId) ||
                                    eportValidationMap[o.id]?.bookingId === b.id ||
                                    (b.containerId && String(o.sourceLabel || '').toUpperCase().includes(String(b.containerId).toUpperCase())) ||
                                    (b.containerId && (o.containers || []).some(c => (c.containerNumber || c).toUpperCase() === b.containerId.toUpperCase())) ||
                                    (b.voyageNumber && String(o.sourceLabel || '').toUpperCase().includes(String(b.voyageNumber).replace(/[^A-Z0-9]/gi, '').toUpperCase())) ||
                                    (b.id && (String(o.sourceLabel || '').toUpperCase().includes(String(b.id).toUpperCase()) || (o.bookingNumber && o.bookingNumber.toUpperCase() === b.id.toUpperCase())))
                                )
                                const isEportPaid = !!(
                                  matchedEport &&
                                  !['REJECTED', 'CANCELLED'].includes(String(matchedEport.status || '').toUpperCase()) &&
                                  ['PAID', 'SUCCEEDED', 'NOT_REQUIRED'].includes(String(matchedEport.paymentStatus || '').toUpperCase())
                                )
                                const isRejectedUnassigned = isBookingRejectedOrUnassigned ? isBookingRejectedOrUnassigned(b) : false
                                const isApprovedOrBilled = !isRejectedUnassigned && ((isBookingApprovedOrBillSent && isBookingApprovedOrBillSent(b)) || isEportPaid)
                                const isPaid = !isRejectedUnassigned && (isEportPaid || !!b.portBillPaid || b.paymentStatus === 'Paid' || b.status === 'Ready')

                                let completionBadge = { cls: 'orange', icon: 'local_shipping', text: 'Chờ vận tải gửi booking' }
                                if (b.status === 'Cancelled' || b.status === 'Canceled') {
                                  completionBadge = { cls: 'slate', icon: 'block', text: 'Đã hủy' }
                                } else if (isPaid) {
                                  completionBadge = { cls: 'green', icon: 'check_circle', text: '✓ Sẵn sàng vào cổng (Đã thanh toán)' }
                                } else if (isApprovedOrBilled) {
                                  completionBadge = { cls: 'orange', icon: 'account_balance_wallet', text: 'Đã duyệt · Chờ thanh toán' }
                                } else {
                                  completionBadge = { cls: 'orange', icon: 'local_shipping', text: 'Chờ vận tải gửi booking' }
                                }

                                const bayNumOnly = String(slot.bay || slot.bayCode || slot.bayDisplay || '02').replace(/\D/g, '').padStart(2, '0')
                                const cleanBay = `Bay ${bayNumOnly}`

                                return (
                                  <tr
                                    key={b.id ? `${b.id}-${bIdx}` : bIdx}
                                    onClick={() => onSelectBooking?.(b)}
                                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                  >
                                    {/* 1. Mã Đơn */}
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      <span className="font-mono text-xs font-semibold text-slate-700 group-hover:text-orange-600 transition-colors">
                                        {b.id}
                                      </span>
                                    </td>

                                    {/* 2. Container */}
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono text-xs font-bold text-slate-900">{b.containerId}</span>
                                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${isPickup
                                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                                          : 'bg-purple-50 text-purple-700 border-purple-200'
                                          }`}>
                                          {isPickup ? 'Lấy cont' : 'Hạ cont'}
                                        </span>
                                      </div>
                                    </td>

                                    {/* 3. Phương Tiện & Tài Xế */}
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      {(() => {
                                        const vPlate = getGateBookingVehicle ? getGateBookingVehicle(b) : b.licensePlate
                                        const dName = getGateBookingDriver ? getGateBookingDriver(b) : b.driverName
                                        if (vPlate) {
                                          return (
                                            <div className="flex flex-col gap-0.5">
                                              <span className="font-mono text-xs font-bold text-slate-800 flex items-center gap-1">
                                                <span>🚚</span>
                                                <span>{vPlate}</span>
                                              </span>
                                              <span className="text-[11px] text-slate-500 truncate max-w-[150px]">
                                                👤 {dName || 'Tài xế theo xe'}
                                              </span>
                                            </div>
                                          )
                                        }
                                        return (
                                          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                                            Chờ gán xe &amp; tài xế
                                          </span>
                                        )
                                      })()}
                                    </td>

                                    {/* 4. Vị Trí Bãi Tiên Sa - Đồng bộ tuyệt đối theo grid_view Bản Khai Tàu */}
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      {slot.blockCode ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            onSelectBooking?.(b)
                                          }}
                                          className={`font-mono font-bold px-2.5 py-1 rounded-lg border text-[11px] inline-flex items-center gap-1.5 shadow-2xs transition active:scale-95 group cursor-pointer ${
                                            isReefer
                                              ? 'text-cyan-950 bg-cyan-100/90 hover:bg-cyan-200 border-cyan-300'
                                              : isDG
                                                ? 'text-rose-950 bg-rose-50 hover:bg-rose-100 border-rose-300'
                                                : 'text-indigo-950 bg-indigo-50/90 hover:bg-indigo-100 border-indigo-200'
                                          }`}
                                          title="Bấm để xem chi tiết vị trí bãi container"
                                        >
                                          <span>📍 {slot.slotName || `Khu ${slot.blockCode} · Bay ${cleanBay.replace('Bay ', '')} (R${String(slot.row || 1).padStart(2, '0')}-T${slot.tier || 1})`}</span>
                                          <span className={`material-symbols-outlined text-[13px] opacity-60 group-hover:opacity-100 ${isReefer ? 'text-cyan-700' : isDG ? 'text-rose-700' : 'text-indigo-700'}`}>map</span>
                                        </button>
                                      ) : (
                                        <span className="text-xs text-slate-400 italic">Chờ xếp bãi</span>
                                      )}
                                    </td>

                                    {/* 5. Trạng thái */}
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      <span className={`epo-badge ${completionBadge.cls}`}>
                                        <span />
                                        {completionBadge.text}
                                      </span>
                                    </td>

                                    {/* 6. Thao Tác */}
                                    <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        onClick={() => onSelectBooking?.(b)}
                                        className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                                      >
                                        Chi tiết
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Phân trang */}
              <div className="bg-white rounded-2xl border border-chalk shadow-2xs overflow-hidden mt-2">
                <ShippingPagination
                  currentPage={companyPage}
                  totalItems={manifestBookingsByCompany.length}
                  pageSize={companyPageSize}
                  onPageChange={setCompanyPage}
                  onPageSizeChange={setCompanyPageSize}
                  pageSizeOptions={[3, 5, 10]}
                  itemName="ngày & chuyến tàu"
                />
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
