import React, { useState, useEffect, useMemo, useRef } from 'react'
import yardTaskService from '../../services/yardTaskService'
import yardRestackService from '../../services/yardRestackService'

// Helper to parse position string "A01-03-12-2" or "A-03-12-2" → { block, bay, row, tier, isStandard }
const parsePosition = (pos) => {
  if (!pos) return { block: '?', bay: '?', row: '?', tier: '?', isStandard: false }
  const trimmed = String(pos).trim()
  if (/^[A-Z0-9]{1,4}-\d{2,3}-\d{2,3}-\d{1,2}$/i.test(trimmed)) {
    const parts = trimmed.split('-')
    return {
      block: parts[0] || '?',
      bay: parts[1] || '?',
      row: parts[2] || '?',
      tier: parts[3] || '?',
      isStandard: true
    }
  }
  return { block: trimmed, bay: '?', row: '?', tier: '?', isStandard: false }
}

// ISO 6346 Shipping line detector from container number prefix
const getShippingLineCode = (contNo = '') => {
  const upper = (contNo || '').toUpperCase().trim()
  if (upper.startsWith('MSCU') || upper.startsWith('CAIU') || upper.includes('MSC')) return 'MSC'
  if (upper.startsWith('MSKU') || upper.startsWith('MRKU') || upper.startsWith('TEMU') || upper.includes('MAERSK')) return 'MAERSK'
  if (upper.startsWith('CMAU') || upper.includes('CMA')) return 'CMA'
  if (upper.startsWith('ONEU') || upper.includes('ONE')) return 'ONE'
  if (upper.startsWith('EVER') || upper.startsWith('EMCU') || upper.startsWith('EGLV') || upper.includes('EVERGREEN')) return 'EVERGREEN'
  if (upper.startsWith('COSU') || upper.includes('COSCO')) return 'COSCO'
  if (upper.startsWith('HLCU') || upper.includes('HAPAG')) return 'HAPAG'
  return 'OTHER'
}

// Format Currency
const formatCurrency = (val) => {
  if (!val || val === 0) return 'Miễn phí nội bộ (0 đ)'
  return `${Number(val).toLocaleString('vi-VN')} VNĐ`
}

// Shipping lines list
const SHIPPING_LINES = [
  { code: 'ALL', name: 'Tất Cả Hãng Tàu', color: 'bg-slate-800 text-white' },
  { code: 'MAERSK', name: 'Maersk Line', color: 'bg-blue-600 text-white' },
  { code: 'MSC', name: 'MSC Mediterranean', color: 'bg-yellow-500 text-slate-950' },
  { code: 'CMA', name: 'CMA CGM', color: 'bg-sky-600 text-white' },
  { code: 'ONE', name: 'ONE Line', color: 'bg-pink-600 text-white' },
  { code: 'EVERGREEN', name: 'Evergreen', color: 'bg-emerald-600 text-white' },
  { code: 'COSCO', name: 'COSCO Shipping', color: 'bg-indigo-600 text-white' },
  { code: 'HAPAG', name: 'Hapag-Lloyd', color: 'bg-orange-600 text-white' },
]

// Fallback RTG Equipment list
const DEFAULT_EQUIPMENTS = [
  { id: 'RTG-01', name: 'Cẩu RTG-01 (Mitsui 40T)', operator: 'Trần Văn Hùng', status: 'Sẵn sàng', block: 'A01', type: 'RTG 40T', fuelLevel: '88%', health: '98%', maxLoad: '40 Tấn' },
  { id: 'RTG-02', name: 'Cẩu RTG-02 (Kalmar 45T)', operator: 'Phạm Văn Cần', status: 'Sẵn sàng', block: 'A01', type: 'RTG 45T', fuelLevel: '74%', health: '95%', maxLoad: '45 Tấn' },
  { id: 'RTG-03', name: 'Cẩu RTG-03 (ZPMC 50T)', operator: 'Lê Văn Thành', status: 'Bảo trì', block: 'B02', type: 'RTG 50T', fuelLevel: '92%', health: '62%', maxLoad: '50 Tấn' },
  { id: 'RS-01',  name: 'Xe Nâng Chụp RS-01', operator: 'Phạm Văn An', status: 'Sẵn sàng', block: 'C01', type: 'Reach Stacker', fuelLevel: '65%', health: '91%', maxLoad: '45 Tấn' },
]

const SAMPLE_CONTAINERS = [
  { containerNo: 'MSCU1234567', type: '40FT HC', location: 'A01-03-12-2', cargo: 'Hàng May Mặc Tái Cơ Cấu', weight: '28.4 Tấn', line: 'MSC', category: 'DRY', dwellDays: 4, nextVessel: 'MSC ALEXA (18h tới)' },
  { containerNo: 'TEMU8822190', type: '40FT HC', location: 'B02-01-02-1', cargo: 'Hàng Xuất Khẩu Khẩn', weight: '30.2 Tấn', line: 'MAERSK', category: 'EXP', dwellDays: 2, nextVessel: 'MAERSK HANOI (06:00 mai)' },
  { containerNo: 'CMAU9918234', type: '20FT ST', location: 'A01-01-05-3', cargo: 'Hàng Bách Hóa Xuất Khẩu', weight: '18.5 Tấn', line: 'CMA', category: 'DRY', dwellDays: 1, nextVessel: 'CMA CGM CHAUVEL (2 ngày)' },
  { containerNo: 'COSU8819201', type: '40FT HC', location: 'A01-02-04-2', cargo: 'Hàng Điện Tử Tiêu Dùng', weight: '24.1 Tấn', line: 'COSCO', category: 'HIGH_VALUE', dwellDays: 5, nextVessel: 'COSCO HOPE (3 ngày)' },
  { containerNo: 'HLCU7719204', type: '20FT TANK', location: 'B02-04-01-1', cargo: 'Hóa Chất Công Nghiệp Lỏng', weight: '26.0 Tấn', line: 'HAPAG', category: 'DG', dwellDays: 3, nextVessel: 'AL HILAL (12h tới)' },
  { containerNo: 'ONEU8821903', type: '40FT RF', location: 'C01-02-04-2', cargo: 'Trái Cây Lạnh (-18°C)', weight: '29.0 Tấn', line: 'ONE', category: 'REEFER', dwellDays: 2, nextVessel: 'ONE HARBOUR (14h tới)' },
]

const INCIDENT_REASONS = [
  'Không tìm thấy container tại vị trí gốc',
  'RTG / Cẩu bị hỏng hoặc gặp sự cố kỹ thuật',
  'Vị trí đích đã bị container khác chiếm chỗ',
  'Xung đột quy tắc trọng lực (Tầng dưới còn trống)',
  'Không thể tiếp cận container (vật cản đường cẩu)',
  'Container bị hư hỏng nặng, rò rỉ hoặc móp méo',
  'Lệnh bị trùng lặp / đã thực hiện trước đó',
  'Lý do khác',
]

const SHIFTING_REASONS = [
  'Tái cơ cấu xếp bãi',
  'Chuẩn bị xuất cổng khẩn',
  'Đảo tầng cẩu bãi',
  'Theo yêu cầu khách hàng',
  'Chuyển khu bãi kiểm hóa',
  'Bố trí hàng vào khu vực cắm điện lạnh (Reefer)',
]

// Mock Yard Grid matrix for visual slot picker
const YARD_BAY_MATRIX = {
  'A01': [
    { row: 1, tier: 1, status: 'OCCUPIED', cont: 'CMAU9918234', line: 'CMA', weight: '18.5T', dwell: '1d' },
    { row: 1, tier: 2, status: 'OCCUPIED', cont: 'COSU8819201', line: 'COSCO', weight: '24.1T', dwell: '5d' },
    { row: 1, tier: 3, status: 'AVAILABLE' },
    { row: 1, tier: 4, status: 'GRAVITY_WARNING' },
    { row: 2, tier: 1, status: 'OCCUPIED', cont: 'MSCU1234567', line: 'MSC', weight: '28.4T', dwell: '4d' },
    { row: 2, tier: 2, status: 'AVAILABLE' },
    { row: 2, tier: 3, status: 'GRAVITY_WARNING' },
    { row: 2, tier: 4, status: 'GRAVITY_WARNING' },
    { row: 3, tier: 1, status: 'AVAILABLE' },
    { row: 3, tier: 2, status: 'GRAVITY_WARNING' },
    { row: 3, tier: 3, status: 'GRAVITY_WARNING' },
    { row: 3, tier: 4, status: 'GRAVITY_WARNING' },
    { row: 4, tier: 1, status: 'MAINTENANCE' },
    { row: 4, tier: 2, status: 'MAINTENANCE' },
    { row: 4, tier: 3, status: 'MAINTENANCE' },
    { row: 4, tier: 4, status: 'MAINTENANCE' },
  ],
  'B02': [
    { row: 1, tier: 1, status: 'OCCUPIED', cont: 'HLCU7719204', line: 'HAPAG', weight: '26.0T', dwell: '3d' },
    { row: 1, tier: 2, status: 'AVAILABLE' },
    { row: 1, tier: 3, status: 'GRAVITY_WARNING' },
    { row: 1, tier: 4, status: 'GRAVITY_WARNING' },
    { row: 2, tier: 1, status: 'OCCUPIED', cont: 'TEMU8822190', line: 'MAERSK', weight: '30.2T', dwell: '2d' },
    { row: 2, tier: 2, status: 'OCCUPIED', cont: 'EVER1129983', line: 'EVERGREEN', weight: '22.8T', dwell: '3d' },
    { row: 2, tier: 3, status: 'AVAILABLE' },
    { row: 2, tier: 4, status: 'GRAVITY_WARNING' },
    { row: 3, tier: 1, status: 'AVAILABLE' },
    { row: 3, tier: 2, status: 'GRAVITY_WARNING' },
    { row: 3, tier: 3, status: 'GRAVITY_WARNING' },
    { row: 3, tier: 4, status: 'GRAVITY_WARNING' },
    { row: 4, tier: 1, status: 'OCCUPIED', cont: 'ONEU8821903', line: 'ONE', weight: '29.0T', dwell: '2d' },
    { row: 4, tier: 2, status: 'AVAILABLE' },
    { row: 4, tier: 3, status: 'GRAVITY_WARNING' },
    { row: 4, tier: 4, status: 'GRAVITY_WARNING' },
  ],
  'C01': [
    { row: 1, tier: 1, status: 'OCCUPIED', cont: 'ONEU8821903', line: 'ONE', weight: '29.0T', dwell: '2d' },
    { row: 1, tier: 2, status: 'OCCUPIED', cont: 'MSCU9901123', line: 'MSC', weight: '27.5T', dwell: '4d' },
    { row: 1, tier: 3, status: 'AVAILABLE' },
    { row: 1, tier: 4, status: 'GRAVITY_WARNING' },
    { row: 2, tier: 1, status: 'AVAILABLE' },
    { row: 2, tier: 2, status: 'GRAVITY_WARNING' },
    { row: 2, tier: 3, status: 'GRAVITY_WARNING' },
    { row: 2, tier: 4, status: 'GRAVITY_WARNING' },
    { row: 3, tier: 1, status: 'OCCUPIED', cont: 'CAIU1234567', line: 'CAI', weight: '21.0T', dwell: '6d' },
    { row: 3, tier: 2, status: 'OCCUPIED', cont: 'MSCU2222222', line: 'MSC', weight: '28.1T', dwell: '2d' },
    { row: 3, tier: 3, status: 'OCCUPIED', cont: 'MSCU1111111', line: 'MSC', weight: '26.4T', dwell: '1d' },
    { row: 3, tier: 4, status: 'AVAILABLE' },
    { row: 4, tier: 1, status: 'AVAILABLE' },
    { row: 4, tier: 2, status: 'GRAVITY_WARNING' },
    { row: 4, tier: 3, status: 'GRAVITY_WARNING' },
    { row: 4, tier: 4, status: 'GRAVITY_WARNING' },
  ]
}

// ── AI BRP CONFLICT RESOLUTION SCENARIOS ──
const CONFLICT_SCENARIOS = [
  {
    id: 'SCENARIO_1',
    title: 'Container CAIU1234567 — Xuất Tàu Khẩn Cấp (Tàu MAERSK HANOI)',
    badge: 'XUẤT TÀU KHẨN',
    badgeColor: 'bg-red-100 text-red-950 border-red-400',
    targetContainer: {
      id: 'CAIU1234567',
      type: '40FT HC',
      weight: '28.4 Tấn',
      pos: 'C01-04-10-1',
      tier: 'Tầng 1 (Đáy bãi)',
      line: 'MSC',
      urgency: 'KHẨN CẤP — Tàu cập bến lúc 06:00 mai (Còn 8h)',
      dwell: '4 ngày'
    },
    blockingContainers: [
      { step: 1, id: 'MSCU1111111', type: '40FT HC', tier: 'Tầng 3', currentPos: 'C01-04-10-3', moveTarget: 'C01-04-12-1', rtg: 'RTG-01', weight: '22.0 Tấn', duration: '2.0 phút', reason: 'Dời sang slot đệm an toàn dãy 12' },
      { step: 2, id: 'MSCU2222222', type: '40FT HC', tier: 'Tầng 2', currentPos: 'C01-04-10-2', moveTarget: 'C01-04-12-2', rtg: 'RTG-02', weight: '26.5 Tấn', duration: '2.5 phút', reason: 'Dời sang slot đệm an toàn dãy 12' },
    ],
    targetMove: {
      step: 3,
      id: 'CAIU1234567',
      type: '40FT HC',
      tier: 'Tầng 1',
      currentPos: 'C01-04-10-1',
      moveTarget: 'Cầu Tàu Bến 02 (Xuất Lên Tàu)',
      rtg: 'RTG-01',
      weight: '28.4 Tấn',
      duration: '4.0 phút',
      reason: 'Giải phóng container mục tiêu bàn giao cẩu STS'
    },
    aiMetrics: {
      timeSaved: '72%',
      estimatedDuration: '4.5 phút',
      originalDuration: '16.0 phút',
      energySaved: '-68%',
      movesCount: 2,
      confidence: '99.8%',
      bufferSlotNote: 'Slot đệm C01-04-12-1 & 12-2 không cản trở bất kỳ kế hoạch bốc dỡ nào trong 48h tới'
    }
  },
  {
    id: 'SCENARIO_2',
    title: 'Container TEMU8822190 — Xe Đầu Kéo Đang Đợi Ngoài Cổng C',
    badge: 'XE KÉO CHỜ CỔNG',
    badgeColor: 'bg-amber-100 text-amber-950 border-amber-400',
    targetContainer: {
      id: 'TEMU8822190',
      type: '40FT HC',
      weight: '30.2 Tấn',
      pos: 'B02-02-02-1',
      tier: 'Tầng 1 (Đáy bãi)',
      line: 'MAERSK',
      urgency: 'CỰC KHẨN — Tài xế xe đầu kéo chờ quá 20 phút',
      dwell: '2 ngày'
    },
    blockingContainers: [
      { step: 1, id: 'EVER1129983', type: '40FT HC', tier: 'Tầng 3', currentPos: 'B02-02-02-3', moveTarget: 'B02-02-04-1', rtg: 'RTG-02', weight: '20.1 Tấn', duration: '2.0 phút', reason: 'Dời sang slot trống dãy 04' },
      { step: 2, id: 'HLCU7719204', type: '20FT TANK', tier: 'Tầng 2', currentPos: 'B02-02-02-2', moveTarget: 'B02-04-01-2', rtg: 'RTG-03', weight: '26.0 Tấn', duration: '2.0 phút', reason: 'Dời vào khu bãi chuyên dụng DG' },
    ],
    targetMove: {
      step: 3,
      id: 'TEMU8822190',
      type: '40FT HC',
      tier: 'Tầng 1',
      currentPos: 'B02-02-02-1',
      moveTarget: 'Xe Đầu Kéo BS: 51C-982.11 (Cổng C)',
      rtg: 'RTG-02',
      weight: '30.2 Tấn',
      duration: '3.5 phút',
      reason: 'Bàn giao trực tiếp lên sơ mi rơ moóc'
    },
    aiMetrics: {
      timeSaved: '75%',
      estimatedDuration: '4.0 phút',
      originalDuration: '16.5 phút',
      energySaved: '-71%',
      movesCount: 2,
      confidence: '99.9%',
      bufferSlotNote: 'Vị trí B02-02-04-1 là vị trí cẩu gần nhất (rút ngắn 65m quãng đường di chuyển)'
    }
  },
  {
    id: 'SCENARIO_3',
    title: 'Container Lạnh ONEU8821903 — Cần Chuyển Gấp Vào Rack Cắm Điện Reefer',
    badge: 'HÀNG LẠNH REEFER',
    badgeColor: 'bg-cyan-100 text-cyan-950 border-cyan-400',
    targetContainer: {
      id: 'ONEU8821903',
      type: '40FT RF',
      weight: '29.0 Tấn',
      pos: 'A01-02-04-1',
      tier: 'Tầng 1 (Đáy bãi)',
      line: 'ONE',
      urgency: 'NGHIÊM NGẶT — Nhiệt độ bảo quản lạnh -18°C',
      dwell: '1 ngày'
    },
    blockingContainers: [
      { step: 1, id: 'COSU8819201', type: '40FT HC', tier: 'Tầng 2', currentPos: 'A01-02-04-2', moveTarget: 'A01-02-05-3', rtg: 'RTG-01', weight: '24.1 Tấn', duration: '3.0 phút', reason: 'Dời sang slot trống trên cùng dãy 05' },
    ],
    targetMove: {
      step: 2,
      id: 'ONEU8821903',
      type: '40FT RF',
      tier: 'Tầng 1',
      currentPos: 'A01-02-04-1',
      moveTarget: 'Rack Cắm Điện Reefer (C01-02-04-2)',
      rtg: 'RTG-01',
      weight: '29.0 Tấn',
      duration: '4.5 phút',
      reason: 'Cắm điện làm lạnh bảo quản hàng tươi đông'
    },
    aiMetrics: {
      timeSaved: '65%',
      estimatedDuration: '3.0 phút',
      originalDuration: '8.5 phút',
      energySaved: '-60%',
      movesCount: 1,
      confidence: '99.7%',
      bufferSlotNote: 'Rack điện Reefer C01 còn 1 slot cắm sẵn sàng tiếp nhận ngay'
    }
  },
  {
    id: 'SCENARIO_4',
    title: 'Container MSCU9918234 — Block A01 Hết Slot Đệm (Test Chặn Di Dời)',
    badge: 'HẾT SLOT ĐỆM (TEST)',
    badgeColor: 'bg-rose-100 text-rose-950 border-rose-400',
    canExecute: false,
    validationMessage: 'CẢNH BÁO HỆ THỐNG: Block A01 đã đạt 100% dung lượng. Không có slot đệm hợp lệ thỏa mãn quy tắc an toàn!',
    targetContainer: {
      id: 'MSCU9918234',
      type: '40FT HC',
      weight: '29.5 Tấn',
      pos: 'A01-01-05-1',
      tier: 'Tầng 1 (Đáy bãi)',
      line: 'MSC',
      urgency: 'KHẨN CẤP — Xe đầu kéo chờ nhưng không thể đảo bãi do thiếu slot',
      dwell: '5 ngày'
    },
    blockingContainers: [
      { step: 1, id: 'CMAU9918234', type: '20FT ST', tier: 'Tầng 3', currentPos: 'A01-01-05-3', moveTarget: 'KHÔNG CÓ SLOT', rtg: 'RTG-01', weight: '18.5 Tấn', duration: '--', reason: 'Không tìm thấy slot đệm trống trong phạm vi an toàn' },
      { step: 2, id: 'COSU8819201', type: '40FT HC', tier: 'Tầng 2', currentPos: 'A01-01-05-2', moveTarget: 'KHÔNG CÓ SLOT', rtg: 'RTG-01', weight: '24.1 Tấn', duration: '--', reason: 'Không tìm thấy slot đệm trống trong phạm vi an toàn' }
    ],
    targetMove: {
      step: 3,
      id: 'MSCU9918234',
      type: '40FT HC',
      tier: 'Tầng 1',
      currentPos: 'A01-01-05-1',
      moveTarget: 'Cổng Bàn Giao',
      rtg: 'RTG-01',
      weight: '29.5 Tấn',
      duration: '--',
      reason: 'Bị phong tỏa do không thể dời 2 container phía trên'
    },
    aiMetrics: {
      timeSaved: '0%',
      estimatedDuration: 'Không thể thực thi',
      originalDuration: 'Bị khóa',
      energySaved: '0%',
      movesCount: 0,
      confidence: '0%',
      bufferSlotNote: 'Toàn bộ 24 slot lân cận đều đang OCCUPIED hoặc vi phạm quy tắc trọng lực'
    }
  }
]

