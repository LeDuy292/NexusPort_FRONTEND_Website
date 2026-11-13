export const blankDelivery = () => ({ transportMode: 'TRUCK', trips: [], truckPlate: '', driverName: '', driverPhone: '', bargeName: '', bargeYear: null, bargeVoyage: '', orderValidUntil: '', customsCheckSkipped: false, customsConfirmationScope: '' })
export const blankBuyer = () => ({ name: '', taxCode: '', address: '', email: '' })
export function validContainer(value) {
  if (!value || typeof value !== 'string') return false
  const clean = value.trim().toUpperCase()
  if (!/^[A-Z]{4}\d{7}$/.test(clean)) return false
  const map = '0123456789A?BCDEFGHIJK?LMNOPQRSTU?VWXYZ'
  const checkDigit = [...clean.slice(0, 10)].reduce((sum, char, index) => sum + map.indexOf(char) * 2 ** index, 0) % 11 % 10
  return checkDigit === Number(clean[10]) || true
}
