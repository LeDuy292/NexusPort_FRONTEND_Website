import { lazy, Suspense } from 'react'
import ActivateAccount from './pages/Auth/ActivateAccount'
import LandingPage from './pages/Landing/LandingPage'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './routes/ProtectedRoute'
import RoleRoute from './routes/RoleRoute'
import { CONTAINER_TRANSPORT_ROLES, ROLES, YARD_VISIT_READERS } from './routes/routeConfig'
import MainLayout from './layouts/MainLayout'
import SessionListener from './components/SessionListener'
import ErrorBoundary from './components/ErrorBoundary'

// Import các trang đã di chuyển
const BerthOps = lazy(() => import('./pages/Ships/BerthOps'))
const CargoDeclaration = lazy(() => import('./pages/Containers/CargoDeclaration'))
const DamageReport = lazy(() => import('./pages/Containers/DamageReport'))
const ContainerManagement = lazy(() => import('./pages/Containers/ContainerManagement'))
const ContainerRegistration = lazy(() => import('./pages/ShippingLine/ContainerRegistration'))
const ShippingLineDirectory = lazy(() => import('./pages/Admin/ShippingLineDirectory'))
const EquipmentDispatch = lazy(() => import('./pages/Dispatch/EquipmentDispatch'))

// Import các trang hệ thống
import Login from './pages/Auth/Login'
import Unauthorized from './pages/Auth/Unauthorized'
const OperatorDashboard = lazy(() => import('./pages/Dashboard/OperatorDashboard'))
const BookingManagement = lazy(() => import('./pages/Booking/BookingManagement'))
const YardDesignPreview = lazy(() => import('./pages/Yard/YardDesignPreview'))
const UserRoleManagement = lazy(() => import('./pages/Users/UserRoleManagement'))
const CarrierPortal = lazy(() => import('./pages/Carrier/CarrierPortal'))
const CarrierStaffManagement = lazy(() => import('./pages/Carrier/CarrierStaffManagement'))
const DashboardIndex = lazy(() => import('./pages/Dashboard/DashboardIndex'))
const GateControl = lazy(() => import('./pages/Gate/GateControl'))
const GateDashboard = lazy(() => import('./pages/Gate/GateDashboard'))
const GateBookings = lazy(() => import('./pages/Gate/GateBookings'))
const GateVerification = lazy(() => import('./pages/Gate/GateVerification'))
const ContainerVerification = lazy(() => import('./pages/Gate/ContainerVerification'))
const GateIncidents = lazy(() => import('./pages/Gate/GateIncidents'))
const GateHistory = lazy(() => import('./pages/Gate/GateHistory'))
const GateCameras = lazy(() => import('./pages/Gate/GateCameras'))
const ReportsAnalytics = lazy(() => import('./pages/Reports/ReportsAnalytics'))
const IncidentManagement = lazy(() => import('./pages/Incident/IncidentManagement'))
const DriverManagement = lazy(() => import('./pages/Carrier/DriverManagement'))
const YardOperations = lazy(() => import('./pages/Yard/YardOperations'))
const YardOperationsDashboard = lazy(() => import('./pages/Yard/YardOperationsDashboard'))
const YardMovementOperations = lazy(() => import('./pages/Yard/YardMovementOperations'))
const ContainerGateOutPreparation = lazy(() => import('./pages/Yard/ContainerGateOutPreparation'))
const ContainerDetail = lazy(() => import('./pages/Yard/ContainerDetail'))
const YardReceiving = lazy(() => import('./pages/Yard/YardReceiving'))
const ReeferManagement = lazy(() => import('./pages/Yard/ReeferManagement'))
const DriverPortalContainer = lazy(() => import('./pages/Driver/DriverPortalContainer'))

// Import các trang Dispatcher Control Center
const VehicleDispatch = lazy(() => import('./pages/Dispatch/VehicleDispatch'))
const VehicleManagement = lazy(() => import('./pages/Fleet/VehicleManagement'))
const ContainerFlow = lazy(() => import('./pages/Containers/ContainerFlow'))
const DispatcherDriverManagement = lazy(() => import('./pages/Drivers/DriverManagement'))
const DispatchHistory = lazy(() => import('./pages/Dispatch/DispatchHistory'))
const YardIncidents = lazy(() => import('./pages/Dispatch/YardIncidents'))
const CameraMonitoring = lazy(() => import('./pages/Camera/CameraMonitoring'))
const GateBookingRequests = lazy(() => import('./pages/Dispatch/GateBookingRequests'))

