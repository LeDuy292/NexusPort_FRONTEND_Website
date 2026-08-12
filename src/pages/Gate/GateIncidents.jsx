import React, { useState, useMemo } from 'react'
import { gateIncidentsData } from '../../data/gateOfficerData'

const SEVERITY_STYLE = {
  Low: 'bg-slate-100 text-slate-800 border-slate-300',
  Medium: 'bg-amber-100 text-amber-900 border-amber-300',
  High: 'bg-orange-100 text-orange-900 border-orange-300',
  Critical: 'bg-red-200 text-red-950 border-red-400',
}

const STATUS_STYLE = {
  Pending: 'bg-amber-100 text-amber-900 border-amber-300',
  'Under Review': 'bg-blue-100 text-blue-900 border-blue-300',
  Resolved: 'bg-green-100 text-green-900 border-green-300',
  Rejected: 'bg-slate-100 text-slate-700 border-slate-300',
}

export default function GateIncidents() {
  const [incidents, setIncidents] = useState(gateIncidentsData)
  const [statusFilter, setStatusFilter] = useState('All')
  const [severityFilter, setSeverityFilter] = useState('All')
  const [gateFilter, setGateFilter] = useState('All')
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  const [createForm, setCreateForm] = useState({
    bookingId: '', vehicleId: '', licensePlate: '', driverName: '', containerId: '',
    gate: 'Gate A', type: '', severity: 'Medium', description: '',
  })

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 3500) }

  const filtered = useMemo(() => incidents.filter(inc => {
    const matchStatus = statusFilter === 'All' || inc.status === statusFilter
    const matchSev = severityFilter === 'All' || inc.severity === severityFilter
    const matchGate = gateFilter === 'All' || inc.gate === gateFilter
    return matchStatus && matchSev && matchGate
  }), [incidents, statusFilter, severityFilter, gateFilter])

  const kpi = {
    total: incidents.length,
    pending: incidents.filter(i => i.status === 'Pending').length,
    underReview: incidents.filter(i => i.status === 'Under Review').length,
    resolved: incidents.filter(i => i.status === 'Resolved').length,
    critical: incidents.filter(i => i.severity === 'Critical').length,
  }

  const handleSubmitIncident = (e) => {
    e.preventDefault()
    if (!createForm.type) return
    const newInc = {
      id: `INC-${Date.now().toString().slice(-6)}`,
      time: new Date().toISOString(),
      timeDisplay: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      ...createForm,
      status: 'Pending',
      reportedBy: 'Nguyễn Văn Hùng',
      resolvedBy: null,
      resolvedAt: null,
    }
    setIncidents(prev => [newInc, ...prev])
    setShowCreateModal(false)
    setCreateForm({ bookingId: '', vehicleId: '', licensePlate: '', driverName: '', containerId: '', gate: 'Gate A', type: '', severity: 'Medium', description: '' })
    showToast(`📋 Đã tạo Incident ${newInc.id} và gửi đến Dispatcher.`)
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen">

      {toastMessage && (
        <div className="fixed top-20 right-8 bg-carbon text-white px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-extrabold flex items-center gap-3 z-50 animate-bounce border border-signal-orange">
          <span className="text-signal-orange">●</span>{toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center bg-white border border-chalk rounded-2xl p-5 shadow-sm">
        <div>
          <span className="text-xs font-extrabold bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full uppercase">GATE OFFICER</span>
          <h2 className="font-heading text-3xl font-extrabold text-carbon mt-1">Gate Incidents</h2>
          <p className="text-xs text-slate mt-0.5">Ghi nhận và xử lý các trường hợp bất thường tại cổng cảng.</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="h-11 px-5 bg-signal-orange text-white rounded-xl font-extrabold text-xs hover:opacity-95 shadow-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">add_circle</span>
          + Tạo Incident
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          ['Tổng', kpi.total, 'text-carbon', 'border-chalk'],
          ['Pending', kpi.pending, 'text-amber-600', 'border-amber-300'],
          ['Under Review', kpi.underReview, 'text-blue-600', 'border-blue-300'],
          ['Resolved', kpi.resolved, 'text-green-600', 'border-green-300'],
          ['Critical', kpi.critical, 'text-red-700', 'border-red-300'],
        ].map(([label, val, color, border]) => (
          <div key={label} className={`bg-white rounded-2xl border-2 ${border} p-4 shadow-sm`}>
            <div className="text-[10px] font-bold text-slate uppercase">{label}</div>
            <div className={`text-3xl font-extrabold font-mono ${color}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm flex flex-wrap gap-3 items-center text-xs font-bold">
        {[
          ['Status', statusFilter, setStatusFilter, ['All', 'Pending', 'Under Review', 'Resolved', 'Rejected']],
          ['Severity', severityFilter, setSeverityFilter, ['All', 'Low', 'Medium', 'High', 'Critical']],
          ['Gate', gateFilter, setGateFilter, ['All', 'Gate A', 'Gate B', 'Gate C']],
        ].map(([label, val, setter, opts]) => (
          <select key={label} value={val} onChange={e => setter(e.target.value)}
            className="px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange">
            {opts.map(o => <option key={o} value={o}>{o === 'All' ? `${label}: All` : o}</option>)}
          </select>
        ))}
      </div>

      {/* Incidents Table */}
      <div className="bg-white rounded-2xl border border-chalk shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-fog border-b border-chalk text-slate font-bold uppercase text-[10px] tracking-wider">
                {['Incident ID', 'Time', 'Vehicle', 'Driver', 'Container', 'Type', 'Gate', 'Severity', 'Status', 'Action'].map(h => (
                  <th key={h} className={`py-3.5 px-4 ${h === 'Action' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk">
              {filtered.length === 0 ? (
                <tr><td colSpan="10" className="py-12 text-center text-slate font-bold">Không có incident nào.</td></tr>
              ) : filtered.map(inc => (
                <tr key={inc.id} className="hover:bg-fog/70">
                  <td onClick={() => setSelectedIncident(inc)} className="py-3 px-4 font-mono font-extrabold text-signal-orange cursor-pointer hover:underline">{inc.id}</td>
                  <td className="py-3 px-4 font-mono font-bold text-carbon">{inc.timeDisplay}</td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-carbon">{inc.vehicleId}</div>
                    <div className="text-[10px] font-mono text-slate">{inc.licensePlate}</div>
                  </td>
                  <td className="py-3 px-4 font-bold text-carbon">{inc.driverName}</td>
                  <td className="py-3 px-4 font-mono text-carbon">{inc.containerId || '—'}</td>
                  <td className="py-3 px-4 font-bold text-carbon text-[11px]">{inc.type}</td>
                  <td className="py-3 px-4 font-mono font-bold">{inc.gate}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${SEVERITY_STYLE[inc.severity] || ''}`}>{inc.severity}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold inline-flex items-center gap-1 ${STATUS_STYLE[inc.status] || ''}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>{inc.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => setSelectedIncident(inc)}
                      className="px-3 py-1.5 bg-carbon text-white rounded-lg font-extrabold text-[11px] hover:bg-black flex items-center gap-1 ml-auto">
                      <span className="material-symbols-outlined text-xs">visibility</span>View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
          <div className="bg-white w-full max-w-lg max-h-[92vh] rounded-3xl p-6 md:p-8 space-y-4 shadow-2xl overflow-y-auto animate-in zoom-in-95">
            <div className="flex justify-between items-start border-b border-chalk pb-3">
              <div>
                <span className="text-[10px] font-extrabold text-signal-orange uppercase font-mono block">GATE INCIDENT DETAIL</span>
                <h3 className="font-heading text-xl font-extrabold text-carbon font-mono">{selectedIncident.id}</h3>
                <div className="flex gap-2 mt-1">
                  <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold ${SEVERITY_STYLE[selectedIncident.severity]}`}>{selectedIncident.severity}</span>
                  <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold ${STATUS_STYLE[selectedIncident.status]}`}>{selectedIncident.status}</span>
                </div>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              {[
                ['Thời gian', selectedIncident.timeDisplay], ['Gate', selectedIncident.gate],
                ['Loại Incident', selectedIncident.type], ['Booking ID', selectedIncident.bookingId || '—'],
                ['Vehicle', selectedIncident.vehicleId], ['Biển số', selectedIncident.licensePlate],
                ['Driver', selectedIncident.driverName], ['Container', selectedIncident.containerId || '—'],
                ['Báo cáo bởi', selectedIncident.reportedBy], ['Giải quyết bởi', selectedIncident.resolvedBy || '—'],
              ].map(([k, v]) => (
                <div key={k} className="bg-fog p-3 rounded-xl border border-chalk">
                  <div className="text-[10px] text-slate uppercase">{k}</div>
                  <div className="font-bold text-carbon">{v}</div>
                </div>
              ))}
            </div>
            <div className="bg-fog p-3 rounded-xl border border-chalk text-xs">
              <div className="text-[10px] text-slate uppercase mb-1">Mô tả chi tiết</div>
              <p className="text-carbon font-medium">{selectedIncident.description}</p>
            </div>
            <button onClick={() => setSelectedIncident(null)} className="w-full h-11 bg-carbon text-white rounded-xl font-extrabold text-xs hover:bg-black">Đóng</button>
          </div>
        </div>
      )}

      {/* Create Incident Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
          <div className="bg-white w-full max-w-lg max-h-[92vh] rounded-3xl p-6 md:p-8 shadow-2xl overflow-y-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-chalk pb-3 mb-4">
              <h3 className="font-heading text-xl font-extrabold text-carbon">TẠO GATE INCIDENT</h3>
              <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmitIncident} className="space-y-4 text-xs font-bold">
              <div className="grid grid-cols-2 gap-3">
                {[['Booking ID', 'bookingId', 'GB-20260811-XXX'],
                  ['Vehicle ID', 'vehicleId', 'TRK-XXX'],
                  ['Biển số xe', 'licensePlate', '43C-XXX.XX'],
                  ['Driver Name', 'driverName', 'Nguyễn Văn A'],
                  ['Container ID', 'containerId', 'MSCU1234567'],
                ].map(([label, field, ph]) => (
                  <div key={field}>
                    <label className="block text-slate uppercase text-[10px] mb-1">{label}</label>
                    <input type="text" value={createForm[field]} onChange={e => setCreateForm(p => ({ ...p, [field]: e.target.value }))}
                      placeholder={ph}
                      className="w-full px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon font-mono focus:outline-none focus:border-signal-orange" />
                  </div>
                ))}
                <div>
                  <label className="block text-slate uppercase text-[10px] mb-1">Gate</label>
                  <select value={createForm.gate} onChange={e => setCreateForm(p => ({ ...p, gate: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange">
                    {['Gate A', 'Gate B', 'Gate C'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate uppercase text-[10px] mb-1">Loại Incident *</label>
                  <select required value={createForm.type} onChange={e => setCreateForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange">
                    <option value="">-- Chọn loại --</option>
                    {['Vehicle Mismatch', 'Driver Mismatch', 'Container Mismatch', 'Invalid Booking', 'Expired Booking',
                      'Outside Time Window', 'Invalid License', 'Seal Mismatch', 'Unauthorized Vehicle', 'Other'].map(t => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate uppercase text-[10px] mb-1">Mức Độ Nghiêm Trọng</label>
                  <select value={createForm.severity} onChange={e => setCreateForm(p => ({ ...p, severity: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange">
                    {['Low', 'Medium', 'High', 'Critical'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate uppercase text-[10px] mb-1">Mô tả chi tiết</label>
                <textarea rows="3" value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Nhập mô tả sự cố chi tiết..."
                  className="w-full p-3 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange font-normal" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 h-11 border border-chalk text-slate rounded-xl font-bold hover:bg-fog">Hủy</button>
                <button type="submit"
                  className={`flex-1 h-11 rounded-xl font-extrabold text-sm ${createForm.type ? 'bg-signal-orange text-white hover:opacity-95 shadow-md' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                  Submit Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
