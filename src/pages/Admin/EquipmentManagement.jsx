import React, { useState, useMemo } from 'react'

// Mock initial equipment data
const INITIAL_EQUIPMENT = [
  { id: 'STS-01', name: 'Cẩu bờ STS 01', type: 'STS Crane', zone: 'Berth 01', status: 'Đang hoạt động', hours: 4250, lastMaint: '2026-05-10', nextMaint: '2026-11-10', manufacturer: 'ZPMC', capacity: '65 Tấn', year: 2021 },
  { id: 'STS-02', name: 'Cẩu bờ STS 02', type: 'STS Crane', zone: 'Berth 02', status: 'Đang hoạt động', hours: 3890, lastMaint: '2026-06-01', nextMaint: '2026-12-01', manufacturer: 'ZPMC', capacity: '65 Tấn', year: 2021 },
  { id: 'RTG-01', name: 'Cẩu giàn RTG 01', type: 'RTG', zone: 'Block B', status: 'Idle', hours: 6120, lastMaint: '2026-07-15', nextMaint: '2027-01-15', manufacturer: 'Konecranes', capacity: '40 Tấn', year: 2019 },
  { id: 'RTG-02', name: 'Cẩu giàn RTG 02', type: 'RTG', zone: 'Block B', status: 'Đang hoạt động', hours: 5980, lastMaint: '2026-07-20', nextMaint: '2027-01-20', manufacturer: 'Konecranes', capacity: '40 Tấn', year: 2019 },
  { id: 'RTG-03', name: 'Cẩu giàn RTG 03', type: 'RTG', zone: 'Block C', status: 'Bảo trì', hours: 7850, lastMaint: '2026-08-01', nextMaint: '2026-08-15', manufacturer: 'Konecranes', capacity: '40 Tấn', year: 2018 },
  { id: 'RS-01', name: 'Xe nâng Reach Stacker 01', type: 'Reach Stacker', zone: 'Block D', status: 'Đang hoạt động', hours: 3100, lastMaint: '2026-04-12', nextMaint: '2026-10-12', manufacturer: 'Kalmar', capacity: '45 Tấn', year: 2020 },
  { id: 'RS-02', name: 'Xe nâng Reach Stacker 02', type: 'Reach Stacker', zone: 'Block E', status: 'Offline', hours: 4200, lastMaint: '2026-03-05', nextMaint: '2026-09-05', manufacturer: 'Kalmar', capacity: '45 Tấn', year: 2020 },
  { id: 'ITV-01', name: 'Xe đầu kéo cảng ITV 01', type: 'ITV', zone: 'Roadway In', status: 'Đang hoạt động', hours: 9200, lastMaint: '2026-05-18', nextMaint: '2026-08-18', manufacturer: 'Terberg', capacity: '80 Tấn', year: 2017 },
  { id: 'ITV-02', name: 'Xe đầu kéo cảng ITV 02', type: 'ITV', zone: 'Roadway Out', status: 'Lỗi', hours: 8750, lastMaint: '2026-06-25', nextMaint: '2026-09-25', manufacturer: 'Terberg', capacity: '80 Tấn', year: 2017 },
  { id: 'MCR-01', name: 'Cẩu di động Mobile Crane 01', type: 'Mobile Crane', zone: 'General Yard', status: 'Idle', hours: 2150, lastMaint: '2026-07-02', nextMaint: '2027-01-02', manufacturer: 'Liebherr', capacity: '100 Tấn', year: 2022 }
]

