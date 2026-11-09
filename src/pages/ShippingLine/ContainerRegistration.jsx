import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { containerService } from '../../services/containerService'

const fieldClass = 'w-full rounded-xl border border-chalk bg-fog px-3.5 py-2.5 text-sm outline-none focus:border-signal-orange focus:bg-white'

export default function ContainerRegistration() {
  const [types, setTypes] = useState([])
  const [containerNumber, setContainerNumber] = useState('')
  const [containerTypeId, setContainerTypeId] = useState('')
  const [registered, setRegistered] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    containerService.getContainerTypes().then(setTypes).catch(error => setError(error.message))
  }, [])

  async function register(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setRegistered(null)
    try {
      const identity = await containerService.registerIdentity({ containerNumber, containerTypeId })
      setRegistered(identity)
      setContainerNumber('')
      setContainerTypeId('')
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
          <p className="mt-2 text-sm text-slate">Khai báo số và loại container để các bộ phận tra cứu và sử dụng.</p>
        </div>
        <Link to="/containers/search" className="rounded-xl border border-chalk bg-white px-4 py-2 text-sm font-bold">
          Tra cứu Container
        </Link>
      </header>
      <form onSubmit={register} className="max-w-2xl space-y-4 rounded-2xl border border-chalk bg-white p-5">
        <fieldset disabled={submitting} className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold">
            <span>Số Container</span>
            <input
              required
              autoComplete="off"
              placeholder="Ví dụ CSQU3054383"
              className={fieldClass}
              value={containerNumber}
              onChange={event => setContainerNumber(event.target.value.toUpperCase())}
            />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span>Loại Container</span>
            <select required className={fieldClass} value={containerTypeId} onChange={event => setContainerTypeId(event.target.value)}>
              <option value="">Chọn loại Container</option>
              {types.map(type => <option key={type.id} value={type.id}>{type.code} · {type.description}</option>)}
            </select>
          </label>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {registered && <p role="status" className="text-sm text-emerald-700">Đã đăng ký {registered.containerNumber} · {registered.containerTypeCode}</p>}
        <button disabled={submitting || !types.length} className="rounded-xl bg-signal-orange px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {submitting ? 'Đang đăng ký…' : 'Đăng ký Container'}
        </button>
      </form>
    </div>
  )
}
