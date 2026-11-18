import apiClient from './apiClient'
import { io } from 'socket.io-client'

/**
 * Service giao tiếp với API Xác nhận container xuất bãi (Yard Gate-Out Confirmation).
 */

const getRealtimeUrl = () => {
  if (import.meta.env.VITE_REALTIME_URL) {
    return import.meta.env.VITE_REALTIME_URL
  }
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.startsWith('http')) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  }
  return 'http://localhost:3001'
}

const getToken = () => {
  try {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user')
    return stored ? JSON.parse(stored)?.token : null
  } catch {
    return null
  }
}

/**
 * Lấy danh sách yêu cầu xuất / chuẩn bị container bãi (Chiều Nhập 5A hoặc Chiều Xuất 5B).
 * @param {{ direction?: 'inbound' | 'outbound', status?: string, search?: string, urgency?: string, vessel?: string, page?: number, limit?: number }} params
 */
export async function getGateOutRequests(params = {}) {
  const res = await apiClient.get('/yard/gate-out-requests', { params })
  const result = res.data?.data
  if (Array.isArray(result)) return result
  if (result && Array.isArray(result.requests)) return result.requests
  return []
}

/**
 * Thao tác Đảo chuyển container chắn sang ô tạm đã khóa (Bước 5 Chiều Nhập & Chiều Xuất).
 */
export async function executeUnstackMove(id, data = {}) {
  const res = await apiClient.post(`/yard/gate-out-requests/${id}/unstack`, data)
  return res.data?.data ?? res.data
}

/**
 * Đưa container ra vị trí bãi đệm gần đường xe chạy (Bước 6 Chiều Nhập).
 */
export async function executeBufferStage(id, data = {}) {
  const res = await apiClient.post(`/yard/gate-out-requests/${id}/buffer-stage`, data)
  return res.data?.data ?? res.data
}

/**
 * Chốt Sẵn Sàng Giao (Bước 8 Chiều Nhập 5A) sau khi đối soát e-D/O & số chì.
 */
export async function confirmReadyDelivery(id, data = {}) {
  const res = await apiClient.post(`/yard/gate-out-requests/${id}/confirm-ready-delivery`, data)
  return res.data?.data ?? res.data
}

/**
 * Chốt Sẵn Sàng Xếp Tàu (Chiều Xuất 5B) khi đạt 5 điều kiện tiên quyết.
 */
export async function confirmReadyLoading(id, data = {}) {
  const res = await apiClient.post(`/yard/gate-out-requests/${id}/confirm-ready-loading`, data)
  return res.data?.data ?? res.data
}

/**
 * Điều động xe nội bộ kéo container ra chân cẩu cầu tàu (Chiều Xuất 5B).
 */
export async function dispatchApronTruck(id, data = {}) {
  const res = await apiClient.post(`/yard/gate-out-requests/${id}/dispatch-apron`, data)
  return res.data?.data ?? res.data
}

/**
 * Ghi nhận ngắt điện / cắm lại container lạnh kèm Dwell timer (30-45 phút).
 */
export async function toggleReeferPower(id, data = {}) {
  const res = await apiClient.post(`/yard/gate-out-requests/${id}/reefer-power`, data)
  return res.data?.data ?? res.data
}

/**
 * Hủy lệnh chuẩn bị, cờ giữ (Hold) hoặc Shut-Out phút chót.
 */
export async function cancelPreparationOrShutOut(id, data = {}) {
  const res = await apiClient.post(`/yard/gate-out-requests/${id}/shut-out`, data)
  return res.data?.data ?? res.data
}

/**
 * Lấy chi tiết 1 yêu cầu xuất container bãi.
 * @param {string} id
 */
export async function getGateOutRequestById(id) {
  const res = await apiClient.get(`/yard/gate-out-requests/${id}`)
  return res.data?.data ?? null
}

/**
 * Tạo/gán lệnh cẩu RTG bắt đầu pickup container.
 * @param {string} id
 * @param {{ rtgCrane?: string, rtgOperator?: string }} data
 */
export async function createLiftOrder(id, data = {}) {
  const res = await apiClient.post(`/yard/gate-out-requests/${id}/lift-order`, data)
  return res.data?.data ?? null
}

/**
 * Cập nhật bước tiến trình cẩu container.
 * @param {string} id
 * @param {{ step: number, note?: string }} data
 */
export async function updateFlowStep(id, data = {}) {
  const res = await apiClient.patch(`/yard/gate-out-requests/${id}/step`, data)
  return res.data?.data ?? null
}

/**
 * Xác nhận container đã cẩu lên xe, đối soát Container ID & Seal, giải phóng slot ô bãi.
 * @param {string} id
 * @param {{ verifiedContainerId: boolean, verifiedSeal: boolean, verifiedNoDamage?: boolean, sealNumber?: string, containerCondition?: string, note?: string }} data
 */
