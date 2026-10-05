import React, { useState, useEffect, useMemo } from 'react'
import gateService from '../../services/gateService'

export default function GateHistory() {
  const [historyLogs, setHistoryLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('All')
  const [resultFilter, setResultFilter] = useState('All')
  const [gateFilter, setGateFilter] = useState('All')
  const [selectedLog, setSelectedLog] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setLoading(true)
    const res = await gateService.getVerificationHistory()
    if (res.success && Array.isArray(res.data)) {
      // Map API fields sang UI format (kèm hình ảnh lưu trữ)
      const mapped = res.data.map((item, idx) => ({
        id: item.verificationCode || item.id || `REC-${idx + 1}`,
        rawId: item.id,
        time: (item.verificationTime || item.checkedAtUtc || item.createdAt)
          ? new Date(item.verificationTime || item.checkedAtUtc || item.createdAt).toLocaleString('vi-VN')
          : '—',
        vehicle: item.vehiclePlate ? `Xe đầu kéo (${item.vehiclePlate})` : (item.vehicleType || 'Xe Container'),
        plate: item.detectedPlate || item.vehiclePlate || item.licensePlate || '—',
        driver: item.driverName || '—',
        container: item.containerNumber || '—',
        gate: item.gateCode ? `${item.gateCode}${item.laneCode ? ' · ' + item.laneCode : ''}` : (item.gateLaneId || 'Cổng A · Làn 01'),
        action: (item.verificationType?.includes('OUT') || item.operationType === 'GateOut') ? 'CHECK-OUT' : 'CHECK-IN',
        result: (item.verificationStatus === 'PASS' || item.status === 'PASS') ? 'Passed' : 'Rejected',
        bookingId: item.bookingNumber || item.bookingId || '—',
        reason: item.failureReason || item.notes,
        plateConfidence: item.plateConfidence 
          ? (item.plateConfidence <= 1 ? (item.plateConfidence * 100).toFixed(1) + '%' : item.plateConfidence + '%') 
          : null,
        vehiclePlateImageUrl: item.vehiclePlateImageUrl || item.plateImageUrl || null,
        overviewImageUrl: item.overviewImageUrl || null,
      }))
      setHistoryLogs(mapped)
    } else {
      setHistoryLogs([])
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return historyLogs.filter((log) => {
      const matchQ =
        log.vehicle.toLowerCase().includes(q) ||
        log.plate.toLowerCase().includes(q) ||
        log.driver.toLowerCase().includes(q) ||
        log.container.toLowerCase().includes(q) ||
        (log.bookingId || '').toLowerCase().includes(q)
      const matchA = actionFilter === 'All' || log.action === actionFilter
      const matchR = resultFilter === 'All' || log.result === resultFilter
      const matchG = gateFilter === 'All' || log.gate === gateFilter
      return matchQ && matchA && matchR && matchG
    })
  }, [historyLogs, search, actionFilter, resultFilter, gateFilter])

  const resultBadge = (result) => {
    const map = {
      Passed: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      Rejected: 'bg-rose-100 text-rose-900 border-rose-300',
      Pending: 'bg-amber-100 text-amber-900 border-amber-300',
    }
    const icon = { Passed: '✓', Rejected: '✕', Pending: '⋯' }
    return (
      <span
        className={`px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold inline-flex items-center gap-1 ${
          map[result] || 'bg-slate-100 text-slate-700 border-slate-300'
        }`}
      >
        <span>{icon[result] || '?'}</span>
        {result}
      </span>
    )
  }

  const actionBadge = (action) => (
    <span
      className={`px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold font-mono ${
        action === 'CHECK-IN'
          ? 'bg-blue-100 text-blue-900 border-blue-300'
          : 'bg-slate-100 text-slate-800 border-slate-300'
      }`}
    >
      {action}
    </span>
  )

  const stats = {
    total: historyLogs.length,
    passed: historyLogs.filter((l) => l.result === 'Passed').length,
    rejected: historyLogs.filter((l) => l.result === 'Rejected').length,
    checkin: historyLogs.filter((l) => l.action === 'CHECK-IN').length,
    checkout: historyLogs.filter((l) => l.action === 'CHECK-OUT').length,
    withImages: historyLogs.filter((l) => l.overviewImageUrl || l.vehiclePlateImageUrl).length,
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-black bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full uppercase">
            GATE OFFICER
          </span>
          <h2 className="font-heading text-3xl font-black text-slate-900 mt-1">Lịch Sử Kiểm Soát Cổng (Gate History)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Toàn bộ lịch sử xác thực xe ra vào cổng cảng, hình ảnh chụp hiện trường và ảnh cắt biển số OCR lưu trữ từ Backend.
          </p>
        </div>
        <button
          onClick={loadHistory}
          className="h-10 px-4 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>Làm Mới
        </button>
      </div>

      {/* KPI mini row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          ['Tổng Lượt Quét', stats.total, 'text-slate-900', 'border-slate-200'],
          ['Hợp Lệ (Passed)', stats.passed, 'text-emerald-700', 'border-emerald-300'],
          ['Từ Chối (Rejected)', stats.rejected, 'text-rose-700', 'border-rose-300'],
          ['Có Lưu Trữ Ảnh', stats.withImages, 'text-blue-700', 'border-blue-300'],
          ['Check-in / Out', `${stats.checkin} / ${stats.checkout}`, 'text-slate-700', 'border-slate-200'],
        ].map(([label, val, color, border]) => (
          <div key={label} className={`bg-white rounded-2xl border-2 ${border} p-4 shadow-sm`}>
            <div className="text-[10px] font-bold text-slate-500 uppercase">{label}</div>
            <div className={`text-2xl sm:text-3xl font-black font-mono ${color}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center">
        <div className="relative w-full max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Vehicle / container / driver / booking..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          {[
            ['Action', actionFilter, setActionFilter, ['All', 'CHECK-IN', 'CHECK-OUT']],
            ['Result', resultFilter, setResultFilter, ['All', 'Passed', 'Rejected', 'Pending']],
            ['Gate', gateFilter, setGateFilter, ['All', 'Cổng A', 'Cổng B', 'Gate A']],
          ].map(([label, val, setter, opts]) => (
            <select
              key={label}
              value={val}
              onChange={(e) => setter(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-orange-500"
            >
              {opts.map((o) => (
                <option key={o}>{o === 'All' ? `${label}: All` : o}</option>
              ))}
            </select>
          ))}
          <span className="text-xs text-slate-500 self-center">{filtered.length} bản ghi</span>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-slate-500 font-bold text-sm">
              Đang tải dữ liệu từ Backend API...
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  {[
                    'Mã Xác Thực',
                    'Thời Gian',
                    'Phương Tiện & Biển Số',
                    'Hình Ảnh',
                    'Tài Xế',
                    'Container',
                    'Làn Cổng',
                    'Hành Động',
                    'Kết Quả',
                    'Mã Booking',
                    'Chi Tiết',
                  ].map((h) => (
                    <th
                      key={h}
                      className={`py-3.5 px-4 whitespace-nowrap ${
                        h === 'Chi Tiết' ? 'text-right' : ''
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="py-12 text-center text-slate-400 font-bold text-sm">
                      Chưa có bản ghi lịch sử kiểm soát nào trong hệ thống.
                    </td>
                  </tr>
                ) : (
                  filtered.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 font-bold">{log.id}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">{log.time}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{log.vehicle}</div>
                        <div className="text-[11px] font-mono text-slate-600 font-black tracking-wide">{log.plate}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.overviewImageUrl || log.vehiclePlateImageUrl ? (
                          <div className="flex items-center gap-1.5">
                            {log.overviewImageUrl && (
                              <img
                                src={log.overviewImageUrl}
                                alt="Scene"
                                className="w-9 h-7 object-cover rounded border border-slate-300 shadow-xs cursor-pointer hover:scale-110 transition-transform"
                                onClick={() => setPreviewImage(log.overviewImageUrl)}
                                title="Bấm để xem ảnh hiện trường"
                              />
                            )}
                            {log.vehiclePlateImageUrl && (
                              <img
                                src={log.vehiclePlateImageUrl}
                                alt="Plate"
                                className="w-9 h-7 object-contain bg-slate-900 rounded border border-slate-300 p-0.5 shadow-xs cursor-pointer hover:scale-110 transition-transform"
                                onClick={() => setPreviewImage(log.vehiclePlateImageUrl)}
                                title="Bấm để xem ảnh cắt biển số"
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono italic">Chưa có ảnh</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{log.driver}</td>
                      <td className="py-3 px-4 font-mono text-slate-900">{log.container}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{log.gate}</td>
                      <td className="py-3 px-4">{actionBadge(log.action)}</td>
                      <td className="py-3 px-4">{resultBadge(log.result)}</td>
                      <td className="py-3 px-4 font-mono text-orange-600 font-bold text-[11px]">
                        {log.bookingId || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold text-[11px] hover:bg-black flex items-center gap-1 ml-auto cursor-pointer shadow-xs transition-transform active:scale-95"
                        >
                          <span className="material-symbols-outlined text-xs">visibility</span>Chi Tiết
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-3xl p-6 md:p-8 shadow-2xl overflow-y-auto animate-in zoom-in-95 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-black text-orange-600 uppercase font-mono block">
                  CHI TIẾT LỊCH SỬ KIỂM SOÁT CỔNG
                </span>
                <h3 className="font-heading text-xl font-black text-slate-900 font-mono">
                  {selectedLog.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Thông tin đối soát tổng quan */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
              {[
                ['Thời gian', selectedLog.time],
                ['Làn cổng', selectedLog.gate],
                ['Phương tiện', selectedLog.vehicle],
                ['Biển số nhận diện', selectedLog.plate],
                ['Tài xế', selectedLog.driver],
                ['Container', selectedLog.container],
                ['Mã Booking', selectedLog.bookingId || '—'],
                ['Độ chính xác OCR', selectedLog.plateConfidence || '98%'],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase">{k}</div>
                  <div className="font-bold text-slate-900 mt-0.5 truncate" title={v}>{v}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 items-center">
              {actionBadge(selectedLog.action)}
              {resultBadge(selectedLog.result)}
              {selectedLog.reason && (
                <span className="text-xs text-rose-600 font-bold">
                  {selectedLog.reason}
                </span>
              )}
            </div>

            {/* ══ BẰNG CHỨNG HÌNH ẢNH ĐÃ LƯU TRỮ TẠI CỔNG ══ */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-orange-600">photo_camera</span>
                  BẰNG CHỨNG HÌNH ẢNH ĐÃ LƯU TRỮ (ẢNH XE & BIỂN SỐ)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Bấm vào ảnh để xem kích thước lớn</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Ảnh Hiện Trường */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-600 uppercase">ẢNH CHỤP HIỆN TRƯỜNG</span>
                    {selectedLog.overviewImageUrl ? (
                      <span className="text-[9px] font-bold text-emerald-600 font-mono bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Đã lưu DB
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-slate-400 font-mono">Chưa có ảnh</span>
                    )}
                  </div>
                  <div
                    className="aspect-video bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border border-slate-300 relative group cursor-pointer"
                    onClick={() => selectedLog.overviewImageUrl && setPreviewImage(selectedLog.overviewImageUrl)}
                  >
                    {selectedLog.overviewImageUrl ? (
                      <>
                        <img
                          src={selectedLog.overviewImageUrl}
                          alt="Hiện trường"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[11px] font-mono font-bold">
                          🔍 Bấm phóng to
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-slate-500 text-xs gap-1">
                        <span className="material-symbols-outlined text-2xl">image_not_supported</span>
                        <span className="text-[10px] font-mono">[ Chưa có ảnh hiện trường ]</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Cắt biển số OCR */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-600 uppercase">CẮT BIỂN SỐ (OCR CROP)</span>
                    {selectedLog.vehiclePlateImageUrl ? (
                      <span className="text-[9px] font-bold text-blue-600 font-mono bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        YOLO Crop
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-slate-400 font-mono">Chưa có ảnh</span>
                    )}
                  </div>
                  <div
                    className="aspect-video bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border border-slate-300 relative group cursor-pointer"
                    onClick={() => selectedLog.vehiclePlateImageUrl && setPreviewImage(selectedLog.vehiclePlateImageUrl)}
                  >
                    {selectedLog.vehiclePlateImageUrl ? (
                      <>
                        <img
                          src={selectedLog.vehiclePlateImageUrl}
                          alt="Cắt biển số"
                          className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[11px] font-mono font-bold">
                          🔍 Bấm phóng to
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-slate-500 text-xs gap-1">
                        <span className="material-symbols-outlined text-2xl">crop</span>
                        <span className="text-[10px] font-mono">[ Chưa có ảnh cắt biển số ]</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedLog(null)}
              className="w-full h-11 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs cursor-pointer shadow-md transition-colors"
            >
              Đóng Chi Tiết
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Modal Xem Ảnh Phóng To */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl p-4 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center w-full pb-3 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-400">photo_library</span>
                <span className="text-xs font-mono font-bold text-slate-200 uppercase">
                  BẰNG CHỨNG HÌNH ẢNH LƯU TRỮ
                </span>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="w-full flex items-center justify-center py-4 bg-black/40 rounded-xl mt-3">
              <img
                src={previewImage}
                alt="Enlarged evidence"
                className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
