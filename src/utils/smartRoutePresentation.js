export const routePhaseLabel = {
  to_yard: 'Đang di chuyển tới điểm giao nhận', at_yard: 'Đã đến bãi · chờ giao nhận',
  ready_for_gate_out: 'Đã xác nhận container · đi ra cổng', exited: 'Gate Officer đã xác nhận ra cổng',
}

export const routeDestination = route => ['ready_for_gate_out', 'exited'].includes(route?.journey?.phase)
  ? `Cổng ra ${route.journey.exitGateCode || route.navigation?.destinationNode?.gateCode || 'được phân công'}`
  : route?.target?.type === 'slot'
    ? `Block ${route.target.block} · Bay ${String(route.target.bay).padStart(2, '0')} · Row ${String(route.target.row).padStart(2, '0')} · Tier ${route.target.tier}`
    : route?.target?.location || 'Đang chờ phân công điểm đến'
