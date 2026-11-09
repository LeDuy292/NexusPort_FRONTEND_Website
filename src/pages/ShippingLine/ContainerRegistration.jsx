import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { containerService } from '../../services/containerService'

const fieldClass = 'w-full rounded-xl border border-chalk bg-fog px-3.5 py-2.5 text-sm outline-none focus:border-signal-orange focus:bg-white'
const emptyForm = {
  containerNumber: '', containerTypeId: '', isoSizeType: '', equipmentDescription: '',
  externalLengthMm: '', externalWidthMm: '', externalHeightMm: '', tareWeightKg: '',
  maxGrossMassKg: '', capacityM3: '', manufacturer: '',
}
const dimensions = [
  ['externalLengthMm', 'Dài ngoài (mm)'],
  ['externalWidthMm', 'Rộng ngoài (mm)'],
  ['externalHeightMm', 'Cao ngoài (mm)'],
]

export default function ContainerRegistration() {
  const [types, setTypes] = useState([])
  const [line, setLine] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [registered, setRegistered] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([containerService.getContainerTypes(), containerService.getOwnShippingLine()])
      .then(([types, profile]) => { setTypes(types); setLine(profile) })
      .catch(error => setError(error.message))
      .finally(() => setLoading(false))
  }, [])

  const number = form.containerNumber.trim().toUpperCase().replace(/[\s-]+/g, '')
  const matchesPrefix = line?.prefixes.includes(number.slice(0, 4))
  const payload = Number(form.maxGrossMassKg) - Number(form.tareWeightKg)
  const field = (name, label, props = {}) => (
    <label key={name} className="block space-y-1 text-sm font-semibold">
      <span>{label}</span>
      <input className={fieldClass} value={form[name]} onChange={event => {
        const value = event.target.value
        setForm(previous => ({ ...previous, [name]: ['containerNumber', 'isoSizeType'].includes(name) ? value.toUpperCase() : value }))
      }} {...props} />
    </label>
  )

  async function register(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setRegistered(null)
    try {
      const identity = await containerService.registerIdentity({
        containerNumber: number,
        containerTypeId: form.containerTypeId,
        isoSizeType: form.isoSizeType,
        equipmentDescription: form.equipmentDescription.trim() || undefined,
        externalLengthMm: Number(form.externalLengthMm),
        externalWidthMm: Number(form.externalWidthMm),
        externalHeightMm: Number(form.externalHeightMm),
        tareWeightKg: Number(form.tareWeightKg),
        maxGrossMassKg: Number(form.maxGrossMassKg),
        capacityM3: form.capacityM3 === '' ? undefined : Number(form.capacityM3),
        manufacturer: form.manufacturer.trim() || undefined,
      })
      setRegistered(identity)
      setForm(emptyForm)
    } catch (error) {
      setError(error.details ? Object.values(error.details).flat().join(' ') : error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5 p-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-signal-orange">Hãng tàu</p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-carbon">Đăng ký Container</h1>
          <p className="mt-2 text-sm text-slate">Nhập thông số của vỏ container theo ký hiệu trên cửa hoặc bảng thông số thiết bị.</p>
        </div>
        <Link to="/containers/search" className="rounded-xl border border-chalk bg-white px-4 py-2 text-sm font-bold">
          Tra cứu Container
        </Link>
      </header>
      {loading && <p className="text-sm">Đang tải hồ sơ hãng tàu…</p>}
      {line && <div className="rounded-xl border border-chalk bg-white p-4">
        <p className="font-bold">{line.fullName} ({line.shortName})</p>
        <p className="mt-1 text-sm text-slate">Tiền tố BIC được đăng ký · {line.prefixes.join(', ')}</p>
      </div>}
      {!loading && !line && !error && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Admin cần liên kết tài khoản này với hồ sơ hãng tàu trước khi đăng ký container.</p>}
      <form onSubmit={register} className="space-y-5 rounded-2xl border border-chalk bg-white p-5">
        <fieldset disabled={submitting || loading || !line} className="space-y-5">
          <section className="space-y-3">
            <h2 className="font-bold">Nhận dạng thiết bị</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                {field('containerNumber', 'Số container *', { required: true, placeholder: 'HAMU2515680', autoComplete: 'off', maxLength: 20 })}
                {number.length >= 4 && !matchesPrefix && <p className="mt-1 text-xs text-red-700">Tiền tố {number.slice(0, 4)} chưa được đăng ký cho hãng này.</p>}
              </div>
              <label className="block space-y-1 text-sm font-semibold">
                <span>Loại trong danh mục *</span>
                <select required className={fieldClass} value={form.containerTypeId} onChange={event => {
                  const containerTypeId = event.target.value
                  setForm(previous => ({ ...previous, containerTypeId }))
                }}>
                  <option value="">Chọn loại container</option>
                  {types.map(type => <option key={type.id} value={type.id}>{type.code} · {type.description}</option>)}
                </select>
              </label>
              {field('isoSizeType', 'Mã ISO kích thước/loại *', { required: true, maxLength: 4, placeholder: '45G0' })}
              {field('equipmentDescription', 'Mô tả thiết bị', { maxLength: 250, placeholder: 'Ví dụ High Cube Dry' })}
            </div>
          </section>
          <section className="space-y-3 border-t border-chalk pt-4">
            <h2 className="font-bold">Kích thước và tải trọng thiết kế</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {dimensions.map(([key, label]) => field(key, label + ' *', { required: true, type: 'number', min: 1, max: 99999 }))}
              {field('capacityM3', 'Dung tích (m³)', { type: 'number', min: 0.001, max: 9999.999, step: 0.001 })}
              {field('tareWeightKg', 'Khối lượng vỏ (kg) *', { required: true, type: 'number', min: 0.01, max: 999999.99, step: 0.01 })}
              {field('maxGrossMassKg', 'Khối lượng toàn bộ tối đa (kg) *', { required: true, type: 'number', min: 0.01, max: 999999.99, step: 0.01 })}
              <div className="space-y-1 text-sm font-semibold">
                <p>Tải trọng hàng tối đa (kg)</p>
                <output className="block rounded-xl bg-fog px-3.5 py-2.5">{Number(form.tareWeightKg) > 0 && payload > 0 ? payload.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : '—'}</output>
              </div>
              {field('manufacturer', 'Nhà sản xuất', { maxLength: 150 })}
            </div>
          </section>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {registered && <p role="status" className="text-sm text-emerald-700">Đã đăng ký {registered.containerNumber} · {registered.containerTypeCode}</p>}
        <button disabled={submitting || loading || !matchesPrefix || !types.length} className="rounded-xl bg-signal-orange px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {submitting ? 'Đang đăng ký…' : 'Đăng ký Container'}
        </button>
      </form>
    </div>
  )
}
