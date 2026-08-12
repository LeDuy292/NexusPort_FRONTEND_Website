import React, { useState, useEffect } from 'react'

const INCIDENT_TYPES = [
  'Xe tải giả mạo giấy tờ / booking không hợp lệ',
  'Container không khớp với thông tin booking',
  'Số chì niêm phong bị phá / không khớp',
  'Tài xế không có giấy phép hoặc từ chối kiểm tra',
  'Camera nhận diện biển số thất bại',
  'Xe tải hỏng hóc tại cổng gây ùn tắc',
  'Hệ thống kiểm tra RFID / OCR lỗi',
  'Tranh chấp / mâu thuẫn tại cổng kiểm soát',
  'Phát hiện hàng hóa nguy hiểm không khai báo',
  'Lý do khác',
]

const SEVERITY_OPTIONS = [
  { value: 'LOW',      label: '🟢 Thấp — Không ảnh hưởng lưu thông',         cls: 'bg-emerald-100 text-emerald-950 border-emerald-400' },
  { value: 'MEDIUM',   label: '🟡 Trung Bình — Gây trễ một số xe',            cls: 'bg-amber-100 text-amber-950 border-amber-400' },
  { value: 'HIGH',     label: '🟠 Cao — Ùn tắc nghiêm trọng tại cổng',       cls: 'bg-orange-100 text-orange-950 border-orange-400' },
  { value: 'CRITICAL', label: '🔴 Nghiêm Trọng — Phải đóng cổng / gọi an ninh', cls: 'bg-red-200 text-red-950 border-red-500' },
]

const GATE_OPTIONS = ['Cổng A', 'Cổng B', 'Cổng C', 'Cổng D']

