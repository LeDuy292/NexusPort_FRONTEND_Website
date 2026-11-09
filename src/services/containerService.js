import nodeApiClient from './nodeApiClient'

export const containerService = {
  getGates: () => nodeApiClient.get('/containers/gates'),
  getLegacyBookings: (containerNumber) => nodeApiClient.get('/containers/legacy-bookings', { containerNumber }),
  getLegacyOptions: (id, containerId) => nodeApiClient.get(`/containers/legacy-bookings/${id}/options`, { containerId }),
  reconcileBooking: (id, data) => nodeApiClient.post(`/containers/legacy-bookings/${id}/link`, data),
  searchAccessCarriers: (search) => nodeApiClient.get('/containers/access-carriers', { search }),
  grantVisitAccess: (id, carrierId) => nodeApiClient.post(`/containers/visits/${id}/access`, { carrierId }),
  lookup: (containerNumber) => nodeApiClient.get('/containers/lookup', { containerNumber }),
  searchIdentities: (params) => nodeApiClient.get('/containers/identities', params),
  searchJourneys: (params) => nodeApiClient.get('/containers/journeys', params),
  getOwnVisits: (id) => nodeApiClient.get(`/containers/own-visits/${id}`),
  getContainers: (params) => nodeApiClient.get('/containers', params),
  getCargoTypes: () => nodeApiClient.get('/containers/cargo-types'),
  getContainerTypes: () => nodeApiClient.get('/containers/types'),
  getContainerById: (id) => nodeApiClient.get(`/containers/${id}`),
  getContainerStatus: (id) => nodeApiClient.get(`/containers/${id}/status`),
  getContainerStatusHistory: (id) => nodeApiClient.get(`/containers/${id}/status/history`),
  transitionContainerStatus: (id, status) =>
    nodeApiClient.post(`/containers/${id}/status/transition`, { status }),
  registerIdentity: (data) => nodeApiClient.post('/containers/intake/shipping-line/manual', data),
  getTransportDeclarations: (containerNumber) => nodeApiClient.get('/containers/intake/transport/declarations', { containerNumber }),
  getContainerImports: () => nodeApiClient.get('/containers/intake/imports'),
}
