import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../services/apiClient'
import { yardIncidentService, compressImageToDataUrl } from '../../services/yardIncidentService'

const SEVERITIES = [
  { key: 'light', api: 'LOW', label: 'Nhẹ', hint: 'Thẩm mỹ, không ảnh hưởng vận hành' },
  { key: 'medium', api: 'MEDIUM', label: 'Vừa', hint: 'Cần sửa chữa' },
  { key: 'severe', api: 'HIGH', label: 'Nặng', hint: 'Hỏng cấu trúc, cần dừng tác nghiệp' },
]
const DAMAGE_TYPES = ['Móp', 'Trầy xước', 'Thủng', 'Đứt niêm phong', 'Rỉ sét', 'Biến dạng cấu trúc']
const FACES = [
  { key: 'top', label: 'Nóc', cls: 'col-start-2 h-16' },
  { key: 'left', label: 'Hông trái', cls: 'col-start-1 h-32' },
  { key: 'front', label: 'Mặt trước', cls: 'col-start-2 h-32' },
  { key: 'right', label: 'Hông phải', cls: 'col-start-3 h-32' },
  { key: 'back', label: 'Mặt sau (cửa)', cls: 'col-start-2 h-32 mt-2' },
]
const FACE_LABEL = Object.fromEntries(FACES.map((f) => [f.key, f.label]))
const MAX_PHOTOS = 6

const inputCls = 'w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100'

