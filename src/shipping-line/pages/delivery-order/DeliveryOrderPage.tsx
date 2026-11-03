import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Search,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Lock,
  Unlock,
  ChevronRight,
  Filter,
  X,
  Building2,
  Ship,
  MapPin,
  Boxes,
  Printer
} from 'lucide-react';
import { deliveryOrderApi } from '../../api/deliveryOrder.api';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { DeliveryOrder } from '../../types/deliveryOrder.types';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useToast } from '../../hooks/useToast';

const DEFAULT_FILTERS = {
  search: '',
  status: '',
  page: 1,
  pageSize: 10,
};

export const DeliveryOrderPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { filters, setFilter, resetFilters } = useUrlFilters(DEFAULT_FILTERS);

  const [selectedDO, setSelectedDO] = useState<DeliveryOrder | null>(null);
  const [actionType, setActionType] = useState<'HOLD' | 'RELEASE' | 'CANCEL' | 'VIEW' | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['delivery-orders', filters],
    queryFn: () => deliveryOrderApi.getDeliveryOrders(filters),
  });

  const holdMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      deliveryOrderApi.holdDO(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
      showToast('Đã chuyển lệnh giao hàng sang trạng thái Tạm giữ');
      setActionType(null);
      setSelectedDO(null);
    },
    onError: () => {
      showToast('Không thể tạm giữ lệnh giao hàng lúc này. Vui lòng thử lại sau.', 'error');
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) => deliveryOrderApi.releaseDO(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
      showToast('Đã giải phóng lệnh giao hàng, cho phép nhận hàng');
      setActionType(null);
      setSelectedDO(null);
    },
    onError: () => {
      showToast('Không thể giải phóng lệnh giao hàng lúc này. Vui lòng thử lại sau.', 'error');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      deliveryOrderApi.cancelDO(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
      showToast('Đã hủy lệnh giao hàng thành công');
      setActionType(null);
      setSelectedDO(null);
    },
    onError: () => {
      showToast('Không thể hủy lệnh giao hàng. Vui lòng kiểm tra lại quyền hạn hoặc trạng thái lệnh.', 'error');
    },
  });

  const statusMap: Record<string, { label: string; tone: 'green' | 'red' | 'gray' }> = {
    ACTIVE: { label: 'Có hiệu lực', tone: 'green' },
    HOLD: { label: 'Tạm giữ', tone: 'red' },
    CANCELLED: { label: 'Đã hủy', tone: 'red' },
    EXPIRED: { label: 'Hết hạn', tone: 'gray' },
  };

  const columns: Column<DeliveryOrder>[] = [
    {
      key: 'doNumber',
      header: 'Số Lệnh Giao Hàng (D/O)',
      sortable: true,
      render: (row) => (
        <span className="font-bold font-mono text-slate-900 flex items-center gap-1.5 text-xs">
          <FileText className="w-3.5 h-3.5 text-[#F97316]" />
          {row.doNumber}
        </span>
      ),
    },
    {
      key: 'blNumber',
      header: 'Số Vận Đơn (B/L)',
      sortable: true,
      render: (row) => (
        <span className="font-semibold font-mono text-sky-700 text-xs">
          {row.blNumber}
        </span>
      ),
    },
    {
      key: 'consignee',
      header: 'Người Nhận Hàng (Consignee)',
      sortable: true,
      render: (row) => (
        <div className="max-w-[240px]">
          <span className="font-semibold text-slate-800 text-xs block truncate">{row.consignee}</span>
          <span className="text-[11px] text-slate-400">Chủ hàng nhập khẩu</span>
        </div>
      ),
    },
    {
      key: 'containerCount',
      header: 'Số Lượng Thùng',
      align: 'center',
      render: (row) => (
        <span className="font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">
          {row.containerCount} Cont
        </span>
      ),
    },
    {
      key: 'validUntil',
      header: 'Hạn Hiệu Lực',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs text-slate-600 flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          {row.validUntil}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng Thái',
      align: 'center',
      render: (row) => {
        const conf = statusMap[row.status] || { label: row.status, tone: 'gray' };
        return <StatusBadge label={conf.label} tone={conf.tone} status={row.status} />;
      },
    },
    {
      key: 'actions',
      header: 'Thao Tác Nghiệp Vụ',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {row.status === 'ACTIVE' && (
            <button
              onClick={() => {
                setSelectedDO(row);
                setActionType('HOLD');
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Lock className="w-3 h-3 text-amber-700" />
              <span>Tạm giữ</span>
            </button>
          )}

          {row.status === 'HOLD' && (
            <button
              onClick={() => {
                setSelectedDO(row);
                setActionType('RELEASE');
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Unlock className="w-3 h-3 text-emerald-700" />
              <span>Giải phóng</span>
            </button>
          )}

          {row.status !== 'CANCELLED' && row.status !== 'EXPIRED' && (
            <button
              onClick={() => {
                setSelectedDO(row);
                setActionType('CANCEL');
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <XCircle className="w-3 h-3 text-rose-700" />
              <span>Hủy lệnh</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  const statusTabs = [
    { label: 'Tất cả lệnh', value: '' },
    { label: 'Có hiệu lực', value: 'ACTIVE' },
    { label: 'Tạm giữ', value: 'HOLD' },
    { label: 'Hết hạn', value: 'EXPIRED' },
    { label: 'Đã hủy', value: 'CANCELLED' },
  ];

  return (
    <div className="space-y-5 animate-fade-in text-[#1F2937]">

      {/* ── HEADER ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs text-slate-500 font-medium">
            <span>Hãng tàu</span>
            <span>/</span>
            <span>Nghiệp vụ nhập khẩu</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Lệnh giao hàng (D/O)</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Quản Lý Lệnh Giao Hàng Điện Tử (D/O)</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-mono">
              {(orders || []).length} lệnh D/O
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kiểm soát trạng thái hiệu lực, thao tác Tạm giữ / Giải phóng và hủy lệnh để đồng bộ với cổng kiểm soát cảng.
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
            placeholder="Tìm theo số lệnh D/O, số vận đơn B/L, người nhận hàng..."
            className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-xl text-xs bg-slate-50/50 text-slate-900 focus:outline-none focus:border-[#F97316] focus:bg-white transition-all"
          />
        </div>

        <button
          onClick={resetFilters}
          className="h-9 px-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs text-slate-600 font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Đặt lại</span>
        </button>
      </div>

      {/* ── DATA TABLE ── */}
      <div className="saas-card-static bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={orders || []}
          total={(orders || []).length}
          page={Number(filters.page || 1)}
          pageSize={Number(filters.pageSize || 10)}
          onPageChange={(p: number) => setFilter('page', p)}
          onPageSizeChange={(s: number) => {
            setFilter('pageSize', s);
            setFilter('page', 1);
          }}
          isLoading={isLoading}
          onRowClick={(row) => {
            setSelectedDO(row);
            setActionType('VIEW');
          }}
          emptyMessage="Không tìm thấy lệnh giao hàng (D/O) nào phù hợp."
        />
      </div>

      {/* ── VIEW E-DO MODAL ── */}
      {actionType === 'VIEW' && selectedDO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F97316]">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span>Lệnh Giao Hàng Điện Tử (eDO)</span>
                    <span className="text-xs font-mono font-bold text-[#F97316]">{selectedDO.doNumber}</span>
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Phát hành bởi Cổng Hãng Tàu NexusPort • Đồng bộ Smart Gate
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setActionType(null);
                  setSelectedDO(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="space-y-4 text-xs">
              {/* Status Ribbon */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Trạng thái hiệu lực</span>
                  <div className="mt-0.5">
                    <StatusBadge
                      label={statusMap[selectedDO.status]?.label || selectedDO.status}
                      tone={statusMap[selectedDO.status]?.tone || 'gray'}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block font-medium">Hạn hiệu lực đến</span>
                  <span className="font-mono font-bold text-slate-800 text-xs flex items-center gap-1 justify-end mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-orange-500" />
                    {selectedDO.validUntil}
                  </span>
                </div>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Số Vận Đơn (B/L)</span>
                  <span className="font-mono font-bold text-sky-700 text-xs mt-0.5 block">{selectedDO.blNumber}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Chuyến tàu vận chuyển</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                    {selectedDO.vesselName || 'EVER ENVOY'} ({selectedDO.voyageNumber || 'EE-2610N'})
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400 block font-medium">Người nhận hàng (Consignee)</span>
                  <span className="font-bold text-slate-900 text-xs mt-0.5 block">{selectedDO.consignee}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Bãi chỉ định trả vỏ (Depot)</span>
                    <span className="font-semibold text-emerald-700 text-xs mt-0.5 block">
                      {selectedDO.emptyReturnDepot || 'Depot Tân Cảng Suối Tiên (TP. Thủ Đức)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Miễn phí lưu vỏ (Free DET)</span>
                    <span className="font-bold text-slate-800 text-xs mt-0.5 block font-mono">
                      {selectedDO.freeDetDays || 5} Ngày kể từ lúc ra cổng
                    </span>
                  </div>
                </div>
              </div>

              {/* Containers list */}
              <div>
                <span className="font-bold text-slate-800 block mb-1.5 flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-[#F97316]" />
                  <span>Danh sách Container được phép lấy hàng ({selectedDO.containerCount})</span>
                </span>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                        <th className="p-2.5">Số Container</th>
                        <th className="p-2.5">Quy cách</th>
                        <th className="p-2.5">Số Chì (Seal)</th>
                        <th className="p-2.5 text-right">Khối lượng (kg)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedDO.containers && selectedDO.containers.length > 0
                        ? selectedDO.containers
                        : [
                            { containerNumber: 'TCLU5192834', containerType: '40HC', sealNumber: 'SL-88190', weightKg: 21000 },
                            { containerNumber: 'TCLU5192840', containerType: '40HC', sealNumber: 'SL-88191', weightKg: 21000 }
                          ].slice(0, selectedDO.containerCount)
                      ).map((c, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-bold font-mono text-[#F97316]">{c.containerNumber}</td>
                          <td className="p-2.5 text-slate-600 font-medium">{c.containerType}</td>
                          <td className="p-2.5 font-mono text-slate-800">{c.sealNumber}</td>
                          <td className="p-2.5 text-right font-mono text-slate-800 font-semibold">
                            {c.weightKg ? c.weightKg.toLocaleString('vi-VN') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Security check note */}
              <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/60 text-[11px] text-blue-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Lệnh đã đồng bộ trực tiếp tới <strong>Cổng thông minh Smart Gate</strong>. Tài xế xuất trình mã D/O hoặc biển số xe đã đăng ký để qua cổng.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 font-mono">
                Cấp lúc: {selectedDO.issuedAt}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In Lệnh D/O</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionType(null);
                    setSelectedDO(null);
                  }}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM DIALOGS ── */}
      <ConfirmDialog
        isOpen={actionType === 'HOLD'}
        title="Xác nhận Tạm giữ lệnh giao hàng (D/O)?"
        message={`Bạn có chắc muốn chuyển lệnh giao hàng ${selectedDO?.doNumber} (Vận đơn: ${selectedDO?.blNumber}) sang trạng thái Tạm giữ? Cổng cảng sẽ tạm dừng cho phép tài xế lấy thùng container này.`}
        confirmText="Xác nhận Tạm giữ lệnh"
        confirmTone="warning"
        requireReason={true}
        reasonPlaceholder="Nhập lý do tạm giữ (ví dụ: Nợ phí cước lưu bãi bổ sung, kiểm tra hải quan)..."
        onConfirm={(reason) => {
          if (selectedDO) {
            holdMutation.mutate({ id: selectedDO.id, reason: reason || 'Kiểm tra nghiệp vụ' });
          }
        }}
        onClose={() => {
          setActionType(null);
          setSelectedDO(null);
        }}
        onCancel={() => {
          setActionType(null);
          setSelectedDO(null);
        }}
      />

      <ConfirmDialog
        isOpen={actionType === 'RELEASE'}
        title="Xác nhận Giải phóng lệnh giao hàng (D/O)?"
        message={`Bạn có chắc muốn Giải phóng lệnh giao hàng ${selectedDO?.doNumber}? Thùng container sẽ được phép xuất qua cổng cảng bình thường.`}
        confirmText="Xác nhận Giải phóng lệnh"
        confirmTone="primary"
        onConfirm={() => {
          if (selectedDO) {
            releaseMutation.mutate(selectedDO.id);
          }
        }}
        onClose={() => {
          setActionType(null);
          setSelectedDO(null);
        }}
        onCancel={() => {
          setActionType(null);
          setSelectedDO(null);
        }}
      />

      <ConfirmDialog
        isOpen={actionType === 'CANCEL'}
        title="Xác nhận HỦY lệnh giao hàng (D/O)?"
        message={`Hành động này KHÔNG THỂ hoàn tác! Lệnh giao hàng ${selectedDO?.doNumber} sẽ bị hủy bỏ vĩnh viễn trên toàn hệ thống cảng.`}
        confirmText="Hủy lệnh vĩnh viễn"
        confirmTone="danger"
        requireReason={true}
        reasonPlaceholder="Bắt buộc nhập lý do hủy bỏ lệnh giao hàng..."
        onConfirm={(reason) => {
          if (selectedDO) {
            cancelMutation.mutate({ id: selectedDO.id, reason: reason || 'Hủy bỏ theo yêu cầu' });
          }
        }}
        onClose={() => {
          setActionType(null);
          setSelectedDO(null);
        }}
        onCancel={() => {
          setActionType(null);
          setSelectedDO(null);
        }}
      />

    </div>
  );
};

export default DeliveryOrderPage;
