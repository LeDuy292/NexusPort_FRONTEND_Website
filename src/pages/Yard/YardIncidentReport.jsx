import React, { useState, useEffect } from 'react'

// Loại sự cố Yard
const INCIDENT_TYPES = [
  'Container không tìm thấy tại vị trí gốc',
  'RTG / Cẩu bị hỏng, không hoạt động được',
  'Vị trí đích đã bị container khác chiếm',
  'Không thể tiếp cận container (vật cản đường đi)',
  'Container bị hư hỏng nặng không thể di chuyển',
  'Mất điện / Sự cố nguồn điện thiết bị',
  'Xung đột lệnh (lệnh trùng lặp / sai thông tin)',
  'Nhân sự không đủ / Bất khả kháng hiện trường',
  'Lý do khác',
]

const SEVERITY_OPTIONS = [
  { value: 'LOW',      label: '🟢 Thấp — Không ảnh hưởng vận hành',      cls: 'bg-emerald-100 text-emerald-950 border-emerald-400' },
  { value: 'MEDIUM',   label: '🟡 Trung Bình — Gây chậm trễ nhỏ',          cls: 'bg-amber-100 text-amber-950 border-amber-400' },
  { value: 'HIGH',     label: '🟠 Cao — Tạm dừng tác nghiệp khu vực',      cls: 'bg-orange-100 text-orange-950 border-orange-400' },
  { value: 'CRITICAL', label: '🔴 Nghiêm Trọng — Dừng toàn bộ hoạt động', cls: 'bg-red-200 text-red-950 border-red-500' },
]

const LOCATION_OPTIONS = [
  'Khu A - Bãi Container Nhập', 'Khu B - Bãi Container Xuất',
  'Khu C - Bãi Container Lạnh', 'Khu D - Bãi Container Rỗng',
  'Trục RTG 01', 'Trục RTG 02', 'Trục RTG 03',
  'Cổng Bãi A', 'Cổng Bãi B',
]