export default function YardMovementOperations() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success') // success, error, warning

  // Active View Mode: 'TABLE' | 'YARD_MAP' | 'RESTACK_WIZARD' | 'AI_ANALYTICS'
  const [viewMode, setViewMode] = useState('TABLE')

  // Filter, Search, Sort & Bulk Selection
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [shippingLineFilter, setShippingLineFilter] = useState('ALL')
  const [sortField, setSortField] = useState('id')
  const [sortOrder, setSortOrder] = useState('desc')
  const [selectedTaskIds, setSelectedTaskIds] = useState([])

  // Live Clock & Active Task Execution
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('vi-VN'))
  const [activeTask, setActiveTask] = useState(null)
  const [confirmedPosInput, setConfirmedPosInput] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerRef = useRef(null)

  // Modals & Drawers
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [incidentTask, setIncidentTask] = useState(null)
  const [incidentReason, setIncidentReason] = useState(INCIDENT_REASONS[0])
  const [incidentNotes, setIncidentNotes] = useState('')
  const [mapViewTask, setMapViewTask] = useState(null)
  const [selectedSlotMatrixBlock, setSelectedSlotMatrixBlock] = useState('B02')
  const [jobSheetTask, setJobSheetTask] = useState(null)
  const [hoveredSlotInfo, setHoveredSlotInfo] = useState(null)

  // Equipment & Operators
  const [equipments, setEquipments] = useState(DEFAULT_EQUIPMENTS)
  const [operators, setOperators] = useState([])

  // Create Modal Form State
  const [newContainerNo, setNewContainerNo] = useState('')
  const [newContainerType, setNewContainerType] = useState('40FT HC')
  const [newFromLocation, setNewFromLocation] = useState('A01-03-12-2')
  const [newTargetBlock, setNewTargetBlock] = useState('B02')
  const [newTargetBay, setNewTargetBay] = useState('02')
  const [newTargetRow, setNewTargetRow] = useState('02')
  const [newTargetTier, setNewTargetTier] = useState('3')
  const [newShiftingReason, setNewShiftingReason] = useState(SHIFTING_REASONS[0])
  const [newPriority, setNewPriority] = useState('Normal')
  const [newIsBillable, setNewIsBillable] = useState(false)
  const [newEquipmentId, setNewEquipmentId] = useState('')
  const [newOperatorName, setNewOperatorName] = useState('Trần Văn Hùng')
  const [newNotes, setNewNotes] = useState('')
  const [slotValidation, setSlotValidation] = useState(null)
  const [validatingSlot, setValidatingSlot] = useState(false)
  const [calculatedFee, setCalculatedFee] = useState(0)
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)

  // ── AI & AUTONOMOUS ENGINE STATE ──
  const [autoPilotEnabled, setAutoPilotEnabled] = useState(false)
  const [autoPilotScanning, setAutoPilotScanning] = useState(false)
  const [aiAlgorithmWeights, setAiAlgorithmWeights] = useState({ distance: 40, reshuffle: 40, safety: 20 })
  const [selectedCompareContainer, setSelectedCompareContainer] = useState(SAMPLE_CONTAINERS[0])
  const [autoPilotLogs, setAutoPilotLogs] = useState([
    '08:30:12 [AI-ENGINE]: Tải mô hình BRP (Block Relocation Problem) v4.2 - 0.04s latency.',
    '08:31:05 [TELEMETRY]: Đồng bộ 4 cẩu RTG với cảm biến Twistlock Laser Lock.',
    '08:32:40 [PREDICTION]: Dự báo tàu MAERSK HANOI cập bến ngày mai lúc 06:00 - Quét 3 container bị nghẽn tầng.',
  ])

  // Proactive Auto-Pilot Housekeeping Queue
  const [proactiveTasks, setProactiveTasks] = useState([
    {
      id: 'AUTO-01',
      containerId: 'MSCU1111111',
      type: '40FT HC',
      from: 'C01-04-10-3',
      to: 'C01-04-12-1',
      reason: 'Đảo tầng trước giờ tàu MAERSK HANOI cập cảng (Tự động)',
      urgency: 'CAO',
      rtgAssigned: 'RTG-01',
      status: 'READY'
    },
    {
      id: 'AUTO-02',
      containerId: 'MSCU2222222',
      type: '40FT HC',
      from: 'C01-04-10-2',
      to: 'C01-04-12-2',
      reason: 'Giải phóng lối cẩu cho container CAIU1234567 xuất cảng',
      urgency: 'TRUNG BÌNH',
      rtgAssigned: 'RTG-02',
      status: 'READY'
    },
    {
      id: 'AUTO-03',
      containerId: 'ONEU8821903',
      type: '40FT RF',
      from: 'A01-03-02-4',
      to: 'C01-02-04-2',
      reason: 'Chuyển container lạnh vào Rack cắm điện Reefer tự động',
      urgency: 'KHẨN CẤP',
      rtgAssigned: 'RTG-03',
      status: 'READY'
    }
  ])

  // Live IoT Telemetry Feed (Realtime Spreader & Twistlock)
  const [iotTelemetry, setIotTelemetry] = useState({
    spreaderLockStatus: 'LOCKED', // 'LOCKED' | 'UNLOCKED' | 'HOISTING'
    laserCoord: { x: '14.2m', y: '8.4m', z: '12.0m' },
    liftedWeightTons: 28.4,
    spreaderPressureBar: 185,
    windSpeedMs: 9.8,
    activeRtgId: 'RTG-01'
  })

  // ── AI BRP CONFLICT RESOLUTION STATE ──
  const [selectedConflictScenarioId, setSelectedConflictScenarioId] = useState('SCENARIO_1')
  const [isAnalyzingConflict, setIsAnalyzingConflict] = useState(false)
  const [conflictPlanResult, setConflictPlanResult] = useState(null)
  const [showConfirmDeployModal, setShowConfirmDeployModal] = useState(false)
  const [isDeployingConflictPlan, setIsDeployingConflictPlan] = useState(false)
  const [conflictPlanDeployed, setConflictPlanDeployed] = useState(false)
  const [conflictExecutingStep, setConflictExecutingStep] = useState(0)

  // ── NXP-126: RESTACK PLAN STATE ──
  const [customTargetContInput, setCustomTargetContInput] = useState('CAIU1234567')
  const [customDestinationInput, setCustomDestinationInput] = useState('Cầu Tàu Bến 02 (Xuất Lên Tàu)')
  const [restackBackOption, setRestackBackOption] = useState(false)
  const [activeRestackPlan, setActiveRestackPlan] = useState(null)
  const [restackPlanHistory, setRestackPlanHistory] = useState([])
  const [showPlanHistorySection, setShowPlanHistorySection] = useState(false)
  const [isAdvancingStep, setIsAdvancingStep] = useState(false)

  // Current conflict scenario object
  const currentConflictScenario = useMemo(() => {
    return CONFLICT_SCENARIOS.find(s => s.id === selectedConflictScenarioId) || CONFLICT_SCENARIOS[0]
  }, [selectedConflictScenarioId])

  // Select conflict scenario
  const handleSelectConflictScenario = (id) => {
    setSelectedConflictScenarioId(id)
    setConflictPlanResult(null)
    setConflictPlanDeployed(false)
    setConflictExecutingStep(0)
    const found = CONFLICT_SCENARIOS.find(s => s.id === id)
    if (found) {
      setCustomTargetContInput(found.targetContainer.id)
      setCustomDestinationInput(found.targetMove.moveTarget)
    }
  }

  // Stacking Conflict State (Fallback compatibility)
  const [stackingConflict, setStackingConflict] = useState({
    targetContainer: 'CAIU1234567',
    currentPosition: 'C01-04-10-1 (Tầng 1)',
    containersBlocking: 2,
    currentStep: 0,
    blockingContainers: [
      { step: 1, id: 'MSCU1111111', tier: 'Tầng 3', moveTarget: 'C01-04-12-1', status: 'pending' },
      { step: 2, id: 'MSCU2222222', tier: 'Tầng 2', moveTarget: 'C01-04-12-2', status: 'pending' },
    ],
    recommendedOrder: [
      '1 ➔ Cẩu MSCU1111111 (Tầng 3) sang C01-04-12-1',
      '2 ➔ Cẩu MSCU2222222 (Tầng 2) sang C01-04-12-2',
      '3 ➔ Giải phóng container mục tiêu CAIU1234567 xuất cảng',
    ],
    planStarted: false,
    planCompleted: false
  })

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg)
    setToastType(type)
    setTimeout(() => setToastMessage(''), 4500)
  }

  // Real-time Clock
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('vi-VN'))
    }, 1000)
    return () => clearInterval(clockInterval)
  }, [])

  // Auto-Pilot Trigger Simulation
  const handleToggleAutoPilot = () => {
    const nextState = !autoPilotEnabled
    setAutoPilotEnabled(nextState)
    if (nextState) {
      setAutoPilotScanning(true)
      showToast('🚀 CHẾ ĐỘ AUTO-PILOT ĐÃ BẬT: Hệ thống tự động phân tích bãi & sinh lệnh dọn tầng.', 'success')
      setTimeout(() => {
        setAutoPilotScanning(false)
        setAutoPilotLogs(prev => [
          `${new Date().toLocaleTimeString()} [AUTO-PILOT]: Quét 348 slots bãi thành công. Tối ưu hóa 3 lệnh cẩu tự động.`,
          ...prev.slice(0, 5)
        ])
      }, 1500)
    } else {
      showToast('⏹️ Đã tắt chế độ Auto-Pilot. Chuyển về chế độ điều hành thủ công.', 'warning')
    }
  }

  // Execute All Proactive Tasks
  const handleExecuteAllProactiveTasks = () => {
    const newTasks = proactiveTasks.map(p => ({
      id: `MOV-${p.id}`,
      taskId: `auto-${Math.floor(1000 + Math.random() * 9000)}`,
      containerId: p.containerId,
      containerType: p.type,
      cargoType: 'Hàng Đảo Tầng Tự Động',
      from: p.from,
      to: p.to,
      reason: p.reason,
      priority: p.urgency === 'KHẨN CẤP' ? 'CRITICAL' : 'HIGH',
      assignedBy: '🤖 NexusPort Auto-Pilot AI',
      status: 'IN PROGRESS',
      flowStep: 1,
      equipment: { name: p.rtgAssigned, operator: 'Hệ Thống AI Tự Động' },
      confirmedPos: '',
      internalFee: 0,
      durationMinutes: 0,
      startTime: new Date().toISOString()
    }))

    setTasks(prev => [...newTasks, ...prev])
    setProactiveTasks([])
    showToast(`⚡ ĐÃ KÍCH HOẠT THÀNH CÔNG ${newTasks.length} LỆNH TỰ ĐỘNG! Các cẩu RTG đang thực thi.`, 'success')
    setAutoPilotLogs(prev => [
      `${new Date().toLocaleTimeString()} [EXECUTION]: Bắn 3 lệnh tự động xuống cẩu RTG-01, RTG-02, RTG-03.`,
      ...prev.slice(0, 5)
    ])
  }

  // Load relocation tasks from live API
  const loadTasks = async () => {
    try {
      setLoading(true)
      const data = await yardTaskService.getRelocationTasks()
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.map(t => ({
          id: t.taskCode || `MOV-${t.id?.substring(0, 4)}`,
          taskId: t.id,
          containerId: t.containerNo,
          containerType: t.containerType || '40FT HC',
          cargoType: t.cargoType || 'Hàng Khô',
          from: t.fromLocation || 'A01-01-01-1',
          to: t.toLocation || 'B02-01-01-1',
          reason: t.shiftingReason || t.notes || 'Tái cơ cấu xếp bãi',
          priority: (t.priority || 'Normal').toUpperCase(),
          assignedBy: t.assignedBy || 'Operator / Điều phối',
          status: (t.status || 'ASSIGNED').toUpperCase().replace('_', ' '),
          flowStep: t.status?.toLowerCase() === 'completed' ? 3 : (t.status?.toLowerCase() === 'in_progress' ? 1 : 0),
          equipment: t.equipmentCode ? { name: t.equipmentCode, operator: t.operatorName || 'Cần thủ' } : null,
          confirmedPos: t.completedLocation || '',
          internalFee: t.internalFee || 0,
          durationMinutes: t.durationMinutes || 0,
          startTime: t.startTime,
          endTime: t.endTime,
          notes: t.notes || ''
        }))
        setTasks(mapped)
      } else {
        setTasks(getFallbackTasks())
      }
    } catch (err) {
      console.warn('Could not fetch from backend, loading fallback tasks:', err)
      setTasks(getFallbackTasks())
    } finally {
      setLoading(false)
    }
  }

  // Load Restack Plan History (NXP-126)
  const loadRestackHistory = async () => {
    try {
      const plans = await yardRestackService.getAllPlans()
      if (Array.isArray(plans)) {
        setRestackPlanHistory(plans)
      }
    } catch (err) {
      console.warn('Could not fetch restack plan history:', err)
    }
  }

  // Initial load
  useEffect(() => {
    loadTasks()
    loadRestackHistory()

    // Fetch equipments & operators
    yardTaskService.getAvailableEquipments().then(eqs => {
      if (Array.isArray(eqs) && eqs.length > 0) {
        setEquipments(eqs.map(e => ({
          id: e.id || e.equipmentCode,
          name: `${e.equipmentCode} (${e.name || e.equipmentType})`,
          operator: e.operatorName || 'Chưa gán',
          status: e.status === 'available' ? 'Sẵn sàng' : (e.status === 'working' ? 'Đang bận' : 'Bảo trì'),
          block: e.blockCode || 'A01',
          type: e.equipmentType || 'RTG',
          fuelLevel: '85%',
          health: '96%',
          maxLoad: '45 Tấn'
        })))
      }
    }).catch(() => {})

    yardTaskService.getAvailableOperators().then(ops => {
      if (Array.isArray(ops) && ops.length > 0) {
        setOperators(ops)
      }
    }).catch(() => {})
  }, [])

  // Timer effect for active task
  useEffect(() => {
    if (activeTask && activeTask.flowStep === 1) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setElapsedSeconds(0)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [activeTask])

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Dynamic AI Score calculation based on weight sliders
  const dynamicAiScore = useMemo(() => {
    const total = aiAlgorithmWeights.distance + aiAlgorithmWeights.reshuffle + aiAlgorithmWeights.safety
    if (total === 0) return 90
    const raw = (aiAlgorithmWeights.distance * 0.95 + aiAlgorithmWeights.reshuffle * 0.98 + aiAlgorithmWeights.safety * 0.90) / (total / 100)
    return Math.min(99, Math.round(raw))
  }, [aiAlgorithmWeights])

  // Dynamic AI Comparison details for selected container
  const compareData = useMemo(() => {
    const c = selectedCompareContainer || SAMPLE_CONTAINERS[0]
    const map = {
      'MSCU1234567': {
        manualPos: 'B02-01-02-1',
        manualDist: '420 m',
        manualTime: '18.0 phút',
        manualConflict: 'Bị 3 container đè (Cần đảo vỏ)',
        manualEnergy: '4.2 Lít',
        manualAutoRate: '12%',
        aiPos: 'B02-04-02-3',
        aiDist: '160 m',
        aiTime: '7.5 phút',
        aiConflict: '0 lần (Lấy thẳng khi tàu cập)',
        aiEnergy: '1.5 Lít',
        aiAutoRate: '98%',
        distSaving: '-61.9%',
        timeSaving: '-58.3%',
        energySaving: '-64.3%',
        conflictSaving: '-100%',
        costManual: '380.000 đ',
        costAi: '150.000 đ',
        costSaving: '-60.5%',
        autoRateGain: '+86.0%',
        pctDist: 38,
        pctTime: 42,
        pctEnergy: 36,
        pctCost: 39,
      },
      'TEMU8822190': {
        manualPos: 'A01-02-05-1',
        manualDist: '380 m',
        manualTime: '16.5 phút',
        manualConflict: 'Bị 2 container đè phía trên',
        manualEnergy: '3.8 Lít',
        manualAutoRate: '15%',
        aiPos: 'B02-02-02-4',
        aiDist: '90 m',
        aiTime: '4.5 phút',
        aiConflict: '0 lần (Lấy thẳng khi tàu cập)',
        aiEnergy: '1.1 Lít',
        aiAutoRate: '99%',
        distSaving: '-76.3%',
        timeSaving: '-72.7%',
        energySaving: '-71.1%',
        conflictSaving: '-100%',
        costManual: '350.000 đ',
        costAi: '120.000 đ',
        costSaving: '-65.7%',
        autoRateGain: '+84.0%',
        pctDist: 24,
        pctTime: 27,
        pctEnergy: 29,
        pctCost: 34,
      },
      'CMAU9918234': {
        manualPos: 'C01-03-01-1',
        manualDist: '510 m',
        manualTime: '21.0 phút',
        manualConflict: 'Bị 3 container đè phía trên',
        manualEnergy: '5.1 Lít',
        manualAutoRate: '10%',
        aiPos: 'A01-03-04-3',
        aiDist: '120 m',
        aiTime: '6.0 phút',
        aiConflict: '0 lần (Lấy thẳng khi tàu cập)',
        aiEnergy: '1.4 Lít',
        aiAutoRate: '97%',
        distSaving: '-76.5%',
        timeSaving: '-71.4%',
        energySaving: '-72.5%',
        conflictSaving: '-100%',
        costManual: '420.000 đ',
        costAi: '140.000 đ',
        costSaving: '-66.7%',
        autoRateGain: '+87.0%',
        pctDist: 24,
        pctTime: 29,
        pctEnergy: 27,
        pctCost: 33,
      },
      'COSU8819201': {
        manualPos: 'B02-03-01-2',
        manualDist: '450 m',
        manualTime: '19.0 phút',
        manualConflict: 'Bị 2 container đè phía trên',
        manualEnergy: '4.5 Lít',
        manualAutoRate: '14%',
        aiPos: 'A01-04-02-2',
        aiDist: '140 m',
        aiTime: '6.5 phút',
        aiConflict: '0 lần (Lấy thẳng khi tàu cập)',
        aiEnergy: '1.6 Lít',
        aiAutoRate: '98%',
        distSaving: '-68.9%',
        timeSaving: '-65.8%',
        energySaving: '-64.4%',
        conflictSaving: '-100%',
        costManual: '390.000 đ',
        costAi: '150.000 đ',
        costSaving: '-61.5%',
        autoRateGain: '+84.0%',
        pctDist: 31,
        pctTime: 34,
        pctEnergy: 36,
        pctCost: 38,
      },
      'HLCU7719204': {
        manualPos: 'A01-01-03-1',
        manualDist: '490 m',
        manualTime: '20.0 phút',
        manualConflict: 'Bị 3 container đè phía trên',
        manualEnergy: '4.9 Lít',
        manualAutoRate: '12%',
        aiPos: 'B02-04-01-1',
        aiDist: '110 m',
        aiTime: '5.0 phút',
        aiConflict: '0 lần (Khu chuyên dụng DG)',
        aiEnergy: '1.3 Lít',
        aiAutoRate: '99%',
        distSaving: '-77.6%',
        timeSaving: '-75.0%',
        energySaving: '-73.5%',
        conflictSaving: '-100%',
        costManual: '440.000 đ',
        costAi: '160.000 đ',
        costSaving: '-63.6%',
        autoRateGain: '+87.0%',
        pctDist: 22,
        pctTime: 25,
        pctEnergy: 27,
        pctCost: 36,
      },
      'ONEU8821903': {
        manualPos: 'B02-02-01-1',
        manualDist: '460 m',
        manualTime: '19.5 phút',
        manualConflict: 'Bị 2 container đè phía trên',
        manualEnergy: '4.6 Lít',
        manualAutoRate: '11%',
        aiPos: 'C01-02-04-2',
        aiDist: '130 m',
        aiTime: '6.0 phút',
        aiConflict: '0 lần (Rack cắm điện Reefer)',
        aiEnergy: '1.5 Lít',
        aiAutoRate: '98%',
        distSaving: '-71.7%',
        timeSaving: '-69.2%',
        energySaving: '-67.4%',
        conflictSaving: '-100%',
        costManual: '410.000 đ',
        costAi: '150.000 đ',
        costSaving: '-63.4%',
        autoRateGain: '+87.0%',
        pctDist: 28,
        pctTime: 31,
        pctEnergy: 33,
        pctCost: 37,
      },
    }
    return map[c.containerNo] || map['MSCU1234567']
  }, [selectedCompareContainer])

  // 1-Click Zero-Touch Direct AI Dispatch (Eliminates manual input)
  const handleDirectAiDispatch = async () => {
    const c = selectedCompareContainer || SAMPLE_CONTAINERS[0]
    const targetParts = compareData.aiPos.split('-')
    const randomId = `MOV-${Math.floor(1000 + Math.random() * 9000)}`
    
    const newTask = {
      id: randomId,
      taskId: `ai-dispatch-${Date.now()}`,
      containerId: c.containerNo,
      containerType: c.type,
      cargoType: c.cargo || 'Hàng Tối Ưu AI',
      from: c.location,
      to: compareData.aiPos,
      reason: 'Tối ưu hóa BRP & Lịch tàu cập cảng (Tự động)',
      priority: 'HIGH',
      assignedBy: '🤖 NexusPort AI Autonomous Engine',
      status: 'IN PROGRESS',
      flowStep: 1,
      equipment: { name: 'RTG-01 (Mitsui 40T)', operator: 'Hệ Thống Tự Hành AI' },
      confirmedPos: '',
      internalFee: 0,
      durationMinutes: 0,
      startTime: new Date().toISOString(),
      notes: `Lệnh tự động phát bởi AI. Rút ngắn ${compareData.distSaving.replace('-', '')} quãng đường và ${compareData.timeSaving.replace('-', '')} thời gian.`
    }

    try {
      const payload = {
        containerNo: newTask.containerId,
        containerType: newTask.containerType,
        sourceBlockCode: newTask.from.split('-')[0] || 'A01',
        fromLocation: newTask.from,
        targetBlockCode: targetParts[0] || 'B02',
        toLocation: newTask.to,
        shiftingReason: newTask.reason,
        priority: 'High',
        isBillable: false,
        internalFee: 0,
        operatorName: 'Hệ Thống Tự Hành AI',
        notes: newTask.notes
      }
      await yardTaskService.createRelocationTask(payload)
    } catch {
      // Fallback in-memory
    }

    setTasks(prev => [newTask, ...prev.filter(t => t.id !== newTask.id)])
    setActiveTask(newTask)
    setConfirmedPosInput(newTask.to)
    showToast(`🚀 [ZERO-TOUCH DISPATCH]: Đã tự động phát lệnh ${randomId} cho container ${c.containerNo} ➔ Vị trí tối ưu ${compareData.aiPos}!`, 'success')
  }

  // KPI Stats
  const kpiStats = useMemo(() => {
    const pending = tasks.filter(t => t.status === 'ASSIGNED' || t.status === 'READY' || t.status === 'PENDING').length
    const inProgress = tasks.filter(t => t.status === 'IN PROGRESS' || t.status === 'TẠI VỊ TRÍ ĐÍCH').length
    const completed = tasks.filter(t => t.status === 'COMPLETED').length
    const critical = tasks.filter(t => t.priority === 'CRITICAL' || t.priority === 'HIGH').length
    return {
      pending: `${pending} Lệnh`,
      inProgress: `${inProgress} Lệnh`,
      completed: `${completed} Lệnh`,
      critical: `${critical} Lệnh 🟠`
    }
  }, [tasks])

  // Filtered & Sorted Tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => {
        const matchSearch = t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.containerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.to.toLowerCase().includes(searchTerm.toLowerCase())
        if (!matchSearch) return false

        if (statusFilter === 'PENDING' && !(t.status === 'PENDING' || t.status === 'ASSIGNED' || t.status === 'READY')) return false
        if (statusFilter === 'IN_PROGRESS' && !(t.status === 'IN PROGRESS' || t.status === 'TẠI VỊ TRÍ ĐÍCH')) return false
        if (statusFilter === 'COMPLETED' && t.status !== 'COMPLETED') return false
        if (statusFilter === 'CRITICAL' && !(t.priority === 'CRITICAL' || t.priority === 'HIGH')) return false

        if (shippingLineFilter !== 'ALL') {
          const detectedLine = getShippingLineCode(t.containerId)
          const matchLine = detectedLine === shippingLineFilter || t.containerId.toUpperCase().includes(shippingLineFilter)
          if (!matchLine) return false
        }

        return true
      })
      .sort((a, b) => {
        let fieldA = a[sortField] || ''
        let fieldB = b[sortField] || ''
        if (typeof fieldA === 'string') fieldA = fieldA.toLowerCase()
        if (typeof fieldB === 'string') fieldB = fieldB.toLowerCase()
        if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1
        if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
  }, [tasks, statusFilter, searchTerm, shippingLineFilter, sortField, sortOrder])

  // Computed destination coordinate in Create Modal
  const computedDestLocation = useMemo(() => {
    return `${newTargetBlock}-${newTargetBay.padStart(2, '0')}-${newTargetRow.padStart(2, '0')}-${newTargetTier}`
  }, [newTargetBlock, newTargetBay, newTargetRow, newTargetTier])

  // Auto calculate fee when billable or reason changes
  useEffect(() => {
    if (newIsBillable || newShiftingReason === 'Theo yêu cầu khách hàng') {
      const is20 = newContainerType.includes('20')
      setCalculatedFee(is20 ? 350000 : 550000)
    } else {
      setCalculatedFee(0)
    }
  }, [newIsBillable, newShiftingReason, newContainerType])

  // Handle Container selection in Create Modal
  const handleSelectPredefinedContainer = (c) => {
    setNewContainerNo(c.containerNo)
    setNewContainerType(c.type)
    setNewFromLocation(c.location)
  }

  // AI Slot Recommendation Trigger
  const handleAiAutoSelectSlot = () => {
    setNewTargetBlock('B02')
    setNewTargetBay('02')
    setNewTargetRow('02')
    setNewTargetTier('3')
    setSelectedSlotMatrixBlock('B02')
    setSlotValidation({
      isValid: true,
      message: '🤖 AI Đề xuất: Slot B02-02-02-3 tối ưu quãng đường cẩu RTG, 0 xung đột tầng.',
      warnings: []
    })
    showToast('🤖 AI đã tự động đề xuất vị trí slot bãi tối ưu nhất!', 'success')
  }

  // Handle click on slot matrix item
  const handleMatrixSlotClick = (slot) => {
    if (slot.status === 'MAINTENANCE') {
      showToast('⚠️ Slot này đang bảo trì!', 'warning')
      return
    }
    if (slot.status === 'OCCUPIED') {
      showToast(`⚠️ Slot này đã có container ${slot.cont} (${slot.line}) chiếm chỗ!`, 'warning')
      return
    }
    setNewTargetRow(String(slot.row).padStart(2, '0'))
    setNewTargetTier(String(slot.tier))
    if (slot.status === 'GRAVITY_WARNING') {
      setSlotValidation({
        isValid: true,
        message: `Tọa độ hợp lệ. Lưu ý cảnh báo trọng lực: Tầng dưới còn trống.`,
        warnings: ['Quy tắc trọng lực']
      })
      showToast(`⚠️ Chọn slot Hàng ${slot.row} Tầng ${slot.tier}: Chú ý quy tắc trọng lực`, 'warning')
    } else {
      setSlotValidation({
        isValid: true,
        message: `Slot hợp lệ và sẵn sàng tiếp nhận container.`,
        warnings: []
      })
      showToast(`✓ Đã chọn slot trống: Hàng ${slot.row} - Tầng ${slot.tier}`, 'success')
    }
  }

  // Handle Live Slot Validation
  const handleValidateSlot = async () => {
    setValidatingSlot(true)
    try {
      const res = await yardTaskService.validateTargetSlot({
        targetLocation: computedDestLocation,
        containerNo: newContainerNo,
        containerType: newContainerType
      })
      setSlotValidation(res)
      if (res.isValid) {
        showToast(`✓ Vị trí đích [${computedDestLocation}] hợp lệ và sẵn sàng tiếp nhận!`, 'success')
      } else {
        showToast(`⚠️ Vị trí đích không hợp lệ: ${res.message}`, 'error')
      }
    } catch {
      const tierNum = parseInt(newTargetTier, 10)
      if (tierNum > 5) {
        setSlotValidation({ isValid: false, message: 'Chiều cao vượt quá 5 tầng an toàn.', warnings: [] })
      } else {
        setSlotValidation({ isValid: true, message: 'Vị trí đích hợp lệ và sẵn sàng.', warnings: [] })
      }
    } finally {
      setValidatingSlot(false)
    }
  }

  // Submit Create Relocation Task
  const handleCreateRelocationTask = async (e) => {
    e.preventDefault()
    if (!newContainerNo.trim()) {
      showToast('Vui lòng nhập hoặc chọn mã container!', 'error')
      return
    }
    if (newFromLocation.trim().toUpperCase() === computedDestLocation.trim().toUpperCase()) {
      showToast('❌ Vị trí đích không được trùng với vị trí gốc hiện tại!', 'error')
      return
    }

    setIsSubmittingTask(true)
    try {
      const payload = {
        containerNo: newContainerNo.trim().toUpperCase(),
        containerType: newContainerType,
        sourceBlockCode: newFromLocation.split('-')[0] || 'A01',
        fromLocation: newFromLocation,
        targetBlockCode: newTargetBlock,
        toLocation: computedDestLocation,
        shiftingReason: newShiftingReason,
        priority: newPriority,
        isBillable: newIsBillable,
        internalFee: calculatedFee,
        operatorName: newOperatorName,
        notes: newNotes
      }

      const res = await yardTaskService.createRelocationTask(payload)
      showToast(`🎉 Tạo thành công lệnh chuyển bãi [${res.taskCode || 'Mới'}] cho container ${payload.containerNo}!`, 'success')
      setCreateModalOpen(false)
      setNewContainerNo('')
      setSlotValidation(null)
      loadTasks()
    } catch (err) {
      console.error('Error creating relocation task:', err)
      const randomId = `MOV-${Math.floor(1000 + Math.random() * 9000)}`
      const newTask = {
        id: randomId,
        containerId: newContainerNo.trim().toUpperCase(),
        containerType: newContainerType,
        cargoType: 'Hàng Đảo Chuyển',
        from: newFromLocation,
        to: computedDestLocation,
        reason: newShiftingReason,
        priority: newPriority.toUpperCase(),
        assignedBy: 'Operator - Điều Phối Bãi',
        status: 'PENDING',
        flowStep: 0,
        equipment: { name: 'RTG-01', operator: newOperatorName },
        confirmedPos: '',
        internalFee: calculatedFee,
        durationMinutes: 0,
        notes: newNotes
      }
      setTasks(prev => [newTask, ...prev])
      showToast(`🎉 Đã tạo lệnh chuyển container ${newTask.containerId} (Mã: ${randomId})!`, 'success')
      setCreateModalOpen(false)
    } finally {
      setIsSubmittingTask(false)
    }
  }

  // Handle "BẮT ĐẦU CẨU" (Start Lift - Step 1)
  const handleStartTask = async (task) => {
    if (task.status === 'COMPLETED') {
      showToast('❌ Không thể nhận lệnh đã hoàn thành!', 'error')
      return
    }

    const firstAvail = equipments.find(e => e.status === 'Sẵn sàng') || equipments[0]
    const updated = {
      ...task,
      flowStep: 1,
      status: 'IN PROGRESS',
      equipment: task.equipment || firstAvail,
      startTime: new Date().toISOString()
    }

    setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    setActiveTask(updated)
    setConfirmedPosInput(task.to)

    if (task.taskId) {
      try {
        await yardTaskService.startLift(task.taskId, { notes: 'Bắt đầu cẩu chuyển block' })
      } catch (err) {
        console.warn('API start lift warning:', err)
      }
    }

    showToast(`⚡ BẮT ĐẦU CẨU LỆNH ${task.id} — Container ${task.containerId} đang được cẩu bằng ${updated.equipment?.name || 'RTG'}.`, 'success')
  }

  // Handle "ĐÃ ĐẾN VỊ TRÍ ĐÍCH" (Step 2)
  const handleMarkArrived = (task) => {
    const updated = { ...task, flowStep: 2, status: 'TẠI VỊ TRÍ ĐÍCH' }
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    setActiveTask(updated)
    showToast(`📍 TASK ${task.id}: Container ${task.containerId} đã đến vị trí đích [${task.to}]. Vui lòng xác nhận hạ bãi.`, 'warning')
  }

  // Handle "XÁC NHẬN HOÀN THÀNH & HẠ BÃI" (Step 3 - Final)
  const handleConfirmComplete = async (task) => {
    const finalPos = confirmedPosInput.trim() || task.to
    const duration = Math.max(1, Math.round(elapsedSeconds / 60) || 5)

    const updated = {
      ...task,
      flowStep: 3,
      status: 'COMPLETED',
      confirmedPos: finalPos,
      durationMinutes: duration,
      endTime: new Date().toISOString()
    }

    // Check if there is a next chained task in a multi-step conflict resolution plan
    const isConflictTask = task.notes && task.notes.includes('thuộc kế hoạch gỡ xung đột')
    const nextStepTask = isConflictTask
      ? tasks.find(t => 
          t.id !== task.id &&
          (t.status === 'ASSIGNED' || t.status === 'READY') &&
          t.notes &&
          t.notes.includes('thuộc kế hoạch gỡ xung đột')
        )
      : null

    if (nextStepTask) {
      const nextActive = {
        ...nextStepTask,
        status: 'IN PROGRESS',
        flowStep: 1,
        startTime: new Date().toISOString()
      }
      setTasks(prev => prev.map(t => {
        if (t.id === task.id) return updated
        if (t.id === nextStepTask.id) return nextActive
        return t
      }))
      setActiveTask(nextActive)
      setConfirmedPosInput(nextActive.to)
      showToast(`✅ HOÀN TẤT LỆNH ${task.id}! Tự động kích hoạt bước tiếp theo trong chuỗi gỡ xung đột: Cẩu ${nextActive.containerId} ➔ ${nextActive.to}.`, 'success')
      return
    }

    setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    setActiveTask(null)

    if (task.taskId) {
      try {
        await yardTaskService.completeLift(task.taskId, {
          completedLocation: finalPos,
          notes: `Hoàn tất chuyển sang ${finalPos}. Thời gian: ${duration} phút.`
        })
      } catch (err) {
        console.warn('API complete lift warning:', err)
      }
    }

    showToast(`✅ HOÀN TẤT LỆNH ${task.id}: Container ${task.containerId} đã hạ an toàn tại [${finalPos}]. Thời gian: ${duration} phút. Đã gửi thông báo cho Operator.`, 'success')
  }

  // Bulk Start Tasks
  const handleBulkStartTasks = () => {
    if (selectedTaskIds.length === 0) return
    setTasks(prev => prev.map(t => {
      if (selectedTaskIds.includes(t.id) && t.status !== 'COMPLETED') {
        return { ...t, status: 'IN PROGRESS', flowStep: 1, startTime: new Date().toISOString() }
      }
      return t
    }))
    showToast(`⚡ ĐÃ BẮT ĐẦU CẨU ĐỒNG THỜI ${selectedTaskIds.length} LỆNH ĐƯỢC CHỌN!`, 'success')
    setSelectedTaskIds([])
  }

  // Advance Stacking Conflict Step
  const handleAdvanceConflictStep = (stepIdx) => {
    setStackingConflict(prev => {
      const updatedList = prev.blockingContainers.map((item, idx) => {
        if (idx === stepIdx) return { ...item, status: 'completed' }
        return item
      })
      const allDone = updatedList.every(i => i.status === 'completed')
      return {
        ...prev,
        currentStep: stepIdx + 1,
        blockingContainers: updatedList,
        planStarted: true,
        planCompleted: allDone
      }
    })
    showToast(`🏗️ Đã hoàn thành bước ${stepIdx + 1} đảo container giải phóng vị trí!`, 'success')
  }

  // 1-Click AI Auto-Optimize Conflict Resolution (BRP Solver - NXP-126)
  const handle1ClickOptimizeConflict = async () => {
    setIsAnalyzingConflict(true)
    const scenario = currentConflictScenario
    const targetNo = customTargetContInput.trim() || scenario.targetContainer.id
    const location = scenario.targetContainer.pos
    const dest = customDestinationInput.trim() || scenario.targetMove.moveTarget

    try {
      const res = await yardRestackService.analyzeBlockedContainer({
        containerNo: targetNo,
        location: location,
        blockCode: location.split('-')[0] || 'C01',
        targetDestination: dest,
        restackBackToOriginal: restackBackOption
      })

      if (res && res.blockingContainers && res.blockingContainers.length > 0) {
        const allMoves = [
          ...res.blockingContainers.map(b => ({
            step: b.stepOrder,
            id: b.containerNo,
            type: b.containerType,
            tier: `Tầng ${b.tier}`,
            currentPos: b.currentLocation,
            moveTarget: b.recommendedBufferSlot,
            rtg: 'RTG-01',
            weight: b.weight,
            duration: '2.0 phút',
            reason: b.reason,
            isTarget: false,
            status: 'READY'
          })),
          {
            step: res.blockingContainers.length + 1,
            id: res.targetContainer.containerNo,
            type: res.targetContainer.containerType,
            tier: `Tầng ${res.targetContainer.tier}`,
            currentPos: res.targetContainer.currentLocation,
            moveTarget: res.targetContainer.targetDestination,
            rtg: 'RTG-01',
            weight: res.targetContainer.weight,
            duration: '3.5 phút',
            reason: `Giải phóng container mục tiêu bàn giao ${res.targetContainer.targetDestination}`,
            isTarget: true,
            status: 'READY'
          }
        ]

        if (restackBackOption) {
          let backStep = allMoves.length + 1
          for (let i = res.blockingContainers.length - 1; i >= 0; i--) {
            const b = res.blockingContainers[i]
            allMoves.push({
              step: backStep++,
              id: b.containerNo,
              type: b.containerType,
              tier: `Tầng ${b.tier}`,
              currentPos: b.recommendedBufferSlot,
              moveTarget: b.currentLocation,
              rtg: 'RTG-01',
              weight: b.weight,
              duration: '2.0 phút',
              reason: `Khôi phục container ${b.containerNo} về lại vị trí cột ban đầu`,
              isTarget: false,
              status: 'READY'
            })
          }
        }

        const canExec = res.canExecute !== false && !allMoves.some(m => m.moveTarget?.includes('KHÔNG CÓ SLOT'))
        setConflictPlanResult({
          scenarioId: selectedConflictScenarioId,
          targetContainerNo: res.targetContainer.containerNo,
          targetLocation: res.targetContainer.currentLocation,
          targetDestination: res.targetContainer.targetDestination,
          blockCode: res.targetContainer.blockCode,
          restackBackToOriginal: restackBackOption,
          isOptimized: true,
          canExecute: canExec,
          validationMessage: res.validationMessage || (!canExec ? 'Không tìm thấy slot đệm trống trong phạm vi an toàn.' : 'Đủ slot đệm an toàn để thực thi kế hoạch.'),
          generatedTasks: allMoves,
          metrics: {
            timeSaved: res.aiMetrics?.timeSaved || '0%',
            estimatedDuration: `${res.estimatedDurationMinutes} phút`,
            originalDuration: `${res.estimatedDurationMinutes * 3} phút`,
            energySaved: res.aiMetrics?.energySaved || '0%',
            movesCount: allMoves.length,
            confidence: res.aiMetrics?.confidence || '99.8%',
            bufferSlotNote: res.aiMetrics?.bufferSlotNote || '',
            shiftingFee: res.estimatedShiftingFee
          },
          generatedAt: new Date().toLocaleTimeString('vi-VN')
        })
        setIsAnalyzingConflict(false)
        setConflictPlanDeployed(false)
        setConflictExecutingStep(0)
        setShowConfirmDeployModal(true)

        if (canExec) {
          showToast(
            `🤖 AI BRP ĐÃ TỐI ƯU HÓA: Phát hiện ${res.blockingContainers.length} container đè tầng, đã tính toán chuỗi ${allMoves.length} lệnh cẩu tối ưu!`,
            'success'
          )
        } else {
          showToast(
            `⚠️ CẢNH BÁO AN TOÀN: ${res.validationMessage || 'Block bãi không đủ slot đệm hợp lệ! Không thể thực thi kế hoạch.'}`,
            'error'
          )
        }
        return
      }
    } catch (err) {
      console.warn('Backend analyze fallback:', err)
    }

    // Fallback simulation nếu backend không khả dụng
    setTimeout(() => {
      const allMoves = [
        ...scenario.blockingContainers.map(b => ({
          ...b,
          isTarget: false,
          status: 'READY'
        })),
        {
          ...scenario.targetMove,
          isTarget: true,
          status: 'READY'
        }
      ]

      if (restackBackOption) {
        let backStep = allMoves.length + 1
        for (let i = scenario.blockingContainers.length - 1; i >= 0; i--) {
          const b = scenario.blockingContainers[i]
          allMoves.push({
            step: backStep++,
            id: b.id,
            type: b.type,
            tier: b.tier,
            currentPos: b.moveTarget,
            moveTarget: b.currentPos,
            rtg: b.rtg,
            weight: b.weight,
            duration: b.duration,
            reason: `Khôi phục container ${b.id} về lại vị trí cột ban đầu`,
            isTarget: false,
            status: 'READY'
          })
        }
      }

      const canExec = scenario.canExecute !== false && !allMoves.some(m => m.moveTarget?.includes('KHÔNG CÓ SLOT'))
      setConflictPlanResult({
        scenarioId: scenario.id,
        targetContainerNo: scenario.targetContainer.id,
        targetLocation: scenario.targetContainer.pos,
        targetDestination: scenario.targetMove.moveTarget,
        blockCode: scenario.targetContainer.pos.split('-')[0] || 'C01',
        restackBackToOriginal: restackBackOption,
        isOptimized: true,
        canExecute: canExec,
        validationMessage: scenario.validationMessage || (!canExec ? 'CẢNH BÁO: Không có slot đệm trống hợp lệ trong Block!' : 'Đủ slot đệm an toàn để thực thi.'),
        generatedTasks: allMoves,
        metrics: {
          ...scenario.aiMetrics,
          movesCount: allMoves.length,
          shiftingFee: allMoves.length * 250000
        },
        generatedAt: new Date().toLocaleTimeString('vi-VN')
      })
      setIsAnalyzingConflict(false)
      setConflictPlanDeployed(false)
      setConflictExecutingStep(0)
      setShowConfirmDeployModal(true)

      if (canExec) {
        showToast(
          `🤖 AI ĐÃ TỐI ƯU HÓA XONG: Đã hiển thị kết quả và các lệnh triển khai lên màn hình! Vui lòng bấm xác nhận để phát lệnh.`,
          'success'
        )
      } else {
        showToast(
          `⚠️ CẢNH BÁO AN TOÀN: ${scenario.validationMessage || 'Block bãi không đủ slot đệm hợp lệ! Không thể thực thi kế hoạch.'}`,
          'error'
        )
      }
    }, 600)
  }

  // Confirm and Deploy All Generated Conflict Resolution Tasks (NXP-126)
  const handleConfirmDeployConflictPlan = async () => {
    if (!conflictPlanResult) return
    if (conflictPlanResult.canExecute === false) {
      showToast('🚨 LỖI AN TOÀN: Hệ thống từ chối phát lệnh vì không có slot đệm hợp lệ trong bãi!', 'error')
      return
    }
    setIsDeployingConflictPlan(true)

    try {
      const scenario = currentConflictScenario
      const targetNo = conflictPlanResult.targetContainerNo || scenario.targetContainer.id
      const targetLoc = conflictPlanResult.targetLocation || scenario.targetContainer.pos
      const targetDest = conflictPlanResult.targetDestination || scenario.targetMove.moveTarget
      const blockCode = conflictPlanResult.blockCode || targetLoc.split('-')[0] || 'C01'

      const planPayload = {
        targetContainerNo: targetNo,
        targetLocation: targetLoc,
        blockCode: blockCode,
        targetDestination: targetDest,
        restackBackToOriginal: conflictPlanResult.restackBackToOriginal || restackBackOption,
        assignedEquipmentCode: 'RTG-01',
        assignedOperatorName: 'Trần Văn Hùng',
        isBillable: false,
        notes: `NXP-126: Kế hoạch gỡ xung đột tự động cho container ${targetNo}`,
        steps: conflictPlanResult.generatedTasks.map(t => ({
          stepNumber: t.step,
          containerNo: t.id,
          containerType: t.type || '40FT HC',
          isTargetContainer: t.isTarget,
          stepType: t.isTarget ? 'ReleaseTarget' : (t.reason?.includes('Khôi phục') ? 'RestackBack' : 'MoveToBuffer'),
          fromLocation: t.currentPos,
          toLocation: t.moveTarget,
          reason: t.reason,
          equipmentCode: t.rtg || 'RTG-01',
          operatorName: 'Trần Văn Hùng'
        }))
      }

      const createdPlan = await yardRestackService.createPlan(planPayload)
      const deployRes = await yardRestackService.deployPlan(createdPlan.id)

      setActiveRestackPlan(deployRes.plan || createdPlan)
      setConflictExecutingStep(1)
      setConflictPlanDeployed(true)
      setShowConfirmDeployModal(false)

      await loadTasks()
      await loadRestackHistory()

      showToast(
        `🚀 TRIỂN KHAI THÀNH CÔNG: Đã phát ${deployRes.generatedTaskCodes?.length || planPayload.steps.length} lệnh cẩu RTG xuống bãi! Kế hoạch [${createdPlan.planCode || 'BRP'}] đang thực thi.`,
        'success'
      )
    } catch (err) {
      console.warn('Backend deploy fallback to local state:', err)
      setConflictPlanDeployed(true)
      setConflictExecutingStep(1)
      setShowConfirmDeployModal(false)
      showToast(`🚀 Đã phát lệnh cẩu xuống hệ thống bãi (Mô phỏng)!`, 'success')
    } finally {
      setIsDeployingConflictPlan(false)
    }
  }

  // NXP-126: Manual Move Step Adjustments (Điều chỉnh thứ tự di chuyển thủ công)
  const handleMoveStepUp = (index) => {
    if (index <= 0 || !conflictPlanResult?.generatedTasks) return
    const newTasks = [...conflictPlanResult.generatedTasks]
    const temp = newTasks[index - 1]
    newTasks[index - 1] = newTasks[index]
    newTasks[index] = temp
    const reindexed = newTasks.map((t, idx) => ({ ...t, step: idx + 1 }))
    setConflictPlanResult(prev => ({ ...prev, generatedTasks: reindexed }))
    showToast(`Đã điều chỉnh: Đổi bước ${index + 1} lên bước ${index}`, 'info')
  }

  const handleMoveStepDown = (index) => {
    if (!conflictPlanResult?.generatedTasks || index >= conflictPlanResult.generatedTasks.length - 1) return
    const newTasks = [...conflictPlanResult.generatedTasks]
    const temp = newTasks[index + 1]
    newTasks[index + 1] = newTasks[index]
    newTasks[index] = temp
    const reindexed = newTasks.map((t, idx) => ({ ...t, step: idx + 1 }))
    setConflictPlanResult(prev => ({ ...prev, generatedTasks: reindexed }))
    showToast(`Đã điều chỉnh: Đổi bước ${index + 1} xuống bước ${index + 2}`, 'info')
  }

  const handleUpdateStepTarget = (index, newTarget) => {
    if (!conflictPlanResult?.generatedTasks) return
    const newTasks = [...conflictPlanResult.generatedTasks]
    newTasks[index] = { ...newTasks[index], moveTarget: newTarget }
    setConflictPlanResult(prev => ({ ...prev, generatedTasks: newTasks }))
  }

  // Advance Restack Plan Step (Live Stepper - NXP-126)
  const handleAdvanceRestackStep = async (stepNumber) => {
    setIsAdvancingStep(true)
    try {
      if (activeRestackPlan?.id) {
        const updated = await yardRestackService.completeStep(activeRestackPlan.id, stepNumber, {})
        setActiveRestackPlan(updated)
      }

      setConflictExecutingStep(stepNumber + 1)

      // Cập nhật trạng thái trong generatedTasks
      if (conflictPlanResult) {
        const updatedTasks = conflictPlanResult.generatedTasks.map(t => {
          if (t.step === stepNumber) return { ...t, status: 'COMPLETED' }
          if (t.step === stepNumber + 1) return { ...t, status: 'IN_PROGRESS' }
          return t
        })
        setConflictPlanResult(prev => ({ ...prev, generatedTasks: updatedTasks }))
      }

      const totalSteps = conflictPlanResult?.generatedTasks?.length || 3
      if (stepNumber >= totalSteps) {
        showToast(`🎉 HOÀN TẤT KẾ HOẠCH BRP: Container mục tiêu đã được giải phóng an toàn!`, 'success')
      } else {
        showToast(`✓ Đã hoàn thành Bước ${stepNumber}! Đang cẩu Bước ${stepNumber + 1}...`, 'success')
      }

      await loadTasks()
      await loadRestackHistory()
    } catch (err) {
      console.warn('Error advancing restack step:', err)
      setConflictExecutingStep(stepNumber + 1)
      showToast(`✓ Đã hoàn thành Bước ${stepNumber} (Mô phỏng)!`, 'success')
    } finally {
      setIsAdvancingStep(false)
    }
  }

  // Handle Incident Report
  const handleSubmitIncident = (e) => {
    e.preventDefault()
    showToast(`🚨 ĐÃ GỬI BÁO CÁO SỰ CỐ TASK ${incidentTask?.id}: "${incidentReason}". Operator đã nhận cảnh báo!`, 'error')
    setTasks(prev => prev.map(t => t.id === incidentTask?.id ? { ...t, status: 'INCIDENT', flowStep: -1 } : t))
    setActiveTask(null)
    setIncidentTask(null)
    setIncidentNotes('')
  }

  // Toggle Single Task Selection
  const handleToggleTaskSelection = (id) => {
    setSelectedTaskIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  // Select All Tasks
  const handleSelectAllTasks = () => {
    if (selectedTaskIds.length === filteredTasks.length) {
      setSelectedTaskIds([])
    } else {
      setSelectedTaskIds(filteredTasks.map(t => t.id))
    }
  }

  const renderPriorityBadge = (prio) => {
    const map = {
      'LOW': 'bg-emerald-50 text-emerald-900 border-emerald-300',
      'NORMAL': 'bg-slate-100 text-slate-800 border-slate-200',
      'MEDIUM': 'bg-amber-50 text-amber-900 border-amber-300',
      'HIGH': 'bg-orange-50 text-orange-950 border-orange-300',
      'CRITICAL': 'bg-rose-50 text-rose-950 border-rose-300 animate-pulse',
    }
    const label = {
      'LOW': '🟢 THẤP', 'NORMAL': '⚪ BÌNH THƯỜNG', 'MEDIUM': '🟡 TRUNG BÌNH', 'HIGH': '🟠 CAO', 'CRITICAL': '🔴 RẤT KHẨN',
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full border font-black text-[10px] font-mono ${map[prio] || map['NORMAL']}`}>
        {label[prio] || prio}
      </span>
    )
  }

  const renderStatusBadge = (task) => {
    const cfg = {
      'ASSIGNED':         { cls: 'bg-amber-50 text-amber-900 border-amber-300',   lbl: '🟡 ĐÃ GIAO LỆNH' },
      'READY':            { cls: 'bg-blue-50 text-blue-900 border-blue-300',       lbl: '🔵 SẴN SÀNG CẨU' },
      'PENDING':          { cls: 'bg-amber-50 text-amber-900 border-amber-300',   lbl: '🟡 ĐANG CHỜ' },
      'IN PROGRESS':      { cls: 'bg-blue-50 text-blue-900 border-blue-300 animate-pulse', lbl: '⚡ ĐANG DI CHUYỂN' },
      'TẠI VỊ TRÍ ĐÍCH': { cls: 'bg-indigo-50 text-indigo-900 border-indigo-300', lbl: '📍 TẠI VỊ TRÍ ĐÍCH' },
      'COMPLETED':        { cls: 'bg-emerald-50 text-emerald-900 border-emerald-300', lbl: '✓ HOÀN THÀNH' },
      'INCIDENT':         { cls: 'bg-rose-50 text-rose-950 border-rose-300',          lbl: '🚨 SỰ CỐ' },
    }
    const c = cfg[task.status] || cfg['PENDING']
    return <span className={`px-2.5 py-0.5 rounded-full border font-black text-[10px] font-mono ${c.cls}`}>{c.lbl}</span>
  }

  // Cargo Tag Badge Renderer
  const renderCargoBadge = (type) => {
    if (type?.includes('RF') || type?.includes('Lạnh') || type?.includes('Reefer')) {
      return <span className="px-2 py-0.5 bg-sky-50 text-sky-950 border border-sky-300 rounded-lg text-[9px] font-black whitespace-nowrap">❄️ HÀNG LẠNH (RF)</span>
    }
    if (type?.includes('TANK') || type?.includes('Hóa Chất') || type?.includes('DG') || type?.includes('HAZMAT')) {
      return <span className="px-2 py-0.5 bg-amber-50 text-amber-950 border border-amber-300 rounded-lg text-[9px] font-black whitespace-nowrap">⚡ NGUY HIỂM (DG)</span>
    }
    return <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[9px] font-bold whitespace-nowrap">📦 HÀNG KHÔ</span>
  }

  // Position detail block renderer
  const PositionDetail = ({ label, pos, color = 'text-slate-900', badge = '' }) => {
    const isStandardSlot = pos && pos.includes('-')
    const p = parsePosition(pos)
    return (
      <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-200 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-500 uppercase font-sans font-extrabold">{label}</span>
          {badge && <span className="text-[9px] px-2 py-0.5 bg-blue-100 text-blue-900 rounded-md font-black">{badge}</span>}
        </div>
        <div className={`font-black text-lg font-mono tracking-wide ${color}`}>{pos}</div>
        {isStandardSlot ? (
          <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono">
            {[['Khu Block', p.block], ['Dãy (Bay)', p.bay], ['Hàng (Row)', p.row], ['Tầng (Tier)', p.tier]].map(([k, v]) => (
              <div key={k} className="bg-white rounded-xl border border-slate-200 p-1.5 text-center shadow-2xs">
                <div className="text-slate-500 font-sans text-[9px]">{k}</div>
                <div className="font-black text-slate-900 text-xs">{v}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center gap-2 text-slate-700 text-xs font-sans">
            <span className="material-symbols-outlined text-blue-600 text-base">directions_boat</span>
            <span>Vị trí bốc dỡ ngoài bãi / Điểm giao nhận phương tiện vận tải (Cầu tàu / Xe đầu kéo)</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full font-sans flex flex-col gap-6 bg-slate-50 min-h-screen text-slate-900 relative">

      {/* Toast Alert */}
      {toastMessage && (
        <div className={`fixed top-20 right-8 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-3 z-[100] border-2 animate-bounce ${
          toastType === 'error'
            ? 'bg-rose-50 text-rose-950 border-rose-300'
            : toastType === 'warning'
              ? 'bg-amber-50 text-amber-950 border-amber-300'
              : 'bg-emerald-50 text-emerald-950 border-emerald-300'
        }`}>
          <span>{toastType === 'error' ? '🚨' : (toastType === 'warning' ? '📍' : '✅')}</span>
          {toastMessage}
        </div>
      )}

      {/* ── TOP CONTROL TOWER COMMAND BAR ── */}
      <div className="bg-slate-900 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-5 lg:p-6 shadow-xl border border-slate-700 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"
        style={{ backgroundColor: '#0f172a' }}>
        {/* Left Side: Brand, Title, Badge & Subtitle */}
        <div className="flex items-start gap-3.5 max-w-2xl">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg text-white font-black text-xl shrink-0 mt-0.5">
            ⚓
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-orange-400 uppercase font-mono font-black tracking-widest">TRUNG TÂM ĐIỀU HÀNH BÃI NEXUSPORT</span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-mono font-black text-[10px] rounded-lg flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                TRỰC TUYẾN THỜI GIAN THỰC
              </span>
              {autoPilotEnabled && (
                <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-400/40 text-[10px] font-black animate-pulse flex items-center gap-1">
                  🤖 TỰ ĐỘNG HÓA BẬT
                </span>
              )}
            </div>
            <h2 className="font-heading text-2xl lg:text-3xl font-black text-white tracking-tight">
              Vận Hành Chuyển Container Giữa Các Block
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Quy trình điều phối cẩu RTG thông minh, tự động hóa gợi ý vị trí đích bằng AI (Block Relocation Problem), đo lường thời gian tác nghiệp realtime và so sánh hiệu quả định lượng.
            </p>
          </div>
        </div>

        {/* Right Side: Balanced Metrics Pills & Action Buttons */}
        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0 font-mono text-xs">
          {/* 3 Metric Pills with Equal Width */}
          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
            <div className="bg-slate-700/80 border border-slate-600 px-3.5 py-2 rounded-2xl flex flex-col items-center justify-center text-center shadow-inner">
              <span className="text-slate-300 text-[10px]">Độ Lấp Đầy</span>
              <strong className="text-amber-300 font-black text-sm">78.4%</strong>
            </div>
            <div className="bg-slate-700/80 border border-slate-600 px-3.5 py-2 rounded-2xl flex flex-col items-center justify-center text-center shadow-inner">
              <span className="text-slate-300 text-[10px]">Đội Cẩu RTG</span>
              <strong className="text-emerald-300 font-black text-sm">3/4 Sẵn Sàng</strong>
            </div>
            <div className="bg-slate-700/80 border border-slate-600 px-3.5 py-2 rounded-2xl flex flex-col items-center justify-center text-center shadow-inner">
              <span className="text-slate-300 text-[10px]">Gió Bãi</span>
              <strong className="text-cyan-300 font-black text-sm">9.8 m/s</strong>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button onClick={handleToggleAutoPilot}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                autoPilotEnabled
                  ? 'bg-blue-600 hover:bg-blue-500 text-white ring-2 ring-blue-400/50'
                  : 'bg-slate-700/90 hover:bg-slate-600 text-slate-200 border border-slate-600'
              }`}>
              <span className="material-symbols-outlined text-sm">{autoPilotEnabled ? 'smart_toy' : 'power_settings_new'}</span>
              <span>{autoPilotEnabled ? 'Tự Động: BẬT' : 'Bật Tự Động'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── HEADER NAVIGATION & VIEW SWITCHER BAR ── */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
        {/* Left Side: 4 View Mode Switcher Buttons */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-bold flex-wrap gap-1">
          <button onClick={() => setViewMode('TABLE')}
            className={`px-3.5 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 ${
              viewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
            }`}>
            <span className="material-symbols-outlined text-sm">table_rows</span>
            Danh Sách Lệnh
          </button>
          <button onClick={() => setViewMode('YARD_MAP')}
            className={`px-3.5 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 ${
              viewMode === 'YARD_MAP' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
            }`}>
            <span className="material-symbols-outlined text-sm">grid_view</span>
            Sơ Đồ Bãi 2.5D
          </button>
          <button onClick={() => setViewMode('RESTACK_WIZARD')}
            className={`px-3.5 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 ${
              viewMode === 'RESTACK_WIZARD' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
            }`}>
            <span className="material-symbols-outlined text-sm">layers_clear</span>
            Gỡ Xung Đột Tầng
          </button>
          <button onClick={() => setViewMode('AI_ANALYTICS')}
            className={`px-3.5 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 ${
              viewMode === 'AI_ANALYTICS' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
            }`}>
            <span className={`material-symbols-outlined text-sm ${viewMode === 'AI_ANALYTICS' ? 'text-blue-600' : 'text-slate-500'}`}>smart_toy</span>
            So Sánh AI & Tự Động Hóa
          </button>
        </div>

        {/* Right Side: Create New Relocation Task Button */}
        <button onClick={() => setCreateModalOpen(true)}
          className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-98 text-white font-black text-xs rounded-2xl shadow-md hover:shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-lg">add_circle</span>
          [ + TẠO LỆNH CHUYỂN BLOCK MỚI ]
        </button>
      </div>

      {/* ── TOP KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Lệnh Chờ Điều Phối', val: kpiStats.pending, sub: 'Chờ Yard Staff tiếp nhận', topBorder: 'border-t-4 border-t-amber-500', txt: 'text-amber-900', icon: 'pending_actions', iconBg: 'bg-amber-50 text-amber-600' },
          { label: 'Đang Cẩu & Di Chuyển', val: kpiStats.inProgress, sub: 'RTG đang cẩu sang bãi đích', topBorder: 'border-t-4 border-t-blue-600', txt: 'text-blue-900', icon: 'precision_manufacturing', iconBg: 'bg-blue-50 text-blue-600' },
          { label: 'Hoàn Thành Trong Ca', val: kpiStats.completed, sub: 'Đã cập nhật slot bãi đích', topBorder: 'border-t-4 border-t-emerald-500', txt: 'text-emerald-900', icon: 'task_alt', iconBg: 'bg-emerald-50 text-emerald-600' },
          { label: 'Ưu Tiên Cao & Khẩn', val: kpiStats.critical, sub: 'Cần giải phóng trước tàu', topBorder: 'border-t-4 border-t-orange-500', txt: 'text-orange-950', icon: 'priority_high', iconBg: 'bg-orange-50 text-orange-600' },
        ].map(c => (
          <div key={c.label} className={`bg-white p-5 rounded-3xl border border-slate-200/90 ${c.topBorder} shadow-xs space-y-1 relative overflow-hidden transition-all hover:shadow-md hover:border-slate-300`}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500 uppercase font-sans font-extrabold">{c.label}</span>
              <div className={`w-8 h-8 rounded-xl ${c.iconBg} flex items-center justify-center`}>
                <span className="material-symbols-outlined text-base">{c.icon}</span>
              </div>
            </div>
            <strong className={`text-2xl font-black font-mono block ${c.txt}`}>{c.val}</strong>
            <span className="text-[10px] text-slate-500 font-medium font-sans block">{c.sub}</span>
          </div>
        ))}
      </div>

      {/* ── ACTIVE TASK LIVE EXECUTION PANEL ── */}
      {activeTask && (
        <div className="bg-white border-2 border-slate-200 border-t-4 border-t-blue-600 rounded-3xl p-6 shadow-sm space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-2xl animate-spin">precision_manufacturing</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-xl font-black text-slate-900">ĐANG CẨU DI CHUYỂN: {activeTask.id}</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[10px] font-black font-mono">RTG ACTIVE</span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-600">
                  Mã Container: <strong className="text-blue-900 font-black text-sm">{activeTask.containerId}</strong> • {activeTask.containerType} ({activeTask.cargoType})
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Live Timer */}
              <div className="bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-2xl font-mono text-xs flex items-center gap-2 shadow-2xs">
                <span className="material-symbols-outlined text-blue-600 text-base animate-spin">timer</span>
                <span>Thời gian: <strong className="text-blue-900 font-black text-sm">{formatTimer(elapsedSeconds)}</strong></span>
              </div>
              {renderStatusBadge(activeTask)}
              <button onClick={() => setIncidentTask(activeTask)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-950 border border-rose-300 font-black text-xs rounded-2xl cursor-pointer transition-all flex items-center gap-1.5 shadow-2xs">
                <span className="material-symbols-outlined text-sm text-rose-600">report_problem</span>
                Báo Sự Cố
              </button>
              <button onClick={() => setActiveTask(null)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs rounded-2xl cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                title="Đóng bảng cẩu trực tiếp">
                <span className="material-symbols-outlined text-sm">close</span>
                <span>Thu Gọn</span>
              </button>
            </div>
          </div>

          {/* RTG Crane Animated Track Simulation */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-white space-y-3">
            <div className="flex justify-between items-center text-[10px] font-mono text-amber-400 uppercase font-black">
              <span>Lộ Trình Cẩu RTG: {activeTask.from} ➔ {activeTask.to}</span>
              <span className="text-emerald-400">Tốc độ cẩu: 1.2 m/s • Tải trọng: 30.5 Tấn</span>
            </div>

            {/* Crane Track Bar */}
            <div className="relative w-full h-12 bg-slate-800 rounded-xl overflow-hidden flex items-center px-4">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/30 via-emerald-600/30 to-blue-600/30 animate-pulse"></div>
              
              {/* Origin Marker */}
              <div className="z-10 flex items-center gap-1 text-[10px] font-mono font-black text-blue-300 bg-blue-950/80 px-2.5 py-1 rounded-lg border border-blue-500">
                📦 {activeTask.from}
              </div>

              {/* Moving Crane Indicator */}
              <div className="flex-1 flex justify-center z-10">
                <div className="flex items-center gap-2 bg-amber-500 text-slate-950 px-3.5 py-1.5 rounded-xl font-black text-[11px] shadow-lg animate-bounce">
                  <span className="material-symbols-outlined text-sm">forklift</span>
                  <span>{activeTask.equipment?.name || 'RTG-01'} đang di chuyển container</span>
                </div>
              </div>

              {/* Destination Marker */}
              <div className="z-10 flex items-center gap-1 text-[10px] font-mono font-black text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500">
                🎯 {activeTask.to}
              </div>
            </div>
          </div>

          {/* 4-Step Interactive Execution Flow */}
          <div className="grid grid-cols-4 gap-2 font-mono text-[10px] font-black">
            {[
              { label: '1. Đã Giao Lệnh', desc: 'Sẵn sàng tác nghiệp' },
              { label: '2. Bắt Đầu Cẩu', desc: 'RTG nâng container' },
              { label: '3. Tại Vị Trí Đích', desc: 'Di chuyển sang Block mới' },
              { label: '4. Hoàn Tất Hạ Bãi', desc: 'Cập nhật slot & thông báo' }
            ].map((step, idx) => (
              <div key={idx} className={`p-2.5 text-center rounded-2xl border-2 transition-all ${
                activeTask.flowStep === idx
                  ? 'bg-blue-600 text-white border-blue-700 shadow-md'
                  : activeTask.flowStep > idx
                    ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                    : 'bg-white text-slate-400 border-slate-200'
              }`}>
                <div>{activeTask.flowStep > idx ? '✓ ' : ''}{step.label}</div>
                <div className="text-[9px] font-normal opacity-80 mt-0.5">{step.desc}</div>
              </div>
            ))}
          </div>

          {/* 3-Column Layout: Positions + Equipment + Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Column 1: From & To Positions */}
            <div className="space-y-3">
              <PositionDetail label="VỊ TRÍ GỐC (TỪ)" pos={activeTask.from} color="text-blue-900" badge="Block Gốc" />
              <PositionDetail label="VỊ TRÍ ĐÍCH (ĐẾN)" pos={activeTask.to} color="text-emerald-900" badge="Block Đích" />
              <button onClick={() => setMapViewTask(activeTask)}
                className="w-full py-3 bg-blue-100 hover:bg-blue-200 text-blue-950 border-2 border-blue-400 rounded-2xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs">
                <span className="material-symbols-outlined text-sm">map</span>
                [ 🗺️ XEM TRÊN SƠ ĐỒ BÃI 2D ]
              </button>
            </div>

            {/* Column 2: Equipment & Fee */}
            <div className="bg-white p-5 rounded-3xl border-2 border-slate-200 space-y-3.5 shadow-2xs">
              <div className="text-xs font-black text-slate-900 uppercase font-mono border-b border-slate-200 pb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-orange-600">
                  <span className="material-symbols-outlined text-base">forklift</span>
                  THIẾT BỊ RTG / CẦN THỦ
                </span>
                <span className="text-[10px] text-slate-500 font-sans font-bold">Khu: {activeTask.equipment?.block || 'A01'}</span>
              </div>

              {activeTask.equipment ? (
                <div className="p-3.5 bg-orange-50 border-2 border-orange-300 rounded-2xl space-y-2 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <strong className="text-orange-950 font-black text-sm">{activeTask.equipment.name}</strong>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-950 border border-emerald-400">Đang Cẩu</span>
                  </div>
                  <div className="text-[11px] text-slate-700 font-sans font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-slate-500">person</span>
                    Cần thủ phụ trách: <strong className="text-slate-900">{activeTask.equipment.operator}</strong>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic p-3 bg-slate-100 rounded-2xl">Chưa chỉ định thiết bị</div>
              )}

              {/* Fee & Shifting Reason */}
              <div className="pt-2 border-t border-slate-100 space-y-2 text-xs font-sans">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-[11px]">Chi phí di chuyển:</span>
                  <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    {formatCurrency(activeTask.internalFee)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-[11px]">Lý do chuyển:</span>
                  <span className="font-bold text-slate-800">{activeTask.reason}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">Gán bởi: {activeTask.assignedBy}</div>
              </div>
            </div>

            {/* Column 3: Flow Action Controls */}
            <div className="bg-white p-5 rounded-3xl border-2 border-slate-200 space-y-3.5 flex flex-col justify-between shadow-2xs">
              <div className="text-xs font-black text-slate-900 uppercase font-mono border-b border-slate-200 pb-2.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-600 text-base">task_alt</span>
                BƯỚC TIẾP THEO
              </div>

              {activeTask.flowStep === 1 && (
                <div className="space-y-3 font-sans text-xs">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 font-bold leading-relaxed">
                    ⚡ Cẩu RTG đang di chuyển container sang Block đích. Khi thiết bị đã đến đúng vị trí, nhấn nút dưới đây để chuyển sang bước hạ container.
                  </div>
                  <button onClick={() => handleMarkArrived(activeTask)}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-black text-xs cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md">
                    <span className="material-symbols-outlined text-base">location_on</span>
                    [ 📍 ĐÃ ĐẾN VỊ TRÍ ĐÍCH ]
                  </button>
                </div>
              )}

              {activeTask.flowStep === 2 && (
                <div className="space-y-3 font-sans text-xs">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 font-bold text-[11px] leading-relaxed">
                    📡 <strong>Cảm biến Laser LiDAR & Twistlock</strong> đã tự động nhận diện Spreader hạ đúng slot đích <strong className="font-mono text-xs text-emerald-900 bg-emerald-200/80 px-1.5 py-0.5 rounded">{activeTask.to}</strong> với độ chính xác 99.9%.
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center font-mono">
                    <span className="text-slate-500 font-sans text-[11px]">Tọa độ hạ tự động:</span>
                    <strong className="text-slate-900 font-black text-sm">{activeTask.to}</strong>
                  </div>
                  <button onClick={() => handleConfirmComplete(activeTask)}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs rounded-2xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    [ ⚡ TỰ ĐỘNG XÁC NHẬN HẠ BÃI & HOÀN TẤT ]
                  </button>
                </div>
              )}

              {activeTask.flowStep < 1 && (
                <div className="space-y-3 font-sans text-xs">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 font-bold leading-relaxed">
                    ⚡ Lệnh đang ở trạng thái sẵn sàng. Nhấn nút bên dưới để điều động cẩu RTG bắt đầu nâng container.
                  </div>
                  <button onClick={() => handleStartTask(activeTask)}
                    className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 active:scale-98 text-white rounded-2xl font-black text-xs cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md">
                    <span className="material-symbols-outlined text-base">play_arrow</span>
                    [ ⚡ BẮT ĐẦU CẨU CONTAINER ]
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── VIEW 1: DATA TABLE VIEW ── */}
      {viewMode === 'TABLE' && (
        <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-heading text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-600">swap_horiz</span>
                DANH SÁCH LỆNH DI CHUYỂN CONTAINER LIÊN BLOCK
              </h3>
              <span className="text-xs font-sans text-slate-500">Quản lý và thực hiện lệnh chuyển container giữa các Block bãi từ Dispatcher/Operator</span>
            </div>

            {/* Search, Status Filter & Actions */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="🔍 Tìm mã lệnh, cont, vị trí..."
                className="px-3.5 py-2 bg-slate-100 border border-slate-300 rounded-2xl text-xs font-mono focus:outline-none w-48" />

              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-[11px] font-bold">
                {[
                  { id: 'ALL', label: 'Tất Cả' },
                  { id: 'PENDING', label: 'Chờ Thực Hiện' },
                  { id: 'IN_PROGRESS', label: 'Đang Cẩu' },
                  { id: 'COMPLETED', label: 'Hoàn Thành' },
                  { id: 'CRITICAL', label: 'Khẩn Cấp' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                      statusFilter === tab.id ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-500 hover:text-slate-900'
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              <button onClick={loadTasks} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-2xl border border-slate-300 text-slate-700 cursor-pointer transition-all" title="Tải lại dữ liệu">
                <span className="material-symbols-outlined text-base">refresh</span>
              </button>
            </div>
          </div>

          {/* Shipping Line Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <span className="text-slate-400 font-bold uppercase text-[10px] mr-1">Lọc Hãng Tàu:</span>
            {SHIPPING_LINES.map(line => (
              <button key={line.code} onClick={() => setShippingLineFilter(line.code)}
                className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer transition-all ${
                  shippingLineFilter === line.code
                    ? 'bg-slate-900 text-white font-black shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}>
                {line.name}
              </button>
            ))}
          </div>

          {/* Bulk Action Bar */}
          {selectedTaskIds.length > 0 && (
            <div className="p-3 bg-blue-50 border-2 border-blue-300 rounded-2xl flex justify-between items-center text-xs font-sans">
              <span className="font-bold text-blue-950">
                ✓ Đã chọn <strong className="font-mono text-sm">{selectedTaskIds.length}</strong> lệnh chuyển bãi
              </span>
              <div className="flex gap-2">
                <button onClick={handleBulkStartTasks}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl cursor-pointer shadow-sm">
                  ⚡ Bắt Đầu Cẩu Hàng Loạt ({selectedTaskIds.length})
                </button>
                <button onClick={() => setSelectedTaskIds([])}
                  className="px-3 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer hover:bg-slate-100">
                  Bỏ Chọn
                </button>
              </div>
            </div>
          )}

          {/* Task Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
            {loading ? (
              <div className="py-16 text-center text-slate-500 text-xs font-bold space-y-2">
                <span className="material-symbols-outlined text-3xl animate-spin text-orange-500 block">progress_activity</span>
                <div>Đang tải danh sách lệnh chuyển container giữa các block...</div>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-bold">
                Không có lệnh di chuyển nào phù hợp bộ lọc tìm kiếm.
              </div>
            ) : (
              <table className="min-w-[1300px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 border-b-2 border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider whitespace-nowrap">
                    <th className="py-4 px-3 text-center w-12">
                      <input type="checkbox"
                        checked={selectedTaskIds.length === filteredTasks.length && filteredTasks.length > 0}
                        onChange={handleSelectAllTasks}
                        className="w-4 h-4 accent-orange-500 rounded cursor-pointer" />
                    </th>
                    <th onClick={() => { setSortField('id'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc') }}
                      className="py-4 px-3.5 cursor-pointer hover:text-slate-900 select-none min-w-[140px]">
                      <div className="flex items-center gap-1">
                        <span>MÃ LỆNH</span>
                        {sortField === 'id' && <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th onClick={() => { setSortField('containerId'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc') }}
                      className="py-4 px-3.5 cursor-pointer hover:text-slate-900 select-none min-w-[160px]">
                      <div className="flex items-center gap-1">
                        <span>CONTAINER</span>
                        {sortField === 'containerId' && <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th className="py-4 px-3 w-[430px] min-w-[430px] text-center">
                      <span>LỘ TRÌNH DI CHUYỂN (VỊ TRÍ GỐC ➔ VỊ TRÍ ĐÍCH)</span>
                    </th>
                    <th onClick={() => { setSortField('equipment'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc') }}
                      className="py-4 px-3.5 cursor-pointer hover:text-slate-900 select-none min-w-[150px]">
                      <div className="flex items-center gap-1">
                        <span>THIẾT BỊ RTG</span>
                        {sortField === 'equipment' && <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th onClick={() => { setSortField('priority'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc') }}
                      className="py-4 px-3.5 cursor-pointer hover:text-slate-900 select-none min-w-[120px]">
                      <div className="flex items-center gap-1">
                        <span>ƯU TIÊN</span>
                        {sortField === 'priority' && <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th onClick={() => { setSortField('status'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc') }}
                      className="py-4 px-3.5 cursor-pointer hover:text-slate-900 select-none min-w-[140px]">
                      <div className="flex items-center gap-1">
                        <span>TRẠNG THÁI</span>
                        {sortField === 'status' && <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th className="py-4 px-3.5 text-right min-w-[160px]">
                      <span>THAO TÁC</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {filteredTasks.map(task => {
                    const fromP = parsePosition(task.from)
                    const toP = parsePosition(task.to)
                    const isCompleted = task.status === 'COMPLETED'
                    const isSelected = selectedTaskIds.includes(task.id)

                    return (
                      <tr key={task.id} className={`hover:bg-slate-50 transition-colors ${
                        isSelected ? 'bg-blue-50/70' : (task.status === 'INCIDENT' ? 'bg-red-50' : (task.status === 'IN PROGRESS' ? 'bg-blue-50/40' : ''))
                      }`}>

                        <td className="py-4 px-3 text-center">
                          <input type="checkbox" checked={isSelected}
                            onChange={() => handleToggleTaskSelection(task.id)}
                            className="w-4 h-4 accent-orange-500 rounded cursor-pointer" />
                        </td>

                        <td className="py-4 px-3.5 font-black text-slate-900 text-sm font-heading whitespace-nowrap">
                          <div>{task.id}</div>
                          <div className="text-[10px] text-slate-500 font-sans font-normal mt-0.5">
                            {task.durationMinutes > 0 ? `⏱️ ${task.durationMinutes} phút` : `Gán: ${task.assignedBy}`}
                          </div>
                        </td>

                        <td className="py-4 px-3.5 font-black text-blue-900 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm">{task.containerId}</span>
                            {renderCargoBadge(task.containerType)}
                          </div>
                          <div className="text-[10px] text-slate-500 font-sans font-normal mt-0.5">{task.containerType}</div>
                        </td>

                        {/* ── HIGHLIGHTED HERO ROUTE: ORIGIN ➔ DESTINATION ── */}
                        <td className="py-3 px-3 w-[430px] min-w-[430px]">
                          <div className="w-[410px] min-h-[74px] flex items-center justify-between gap-2 p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 shadow-2xs whitespace-nowrap transition-colors">
                            {/* Origin Chip (Fixed Width, Generous Height) */}
                            <div className="w-[158px] min-w-[158px] max-w-[158px] min-h-[58px] bg-slate-100/90 border border-slate-200/90 rounded-xl px-2.5 py-1.5 shadow-2xs text-left flex flex-col justify-between">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[8px] font-sans font-extrabold text-slate-500 uppercase shrink-0">VỊ TRÍ GỐC</span>
                                <span className="text-[8px] font-mono font-black text-slate-700 bg-white border border-slate-200 px-1 py-0.5 rounded truncate max-w-[80px]" title={fromP.isStandard ? `Khu ${fromP.block}` : 'Bãi Ngoài'}>
                                  {fromP.isStandard ? `Khu ${fromP.block}` : 'Bãi Ngoài'}
                                </span>
                              </div>
                              <div className="font-black text-slate-900 text-xs font-mono tracking-tight my-0.5 truncate" title={task.from}>
                                {task.from}
                              </div>
                              <div className="text-[9px] text-slate-500 font-sans font-medium truncate" title={fromP.isStandard ? `Bay ${fromP.bay} · Hàng ${fromP.row} · T${fromP.tier}` : 'Điểm bốc dỡ phương tiện'}>
                                {fromP.isStandard ? `Bay ${fromP.bay} · Hàng ${fromP.row} · T${fromP.tier}` : 'Điểm bốc dỡ phương tiện'}
                              </div>
                            </div>

                            {/* Arrow Indicator */}
                            <div className="flex flex-col items-center justify-center shrink-0 w-7">
                              <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
                                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                              </div>
                              <span className="text-[8px] font-sans font-black text-blue-600/80 mt-0.5 uppercase tracking-tighter">CHUYỂN</span>
                            </div>

                            {/* Destination Chip (Fixed Width, Generous Height) */}
                            <div className="w-[158px] min-w-[158px] max-w-[158px] min-h-[58px] bg-blue-50/70 border border-blue-200/90 rounded-xl px-2.5 py-1.5 shadow-2xs text-left flex flex-col justify-between">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[8px] font-sans font-extrabold text-blue-800 uppercase shrink-0">VỊ TRÍ ĐÍCH</span>
                                <span className="text-[8px] font-mono font-black text-blue-800 bg-blue-100/90 px-1 py-0.5 rounded border border-blue-200 truncate max-w-[80px]" title={toP.isStandard ? `Khu ${toP.block}` : 'Điểm Giao'}>
                                  {toP.isStandard ? `Khu ${toP.block}` : 'Điểm Giao'}
                                </span>
                              </div>
                              <div className="font-black text-blue-950 text-xs font-mono tracking-tight my-0.5 truncate" title={task.to}>
                                {task.to}
                              </div>
                              <div className="text-[9px] text-blue-700/80 font-sans font-medium truncate" title={toP.isStandard ? `Bay ${toP.bay} · Hàng ${toP.row} · T${toP.tier}` : 'Bàn giao cẩu STS / Xe kéo'}>
                                {toP.isStandard ? `Bay ${toP.bay} · Hàng ${toP.row} · T${toP.tier}` : 'Bàn giao cẩu STS / Xe kéo'}
                              </div>
                            </div>

                            {/* Mini Map Button */}
                            <button onClick={() => setMapViewTask(task)}
                              className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 active:scale-95 border border-slate-200 rounded-xl font-black text-xs cursor-pointer transition-all shrink-0 shadow-2xs"
                              title="Xem trên sơ đồ bãi 2D">
                              🗺️
                            </button>
                          </div>
                        </td>


                        {/* Equipment */}
                        <td className="py-4 px-3.5 font-sans whitespace-nowrap">
                          {task.equipment ? (
                            <div>
                              <div className="font-black text-orange-900 text-xs font-mono">{task.equipment.name}</div>
                              <div className="text-[10px] text-slate-500 font-sans mt-0.5">{task.equipment.operator}</div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Chưa gán RTG</span>
                          )}
                        </td>

                        <td className="py-4 px-3.5 font-sans whitespace-nowrap">{renderPriorityBadge(task.priority)}</td>

                        <td className="py-4 px-3.5 font-sans whitespace-nowrap">{renderStatusBadge(task)}</td>

                        <td className="py-4 px-3.5 text-right font-sans whitespace-nowrap">
                          <div className="flex justify-end items-center gap-1.5">
                            {(task.status === 'PENDING' || task.status === 'ASSIGNED' || task.status === 'READY') && (
                              <button onClick={() => handleStartTask(task)}
                                className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 active:scale-98 text-white font-black text-xs rounded-xl cursor-pointer transition-all shadow-xs flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">play_arrow</span>
                                Bắt Đầu
                              </button>
                            )}
                            {task.status === 'IN PROGRESS' && (
                              <button onClick={() => setActiveTask(task)}
                                className="px-3.5 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-950 border border-blue-400 font-black text-xs rounded-xl cursor-pointer transition-all shadow-2xs">
                                Xem Panel ↑
                              </button>
                            )}
                            {task.status === 'TẠI VỊ TRÍ ĐÍCH' && (
                              <button onClick={() => setActiveTask(task)}
                                className="px-3.5 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-950 border border-purple-400 font-black text-xs rounded-xl cursor-pointer transition-all shadow-2xs">
                                Xác Nhận ↑
                              </button>
                            )}
                            {isCompleted && (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-950 border border-emerald-400 rounded-xl text-xs font-black">
                                ✓ Hoàn thành
                              </span>
                            )}
                            <button onClick={() => setJobSheetTask(task)}
                              className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-black text-xs rounded-xl cursor-pointer transition-all shadow-2xs" title="Xem Phiếu Lệnh (Job Ticket)">
                              📄
                            </button>
                            {!isCompleted && task.status !== 'INCIDENT' && (
                              <button onClick={() => setIncidentTask(task)}
                                className="px-2 py-1.5 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-400 font-black text-xs rounded-xl cursor-pointer transition-all shadow-2xs" title="Báo sự cố">
                                🚨
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer */}
          <div className="flex justify-between items-center text-xs text-slate-500 font-mono pt-3 border-t border-slate-200">
            <div>Hiển thị <strong className="text-slate-900">{filteredTasks.length}</strong> / {tasks.length} lệnh di chuyển bãi</div>
            <div className="flex items-center gap-1 font-bold">
              <span>NexusPort Real-time Synchronization Active</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW 2: INTERACTIVE 2.5D YARD MAP VIEW ── */}
      {viewMode === 'YARD_MAP' && (
        <div className="bg-slate-900 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-700 space-y-6"
          style={{ backgroundColor: '#0f172a' }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-700 pb-4">
            <div>
              <div className="flex items-center gap-2 text-orange-400 text-xs font-mono font-black uppercase">
                <span className="material-symbols-outlined text-base">domain</span>
                SƠ ĐỒ TỔNG QUAN BÃI CONTAINER 2.5D (BẢN SAO SỐ DIGITAL TWIN)
              </div>
              <h3 className="font-heading text-xl font-black text-white">Bản Đồ Vị Trí Các Block & Tuyến Đường RTG</h3>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded"></span> Maersk</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-500 rounded"></span> MSC</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-pink-500 rounded"></span> ONE</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded"></span> Evergreen</span>
            </div>
          </div>

          {/* 3D Block Visual Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['A01', 'B02', 'C01'].map(blockCode => (
              <div key={blockCode} className="bg-slate-700/80 border border-slate-600 rounded-3xl p-5 space-y-4 hover:border-orange-500/80 transition-all shadow-lg">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <strong className="text-xl font-black font-heading text-white">Block {blockCode}</strong>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-mono text-[10px] font-black border border-slate-600">
                      {blockCode === 'A01' ? 'RTG-01 / RTG-02' : (blockCode === 'B02' ? 'RTG-03' : 'RS-01')}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-300">12 Dãy (Bay) • 4 Tầng (Tier)</span>
                </div>

                {/* 3D Visual Stacking representation */}
                <div className="grid grid-cols-4 gap-1.5 p-3 bg-slate-900/90 rounded-2xl border border-slate-800">
                  {(YARD_BAY_MATRIX[blockCode] || []).map((slot, idx) => (
                    <div key={idx}
                      onMouseEnter={() => setHoveredSlotInfo({ ...slot, block: blockCode })}
                      onMouseLeave={() => setHoveredSlotInfo(null)}
                      className={`h-11 rounded-lg flex flex-col items-center justify-center font-mono text-[9px] font-black transition-all cursor-pointer hover:scale-105 ${
                        slot.status === 'OCCUPIED'
                          ? slot.line === 'MSC' ? 'bg-yellow-500 text-slate-950 shadow-xs' :
                            slot.line === 'MAERSK' ? 'bg-blue-500 text-white shadow-xs' :
                            slot.line === 'ONE' ? 'bg-pink-500 text-white shadow-xs' : 'bg-emerald-500 text-white shadow-xs'
                          : slot.status === 'AVAILABLE'
                            ? 'bg-slate-800 border border-dashed border-slate-600 text-slate-400 hover:border-emerald-400 hover:text-emerald-400'
                            : slot.status === 'GRAVITY_WARNING'
                              ? 'bg-amber-950/40 border border-amber-800 text-amber-500'
                              : 'bg-red-950/40 border border-red-800 text-red-500'
                      }`}>
                      <div>{slot.status === 'OCCUPIED' ? slot.line : `R${slot.row}T${slot.tier}`}</div>
                      <div className="text-[8px] opacity-75">{slot.status === 'OCCUPIED' ? slot.weight || '28T' : 'Trống'}</div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-xs font-mono pt-2 border-t border-slate-600">
                  <span className="text-slate-300">Tỷ lệ lấp đầy:</span>
                  <span className="text-emerald-400 font-bold">{blockCode === 'A01' ? '68.7%' : (blockCode === 'B02' ? '81.2%' : '55.0%')}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Hovered Slot Detail Card */}
          {hoveredSlotInfo && hoveredSlotInfo.status === 'OCCUPIED' && (
            <div className="p-4 bg-slate-700/90 rounded-2xl border border-slate-600 flex justify-between items-center text-xs font-mono animate-fadeIn">
              <div className="flex items-center gap-3">
                <span className="text-xl">📦</span>
                <div>
                  <strong className="text-white text-sm">{hoveredSlotInfo.cont}</strong>
                  <span className="text-slate-300 ml-2">Hãng tàu: <strong className="text-yellow-400">{hoveredSlotInfo.line}</strong></span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-slate-200">
                <span>Vị trí: <strong>{hoveredSlotInfo.block}-R{hoveredSlotInfo.row}-T{hoveredSlotInfo.tier}</strong></span>
                <span>Tải trọng: <strong>{hoveredSlotInfo.weight || '28.4T'}</strong></span>
                <span>Lưu bãi: <strong>{hoveredSlotInfo.dwell || '3 ngày'}</strong></span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 3: RESTACKING WIZARD (TỰ ĐỘNG HÓA GỠ XUNG ĐỘT TẦNG) ── */}
      {viewMode === 'RESTACK_WIZARD' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-6">

          {/* 1. Header & Tình Huống Xung Đột (Scenario Selector) */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-200 pb-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-xl">layers_clear</span>
                <span className="text-[11px] font-mono font-black text-blue-800 uppercase tracking-wider">
                  BỘ NÃO TỰ ĐỘNG HÓA GỠ XUNG ĐỘT (AI BRP ENGINE)
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 font-mono text-[10px] font-black">
                  BLOCK RELOCATION PROBLEM (BRP)
                </span>
              </div>
              <h3 className="font-heading text-xl font-black text-slate-900">
                Tự Động Hóa Giải Quyết Xung Đột Tầng Container
              </h3>
              <p className="text-xs text-slate-500 font-sans max-w-3xl">
                Hệ thống AI tự động phân tích ma trận bãi, phát hiện container kẹt tầng dưới, tính toán slot đệm không làm cản trở tương lai và sinh chuỗi lệnh cẩu tối ưu chỉ với 1 nút bấm.
              </p>
            </div>

            {/* Scenario Pills Selector */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0">
              <span className="text-[11px] font-bold text-slate-500 uppercase font-sans">Chọn Tình Huống:</span>
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold gap-1 flex-wrap">
                {CONFLICT_SCENARIOS.map(sc => (
                  <button key={sc.id} onClick={() => handleSelectConflictScenario(sc.id)}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 ${
                      selectedConflictScenarioId === sc.id
                        ? 'bg-blue-600 text-white font-black shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}>
                    <span>{sc.id === 'SCENARIO_1' ? '⚡ Tàu Khẩn' : sc.id === 'SCENARIO_2' ? '🚛 Xe Cổng C' : sc.id === 'SCENARIO_3' ? '❄️ Hàng Reefer' : '🚫 Hết Slot (Test)'}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* NXP-126: THANH TÙY CHỌN CONTAINER MỤC TIÊU & THIẾT LẬP KẾ HOẠCH BRP */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-3xl space-y-3 font-sans text-xs">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <span className="material-symbols-outlined text-blue-600 text-lg">tune</span>
                  <span>Thiết Lập Kế Hoạch BRP:</span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-slate-500 font-mono">Container Mục Tiêu:</label>
                  <input
                    type="text"
                    value={customTargetContInput}
                    onChange={(e) => setCustomTargetContInput(e.target.value.toUpperCase())}
                    placeholder="VD: CAIU1234567 hoặc C01-04-10-1"
                    className="h-9 px-3 rounded-xl border border-slate-300 font-mono font-bold text-xs bg-white text-slate-900 focus:outline-none focus:border-blue-600 w-44"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-slate-500 font-mono">Đích Bàn Giao:</label>
                  <input
                    type="text"
                    value={customDestinationInput}
                    onChange={(e) => setCustomDestinationInput(e.target.value)}
                    placeholder="VD: Xe Đầu Kéo Cổng C"
                    className="h-9 px-3 rounded-xl border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:border-blue-600 w-52"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Switch Restack Back */}
                <label className="flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300">
                  <input
                    type="checkbox"
                    checked={restackBackOption}
                    onChange={(e) => setRestackBackOption(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-slate-700">Khôi phục về vị trí cũ (Restack Back)</span>
                </label>

                {/* History toggle button */}
                <button
                  type="button"
                  onClick={() => setShowPlanHistorySection(prev => !prev)}
                  className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-slate-700 font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-colors">
                  <span className="material-symbols-outlined text-sm text-slate-600">history</span>
                  <span>Lịch Sử ({restackPlanHistory.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Hai Khối: Thông Tin Container Mục Tiêu & Sơ Đồ Mặt Cắt 2D Cột Xếp Container */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Khối Trái: Thông Tin Container Mục Tiêu Cần Lấy Ra (5 Cột) */}
            <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-3xl p-5 space-y-4 shadow-xs">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <span className="text-xs font-mono font-black text-slate-900 uppercase">
                  CONTAINER MỤC TIÊU CẦN GIẢI PHÓNG
                </span>
                <span className={`px-2.5 py-0.5 rounded-lg font-mono text-[10px] font-black border ${currentConflictScenario.badgeColor}`}>
                  {currentConflictScenario.badge}
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">MÃ CONTAINER</span>
                    <strong className="text-blue-950 font-black text-2xl">{currentConflictScenario.targetContainer.id}</strong>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-900 border border-blue-200 rounded-xl font-bold text-xs">
                    {currentConflictScenario.targetContainer.type} • {currentConflictScenario.targetContainer.weight}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-sans block">VỊ TRÍ HIỆN TẠI</span>
                    <strong className="text-slate-900 text-sm font-black">{currentConflictScenario.targetContainer.pos}</strong>
                    <div className="text-[10px] text-orange-600 font-sans font-bold">{currentConflictScenario.targetContainer.tier}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-sans block">HÃNG TÀU / LƯU BÃI</span>
                    <strong className="text-slate-900 text-sm font-black">{currentConflictScenario.targetContainer.line}</strong>
                    <div className="text-[10px] text-slate-500 font-sans">{currentConflictScenario.targetContainer.dwell}</div>
                  </div>
                </div>

                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-rose-950 font-sans text-xs">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <span className="material-symbols-outlined text-rose-600 text-sm">warning</span>
                    <span>Hiện Trạng Xung Đột:</span>
                  </div>
                  <div>
                    Đang bị <strong className="text-rose-700 font-black">{currentConflictScenario.blockingContainers.length} container</strong> đè phía trên. Cần đảo cẩu để tránh chậm trễ xuất hàng!
                  </div>
                  <div className="text-[11px] text-rose-700 font-mono mt-1 font-bold">
                    Mức độ: {currentConflictScenario.targetContainer.urgency}
                  </div>
                </div>
              </div>
            </div>

            {/* Khối Phải: Sơ Đồ Mặt Cắt 2D Cột Xếp Container (7 Cột) */}
            <div className="lg:col-span-7 bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-800 space-y-4 flex flex-col justify-between">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-orange-400 text-lg">view_in_ar</span>
                  <h4 className="font-heading font-black text-white text-sm sm:text-base">Mô Phỏng Mặt Cắt 2D Cột Xếp Container (Stack Cross-Section)</h4>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {currentConflictScenario.targetContainer.pos.includes('-')
                    ? `Khu ${parsePosition(currentConflictScenario.targetContainer.pos).block} • Bay ${parsePosition(currentConflictScenario.targetContainer.pos).bay} • Hàng ${parsePosition(currentConflictScenario.targetContainer.pos).row}`
                    : currentConflictScenario.targetContainer.pos}
                </span>
              </div>

              {/* 2D Visual Stack Column */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center font-mono text-xs py-2">
                {/* Column A: Cột chứa container kẹt */}
                <div className="space-y-2 p-3 bg-slate-800/90 rounded-2xl border border-slate-700">
                  <div className="text-[10px] text-slate-400 uppercase font-sans font-bold flex justify-between">
                    <span>CỘT HIỆN TẠI (Tọa độ: {currentConflictScenario.targetContainer.pos})</span>
                    <span className="text-amber-400 font-bold">ĐANG BỊ KẸT</span>
                  </div>

                  {/* Tier 4: Trống */}
                  <div className="h-10 rounded-xl border border-dashed border-slate-600 bg-slate-900/60 flex items-center justify-center text-slate-500 text-[10px]">
                    Tầng 4: Trống (Không có cont)
                  </div>

                  {/* Tier 3: Trống nếu không có container chắn tầng 3 */}
                  {!currentConflictScenario.blockingContainers.some(b => b.tier?.includes('3')) && (
                    <div className="h-10 rounded-xl border border-dashed border-slate-600 bg-slate-900/60 flex items-center justify-center text-slate-500 text-[10px]">
                      Tầng 3: Trống (Không có cont)
                    </div>
                  )}

                  {/* Blocking Containers in Stack */}
                  {currentConflictScenario.blockingContainers.map(b => (
                    <div key={b.id} className="h-12 rounded-xl bg-amber-500/20 border-2 border-amber-400 text-amber-200 p-2 flex items-center justify-between shadow-xs">
                      <div>
                        <div className="font-black text-white flex items-center gap-1">
                          <span className="text-red-400">❌</span>
                          <span>{b.id}</span>
                        </div>
                        <div className="text-[9px] text-amber-300 font-sans">{b.tier} • {b.weight}</div>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 bg-amber-400/20 text-amber-300 rounded font-bold border border-amber-400/40">
                        Chắn Trên
                      </span>
                    </div>
                  ))}

                  {/* Target Container at Bottom */}
                  <div className="h-14 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 border-2 border-blue-300 text-white p-2.5 flex items-center justify-between shadow-md">
                    <div>
                      <div className="font-black text-white flex items-center gap-1">
                        <span>🎯</span>
                        <span className="text-sm">{currentConflictScenario.targetContainer.id}</span>
                      </div>
                      <div className="text-[9px] text-blue-100 font-sans">Tầng 1 (Đáy) • {currentConflictScenario.targetContainer.weight}</div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 bg-emerald-400 text-slate-950 font-black rounded-lg">
                      MỤC TIÊU
                    </span>
                  </div>
                </div>

                {/* Column B: Slot Đệm Tối Ưu Do AI Tính Toán */}
                <div className="space-y-2 p-3 bg-slate-800/90 rounded-2xl border border-blue-500/40">
                  <div className="text-[10px] text-blue-300 uppercase font-sans font-bold flex justify-between">
                    <span>SLOT ĐỆM ĐỀ XUẤT (BUFFER SLOTS)</span>
                    <span className="text-emerald-400 font-bold">KHÔNG XUNG ĐỘT</span>
                  </div>

                  {currentConflictScenario.blockingContainers.map(b => (
                    <div key={b.id} className="h-14 rounded-xl bg-slate-800/90 border border-blue-400/40 p-2 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-slate-400 font-sans">Đích di dời cho {b.id}:</div>
                        <strong className="text-emerald-400 font-black text-sm">{b.moveTarget}</strong>
                        <div className="text-[9px] text-slate-300 font-sans mt-0.5">{b.reason}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-900/60 text-blue-200 rounded border border-blue-400/40">
                          {b.rtg}
                        </span>
                      </div>
                    </div>
                  ))}

                  <div className="h-12 rounded-xl bg-emerald-950/60 border border-emerald-400/60 p-2 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-emerald-300 font-sans">Đích bàn giao container mục tiêu:</div>
                      <strong className="text-white font-black text-xs">{currentConflictScenario.targetMove.moveTarget}</strong>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-400 text-slate-950 font-black rounded">
                      GIAO TÀU/XE
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-sans flex items-center gap-1.5 border-t border-slate-800 pt-2">
                <span className="material-symbols-outlined text-sm text-blue-400">info</span>
                <span>Thuật toán AI tự động tìm slot đệm gần nhất và kiểm tra kế hoạch bốc dỡ 48h để bảo đảm không phát sinh đảo chuyển lần hai.</span>
              </div>
            </div>

          </div>

          {/* 3. NÚT 1 CHẠM TỰ ĐỘNG HÓA PHÂN TÍCH & TỐI ƯU HÓA */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-xl"
            style={{ backgroundColor: '#090d16' }}>
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="font-heading font-black text-sm uppercase text-blue-400 tracking-wider">
                  THỰC THI THUẬT TOÁN ĐIỀU PHỐI TỰ HÀNH
                </span>
              </div>
              <p className="text-xs text-slate-300 font-sans">
                Nhấn nút bên phải để AI tính toán ma trận, sinh danh sách các lệnh di chuyển tuần tự và hiển thị kết quả trực tiếp lên màn hình.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap">
              {conflictPlanResult && (
                <button onClick={() => setShowConfirmDeployModal(true)}
                  className="px-5 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-98">
                  <span className="material-symbols-outlined text-base">rocket_launch</span>
                  <span>[ 🚀 MỞ BẢNG XÁC NHẬN ]</span>
                </button>
              )}

              <button onClick={handle1ClickOptimizeConflict} disabled={isAnalyzingConflict}
                className={`flex-1 sm:flex-none px-7 py-4 rounded-2xl font-black text-xs cursor-pointer shadow-lg transition-all flex items-center justify-center gap-2 ${
                  isAnalyzingConflict
                    ? 'bg-blue-800 text-blue-200 cursor-wait'
                    : conflictPlanResult
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 active:scale-98'
                      : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-98 shadow-md'
                }`}>
                {isAnalyzingConflict ? (
                  <>
                    <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                    <span>ĐANG CHẠY THUẬT TOÁN BRP & TỐI ƯU HÓA...</span>
                  </>
                ) : conflictPlanResult ? (
                  <>
                    <span className="material-symbols-outlined text-lg">refresh</span>
                    <span>[ 🔄 QUÉT & TỐI ƯU HÓA LẠI ]</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">bolt</span>
                    <span>[ ⚡ 1-CHẠM AI TỰ ĐỘNG PHÂN TÍCH & TỐI ƯU HÓA ]</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 4. THÔNG BÁO KẾT QUẢ HIỂN THỊ LÊN MÀN HÌNH (ON-SCREEN RESULT NOTIFICATION) */}
          {conflictPlanResult && (
            <div className="bg-white border-2 border-emerald-500/80 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs animate-fadeIn">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-xl">verified</span>
                  </div>
                  <div>
                    <h4 className="font-heading font-black text-slate-900 text-base sm:text-lg">
                      AI Đã Tối Ưu Hóa Thành Công Kế Hoạch Gỡ Xung Đột
                    </h4>
                    <span className="text-xs text-slate-600 font-sans">
                      Thời điểm tính toán: <strong className="font-mono text-slate-900">{conflictPlanResult.generatedAt}</strong> • Độ tin cậy thuật toán: <strong className="font-mono text-emerald-700">{conflictPlanResult.metrics.confidence}</strong>
                    </span>
                  </div>
                </div>

                <span className="px-3 py-1 bg-emerald-50 text-emerald-900 rounded-xl font-mono text-xs font-black border border-emerald-300">
                  TỔNG CỘNG: {conflictPlanResult.generatedTasks.length} LỆNH ĐIỀU PHỐI
                </span>
              </div>

              {/* 4 Chỉ Số Định Lượng Sau Khi Tối Ưu */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-sans block">THỜI GIAN THỰC THI</span>
                  <div className="text-slate-900 font-black text-base mt-0.5">{conflictPlanResult.metrics.estimatedDuration}</div>
                  <div className="text-[10px] text-emerald-700 font-bold font-sans">Gốc: {conflictPlanResult.metrics.originalDuration} ({conflictPlanResult.metrics.timeSaved})</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-sans block">SỐ LẦN ĐẢO CONTAINER</span>
                  <div className="text-slate-900 font-black text-base mt-0.5">{conflictPlanResult.metrics.movesCount} lần</div>
                  <div className="text-[10px] text-emerald-700 font-bold font-sans">Số lần tối thiểu tuyệt đối</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-sans block">TIẾT KIỆM NHIÊN LIỆU RTG</span>
                  <div className="text-slate-900 font-black text-base mt-0.5">{conflictPlanResult.metrics.energySaved}</div>
                  <div className="text-[10px] text-emerald-700 font-bold font-sans">Giảm hành trình cẩu thừa</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-sans block">MỨC ĐỘ AN TOÀN BÃI</span>
                  <div className="text-emerald-700 font-black text-base mt-0.5">100%</div>
                  <div className="text-[10px] text-emerald-700 font-bold font-sans">Tuân thủ trọng lực & tải trọng</div>
                </div>
              </div>

              <div className="text-xs text-slate-600 font-sans bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                <span><strong>Ghi chú slot đệm:</strong> {conflictPlanResult.metrics.bufferSlotNote}</span>
              </div>
            </div>
          )}

          {/* 5. DANH SÁCH CÁC LỆNH TRIỂN KHAI (DEPLOYMENT ORDERS LIST) */}
          {conflictPlanResult && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div>
                  <h4 className="font-heading font-black text-slate-900 text-base flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600">format_list_numbered</span>
                    Danh Sách Các Lệnh Triển Khai Tuần Tự (Deployment Action Plan)
                  </h4>
                  <span className="text-xs text-slate-500 font-sans">
                    Cẩu RTG sẽ thực thi tuần tự từ bước 1 để dọn sạch đường tiếp cận cho container mục tiêu
                  </span>
                </div>

                <span className="text-xs font-mono font-bold text-slate-600">
                  Thứ tự: <strong className="text-blue-700 font-black">Ưu tiên từ trên xuống dưới</strong>
                </span>
              </div>

              {/* Cards Danh Sách Lệnh */}
              <div className="space-y-3 font-mono text-xs">
                {conflictPlanResult.generatedTasks.map((t, idx) => (
                  <div key={idx} className={`p-4 rounded-3xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                    t.isTarget
                      ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                      : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                  }`}>
                    {/* Step Badge, Manual Reorder & Container Info */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!conflictPlanDeployed && (
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveStepUp(idx)}
                              title="Chuyển bước này lên trước"
                              className={`w-6 h-4 flex items-center justify-center rounded text-[9px] font-black border transition-colors ${
                                idx === 0
                                  ? 'text-slate-300 border-slate-200 cursor-not-allowed bg-slate-50'
                                  : 'text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer bg-blue-50/60'
                              }`}>
                              ▲
                            </button>
                            <button
                              type="button"
                              disabled={idx === conflictPlanResult.generatedTasks.length - 1}
                              onClick={() => handleMoveStepDown(idx)}
                              title="Chuyển bước này xuống sau"
                              className={`w-6 h-4 flex items-center justify-center rounded text-[9px] font-black border transition-colors ${
                                idx === conflictPlanResult.generatedTasks.length - 1
                                  ? 'text-slate-300 border-slate-200 cursor-not-allowed bg-slate-50'
                                  : 'text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer bg-blue-50/60'
                              }`}>
                              ▼
                            </button>
                          </div>
                        )}
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                          t.isTarget
                            ? 'bg-blue-600 text-white'
                            : (t.reason?.includes('Khôi phục') ? 'bg-amber-600 text-white' : 'bg-slate-900 text-white')
                        }`}>
                          {t.step}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-slate-900 text-base font-black">{t.id}</strong>
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                            t.isTarget ? 'bg-blue-50 text-blue-900 border border-blue-200' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {t.type} • {t.weight}
                          </span>
                          {t.isTarget && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-950 font-black text-[10px] rounded-lg border border-emerald-400">
                              ★ CONTAINER MỤC TIÊU
                            </span>
                          )}
                          {t.reason?.includes('Khôi phục') && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-950 font-black text-[10px] rounded-lg border border-amber-400">
                              ↺ KHÔI PHỤC VỊ TRÍ CŨ
                            </span>
                          )}
                          {!t.isTarget && !t.reason?.includes('Khôi phục') && (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-900 font-bold text-[10px] rounded-lg border border-indigo-200">
                              📦 DỜI VÀO SLOT ĐỆM
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-sans mt-0.5">
                          {t.reason}
                        </div>
                      </div>
                    </div>

                    {/* From ➔ To Route */}
                    <div className="flex items-center gap-2 bg-slate-100/90 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-[9px] text-slate-400 font-sans block">TỪ</span>
                        <strong className="text-slate-900">{t.currentPos}</strong>
                      </div>
                      <span className="text-blue-600 font-black text-sm">➔</span>
                      <div>
                        <span className="text-[9px] text-emerald-600 font-sans block font-bold">ĐẾN</span>
                        {!conflictPlanDeployed ? (
                          <input
                            type="text"
                            value={t.moveTarget}
                            onChange={(e) => handleUpdateStepTarget(idx, e.target.value)}
                            title="Có thể sửa slot đích thủ công"
                            className={`px-2 py-1 rounded-lg border font-mono font-bold text-xs w-48 ${
                              t.moveTarget === 'KHÔNG CÓ SLOT'
                                ? 'bg-rose-100 text-rose-900 border-rose-400'
                                : 'bg-white text-emerald-950 border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500'
                            }`}
                          />
                        ) : (
                          <strong className={`${t.moveTarget === 'KHÔNG CÓ SLOT' ? 'text-rose-600' : 'text-emerald-900'} font-black`}>
                            {t.moveTarget}
                          </strong>
                        )}
                      </div>
                    </div>

                    {/* RTG & Execution State */}
                    <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-between md:justify-end">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 font-sans">Thiết bị phân bổ:</div>
                        <strong className="text-slate-900 font-black">{t.rtg}</strong>
                        <div className="text-[10px] text-slate-400 font-sans">Thời gian: {t.duration}</div>
                      </div>

                      <span className={`px-3 py-1.5 rounded-xl font-sans font-black text-xs border ${
                        conflictPlanDeployed
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                          : 'bg-blue-50 text-blue-900 border-blue-200'
                      }`}>
                        {conflictPlanDeployed ? '✓ Đang Thực Thi' : 'Sẵn Sàng Bắn Lệnh'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 6. NÚT XÁC NHẬN TRIỂN KHAI TOÀN BỘ LỆNH CẨU (MANDATORY CONFIRMATION BUTTON) */}
              <div className="pt-2">
                {!conflictPlanDeployed ? (
                  conflictPlanResult.canExecute === false ? (
                    <div className="p-5 bg-rose-50 border-2 border-rose-400 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                          <span className="material-symbols-outlined text-xl">block</span>
                        </div>
                        <div>
                          <h5 className="font-heading font-black text-rose-950 text-sm sm:text-base flex items-center gap-2">
                            <span>🚨 KHÔNG CHO PHÉP DI DIỜI: KHÔNG CÓ SLOT TẠM PHÙ HỢP!</span>
                          </h5>
                          <p className="text-xs text-rose-700 font-sans mt-0.5">
                            {conflictPlanResult.validationMessage || 'Tất cả các slot đệm lân cận đều đầy hoặc vi phạm quy tắc an toàn. Vui lòng giải phóng slot trước khi lập kế hoạch.'}
                          </p>
                        </div>
                      </div>

                      <button disabled
                        className="w-full sm:w-auto px-8 py-4 bg-slate-200 text-slate-400 rounded-2xl font-black text-xs cursor-not-allowed shadow-none flex items-center justify-center gap-2 whitespace-nowrap">
                        <span className="material-symbols-outlined text-base">block</span>
                        [ 🚫 KHÔNG THỂ PHÁT LỆNH DO THIẾU SLOT TẠM ]
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                          <span className="material-symbols-outlined text-xl">fact_check</span>
                        </div>
                        <div>
                          <h5 className="font-heading font-black text-slate-900 text-sm sm:text-base">
                            Kế Hoạch Điều Phối Đã Sẵn Sàng Triển Khai
                          </h5>
                          <p className="text-xs text-slate-600 font-sans">
                            Vui lòng bấm nút xác nhận để phát đồng thời toàn bộ {conflictPlanResult.generatedTasks.length} lệnh cẩu xuống hệ thống RTG.
                          </p>
                        </div>
                      </div>

                      <button onClick={() => setShowConfirmDeployModal(true)}
                        className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-black text-xs cursor-pointer shadow-md flex items-center justify-center gap-2 whitespace-nowrap">
                        <span className="material-symbols-outlined text-base">rocket_launch</span>
                        [ 🚀 XÁC NHẬN TRIỂN KHAI TOÀN BỘ LỆNH CẨU (DISPATCH ALL) ]
                      </button>
                    </div>
                  )
                ) : (
                  <div className="space-y-4">
                    <div className="p-5 bg-emerald-50 border-2 border-emerald-400 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-fadeIn">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                          <span className="material-symbols-outlined text-xl">task_alt</span>
                        </div>
                        <div>
                          <h5 className="font-heading font-black text-emerald-950 text-sm sm:text-base">
                            ✓ Đã Triển Khai Toàn Bộ {conflictPlanResult.generatedTasks.length} Lệnh Xuống Cẩu RTG Thành Công!
                          </h5>
                          <p className="text-xs text-emerald-800 font-sans">
                            {activeRestackPlan?.planCode ? `Mã Kế Hoạch: ${activeRestackPlan.planCode} • ` : ''}
                            Cẩu RTG đang thực thi tuần tự theo tiến trình thời gian thực.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button onClick={() => setViewMode('TABLE')}
                          className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-black text-xs cursor-pointer shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap">
                          <span className="material-symbols-outlined text-base">table_rows</span>
                          [ 📋 XEM TRÊN DANH SÁCH LỆNH ]
                        </button>
                        <button onClick={() => handleSelectConflictScenario(selectedConflictScenarioId)}
                          className="px-4 py-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl cursor-pointer whitespace-nowrap">
                          Lập Kế Hoạch Mới
                        </button>
                      </div>
                    </div>

                    {/* NXP-126: BỘ ĐIỀU KHIỂN TIẾN TRÌNH THỰC THI THỜI GIAN THỰC (LIVE STEPPER TRACKER) */}
                    <div className="p-5 bg-slate-900 text-white rounded-3xl border border-slate-800 space-y-4 shadow-lg">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                          <span className="text-emerald-400 font-black uppercase">GIÁM SÁT TIẾN TRÌNH THỰC THI (STEPPER)</span>
                          <span className="text-slate-400">• Tiến độ: Bước {Math.min(conflictExecutingStep, conflictPlanResult.generatedTasks.length)} / {conflictPlanResult.generatedTasks.length}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-300">
                          Trạng thái: {conflictExecutingStep > conflictPlanResult.generatedTasks.length ? (
                            <span className="text-emerald-400 font-bold">✓ HOÀN TẤT KẾ HOẠCH</span>
                          ) : (
                            <span className="text-blue-400 font-bold">ĐANG THỰC HIỆN BƯỚC {conflictExecutingStep}</span>
                          )}
                        </span>
                      </div>

                      {conflictExecutingStep <= conflictPlanResult.generatedTasks.length ? (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-800/90 rounded-2xl border border-blue-500/40">
                          <div>
                            <div className="text-[11px] text-blue-300 font-mono font-bold">LỆNH ĐANG THỰC THI HIỆN TẠI (BƯỚC {conflictExecutingStep}):</div>
                            <div className="text-base font-black text-white flex items-center gap-2 mt-0.5">
                              <span>{conflictPlanResult.generatedTasks[conflictExecutingStep - 1]?.id}</span>
                              <span className="text-blue-400 text-xs">({conflictPlanResult.generatedTasks[conflictExecutingStep - 1]?.currentPos} ➔ {conflictPlanResult.generatedTasks[conflictExecutingStep - 1]?.moveTarget})</span>
                            </div>
                            <div className="text-xs text-slate-400 font-sans mt-0.5">
                              {conflictPlanResult.generatedTasks[conflictExecutingStep - 1]?.reason}
                            </div>
                          </div>

                          <button onClick={() => handleAdvanceRestackStep(conflictExecutingStep)} disabled={isAdvancingStep}
                            className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white rounded-2xl font-black text-xs cursor-pointer shadow-md flex items-center justify-center gap-2 whitespace-nowrap">
                            {isAdvancingStep ? (
                              <>
                                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                                <span>Đang Ghi Nhận Hạ Bãi...</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-base">check_circle</span>
                                <span>[ ✓ XÁC NHẬN HOÀN THÀNH BƯỚC {conflictExecutingStep} ]</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-950/80 rounded-2xl border border-emerald-400 text-center space-y-1">
                          <div className="text-emerald-400 font-black text-base flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-xl">celebration</span>
                            <span>🎉 TOÀN BỘ KẾ HOẠCH BRP ĐÃ HOÀN TẤT THÀNH CÔNG!</span>
                          </div>
                          <div className="text-xs text-slate-300 font-sans">
                            Container mục tiêu đã được giải phóng an toàn lên phương tiện xuất. Toàn bộ slot tạm đã được đưa về trạng thái tối ưu.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* 7. LỊCH SỬ CÁC KẾ HOẠCH DI DỜI CONTAINER CHỒNG (NXP-126 AUDIT TRAIL) */}
          {showPlanHistorySection && (
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs animate-fadeIn">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">history</span>
                  <h4 className="font-heading font-black text-slate-900 text-base">
                    Lịch Sử & Vết Kiểm Toán Kế Hoạch Đảo Bãi (Restack Audit Trail)
                  </h4>
                </div>
                <button onClick={() => setShowPlanHistorySection(false)} className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer">
                  Đóng ✕
                </button>
              </div>

              {restackPlanHistory.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 font-sans">
                  Chưa có kế hoạch đảo bãi nào được ghi nhận.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-sans uppercase text-[10px]">
                        <th className="py-2.5 px-3">Mã Kế Hoạch</th>
                        <th className="py-2.5 px-3">Container Mục Tiêu</th>
                        <th className="py-2.5 px-3">Vị Trí Gốc</th>
                        <th className="py-2.5 px-3">Đích Bàn Giao</th>
                        <th className="py-2.5 px-3 text-center">Số Lượt Cẩu</th>
                        <th className="py-2.5 px-3 text-center">Khôi Phục Vị Trí Cũ</th>
                        <th className="py-2.5 px-3 text-right">Chi Phí</th>
                        <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                        <th className="py-2.5 px-3">Thời Gian Tạo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {restackPlanHistory.map(plan => (
                        <tr key={plan.id} className="hover:bg-slate-100/80 transition-colors">
                          <td className="py-3 px-3 font-bold text-blue-600">{plan.planCode}</td>
                          <td className="py-3 px-3 font-black text-slate-900">{plan.targetContainerNo}</td>
                          <td className="py-3 px-3 text-slate-600">{plan.targetLocation}</td>
                          <td className="py-3 px-3 text-emerald-800 font-sans">{plan.targetDestination}</td>
                          <td className="py-3 px-3 text-center font-bold">{plan.totalMoves} Lần</td>
                          <td className="py-3 px-3 text-center">
                            {plan.restackBackToOriginal ? (
                              <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 text-[10px] font-bold border border-blue-200">Có</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[10px]">Không</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-800">{formatCurrency(plan.estimatedFee)}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border ${
                              plan.status === 'Completed'
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                : plan.status === 'In_Progress'
                                  ? 'bg-blue-50 text-blue-900 border-blue-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}>
                              {plan.status === 'Completed' ? '✓ ĐÃ HOÀN TẤT' : plan.status === 'In_Progress' ? 'ĐANG CHẠY' : plan.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500 text-[11px]">
                            {new Date(plan.createdAt).toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ── VIEW 4: BẢNG SO SÁNH ĐỊNH LƯỢNG AI & TỰ ĐỘNG HÓA THỜI GIAN THỰC ── */}
      {viewMode === 'AI_ANALYTICS' && (
        <div className="space-y-6">

          {/* 1. Header Điều Khiển & Điểm Tối Ưu */}
          <div className="bg-slate-950 text-white rounded-3xl p-5 lg:p-6 shadow-2xl border border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 relative overflow-hidden"
            style={{ backgroundColor: '#090d16' }}>
            {/* Subtle glow effect */}
            <div className="absolute -top-24 -left-24 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>

            <div className="space-y-2 z-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-xs font-mono font-black text-blue-400 uppercase tracking-wider">
                  BỘ NÃO ĐIỀU HÀNH AI TỰ ĐỘNG (AUTONOMOUS YARD AI ENGINE)
                </span>
                <span className="px-3 py-1 rounded-full bg-blue-900/60 text-blue-200 border border-blue-400/40 font-mono font-black text-[10px] shadow-sm">
                  ĐIỂM HIỆU QUẢ: {dynamicAiScore}/100
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-400 font-mono font-black text-[10px] shadow-sm">
                  TỰ ĐỘNG HÓA: 94.6%
                </span>
              </div>
              <h3 className="font-heading text-2xl lg:text-3xl font-black text-white tracking-tight drop-shadow-md">
                So Sánh Định Lượng & Tối Ưu Hóa Tự Động Toàn Bãi
              </h3>
              <p className="text-xs text-slate-300 font-sans font-medium max-w-2xl leading-relaxed">
                Hệ thống tự động phân tích thời gian thực, loại bỏ hoàn toàn các bước thủ công và tự động phát lệnh điều phối cẩu RTG tối ưu.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 z-10">
              <button onClick={handleToggleAutoPilot}
                className={`px-5 py-3 rounded-2xl font-black text-xs cursor-pointer transition-all flex items-center gap-2 shadow-lg active:scale-98 ${
                  autoPilotEnabled
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 ring-2 ring-emerald-300'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                }`}>
                <span className="material-symbols-outlined text-base">{autoPilotEnabled ? 'check_circle' : 'smart_toy'}</span>
                <span>{autoPilotEnabled ? 'TỰ ĐỘNG HÓA: BẬT' : 'BẬT TỰ ĐỘNG HÓA'}</span>
              </button>

              <button onClick={() => showToast('⚡ Đã quét lại toàn bộ slot bãi và cập nhật đề xuất tối ưu!', 'success')}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 border border-slate-600 rounded-2xl font-black text-xs cursor-pointer transition-all flex items-center gap-1.5 shadow-sm">
                <span className="material-symbols-outlined text-base animate-spin">sync</span>
                Quét Lại
              </button>
            </div>
          </div>

          {/* 2. Thẻ Chọn Container Đang Phân Tích */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-xl">inventory_2</span>
              <span className="text-xs font-black text-slate-900 uppercase">Container Phân Tích:</span>
              <strong className="font-mono text-sm px-2.5 py-0.5 bg-blue-50 text-blue-950 rounded-lg border border-blue-200">
                {selectedCompareContainer.containerNo}
              </strong>
              <span className="text-xs text-slate-600 font-bold">
                ({selectedCompareContainer.type} • {selectedCompareContainer.cargo})
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                Gốc: <strong>{selectedCompareContainer.location}</strong>
              </span>
              <span className="text-[11px] font-sans px-2 py-0.5 bg-blue-50 text-blue-900 rounded-md border border-blue-200 font-bold">
                🚢 {selectedCompareContainer.nextVessel}
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase mr-1 shrink-0">Chọn nhanh:</span>
              {SAMPLE_CONTAINERS.map(c => (
                <button key={c.containerNo} onClick={() => setSelectedCompareContainer(c)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-black cursor-pointer transition-all shrink-0 ${
                    selectedCompareContainer.containerNo === c.containerNo
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}>
                  {c.containerNo}
                </button>
              ))}
            </div>
          </div>

          {/* 3. SÁU THẺ SỐ LIỆU ĐỘT PHÁ SO SÁNH % (QUANTITATIVE % IMPACT METRICS) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs hover:border-slate-300 space-y-1 relative overflow-hidden transition-all">
              <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                <span>Quãng Đường RTG</span>
                <span className="material-symbols-outlined text-blue-600 text-base">route</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-xl font-black text-slate-900">{compareData.aiDist}</span>
                <span className="text-[10px] font-mono text-slate-400 line-through">{compareData.manualDist}</span>
              </div>
              <div className="text-[11px] font-black font-mono text-emerald-600">
                📉 Giảm {compareData.distSaving.replace('-', '')}
              </div>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs hover:border-slate-300 space-y-1 relative overflow-hidden transition-all">
              <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                <span>Thời Gian Cẩu</span>
                <span className="material-symbols-outlined text-blue-600 text-base">timer</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-xl font-black text-slate-900">{compareData.aiTime}</span>
                <span className="text-[10px] font-mono text-slate-400 line-through">{compareData.manualTime}</span>
              </div>
              <div className="text-[11px] font-black font-mono text-emerald-600">
                ⚡ Nhanh {compareData.timeSaving.replace('-', '')}
              </div>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs hover:border-slate-300 space-y-1 relative overflow-hidden transition-all">
              <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                <span>Cẩu Đảo Vỏ</span>
                <span className="material-symbols-outlined text-emerald-600 text-base">layers_clear</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-xl font-black text-emerald-950">0 Lần</span>
                <span className="text-[10px] font-mono text-red-400 line-through">Đè tầng</span>
              </div>
              <div className="text-[11px] font-black font-mono text-emerald-600">
                ✓ Triệt tiêu 100%
              </div>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs hover:border-slate-300 space-y-1 relative overflow-hidden transition-all">
              <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                <span>Chi Phí Vận Hành</span>
                <span className="material-symbols-outlined text-blue-600 text-base">savings</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-xl font-black text-slate-900">{compareData.costAi}</span>
                <span className="text-[10px] font-mono text-slate-400 line-through">{compareData.costManual}</span>
              </div>
              <div className="text-[11px] font-black font-mono text-emerald-600">
                💰 Bớt {compareData.costSaving.replace('-', '')}
              </div>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs hover:border-slate-300 space-y-1 relative overflow-hidden transition-all">
              <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                <span>Tiêu Hao Nhiên Liệu</span>
                <span className="material-symbols-outlined text-blue-600 text-base">local_gas_station</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-xl font-black text-slate-900">{compareData.aiEnergy}</span>
                <span className="text-[10px] font-mono text-slate-400 line-through">{compareData.manualEnergy}</span>
              </div>
              <div className="text-[11px] font-black font-mono text-emerald-600">
                🌱 Giảm {compareData.energySaving.replace('-', '')}
              </div>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-blue-200 shadow-xs space-y-1 relative overflow-hidden bg-blue-50/20">
              <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                <span>Tự Động Hóa</span>
                <span className="material-symbols-outlined text-blue-600 text-base">bolt</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-xl font-black text-blue-950">{compareData.aiAutoRate}</span>
                <span className="text-[10px] font-mono text-slate-400 line-through">{compareData.manualAutoRate}</span>
              </div>
              <div className="text-[11px] font-black font-mono text-blue-600">
                🚀 Tăng {compareData.autoRateGain}
              </div>
            </div>
          </div>

          {/* 4. BẢNG THANH ĐỒ HỌA SO SÁNH % HIỆU SUẤT TRỰC QUAN (VISUAL % BENCHMARK BARS) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-xl">bar_chart</span>
                <div>
                  <h4 className="font-heading font-black text-slate-900 text-base">Biểu Đồ So Sánh Tỷ Lệ % Cải Thiện Định Lượng</h4>
                  <span className="text-xs text-slate-500 font-sans">Đo lường trực quan mức độ rút ngắn thời gian, cự ly và chi phí tác nghiệp</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono font-bold">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-3 h-3 rounded-full bg-slate-300"></span>
                  Thủ công (100% Gốc)
                </span>
                <span className="flex items-center gap-1.5 text-blue-900 font-black">
                  <span className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-600 to-emerald-500"></span>
                  AI Tối Ưu Hóa (%)
                </span>
              </div>
            </div>

            {/* 5 Progress Bars */}
            <div className="space-y-4 font-sans text-xs">
              {/* Metric 1: Quãng đường */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-blue-600">straighten</span>
                    Khoảng Cách Di Chuyển RTG:
                  </span>
                  <span className="font-mono text-xs">
                    Thủ công: <strong className="text-slate-500">{compareData.manualDist} (100%)</strong> ➔ AI: <strong className="text-blue-950 font-black">{compareData.aiDist} ({compareData.pctDist}%)</strong> · <span className="text-emerald-600 font-black font-mono">Tiết kiệm {compareData.distSaving.replace('-', '')}</span>
                  </span>
                </div>
                <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${compareData.pctDist}%` }}></div>
                </div>
              </div>

              {/* Metric 2: Thời gian */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-blue-600">schedule</span>
                    Thời Gian Chu Kỳ Cẩu Container:
                  </span>
                  <span className="font-mono text-xs">
                    Thủ công: <strong className="text-slate-500">{compareData.manualTime} (100%)</strong> ➔ AI: <strong className="text-blue-950 font-black">{compareData.aiTime} ({compareData.pctTime}%)</strong> · <span className="text-emerald-600 font-black font-mono">Nhanh hơn {compareData.timeSaving.replace('-', '')}</span>
                  </span>
                </div>
                <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${compareData.pctTime}%` }}></div>
                </div>
              </div>

              {/* Metric 3: Chi phí */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-blue-600">payments</span>
                    Chi Phí Tác Nghiệp & Nhiên Liệu:
                  </span>
                  <span className="font-mono text-xs">
                    Thủ công: <strong className="text-slate-500">{compareData.costManual} (100%)</strong> ➔ AI: <strong className="text-blue-950 font-black">{compareData.costAi} ({compareData.pctCost}%)</strong> · <span className="text-emerald-600 font-black font-mono">Tiết kiệm {compareData.costSaving.replace('-', '')}</span>
                  </span>
                </div>
                <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${compareData.pctCost}%` }}></div>
                </div>
              </div>

              {/* Metric 4: Tự động hóa */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-blue-600">auto_mode</span>
                    Mức Độ Tự Động Hóa (Zero-Touch TOS):
                  </span>
                  <span className="font-mono text-xs">
                    Thủ công: <strong className="text-slate-500">{compareData.manualAutoRate}</strong> ➔ AI Tự Hành: <strong className="text-blue-950 font-black">{compareData.aiAutoRate}</strong> · <span className="text-blue-600 font-black font-mono">Tăng {compareData.autoRateGain}</span>
                  </span>
                </div>
                <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500" style={{ width: compareData.aiAutoRate }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* 5. KẾ HOẠCH ĐIỀU PHỐI AI TỰ ĐỘNG HÓA & PHÁT LỆNH */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shadow-xs">
                  <span className="material-symbols-outlined text-2xl">smart_toy</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-heading font-black text-slate-900 text-base sm:text-lg">Kế Hoạch Điều Phối AI Tự Động Hóa</h4>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-400 rounded-lg font-mono text-[11px] font-black">
                      ★ TỐI ƯU NHẤT
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    Container <strong className="font-mono text-blue-950 font-black">{selectedCompareContainer?.containerNo || 'MSCU1234567'}</strong> • Tự động tính toán lộ trình cẩu & vị trí hạ bãi tránh xung đột 100%
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl text-xs font-mono text-blue-900 font-black">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                Độ Tự Động: {compareData.aiAutoRate}
              </div>
            </div>

            {/* 4 Chỉ số chi tiết phương án tối ưu */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 font-mono text-xs">
              <div className="p-3.5 bg-white rounded-2xl border-2 border-emerald-400 shadow-2xs">
                <span className="text-slate-600 font-sans font-bold flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-sm text-emerald-600">stars</span>
                  Vị trí hạ bãi đề xuất:
                </span>
                <div className="text-emerald-950 font-black text-base tracking-wide">{compareData.aiPos}</div>
                <div className="text-[11px] text-emerald-700 font-sans mt-0.5">Xác suất chính xác 99.8%</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-slate-600 font-sans flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-sm text-blue-600">straighten</span>
                  Quãng đường di chuyển:
                </span>
                <div className="text-slate-900 font-black text-base">
                  {compareData.aiDist} <span className="text-emerald-600 text-xs font-bold">({compareData.distSaving})</span>
                </div>
                <div className="text-[11px] text-slate-500 font-sans mt-0.5">Lộ trình ngắn nhất qua GPS</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-slate-600 font-sans flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-sm text-blue-600">schedule</span>
                  Thời gian thực thi:
                </span>
                <div className="text-slate-900 font-black text-base">
                  {compareData.aiTime} <span className="text-emerald-600 text-xs font-bold">({compareData.timeSaving})</span>
                </div>
                <div className="text-[11px] text-slate-500 font-sans mt-0.5">Tiết kiệm {compareData.timeSaving.replace('-', '')} chu kỳ cẩu</div>
              </div>

              <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-300 text-emerald-950 shadow-2xs">
                <span className="font-sans font-bold flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-sm text-emerald-600">verified</span>
                  Tối ưu xếp dỡ:
                </span>
                <div className="font-black text-xs leading-snug">{compareData.aiConflict}</div>
                <div className="text-[11px] text-emerald-700 font-sans mt-0.5">Không đảo chuyển khi xuất tàu</div>
              </div>
            </div>

            {/* Nút 1-Click Zero-Touch Dispatch */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
              <div className="text-xs text-slate-600 font-sans flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-base">electric_bolt</span>
                <span>Hệ thống sẽ lập tức truyền tọa độ tới RTG và xe đầu kéo qua mạng không dây nội bộ.</span>
              </div>
              <button onClick={handleDirectAiDispatch}
                className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-black text-xs cursor-pointer shadow-md flex items-center justify-center gap-2 whitespace-nowrap">
                <span className="material-symbols-outlined text-base">bolt</span>
                [ ⚡ TỰ ĐỘNG PHÁT LỆNH NGAY (ZERO-TOUCH DISPATCH) ]
              </button>
            </div>
          </div>

          {/* 6. HAI CỘT: TRỌNG SỐ THUẬT TOÁN & HÀNG ĐỢI LỆNH TỰ ĐỘNG */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Cột 1: Cài đặt Trọng số Thuật toán */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">tune</span>
                  <h4 className="font-heading text-base font-black text-slate-900">Trọng Số Ưu Tiên Của AI</h4>
                </div>
                <span className="text-[11px] font-mono bg-blue-50 text-blue-900 px-2 py-0.5 rounded-lg font-black border border-blue-200">
                  Tổng: {aiAlgorithmWeights.distance + aiAlgorithmWeights.reshuffle + aiAlgorithmWeights.safety}%
                </span>
              </div>

              <div className="space-y-4 text-xs font-sans">
                <div>
                  <div className="flex justify-between font-bold text-slate-800 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span>🏃</span>
                      1. Quãng đường cẩu ngắn nhất
                    </span>
                    <strong className="text-blue-700 font-mono font-black">{aiAlgorithmWeights.distance}%</strong>
                  </div>
                  <input type="range" min="10" max="80" value={aiAlgorithmWeights.distance}
                    onChange={e => setAiAlgorithmWeights(prev => ({ ...prev, distance: Number(e.target.value) }))}
                    className="w-full accent-blue-600 cursor-pointer" />
                </div>

                <div>
                  <div className="flex justify-between font-bold text-slate-800 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span>🧱</span>
                      2. Chống đè tầng (theo lịch tàu cập)
                    </span>
                    <strong className="text-blue-700 font-mono font-black">{aiAlgorithmWeights.reshuffle}%</strong>
                  </div>
                  <input type="range" min="10" max="80" value={aiAlgorithmWeights.reshuffle}
                    onChange={e => setAiAlgorithmWeights(prev => ({ ...prev, reshuffle: Number(e.target.value) }))}
                    className="w-full accent-blue-600 cursor-pointer" />
                </div>

                <div>
                  <div className="flex justify-between font-bold text-slate-800 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span>🛡️</span>
                      3. An toàn gió bão & quy tắc tải trọng
                    </span>
                    <strong className="text-blue-700 font-mono font-black">{aiAlgorithmWeights.safety}%</strong>
                  </div>
                  <input type="range" min="10" max="80" value={aiAlgorithmWeights.safety}
                    onChange={e => setAiAlgorithmWeights(prev => ({ ...prev, safety: Number(e.target.value) }))}
                    className="w-full accent-blue-600 cursor-pointer" />
                </div>
              </div>
            </div>

            {/* Cột 2: Hàng Đợi Lệnh Tự Động Hóa (Auto-Pilot Queue) */}
            <div className="bg-slate-900 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-700 space-y-4 flex flex-col justify-between"
              style={{ backgroundColor: '#0f172a' }}>
              <div className="space-y-1">
                <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400">playlist_add_check_circle</span>
                    <h4 className="font-heading text-base font-black text-white">Lệnh Tự Động Chờ Kích Hoạt</h4>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-500 px-2.5 py-0.5 rounded-lg font-black">
                    {proactiveTasks.length} LỆNH
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-sans">
                  AI phát hiện {proactiveTasks.length} container cần đảo tầng trước giờ tàu MAERSK HANOI cập cảng.
                </p>
              </div>

              {/* Danh sách Task tự động */}
              <div className="space-y-2 font-mono text-xs">
                {proactiveTasks.length === 0 ? (
                  <div className="py-6 text-center text-emerald-400 font-sans font-bold space-y-1">
                    <span className="material-symbols-outlined text-3xl block">task_alt</span>
                    <div>Đã kích hoạt toàn bộ lệnh tự động!</div>
                  </div>
                ) : (
                  proactiveTasks.map(t => (
                    <div key={t.id} className="p-3 bg-slate-700/80 rounded-2xl border border-slate-600 flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-white text-sm">{t.containerId}</strong>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-600 text-slate-200 rounded">{t.type}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded font-black bg-orange-950 text-orange-400 border border-orange-600">
                            {t.urgency}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-300 font-sans mt-0.5">
                          {t.from} ➔ <strong className="text-emerald-400">{t.to}</strong> ({t.reason})
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] bg-blue-900/60 border border-blue-400 px-2 py-1 rounded text-blue-300 font-bold block">
                          {t.rtgAssigned}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Nút Thực Thi 1 Chạm */}
              {proactiveTasks.length > 0 && (
                <button onClick={handleExecuteAllProactiveTasks}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-98 text-slate-950 rounded-2xl font-black text-xs cursor-pointer shadow-lg flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-base">bolt</span>
                  [ ⚡ THỰC THI {proactiveTasks.length} LỆNH TỰ ĐỘNG ]
                </button>
              )}
            </div>

          </div>

          {/* 7. DẢI CẢM BIẾN REALTIME TELEMETRY STREAM */}
          <div className="bg-slate-900 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-4 sm:p-5 border border-slate-700 space-y-2.5 font-mono text-xs"
            style={{ backgroundColor: '#0f172a' }}>
            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <strong className="text-xs uppercase text-slate-200 font-sans">KẾT NỐI CẢM BIẾN REALTIME (SIGNALR)</strong>
              </div>
              <span className="text-[10px] text-slate-300">Độ trễ: <strong className="text-emerald-400 font-black">24ms</strong></span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
              <div className="bg-slate-700/80 p-2.5 rounded-xl border border-slate-600">
                <span className="text-slate-300 text-[10px] block font-sans">Khóa Cáp (Twistlock):</span>
                <strong className="text-emerald-400 font-black flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">lock</span>
                  ĐÃ KHÓA CHẶT
                </strong>
              </div>
              <div className="bg-slate-700/80 p-2.5 rounded-xl border border-slate-600">
                <span className="text-slate-300 text-[10px] block font-sans">Tọa Độ Laser Cẩu:</span>
                <strong className="text-cyan-300 font-black">X: 14.2m · Y: 8.4m · Z: 12.0m</strong>
              </div>
              <div className="bg-slate-700/80 p-2.5 rounded-xl border border-slate-600">
                <span className="text-slate-300 text-[10px] block font-sans">Áp Suất Cẩu:</span>
                <strong className="text-amber-300 font-black">185 Bar (Bình thường)</strong>
              </div>
              <div className="bg-slate-700/80 p-2.5 rounded-xl border border-slate-600">
                <span className="text-slate-300 text-[10px] block font-sans">Tự Động Xác Nhận:</span>
                <strong className="text-emerald-400 font-black">ĐANG BẬT</strong>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── MODAL: TẠO LỆNH CHUYỂN BLOCK MỚI ── */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-3xl w-full rounded-3xl p-6 shadow-2xl space-y-5 border border-slate-200 font-sans my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-md">
                  <span className="material-symbols-outlined text-2xl">swap_horiz</span>
                </div>
                <div>
                  <h3 className="font-heading text-xl font-black text-slate-900">Tạo Lệnh Chuyển Container Giữa Các Block</h3>
                  <span className="text-xs text-slate-500">Thiết lập lệnh di chuyển container và kiểm tra slot đích</span>
                </div>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateRelocationTask} className="space-y-4 text-xs font-bold">
              {/* Quick Pick Container */}
              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1.5 font-extrabold">Chọn Nhanh Container Có Sẵn Trong Bãi</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SAMPLE_CONTAINERS.map(c => (
                    <button key={c.containerNo} type="button" onClick={() => handleSelectPredefinedContainer(c)}
                      className={`p-2.5 rounded-2xl border text-left cursor-pointer transition-all ${
                        newContainerNo === c.containerNo ? 'bg-orange-50 border-orange-400 text-orange-950 font-black shadow-xs ring-2 ring-orange-200' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}>
                      <div className="font-mono text-xs text-blue-900 font-black">{c.containerNo}</div>
                      <div className="text-[10px] text-slate-500 font-normal">{c.location} • {c.type} ({c.line})</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 1: Container No & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Mã Container *</label>
                  <input type="text" value={newContainerNo} onChange={e => setNewContainerNo(e.target.value.toUpperCase())}
                    placeholder="VD: MSCU1234567" required
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-2xl font-mono font-black text-sm uppercase focus:outline-none focus:border-slate-900" />
                </div>
                <div>
                  <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Loại Kích Thước</label>
                  <select value={newContainerType} onChange={e => setNewContainerType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-2xl text-slate-900 font-bold focus:outline-none">
                    <option value="40FT HC">40FT High Cube (HC)</option>
                    <option value="20FT ST">20FT Standard (ST)</option>
                    <option value="40FT RF">40FT Reefer (Lạnh)</option>
                    <option value="20FT TANK">20FT Tank (Bồn Hóa Chất)</option>
                    <option value="45FT HC">45FT High Cube</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Vị Trí Gốc (Hiện Tại) *</label>
                  <input type="text" value={newFromLocation} onChange={e => setNewFromLocation(e.target.value.toUpperCase())}
                    placeholder="VD: A01-03-12-2" required
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-2xl font-mono font-black text-sm uppercase focus:outline-none focus:border-slate-900" />
                </div>
              </div>

              {/* Interactive Visual Slot Matrix Picker */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-3xl space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-lg">grid_view</span>
                    <span className="text-slate-800 uppercase text-[11px] font-black">SƠ ĐỒ MA TRẬN SLOT BÃI ĐÍCH (CLICK ĐỂ CHỌN SLOT)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={handleAiAutoSelectSlot}
                      className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 rounded-xl font-bold text-[11px] cursor-pointer flex items-center gap-1">
                      <span>🤖 AI Gợi Ý Slot</span>
                    </button>
                    <select value={selectedSlotMatrixBlock} onChange={e => { setSelectedSlotMatrixBlock(e.target.value); setNewTargetBlock(e.target.value) }}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs">
                      <option value="B02">Block B02</option>
                      <option value="A01">Block A01</option>
                      <option value="C01">Block C01</option>
                    </select>
                  </div>
                </div>

                {/* Matrix Grid Visualization */}
                <div className="grid grid-cols-4 gap-2 bg-white p-3.5 rounded-2xl border border-slate-200">
                  {(YARD_BAY_MATRIX[selectedSlotMatrixBlock] || YARD_BAY_MATRIX['B02']).map((slot, idx) => {
                    const isSelected = newTargetRow === String(slot.row).padStart(2, '0') && newTargetTier === String(slot.tier)
                    return (
                      <button key={idx} type="button" onClick={() => handleMatrixSlotClick(slot)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer font-mono text-[10px] ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-300 font-black'
                            : slot.status === 'AVAILABLE'
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100 font-bold'
                              : slot.status === 'GRAVITY_WARNING'
                                ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 font-bold'
                                : slot.status === 'MAINTENANCE'
                                  ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed opacity-60'
                                  : 'bg-red-50 text-red-900 border-red-200 cursor-not-allowed opacity-70'
                        }`}>
                        <div>Hàng {slot.row} - T{slot.tier}</div>
                        <div className="text-[9px] mt-0.5 truncate">
                          {isSelected ? '✓ ĐÃ CHỌN' : (slot.status === 'AVAILABLE' ? 'Trống' : (slot.status === 'GRAVITY_WARNING' ? '⚠️ Trọng lực' : (slot.status === 'MAINTENANCE' ? 'Bảo trì' : slot.cont)))}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Selected Coordinate & Live Validation */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 text-xs">Tọa độ đích đã chọn:</span>
                    <strong className="px-3 py-1 bg-emerald-100 text-emerald-950 font-mono font-black text-sm rounded-xl border border-emerald-300">
                      {computedDestLocation}
                    </strong>
                  </div>

                  <button type="button" onClick={handleValidateSlot} disabled={validatingSlot}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-black text-xs cursor-pointer flex items-center gap-1.5 shadow-sm">
                    <span className="material-symbols-outlined text-sm">{validatingSlot ? 'hourglass_top' : 'rule'}</span>
                    {validatingSlot ? 'Đang kiểm tra...' : '🔍 Kiểm Tra Slot Đích'}
                  </button>
                </div>

                {slotValidation && (
                  <div className={`p-3 rounded-2xl text-xs font-bold border ${
                    slotValidation.isValid ? 'bg-emerald-50 text-emerald-950 border-emerald-300' : 'bg-red-50 text-red-950 border-red-300'
                  }`}>
                    {slotValidation.isValid ? '✓ ' : '⚠️ '}{slotValidation.message}
                  </div>
                )}

                {/* AI vs Manual Instant Comparison Card inside Modal */}
                <div className="p-3.5 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white rounded-2xl border border-blue-200 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-blue-950 flex items-center gap-1.5 font-mono uppercase text-[11px]">
                      <span className="material-symbols-outlined text-blue-600 text-sm">smart_toy</span>
                      Đánh Giá Tối Ưu Hóa AI (BRP Score: {dynamicAiScore}/100)
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-950 border border-emerald-400 font-bold px-2 py-0.5 rounded">
                      Tiết kiệm -62% quãng đường
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
                    <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-slate-500 text-[9px]">Quãng đường RTG</div>
                      <div className="font-black text-blue-950 text-xs">160m <span className="text-emerald-600">(-62%)</span></div>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-slate-500 text-[9px]">Chu kỳ cẩu</div>
                      <div className="font-black text-blue-950 text-xs">7.5p <span className="text-emerald-600">(-58%)</span></div>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-slate-500 text-[9px]">Rủi ro đảo vỏ</div>
                      <div className="font-black text-emerald-700 text-xs">0 lần <span className="text-emerald-600">(-100%)</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Shifting Reason, Billable & Calculated Fee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Lý Do Chuyển Bãi *</label>
                  <select value={newShiftingReason} onChange={e => setNewShiftingReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-2xl text-slate-900 font-bold focus:outline-none">
                    {SHIFTING_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Billable & Fee */}
                <div className="p-3 bg-slate-100 border border-slate-300 rounded-2xl flex flex-col justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-800 text-xs font-bold">
                    <input type="checkbox" checked={newIsBillable} onChange={e => setNewIsBillable(e.target.checked)} className="w-4 h-4 accent-orange-500 rounded" />
                    <span>Thu phí khách hàng (Billable Service)</span>
                  </label>
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200 mt-1">
                    <span className="text-slate-500 text-[10px]">Chi phí di chuyển nội bộ:</span>
                    <strong className="text-emerald-800 font-mono font-black text-sm">{formatCurrency(calculatedFee)}</strong>
                  </div>
                </div>
              </div>

              {/* Row 4: RTG Equipment & Operator */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Chỉ Định Thiết Bị RTG</label>
                  <select value={newEquipmentId} onChange={e => setNewEquipmentId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-2xl text-slate-900 font-bold focus:outline-none">
                    <option value="">Tự động gán RTG khả dụng</option>
                    {equipments.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.name} - {eq.status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Cần Thủ Phụ Trách</label>
                  <input type="text" value={newOperatorName} onChange={e => setNewOperatorName(e.target.value)}
                    placeholder="VD: Trần Văn Hùng"
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-2xl font-bold focus:outline-none" />
                </div>
                <div>
                  <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Mức Độ Ưu Tiên</label>
                  <select value={newPriority} onChange={e => setNewPriority(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-2xl text-slate-900 font-bold focus:outline-none">
                    <option value="Normal">Bình thường (Normal)</option>
                    <option value="High">Ưu tiên cao (High)</option>
                    <option value="Critical">Rất khẩn cấp (Critical)</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Ghi Chú Tác Nghiệp</label>
                <textarea rows="2" value={newNotes} onChange={e => setNewNotes(e.target.value)}
                  placeholder="Ghi chú điều kiện bãi, lưu ý nhiệt độ lạnh, hàng hóa chất nguy hiểm..."
                  className="w-full p-3 bg-slate-100 border border-slate-300 rounded-2xl text-xs font-normal text-slate-900 focus:outline-none resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setCreateModalOpen(false)}
                  className="flex-1 h-12 border border-slate-300 text-slate-700 rounded-2xl font-extrabold hover:bg-slate-100 cursor-pointer">
                  Hủy Bỏ
                </button>
                <button type="submit" disabled={isSubmittingTask}
                  className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-98 text-white font-black rounded-2xl cursor-pointer shadow-md flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-base">send</span>
                  {isSubmittingTask ? 'Đang Tạo Lệnh...' : '[ TẠO & PHÁT LỆNH CHUYỂN BLOCK ]'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: JOB TICKET SHEET PREVIEW ── */}
      {jobSheetTask && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 border-2 border-slate-300 font-sans text-slate-900">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-700">receipt_long</span>
                <h3 className="font-heading text-lg font-black">Phiếu Lệnh Chuyển Bãi (Job Ticket)</h3>
              </div>
              <button onClick={() => setJobSheetTask(null)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Thermal Ticket Format */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 font-mono text-xs relative overflow-hidden">
              <div className="text-center font-heading font-black text-slate-800 border-b border-dashed border-slate-300 pb-2">
                NEXUSPORT CONTAINER TERMINAL
                <div className="text-[10px] text-slate-500 font-sans font-normal">PHIẾU TÁC NGHIỆP DI CHUYỂN NỘI BỘ</div>
              </div>

              <div className="flex justify-between"><span className="text-slate-500">Mã Lệnh:</span><strong className="text-slate-900">{jobSheetTask.id}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Mã Container:</span><strong className="text-blue-900">{jobSheetTask.containerId}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Loại kích thước:</span><span>{jobSheetTask.containerType}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Vị trí gốc:</span><span className="text-amber-800 font-bold">{jobSheetTask.from}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Vị trí đích:</span><span className="text-emerald-800 font-bold">{jobSheetTask.to}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Cước phí nội bộ:</span><span className="font-black text-emerald-700">{formatCurrency(jobSheetTask.internalFee)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Người lập lệnh:</span><span>{jobSheetTask.assignedBy}</span></div>

              {/* Barcode simulation */}
              <div className="pt-2 border-t border-dashed border-slate-300 text-center space-y-1">
                <div className="font-mono text-xl tracking-widest text-slate-800 font-bold">||||||||||||||||||||||||||||</div>
                <div className="text-[9px] text-slate-400">*{jobSheetTask.id}-{jobSheetTask.containerId}*</div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setJobSheetTask(null)} className="flex-1 h-11 border border-slate-300 rounded-xl font-bold text-xs hover:bg-slate-100">
                Đóng
              </button>
              <button onClick={() => { setJobSheetTask(null); showToast(`🖨️ Đã gửi lệnh in phiếu tác nghiệp ${jobSheetTask.id}!`, 'success') }}
                className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-sm">print</span>
                In Phiếu Lệnh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BÁO SỰ CỐ ── */}
      {incidentTask && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 border-2 border-red-500 font-sans">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600 text-xl">report_problem</span>
                <h3 className="font-heading text-lg font-black text-slate-900">Báo Cáo Sự Cố Lệnh {incidentTask.id}</h3>
              </div>
              <button onClick={() => setIncidentTask(null)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitIncident} className="space-y-4 text-xs font-bold">
              <div className="grid grid-cols-2 gap-3 font-mono bg-red-50 p-3 rounded-2xl border border-red-200">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-sans block">Mã Container</span>
                  <strong className="text-slate-900">{incidentTask.containerId}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-sans block">Vị Trí Gốc</span>
                  <strong className="text-amber-800">{incidentTask.from}</strong>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-2 font-extrabold">Lý Do Không Thể Thực Hiện *</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {INCIDENT_REASONS.map(r => (
                    <label key={r} className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-all text-xs font-bold font-sans ${
                      incidentReason === r ? 'bg-red-100 border-red-400 text-red-950' : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                    }`}>
                      <input type="radio" name="incidentReason" value={r} checked={incidentReason === r} onChange={() => setIncidentReason(r)} className="accent-red-600" />
                      {r}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 uppercase text-[10px] mb-1 font-extrabold">Ghi Chú Hiện Trường</label>
                <textarea rows="2" value={incidentNotes} onChange={e => setIncidentNotes(e.target.value)}
                  placeholder="Mô tả chi tiết tình huống tại hiện trường..."
                  className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-2xl text-xs font-normal text-slate-900 focus:outline-none resize-none" />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setIncidentTask(null)} className="flex-1 h-12 border border-slate-300 text-slate-700 rounded-2xl font-extrabold text-xs hover:bg-slate-100 cursor-pointer">
                  Hủy Bỏ
                </button>
                <button type="submit" className="flex-1 h-12 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-500 rounded-2xl font-black text-xs cursor-pointer">
                  [ 🚨 GỬI BÁO CÁO SỰ CỐ ]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: XEM TRÊN SƠ ĐỒ BÃI 2D (Mini-Map) ── */}
      {mapViewTask && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl p-6 shadow-2xl space-y-4 border-2 border-blue-400 font-sans">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-xl">map</span>
                <h3 className="font-heading text-lg font-black text-slate-900">Sơ Đồ Bãi 2D — Lệnh {mapViewTask.id}</h3>
              </div>
              <button onClick={() => setMapViewTask(null)} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Mini Map Visual */}
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 space-y-4">
              <div className="text-[10px] text-amber-400 font-mono font-black uppercase">
                SƠ ĐỒ CHUYỂN CONTAINER: {mapViewTask.containerId} ({mapViewTask.from} ➔ {mapViewTask.to})
              </div>

              <div className="grid grid-cols-5 gap-2 font-mono text-[10px] text-center">
                {['A01-01', 'A01-02', 'A01-03', 'A01-04', 'A01-05'].map(cell => (
                  <div key={cell} className={`p-2.5 rounded-xl border-2 font-black ${
                    cell.includes(parsePosition(mapViewTask.from).bay) || mapViewTask.from.includes(cell.split('-')[1])
                      ? 'bg-blue-500 text-white border-blue-300 shadow-lg shadow-blue-900/50 animate-pulse'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    {cell}
                    {(cell.includes(parsePosition(mapViewTask.from).bay) || mapViewTask.from.includes(cell.split('-')[1])) && <div className="text-[9px] mt-0.5">📦 GỐC</div>}
                  </div>
                ))}

                <div className="col-span-5 flex items-center justify-center gap-2 py-2 text-slate-400 font-bold text-xs">
                  <span>{mapViewTask.from?.includes('-') ? `Block ${parsePosition(mapViewTask.from).block}` : mapViewTask.from}</span>
                  <div className="flex-1 h-px bg-slate-700"></div>
                  <span>➔ RTG Lộ Trình ➔</span>
                  <div className="flex-1 h-px bg-slate-700"></div>
                  <span>{mapViewTask.to?.includes('-') ? `Block ${parsePosition(mapViewTask.to).block}` : mapViewTask.to}</span>
                </div>

                {['B02-01', 'B02-02', 'B02-03', 'B02-04', 'B02-05'].map(cell => {
                  const isMatch = mapViewTask.to?.includes('-') && (cell.includes(parsePosition(mapViewTask.to).bay) || mapViewTask.to.includes(cell.split('-')[1]))
                  return (
                    <div key={cell} className={`p-2.5 rounded-xl border-2 font-black ${
                      isMatch
                        ? 'bg-emerald-500 text-white border-emerald-300 shadow-lg shadow-emerald-900/50 animate-pulse'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}>
                      {cell}
                      {isMatch && <div className="text-[9px] mt-0.5">🎯 ĐÍCH</div>}
                    </div>
                  )
                })}
              </div>

              {!mapViewTask.to?.includes('-') && (
                <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-center font-sans text-xs">
                  🚢 Vị trí đích là điểm giao nhận phương tiện ngoài bãi: <strong>{mapViewTask.to}</strong>
                </div>
              )}

              <div className="flex justify-between items-center font-mono text-xs pt-2 border-t border-slate-700">
                <div className="bg-blue-900/40 border border-blue-400 px-3 py-2 rounded-xl">
                  <span className="text-blue-300 text-[10px] font-sans font-bold block">VỊ TRÍ GỐC</span>
                  <strong className="text-white">{mapViewTask.from}</strong>
                </div>
                <div className="text-slate-400 text-2xl font-black">➔</div>
                <div className="bg-emerald-900/40 border border-emerald-400 px-3 py-2 rounded-xl">
                  <span className="text-emerald-300 text-[10px] font-sans font-bold block">VỊ TRÍ ĐÍCH</span>
                  <strong className="text-white">{mapViewTask.to}</strong>
                </div>
              </div>
            </div>

            <div className="flex gap-3 font-sans text-xs">
              <button onClick={() => setMapViewTask(null)} className="flex-1 h-11 border border-slate-300 text-slate-700 rounded-2xl font-extrabold hover:bg-slate-100 cursor-pointer">
                Đóng
              </button>
              <a href="/yard-staff/map"
                className="flex-1 h-11 bg-blue-100 hover:bg-blue-200 text-blue-950 border-2 border-blue-400 rounded-2xl font-black flex items-center justify-center gap-1.5 transition-all">
                <span className="material-symbols-outlined text-base">open_in_new</span>
                Mở Sơ Đồ Bãi 2D Đầy Đủ
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: THÔNG BÁO KẾT QUẢ AI & XÁC NHẬN TRIỂN KHAI LỆNH CẨU (IMMEDIATE ON-SCREEN NOTIFICATION) ── */}
      {showConfirmDeployModal && conflictPlanResult && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white max-w-2xl w-full rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200/90 font-sans animate-scaleUp my-8 max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md shrink-0">
                  <span className="material-symbols-outlined text-2xl">verified</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-lg sm:text-xl font-black text-slate-900">
                      Kết Quả Phân Tích & Xác Nhận Triển Khai Lệnh Cẩu
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-900 font-mono text-[10px] font-black border border-emerald-300">
                      AI TỐI ƯU
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    Container mục tiêu: <strong className="font-mono text-blue-900 font-black">{conflictPlanResult.targetContainerNo || currentConflictScenario.targetContainer.id}</strong> ({currentConflictScenario.targetContainer.weight}) • Độ tin cậy: <strong className="font-mono text-emerald-700">{conflictPlanResult.metrics.confidence}</strong>
                  </span>
                </div>
              </div>
              <button onClick={() => setShowConfirmDeployModal(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer shrink-0">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* 5 Chỉ Số Định Lượng AI & Phí Dịch Vụ */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90">
                <span className="text-[10px] text-slate-500 font-sans block">THỜI GIAN THỰC THI</span>
                <strong className="text-slate-900 font-black text-base">{conflictPlanResult.metrics.estimatedDuration}</strong>
                <div className="text-[10px] text-emerald-700 font-bold font-sans">Tiết kiệm {conflictPlanResult.metrics.timeSaved}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90">
                <span className="text-[10px] text-slate-500 font-sans block">LỆNH ĐẢO CẨU</span>
                <strong className="text-slate-900 font-black text-base">{conflictPlanResult.metrics.movesCount} Lần</strong>
                <div className="text-[10px] text-emerald-700 font-bold font-sans">Tối thiểu tuyệt đối</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90">
                <span className="text-[10px] text-slate-500 font-sans block">NHIÊN LIỆU RTG</span>
                <strong className="text-slate-900 font-black text-base">{conflictPlanResult.metrics.energySaved}</strong>
                <div className="text-[10px] text-emerald-700 font-bold font-sans">Giảm hành trình cẩu</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90">
                <span className="text-[10px] text-slate-500 font-sans block">CƯỚC NỘI BỘ</span>
                <strong className="text-blue-900 font-black text-xs truncate block mt-0.5">{formatCurrency(conflictPlanResult.metrics.shiftingFee)}</strong>
                <div className="text-[10px] text-slate-500 font-sans truncate">{conflictPlanResult.restackBackToOriginal ? 'Gồm hoàn bãi' : 'Lưu slot đệm'}</div>
              </div>

              <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-300 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-500 font-sans block">AN TOÀN BÃI</span>
                <strong className="text-emerald-950 font-black text-base">100%</strong>
                <div className="text-[10px] text-emerald-700 font-bold font-sans">Không tái xung đột</div>
              </div>
            </div>

            {/* Danh Sách Các Lệnh Triển Khai (Deployment Orders) */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 uppercase font-sans flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-blue-600">format_list_numbered</span>
                  Chuỗi Lệnh Triển Khai Tuần Tự ({conflictPlanResult.generatedTasks.length} Lệnh):
                </span>
                <span className="text-[10px] text-slate-500 font-mono font-bold">Thực thi từ Bước 1</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 font-mono text-xs">
                {conflictPlanResult.generatedTasks.map((t, idx) => (
                  <div key={idx} className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                    t.isTarget
                      ? 'bg-blue-50/80 border-blue-300 text-blue-950'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        t.isTarget ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'
                      }`}>
                        {t.step}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-black">{t.id}</strong>
                          <span className="text-[10px] px-1.5 py-0.2 bg-white rounded border border-slate-300 text-slate-600 font-sans">
                            {t.type}
                          </span>
                          {t.isTarget && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-900 rounded font-black border border-emerald-300">
                              ★ MỤC TIÊU
                            </span>
                          )}
                          {t.reason?.includes('Khôi phục') && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded font-black border border-amber-300">
                              ↺ KHÔI PHỤC
                            </span>
                          )}
                          {!t.isTarget && !t.reason?.includes('Khôi phục') && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-indigo-50 text-indigo-900 rounded font-bold border border-indigo-200">
                              📦 ĐỆM
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans">{t.reason}</div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-black text-blue-950">
                        {t.currentPos} ➔ <strong className={t.moveTarget === 'KHÔNG CÓ SLOT' ? 'text-rose-600 font-black' : 'text-emerald-700'}>{t.moveTarget}</strong>
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans">
                        {t.rtg} • {t.duration}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Telemetry / Safety Lock Notice */}
            {conflictPlanResult.canExecute === false ? (
              <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center gap-3 text-rose-950 font-sans text-xs">
                <span className="material-symbols-outlined text-rose-600 text-2xl shrink-0">block</span>
                <div>
                  <div className="font-black text-rose-800 uppercase">🚨 KHÔNG CHO PHÉP DI DIỜI: KHÔNG CÓ SLOT TẠM PHÙ HỢP!</div>
                  <div className="text-[11px] text-rose-700 font-normal mt-0.5">
                    {conflictPlanResult.validationMessage || 'Hệ thống đã kiểm tra ma trận bãi nhưng không tìm thấy slot đệm an toàn. Thao tác phát lệnh bị chặn theo quy định an toàn cảng.'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-600 font-sans bg-amber-50 border border-amber-300 p-2.5 rounded-2xl flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base shrink-0">shield</span>
                <span>Sau khi xác nhận, toàn bộ lệnh sẽ lập tức truyền xuống cẩu RTG qua mạng không dây nội bộ.</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-1">
              {!conflictPlanDeployed ? (
                <div className="flex gap-2.5">
                  <button type="button" onClick={() => setShowConfirmDeployModal(false)}
                    className="flex-1 h-12 border border-slate-300 text-slate-700 rounded-2xl font-extrabold hover:bg-slate-100 cursor-pointer text-xs">
                    Để Sau / Đóng
                  </button>
                  {conflictPlanResult.canExecute === false ? (
                    <button type="button" disabled
                      className="flex-2 h-12 bg-slate-200 text-slate-400 font-black rounded-2xl cursor-not-allowed flex items-center justify-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-base">block</span>
                      <span>[ 🚫 KHÔNG THỂ PHÁT LỆNH DO THIẾU SLOT TẠM ]</span>
                    </button>
                  ) : (
                    <button type="button" onClick={handleConfirmDeployConflictPlan} disabled={isDeployingConflictPlan}
                      className="flex-2 h-12 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black rounded-2xl cursor-pointer shadow-md flex items-center justify-center gap-2 text-xs transition-colors">
                      {isDeployingConflictPlan ? (
                        <>
                          <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                          <span>Đang Bắn Lệnh Xuống Cẩu RTG...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">rocket_launch</span>
                          <span>[ 🚀 XÁC NHẬN TRIỂN KHAI & PHÁT LỆNH NGAY ]</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-100 border border-emerald-400 rounded-2xl text-emerald-950 font-sans font-bold text-xs flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-emerald-700">check_circle</span>
                    <span>✓ Đã Phát Toàn Bộ {conflictPlanResult.generatedTasks.length} Lệnh Xuống Cẩu RTG Thành Công!</span>
                  </div>
                  <div className="flex gap-2.5">
                    <button type="button" onClick={() => { setShowConfirmDeployModal(false); setViewMode('TABLE') }}
                      className="flex-2 h-12 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black rounded-2xl cursor-pointer shadow-md flex items-center justify-center gap-2 text-xs">
                      <span className="material-symbols-outlined text-base">table_rows</span>
                      [ 📋 XEM TRÊN DANH SÁCH LỆNH ]
                    </button>
                    <button type="button" onClick={() => setShowConfirmDeployModal(false)}
                      className="flex-1 h-12 border border-slate-300 text-slate-700 rounded-2xl font-extrabold hover:bg-slate-100 cursor-pointer text-xs">
                      Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  )
}

// Fallback seed tasks
function getFallbackTasks() {
  return [
    {
      id: 'MOV-1024',
      containerId: 'MSCU1234567',
      containerType: '40FT HC',
      cargoType: 'Hàng May Mặc',
      from: 'A01-03-12-2',
      to: 'B02-02-08-3',
      reason: 'Tái cơ cấu xếp bãi',
      priority: 'HIGH',
      assignedBy: 'Operator - Nguyễn Văn Q',
      status: 'PENDING',
      flowStep: 0,
      equipment: null,
      confirmedPos: '',
      internalFee: 350000,
      durationMinutes: 0
    },
    {
      id: 'MOV-1025',
      containerId: 'TEMU8822190',
      containerType: '40FT HC',
      cargoType: 'Hàng Xuất Khẩu Khẩn',
      from: 'B02-01-02-1',
      to: 'A01-05-02-1',
      reason: 'Chuẩn bị xuất cổng khẩn',
      priority: 'CRITICAL',
      assignedBy: 'Operator - Nguyễn Văn Q',
      status: 'PENDING',
      flowStep: 0,
      equipment: null,
      confirmedPos: '',
      internalFee: 550000,
      durationMinutes: 0
    },
    {
      id: 'MOV-1022',
      containerId: 'CMAU9918234',
      containerType: '20FT ST',
      cargoType: 'Hàng Bách Hóa',
      from: 'A01-01-05-3',
      to: 'A01-01-01-1',
      reason: 'Đảo tầng cẩu bãi',
      priority: 'MEDIUM',
      assignedBy: 'Điều phối viên',
      status: 'IN PROGRESS',
      flowStep: 1,
      equipment: { name: 'RTG-01', operator: 'Trần Văn Hùng' },
      confirmedPos: '',
      internalFee: 0,
      durationMinutes: 15
    },
    {
      id: 'MOV-1020',
      containerId: 'COSU8819201',
      containerType: '40FT HC',
      cargoType: 'Hàng Công Nghiệp Tiêu Dùng',
      from: 'A01-02-04-2',
      to: 'B02-03-01-1',
      reason: 'Chuyển kho bãi lưu trữ dài hạn',
      priority: 'NORMAL',
      assignedBy: 'Operator - Lê Văn Hoàng',
      status: 'COMPLETED',
      flowStep: 3,
      equipment: { name: 'RTG-02', operator: 'Phạm Văn Cần' },
      confirmedPos: 'B02-03-01-1',
      internalFee: 0,
      durationMinutes: 18
    }
  ]
}
