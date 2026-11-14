// Explicit UI examples only. Non-UUID IDs cannot be accepted by the C# API.
// The wizard never saves or confirms these examples.
export function createServiceDraftSamples() {
  const now = Date.now()
  const at = days => new Date(now + days * 86400000).toISOString()
  const bookings = [
    { id: 'sample-booking-dry', bookingNumber: 'MAU-EXP-001', vesselName: 'NEXUS DEMO ONE', voyageNumber: 'DEMO-001E', receiveFrom: at(-1), cyCutoff: at(5), etd: at(6), containerCount: 2 },
    { id: 'sample-booking-reefer', bookingNumber: 'MAU-EXP-002', vesselName: 'NEXUS DEMO REEFER', voyageNumber: 'DEMO-002E', receiveFrom: at(-1), cyCutoff: at(7), etd: at(8), containerCount: 2 },
    { id: 'sample-booking-special', bookingNumber: 'MAU-EXP-003', vesselName: 'NEXUS DEMO PACIFIC', voyageNumber: 'DEMO-003E', receiveFrom: at(-1), cyCutoff: at(10), etd: at(11), containerCount: 2 },
  ]
  const make = (id, containerNumber, typeCode, cargoType, vgmKg, extra = {}) => ({ sourceContainerId: `sample-container-${id}`, containerId: `sample-physical-${id}`, containerNumber, typeCode, cargoType, vgmKg, sealNumber: `MAU-SEAL-${id}`, loadStatus: 'full', ...extra })
  const containers = {
    'sample-booking-dry': [make(1, 'NXPU9990011', '22G1', 'general', 21500), make(2, 'NXPU9990027', '42G1', 'general', 27800)],
    'sample-booking-reefer': [make(3, 'NXPU9990032', '22R1', 'reefer', 22400, { targetTemperature: -18 }), make(4, 'NXPU9990048', '45R1', 'reefer', 28100, { targetTemperature: 4 })],
    'sample-booking-special': [make(5, 'NXPU9990053', '22G1', 'dangerous', 18900), make(6, 'NXPU9990069', 'L5G1', 'general', 26300)],
  }
  return { bookings, containers }
}
