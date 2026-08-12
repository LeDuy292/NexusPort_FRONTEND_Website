import React, { useState, useEffect } from 'react'

export default function BerthIncidentReporting() {
  const [toastMessage, setToastMessage] = useState('')
  const [timeString, setTimeString] = useState('')

  // Incident Form Inputs in Vietnamese
  const [incidentForm, setIncidentForm] = useState({
    type: 'Cẩu Bờ (QC/STS) Hỏng Hóc',
    severity: 'HIGH', // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    relatedCrane: 'STS-02',
    relatedContainer: 'MSCU1234567',
    desc: 'Cẩu bờ STS-02 bị gián đoạn nguồn điện 15 phút, tay cẩu đang ở vị trí nâng container tại hầm tàu 02.',
    evidenceFiles: [
      { name: 'Anh_Chup_Nguon_Cau_STS02.jpg', size: '2.4 MB', type: 'image' },
      { name: 'Video_Kiem_Tra_Ham_Tau_02.mp4', size: '14.8 MB', type: 'video' },
    ],
    operationImpact: 'Tạm dừng tác nghiệp tạm thời (Operation temporarily stopped)',
    immediateAction: 'Đã cho dừng vận hành cẩu STS-02 và thông báo cho đội kỹ thuật bảo trì cầu cảng khẩn cấp.',
  })

  // Recent Berth Incidents Dataset (Section 10)
  const [recentIncidents, setRecentIncidents] = useState([
    { id: 'INC-20260812-003', time: '14:20', type: 'Container Hư Hỏng / Móp Méo', severity: 'MEDIUM', vessel: 'MSC GULSUN', berth: 'B-02', status: 'RESOLVED', reportedBy: 'Trần Văn Hải' },
    { id: 'INC-20260812-002', time: '11:05', type: 'Thời Tiết Xấu / Sóng Lớn', severity: 'LOW', vessel: 'CMA CGM', berth: 'B-03', status: 'RESOLVED', reportedBy: 'Lê Văn C' },
    { id: 'INC-20260812-001', time: '09:15', type: 'Hư Hỏng Thiết Bị Bãi (RTG/ITV)', severity: 'HIGH', vessel: 'EVER GIVEN', berth: 'B-01', status: 'IN PROGRESS', reportedBy: 'Trần Văn Hải' },
  ])

  // Submitted Incident State (Section 9 Success State)
  const [submittedIncident, setSubmittedIncident] = useState(null)

  // Real-time clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeString(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' - ' + now.toLocaleDateString('vi-VN'))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // Handle Upload Evidence Simulation
  const handleUploadFile = (fileType) => {
    const newFileName = fileType === 'image' ? `Bang_Chung_Anh_${Date.now().toString().slice(-4)}.jpg` : `Bang_Chung_Video_${Date.now().toString().slice(-4)}.mp4`
    setIncidentForm(prev => ({
      ...prev,
      evidenceFiles: [...prev.evidenceFiles, { name: newFileName, size: '4.2 MB', type: fileType }],
    }))
    showToast(`📁 Đã đính kèm ${fileType === 'image' ? 'ảnh' : 'video'} bằng chứng: ${newFileName}`)
  }

  // ── SUBMIT INCIDENT REPORT HANDLER (SECTION 8 & 9) ───────────────
  const handleSubmitIncident = (e) => {
    e.preventDefault()
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    const newIncId = `INC-20260812-00${recentIncidents.length + 4}`

    const newRecord = {
      id: newIncId,
      time: nowTime,
      type: incidentForm.type,
      severity: incidentForm.severity,
      vessel: 'EVER GIVEN',
      berth: 'B-01',
      status: 'OPEN',
      reportedBy: 'Trần Văn Hải (Nhân Viên Cầu Bến)',
      desc: incidentForm.desc,
    }

    setSubmittedIncident(newRecord)
    setRecentIncidents(prev => [newRecord, ...prev])
    showToast(`🚨 ĐÃ GỬI BÁO CÁO SỰ CỐ ${newIncId}! Operator đã nhận thông báo cảnh báo realtime.`)
  }

  const renderSeverityBadge = (sev) => {
    const map = {
      'LOW': 'bg-emerald-100 text-emerald-950 border-emerald-400',
      'MEDIUM': 'bg-amber-100 text-amber-950 border-amber-400',
      'HIGH': 'bg-orange-100 text-orange-950 border-orange-400',
      'CRITICAL': 'bg-red-200 text-red-950 border-red-500',
    }
    const icon = {
      'LOW': '🟢 NHẸ (LOW)',
      'MEDIUM': '🟡 TRUNG BÌNH (MEDIUM)',
      'HIGH': '🟠 NGHIÊM TRỌNG (HIGH)',
      'CRITICAL': '🔴 RẤT NGHIÊM TRỌNG (CRITICAL)',
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full border font-black text-[10px] font-mono ${map[sev] || 'bg-slate-100 text-slate-900 border-slate-300'}`}>
        {icon[sev] || sev}
      </span>
    )
  }

  const renderStatusBadge = (status) => {
    const map = {
      'OPEN': 'bg-red-100 text-red-950 border-red-400',
      'IN PROGRESS': 'bg-amber-100 text-amber-950 border-amber-400',
      'RESOLVED': 'bg-emerald-100 text-emerald-950 border-emerald-400',
    }
    const labelMap = {
      'OPEN': 'ĐANG MỞ 🔴',
      'IN PROGRESS': 'ĐANG XỬ LÝ 🟡',
      'RESOLVED': 'ĐÃ GIẢI QUYẾT 🟢',
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full border font-black text-[10px] font-mono ${map[status] || 'bg-slate-100 text-slate-800 border-slate-300'}`}>
        {labelMap[status] || status}
      </span>
    )
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
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs font-mono">
            <span className="font-heading font-black text-orange-600 tracking-wider">NEXUSPORT</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 font-bold">Khai Thác Cầu Bến</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-extrabold">Báo Cáo Sự Cố Cầu Bến</span>
          </div>

          <div className="flex items-center gap-3">
            <h2 className="font-heading text-3xl font-black text-slate-900">Báo Cáo Sự Cố Cầu Bến (Berth Incident Reporting)</h2>
            <span className="px-3 py-1 bg-red-100 text-red-950 border border-red-400 font-mono font-black text-xs rounded-xl">
              UC20 — REPORT INCIDENT
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">Lập và theo dõi báo cáo các sự cố phát sinh trong quá trình tác nghiệp khai thác tàu. Cảnh báo thời gian thực được đồng bộ tự động tới Operator.</p>
          
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-mono">
            <span>Tàu: <strong className="text-slate-900 font-black">EVER GIVEN</strong></span>
            <span className="text-slate-300">|</span>
            <span>Cầu Bến: <strong className="text-amber-900 font-black">B-01</strong></span>
            <span className="text-slate-300">|</span>
            <span>Tác Nghiệp Hiện Tại: <strong className="text-purple-900 font-black">ĐANG DỠ CONTAINER (DISCHARGING)</strong></span>
          </div>
        </div>

        {/* Right Corner Widgets */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-700 uppercase font-sans font-black">TRỰC TUYẾN (LIVE)</span>
            <span className="text-slate-300">|</span>
            <span>{timeString}</span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => showToast('🔔 Thông báo: Operator đã tiếp nhận báo cáo sự cố và đang điều phối bảo trì.')}
              className="w-10 h-10 bg-white border border-slate-300 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 shadow-xs relative cursor-pointer">
              <span className="material-symbols-outlined text-lg">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500"></span>
            </button>
            
            <div className="flex items-center gap-2 bg-slate-100 text-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-300 shadow-xs text-xs font-extrabold">
              <span className="material-symbols-outlined text-base text-amber-600">anchor</span>
              <div>
                <div className="text-[11px] font-black leading-tight text-slate-900">Trần Văn Hải</div>
                <div className="text-[9px] text-slate-600 font-mono font-bold">Nhân Viên Cầu B-01</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PERMISSION NOTICE BANNER ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
        <span className="material-symbols-outlined text-blue-600 text-2xl">info</span>
        <div className="text-xs text-blue-900 font-medium">
          <strong className="font-extrabold">PHÂN QUYỀN SỰ CỐ:</strong> Nhân viên Cầu bến có quyền lập báo cáo sự cố thực địa, tải ảnh/video bằng chứng và ghi nhận xử lý ban đầu. Nhân viên Cầu bến <strong className="underline">không có quyền</strong> đóng/xóa sự cố hoặc thay đổi kế hoạch xếp dỡ của Operator.
        </div>
      </div>

      {/* ── 9. AFTER SUBMIT SUCCESS STATE (NẾU ĐÃ SUBMIT SỰ CỐ MỚI) ── */}
      {submittedIncident && (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-6 shadow-md space-y-3 font-mono">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-600 text-4xl">check_circle</span>
            <div>
              <div className="font-black text-emerald-950 text-base">🟢 INCIDENT REPORTED — ĐÃ GỬI BÁO CÁO SỰ CỐ THÀNH CÔNG</div>
              <div className="text-xs text-emerald-900 font-bold mt-0.5">
                "Báo cáo sự cố đã được gửi thành công. Trung tâm Operator đã nhận thông báo cảnh báo realtime."
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
            <div className="bg-white p-3 rounded-xl border border-emerald-300">
              <span className="text-[10px] text-slate-500 font-sans font-bold block">Mã Sự Cố (Incident ID)</span>
              <strong className="text-emerald-950 font-black text-sm">{submittedIncident.id}</strong>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-300">
              <span className="text-[10px] text-slate-500 font-sans font-bold block">Trạng Thái</span>
              <span className="px-2 py-0.5 bg-red-100 text-red-950 border border-red-300 rounded font-black text-[10px]">
                {submittedIncident.status}
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-300">
              <span className="text-[10px] text-slate-500 font-sans font-bold block">Người Báo Cáo</span>
              <strong className="text-slate-900 font-bold">{submittedIncident.reportedBy}</strong>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-300">
              <span className="text-[10px] text-slate-500 font-sans font-bold block">Thời Gian Ghi Nhận</span>
              <strong className="text-purple-900 font-bold">{submittedIncident.time}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ── INCIDENT FORM SECTIONS (1 TO 8) ── */}
      <form onSubmit={handleSubmitIncident} className="space-y-6">

        {/* 1 & 2. INCIDENT TYPE & INCIDENT SEVERITY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* 1. INCIDENT TYPE */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-600">category</span>
                1. INCIDENT INFORMATION (THÔNG TIN LOẠI SỰ CỐ) *
              </h3>
            </div>

            <div>
              <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Loại Sự Cố (Incident Type) *</label>
              <select value={incidentForm.type} onChange={e => setIncidentForm(p => ({ ...p, type: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-extrabold text-sm focus:outline-none focus:border-slate-900" required>
                {[
                  'Cẩu Bờ (QC/STS) Hỏng Hóc',
                  'Thời Tiết Xấu / Sóng Lớn',
                  'Container Kẹt Trong Hầm Tàu',
                  'Container Hư Hỏng / Móp Méo',
                  'Hư Hỏng Thiết Bị Bãi (RTG/ITV)',
                  'Sự Cố An Toàn Lao Động',
                  'Khác',
                ].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* 2. INCIDENT SEVERITY (SELECTABLE CARDS) */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600">warning</span>
                2. INCIDENT SEVERITY (MỨC ĐỘ NGHIÊM TRỌNG) *
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              {[
                { level: 'LOW', label: '🟢 LOW (NHẸ)', sub: 'Ảnh hưởng nhỏ, tác nghiệp vẫn tiếp tục bình thường', color: 'bg-emerald-100 text-emerald-950 border-emerald-400' },
                { level: 'MEDIUM', label: '🟡 MEDIUM (TRUNG BÌNH)', sub: 'Ảnh hưởng một phần tiến độ tác nghiệp hầm tàu', color: 'bg-amber-100 text-amber-950 border-amber-400' },
                { level: 'HIGH', label: '🟠 HIGH (NGHIÊM TRỌNG)', sub: 'Tạm dừng khai thác cẩu bờ liên quan', color: 'bg-orange-100 text-orange-950 border-orange-400' },
                { level: 'CRITICAL', label: '🔴 CRITICAL (RẤT NGH. TRỌNG)', sub: 'Yêu cầu dừng khẩn cấp toàn bộ cầu bến B-01', color: 'bg-red-200 text-red-950 border-red-500' },
              ].map(sev => (
                <div key={sev.level} onClick={() => setIncidentForm(p => ({ ...p, severity: sev.level }))}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    incidentForm.severity === sev.level ? `${sev.color} ring-2 ring-slate-900 shadow-md font-black` : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  }`}>
                  <div className="font-heading font-black text-sm">{sev.label}</div>
                  <div className="text-[10px] font-sans font-medium mt-1 leading-tight">{sev.sub}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* 3 & 4. INCIDENT DETAILS & INCIDENT DESCRIPTION */}
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">article</span>
              3 & 4. INCIDENT DETAILS & DESCRIPTION (CHI TIẾT & MÔ TẢ SỰ CỐ)
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Thời Gian Phát Hiện</span>
              <strong className="text-slate-900 font-extrabold">{timeString}</strong>
            </div>

            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Tàu Liên Quan</span>
              <strong className="text-blue-900 font-black">EVER GIVEN</strong>
            </div>

            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Cầu Bến</span>
              <strong className="text-amber-900 font-black">B-01</strong>
            </div>

            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Cẩu Bờ Liên Quan</span>
              <select value={incidentForm.relatedCrane} onChange={e => setIncidentForm(p => ({ ...p, relatedCrane: e.target.value }))}
                className="w-full mt-0.5 bg-white border border-slate-300 rounded font-bold text-xs p-1">
                {['STS-01', 'STS-02', 'STS-03', 'None'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Related Container Input */}
          <div className="text-xs">
            <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Mã Container Liên Quan (Related Container)</label>
            <input type="text" value={incidentForm.relatedContainer} onChange={e => setIncidentForm(p => ({ ...p, relatedContainer: e.target.value.toUpperCase() }))}
              placeholder="Nhập mã Container ID (VD: MSCU1234567)"
              className="w-full max-w-md px-3.5 py-2 bg-slate-100 border border-slate-300 rounded-xl font-mono font-bold uppercase text-xs" />
          </div>

          {/* Description Textarea */}
          <div className="text-xs">
            <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Mô Tả Diễn Biến Sự Cố (Incident Description) *</label>
            <textarea rows="4" value={incidentForm.desc} onChange={e => setIncidentForm(p => ({ ...p, desc: e.target.value }))}
              placeholder="Describe the incident, current condition and any immediate action taken..."
              className="w-full p-3.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-normal text-slate-900 focus:outline-none focus:border-slate-900 resize-none" required />
          </div>
        </div>

        {/* 5. EVIDENCE / ATTACHMENTS */}
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
            <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-600">attach_file</span>
              5. EVIDENCE / ATTACHMENTS (BẰNG CHỨNG ĐÍNH KÈM)
            </h3>
            
            <div className="flex gap-2">
              <button type="button" onClick={() => handleUploadFile('image')}
                className="px-3.5 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-950 border border-purple-400 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer">
                <span className="material-symbols-outlined text-sm">add_a_photo</span>
                [ + Upload Photo ]
              </button>
              <button type="button" onClick={() => handleUploadFile('video')}
                className="px-3.5 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-950 border border-blue-400 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer">
                <span className="material-symbols-outlined text-sm">videocam</span>
                [ + Upload Video ]
              </button>
            </div>
          </div>

          {/* Files Preview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            {incidentForm.evidenceFiles.map((file, idx) => (
              <div key={idx} className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-600">
                    {file.type === 'image' ? 'image' : 'movie'}
                  </span>
                  <div>
                    <div className="font-bold text-slate-900 font-sans">{file.name}</div>
                    <div className="text-[10px] text-slate-500">{file.size} · Đã đính kèm</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-300 rounded font-black text-[10px]">PREVIEW OK</span>
              </div>
            ))}
          </div>
        </div>

        {/* 6 & 7. OPERATION STATUS IMPACT & IMMEDIATE ACTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* 6. OPERATION STATUS IMPACT */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">running_with_errors</span>
                6. OPERATION STATUS (MỨC ĐỘ ẢNH HƯỞNG TÁC NGHIỆP) *
              </h3>
              <p className="text-xs text-slate-600">Mức độ ảnh hưởng hiện tại tới hoạt động bốc dỡ của tàu?</p>
            </div>

            <div className="space-y-2.5 text-xs font-extrabold">
              {[
                { val: 'Operation continues normally', label: '○ Operation continues normally (Khai thác tiếp tục bình thường)' },
                { val: 'Operation partially affected', label: '○ Operation partially affected (Khai thác bị ảnh hưởng một phần)' },
                { val: 'Operation temporarily stopped', label: '○ Operation temporarily stopped (Tạm dừng khai thác tạm thời)' },
                { val: 'Immediate operation shutdown required', label: '○ Immediate operation shutdown required (Dừng khẩn cấp toàn bộ tác nghiệp)' },
              ].map(opt => (
                <label key={opt.val} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  incidentForm.operationImpact === opt.val ? 'bg-orange-50 border-orange-400 text-orange-950 font-black' : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}>
                  <input type="radio" name="impact" value={opt.val} checked={incidentForm.operationImpact === opt.val}
                    onChange={e => setIncidentForm(p => ({ ...p, operationImpact: e.target.value }))} className="w-4 h-4 accent-orange-600" />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 7. IMMEDIATE ACTION */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="border-b border-slate-200 pb-3">
                <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600">handyman</span>
                  7. IMMEDIATE ACTION TAKEN (XỬ LÝ BAN ĐẦU TẠI THỰC ĐỊA)
                </h3>
              </div>

              <div className="mt-3 text-xs">
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Mô Tả Hành Động Xử Lý Ban Đầu</label>
                <textarea rows="4" value={incidentForm.immediateAction} onChange={e => setIncidentForm(p => ({ ...p, immediateAction: e.target.value }))}
                  placeholder="Mô tả các biện pháp phản ứng nhanh đã thực hiện tại bến..."
                  className="w-full p-3.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-normal text-slate-900 focus:outline-none focus:border-slate-900 resize-none" />
              </div>
            </div>

            <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-[11px] text-slate-600">
              💡 Ghi nhận chi tiết phản ứng nhanh tại thực địa để đội bảo trì Operator nắm rõ bối cảnh.
            </div>
          </div>

        </div>

        {/* 8. SUBMIT INCIDENT REPORT SUMMARY & BUTTONS */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-3">
            <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600">summarize</span>
              8. SUBMIT INCIDENT REPORT SUMMARY (TỔNG KẾT BÁO CÁO)
            </h3>
            <span className="text-xs font-mono font-bold text-slate-500">Trạng thái báo cáo: OPEN 🔴</span>
          </div>

          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs font-mono">
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Incident Type</span>
              <strong className="text-slate-900 font-black">{incidentForm.type}</strong>
            </div>
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Severity</span>
              {renderSeverityBadge(incidentForm.severity)}
            </div>
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Vessel</span>
              <strong className="text-blue-900 font-bold">EVER GIVEN</strong>
            </div>
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Berth</span>
              <strong className="text-amber-900 font-bold">B-01</strong>
            </div>
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Detected Time</span>
              <strong className="text-purple-900 font-bold">16:42</strong>
            </div>
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-600 uppercase font-sans font-bold block">Status</span>
              <span className="px-2 py-0.5 bg-red-100 text-red-950 border border-red-300 rounded font-black text-[10px]">OPEN</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-2">
            <button type="button" onClick={() => showToast('Hủy bỏ biểu mẫu sự cố')}
              className="flex-1 h-13 border-2 border-slate-300 text-slate-800 rounded-xl font-extrabold text-xs hover:bg-slate-100 cursor-pointer">
              [ HỦY BỎ ]
            </button>
            <button type="submit"
              className="flex-2 h-13 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-400 font-black text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all">
              <span className="material-symbols-outlined text-xl">send</span>
              [ 🚨 SUBMIT INCIDENT REPORT ]
            </button>
          </div>
        </div>

      </form>

      {/* ── 10. RECENT BERTH INCIDENTS TABLE ── */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">history</span>
            10. RECENT BERTH INCIDENTS (DANH SÁCH SỰ CỐ BÁO CÁO GẦN ĐÂY)
          </h3>
          <span className="text-xs font-mono font-bold text-slate-500">{recentIncidents.length} Bản ghi</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                {['Mã Sự Cố', 'Thời Gian', 'Loại Sự Cố', 'Mức Độ', 'Tàu', 'Cầu Bến', 'Người Báo Cáo', 'Trạng Thái'].map(h => (
                  <th key={h} className="py-3.5 px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {recentIncidents.map(inc => (
                <tr key={inc.id} className="hover:bg-slate-100/60">
                  <td className="py-3.5 px-4 font-black text-slate-900 text-sm">{inc.id}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-600">{inc.time}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 font-sans">{inc.type}</td>
                  <td className="py-3.5 px-4 font-sans">{renderSeverityBadge(inc.severity)}</td>
                  <td className="py-3.5 px-4 font-bold text-blue-900">{inc.vessel}</td>
                  <td className="py-3.5 px-4 font-bold text-amber-900">{inc.berth}</td>
                  <td className="py-3.5 px-4 font-sans text-slate-700 font-bold">{inc.reportedBy}</td>
                  <td className="py-3.5 px-4 font-sans">{renderStatusBadge(inc.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
