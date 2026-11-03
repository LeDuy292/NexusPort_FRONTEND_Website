import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Activity,
  Layers
} from 'lucide-react';
import { portSyncApi } from '../../api/portSync.api';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PortSyncMessage } from '../../types/portSync.types';
import { useToast } from '../../hooks/useToast';

export const PortSyncPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: messages, isLoading, refetch } = useQuery({
    queryKey: ['port-sync-messages'],
    queryFn: () => portSyncApi.getMessages(),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => portSyncApi.resendMessage(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['port-sync-messages'] });
      showToast(`Đã gửi lại thành công bản tin ${data.messageType} (${data.referenceNumber})`);
    },
    onError: (err: any) => {
      showToast(err.message || 'Lỗi khi gửi lại bản tin', 'error');
    },
  });

  const failedCount = (messages || []).filter((m) => m.status === 'FAILED').length;
  const successCount = (messages || []).filter((m) => m.status === 'SUCCESS').length;

  const columns: Column<PortSyncMessage>[] = [
    {
      key: 'messageType',
      header: 'Loại Bản Tin Đồng Bộ',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-slate-800 text-xs block font-mono">{row.messageType}</span>
          <span className="text-[11px] text-[#F97316] font-mono block">{row.referenceNumber}</span>
        </div>
      ),
    },
    {
      key: 'direction',
      header: 'Chiều Truyền',
      align: 'center',
      render: (row) =>
        row.direction === 'OUTBOUND' ? (
          <span className="text-[11px] font-semibold text-orange-700 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200">
            Gửi đi
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
            Nhận về
          </span>
        ),
    },
    {
      key: 'payloadSummary',
      header: 'Nội Dung Tóm Tắt',
      className: 'max-w-[280px] text-xs text-slate-700',
      render: (row) => row.payloadSummary || '—',
    },
    {
      key: 'timestamp',
      header: 'Thời Gian',
      sortable: true,
      render: (row) => (
        <span className="text-slate-500 font-mono text-xs flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          {row.timestamp}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng Thái',
      align: 'center',
      render: (row) =>
        row.status === 'SUCCESS' ? (
          <StatusBadge label="Thành công" tone="green" />
        ) : row.status === 'FAILED' ? (
          <StatusBadge label="Lỗi truyền tin" tone="red" />
        ) : (
          <StatusBadge label="Đang chờ" tone="orange" />
        ),
    },
    {
      key: 'errorMessage',
      header: 'Chi Tiết Lỗi',
      className: 'max-w-[240px]',
      render: (row) =>
        row.errorMessage ? (
          <span className="text-[11px] text-rose-700 font-mono bg-rose-50 px-2 py-0.5 rounded border border-rose-200 block truncate" title={row.errorMessage}>
            {row.errorMessage}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">Không có lỗi</span>
        ),
    },
    {
      key: 'action',
      header: 'Thao Tác',
      align: 'right',
      render: (row) =>
        row.status === 'FAILED' ? (
          <button
            disabled={resendMutation.isPending}
            onClick={() => resendMutation.mutate(row.id)}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${resendMutation.isPending ? 'animate-spin' : ''}`} />
            <span>Gửi lại</span>
          </button>
        ) : (
          <span className="text-slate-400 text-xs font-mono">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in text-[#1F2937]">

      {/* ── HEADER ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs text-slate-500 font-medium">
            <span>Hãng tàu</span>
            <span>/</span>
            <span>Kết nối tích hợp</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Hộp thư đồng bộ cảng</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#F97316]" />
            <span>Đồng Bộ Dữ Liệu Cảng Biển</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Giám sát các bản tin dữ liệu trao đổi giữa phần mềm Hãng tàu và hệ thống điều hành cảng biển.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Làm mới</span>
        </button>
      </div>

      {/* ── 3 METRIC MINI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Tổng bản tin</span>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-0.5">
              {(messages || []).length}
            </div>
            <span className="text-[11px] text-slate-400">Phương thức truyền dữ liệu đồng bộ</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Truyền thành công</span>
            <div className="text-2xl font-bold font-mono text-emerald-700 mt-0.5">
              {successCount}
            </div>
            <span className="text-[11px] text-emerald-600">Cổng cảng đã tiếp nhận</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Bản tin gặp lỗi</span>
            <div className="text-2xl font-bold font-mono text-rose-700 mt-0.5">
              {failedCount}
            </div>
            <span className="text-[11px] text-rose-600">Cần thực hiện gửi lại</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── DATA TABLE ── */}
      <div className="saas-card-static bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={messages || []}
          total={(messages || []).length}
          isLoading={isLoading}
          emptyMessage="Chưa có bản tin đồng bộ nào trong phiên hiện tại."
        />
      </div>

    </div>
  );
};

export default PortSyncPage;
