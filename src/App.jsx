import { Routes, Route, Navigate } from 'react-router-dom'
import LandingNav from './pages/LandingNav'
import BerthOps from './pages/BerthOps'
import DriverHome from './pages/DriverHome'
import GateCheckin from './pages/GateCheckin'
import PortNavigation from './pages/PortNavigation'
import ConfirmDelivery from './pages/ConfirmDelivery'
import CargoDeclaration from './pages/CargoDeclaration'
import DamageReport from './pages/DamageReport'
import CarrierProfile from './pages/CarrierProfile'
import EquipmentDispatch from './pages/EquipmentDispatch'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingNav />} />
      <Route path="/berth" element={<BerthOps />} />
      <Route path="/driver" element={<DriverHome />} />
      <Route path="/gate" element={<GateCheckin />} />
      <Route path="/navigate" element={<PortNavigation />} />
      <Route path="/confirm" element={<ConfirmDelivery />} />
      <Route path="/cargo" element={<CargoDeclaration />} />
      <Route path="/damage-report" element={<DamageReport />} />
      <Route path="/carrier-profile" element={<CarrierProfile />} />
      <Route path="/equipment-dispatch" element={<EquipmentDispatch />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
