import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import gateService from '../../services/gateService'

// Dữ liệu mẫu các phương tiện đang tiếp cận cổng
const VEHICLE_PRESETS = [
  {
    plate: '29Y3-036.58',
    chassisPlate: '29R-012.89',
    driverName: 'Nguyễn Văn An',
    licenseNumber: 'FC-290184',
    licenseClass: 'FC',
    licenseExpiry: '2028-11-20',
    idCard: '001089012345',
    phone: '0912 345 678',
    carrier: 'Công ty CP Vận tải Quốc tế Nexus',
    bookingNumber: 'BKG-202609-001',
    shippingLine: 'Maersk Line (MSK)',
    containerNumber: 'MSCU1234567',
    containerType: "40' HC",
    sealNumber: 'MSK-992144',
    operationType: 'GateIn',
    operationLabel: 'Hạ cont hàng xuất',
    timeSlot: '08:00 - 10:00',
    timeSlotValid: true,
    billingStatus: 'PAID',
    assignedYardSlot: 'BLOCK C3 · BAY 14 · ROW 02 · TIER 3',
  },
  {
    plate: '51C-982.44',
    chassisPlate: '51R-045.12',
    driverName: 'Trần Đình Trọng',
    licenseNumber: 'FC-518291',
    licenseClass: 'FC',
    licenseExpiry: '2027-08-15',
    idCard: '079092004561',
    phone: '0908 776 543',
    carrier: 'Vận tải Tân Cảng Sài Gòn',
    bookingNumber: 'BKG-202609-002',
    shippingLine: 'ONE Line',
    containerNumber: 'ONEY8892104',
    containerType: "20' GP",
    sealNumber: 'ONE-441029',
    operationType: 'GateIn',
    operationLabel: 'Giao cont rỗng',
    timeSlot: '08:30 - 10:30',
    timeSlotValid: true,
    billingStatus: 'UNPAID',
    assignedYardSlot: 'BLOCK E1 · BAY 08 · ROW 04 · TIER 2',
  },
  {
    plate: '43C-112.90',
    chassisPlate: '43R-003.56',
    driverName: 'Lê Hoàng Phúc',
    licenseNumber: 'C-430112',
    licenseClass: 'C',
    licenseExpiry: '2026-12-30',
    idCard: '048091003412',
    phone: '0935 889 123',
    carrier: 'Logistics Miền Trung',
    bookingNumber: 'BKG-202609-003',
    shippingLine: 'CMA CGM',
    containerNumber: 'CMAU7812903',
    containerType: "40' DC",
    sealNumber: 'CMA-110294',
    operationType: 'GateIn',
    operationLabel: 'Hạ cont hàng xuất',
    timeSlot: '09:00 - 11:00',
    timeSlotValid: true,
    billingStatus: 'PAID',
    assignedYardSlot: 'BLOCK A2 · BAY 06 · ROW 01 · TIER 2',
  },
  {
    plate: '60C-445.19',
    chassisPlate: '60R-099.81',
    driverName: 'Phạm Quốc Bảo',
    licenseNumber: 'FC-609123',
    licenseClass: 'FC',
    licenseExpiry: '2029-05-10',
    idCard: '075088001923',
    phone: '0978 221 445',
    carrier: 'Vận tải Đông Á',
    bookingNumber: 'BKG-202609-004',
    shippingLine: 'Evergreen (EMC)',
    containerNumber: 'EMCU9041285',
    containerType: "40' HC",
    sealNumber: 'EMC-556102',
    operationType: 'GateIn',
    operationLabel: 'Hạ cont hàng xuất',
    timeSlot: '06:00 - 08:00',
    timeSlotValid: false,
    billingStatus: 'PAID',
    assignedYardSlot: 'BLOCK D4 · BAY 20 · ROW 03 · TIER 4',
  },
]