export default function GateIncidentReport() {
  const [timeString, setTimeString] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [submittedIncident, setSubmittedIncident] = useState(null)

  const [form, setForm] = useState({
    type: INCIDENT_TYPES[0],
    severity: 'MEDIUM',
    gate: GATE_OPTIONS[0],
    bookingId: '',
    vehicleId: '',
    driverName: '',
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
    const name = `Anh_Cong_${form.gate.replace(' ', '_')}_${Date.now().toString().slice(-4)}.jpg`
    setForm(prev => ({ ...prev, evidenceFiles: [...prev.evidenceFiles, { name, size: '1.9 MB', type: 'image' }] }))
    showToast(`📷 Đã đính kèm ảnh: ${name}`)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.description.trim()) { showToast('⚠️ Vui lòng nhập mô tả chi tiết sự cố!'); return }
    const incident = {
      id: `INC-GATE-${Date.now().toString().slice(-6)}`,
      reportedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      reportedBy: 'Nguyễn Văn Hùng (Nhân Viên Cổng)',
      ...form,
    }
    setSubmittedIncident(incident)
    showToast(`🚨 ĐÃ GỬI SỰ CỐ ${incident.id} — Dispatcher tiếp nhận xử lý ngay!`)
  }

  const handleReset = () => {
    setSubmittedIncident(null)
    setForm({ type: INCIDENT_TYPES[0], severity: 'MEDIUM', gate: GATE_OPTIONS[0], bookingId: '', vehicleId: '', driverName: '', description: '', immediateAction: '', evidenceFiles: [] })
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans bg-slate-50 min-h-screen text-slate-900 relative">

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
          <span className="text-slate-900 font-extrabold">Báo Cáo Sự Cố Cổng</span>
        </div>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div>
            <h2 className="font-heading text-3xl font-black text-slate-900">🚨 Báo Cáo Sự Cố Tại Cổng</h2>
            <p className="text-xs text-slate-600 mt-0.5">Ghi nhận sự cố xảy ra tại cổng kiểm soát và gửi ngay tới Dispatcher. <strong>Chỉ để báo cáo</strong> — không xem danh sách.</p>
          </div>
          <div className="flex items-center gap-2 bg-red-50 border border-red-300 px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-red-700">
            🕐 {timeString}
          </div>
        </div>
      </div>

      {/* SUCCESS */}
      {submittedIncident ? (
        <div className="space-y-5">
          <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-8 text-center space-y-4">
            <div className="text-6xl">✅</div>
            <h3 className="font-heading text-2xl font-black text-emerald-950">BÁO CÁO ĐÃ ĐƯỢC GỬI THÀNH CÔNG</h3>
            <p className="text-sm text-emerald-900 font-sans font-bold">Dispatcher đang tiếp nhận và xử lý sự cố tại {submittedIncident.gate}. Vui lòng duy trì trật tự tại hiện trường.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs font-mono font-bold">
              {[
                ['Mã Sự Cố', submittedIncident.id],
                ['Cổng', submittedIncident.gate],
                ['Giờ Báo', submittedIncident.reportedAt],
                ['Mức Độ', submittedIncident.severity],
              ].map(([k, v]) => (
                <div key={k} className="bg-white p-3 rounded-xl border border-emerald-300 text-center">
                  <span className="text-[10px] text-slate-500 font-sans block">{k}</span>
                  <strong className="text-emerald-950">{v}</strong>
                </div>
              ))}
            </div>
          </div>
          <button onClick={handleReset}
            className="w-full h-14 bg-orange-100 hover:bg-orange-200 text-orange-950 border-2 border-orange-400 rounded-2xl font-black text-sm cursor-pointer transition-all">
            [ 📝 BÁO CÁO SỰ CỐ MỚI ]
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Warning Banner */}
          <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-4 flex items-start gap-3 font-sans">
            <span className="material-symbols-outlined text-red-600 text-2xl flex-shrink-0">report_problem</span>
            <div>
              <div className="font-black text-red-950 text-sm">CHỈ BÁO CÁO — Không thể xem danh sách sự cố</div>
              <div className="text-xs text-red-900 font-bold mt-0.5">Sau khi gửi, Dispatcher sẽ tiếp nhận và phân công xử lý. Điền đầy đủ để hỗ trợ điều tra nhanh.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Col 1 */}
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 space-y-4">
              <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
                <span className="material-symbols-outlined text-red-600">report_problem</span>
                THÔNG TIN SỰ CỐ TẠI CỔNG
              </h3>

              <div>
                <label className="block text-[10px] uppercase text-slate-600 font-extrabold mb-1.5">Loại Sự Cố *</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-bold text-sm text-slate-900 focus:outline-none">
                  {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-600 font-extrabold mb-1.5">Cổng Xảy Ra Sự Cố *</label>
                <div className="grid grid-cols-4 gap-2">
                  {GATE_OPTIONS.map(g => (
                    <label key={g} className={`p-3 rounded-xl border-2 cursor-pointer font-black text-xs text-center transition-all ${form.gate === g ? 'bg-orange-100 border-orange-400 text-orange-950' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'}`}>
                      <input type="radio" name="gate" value={g} checked={form.gate === g} onChange={() => setForm(p => ({ ...p, gate: g }))} className="sr-only" />
                      {g}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-600 font-extrabold mb-1.5">Mã Booking (nếu có)</label>
                <input type="text" value={form.bookingId} onChange={e => setForm(p => ({ ...p, bookingId: e.target.value.toUpperCase() }))}
                  placeholder="VD: BK-20260812-001"
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-mono font-bold text-sm text-slate-900 focus:outline-none uppercase placeholder:normal-case placeholder:font-sans" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-slate-600 font-extrabold mb-1.5">Biển Số Xe</label>
                  <input type="text" value={form.vehicleId} onChange={e => setForm(p => ({ ...p, vehicleId: e.target.value.toUpperCase() }))}
                    placeholder="VD: 51C-123.45"
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-mono font-bold text-sm text-slate-900 focus:outline-none uppercase placeholder:normal-case placeholder:font-sans" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-slate-600 font-extrabold mb-1.5">Tên Tài Xế</label>
                  <input type="text" value={form.driverName} onChange={e => setForm(p => ({ ...p, driverName: e.target.value }))}
                    placeholder="Tên tài xế..."
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-bold text-sm text-slate-900 focus:outline-none" />
                </div>
              </div>
            </div>

            {/* Col 2 */}
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 space-y-4">
              <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
                <span className="material-symbols-outlined text-orange-600">priority_high</span>
                MỨC ĐỘ & MÔ TẢ SỰ CỐ
              </h3>

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

              <div>
                <label className="block text-[10px] uppercase text-slate-600 font-extrabold mb-1.5">Mô Tả Chi Tiết Sự Cố *</label>
                <textarea rows="3" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Mô tả rõ ràng điều gì đã xảy ra tại cổng, thời điểm nào, xe nào, tài xế nào, đã gây ra hậu quả gì..."
                  className="w-full p-3.5 bg-slate-100 border border-slate-300 rounded-xl text-sm font-normal text-slate-900 focus:outline-none resize-none font-sans" required />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-slate-600 font-extrabold mb-1.5">Hành Động Đã Thực Hiện Ngay</label>
                <textarea rows="2" value={form.immediateAction} onChange={e => setForm(p => ({ ...p, immediateAction: e.target.value }))}
                  placeholder="VD: Đã chặn xe lại, đã gọi an ninh cổng, đã tạm đóng làn..."
                  className="w-full p-3.5 bg-slate-100 border border-slate-300 rounded-xl text-sm font-normal text-slate-900 focus:outline-none resize-none font-sans" />
              </div>
            </div>
          </div>

          {/* Evidence */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 space-y-3">
            <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
              <span className="material-symbols-outlined text-purple-600">photo_camera</span>
              BẰNG CHỨNG (ẢNH CAMERA CỔNG / ẢNH THỰC ĐỊA)
            </h3>
            <div className="flex gap-3 flex-wrap">
              <button type="button" onClick={handleAddPhoto}
                className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-950 border-2 border-purple-400 rounded-xl font-black text-xs flex items-center gap-2 cursor-pointer transition-all">
                <span className="material-symbols-outlined text-sm">photo_camera</span> Chụp Ảnh Hiện Trường
              </button>
              <button type="button" onClick={() => showToast('📹 Đang ghi lại video camera cổng...')}
                className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-950 border-2 border-blue-400 rounded-xl font-black text-xs flex items-center gap-2 cursor-pointer transition-all">
                <span className="material-symbols-outlined text-sm">videocam</span> Lưu Clip Camera Cổng
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
                Chưa có bằng chứng. Camera cổng tự động lưu theo ID phương tiện.
              </div>
            )}
          </div>

          <button type="submit"
            className="w-full h-16 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-500 rounded-2xl font-black text-base flex items-center justify-center gap-3 cursor-pointer transition-all shadow-md">
            <span className="material-symbols-outlined text-xl">send</span>
            [ 🚨 GỬI BÁO CÁO SỰ CỐ CỔNG TỚI DISPATCHER ]
          </button>
        </form>
      )}
    </div>
  )
}
