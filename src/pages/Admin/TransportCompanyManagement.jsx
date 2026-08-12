import React, { useState, useMemo } from 'react'

// Mock initial transport companies data
const INITIAL_COMPANIES = [
  { id: 'TRSP-001', name: 'Logistics Hoành Sơn', code: 'HSLOG', representative: 'Nguyễn Hoành Sơn', phone: '0905 111 222', email: 'contact@hoanhsonlogistics.vn', trucksCount: 35, driversCount: 42, monthlyBookings: 520, status: 'Hoạt động', regDate: '2026-01-15', address: '12 Cảng Đà Nẵng, Q. Sơn Trà, TP. Đà Nẵng', trucks: ['43C-123.45', '43C-567.89', '43R-012.34', '30F-999.99'], drivers: ['Nguyễn Văn A', 'Lê Văn Tám', 'Phạm Minh Hùng'] },
  { id: 'TRSP-002', name: 'Vận tải Thành Hưng', code: 'THLOG', representative: 'Đinh Thành Hưng', phone: '0914 333 444', email: 'thanhhung.trans@gmail.com', trucksCount: 22, driversCount: 25, monthlyBookings: 310, status: 'Hoạt động', regDate: '2026-03-10', address: '124 Nguyễn Lương Bằng, Q. Liên Chiểu, TP. Đà Nẵng', trucks: ['43C-888.88', '43R-555.21', '43C-209.11'], drivers: ['Trần Văn Cường', 'Vũ Quốc Việt'] },
  { id: 'TRSP-003', name: 'Gemadept Logistics', code: 'GMDLOG', representative: 'Trần Thọ Hải', phone: '0989 555 666', email: 'info.danang@gemadept.com.vn', trucksCount: 54, driversCount: 60, monthlyBookings: 890, status: 'Hoạt động', regDate: '2026-01-05', address: 'Khu công nghiệp Hòa Khánh, Q. Liên Chiểu, TP. Đà Nẵng', trucks: ['29H-998.12', '29R-112.04', '43C-901.32'], drivers: ['Bùi Tuấn Anh', 'Nguyễn Đức Thịnh'] },
  { id: 'TRSP-004', name: 'Hải An Transport', code: 'HALOG', representative: 'Phan Minh Tiến', phone: '0972 888 999', email: 'op@haian.com.vn', trucksCount: 18, driversCount: 20, monthlyBookings: 240, status: 'Chờ duyệt', regDate: '2026-08-05', address: '55 Trần Hưng Đạo, Q. Hải Châu, TP. Đà Nẵng', trucks: ['15C-432.11', '15R-098.43'], drivers: ['Ngô Quang Huy', 'Đỗ Mạnh Thắng'] },
  { id: 'TRSP-005', name: 'Vận tải bộ Thuận An', code: 'TALOG', representative: 'Lê Thuận An', phone: '0935 222 333', email: 'thuanan.logistics@yahoo.com', trucksCount: 12, driversCount: 15, monthlyBookings: 150, status: 'Tạm khóa', regDate: '2026-04-18', address: 'Lô C10-4 Đường số 9, KCN Thọ Quang, TP. Đà Nẵng', trucks: ['43C-112.54', '43R-998.01'], drivers: ['Mai Văn Nam', 'Đinh Xuân Trường'] },
  { id: 'TRSP-006', name: 'Logistics Sông Hàn', code: 'SHLOG', representative: 'Bùi Quốc Việt', phone: '0903 555 999', email: 'support@songhanlogistics.com', trucksCount: 8, driversCount: 10, monthlyBookings: 95, status: 'Chờ duyệt', regDate: '2026-08-11', address: '44 Bạch Đằng, Q. Hải Châu, TP. Đà Nẵng', trucks: ['43C-777.65'], drivers: ['Lâm Quốc Hùng'] }
]