export default function EquipmentManagement() {
  const [equipment, setEquipment] = useState(INITIAL_EQUIPMENT)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('Tất cả')
  const [selectedEquip, setSelectedEquip] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Form State for new equipment
  const [newEquip, setNewEquip] = useState({
    id: '',
    name: '',
    type: 'STS Crane',
    zone: 'Berth 01',
    manufacturer: '',
    capacity: '',
    year: new Date().getFullYear()
  })

  // KPI Calculations
  const kpis = useMemo(() => {
    return {
      total: equipment.length,
      active: equipment.filter(e => e.status === 'Đang hoạt động').length,
      maintenance: equipment.filter(e => e.status === 'Bảo trì').length,
      offline: equipment.filter(e => e.status === 'Offline').length,
      alert: equipment.filter(e => e.status === 'Lỗi').length
    }
  }, [equipment])

  // Filtered Equipment
  const filteredEquipment = useMemo(() => {
    return equipment.filter(e => {
      const matchSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          e.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.zone.toLowerCase().includes(searchTerm.toLowerCase())
      const matchType = typeFilter === 'Tất cả' || e.type === typeFilter
      return matchSearch && matchType
    })
  }, [equipment, searchTerm, typeFilter])

  // Actions
  const handleMaintenance = (id) => {
    setEquipment(prev => prev.map(e => e.id === id ? { ...e, status: 'Bảo trì' } : e))
    showToast('🔧 Đã ghi nhận thiết bị vào chế độ Bảo dưỡng kỹ thuật.')
    if (selectedEquip && selectedEquip.id === id) {
      setSelectedEquip(prev => ({ ...prev, status: 'Bảo trì' }))
    }
  }

  const handleActivate = (id) => {
    setEquipment(prev => prev.map(e => e.id === id ? { ...e, status: 'Đang hoạt động' } : e))
    showToast('🔓 Đã khôi phục hoạt động cho thiết bị!')
    if (selectedEquip && selectedEquip.id === id) {
      setSelectedEquip(prev => ({ ...prev, status: 'Đang hoạt động' }))
    }
  }

  const handleAddEquipment = (e) => {
    e.preventDefault()
    if (!newEquip.id || !newEquip.name || !newEquip.manufacturer || !newEquip.capacity) {
      showToast('❌ Vui lòng cung cấp đầy đủ thông số đăng kiểm thiết bị!')
      return
    }

    const equip = {
      id: newEquip.id.toUpperCase(),
      name: newEquip.name,
      type: newEquip.type,
      zone: newEquip.zone,
      status: 'Idle',
      hours: 0,
      lastMaint: new Date().toISOString().split('T')[0],
      nextMaint: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 6 months later
      manufacturer: newEquip.manufacturer,
      capacity: newEquip.capacity,
      year: Number(newEquip.year)
    }

    setEquipment(prev => [...prev, equip])
    setShowAddModal(false)
    setNewEquip({ id: '', name: '', type: 'STS Crane', zone: 'Berth 01', manufacturer: '', capacity: '', year: new Date().getFullYear() })
    showToast('➕ Đã tạo mới thông tin thiết bị cảng thành công!')
  }

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  return (
    <div className="p-6 space-y-6">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-carbon text-white px-5 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 z-50 border border-signal-orange animate-bounce">
          <span className="text-signal-orange">●</span>
          {toastMessage}
        </div>
      )}

      {/* Warning business rule banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex gap-3 text-xs text-orange-800">
        <span className="material-symbols-outlined text-signal-orange text-lg">precision_manufacturing</span>
        <div>
          <strong className="font-bold">Lưu ý quản lý nguồn lực cơ giới:</strong> Phân hệ này dùng để quản lý hồ sơ đăng kiểm cơ giới cảng và lên lịch kiểm định kỹ thuật (Bảo trì dự phòng). Việc ra lệnh xếp cont thực địa, phân cẩu giàn STS cho tàu hoặc điều động xe nâng bãi làm việc thuộc về thẩm quyền điều phối của **Điều độ trung tâm (Dispatcher Control Center)**.
        </div>
      </div>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-carbon font-heading">Quản lý Thiết bị</h2>
          <p className="text-xs text-slate mt-1">Cấu hình danh mục máy móc cơ giới, giám sát thời gian chạy máy kỹ thuật và lên lịch bảo trì định kỳ.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-signal-orange text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors shadow-md flex items-center justify-center gap-2 self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-sm">settings_suggest</span>
          THÊM THIẾT BỊ
        </button>
      </div>

      {/* KPI STATS CARD GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI: Total */}
        <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <span className="text-[9px] font-bold text-slate uppercase tracking-wider block">TỔNG THIẾT BỊ</span>
          <div className="text-2xl font-extrabold text-carbon font-mono">{kpis.total} máy</div>
          <div className="text-[9px] text-slate font-medium">Danh mục cơ giới cảng</div>
        </div>

        {/* KPI: Active */}
        <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <span className="text-[9px] font-bold text-slate uppercase tracking-wider block">ĐANG HOẠT ĐỘNG</span>
          <div className="text-2xl font-extrabold text-green-600 font-mono">{kpis.active} máy</div>
          <div className="text-[9px] text-slate font-medium">Đang cẩu hàng / làm việc</div>
        </div>

        {/* KPI: Maintenance */}
        <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <span className="text-[9px] font-bold text-slate uppercase tracking-wider block">ĐANG BẢO TRÌ</span>
          <div className="text-2xl font-extrabold text-signal-orange font-mono">{kpis.maintenance} máy</div>
          <div className="text-[9px] text-slate font-medium font-sans">Bảo dưỡng định kỳ/Sửa chữa</div>
        </div>

        {/* KPI: Offline */}
        <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <span className="text-[9px] font-bold text-slate uppercase tracking-wider block">OFFLINE</span>
          <div className="text-2xl font-extrabold text-slate-500 font-mono">{kpis.offline} máy</div>
          <div className="text-[9px] text-slate font-medium">Chưa kết nối Telemetry</div>
        </div>

        {/* KPI: Alert */}
        <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <span className="text-[9px] font-bold text-slate uppercase tracking-wider block">BÁO LỖI HỆ THỐNG</span>
          <div className="text-2xl font-extrabold text-red-600 font-mono">{kpis.alert} máy</div>
          <div className="text-[9px] text-red-700 font-bold font-sans">Cần kiểm tra kỹ thuật gấp</div>
        </div>

      </div>

      {/* FILTER & TABLE SECTION */}
      <div className="bg-white border border-chalk rounded-2xl shadow-sm overflow-hidden">
        
        {/* Filters Top Bar */}
        <div className="p-5 border-b border-chalk flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate text-sm">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên máy, mã thiết bị, vị trí..."
              className="w-full bg-fog border border-chalk rounded-lg pl-9 pr-4 py-2 text-xs text-carbon placeholder-slate focus:outline-none focus:border-signal-orange"
            />
          </div>

          {/* Filters Select */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate font-bold">Chủng loại:</span>
            <div className="flex border border-chalk rounded-lg overflow-hidden bg-fog text-xs font-semibold">
              {['Tất cả', 'STS Crane', 'RTG', 'Reach Stacker', 'ITV'].map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1.5 transition-colors ${typeFilter === type ? 'bg-carbon text-white' : 'text-slate hover:bg-chalk'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-fog border-b border-chalk font-mono font-bold text-slate text-[10px] uppercase">
                <th className="px-6 py-4">Mã Thiết bị</th>
                <th className="px-6 py-4">Tên cơ giới</th>
                <th className="px-6 py-4">Chủng Loại</th>
                <th className="px-6 py-4">Khu vực phân bổ</th>
                <th className="px-6 py-4 text-center">Giờ chạy máy (hours)</th>
                <th className="px-6 py-4">Bảo trì gần nhất</th>
                <th className="px-6 py-4">Bảo trì kế tiếp</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk">
              {filteredEquipment.map((equip) => (
                <tr
                  key={equip.id}
                  className="hover:bg-fog/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedEquip(equip)}
                >
                  <td className="px-6 py-4 font-mono font-bold text-carbon text-sm">{equip.id}</td>
                  <td className="px-6 py-4 font-bold text-carbon">{equip.name}</td>
                  <td className="px-6 py-4 font-semibold text-slate">{equip.type}</td>
                  <td className="px-6 py-4 font-semibold text-carbon">{equip.zone}</td>
                  <td className="px-6 py-4 text-center font-bold text-carbon font-mono">{equip.hours.toLocaleString()} h</td>
                  <td className="px-6 py-4 font-mono text-slate">{equip.lastMaint}</td>
                  <td className="px-6 py-4 font-mono text-slate">{equip.nextMaint}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      equip.status === 'Đang hoạt động'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : equip.status === 'Idle'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : equip.status === 'Bảo trì'
                        ? 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse'
                        : equip.status === 'Lỗi'
                        ? 'bg-red-50 text-red-700 border-red-200 font-sans'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {equip.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedEquip(equip)}
                      className="px-2.5 py-1 bg-white border border-chalk rounded text-carbon font-bold hover:bg-chalk transition-colors"
                    >
                      Chi tiết
                    </button>
                    {equip.status !== 'Bảo trì' && (
                      <button
                        onClick={() => handleMaintenance(equip.id)}
                        className="px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded font-bold hover:bg-orange-100 transition-colors"
                      >
                        Bảo trì
                      </button>
                    )}
                    {equip.status === 'Bảo trì' && (
                      <button
                        onClick={() => handleActivate(equip.id)}
                        className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded font-bold hover:bg-green-100 transition-colors"
                      >
                        Kích hoạt
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredEquipment.length === 0 && (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-slate font-medium">
                    Không tìm thấy thiết bị nào khớp với điều kiện lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* DETAIL MODAL PANEL */}
      {selectedEquip && (
        <div className="fixed inset-0 bg-carbon/50 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={() => setSelectedEquip(null)}>
          <div
            className="w-full max-w-2xl bg-white max-h-[90vh] rounded-3xl flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-chalk flex justify-between items-center bg-fog">
              <div>
                <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">THÔNG TIN ĐĂNG KIỂM CƠ GIỚI</span>
                <h3 className="text-xl font-extrabold text-carbon mt-0.5">{selectedEquip.name}</h3>
              </div>
              <button
                onClick={() => setSelectedEquip(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-chalk border border-chalk flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Profile Card Summary */}
              <div className="flex items-center gap-4 bg-fog p-4 rounded-xl border border-chalk">
                <div className="w-12 h-12 rounded-xl bg-carbon text-white flex items-center justify-center text-xl font-bold font-mono">
                  {selectedEquip.id}
                </div>
                <div>
                  <div className="text-xs text-slate font-mono">Hãng máy: {selectedEquip.manufacturer} ({selectedEquip.year})</div>
                  <div className="text-sm font-bold text-carbon">Tải trọng làm việc: {selectedEquip.capacity}</div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border mt-1 ${
                    selectedEquip.status === 'Đang hoạt động' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {selectedEquip.status}
                  </span>
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Thông số kỹ thuật đăng kiểm
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate block">Nhà sản xuất:</span>
                    <span className="font-semibold text-carbon">{selectedEquip.manufacturer}</span>
                  </div>
                  <div>
                    <span className="text-slate block">Năm sản xuất:</span>
                    <span className="font-semibold text-carbon">{selectedEquip.year}</span>
                  </div>
                  <div>
                    <span className="text-slate block">Sức nâng tối đa:</span>
                    <span className="font-bold text-signal-orange">{selectedEquip.capacity}</span>
                  </div>
                  <div>
                    <span className="text-slate block">Tổng giờ hoạt động:</span>
                    <span className="font-mono font-semibold text-carbon">{selectedEquip.hours.toLocaleString()} giờ máy</span>
                  </div>
                </div>
              </div>

              {/* Operating status & location */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Phân khu phân bổ & Lịch sử chạy máy
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate block">Phân khu bãi (Zone):</span>
                    <span className="font-bold text-carbon">{selectedEquip.zone}</span>
                  </div>
                  <div>
                    <span className="text-slate block">Bảo trì kế tiếp:</span>
                    <span className="font-mono font-bold text-red-600">{selectedEquip.nextMaint}</span>
                  </div>
                </div>
              </div>

              {/* Maintenance Schedule */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Lịch kiểm định / Bảo trì định kỳ sắp tới
                </h4>
                <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 text-xs space-y-1">
                  <div className="font-bold text-orange-950">Kiểm tra cảm biến áp suất thủy lực</div>
                  <div className="text-[10px] text-orange-700">Ngày bảo trì dự kiến: {selectedEquip.nextMaint}</div>
                </div>
              </div>

              {/* Maintenance History */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Lịch sử sửa chữa kỹ thuật
                </h4>
                <div className="p-3 bg-fog rounded-xl border border-chalk text-xs space-y-1">
                  <div className="flex justify-between font-bold text-carbon">
                    <span>Kiểm tra định kỳ 6 tháng</span>
                    <span className="font-mono text-slate text-[10px]">{selectedEquip.lastMaint}</span>
                  </div>
                  <p className="text-slate text-[11px] leading-relaxed">
                    Thay dầu nhớt động cơ, vệ sinh xích tải, hiệu chuẩn cảm biến hành trình cẩu.
                  </p>
                </div>
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-6 border-t border-chalk flex justify-end gap-3 bg-fog">
              <button
                onClick={() => setSelectedEquip(null)}
                className="px-4 py-2 border border-chalk bg-white text-carbon rounded-lg text-xs font-bold hover:bg-chalk transition-colors"
              >
                ĐÓNG
              </button>
              {selectedEquip.status !== 'Bảo trì' && (
                <button
                  onClick={() => handleMaintenance(selectedEquip.id)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors"
                >
                  BÁO BẢO TRÌ THIẾT BỊ
                </button>
              )}
              {selectedEquip.status === 'Bảo trì' && (
                <button
                  onClick={() => handleActivate(selectedEquip.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                >
                  XÁC NHẬN HOÀN TẤT & KÍCH HOẠT
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ADD EQUIPMENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-carbon/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <h3 className="font-extrabold text-carbon text-lg">Đăng kiểm Thiết bị mới</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-fog hover:bg-chalk flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleAddEquipment} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate font-bold">Mã Thiết bị *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: RTG-05"
                    value={newEquip.id}
                    onChange={(e) => setNewEquip({ ...newEquip, id: e.target.value.toUpperCase() })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 font-mono font-bold uppercase focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Tên thiết bị cơ giới *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Cẩu khung RTG số 5"
                    value={newEquip.name}
                    onChange={(e) => setNewEquip({ ...newEquip, name: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Chủng loại thiết bị *</label>
                  <select
                    value={newEquip.type}
                    onChange={(e) => setNewEquip({ ...newEquip, type: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange"
                  >
                    <option value="STS Crane">STS Crane (Cẩu bờ)</option>
                    <option value="RTG">RTG (Cẩu khung bến vỏ)</option>
                    <option value="RMG">RMG (Cẩu đường ray)</option>
                    <option value="Reach Stacker">Reach Stacker (Xe nâng container)</option>
                    <option value="Forklift">Forklift (Xe nâng vỏ rỗng)</option>
                    <option value="ITV">ITV (Xe đầu kéo nội bộ)</option>
                    <option value="Mobile Crane">Mobile Crane (Cẩu di động)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Phân vùng hoạt động *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Block B hoặc Berth 01"
                    value={newEquip.zone}
                    onChange={(e) => setNewEquip({ ...newEquip, zone: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Nhà sản xuất cơ giới *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Konecranes"
                    value={newEquip.manufacturer}
                    onChange={(e) => setNewEquip({ ...newEquip, manufacturer: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Tải trọng làm việc (Sức nâng) *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 40 Tấn"
                    value={newEquip.capacity}
                    onChange={(e) => setNewEquip({ ...newEquip, capacity: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-slate font-bold">Năm đưa vào khai thác</label>
                  <input
                    type="number"
                    value={newEquip.year}
                    onChange={(e) => setNewEquip({ ...newEquip, year: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-chalk">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 border border-chalk text-carbon rounded-lg font-bold hover:bg-chalk transition-colors"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-signal-orange text-white rounded-lg font-bold hover:bg-orange-600 transition-colors shadow-md"
                >
                  ĐĂNG KÝ THIẾT BỊ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
