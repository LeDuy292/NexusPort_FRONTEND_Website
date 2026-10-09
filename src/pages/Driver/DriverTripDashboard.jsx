import React, { useState, useEffect, useCallback } from 'react'
import {
  getMyTrips,
  getTripById,
  acknowledgeTrip,
  pickupVehicle,
  pickupContainer,
  confirmGateIn,
  confirmArrivedAtYard,
  confirmContainerDelivery,
  confirmGateOut,
  confirmVehicleReturn,
} from '../../services/tripService'

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  'Assigned':           { label: 'Đã phân công',         icon: '📋', color: 'bg-blue-50 text-blue-700 border-blue-200',   step: 0 },
  'Acknowledged':       { label: 'Đã xác nhận chuyến',   icon: '✅', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', step: 1 },
  'Vehicle Picked Up':  { label: 'Đã nhận xe',           icon: '🚛', color: 'bg-cyan-50 text-cyan-700 border-cyan-200',   step: 2 },
  'Container Picked Up':{ label: 'Đã nhận container',    icon: '📦', color: 'bg-amber-50 text-amber-700 border-amber-200',step: 3 },
  'Gate In':            { label: 'Gate In',               icon: '🚧', color: 'bg-orange-50 text-orange-700 border-orange-200', step: 4 },
  'In Transit':         { label: 'Đang vận chuyển',      icon: '🛣️', color: 'bg-purple-50 text-purple-700 border-purple-200', step: 5 },
  'Arrived at Yard':    { label: 'Đã đến Yard',          icon: '🏭', color: 'bg-teal-50 text-teal-700 border-teal-200',   step: 6 },
  'Container Delivered':{ label: 'Đã giao container',    icon: '🤝', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', step: 7 },
  'Gate Out Completed': { label: 'Đã Gate Out',          icon: '🏁', color: 'bg-lime-50 text-lime-700 border-lime-200',   step: 8 },
  'Vehicle Returned':   { label: 'Đã trả xe',            icon: '🔑', color: 'bg-green-50 text-green-700 border-green-200',step: 9 },
  'Completed':          { label: 'Hoàn thành',           icon: '🎉', color: 'bg-green-100 text-green-800 border-green-300', step: 10 },
  'Cancelled':          { label: 'Đã hủy',               icon: '❌', color: 'bg-red-50 text-red-700 border-red-200',      step: -1 },
}

const STEPS = [
  { key: 'Assigned',           label: 'Nhận chuyến' },
  { key: 'Acknowledged',       label: 'Xác nhận xe' },
  { key: 'Vehicle Picked Up',  label: 'Nhận container' },
  { key: 'Container Picked Up',label: 'Gate In' },
  { key: 'In Transit',         label: 'Đến Yard' },
  { key: 'Arrived at Yard',    label: 'Giao container' },
  { key: 'Container Delivered',label: 'Gate Out' },
  { key: 'Gate Out Completed', label: 'Trả xe & Xong' },
]

const ACTION_CONFIG = {
  'Assigned':           { label: 'Xác nhận nhận chuyến',    fn: acknowledgeTrip,           icon: '✋', color: 'bg-blue-600 hover:bg-blue-700' },
  'Acknowledged':       { label: 'Xác nhận đã lấy xe',      fn: pickupVehicle,             icon: '🚛', color: 'bg-indigo-600 hover:bg-indigo-700' },
  'Vehicle Picked Up':  { label: 'Xác nhận đã lấy container',fn: pickupContainer,          icon: '📦', color: 'bg-amber-600 hover:bg-amber-700' },
  'Container Picked Up':{ label: 'Thực hiện Gate In',       fn: confirmGateIn,             icon: '🚧', color: 'bg-orange-600 hover:bg-orange-700' },
  'In Transit':         { label: 'Xác nhận đã đến Yard',    fn: confirmArrivedAtYard,      icon: '🏭', color: 'bg-purple-600 hover:bg-purple-700' },
  'Arrived at Yard':    { label: 'Xác nhận giao container', fn: confirmContainerDelivery,  icon: '🤝', color: 'bg-teal-600 hover:bg-teal-700' },
  'Container Delivered':{ label: 'Thực hiện Gate Out',      fn: confirmGateOut,            icon: '🏁', color: 'bg-lime-600 hover:bg-lime-700' },
  'Gate Out Completed': { label: 'Xác nhận trả xe',         fn: confirmVehicleReturn,      icon: '🔑', color: 'bg-green-600 hover:bg-green-700' },
}

// ── Toast Component ───────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  const bg = type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 ${bg} text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold z-50 flex items-center gap-2 max-w-sm`}>
      <span>{type === 'error' ? '❌' : '✅'}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">✕</button>
    </div>
  )
}

