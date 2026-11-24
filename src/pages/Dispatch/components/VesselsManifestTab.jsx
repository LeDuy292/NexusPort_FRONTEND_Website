import React from 'react'
import ShippingPagination from '../../ShippingLine/components/ShippingPagination'
import { isManifestPermanentlyApproved } from '../../../services/manifestPortSyncService'

const VOYAGE_STATUS_STYLES = {
  SCHEDULED: 'bg-slate-100 text-slate-700 border-slate-300',
  IN_TRANSIT: 'bg-blue-50 text-blue-700 border-blue-300',
  BERTHED: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  OPERATING: 'bg-indigo-50 text-indigo-700 border-indigo-300',
  DEPARTED: 'bg-slate-100 text-slate-600 border-slate-300',
  COMPLETED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
}

const VOYAGE_STATUS_LABELS = {
  SCHEDULED: 'Kế hoạch',
  IN_TRANSIT: 'Đang hành trình',
  BERTHED: 'Đã cập cảng',
  OPERATING: 'Đang làm hàng',
  DEPARTED: 'Đã rời cảng',
  COMPLETED: 'Hoàn tất',
}

export default function VesselsManifestTab({
  vesselKpiStats = {},
  vesselSearch,
  setVesselSearch,
  selectedVesselFilter,
  setSelectedVesselFilter,
  filteredVessels = [],
  pagedVessels = [],
  vesselPage,
  setVesselPage,
  vesselPageSize,
  setVesselPageSize,
  onOpenManifestDetail,
  onOpenYardPlanning,
}) {
  return (
    <div className="space-y-4">
      {/* ── KPI CHỈ SỐ TÀU CẬP CẢNG ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tổng số tàu cập cảng</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{vesselKpiStats.total}</div>
          <div className="text-xs text-slate-400 mt-0.5">Bản khai điện tử e-Manifest</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-emerald-600 p-4 shadow-2xs">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Tàu đã cập cảng</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono">{vesselKpiStats.berthed}</div>
          <div className="text-xs text-slate-500 mt-0.5">Sẵn sàng đón xe vào bãi</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-indigo-600 p-4 shadow-2xs">
          <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Đang làm hàng</div>
          <div className="text-2xl font-bold text-indigo-700 mt-1 font-mono">{vesselKpiStats.operating}</div>
          <div className="text-xs text-slate-500 mt-0.5">Xếp dỡ tại cầu bến</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-orange-500 p-4 shadow-2xs">
          <div className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Tổng container khai báo</div>
          <div className="text-2xl font-bold text-orange-600 mt-1 font-mono">{vesselKpiStats.totalContainers}</div>
          <div className="text-xs text-slate-500 mt-0.5">Chuẩn ISO 6346 &amp; VGM</div>
        </div>
      </div>

      {/* ── THANH TÌM KIẾM TÀU TỐI GIẢN ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
          <input
            type="text"
            value={vesselSearch}
            onChange={e => setVesselSearch(e.target.value)}
            placeholder="Tìm tàu, số chuyến, mã bản khai..."
            className="w-full h-8 pl-8 pr-7 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 transition-all"
          />
          {vesselSearch && (
            <button
              type="button"
              onClick={() => setVesselSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {selectedVesselFilter !== 'All' && (
          <button
            type="button"
            onClick={() => setSelectedVesselFilter('All')}
            className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition"
          >
            <span className="material-symbols-outlined text-sm">filter_alt_off</span>
            <span>Xem tất cả tàu</span>
          </button>
        )}
      </div>

      {/* ── BẢNG DANH SÁCH TÀU CẬP CẢNG ── */}
      <div className="bg-white rounded-2xl border border-chalk shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-chalk flex items-center justify-between bg-fog/30">
          <h3 className="font-heading text-xs font-extrabold text-carbon uppercase tracking-wider">
            Danh Sách Tàu Cập Cảng ({filteredVessels.length})
          </h3>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-fog/50 border-b border-chalk text-slate font-extrabold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3.5">Tàu Biển &amp; Chuyến</th>
                <th className="py-2.5 px-3">Hãng Tàu</th>
                <th className="py-2.5 px-3">Cầu Bến</th>
                <th className="py-2.5 px-3">Container</th>
                <th className="py-2.5 px-3">Trạng Thái</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk font-medium">
              {filteredVessels.length === 0 ? null : (
                pagedVessels.map(m => {
                  const isApproved = isManifestPermanentlyApproved(m) || m.portApprovalStatus === 'PORT_APPROVED' || m.status === 'PORT_APPROVED'
                  const vKey = m.manifestNumber || m.manifestId

                  return (
                    <tr
                      key={vKey}
                      onClick={() => onOpenManifestDetail?.(m)}
                      className="hover:bg-fog/60 transition-colors cursor-pointer group"
                    >
                      {/* 1. Tàu & Chuyến */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span className="font-bold text-carbon text-xs group-hover:text-signal-orange">
                          {m.vesselName}
                        </span>
                        <span className="font-mono text-slate text-[11px] ml-1.5">
                          ({m.voyageNumber})
                        </span>
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          String(m.direction || '').toUpperCase() === 'IMPORT' || m.direction === 'Nhập khẩu'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}>
                          {String(m.direction || '').toUpperCase() === 'IMPORT' || m.direction === 'Nhập khẩu' ? 'Nhập khẩu' : 'Xuất khẩu'}
                        </span>
                      </td>

                      {/* 2. Hãng Tàu */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="text-carbon font-medium text-xs">
                          {m.shippingLine ? m.shippingLine.split('(')[0].trim() : 'Hãng tàu'}
                        </span>
                      </td>

                      {/* 3. Cầu bến */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-carbon">
                          {m.berth ? m.berth.split(' - ')[0] : 'Bến TS-01'}
                        </span>
                      </td>

                      {/* 4. Số Cont */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-fog border border-chalk font-mono font-bold text-xs text-carbon">
                          {m.containers?.length || 0} Cont
                        </span>
                      </td>

                      {/* 5. Trạng thái tàu */}
                      <td className="py-2.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <span
                          title="Trạng thái do Hãng tàu cập nhật"
                          className={`inline-flex items-center text-[11px] font-bold py-1 px-3 rounded-full border shadow-2xs ${VOYAGE_STATUS_STYLES[m.vesselStatus || 'BERTHED'] || 'bg-emerald-50 text-emerald-700 border-emerald-300'}`}
                        >
                          ● {VOYAGE_STATUS_LABELS[m.vesselStatus || 'BERTHED'] || m.vesselStatus}
                        </span>
                      </td>

                      {/* 6. Thao tác */}
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {!isApproved ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onOpenYardPlanning?.(m)
                              }}
                              title="Kiểm tra vị trí đặt chỗ bãi theo logic và duyệt tàu"
                              className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition shadow-xs"
                            >
                              <span className="material-symbols-outlined text-[13px]">grid_view</span>
                              <span>Xem Bãi &amp; Duyệt</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onOpenYardPlanning?.(m)
                              }}
                              title="Xem danh sách vị trí bãi container đã duyệt của tàu này"
                              className="h-7 px-2.5 bg-fog hover:bg-chalk/70 text-carbon border border-chalk rounded-lg font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
                            >
                              <span className="material-symbols-outlined text-[13px] text-emerald-600 font-bold">check_circle</span>
                              <span>Vị Trí Bãi (Đã duyệt)</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpenManifestDetail?.(m)
                            }}
                            className="h-7 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold text-[11px] shadow-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Chi tiết</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        <ShippingPagination
          currentPage={vesselPage}
          totalItems={filteredVessels.length}
          pageSize={vesselPageSize}
          onPageChange={setVesselPage}
          onPageSizeChange={setVesselPageSize}
          pageSizeOptions={[5, 10, 20]}
          itemName="bản khai tàu"
        />
      </div>
    </div>
  )
}
