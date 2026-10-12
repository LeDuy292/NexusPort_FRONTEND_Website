import React, { useState, useEffect, useCallback } from 'react'
import { getYardNavigation, confirmArrivedAtYard } from '../../services/tripService'

const STATUS_CONFIG = {
  'Assigned':           { label: 'Đã phân công',         icon: '📋', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  'Acknowledged':       { label: 'Đã xác nhận chuyến',   icon: '✅', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  'Vehicle Picked Up':  { label: 'Đã nhận xe',           icon: '🚛', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  'Container Picked Up':{ label: 'Đã nhận container',    icon: '📦', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  'Gate In':            { label: 'Gate In',               icon: '🚧', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  'In Transit':         { label: 'Đang vận chuyển',      icon: '🛣️', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  'Arrived at Yard':    { label: 'Đã đến Yard',          icon: '🏭', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  'Container Delivered':{ label: 'Đã giao container',    icon: '🤝', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'Gate Out Completed': { label: 'Đã Gate Out',          icon: '🏁', color: 'bg-lime-50 text-lime-700 border-lime-200' },
  'Vehicle Returned':   { label: 'Đã trả xe',            icon: '🔑', color: 'bg-green-50 text-green-700 border-green-200' },
  'Completed':          { label: 'Hoàn thành',           icon: '🎉', color: 'bg-green-100 text-green-800 border-green-300' },
  'Cancelled':          { label: 'Đã hủy',               icon: '❌', color: 'bg-red-50 text-red-700 border-red-200' },
}

export default function DriverYardNavigation({ tripId, onBack, onStatusUpdated }) {
  const [navData, setNavData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [activeTab, setActiveTab] = useState('port_map') // 'port_map' | 'osm'

  const fetchNavigation = useCallback(async () => {
    if (!tripId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getYardNavigation(tripId)
      setNavData(data)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không thể tải thông tin điều hướng.')
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    fetchNavigation()
  }, [fetchNavigation])

  const handleOpenExternalMap = () => {
    if (!navData?.canNavigate || !navData?.yard?.mapUrl) return
    window.open(navData.yard.mapUrl, '_blank', 'noopener,noreferrer')
  }

  const handleCopyAddress = () => {
    if (!navData?.yard?.address) return
    const textToCopy = `${navData.yard.name} - ${navData.yard.address}`
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2500)
    })
  }

  const handleConfirmArrived = async () => {
    if (!tripId) return
    setActionLoading(true)
    try {
      await confirmArrivedAtYard(tripId, 'Tài xế xác nhận đã đến vị trí bãi qua màn hình điều hướng')
      if (onStatusUpdated) onStatusUpdated()
      await fetchNavigation()
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Không thể xác nhận đến bãi.')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-chalk rounded-2xl p-8 text-center space-y-3 shadow-sm">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate">Đang tải thông tin điểm đến & bản đồ Yard...</p>
      </div>
    )
  }

  if (error || !navData) {
    return (
      <div className="bg-white border border-chalk rounded-2xl p-6 text-center space-y-4 shadow-sm">
        <div className="text-4xl">⚠️</div>
        <h3 className="font-bold text-carbon text-base">Không thể tải thông tin bãi</h3>
        <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">{error || 'Không có dữ liệu.'}</p>
        <div className="flex gap-2 justify-center">
          {onBack && (
            <button onClick={onBack} className="px-4 py-2 bg-fog rounded-xl text-xs font-bold text-carbon hover:bg-chalk transition-colors">
              ← Quay lại
            </button>
          )}
          <button onClick={fetchNavigation} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors">
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[navData.status] || { label: navData.status, icon: '📍', color: 'bg-gray-50 text-gray-700 border-gray-200' }
  const { yard, container, vehicle, canNavigate, navigationBlockReason, isYardValid, validationMessage } = navData
  const lat = yard?.coordinates?.lat || 16.1265
  const lng = yard?.coordinates?.lng || 108.2225

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between bg-white border border-chalk rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-xl bg-fog hover:bg-chalk flex items-center justify-center text-carbon font-bold transition-colors"
              title="Quay lại"
            >
              ←
            </button>
          )}
          <div>
            <span className="text-[10px] font-bold text-slate uppercase tracking-wider">Hành trình chuyến</span>
            <h2 className="font-bold text-carbon text-base flex items-center gap-2">
              <span>🧭 Di chuyển đến bãi</span>
            </h2>
            <span className="text-xs font-mono text-slate">{navData.tripCode}</span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="text-right">
          <span className="text-[9px] font-bold text-slate block mb-1 uppercase tracking-wider">Trạng thái</span>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${statusCfg.color}`}>
            <span>{statusCfg.icon}</span>
            <span>{statusCfg.label}</span>
          </span>
        </div>
      </div>

      {/* Warning/Alert Banners */}
      {!canNavigate && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
            <span className="text-base">⚠️</span>
            <span>CHƯA THỂ ĐIỀU HƯỚNG ĐẾN YARD</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed font-medium">
            {navigationBlockReason || 'Chỉ cho phép điều hướng đến Yard khi Driver đã nhận container và chuyến đang ở trạng thái IN_TRANSIT.'}
          </p>
          <div className="text-[11px] text-amber-700 bg-amber-100/60 p-2.5 rounded-xl border border-amber-200/60">
            💡 <strong>Quy trình:</strong> Vui lòng hoàn tất xác nhận lấy container và thực hiện <strong>Gate In</strong> để chuyển chuyến sang trạng thái <strong>Đang vận chuyển (In Transit)</strong>.
          </div>
        </div>
      )}

      {!isYardValid && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-red-900 font-bold text-xs uppercase tracking-wider">
            <span className="text-base">❌</span>
            <span>THÔNG TIN BÃI KHÔNG ĐẦY ĐỦ</span>
          </div>
          <p className="text-xs text-red-800 leading-relaxed font-medium">
            {validationMessage || 'Thông tin Yard chưa đầy đủ hoặc không hợp lệ. Vui lòng liên hệ Dispatcher để kiểm tra Block & Slot.'}
          </p>
        </div>
      )}

      {canNavigate && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">✅</span>
            <div>
              <p className="text-xs font-bold text-emerald-900">Sẵn sàng điều hướng</p>
              <p className="text-[11px] text-emerald-700">Chuyến đang ở trạng thái In Transit. Bạn có thể mở bản đồ để di chuyển đến bãi.</p>
            </div>
          </div>
        </div>
      )}

      {/* Yard Destination Card */}
      <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-chalk">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider flex items-center gap-1.5">
            <span>🏭</span> ĐỊA ĐIỂM YARD CẦN ĐẾN
          </span>
          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
            Điểm giao container
          </span>
        </div>

        {/* Yard Name & Address */}
        <div>
          <h3 className="font-bold text-carbon text-base">{yard?.name || 'Bãi Container Cảng Tiên Sa'}</h3>
          <p className="text-xs text-slate mt-0.5 flex items-start gap-1.5">
            <span className="flex-shrink-0">📍</span>
            <span>{yard?.address || 'Số 01 Yết Kiêu, Phường Thọ Quang, Quận Sơn Trà, TP. Đà Nẵng'}</span>
          </p>
        </div>

        {/* Position Details Grid */}
        <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
          <div className="bg-fog p-2.5 rounded-xl border border-chalk">
            <span className="text-[10px] font-bold text-slate block mb-0.5 uppercase tracking-wider">Block bãi</span>
            <span className="font-bold text-indigo-700 text-sm">{yard?.block || 'Chưa chỉ định'}</span>
          </div>

          <div className="bg-fog p-2.5 rounded-xl border border-chalk">
            <span className="text-[10px] font-bold text-slate block mb-0.5 uppercase tracking-wider">Vị trí Slot (Ô)</span>
            <span className="font-bold text-indigo-700 text-sm">{yard?.slot || 'Theo chỉ định'}</span>
          </div>

          <div className="bg-fog p-2.5 rounded-xl border border-chalk">
            <span className="text-[10px] font-bold text-slate block mb-0.5 uppercase tracking-wider">Cổng vào chỉ định</span>
            <span className="font-bold text-carbon text-xs">{yard?.gateInCode || 'GATE-A1'}</span>
          </div>

          <div className="bg-fog p-2.5 rounded-xl border border-chalk">
            <span className="text-[10px] font-bold text-slate block mb-0.5 uppercase tracking-wider">Khu vực (Zone)</span>
            <span className="font-bold text-carbon text-xs">{yard?.zone || 'Bãi hàng Tiên Sa'}</span>
          </div>
        </div>

        {/* Transport Cargo Info */}
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs flex justify-between items-center text-slate-700">
          <div>
            <span className="text-[10px] text-slate-500 block">Container vận chuyển:</span>
            <span className="font-mono font-bold text-carbon">{container?.containerNo || '—'}</span>
            <span className="text-[11px] text-slate-500 ml-1">({container?.containerType || '40ft'})</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 block">Đầu kéo:</span>
            <span className="font-mono font-bold text-carbon">{vehicle?.truckPlate || '—'}</span>
          </div>
        </div>

        {/* Route Instructions */}
        {yard?.instructions && (
          <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 text-xs space-y-1">
            <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
              <span>🛣️</span> Hướng dẫn di chuyển nội bộ
            </span>
            <p className="text-indigo-950 font-medium leading-relaxed">
              {yard.instructions}
            </p>
          </div>
        )}
      </div>

      {/* Map Tabs & Preview */}
      <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider flex items-center gap-1.5">
            <span>🗺️</span> BẢN ĐỒ ĐIỂM ĐẾN
          </span>
          <div className="flex bg-fog p-0.5 rounded-lg border border-chalk text-[11px] font-bold">
            <button
              onClick={() => setActiveTab('port_map')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeTab === 'port_map' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate hover:text-carbon'
              }`}
            >
              Sơ đồ bãi cảng
            </button>
            <button
              onClick={() => setActiveTab('osm')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeTab === 'osm' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate hover:text-carbon'
              }`}
            >
              Vệ tinh / Bản đồ số
            </button>
          </div>
        </div>

        {/* Interactive Map Visualizer */}
        <div className="relative rounded-2xl overflow-hidden border border-chalk bg-slate-900 shadow-inner">
          {activeTab === 'port_map' ? (
            <div className="w-full h-64 relative bg-[#0f172a] overflow-hidden select-none">
              {/* SVG Layout of Tiên Sa Port Yard */}
              <svg viewBox="0 0 500 320" className="w-full h-full">
                {/* Sea background */}
                <rect x="0" y="0" width="500" height="70" fill="#0369a1" opacity="0.6" />
                <text x="250" y="40" fill="#bae6fd" fontSize="12" fontWeight="bold" textAnchor="middle" opacity="0.7">
                  VỊNH ĐÀ NẴNG · BẾN CẢNG TIÊN SA
                </text>

                {/* Wharves & Berths */}
                <rect x="30" y="65" width="440" height="15" fill="#334155" />
                <text x="250" y="76" fill="#e2e8f0" fontSize="9" textAnchor="middle">CẦU TÀU CONTAINER SỐ 1 - 2 - 3</text>

                {/* Internal Roads */}
                <rect x="20" y="100" width="460" height="24" fill="#1e293b" />
                <line x1="20" y1="112" x2="480" y2="112" stroke="#e2e8f0" strokeDasharray="6,6" strokeWidth="1.5" opacity="0.5" />
                <text x="250" y="116" fill="#94a3b8" fontSize="8" textAnchor="middle">ĐƯỜNG NỘI BỘ ROAD 01</text>

                <rect x="20" y="270" width="460" height="24" fill="#1e293b" />
                <line x1="20" y1="282" x2="480" y2="282" stroke="#e2e8f0" strokeDasharray="6,6" strokeWidth="1.5" opacity="0.5" />
                <text x="250" y="286" fill="#94a3b8" fontSize="8" textAnchor="middle">ĐƯỜNG RA CỔNG XUẤT ROAD 02</text>

                {/* Vertical Roads */}
                <rect x="130" y="100" width="20" height="194" fill="#1e293b" />
                <rect x="350" y="100" width="20" height="194" fill="#1e293b" />

                {/* Gate Entry */}
                <rect x="25" y="130" width="80" height="35" rx="6" fill="#047857" opacity="0.9" />
                <text x="65" y="152" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle">CỔNG A (Gate In)</text>

                {/* Yard Blocks */}
                {/* Block A */}
                <g className={yard?.block?.includes('A') ? 'animate-pulse' : ''}>
                  <rect
                    x="160"
                    y="135"
                    width="80"
                    height="120"
                    rx="8"
                    fill={yard?.block?.includes('A') ? '#4f46e5' : '#1e293b'}
                    stroke={yard?.block?.includes('A') ? '#a5b4fc' : '#475569'}
                    strokeWidth="2"
                  />
                  <text x="200" y="160" fill="white" fontSize="13" fontWeight="bold" textAnchor="middle">BLOCK A</text>
                  <text x="200" y="180" fill={yard?.block?.includes('A') ? '#c7d2fe' : '#94a3b8'} fontSize="9" textAnchor="middle">Bãi hàng Dry Cont</text>
                  <text x="200" y="200" fill={yard?.block?.includes('A') ? '#fde047' : '#94a3b8'} fontSize="9" fontWeight="bold" textAnchor="middle">
                    {yard?.block?.includes('A') && yard?.slot ? `Ô: ${yard.slot}` : 'A01 → A20'}
                  </text>
                </g>

                {/* Block B */}
                <g className={yard?.block?.includes('B') ? 'animate-pulse' : ''}>
                  <rect
                    x="255"
                    y="135"
                    width="80"
                    height="120"
                    rx="8"
                    fill={yard?.block?.includes('B') ? '#4f46e5' : '#1e293b'}
                    stroke={yard?.block?.includes('B') ? '#a5b4fc' : '#475569'}
                    strokeWidth="2"
                  />
                  <text x="295" y="160" fill="white" fontSize="13" fontWeight="bold" textAnchor="middle">BLOCK B</text>
                  <text x="295" y="180" fill={yard?.block?.includes('B') ? '#c7d2fe' : '#94a3b8'} fontSize="9" textAnchor="middle">Bãi hàng Dry Cont</text>
                  <text x="295" y="200" fill={yard?.block?.includes('B') ? '#fde047' : '#94a3b8'} fontSize="9" fontWeight="bold" textAnchor="middle">
                    {yard?.block?.includes('B') && yard?.slot ? `Ô: ${yard.slot}` : 'B01 → B20'}
                  </text>
                </g>

                {/* Block C (Reefer) */}
                <g className={yard?.block?.includes('C') ? 'animate-pulse' : ''}>
                  <rect
                    x="380"
                    y="135"
                    width="80"
                    height="120"
                    rx="8"
                    fill={yard?.block?.includes('C') ? '#0284c7' : '#1e293b'}
                    stroke={yard?.block?.includes('C') ? '#7dd3fc' : '#475569'}
                    strokeWidth="2"
                  />
                  <text x="420" y="160" fill="white" fontSize="13" fontWeight="bold" textAnchor="middle">BLOCK C</text>
                  <text x="420" y="180" fill={yard?.block?.includes('C') ? '#bae6fd' : '#94a3b8'} fontSize="9" textAnchor="middle">Bãi Cont Lạnh ❄️</text>
                  <text x="420" y="200" fill={yard?.block?.includes('C') ? '#fde047' : '#94a3b8'} fontSize="9" fontWeight="bold" textAnchor="middle">
                    {yard?.block?.includes('C') && yard?.slot ? `Ô: ${yard.slot}` : 'C01 → C15'}
                  </text>
                </g>

                {/* Route Arrow Indicator from Gate to Target Block */}
                <path
                  d={
                    yard?.block?.includes('A')
                      ? 'M 105 147 L 140 147 L 140 195 L 158 195'
                      : yard?.block?.includes('B')
                      ? 'M 105 147 L 140 147 L 245 147 L 245 195 L 253 195'
                      : 'M 105 147 L 140 147 L 360 147 L 360 195 L 378 195'
                  }
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3.5"
                  strokeDasharray="6,4"
                  strokeLinecap="round"
                />

                {/* Destination Pin */}
                <g
                  transform={
                    yard?.block?.includes('A')
                      ? 'translate(200, 120)'
                      : yard?.block?.includes('B')
                      ? 'translate(295, 120)'
                      : 'translate(420, 120)'
                  }
                >
                  <circle cx="0" cy="0" r="14" fill="#ef4444" className="animate-ping" opacity="0.6" />
                  <circle cx="0" cy="0" r="10" fill="#ef4444" />
                  <text x="0" y="4" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle">★</text>
                </g>
              </svg>

              {/* Float Overlay Info */}
              <div className="absolute bottom-2 left-2 right-2 bg-slate-900/90 backdrop-blur-sm p-2 rounded-xl border border-slate-700/80 text-[11px] text-slate-300 flex justify-between items-center">
                <span>📍 Điểm đích: <strong>{yard?.block || 'Block A'}</strong> {yard?.slot ? `(${yard.slot})` : ''}</span>
                <span className="text-emerald-400 font-mono font-bold">16°07'35"N 108°13'21"E</span>
              </div>
            </div>
          ) : (
            <div className="w-full h-64 relative bg-slate-800 flex items-center justify-center">
              {/* Embedded OpenStreetMap Preview */}
              <iframe
                title="Bản đồ Tiên Sa Port"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                marginHeight="0"
                marginWidth="0"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.008}%2C${lat - 0.006}%2C${lng + 0.008}%2C${lat + 0.006}&layer=mapnik&marker=${lat}%2C${lng}`}
                className="w-full h-full opacity-90"
              />
              <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] text-white border border-slate-700">
                Tọa độ: {lat.toFixed(4)}, {lng.toFixed(4)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Action CTA Button */}
      <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-2">
        <button
          onClick={handleOpenExternalMap}
          disabled={!canNavigate}
          className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] ${
            canNavigate
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-indigo-200 cursor-pointer'
              : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed shadow-none'
          }`}
        >
          <span className="text-base">🧭</span>
          <span>Mở ứng dụng bản đồ điều hướng (Google Maps)</span>
        </button>

        <div className="flex gap-2">
          <button
            onClick={handleCopyAddress}
            className="flex-1 py-2.5 bg-fog hover:bg-chalk border border-chalk rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <span>📋</span>
            <span>{copySuccess ? 'Đã sao chép địa chỉ ✓' : 'Sao chép địa chỉ'}</span>
          </button>

          {/* Quick action: Confirm arrived at yard if in transit */}
          {navData.status === 'In Transit' && (
            <button
              onClick={handleConfirmArrived}
              disabled={actionLoading}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <span>{actionLoading ? '⏳' : '🏁'}</span>
              <span>{actionLoading ? 'Đang cập nhật...' : 'Đã đến bãi'}</span>
            </button>
          )}
        </div>

        {!canNavigate && (
          <p className="text-[11px] text-center text-slate-500 font-medium pt-1">
            ⚠️ Nút mở bản đồ điều hướng bị khóa cho tới khi chuyến chuyển sang trạng thái <strong>In Transit</strong>.
          </p>
        )}
      </div>
    </div>
  )
}
