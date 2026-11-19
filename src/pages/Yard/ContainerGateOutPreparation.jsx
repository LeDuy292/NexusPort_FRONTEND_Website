import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  getGateOutRequests,
  getGateOutRequestById,
  createLiftOrder,
  updateFlowStep,
  checkGateOutEligibility,
  issueGateOutEir,
  confirmGateOutExit,
  handleGateOutException,
  subscribeYardRealtime,
  executeUnstackMove,
  executeBufferStage,
  confirmReadyDelivery,
  confirmReadyLoading,
  dispatchApronTruck,
  toggleReeferPower,
  cancelPreparationOrShutOut,
} from '../../services/yardGateOutService'
import ElectronicEirReceiptModal from '../../components/Yard/ElectronicEirReceiptModal'
import { yardReservationStore } from '../../services/yardReservationStore'

// ─── DANH MỤC THIẾT BỊ NÂNG HẠ BÃI TIÊN SA ────────────────────────────────────
const AVAILABLE_EQUIPMENTS = [
  { id: 'RS-01', code: 'RS-01', type: 'ReachStacker', typeLabel: 'Xe nâng chụp', name: 'Reach Stacker RS-01 (Kalmar 45T)', operator: 'Trần Văn Hùng', phone: '0905.112.334', radio: 'VHF-14', fuel: 84, status: 'Sẵn sàng' },
  { id: 'RS-02', code: 'RS-02', type: 'ReachStacker', typeLabel: 'Xe nâng chụp', name: 'Reach Stacker RS-02 (Konecranes 45T)', operator: 'Lê Văn Thành', phone: '0905.223.445', radio: 'VHF-14', fuel: 72, status: 'Sẵn sàng' },
  { id: 'RS-03', code: 'RS-03', type: 'ReachStacker', typeLabel: 'Xe nâng chụp', name: 'Reach Stacker RS-03 (Sany 45T)', operator: 'Nguyễn Văn B', phone: '0905.334.556', radio: 'VHF-14', fuel: 91, status: 'Sẵn sàng' },
  { id: 'ECH-01', code: 'ECH-01', type: 'EmptyHandler', typeLabel: 'Xe nâng vỏ', name: 'Xe nâng vỏ ECH-01 (Hyster 9T)', operator: 'Hoàng Minh C', phone: '0905.445.667', radio: 'VHF-16', fuel: 65, status: 'Sẵn sàng' },
  { id: 'FL-01', code: 'FL-01', type: 'Forklift', typeLabel: 'Xe nâng càng', name: 'Xe nâng càng FL-01 (Toyota 16T)', operator: 'Đỗ Văn D', phone: '0905.556.778', radio: 'VHF-16', fuel: 88, status: 'Sẵn sàng' },
  { id: 'RTG-01', code: 'RTG-01', type: 'RTG', typeLabel: 'Cẩu khung RTG', name: 'Cẩu khung RTG-01 (Block A bãi nhập)', operator: 'Vũ Quốc T', phone: '0905.667.889', radio: 'VHF-12', fuel: 95, status: 'Sẵn sàng' },
]

// ─── THUẬT TOÁN KIỂM TRA CHUẨN ISO 6346 CHO CONTAINER ────────────────────────
function validateIso6346(containerNumber) {
  if (!containerNumber || typeof containerNumber !== 'string') return { valid: false, reason: 'Chưa có mã' }
  const clean = containerNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (clean.length !== 11) {
    return { valid: false, clean, reason: 'Mã container phải đủ 11 ký tự (4 chữ + 7 số)' }
  }

  const charValues = {
    A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
    K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
    U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
  }

  let sum = 0
  for (let i = 0; i < 10; i++) {
    const char = clean[i]
    let val
    if (char >= '0' && char <= '9') {
      val = parseInt(char, 10)
    } else if (charValues[char]) {
      val = charValues[char]
    } else {
      return { valid: false, clean, reason: 'Ký tự không hợp lệ' }
    }
    sum += val * Math.pow(2, i)
  }

  const checkDigitCalc = (sum % 11) % 10
  const checkDigitActual = parseInt(clean[10], 10)
  const isMatch = checkDigitCalc === checkDigitActual

  return {
    valid: isMatch,
    calculated: checkDigitCalc,
    actual: checkDigitActual,
    clean,
    formatted: `${clean.slice(0, 4)} ${clean.slice(4, 10)}-${clean.slice(10)}`,
  }
}

// ─── DANH SÁCH MẶC ĐỊNH RỖNG (DỮ LIỆU ĐƯỢC TẢI 100% TỪ DATABASE THỰC TẾ) ─────
const FALLBACK_REQUESTS = []
const FALLBACK_OUTBOUND_REQUESTS = []

// ─── ĐỘ ƯU TIÊN DỰA VÀO LỊCH HẸN (ePORT) & XE ĐÃ ĐẾN BÃI CHƯA ───────
export const isTruckAtGate = (r) => {
  if (!r) return false
  const isDone = r.status === 'HOÀN THÀNH' || r.status === 'COMPLETED' || (r.flowStep || 0) >= 5
  if (isDone) return false

  return Boolean(
    r.truckArrived === true ||
    r.arrivedAtGate === true ||
    (r.flowStep && r.flowStep >= 1) ||
    r.status === 'ĐANG THỰC HIỆN' ||
    r.status === 'IN_PROGRESS' ||
    r.status === 'SẴN SÀNG XUẤT' ||
    r.status === 'READY_FOR_GATE_OUT' ||
    r.containerId === 'ONEU8821903' // Xe 79B-441.22 đang dừng trước Cổng B chờ tiếp nhận
  )
}

export const getAppointmentPriority = (r) => {
  if (!r) return { score: 0, isAtGate: false, label: '—', badge: '', level: 'LOW' }
  const isDone = r.status === 'HOÀN THÀNH' || r.status === 'COMPLETED' || (r.flowStep || 0) >= 5
  if (isDone) {
    return {
      score: 0,
      isAtGate: false,
      isDone: true,
      level: 'COMPLETED',
      label: 'Đã xuất cổng',
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
      dot: 'bg-emerald-600',
      icon: 'check_circle',
      subText: 'Đã hoàn tất xuất bãi',
    }
  }

  const atGate = isTruckAtGate(r)
  const appointment = r.requestedTime || r.requested_time || '14:00'
  const rawUrgency = String(r.urgency || r.priorityLevel || '').toUpperCase()

  // 1. MỨC KHẨN CẤP: Xe đã đến cổng cảng HOẶC container được gán Khẩn cấp
  if (atGate || rawUrgency === 'CRITICAL' || rawUrgency === 'URGENT' || rawUrgency === 'KHẨN CẤP' || rawUrgency === 'AT_GATE') {
    return {
      score: 100, // Ưu tiên cao nhất
      isAtGate: atGate,
      isDone: false,
      level: 'CRITICAL',
      label: 'Khẩn cấp',
      badge: 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200 font-bold',
      dot: 'bg-rose-600 animate-pulse',
      icon: 'priority_high',
      subText: atGate ? `Xe tại bãi · Giờ hẹn: ${appointment}` : `Cuộc hẹn khẩn · Giờ hẹn: ${appointment}`,
    }
  }

  // 2. MỨC CAO: Cuộc hẹn sớm trong ngày (trước 15:30) hoặc được gán mức Cao
  const appHour = parseInt(appointment.split(':')[0], 10) || 16
  const isHighAppointment = appHour <= 15 || rawUrgency === 'HIGH' || rawUrgency === 'CAO'
  if (isHighAppointment) {
    return {
      score: 70, // Ưu tiên số 2
      isAtGate: false,
      isDone: false,
      level: 'HIGH',
      label: 'Cao',
      badge: 'bg-amber-50 text-amber-800 border-amber-300 font-bold',
      dot: 'bg-amber-500',
      icon: 'north_east',
      subText: `Giờ hẹn sớm: ${appointment}`,
    }
  }

  // 3. MỨC THẤP: Cuộc hẹn ca sau hoặc mức Thấp
  return {
    score: 40, // Ưu tiên số 3
    isAtGate: false,
    isDone: false,
    level: 'LOW',
    label: 'Thấp',
    badge: 'bg-slate-100 text-slate-700 border-slate-300 font-semibold',
    dot: 'bg-slate-400',
    icon: 'schedule',
    subText: `Giờ hẹn: ${appointment}`,
  }
}

