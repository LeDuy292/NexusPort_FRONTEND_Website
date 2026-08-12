import React, { useState, useMemo } from 'react'

// Initial Inventory Dataset with Rich Cargo Details & Manifest Info
const INITIAL_INVENTORY_ITEMS = [
  {
    id: 'MSCU1234567',
    position: 'A-03-12-2',
    expectedPosition: 'A-03-12-2',
    actualPosition: 'A-03-12-2',
    type: '40FT HC',
    status: 'TRONG BÃI',
    lastVerified: 'Hôm nay 14:30',
    verificationStatus: 'VERIFIED',
    condition: 'Tốt (Không Hư Hỏng)',
    carrier: 'Maersk Line',
    seal: 'SEAL-88921',
    // Cargo Manifest & Inspection Data
    declaredCargo: 'Linh Kiện Điện Tử & Bo Mạch (Panasonic Logistics)',
    declaredQty: '1,200 Thùng / 24 Pallet',
    actualQty: '1,200 Thùng / 24 Pallet (Khớp 100%)',
    qtyMatchStatus: 'MATCHED', // MATCHED, MISMATCHED
    lashingCondition: 'Đóng gói chèn lót đai nẹp an toàn chuẩn quốc tế',
    cargoImage: '/container_cargo_interior.png',
    cargoChecklist: {
      itemMatched: true,
      qtyMatched: true,
      lashingSafe: true,
      sealIntact: true,
    }
  },
  {
    id: 'TEMU882219',
    position: 'B-01-08-1',
    expectedPosition: 'B-01-08-1',
    actualPosition: 'B-01-08-1',
    type: '20FT ST',
    status: 'TRONG BÃI',
    lastVerified: 'Hôm qua 09:15',
    verificationStatus: 'PENDING',
    condition: 'Chưa Kiểm Thử',
    carrier: 'XYZ Transport',
    seal: 'SEAL-99102',
    // Cargo Manifest & Inspection Data
    declaredCargo: 'Bao Bì Hạt Nhựa PET Công Nghiệp (Siam Polymer)',
    declaredQty: '800 Bao Cột / 16 Pallet',
    actualQty: '800 Bao Cột (Chờ Đếm Kiểm Kê)',
    qtyMatchStatus: 'PENDING',
    lashingCondition: 'Xếp hàng phẳng, chèn màng co nilon nguyên đai',
    cargoImage: '/container_cargo_interior.png',
    cargoChecklist: {
      itemMatched: true,
      qtyMatched: true,
      lashingSafe: true,
      sealIntact: true,
    }
  },
  {
    id: 'CMAU9918234',
    position: 'A-01-02-1',
    expectedPosition: 'A-01-02-1',
    actualPosition: 'A-01-05-3 (Lệch Ô Bãi)',
    type: '40FT HC',
    status: 'TRONG BÃI',
    lastVerified: 'Hôm nay 10:00',
    verificationStatus: 'DISCREPANCY',
    condition: 'Móp Méo Vỏ Sườn',
    carrier: 'CMA CGM Logistics',
    seal: 'SEAL-44819',
    // Cargo Manifest & Inspection Data
    declaredCargo: 'Mô-tơ & Động Cơ Máy Công Nghiệp Nặng (Bosch)',
    declaredQty: '16 Kiện Gỗ Nặng / Pallet',
    actualQty: '14 Kiện Gỗ (Thiếu 2 Kiện so với Khai Báo Vận Chuyển)',
    qtyMatchStatus: 'MISMATCHED',
    lashingCondition: 'Bị xô lệch 2 kiện gỗ do va chạm thùng container',
    cargoImage: '/container_cargo_interior.png',
    cargoChecklist: {
      itemMatched: true,
      qtyMatched: false,
      lashingSafe: false,
      sealIntact: true,
    }
  },
  {
    id: 'HLBU7781920',
    position: 'A-03-01-1',
    expectedPosition: 'A-03-01-1',
    actualPosition: 'A-03-01-1',
    type: '40FT HC',
    status: 'TRONG BÃI',
    lastVerified: 'Hôm nay 08:15',
    verificationStatus: 'VERIFIED',
    condition: 'Tốt (Không Hư Hỏng)',
    carrier: 'Hapag-Lloyd',
    seal: 'SEAL-11092',
    // Cargo Manifest & Inspection Data
    declaredCargo: 'Nông Sản Đóng Thùng Xuất Khẩu (Vinamilk / TH True)',
    declaredQty: '2,100 Thùng Carton',
    actualQty: '2,100 Thùng Carton (Khớp 100%)',
    qtyMatchStatus: 'MATCHED',
    lashingCondition: 'Đóng thùng carton 5 lớp chèn lót xốp nilon an toàn',
    cargoImage: '/container_cargo_interior.png',
    cargoChecklist: {
      itemMatched: true,
      qtyMatched: true,
      lashingSafe: true,
      sealIntact: true,
    }
  },
]

