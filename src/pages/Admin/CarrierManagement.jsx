import React, { useState, useMemo } from 'react'

// Mock initial carriers data
const INITIAL_CARRIERS = [
  { id: 'CARR-001', name: 'Maersk Line', code: 'MAEU', contact: 'Trần Văn Hoàng', email: 'hoang.tran@maersk.com', phone: '0901 234 567', bookings: 142, containers: 58, status: 'Hoạt động', regDate: '2026-01-10', country: 'Đan Mạch', website: 'www.maersk.com', activeVessels: ['Maersk Mc-Kinney Moller', 'Maersk Mc-Kinney', 'Maersk Saltoro'], address: 'Tòa nhà Bitexco, Quận 1, TP. Hồ Chí Minh' },
  { id: 'CARR-002', name: 'Evergreen Marine', code: 'EMCD', contact: 'Nguyễn Thị Hương', email: 'huong.nguyen@evergreen-line.com', phone: '0912 345 678', bookings: 98, containers: 42, status: 'Hoạt động', regDate: '2026-02-15', country: 'Đài Loan', website: 'www.evergreen-marine.com', activeVessels: ['Ever Given', 'Ever Glory', 'Ever Gentle'], address: 'Tòa nhà Sunwah, Quận 1, TP. Hồ Chí Minh' },
  { id: 'CARR-003', name: 'Mediterranean Shipping Co.', code: 'MSCU', contact: 'Phạm Minh Đức', email: 'duc.pham@msc.com', phone: '0983 456 789', bookings: 185, containers: 79, status: 'Hoạt động', regDate: '2026-01-20', country: 'Thụy Sĩ', website: 'www.msc.com', activeVessels: ['MSC Gulsun', 'MSC Isabella', 'MSC Mia'], address: 'Mê Linh Point Tower, Quận 1, TP. Hồ Chí Minh' },
  { id: 'CARR-004', name: 'Ocean Network Express', code: 'ONEY', contact: 'Lê Hoàng Hải', email: 'hai.le@one-line.com', phone: '0977 123 456', bookings: 120, containers: 36, status: 'Chờ duyệt', regDate: '2026-08-01', country: 'Nhật Bản', website: 'www.one-line.com', activeVessels: ['ONE Apus', 'ONE Trust', 'ONE Continuity'], address: 'Tòa nhà Saigon Centre, Quận 1, TP. Hồ Chí Minh' },
  { id: 'CARR-005', name: 'COSCO Shipping Lines', code: 'COSU', contact: 'Vũ Hoàng Nam', email: 'nam.vu@coscoshipping.com', phone: '0934 987 654', bookings: 75, containers: 24, status: 'Tạm khóa', regDate: '2026-03-05', country: 'Trung Quốc', website: 'www.coscoshipping.com', activeVessels: ['COSCO Shipping Universe', 'COSCO Nebula'], address: 'Tòa nhà Deutsches Haus, Quận 1, TP. Hồ Chí Minh' },
  { id: 'CARR-006', name: 'Hapag-Lloyd', code: 'HPLU', contact: 'Đặng Quốc Bảo', email: 'bao.dang@hlag.com', phone: '0909 333 444', bookings: 64, containers: 18, status: 'Hoạt động', regDate: '2026-04-12', country: 'Đức', website: 'www.hapag-lloyd.com', activeVessels: ['Al Dahna Express', 'Tihama'], address: 'Tòa nhà Landmark 81, Bình Thạnh, TP. Hồ Chí Minh' },
  { id: 'CARR-007', name: 'Yang Ming Marine', code: 'YMLU', contact: 'Bùi Anh Tuấn', email: 'tuan.bui@yangming.com', phone: '0918 555 666', bookings: 42, containers: 11, status: 'Chờ duyệt', regDate: '2026-08-10', country: 'Đài Loan', website: 'www.yangming.com', activeVessels: ['YM Wellhead', 'YM Warranty'], address: 'Tòa nhà Lim Tower, Quận 1, TP. Hồ Chí Minh' }
]

