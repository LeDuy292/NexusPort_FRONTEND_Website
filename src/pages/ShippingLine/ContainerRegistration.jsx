import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { containerService } from '../../services/containerService'

const fieldClass = 'w-full rounded-xl border border-chalk bg-fog px-3.5 py-2.5 text-sm outline-none focus:border-signal-orange focus:bg-white'
const emptyForm = {
  containerNumber: '', isoSizeType: '', equipmentDescription: '', tareWeightKg: '',
  maxGrossMassKg: '', capacityM3: '', manufacturer: '',
}
const format = value => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

export default function ContainerRegistration() {
  const [isoTypes, setIsoTypes] = useState([])
  const [line, setLine] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [registered, setRegistered] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([containerService.getRegistrationIsoTypes(), containerService.getOwnShippingLine()])
      .then(([options, profile]) => { setIsoTypes(options); setLine(profile) })
      .catch(error => setError(error.message))
      .finally(() => setLoading(false))
  }, [])

  const number = form.containerNumber.trim().toUpperCase().replace(/[\s-]+/g, '')
  const matchesPrefix = line?.prefixes.includes(number.slice(0, 4))
  const equipment = isoTypes.find(option => option.isoSizeType === form.isoSizeType)
  const tare = Number(form.tareWeightKg)
  const gross = Number(form.maxGrossMassKg)
  const payload = gross - tare
  const invalidWeights = tare > 0 && gross > 0 && payload <= 0
  const changeField = (name, value) => setForm(previous => ({ ...previous, [name]: value }))
  const field = (name, label, props = {}) => (
    <label key={name} className="block space-y-1 text-sm font-semibold">
      <span>{label}</span>
      <input className={fieldClass} value={form[name]} onChange={event => {
        const value = event.target.value
        changeField(name, name === 'containerNumber' ? value.toUpperCase() : value)
      }} {...props} />
    </label>
  )

  async function register(event) {
    event.preventDefault()
    if (!equipment || !matchesPrefix || invalidWeights || submitting) return
    setSubmitting(true)
    setError('')
    setRegistered(null)
    try {
      const identity = await containerService.registerIdentity({
        containerNumber: number,
        isoSizeType: form.isoSizeType,
        equipmentDescription: form.equipmentDescription.trim() || undefined,
        tareWeightKg: tare,
        maxGrossMassKg: gross,
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
          <p className="mt-2 text-sm text-slate">Chọn mã ISO trên cửa container để điền loại và kích thước danh định.</p>
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
      {!loading && line && !isoTypes.length && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Danh mục hiện chưa có mã ISO dùng để đăng ký.</p>}
      <form onSubmit={register} className="space-y-5 rounded-2xl border border-chalk bg-white p-5">
        <fieldset disabled={submitting || loading || !line} className="space-y-5">
          <section className="space-y-3">
            <h2 className="font-bold">Nhận dạng thiết bị</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-semibold">
                <span>Mã ISO kích thước/loại *</span>
                <select required className={fieldClass} value={form.isoSizeType} onChange={event => changeField('isoSizeType', event.target.value)}>
                  <option value="">Chọn mã ISO</option>
                  {isoTypes.map(option => <option key={option.isoSizeType} value={option.isoSizeType}>
                    {option.isoSizeType} · {option.containerTypeCode} · {option.containerTypeDescription}
                  </option>)}
                </select>
              </label>
              <div>
                {field('containerNumber', 'Số container *', { required: true, placeholder: 'HAMU2515680', autoComplete: 'off', maxLength: 20 })}
                {number.length >= 4 && !matchesPrefix && <p className="mt-1 text-xs text-red-700">Tiền tố {number.slice(0, 4)} chưa được đăng ký cho hãng này.</p>}
              </div>
              <dl className="grid gap-3 rounded-xl bg-fog p-3 text-sm">
                <div>
                  <dt className="text-xs text-slate">Loại trong danh mục</dt>
                  <dd className="font-semibold">{equipment ? `${equipment.containerTypeCode} · ${equipment.containerTypeDescription}` : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate">Dài × rộng × cao danh định</dt>
                  <dd className="font-semibold">{equipment ? [equipment.externalLengthMm, equipment.externalWidthMm, equipment.externalHeightMm].map(format).join(' × ') + ' mm' : '—'}</dd>
                </div>
              </dl>
              {field('equipmentDescription', 'Mô tả thiết bị', { maxLength: 250, placeholder: 'Ví dụ High Cube Dry' })}
            </div>
          </section>
          <section className="space-y-3 border-t border-chalk pt-4">
            <h2 className="font-bold">Khối lượng và dung tích</h2>
            <p className="text-sm text-slate">Nhập MAX GROSS và TARE theo thông số in trên cửa container.</p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {field('maxGrossMassKg', 'Khối lượng toàn bộ tối đa · MAX GROSS (kg) *', { required: true, type: 'number', min: 0.01, max: 999999.99, step: 0.01 })}
              {field('tareWeightKg', 'Khối lượng vỏ rỗng · TARE (kg) *', { required: true, type: 'number', min: 0.01, max: 999999.99, step: 0.01 })}
              <div className="space-y-1 text-sm font-semibold">
                <p>Tải trọng hàng tối đa · NET (kg)</p>
                <output className="block rounded-xl bg-fog px-3.5 py-2.5">{tare > 0 && payload > 0 ? format(payload) : '—'}</output>
              </div>
              {field('capacityM3', 'Dung tích bên trong · CU. CAP. (m³)', { type: 'number', min: 0.001, max: 9999.999, step: 0.001, placeholder: 'Tùy chọn' })}
              {field('manufacturer', 'Nhà sản xuất', { maxLength: 150 })}
            </div>
            {invalidWeights && <p role="alert" className="text-sm text-red-700">MAX GROSS phải lớn hơn TARE.</p>}
          </section>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {registered && <p role="status" className="text-sm text-emerald-700">Đã đăng ký {registered.containerNumber} · {registered.containerTypeCode}</p>}
        <button disabled={submitting || loading || !matchesPrefix || !equipment || invalidWeights} className="rounded-xl bg-signal-orange px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {submitting ? 'Đang đăng ký…' : 'Đăng ký Container'}
        </button>
      </form>
    </div>
  )
}
