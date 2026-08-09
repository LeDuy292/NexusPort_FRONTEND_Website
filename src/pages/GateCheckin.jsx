import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './GateCheckin.module.css'

const STAGES = ['scanning', 'detected', 'confirmed']

export default function GateCheckin() {
  const navigate = useNavigate()
  const [stage, setStage] = useState(0)
  const [plateText, setPlateText] = useState('')

  // Simulate OCR detection sequence
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 2500)
    const t2 = setTimeout(() => {
      setStage(2)
      setPlateText('51H-24681')
    }, 4800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const isScanning = stage === 0
  const isDetected = stage >= 1
  const isConfirmed = stage === 2

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.topBar}>
        <div className={styles.userInfo}>
          <span className={styles.userName}>Welcome, JOHN DOE</span>
          <span className={styles.truckInfo}>Truck: XF-1234</span>
        </div>
        <span className={styles.laneLabel}>GATE CHECK-IN – LANE A4</span>
        <button className={styles.backBtn} onClick={() => navigate('/')}>✕</button>
      </div>

      {/* Sidebar */}
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <button className={styles.sideBtn} title="Home" onClick={() => navigate('/')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
          <button className={styles.sideBtn} title="History">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
          <button className={styles.sideBtn} title="Settings">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </aside>

        {/* Camera View */}
        <div className={styles.cameraArea}>
          {/* Fake camera scene */}
          <div className={styles.cameraScene}>
            <div className={styles.truckScene}>
              <div className={styles.nightSky} />
              <div className={styles.truckSilhouette}>🚛</div>
              <div className={styles.gatePole} />

              {/* OCR Scan frame */}
              {!isConfirmed && (
                <div className={styles.scanFrame}>
                  {isScanning && (
                    <>
                      <div className={styles.scanTitle}>GATE CHECK-IN</div>
                      <div className={styles.scanSub}>Align license plate within frame</div>
                      <div className={styles.corner} style={{ top: 0, left: 0 }} />
                      <div className={styles.corner} style={{ top: 0, right: 0 }} />
                      <div className={styles.corner} style={{ bottom: 0, left: 0 }} />
                      <div className={styles.corner} style={{ bottom: 0, right: 0 }} />
                      <div className={styles.scanLine} />
                    </>
                  )}
                  {isDetected && !isConfirmed && (
                    <>
                      <div className={styles.detectedPlate}>{plateText || '51H-24...'}</div>
                      <div className={styles.scanSub}>Plate detected — confirming...</div>
                    </>
                  )}
                </div>
              )}

              {/* REC indicator */}
              <div className={styles.recIndicator}>
                <span className={styles.recDot} />
                REC
              </div>

              {/* Confirmed overlay */}
              {isConfirmed && (
                <div className={styles.confirmedOverlay}>
                  <div className={styles.confirmedCheck}>✓</div>
                  <div className={styles.confirmedPlate}>{plateText}</div>
                  <div className={styles.confirmedLabel}>Plate Confirmed</div>
                </div>
              )}
            </div>

            {/* Camera Footer Bar */}
            <div className={styles.cameraBar}>
              <span className={styles.camBarInfo}>Gate 4 of 6</span>
              <div className={styles.camBarProgress}>
                <div className={styles.camBarFill} style={{ width: isDetected ? '70%' : '30%' }} />
              </div>
              <span className={styles.camBarWait}>Estimated Wait: 15 mins</span>
              <button
                className={styles.confirmTruckBtn}
                onClick={() => { setStage(2); setPlateText('51H-24681') }}
                disabled={isConfirmed}
              >
                {isConfirmed ? '✓ Confirmed' : 'Confirm Truck'}
              </button>
            </div>
          </div>

          {/* Status Bubble when confirmed */}
          {!isDetected && (
            <div className={styles.statusBubble}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinIcon}>
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
              </svg>
              Awaiting plate detection...
            </div>
          )}

          {isConfirmed && (
            <div className={styles.actionBar}>
              <button className={styles.proceedBtn} onClick={() => navigate('/navigate')}>
                Proceed to Yard →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Nav */}
      <nav className={styles.bottomNav}>
        {['⊞', '🚛', '✓', '👤'].map((icon, i) => (
          <button key={i} className={`${styles.navItem} ${i === 1 ? styles.navItemActive : ''}`}>
            <span>{icon}</span>
          </button>
        ))}
        <div className={styles.navIndicator} />
      </nav>
    </div>
  )
}