export default function GateVerification() {
  const [searchParams] = useSearchParams()

  // Trạng thái chung
  const [gateLane, setGateLane] = useState('GATE-A1')
  const [currentTime, setCurrentTime] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [toastMessage, setToastMessage] = useState('')

  // Hồ sơ phương tiện & tài xế hiện tại
  const [currentProfile, setCurrentProfile] = useState(VEHICLE_PRESETS[0])

  // Trạng thái an toàn thực tế
  const [safetyChecks, setSafetyChecks] = useState({
    ppe: true,
    vehicleTire: true,
    sealIntact: true,
  })

  // Trạng thái đối soát
  const [verifying, setVerifying] = useState(false)
  const [overrideActive, setOverrideActive] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideNote, setOverrideNote] = useState('')

  // Lịch sử ca trực
  const [historyList, setHistoryList] = useState([])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // Đồng hồ thời gian thực
  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      )
    }
    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  // Tải lịch sử từ API
  useEffect(() => {
    gateService.getVerificationHistory().then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setHistoryList(res.data)
      }
    }).catch(() => {})
  }, [])

  // Tự động tìm kiếm & nhảy ngay thông tin khi quét biển số xe
  const autoLookupPlate = async (plateQuery) => {
    if (!plateQuery || !plateQuery.trim()) return

    const clean = plateQuery.trim().toUpperCase().replace(/[^A-Z0-9-.]/g, '')
    setVerifying(true)
    setOverrideActive(false)

    // 1. Kiểm tra trong danh sách preset có sẵn
    const foundPreset = VEHICLE_PRESETS.find(
      (p) => p.plate.replace(/[^A-Z0-9]/g, '') === clean.replace(/[^A-Z0-9]/g, '') ||
             p.bookingNumber.toUpperCase() === clean
    )

    if (foundPreset) {
      setCurrentProfile(foundPreset)
      showToast(`⚡ Đã tự động tải hồ sơ: ${foundPreset.plate} · ${foundPreset.driverName}`)
    }

    // 2. Gửi truy vấn đối soát tới Backend API
    try {
      const res = await gateService.verifyGateScan({
        gateId: gateLane,
        laneCode: gateLane,
        vehiclePlate: clean,
        licensePlate: clean,
        driverConfirmed: true,
      })

      if (res.success && res.data) {
        const bkg = res.data.booking
        const drv = res.data.driver

        if (bkg || drv) {
          setCurrentProfile((prev) => ({
            ...prev,
            plate: res.data.detectedVehiclePlate || clean,
            driverName: drv?.fullName || bkg?.driverName || prev.driverName,
            licenseNumber: drv?.licenseNumber || bkg?.driverLicenseNumber || prev.licenseNumber,
            idCard: drv?.idCardNumber || prev.idCard,
            phone: drv?.phone || bkg?.driverPhone || prev.phone,
            carrier: drv?.carrierName || bkg?.carrierName || prev.carrier,
            bookingNumber: bkg?.bookingNumber || prev.bookingNumber,
            containerNumber: bkg?.containerNumber || prev.containerNumber,
            shippingLine: bkg?.carrierName || prev.shippingLine,
            billingStatus: 'PAID',
          }))
          showToast(`✓ Đã khớp lệnh Booking: #${bkg?.bookingNumber || clean}`)
        }
      }
    } catch {
      // Tiếp tục dùng thông tin preset mượt mà
    } finally {
      setVerifying(false)
    }
  }

  // Đọc params nếu mở từ URL
  useEffect(() => {
    const p = searchParams.get('plate')
    if (p) {
      setSearchInput(p)
      autoLookupPlate(p)
    }
  }, [searchParams])

  // Đánh giá các tiêu chí đối soát (gọn gàng, rõ ràng)
  const compliance = useMemo(() => {
    const isLicenseOk = currentProfile.licenseClass === 'FC'
    const isTimeOk = currentProfile.timeSlotValid
    const isBillingOk = currentProfile.billingStatus === 'PAID'
    const isSafetyOk = safetyChecks.ppe && safetyChecks.vehicleTire && safetyChecks.sealIntact

    const items = [
      {
        id: 'license',
        label: 'GPLX Hạng FC',
        sub: `${currentProfile.licenseNumber} · Hạng ${currentProfile.licenseClass}`,
        ok: isLicenseOk,
        badMsg: 'Yêu cầu hạng FC',
      },
      {
        id: 'carrier',
        label: 'Định Danh & Nhà Xe',
        sub: `${currentProfile.idCard} · ${currentProfile.carrier}`,
        ok: Boolean(currentProfile.driverName && currentProfile.idCard),
        badMsg: 'Chưa đủ hồ sơ',
      },
      {
        id: 'timeslot',
        label: 'Khung Giờ Hẹn',
        sub: currentProfile.timeSlot,
        ok: isTimeOk,
        badMsg: 'Quá hạn hẹn',
      },
      {
        id: 'billing',
        label: 'Cước Phí e-Port',
        sub: isBillingOk ? 'Đã thanh toán' : 'Chưa đóng cước',
        ok: isBillingOk,
        badMsg: 'Chưa thanh toán',
      },
      {
        id: 'safety',
        label: 'An Toàn & Seal',
        sub: `Seal: ${currentProfile.sealNumber}`,
        ok: isSafetyOk,
        badMsg: 'Chưa đạt an toàn',
      },
    ]

    const allOk = items.every((x) => x.ok)
    return { items, allOk }
  }, [currentProfile, safetyChecks])

  // Lưu kết quả xác minh hồ sơ xe & tài xế
  const handleSaveVerification = () => {
    const isPass = compliance.allOk || overrideActive
    const code = `VER-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(100000 + Math.random() * 900000)}`

    setHistoryList((prev) => [
      {
        id: `LOG-${Date.now()}`,
        verificationCode: code,
        gateCode: gateLane,
        verificationStatus: isPass ? 'PASS' : 'FAIL',
        detectedPlate: currentProfile.plate,
        driverName: currentProfile.driverName,
        bookingId: currentProfile.bookingNumber,
        notes: isPass ? 'Hồ sơ đã xác minh hợp lệ' : 'Hồ sơ chưa đạt tiêu chuẩn',
        verificationTime: new Date().toISOString(),
      },
      ...prev,
    ])

    showToast(isPass ? `✓ Đã lưu kết quả: Xe ${currentProfile.plate} HỢP LỆ` : `⚠️ Đã lưu ghi nhận: Xe ${currentProfile.plate} CHƯA ĐẠT`)
  }

  // Từ chối qua cổng
  const handleConfirmReject = () => {
    setShowRejectModal(false)
    setHistoryList((prev) => [
      {
        id: `REJ-${Date.now()}`,
        verificationCode: `REJ-${Date.now().toString().slice(-6)}`,
        gateCode: gateLane,
        verificationStatus: 'FAIL',
        detectedPlate: currentProfile.plate,
        driverName: currentProfile.driverName,
        bookingId: currentProfile.bookingNumber,
        notes: `Từ chối vào cổng: ${rejectReason || 'Không đủ điều kiện'}`,
        verificationTime: new Date().toISOString(),
      },
      ...prev,
    ])
    showToast(`⛔ Đã lập biên bản từ chối xe ${currentProfile.plate}`)
    setRejectReason('')
  }

  // Ghi đè ngoại lệ
  const handleConfirmOverride = () => {
    setShowOverrideModal(false)
    setOverrideActive(true)
    showToast(`⚠️ Đã cấp quyền ngoại lệ cho xe ${currentProfile.plate}`)
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 flex flex-col gap-4 font-sans">
      {/* Toast thông báo */}
      {toastMessage && (
        <div className="fixed top-5 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 border border-slate-700 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── HEADER TỐI GIẢN & THANH QUÉT BIỂN SỐ TỰ ĐỘNG ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 md:p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-2xl">badge</span>
              Xác Minh Xe & Tài Xế
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Cảng Tiên Sa · Tự động đối soát và tải thông tin khi quét biển số
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-slate-100 rounded-xl px-3 py-1.5 border border-slate-200 text-xs font-bold text-slate-700 gap-2">
              <span className="material-symbols-outlined text-base text-blue-600">door_front</span>
              <select
                value={gateLane}
                onChange={(e) => setGateLane(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="GATE-A1">Làn In-01 (Cổng A)</option>
                <option value="GATE-A2">Làn In-02 (Cổng A)</option>
                <option value="GATE-B1">Làn Out-01 (Cổng B)</option>
              </select>
            </div>
            <div className="font-mono text-xs font-bold bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl text-slate-700">
              {currentTime}
            </div>
          </div>
        </div>

        {/* Ô QUÉT BIỂN SỐ NHANH & DANH SÁCH XE TẠI LÀN */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 pt-2 border-t border-slate-100">
          {/* Ô nhập/quét biển số */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <span className="material-symbols-outlined text-lg text-blue-600">search</span>
            </span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                const val = e.target.value.toUpperCase()
                setSearchInput(val)
                // Tự động nhảy thông tin nếu khớp ít nhất 4 ký tự biển số
                if (val.length >= 4) {
                  autoLookupPlate(val)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  autoLookupPlate(searchInput)
                }
              }}
              placeholder="Quét mã vạch hoặc nhập biển số xe (VD: 29Y3-036.58)..."
              className="w-full pl-9 pr-24 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-blue-600 tracking-wider uppercase"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute inset-y-0 right-10 pr-2 flex items-center text-slate-400 hover:text-slate-600 text-xs"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => autoLookupPlate(searchInput)}
              disabled={verifying}
              className="absolute inset-y-1 right-1 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold font-mono flex items-center gap-1 cursor-pointer transition-all"
            >
              {verifying ? 'ĐANG TẢI...' : 'TRA CỨU'}
            </button>
          </div>

          {/* Xe đang chờ tại làn - Bấm là tự động nhảy thông tin ngay */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap hidden sm:inline">
              Xe tại làn:
            </span>
            {VEHICLE_PRESETS.map((item) => {
              const active = item.plate === currentProfile.plate
              return (
                <button
                  key={item.plate}
                  type="button"
                  onClick={() => {
                    setSearchInput(item.plate)
                    autoLookupPlate(item.plate)
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${item.licenseClass === 'FC' && item.billingStatus === 'PAID' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span>{item.plate}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── 3 KHỐI THÔNG TIN CHÍNH: TÀI XẾ · PHƯƠNG TIỆN · LỆNH GIAO NHẬN ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* THẺ 1: HỒ SƠ TÀI XẾ */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-base text-blue-600">person</span>
                Tài Xế
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${currentProfile.licenseClass === 'FC' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {currentProfile.licenseClass === 'FC' ? 'GPLX Hợp Lệ' : 'GPLX Sai Hạng'}
              </span>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
                {currentProfile.driverName.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-900 text-base leading-tight truncate">
                  {currentProfile.driverName}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  CCCD: <strong className="text-slate-800">{currentProfile.idCard}</strong>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Giấy phép lái xe:</span>
                <span className="font-mono font-bold text-slate-900">
                  {currentProfile.licenseNumber} ({currentProfile.licenseClass})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Hạn bằng lái:</span>
                <span className="font-mono text-emerald-700 font-semibold">{currentProfile.licenseExpiry}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Số điện thoại:</span>
                <span className="font-semibold text-slate-800">{currentProfile.phone}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">Doanh nghiệp:</span>
                <span className="font-medium text-slate-800 truncate max-w-[150px]" title={currentProfile.carrier}>
                  {currentProfile.carrier}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* THẺ 2: ĐẦU KÉO & RƠ-MOÓC */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-base text-blue-600">local_shipping</span>
                Phương Tiện
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                Đăng Kiểm Đạt
              </span>
            </div>

            {/* Khung biển số nổi bật */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 bg-white border-2 border-slate-800 rounded-xl px-3 py-2 text-center shadow-xs">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Biển Đầu Kéo</span>
                <span className="font-mono font-black text-slate-900 text-base tracking-wider block">
                  {currentProfile.plate}
                </span>
              </div>
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Sơ-mi Rơ-moóc</span>
                <span className="font-mono font-bold text-slate-800 text-sm tracking-wide block">
                  {currentProfile.chassisPlate}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Tải trọng đăng ký:</span>
                <span className="font-semibold text-slate-900">Kéo theo 32 Tấn</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Tình trạng kiểm định:</span>
                <span className="font-semibold text-emerald-700">Còn hạn (2027)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Vị trí hiện tại:</span>
                <span className="font-semibold text-blue-700">Dừng tại vạch làn</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">Tác nghiệp:</span>
                <span className="font-bold text-slate-800">{currentProfile.operationLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* THẺ 3: LỆNH GIAO NHẬN CONTAINER (e-EIR) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-base text-blue-600">receipt_long</span>
                Lệnh e-EIR / Booking
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  currentProfile.billingStatus === 'PAID'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {currentProfile.billingStatus === 'PAID' ? 'Đã Nộp Phí' : 'Chưa Đóng Phí'}
              </span>
            </div>

            <div className="flex items-center justify-between mb-3 bg-blue-50/70 border border-blue-200/80 px-3 py-2 rounded-xl">
              <div>
                <span className="text-[10px] text-blue-600 font-bold block uppercase">Số Container</span>
                <span className="font-mono font-black text-blue-900 text-base">{currentProfile.containerNumber}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-bold block">Loại Vỏ</span>
                <span className="font-mono font-bold text-slate-800 text-xs">{currentProfile.containerType}</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Mã Booking:</span>
                <span className="font-mono font-bold text-slate-900">{currentProfile.bookingNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Hãng tàu:</span>
                <span className="font-bold text-slate-800">{currentProfile.shippingLine}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Số Seal chì:</span>
                <span className="font-mono font-semibold text-slate-800">{currentProfile.sealNumber}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">Khung giờ hẹn:</span>
                <span
                  className={`font-semibold ${
                    currentProfile.timeSlotValid ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {currentProfile.timeSlot} {currentProfile.timeSlotValid ? '✓' : '(Quá hạn)'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TIÊU CHUẨN ĐỐI SOÁT & THANH HÀNH ĐỘNG DUYỆT CỔNG ── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 md:p-5 shadow-xs flex flex-col gap-4">
        {/* 5 Tiêu chuẩn đối soát nhanh (Dạng thẻ pill nhỏ gọn, bớt chữ) */}
        <div>
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Kết Quả Đối Soát Tiêu Chuẩn Vào Cảng:
            </span>
            <div className="flex items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 font-medium">
                <input
                  type="checkbox"
                  checked={safetyChecks.ppe}
                  onChange={(e) => setSafetyChecks({ ...safetyChecks, ppe: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span>Đủ BHLĐ</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 font-medium">
                <input
                  type="checkbox"
                  checked={safetyChecks.vehicleTire}
                  onChange={(e) => setSafetyChecks({ ...safetyChecks, vehicleTire: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span>Lốp xe an toàn</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 font-medium">
                <input
                  type="checkbox"
                  checked={safetyChecks.sealIntact}
                  onChange={(e) => setSafetyChecks({ ...safetyChecks, sealIntact: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span>Seal nguyên vẹn</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            {compliance.items.map((item) => (
              <div
                key={item.id}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                  item.ok
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold truncate">{item.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">{item.sub}</div>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono shrink-0 ${
                    item.ok
                      ? 'bg-emerald-200/80 text-emerald-900'
                      : 'bg-rose-200 text-rose-900'
                  }`}
                >
                  {item.ok ? 'ĐẠT' : item.badMsg}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* BĂNG KẾT QUẢ ĐỐI SOÁT & THAO TÁC */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-slate-100">
          <div className="text-xs">
            {compliance.allOk || overrideActive ? (
              <div className="flex items-center gap-2 text-emerald-700 font-bold">
                <span className="material-symbols-outlined text-lg">check_circle</span>
                <span>Hồ sơ xe và tài xế hợp lệ. Sẵn sàng cho làn kiểm soát cổng.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-rose-700 font-bold">
                <span className="material-symbols-outlined text-lg">error</span>
                <span>Có tiêu chuẩn chưa đạt. Vui lòng kiểm tra lại giấy tờ hoặc ghi chú ngoại lệ.</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setShowRejectModal(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition-all"
            >
              Báo Sự Cố
            </button>
            <button
              type="button"
              onClick={() => setShowOverrideModal(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-amber-50 hover:text-amber-800 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition-all"
            >
              Ngoại Lệ
            </button>
            <button
              type="button"
              onClick={handleSaveVerification}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-base">save</span>
              <span>Lưu Kết Quả Xác Minh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── BẢNG LỊCH SỬ GỌN GÀNG Ở DƯỚI ── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2.5">
        <div className="flex justify-between items-center text-xs font-bold text-slate-700">
          <span className="uppercase tracking-wider">Nhật Ký Xe Qua Cổng Trong Ca</span>
          <span className="text-[11px] font-normal text-slate-500">
            {historyList.length} lượt đã ghi nhận
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                <th className="py-2 px-3">Thời Gian</th>
                <th className="py-2 px-3">Mã Xác Minh</th>
                <th className="py-2 px-3">Làn</th>
                <th className="py-2 px-3">Biển Số Xe</th>
                <th className="py-2 px-3">Tài Xế</th>
                <th className="py-2 px-3">Mã Booking</th>
                <th className="py-2 px-3">Kết Quả</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyList.slice(0, 5).map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono text-slate-500">
                    {row.verificationTime ? new Date(row.verificationTime).toLocaleTimeString('vi-VN') : 'Vừa xong'}
                  </td>
                  <td className="py-2 px-3 font-mono font-semibold text-slate-800">{row.verificationCode || '—'}</td>
                  <td className="py-2 px-3 font-medium text-slate-600">{row.gateCode || gateLane}</td>
                  <td className="py-2 px-3 font-mono font-bold text-slate-900">{row.detectedPlate || row.licensePlate}</td>
                  <td className="py-2 px-3 font-medium text-slate-800">{row.driverName || '—'}</td>
                  <td className="py-2 px-3 font-mono text-blue-700">{row.bookingId || '—'}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.verificationStatus === 'PASS' || row.status === 'PASS'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {row.verificationStatus === 'PASS' || row.status === 'PASS' ? 'HỢP LỆ' : 'CHƯA ĐẠT'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>



      {/* ══ MODAL TỪ CHỐI ══ */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-4 shadow-xl border border-slate-200 space-y-3 text-xs">
            <div className="font-bold text-rose-700 text-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">block</span>
              <span>Từ Chối Cho Qua Cổng</span>
            </div>
            <p className="text-slate-600">
              Lập biên bản từ chối xe <strong>{currentProfile.plate}</strong>:
            </p>
            <div className="space-y-1">
              {[
                'GPLX không đúng hạng FC hoặc hết hạn',
                'Quá hạn khung giờ hẹn Booking',
                'Chưa thanh toán cước e-Port',
                'Phương tiện không đảm bảo an toàn',
              ].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRejectReason(r)}
                  className={`w-full text-left p-2 rounded border text-xs ${rejectReason === r ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-3.5 py-1.5 bg-rose-700 text-white font-bold rounded-lg"
              >
                Xác Nhận Từ Chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL NGOẠI LỆ ══ */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-4 shadow-xl border border-slate-200 space-y-3 text-xs">
            <div className="font-bold text-amber-700 text-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">warning</span>
              <span>Cấp Quyền Ngoại Lệ (Override)</span>
            </div>
            <p className="text-slate-600">
              Phê duyệt ngoại lệ cho xe <strong>{currentProfile.plate}</strong>:
            </p>
            <input
              type="text"
              value={overrideNote}
              onChange={(e) => setOverrideNote(e.target.value)}
              placeholder="Nhập lý do bảo lãnh / chỉ đạo..."
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmOverride}
                className="px-3.5 py-1.5 bg-amber-600 text-white font-bold rounded-lg"
              >
                Chấp Thuận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
