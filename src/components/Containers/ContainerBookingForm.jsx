import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { containerService } from '../../services/containerService'
import { bookingService } from '../../services/bookingService'
import reeferService from '../../services/reeferService'

const inputClass = 'w-full rounded-xl border border-chalk bg-fog px-4 py-2.5 text-xs outline-none focus:border-signal-orange focus:bg-white focus:ring-0 transition-all font-medium'
const selectClass = 'w-full rounded-xl border border-chalk bg-fog px-3 py-2.5 text-xs outline-none focus:border-signal-orange focus:bg-white focus:ring-0 transition-all font-medium cursor-pointer'

const message = e => {
  const body = e.response?.data
  const errors = body?.errors || body?.Errors
  return errors ? Object.values(errors).flat().join(' ') : body?.message || body?.Message || e.message
}

const PRIMARY_OPERATIONS = [
  {
    type: 'Export',
    direction: 'GateIn',
    cargoStatus: 'Loaded',
    title: 'Giao container hàng xuất khẩu',
    subtitle: 'Hạ container hàng vào bãi cảng (Cổng vào)',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: 'upload'
  },
  {
    type: 'Import',
    direction: 'GateOut',
    cargoStatus: 'Loaded',
    title: 'Nhận container hàng nhập khẩu',
    subtitle: 'Bốc container hàng rời bãi cảng (Cổng ra)',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: 'download'
  }
]

export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'CarrierBookingReference', label: 'Mã đặt chỗ Hãng tàu (Booking Note)' },
  { value: 'BillOfLading', label: 'Vận đơn đường biển (B/L)' },
  { value: 'DeliveryOrder', label: 'Lệnh giao hàng điện tử (eDO)' },
  { value: 'CustomsDeclaration', label: 'Tờ khai Hải quan thông quan' },
  { value: 'VgmCertificate', label: 'Phiếu xác nhận khối lượng toàn bộ (VGM)' },
  { value: 'ReeferInstructions', label: 'Chỉ dẫn bảo quản nhiệt độ container lạnh' },
  { value: 'DangerousGoodsDeclaration', label: 'Bản khai báo hàng hóa nguy hiểm (IMO)' },
  { value: 'Other', label: 'Chứng từ đính kèm khác' }
]

export const getOperationLabelVi = (type) => {
  switch (type) {
    case 'Export': return 'Xuất khẩu'
    case 'Import': return 'Nhập khẩu'
    case 'Combined': return 'Chuyến xe kết hợp'
    case 'Pickup': return 'Nhận container'
    case 'Dropoff': return 'Giao container'
    default: return type || 'Nghiệp vụ cảng'
  }
}

export const getGateDirectionLabelVi = (dir) => {
  if (dir === 'GateIn') return 'Cổng vào'
  if (dir === 'GateOut') return 'Cổng ra'
  return dir || 'Cổng cảng'
}

export const getCargoStatusLabelVi = (status) => {
  if (status === 'Empty') return 'Vỏ rỗng'
  if (status === 'Loaded') return 'Có hàng'
  return status || 'Có hàng'
}

export const CONTAINER_ISO_SIZES = [
  { value: '20GP', label: "20'DC - Tiêu chuẩn 20ft (Dry General)" },
  { value: '40GP', label: "40'DC - Tiêu chuẩn 40ft (Dry General)" },
  { value: '40HC', label: "40'HC - Khô cao 40ft (High Cube)" },
  { value: '45HC', label: "45'HC - Khô cao ngoại cỡ 45ft (High Cube)" },
  { value: '20RF', label: "20'RF - Lạnh tiêu chuẩn 20ft (Reefer)" },
  { value: '40RF', label: "40'RF - Lạnh bảo quản 40ft (High Cube Reefer)" }
]

export const getCargoTypeLabelVi = (type) => {
  switch (type) {
    case 'General': return 'Hàng bách hóa'
    case 'Reefer': return 'Hàng đông lạnh'
    case 'DangerousGoods': return 'Hàng nguy hiểm'
    case 'Oversized': return 'Hàng quá khổ'
    default: return type || 'Hàng bách hóa'
  }
}

export const getDocumentTypeLabelVi = (type) => {
  switch (type) {
    case 'BookingNote':
    case 'CarrierBookingReference': return 'Booking xuất khẩu / Đăng ký hạ vỏ'
    case 'BillOfLading': return 'Vận đơn đường biển (B/L)'
    case 'DeliveryOrder': return 'Lệnh giao hàng điện tử (eDO / D/O)'
    case 'CustomsDeclaration': return 'Tờ khai Hải quan'
    case 'VgmCertificate': return 'Phiếu xác nhận khối lượng (VGM)'
    case 'ReeferInstructions': return 'Chỉ dẫn nhiệt độ cont lạnh'
    case 'DangerousGoodsDeclaration': return 'Khai báo hàng nguy hiểm (IMO)'
    case 'EirReceipt': return 'Phiếu giao nhận / Hạ bãi EIR'
    case 'Other': return 'Chứng từ đính kèm khác'
    default: return type || 'Chứng từ đính kèm'
  }
}

export const getContainerRequiredDocs = (op) => {
  const isExport = op.operationType === 'Export'
  const isImport = op.operationType === 'Import'
  const isReefer = op.cargoType === 'Reefer'
  const isDg = op.cargoType === 'DangerousGoods'

  const docs = []
  if (isExport) {
    docs.push({
      type: 'CarrierBookingReference',
      title: 'Booking Xuất Khẩu / Mã Hạ Cont',
      subtitle: 'Số booking hoặc mã đăng ký hạ container',
      mandatory: true,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: 'receipt_long'
    })
    docs.push({
      type: 'CustomsDeclaration',
      title: 'Tờ Khai Hải Quan Xuất Khẩu',
      subtitle: 'Thông tin tờ khai, mã vạch hoặc trạng thái thông quan theo yêu cầu',
      mandatory: false,
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: 'policy'
    })
    docs.push({
      type: 'VgmCertificate',
      title: 'Phiếu Xác Nhận Khối Lượng (VGM)',
      subtitle: 'Cân tải trọng container theo quy định SOLAS',
      mandatory: true,
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
      icon: 'scale'
    })
  } else if (isImport) {
    docs.push({
      type: 'DeliveryOrder',
      title: 'Lệnh Giao Hàng Hãng Tàu (D/O hoặc eDO)',
      subtitle: 'Lệnh giao hàng của hãng tàu cấp',
      mandatory: true,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: 'task'
    })
    docs.push({
      type: 'BillOfLading',
      title: 'Thông Tin Vận Đơn Đường Biển (B/L)',
      subtitle: 'Để xác định lô hàng khi cần tra cứu',
      mandatory: true,
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: 'description'
    })
    docs.push({
      type: 'CustomsDeclaration',
      title: 'Tờ Khai Hải Quan Nhập Khẩu',
      subtitle: 'Trạng thái thông quan hoặc điều kiện giao hàng theo quy định',
      mandatory: true,
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: 'policy'
    })
  }

  if (isReefer) {
    docs.push({
      type: 'ReeferInstructions',
      title: 'Chỉ Dẫn Bảo Quản Cont Lạnh',
      subtitle: 'Nhiệt độ cài đặt và cắm điện bãi cảng',
      mandatory: true,
      badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
      icon: 'ac_unit'
    })
  }

  if (isDg) {
    docs.push({
      type: 'DangerousGoodsDeclaration',
      title: 'Khai Báo Hàng Nguy Hiểm (IMO)',
      subtitle: 'Phân lớp nguy hiểm DG Class và mã UN',
      mandatory: true,
      badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
      icon: 'warning'
    })
  }

  return docs
}

