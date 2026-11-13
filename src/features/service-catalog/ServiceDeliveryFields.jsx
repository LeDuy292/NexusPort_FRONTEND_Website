import { AlertCircle, Anchor, ClipboardCheck, FileText, Loader2, ShieldCheck, Trash2, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { draftError, serviceDraftsApi } from './serviceDraftsApi'
import { validContainer } from './serviceDeliveryRules'
import ServiceTripFleet from './ServiceTripFleet'

function Field({ label, required, children, wide = false, hint }) {
  return (
    <label className={`epd-field ${wide ? 'epd-wide' : ''}`}>
      <span>
        {label}
        {required && <b className="epd-required"> *</b>}
      </span>
      {children}
      {hint && <small className="epd-field-hint">{hint}</small>}
    </label>
  )
}

export function CustomsStep({ draftId, payload, confirmed, onConfirmed, sampleMode, flow }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [checking, setChecking] = useState(false)

  // Tự động kiểm tra trạng thái Hải quan / Cờ Hold khi mở bước 4
  useEffect(() => {
    let active = true
    async function autoCheck() {
      if (sampleMode) return
      setChecking(true)
      try {
        const data = await serviceDraftsApi.checkCustoms(draftId, payload)
        if (active) setResult(data)
      } catch (e) {
        // bỏ qua lỗi kiểm tra ngầm nếu có
      } finally {
        if (active) setChecking(false)
      }
    }
    autoCheck()
    return () => { active = false }
  }, [draftId, payload, sampleMode])

  const confirm = async () => {
    if (busy || confirmed) return
    setBusy(true)
    setError('')
    try {
      const data = await serviceDraftsApi.confirmCustoms(draftId, payload)
      if (!data.confirmationScope) throw new Error('Chưa nhận được xác nhận thông quan. Vui lòng thử lại.')
      setResult(data)
      onConfirmed(data.confirmationScope)
    } catch (failure) {
      setError(draftError(failure))
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="epd-stage" aria-label="Xác nhận thông quan">
      <div className="epd-stage-heading">
        <span>04</span>
        <div>
          <h3>Xác nhận điều kiện thông quan & giải phóng hàng ({flow === 'EXPORT' ? 'Hàng xuất' : 'Hàng nhập'})</h3>
          <p>Hệ thống tự động đồng bộ kết quả hải quan và cờ Hold. Bấm xác nhận để hoàn tất chuyển sang khai báo giao nhận.</p>
        </div>
      </div>
      <div className="epd-customs-card">
        <ShieldCheck size={32} />
        <h4>{confirmed ? 'Đã xác nhận thông quan' : 'Tự động kiểm tra điều kiện thông quan & Hold'}</h4>
        <p>Xác nhận áp dụng cho toàn bộ container đang chọn trong hồ sơ. Khi đổi chứng từ hoặc danh sách container, bạn cần xác nhận lại.</p>

        {checking && <div style={{ fontSize: '12px', color: '#64748b' }}><Loader2 size={14} className="epc-spin" style={{ display: 'inline', marginRight: '6px' }} />Đang kiểm tra cờ Hold và dữ liệu thông quan…</div>}

        {result && (
          <div role="status" style={{ textAlign: 'left', width: '100%', maxWidth: '480px', margin: '12px auto', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
            <div style={{ fontWeight: 600, marginBottom: '6px', color: '#166534' }}>Kết quả kiểm tra hải quan & cảng:</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {(result.items || payload?.lines || []).map(item => (
                <li key={item.sourceContainerId || item.containerNumber} style={{ padding: '4px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cont: <strong>{item.containerNumber || 'Cont'}</strong></span>
                  <span style={{ color: '#16a34a', fontWeight: 500 }}>✓ Đủ điều kiện qua khu vực giám sát</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="epd-muted">Dữ liệu được xác thực tự động với Hải quan VASSCM và phần mềm quản lý cảng NexusPort.</p>
        <button
          type="button"
          className="epc-button primary"
          disabled={busy || sampleMode || confirmed}
          onClick={confirm}
        >
          {busy ? <Loader2 size={16} className="epc-spin" /> : <ClipboardCheck size={16} />}
          {confirmed ? 'Đã xác nhận đủ điều kiện' : '1-Click Xác nhận thông quan'}
        </button>
        {error && (
          <div className="epd-warning" role="alert">
            <AlertCircle size={17} />
            <p>{error}</p>
          </div>
        )}
      </div>
    </section>
  )
}

export function DeliveryFields({ delivery, buyer, onDelivery, onBuyer, flow, sourceExpiry, request, containers, sampleMode }) {
  const mode = delivery.transportMode
  const hasExpiry = Boolean(delivery.orderValidUntil)

  const toggleExpiry = checked => {
    if (checked) {
      onDelivery('orderValidUntil', sourceExpiry || new Date().toISOString().slice(0, 10))
    } else {
      onDelivery('orderValidUntil', '')
    }
  }

  return (
    <section className="epd-stage" aria-label="Khai báo giao nhận">
      <div className="epd-stage-heading">
        <span>05</span>
        <div>
          <h3>Khai báo giao nhận</h3>
          <p>Lựa chọn phương tiện giao nhận (Xe hoặc Sà lan) và thông tin xuất hóa đơn.</p>
        </div>
      </div>

      <div className="epd-flow" role="group" aria-label="Phương tiện giao nhận">
        {[
          ['TRUCK', 'Xe đầu kéo / Xe tải', Truck],
          ['BARGE', 'Sà lan', Anchor],
        ].map(([value, title, Icon]) => (
          <button
            type="button"
            key={value}
            aria-pressed={mode === value}
            onClick={() => onDelivery('transportMode', value)}
          >
            <Icon size={22} />
            <span>
              {title}
              <small>{value === 'TRUCK' ? 'Giao nhận đường bộ (xe)' : 'Giao nhận đường thủy (sà lan)'}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="epd-source-box">
        <div className="epd-section-label">
          <Truck size={17} />
          <h4>Thông tin phương tiện</h4>
        </div>
        <div className="epd-form-grid">
          {mode === 'TRUCK' ? (
            <ServiceTripFleet request={request} containers={containers} disabled={sampleMode}
              onTrips={trips => onDelivery('trips', trips)} />
          ) : (
            <>
              <Field label="Tên sà lan" required>
                <input
                  aria-label="Tên sà lan"
                  maxLength={150}
                  value={delivery.bargeName}
                  onChange={event => onDelivery('bargeName', event.target.value)}
                  placeholder="Tên phương tiện sà lan"
                />
              </Field>
              <Field label="Năm sà lan" required>
                <input
                  aria-label="Năm sà lan"
                  type="number"
                  min={1900}
                  max={2200}
                  value={delivery.bargeYear ?? ''}
                  onChange={event => onDelivery('bargeYear', event.target.value ? Number(event.target.value) : null)}
                  placeholder="Năm đóng / đăng kiểm"
                />
              </Field>
              <Field label="Số chuyến sà lan" required>
                <input
                  aria-label="Số chuyến sà lan"
                  maxLength={80}
                  value={delivery.bargeVoyage}
                  onChange={event => onDelivery('bargeVoyage', event.target.value)}
                  placeholder="Số chuyến"
                />
              </Field>
            </>
          )}

          <div className="epd-wide epd-expiry-wrapper">
            <label className="epd-checkbox-inline">
              <input
                type="checkbox"
                checked={hasExpiry}
                onChange={event => toggleExpiry(event.target.checked)}
              />
              <span>Lệnh có hạn lệnh (tích chọn để thiết lập ngày hết hạn lệnh)</span>
            </label>
            {hasExpiry && (
              <Field label={`Ngày hạn lệnh ${sourceExpiry ? `(Tối đa ${sourceExpiry})` : ''}`} required>
                <input
                  aria-label="Hạn lệnh giao nhận"
                  type="date"
                  max={sourceExpiry || undefined}
                  value={delivery.orderValidUntil || ''}
                  onChange={event => onDelivery('orderValidUntil', event.target.value)}
                />
              </Field>
            )}
          </div>
        </div>
        <p className="epd-muted">
          Nếu không chọn hạn điện lạnh và lưu bãi ở bước trước, thời gian sẽ tự lấy theo ngày “hạn lệnh” tại đây (hoặc hạn DO/eDO).
        </p>
      </div>

      <div className="epd-source-box">
        <div className="epd-section-label">
          <FileText size={17} />
          <h4>Thông tin nhận hóa đơn</h4>
        </div>
        <p className="epd-muted">Thông tin hiển thị theo tài khoản đăng nhập; người sử dụng có thể chỉnh sửa lại nếu cần.</p>
        <div className="epd-form-grid">
          <Field label="Đơn vị / Người mua" wide>
            <input
              aria-label="Đơn vị nhận hóa đơn"
              maxLength={200}
              value={buyer.name}
              onChange={event => onBuyer('name', event.target.value)}
            />
          </Field>
          <Field label="Mã số thuế">
            <input
              aria-label="Mã số thuế hóa đơn"
              maxLength={30}
              value={buyer.taxCode}
              onChange={event => onBuyer('taxCode', event.target.value)}
            />
          </Field>
          <Field label="Email nhận hóa đơn">
            <input
              aria-label="Email nhận hóa đơn"
              type="email"
              maxLength={254}
              value={buyer.email}
              onChange={event => onBuyer('email', event.target.value)}
            />
          </Field>
          <Field label="Địa chỉ" wide>
            <input
              aria-label="Địa chỉ nhận hóa đơn"
              maxLength={400}
              value={buyer.address}
              onChange={event => onBuyer('address', event.target.value)}
            />
          </Field>
        </div>
      </div>
    </section>
  )
}

export function ExportDeclarationFields({ value, index, onChange, onDelete, onValidateContainer, sourceLocked = false }) {
  const isDangerous = /dangerous|^dg$/i.test(value?.cargoType || '')
  const isCold = /reefer|lạnh|frozen/i.test(value?.cargoType || '') || /^..R|RF|RH/i.test(value?.isoCode || '')

  const handleContainerNumberChange = val => {
    const clean = val.toUpperCase().replace(/\s/g, '')
    onChange('containerNumber', clean)
  }

  const handleContainerBlur = () => {
    if (value?.containerNumber && !validContainer(value.containerNumber)) {
      onValidateContainer?.(`Số container '${value.containerNumber}' không đúng định dạng hoặc sai số kiểm tra ISO 6346.`)
    }
  }

  return (
    <article className="epd-export-container-card">
      <header className="epd-export-card-header">
        <div className="epd-export-card-title">
          <span className="epd-badge-num">Cont #{index + 1}</span>
          <strong>{value?.containerNumber || 'Container chưa nhập số'}</strong>
          {value?.isoCode && <span className="epd-badge-iso">{value.isoCode}</span>}
        </div>
        {onDelete && (
          <button
            type="button"
            className="epc-button secondary epd-btn-delete"
            aria-label="Xóa container này"
            onClick={onDelete}
          >
            <Trash2 size={15} />
            <span>Xóa</span>
          </button>
        )}
      </header>

      <div className="epd-form-grid epd-export-fields-grid">
        <Field label="Số container" required>
          <input
            aria-label="Số container"
            readOnly={sourceLocked}
            maxLength={11}
            value={value?.containerNumber || ''}
            onChange={e => handleContainerNumberChange(e.target.value)}
            onBlur={handleContainerBlur}
            placeholder="VD: MSCU6639870"
          />
        </Field>

        <Field label="Hãng khai thác" required>
          <input
            aria-label="Hãng khai thác"
            maxLength={150}
            value={value?.operatorName || ''}
            onChange={e => onChange('operatorName', e.target.value)}
            placeholder="VD: MAERSK, ONE, MSC..."
          />
        </Field>

        <Field label="Kích cỡ ISO" required>
          <input
            aria-label="Kích cỡ ISO"
            readOnly={sourceLocked}
            maxLength={4}
            value={value?.isoCode || ''}
            onChange={e => onChange('isoCode', e.target.value.toUpperCase())}
            placeholder="VD: 22G1, 42G1, 45R1..."
          />
        </Field>

        <Field label="Loại hàng" required>
          <select
            aria-label="Loại hàng"
            disabled={sourceLocked}
            value={value?.cargoType || 'General'}
            onChange={e => onChange('cargoType', e.target.value)}
          >
            <option value="General">Hàng bách hóa / thông thường (General)</option>
            <option value="Reefer">Hàng lạnh (Reefer)</option>
            <option value="Dangerous">Hàng nguy hiểm (DG)</option>
            <option value="OOG">Hàng quá khổ quá tải (OOG)</option>
          </select>
        </Field>

        <Field label="Trọng lượng (VGM / Gross kg)" required>
          <input
            aria-label="VGM khai báo"
            readOnly={sourceLocked}
            type="number"
            min={1}
            max={100000}
            value={value?.weightKg ?? ''}
            onChange={e => onChange('weightKg', e.target.value ? Number(e.target.value) : null)}
            placeholder="Khối lượng cả vỏ (kg)"
          />
        </Field>

        <Field label="Hàng nội / ngoại" required>
          <select
            aria-label="Hàng nội ngoại"
            value={value?.tradeType || 'FOREIGN'}
            onChange={e => onChange('tradeType', e.target.value)}
          >
            <option value="FOREIGN">Hàng ngoại</option>
            <option value="DOMESTIC">Hàng nội</option>
          </select>
        </Field>

        <Field label="Số seal" required>
          <input
            aria-label="Số seal"
            readOnly={sourceLocked}
            maxLength={80}
            value={value?.sealNumber || ''}
            onChange={e => onChange('sealNumber', e.target.value)}
            placeholder="Số chì hãng tàu / hải quan"
          />
        </Field>

        <Field label="Cảng dỡ (POD)" required>
          <input
            aria-label="Cảng dỡ"
            maxLength={80}
            value={value?.dischargePort || ''}
            onChange={e => onChange('dischargePort', e.target.value)}
            placeholder="Cảng dỡ hàng"
          />
        </Field>

        <Field label="Cảng đích (FPD)" required>
          <input
            aria-label="Cảng đích"
            maxLength={80}
            value={value?.destinationPort || ''}
            onChange={e => onChange('destinationPort', e.target.value)}
            placeholder="Cảng đích cuối cùng"
          />
        </Field>

        {isDangerous && (
          <>
            <Field label="Số IMO (hàng nguy hiểm)" required>
              <input
                aria-label="IMO"
                maxLength={10}
                value={value?.imoClass || ''}
                onChange={e => onChange('imoClass', e.target.value)}
                placeholder="VD: 3, 8, 9..."
              />
            </Field>
            <Field label="Số UNNO (hàng nguy hiểm)" required>
              <input
                aria-label="UNNO"
                maxLength={4}
                value={value?.unNumber || ''}
                onChange={e => onChange('unNumber', e.target.value)}
                placeholder="VD: 1993"
              />
            </Field>
          </>
        )}

        {isCold && (
          <Field label="Nhiệt độ cài đặt (°C)" required>
            <input
              aria-label="Nhiệt độ khai báo"
              type="number"
              min={-100}
              max={100}
              step="0.1"
              value={value?.temperature ?? ''}
              onChange={e => onChange('temperature', e.target.value ? Number(e.target.value) : null)}
              placeholder="VD: -18.0"
            />
          </Field>
        )}
      </div>
    </article>
  )
}
