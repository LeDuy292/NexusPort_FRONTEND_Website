import YardLayoutMap from './YardLayoutMap'
import referenceLayout from '../../data/referenceYardLayout.json'

/** The yard drawing is the only map view; routes require matching backend geometry. */
export default function SmartYardMap({ navigation, vehicles = [], label = 'Sơ đồ đường nội bộ bãi' }) {
  const map = navigation?.map
  return <div aria-label={label}><YardLayoutMap layout={map?.referenceLayout || referenceLayout} slots={map?.layout?.slots || []} compact navigation={navigation} vehicles={vehicles} /></div>
}
