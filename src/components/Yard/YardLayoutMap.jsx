import { useId, useState } from 'react'
import referenceLayout from '../../data/referenceYardLayout.json'
import { slotsForArea, summarizeSlots, YARD_ZONE_COLORS } from '../../utils/yardLayout'
import './YardLayoutMap.css'

/** Reference geometry never supplies operational occupancy or navigable routes. */
export default function YardLayoutMap({ layout = referenceLayout, slots = [], selectedCode, onSelectArea, showDetails = true, compact = false, navigation, vehicles = [] }) {
  const instance = useId().replace(/:/g, '')
  const [localCode, setLocalCode] = useState('A1')
  const [sourceHighlights, setSourceHighlights] = useState(false)
  const activeCode = selectedCode ?? localCode
  const selected = layout.areas.find(area => area.code === activeCode)
  const selectedSlots = selected ? slotsForArea(selected, slots) : []
  const counts = summarizeSlots(selectedSlots)
  const select = area => { setLocalCode(area.code); onSelectArea?.(area) }
  const arrow = `yard-plan-arrow-${instance}`
  const unknown = `yard-plan-unknown-${instance}`
  const operational = navigation?.map?.layout?.drawingVersion === layout.version
  const nodeById = new Map((navigation?.map?.nodes || []).map(node => [node.id, node]))
  const routePoints = operational && navigation?.status === 'available' ? navigation.waypoints || [] : []
  const markers = operational ? [navigation?.origin && {...navigation.origin, kind:'origin'}, navigation?.destinationNode && {...navigation.destinationNode, kind:'destination'}].filter(Boolean) : []
  const active = layout.status === 'active' || operational
  return <section className={`yard-layout ${compact ? 'yard-layout-compact' : ''}`} aria-label="Sơ đồ bãi container dự kiến">
    <div className="yard-layout-heading"><div><h3>Sơ đồ bãi container</h3><p>{active ? 'Sơ đồ bãi đang sử dụng' : 'Phương án bố trí bãi'} · 1 cổng vào / 1 cổng ra · Không theo tỷ lệ thực tế</p></div>
      <label><input type="checkbox" checked={sourceHighlights} onChange={event => setSourceHighlights(event.target.checked)} />Hiện các đánh dấu đỏ trong bản gốc</label>
    </div>
    {operational && navigation?.origin && <p className="yard-layout-note">Vị trí xe: {navigation.origin.label}{navigation.destinationNode ? ` → ${navigation.destinationNode.label}` : ''}</p>}
    <div className="yard-layout-legend">{layout.zones.map(zone => <span key={zone.code}><i style={{ background: YARD_ZONE_COLORS[zone.code] }} />{zone.code} · {zone.label}</span>)}<span><i className="yard-legend-unknown" />Chưa cấu hình</span></div>
    <div className="yard-layout-scroll" role="region" aria-label="Sơ đồ bãi; cuộn ngang để xem trên màn hình nhỏ" tabIndex={0}>
      <div className="yard-layout-canvas" style={{ aspectRatio: `${layout.width}/${layout.height}` }}>
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
          <defs><marker id={arrow} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#006b73" /></marker><marker id={`${arrow}-route`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#c45b22" /></marker>
            <pattern id={unknown} patternUnits="userSpaceOnUse" width="8" height="8"><path d="M0 8 L8 0" stroke="#e2e8f0" strokeWidth="1" /></pattern></defs>
          <rect x="18" y="98" width="964" height="970" rx="5" fill="#fff" stroke="#bac8d7" />
          <text x="40" y="42" className="yard-plan-label">ĐƯỜNG VÀO BÃI</text>
          {layout.roads.map(road => <g key={road.id}><polyline points={road.points.map(point => point.join(',')).join(' ')} fill="none" stroke="#e5ebf2" strokeWidth={road.id === 'access' ? 30 : 26} strokeLinejoin="round" />
            {road.direction === 'one-way' && <polyline points={road.points.map(point => point.join(',')).join(' ')} fill="none" stroke="#006b73" strokeWidth="2" strokeDasharray="7 6" markerEnd={`url(#${arrow})`} />}</g>)}
          {[300,600,900].map(y => <g key={y}><path d={`M691 ${y-20} V${y+18}`} stroke="#006b73" strokeWidth="2.5" markerEnd={`url(#${arrow})`} /><path d={`M949 ${y+18} V${y-20}`} stroke="#006b73" strokeWidth="2.5" markerEnd={`url(#${arrow})`} /></g>)}
          <path d="M770 962 H870" stroke="#006b73" strokeWidth="2.5" markerEnd={`url(#${arrow})`} />
          {layout.facilities.map(facility => <g key={facility.code}><rect x={facility.x} y={facility.y} width={facility.width} height={facility.height} fill="#f1f5f9" stroke="#94a3b8" strokeDasharray={facility.code.startsWith('unassigned') ? '4 3' : undefined} />
            {facility.code === 'office' ? <text x={facility.x+facility.width/2} y={facility.y+17} textAnchor="middle" className="yard-plan-label"><tspan x={facility.x+facility.width/2}>Văn phòng</tspan><tspan x={facility.x+facility.width/2} dy="18">Phòng nghỉ</tspan></text> : facility.code === 'light' ? <text x={facility.x+facility.width/2} y={facility.y+facility.height/2+5} textAnchor="middle" fontSize="13" fill="#334155">Đèn</text> : <text x={facility.x+facility.width/2} y={facility.y+facility.height/2+5} textAnchor="middle" className="yard-plan-label" fontSize="14">{facility.label}</text>}</g>)}
          {layout.areas.map(area => {
            const color = YARD_ZONE_COLORS[area.zone]
            const configured = slotsForArea(area, slots).length > 0
            return <g key={area.code}><rect x={area.x} y={area.y} width={area.width} height={area.height} rx="2" fill={configured ? `${color}22` : `url(#${unknown})`} stroke={color} strokeWidth={activeCode === area.code ? 3 : 1.2} strokeDasharray={configured ? undefined : '4 3'} />
              {area.rows.slice(1).map((_, index) => area.orientation === 'vertical'
                ? <path key={index} d={`M${area.x+2} ${area.y+area.height*(index+1)/area.rows.length} H${area.x+area.width-2}`} stroke={`${color}45`} />
                : <path key={index} d={`M${area.x+area.width*(index+1)/area.rows.length} ${area.y+2} V${area.y+area.height-2}`} stroke={`${color}45`} />)}
              {sourceHighlights && area.sourceHighlight && <circle cx={area.x+area.width-7} cy={area.y+7} r="4" fill="#b4293f" />}
            </g>
          })}
          {operational && (navigation.map.edges || []).filter(edge => edge.restricted || edge.congestion >= .5).map(edge => {
            const a=nodeById.get(edge.from),b=nodeById.get(edge.to)
            return a && b ? <path key={edge.id} d={`M${a.x} ${a.y} L${b.x} ${b.y}`} stroke={edge.restricted ? '#b4293f' : '#b87500'} strokeWidth="8" strokeDasharray={edge.restricted ? '5 4' : undefined} fill="none" /> : null
          })}
          {routePoints.length > 0 && <polyline points={routePoints.map(point=>`${point.x},${point.y}`).join(' ')} fill="none" stroke="#c45b22" strokeWidth="5" strokeLinejoin="round" markerEnd={`url(#${arrow}-route)`} />}
          {markers.map(marker=><g key={marker.kind}><circle cx={marker.x} cy={marker.y} r="8" fill={marker.kind==='origin'?'#185bb8':'#c45b22'} stroke="#fff" strokeWidth="2" /><title>{marker.kind==='origin'?'Vị trí xe: ': 'Điểm đến: '}{marker.label}</title></g>)}
          {operational && vehicles.map(vehicle=>{const node=nodeById.get(vehicle.journey?.currentNodeId)||vehicle.navigation?.origin;return node?<g key={`${vehicle.bookingId}:${vehicle.containerId}`}><circle cx={node.x} cy={node.y} r="6" fill="#185bb8" stroke="#fff" strokeWidth="2" /><title>{vehicle.truckPlate||vehicle.containerNumber}</title></g>:null})}
          {layout.gates.map(gate => <g key={gate.code}><rect x={gate.x-41} y={gate.y-13} width="82" height="28" fill="#fff" stroke="#006b73" strokeDasharray="4 2" /><text x={gate.x} y={gate.y+5} className="yard-plan-label" textAnchor="middle" fontSize="14">{gate.label} {gate.direction === 'in' ? '↓' : '↑'}</text><text x={gate.x} y={gate.y-23} fill="#52647b" textAnchor="middle" fontSize="13">{gate.code}</text></g>)}
          <text x="500" y="1050" textAnchor="middle" className="yard-plan-label">KHU D</text>
        </svg>
        {layout.areas.map(area => <button type="button" key={area.code} className="yard-area-hit" aria-pressed={activeCode === area.code} aria-label={`${area.code}: ${area.note || layout.zones.find(zone => zone.code === area.zone)?.label}; ${slotsForArea(area, slots).length ? 'đã có vị trí vận hành' : 'chưa cấu hình'}`} onClick={() => select(area)} style={{ left: `${area.x/layout.width*100}%`, top: `${area.y/layout.height*100}%`, width: `${area.width/layout.width*100}%`, height: `${area.height/layout.height*100}%` }}>{area.code}</button>)}
      </div>
    </div>
    {showDetails && selected && <div className="yard-layout-selection" aria-live="polite"><strong>{selected.code}</strong><span>{selected.note || 'Chưa có ghi chú trong bản gốc'}</span><span>{counts.total ? `${counts.occupied} đang sử dụng · ${counts.reserved} đã giữ chỗ · ${counts.empty} còn trống · ${counts.maintenance} đang bảo trì` : 'Chưa có vị trí vận hành được cấu hình'}</span><div className="yard-layout-positions">{selected.rows.map(row => <span key={row}>{selected.code}-{row}</span>)}</div></div>}
    <p className="yard-layout-note">Vị trí nét đứt chưa có dữ liệu vận hành. Đánh dấu trong bản gốc không biểu thị tồn kho hoặc bảo trì. {active ? 'Cam: tuyến được chỉ định. Xanh dương: vị trí xe đã xác nhận. Đỏ: đường bị hạn chế.' : 'Vị trí cổng và luồng xe là phương án dự kiến; tuyến được chỉ định chỉ hiển thị sau khi bản đồ được xác nhận.'}</p>
  </section>
}
