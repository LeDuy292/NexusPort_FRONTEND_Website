import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingApi } from '../../api/booking.api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { FormField } from '../../components/common/FormField';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { useToast } from '../../hooks/useToast';

export const BookingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'containers' | 'history'>('containers');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showIssueBLModal, setShowIssueBLModal] = useState(false);

  // Approve Form State
  const [approveVoyage, setApproveVoyage] = useState('EG-2605W');
  const [approveDepot, setApproveDepot] = useState('Depot Tân Cảng Suối Tiên');
  const [freeDem, setFreeDem] = useState(7);
  const [freeDet, setFreeDet] = useState(5);

  const { data: booking, isLoading, isError, refetch } = useQuery({
    queryKey: ['booking-detail', id],
    queryFn: () => bookingApi.getBookingDetail(id || ''),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      bookingApi.approveBooking(id || '', {
        voyageNumber: approveVoyage,
        depotPickUp: approveDepot,
        freeDemDays: Number(freeDem),
        freeDetDays: Number(freeDet),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['export-bookings'] });
      showToast('Đã duyệt cấp đặt chỗ thành công');
      setShowApproveModal(false);
    },
    onError: () => {
      showToast('Không thể duyệt cấp đặt chỗ. Vui lòng kiểm tra lại thông tin.', 'error');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) =>
      bookingApi.rejectBooking(id || '', { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['export-bookings'] });
      showToast('Đã từ chối yêu cầu đặt chỗ');
      setShowRejectModal(false);
    },
    onError: () => {
      showToast('Không thể từ chối đặt chỗ lúc này. Vui lòng thử lại sau.', 'error');
    },
  });

  const issueBLMutation = useMutation({
    mutationFn: () => bookingApi.issueBillOfLading(id || ''),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['export-bookings'] });
      showToast(`Đã phát hành vận đơn đường biển: ${data.blNumber}`);
      setShowIssueBLModal(false);
    },
    onError: () => {
      showToast('Không thể phát hành vận đơn B/L lúc này. Vui lòng kiểm tra lại trạng thái xếp dỡ container.', 'error');
    },
  });

  if (isLoading) return <LoadingState message="Đang tải chi tiết yêu cầu đặt chỗ..." />;
  if (isError || !booking) return <ErrorState message="Không tìm thấy thông tin đặt chỗ" onRetry={refetch} />;

  const statusLabels: Record<string, string> = {
    PENDING: 'Chờ duyệt',
    APPROVED: 'Đã duyệt cấp',
    BL_ISSUED: 'Đã phát hành vận đơn',
    REJECTED: 'Từ chối',
    CANCELLED: 'Đã hủy',
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-border-ui">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/export-bookings')}
            className="text-[13px] text-content-sub hover:text-content-main font-medium"
          >
            ← Quay lại
          </button>
          <div className="h-4 w-px bg-border-ui" />
          <h2 className="text-[18px] font-bold text-content-main">
            {booking.bookingNumber}
          </h2>
          <StatusBadge
            label={statusLabels[booking.status] || booking.status}
            status={booking.status}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {booking.status === 'PENDING' && (
            <>
              <button
                onClick={() => setShowRejectModal(true)}
                className="px-3 py-1.5 border border-border-ui rounded bg-white hover:bg-surface-sub text-status-redText text-[13px] font-medium transition-colors"
              >
                Từ chối
              </button>
              <button
                onClick={() => setShowApproveModal(true)}
                className="px-3 py-1.5 rounded bg-brand hover:bg-brand-hover text-white text-[13px] font-medium transition-colors"
              >
                Duyệt cấp chỗ
              </button>
            </>
          )}

          {booking.status === 'APPROVED' && (
            <button
              onClick={() => setShowIssueBLModal(true)}
              className="px-3 py-1.5 rounded bg-brand hover:bg-brand-hover text-white text-[13px] font-medium transition-colors"
            >
              Phát hành vận đơn (B/L)
            </button>
          )}

          {booking.status === 'BL_ISSUED' && booking.blNumber && (
            <div className="text-[13px] text-content-sub">
              Số vận đơn:{' '}
              <span className="font-bold text-brand">{booking.blNumber}</span>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column: Booking Info (2 spans) */}
        <div className="col-span-2 bg-white border border-border-ui rounded p-5 space-y-4">
          <h3 className="font-semibold text-[14px] text-content-main border-b border-border-ui pb-2">
            Thông tin chi tiết Đặt chỗ
          </h3>

          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-[13px]">
            <div>
              <span className="text-content-sub block text-[12px]">Chủ hàng / Doanh nghiệp</span>
              <span className="font-medium text-content-main">{booking.shipperName}</span>
            </div>

            <div>
              <span className="text-content-sub block text-[12px]">Tàu & Chuyến xuất khẩu</span>
              <span className="font-medium text-content-main">
                {booking.vesselName} ({booking.voyageNumber})
              </span>
            </div>

            <div>
              <span className="text-content-sub block text-[12px]">Cảng bốc hàng (POL)</span>
              <span className="font-medium text-content-main">Cảng NexusPort Tân Cảng</span>
            </div>

            <div>
              <span className="text-content-sub block text-[12px]">Cảng dỡ hàng (POD)</span>
              <span className="font-medium text-content-main">{booking.destinationPort}</span>
            </div>

            <div>
              <span className="text-content-sub block text-[12px]">Quy cách thùng container</span>
              <span className="font-medium text-content-main">
                {booking.containerQuantity} x {booking.containerType}
              </span>
            </div>

            <div>
              <span className="text-content-sub block text-[12px]">Thời gian tàu chạy (ETD)</span>
              <span className="font-medium text-content-main">{booking.etd}</span>
            </div>

            {booking.depotPickUp && (
              <div>
                <span className="text-content-sub block text-[12px]">Bãi chỉ định cấp vỏ rỗng</span>
                <span className="font-medium text-brand">{booking.depotPickUp}</span>
              </div>
            )}

            {booking.freeDemDays !== undefined && (
              <div>
                <span className="text-content-sub block text-[12px]">Hạn miễn phí lưu bãi / lưu vỏ</span>
                <span className="font-medium text-content-main">
                  {booking.freeDemDays} ngày lưu bãi (DEM) • {booking.freeDetDays} ngày lưu vỏ (DET)
                </span>
              </div>
            )}

            {booking.rejectionReason && (
              <div className="col-span-2 p-3 rounded bg-status-redBg border border-red-200 text-status-redText text-[13px]">
                <span className="font-semibold block">Lý do từ chối:</span>
                {booking.rejectionReason}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Cut-off Times (1 span) */}
        <div className="bg-white border border-border-ui rounded p-5 space-y-4">
          <h3 className="font-semibold text-[14px] text-content-main border-b border-border-ui pb-2">
            Các mốc thời hạn chốt (Cut-off)
          </h3>

          <div className="space-y-3">
            {(booking.cutOffs || [
              { code: 'SI_CUTOFF', label: 'Hạn nộp chi tiết B/L (SI)', deadline: 'Trước giờ tàu chạy 48h', isPassed: false },
              { code: 'VGM_CUTOFF', label: 'Hạn nộp phiếu cân (VGM)', deadline: 'Trước giờ tàu chạy 24h', isPassed: false },
              { code: 'CY_CUTOFF', label: 'Hạn cắt máng bãi cảng (CY)', deadline: 'Trước giờ tàu chạy 12h', isPassed: false },
            ]).map((c) => (
              <div
                key={c.code}
                className="p-3 rounded border border-border-ui bg-surface-sub text-[13px] flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-content-main">{c.label}</span>
                  {c.isPassed ? (
                    <StatusBadge label="Đã chốt" tone="gray" />
                  ) : (
                    <StatusBadge label="Đang nhận" tone="green" />
                  )}
                </div>
                <div className="text-[12px] text-content-sub">
                  Thời hạn: <span className="font-medium text-content-main">{c.deadline}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Tabs */}
      <div className="bg-white border border-border-ui rounded">
        <div className="flex border-b border-border-ui px-4">
          <button
            onClick={() => setActiveTab('containers')}
            className={`py-3 px-4 text-[14px] font-medium border-b-2 transition-colors ${
              activeTab === 'containers'
                ? 'border-brand text-brand'
                : 'border-transparent text-content-sub hover:text-content-main'
            }`}
          >
            Danh sách Container ({booking.containers?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 text-[14px] font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-brand text-brand'
                : 'border-transparent text-content-sub hover:text-content-main'
            }`}
          >
            Lịch sử thao tác ({booking.history?.length || 0})
          </button>
        </div>

        <div className="p-4">
          {activeTab === 'containers' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="bg-surface-sub border-b border-border-ui text-content-sub font-medium">
                    <th className="p-2.5">Số Container</th>
                    <th className="p-2.5">Loại</th>
                    <th className="p-2.5">Số Chì (Seal)</th>
                    <th className="p-2.5 text-right">Khối lượng VGM (kg)</th>
                    <th className="p-2.5 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-ui">
                  {(booking.containers || []).map((c) => (
                    <tr key={c.id} className="hover:bg-surface-sub">
                      <td className="p-2.5 font-semibold text-content-main">{c.containerNumber}</td>
                      <td className="p-2.5 text-content-sub">{c.containerType}</td>
                      <td className="p-2.5 text-content-main">{c.sealNumber || '—'}</td>
                      <td className="p-2.5 text-right font-medium">
                        {c.vgmWeight ? c.vgmWeight.toLocaleString('vi-VN') : 'Chưa khai'}
                      </td>
                      <td className="p-2.5 text-center">
                        {c.status === 'DA_XEP_TAU' ? (
                          <StatusBadge label="Đã xếp tàu" tone="green" />
                        ) : c.status === 'DA_HA_BAI' ? (
                          <StatusBadge label="Đã hạ bãi" tone="orange" />
                        ) : (
                          <StatusBadge label="Chờ đóng hàng" tone="gray" />
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!booking.containers || booking.containers.length === 0) && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-content-sub">
                        Chưa có container nào được liên kết với booking này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {(booking.history || []).map((h) => (
                <div key={h.id} className="flex items-start gap-3 text-[13px] border-b border-border-ui pb-3 last:border-b-0 last:pb-0">
                  <div className="text-[12px] text-content-sub whitespace-nowrap min-w-[130px]">
                    {h.timestamp}
                  </div>
                  <div>
                    <div className="font-semibold text-content-main">
                      {h.action} <span className="font-normal text-content-sub">bởi {h.actor}</span>
                    </div>
                    <div className="text-content-sub text-[13px] mt-0.5">{h.description}</div>
                  </div>
                </div>
              ))}
              {(!booking.history || booking.history.length === 0) && (
                <div className="p-6 text-center text-content-sub text-[13px]">
                  Chưa có lịch sử sự kiện.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* APPROVE MODAL */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-border-ui rounded max-w-lg w-full p-5 space-y-4">
            <h3 className="text-[16px] font-semibold text-content-main">
              Duyệt Yêu Cầu Cấp Chỗ Xuất Khẩu
            </h3>

            <div className="space-y-3 text-[13px]">
              <FormField label="Chọn chuyến tàu vận chuyển" required>
                <select
                  value={approveVoyage}
                  onChange={(e) => setApproveVoyage(e.target.value)}
                  className="w-full h-8 px-2.5 border border-border-ui rounded text-[13px] bg-white text-content-main focus:outline-none focus:border-brand"
                >
                  <option value="EG-2605W">EG-2605W (EVER GLORY - Ngày chạy 05/11/2026)</option>
                  <option value="OC-2612E">OC-2612E (ONE CONTINUITY - Ngày chạy 07/11/2026)</option>
                  <option value="MC-2608S">MC-2608S (MOL CREATION - Ngày chạy 03/11/2026)</option>
                </select>
              </FormField>

              <FormField label="Bãi / Depot chỉ định cấp vỏ" required>
                <input
                  type="text"
                  value={approveDepot}
                  onChange={(e) => setApproveDepot(e.target.value)}
                  className="w-full h-8 px-2.5 border border-border-ui rounded text-[13px] bg-white text-content-main focus:outline-none focus:border-brand"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Số ngày miễn phí lưu bãi (DEM)" required>
                  <input
                    type="number"
                    value={freeDem}
                    onChange={(e) => setFreeDem(Number(e.target.value))}
                    className="w-full h-8 px-2.5 border border-border-ui rounded text-[13px] bg-white text-content-main focus:outline-none focus:border-brand"
                  />
                </FormField>

                <FormField label="Số ngày miễn phí lưu vỏ (DET)" required>
                  <input
                    type="number"
                    value={freeDet}
                    onChange={(e) => setFreeDet(Number(e.target.value))}
                    className="w-full h-8 px-2.5 border border-border-ui rounded text-[13px] bg-white text-content-main focus:outline-none focus:border-brand"
                  />
                </FormField>
              </div>

              {/* Preview Cut-offs */}
              <div className="p-3 rounded bg-surface-sub border border-border-ui space-y-1.5 text-[12px]">
                <div className="font-semibold text-content-main">Các mốc thời hạn chốt sẽ áp dụng:</div>
                <div className="text-content-sub">• Hạn nộp chi tiết làm B/L: 03/11/2026 12:00</div>
                <div className="text-content-sub">• Hạn nộp phiếu cân VGM: 04/11/2026 10:00</div>
                <div className="text-content-sub">• Hạn chót hạ bãi cảng (Cắt máng): 04/11/2026 18:00</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-ui">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="px-3 py-1.5 border border-border-ui rounded bg-white hover:bg-surface-sub text-content-main text-[13px] font-medium"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
                className="px-3 py-1.5 rounded bg-brand hover:bg-brand-hover text-white text-[13px] font-medium disabled:opacity-50"
              >
                {approveMutation.isPending ? 'Đang duyệt...' : 'Xác nhận duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      <ConfirmDialog
        isOpen={showRejectModal}
        title="Từ chối yêu cầu Đặt chỗ"
        message="Hành động này sẽ từ chối cấp vỏ cho chủ hàng. Vui lòng cung cấp lý do từ chối cụ thể."
        confirmText="Xác nhận từ chối"
        isDanger={true}
        requireReason={true}
        reasonLabel="Lý do từ chối"
        reasonPlaceholder="Nhập lý do từ chối đặt chỗ..."
        onConfirm={(reason) => rejectMutation.mutate(reason || '')}
        onClose={() => setShowRejectModal(false)}
        isLoading={rejectMutation.isPending}
      />

      {/* ISSUE BL MODAL */}
      <ConfirmDialog
        isOpen={showIssueBLModal}
        title="Phát hành Vận đơn Đường biển (B/L)"
        message="Bạn có chắc chắn muốn phát hành số vận đơn chính thức cho hồ sơ đặt chỗ này sau khi container đã hoàn tất xếp lên tàu?"
        confirmText="Phát hành vận đơn"
        isDanger={false}
        onConfirm={() => issueBLMutation.mutate()}
        onClose={() => setShowIssueBLModal(false)}
        isLoading={issueBLMutation.isPending}
      />
    </div>
  );
};

