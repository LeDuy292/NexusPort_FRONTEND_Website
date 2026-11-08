// The gate calendar follows Vietnam days, independently of UTC/browser timezone.
export function gateBookingDate(value=new Date()) {
  if(value===null||value==='')return ''
  const date=value instanceof Date?value:new Date(value)
  if(!Number.isFinite(date.getTime()))return ''
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)
}
