import apiClient from './apiClient';

const YARD_DISCHARGE_BASE = '/v1/VesselDischarge';

export const yardDischargeService = {
  // Lấy danh sách các kế hoạch dỡ tàu hàng nhập
  getPlans: async () => {
    const response = await apiClient.get(`${YARD_DISCHARGE_BASE}/plans`);
    return response.data;
  },

  // Lấy chi tiết kế hoạch dỡ tàu theo ManifestId
  getPlanById: async (manifestId) => {
    const response = await apiClient.get(`${YARD_DISCHARGE_BASE}/plan/${manifestId}`);
    return response.data;
  },

  // Kích hoạt thuật toán tính toán và đặt trước vị trí bãi (Pre-allocation)
  preAllocate: async (manifestId, berthCode = 'B-01') => {
    const response = await apiClient.post(`${YARD_DISCHARGE_BASE}/pre-allocate/${manifestId}`, {
      manifestId,
      berthCode,
    });
    return response.data;
  },

  // Quét Tally cầu tàu hoặc xác nhận hạ bãi RTG (Hỗ trợ đính kèm ảnh chụp hư hỏng)
  tallyScan: async ({ containerNumber, condition = 'GOOD', notes = '', actualSlot = null, confirmPutdown = false, damagePhotos = [] }) => {
    const response = await apiClient.post(`${YARD_DISCHARGE_BASE}/tally-scan`, {
      containerNumber,
      condition,
      notes,
      actualSlot,
      confirmPutdown,
      damagePhotos,
    });
    return response.data;
  },

  // Điều độ viên ghi đè vị trí bãi thủ công (Manual Override)
  overrideSlot: async ({ manifestId, containerNumber, newSlotCoordinate, reason }) => {
    const response = await apiClient.post(`${YARD_DISCHARGE_BASE}/override-slot`, {
      manifestId,
      containerNumber,
      newSlotCoordinate,
      reason,
    });
    return response.data;
  },
};

export default yardDischargeService;
