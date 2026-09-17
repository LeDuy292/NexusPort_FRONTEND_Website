import React, { useState, useEffect } from 'react'
import driverService from '../../services/driverService'
import vehicleService from '../../services/vehicleService'

import { resolveMediaUrl } from '../../utils/mediaUtils'

const STATUS_CONFIG = {
  active: { label: 'Sẵn sàng hoạt động', color: 'bg-green-600 text-white' },
  inactive: { label: 'Tạm nghỉ / Bận', color: 'bg-amber-100 text-amber-800 border border-amber-200' },
  banned: { label: 'Đã bị đình chỉ', color: 'bg-red-100 text-red-800 border border-red-200' },
}

function DriverAvatar({ photoUrl, fullName, status, className = "w-12 h-12 text-sm" }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [photoUrl]);

  const nameParts = fullName ? fullName.trim().split(' ') : ['?'];
  const initials = nameParts.length > 1
    ? nameParts[nameParts.length - 1].charAt(0) + nameParts[0].charAt(0)
    : nameParts[0].substring(0, 2).toUpperCase();

  const statusBg = status === 'banned' ? 'bg-red-400' : status === 'inactive' ? 'bg-amber-400' : 'bg-carbon';

  if (photoUrl && !imgError) {
    return (
      <div className={`${className} rounded-full overflow-hidden flex-shrink-0 border border-chalk relative`}>
        <img
          src={resolveMediaUrl(photoUrl)}
          alt={fullName || 'Driver'}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={`${className} rounded-full flex items-center justify-center font-bold text-white uppercase flex-shrink-0 ${statusBg}`}>
      {initials}
    </div>
  );
}

