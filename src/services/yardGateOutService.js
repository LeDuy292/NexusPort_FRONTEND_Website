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
 * Lấy danh sách yêu cầu xuất container bãi.
 * @param {{ status?: string, search?: string, urgency?: string, page?: number, limit?: number }} params
 */
export async function getGateOutRequests(params = {}) {
  const res = await apiClient.get('/yard/gate-out-requests', { params })
  return res.data?.data ?? []
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

    return () => {
      if (onOutboundRequested) socket.off('yard:outbound_requested', onOutboundRequested)
      if (onCraneDispatched) socket.off('yard:crane_dispatched', onCraneDispatched)
      if (onContainerReady) socket.off('yard:container_ready', onContainerReady)
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
  subscribeYardRealtime,
}
