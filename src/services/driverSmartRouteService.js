import nodeApiClient from './nodeApiClient'

const withTimeout = (request) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Dịch vụ điều hướng phản hồi quá lâu. Vui lòng thử lại.')), 12000)
  request.then(resolve, reject).finally(() => clearTimeout(timer))
})

export const driverSmartRouteService = {
  list: () => withTimeout(nodeApiClient.get('/drivers/me/routes')),
  get: (containerId, currentNodeId, bookingId) => withTimeout(nodeApiClient.get(
    `/drivers/me/routes/${encodeURIComponent(containerId)}`,
    { currentNodeId, bookingId },
  )),
  arrive: (containerId, bookingId, currentNodeId) => withTimeout(nodeApiClient.post(
    `/drivers/me/routes/${encodeURIComponent(containerId)}/progress`, { bookingId, action: 'arrive', currentNodeId },
  )),
  confirmContainer: (containerId, bookingId, condition = 'OK', notes = '') => withTimeout(nodeApiClient.post(
    `/drivers/me/routes/${encodeURIComponent(containerId)}/confirm-container`, { bookingId, condition, notes },
  )),
  monitor: () => withTimeout(nodeApiClient.get('/dispatcher/smart-routes')),
  updateCondition: (condition) => withTimeout(nodeApiClient.put('/dispatcher/smart-routes/conditions', condition)),
  gateLocations: () => withTimeout(nodeApiClient.get('/gate/locations')),
}
