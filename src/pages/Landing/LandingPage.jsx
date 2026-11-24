import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ShieldCheck,
  Activity,
  Truck,
  Clock,
  Layers,
  ChevronDown,
  Anchor,
  Radio,
  Camera,
  CheckCircle2,
  Ship,
  Sparkles,
  Cpu,
  QrCode,
  MapPin,
  Workflow,
  BarChart3,
  Thermometer,
  FileCheck2,
  Gauge,
  Lock,
  ArrowUpRight
} from 'lucide-react'

// Video nền thực tế cảng biển
const PORT_VIDEO_SRC = '/port.mp4'
const FALLBACK_POSTER = '/gate-camera-truck.png'

// 7 TÁC NHÂN PHỐI HỢP CỦA NEXUSPORT (Chuẩn theo sơ đồ vận hành cảng Tiên Sa)
const ACTORS_7 = [
  {
    role: 'ADMINISTRATOR',
    title: 'Administrator',
    subtitle: 'Quản trị hệ thống',
    desc: 'Cấu hình hệ thống, phân quyền, biểu phí và nhật ký vận hành.',
    badge: 'Admin Portal',
    icon: ShieldCheck,
    tag: 'Core System'
  },
  {
    role: 'DISPATCHER',
    title: 'Dispatcher',
    subtitle: 'Điều phối viên',
    desc: 'Giám sát bãi, luồng xe, kế hoạch đảo chuyển và cẩu RTG.',
    badge: 'Dispatch Hub',
    icon: Activity,
    tag: 'Yard Monitoring'
  },
  {
    role: 'TRANSPORT COMPANY',
    title: 'Transport Company',
    subtitle: 'Doanh nghiệp vận tải',
    desc: 'Quản lý booking, xe, tài xế và nhận hàng/trả container.',
    badge: 'Carrier Portal',
    icon: Truck,
    tag: 'Fleet & e-EIR'
  },
  {
    role: 'TRUCK DRIVER',
    title: 'Truck Driver',
    subtitle: 'Tài xế container',
    desc: 'Nhận chỉ dẫn số đến đúng Block và Bay qua ứng dụng di động.',
    badge: 'Driver App',
    icon: Radio,
    tag: 'Mobile Navigation'
  },
  {
    role: 'GATE OFFICER',
    title: 'Gate Officer',
    subtitle: 'Nhân viên cổng',
    desc: 'Xử lý cảnh báo và ngoại lệ tại cổng, kiểm soát làn xe ra/vào.',
    badge: 'Smart Gate',
    icon: Camera,
    tag: 'OCR Exception'
  },
  {
    role: 'YARD CRANE OPERATOR',
    title: 'Yard Crane Operator',
    subtitle: 'Tài xế cẩu RTG',
    desc: 'Nhận, thực hiện và xác nhận lệnh nâng hạ container trên cabin.',
    badge: 'Yard Crane Ops',
    icon: Anchor,
    tag: 'RTG Terminal'
  },
  {
    role: 'SHIPPING LINE',
    title: 'Shipping Line',
    subtitle: 'Hãng tàu đối tác',
    desc: 'Quản lý lịch tàu/chuyến, khai báo Manifest điện tử và đồng bộ danh sách container.',
    badge: 'Shipping Portal',
    icon: Ship,
    tag: 'Manifest & B/L'
  },
]

