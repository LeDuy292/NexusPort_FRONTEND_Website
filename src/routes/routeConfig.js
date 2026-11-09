/**
 * Cấu hình Route & Phân quyền Người dùng cho NexusPort
 */
export const ROLES = {
  TRANSPORT_COMPANY: 'Transport Company',
  CARRIER: 'Carrier',
  DRIVER: 'Driver',
  GATE_OFFICER: 'Gate Officer',
  DISPATCHER: 'Dispatcher',
  YARD_OPERATOR: 'Yard Operator',
  BERTH_STAFF: 'Berth Staff',
  ADMINISTRATOR: 'Administrator',
  CARRIER_STAFF: 'Carrier Staff',
  SHIPPING_LINE: 'Shipping Line'
}

export const CONTAINER_TRANSPORT_ROLES = [ROLES.TRANSPORT_COMPANY, ROLES.CARRIER, ROLES.CARRIER_STAFF]
export const YARD_VISIT_OPERATORS = [ROLES.ADMINISTRATOR, ROLES.DISPATCHER, ROLES.YARD_OPERATOR, ROLES.GATE_OFFICER]

export const routeConfig = [
  // Phân hệ Hãng tàu (Shipping Line)
  {
    path: '/shipping-line/dashboard',
    allowedRoles: [ROLES.SHIPPING_LINE, ROLES.ADMINISTRATOR],
  },
  {
    path: '/shipping-line/voyages',
    allowedRoles: [ROLES.SHIPPING_LINE, ROLES.ADMINISTRATOR],
  },
  {
    path: '/shipping-line/manifest',
    allowedRoles: [ROLES.SHIPPING_LINE],
  },
  {
    path: '/shipping-line/containers',
    allowedRoles: [ROLES.SHIPPING_LINE],
  },
  {
    path: '/shipping-line/bills-of-lading',
    allowedRoles: [ROLES.SHIPPING_LINE, ROLES.ADMINISTRATOR],
  },
  {
    path: '/shipping-line/delivery-orders',
    allowedRoles: [ROLES.SHIPPING_LINE, ROLES.ADMINISTRATOR],
  },

  // Public Routes
  {
    path: '/login',
    isPublic: true,
  },
  
  // Protected Routes
  {
    path: '/',
    allowedRoles: Object.values(ROLES),
  },
  {
    path: '/dashboard',
    allowedRoles: [ROLES.DISPATCHER, ROLES.YARD_OPERATOR, ROLES.ADMINISTRATOR],
  },
  {
    path: '/containers',
    allowedRoles: Object.values(ROLES),
  },
  {
    path: '/containers/search',
    allowedRoles: Object.values(ROLES),
  },
  {
    path: '/containers/journeys',
    allowedRoles: Object.values(ROLES),
  },
  {
    path: '/booking',
    allowedRoles: [ROLES.TRANSPORT_COMPANY, ROLES.CARRIER_STAFF],
  },
  {
    path: '/yard',
    allowedRoles: [ROLES.YARD_OPERATOR, ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/yard/map',
    allowedRoles: [ROLES.YARD_OPERATOR, ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/yard/design',
    allowedRoles: [ROLES.YARD_OPERATOR, ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/equipment-dispatch',
    allowedRoles: [ROLES.YARD_OPERATOR],
  },
  {
    path: '/yard-ops',
    allowedRoles: [ROLES.YARD_OPERATOR, ROLES.ADMINISTRATOR],
  },
  {
    path: '/yard/receiving',
    allowedRoles: [ROLES.YARD_OPERATOR, ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/yard-staff/receiving',
    allowedRoles: [ROLES.YARD_OPERATOR, ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/yard/reefer',
    allowedRoles: [ROLES.YARD_OPERATOR, ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/reefer',
    allowedRoles: [ROLES.YARD_OPERATOR, ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/berth',
    allowedRoles: [ROLES.BERTH_STAFF, ROLES.ADMINISTRATOR],
  },
  {
    path: '/dispatcher/gate-bookings',
    allowedRoles: [ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/cargo',
    allowedRoles: Object.values(ROLES),
  },
  {
    path: '/transport/cargo-declarations',
    allowedRoles: CONTAINER_TRANSPORT_ROLES,
  },
  {
    path: '/gate',
    allowedRoles: [ROLES.GATE_OFFICER],
  },
  {
    path: '/gate/dashboard',
    allowedRoles: [ROLES.GATE_OFFICER],
  },
  {
    path: '/gate/bookings',
    allowedRoles: [ROLES.GATE_OFFICER],
  },
  {
    path: '/gate/verification',
    allowedRoles: [ROLES.GATE_OFFICER],
  },
  {
    path: '/gate/incidents',
    allowedRoles: [ROLES.GATE_OFFICER],
  },
  {
    path: '/gate/history',
    allowedRoles: [ROLES.GATE_OFFICER],
  },
  {
    path: '/gate/camera',
    allowedRoles: [ROLES.GATE_OFFICER],
  },
  {
    path: '/damage-report',
    allowedRoles: [ROLES.YARD_OPERATOR, ROLES.ADMINISTRATOR],
  },
  {
    path: '/yard-staff/movement-operations',
    allowedRoles: [ROLES.YARD_OPERATOR, ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/yard-staff/gate-out-preparation',
    allowedRoles: [ROLES.YARD_OPERATOR, ROLES.ADMINISTRATOR],
  },
  {
    path: '/yard-staff/container-detail',
    allowedRoles: [ROLES.YARD_OPERATOR, ROLES.ADMINISTRATOR],
  },
  {
    path: '/berth-staff/dashboard',
    allowedRoles: [ROLES.BERTH_STAFF, ROLES.ADMINISTRATOR],
  },
  {
    path: '/berth-staff/vessel-operation-control',
    allowedRoles: [ROLES.BERTH_STAFF, ROLES.ADMINISTRATOR],
  },
  {
    path: '/berth-staff/incident-reporting',
    allowedRoles: [ROLES.BERTH_STAFF, ROLES.ADMINISTRATOR],
  },
  {
    path: '/carrier-profile',
    allowedRoles: [ROLES.TRANSPORT_COMPANY, ROLES.CARRIER_STAFF],
  },
  {
    path: '/carrier-portal',
    allowedRoles: [ROLES.TRANSPORT_COMPANY, ROLES.CARRIER_STAFF],
  },
  {
    path: '/billing',
    allowedRoles: [ROLES.TRANSPORT_COMPANY, ROLES.CARRIER_STAFF],
  },
  {
    path: '/users',
    allowedRoles: [ROLES.ADMINISTRATOR],
  },
  {
    path: '/reports',
    allowedRoles: [ROLES.ADMINISTRATOR],
  },
  {
    path: '/incidents',
    allowedRoles: [ROLES.DISPATCHER, ROLES.YARD_OPERATOR, ROLES.GATE_OFFICER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/drivers',
    allowedRoles: [ROLES.TRANSPORT_COMPANY, ROLES.CARRIER_STAFF, ROLES.ADMINISTRATOR],
  },
  {
    path: '/dispatch',
    title: 'Lệnh điều phối xe',
    allowedRoles: [ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/fleet',
    allowedRoles: [ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/container-flow',
    allowedRoles: [ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/driver-portal',
    allowedRoles: [ROLES.DRIVER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/driver-home',
    allowedRoles: [ROLES.DRIVER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/dispatcher/drivers',
    allowedRoles: [ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/dispatch-history',
    allowedRoles: [ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/dispatcher/cameras',
    allowedRoles: [ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/admin/shipping-lines',
    allowedRoles: [ROLES.ADMINISTRATOR],
  },
  {
    path: '/admin/carriers',
    allowedRoles: [ROLES.ADMINISTRATOR],
  },
  {
    path: '/admin/transport-companies',
    allowedRoles: [ROLES.ADMINISTRATOR],
  },
  {
    path: '/admin/berths',
    allowedRoles: [ROLES.ADMINISTRATOR],
  },
  {
    path: '/admin/gates',
    allowedRoles: [ROLES.ADMINISTRATOR],
  },
  {
    path: '/admin/equipment',
    allowedRoles: [ROLES.ADMINISTRATOR],
  },
  {
    path: '/admin/billing',
    allowedRoles: [ROLES.ADMINISTRATOR],
  },
]
