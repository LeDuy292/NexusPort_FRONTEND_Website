import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './PortNavigation.module.css'

const steps = [
  { num: 1, text: 'Turn right at Block B', sub: 'In 150m' },
  { num: 2, text: 'Continue straight to Gate A', sub: '' },
]

export default function PortNavigation() {
  const navigate = useNavigate()
  const [routeEnded, setRouteEnded] = useState(false)

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <button className={styles.menuBtn}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <span className={styles.topTitle}>PORT LOGISTICS</span>
        <button className={styles.bellBtn}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>
      </div>

      {/* Port Map */}
      <div className={styles.mapArea}>
        <svg viewBox="0 0 320 220" className={styles.map} xmlns="http://www.w3.org/2000/svg">
          {/* Roads */}
          <rect x="0" y="0" width="320" height="220" fill="#f0f0f0"/>
          <rect x="100" y="0" width="48" height="220" fill="#e0e0e0"/>
          <rect x="0" y="90" width="320" height="40" fill="#e0e0e0"/>

          {/* Blocks */}
          <rect x="148" y="10" width="80" height="70" rx="4" fill="#d8d8d8" stroke="#c0c0c0" strokeWidth="1"/>
          <text x="188" y="50" textAnchor="middle" dominantBaseline="central" fontSize="13" fill="#888" fontFamily="Inter" fontWeight="500">BLOCK B</text>

          <rect x="20" y="140" width="72" height="64" rx="4" fill="#d8d8d8" stroke="#c0c0c0" strokeWidth="1"/>
          <text x="56" y="172" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#888" fontFamily="Inter" fontWeight="500">BLOCK C</text>

          {/* GATE A box */}
          <rect x="232" y="12" width="72" height="36" rx="4" fill="#fff" stroke="#d0d0d0" strokeWidth="1.5"/>
          <text x="268" y="30" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#555" fontFamily="Inter" fontWeight="600">GATE A</text>

          {/* Dashed route path */}
          <path
            d="M 124 108 L 234 108 L 234 32 L 232 30"
            fill="none" stroke="#ff5c1a" strokeWidth="2.5" strokeDasharray="6 4"
            strokeLinecap="round"
          />

          {/* Current position dot */}
          <circle cx="124" cy="108" r="12" fill="#ff5c1a" opacity="0.25"/>
          <circle cx="124" cy="108" r="7" fill="#ff5c1a"/>
          <text x="124" y="108" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#fff">▲</text>

          {/* Gate A Entry label */}
          <rect x="136" y="88" width="84" height="24" rx="12" fill="#fff" stroke="#e0e0e0" strokeWidth="1"/>
          <text x="156" y="100" dominantBaseline="central" fontSize="9" fill="#ff5c1a" fontFamily="Inter" fontWeight="700">▲ </text>
          <text x="162" y="100" dominantBaseline="central" fontSize="9" fill="#444" fontFamily="Inter" fontWeight="600">Gate A Entry</text>
        </svg>
      </div>

      {/* Turn Instructions */}
      <div className={styles.stepsArea}>
        {steps.map((s) => (
          <div key={s.num} className={styles.stepRow}>
            <div className={styles.stepNum}>{s.num}</div>
            <div>
              <div className={styles.stepText}>{s.text}</div>
              {s.sub && <div className={styles.stepSub}>{s.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* ETA Footer */}
      <div className={styles.etaBar}>
        <div>
          <div className={styles.etaText}>ETA: 8 min</div>
          <div className={styles.etaDist}>1.2 km remaining</div>
        </div>
        <button
          className={styles.endBtn}
          onClick={() => { setRouteEnded(true); setTimeout(() => navigate('/confirm'), 800) }}
        >
          {routeEnded ? 'Arriving...' : 'End Route'}
        </button>
      </div>

      {/* Bottom Nav */}
      <nav className={styles.bottomNav}>
        {['⊞', '🚛', '✓', '👤'].map((icon, i) => (
          <button key={i} className={`${styles.navItem} ${i === 1 ? styles.navItemActive : ''}`} onClick={() => i === 0 && navigate('/')}>
            <span>{icon}</span>
          </button>
        ))}
        <div className={styles.navIndicator} />
      </nav>
    </div>
  )
}
