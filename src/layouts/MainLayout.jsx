import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom'
import { routeConfig, ROLES } from '../routes/routeConfig'
import NotificationCenter from '../components/NotificationCenter'

// Danh sách các mục trong Sidebar tương ứng với các route
const sidebarItems = [

  // ── DISPATCHER ────────────────────────────────────────────────
  // 1. Tổng quan trước
  {
    path: '/dashboard',
    label: 'Tổng quan',
    icon: 'dashboard',
    roles: [ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  // 2. Luồng vận hành chính: Container → Điều phối → Cổng & Tàu
  {
    path: '/vessel-schedule',
    label: 'Lịch Tàu Cập Cảng',
    icon: 'directions_boat',
    roles: [ROLES.DISPATCHER],
  },
  {
    path: '/berth-assignment',
    label: 'Phân Bổ Cầu Bến',
    icon: 'anchor',
    roles: [ROLES.DISPATCHER],
  },
  {
    path: '/vessel-operation-plan',
    label: 'Kế Hoạch Xếp Dỡ Tàu',
    icon: 'assignment',
    roles: [ROLES.DISPATCHER],
  },
  {
    path: '/container-flow',
    label: 'Luồng Container',
    icon: 'account_tree',
    roles: [ROLES.DISPATCHER],
  },
  {
    path: '/dispatcher/gate-bookings',
    label: 'Yêu Cầu Booking Cổng',
    icon: 'calendar_month',
    badge: 8,
    roles: [ROLES.DISPATCHER],
  },
  {
    path: '/dispatch',
    label: 'Lệnh Điều Phối Xe',
    icon: 'alt_route',
    roles: [ROLES.DISPATCHER],
  },
  // 3. Quản lý nguồn lực: Xe & Tài xế
  {
    path: '/fleet',
    label: 'Quản Lý Đội Xe',
    icon: 'local_shipping',
    roles: [ROLES.DISPATCHER],
  },
  {
    path: '/dispatcher/drivers',
    label: 'Quản Lý Tài Xế',
    icon: 'badge',
    roles: [ROLES.DISPATCHER],
  },
  // 4. Giám sát thực địa: Bãi & Giao thông & Camera
  {
    path: '/yard',
    label: 'Bản Đồ Bãi',
    icon: 'grid_view',
    roles: [ROLES.DISPATCHER],
  },
  {
    path: '/traffic',
    label: 'Quản Lý Giao Thông',
    icon: 'traffic',
    roles: [ROLES.DISPATCHER],
  },
  {
    path: '/dispatcher/cameras',
    label: 'Giám Sát Camera',
    icon: 'videocam',
    roles: [ROLES.DISPATCHER],
  },
  {
    path: '/dispatch-history',
    label: 'Lịch Sử Điều Phối',
    icon: 'history',
    roles: [ROLES.DISPATCHER],
  },

  // ── YARD OPERATOR / STAFF (Nhân Viên & Điều Hành Bãi) ─────────
  {
    path: '/yard-staff/dashboard',
    label: 'Tổng Quan Khai Thác Bãi',
    icon: 'grid_view',
    roles: [ROLES.YARD_OPERATOR],
  },
  {
    path: '/yard-staff/map',
    label: 'Sơ Đồ Bãi 2D',
    icon: 'map',
    roles: [ROLES.YARD_OPERATOR],
  },
  {
    path: '/yard-staff/inventory-inspection',
    label: 'Kiểm Kê & Kiểm Thử Vỏ',
    icon: 'fact_check',
    roles: [ROLES.YARD_OPERATOR],
  },
  {
    path: '/yard-staff/movement-operations',
    label: 'Lệnh Di Chuyển Container',
    icon: 'swap_horiz',
    roles: [ROLES.YARD_OPERATOR],
  },
  {
    path: '/yard-staff/gate-out-preparation',
    label: 'Chuẩn Bị Xuất Cổng',
    icon: 'output',
    roles: [ROLES.YARD_OPERATOR],
  },
  {
    path: '/yard-staff/container-detail',
    label: 'Chi Tiết Container',
    icon: 'inventory_2',
    roles: [ROLES.YARD_OPERATOR],
  },

  // ── GATE OFFICER ──────────────────────────────────────────────
  {
    path: '/gate/dashboard',
    label: 'Tổng Quan Cổng',
    icon: 'dashboard',
    roles: [ROLES.GATE_OFFICER],
  },
  {
    path: '/gate',
    label: 'Cổng Kiểm Soát',
    icon: 'sensor_door',
    roles: [ROLES.GATE_OFFICER],
  },
  {
    path: '/gate/bookings',
    label: 'Lịch Booking Cổng',
    icon: 'calendar_month',
    roles: [ROLES.GATE_OFFICER],
  },
  {
    path: '/gate/verification',
    label: 'Xác Minh Xe & Tài Xế',
    icon: 'fact_check',
    roles: [ROLES.GATE_OFFICER],
  },
  {
    path: '/gate/container',
    label: 'Xác Minh Container',
    icon: 'inventory_2',
    roles: [ROLES.GATE_OFFICER],
  },
  {
    path: '/gate/incidents',
    label: 'Sự Cố Cổng',
    icon: 'warning',
    roles: [ROLES.GATE_OFFICER],
  },
  {
    path: '/gate/history',
    label: 'Lịch Sử Kiểm Soát',
    icon: 'history',
    roles: [ROLES.GATE_OFFICER],
  },
  {
    path: '/gate/camera',
    label: 'Camera Cổng',
    icon: 'videocam',
    roles: [ROLES.GATE_OFFICER],
  },

  // ── BERTH STAFF (Nhân Viên Cầu Bến) ──────────────────────
  {
    path: '/berth-staff/vessel-operation-control',
    label: 'Điều Hành Tác Nghiệp Tàu',
    icon: 'anchor',
    roles: [ROLES.BERTH_STAFF],
  },
  {
    path: '/berth-staff/incident-reporting',
    label: 'Báo Cáo Sự Cố Cầu Bến',
    icon: 'report',
    roles: [ROLES.BERTH_STAFF],
  },

  // ── MỤC BÁO CÁO & SỰ CỐ DÙNG CHUNG (ĐẶT Ở DƯỚI CÙNG) ──────────
  {
    path: '/damage-report',
    label: 'Báo Cáo Hư Hỏng',
    icon: 'report_problem',
    roles: [ROLES.YARD_OPERATOR, ROLES.GATE_OFFICER],
  },


  // ── ADMINISTRATOR (chỉ 4 trang riêng) ────────────────────────

  {
    path: '/reports',
    label: 'Báo Cáo & Phân Tích',
    icon: 'analytics',
    roles: [ROLES.ADMINISTRATOR],
  },
  {
    path: '/admin/carriers',
    label: 'Quản Lý Đối Tác',
    icon: 'corporate_fare',
    roles: [ROLES.ADMINISTRATOR],
  },

  {
    path: '/admin/berths',
    label: 'Quản Lý Cầu Bến',
    icon: 'anchor',
    roles: [ROLES.ADMINISTRATOR],
  },
  {
    path: '/admin/gates',
    label: 'Quản Lý Gate',
    icon: 'sensor_door',
    roles: [ROLES.ADMINISTRATOR],
  },
  {
    path: '/admin/equipment',
    label: 'Quản Lý Thiết Bị',
    icon: 'precision_manufacturing',
    roles: [ROLES.ADMINISTRATOR],
  },
  {
    path: '/admin/billing',
    label: 'Billing & Thanh Toán',
    icon: 'payments',
    roles: [ROLES.ADMINISTRATOR],
  },

  // ── BERTH STAFF ───────────────────────────────────────────────
  {
    path: '/berth',
    label: 'Theo Dõi Dỡ Tàu',
    icon: 'directions_boat',
    roles: [ROLES.BERTH_STAFF],
  },

  // ── TRANSPORT COMPANY ──────────────────────────────────────────
  {
    path: '/carrier-portal',
    label: 'Cổng Hãng Tàu',
    icon: 'anchor',
    roles: [ROLES.TRANSPORT_COMPANY],
  },
  {
    path: '/booking',
    label: 'Đặt Lịch Cảng',
    icon: 'calendar_month',
    roles: [ROLES.TRANSPORT_COMPANY],
  },
  {
    path: '/cargo',
    label: 'Khai Báo Hàng Hóa',
    icon: 'ac_unit',
    roles: [ROLES.TRANSPORT_COMPANY],
  },
  {
    path: '/drivers',
    label: 'Quản Lý Tài Xế',
    icon: 'badge',
    roles: [ROLES.TRANSPORT_COMPANY],
  },
  {
    path: '/carrier-profile',
    label: 'Hồ Sơ Hãng Tàu',
    icon: 'corporate_fare',
    roles: [ROLES.TRANSPORT_COMPANY],
  },
  {
    path: '/billing',
    label: 'Thanh Toán & Cước Phí',
    icon: 'payments',
    roles: [ROLES.TRANSPORT_COMPANY],
  },
  {
    path: '/users',
    label: 'Phân Quyền Vai Trò',
    icon: 'manage_accounts',
    roles: [ROLES.ADMINISTRATOR],
  },
  {
    path: '/incidents',
    label: 'AI & Sự Cố',
    icon: 'warning',
    roles: [ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
]


export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [clock, setClock] = useState('--:--:--')
  const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
  const user = stored ? JSON.parse(stored) : { username: 'Khách', role: 'None' }

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString('vi-VN'))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('user')
    sessionStorage.removeItem('user')
    navigate('/login')
  }

  // Lọc các sidebar items được phép hiển thị với vai trò người dùng hiện tại
  const allowedItems = sidebarItems.filter(item => item.roles.includes(user.role))

  // Lấy tiêu đề trang hiện tại
  const currentTitle = sidebarItems.find(item => item.path === location.pathname)?.label || 'Cổng Quản trị'

  if (user.role === ROLES.DRIVER) {
    return (
      <div className="w-full min-h-screen bg-fog overflow-y-auto font-sans antialiased">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full bg-mist text-primary font-sans antialiased overflow-hidden">
      
      {/* ═══════════════════════════ SIDEBAR ═══════════════════════════ */}
      <aside className="w-[240px] h-screen bg-white border-r border-chalk flex flex-col z-20 flex-shrink-0">
        <div className="p-6 border-b border-chalk">
          <h1 className="font-heading text-2xl text-primary flex items-center gap-1 font-bold leading-none">
            NexusPort<span className="text-signal-orange text-3xl leading-none">.</span>
          </h1>
          <p className="text-[11px] text-slate mt-1.5 uppercase tracking-wider font-semibold">
            {user.role} Portal
          </p>
        </div>

        {/* MENU LINKS */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {allowedItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-fog border-l-4 border-signal-orange text-[#ff682c] font-bold'
                    : 'text-graphite hover:bg-mist hover:text-carbon'
                }`}
              >
                {/* Material Icon (loaded from index.html) */}
                <span className="material-symbols-outlined mr-3 text-lg">
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-500 text-white rounded-full font-mono">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* USER PROFILE INFO & LOGOUT BUTTON */}
        <div className="p-4 border-t border-chalk bg-fog">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary-container text-white flex justify-center items-center font-bold text-sm">
              {user.username.substring(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-carbon truncate">{user.username}</div>
              <div className="text-[10px] text-slate truncate">{user.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-[#ba1a1a] text-white h-[36px] rounded-lg text-xs font-semibold flex justify-center items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ═══════════════════════════ MAIN CONTENT AREA ═══════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* TOP BAR */}
        <header className="h-20 px-8 flex justify-between items-center border-b border-chalk bg-white flex-shrink-0">
          <div className="text-graphite text-sm font-medium flex items-center gap-2">
            <span>Terminal Portal</span>
            <span className="text-slate">/</span>
            <span className="text-carbon font-semibold text-base">{currentTitle}</span>
          </div>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <div className="w-2.5 h-2.5 rounded-full bg-signal-orange animate-ping"></div>
              LIVE <span className="ml-1 text-slate font-normal">{clock}</span>
            </div>
            <div className="flex items-center gap-4 text-graphite border-l border-chalk pl-6">
              <NotificationCenter />
              <span className="material-symbols-outlined cursor-pointer hover:text-primary transition-colors text-[24px]">account_circle</span>
            </div>
          </div>
        </header>

        {/* CONTAINER CONTENT */}
        <main className="flex-1 overflow-y-auto bg-mist">
          <Outlet />
        </main>
      </div>

    </div>
  )
}