export default function YardIncidentReport() {
  const [timeString, setTimeString] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [submittedIncident, setSubmittedIncident] = useState(null)

  const [form, setForm] = useState({
    type: INCIDENT_TYPES[0],
    severity: 'MEDIUM',
    location: LOCATION_OPTIONS[0],
    relatedContainer: '',
    relatedEquipment: '',
    description: '',
    immediateAction: '',
    evidenceFiles: [],
  })

  useEffect(() => {
    const update = () => setTimeString(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' — ' + new Date().toLocaleDateString('vi-VN'))
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [])

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 3500) }

  const handleAddPhoto = () => {
    const name = `Anh_Hien_Truong_${Date.now().toString().slice(-4)}.jpg`
    setForm(prev => ({ ...prev, evidenceFiles: [...prev.evidenceFiles, { name, size: '2.4 MB', type: 'image' }] }))
    showToast(`📷 Đã đính kèm ảnh bằng chứng: ${name}`)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.description.trim()) { showToast('⚠️ Vui lòng nhập mô tả chi tiết sự cố!'); return }
    const incident = {
      id: `INC-YARD-${Date.now().toString().slice(-6)}`,
      reportedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      reportedBy: 'Nguyễn Văn Nam (Nhân Viên Bãi)',
      ...form,
    }
    setSubmittedIncident(incident)
    showToast(`🚨 ĐÃ GỬI BÁO CÁO SỰ CỐ ${incident.id} — Dispatcher đã nhận thông báo tức thì!`)
  }

  const handleReset = () => {
    setSubmittedIncident(null)
    setForm({ type: INCIDENT_TYPES[0], severity: 'MEDIUM', location: LOCATION_OPTIONS[0], relatedContainer: '', relatedEquipment: '', description: '', immediateAction: '', evidenceFiles: [] })
  }

  const selectedSev = SEVERITY_OPTIONS.find(s => s.value === form.severity)

  return (
    <div className="p-6 md:p-8 w-full font-sans bg-slate-50 min-h-screen text-slate-900 relative">

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-red-100 text-red-950 border-2 border-red-400 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-3 z-[100] animate-bounce">
          <span className="text-red-600 text-lg">⚠</span>{toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-1 text-xs font-mono">
          <span className="font-heading font-black text-orange-600 tracking-wider">NEXUSPORT</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-extrabold">Báo Cáo Sự Cố Bãi</span>
        </div>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div>
            <h2 className="font-heading text-3xl font-black text-slate-900 flex items-center gap-3">
              🚨 Báo Cáo Sự Cố Khai Thác Bãi
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">Ghi nhận và gửi sự cố trực tiếp tới Dispatcher để xử lý ngay. <strong>Chỉ để báo cáo</strong> — không xem danh sách.</p>
          </div>
          <div className="flex items-center gap-2 bg-red-50 border border-red-300 px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-red-700">
            🕐 {timeString}
          </div>
        </div>
      </div>

      {/* SUCCESS STATE */}
      {submittedIncident ? (
        <div className="space-y-5">
          <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-8 text-center space-y-4">
            <div className="text-6xl">✅</div>
            <h3 className="font-heading text-2xl font-black text-emerald-950">BÁO CÁO ĐÃ ĐƯỢC GỬI THÀNH CÔNG</h3>
            <p className="text-sm text-emerald-900 font-sans font-bold">Dispatcher đã nhận thông báo sự cố theo thời gian thực. Vui lòng tiếp tục theo dõi hiện trường.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs font-mono font-bold">
              {[
                ['Mã Sự Cố', submittedIncident.id],
                ['Giờ Báo Cáo', submittedIncident.reportedAt],
                ['Người Báo', submittedIncident.reportedBy],
                ['Mức Độ', submittedIncident.severity],
              ].map(([k, v]) => (
                <div key={k} className="bg-white p-3 rounded-xl border border-emerald-300 text-center">
                  <span className="text-[10px] text-slate-500 font-sans block">{k}</span>
                  <strong className="text-emerald-950">{v}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-2 text-xs font-mono">
            <div className="font-black text-slate-900 text-sm font-heading border-b border-slate-200 pb-2">Chi Tiết Sự Cố Đã Gửi:</div>
            <div><span className="text-slate-500">Loại sự cố:</span> <strong>{submittedIncident.type}</strong></div>
            <div><span className="text-slate-500">Vị trí:</span> <strong>{submittedIncident.location}</strong></div>
            <div><span className="text-slate-500">Container liên quan:</span> <strong>{submittedIncident.relatedContainer || '—'}</strong></div>
            <div><span className="text-slate-500">Thiết bị:</span> <strong>{submittedIncident.relatedEquipment || '—'}</strong></div>
            <div><span className="text-slate-500">Mô tả:</span> <strong className="font-sans">{submittedIncident.description}</strong></div>
          </div>

          <button onClick={handleReset}
            className="w-full h-14 bg-orange-100 hover:bg-orange-200 text-orange-950 border-2 border-orange-400 rounded-2xl font-black text-sm cursor-pointer transition-all">
            [ 📝 BÁO CÁO SỰ CỐ MỚI ]
          </button>
        </div>
      ) : (

        /* FORM */
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Warning banner */}
          <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-4 flex items-start gap-3 font-sans">
            <span className="material-symbols-outlined text-red-600 text-2xl flex-shrink-0">report_problem</span>
            <div>
              <div className="font-black text-red-950 text-sm">CHỈ BÁO CÁO — Không thể xem danh sách sự cố</div>
              <div className="text-xs text-red-900 font-bold mt-0.5">Sự cố sau khi gửi sẽ được Dispatcher tiếp nhận và xử lý. Vui lòng điền đầy đủ thông tin để hỗ trợ xử lý nhanh nhất.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Col 1: Thông tin cơ bản */}
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 space-y-4">
              <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
                <span className="material-symbols-outlined text-red-600">report_problem</span>
                THÔNG TIN SỰ CỐ
              </h3>

              {/* Type */}
              <div>
                <label className="block text-[10px] uppercase text-slate-600 font-extrabold mb-1.5">Loại Sự Cố *</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-bold text-sm text-slate-900 focus:outline-none focus:border-slate-900">
                  {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-[10px] uppercase text-slate-600 font-extrabold mb-1.5">Vị Trí Xảy Ra Sự Cố *</label>
                <select value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-bold text-sm text-slate-900 focus:outline-none focus:border-slate-900">
                  {LOCATION_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              {/* Related Container */}
              <div>
                <label className="block text-[10px] uppercase text-slate-600 font-extrabold mb-1.5">Mã Container Liên Quan</label>
                <input type="text" value={form.relatedContainer} onChange={e => setForm(p => ({ ...p, relatedContainer: e.target.value.toUpperCase() }))}
                  placeholder="VD: MSCU1234567 (nếu có)"
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-mono font-bold text-sm text-slate-900 focus:outline-none uppercase placeholder:normal-case placeholder:font-sans" />
              </div>

              {/* Related Equipment */}
              <div>
                <label className="block text-[10px] uppercase text-slate-600 font-extrabold mb-1.5">Thiết Bị Liên Quan</label>
                <input type="text" value={form.relatedEquipment} onChange={e => setForm(p => ({ ...p, relatedEquipment: e.target.value }))}
                  placeholder="VD: RTG-005, Reach Stacker RS-01..."
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-bold text-sm text-slate-900 focus:outline-none" />
              </div>
            </div>

            {/* Col 2: Mức độ + Mô tả */}
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 space-y-4">
              <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
                <span className="material-symbols-outlined text-orange-600">priority_high</span>
                MỨC ĐỘ & MÔ TẢ CHI TIẾT
              </h3>

              {/* Severity */}
              <div>
                <label className="block text-[10px] uppercase text-slate-600 font-extrabold mb-2">Mức Độ Nghiêm Trọng *</label>
                <div className="space-y-2">
                  {SEVERITY_OPTIONS.map(s => (
                    <label key={s.value} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer font-bold text-xs transition-all ${form.severity === s.value ? s.cls : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                      <input type="radio" name="severity" value={s.value} checked={form.severity === s.value} onChange={() => setForm(p => ({ ...p, severity: s.value }))} className="accent-slate-900" />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] uppercase text-slate-600 font-extrabold mb-1.5">Mô Tả Chi Tiết Sự Cố *</label>
                <textarea rows="4" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Mô tả rõ ràng tình huống xảy ra tại hiện trường: container ở đâu, thiết bị nào, thời điểm nào, đã có hậu quả gì..."
                  className="w-full p-3.5 bg-slate-100 border border-slate-300 rounded-xl text-sm font-normal text-slate-900 focus:outline-none resize-none font-sans" required />
              </div>

              {/* Immediate Action */}
              <div>
                <label className="block text-[10px] uppercase text-slate-600 font-extrabold mb-1.5">Hành Động Đã Thực Hiện Ngay</label>
                <textarea rows="2" value={form.immediateAction} onChange={e => setForm(p => ({ ...p, immediateAction: e.target.value }))}
                  placeholder="VD: Đã dừng cẩu RTG, đã thông báo tổ trưởng ca..."
                  className="w-full p-3.5 bg-slate-100 border border-slate-300 rounded-xl text-sm font-normal text-slate-900 focus:outline-none resize-none font-sans" />
              </div>
            </div>
          </div>

          {/* Evidence */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 space-y-3">
            <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
              <span className="material-symbols-outlined text-purple-600">photo_camera</span>
              BẰNG CHỨNG THỰC ĐỊA (ẢNH / VIDEO)
            </h3>
            <div className="flex gap-3 flex-wrap">
              <button type="button" onClick={handleAddPhoto}
                className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-950 border-2 border-purple-400 rounded-xl font-black text-xs flex items-center gap-2 cursor-pointer transition-all">
                <span className="material-symbols-outlined text-sm">photo_camera</span>
                Chụp Ảnh Hiện Trường
              </button>
              <button type="button" onClick={() => showToast('📹 Đang mở camera quay video...')}
                className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-950 border-2 border-blue-400 rounded-xl font-black text-xs flex items-center gap-2 cursor-pointer transition-all">
                <span className="material-symbols-outlined text-sm">videocam</span>
                Quay Video Bằng Chứng
              </button>
            </div>
            {form.evidenceFiles.length > 0 && (
              <div className="space-y-1.5">
                {form.evidenceFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-mono font-bold">
                    <span className="material-symbols-outlined text-base text-purple-600">{f.type === 'image' ? 'image' : 'videocam'}</span>
                    <span className="flex-1 text-slate-900">{f.name}</span>
                    <span className="text-slate-500">{f.size}</span>
                  </div>
                ))}
              </div>
            )}
            {form.evidenceFiles.length === 0 && (
              <div className="p-4 bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400 font-sans font-medium">
                Chưa có bằng chứng. Nhấn nút trên để đính kèm ảnh / video hiện trường.
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button type="submit"
            className="w-full h-16 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-500 rounded-2xl font-black text-base flex items-center justify-center gap-3 cursor-pointer transition-all shadow-md">
            <span className="material-symbols-outlined text-xl">send</span>
            [ 🚨 GỬI BÁO CÁO SỰ CỐ TỚI DISPATCHER ]
          </button>
        </form>
      )}
    </div>
  )
}