export default function ContainerInventoryInspection() {
  const [inventory, setInventory] = useState(INITIAL_INVENTORY_ITEMS)
  const [searchQuery, setSearchQuery] = useState('')
  const [toastMessage, setToastMessage] = useState('')

  // Filters State
  const [blockFilter, setBlockFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [verificationFilter, setVerificationFilter] = useState('All')
  const [damageFilter, setDamageFilter] = useState('All')

  // Inspection Modal State (Detailed Cargo & Image Preview)
  const [inspectingItem, setInspectingItem] = useState(null)
  const [actualPosInput, setActualPosInput] = useState('')
  const [inspectCondition, setInspectCondition] = useState('Tốt (Không Hư Hỏng)')
  const [actualCountInput, setActualCountInput] = useState('')
  const [cargoNotesInput, setCargoNotesInput] = useState('')
  const [selectedPhotoTab, setSelectedPhotoTab] = useState('interior') // interior, seal, barcode

  // Container Damage Section State
  const [showDamageForm, setShowDamageForm] = useState(false)
  const [damageForm, setDamageForm] = useState({
    containerId: 'CMAU9918234',
    damageType: 'Móp Méo Vỏ Sườn',
    severity: 'Medium',
    desc: 'Móp méo vỏ sườn bên phải kích thước 30cm do va chạm rơ-moóc.',
    photoFiles: ['Anh_Chup_Hien_Truong_Mop_Vo.jpg'],
  })

  // Damage Reports History
  const [damageReports, setDamageReports] = useState([
    { id: 'DMG-20260812-001', time: '10:05', containerId: 'CMAU9918234', type: 'Móp Méo Vỏ Sườn', severity: 'TRUNG BÌNH', reportedBy: 'Nguyễn Văn Nam (Nhân Viên Bãi)', carrierNotified: 'CMA CGM Logistics' }
  ])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // Filtered Inventory Data
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const q = searchQuery.toLowerCase()
      const matchSearch = item.id.toLowerCase().includes(q) || item.position.toLowerCase().includes(q) || (item.declaredCargo && item.declaredCargo.toLowerCase().includes(q))
      const matchBlock = blockFilter === 'All' || item.position.startsWith(blockFilter.replace('Block ', ''))
      const matchStatus = statusFilter === 'All' || item.status === statusFilter
      const matchVer = verificationFilter === 'All' || item.verificationStatus === verificationFilter
      const matchDmg = damageFilter === 'All' || (damageFilter === 'Damaged' ? item.condition.includes('Móp') || item.condition.includes('Hư') : item.condition.includes('Tốt'))

      return matchSearch && matchBlock && matchStatus && matchVer && matchDmg
    })
  }, [inventory, searchQuery, blockFilter, statusFilter, verificationFilter, damageFilter])

  // Open Inspect Modal with Full Cargo Details
  const handleOpenInspectModal = (item) => {
    setInspectingItem(item)
    setActualPosInput(item.expectedPosition)
    setInspectCondition(item.condition)
    setActualCountInput(item.declaredQty)
    setCargoNotesInput('')
    setSelectedPhotoTab('interior')
  }

  // Submit Verified Action (Cargo & Position Matched)
  const handleConfirmVerified = () => {
    if (!inspectingItem) return
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

    setInventory(prev => prev.map(item => {
      if (item.id === inspectingItem.id) {
        return {
          ...item,
          lastVerified: `Hôm nay ${nowTime}`,
          verificationStatus: 'VERIFIED',
          actualPosition: actualPosInput,
          actualQty: actualCountInput,
          condition: inspectCondition,
          qtyMatchStatus: 'MATCHED',
        }
      }
      return item
    }))

    showToast(`🟢 ĐÃ XÁC NHẬN KIỂM KÊ HÀNG HÓA: Container ${inspectingItem.id} khớp 100% với vận chuyển khai báo [${inspectingItem.declaredQty}]!`)
    setInspectingItem(null)
  }

  // Submit Report Discrepancy Action (Cargo or Position Mismatched)
  const handleReportDiscrepancy = () => {
    if (!inspectingItem) return
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

    setInventory(prev => prev.map(item => {
      if (item.id === inspectingItem.id) {
        return {
          ...item,
          lastVerified: `Hôm nay ${nowTime}`,
          verificationStatus: 'DISCREPANCY',
          actualPosition: actualPosInput,
          actualQty: actualCountInput,
          qtyMatchStatus: 'MISMATCHED',
        }
      }
      return item
    }))

    showToast(`🔴 ĐÃ LẬP BÁO CÁO SAI LỆCH HÀNG HÓA: Container ${inspectingItem.id} có sai lệch thực tế [${actualCountInput}] so với khai báo!`)
    setInspectingItem(null)
  }

  // Submit Damage Report
  const handleSubmitDamageReport = (e) => {
    e.preventDefault()
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    const newDmgId = `DMG-20260812-00${damageReports.length + 1}`

    const newReport = {
      id: newDmgId,
      time: nowTime,
      containerId: damageForm.containerId,
      type: damageForm.damageType,
      severity: damageForm.severity === 'Low' ? 'THẤP' : damageForm.severity === 'Medium' ? 'TRUNG BÌNH' : damageForm.severity === 'High' ? 'NGHIÊM TRỌNG' : 'RẤT NGH. TRỌNG',
      reportedBy: 'Nguyễn Văn Nam (Nhân Viên Bãi)',
      carrierNotified: 'Tự động phát thông báo tới Hãng tàu / Transport Company',
    }

    setDamageReports(prev => [newReport, ...prev])
    setShowDamageForm(false)
    showToast(`🚨 ĐÃ GỬI BÁO CÁO HƯ HỎNG ${newDmgId}! Carrier đã nhận thông báo tự động.`)
  }

  const renderVerificationBadge = (st) => {
    const map = {
      'VERIFIED': 'bg-emerald-100 text-emerald-950 border-emerald-400',
      'PENDING': 'bg-amber-100 text-amber-950 border-amber-400',
      'DISCREPANCY': 'bg-red-200 text-red-950 border-red-500',
    }
    const icon = {
      'VERIFIED': '🟢 KHỚP KHAI BÁO & VỊ TRÍ',
      'PENDING': '🟡 ĐANG CHỜ KIỂM KÊ',
      'DISCREPANCY': '🔴 SAI LỆCH THỰC TẾ',
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full border font-black text-[10px] font-mono ${map[st] || 'bg-slate-100 text-slate-800 border-slate-300'}`}>
        {icon[st] || st}
      </span>
    )
  }

  return (
    <div className="p-6 md:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen text-slate-900 relative">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-amber-100 text-amber-950 border-2 border-amber-400 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-3 z-[100] animate-bounce">
          <span className="text-amber-600">●</span>{toastMessage}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs font-mono">
            <span className="font-heading font-black text-orange-600 tracking-wider">NEXUSPORT</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 font-bold">Khai Thác Bãi</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-extrabold">Kiểm Kê Hàng Hóa & Vỏ</span>
          </div>

          <div className="flex items-center gap-3">
            <h2 className="font-heading text-3xl font-black text-slate-900">Kiểm Kê Hàng Hóa & Kiểm Thử Vỏ Container</h2>
            <span className="px-3.5 py-1 bg-orange-100 text-orange-950 border-2 border-orange-400 font-mono font-black text-xs rounded-xl">
              ĐỐI SOÁT KHAI BÁO VẬN CHUYỂN
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">Xem hình ảnh thực tế hàng hóa bên trong container, đối soát số lượng & chủng loại với khai báo của bên vận chuyển (Carrier Cargo Manifest).</p>
        </div>

        <button onClick={() => setShowDamageForm(true)}
          className="px-5 py-3 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-400 font-black text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all">
          <span className="material-symbols-outlined text-lg text-red-800">report_problem</span>
          [ + 🚨 BÁO CÁO HƯ HỎNG VỎ ]
        </button>
      </div>

      {/* ── SEARCH & FILTERS BAR ── */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">qr_code_scanner</span>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍 Tìm Mã Container / Tên Hàng Hóa Khai Báo..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:border-slate-900 uppercase" />
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <select value={blockFilter} onChange={e => setBlockFilter(e.target.value)}
            className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-slate-900">
            <option value="All">Khu Bãi: Tất Cả</option>
            <option value="Block A">Khu A</option>
            <option value="Block B">Khu B</option>
          </select>

          <select value={verificationFilter} onChange={e => setVerificationFilter(e.target.value)}
            className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-slate-900">
            <option value="All">Trạng Thái Đối Soát: Tất Cả</option>
            <option value="VERIFIED">KHỚP KHAI BÁO 🟢</option>
            <option value="PENDING">ĐANG CHỜ KIỂM 🟡</option>
            <option value="DISCREPANCY">SAI LỆCH THỰC TẾ 🔴</option>
          </select>

          <select value={damageFilter} onChange={e => setDamageFilter(e.target.value)}
            className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-slate-900">
            <option value="All">Tình Trạng Vỏ: Tất Cả</option>
            <option value="Good">Bình Thường (Tốt)</option>
            <option value="Damaged">Hư Hỏng (Móp/Rách)</option>
          </select>
        </div>
      </div>

      {/* ── INVENTORY TABLE ── */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-600">inventory</span>
            DANH SÁCH CONTAINER & KHAI BÁO HÀNG HÓA TỪ BÊN VẬN CHUYỂN
          </h3>
          <span className="text-xs font-mono font-bold text-slate-500">{filteredInventory.length} Container cần kiểm kê</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                {['Mã Container', 'Vị Trí Ô Bãi', 'Hàng Hóa Khai Báo', 'Số Lượng Khai Báo vs Thực Tế', 'Hãng Tàu / Vận Chuyển', 'Trạng Thái Đối Soát', 'Tình Trạng Vỏ', 'Thao Tác'].map(h => (
                  <th key={h} className={`py-3.5 px-4 ${h === 'Thao Tác' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500 font-bold font-sans">
                    Không tìm thấy container phù hợp với bộ lọc kiểm kê.
                  </td>
                </tr>
              ) : filteredInventory.map(item => (
                <tr key={item.id} className="hover:bg-slate-100/60">
                  <td className="py-3.5 px-4 font-black text-slate-900 text-sm font-heading">{item.id}</td>
                  <td className="py-3.5 px-4 font-black text-orange-700 text-sm">{item.position}</td>
                  <td className="py-3.5 px-4 font-sans font-bold text-slate-900 max-w-[200px] truncate" title={item.declaredCargo}>
                    {item.declaredCargo}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-purple-900">
                    <div>{item.declaredQty}</div>
                    <div className="text-[10px] text-slate-600 font-normal">{item.actualQty}</div>
                  </td>
                  <td className="py-3.5 px-4 font-sans font-bold text-slate-700">{item.carrier}</td>
                  <td className="py-3.5 px-4 font-sans">{renderVerificationBadge(item.verificationStatus)}</td>
                  <td className="py-3.5 px-4 font-sans font-bold text-slate-800">{item.condition}</td>
                  <td className="py-3.5 px-4 text-right font-sans">
                    <button onClick={() => handleOpenInspectModal(item)}
                      className="px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-950 border-2 border-orange-400 font-black text-xs rounded-xl shadow-xs cursor-pointer ml-auto transition-all flex items-center justify-end gap-1.5">
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      [ 📋 KIỂM KÊ & HÌNH ẢNH ]
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION "DANH SÁCH BÁO CÁO HƯ HỎNG VỎ CONTAINER" ── */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
          <h3 className="font-heading text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600">report_problem</span>
            DANH SÁCH BÁO CÁO HƯ HỎNG VỎ CONTAINER
          </h3>
          <span className="text-xs font-mono font-bold text-slate-500">{damageReports.length} Bản ghi hư hỏng</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                {['Mã Báo Cáo', 'Thời Gian', 'Mã Container', 'Loại Hư Hỏng', 'Mức Độ Nghiêm Trọng', 'Người Báo Cáo', 'Trạng Thái Thông Báo Hãng Tàu'].map(h => (
                  <th key={h} className="py-3.5 px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {damageReports.map(dmg => (
                <tr key={dmg.id} className="hover:bg-slate-100/60">
                  <td className="py-3.5 px-4 font-black text-slate-900 text-sm">{dmg.id}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-600">{dmg.time}</td>
                  <td className="py-3.5 px-4 font-black text-blue-900">{dmg.containerId}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 font-sans">{dmg.type}</td>
                  <td className="py-3.5 px-4 font-sans">
                    <span className="px-2.5 py-0.5 rounded-full border font-black text-[10px] bg-orange-100 text-orange-950 border-orange-400">
                      {dmg.severity}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-sans text-slate-800 font-bold">{dmg.reportedBy}</td>
                  <td className="py-3.5 px-4 font-sans text-emerald-800 font-bold text-[11px]">{dmg.carrierNotified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL 1: DETAILED CARGO & CARRIER MANIFEST INSPECTION MODAL (WIDE RESPONSIVE) ── */}
      {inspectingItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-4xl w-full rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 font-sans border-2 border-orange-400 max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs text-orange-600 font-black mb-0.5">
                  <span className="material-symbols-outlined text-base">fact_check</span>
                  KIỂM KÊ THỰC ĐỊA & HÌNH ẢNH HÀNG HÓA
                </div>
                <h3 className="font-heading text-2xl font-black text-slate-900 font-mono">
                  Kiểm Kê Container {inspectingItem.id} ({inspectingItem.type})
                </h3>
                <p className="text-xs text-slate-600 font-sans mt-0.5">
                  So sánh thông tin khai báo của Bên vận chuyển (<span className="font-bold text-blue-900">{inspectingItem.carrier}</span>) với hình ảnh thực tế và số lượng đếm được bên trong container.
                </p>
              </div>
              <button onClick={() => setInspectingItem(null)} className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Main Content Grid: Left Cargo Photo View, Right Manifest & Check Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* LEFT COLUMN: REAL CARGO PHOTO INSIDE CONTAINER */}
              <div className="space-y-4">
                <div className="bg-slate-900 p-4 rounded-2xl border-2 border-slate-800 space-y-3">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-amber-400 font-black font-sans flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-amber-400">photo_camera</span>
                      📷 HÌNH ẢNH THỰC TẾ BÊN TRONG CONTAINER
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">LIVE CAMERA RTG</span>
                  </div>

                  {/* Main Cargo Image Display */}
                  <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-950 group">
                    <img src={inspectingItem.cargoImage || '/container_cargo_interior.png'} alt="Container Cargo Interior"
                      className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-500" />
                    
                    <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-[10px] font-mono text-emerald-400 font-bold">
                      ● Đèn Thần Đèn Bãi A · 14:30 Today
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-lg border border-slate-700 text-[11px] text-slate-200 font-sans font-medium">
                      📦 <strong>Đánh Giá Hình Ảnh AI:</strong> {inspectingItem.lashingCondition}
                    </div>
                  </div>

                  {/* Thumbnail Tabs */}
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                    <button type="button" onClick={() => setSelectedPhotoTab('interior')}
                      className={`p-2 rounded-lg border font-bold text-center cursor-pointer transition-all ${
                        selectedPhotoTab === 'interior' ? 'bg-orange-100 text-orange-950 border-orange-400 font-black' : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                      📸 1. Hàng Trong Cont
                    </button>

                    <button type="button" onClick={() => setSelectedPhotoTab('seal')}
                      className={`p-2 rounded-lg border font-bold text-center cursor-pointer transition-all ${
                        selectedPhotoTab === 'seal' ? 'bg-orange-100 text-orange-950 border-orange-400 font-black' : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                      🏷️ 2. Niêm Phong Chì
                    </button>

                    <button type="button" onClick={() => setSelectedPhotoTab('barcode')}
                      className={`p-2 rounded-lg border font-bold text-center cursor-pointer transition-all ${
                        selectedPhotoTab === 'barcode' ? 'bg-orange-100 text-orange-950 border-orange-400 font-black' : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                      📊 3. Mã Vạch Barcode
                    </button>
                  </div>
                </div>

                {/* Carrier Seal & Weight Info */}
                <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block">Hãng Tàu / Bên Vận Chuyển</span>
                    <strong className="text-slate-900 font-extrabold">{inspectingItem.carrier}</strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block">Số Niêm Phong Chì (Seal)</span>
                    <strong className="text-purple-900 font-black">{inspectingItem.seal} (Nguyên Vẹn)</strong>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: MANIFEST COMPARISON & CHECKLIST CONTROLS */}
              <div className="space-y-4 font-mono text-xs">
                
                {/* Comparison Card */}
                <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-4 space-y-3 font-sans">
                  <div className="text-xs font-black text-blue-950 uppercase font-mono flex items-center justify-between border-b border-blue-200 pb-2">
                    <span>ĐỐI SOÁT KHAI BÁO VẬN CHUYỂN VS THỰC TẾ:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      inspectingItem.qtyMatchStatus === 'MATCHED' ? 'bg-emerald-100 text-emerald-950 border border-emerald-400' : 'bg-red-200 text-red-950 border border-red-500'
                    }`}>
                      {inspectingItem.qtyMatchStatus === 'MATCHED' ? '🟢 KHỚP 100%' : '🔴 SAI LỆCH KHAI BÁO'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-600 font-bold block">1. Tên Mặt Hàng Khai Báo (Declared Cargo):</span>
                      <strong className="text-slate-900 font-mono text-sm block bg-white p-2 rounded border border-blue-200 mt-0.5">
                        {inspectingItem.declaredCargo}
                      </strong>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="bg-white p-2.5 rounded border border-blue-200">
                        <span className="text-[10px] text-slate-500 font-bold block">Số Lượng Khai Báo</span>
                        <strong className="text-blue-900 font-mono font-black text-xs">{inspectingItem.declaredQty}</strong>
                      </div>

                      <div className="bg-white p-2.5 rounded border border-blue-200">
                        <span className="text-[10px] text-slate-500 font-bold block">Số Lượng Đếm Thực Tế</span>
                        <strong className="text-emerald-900 font-mono font-black text-xs">{inspectingItem.actualQty}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Edit Controls: Actual Count & Actual Position */}
                <div className="space-y-3 bg-slate-100 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-slate-700 uppercase text-[10px] mb-1 font-extrabold font-sans">
                      Số Lượng Đếm Được Thực Tế Ngoài Bãi *
                    </label>
                    <input type="text" value={actualCountInput} onChange={e => setActualCountInput(e.target.value)}
                      placeholder="VD: 1,200 Thùng / 24 Pallet"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-mono font-extrabold text-sm text-slate-900 focus:outline-none focus:border-slate-900" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 uppercase text-[10px] mb-1 font-extrabold font-sans">Vị Trí Kế Hoạch</label>
                      <input type="text" value={inspectingItem.expectedPosition} disabled
                        className="w-full px-3 py-2 bg-slate-200 border border-slate-300 rounded-xl font-mono font-black text-xs text-slate-600" />
                    </div>

                    <div>
                      <label className="block text-slate-700 uppercase text-[10px] mb-1 font-extrabold font-sans">Vị Trí Thực Tế Quét *</label>
                      <input type="text" value={actualPosInput} onChange={e => setActualPosInput(e.target.value.toUpperCase())}
                        placeholder="VD: A-03-12-2"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-black text-xs text-slate-900 uppercase" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 uppercase text-[10px] mb-1 font-extrabold font-sans">Tình Trạng Vỏ Container *</label>
                    <select value={inspectCondition} onChange={e => setInspectCondition(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold font-sans text-xs">
                      <option value="Tốt (Không Hư Hỏng)">Tốt (Không Hư Hỏng)</option>
                      <option value="Trầy Xước Vỏ">Trầy Xước Vỏ</option>
                      <option value="Móp Méo Vỏ Sườn">Móp Méo Vỏ Sườn</option>
                      <option value="Hư Hỏng Nặng">Hư Hỏng Nặng</option>
                    </select>
                  </div>
                </div>

                {/* Final Action Buttons */}
                <div className="flex gap-3 pt-2 font-sans">
                  <button type="button" onClick={handleReportDiscrepancy}
                    className="flex-1 h-13 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-400 rounded-xl font-black text-xs shadow-xs cursor-pointer transition-all">
                    [ 🔴 BÁO CÁO SAI LỆCH VẬN CHUYỂN ]
                  </button>

                  <button type="button" onClick={handleConfirmVerified}
                    className="flex-1 h-13 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-2 border-emerald-400 rounded-xl font-black text-xs shadow-xs cursor-pointer transition-all">
                    [ 🟢 XÁC NHẬN KHỚP KHAI BÁO & VỊ TRÍ ]
                  </button>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* ── MODAL 2: DAMAGE REPORT FORM ── */}
      {showDamageForm && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 font-sans border-2 border-red-400">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600 text-xl">report_problem</span>
                <h3 className="font-heading text-lg font-extrabold text-slate-900">Báo Cáo Hư Hỏng Vỏ Container</h3>
              </div>
              <button onClick={() => setShowDamageForm(false)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitDamageReport} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Mã Container *</label>
                <input type="text" value={damageForm.containerId} onChange={e => setDamageForm(p => ({ ...p, containerId: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl font-mono font-extrabold uppercase" required />
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Loại Hư Hỏng *</label>
                <select value={damageForm.damageType} onChange={e => setDamageForm(p => ({ ...p, damageType: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-extrabold text-sm focus:outline-none focus:border-slate-900">
                  {['Trầy Xước Vỏ', 'Móp Méo Vỏ Sườn', 'Thủng Vỏ', 'Gỉ Sét', 'Hư Cánh Cửa', 'Hư Niêm Phong Chì', 'Khác'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Mức Độ Nghiêm Trọng *</label>
                <div className="flex gap-2 font-mono">
                  {['Low', 'Medium', 'High', 'Critical'].map(sev => (
                    <button type="button" key={sev} onClick={() => setDamageForm(p => ({ ...p, severity: sev }))}
                      className={`flex-1 py-2 rounded-xl border-2 text-xs font-black transition-all cursor-pointer ${
                        damageForm.severity === sev ? 'bg-red-200 text-red-950 border-red-500' : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}>
                      {sev === 'Low' ? 'Nhẹ' : sev === 'Medium' ? 'Trung Bình' : sev === 'High' ? 'Nghiêm Trọng' : 'Rất NGH. Trọng'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Mô Tả Diễn Biến Hư Hỏng *</label>
                <textarea rows="3" value={damageForm.desc} onChange={e => setDamageForm(p => ({ ...p, desc: e.target.value }))}
                  placeholder="Mô tả các vết hư hỏng móp méo sườn..."
                  className="w-full p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-normal text-slate-900 focus:outline-none focus:border-slate-900 resize-none" required />
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Ảnh Bằng Chứng Thực Địa</label>
                <div className="p-3 bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl text-center text-xs font-medium text-slate-600">
                  <span className="material-symbols-outlined text-slate-400 text-lg block">photo_camera</span>
                  <span>[ Chụp Ảnh / Tải Lên ]</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowDamageForm(false)} className="flex-1 h-12 border border-slate-300 text-slate-700 rounded-xl font-extrabold text-xs hover:bg-slate-100">
                  Hủy Bỏ
                </button>
                <button type="submit" className="flex-1 h-12 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-400 rounded-xl font-black text-xs shadow-xs">
                  [ 🚨 GỬI BÁO CÁO HƯ HỎNG ]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