export default function DamageReport() {
  const navigate = useNavigate()
  const [yardContainers, setYardContainers] = useState([])
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState('light')
  const [damageType, setDamageType] = useState(DAMAGE_TYPES[0])
  const [marks, setMarks] = useState([])
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(null)
  const fileRef = useRef(null)

  // Danh sách container đang trong bãi (dữ liệu thật) để tra cứu nhanh
  useEffect(() => {
    let alive = true
    apiClient.get('/yard/containers')
      .then((res) => { if (alive) setYardContainers(res.data?.data?.items || []) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const containerNo = query.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const found = useMemo(() => yardContainers.find((c) => c.containerNo === containerNo) || null, [yardContainers, containerNo])
  const suggestions = useMemo(() => (containerNo.length >= 2 && !found
    ? yardContainers.filter((c) => c.containerNo.includes(containerNo)).slice(0, 6)
    : []), [yardContainers, containerNo, found])

  const addMark = (e, face) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setMarks((prev) => [...prev, { x, y, face }].slice(0, 30))
  }

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

  const submit = async () => {
    if (busy) return
    if (containerNo.length < 4) { setError('Nhập mã container bị hư hỏng.'); return }
    if (description.trim().length < 5) { setError('Mô tả chi tiết hư hỏng (ít nhất vài từ).'); return }
    setBusy(true)
    setError('')
    try {
      const sev = SEVERITIES.find((s) => s.key === severity)
      const report = await yardIncidentService.create({
        type: `Hư hỏng container: ${damageType}`,
        severity: sev.api,
        location: found ? `Block ${found.block} (${found.position})` : 'Chưa xác định vị trí bãi',
        containerNo,
        description: description.trim(),
        photos: photos.map((p) => p.dataUrl),
        details: {
          kind: 'CONTAINER_DAMAGE',
          damageType,
          marks,
          container: found ? { type: found.type, line: found.line, position: found.position, sealNo: found.sealNo } : null,
        },
      })
      setSent(report)
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Không gửi được báo cáo. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setSent(null); setQuery(''); setSeverity('light'); setDamageType(DAMAGE_TYPES[0]); setMarks([]); setDescription(''); setPhotos([]); setError('')
  }

  if (sent) {
    return (
      <div className="p-6 md:p-8 w-full max-w-2xl mx-auto font-sans space-y-5">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-2">
          <span className="material-symbols-outlined text-5xl text-emerald-600">check_circle</span>
          <h2 className="text-xl font-bold text-emerald-900">Đã gửi báo cáo hư hỏng tới Dispatcher</h2>
          <p className="text-sm text-emerald-800">Mã báo cáo <strong className="tabular-nums">{sent.code}</strong> · container <strong className="tabular-nums">{sent.containerNo}</strong></p>
        </div>
        <div className="flex gap-3">
          <button onClick={reset} className="flex-1 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold cursor-pointer transition-colors">Báo cáo container khác</button>
          <button onClick={() => navigate('/')} className="px-6 h-11 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer">Về trang chủ</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 w-full flex flex-col lg:flex-row gap-6 font-sans">
      {/* Cột trái: container + mức độ + mô tả */}
      <div className="w-full lg:w-1/3 flex flex-col gap-4">
        <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative">
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mã container <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder="Nhập mã container (ví dụ TGHU9350075)"
            maxLength={13}
            className={`${inputCls} tabular-nums uppercase placeholder:normal-case`}
          />
          {suggestions.length > 0 && (
            <ul className="absolute left-5 right-5 top-[76px] z-20 rounded-xl border border-slate-200 bg-white shadow-xl p-1">
              {suggestions.map((c) => (
                <li key={c.containerNo}>
                  <button type="button" onClick={() => setQuery(c.containerNo)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-800 tabular-nums">{c.containerNo}</span>
                    <span className="text-xs text-slate-500 tabular-nums">{c.position}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {containerNo.length >= 4 && (found ? (
            <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50/60 p-4 space-y-1.5">
              <div className="text-lg font-bold text-slate-900 tabular-nums">{found.containerNo}</div>
              <div className="text-xs text-slate-600">{[found.line, found.type].filter(Boolean).join(' · ') || '—'}</div>
              <div className="text-xs text-slate-700">Vị trí bãi: <strong className="tabular-nums">{found.position}</strong></div>
              {found.sealNo ? <div className="text-xs text-slate-700">Số seal: <strong className="tabular-nums">{found.sealNo}</strong></div> : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-amber-700">Không thấy container này trong bãi. Báo cáo vẫn được gửi theo mã bạn nhập.</p>
          ))}
        </section>

        <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-2">Mức độ nghiêm trọng</h4>
            <div className="space-y-2">
              {SEVERITIES.map((s) => (
                <label key={s.key} className={`flex items-start gap-3 rounded-xl border px-3 py-2 cursor-pointer transition-colors ${severity === s.key ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name="sev" checked={severity === s.key} onChange={() => setSeverity(s.key)} className="mt-1 accent-orange-500" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{s.label}</span>
                    <span className="block text-[11px] text-slate-500">{s.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-2">Mô tả chi tiết <span className="text-red-500">*</span></h4>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="Mô tả hư hỏng: ở đâu, mức độ, có ảnh hưởng đến hàng hóa không…"
              className="w-full p-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none"
            />
          </div>
        </section>
      </div>

      {/* Cột phải: loại hư hỏng + sơ đồ + ảnh + gửi */}
      <div className="w-full lg:w-2/3 flex flex-col gap-4">
        <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-6">
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-3">Loại hư hỏng</h4>
            <div className="flex flex-wrap gap-2">
              {DAMAGE_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => setDamageType(t)}
                  className={`px-4 h-9 rounded-full text-xs font-semibold transition-colors cursor-pointer ${damageType === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold text-slate-900">Đánh dấu vị trí hư hỏng</h4>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>Bấm lên mặt container để thêm điểm</span>
                {marks.length > 0 && (
                  <button type="button" onClick={() => setMarks([])} className="font-semibold text-orange-600 hover:text-orange-700 cursor-pointer">Xóa tất cả ({marks.length})</button>
                )}
              </div>
            </div>
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-6">
              <div className="grid grid-cols-3 gap-3 max-w-[480px] mx-auto select-none">
                {FACES.map((f) => {
                  const faceMarks = marks.map((m, idx) => ({ ...m, idx })).filter((m) => m.face === f.key)
                  return (
                    <div key={f.key} onClick={(e) => addMark(e, f.key)}
                      className={`${f.cls} border-2 border-slate-300 bg-white relative cursor-crosshair flex items-center justify-center text-[11px] text-slate-400 rounded-md hover:border-orange-300 transition-colors`}>
                      {f.label}
                      {faceMarks.map((m) => (
                        <button key={m.idx} type="button" title="Bấm để xóa điểm này"
                          onClick={(e) => { e.stopPropagation(); setMarks((prev) => prev.filter((_, i) => i !== m.idx)) }}
                          className="absolute w-4 h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer"
                          style={{ left: `${m.x}%`, top: `${m.y}%` }}>
                          {m.idx + 1}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
            {marks.length > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                {marks.length} điểm: {[...new Set(marks.map((m) => FACE_LABEL[m.face]))].join(', ')}
              </p>
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-900">Ảnh chụp bằng chứng hư hỏng</h4>
            <span className="text-xs text-slate-500 tabular-nums">{photos.length} / {MAX_PHOTOS}</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={addPhotos} />
          <div className="flex gap-3 flex-wrap">
            {photos.map((p, i) => (
              <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                <img src={p.dataUrl} alt={p.name} className="w-full h-full object-cover" />
                <button type="button" aria-label="Xóa ảnh" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 text-white text-xs leading-5 cursor-pointer">×</button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 hover:border-orange-400 hover:text-orange-600 text-slate-400 flex flex-col items-center justify-center gap-1 text-xs cursor-pointer transition-colors shrink-0">
                <span className="material-symbols-outlined text-2xl">add_a_photo</span>
                Thêm ảnh
              </button>
            )}
          </div>
        </section>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        <section className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center gap-3">
          <button type="button" onClick={() => navigate('/')} className="px-6 h-11 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold cursor-pointer">
            Hủy bỏ
          </button>
          <button type="button" onClick={submit} disabled={busy}
            className="px-8 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors">
            <span className={`material-symbols-outlined text-lg ${busy ? 'animate-spin' : ''}`}>{busy ? 'progress_activity' : 'send'}</span>
            {busy ? 'Đang gửi…' : 'Gửi báo cáo tới Dispatcher'}
          </button>
        </section>
      </div>
    </div>
  )
}