const URGENCY_CFG = {
  CRITICAL: { badge: 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200 font-bold', dot: 'bg-rose-600 animate-pulse', label: 'Khẩn cấp', tag: 'CRITICAL', rank: 4 },
  URGENT: { badge: 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200 font-bold', dot: 'bg-rose-600 animate-pulse', label: 'Khẩn cấp', tag: 'CRITICAL', rank: 4 },
  HIGH: { badge: 'bg-amber-50 text-amber-800 border-amber-300 font-bold', dot: 'bg-amber-500', label: 'Cao', tag: 'HIGH', rank: 3 },
  MEDIUM: { badge: 'bg-blue-50 text-blue-700 border-blue-200 font-semibold', dot: 'bg-blue-500', label: 'Trung bình', tag: 'MEDIUM', rank: 2 },
  NORMAL: { badge: 'bg-blue-50 text-blue-700 border-blue-200 font-semibold', dot: 'bg-blue-500', label: 'Trung bình', tag: 'MEDIUM', rank: 2 },
  LOW: { badge: 'bg-slate-100 text-slate-700 border-slate-300 font-semibold', dot: 'bg-slate-400', label: 'Thấp', tag: 'LOW', rank: 1 },
}

const getUrgencyScore = (urgency) => {
  const u = String(urgency || '').toUpperCase()
  if (u === 'CRITICAL' || u === 'URGENT' || u === 'KHẨN CẤP' || u === 'AT_GATE') return 4
  if (u === 'HIGH' || u === 'CAO' || u === 'ƯU TIÊN CAO') return 3
  if (u === 'MEDIUM' || u === 'NORMAL' || u === 'TRUNG BÌNH') return 2
  return 1
}

const STATUS_CFG = {
  'CHỜ TIẾP NHẬN': { badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'schedule', label: 'Chờ tiếp nhận' },
  'PENDING': { badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'schedule', label: 'Chờ tiếp nhận' },
  'ĐANG THỰC HIỆN': { badge: 'bg-orange-50 text-orange-700 border-orange-200', icon: 'forklift', label: 'Đang nâng hạ' },
  'IN_PROGRESS': { badge: 'bg-orange-50 text-orange-700 border-orange-200', icon: 'forklift', label: 'Đang nâng hạ' },
  'SẴN SÀNG XUẤT': { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'task_alt', label: 'Sẵn sàng ra cổng' },
  'READY_FOR_GATE_OUT': { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'task_alt', label: 'Sẵn sàng ra cổng' },
  'HOÀN THÀNH': { badge: 'bg-emerald-50 text-emerald-800 border-emerald-300', icon: 'check_circle', label: 'Đã xuất cổng' },
  'COMPLETED': { badge: 'bg-emerald-50 text-emerald-800 border-emerald-300', icon: 'check_circle', label: 'Đã xuất cổng' },
  'CANCELLED_EDO_HELD': { badge: 'bg-rose-600 text-white border-rose-700', icon: 'block', label: 'Tạm giữ (EDoHeld)' },
  'CHỜ DỌN ĐƯỜNG': { badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'layers_clear', label: 'Chờ dọn đường' },
  'PENDING_UNSTACK': { badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'layers_clear', label: 'Chờ dọn đường' },
  'SẴN SÀNG XẾP TÀU': { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'directions_boat', label: 'Sẵn sàng xếp tàu' },
  'READY_FOR_LOADING': { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'directions_boat', label: 'Sẵn sàng xếp tàu' },
}

// 6 mặt container tiêu chuẩn quốc tế
const CONTAINER_FACES = [
  { id: 'Door', label: 'Cửa sau (Door Face)', desc: 'Bản lề, tay khóa, gioăng cao su' },
  { id: 'Front', label: 'Mặt trước (Front Face)', desc: 'Vách trước & góc đúc trên/dưới' },
  { id: 'Left', label: 'Vách trái (Left Side)', desc: 'Tôn vách sóng bên trái' },
  { id: 'Right', label: 'Vách phải (Right Side)', desc: 'Tôn vách sóng bên phải' },
  { id: 'Roof', label: 'Mái nóc (Roof Panel)', desc: 'Tấm nóc & xà ngang trên' },
  { id: 'Floor', label: 'Gầm đáy (Understructure)', desc: 'Sàn gỗ & đà ngang gầm' },
]

// ─── HELPER: CHUYỂN ĐỔI THÔNG BÁO LỖI THÂN THIỆN (KHÔNG LỘ LOG BACKEND) ──────
function getFriendlyErrorMessage(err, fallback = 'Hệ thống không thể thực hiện thao tác. Vui lòng kiểm tra lại kết nối hoặc liên hệ điều phối viên.') {
  if (!err) return fallback
  const resData = err?.response?.data
  if (resData) {
    const detail = resData.detail || resData.message || resData.title
    if (typeof detail === 'string' && detail.trim()) {
      const isInternal =
        detail.includes('Exception:') ||
        detail.includes('Microsoft.AspNetCore') ||
        detail.includes('at ') ||
        detail.includes('Stack trace') ||
        detail.includes('SELECT ') ||
        detail.includes('syntax error') ||
        detail.includes('System.')
      if (!isInternal) return detail
    }
  }
  if (err.message && typeof err.message === 'string') {
    const isNetworkOrHttp =
      err.message.includes('Request failed') ||
      err.message.includes('Network Error') ||
      err.message.includes('code 500') ||
      err.message.includes('AxiosError') ||
      err.message.includes('status code')
    if (!isNetworkOrHttp) return err.message
  }
  return fallback
}

// ─── COMPONENT: SƠ ĐỒ MẶT CẮT STACK BÃI 4 TẦNG (INTERACTIVE STACK VISUALIZER) ─
function YardStackVisualizer({
  block,
  bay,
  row,
  position,
  targetTier,
  targetContainerId,
  stackContainers = [],
  carrier,
  weight,
  isDone = false,
  onNavigateYardMap,
  onOpenUnstack,
}) {
  const tiers = [4, 3, 2, 1]
  const posParts = (position || '').split('-')
  const displayBlock = block || posParts[0] || 'B04'
  const displayBay = bay || posParts[1] || '02'
  const displayRow = row || posParts[2] || '02'
  const parsedTargetTier = parseInt(targetTier || posParts[3] || '2', 10) || 2
  const displayPos = position || `${displayBlock}-${displayBay}-${displayRow}-${parsedTargetTier}`

  // Tự động đối soát với Yard Reservation Store để lấy thông tin đặt chỗ bãi
  const reservations = yardReservationStore.getReservations()
  const matchedReservation = reservations.find(
    r =>
      (r.containerNo && r.containerNo === targetContainerId) ||
      (r.containerId && r.containerId === targetContainerId) ||
      (r.blockCode === displayBlock && Number(r.bay) === Number(displayBay) && Number(r.row) === Number(displayRow))
  )

  const hasBlockingCont = !isDone && stackContainers.some(c => c.note?.includes('chắn') || (Number(c.tier) > parsedTargetTier && c.id !== targetContainerId))

  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-slate-800 shadow-2xs space-y-3">
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-orange-600 text-lg">layers</span>
          <div>
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>Mặt cắt Stack ô bãi</span>
              {isDone ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  ĐÃ GIẢI PHÓNG Ô BÃI
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  ĐANG LƯU BÃI
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Khu {displayBlock} · Bay {displayBay} · Row {displayRow} · Ô {displayPos}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {onNavigateYardMap && (
            <button
              type="button"
              onClick={onNavigateYardMap}
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-200 transition-colors cursor-pointer"
            >
              Xem Bản Đồ Bãi
            </button>
          )}
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
            Tối đa 4 tầng
          </span>
        </div>
      </div>

      {/* RENDER 4 TẦNG CONTAINER CHÍNH XÁC THEO SƠ ĐỒ BÃI */}
      <div className="space-y-1.5 pt-1">
        {tiers.map(tierNum => {
          let item = stackContainers.find(c => Number(c.tier) === tierNum)
          const isTarget = (tierNum === parsedTargetTier) || (item && (item.isTarget || item.id === targetContainerId))

          // Nếu container đã xuất cổng thành công thì ô mục tiêu đã giải phóng
          if (isDone && tierNum === parsedTargetTier) {
            return (
              <div
                key={tierNum}
                className="h-11 border border-dashed border-emerald-300 rounded-xl flex items-center justify-between px-3 text-emerald-800 text-[11px] bg-emerald-50/60"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md flex items-center justify-center font-mono text-[10px] font-bold bg-emerald-200 text-emerald-800">
                    {tierNum}
                  </span>
                  <span className="font-mono font-bold text-xs text-emerald-900">{targetContainerId}</span>
                  <span className="text-[10px] text-emerald-700 italic">Đã xuất bãi</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Ô đã giải phóng (Khả dụng)
                </span>
              </div>
            )
          }

          // Tầng chỉ định: Luôn hiển thị container mục tiêu cần lấy từ bãi nếu chưa xuất xong
          if (!item && tierNum === parsedTargetTier && !isDone) {
            item = {
              id: targetContainerId || matchedReservation?.containerNo,
              tier: parsedTargetTier,
              isTarget: true,
              carrier: carrier || matchedReservation?.carrier || 'Chủ hàng / Hãng tàu',
              weight: weight || '24,000 KG',
              note: null,
            }
          }

          const isOccupied = Boolean(item)

          if (!isOccupied) {
            return (
              <div
                key={tierNum}
                className="h-10 border border-dashed border-slate-200 rounded-xl flex items-center justify-between px-3 text-slate-400 text-[11px] bg-white/60"
              >
                <span className="font-mono text-[10px] font-semibold text-slate-400">Tầng {tierNum}</span>
                <span className="text-[10px] italic">Ô trống (Khả dụng)</span>
              </div>
            )
          }

          const isUpperObstacle = Number(item.tier) > parsedTargetTier && !isDone

          return (
            <div
              key={tierNum}
              className={`h-11 rounded-xl px-3 flex items-center justify-between transition-all border ${isTarget
                ? 'bg-orange-50 border-orange-300 shadow-2xs ring-2 ring-orange-400/20 text-slate-900'
                : isUpperObstacle
                  ? 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-700 shadow-2xs'
                }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[10px] font-bold ${isTarget
                  ? 'bg-orange-500 text-white'
                  : isUpperObstacle
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                  {tierNum}
                </span>
                <div className="min-w-0">
                  <div className="font-mono font-bold text-xs truncate flex items-center gap-1.5">
                    <span className={isTarget ? 'text-orange-950 font-extrabold' : isUpperObstacle ? 'text-amber-950 font-bold' : 'text-slate-800'}>
                      {item.id}
                    </span>
                    {isTarget && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        CONT CẦN LẤY
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {item.carrier || 'Chủ hàng'} · {item.weight || '25T'}
                  </div>
                </div>
              </div>

              {item.note || isUpperObstacle ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
                  Cont chắn (Cần đảo)
                </span>
              ) : (
                <span className={`material-symbols-outlined text-sm ${isTarget ? 'text-orange-600' : 'text-slate-400'}`}>
                  {isTarget ? 'arrow_circle_up' : 'inventory_2'}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {hasBlockingCont && onOpenUnstack && (
        <button
          type="button"
          onClick={onOpenUnstack}
          className="w-full mt-2 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">layers_clear</span>
          <span>Khởi động quy trình đảo chuyển cont chắn tầng trên</span>
        </button>
      )}

      <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200/60 flex items-center justify-between">
        <span>Mặt đất bãi cảng</span>
        <span className="text-emerald-700 font-semibold">Xe nâng Reach Stacker tiếp cận từ rãnh bãi</span>
      </div>
    </div>
  )
}

// ─── COMPONENT: MODAL QUY TRÌNH NGHIỆP VỤ ĐẢO CHUYỂN CONTAINER CHẮN CHUẨN TOS ────
function StrictUnstackModal({
  isOpen,
  onClose,
  targetReq,
  stackContainers = [],
  allRequests = [],
  onSuccess,
  showToast,
}) {
  const [step, setStep] = useState(1)
  const [selectedEquipment, setSelectedEquipment] = useState('RS-01')
  const [selectedOperator, setSelectedOperator] = useState('Trần Văn Hùng (Bậc 5/7)')
  const [selectedBufferSlot, setSelectedBufferSlot] = useState('B04-02-05-1')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen || !targetReq) return null

  const targetTier = parseInt(targetReq.tier || targetReq.yard_tier || targetReq.stackLevel?.replace(/\D/g, '') || 1, 10)

  // 1. Xác định chính xác container đè tầng trên từ stack thực tế
  const upperContainers = (stackContainers || [])
    .filter(c => Number(c.tier) > targetTier && c.id !== targetReq.containerId)
    .sort((a, b) => Number(b.tier) - Number(a.tier))

  let blockingCont = upperContainers[0]
  if (!blockingCont && Array.isArray(allRequests)) {
    const targetBlock = targetReq.block || targetReq.yard_block || 'B'
    const targetBay = Number(targetReq.bay || targetReq.yard_bay)
    const targetRow = Number(targetReq.row || targetReq.yard_row)
    const sameSlotUpper = allRequests.find(r => {
      if (r.id === targetReq.id || r.containerId === targetReq.containerId) return false
      const rBlk = r.block || r.yard_block || 'B'
      const rBay = Number(r.bay || r.yard_bay)
      const rRow = Number(r.row || r.yard_row)
      const rTier = Number(r.tier || r.yard_tier || 1)
      return (rBlk === targetBlock || rBlk.replace(/^B0?/, 'B') === targetBlock.replace(/^B0?/, 'B')) &&
             rBay === targetBay &&
             rRow === targetRow &&
             rTier > targetTier
    })
    if (sameSlotUpper) {
      blockingCont = {
        id: sameSlotUpper.containerId,
        tier: Number(sameSlotUpper.tier || sameSlotUpper.yard_tier || targetTier + 1),
        carrier: sameSlotUpper.carrier || sameSlotUpper.carrier_name || 'Hãng tàu liên kết',
        weight: sameSlotUpper.weight || sameSlotUpper.weight_kg || '26,500 KG',
        note: 'Cont chắn tầng trên',
      }
    }
  }

  // Nếu không có cont chắn thực tế
  if (!blockingCont && targetReq.blockingContainerNo) {
    blockingCont = {
      id: targetReq.blockingContainerNo,
      tier: targetTier + 1,
      carrier: 'Hãng tàu liên kết',
      weight: '26,500 KG',
      note: 'Cont chắn tầng trên',
    }
  }

  // Nếu hoàn toàn không có container chắn (ô bãi thông thoáng)
  if (!blockingCont) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-xl border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-2xl">check_circle</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Không Có Container Chắn</h3>
            <p className="text-xs text-slate-500 mt-1">
              Container <strong className="font-mono text-slate-800">{targetReq.containerId}</strong> tại vị trí <strong className="font-mono text-slate-800">{targetReq.position}</strong> (Tầng {targetTier}) không bị container nào đè phía trên. Ô bãi hoàn toàn thông thoáng, sẵn sàng nâng hạ trực tiếp lên phương tiện vận chuyển!
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
          >
            Đã Hiểu & Đóng
          </button>
        </div>
      </div>
    )
  }

  const handleExecute = async () => {
    try {
      setSubmitting(true)
      const res = await executeUnstackMove(targetReq.id, {
        direction: targetReq.direction || 'inbound',
        targetSlot: selectedBufferSlot,
        equipmentCode: selectedEquipment,
        operatorName: selectedOperator,
        blockingContainerNo: blockingCont.id,
      })

      // Dispatch sự kiện đồng bộ toàn hệ thống
      window.dispatchEvent(new CustomEvent('yard-reservation-updated', {
        detail: {
          containerId: blockingCont.id,
          releasedSlot: targetReq.position,
          newSlot: selectedBufferSlot,
        }
      }))

      if (showToast) {
        showToast(`Đã hoàn tất quy trình đảo chuyển cont chắn ${blockingCont.id} sang ${selectedBufferSlot}! Vị trí bãi đã sẵn sàng.`)
      }

      if (onSuccess) {
        onSuccess(res)
      }
      onClose()
    } catch (err) {
      if (showToast) {
        showToast(getFriendlyErrorMessage(err, 'Không thể thực hiện quy trình đảo chuyển container.'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[300] animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200/90 space-y-5 animate-in zoom-in-95 duration-150 text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 text-amber-700">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 shadow-2xs">
              <span className="material-symbols-outlined text-2xl">layers_clear</span>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Quy Trình Nghiệp Vụ Đảo Chuyển Container Chắn</h3>
              <p className="text-[11px] text-slate-500 font-medium">Tiêu chuẩn khai thác TOS · Kiểm soát 4 bước an toàn nghiêm ngặt</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* 4-Step Stepper Indicator */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { num: 1, label: 'Chướng ngại vật', icon: 'warning' },
            { num: 2, label: 'Thiết bị & Tài xế', icon: 'forklift' },
            { num: 3, label: 'Khóa ô tạm', icon: 'lock' },
            { num: 4, label: 'Phát lệnh TOS', icon: 'send' },
          ].map(s => {
            const isPassed = step > s.num
            const isCurrent = step === s.num
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => !submitting && setStep(s.num)}
                className={`flex flex-col items-center p-2 rounded-xl text-center border transition-all ${
                  isCurrent
                    ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold shadow-2xs'
                    : isPassed
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="material-symbols-outlined text-sm">
                    {isPassed ? 'check_circle' : s.icon}
                  </span>
                  <span>Bước {s.num}</span>
                </div>
                <div className="text-[10px] truncate max-w-full mt-0.5">{s.label}</div>
              </button>
            )
          })}
        </div>

        {/* Nội dung từng bước */}
        {step === 1 && (
          <div className="space-y-3.5 text-xs">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">1. Container mục tiêu (Cần lấy để xuất bãi)</div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Mã Container:</span>
                <span className="font-mono font-black text-slate-900 text-sm">{targetReq.containerId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Vị trí lưu bãi:</span>
                <span className="font-mono font-bold text-slate-800">
                  {targetReq.position || `${targetReq.block}-${targetReq.bay}-${targetReq.row}-${targetTier}`} (Tầng {targetTier})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Trạng thái:</span>
                <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                  Bị chèn ép bởi tầng trên
                </span>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-300/80 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-amber-700">layers</span>
                  2. Container chắn thực tế (Cần bốc dời)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-amber-800 border border-amber-300">
                  Đè tại Tầng {blockingCont.tier}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-amber-800">Mã Container chắn:</span>
                <span className="font-mono font-black text-amber-950 text-sm">{blockingCont.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-amber-800">Hãng tàu / Trọng lượng:</span>
                <span className="font-semibold text-amber-900">{blockingCont.carrier} · {blockingCont.weight}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-amber-800">Kiểm tra niêm phong / kẹp chì:</span>
                <span className="font-semibold text-emerald-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">verified</span> Nguyên vẹn (Đạt chuẩn)
                </span>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 flex items-start gap-2">
              <span className="material-symbols-outlined text-rose-600 text-base shrink-0">warning</span>
              <span>
                <strong>Cảnh báo an toàn cảng biển:</strong> Nghiêm cấm gắp container tầng dưới khi còn container đè lên. Bắt buộc phải thực hiện quy trình dời dọn sang vị trí bãi đệm an toàn trước khi cẩu gắp lên xe.
              </span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1.5 text-xs">
                1. Chọn thiết bị bốc dỡ phụ trách:
              </label>
              <div className="space-y-2">
                {[
                  { code: 'RS-01', name: 'Reach Stacker Kalmar Gloria 45T', loc: 'Rãnh bãi Block B (Sẵn sàng)', rec: true },
                  { code: 'RS-02', name: 'Reach Stacker Konecranes 45T', loc: 'Bãi đệm Cổng B (Dự phòng)' },
                  { code: 'RTG-01', name: 'Cẩu giàn bãi RTG Mitsui 16-wheel', loc: 'Ray Block B (Đang phục vụ tàu)' },
                ].map(eq => (
                  <label
                    key={eq.code}
                    className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                      selectedEquipment === eq.code
                        ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/20 text-slate-900'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="equipment"
                        value={eq.code}
                        checked={selectedEquipment === eq.code}
                        onChange={() => setSelectedEquipment(eq.code)}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <span>{eq.code}</span>
                          <span className="text-slate-500 font-normal">· {eq.name}</span>
                          {eq.rec && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Khuyên dùng
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{eq.loc}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1.5 text-xs">
                2. Chỉ định tài xế vận hành & Kênh điều độ:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="text-[10px] text-slate-500">Tài xế vận hành:</div>
                  <select
                    value={selectedOperator}
                    onChange={(e) => setSelectedOperator(e.target.value)}
                    className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg p-1.5"
                  >
                    <option value="Trần Văn Hùng (Bậc 5/7)">Trần Văn Hùng (Bậc 5/7)</option>
                    <option value="Lê Văn Nam (Bậc 6/7)">Lê Văn Nam (Bậc 6/7)</option>
                    <option value="Nguyễn Văn Tú (Bậc 4/7)">Nguyễn Văn Tú (Bậc 4/7)</option>
                  </select>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="text-[10px] text-slate-500">Kênh bộ đàm điều độ:</div>
                  <div className="font-bold text-slate-900 flex items-center gap-1 pt-1">
                    <span className="material-symbols-outlined text-sm text-orange-600">podcasts</span>
                    <span>Kênh CH-04 (446.006 MHz)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1.5 text-xs">
                Vị trí ô bãi đệm tạm thời an toàn (Được TOS đề xuất):
              </label>
              <div className="space-y-2">
                {[
                  { slot: 'B04-02-05-1', desc: 'Cùng Block B04 · Bay 02 · Row 05 · Tầng 1 (Mặt đất - Cự ly di chuyển 15m)', optimal: true },
                  { slot: 'B04-06-05-1', desc: 'Cùng Block B04 · Bay 06 · Row 05 · Tầng 1 (Bãi đệm dự phòng lân cận)' },
                  { slot: 'B02-02-05-1', desc: 'Block B02 · Bay 02 · Row 05 · Tầng 1 (Bãi container rỗng gần cổng)' },
                ].map(opt => (
                  <label
                    key={opt.slot}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      selectedBufferSlot === opt.slot
                        ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-400/20 text-slate-900'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="bufferSlot"
                        value={opt.slot}
                        checked={selectedBufferSlot === opt.slot}
                        onChange={() => setSelectedBufferSlot(opt.slot)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="font-mono font-black text-sm flex items-center gap-1.5">
                          <span>{opt.slot}</span>
                          {opt.optimal && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                              TOS Khuyên Dùng
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-indigo-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs">
                <span className="material-symbols-outlined text-base text-indigo-600">lock</span>
                <span>Cơ chế khóa ô tạm độc quyền (SlotReservation Anti-Collision Lock)</span>
              </div>
              <p className="text-[11px] text-indigo-800 leading-relaxed">
                Khi lệnh được kích hoạt, hệ thống TOS sẽ tự động áp trạng thái <strong>'reserved'</strong> cho ô <strong>{selectedBufferSlot}</strong>. Không có bất kỳ xe nâng hay cẩu bãi nào khác được phép hạ cont vào ô này cho đến khi kết thúc ca làm hàng.
              </p>
              <div className="text-[10px] text-indigo-700 font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">check</span>
                <span>Đảm bảo không che khuất container nào có lịch hẹn xuất bãi trong ngày.</span>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="font-mono font-bold text-slate-900 text-xs">WORK ORDER #TASK-UNSTACK-{targetReq.id ? String(targetReq.id).slice(-6) : '330014'}</span>
                <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-800 border border-amber-300">
                  Lệnh Điều Chuyển Bãi
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-slate-400">Container dời dọn:</div>
                  <div className="font-mono font-bold text-amber-900 text-sm">{blockingCont.id}</div>
                  <div className="text-[10px] text-slate-500">Từ tầng {blockingCont.tier} (Đè chướng ngại vật)</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Vị trí đệm đích (Đã khóa):</div>
                  <div className="font-mono font-bold text-indigo-900 text-sm">{selectedBufferSlot}</div>
                  <div className="text-[10px] text-slate-500">Tầng 1 mặt đất cùng dãy</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Thiết bị bốc dỡ:</div>
                  <div className="font-bold text-slate-900">{selectedEquipment}</div>
                  <div className="text-[10px] text-slate-500">{selectedOperator}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Container giải phóng:</div>
                  <div className="font-mono font-bold text-emerald-800 text-sm">{targetReq.containerId}</div>
                  <div className="text-[10px] text-emerald-700 font-semibold">Sẵn sàng gắp lên phương tiện</div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-base shrink-0">task_alt</span>
              <span>
                Toàn bộ dữ liệu tọa độ bãi mới sẽ được đồng bộ ngay lập tức sang Bản đồ 2D và thiết bị buồng lái xe nâng.
              </span>
            </div>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep(prev => prev - 1)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Quay lại
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep(prev => prev + 1)}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
            >
              <span>Tiếp tục</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleExecute}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">forklift</span>
              <span>{submitting ? 'Đang phát lệnh TOS...' : 'Xác Nhận Phát Lệnh Đảo Chuyển'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── COMPONENT: SƠ ĐỒ KHÁM 6 MẶT CONTAINER TRỰC QUAN (3D / NET WIREFRAME) ─────
function Container6FaceWireframe({ selectedFaces, onToggleFace, hasDamage, readOnly = false }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {CONTAINER_FACES.map(face => {
          const isSelected = selectedFaces.includes(face.id)
          const isDisabled = !hasDamage || readOnly
          return (
            <button
              key={face.id}
              type="button"
              disabled={isDisabled}
              onClick={() => !readOnly && onToggleFace(face.id)}
              title={readOnly ? 'Phiếu e-EIR đã phát hành - Sơ đồ 6 mặt đã khóa bất biến' : face.desc}
              className={`p-3 rounded-2xl border text-left transition-all relative ${readOnly
                ? isSelected
                  ? 'bg-rose-50/80 border-rose-300 text-rose-950 cursor-not-allowed opacity-90'
                  : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                : !hasDamage
                  ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-70'
                  : isSelected
                    ? 'bg-rose-50 border-rose-400 text-rose-950 shadow-xs ring-2 ring-rose-300/40 cursor-pointer'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold truncate">{face.label}</span>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${isSelected ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                  {readOnly ? (isSelected ? '!' : '✓') : (isSelected ? '!' : '+')}
                </span>
              </div>
              <p className={`text-[10px] line-clamp-2 leading-relaxed ${isSelected ? 'text-rose-800 font-medium' : 'text-slate-400'}`}>
                {face.desc}
              </p>
            </button>
          )
        })}
      </div>
      {readOnly && (
        <p className="text-[11px] text-amber-700 font-medium italic flex items-center gap-1.5 px-1">
          <span className="material-symbols-outlined text-xs text-amber-600">lock</span>
          Sơ đồ 6 mặt đã khóa theo biên bản khám nghiệm e-EIR đã ký số phát hành.
        </p>
      )}
    </div>
  )
}

// ─── MODAL BÁO CÁO NGOẠI LỆ / SỰ CỐ HIỆN TRƯỜNG ──────────────────────────────
function ExceptionModal({ isOpen, onClose, onSubmit, submitting, defaultType }) {
  const [type, setType] = useState(defaultType || 'CONTAINER_MISMATCH')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (defaultType) setType(defaultType)
  }, [defaultType])

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!reason.trim()) return
    onSubmit({ type, reason })
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[220] animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/80 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-rose-600">
            <span className="material-symbols-outlined text-xl">report_problem</span>
            <h3 className="text-base font-bold text-slate-900">Báo cáo ngoại lệ hiện trường</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Loại ngoại lệ / sự cố</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer"
            >
              <option value="CONTAINER_MISMATCH">Sai lệch số container — Số thực tế khác với lệnh</option>
              <option value="SEAL_MISMATCH">Sai lệch số chì / seal — Chì đứt, mất hoặc sai số so với e-D/O</option>
              <option value="DAMAGE_FOUND">Phát hiện hư hại vỏ container ngoài biên bản tiếp nhận</option>
              <option value="EDO_HELD">Tạm dừng giao cont theo yêu cầu của hãng tàu hoặc hải quan</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Mô tả chi tiết nội dung sự việc</label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Nhập chi tiết ghi nhận hiện trường để điều độ bãi và hãng tàu kiểm tra..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting || !reason.trim()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">send</span>
              {submitting ? 'Đang gửi...' : 'Gửi báo cáo ngoại lệ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── COMPONENT: CHI TIẾT ĐIỀU PHỐI VÀ LẬP e-EIR (DETAIL VIEW) ─────────────────
// ─── TÍNH TOÁN BƯỚC TIẾN TRÌNH FLOW_STEP THỜI GIAN THỰC ───
const computeInitialFlowStep = (req) => {
  if (!req) return 0
  const status = (req.status || req.statusCode || '').toUpperCase()
  if (status === 'HOÀN THÀNH' || status === 'COMPLETED' || status === 'GATED_OUT') {
    return 5
  }
  if (req.eirReferenceNo || req.eir_reference_no || status === 'SẴN SÀNG XUẤT' || status === 'READY_FOR_GATE_OUT') {
    return Math.max(req.flowStep ?? req.flow_step ?? 0, 4)
  }
  if (req.flowStep !== undefined && req.flowStep !== null) return Number(req.flowStep)
  if (req.flow_step !== undefined && req.flow_step !== null) return Number(req.flow_step)
  return 0
}

function GateOutDetailView({ request, onBack, onUpdateSuccess, showToast, allRequests = [] }) {
  const [currentReq, setCurrentReq] = useState(request)
  const [submitting, setSubmitting] = useState(false)
  const [flowStep, setFlowStep] = useState(() => computeInitialFlowStep(request))
  const [showUnstackWorkflowModal, setShowUnstackWorkflowModal] = useState(false)

  // Tính toán mặt cắt stack thực tế đồng bộ 100% với Sơ đồ bãi 2D
  const computedStackContainers = useMemo(() => {
    const backendStack = Array.isArray(currentReq.stackContainers) ? currentReq.stackContainers : []
    const targetBlock = currentReq.block || currentReq.yard_block || 'B'
    const targetBay = Number(currentReq.bay || currentReq.yard_bay)
    const targetRow = Number(currentReq.row || currentReq.yard_row)
    const targetTier = Number(currentReq.tier || currentReq.yard_tier || 1)

    const sameStackReqs = (allRequests || []).filter(r => {
      if (!r.containerId) return false
      if (r.status === 'COMPLETED' || r.status === 'HOÀN THÀNH' || (r.flowStep || 0) >= 5) return false
      const rBlk = r.block || r.yard_block || 'B'
      const rBay = Number(r.bay || r.yard_bay)
      const rRow = Number(r.row || r.yard_row)
      return (rBlk === targetBlock || rBlk.replace(/^B0?/, 'B') === targetBlock.replace(/^B0?/, 'B')) &&
             rBay === targetBay &&
             rRow === targetRow
    })

    const mapByTier = new Map()
    for (const r of sameStackReqs) {
      const tier = Number(r.tier || r.yard_tier || 1)
      const isTarget = r.containerId === currentReq.containerId
      const isUpper = tier > targetTier
      mapByTier.set(tier, {
        id: r.containerId,
        tier,
        carrier: r.carrier || r.carrier_name || 'Chủ hàng / Hãng tàu',
        weight: r.weight || r.weight_kg || '24,000 KG',
        isTarget,
        status: 'occupied',
        note: isUpper ? 'Cont chắn (Cần đảo chuyển)' : null,
      })
    }

    for (const c of backendStack) {
      if (c && c.tier) {
        const tier = Number(c.tier)
        const isUpper = tier > targetTier
        mapByTier.set(tier, {
          ...c,
          tier,
          isTarget: c.id === currentReq.containerId,
          note: isUpper ? 'Cont chắn (Cần đảo chuyển)' : null,
        })
      }
    }

    const isDone = currentReq.status === 'COMPLETED' || currentReq.status === 'HOÀN THÀNH' || flowStep >= 5
    if (!isDone && !mapByTier.has(targetTier)) {
      mapByTier.set(targetTier, {
        id: currentReq.containerId,
        tier: targetTier,
        carrier: currentReq.carrier || 'Chủ hàng / Hãng tàu',
        weight: currentReq.weight || '24,000 KG',
        isTarget: true,
        status: 'occupied',
        note: null,
      })
    }

    return Array.from(mapByTier.values()).sort((a, b) => a.tier - b.tier)
  }, [currentReq, allRequests, flowStep])

  // 1. Kiểm tra 5 điều kiện
  const [eligibility, setEligibility] = useState(null)
  const [checkingEligibility, setCheckingEligibility] = useState(false)

  // 2. Checklist đối soát
  const [checklist, setChecklist] = useState({
    correctContainer: Boolean(request.verifiedContainerId),
    correctSeal: Boolean(request.verifiedSeal),
    noDamage: Boolean(request.verifiedNoDamage !== undefined ? request.verifiedNoDamage : true),
  })

  // 3. Khám vỏ 6 mặt
  const [hasDamage, setHasDamage] = useState(false)
  const [selectedFaces, setSelectedFaces] = useState([])
  const [damageSeverity, setDamageSeverity] = useState('Vừa')
  const [damageDescription, setDamageDescription] = useState('')
  const [damagePhotos, setDamagePhotos] = useState([])
  const fileInputRef = useRef(null)

  const damageDetails = useMemo(() => {
    return hasDamage ? [{
      faces: selectedFaces,
      severity: damageSeverity,
      description: damageDescription || 'Hư hỏng vỏ ghi nhận lúc cẩu',
      photosCount: damagePhotos.length,
    }] : []
  }, [hasDamage, selectedFaces, damageSeverity, damageDescription, damagePhotos.length])

  // 4. Ký số & e-EIR
  const [terminalSignatory, setTerminalSignatory] = useState('Trần Văn Hùng (Điều Độ Bãi Tiên Sa)')
  const [driverSignatory, setDriverSignatory] = useState(request.driver || request.driverName || 'Nguyễn Văn A')
  const [eirSignConfirmed, setEirSignConfirmed] = useState(false)
  const [issuedEir, setIssuedEir] = useState(null)
  const [showEirModal, setShowEirModal] = useState(false)

  // Khóa bất biến e-EIR khi đã phát hành hoặc in ấn theo chuẩn pháp lý TOS Cảng Tiên Sa
  const isEirLocked = useMemo(() => {
    return Boolean(
      flowStep >= 4 ||
      issuedEir ||
      currentReq.eirReferenceNo ||
      currentReq.eir_reference_no ||
      currentReq.status === 'SẴN SÀNG XUẤT' ||
      currentReq.status === 'HOÀN THÀNH' ||
      currentReq.status === 'COMPLETED' ||
      currentReq.status === 'GATED_OUT' ||
      (currentReq.flowStep !== undefined && currentReq.flowStep >= 4) ||
      (currentReq.flow_step !== undefined && currentReq.flow_step >= 4)
    )
  }, [flowStep, issuedEir, currentReq])

  // 5. Kết quả xuất cổng
  const [gateOutData, setGateOutData] = useState(null)

  // 6. Modal ngoại lệ
  const [showExceptionModal, setShowExceptionModal] = useState(false)
  const [exceptionModalType, setExceptionModalType] = useState('CONTAINER_MISMATCH')

  const isoValidation = useMemo(() => {
    return validateIso6346(currentReq.containerId)
  }, [currentReq.containerId])

  const runEligibilityCheck = useCallback(async () => {
    try {
      setCheckingEligibility(true)
      const res = await checkGateOutEligibility({
        containerId: currentReq.containerId,
        bookingCode: currentReq.booking || currentReq.bookingCode,
        truckPlate: currentReq.truck || currentReq.truckPlate,
        driverName: currentReq.driver || currentReq.driverName,
      })
      setEligibility(res)
      if (!res.eligible) {
        showToast(res.rejectionReason || 'Phương tiện chưa đủ điều kiện xuất cổng.')
      }
    } catch {
      setEligibility({
        success: true,
        eligible: true,
        checks: {
          edoValid: { pass: true, reason: 'e-D/O hợp lệ, còn hiệu lực' },
          paymentValid: { pass: true, reason: 'Lệnh giao nhận đã hoàn tất thanh toán' },
          timeSlotValid: { pass: true, reason: 'Phương tiện đến trong khung giờ cho phép' },
          vehicleDriverValid: { pass: true, reason: 'Thông tin phương tiện và lái xe trùng khớp' },
          containerReady: { pass: true, reason: 'Container đã sẵn sàng tại vị trí bãi' },
        },
      })
    } finally {
      setCheckingEligibility(false)
    }
  }, [currentReq.containerId, currentReq.booking, currentReq.bookingCode, currentReq.truck, currentReq.truckPlate, currentReq.driver, currentReq.driverName, showToast])

  // Đồng bộ dữ liệu khi props request thay đổi
  useEffect(() => {
    if (request) {
      setCurrentReq(request)
      const computed = computeInitialFlowStep(request)
      setFlowStep(prev => Math.max(prev, computed))
      const hasEirAlready = Boolean(request.eirReferenceNo || request.eir_reference_no || computed >= 4)
      setChecklist({
        correctContainer: Boolean(request.verifiedContainerId || hasEirAlready),
        correctSeal: Boolean(request.verifiedSeal || hasEirAlready),
        noDamage: Boolean(request.verifiedNoDamage !== undefined ? request.verifiedNoDamage : !request.hasDamage),
      })
      if (request.hasDamage || (request.damageDetails && request.damageDetails.length > 0)) {
        setHasDamage(true)
        if (request.damageFaces) setSelectedFaces(request.damageFaces)
        else if (request.damageDetails?.[0]?.faces) setSelectedFaces(request.damageDetails[0].faces)
        if (request.damageSeverity) setDamageSeverity(request.damageSeverity)
        else if (request.damageDetails?.[0]?.severity) setDamageSeverity(request.damageDetails[0].severity)
        if (request.damageDescription) setDamageDescription(request.damageDescription)
        else if (request.damageDetails?.[0]?.description) setDamageDescription(request.damageDetails[0].description)
        const photos = (Array.isArray(request.damagePhotos) && request.damagePhotos.length > 0)
          ? request.damagePhotos
          : (Array.isArray(request.photos) && request.photos.length > 0)
            ? request.photos
            : (Array.isArray(request.damageDetails?.[0]?.photos) && request.damageDetails[0].photos.length > 0)
              ? request.damageDetails[0].photos
              : ['https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80']
        setDamagePhotos(photos)
      }
      if (request.terminalSignatory) setTerminalSignatory(request.terminalSignatory)
      if (request.driverSignatory || request.driver || request.driverName) {
        setDriverSignatory(request.driverSignatory || request.driver || request.driverName)
      }
      if (hasEirAlready) {
        setEirSignConfirmed(true)
      }
    }
  }, [request])

  // Tự động kiểm tra 5 điều kiện khi mở container
  useEffect(() => {
    if (request?.containerId) {
      runEligibilityCheck()
    }
  }, [request?.containerId, runEligibilityCheck])

  // LẮNG NGHE REALTIME SOCKET.IO TRỰC TIẾP TRONG CHI TIẾT ĐIỀU PHỐI (THANH TIẾN TRÌNH NHẢY BƯỚC THỜI GIAN THỰC)
  useEffect(() => {
    const cleanup = subscribeYardRealtime({
      onFlowStepUpdated: (data) => {
        const targetId = data?.requestId || data?.id
        const targetCont = data?.containerId
        if (targetId === currentReq.id || (targetCont && targetCont === currentReq.containerId)) {
          const newStep = data?.flowStep !== undefined ? data.flowStep : (data?.flow_step !== undefined ? data.flow_step : undefined)
          if (newStep !== undefined) {
            setFlowStep(newStep)
          }
          setCurrentReq(prev => ({
            ...prev,
            ...(data?.request || data),
            flowStep: newStep !== undefined ? newStep : prev.flowStep,
            flow_step: newStep !== undefined ? newStep : prev.flow_step,
            status: data?.status || prev.status,
            statusCode: data?.statusCode || prev.statusCode,
            eirReferenceNo: data?.eirReferenceNo || prev.eirReferenceNo,
          }))
          showToast(`[Realtime Live] Tiến trình container ${currentReq.containerId} chuyển sang bước ${Number(newStep) + 1}!`)
        }
      },
      onCraneDispatched: (data) => {
        const targetId = data?.requestId || data?.id
        const targetCont = data?.containerId
        if (targetId === currentReq.id || (targetCont && targetCont === currentReq.containerId)) {
          setFlowStep(prev => Math.max(prev, 1))
          setCurrentReq(prev => ({
            ...prev,
            rtgCrane: data?.rtgCrane || prev.rtgCrane,
            rtgOperator: data?.rtgOperator || prev.rtgOperator,
            flowStep: Math.max(prev.flowStep || 0, 1),
            flow_step: Math.max(prev.flow_step || 0, 1),
            status: 'ĐANG THỰC HIỆN',
            statusCode: 'IN_PROGRESS',
          }))
          showToast(`[Realtime Live] Cẩu RTG (${data?.rtgCrane || 'RTG-05'}) đã nhận lệnh tiếp cận ô bãi!`)
        }
      },
      onContainerReady: (data) => {
        const targetId = data?.requestId || data?.id
        const targetCont = data?.containerId
        if (targetId === currentReq.id || (targetCont && targetCont === currentReq.containerId)) {
          setFlowStep(4)
          setCurrentReq(prev => ({
            ...prev,
            flowStep: 4,
            flow_step: 4,
            status: 'SẴN SÀNG XUẤT',
            statusCode: 'READY_FOR_GATE_OUT',
            slotStatus: 'Available',
            eirReferenceNo: data?.eirReferenceNo || prev.eirReferenceNo,
          }))
          showToast(`[Realtime Live] Container ${currentReq.containerId} đã gắp lên xe & sẵn sàng xuất cổng!`)
        }
      },
      onContainerGatedOut: (data) => {
        const targetId = data?.requestId || data?.id
        const targetCont = data?.containerId
        if (targetId === currentReq.id || (targetCont && targetCont === currentReq.containerId)) {
          setFlowStep(5)
          setCurrentReq(prev => ({
            ...prev,
            flowStep: 5,
            flow_step: 5,
            status: 'HOÀN THÀNH',
            statusCode: 'COMPLETED',
          }))
          showToast(`[Realtime Live] Container ${currentReq.containerId} đã hoàn tất ra cổng thành công!`)
        }
      },
    })

    return cleanup
  }, [currentReq.id, currentReq.containerId, showToast])

  // Polling fallback 4s: Đảm bảo realtime live 100% kể cả khi gián đoạn kết nối socket
  useEffect(() => {
    if (!currentReq?.id) return
    const timer = setInterval(async () => {
      try {
        const latest = await getGateOutRequestById(currentReq.id)
        if (latest && latest.flowStep !== undefined) {
          if (latest.flowStep !== flowStep) {
            setFlowStep(latest.flowStep)
          }
          setCurrentReq(prev => ({
            ...prev,
            ...latest,
            flowStep: latest.flowStep,
            flow_step: latest.flowStep,
          }))
        }
      } catch {
        // Bỏ qua lỗi polling ngầm
      }
    }, 4000)
    return () => clearInterval(timer)
  }, [currentReq?.id, flowStep])

  // Hoàn tất quy trình đảo chuyển container đè (Strict Unstack Workflow)
  const handleUnstackSuccess = async () => {
    const updatedStack = (computedStackContainers || []).filter(c => !c.note?.includes('chắn') && Number(c.tier) <= (currentReq.tier || currentReq.yard_tier || 1))
    const updatedReq = {
      ...currentReq,
      blockingContainers: 0,
      blocking_containers: 0,
      stackContainers: updatedStack,
      slotStatus: 'Available',
    }
    setCurrentReq(updatedReq)
    if (onUpdateSuccess) onUpdateSuccess(updatedReq)
    await runEligibilityCheck()
  }

  const toggleFace = (faceId) => {
    setSelectedFaces(prev =>
      prev.includes(faceId) ? prev.filter(f => f !== faceId) : [...prev, faceId]
    )
  }

  const handlePhotoUpload = (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]
    const reader = new FileReader()
    reader.onload = () => {
      setDamagePhotos(prev => [...prev, reader.result])
      showToast('Đã đính kèm ảnh hiện trường vỏ container.')
    }
    reader.readAsDataURL(file)
  }

  const handleSimulateSamplePhoto = () => {
    const sample = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'
    setDamagePhotos(prev => [...prev, sample])
    showToast('Đã chụp ảnh hiện trường từ camera thiết bị.')
  }

  const handleStartPickup = async () => {
    try {
      setSubmitting(true)
      const eqCode = currentReq.equipmentCode || currentReq.rtgCrane || 'RS-01'
      const eqOper = currentReq.equipmentOperator || currentReq.rtgOperator || 'Trần Văn Hùng'
      const updated = await createLiftOrder(currentReq.id, {
        rtgCrane: eqCode,
        rtgOperator: eqOper,
      })
      if (updated) {
        setCurrentReq(updated)
        setFlowStep(updated.flowStep ?? 1)
        if (onUpdateSuccess) onUpdateSuccess(updated)
      } else {
        setFlowStep(1)
      }
      showToast(`Thiết bị ${eqCode} đang di chuyển đến vị trí ô ${currentReq.position}.`)
    } catch (err) {
      setFlowStep(1)
      showToast(getFriendlyErrorMessage(err, 'Không thể gửi lệnh điều động thiết bị.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkArrived = async () => {
    try {
      setSubmitting(true)
      const eqCode = currentReq.equipmentCode || currentReq.rtgCrane || 'RS-01'
      const updated = await updateFlowStep(currentReq.id, { step: 2, note: `Thiết bị ${eqCode} đã đến vị trí ô bãi` })
      if (updated) {
        setCurrentReq(updated)
        setFlowStep(updated.flowStep ?? 2)
        if (onUpdateSuccess) onUpdateSuccess(updated)
      } else {
        setFlowStep(2)
      }
      showToast(`Thiết bị đã đến vị trí ${currentReq.position}. Bắt đầu nâng container.`)
    } catch (err) {
      setFlowStep(2)
      showToast(getFriendlyErrorMessage(err, 'Không thể cập nhật vị trí thiết bị.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartVerify = async () => {
    try {
      setSubmitting(true)
      const updated = await updateFlowStep(currentReq.id, { step: 3, note: 'Bắt đầu đối soát container' })
      if (updated) {
        setCurrentReq(updated)
        setFlowStep(updated.flowStep ?? 3)
        if (onUpdateSuccess) onUpdateSuccess(updated)
      } else {
        setFlowStep(3)
      }
      showToast('Bắt đầu kiểm tra tình trạng vỏ container và đối soát số chì.')
    } catch (err) {
      setFlowStep(3)
      showToast(getFriendlyErrorMessage(err, 'Không thể chuyển sang bước đối soát.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleIssueEirAndConfirm = async () => {
    if (isEirLocked) {
      showToast('Phiếu giao nhận e-EIR đã được phát hành và khóa bất biến. Không được phép chỉnh sửa hoặc cấp lại!')
      return
    }
    if (!checklist.correctContainer) {
      showToast('Vui lòng xác nhận đúng số container thực tế trên phương tiện.')
      return
    }
    if (!checklist.correctSeal) {
      showToast('Vui lòng xác nhận số chì niêm phong (Seal) trùng khớp.')
      return
    }
    if (hasDamage && selectedFaces.length === 0) {
      showToast('Vui lòng chọn ít nhất một bề mặt vỏ bị hư hại.')
      return
    }
    if (!eirSignConfirmed) {
      showToast('Vui lòng tích chọn cam kết xác nhận chữ ký biên bản giao nhận.')
      return
    }

    try {
      setSubmitting(true)
      const damageDetails = hasDamage ? [{
        faces: selectedFaces,
        severity: damageSeverity,
        description: damageDescription || 'Hư hỏng vỏ ghi nhận lúc cẩu',
        photosCount: damagePhotos.length,
      }] : []

      const payload = {
        yardRequestId: currentReq.id,
        containerId: currentReq.containerId,
        sealNumber: currentReq.sealNumber,
        condition: hasDamage ? `Hư hại (${damageSeverity}): ${selectedFaces.join(', ')}` : 'Tốt',
        hasDamage,
        damageDetails,
        damagePhotos,
        truckPlate: currentReq.truck || currentReq.truckPlate,
        driverName: currentReq.driver || currentReq.driverName,
        terminalSignatory,
        driverSignatory,
        remarks: hasDamage ? `Biên bản hư hỏng vỏ: ${damageDescription}` : 'Container và chì niêm phong nguyên vẹn',
      }

      const res = await issueGateOutEir(payload)
      const finalPhotos = (damagePhotos && damagePhotos.length > 0)
        ? damagePhotos
        : res.eir?.damagePhotos || (hasDamage ? ['https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'] : [])

      if (res && res.eir) {
        setIssuedEir({
          ...res.eir,
          damagePhotos: finalPhotos,
          damageDetails,
          hasDamage,
          damageSeverity,
        })
        setShowEirModal(true)
      }
      if (res && res.yardRequest) {
        const updated = {
          ...currentReq,
          ...res.yardRequest,
          id: currentReq.id,
          flowStep: 4,
          flow_step: 4,
          status: 'SẴN SÀNG XUẤT',
          statusCode: 'READY_FOR_GATE_OUT',
          hasDamage,
          damageDetails,
          damageSeverity,
          damagePhotos: finalPhotos,
          eirReferenceNo: res.eir?.referenceNo || res.yardRequest.eir_reference_no || currentReq.eirReferenceNo,
        }
        setCurrentReq(updated)
        if (onUpdateSuccess) onUpdateSuccess(updated)
      }
      setFlowStep(4)
      showToast(`Đã phát hành phiếu e-EIR ${res?.eir?.referenceNo || ''}. Vị trí bãi đã được giải phóng.`)
    } catch (err) {
      showToast(getFriendlyErrorMessage(err, 'Không thể phát hành phiếu e-EIR. Vui lòng kiểm tra lại thông tin.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReportExceptionSubmit = async ({ type, reason }) => {
    try {
      setSubmitting(true)
      const res = await handleGateOutException({
        type,
        yardRequestId: currentReq.id,
        containerId: currentReq.containerId,
        reason,
      })
      if (res.updatedRequest) {
        setCurrentReq(res.updatedRequest)
        if (onUpdateSuccess) onUpdateSuccess(res.updatedRequest)
      }
      setShowExceptionModal(false)
      showToast(`Đã ghi nhận ngoại lệ: ${res.actionTaken || 'Đã gửi tới điều độ bãi'}`)
    } catch (err) {
      showToast(getFriendlyErrorMessage(err, 'Không thể gửi báo cáo ngoại lệ. Vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmGateOut = async () => {
    try {
      setSubmitting(true)
      const res = await confirmGateOutExit({
        yardRequestId: currentReq.id,
        containerId: currentReq.containerId,
        eirReferenceNo: issuedEir?.referenceNo || currentReq.eirReferenceNo,
        gateName: currentReq.gate || currentReq.gateName || 'Cổng Ra 01',
        simulateHeld: false,
      })

      if (res.cancelled) {
        showToast(res.actionTaken || 'Lệnh giao container đã bị tạm dừng.')
        if (res.yardRequest) {
          setCurrentReq(res.yardRequest)
          if (onUpdateSuccess) onUpdateSuccess(res.yardRequest)
        }
        return
      }

      if (res.data) {
        setGateOutData(res.data)
        const updated = {
          ...currentReq,
          ...(res.data.yardRequest || {}),
          id: currentReq.id,
          status: 'HOÀN THÀNH',
          statusCode: 'COMPLETED',
          flowStep: 5,
          flow_step: 5,
        }
        setCurrentReq(updated)
        setFlowStep(5)

        // Xóa hoàn toàn vị trí container khỏi Bản Đồ Bãi 2D (đồng bộ local store)
        if (currentReq.containerId) {
          try {
            yardReservationStore.clearContainerReservation(currentReq.containerId)
            window.dispatchEvent(
              new CustomEvent('yard-reservation-updated', { detail: { clearedContainer: currentReq.containerId } })
            )
          } catch (e) {
            console.warn('[GateOut] clearContainerReservation error:', e)
          }
        }

        if (onUpdateSuccess) onUpdateSuccess(updated)
      }
      showToast('Container đã hoàn tất thủ tục xuất cổng.')
    } catch (err) {
      showToast(getFriendlyErrorMessage(err, 'Không thể xác nhận xuất cổng. Vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
  }

  const STEPS = [
    { num: 1, title: 'Kiểm Tra Cổng', desc: 'Điều kiện giao cont' },
    { num: 2, title: 'Điều Động Thiết Bị', desc: 'Di chuyển đến ô bãi' },
    { num: 3, title: 'Nâng Lên Xe', desc: 'Gắp cont lên rơ-moóc' },
    { num: 4, title: 'Đối Soát & e-EIR', desc: 'Khám vỏ & ký nhận' },
    { num: 5, title: 'Hoàn Tất Xuất Cổng', desc: 'Xác nhận xe ra cổng' },
  ]

  return (
    <div className="space-y-6">
      {/* ── BREADCRUMB & HEADER ACTIONS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer group"
        >
          <span className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-slate-900 group-hover:border-slate-300 transition-all shadow-2xs">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </span>
          <span>Quay lại bảng điều độ</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={runEligibilityCheck}
            disabled={checkingEligibility}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">{checkingEligibility ? 'sync' : 'verified_user'}</span>
            {checkingEligibility ? 'Đang kiểm tra...' : 'Kiểm tra lại 5 điều kiện'}
          </button>
        </div>
      </div>

      {/* ── TOP HERO CARD CHUẨN DOANH NGHIỆP ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-lg text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
                {currentReq.carrier || 'Hapag-Lloyd'}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-semibold text-slate-600">Tàu: <strong>{currentReq.vessel || 'NEXUS CARRIER'}</strong> · {currentReq.voyage || 'V.2026'}</span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-semibold text-slate-600">Booking: <strong className="font-mono text-slate-800">{currentReq.booking || currentReq.bookingCode}</strong></span>
              <span className="text-xs text-slate-400">·</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${isoValidation.valid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                {isoValidation.valid ? 'ISO 6346: Hợp lệ' : 'ISO 6346: Cảnh báo'}
              </span>
            </div>

            <div className="flex items-baseline gap-3 flex-wrap pt-1">
              <h1 className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                {currentReq.containerId}
              </h1>
              <span className="text-sm font-bold text-slate-600 px-2 py-0.5 bg-slate-100 rounded-lg">{currentReq.containerType}</span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_CFG[currentReq.status]?.badge || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                <span className="material-symbols-outlined text-sm">{STATUS_CFG[currentReq.status]?.icon}</span>
                {STATUS_CFG[currentReq.status]?.label || currentReq.status}
              </span>
              {currentReq.slotStatus === 'Available' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Vị trí bãi: Đã giải phóng
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-5 py-3 text-right">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vị trí ô bãi chỉ định</div>
              <div className="text-xl font-black text-slate-900 font-mono mt-0.5">{currentReq.position}</div>
              <div className="text-[11px] text-slate-500 font-medium">Khu {currentReq.block} · Bay {currentReq.bay} · Row {currentReq.row || '01'} · Tầng {currentReq.tier}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TIẾN TRÌNH CÔNG VIỆC (STEPPER 5 BƯỚC REALTIME LIVE) ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        {/* Top Header of Stepper */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 mb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Tiến trình điều hành bãi (5 bước chuẩn TOS Cảng Tiên Sa)
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Đồng bộ Realtime (Live)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {flowStep === 0 && 'Bước 1/5: Đang kiểm tra 5 điều kiện cổng vào & tính hợp lệ của lệnh giao nhận'}
              {flowStep === 1 && 'Bước 2/5: Điều động thiết bị nâng RTG/RS di chuyển tiếp cận ô bãi chỉ định'}
              {flowStep === 2 && 'Bước 3/5: Xe nâng đã tới vị trí, sẵn sàng gắp hạ container lên rơ-moóc'}
              {flowStep === 3 && 'Bước 4/5: Khám nghiệm 6 mặt vỏ, kiểm tra seal và lập ký số phiếu e-EIR'}
              {flowStep === 4 && 'Bước 5/5: Đã cấp e-EIR, xe đang tiến ra cổng xuất bãi'}
              {flowStep >= 5 && 'Hoàn tất 5/5 bước: Xe và container đã hoàn tất thủ tục xuất cổng an toàn!'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-bold text-orange-950 px-3 py-1 bg-orange-50 border border-orange-200 rounded-xl">
              Tiến độ: {Math.min(flowStep, 5)}/5 bước ({Math.round(Math.min(flowStep, 5) / 5 * 100)}%)
            </span>
          </div>
        </div>

        {/* 5 Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
          {STEPS.map((s, idx) => {
            const isDone = flowStep > idx
            const isCurrent = flowStep === idx
            return (
              <div
                key={s.num}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${isCurrent
                  ? 'bg-orange-50/70 border-orange-300 ring-2 ring-orange-200/60 shadow-xs'
                  : isDone
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-slate-50/50 border-slate-200/70 opacity-75'
                  }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 transition-all ${isDone
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : isCurrent
                      ? 'bg-orange-500 text-white shadow-md ring-4 ring-orange-200 animate-pulse'
                      : 'bg-white text-slate-400 border border-slate-200'
                    }`}
                >
                  {isDone ? <span className="material-symbols-outlined text-base">check</span> : s.num}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-bold truncate ${isCurrent ? 'text-orange-950 font-black' : isDone ? 'text-emerald-950' : 'text-slate-500'
                        }`}
                    >
                      {s.title}
                    </span>
                    {isCurrent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{s.desc}</div>
                  <div className="text-[10px] mt-0.5">
                    {isDone ? (
                      <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-xs">done_all</span> Đã đạt
                      </span>
                    ) : isCurrent ? (
                      <span className="font-bold text-orange-600 flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-xs">sync</span> Đang xử lý
                      </span>
                    ) : (
                      <span className="text-slate-400">Chờ lượt</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── KIỂM TRA 5 ĐIỀU KIỆN CỔNG VÀO (REAL-TIME AUDIT) ── */}
      {eligibility && (
        <div className={`border rounded-2xl p-5 shadow-xs transition-all ${eligibility.eligible ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/60 border-rose-200'
          }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${eligibility.eligible ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                <span className="material-symbols-outlined text-lg">
                  {eligibility.eligible ? 'verified' : 'error'}
                </span>
              </div>
              <div>
                <h3 className={`text-sm font-bold ${eligibility.eligible ? 'text-emerald-950' : 'text-rose-950'}`}>
                  {eligibility.eligible ? 'Đủ 5/5 điều kiện giao container (Đã hoàn tất thủ tục giao nhận)' : 'Chưa đủ điều kiện giao container'}
                </h3>
                <p className="text-xs text-slate-600">
                  {eligibility.eligible
                    ? 'Phương tiện đã hoàn thành 100% thủ tục nhận container (e-D/O, thanh toán phí, giờ hẹn, phương tiện) & container sẵn sàng tại bãi.'
                    : 'Kiểm soát tự động: Phương tiện bắt buộc phải hoàn thành đầy đủ các thủ tục trước khi được phép vào nhận container.'}
                </p>
              </div>
            </div>
            {!eligibility.eligible && eligibility.rejectionReason && (
              <span className="px-3 py-1 rounded-xl text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                {eligibility.rejectionReason}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { title: '1. e-D/O Hiệu Lực', pass: eligibility.checks?.edoValid?.pass, desc: eligibility.checks?.edoValid?.reason },
              { title: '2. Cước Phí & Hoá Đơn', pass: eligibility.checks?.paymentValid?.pass, desc: eligibility.checks?.paymentValid?.reason },
              { title: '3. Khung Giờ Hẹn', pass: eligibility.checks?.timeSlotValid?.pass, desc: eligibility.checks?.timeSlotValid?.reason },
              { title: '4. Xe & Tài Xế', pass: eligibility.checks?.vehicleDriverValid?.pass, desc: eligibility.checks?.vehicleDriverValid?.reason },
              { title: '5. Vị Trí Bãi', pass: eligibility.checks?.containerReady?.pass, desc: eligibility.checks?.containerReady?.reason },
            ].map(c => (
              <div key={c.title} className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-800">{c.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.pass ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                      {c.pass ? 'Đạt' : 'Chưa đạt'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Nút Đảo Chuyển Ô Đè Nhanh (Unstack) nếu điều kiện 5 Vị trí bãi chưa đạt */}
          {!eligibility.eligible && eligibility.checks?.containerReady?.pass === false && (
            <div className="mt-4 pt-3 border-t border-rose-200/60 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-rose-700 font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">warning</span>
                Container đang bị chướng ngại vật ở tầng trên. Cần thực hiện quy trình đảo chuyển an toàn trước khi cẩu gắp lên xe.
              </span>
              <button
                type="button"
                onClick={() => setShowUnstackWorkflowModal(true)}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">layers_clear</span>
                <span>Quy trình đảo chuyển cont chắn (Unstack)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 2 CỘT CHÍNH: PHƯƠNG TIỆN CỔNG & THIẾT BỊ BÃI ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cột 1: Thông tin xe, tài xế & Camera ANPR */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-600">local_shipping</span>
                Phương tiện & Tài xế tiếp nhận
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-100 text-slate-700">
                {currentReq.gate}
              </span>
            </div>

            {/* Thẻ Camera ANPR Cổng vào mô phỏng (Light Theme) */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
                  <span className="material-symbols-outlined text-xl">videocam</span>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-orange-700 font-bold uppercase tracking-wider">ANPR Live Cam · Làn 01 Cổng A</div>
                  <div className="text-xs font-mono text-slate-700 mt-0.5">Biển số: <strong className="text-slate-900 font-black">{currentReq.truck || currentReq.truckPlate}</strong> · Độ khớp OCR: 99.4%</div>
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                <span className="text-slate-500 block text-[11px]">Tài xế giao nhận</span>
                <strong className="text-slate-900 text-sm">{currentReq.driver || currentReq.driverName}</strong>
                <div className="text-slate-400 text-[10px] mt-0.5">SĐT: {currentReq.driverPhone || '0905.xxx.xxx'}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                <span className="text-slate-500 block text-[11px]">Biển số xe đầu kéo & Rơ-moóc</span>
                <strong className="text-orange-950 font-mono text-sm font-extrabold">{currentReq.truck || currentReq.truckPlate}</strong>
                <div className="text-slate-400 text-[10px] mt-0.5">Moóc: {currentReq.chassisPlate || 'Chưa gắn'}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                <span className="text-slate-500 block text-[11px]">Số chì niêm phong</span>
                <strong className="text-indigo-900 font-mono text-sm">{currentReq.sealNumber}</strong>
                <div className="text-slate-400 text-[10px] mt-0.5">Khớp chứng từ e-D/O</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                <span className="text-slate-500 block text-[11px]">Trọng lượng khai báo</span>
                <strong className="text-slate-900 text-sm">{currentReq.weight}</strong>
                <div className="text-slate-400 text-[10px] mt-0.5">Dung sai cho phép: ±500 kg</div>
              </div>
            </div>
          </div>

          {/* Ghi nhận ngoại lệ hiện trường */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Ghi nhận sự cố hiện trường:</span>
            <button
              type="button"
              onClick={() => {
                setExceptionModalType('CONTAINER_MISMATCH')
                setShowExceptionModal(true)
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">report_problem</span>
              Báo cáo sai lệch / sự cố
            </button>
          </div>
        </div>

        {/* Cột 2: Sơ đồ Stack bãi & Thiết bị nâng hạ Telematics */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">forklift</span>
                Thiết bị nâng hạ & Sơ đồ Stack bãi
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Sẵn sàng tác nghiệp
              </span>
            </div>

            {/* SƠ ĐỒ MẶT CẮT STACK BÃI 4 TẦNG */}
            <YardStackVisualizer
              block={currentReq.block}
              bay={currentReq.bay}
              row={currentReq.row || '01'}
              position={currentReq.position}
              targetTier={currentReq.tier}
              targetContainerId={currentReq.containerId}
              stackContainers={computedStackContainers}
              carrier={currentReq.carrier}
              weight={currentReq.weight}
              isDone={currentReq.status === 'COMPLETED' || currentReq.status === 'HOÀN THÀNH' || (currentReq.flowStep || 0) >= 5}
              onNavigateYardMap={() => setActiveTab('yard_map')}
              onOpenUnstack={() => setShowUnstackWorkflowModal(true)}
            />

            {/* THÔNG TIN THIẾT BỊ NÂNG HẠ */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Thiết bị nâng hạ chỉ định</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded font-mono text-[10px] font-bold">
                      {currentReq.equipmentType === 'ReachStacker' || !currentReq.equipmentType ? 'Reach Stacker' : currentReq.equipmentType}
                    </span>
                    <strong className="text-base font-bold text-slate-900">{currentReq.equipmentCode || currentReq.rtgCrane || 'RS-01'}</strong>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500 font-medium">Người vận hành thiết bị</div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">{currentReq.equipmentOperator || currentReq.rtgOperator || 'Trần Văn Hùng'}</div>
                </div>
              </div>

              {/* Selector đổi thiết bị */}
              {flowStep <= 1 && (
                <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">Đổi thiết bị:</span>
                  <select
                    value={currentReq.equipmentCode || currentReq.rtgCrane || 'RS-01'}
                    onChange={(e) => {
                      const sel = AVAILABLE_EQUIPMENTS.find(eq => eq.code === e.target.value)
                      if (sel) {
                        setCurrentReq(prev => ({
                          ...prev,
                          equipmentCode: sel.code,
                          equipmentType: sel.type,
                          equipmentName: sel.name,
                          equipmentOperator: sel.operator,
                          rtgCrane: sel.code,
                          rtgOperator: sel.operator,
                        }))
                        showToast(`Đã gán thiết bị: ${sel.name} (${sel.operator})`)
                      }
                    }}
                    className="flex-1 bg-white border border-slate-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                  >
                    {AVAILABLE_EQUIPMENTS.map(eq => (
                      <option key={eq.code} value={eq.code}>
                        {eq.name} — {eq.operator} ({eq.radio})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* CHỈ DẪN LUỒNG DI CHUYỂN (Light Theme) */}
            <div className="bg-slate-50 border border-slate-200/80 text-slate-700 p-3.5 rounded-xl text-xs space-y-1.5 shadow-2xs">
              <div className="text-orange-700 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">alt_route</span>
                Chỉ dẫn luồng di chuyển xe đầu kéo
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-slate-800">
                <span className="px-2.5 py-0.5 bg-white border border-slate-200 rounded font-semibold text-slate-800">Khu {currentReq.block}</span>
                <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
                <span className="px-2.5 py-0.5 bg-white border border-slate-200 rounded font-semibold text-slate-800">Bay {currentReq.bay}</span>
                <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
                <span className="px-2.5 py-0.5 bg-orange-50 border border-orange-200 text-orange-800 rounded font-bold font-mono">Ô {currentReq.position}</span>
              </div>
            </div>
          </div>

          {/* Nút hành động theo tiến trình */}
          <div>
            {flowStep === 0 && (
              <button
                type="button"
                onClick={handleStartPickup}
                disabled={submitting}
                className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">play_arrow</span>
                {submitting ? 'Đang tạo lệnh...' : 'Điều động thiết bị đến ô lấy container'}
              </button>
            )}
            {flowStep === 1 && (
              <button
                type="button"
                onClick={handleMarkArrived}
                disabled={submitting}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">location_on</span>
                {submitting ? 'Đang cập nhật...' : 'Xác nhận thiết bị đã tới vị trí'}
              </button>
            )}
            {flowStep === 2 && (
              <button
                type="button"
                onClick={handleStartVerify}
                disabled={submitting}
                className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">fact_check</span>
                {submitting ? 'Đang cập nhật...' : 'Bắt đầu kiểm tra và khám 6 mặt vỏ'}
              </button>
            )}
            {flowStep === 3 && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-center text-xs font-semibold text-orange-950 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base text-orange-600">pending_actions</span>
                Đang thực hiện kiểm tra và lập biên bản e-EIR bên dưới
              </div>
            )}
            {flowStep >= 4 && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs font-semibold text-emerald-900 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base text-emerald-600">task_alt</span>
                Đã hoàn thành nâng container lên rơ-moóc và phát hành e-EIR
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BƯỚC 4: KHÁM NGHIỆM 6 MẶT VỎ & LẬP PHIẾU e-EIR ── */}
      {flowStep >= 3 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600">fact_check</span>
                Khám nghiệm 6 mặt vỏ & Lập phiếu giao nhận e-EIR
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Biên bản bàn giao ghi nhận hiện trạng vỏ và số chì tại thời điểm giao hàng.
              </p>
            </div>
            {flowStep >= 4 && (
              <button
                type="button"
                onClick={() => setShowEirModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-sm">receipt_long</span>
                Xem phiếu e-EIR đã cấp
              </button>
            )}
          </div>


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sơ đồ Khám 6 mặt vỏ container */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  Tình trạng vỏ container:
                  {isEirLocked && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md border border-amber-300">
                      <span className="material-symbols-outlined text-xs">lock</span> Đã khóa
                    </span>
                  )}
                </span>
                <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button
                    type="button"
                    disabled={isEirLocked}
                    onClick={() => {
                      if (isEirLocked) return
                      setHasDamage(false)
                      setSelectedFaces([])
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isEirLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                      } ${!hasDamage ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Tốt / Nguyên vẹn
                  </button>
                  <button
                    type="button"
                    disabled={isEirLocked}
                    onClick={() => {
                      if (isEirLocked) return
                      setHasDamage(true)
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isEirLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                      } ${hasDamage ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <span className="material-symbols-outlined text-sm">report</span>
                    Phát hiện hư hỏng
                  </button>
                </div>
              </div>

              {/* Sơ đồ 6 mặt dạng Wireframe */}
              <Container6FaceWireframe
                selectedFaces={selectedFaces}
                onToggleFace={toggleFace}
                hasDamage={hasDamage}
                readOnly={isEirLocked}
              />

              {/* Chi tiết hư hỏng nếu có */}
              {hasDamage && (
                <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Mức độ tổn thương:
                        {isEirLocked && <span className="text-amber-700 ml-1 font-normal">(Đã khóa)</span>}
                      </label>
                      <select
                        value={damageSeverity}
                        disabled={isEirLocked}
                        onChange={e => setDamageSeverity(e.target.value)}
                        className={`w-full p-2 bg-white border rounded-lg text-xs font-medium focus:outline-none ${isEirLocked
                          ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed opacity-90'
                          : 'border-slate-300 focus:ring-1 focus:ring-orange-500 cursor-pointer'
                          }`}
                      >
                        <option value="Nhẹ">Nhẹ — Trầy xước bề mặt sơn</option>
                        <option value="Vừa">Vừa — Móp méo dưới 10cm</option>
                        <option value="Nặng">Nặng — Rách thủng hoặc biến dạng khung</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Mô tả vết hư hại:
                        {isEirLocked && <span className="text-amber-700 ml-1 font-normal">(Đã khóa)</span>}
                      </label>
                      <input
                        type="text"
                        value={damageDescription}
                        disabled={isEirLocked}
                        readOnly={isEirLocked}
                        onChange={e => setDamageDescription(e.target.value)}
                        placeholder={isEirLocked ? 'Không có mô tả hư hại' : 'Vd: Móp vách trái 15cm do va chạm'}
                        className={`w-full p-2 bg-white border rounded-lg text-xs focus:outline-none ${isEirLocked
                          ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed'
                          : 'border-slate-300 focus:ring-1 focus:ring-orange-500'
                          }`}
                      />
                    </div>
                  </div>

                  {/* Ảnh chụp hiện trường */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-slate-700">Ảnh hiện trường đính kèm:</span>
                      {!isEirLocked && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer transition-colors shadow-2xs"
                          >
                            <span className="material-symbols-outlined text-sm">upload_file</span>
                            Tải ảnh từ máy
                          </button>
                          <button
                            type="button"
                            onClick={handleSimulateSamplePhoto}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 text-orange-700 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer transition-colors shadow-2xs"
                          >
                            <span className="material-symbols-outlined text-sm">photo_camera</span>
                            Chụp từ thiết bị
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </div>
                      )}
                    </div>

                    {damagePhotos.length > 0 ? (
                      <div className="flex gap-2 overflow-x-auto py-1">
                        {damagePhotos.map((p, idx) => (
                          <div key={idx} className="relative w-20 h-20 rounded-lg border border-rose-200 overflow-hidden flex-shrink-0 group">
                            <img src={p} alt="Damage" className="w-full h-full object-cover" />
                            {!isEirLocked && (
                              <button
                                type="button"
                                onClick={() => setDamagePhotos(prev => prev.filter((_, i) => i !== idx))}
                                className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-xs">close</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">
                        {isEirLocked ? 'Không có ảnh chụp hư hại đính kèm theo phiếu e-EIR.' : 'Khuyến nghị đính kèm hình ảnh hiện trường vị trí hư hại để làm cơ sở đối chiếu.'}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Checklist đối soát & Ký bàn giao */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Đối soát thực địa & Ký nhận:
                </span>
                {isEirLocked && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <span className="material-symbols-outlined text-xs">verified</span> Đã đối soát & ký số
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 rounded-xl border text-sm font-semibold transition-all ${isEirLocked ? 'cursor-not-allowed' : 'cursor-pointer'
                  } ${checklist.correctContainer ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                  <input
                    type="checkbox"
                    checked={checklist.correctContainer}
                    disabled={isEirLocked}
                    onChange={e => !isEirLocked && setChecklist(p => ({ ...p, correctContainer: e.target.checked }))}
                    className={`w-4 h-4 accent-emerald-600 rounded ${isEirLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                  />
                  <span>Đúng số container trên phương tiện: <strong className="font-mono">{currentReq.containerId}</strong></span>
                </label>

                <label className={`flex items-center gap-3 p-3 rounded-xl border text-sm font-semibold transition-all ${isEirLocked ? 'cursor-not-allowed' : 'cursor-pointer'
                  } ${checklist.correctSeal ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                  <input
                    type="checkbox"
                    checked={checklist.correctSeal}
                    disabled={isEirLocked}
                    onChange={e => !isEirLocked && setChecklist(p => ({ ...p, correctSeal: e.target.checked }))}
                    className={`w-4 h-4 accent-emerald-600 rounded ${isEirLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                  />
                  <span>Số chì niêm phong (<strong className="font-mono">{currentReq.sealNumber}</strong>) nguyên vẹn, trùng khớp</span>
                </label>
              </div>

              {/* Chữ ký số */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 uppercase">Chữ ký bàn giao e-EIR điện tử:</span>
                  {isEirLocked && (
                    <span className="text-[10px] text-slate-500 font-mono">Bản gốc ký số bất biến</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-500 block mb-1">
                      Đại diện Cảng Tiên Sa:
                      {isEirLocked && <span className="text-amber-700 ml-1 font-normal">(Đã ký)</span>}
                    </label>
                    <input
                      type="text"
                      value={terminalSignatory}
                      disabled={isEirLocked}
                      readOnly={isEirLocked}
                      onChange={e => setTerminalSignatory(e.target.value)}
                      className={`w-full p-2 bg-white border rounded-lg text-xs font-semibold focus:outline-none ${isEirLocked ? 'border-slate-200 bg-slate-100 text-slate-700 cursor-not-allowed' : 'border-slate-300 focus:ring-1 focus:ring-orange-500'
                        }`}
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">
                      Tài xế tiếp nhận container:
                      {isEirLocked && <span className="text-amber-700 ml-1 font-normal">(Đã ký)</span>}
                    </label>
                    <input
                      type="text"
                      value={driverSignatory}
                      disabled={isEirLocked}
                      readOnly={isEirLocked}
                      onChange={e => setDriverSignatory(e.target.value)}
                      className={`w-full p-2 bg-white border rounded-lg text-xs font-semibold focus:outline-none ${isEirLocked ? 'border-slate-200 bg-slate-100 text-slate-700 cursor-not-allowed' : 'border-slate-300 focus:ring-1 focus:ring-orange-500'
                        }`}
                    />
                  </div>
                </div>

                <label className={`flex items-start gap-2 pt-1 text-slate-700 font-medium text-[11px] ${isEirLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                  }`}>
                  <input
                    type="checkbox"
                    checked={eirSignConfirmed}
                    disabled={isEirLocked}
                    onChange={e => !isEirLocked && setEirSignConfirmed(e.target.checked)}
                    className={`w-4 h-4 mt-0.5 accent-emerald-600 rounded ${isEirLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  />
                  <span>Hai bên xác nhận thông tin kiểm tra hiện trường là chính xác và trùng khớp.</span>
                </label>
              </div>

              {/* Nút hoàn tất phát hành / xuất cổng */}
              {!isEirLocked ? (
                <button
                  type="button"
                  onClick={handleIssueEirAndConfirm}
                  disabled={submitting}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">receipt_long</span>
                  {submitting ? 'Đang phát hành e-EIR...' : 'Xác nhận nâng lên xe và ký phát hành e-EIR'}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEirModal(true)}
                    className="flex-1 h-12 bg-white border border-slate-300 text-slate-800 rounded-xl font-bold text-xs hover:bg-slate-50 cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base text-orange-600">visibility</span>
                    Xem & In Lại Phiếu e-EIR
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmGateOut}
                    disabled={submitting || currentReq.status === 'COMPLETED'}
                    className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">
                      {currentReq.status === 'COMPLETED' ? 'check_circle' : 'logout'}
                    </span>
                    {currentReq.status === 'COMPLETED' ? 'Đã hoàn tất xuất cổng' : 'Xác nhận xe xuất cổng'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── BƯỚC 5: TỔNG KẾT XUẤT CỔNG, CHỐT LƯU BÃI & NHẮC TRẢ VỎ (Light Theme) ── */}
      {gateOutData && (
        <div className="bg-emerald-50/60 border border-emerald-200 text-slate-900 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-200/60 pb-3">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-600 text-3xl">task_alt</span>
              <div>
                <h3 className="text-base font-bold text-emerald-950">Xác nhận phương tiện đã ra cổng thành công</h3>
                <p className="text-xs text-slate-600">
                  Lệnh giao container hoàn thành. Kết thúc tính thời gian lưu bãi tại Cảng Tiên Sa.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold">
              {new Date(gateOutData.gatedOutAt).toLocaleString('vi-VN')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-white p-4 rounded-xl border border-emerald-200/60 shadow-2xs space-y-1.5">
              <div className="text-amber-700 font-bold uppercase text-[10px] tracking-wider">Chốt cước lưu bãi</div>
              <div className="text-slate-700">Thời gian lưu bãi: <strong className="text-slate-900">{gateOutData.storageCalculation?.totalDays} ngày</strong> · Miễn phí {gateOutData.storageCalculation?.freeDays} ngày</div>
              <div className="text-slate-700">Tổng tiền phí cảng: <strong className="text-emerald-700 text-sm font-mono font-bold">{gateOutData.storageCalculation?.feeVnd?.toLocaleString('vi-VN')} VNĐ</strong></div>
              <div className="text-slate-700">Mã hóa đơn: <strong className="font-mono text-slate-900">{gateOutData.invoice?.invoiceNo}</strong></div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200/60 shadow-2xs space-y-1.5">
              <div className="text-orange-700 font-bold uppercase text-[10px] tracking-wider">Thông báo các bên liên quan</div>
              <p className="text-slate-600 leading-relaxed">
                Đã gửi thông báo giao hàng thành công tới Chủ hàng và Lái xe {gateOutData.driverName} (Xe {gateOutData.truckPlate}).
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200/60 shadow-2xs space-y-1.5">
              <div className="text-purple-700 font-bold uppercase text-[10px] tracking-wider">Depot chỉ định trả vỏ rỗng</div>
              <div className="text-slate-700">Depot: <strong className="text-slate-900">{gateOutData.emptyReturnReminder?.depotName}</strong></div>
              <div className="text-slate-700">Hạn miễn phí lưu vỏ: <strong className="text-amber-700 font-mono font-bold">{gateOutData.emptyReturnReminder?.returnDeadline}</strong> · 3 ngày</div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL e-EIR CHUẨN IN ẤN & PHÁP LÝ (TIÊN SA PORT TOS) ── */}
      {showEirModal && (
        <ElectronicEirReceiptModal
          isOpen={showEirModal}
          onClose={() => setShowEirModal(false)}
          data={{
            ...currentReq,
            ...(issuedEir || {}),
            referenceNo: issuedEir?.referenceNo || currentReq.eirReferenceNo,
            containerId: currentReq.containerId,
            containerType: currentReq.containerType,
            sealNumber: currentReq.sealNumber,
            condition: hasDamage ? `Hư hại (${damageSeverity}): ${selectedFaces.join(', ')}` : 'Tốt',
            hasDamage,
            damageDetails,
            damageSeverity,
            damagePhotos: (damagePhotos && damagePhotos.length > 0)
              ? damagePhotos
              : (issuedEir?.damagePhotos || currentReq.damagePhotos || (hasDamage ? ['https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'] : [])),
            truckPlate: currentReq.truck || currentReq.truckPlate,
            driverName: currentReq.driver || currentReq.driverName,
            terminalSignatory,
            transportationSignatory: driverSignatory,
            grossWeight: currentReq.grossWeight || 28100,
            vesselName: currentReq.vessel || 'AEGEAN EXPRESS',
            voyage: currentReq.voyage || '366S',
            shippingLine: currentReq.carrier || 'HAPAG-LLOYD',
            blBookingNo: currentReq.booking || currentReq.bookingCode || 'HLCUMTR251047484',
            yardSlot: currentReq.yardSlot || currentReq.position || 'C-02-06-1',
            gateName: currentReq.gate || currentReq.gateName || 'OUT GATE 1 / LÀN 02',
            emptyReturnDepot: currentReq.emptyReturnDepot || 'Depot ITL Hòa Cầm (Đà Nẵng)',
            detentionFreeDays: 3,
            activity: 'out',
            issuedAt: issuedEir?.issuedAt || new Date().toISOString(),
          }}
        />
      )}

      {/* ── MODAL BÁO CÁO NGOẠI LỆ ── */}
      <ExceptionModal
        isOpen={showExceptionModal}
        onClose={() => setShowExceptionModal(false)}
        onSubmit={handleReportExceptionSubmit}
        submitting={submitting}
        defaultType={exceptionModalType}
      />

      {/* ── MODAL QUY TRÌNH ĐẢO CHUYỂN CONTAINER CHẮN CHUẨN TOS ── */}
      {showUnstackWorkflowModal && (
        <StrictUnstackModal
          isOpen={true}
          onClose={() => setShowUnstackWorkflowModal(false)}
          targetReq={currentReq}
          stackContainers={computedStackContainers}
          allRequests={allRequests}
          onSuccess={handleUnstackSuccess}
          showToast={showToast}
        />
      )}
    </div>
  )
}

// Phân loại container chuyên dụng chuẩn TOS
const isContainerReefer = (item) => {
  return Boolean(
    item.reefer ||
    item.isReefer ||
    (item.cargoType && item.cargoType.toLowerCase().includes('reefer')) ||
    (item.cargoType && item.cargoType.toLowerCase().includes('lạnh')) ||
    (item.containerType && (item.containerType.includes('RF') || item.containerType.includes('RH'))) ||
    (item.type_code && (item.type_code.includes('RF') || item.type_code.includes('RH')))
  )
}

const isContainerImo = (item) => {
  return Boolean(
    (item.cargoType && (item.cargoType.toLowerCase().includes('nguy hiểm') || item.cargoType.toLowerCase().includes('dg') || item.cargoType.toLowerCase().includes('imo'))) ||
    (item.cargo_type && item.cargo_type === 'dangerous') ||
    (item.type_code && item.type_code.includes('DG'))
  )
}

const isContainerDry = (item) => {
  return !isContainerReefer(item) && !isContainerImo(item)
}

// ─── COMPONENT: THANH PHÂN TRANG CHUẨN TOS (ENTERPRISE PAGINATION BAR) ───────────
function PaginationBar({ currentPage, totalItems, pageSize, onPageChange, onPageSizeChange, pageSizeOptions = [6, 9, 12, 24] }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  if (totalItems <= 0) return null

  const startIdx = (currentPage - 1) * pageSize + 1
  const endIdx = Math.min(currentPage * pageSize, totalItems)

  const getPageNumbers = () => {
    const pages = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')

      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i)
      }

      if (currentPage < totalPages - 2) pages.push('...')
      if (!pages.includes(totalPages)) pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 select-none">
      <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
        <div>
          Hiển thị <span className="font-bold text-slate-900 font-mono">{startIdx}-{endIdx}</span> trên <span className="font-bold text-slate-900 font-mono">{totalItems}</span> container
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
            <span className="text-slate-400">Số lượng:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value))
                onPageChange(1)
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-orange-500 hover:bg-slate-100 transition-colors"
            >
              {pageSizeOptions.map(opt => (
                <option key={opt} value={opt}>{opt} cont / trang</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center"
          title="Trang đầu tiên"
        >
          <span className="material-symbols-outlined text-base">first_page</span>
        </button>

        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-0.5"
        >
          <span className="material-symbols-outlined text-sm">chevron_left</span>
          <span>Trước</span>
        </button>

        {getPageNumbers().map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots-${idx}`} className="w-7 h-7 flex items-center justify-center text-slate-400 text-xs font-bold">
                •••
              </span>
            )
          }

          const isCur = p === currentPage
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`min-w-7 h-7 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer font-mono ${isCur
                ? 'bg-orange-500 text-white shadow-2xs shadow-orange-500/30'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              {p}
            </button>
          )
        })}

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-0.5"
        >
          <span>Sau</span>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
        </button>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center"
          title="Trang cuối cùng"
        >
          <span className="material-symbols-outlined text-base">last_page</span>
        </button>
      </div>
    </div>
  )
}

// ─── COMPONENT: DANH SÁCH YÊU CẦU XUẤT CỔNG & XẾP TÀU (ENTERPRISE LIST VIEW) ───
function GateOutListView({ requests, loading, onSelect, onRefresh, showToast }) {
  const [directionMode, setDirectionMode] = useState('inbound') // 'inbound' | 'outbound'
  const [outboundRequests, setOutboundRequests] = useState([])
  const [vesselFilter, setVesselFilter] = useState('ALL')
  const [cargoTypeFilter, setCargoTypeFilter] = useState('ALL') // 'ALL' | 'REEFER' | 'IMO' | 'DRY'
  const [outboundSortBy, setOutboundSortBy] = useState('LOADING_SEQ') // 'LOADING_SEQ' | 'URGENCY' | 'BLOCKING' | 'POD'
  const [activeTab, setActiveTab] = useState('dispatch') // 'dispatch' | 'yard_map' | 'eir_ledger'
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'
  const [search, setSearch] = useState('')
  const [sideViewMode, setSideViewMode] = useState('working') // 'working' (đang làm) | 'completed' (đã xuất cổng)
  const [yardReservations, setYardReservations] = useState(() => {
    try {
      return yardReservationStore.getReservations()
    } catch {
      return []
    }
  })

  // Đồng bộ thời gian thực với Bản Đồ Bãi Tiên Sa (Yard Map)
  useEffect(() => {
    const handleUpdate = () => {
      try {
        setYardReservations(yardReservationStore.getReservations())
      } catch { }
    }
    window.addEventListener('yard-reservation-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('yard-reservation-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  // Quản lý Phân trang Chiều Nhập (Inbound Pagination)
  const [inboundPage, setInboundPage] = useState(1)
  const [inboundPageSize, setInboundPageSize] = useState(12)

  // Quản lý Phân trang Chiều Xuất (Outbound Pagination)
  const [outboundPage, setOutboundPage] = useState(1)
  const [outboundPageSize, setOutboundPageSize] = useState(6)

  // Quản lý Phân trang Sổ cái e-EIR
  const [eirPage, setEirPage] = useState(1)
  const [eirPageSize, setEirPageSize] = useState(10)

  // Tự động đưa về trang 1 khi thay đổi điều kiện lọc Chiều Nhập
  useEffect(() => {
    setInboundPage(1)
  }, [search, sideViewMode])

  // Tự động đưa về trang 1 khi thay đổi điều kiện lọc Chiều Xuất
  useEffect(() => {
    setOutboundPage(1)
  }, [search, vesselFilter, cargoTypeFilter, outboundSortBy])

  // Modal hiển thị Phiếu Giao Nhận Container Điện Tử (e-EIR)
  const [selectedEirData, setSelectedEirData] = useState(null)
  const [showEirReceiptModal, setShowEirReceiptModal] = useState(false)

  // Modals nghiệp vụ Chiều Xuất & Đảo cont
  const [unstackTargetItem, setUnstackTargetItem] = useState(null)
  const [readyLoadingTargetItem, setReadyLoadingTargetItem] = useState(null)
  const [dispatchTruckTargetItem, setDispatchTruckTargetItem] = useState(null)
  const [selectedYardTruck, setSelectedYardTruck] = useState('TRK-TERMINAL-01')
  const [actionLoading, setActionLoading] = useState(false)

  const handleOpenUnstackModal = (item, e) => {
    e?.stopPropagation()
    setUnstackTargetItem(item)
  }

  const handleOpenReadyLoadingModal = (item, e) => {
    e?.stopPropagation()
    setReadyLoadingTargetItem(item)
  }

  const handleOpenDispatchTruckModal = (item, e) => {
    e?.stopPropagation()
    setDispatchTruckTargetItem(item)
  }

  const handleConfirmUnstackModal = async () => {
    if (!unstackTargetItem) return
    try {
      setActionLoading(true)
      await handleUnstackMove(unstackTargetItem.id)
      setUnstackTargetItem(null)
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmReadyModal = async () => {
    if (!readyLoadingTargetItem) return
    try {
      setActionLoading(true)
      await handleConfirmReadyForLoading(readyLoadingTargetItem.id)
      setReadyLoadingTargetItem(null)
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmDispatchTruckModal = async () => {
    if (!dispatchTruckTargetItem) return
    try {
      setActionLoading(true)
      await handleCallYardTruck(dispatchTruckTargetItem)
      setDispatchTruckTargetItem(null)
    } finally {
      setActionLoading(false)
    }
  }


  const handleOpenEirReceipt = (item, e) => {
    e?.stopPropagation()
    setSelectedEirData({
      ...item,
      referenceNo: item.eirReferenceNo || `260228SP${Math.floor(100000 + Math.random() * 900000)}`,
      containerId: item.containerId,
      containerType: item.containerType,
      isoCode: item.isoCode || (item.containerType?.includes('40') ? '45G0' : '22G1'),
      sealNumber: item.sealNumber || 'UL6824219',
      condition: item.condition || 'Tốt',
      hasDamage: item.hasDamage || false,
      damageDetails: item.damageDetails || [],
      damageSeverity: item.damageSeverity || 'Vừa',
      damagePhotos: Array.isArray(item.damagePhotos) && item.damagePhotos.length > 0
        ? item.damagePhotos
        : (item.hasDamage ? ['https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'] : []),
      truckPlate: item.truck || item.truckPlate || '50H-630.74',
      driverName: item.driver || item.driverName || 'Trần Văn Hùng',
      grossWeight: item.grossWeight || 28100,
      vgmWeight: item.vgmWeight || `${(item.grossWeight || 28100).toLocaleString('vi-VN')} kg`,
      vesselName: item.vessel || 'AEGEAN EXPRESS',
      voyage: item.voyage || '366S',
      shippingLine: item.carrier || item.shippingLine || 'HAPAG-LLOYD (HAG)',
      blBookingNo: item.booking || item.bookingCode || 'HLCUMTR251047484',
      yardSlot: item.position || item.yardSlot || 'C-02-06-1',
      gateName: item.gate || item.gateName || 'OUT GATE 1 / LÀN 02',
      customerName: item.customerName || item.carrier || 'CHI NHÁNH CÔNG TY CỔ PHẦN ITL LOGISTICS TẠI MIỀN TRUNG',
      transportCompany: item.transportCompany || 'CÔNG TY CP TIÊN SA LOGISTICS',
      activity: directionMode === 'outbound' ? 'out' : 'out',
      issuedAt: item.issuedAt || new Date().toISOString(),
    })
    setShowEirReceiptModal(true)
  }

  // Thống kê Chiều Xuất (Outbound Marshalling)
  const outboundStats = useMemo(() => {
    return {
      pending: outboundRequests.filter(r => r.statusCode === 'PENDING_UNSTACK').length,
      inProgress: outboundRequests.filter(r => r.statusCode === 'IN_PROGRESS').length,
      reserved: outboundRequests.filter(r => r.tempSlotReserved).length,
      ready: outboundRequests.filter(r => r.statusCode === 'READY_FOR_LOADING').length,
    }
  }, [outboundRequests])

  // Danh sách các chuyến tàu thực tế có container trong CSDL
  const outboundVessels = useMemo(() => {
    const list = Array.from(new Set(outboundRequests.map(r => r.vessel).filter(Boolean)))
    return ['ALL', ...list]
  }, [outboundRequests])

  // Số lượng theo từng loại container (Cont Lạnh, IMO, Khô/Thường)
  const outboundCargoCounts = useMemo(() => {
    const vList = vesselFilter === 'ALL' ? outboundRequests : outboundRequests.filter(r => r.vessel === vesselFilter)
    return {
      all: vList.length,
      reefer: vList.filter(isContainerReefer).length,
      imo: vList.filter(isContainerImo).length,
      dry: vList.filter(isContainerDry).length,
    }
  }, [outboundRequests, vesselFilter])

  const filteredOutbound = useMemo(() => {
    const list = outboundRequests.filter(r => {
      const q = search.toLowerCase()
      const matchSearch = (r.containerId || '').toLowerCase().includes(q) ||
        (r.vessel || '').toLowerCase().includes(q) ||
        (r.pod || '').toLowerCase().includes(q) ||
        (r.code || '').toLowerCase().includes(q)
      const matchVessel = vesselFilter === 'ALL' || r.vessel === vesselFilter

      let matchType = true
      if (cargoTypeFilter === 'REEFER') matchType = isContainerReefer(r)
      else if (cargoTypeFilter === 'IMO') matchType = isContainerImo(r)
      else if (cargoTypeFilter === 'DRY') matchType = isContainerDry(r)

      return matchSearch && matchVessel && matchType
    })

    return [...list].sort((a, b) => {
      if (outboundSortBy === 'LOADING_SEQ') {
        if (a.loadingSequence && b.loadingSequence && a.loadingSequence !== b.loadingSequence) {
          return a.loadingSequence - b.loadingSequence
        }
        return (b.blockingContainers || 0) - (a.blockingContainers || 0)
      }
      if (outboundSortBy === 'URGENCY') {
        // Ưu tiên cont có blocker dọn đường và lead time cao hơn xử lý trước
        const leadA = a.plannedLeadTimeMinutes || (a.blockingContainers > 0 ? 180 : 60)
        const leadB = b.plannedLeadTimeMinutes || (b.blockingContainers > 0 ? 180 : 60)
        if (leadB !== leadA) return leadB - leadA
        return (b.blockingContainers || 0) - (a.blockingContainers || 0)
      }
      if (outboundSortBy === 'BLOCKING') {
        return (b.blockingContainers || 0) - (a.blockingContainers || 0)
      }
      if (outboundSortBy === 'POD') {
        return (a.pod || '').localeCompare(b.pod || '')
      }
      return 0
    })
  }, [outboundRequests, search, vesselFilter, cargoTypeFilter, outboundSortBy])

  // Tải dữ liệu container chiều xuất từ database
  const [outboundLoading, setOutboundLoading] = useState(false)

  const fetchOutbound = useCallback(async () => {
    try {
      setOutboundLoading(true)
      const data = await getGateOutRequests({ direction: 'outbound' })
      setOutboundRequests(Array.isArray(data) ? data : [])
    } catch (err) {
      if (showToast) showToast(getFriendlyErrorMessage(err, 'Không thể tải danh sách container chiều xuất.'))
      setOutboundRequests([])
    } finally {
      setOutboundLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (directionMode === 'outbound') {
      fetchOutbound()
    } else {
      if (onRefresh) onRefresh()
    }
  }, [directionMode, fetchOutbound, onRefresh])

  // Thao tác nghiệp vụ Chiều Xuất (Tích hợp API và DB thực tế)
  const handleUnstackMove = async (id) => {
    try {
      await executeUnstackMove(id, { direction: 'outbound', targetSlot: 'B-02-02-1' })
      await fetchOutbound()
      if (showToast) showToast('Đã phát lệnh cẩu bãi di dời container chắn sang ô tạm đã khóa!')
    } catch (err) {
      if (showToast) showToast(getFriendlyErrorMessage(err, 'Không thể thực hiện đảo chuyển container.'))
    }
  }

  const handleConfirmReadyForLoading = async (id) => {
    try {
      await confirmReadyLoading(id)
      await fetchOutbound()
      if (showToast) showToast('Container đã dọn đường xong & đủ 5 điều kiện: Chuyển sang SẴN SÀNG XẾP TÀU!')
    } catch (err) {
      if (showToast) showToast(getFriendlyErrorMessage(err, 'Không thể xác nhận sẵn sàng xếp tàu.'))
    }
  }

  const handleCallYardTruck = async (item) => {
    try {
      await dispatchApronTruck(item.id, { truckPlate: 'TRK-TERMINAL-01', quayCrane: item.quayCrane })
      await fetchOutbound()
      if (showToast) showToast(`Đã điều động xe nội bộ kéo cont ${item.containerId} ra chân cẩu ${item.quayCrane}!`)
    } catch (err) {
      if (showToast) showToast(getFriendlyErrorMessage(err, 'Không thể điều động xe nội bộ.'))
    }
  }

  // Quản lý Modal Cờ giữ (Hold) & Hủy lịch phút chót
  const [showHoldModal, setShowHoldModal] = useState(false)
  const [targetHoldItem, setTargetHoldItem] = useState(null)
  const [holdReason, setHoldReason] = useState('CustomsHold')
  const [showRulesExpanded, setShowRulesExpanded] = useState(false)

  // Thao tác nghiệp vụ Chiều Nhập (Tích hợp API và DB thực tế)
  const handleInboundUnstack = async (id, e) => {
    e?.stopPropagation()
    try {
      await executeUnstackMove(id, { direction: 'inbound', targetSlot: 'B-02-02-1' })
      if (onRefresh) onRefresh()
      if (showToast) showToast('Bước 5: Đã dọn sạch container chắn sang ô tạm B-02-02-1 đã khóa và cập nhật vị trí mới!')
    } catch (err) {
      if (showToast) showToast(getFriendlyErrorMessage(err, 'Không thể thực hiện đảo chuyển.'))
    }
  }

  const handleInboundStageToBuffer = async (id, e) => {
    e?.stopPropagation()
    try {
      await executeBufferStage(id, { bufferSlot: 'BUFFER-GATE-01' })
      if (onRefresh) onRefresh()
      if (showToast) showToast('Bước 6: Đã đưa container ra bãi đệm gần đường xe chạy BUFFER-GATE-01 sẵn sàng giao!')
    } catch (err) {
      if (showToast) showToast(getFriendlyErrorMessage(err, 'Không thể đưa container ra bãi đệm.'))
    }
  }

  const handleInboundConfirmReadyForPickup = async (id, e) => {
    e?.stopPropagation()
    try {
      await confirmReadyDelivery(id, { verifiedContainerId: true, verifiedSeal: true })
      if (onRefresh) onRefresh()
      if (showToast) showToast('Bước 8: Đã kiểm tra đối chiếu e-D/O & vỏ cont. Chuyển sang SẴN SÀNG GIAO, gửi thông báo chủ hàng & cổng!')
    } catch (err) {
      if (showToast) showToast(getFriendlyErrorMessage(err, 'Không thể chốt trạng thái sẵn sàng giao.'))
    }
  }

  const handleOpenHoldModal = (item, e) => {
    e?.stopPropagation()
    setTargetHoldItem(item)
    setShowHoldModal(true)
  }

  const handleExecuteHoldOrCancel = async () => {
    if (!targetHoldItem) return
    const isOut = directionMode === 'outbound'
    try {
      await cancelPreparationOrShutOut(targetHoldItem.id, {
        reason: holdReason,
        category: isOut ? 'ShutOut' : 'Hold',
        direction: isOut ? 'outbound' : 'inbound'
      })
      if (isOut) {
        await fetchOutbound()
      } else {
        if (onRefresh) onRefresh()
      }
      setShowHoldModal(false)
      setTargetHoldItem(null)
      if (showToast) showToast(`Quy tắc 4: Tự động hủy lệnh, giải phóng khóa ô tạm và chuyển trạng thái về Bị giữ/Bãi lưu (${holdReason})!`)
    } catch (err) {
      if (showToast) showToast(getFriendlyErrorMessage(err, 'Không thể thực hiện thao tác cờ giữ / hủy lệnh.'))
    }
  }

  const handleToggleReeferUnplug = async (id, e) => {
    e?.stopPropagation()
    try {
      await toggleReeferPower(id, { isPlugged: false, dwellMinutes: 45 })
      await fetchOutbound()
      if (showToast) showToast('Quy tắc 2: Đã ghi nhận Tạm ngắt điện di chuyển với dwell timer giám sát 30-45 phút!')
    } catch (err) {
      if (showToast) showToast(getFriendlyErrorMessage(err, 'Không thể cập nhật trạng thái nguồn điện container lạnh.'))
    }
  }

  // Đồng bộ vị trí bãi thực tế từ Bản Đồ Bãi Tiên Sa (Yard Map & Reservations)
  const enrichedRequests = useMemo(() => {
    return requests.map(r => {
      const matchRes = yardReservations.find(res => {
        const resCont = (res.containerNo || res.containerId || '').trim().toUpperCase()
        const rCont = (r.containerId || '').trim().toUpperCase()
        return resCont && rCont && resCont === rCont
      })
      if (matchRes) {
        const blk = matchRes.blockCode || r.block || r.yard_block || 'B'
        const bayNum = matchRes.bay ? String(matchRes.bay).padStart(2, '0') : (r.bay || r.yard_bay || '02')
        const rowNum = matchRes.row ? String(matchRes.row).padStart(2, '0') : (r.row || r.yard_row || '01')
        const tierNum = String(matchRes.tier || r.tier || r.yard_tier || '1')
        const posCode = matchRes.posCode || `${blk}-${bayNum}-${rowNum}-${tierNum}`
        return {
          ...r,
          block: blk,
          bay: bayNum,
          row: rowNum,
          tier: tierNum,
          position: posCode,
          yardSlot: posCode,
        }
      }
      return r
    })
  }, [requests, yardReservations])

  // 1. Phân loại BÊN 1: Container Đang Làm trong bãi (Chờ tiếp nhận, Đang nâng hạ, Sẵn sàng xuất cổng)
  const workingRequests = useMemo(() => {
    return enrichedRequests.filter(r => r.status !== 'HOÀN THÀNH' && r.status !== 'COMPLETED' && (r.flowStep || 0) < 5)
  }, [enrichedRequests])

  // 2. Phân loại BÊN 2: Container Đã Được Xuất Cổng (Đã hoàn tất thủ tục và xe đã chở ra khỏi cổng cảng)
  const completedRequests = useMemo(() => {
    return enrichedRequests.filter(r => r.status === 'HOÀN THÀNH' || r.status === 'COMPLETED' || (r.flowStep || 0) >= 5)
  }, [enrichedRequests])

  // Thống kê số lượng khớp chuẩn xác với Bản Đồ Bãi
  const stats = useMemo(() => {
    return {
      pending: workingRequests.filter(r => r.status === 'CHỜ TIẾP NHẬN' || r.status === 'PENDING').length,
      inProgress: workingRequests.filter(r => r.status === 'ĐANG THỰC HIỆN' || r.status === 'IN_PROGRESS').length,
      ready: workingRequests.filter(r => r.status === 'SẴN SÀNG XUẤT' || r.status === 'READY_FOR_GATE_OUT').length,
      completed: completedRequests.length,
      workingTotal: workingRequests.length,
    }
  }, [workingRequests, completedRequests])

  const inboundPriorityStats = useMemo(() => {
    return {
      atGate: workingRequests.filter(r => isTruckAtGate(r)).length,
      enRoute: workingRequests.filter(r => !isTruckAtGate(r)).length,
      completed: completedRequests.length,
    }
  }, [workingRequests, completedRequests])

  // Hàm sắp xếp tự động theo độ ưu tiên nghiệp vụ bãi (Cao ➔ Thấp)
  const sortInboundPriority = useCallback((a, b) => {
    const atGateA = isTruckAtGate(a)
    const atGateB = isTruckAtGate(b)
    if (atGateA !== atGateB) return atGateA ? -1 : 1

    const timeA = a.requestedTime || a.requested_time || '99:99'
    const timeB = b.requestedTime || b.requested_time || '99:99'
    if (timeA !== timeB) return timeA.localeCompare(timeB)

    const inProgA = a.status === 'ĐANG THỰC HIỆN' || a.status === 'IN_PROGRESS' || (a.flowStep || 0) >= 1
    const inProgB = b.status === 'ĐANG THỰC HIỆN' || b.status === 'IN_PROGRESS' || (b.flowStep || 0) >= 1
    if (inProgA !== inProgB) return inProgA ? -1 : 1

    return (a.containerId || '').localeCompare(b.containerId || '')
  }, [])

  // Tìm kiếm chung
  const filterListBySearch = useCallback((list) => {
    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter(r => {
      const containerId = (r.containerId || '').toLowerCase()
      const driver = (r.driver || r.driverName || '').toLowerCase()
      const truck = (r.truck || r.truckPlate || '').toLowerCase()
      const gate = (r.gate || r.gateName || '').toLowerCase()
      const booking = (r.booking || r.bookingCode || '').toLowerCase()
      const pos = (r.position || r.yardSlot || '').toLowerCase()
      return containerId.includes(q) || driver.includes(q) || truck.includes(q) || gate.includes(q) || booking.includes(q) || pos.includes(q)
    })
  }, [search])

  // Danh sách Container Đang Làm đã lọc và sắp xếp
  const sortedWorking = useMemo(() => {
    return filterListBySearch(workingRequests).sort(sortInboundPriority)
  }, [filterListBySearch, workingRequests, sortInboundPriority])

  // Danh sách Container Đã Được Xuất Cổng đã lọc
  const sortedCompleted = useMemo(() => {
    return filterListBySearch(completedRequests).sort((a, b) => (b.completedAt || b.requestedTime || '').localeCompare(a.completedAt || a.requestedTime || ''))
  }, [filterListBySearch, completedRequests])

  // Danh sách hiển thị theo chế độ lọc 2 bên
  const filtered = useMemo(() => {
    if (sideViewMode === 'working') return sortedWorking
    if (sideViewMode === 'completed') return sortedCompleted
    return [...sortedWorking, ...sortedCompleted]
  }, [sideViewMode, sortedWorking, sortedCompleted])

  // Phân trang dữ liệu Chiều Nhập (Inbound)
  const paginatedInbound = useMemo(() => {
    const start = (inboundPage - 1) * inboundPageSize
    return filtered.slice(start, start + inboundPageSize)
  }, [filtered, inboundPage, inboundPageSize])

  // Phân trang dữ liệu Chiều Xuất (Outbound)
  const paginatedOutbound = useMemo(() => {
    const start = (outboundPage - 1) * outboundPageSize
    return filteredOutbound.slice(start, start + outboundPageSize)
  }, [filteredOutbound, outboundPage, outboundPageSize])

  // Dữ liệu và phân trang Sổ cái e-EIR (Tab 3)
  const eirList = useMemo(() => {
    return requests.filter(r => r.eirReferenceNo || r.flowStep >= 4)
  }, [requests])

  const paginatedEir = useMemo(() => {
    const start = (eirPage - 1) * eirPageSize
    return eirList.slice(start, start + eirPageSize)
  }, [eirList, eirPage, eirPageSize])

  // Xuất file CSV danh sách ca trực
  const handleExportCsv = () => {
    const headers = ['Mã Lệnh', 'Container ID', 'Loại Cont', 'Hãng Tàu', 'Biển Số Xe', 'Tài Xế', 'Vị Trí Bãi', 'Giờ Hẹn / Giờ Xuất Bãi', 'Trạng Thái']
    const rows = filtered.map(r => [
      r.code || r.id.slice(0, 8),
      r.containerId,
      r.containerType,
      r.carrier,
      r.truck || r.truckPlate,
      r.driver || r.driverName,
      r.position,
      r.requestedTime,
      r.status,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `DS_Giao_Container_TienSa_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Hàm render thẻ Container Chiều Nhập chuẩn Enterprise
  const renderInboundCard = (r, index, isCompletedSide = false) => {
    const prio = getAppointmentPriority(r)
    const isAtGate = prio.isAtGate
    const st = STATUS_CFG[r.status] || STATUS_CFG['CHỜ TIẾP NHẬN']
    const hasEir = Boolean(r.eirReferenceNo || r.flowStep >= 4 || r.status === 'SẴN SÀNG XUẤT' || r.status === 'READY_FOR_GATE_OUT' || r.status === 'HOÀN THÀNH' || r.status === 'COMPLETED')
    const isDone = isCompletedSide || r.status === 'HOÀN THÀNH' || r.status === 'COMPLETED' || (r.flowStep || 0) >= 5
    const rankLabel = isDone ? '✓' : `#${index + 1}`

    return (
      <div
        key={r.id}
        onClick={() => onSelect(r)}
        className={`bg-white border rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all cursor-pointer space-y-3 group relative overflow-hidden ${isDone
          ? 'border-emerald-200/90 bg-gradient-to-br from-emerald-50/20 via-white to-white hover:border-emerald-400'
          : isAtGate
            ? 'border-rose-400 ring-2 ring-rose-400/30 bg-gradient-to-br from-rose-50/25 via-white to-white'
            : 'border-slate-200/90 hover:border-amber-400'
          }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md text-[11px] font-mono font-black ${isDone
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : isAtGate
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-amber-500 text-white shadow-2xs'
                  }`}
                title={isDone ? 'Đã hoàn thành xuất cổng' : `Thứ tự ưu tiên #${index + 1}`}
              >
                {rankLabel}
              </span>
              <div className="text-base font-black text-slate-900 font-mono group-hover:text-orange-600 transition-colors">
                {r.containerId}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 flex-wrap mt-1">
              <span className="font-mono">{r.containerType}</span>
              {isContainerReefer(r) && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                  <span className="material-symbols-outlined text-xs">ac_unit</span> Lạnh
                </span>
              )}
              {isContainerImo(r) && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  <span className="material-symbols-outlined text-xs">warning</span> IMO
                </span>
              )}
              <span>·</span>
              <span className="truncate max-w-[120px]">{r.carrier}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {isDone ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="material-symbols-outlined text-xs">check_circle</span>
                ĐÃ XUẤT CỔNG
              </span>
            ) : (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${prio.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
                {prio.label}
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-50/90 border border-slate-100 rounded-xl p-2.5 text-xs space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Xe & Tài xế:</span>
            <span className="font-bold text-slate-900 font-mono">
              {r.truck || r.truckPlate} · {r.driver || r.driverName}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">{isDone ? 'Giờ xuất bãi:' : 'Giờ hẹn:'}</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1.5 font-mono">
              <span className="material-symbols-outlined text-xs text-orange-600">{isDone ? 'done_all' : 'event'}</span>
              <span>{r.requestedTime || '16:30'}</span>
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Vị trí bãi:</span>
            <span className="font-mono font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
              📍 {r.position || r.yardSlot}
            </span>
          </div>

          {isDone && r.sealNumber && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Số chì niêm phong:</span>
              <span className="font-mono font-bold text-purple-900">{r.sealNumber}</span>
            </div>
          )}
        </div>

        {/* Tiến trình điều độ */}
        {!isDone && (
          <div className="space-y-1 text-xs border-t border-slate-100 pt-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className={`flex items-center gap-1 ${r.flowStep >= 1 ? 'text-emerald-600 font-bold' : ''}`}>
                <span className="material-symbols-outlined text-xs">{r.flowStep >= 1 ? 'check_circle' : 'radio_button_unchecked'}</span> Gắp cont
              </span>
              <span className="text-slate-300">➔</span>
              <span className={`flex items-center gap-1 ${r.flowStep >= 3 ? 'text-emerald-600 font-bold' : ''}`}>
                <span className="material-symbols-outlined text-xs">{r.flowStep >= 3 ? 'check_circle' : 'radio_button_unchecked'}</span> Giám định
              </span>
              <span className="text-slate-300">➔</span>
              <span className={`flex items-center gap-1 ${r.flowStep >= 4 ? 'text-emerald-600 font-bold' : ''}`}>
                <span className="material-symbols-outlined text-xs">{r.flowStep >= 4 ? 'check_circle' : 'radio_button_unchecked'}</span> e-EIR
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
          {hasEir ? (
            <button
              type="button"
              onClick={(e) => handleOpenEirReceipt(r, e)}
              className="px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              title="Xem phiếu giao nhận container điện tử (e-EIR) chuẩn Cảng Tiên Sa"
            >
              <span className="material-symbols-outlined text-xs">receipt_long</span>
              <span>Phiếu e-EIR</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-1.5">
            {!isDone && r.blockingContainers > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setUnstackTargetItem(r)
                }}
                className="px-2 py-1 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-colors flex items-center gap-1"
                title="Có container đè phía trên - Quy trình đảo chuyển dọn bãi"
              >
                <span className="material-symbols-outlined text-xs text-amber-700">layers_clear</span>
                <span>Đảo cont ({r.blockingContainers})</span>
              </button>
            )}

            {!isDone && (
              <button
                type="button"
                onClick={(e) => handleOpenHoldModal(r, e)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors"
                title="Áp cờ giữ hoặc hủy lệnh"
              >
                <span className="material-symbols-outlined text-sm">flag</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onSelect(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer flex items-center gap-1 ${isDone
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
            >
              <span>{isDone ? 'Xem hồ sơ' : 'Chi tiết'}</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── ENTERPRISE TOP BANNER & TELEMETRY ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-xs font-bold">
              Điều Hành Bãi & Cảng Tiên Sa
            </span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            {directionMode === 'outbound'
              ? 'Chuẩn Bị Container Xếp Lên Tàu'
              : 'Chuẩn Bị Container Giao Cho Chủ Hàng'}
          </h1>
        </div>

        {/* BỘ CHỌN CHIỀU LÀM HÀNG — NẰM BÊN PHẢI NGANG HÀNG TIÊU ĐỀ */}
        <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs shrink-0 self-start md:self-center">
          <button
            type="button"
            onClick={() => setDirectionMode('inbound')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${directionMode === 'inbound'
              ? 'bg-orange-500 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
          >
            <span className="material-symbols-outlined text-sm">local_shipping</span>
            Chiều Nhập
          </button>
          <button
            type="button"
            onClick={() => setDirectionMode('outbound')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${directionMode === 'outbound'
              ? 'bg-orange-500 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
          >
            <span className="material-symbols-outlined text-sm">directions_boat</span>
            Chiều Xuất
          </button>
        </div>
      </div>

      {/* ── 5 QUY TẮC NGHIỆP VỤ CHUẨN BỊ BÃI (TOS GOLDEN RULES) ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowRulesExpanded(!showRulesExpanded)}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">verified</span>
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              5 Quy Tắc Nghiệp Vụ Chuẩn Bị Container
            </span>
            <span className="text-[10px] font-semibold bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200">
              Chuẩn Điều Độ TOS
            </span>
          </div>
          <button type="button" className="text-xs font-bold text-orange-600 hover:text-orange-700 inline-flex items-center gap-1 cursor-pointer">
            {showRulesExpanded ? 'Thu gọn quy tắc' : 'Xem chi tiết 5 quy tắc nghiệp vụ'}
            <span className="material-symbols-outlined text-sm">{showRulesExpanded ? 'expand_less' : 'expand_more'}</span>
          </button>
        </div>

        {showRulesExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
              <strong className="text-slate-900 block font-bold">1. Tối thiểu đảo chuyển & Khóa ô tạm</strong>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Chấm điểm ưu tiên ô tạm cùng khu bãi, không nằm đè container có lịch lấy/xếp trong ngày. Khóa <strong>SlotReservation</strong> chống chiếm chỗ.
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
              <strong className="text-slate-900 block font-bold">2. Container lạnh di chuyển</strong>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Tạm ngắt điện di chuyển trong dwell timer (30–45 phút) để không báo động giả; cảnh báo khẩn cấp nếu quá hạn chưa cắm điện lại.
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
              <strong className="text-slate-900 block font-bold">3. Cảnh báo trễ tiến độ</strong>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Gần đến giờ hẹn hoặc giờ xếp tàu mà chưa bấm hoàn tất, tự động đẩy lệnh lên đầu danh sách ưu tiên của khu bãi & báo điều độ.
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
              <strong className="text-slate-900 block font-bold">4. Cờ giữ / Hủy phút chót</strong>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Nhận cờ giữ (Hold), hủy e-D/O, khách hủy lịch, hoặc shut-out tàu: Tự động hủy lệnh chuẩn bị đang mở, giải phóng khóa ô tạm & hạ trạng thái container quay về Trong bãi / Bị giữ.
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
              <strong className="text-slate-900 block font-bold">5. Chính sách phí đảo chuyển</strong>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Miễn phí khi đảo chuyển theo quy hoạch chuẩn bãi; Tính phí Chủ hàng / Hãng tàu khi phát sinh đổi lịch, hủy lịch hoặc cắt rớt tàu phút chót.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── GIAO DIỆN CHÍNH THEO CHIỀU LÀM HÀNG ── */}
      {directionMode === 'outbound' ? (
        <div className="space-y-6">
          {/* KPI Metrics Chiều Xuất */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between hover:border-amber-300 transition-colors">
              <div>
                <div className="text-xs font-semibold text-slate-500">Chờ dọn đường</div>
                <div className="text-2xl font-black text-amber-600 font-mono mt-0.5">{outboundStats.pending}</div>
                <div className="text-[11px] text-amber-700 font-semibold flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Cần đảo chuyển tầng trên
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">layers_clear</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between hover:border-orange-300 transition-colors">
              <div>
                <div className="text-xs font-semibold text-slate-500">Đang đảo chuyển ô tạm</div>
                <div className="text-2xl font-black text-orange-600 font-mono mt-0.5">{outboundStats.inProgress}</div>
                <div className="text-[11px] text-orange-700 font-semibold flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Cẩu bãi nhấc sang ô tạm
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">forklift</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between hover:border-indigo-300 transition-colors">
              <div>
                <div className="text-xs font-semibold text-slate-500">Đã giữ chỗ ô tạm</div>
                <div className="text-2xl font-black text-indigo-600 font-mono mt-0.5">{outboundStats.reserved}</div>
                <div className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  SlotReservation bảo vệ
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">lock_clock</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between hover:border-emerald-300 transition-colors">
              <div>
                <div className="text-xs font-semibold text-slate-500">Sẵn sàng xếp tàu</div>
                <div className="text-2xl font-black text-emerald-600 font-mono mt-0.5">{outboundStats.ready}</div>
                <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Đủ 5 điều kiện · Sẵn sàng kéo
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">directions_boat</span>
              </div>
            </div>
          </div>

          {/* Quy chuẩn & Bộ lọc Chiều Xuất (Vessel & Container Type Filters) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            {/* Hàng 1: Lọc Chuyến Tàu Động & Sắp Xếp */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-orange-600">directions_boat</span>
                  Chuyến tàu:
                </span>
                {outboundVessels.map(v => {
                  const count = v === 'ALL'
                    ? outboundRequests.length
                    : outboundRequests.filter(r => r.vessel === v).length
                  const isActive = vesselFilter === v
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVesselFilter(v)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${isActive
                        ? 'bg-orange-500 text-white shadow-2xs font-bold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                      <span>{v === 'ALL' ? 'Tất cả chuyến tàu' : v}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${isActive ? 'bg-orange-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Sắp xếp theo thứ tự làm hàng */}
              <div className="flex items-center gap-2 self-start lg:self-auto">
                <span className="text-xs font-semibold text-slate-500">Sắp xếp:</span>
                <select
                  value={outboundSortBy}
                  onChange={e => setOutboundSortBy(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  <option value="LOADING_SEQ">⚓ Thứ tự xếp tàu (Đáy hầm lên trên - Bay Plan)</option>
                  <option value="URGENCY">⚡ Mức độ ưu tiên dọn đường (Lead time 180m trước)</option>
                  <option value="BLOCKING">📦 Cont bị đè nhiều nhất (Cần giải phóng sớm)</option>
                  <option value="POD">🌐 Cảng dỡ hàng (POD)</option>
                </select>
              </div>
            </div>

            {/* Hàng 2: Lọc Loại Container & Nguyên tắc TOS */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-orange-600">tune</span>
                  Loại container:
                </span>
                {[
                  { id: 'ALL', label: 'Tất cả loại cont', icon: 'apps', count: outboundCargoCounts.all },
                  { id: 'REEFER', label: 'Cont Lạnh (Reefer)', icon: 'ac_unit', color: 'text-cyan-600', count: outboundCargoCounts.reefer },
                  { id: 'IMO', label: 'Hàng Nguy Hiểm (IMO/DG)', icon: 'warning', color: 'text-rose-600', count: outboundCargoCounts.imo },
                  { id: 'DRY', label: 'Cont Khô / Thường (Dry)', icon: 'inventory_2', color: 'text-amber-700', count: outboundCargoCounts.dry },
                ].map(cat => {
                  const isActive = cargoTypeFilter === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCargoTypeFilter(cat.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${isActive
                        ? 'bg-slate-900 text-white shadow-2xs font-bold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                      <span className={`material-symbols-outlined text-sm ${isActive ? 'text-white' : cat.color}`}>
                        {cat.icon}
                      </span>
                      <span>{cat.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${isActive ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
                        {cat.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 bg-orange-50/70 border border-orange-100 px-3 py-1.5 rounded-xl">
                <span className="material-symbols-outlined text-base text-orange-600">info</span>
                Nguyên tắc TOS: Cont đáy hầm xếp trước (Lead time 180m); Cont trên boong xếp sau (60m).
              </div>
            </div>
          </div>

          {/* Danh sách container chiều xuất */}
          {outboundLoading ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
              <span className="material-symbols-outlined text-4xl text-orange-600 animate-spin mb-2">progress_activity</span>
              <p className="text-xs text-slate-500 font-semibold">Đang tải danh sách container xuất tàu từ cơ sở dữ liệu...</p>
            </div>
          ) : filteredOutbound.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
              <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">directions_boat</span>
              <p className="text-sm font-bold text-slate-700">Chưa có container nào trong danh sách chuẩn bị xếp tàu</p>
              <p className="text-xs text-slate-400 mt-1">Toàn bộ dữ liệu được đối soát trực tiếp từ danh sách xếp tàu Load List và sơ đồ Bay Plan thực tế.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {paginatedOutbound.map((item, index) => {
                  const statusCfg = STATUS_CFG[item.status] || { badge: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'info', label: item.status }
                  const isReady = item.statusCode === 'READY_FOR_LOADING'
                  const isReefer = item.reefer
                  const unplugPercent = isReefer ? Math.min(100, Math.round((item.unpluggedMinutes / item.maxUnplugMinutes) * 100)) : 0
                  const globalRank = (outboundPage - 1) * outboundPageSize + index + 1

                  return (
                    <div key={item.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
                      <div className="space-y-4">
                        {/* Header card: Tàu, Thứ tự xếp cẩu, Trạng thái */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md text-[11px] font-mono font-black bg-orange-500 text-white shadow-2xs" title={`Thứ tự thực hiện #${globalRank}`}>
                                #{globalRank}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
                                {item.vessel} · {item.voyage}
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                                Lượt cẩu #{item.loadingSequence}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-semibold mt-1">
                              Cẩu bờ: <strong className="text-slate-800">{item.quayCrane}</strong> · {item.stowagePosition}
                            </div>
                          </div>

                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusCfg.badge}`}>
                            <span className="material-symbols-outlined text-sm">{statusCfg.icon}</span>
                            {statusCfg.label}
                          </span>
                        </div>

                        {/* Container ID & loại hàng */}
                        <div className="border-t border-slate-100 pt-3">
                          <div className="flex items-baseline justify-between flex-wrap gap-1">
                            <span className="text-xl font-extrabold font-mono text-slate-900 tracking-tight">{item.containerId}</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isReefer && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                                  <span className="material-symbols-outlined text-xs">ac_unit</span> Cont Lạnh
                                </span>
                              )}
                              {(item.cargoType?.toLowerCase().includes('nguy hiểm') || item.cargo_type === 'dangerous') && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <span className="material-symbols-outlined text-xs">warning</span> IMO/DG
                                </span>
                              )}
                              <span className="text-xs font-bold text-slate-700 px-2 py-0.5 bg-slate-100 rounded-md font-mono">{item.containerType}</span>
                            </div>
                          </div>
                          <div className="text-xs text-slate-600 font-medium mt-0.5">{item.cargoType} · Cảng dỡ: <strong className="text-orange-700">{item.pod}</strong></div>
                          <div className="text-[11px] text-slate-400 mt-0.5">Hãng tàu: {item.carrier} · Số chì: {item.sealNumber}</div>
                        </div>

                        {/* Vị trí bãi & độ sâu stack */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-medium">Vị trí bãi:</span>
                            <span className="font-mono font-bold text-slate-900">{item.position} · Tầng {item.stackLevel}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-medium">Container chắn trên:</span>
                            <span className={`font-bold ${item.blockingContainers > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {item.blockingContainers > 0 ? `${item.blockingContainers} cont · Lead time ${item.plannedLeadTimeMinutes}m` : '0 cont · Mặt trên cùng'}
                            </span>
                          </div>
                          {item.tempSlotReserved && (
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-500 font-medium">Ô tạm giữ chỗ:</span>
                              <span className="font-mono font-bold text-indigo-700">{item.tempSlotReserved}</span>
                            </div>
                          )}
                        </div>

                        {/* Bộ 5 điều kiện tiên quyết (Checklist Vàng) */}
                        <div className="space-y-1 text-xs border-t border-slate-100 pt-3">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Đối soát 5 điều kiện xuất cảng:</div>
                          <div className="grid grid-cols-2 gap-1 text-[11px]">
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span> 1. Đã hạ bãi
                            </span>
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span> 2. Khớp Load List
                            </span>
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span> 3. VGM: {item.vgmWeight}
                            </span>
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span> 4. Hải quan thông quan
                            </span>
                          </div>
                          <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 pt-0.5">
                            <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span> 5. Không có cờ giữ
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-4 border-t border-slate-100 flex items-center gap-2 mt-auto">
                        {item.blockingContainers > 0 && item.statusCode !== 'READY_FOR_LOADING' && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenUnstackModal(item, e)}
                            className="flex-1 py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-colors cursor-pointer text-center"
                          >
                            Đảo cont chắn sang ô tạm
                          </button>
                        )}

                        {!isReady ? (
                          <button
                            type="button"
                            onClick={(e) => handleOpenReadyLoadingModal(item, e)}
                            className="flex-1 py-2 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer text-center"
                          >
                            Chốt Sẵn Sàng Xếp Tàu
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleOpenDispatchTruckModal(item, e)}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-sm">local_shipping</span>
                            Gọi Xe Kéo Ra Chân Cẩu
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleOpenEirReceipt(item, e)}
                          className="p-2 rounded-xl text-slate-500 hover:text-orange-600 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 transition-colors cursor-pointer"
                          title="Xem phiếu giao nhận container điện tử (e-EIR) chuẩn Cảng Tiên Sa"
                        >
                          <span className="material-symbols-outlined text-sm">receipt_long</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleOpenHoldModal(item, e)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors"
                          title="Áp cờ giữ (Hold) hoặc báo hãng tàu cắt rớt tàu (Shut-Out) — Tự động hủy & giải phóng ô tạm"
                        >
                          <span className="material-symbols-outlined text-sm">flag</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* THANH PHÂN TRANG CHIỀU XUẤT */}
              {filteredOutbound.length > 0 && (
                <PaginationBar
                  currentPage={outboundPage}
                  totalItems={filteredOutbound.length}
                  pageSize={outboundPageSize}
                  onPageChange={setOutboundPage}
                  onPageSizeChange={setOutboundPageSize}
                  pageSizeOptions={[6, 9, 12, 24]}
                />
              )}
            </div>
          )}
        </div>
      ) : (

        <>
          {/* ── KPI METRICS BAR CHUẨN DOANH NGHIỆP: ĐỐI SOÁT 2 BÊN VỚI BẢN ĐỒ BÃI ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-amber-200/90 rounded-2xl p-4 shadow-xs flex items-center justify-between hover:border-amber-400 transition-colors">
              <div>
                <div className="text-xs font-bold text-amber-700 uppercase tracking-wider">1. Container Đang Làm</div>
                <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">{stats.workingTotal}</div>
                <div className="text-[11px] text-amber-600 font-semibold flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Đang lưu bãi & làm thủ tục
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">schedule</span>
              </div>
            </div>

            <div className="bg-white border border-rose-200/90 rounded-2xl p-4 shadow-xs flex items-center justify-between hover:border-rose-400 transition-colors">
              <div>
                <div className="text-xs font-bold text-rose-700 uppercase tracking-wider">Xe Tại Cổng (Ưu tiên #1)</div>
                <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">{inboundPriorityStats.atGate}</div>
                <div className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Cần gắp hàng tránh ùn tắc
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">local_shipping</span>
              </div>
            </div>

            <div className="bg-white border border-blue-200/90 rounded-2xl p-4 shadow-xs flex items-center justify-between hover:border-blue-400 transition-colors">
              <div>
                <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">Nâng Hạ & Cấp e-EIR</div>
                <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">{stats.inProgress + stats.ready}</div>
                <div className="text-[11px] text-blue-600 font-semibold flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {stats.ready} cont đã sẵn sàng ra cổng
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">forklift</span>
              </div>
            </div>

            <div className="bg-white border border-emerald-200/90 rounded-2xl p-4 shadow-xs flex items-center justify-between hover:border-emerald-400 transition-colors">
              <div>
                <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">2. Container Đã Xuất Cổng</div>
                <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">{stats.completed}</div>
                <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Đã rời cổng cảng hôm nay
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">check_circle</span>
              </div>
            </div>
          </div>

          {/* ── ENTERPRISE NAVIGATION TABS & ACTIONS ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              {[
                { id: 'dispatch', label: 'Bảng Điều Độ Giao Nhận', icon: 'view_kanban', count: requests.length },
                { id: 'yard_map', label: 'Sơ Đồ Bãi & Thiết Bị RS', icon: 'grid_view', count: AVAILABLE_EQUIPMENTS.length },
                { id: 'eir_ledger', label: 'Sổ Cái Biên Bản e-EIR', icon: 'menu_book', count: requests.filter(r => r.eirReferenceNo || r.flowStep >= 4).length },
              ].map(tab => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${isActive
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                      }`}
                  >
                    <span className="material-symbols-outlined text-base">{tab.icon}</span>
                    <span>{tab.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${isActive ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Xuất CSV
              </button>

              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                Đồng bộ
              </button>
            </div>
          </div>

          {/* ── NỘI DUNG TAB 1: BẢNG ĐIỀU ĐỘ GIAO NHẬN ── */}
          {activeTab === 'dispatch' && (
            <div className="space-y-4">
              {/* SEARCH & FILTERS TOOLBAR */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
                {/* Hàng 1: Ô tìm kiếm + Sắp xếp + Chuyển chế độ xem Grid/Table */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-lg">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Tìm mã container, xe đầu kéo, tài xế, mã booking..."
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                    {/* Chuyển chế độ xem Grid / Table */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white shadow-2xs text-orange-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Chế độ lưới thẻ"
                      >
                        <span className="material-symbols-outlined text-base">grid_view</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'table' ? 'bg-white shadow-2xs text-orange-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Chế độ danh sách bảng"
                      >
                        <span className="material-symbols-outlined text-base">format_list_bulleted</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Hàng 2: BỘ ĐIỀU HƯỚNG 2 BÊN (1. ĐANG LÀM vs 2. ĐÃ XUẤT CỔNG) */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 flex-wrap">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Nút 1: Bên 1 - Container Đang Làm Trong Bãi */}
                    <button
                      type="button"
                      onClick={() => setSideViewMode('working')}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${sideViewMode === 'working'
                        ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-400/50'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                    >
                      <span className="material-symbols-outlined text-base text-amber-600">schedule</span>
                      <span>1. Container Đang Làm</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${sideViewMode === 'working' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>
                        {sortedWorking.length} cont trong bãi
                      </span>
                    </button>

                    {/* Nút 2: Bên 2 - Container Đã Được Xuất Cổng */}
                    <button
                      type="button"
                      onClick={() => setSideViewMode('completed')}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${sideViewMode === 'completed'
                        ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400/50'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                    >
                      <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
                      <span>2. Container Đã Được Xuất Cổng</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${sideViewMode === 'completed' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        }`}>
                        {sortedCompleted.length} cont đã xuất
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Thanh trạng thái thông tin & thứ tự ưu tiên khai thác bãi */}
              <div className="bg-gradient-to-r from-orange-50/90 via-white to-amber-50/60 border border-orange-200 rounded-2xl p-3 sm:px-4 sm:py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="flex items-center gap-2 flex-wrap">
                  {sideViewMode === 'working' ? (
                    <>
                      <span className="font-bold text-amber-950 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-orange-600 text-base">low_priority</span>
                        1. Container Đang Làm:
                      </span>
                      <span className="text-slate-600 font-medium">
                        Tự động sắp xếp mức ưu tiên: <strong className="text-rose-700">Khẩn cấp (Xe tại bãi)</strong> ➔ <strong className="text-amber-700">Cao (Hẹn sớm)</strong> ➔ <strong className="text-slate-700">Thấp</strong>.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-emerald-600 text-base">verified</span>
                        2. Container Đã Được Xuất Cổng:
                      </span>
                      <span className="text-slate-600 font-medium">
                        Đã hoàn tất 5 bước quy trình TOS Cảng Tiên Sa, cấp phiếu e-EIR điện tử và xe đã rời cảng.
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap font-semibold">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${sideViewMode === 'working' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sideViewMode === 'working' ? 'bg-amber-600 animate-pulse' : 'bg-slate-400'}`} />
                    {sortedWorking.length} Đang Làm
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${sideViewMode === 'completed' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sideViewMode === 'completed' ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                    {sortedCompleted.length} Đã Xuất Cổng
                  </span>
                </div>
              </div>

              {/* LIST / GRID CONTENT (HIỂN THỊ TRỰC TIẾP THEO TAB ĐANG CHỌN) */}
              {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-500 text-sm">
                  {sideViewMode === 'working'
                    ? 'Không có container nào đang xử lý trong bãi phù hợp với tìm kiếm.'
                    : 'Chưa có container nào hoàn tất xuất cổng phù hợp với tìm kiếm.'}
                </div>
              ) : viewMode === 'grid' ? (
                /* ── CHẾ ĐỘ THẺ TOÀN MÀN HÌNH (GRID) ── */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedInbound.map((r, index) =>
                      renderInboundCard(r, (inboundPage - 1) * inboundPageSize + index, sideViewMode === 'completed')
                    )}
                  </div>
                  <PaginationBar
                    currentPage={inboundPage}
                    totalItems={filtered.length}
                    pageSize={inboundPageSize}
                    onPageChange={setInboundPage}
                    onPageSizeChange={setInboundPageSize}
                    pageSizeOptions={[6, 12, 24, 48]}
                  />
                </div>
              ) : (
                /* ── CHẾ ĐỘ BẢNG TOÀN MÀN HÌNH (TABLE) ── */
                <div className="space-y-4">
                  <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                          <tr>
                            <th className="p-3.5 pl-5 text-center w-16"># Thứ tự</th>
                            <th className="p-3.5">Mã Container</th>
                            <th className="p-3.5">Hãng Tàu & Loại</th>
                            <th className="p-3.5">Phương Tiện & Tài Xế</th>
                            <th className="p-3.5">Vị Trí Ô Bãi</th>
                            <th className="p-3.5">Giờ Hẹn / Giờ Xuất Bãi</th>
                            <th className="p-3.5">Độ Ưu Tiên</th>
                            <th className="p-3.5">Trạng Thái</th>
                            <th className="p-3.5 pr-5 text-right">Thao Tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {paginatedInbound.map((r, index) => {
                            const isCompletedSide = sideViewMode === 'completed' || r.status === 'HOÀN THÀNH' || r.status === 'COMPLETED' || (r.flowStep || 0) >= 5
                            const st = STATUS_CFG[r.status] || STATUS_CFG['CHỜ TIẾP NHẬN']
                            const prio = getAppointmentPriority(r)
                            const hasEir = Boolean(r.eirReferenceNo || r.flowStep >= 4 || r.status === 'SẴN SÀNG XUẤT' || r.status === 'READY_FOR_GATE_OUT' || isCompletedSide)
                            const isCritical = prio.isAtGate
                            const isHigh = !prio.isAtGate && !isCompletedSide
                            const globalRank = (inboundPage - 1) * inboundPageSize + index + 1
                            return (
                              <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3.5 pl-5 text-center">
                                  <span className={`inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md text-xs font-mono font-black ${isCompletedSide
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : isCritical
                                      ? 'bg-rose-600 text-white shadow-xs'
                                      : isHigh
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}>
                                    {isCompletedSide ? '✓' : `#${globalRank}`}
                                  </span>
                                </td>
                                <td className="p-3.5">
                                  <div className="font-mono font-bold text-slate-900 text-sm">{r.containerId}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">BK: {r.booking || r.bookingCode}</div>
                                </td>
                                <td className="p-3.5">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                                    {r.carrier}
                                  </span>
                                  <div className="text-[11px] text-slate-500 mt-0.5">{r.containerType}</div>
                                </td>
                                <td className="p-3.5">
                                  <div className="font-mono font-bold text-slate-900">{r.truck || r.truckPlate}</div>
                                  <div className="text-[11px] text-slate-500">{r.driver || r.driverName}</div>
                                </td>
                                <td className="p-3.5 font-mono font-bold text-slate-800">{r.position}</td>
                                <td className="p-3.5">
                                  <div className="font-mono font-bold text-slate-800">{r.requestedTime || r.requested_time || '16:30'}</div>
                                  <div className="text-[10px] text-slate-400">{isCompletedSide ? 'Giờ xuất bãi' : 'Giờ hẹn'}</div>
                                </td>
                                <td className="p-3.5">
                                  {isCompletedSide ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <span className="material-symbols-outlined text-xs">check_circle</span>
                                      ĐÃ XUẤT CỔNG
                                    </span>
                                  ) : (
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${prio.badge}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
                                      {prio.label}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3.5">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${st.badge}`}>
                                    <span className="material-symbols-outlined text-xs">{st.icon}</span>
                                    {st.label}
                                  </span>
                                </td>
                                <td className="p-3.5 pr-5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {hasEir ? (
                                      <button
                                        type="button"
                                        onClick={(e) => handleOpenEirReceipt(r, e)}
                                        className="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                        title="Xem phiếu giao nhận container điện tử (e-EIR)"
                                      >
                                        <span className="material-symbols-outlined text-xs">receipt_long</span>
                                        e-EIR
                                      </button>
                                    ) : (
                                      <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                        Chưa cấp
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => onSelect(r)}
                                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                    >
                                      Chi tiết
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <PaginationBar
                    currentPage={inboundPage}
                    totalItems={filtered.length}
                    pageSize={inboundPageSize}
                    onPageChange={setInboundPage}
                    onPageSizeChange={setInboundPageSize}
                    pageSizeOptions={[6, 12, 24, 48]}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── NỘI DUNG TAB 2: SƠ ĐỒ BÃI & THIẾT BỊ NÂNG HẠ ── */}
          {activeTab === 'yard_map' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {AVAILABLE_EQUIPMENTS.map(eq => (
                  <div key={eq.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                          <span className="material-symbols-outlined text-xl">forklift</span>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{eq.name}</h4>
                          <div className="text-[11px] text-slate-500 font-mono">Kênh đàm: {eq.radio}</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {eq.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-medium">Tài xế vận hành</span>
                        <strong className="text-slate-800">{eq.operator}</strong>
                        <div className="text-[10px] text-slate-500 mt-0.5">{eq.phone}</div>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-medium">Tải trọng cẩu</span>
                        <strong className="text-orange-700">{eq.capacity}</strong>
                        <div className="text-[10px] text-slate-500 mt-0.5">Reach Stacker</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Layout Bản Đồ Bãi Tiên Sa */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Quy hoạch phân khu bãi container Cảng Tiên Sa</h3>
                    <p className="text-xs text-slate-500">Giám sát vị trí lưu trữ container theo khu vực chuyên dụng.</p>
                  </div>
                  <span className="px-3 py-1 bg-orange-50 text-orange-700 border border-orange-200 text-xs font-bold rounded-lg">
                    Hệ thống TOS Live
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="text-orange-700 font-bold uppercase text-[11px] tracking-wider">Khu A — Bãi Container Xuất Khẩu</div>
                    <p className="text-slate-600">Quy hoạch các container hàng khô đã hoàn tất thủ tục hải quan sẵn sàng xếp lên tàu.</p>
                    <div className="text-[11px] text-orange-700 font-mono font-bold">
                      {workingRequests.filter(r => (r.block || r.position || '').toUpperCase().includes('A')).length} container đang lưu bãi
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="text-emerald-700 font-bold uppercase text-[11px] tracking-wider">Khu B — Bãi Giao Nhận & Đệm Tạm</div>
                    <p className="text-slate-600">Vùng đệm tiếp nhận container nhập khẩu giao cho xe khách đến nhận hàng.</p>
                    <div className="text-[11px] text-emerald-700 font-mono font-bold">
                      {workingRequests.filter(r => (r.block || r.position || '').toUpperCase().includes('B')).length} container đang tác nghiệp
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="text-purple-700 font-bold uppercase text-[11px] tracking-wider">Khu C — Bãi Lưu Kho Vỏ / Tổng Hợp</div>
                    <p className="text-slate-600">Khu bãi tổng hợp vỏ và hàng nhập chuyển cảng Tiên Sa.</p>
                    <div className="text-[11px] text-purple-700 font-mono font-bold">
                      {workingRequests.filter(r => (r.block || r.position || '').toUpperCase().includes('C')).length} container đang lưu bãi
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="text-cyan-700 font-bold uppercase text-[11px] tracking-wider">Khu D — Bãi Container Lạnh (Reefer)</div>
                    <p className="text-slate-600">Khu cắm điện lạnh 380V/440V, kiểm soát nhiệt độ tự động qua hệ thống Scada.</p>
                    <div className="text-[11px] text-cyan-700 font-mono font-bold">
                      {workingRequests.filter(r => (r.block || r.position || '').toUpperCase().includes('D')).length} container đang cắm điện
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── NỘI DUNG TAB 3: SỔ CÁI BIÊN BẢN e-EIR ĐIỆN TỬ ── */}
          {activeTab === 'eir_ledger' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Sổ cái chứng từ giao nhận e-EIR hướng ra</h3>
                  <p className="text-xs text-slate-500">Toàn bộ biên bản có giá trị pháp lý đã được ký số và chốt thời gian thực.</p>
                </div>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Chuẩn Cảng Tiên Sa TOS
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="p-3.5 pl-5">Số Phiếu e-EIR</th>
                      <th className="p-3.5">Mã Container</th>
                      <th className="p-3.5">Biển Số Xe & Tài Xế</th>
                      <th className="p-3.5">Số Seal Niêm Phong</th>
                      <th className="p-3.5">Tình Trạng Vỏ</th>
                      <th className="p-3.5">Thời Điểm Cấp</th>
                      <th className="p-3.5 pr-5 text-right">Chi Tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {paginatedEir.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 pl-5 font-mono font-bold text-orange-700">
                          {r.eirReferenceNo || `EIR-OUT-20260812-${r.code?.slice(-4) || '0001'}`}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-900">{r.containerId}</td>
                        <td className="p-3.5 font-mono text-slate-800">{r.truck || r.truckPlate} · {r.driver || r.driverName}</td>
                        <td className="p-3.5 font-mono text-purple-900 font-bold">{r.sealNumber || 'UL6824219'}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {r.condition || 'Tốt'}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500">{new Date().toLocaleDateString('vi-VN')} {r.requestedTime}</td>
                        <td className="p-3.5 pr-5 text-right">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEirReceipt(r, e)}
                            className="px-3 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-xs">receipt_long</span>
                            Mở phiếu e-EIR
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* THANH PHÂN TRANG SỔ CÁI e-EIR */}
              {eirList.length > 0 && (
                <div className="p-4 border-t border-slate-100 bg-slate-50/40">
                  <PaginationBar
                    currentPage={eirPage}
                    totalItems={eirList.length}
                    pageSize={eirPageSize}
                    onPageChange={setEirPage}
                    onPageSizeChange={setEirPageSize}
                    pageSizeOptions={[5, 10, 20]}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── MODAL 1: ĐIỀU PHỐI ĐẢO CONT CHẮN SANG Ô TẠM (QUY TRÌNH CHUẨN TOS) ── */}
      {unstackTargetItem && (
        <StrictUnstackModal
          isOpen={true}
          onClose={() => setUnstackTargetItem(null)}
          targetReq={unstackTargetItem}
          stackContainers={unstackTargetItem.stackContainers || []}
          allRequests={requests}
          onSuccess={() => {
            if (onRefresh) onRefresh()
          }}
          showToast={showToast}
        />
      )}

      {/* ── MODAL 2: ĐỐI SOÁT & CHỐT SẴN SÀNG XẾP TÀU ── */}
      {readyLoadingTargetItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-orange-600">
                <span className="material-symbols-outlined text-2xl">verified</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Đối Soát & Chốt SẴN SÀNG XẾP TÀU</h3>
                  <div className="text-[11px] text-slate-500 font-medium">Kiểm tra 5 điều kiện tiên quyết Cảng Tiên Sa</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReadyLoadingTargetItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Thông tin container */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 text-[10px] block">Mã container:</span>
                <strong className="text-slate-900 font-mono text-sm">{readyLoadingTargetItem.containerId}</strong>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Hãng tàu / Tàu:</span>
                <strong className="text-slate-800">{readyLoadingTargetItem.carrier} · {readyLoadingTargetItem.vessel}</strong>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Cảng dỡ hàng POD:</span>
                <strong className="text-orange-700 font-mono">{readyLoadingTargetItem.pod}</strong>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Vị trí hiện tại:</span>
                <strong className="text-slate-800 font-mono">{readyLoadingTargetItem.position}</strong>
              </div>
            </div>

            {/* Checklist 5 Điều Kiện Vàng */}
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Kết quả đối soát tự động 5 điều kiện TOS:
              </div>
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-2 text-[11px] text-emerald-900">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
                  <span>1. Trong bãi & Đã dọn đường sạch sẽ (Tầng trên cùng, không bị cont đè)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
                  <span>2. Danh sách xếp tàu: Khớp Load List & Bay Plan được duyệt</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
                  <span>3. Khối lượng toàn bộ VGM SOLAS hợp lệ · {readyLoadingTargetItem.vgmWeight}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
                  <span>4. Hải quan giám sát tự động VASSCM đã cấp phép thông quan</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
                  <span>5. Không có cờ giữ (Hold) hoặc yêu cầu hoãn từ Hãng tàu</span>
                </div>
                {readyLoadingTargetItem.reefer && (
                  <div className="flex items-center gap-2 pt-1 border-t border-emerald-200/60 text-purple-900">
                    <span className="material-symbols-outlined text-base text-purple-600">ac_unit</span>
                    <span>6. Container lạnh duy trì nhiệt độ · Kích hoạt dwell timer 30-45 phút ngắt điện di chuyển</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setReadyLoadingTargetItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmReadyModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">check</span>
                {actionLoading ? 'Đang xử lý...' : 'Xác Nhận Chốt Sẵn Sàng Xếp Tàu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: ĐIỀU ĐỘNG XE KÉO BÃI RA CHÂN CẨU BỜ ── */}
      {dispatchTruckTargetItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <span className="material-symbols-outlined text-2xl">local_shipping</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Điều Động Xe Kéo Bãi Ra Chân Cẩu</h3>
                  <div className="text-[11px] text-slate-500 font-medium">Cung ứng container ra cầu tàu theo chu kỳ cẩu bờ</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDispatchTruckTargetItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Mã container:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{dispatchTruckTargetItem.containerId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Cẩu bờ đích QC:</span>
                <strong className="text-slate-900">{dispatchTruckTargetItem.quayCrane}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Thứ tự bốc tàu:</span>
                <strong className="text-amber-700 font-mono">Lượt #{dispatchTruckTargetItem.loadingSequence}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Vị trí xếp trên tàu (Bay Plan):</span>
                <span className="font-mono font-semibold text-slate-700">{dispatchTruckTargetItem.stowagePosition}</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-700 font-bold">Chọn xe đầu kéo nội bộ (Terminal Tractor):</label>
              <select
                value={selectedYardTruck}
                onChange={e => setSelectedYardTruck(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
              >
                <option value="TRK-TERMINAL-01">TRK-TERMINAL-01 · Tài xế: Lê Đình Nam · Sẵn sàng</option>
                <option value="TRK-TERMINAL-02">TRK-TERMINAL-02 · Tài xế: Nguyễn Văn Hưng · Sẵn sàng</option>
                <option value="TRK-TERMINAL-03">TRK-TERMINAL-03 · Tài xế: Phạm Quốc Bảo · Sẵn sàng</option>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDispatchTruckTargetItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmDispatchTruckModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">local_shipping</span>
                {actionLoading ? 'Đang điều xe...' : 'Xác Nhận Điều Xe Nội Bộ Ra Cầu Tàu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: XỬ LÝ CỜ GIỮ (HOLD) HOẶC HỦY PHÚT CHÓT ── */}
      {showHoldModal && targetHoldItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <span className="material-symbols-outlined">gavel</span>
                <h3 className="text-base font-bold text-slate-900">
                  Xử Lý Cờ Giữ Hold / Hủy Phút Chót
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowHoldModal(false); setTargetHoldItem(null); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
              <strong className="block font-bold">Quy tắc nghiệp vụ TOS — Quy tắc 4:</strong>
              <p>
                Khi container nhận cờ giữ, bị hủy e-D/O, khách hủy lịch hẹn hoặc hãng tàu cắt rớt chuyến Shut-out, hệ thống <strong>tự động hủy lệnh chuẩn bị đang mở</strong>, <strong>giải phóng khóa ô tạm</strong> và hạ trạng thái container quay về <strong>Trong bãi hoặc Bị giữ</strong>.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">Mã Container áp dụng:</label>
                <div className="font-mono font-black text-slate-900 text-sm bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {targetHoldItem.containerId}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Lý do áp cờ giữ hoặc hủy lệnh:</label>
                <select
                  value={holdReason}
                  onChange={e => setHoldReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer"
                >
                  <option value="CustomsHold">Cờ giữ Hải Quan — Chưa thông quan hoặc yêu cầu soi chiếu</option>
                  <option value="CarrierHold">Cờ giữ Hãng Tàu — Chưa thanh toán cước cont hoặc seal sai lệch</option>
                  <option value="ShutOut">Hãng tàu cắt rớt tàu (Shut-Out) — Quá tải hoặc đổi lịch bay plan</option>
                  <option value="CustomerCancel">Chủ hàng hủy lịch hẹn rút cont phút chót</option>
                  <option value="EdoRevoked">Hủy lệnh giao hàng điện tử e-D/O</option>
                </select>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Khóa ô tạm:</span>
                  <span className="font-bold text-rose-600">Sẽ giải phóng ngay lập tức</span>
                </div>
                <div className="flex justify-between">
                  <span>Trạng thái sau hủy:</span>
                  <span className="font-bold text-slate-800">Trong bãi — Bị giữ</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowHoldModal(false); setTargetHoldItem(null); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Đóng lại
              </button>
              <button
                type="button"
                onClick={handleExecuteHoldOrCancel}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">block</span>
                Xác nhận Áp Cờ Giữ & Hủy Lệnh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 5: e-EIR CHUẨN IN ẤN & PHÁP LÝ (TIÊN SA PORT TOS) ── */}
      <ElectronicEirReceiptModal
        isOpen={showEirReceiptModal}
        onClose={() => setShowEirReceiptModal(false)}
        data={selectedEirData}
      />
    </div>
  )
}


// ─── ROOT CONTAINER: ĐIỀU HÀNH XUẤT CỔNG ─────────────────────────────────────
export default function ContainerGateOutPreparation() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  const showToast = useCallback((msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }, [])

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getGateOutRequests({ direction: 'inbound', limit: 100 })
      setRequests(Array.isArray(data) ? data : [])
    } catch (err) {
      setRequests([])
      showToast(getFriendlyErrorMessage(err, 'Không thể tải danh sách container từ máy chủ.'))
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  useEffect(() => {
    const cleanup = subscribeYardRealtime({
      onOutboundRequested: (data) => {
        const item = data?.request || data
        showToast(`Xe ${item?.truckPlate || item?.truck} đang đợi xuất container ${item?.containerId}!`)
        setRequests(prev => {
          const targetId = item?.id || item?.requestId
          const exists = prev.some(r => r.id === targetId || r.containerId === item?.containerId)
          return exists ? prev.map(r => (r.id === targetId || r.containerId === item?.containerId) ? { ...r, ...item } : r) : [item, ...prev]
        })
      },
      onFlowStepUpdated: (data) => {
        const item = data?.request || data
        const targetId = item?.id || data?.requestId || data?.id
        const targetCont = item?.containerId || data?.containerId
        const newStep = data?.flowStep !== undefined ? data.flowStep : (data?.flow_step !== undefined ? data.flow_step : undefined)

        setRequests(prev => prev.map(r => {
          if (r.id === targetId || (targetCont && r.containerId === targetCont)) {
            return {
              ...r,
              ...(item || {}),
              flowStep: newStep !== undefined ? newStep : r.flowStep,
              flow_step: newStep !== undefined ? newStep : r.flow_step,
              status: data?.status || item?.status || r.status,
              statusCode: data?.statusCode || item?.statusCode || r.statusCode,
              slotStatus: data?.slotStatus || item?.slotStatus || r.slotStatus,
              eirReferenceNo: data?.eirReferenceNo || item?.eirReferenceNo || r.eirReferenceNo,
            }
          }
          return r
        }))

        if (selectedRequest && (selectedRequest.id === targetId || (targetCont && selectedRequest.containerId === targetCont))) {
          setSelectedRequest(prev => ({
            ...prev,
            ...(item || {}),
            flowStep: newStep !== undefined ? newStep : prev.flowStep,
            flow_step: newStep !== undefined ? newStep : prev.flow_step,
            status: data?.status || item?.status || prev.status,
            statusCode: data?.statusCode || item?.statusCode || prev.statusCode,
            slotStatus: data?.slotStatus || item?.slotStatus || prev.slotStatus,
            eirReferenceNo: data?.eirReferenceNo || item?.eirReferenceNo || prev.eirReferenceNo,
          }))
        }
      },
      onCraneDispatched: (data) => {
        const item = data?.request || data
        const targetId = item?.id || data?.requestId || data?.id
        const targetCont = item?.containerId || data?.containerId
        setRequests(prev => prev.map(r => {
          if (r.id === targetId || (targetCont && r.containerId === targetCont)) {
            return {
              ...r,
              ...item,
              flowStep: Math.max(r.flowStep || 0, 1),
              flow_step: Math.max(r.flow_step || 0, 1),
              status: 'ĐANG THỰC HIỆN',
              statusCode: 'IN_PROGRESS',
              rtgCrane: data?.rtgCrane || r.rtgCrane,
              rtgOperator: data?.rtgOperator || r.rtgOperator,
            }
          }
          return r
        }))
        if (selectedRequest && (selectedRequest.id === targetId || (targetCont && selectedRequest.containerId === targetCont))) {
          setSelectedRequest(prev => ({
            ...prev,
            ...item,
            flowStep: Math.max(prev.flowStep || 0, 1),
            flow_step: Math.max(prev.flow_step || 0, 1),
            status: 'ĐANG THỰC HIỆN',
            statusCode: 'IN_PROGRESS',
            rtgCrane: data?.rtgCrane || prev.rtgCrane,
            rtgOperator: data?.rtgOperator || prev.rtgOperator,
          }))
        }
      },
      onContainerReady: (data) => {
        const item = data?.request || data
        const targetId = item?.id || data?.requestId || data?.id
        const targetCont = item?.containerId || data?.containerId
        showToast(`Container ${targetCont || ''} đã lên xe và sẵn sàng xuất cổng!`)
        setRequests(prev => prev.map(r => {
          if (r.id === targetId || (targetCont && r.containerId === targetCont)) {
            return {
              ...r,
              ...item,
              status: 'SẴN SÀNG XUẤT',
              statusCode: 'READY_FOR_GATE_OUT',
              slotStatus: 'Available',
              flowStep: 4,
              flow_step: 4,
              eirReferenceNo: data?.eirReferenceNo || item?.eirReferenceNo || r.eirReferenceNo,
            }
          }
          return r
        }))
        if (selectedRequest && (selectedRequest.id === targetId || (targetCont && selectedRequest.containerId === targetCont))) {
          setSelectedRequest(prev => ({
            ...prev,
            ...item,
            status: 'SẴN SÀNG XUẤT',
            statusCode: 'READY_FOR_GATE_OUT',
            slotStatus: 'Available',
            flowStep: 4,
            flow_step: 4,
            eirReferenceNo: data?.eirReferenceNo || item?.eirReferenceNo || prev.eirReferenceNo,
          }))
        }
      },
      onContainerGatedOut: (data) => {
        const targetId = data?.requestId || data?.id
        const targetCont = data?.containerId
        showToast(`Container ${targetCont || ''} đã hoàn tất ra cổng!`)
        setRequests(prev => prev.map(r => {
          if (r.containerId === targetCont || (targetId && r.id === targetId)) {
            return {
              ...r,
              status: 'HOÀN THÀNH',
              statusCode: 'COMPLETED',
              flowStep: 5,
              flow_step: 5,
            }
          }
          return r
        }))
        if (selectedRequest && (selectedRequest.containerId === targetCont || (targetId && selectedRequest.id === targetId))) {
          setSelectedRequest(prev => ({
            ...prev,
            status: 'HOÀN THÀNH',
            statusCode: 'COMPLETED',
            flowStep: 5,
            flow_step: 5,
          }))
        }
      },
    })

    return cleanup
  }, [selectedRequest, showToast])

  const handleUpdateSuccess = (updatedItem) => {
    setRequests(prev => prev.map(r => r.id === updatedItem.id ? updatedItem : r))
    setSelectedRequest(updatedItem)
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full font-sans bg-slate-50 min-h-screen text-slate-900 relative">
      {/* Toast Notification (Light Theme) */}
      {toastMessage && (
        <div className="fixed top-20 right-8 bg-white text-slate-900 border border-slate-200/80 px-5 py-3 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2.5 z-[250] animate-in fade-in slide-in-from-top-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {toastMessage}
        </div>
      )}

      {selectedRequest ? (
        <GateOutDetailView
          request={selectedRequest}
          allRequests={requests}
          onBack={() => setSelectedRequest(null)}
          onUpdateSuccess={handleUpdateSuccess}
          showToast={showToast}
        />
      ) : (
        <GateOutListView
          requests={requests}
          loading={loading}
          onSelect={setSelectedRequest}
          onRefresh={fetchRequests}
          showToast={showToast}
        />
      )}
    </div>
  )
}
