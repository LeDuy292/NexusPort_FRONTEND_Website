import React from 'react';
import { useToast } from '../../hooks/useToast';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let toneClass = 'bg-white border-border-ui text-content-main';
        if (toast.type === 'success') {
          toneClass = 'bg-status-greenBg border-green-300 text-status-greenText';
        } else if (toast.type === 'error') {
          toneClass = 'bg-status-redBg border-red-300 text-status-redText';
        }

        return (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`pointer-events-auto cursor-pointer p-3 rounded border text-[13px] font-medium transition-all ${toneClass}`}
          >
            {toast.message}
          </div>
        );
      })}
    </div>
  );
};

