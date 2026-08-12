import React, { useState, useMemo } from 'react'

// Mock initial gate data
const INITIAL_GATES = [
  { id: 'GT-01', name: 'Gate A - Cổng Tây (Xuất/Nhập)', type: 'Gate In/Out', lanesCount: 3, camerasCount: 6, ocrStatus: 'Hoạt động (99.8%)', status: 'Hoạt động', dailyTraffic: 450, operatingHours: '24/7', notes: 'Cổng chính kết nối Quốc lộ 1A. Mật độ xe tải cao.', maintenanceHistory: [{ date: '2026-06-15', type: 'Phần mềm OCR', notes: 'Cập nhật AI nhận diện biển số xe đầu kéo.' }] },
  { id: 'GT-02', name: 'Gate B - Cổng Đông (Nhập Cảng)', type: 'Gate In', lanesCount: 2, camerasCount: 4, ocrStatus: 'Hoạt động (99.5%)', status: 'Hoạt động', dailyTraffic: 280, operatingHours: '24/7', notes: 'Lối vào chuyên dụng cho xe container hạ bãi.', maintenanceHistory: [] },
  { id: 'GT-03', name: 'Gate C - Cổng Phụ (Xuất Cảng)', type: 'Gate Out', lanesCount: 2, camerasCount: 4, ocrStatus: 'Hoạt động (98.9%)', status: 'Hoạt động', dailyTraffic: 190, operatingHours: '06:00 - 22:00', notes: 'Lối ra cho xe kéo vỏ rỗng.', maintenanceHistory: [{ date: '2026-07-10', type: 'Phần cứng', notes: 'Bảo trì thanh chắn Barrier số 2.' }] },
  { id: 'GT-04', name: 'Gate D - Cổng Nội Bộ Xưởng', type: 'Gate In/Out', lanesCount: 1, camerasCount: 2, ocrStatus: 'Không trang bị', status: 'Đang bảo trì', dailyTraffic: 42, operatingHours: '24/7', notes: 'Cổng dành riêng cho xe công vụ và thiết bị kỹ thuật nội bộ cảng.', maintenanceHistory: [{ date: '2026-08-01', type: 'Nâng cấp thiết bị', notes: 'Lắp đặt camera IP giám sát làn xe mới. Dự kiến xong ngày 15/08.' }] },
  { id: 'GT-05', name: 'Gate E - Cổng Tiếp Nhận Đường Sắt', type: 'Gate In/Out', lanesCount: 1, camerasCount: 3, ocrStatus: 'Hoạt động (99.1%)', status: 'Offline', dailyTraffic: 0, operatingHours: 'Theo lịch tàu lửa', notes: 'Cổng đường ray tiếp nhận container từ ga sắt kết nối.', maintenanceHistory: [] }
]

