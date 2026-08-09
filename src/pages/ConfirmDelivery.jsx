import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './ConfirmDelivery.module.css'

export default function ConfirmDelivery() {
  const navigate = useNavigate()
  const [photoTaken, setPhotoTaken] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate('/navigate')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <span className={styles.topTitle}>PORT LOGISTICS</span>
        <button className={styles.bellBtn}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>
      </div>

      <div className={styles.content}>
        <h1 className={styles.title}>Confirm Delivery</h1>
        <p className={styles.subtitle}>Verify container details before final confirmation.</p>

        {/* Detail Card */}
        <div className={styles.detailCard}>
          <div className={styles.detailRow} style={{ borderLeft: '3.5px solid var(--orange)' }}>
            <div className={styles.detailIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
            <div>
              <div className={styles.detailLabel}>CONTAINER ID</div>
              <div className={styles.detailValue}>CAIU992831</div>
            </div>
          </div>

          <div className={styles.detailRow} style={{ borderLeft: '3.5px solid var(--orange)' }}>
            <div className={styles.detailIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div>
              <div className={styles.detailLabel}>LOCATION</div>
              <div className={styles.detailValue}>Block A-B05</div>
            </div>
          </div>

          <div className={styles.warningBanner}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>Ensure seals are intact before confirming pickup. Document any visible damage.</span>
          </div>
        </div>

        {/* Photo Card */}
        <div className={styles.photoCard} onClick={() => !photoTaken && setPhotoTaken(true)}>
          <div>
            <div className={styles.photoTitle}>Photo Proof Required</div>
            <div className={styles.photoSub}>
              {photoTaken ? '✓ Photo captured' : 'Take a picture of the container seal.'}
            </div>
          </div>
          <div className={`${styles.cameraBtn} ${photoTaken ? styles.cameraBtnDone : ''}`}>
            {photoTaken
              ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                </svg>
            }
          </div>
        </div>
      </div>

      {/* Confirm Button */}
      <div className={styles.footer}>
        {!confirmed
          ? <button
              className={`${styles.confirmBtn} ${!photoTaken ? styles.confirmBtnDisabled : ''}`}
              onClick={() => photoTaken && setConfirmed(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Confirm pickup complete
            </button>
          : <div className={styles.successBanner}>
              <span>🎉</span>
              <span>Pickup confirmed! Container status updated.</span>
            </div>
        }
      </div>

      {/* Bottom Nav */}
      <nav className={styles.bottomNav}>
        {['⊞', '🚛', '✓', '👤'].map((icon, i) => (
          <button key={i} className={`${styles.navItem} ${i === 3 ? styles.navItemActive : ''}`} onClick={() => i === 0 && navigate('/')}>
            <span>{icon}</span>
          </button>
        ))}
        <div className={styles.navIndicator} />
      </nav>
    </div>
  )
}
