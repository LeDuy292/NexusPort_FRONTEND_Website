export const blankDelivery = () => ({ transportMode: 'TRUCK', trips: [], truckPlate: '', driverName: '', driverPhone: '', bargeName: '', bargeYear: null, bargeVoyage: '', orderValidUntil: '', customsCheckSkipped: false, customsConfirmationScope: '' })
export const blankBuyer = () => ({ name: '', taxCode: '', address: '', email: '' })
export function validContainer(value) {
  if (!/^[A-Z]{3}[UJZ]\d{7}$/.test(value)) return false
  const map = '0123456789A?BCDEFGHIJK?LMNOPQRSTU?VWXYZ'
  return [...value.slice(0, 10)].reduce((sum, char, index) => sum + map.indexOf(char) * 2 ** index, 0) % 11 % 10 === Number(value[10])
}