export default function GateManagement() {
  const [gates, setGates] = useState(INITIAL_GATES)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('Tất cả')
  const [selectedGate, setSelectedGate] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Form State for new gate
  const [newGate, setNewGate] = useState({
    id: '',
    name: '',
    type: 'Gate In/Out',
    lanesCount: '',
    camerasCount: '',
    ocrStatus: 'Hoạt động (99.0%)',
    operatingHours: '24/7',
    notes: ''
  })

  // KPI Calculations
  const kpis = useMemo(() => {
    return {
      total: gates.length,
      active: gates.filter(g => g.status === 'Hoạt động').length,
      maintenance: gates.filter(g => g.status === 'Đang bảo trì').length,
      cameras: gates.reduce((sum, g) => sum + g.camerasCount, 0),
      ocrActive: gates.filter(g => g.ocrStatus !== 'Không trang bị' && g.status === 'Hoạt động').length
    }
  }, [gates])

  // Filtered Gates
  const filteredGates = useMemo(() => {
    return gates.filter(g => {
      const matchSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          g.id.toLowerCase().includes(searchTerm.toLowerCase())
      const matchType = typeFilter === 'Tất cả' || g.type === typeFilter
      return matchSearch && matchType
    })
  }, [gates, searchTerm, typeFilter])

  // Actions
  const handleMaintenance = (id) => {
    setGates(prev => prev.map(g => g.id === id ? { ...g, status: 'Đang bảo trì' } : g))
    showToast('🔧 Đã cập nhật trạng thái Gate sang bảo trì thiết bị.')
    if (selectedGate && selectedGate.id === id) {
      setSelectedGate(prev => ({ ...prev, status: 'Đang bảo trì' }))
    }
  }

  const handleEnable = (id) => {
    setGates(prev => prev.map(g => g.id === id ? { ...g, status: 'Hoạt động' } : g))
    showToast('🔓 Đã mở cổng kiểm soát kiểm soát luồng xe!')
    if (selectedGate && selectedGate.id === id) {
      setSelectedGate(prev => ({ ...prev, status: 'Hoạt động' }))
    }
  }

  const handleDisable = (id) => {
    setGates(prev => prev.map(g => g.id === id ? { ...g, status: 'Offline' } : g))
    showToast('🔒 Đã tạm ngắt kết nối Gate (Offline).')
    if (selectedGate && selectedGate.id === id) {
      setSelectedGate(prev => ({ ...prev, status: 'Offline' }))
    }
  }

  const handleAddGate = (e) => {
    e.preventDefault()
    if (!newGate.id || !newGate.name || !newGate.lanesCount || !newGate.camerasCount) {
      showToast('❌ Vui lòng cung cấp đầy đủ thông số hạ tầng!')
      return
    }

    const gate = {
      id: newGate.id.toUpperCase(),
      name: newGate.name,
      type: newGate.type,
      lanesCount: Number(newGate.lanesCount),
      camerasCount: Number(newGate.camerasCount),
      ocrStatus: newGate.ocrStatus,
      status: 'Hoạt động',
      dailyTraffic: 0,
      operatingHours: newGate.operatingHours,
      notes: newGate.notes || 'Không có ghi chú thêm.',
      maintenanceHistory: []
    }

    setGates(prev => [...prev, gate])
    setShowAddModal(false)
    setNewGate({ id: '', name: '', type: 'Gate In/Out', lanesCount: '', camerasCount: '', ocrStatus: 'Hoạt động (99.0%)', operatingHours: '24/7', notes: '' })
    showToast('➕ Đã khởi tạo cấu hình Gate mới thành công!')
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
        <span className="material-symbols-outlined text-signal-orange text-lg">door_sliding</span>
        <div>
          <strong className="font-bold">Lưu ý quản lý hạ tầng Gate:</strong> Phân hệ này cấu hình hạ tầng kiểm soát cổng (số làn, thiết bị camera đầu đọc biển số xe OCR/ANPR, đầu đọc thẻ). Các thao tác trực tiếp duyệt cho xe vào/ra, đối chiếu tờ khai hải quan hay chụp ảnh container do nhân viên trực bốt **Gate Officer (Cổng kiểm soát)** đảm nhiệm.
        </div>
      </div>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-carbon font-heading">Quản lý Gate</h2>
          <p className="text-xs text-slate mt-1">Cấu hình các cổng kiểm soát container đầu vào/đầu ra, camera AI nhận dạng biển số xe, và thiết bị Barrier tự động.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-signal-orange text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors shadow-md flex items-center justify-center gap-2 self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-sm">settings_input_composite</span>
          THÊM CỔNG (GATE)
        </button>
      </div>

      {/* KPI STATS CARD GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI: Total */}
        <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <span className="text-[9px] font-bold text-slate uppercase tracking-wider block">TỔNG SỐ GATE</span>
          <div className="text-2xl font-extrabold text-carbon font-mono">{kpis.total} Cổng</div>
          <div className="text-[9px] text-slate font-medium">Hạ tầng kiểm soát cổng cảng</div>
        </div>

        {/* KPI: Active */}
        <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <span className="text-[9px] font-bold text-slate uppercase tracking-wider block">ĐANG HOẠT ĐỘNG</span>
          <div className="text-2xl font-extrabold text-green-600 font-mono">{kpis.active} Cổng</div>
          <div className="text-[9px] text-slate font-medium font-sans">Làn tự động thông suốt</div>
        </div>

        {/* KPI: Maintenance */}
        <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <span className="text-[9px] font-bold text-slate uppercase tracking-wider block">ĐANG BẢO TRÌ BỐT</span>
          <div className="text-2xl font-extrabold text-signal-orange font-mono">{kpis.maintenance} Cổng</div>
          <div className="text-[9px] text-slate font-medium">Đang bảo dưỡng thiết bị</div>
        </div>

        {/* KPI: Cameras */}
        <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <span className="text-[9px] font-bold text-slate uppercase tracking-wider block">CAMERA GIÁM SÁT</span>
          <div className="text-2xl font-extrabold text-blue-600 font-mono">{kpis.cameras} CAM</div>
          <div className="text-[9px] text-green-700 font-bold">100% CCTV Online</div>
        </div>

        {/* KPI: OCR Online */}
        <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <span className="text-[9px] font-bold text-slate uppercase tracking-wider block">OCR / ANPR ONLINE</span>
          <div className="text-2xl font-extrabold text-purple-600 font-mono">{kpis.ocrActive} bộ</div>
          <div className="text-[9px] text-slate font-medium">Nhận diện biển số tự động</div>
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
              placeholder="Tìm theo tên cổng, mã cổng kiểm soát..."
              className="w-full bg-fog border border-chalk rounded-lg pl-9 pr-4 py-2 text-xs text-carbon placeholder-slate focus:outline-none focus:border-signal-orange"
            />
          </div>

          {/* Filters Select */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate font-bold">Loại Cổng:</span>
            <div className="flex border border-chalk rounded-lg overflow-hidden bg-fog text-xs font-semibold">
              {['Tất cả', 'Gate In', 'Gate Out', 'Gate In/Out'].map(type => (
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

        {/* Gate Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-fog border-b border-chalk font-mono font-bold text-slate text-[10px] uppercase">
                <th className="px-6 py-4">Mã Gate</th>
                <th className="px-6 py-4">Tên Cổng kiểm soát</th>
                <th className="px-6 py-4">Phân Loại</th>
                <th className="px-6 py-4 text-center">Số làn xe chạy</th>
                <th className="px-6 py-4 text-center">Camera trang bị</th>
                <th className="px-6 py-4">Nhận dạng OCR / ANPR</th>
                <th className="px-6 py-4 font-mono">Lưu lượng hôm nay</th>
                <th className="px-6 py-4">Thời gian mở cổng</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk">
              {filteredGates.map((gate) => (
                <tr
                  key={gate.id}
                  className="hover:bg-fog/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedGate(gate)}
                >
                  <td className="px-6 py-4 font-mono font-bold text-carbon text-sm">{gate.id}</td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-bold text-carbon text-sm">{gate.name}</div>
                      <div className="text-[10px] text-slate mt-0.5 max-w-xs truncate">{gate.notes}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      gate.type === 'Gate In'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : gate.type === 'Gate Out'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-teal-50 text-teal-700 border-teal-200'
                    }`}>
                      {gate.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-carbon font-mono">{gate.lanesCount}</td>
                  <td className="px-6 py-4 text-center font-bold text-carbon font-mono">{gate.camerasCount}</td>
                  <td className="px-6 py-4">
                    <span className={`font-semibold ${gate.ocrStatus === 'Không trang bị' ? 'text-slate italic' : 'text-purple-600 font-bold'}`}>
                      {gate.ocrStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-signal-orange text-center">{gate.dailyTraffic} lượt xe</td>
                  <td className="px-6 py-4 font-mono font-semibold text-slate">{gate.operatingHours}</td>
                  <td className="px-6 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedGate(gate)}
                      className="px-2.5 py-1 bg-white border border-chalk rounded text-carbon font-bold hover:bg-chalk transition-colors"
                    >
                      Chi tiết
                    </button>
                    {gate.status !== 'Đang bảo trì' && gate.status !== 'Offline' && (
                      <button
                        onClick={() => handleMaintenance(gate.id)}
                        className="px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded font-bold hover:bg-orange-100 transition-colors"
                      >
                        Bảo trì
                      </button>
                    )}
                    {gate.status === 'Đang bảo trì' && (
                      <button
                        onClick={() => handleEnable(gate.id)}
                        className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded font-bold hover:bg-green-100 transition-colors"
                      >
                        Mở cổng
                      </button>
                    )}
                    {gate.status !== 'Offline' ? (
                      <button
                        onClick={() => handleDisable(gate.id)}
                        className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded font-bold hover:bg-red-100 transition-colors"
                      >
                        Khóa
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEnable(gate.id)}
                        className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded font-bold hover:bg-green-100 transition-colors"
                      >
                        Mở khóa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredGates.length === 0 && (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-slate font-medium">
                    Không tìm thấy cổng kiểm soát nào khớp với điều kiện lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* DETAIL MODAL PANEL */}
      {selectedGate && (
        <div className="fixed inset-0 bg-carbon/50 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={() => setSelectedGate(null)}>
          <div
            className="w-full max-w-2xl bg-white max-h-[90vh] rounded-3xl flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-chalk flex justify-between items-center bg-fog">
              <div>
                <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">HẠ TẦNG KỸ THUẬT GATE</span>
                <h3 className="text-xl font-extrabold text-carbon mt-0.5">{selectedGate.name}</h3>
              </div>
              <button
                onClick={() => setSelectedGate(null)}
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
                  {selectedGate.id}
                </div>
                <div>
                  <div className="text-xs text-slate font-mono">Giờ mở cửa: {selectedGate.operatingHours}</div>
                  <div className="text-sm font-bold text-carbon">Lưu lượng ngày: {selectedGate.dailyTraffic} lượt xe</div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border mt-1 ${
                    selectedGate.status === 'Hoạt động' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {selectedGate.status}
                  </span>
                </div>
              </div>

              {/* Lane configuration */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Cấu hình phân làn xe chạy
                </h4>
                <div className="space-y-2 text-xs font-mono font-bold text-carbon">
                  {Array.from({ length: selectedGate.lanesCount }).map((_, idx) => (
                    <div key={idx} className="p-3 bg-fog rounded-xl border border-chalk flex justify-between items-center">
                      <span className="font-sans">Làn xe Số {idx + 1} (Lane {idx + 1})</span>
                      <div className="flex gap-2">
                        <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 font-sans">Cảm biến Loop: Đạt</span>
                        <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 font-sans">Barrier: Tốt</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Equipment Status */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Thiết bị camera & OCR
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate block">Đầu đọc biển số OCR:</span>
                    <span className="font-bold text-purple-600">{selectedGate.ocrStatus}</span>
                  </div>
                  <div>
                    <span className="text-slate block">Tổng camera CCTV:</span>
                    <span className="font-bold text-carbon">{selectedGate.camerasCount} Camera (Hoạt động)</span>
                  </div>
                </div>
              </div>

              {/* Traffic status */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Biểu đồ lưu lượng thông qua hôm nay
                </h4>
                <div className="bg-fog p-4 rounded-xl border border-chalk text-center py-6 text-xs text-slate italic font-medium">
                  Lưu lượng đỉnh: 08:00 AM - 10:30 AM (92 lượt xe/giờ). Không ghi nhận tình trạng nghẽn bốt cổng.
                </div>
              </div>

              {/* Maintenance History */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Nhật ký kỹ thuật bảo trì thiết bị cổng
                </h4>
                <div className="space-y-2">
                  {selectedGate.maintenanceHistory.length > 0 ? (
                    selectedGate.maintenanceHistory.map((history, idx) => (
                      <div key={idx} className="p-3 bg-fog rounded-xl border border-chalk text-xs space-y-1">
                        <div className="flex justify-between font-bold text-carbon">
                          <span>{history.type}</span>
                          <span className="font-mono text-slate text-[10px]">{history.date}</span>
                        </div>
                        <p className="text-slate text-[11px] leading-relaxed">{history.notes}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate italic text-center py-4 bg-fog rounded border border-chalk">
                      Không có lịch sử sửa chữa thiết bị gần đây.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-6 border-t border-chalk flex justify-end gap-3 bg-fog">
              <button
                onClick={() => setSelectedGate(null)}
                className="px-4 py-2 border border-chalk bg-white text-carbon rounded-lg text-xs font-bold hover:bg-chalk transition-colors"
              >
                ĐÓNG
              </button>
              {selectedGate.status !== 'Đang bảo trì' && selectedGate.status !== 'Offline' && (
                <button
                  onClick={() => handleMaintenance(selectedGate.id)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors"
                >
                  BẢO TRÌ BẮT BUỘC
                </button>
              )}
              {(selectedGate.status === 'Đang bảo trì' || selectedGate.status === 'Offline') && (
                <button
                  onClick={() => handleEnable(selectedGate.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                >
                  KÍCH HOẠT GATE
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ADD GATE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-carbon/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <h3 className="font-extrabold text-carbon text-lg">Thêm Cổng kiểm soát mới (Gate)</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-fog hover:bg-chalk flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleAddGate} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate font-bold">Mã Gate *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: GT-06"
                    value={newGate.id}
                    onChange={(e) => setNewGate({ ...newGate, id: e.target.value.toUpperCase() })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 font-mono font-bold uppercase focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Tên cổng kiểm soát *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Gate F - Cổng Phụ Nam"
                    value={newGate.name}
                    onChange={(e) => setNewGate({ ...newGate, name: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Loại Cổng *</label>
                  <select
                    value={newGate.type}
                    onChange={(e) => setNewGate({ ...newGate, type: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange"
                  >
                    <option value="Gate In">Gate In (Chỉ vào)</option>
                    <option value="Gate Out">Gate Out (Chỉ ra)</option>
                    <option value="Gate In/Out">Gate In/Out (Vào/Ra)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Giờ làm việc bốt cổng *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 24/7 hoặc 06:00 - 22:00"
                    value={newGate.operatingHours}
                    onChange={(e) => setNewGate({ ...newGate, operatingHours: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Số lượng làn xe chạy *</label>
                  <input
                    type="number"
                    required
                    placeholder="VD: 2"
                    value={newGate.lanesCount}
                    onChange={(e) => setNewGate({ ...newGate, lanesCount: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Số camera giám sát lắp ráp *</label>
                  <input
                    type="number"
                    required
                    placeholder="VD: 4"
                    value={newGate.camerasCount}
                    onChange={(e) => setNewGate({ ...newGate, camerasCount: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-mono"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-slate font-bold">Ghi chú vận hành</label>
                  <textarea
                    rows="2"
                    value={newGate.notes}
                    onChange={(e) => setNewGate({ ...newGate, notes: e.target.value })}
                    placeholder="Nhập mô tả luồng xe chỉ định..."
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange resize-none"
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
                  CẤU HÌNH GATE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
