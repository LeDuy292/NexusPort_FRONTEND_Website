import nodeApiClient from './nodeApiClient'

export const containerService = {
  downloadTransportTemplate: async () => {
    const blob = await nodeApiClient.get('/containers/intake/transport/template')
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'Mau_Khai_Bao_Container.xlsx'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
  getContainers: (params) => nodeApiClient.get('/containers', params),
  getCargoTypes: () => nodeApiClient.get('/containers/cargo-types'),
  getContainerTypes: () => nodeApiClient.get('/containers/types'),
  getContainerById: (id) => nodeApiClient.get(`/containers/${id}`),
  getContainerStatus: (id) => nodeApiClient.get(`/containers/${id}/status`),
  getContainerStatusHistory: (id) => nodeApiClient.get(`/containers/${id}/status/history`),
  transitionContainerStatus: (id, status) =>
    nodeApiClient.post(`/containers/${id}/status/transition`, { status }),
  createTransportIntake: (data) => nodeApiClient.post('/containers/intake/transport/manual', data),
  importTransportContainers: (file) => {
    const body = new FormData()
    body.append('file', file)
    return nodeApiClient.postForm('/containers/intake/transport/import', body)
  },
  getTransportDeclarations: () => nodeApiClient.get('/containers/intake/transport/declarations'),
  getContainerImports: () => nodeApiClient.get('/containers/intake/imports'),
}
