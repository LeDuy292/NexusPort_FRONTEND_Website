import React, { useState, useMemo, useEffect } from 'react'
import driverService from '../../services/driverService'

// ─── STATUS CONFIG ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  active: { label: 'Sẵn sàng', dot: 'bg-green-500', badge: 'bg-green-50 text-green-800 border-green-300', icon: '🟢' },
  inactive: { label: 'Tạm nghỉ', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-800 border-amber-300', icon: '🟡' },
  banned: { label: 'Đình chỉ', dot: 'bg-red-500', badge: 'bg-red-50 text-red-800 border-red-300', icon: '🔴' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.inactive
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
      {cfg.label}
    </span>
  )
}

function AvatarCircle({ driver }) {
  const color = driver.status === 'banned' ? 'bg-red-400' : driver.status === 'inactive' ? 'bg-amber-400' : 'bg-green-500'
  const nameParts = driver.fullName ? driver.fullName.trim().split(' ') : ['?']
  const initials = nameParts.length > 1
    ? nameParts[nameParts.length - 1].charAt(0) + nameParts[0].charAt(0)
    : nameParts[0].substring(0, 2)
  return <div className={`flex items-center justify-center text-white font-extrabold flex-shrink-0 uppercase ${color}`}>{initials}</div>
}

export default function DispatcherDriverManagement() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('') // '' means ALL
  const [currentPage, setCurrentPage] = useState(1)
  const [drawerDriver, setDrawerDriver] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [toast, setToast] = useState('')

  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)

  const [editForm, setEditForm] = useState(null)
  const PAGE_SIZE = 8

  const emptyForm = { fullName: '', phone: '', idCardNumber: '', licenseNumber: '' }
  const [form, setForm] = useState({ ...emptyForm })

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3200) }

  const loadDrivers = async () => {
    setLoading(true)
    try {
      const filters = {}
      if (statusFilter) filters.status = statusFilter
      if (search) filters.searchTerm = search
      const data = await driverService.getAllDrivers(filters)
      setDrivers(data)
    } catch (err) {
      showToast('❌ Lỗi tải danh sách tài xế: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDrivers()
  }, [search, statusFilter])

  const kpi = useMemo(() => ({
    total: drivers.length,
    active: drivers.filter(d => d.status === 'active').length,
    inactive: drivers.filter(d => d.status === 'inactive').length,
    banned: drivers.filter(d => d.status === 'banned').length,
  }), [drivers])

  const totalPages = Math.max(1, Math.ceil(drivers.length / PAGE_SIZE))
  const paginated = drivers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const openAddModal = () => {
    setForm({ ...emptyForm })
    setShowAddModal(true)
  }

  const handleAddDriver = async (e) => {
    e.preventDefault()
    if (!form.fullName.trim() || !form.phone.trim() || !form.licenseNumber.trim() || !form.idCardNumber.trim()) {
      showToast('⚠️ Vui lòng nhập đầy đủ các thông tin bắt buộc (*)!')
      return
    }

    const phoneRegex = /^(03|05|07|08|09)\d{8}$/
    if (!phoneRegex.test(form.phone.trim())) {
      showToast('⚠️ Số điện thoại không hợp lệ (Bắt đầu bằng 03/05/07/08/09 và đủ 10 số)!')
      return
    }

    const idCardRegex = /^\d{12}$/
    if (!idCardRegex.test(form.idCardNumber.trim())) {
      showToast('⚠️ Số CCCD phải bao gồm đúng 12 chữ số!')
      return
    }

    try {
      const user = JSON.parse(localStorage.getItem('user')) || {}
      await driverService.createDriver(form, user.carrierId)
      setShowAddModal(false)
      showToast(`✅ Đã tạo thành công hồ sơ tài xế ${form.fullName}!`)
      loadDrivers()
    } catch (err) {
      showToast('❌ Lỗi tạo tài xế: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    try {
      await driverService.updateDriver(editForm.id, {
        fullName: editForm.fullName,
        phone: editForm.phone,
        idCardNumber: editForm.idCardNumber
      })
      if (drawerDriver.status !== editForm.status) {
        await driverService.toggleStatus(editForm.id, editForm.status)
      }
      setEditMode(false)
      showToast(`✅ Đã cập nhật hồ sơ tài xế ${editForm.fullName}!`)
      loadDrivers()
      setDrawerDriver({ ...editForm })
    } catch (err) {
      showToast('❌ Lỗi cập nhật: ' + (err.response?.data?.message || err.message))
    }
  }

  const openDrawer = (drv) => { setDrawerDriver(drv); setEditMode(false); setEditForm({ ...drv }) }

  const KPI_CARDS = [
    { label: 'Tổng Tài Xế', value: kpi.total, border: 'border-slate-300', icon: 'group', text: 'text-carbon' },
    { label: 'Sẵn Sàng', value: kpi.active, border: 'border-green-400', icon: 'check_circle', text: 'text-green-700' },
    { label: 'Tạm Nghỉ', value: kpi.inactive, border: 'border-amber-400', icon: 'bedtime', text: 'text-amber-700' },
    { label: 'Đình Chỉ', value: kpi.banned, border: 'border-red-400', icon: 'block', text: 'text-red-700' },
  ]

  return (
    <div className="p-8 w-full font-sans flex flex-col gap-6 relative min-h-full bg-mist">

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-8 z-[100] bg-white border border-signal-orange shadow-2xl px-5 py-3 rounded-xl text-sm font-bold text-carbon flex items-center gap-3">
          <span className="text-signal-orange">●</span>{toast}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase tracking-wider">Transport Management</span>
            <span className="text-[10px] text-slate font-mono">NexusPort · Cảng Tiên Sa · Đà Nẵng</span>
          </div>
          <h2 className="font-heading text-3xl text-carbon font-extrabold mt-0.5">Quản Lý Tài Xế</h2>
          <p className="text-xs text-slate mt-0.5">Theo dõi và quản lý đội tài xế phục vụ vận chuyển container.</p>
        </div>
        <button onClick={openAddModal}
          className="h-11 px-5 bg-signal-orange text-white rounded-xl font-extrabold text-xs hover:opacity-95 transition-opacity shadow-lg flex items-center gap-2 flex-shrink-0">
          <span className="material-symbols-outlined text-lg">person_add</span>+ Thêm Tài Xế Mới
        </button>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {KPI_CARDS.map(k => (
          <div key={k.label} className={`bg-white rounded-xl p-4 border-l-4 ${k.border} border border-chalk shadow-sm flex flex-col gap-1`}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate uppercase tracking-wider leading-tight">{k.label}</span>
              <span className={`material-symbols-outlined text-[18px] ${k.text} opacity-60`}>{k.icon}</span>
            </div>
            <span className={`text-3xl font-extrabold font-heading ${k.text}`}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* ── SEARCH & FILTERS ── */}
      <div className="bg-white rounded-xl border border-chalk shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate text-[18px]">search</span>
          <input type="text" value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
            placeholder="Tìm theo tên, mã TX, GPLX, số điện thoại..."
            className="w-full pl-9 pr-4 h-9 border border-chalk rounded-lg text-xs text-carbon placeholder-slate focus:outline-none focus:border-signal-orange bg-fog"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {[['', 'Tất cả'], ['active', '🟢 Sẵn sàng'], ['inactive', '🟡 Tạm nghỉ'], ['banned', '🔴 Đình chỉ']].map(([val, lbl]) => (
            <button key={val} onClick={() => { setStatusFilter(val); setCurrentPage(1) }}
              className={`px-3 h-8 rounded-lg text-[11px] font-semibold border transition-all ${statusFilter === val ? 'bg-signal-orange text-white border-signal-orange' : 'bg-fog text-graphite border-chalk hover:border-slate'}`}>
              {lbl}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate ml-auto">{drivers.length} tài xế</span>
      </div>

      {/* ── DRIVER TABLE ── */}
      <div className="bg-white rounded-xl border border-chalk shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-fog border-b border-chalk text-[10px] uppercase text-slate font-bold tracking-wider">
                <th className="px-5 py-3 text-left">Tài Xế</th>
                <th className="px-4 py-3 text-left">GPLX</th>
                <th className="px-4 py-3 text-left">CCCD</th>
                <th className="px-4 py-3 text-left">Điện Thoại</th>
                <th className="px-4 py-3 text-left">Ngày Tạo</th>
                <th className="px-4 py-3 text-left">Trạng Thái</th>
                <th className="px-4 py-3 text-left">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk">
              {loading ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate">Đang tải dữ liệu...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-slate">
                    <span className="material-symbols-outlined text-[48px] opacity-30">manage_accounts</span>
                    <div className="font-bold text-carbon text-sm">Không tìm thấy tài xế nào</div>
                    <p className="text-xs">Thử thay đổi bộ lọc hoặc từ khoá tìm kiếm.</p>
                  </div>
                </td></tr>
              ) : paginated.map(drv => (
                <tr key={drv.id} className="hover:bg-fog/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full text-[11px]"><AvatarCircle driver={drv} /></div>
                      <div>
                        <div className="font-bold text-carbon">{drv.fullName}</div>
                        <div className="text-[10px] text-slate font-mono">{drv.id.substring(0, 8).toUpperCase()}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-carbon">{drv.licenseNumber}</td>
                  <td className="px-4 py-3.5 font-mono text-carbon">{drv.idCardNumber}</td>
                  <td className="px-4 py-3.5 text-graphite">{drv.phone}</td>
                  <td className="px-4 py-3.5 text-slate text-[11px]">{new Date(drv.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3.5"><StatusBadge status={drv.status} /></td>
                  <td className="px-4 py-3.5">
                    <button onClick={() => openDrawer(drv)}
                      className="px-3 py-1.5 bg-fog border border-chalk rounded-lg text-[11px] font-semibold text-graphite hover:border-signal-orange hover:text-signal-orange transition-all">
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-chalk flex items-center justify-between bg-fog text-xs">
            <span className="text-slate">Trang {currentPage}/{totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white border border-chalk rounded-lg font-semibold disabled:opacity-40">‹ Trước</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
                <button key={pg} onClick={() => setCurrentPage(pg)}
                  className={`w-8 h-8 rounded-lg font-bold border transition-all ${pg === currentPage ? 'bg-signal-orange text-white border-signal-orange' : 'bg-white border-chalk hover:border-slate'}`}>{pg}</button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white border border-chalk rounded-lg font-semibold disabled:opacity-40">Sau ›</button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ DRIVER DETAIL DRAWER ═══ */}
      {drawerDriver && (
        <>
          <div className="fixed inset-0 bg-carbon/30 z-40 backdrop-blur-sm" onClick={() => setDrawerDriver(null)} />
          <div className="fixed right-0 top-0 h-full w-[420px] bg-white z-50 shadow-2xl border-l border-chalk overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-chalk bg-fog flex-shrink-0">
              <div>
                <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">Hồ Sơ Tài Xế</span>
                <h3 className="font-heading text-lg font-extrabold text-carbon">{drawerDriver.fullName}</h3>
              </div>
              <div className="flex gap-2">
                {!editMode && (
                  <button onClick={() => setEditMode(true)}
                    className="px-3 py-1.5 bg-white border border-chalk rounded-lg text-xs font-semibold text-graphite hover:border-signal-orange hover:text-signal-orange transition-all">
                    ✏ Chỉnh sửa
                  </button>
                )}
                <button onClick={() => setDrawerDriver(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-mist text-slate hover:text-carbon">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {editMode ? (
                <form onSubmit={handleSaveEdit} className="space-y-4">
                  {[['Họ và Tên', 'fullName'], ['Số điện thoại', 'phone'], ['CCCD', 'idCardNumber'], ['Số GPLX (Không sửa được)', 'licenseNumber']].map(([label, field]) => (
                    <div key={field}>
                      <label className="block text-[10px] font-bold text-slate uppercase mb-1">{label}</label>
                      <input type="text" value={editForm[field] || ''} onChange={e => field !== 'licenseNumber' && setEditForm(f => ({ ...f, [field]: e.target.value }))}
                        readOnly={field === 'licenseNumber'}
                        className={`w-full px-3 h-9 border border-chalk rounded-lg text-xs text-carbon focus:outline-none focus:border-signal-orange ${field === 'licenseNumber' ? 'bg-fog cursor-not-allowed opacity-70' : 'bg-white'}`} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Trạng Thái</label>
                    <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 h-9 border border-chalk rounded-lg text-xs text-carbon focus:outline-none focus:border-signal-orange bg-white">
                      {Object.entries(STATUS_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.icon} {cfg.label}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button type="button" onClick={() => setEditMode(false)}
                      className="flex-1 h-9 border border-chalk rounded-lg text-xs font-semibold text-graphite hover:bg-fog">Hủy</button>
                    <button type="submit"
                      className="flex-1 h-9 bg-signal-orange text-white rounded-lg text-xs font-extrabold hover:opacity-90 shadow">Lưu Thay Đổi</button>
                  </div>
                </form>
              ) : (
                <>
                  <section className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl text-xl"><AvatarCircle driver={drawerDriver} /></div>
                      <div>
                        <div className="font-extrabold text-carbon text-base">{drawerDriver.fullName}</div>
                        <div className="text-xs text-slate font-mono">{drawerDriver.id}</div>
                        <div className="mt-1"><StatusBadge status={drawerDriver.status} /></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs mt-4">
                      {[['Số GPLX', drawerDriver.licenseNumber], ['Số CCCD', drawerDriver.idCardNumber], ['Điện Thoại', drawerDriver.phone], ['Ngày Tạo', new Date(drawerDriver.createdAt).toLocaleDateString()]].map(([l, v]) => (
                        <div key={l} className="bg-fog rounded-lg p-3 border border-chalk">
                          <div className="text-[10px] font-bold text-slate uppercase mb-0.5">{l}</div>
                          <div className="font-bold text-carbon">{v}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══ ADD DRIVER MODAL ═══ */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 bg-carbon/40 z-50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-chalk w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-chalk">
                <div>
                  <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">Quản lý</span>
                  <h3 className="font-heading text-lg font-extrabold text-carbon">Tạo Hồ Sơ Tài Xế Mới</h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-fog text-slate hover:text-carbon">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <form onSubmit={handleAddDriver} className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Họ và Tên <span className="text-red-500">*</span></label>
                    <input type="text" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required placeholder="VD: Nguyễn Văn A"
                      className="w-full px-3 h-9 border border-chalk rounded-lg text-xs focus:outline-none focus:border-signal-orange bg-white text-carbon placeholder-slate" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Điện Thoại <span className="text-red-500">*</span></label>
                    <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required placeholder="090xxxxxxx"
                      className="w-full px-3 h-9 border border-chalk rounded-lg text-xs focus:outline-none focus:border-signal-orange bg-white text-carbon placeholder-slate" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Số CCCD <span className="text-red-500">*</span></label>
                    <input type="text" value={form.idCardNumber} onChange={e => setForm(f => ({ ...f, idCardNumber: e.target.value }))} required placeholder="048xxxxxxx"
                      className="w-full px-3 h-9 border border-chalk rounded-lg text-xs focus:outline-none focus:border-signal-orange bg-white text-carbon placeholder-slate" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Số GPLX <span className="text-red-500">*</span></label>
                    <input type="text" value={form.licenseNumber} onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))} required placeholder="FC-xxxxx"
                      className="w-full px-3 h-9 border border-chalk rounded-lg text-xs focus:outline-none focus:border-signal-orange bg-white text-carbon placeholder-slate" />
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <button type="button" onClick={() => setShowAddModal(false)}
                    className="flex-1 h-10 border border-chalk rounded-xl text-xs font-semibold text-graphite hover:bg-fog">Hủy</button>
                  <button type="submit"
                    className="flex-1 h-10 bg-signal-orange text-white rounded-xl text-xs font-extrabold hover:opacity-90 shadow-md">Tạo Tài Xế</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