export default function TransportCompanyManagement() {
  const [companies, setCompanies] = useState(INITIAL_COMPANIES)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tất cả')
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Form State for new company
  const [newCompany, setNewCompany] = useState({
    name: '',
    code: '',
    representative: '',
    phone: '',
    email: '',
    address: ''
  })

  // KPI Calculations
  const kpis = useMemo(() => {
    return {
      total: companies.length,
      active: companies.filter(c => c.status === 'Hoạt động').length,
      pending: companies.filter(c => c.status === 'Chờ duyệt').length,
      locked: companies.filter(c => c.status === 'Tạm khóa').length
    }
  }, [companies])

  // Filtered Companies
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.representative.toLowerCase().includes(searchTerm.toLowerCase())
      const matchStatus = statusFilter === 'Tất cả' || c.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [companies, searchTerm, statusFilter])

  // Actions
  const handleApprove = (id) => {
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, status: 'Hoạt động' } : c))
    showToast('✅ Đã phê duyệt đơn vị vận tải hoạt động!')
    if (selectedCompany && selectedCompany.id === id) {
      setSelectedCompany(prev => ({ ...prev, status: 'Hoạt động' }))
    }
  }

  const handleSuspend = (id) => {
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, status: 'Tạm khóa' } : c))
    showToast('🔒 Đã tạm khóa tài khoản đơn vị vận tải!')
    if (selectedCompany && selectedCompany.id === id) {
      setSelectedCompany(prev => ({ ...prev, status: 'Tạm khóa' }))
    }
  }

  const handleActivate = (id) => {
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, status: 'Hoạt động' } : c))
    showToast('🔓 Đã khôi phục hoạt động cho đơn vị vận tải!')
    if (selectedCompany && selectedCompany.id === id) {
      setSelectedCompany(prev => ({ ...prev, status: 'Hoạt động' }))
    }
  }

  const handleAddCompany = (e) => {
    e.preventDefault()
    if (!newCompany.name || !newCompany.code || !newCompany.representative || !newCompany.email) {
      showToast('❌ Vui lòng nhập đầy đủ các thông tin bắt buộc!')
      return
    }

    const company = {
      id: `TRSP-0${companies.length + 1}`,
      ...newCompany,
      trucksCount: 0,
      driversCount: 0,
      monthlyBookings: 0,
      status: 'Chờ duyệt',
      regDate: new Date().toISOString().split('T')[0],
      trucks: [],
      drivers: []
    }

    setCompanies(prev => [company, ...prev])
    setShowAddModal(false)
    setNewCompany({ name: '', code: '', representative: '', phone: '', email: '', address: '' })
    showToast('➕ Đăng ký đơn vị vận tải mới thành công! Đang chờ phê duyệt.')
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
        <span className="material-symbols-outlined text-signal-orange text-lg">shield</span>
        <div>
          <strong className="font-bold">Giới hạn quyền hạn Admin:</strong> Đơn vị vận tải (Transport Company) là đối tác bên ngoài. Quản trị viên chỉ phê duyệt pháp nhân, quản lý tài khoản và thông tin cấu hình Master Data. Quyền điều xe trực địa, phân lệnh điều phối (Dispatch) và duyệt xe vào/ra cổng thuộc về **Dispatcher** và **Gate Officer**.
        </div>
      </div>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-carbon font-heading">Quản lý Transport Company</h2>
          <p className="text-xs text-slate mt-1">Phê duyệt và quản lý hồ sơ đăng ký của các nhà xe/đơn vị vận tải container ngoại cảng.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-signal-orange text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-orange-600 transition-colors shadow-md flex items-center justify-center gap-2 self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-sm">domain</span>
          THÊM ĐƠN VỊ VẬN TẢI
        </button>
      </div>

      {/* KPI STATS CARD GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI: Total */}
        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">TỔNG ĐƠN VỊ VẬN TẢI</span>
          <div className="text-3xl font-extrabold text-carbon font-mono">{kpis.total}</div>
          <div className="text-[10px] text-green-600 font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">trending_up</span>
            +8% so với quý trước
          </div>
          <div className="absolute right-4 bottom-4 text-slate/20">
            <span className="material-symbols-outlined text-4xl">local_shipping</span>
          </div>
        </div>

        {/* KPI: Active */}
        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">ĐANG HOẠT ĐỘNG</span>
          <div className="text-3xl font-extrabold text-green-600 font-mono">{kpis.active}</div>
          <div className="text-[10px] text-slate font-medium">Được phép đăng ký lệnh kéo vỏ</div>
          <div className="absolute right-4 bottom-4 text-green-500/10">
            <span className="material-symbols-outlined text-4xl">check_circle</span>
          </div>
        </div>

        {/* KPI: Pending */}
        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">CHỜ PHÊ DUYỆT</span>
          <div className="text-3xl font-extrabold text-signal-orange font-mono">{kpis.pending}</div>
          <div className="text-[10px] text-slate font-medium">Đơn đăng ký mới cần thẩm định</div>
          <div className="absolute right-4 bottom-4 text-orange-500/10">
            <span className="material-symbols-outlined text-4xl">inventory</span>
          </div>
        </div>

        {/* KPI: Locked */}
        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">TẠM KHÓA</span>
          <div className="text-3xl font-extrabold text-red-600 font-mono">{kpis.locked}</div>
          <div className="text-[10px] text-slate font-medium">Khóa lệnh tạm thời/Vi phạm nội quy</div>
          <div className="absolute right-4 bottom-4 text-red-500/10">
            <span className="material-symbols-outlined text-4xl">no_accounts</span>
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
              placeholder="Tìm tên nhà xe, mã hoặc người đại diện..."
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

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-fog border-b border-chalk font-mono font-bold text-slate text-[10px] uppercase">
                <th className="px-6 py-4">Tên đơn vị vận tải</th>
                <th className="px-6 py-4">Mã Transport</th>
                <th className="px-6 py-4">Người đại diện</th>
                <th className="px-6 py-4">Số điện thoại</th>
                <th className="px-6 py-4 text-center">Số Xe</th>
                <th className="px-6 py-4 text-center">Số Tài xế</th>
                <th className="px-6 py-4 text-center">Booking tháng này</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4">Ngày đăng ký</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk">
              {filteredCompanies.map((company) => (
                <tr
                  key={company.id}
                  className="hover:bg-fog/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedCompany(company)}
                >
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-bold text-carbon text-sm">{company.name}</div>
                      <div className="text-[10px] text-slate mt-0.5 truncate max-w-xs">{company.address}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate">{company.code}</td>
                  <td className="px-6 py-4 font-semibold text-carbon">{company.representative}</td>
                  <td className="px-6 py-4 font-mono text-slate">{company.phone}</td>
                  <td className="px-6 py-4 text-center font-bold text-carbon font-mono">{company.trucksCount}</td>
                  <td className="px-6 py-4 text-center font-bold text-carbon font-mono">{company.driversCount}</td>
                  <td className="px-6 py-4 text-center font-bold text-signal-orange font-mono">{company.monthlyBookings}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      company.status === 'Hoạt động'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : company.status === 'Chờ duyệt'
                        ? 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {company.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate">{company.regDate}</td>
                  <td className="px-6 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedCompany(company)}
                      className="px-2.5 py-1 bg-white border border-chalk rounded text-carbon font-bold hover:bg-chalk transition-colors"
                    >
                      Chi tiết
                    </button>
                    {company.status === 'Chờ duyệt' && (
                      <button
                        onClick={() => handleApprove(company.id)}
                        className="px-2.5 py-1 bg-green-600 text-white rounded font-bold hover:bg-green-700 transition-colors"
                      >
                        Duyệt
                      </button>
                    )}
                    {company.status === 'Hoạt động' && (
                      <button
                        onClick={() => handleSuspend(company.id)}
                        className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded font-bold hover:bg-red-100 transition-colors"
                      >
                        Khóa
                      </button>
                    )}
                    {company.status === 'Tạm khóa' && (
                      <button
                        onClick={() => handleActivate(company.id)}
                        className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded font-bold hover:bg-green-100 transition-colors"
                      >
                        Mở khóa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredCompanies.length === 0 && (
                <tr>
                  <td colSpan="10" className="text-center py-8 text-slate font-medium">
                    Không tìm thấy đơn vị vận tải nào khớp với điều kiện lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* DETAIL MODAL PANEL */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-carbon/50 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={() => setSelectedCompany(null)}>
          <div
            className="w-full max-w-2xl bg-white max-h-[90vh] rounded-3xl flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-chalk flex justify-between items-center bg-fog">
              <div>
                <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">HỒ SƠ ĐƠN VỊ VẬN TẢI</span>
                <h3 className="text-xl font-extrabold text-carbon mt-0.5">{selectedCompany.name}</h3>
              </div>
              <button
                onClick={() => setSelectedCompany(null)}
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
                  {selectedCompany.code}
                </div>
                <div>
                  <div className="text-xs text-slate font-mono">ID: {selectedCompany.id}</div>
                  <div className="text-sm font-bold text-carbon">Đại diện: {selectedCompany.representative}</div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border mt-1 ${
                    selectedCompany.status === 'Hoạt động' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {selectedCompany.status}
                  </span>
                </div>
              </div>

              {/* Company Information */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Thông tin công ty
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate block">Người đại diện pháp luật:</span>
                    <span className="font-semibold text-carbon">{selectedCompany.representative}</span>
                  </div>
                  <div>
                    <span className="text-slate block">Ngày đăng ký hệ thống:</span>
                    <span className="font-mono font-semibold text-carbon">{selectedCompany.regDate}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate block">Địa chỉ trụ sở chính:</span>
                    <span className="font-semibold text-carbon">{selectedCompany.address}</span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Thông tin liên hệ
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate block">Số điện thoại liên lạc:</span>
                    <span className="font-mono font-semibold text-carbon">{selectedCompany.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate block">Email nhận thông báo lệnh:</span>
                    <span className="font-mono font-semibold text-carbon">{selectedCompany.email}</span>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Tổng quan nguồn lực và lượt giao dịch
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-fog p-3 rounded-xl border border-chalk">
                    <span className="text-[9px] font-bold text-slate block">SỐ XE KÉO</span>
                    <span className="text-lg font-mono font-extrabold text-carbon mt-0.5 block">{selectedCompany.trucksCount} xe</span>
                  </div>
                  <div className="bg-fog p-3 rounded-xl border border-chalk">
                    <span className="text-[9px] font-bold text-slate block">SỐ TÀI XẾ</span>
                    <span className="text-lg font-mono font-extrabold text-carbon mt-0.5 block">{selectedCompany.driversCount} người</span>
                  </div>
                  <div className="bg-fog p-3 rounded-xl border border-chalk">
                    <span className="text-[9px] font-bold text-slate block">BOOKING THÁNG</span>
                    <span className="text-lg font-mono font-extrabold text-signal-orange mt-0.5 block">{selectedCompany.monthlyBookings} lượt</span>
                  </div>
                </div>
              </div>

              {/* Registered Trucks List */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Danh sách xe kéo đã phê duyệt đầu kéo
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCompany.trucks.length > 0 ? (
                    selectedCompany.trucks.map((plate, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-fog rounded border border-chalk font-mono font-bold text-xs text-carbon">
                        🚛 {plate}
                      </span>
                    ))
                  ) : (
                    <div className="text-xs text-slate italic w-full text-center py-2 bg-fog rounded border border-chalk">
                      Chưa có xe kéo nào được đăng ký.
                    </div>
                  )}
                </div>
              </div>

              {/* Registered Drivers List */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Danh sách tài xế vận tải
                </h4>
                <div className="space-y-1.5">
                  {selectedCompany.drivers.length > 0 ? (
                    selectedCompany.drivers.map((driverName, idx) => (
                      <div key={idx} className="p-2 bg-fog rounded border border-chalk text-xs font-bold text-carbon flex justify-between items-center">
                        <span>👤 {driverName}</span>
                        <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 font-mono">Đã xác minh GPLX</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate italic text-center py-2 bg-fog rounded border border-chalk">
                      Chưa có tài xế nào được đăng ký.
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Booking History */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Lịch sử lượt Booking gần nhất
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-fog rounded-xl border border-chalk flex justify-between items-center">
                    <div>
                      <div className="font-bold text-carbon">Booking BK-1094 (Lấy Cont)</div>
                      <div className="text-[10px] text-slate mt-0.5">Xe 43C-123.45 • Tài xế Nguyễn Văn A</div>
                    </div>
                    <span className="font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">Đã Gate-Out</span>
                  </div>
                  <div className="p-2.5 bg-fog rounded-xl border border-chalk flex justify-between items-center">
                    <div>
                      <div className="font-bold text-carbon">Booking BK-1088 (Trả Cont)</div>
                      <div className="text-[10px] text-slate mt-0.5">Xe 43C-888.88 • Tài xế Trần Văn Cường</div>
                    </div>
                    <span className="font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">Đã Gate-Out</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-6 border-t border-chalk flex justify-end gap-3 bg-fog">
              <button
                onClick={() => setSelectedCompany(null)}
                className="px-4 py-2 border border-chalk bg-white text-carbon rounded-lg text-xs font-bold hover:bg-chalk transition-colors"
              >
                ĐÓNG
              </button>
              {selectedCompany.status === 'Chờ duyệt' && (
                <button
                  onClick={() => handleApprove(selectedCompany.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                >
                  PHÊ DUYỆT ĐĂNG KÝ
                </button>
              )}
              {selectedCompany.status === 'Hoạt động' && (
                <button
                  onClick={() => handleSuspend(selectedCompany.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                >
                  TẠM KHÓA HOẠT ĐỘNG
                </button>
              )}
              {selectedCompany.status === 'Tạm khóa' && (
                <button
                  onClick={() => handleActivate(selectedCompany.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                >
                  KÍCH HOẠT LẠI
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ADD COMPANY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-carbon/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <h3 className="font-extrabold text-carbon text-lg">Đăng ký Đơn vị Vận tải mới</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-fog hover:bg-chalk flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleAddCompany} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-slate font-bold">Tên công ty vận tải *</label>
                  <input
                    type="text"
                    required
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                    placeholder="VD: Công ty TNHH Vận tải Sông Hàn"
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Mã doanh nghiệp (Mã nhà xe) *</label>
                  <input
                    type="text"
                    required
                    maxLength="6"
                    value={newCompany.code}
                    onChange={(e) => setNewCompany({ ...newCompany, code: e.target.value.toUpperCase() })}
                    placeholder="VD: SHLOG"
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 uppercase font-mono font-bold focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Người đại diện pháp luật *</label>
                  <input
                    type="text"
                    required
                    value={newCompany.representative}
                    onChange={(e) => setNewCompany({ ...newCompany, representative: e.target.value })}
                    placeholder="VD: Bùi Quốc Việt"
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Số điện thoại *</label>
                  <input
                    type="text"
                    required
                    value={newCompany.phone}
                    onChange={(e) => setNewCompany({ ...newCompany, phone: e.target.value })}
                    placeholder="VD: 0903 555 999"
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Email chính *</label>
                  <input
                    type="email"
                    required
                    value={newCompany.email}
                    onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
                    placeholder="VD: support@songhan.vn"
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-mono"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-slate font-bold">Địa chỉ trụ sở chính</label>
                  <textarea
                    rows="2"
                    value={newCompany.address}
                    onChange={(e) => setNewCompany({ ...newCompany, address: e.target.value })}
                    placeholder="Nhập địa chỉ trụ sở chính đăng ký..."
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
                  ĐĂNG KÝ DOANH NGHIỆP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