export const getBookingStatusLabelVi = (status) => {
  switch (status) {
    case 'Ready': return 'Sẵn sàng vào cổng'
    case 'Pending': return 'Chờ điều phối'
    case 'Approved': return 'Đã duyệt'
    case 'CheckedIn': return 'Đã vào cổng'
    case 'Completed': return 'Hoàn tất'
    case 'Canceled': return 'Đã hủy'
    case 'Rejected': return 'Từ chối'
    case 'UnderReview': return 'Đang thẩm định'
    default: return status || 'Khởi tạo'
  }
}

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function ContainerBookingForm({ onSaved, onClose }) {
  const { state: context } = useLocation()

  // Mode: 'single' | 'combined'
  const [bookingMode, setBookingMode] = useState('single')
  const [selectedPrimaryOp, setSelectedPrimaryOp] = useState('Export')
  const [combinedPair, setCombinedPair] = useState('Export_Import')

  // Operations state: array of 1 or 2 operations
  const [operations, setOperations] = useState([
    {
      operationType: 'Export',
      expectedGateDirection: 'GateIn',
      cargoStatus: 'Loaded',
      cargoType: 'General',
      containerIsoSize: '40HC',
      containerNumber: context?.containerNumber || '',
      carrierBookingNumber: '',
      billOfLadingNumber: '',
      deliveryOrderNumber: '',
      customsDeclarationNumber: '',
      emptyReleaseOrderNumber: '',
      emptyReturnAuthNumber: '',
      sealNumber: '',
      grossWeightKg: 24000,
      temperatureSetPoint: null,
      dangerousGoodsClass: '',
      unNumber: '',
      documents: []
    }
  ])

  // Fleet & resources
  const [fleet, setFleet] = useState({ trucks: [], drivers: [] })
  const [availableContainers, setAvailableContainers] = useState([])
  const [availablePlugs, setAvailablePlugs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(null)
  const [step, setStep] = useState(1)

  // Vehicle, driver, appointment schedule
  const [form, setForm] = useState({
    bookingCode: `BK-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`,
    truckId: '',
    trailerNumber: '',
    driverId: '',
    appointmentDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '12:00',
    feeTermsAgreed: true,
    isReeferPowerRequired: false,
    targetTemperature: -18,
    temperatureUnit: 'C',
    tempTolerance: 1.5,
    requiredPowerKw: 15.0,
    reeferPlugId: '',
    specialColdInstructions: ''
  })

  // Load resources
  useEffect(() => {
    let live = true
    setLoading(true)
    const load = async () => {
      try {
        const [resources, plugsData] = await Promise.all([
          bookingService.getAvailableResources().catch(() => ({ trucks: [], drivers: [], containers: [] })),
          reeferService.getPlugs({ usage_status: 'AVAILABLE', technical_status: 'HEALTHY' }).catch(() => [])
        ])

        if (live) {
          setFleet({ trucks: resources?.trucks || [], drivers: resources?.drivers || [] })
          setAvailableContainers(resources?.containers || [])
          setAvailablePlugs(Array.isArray(plugsData) ? plugsData : (plugsData?.data || []))

          if (context?.containerNumber) {
            setOperations(prev => prev.map((op, idx) => idx === 0 ? { ...op, containerNumber: context.containerNumber } : op))
          }
        }
      } catch (err) {
        if (live) setError(message(err))
      } finally {
        if (live) setLoading(false)
      }
    }
    load()
    return () => { live = false }
  }, [context?.containerNumber])

  // Synchronize operations when mode or primary op changes
  const applySingleOperation = (opType) => {
    setSelectedPrimaryOp(opType)
    const def = PRIMARY_OPERATIONS.find(o => o.type === opType) || PRIMARY_OPERATIONS[0]
    setOperations([
      {
        operationType: def.type,
        expectedGateDirection: def.direction,
        cargoStatus: 'Loaded',
        cargoType: 'General',
        containerIsoSize: '40HC',
        containerNumber: operations[0]?.containerNumber || '',
        carrierBookingNumber: '',
        billOfLadingNumber: '',
        deliveryOrderNumber: '',
        customsDeclarationNumber: '',
        emptyReleaseOrderNumber: '',
        emptyReturnAuthNumber: '',
        sealNumber: '',
        grossWeightKg: 25000,
        temperatureSetPoint: null,
        dangerousGoodsClass: '',
        unNumber: '',
        documents: []
      }
    ])
  }

  const applyCombinedPair = (pairKey = 'Export_Import') => {
    setCombinedPair('Export_Import')
    const leg1Type = 'Export'
    const leg2Type = 'Import'

    const def1 = PRIMARY_OPERATIONS.find(o => o.type === leg1Type) || PRIMARY_OPERATIONS[0]
    const def2 = PRIMARY_OPERATIONS.find(o => o.type === leg2Type) || PRIMARY_OPERATIONS[1]

    setOperations([
      {
        operationType: def1.type,
        expectedGateDirection: def1.direction,
        cargoStatus: 'Loaded',
        cargoType: 'General',
        containerIsoSize: '40HC',
        containerNumber: operations[0]?.containerNumber || '',
        carrierBookingNumber: '',
        billOfLadingNumber: '',
        deliveryOrderNumber: '',
        customsDeclarationNumber: '',
        emptyReleaseOrderNumber: '',
        emptyReturnAuthNumber: '',
        sealNumber: '',
        grossWeightKg: 25000,
        temperatureSetPoint: null,
        dangerousGoodsClass: '',
        unNumber: '',
        documents: []
      },
      {
        operationType: def2.type,
        expectedGateDirection: def2.direction,
        cargoStatus: 'Loaded',
        cargoType: 'General',
        containerIsoSize: '40HC',
        containerNumber: '',
        carrierBookingNumber: '',
        billOfLadingNumber: '',
        deliveryOrderNumber: '',
        customsDeclarationNumber: '',
        emptyReleaseOrderNumber: '',
        emptyReturnAuthNumber: '',
        sealNumber: '',
        grossWeightKg: 25000,
        temperatureSetPoint: null,
        dangerousGoodsClass: '',
        unNumber: '',
        documents: []
      }
    ])
  }

  const updateOperation = (index, patch) => {
    setOperations(prev => prev.map((op, i) => i === index ? { ...op, ...patch } : op))
  }

  // Upload document state
  const [uploadingDoc, setUploadingDoc] = useState({ opIndex: null, loading: false, progressMsg: '' })
  const [selectedDocTypeByOp, setSelectedDocTypeByOp] = useState({})
  const fileInputRefs = useRef({})

  const triggerFileUpload = (opIndex, docType) => {
    setSelectedDocTypeByOp(prev => ({ ...prev, [opIndex]: docType }))
    const inputEl = fileInputRefs.current[opIndex]
    if (inputEl) {
      inputEl.value = ''
      inputEl.click()
    }
  }

  const handleFileSelected = async (opIndex, event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    const docType = selectedDocTypeByOp[opIndex] || (
      operations[opIndex]?.operationType === 'Export' ? 'CarrierBookingReference' : 'DeliveryOrder'
    )

    setUploadingDoc({
      opIndex,
      loading: true,
      progressMsg: files.length > 1
        ? `Đang tải ${files.length} tệp chứng từ (${getDocumentTypeLabelVi(docType)}) lên máy chủ...`
        : `Đang tải tệp "${files[0].name}" (${getDocumentTypeLabelVi(docType)}) lên máy chủ...`
    })
    setError('')

    try {
      const uploadPromises = files.map(async (file) => {
        const res = await bookingService.uploadDocumentFile(file)
        const autoDocNum = `${docType.toUpperCase().slice(0, 4)}-${Math.floor(100000 + Math.random() * 900000)}`
        return {
          documentType: docType,
          documentNumber: autoDocNum,
          fileName: res.fileName || file.name,
          fileUrl: res.fileUrl,
          fileSizeBytes: res.fileSizeBytes || file.size,
          issuer: 'Doanh Nghiệp / Chủ Hàng',
          status: 'Uploaded',
          uploadedAt: new Date().toISOString()
        }
      })

      const newDocs = await Promise.all(uploadPromises)

      setOperations(prev => prev.map((op, i) => {
        if (i !== opIndex) return op
        return {
          ...op,
          documents: [...op.documents, ...newDocs]
        }
      }))
    } catch (err) {
      setError(`Lỗi tải tệp đính kèm: ${message(err)}`)
    } finally {
      setUploadingDoc({ opIndex: null, loading: false, progressMsg: '' })
      if (event.target) event.target.value = ''
    }
  }



  const addDocumentToOp = (opIndex, docType) => {
    triggerFileUpload(opIndex, docType)
  }

  const removeDocumentFromOp = (opIndex, docIndex) => {
    setOperations(prev => prev.map((op, i) => {
      if (i !== opIndex) return op
      return {
        ...op,
        documents: op.documents.filter((_, di) => di !== docIndex)
      }
    }))
  }

  // Handle Save
  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    if (step === 1) {
      // Validate step 1
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i]
        if (!op.containerNumber?.trim()) {
          setError(`Nghiệp vụ ${i + 1} (${op.operationType}) chưa có mã container.`)
          return
        }
      }
      if (bookingMode === 'combined') {
        if (operations.length === 2 && operations[0].containerNumber.trim().toUpperCase() === operations[1].containerNumber.trim().toUpperCase()) {
          setError('Không thể sử dụng cùng 1 mã container cho cả lượt Hạ và Bốc trong cùng một chuyến!')
          return
        }
      }
      setStep(2)
      return
    }

    setBusy(true)
    try {
      const start = new Date(`${form.appointmentDate}T${form.startTime}:00Z`)
      const end = new Date(`${form.appointmentDate}T${form.endTime}:00Z`)
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
        throw new Error('Khung giờ hẹn không hợp lệ (Giờ bắt đầu phải trước giờ kết thúc).')
      }

      // Pre-validate combination if combined
      if (bookingMode === 'combined' && operations.length > 1) {
        try {
          const compResult = await bookingService.validateCombination({
            operations: operations.map(o => ({
              operationType: o.operationType,
              expectedGateDirection: o.expectedGateDirection,
              containerNumber: o.containerNumber
            }))
          })
          if (compResult && !compResult.isCompatible) {
            throw new Error(`Tổ hợp nghiệp vụ không tương thích: ${compResult.message || 'Lỗi quy tắc vận hành'}`)
          }
        } catch (valErr) {
          if (valErr.message.includes('không tương thích')) throw valErr
        }
      }

      const payload = {
        bookingCode: form.bookingCode,
        bookingType: bookingMode === 'combined' ? 'Combined' : operations[0].operationType,
        isCombined: bookingMode === 'combined',
        truckId: form.truckId || null,
        driverId: form.driverId || null,
        description: form.trailerNumber ? `Rơ-moóc: ${form.trailerNumber.trim().toUpperCase()}` : null,
        appointmentStart: start.toISOString(),
        appointmentEnd: end.toISOString(),
        isReeferPowerRequired: Boolean(form.isReeferPowerRequired),
        targetTemperature: form.isReeferPowerRequired ? Number(form.targetTemperature) : null,
        temperatureUnit: form.isReeferPowerRequired ? (form.temperatureUnit || 'C') : null,
        tempTolerance: form.isReeferPowerRequired ? Number(form.tempTolerance) : null,
        requiredPowerKw: form.isReeferPowerRequired ? Number(form.requiredPowerKw || 15.0) : null,
        reeferPlugId: form.isReeferPowerRequired && form.reeferPlugId ? form.reeferPlugId : null,
        specialColdInstructions: form.isReeferPowerRequired ? (form.specialColdInstructions || null) : null,

        // Legacy compatibility
        containerSelections: operations.map(o => ({
          containerId: null,
          containerNumber: o.containerNumber,
          containerTypeCode: o.containerIsoSize || '40HC',
          cargoTypeName: o.cargoType,
          grossWeightKg: o.grossWeightKg,
          sealNumber: o.sealNumber
        })),

        documents: [],

        operations: operations.map(o => ({
          operationType: o.operationType,
          containerNumber: o.containerNumber.trim().toUpperCase(),
          containerIsoSize: o.containerIsoSize || '40HC',
          expectedGateDirection: o.expectedGateDirection,
          cargoStatus: o.cargoStatus,
          cargoType: o.cargoType,
          carrierBookingNumber: o.carrierBookingNumber || null,
          billOfLadingNumber: o.billOfLadingNumber || null,
          deliveryOrderNumber: o.deliveryOrderNumber || null,
          customsDeclarationNumber: o.customsDeclarationNumber || null,
          sealNumber: o.sealNumber || null,
          grossWeightKg: o.grossWeightKg ? Number(o.grossWeightKg) : null,
          temperatureSetPoint: o.cargoType === 'Reefer' ? (o.temperatureSetPoint ? Number(o.temperatureSetPoint) : -18) : null,
          dangerousGoodsClass: o.cargoType === 'DangerousGoods' ? (o.dangerousGoodsClass || 'Class 3') : null,
          unNumber: o.cargoType === 'DangerousGoods' ? (o.unNumber || 'UN1203') : null,
          documents: (o.documents || []).map(d => ({
            documentType: d.documentType,
            documentNumber: d.documentNumber,
            fileUrl: d.fileUrl || d.fileReference,
            fileName: d.fileName || d.documentNumber,
            fileSizeBytes: d.fileSizeBytes || null,
            issuer: d.issuer
          }))
        }))
      }

      const res = await bookingService.createBooking(payload)
      setSaved(res)
      onSaved?.(res)
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  if (saved) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-chalk bg-white p-8 shadow-sm space-y-6 animate-in fade-in" role="status">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shrink-0">
            <span className="material-symbols-outlined text-3xl">check_circle</span>
          </div>
          <div>
            <h2 className="font-heading text-2xl font-extrabold text-carbon">Đăng Ký Booking Thành Công!</h2>
            <p className="text-sm text-slate-500 font-mono mt-0.5">{saved.bookingCode || form.bookingCode}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-fog p-5 border border-chalk space-y-3">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-chalk">
            <span className="text-slate-500 font-semibold">Chế độ vận hành:</span>
            <span className="font-extrabold text-carbon uppercase tracking-wider">
              {saved.isCombined || bookingMode === 'combined' ? 'Chuyến xe kết hợp 2 chiều' : `Chuyến xe đơn (${getOperationLabelVi(saved.bookingType)})`}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pb-2 border-b border-chalk">
            <span className="text-slate-500 font-semibold">Trạng thái hồ sơ:</span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
              {getBookingStatusLabelVi(saved.status)} (Chờ điều độ cảng duyệt)
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold">Thời gian hẹn:</span>
            <span className="font-bold text-carbon">
              {new Date(saved.appointmentStart || `${form.appointmentDate}T${form.startTime}`).toLocaleString('vi-VN')}
            </span>
          </div>
        </div>

        {/* Operations Breakdown */}
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Danh mục nghiệp vụ đã ghi nhận:</h4>
          <div className="grid grid-cols-1 gap-3">
            {operations.map((op, idx) => (
              <div key={idx} className="p-4 rounded-2xl border border-chalk bg-white flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                    op.expectedGateDirection === 'GateIn' ? 'bg-teal-50 text-teal-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-carbon text-xs">{getOperationLabelVi(op.operationType)}</span>
                      <span className="text-[10px] font-bold text-slate-400">({getGateDirectionLabelVi(op.expectedGateDirection)})</span>
                    </div>
                    <p className="text-xs font-mono font-bold text-signal-orange">{op.containerNumber}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                    {getCargoStatusLabelVi(op.cargoStatus)} · {getCargoTypeLabelVi(op.cargoType)}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">{op.documents.length} chứng từ đính kèm</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-chalk">
          <button
            onClick={() => {
              setSaved(null)
              setStep(1)
              onClose?.()
            }}
            className="px-6 py-2.5 rounded-xl bg-signal-orange text-white font-bold text-xs hover:bg-orange-600 transition-all cursor-pointer shadow-sm"
          >
            Quay lại Danh Sách Đặt Chỗ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-paper border border-chalk rounded-3xl p-6 sm:p-8 shadow-sm space-y-8 animate-in fade-in duration-200">
      {/* HEADER & STEPPER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-chalk">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-signal-orange uppercase tracking-wider mb-1">
            <span className="material-symbols-outlined text-sm">hub</span>
            Cổng Thông Minh NexusPort · TOS Da Nang
          </div>
          <h3 className="font-heading text-xl sm:text-2xl font-extrabold text-carbon">
            Đăng Ký Nghiệp Vụ Container & Lịch Cổng
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Hỗ trợ 4 nghiệp vụ container độc lập và cơ chế kết hợp chuyến xe 2 chiều (Cổng vào ➔ Bãi cảng ➔ Cổng ra).
          </p>
        </div>

        {/* Stepper Steps Navigation */}
        <div className="flex items-center gap-3 bg-fog p-1.5 rounded-2xl border border-chalk w-fit">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              step === 1
                ? 'bg-gradient-to-r from-signal-orange to-orange-600 text-white shadow-md shadow-orange-500/25'
                : 'text-slate-600 hover:text-carbon'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              step === 1 ? 'bg-white/20 text-white font-black' : 'bg-slate-200 text-slate-700'
            }`}>
              1
            </span>
            <span>Nghiệp Vụ & Container</span>
          </button>

          <div className="w-4 h-0.5 bg-chalk"></div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              step === 2
                ? 'bg-gradient-to-r from-signal-orange to-orange-600 text-white shadow-md shadow-orange-500/25'
                : 'text-slate-600 hover:text-carbon'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              step === 2 ? 'bg-white/20 text-white font-black' : 'bg-slate-200 text-slate-700'
            }`}>
              2
            </span>
            <span>Phương Tiện & Khung Giờ</span>
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 text-xs text-rose-900 flex items-center gap-3 animate-in fade-in">
          <span className="material-symbols-outlined text-rose-600 text-xl shrink-0">error</span>
          <div className="flex-1 font-semibold">{error}</div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 text-xs font-bold">Đóng</button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {step === 1 && (
          <>
            {/* 1. SELECT MODE: SINGLE OR COMBINED */}
            <div className="space-y-3">
              <label className="block text-xs font-extrabold uppercase text-slate-400 tracking-wider">
                1. Phương thức đăng ký chuyến xe vào cảng
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => {
                    setBookingMode('single')
                    applySingleOperation(selectedPrimaryOp)
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${
                    bookingMode === 'single'
                      ? 'border-signal-orange bg-orange-50/40 shadow-sm ring-2 ring-orange-500/10'
                      : 'border-chalk hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    bookingMode === 'single' ? 'bg-signal-orange text-white' : 'bg-fog text-slate-600'
                  }`}>
                    <span className="material-symbols-outlined text-2xl">local_shipping</span>
                  </div>
                  <div>
                    <h4 className="font-heading font-extrabold text-carbon text-sm">Chuyến Đơn Nghiệp Vụ</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Một container thực hiện một lượt Cổng vào hoặc Cổng ra duy nhất.</p>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setBookingMode('combined')
                    applyCombinedPair(combinedPair)
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${
                    bookingMode === 'combined'
                      ? 'border-signal-orange bg-orange-50/40 shadow-sm ring-2 ring-orange-500/10'
                      : 'border-chalk hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    bookingMode === 'combined' ? 'bg-signal-orange text-white' : 'bg-fog text-indigo-600'
                  }`}>
                    <span className="material-symbols-outlined text-2xl">sync_alt</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-heading font-extrabold text-carbon text-sm">Chuyến Xe Kết Hợp Hai Chiều</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Cảng Thông Minh
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Kết hợp 2 lượt (Hạ container vào + Bốc container ra) trong cùng một chuyến vào cảng.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. OPERATION SELECTION ACCORDING TO MODE */}
            {bookingMode === 'single' ? (
              <div className="space-y-3">
                <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider">
                  2. Chọn nghiệp vụ Xuất khẩu hoặc Nhập khẩu
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {PRIMARY_OPERATIONS.map((op) => (
                    <div
                      key={op.type}
                      onClick={() => applySingleOperation(op.type)}
                      className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between h-36 ${
                        selectedPrimaryOp === op.type
                          ? 'border-signal-orange bg-orange-50/40 shadow-sm ring-2 ring-orange-500/10'
                          : 'border-chalk hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`material-symbols-outlined p-2 rounded-xl text-lg ${
                          selectedPrimaryOp === op.type ? 'bg-signal-orange text-white' : 'bg-fog text-slate-600'
                        }`}>
                          {op.icon}
                        </span>
                        <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold uppercase ${op.badge}`}>
                          {op.direction === 'GateIn' ? 'Cổng vào' : 'Cổng ra'}
                        </span>
                      </div>
                      <div>
                        <h5 className="font-extrabold text-carbon text-sm leading-snug">{op.title}</h5>
                        <p className="text-xs text-slate-500 mt-1">{op.subtitle}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider">
                  2. Chọn tổ hợp nghiệp vụ kết hợp xuất nhập khẩu
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: 'Export_Import', label: 'Xuất khẩu + Nhập khẩu', desc: 'Hạ container hàng xuất (Cổng vào) & Bốc container hàng nhập (Cổng ra)' }
                  ].map((pair) => (
                    <div
                      key={pair.key}
                      onClick={() => applyCombinedPair(pair.key)}
                      className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between h-32 ${
                        combinedPair === pair.key
                          ? 'border-signal-orange bg-orange-50/40 shadow-sm ring-2 ring-orange-500/10'
                          : 'border-chalk hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-carbon text-sm">{pair.label}</span>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{pair.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* COMBINED TRIP VISUAL WORKFLOW PREVIEW */}
            {bookingMode === 'combined' && (
              <div className="rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 via-white to-sky-50/80 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-700 text-lg">route</span>
                  <h4 className="text-xs font-extrabold uppercase text-indigo-950 tracking-wider">
                    Sơ Đồ Tiến Trình Chuyến Xe Kết Hợp Hai Chiều
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-white border border-indigo-100 shadow-xs space-y-1">
                    <div className="flex items-center gap-2 font-extrabold text-teal-800">
                      <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px]">1</span>
                      <span>Chặng 1: Cổng Vào</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      Thực hiện <strong>{getOperationLabelVi(operations[0]?.operationType)}</strong> đối với container <strong>{operations[0]?.containerNumber || 'CONT-1'}</strong>.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-indigo-100 shadow-xs space-y-1">
                    <div className="flex items-center gap-2 font-extrabold text-indigo-800">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">2</span>
                      <span>Bãi Cảng (Hạ bãi / Chuyển vị trí)</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      Hạ container chặng 1 xuống bãi ➔ Xe di chuyển đến Block tiếp theo để cẩu gắp container chặng 2 lên rơ-moóc.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-indigo-100 shadow-xs space-y-1">
                    <div className="flex items-center gap-2 font-extrabold text-blue-800">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">3</span>
                      <span>Chặng 2: Cổng Ra</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      Thực hiện <strong>{getOperationLabelVi(operations[1]?.operationType)}</strong> đối với container <strong>{operations[1]?.containerNumber || 'CONT-2'}</strong> và xuất bãi.
                    </p>
                  </div>
                </div>
              </div>
            )}



            {/* 3. DYNAMIC OPERATIONS DETAIL FORMS */}
            <div className="space-y-6">
              <label className="block text-xs font-extrabold uppercase text-slate-400 tracking-wider">
                3. Chi tiết container và hồ sơ chứng từ điều kiện
              </label>

              {operations.map((op, idx) => (
                <div key={idx} className="bg-white border border-chalk rounded-3xl p-5 sm:p-6 space-y-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-chalk pb-4">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs ${
                        op.expectedGateDirection === 'GateIn' ? 'bg-teal-50 text-teal-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-heading font-extrabold text-carbon text-sm">{getOperationLabelVi(op.operationType)}</h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            op.expectedGateDirection === 'GateIn' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {getGateDirectionLabelVi(op.expectedGateDirection)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {op.expectedGateDirection === 'GateIn' ? 'Vào cổng giao / hạ container' : 'Rời cổng bốc / nhận container'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-semibold">Tình trạng:</span>
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold ${
                        op.cargoStatus === 'Empty' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {op.cargoStatus === 'Empty' ? 'Vỏ Rỗng' : 'Có Hàng'}
                      </span>
                    </div>
                  </div>

                  {/* Container Number & Specs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {op.operationType === 'Export' ? 'Số Container (Hạ bãi xuất) *' : 'Số Container Cần Lấy (Nhập) *'}
                      </label>
                      <input
                        required
                        type="text"
                        maxLength={16}
                        placeholder={op.operationType === 'Export' ? 'VD: MSKU9082103' : 'VD: CMAU1029384'}
                        value={op.containerNumber}
                        onChange={(e) => updateOperation(idx, { containerNumber: e.target.value.toUpperCase() })}
                        className={`${inputClass} font-mono uppercase font-bold`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Loại Container (ISO) *</label>
                      <select
                        value={op.containerIsoSize || '40HC'}
                        onChange={(e) => updateOperation(idx, { containerIsoSize: e.target.value })}
                        className={selectClass}
                      >
                        {CONTAINER_ISO_SIZES.map(sz => (
                          <option key={sz.value} value={sz.value}>{sz.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Số Niêm Chì (Seal) *</label>
                      <input
                        type="text"
                        placeholder="VD: SEAL-MSK-9901"
                        value={op.sealNumber || ''}
                        onChange={(e) => updateOperation(idx, { sealNumber: e.target.value.toUpperCase() })}
                        className={`${inputClass} font-mono`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Tổng Trọng Lượng (Kg)</label>
                      <input
                        type="number"
                        min={1000}
                        max={45000}
                        value={op.grossWeightKg || ''}
                        onChange={(e) => updateOperation(idx, { grossWeightKg: e.target.value ? Number(e.target.value) : 0 })}
                        className={`${inputClass} font-mono`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Phân Loại Hàng Hóa</label>
                      <select
                        value={op.cargoType}
                        onChange={(e) => updateOperation(idx, { cargoType: e.target.value })}
                        className={selectClass}
                      >
                        <option value="General">Hàng Bách Hóa</option>
                        <option value="Reefer">Hàng Đông Lạnh</option>
                        <option value="DangerousGoods">Hàng Nguy Hiểm (Cháy nổ / Hóa chất)</option>
                        <option value="Oversized">Hàng Quá Khổ Quá Tải</option>
                      </select>
                    </div>
                  </div>

                  {/* CONDITIONAL REFERENCES BY OPERATION TYPE */}
                  <div className="p-4 rounded-2xl bg-fog border border-chalk space-y-3">
                    <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider block">
                      Thông Tin Chứng Từ Tham Chiếu Theo Nghiệp Vụ
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {op.operationType === 'Export' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">Số Booking hoặc Mã Đăng Ký Hạ Container *</label>
                            <input
                              type="text"
                              placeholder="VD: BK-ONE-882910 hoặc REG-HA-0192"
                              value={op.carrierBookingNumber || ''}
                              onChange={(e) => updateOperation(idx, { carrierBookingNumber: e.target.value.toUpperCase() })}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">Tờ Khai Hải Quan Xuất Khẩu (Số tờ khai / Mã vạch / Thông quan)</label>
                            <input
                              type="text"
                              placeholder="VD: 304889201920 (Thông quan luồng xanh)"
                              value={op.customsDeclarationNumber || ''}
                              onChange={(e) => updateOperation(idx, { customsDeclarationNumber: e.target.value })}
                              className={inputClass}
                            />
                          </div>
                        </>
                      )}

                      {op.operationType === 'Import' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">Lệnh Giao Hàng Hãng Tàu (D/O hoặc eDO) *</label>
                            <input
                              type="text"
                              placeholder="VD: EDO-2026-9901"
                              value={op.deliveryOrderNumber || ''}
                              onChange={(e) => updateOperation(idx, { deliveryOrderNumber: e.target.value.toUpperCase() })}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">Thông Tin Vận Đơn (B/L) - Tra Cứu Lô Hàng *</label>
                            <input
                              type="text"
                              placeholder="VD: BL-MSCU-908129"
                              value={op.billOfLadingNumber || ''}
                              onChange={(e) => updateOperation(idx, { billOfLadingNumber: e.target.value.toUpperCase() })}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">Tờ Khai Hải Quan Nhập Khẩu (Trạng thái thông quan / Điều kiện) *</label>
                            <input
                              type="text"
                              placeholder="VD: 104928192039 (Đã thông quan)"
                              value={op.customsDeclarationNumber || ''}
                              onChange={(e) => updateOperation(idx, { customsDeclarationNumber: e.target.value })}
                              className={inputClass}
                            />
                          </div>
                        </>
                      )}

                      {/* Reefer specific */}
                      {op.cargoType === 'Reefer' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">Nhiệt Độ Cài Đặt (°C)</label>
                          <input
                            type="number"
                            step="0.5"
                            placeholder="-18"
                            value={op.temperatureSetPoint ?? -18}
                            onChange={(e) => updateOperation(idx, { temperatureSetPoint: Number(e.target.value) })}
                            className={inputClass}
                          />
                        </div>
                      )}

                      {/* Dangerous Goods specific */}
                      {op.cargoType === 'DangerousGoods' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">Phân Nhóm Nguy Hiểm (IMO)</label>
                            <input
                              type="text"
                              placeholder="VD: Nhóm 3 (Chất lỏng dễ cháy)"
                              value={op.dangerousGoodsClass || ''}
                              onChange={(e) => updateOperation(idx, { dangerousGoodsClass: e.target.value })}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-1">Mã Hiệu Nguy Hiểm (UN)</label>
                            <input
                              type="text"
                              placeholder="VD: UN1203"
                              value={op.unNumber || ''}
                              onChange={(e) => updateOperation(idx, { unNumber: e.target.value.toUpperCase() })}
                              className={inputClass}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* BỘ CHỨNG TỪ RIÊNG CHO TỪNG CONTAINER */}
                  <div className="space-y-4 pt-4 border-t border-chalk/80">
                    <div className="flex items-center gap-3 pb-2 border-b border-chalk/60">
                      <div className="w-9 h-9 rounded-2xl bg-orange-50 border border-orange-200 text-signal-orange flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-lg">folder_open</span>
                      </div>
                      <div>
                        <h5 className="font-heading font-extrabold text-carbon text-xs uppercase tracking-wider">
                          Chứng Từ Yêu Cầu Cho Nghiệp Vụ {getOperationLabelVi(op.operationType)}
                        </h5>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {op.operationType === 'Export'
                            ? 'Chỉ nộp các chứng từ phục vụ hàng xuất khẩu (Booking Note, VGM, Hải quan xuất)'
                            : 'Chỉ nộp các chứng từ phục vụ hàng nhập khẩu (Vận đơn B/L, Lệnh eDO, Hải quan nhập)'}
                        </p>
                      </div>
                    </div>

                    {/* Hidden native file input for this container */}
                    <input
                      type="file"
                      multiple
                      ref={el => (fileInputRefs.current[idx] = el)}
                      onChange={(e) => handleFileSelected(idx, e)}
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                      className="hidden"
                    />

                    {/* Upload progress indicator */}
                    {uploadingDoc.loading && uploadingDoc.opIndex === idx && (
                      <div className="p-3 rounded-xl border border-orange-200 bg-orange-50 flex items-center gap-2 text-xs font-bold text-amber-800 animate-pulse">
                        <span className="material-symbols-outlined text-base animate-spin text-signal-orange">sync</span>
                        <span>{uploadingDoc.progressMsg || 'Đang tải tệp lên máy chủ...'}</span>
                      </div>
                    )}

                    {/* DEDICATED REQUIRED DOCUMENT SLOTS FOR THIS CONTAINER */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {getContainerRequiredDocs(op).map((spec) => {
                        const matchingDocs = (op.documents || []).filter(d =>
                          d.documentType === spec.type ||
                          (spec.type === 'CarrierBookingReference' && d.documentType === 'BookingNote') ||
                          (spec.type === 'ReeferInstructions' && d.documentType === 'ReeferTemperatureInstructions')
                        )
                        const isUploaded = matchingDocs.length > 0

                        return (
                          <div
                            key={spec.type}
                            className={`p-3.5 rounded-2xl border transition-all space-y-2 flex flex-col justify-between ${
                              isUploaded
                                ? 'bg-emerald-50/30 border-emerald-200 shadow-2xs'
                                : spec.mandatory
                                ? 'bg-white border-amber-200/90 hover:border-signal-orange/60'
                                : 'bg-fog/40 border-chalk hover:border-slate-300'
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`material-symbols-outlined text-base ${isUploaded ? 'text-emerald-600' : 'text-slate-500'}`}>
                                    {spec.icon || 'description'}
                                  </span>
                                  <span className="text-xs font-bold text-carbon line-clamp-1" title={spec.title}>
                                    {spec.title}
                                  </span>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 ${
                                  isUploaded
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : spec.mandatory
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {isUploaded ? '✓ Đã có' : spec.mandatory ? 'Bắt buộc' : 'Khuyến nghị'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 line-clamp-2">
                                {spec.subtitle}
                              </p>
                            </div>

                            {/* Slot status / actions */}
                            <div className="pt-2 border-t border-chalk/60 space-y-1.5">
                              {isUploaded ? (
                                <div className="space-y-1">
                                  {matchingDocs.map((doc, mIdx) => {
                                    const isPdf = doc.fileName?.toLowerCase().endsWith('.pdf')
                                    const isImg = doc.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/)
                                    const originalDocIndex = op.documents.findIndex(d => d === doc)

                                    return (
                                      <div key={mIdx} className="flex items-center justify-between gap-1 p-1.5 rounded-xl bg-white border border-emerald-100 text-xs">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="material-symbols-outlined text-sm text-emerald-600 shrink-0">
                                            {isPdf ? 'picture_as_pdf' : isImg ? 'image' : 'task'}
                                          </span>
                                          <span className="font-semibold text-carbon truncate text-[11px]" title={doc.fileName}>
                                            {doc.fileName || doc.documentNumber}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          {(doc.fileUrl || doc.fileReference) && (
                                            <a
                                              href={doc.fileUrl || doc.fileReference}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="p-1 rounded-lg hover:bg-fog text-blue-600 transition-colors"
                                              title="Xem tệp"
                                            >
                                              <span className="material-symbols-outlined text-sm">open_in_new</span>
                                            </a>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => removeDocumentFromOp(idx, originalDocIndex >= 0 ? originalDocIndex : mIdx)}
                                            className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                            title="Xóa tệp này"
                                          >
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  })}
                                  <button
                                    type="button"
                                    onClick={() => triggerFileUpload(idx, spec.type)}
                                    className="w-full py-1 text-[10px] text-emerald-700 hover:text-emerald-900 font-bold text-center hover:underline cursor-pointer block"
                                  >
                                    + Tải thêm tệp cho mục này
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => triggerFileUpload(idx, spec.type)}
                                  className={`w-full py-1.5 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                                    spec.mandatory
                                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                                      : 'bg-white hover:bg-slate-50 text-slate-700 border border-chalk'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-xs">upload</span>
                                  <span>Tải lên tệp chứng từ</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* OTHER ADDITIONAL DOCUMENTS ATTACHED FOR THIS CONTAINER */}
                    {(() => {
                      const requiredTypes = new Set(getContainerRequiredDocs(op).flatMap(s => [s.type, s.type === 'CarrierBookingReference' ? 'BookingNote' : null, s.type === 'ReeferInstructions' ? 'ReeferTemperatureInstructions' : null].filter(Boolean)))
                      const otherDocs = (op.documents || []).filter(d => !requiredTypes.has(d.documentType))

                      if (otherDocs.length === 0) return null

                      return (
                        <div className="p-3.5 rounded-2xl bg-fog/70 border border-chalk space-y-2">
                          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider block">
                            Chứng từ bổ sung khác của container này ({otherDocs.length}):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {otherDocs.map((doc, oIdx) => {
                              const originalIndex = op.documents.findIndex(d => d === doc)
                              return (
                                <div key={oIdx} className="p-2.5 rounded-xl border border-chalk bg-white flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="material-symbols-outlined text-slate-500 text-base shrink-0">description</span>
                                    <div className="min-w-0">
                                      <span className="font-bold text-carbon truncate block text-[11px]">{doc.fileName}</span>
                                      <span className="text-[10px] text-slate-500">{getDocumentTypeLabelVi(doc.documentType)}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 ml-2">
                                    {(doc.fileUrl || doc.fileReference) && (
                                      <a
                                        href={doc.fileUrl || doc.fileReference}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 rounded-lg hover:bg-fog text-blue-600 transition-colors"
                                        title="Xem tệp"
                                      >
                                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => removeDocumentFromOp(idx, originalIndex >= 0 ? originalIndex : oIdx)}
                                      className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                      title="Xóa tệp này"
                                    >
                                      <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-chalk">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-chalk bg-white text-xs font-bold text-slate-700 hover:bg-fog transition-all"
              >
                Hủy Bỏ
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-signal-orange text-white text-xs font-bold hover:bg-orange-600 transition-all shadow-sm flex items-center gap-1.5"
              >
                <span>Tiếp tục: Chọn Xe & Khung Giờ</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </>
        )}

        {/* STEP 2: FLEET & SCHEDULE */}
        {step === 2 && (
          <div className="space-y-6">
            {/* FLEET ASSIGNMENT: TRACTOR, TRAILER, DRIVER */}
            <div className="bg-white border border-chalk rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 pb-3 border-b border-chalk">
                <span className="material-symbols-outlined text-signal-orange text-lg">local_shipping</span>
                <h4 className="text-xs font-extrabold uppercase text-carbon tracking-wider">
                  Thông Tin Phương Tiện: Xe Đầu Kéo, Rơ-moóc & Tài Xế
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Biển Số Xe Đầu Kéo *</label>
                  <select
                    required
                    value={form.truckId}
                    onChange={(e) => {
                      const tId = e.target.value
                      const truck = fleet.trucks.find(t => t.id === tId)
                      setForm(prev => ({ ...prev, truckId: tId, ...(truck?.driverId ? { driverId: truck.driverId } : {}) }))
                    }}
                    className={selectClass}
                  >
                    <option value="">-- Chọn xe đầu kéo từ đội xe --</option>
                    {fleet.trucks.map(truck => (
                      <option key={truck.id} value={truck.id}>
                        {truck.plateNumber} (Tải tối đa: {truck.maxPayloadTon || 30}T) - {truck.status === 'Active' || !truck.status ? 'Sẵn sàng' : truck.status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Biển Số Rơ-moóc (Moóc kéo) *</label>
                  <input
                    required
                    type="text"
                    placeholder="VD: 43R-089.21"
                    value={form.trailerNumber}
                    onChange={(e) => setForm(prev => ({ ...prev, trailerNumber: e.target.value.toUpperCase() }))}
                    className={`${inputClass} font-mono uppercase font-bold`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Tài Xế Phụ Trách *</label>
                  <select
                    required
                    value={form.driverId}
                    onChange={(e) => setForm(prev => ({ ...prev, driverId: e.target.value }))}
                    className={selectClass}
                  >
                    <option value="">-- Chọn tài xế điều khiển --</option>
                    {fleet.drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>
                        {driver.fullName} ({driver.phoneNumber || driver.licenseNumber || 'Hạng FC'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* APPOINTMENT SCHEDULE & GATE APPOINTMENT CODE */}
            <div className="bg-white border border-chalk rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-chalk">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-signal-orange text-lg">calendar_month</span>
                  <h4 className="text-xs font-extrabold uppercase text-carbon tracking-wider">
                    Thông Tin Lịch Hẹn Cổng (Hệ Thống Đặt Lịch Cảng TOS)
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500">Mã Lịch Hẹn:</span>
                  <span className="px-2.5 py-1 rounded-xl bg-orange-50 border border-orange-200 text-signal-orange font-mono font-bold text-xs">
                    {form.bookingCode}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Ngày Hẹn Cổng *</label>
                  <input
                    required
                    type="date"
                    value={form.appointmentDate}
                    onChange={(e) => setForm(prev => ({ ...prev, appointmentDate: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Giờ Bắt Đầu Khung Hẹn *</label>
                  <input
                    required
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Giờ Kết Thúc Khung Hẹn *</label>
                  <input
                    required
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm(prev => ({ ...prev, endTime: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-teal-50/60 border border-teal-200 flex items-center gap-3 text-xs text-teal-900">
                <span className="material-symbols-outlined text-teal-600 text-lg shrink-0">speed</span>
                <div>
                  <strong>Cổng Tự Động Smart Gate:</strong> Xe đến đúng khung giờ hẹn được ưu tiên qua làn tự động ANPR mà không phải chờ làm thủ tục giấy tờ tại trạm gác.
                </div>
              </div>
            </div>

            {/* REEFER MONITORING OPTION */}
            <div className="bg-white border border-chalk rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-chalk">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sky-600 text-lg">ac_unit</span>
                  <h4 className="text-xs font-extrabold uppercase text-carbon tracking-wider">
                    Dịch Vụ Cấp Điện Kho Lạnh Cảng
                  </h4>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isReeferPowerRequired}
                    onChange={(e) => setForm(prev => ({ ...prev, isReeferPowerRequired: e.target.checked }))}
                    className="w-4 h-4 rounded text-signal-orange focus:ring-signal-orange"
                  />
                  <span className="text-xs font-bold text-carbon">Yêu cầu cấp điện 380V tại bãi</span>
                </label>
              </div>

              {form.isReeferPowerRequired && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Nhiệt Độ Mục Tiêu (°C)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={form.targetTemperature}
                      onChange={(e) => setForm(prev => ({ ...prev, targetTemperature: Number(e.target.value) }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Dung Sai Cho Phép (±°C)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={form.tempTolerance}
                      onChange={(e) => setForm(prev => ({ ...prev, tempTolerance: Number(e.target.value) }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Cây Cắm Điện Đề Xuất</label>
                    <select
                      value={form.reeferPlugId}
                      onChange={(e) => setForm(prev => ({ ...prev, reeferPlugId: e.target.value }))}
                      className={selectClass}
                    >
                      <option value="">Tự động phân bổ tại Kho Lạnh</option>
                      {availablePlugs.map(plug => (
                        <option key={plug.id} value={plug.id}>{plug.plug_code || plug.plugCode}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* PORT TARIFF & DELIVERY CONDITIONS CONFIRMATION */}
            <div className="bg-white border border-chalk rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 pb-3 border-b border-chalk">
                <span className="material-symbols-outlined text-signal-orange text-lg">receipt</span>
                <h4 className="text-xs font-extrabold uppercase text-carbon tracking-wider">
                  Xác Nhận Cước Phí Dịch Vụ Cảng (TOS) & Điều Kiện Giao Nhận
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-fog border border-chalk">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cước Nâng / Hạ Bãi Cont</span>
                  <p className="text-sm font-extrabold text-carbon mt-1">380,000 VNĐ / cont</p>
                  <span className="text-[10px] text-emerald-600 font-semibold">Tích hợp hóa đơn điện tử e-Invoice</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-fog border border-chalk">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cân Điện Tử & Kiểm Soát</span>
                  <p className="text-sm font-extrabold text-emerald-600 mt-1">Miễn Phí (0 VNĐ)</p>
                  <span className="text-[10px] text-slate-500 font-semibold">Tự động cân tại làn Smart Gate</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-fog border border-chalk">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Giám Sát Hải Quan Điện Tử</span>
                  <p className="text-sm font-extrabold text-carbon mt-1">Liên thông HQ</p>
                  <span className="text-[10px] text-teal-600 font-semibold">Đối soát dữ liệu tờ khai tự động</span>
                </div>
              </div>

              <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={form.feeTermsAgreed}
                  onChange={(e) => setForm(prev => ({ ...prev, feeTermsAgreed: e.target.checked }))}
                  className="w-4 h-4 mt-0.5 rounded text-signal-orange focus:ring-signal-orange"
                />
                <div className="text-xs text-slate-700 leading-relaxed">
                  <span className="font-extrabold text-carbon block mb-0.5">Xác nhận biểu cước & điều kiện giao nhận hàng hóa tại cảng</span>
                  Tôi xác nhận các thông tin khai báo (số container, niêm chì seal, thông tin phương tiện/tài xế, tờ khai hải quan, số booking/lệnh giao hàng) là hoàn toàn chính xác; cam kết tuân thủ biểu cước dịch vụ và quy chuẩn an toàn giao nhận tại Cảng Đà Nẵng (NexusPort).
                </div>
              </label>
            </div>

            {/* BUTTONS */}
            <div className="flex justify-between items-center pt-4 border-t border-chalk">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-2.5 rounded-xl border border-chalk bg-white text-xs font-bold text-slate-700 hover:bg-fog transition-all"
              >
                ← Quay lại Chỉnh sửa Container
              </button>

              <button
                type="submit"
                disabled={busy}
                className="px-8 py-3 rounded-xl bg-signal-orange text-white text-xs font-bold hover:bg-orange-600 disabled:opacity-50 transition-all shadow-md shadow-orange-500/20 flex items-center gap-2 cursor-pointer"
              >
                {busy ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Đang Xử Lý Gửi Hồ Sơ...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">verified</span>
                    <span>Hoàn Tất & Gửi Lịch Hẹn Đặt Chỗ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