// 6 TÍNH NĂNG & PHÂN HỆ NỔI BẬT CỦA NEXUSPORT
const CORE_FEATURES = [
  {
    id: 'gate-ocr',
    title: 'Cổng Tự Động Smart Gate & OCR 4.0',
    category: 'Vận hành cổng',
    desc: 'Camera AI nhận diện biển số đầu kéo, rơ-moóc và mã số container ISO 6346. Tự động đối soát lệnh e-EIR và điều khiển barie thông xe dưới 3 phút.',
    icon: Cpu,
    stats: '< 3 phút/xe',
    statsLabel: 'Thời gian thông xe',
    actionText: 'Trải nghiệm Cổng',
    actionLink: '/gate',
    highlight: true
  },
  {
    id: 'rtg-dispatch',
    title: 'Thuật Toán Điều Phối Cẩu RTG & Smart Route',
    category: 'Tối ưu hoá bãi',
    desc: 'Mô phỏng mặt bãi 3D thời gian thực. Tự động tính toán vị trí bốc dỡ tối ưu (Block - Bay - Row - Tier), cắt giảm 45% thời gian đảo chuyển cẩu bãi.',
    icon: Workflow,
    stats: '-45%',
    statsLabel: 'Lãng phí đảo chuyển',
    actionText: 'Bàn Điều Phối',
    actionLink: '/dashboard',
    highlight: false
  },
  {
    id: 'e-eir-booking',
    title: 'Cổng Đặt Lịch Xe & Khai Báo e-EIR Điện Tử',
    category: 'Doanh nghiệp vận tải',
    desc: 'Doanh nghiệp vận tải đăng ký khung giờ hẹn trước, tải lệnh giao nhận điện tử e-EIR và tự động tính toán biểu phí lưu bãi cảng minh bạch.',
    icon: FileCheck2,
    stats: '100% Online',
    statsLabel: 'Không dùng giấy tờ',
    actionText: 'Đặt Lịch Booking',
    actionLink: '/booking',
    highlight: false
  },
  {
    id: 'driver-app',
    title: 'Dẫn Đường Số & Check-in QR Cho Tài Xế',
    category: 'Ứng dụng di động',
    desc: 'Tài xế nhận mã QR check-in không cần rời cabin. Bản đồ số hướng dẫn xe chạy thẳng đến đúng chân cẩu bãi đang chờ, loại bỏ ùn tắc cục bộ.',
    icon: QrCode,
    stats: '99.4%',
    statsLabel: 'Đúng vị trí Block/Bay',
    actionText: 'Driver Portal',
    actionLink: '/driver-portal',
    highlight: false
  },
  {
    id: 'shipping-manifest',
    title: 'Phân Hệ Hãng Tàu (Shipping Line & Manifest)',
    category: 'Hàng hải quốc tế',
    desc: 'Quản lý hải trình tàu cập/rời bến, nạp Manifest điện tử tự động, quản lý vận đơn B/L và phát hành lệnh giao hàng D/O thông suốt với hải quan.',
    icon: Ship,
    stats: 'EDI / Excel',
    statsLabel: 'Đồng bộ tự động',
    actionText: 'Cổng Hãng Tàu',
    actionLink: '/shipping-line/dashboard',
    highlight: false
  },
  {
    id: 'reefer-telemetry',
    title: 'Giám Sát Container Lạnh (Reefer 24/7)',
    category: 'Giám sát chuyên dụng',
    desc: 'Theo dõi nhiệt độ, độ ẩm và sự cố nguồn điện container lạnh theo thời gian thực qua SignalR. Cảnh báo tức thì cho kỹ thuật viên bảo dưỡng.',
    icon: Thermometer,
    stats: 'Real-time',
    statsLabel: 'Cảnh báo nhiệt độ',
    actionText: 'Giám Sát Bãi',
    actionLink: '/yard',
    highlight: false
  }
]

