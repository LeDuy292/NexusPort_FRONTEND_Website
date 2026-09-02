import React, { useState, useEffect } from 'react'
import driverService from '../../services/driverService'

const STATUS_CONFIG = {
  active: { label: 'Sẵn sàng hoạt động', color: 'bg-green-600 text-white' },
  inactive: { label: 'Tạm nghỉ / Bận', color: 'bg-amber-100 text-amber-800 border border-amber-200' },
  banned: { label: 'Đã bị đình chỉ', color: 'bg-red-100 text-red-800 border border-red-200' },
}

export default function DriverManagement() {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('drivers')
  const [selectedDriver, setSelectedDriver] = useState(null)

  const [toastMessage, setToastMessage] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const emptyForm = { fullName: '', phone: '', idCardNumber: '', licenseNumber: '' }
  const [form, setForm] = useState({ ...emptyForm })
  const [editForm, setEditForm] = useState(null)

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  const loadDrivers = async () => {
    setLoading(true)
    try {
      // Backend automatically filters by carrierId if logged in as Carrier Admin
      const data = await driverService.getAllDrivers({})
      setDrivers(data)
      if (data.length > 0 && !selectedDriver) {
        setSelectedDriver(data[0])
      } else if (selectedDriver) {
        // Refresh selected driver data
        const updated = data.find(d => d.id === selectedDriver.id)
        if (updated) setSelectedDriver(updated)
      }
    } catch (err) {
      showToast('❌ Lỗi tải danh sách tài xế: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDrivers()
    // eslint-disable-next-line
  }, [])

  const handleContact = (driverName) => {
    showToast(`📞 Đã kết nối tổng đài gọi tài xế: ${driverName}!`)
  }

  const handleAddDriver = async (e) => {
    e.preventDefault()
    if (!form.fullName.trim() || !form.phone.trim() || !form.licenseNumber.trim() || !form.idCardNumber.trim()) {
      showToast('⚠️ Vui lòng nhập đầy đủ các thông tin bắt buộc!')
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
      await driverService.createDriver(form)
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
      if (selectedDriver.status !== editForm.status) {
        await driverService.toggleStatus(editForm.id, editForm.status)
      }
      setEditMode(false)
      showToast(`✅ Đã cập nhật hồ sơ tài xế ${editForm.fullName}!`)
      loadDrivers()
    } catch (err) {
      showToast('❌ Lỗi cập nhật: ' + (err.response?.data?.message || err.message))
    }
  }

  const openDriverDetails = (drv) => {
    setSelectedDriver(drv)
    setEditMode(false)
    setEditForm({ ...drv })
  }

  return (
    <div className="p-8 w-full font-sans flex flex-col lg:flex-row gap-8 relative items-start">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-8 bg-[#202020] text-white px-6 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 z-[100] animate-bounce border border-signal-orange">
          <span className="text-signal-orange">●</span>
          {toastMessage}
        </div>
      )}

      {/* LEFT MAIN AREA */}
      <div className="flex-1 space-y-6 w-full">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-chalk pb-6">
          <div>
            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase">
              Fleet & Workforce
            </span>
            <h2 className="font-heading text-4xl text-carbon font-bold mt-1">Quản lý Đội ngũ Tài xế</h2>
            <p className="text-sm text-slate mt-1">Giám sát và phân công công việc cho đội ngũ tài xế của công ty.</p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <button onClick={() => { setForm({ ...emptyForm }); setShowAddModal(true) }}
              className="h-9 px-4 bg-carbon text-white rounded-lg font-bold text-xs hover:bg-black transition-colors flex items-center gap-2 shadow-sm">
              <span className="material-symbols-outlined text-sm">person_add</span> Thêm Tài Xế Mới
            </button>
            {/* View Tabs */}
            <div className="flex bg-white rounded-lg p-1 border border-chalk shadow-sm text-xs font-bold">
              {['drivers', 'vehicles', 'schedules'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-md transition-colors ${activeTab === tab ? 'bg-fog text-carbon border border-chalk' : 'text-slate hover:text-carbon'
                    }`}
                >
                  {tab === 'drivers' ? 'Tài xế' : tab === 'vehicles' ? 'Phương tiện' : 'Lịch trình'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TAB CONTENT: DRIVERS GRID */}
        {activeTab === 'drivers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-200">
            {loading ? (
              <div className="col-span-full py-12 text-center text-slate font-bold">Đang tải danh sách tài xế...</div>
            ) : drivers.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate border-2 border-dashed border-chalk rounded-xl">
                Bạn chưa có tài xế nào trong danh sách. Hãy thêm mới!
              </div>
            ) : drivers.map((d) => {
              const isSelected = selectedDriver?.id === d.id
              const nameParts = d.fullName ? d.fullName.trim().split(' ') : ['?']
              const initials = nameParts.length > 1
                ? nameParts[nameParts.length - 1].charAt(0) + nameParts[0].charAt(0)
                : nameParts[0].substring(0, 2).toUpperCase()

              const statusCfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.inactive

              return (
                <div
                  key={d.id}
                  onClick={() => openDriverDetails(d)}
                  className={`bg-white rounded-xl p-6 shadow-sm border transition-all cursor-pointer flex flex-col justify-between space-y-4 hover:shadow-md ${isSelected ? 'border-2 border-carbon ring-1 ring-carbon/10' : 'border-chalk hover:border-slate'
                    }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-sm uppercase ${d.status === 'banned' ? 'bg-red-400' : d.status === 'inactive' ? 'bg-amber-400' : 'bg-carbon'}`}>
                        {initials}
                      </div>
                      <div>
                        <h3 className="font-bold text-carbon text-base">{d.fullName}</h3>
                        <p className="text-[10px] font-mono text-slate mt-0.5">{d.licenseNumber}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </div>

                  <div className="pt-4 border-t border-chalk flex justify-between items-center text-xs">
                    <div>
                      <span className="text-slate block text-[10px] uppercase font-bold">Điện Thoại</span>
                      <strong className="text-carbon">{d.phone}</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-slate block text-[10px] uppercase font-bold">CCCD</span>
                      <strong className="text-carbon">{d.idCardNumber}</strong>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* OTHER TABS PLACEHOLDER */}
        {(activeTab === 'vehicles' || activeTab === 'schedules') && (
          <div className="bg-white border border-chalk rounded-xl p-12 text-center text-slate space-y-2 animate-in fade-in duration-200">
            <span className="material-symbols-outlined text-4xl text-slate">local_shipping</span>
            <h4 className="font-bold text-carbon text-lg">Danh mục Phương tiện & Lịch trình đang hoạt động</h4>
            <p className="text-xs">Dữ liệu xe đầu kéo và sơ đồ phân ca kíp được đồng bộ trực tiếp từ trạm điều hành cảng.</p>
          </div>
        )}

      </div>

      {/* ═══ SELECTED DRIVER MODAL ═══ */}
      {selectedDriver && activeTab === 'drivers' && (
        <>
          <div className="fixed inset-0 bg-carbon/40 z-[60] backdrop-blur-sm" onClick={() => setSelectedDriver(null)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-chalk w-full max-w-md animate-in zoom-in-95 duration-200 p-6 space-y-6" onClick={e => e.stopPropagation()}>

              {/* Profile Header */}
              <div className="flex justify-between items-start border-b border-chalk pb-5">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base uppercase ${selectedDriver.status === 'banned' ? 'bg-red-400' : selectedDriver.status === 'inactive' ? 'bg-amber-400' : 'bg-carbon'}`}>
                    {selectedDriver.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-carbon">{selectedDriver.fullName}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold mt-1 ${STATUS_CONFIG[selectedDriver.status]?.color || ''}`}>
                      {STATUS_CONFIG[selectedDriver.status]?.label || selectedDriver.status}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!editMode && (
                    <button onClick={() => { setEditForm({ ...selectedDriver }); setEditMode(true); }} className="text-slate hover:text-signal-orange">
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                  )}
                  <button onClick={() => setSelectedDriver(null)} className="text-slate hover:text-carbon">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
              </div>

              {editMode ? (
                <form onSubmit={handleSaveEdit} className="space-y-4">
                  {[['Họ và Tên', 'fullName'], ['Số điện thoại', 'phone'], ['Số CCCD', 'idCardNumber'], ['Số GPLX (Không sửa)', 'licenseNumber']].map(([label, field]) => (
                    <div key={field}>
                      <label className="block text-[10px] font-bold text-slate uppercase mb-1">{label}</label>
                      <input type="text" value={editForm[field] || ''} onChange={e => field !== 'licenseNumber' && setEditForm(f => ({ ...f, [field]: e.target.value }))}
                        readOnly={field === 'licenseNumber'}
                        className={`w-full px-3 h-10 border border-chalk rounded-md text-xs text-carbon focus:outline-none focus:border-carbon ${field === 'licenseNumber' ? 'bg-fog cursor-not-allowed opacity-70' : 'bg-white'}`} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Trạng Thái</label>
                    <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 h-10 border border-chalk rounded-md text-xs text-carbon focus:outline-none focus:border-carbon bg-white">
                      {Object.entries(STATUS_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-4 border-t border-chalk">
                    <button type="button" onClick={() => setEditMode(false)}
                      className="flex-1 h-11 border border-chalk rounded-xl text-xs font-bold text-graphite hover:bg-fog">Hủy</button>
                    <button type="submit"
                      className="flex-1 h-11 bg-carbon text-white rounded-xl text-xs font-bold hover:bg-black shadow">Lưu Thay Đổi</button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Contact & ID Info */}
                  <div className="space-y-4 text-xs border-b border-chalk pb-5">
                    <h4 className="text-[10px] font-bold text-slate uppercase tracking-wider">THÔNG TIN HỒ SƠ</h4>
                    <div className="flex justify-between">
                      <span className="text-slate">Số điện thoại</span>
                      <strong className="text-carbon font-mono">{selectedDriver.phone}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate">Số CCCD</span>
                      <strong className="text-carbon font-mono">{selectedDriver.idCardNumber}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate">Giấy phép lái xe</span>
                      <strong className="text-carbon font-mono">{selectedDriver.licenseNumber}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate">Ngày thêm vào hệ thống</span>
                      <strong className="text-carbon">{new Date(selectedDriver.createdAt).toLocaleDateString()}</strong>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2">
                    <button
                      onClick={() => handleContact(selectedDriver.fullName)}
                      className="w-full py-3 px-4 rounded-xl bg-signal-orange text-white font-bold text-xs hover:bg-orange-600 transition-colors shadow flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px]">call</span>
                      Liên hệ khẩn cấp
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </>
      )}

      {/* ═══ ADD DRIVER MODAL ═══ */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 bg-carbon/40 z-[60] backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-chalk w-full max-w-md animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-chalk">
                <div>
                  <h3 className="font-heading text-lg font-bold text-carbon">Thêm Tài Xế Mới</h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-fog text-slate hover:text-carbon">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <form onSubmit={handleAddDriver} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate uppercase mb-1">Họ và Tên <span className="text-red-500">*</span></label>
                  <input type="text" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required placeholder="VD: Nguyễn Văn A"
                    className="w-full px-3 h-10 border border-chalk rounded-lg text-xs focus:outline-none focus:border-carbon bg-white text-carbon" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Điện Thoại <span className="text-red-500">*</span></label>
                    <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required placeholder="090..."
                      className="w-full px-3 h-10 border border-chalk rounded-lg text-xs focus:outline-none focus:border-carbon bg-white text-carbon" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Số CCCD <span className="text-red-500">*</span></label>
                    <input type="text" value={form.idCardNumber} onChange={e => setForm(f => ({ ...f, idCardNumber: e.target.value }))} required placeholder="048..."
                      className="w-full px-3 h-10 border border-chalk rounded-lg text-xs focus:outline-none focus:border-carbon bg-white text-carbon" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate uppercase mb-1">Số GPLX <span className="text-red-500">*</span></label>
                  <input type="text" value={form.licenseNumber} onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))} required placeholder="FC-xxxxx"
                    className="w-full px-3 h-10 border border-chalk rounded-lg text-xs focus:outline-none focus:border-carbon bg-white text-carbon" />
                </div>

                <div className="flex gap-2 pt-4 border-t border-chalk">
                  <button type="button" onClick={() => setShowAddModal(false)}
                    className="flex-1 h-11 border border-chalk rounded-xl text-xs font-bold text-graphite hover:bg-fog">Hủy</button>
                  <button type="submit"
                    className="flex-1 h-11 bg-carbon text-white rounded-xl text-xs font-bold hover:bg-black shadow-md transition-colors">Lưu Tài Xế</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
