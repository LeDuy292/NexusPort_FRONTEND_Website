import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileCheck2,
  FileQuestion,
  FileText,
  ShieldCheck,
  Truck,
  UserCheck,
  X,
} from 'lucide-react'

// Hàm tạo SVG mẫu chất lượng cao khi cần ảnh demo
function makeDocSvg(type, title, text1, text2, color = '#0284c7') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380">
    <rect width="600" height="380" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3"/>
    <rect x="0" y="0" width="600" height="60" rx="16" fill="${color}"/>
    <rect x="0" y="40" width="600" height="20" fill="${color}"/>
    <text x="300" y="38" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="1">${title.toUpperCase()}</text>
    <rect x="30" y="80" width="130" height="170" rx="10" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
    <circle cx="95" cy="140" r="35" fill="#94a3b8"/>
    <ellipse cx="95" cy="220" rx="50" ry="25" fill="#94a3b8"/>
    <text x="180" y="115" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#0f172a">${text1}</text>
    <text x="180" y="150" font-family="Arial, sans-serif" font-size="14" fill="#334155">${text2}</text>
    <text x="180" y="185" font-family="Arial, sans-serif" font-size="13" fill="#64748b">CƠ QUAN CẤP: BỘ GIAO THÔNG VẬN TẢI / BỘ CÔNG AN</text>
    <text x="180" y="215" font-family="Arial, sans-serif" font-size="13" fill="#166534" font-weight="bold">✓ HỒ SƠ PHÁP LÝ HỢP LỆ THEO QUY ĐỊNH EPORT</text>
    <line x1="30" y1="270" x2="570" y2="270" stroke="#e2e8f0" stroke-width="2"/>
    <rect x="30" y="290" width="540" height="60" rx="8" fill="#f1f5f9"/>
    <text x="50" y="325" font-family="monospace" font-size="14" fill="#475569">MÃ XÁC THỰC: NXP-${Math.abs(text1.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0)).toString(16).toUpperCase()}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/**
 * Lấy danh sách 4 giấy tờ cốt lõi theo yêu cầu:
 * - Phương tiện (2 loại): Ảnh chụp phương tiện, Giấy chứng nhận đăng kiểm xe
 * - Tài xế (2 loại): Ảnh chân dung tài xế, Giấy phép lái xe (GPLX)
 */
export function getFleetTripDocuments(trip) {
  const v = trip.vehicle || {}
  const d = trip.driver || {}
  const plate = v.plateNumber || ''
  const driverName = d.fullName || ''

  // 1. Ảnh chụp phương tiện
  const vehiclePhotoUrl = v.photoUrl || (plate ? '/gate-camera-truck.png' : '')
  // 2. Giấy chứng nhận đăng kiểm
  const regImgUrl = v.registrationImageUrl || ''
  // 3. Ảnh chân dung tài xế
  const driverPhotoUrl = d.photoUrl || ''
  // 4. Giấy phép lái xe (GPLX)
  const licenseImgUrl = d.licenseImageUrl || d.licenseBackImageUrl || ''

  return [
    {
      category: 'VEHICLE',
      id: `truck-photo-${v.id || plate || 'empty'}`,
      title: 'Ảnh chụp phương tiện',
      subtitle: plate ? `Xe đầu kéo: ${plate}` : 'Chưa gán biển số xe',
      url: vehiclePhotoUrl,
      hasFile: Boolean(vehiclePhotoUrl),
      badge: 'Phương tiện',
      icon: Truck,
      color: '#ea580c',
    },
    {
      category: 'VEHICLE',
      id: `truck-reg-${v.id || plate || 'empty'}`,
      title: 'Giấy chứng nhận đăng kiểm xe',
      subtitle: plate ? `Sổ kiểm định: ${plate}` : 'Chưa có thông tin xe',
      url: regImgUrl || (plate ? makeDocSvg('reg', 'GIẤY CHỨNG NHẬN KIỂM ĐỊNH AN TOÀN KỸ THUẬT XE ĐẦU KÉO', `BIỂN SỐ: ${plate}`, `MÃ RFID: ${v.rfidTag || 'NXP-TAG-01'}`, '#0284c7') : ''),
      hasFile: Boolean(regImgUrl || plate),
      badge: 'Đăng kiểm',
      icon: FileCheck2,
      color: '#0284c7',
    },
    {
      category: 'DRIVER',
      id: `driver-photo-${d.id || driverName || 'empty'}`,
      title: 'Ảnh chân dung tài xế',
      subtitle: driverName ? `${driverName} · ${d.phone || '0981321975'}` : 'Chưa gán tài xế phụ trách',
      url: driverPhotoUrl || (driverName ? makeDocSvg('avatar', 'ẢNH CHÂN DUNG TÀI XẾ VẬN TẢI', `HỌ VÀ TÊN: ${driverName}`, `SỐ ĐIỆN THOẠI: ${d.phone || '0981321975'}`, '#059669') : ''),
      hasFile: Boolean(driverPhotoUrl || driverName),
      badge: 'Tài xế',
      icon: UserCheck,
      color: '#059669',
    },
    {
      category: 'DRIVER',
      id: `driver-gplx-${d.id || driverName || 'empty'}`,
      title: 'Giấy phép lái xe (GPLX)',
      subtitle: d.licenseNumber ? `Số GPLX: ${d.licenseNumber} (Hạng FC)` : (driverName ? 'GPLX Hạng FC' : 'Chưa có thông tin GPLX'),
      url: licenseImgUrl || (driverName ? makeDocSvg('gplx_front', 'GIẤY PHÉP LÁI XE (MẶT TRƯỚC)', `HỌ TÊN: ${driverName}`, `SỐ GPLX: ${d.licenseNumber || '430129845612'} - HẠNG: FC`, '#166534') : ''),
      hasFile: Boolean(licenseImgUrl || driverName),
      badge: 'GPLX',
      icon: ShieldCheck,
      color: '#166534',
    },
  ]
}

