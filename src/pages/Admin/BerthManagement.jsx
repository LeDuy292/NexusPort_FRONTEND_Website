import React, { useState, useMemo } from 'react'

// Mock initial berths data
const INITIAL_BERTHS = [
  { id: 'B-01', name: 'Cầu tàu Số 1 (Tiên Sa)', length: 300, depth: -14.0, supportedTypes: 'Container, General Cargo', status: 'Đang khai thác', currentVessel: 'MAERSK MCFARLAND', cranesCount: 3, maxTonnage: 50000, maintenanceHistory: [{ date: '2026-05-12', type: 'Định kỳ', notes: 'Kiểm tra gia cố đệm va chống va chạm cầu tàu.' }] },
  { id: 'B-02', name: 'Cầu tàu Số 2 (Tiên Sa)', length: 350, depth: -16.5, supportedTypes: 'Container, Neo-Panamax', status: 'Đang khai thác', currentVessel: 'MSC GULSUN', cranesCount: 4, maxTonnage: 100000, maintenanceHistory: [] },
  { id: 'B-03', name: 'Cầu tàu Số 3 (Tiên Sa)', length: 280, depth: -12.0, supportedTypes: 'Container, Panamax', status: 'Hoạt động (Trống)', currentVessel: 'Không có (None)', cranesCount: 2, maxTonnage: 35000, maintenanceHistory: [{ date: '2026-06-20', type: 'Sửa chữa', notes: 'Sơn lại vạch mốc neo đậu tàu.' }] },
  { id: 'B-04', name: 'Cầu tàu Số 4 (Liên Chiểu)', length: 400, depth: -18.0, supportedTypes: 'Super-Container, Post-Panamax', status: 'Đang bảo trì', currentVessel: 'Không có (None)', cranesCount: 5, maxTonnage: 150000, maintenanceHistory: [{ date: '2026-08-01', type: 'Đại tu nâng cấp', notes: 'Nạo vét bùn luồng lạch trước bến đạt độ sâu -18m. Dự kiến hoàn tất ngày 20/08.' }] },
  { id: 'B-05', name: 'Cầu tàu Số 5 (Liên Chiểu)', length: 300, depth: -14.5, supportedTypes: 'Container, Bulk Carrier', status: 'Hoạt động (Trống)', currentVessel: 'Không có (None)', cranesCount: 3, maxTonnage: 60000, maintenanceHistory: [] },
  { id: 'B-06', name: 'Cầu bến sà lan 01', length: 150, depth: -7.5, supportedTypes: 'Barge, Feeder', status: 'Vô hiệu hóa', currentVessel: 'Không có (None)', cranesCount: 1, maxTonnage: 10000, maintenanceHistory: [{ date: '2026-07-02', type: 'Sự cố', notes: 'Hư hỏng hệ thống phao tiêu dẫn đường. Đang chờ thay mới thiết bị.' }] }
]

