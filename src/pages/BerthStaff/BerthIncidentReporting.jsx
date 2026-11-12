import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

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

  // Recent Berth Incidents Dataset
  const [recentIncidents, setRecentIncidents] = useState([
    { id: 'INC-20260812-003', time: '14:20', type: 'Container Hư Hỏng / Móp Méo', severity: 'MEDIUM', vessel: 'MSC GULSUN', berth: 'B-02', status: 'RESOLVED', reportedBy: 'Đại diện Hãng tàu' },
    { id: 'INC-20260812-002', time: '11:05', type: 'Thời Tiết Xấu / Sóng Lớn', severity: 'LOW', vessel: 'CMA CGM', berth: 'B-03', status: 'RESOLVED', reportedBy: 'Cảng vụ Hàng hải' },
    { id: 'INC-20260812-001', time: '09:15', type: 'Hư Hỏng Thiết Bị Bãi (RTG/ITV)', severity: 'HIGH', vessel: 'EVER GIVEN', berth: 'B-01', status: 'IN PROGRESS', reportedBy: 'Đại diện Hãng tàu' },
  ])

  // Submitted Incident State
  const [submittedIncident, setSubmittedIncident] = useState(null)

  // Real-time clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeString(
        now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        ' • ' +
        now.toLocaleDateString('vi-VN')
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  const handleUploadFile = (fileType) => {
    const newFileName = fileType === 'image'
      ? `Bang_Chung_Anh_${Date.now().toString().slice(-4)}.jpg`
      : `Bang_Chung_Video_${Date.now().toString().slice(-4)}.mp4`
    setIncidentForm(prev => ({
      ...prev,
      evidenceFiles: [...prev.evidenceFiles, { name: newFileName, size: '4.2 MB', type: fileType }],
    }))
    showToast(`Đã đính kèm tệp: ${newFileName}`)
  }

  const handleSubmitIncident = (e) => {
    e.preventDefault()
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    const newIncId = `INC-20261102-00${recentIncidents.length + 1}`

    const newRecord = {
      id: newIncId,
      time: nowTime,
      type: incidentForm.type,
      severity: incidentForm.severity,
      vessel: 'EVER GIVEN',
      berth: 'B-01',
      status: 'OPEN',
      reportedBy: 'Đại diện Hãng tàu',
      desc: incidentForm.desc,
    }

    setSubmittedIncident(newRecord)
    setRecentIncidents(prev => [newRecord, ...prev])
    showToast(`Đã gửi báo cáo sự cố ${newIncId}. Điều hành cảng đã nhận thông báo.`)
  }

  const renderSeverityBadge = (sev) => {
    const map = {
      'LOW': 'bg-slate-100 text-slate-700 border-slate-200',
      'MEDIUM': 'bg-orange-50 text-orange-700 border-orange-200',
      'HIGH': 'bg-rose-50 text-rose-700 border-rose-200',
      'CRITICAL': 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
    }
    const label = {
      'LOW': 'Thấp',
      'MEDIUM': 'Trung bình',
      'HIGH': 'Nghiêm trọng',
      'CRITICAL': 'Khẩn cấp',
    }
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${map[sev] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
        {label[sev] || sev}
      </span>
    )
  }

  const renderStatusBadge = (status) => {
    const map = {
      'OPEN': 'bg-rose-50 text-rose-700 border-rose-200',
      'IN PROGRESS': 'bg-orange-50 text-orange-700 border-orange-200',
      'RESOLVED': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }
    const labelMap = {
      'OPEN': 'Mới tiếp nhận',
      'IN PROGRESS': 'Đang xử lý',
      'RESOLVED': 'Đã khắc phục',
    }
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${map[status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
        {labelMap[status] || status}
      </span>
    )
  }

  return (
    <div className="p-6 w-full font-sans flex flex-col gap-5 bg-slate-50 min-h-screen text-[#1F2937]">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-8 bg-white text-slate-800 border border-slate-200 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2.5 z-50 animate-in fade-in slide-in-from-top-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 text-xs text-slate-500 font-medium">
            <span>Hãng tàu</span>
            <span>/</span>
            <span>Quản lý sự cố</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Báo cáo sự cố cầu bến</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Báo Cáo Sự Cố Cầu Bến
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded border bg-slate-100 text-slate-700 border-slate-200 font-medium">
              Cầu B-01 • EVER GIVEN
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gửi cảnh báo và ghi nhận các sự cố kỹ thuật, thiết bị, an toàn trong quá trình tàu neo đậu và bốc dỡ hàng.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-800 font-semibold">Trực tuyến</span>
            <span className="text-slate-300">|</span>
            <span className="font-mono">{timeString}</span>
          </div>

          <Link
            to="/berth-staff/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg border border-slate-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Trở lại tác nghiệp tàu
          </Link>
        </div>
      </div>

      {/* ── MAIN CONTENT (2 COLUMNS: FORM + RECENT INCIDENTS) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Form Column (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#F97316]">report</span>
              Khai báo thông tin sự cố mới
            </h2>
            <span className="text-[11px] text-slate-500">* Bắt buộc điền</span>
          </div>

          {submittedIncident && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 mt-0.5">check_circle</span>
              <div>
                <strong className="font-semibold block">Đã ghi nhận sự cố {submittedIncident.id}</strong>
                <span>Thông tin đã được chuyển tới Điều độ cảng và Đội kỹ thuật cầu bến để xử lý khẩn cấp.</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitIncident} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Loại sự cố *</label>
                <select
                  value={incidentForm.type}
                  onChange={e => setIncidentForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-[#F97316]"
                >
                  <option value="Cẩu Bờ (QC/STS) Hỏng Hóc">Cẩu Bờ (QC/STS) hỏng hóc</option>
                  <option value="Container Hư Hỏng / Móp Méo">Container hư hỏng / móp méo</option>
                  <option value="Thời Tiết Xấu / Sóng Lớn">Thời tiết xấu / sóng lớn</option>
                  <option value="Hư Hỏng Thiết Bị Bãi (RTG/ITV)">Thiết bị bãi (RTG/ITV) sự cố</option>
                  <option value="Sự Cố Dây Cáp / Buộc Neo">Sự cố dây cáp / buộc neo</option>
                  <option value="Khác">Sự cố khác</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Mức độ nghiêm trọng *</label>
                <select
                  value={incidentForm.severity}
                  onChange={e => setIncidentForm(p => ({ ...p, severity: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-[#F97316]"
                >
                  <option value="LOW">Thấp (Không ảnh hưởng bốc dỡ)</option>
                  <option value="MEDIUM">Trung bình (Chậm tiến độ &lt; 30 phút)</option>
                  <option value="HIGH">Nghiêm trọng (Tạm dừng dỡ hầm hàng)</option>
                  <option value="CRITICAL">Khẩn cấp (Dừng toàn bộ cầu bến)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Thiết bị cẩu liên quan</label>
                <input
                  type="text"
                  value={incidentForm.relatedCrane}
                  onChange={e => setIncidentForm(p => ({ ...p, relatedCrane: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-[#F97316]"
                  placeholder="Ví dụ: STS-02"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Số container liên quan (nếu có)</label>
                <input
                  type="text"
                  value={incidentForm.relatedContainer}
                  onChange={e => setIncidentForm(p => ({ ...p, relatedContainer: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-mono focus:outline-none focus:border-[#F97316]"
                  placeholder="Ví dụ: MSCU1234567"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Mô tả chi tiết sự cố *</label>
              <textarea
                rows="3"
                value={incidentForm.desc}
                onChange={e => setIncidentForm(p => ({ ...p, desc: e.target.value }))}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#F97316] resize-none"
                placeholder="Mô tả nguyên nhân, tình trạng thực tế..."
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Hành động khắc phục tạm thời</label>
              <input
                type="text"
                value={incidentForm.immediateAction}
                onChange={e => setIncidentForm(p => ({ ...p, immediateAction: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-[#F97316]"
                placeholder="Ví dụ: Đã ngắt điện và cho thợ kỹ thuật kiểm tra..."
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Tệp bằng chứng đính kèm</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {incidentForm.evidenceFiles.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700">
                    <span className="material-symbols-outlined text-[14px] text-slate-500">
                      {f.type === 'image' ? 'image' : 'videocam'}
                    </span>
                    <span>{f.name}</span>
                    <span className="text-slate-400">({f.size})</span>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleUploadFile('image')}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">add_photo_alternate</span>
                  Thêm ảnh
                </button>
                <button
                  type="button"
                  onClick={() => handleUploadFile('video')}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">video_call</span>
                  Thêm video
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                Gửi báo cáo sự cố
              </button>
            </div>
          </form>
        </div>

        {/* Recent Incidents Table Column (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#F97316]">history</span>
              Sự cố phát sinh gần đây
            </h2>
            <span className="text-xs text-slate-500 font-mono">{recentIncidents.length} sự cố</span>
          </div>

          <div className="space-y-3">
            {recentIncidents.map(inc => (
              <div key={inc.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-800">{inc.id}</span>
                  <div className="flex items-center gap-1.5">
                    {renderSeverityBadge(inc.severity)}
                    {renderStatusBadge(inc.status)}
                  </div>
                </div>

                <div className="font-semibold text-slate-800">{inc.type}</div>
                <div className="text-[11px] text-slate-500">
                  Tàu: <strong>{inc.vessel}</strong> ({inc.berth}) • {inc.time}
                </div>
                {inc.desc && (
                  <p className="text-[11px] text-slate-600 line-clamp-2 bg-white p-2 rounded border border-slate-200/60 mt-1">
                    {inc.desc}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  )
}
