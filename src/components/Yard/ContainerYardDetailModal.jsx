import React, { useEffect, useMemo, useState } from 'react'
import apiClient from '../../services/apiClient'

/**
 * Chi tiết một container đang nằm / giữ chỗ trên sơ đồ bãi. Toàn bộ dữ liệu là thật:
 *  - vị trí, xe, tài xế, thiết bị: từ ô bãi trên sơ đồ;
 *  - thông số, ảnh hiện trường, lịch sử: từ API /yard/containers (container, EIR, lệnh bãi, cổng).
 */

const STATUS = {
  in_yard: { label: 'Đang lưu bãi', cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  occupied: { label: 'Đang lưu bãi', cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  reserved: { label: 'Đã giữ chỗ', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
}
const CARGO = { general: 'Hàng khô thông thường', dry: 'Hàng khô thông thường', reefer: 'Hàng lạnh', dangerous: 'Hàng nguy hiểm', oversized: 'Hàng quá khổ' }
const val = (v) => (v == null || v === '' ? '—' : v)
const fmtDateTime = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function Field({ label, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 min-w-0">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums break-words">{children}</div>
    </div>
  )
}

export default function ContainerYardDetailModal({ isOpen, onClose, containerData, onOpenHistory }) {
  const [tab, setTab] = useState('overview')
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(null)

  const containerNo = useMemo(() => {
    const raw = containerData?.containerNumber || containerData?.reservedContainerNumber || containerData?.containerNo || ''
    const no = String(raw).trim().toUpperCase()
    return /^[A-Z]{4}\d{6,7}$/.test(no) ? no : ''
  }, [containerData])

  // Tải thông tin thật của container mỗi lần mở
  useEffect(() => {
    if (!isOpen) return undefined
    setTab('overview')
    setPhotoOpen(null)
    setDetail(null)
    if (!containerNo) return undefined
    let alive = true
    setLoading(true)
    apiClient.get('/yard/containers')
      .then((res) => { if (alive) setDetail((res.data?.data?.items || []).find((c) => c.containerNo === containerNo) || null) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [isOpen, containerNo])

  useEffect(() => {
    if (!isOpen) return undefined
    const onKey = (e) => { if (e.key === 'Escape') (photoOpen != null ? setPhotoOpen(null) : onClose?.()) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose, photoOpen])

  if (!isOpen || !containerData) return null

  const status = STATUS[containerData.status] || STATUS.in_yard
  const block = containerData.block || containerData.blockCode
  const bay = String(containerData.bay ?? '').padStart(2, '0')
  const row = String(containerData.row ?? '').padStart(2, '0')
  const tier = containerData.tier
  const slotCode = containerData.slotCode || `${block}-${bay}-${row}-${tier}`
  const lengthFt = Number(containerData.containerLengthFt) || (String(detail?.type || '').startsWith('4') ? 40 : 20)
  const coveredBays = containerNo && lengthFt >= 40 && Number(containerData.bay) > 1
    ? [String(Number(containerData.bay) - 1).padStart(2, '0'), String(Number(containerData.bay) + 1).padStart(2, '0')]
    : null

  const d = detail || {}
  const vehicle = d.vehiclePlate || containerData.vehiclePlate
  const driver = d.driverName || containerData.driverName
  const company = d.company || containerData.company
  const bookingCode = d.bookingCode || containerData.bookingCode
  const operation = d.operationType || containerData.operationType
  const equipmentCode = d.equipmentCode || containerData.equipmentCode
  const operatorName = d.operatorName || containerData.operatorName
  const seal = d.sealNo || containerData.sealNumber
  const photos = d.photos || []
  const history = d.history || []
  const weight = d.weightKg != null ? `${Number(d.weightKg).toLocaleString('vi-VN')} kg` : '—'
  const heavy = d.weightKg > 20000

  const tabs = [
    ['overview', 'Tổng quan & vị trí', 'grid_view'],
    ['photos', `Ảnh thực tế${photos.length ? ` (${photos.length})` : ''}`, 'photo_camera'],
    ['history', `Lịch sử${history.length ? ` (${history.length})` : ''}`, 'history'],
  ]

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col font-sans" onClick={(e) => e.stopPropagation()}>
        {/* Đầu cửa sổ */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${status.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />{status.label}
              </span>
              {d.type ? <span className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">{d.type}</span> : null}
              {d.isReefer ? <span className="px-2 py-0.5 rounded border border-cyan-200 bg-cyan-50 text-[11px] font-semibold text-cyan-700">Container lạnh</span> : null}
              {d.line ? <span className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">{d.line}</span> : null}
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight">{containerNo || 'Container chưa xác định'}</h2>
              <span className="text-sm font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-2 py-0.5 tabular-nums">{slotCode}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer shrink-0">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Tab */}
        <div className="px-6 pt-3">
          <div className="inline-flex p-1 rounded-xl bg-slate-100" role="tablist">
            {tabs.map(([k, label, icon]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`px-3.5 h-9 rounded-lg text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                <span className="material-symbols-outlined text-base">{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-5">
          {loading && !detail ? <p className="text-xs text-slate-400">Đang tải thông tin container…</p> : null}
          {!containerNo ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Ô này đang được đánh dấu <strong>{containerData.status === 'reserved' ? 'giữ chỗ' : 'có container'}</strong> nhưng hệ thống chưa gắn với container hoặc booking nào
              (giữ chỗ tồn đọng). Vì vậy chưa có thông số, xe hay tài xế để hiển thị. Cần giải phóng hoặc gán lại giữ chỗ cho ô này.
            </div>
          ) : null}

          {tab === 'overview' && (
            <>
              <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">Vị trí ô bãi</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Field label="Block">{val(block)}</Field>
                  <Field label="Bay">{bay || '—'}</Field>
                  <Field label="Hàng">{row || '—'}</Field>
                  <Field label="Tầng">{val(tier)}</Field>
                </div>
                {coveredBays && (
                  <p className="mt-2 text-xs text-slate-500">Container 40ft chiếm 2 ô 20ft liền kề: bay {coveredBays[0]} và bay {coveredBays[1]}.</p>
                )}
              </section>

              <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">Thông số container</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Loại container">{val(d.type)}</Field>
                  <Field label="Trọng lượng">
                    {weight}{heavy ? <span className="ml-2 text-[11px] font-semibold text-red-600">Nặng</span> : null}
                  </Field>
                  <Field label="Số niêm phong">{val(seal)}</Field>
                  <Field label="Hãng tàu">{val(d.line)}</Field>
                  <Field label="Tàu / chuyến">{d.vessel ? `${d.vessel}${d.voyage ? ` · ${d.voyage}` : ''}` : '—'}</Field>
                  <Field label="Loại hàng">{val(CARGO[String(d.cargo || '').toLowerCase()] || d.cargo)}</Field>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">Xe và tác nghiệp</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Tác nghiệp">{val(operation)}</Field>
                  <Field label="Mã booking / lệnh">{val(bookingCode)}</Field>
                  <Field label="Công ty">{val(company)}</Field>
                  <Field label="Biển số xe">{val(vehicle)}</Field>
                  <Field label="Tài xế">{val(driver)}</Field>
                  <Field label="Thiết bị / vận hành">{equipmentCode ? `${equipmentCode}${operatorName ? ` · ${operatorName}` : ''}` : '—'}</Field>
                </div>
              </section>

              {(d.condition || d.lastInspectionAt) && (
                <section>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">Kiểm tra vỏ</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Field label="Tình trạng">{val(d.condition)}</Field>
                    <Field label="Lần kiểm tra gần nhất">{fmtDateTime(d.lastInspectionAt)}</Field>
                    <Field label="Người kiểm tra">{val(d.inspectionBy)}</Field>
                  </div>
                </section>
              )}
            </>
          )}

          {tab === 'photos' && (
            photos.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có ảnh nào được lưu cho container này (ảnh lúc dỡ tàu, nhận bãi hoặc phiếu e-EIR sẽ hiện ở đây).</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((ph, i) => (
                  <button key={ph.url} type="button" onClick={() => setPhotoOpen(i)} className="text-left rounded-xl overflow-hidden border border-slate-200 hover:border-orange-300 cursor-pointer">
                    <div className="aspect-[4/3] bg-slate-100">
                      <img src={ph.url} alt={`Ảnh ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
                    </div>
                    <div className="px-2.5 py-2">
                      <div className="text-xs font-semibold text-slate-700 truncate">{ph.label}</div>
                      <div className="text-[11px] text-slate-400 tabular-nums">{fmtDateTime(ph.at)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {tab === 'history' && (
            history.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có sự kiện nào được ghi nhận cho container này.</p>
            ) : (
              <ol className="space-y-2.5">
                {history.map((h, i) => (
                  <li key={i} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                    <div className="shrink-0 w-28 text-xs font-semibold text-slate-500 tabular-nums">{fmtDateTime(h.at)}</div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{h.event}</div>
                      {h.desc ? <div className="text-xs text-slate-500 mt-0.5">{h.desc}</div> : null}
                    </div>
                  </li>
                ))}
              </ol>
            )
          )}
        </div>

        {/* Chân cửa sổ */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {containerNo && (
              <button type="button" onClick={() => { onClose?.(); onOpenHistory?.({ mode: 'container', containerNo }) }}
                className="px-4 h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold flex items-center gap-1.5 cursor-pointer">
                <span className="material-symbols-outlined text-base text-orange-500">history</span>Lịch sử container
              </button>
            )}
            <button type="button" onClick={() => { onClose?.(); onOpenHistory?.({ mode: 'slot', slotCode }) }}
              className="px-4 h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold flex items-center gap-1.5 cursor-pointer">
              <span className="material-symbols-outlined text-base text-orange-500">timeline</span>Lịch sử ô {slotCode}
            </button>
          </div>
          <button type="button" onClick={onClose} className="px-6 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold cursor-pointer transition-colors">
            Đóng
          </button>
        </div>
      </div>

      {photoOpen != null && photos[photoOpen] && (
        <div className="fixed inset-0 z-[80] bg-slate-900/90 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setPhotoOpen(null) }}>
          <img src={photos[photoOpen].url} alt={photos[photoOpen].label} className="max-w-4xl w-full max-h-[85vh] object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
          <button type="button" onClick={() => setPhotoOpen(null)} aria-label="Đóng ảnh" className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white text-slate-700 shadow flex items-center justify-center cursor-pointer">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </div>
  )
}