// QUY TRÌNH THÔNG XE 5 BƯỚC
const WORKFLOW_STEPS = [
  { step: '01', title: 'Đặt hẹn e-EIR', desc: 'Hãng vận tải đặt khung giờ hẹn và khai báo e-EIR trên hệ thống.' },
  { step: '02', title: 'Quét OCR tại Cổng', desc: 'Camera AI chụp biển số, số container và tự động đối soát lệnh.' },
  { step: '03', title: 'Cấp lộ trình Smart Route', desc: 'Tài xế nhận ngay chỉ dẫn số đến chính xác vị trí cẩu RTG qua App.' },
  { step: '04', title: 'Cẩu RTG Nâng Hạ', desc: 'Tài xế cẩu xác nhận lệnh bốc dỡ hoàn tất tức thì trên cabin.' },
  { step: '05', title: 'Thông xe Cổng Ra', desc: 'Barie cổng ra tự động mở khi xe hoàn tất toàn bộ thủ tục bãi.' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const videoRef = useRef(null)

  const [isVideoLoaded, setIsVideoLoaded] = useState(false)
  const [user, setUser] = useState(null)

  // Kiểm tra tài khoản đã đăng nhập
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
      if (stored) setUser(JSON.parse(stored))
    } catch {
      setUser(null)
    }
  }, [])

  // Tự động phát video port.mp4 khi mount
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = true

    const handleLoadedData = () => {
      setIsVideoLoaded(true)
      video.play().catch((err) => {
        console.warn('Video autoplay prevented:', err)
      })
    }

    video.addEventListener('loadeddata', handleLoadedData)
    if (video.readyState >= 2) {
      handleLoadedData()
    }

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData)
    }
  }, [])

  // Cuộn trang mượt mà
  const scrollToSection = (id) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Điều hướng chính
  const handleMainAction = () => {
    if (user) {
      navigate('/dashboard')
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="relative w-full min-h-screen bg-[#0B0F17] text-white font-sans scroll-smooth">
      
      {/* =========================================================================
          HERO SECTION FULL SCREEN (Chứa Video Background & Hero Content)
          ========================================================================= */}
      <section className="relative w-full h-screen overflow-hidden flex flex-col justify-between">
        
        {/* VIDEO NỀN CẢNG BIỂN CHẠY TỰ ĐỘNG, KHÔNG CÓ NÚT GÂY RỐI */}
        <div className="absolute inset-0 z-0">
          <video
            ref={videoRef}
            poster={FALLBACK_POSTER}
            autoPlay
            muted
            loop
            playsInline
            className={`w-full h-full object-cover brightness-105 contrast-105 transition-opacity duration-1000 ${
              isVideoLoaded ? 'opacity-95' : 'opacity-60'
            }`}
          >
            <source src={PORT_VIDEO_SRC} type="video/mp4" />
            <source src="/port/port.mp4" type="video/mp4" />
          </video>

          {/* Lớp phủ sáng tạo độ tương phản cao cho chữ */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/30 to-black/20 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F17]/75 via-[#0B0F17]/25 to-transparent pointer-events-none" />
          
          {/* Subtle grid mesh overlay */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
              backgroundSize: '32px 32px'
            }}
          />
        </div>

        {/* GLASSMORPHIC NAVIGATION HEADER */}
        <header className="relative z-20 w-full pt-5 px-4 sm:px-8 md:px-12">
          <nav className="max-w-7xl mx-auto flex items-center justify-between px-5 py-3.5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.45)] transition-all duration-300 hover:border-white/20">
            
            {/* Logo NexusPort */}
            <div 
              onClick={() => navigate('/')} 
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff682c] to-[#d84d16] flex items-center justify-center shadow-[0_0_22px_rgba(255,104,44,0.45)] group-hover:scale-105 transition-transform overflow-hidden">
                <img 
                  src="/nexusport-logo.png" 
                  alt="NexusPort" 
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xl font-extrabold tracking-tight text-white flex items-center">
                  <span>NexusPort</span>
                  <span className="text-[#ff682c]">.</span>
                </div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Cảng Tiên Sa • OS</p>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-300">
              <button 
                onClick={() => scrollToSection('features')} 
                className="hover:text-[#ff682c] transition-colors"
              >
                Tính năng cốt lõi
              </button>
              <button 
                onClick={() => scrollToSection('actors')} 
                className="hover:text-[#ff682c] transition-colors flex items-center gap-1.5"
              >
                <span>7 Tác nhân</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#ff682c]/20 text-[#ff682c] font-bold">Chuẩn hóa</span>
              </button>
              <button 
                onClick={() => scrollToSection('workflow')} 
                className="hover:text-[#ff682c] transition-colors"
              >
                Quy trình thông xe
              </button>
              <a 
                href="/gate" 
                onClick={(e) => { e.preventDefault(); navigate('/gate'); }} 
                className="hover:text-[#ff682c] transition-colors"
              >
                Cổng tự động OCR
              </a>
            </div>

            {/* Header Action: Chỉ 1 nút duy nhất rõ ràng */}
            <div className="flex items-center gap-3.5">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Tiên Sa Live</span>
              </div>

              {user ? (
                <button
                  onClick={handleMainAction}
                  className="px-5 py-2.5 rounded-xl bg-[#ff682c] hover:bg-[#ff5714] text-white text-xs md:text-sm font-bold tracking-wide shadow-[0_0_22px_rgba(255,104,44,0.45)] hover:shadow-[0_0_30px_rgba(255,104,44,0.65)] transition-all active:scale-95 flex items-center gap-2"
                >
                  <span>Bàn làm việc ({user.name || user.username})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="px-5 py-2.5 rounded-xl bg-[#ff682c] hover:bg-[#ff5714] text-white text-xs md:text-sm font-bold tracking-wide shadow-[0_0_20px_rgba(255,104,44,0.4)] hover:shadow-[0_0_28px_rgba(255,104,44,0.6)] transition-all active:scale-95 flex items-center gap-2"
                >
                  <span>Đăng nhập hệ thống</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </nav>
        </header>

        {/* HERO CONTENT VỊ TRÍ GÓC DƯỚI BÊN TRÁI (BOTTOM-LEFT) */}
        <div className="relative z-10 px-5 sm:px-10 md:px-14 lg:px-16 pb-8 md:pb-12 max-w-4xl">
          
          {/* Sub-badge tín hiệu */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-[#ff682c]/40 text-[#ff682c] text-xs font-semibold tracking-wider uppercase mb-3.5 w-fit shadow-[0_0_15px_rgba(255,104,44,0.25)]">
            <Activity className="w-3.5 h-3.5 animate-pulse text-[#ff682c]" />
            <span>Hệ thống điều phối cảng biển thông minh thế hệ mới</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] font-black tracking-tight leading-[1.1] mb-4 text-white drop-shadow-md">
            Tự động hóa luồng xe,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff682c] via-[#ff8a50] to-[#ffa066]">
              tối ưu vận hành cảng.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm md:text-base text-slate-200 leading-relaxed mb-6 max-w-2xl font-normal drop-shadow">
            Rút ngắn thời gian thông xe qua cổng từ <span className="text-white font-bold">10–15 phút xuống dưới 3 phút</span>. 
            AI nhận diện biển số & e-EIR tự động, giải quyết triệt để nút thắt cổ chai và giảm <span className="text-[#ff682c] font-bold">45%</span> thời gian 
            đảo chuyển cẩu bãi RTG.
          </p>

          {/* Nút hành động chính */}
          <div className="flex flex-wrap items-center gap-3.5 mb-7">
            <button 
              onClick={handleMainAction}
              className="px-6 py-3.5 rounded-xl bg-[#ff682c] hover:bg-[#ff5714] text-white font-bold text-sm flex items-center gap-2.5 shadow-[0_0_25px_rgba(255,104,44,0.5)] hover:shadow-[0_0_35px_rgba(255,104,44,0.7)] transition-all duration-300 hover:scale-[1.02] active:scale-95"
            >
              <span>{user ? 'Vào bàn làm việc' : 'Đăng nhập hệ thống'}</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </button>

            <button 
              onClick={() => scrollToSection('features')}
              className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 text-white font-semibold text-sm flex items-center gap-2 hover:border-[#ff682c]/50 transition-all hover:scale-[1.02] active:scale-95"
            >
              <span>Khám phá tính năng</span>
              <ChevronDown className="w-4 h-4 text-slate-300" />
            </button>
          </div>

          {/* KPI Strip (Đã cập nhật: 7 Bên Phối Hợp) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 border-t border-white/15 max-w-2xl">
            <div className="bg-black/45 backdrop-blur-md p-3 rounded-xl border border-white/10 hover:border-[#ff682c]/40 transition-colors">
              <div className="text-[#ff682c] text-base sm:text-lg font-black flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>&lt; 3 Phút</span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5">Thông xe / Làn</p>
            </div>

            <div className="bg-black/45 backdrop-blur-md p-3 rounded-xl border border-white/10 hover:border-emerald-500/40 transition-colors">
              <div className="text-white text-base sm:text-lg font-black flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>99.4%</span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5">Chính xác OCR & e-EIR</p>
            </div>

            <div className="bg-black/45 backdrop-blur-md p-3 rounded-xl border border-white/10 hover:border-[#ff682c]/40 transition-colors">
              <div className="text-[#ff682c] text-base sm:text-lg font-black flex items-center gap-1">
                <span>-45%</span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5">Lãng phí đảo RTG</p>
            </div>

            <div className="bg-black/45 backdrop-blur-md p-3 rounded-xl border border-white/10 hover:border-blue-400/40 transition-colors">
              <div className="text-white text-base sm:text-lg font-black flex items-center gap-1">
                <Truck className="w-4 h-4 text-sky-400" />
                <span>7 Tác Nhân</span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5">Phối hợp đồng bộ</p>
            </div>
          </div>

        </div>

        {/* NÚT CUỘN XUỐNG DƯỚI (SCROLL DOWN INDICATOR) */}
        <button
          onClick={() => scrollToSection('features')}
          className="absolute bottom-5 right-6 md:right-12 z-20 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 hover:border-[#ff682c]/50 text-xs text-slate-300 hover:text-white transition-all group shadow-lg"
        >
          <span>Khám phá chi tiết</span>
          <ChevronDown className="w-4 h-4 text-[#ff682c] group-hover:translate-y-0.5 transition-transform animate-bounce" />
        </button>

      </section>

      {/* =========================================================================
          SECTION 2: CÁC CHỨC NĂNG CHÍNH CỦA NEXUSPORT (BENTO GRID CARDS)
          ========================================================================= */}
      <section id="features" className="relative z-10 py-24 px-5 sm:px-10 md:px-14 lg:px-20 max-w-7xl mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#ff682c]/10 border border-[#ff682c]/30 text-[#ff682c] text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Nền Tảng Điều Hành Toàn Diện</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            Tính Năng Cốt Lõi Vận Hành Cảng
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Kết nối liền mạch toàn bộ các phân hệ từ cổng cảng, bãi xe, cẩu RTG đến hãng tàu và doanh nghiệp vận tải.
          </p>
        </div>

        {/* Bento Grid Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CORE_FEATURES.map((feat) => {
            const Icon = feat.icon
            return (
              <div 
                key={feat.id}
                className={`relative group rounded-3xl p-7 transition-all duration-300 flex flex-col justify-between overflow-hidden ${
                  feat.highlight 
                    ? 'bg-gradient-to-b from-[#ff682c]/15 via-white/[0.04] to-black/40 border border-[#ff682c]/40 shadow-[0_12px_40px_rgba(255,104,44,0.15)] hover:border-[#ff682c]' 
                    : 'bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-[#ff682c]/50 hover:shadow-[0_12px_35px_rgba(0,0,0,0.5)]'
                } hover:-translate-y-2`}
              >
                {/* Glow effect on hover */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#ff682c]/10 rounded-full blur-3xl pointer-events-none group-hover:bg-[#ff682c]/20 transition-all duration-500" />

                <div>
                  {/* Top card header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ff682c]/20 to-black/30 border border-[#ff682c]/30 text-[#ff682c] flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(255,104,44,0.2)]">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                      {feat.category}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#ff682c] transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed mb-6 font-normal">
                    {feat.desc}
                  </p>
                </div>

                {/* Bottom stats and action */}
                <div className="pt-5 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-lg font-black text-[#ff682c] block">{feat.stats}</span>
                    <span className="text-[11px] text-slate-400">{feat.statsLabel}</span>
                  </div>
                  
                  <button
                    onClick={() => navigate(feat.actionLink)}
                    className="p-2.5 rounded-xl bg-white/5 group-hover:bg-[#ff682c] text-slate-300 group-hover:text-white transition-all shadow-sm flex items-center justify-center"
                    title={feat.actionText}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>

              </div>
            )
          })}
        </div>

      </section>

      {/* =========================================================================
          SECTION 3: 7 TÁC NHÂN, MỘT QUY TRÌNH PHỐI HỢP (CHUẨN SLIDE)
          ========================================================================= */}
      <section id="actors" className="relative z-10 py-24 bg-gradient-to-b from-black/50 via-[#0e131e] to-black/60 border-y border-white/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-10 md:px-14 lg:px-20">
          
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#ff682c]/10 border border-[#ff682c]/30 text-[#ff682c] text-xs font-bold uppercase tracking-wider mb-3">
              <Workflow className="w-3.5 h-3.5" />
              <span>Cơ Chế Phối Hợp Đa Bên</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
              7 tác nhân,{' '}
              <span className="text-[#ff682c]">một quy trình phối hợp</span>
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Mỗi tác nhân đảm nhiệm một vai trò số hóa chuyên biệt, kết nối thời gian thực trên một trục dữ liệu duy nhất.
            </p>
          </div>

          {/* 7 Actors Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {ACTORS_7.map((actor, idx) => {
              const IconComp = actor.icon
              const isShipping = actor.role === 'SHIPPING LINE'
              return (
                <div 
                  key={idx}
                  className={`group rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between hover:-translate-y-1.5 ${
                    isShipping 
                      ? 'bg-gradient-to-b from-[#ff682c]/10 to-white/[0.02] border-[#ff682c]/40 hover:border-[#ff682c] sm:col-span-2 lg:col-span-1'
                      : 'bg-white/[0.025] hover:bg-white/[0.06] border-white/10 hover:border-[#ff682c]/50'
                  }`}
                >
                  <div>
                    {/* Top row */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-black/40 border border-[#ff682c]/30 text-[#ff682c] flex items-center justify-center group-hover:scale-110 group-hover:bg-[#ff682c] group-hover:text-white transition-all shadow-[0_0_15px_rgba(255,104,44,0.15)]">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-400 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                        {actor.tag}
                      </span>
                    </div>

                    {/* Role Title */}
                    <div className="mb-2">
                      <h4 className="text-base font-bold text-white group-hover:text-[#ff682c] transition-colors flex items-center gap-1.5">
                        <span>{actor.title}</span>
                      </h4>
                      <p className="text-xs text-slate-400 font-medium">{actor.subtitle}</p>
                    </div>

                    {/* Description (Khớp 100% nội dung slide) */}
                    <p className="text-xs text-slate-300 leading-relaxed mb-4">
                      {actor.desc}
                    </p>
                  </div>

                  {/* Bottom Footer Badge */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#ff682c] uppercase tracking-wider">
                      {actor.badge}
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 4: QUY TRÌNH THÔNG XE 5 BƯỚC KHÉP KÍN
          ========================================================================= */}
      <section id="workflow" className="relative z-10 py-24 px-5 sm:px-10 md:px-14 lg:px-20 max-w-7xl mx-auto">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#ff682c]/10 border border-[#ff682c]/30 text-[#ff682c] text-xs font-bold uppercase tracking-wider mb-3">
            <Gauge className="w-3.5 h-3.5" />
            <span>Luồng Vận Hành Tối Ưu</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
            Quy Trình Thông Xe Khép Kín
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Từ khi xe bắt đầu đặt lịch đến lúc hoàn tất nâng hạ và xuất cổng, mọi thao tác đều được số hóa hoàn toàn.
          </p>
        </div>

        {/* Workflow Stepper */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {WORKFLOW_STEPS.map((wf, idx) => (
            <div 
              key={idx}
              className="relative p-6 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-[#ff682c]/50 transition-all duration-300 hover:-translate-y-1 group"
            >
              <div className="text-2xl font-black text-[#ff682c]/40 group-hover:text-[#ff682c] font-mono mb-3 transition-colors">
                {wf.step}
              </div>
              <h4 className="text-base font-bold text-white mb-2 group-hover:text-[#ff682c] transition-colors">
                {wf.title}
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {wf.desc}
              </p>
            </div>
          ))}
        </div>

      </section>

      {/* =========================================================================
          SECTION 5: BOTTOM CALL TO ACTION & FOOTER
          ========================================================================= */}
      <footer className="relative z-10 border-t border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-10 md:px-14 lg:px-20 py-16">
          
          {/* Big CTA Banner */}
          <div className="relative rounded-3xl p-8 sm:p-12 bg-gradient-to-r from-[#ff682c]/20 via-black to-[#ff682c]/10 border border-[#ff682c]/30 mb-16 overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-xl">
              <span className="text-xs uppercase font-bold text-[#ff682c] tracking-widest block mb-2">Sẵn sàng vận hành</span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
                Trải nghiệm hệ thống điều phối cảng biển NexusPort
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Đăng nhập ngay để truy cập trung tâm điều phối thông minh, bãi container 3D và hệ thống giám sát cổng tự động.
              </p>
            </div>
            
            <button
              onClick={handleMainAction}
              className="px-8 py-4 rounded-2xl bg-[#ff682c] hover:bg-[#ff5714] text-white font-bold text-base shadow-[0_0_30px_rgba(255,104,44,0.5)] hover:shadow-[0_0_40px_rgba(255,104,44,0.7)] transition-all hover:scale-105 active:scale-95 whitespace-nowrap flex items-center gap-2"
            >
              <span>{user ? 'Vào Bàn Làm Việc' : 'Đăng Nhập Ngay'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Footer Bottom */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 pt-6 border-t border-white/10">
            <div className="flex items-center gap-3">
              <span className="font-bold text-white text-sm">NexusPort<span className="text-[#ff682c]">.</span></span>
              <span>•</span>
              <span>Hệ thống Quản lý & Điều phối Cảng Biển Thông Minh</span>
            </div>
            <div>
              © 2026 NexusPort. Cảng Tiên Sa, Đà Nẵng, Việt Nam.
            </div>
          </div>

        </div>
      </footer>

    </div>
  )
}
