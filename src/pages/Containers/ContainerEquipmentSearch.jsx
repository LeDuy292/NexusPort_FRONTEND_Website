import { useEffect, useState } from 'react'
import { containerService } from '../../services/containerService'

const emptyFilters = {
  containerNumber: '', prefix: '', containerTypeId: '', isoSizeType: '',
  size: '', category: '', manufacturer: '', minPayloadKg: '',
}
const ownFirstPage = { filters: {}, page: 1 }
const sizes = { ft20: '20 feet', ft40: '40 feet', ft45: '45 feet' }
const categories = { dry: 'Khô', reefer: 'Lạnh', tank: 'Bồn', open_top: 'Hở nóc', flat_rack: 'Flat rack' }
const inputClass = 'w-full rounded-xl border border-chalk bg-fog px-3.5 py-2.5 text-sm outline-none focus:border-signal-orange focus:bg-white focus:ring-0'
const format = (value, unit) => value == null ? '—' : `${value.toLocaleString('vi-VN')} ${unit}`

function EquipmentSpecs({ item }) {
  const dimensions = [item.externalLengthMm, item.externalWidthMm, item.externalHeightMm]
  const fields = [
    ['Dài × rộng × cao', dimensions.every(value => value != null) ? dimensions.map(value => value.toLocaleString('vi-VN')).join(' × ') + ' mm' : '—'],
    ['Khối lượng vỏ', format(item.tareWeightKg, 'kg')],
    ['Khối lượng toàn bộ tối đa', format(item.maxGrossMassKg, 'kg')],
    ['Tải trọng hàng tối đa', format(item.maxPayloadKg, 'kg')],
    ['Dung tích', format(item.capacityM3, 'm³')],
    ['Nhà sản xuất', item.manufacturer || '—'],
  ]
  return <details>
    <summary className="cursor-pointer text-sm font-semibold">Xem thông số</summary>
    <dl className="mt-2 space-y-2">
      {fields.map(([label, value]) => <div key={label}><dt className="text-xs text-slate">{label}</dt><dd className="text-sm font-semibold">{value}</dd></div>)}
    </dl>
  </details>
}

