import React, { useState } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmTone?: string;
  isDanger?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => void;
  onClose?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  confirmTone,
  isDanger = false,
  requireReason = false,
  reasonLabel = 'Lý do thực hiện',
  reasonPlaceholder = 'Nhập lý do chi tiết...',
  onConfirm,
  onClose,
  onCancel,
  isLoading = false,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    if (onClose) onClose();
    if (onCancel) onCancel();
  };

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) {
      setError('Vui lòng nhập lý do để tiếp tục.');
      return;
    }
    setError('');
    onConfirm(reason.trim());
  };

  const dangerMode = isDanger || confirmTone === 'danger' || confirmTone === 'warning';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white border border-border-ui rounded max-w-md w-full p-5 space-y-4">
        <div>
          <h3 className="text-[16px] font-semibold text-content-main">{title}</h3>
          <p className="text-[13px] text-content-sub mt-1">{message}</p>
        </div>

        {requireReason && (
          <div className="space-y-1">
            <label className="text-[13px] font-medium text-content-main">
              {reasonLabel} <span className="text-status-redText">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              placeholder={reasonPlaceholder}
              className={`w-full p-2 border rounded text-[14px] bg-white text-content-main outline-none ${
                error ? 'border-status-redText' : 'border-border-ui focus:border-brand'
              }`}
            />
            {error && <span className="text-[12px] text-status-redText">{error}</span>}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-ui">
          <button
            type="button"
            disabled={isLoading}
            onClick={handleClose}
            className="px-3 py-1.5 border border-border-ui rounded bg-white hover:bg-surface-sub text-content-main text-[13px] font-medium transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={handleConfirm}
            className={`px-3 py-1.5 rounded text-white text-[13px] font-medium transition-colors ${
              dangerMode
                ? 'bg-status-redText hover:bg-red-800'
                : 'bg-brand hover:bg-brand-hover'
            } disabled:opacity-50`}
          >
            {isLoading ? 'Đang xử lý...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

