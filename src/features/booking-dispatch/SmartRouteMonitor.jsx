import SmartYardMap from '../../components/Yard/SmartYardMap'
import { routeDestination, routePhaseLabel } from '../../utils/smartRoutePresentation'
import '../../pages/Driver/DriverSmartRoute.css'
import './SmartRouteMonitor.css'

export function SmartRouteDetail({ selected, error }) {
  return <div className="yard-monitor-detail"><div className="yard-monitor-heading"><div><strong>{routeDestination(selected)}</strong><p>{selected.truckPlate} · {selected.driverName}</p><p>{routePhaseLabel[selected.journey?.phase]} · {selected.containerNumber} · Vào {selected.gateCode}{selected.operation ? ` · Lệnh ${selected.operation.taskCode || selected.operation.id.slice(0, 8)}` : ''}</p></div></div>
        {!error && <SmartYardMap navigation={selected.navigation} target={selected.target} label={`Lộ trình của xe ${selected.truckPlate || selected.containerNumber}`} />}
        {selected.navigation?.status !== 'available' && selected.navigation?.message && selected.journey?.phase !== 'exited' && <div role="status" className="smart-route-alert">{selected.navigation.message}</div>}
      </div>
}
