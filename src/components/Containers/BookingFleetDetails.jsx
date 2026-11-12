import { useState } from 'react'

const value = input => input === null || input === undefined || input === '' ? 'Chưa khai báo' : input
const date = input => input ? new Date(input).toLocaleDateString('vi-VN') : 'Chưa khai báo'
const status = input => ({ active: 'Đang hoạt động', vehicle_received: 'Đã nhận xe', transport_completed: 'Hoàn thành vận chuyển' })[input] || value(input)
const vehicleType = input => ({ ROAD_TRUCK: 'Xe đầu kéo đường dài', YARD_TRACTOR: 'Xe đầu kéo nội bãi' })[input] || value(input)
function DocumentLink({ href, children }) {
  const [failedUrl, setFailedUrl] = useState(null)
  if (!href || !/^(https?:\/\/|\/(?!\/))/i.test(href)) return null
  return <figure className="min-w-0 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
    {failedUrl !== href ? <a href={href} target="_blank" rel="noopener noreferrer" className="block">
      <img src={href} alt={children} loading="lazy" className="h-36 w-full rounded-lg bg-white object-contain" onError={() => setFailedUrl(href)} />
    </a> : <p className="flex h-36 items-center justify-center rounded-lg bg-white px-3 text-center text-xs text-slate-500">Không tải được ảnh. Bấm liên kết bên dưới để mở hồ sơ.</p>}
    <figcaption><a className="text-xs font-bold text-teal-700 underline" href={href} target="_blank" rel="noopener noreferrer">{children}</a></figcaption>
  </figure>
}
function Fields({ items }) {
  return <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">{items.map(([label, text]) => <div key={label} className="min-w-0"><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-800 break-words">{value(text)}</dd></div>)}</dl>
}
export default function BookingFleetDetails({ vehicle, driver, saved = false }) {
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" aria-label={saved ? 'Hồ sơ phương tiện và tài xế đã lưu' : 'Hồ sơ phương tiện và tài xế đã chọn'}>
    <section className="rounded-2xl border border-slate-200 p-4 space-y-3">
      <h5 className="text-sm font-bold">Hồ sơ xe đầu kéo</h5>
      {vehicle ? <>
        <Fields items={[
          ['Biển số', vehicle.plateNumber], ['Loại phương tiện', vehicleType(vehicle.vehicleType)],
          ['Trạng thái', status(vehicle.status)], ['Vị trí', vehicle.currentLocation],
          ['Mã RFID', vehicle.rfidTag], ['Mô tả', vehicle.description], ['Ngày tạo hồ sơ', date(vehicle.createdAt)],
        ]} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><DocumentLink href={vehicle.photoUrl}>Ảnh phương tiện</DocumentLink><DocumentLink href={vehicle.registrationImageUrl}>Hồ sơ đăng ký / đăng kiểm</DocumentLink></div>
        {vehicle.capturedAt && <p className="text-xs text-slate-500">Lưu hồ sơ lúc {new Date(vehicle.capturedAt).toLocaleString('vi-VN')}</p>}
      </> : <p className="text-xs text-slate-500">{saved ? 'Booking cũ chưa có bản chụp hồ sơ xe.' : 'Chọn xe rảnh để xem hồ sơ.'}</p>}
    </section>
    <section className="rounded-2xl border border-slate-200 p-4 space-y-3">
      <h5 className="text-sm font-bold">Hồ sơ tài xế phụ trách</h5>
      {driver ? <>
        <Fields items={[
          ['Họ và tên', driver.fullName], ['Số điện thoại', driver.phone], ['Số CCCD / CMND', driver.idCardNumber],
          ['Số giấy phép lái xe', driver.licenseNumber], ['Trạng thái', status(driver.status)],
          ['CCCD hết hạn', date(driver.idCardExpiryDate)], ['GPLX hết hạn', date(driver.licenseExpiryDate)], ['Ngày tạo hồ sơ', date(driver.createdAt)],
        ]} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DocumentLink href={driver.photoUrl}>Ảnh tài xế</DocumentLink>
          <DocumentLink href={driver.idCardFrontUrl}>CCCD mặt trước</DocumentLink><DocumentLink href={driver.idCardBackUrl}>CCCD mặt sau</DocumentLink>
          <DocumentLink href={driver.licenseImageUrl}>GPLX mặt trước</DocumentLink><DocumentLink href={driver.licenseBackImageUrl}>GPLX mặt sau</DocumentLink>
        </div>
        {driver.capturedAt && <p className="text-xs text-slate-500">Lưu hồ sơ lúc {new Date(driver.capturedAt).toLocaleString('vi-VN')}</p>}
      </> : <p className="text-xs text-slate-500">{saved ? 'Booking cũ chưa có bản chụp hồ sơ tài xế.' : 'Chọn tài xế rảnh để xem hồ sơ.'}</p>}
    </section>
  </div>
}