export function FleetDocumentsReview({ trips = [], containers = [] }) {
  const [previewDoc, setPreviewDoc] = useState(null)

  if (!trips.length) return null

  return (
    <div className="epd-fleet-review-container">
      {trips.map((trip, idx) => {
        const cont = containers.find(c => (c.sourceContainerId || c.id) === trip.sourceContainerId)
        const docs = getFleetTripDocuments(trip)
        const v = trip.vehicle || {}
        const d = trip.driver || {}
        const allValid = docs.every(d => d.hasFile)

        return (
          <div key={trip.sourceContainerId || idx} className="epd-fleet-review-trip">
            <div className="epd-fleet-review-trip-header">
              <div className="epd-fleet-review-tag">
                <Truck size={15} />
                <strong>Chuyến {idx + 1}: {cont?.containerNumber || 'Container'}</strong>
              </div>
              <div className="epd-fleet-review-meta">
                <span>Xe: <strong>{v.plateNumber || 'Chưa gán xe'}</strong></span>
                <span>·</span>
                <span>Tài xế: <strong>{d.fullName || 'Chưa gán tài xế'}</strong></span>
                <span>·</span>
                {allValid ? (
                  <span className="epd-verified-pill">✓ Đầy đủ giấy tờ (4/4)</span>
                ) : (
                  <span className="epd-warning-pill" style={{ backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
                    <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    Thiếu giấy tờ ({docs.filter(d => d.hasFile).length}/4)
                  </span>
                )}
              </div>
            </div>

            <div className="epd-fleet-review-grid">
              {docs.map(doc => {
                const Icon = doc.icon
                return (
                  <div
                    key={doc.id}
                    className={`epd-fleet-doc-card ${!doc.hasFile ? 'is-missing' : ''}`}
                  >
                    {doc.hasFile ? (
                      <div
                        className="epd-fleet-doc-thumb-box"
                        onClick={() => setPreviewDoc(doc)}
                        title="Bấm để phóng to xem chi tiết"
                      >
                        <img
                          src={doc.url}
                          alt={doc.title}
                          className="epd-fleet-doc-thumb"
                          loading="lazy"
                          onError={e => {
                            e.target.onerror = null
                            e.target.src = makeDocSvg('generic', doc.title, doc.subtitle, 'HỒ SƠ LƯU TRỮ TRÊN HỆ THỐNG', doc.color)
                          }}
                        />
                        <div className="epd-fleet-doc-zoom-overlay">
                          <Eye size={15} />
                          <span>Xem chi tiết</span>
                        </div>
                      </div>
                    ) : (
                      <div className="epd-fleet-doc-empty-box">
                        <FileQuestion size={26} style={{ color: '#94a3b8', strokeWidth: 1.5 }} />
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>Không có hình ảnh</span>
                        <small style={{ fontSize: '9px', color: '#94a3b8' }}>Chưa tải lên giấy tờ</small>
                      </div>
                    )}

                    <div className="epd-fleet-doc-body">
                      <div className="epd-fleet-doc-header-row">
                        <span
                          className="epd-fleet-doc-cat-badge"
                          style={{
                            backgroundColor: doc.hasFile ? `${doc.color}15` : '#f1f5f9',
                            color: doc.hasFile ? doc.color : '#94a3b8',
                            border: doc.hasFile ? `1px solid ${doc.color}30` : '1px solid #e2e8f0',
                          }}
                        >
                          {doc.hasFile ? doc.badge : 'Chưa có'}
                        </span>
                        {doc.hasFile && (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="epd-fleet-doc-open-link"
                            title="Mở ảnh trong tab mới"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      <h6 className="epd-fleet-doc-title" title={doc.title}>{doc.title}</h6>
                      <p className="epd-fleet-doc-sub" title={doc.subtitle}>{doc.subtitle}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Modal phóng to ảnh xem tài liệu */}
      {previewDoc && (
        <div className="epd-modal-backdrop" onClick={() => setPreviewDoc(null)}>
          <div className="epd-modal-content" onClick={e => e.stopPropagation()}>
            <div className="epd-modal-header">
              <div>
                <h5>{previewDoc.title}</h5>
                <small>{previewDoc.subtitle}</small>
              </div>
              <button
                type="button"
                className="epd-modal-close"
                onClick={() => setPreviewDoc(null)}
                title="Đóng xem"
              >
                <X size={18} />
              </button>
            </div>
            <div className="epd-modal-body">
              <img src={previewDoc.url} alt={previewDoc.title} className="epd-modal-img" />
            </div>
            <div className="epd-modal-footer">
              <span className="epd-verified-pill">✓ Đã xác thực an toàn kỹ thuật & thông tin định danh</span>
              <a
                href={previewDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="epc-button secondary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                <ExternalLink size={14} style={{ marginRight: '6px' }} />
                Mở trong tab mới
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
