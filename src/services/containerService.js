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
  createPortIntake: (data) => nodeApiClient.post('/containers/intake/port/manual', data),
  createTransportIntake: (data) => nodeApiClient.post('/containers/intake/transport/manual', data),
  importPortContainers: (file) => {
    const body = new FormData()
    body.append('file', file)
    return nodeApiClient.postForm('/containers/intake/port/import', body)
  },
  importTransportContainers: (file) => {
    const body = new FormData()
    body.append('file', file)
    return nodeApiClient.postForm('/containers/intake/transport/import', body)
  },
  getTransportDeclarations: () => nodeApiClient.get('/containers/intake/transport/declarations'),
  getContainerImports: () => nodeApiClient.get('/containers/intake/imports'),
}
