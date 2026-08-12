import React, { useState, useMemo } from 'react'
import { initialCargoDeclarations } from '../../data/cargoDeclarations'

export default function CargoDeclaration() {
  const [declarations, setDeclarations] = useState(initialCargoDeclarations)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [containerTypeFilter, setContainerTypeFilter] = useState('All')
  const [cargoTypeFilter, setCargoTypeFilter] = useState('All')
  
  // Modal & Drawer states
  const [selectedDeclaration, setSelectedDeclaration] = useState(null)
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)

  // Wizard Step State (1 to 5)
  const [wizardStep, setWizardStep] = useState(1)

  // Form State
  const [formData, setFormData] = useState({
    containerId: '',
    containerType: '40HC',
    containerStatus: 'Loaded',
    cargoType: 'Export Dry',
    cargoName: '',
    quantity: '',
    unit: 'Carton',
    cargoWeight: '',
    grossWeight: '',
    hsCode: '',
    description: '',
    dangerousGoods: false,
    imoClass: 'Class 3',
    unNumber: '',
    shippingName: '',
    packingGroup: 'II',
    isReefer: false,
    reeferTemp: '-18',
    tempMin: '-20',
    tempMax: '-16',
    ventilation: '15 m3/h',
    operationType: 'Pickup',
    port: 'Cảng Tiên Sa - Đà Nẵng',
    bookingNumber: '',
    vessel: 'MOL TRIUMPH',
    voyage: 'VN001',
    expectedDate: new Date().toISOString().split('T')[0],
    notes: '',
    documents: [
      { name: 'Booking Confirmation.pdf', size: '1.2 MB', status: 'Uploaded' },
      { name: 'Delivery Order.pdf', size: '850 KB', status: 'Uploaded' }
    ]
  })

  // Toast notification state
  const [toastMessage, setToastMessage] = useState('')

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4000)
  }

  // 1. KPI Stats Calculation
  const kpiStats = useMemo(() => {
    const total = declarations.length
    const draft = declarations.filter(d => d.status === 'Draft').length
    const pending = declarations.filter(d => d.status === 'Submitted' || d.status === 'Under Review').length
    const approved = declarations.filter(d => d.status === 'Approved').length
    const rejected = declarations.filter(d => d.status === 'Rejected').length
    return { total, draft, pending, approved, rejected }
  }, [declarations])

  // 2. Filtered Declarations List
  const filteredDeclarations = useMemo(() => {
    return declarations.filter(d => {
      // Search query
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        d.id.toLowerCase().includes(q) ||
        d.containerId.toLowerCase().includes(q) ||
        d.bookingNumber.toLowerCase().includes(q) ||
        d.cargoName.toLowerCase().includes(q)

      // Status filter
      let matchesStatus = true
      if (statusFilter !== 'All') {
        matchesStatus = d.status === statusFilter
      }

      // Container type filter
      let matchesContType = true
      if (containerTypeFilter !== 'All') {
        matchesContType = d.containerType === containerTypeFilter
      }

      // Cargo type filter
      let matchesCargoType = true
      if (cargoTypeFilter !== 'All') {
        matchesCargoType = d.cargoType === cargoTypeFilter
      }

      return matchesSearch && matchesStatus && matchesContType && matchesCargoType
    })
  }, [declarations, searchQuery, statusFilter, containerTypeFilter, cargoTypeFilter])

  // Container ID Validation Regex (4 letters + 7 numbers, e.g., MSCU1234567)
  const isValidContainerId = useMemo(() => {
    const regex = /^[A-Z]{4}\d{7}$/
    return regex.test(formData.containerId.trim().toUpperCase())
  }, [formData.containerId])

  // Auto-detect Reefer
  const checkReefer = (contType, cgoType) => {
    return contType === 'Reefer' || cgoType === 'Reefer' || contType.includes('RF')
  }

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingId(null)
    setWizardStep(1)
    setFormData({
      containerId: 'MSCU1234567',
      containerType: '40HC',
      containerStatus: 'Loaded',
      cargoType: 'Export Dry',
      cargoName: 'Linh kiện điện tử',
      quantity: 120,
      unit: 'Carton',
      cargoWeight: 18500,
      grossWeight: 22500,
      hsCode: '8517.13',
      description: 'Linh kiện vi mạch điện tử xuất khẩu',
      dangerousGoods: false,
      imoClass: 'Class 3',
      unNumber: 'UN1203',
      shippingName: 'MOTOR SPIRIT',
      packingGroup: 'II',
      isReefer: false,
      reeferTemp: '-18',
      tempMin: '-20',
      tempMax: '-16',
      ventilation: '15 m3/h',
      operationType: 'Pickup',
      port: 'Cảng Tiên Sa - Đà Nẵng',
      bookingNumber: 'BK-20260811-' + Math.floor(100 + Math.random() * 900),
      vessel: 'MOL TRIUMPH',
      voyage: 'VN001',
      expectedDate: new Date().toISOString().split('T')[0],
      notes: 'Khai báo mới từ Doanh nghiệp vận tải',
      documents: [
        { name: 'Booking Confirmation.pdf', size: '1.2 MB', status: 'Uploaded' },
        { name: 'Cargo Declaration.pdf', size: '1.8 MB', status: 'Uploaded' }
      ]
    })
    setIsWizardOpen(true)
  }

  // Edit Declaration
  const handleEdit = (dec) => {
    if (dec.status === 'Submitted' || dec.status === 'Under Review' || dec.status === 'Approved') {
      showToast('⚠️ Khai báo đã gửi/được duyệt không thể chỉnh sửa trực tiếp.')
      return
    }
    setEditingId(dec.id)
    setFormData({ ...dec })
    setWizardStep(1)
    setIsWizardOpen(true)
  }

  // Delete Draft Declaration
  const handleDeleteDraft = (id) => {
    setDeclarations(prev => prev.filter(d => d.id !== id))
    showToast('🗑️ Đã xóa bản nháp khai báo hàng hóa.')
  }

  // Save Draft
  const handleSaveDraft = () => {
    const newId = editingId || `CD-20260811-${String(declarations.length + 1).padStart(3, '0')}`
    const draftObject = {
      ...formData,
      id: newId,
      status: 'Draft',
      createdAt: new Date().toLocaleString('vi-VN'),
      approvedBy: '',
      approvedAt: '',
      rejectionReason: ''
    }

    if (editingId) {
      setDeclarations(prev => prev.map(d => d.id === editingId ? draftObject : d))
    } else {
      setDeclarations(prev => [draftObject, ...prev])
    }

    setIsWizardOpen(false)
    showToast(`💾 Đã lưu nháp khai báo ${newId}. Trạng thái: Draft`)
  }

  // Submit Declaration Confirmation Prompt
  const handlePromptSubmit = () => {
    // Validate required fields
    if (!formData.containerId || !formData.cargoName || !formData.quantity || !formData.cargoWeight || !formData.bookingNumber) {
      showToast('⚠ Vui lòng điền đầy đủ các thông tin bắt buộc (*)!')
      return
    }
    if (!isValidContainerId) {
      showToast('⚠ Mã Container ID không hợp lệ (Ví dụ: MSCU1234567)!')
      return
    }
    if (formData.dangerousGoods && (!formData.unNumber || !formData.shippingName)) {
      showToast('⚠ Hàng nguy hiểm yêu cầu nhập UN Number và Proper Shipping Name!')
      return
    }

    setIsSubmitConfirmOpen(true)
  }

  // Confirm Submit to Terminal
  const handleConfirmFinalSubmit = () => {
    const newId = editingId || `CD-20260811-${String(declarations.length + 1).padStart(3, '0')}`
    const submittedObject = {
      ...formData,
      id: newId,
      status: 'Submitted',
      createdAt: new Date().toLocaleString('vi-VN'),
      approvedBy: '',
      approvedAt: '',
      rejectionReason: ''
    }

    if (editingId) {
      setDeclarations(prev => prev.map(d => d.id === editingId ? submittedObject : d))
    } else {
      setDeclarations(prev => [submittedObject, ...prev])
    }

    setIsSubmitConfirmOpen(false)
    setIsWizardOpen(false)
    showToast(`✓ Khai báo đã được gửi thành công! Mã khai báo: ${newId}`)
  }

  // Helper Badge Renderers
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Draft':
        return <span className="px-3 py-1 bg-slate-100 text-slate-800 border border-slate-300 rounded-full font-extrabold text-[11px] inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400"></span> Draft</span>
      case 'Submitted':
        return <span className="px-3 py-1 bg-blue-100 text-blue-900 border border-blue-300 rounded-full font-extrabold text-[11px] inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Submitted</span>
      case 'Under Review':
        return <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full font-extrabold text-[11px] inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Under Review</span>
      case 'Approved':
        return <span className="px-3 py-1 bg-green-100 text-green-900 border border-green-300 rounded-full font-extrabold text-[11px] inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"></span> Approved</span>
      case 'Rejected':
        return <span className="px-3 py-1 bg-red-100 text-red-900 border border-red-300 rounded-full font-extrabold text-[11px] inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> Rejected</span>
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full font-bold text-[11px]">{status}</span>
    }
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 relative bg-slate-50 min-h-screen">
      
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-carbon text-white px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-extrabold flex items-center gap-3 z-50 animate-bounce border border-signal-orange">
          <span className="material-symbols-outlined text-signal-orange text-base animate-spin">info</span>
          {toastMessage}
        </div>
      )}

      {/* ── 2. PAGE HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-chalk rounded-2xl p-5 shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full uppercase">
              TRANSPORT COMPANY PORTAL
            </span>
          </div>
          <h2 className="font-heading text-3xl text-carbon font-extrabold">KHAI BÁO HÀNG HÓA</h2>
          <p className="text-xs text-slate mt-0.5">Khai báo thông tin container và hàng hóa trước khi đăng ký chuyến đến cảng.</p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="h-11 px-5 bg-signal-orange text-white rounded-xl font-extrabold text-xs hover:opacity-95 transition-opacity shadow-lg flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          + Tạo khai báo mới
        </button>
      </div>

      {/* ── 3. KPI SUMMARY (5 CARDS) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">TỔNG KHAI BÁO</span>
          <div className="text-3xl font-extrabold text-carbon font-mono">{kpiStats.total}</div>
          <span className="text-[11px] text-slate font-bold">Tổng lượt khai báo</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">BẢN NHÁP (DRAFT)</span>
          <div className="text-3xl font-extrabold text-slate-600 font-mono">{kpiStats.draft}</div>
          <span className="text-[11px] text-slate-600 font-bold">Chưa gửi duyệt</span>
        </div>

        <div className="bg-white border border-chalk rounded-xl p-4 shadow-sm space-y-1">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">CHỜ DUYỆT</span>
          <div className="text-3xl font-extrabold text-blue-600 font-mono">{kpiStats.pending}</div>
          <span className="text-[11px] text-blue-600 font-bold">Đang ở hàng đợi Terminal</span>
        </div>

        <div className="bg-white border border-green-300 rounded-xl p-4 shadow-sm space-y-1 bg-green-50/30">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">ĐÃ DUYỆT</span>
          <div className="text-3xl font-extrabold text-green-600 font-mono">{kpiStats.approved}</div>
          <span className="text-[11px] text-green-700 font-bold">Sẵn sàng tạo Gate Booking</span>
        </div>

        <div className="bg-white border border-red-300 rounded-xl p-4 shadow-sm space-y-1 bg-red-50/30">
          <span className="text-slate text-[10px] uppercase font-bold tracking-wider">BỊ TỪ CHỐI</span>
          <div className="text-3xl font-extrabold text-red-600 font-mono">{kpiStats.rejected}</div>
          <span className="text-[11px] text-red-600 font-bold">Cần chỉnh sửa gửi lại</span>
        </div>
      </div>

      {/* ── 4. CARGO DECLARATION LIST & FILTERS ── */}
      <div className="bg-white rounded-2xl border border-chalk p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Search Input */}
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate text-sm">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm mã container, mã khai báo, booking, tên hàng..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-chalk bg-fog text-xs font-bold text-carbon placeholder:text-slate focus:outline-none focus:border-signal-orange"
          />
        </div>

        {/* Filters Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
          >
            <option value="All">Tất cả Trạng thái ▼</option>
            <option value="Draft">Draft (Bản nháp)</option>
            <option value="Submitted">Submitted (Đã gửi)</option>
            <option value="Under Review">Under Review (Đang duyệt)</option>
            <option value="Approved">Approved (Đã duyệt)</option>
            <option value="Rejected">Rejected (Bị từ chối)</option>
          </select>

          {/* Container Type Filter */}
          <select
            value={containerTypeFilter}
            onChange={e => setContainerTypeFilter(e.target.value)}
            className="px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
          >
            <option value="All">Tất cả loại container ▼</option>
            <option value="20FT">20FT</option>
            <option value="40FT">40FT</option>
            <option value="40HC">40HC</option>
            <option value="45FT">45FT</option>
          </select>

          {/* Cargo Type Filter */}
          <select
            value={cargoTypeFilter}
            onChange={e => setCargoTypeFilter(e.target.value)}
            className="px-3.5 py-2 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
          >
            <option value="All">Tất cả loại hàng ▼</option>
            <option value="Export Dry">Export Dry</option>
            <option value="Import Dry">Import Dry</option>
            <option value="Reefer">Reefer (Hàng lạnh)</option>
            <option value="General Cargo">General Cargo</option>
            <option value="Other">Khác</option>
          </select>
        </div>
      </div>

      {/* ── DECLARATION TABLE ── */}
      <div className="bg-white rounded-2xl border border-chalk shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-fog border-b border-chalk text-slate font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-6">Mã Khai Báo</th>
                <th className="py-3.5 px-6">Container ID</th>
                <th className="py-3.5 px-6">Loại Cont</th>
                <th className="py-3.5 px-6">Loại Hàng & Tên Hàng</th>
                <th className="py-3.5 px-6">Booking Number</th>
                <th className="py-3.5 px-6">Ngày Khai Báo</th>
                <th className="py-3.5 px-6">Trạng Thái</th>
                <th className="py-3.5 px-6 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk font-medium">
              {filteredDeclarations.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate font-bold">
                    Không tìm thấy bản khai báo hàng hóa nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredDeclarations.map(dec => (
                  <tr
                    key={dec.id}
                    className="hover:bg-fog/80 transition-colors"
                  >
                    <td
                      onClick={() => setSelectedDeclaration(dec)}
                      className="py-4 px-6 font-mono font-extrabold text-signal-orange cursor-pointer hover:underline"
                    >
                      {dec.id}
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-carbon">
                      {dec.containerId}
                      {dec.dangerousGoods && (
                        <span className="ml-1.5 px-1.5 py-0.5 bg-red-100 text-red-800 text-[9px] font-extrabold rounded border border-red-300">
                          ⚠️ DG {dec.imoClass}
                        </span>
                      )}
                      {dec.isReefer && (
                        <span className="ml-1.5 px-1.5 py-0.5 bg-cyan-100 text-cyan-800 text-[9px] font-extrabold rounded border border-cyan-300">
                          ❄️ {dec.reeferTemp}°C
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-mono font-bold">
                      <span className="bg-carbon text-white px-2 py-0.5 rounded text-[10px]">{dec.containerType}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-carbon">{dec.cargoName}</div>
                      <div className="text-[10px] text-slate font-mono">{dec.cargoType} • {dec.quantity} {dec.unit} ({dec.cargoWeight.toLocaleString()} kg)</div>
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-slate-800">
                      {dec.bookingNumber}
                    </td>
                    <td className="py-4 px-6 text-slate font-mono">
                      {dec.createdAt.split(' ')[0]}
                    </td>
                    <td className="py-4 px-6">
                      {renderStatusBadge(dec.status)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2 text-xs font-bold">
                        {dec.status === 'Draft' && (
                          <>
                            <button
                              onClick={() => handleEdit(dec)}
                              className="px-3 py-1.5 bg-fog border border-chalk text-carbon rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-1 shadow-2xs"
                            >
                              <span className="material-symbols-outlined text-[15px]">edit</span>
                              Sửa
                            </button>
                            <button
                              onClick={() => handleDeleteDraft(dec.id)}
                              className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-1 shadow-2xs"
                            >
                              <span className="material-symbols-outlined text-[15px]">delete</span>
                              Xóa
                            </button>
                          </>
                        )}

                        {dec.status === 'Rejected' && (
                          <button
                            onClick={() => handleEdit(dec)}
                            className="px-3 py-1.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors shadow-xs flex items-center gap-1.5 font-extrabold"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit_note</span>
                            Chỉnh sửa & Gửi lại
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedDeclaration(dec)}
                          className="px-3 py-1.5 bg-carbon text-white rounded-xl hover:bg-black transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          <span className="material-symbols-outlined text-[15px]">visibility</span>
                          Xem
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 6-16. CREATE / EDIT WIZARD LARGE MODAL ── */}
      {isWizardOpen && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-3xl w-full space-y-6 shadow-2xl my-8 animate-in zoom-in-95 duration-200 font-sans">
            
            {/* Wizard Header */}
            <div className="flex justify-between items-start border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-extrabold text-signal-orange uppercase tracking-wider block">
                  TRANSPORT COMPANY WORKFLOW
                </span>
                <h3 className="font-heading text-2xl font-extrabold text-carbon">
                  {editingId ? `CHỈNH SỬA KHAI BÁO ${editingId}` : 'TẠO KHAI BÁO HÀNG HÓA MỚI'}
                </h3>
                <p className="text-xs text-slate mt-0.5">Nhập đầy đủ thông tin container và hàng hóa trước khi đăng ký chuyến xe đến cảng.</p>
              </div>
              <button
                onClick={() => setIsWizardOpen(false)}
                className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Progress Step Indicator (5 Steps) */}
            <div className="grid grid-cols-5 gap-2 text-center text-xs font-bold font-mono border-b border-chalk pb-4">
              {[
                { step: 1, label: '① Container' },
                { step: 2, label: '② Hàng hóa' },
                { step: 3, label: '③ Vận chuyển' },
                { step: 4, label: '④ Chứng từ' },
                { step: 5, label: '⑤ Xác nhận' }
              ].map(s => (
                <button
                  key={s.step}
                  onClick={() => setWizardStep(s.step)}
                  className={`py-2 px-1 rounded-xl transition-all ${
                    wizardStep === s.step
                      ? 'bg-carbon text-white shadow-sm font-extrabold'
                      : wizardStep > s.step
                      ? 'bg-green-100 text-green-900 border border-green-300'
                      : 'bg-fog text-slate border border-chalk'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* ── STEP 1: SECTION 1 – THÔNG TIN CONTAINER ── */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="text-sm font-extrabold text-carbon uppercase border-l-4 border-signal-orange pl-3 py-0.5">
                  1. THÔNG TIN CONTAINER
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
                  {/* Container ID with Real-time Validation */}
                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      Container ID *
                    </label>
                    <input
                      type="text"
                      value={formData.containerId}
                      onChange={e => setFormData({ ...formData, containerId: e.target.value.toUpperCase() })}
                      placeholder="Ví dụ: MSCU1234567"
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon font-mono font-extrabold focus:outline-none focus:border-signal-orange uppercase"
                    />
                    {formData.containerId && (
                      <div className="mt-1 text-[11px] font-mono">
                        {isValidContainerId ? (
                          <span className="text-green-600 font-extrabold flex items-center gap-1">
                            ✓ Container ID hợp lệ
                          </span>
                        ) : (
                          <span className="text-red-600 font-extrabold flex items-center gap-1">
                            ⚠ Container ID không hợp lệ. Ví dụ: MSCU1234567 (4 chữ cái + 7 chữ số)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Container Type */}
                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      Container Type *
                    </label>
                    <select
                      value={formData.containerType}
                      onChange={e => {
                        const newType = e.target.value
                        setFormData({
                          ...formData,
                          containerType: newType,
                          isReefer: checkReefer(newType, formData.cargoType)
                        })
                      }}
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
                    >
                      <option value="20FT">20FT (20 foot standard)</option>
                      <option value="40FT">40FT (40 foot standard)</option>
                      <option value="40HC">40HC (40 foot High Cube)</option>
                      <option value="45FT">45FT (45 foot High Cube)</option>
                    </select>
                  </div>

                  {/* Container Status */}
                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      Container Status *
                    </label>
                    <select
                      value={formData.containerStatus}
                      onChange={e => setFormData({ ...formData, containerStatus: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
                    >
                      <option value="Normal">Normal (Bình thường)</option>
                      <option value="Loaded">Loaded (Đã đóng hàng)</option>
                      <option value="Empty">Empty (Vỏ rỗng)</option>
                      <option value="Damaged">Damaged (Có hư hỏng/móp méo)</option>
                    </select>
                  </div>

                  {/* Cargo Type */}
                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      Cargo Type *
                    </label>
                    <select
                      value={formData.cargoType}
                      onChange={e => {
                        const newCargoType = e.target.value
                        setFormData({
                          ...formData,
                          cargoType: newCargoType,
                          isReefer: checkReefer(formData.containerType, newCargoType)
                        })
                      }}
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
                    >
                      <option value="Export Dry">Export Dry (Hàng khô xuất)</option>
                      <option value="Import Dry">Import Dry (Hàng khô nhập)</option>
                      <option value="Reefer">Reefer (Hàng container lạnh)</option>
                      <option value="General Cargo">General Cargo (Hàng bách hóa)</option>
                      <option value="Other">Other (Khác)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2: SECTION 2 – THÔNG TIN HÀNG HÓA & REEFER & DANGEROUS GOODS ── */}
            {wizardStep === 2 && (
              <div className="space-y-5">
                <div className="text-sm font-extrabold text-carbon uppercase border-l-4 border-signal-orange pl-3 py-0.5">
                  2. THÔNG TIN HÀNG HÓA
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
                  {/* Tên hàng hóa */}
                  <div className="md:col-span-2">
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      Tên hàng hóa *
                    </label>
                    <input
                      type="text"
                      value={formData.cargoName}
                      onChange={e => setFormData({ ...formData, cargoName: e.target.value })}
                      placeholder="Ví dụ: Electronics / Linh kiện điện tử"
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
                    />
                  </div>

                  {/* Số lượng */}
                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      Số lượng *
                    </label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                      placeholder="Ví dụ: 120"
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon font-mono focus:outline-none focus:border-signal-orange"
                    />
                  </div>

                  {/* Đơn vị */}
                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      Đơn vị tính *
                    </label>
                    <select
                      value={formData.unit}
                      onChange={e => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
                    >
                      <option value="Carton">Carton (Thùng carton)</option>
                      <option value="Pallet">Pallet (Khay pallet)</option>
                      <option value="Piece">Piece (Cái/Chiếc)</option>
                      <option value="Package">Package (Kiện hàng)</option>
                      <option value="Other">Other (Khác)</option>
                    </select>
                  </div>

                  {/* Trọng lượng hàng */}
                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      Trọng lượng hàng hóa (kg) *
                    </label>
                    <input
                      type="number"
                      value={formData.cargoWeight}
                      onChange={e => setFormData({ ...formData, cargoWeight: e.target.value })}
                      placeholder="Ví dụ: 18500"
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon font-mono focus:outline-none focus:border-signal-orange"
                    />
                  </div>

                  {/* Tổng trọng lượng cont */}
                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      Tổng trọng lượng cả vỏ (Gross Weight kg) *
                    </label>
                    <input
                      type="number"
                      value={formData.grossWeight}
                      onChange={e => setFormData({ ...formData, grossWeight: e.target.value })}
                      placeholder="Ví dụ: 22500"
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon font-mono focus:outline-none focus:border-signal-orange"
                    />
                  </div>

                  {/* Mã HS Code */}
                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      Mã HS Code
                    </label>
                    <input
                      type="text"
                      value={formData.hsCode}
                      onChange={e => setFormData({ ...formData, hsCode: e.target.value })}
                      placeholder="Ví dụ: 8517.13"
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon font-mono focus:outline-none focus:border-signal-orange"
                    />
                  </div>

                  {/* Mô tả hàng hóa */}
                  <div className="md:col-span-2">
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      Mô tả hàng hóa
                    </label>
                    <textarea
                      rows="2"
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Nhập mô tả đặc tính hàng hóa..."
                      className="w-full p-3 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
                    ></textarea>
                  </div>
                </div>

                {/* ── DANGEROUS GOODS SECTION ── */}
                <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <strong className="text-amber-900 font-extrabold text-xs uppercase flex items-center gap-1.5">
                        ⚠️ HÀNG NGUY HIỂM (DANGEROUS GOODS - DG)
                      </strong>
                      <p className="text-[11px] text-amber-800 font-sans mt-0.5">Hàng hóa có thuộc danh mục hàng hóa nguy hiểm IMO không?</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, dangerousGoods: !formData.dangerousGoods })}
                      className={`px-4 py-1.5 rounded-full font-extrabold text-xs transition-colors ${
                        formData.dangerousGoods ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {formData.dangerousGoods ? 'Có (Yes)' : 'Không (No)'}
                    </button>
                  </div>

                  {formData.dangerousGoods && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold pt-2 border-t border-amber-200">
                      <div>
                        <label className="block text-amber-900 uppercase text-[10px] mb-1">IMO Class *</label>
                        <select
                          value={formData.imoClass}
                          onChange={e => setFormData({ ...formData, imoClass: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-carbon focus:outline-none"
                        >
                          <option value="Class 3">Class 3 (Chất lỏng dễ cháy)</option>
                          <option value="Class 4.1">Class 4.1 (Chất rắn dễ cháy)</option>
                          <option value="Class 6.1">Class 6.1 (Chất độc hại)</option>
                          <option value="Class 8">Class 8 (Chất ăn mòn)</option>
                          <option value="Class 9">Class 9 (Hàng nguy hiểm khác)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-amber-900 uppercase text-[10px] mb-1">UN Number *</label>
                        <input
                          type="text"
                          value={formData.unNumber}
                          onChange={e => setFormData({ ...formData, unNumber: e.target.value })}
                          placeholder="Ví dụ: UN1203"
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg font-mono focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-amber-900 uppercase text-[10px] mb-1">Proper Shipping Name *</label>
                        <input
                          type="text"
                          value={formData.shippingName}
                          onChange={e => setFormData({ ...formData, shippingName: e.target.value })}
                          placeholder="Ví dụ: MOTOR SPIRIT / GASOLINE"
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg font-mono focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-amber-900 uppercase text-[10px] mb-1">Packing Group</label>
                        <select
                          value={formData.packingGroup}
                          onChange={e => setFormData({ ...formData, packingGroup: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-carbon focus:outline-none"
                        >
                          <option value="I">Group I (Rất nguy hiểm)</option>
                          <option value="II">Group II (Nguy hiểm trung bình)</option>
                          <option value="III">Group III (Nguy hiểm ít)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── REEFER SPECIFICATION SECTION ── */}
                {formData.isReefer && (
                  <div className="p-4 bg-cyan-50/70 border border-cyan-300 rounded-2xl space-y-3">
                    <strong className="text-cyan-900 font-extrabold text-xs uppercase flex items-center gap-1.5">
                      ❄️ THÔNG SỐ CONTAINER LẠNH (REEFER SPECIFICATION)
                    </strong>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-bold">
                      <div>
                        <label className="block text-cyan-900 uppercase text-[10px] mb-1">Nhiệt độ yêu cầu (°C) *</label>
                        <input
                          type="text"
                          value={formData.reeferTemp}
                          onChange={e => setFormData({ ...formData, reeferTemp: e.target.value })}
                          placeholder="Ví dụ: -18"
                          className="w-full px-3 py-2 bg-white border border-cyan-300 rounded-lg font-mono focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-cyan-900 uppercase text-[10px] mb-1">Dải nhiệt độ min - max (°C)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={formData.tempMin}
                            onChange={e => setFormData({ ...formData, tempMin: e.target.value })}
                            placeholder="Min -20"
                            className="w-1/2 px-2 py-2 bg-white border border-cyan-300 rounded-lg font-mono focus:outline-none text-center"
                          />
                          <input
                            type="text"
                            value={formData.tempMax}
                            onChange={e => setFormData({ ...formData, tempMax: e.target.value })}
                            placeholder="Max -16"
                            className="w-1/2 px-2 py-2 bg-white border border-cyan-300 rounded-lg font-mono focus:outline-none text-center"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-cyan-900 uppercase text-[10px] mb-1">Thông gió (Ventilation)</label>
                        <input
                          type="text"
                          value={formData.ventilation}
                          onChange={e => setFormData({ ...formData, ventilation: e.target.value })}
                          placeholder="Ví dụ: 15 m3/h"
                          className="w-full px-3 py-2 bg-white border border-cyan-300 rounded-lg font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 3: SECTION 3 – THÔNG TIN VẬN CHUYỂN ── */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="text-sm font-extrabold text-carbon uppercase border-l-4 border-signal-orange pl-3 py-0.5">
                  3. THÔNG TIN VẬN CHUYỂN & BOOKING
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
                  {/* Loại giao nhận */}
                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      Loại giao nhận *
                    </label>
                    <select
                      value={formData.operationType}
                      onChange={e => setFormData({ ...formData, operationType: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
                    >
                      <option value="Pickup">Pickup (Đăng ký lấy container khỏi cảng)</option>
                      <option value="Delivery">Delivery (Đăng ký hạ container vào bãi cảng)</option>
                    </select>
                  </div>

                  {/* Cảng */}
                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      Cảng đích / Cảng thực hiện *
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formData.port}
                      className="w-full px-3.5 py-2.5 bg-slate-100 border border-chalk rounded-xl text-carbon font-extrabold"
                    />
                  </div>

                  {/* Booking Number */}
                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      Booking Number *
                    </label>
                    <input
                      type="text"
                      value={formData.bookingNumber}
                      onChange={e => setFormData({ ...formData, bookingNumber: e.target.value.toUpperCase() })}
                      placeholder="Ví dụ: BK-20260811-001"
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon font-mono font-extrabold focus:outline-none focus:border-signal-orange"
                    />
                  </div>

                  {/* Expected Date */}
                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      {formData.operationType === 'Pickup' ? 'Thời gian dự kiến nhận cont *' : 'Thời gian dự kiến hạ cont *'}
                    </label>
                    <input
                      type="date"
                      value={formData.expectedDate}
                      onChange={e => setFormData({ ...formData, expectedDate: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon font-mono focus:outline-none focus:border-signal-orange"
                    />
                  </div>

                  {/* Vessel */}
                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      Tên tàu (Vessel)
                    </label>
                    <select
                      value={formData.vessel}
                      onChange={e => setFormData({ ...formData, vessel: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon focus:outline-none focus:border-signal-orange"
                    >
                      <option value="MOL TRIUMPH">MOL TRIUMPH</option>
                      <option value="EVER GIVEN">EVER GIVEN</option>
                      <option value="COSCO SHIPPING">COSCO SHIPPING</option>
                      <option value="CMA CGM ANTOINE">CMA CGM ANTOINE</option>
                      <option value="HAPAG LLOYD EXPRESS">HAPAG LLOYD EXPRESS</option>
                    </select>
                  </div>

                  {/* Voyage */}
                  <div>
                    <label className="block text-slate uppercase text-[10px] mb-1">
                      Chuyến tàu (Voyage)
                    </label>
                    <input
                      type="text"
                      value={formData.voyage}
                      onChange={e => setFormData({ ...formData, voyage: e.target.value })}
                      placeholder="Ví dụ: VN001"
                      className="w-full px-3.5 py-2.5 bg-fog border border-chalk rounded-xl text-carbon font-mono focus:outline-none focus:border-signal-orange"
                    />
                  </div>

                  {/* Dynamic Operation Location Info Banner */}
                  <div className="md:col-span-2 bg-blue-50/70 p-3.5 rounded-xl border border-blue-200 text-xs space-y-1">
                    <strong className="text-blue-900 font-extrabold flex items-center gap-1.5">
                      ℹ️ Thông tin quy trình {formData.operationType === 'Pickup' ? 'Nhận Container (Pickup)' : 'Hạ Container (Delivery)'}
                    </strong>
                    <p className="text-[11px] text-blue-800 font-medium">
                      {formData.operationType === 'Pickup'
                        ? 'Vị trí nhận cont: Khu vực Khối bãi chỉ định tại Cảng Tiên Sa. Xe tải sẽ đến đúng khung giờ sau khi Gate Booking được duyệt.'
                        : 'Vị trí hạ cont: Khu vực bãi chứa container xuất khẩu Cảng Tiên Sa. Hạ bãi và xuất biên bản hạ hàng EIR.'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono italic">
                      * Lưu ý: Xe tải (Vehicle) và Tài xế (Driver) không nhập tại bước này. Thông tin chuyến xe sẽ được nhập ở quy trình Đăng ký chuyến xe (Gate Booking).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 4: SECTION 4 – CHỨNG TỪ ĐÍNH KÈM ── */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <div className="text-sm font-extrabold text-carbon uppercase border-l-4 border-signal-orange pl-3 py-0.5">
                  4. CHỨNG TỪ ĐÍNH KÈM
                </div>

                {/* Upload Box */}
                <div className="border-2 border-dashed border-chalk rounded-2xl p-6 text-center space-y-3 bg-fog hover:border-signal-orange transition-colors">
                  <span className="material-symbols-outlined text-4xl text-slate">cloud_upload</span>
                  <div>
                    <span className="font-extrabold text-carbon text-xs block">Kéo & Thả tệp chứng từ vào đây</span>
                    <span className="text-[11px] text-slate font-medium">Hỗ trợ định dạng PDF, JPG, PNG (Tối đa 10MB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newDoc = { name: `Customs_Doc_${Date.now()}.pdf`, size: '1.4 MB', status: 'Uploaded' }
                      setFormData({ ...formData, documents: [...formData.documents, newDoc] })
                      showToast('📄 Đã đính kèm tệp chứng từ mới thành công!')
                    }}
                    className="px-4 py-2 bg-carbon text-white rounded-xl font-extrabold text-xs hover:bg-black transition-colors shadow-xs"
                  >
                    + Upload Document
                  </button>
                </div>

                {/* Attached File List */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate uppercase font-mono">DANH SÁCH TỆP ĐÃ TẢI LÊN ({formData.documents.length})</span>
                  <div className="space-y-2">
                    {formData.documents.map((doc, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-white border border-chalk rounded-xl text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-red-500">picture_as_pdf</span>
                          <div>
                            <strong className="text-carbon font-bold block">{doc.name}</strong>
                            <span className="text-[10px] text-slate">{doc.size} • ✓ {doc.status}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              documents: formData.documents.filter((_, i) => i !== idx)
                            })
                          }}
                          className="px-2.5 py-1 text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold transition-colors"
                        >
                          [ Delete ]
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 5: SECTION 5 – REVIEW / XÁC NHẬN KHAI BÁO ── */}
            {wizardStep === 5 && (
              <div className="space-y-4">
                <div className="text-sm font-extrabold text-carbon uppercase border-l-4 border-signal-orange pl-3 py-0.5">
                  5. XÁC NHẬN TỔNG QUAN KHAI BÁO
                </div>

                <div className="bg-fog p-5 rounded-2xl border border-chalk space-y-4 text-xs font-sans">
                  {/* Summary Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Container Info */}
                    <div className="bg-white p-4 rounded-xl border border-chalk space-y-1.5">
                      <strong className="text-signal-orange uppercase text-[10px] block font-mono">CONTAINER</strong>
                      <div className="text-base font-extrabold text-carbon font-mono">{formData.containerId}</div>
                      <div className="text-slate font-bold">{formData.containerType} • {formData.cargoType}</div>
                      <div className="text-slate text-[11px]">Trạng thái: {formData.containerStatus}</div>
                    </div>

                    {/* Cargo Info */}
                    <div className="bg-white p-4 rounded-xl border border-chalk space-y-1.5">
                      <strong className="text-signal-orange uppercase text-[10px] block font-mono">HÀNG HÓA</strong>
                      <div className="text-base font-extrabold text-carbon">{formData.cargoName}</div>
                      <div className="text-slate font-bold">{formData.quantity} {formData.unit} • {Number(formData.cargoWeight).toLocaleString()} kg</div>
                      <div className="text-slate text-[11px]">Mã HS: {formData.hsCode || 'Chưa nhập'}</div>
                    </div>

                    {/* Transport Info */}
                    <div className="bg-white p-4 rounded-xl border border-chalk space-y-1.5">
                      <strong className="text-signal-orange uppercase text-[10px] block font-mono">VẬN CHUYỂN & BOOKING</strong>
                      <div className="font-bold text-carbon font-mono">Booking: {formData.bookingNumber}</div>
                      <div className="text-slate">Loại: {formData.operationType} • {formData.port}</div>
                      <div className="text-slate text-[11px]">Tàu: {formData.vessel} ({formData.voyage})</div>
                    </div>

                    {/* Dangerous Goods & Reefer */}
                    <div className="bg-white p-4 rounded-xl border border-chalk space-y-1.5">
                      <strong className="text-signal-orange uppercase text-[10px] block font-mono">ĐẶC TÍNH ĐẶC BIỆT</strong>
                      <div className="text-slate font-bold">
                        Dangerous Goods: {formData.dangerousGoods ? `⚠️ Có (${formData.imoClass} - ${formData.unNumber})` : 'Không'}
                      </div>
                      <div className="text-slate text-[11px]">
                        Reefer Spec: {formData.isReefer ? `❄️ ${formData.reeferTemp}°C` : 'Không có'}
                      </div>
                      <div className="text-slate text-[11px]">Số chứng từ đính kèm: {formData.documents.length} tệp</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Bottom Actions Bar */}
            <div className="flex justify-between items-center pt-4 border-t border-chalk">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(prev => prev - 1)}
                  className="px-4 py-2.5 bg-fog border border-chalk text-carbon rounded-xl font-bold text-xs hover:bg-slate-200 transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Quay lại
                </button>
              ) : <div></div>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-5 py-2.5 border border-carbon text-carbon rounded-xl font-extrabold text-xs hover:bg-fog transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  Lưu nháp
                </button>

                {wizardStep < 5 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(prev => prev + 1)}
                    className="px-6 py-2.5 bg-carbon text-white rounded-xl font-extrabold text-xs hover:bg-black transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    Tiếp theo
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePromptSubmit}
                    className="px-6 py-2.5 bg-signal-orange text-white rounded-xl font-extrabold text-xs hover:opacity-95 transition-opacity shadow-lg flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">send</span>
                    Gửi khai báo
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── 16. SUBMIT CONFIRMATION DIALOG ── */}
      {isSubmitConfirmOpen && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 border-b border-chalk pb-3">
              <span className="material-symbols-outlined text-signal-orange text-2xl">send</span>
              <div>
                <h3 className="font-heading text-lg font-extrabold text-carbon">Gửi khai báo hàng hóa?</h3>
                <p className="text-xs text-slate">Thông tin sẽ được gửi đến Terminal để kiểm tra và phê duyệt.</p>
              </div>
            </div>

            <div className="bg-fog p-3.5 rounded-xl border border-chalk text-xs space-y-1 font-mono">
              <div>Container ID: <strong className="text-carbon font-bold">{formData.containerId}</strong></div>
              <div>Booking Number: <strong className="text-carbon font-bold">{formData.bookingNumber}</strong></div>
              <div>Loại hàng: <strong className="text-carbon font-bold">{formData.cargoName}</strong></div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsSubmitConfirmOpen(false)}
                className="px-4 py-2 bg-fog border border-chalk text-slate font-bold rounded-xl text-xs hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmFinalSubmit}
                className="px-5 py-2 bg-signal-orange text-white font-extrabold rounded-xl text-xs hover:opacity-90 shadow-md"
              >
                Xác nhận gửi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 18. CARGO DECLARATION DETAIL MODAL ── */}
      {selectedDeclaration && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full space-y-6 shadow-2xl my-8 animate-in zoom-in-95 duration-200 font-sans">
            
            {/* Detail Header */}
            <div className="flex justify-between items-start border-b border-chalk pb-4">
              <div>
                <span className="text-[10px] font-extrabold text-slate uppercase block font-mono">CARGO DECLARATION DETAIL</span>
                <h3 className="font-heading text-2xl font-extrabold text-carbon font-mono">
                  {selectedDeclaration.id}
                </h3>
                <div className="mt-1">
                  {renderStatusBadge(selectedDeclaration.status)}
                </div>
              </div>
              <button
                onClick={() => setSelectedDeclaration(null)}
                className="w-8 h-8 rounded-full bg-fog border border-chalk flex items-center justify-center text-slate hover:text-carbon"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Status Rejection Notice if applicable */}
            {selectedDeclaration.status === 'Rejected' && (
              <div className="bg-red-50 border-2 border-red-300 p-4 rounded-2xl space-y-2 text-xs">
                <strong className="text-red-900 font-extrabold flex items-center gap-1.5">
                  🔴 KHAI BÁO BỊ TỪ CHỐI BỞI TERMINAL
                </strong>
                <p className="text-red-800 font-bold">Lý do từ chối: "{selectedDeclaration.rejectionReason}"</p>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      const decToEdit = selectedDeclaration
                      setSelectedDeclaration(null)
                      handleEdit(decToEdit)
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-xl font-extrabold text-xs hover:bg-red-700 shadow-sm flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">edit_note</span>
                    Chỉnh sửa & Gửi lại
                  </button>
                </div>
              </div>
            )}

            {/* Approval Info if approved */}
            {selectedDeclaration.status === 'Approved' && (
              <div className="bg-green-50 border border-green-300 p-4 rounded-2xl space-y-1 text-xs font-mono">
                <strong className="text-green-900 font-extrabold flex items-center gap-1.5">
                  🟢 KHAI BÁO ĐÃ ĐƯỢC TERMINAL PHÊ DUYỆT
                </strong>
                <div className="text-green-800">Approved By: <strong>{selectedDeclaration.approvedBy}</strong></div>
                <div className="text-green-800">Approved At: <strong>{selectedDeclaration.approvedAt}</strong></div>
                <p className="text-[11px] text-slate-600 font-sans mt-1">
                  * Container đã sẵn sàng cho quy trình Đăng ký chuyến xe (Gate Booking).
                </p>
              </div>
            )}

            {/* Details Cards Grid */}
            <div className="space-y-4 text-xs">
              {/* CONTAINER */}
              <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2">
                <span className="text-[10px] font-extrabold text-signal-orange uppercase font-mono block">1. CONTAINER</span>
                <div className="flex justify-between font-mono font-bold text-carbon text-sm">
                  <span>Mã Cont: {selectedDeclaration.containerId}</span>
                  <span>Loại: {selectedDeclaration.containerType}</span>
                </div>
                <div className="text-slate">Loại hàng: {selectedDeclaration.cargoType} • Trạng thái: {selectedDeclaration.containerStatus}</div>
              </div>

              {/* CARGO */}
              <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2">
                <span className="text-[10px] font-extrabold text-signal-orange uppercase font-mono block">2. HÀNG HÓA</span>
                <div className="font-extrabold text-carbon text-sm">{selectedDeclaration.cargoName}</div>
                <div className="grid grid-cols-2 gap-2 text-slate font-mono">
                  <div>Số lượng: {selectedDeclaration.quantity} {selectedDeclaration.unit}</div>
                  <div>Trọng lượng hàng: {Number(selectedDeclaration.cargoWeight).toLocaleString()} kg</div>
                  <div>Mã HS: {selectedDeclaration.hsCode || '—'}</div>
                  <div>Tổng trọng lượng vỏ: {Number(selectedDeclaration.grossWeight).toLocaleString()} kg</div>
                </div>
                {selectedDeclaration.dangerousGoods && (
                  <div className="p-2.5 bg-red-100/70 border border-red-300 rounded-xl text-red-900 font-mono font-bold">
                    ⚠️ Hàng nguy hiểm: IMO {selectedDeclaration.imoClass} • {selectedDeclaration.unNumber} • {selectedDeclaration.shippingName}
                  </div>
                )}
                {selectedDeclaration.isReefer && (
                  <div className="p-2.5 bg-cyan-100/70 border border-cyan-300 rounded-xl text-cyan-900 font-mono font-bold">
                    ❄️ Container Lạnh: {selectedDeclaration.reeferTemp}°C (Ventilation: {selectedDeclaration.ventilation})
                  </div>
                )}
              </div>

              {/* TRANSPORT */}
              <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2">
                <span className="text-[10px] font-extrabold text-signal-orange uppercase font-mono block">3. VẬN CHUYỂN & BOOKING</span>
                <div className="grid grid-cols-2 gap-2 font-mono text-carbon">
                  <div>Loại: <strong>{selectedDeclaration.operationType}</strong></div>
                  <div>Booking: <strong>{selectedDeclaration.bookingNumber}</strong></div>
                  <div>Cảng: <strong>{selectedDeclaration.port}</strong></div>
                  <div>Tàu/Chuyến: <strong>{selectedDeclaration.vessel} ({selectedDeclaration.voyage})</strong></div>
                </div>
              </div>

              {/* DOCUMENTS */}
              <div className="bg-fog p-4 rounded-2xl border border-chalk space-y-2">
                <span className="text-[10px] font-extrabold text-signal-orange uppercase font-mono block">4. CHỨNG TỪ ĐÍNH KÈM</span>
                <div className="space-y-1.5">
                  {selectedDeclaration.documents.map((doc, idx) => (
                    <div key={idx} className="flex justify-between bg-white p-2.5 rounded-xl border border-chalk font-mono">
                      <span>📄 {doc.name}</span>
                      <span className="text-slate">{doc.size} • ✓ {doc.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Detail Close */}
            <div className="pt-2 border-t border-chalk flex justify-end">
              <button
                onClick={() => setSelectedDeclaration(null)}
                className="px-6 py-2.5 bg-carbon text-white rounded-xl text-xs font-extrabold hover:bg-black transition-colors"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
