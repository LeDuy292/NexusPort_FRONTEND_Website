import { driverSmartRouteService } from './driverSmartRouteService'

export const driverContainerConfirmationService = {
  async getAssignedOperations() {
    const routes = await driverSmartRouteService.list()
    return (Array.isArray(routes) ? routes : []).filter(route => route.journey?.canConfirmContainer)
      .map(route => ({ ...route, operationStatus: route.operation?.status, containerStatus: route.journey?.phase === 'ready_for_gate_out' ? 'ReadyForGateOut' : undefined }))
  },

  async confirmContainer(bookingId, containerId, condition = 'OK', notes = '') {
    const route = await driverSmartRouteService.confirmContainer(containerId, bookingId, condition, notes)
    return { ...route, containerStatus: route.journey?.phase === 'ready_for_gate_out' ? 'ReadyForGateOut' : undefined }
  }
}

export default driverContainerConfirmationService
