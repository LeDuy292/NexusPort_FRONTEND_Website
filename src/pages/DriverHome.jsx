import { useNavigate } from 'react-router-dom'
import styles from './DriverHome.module.css'

const trips = [
  { time: '13:00', gate: 'Gate C', container: 'MSCU1293', type: 'Drop-off', status: 'Confirmed' },
  { time: '15:45', gate: 'Gate B', container: 'TRLU5821', type: 'Pick-up', status: 'Pending' },
  { time: '18:00', gate: '', container: 'Depot Return', type: 'End of Shift', status: 'Scheduled' },
]

const statusStyle = {
  Confirmed: { bg: '#111', color: '#fff', border: '#111' },
  Pending: { bg: 'transparent', color: '#888', border: '#ddd' },
  Scheduled: { bg: 'transparent', color: '#aaa', border: '#e8e8e8' },
}

export default function DriverHome() {
  const navigate = useNavigate()
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>{greeting}, Marcus</h1>
          <p className={styles.date}>{dateStr}</p>
        </div>
        <button className={styles.backLink} onClick={() => navigate('/')}>← Back</button>
      </header>

      {/* Today's Assignment */}
      <div className={styles.assignCard}>
        <div className={styles.assignLeft}>
          <span className={styles.assignLabel}>TODAY'S ASSIGNMENT</span>
          <div className={styles.assignTime}>09:30</div>
          <div className={styles.assignDetail}>Gate A · CAIU992831</div>
          <div className={styles.assignCarrier}>Maersk Line</div>
          <button className={styles.directionsBtn} onClick={() => navigate('/navigate')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
            Get directions
          </button>
        </div>
        <div className={styles.assignIcon}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="1.5"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>
      </div>

      {/* Next Trip */}
      <div className={styles.nextCard}>
        <div>
          <div className={styles.nextLabel}>Next trip in</div>
          <div className={styles.nextTime}>2h 15m</div>
        </div>
        <div className={styles.clockRing}>
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="22" fill="none" stroke="#eee" strokeWidth="3.5" />
            <circle cx="26" cy="26" r="22" fill="none" stroke="#ff5c1a" strokeWidth="3.5"
              strokeLinecap="round" strokeDasharray="83 55" strokeDashoffset="34.5" />
            <text x="26" y="27" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#888" fontFamily="Inter">⏱</text>
          </svg>
        </div>
      </div>

      {/* All Trips */}
      <div className={styles.tripsSection}>
        <div className={styles.tripsTitle}>All trips</div>
        <div className={styles.tripsList}>
          {trips.map((t, i) => (
            <div key={i} className={styles.tripRow}>
              <div className={styles.tripTime}>{t.time}</div>
              <div className={styles.tripInfo}>
                <div className={styles.tripGate}>
                  {t.gate ? `${t.gate} · ` : ''}{t.container}
                </div>
                <div className={styles.tripType}>{t.type}</div>
              </div>
              <span
                className={styles.tripBadge}
                style={{
                  background: statusStyle[t.status].bg,
                  color: statusStyle[t.status].color,
                  border: `1.5px solid ${statusStyle[t.status].border}`,
                }}
              >
                {t.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Nav */}
      <nav className={styles.bottomNav}>
        {[
          { icon: '⊞', label: 'Home', active: true, path: '/driver' },
          { icon: '🚛', label: 'Gate', active: false, path: '/gate' },
          { icon: '✓', label: 'Confirm', active: false, path: '/confirm' },
          { icon: '👤', label: 'Profile', active: false, path: '/driver' },
        ].map((n, i) => (
          <button key={i} className={`${styles.navItem} ${n.active ? styles.navItemActive : ''}`} onClick={() => navigate(n.path)}>
            <span className={styles.navIcon}>{n.icon}</span>
          </button>
        ))}
        <div className={styles.navIndicator} />
      </nav>
    </div>
  )
}