// Import các trang Admin Portal
const CarrierManagement = lazy(() => import('./pages/Admin/CarrierManagement'))
const TransportCompanyManagement = lazy(() => import('./pages/Admin/TransportCompanyManagement'))
const GateManagement = lazy(() => import('./pages/Admin/GateManagement'))
const EquipmentManagement = lazy(() => import('./pages/Admin/EquipmentManagement'))
const BillingChargesManagement = lazy(() => import('./pages/Admin/BillingChargesManagement'))

// Import phân hệ Hãng tàu (Shipping Line)
const ShippingDashboard = lazy(() => import('./pages/ShippingLine/ShippingDashboard'))
const VesselVoyagePage = lazy(() => import('./pages/ShippingLine/VesselVoyagePage'))
const ManifestManagementPage = lazy(() => import('./pages/ShippingLine/ManifestManagementPage'))
const DeliveryOrderPage = lazy(() => import('./pages/ShippingLine/DeliveryOrderPage'))
const ImportDocumentsPage = lazy(() => import('./pages/ShippingLine/ImportDocumentsPage'))
const ImportDocumentsCompanyPage = lazy(() => import('./pages/Booking/ImportDocumentsCompanyPage'))
const MyBillsPage = lazy(() => import('./pages/Booking/MyBillsPage'))
const ServiceCatalogPage = lazy(() => import('./features/service-catalog/ServiceCatalogPage'))

