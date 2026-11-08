import React from 'react';

export default function ShippingPagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 5,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20],
  itemName = 'mục',
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, totalItems);

  // Tính toán dải số trang hiển thị (tối đa 5 nút)
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safePage <= 3) {
      return [1, 2, 3, 4, 5];
    }
    if (safePage >= totalPages - 2) {
      return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [safePage - 2, safePage - 1, safePage, safePage + 1, safePage + 2];
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-chalk bg-fog/40 text-xs">
      {/* Thông tin số lượng hiển thị */}
      <div className="flex flex-wrap items-center gap-3 text-slate">
        <span>
          Hiển thị <strong className="text-carbon font-mono">{from} - {to}</strong> trên tổng số{' '}
          <strong className="text-carbon font-mono">{totalItems}</strong> {itemName}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-chalk">
            <span className="text-[11px] text-slate">Số dòng:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                if (onPageSizeChange) onPageSizeChange(newSize);
                if (onPageChange) onPageChange(1);
              }}
              className="px-2 py-1 bg-white border border-chalk rounded-lg text-xs font-bold text-carbon focus:outline-none focus:border-signal-orange cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / trang
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Điều khiển chuyển trang */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* Nút về trang đầu */}
          <button
            type="button"
            onClick={() => onPageChange && onPageChange(1)}
            disabled={safePage === 1}
            title="Trang đầu"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-chalk bg-white text-slate hover:text-carbon hover:bg-fog disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">first_page</span>
          </button>

          {/* Nút lùi 1 trang */}
          <button
            type="button"
            onClick={() => onPageChange && onPageChange(Math.max(1, safePage - 1))}
            disabled={safePage === 1}
            title="Trang trước"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-chalk bg-white text-slate hover:text-carbon hover:bg-fog disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>

          {/* Dải số trang */}
          {getPageNumbers().map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange && onPageChange(p)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer ${
                safePage === p
                  ? 'bg-carbon text-white shadow-xs'
                  : 'border border-chalk bg-white text-slate hover:text-carbon hover:bg-fog'
              }`}
            >
              {p}
            </button>
          ))}

          {/* Nút tiến 1 trang */}
          <button
            type="button"
            onClick={() => onPageChange && onPageChange(Math.min(totalPages, safePage + 1))}
            disabled={safePage === totalPages}
            title="Trang tiếp theo"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-chalk bg-white text-slate hover:text-carbon hover:bg-fog disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>

          {/* Nút đến trang cuối */}
          <button
            type="button"
            onClick={() => onPageChange && onPageChange(totalPages)}
            disabled={safePage === totalPages}
            title="Trang cuối"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-chalk bg-white text-slate hover:text-carbon hover:bg-fog disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">last_page</span>
          </button>
        </div>
      )}
    </div>
  );
}

