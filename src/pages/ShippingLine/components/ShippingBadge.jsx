import React from 'react';

const STATUS_CONFIG = {
  // Voyage statuses
  SCHEDULED: { label: 'Kế hoạch', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  IN_TRANSIT: { label: 'Đang hành trình', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  BERTHED: { label: 'Đã cập cảng', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  OPERATING: { label: 'Đang làm hàng', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-300' },
  DEPARTED: { label: 'Đã rời cảng', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
  COMPLETED: { label: 'Hoàn tất', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300' },

  // Manifest statuses
  SENT_TO_PORT: { label: 'Đã gửi cảng', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  DRAFT: { label: 'Bản nháp', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
  SUBMITTED: { label: 'Đã nộp', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  VALID: { label: 'Hợp lệ', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  VALIDATED: { label: 'Hợp lệ', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  EXCEPTION: { label: 'Có ngoại lệ', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
  RECONCILED: { label: 'Đã đối soát', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-300' },
  MATCHED: { label: 'Khớp 100%', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  MISMATCHED: { label: 'Lệch dữ liệu', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300' },
  PENDING_PORT: { label: 'Chờ cảng', bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-300' },

  // B/L statuses
  ISSUED: { label: 'Đã phát hành', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  SURRENDERED: { label: 'Đã nộp B/L gốc', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
  TELEX_RELEASED: { label: 'Điện giao hàng', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  TELEX_RELEASE: { label: 'Điện giao hàng', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  SEAWAY_BILL: { label: 'Vận đơn Seaway', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  ORIGINAL: { label: 'Vận đơn gốc', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
  CANCELLED: { label: 'Đã hủy', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300' },

  // eDO statuses
  PENDING: { label: 'Chờ xử lý', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
  EXPIRED: { label: 'Hết hiệu lực', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },

  // Liner Hold statuses
  ACTIVE: { label: 'Đang tạm giữ', bg: 'bg-rose-100', text: 'text-rose-900', border: 'border-rose-300' },
  RELEASED: { label: 'Đã giải phóng', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  HOLD: { label: 'Hãng tàu tạm giữ', bg: 'bg-rose-100', text: 'text-rose-900', border: 'border-rose-300' },

  // Payment statuses
  PAID: { label: 'Đã thanh toán', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  UNPAID: { label: 'Chưa thanh toán', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300' },
  PREPAID: { label: 'Trả trước', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  COLLECT: { label: 'Trả sau', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
};

export default function ShippingBadge({ status, text }) {
  const config = STATUS_CONFIG[status] || {
    label: text || status || 'Chưa xác định',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
  };

  const displayText = text || config.label;

  return (
    <span className={`inline-flex items-center whitespace-nowrap shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${config.bg} ${config.text} ${config.border}`}>
      ● {displayText}
    </span>
  );
}
