import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Layers
} from 'lucide-react';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  isLoading?: boolean;
  emptyText?: string;
  emptyMessage?: string;
  keyExtractor?: (row: T, index?: number) => string;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onRowClick?: (row: T) => void;
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  };
}

function getPaginationItems(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, '...', totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  total,
  page,
  pageSize,
  isLoading = false,
  emptyText,
  emptyMessage,
  keyExtractor = (row: any, idx?: number) =>
    String(row?.id ?? row?.bookingNumber ?? row?.doNumber ?? row?.blNumber ?? row?.containerNumber ?? idx ?? Math.random()),
  onPageChange,
  onPageSizeChange,
  onRowClick,
  pagination,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Internal pagination fallback if not controlled from outside
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(10);

  const activePage = pagination?.page ?? page ?? internalPage;
  const activePageSize = pagination?.pageSize ?? pageSize ?? internalPageSize;
  const activeTotal = pagination?.totalItems ?? total ?? data.length;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortKey(null);
        setSortOrder('asc');
      }
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      const res = valA < valB ? -1 : 1;
      return sortOrder === 'asc' ? res : -res;
    });
  }, [data, sortKey, sortOrder]);

  // Determine if server-side slicing or client-side slicing
  const isServerSourced = activeTotal > data.length;
  const displayData = useMemo(() => {
    if (isServerSourced) {
      return sortedData;
    }
    const start = (activePage - 1) * activePageSize;
    return sortedData.slice(start, start + activePageSize);
  }, [sortedData, isServerSourced, activePage, activePageSize]);

  const totalPages = Math.max(1, Math.ceil(activeTotal / activePageSize));

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    if (pagination?.onPageChange) {
      pagination.onPageChange(newPage);
    } else if (onPageChange) {
      onPageChange(newPage);
    } else {
      setInternalPage(newPage);
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number(e.target.value);
    if (pagination?.onPageSizeChange) {
      pagination.onPageSizeChange(newSize);
    } else if (onPageSizeChange) {
      onPageSizeChange(newSize);
    } else {
      setInternalPageSize(newSize);
      setInternalPage(1);
    }
  };

  const pageItems = useMemo(() => {
    return getPaginationItems(activePage, totalPages);
  }, [activePage, totalPages]);

  const fromItem = activeTotal === 0 ? 0 : (activePage - 1) * activePageSize + 1;
  const toItem = Math.min(activePage * activePageSize, activeTotal);

  return (
    <div className="border border-slate-200/90 rounded-2xl bg-white overflow-hidden shadow-xs flex flex-col justify-between">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-200/90 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`py-3.5 px-4 whitespace-nowrap ${
                      col.sortable ? 'cursor-pointer select-none hover:text-slate-800' : ''
                    } ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } ${col.className || ''}`}
                  >
                    <div
                      className={`inline-flex items-center gap-1.5 ${
                        col.align === 'right'
                          ? 'justify-end'
                          : col.align === 'center'
                          ? 'justify-center'
                          : 'justify-start'
                      }`}
                    >
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="text-slate-400">
                          {isSorted ? (
                            sortOrder === 'asc' ? (
                              <ChevronUp size={14} className="text-[#F97316]" />
                            ) : (
                              <ChevronDown size={14} className="text-[#F97316]" />
                            )
                          ) : (
                            <ChevronsUpDown size={13} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <LoadingState />
                </td>
              </tr>
            ) : displayData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <EmptyState message={emptyMessage || emptyText || 'Không có dữ liệu phù hợp.'} />
                </td>
              </tr>
            ) : (
              displayData.map((row, idx) => (
                <tr
                  key={typeof keyExtractor === 'function' ? keyExtractor(row, idx) : (row?.id ?? row?.bookingNumber ?? row?.doNumber ?? row?.blNumber ?? row?.containerNumber ?? idx)}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors ${
                    onRowClick ? 'cursor-pointer hover:bg-orange-50/40' : 'hover:bg-slate-50/60'
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-3.5 px-4 text-xs text-slate-800 ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      } ${col.className || ''}`}
                    >
                      {col.render ? col.render(row, idx) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── MODERN SAAS PAGINATION BAR ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 bg-white text-xs select-none">
        
        {/* Left: Summary & Per Page Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Hiển thị</span>
            <span className="font-bold text-slate-900">{fromItem}</span>
            <span className="text-slate-400">–</span>
            <span className="font-bold text-slate-900">{toItem}</span>
            <span>trong</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-mono font-bold text-[11px] border border-slate-200">
              {activeTotal}
            </span>
            <span>kết quả</span>
          </div>

          <span className="text-slate-300 hidden sm:inline select-none">•</span>

          <div className="relative inline-flex items-center">
            <select
              value={activePageSize}
              onChange={handlePageSizeChange}
              className="h-8 pl-2.5 pr-7 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 text-xs font-semibold text-slate-700 shadow-2xs focus:outline-none focus:border-[#F97316] focus:bg-white transition-all cursor-pointer appearance-none"
            >
              <option value={5}>5 dòng / trang</option>
              <option value={10}>10 dòng / trang</option>
              <option value={20}>20 dòng / trang</option>
              <option value={50}>50 dòng / trang</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
          </div>
        </div>

        {/* Right: Page Navigation Pills */}
        <div className="flex items-center gap-1.5">
          {/* Nút Trước */}
          <button
            disabled={activePage <= 1}
            onClick={() => handlePageChange(activePage - 1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 text-xs font-semibold text-slate-700 shadow-2xs transition-all disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
            <span>Trước</span>
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {pageItems.map((item, idx) => {
              if (item === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 font-bold select-none text-xs"
                  >
                    •••
                  </span>
                );
              }
              const pageNum = Number(item);
              const isActive = pageNum === activePage;
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                    isActive
                      ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white shadow-xs shadow-orange-500/25 scale-105'
                      : 'border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 shadow-2xs'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Nút Sau */}
          <button
            disabled={activePage >= totalPages}
            onClick={() => handlePageChange(activePage + 1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 text-xs font-semibold text-slate-700 shadow-2xs transition-all disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>Sau</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>

      </div>
    </div>
  );
}

export default DataTable;
