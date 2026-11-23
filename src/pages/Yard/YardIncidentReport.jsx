import React, { useMemo, useRef, useState } from 'react'
import Select from '../../components/ui/Select'
import tienSaLayout from '../../features/yard-design/tienSaLayout.json'
import { yardIncidentService, compressImageToDataUrl } from '../../services/yardIncidentService'

const INCIDENT_TYPES = [
  'Container bị hư hỏng (vỏ, cửa, góc đúc)',
  'Container không tìm thấy tại vị trí gốc',
  'Vị trí đích đã bị container khác chiếm',
  'Không thể tiếp cận container (vật cản đường đi)',
  'Thiết bị nâng hạ hỏng, không hoạt động được',
  'Mất điện / sự cố nguồn điện thiết bị',
  'Xung đột lệnh (lệnh trùng lặp, sai thông tin)',
  'Thiếu nhân sự, bất khả kháng tại hiện trường',
  'Lý do khác',
]

const SEVERITY_OPTIONS = [
  { value: 'LOW', label: 'Thấp', hint: 'Không ảnh hưởng vận hành', dot: 'bg-emerald-500', on: 'border-emerald-400 bg-emerald-50' },
  { value: 'MEDIUM', label: 'Trung bình', hint: 'Gây chậm trễ nhỏ', dot: 'bg-amber-500', on: 'border-amber-400 bg-amber-50' },
  { value: 'HIGH', label: 'Cao', hint: 'Tạm dừng tác nghiệp khu vực', dot: 'bg-orange-500', on: 'border-orange-400 bg-orange-50' },
  { value: 'CRITICAL', label: 'Nghiêm trọng', hint: 'Dừng toàn bộ hoạt động', dot: 'bg-red-500', on: 'border-red-400 bg-red-50' },
]
const SEVERITY_LABEL = Object.fromEntries(SEVERITY_OPTIONS.map((s) => [s.value, s.label]))
const MAX_PHOTOS = 6

const inputCls = 'w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
const areaCls = 'w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none'

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label}{required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-slate-400 mt-1">{hint}</p> : null}
    </div>
  )
}

const emptyForm = (locations) => ({
  type: INCIDENT_TYPES[0],
  severity: 'MEDIUM',
  location: locations[0],
  containerNo: '',
  equipment: '',
  description: '',
  immediateAction: '',
})

