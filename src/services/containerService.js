import nodeApiClient from './nodeApiClient'

export const containerService = {
  getContainers: (params) => nodeApiClient.get('/containers', params),
  getContainerTypes: () => nodeApiClient.get('/containers/types'),
  getContainerById: (id) => nodeApiClient.get(`/containers/${id}`),
  createContainer: (data) => nodeApiClient.post('/containers', data),
  updateContainer: (id, data) => nodeApiClient.put(`/containers/${id}`, data),
  deleteContainer: (id) => nodeApiClient.delete(`/containers/${id}`),
  getContainerStatus: (id) => nodeApiClient.get(`/containers/${id}/status`),
  getContainerStatusHistory: (id) => nodeApiClient.get(`/containers/${id}/status/history`),
  transitionContainerStatus: (id, status) =>
    nodeApiClient.post(`/containers/${id}/status/transition`, { status }),
}
