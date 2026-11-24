import React, { useState, useEffect, Suspense } from 'react'
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom'
import { ROLES, YARD_VISIT_READERS } from '../routes/routeConfig'
import NotificationCenter from '../components/NotificationCenter'

// Menu của Administrator: chỉ các trang quản trị hệ thống. Các trang tác nghiệp của vai trò khác (điều phối, bãi, cổng, hãng tàu, doanh nghiệp vận tải) được ẩn khỏi menu.
const ADMIN_MENU_PATHS = new Set([
  '/dashboard',            // Tổng quan toàn hệ thống
  '/reports',              // Báo cáo & phân tích
  '/users',                // Tài khoản & phân quyền vai trò
  '/admin/carriers',       // Đối tác (doanh nghiệp vận tải)
  '/admin/shipping-lines', // Danh mục hãng tàu
  '/admin/gates',          // Cổng bãi
  '/admin/equipment',      // Thiết bị
  '/admin/service-catalog',// Danh mục dịch vụ & biểu phí
  '/admin/billing',        // Billing & thanh toán
])

const OVERVIEW_PATHS = new Set(['/carrier-portal', '/dashboard', '/yard-staff/dashboard', '/gate/dashboard', '/shipping-line/dashboard'])

// Danh sách các mục trong Sidebar tương ứng với các route
const sidebarItems = [
  {
    path: '/carrier-portal',
    label: 'Cổng Doanh Nghiệp',
    icon: 'corporate_fare',
    roles: [ROLES.TRANSPORT_COMPANY, ROLES.CARRIER_STAFF, ROLES.ADMINISTRATOR],
  },
  {
    path: '/services',
    label: 'Dịch Vụ ePort',
    icon: 'assignment_turned_in',
    roles: [ROLES.TRANSPORT_COMPANY, ROLES.CARRIER_STAFF, ROLES.ADMINISTRATOR],
  },
  {
    path: '/admin/service-catalog',
    label: 'Danh Mục & Biểu Phí',
    icon: 'price_change',
    roles: [ROLES.ADMINISTRATOR],
  },
  {
    path: '/containers',
    label: 'Tra cứu lượt bãi',
    icon: 'search',
    roles: YARD_VISIT_READERS,
  },
  // ── DISPATCHER ────────────────────────────────────────────────
  // 1. Tổng quan trước
  {
    path: '/dashboard',
    label: 'Tổng quan',
    icon: 'dashboard',
    roles: [ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  // 2. Luồng vận hành chính: Container → Điều phối → Cổng
  {
    path: '/container-flow',
    label: 'Luồng Container',
    icon: 'account_tree',
    roles: [ROLES.DISPATCHER],
  },
  {
    path: '/dispatcher/yard-discharge',
    label: 'Dỡ Tàu & Phân Bổ Bãi',
    icon: 'anchor',
    roles: [ROLES.DISPATCHER],
  },
  {
    path: '/dispatcher/gate-bookings',
    label: 'Yêu Cầu Lịch Hẹn Cổng',
    icon: 'calendar_month',
    roles: [ROLES.DISPATCHER],
  },
  {
    path: '/dispatch',
    label: 'Lệnh Điều Phối Xe',
    icon: 'alt_route',
    roles: [ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  // 4. Giám sát thực địa: Bãi & Camera
  {
    path: '/yard',
    label: 'Bản Đồ Bãi',
    icon: 'grid_view',
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
  {
    path: '/dispatcher/yard-incidents',
    label: 'Sự Cố Bãi',
    icon: 'report_problem',
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
  {
    path: '/yard/reefer',
    label: 'Cấp Điện Container Lạnh',
    icon: 'ac_unit',
    roles: [ROLES.YARD_OPERATOR, ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/damage-report',
    label: 'Báo Cáo Hư Hỏng',
    icon: 'report_problem',
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
    label: 'Lịch Hẹn Cổng',
    icon: 'calendar_month',
    roles: [ROLES.GATE_OFFICER],
  },
  {
    path: '/gate/verification',
    label: 'Đối Chiếu Xe & Tài Xế',
    icon: 'fact_check',
    roles: [ROLES.GATE_OFFICER],
  },
  {
    path: '/gate/container',
    label: 'Quét & Đối Soát Cont',
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

  // ── SHIPPING LINE (Hãng Tàu) ──────────────────────────────
  {
    path: '/shipping-line/containers',
    label: 'Khai báo container',
    icon: 'inventory_2',
    roles: [ROLES.SHIPPING_LINE],
    showForAdmin: false,
  },
  {
    path: '/shipping-line/dashboard',
    label: 'Tổng Quan Hoạt Động',
    icon: 'dashboard',
    roles: [ROLES.SHIPPING_LINE],
  },
  {
    path: '/shipping-line/voyages',
    label: 'Tàu & Chuyến Tàu',
    icon: 'directions_boat',
    roles: [ROLES.SHIPPING_LINE],
  },
  {
    path: '/shipping-line/import-documents',
    label: 'Hồ Sơ Hàng Nhập',
    icon: 'move_to_inbox',
    roles: [ROLES.SHIPPING_LINE],
    showForAdmin: false,
  },
  {
    path: '/shipping-line/manifest',
    label: 'Bản Khai Hàng Hóa (Manifest)',
    icon: 'description',
    roles: [ROLES.SHIPPING_LINE],
    showForAdmin: false,
  },
  {
    path: '/shipping-line/delivery-orders',
    label: 'Lệnh Giao Hàng (eDO)',
    icon: 'assignment_turned_in',
    roles: [ROLES.SHIPPING_LINE],
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
    path: '/admin/shipping-lines',
    label: 'Danh Mục Hãng Tàu',
    icon: 'directions_boat',
    roles: [ROLES.ADMINISTRATOR],
  },
  {
    path: '/admin/gates',
    label: 'Quản Lý Cổng Bãi',
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



  // ── TRANSPORT COMPANY (Doanh Nghiệp Vận Tải) ───────────────────
  {
    path: '/booking',
    label: 'Danh Sách Lịch Hẹn',
    icon: 'calendar_month',
    roles: [ROLES.TRANSPORT_COMPANY, ROLES.CARRIER_STAFF],
  },
  {
    path: '/my-bills',
    label: 'Vận Đơn Của Tôi',
    icon: 'receipt_long',
    roles: [ROLES.TRANSPORT_COMPANY, ROLES.CARRIER_STAFF],
  },
  {
    path: '/import-documents',
    label: 'Chứng Từ Hàng Nhập',
    icon: 'inventory',
    roles: [ROLES.TRANSPORT_COMPANY, ROLES.CARRIER_STAFF],
  },
  {
    path: '/drivers',
    label: 'Tài Xế & Phương Tiện',
    icon: 'local_shipping',
    roles: [ROLES.TRANSPORT_COMPANY, ROLES.CARRIER_STAFF],
  },
  {
    path: '/carrier-staff',
    label: 'Quản Lý Nhân Viên',
    icon: 'manage_accounts',
    roles: [ROLES.TRANSPORT_COMPANY],
  },
  {
    path: '/users',
    label: 'Phân Quyền Vai Trò',
    icon: 'manage_accounts',
    roles: [ROLES.ADMINISTRATOR],
  },
]


// Tên role hiển thị ở đầu mỗi trang (tiếng Việt)
const ROLE_BADGES = {
  [ROLES.SHIPPING_LINE]: 'HÃNG TÀU & VẬN TẢI BIỂN',
  [ROLES.TRANSPORT_COMPANY]: 'CÔNG TY VẬN TẢI',
  [ROLES.CARRIER_STAFF]: 'NHÂN VIÊN DOANH NGHIỆP',
  [ROLES.DISPATCHER]: 'KHÔNG GIAN ĐIỀU ĐỘ',
  [ROLES.YARD_OPERATOR]: 'KHAI THÁC BÃI',
  [ROLES.GATE_OFFICER]: 'KIỂM SOÁT CỔNG',
  [ROLES.ADMINISTRATOR]: 'QUẢN TRỊ HỆ THỐNG',
}

// Các trang tự dựng đầu trang riêng (kèm nút chức năng) hoặc không cần đầu trang: layout không vẽ khối đầu trang
const PAGES_WITH_OWN_HEADER = new Set([
  '/shipping-line/dashboard', '/shipping-line/voyages', '/shipping-line/manifest', '/shipping-line/import-documents', '/shipping-line/delivery-orders',
  '/import-documents', '/my-bills', '/services', '/yard-staff/gate-out-preparation',
  '/gate/dashboard', '/gate/incidents', '/gate/history', '/gate/camera',
  '/dispatch', '/dispatch-history', '/dispatcher/cameras',
  // Trang không hiển thị khối đầu trang
  '/dispatcher/gate-bookings',
])

export default function MainLayout({ previewUser = null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const catalogPage = ['/services', '/admin/service-catalog'].includes(location.pathname)
  const [clock, setClock] = useState('--:--:--')
  const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
  const user = previewUser || (stored ? JSON.parse(stored) : { username: 'Khách', role: 'None' })

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString('vi-VN'))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = async () => {
    if (previewUser) { navigate('/login'); return }
    try {
      const apiBase = import.meta.env.VITE_API_URL || '/api'
      const token = localStorage.getItem('token') || sessionStorage.getItem('token')
      await fetch(`${apiBase}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      }).catch(() => { })
    } catch (_) { }
    localStorage.removeItem('user')
    sessionStorage.removeItem('user')
    localStorage.removeItem('token')
    sessionStorage.removeItem('token')
    navigate('/login')
  }

  // Lọc các sidebar items theo vai trò (Administrator chỉ thấy các trang quản trị trong ADMIN_MENU_PATHS)
  const visibleItems = sidebarItems.filter(item => previewUser
    ? item.path === '/yard'
    : user.role === ROLES.ADMINISTRATOR
      ? item.roles.includes(ROLES.ADMINISTRATOR) && ADMIN_MENU_PATHS.has(item.path)
      : item.roles.includes(user.role))
  // Các trang tổng quan luôn nằm đầu menu; thứ tự còn lại giữ nguyên
  const allowedItems = [...visibleItems.filter(item => OVERVIEW_PATHS.has(item.path)), ...visibleItems.filter(item => !OVERVIEW_PATHS.has(item.path))]

  // Xác định mục menu đang được chọn: ưu tiên khớp chính xác URL, nếu không có thì lấy mục cha có tiền tố dài nhất
  const activeItem = allowedItems.find(item => item.path === location.pathname) ||
    allowedItems
      .filter(item => location.pathname.startsWith(item.path + '/'))
      .sort((a, b) => b.path.length - a.path.length)[0]

  // Lấy tiêu đề trang hiện tại
  const currentTitle = previewUser ? 'Bản Đồ Bãi' : (activeItem?.label || 'Cổng Quản trị')

  const roleBadge = ROLE_BADGES[user.role]
  const showPageHeader = !previewUser && Boolean(roleBadge && activeItem) && !PAGES_WITH_OWN_HEADER.has(location.pathname)

  if (user.role === ROLES.DRIVER) {
    return (
      <div className="w-full min-h-screen bg-fog overflow-y-auto font-sans antialiased">
        <Suspense fallback={<div className="p-8 text-sm text-slate-500">Đang tải trang…</div>}><Outlet /></Suspense>
      </div>
    )
  }

  return (
    <div className={`flex h-screen w-full bg-slate-50 text-slate-800 font-sans antialiased overflow-hidden ${catalogPage ? 'epc-shell' : ''}`}>

      {/* ═══════════════════════════ SIDEBAR ═══════════════════════════ */}
      <aside className="w-[260px] min-w-[260px] h-screen bg-white border-r border-slate-200/90 flex flex-col z-20 flex-shrink-0 shadow-2xs">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
          <img
            src="/nexusport-logo.png"
            alt="NexusPort Logo"
            className="w-10 h-10 object-contain rounded-lg shadow-2xs border border-slate-100 flex-shrink-0"
          />
          <div>
            <h1 className="font-heading text-xl text-slate-900 flex items-center gap-0.5 font-bold leading-none tracking-tight">
              NexusPort<span className="text-[#ff6b00] text-2xl leading-none">.</span>
            </h1>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
              {user.role === 'Shipping Line' ? 'Cổng Doanh Nghiệp Hãng Tàu' : `${user.role} Portal`}
            </p>
          </div>
        </div>

        {/* MENU LINKS */}
        <nav className="flex-1 px-3.5 py-4 space-y-1.5 overflow-y-auto">
          {allowedItems.map((item) => {
            const isActive = activeItem?.path === item.path

            const linkClass = `group flex items-center px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${isActive
              ? 'bg-orange-50/80 text-orange-700 font-semibold shadow-2xs border border-orange-200/70'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`

            if (item.external) {
              return (
                <a
                  key={item.path}
                  href={item.path}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  <span className={`material-symbols-outlined mr-2.5 text-[18px] shrink-0 select-none flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${isActive ? 'bg-[#ff6b00] text-white shadow-2xs' : 'text-slate-400 group-hover:text-slate-600 bg-slate-50'
                    }`}>
                    {item.icon}
                  </span>
                  <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                </a>
              )
            }

            return (
              <Link
                key={item.path}
                to={previewUser ? '/preview/yard' : item.path}
                className={linkClass}
              >
                {/* Material Icon */}
                <span className={`material-symbols-outlined mr-2.5 text-[18px] shrink-0 select-none flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${isActive ? 'bg-[#ff6b00] text-white shadow-2xs' : 'text-slate-400 group-hover:text-slate-600 bg-slate-50'
                  }`}>
                  {item.icon}
                </span>
                <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                {item.badge && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-500 text-white rounded-full font-mono ml-2 shrink-0">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* USER PROFILE INFO & LOGOUT BUTTON */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 text-white flex justify-center items-center font-bold text-xs ring-2 ring-white shadow-2xs">
              {(user?.username || user?.name || user?.fullName || 'NP').substring(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <div className="text-xs font-bold text-slate-900 truncate">{user?.username || user?.name || user?.fullName || 'Người dùng'}</div>
              <div className="text-[10px] text-slate-500 truncate">{user?.role || 'Chưa định danh'}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 h-[32px] rounded-lg text-xs font-medium flex justify-center items-center gap-1.5 transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined text-[15px]">logout</span>
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ═══════════════════════════ MAIN CONTENT AREA ═══════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        {/* TOP BAR */}
        <header className="h-16 px-8 flex justify-between items-center border-b border-slate-200/90 bg-white flex-shrink-0 z-10 shadow-2xs">
          {catalogPage && <details key={location.pathname} className="epc-mobile-nav"><summary aria-label="Mở menu điều hướng"><span className="material-symbols-outlined">menu</span></summary><nav>{allowedItems.map(item => <Link key={item.path} to={item.path} aria-current={activeItem?.path === item.path ? 'page' : undefined}>{item.label}</Link>)}</nav></details>}
          <div className="text-slate-500 text-xs font-medium flex items-center gap-2">
            <span>
              {user.role === 'Shipping Line'
                ? 'Hãng Tàu'
                : 'Terminal Portal'}
            </span>
            <span className="material-symbols-outlined text-[14px] text-slate-300">chevron_right</span>
            <span className="text-slate-900 font-semibold text-sm">{currentTitle}</span>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">CẢNG TRỰC TIẾP</span>
              <span className="text-slate-900 font-mono font-semibold text-xs border-l border-slate-200 pl-2">{clock}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600 border-l border-slate-200 pl-5">
              <NotificationCenter />
              <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                <span className="material-symbols-outlined text-[18px]">account_circle</span>
              </div>
            </div>
          </div>
        </header>

        {/* CONTAINER CONTENT */}
        <main className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
          {showPageHeader && (
            <div className="px-6 md:px-8 pt-6 ">
              <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-extrabold bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full uppercase">{roleBadge}</span>
                  <h2 className="font-heading text-2xl font-extrabold text-carbon mt-1">{currentTitle}</h2>
                </div>
                {/* Trang nào cần nút ở đầu trang thì gắn vào đây (createPortal) */}
                <div id="page-header-actions" className="flex flex-wrap items-center gap-2.5" />
              </div>
            </div>
          )}
            <Suspense fallback={<div className="p-8 text-sm text-slate-500">Đang tải trang…</div>}><Outlet /></Suspense>
          </div>
        </main>
      </div>

    </div>
  )
}
