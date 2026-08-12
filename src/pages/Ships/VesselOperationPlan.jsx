import React, { useState } from 'react'
import { INITIAL_OPERATION_PLAN } from '../../data/vesselOperationPlanData'

export default function VesselOperationPlan() {
  const [plan, setPlan] = useState(INITIAL_OPERATION_PLAN)
  const [toastMessage, setToastMessage] = useState('')
  const [showAssignCraneModal, setShowAssignCraneModal] = useState(false)
  const [newCrane, setNewCrane] = useState({ crane: 'Cẩu Bờ QC-04', hatch: 'Hầm Tàu 04', range: 'MSCU451 - MSCU600', priority: 'Trung Bình', moves: 150 })

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // ── Handlers ──────────────────────────────────────────────
  const handleApplyAISuggestion = () => {
    setPlan(prev => ({
      ...prev,
      cranes: prev.cranes.map(c => c.crane === 'Cẩu Bờ QC-02' ? { ...c, crane: 'Cẩu Bờ QC-04', conflict: false } : c),
      conflictData: { ...prev.conflictData, hasConflict: false },
    }))
    showToast('✨ Đã áp dụng thành công gợi ý AI: Chuyển phân công từ Cẩu QC-02 sang Cẩu QC-04. Xung đột nguồn lực đã được giải quyết!')
  }

  const handleIgnoreAISuggestion = () => {
    showToast('ℹ️ Đã bỏ qua đề xuất từ trí tuệ nhân tạo (AI).')
  }

  const handleSaveDraft = () => {
    setPlan(prev => ({ ...prev, status: 'Draft' }))
    showToast('💾 Đã lưu nháp thành công kế hoạch xếp dỡ (Draft).')
  }

  const handleValidatePlan = () => {
    if (plan.conflictData.hasConflict) {
      showToast('❌ Kiểm tra thất bại: Còn xung đột phân công tại cẩu bờ QC-02!')
      return
    }
    setPlan(prev => ({ ...prev, status: 'Validated' }))
    showToast('✓ Kế hoạch đã được kiểm tra (Validated) — Tất cả nguồn lực cẩu và đội bãi hợp lệ!')
  }

  const handlePublishPlan = () => {
    if (plan.conflictData.hasConflict) {
      showToast('🚫 KHÔNG THỂ XUẤT BẢN: Xung đột cẩu bờ QC-02 chưa được xử lý!')
      return
    }
    setPlan(prev => ({ ...prev, status: 'Published' }))
    showToast('🚀 ĐÃ XUẤT BẢN KẾ HOẠCH — Chuyển thông tin tác nghiệp đến Đội bãi (Yard Operator) và Tổ điều khiển Cẩu bờ!')
  }

  const handleAddCrane = (e) => {
    e.preventDefault()
    const newEntry = { id: `CR-${Date.now()}`, ...newCrane, status: 'Đã Lập Lịch' }
    setPlan(prev => ({
      ...prev,
      cranes: [...prev.cranes, newEntry],
      assignedCranesCount: prev.assignedCranesCount + 1,
    }))
    setShowAssignCraneModal(false)
    showToast(`✅ Đã phân công thêm ${newCrane.crane} phụ trách tác nghiệp ${newCrane.hatch}`)
  }

  const statusColorMap = {
    Draft:         'bg-slate-100 text-slate-800 border-slate-300',
    Validated:     'bg-blue-100 text-blue-900 border-blue-300',
    Published:     'bg-green-100 text-green-900 border-green-300',
    'In Progress': 'bg-amber-100 text-amber-900 border-amber-300',
    Completed:     'bg-purple-100 text-purple-900 border-purple-300',
  }

  const statusLabelMap = {
    Draft:         'BẢN NHÁP (DRAFT)',
    Validated:     'ĐÃ KIỂM TRA (VALIDATED)',
    Published:     'ĐÃ XUẤT BẢN (PUBLISHED)',
    'In Progress': 'ĐANG THỰC HIỆN',
    Completed:     'ĐÃ HOÀN THÀNH',
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen relative text-slate-900">

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#3b82f6', borderWidth: '1px' }}
          className="fixed top-20 right-8 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-extrabold flex items-center gap-3 z-[100] animate-bounce">
          <span className="text-blue-400">●</span>{toastMessage}
        </div>
      )}

      {/* ── 1. HEADER & OPERATION BAR ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-extrabold bg-blue-100 text-blue-900 px-3 py-0.5 rounded-full uppercase">ĐIỀU ĐỘ TÁC NGHIỆP CẢNG (DISPATCHER)</span>
              <span className={`text-xs font-extrabold px-3 py-0.5 rounded-full border ${statusColorMap[plan.status]}`}>
                TRẠNG THÁI: {statusLabelMap[plan.status] || plan.status}
              </span>
            </div>
            <h2 className="font-heading text-3xl font-extrabold text-slate-900">Kế Hoạch Xếp Dỡ Tàu Container (Vessel Operation Plan)</h2>
            <p className="text-xs text-slate-600 mt-0.5">Lập kế hoạch phân bổ cẩu bờ, thứ tự dỡ container và bố trí phương tiện bãi (ITV, RTG) cho tàu cập cầu.</p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleSaveDraft}
              style={{ backgroundColor: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1', borderWidth: '1px' }}
              className="h-10 px-4 font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer hover:bg-slate-200">
              <span className="material-symbols-outlined text-sm">save</span>
              Lưu Bản Nháp
            </button>
            <button onClick={handleValidatePlan}
              style={{ backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#93c5fd', borderWidth: '1px' }}
              className="h-10 px-4 font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer hover:bg-blue-200">
              <span className="material-symbols-outlined text-sm">fact_check</span>
              Kiểm Tra Kế Hoạch
            </button>
            <button onClick={handlePublishPlan}
              style={{ backgroundColor: plan.conflictData.hasConflict ? '#e2e8f0' : '#dcfce7', color: plan.conflictData.hasConflict ? '#64748b' : '#065f46', borderColor: plan.conflictData.hasConflict ? '#cbd5e1' : '#86efac', borderWidth: '1px' }}
              className="h-10 px-5 font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer">
              <span className="material-symbols-outlined text-sm">send</span>
              Xuất Bản Kế Hoạch
            </button>
          </div>
        </div>

        {/* Vessel Operation Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 bg-slate-100 p-4 rounded-xl border border-slate-200 text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-700 uppercase block font-sans font-extrabold">Tên Tàu Container</span>
            <span className="font-extrabold text-slate-900 text-sm">{plan.vesselName}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-700 uppercase block font-sans font-extrabold">Cầu Cảng</span>
            <span className="font-extrabold text-amber-900 text-sm">{plan.berth}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-700 uppercase block font-sans font-extrabold">Giờ Đến (ETA)</span>
            <span className="font-extrabold text-blue-900 text-sm">{plan.eta}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-700 uppercase block font-sans font-extrabold">Giờ Rời (ETD)</span>
            <span className="font-extrabold text-purple-900 text-sm">{plan.etd}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-700 uppercase block font-sans font-extrabold">Hình Thức Tác Nghiệp</span>
            <span className="font-extrabold text-emerald-900 text-sm">{plan.operationType}</span>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-700 uppercase block font-sans font-extrabold">Tiến Độ Tác Nghiệp</span>
            <span className="font-extrabold text-slate-900 text-sm">{plan.completedContainers} / {plan.totalContainers} TEU</span>
            <div className="w-full bg-slate-300 h-2 rounded-full mt-1 overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${(plan.completedContainers / plan.totalContainers) * 100}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. OPERATION SUMMARY KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          ['Tổng Số Container', `${plan.totalContainers} TEU`, 'text-slate-900', 'border-slate-300', 'inventory_2'],
          ['Đã Lập Kế Hoạch', `${plan.plannedContainers} TEU`, 'text-blue-900', 'border-blue-300', 'assignment'],
          ['Đã Hoàn Thành', `${plan.completedContainers} TEU`, 'text-emerald-900', 'border-emerald-300', 'check_circle'],
          ['Còn Phải Dỡ', `${plan.remainingContainers} TEU`, 'text-amber-900', 'border-amber-300', 'hourglass_top'],
          ['Cẩu Bờ Phân Công', `${plan.assignedCranesCount} Cẩu`, 'text-purple-900', 'border-purple-300', 'precision_manufacturing'],
          ['Đội Bãi Phân Công', `${plan.assignedYardTeamsCount} Đội`, 'text-teal-900', 'border-teal-300', 'groups'],
        ].map(([label, val, color, border, icon]) => (
          <div key={label} className={`bg-white rounded-2xl border-2 ${border} p-4 shadow-sm flex flex-col justify-between`}>
            <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-700 uppercase">
              <span>{label}</span>
              <span className={`material-symbols-outlined text-sm ${color}`}>{icon}</span>
            </div>
            <div className={`text-2xl font-black font-mono ${color} mt-2`}>{val}</div>
          </div>
        ))}
      </div>

      {/* ── 7. RESOURCE CONFLICT DETECTION BANNER & AI SUGGESTION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Conflict Alert Banner */}
        {plan.conflictData.hasConflict ? (
          <div style={{ backgroundColor: '#fef2f2', borderColor: '#ef4444', borderWidth: '2px', color: '#7f1d1d' }}
            className="rounded-2xl p-6 shadow-sm space-y-2">
            <div style={{ color: '#991b1b' }} className="flex items-center gap-2 font-black text-sm uppercase tracking-wide">
              <span style={{ color: '#dc2626' }} className="material-symbols-outlined text-2xl">warning</span>
              ⚠ CẢNH BÁO XUNG ĐỘT NGUỒN LỰC (RESOURCE CONFLICT)
            </div>
            <p style={{ color: '#7f1d1d' }} className="text-xs font-extrabold">
              {plan.conflictData.resource} hiện đang được gán cho tàu: <strong style={{ color: '#991b1b' }} className="underline font-mono text-sm">{plan.conflictData.vessel}</strong> (Khung giờ: <span style={{ color: '#991b1b' }} className="font-mono">{plan.conflictData.time}</span>)
            </p>
            <div style={{ backgroundColor: '#fee2e2', borderColor: '#fca5a5', borderWidth: '1px', color: '#991b1b' }}
              className="text-xs font-semibold p-3 rounded-xl leading-relaxed">
              {plan.conflictData.details} Vui lòng thay đổi cẩu bờ khác hoặc điều chỉnh thời gian trước khi xuất bản kế hoạch.
            </div>
          </div>
        ) : (
          <div style={{ backgroundColor: '#f0fdf4', borderColor: '#22c55e', borderWidth: '2px', color: '#14532d' }}
            className="rounded-2xl p-6 shadow-sm flex items-center gap-3">
            <span style={{ color: '#16a34a' }} className="material-symbols-outlined text-3xl">verified</span>
            <div>
              <div style={{ color: '#14532d' }} className="font-black text-sm">✓ KHÔNG PHÁT HIỆN XUNG ĐỘT NGUỒN LỰC</div>
              <div style={{ color: '#15803d' }} className="text-xs font-semibold">Tất cả cẩu bờ và phương tiện bãi được phân bổ hợp lệ, không bị trùng lịch tác nghiệp.</div>
            </div>
          </div>
        )}

        {/* AI Suggestion Panel - CLEAN HIGH CONTRAST LIGHT CARD (0% WHITE TEXT) */}
        <div style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1', borderWidth: '2px', color: '#0f172a' }}
          className="rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div style={{ borderColor: '#e2e8f0', borderBottomWidth: '1px' }} className="flex items-center justify-between pb-3">
              <span style={{ color: '#0369a1' }} className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">auto_awesome</span>
                KHUYẾN NGHỊ TỪ TRÍ TUỆ NHÂN TẠO (AI RECOMMENDATION)
              </span>
              <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', borderColor: '#7dd3fc', borderWidth: '1px' }}
                className="text-[10px] font-mono font-black px-2.5 py-1 rounded">
                Độ chính xác: 98.4%
              </span>
            </div>
            
            <div style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderWidth: '1px' }} className="mt-3 p-4 rounded-xl space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span style={{ color: '#334155' }} className="font-bold font-sans">Cẩu Bờ Đề Xuất:</span>
                <strong style={{ color: '#047857' }} className="font-black text-sm">{plan.aiSuggestion.suggestedCrane}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: '#334155' }} className="font-bold font-sans">Bãi Đích Đề Xuất:</span>
                <strong style={{ color: '#1d4ed8' }} className="font-black text-sm">{plan.aiSuggestion.suggestedYard}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: '#334155' }} className="font-bold font-sans">Cẩu Bãi Đề Xuất:</span>
                <strong style={{ color: '#b45309' }} className="font-black text-sm">{plan.aiSuggestion.suggestedRtg}</strong>
              </div>
              <div style={{ backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', borderWidth: '1px', color: '#1e293b' }}
                className="text-xs p-3 rounded-lg mt-2 leading-relaxed font-sans">
                💡 <strong style={{ color: '#0369a1' }}>Lý do:</strong> {plan.aiSuggestion.reason}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleApplyAISuggestion}
              style={{ backgroundColor: '#dcfce7', color: '#065f46', borderColor: '#34d399', borderWidth: '2px' }}
              className="px-5 py-2.5 hover:bg-emerald-200 font-black text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Áp Dụng Gợi Ý AI
            </button>
            <button onClick={handleIgnoreAISuggestion}
              style={{ backgroundColor: '#f1f5f9', color: '#334155', borderColor: '#cbd5e1', borderWidth: '2px' }}
              className="px-4 py-2.5 hover:bg-slate-200 font-extrabold text-xs rounded-xl transition-all cursor-pointer">
              Bỏ Qua
            </button>
          </div>
        </div>

      </div>

      {/* ── 3. CRANE ASSIGNMENT TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-heading text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-700">precision_manufacturing</span>
              Phân Công Cẩu Bờ (Quay Crane - QC)
            </h3>
            <p className="text-xs text-slate-600">Phân bổ thiết bị cẩu bờ bốc dỡ container theo từng hầm tàu (Hatch)</p>
          </div>
          <button onClick={() => setShowAssignCraneModal(true)}
            style={{ backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#93c5fd', borderWidth: '1px' }}
            className="h-9 px-4 rounded-xl font-extrabold text-xs hover:bg-blue-200 flex items-center gap-1.5 shadow-xs cursor-pointer">
            <span className="material-symbols-outlined text-sm">add_circle</span>
            + Phân Công Cẩu
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                {['Mã Cẩu Bờ', 'Hầm Tàu (Hatch)', 'Khung Mã Container', 'Mức Ưu Tiên', 'Số Moves Dự Kiến', 'Trạng Thái'].map(h => (
                  <th key={h} className="py-3 px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {plan.cranes.map(c => (
                <tr key={c.id} className={`hover:bg-slate-100/60 ${c.conflict ? 'bg-red-50/50' : ''}`}>
                  <td className="py-3 px-4 font-extrabold text-slate-900">
                    <span className="flex items-center gap-1.5">
                      {c.crane}
                      {c.conflict && <span className="text-[9px] bg-red-100 text-red-900 font-sans font-black px-1.5 py-0.5 rounded border border-red-300">Xung Đột</span>}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-700">{c.hatch}</td>
                  <td className="py-3 px-4 font-extrabold text-slate-900">{c.range}</td>
                  <td className="py-3 px-4 font-sans">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${c.priority === 'Ưu Tiên Cao' ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'}`}>
                      {c.priority}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-extrabold text-blue-900">{c.moves} moves</td>
                  <td className="py-3 px-4 font-sans">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-bold text-[10px]">{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. DISCHARGE SEQUENCE TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-heading text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-700">format_list_numbered</span>
            Trình Tự Dỡ Container Khỏi Tàu (Discharge Sequence)
          </h3>
          <p className="text-xs text-slate-600">Danh sách thứ tự ưu tiên gắp dỡ từng container từ hầm tàu hạ xuống phương tiện bãi</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                {['STT', 'Mã Container', 'Loại Cont', 'Trọng Lượng', 'Hầm Tàu', 'Mức Ưu Tiên', 'Vị Trí Bãi Đích', 'Trạng Thái'].map(h => (
                  <th key={h} className="py-3 px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {plan.sequence.map(s => (
                <tr key={s.seq} className="hover:bg-slate-100/60">
                  <td className="py-3 px-4 font-bold text-slate-600">#{s.seq}</td>
                  <td className="py-3 px-4 font-extrabold text-slate-900">{s.containerId}</td>
                  <td className="py-3 px-4 font-bold text-blue-900">{s.type}</td>
                  <td className="py-3 px-4 text-slate-700">{s.weight}</td>
                  <td className="py-3 px-4 text-slate-900 font-bold">{s.hatch}</td>
                  <td className="py-3 px-4 font-sans">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${s.priority === 'Ưu Tiên Cao' ? 'bg-red-100 text-red-900' : 'bg-slate-100 text-slate-800'}`}>
                      {s.priority}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-extrabold text-amber-900">{s.destination}</td>
                  <td className="py-3 px-4 font-sans">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-bold text-[10px]">{s.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5 & 6. YARD RESOURCE ASSIGNMENT & OPERATION TIMELINE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 5. Yard Resource Assignment */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-heading text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-700">groups</span>
              Phân Công Thiết Bị & Đội Bãi (Yard Resources)
            </h3>
            <p className="text-xs text-slate-600">Phân công xe đầu kéo nội bộ (ITV) và cẩu bãi (RTG) vận chuyển container về bãi chứa</p>
          </div>

          <div className="space-y-3">
            {plan.yardTeams.map(yt => (
              <div key={yt.id} className="p-4 bg-slate-100 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="font-extrabold text-slate-900 text-sm">{yt.name}</div>
                  <div className="text-xs font-mono text-slate-700 mt-0.5">
                    Khu vực bãi đích: <strong className="text-amber-900 font-extrabold">{yt.block}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900">
                    🏗️ {yt.rtg}
                  </span>
                  <span className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900">
                    🚛 {yt.itv}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Operation Timeline */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-heading text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-700">timeline</span>
              Mốc Thời Gian Tác Nghiệp Dự Kiến (Timeline)
            </h3>
            <p className="text-xs text-slate-600">Tiến trình triển khai tác nghiệp chi tiết từ khi tàu buộc dây neo đến khi rời cầu</p>
          </div>

          <div className="relative pl-6 border-l-2 border-slate-300 space-y-4 font-mono text-xs">
            {plan.timeline.map((tl, i) => (
              <div key={i} className="relative">
                <span className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-white ${tl.status === 'completed' ? 'bg-emerald-500' : tl.status === 'current' ? 'bg-blue-600 animate-ping' : 'bg-slate-300'}`}></span>
                <div className="font-bold text-blue-900 text-xs">{tl.time}</div>
                <div className="font-extrabold text-slate-900 text-sm font-sans">{tl.title}</div>
                <div className="text-[11px] text-slate-600 font-sans mt-0.5">{tl.desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── ASSIGN CRANE MODAL ── */}
      {showAssignCraneModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 font-sans">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-heading text-lg font-extrabold text-slate-900">Phân Công Cẩu Bờ Mới</h3>
              <button onClick={() => setShowAssignCraneModal(false)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <form onSubmit={handleAddCrane} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Mã Cẩu Bờ (QC)</label>
                <select value={newCrane.crane} onChange={e => setNewCrane(p => ({ ...p, crane: e.target.value }))}
                  className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-xl font-bold">
                  {['Cẩu Bờ QC-01', 'Cẩu Bờ QC-02', 'Cẩu Bờ QC-03', 'Cẩu Bờ QC-04', 'Cẩu Bờ QC-05'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Hầm Tàu (Hatch)</label>
                <input value={newCrane.hatch} onChange={e => setNewCrane(p => ({ ...p, hatch: e.target.value }))}
                  className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-xl font-bold" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Khung Mã Container</label>
                <input value={newCrane.range} onChange={e => setNewCrane(p => ({ ...p, range: e.target.value }))}
                  className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-xl font-bold font-mono" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAssignCraneModal(false)} className="flex-1 h-10 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100">Hủy</button>
                <button type="submit"
                  style={{ backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#93c5fd', borderWidth: '1px' }}
                  className="flex-1 h-10 rounded-xl font-extrabold text-xs shadow-xs hover:bg-blue-200">
                  Xác Nhận Phân Công
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
