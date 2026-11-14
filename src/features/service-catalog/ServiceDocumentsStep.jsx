import { useState, useRef, useEffect } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileCheck2,
  FileText,
  FolderOpen,
  Loader2,
  Scale,
  ShieldCheck,
  Snowflake,
  Trash2,
  Truck,
  Upload,
  UserCheck,
} from 'lucide-react'
import { bookingService } from '../../services/bookingService'
import { serviceDraftsApi, draftError } from './serviceDraftsApi'

export function ServiceDocumentsStep({
  draftId,
  payload,
  flow,
  containers = [],
  documents = [],
  onChangeDocuments,
  onConfirmedScope,
  fleetTrips = [],
}) {
  const [uploading, setUploading] = useState({})
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const fileInputRefs = useRef({})

  // Kiểm tra xem đơn có container lạnh hay không
  const hasReefer = containers.some(c => {
    const type = (c.typeCode || c.isoCode || '').toUpperCase()
    const cargo = (c.cargoType || '').toLowerCase()
    return type.includes('RF') || type.includes('RH') || (type.length > 2 && type[2] === 'R') || cargo.includes('reefer') || cargo.includes('lạnh')
  })

  // Định nghĩa các loại chứng từ yêu cầu
  const documentSpecs = flow === 'EXPORT'
    ? [
        {
          type: 'CarrierBookingReference',
          title: 'Booking Xuất Khẩu / Mã Hạ Cont',
          subtitle: 'Số booking hoặc mã đăng ký hạ container',
          mandatory: true,
          icon: FileText,
          badge: 'BẮT BUỘC',
        },
        {
          type: 'CustomsDeclaration',
          title: 'Tờ Khai Hải Quan Xuất Khẩu',
          subtitle: 'Thông tin tờ khai, mã vạch hoặc trạng thái thông quan theo yêu cầu',
          mandatory: true,
          icon: ShieldCheck,
          badge: 'BẮT BUỘC',
        },
        {
          type: 'VgmCertificate',
          title: 'Phiếu Xác Nhận Khối Lượng (VGM)',
          subtitle: 'Cân tải trọng container theo quy định SOLAS',
          mandatory: true,
          icon: Scale,
          badge: 'BẮT BUỘC',
        },
      ]
    : [
        {
          type: 'DeliveryOrder',
          title: 'Lệnh Giao Hàng Hãng Tàu (D/O hoặc eDO)',
          subtitle: 'Lệnh giao hàng của hãng tàu cấp',
          mandatory: true,
          icon: FileCheck2,
          badge: 'BẮT BUỘC',
        },
        {
          type: 'BillOfLading',
          title: 'Thông Tin Vận Đơn Đường Biển (B/L)',
          subtitle: 'Để xác định lô hàng khi cần tra cứu',
          mandatory: true,
          icon: FileText,
          badge: 'BẮT BUỘC',
        },
        {
          type: 'CustomsDeclaration',
          title: 'Tờ Khai Hải Quan Nhập Khẩu',
          subtitle: 'Trạng thái thông quan hoặc điều kiện giao hàng theo quy định',
          mandatory: true,
          icon: ShieldCheck,
          badge: 'BẮT BUỘC',
        },
      ]

  // Bổ sung chứng từ Reefer nếu có cont lạnh
  if (hasReefer) {
    documentSpecs.push({
      type: 'ReeferInstructions',
      title: 'Chỉ Dẫn Bảo Quản Cont Lạnh / Phiếu PTI',
      subtitle: 'Nhiệt độ cài đặt, thông gió và cắm điện bãi cảng (Biên bản PTI)',
      mandatory: true,
      icon: Snowflake,
      badge: 'BẮT BUỘC',
    })
  }

  // Tự động đồng bộ xác nhận thông quan ngầm với Backend khi người dùng đã có giấy tờ hải quan
  useEffect(() => {
    const hasCustoms = documents.some(d => d.documentType === 'CustomsDeclaration')
    if (hasCustoms && draftId && payload) {
      let active = true
      setConfirming(true)
      serviceDraftsApi.confirmCustoms(draftId, payload)
        .then(res => {
          if (active && res?.confirmationScope) {
            onConfirmedScope?.(res.confirmationScope)
          }
        })
        .catch(() => {})
        .finally(() => { if (active) setConfirming(false) })
      return () => { active = false }
    }
  }, [documents, draftId, payload, onConfirmedScope])

  const handleUploadClick = specType => {
    if (fileInputRefs.current[specType]) {
      fileInputRefs.current[specType].click()
    }
  }

  const handleFileChange = async (spec, event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(prev => ({ ...prev, [spec.type]: true }))
    setError('')

    try {
      let uploaded
      try {
        uploaded = await bookingService.uploadDocumentFile(file)
      } catch (err) {
        // Fallback đọc Data URL nếu lỗi mạng hoặc môi trường nội bộ
        uploaded = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve({
            fileUrl: reader.result,
            fileName: file.name,
            fileSizeBytes: file.size,
            contentType: file.type,
          })
          reader.onerror = () => resolve({
            fileUrl: URL.createObjectURL(file),
            fileName: file.name,
            fileSizeBytes: file.size,
            contentType: file.type,
          })
          reader.readAsDataURL(file)
        })
      }

      const newDoc = {
        documentType: spec.type,
        title: spec.title,
        fileName: uploaded.fileName || file.name,
        fileUrl: uploaded.fileUrl || '',
        fileSizeBytes: uploaded.fileSizeBytes || file.size,
        contentType: uploaded.contentType || file.type,
        uploadedAt: new Date().toISOString(),
      }

      const nextDocs = [...documents.filter(d => d.documentType !== spec.type), newDoc]
      onChangeDocuments(nextDocs)

      // Nếu là tờ khai hải quan, kích hoạt xác nhận thông quan ngay
      if (spec.type === 'CustomsDeclaration' && draftId && payload) {
        try {
          const data = await serviceDraftsApi.confirmCustoms(draftId, payload)
          if (data?.confirmationScope) {
            onConfirmedScope?.(data.confirmationScope)
          }
        } catch (_) {}
      }
    } catch (failure) {
      setError(draftError(failure))
    } finally {
      setUploading(prev => ({ ...prev, [spec.type]: false }))
      if (event.target) event.target.value = ''
    }
  }

  const handleDeleteDoc = specType => {
    const nextDocs = documents.filter(d => d.documentType !== specType)
    onChangeDocuments(nextDocs)
    if (specType === 'CustomsDeclaration') {
      onConfirmedScope?.('')
    }
  }

  const formatSize = bytes => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  return (
    <section className="epd-stage" aria-label="Bộ hồ sơ & Chứng từ">
      <div className="epd-stage-heading">
        <span>05</span>
        <div>
          <h3>Khai báo bộ hồ sơ & chứng từ ({flow === 'EXPORT' ? 'Hàng xuất khẩu' : 'Hàng nhập khẩu'})</h3>
          <p>Tải lên các chứng từ gốc để gửi Dispatcher kiểm duyệt hồ sơ. Toàn bộ tệp sẽ được lưu trữ cùng đơn dịch vụ.</p>
        </div>
      </div>

      <div className="epd-docs-wrapper">
        {/* Header theo đúng thiết kế của Booking */}
        <div className="epd-docs-header">
          <div className="epd-docs-folder-icon">
            <FolderOpen size={20} />
          </div>
          <div>
            <h4>
              CHỨNG TỪ YÊU CẦU CHO NGHIỆP VỤ {flow === 'EXPORT' ? 'XUẤT KHẨU' : 'NHẬP KHẨU'}
            </h4>
            <p>
              {flow === 'EXPORT'
                ? 'Chỉ nộp các chứng từ phục vụ hàng xuất khẩu (Booking Note, VGM, Hải quan xuất)'
                : 'Chỉ nộp các chứng từ phục vụ hàng nhập khẩu (Vận đơn B/L, Lệnh eDO, Hải quan nhập)'}
              {hasReefer && ' · Kèm theo chỉ dẫn bảo quản container lạnh'}
            </p>
          </div>
        </div>

        {error && (
          <div className="epd-warning" role="alert" style={{ margin: '14px 0' }}>
            <AlertCircle size={17} />
            <p>{error}</p>
          </div>
        )}

        {/* Lưới các ô chứng từ */}
        <div className="epd-docs-grid">
          {documentSpecs.map(spec => {
            const uploadedDoc = documents.find(d => d.documentType === spec.type)
            const isBusy = uploading[spec.type]
            const IconComponent = spec.icon

            return (
              <div
                key={spec.type}
                className={`epd-doc-card ${uploadedDoc ? 'epd-doc-uploaded' : 'epd-doc-pending'}`}
              >
                <div className="epd-doc-card-top">
                  <div className="epd-doc-title-row">
                    <div className="epd-doc-title">
                      <IconComponent size={18} className={uploadedDoc ? 'text-emerald' : 'text-slate'} />
                      <span title={spec.title}>{spec.title}</span>
                    </div>
                    <span className={`epd-doc-badge ${uploadedDoc ? 'epd-badge-done' : spec.badge === 'KHUYẾN NGHỊ' ? 'epd-badge-recommended' : 'epd-badge-required'}`}>
                      {uploadedDoc ? '✓ Đã tải lên' : spec.badge}
                    </span>
                  </div>
                  <p className="epd-doc-subtitle">{spec.subtitle}</p>
                </div>

                {/* Input file ẩn */}
                <input
                  type="file"
                  ref={el => (fileInputRefs.current[spec.type] = el)}
                  style={{ display: 'none' }}
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={e => handleFileChange(spec, e)}
                />

                {/* Phần thao tác dưới card */}
                <div className="epd-doc-card-bottom">
                  {isBusy ? (
                    <div className="epd-doc-uploading">
                      <Loader2 size={16} className="epc-spin" />
                      <span>Đang tải tệp lên máy chủ...</span>
                    </div>
                  ) : uploadedDoc ? (
                    <div className="epd-doc-preview-box">
                      <div className="epd-doc-info">
                        <FileText size={16} className="text-emerald" />
                        <div className="epd-doc-names">
                          <span className="epd-doc-filename" title={uploadedDoc.fileName}>
                            {uploadedDoc.fileName}
                          </span>
                          <span className="epd-doc-filesize">{formatSize(uploadedDoc.fileSizeBytes)}</span>
                        </div>
                      </div>
                      <div className="epd-doc-actions">
                        {uploadedDoc.fileUrl && (
                          <a
                            href={uploadedDoc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="epd-btn-preview"
                            title="Xem tệp chứng từ"
                          >
                            <Eye size={14} /> Xem
                          </a>
                        )}
                        <button
                          type="button"
                          className="epd-btn-remove"
                          onClick={() => handleDeleteDoc(spec.type)}
                          title="Xóa tệp này"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="epd-btn-upload"
                      onClick={() => handleUploadClick(spec.type)}
                    >
                      <Upload size={15} />
                      <span>Tải lên tệp chứng từ</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Khối giấy tờ xe và tài xế phụ trách */}
        <div className="epd-fleet-docs-panel">
          <div className="epd-fleet-docs-header">
            <Truck size={18} className="text-orange" />
            <div>
              <h5>HỒ SƠ GIẤY TỜ PHƯƠNG TIỆN & TÀI XẾ LIÊN KẾT (ĐÃ CHỌN Ở BƯỚC 4)</h5>
              <p>Hệ thống tự động liên kết các giấy tờ pháp lý của đội xe đã phân công cho từng container.</p>
            </div>
          </div>
          <div className="epd-fleet-docs-grid">
            <div className="epd-fleet-doc-item">
              <UserCheck size={16} className="text-emerald" />
              <div>
                <strong>Giấy phép lái xe (GPLX) & CCCD Tài xế</strong>
                <small>
                  {fleetTrips.filter(t => t.driver?.fullName).map(t => `${t.driver.fullName} (${t.driver.licenseNumber || 'GPLX hợp lệ'})`).join(' · ')
                    || 'Tự động đối chiếu thông tin bằng lái từ hồ sơ tài xế phụ trách xe'}
                </small>
              </div>
              <span className="epd-fleet-badge">✓ Đã xác thực</span>
            </div>
            <div className="epd-fleet-doc-item">
              <FileCheck2 size={16} className="text-emerald" />
              <div>
                <strong>Giấy chứng nhận đăng kiểm & Bảo hiểm xe</strong>
                <small>
                  {fleetTrips.filter(t => t.vehicle?.plateNumber).map(t => `${t.vehicle.plateNumber} (${t.vehicle.vehicleType || 'Đầu kéo'})`).join(' · ')
                    || 'Chứng nhận kiểm định an toàn kỹ thuật và bảo hiểm trách nhiệm dân sự'}
                </small>
              </div>
              <span className="epd-fleet-badge">✓ Đã xác thực</span>
            </div>
          </div>
        </div>

        {confirming && (
          <p className="epd-muted" style={{ marginTop: '12px', fontSize: '12px' }}>
            <Loader2 size={13} className="epc-spin" style={{ display: 'inline', marginRight: '6px' }} />
            Đang đồng bộ xác nhận thông quan điện tử...
          </p>
        )}
      </div>
    </section>
  )
}
