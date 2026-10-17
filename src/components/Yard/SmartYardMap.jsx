import { useId } from 'react'

/** Coordinates, road conditions and slot occupancy come from the same routing snapshot. */
export default function SmartYardMap({ navigation, target, vehicles = [], label = 'Bản đồ đường nội bộ bãi' }) {
  const instanceId = useId().replace(/:/g, '')
  const map = navigation?.map
  const nodes = map?.nodes || navigation?.waypoints || []
  if (!nodes.length) return <div className="smart-map-empty">Chưa có bản đồ nội bộ được xác nhận. Vui lòng liên hệ điều phối.</div>
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const layout = map?.layout
  const blocks = layout?.blocks || []
  const slots = layout?.slots || []
  const xs = [...nodes.map(node => node.x), ...blocks.flatMap(block => [block.x, block.x + block.width])]
  const ys = [...nodes.map(node => node.y), ...blocks.flatMap(block => [block.y, block.y + block.height])]
  const left = Math.min(...xs) - 65, top = Math.min(...ys) - 65
  const width = Math.max(Math.max(...xs) - left + 65, 300)
  const height = Math.max(Math.max(...ys) - top + 65, 260)
  const scale = width / 1000
  const textSize = 13 * scale
  const points = navigation?.status === 'available' ? navigation.waypoints || [] : []
  const origin = navigation?.origin
  const destination = navigation?.destinationNode
  const markerId = `road-arrow-${instanceId}`
  const routeId = `route-arrow-${instanceId}`
  const shownRoads = new Set()
  const roadEdges = (map?.edges || navigation?.segments || []).filter(edge => {
    const from = nodeById.get(edge.from), to = nodeById.get(edge.to)
    if (!from || !to || (from.x === to.x && from.y === to.y)) return false
    const key = `${from.x}:${from.y}:${to.x}:${to.y}`
    if (shownRoads.has(key)) return false
    shownRoads.add(key)
    return true
  })
  return <div className="smart-map-frame">
    <svg viewBox={`${left} ${top} ${width} ${height}`} role="img" aria-label={label} className="smart-yard-map">
      <title>{label}</title>
      <desc>Đường có mũi tên chỉ chiều di chuyển. Xanh là tuyến được chỉ định, đỏ là hạn chế, vàng là ùn tắc. Ô container lấy từ dữ liệu bãi.</desc>
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M 0 1 L 8 5 L 0 9" fill="none" stroke="#94a3b8" strokeWidth="1.7" /></marker>
        <marker id={routeId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.3" markerHeight="3.3" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#0d9488" /></marker>
      </defs>
      <rect x={left} y={top} width={width} height={height} rx={18 * scale} fill="#f8fafc" />
      <text x={left + width / 2} y={top + 25 * scale} textAnchor="middle" fontSize={textSize} fill="#64748b" fontWeight="600">BẮC · KHU CHỜ NGOÀI BÃI</text>
      {blocks.map(block => {
        const bayCount = Math.max(1, block.bays), rowCount = Math.max(1, block.rows)
        const cellWidth = block.width / bayCount, cellHeight = block.height / rowCount
        return <g key={block.code}>
          <rect x={block.x - 16 * scale} y={block.y - 47 * scale} width={block.width + 32 * scale} height={block.height + 66 * scale} fill="#edf3f1" rx={8 * scale} stroke="#d8e5df" />
          <text x={block.x + block.width / 2} y={block.y - 29 * scale} textAnchor="middle" fontSize={textSize} fontWeight="700" fill="#334155">{block.label || `BLOCK ${block.code}`} · {bayCount} BAY × {rowCount} ROW × {block.tiers} TIER</text>
          {Array.from({ length: bayCount }, (_, index) => <text key={index} x={block.x + (index + .5) * cellWidth} y={block.y - 9 * scale} textAnchor="middle" fill="#64748b" fontSize={10 * scale}>B{String(index + 1).padStart(2, '0')}</text>)}
          {Array.from({ length: rowCount }, (_, row) => Array.from({ length: bayCount }, (_, bay) => {
            const cellSlots = slots.filter(slot => slot.block === block.code && Number(slot.bay) === bay + 1 && Number(slot.row) === row + 1)
            const occupied = cellSlots.filter(slot => ['occupied', 'full'].includes(String(slot.status).toLowerCase())).length
            const selected = target?.type === 'slot' && target.block === block.code && Number(target.bay) === bay + 1 && Number(target.row) === row + 1
            const restricted = cellSlots.some(slot => String(slot.status).toLowerCase() === 'maintenance')
            const x = block.x + bay * cellWidth, y = block.y + row * cellHeight
            return <g key={`${bay}:${row}`}>
              <rect x={x + 2 * scale} y={y + 2 * scale} width={Math.max(1, cellWidth - 4 * scale)} height={Math.max(1, cellHeight - 4 * scale)} rx={3 * scale} fill={selected ? '#fff0d9' : restricted ? '#fee2e2' : occupied ? '#bed8cd' : '#fff'} stroke={selected ? '#ea751e' : '#d8e5df'} strokeWidth={(selected ? 2.5 : 1) * scale} />
              <text x={x + cellWidth / 2} y={y + cellHeight / 2 + 4 * scale} textAnchor="middle" fontSize={11 * scale} fontWeight={selected ? '700' : '400'} fill={selected ? '#9a4412' : '#547064'}>{cellSlots.length ? `${occupied}/${cellSlots.length}` : '—'}</text>
              {bay === 0 && <text x={block.x - 21 * scale} y={y + cellHeight / 2 + 4 * scale} textAnchor="end" fontSize={10 * scale} fill="#64748b">R{String(row + 1).padStart(2, '0')}</text>}
            </g>
          }))}
        </g>
      })}
      {roadEdges.map(edge => {
        const from = nodeById.get(edge.from), to = nodeById.get(edge.to)
        const blocked = edge.restricted || from.restricted || to.restricted
        const stroke = blocked ? '#ef4444' : edge.congestion > 0 ? '#e6a43b' : '#dce3e9'
        return <g key={edge.id}>
          <path d={`M${from.x},${from.y} L${to.x},${to.y}`} stroke={stroke} strokeWidth={18 * scale} fill="none" strokeLinecap="round" opacity={blocked ? .65 : 1} />
          <path d={`M${from.x},${from.y} L${(from.x + to.x) / 2},${(from.y + to.y) / 2} L${to.x},${to.y}`} stroke={blocked ? '#dc2626' : '#a1afbd'} strokeWidth={1.4 * scale} strokeDasharray={`${4 * scale} ${6 * scale}`} fill="none" markerMid={`url(#${markerId})`} />
          {blocked && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 14 * scale} textAnchor="middle" fontSize={14 * scale} fill="#b91c1c">×</text>}
        </g>
      })}
      {points.length > 0 && <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#0d9488" strokeWidth={6 * scale} strokeLinejoin="round" strokeLinecap="round" markerEnd={`url(#${routeId})`} />}
      {nodes.filter(node => node.gateCode || (node.location && !node.slotId && !node.blockCode)).map(node => <g key={node.id}>
        <rect x={node.x - 48 * scale} y={node.y - 43 * scale} width={96 * scale} height={28 * scale} rx={5 * scale} fill={node.restricted ? '#fff1f2' : '#fff'} stroke={node.restricted ? '#ef4444' : '#cbd5e1'} />
        <text x={node.x} y={node.y - 25 * scale} textAnchor="middle" fontSize={11 * scale} fontWeight="700" fill="#475569">{node.gateCode || node.location || node.label}</text>
      </g>)}
      {origin && <g><circle cx={origin.x} cy={origin.y} r={10 * scale} fill="#0d9488" stroke="#fff" strokeWidth={3 * scale} /><text x={origin.x} y={origin.y - 58 * scale} textAnchor="middle" fontSize={11 * scale} fontWeight="700" fill="#0f766e">XE HIỆN TẠI</text></g>}
      {destination && <g><circle cx={destination.x} cy={destination.y} r={10 * scale} fill="#ea751e" stroke="#fff" strokeWidth={3 * scale} /><text x={destination.x} y={destination.y + 30 * scale} textAnchor="middle" fontSize={11 * scale} fontWeight="700" fill="#a94f13">ĐIỂM ĐẾN</text></g>}
      {vehicles.map(vehicle => {
        const node = nodeById.get(vehicle.journey?.currentNodeId) || vehicle.navigation?.origin
        if (!node) return null
        return <g key={`${vehicle.bookingId}:${vehicle.containerId}`}><circle cx={node.x} cy={node.y} r={9 * scale} fill="#2563eb" stroke="#fff" strokeWidth={2 * scale} /><title>{vehicle.truckPlate || vehicle.driverName || vehicle.containerNumber}</title></g>
      })}
    </svg>
    <div className="smart-map-legend"><span><i className="route" />Tuyến di chuyển</span><span><i className="target" />Điểm đến</span><span><i className="blocked" />Hạn chế</span><span><i className="congested" />Ùn tắc</span></div>
    <p className="smart-map-note">Sơ đồ nội bộ · Vị trí xe theo xác nhận gần nhất, không phải GPS{map?.version ? ` · Bản đồ ${map.version}` : ''}</p>
  </div>
}
