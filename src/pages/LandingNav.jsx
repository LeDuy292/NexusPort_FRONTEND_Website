import { useNavigate } from 'react-router-dom'
import styles from './LandingNav.module.css'

const webAdminScreens = [
  {
    path: '/equipment-dispatch',
    label: 'Equipment Dispatch System',
    desc: 'Điều phối thiết bị cảng (RTG Crane, Xe nâng, Kanban & Priority Queue)',
    icon: '🚜',
  },
  {
    path: '/cargo',
    label: 'Special Cargo Declaration',
    desc: 'Khai báo hàng lạnh (Reefer), nguy hiểm (DG)',
    icon: '📋',
  },
  {
    path: '/damage-report',
    label: 'Container Damage Report',
    desc: 'Báo cáo vị trí & mức độ hư hỏng container 3D',
    icon: '⚠️',
  },
  {
    path: '/carrier-profile',
    label: 'Carrier Company Profile',
    desc: 'Hồ sơ công ty hãng tàu & Người đại diện',
    icon: '🏢',
  },
  {
    path: '/berth',
    label: 'Berth Operations Staff',
    desc: 'Theo dõi tiến độ bốc dỡ tàu biển & Phân bổ cẩu',
    icon: '🚢',
  },
]

const mobileScreens = [
  {
    path: '/driver',
    label: 'Driver Home App',
    desc: 'Trang chủ tài xế, xem nhiệm vụ & lịch trình',
    icon: '🚛',
  },
  {
    path: '/gate',
    label: 'Gate OCR Check-in',
    desc: 'Camera AI quét biển số xe & container',
    icon: '📷',
  },
  {
    path: '/navigate',
    label: 'Port Navigation GPS',
    desc: 'Dẫn đường di chuyển từ cổng đến ô bãi',
    icon: '🗺️',
  },
  {
    path: '/confirm',
    label: 'Confirm Delivery & Receipt',
    desc: 'Xác nhận giao nhận, chụp niêm phong & e-EIR',
    icon: '✅',
  },
]

export default function LandingNav() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⚓</span>
          <span className={styles.logoText}>NexusPort Navigation Hub</span>
        </div>
        <p className={styles.subtitle}>Smart Port Gate & Container Management System</p>
      </div>

      <div style={{ maxWidth: '1000px', width: '100%', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Section 1: Web Admin Dashboard */}
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: '#ff682c', display: 'flex', alignItems: 'center', gap: '8px' }}>
            💻 Phân hệ Web Admin Dashboard (Giao diện Máy tính / Desktop)
          </h2>
          <div className={styles.grid}>
            {webAdminScreens.map((s) => (
              <button
                key={s.path}
                className={`${styles.card} ${styles.cardDark}`}
                onClick={() => navigate(s.path)}
              >
                <span className={styles.cardIcon}>{s.icon}</span>
                <div>
                  <div className={styles.cardLabel}>{s.label}</div>
                  <div className={styles.cardDesc}>{s.desc}</div>
                </div>
                <span className={styles.arrow}>→</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Mobile App */}
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📱 Phân hệ Mobile App (Giao diện Điện thoại Tài xế / Cổng)
          </h2>
          <div className={styles.grid}>
            {mobileScreens.map((s) => (
              <button
                key={s.path}
                className={`${styles.card} ${styles.cardLight}`}
                onClick={() => navigate(s.path)}
              >
                <span className={styles.cardIcon}>{s.icon}</span>
                <div>
                  <div className={styles.cardLabel}>{s.label}</div>
                  <div className={styles.cardDesc}>{s.desc}</div>
                </div>
                <span className={styles.arrow}>→</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.badge} style={{ marginTop: '24px' }}>CP_SEP490 · Group NexusPort · 2026</div>
    </div>
  )
}
