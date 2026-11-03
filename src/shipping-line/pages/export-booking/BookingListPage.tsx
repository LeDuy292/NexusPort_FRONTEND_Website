import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Filter,
  RotateCcw,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Ship,
  Calendar,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { bookingApi } from '../../api/booking.api';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ExportBooking } from '../../types/booking.types';
import { useUrlFilters } from '../../hooks/useUrlFilters';

const DEFAULT_FILTERS = {
  search: '',
  status: '',
  voyage: '',
  fromDate: '',
  toDate: '',
  page: 1,
  pageSize: 10,
};

export const BookingListPage: React.FC = () => {
  const navigate = useNavigate();
  const { filters, setFilter, resetFilters } = useUrlFilters(DEFAULT_FILTERS);

  const { data, isLoading } = useQuery({
    queryKey: ['export-bookings', filters],
    queryFn: () => bookingApi.getBookings(filters),
  });

  const columns: Column<ExportBooking>[] = [
    {
      key: 'bookingNumber',
      header: 'Số Đặt Chỗ (Booking)',
      sortable: true,
      render: (row) => (
        <span className="font-bold font-mono text-[#F97316] hover:underline flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 opacity-70" />
          {row.bookingNumber}
        </span>
      ),
    },
    {
      key: 'shipperName',
      header: 'Công Ty / Chủ Hàng',
      sortable: true,
      render: (row) => (
        <div className="max-w-[240px]">
          <span className="font-semibold text-slate-800 block truncate">{row.shipperName}</span>
          <span className="text-[11px] text-slate-400">Khách hàng xuất khẩu</span>
        </div>
      ),
    },
    {
      key: 'vesselName',
      header: 'Tàu & Chuyến',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Ship className="w-3.5 h-3.5 text-slate-400" />
          <span>
            <strong className="text-slate-800 font-medium">{row.vesselName}</strong>{' '}
            <span className="text-slate-500 font-mono text-xs">({row.voyageNumber})</span>
          </span>
        </div>
      ),
    },
    {
      key: 'destinationPort',
      header: 'Cảng Đến',
      render: (row) => (
        <span className="text-slate-700 text-xs font-medium">{row.destinationPort}</span>
      ),
    },
    {
      key: 'containerQuantity',
      header: 'Loại & Số Lượng Thùng',
      align: 'center',
      render: (row) => (
        <span className="font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs">
          {row.containerQuantity} x {row.containerType}
        </span>
      ),
    },
    {
      key: 'etd',
      header: 'Ngày Tàu Rời Bến (ETD)',
      sortable: true,
      render: (row) => (
        <span className="text-slate-600 font-mono text-xs">{row.etd}</span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng Thái',
      align: 'center',
      render: (row) => {
        const labels: Record<string, string> = {
          PENDING: 'Chờ duyệt',
          APPROVED: 'Đã duyệt cấp',
          BL_ISSUED: 'Đã cấp vận đơn',
          REJECTED: 'Từ chối',
          CANCELLED: 'Đã hủy',
        };
        return <StatusBadge label={labels[row.status] || row.status} status={row.status} />;
      },
    },
    {
      key: 'action',
      header: 'Thao Tác',
      align: 'right',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/export-bookings/${row.id}`);
          }}
          className="inline-flex items-center gap-1 px-3 py-1 bg-orange-50 hover:bg-orange-100 text-[#F97316] text-xs font-semibold rounded-lg border border-orange-200/80 transition-colors cursor-pointer"
        >
          <span>Xem chi tiết</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  const statusTabs = [
    { label: 'Tất cả', value: '' },
    { label: 'Chờ duyệt', value: 'PENDING' },
    { label: 'Đã duyệt cấp', value: 'APPROVED' },
    { label: 'Đã cấp vận đơn', value: 'BL_ISSUED' },
    { label: 'Từ chối', value: 'REJECTED' },
  ];

  return (
    <div className="space-y-5 animate-fade-in text-[#1F2937]">

      {/* ── HEADER ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs text-slate-500 font-medium">
            <span>Hãng tàu</span>
            <span>/</span>
            <span>Nghiệp vụ xuất khẩu</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Đặt chỗ xuất khẩu</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Quản Lý Yêu Cầu Đặt Chỗ Xuất Khẩu</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-mono">
              {(data as any)?.total ?? (data as any)?.meta?.totalItems ?? (data?.items || []).length} hồ sơ
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Phê duyệt cấp vỏ container rỗng, kiểm soát thời hạn cắt máng, phiếu cân, chi tiết và phát hành vận đơn xuất khẩu.
          </p>
        </div>
      </div>

      {/* ── STATUS TABS ── */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {statusTabs.map((tab) => {
          const isActive = filters.status === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setFilter('status', tab.value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#F97316] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── FILTER TOOLBAR ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            placeholder="Tìm theo số đặt chỗ (Booking), chủ hàng, cảng đến..."
            className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-xl text-xs bg-slate-50/50 text-slate-900 focus:outline-none focus:border-[#F97316] focus:bg-white transition-all"
          />
        </div>

        <select
          value={filters.voyage}
          onChange={(e) => setFilter('voyage', e.target.value)}
          className="h-9 px-3 border border-slate-200 rounded-xl text-xs bg-slate-50/50 text-slate-700 focus:outline-none focus:border-[#F97316] cursor-pointer"
        >
          <option value="">Tất cả chuyến tàu</option>
          <option value="EG-2605W">EVER GLORY (EG-2605W)</option>
          <option value="OC-2612E">ONE CONTINUITY (OC-2612E)</option>
          <option value="MC-2608S">MOL CREATION (MC-2608S)</option>
          <option value="KI-2601W">KMTC INCHEON (KI-2601W)</option>
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.fromDate}
            onChange={(e) => setFilter('fromDate', e.target.value)}
            className="h-9 px-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 text-slate-700 focus:outline-none focus:border-[#F97316]"
            title="Từ ngày"
          />
          <span className="text-slate-400 text-xs">-</span>
          <input
            type="date"
            value={filters.toDate}
            onChange={(e) => setFilter('toDate', e.target.value)}
            className="h-9 px-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 text-slate-700 focus:outline-none focus:border-[#F97316]"
            title="Đến ngày"
          />
        </div>

        <button
          onClick={resetFilters}
          className="h-9 px-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs text-slate-600 font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
          title="Đặt lại bộ lọc"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Đặt lại</span>
        </button>
      </div>

      {/* ── DATA TABLE ── */}
      <div className="saas-card-static bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={data?.items || []}
          total={(data as any)?.total ?? (data as any)?.meta?.totalItems ?? (data?.items || []).length}
          page={filters.page}
          pageSize={filters.pageSize}
          isLoading={isLoading}
          onPageChange={(p: number) => setFilter('page', p)}
          onPageSizeChange={(s: number) => {
            setFilter('pageSize', s);
            setFilter('page', 1);
          }}
          onRowClick={(row) => navigate(`/export-bookings/${row.id}`)}
          emptyMessage="Không tìm thấy yêu cầu đặt chỗ nào phù hợp với bộ lọc."
        />
      </div>

    </div>
  );
};

export default BookingListPage;
