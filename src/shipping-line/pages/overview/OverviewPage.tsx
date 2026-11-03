import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Clock,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  Ship,
  ShieldAlert,
  CreditCard,
  LayoutGrid,
  FilePlus,
  ShieldCheck,
  ClipboardCheck,
  Megaphone,
  Package
} from 'lucide-react';
import { bookingApi } from '../../api/booking.api';
import { manifestApi } from '../../api/manifest.api';
import { deliveryOrderApi } from '../../api/deliveryOrder.api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';

const ShippingContainerIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6 text-[#F97316]' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="1.5" />
    <line x1="6" y1="6" x2="6" y2="18" />
    <line x1="10" y1="6" x2="10" y2="18" />
    <line x1="14" y1="6" x2="14" y2="18" />
    <line x1="18" y1="6" x2="18" y2="18" />
  </svg>
);

const PortCraneIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6 text-blue-600' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 22V6l6-4h4l6 4v16" />
    <path d="M4 10h16" />
    <path d="M12 10v4" />
    <rect x="9" y="14" width="6" height="4" rx="0.5" />
  </svg>
);

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();

  const {
    data: bookingsData,
    isLoading: loadingBookings,
    refetch: refetchBookings
  } = useQuery({
    queryKey: ['overview-bookings'],
    queryFn: () => bookingApi.getBookings({ pageSize: 50 }),
  });

  const {
    data: manifestData,
    isLoading: loadingManifest,
    refetch: refetchManifest
  } = useQuery({
    queryKey: ['overview-manifest'],
    queryFn: () => manifestApi.getVoyageManifest('EE-2610N'),
  });

  const {
    data: doData,
    isLoading: loadingDO,
  } = useQuery({
    queryKey: ['overview-do'],
    queryFn: () => deliveryOrderApi.getDeliveryOrders(),
  });

  const pendingBookings = (bookingsData?.items || []).filter((b) => b.status === 'PENDING');
  const approvedBookings = (bookingsData?.items || []).filter((b) => b.status === 'APPROVED');
  const pendingDOBLs = (manifestData?.bls || []).filter((bl) => bl.status === 'PENDING_DO');
  const holdDOs = (doData || []).filter((d) => d.status === 'HOLD');
  const activeDOs = (doData || []).filter((d) => d.status === 'ACTIVE');

  const isLoading = loadingBookings || loadingManifest || loadingDO;

  if (isLoading && !bookingsData) {
    return <LoadingState message="Đang kết nối hệ thống Hãng tàu..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in text-[#1F2937]">

      {/* ── TOP HERO HEADER CARD ── */}
      <div className="relative overflow-hidden bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-gradient-to-br from-orange-100/60 via-amber-50/40 to-transparent rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F97316]">
              <span className="flex h-2 w-2 rounded-full bg-[#F97316] animate-ping"></span>
              <span className="uppercase tracking-wider">Hệ Thống Cảng Biển NexusPort</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 font-normal">Cổng Tác Nghiệp Hãng Tàu</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>Tổng Quan Nghiệp Vụ Hãng Tàu</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 font-medium">
                Dữ liệu thời gian thực
              </span>
            </h1>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Theo dõi điều hành dòng hàng xuất khẩu, nạp bản lược khai hàng hóa, cấp lệnh giao hàng điện tử (D/O) và đồng bộ dữ liệu cảng thời gian thực.
            </p>
          </div>

          {/* Quick controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => navigate('/export-bookings')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <span>Xem danh sách đặt chỗ</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 4 PRIMARY KPI METRIC CARDS WITH HOVER LIFT & ANIMATION ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Card 1: Booking chờ duyệt */}
        <div
          onClick={() => navigate('/export-bookings?status=PENDING')}
          className="saas-card p-5 cursor-pointer group relative overflow-hidden animate-fade-in-up delay-1"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-[#F97316]"></div>
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Đặt Chỗ Chờ Duyệt</span>
              <div className="text-3xl font-extrabold text-slate-900 font-mono mt-1 group-hover:text-[#F97316] transition-colors">
                {pendingBookings.length}
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full mt-2 border border-orange-200/60">
                <Clock className="w-3 h-3" />
                Cần thẩm định & cấp chỗ
              </span>
            </div>
            <div className="stat-icon-wrapper w-11 h-11 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 group-hover:text-[#F97316] font-medium">
            <span>Duyệt yêu cầu xuất khẩu</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        {/* Card 2: B/L chờ cấp D/O */}
        <div
          onClick={() => navigate('/import-cargo')}
          className="saas-card p-5 cursor-pointer group relative overflow-hidden animate-fade-in-up delay-2"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-blue-500"></div>
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Vận Đơn Chờ Cấp Lệnh</span>
              <div className="text-3xl font-extrabold text-slate-900 font-mono mt-1 group-hover:text-sky-600 transition-colors">
                {pendingDOBLs.length}
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full mt-2 border border-sky-200/60">
                <CheckCircle2 className="w-3 h-3 text-sky-600" />
                Đã thanh toán cước & phí
              </span>
            </div>
            <div className="stat-icon-wrapper w-11 h-11 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 group-hover:text-sky-600 font-medium">
            <span>Phát hành lệnh nhận hàng</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        {/* Card 3: D/O đang giữ (Hold) */}
        <div
          onClick={() => navigate('/delivery-orders?status=HOLD')}
          className="saas-card p-5 cursor-pointer group relative overflow-hidden animate-fade-in-up delay-3"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-500"></div>
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Lệnh Giao Hàng Tạm Giữ</span>
              <div className="text-3xl font-extrabold text-amber-700 font-mono mt-1">
                {holdDOs.length}
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full mt-2 border border-amber-200/60">
                <ShieldAlert className="w-3 h-3 text-amber-600" />
                Kiểm tra chuyên ngành
              </span>
            </div>
            <div className="stat-icon-wrapper w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 group-hover:text-amber-700 font-medium">
            <span>Quản lý trạng thái lệnh giao</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        {/* Card 4: Lệnh Giao Hàng Hiệu Lực */}
        <div
          onClick={() => navigate('/delivery-orders?status=ACTIVE')}
          className="saas-card p-5 cursor-pointer group relative overflow-hidden animate-fade-in-up delay-4"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Lệnh Giao Hàng Hiệu Lực</span>
              <div className="text-3xl font-extrabold text-emerald-700 font-mono mt-1">
                {activeDOs.length}
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-2 border border-emerald-200/60">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Sẵn sàng giao container
              </span>
            </div>
            <div className="stat-icon-wrapper w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 group-hover:text-emerald-700 font-medium">
            <span>Xem lệnh đang có hiệu lực</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

      </div>

      {/* ── SƠ ĐỒ QUY TRÌNH TÁC NGHIỆP HÃNG TÀU (Theo thiết kế mẫu) ── */}
      <div className="space-y-4 pt-1">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-2.5 h-8 bg-[#F97316] rounded-full shrink-0 mt-0.5"></div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                Sơ Đồ Quy Trình Tác Nghiệp Hãng Tàu
              </h2>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                Quy trình kết nối tự động giữa Đơn vị giao nhận, Hãng tàu và Cảng biển
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50/90 border border-blue-200/70 text-blue-700 text-xs font-semibold shadow-2xs self-start sm:self-auto">
            <LayoutGrid className="w-4 h-4 text-blue-600" />
            <span>2 Luồng nghiệp vụ</span>
          </div>
        </div>

        {/* 2 Parallel Process Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ── CARD 1: QUY TRÌNH XUẤT KHẨU ── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-orange-100">
                <div className="flex items-center gap-2.5">
                  <ShippingContainerIcon className="w-6 h-6 text-[#F97316]" />
                  <h3 className="font-bold text-sm md:text-base text-slate-800 tracking-wide uppercase">
                    QUY TRÌNH XUẤT KHẨU
                  </h3>
                </div>
                <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-orange-50 border border-orange-200/80 text-orange-600 text-xs font-semibold">
                  <span>★ 4 Mốc cốt lõi</span>
                </div>
              </div>

              {/* 4 Step Items */}
              <div className="mt-6 flex items-center justify-between gap-1 sm:gap-2">

                {/* Step 01 */}
                <div
                  onClick={() => navigate('/export-bookings?status=PENDING')}
                  className="flex-1 flex flex-col items-center cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-full bg-[#F97316] text-white text-[11px] font-bold flex items-center justify-center shadow-xs mx-auto -mb-3 relative z-10 transition-transform group-hover:scale-110">
                    01
                  </div>
                  <div className="w-full bg-white rounded-2xl border border-slate-200/90 group-hover:border-orange-300 shadow-2xs p-2.5 sm:p-3 pt-5 flex flex-col items-center justify-between text-center min-h-[148px] transition-all group-hover:shadow-sm">
                    <div className="flex flex-col items-center">
                      <FilePlus className="w-6 h-6 text-slate-700 stroke-[1.8] group-hover:text-[#F97316] transition-colors" />
                      <span className="font-bold text-slate-900 text-xs mt-2 leading-tight">Nhận YC</span>
                      <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">Đặt chỗ</span>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF7ED] text-[#EA580C] border border-[#FFEDD5] text-[10px] font-semibold mt-2 whitespace-nowrap">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{pendingBookings.length > 0 ? `${pendingBookings.length} chờ` : '2 chờ'}</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <span className="text-slate-300 text-base font-medium select-none shrink-0 px-0.5">→</span>

                {/* Step 02 */}
                <div
                  onClick={() => navigate('/export-bookings?status=APPROVED')}
                  className="flex-1 flex flex-col items-center cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-full bg-[#F97316] text-white text-[11px] font-bold flex items-center justify-center shadow-xs mx-auto -mb-3 relative z-10 transition-transform group-hover:scale-110">
                    02
                  </div>
                  <div className="w-full bg-white rounded-2xl border border-slate-200/90 group-hover:border-orange-300 shadow-2xs p-2.5 sm:p-3 pt-5 flex flex-col items-center justify-between text-center min-h-[148px] transition-all group-hover:shadow-sm">
                    <div className="flex flex-col items-center">
                      <ShieldCheck className="w-6 h-6 text-slate-700 stroke-[1.8] group-hover:text-[#F97316] transition-colors" />
                      <span className="font-bold text-slate-900 text-xs mt-2 leading-tight">Duyệt Cấp</span>
                      <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">Cấp vỏ & Chỗ</span>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] border border-[#D1FAE5] text-[10px] font-semibold mt-2 whitespace-nowrap">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>{approvedBookings.length > 0 ? `${approvedBookings.length} xong` : '1 xong'}</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <span className="text-slate-300 text-base font-medium select-none shrink-0 px-0.5">→</span>

                {/* Step 03 */}
                <div
                  onClick={() => navigate('/vgm-manifest')}
                  className="flex-1 flex flex-col items-center cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-full bg-[#F97316] text-white text-[11px] font-bold flex items-center justify-center shadow-xs mx-auto -mb-3 relative z-10 transition-transform group-hover:scale-110">
                    03
                  </div>
                  <div className="w-full bg-white rounded-2xl border border-slate-200/90 group-hover:border-orange-300 shadow-2xs p-2.5 sm:p-3 pt-5 flex flex-col items-center justify-between text-center min-h-[148px] transition-all group-hover:shadow-sm">
                    <div className="flex flex-col items-center">
                      <ClipboardCheck className="w-6 h-6 text-slate-700 stroke-[1.8] group-hover:text-[#F97316] transition-colors" />
                      <span className="font-bold text-slate-900 text-xs mt-2 leading-tight">Khai Báo</span>
                      <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">Phiếu cân / Vỏ</span>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F0F9FF] text-[#0284C7] border border-[#E0F2FE] text-[10px] font-semibold mt-2 whitespace-nowrap">
                      <Clock className="w-2.5 h-2.5" />
                      <span>Trước hạn chót</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <span className="text-slate-300 text-base font-medium select-none shrink-0 px-0.5">→</span>

                {/* Step 04 */}
                <div
                  onClick={() => navigate('/export-tracking')}
                  className="flex-1 flex flex-col items-center cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-full bg-[#F97316] text-white text-[11px] font-bold flex items-center justify-center shadow-xs mx-auto -mb-3 relative z-10 transition-transform group-hover:scale-110">
                    04
                  </div>
                  <div className="w-full bg-white rounded-2xl border border-slate-200/90 group-hover:border-orange-300 shadow-2xs p-2.5 sm:p-3 pt-5 flex flex-col items-center justify-between text-center min-h-[148px] transition-all group-hover:shadow-sm">
                    <div className="flex flex-col items-center">
                      <Ship className="w-6 h-6 text-slate-700 stroke-[1.8] group-hover:text-[#F97316] transition-colors" />
                      <span className="font-bold text-slate-900 text-xs mt-2 leading-tight">Xếp Tàu</span>
                      <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">Cấp vận đơn</span>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] border border-[#D1FAE5] text-[10px] font-semibold mt-2 whitespace-nowrap">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>Đã xếp tàu</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* ── CARD 2: QUY TRÌNH NHẬP KHẨU ── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-blue-100">
                <div className="flex items-center gap-2.5">
                  <PortCraneIcon className="w-6 h-6 text-blue-600" />
                  <h3 className="font-bold text-sm md:text-base text-slate-800 tracking-wide uppercase">
                    QUY TRÌNH NHẬP KHẨU
                  </h3>
                </div>
                <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold">
                  <span>★ 4 Mốc cốt lõi</span>
                </div>
              </div>

              {/* 4 Step Items */}
              <div className="mt-6 flex items-center justify-between gap-1 sm:gap-2">

                {/* Step 01 */}
                <div
                  onClick={() => navigate('/import-cargo')}
                  className="flex-1 flex flex-col items-center cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shadow-xs mx-auto -mb-3 relative z-10 transition-transform group-hover:scale-110">
                    01
                  </div>
                  <div className="w-full bg-white rounded-2xl border border-slate-200/90 group-hover:border-blue-300 shadow-2xs p-2.5 sm:p-3 pt-5 flex flex-col items-center justify-between text-center min-h-[148px] transition-all group-hover:shadow-sm">
                    <div className="flex flex-col items-center">
                      <Ship className="w-6 h-6 text-slate-700 stroke-[1.8] group-hover:text-blue-600 transition-colors" />
                      <span className="font-bold text-slate-900 text-xs mt-2 leading-tight">Tàu đến</span>
                      <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">Lược khai</span>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE] text-[10px] font-semibold mt-2 whitespace-nowrap">
                      <FileText className="w-2.5 h-2.5" />
                      <span>Tệp dữ liệu</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <span className="text-slate-300 text-base font-medium select-none shrink-0 px-0.5">→</span>

                {/* Step 02 */}
                <div
                  onClick={() => navigate('/import-cargo')}
                  className="flex-1 flex flex-col items-center cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shadow-xs mx-auto -mb-3 relative z-10 transition-transform group-hover:scale-110">
                    02
                  </div>
                  <div className="w-full bg-white rounded-2xl border border-slate-200/90 group-hover:border-blue-300 shadow-2xs p-2.5 sm:p-3 pt-5 flex flex-col items-center justify-between text-center min-h-[148px] transition-all group-hover:shadow-sm">
                    <div className="flex flex-col items-center">
                      <Megaphone className="w-6 h-6 text-slate-700 stroke-[1.8] group-hover:text-blue-600 transition-colors" />
                      <span className="font-bold text-slate-900 text-xs mt-2 leading-tight">Thông Báo</span>
                      <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">Báo Hàng Đến</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-normal mt-2 leading-tight whitespace-nowrap">
                      Kèm Biểu Phí
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <span className="text-slate-300 text-base font-medium select-none shrink-0 px-0.5">→</span>

                {/* Step 03 */}
                <div
                  onClick={() => navigate('/import-cargo')}
                  className="flex-1 flex flex-col items-center cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shadow-xs mx-auto -mb-3 relative z-10 transition-transform group-hover:scale-110">
                    03
                  </div>
                  <div className="w-full bg-white rounded-2xl border border-slate-200/90 group-hover:border-blue-300 shadow-2xs p-2.5 sm:p-3 pt-5 flex flex-col items-center justify-between text-center min-h-[148px] transition-all group-hover:shadow-sm">
                    <div className="flex flex-col items-center">
                      <CreditCard className="w-6 h-6 text-slate-700 stroke-[1.8] group-hover:text-blue-600 transition-colors" />
                      <span className="font-bold text-slate-900 text-xs mt-2 leading-tight">Thanh Toán</span>
                      <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">Xác Nhận Cước</span>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] border border-[#D1FAE5] text-[10px] font-semibold mt-2 whitespace-nowrap">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>Đã Thu Cước</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <span className="text-slate-300 text-base font-medium select-none shrink-0 px-0.5">→</span>

                {/* Step 04 */}
                <div
                  onClick={() => navigate('/delivery-orders')}
                  className="flex-1 flex flex-col items-center cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shadow-xs mx-auto -mb-3 relative z-10 transition-transform group-hover:scale-110">
                    04
                  </div>
                  <div className="w-full bg-white rounded-2xl border border-slate-200/90 group-hover:border-blue-300 shadow-2xs p-2.5 sm:p-3 pt-5 flex flex-col items-center justify-between text-center min-h-[148px] transition-all group-hover:shadow-sm">
                    <div className="flex flex-col items-center">
                      <Package className="w-6 h-6 text-slate-700 stroke-[1.8] group-hover:text-blue-600 transition-colors" />
                      <span className="font-bold text-slate-900 text-xs mt-2 leading-tight">Lệnh Giao</span>
                      <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">Cấp lệnh giao</span>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF7ED] text-[#D97706] border border-[#FED7AA] text-[10px] font-semibold mt-2 whitespace-nowrap">
                      <Package className="w-2.5 h-2.5" />
                      <span>Nhận hàng bãi</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── TWO ACTIONABLE LIST TABLES (BOOKINGS & BLs) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Table 1: Booking chờ duyệt */}
        <div className="saas-card-static bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-orange-50/40 to-transparent">
              <div>
                <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#F97316]" />
                  Yêu Cầu Đặt Chỗ Chờ Duyệt
                </h2>
                <span className="text-xs text-slate-500">Cần xác nhận cấp vỏ và kích hoạt các hạn chót</span>
              </div>
              <Link
                to="/export-bookings?status=PENDING"
                className="inline-flex items-center gap-1 text-xs text-[#F97316] hover:text-[#EA580C] font-semibold transition-colors"
              >
                <span>Xem tất cả</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {pendingBookings.slice(0, 5).map((b) => (
                <div
                  key={b.id}
                  onClick={() => navigate(`/export-bookings/${b.id}`)}
                  className="table-row-hover p-4 cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono text-[#F97316] text-sm hover:underline">
                        {b.bookingNumber}
                      </span>
                      <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                        {b.containerQuantity} x {b.containerType}
                      </span>
                    </div>
                    <div className="text-slate-600 text-xs font-medium">
                      {b.shipperName}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span>Cảng đến: <strong>{b.destinationPort}</strong></span>
                      <span>•</span>
                      <span>Tàu: {b.vesselName}</span>
                    </div>
                  </div>

                  <div className="text-right space-y-1.5 shrink-0 pl-3">
                    <StatusBadge label="Chờ duyệt" tone="gray" />
                    <div className="text-[11px] text-slate-500 font-mono">
                      Rời cảng: {b.etd}
                    </div>
                  </div>
                </div>
              ))}

              {pendingBookings.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                  Không có yêu cầu đặt chỗ nào đang chờ duyệt.
                </div>
              )}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/60 border-t border-slate-100 text-center">
            <Link
              to="/export-bookings"
              className="text-xs text-slate-600 hover:text-[#F97316] font-medium transition-colors"
            >
              Mở trang Quản lý Đặt Chỗ Xuất Khẩu →
            </Link>
          </div>
        </div>

        {/* Table 2: BL chờ cấp D/O */}
        <div className="saas-card-static bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-sky-50/40 to-transparent">
              <div>
                <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-sky-600" />
                  Vận Đơn Đường Biển Chờ Cấp Lệnh Giao Hàng
                </h2>
                <span className="text-xs text-slate-500">Khách hàng đã nộp đủ cước và phí lệnh giao hàng</span>
              </div>
              <Link
                to="/import-cargo"
                className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-semibold transition-colors"
              >
                <span>Xem tất cả</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {pendingDOBLs.slice(0, 5).map((bl) => (
                <div
                  key={bl.blNumber}
                  onClick={() => navigate(`/import-cargo/bl/${bl.blNumber}`)}
                  className="table-row-hover p-4 cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono text-sky-700 text-sm hover:underline">
                        {bl.blNumber}
                      </span>
                      <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                        {bl.containerCount || bl.containersCount || 0} Thùng container
                      </span>
                    </div>
                    <div className="text-slate-600 text-xs font-medium">
                      Người nhận: {bl.consignee || bl.consigneeName}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Chuyến tàu: <strong>{manifestData?.voyage?.vesselName || bl.vesselName || 'EVER ENVOY'}</strong> ({manifestData?.voyage?.voyageNumber || bl.voyageNumber || 'EE-2610N'})
                    </div>
                  </div>

                  <div className="text-right space-y-1.5 shrink-0 pl-3">
                    <StatusBadge label="Chờ cấp lệnh giao hàng" tone="orange" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/import-cargo/bl/${bl.blNumber}`);
                      }}
                      className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold text-[11px] rounded-lg border border-sky-200 transition-colors cursor-pointer"
                    >
                      Cấp lệnh ngay
                    </button>
                  </div>
                </div>
              ))}

              {pendingDOBLs.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                  Tất cả vận đơn đã được cấp lệnh giao hàng đầy đủ.
                </div>
              )}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/60 border-t border-slate-100 text-center">
            <Link
              to="/import-cargo"
              className="text-xs text-slate-600 hover:text-sky-600 font-medium transition-colors"
            >
              Mở trang Quản lý Hàng Nhập Khẩu & Lược Khai →
            </Link>
          </div>
        </div>

      </div>

    </div>
  );
};

export default OverviewPage;
