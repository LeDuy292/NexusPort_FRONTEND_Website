/**
 * Cấu hình Route & Phân quyền Người dùng cho NexusPort
 */
export const ROLES = {
  TRANSPORT_COMPANY: 'Transport Company',
  DRIVER: 'Driver',
  GATE_OFFICER: 'Gate Officer',
  DISPATCHER: 'Dispatcher',
  YARD_OPERATOR: 'Yard Operator',
  BERTH_STAFF: 'Berth Staff',
  ADMINISTRATOR: 'Administrator'
}

export const routeConfig = [
  // Public Routes
  {
    path: '/login',
    isPublic: true,
  },
  
  // Protected Routes
  {
    path: '/',
    allowedRoles: Object.values(ROLES), // Tất cả các vai trò sau khi đăng nhập đều truy cập được trang Landing điều hướng
  },
  {
    path: '/dashboard',
    allowedRoles: [ROLES.DISPATCHER, ROLES.YARD_OPERATOR, ROLES.ADMINISTRATOR],
  },
  {
    path: '/containers',
    allowedRoles: [ROLES.DISPATCHER, ROLES.YARD_OPERATOR, ROLES.GATE_OFFICER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/booking',
    allowedRoles: [ROLES.TRANSPORT_COMPANY],
  },
  {
    path: '/yard',
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
    path: '/berth',
    allowedRoles: [ROLES.BERTH_STAFF, ROLES.ADMINISTRATOR],
  },
  {
    path: '/dispatcher/gate-bookings',
    allowedRoles: [ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/cargo',
    allowedRoles: [ROLES.TRANSPORT_COMPANY, ROLES.ADMINISTRATOR],
  },
  {
    path: '/transport/cargo-declarations',
    allowedRoles: [ROLES.TRANSPORT_COMPANY, ROLES.ADMINISTRATOR],
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
    path: '/gate/container',
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
    allowedRoles: [ROLES.YARD_OPERATOR, ROLES.GATE_OFFICER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/yard-staff/inventory-inspection',
    allowedRoles: [ROLES.YARD_OPERATOR, ROLES.ADMINISTRATOR],
  },
  {
    path: '/yard-staff/movement-operations',
    allowedRoles: [ROLES.YARD_OPERATOR, ROLES.ADMINISTRATOR],
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
    allowedRoles: [ROLES.TRANSPORT_COMPANY],
  },
  {
    path: '/carrier-portal',
    allowedRoles: [ROLES.TRANSPORT_COMPANY],
  },
  {
    path: '/billing',
    allowedRoles: [ROLES.TRANSPORT_COMPANY],
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
    allowedRoles: [ROLES.TRANSPORT_COMPANY, ROLES.ADMINISTRATOR],
  },
  {
    path: '/dispatch',
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
    path: '/vessel-schedule',
    allowedRoles: [ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/berth-assignment',
    allowedRoles: [ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
  },
  {
    path: '/vessel-operation-plan',
    allowedRoles: [ROLES.DISPATCHER, ROLES.ADMINISTRATOR],
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
