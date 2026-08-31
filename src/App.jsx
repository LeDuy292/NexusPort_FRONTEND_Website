import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './routes/ProtectedRoute'
import RoleRoute from './routes/RoleRoute'
import { ROLES } from './routes/routeConfig'
import MainLayout from './layouts/MainLayout'

// Import các trang đã di chuyển
import BerthOps from './pages/Ships/BerthOps'
import CargoDeclaration from './pages/Containers/CargoDeclaration'
import DamageReport from './pages/Containers/DamageReport'
import CarrierProfile from './pages/Ships/CarrierProfile'
import EquipmentDispatch from './pages/Dispatch/EquipmentDispatch'
import VesselSchedule from './pages/Ships/VesselSchedule'
import BerthAssignment from './pages/Ships/BerthAssignment'
import VesselOperationPlan from './pages/Ships/VesselOperationPlan'

// Import các trang mới tạo
import Login from './pages/Auth/Login'
import Unauthorized from './pages/Auth/Unauthorized'
import OperatorDashboard from './pages/Dashboard/OperatorDashboard'
import BookingManagement from './pages/Booking/BookingManagement'
import YardMap from './pages/Yard/YardMap'
import BillingPayment from './pages/Billing/BillingPayment'
import UserRoleManagement from './pages/Users/UserRoleManagement'
import CarrierPortal from './pages/Carrier/CarrierPortal'
import DashboardIndex from './pages/Dashboard/DashboardIndex'
import GateControl from './pages/Gate/GateControl'
import GateDashboard from './pages/Gate/GateDashboard'
import GateBookings from './pages/Gate/GateBookings'
import GateVerification from './pages/Gate/GateVerification'
import ContainerVerification from './pages/Gate/ContainerVerification'
import GateIncidents from './pages/Gate/GateIncidents'
import GateHistory from './pages/Gate/GateHistory'
import GateCameras from './pages/Gate/GateCameras'
import ReportsAnalytics from './pages/Reports/ReportsAnalytics'
import IncidentManagement from './pages/Incident/IncidentManagement'
import DriverManagement from './pages/Carrier/DriverManagement'
import YardOperations from './pages/Yard/YardOperations'
import YardOperationsDashboard from './pages/Yard/YardOperationsDashboard'
import YardMapContainerManagement from './pages/Yard/YardMapContainerManagement'
import ContainerInventoryInspection from './pages/Yard/ContainerInventoryInspection'
import YardMovementOperations from './pages/Yard/YardMovementOperations'
import ContainerGateOutPreparation from './pages/Yard/ContainerGateOutPreparation'
import ContainerDetail from './pages/Yard/ContainerDetail'
import DriverPortalContainer from './pages/Driver/DriverPortalContainer'
import BerthOperationsDashboard from './pages/BerthStaff/BerthOperationsDashboard'
import VesselOperationControl from './pages/BerthStaff/VesselOperationControl'
import DischargingProgress from './pages/BerthStaff/DischargingProgress'
import OperationControl from './pages/BerthStaff/OperationControl'
import BerthIncidentReporting from './pages/BerthStaff/BerthIncidentReporting'

// Import các trang Dispatcher Control Center mới
import VehicleDispatch from './pages/Dispatch/VehicleDispatch'
import VehicleManagement from './pages/Fleet/VehicleManagement'
import TrafficManagement from './pages/Traffic/TrafficManagement'
import ContainerFlow from './pages/Containers/ContainerFlow'
import DispatcherDriverManagement from './pages/Drivers/DriverManagement'
import DispatchHistory from './pages/Dispatch/DispatchHistory'
import CameraMonitoring from './pages/Camera/CameraMonitoring'
import GateBookingRequests from './pages/Dispatch/GateBookingRequests'

// Import các trang Admin Portal mới
import CarrierManagement from './pages/Admin/CarrierManagement'
import BerthManagement from './pages/Admin/BerthManagement'
import GateManagement from './pages/Admin/GateManagement'
import EquipmentManagement from './pages/Admin/EquipmentManagement'
import BillingChargesManagement from './pages/Admin/BillingChargesManagement'

// Component chuyển hướng trang chủ dựa trên vai trò (Role-based Home Redirect)
function HomeRedirect() {
  const user = JSON.parse(localStorage.getItem('user'))
  if (!user) return <Navigate to="/login" replace />

  if (user.role === ROLES.TRANSPORT_COMPANY) {
    return <Navigate to="/carrier-portal" replace />
  }
  if (user.role === ROLES.DRIVER) {
    return <Navigate to="/driver-portal" replace />
  }
  if (user.role === ROLES.GATE_OFFICER) {
    return <Navigate to="/gate" replace />
  }
  if (user.role === ROLES.DISPATCHER) {
    return <Navigate to="/dashboard" replace />
  }
  if (user.role === ROLES.YARD_OPERATOR) {
    return <Navigate to="/yard-staff/dashboard" replace />
  }
  if (user.role === ROLES.BERTH_STAFF) {
    return <Navigate to="/berth-staff/dashboard" replace />
  }
  if (user.role === ROLES.ADMINISTRATOR) {
    return <Navigate to="/dashboard" replace />
  }

  return <Navigate to="/unauthorized" replace />
}

