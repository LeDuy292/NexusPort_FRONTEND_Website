import React, { useState, useMemo } from 'react'
import { vesselScheduleData } from '../../data/vesselScheduleData'

// ── CONSTANTS & VIETNAMESE STATUSES ────────────────────────────
const STATUS_CONFIG = {
  'Lập Lịch':      { cls: 'bg-slate-100 text-slate-800 border-slate-300',   dot: 'bg-slate-500',   icon: 'schedule'         },
  'Đang Vào Cảng': { cls: 'bg-blue-100 text-blue-900 border-blue-300',      dot: 'bg-blue-500',    icon: 'directions_boat'  },
  'Đã Cập Cầu':    { cls: 'bg-amber-100 text-amber-900 border-amber-300',   dot: 'bg-amber-500',   icon: 'anchor'           },
  'Đang Xếp Dỡ':   { cls: 'bg-purple-100 text-purple-900 border-purple-300',dot: 'bg-purple-500',  icon: 'forklift'         },
  'Đã Hoàn Thành': { cls: 'bg-green-100 text-green-900 border-green-300',   dot: 'bg-green-500',   icon: 'check_circle'     },
  'Chậm Lịch':     { cls: 'bg-red-100 text-red-900 border-red-300',         dot: 'bg-red-500',     icon: 'warning'          },
}

const CARGO_TYPES = [
  'Hàng Khô Xuất Khẩu',
  'Hàng Khô Nhập Khẩu',
  'Hàng Lạnh Xuất Khẩu',
  'Hàng Lạnh Nhập Khẩu',
  'Hàng Bách Hóa',
  'Hàng Nguy Hiểm (DG)',
]

const BERTHS = ['Cầu B-01', 'Cầu B-02', 'Cầu B-03', 'Cầu B-04']
const STATUSES = ['Lập Lịch', 'Đang Vào Cảng', 'Đã Cập Cầu', 'Đang Xếp Dỡ', 'Đã Hoàn Thành', 'Chậm Lịch']

