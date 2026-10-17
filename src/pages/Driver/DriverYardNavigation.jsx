import DriverSmartRoute from './DriverSmartRoute'

export default function DriverYardNavigation({ containerId, containerNumber, bookingId, onBack, onStatusUpdated }) {
  return <div className="space-y-4">
    {onBack && <button type="button" onClick={onBack} className="px-4 py-2 bg-white border border-chalk rounded-xl text-xs font-bold text-slate">← Quay lại chuyến vận chuyển</button>}
    <DriverSmartRoute containerId={containerId} containerNumber={containerNumber} bookingId={bookingId} onStatusUpdated={onStatusUpdated} />
  </div>
}
