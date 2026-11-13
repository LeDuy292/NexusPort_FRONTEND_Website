import nodeApiClient from '../../../services/nodeApiClient';
import expressApiClient from '../../../services/expressApiClient';

const isNodeManifest = (id) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id);

export const shippingLineApi = {
  // 1. Dashboard
  getDashboard: () => expressApiClient.get('/shipping-line/dashboard'),

  // 2. Tàu & Chuyến tàu (Vessel & Voyage)
  getVessels: (search = '') => expressApiClient.get(`/shipping-line/vessels?search=${encodeURIComponent(search)}`),
  getVoyages: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return expressApiClient.get(`/shipping-line/voyages${query ? `?${query}` : ''}`);
  },
  getVoyageDetail: (id) => expressApiClient.get(`/shipping-line/voyages/${id}`),
  getCandidateBls: (voyageNumber) => expressApiClient.get(`/shipping-line/voyages/${encodeURIComponent(voyageNumber)}/candidate-bls`),
  createVoyage: (payload) => expressApiClient.post('/shipping-line/voyages', payload),
  updateVoyage: (id, payload) => expressApiClient.put(`/shipping-line/voyages/${id}`, payload),

  // 3. Bản khai Hàng hóa (Manifest)
  getManifestImportTemplate: () => nodeApiClient.get('/shipping-line/manifests/import/template'),
  previewManifestImport: (file) => {
    const form = new FormData();
    form.append('file', file);
    return nodeApiClient.postForm('/shipping-line/manifests/import/preview', form);
  },
  lookupManifestContainer: (containerNumber) => nodeApiClient.get('/shipping-line/manifests/container-lookup', { containerNumber }),
  getManifests: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const [current, legacy] = await Promise.all([nodeApiClient.get('/shipping-line/manifests', params), expressApiClient.get(`/shipping-line/manifests${query ? `?${query}` : ''}`)]);
    return [...current, ...legacy];
  },
  getManifestDetail: (id) => isNodeManifest(id) ? nodeApiClient.get(`/shipping-line/manifests/${id}`) : expressApiClient.get(`/shipping-line/manifests/${id}`),
  createManifest: (payload) => nodeApiClient.post('/shipping-line/manifests', payload),
  updateManifest: (id, payload) => nodeApiClient.put(`/shipping-line/manifests/${id}`, payload),
  recallManifest: (id) => nodeApiClient.post(`/shipping-line/manifests/${id}/recall`),
  resolveException: (manifestId, recordId, updatedData) =>
    expressApiClient.post(`/shipping-line/manifests/${manifestId}/resolve-exception`, { recordId, ...updatedData }),
  reconcileManifest: (manifestId) => expressApiClient.post(`/shipping-line/manifests/${manifestId}/reconcile`),
  sendManifestToPort: (manifestId) => isNodeManifest(manifestId) ? nodeApiClient.post(`/shipping-line/manifests/${manifestId}/send-to-port`) : expressApiClient.post(`/shipping-line/manifests/${manifestId}/send-to-port`),
  getSyncedManifests: () => expressApiClient.get('/shipping-line/manifests/port/synced'),
  lookupContainerManifest: (containerNo) => expressApiClient.get(`/shipping-line/manifests/port/lookup/${containerNo}`),

  // 4. Vận đơn (Bill of Lading - B/L) & Hướng dẫn gửi hàng (SI)
  getShippingInstructions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return expressApiClient.get(`/shipping-line/shipping-instructions${query ? `?${query}` : ''}`);
  },
  getBillsOfLading: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return expressApiClient.get(`/shipping-line/bills-of-lading${query ? `?${query}` : ''}`);
  },
  getBillOfLadingDetail: (id) => expressApiClient.get(`/shipping-line/bills-of-lading/${id}`),
  createBillOfLading: (payload) => expressApiClient.post('/shipping-line/bills-of-lading', payload),
  updateBlStatus: (id, status) => expressApiClient.patch(`/shipping-line/bills-of-lading/${id}/status`, { status }),
  collectBlFees: (id) => expressApiClient.post(`/shipping-line/bills-of-lading/${id}/collect-fees`),

  // 5. Lệnh Giao Hàng (eDO)
  getDeliveryOrders: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return expressApiClient.get(`/shipping-line/delivery-orders${query ? `?${query}` : ''}`);
  },
  getDeliveryOrderDetail: (id) => expressApiClient.get(`/shipping-line/delivery-orders/${id}`),
  checkEdoEligibility: (blNumber) => expressApiClient.get(`/shipping-line/delivery-orders/eligibility/${encodeURIComponent(blNumber)}`),
  collectFees: (blNumber) => expressApiClient.post('/shipping-line/delivery-orders/collect-fees', { blNumber }),
  surrenderBl: (blNumber) => expressApiClient.post('/shipping-line/delivery-orders/surrender-bl', { blNumber }),
  issueEdo: (payload) => expressApiClient.post('/shipping-line/delivery-orders/issue', payload),
  extendEdo: (id, validUntil, reason) => expressApiClient.post(`/shipping-line/delivery-orders/${id}/extend`, { validUntil, reason }),
  cancelEdo: (id, reason) => expressApiClient.post(`/shipping-line/delivery-orders/${id}/cancel`, { reason }),

  // 6. Khôi phục / Nạp dữ liệu mẫu (Seed Data)
  resetSeedData: () => expressApiClient.post('/shipping-line/seed/reset'),
};

export function formatApiErrorMessage(err, defaultMsg = 'Đã xảy ra lỗi khi xử lý dữ liệu. Vui lòng thử lại.') {
  if (!err) return defaultMsg;
  const msg = typeof err === 'string' ? err : err.message || '';
  
  // Lọc bỏ triệt để các chuỗi kỹ thuật backend, router, network hoặc stack trace
  if (!msg || /Failed to fetch|NetworkError|ECONNREFUSED|Endpoint không tồn tại|HTTP\s*\d+|Internal server error|Sequelize|at\s+[\w\.]+/i.test(msg)) {
    return defaultMsg;
  }
  
  // Làm sạch tiền tố hệ thống để giữ lại thông báo nghiệp vụ thân thiện
  const cleanMsg = msg
    .replace(/^Error:\s*/i, '')
    .replace(/^\[.*?\]\s*/i, '')
    .replace(/^TỪ CHỐI PHÁT HÀNH eDO:\s*/i, '')
    .trim();
    
  return cleanMsg || defaultMsg;
}