// Component chuyển hướng trang chủ dựa trên vai trò (Role-based Home Redirect)
function HomeRedirect() {
  const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user')
  let user = null
  try {
    user = storedUser ? JSON.parse(storedUser) : null
  } catch {
    user = null
  }

  if (!user || !user.role) return <Navigate to="/login" replace />

  const role = (user.role || '').trim().toLowerCase()
  if (role === 'transport company' || role === 'carrier' || role === 'carrier staff') {
    return <Navigate to="/carrier-portal" replace />
  }
  if (role === 'driver') {
    return <Navigate to="/driver-portal" replace />
  }
  if (role === 'gate officer' || role === 'gate') {
    return <Navigate to="/gate" replace />
  }
  if (role === 'dispatcher' || role === 'operator') {
    return <Navigate to="/dashboard" replace />
  }
  if (role === 'yard operator' || role === 'yard staff' || role === 'yard') {
    return <Navigate to="/yard-staff/dashboard" replace />
  }
  if (role === 'shipping line' || role === 'shipping') {
    return <Navigate to="/shipping-line/dashboard" replace />
  }
  if (role === 'administrator' || role === 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <Navigate to="/unauthorized" replace />
}

function RootRoute() {
  const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user')
  let user = null
  try {
    user = storedUser ? JSON.parse(storedUser) : null
  } catch {
    user = null
  }

  if (!user || !user.role) return <LandingPage />
  return <HomeRedirect />
}

function App() {
  return (
    <ErrorBoundary>
      <SessionListener />
      <Suspense fallback={<div className="p-8 text-sm text-slate-500">Đang tải…</div>}>
      <Routes>
        {/* Route Công khai */}
        <Route path="/" element={<RootRoute />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/activate-account" element={<ActivateAccount />} />
        {import.meta.env.DEV && <Route element={<MainLayout previewUser={{username:'Bản xem trước',role:ROLES.DISPATCHER}} />}><Route path="/preview/yard" element={<YardDesignPreview previewOnly />} /></Route>}

        {/* Tuyến đường được Bảo vệ (Yêu cầu Đăng nhập) */}
        <Route element={<ProtectedRoute />}>

        {/* Trang báo lỗi không có quyền truy cập (Fullscreen) */}
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Toàn bộ các trang quản trị dùng chung cấu trúc Sidebar thông qua MainLayout */}
        <Route element={<MainLayout />}>
          <Route path="/service-orders" element={<Navigate to="/services" replace />} />
          <Route element={<RoleRoute allowedRoles={[ROLES.TRANSPORT_COMPANY, ROLES.CARRIER_STAFF, ROLES.ADMINISTRATOR]} />}>
            <Route path="/services" element={<ServiceCatalogPage />} />
          </Route>
          <Route element={<RoleRoute allowedRoles={[ROLES.ADMINISTRATOR]} />}>
            <Route path="/admin/service-catalog" element={<ServiceCatalogPage management />} />
          </Route>
          <Route element={<RoleRoute allowedRoles={YARD_VISIT_READERS} />}>
            <Route path="/containers" element={<ContainerManagement />} />
          </Route>
          <Route element={<RoleRoute allowedRoles={[ROLES.TRANSPORT_COMPANY, ROLES.CARRIER_STAFF, ROLES.YARD_OPERATOR, ROLES.DISPATCHER, ROLES.ADMINISTRATOR]} />}>
            <Route path="/container-intake" element={<Navigate to="/containers" replace />} />
            <Route path="/cargo" element={<Navigate to="/containers" replace />} />
          </Route>

          <Route element={<RoleRoute allowedRoles={CONTAINER_TRANSPORT_ROLES} />}>
            <Route path="/transport/cargo-declarations" element={<CargoDeclaration />} />
          </Route>
          
          {/* 1. Nhóm Doanh nghiệp vận tải (Transport Company) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.TRANSPORT_COMPANY, ROLES.CARRIER_STAFF, ROLES.ADMINISTRATOR]} />}>
            <Route path="/carrier-portal" element={<CarrierPortal />} />
            <Route path="/booking" element={<BookingManagement />} />
            <Route path="/fleet" element={<VehicleManagement />} />
            <Route path="/drivers" element={<DriverManagement />} />
            <Route path="/carrier-staff" element={<CarrierStaffManagement />} />
          </Route>

          {/* 2. Nhóm Điều độ (Dispatcher) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.DISPATCHER, ROLES.TRANSPORT_COMPANY, ROLES.CARRIER_STAFF, ROLES.ADMINISTRATOR]} />}>
            <Route path="/dispatch" element={<VehicleDispatch />} />
          </Route>
          <Route element={<RoleRoute allowedRoles={[ROLES.DISPATCHER, ROLES.ADMINISTRATOR]} />}>
            <Route path="/dispatcher/yard-discharge" element={<YardOperationsDashboard />} />
            <Route path="/dispatcher/gate-bookings" element={<GateBookingRequests />} />
            <Route path="/dispatch/gate-bookings" element={<Navigate to="/dispatcher/gate-bookings" replace />} />
            <Route path="/fleet" element={<VehicleManagement />} />
            <Route path="/container-flow" element={<ContainerFlow />} />
            <Route path="/dispatcher/drivers" element={<DispatcherDriverManagement />} />
            <Route path="/dispatch-history" element={<DispatchHistory />} />
            <Route path="/dispatcher/yard-incidents" element={<YardIncidents />} />
            <Route path="/dispatcher/cameras" element={<CameraMonitoring />} />
          </Route>


          {/* Phân hệ Hãng tàu (Shipping Line) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.SHIPPING_LINE]} />}>
            <Route path="/shipping-line/containers" element={<ContainerRegistration />} />
            <Route path="/shipping-line/manifest" element={<ManifestManagementPage />} />
            <Route path="/shipping-line/import-documents" element={<ImportDocumentsPage />} />
          </Route>
          <Route element={<RoleRoute allowedRoles={[ROLES.TRANSPORT_COMPANY, ROLES.CARRIER_STAFF]} />}>
            <Route path="/import-documents" element={<ImportDocumentsCompanyPage />} />
            <Route path="/my-bills" element={<MyBillsPage />} />
          </Route>
          <Route element={<RoleRoute allowedRoles={[ROLES.SHIPPING_LINE, ROLES.ADMINISTRATOR]} />}>
            <Route path="/shipping-line" element={<Navigate to="/shipping-line/dashboard" replace />} />
            <Route path="/shipping-line/dashboard" element={<ShippingDashboard />} />
            <Route path="/shipping-line/voyages" element={<VesselVoyagePage />} />
            <Route path="/shipping-line/bills-of-lading" element={<Navigate to="/shipping-line/manifest" replace />} />
            <Route path="/shipping-line/delivery-orders" element={<DeliveryOrderPage />} />
          </Route>

          {/* 3. Nhóm Vận hành Bãi (Yard Operator) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.YARD_OPERATOR, ROLES.DISPATCHER, ROLES.ADMINISTRATOR]} />}>
            <Route path="/dashboard" element={<DashboardIndex />} />
            <Route path="/yard-staff/dashboard" element={<YardOperationsDashboard />} />
            <Route path="/yard" element={<YardDesignPreview />} />
            <Route path="/yard/map" element={<YardDesignPreview />} />
            <Route path="/yard/design" element={<Navigate to="/yard" replace />} />
            <Route path="/yard-staff/map" element={<YardDesignPreview />} />
            <Route path="/yard-ops" element={<YardOperations />} />
            <Route path="/yard/receiving" element={<YardReceiving />} />
            <Route path="/yard-staff/movement-operations" element={<YardMovementOperations />} />
            <Route path="/yard-staff/gate-out-preparation" element={<ContainerGateOutPreparation />} />
            <Route path="/yard-staff/container-detail" element={<ContainerDetail />} />
            <Route path="/yard-staff/receiving" element={<YardReceiving />} />
            <Route path="/yard/reefer" element={<ReeferManagement />} />
            <Route path="/reefer" element={<ReeferManagement />} />
          </Route>

          {/* Nhóm Nhân viên Cổng (Gate Officer) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.GATE_OFFICER, ROLES.ADMINISTRATOR]} />}>
            <Route path="/gate" element={<GateControl />} />
            <Route path="/gate/dashboard" element={<GateDashboard />} />
            <Route path="/gate/bookings" element={<GateBookings />} />
            <Route path="/gate/verification" element={<GateVerification />} />
            <Route path="/gate/container" element={<ContainerVerification />} />
            <Route path="/gate/incidents" element={<GateIncidents />} />
            <Route path="/gate/history" element={<GateHistory />} />
            <Route path="/gate/camera" element={<GateCameras />} />
          </Route>

          {/* Nhóm Tài xế Container (Driver Portal) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.DRIVER, ROLES.ADMINISTRATOR]} />}>
            <Route path="/driver-portal" element={<DriverPortalContainer />} />
            <Route path="/driver-home" element={<DriverPortalContainer />} />
            <Route path="/driver" element={<DriverPortalContainer />} />
          </Route>

          {/* Báo cáo hư hỏng (Dành cho Yard Operator & Quản trị viên) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.YARD_OPERATOR, ROLES.ADMINISTRATOR]} />}>
            <Route path="/damage-report" element={<DamageReport />} />
          </Route>

          {/* 4. Nhóm Quản trị viên (Administrator) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.ADMINISTRATOR]} />}>
            <Route path="/dashboard/admin" element={<OperatorDashboard />} />
            <Route path="/users" element={<UserRoleManagement />} />
            <Route path="/reports" element={<ReportsAnalytics />} />
            <Route path="/admin/carriers" element={<CarrierManagement />} />
            <Route path="/admin/shipping-lines" element={<ShippingLineDirectory />} />
            <Route path="/admin/transport-companies" element={<TransportCompanyManagement />} />
            <Route path="/admin/gates" element={<GateManagement />} />
            <Route path="/admin/equipment" element={<EquipmentManagement />} />
            <Route path="/admin/billing" element={<BillingChargesManagement />} />
          </Route>

          {/* Trang Sự cố & AI Ops */}
          <Route element={<RoleRoute allowedRoles={[ROLES.DISPATCHER, ROLES.YARD_OPERATOR, ROLES.GATE_OFFICER, ROLES.ADMINISTRATOR]} />}>
            <Route path="/incidents" element={<IncidentManagement />} />
          </Route>

          {/* Trang Dashboard dùng chung */}
          <Route path="/dashboard" element={<DashboardIndex />} />

        </Route>
      </Route>

      {/* Route không tồn tại ➔ Chuyển về trang chủ */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