const emptyForm = {
  vesselName: '', imo: '', shippingLine: '', vesselType: 'Tàu Container Mẹ (Mother Vessel)',
  flag: '', eta: '', etd: '', cargoType: 'Hàng Khô Xuất Khẩu',
  totalContainers: '', dischargeContainers: '', loadContainers: '',
  berth: '', notes: '',
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['Lập Lịch']
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
      {status}
    </span>
  )
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function VesselSchedule() {
  const [vessels, setVessels] = useState(vesselScheduleData)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [cargoFilter, setCargoFilter] = useState('All')
  const [berthFilter, setBerthFilter] = useState('All')
  const [toastMessage, setToastMessage] = useState('')

  // Drawer states
  const [detailVessel, setDetailVessel] = useState(null)
  const [showFormDrawer, setShowFormDrawer] = useState(false)
  const [editingVessel, setEditingVessel] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState({})
  const [showAssignBerthModal, setShowAssignBerthModal] = useState(false)
  const [selectedBerth, setSelectedBerth] = useState('')

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 3500) }

  // ── KPI ─────────────────────────────────────────────────────
  const kpi = useMemo(() => ({
    arrivingToday: vessels.filter(v => v.status === 'Đang Vào Cảng').length,
    berthingToday: vessels.filter(v => v.status === 'Đã Cập Cầu').length,
    discharging:   vessels.filter(v => v.status === 'Đang Xếp Dỡ').length,
    completed:     vessels.filter(v => v.status === 'Đã Hoàn Thành').length,
    delayed:       vessels.filter(v => v.status === 'Chậm Lịch').length,
  }), [vessels])

  // ── FILTER ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return vessels.filter(v => {
      const matchQ = v.vesselName.toLowerCase().includes(q) || v.imo.toLowerCase().includes(q) || v.shippingLine.toLowerCase().includes(q)
      const matchS  = statusFilter === 'All' || v.status === statusFilter
      const matchC  = cargoFilter === 'All' || v.cargoType === cargoFilter
      const matchB  = berthFilter === 'All' || (berthFilter === 'Chưa gán cầu' ? !v.berth : v.berth === berthFilter)
      return matchQ && matchS && matchC && matchB
    })
  }, [vessels, search, statusFilter, cargoFilter, berthFilter])

  // ── FORM LOGIC ───────────────────────────────────────────────
  const openAdd = () => {
    setEditingVessel(null)
    setForm(emptyForm)
    setFormErrors({})
    setShowFormDrawer(true)
    setDetailVessel(null)
  }

  const openEdit = (v) => {
    setEditingVessel(v)
    setForm({
      vesselName: v.vesselName, imo: v.imo, shippingLine: v.shippingLine,
      vesselType: v.vesselType, flag: v.flag,
      eta: v.eta?.slice(0, 16) || '', etd: v.etd?.slice(0, 16) || '',
      cargoType: v.cargoType, totalContainers: v.totalContainers,
      dischargeContainers: v.dischargeContainers || '', loadContainers: v.loadContainers || '',
      berth: v.berth || '', notes: v.notes || '',
    })
    setFormErrors({})
    setShowFormDrawer(true)
    setDetailVessel(null)
  }

  const validateForm = () => {
    const errs = {}
    if (!form.vesselName.trim()) errs.vesselName = 'Bắt buộc nhập tên tàu'
    if (!form.imo.trim()) errs.imo = 'Bắt buộc nhập số IMO'
    else if (vessels.some(v => v.imo.toLowerCase() === form.imo.trim().toLowerCase() && v.id !== editingVessel?.id)) {
      errs.imo = 'Mã số IMO đã tồn tại trong hệ thống cảng'
    }
    if (!form.eta) errs.eta = 'Bắt buộc nhập thời gian đến (ETA)'
    if (!form.etd) errs.etd = 'Bắt buộc nhập thời gian rời (ETD)'
    if (form.eta && form.etd && new Date(form.eta) >= new Date(form.etd)) {
      errs.etd = 'Thời gian rời cảng (ETD) phải sau thời gian đến (ETA)'
    }
    if (!form.totalContainers || Number(form.totalContainers) <= 0) {
      errs.totalContainers = 'Số lượng container phải lớn hơn 0'
    }
    if (!form.shippingLine.trim()) errs.shippingLine = 'Bắt buộc nhập hãng tàu'
    return errs
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validateForm()
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return }

    if (editingVessel) {
      setVessels(prev => prev.map(v => v.id === editingVessel.id
        ? { ...v, ...form, totalContainers: Number(form.totalContainers) }
        : v))
      showToast(`✅ Đã cập nhật thành công lịch tàu ${form.vesselName}`)
    } else {
      const newV = {
        id: `VS-${Date.now()}`,
        ...form,
        totalContainers: Number(form.totalContainers),
        status: 'Lập Lịch',
        createdAt: new Date().toISOString(),
      }
      setVessels(prev => [newV, ...prev])
      showToast(`✅ Đã thêm mới thành công lịch tàu ${form.vesselName}`)
    }
    setShowFormDrawer(false)
  }

  const handleAssignBerth = () => {
    if (!selectedBerth || !detailVessel) return
    setVessels(prev => prev.map(v => v.id === detailVessel.id
      ? { ...v, berth: selectedBerth, status: v.status === 'Lập Lịch' || v.status === 'Đang Vào Cảng' ? 'Đã Cập Cầu' : v.status }
      : v))
    setDetailVessel(prev => ({
      ...prev,
      berth: selectedBerth,
      status: prev.status === 'Lập Lịch' || prev.status === 'Đang Vào Cảng' ? 'Đã Cập Cầu' : prev.status
    }))
    setShowAssignBerthModal(false)
    showToast(`⚓ Đã phân bổ thành công ${selectedBerth} cho tàu ${detailVessel.vesselName}`)
  }

  const handleCreateDischargePlan = () => {
    showToast(`📋 Đã tạo kế hoạch xếp dỡ (Discharge Plan) cho tàu ${detailVessel?.vesselName} — Chuyển thông tin đến bộ phận Điều độ bãi.`)
  }

  const setField = (k, v) => {
    setForm(p => ({ ...p, [k]: v }))
    if (formErrors[k]) setFormErrors(p => { const n = { ...p }; delete n[k]; return n })
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen relative">

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-slate-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-extrabold flex items-center gap-3 z-[100] animate-bounce border border-blue-500">
          <span className="text-blue-400">●</span>{toastMessage}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold bg-blue-100 text-blue-800 px-3 py-0.5 rounded-full uppercase">ĐIỀU ĐỘ CẢNG (DISPATCHER)</span>
            <span className="text-xs font-mono text-slate-600">Cảng Container Tiên Sa · Đà Nẵng</span>
          </div>
          <h2 className="font-heading text-3xl font-extrabold text-slate-900">Lịch Tàu Cập Cảng (Vessel Schedule)</h2>
          <p className="text-xs text-slate-600 mt-0.5">Tiếp nhận và quản lý thông tin lịch tàu đến/đi, thời gian ETA/ETD, phân bổ cầu cảng và kế hoạch xếp dỡ container.</p>
        </div>
        <button onClick={openAdd}
          className="h-11 px-6 bg-blue-100 hover:bg-blue-200 text-blue-950 border-2 border-blue-400 rounded-xl font-black text-sm shadow-xs flex items-center gap-2 shrink-0 cursor-pointer">
          <span className="material-symbols-outlined text-lg text-blue-800">add_circle</span>
          + Thêm Lịch Tàu Mới
        </button>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          ['Tàu Cập Trong Ngày', kpi.arrivingToday, 'text-blue-600', 'border-blue-300', 'directions_boat'],
          ['Tàu Đang Vào Cầu', kpi.berthingToday, 'text-amber-600', 'border-amber-300', 'anchor'],
          ['Đang Xếp Dỡ Hàng', kpi.discharging, 'text-purple-600', 'border-purple-300', 'forklift'],
          ['Đã Hoàn Tất Xử Lý', kpi.completed, 'text-green-600', 'border-green-300', 'check_circle'],
          ['Trễ Lịch Cập Cảng', kpi.delayed, 'text-red-600', 'border-red-300', 'warning'],
        ].map(([label, val, color, border, icon]) => (
          <div key={label} className={`bg-white rounded-2xl border-2 ${border} p-4 shadow-sm`}>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[10px] font-bold text-slate-600 uppercase leading-tight">{label}</span>
              <span className={`material-symbols-outlined text-sm ${color}`}>{icon}</span>
            </div>
            <div className={`text-3xl font-extrabold font-mono ${color}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* ── SEARCH & FILTER ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-sm">search</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm tên tàu, số IMO, hãng tàu..."
            className="w-full pl-9 pr-4 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-slate-900" />
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold flex-1">
          {[
            ['Trạng Thái', statusFilter, setStatusFilter, ['All', ...STATUSES]],
            ['Loại Hàng', cargoFilter, setCargoFilter, ['All', ...CARGO_TYPES]],
            ['Cầu Cảng', berthFilter, setBerthFilter, ['All', 'Chưa gán cầu', ...BERTHS]],
          ].map(([label, val, setter, opts]) => (
            <select key={label} value={val} onChange={e => setter(e.target.value)}
              className="px-3.5 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-900">
              {opts.map(o => <option key={o} value={o}>{o === 'All' ? `${label}: Tất cả` : o}</option>)}
            </select>
          ))}
          <span className="text-xs text-slate-600 self-center ml-auto font-mono">{filtered.length} tàu phù hợp</span>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                {['Tên Tàu & Hãng Tàu', 'Số IMO', 'Thời Gian Đến (ETA)', 'Thời Gian Rời (ETD)', 'Loại Hàng', 'Số Container (TEU)', 'Cầu Bến', 'Trạng Thái', 'Thao Tác'].map(h => (
                  <th key={h} className={`py-3.5 px-5 whitespace-nowrap ${h === 'Thao Tác' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr><td colSpan="9" className="py-16 text-center text-slate-600 font-bold text-sm">
                  <span className="material-symbols-outlined text-4xl block mb-2 text-slate-300">directions_boat</span>
                  Không tìm thấy chuyến tàu nào phù hợp với bộ lọc.
                </td></tr>
              ) : filtered.map(v => (
                <tr key={v.id} className="hover:bg-slate-100/60 cursor-pointer" onClick={() => { setDetailVessel(v); setShowFormDrawer(false) }}>
                  <td className="py-3.5 px-5">
                    <div className="font-extrabold text-slate-900">{v.vesselName}</div>
                    <div className="text-[10px] text-slate-600 font-normal font-mono">{v.shippingLine}</div>
                  </td>
                  <td className="py-3.5 px-5 font-mono font-bold text-slate-600">{v.imo}</td>
                  <td className="py-3.5 px-5 font-mono font-bold text-blue-800 whitespace-nowrap">{formatDateTime(v.eta)}</td>
                  <td className="py-3.5 px-5 font-mono font-bold text-purple-800 whitespace-nowrap">{formatDateTime(v.etd)}</td>
                  <td className="py-3.5 px-5">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                      v.cargoType.includes('Nguy Hiểm') ? 'bg-red-100 text-red-900 border border-red-300' :
                      v.cargoType.includes('Lạnh') ? 'bg-cyan-100 text-cyan-900 border border-cyan-300' :
                      'bg-slate-100 text-slate-800 border border-slate-300'
                    }`}>{v.cargoType}</span>
                  </td>
                  <td className="py-3.5 px-5 font-mono font-extrabold text-slate-900 text-center">{v.totalContainers} TEU</td>
                  <td className="py-3.5 px-5">
                    {v.berth
                      ? <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[10px] font-bold">{v.berth}</span>
                      : <span className="text-slate-500 text-[10px] font-bold italic">— Chưa gán cầu</span>}
                  </td>
                  <td className="py-3.5 px-5" onClick={e => e.stopPropagation()}><StatusBadge status={v.status} /></td>
                  <td className="py-3.5 px-5 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(v)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg font-bold text-[11px] text-slate-700 hover:bg-slate-100 hover:text-slate-900 flex items-center gap-1 cursor-pointer">
                        <span className="material-symbols-outlined text-xs">edit</span>Sửa
                      </button>
                      <button onClick={() => { setDetailVessel(v); setShowFormDrawer(false) }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer">
                        <span className="material-symbols-outlined text-xs">visibility</span>Xem
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── VESSEL DETAIL MODAL (CENTERED POPUP) ── */}
      {detailVessel && !showFormDrawer && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
          <div className="bg-white max-h-[92vh] w-full max-w-2xl rounded-3xl shadow-2xl overflow-y-auto font-sans border border-slate-200 flex flex-col animate-in zoom-in-95 duration-200">

            <div className="p-6 border-b border-slate-200 bg-slate-100/50">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-600 uppercase font-mono tracking-wider">CHI TIẾT CHUYẾN TÀU</span>
                  <h3 className="font-heading text-2xl font-extrabold text-slate-900 mt-0.5">{detailVessel.vesselName}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <StatusBadge status={detailVessel.status} />
                    <span className="text-[10px] font-mono text-slate-600 font-bold">{detailVessel.imo}</span>
                  </div>
                </div>
                <button onClick={() => setDetailVessel(null)} className="w-8 h-8 rounded-full bg-white border border-slate-300 flex items-center justify-center text-slate-600 hover:text-slate-900 shadow-sm">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 space-y-5 overflow-y-auto">

              <div className="space-y-2">
                <h4 className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider">THÔNG TIN TÀU CONTAINER</h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {[
                    ['Tên Tàu', detailVessel.vesselName],
                    ['Số IMO', detailVessel.imo],
                    ['Hãng Tàu (Carrier)', detailVessel.shippingLine],
                    ['Loại Tàu', detailVessel.vesselType],
                    ['Quốc Kỳ / Quốc Tịch', detailVessel.flag || '—'],
                  ].map(([k, val]) => (
                    <div key={k} className="bg-slate-100 p-3 rounded-xl border border-slate-200 col-span-1">
                      <div className="text-[10px] text-slate-600 uppercase mb-0.5 font-sans font-bold">{k}</div>
                      <div className="font-bold text-slate-900">{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider">LỊCH TRÌNH CẢNG (ETA / ETD)</h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                    <div className="text-[10px] text-blue-700 uppercase mb-0.5 font-sans font-bold">Giờ Đến Dự Kiến (ETA)</div>
                    <div className="font-extrabold text-blue-900">{formatDateTime(detailVessel.eta)}</div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
                    <div className="text-[10px] text-purple-700 uppercase mb-0.5 font-sans font-bold">Giờ Rời Dự Kiến (ETD)</div>
                    <div className="font-extrabold text-purple-900">{formatDateTime(detailVessel.etd)}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider">HÀNG HÓA & CONTAINER</h4>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  {[
                    ['Loại Hàng', detailVessel.cargoType],
                    ['Tổng Cont.', `${detailVessel.totalContainers} TEU`],
                    ['Cont. Dỡ (Import)', detailVessel.dischargeContainers ? `${detailVessel.dischargeContainers} TEU` : '—'],
                  ].map(([k, val]) => (
                    <div key={k} className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-600 uppercase mb-0.5 font-sans font-bold">{k}</div>
                      <div className="font-bold text-slate-900">{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider">CẦU BẾN THỰC ĐỊA</h4>
                <div className={`p-4 rounded-xl border-2 flex justify-between items-center ${detailVessel.berth ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                  <div>
                    <div className="text-[10px] text-slate-600 uppercase font-mono mb-0.5 font-bold">Cầu Cảng Đã Phân Bổ</div>
                    <div className={`font-extrabold text-sm ${detailVessel.berth ? 'text-amber-900' : 'text-slate-600'}`}>
                      {detailVessel.berth || 'Chưa được gán cầu bến'}
                    </div>
                  </div>
                  <span className={`material-symbols-outlined text-2xl ${detailVessel.berth ? 'text-amber-600' : 'text-slate-300'}`}>anchor</span>
                </div>
              </div>

              {detailVessel.notes && (
                <div className="space-y-1">
                  <h4 className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider">GHI CHÚ VẬN HÀNH</h4>
                  <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 text-xs text-slate-900">{detailVessel.notes}</div>
                </div>
              )}

            </div>

            <div className="p-5 border-t border-slate-200 bg-white space-y-2">
              <div className="text-[10px] font-extrabold text-slate-600 uppercase mb-2">THAO TÁC VẬN HÀNH</div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => openEdit(detailVessel)}
                  className="h-10 border border-slate-300 rounded-xl font-extrabold text-xs text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-1 cursor-pointer">
                  <span className="material-symbols-outlined text-sm">edit</span>Chỉnh Sửa
                </button>
                <button
                  onClick={() => { setSelectedBerth(detailVessel.berth || ''); setShowAssignBerthModal(true) }}
                  className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 cursor-pointer shadow">
                  <span className="material-symbols-outlined text-sm">anchor</span>Gán Cầu
                </button>
                <button onClick={handleCreateDischargePlan}
                  disabled={!detailVessel.berth}
                  className={`h-10 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1 cursor-pointer ${
                    detailVessel.berth ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow' : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}>
                  <span className="material-symbols-outlined text-sm">description</span>Lập Kế Hoạch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT FORM DRAWER ── */}
      {showFormDrawer && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
          <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-3xl shadow-2xl overflow-y-auto animate-in zoom-in-95 duration-200 font-sans flex flex-col">

            <div className="p-6 md:p-8 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">{editingVessel ? 'CẬP NHẬT LỊCH TÀU' : 'THÊM MỚI LỊCH TÀU CẬP CẢNG'}</span>
                  <h3 className="font-heading text-xl font-extrabold text-slate-900 mt-0.5">
                    {editingVessel ? editingVessel.vesselName : 'Thông tin lịch tàu mới'}
                  </h3>
                </div>
                <button onClick={() => setShowFormDrawer(false)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 md:p-8 space-y-5">

                <div className="space-y-3">
                  <h4 className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider">THÔNG TIN TÀU CONTAINER</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Tên Tàu Container *</label>
                      <input value={form.vesselName} onChange={e => setField('vesselName', e.target.value)}
                        placeholder="VD: MSC AURORA"
                        className={`w-full px-3.5 py-2.5 bg-slate-100 border rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 ${formErrors.vesselName ? 'border-red-400' : 'border-slate-300'}`} />
                      {formErrors.vesselName && <p className="text-red-600 text-[10px] mt-0.5 font-bold">{formErrors.vesselName}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Số IMO Tàu *</label>
                      <input value={form.imo} onChange={e => setField('imo', e.target.value)}
                        placeholder="IMO9812345" className={`w-full px-3.5 py-2.5 bg-slate-100 border rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900 ${formErrors.imo ? 'border-red-400' : 'border-slate-300'}`} />
                      {formErrors.imo && <p className="text-red-600 text-[10px] mt-0.5 font-bold">{formErrors.imo}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Hãng Tàu (Shipping Line) *</label>
                      <input value={form.shippingLine} onChange={e => setField('shippingLine', e.target.value)}
                        placeholder="VD: Maersk Line / MSC" className={`w-full px-3.5 py-2.5 bg-slate-100 border rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 ${formErrors.shippingLine ? 'border-red-400' : 'border-slate-300'}`} />
                      {formErrors.shippingLine && <p className="text-red-600 text-[10px] mt-0.5 font-bold">{formErrors.shippingLine}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Quốc Kỳ / Quốc Tịch Tàu</label>
                      <input value={form.flag} onChange={e => setField('flag', e.target.value)}
                        placeholder="VD: Panama / Liberia" className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900" />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Loại Tàu Container</label>
                      <select value={form.vesselType} onChange={e => setField('vesselType', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900">
                        {['Tàu Container Mẹ (Mother Vessel)', 'Tàu Container Chuyên Dụng', 'Tàu Gom (Feeder Vessel)'].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider">THỜI GIAN DỰ KIẾN (ETA / ETD)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Thời Gian Đến (ETA) *</label>
                      <input type="datetime-local" value={form.eta} onChange={e => setField('eta', e.target.value)}
                        className={`w-full px-3.5 py-2.5 bg-slate-100 border rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900 ${formErrors.eta ? 'border-red-400' : 'border-slate-300'}`} />
                      {formErrors.eta && <p className="text-red-600 text-[10px] mt-0.5 font-bold">{formErrors.eta}</p>}
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Thời Gian Rời (ETD) *</label>
                      <input type="datetime-local" value={form.etd} onChange={e => setField('etd', e.target.value)}
                        className={`w-full px-3.5 py-2.5 bg-slate-100 border rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900 ${formErrors.etd ? 'border-red-400' : 'border-slate-300'}`} />
                      {formErrors.etd && <p className="text-red-600 text-[10px] mt-0.5 font-bold">{formErrors.etd}</p>}
                    </div>
                  </div>
                  {form.eta && form.etd && new Date(form.eta) < new Date(form.etd) && (
                    <p className="text-green-700 text-[10px] font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">check_circle</span>
                      Thời gian hợp lệ — Khung thời gian làm hàng tại cảng: {Math.round((new Date(form.etd) - new Date(form.eta)) / 3600000)} giờ
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider">HÀNG HÓA & SỐ LƯỢNG CONTAINER</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Loại Hàng Container</label>
                      <select value={form.cargoType} onChange={e => setField('cargoType', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900">
                        {CARGO_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Tổng Container (TEU) *</label>
                      <input type="number" min="1" value={form.totalContainers} onChange={e => setField('totalContainers', e.target.value)}
                        placeholder="0" className={`w-full px-3.5 py-2.5 bg-slate-100 border rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900 ${formErrors.totalContainers ? 'border-red-400' : 'border-slate-300'}`} />
                      {formErrors.totalContainers && <p className="text-red-600 text-[10px] mt-0.5 font-bold">{formErrors.totalContainers}</p>}
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">Container Dỡ (Discharge)</label>
                      <input type="number" min="0" value={form.dischargeContainers} onChange={e => setField('dischargeContainers', e.target.value)}
                        placeholder="0" className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-extrabold text-slate-600 uppercase">Ghi Chú Vận Hành</label>
                  <textarea rows="3" value={form.notes} onChange={e => setField('notes', e.target.value)}
                    placeholder="Nhập ghi chú đặc biệt về thủ tục cảng vụ, luồng hoa tiêu, container lạnh hoặc hàng nguy hiểm..."
                    className="w-full p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-normal text-slate-900 focus:outline-none focus:border-slate-900 resize-none" />
                </div>
              </div>

              <div className="p-6 md:p-8 pt-0 flex gap-3">
                <button type="button" onClick={() => setShowFormDrawer(false)}
                  className="flex-1 h-11 border border-slate-300 text-slate-700 rounded-xl font-extrabold text-xs hover:bg-slate-100">Hủy</button>
                <button type="submit"
                  className="flex-1 h-11 bg-blue-600 text-white rounded-xl font-extrabold text-sm hover:bg-blue-700 shadow-md">
                  {editingVessel ? 'Lưu Thay Đổi' : 'Xác Nhận Thêm Tàu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ASSIGN BERTH MODAL ── */}
      {showAssignBerthModal && (
        <div className="fixed inset-0 bg-slate-900/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl text-blue-600">anchor</span>
              <h3 className="font-heading text-lg font-extrabold text-slate-900">Phân Bổ Cầu Cảng</h3>
            </div>
            <p className="text-xs text-slate-600">Chọn vị trí cầu bến cho tàu <strong>{detailVessel?.vesselName}</strong>.</p>
            <div className="grid grid-cols-1 gap-2">
              {BERTHS.map(b => (
                <button key={b} onClick={() => setSelectedBerth(b)}
                  className={`h-11 rounded-xl font-extrabold text-xs border-2 ${selectedBerth === b ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 border-slate-300 text-slate-900 hover:border-blue-400'}`}>
                  {b}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAssignBerthModal(false)} className="flex-1 h-11 border border-slate-300 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-100">Hủy</button>
              <button disabled={!selectedBerth} onClick={handleAssignBerth}
                className={`flex-1 h-11 rounded-xl font-extrabold text-sm ${selectedBerth ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                Xác Nhận Gán
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