export default function ContainerEquipmentSearch() {
  const [filters, setFilters] = useState(emptyFilters)
  const [types, setTypes] = useState([])
  const [request, setRequest] = useState(ownFirstPage)
  const [response, setResponse] = useState(null)
  const [optionsError, setOptionsError] = useState('')
  const currentResponse = response?.request === request ? response : null
  const result = currentResponse?.result
  const loading = !currentResponse

  useEffect(() => {
    containerService.getContainerTypes()
      .then(setTypes)
      .catch(error => setOptionsError(error.message))
  }, [])

  useEffect(() => {
    let active = true
    containerService.listOwnIdentities({ ...request.filters, page: request.page }).then(result => {
      if (active) setResponse({ request, result })
    }).catch(error => {
      if (active) setResponse({
        request,
        error: error.details ? Object.values(error.details).flat().join(' ') : error.message,
      })
    })
    return () => { active = false }
  }, [request])

  function update(key, value) {
    setFilters(previous => ({ ...previous, [key]: value }))
  }

  function search(event) {
    event.preventDefault()
    const query = {
      ...filters,
      containerNumber: filters.containerNumber.toUpperCase().replace(/[\s-]+/g, ''),
      prefix: filters.prefix.trim().toUpperCase(),
      isoSizeType: filters.isoSizeType.trim().toUpperCase(),
      manufacturer: filters.manufacturer.trim(),
    }
    setRequest({ filters: Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '')), page: 1 })
  }

  function reset() {
    setFilters(emptyFilters)
    setRequest({ ...ownFirstPage })
  }

  const input = (key, label, props) => (
    <label className="space-y-2 text-xs font-bold text-slate">
      <span>{label}</span>
      <input className={inputClass} value={filters[key]} onChange={event => update(key, event.target.value)} {...props} />
    </label>
  )
  const select = (key, label, options) => (
    <label className="space-y-2 text-xs font-bold text-slate">
      <span>{label}</span>
      <select className={inputClass} value={filters[key]} onChange={event => update(key, event.target.value)}>
        <option value="">Tất cả</option>
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>
  )

  const emptyMessage = loading ? 'Đang tải container…' : Object.keys(request.filters).length
    ? 'Không có container phù hợp.' : 'Hãng tàu chưa có container trong danh mục.'
  const error = currentResponse?.error

  return <section data-equipment-search className="space-y-4">
    <p className="text-sm text-slate">Tra cứu thông số vỏ container đã đăng ký của hãng bạn.</p>
    {optionsError && <p role="alert" className="text-sm text-red-700">{optionsError}</p>}
    <form onSubmit={search} className="space-y-3 rounded-2xl border border-chalk bg-white p-5">
      <div className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {input('containerNumber', 'Số container', { placeholder: 'Nhập ít nhất 4 ký tự', maxLength: 20 })}
        {input('prefix', 'Tiền tố BIC', { placeholder: 'Ví dụ HAMU', maxLength: 4 })}
        {select('containerTypeId', 'Loại trong danh mục', types.map(type => [type.id, `${type.code} · ${type.description}`]))}
        {input('isoSizeType', 'Mã ISO kích thước/loại', { placeholder: 'Ví dụ 45G0', maxLength: 4 })}
        <button className="rounded-xl bg-signal-orange px-5 py-3 text-sm font-bold text-white">Tìm kiếm</button>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <details className="min-w-0 flex-1">
          <summary className="cursor-pointer text-xs font-bold text-slate">Bộ lọc bổ sung</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {select('size', 'Kích cỡ danh mục', Object.entries(sizes))}
            {select('category', 'Nhóm thiết bị', Object.entries(categories))}
            {input('manufacturer', 'Nhà sản xuất', { maxLength: 150 })}
            {input('minPayloadKg', 'Tải trọng hàng tối đa từ (kg)', { type: 'number', min: 0.01, max: 999999.99, step: 0.01 })}
          </div>
        </details>
        <button type="button" className="text-xs font-bold text-slate hover:underline" onClick={reset}>Xóa bộ lọc</button>
      </div>
    </form>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="overflow-hidden rounded-2xl border border-chalk bg-white" aria-busy={loading}>
      <h2 className="border-b border-chalk px-5 py-3 text-sm font-bold">
        Container của hãng
      </h2>
      <div className="overflow-x-auto">
        <table className="equipment-search-table text-left text-sm">
          <colgroup>
            <col style={{ width: '22%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '23%' }} />
            <col />
          </colgroup>
          <thead className="bg-fog text-xs uppercase text-slate"><tr>
            {['Số container', 'Hãng tàu', 'Loại thiết bị', 'Thông số'].map(label => <th scope="col" key={label} className="px-5 py-4">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-chalk">
            {result?.items.map(item => <tr key={item.id} className="align-top hover:bg-fog">
              <td className="px-5 py-4 font-mono font-bold">{item.containerNumber}</td>
              <td className="px-5 py-4">
                <strong>{item.shippingLineShortName || item.prefix}</strong>
                {item.shippingLineFullName && <p className="text-xs text-slate">{item.shippingLineFullName}</p>}
              </td>
              <td className="px-5 py-4">
                <strong>{item.containerTypeCode}{item.isoSizeType && ` · ${item.isoSizeType}`}</strong>
                <p className="text-xs text-slate">{item.equipmentDescription || item.containerTypeDescription}</p>
              </td>
              <td className="px-5 py-4"><EquipmentSpecs item={item} /></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!result?.items.length && <div role="status" className="px-5 py-16 text-center text-sm text-slate">
        <span className="material-symbols-outlined mb-3 block text-4xl" aria-hidden="true">search</span>
        {currentResponse?.error ? 'Không tải được dữ liệu container.' : emptyMessage}
      </div>}
      {result && <div className="flex items-center justify-between border-t border-chalk p-4 text-xs text-slate">
        <span>{result.total} kết quả · Trang {result.page}/{Math.max(1, result.totalPages)}</span>
        <div className="flex gap-2">
          <button disabled={result.page <= 1} onClick={() => setRequest({ ...request, page: result.page - 1 })} className="rounded-lg border border-chalk px-3 py-2 disabled:opacity-40">Trước</button>
          <button disabled={result.page >= result.totalPages} onClick={() => setRequest({ ...request, page: result.page + 1 })} className="rounded-lg border border-chalk px-3 py-2 disabled:opacity-40">Sau</button>
        </div>
      </div>}
    </div>
  </section>
}
