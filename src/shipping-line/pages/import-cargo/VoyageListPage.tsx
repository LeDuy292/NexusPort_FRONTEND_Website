import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { manifestApi } from '../../api/manifest.api';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ImportVoyage } from '../../types/manifest.types';

export const VoyageListPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: voyages, isLoading } = useQuery({
    queryKey: ['import-voyages'],
    queryFn: () => manifestApi.getVoyages(),
  });

  const columns: Column<ImportVoyage>[] = [
    {
      key: 'voyageNumber',
      header: 'Số Chuyến Tàu',
      sortable: true,
      render: (row) => (
        <span className="font-semibold text-brand hover:underline">
          {row.voyageNumber}
        </span>
      ),
    },
    {
      key: 'vesselName',
      header: 'Tên Tàu Vận Chuyển',
      sortable: true,
      className: 'font-medium',
    },
    {
      key: 'eta',
      header: 'Thời Gian Cập Cảng Dự Kiến (ETA)',
      sortable: true,
      className: 'text-[13px] text-content-sub',
    },
    {
      key: 'berthCode',
      header: 'Vị Trí Cầu Bến',
      render: (row) => row.berthCode || 'Chưa gán',
    },
    {
      key: 'totalBL',
      header: 'Số Lượng Vận Đơn',
      align: 'center',
      render: (row) => <span className="font-medium">{row.totalBL}</span>,
    },
    {
      key: 'totalContainers',
      header: 'Tổng Số Thùng Container',
      align: 'center',
      render: (row) => <span className="font-medium">{row.totalContainers}</span>,
    },
    {
      key: 'manifestUploaded',
      header: 'Bản Lược Khai Hàng Hóa',
      align: 'center',
      render: (row) =>
        row.manifestUploaded ? (
          <StatusBadge label="Đã khai báo" tone="green" />
        ) : (
          <StatusBadge label="Chưa nạp tệp" tone="orange" />
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
            navigate(`/import-cargo/manifest/${row.voyageNumber}`);
          }}
          className="text-brand hover:text-brand-hover text-[13px] font-medium"
        >
          Xem lược khai →
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-bold text-content-main">
            Danh Sách Chuyến Tàu Hàng Nhập Khẩu
          </h2>
          <p className="text-[13px] text-content-sub">
            Theo dõi kế hoạch cập cảng và quản lý bản lược khai hàng hóa nhập khẩu
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={voyages || []}
        isLoading={isLoading}
        keyExtractor={(v) => v.id}
        onRowClick={(v) => navigate(`/import-cargo/manifest/${v.voyageNumber}`)}
      />
    </div>
  );
};