// ── Progress Stepper ──────────────────────────────────────────────────────────
function ProgressStepper({ currentStatus }) {
  const currentStep = STATUS_CONFIG[currentStatus]?.step ?? 0
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-center min-w-max gap-0">
        {STEPS.map((step, i) => {
          const stepStatus = STATUS_CONFIG[step.key]?.step ?? i
          const done = currentStep > stepStatus
          const active = currentStep === stepStatus
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  done ? 'bg-emerald-500 text-white shadow-md' :
                  active ? 'bg-blue-600 text-white shadow-lg ring-4 ring-blue-200 animate-pulse' :
                  'bg-gray-100 text-gray-400 border border-gray-200'
                }`}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={`text-[9px] mt-1 font-medium text-center max-w-[60px] leading-tight ${
                  done ? 'text-emerald-600' : active ? 'text-blue-600' : 'text-gray-400'
                }`}>{step.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-6 mx-1 transition-colors duration-300 ${done ? 'bg-emerald-400' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ── Trip Card (danh sách) ─────────────────────────────────────────────────────
function TripCard({ trip, onSelect }) {
  const cfg = STATUS_CONFIG[trip.status] || STATUS_CONFIG['Assigned']
  const isActive = !['Completed', 'Cancelled'].includes(trip.status)
  return (
    <button
      onClick={() => onSelect(trip)}
      className={`w-full text-left border rounded-2xl p-4 transition-all hover:shadow-md active:scale-[0.98] ${
        isActive ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-xs font-bold text-gray-500 font-mono">{trip.tripCode}</span>
          <h3 className="font-bold text-gray-800 text-sm mt-0.5">{trip.containerNo || '—'}</h3>
          <p className="text-xs text-gray-500">{trip.containerType || ''}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${cfg.color}`}>
          {cfg.icon} {cfg.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
        <span>🚛 {trip.truckPlate || '—'}</span>
        <span>🏭 {trip.yardBlock ? `${trip.yardBlock} · ${trip.yardSlot || ''}` : '—'}</span>
        <span className="col-span-2">🧾 Booking: {trip.bookingCode ? `${trip.bookingCode}${trip.bookingType ? ` (${trip.bookingType})` : ''}` : '—'}</span>
        {trip.appointmentStart && (
          <span className="col-span-2">🕐 {new Date(trip.appointmentStart).toLocaleString('vi-VN')}</span>
        )}
      </div>
      {isActive && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <ProgressStepper currentStatus={trip.status} />
        </div>
      )}
    </button>
  )
}

// ── Trip Detail + Action Panel ────────────────────────────────────────────────
function TripDetail({ trip, onBack, onTripUpdated }) {
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState('')
  const [sealNo, setSealNo] = useState(trip.sealNo || '')
  const [containerCondition, setContainerCondition] = useState(trip.containerCondition || 'Nguyên chì - Tốt')
  const [recipientName, setRecipientName] = useState(trip.recipientName || 'Nhân viên Yard')
  const [toast, setToast] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const cfg = STATUS_CONFIG[trip.status] || {}
  const action = ACTION_CONFIG[trip.status]
  const isCompleted = trip.status === 'Completed'
  const isCancelled = trip.status === 'Cancelled'
  const isDeliverStep = trip.status === 'Arrived at Yard'

  const handleAction = async () => {
    if (!action) return
    setLoading(true)
    setConfirmOpen(false)
    try {
      const payload = isDeliverStep
        ? { note, sealNo, containerCondition, recipientName }
        : note
      const result = await action.fn(trip.id, payload)
      setNote('')
      setToast({ message: result.message || 'Thao tác thành công!', type: 'success' })
      onTripUpdated(result.data.trip)
    } catch (err) {
      setToast({ message: err.response?.data?.message || err.message || 'Có lỗi xảy ra.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 text-sm transition-colors">
          ←
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-gray-800 text-base">Chi tiết chuyến</h2>
          <span className="text-xs text-gray-500 font-mono">{trip.tripCode}</span>
        </div>
        <span className={`text-[11px] font-bold px-2 py-1 rounded-full border ${cfg.color}`}>
          {cfg.icon} {cfg.label}
        </span>
      </div>

      {/* Progress */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Tiến trình hành trình</p>
        <ProgressStepper currentStatus={trip.status} />
      </div>

      {/* Hướng dẫn đến Yard (Chỉ đường) */}
      {(trip.yardBlock || trip.yardInstructions) && (
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-4 shadow-md space-y-2 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
              <span>🗺️</span> HƯỚNG DẪN ĐẾN YARD
            </span>
            <span className="bg-indigo-500/30 text-indigo-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-400/30">
              {trip.yardBlock} · {trip.yardSlot || 'Ô bãi'}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-200 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/10">
            {trip.yardInstructions || `Vào Cổng ${trip.gateInCode || 'A1'} ➔ Rẽ theo làn xe tải ➔ Đến ${trip.yardBlock} ➔ Đỗ đúng vị trí ô ${trip.yardSlot || ''}`}
          </p>
        </div>
      )}

      {/* Thông tin chuyến & Giao nhận */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Thông tin chuyến & Container</p>
        <InfoRow icon="📦" label="Container" value={trip.containerNo || '—'} highlight />
        <InfoRow icon="🏷️" label="Số chì (Seal)" value={trip.sealNo || sealNo || '—'} />
        <InfoRow icon="📏" label="Loại Container" value={trip.containerType || '—'} />
        <InfoRow icon="⚠️" label="Hàng hóa" value={trip.cargoType || '—'} />
        <InfoRow icon="🧾" label="Booking" value={trip.bookingCode || '—'} highlight />
        <InfoRow icon="🔖" label="Loại booking" value={trip.bookingType || '—'} />
        <InfoRow icon="🚛" label="Xe đầu kéo" value={trip.truckPlate || '—'} />
        <InfoRow icon="🚧" label="Cổng vào (Gate In)" value={trip.gateInCode || '—'} />
        <InfoRow icon="🏁" label="Cổng ra (Gate Out)" value={trip.gateOutCode || '—'} />
        <InfoRow icon="🏭" label="Block bãi" value={trip.yardBlock || '—'} />
        <InfoRow icon="📍" label="Slot bãi" value={trip.yardSlot || '—'} highlight />
        {trip.containerCondition && (
          <InfoRow icon="🔍" label="Tình trạng Cont" value={trip.containerCondition} />
        )}
        {trip.recipientName && (
          <InfoRow icon="👤" label="Người tiếp nhận" value={trip.recipientName} />
        )}
        {trip.appointmentStart && (
          <InfoRow icon="🕐" label="Thời gian hẹn" value={new Date(trip.appointmentStart).toLocaleString('vi-VN')} />
        )}
        {trip.note && <InfoRow icon="📝" label="Ghi chú" value={trip.note} />}
      </div>

      {/* Timeline */}
      {trip.history && trip.history.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Lịch sử trạng thái</p>
          <div className="space-y-2">
            {trip.history.map((h, i) => (
              <div key={h.id || i} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-700">{STATUS_CONFIG[h.toStatus]?.label || h.toStatus}</span>
                    <span className="text-[10px] text-gray-400">{new Date(h.changedAt).toLocaleString('vi-VN')}</span>
                  </div>
                  {h.note && <p className="text-[11px] text-gray-500 mt-0.5">{h.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      {!isCompleted && !isCancelled && action && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bước tiếp theo</p>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </p>
          </div>

          {/* Form phụ nếu đang ở bước Giao Container */}
          {isDeliverStep && (
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 space-y-2 text-xs">
              <p className="font-bold text-amber-900 flex items-center gap-1.5">
                <span>📋</span> XÁC NHẬN THÔNG TIN GIAO CONTAINER
              </p>
              <div>
                <label className="block text-[11px] font-medium text-amber-900 mb-1">Mã chì (Seal No):</label>
                <input
                  type="text"
                  value={sealNo}
                  onChange={e => setSealNo(e.target.value)}
                  placeholder="Vd: SEAL-VN-998811"
                  className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-amber-900 mb-1">Tình trạng Container:</label>
                <select
                  value={containerCondition}
                  onChange={e => setContainerCondition(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="Nguyên chì - Tốt">Nguyên chì - Tốt</option>
                  <option value="Nguyên chì - Trầy xước nhẹ">Nguyên chì - Trầy xước nhẹ</option>
                  <option value="Móp góc bãi">Móp góc bãi</option>
                  <option value="Rách chì / Cần kiểm tra lại">Rách chì / Cần kiểm tra lại</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-amber-900 mb-1">Nhân viên / Người nhận tại bãi:</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder="Vd: Phạm Bãi Hàng (Yard Staff)"
                  className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Ghi chú thêm (không bắt buộc)..."
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
          />
          {!confirmOpen ? (
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={loading}
              className={`w-full py-3 rounded-xl text-white font-bold text-sm transition-all ${action.color} disabled:opacity-50`}
            >
              {action.icon} {action.label}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 font-medium text-center">Xác nhận thực hiện thao tác này?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="py-3 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAction}
                  disabled={loading}
                  className={`py-3 rounded-xl text-white font-bold text-sm transition-all ${action.color} disabled:opacity-50`}
                >
                  {loading ? '⏳ Đang xử lý...' : '✅ Xác nhận'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isCompleted && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
          <p className="text-4xl mb-2">🎉</p>
          <p className="font-bold text-emerald-700 text-base">Chuyến đã hoàn thành!</p>
          <p className="text-emerald-600 text-sm mt-1">Cảm ơn bạn đã hoàn thành hành trình.</p>
        </div>
      )}
    </div>
  )
}

function InfoRow({ icon, label, value, highlight }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-500 flex items-center gap-1.5 flex-shrink-0">
        <span>{icon}</span> {label}
      </span>
      <span className={`text-xs font-semibold text-right truncate ${highlight ? 'text-blue-700' : 'text-gray-700'}`}>
        {value}
      </span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DriverTripDashboard() {
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [filter, setFilter] = useState('active')
  const [refreshing, setRefreshing] = useState(false)

  const loadTrips = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const result = await getMyTrips({ status: filter })
      setTrips(result.trips || [])
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không thể tải danh sách chuyến.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter])

  useEffect(() => {
    loadTrips()
  }, [loadTrips])

  const handleSelectTrip = async (trip) => {
    try {
      const result = await getTripById(trip.id)
      setSelectedTrip(result.trip)
    } catch {
      setSelectedTrip(trip)
    }
  }

  const handleTripUpdated = (updatedTrip) => {
    setSelectedTrip(prev => ({ ...prev, ...updatedTrip }))
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? { ...t, ...updatedTrip } : t))
    // reload detail with history
    getTripById(updatedTrip.id).then(r => setSelectedTrip(r.trip)).catch(() => {})
  }

  const activeCount = trips.filter(t => !['Completed', 'Cancelled'].includes(t.status)).length

  if (selectedTrip) {
    return (
      <TripDetail
        trip={selectedTrip}
        onBack={() => { setSelectedTrip(null); loadTrips(true) }}
        onTripUpdated={handleTripUpdated}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-800 text-lg">Chuyến vận chuyển</h1>
          {activeCount > 0 && (
            <p className="text-xs text-blue-600 font-medium mt-0.5">{activeCount} chuyến đang hoạt động</p>
          )}
        </div>
        <button
          onClick={() => loadTrips(true)}
          disabled={refreshing}
          className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors disabled:opacity-50"
          title="Làm mới"
        >
          <span className={refreshing ? 'animate-spin inline-block' : ''}>🔄</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'active', label: 'Đang thực hiện' },
          { key: 'Completed', label: 'Hoàn thành' },
          { key: 'all', label: 'Tất cả' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              filter === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Đang tải danh sách chuyến...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
          <p className="text-red-600 font-semibold text-sm">{error}</p>
          <button
            onClick={() => loadTrips()}
            className="mt-3 text-xs text-red-600 underline hover:text-red-800"
          >
            Thử lại
          </button>
        </div>
      ) : trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <span className="text-5xl">🚛</span>
          <p className="font-semibold text-gray-600">Không có chuyến nào</p>
          <p className="text-sm text-gray-400">
            {filter === 'active' ? 'Bạn chưa có chuyến vận chuyển đang thực hiện.' : 'Không có dữ liệu.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map(trip => (
            <TripCard key={trip.id} trip={trip} onSelect={handleSelectTrip} />
          ))}
          <p className="text-center text-[11px] text-gray-400 pb-2">
            Hiển thị {trips.length} chuyến
          </p>
        </div>
      )}
    </div>
  )
}
