import { useState } from 'react'
import ShippingPagination from './ShippingPagination'

export default function ManifestContainerList({ containers, page, onPageChange, onEdit, onRemove, onView, showCommodity = true }) {
  const [localPage, setLocalPage] = useState(1)
  const currentPage = Math.min(page ?? localPage, Math.max(1, Math.ceil(containers.length / 10)))
  const start = (currentPage - 1) * 10
  const editable = Boolean(onEdit || onRemove || onView)
  const headings = ['STT', 'Số container', 'Loại ISO', 'Số niêm chì', 'Trọng lượng (kg)', ...(showCommodity ? ['Mô tả hàng hóa'] : [])]
  return <div className="overflow-hidden rounded-xl border border-chalk">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-left text-xs [&_td]:align-middle [&_th]:align-middle">
        <thead className="border-b border-chalk bg-fog text-[10px] font-bold uppercase text-slate"><tr>
          {headings.map(h => <th key={h} className={`px-3 py-3 font-bold ${h === 'Trọng lượng (kg)' ? 'text-right' : 'text-left'}`}>{h}</th>)}
          {editable && <th className="w-[132px] min-w-[132px] px-3 py-3 text-center font-bold">Thao tác</th>}
        </tr></thead>
        <tbody className="divide-y divide-chalk font-medium">
          {!containers.length && <tr><td colSpan={headings.length + (editable ? 1 : 0)} className="p-8 text-center text-slate">Chưa có container.{onEdit && ' Bấm “Thêm container” để nhập thông tin.'}</td></tr>}
          {containers.slice(start, start + 10).map((c, i) => <tr key={c.containerId || c.containerNumber || start + i} className="hover:bg-fog/50">
            <td className="px-3 py-3 text-slate">{start + i + 1}</td>
            <td className="whitespace-nowrap px-3 py-3 font-mono font-bold">{c.containerNumber || '—'}</td>
            <td className="whitespace-nowrap px-3 py-3"><span>{c.isoSizeType || c.isoType || '—'}</span>{c.isReefer && <span className="ml-1 text-sky-700" title="Container lạnh" aria-label="Container lạnh">❄</span>}</td>
            <td className="px-3 py-3 font-mono">{c.sealNumber || '—'}</td>
            <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums">{Number(c.grossWeightKg || 0).toLocaleString('vi-VN')}</td>
            {showCommodity && <td className="max-w-[280px] px-3 py-3"><p className="line-clamp-2 break-words text-slate" title={c.commodity}>{c.commodity || '—'}</p></td>}
            {editable && <td className="whitespace-nowrap px-3 py-3 text-center">
              {onView && <button type="button" className="inline-flex items-center whitespace-nowrap rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-signal-orange transition-colors hover:bg-orange-100 cursor-pointer" onClick={() => onView(start + i)}>Chi tiết →</button>}
              {onEdit && <button type="button" className="rounded-lg px-2 py-1 text-sm font-semibold hover:bg-orange-50" onClick={() => onEdit(start + i)} aria-label={`Sửa container ${c.containerNumber}`}>Sửa</button>}
              {onRemove && <button type="button" className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50" onClick={() => onRemove(start + i)} aria-label={`Xóa container ${c.containerNumber}`}>Xóa</button>}
            </td>}
          </tr>)}
        </tbody>
      </table>
    </div>
    <ShippingPagination currentPage={currentPage} totalItems={containers.length} pageSize={10} onPageChange={onPageChange || setLocalPage} itemName="container" />
  </div>
}
