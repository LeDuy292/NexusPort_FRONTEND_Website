import nodeApiClient from './nodeApiClient'

export const containerService = {
  getContainers: (params) => nodeApiClient.get('/containers', params),
  getContainerTypes: () => nodeApiClient.get('/containers/types'),
  getContainerById: (id) => nodeApiClient.get(`/containers/${id}`),
  createContainer: (data) => nodeApiClient.post('/containers', data),
  updateContainer: (id, data) => nodeApiClient.put(`/containers/${id}`, data),
  deleteContainer: (id) => nodeApiClient.delete(`/containers/${id}`),
}
