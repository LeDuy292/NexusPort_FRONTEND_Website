import React, { useState, useMemo, useEffect } from 'react'
import AddressAutocomplete from '../../components/AddressAutocomplete'
import { companyService } from '../../services/companyService'

const DEFAULT_SYSTEM_PASSWORD = 'NexusPort@2026'

// Mock initial transport companies data fallback
const INITIAL_COMPANIES = [
  { id: 'TRSP-001', name: 'Logistics Hoành Sơn', code: 'HSLOG', representative: 'Nguyễn Hoành Sơn', phone: '0905 111 222', email: 'contact@hoanhsonlogistics.vn', trucksCount: 35, driversCount: 42, monthlyBookings: 520, status: 'Hoạt động', regDate: '2026-01-15', address: '12 Cảng Đà Nẵng, Q. Sơn Trà, TP. Đà Nẵng', trucks: ['43C-123.45', '43C-567.89', '43R-012.34', '30F-999.99'], drivers: ['Nguyễn Văn A', 'Lê Văn Tám', 'Phạm Minh Hùng'] },
  { id: 'TRSP-002', name: 'Vận tải Thành Hưng', code: 'THLOG', representative: 'Đinh Thành Hưng', phone: '0914 333 444', email: 'thanhhung.trans@gmail.com', trucksCount: 22, driversCount: 25, monthlyBookings: 310, status: 'Hoạt động', regDate: '2026-03-10', address: '124 Nguyễn Lương Bằng, Q. Liên Chiểu, TP. Đà Nẵng', trucks: ['43C-888.88', '43R-555.21', '43C-209.11'], drivers: ['Trần Văn Cường', 'Vũ Quốc Việt'] },
  { id: 'TRSP-003', name: 'Gemadept Logistics', code: 'GMDLOG', representative: 'Trần Thọ Hải', phone: '0989 555 666', email: 'info.danang@gemadept.com.vn', trucksCount: 54, driversCount: 60, monthlyBookings: 890, status: 'Hoạt động', regDate: '2026-01-05', address: 'Khu công nghiệp Hòa Khánh, Q. Liên Chiểu, TP. Đà Nẵng', trucks: ['29H-998.12', '29R-112.04', '43C-901.32'], drivers: ['Bùi Tuấn Anh', 'Nguyễn Đức Thịnh'] },
  { id: 'TRSP-004', name: 'Hải An Transport', code: 'HALOG', representative: 'Phan Minh Tiến', phone: '0972 888 999', email: 'op@haian.com.vn', trucksCount: 18, driversCount: 20, monthlyBookings: 240, status: 'Chờ duyệt', regDate: '2026-08-05', address: '55 Trần Hưng Đạo, Q. Hải Châu, TP. Đà Nẵng', trucks: ['15C-432.11', '15R-098.43'], drivers: ['Ngô Quang Huy', 'Đỗ Mạnh Thắng'] },
  { id: 'TRSP-005', name: 'Vận tải bộ Thuận An', code: 'TALOG', representative: 'Lê Thuận An', phone: '0935 222 333', email: 'thuanan.logistics@yahoo.com', trucksCount: 12, driversCount: 15, monthlyBookings: 150, status: 'Tạm khóa', regDate: '2026-04-18', address: 'Lô C10-4 Đường số 9, KCN Thọ Quang, TP. Đà Nẵng', trucks: ['43C-112.54', '43R-998.01'], drivers: ['Mai Văn Nam', 'Đinh Xuân Trường'] },
  { id: 'TRSP-006', name: 'Logistics Sông Hàn', code: 'SHLOG', representative: 'Bùi Quốc Việt', phone: '0903 555 999', email: 'support@songhanlogistics.com', trucksCount: 8, driversCount: 10, monthlyBookings: 95, status: 'Chờ duyệt', regDate: '2026-08-11', address: '44 Bạch Đằng, Q. Hải Châu, TP. Đà Nẵng', trucks: ['43C-777.65'], drivers: ['Lâm Quốc Hùng'] }
]

