import { useEffect, useState } from 'react'
import { containerService } from '../../services/containerService'

const emptyFilters = { containerNumber: '', prefix: '', shippingLineId: '', containerTypeId: '', isoSizeType: '', size: '', category: '' }
const sizes = { ft20: '20 feet', ft40: '40 feet', ft45: '45 feet' }
const categories = { dry: 'Khô', reefer: 'Lạnh', tank: 'Bồn', open_top: 'Hở nóc', flat_rack: 'Flat rack' }
const inputClass = 'w-full rounded-xl border border-chalk bg-fog px-3 py-2.5 text-sm focus:border-signal-orange focus:outline-none'
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
  return <details className="min-w-36">
    <summary className="cursor-pointer text-sm font-semibold">Xem thông số</summary>
    <dl className="mt-2 space-y-2">
      {fields.map(([label, value]) => <div key={label}><dt className="text-xs text-slate">{label}</dt><dd className="text-sm font-semibold">{value}</dd></div>)}
    </dl>
  </details>
}

export default function ContainerEquipmentSearch({ embedded = false, onPickup, onSearch }) {
  const [filters, setFilters] = useState(emptyFilters)
  const [types, setTypes] = useState([])
  const [lines, setLines] = useState([])
  const [result, setResult] = useState(null)
  const [submitted, setSubmitted] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [optionsError, setOptionsError] = useState('')

  useEffect(() => {
    Promise.all([containerService.getContainerTypes(), containerService.getShippingLines()])
      .then(([equipment, directory]) => { setTypes(equipment); setLines(directory) })
      .catch(error => setOptionsError(error.message))
  }, [])

  function update(key, value) {
    setFilters(previous => ({ ...previous, [key]: value }))
  }

  async function search(values, page = 1) {
    const query = {
      ...values,
      containerNumber: values.containerNumber.toUpperCase().replace(/[\s-]+/g, ''),
      prefix: values.prefix.trim().toUpperCase(),
      isoSizeType: values.isoSizeType.trim().toUpperCase(),
    }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const response = await containerService.searchIdentities({ ...query, page })
      setResult(response)
      setSubmitted(query)
      if (page === 1) onSearch?.(query)
    } catch (error) {
      setError(error.details ? Object.values(error.details).flat().join(' ') : error.message)
    } finally {
      setLoading(false)
    }
  }

  const input = (key, label, placeholder, maxLength) => (
    <label className="space-y-1 text-sm font-semibold">
      <span>{label}</span>
      <input className={inputClass} value={filters[key]} onChange={event => update(key, event.target.value)} {...{ placeholder, maxLength }} />
    </label>
  )
  const select = (key, label, options) => (
    <label className="space-y-1 text-sm font-semibold">
      <span>{label}</span>
      <select className={inputClass} value={filters[key]} onChange={event => update(key, event.target.value)}>
        <option value="">Tất cả</option>
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>
  )

  return <section className={embedded ? 'space-y-4' : 'space-y-4 p-6 lg:p-8'}>
    {!embedded && <header>
      <h1 className="font-heading text-3xl font-bold text-carbon">Tra cứu Container</h1>
      <p className="mt-2 text-sm text-slate">Tìm theo số container hoặc kết hợp các bộ lọc thiết bị.</p>
    </header>}
    {optionsError && <p role="alert" className="text-sm text-red-700">{optionsError}</p>}
    <form onSubmit={event => { event.preventDefault(); search(filters) }} className="space-y-4 rounded-2xl border border-chalk bg-white p-5">
      <fieldset disabled={loading} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {input('containerNumber', 'Số container', 'Nhập ít nhất 4 ký tự', 20)}
        {input('prefix', 'Tiền tố BIC', 'Ví dụ HAMU', 4)}
        {select('shippingLineId', 'Hãng tàu', lines.map(line => [line.id, `${line.shortName} · ${line.fullName}`]))}
        {select('containerTypeId', 'Loại trong danh mục', types.map(type => [type.id, `${type.code} · ${type.description}`]))}
        {input('isoSizeType', 'Mã ISO kích thước/loại', 'Ví dụ 45G0', 4)}
        {select('size', 'Kích cỡ danh mục', Object.entries(sizes))}
        {select('category', 'Nhóm thiết bị', Object.entries(categories))}
      </fieldset>
      <div className="flex gap-2">
        <button disabled={loading} className="rounded-xl bg-signal-orange px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{loading ? 'Đang tìm…' : 'Tìm container'}</button>
        <button type="button" disabled={loading} className="rounded-xl border border-chalk px-4 py-2.5 text-sm font-bold" onClick={() => {
          setFilters(emptyFilters)
          setResult(null)
          setSubmitted(null)
          setError('')
          onSearch?.(emptyFilters)
        }}>Xóa bộ lọc</button>
      </div>
    </form>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {result && <div className="overflow-hidden rounded-2xl border border-chalk bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-fog"><tr>
            {['Số container', 'Hãng tàu', 'Loại thiết bị', 'Thông số', ...(onPickup ? ['Thao tác'] : [])].map(label => <th key={label} className="px-4 py-3">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-chalk">
            {result.items.map(item => <tr key={item.id} className="align-top">
              <td className="px-4 py-3 font-mono font-bold">{item.containerNumber}</td>
              <td className="px-4 py-3">
                <strong>{item.shippingLineShortName || item.prefix}</strong>
                {item.shippingLineFullName && <p className="text-xs text-slate">{item.shippingLineFullName}</p>}
              </td>
              <td className="px-4 py-3">
                <strong>{item.containerTypeCode}{item.isoSizeType && ` · ${item.isoSizeType}`}</strong>
                <p className="text-xs text-slate">{item.equipmentDescription || item.containerTypeDescription}</p>
              </td>
              <td className="px-4 py-3"><EquipmentSpecs item={item} /></td>
              {onPickup && <td className="px-4 py-3"><button type="button" onClick={() => onPickup(item)} className="rounded-lg border border-chalk px-3 py-2 text-xs font-bold">Đặt Pickup</button></td>}
            </tr>)}
            {!result.items.length && <tr><td colSpan={onPickup ? 5 : 4} className="p-8 text-center text-slate">Không có container phù hợp.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-chalk p-4 text-sm">
        <span>{result.total} kết quả · Trang {result.page}/{Math.max(1, result.totalPages)}</span>
        <div className="flex gap-2">
          <button disabled={result.page <= 1} onClick={() => search(submitted, result.page - 1)} className="rounded-lg border border-chalk px-3 py-2 disabled:opacity-40">Trước</button>
          <button disabled={result.page >= result.totalPages} onClick={() => search(submitted, result.page + 1)} className="rounded-lg border border-chalk px-3 py-2 disabled:opacity-40">Sau</button>
        </div>
      </div>
    </div>}
  </section>
}
