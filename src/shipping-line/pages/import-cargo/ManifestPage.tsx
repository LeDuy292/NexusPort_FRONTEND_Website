import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { manifestApi } from '../../api/manifest.api';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { BillOfLading } from '../../types/manifest.types';
import { useToast } from '../../hooks/useToast';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';

export const ManifestPage: React.FC = () => {
  const { voyageNumber } = useParams<{ voyageNumber: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['manifest', voyageNumber],
    queryFn: () => manifestApi.getVoyageManifest(voyageNumber || ''),
    enabled: !!voyageNumber,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => manifestApi.importManifestCsv(voyageNumber || '', file),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['manifest', voyageNumber] });
      showToast(`Đã nạp thành công ${res.count} vận đơn từ tệp CSV`);
      setUploading(false);
    },
    onError: () => {
      showToast('Không thể nạp tệp CSV lược khai. Vui lòng kiểm tra lại cấu trúc cột trong tệp.', 'error');
      setUploading(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        showToast('Vui lòng chọn tệp định dạng .csv', 'error');
        return;
      }
      setUploading(true);
      uploadMutation.mutate(file);
    }
  };

  if (isLoading) return <LoadingState message="Đang tải bản lược khai hàng hóa..." />;
  if (isError || !data) return <ErrorState message="Lỗi tải dữ liệu bản lược khai" onRetry={refetch} />;

  const { voyage, bls } = data;

  const statusLabels: Record<string, string> = {
    PENDING_NOTICE: 'Chờ thông báo',
    PENDING_PAYMENT: 'Chờ thanh toán',
    PENDING_DO: 'Chờ cấp lệnh giao hàng',
    DO_ISSUED: 'Đã cấp lệnh giao hàng',
    RELEASED: 'Đã giải phóng hàng',
  };

  const columns: Column<BillOfLading>[] = [
    {
      key: 'blNumber',
      header: 'Số Vận Đơn (B/L)',
      sortable: true,
      render: (row) => (
        <span className="font-semibold text-brand hover:underline">
          {row.blNumber}
        </span>
      ),
    },
    {
      key: 'consignee',
      header: 'Người Nhận Hàng (Consignee)',
      sortable: true,
      className: 'font-medium max-w-[260px] truncate',
    },
    {
      key: 'containerCount',
      header: 'Số Thùng Container',
      align: 'center',
      render: (row) => <span className="font-medium">{row.containerCount}</span>,
    },
    {
      key: 'packagesCount',
      header: 'Số Kiện & Trọng Lượng',
      render: (row) => (
        <span className="text-content-sub text-[13px]">
          {row.packagesCount ? `${row.packagesCount.toLocaleString('vi-VN')} kiện` : '—'} •{' '}
          {row.grossWeightKg ? `${row.grossWeightKg.toLocaleString('vi-VN')} kg` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng Thái',
      align: 'center',
      render: (row) => (
        <StatusBadge label={statusLabels[row.status] || row.status} status={row.status} />
      ),
    },
    {
      key: 'action',
      header: 'Thao Tác',
      align: 'right',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/import-cargo/bl/${row.blNumber}`);
          }}
          className="text-brand hover:text-brand-hover text-[13px] font-medium"
        >
          Chi tiết vận đơn →
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border-ui">
        <div>
          <button
            onClick={() => navigate('/import-cargo')}
            className="text-[13px] text-content-sub hover:text-content-main font-medium mb-1 block"
          >
            ← Quay lại danh sách chuyến tàu
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-[18px] font-bold text-content-main">
              Bản lược khai hàng hóa: {voyage.vesselName} ({voyage.voyageNumber})
            </h2>
            <span className="text-[13px] text-content-sub">
              Dự kiến cập cảng: {voyage.eta} • {voyage.berthCode || 'Chưa cập bến'}
            </span>
          </div>
        </div>

        <div>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded bg-brand hover:bg-brand-hover text-white text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            {uploading ? 'Đang nạp tệp CSV...' : 'Nạp dữ liệu từ tệp CSV'}
          </button>
        </div>
      </div>

      {/* Manifest Table */}
      <DataTable
        columns={columns}
        data={bls}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => navigate(`/import-cargo/bl/${row.blNumber}`)}
      />
    </div>
  );
};

