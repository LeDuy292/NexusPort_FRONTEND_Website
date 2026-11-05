import React, { useState, useMemo, useEffect } from 'react'
import AddressAutocomplete from '../../components/AddressAutocomplete'
import { companyService } from '../../services/companyService'
import driverService from '../../services/driverService'

const DEFAULT_SYSTEM_PASSWORD = 'NexusPort@2026'

export default function CarrierManagement() {
  const [carriers, setCarriers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tất cả')
  const [selectedCarrier, setSelectedCarrier] = useState(null) // for Detail Drawer
  const [showAddModal, setShowAddModal] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [isEditingDetail, setIsEditingDetail] = useState(false)
  const [editFormData, setEditFormData] = useState({})
  const [companyDrivers, setCompanyDrivers] = useState([])
  const [loadingDrivers, setLoadingDrivers] = useState(false)

  // Password & Account States
  const [showAddPassword, setShowAddPassword] = useState(false)
  const [modalShowPassword, setModalShowPassword] = useState(false)
  const [createdAccountModal, setCreatedAccountModal] = useState(null)

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

  // API Fetch
  const fetchCarriers = async () => {
    try {
      const data = await companyService.getAll();
      const companiesArray = Array.isArray(data) ? data : (data?.data || []);
      const mapped = companiesArray.map(c => ({
        id: c.id,
        name: c.companyName,
        code: c.taxCode || (c.id ? c.id.substring(0, 8) : 'CARRIER'),
        contact: c.contactPerson || 'Chưa cập nhật',
        email: c.email || 'Chưa cập nhật',
        phone: c.phone || 'Chưa cập nhật',
        bookings: 0,
        containers: 0,
        status: c.status === 'active' ? 'Hoạt động' : (c.status === 'suspended' ? 'Tạm khóa' : 'Chờ duyệt'),
        regDate: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : '2026-01-15',
        country: c.country || 'Việt Nam',
        website: c.website || 'N/A',
        address: c.address || 'N/A',
        activeVessels: []
      }));
      setCarriers(mapped);
    } catch (err) {
      console.error(err);
      showToast('❌ Lỗi khi tải danh sách hãng tàu!');
    }
  };

  useEffect(() => {
    fetchCarriers();
  }, []);

  // Actions
  const handleChangeStatus = async (id, targetStatus, successMsg) => {
    try {
      await companyService.changeStatus(id, targetStatus);
      showToast(successMsg);
      fetchCarriers();
      if (selectedCarrier && selectedCarrier.id === id) {
        setSelectedCarrier(prev => ({ ...prev, status: targetStatus === 'active' ? 'Hoạt động' : (targetStatus === 'suspended' ? 'Tạm khóa' : 'Chờ duyệt') }));
      }
    } catch (err) {
      showToast('❌ Lỗi cập nhật trạng thái!');
    }
  };

  const handleApprove = (id) => handleChangeStatus(id, 'active', '✅ Đã phê duyệt hãng tàu thành công!');
  const handleSuspend = (id) => handleChangeStatus(id, 'suspended', '🔒 Đã tạm khóa tài khoản hãng tàu!');
  const handleActivate = (id) => handleChangeStatus(id, 'active', '🔓 Đã kích hoạt lại tài khoản hãng tàu!');

  const handleAddCarrier = async (e) => {
    e.preventDefault()
    if (!newCarrier.name || !newCarrier.code || !newCarrier.contact || !newCarrier.email) {
      showToast('❌ Vui lòng nhập đầy đủ các thông tin bắt buộc!')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newCarrier.email.trim())) {
      showToast('❌ Email không đúng định dạng!');
      return;
    }

    const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
    if (newCarrier.phone && !phoneRegex.test(newCarrier.phone.replace(/\s+/g, ''))) {
      showToast('❌ Số điện thoại không hợp lệ (Bắt đầu bằng 03/05/07/08/09 và đủ 10 số)!');
      return;
    }

    try {
      const createdComp = await companyService.create({
        companyName: newCarrier.name,
        taxCode: newCarrier.code,
        contactPerson: newCarrier.contact,
        email: newCarrier.email.trim(),
        phone: newCarrier.phone,
        address: newCarrier.address,
      });

      const carrierId = createdComp?.id || createdComp?.Id || null;
      let accountProvisioned = false;

      // Cấp tài khoản với Email và Mật khẩu mặc định hệ thống NexusPort@2026
      try {
        const cleanEmail = newCarrier.email.trim();
        await companyService.provisionAccount({
          email: cleanEmail,
          username: cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail,
          password: DEFAULT_SYSTEM_PASSWORD,
          fullName: newCarrier.contact || newCarrier.name,
          companyName: newCarrier.name,
          carrierId: carrierId,
        });
        accountProvisioned = true;
        setCreatedAccountModal({
          companyName: newCarrier.name,
          fullName: newCarrier.contact,
          email: cleanEmail,
          password: DEFAULT_SYSTEM_PASSWORD,
          role: 'Transport Company',
          regDate: new Date().toLocaleDateString('vi-VN'),
        });
      } catch (accErr) {
        console.error('Lỗi cấp tài khoản:', accErr);
        showToast('⚠️ Đã tạo công ty, nhưng lỗi cấp tài khoản: ' + (accErr.response?.data?.message || accErr.message));
      }

      setShowAddModal(false);
      setNewCarrier({
        name: '',
        code: '',
        contact: '',
        email: '',
        phone: '',
        country: '',
        website: '',
        address: ''
      });
      if (!accountProvisioned) {
        showToast('➕ Đăng ký đối tác mới thành công!');
      }
      fetchCarriers();
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.Message || 'Lỗi khi thêm hãng tàu / đối tác!';
      showToast('❌ ' + errorMsg);
    }
  }

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  const openDetailModal = async (carrier) => {
    setSelectedCarrier(carrier)
    setIsEditingDetail(false)
    setEditFormData({
      companyName: carrier.name,
      taxCode: carrier.code,
      contactPerson: carrier.contact,
      email: carrier.email,
      phone: carrier.phone,
      address: carrier.address,
      website: carrier.website
    })

    setCompanyDrivers([])
    setLoadingDrivers(true)
    try {
      const data = await driverService.getAllDrivers({ carrierId: carrier.id })
      setCompanyDrivers(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingDrivers(false)
    }
  }

  const handleUpdateCarrier = async () => {
    try {
      await companyService.update(selectedCarrier.id, {
        companyName: editFormData.companyName,
        taxCode: editFormData.taxCode,
        contactPerson: editFormData.contactPerson,
        email: editFormData.email,
        phone: editFormData.phone,
        address: editFormData.address,
        website: editFormData.website
      });

      // Nếu email bị đổi, đồng bộ email tài khoản (mật khẩu không đổi, giữ nguyên cho chủ sở hữu tự đổi)
      if (editFormData.email && editFormData.email.trim() !== selectedCarrier.email) {
        try {
          const cleanEmail = editFormData.email.trim();
          await companyService.provisionAccount({
            email: cleanEmail,
            username: cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail,
            fullName: editFormData.contactPerson || editFormData.companyName,
            companyName: editFormData.companyName,
            carrierId: selectedCarrier.id,
          });
        } catch (_) {}
      }

      showToast('✅ Cập nhật thông tin đối tác thành công!');
      setIsEditingDetail(false);
      fetchCarriers();
      setSelectedCarrier({
        ...selectedCarrier,
        name: editFormData.companyName,
        contact: editFormData.contactPerson,
        email: editFormData.email,
        phone: editFormData.phone,
        address: editFormData.address,
        website: editFormData.website
      });
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.Message || 'Lỗi cập nhật!';
      showToast('❌ ' + errorMsg);
    }
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
          <strong className="font-bold">Quản lý Đối tác & Hãng vận tải:</strong> Khi tạo đối tác mới, tài khoản sẽ được cấp tự động với <strong>Email công ty làm tên đăng nhập</strong> và <strong>mật khẩu mặc định hệ thống ({DEFAULT_SYSTEM_PASSWORD})</strong> dùng chung như tài khoản Admin. Quản trị viên không sửa mật khẩu của đối tác — chủ tài khoản sẽ tự đổi mật khẩu sau khi đăng nhập.
        </div>
      </div>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-carbon font-heading">Quản lý Hãng tàu & Vận tải</h2>
          <p className="text-xs text-slate mt-1">Quản lý danh sách, trạng thái phê duyệt hãng tàu (Carrier) và cấp tài khoản đối tác vận tải (Transport Company).</p>
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

        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">ĐANG HOẠT ĐỘNG</span>
          <div className="text-3xl font-extrabold text-green-600 font-mono">{kpis.active}</div>
          <div className="text-[10px] text-slate font-medium">Tài khoản kết nối trực tiếp</div>
          <div className="absolute right-4 bottom-4 text-green-500/10">
            <span className="material-symbols-outlined text-4xl">task_alt</span>
          </div>
        </div>

        <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">CHỜ PHÊ DUYỆT</span>
          <div className="text-3xl font-extrabold text-signal-orange font-mono">{kpis.pending}</div>
          <div className="text-[10px] text-slate font-medium">Cần xử lý phê duyệt tài khoản</div>
          <div className="absolute right-4 bottom-4 text-orange-500/10">
            <span className="material-symbols-outlined text-4xl">pending</span>
          </div>
        </div>

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
        <div className="p-5 border-b border-chalk flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                <th className="px-6 py-4">Tên Công ty</th>
                <th className="px-6 py-4">Mã số thuế</th>
                <th className="px-6 py-4">Người liên hệ</th>
                <th className="px-6 py-4">Email Đăng nhập & SĐT</th>
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
                  onClick={() => openDetailModal(carrier)}
                >
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-bold text-carbon text-sm">{carrier.name}</div>
                      <div className="text-[10px] text-slate mt-0.5 truncate max-w-[200px]" title={carrier.address}>{carrier.address}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate">{carrier.code}</td>
                  <td className="px-6 py-4 font-semibold text-carbon">{carrier.contact}</td>
                  <td className="px-6 py-4 font-mono text-slate">
                    <div className="font-bold text-carbon">{carrier.email}</div>
                    <div className="text-[10px] mt-0.5">{carrier.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${carrier.status === 'Hoạt động'
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
                      onClick={() => openDetailModal(carrier)}
                      className="px-2.5 py-1 bg-white border border-chalk rounded text-carbon font-bold hover:bg-chalk transition-colors"
                    >
                      Chi tiết / Sửa
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
                  <td colSpan="7" className="text-center py-8 text-slate font-medium">
                    Không tìm thấy đối tác nào khớp với điều kiện lọc.
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
                <span className="text-[10px] font-bold text-slate uppercase tracking-wider block">HỒ SƠ ĐỐI TÁC VẬN TẢI</span>
                <h3 className="text-xl font-extrabold text-carbon mt-0.5">{selectedCarrier.name}</h3>
              </div>
              <div className="flex gap-2">
                {!isEditingDetail && (
                  <button
                    onClick={() => setIsEditingDetail(true)}
                    className="w-8 h-8 rounded-full bg-white hover:bg-chalk border border-chalk flex items-center justify-center transition-colors text-signal-orange"
                    title="Chỉnh sửa thông tin đối tác"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedCarrier(null)}
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
                  {selectedCarrier.code}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-slate font-mono">ID: {selectedCarrier.id}</div>
                  {isEditingDetail ? (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs font-bold whitespace-nowrap">Tên Cty:</span>
                      <input
                        type="text"
                        className="bg-white border border-chalk rounded px-2 py-1 text-xs w-full font-bold focus:outline-none focus:border-signal-orange"
                        value={editFormData.companyName || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, companyName: e.target.value })}
                      />
                    </div>
                  ) : null}
                  <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border mt-1 ${selectedCarrier.status === 'Hoạt động' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
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
                    <span className="text-slate block">Mã số thuế:</span>
                    {isEditingDetail ? (
                      <input
                        type="text"
                        className="bg-white border border-chalk rounded px-2 py-1 text-xs w-full font-mono uppercase focus:outline-none focus:border-signal-orange mt-1 font-bold"
                        value={editFormData.taxCode || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, taxCode: e.target.value.toUpperCase() })}
                      />
                    ) : (
                      <span className="font-mono font-semibold text-carbon">{selectedCarrier.code}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate block">Ngày tham gia:</span>
                    <span className="font-mono font-semibold text-carbon">{selectedCarrier.regDate}</span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-slate block">Địa chỉ văn phòng:</span>
                    {isEditingDetail ? (
                      <textarea
                        className="bg-white border border-chalk rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-signal-orange mt-1"
                        rows="2"
                        value={editFormData.address || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      />
                    ) : (
                      <span className="font-semibold text-carbon">{selectedCarrier.address}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Information & Login Account */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Người đại diện & Tài khoản đăng nhập
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate block">Họ & Tên đại diện:</span>
                    {isEditingDetail ? (
                      <input
                        type="text"
                        className="bg-white border border-chalk rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-signal-orange mt-1 font-semibold"
                        value={editFormData.contactPerson || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })}
                      />
                    ) : (
                      <span className="font-semibold text-carbon">{selectedCarrier.contact}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate block">Số điện thoại:</span>
                    {isEditingDetail ? (
                      <input
                        type="text"
                        className="bg-white border border-chalk rounded px-2 py-1 text-xs w-full font-mono focus:outline-none focus:border-signal-orange mt-1"
                        value={editFormData.phone || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      />
                    ) : (
                      <span className="font-mono font-semibold text-carbon">{selectedCarrier.phone}</span>
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
                        <label className="text-slate font-bold block">Email liên hệ & Tên đăng nhập *</label>
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
                            {selectedCarrier.email}
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

              {/* Registered Drivers List */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-carbon border-b border-chalk pb-1">
                  Danh sách tài xế vận tải
                </h4>
                <div className="space-y-1.5">
                  {loadingDrivers ? (
                    <div className="text-xs text-slate italic text-center py-4 bg-fog rounded border border-chalk">
                      Đang tải danh sách tài xế...
                    </div>
                  ) : companyDrivers.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                      {companyDrivers.map((driver) => (
                        <div key={driver.id} className="p-3 bg-fog rounded-lg border border-chalk text-xs font-bold text-carbon flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-sm">👤 {driver.fullName}</span>
                            <span className="text-[10px] text-slate font-mono font-normal mt-0.5">GPLX: {driver.licenseNumber} • CCCD: {driver.idCardNumber}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${driver.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : driver.status === 'inactive' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                              {driver.status === 'active' ? 'Sẵn sàng' : driver.status === 'inactive' ? 'Tạm nghỉ' : 'Đình chỉ'}
                            </span>
                            <span className="text-[10px] text-slate font-normal mt-0.5">LH: {driver.phone}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate italic text-center py-4 bg-fog rounded border border-chalk">
                      Công ty này chưa đăng ký tài xế nào.
                    </div>
                  )}
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
                    onClick={handleUpdateCarrier}
                    className="px-4 py-2 bg-signal-orange text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors shadow-md"
                  >
                    LƯU THÔNG TIN ĐỐI TÁC
                  </button>
                </>
              ) : (
                <>
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
                      Duyệt
                    </button>
                  )}
                  {selectedCarrier.status === 'Hoạt động' && (
                    <button
                      onClick={() => handleSuspend(selectedCarrier.id)}
                      className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded font-bold hover:bg-red-100 transition-colors"
                    >
                      Khóa
                    </button>
                  )}
                  {selectedCarrier.status === 'Tạm khóa' && (
                    <button
                      onClick={() => handleActivate(selectedCarrier.id)}
                      className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded font-bold hover:bg-green-100 transition-colors"
                    >
                      Mở khóa
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

      {/* ADD CARRIER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-carbon/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-chalk pb-3">
              <div>
                <h3 className="font-extrabold text-carbon text-lg">Đăng ký Đối tác / Hãng vận tải mới</h3>
                <p className="text-[11px] text-slate mt-0.5">Tạo hồ sơ và cấp tài khoản đăng nhập Cổng vận tải</p>
              </div>
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
                  <label className="text-slate font-bold">Tên công ty / Hãng vận tải *</label>
                  <input
                    type="text"
                    required
                    value={newCarrier.name}
                    onChange={(e) => setNewCarrier({ ...newCarrier, name: e.target.value })}
                    placeholder="VD: Maersk Logistics Việt Nam"
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 focus:outline-none focus:border-signal-orange font-bold text-carbon"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Mã đối tác / Mã số thuế *</label>
                  <input
                    type="text"
                    required
                    value={newCarrier.code}
                    onChange={(e) => setNewCarrier({ ...newCarrier, code: e.target.value.toUpperCase() })}
                    placeholder="VD: 0311234567"
                    className="w-full bg-fog border border-chalk rounded-lg p-2.5 uppercase font-mono font-bold focus:outline-none focus:border-signal-orange"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate font-bold">Người đại diện liên hệ *</label>
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
                        value={newCarrier.email}
                        onChange={(e) => setNewCarrier({ ...newCarrier, email: e.target.value })}
                        placeholder="VD: contact@carrier.com"
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
                  <label className="text-slate font-bold">Địa chỉ văn phòng tại Việt Nam</label>
                  <AddressAutocomplete
                    value={newCarrier.address}
                    onChange={(val) => setNewCarrier({ ...newCarrier, address: val })}
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
