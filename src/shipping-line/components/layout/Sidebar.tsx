import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  UploadCloud,
  DownloadCloud,
  FileText,
  Box,
  RefreshCw,
} from 'lucide-react';

const MENU_ITEMS = [
  { path: '/overview', label: 'Tổng quan', icon: LayoutDashboard },
  { path: '/export-bookings', label: 'Đặt chỗ xuất khẩu', icon: UploadCloud },
  { path: '/import-cargo', label: 'Hàng nhập khẩu', icon: DownloadCloud },
  { path: '/delivery-orders', label: 'Lệnh giao hàng (D/O)', icon: FileText },
  { path: '/containers', label: 'Vỏ container & Lưu bãi', icon: Box },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-[240px] fixed top-0 left-0 bottom-0 bg-white border-r border-border-ui z-30 flex flex-col">
      {/* Brand Header */}
      <div className="h-[56px] border-b border-border-ui flex items-center px-5 gap-2.5">
        <div className="w-6 h-6 rounded bg-brand flex items-center justify-center text-white font-bold text-[12px] leading-none">
          H
        </div>
        <div>
          <span className="font-bold text-[15px] tracking-tight text-content-main">
            HÃNG TÀU
          </span>
          <span className="text-content-sub text-[11px] block leading-none">
            NexusPort TOS
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded text-[14px] font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-light text-brand'
                    : 'text-content-main hover:bg-surface-sub hover:text-brand'
                }`
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-border-ui text-[12px] text-content-sub">
        <span>Phiên bản 1.0.0</span>
      </div>
    </aside>
  );
};

