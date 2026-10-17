import nodeApiClient from './nodeApiClient'

export const containerService = {
  getGates: () => nodeApiClient.get('/containers/gates'),
  getLegacyBookings: (containerNumber) => nodeApiClient.get('/containers/legacy-bookings', { containerNumber }),
  getLegacyOptions: (id, containerId) => nodeApiClient.get(`/containers/legacy-bookings/${id}/options`, { containerId }),
  reconcileBooking: (id, data) => nodeApiClient.post(`/containers/legacy-bookings/${id}/link`, data),
  searchAccessCarriers: (search) => nodeApiClient.get('/containers/access-carriers', { search }),
  grantVisitAccess: (id, carrierId) => nodeApiClient.post(`/containers/visits/${id}/access`, { carrierId }),
  lookup: (containerNumber) => nodeApiClient.get('/containers/lookup', { containerNumber }),
  searchJourneys: (params) => nodeApiClient.get('/containers/journeys', params),
  getOwnVisits: (id) => nodeApiClient.get(`/containers/own-visits/${id}`),
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
  getTransportDeclarations: (containerNumber) => nodeApiClient.get('/containers/intake/transport/declarations', { containerNumber }),
  getContainerImports: () => nodeApiClient.get('/containers/intake/imports'),
}