function App() {
  return (
    <Routes>
      {/* Route Công khai */}
      <Route path="/login" element={<Login />} />

      {/* Tuyến đường được Bảo vệ (Yêu cầu Đăng nhập) */}
      <Route element={<ProtectedRoute />}>
        
        {/* Route chuyển hướng trang chủ dựa theo vai trò */}
        <Route path="/" element={<HomeRedirect />} />

        {/* Trang báo lỗi không có quyền truy cập (Fullscreen) */}
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Toàn bộ các trang quản trị dùng chung cấu trúc Sidebar thông qua MainLayout */}
        <Route element={<MainLayout />}>
          
          {/* 1. Nhóm Hãng tàu / Doanh nghiệp ngoài cảng */}
          <Route element={<RoleRoute allowedRoles={[ROLES.TRANSPORT_COMPANY, ROLES.ADMINISTRATOR]} />}>
            <Route path="/cargo" element={<CargoDeclaration />} />
            <Route path="/transport/cargo-declarations" element={<CargoDeclaration />} />
            <Route path="/carrier-profile" element={<CarrierProfile />} />
            <Route path="/carrier-portal" element={<CarrierPortal />} />
            <Route path="/booking" element={<BookingManagement />} />
            <Route path="/billing" element={<BillingPayment />} />
            <Route path="/drivers" element={<DriverManagement />} />
          </Route>

          {/* 2. Nhóm Điều độ (Dispatcher) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.DISPATCHER, ROLES.ADMINISTRATOR]} />}>
            <Route path="/vessel-schedule" element={<VesselSchedule />} />
            <Route path="/berth-assignment" element={<BerthAssignment />} />
            <Route path="/vessel-operation-plan" element={<VesselOperationPlan />} />
            <Route path="/dispatcher/gate-bookings" element={<GateBookingRequests />} />
            <Route path="/dispatch" element={<VehicleDispatch />} />
            <Route path="/fleet" element={<VehicleManagement />} />
            <Route path="/traffic" element={<TrafficManagement />} />
            <Route path="/container-flow" element={<ContainerFlow />} />
            <Route path="/dispatcher/drivers" element={<DispatcherDriverManagement />} />
            <Route path="/dispatch-history" element={<DispatchHistory />} />
            <Route path="/dispatcher/cameras" element={<CameraMonitoring />} />
          </Route>

          {/* Nhóm Nhân viên Cầu tàu (Berth Staff) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.BERTH_STAFF, ROLES.ADMINISTRATOR]} />}>
            <Route path="/berth" element={<BerthOps />} />
          </Route>

          {/* 3. Nhóm Nhân viên Bãi (Yard Operator / Staff) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.YARD_OPERATOR, ROLES.ADMINISTRATOR, ROLES.DISPATCHER]} />}>
            <Route path="/equipment-dispatch" element={<EquipmentDispatch />} />
            <Route path="/yard" element={<YardMap />} />
            <Route path="/yard-ops" element={<YardOperations />} />
            <Route path="/yard-staff/dashboard" element={<YardOperationsDashboard />} />
            <Route path="/yard-staff/map" element={<YardMapContainerManagement />} />
            <Route path="/yard-staff/inventory-inspection" element={<ContainerInventoryInspection />} />
            <Route path="/yard-staff/movement-operations" element={<YardMovementOperations />} />
            <Route path="/yard-staff/gate-out-preparation" element={<ContainerGateOutPreparation />} />
            <Route path="/yard-staff/container-detail" element={<ContainerDetail />} />
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

          {/* Nhóm Nhân viên Cầu Bến (Berth Staff) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.BERTH_STAFF, ROLES.ADMINISTRATOR]} />}>
            <Route path="/berth-staff/dashboard" element={<VesselOperationControl />} />
            <Route path="/berth-staff/vessel-operation-control" element={<VesselOperationControl />} />
            <Route path="/berth-staff/incident-reporting" element={<BerthIncidentReporting />} />
            <Route path="/berth" element={<VesselOperationControl />} />
          </Route>

          {/* Nhóm Tài xế Container (Driver Portal) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.DRIVER, ROLES.ADMINISTRATOR]} />}>
            <Route path="/driver-portal" element={<DriverPortalContainer />} />
            <Route path="/driver-home" element={<DriverPortalContainer />} />
          </Route>

          {/* Báo cáo hư hỏng (Cần cho cả Yard Operator, Gate Officer, Dispatcher, Admin) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.YARD_OPERATOR, ROLES.GATE_OFFICER, ROLES.DISPATCHER, ROLES.ADMINISTRATOR]} />}>
            <Route path="/damage-report" element={<DamageReport />} />
          </Route>

          {/* 4. Nhóm Quản trị viên (Administrator) */}
          <Route element={<RoleRoute allowedRoles={[ROLES.ADMINISTRATOR]} />}>
            <Route path="/dashboard/admin" element={<OperatorDashboard />} />
            <Route path="/users" element={<UserRoleManagement />} />
            <Route path="/reports" element={<ReportsAnalytics />} />
            <Route path="/admin/carriers" element={<CarrierManagement />} />
            <Route path="/admin/berths" element={<BerthManagement />} />
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
  )
}

export default App
