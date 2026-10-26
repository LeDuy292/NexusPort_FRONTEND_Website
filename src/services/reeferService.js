import nodeApiClient from './nodeApiClient';
import apiClient from './apiClient';

export const reeferService = {
  // KPI Overview
  getOverview: () => nodeApiClient.get('/reefer/overview'),
  getEligibleContainers: () => nodeApiClient.get('/reefer/eligible-containers'),

  // Plugs & Power Units
  getPlugs: (params) => nodeApiClient.get('/reefer/plugs', params),
  getPlugById: (id) => nodeApiClient.get(`/reefer/plugs/${id}`),
  createPlug: (data) => nodeApiClient.post('/reefer/plugs', data),
  togglePlugPower: (id, is_power_on) =>
    nodeApiClient.post(`/reefer/plugs/${id}/power-toggle`, { is_power_on }),
  updatePlugStatus: (id, technical_status) =>
    nodeApiClient.patch(`/reefer/plugs/${id}/technical-status`, { technical_status }),
  autoAllocatePlug: (data) => nodeApiClient.post('/reefer/auto-allocate', data),

  // Power Requests
  getRequests: (params) => nodeApiClient.get('/reefer/requests', params),
  getRequestById: (id) => nodeApiClient.get(`/reefer/requests/${id}`),
  createRequest: (data) => nodeApiClient.post('/reefer/requests', data),
  cancelRequest: (id, reason) => nodeApiClient.post(`/reefer/requests/${id}/cancel`, { reason }),

  // Sessions
  getSessions: (params) => nodeApiClient.get('/reefer/sessions', params),
  getSessionById: (id) => nodeApiClient.get(`/reefer/sessions/${id}`),
  assignPlug: (data) => nodeApiClient.post('/reefer/sessions/assign', data),
  confirmPower: (sessionId, initial_temperature) =>
    nodeApiClient.post(`/reefer/sessions/${sessionId}/confirm-power`, { initial_temperature }),
  terminateSession: (sessionId, reason) =>
    nodeApiClient.post(`/reefer/sessions/${sessionId}/terminate`, { reason }),
  cancelReservation: (sessionId, reason) =>
    nodeApiClient.post(`/reefer/sessions/${sessionId}/cancel-reservation`, { reason }),
  transferPlug: (sessionId, new_plug_id, reason) =>
    nodeApiClient.post(`/reefer/sessions/${sessionId}/transfer`, { new_plug_id, reason }),

  // Temperature
  recordTemperature: (sessionId, data) =>
    nodeApiClient.post(`/reefer/sessions/${sessionId}/temperature`, data),
  getTemperatureHistory: (sessionId) =>
    nodeApiClient.get(`/reefer/sessions/${sessionId}/temperature-history`),

  // Alerts
  getAlerts: (params) => nodeApiClient.get('/reefer/alerts', params),
  acknowledgeAlert: async (id) => {
    const p1 = nodeApiClient.post(`/reefer/alerts/${id}/acknowledge`).catch(() => null);
    const p2 = apiClient.post(`/v1/reefer/monitoring/alerts/${id}/acknowledge`).catch(() => null);
    await Promise.allSettled([p1, p2]);
    return { success: true };
  },
  resolveAlert: async (id, notes) => {
    const p1 = nodeApiClient.post(`/reefer/alerts/${id}/resolve`, { notes }).catch(() => null);
    const p2 = apiClient.post(`/v1/reefer/monitoring/alerts/${id}/resolve`, { notes }).catch(() => null);
    await Promise.allSettled([p1, p2]);
    return { success: true };
  },

  // .NET 8 Monitoring & Simulator APIs
  getMonitoringOverview: () => apiClient.get('/v1/reefer/monitoring/overview').then(res => res.data?.data || res.data),
  getSessionMonitoringHistory: (sessionId) => apiClient.get(`/v1/reefer/monitoring/sessions/${sessionId}/history`).then(res => res.data?.data || res.data),
  getMonitoringAlerts: (params) => apiClient.get('/v1/reefer/monitoring/alerts', { params }).then(res => res.data?.data || res.data),
  setDemoScenario: (scenario, sessionId = null, customTemperature = null) =>
    apiClient.post('/v1/reefer/monitoring/simulator/scenario', { scenario, sessionId, customTemperature }),
  triggerSimulatorTick: () => apiClient.post('/v1/reefer/monitoring/simulator/tick'),
};

export default reeferService;
