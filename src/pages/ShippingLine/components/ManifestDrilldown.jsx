import { useState } from 'react'
import ShippingBadge from './ShippingBadge'
import ShippingPagination from './ShippingPagination'
import ManifestContainerList from './ManifestContainerList'
import { formatManifestDate, manifestBills, manifestCounts } from '../utils/manifestView'

const kg = value => `${Number(value || 0).toLocaleString('vi-VN')} kg`
const button = 'rounded-xl border border-chalk bg-white px-3.5 py-2 text-xs font-bold text-carbon hover:bg-fog disabled:opacity-50'

function Information({ fields }) {
  return <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-chalk bg-fog/50 p-3.5"><dt className="text-xs text-slate">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-carbon">{value || '—'}</dd></div>)}</dl>
}

export default function ManifestDrilldown({ manifest, billNumber, containerNumber, onBill, onContainer, onEdit, onSend, onRecall, acting }) {
  const [billPage, setBillPage] = useState(1)
  const bills = manifestBills(manifest)
  const counts = manifestCounts(manifest)
  const bill = billNumber ? bills.find(item => item.blNumber === billNumber) : null
  const container = containerNumber ? bill?.containers.find(item => item.containerNumber === containerNumber) : null
  if ((billNumber && !bill) || (containerNumber && !container)) return <div className="rounded-2xl border border-chalk bg-white p-8 text-sm text-slate">Không tìm thấy {containerNumber ? 'container' : 'vận đơn'} trong bản khai này. Chọn cấp trước trong đường dẫn để quay lại.</div>

  if (container) return <section className="space-y-5 rounded-2xl border border-chalk bg-white p-5 shadow-sm md:p-6">
    <div className="border-b border-chalk pb-4"><p className="text-xs font-bold uppercase text-slate">Hàng hóa trong vận đơn {bill.blNumber}</p><h3 className="mt-1 font-heading text-xl font-extrabold text-carbon">Container {container.containerNumber}</h3></div>
    <Information fields={[
      ['Số container', container.containerNumber], ['Loại ISO', [container.isoSizeType, container.isoType].filter(Boolean).join(' · ')],
      ['Số niêm chì', container.sealNumber], ['Trọng lượng', kg(container.grossWeightKg)],
      ['Vận đơn', bill.blNumber], ['Bản khai', manifest.manifestNumber],
    ]} />
    <div className="rounded-xl border border-chalk p-4"><h4 className="text-sm font-bold">Mô tả hàng hóa</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate">{container.commodity || container.cargoDescription || 'Chưa có mô tả hàng hóa.'}</p>
      {(container.isReefer || container.cargoType === 'REEFER') && <span className="mt-3 inline-block rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">❄ Container lạnh</span>}
    </div>
  </section>

  if (bill) return <div className="space-y-5">
    <section className="space-y-5 rounded-2xl border border-chalk bg-white p-5 shadow-sm md:p-6">
      <div className="border-b border-chalk pb-4"><p className="text-xs font-bold uppercase text-slate">Chi tiết vận đơn</p><h3 className="mt-1 font-heading text-xl font-extrabold text-carbon">B/L {bill.blNumber}</h3></div>
      <Information fields={[
        ['Người gửi hàng', bill.shipper], ['Người nhận hàng', bill.consignee], ['Bản khai', manifest.manifestNumber],
        ['Chuyến tàu', manifest.voyageInfo?.voyageNumber || manifest.voyageNumber], ['Số container', bill.containers.length], ['Tổng trọng lượng', kg(bill.grossWeightKg)],
      ]} />
    </section>
    <section className="space-y-4 rounded-2xl border border-chalk bg-white p-5 shadow-sm md:p-6">
      <div><h3 className="font-heading text-lg font-extrabold">Container trong vận đơn ({bill.containers.length})</h3><p className="mt-1 text-xs text-slate">10 container / trang. Chọn “Chi tiết” để xem thông tin từng container.</p></div>
      <ManifestContainerList containers={bill.containers} showCommodity={false} onView={index => onContainer(bill.containers[index].containerNumber)} />
    </section>
  </div>

  return <div className="space-y-5">
    <section className="space-y-5 rounded-2xl border border-chalk bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-chalk pb-4">
        <div><p className="text-xs font-bold uppercase text-slate">Chi tiết bản khai</p><div className="mt-1 flex flex-wrap items-center gap-3"><h3 className="font-heading text-xl font-extrabold">{manifest.manifestNumber}</h3><ShippingBadge status={manifest.status} /></div></div>
        <div className="flex flex-wrap gap-2">
          {manifest.source === 'NODE_CORE' && manifest.status === 'DRAFT' && <button type="button" className={button} onClick={onEdit}>Sửa bản nháp</button>}
          <button type="button" className={`${button} border-orange-200 bg-orange-50 text-orange-800`} onClick={onSend} disabled={acting || manifest.status === 'DRAFT'}>{acting ? 'Đang xử lý…' : manifest.sentToPortAt ? 'Gửi lại cho cảng' : 'Gửi cho cảng'}</button>
          {manifest.sentToPortAt && <button type="button" className={button} onClick={onRecall} disabled={acting}>Thu hồi bản khai</button>}
        </div>
      </div>
      <Information fields={[
        ['Chuyến tàu', manifest.voyageInfo?.voyageNumber || manifest.voyageNumber], ['Tên tàu', manifest.voyageInfo?.vesselName || manifest.vesselName],
        ['Hướng khai', manifest.direction === 'IMPORT' ? 'Nhập khẩu' : 'Xuất khẩu'], ['Ngày tạo', formatManifestDate(manifest.createdAt || manifest.created_at)],
        ['Số vận đơn / container', `${counts.bills} vận đơn · ${counts.containers} container`], ['Ngày gửi cảng', formatManifestDate(manifest.sentToPortAt)],
      ]} />
    </section>
    <section className="overflow-hidden rounded-2xl border border-chalk bg-white shadow-sm">
      <div className="border-b border-chalk p-5 md:p-6"><h3 className="font-heading text-lg font-extrabold">Danh sách vận đơn ({bills.length})</h3><p className="mt-1 text-xs text-slate">Chọn một vận đơn để xem thông tin người gửi, người nhận và container.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-xs [&_td]:align-middle [&_th]:align-middle"><thead className="border-b border-chalk bg-fog text-[10px] font-bold uppercase text-slate"><tr>{['Số vận đơn', 'Người gửi hàng', 'Người nhận hàng', 'Số container', 'Trọng lượng (kg)', 'Thao tác'].map(label => <th key={label} className={`px-3 py-3 font-bold ${label === 'Thao tác' ? 'w-[132px] min-w-[132px] text-center' : label === 'Số container' || label === 'Trọng lượng (kg)' ? 'text-right' : 'text-left'}`}>{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-chalk font-medium">{bills.slice((billPage - 1) * 10, billPage * 10).map(item => <tr key={item.blNumber} className="hover:bg-fog/50">
          <td className="px-3 py-3 font-mono font-bold">{item.blNumber || '—'}</td>
          <td className="px-3 py-3">{item.shipper || '—'}</td>
          <td className="px-3 py-3">{item.consignee || '—'}</td>
          <td className="px-3 py-3 text-right font-mono tabular-nums">{item.containers.length}</td>
          <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums">{Number(item.grossWeightKg || 0).toLocaleString('vi-VN')}</td>
          <td className="whitespace-nowrap px-3 py-3 text-center"><button type="button" onClick={() => onBill(item.blNumber)} className="inline-flex items-center whitespace-nowrap rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-signal-orange transition-colors hover:bg-orange-100 cursor-pointer">Chi tiết →</button></td>
        </tr>)}
          {!bills.length && <tr><td colSpan={6} className="p-8 text-center text-slate">Bản khai chưa có vận đơn.</td></tr>}
        </tbody></table></div>
      <ShippingPagination currentPage={billPage} totalItems={bills.length} pageSize={10} onPageChange={setBillPage} itemName="vận đơn" />
    </section>
  </div>
}
