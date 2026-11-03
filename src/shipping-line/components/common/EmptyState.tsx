import React from 'react';

export const EmptyState: React.FC<{ message?: string }> = ({
  message = 'Không có dữ liệu',
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-content-sub text-center">
      <div className="text-[14px] font-medium">{message}</div>
    </div>
  );
};

