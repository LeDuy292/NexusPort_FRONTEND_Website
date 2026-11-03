import React from 'react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Không thể tải dữ liệu vào lúc này. Vui lòng thử lại sau.',
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center text-content-sub gap-3">
      <div className="text-slate-600 text-[14px] font-medium">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3.5 py-1.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          Tải lại dữ liệu
        </button>
      )}
    </div>
  );
};

