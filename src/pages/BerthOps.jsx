import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './BerthOps.module.css'

const vessels = [
  { id: 'MV PACIFIC STAR', imo: '9123456', berth: 'B-04', status: 'Unloading', progress: 67, hatches: [100, 85, 40, 10] },
  { id: 'EVER GIVEN', imo: '9811000', berth: 'B-01', status: 'Waiting', progress: 0, hatches: [0, 0, 0, 0] },
  { id: 'CMA CGM MARCO POLO', imo: '9454450', berth: 'B-07', status: 'Complete', progress: 100, hatches: [100, 100, 100, 100] },
]

function CircularProgress({ value }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const dash = (value / 100) * circ

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className={styles.ring}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="#333" strokeWidth="10" />
      <circle
        cx="70" cy="70" r={r} fill="none"
        stroke={value === 100 ? '#22c55e' : '#ff5c1a'}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ * 0.25}
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x="70" y="70" textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="26" fontWeight="700" fontFamily="Inter">
        {value}%
      </text>
      <text x="70" y="95" textAnchor="middle" dominantBaseline="central" fill="#888" fontSize="12" fontFamily="Inter">
        Total Progress
      </text>
    </svg>
  )
}

export default function BerthOps() {
  const navigate = useNavigate()
  const [activeIdx, setActiveIdx] = useState(0)
  const [hatches, setHatches] = useState(vessels[0].hatches)
  const [vessel, setVessel] = useState(vessels[0])
  const [showUpdate, setShowUpdate] = useState(false)
  const [draftHatches, setDraftHatches] = useState([...vessels[0].hatches])
  const [showIncident, setShowIncident] = useState(false)
  const [incidentText, setIncidentText] = useState('')

  const switchVessel = (idx) => {
    setActiveIdx(idx)
    setVessel(vessels[idx])
    setHatches(vessels[idx].hatches)
    setDraftHatches([...vessels[idx].hatches])
  }

  const avgProgress = Math.round(hatches.reduce((a, b) => a + b, 0) / hatches.length)

  const statusColor = { Unloading: '#ff5c1a', Waiting: '#f59e0b', Complete: '#22c55e' }

  return (
    <div className={styles.page}>
      {/* Top Navbar */}
      <nav className={styles.navbar}>
        <span className={styles.brand}>PORT OPS</span>
        <div className={styles.navRight}>
          <button className={styles.navBtn} title="Notifications">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
          <button className={styles.navBtn} title="Settings">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <div className={styles.avatar}>B</div>
          <button className={styles.backBtn} onClick={() => navigate('/')}>← Back</button>
        </div>
      </nav>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Vessel Info Card */}
        <div className={styles.vesselCard}>
          <div>
            <h1 className={styles.vesselName}>{vessel.id}</h1>
            <p className={styles.vesselMeta}>IMO: {vessel.imo} &nbsp;•&nbsp; Berth: {vessel.berth}</p>
          </div>
          <span className={styles.statusBadge} style={{ borderColor: statusColor[vessel.status], color: statusColor[vessel.status] }}>
            <span className={styles.statusDot} style={{ background: statusColor[vessel.status] }} />
            {vessel.status}
          </span>
        </div>

        {/* Complete Unloading Button */}
        {vessel.status === 'Unloading' && (
          <button className={styles.completeBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Complete Unloading
          </button>
        )}

        {/* Progress Card */}
        <div className={styles.progressCard}>
          <div className={styles.circleArea}>
            <CircularProgress value={avgProgress} />
          </div>
          <div className={styles.hatchArea}>
            {hatches.map((v, i) => (
              <div key={i} className={styles.hatchRow}>
                <span className={styles.hatchLabel}>Hatch {i + 1}</span>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${v}%`, background: v === 100 ? '#22c55e' : '#ff5c1a' }} />
                </div>
                <span className={styles.hatchPct}>{v}%</span>
              </div>
            ))}
            <button className={styles.updateBtn} onClick={() => setShowUpdate(true)}>
              Update progress
            </button>
          </div>
        </div>

        {/* Report Incident Button */}
        <button className={styles.incidentBtn} onClick={() => setShowIncident(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff5c1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Report incident
        </button>
      </main>

      {/* Bottom Vessel Tabs */}
      <footer className={styles.footer}>
        {vessels.map((v, i) => (
          <button
            key={v.id}
            className={`${styles.vesselTab} ${i === activeIdx ? styles.vesselTabActive : ''}`}
            onClick={() => switchVessel(i)}
          >
            {i === activeIdx && <span className={styles.tabDot} />}
            {v.id}
          </button>
        ))}
      </footer>

      {/* Update Progress Modal */}
      {showUpdate && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Update Hatch Progress</h3>
            {draftHatches.map((v, i) => (
              <div key={i} className={styles.modalRow}>
                <label className={styles.modalLabel}>Hatch {i + 1}</label>
                <input
                  type="range" min="0" max="100" value={v}
                  onChange={e => { const d = [...draftHatches]; d[i] = +e.target.value; setDraftHatches(d) }}
                  className={styles.slider}
                />
                <span className={styles.modalPct}>{v}%</span>
              </div>
            ))}
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowUpdate(false)}>Cancel</button>
              <button className={styles.modalSave} onClick={() => { setHatches([...draftHatches]); setShowUpdate(false) }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Incident Modal */}
      {showIncident && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Report Incident</h3>
            <textarea
              className={styles.incidentInput}
              placeholder="Describe the incident at the berth..."
              value={incidentText}
              onChange={e => setIncidentText(e.target.value)}
              rows={5}
            />
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowIncident(false)}>Cancel</button>
              <button className={styles.modalSave} style={{ background: '#ef4444' }} onClick={() => { setIncidentText(''); setShowIncident(false) }}>Submit Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
