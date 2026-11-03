import React from 'react';

export const LoadingState: React.FC<{ message?: string }> = ({
  message = 'Đang tải...',
}) => {
  return (
    <div className="flex items-center justify-center py-8 text-content-sub gap-2">
      <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      <span className="text-[14px]">{message}</span>
    </div>
  );
};