export default function BerthManagement() {
  const [berths, setBerths] = useState(INITIAL_BERTHS)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tất cả')
  const [selectedBerth, setSelectedBerth] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Form State for new berth
  const [newBerth, setNewBerth] = useState({
    id: '',
    name: '',
    length: '',
    depth: '',
    supportedTypes: 'Container',
    cranesCount: '',
    maxTonnage: ''
  })

  // KPI Calculations
  const kpis = useMemo(() => {
    return {
      total: berths.length,
      active: berths.filter(b => b.status.includes('Hoạt động') || b.status.includes('khai thác')).length,
      maintenance: berths.filter(b => b.status === 'Đang bảo trì').length,
      operating: berths.filter(b => b.status === 'Đang khai thác').length
    }
  }, [berths])

  // Filtered Berths
  const filteredBerths = useMemo(() => {
    return berths.filter(b => {
      const matchSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          b.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          b.supportedTypes.toLowerCase().includes(searchTerm.toLowerCase())
      const matchStatus = statusFilter === 'Tất cả' || 
                          (statusFilter === 'Đang hoạt động' && (b.status.includes('Hoạt động') || b.status.includes('khai thác'))) ||
                          b.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [berths, searchTerm, statusFilter])

  // Actions
  const handleMaintenance = (id) => {
    setBerths(prev => prev.map(b => b.id === id ? { ...b, status: 'Đang bảo trì', currentVessel: 'Không có (None)' } : b))
    showToast('🔧 Đã chuyển trạng thái cầu bến sang Đang Bảo trì.')
    if (selectedBerth && selectedBerth.id === id) {
      setSelectedBerth(prev => ({ ...prev, status: 'Đang bảo trì', currentVessel: 'Không có (None)' }))
    }
  }

  const handleEnable = (id) => {
    setBerths(prev => prev.map(b => b.id === id ? { ...b, status: 'Hoạt động (Trống)' } : b))
    showToast('🔓 Đã khôi phục cầu bến về trạng thái Sẵn sàng hoạt động!')
    if (selectedBerth && selectedBerth.id === id) {
      setSelectedBerth(prev => ({ ...prev, status: 'Hoạt động (Trống)' }))
    }
  }

  const handleDisable = (id) => {
    setBerths(prev => prev.map(b => b.id === id ? { ...b, status: 'Vô hiệu hóa', currentVessel: 'Không có (None)' } : b))
    showToast('🔒 Đã vô hiệu hóa cầu bến tạm thời.')
    if (selectedBerth && selectedBerth.id === id) {
      setSelectedBerth(prev => ({ ...prev, status: 'Vô hiệu hóa', currentVessel: 'Không có (None)' }))
    }
  }

  const handleAddBerth = (e) => {
    e.preventDefault()
    if (!newBerth.id || !newBerth.name || !newBerth.length || !newBerth.depth) {
      showToast('❌ Vui lòng điền đầy đủ các thông tin kỹ thuật!')
      return
    }

    const berth = {
      id: newBerth.id.toUpperCase(),
      name: newBerth.name,
      length: Number(newBerth.length),
      depth: Number(newBerth.depth),
      supportedTypes: newBerth.supportedTypes,
      cranesCount: Number(newBerth.cranesCount) || 0,
      maxTonnage: Number(newBerth.maxTonnage) || 0,
      status: 'Hoạt động (Trống)',
      currentVessel: 'Không có (None)',
      maintenanceHistory: []
    }

    setBerths(prev => [...prev, berth])
    setShowAddModal(false)
    setNewBerth({ id: '', name: '', length: '', depth: '', supportedTypes: 'Container', cranesCount: '', maxTonnage: '' })
    showToast('➕ Đã cấu hình và tạo mới cầu bến thành công!')
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
        <span className="material-symbols-outlined text-signal-orange text-lg">construction</span>
        <div>
          <strong className="font-bold">Quy định quyền khai thác Cầu bến:</strong> Quản trị viên (Admin) chỉ cấu hình Master Data kỹ thuật (độ sâu, chiều dài, loại tàu hỗ trợ). Việc chỉ định luồng tàu cập bến, điều khiển cẩu giàn xếp dỡ container thực tế (Berth Allocation & Stowage Planning) do **Điều độ cảng (Dispatcher)** và **Nhân viên Cầu tàu (Berth Staff)** phối hợp thực hiện.
        </div>
      </div>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-carbon font-heading">Quản lý Cầu bến</h2>
          <p className="text-xs text-slate mt-1">Cấu hình tham số kỹ thuật cầu cảng, quản lý trạng thái bảo trì và giới hạn tải trọng tiếp nhận tàu.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-signal-orange text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors shadow-md flex items-center justify-center gap-2 self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-sm">anchor</span>
          THÊM CẦU BẾN
        </button>
      </div>

      {/* KPI STATS CARD GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI: Total */}
        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">TỔNG CẦU BẾN</span>
          <div className="text-3xl font-extrabold text-carbon font-mono">{kpis.total}</div>
          <div className="text-[10px] text-slate font-medium">Cầu bến đăng ký khai thác</div>
          <div className="absolute right-4 bottom-4 text-slate/20">
            <span className="material-symbols-outlined text-4xl">sailing</span>
          </div>
        </div>

        {/* KPI: Active */}
        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">SẴN SÀNG HOẠT ĐỘNG</span>
          <div className="text-3xl font-extrabold text-green-600 font-mono">{kpis.active}</div>
          <div className="text-[10px] text-slate font-medium">Bao gồm trống & đang làm hàng</div>
          <div className="absolute right-4 bottom-4 text-green-500/10">
            <span className="material-symbols-outlined text-4xl">check_circle</span>
          </div>
        </div>

        {/* KPI: Maintenance */}
        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">ĐANG BẢO TRÌ</span>
          <div className="text-3xl font-extrabold text-signal-orange font-mono">{kpis.maintenance}</div>
          <div className="text-[10px] text-slate font-medium">Tạm ngưng đón tàu để kỹ thuật</div>
          <div className="absolute right-4 bottom-4 text-orange-500/10">
            <span className="material-symbols-outlined text-4xl">engineering</span>
          </div>
        </div>

        {/* KPI: Operating */}
        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">ĐANG KHAI THÁC BIỂN</span>
          <div className="text-3xl font-extrabold text-blue-600 font-mono">{kpis.operating}</div>
          <div className="text-[10px] text-slate font-medium">Hiện có tàu đang neo đậu dỡ cont</div>
          <div className="absolute right-4 bottom-4 text-blue-500/10">
            <span className="material-symbols-outlined text-4xl">directions_boat</span>
          </div>
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
              placeholder="Tìm theo tên cầu bến, mã, loại tàu hỗ trợ..."
              className="w-full bg-fog border border-chalk rounded-lg pl-9 pr-4 py-2 text-xs text-carbon placeholder-slate focus:outline-none focus:border-signal-orange"
            />
          </div>

          {/* Filters Select */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate font-bold">Trạng thái:</span>
            <div className="flex border border-chalk rounded-lg overflow-hidden bg-fog text-xs font-semibold">
              {['Tất cả', 'Đang hoạt động', 'Đang bảo trì', 'Vô hiệu hóa'].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 transition-colors ${statusFilter === status ? 'bg-carbon text-white' : 'text-slate hover:bg-chalk'}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Berth Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-fog border-b border-chalk font-mono font-bold text-slate text-[10px] uppercase">
                <th className="px-6 py-4">Mã Cầu</th>
                <th className="px-6 py-4">Tên Cầu bến</th>
                <th className="px-6 py-4">Chiều dài</th>
                <th className="px-6 py-4">Độ sâu mớn nước</th>
                <th className="px-6 py-4">Tàu hiện đỗ</th>
                <th className="px-6 py-4">Loại tàu hỗ trợ</th>
                <th className="px-6 py-4 text-center">Cẩu giàn hiện có</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk">
              {filteredBerths.map((berth) => (
                <tr
                  key={berth.id}
                  className="hover:bg-fog/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedBerth(berth)}
                >
                  <td className="px-6 py-4 font-mono font-bold text-carbon text-sm">{berth.id}</td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-bold text-carbon text-sm">{berth.name}</div>
                      <div className="text-[10px] text-slate mt-0.5">Trọng tải Max: {berth.maxTonnage.toLocaleString()} DWT</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono font-semibold text-carbon">{berth.length} mét</td>
                  <td className="px-6 py-4 font-mono font-semibold text-carbon">{berth.depth} mét</td>
                  <td className="px-6 py-4">
                    <span className={`font-semibold ${berth.currentVessel !== 'Không có (None)' ? 'text-blue-600 font-bold' : 'text-slate'}`}>
                      {berth.currentVessel}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate font-medium">{berth.supportedTypes}</td>
                  <td className="px-6 py-4 text-center font-bold text-carbon font-mono">{berth.cranesCount}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      berth.status === 'Đang khai thác'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : berth.status.includes('Hoạt động')
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : berth.status === 'Đang bảo trì'
                        ? 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {berth.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedBerth(berth)}
                      className="px-2.5 py-1 bg-white border border-chalk rounded text-carbon font-bold hover:bg-chalk transition-colors"
                    >
                      Chi tiết
                    </button>
                    {berth.status !== 'Đang bảo trì' && berth.status !== 'Vô hiệu hóa' && (
                      <button
                        onClick={() => handleMaintenance(berth.id)}
                        className="px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded font-bold hover:bg-orange-100 transition-colors"
                      >
                        Bảo trì
                      </button>
                    )}
                    {berth.status === 'Đang bảo trì' && (
                      <button
                        onClick={() => handleEnable(berth.id)}
                        className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded font-bold hover:bg-green-100 transition-colors"
                      >
                        Mở bến
                      </button>
                    )}
                    {berth.status !== 'Vô hiệu hóa' ? (
                      <button
                        onClick={() => handleDisable(berth.id)}
                        className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded font-bold hover:bg-red-100 transition-colors"
                      >
                        Tắt
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEnable(berth.id)}
                        className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded font-bold hover:bg-green-100 transition-colors"
                      >
                        Kích hoạt
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredBerths.length === 0 && (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-slate font-medium">
                    Không tìm thấy cầu bến nào khớp với điều kiện lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* DETAIL MODAL PANEL */}
      {selectedBerth && (
        <div className="fixed inset-0 bg-carbon/50 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={() => setSelectedBerth(null)}>
          <div
            className="w-full max-w-2xl bg-white max-h-[90vh] rounded-3xl flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-chalk flex justify-between items-center bg-fog">
              <div>
                <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">CẤU HÌNH CHI TIẾT CẦU BẾN</span>
                <h3 className="text-xl font-extrabold text-carbon mt-0.5">{selectedBerth.name}</h3>
              </div>
              <button
                onClick={() => setSelectedBerth(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-chalk border border-chalk flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Berth Technical parameters */}
              <div className="bg-fog p-5 rounded-2xl border border-chalk space-y-3">
                <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">THÔNG SỐ KỸ THUẬT</span>
                
                <div className="grid grid-cols-2 gap-4 text-xs font-mono font-bold text-carbon">
                  <div className="bg-white p-3 rounded-lg border border-chalk">
                    <span className="text-[9px] text-slate block font-sans">CHIỀU DÀI BẾN</span>
                    <span className="text-base text-carbon mt-1 block">{selectedBerth.length} mét</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-chalk">
                    <span className="text-[9px] text-slate block font-sans">MỚN NƯỚC (ĐỘ SÂU)</span>
                    <span className="text-base text-signal-orange mt-1 block">{selectedBerth.depth} mét</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-chalk">
                    <span className="text-[9px] text-slate block font-sans">CẨU GIÀN STS TRANG BỊ</span>
                    <span className="text-base text-carbon mt-1 block">{selectedBerth.cranesCount} cẩu</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-chalk">
                    <span className="text-[9px] text-slate block font-sans">TRỌNG TẢI TÀU MAX</span>
                    <span className="text-base text-carbon mt-1 block">{selectedBerth.maxTonnage.toLocaleString()} DWT</span>
                  </div>
                </div>
              </div>

              {/* Supported Vessels & Status */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Khả năng tiếp nhận & Trạng thái hiện tại
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate block">Loại tàu hỗ trợ:</span>
                    <span className="font-semibold text-carbon">{selectedBerth.supportedTypes}</span>
                  </div>
                  <div>
                    <span className="text-slate block">Trạng thái khai thác:</span>
                    <span className="font-semibold text-carbon">{selectedBerth.status}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate block">Tàu đang neo đậu làm hàng:</span>
                    <span className="font-bold text-blue-600 flex items-center gap-1.5 mt-0.5">
                      <span className="material-symbols-outlined text-sm">directions_boat</span>
                      {selectedBerth.currentVessel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Operating Schedule */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Kế hoạch đón tàu (24h tiếp theo)
                </h4>
                {selectedBerth.currentVessel !== 'Không có (None)' ? (
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs space-y-1">
                    <div className="font-bold text-blue-900">Tàu {selectedBerth.currentVessel} đang dỡ container</div>
                    <div className="text-[10px] text-blue-700">Dự kiến hoàn tất làm hàng: 18:00 PM Hôm nay</div>
                  </div>
                ) : selectedBerth.status === 'Đang bảo trì' ? (
                  <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 text-xs italic text-orange-800">
                    Bến đang bảo trì kỹ thuật luồng lạch. Không tiếp nhận lịch tàu.
                  </div>
                ) : (
                  <div className="p-3 bg-green-50 rounded-xl border border-green-200 text-xs space-y-1">
                    <div className="font-bold text-green-900">Cầu bến đang trống - Sẵn sàng đón tàu</div>
                    <div className="text-[10px] text-green-700">Chờ lệnh điều tàu neo đậu từ Dispatcher</div>
                  </div>
                )}
              </div>

              {/* Maintenance History */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Nhật ký bảo trì & Kiểm định kỹ thuật bến
                </h4>
                <div className="space-y-2">
                  {selectedBerth.maintenanceHistory.length > 0 ? (
                    selectedBerth.maintenanceHistory.map((history, idx) => (
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
                      Không có lịch sử bảo trì gần đây.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-6 border-t border-chalk flex justify-end gap-3 bg-fog">
              <button
                onClick={() => setSelectedBerth(null)}
                className="px-4 py-2 border border-chalk bg-white text-carbon rounded-lg text-xs font-bold hover:bg-chalk transition-colors"
              >
                ĐÓNG
              </button>
              {selectedBerth.status !== 'Đang bảo trì' && selectedBerth.status !== 'Vô hiệu hóa' && (
                <button
                  onClick={() => handleMaintenance(selectedBerth.id)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors"
                >
                  ĐƯA VÀO BẢO TRÌ BẾN
                </button>
              )}
              {(selectedBerth.status === 'Đang bảo trì' || selectedBerth.status === 'Vô hiệu hóa') && (
                <button
                  onClick={() => handleEnable(selectedBerth.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                >
                  KÍCH HOẠT HOẠT ĐỘNG
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ADD BERTH MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-carbon/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <h3 className="font-extrabold text-carbon text-lg">Cấu hình Cầu bến mới</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-fog hover:bg-chalk flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleAddBerth} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate font-bold">Mã cầu bến (ID) *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: B-07"
                    value={newBerth.id}
                    onChange={(e) => setNewBerth({ ...newBerth, id: e.target.value.toUpperCase() })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 font-mono font-bold uppercase focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Tên cầu bến cảng *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Cầu tàu Số 7 (Tiên Sa)"
                    value={newBerth.name}
                    onChange={(e) => setNewBerth({ ...newBerth, name: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Chiều dài bến (mét) *</label>
                  <input
                    type="number"
                    required
                    placeholder="VD: 320"
                    value={newBerth.length}
                    onChange={(e) => setNewBerth({ ...newBerth, length: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Độ sâu mớn nước (mét) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="VD: -15.5"
                    value={newBerth.depth}
                    onChange={(e) => setNewBerth({ ...newBerth, depth: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Số lượng cẩu STS bố trí</label>
                  <input
                    type="number"
                    placeholder="VD: 3"
                    value={newBerth.cranesCount}
                    onChange={(e) => setNewBerth({ ...newBerth, cranesCount: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Trọng tải tiếp nhận Max (DWT)</label>
                  <input
                    type="number"
                    placeholder="VD: 80000"
                    value={newBerth.maxTonnage}
                    onChange={(e) => setNewBerth({ ...newBerth, maxTonnage: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-mono"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-slate font-bold">Loại tàu hỗ trợ tiếp nhận</label>
                  <input
                    type="text"
                    placeholder="VD: Container, Bulk Carrier, Feeder, Panamax..."
                    value={newBerth.supportedTypes}
                    onChange={(e) => setNewBerth({ ...newBerth, supportedTypes: e.target.value })}
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange"
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
                  CẤU HÌNH CẦU BẾN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
