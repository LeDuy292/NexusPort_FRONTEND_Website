import React, { useState } from 'react'

export default function OperationControl() {
  const [toastMessage, setToastMessage] = useState('')

  // Vessel & Berth State (EVER GIVEN at Berth B-01)
  const [vesselState, setVesselState] = useState({
    name: 'EVER GIVEN',
    imo: '9811000',
    berth: 'Cầu B-01',
    status: 'DISCHARGING', // 'DISCHARGING' | 'COMPLETED'
    statusLabel: '🟣 ĐANG DỠ CONTAINER',
    berthStatus: 'OCCUPIED', // 'OCCUPIED' | 'AVAILABLE'
    totalContainers: 1247,
    completedContainers: 1247,
    remainingContainers: 0,
    progressPercent: 100,
    duration: '12 giờ 43 phút',
    completedTimestamp: null,
    completedBy: null,
  })

  // Checklist Items (UC19) in Vietnamese
  const [checklist] = useState([
    { id: 1, label: 'Tất cả container đã dỡ hoàn tất', detail: '1,247 / 1,247 TEU hoàn thành (100%)', ok: true },
    { id: 2, label: 'Không còn công việc tồn đọng tại hầm tàu', detail: 'Hầm tàu 01, 02, 03, 04 đã giải phóng xong', ok: true },
    { id: 3, label: 'Cẩu bờ đã ngắt nguồn và đỗ an toàn', detail: 'Cẩu bờ QC-01 & QC-02 đã khoá cáp neo an toàn', ok: true },
    { id: 4, label: 'Khu vực cầu bến B-01 đảm bảo an toàn', detail: 'Đảm bảo an toàn lao động và vệ sinh mặt bến', ok: true },
    { id: 5, label: 'Không có báo cáo sự cố chưa xử lý', detail: 'Tất cả báo cáo sự cố đã được đóng', ok: true },
  ])

  // Incidents List (UC20)
  const [incidents, setIncidents] = useState([
    {
      id: 'INC-20260812-001',
      time: '11:15',
      type: 'Cẩu Bờ (QC) Hỏng Hóc',
      severity: 'Nghiêm Trọng',
      container: 'MSCU441920',
      crane: 'QC-02',
      desc: 'Cẩu bờ QC-02 bị gián đoạn nguồn điện 15 phút.',
      status: 'ĐANG XỬ LÝ',
    },
  ])

  // Modals
  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [showCompleteConfirmModal, setShowCompleteConfirmModal] = useState(false)

  // Incident Form Inputs
  const [incidentForm, setIncidentForm] = useState({
    type: 'Cẩu Bờ (QC) Hỏng Hóc',
    severity: 'Trung Bình',
    container: 'MSCU1234567',
    crane: 'QC-01',
    desc: '',
    fileName: '',
  })

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  const allChecklistPassed = checklist.every(c => c.ok)

  // ── UC20: SUBMIT INCIDENT HANDLER ───────────────────────────
  const handleSubmitIncident = (e) => {
    e.preventDefault()
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    const newInc = {
      id: `INC-20260812-00${incidents.length + 1}`,
      time: nowTime,
      type: incidentForm.type,
      severity: incidentForm.severity,
      container: incidentForm.container || '—',
      crane: incidentForm.crane || '—',
      desc: incidentForm.desc || 'Báo cáo sự cố vận hành cầu bến',
      status: 'ĐANG MỞ (OPEN)',
    }

    setIncidents(prev => [newInc, ...prev])
    setShowIncidentModal(false)
    showToast(`🚨 UC20: Đã gửi báo cáo sự cố ${newInc.id} (${newInc.type}) — Operator đã nhận notification realtime!`)
    setIncidentForm({ type: 'Cẩu Bờ (QC) Hỏng Hóc', severity: 'Trung Bình', container: '', crane: 'QC-01', desc: '', fileName: '' })
  }

  // ── UC19: CONFIRM COMPLETE VESSEL OPERATION HANDLER ──────────
  const handleConfirmCompleteVessel = () => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('vi-VN')

    setVesselState(prev => ({
      ...prev,
      status: 'COMPLETED',
      statusLabel: '🟢 ĐÃ HOÀN TẤT',
      berthStatus: 'AVAILABLE',
      completedTimestamp: nowTime,
      completedBy: 'Trần Văn Hải (Nhân Viên Cầu Bến)',
    }))

    setShowCompleteConfirmModal(false)
    showToast(`🟢 UC19: ĐÃ HOÀN TẤT KHAI THÁC TÀU ${vesselState.name}! Trạng thái tàu: HOÀN TẤT · Cầu bến B-01: SẴN SÀNG (AVAILABLE).`)
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen text-slate-900 relative">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-amber-100 text-amber-950 border-2 border-amber-400 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-3 z-[100] animate-bounce">
          <span className="text-amber-600">●</span>{toastMessage}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs font-mono">
            <span className="font-heading font-black text-orange-600 tracking-wider">NEXUSPORT</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 font-bold">Khai Thác Cầu Bến</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-extrabold">Điều Hành & Sự Cố</span>
          </div>

          <div className="flex items-center gap-3">
            <h2 className="font-heading text-3xl font-black text-slate-900">Điều Hành & Sự Cố Cầu Bến</h2>
            <span className={`px-3 py-1 border font-mono font-black text-xs rounded-xl ${
              vesselState.status === 'COMPLETED' ? 'bg-purple-100 text-purple-950 border-purple-400' : 'bg-blue-100 text-blue-950 border-blue-400'
            }`}>
              TRẠNG THÁI: {vesselState.statusLabel}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">Tàu: <strong className="text-slate-900 font-black">{vesselState.name}</strong> · Cầu Bến: <strong className="text-amber-900 font-black">{vesselState.berth}</strong> · Báo cáo sự cố (UC20) & Xác nhận hoàn tất tác nghiệp (UC19).</p>
        </div>

        {/* Right Corner: Progress Badge */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-emerald-100 text-emerald-950 border-2 border-emerald-400 rounded-2xl text-xs font-mono font-black shadow-xs">
            TIẾN ĐỘ: {vesselState.progressPercent}% HOÀN THÀNH
          </div>
        </div>
      </div>

      {/* ── PERMISSION NOTICE BANNER ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
        <span className="material-symbols-outlined text-blue-600 text-2xl">info</span>
        <div className="text-xs text-blue-900 font-medium">
          <strong className="font-extrabold">PHÂN QUYỀN VẬN HÀNH:</strong> Nhân viên Cầu bến thực hiện báo cáo sự cố thực địa (UC20) và xác nhận hoàn tất tác nghiệp tàu (UC19). Nhân viên Cầu bến không được phép thay đổi kế hoạch xếp dỡ hoặc đổi cầu bến.
        </div>
      </div>

      {/* ── TOP SECTION — OPERATION SUMMARY ── */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-600">summarize</span>
            TỔNG KẾT TÁC NGHIỆP TÀU (OPERATION SUMMARY)
          </h3>
          <span className="text-xs font-mono font-bold text-slate-500">Thời gian tác nghiệp: {vesselState.duration}</span>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Tổng Số Container</span>
            <strong className="text-slate-900 font-black text-xl">{vesselState.totalContainers.toLocaleString()} TEU</strong>
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-300">
            <span className="text-[10px] text-emerald-800 uppercase font-sans font-bold block">Đã Hoàn Thành</span>
            <strong className="text-emerald-950 font-black text-xl">{vesselState.completedContainers.toLocaleString()} TEU</strong>
          </div>
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-300">
            <span className="text-[10px] text-amber-800 uppercase font-sans font-bold block">Còn Phải Dỡ</span>
            <strong className="text-amber-950 font-black text-xl">{vesselState.remainingContainers} TEU</strong>
          </div>
          <div className="bg-purple-50 p-4 rounded-xl border border-purple-300">
            <span className="text-[10px] text-purple-800 uppercase font-sans font-bold block">Thời Gian Khai Thác</span>
            <strong className="text-purple-950 font-black text-xl">{vesselState.duration}</strong>
          </div>
        </div>

        {/* 100% Progress Bar */}
        <div className="bg-slate-100 p-5 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="font-sans font-extrabold text-slate-700">TIẾN ĐỘ HOÀN THÀNH TẠI CẦU B-01:</span>
            <span className="font-black text-emerald-700 text-sm">
              {vesselState.completedContainers} / {vesselState.totalContainers} TEU — <strong className="font-black">100% HOÀN THÀNH</strong>
            </span>
          </div>
          <div className="w-full bg-slate-300 h-5 rounded-full overflow-hidden shadow-inner border border-slate-300 relative">
            <div className="bg-emerald-600 h-full rounded-full transition-all duration-500 shadow-md w-full"></div>
          </div>
        </div>
      </div>

      {/* ── SECTION 1 & SECTION 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── SECTION 1 — INCIDENT REPORT (UC20) ── */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600">warning</span>
                KHU VỰC 1 — BÁO CÁO SỰ CỐ CẦU BẾN (UC20)
              </h3>
              <span className="text-xs font-mono font-bold text-slate-500">{incidents.length} Sự cố đã ghi nhận</span>
            </div>

            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl space-y-2">
              <div className="text-xs font-black text-red-950">Báo Cáo Sự Cố Tại Cầu Bến (Report Incident)</div>
              <p className="text-xs text-red-900">
                Báo cáo sự cố thiết bị cẩu bờ, hư hỏng vỏ container hoặc gián đoạn thời tiết tại cầu bến. Operator sẽ nhận thông báo realtime ngay lập tức.
              </p>
              <button onClick={() => setShowIncidentModal(true)}
                className="mt-2 h-11 px-5 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-400 font-black text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all">
                <span className="material-symbols-outlined text-base">add_alert</span>
                [ + BÁO CÁO SỰ CỐ MỚI ]
              </button>
            </div>

            {/* Incidents List Display */}
            <div className="mt-4 space-y-3">
              <div className="text-xs font-extrabold text-slate-700 uppercase font-mono">DANH SÁCH SỰ CỐ ĐÃ BÁO CÁO:</div>
              {incidents.map(inc => (
                <div key={inc.id} className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-slate-900 font-sans">{inc.id} · {inc.type}</span>
                    <span className="px-2 py-0.5 bg-red-100 text-red-950 border border-red-300 rounded font-black text-[10px]">
                      TRẠNG THÁI: {inc.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-sans">
                    Thời gian: {inc.time} · Mức độ: <strong className="text-red-700 font-extrabold">{inc.severity}</strong> · Cẩu liên quan: {inc.crane}
                  </div>
                  <div className="text-xs text-slate-800 font-sans font-bold bg-white p-2 rounded border border-slate-200">
                    "{inc.desc}"
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-[11px] text-slate-600 font-sans">
            🔔 <strong>Thông báo Realtime:</strong> Báo cáo sự cố được đồng bộ tức thì đến trung tâm điều hành Operator & Dispatcher.
          </div>
        </div>

        {/* ── SECTION 2 — COMPLETE OPERATION (UC19) ── */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">verified</span>
                KHU VỰC 2 — XÁC NHẬN HOÀN TẤT TÁC NGHIỆP (UC19)
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black font-mono ${
                vesselState.status === 'COMPLETED' ? 'bg-purple-100 text-purple-950 border-purple-400' : 'bg-emerald-100 text-emerald-950 border-emerald-400'
              }`}>
                {vesselState.status === 'COMPLETED' ? 'ĐÃ HOÀN TẤT 🟢' : 'ĐỦ ĐIỀU KIỆN HOÀN TẤT 🟢'}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="text-xs font-black text-slate-900 uppercase tracking-wider">Danh Mục Kiểm Tra Hoàn Tất Tác Nghiệp Tàu:</div>
              
              <div className="space-y-2">
                {checklist.map(item => (
                  <div key={item.id} className="p-3 rounded-xl border bg-emerald-50/70 border-emerald-300 text-emerald-950 flex items-start gap-2.5">
                    <span className="font-black text-emerald-600 text-base leading-none">✓</span>
                    <div>
                      <div className="font-extrabold text-xs font-mono uppercase">{item.label}</div>
                      <div className="text-[11px] font-medium text-slate-600 mt-0.5">{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Status Banner */}
              {vesselState.status === 'COMPLETED' ? (
                <div className="bg-purple-50 border-2 border-purple-400 rounded-2xl p-4 space-y-1 font-mono text-xs">
                  <div className="font-black text-purple-950 text-sm">🟣 HOÀN TẤT TÁC NGHIỆP TÀU (COMPLETED)</div>
                  <div className="text-slate-700 font-bold">Trạng thái Tàu: <strong className="text-purple-900 font-black">HOÀN TẤT (COMPLETED)</strong> · Cầu B-01: <strong className="text-emerald-700 font-black">SẴN SÀNG (AVAILABLE)</strong></div>
                  <div className="text-[11px] text-slate-500 font-sans">Thời gian xác nhận: {vesselState.completedTimestamp} bởi {vesselState.completedBy}</div>
                </div>
              ) : (
                <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-emerald-600 text-3xl">task_alt</span>
                    <div>
                      <div className="font-black text-emerald-950 text-sm">🟢 READY TO COMPLETE</div>
                      <div className="text-xs text-emerald-900 font-bold mt-0.5">100% điều kiện an toàn và khối lượng bốc dỡ đã thỏa mãn.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          {vesselState.status !== 'COMPLETED' && (
            <button onClick={() => setShowCompleteConfirmModal(true)} disabled={!allChecklistPassed}
              className="w-full h-14 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-2 border-emerald-400 font-black text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all">
              <span className="material-symbols-outlined text-xl">check_circle</span>
              [ ✅ XÁC NHẬN HOÀN TẤT KHAI THÁC TÀU (UC19) ]
            </button>
          )}
        </div>

      </div>

      {/* ── MODAL 1: REPORT INCIDENT MODAL (UC20 POPUP) ── */}
      {showIncidentModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 font-sans">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600 text-xl">add_alert</span>
                <h3 className="font-heading text-lg font-extrabold text-slate-900">Báo Cáo Sự Cố Cầu Bến (UC20)</h3>
              </div>
              <button onClick={() => setShowIncidentModal(false)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitIncident} className="space-y-3.5 text-xs font-bold">
              {/* Incident Type Dropdown */}
              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Loại Sự Cố (Incident Type) *</label>
                <select value={incidentForm.type} onChange={e => setIncidentForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-extrabold text-sm focus:outline-none focus:border-slate-900" required>
                  {['Cẩu Bờ (QC) Hỏng Hóc', 'Thời Tiết Xấu / Sóng Lớn', 'Container Kẹt Trong Hầm Tàu', 'Container Hư Hỏng / Móp Méo', 'Sự Cố An Toàn Lao Động', 'Hư Hỏng Thiết Bị Bãi (RTG/ITV)', 'Khác'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Severity Pills */}
              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Mức Độ Nghiêm Trọng (Severity) *</label>
                <div className="flex gap-2 font-mono">
                  {['Low', 'Medium', 'High', 'Critical'].map(sev => (
                    <button type="button" key={sev} onClick={() => setIncidentForm(p => ({ ...p, severity: sev }))}
                      className={`flex-1 py-2 rounded-xl border-2 text-xs font-black transition-all cursor-pointer ${
                        incidentForm.severity === sev
                          ? (sev === 'Critical' ? 'bg-red-200 text-red-950 border-red-500' : 'bg-amber-200 text-amber-950 border-amber-500')
                          : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                      }`}>
                      {sev === 'Low' ? 'Nhẹ' : sev === 'Medium' ? 'Trung Bình' : sev === 'High' ? 'Nghiêm Trọng' : 'Rất Nghiêm Trọng'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Related Container & Crane */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Mã Container Liên Quan</label>
                  <input type="text" value={incidentForm.container} onChange={e => setIncidentForm(p => ({ ...p, container: e.target.value.toUpperCase() }))}
                    placeholder="VD: MSCU1234567"
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl font-mono font-bold uppercase" />
                </div>

                <div>
                  <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Cẩu Bờ Liên Quan</label>
                  <select value={incidentForm.crane} onChange={e => setIncidentForm(p => ({ ...p, crane: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl font-bold">
                    {['QC-01', 'QC-02', 'QC-03', 'QC-04', 'RTG-01', 'RTG-02'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Mô Tả Chi Tiết Sự Cố *</label>
                <textarea rows="3" value={incidentForm.desc} onChange={e => setIncidentForm(p => ({ ...p, desc: e.target.value }))}
                  placeholder="Mô tả chi tiết diễn biến sự cố tại cầu bến B-01..."
                  className="w-full p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-normal text-slate-900 focus:outline-none focus:border-slate-900 resize-none" required />
              </div>

              {/* Upload Evidence */}
              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Đính Kèm Bằng Chứng (Ảnh / Video)</label>
                <div className="p-3 bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl text-center text-xs font-medium text-slate-600">
                  <span className="material-symbols-outlined text-slate-400 text-lg block">cloud_upload</span>
                  <span>Kéo thả tệp hoặc chọn tệp từ thiết bị để đính kèm</span>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowIncidentModal(false)} className="flex-1 h-11 border border-slate-300 text-slate-700 rounded-xl font-extrabold text-xs hover:bg-slate-100">
                  Hủy
                </button>
                <button type="submit"
                  className="flex-1 h-11 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-400 rounded-xl font-black text-xs shadow-xs">
                  [ GỬI BÁO CÁO SỰ CỐ ]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: CONFIRMATION MODAL FOR UC19 COMPLETE VESSEL ── */}
      {showCompleteConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 font-sans border-2 border-emerald-400">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-2xl">help</span>
                <h3 className="font-heading text-lg font-black text-slate-900">Xác Nhận Hoàn Tất Khai Thác Tàu</h3>
              </div>
              <button onClick={() => setShowCompleteConfirmModal(false)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="font-black text-slate-900 text-sm">
                Bạn có chắc chắn muốn hoàn tất tác nghiệp khai thác cho tàu này?
              </p>
              
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 font-bold leading-relaxed">
                "Sau khi xác nhận hoàn tất, trạng thái tàu sẽ chuyển sang <strong className="text-purple-900">HOÀN TẤT (COMPLETED)</strong> và Cầu bến B-01 sẽ chuyển sang <strong className="text-emerald-700">SẴN SÀNG (AVAILABLE)</strong> để đón tàu tiếp theo."
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button onClick={() => setShowCompleteConfirmModal(false)}
                className="flex-1 h-12 border-2 border-slate-300 text-slate-800 rounded-xl font-extrabold text-xs hover:bg-slate-100 cursor-pointer">
                [ HỦY BỎ ]
              </button>
              <button onClick={handleConfirmCompleteVessel}
                className="flex-1 h-12 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-2 border-emerald-400 rounded-xl font-black text-xs shadow-md cursor-pointer">
                [ XÁC NHẬN HOÀN TẤT ]
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