export default function YardIncidentReport() {
  // Vị trí lấy từ sơ đồ bãi thật (các block) + vài vị trí chung
  const locations = useMemo(() => {
    const blocks = (tienSaLayout.areas || tienSaLayout.blocks || []).map((a) => a.code || a.blockCode).filter(Boolean).sort()
    return [...blocks.map((b) => `Block ${b}`), 'Cổng bãi', 'Khu vực thiết bị nâng hạ', 'Vị trí khác']
  }, [])

  const [form, setForm] = useState(() => emptyForm(locations))
  const [photos, setPhotos] = useState([]) // { dataUrl, name }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(null)
  const fileRef = useRef(null)

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const addPhotos = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, MAX_PHOTOS - photos.length)
    event.target.value = ''
    if (!files.length) return
    setError('')
    try {
      const added = await Promise.all(files.map(async (f) => ({ dataUrl: await compressImageToDataUrl(f), name: f.name })))
      setPhotos((prev) => [...prev, ...added].slice(0, MAX_PHOTOS))
    } catch (e) {
      setError(e.message || 'Không thêm được ảnh.')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    if (form.description.trim().length < 5) { setError('Vui lòng mô tả sự cố (ít nhất vài từ).'); return }
    setBusy(true)
    setError('')
    try {
      const report = await yardIncidentService.create({ ...form, photos: photos.map((p) => p.dataUrl) })
      setSent(report)
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Không gửi được báo cáo. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { setSent(null); setForm(emptyForm(locations)); setPhotos([]); setError('') }

  if (sent) {
    return (
      <div className="p-6 md:p-8 w-full max-w-3xl mx-auto font-sans space-y-5">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-2">
          <span className="material-symbols-outlined text-5xl text-emerald-600">check_circle</span>
          <h2 className="text-xl font-bold text-emerald-900">Đã gửi báo cáo tới Dispatcher</h2>
          <p className="text-sm text-emerald-800">Dispatcher nhận báo cáo ngay trên màn hình điều phối. Vui lòng theo dõi hiện trường.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {[
            ['Mã báo cáo', sent.code],
            ['Mức độ', SEVERITY_LABEL[sent.severity] || sent.severity],
            ['Người báo', sent.reportedBy || '—'],
            ['Lúc gửi', new Date(sent.reportedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false })],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
              <div className="text-[11px] text-slate-500">{k}</div>
              <div className="font-semibold text-slate-900 tabular-nums break-words">{v}</div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm space-y-1.5">
          <div><span className="text-slate-500">Loại sự cố: </span><strong>{sent.type}</strong></div>
          <div><span className="text-slate-500">Vị trí: </span><strong>{sent.location}</strong></div>
          <div><span className="text-slate-500">Container: </span><strong className="tabular-nums">{sent.containerNo || '—'}</strong></div>
          <div><span className="text-slate-500">Thiết bị: </span><strong>{sent.equipment || '—'}</strong></div>
          <div><span className="text-slate-500">Mô tả: </span>{sent.description}</div>
          {sent.photos?.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2">
              {sent.photos.map((u) => <img key={u} src={u} alt="Ảnh hiện trường" className="aspect-square object-cover rounded-lg border border-slate-200" />)}
            </div>
          )}
        </div>
        <button onClick={reset} className="w-full h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold cursor-pointer transition-colors">
          Báo cáo sự cố mới
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="p-6 md:p-8 w-full max-w-5xl mx-auto font-sans space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-3">
        <span className="material-symbols-outlined text-amber-600 shrink-0">info</span>
        <span>Báo cáo được gửi trực tiếp tới Dispatcher để xử lý. Điền đầy đủ và đính kèm ảnh hiện trường để được hỗ trợ nhanh nhất.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Thông tin sự cố</h3>
          <Field label="Loại sự cố" required>
            <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
              {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Vị trí xảy ra" required>
            <Select value={form.location} onChange={(e) => set('location', e.target.value)}>
              {locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Mã container liên quan">
            <input className={`${inputCls} tabular-nums uppercase placeholder:normal-case`} value={form.containerNo} maxLength={11}
              onChange={(e) => set('containerNo', e.target.value.toUpperCase())} placeholder="Ví dụ: TGHU9350075 (nếu có)" />
          </Field>
          <Field label="Thiết bị liên quan">
            <input className={inputCls} value={form.equipment} maxLength={100} onChange={(e) => set('equipment', e.target.value)} placeholder="Ví dụ: RTG-02, xe nâng RS-01 (nếu có)" />
          </Field>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Mức độ và mô tả</h3>
          <Field label="Mức độ nghiêm trọng" required>
            <div className="grid grid-cols-2 gap-2">
              {SEVERITY_OPTIONS.map((s) => {
                const on = form.severity === s.value
                return (
                  <button key={s.value} type="button" onClick={() => set('severity', s.value)} aria-pressed={on}
                    className={`text-left rounded-xl border px-3 py-2 cursor-pointer transition-colors ${on ? s.on : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span className={`w-2 h-2 rounded-full ${s.dot}`} />{s.label}
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">{s.hint}</span>
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label="Mô tả chi tiết" required>
            <textarea rows={4} className={areaCls} value={form.description} maxLength={4000} onChange={(e) => set('description', e.target.value)}
              placeholder="Container ở đâu, thiết bị nào, xảy ra lúc nào, hậu quả hiện tại…" required />
          </Field>
          <Field label="Hành động đã thực hiện ngay">
            <textarea rows={2} className={areaCls} value={form.immediateAction} maxLength={2000} onChange={(e) => set('immediateAction', e.target.value)}
              placeholder="Ví dụ: đã dừng cẩu, đã báo tổ trưởng ca…" />
          </Field>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">Ảnh hiện trường</h3>
          <span className="text-xs text-slate-500 tabular-nums">{photos.length} / {MAX_PHOTOS}</span>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={addPhotos} />
        <div className="flex flex-wrap gap-3">
          {photos.map((p, i) => (
            <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200">
              <img src={p.dataUrl} alt={p.name} className="w-full h-full object-cover" />
              <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} aria-label="Xóa ảnh"
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 text-white text-xs leading-5 cursor-pointer">×</button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 hover:border-orange-400 hover:text-orange-600 text-slate-400 flex flex-col items-center justify-center gap-1 text-xs cursor-pointer transition-colors">
              <span className="material-symbols-outlined text-2xl">add_a_photo</span>
              Thêm ảnh
            </button>
          )}
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <button type="submit" disabled={busy}
        className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors">
        <span className="material-symbols-outlined text-lg">{busy ? 'progress_activity' : 'send'}</span>
        {busy ? 'Đang gửi…' : 'Gửi báo cáo tới Dispatcher'}
      </button>
    </form>
  )
}