export default function TransportCompanyManagement() {
  const [companies, setCompanies] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tất cả')
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [isEditingDetail, setIsEditingDetail] = useState(false)
  const [editFormData, setEditFormData] = useState({})

  // Password & Account States
  const [showAddPassword, setShowAddPassword] = useState(false)
  const [modalShowPassword, setModalShowPassword] = useState(false)
  const [createdAccountModal, setCreatedAccountModal] = useState(null)

  // Form State for new company
  const [newCompany, setNewCompany] = useState({
    name: '',
    code: '',
    representative: '',
    phone: '',
    email: '',
    address: ''
  })

  // Fetch from companyService
  const fetchCompanies = async () => {
    try {
      const data = await companyService.getAll();
      const companiesArray = Array.isArray(data) ? data : (data?.data || []);
      if (companiesArray.length > 0) {
        const mapped = companiesArray.map(c => ({
          id: c.id,
          name: c.companyName || c.name,
          code: c.taxCode || c.code || (c.id ? c.id.substring(0, 8) : 'LOG'),
          representative: c.contactPerson || c.representative || 'Chưa cập nhật',
          phone: c.phone || 'Chưa cập nhật',
          email: c.email || 'Chưa cập nhật',
          trucksCount: c.trucksCount || 0,
          driversCount: c.driversCount || 0,
          monthlyBookings: c.monthlyBookings || 0,
          status: c.status === 'active' || c.status === 'Hoạt động' ? 'Hoạt động' : (c.status === 'suspended' ? 'Tạm khóa' : 'Chờ duyệt'),
          regDate: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : '2026-01-15',
          address: c.address || 'N/A',
          trucks: c.trucks || [],
          drivers: c.drivers || []
        }));
        setCompanies(mapped);
      } else {
        setCompanies(INITIAL_COMPANIES);
      }
    } catch (err) {
      console.warn('Using initial mock companies:', err);
      setCompanies(INITIAL_COMPANIES);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

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
  const handleApprove = async (id) => {
    try {
      await companyService.changeStatus(id, 'active');
    } catch (_) {}
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, status: 'Hoạt động' } : c))
    showToast('✅ Đã phê duyệt đơn vị vận tải hoạt động!')
    if (selectedCompany && selectedCompany.id === id) {
      setSelectedCompany(prev => ({ ...prev, status: 'Hoạt động' }))
    }
  }

  const handleSuspend = async (id) => {
    try {
      await companyService.changeStatus(id, 'suspended');
    } catch (_) {}
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, status: 'Tạm khóa' } : c))
    showToast('🔒 Đã tạm khóa tài khoản đơn vị vận tải!')
    if (selectedCompany && selectedCompany.id === id) {
      setSelectedCompany(prev => ({ ...prev, status: 'Tạm khóa' }))
    }
  }

  const handleActivate = async (id) => {
    try {
      await companyService.changeStatus(id, 'active');
    } catch (_) {}
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, status: 'Hoạt động' } : c))
    showToast('🔓 Đã khôi phục hoạt động cho đơn vị vận tải!')
    if (selectedCompany && selectedCompany.id === id) {
      setSelectedCompany(prev => ({ ...prev, status: 'Hoạt động' }))
    }
  }

  const handleAddCompany = async (e) => {
    e.preventDefault()
    if (!newCompany.name || !newCompany.code || !newCompany.representative || !newCompany.email) {
      showToast('❌ Vui lòng nhập đầy đủ các thông tin bắt buộc!')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newCompany.email.trim())) {
      showToast('❌ Email không đúng định dạng!');
      return;
    }

    try {
      let createdComp = null;
      try {
        createdComp = await companyService.create({
          companyName: newCompany.name,
          taxCode: newCompany.code,
          contactPerson: newCompany.representative,
          email: newCompany.email.trim(),
          phone: newCompany.phone,
          address: newCompany.address,
        });
      } catch (cErr) {
        console.warn('API companyService.create error, continuing with local state:', cErr);
      }

      const carrierId = createdComp?.id || createdComp?.Id || null;
      let accountProvisioned = false;

      // Cấp tài khoản với Email và Mật khẩu mặc định hệ thống NexusPort@2026
      try {
        const cleanEmail = newCompany.email.trim();
        await companyService.provisionAccount({
          email: cleanEmail,
          username: cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail,
          password: DEFAULT_SYSTEM_PASSWORD,
          fullName: newCompany.representative || newCompany.name,
          companyName: newCompany.name,
          carrierId: carrierId,
        });
        accountProvisioned = true;
        setCreatedAccountModal({
          companyName: newCompany.name,
          fullName: newCompany.representative,
          email: cleanEmail,
          password: DEFAULT_SYSTEM_PASSWORD,
          role: 'Transport Company',
          regDate: new Date().toLocaleDateString('vi-VN'),
        });
      } catch (accErr) {
        console.error('Lỗi cấp tài khoản:', accErr);
        showToast('⚠️ Đã thêm đơn vị, nhưng lỗi cấp tài khoản: ' + (accErr.response?.data?.message || accErr.message));
      }

      const companyItem = {
        id: carrierId || `TRSP-0${companies.length + 1}`,
        name: newCompany.name,
        code: newCompany.code,
        representative: newCompany.representative,
        phone: newCompany.phone,
        email: newCompany.email.trim(),
        address: newCompany.address,
        trucksCount: 0,
        driversCount: 0,
        monthlyBookings: 0,
        status: 'Chờ duyệt',
        regDate: new Date().toISOString().split('T')[0],
        trucks: [],
        drivers: []
      };

      setCompanies(prev => [companyItem, ...prev]);
      setShowAddModal(false);
      setNewCompany({
        name: '',
        code: '',
        representative: '',
        phone: '',
        email: '',
        address: ''
      });
      if (!accountProvisioned) {
        showToast('➕ Đăng ký đơn vị vận tải mới thành công!');
      }
      fetchCompanies();
    } catch (err) {
      showToast('❌ Lỗi khi thêm đơn vị vận tải!');
    }
  }

  const openDetailModal = (company) => {
    setSelectedCompany(company);
    setIsEditingDetail(false);
    setEditFormData({
      id: company.id,
      name: company.name,
      code: company.code,
      representative: company.representative,
      phone: company.phone,
      email: company.email,
      address: company.address
    });
  }

  const handleUpdateCompany = async () => {
    try {
      try {
        await companyService.update(selectedCompany.id, {
          companyName: editFormData.name,
          taxCode: editFormData.code,
          contactPerson: editFormData.representative,
          email: editFormData.email,
          phone: editFormData.phone,
          address: editFormData.address,
        });
      } catch (cErr) {
        console.warn('API companyService.update warning:', cErr);
      }

      // Nếu email bị đổi, đồng bộ email tài khoản (mật khẩu giữ nguyên cho chủ sở hữu tự đổi)
      if (editFormData.email && editFormData.email.trim() !== selectedCompany.email) {
        try {
          const cleanEmail = editFormData.email.trim();
          await companyService.provisionAccount({
            email: cleanEmail,
            username: cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail,
            fullName: editFormData.representative || editFormData.name,
            companyName: editFormData.name,
            carrierId: selectedCompany.id,
          });
        } catch (_) {}
      }

      showToast('✅ Cập nhật thông tin đơn vị vận tải thành công!');

      setCompanies(prev => prev.map(c => c.id === selectedCompany.id ? {
        ...c,
        name: editFormData.name,
        code: editFormData.code,
        representative: editFormData.representative,
        phone: editFormData.phone,
        email: editFormData.email,
        address: editFormData.address,
      } : c));

      setSelectedCompany(prev => ({
        ...prev,
        name: editFormData.name,
        code: editFormData.code,
        representative: editFormData.representative,
        phone: editFormData.phone,
        email: editFormData.email,
        address: editFormData.address,
      }));
      setIsEditingDetail(false);
      fetchCompanies();
    } catch (err) {
      showToast('❌ Lỗi cập nhật đơn vị vận tải!');
    }
  }

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  return (
    <div className="p-6 space-y-6">

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-carbon text-white px-5 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 z-[9999] border border-signal-orange animate-bounce">
          <span className="text-signal-orange">●</span>
          {toastMessage}
        </div>
      )}

      {/* Warning business rule banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex gap-3 text-xs text-orange-800">
        <span className="material-symbols-outlined text-signal-orange text-lg">shield</span>
        <div>
          <strong className="font-bold">Quản lý Transport Company:</strong> Khi tạo đơn vị vận tải mới, tài khoản sẽ được cấp tự động với <strong>Email công ty làm tên đăng nhập</strong> và <strong>mật khẩu mặc định hệ thống ({DEFAULT_SYSTEM_PASSWORD})</strong> dùng chung như tài khoản Admin. Quản trị viên không sửa mật khẩu của đối tác — chủ tài khoản sẽ tự đổi mật khẩu sau khi đăng nhập.
        </div>
      </div>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-carbon font-heading">Quản lý Transport Company</h2>
          <p className="text-xs text-slate mt-1">Phê duyệt, quản lý hồ sơ và cấp tài khoản đăng nhập cho đơn vị vận tải container ngoại cảng.</p>
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
        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">TỔNG ĐƠN VỊ VẬN TẢI</span>
          <div className="text-3xl font-extrabold text-carbon font-mono">{kpis.total}</div>
          <div className="text-[10px] text-green-600 font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">trending_up</span>
            Đang hoạt động ổn định
          </div>
          <div className="absolute right-4 bottom-4 text-slate/20">
            <span className="material-symbols-outlined text-4xl">local_shipping</span>
          </div>
        </div>

        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">ĐANG HOẠT ĐỘNG</span>
          <div className="text-3xl font-extrabold text-green-600 font-mono">{kpis.active}</div>
          <span className="text-[10px] text-slate font-medium block">Đã duyệt hợp đồng & pháp nhân</span>
          <div className="absolute right-4 bottom-4 text-green-600/10">
            <span className="material-symbols-outlined text-4xl">check_circle</span>
          </div>
        </div>

        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">CHỜ PHÊ DUYỆT</span>
          <div className="text-3xl font-extrabold text-signal-orange font-mono">{kpis.pending}</div>
          <span className="text-[10px] text-slate font-medium block">Cần kiểm tra giấy phép kinh doanh</span>
          <div className="absolute right-4 bottom-4 text-signal-orange/10">
            <span className="material-symbols-outlined text-4xl">hourglass_top</span>
          </div>
        </div>

        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">TẠM KHÓA</span>
          <div className="text-3xl font-extrabold text-red-500 font-mono">{kpis.locked}</div>
          <span className="text-[10px] text-slate font-medium block">Vi phạm quy chế an toàn cảng</span>
          <div className="absolute right-4 bottom-4 text-red-500/10">
            <span className="material-symbols-outlined text-4xl">lock</span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="bg-white border border-chalk rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate text-sm">search</span>
          <input
            type="text"
            placeholder="Tìm theo tên nhà xe, mã doanh nghiệp, đại diện..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-fog border border-chalk rounded-lg text-xs focus:outline-none focus:border-signal-orange text-carbon"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-bold text-slate whitespace-nowrap">Trạng thái:</span>
          <div className="flex bg-fog p-1 rounded-lg border border-chalk text-xs">
            {['Tất cả', 'Hoạt động', 'Chờ duyệt', 'Tạm khóa'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-md font-bold transition-all ${statusFilter === tab
                  ? 'bg-white text-carbon shadow-sm'
                  : 'text-slate hover:text-carbon'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white border border-chalk rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-fog border-b border-chalk text-slate font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Mã ĐV</th>
                <th className="px-6 py-4">Tên Công Ty Vận Tải</th>
                <th className="px-6 py-4">Đại Diện</th>
                <th className="px-6 py-4">Email Đăng Nhập & SĐT</th>
                <th className="px-6 py-4 text-center">Đội Xe</th>
                <th className="px-6 py-4 text-center">Tài Xế</th>
                <th className="px-6 py-4">Trạng Thái</th>
                <th className="px-6 py-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk">
              {filteredCompanies.map((company) => (
                <tr
                  key={company.id}
                  onClick={() => openDetailModal(company)}
                  className="hover:bg-fog/50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 font-mono font-bold text-carbon">{company.code}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-carbon text-sm">{company.name}</div>
                    <div className="text-[10px] text-slate mt-0.5 line-clamp-1">{company.address}</div>
                  </td>
                  <td className="px-6 py-4 font-medium text-carbon">{company.representative}</td>
                  <td className="px-6 py-4 font-mono text-slate">
                    <div className="font-bold text-carbon">{company.email}</div>
                    <div className="text-[10px]">{company.phone}</div>
                  </td>
                  <td className="px-6 py-4 text-center font-mono font-bold text-carbon">
                    <span className="bg-fog px-2 py-1 rounded border border-chalk">{company.trucksCount || 0} xe</span>
                  </td>
                  <td className="px-6 py-4 text-center font-mono font-bold text-carbon">
                    <span className="bg-fog px-2 py-1 rounded border border-chalk">{company.driversCount || 0} người</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${company.status === 'Hoạt động'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : company.status === 'Chờ duyệt'
                        ? 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse'
                        : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                      {company.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openDetailModal(company)}
                      className="px-2.5 py-1 bg-white border border-chalk rounded text-carbon font-bold hover:bg-chalk transition-colors"
                    >
                      Chi tiết / Sửa
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
                  <td colSpan="8" className="text-center py-8 text-slate font-medium">
                    Không tìm thấy đơn vị vận tải nào khớp với điều kiện lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL & EDIT MODAL PANEL */}
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
              <div className="flex gap-2">
                {!isEditingDetail && (
                  <button
                    onClick={() => setIsEditingDetail(true)}
                    className="w-8 h-8 rounded-full bg-white hover:bg-chalk border border-chalk flex items-center justify-center transition-colors text-signal-orange"
                    title="Chỉnh sửa thông tin đơn vị"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedCompany(null)}
                  className="w-8 h-8 rounded-full bg-white hover:bg-chalk border border-chalk flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Profile Card Summary */}
              <div className="flex items-center gap-4 bg-fog p-4 rounded-xl border border-chalk">
                <div className="w-12 h-12 rounded-xl bg-carbon text-white flex items-center justify-center text-xl font-bold font-mono">
                  {selectedCompany.code}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-slate font-mono">ID: {selectedCompany.id}</div>
                  {isEditingDetail ? (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs font-bold whitespace-nowrap">Tên Cty:</span>
                      <input
                        type="text"
                        className="bg-white border border-chalk rounded px-2 py-1 text-xs w-full font-bold focus:outline-none focus:border-signal-orange"
                        value={editFormData.name || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div className="text-sm font-bold text-carbon">Đại diện: {selectedCompany.representative}</div>
                  )}
                  <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border mt-1 ${selectedCompany.status === 'Hoạt động' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
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
                    {isEditingDetail ? (
                      <input
                        type="text"
                        className="bg-white border border-chalk rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-signal-orange mt-1 font-semibold"
                        value={editFormData.representative || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, representative: e.target.value })}
                      />
                    ) : (
                      <span className="font-semibold text-carbon">{selectedCompany.representative}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate block">Mã doanh nghiệp:</span>
                    {isEditingDetail ? (
                      <input
                        type="text"
                        className="bg-white border border-chalk rounded px-2 py-1 text-xs w-full font-mono uppercase focus:outline-none focus:border-signal-orange mt-1 font-bold"
                        value={editFormData.code || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value.toUpperCase() })}
                      />
                    ) : (
                      <span className="font-mono font-semibold text-carbon">{selectedCompany.code}</span>
                    )}
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate block">Địa chỉ trụ sở chính:</span>
                    {isEditingDetail ? (
                      <textarea
                        className="bg-white border border-chalk rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-signal-orange mt-1"
                        rows="2"
                        value={editFormData.address || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      />
                    ) : (
                      <span className="font-semibold text-carbon">{selectedCompany.address}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Information & Login Account */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Thông tin liên hệ & Tài khoản đăng nhập
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate block">Số điện thoại liên lạc:</span>
                    {isEditingDetail ? (
                      <input
                        type="text"
                        className="bg-white border border-chalk rounded px-2 py-1 text-xs w-full font-mono focus:outline-none focus:border-signal-orange mt-1"
                        value={editFormData.phone || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      />
                    ) : (
                      <span className="font-mono font-semibold text-carbon">{selectedCompany.phone}</span>
                    )}
                  </div>

                  {/* KHỐI TÀI KHOẢN: EMAIL ĐĂNG NHẬP & BẢO MẬT MẬT KHẨU */}
                  <div className="col-span-2 p-4 bg-orange-50/70 rounded-2xl border border-orange-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-signal-orange text-lg">admin_panel_settings</span>
                      <span className="font-extrabold text-xs text-carbon">Tài khoản đăng nhập Transport Company</span>
                    </div>

                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-slate font-bold block">Email nhận thông báo / Đăng nhập *</label>
                        {isEditingDetail ? (
                          <input
                            type="email"
                            required
                            className="bg-white border border-chalk rounded-lg p-2 text-xs w-full font-mono focus:outline-none focus:border-signal-orange font-bold text-carbon"
                            value={editFormData.email || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                          />
                        ) : (
                          <div className="font-mono font-bold text-sm text-carbon bg-white p-2 rounded-lg border border-chalk">
                            {selectedCompany.email}
                          </div>
                        )}
                      </div>

                      {/* Thông báo bảo mật: Admin không được sửa mật khẩu của chủ nhân */}
                      <div className="bg-white p-3 rounded-xl border border-chalk flex items-start gap-2.5 text-slate">
                        <span className="material-symbols-outlined text-signal-orange text-base flex-shrink-0 mt-0.5">lock</span>
                        <div className="text-[11px] leading-relaxed">
                          <strong className="text-carbon font-bold block">Mật khẩu bảo mật cá nhân:</strong>
                          Tài khoản ban đầu được cấp với mật khẩu hệ thống mặc định (<code className="bg-fog px-1.5 py-0.5 rounded text-carbon font-mono font-bold">{DEFAULT_SYSTEM_PASSWORD}</code>). Quản trị viên <strong>không thể can thiệp hoặc thay đổi mật khẩu</strong> của đối tác; chủ tài khoản sẽ tự đổi mật khẩu riêng sau khi đăng nhập.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Quy mô năng lực
                </h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-fog p-3 rounded-xl border border-chalk">
                    <span className="text-[10px] text-slate uppercase font-bold block">Đầu kéo</span>
                    <span className="text-lg font-mono font-extrabold text-carbon mt-0.5 block">{selectedCompany.trucksCount || 0} xe</span>
                  </div>
                  <div className="bg-fog p-3 rounded-xl border border-chalk">
                    <span className="text-[10px] text-slate uppercase font-bold block">Tài xế</span>
                    <span className="text-lg font-mono font-extrabold text-carbon mt-0.5 block">{selectedCompany.driversCount || 0} người</span>
                  </div>
                  <div className="bg-fog p-3 rounded-xl border border-chalk">
                    <span className="text-[10px] text-slate uppercase font-bold block">Lượt booking/tháng</span>
                    <span className="text-lg font-mono font-extrabold text-signal-orange mt-0.5 block">{selectedCompany.monthlyBookings || 0} lượt</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-6 border-t border-chalk flex justify-end gap-3 bg-fog">
              {isEditingDetail ? (
                <>
                  <button
                    onClick={() => setIsEditingDetail(false)}
                    className="px-4 py-2 border border-chalk bg-white text-carbon rounded-lg text-xs font-bold hover:bg-chalk transition-colors"
                  >
                    HỦY THAY ĐỔI
                  </button>
                  <button
                    onClick={handleUpdateCompany}
                    className="px-4 py-2 bg-signal-orange text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors shadow-md"
                  >
                    LƯU THÔNG TIN ĐƠN VỊ
                  </button>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* CREATED ACCOUNT SUCCESS POPUP MODAL */}
      {createdAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-carbon/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-chalk overflow-hidden transform transition-all animate-scale-in">
            <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-6 text-white text-center relative">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                <span className="material-symbols-outlined text-3xl">corporate_fare</span>
              </div>
              <h3 className="text-lg font-black tracking-tight">ĐÃ CẤP TÀI KHOẢN TRANSPORT COMPANY!</h3>
              <p className="text-xs text-orange-100 mt-1">Thông tin đăng nhập Cổng Hãng Vận Tải (Carrier Portal)</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-fog rounded-xl p-4 border border-chalk space-y-3">
                <div className="flex justify-between items-center text-xs pb-2 border-b border-chalk">
                  <span className="text-slate font-medium">Đơn vị vận tải:</span>
                  <span className="font-bold text-carbon text-sm">{createdAccountModal.companyName}</span>
                </div>

                {createdAccountModal.fullName && (
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-chalk">
                    <span className="text-slate font-medium">Người đại diện:</span>
                    <span className="font-bold text-carbon">{createdAccountModal.fullName}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-xs pb-2 border-b border-chalk">
                  <span className="text-slate font-medium">Email đăng nhập:</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded">
                    <span>{createdAccountModal.email}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(createdAccountModal.email);
                        showToast('📋 Đã sao chép Email đăng nhập vào clipboard!');
                      }}
                      className="hover:text-orange-950 p-0.5"
                      title="Sao chép"
                    >
                      <span className="material-symbols-outlined text-xs">content_copy</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pb-2 border-b border-chalk">
                  <span className="text-slate font-medium">Mật khẩu khởi tạo:</span>
                  <div className="flex items-center gap-2 font-mono font-bold text-carbon bg-slate-100 px-2.5 py-1 rounded border border-chalk">
                    <span className="tracking-wider">
                      {modalShowPassword ? createdAccountModal.password : '••••••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setModalShowPassword(v => !v)}
                      className="text-slate-600 hover:text-carbon p-0.5 ml-1 transition-colors"
                      title={modalShowPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {modalShowPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(createdAccountModal.password);
                        showToast('📋 Đã sao chép Mật khẩu vào clipboard!');
                      }}
                      className="hover:text-carbon p-0.5 transition-colors"
                      title="Sao chép"
                    >
                      <span className="material-symbols-outlined text-xs">content_copy</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate font-medium">Vai trò hệ thống:</span>
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-800 font-bold rounded-full text-[10px]">Transport Company</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base flex-shrink-0 mt-0.5">info</span>
                <span>Tài khoản dùng mật khẩu khởi tạo chung của hệ thống (<strong className="font-mono">{DEFAULT_SYSTEM_PASSWORD}</strong>). Chủ doanh nghiệp vui lòng tự đổi mật khẩu sau khi đăng nhập vào hệ thống.</span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = `NEXUSPORT - THÔNG TIN TÀI KHOẢN ĐƠN VỊ VẬN TẢI (TRANSPORT COMPANY)\n=========================================================\nĐơn vị vận tải: ${createdAccountModal.companyName}\nĐại diện: ${createdAccountModal.fullName || 'N/A'}\nEmail đăng nhập: ${createdAccountModal.email}\nMật khẩu khởi tạo: ${createdAccountModal.password}\nVai trò: Transport Company (Hãng vận tải / Đối tác)\nCổng đăng nhập: ${window.location.origin}/login\nThời gian cấp: ${new Date().toLocaleString('vi-VN')}\n* Lưu ý: Chủ sở hữu vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên.\n`;
                    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `TaiKhoan_TransportCompany_${createdAccountModal.email.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('💾 Đã lưu thông tin tài khoản về máy!');
                  }}
                  className="flex-1 h-11 border border-orange-400 bg-orange-50 text-orange-900 rounded-xl text-xs font-bold hover:bg-orange-100 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm text-orange-700">save_alt</span>
                  Lưu file tài khoản
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = `Tài khoản Transport Company NexusPort:\n- Đơn vị: ${createdAccountModal.companyName}\n- Email đăng nhập: ${createdAccountModal.email}\n- Mật khẩu khởi tạo: ${createdAccountModal.password}\n- Vai trò: Transport Company\n- Đăng nhập tại: ${window.location.origin}/login\n(Chủ doanh nghiệp tự đổi mật khẩu sau khi đăng nhập)`;
                    navigator.clipboard.writeText(text);
                    showToast('📋 Đã sao chép toàn bộ thông tin tài khoản!');
                  }}
                  className="h-11 px-3 border border-chalk bg-white text-carbon rounded-xl text-xs font-bold hover:bg-fog transition-colors flex items-center justify-center gap-1"
                  title="Sao chép toàn bộ"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreatedAccountModal(null)}
                  className="flex-1 h-11 bg-carbon text-white rounded-xl text-xs font-bold hover:bg-black transition-colors"
                >
                  Xong & Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD COMPANY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-carbon/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <div>
                <h3 className="font-extrabold text-carbon text-lg">Đăng ký Đơn vị Vận tải mới</h3>
                <p className="text-[11px] text-slate mt-0.5">Tạo hồ sơ và cấp tài khoản đăng nhập Cổng vận tải</p>
              </div>
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
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-bold text-carbon"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Mã doanh nghiệp (Mã nhà xe) *</label>
                  <input
                    type="text"
                    required
                    maxLength="10"
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
                <div className="space-y-1 col-span-2">
                  <label className="text-slate font-bold">Số điện thoại liên lạc</label>
                  <input
                    type="text"
                    value={newCompany.phone}
                    onChange={(e) => setNewCompany({ ...newCompany, phone: e.target.value })}
                    placeholder="VD: 0903 555 999"
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-mono"
                  />
                </div>

                {/* KHỐI EMAIL & MẬT KHẨU MẶC ĐỊNH HỆ THỐNG */}
                <div className="space-y-3 p-4 bg-orange-50/80 rounded-2xl border border-orange-200 col-span-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-signal-orange text-lg">admin_panel_settings</span>
                    <span className="font-extrabold text-xs text-carbon">Tài khoản đăng nhập Transport Company (Dùng chung Email)</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-slate font-bold">Email đăng nhập hệ thống *</label>
                      <input
                        type="email"
                        required
                        value={newCompany.email}
                        onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
                        placeholder="VD: support@songhan.vn"
                        className="w-full bg-white border border-chalk rounded-lg p-2.5 font-mono text-carbon focus:outline-none focus:border-signal-orange font-bold text-xs"
                      />
                      <span className="text-[10px] text-slate block">Email công ty dùng làm tài khoản đăng nhập.</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate font-bold">Mật khẩu khởi tạo hệ thống</label>
                      <div className="relative">
                        <input
                          type={showAddPassword ? 'text' : 'password'}
                          readOnly
                          value={DEFAULT_SYSTEM_PASSWORD}
                          className="w-full bg-slate-100 border border-chalk rounded-lg p-2.5 pr-10 font-mono tracking-wider text-carbon cursor-not-allowed select-none font-bold text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAddPassword(!showAddPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate hover:text-carbon p-1"
                          title={showAddPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          <span className="material-symbols-outlined text-base">
                            {showAddPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                      <span className="text-[10px] text-slate block">Dùng chung mật khẩu mặc định ({DEFAULT_SYSTEM_PASSWORD}), đối tác sẽ tự đổi sau khi đăng nhập.</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-slate font-bold">Địa chỉ trụ sở chính</label>
                  <AddressAutocomplete
                    value={newCompany.address}
                    onChange={(val) => setNewCompany({ ...newCompany, address: val })}
                    placeholder="Tìm kiếm địa chỉ tại Việt Nam..."
                    inputClassName="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange text-xs"
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
                  className="px-4 py-2.5 bg-signal-orange text-white rounded-lg font-bold hover:bg-orange-600 transition-colors shadow-md flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">how_to_reg</span>
                  ĐĂNG KÝ & CẤP TÀI KHOẢN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
