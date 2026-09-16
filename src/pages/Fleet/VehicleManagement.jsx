import React, { useState, useEffect } from 'react'
import vehicleService from '../../services/vehicleService'
import driverService from '../../services/driverService'

export default function VehicleManagement() {
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('All') // 'All' | 'ROAD_TRUCK' | 'YARD_TRACTOR'
  const [statusFilter, setStatusFilter] = useState('All')
  const [locationFilter, setLocationFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVehicleDrawer, setSelectedVehiclePopover] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [toastMessage, setToastMessage] = useState('')

  const [isEditingDriver, setIsEditingDriver] = useState(false)
  const [editDriverId, setEditDriverId] = useState('')

  const [uploadingVehiclePhoto, setUploadingVehiclePhoto] = useState(false)
  const [ocrVehicleLoading, setOcrVehicleLoading] = useState(false)

  // Form State for Add Vehicle Modal
  const [newVehicle, setNewVehicle] = useState({
    id: '',
    type: 'ROAD_TRUCK',
    plate: '',
    driverId: '',
    location: 'Cổng 01 (Gate 01)',
    status: 'Available',
    photoUrl: null,
    registrationImageUrl: null
  })

  const [vehicles, setVehicles] = useState([])
  const [availableDrivers, setAvailableDrivers] = useState([])

  const loadVehiclesAndDrivers = async () => {
    try {
      const [vehiclesData, driversData] = await Promise.all([
        vehicleService.getAllVehicles(),
        driverService.getAllDrivers()
      ]);

      const tienSaDrivers = (driversData || []).filter(d => 
        !d.carrierName || d.carrierName.toLowerCase().includes('tiên sa')
      );
      setAvailableDrivers(tienSaDrivers);

      const mapped = vehiclesData.map(v => {
        let statusClass = 'bg-green-100 text-green-800 border-green-300'
        let statusLabel = 'Sẵn sàng'
        const lowerStatus = v.status.toLowerCase();
        
        if (lowerStatus === 'inactive' || lowerStatus === 'assigned') {
           statusClass = 'bg-blue-100 text-blue-800 border-blue-300'
           statusLabel = 'Đã chỉ định'
        } else if (lowerStatus === 'maintenance') {
           statusClass = 'bg-stone-200 text-stone-800 border-stone-400'
           statusLabel = 'Bảo trì'
        }

        return {
          id: v.id,
          type: v.vehicleType,
          typeName: v.vehicleType === 'ROAD_TRUCK' ? 'Xe Đầu Kéo Đường Dài' : 'Xe Đầu Kéo Nội Bãi',
          plate: v.plateNumber,
          driver: v.driverName || 'Chưa phân công',
          driverId: v.driverId || 'N/A',
          phone: 'N/A',
          driverStatus: v.driverId ? 'Đang làm việc' : 'Chưa phân công',
          location: 'Cảng Tiên Sa',
          task: 'Chờ lệnh',
          taskId: 'N/A',
          container: 'N/A',
          origin: 'Bãi',
          destination: 'N/A',
          status: v.status,
          statusLabel: statusLabel,
          statusClass: statusClass,
          lastUpdate: new Date(v.createdAt).toLocaleDateString(),
          eta: 'Sẵn sàng',
          completedTasks: 0,
          totalDistance: '0 km',
          workingTime: '0 giờ',
          delayTime: '0 phút',
          photoUrl: v.photoUrl,
          registrationImageUrl: v.registrationImageUrl
        }
      });
      setVehicles(mapped);
    } catch (err) {
      console.error(err);
      setToastMessage('❌ Lỗi tải dữ liệu xe: ' + err.message);
    }
  }

  useEffect(() => {
    loadVehiclesAndDrivers();
  }, [])

  // KPI Calculations
  const kpis = {
    total: vehicles.length,
    available: vehicles.filter(v => v.status === 'Available').length,
    assigned: vehicles.filter(v => v.status === 'Assigned').length,
    inTransit: vehicles.filter(v => v.status === 'In Transit').length,
    handling: vehicles.filter(v => v.status === 'Handling').length,
    maintenance: vehicles.filter(v => v.status === 'Maintenance').length
  }

  // Filter & Search Logic
  const filteredVehicles = vehicles.filter(v => {
    // Type Filter
    if (vehicleTypeFilter !== 'All' && v.type !== vehicleTypeFilter) return false
    // Status Filter
    if (statusFilter !== 'All' && v.status !== statusFilter) return false
    // Location Filter
    if (locationFilter !== 'All' && !v.location.includes(locationFilter)) return false

    // Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        v.id.toLowerCase().includes(q) ||
        v.plate.toLowerCase().includes(q) ||
        v.driver.toLowerCase().includes(q) ||
        v.container.toLowerCase().includes(q)
      )
    }

    return true
  })

  // Upload Handlers
  const handleVehiclePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingVehiclePhoto(true);
    try {
      const data = await vehicleService.uploadPhoto(file);
      setNewVehicle(f => ({
        ...f,
        photoUrl: data?.imageUrl || f.photoUrl
      }));
      setToastMessage('✅ Tải ảnh xe thành công!');
    } catch (err) {
      setToastMessage('❌ Lỗi tải ảnh xe: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingVehiclePhoto(false);
      e.target.value = '';
    }
  };

  const handleVehicleRegistrationUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setOcrVehicleLoading(true);
    try {
      const data = await vehicleService.extractRegistration(file);
      setNewVehicle(f => ({
        ...f,
        plate: data?.plateNumber || f.plate,
        registrationImageUrl: data?.imageUrl || f.registrationImageUrl
      }));
      if (data?.isSuccess === false) {
        setToastMessage('⚠️ ' + data.message);
      } else {
        setToastMessage('✅ Quét Cà Vẹt thành công!');
      }
    } catch (err) {
      setToastMessage('❌ Lỗi quét Cà Vẹt: ' + (err.response?.data?.message || err.message));
    } finally {
      setOcrVehicleLoading(false);
      e.target.value = '';
    }
  };

  // Add Vehicle Form Submit Handler
  const handleCreateVehicle = async (e) => {
    e.preventDefault()
    if (!newVehicle.plate) {
      alert('Vui lòng nhập Biển số xe!')
      return
    }

    try {
      // Actually save to backend API
      const newVhc = await vehicleService.createVehicle({
        plateNumber: newVehicle.plate,
        vehicleType: newVehicle.type,
        photoUrl: newVehicle.photoUrl,
        registrationImageUrl: newVehicle.registrationImageUrl,
        carrierId: '984eb832-8df7-463d-b4b1-a6dd2f3dbf07' // Hardcoded for demo
      });
      
      if (newVehicle.driverId) {
        await vehicleService.assignDriver(newVhc.id, newVehicle.driverId);
      }
      
      await loadVehiclesAndDrivers();
      
      setShowAddModal(false)
      setNewVehicle({ id: '', type: 'ROAD_TRUCK', plate: '', driver: '', location: 'Cổng 01 (Gate 01)', status: 'Available', photoUrl: null, registrationImageUrl: null })
      setToastMessage(`✅ Đã thêm phương tiện mới (${newVehicle.plate}) vào đội xe thành công!`)
      setTimeout(() => setToastMessage(''), 3500)
    } catch (err) {
      setToastMessage('❌ ' + (err.response?.data?.message || err.message));
    }
  };

  const handleAssignDriverSubmit = async () => {
    if (!selectedVehicleDrawer) return;
    try {
      const payloadDriverId = editDriverId === '' ? null : editDriverId;
      await vehicleService.assignDriver(selectedVehicleDrawer.id, payloadDriverId);
      setToastMessage('✅ Cập nhật phân công tài xế thành công!');
      setTimeout(() => setToastMessage(''), 3500);
      setIsEditingDriver(false);
      await loadVehiclesAndDrivers();
      
      // Update selected drawer state so it reflects instantly without reopening
      const updatedVehicle = (await vehicleService.getAllVehicles()).find(v => v.id === selectedVehicleDrawer.id);
      if (updatedVehicle) {
        // Just reload the page list, but for now we close the drawer or let the list reload cover it.
        // Easiest is just closing the drawer to refresh state cleanly.
        setSelectedVehiclePopover(null);
      }
    } catch (err) {
      setToastMessage('❌ ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="p-8 w-full font-sans flex flex-col gap-6 relative">

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-carbon text-white px-6 py-3.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-3 z-[999] animate-bounce border border-signal-orange">
          <span className="text-signal-orange font-bold text-base">●</span>
          {toastMessage}
        </div>
      )}

      {/* HEADER BAR */}
      <div className="flex justify-between items-center bg-white border border-chalk rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded uppercase">
              QUẢN LÝ ĐỘI XE CẢNG TIÊN SA, ĐÀ NẴNG
            </span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
              🟢 GIÁM SÁT REALTIME
            </span>
          </div>
          <h2 className="font-heading text-3xl text-carbon font-extrabold mt-1">Quản Lý Đội Xe</h2>
          <p className="text-xs text-slate mt-0.5">Giám sát và theo dõi toàn bộ xe đầu kéo đường dài & xe đầu kéo nội bãi cảng.</p>
        </div>

        {/* CTA + ADD VEHICLE BUTTON */}
        <button
          onClick={() => setShowAddModal(true)}
          className="h-11 px-5 bg-signal-orange text-white rounded-xl font-extrabold text-xs hover:opacity-95 transition-opacity shadow-lg flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Thêm Phương Tiện
        </button>
      </div>

      {/* KPI CARDS (6 STATS CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Tổng Số Xe</span>
          <div className="text-3xl font-extrabold text-carbon font-mono">{kpis.total}</div>
          <span className="text-[11px] text-slate font-bold">Tổng số xe đội cảng</span>
        </div>

        <div className="bg-white border-2 border-green-400 rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Sẵn Sàng</span>
          <div className="text-3xl font-extrabold text-green-600 font-mono">{kpis.available}</div>
          <span className="text-[11px] text-green-600 font-bold">Sẵn sàng nhận lệnh</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Đã Chỉ Định</span>
          <div className="text-3xl font-extrabold text-blue-600 font-mono">{kpis.assigned}</div>
          <span className="text-[11px] text-blue-600 font-bold">Đã có lệnh điều động</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Đang Di Chuyển</span>
          <div className="text-3xl font-extrabold text-purple-600 font-mono">{kpis.inTransit}</div>
          <span className="text-[11px] text-purple-600 font-bold">Đang lưu thông đường</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Đang Cẩu Dỡ</span>
          <div className="text-3xl font-extrabold text-amber-500 font-mono">{kpis.handling}</div>
          <span className="text-[11px] text-amber-600 font-bold">Đang bốc dỡ cẩu bãi</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">Bảo Trì</span>
          <div className="text-3xl font-extrabold text-stone-600 font-mono">{kpis.maintenance}</div>
          <span className="text-[11px] text-stone-600 font-bold">Đang bảo trì kỹ thuật</span>
        </div>

      </div>

      {/* SEARCH & MULTI-FILTER BAR */}
      <div className="bg-white border border-chalk rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 text-xs">

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate text-base">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm mã xe, biển số, tài xế, container..."
            className="w-full pl-9 pr-4 py-2 bg-fog border border-chalk rounded-xl text-xs font-medium focus:outline-none focus:border-signal-orange"
          />
        </div>

        {/* Filter Pills & Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto font-bold">

          {/* Vehicle Type Filter Pills */}
          <div className="flex bg-fog p-1 rounded-xl border border-chalk">
            <button
              onClick={() => setVehicleTypeFilter('All')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${vehicleTypeFilter === 'All' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'
                }`}
            >
              Tất cả loại xe
            </button>
            <button
              onClick={() => setVehicleTypeFilter('ROAD_TRUCK')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${vehicleTypeFilter === 'ROAD_TRUCK' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'
                }`}
            >
              🚚 Road Truck (Đường dài)
            </button>
            <button
              onClick={() => setVehicleTypeFilter('YARD_TRACTOR')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${vehicleTypeFilter === 'YARD_TRACTOR' ? 'bg-carbon text-white shadow-sm' : 'text-slate hover:text-carbon'
                }`}
            >
              🚜 Yard Tractor (Nội bãi)
            </button>
          </div>

          {/* Status Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 bg-fog border border-chalk rounded-xl text-xs font-bold text-carbon focus:outline-none focus:border-signal-orange"
          >
            <option value="All">Tất cả Trạng thái</option>
            <option value="Available">🟢 Sẵn sàng (Available)</option>
            <option value="Assigned">🔵 Đã chỉ định (Assigned)</option>
            <option value="In Transit">🟣 Đang di chuyển (In Transit)</option>
            <option value="Handling">🟡 Đang cẩu dỡ (Handling)</option>
            <option value="Delayed">🔴 Bị trễ hạn (Delayed)</option>
            <option value="Maintenance">🔧 Bảo trì (Maintenance)</option>
          </select>

          {/* Location Filter Dropdown */}
          <select
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value)}
            className="px-3.5 py-2 bg-fog border border-chalk rounded-xl text-xs font-bold text-carbon focus:outline-none focus:border-signal-orange"
          >
            <option value="All">Tất cả Vị trí</option>
            <option value="Cổng">Cổng vào / Cổng ra</option>
            <option value="Khối bãi">Khối bãi (Block A-F)</option>
            <option value="Road">Tuyến đường nội bộ</option>
            <option value="Bảo Trì">Xưởng bảo trì</option>
          </select>

        </div>

      </div>

      {/* VEHICLE TABLE (BẢNG DANH SÁCH ĐỘI XE) */}
      <div className="bg-white border border-chalk rounded-2xl p-6 shadow-sm space-y-4">

        <div className="flex justify-between items-center border-b border-chalk pb-3">
          <div>
            <h3 className="font-heading text-xl font-extrabold text-carbon">Danh Sách Đội Xe Vận Chuyển Container</h3>
            <p className="text-xs text-slate font-mono mt-0.5">Hiển thị {filteredVehicles.length} / {vehicles.length} phương tiện trong hệ thống</p>
          </div>
          <span className="text-xs text-slate font-mono font-bold">Cập nhật lúc: vừa xong (Realtime)</span>
        </div>

        {filteredVehicles.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center text-slate space-y-3 font-sans">
            <span className="material-symbols-outlined text-4xl text-slate">no_sim</span>
            <p className="font-bold text-sm">Không tìm thấy phương tiện nào phù hợp với bộ lọc!</p>
            <button
              onClick={() => {
                setVehicleTypeFilter('All')
                setStatusFilter('All')
                setLocationFilter('All')
                setSearchQuery('')
              }}
              className="text-xs font-bold text-signal-orange underline hover:opacity-80"
            >
              Xóa bộ lọc tìm kiếm
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-fog text-slate font-bold uppercase text-[10px] border-b border-chalk">
                  <th className="py-3 px-3">Phương Tiện</th>
                  <th className="py-3 px-3">Phân Loại</th>
                  <th className="py-3 px-3">Biển Số Xe</th>
                  <th className="py-3 px-3">Tài Xế Phụ Trách</th>
                  <th className="py-3 px-3">Vị Trí Hiện Tại</th>
                  <th className="py-3 px-3">Nhiệm Vụ Hiện Tại</th>
                  <th className="py-3 px-3">Container Chở</th>
                  <th className="py-3 px-3">Trạng Thái</th>
                  <th className="py-3 px-3">Cập Nhật Cuối</th>
                  <th className="py-3 px-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk font-medium font-mono">
                {filteredVehicles.map(v => (
                  <tr key={v.id} className="hover:bg-fog/60 transition-colors">
                    <td className="py-3.5 px-3 font-bold text-carbon text-sm">{v.id}</td>

                    <td className="py-3.5 px-3 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v.type === 'ROAD_TRUCK' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                        {v.type === 'ROAD_TRUCK' ? '🚚 Road Truck' : '🚜 Yard Tractor'}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 font-bold text-carbon">{v.plate}</td>

                    <td className="py-3.5 px-3 font-sans text-graphite">
                      <div className="font-bold text-carbon">{v.driver}</div>
                      <span className="text-[10px] text-slate font-mono">{v.phone}</span>
                    </td>

                    <td className="py-3.5 px-3 font-sans text-slate">{v.location}</td>

                    <td className="py-3.5 px-3 font-sans text-signal-orange font-bold">
                      {v.task}
                    </td>

                    <td className="py-3.5 px-3 font-bold text-carbon">{v.container}</td>

                    <td className="py-3.5 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${v.statusClass}`}>
                        ● {v.statusLabel}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-slate font-sans">{v.lastUpdate}</td>

                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => setSelectedVehiclePopover(v)}
                        className="px-3 py-1.5 bg-carbon text-white rounded-lg font-bold text-[11px] hover:bg-black transition-colors shadow"
                      >
                        Xem Chi Tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* VEHICLE DETAIL DRAWER (SIDE MODAL DRAWER) */}
      {selectedVehicleDrawer && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white h-full border-l border-chalk shadow-2xl p-8 flex flex-col justify-between space-y-6 overflow-y-auto animate-in slide-in-from-right duration-300">

            {/* Drawer Header */}
            <div className="flex justify-between items-start border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">THÔNG TIN CHI TIẾT PHƯƠNG TIỆN</span>
                <h3 className="font-heading text-3xl font-extrabold text-carbon font-mono">{selectedVehicleDrawer.id}</h3>
                <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full mt-1 border ${selectedVehicleDrawer.statusClass}`}>
                  ● {selectedVehicleDrawer.statusLabel}
                </span>
              </div>
              <button
                onClick={() => setSelectedVehiclePopover(null)}
                className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Drawer Main Info Body */}
            <div className="space-y-5 text-xs font-mono">

              {/* 1. Vehicle Information */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate uppercase font-sans">1. THÔNG TIN PHƯƠNG TIỆN (VEHICLE INFO)</span>
                <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2">
                  <div className="flex justify-between"><span className="text-slate font-sans">Mã phương tiện:</span><strong className="text-carbon">{selectedVehicleDrawer.id}</strong></div>
                  <div className="flex justify-between"><span className="text-slate font-sans">Phân loại xe:</span><strong className="text-signal-orange font-sans">{selectedVehicleDrawer.typeName}</strong></div>
                  <div className="flex justify-between"><span className="text-slate font-sans">Biển số xe:</span><strong className="text-carbon">{selectedVehicleDrawer.plate}</strong></div>
                  <div className="flex justify-between"><span className="text-slate font-sans">Vị trí hiện tại:</span><strong className="text-carbon font-sans">{selectedVehicleDrawer.location}</strong></div>
                </div>
              </div>

              {/* 2. Driver Information */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate uppercase font-sans">2. TÀI XẾ PHỤ TRÁCH (DRIVER INFO)</span>
                  {!isEditingDriver ? (
                    <button onClick={() => { setIsEditingDriver(true); setEditDriverId(selectedVehicleDrawer.driverId || ''); }} className="text-[10px] font-bold text-signal-orange underline hover:text-orange-700">Chỉnh sửa</button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setIsEditingDriver(false)} className="text-[10px] font-bold text-slate underline hover:text-carbon">Hủy</button>
                      <button onClick={handleAssignDriverSubmit} className="text-[10px] font-bold text-green-600 underline hover:text-green-700">Lưu thay đổi</button>
                    </div>
                  )}
                </div>
                
                {!isEditingDriver ? (
                  <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2">
                    <div className="flex justify-between"><span className="text-slate font-sans">Tên tài xế:</span><strong className="text-carbon font-sans font-bold">{selectedVehicleDrawer.driver}</strong></div>
                    <div className="flex justify-between"><span className="text-slate font-sans">Mã tài xế:</span><strong className="text-carbon">{selectedVehicleDrawer.driverId || 'N/A'}</strong></div>
                    <div className="flex justify-between"><span className="text-slate font-sans">Số điện thoại:</span><strong className="text-carbon">{selectedVehicleDrawer.phone || 'N/A'}</strong></div>
                    <div className="flex justify-between"><span className="text-slate font-sans">Trạng thái tài xế:</span><strong className="text-green-600 font-sans">{selectedVehicleDrawer.driverStatus || 'N/A'}</strong></div>
                  </div>
                ) : (
                  <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-3">
                    <label className="block text-[11px] font-bold text-slate font-sans uppercase mb-1">Chọn Tài Xế Phụ Trách</label>
                    <select
                      value={editDriverId}
                      onChange={e => setEditDriverId(e.target.value)}
                      className="w-full p-3 bg-white border border-chalk rounded-xl font-bold text-carbon text-xs focus:outline-none focus:border-signal-orange"
                    >
                      <option value="">-- Bỏ phân công (Chưa phân công) --</option>
                      {availableDrivers.map(d => (
                        <option key={d.id} value={d.id}>{d.fullName} - {d.phone}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 3. Current Task Information */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate uppercase font-sans">3. NHIỆM VỤ HIỆN TẠI (CURRENT TASK)</span>
                <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2">
                  <div className="flex justify-between"><span className="text-slate font-sans">Nhiệm vụ:</span><strong className="text-signal-orange font-sans font-bold">{selectedVehicleDrawer.task}</strong></div>
                  <div className="flex justify-between"><span className="text-slate font-sans">Mã Lệnh:</span><strong className="text-carbon">{selectedVehicleDrawer.taskId}</strong></div>
                  <div className="flex justify-between"><span className="text-slate font-sans">Mã Container:</span><strong className="text-carbon font-bold">{selectedVehicleDrawer.container}</strong></div>
                  <div className="flex justify-between"><span className="text-slate font-sans">Điểm xuất phát:</span><strong className="text-carbon font-sans">{selectedVehicleDrawer.origin}</strong></div>
                  <div className="flex justify-between"><span className="text-slate font-sans">Điểm đến:</span><strong className="text-signal-orange font-sans font-bold">{selectedVehicleDrawer.destination}</strong></div>
                  <div className="flex justify-between border-t border-chalk pt-2"><span className="text-slate font-sans">Dự kiến ETA:</span><strong className="text-carbon">{selectedVehicleDrawer.eta}</strong></div>
                </div>
              </div>

              {/* 4. Today's Activity Stats */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate uppercase font-sans">4. HOẠT ĐỘNG TRONG NGÀY (TODAY'S ACTIVITY)</span>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-fog p-3 rounded-xl border border-chalk">
                    <span className="text-[10px] text-slate block font-sans">Nhiệm vụ hoàn thành</span>
                    <strong className="text-base text-carbon">{selectedVehicleDrawer.completedTasks} chuyến</strong>
                  </div>
                  <div className="bg-fog p-3 rounded-xl border border-chalk">
                    <span className="text-[10px] text-slate block font-sans">Tổng quãng đường</span>
                    <strong className="text-base text-carbon">{selectedVehicleDrawer.totalDistance}</strong>
                  </div>
                  <div className="bg-fog p-3 rounded-xl border border-chalk">
                    <span className="text-[10px] text-slate block font-sans">Thời gian vận hành</span>
                    <strong className="text-base text-carbon">{selectedVehicleDrawer.workingTime}</strong>
                  </div>
                  <div className="bg-fog p-3 rounded-xl border border-chalk">
                    <span className="text-[10px] text-slate block font-sans">Thời gian trễ hạn</span>
                    <strong className="text-base text-red-600">{selectedVehicleDrawer.delayTime}</strong>
                  </div>
                </div>
              </div>

              {/* 5. Mini Location Map Visualizer */}
              <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-200 space-y-2">
                <span className="text-[10px] font-bold text-orange-800 uppercase block font-sans">5. BẢN ĐỒ VỊ TRÍ MINI (MINI LOCATION MAP)</span>
                <div className="flex items-center justify-between font-bold text-carbon text-xs">
                  <span>📍 {selectedVehicleDrawer.location}</span>
                  <span className="text-signal-orange">➔ {selectedVehicleDrawer.destination}</span>
                </div>
                <p className="text-[11px] text-slate-700 font-sans">Xe đang di chuyển theo luồng giao thông nội bộ đường Road 01.</p>
              </div>

            </div>

            {/* Drawer Bottom Actions */}
            <div className="pt-4 border-t border-chalk flex gap-3">
              <button
                onClick={() => setSelectedVehiclePopover(null)}
                className="w-full h-11 border border-chalk rounded-full text-slate font-bold text-xs hover:bg-fog"
              >
                Đóng lại
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ADD VEHICLE MODAL (+ THÊM PHƯƠNG TIỆN) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <form onSubmit={handleCreateVehicle} className="bg-white rounded-3xl p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">

            <div className="flex justify-between items-center border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-bold text-signal-orange uppercase tracking-wider block">TẠO HỒ SƠ PHƯƠNG TIỆN</span>
                <h3 className="font-heading text-2xl font-extrabold text-carbon">+ Thêm Xe Mới Khẩu Đội</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate uppercase font-sans">Ảnh Đại Diện Xe</label>
                  <div className="relative">
                    <input type="file" accept="image/*" onChange={handleVehiclePhotoUpload} disabled={uploadingVehiclePhoto}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className={`h-11 border-2 border-dashed border-chalk rounded-lg flex items-center justify-center text-[10px] font-bold transition-colors font-sans ${uploadingVehiclePhoto ? 'bg-fog text-slate' : 'bg-white text-carbon hover:border-carbon'}`}>
                      {uploadingVehiclePhoto ? 'Đang tải...' : (newVehicle.photoUrl ? '✅ Đã tải ảnh' : '📸 Tải ảnh xe')}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate uppercase font-sans">Ảnh Cà Vẹt (AI)</label>
                  <div className="relative">
                    <input type="file" accept="image/*" onChange={handleVehicleRegistrationUpload} disabled={ocrVehicleLoading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className={`h-11 border-2 border-dashed border-chalk rounded-lg flex items-center justify-center text-[10px] font-bold transition-colors font-sans ${ocrVehicleLoading ? 'bg-fog text-slate' : 'bg-white text-carbon hover:border-carbon'}`}>
                      {ocrVehicleLoading ? 'Đang quét...' : (newVehicle.registrationImageUrl ? '✅ Đã quét' : '🔍 Quét Cà Vẹt')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden">
                <label className="block text-[11px] font-bold text-slate font-sans uppercase mb-1">Mã Phương Tiện (Vehicle ID) *</label>
                <input
                  type="text"
                  value={newVehicle.id}
                  onChange={e => setNewVehicle({ ...newVehicle, id: e.target.value })}
                  placeholder="Tự động tạo..."
                  className="w-full p-3 bg-fog border border-chalk rounded-xl font-bold text-carbon focus:outline-none focus:border-signal-orange"
                  readOnly
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate font-sans uppercase mb-1">Loại Xe (Vehicle Type) *</label>
                  <select
                    value={newVehicle.type}
                    onChange={e => setNewVehicle({ ...newVehicle, type: e.target.value })}
                    className="w-full p-3 bg-fog border border-chalk rounded-xl font-bold text-carbon focus:outline-none focus:border-signal-orange"
                  >
                    <option value="ROAD_TRUCK">🚚 Xe Đầu Kéo Đường Dài</option>
                    <option value="YARD_TRACTOR">🚜 Xe Đầu Kéo Nội Bãi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate font-sans uppercase mb-1">Biển Số Xe (Plate) *</label>
                  <input
                    type="text"
                    required
                    value={newVehicle.plate}
                    onChange={e => setNewVehicle({ ...newVehicle, plate: e.target.value })}
                    placeholder="VD: 43C-998.12"
                    className="w-full p-3 bg-fog border border-chalk rounded-xl font-bold text-carbon focus:outline-none focus:border-signal-orange"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate font-sans uppercase mb-1">Tài Xế Phụ Trách</label>
                  <select
                    value={newVehicle.driverId}
                    onChange={e => setNewVehicle({ ...newVehicle, driverId: e.target.value })}
                    className="w-full p-3 bg-fog border border-chalk rounded-xl font-bold text-carbon focus:outline-none focus:border-signal-orange"
                  >
                    <option value="">-- Chưa phân công --</option>
                    {availableDrivers.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate font-sans uppercase mb-1">Vị Trí Ban Đầu</label>
                  <input
                    type="text"
                    value={newVehicle.location}
                    onChange={e => setNewVehicle({ ...newVehicle, location: e.target.value })}
                    placeholder="VD: Cổng 01..."
                    className="w-full p-3 bg-fog border border-chalk rounded-xl font-bold text-carbon focus:outline-none focus:border-signal-orange"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate font-sans uppercase mb-1">Trạng Thái Ban Đầu</label>
                  <select
                    value={newVehicle.status}
                    onChange={e => setNewVehicle({ ...newVehicle, status: e.target.value })}
                    className="w-full p-3 bg-fog border border-chalk rounded-xl font-bold text-carbon focus:outline-none focus:border-signal-orange"
                  >
                    <option value="Available">🟢 Sẵn sàng (Available)</option>
                    <option value="Assigned">🔵 Đã chỉ định (Assigned)</option>
                    <option value="Maintenance">🔧 Bảo trì (Maintenance)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 h-12 rounded-full border border-chalk font-bold text-xs hover:bg-fog transition-colors"
              >
                Hủy bỏ (Cancel)
              </button>

              <button
                type="submit"
                className="flex-1 h-12 bg-signal-orange text-white rounded-full font-extrabold text-xs hover:opacity-95 transition-opacity shadow-lg"
              >
                + THÊM PHƯƠNG TIỆN
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  )
}
