import nodeApiClient from './nodeApiClient'

const withTimeout = (request) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Dịch vụ điều hướng phản hồi quá lâu. Vui lòng thử lại.')), 12000)
  request.then(resolve, reject).finally(() => clearTimeout(timer))
})

export const driverSmartRouteService = {
  list: () => withTimeout(nodeApiClient.get('/drivers/me/routes')),
  get: (containerId, currentNodeId) => withTimeout(nodeApiClient.get(
    `/drivers/me/routes/${encodeURIComponent(containerId)}`,
    currentNodeId ? { currentNodeId } : undefined,
  )),
}
