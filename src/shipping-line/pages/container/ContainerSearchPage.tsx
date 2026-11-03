import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Box,
  Clock,
  Calendar,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Calculator,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { containerApi, validateISO6346 } from '../../api/container.api';
import { LoadingState } from '../../components/common/LoadingState';

export const ContainerSearchPage: React.FC = () => {
  const [searchInput, setSearchInput] = useState('TCLU5192834');
  const [activeSearch, setActiveSearch] = useState('TCLU5192834');
  const [validationError, setValidationError] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['container-lookup', activeSearch],
    queryFn: () => containerApi.lookup(activeSearch),
    enabled: !!activeSearch && !validationError,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchInput.trim().toUpperCase();
    const val = validateISO6346(clean);
    if (!val.isValid) {
      setValidationError(val.message || 'Số container không hợp lệ.');
      return;
    }
    setValidationError('');
    setActiveSearch(clean);
  };

  const sampleContainers = ['TCLU5192834', 'EMCU9284710', 'MSCU8812490'];

  return (
    <div className="space-y-6 animate-fade-in text-[#1F2937]">

      {/* ── SEARCH HERO CARD ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs text-slate-500 font-medium">
            <span>Hãng tàu</span>
            <span>/</span>
            <span>Quản lý thiết bị</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Tra cứu container & Biểu phí</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Box className="w-5 h-5 text-[#F97316]" />
            <span>Tra Cứu Vòng Đời & Tính Phí Lưu Bãi / Vỏ (DEM/DET)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Xác thực số container theo chuẩn ISO 6346 quốc tế, truy xuất dòng sự kiện cảng và tự động tính cước lưu bãi / lưu vỏ lũy tiến.
          </p>
        </div>

        <form onSubmit={handleSearch} className="max-w-xl">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  if (validationError) setValidationError('');
                }}
                placeholder="Nhập 4 chữ cái + 7 số (ví dụ: TCLU5192834)..."
                className={`w-full h-10 pl-10 pr-3 border rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-all outline-none ${
                  validationError
                    ? 'border-rose-400 bg-rose-50/40 text-rose-800'
                    : 'border-slate-200 bg-slate-50/50 text-slate-900 focus:border-[#F97316] focus:bg-white shadow-2xs'
                }`}
              />
            </div>
            <button
              type="submit"
              className="h-10 px-5 bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Tra Cứu</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {validationError && (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium mt-2">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Quick suggestions */}
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
            <span className="text-[11px]">Gợi ý tra cứu nhanh:</span>
            {sampleContainers.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => {
                  setSearchInput(c);
                  setValidationError('');
                  setActiveSearch(c);
                }}
                className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-[#F97316] border border-slate-200 transition-colors"
              >
                {c}
              </button>
            ))}
          </div>
        </form>
      </div>

      {isLoading && <LoadingState message="Đang truy xuất dữ liệu container từ cơ sở dữ liệu cảng..." />}

      {isError && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block text-sm">Chưa có thông tin container</strong>
            <span className="text-slate-600 mt-0.5 block">
              Số container chưa có lịch sử làm hàng tại cảng hoặc chưa phát sinh nghiệp vụ. Vui lòng kiểm tra lại số container theo chuẩn ISO 6346 hoặc chọn số gợi ý phía trên.
            </span>
          </div>
        </div>
      )}

      {data && (
        <div className="space-y-6">

          {/* ── CONTAINER SPECIFICATION & CURRENT STATUS ── */}
          <div className="saas-card-static bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
                  <Box className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                      {data.containerNumber}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-xs font-semibold border border-slate-200">
                      {data.containerType}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">Tiêu chuẩn ISO 6346: Hợp lệ ✓</span>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{data.status}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[11px] text-slate-500 block">Vị trí hiện tại</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#F97316]" />
                  {data.currentLocation}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[11px] text-slate-500 block">Số chì niêm phong (Seal)</span>
                <span className="font-bold font-mono text-slate-800 text-sm mt-0.5 block flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  {data.sealNumber}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[11px] text-slate-500 block">Khối lượng toàn bộ (VGM)</span>
                <span className="font-bold font-mono text-slate-800 text-sm mt-0.5 block">
                  {data.weightKg ? `${data.weightKg.toLocaleString('vi-VN')} kg` : '28,450 kg'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[11px] text-slate-500 block">Chuyến tàu vận chuyển</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">
                  {data.vesselName || 'EVER ENVOY (EE-2610N)'}
                </span>
              </div>
            </div>
          </div>

          {/* ── 2 COLUMNS: TIMELINE & DEM/DET CALCULATION ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Left Column (5 cols): Events Timeline */}
            <div className="lg:col-span-5 saas-card-static bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#F97316]" />
                  Dòng Thời Gian Sự Kiện Cảng
                </h3>
                <span className="text-xs text-slate-400 font-mono">{(data.events || []).length} mốc</span>
              </div>

              <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {(data.events || []).map((ev: any, idx: number) => (
                  <div key={idx} className="relative group">
                    <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-[#F97316] group-hover:scale-125 transition-transform" />
                    <div>
                      <span className="font-semibold text-slate-800 text-xs block">
                        {ev.eventType}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {ev.timestamp} • {ev.location}
                      </span>
                      {ev.notes && (
                        <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
                          {ev.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column (7 cols): DEM/DET Tariff Breakdown */}
            <div className="lg:col-span-7 saas-card-static bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-[#F97316]" />
                    Bảng Tính Cước Lưu Bãi & Lưu Vỏ (DEM / DET)
                  </h3>
                  <span className="text-xs text-slate-500">Biểu phí lũy tiến theo số ngày miễn phí quy định</span>
                </div>

                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 font-mono">
                  {data.demDet?.freeDays || 7} Ngày miễn phí
                </span>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 block">Số ngày thực tế</span>
                  <strong className="text-base font-extrabold text-slate-900 font-mono">
                    {data.demDet?.totalDays || 12} ngày
                  </strong>
                </div>
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
                  <span className="text-[11px] text-emerald-800 block">Số ngày miễn phí</span>
                  <strong className="text-base font-extrabold text-emerald-700 font-mono">
                    {data.demDet?.freeDays || 7} ngày
                  </strong>
                </div>
                <div className="p-3 bg-orange-50/60 rounded-xl border border-orange-200/80">
                  <span className="text-[11px] text-orange-800 block">Số ngày tính cước</span>
                  <strong className="text-base font-extrabold text-[#F97316] font-mono">
                    {(data.demDet?.totalDays || 12) - (data.demDet?.freeDays || 7)} ngày
                  </strong>
                </div>
              </div>

              {/* Tariff Breakdown Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-3">Bậc tính cước</th>
                      <th className="py-2.5 px-3">Khoảng ngày</th>
                      <th className="py-2.5 px-3 text-right">Đơn giá / ngày</th>
                      <th className="py-2.5 px-3 text-center">Số ngày</th>
                      <th className="py-2.5 px-3 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {(data.demDet?.tiers || [
                      { tierName: 'Thời gian miễn phí (Free time)', fromDay: 1, toDay: 5, ratePerDay: 0, daysCount: 5, subTotal: 0 },
                      { tierName: 'Bậc 1 (Tính phí lưu)', fromDay: 6, toDay: 9, ratePerDay: 500000, daysCount: 4, subTotal: 2000000 },
                    ]).map((t: any, idx: number) => {
                      const tierName = t.tierName || t.tier || `Bậc ${idx + 1}`;
                      const range = t.range || (t.fromDay !== undefined && t.toDay !== undefined ? `Ngày ${t.fromDay} - ${t.toDay}` : t.fromDay !== undefined ? `Từ ngày ${t.fromDay}` : '—');
                      const rate = Number(t.ratePerDay ?? t.rate ?? 0);
                      const days = Number(t.daysCount ?? t.days ?? 0);
                      const total = Number(t.subTotal ?? t.total ?? (rate * days));

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-sans font-medium text-slate-800">{tierName}</td>
                          <td className="py-2.5 px-3 text-slate-500">{range}</td>
                          <td className="py-2.5 px-3 text-right text-slate-700">
                            {rate === 0 ? 'Miễn phí' : `${rate.toLocaleString('vi-VN')} đ`}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-800">{days}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {total === 0 ? '0 đ' : `${total.toLocaleString('vi-VN')} đ`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total Calculation Highlight */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500 to-[#EA580C] text-white flex justify-between items-center shadow-sm">
                <div>
                  <span className="text-xs uppercase font-medium tracking-wider text-orange-100 block">
                    TỔNG CƯỚC LƯU BÃI & LƯU VỎ TẠM TÍNH
                  </span>
                  <span className="text-[11px] text-orange-200">Chưa bao gồm thuế GTGT (VAT) 8%</span>
                </div>
                <div className="text-2xl font-black font-mono tracking-tight">
                  {Number(data.demDet?.totalAmount ?? 0).toLocaleString('vi-VN')} VNĐ
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
};

export default ContainerSearchPage;
