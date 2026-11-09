import nodeApiClient from './nodeApiClient'

export const containerService = {
  getShippingLines: () => nodeApiClient.get('/containers/shipping-lines'),
  getOwnShippingLine: () => nodeApiClient.get('/containers/shipping-lines/me'),
  getShippingLineAccounts: () => nodeApiClient.get('/containers/shipping-lines/accounts'),
  saveShippingLine: (id, data) => id
    ? nodeApiClient.put(`/containers/shipping-lines/${id}`, data)
    : nodeApiClient.post('/containers/shipping-lines', data),
  getGates: () => nodeApiClient.get('/containers/gates'),
  getLegacyBookings: (containerNumber) => nodeApiClient.get('/containers/legacy-bookings', { containerNumber }),
  getLegacyOptions: (id, containerId) => nodeApiClient.get(`/containers/legacy-bookings/${id}/options`, { containerId }),
  reconcileBooking: (id, data) => nodeApiClient.post(`/containers/legacy-bookings/${id}/link`, data),
  searchAccessCarriers: (search) => nodeApiClient.get('/containers/access-carriers', { search }),
  grantVisitAccess: (id, carrierId) => nodeApiClient.post(`/containers/visits/${id}/access`, { carrierId }),
  lookup: (containerNumber) => nodeApiClient.get('/containers/lookup', { containerNumber }),
  listOwnIdentities: (params) => nodeApiClient.get('/containers/identities/mine', params),
  searchYardVisits: (params) => nodeApiClient.get('/containers/yard-visits', params),
  getOwnVisits: (id) => nodeApiClient.get(`/containers/own-visits/${id}`),
  getContainers: (params) => nodeApiClient.get('/containers', params),
  getCargoTypes: () => nodeApiClient.get('/containers/cargo-types'),
  getRegistrationIsoTypes: () => nodeApiClient.get('/containers/intake/shipping-line/iso-types'),
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