export async function confirmLoadedOnTruck(id, data = {}) {
  const res = await apiClient.post(`/yard/gate-out-requests/${id}/confirm-loaded`, data)
  return res.data?.data ?? null
}

/**
 * 1. Kiểm tra 5 điều kiện xuất container tại cổng vào theo thời gian thực:
 * - e-DO còn hiệu lực, không bị giữ
 * - Lệnh lấy hàng đã thanh toán
 * - Đúng khung giờ (cửa sổ ±60 phút)
 * - Biển số xe & tài xế khớp lệnh
 * - Container sẵn sàng tại bãi
 */
export async function checkGateOutEligibility(params = {}) {
  const res = await apiClient.post('/yard/gate-out/check-eligibility', params)
  return res.data
}

/**
 * 2. Lập phiếu EIR điện tử hướng ra (e-EIR Gate-Out) và xác nhận đối soát hiện trường.
 * - Mã phiếu EIR bất biến: EIR-OUT-YYYYMMDD-XXXX
 * - Đối soát chì seal & kiểm tra 6 mặt vỏ container
 * - Chụp/tải ảnh hư hỏng đính kèm (nếu phát hiện hỏng vỏ khi nâng)
 * - Chữ ký số Điều độ bãi & Tài xế
 * - Mã QR tra cứu
 */
export async function issueGateOutEir(payload = {}) {
  const res = await apiClient.post('/yard/gate-out/issue-eir', payload)
  return res.data
}

/**
 * 3. Ghi nhận xe ra cổng ra, kết thúc tính lưu bãi, phát ContainerGatedOut
 * - Chốt thời gian lưu bãi và cước phí
 * - Cảnh báo ngoại lệ phút chót nếu nhận EDoHeld
 * - Xuất hóa đơn và nhắc nhở trả vỏ về depot chỉ định
 */
export async function confirmGateOutExit(payload = {}) {
  const res = await apiClient.post('/yard/gate-out/confirm-exit', payload)
  return res.data
}

/**
 * 4. Xử lý các ngoại lệ đặc thù trong quá trình xuất bãi:
 * - CONTAINER_MISMATCH: Sai số container trên xe -> Dừng, hạ cont, lập biên bản
 * - SEAL_MISMATCH: Số chì khác dữ liệu -> Dừng, đưa vào ngoại lệ, báo hãng tàu
 * - EDO_HELD: Bị giữ phút chót -> Hạ cont về vị trí cũ, hủy giao, thông báo
 */
export async function handleGateOutException(payload = {}) {
  const res = await apiClient.post('/yard/gate-out/exception', payload)
  return res.data
}

/**
 * Đăng ký lắng nghe sự kiện Realtime cho Yard Staff:
 * - yard:outbound_requested: Tài xế check-in ở cổng cần xuất cont
 * - yard:crane_dispatched: Lệnh cẩu được gán
 * - yard:container_ready: Container đã cẩu lên xe hoàn tất
 *
 * @param {Object} handlers
 * @returns {Function} cleanup unsubscribe
 */
export function subscribeYardRealtime(handlers = {}) {
  const token = getToken()
  if (!token) return () => {}

  const {
    onOutboundRequested,
    onCraneDispatched,
    onContainerReady,
    onContainerGatedOut,
    onFlowStepUpdated,
    onConnected,
    onDisconnected,
  } = handlers

  try {
    const socket = io(getRealtimeUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    if (onConnected) socket.on('connect', onConnected)
    if (onDisconnected) socket.on('disconnect', onDisconnected)

    if (onOutboundRequested) {
      socket.on('yard:outbound_requested', onOutboundRequested)
    }
    if (onCraneDispatched) {
      socket.on('yard:crane_dispatched', onCraneDispatched)
    }
    if (onContainerReady) {
      socket.on('yard:container_ready', onContainerReady)
    }
    if (onContainerGatedOut) {
      socket.on('container:gated_out', onContainerGatedOut)
    }
    if (onFlowStepUpdated) {
      socket.on('yard:flow_step_updated', onFlowStepUpdated)
    }

    return () => {
      if (onOutboundRequested) socket.off('yard:outbound_requested', onOutboundRequested)
      if (onCraneDispatched) socket.off('yard:crane_dispatched', onCraneDispatched)
      if (onContainerReady) socket.off('yard:container_ready', onContainerReady)
      if (onContainerGatedOut) socket.off('container:gated_out', onContainerGatedOut)
      if (onFlowStepUpdated) socket.off('yard:flow_step_updated', onFlowStepUpdated)
      if (onConnected) socket.off('connect', onConnected)
      if (onDisconnected) socket.off('disconnect', onDisconnected)
      socket.disconnect()
    }
  } catch {
    return () => {}
  }
}

export default {
  getGateOutRequests,
  getGateOutRequestById,
  createLiftOrder,
  updateFlowStep,
  confirmLoadedOnTruck,
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
}
