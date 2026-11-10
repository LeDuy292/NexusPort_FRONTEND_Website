import apiClient from './apiClient';

const BASE_URL = '/cargo-notifications';

export const cargoNotificationService = {
  // Lấy danh sách thông báo
  getNotifications: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.priority) query.append('priority', params.priority);
    if (params.direction) query.append('direction', params.direction);
    if (params.isRead !== undefined) query.append('isRead', params.isRead);
    if (params.limit) query.append('limit', params.limit);
    if (params.offset) query.append('offset', params.offset);
    if (params.companyId) query.append('companyId', params.companyId);
    if (params.taxCode) query.append('taxCode', params.taxCode);

    const res = await apiClient.get(`${BASE_URL}?${query.toString()}`);
    return res.data || res;
  },

  // Đếm số thông báo chưa đọc
  getUnreadCount: async () => {
    const res = await apiClient.get(`${BASE_URL}/unread-count`);
    return res.data?.data || res.data || res;
  },

  // Đánh dấu 1 thông báo đã đọc
  markAsRead: async (id) => {
    const res = await apiClient.put(`${BASE_URL}/${id}/read`);
    return res.data || res;
  },

  // Đánh dấu tất cả đã đọc
  markAllAsRead: async (payload = {}) => {
    const res = await apiClient.put(`${BASE_URL}/read-all`, payload);
    return res.data || res;
  },

  // Lấy danh sách việc cần làm (To-Do & Action Items)
  getTodoList: async (type = 'all') => {
    const res = await apiClient.get(`${BASE_URL}/todo?type=${type}`);
    return res.data || res;
  },

  // Danh sách chứng từ theo dõi (EIR, e-D/O, B/L, Arrival Notice, Booking)
  getDocuments: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.type) query.append('type', params.type);
    if (params.search) query.append('search', params.search);
    if (params.limit) query.append('limit', params.limit || 30);
    if (params.offset) query.append('offset', params.offset || 0);

    const res = await apiClient.get(`${BASE_URL}/documents?${query.toString()}`);
    return res.data || res;
  },

  // Xem chi tiết chứng từ (EIR, e-D/O, B/L, Arrival Notice, Booking)
  getDocumentDetail: async (type, id) => {
    const res = await apiClient.get(`${BASE_URL}/documents/${encodeURIComponent(type)}/${encodeURIComponent(id)}`);
    return res.data?.data || res.data || res;
  },

  // Bắn sự kiện mô phỏng từ Hãng tàu, Người 2, Người 3 (dành cho demo kịch bản)
  ingestEvent: async (eventData) => {
    const res = await apiClient.post(`${BASE_URL}/events/ingest`, eventData);
    return res.data || res;
  },

  // Lấy danh sách hàng đợi ngoại lệ: Người nhận chưa có tài khoản
  getUnclaimedConsignees: async () => {
    const res = await apiClient.get(`${BASE_URL}/unclaimed-consignees`);
    return res.data?.data || res.data || res;
  },

  // Gán người nhận cho chứng từ trong hàng đợi ngoại lệ
  claimConsignee: async (queueId, companyId) => {
    const res = await apiClient.post(`${BASE_URL}/unclaimed-consignees/${queueId}/claim`, { companyId });
    return res.data || res;
  },
};

export default cargoNotificationService;
