import apiClient from './apiClient'

/**
 * Service giao tiếp với API transport trips (NXP-137).
 * Driver thực hiện toàn bộ hành trình vận chuyển container.
 */

/**
 * Lấy danh sách chuyến vận chuyển của tài xế hiện tại.
 * @param {{ status?: string, page?: number, limit?: number }} params
 */
export async function getMyTrips(params = {}) {
  const res = await apiClient.get('/driver/trips', { params })
  return res.data?.data ?? {}
}

/**
 * Lấy chi tiết 1 chuyến + lịch sử trạng thái.
 * @param {string} tripId - UUID
 */
export async function getTripById(tripId) {
  const res = await apiClient.get(`/driver/trips/${tripId}`)
  return res.data?.data ?? {}
}

/**
 * Bước 1: Tài xế xác nhận nhận chuyến (Assigned → Acknowledged).
 */
export async function acknowledgeTrip(tripId) {
  const res = await apiClient.patch(`/driver/trips/${tripId}/acknowledge`)
  return res.data
}

/**
 * Bước 2: Xác nhận đã lấy xe (Acknowledged → Vehicle Picked Up).
 */
export async function pickupVehicle(tripId, note = '') {
  const res = await apiClient.patch(`/driver/trips/${tripId}/pickup-vehicle`, { note })
  return res.data
}

/**
 * Bước 3: Xác nhận đã lấy container (Vehicle Picked Up → Container Picked Up).
 */
export async function pickupContainer(tripId, note = '') {
  const res = await apiClient.patch(`/driver/trips/${tripId}/pickup-container`, { note })
  return res.data
}

/**
 * Bước 4: Xác nhận Gate In (Container Picked Up → In Transit).
 */
export async function confirmGateIn(tripId, note = '') {
  const res = await apiClient.patch(`/driver/trips/${tripId}/gate-in`, { note })
  return res.data
}

/**
 * Bước 5: Xác nhận đã đến Yard (In Transit → Arrived at Yard).
 */
export async function confirmArrivedAtYard(tripId, note = '') {
  const res = await apiClient.patch(`/driver/trips/${tripId}/arrive-yard`, { note })
  return res.data
}

/**
 * Bước 6: Xác nhận giao container (Arrived at Yard → Container Delivered).
 */
export async function confirmContainerDelivery(tripId, payload = {}) {
  const body = typeof payload === 'string' ? { note: payload } : payload
  const res = await apiClient.patch(`/driver/trips/${tripId}/deliver-container`, body)
  return res.data
}

/**
 * Bước 7: Xác nhận Gate Out (Container Delivered → Gate Out Completed).
 */
export async function confirmGateOut(tripId, note = '') {
  const res = await apiClient.patch(`/driver/trips/${tripId}/gate-out`, { note })
  return res.data
}

/**
 * Bước 8: Xác nhận trả xe và hoàn thành chuyến (Gate Out Completed → Completed).
 */
export async function confirmVehicleReturn(tripId, note = '') {
  const res = await apiClient.patch(`/driver/trips/${tripId}/return-vehicle`, { note })
  return res.data
}
