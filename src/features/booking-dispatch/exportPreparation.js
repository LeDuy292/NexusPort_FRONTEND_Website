export const preparationKey = row => `${row.containerId}:${row.declarationId}`
export const cargoNames = { general: 'Hàng bách hóa', reefer: 'Hàng lạnh', dangerous: 'Hàng nguy hiểm', dangerous_goods: 'Hàng nguy hiểm', oversized: 'Hàng quá khổ', perishable: 'Hàng dễ hư hỏng', overweight: 'Hàng quá tải' }
const optionalNumber = value => value === '' || value == null ? null : Number(value)
export function preparedSource(row) {
  return { containerId: row.containerId, declarationId: row.declarationId, containerNumber: row.containerNumber,
    containerTypeCode: row.containerTypeCode, cargoType: row.cargoType, grossWeightKg: row.grossWeightKg ?? null,
    requiredPowerKw: row.requiredPowerKw ?? null, sealNumber: row.sealNumber || '', vgmKg: row.vgmKg ?? null,
    targetTemperature: row.targetTemperature ?? null, unNumber: row.unNumber || null, dgClass: row.dgClass || null,
    isReeferPowerRequired: row.isReeferPowerRequired ?? (row.cargoType === 'reefer' && row.requiredPowerKw > 0), documents: row.documents || [] }
}
export function preparationContent(value = {}, bookingId = null) {
  return { schemaVersion: 1, bookingId, shippingLineId: value.shippingLineId || null, voyageId: value.voyageId || null,
    mode: value.mode || 'containers', description: value.description || '',
    equipmentRequests: (value.equipmentRequests || []).map(row => ({ typeCode: row.typeCode, quantity: Number(row.quantity) })),
    containers: (value.containers || []).map(row => ({ ...preparedSource(row), vgmKg: optionalNumber(row.vgmKg), targetTemperature: optionalNumber(row.targetTemperature) })),
    sharedDocuments: value.sharedDocuments || [], sharedDocumentsConfirmed: Boolean(value.sharedDocumentsConfirmed) }
}
export function equipmentDemand(content) {
  if (content.mode === 'capacity') return content.equipmentRequests
  return [...content.containers.reduce((counts, row) => counts.set(row.containerTypeCode, (counts.get(row.containerTypeCode) || 0) + 1), new Map())]
    .map(([typeCode, quantity]) => ({ typeCode, quantity }))
}
export function equipmentAssessment(approvedRequests, containers) {
  const approved = new Map((approvedRequests || []).map(row => [row.typeCode.toUpperCase(), Number(row.quantity)]))
  const selected = containers.reduce((counts, row) => {
    const typeCode = (row.containerTypeCode || '').toUpperCase()
    return counts.set(typeCode, (counts.get(typeCode) || 0) + 1)
  }, new Map())
  return [...new Set([...approved.keys(), ...selected.keys()])].map(typeCode => {
    const allowed = approved.get(typeCode) || 0, count = selected.get(typeCode) || 0
    return { typeCode, approved: allowed, selected: count, remaining: Math.max(allowed - count, 0), excess: Math.max(count - allowed, 0) }
  })
}
export function declarationProblems(content, approvedRequests) {
  const problems = requestProblems(content)
  if (!approvedRequests?.length) problems.push('Chưa có cơ cấu thiết bị được hãng tàu duyệt. Tải lại hồ sơ trước khi khai container.')
  for (const row of equipmentAssessment(approvedRequests, content.containers)) {
    if (row.remaining) problems.push(`${row.typeCode}: còn thiếu ${row.remaining} container so với ${row.approved} được duyệt.`)
    if (row.excess) problems.push(`${row.typeCode || 'Chưa rõ loại'}: đã chọn ${row.selected}, vượt ${row.excess} container so với số lượng được duyệt (${row.approved}).`)
  }
  return problems
}
export function requestProblems(content) {
  const problems = []
  if (!content.shippingLineId || !content.voyageId) problems.push('Chọn hãng tàu và chuyến đang mở.')
  const demand = equipmentDemand(content), count = demand.reduce((sum, row) => sum + Number(row.quantity || 0), 0)
  if (!demand.length || count < 1 || count > 50 || demand.some(row => !row.typeCode || !Number.isInteger(row.quantity) || row.quantity < 1)) problems.push('Nhu cầu đặt chỗ phải từ 1–50 container với loại thiết bị hợp lệ.')
  if (new Set(demand.map(row => row.typeCode)).size !== demand.length) problems.push('Mỗi loại container chỉ khai một dòng nhu cầu.')
  if (new Set(content.containers.map(row => row.containerId)).size !== content.containers.length) problems.push('Mỗi container chỉ được chọn một lần.')
  if (new Set(content.containers.map(row => row.cargoType)).size > 1) problems.push('Các container trong lô phải cùng loại hàng.')
  return problems
}