export default function CarrierManagement() {
  const [carriers, setCarriers] = useState(INITIAL_CARRIERS)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tất cả')
  const [selectedCarrier, setSelectedCarrier] = useState(null) // for Detail Drawer
  const [showAddModal, setShowAddModal] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Form State for new carrier
  const [newCarrier, setNewCarrier] = useState({
    name: '',
    code: '',
    contact: '',
    email: '',
    phone: '',
    country: '',
    website: '',
    address: ''
  })

  // KPI Calculations
  const kpis = useMemo(() => {
    return {
      total: carriers.length,
      active: carriers.filter(c => c.status === 'Hoạt động').length,
      pending: carriers.filter(c => c.status === 'Chờ duyệt').length,
      locked: carriers.filter(c => c.status === 'Tạm khóa').length
    }
  }, [carriers])

  // Filtered Carriers
  const filteredCarriers = useMemo(() => {
    return carriers.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.contact.toLowerCase().includes(searchTerm.toLowerCase())
      const matchStatus = statusFilter === 'Tất cả' || c.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [carriers, searchTerm, statusFilter])

  // Actions
  const handleApprove = (id) => {
    setCarriers(prev => prev.map(c => c.id === id ? { ...c, status: 'Hoạt động' } : c))
    showToast('✅ Đã phê duyệt hãng tàu thành công!')
    if (selectedCarrier && selectedCarrier.id === id) {
      setSelectedCarrier(prev => ({ ...prev, status: 'Hoạt động' }))
    }
  }

  const handleSuspend = (id) => {
    setCarriers(prev => prev.map(c => c.id === id ? { ...c, status: 'Tạm khóa' } : c))
    showToast('🔒 Đã tạm khóa tài khoản hãng tàu!')
    if (selectedCarrier && selectedCarrier.id === id) {
      setSelectedCarrier(prev => ({ ...prev, status: 'Tạm khóa' }))
    }
  }

  const handleActivate = (id) => {
    setCarriers(prev => prev.map(c => c.id === id ? { ...c, status: 'Hoạt động' } : c))
    showToast('🔓 Đã kích hoạt lại tài khoản hãng tàu!')
    if (selectedCarrier && selectedCarrier.id === id) {
      setSelectedCarrier(prev => ({ ...prev, status: 'Hoạt động' }))
    }
  }

  const handleAddCarrier = (e) => {
    e.preventDefault()
    if (!newCarrier.name || !newCarrier.code || !newCarrier.contact || !newCarrier.email) {
      showToast('❌ Vui lòng nhập đầy đủ các thông tin bắt buộc!')
      return
    }

    const carrier = {
      id: `CARR-0${carriers.length + 1}`,
      ...newCarrier,
      bookings: 0,
      containers: 0,
      status: 'Chờ duyệt',
      regDate: new Date().toISOString().split('T')[0],
      activeVessels: [],
      country: newCarrier.country || 'N/A',
      website: newCarrier.website || 'N/A'
    }

    setCarriers(prev => [carrier, ...prev])
    setShowAddModal(false)
    setNewCarrier({ name: '', code: '', contact: '', email: '', phone: '', country: '', website: '', address: '' })
    showToast('➕ Đăng ký hãng tàu mới thành công! Đang chờ phê duyệt.')
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
        <span className="material-symbols-outlined text-signal-orange text-lg">info</span>
        <div>
          <strong className="font-bold">Lưu ý nghiệp vụ:</strong> Phân hệ quản lý đối tác Hãng tàu và Đơn vị vận tải ngoại cảng (Carrier & Transport Company Master Data) dành riêng cho quản trị viên. Các thao tác lập kế hoạch tàu cập bến, điều động xếp dỡ bãi hoặc điều xe thuộc về nhiệm vụ của nhân viên <strong className="font-semibold text-orange-950">Điều độ cảng (Dispatcher)</strong>.
        </div>
      </div>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-carbon font-heading">Quản lý Hãng tàu & Vận tải</h2>
          <p className="text-xs text-slate mt-1">Quản lý danh sách, trạng thái phê duyệt hãng tàu (Carrier) và nhà vận chuyển ngoại cảng kết nối với hệ thống cảng.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-signal-orange text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors shadow-md flex items-center justify-center gap-2 self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          THÊM ĐỐI TÁC
        </button>
      </div>

      {/* KPI STATS CARD GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI: Total */}
        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">TỔNG ĐỐI TÁC</span>
          <div className="text-3xl font-extrabold text-carbon font-mono">{kpis.total}</div>
          <div className="text-[10px] text-green-600 font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">trending_up</span>
            +12% so với tháng trước
          </div>
          <div className="absolute right-4 bottom-4 text-slate/20">
            <span className="material-symbols-outlined text-4xl">corporate_fare</span>
          </div>
        </div>

        {/* KPI: Active */}
        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">ĐANG HOẠT ĐỘNG</span>
          <div className="text-3xl font-extrabold text-green-600 font-mono">{kpis.active}</div>
          <div className="text-[10px] text-slate font-medium">Tài khoản kết nối trực tiếp</div>
          <div className="absolute right-4 bottom-4 text-green-500/10">
            <span className="material-symbols-outlined text-4xl">task_alt</span>
          </div>
        </div>

        {/* KPI: Pending */}
        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">CHỜ PHÊ DUYỆT</span>
          <div className="text-3xl font-extrabold text-signal-orange font-mono">{kpis.pending}</div>
          <div className="text-[10px] text-slate font-medium">Cần xử lý phê duyệt tài khoản</div>
          <div className="absolute right-4 bottom-4 text-orange-500/10">
            <span className="material-symbols-outlined text-4xl">pending</span>
          </div>
        </div>

        {/* KPI: Locked */}
        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">BỊ KHÓA</span>
          <div className="text-3xl font-extrabold text-red-600 font-mono">{kpis.locked}</div>
          <div className="text-[10px] text-slate font-medium">Vô hiệu hóa truy cập hệ thống</div>
          <div className="absolute right-4 bottom-4 text-red-500/10">
            <span className="material-symbols-outlined text-4xl">lock</span>
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
              placeholder="Tìm kiếm Carrier, Mã hoặc Liên hệ..."
              className="w-full bg-fog border border-chalk rounded-lg pl-9 pr-4 py-2 text-xs text-carbon placeholder-slate focus:outline-none focus:border-signal-orange"
            />
          </div>

          {/* Filters Select */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate font-bold">Trạng thái:</span>
            <div className="flex border border-chalk rounded-lg overflow-hidden bg-fog text-xs font-semibold">
              {['Tất cả', 'Hoạt động', 'Chờ duyệt', 'Tạm khóa'].map(status => (
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

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-fog border-b border-chalk font-mono font-bold text-slate text-[10px] uppercase">
                <th className="px-6 py-4">Tên Carrier / Quốc gia</th>
                <th className="px-6 py-4">Mã</th>
                <th className="px-6 py-4">Người liên hệ</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4 text-center">Số Booking</th>
                <th className="px-6 py-4 text-center">Cont đang xử lý</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4">Ngày đăng ký</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk">
              {filteredCarriers.map((carrier) => (
                <tr
                  key={carrier.id}
                  className="hover:bg-fog/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedCarrier(carrier)}
                >
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-bold text-carbon text-sm">{carrier.name}</div>
                      <div className="text-[10px] text-slate mt-0.5">{carrier.country}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate">{carrier.code}</td>
                  <td className="px-6 py-4 font-semibold text-carbon">{carrier.contact}</td>
                  <td className="px-6 py-4 font-mono text-slate">{carrier.email}</td>
                  <td className="px-6 py-4 text-center font-bold text-carbon font-mono">{carrier.bookings}</td>
                  <td className="px-6 py-4 text-center font-bold text-signal-orange font-mono">{carrier.containers}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      carrier.status === 'Hoạt động'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : carrier.status === 'Chờ duyệt'
                        ? 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {carrier.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate">{carrier.regDate}</td>
                  <td className="px-6 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedCarrier(carrier)}
                      className="px-2.5 py-1 bg-white border border-chalk rounded text-carbon font-bold hover:bg-chalk transition-colors"
                    >
                      Chi tiết
                    </button>
                    {carrier.status === 'Chờ duyệt' && (
                      <button
                        onClick={() => handleApprove(carrier.id)}
                        className="px-2.5 py-1 bg-green-600 text-white rounded font-bold hover:bg-green-700 transition-colors"
                      >
                        Duyệt
                      </button>
                    )}
                    {carrier.status === 'Hoạt động' && (
                      <button
                        onClick={() => handleSuspend(carrier.id)}
                        className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded font-bold hover:bg-red-100 transition-colors"
                      >
                        Khóa
                      </button>
                    )}
                    {carrier.status === 'Tạm khóa' && (
                      <button
                        onClick={() => handleActivate(carrier.id)}
                        className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded font-bold hover:bg-green-100 transition-colors"
                      >
                        Mở khóa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredCarriers.length === 0 && (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-slate font-medium">
                    Không tìm thấy hãng tàu nào khớp với điều kiện lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* DETAIL MODAL PANEL */}
      {selectedCarrier && (
        <div className="fixed inset-0 bg-carbon/50 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={() => setSelectedCarrier(null)}>
          <div
            className="w-full max-w-2xl bg-white max-h-[90vh] rounded-3xl flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-chalk flex justify-between items-center bg-fog">
              <div>
                <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">CHI TIẾT HÃNG TÀU</span>
                <h3 className="text-xl font-extrabold text-carbon mt-0.5">{selectedCarrier.name}</h3>
              </div>
              <button
                onClick={() => setSelectedCarrier(null)}
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
                  {selectedCarrier.code}
                </div>
                <div>
                  <div className="text-xs text-slate font-mono">ID: {selectedCarrier.id}</div>
                  <div className="text-sm font-bold text-carbon">Website: {selectedCarrier.website}</div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border mt-1 ${
                    selectedCarrier.status === 'Hoạt động' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {selectedCarrier.status}
                  </span>
                </div>
              </div>

              {/* Company Information */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Thông tin doanh nghiệp
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate block">Quốc gia đăng ký:</span>
                    <span className="font-semibold text-carbon">{selectedCarrier.country}</span>
                  </div>
                  <div>
                    <span className="text-slate block">Ngày tham gia:</span>
                    <span className="font-mono font-semibold text-carbon">{selectedCarrier.regDate}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate block">Địa chỉ văn phòng VN:</span>
                    <span className="font-semibold text-carbon">{selectedCarrier.address}</span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Người đại diện liên hệ
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate block">Họ & Tên đại diện:</span>
                    <span className="font-semibold text-carbon">{selectedCarrier.contact}</span>
                  </div>
                  <div>
                    <span className="text-slate block">Số điện thoại:</span>
                    <span className="font-mono font-semibold text-carbon">{selectedCarrier.phone}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate block">Email làm việc chính:</span>
                    <span className="font-mono font-semibold text-carbon">{selectedCarrier.email}</span>
                  </div>
                </div>
              </div>

              {/* Port Usage Statistics */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Thống kê khai thác cảng
                </h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-fog p-4 rounded-xl border border-chalk">
                    <span className="text-[10px] font-bold text-slate uppercase block">TỔNG LƯỢT BOOKING</span>
                    <span className="text-2xl font-mono font-extrabold text-carbon mt-1 block">{selectedCarrier.bookings}</span>
                  </div>
                  <div className="bg-fog p-4 rounded-xl border border-chalk">
                    <span className="text-[10px] font-bold text-slate uppercase block">CONTAINER HIỆN TẠI</span>
                    <span className="text-2xl font-mono font-extrabold text-signal-orange mt-1 block">{selectedCarrier.containers}</span>
                  </div>
                </div>
              </div>

              {/* Active Vessels list */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Đội tàu đăng ký hiện hoạt tại cảng
                </h4>
                <div className="space-y-1.5">
                  {selectedCarrier.activeVessels.length > 0 ? (
                    selectedCarrier.activeVessels.map((vessel, idx) => (
                      <div key={idx} className="p-2 bg-fog rounded border border-chalk text-xs font-bold text-carbon flex justify-between">
                        <span>🚢 {vessel}</span>
                        <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">Đang neo đậu / Hải hành</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate italic text-center py-2 bg-fog rounded border border-chalk">
                      Không có đội tàu nào đang làm việc tại cảng.
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Activity Logs */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Nhật ký hoạt động tài khoản
                </h4>
                <div className="space-y-3 text-xs pl-4 relative">
                  <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-chalk"></div>
                  
                  <div className="relative">
                    <div className="absolute -left-4.5 w-2 h-2 rounded-full bg-green-500 mt-1"></div>
                    <div className="font-bold text-carbon">Yêu cầu cấp lệnh booking bổ sung</div>
                    <div className="text-[10px] text-slate font-mono">Hôm nay - 11:20 AM</div>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute -left-4.5 w-2 h-2 rounded-full bg-carbon mt-1"></div>
                    <div className="font-bold text-carbon">Đăng ký thành công lịch tàu cập cảng</div>
                    <div className="text-[10px] text-slate font-mono">Hôm qua - 09:30 AM</div>
                  </div>
                </div>
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-6 border-t border-chalk flex justify-end gap-3 bg-fog">
              <button
                onClick={() => setSelectedCarrier(null)}
                className="px-4 py-2 border border-chalk bg-white text-carbon rounded-lg text-xs font-bold hover:bg-chalk transition-colors"
              >
                ĐÓNG
              </button>
              {selectedCarrier.status === 'Chờ duyệt' && (
                <button
                  onClick={() => handleApprove(selectedCarrier.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                >
                  PHÊ DUYỆT TÀI KHOẢN
                </button>
              )}
              {selectedCarrier.status === 'Hoạt động' && (
                <button
                  onClick={() => handleSuspend(selectedCarrier.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                >
                  TẠM KHÓA TÀI KHOẢN
                </button>
              )}
              {selectedCarrier.status === 'Tạm khóa' && (
                <button
                  onClick={() => handleActivate(selectedCarrier.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                >
                  MỞ KHÓA TÀI KHOẢN
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ADD CARRIER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-carbon/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <h3 className="font-extrabold text-carbon text-lg">Đăng ký Hãng tàu mới (Carrier)</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-fog hover:bg-chalk flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleAddCarrier} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate font-bold">Tên hãng tàu *</label>
                  <input
                    type="text"
                    required
                    value={newCarrier.name}
                    onChange={(e) => setNewCarrier({ ...newCarrier, name: e.target.value })}
                    placeholder="VD: Maersk Việt Nam"
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Mã hãng tàu (SCAC Code) *</label>
                  <input
                    type="text"
                    required
                    maxLength="4"
                    value={newCarrier.code}
                    onChange={(e) => setNewCarrier({ ...newCarrier, code: e.target.value.toUpperCase() })}
                    placeholder="VD: MAEU"
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 uppercase font-mono font-bold focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Người liên hệ đại diện *</label>
                  <input
                    type="text"
                    required
                    value={newCarrier.contact}
                    onChange={(e) => setNewCarrier({ ...newCarrier, contact: e.target.value })}
                    placeholder="VD: Nguyễn Văn B"
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Số điện thoại liên lạc</label>
                  <input
                    type="text"
                    value={newCarrier.phone}
                    onChange={(e) => setNewCarrier({ ...newCarrier, phone: e.target.value })}
                    placeholder="VD: 0901 234 567"
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-slate font-bold">Email đăng ký tài khoản *</label>
                  <input
                    type="email"
                    required
                    value={newCarrier.email}
                    onChange={(e) => setNewCarrier({ ...newCarrier, email: e.target.value })}
                    placeholder="VD: contact@company.com"
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Quốc gia gốc</label>
                  <input
                    type="text"
                    value={newCarrier.country}
                    onChange={(e) => setNewCarrier({ ...newCarrier, country: e.target.value })}
                    placeholder="VD: Đan Mạch"
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Website</label>
                  <input
                    type="text"
                    value={newCarrier.website}
                    onChange={(e) => setNewCarrier({ ...newCarrier, website: e.target.value })}
                    placeholder="VD: www.company.com"
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-mono"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-slate font-bold">Địa chỉ văn phòng tại Việt Nam</label>
                  <textarea
                    rows="2"
                    value={newCarrier.address}
                    onChange={(e) => setNewCarrier({ ...newCarrier, address: e.target.value })}
                    placeholder="Nhập địa chỉ đăng ký kinh doanh..."
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
                  ĐĂNG KÝ HÃNG TÀU
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
