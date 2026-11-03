import React from 'react';
import { StatusTone } from '../../types/common.types';

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  status?: string;
}

const VIETNAMESE_LABEL_MAP: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt cấp',
  BL_ISSUED: 'Đã cấp vận đơn',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
  HOLD: 'Tạm giữ',
  ACTIVE: 'Có hiệu lực',
  EXPIRED: 'Hết hạn',
  PENDING_NOTICE: 'Chờ thông báo',
  PENDING_PAYMENT: 'Chờ thanh toán',
  PENDING_DO: 'Chờ cấp lệnh giao',
  DO_ISSUED: 'Đã cấp lệnh giao',
  RELEASED: 'Đã giải phóng',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  OUTBOUND: 'Gửi đi',
  INBOUND: 'Nhận về',
  DISCHARGED: 'Đã dỡ bãi',
  GATE_OUT: 'Đã ra cổng',
  GATE_IN: 'Đã vào cổng',
  LOADED: 'Đã xếp tàu',
  SENT: 'Đã gửi',
  DRAFT: 'Bản nháp',
  PROCESSING: 'Đang xử lý',
  CHO_DONG: 'Chờ đóng hàng',
  DANG_DONG_HANG: 'Đang đóng hàng',
  DA_HA_BAI: 'Đã hạ bãi',
  DA_XEP_TAU: 'Đã xếp tàu',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, tone, status }) => {
  let resolvedTone: StatusTone = tone || 'gray';
  const displayLabel = VIETNAMESE_LABEL_MAP[label] || (status ? VIETNAMESE_LABEL_MAP[status] : undefined) || label;

  if (!tone && status) {
    switch (status) {
      case 'PENDING':
      case 'PENDING_NOTICE':
      case 'DRAFT':
      case 'CHO_DONG':
        resolvedTone = 'gray';
        break;
      case 'APPROVED':
      case 'PENDING_PAYMENT':
      case 'PENDING_DO':
      case 'PROCESSING':
      case 'DANG_DONG_HANG':
      case 'DA_HA_BAI':
        resolvedTone = 'orange';
        break;
      case 'BL_ISSUED':
      case 'DO_ISSUED':
      case 'RELEASED':
      case 'SUCCESS':
      case 'ACTIVE':
      case 'DA_XEP_TAU':
        resolvedTone = 'green';
        break;
      case 'REJECTED':
      case 'CANCELLED':
      case 'HOLD':
      case 'FAILED':
      case 'EXPIRED':
        resolvedTone = 'red';
        break;
      default:
        resolvedTone = 'gray';
    }
  }

  const toneClasses: Record<StatusTone, string> = {
    gray: 'bg-slate-100 text-slate-700 border-slate-200/80',
    orange: 'bg-orange-50 text-orange-700 border-orange-200/80',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    red: 'bg-rose-50 text-rose-700 border-rose-200/80',
  };

  const dotClasses: Record<StatusTone, string> = {
    gray: 'bg-slate-400',
    orange: 'bg-[#F97316] animate-pulse',
    green: 'bg-emerald-500',
    red: 'bg-rose-500',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border leading-tight whitespace-nowrap shadow-2xs transition-all ${toneClasses[resolvedTone]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClasses[resolvedTone]}`} />
      <span>{displayLabel}</span>
    </span>
  );
};
