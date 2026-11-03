import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Ship,
  MapPin,
  Building2,
  Boxes,
  Weight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowLeft,
  X,
  Lock,
  PackageCheck
} from 'lucide-react';
import { manifestApi } from '../../api/manifest.api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { useToast } from '../../hooks/useToast';

export const BLDetailPage: React.FC = () => {
  const { blNumber } = useParams<{ blNumber: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [showDOModal, setShowDOModal] = useState(false);
  const [validDays, setValidDays] = useState(7);
  const [emptyDepot, setEmptyDepot] = useState('Depot Tân Cảng Suối Tiên (TP. Thủ Đức)');
  const [freeDetDays, setFreeDetDays] = useState(5);

  const { data: bl, isLoading, isError, refetch } = useQuery({
    queryKey: ['bl-detail', blNumber],
    queryFn: () => manifestApi.getBLDetail(blNumber || ''),
    enabled: !!blNumber,
  });

  const sendNoticeMutation = useMutation({
    mutationFn: () => manifestApi.sendArrivalNotice(blNumber || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bl-detail', blNumber] });
      showToast('Đã gửi thông báo hàng đến kèm biểu phí cho người nhận');
    },
    onError: () => {
      showToast('Không thể gửi giấy báo hàng đến lúc này. Vui lòng thử lại sau.', 'error');
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: () => manifestApi.confirmPayment(blNumber || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bl-detail', blNumber] });
      showToast('Đã xác nhận thanh toán đủ cước & phụ phí. Đủ điều kiện cấp D/O.');
    },
    onError: () => {
      showToast('Không thể xác nhận thanh toán lúc này. Vui lòng thử lại sau.', 'error');
    },
  });

  const issueDOMutation = useMutation({
    mutationFn: () =>
      manifestApi.issueDeliveryOrder(blNumber || '', {
        validUntilDays: validDays,
        emptyReturnDepot: emptyDepot,
        freeDetDays: freeDetDays,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['bl-detail', blNumber] });
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
      showToast(`Đã phát hành Lệnh giao hàng điện tử số ${res.doNumber} & đồng bộ sang Cảng`);
      setShowDOModal(false);
    },
    onError: () => {
      showToast('Không thể cấp lệnh giao hàng lúc này. Vui lòng kiểm tra lại trạng thái cước phí.', 'error');
    },
  });

  if (isLoading) return <LoadingState message="Đang tải dữ liệu chi tiết vận đơn đường biển..." />;
  if (isError || !bl) return <ErrorState message="Không tìm thấy vận đơn" onRetry={refetch} />;

  const statusLabels: Record<string, string> = {
    PENDING_NOTICE: 'Chờ thông báo',
    PENDING_PAYMENT: 'Chờ thanh toán',
    PENDING_DO: 'Chờ cấp lệnh giao hàng',
    DO_ISSUED: 'Đã cấp lệnh giao hàng (D/O)',
    RELEASED: 'Đã giải phóng hàng',
  };

  const blTypeMap: Record<string, string> = {
    ORIGINAL: 'Vận đơn gốc (Original B/L)',
    TELEX_RELEASE: 'Điện thoại giao hàng (Telex Release)',
    SEA_WAYBILL: 'Giấy gửi hàng đường biển (Sea Waybill)',
  };

  const freightTermsMap: Record<string, string> = {
    PREPAID: 'Cước trả trước (Freight Prepaid)',
    COLLECT: 'Cước trả sau (Freight Collect)',
  };

  const totalCharges = (bl.charges || []).reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-6 text-[#1F2937] animate-fade-in pb-10">

      {/* ── TOP HEADER BAR ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <button
            onClick={() => navigate('/import-cargo')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#F97316] font-medium mb-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại danh sách lược khai chuyến tàu</span>
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#F97316]" />
              <span>Vận Đơn Đường Biển: {bl.blNumber}</span>
            </h1>
            <StatusBadge label={statusLabels[bl.status] || bl.status} status={bl.status} />
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              {blTypeMap[bl.blType || 'ORIGINAL'] || 'Vận đơn đường biển'}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
              {freightTermsMap[bl.freightTerms || 'PREPAID'] || 'Cước trả trước'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 self-end md:self-auto">
          {bl.status === 'PENDING_NOTICE' && (
            <button
              disabled={sendNoticeMutation.isPending}
              onClick={() => sendNoticeMutation.mutate()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {sendNoticeMutation.isPending ? 'Đang gửi...' : 'Gửi Thông Báo Hàng Đến'}
            </button>
          )}

          {bl.status === 'PENDING_PAYMENT' && (
            <button
              disabled={confirmPaymentMutation.isPending}
              onClick={() => confirmPaymentMutation.mutate()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {confirmPaymentMutation.isPending ? 'Đang xác nhận...' : 'Xác Nhận Đã Thu Cước'}
            </button>
          )}

          {bl.status === 'PENDING_DO' && (
            <button
              onClick={() => setShowDOModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <PackageCheck className="w-4 h-4" />
              <span>Cấp Lệnh Giao Hàng (eDO)</span>
            </button>
          )}

          {bl.status === 'DO_ISSUED' && (
            <button
              onClick={() => navigate('/delivery-orders')}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Xem Trong Danh Sách Lệnh D/O →</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 3 PARTIES GRID (SHIPPER, CONSIGNEE, NOTIFY PARTY) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Shipper */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 pb-2 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-slate-500" />
            <span>NGƯỜI GỬI HÀNG (SHIPPER)</span>
          </div>
          <div className="text-xs space-y-1">
            <span className="font-semibold text-slate-900 block leading-snug">
              {bl.shipper || 'Fonterra Co-operative Group Ltd'}
            </span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Địa chỉ xuất kho: Khu công nghiệp cảng biển xuất khẩu
            </p>
          </div>
        </div>

        {/* Consignee */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 pb-2 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-[#F97316]" />
            <span>NGƯỜI NHẬN HÀNG (CONSIGNEE)</span>
          </div>
          <div className="text-xs space-y-1">
            <span className="font-semibold text-slate-900 block leading-snug">
              {bl.consignee || bl.consigneeName}
            </span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Mã số thuế: 0300588569 • Pháp nhân đứng tên nhận hàng trên D/O
            </p>
          </div>
        </div>

        {/* Notify Party */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 pb-2 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-sky-600" />
            <span>BÊN ĐƯỢC THÔNG BÁO (NOTIFY PARTY)</span>
          </div>
          <div className="text-xs space-y-1">
            <span className="font-semibold text-slate-900 block leading-snug">
              {bl.notifyParty || 'Cùng Người Nhận Hàng (Same as Consignee)'}
            </span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Bộ phận Tiếp vận / Đại lý Logistics tiếp nhận Giấy báo hàng đến
            </p>
          </div>
        </div>
      </div>

      {/* ── TWO COLUMN DETAILS: ROUTE & CARGO SPECIFICATION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Left: Voyage & Routing */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
            <Ship className="w-4 h-4 text-sky-600" />
            <span>Hành Trình Vận Chuyển & Lịch Tàu</span>
          </h3>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Tàu & Chuyến vận chuyển</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                {bl.vesselName} ({bl.voyageNumber})
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Thời gian đến dự kiến (ETA)</span>
              <span className="font-semibold text-slate-800 font-mono mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {bl.eta}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Cảng bốc hàng (Port of Loading)</span>
              <span className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-orange-500" />
                {bl.pol || 'Cảng xuất xứ quốc tế'}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Cảng dỡ hàng (Port of Discharge)</span>
              <span className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                {bl.pod || 'VNSGN (Cảng Tân Cảng Cát Lái - NexusPort)'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Cargo Specification & Measurements */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-[#F97316]" />
            <span>Quy Cách Hàng Hóa & Kê Khai Đo Lường</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Tên mặt hàng & Mô tả</span>
              <p className="font-semibold text-slate-800 text-[13px] leading-relaxed mt-0.5">
                {bl.cargoDescription || 'Hàng bách hóa tiêu chuẩn đóng thùng'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Mã phân loại HS</span>
                <span className="font-mono font-bold text-slate-800 mt-0.5 block">{bl.hsCode || '—'}</span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Số kiện & Loại kiện</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">
                  {bl.packagesCount?.toLocaleString('vi-VN')} {bl.packageType ? `(${bl.packageType})` : 'kiện'}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Tổng khối lượng / Thể tích</span>
                <span className="font-semibold text-slate-800 mt-0.5 block font-mono">
                  {bl.grossWeightKg?.toLocaleString('vi-VN')} kg • {bl.cbm ? `${bl.cbm} CBM` : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── CONTAINERS UNDER B/L TABLE ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#F97316]" />
              <span>Danh Sách Container Thuộc Vận Đơn ({bl.containers?.length || 0})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi số chì, trọng lượng và trạng thái dỡ bãi / ra cổng thực tế từ Cảng biển
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-200">
            {bl.containerCount} Thùng container
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="p-3">Số Container</th>
                <th className="p-3">Quy cách</th>
                <th className="p-3">Số Chì (Seal)</th>
                <th className="p-3 text-right">Tổng Tải Trọng (kg)</th>
                <th className="p-3">Loại Hàng Khai Báo</th>
                <th className="p-3 text-center">Trạng Thái</th>
                <th className="p-3">Thời Điểm Dỡ Tàu</th>
                <th className="p-3">Thời Điểm Ra Cổng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(bl.containers || []).map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-3 font-bold font-mono text-[#F97316] text-[13px]">
                    {c.containerNumber}
                  </td>
                  <td className="p-3 text-slate-700 font-medium">{c.containerType}</td>
                  <td className="p-3 font-mono text-slate-900 font-medium">{c.sealNumber || '—'}</td>
                  <td className="p-3 text-right font-mono font-bold text-slate-800">
                    {c.weightKg ? c.weightKg.toLocaleString('vi-VN') : '—'}
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {c.cargoType || 'Hàng bách hóa'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {c.status === 'GATE_OUT' ? (
                      <StatusBadge label="Đã ra cổng" tone="green" />
                    ) : c.status === 'DISCHARGED' ? (
                      <StatusBadge label="Đã dỡ bãi" tone="orange" />
                    ) : (
                      <StatusBadge label="Trên tàu" tone="gray" />
                    )}
                  </td>
                  <td className="p-3 text-slate-500 font-mono">{c.dischargedAt || '—'}</td>
                  <td className="p-3 text-slate-500 font-mono">{c.gateOutAt || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CHARGES & INVOICING TABLE ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>Biểu Phí Cước & Lệ Phí Lệnh Giao Hàng D/O</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Điều kiện tiên quyết: Thu đủ 100% các khoản cước và phí mới đủ điều kiện cấp lệnh giao hàng
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-600">
            Tổng cộng:{' '}
            <span className="text-base font-bold text-emerald-600 font-mono ml-1">
              {totalCharges.toLocaleString('vi-VN')} VND
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="p-3">Khoản Mục Thu Phí</th>
                <th className="p-3 text-right">Số Tiền (VND)</th>
                <th className="p-3 text-center">Trạng Thái Thu</th>
                <th className="p-3">Ngày Ghi Nhận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(bl.charges || []).map((ch) => (
                <tr key={ch.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-3 font-semibold text-slate-800">{ch.chargeName}</td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900">
                    {ch.amount.toLocaleString('vi-VN')} {ch.currency}
                  </td>
                  <td className="p-3 text-center">
                    {ch.isPaid ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Đã thanh toán
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        Chưa thanh toán
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-slate-500 font-mono">{ch.paidAt || 'Chưa thu'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: CẤP LỆNH GIAO HÀNG (eDO) CHUẨN NGHIỆP VỤ ── */}
      {showDOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Phát Hành Lệnh Giao Hàng Điện Tử (eDO)
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Vận đơn: <strong className="text-slate-800 font-mono">{bl.blNumber}</strong>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowDOModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Check Requirements */}
            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-800 space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Đủ điều kiện cấp lệnh giao hàng</span>
              </div>
              <p className="text-[11px] text-emerald-700">
                ✓ Khách hàng đã thanh toán 100% cước & phụ phí • Vận đơn không bị lệnh Hold giữ hàng.
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Thời hạn hiệu lực của Lệnh D/O (Số ngày tính từ hôm nay)
                </label>
                <select
                  value={validDays}
                  onChange={(e) => setValidDays(Number(e.target.value))}
                  className="w-full h-9 px-3 border border-slate-200 rounded-xl text-xs bg-slate-50/50 text-slate-800 focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value={5}>5 ngày (Đến {new Date(Date.now() + 5 * 86400000).toLocaleDateString('vi-VN')})</option>
                  <option value={7}>7 ngày (Đến {new Date(Date.now() + 7 * 86400000).toLocaleDateString('vi-VN')} - Tiêu chuẩn)</option>
                  <option value={10}>10 ngày (Đến {new Date(Date.now() + 10 * 86400000).toLocaleDateString('vi-VN')})</option>
                  <option value={14}>14 ngày (Đến {new Date(Date.now() + 14 * 86400000).toLocaleDateString('vi-VN')})</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Chỉ định bãi trả vỏ rỗng (Empty Return Depot)
                </label>
                <input
                  type="text"
                  value={emptyDepot}
                  onChange={(e) => setEmptyDepot(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-xl text-xs bg-slate-50/50 text-slate-800 focus:outline-none focus:border-emerald-500 font-medium"
                  placeholder="Ví dụ: Depot Tân Cảng Suối Tiên..."
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Thời hạn miễn phí lưu vỏ (Free Time DET - Ngày)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={freeDetDays}
                  onChange={(e) => setFreeDetDays(Number(e.target.value))}
                  className="w-full h-9 px-3 border border-slate-200 rounded-xl text-xs bg-slate-50/50 text-slate-800 focus:outline-none focus:border-emerald-500 font-medium"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Sau {freeDetDays} ngày kể từ lúc Gate Out, nếu chưa trả vỏ về depot sẽ bắt đầu tính phí lưu vỏ (DET).
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 space-y-1">
                <span className="font-semibold block text-[11px] text-slate-700">Tóm tắt đối tượng cấp lệnh:</span>
                <div className="text-[11px] space-y-0.5">
                  <div>Người nhận: <strong>{bl.consignee}</strong></div>
                  <div>Chuyến tàu: <strong>{bl.vesselName} ({bl.voyageNumber})</strong></div>
                  <div>Số lượng: <strong>{bl.containerCount} Container</strong> ({bl.containers?.map(c => c.containerNumber).join(', ')})</div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDOModal(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={issueDOMutation.isPending}
                onClick={() => issueDOMutation.mutate()}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <PackageCheck className="w-4 h-4" />
                <span>{issueDOMutation.isPending ? 'Đang cấp lệnh...' : 'Xác Nhận Cấp eDO & Gửi Sang Cảng'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BLDetailPage;