function DocumentCard({ url, title, alt, onClick }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [url]);

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold text-slate uppercase">{title}</div>
      {!url || imgError ? (
        <div className="bg-fog p-3 rounded-xl border border-dashed border-chalk h-32 flex flex-col items-center justify-center text-slate select-none">
          <span className="material-symbols-outlined text-2xl text-slate/40 mb-1">badge</span>
          <span className="text-[11px] font-medium text-slate/70">Chưa có {alt}</span>
        </div>
      ) : (
        <div
          className="bg-fog p-1.5 rounded-xl border border-chalk h-32 flex items-center justify-center overflow-hidden cursor-pointer hover:border-signal-orange transition-all group relative shadow-sm"
          onClick={onClick}
        >
          <img
            src={resolveMediaUrl(url)}
            alt={alt}
            onError={() => setImgError(true)}
            className="max-w-full max-h-full object-contain rounded-lg transition-transform group-hover:scale-105"
            onLoad={e => {
              if (e.target.naturalHeight > e.target.naturalWidth) {
                e.target.style.transform = 'rotate(-90deg) scale(1.2)';
              }
            }}
          />
          <div className="absolute inset-0 bg-carbon/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl pointer-events-none">
            <span className="material-symbols-outlined text-white text-lg drop-shadow">zoom_in</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DriverManagement() {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('drivers')
  const [selectedDriver, setSelectedDriver] = useState(null)

  const [toastMessage, setToastMessage] = useState('')
  const [zoomedImage, setZoomedImage] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const [driverSearch, setDriverSearch] = useState('')
  const [vehicleSearch, setVehicleSearch] = useState('')
  
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false)
  const [vehicleForm, setVehicleForm] = useState({ plate: '', vehicleType: 'ROAD_TRUCK', registrationImageUrl: '', photoUrl: '' })
  const [ocrVehicleLoading, setOcrVehicleLoading] = useState(false)
  const [uploadingVehiclePhoto, setUploadingVehiclePhoto] = useState(false)

  const [vehicles, setVehicles] = useState([])
  const [loadingVehicles, setLoadingVehicles] = useState(false)

  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [editVehicleMode, setEditVehicleMode] = useState(false)
  const [vehicleEditData, setVehicleEditData] = useState(null)
  const [driverAssignForm, setDriverAssignForm] = useState('')

  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('ALL')
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState('ALL')
  const [driverStatusFilter, setDriverStatusFilter] = useState('ALL')

  const filteredDrivers = drivers.filter(d => {
    const matchSearch = d.fullName?.toLowerCase().includes(driverSearch.toLowerCase()) || 
                        d.phone?.includes(driverSearch) || 
                        d.idCardNumber?.includes(driverSearch);
    const matchStatus = driverStatusFilter === 'ALL' || d.status === driverStatusFilter;
    return matchSearch && matchStatus;
  })

  const filteredVehicles = vehicles.filter(v => {
    const matchSearch = v.plateNumber?.toLowerCase().includes(vehicleSearch.toLowerCase()) || 
                        v.driverName?.toLowerCase().includes(vehicleSearch.toLowerCase());
    const matchType = vehicleTypeFilter === 'ALL' || v.vehicleType === vehicleTypeFilter;
    const matchStatus = vehicleStatusFilter === 'ALL' || v.status.toLowerCase() === vehicleStatusFilter.toLowerCase();
    return matchSearch && matchType && matchStatus;
  })

  const [ocrLoading, setOcrLoading] = useState(false)
  const emptyForm = { fullName: '', phone: '', idCardNumber: '', licenseNumber: '', photoUrl: '', idCardFrontUrl: '', licenseImageUrl: '' }
  const [form, setForm] = useState({ ...emptyForm })
  const [editForm, setEditForm] = useState(null)

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  const handleOcrUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setOcrLoading(true);
    try {
      showToast('⏳ Đang phân tích CCCD bằng AI...');
      const data = await driverService.extractCccd(file);
      setForm(f => ({
        ...f,
        fullName: data.fullName || f.fullName,
        idCardNumber: data.idCardNumber || f.idCardNumber,
        photoUrl: data.faceImageUrl || f.photoUrl,
        idCardFrontUrl: data.idCardFrontUrl || f.idCardFrontUrl
      }));
      showToast('✅ Quét CCCD thành công!');
    } catch (err) {
      showToast('❌ Lỗi quét CCCD: ' + (err.response?.data?.message || err.message));
    } finally {
      setOcrLoading(false);
      e.target.value = '';
    }
  };

  const handleGplxUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setOcrLoading(true);
    try {
      const data = await driverService.extractGplx(file);
      setForm(f => ({
        ...f,
        fullName: data?.fullName || f.fullName,
        licenseNumber: data?.licenseNumber || f.licenseNumber,
        licenseImageUrl: data?.licenseImageUrl || f.licenseImageUrl,
        photoUrl: data?.faceImageUrl || f.photoUrl
      }));
      showToast('✅ Quét GPLX thành công!');
    } catch (err) {
      showToast('❌ Quét GPLX thất bại: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setOcrLoading(false);
      e.target.value = '';
    }
  };

  const handleOcrUploadEdit = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setOcrLoading(true);
    try {
      showToast('⏳ Đang phân tích CCCD bằng AI...');
      const data = await driverService.extractCccd(file);
      setEditForm(f => ({
        ...f,
        fullName: data.fullName || f.fullName,
        idCardNumber: data.idCardNumber || f.idCardNumber,
        photoUrl: data.faceImageUrl || f.photoUrl,
        idCardFrontUrl: data.idCardFrontUrl || f.idCardFrontUrl
      }));
      showToast('✅ Quét CCCD thành công!');
    } catch (err) {
      showToast('❌ Lỗi quét CCCD: ' + (err.response?.data?.message || err.message));
    } finally {
      setOcrLoading(false);
      e.target.value = '';
    }
  };

  const handleGplxUploadEdit = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setOcrLoading(true);
    try {
      const data = await driverService.extractGplx(file);
      setEditForm(f => ({
        ...f,
        fullName: data?.fullName || f.fullName,
        licenseNumber: data?.licenseNumber || f.licenseNumber,
        licenseImageUrl: data?.licenseImageUrl || f.licenseImageUrl,
        photoUrl: data?.faceImageUrl || f.photoUrl
      }));
      showToast('✅ Quét GPLX thành công!');
    } catch (err) {
      showToast('❌ Quét GPLX thất bại: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setOcrLoading(false);
      e.target.value = '';
    }
  };

  const handleVehicleRegistrationUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setOcrVehicleLoading(true);
    try {
      const data = await vehicleService.extractRegistration(file);
      setVehicleForm(f => ({
        ...f,
        plate: data?.plateNumber || f.plate,
        registrationImageUrl: data?.imageUrl || f.registrationImageUrl
      }));
      if (data?.isSuccess === false) {
        showToast('⚠️ ' + data.message);
      } else {
        showToast('✅ Quét Cà Vẹt thành công!');
      }
    } catch (err) {
      showToast('❌ Lỗi quét Cà Vẹt: ' + (err.response?.data?.message || err.message));
    } finally {
      setOcrVehicleLoading(false);
      e.target.value = '';
    }
  };

  const handleVehiclePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingVehiclePhoto(true);
    try {
      const data = await vehicleService.uploadPhoto(file);
      setVehicleForm(f => ({
        ...f,
        photoUrl: data?.imageUrl || f.photoUrl
      }));
      showToast('✅ Tải ảnh xe thành công!');
    } catch (err) {
      showToast('❌ Lỗi tải ảnh xe: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingVehiclePhoto(false);
      e.target.value = '';
    }
  };

  const handleVehiclePhotoUploadEdit = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingVehiclePhoto(true);
    try {
      const data = await vehicleService.uploadPhoto(file);
      setVehicleEditData(f => ({
        ...f,
        photoUrl: data?.imageUrl || f.photoUrl
      }));
      showToast('✅ Tải ảnh xe thành công!');
    } catch (err) {
      showToast('❌ Lỗi tải ảnh xe: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingVehiclePhoto(false);
      e.target.value = '';
    }
  };

  const handleVehicleRegistrationUploadEdit = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setOcrVehicleLoading(true);
    try {
      const data = await vehicleService.extractRegistration(file);
      setVehicleEditData(f => ({
        ...f,
        plateNumber: data?.plateNumber || f.plateNumber,
        registrationImageUrl: data?.imageUrl || f.registrationImageUrl
      }));
      if (data?.isSuccess === false) {
        showToast('⚠️ ' + data.message);
      } else {
        showToast('✅ Quét Cà Vẹt thành công!');
      }
    } catch (err) {
      showToast('❌ Lỗi quét Cà Vẹt: ' + (err.response?.data?.message || err.message));
    } finally {
      setOcrVehicleLoading(false);
      e.target.value = '';
    }
  };

  const loadDrivers = async () => {
    setLoading(true)
    try {
      const data = await driverService.getAllDrivers({})
      setDrivers(data)
      if (selectedDriver) {
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

  const loadVehicles = async () => {
    try {
      setLoadingVehicles(true)
      const data = await vehicleService.getAllVehicles()
      setVehicles(data)
    } catch (err) {
      console.error("Failed to load vehicles", err)
    } finally {
      setLoadingVehicles(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'vehicles' && vehicles.length === 0) {
      loadVehicles()
    }
  }, [activeTab])

  const handleCreateVehicle = async (e) => {
    e.preventDefault()
    if (!vehicleForm.plate.trim()) {
      showToast('⚠️ Vui lòng nhập Biển số xe!')
      return
    }
    try {
      await vehicleService.createVehicle({
        plateNumber: vehicleForm.plate,
        vehicleType: vehicleForm.vehicleType,
        registrationImageUrl: vehicleForm.registrationImageUrl,
        photoUrl: vehicleForm.photoUrl
      })
      setShowAddVehicleModal(false)
      showToast('✅ Đã thêm phương tiện mới (' + vehicleForm.plate + ')!')
      setVehicleForm({ plate: '', vehicleType: 'ROAD_TRUCK', registrationImageUrl: '', photoUrl: '' })
      loadVehicles()
    } catch (err) {
      showToast('❌ Lỗi thêm phương tiện: ' + (err.response?.data?.message || err.message))
    }
  }

  const openVehicleDetails = (v) => {
    setSelectedVehicle(v)
    setEditVehicleMode(false)
    setVehicleEditData({ ...v, status: v.status.toLowerCase(), vehicleType: v.vehicleType })
    setDriverAssignForm(v.driverId || '')
  }

  const handleSaveVehicleEdit = async (e) => {
    e.preventDefault()
    try {
      if (
        vehicleEditData.plateNumber !== selectedVehicle.plateNumber || 
        vehicleEditData.vehicleType !== selectedVehicle.vehicleType ||
        vehicleEditData.photoUrl !== selectedVehicle.photoUrl ||
        vehicleEditData.registrationImageUrl !== selectedVehicle.registrationImageUrl
      ) {
        await vehicleService.updateVehicle(selectedVehicle.id, {
          plateNumber: vehicleEditData.plateNumber,
          vehicleType: vehicleEditData.vehicleType,
          photoUrl: vehicleEditData.photoUrl,
          registrationImageUrl: vehicleEditData.registrationImageUrl
        })
      }
      if (vehicleEditData.status && vehicleEditData.status !== selectedVehicle.status.toLowerCase()) {
        await vehicleService.toggleStatus(selectedVehicle.id, vehicleEditData.status)
      }
      setEditVehicleMode(false)
      showToast('✅ Đã cập nhật phương tiện ' + vehicleEditData.plateNumber + '!')
      loadVehicles()
      setSelectedVehicle({ 
        ...selectedVehicle, 
        plateNumber: vehicleEditData.plateNumber, 
        vehicleType: vehicleEditData.vehicleType, 
        status: vehicleEditData.status,
        photoUrl: vehicleEditData.photoUrl,
        registrationImageUrl: vehicleEditData.registrationImageUrl
      })
    } catch (err) {
      showToast('❌ Lỗi cập nhật: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleAssignDriver = async (e) => {
    e.preventDefault()
    try {
      await vehicleService.assignDriver(selectedVehicle.id, driverAssignForm || null)
      showToast('✅ Đã phân công tài xế thành công!')
      loadVehicles()
      setSelectedVehicle(null)
    } catch (err) {
      showToast('❌ Lỗi phân công: ' + (err.response?.data?.message || err.message))
    }
  }

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
        idCardNumber: editForm.idCardNumber,
        photoUrl: editForm.photoUrl,
        idCardFrontUrl: editForm.idCardFrontUrl,
        licenseImageUrl: editForm.licenseImageUrl
      })
      if (selectedDriver.status !== editForm.status) {
        await driverService.toggleStatus(editForm.id, editForm.status)
        await loadVehicles() // Refresh vehicles in case the driver was unassigned from a vehicle
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
        <div className="fixed top-24 right-8 bg-[#202020] text-white px-6 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 z-[999] animate-bounce border border-signal-orange">
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
            <h2 className="font-heading text-4xl text-carbon font-bold mt-1">
              {activeTab === 'drivers' && 'Quản lý Đội ngũ Tài xế'}
              {activeTab === 'vehicles' && 'Quản lý Phương tiện'}
              {activeTab === 'schedules' && 'Lịch trình Phương tiện'}
            </h2>
            <p className="text-sm text-slate mt-1">
              {activeTab === 'drivers' && 'Giám sát và phân công công việc cho đội ngũ tài xế của công ty.'}
              {activeTab === 'vehicles' && 'Quản lý danh sách phương tiện và trạng thái điều động của công ty.'}
              {activeTab === 'schedules' && 'Theo dõi lộ trình và phân ca kíp cho các phương tiện đang hoạt động.'}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {activeTab === 'drivers' && (
              <button onClick={() => { setForm({ ...emptyForm }); setShowAddModal(true) }}
                className="h-9 px-4 bg-carbon text-white rounded-lg font-bold text-xs hover:bg-black transition-colors flex items-center gap-2 shadow-sm">
                <span className="material-symbols-outlined text-sm">person_add</span> Thêm Tài Xế Mới
              </button>
            )}
            {activeTab === 'vehicles' && (
              <button onClick={() => { setVehicleForm({ plate: '', vehicleType: 'ROAD_TRUCK' }); setShowAddVehicleModal(true) }}
                className="h-9 px-4 bg-signal-orange text-white rounded-lg font-bold text-xs hover:opacity-95 transition-colors flex items-center gap-2 shadow-sm">
                <span className="material-symbols-outlined text-sm">local_shipping</span> Thêm Phương Tiện
              </button>
            )}
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

        {/* SEARCH BAR & FILTERS (Drivers) */}
        {activeTab === 'drivers' && (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-chalk">
                <p className="text-[10px] font-bold text-slate uppercase">Tổng tài xế</p>
                <p className="text-2xl font-black text-carbon mt-1">{drivers.length}</p>
                <p className="text-[10px] text-slate mt-1">Tổng nhân sự hiện có</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-green-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-8 h-8 bg-green-500/10 rounded-bl-full"></div>
                <p className="text-[10px] font-bold text-slate uppercase">Sẵn sàng</p>
                <p className="text-2xl font-black text-green-600 mt-1">{drivers.filter(d => d.status === 'active').length}</p>
                <p className="text-[10px] text-green-600 font-bold mt-1">Sẵn sàng nhận việc</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-chalk">
                <p className="text-[10px] font-bold text-slate uppercase">Tạm nghỉ / Bận</p>
                <p className="text-2xl font-black text-amber-600 mt-1">{drivers.filter(d => d.status === 'inactive').length}</p>
                <p className="text-[10px] text-amber-600 font-bold mt-1">Không thể phân công</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-chalk">
                <p className="text-[10px] font-bold text-slate uppercase">Đình chỉ</p>
                <p className="text-2xl font-black text-red-600 mt-1">{drivers.filter(d => d.status === 'banned').length}</p>
                <p className="text-[10px] text-red-600 font-bold mt-1">Vi phạm kỷ luật</p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-chalk flex flex-col xl:flex-row gap-3 items-center">
              <div className="relative w-full xl:flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate text-lg">search</span>
                <input 
                  type="text" 
                  placeholder="Tìm kiếm tài xế theo tên, điện thoại hoặc CCCD..." 
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-fog border border-transparent rounded-lg text-xs focus:bg-white focus:border-carbon focus:ring-1 focus:ring-carbon outline-none transition-all"
                />
              </div>

              <div className="flex gap-2 w-full xl:w-auto flex-wrap">
                <button 
                  onClick={() => setDriverStatusFilter('ALL')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${driverStatusFilter === 'ALL' ? 'bg-carbon text-white shadow' : 'bg-fog text-slate hover:bg-gray-200'}`}>
                  Tất cả trạng thái
                </button>
                <button 
                  onClick={() => setDriverStatusFilter('active')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${driverStatusFilter === 'active' ? 'bg-green-600 text-white shadow' : 'bg-fog text-slate hover:bg-gray-200'}`}>
                  <span className="w-2 h-2 rounded-full bg-green-400"></span> Sẵn sàng
                </button>
                <button 
                  onClick={() => setDriverStatusFilter('inactive')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${driverStatusFilter === 'inactive' ? 'bg-amber-500 text-white shadow' : 'bg-fog text-slate hover:bg-gray-200'}`}>
                  <span className="w-2 h-2 rounded-full bg-amber-200"></span> Tạm nghỉ
                </button>
                <button 
                  onClick={() => setDriverStatusFilter('banned')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${driverStatusFilter === 'banned' ? 'bg-red-600 text-white shadow' : 'bg-fog text-slate hover:bg-gray-200'}`}>
                  <span className="w-2 h-2 rounded-full bg-red-400"></span> Đình chỉ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SEARCH BAR & FILTERS (Vehicles) */}
        {activeTab === 'vehicles' && (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-chalk">
                <p className="text-[10px] font-bold text-slate uppercase">Tổng số xe</p>
                <p className="text-2xl font-black text-carbon mt-1">{vehicles.length}</p>
                <p className="text-[10px] text-slate mt-1">Tổng số xe đội cảng</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-green-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-8 h-8 bg-green-500/10 rounded-bl-full"></div>
                <p className="text-[10px] font-bold text-slate uppercase">Sẵn sàng</p>
                <p className="text-2xl font-black text-green-600 mt-1">{vehicles.filter(v => v.status.toLowerCase() === 'active').length}</p>
                <p className="text-[10px] text-green-600 font-bold mt-1">Sẵn sàng nhận lệnh</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-chalk">
                <p className="text-[10px] font-bold text-slate uppercase">Đã chỉ định</p>
                <p className="text-2xl font-black text-blue-600 mt-1">{vehicles.filter(v => v.status.toLowerCase() === 'inactive').length}</p>
                <p className="text-[10px] text-blue-600 font-bold mt-1">Đã có lệnh điều động</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-chalk">
                <p className="text-[10px] font-bold text-slate uppercase">Đang di chuyển</p>
                <p className="text-2xl font-black text-purple-600 mt-1">0</p>
                <p className="text-[10px] text-purple-600 font-bold mt-1">Đang lưu thông đường</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-chalk">
                <p className="text-[10px] font-bold text-slate uppercase">Đang cẩu dỡ</p>
                <p className="text-2xl font-black text-orange-500 mt-1">0</p>
                <p className="text-[10px] text-orange-500 font-bold mt-1">Đang bốc dỡ cầu bãi</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-chalk">
                <p className="text-[10px] font-bold text-slate uppercase">Bảo trì</p>
                <p className="text-2xl font-black text-carbon mt-1">{vehicles.filter(v => v.status.toLowerCase() === 'maintenance').length}</p>
                <p className="text-[10px] text-carbon font-bold mt-1">Đang bảo trì kỹ thuật</p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-chalk flex flex-col xl:flex-row gap-3 items-center">
              <div className="relative w-full xl:w-1/3">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate text-lg">search</span>
                <input 
                  type="text" 
                  placeholder="Tìm mã xe, biển số, tài xế, container..." 
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-fog border border-transparent rounded-lg text-xs focus:bg-white focus:border-carbon focus:ring-1 focus:ring-carbon outline-none transition-all"
                />
              </div>

              <div className="flex gap-2 w-full xl:w-auto flex-wrap">
                {/* Removed vehicle type filter as requested */}
              </div>

              <div className="flex gap-2 w-full xl:w-auto">
                <select 
                  value={vehicleStatusFilter}
                  onChange={(e) => setVehicleStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-fog border border-transparent rounded-lg text-xs font-bold text-carbon focus:bg-white focus:border-carbon outline-none cursor-pointer flex-1 xl:w-40"
                >
                  <option value="ALL">Tất cả Trạng thái</option>
                  <option value="active">Sẵn sàng</option>
                  <option value="inactive">Đã chỉ định</option>
                  <option value="maintenance">Bảo trì</option>
                </select>

                <select 
                  className="px-3 py-2 bg-fog border border-transparent rounded-lg text-xs font-bold text-carbon focus:bg-white focus:border-carbon outline-none cursor-pointer flex-1 xl:w-32"
                >
                  <option value="ALL">Tất cả Vị trí</option>
                  <option value="GATE">Cổng</option>
                  <option value="YARD">Bãi</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: DRIVERS GRID */}
        {activeTab === 'drivers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-200">
            {loading ? (
              <div className="col-span-full py-12 text-center text-slate font-bold">Đang tải danh sách tài xế...</div>
            ) : filteredDrivers.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate border-2 border-dashed border-chalk rounded-xl">
                Không tìm thấy tài xế phù hợp.
              </div>
            ) : filteredDrivers.map((d) => {
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
                      <DriverAvatar photoUrl={d.photoUrl} fullName={d.fullName} status={d.status} className="w-12 h-12 text-sm" />
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

                  <div className="pt-4 border-t border-chalk grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2 mb-1">
                      <span className="text-slate block text-[10px] uppercase font-bold">Trực thuộc đơn vị</span>
                      <strong className="text-signal-orange text-[11px]">{d.carrierName || 'NexusPort · Cảng Tiên Sa'}</strong>
                    </div>
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

        {/* TAB CONTENT: VEHICLES GRID */}
        {activeTab === 'vehicles' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-200">
            {loadingVehicles ? (
              <div className="col-span-full py-12 text-center text-slate font-bold">Đang tải danh sách phương tiện...</div>
            ) : vehicles.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate border-2 border-dashed border-chalk rounded-xl">
                Bạn chưa có phương tiện nào trong danh sách.
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate border-2 border-dashed border-chalk rounded-xl">
                Không tìm thấy phương tiện phù hợp.
              </div>
            ) : filteredVehicles.map((v) => {
              const statusCfg = v.status.toLowerCase() === 'active' ? { label: 'Sẵn sàng', color: 'bg-green-600 text-white' } : v.status.toLowerCase() === 'maintenance' ? { label: 'Bảo trì', color: 'bg-red-600 text-white' } : { label: 'Đã phân công', color: 'bg-blue-100 text-blue-800 border border-blue-200' }
              return (
                <div key={v.id} onClick={() => openVehicleDetails(v)} className="bg-white rounded-xl p-6 shadow-sm border border-chalk hover:shadow-md transition-all flex flex-col space-y-4 cursor-pointer hover:border-slate">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl bg-fog flex items-center justify-center text-carbon overflow-hidden shrink-0 border border-chalk">
                        {v.photoUrl ? (
                          <img src={resolveMediaUrl(v.photoUrl)} alt="Xe" onError={(e) => { e.target.style.display = 'none'; }} className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined">local_shipping</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-carbon text-base">{v.plateNumber}</h3>
                        <p className="text-[10px] font-mono text-slate mt-0.5">{v.vehicleType === 'ROAD_TRUCK' ? 'Đầu kéo đường dài' : 'Đầu kéo nội bài'}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className={"inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold " + statusCfg.color}>
                      {statusCfg.label}
                    </span>
                  </div>
                  <div className="pt-4 border-t border-chalk flex justify-between items-center text-xs">
                    <div>
                      <span className="text-slate block text-[10px] uppercase font-bold">Tài xế phụ trách</span>
                      <strong className="text-carbon">{v.driverName || 'Chưa phân công'}</strong>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* OTHER TABS PLACEHOLDER */}
        {activeTab === 'schedules' && (
          <div className="bg-white border border-chalk rounded-xl p-12 text-center text-slate space-y-2 animate-in fade-in duration-200">
            <span className="material-symbols-outlined text-4xl text-slate">local_shipping</span>
            <h4 className="font-bold text-carbon text-lg">Danh mục Phương tiện & Lịch trình đang hoạt động</h4>
            <p className="text-xs">Dữ liệu xe đầu kéo và sơ đồ phân ca kíp được đồng bộ trực tiếp từ trạm điều hành cảng.</p>
          </div>
        )}

      </div>

      {/* ═══ ADD VEHICLE MODAL ═══ */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-carbon/40 backdrop-blur-sm" onClick={() => setShowAddVehicleModal(false)} />
          <div className="bg-white rounded-2xl shadow-2xl border border-chalk w-full max-w-md animate-in zoom-in-95 duration-200 p-6 space-y-6 relative z-10">
            <div className="flex justify-between items-center border-b border-chalk pb-4">
              <h3 className="font-heading text-xl font-extrabold text-carbon">Thêm Phương Tiện Mới</h3>
              <button onClick={() => setShowAddVehicleModal(false)} className="text-slate hover:text-carbon">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleCreateVehicle} className="space-y-4 font-sans">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate uppercase">Ảnh Đại Diện Xe</label>
                  <div className="relative">
                    <input type="file" accept="image/*" onChange={handleVehiclePhotoUpload} disabled={uploadingVehiclePhoto}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className={`h-11 border-2 border-dashed border-chalk rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${uploadingVehiclePhoto ? 'bg-fog text-slate' : 'bg-white text-carbon hover:border-carbon'}`}>
                      {uploadingVehiclePhoto ? 'Đang tải...' : (vehicleForm.photoUrl ? 'Đã tải ảnh lên' : 'Tải ảnh xe lên')}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate uppercase">Ảnh Cà Vẹt (AI)</label>
                  <div className="relative">
                    <input type="file" accept="image/*" onChange={handleVehicleRegistrationUpload} disabled={ocrVehicleLoading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className={`h-11 border-2 border-dashed border-chalk rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${ocrVehicleLoading ? 'bg-fog text-slate' : 'bg-white text-carbon hover:border-carbon'}`}>
                      {ocrVehicleLoading ? 'Đang quét...' : (vehicleForm.registrationImageUrl ? 'Đã tải ảnh lên' : 'Quét Cà Vẹt tự động')}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate mb-1">Biển Số Xe *</label>
                <input
                  type="text"
                  placeholder="VD: 43C-123.45"
                  className="w-full h-11 px-3 border border-chalk rounded-lg text-sm text-carbon focus:border-carbon focus:ring-1 focus:ring-carbon outline-none transition-all uppercase"
                  value={vehicleForm.plate}
                  onChange={e => setVehicleForm({ ...vehicleForm, plate: e.target.value })}
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full h-11 bg-signal-orange text-white rounded-lg font-bold text-sm shadow-md hover:bg-orange-600 transition-colors"
                >
                  Tạo Hồ Sơ Phương Tiện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ SELECTED VEHICLE MODAL ═══ */}
      {selectedVehicle && activeTab === 'vehicles' && (
        <>
          <div className="fixed inset-0 bg-carbon/40 z-[60] backdrop-blur-sm" onClick={() => setSelectedVehicle(null)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-chalk w-full max-w-md animate-in zoom-in-95 duration-200 p-6 space-y-6" onClick={e => e.stopPropagation()}>
              
              <div className="flex justify-between items-start border-b border-chalk pb-5">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-xl bg-fog flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer group" onClick={() => selectedVehicle.photoUrl && setZoomedImage(resolveMediaUrl(selectedVehicle.photoUrl))}>
                    {selectedVehicle.photoUrl ? (
                      <img src={resolveMediaUrl(selectedVehicle.photoUrl)} alt="Vehicle" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    ) : (
                      <span className="material-symbols-outlined text-3xl text-carbon">local_shipping</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-carbon font-mono">{selectedVehicle.plateNumber}</h3>
                    <p className="text-xs text-slate">{selectedVehicle.vehicleType === 'ROAD_TRUCK' ? 'Đầu kéo đường dài' : 'Đầu kéo nội bài'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!editVehicleMode && (
                    <button onClick={() => setEditVehicleMode(true)} className="text-slate hover:text-signal-orange">
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                  )}
                  <button onClick={() => setSelectedVehicle(null)} className="text-slate hover:text-carbon">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
              </div>

              {editVehicleMode ? (
                <form onSubmit={handleSaveVehicleEdit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate uppercase">Ảnh Đại Diện Xe</label>
                      <div className="relative">
                        <input type="file" accept="image/*" onChange={handleVehiclePhotoUploadEdit} disabled={uploadingVehiclePhoto}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                        <div className={`h-11 border-2 border-dashed border-chalk rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${uploadingVehiclePhoto ? 'bg-fog text-slate' : 'bg-white text-carbon hover:border-carbon'}`}>
                          {uploadingVehiclePhoto ? 'Đang tải...' : (vehicleEditData.photoUrl ? 'Đã tải ảnh lên' : 'Tải ảnh xe lên')}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate uppercase">Ảnh Cà Vẹt (AI)</label>
                      <div className="relative">
                        <input type="file" accept="image/*" onChange={handleVehicleRegistrationUploadEdit} disabled={ocrVehicleLoading}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                        <div className={`h-11 border-2 border-dashed border-chalk rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${ocrVehicleLoading ? 'bg-fog text-slate' : 'bg-white text-carbon hover:border-carbon'}`}>
                          {ocrVehicleLoading ? 'Đang quét...' : (vehicleEditData.registrationImageUrl ? 'Đã tải ảnh lên' : 'Quét Cà Vẹt')}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Biển Số Xe</label>
                    <input type="text" value={vehicleEditData.plateNumber} onChange={e => setVehicleEditData(f => ({ ...f, plateNumber: e.target.value }))}
                      className="w-full px-3 h-10 border border-chalk rounded-md text-xs text-carbon focus:outline-none focus:border-carbon bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1">Trạng Thái</label>
                    <select value={vehicleEditData.status} onChange={e => setVehicleEditData(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 h-10 border border-chalk rounded-md text-xs text-carbon focus:outline-none focus:border-carbon bg-white">
                      <option value="active">Sẵn sàng (Active)</option>
                      <option value="inactive">Đã phân công (Inactive)</option>
                      <option value="maintenance">Bảo trì (Maintenance)</option>
                    </select>
                  </div>
                  
                  <div className="flex gap-2 pt-4 border-t border-chalk">
                    <button type="button" onClick={() => setEditVehicleMode(false)}
                      className="flex-1 h-11 border border-chalk rounded-xl text-xs font-bold text-graphite hover:bg-fog">Hủy</button>
                    <button type="submit"
                      className="flex-1 h-11 bg-signal-orange text-white rounded-xl text-xs font-bold shadow hover:opacity-90">Lưu Thay Đổi</button>
                  </div>
                </form>
              ) : (
                <div className="space-y-5 text-xs">
                  <div className="space-y-4 border-b border-chalk pb-5">
                    <h4 className="text-[10px] font-bold text-slate uppercase tracking-wider">THÔNG TIN PHƯƠNG TIỆN</h4>
                    <div className="grid grid-cols-2 gap-y-3">
                      <div className="text-slate">Trạng thái</div>
                      <div className="text-right">
                        <strong className={selectedVehicle.status.toLowerCase() === 'available' ? 'text-green-600' : selectedVehicle.status.toLowerCase() === 'maintenance' ? 'text-red-500' : 'text-blue-500'}>
                          {selectedVehicle.status}
                        </strong>
                      </div>
                      <div className="text-slate">Biển Số</div>
                      <div className="text-right font-mono font-bold text-carbon">{selectedVehicle.plateNumber}</div>
                      <div className="text-slate">Loại Xe</div>
                      <div className="text-right font-bold text-carbon">{selectedVehicle.vehicleType === 'ROAD_TRUCK' ? 'Đầu kéo đường dài' : 'Đầu kéo nội bài'}</div>
                      <div className="text-slate">Ngày Tạo</div>
                      <div className="text-right text-carbon">{new Date(selectedVehicle.createdAt).toLocaleDateString('vi-VN')}</div>
                    </div>

                    {(selectedVehicle.registrationImageUrl || selectedVehicle.photoUrl) && (
                      <div className="mt-4 pt-4 border-t border-chalk">
                        <div className="text-[10px] font-bold text-slate uppercase mb-3">Tài Liệu Đính Kèm</div>
                        <div className="grid grid-cols-2 gap-4">
                          {selectedVehicle.photoUrl && (
                            <div className="space-y-2">
                              <div className="text-[9px] font-bold text-slate uppercase text-center">Ảnh Đại Diện Xe</div>
                              <div className="bg-fog p-1 rounded-xl border border-chalk h-28 flex items-center justify-center overflow-hidden cursor-pointer hover:border-signal-orange group" onClick={() => setZoomedImage(resolveMediaUrl(selectedVehicle.photoUrl))}>
                                <img src={resolveMediaUrl(selectedVehicle.photoUrl)} alt="Avatar Xe" 
                                  className="max-w-full max-h-full object-cover rounded-lg shadow-sm transition-transform group-hover:scale-110" />
                              </div>
                            </div>
                          )}
                          
                          {selectedVehicle.registrationImageUrl && (
                            <div className="space-y-2">
                              <div className="text-[9px] font-bold text-slate uppercase text-center">Ảnh Cà Vẹt</div>
                              <div className="bg-fog p-1 rounded-xl border border-chalk h-28 flex items-center justify-center overflow-hidden cursor-pointer hover:border-signal-orange group" onClick={() => setZoomedImage(resolveMediaUrl(selectedVehicle.registrationImageUrl))}>
                                <img src={resolveMediaUrl(selectedVehicle.registrationImageUrl)} alt="Cà Vẹt" 
                                  className="max-w-full max-h-full object-contain rounded-lg shadow-sm transition-transform group-hover:scale-105" 
                                  onLoad={e => { if (e.target.naturalHeight > e.target.naturalWidth) e.target.style.transform = 'rotate(-90deg) scale(1.1)'; }} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-slate uppercase tracking-wider">TÀI XẾ PHỤ TRÁCH</h4>
                    <form onSubmit={handleAssignDriver} className="flex gap-2">
                      <select 
                        value={driverAssignForm} 
                        onChange={e => setDriverAssignForm(e.target.value)}
                        className="flex-1 h-10 px-3 border border-chalk rounded-md text-xs text-carbon focus:border-carbon outline-none"
                      >
                        <option value="">-- Bỏ trống (Không phân công) --</option>
                        {drivers.filter(d => d.status === 'active' || d.id === selectedVehicle.driverId).map(d => (
                          <option key={d.id} value={d.id}>
                            {d.fullName} {d.id === selectedVehicle.driverId ? '(Đang phụ trách)' : ''}
                          </option>
                        ))}
                      </select>
                      <button 
                        type="submit" 
                        disabled={driverAssignForm === selectedVehicle.driverId}
                        className="h-10 px-4 bg-carbon text-white rounded-md font-bold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cập Nhật
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══ SELECTED DRIVER MODAL ═══ */}
      {selectedDriver && activeTab === 'drivers' && (
        <>
          <div className="fixed inset-0 bg-carbon/40 z-[60] backdrop-blur-sm" onClick={() => setSelectedDriver(null)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-chalk w-full max-w-md animate-in zoom-in-95 duration-200 p-6 space-y-6" onClick={e => e.stopPropagation()}>

              {/* Profile Header */}
              <div className="flex justify-between items-start border-b border-chalk pb-5">
                <div className="flex items-center space-x-4">
                  <DriverAvatar photoUrl={selectedDriver.photoUrl} fullName={selectedDriver.fullName} status={selectedDriver.status} className="w-12 h-12 text-base" />
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
                  {/* OCR Section */}
                  <div className="mb-4 space-y-3">
                    <div className="flex items-center gap-4 p-4 border border-dashed border-chalk rounded-xl bg-fog">
                      <DriverAvatar photoUrl={editForm.photoUrl || editForm.idCardFrontUrl} fullName={editForm.fullName} status={editForm.status} className="w-16 h-16 text-lg" />
                      <div className="flex-1 flex gap-2">
                        <div className="flex-1">
                          <label className={`inline-flex items-center justify-center w-full px-2 py-2 bg-white border border-chalk rounded-lg text-[11px] font-bold ${ocrLoading ? 'text-slate opacity-70 cursor-not-allowed' : 'text-carbon hover:bg-mist cursor-pointer'} relative overflow-hidden transition-colors shadow-sm`}>
                            {ocrLoading ? '⏳ Đang quét...' : '📷 Quét CCCD'}
                            <input type="file" accept="image/*" onChange={handleOcrUploadEdit} className="absolute inset-0 opacity-0 cursor-pointer" disabled={ocrLoading} />
                          </label>
                        </div>
                        <div className="flex-1">
                          <label className={`inline-flex items-center justify-center w-full px-2 py-2 bg-white border border-chalk rounded-lg text-[11px] font-bold ${ocrLoading ? 'text-slate opacity-70 cursor-not-allowed' : 'text-carbon hover:bg-mist cursor-pointer'} relative overflow-hidden transition-colors shadow-sm`}>
                            {ocrLoading ? '⏳ Đang quét...' : '📷 Quét GPLX'}
                            <input type="file" accept="image/*" onChange={handleGplxUploadEdit} className="absolute inset-0 opacity-0 cursor-pointer" disabled={ocrLoading} />
                          </label>
                        </div>
                      </div>
                    </div>

                    {(editForm.idCardFrontUrl || editForm.licenseImageUrl) && (
                      <div className="grid grid-cols-2 gap-3 p-3 bg-white border border-chalk rounded-xl">
                        {editForm.idCardFrontUrl && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate uppercase flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs text-green-600">check_circle</span>
                              Ảnh CCCD
                            </span>
                            <div className="h-20 bg-fog rounded-lg border border-chalk overflow-hidden cursor-pointer hover:border-signal-orange relative group" onClick={() => setZoomedImage(resolveMediaUrl(editForm.idCardFrontUrl))}>
                              <img src={resolveMediaUrl(editForm.idCardFrontUrl)} alt="CCCD Scan" className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                              <div className="absolute inset-0 bg-carbon/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <span className="material-symbols-outlined text-sm">zoom_in</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {editForm.licenseImageUrl && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate uppercase flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs text-green-600">check_circle</span>
                              Ảnh GPLX
                            </span>
                            <div className="h-20 bg-fog rounded-lg border border-chalk overflow-hidden cursor-pointer hover:border-signal-orange relative group" onClick={() => setZoomedImage(resolveMediaUrl(editForm.licenseImageUrl))}>
                              <img src={resolveMediaUrl(editForm.licenseImageUrl)} alt="GPLX Scan" className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                              <div className="absolute inset-0 bg-carbon/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <span className="material-symbols-outlined text-sm">zoom_in</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

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
                    <div className="flex justify-between items-center bg-orange-50/50 p-2.5 rounded-lg border border-orange-100">
                      <span className="text-orange-800 font-bold">Trực thuộc đơn vị</span>
                      <strong className="text-signal-orange text-right">{selectedDriver.carrierName || 'NexusPort · Cảng Tiên Sa'}</strong>
                    </div>
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

                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-chalk">
                      <DocumentCard
                        url={selectedDriver.idCardFrontUrl}
                        title="Ảnh CCCD"
                        alt="CCCD"
                        onClick={() => selectedDriver.idCardFrontUrl && setZoomedImage(resolveMediaUrl(selectedDriver.idCardFrontUrl))}
                      />
                      <DocumentCard
                        url={selectedDriver.licenseImageUrl}
                        title="Ảnh Bằng Lái"
                        alt="Bằng Lái"
                        onClick={() => selectedDriver.licenseImageUrl && setZoomedImage(resolveMediaUrl(selectedDriver.licenseImageUrl))}
                      />
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

      {/* ═══ ZOOMED IMAGE MODAL ═══ */}
      {zoomedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon/80 backdrop-blur-sm p-4" onClick={() => setZoomedImage(null)}>
          <button className="absolute top-6 right-6 text-white hover:text-signal-orange bg-carbon/50 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md">
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} 
               onLoad={e => { if (e.target.naturalHeight > e.target.naturalWidth) e.target.style.transform = 'rotate(-90deg) scale(1.1)'; else e.target.style.transform = 'none'; }} />
        </div>
      )}

      {/* ═══ ADD DRIVER MODAL ═══ */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 bg-carbon/40 z-[60] backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-chalk w-full max-w-md animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-chalk">
                <div>
                  <h3 className="font-heading text-xl font-extrabold text-carbon">Thêm Tài Xế Mới</h3>
                  <p className="text-[10px] text-slate mt-1">Cấp tài khoản nội bộ cho nhân sự mới</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-slate hover:text-carbon p-1 rounded-full hover:bg-fog">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleAddDriver} className="p-6 space-y-4 font-sans">
                {/* OCR Section */}
                <div className="mb-4 space-y-3">
                  <div className="flex items-center gap-4 p-4 border border-dashed border-chalk rounded-xl bg-fog">
                    <DriverAvatar photoUrl={form.photoUrl || form.idCardFrontUrl} fullName={form.fullName} className="w-16 h-16 text-lg" />
                    <div className="flex-1 flex gap-2">
                      <div className="flex-1">
                        <label className={`inline-flex items-center justify-center w-full px-2 py-2 bg-white border border-chalk rounded-lg text-[11px] font-bold ${ocrLoading ? 'text-slate opacity-70 cursor-not-allowed' : 'text-carbon hover:bg-mist cursor-pointer'} relative overflow-hidden transition-colors shadow-sm`}>
                          {ocrLoading ? '⏳ Đang quét...' : '📷 Quét CCCD'}
                          <input type="file" accept="image/*" onChange={handleOcrUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={ocrLoading} />
                        </label>
                      </div>
                      <div className="flex-1">
                        <label className={`inline-flex items-center justify-center w-full px-2 py-2 bg-white border border-chalk rounded-lg text-[11px] font-bold ${ocrLoading ? 'text-slate opacity-70 cursor-not-allowed' : 'text-carbon hover:bg-mist cursor-pointer'} relative overflow-hidden transition-colors shadow-sm`}>
                          {ocrLoading ? '⏳ Đang quét...' : '📷 Quét GPLX'}
                          <input type="file" accept="image/*" onChange={handleGplxUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={ocrLoading} />
                        </label>
                      </div>
                    </div>
                  </div>

                  {(form.idCardFrontUrl || form.licenseImageUrl) && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-white border border-chalk rounded-xl">
                      {form.idCardFrontUrl && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate uppercase flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs text-green-600">check_circle</span>
                            Ảnh CCCD đã quét
                          </span>
                          <div className="h-20 bg-fog rounded-lg border border-chalk overflow-hidden cursor-pointer hover:border-signal-orange relative group" onClick={() => setZoomedImage(resolveMediaUrl(form.idCardFrontUrl))}>
                            <img src={resolveMediaUrl(form.idCardFrontUrl)} alt="CCCD Scan" className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-carbon/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                              <span className="material-symbols-outlined text-sm">zoom_in</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {form.licenseImageUrl && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate uppercase flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs text-green-600">check_circle</span>
                            Ảnh GPLX đã quét
                          </span>
                          <div className="h-20 bg-fog rounded-lg border border-chalk overflow-hidden cursor-pointer hover:border-signal-orange relative group" onClick={() => setZoomedImage(resolveMediaUrl(form.licenseImageUrl))}>
                            <img src={resolveMediaUrl(form.licenseImageUrl)} alt="GPLX Scan" className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-carbon/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                              <span className="material-symbols-outlined text-sm">zoom_in</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-[10px] text-slate leading-tight">Tự động trích xuất thông tin và lưu ảnh trực tiếp lên AWS S3.</p>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1.5 tracking-wider">Họ và Tên *</label>
                    <input type="text" placeholder="VD: Nguyễn Văn A"
                      className="w-full h-11 px-3 border border-chalk rounded-xl text-sm text-carbon focus:border-carbon focus:ring-1 focus:ring-carbon outline-none transition-all bg-white"
                      value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1.5 tracking-wider">Số điện thoại *</label>
                    <input type="tel" placeholder="VD: 0987654321"
                      className="w-full h-11 px-3 border border-chalk rounded-xl text-sm text-carbon focus:border-carbon focus:ring-1 focus:ring-carbon outline-none transition-all bg-white"
                      value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1.5 tracking-wider">Số CCCD *</label>
                    <input type="text" placeholder="12 chữ số"
                      className="w-full h-11 px-3 border border-chalk rounded-xl text-sm text-carbon focus:border-carbon focus:ring-1 focus:ring-carbon outline-none transition-all bg-white"
                      value={form.idCardNumber} onChange={e => setForm({ ...form, idCardNumber: e.target.value })} required />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate uppercase mb-1.5 tracking-wider">Giấy Phép Lái Xe *</label>
                    <input type="text" placeholder="Nhập số GPLX (Hạng C/E/FC...)"
                      className="w-full h-11 px-3 border border-chalk rounded-xl text-sm text-carbon focus:border-carbon focus:ring-1 focus:ring-carbon outline-none transition-all bg-white uppercase"
                      value={form.licenseNumber} onChange={e => setForm({ ...form, licenseNumber: e.target.value })} required />
                  </div>
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
