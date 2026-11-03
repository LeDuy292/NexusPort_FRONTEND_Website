import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const PAGE_TITLES: Record<string, string> = {
  '/overview': 'Tổng quan',
  '/export-bookings': 'Đặt chỗ xuất khẩu',
  '/import-cargo': 'Hàng nhập khẩu',
  '/delivery-orders': 'Lệnh giao hàng (D/O)',
  '/containers': 'Tra cứu & Biểu phí container',
  '/port-sync': 'Đồng bộ cảng',
};

export const Topbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // match base route
  const currentPath = `/${location.pathname.split('/')[1] || 'overview'}`;
  const pageTitle = PAGE_TITLES[currentPath] || 'Hệ thống Hãng tàu';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-[56px] fixed top-0 right-0 left-[240px] bg-white border-b border-border-ui z-20 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-[16px] font-semibold text-content-main leading-none">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-4 text-[13px]">
        <div className="flex items-center gap-2">
          <span className="text-content-sub">Người dùng:</span>
          <span className="font-medium text-content-main">
            {user?.fullName || user?.username || 'Đại diện Hãng tàu'}
          </span>
          {user?.carrierCode && (
            <span className="bg-surface-sub border border-border-ui px-1.5 py-0.5 rounded text-[11px] text-content-sub">
              {user.carrierCode}
            </span>
          )}
        </div>

        <div className="h-4 w-px bg-border-ui" />

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-content-sub hover:text-brand transition-colors text-[13px] font-medium"
          title="Đăng xuất khỏi hệ thống"
        >
          <LogOut size={16} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </header>
  );
};

