import React, { useState, useMemo, useEffect } from 'react'
import { companyService } from '../../services/companyService'

export default function CarrierManagement() {
  const [carriers, setCarriers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tất cả')
  const [selectedCarrier, setSelectedCarrier] = useState(null) // for Detail Drawer
  const [showAddModal, setShowAddModal] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [isEditingDetail, setIsEditingDetail] = useState(false)
  const [editFormData, setEditFormData] = useState({})

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
        code: c.taxCode || c.id.substring(0, 8),
        contact: c.contactPerson || 'Chưa cập nhật',
        email: c.email || 'Chưa cập nhật',
        phone: c.phone || 'Chưa cập nhật',
        bookings: 0,
        containers: 0,
        status: c.status === 'active' ? 'Hoạt động' : (c.status === 'suspended' ? 'Tạm khóa' : 'Chờ duyệt'),
        regDate: new Date().toISOString().split('T')[0], // Placeholder if no date from API
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
        setSelectedCarrier(prev => ({...prev, status: targetStatus === 'active' ? 'Hoạt động' : (targetStatus === 'suspended' ? 'Tạm khóa' : 'Chờ duyệt')}));
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
    if (!emailRegex.test(newCarrier.email)) {
      showToast('❌ Email không hợp lệ!');
      return;
    }

    const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
    if (newCarrier.phone && !phoneRegex.test(newCarrier.phone.replace(/\s+/g, ''))) {
      showToast('❌ Số điện thoại không hợp lệ (Bắt đầu bằng 03/05/07/08/09 và đủ 10 số)!');
      return;
    }

    try {
      await companyService.create({
        companyName: newCarrier.name,
        taxCode: newCarrier.code,
        contactPerson: newCarrier.contact,
        email: newCarrier.email,
        phone: newCarrier.phone,
        address: newCarrier.address,
      });
      setShowAddModal(false)
      setNewCarrier({ name: '', code: '', contact: '', email: '', phone: '', country: '', website: '', address: '' })
      showToast('➕ Đăng ký hãng tàu mới thành công!')
      fetchCarriers();
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.Message || 'Lỗi khi thêm hãng tàu!';
      showToast('❌ ' + errorMsg);
    }
  }

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  const openDetailModal = (carrier) => {
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
  }

  const handleUpdateCarrier = async () => {
    try {
      await companyService.update(selectedCarrier.id, editFormData);
      showToast('✅ Cập nhật thông tin thành công!');
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
                <th className="px-6 py-4">Tên Công ty</th>
                <th className="px-6 py-4">Mã số thuế</th>
                <th className="px-6 py-4">Người liên hệ</th>
                <th className="px-6 py-4">Email & SĐT</th>
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
                    <div>{carrier.email}</div>
                    <div className="text-[10px] mt-0.5">{carrier.phone}</div>
                  </td>
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
                      onClick={() => openDetailModal(carrier)}
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
              <div className="flex gap-2">
                {!isEditingDetail && (
                  <button
                    onClick={() => setIsEditingDetail(true)}
                    className="w-8 h-8 rounded-full bg-white hover:bg-chalk border border-chalk flex items-center justify-center transition-colors text-signal-orange"
                    title="Chỉnh sửa"
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
                      <span className="text-xs font-bold">Tên Cty:</span>
                      <input 
                        type="text" 
                        className="bg-white border border-chalk rounded px-2 py-1 text-xs w-full font-bold focus:outline-none focus:border-signal-orange"
                        value={editFormData.companyName}
                        onChange={(e) => setEditFormData({...editFormData, companyName: e.target.value})}
                      />
                    </div>
                  ) : (
                    <div className="text-sm font-bold text-carbon">Website: {selectedCarrier.website}</div>
                  )}
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
                    <span className="text-slate block">Ngày tham gia:</span>
                    <span className="font-mono font-semibold text-carbon">{selectedCarrier.regDate}</span>
                  </div>
                  <div>
                    <span className="text-slate block">Website:</span>
                    {isEditingDetail ? (
                      <input 
                        type="text" 
                        className="bg-white border border-chalk rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-signal-orange"
                        value={editFormData.website}
                        onChange={(e) => setEditFormData({...editFormData, website: e.target.value})}
                      />
                    ) : (
                      <span className="font-semibold text-carbon">{selectedCarrier.website}</span>
                    )}
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate block">Địa chỉ:</span>
                    {isEditingDetail ? (
                      <textarea 
                        className="bg-white border border-chalk rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-signal-orange"
                        rows="2"
                        value={editFormData.address}
                        onChange={(e) => setEditFormData({...editFormData, address: e.target.value})}
                      />
                    ) : (
                      <span className="font-semibold text-carbon">{selectedCarrier.address}</span>
                    )}
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
                    {isEditingDetail ? (
                      <input 
                        type="text" 
                        className="bg-white border border-chalk rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-signal-orange"
                        value={editFormData.contactPerson}
                        onChange={(e) => setEditFormData({...editFormData, contactPerson: e.target.value})}
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
                        className="bg-white border border-chalk rounded px-2 py-1 text-xs w-full font-mono focus:outline-none focus:border-signal-orange"
                        value={editFormData.phone}
                        onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                      />
                    ) : (
                      <span className="font-mono font-semibold text-carbon">{selectedCarrier.phone}</span>
                    )}
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate block">Email làm việc chính:</span>
                    {isEditingDetail ? (
                      <input 
                        type="email" 
                        className="bg-white border border-chalk rounded px-2 py-1 text-xs w-full font-mono focus:outline-none focus:border-signal-orange"
                        value={editFormData.email}
                        onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                      />
                    ) : (
                      <span className="font-mono font-semibold text-carbon">{selectedCarrier.email}</span>
                    )}
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
                    onClick={handleUpdateCarrier}
                    className="px-4 py-2 bg-signal-orange text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors"
                  >
                    LƯU THÔNG TIN
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
                </>
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
                  <label className="text-slate font-bold">Mã hãng tàu / Mã số thuế *</label>
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
