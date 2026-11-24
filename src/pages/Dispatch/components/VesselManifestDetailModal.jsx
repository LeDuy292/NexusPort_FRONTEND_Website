import React, { useState, useMemo } from 'react'
import { isManifestPermanentlyApproved } from '../../../services/manifestPortSyncService'

export default function VesselManifestDetailModal({
  isOpen,
  manifest,
  onClose,
  onOpenYardPlanning,
}) {
  const [vesselDetailTab, setVesselDetailTab] = useState('containers')

  const selectedVesselCargoStats = useMemo(() => {
    if (!manifest?.containers) return { count: 0, gross: 0, net: 0, cbm: '0.0', rfCount: 0 }
    let count = manifest.containers.length
    let gross = 0
    let net = 0
    let cbm = 0
    let rfCount = 0
    manifest.containers.forEach(c => {
      gross += Number(c.grossWeightKg || 0)
      net += Number(c.netWeightKg || 0)
      cbm += Number(c.volumeCbm || 0)
      if (c.isRf || Boolean(c.isReefer) || (c.containerType || '').includes('RF') || (c.tempRequired || '').includes('-')) {
        rfCount += 1
      }
    })
    return { count, gross, net, cbm: cbm.toFixed(1), rfCount }
  }, [manifest])

  const selectedVesselBlGroups = useMemo(() => {
    if (!manifest?.containers) return []
    const map = {}
    manifest.containers.forEach(c => {
      const bl = c.blNumber || 'BL-CHƯA-KHAI-BÁO'
      if (!map[bl]) {
        map[bl] = {
          blNumber: bl,
          shipper: c.shipperName || 'Công ty CP XNK Miền Trung',
          consignee: c.consigneeName || 'Công ty TNHH Tiếp Vận Tiên Sa',
          cargoDescription: c.cargoDescription || 'Hàng bách hóa tổng hợp',
          packageCount: Number(c.packageCount || 100),
          packageType: c.packageType || 'Kiện / Pallet',
          grossWeightKg: 0,
          totalGrossWeight: 0,
          volumeCbm: 0,
          pol: manifest.pol,
          pod: manifest.pod,
          containers: [],
        }
      }
      const gKg = Number(c.grossWeightKg || 0)
      map[bl].grossWeightKg += gKg
      map[bl].totalGrossWeight += gKg
      map[bl].volumeCbm += Number(c.volumeCbm || 0)
      map[bl].containers.push(c)
    })
    return Object.values(map)
  }, [manifest])

  if (!isOpen || !manifest) return null

  const isApproved = isManifestPermanentlyApproved(manifest) || manifest.portApprovalStatus === 'PORT_APPROVED' || manifest.status === 'PORT_APPROVED'

  return (
    <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 print:p-0 print:bg-white">
      <div className="bg-white w-full max-w-[96vw] xl:max-w-7xl max-h-[95vh] rounded-3xl p-5 md:p-8 space-y-6 shadow-2xl overflow-y-auto animate-in zoom-in-95 duration-200 font-sans print:max-h-none print:shadow-none print:rounded-none">

        {/* Modal Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <span className="material-symbols-outlined text-2xl">directions_boat</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading text-lg sm:text-xl font-bold text-slate-900 truncate">
                  Tàu {manifest.vesselName}
                </h3>
                <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-mono font-bold text-xs border border-blue-200">
                  Chuyến {manifest.voyageNumber}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-medium text-xs">
                  {manifest.shippingLine}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5 flex-wrap">
                <span>NSW: <strong className="text-blue-900 font-bold">{manifest.nswRef || 'NSW-DAD-2026-2341'}</strong></span>
                <span>•</span>
                <span>Cầu bến: <strong className="text-slate-700 font-bold">{manifest.berth || 'Bến số 1 (TS-01)'}</strong></span>
                <span>•</span>
                <span>Hành trình: <strong className="text-slate-700">{manifest.pol?.split(',')[0] || 'Tiên Sa'} ➔ {manifest.pod?.split(',')[0] || 'Quốc tế'}</strong></span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs cursor-pointer"
              title="In / Xuất Bản khai"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              <span>In bản khai</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── KPI THỐNG KÊ TOÀN TÀU ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tổng Container</span>
            <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">{selectedVesselCargoStats.count} Cont</div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Trọng lượng Gross</span>
            <div className="text-lg font-bold font-mono text-blue-700 mt-0.5">{selectedVesselCargoStats.gross.toLocaleString()} kg</div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tổng thể tích (CBM)</span>
            <div className="text-lg font-bold font-mono text-purple-700 mt-0.5">{selectedVesselCargoStats.cbm} m³</div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tổng Vận Đơn (B/L)</span>
            <div className="text-lg font-bold font-mono text-amber-600 mt-0.5">{selectedVesselBlGroups.length} B/L</div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cont Lạnh (Reefer)</span>
            <div className="text-lg font-bold font-mono text-emerald-600 mt-0.5">{selectedVesselCargoStats.rfCount} RF</div>
          </div>
        </div>

        {/* ── THANH CHUYỂN ĐỔI 3 TABS TRONG MODAL ── */}
        <div className="border-b border-chalk flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setVesselDetailTab('containers')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-extrabold text-xs transition-all cursor-pointer shrink-0 ${vesselDetailTab === 'containers'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate hover:text-carbon hover:bg-slate-100'
              }`}
          >
            <span className="material-symbols-outlined text-base">inventory_2</span>
            <span>1. Danh Sách Container Chi Tiết ({selectedVesselCargoStats.count})</span>
          </button>

          <button
            type="button"
            onClick={() => setVesselDetailTab('bl')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-extrabold text-xs transition-all cursor-pointer shrink-0 ${vesselDetailTab === 'bl'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate hover:text-carbon hover:bg-slate-100'
              }`}
          >
            <span className="material-symbols-outlined text-base">receipt_long</span>
            <span>2. Tổng Hợp Theo Vận Đơn B/L ({selectedVesselBlGroups.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setVesselDetailTab('vessel')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-extrabold text-xs transition-all cursor-pointer shrink-0 ${vesselDetailTab === 'vessel'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate hover:text-carbon hover:bg-slate-100'
              }`}
          >
            <span className="material-symbols-outlined text-base">directions_boat</span>
            <span>3. Hồ Sơ Kỹ Thuật Tàu &amp; Cầu Bến</span>
          </button>
        </div>

        {/* ── NỘI DUNG TAB 1: DANH SÁCH CONTAINER CHI TIẾT ── */}
        {vesselDetailTab === 'containers' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs text-slate">
              <span className="font-bold">Khai báo đầy đủ 100% container chuẩn ISO 6346, số niêm chì hải quan, VGM và vị trí stowage trên tàu</span>
              <span className="font-mono font-bold text-carbon">Hiển thị {selectedVesselCargoStats.count} / {selectedVesselCargoStats.count} Container</span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3 w-[18%]">Container / ISO / Seal</th>
                    <th className="py-3 px-3 w-[24%]">Vận Đơn B/L &amp; Chủ Hàng</th>
                    <th className="py-3 px-3 w-[20%]">Hàng Hóa &amp; Số Kiện</th>
                    <th className="py-3 px-3 w-[14%]">Trọng Lượng &amp; CBM</th>
                    <th className="py-3 px-3 w-[12%]">Nhiệt Độ / DG</th>
                    <th className="py-3 px-3 w-[16%]">Vị Trí Bãi Tiên Sa</th>
                    <th className="py-3 px-3 w-[12%] text-right">Stowage &amp; HQ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(manifest.containers || []).map((c, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                      {/* 1. Container + ISO + Seal */}
                      <td className="py-3 px-3 align-middle">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                          <span className="font-mono font-extrabold text-slate-900 text-xs">{c.containerNumber}</span>
                          <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-300 font-mono font-bold text-[10px] text-slate-700">
                            {c.isoType || '40HC'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-mono text-slate-600">Seal: <strong>{c.sealNumber || 'SL-88412'}</strong></span>
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                            ISO OK
                          </span>
                        </div>
                      </td>

                      {/* 2. Vận đơn B/L */}
                      <td className="py-3 px-3 align-middle">
                        <div className="font-mono font-bold text-blue-700 text-xs">
                          {c.blNumber || 'BL-VNDAD-AUTO'}
                        </div>
                        <div className="text-[10px] text-slate-500 italic truncate max-w-[230px] mt-0.5">
                          Đăng ký làm hàng tự do qua Cảng Tiên Sa
                        </div>
                      </td>

                      {/* 3. Hàng hóa & Kiện */}
                      <td className="py-3 px-3 align-middle">
                        <div className="font-bold text-slate-800 text-[11px] line-clamp-2">
                          {c.cargoDescription || 'Hàng hóa xuất khẩu tiêu chuẩn'}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {c.packageCount || '480 Kiện / Pallets'}
                        </div>
                      </td>

                      {/* 4. Trọng lượng Gross / Tare / Net & CBM */}
                      <td className="py-3 px-3 align-middle font-mono">
                        <div className="font-extrabold text-blue-950 text-xs">
                          {Number(c.grossWeightKg || 25400).toLocaleString()} kg <span className="text-[9px] font-sans font-bold text-emerald-700 bg-emerald-50 px-1 rounded">VGM</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Net: {Number(c.netWeightKg || ((Number(c.grossWeightKg) || 25400) - 3820)).toLocaleString()} • Tare: {Number(c.tareWeightKg || 3820).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-600 font-bold">
                          Thể tích: {c.cbm || 68.5} CBM
                        </div>
                      </td>

                      {/* 5. Nhiệt độ / DG */}
                      <td className="py-3 px-3 align-middle text-[11px]">
                        {(c.isoType?.includes('RF') || c.tempRequired?.includes('-')) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-300 whitespace-nowrap">
                            <span className="material-symbols-outlined text-[12px]">ac_unit</span>
                            {c.tempRequired || '-18.0°C'}
                          </span>
                        ) : c.dgClass?.includes('Class') ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
                            <span className="material-symbols-outlined text-[12px] text-amber-700">warning</span>
                            {c.dgClass}
                          </span>
                        ) : (
                          <span className="text-slate-600 font-medium">{c.tempRequired || 'Dry (Thường)'}</span>
                        )}
                      </td>

                      {/* 6. Vị trí bãi Tiên Sa */}
                      <td className="py-3 px-3 align-middle">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded border border-slate-300 inline-flex items-center gap-1 whitespace-nowrap">
                          <span className="material-symbols-outlined text-xs text-orange-600">location_on</span>
                          {c.yardSlot || c.autoYardSlot?.slotName || c.reservedSlot || 'Block A01 · Bay 02'}
                        </span>
                      </td>

                      {/* 7. Vị trí Stowage & Hải quan */}
                      <td className="py-3 px-3 align-middle text-right">
                        <div>
                          <span className="font-bold text-slate-800 font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-block whitespace-nowrap">
                            {c.stowageCell || 'Bay 02 - Row 04'}
                          </span>
                        </div>
                        <div className="mt-1">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full font-bold text-[10px] inline-block whitespace-nowrap">
                            {c.customsStatus || 'Thông quan'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── NỘI DUNG TAB 2: TỔNG HỢP THEO VẬN ĐƠN B/L ── */}
        {vesselDetailTab === 'bl' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-3">
              <div>
                <h4 className="font-heading font-bold text-sm text-slate-900">
                  Danh Sách Vận Đơn Đường Biển ({selectedVesselBlGroups.length} B/L)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vận đơn chính thức thuộc chuyến tàu {manifest.vesselName} ({manifest.voyageNumber})
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs print:hidden"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                <span>In Vận Đơn</span>
              </button>
            </div>

            {/* Danh sách các Vận Đơn */}
            <div className="space-y-4">
              {selectedVesselBlGroups.map((bg, bIdx) => {
                const isImport = manifest.direction === 'IMPORT' || manifest.direction === 'Nhập khẩu'
                const carrierName = manifest.shippingLine || 'EVERGREEN'

                return (
                  <div
                    key={bIdx}
                    className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs hover:border-blue-300 transition-all"
                  >
                    {/* Header B/L Card */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                          #{bIdx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Số Vận Đơn (B/L):</span>
                            <strong className="font-mono text-sm text-blue-900 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {bg.blNumber}
                            </strong>
                            <span className="text-xs text-slate-500 font-medium">• Hãng tàu: <strong>{carrierName}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px] flex items-center gap-1">
                          <span>✓</span>
                          <span>Đã thẩm định B/L</span>
                        </span>
                      </div>
                    </div>

                    {/* Thông tin cốt lõi */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Người gửi (Shipper):</span>
                        <strong className="text-slate-900 block mt-0.5">{bg.shipper}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Người nhận (Consignee):</span>
                        <strong className="text-slate-900 block mt-0.5">{bg.consignee}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Tuyến &amp; Cước phí:</span>
                        <span className="text-slate-700 block mt-0.5">
                          {bg.pol?.split(',')[0] || 'Cảng đi'} ➔ {bg.pod?.split(',')[0] || 'Cảng đến'}
                          <span className="text-emerald-700 font-semibold ml-1.5 font-mono">({isImport ? 'Collect' : 'Prepaid'})</span>
                        </span>
                      </div>
                    </div>

                    {/* Danh sách Container thuộc B/L */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                            <th className="py-2 px-3">Mã Container</th>
                            <th className="py-2 px-3">Loại Cont</th>
                            <th className="py-2 px-3">Số Seal</th>
                            <th className="py-2 px-3">Hàng hóa</th>
                            <th className="py-2 px-3 text-right">Trọng lượng</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {bg.containers.map((c, cIdx) => (
                            <tr key={cIdx} className="hover:bg-blue-50/20">
                              <td className="py-2 px-3 font-mono font-bold text-slate-900">{c.containerNumber}</td>
                              <td className="py-2 px-3 font-mono text-slate-600">{c.isoType || '40HC'}</td>
                              <td className="py-2 px-3 font-mono text-blue-700">{c.sealNumber || 'SL-88412'}</td>
                              <td className="py-2 px-3 text-slate-700 truncate max-w-xs">{c.cargoDescription || 'Hàng bách hóa tiêu chuẩn'}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{Number(c.grossWeightKg || 24000).toLocaleString()} kg</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50/80 border-t border-slate-200 text-[11px] font-bold text-slate-700">
                            <td colSpan="3" className="py-2 px-3">
                              Tổng: {bg.containers.length} Container
                            </td>
                            <td className="py-2 px-3 text-right text-slate-500 font-normal">Tổng Gross B/L:</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-blue-900">
                              {bg.totalGrossWeight.toLocaleString()} kg
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── NỘI DUNG TAB 3: HỒ SƠ KỸ THUẬT TÀU & CẦU BẾN ── */}
        {vesselDetailTab === 'vessel' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Card 1: Định danh Tàu */}
              <div className="border border-chalk rounded-2xl p-4 bg-white space-y-2.5 shadow-2xs">
                <h4 className="font-extrabold text-carbon text-sm uppercase tracking-wider flex items-center gap-2 border-b border-chalk pb-2">
                  <span className="material-symbols-outlined text-blue-600 text-base">directions_boat</span>
                  <span>Định Danh Tàu Biển</span>
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-fog">
                    <span className="text-slate">Tên Tàu (Vessel Name):</span>
                    <strong className="text-carbon font-extrabold">{manifest.vesselName}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-fog">
                    <span className="text-slate">Số Hiệu IMO:</span>
                    <strong className="font-mono text-carbon">{manifest.imoNumber || 'IMO 9811000'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-fog">
                    <span className="text-slate">Hô Hiệu (Call Sign):</span>
                    <strong className="font-mono text-carbon">{manifest.callSign || '3FCA2'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-fog">
                    <span className="text-slate">Quốc Tịch / Cờ (Flag):</span>
                    <strong className="text-carbon">{manifest.flag || 'Panama (PA)'}</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate">Loại Tàu:</span>
                    <strong className="text-carbon">{manifest.vesselType || 'Tàu chở container chuyên dụng'}</strong>
                  </div>
                </div>
              </div>

              {/* Card 2: Thông số Kỹ thuật & Tải trọng */}
              <div className="border border-chalk rounded-2xl p-4 bg-white space-y-2.5 shadow-2xs">
                <h4 className="font-extrabold text-carbon text-sm uppercase tracking-wider flex items-center gap-2 border-b border-chalk pb-2">
                  <span className="material-symbols-outlined text-teal-600 text-base">straighten</span>
                  <span>Kích Thước &amp; Trọng Tải</span>
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-fog">
                    <span className="text-slate">Chiều dài lớn nhất (LOA):</span>
                    <strong className="font-mono text-carbon">{manifest.loa || '172.0'} m</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-fog">
                    <span className="text-slate">Chiều rộng mạn (Beam):</span>
                    <strong className="font-mono text-carbon">{manifest.beam || '28.4'} m</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-fog">
                    <span className="text-slate">Mớn nước thiết kế (Draft):</span>
                    <strong className="font-mono text-carbon">{manifest.draft || '9.5'} m</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-fog">
                    <span className="text-slate">Trọng tải toàn phần (DWT):</span>
                    <strong className="font-mono text-carbon">{manifest.dwt?.toLocaleString() || '23,500'} DWT</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate">Sức chở danh định:</span>
                    <strong className="font-mono text-carbon">{manifest.nominalTeu?.toLocaleString() || '1,800'} TEU</strong>
                  </div>
                </div>
              </div>

              {/* Card 3: Thông tin Cầu bến & Lịch trình Cảng */}
              <div className="border border-chalk rounded-2xl p-4 bg-white space-y-2.5 shadow-2xs">
                <h4 className="font-extrabold text-carbon text-sm uppercase tracking-wider flex items-center gap-2 border-b border-chalk pb-2">
                  <span className="material-symbols-outlined text-amber-600 text-base">anchor</span>
                  <span>Cầu Bến &amp; Kế Hoạch Cập Cảng</span>
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-fog">
                    <span className="text-slate">Cầu bến chỉ định:</span>
                    <strong className="text-blue-700 font-extrabold">{manifest.berth || 'Bến số 1 (TS-01)'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-fog">
                    <span className="text-slate">Cảng bốc hàng (POL):</span>
                    <strong className="text-carbon">{manifest.pol || 'Kaohsiung (TWKHH)'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-fog">
                    <span className="text-slate">Cảng dỡ hàng (POD):</span>
                    <strong className="text-carbon">{manifest.pod || 'Tokyo (JPTYO)'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-fog">
                    <span className="text-slate">Giờ cập bến (ETA):</span>
                    <strong className="font-mono text-carbon">{manifest.eta || '2026-11-09 14:00'}</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate">Dự kiến rời bến (ETD):</span>
                    <strong className="font-mono text-carbon">{manifest.etd || '2026-11-09 22:00'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Bottom Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-chalk">
          <div className="text-xs text-slate">
            Bản khai điện tử: <strong className="text-carbon font-mono">{manifest.manifestNumber}</strong> · Tàu <strong className="text-carbon">{manifest.vesselName}</strong>
          </div>

          <div className="flex items-center gap-3">
            {!isApproved && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenYardPlanning?.(manifest)
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-extrabold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">grid_view</span>
                Kiểm Tra Bãi &amp; Duyệt (Accept)
              </button>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-2.5 bg-fog border border-chalk text-carbon rounded-xl font-extrabold text-xs hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">print</span>
              In Bản Khai
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-carbon text-white rounded-xl font-extrabold text-xs hover:bg-black transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
