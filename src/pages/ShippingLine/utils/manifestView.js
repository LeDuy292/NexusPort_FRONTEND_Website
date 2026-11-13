export function formatManifestDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(date)
}

export function manifestBills(manifest) {
  if (!manifest) return []
  const records = manifest.records || manifest.containers || []
  const source = manifest.blGroups?.length ? manifest.blGroups : manifest.bills?.length ? manifest.bills : [...new Set(records.map(c => c.blNumber))].map(blNumber => ({ blNumber }))
  return source.map(bill => {
    const containers = bill.containers || records.filter(c => c.blNumber === bill.blNumber)
    return { ...bill, shipper: bill.shipper || containers[0]?.shipper || '', consignee: bill.consignee || containers[0]?.consignee || '',
      containers, grossWeightKg: containers.reduce((sum, c) => sum + Number(c.grossWeightKg || 0), 0) }
  })
}

export const manifestCounts = manifest => ({
  bills: manifest.totalBills ?? manifestBills(manifest).length,
  containers: manifest.totalContainers ?? manifest.records?.length ?? manifest.containers?.length ?? manifestBills(manifest).reduce((sum, bill) => sum + bill.containers.length, 0),
})
